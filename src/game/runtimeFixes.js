import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  TILE_SIZE,
  TRAFFIC_MIN_GAP,
  VEHICLE_SAFE_MARGIN
} from './constants.js';

// Runtime engine guard for mobile playability regressions.
// Keep this file deterministic: it patches simulation load, traffic density,
// and traffic following without touching UI state, audio, or quiz flow.
if (!RoadQuestGame.__ayamRuntimeFixesAppliedV4) {
  RoadQuestGame.__ayamRuntimeFixesAppliedV4 = true;

  const proto = RoadQuestGame.prototype;
  const originalSetupLights = proto._setupLights;
  const originalReset = proto.reset;
  const originalLoadSaveState = proto.loadSaveState;
  const originalAddRow = proto._addRow;
  const originalAddRowsAround = proto._addRowsAround;
  const originalCompleteMove = proto._completeMove;

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
  const disposeDynamicMaterials = (object) => {
    object?.traverse?.((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material.__shared) material.dispose?.();
      });
    });
  };
  const removeMovingItem = (game, item) => {
    disposeDynamicMaterials(item);
    game.vehicleGroup.remove(item);
  };
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
  const isSuperVehicle = (data = {}) => /super|sport/.test(String(data.kind || '').toLowerCase());
  const targetTrafficCount = (rowIndex, currentCount) => {
    if (rowIndex <= 12) return Math.min(currentCount, 1);
    if (rowIndex <= 24) return Math.min(currentCount, 2);
    if (rowIndex <= 80) return Math.min(currentCount, 3);
    return Math.min(currentCount, 4);
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
  const speedBandForRow = (rowIndex, data) => {
    const compact = isCompactVehicle(data);
    const heavy = isHeavyVehicle(data);
    const superVehicle = isSuperVehicle(data);

    if (superVehicle) {
      if (rowIndex <= 80) return { min: 245, max: 390, variance: 52 };
      return { min: 275, max: 470, variance: 68 };
    }
    if (rowIndex <= 12) {
      return compact
        ? { min: 190, max: 252, variance: 34 }
        : heavy
          ? { min: 158, max: 218, variance: 28 }
          : { min: 174, max: 236, variance: 32 };
    }
    if (rowIndex <= 40) {
      return compact
        ? { min: 176, max: 252, variance: 38 }
        : heavy
          ? { min: 146, max: 218, variance: 30 }
          : { min: 162, max: 238, variance: 34 };
    }
    if (rowIndex <= 80) {
      return compact
        ? { min: 184, max: 286, variance: 46 }
        : heavy
          ? { min: 152, max: 242, variance: 34 }
          : { min: 168, max: 266, variance: 40 };
    }
    return compact
      ? { min: 198, max: 330, variance: 54 }
      : heavy
        ? { min: 164, max: 268, variance: 38 }
        : { min: 182, max: 308, variance: 48 };
  };
  const activeWindowFor = (game, centerRow = 0) => {
    const mobileLike = game.renderProfile?.name !== 'desktop-premium';
    if (mobileLike) {
      return centerRow >= 38
        ? { forward: 20, backward: 10 }
        : { forward: 22, backward: 8 };
    }
    return centerRow >= 38
      ? { forward: 28, backward: 14 }
      : { forward: 32, backward: 14 };
  };

  proto._trimSimulationWindow = function trimSimulationWindow(centerRow = 0, forwardRows = 20, backwardRows = 10) {
    const minRow = Math.max(0, centerRow - backwardRows);
    const maxRow = centerRow + forwardRows;

    for (const [rowIndex, rowGroup] of Array.from(this.rowGroups.entries())) {
      if (rowIndex >= minRow && rowIndex <= maxRow) continue;
      disposeDynamicMaterials(rowGroup);
      this.worldGroup.remove(rowGroup);
      this.rowGroups.delete(rowIndex);
      this.waterFlowRows.delete(rowIndex);
    }

    const keepMovingItem = (item) => {
      const rowIndex = item.userData?.rowIndex ?? 0;
      if (rowIndex >= minRow && rowIndex <= maxRow) return true;
      removeMovingItem(this, item);
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

  proto._keepRuntimeWindowNearPlayer = function keepRuntimeWindowNearPlayer() {
    const row = this.playerPosition?.row || 0;
    const { forward, backward } = activeWindowFor(this, row);
    this._normalizeVisibleTrafficLanes();
    this._trimSimulationWindow(row, forward, backward);
  };

  proto._normalizeTrafficLaneForPlayability = function normalizeTrafficLaneForPlayability(rowIndex, items) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const desiredCount = targetTrafficCount(rowIndex, items.length);
    let laneItems = items;

    if (desiredCount < items.length) {
      const selected = new Set(selectEvenlySpacedVehicles(items, desiredCount));
      const removed = new Set(items.filter((vehicle) => !selected.has(vehicle)));
      removed.forEach((vehicle) => removeMovingItem(this, vehicle));
      this.vehicles = this.vehicles.filter((vehicle) => !removed.has(vehicle));
      laneItems = items.filter((vehicle) => selected.has(vehicle));
      this.trafficRows.set(rowIndex, laneItems);
    }

    laneItems.forEach((vehicle, index) => {
      const data = vehicle.userData || {};
      if (data.playabilityProfileAppliedV4) return;

      const compact = isCompactVehicle(data);
      const heavy = isHeavyVehicle(data);
      const superVehicle = isSuperVehicle(data);
      const originalBase = data.baseSpeed || data.speed || 140;
      const band = speedBandForRow(rowIndex, data);
      const highCap = Math.max(band.max, originalBase * (superVehicle ? 1.04 : 1.02));
      const targetBase = clampNumber(
        Math.max(originalBase, band.min) + (deterministicNoise(rowIndex, index) - 0.5) * band.variance,
        band.min,
        highCap
      );

      data.speed = targetBase;
      data.baseSpeed = targetBase;
      data.cruiseSpeed = targetBase * (0.94 + deterministicNoise(rowIndex, index + 11) * 0.14);
      data.maxSpeed = targetBase * (superVehicle ? 1.26 : compact ? 1.2 : heavy ? 1.08 : 1.14);
      data.acceleration = Math.max(data.acceleration || 0, superVehicle ? 140 : compact ? 116 : heavy ? 62 : 88);
      data.brakePower = Math.max(data.brakePower || 0, superVehicle ? 190 : compact ? 168 : heavy ? 132 : 150);
      data.currentSpeed = clampNumber(data.currentSpeed || targetBase, targetBase * 0.94, data.maxSpeed);
      data.minFollowGap = Math.max(
        data.minFollowGap || TRAFFIC_MIN_GAP,
        data.width * (compact || superVehicle ? 0.48 : heavy ? 0.6 : 0.54),
        rowIndex <= 12 ? 92 : rowIndex <= 40 ? 84 : 76
      );
      data.playabilityProfileAppliedV4 = true;
    });

    return laneItems;
  };

  proto._limitRailRowForPerformance = function limitRailRowForPerformance(rowIndex) {
    const trains = this.vehicles.filter((vehicle) => vehicle.userData?.type === 'train' && vehicle.userData?.rowIndex === rowIndex);
    const maxTrains = this.renderProfile?.name === 'desktop-premium' && rowIndex >= 100 ? 2 : 1;
    if (trains.length <= maxTrains) return;

    const keep = new Set(trains.slice(0, maxTrains));
    trains.forEach((train) => {
      if (keep.has(train)) return;
      removeMovingItem(this, train);
    });
    this.vehicles = this.vehicles.filter((vehicle) => vehicle.userData?.rowIndex !== rowIndex || vehicle.userData?.type !== 'train' || keep.has(vehicle));
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

  proto._addRowsAround = function addRowsAroundWithBoundedRuntimeWindow(centerRow, forwardRows = 24, backwardRows = 24) {
    const { forward, backward } = activeWindowFor(this, centerRow || 0);
    return originalAddRowsAround.call(
      this,
      centerRow,
      Math.min(forwardRows, forward),
      Math.min(backwardRows, backward)
    );
  };

  proto._addRow = function addRowWithTrafficNormalization(row) {
    originalAddRow.call(this, row);
    if (row?.type === 'traffic') {
      const items = this.trafficRows.get(row.index);
      this._normalizeTrafficLaneForPlayability(row.index, items);
    } else if (row?.type === 'rail') {
      this._limitRailRowForPerformance(row.index);
    }
  };

  proto.reset = function resetWithLightOpeningScene(startImmediately = false) {
    originalReset.call(this, startImmediately);
    this._keepRuntimeWindowNearPlayer();
  };

  proto.loadSaveState = function loadSaveStateWithTrim(state, startImmediately = true) {
    const result = originalLoadSaveState.call(this, state, startImmediately);
    this._keepRuntimeWindowNearPlayer();
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

    this._keepRuntimeWindowNearPlayer();
    this._clearSpawnAroundPlayer?.(2, 220);
    this.clock.getDelta();
    this._ensureAnimationLoop();
  };

  proto._completeMove = function completeMoveWithRuntimeTrim() {
    originalCompleteMove.call(this);
    if (!this.isDestroyed) this._keepRuntimeWindowNearPlayer();
  };

  proto._animate = function animate() {
    this.renderRequested = null;
    if (this.isDestroyed || this.isRuntimeSuspended) return;
    // Do not cap at 0.035. When mobile FPS briefly drops below ~28 FPS, that cap
    // makes every obstacle look globally slower, including trains. A 0.05 cap
    // preserves perceived speed while still preventing huge background-tab jumps.
    const delta = Math.min(this.clock.getDelta(), 0.05);

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

    const moveTrafficVehicle = (vehicle) => {
      const data = vehicle.userData || {};
      const width = data.width || maxVehicleWidth;
      vehicle.position.x += direction * (data.currentSpeed || data.baseSpeed || data.speed || 120) * delta;

      if (direction > 0 && vehicle.position.x > wrapMax + width * 0.5) {
        vehicle.position.x = wrapMin - width * 0.5;
      } else if (direction < 0 && vehicle.position.x < wrapMin - width * 0.5) {
        vehicle.position.x = wrapMax + width * 0.5;
      }
    };

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
      moveTrafficVehicle(laneItems[0]);
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
      const superVehicle = isSuperVehicle(data);
      const currentSpeed = data.currentSpeed || data.baseSpeed || data.speed || 120;
      const frontSpeed = frontData.currentSpeed || frontData.baseSpeed || frontData.speed || currentSpeed;
      const base = data.baseSpeed || data.speed || currentSpeed;
      const cruise = data.cruiseSpeed || base;
      const maxSpeed = data.maxSpeed || base * (compact || superVehicle ? 1.2 : 1.1);
      const hardGap = Math.max(data.minFollowGap || TRAFFIC_MIN_GAP, (data.width || 72) * 0.55, rowIndex <= 24 ? 86 : 68);
      const comfortGap = hardGap + (rowIndex <= 24 ? 78 : 96) + currentSpeed * (compact || superVehicle ? 0.075 : 0.105);
      const chaseGap = comfortGap + (compact || superVehicle ? 190 : 84);
      let targetSpeed = cruise;

      if (gap < hardGap) {
        // Real braking only when the front vehicle is already too close.
        const emergencyFloor = rowIndex <= 24
          ? (compact || superVehicle ? 118 : 92)
          : (compact || superVehicle ? 98 : heavy ? 76 : 86);
        targetSpeed = Math.max(emergencyFloor, Math.min(cruise, frontSpeed * (compact || superVehicle ? 0.7 : 0.64)));
      } else if (gap < comfortGap) {
        const ratio = clampNumber((gap - hardGap) / Math.max(1, comfortGap - hardGap), 0, 1);
        const followSpeed = frontSpeed * (0.8 + 0.17 * ratio);
        targetSpeed = Math.min(cruise, followSpeed + (compact || superVehicle ? 24 : 13) * ratio);
      } else if ((compact || superVehicle) && gap < chaseGap) {
        // Small vehicles may speed up to close the distance, then the previous
        // branches make them brake naturally when they approach the next car.
        const ratio = 1 - clampNumber((gap - comfortGap) / Math.max(1, chaseGap - comfortGap), 0, 1);
        targetSpeed = Math.min(maxSpeed, Math.max(cruise, cruise + (maxSpeed - cruise) * (0.42 + 0.46 * ratio)));
      } else if (!heavy && gap > chaseGap * 1.35) {
        targetSpeed = Math.min(maxSpeed, cruise * 1.04);
      }

      const acceleration = data.acceleration || (compact || superVehicle ? 112 : heavy ? 58 : 82);
      const brakePower = data.brakePower || (compact || superVehicle ? 168 : heavy ? 128 : 146);
      const minOperationalSpeed = rowIndex <= 24
        ? (compact || superVehicle ? 102 : 82)
        : (compact || superVehicle ? 88 : heavy ? 72 : 80);
      data.currentSpeed = clampNumber(
        approach(currentSpeed, targetSpeed, acceleration, brakePower, delta),
        minOperationalSpeed,
        maxSpeed
      );
    }

    laneItems.forEach(moveTrafficVehicle);

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
        const base = data.baseSpeed || data.speed || 0;
        const floor = rowIndex <= 24 ? base * 0.56 : Math.max(base * 0.66, isCompactVehicle(data) || isSuperVehicle(data) ? 88 : 72);
        data.currentSpeed = Math.min(
          data.currentSpeed || base,
          Math.max((frontData.currentSpeed || frontData.baseSpeed || 0) * 0.9, floor)
        );
      }
    }
  };
}
