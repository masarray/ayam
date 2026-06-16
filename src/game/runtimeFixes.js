import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  TILE_SIZE,
  TRAFFIC_MIN_GAP,
  VEHICLE_SAFE_MARGIN
} from './constants.js';

// Runtime engine guard for mobile playability regressions.
// Keep this file small and deterministic: it patches lifecycle/simulation
// behavior without touching UI state, audio, or quiz flow.
if (!RoadQuestGame.__ayamRuntimeFixesAppliedV3) {
  RoadQuestGame.__ayamRuntimeFixesAppliedV3 = true;

  const proto = RoadQuestGame.prototype;
  const originalSetupLights = proto._setupLights;
  const originalReset = proto.reset;
  const originalLoadSaveState = proto.loadSaveState;
  const originalAddRow = proto._addRow;

  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
  const deterministicNoise = (rowIndex, index) => {
    const x = Math.sin((rowIndex + 1) * 91.73 + (index + 3) * 37.19) * 43758.5453;
    return x - Math.floor(x);
  };
  const laneBounds = (margin = VEHICLE_SAFE_MARGIN) => ({
    minX: MIN_TILE * TILE_SIZE - margin,
    maxX: MAX_TILE * TILE_SIZE + margin
  });
  const laneProgress = (vehicle, direction, wrapMin, wrapMax) => (
    direction > 0 ? vehicle.position.x - wrapMin : wrapMax - vehicle.position.x
  );
  const isCompactVehicle = (data = {}) => {
    const kind = String(data.kind || '').toLowerCase();
    if (/car|taxi|scooter|bike|motor|pickup|van/.test(kind)) return true;
    return Number(data.width || 0) <= 94;
  };
  const isHeavyVehicle = (data = {}) => {
    const kind = String(data.kind || '').toLowerCase();
    if (/bus|truck|tanker|container|dump|tractor|articulated/.test(kind)) return true;
    return Number(data.width || 0) >= 118;
  };
  const targetTrafficCount = (rowIndex, currentCount) => {
    if (rowIndex <= 12) return Math.min(currentCount, 1);
    if (rowIndex <= 24) return Math.min(currentCount, 2);
    if (rowIndex <= 40) return Math.min(currentCount, 3);
    return currentCount;
  };
  const selectEvenlySpacedVehicles = (items, desiredCount) => {
    if (items.length <= desiredCount) return items;
    const sorted = [...items].sort((a, b) => a.position.x - b.position.x);
    const selected = [];
    for (let i = 0; i < desiredCount; i += 1) {
      const index = Math.min(sorted.length - 1, Math.round(((i + 0.5) * sorted.length) / desiredCount - 0.5));
      if (!selected.includes(sorted[index])) selected.push(sorted[index]);
    }
    return selected.length ? selected : sorted.slice(0, desiredCount);
  };
  const approach = (current, target, accel, brake, delta) => {
    const speedDelta = target - current;
    const limit = (speedDelta >= 0 ? accel : brake) * delta;
    return current + clampNumber(speedDelta, -limit, limit);
  };

  proto._trimSimulationWindow = function trimSimulationWindow(centerRow = 0, forwardRows = 18, backwardRows = 0) {
    const minRow = Math.max(0, centerRow - backwardRows);
    const maxRow = centerRow + forwardRows;

    for (const [rowIndex, rowGroup] of Array.from(this.rowGroups.entries())) {
      if (rowIndex >= minRow && rowIndex <= maxRow) continue;
      this.worldGroup.remove(rowGroup);
      this.rowGroups.delete(rowIndex);
      this.waterFlowRows.delete(rowIndex);
    }

    const keepMovingItem = (item) => {
      const rowIndex = item.userData?.rowIndex ?? 0;
      if (rowIndex >= minRow && rowIndex <= maxRow) return true;
      this.vehicleGroup.remove(item);
      return false;
    };

    this.vehicles = this.vehicles.filter(keepMovingItem);
    this.planks = this.planks.filter(keepMovingItem);

    for (const rowIndex of Array.from(this.trafficRows.keys())) {
      if (rowIndex < minRow || rowIndex > maxRow) this.trafficRows.delete(rowIndex);
    }
    for (const rowIndex of Array.from(this.waterRows.keys())) {
      if (rowIndex < minRow || rowIndex > maxRow) this.waterRows.delete(rowIndex);
    }

    this.waterFlowItems = this.waterFlowItems.filter((item) => {
      const rowIndex = item.userData?.waterFlow?.rowIndex ?? 0;
      return rowIndex >= minRow && rowIndex <= maxRow;
    });
  };

  proto._normalizeTrafficLaneForPlayability = function normalizeTrafficLaneForPlayability(rowIndex, items) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const desiredCount = targetTrafficCount(rowIndex, items.length);
    let laneItems = items;

    if (desiredCount < items.length) {
      const selected = new Set(selectEvenlySpacedVehicles(items, desiredCount));
      const removed = new Set(items.filter((vehicle) => !selected.has(vehicle)));
      removed.forEach((vehicle) => this.vehicleGroup.remove(vehicle));
      this.vehicles = this.vehicles.filter((vehicle) => !removed.has(vehicle));
      laneItems = items.filter((vehicle) => selected.has(vehicle));
      this.trafficRows.set(rowIndex, laneItems);
    }

    if (rowIndex <= 24) {
      laneItems.forEach((vehicle, index) => {
        const data = vehicle.userData || {};
        if (data.playabilityProfileApplied) return;

        const compact = isCompactVehicle(data);
        const heavy = isHeavyVehicle(data);
        const originalBase = data.baseSpeed || data.speed || 140;
        const noise = deterministicNoise(rowIndex, index);
        const minSpeed = rowIndex <= 12
          ? (compact ? 190 : heavy ? 158 : 174)
          : (compact ? 172 : heavy ? 142 : 158);
        const maxSpeed = rowIndex <= 12
          ? (compact ? 252 : heavy ? 218 : 236)
          : (compact ? 238 : heavy ? 204 : 222);
        const targetBase = clampNumber(Math.max(originalBase, minSpeed) + (noise - 0.5) * 34, minSpeed, maxSpeed);

        data.speed = targetBase;
        data.baseSpeed = targetBase;
        data.cruiseSpeed = targetBase * (0.94 + deterministicNoise(rowIndex, index + 11) * 0.14);
        data.maxSpeed = targetBase * (compact ? 1.24 : heavy ? 1.08 : 1.14);
        data.acceleration = Math.max(data.acceleration || 0, compact ? 115 : heavy ? 62 : 84);
        data.brakePower = Math.max(data.brakePower || 0, compact ? 168 : heavy ? 132 : 150);
        data.currentSpeed = clampNumber(data.currentSpeed || targetBase, targetBase * 0.94, data.maxSpeed);
        data.minFollowGap = Math.max(data.minFollowGap || TRAFFIC_MIN_GAP, data.width * (compact ? 0.48 : 0.56), rowIndex <= 12 ? 92 : 84);
        data.playabilityProfileApplied = true;
      });
    }

    return laneItems;
  };

  proto._normalizeVisibleTrafficLanes = function normalizeVisibleTrafficLanes() {
    for (const [rowIndex, items] of Array.from(this.trafficRows.entries())) {
      this._normalizeTrafficLaneForPlayability(rowIndex, items);
    }
  };

  proto._setupLights = function setupLightsWithMobileShadowGuard() {
    originalSetupLights.call(this);

    // Mobile WebGL shadow maps are the most expensive part of this scene.
    // Disabling them on phones keeps movement responsive; desktop keeps the
    // premium shadowed look.
    if (this.renderProfile?.name !== 'desktop-premium') {
      this.renderer.shadowMap.enabled = false;
      if (this.sunlight) this.sunlight.castShadow = false;
    }
  };

  proto._addRow = function addRowWithTrafficNormalization(row) {
    originalAddRow.call(this, row);
    if (row?.type === 'traffic') {
      const items = this.trafficRows.get(row.index);
      this._normalizeTrafficLaneForPlayability(row.index, items);
    }
  };

  proto.reset = function resetWithLightOpeningScene(startImmediately = false) {
    originalReset.call(this, startImmediately);
    this._normalizeVisibleTrafficLanes();
    // Keep the active render/simulation window small on mobile. The row data is
    // still generated, but off-screen geometry does not burn frame time.
    this._trimSimulationWindow(0, 20, 0);
  };

  proto.loadSaveState = function loadSaveStateWithTrim(state, startImmediately = true) {
    const result = originalLoadSaveState.call(this, state, startImmediately);
    const row = this.playerPosition?.row || 0;
    this._normalizeVisibleTrafficLanes();
    this._trimSimulationWindow(row, 28, 16);
    return result;
  };

  proto.start = function start() {
    if (this.isGameOver && !this.restartPrepared) this.reset(false);

    this.isRuntimeSuspended = false;
    this.isGameOver = false;
    this.isImpacting = false;
    this.isPlaying = true;
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.restartPrepared = false;

    this._normalizeVisibleTrafficLanes();
    this._clearSpawnAroundPlayer?.(2, 220);
    this.clock.getDelta();
    this._ensureAnimationLoop();
  };

  proto._animate = function animate() {
    this.renderRequested = null;
    if (this.isDestroyed || this.isRuntimeSuspended) return;
    const delta = Math.min(this.clock.getDelta(), 0.035);

    if (this.isUiPaused && !this.isImpacting) {
      const nowMs = performance.now();
      if (nowMs - this.lastPausedRenderAt > 220) {
        this.lastPausedRenderAt = nowMs;
        this.renderer.render(this.scene, this.camera);
      }
      this._ensureAnimationLoop();
      return;
    }

    if (this.isImpacting) {
      this._updateVehicles(delta * 0.12);
      this._updateImpactEffect();
    } else if (this.isPlaying && !this.isGameOver) {
      this._updateVehicles(delta);
      this._updatePlayerMovement();
      this._updateWaterState(delta);
      this._checkTrafficCollision();
      if (!this.isImpacting) this._checkNearMiss();
      this._checkHazardSound();
    } else {
      // Intro/menu/game-over frames render the world but do not simulate traffic.
      // This keeps the PWA light before the first playable frame.
    }

    this._updateWaterFlow(delta);
    this._updateFx(delta);
    this._updateGhostBlink();
    this._updateCamera(false, delta);
    if (this.isImpacting) this._applyCameraShake();
    this.renderer.render(this.scene, this.camera);
    this._ensureAnimationLoop();
  };

  proto._updateSmartTrafficLane = function updateSmartTrafficLaneNatural(items, delta) {
    if (!items.length) return;

    const rowIndex = items[0].userData?.rowIndex ?? 0;
    const laneItems = this._normalizeTrafficLaneForPlayability(rowIndex, items) || items;
    if (!laneItems.length) return;

    const direction = laneItems[0].userData.direction;
    const maxVehicleWidth = Math.max(...laneItems.map((vehicle) => vehicle.userData.width || 72));
    const { minX, maxX } = laneBounds(VEHICLE_SAFE_MARGIN);
    const wrapMin = minX - maxVehicleWidth;
    const wrapMax = maxX + maxVehicleWidth;
    const span = wrapMax - wrapMin;

    if (laneItems.length === 1) {
      const data = laneItems[0].userData || {};
      const base = data.baseSpeed || data.speed || 140;
      const cruise = data.cruiseSpeed || base;
      const maxSpeed = data.maxSpeed || base * 1.12;
      data.currentSpeed = approach(
        data.currentSpeed || base,
        clampNumber(cruise, base * 0.92, maxSpeed),
        data.acceleration || 82,
        data.brakePower || 130,
        delta
      );
      this._updateFreeMovingObstacle(laneItems[0], delta, VEHICLE_SAFE_MARGIN);
      return;
    }

    const sorted = laneItems
      .map((vehicle) => ({
        vehicle,
        progress: laneProgress(vehicle, direction, wrapMin, wrapMax)
      }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const item = sorted[i];
      const front = i === sorted.length - 1 ? sorted[0] : sorted[i + 1];
      const data = item.vehicle.userData || {};
      const frontData = front.vehicle.userData || {};
      const frontProgress = front.progress + (i === sorted.length - 1 ? span : 0);
      const gap = frontProgress - item.progress - ((data.width || 72) + (frontData.width || 72)) * 0.5;
      const compact = isCompactVehicle(data);
      const heavy = isHeavyVehicle(data);
      const currentSpeed = data.currentSpeed || data.baseSpeed || data.speed || 120;
      const frontSpeed = frontData.currentSpeed || frontData.baseSpeed || frontData.speed || currentSpeed;
      const base = data.baseSpeed || data.speed || currentSpeed;
      const cruise = data.cruiseSpeed || base;
      const maxSpeed = data.maxSpeed || base * (compact ? 1.2 : 1.1);
      const hardGap = Math.max(data.minFollowGap || TRAFFIC_MIN_GAP, (data.width || 72) * 0.55, rowIndex <= 24 ? 86 : TRAFFIC_MIN_GAP);
      const comfortGap = hardGap + (rowIndex <= 24 ? 78 : 112) + currentSpeed * (compact ? 0.08 : 0.12);
      const chaseGap = comfortGap + (compact ? 180 : 72);
      let targetSpeed = cruise;

      if (gap < hardGap) {
        // Real braking only when the front vehicle is already too close.
        const emergencyFloor = rowIndex <= 24 ? (compact ? 118 : 92) : 46;
        targetSpeed = Math.max(emergencyFloor, Math.min(cruise, frontSpeed * (compact ? 0.68 : 0.62)));
      } else if (gap < comfortGap) {
        const ratio = clampNumber((gap - hardGap) / Math.max(1, comfortGap - hardGap), 0, 1);
        const followSpeed = frontSpeed * (0.78 + 0.18 * ratio);
        targetSpeed = Math.min(cruise, followSpeed + (compact ? 22 : 12) * ratio);
      } else if (compact && gap < chaseGap) {
        // Small vehicles may speed up to close the distance, then the previous
        // branches make them brake naturally when they approach the next car.
        const ratio = 1 - clampNumber((gap - comfortGap) / Math.max(1, chaseGap - comfortGap), 0, 1);
        targetSpeed = Math.min(maxSpeed, Math.max(cruise, cruise + (maxSpeed - cruise) * (0.42 + 0.46 * ratio)));
      } else if (!heavy && gap > chaseGap * 1.35) {
        targetSpeed = Math.min(maxSpeed, cruise * 1.04);
      }

      const acceleration = data.acceleration || (compact ? 112 : heavy ? 58 : 82);
      const brakePower = data.brakePower || (compact ? 168 : heavy ? 128 : 146);
      data.currentSpeed = clampNumber(
        approach(currentSpeed, targetSpeed, acceleration, brakePower, delta),
        rowIndex <= 24 ? (compact ? 102 : 82) : 32,
        maxSpeed
      );
    }

    laneItems.forEach((vehicle) => {
      const data = vehicle.userData || {};
      const width = data.width || maxVehicleWidth;
      vehicle.position.x += direction * (data.currentSpeed || data.baseSpeed || data.speed || 120) * delta;

      if (direction > 0 && vehicle.position.x > wrapMax + width * 0.5) {
        vehicle.position.x = wrapMin - width * 0.5;
      } else if (direction < 0 && vehicle.position.x < wrapMin - width * 0.5) {
        vehicle.position.x = wrapMax + width * 0.5;
      }
    });

    const settled = laneItems
      .map((vehicle) => ({
        vehicle,
        progress: laneProgress(vehicle, direction, wrapMin, wrapMax)
      }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = settled.length - 1; i >= 0; i -= 1) {
      const item = settled[i];
      const front = i === settled.length - 1 ? settled[0] : settled[i + 1];
      const data = item.vehicle.userData || {};
      const frontData = front.vehicle.userData || {};
      const frontProgress = front.progress + (i === settled.length - 1 ? span : 0);
      const minGap = Math.max(TRAFFIC_MIN_GAP, (data.width || 72) * 0.52, rowIndex <= 24 ? 82 : 62);
      const requiredProgress = frontProgress - ((data.width || 72) + (frontData.width || 72)) * 0.5 - minGap;
      if (item.progress > requiredProgress) {
        item.vehicle.position.x = direction > 0 ? wrapMin + requiredProgress : wrapMax - requiredProgress;
        data.currentSpeed = Math.min(
          data.currentSpeed || data.baseSpeed || 0,
          Math.max((frontData.currentSpeed || frontData.baseSpeed || 0) * 0.9, (data.baseSpeed || data.speed || 0) * 0.56)
        );
      }
    }
  };
}
