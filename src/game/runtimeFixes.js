import { RoadQuestGame } from './RoadQuestGame.js';
import { createInitialRows } from './world.js';
import { createFoundation, createPlayer } from './renderers.js';
import {
  MAX_TILE,
  MIN_TILE,
  PREGENERATE_ROWS,
  TILE_SIZE,
  TRAFFIC_MIN_GAP,
  VEHICLE_SAFE_MARGIN
} from './constants.js';

// Runtime engine guard for mobile playability regressions.
// The game must stay light on real phones: bounded active rows, capped pixel
// ratio, no mobile shadows, controlled traffic density, and adaptive degradation
// when a device starts missing frames.
if (!RoadQuestGame.__ayamRuntimeFixesAppliedV5) {
  RoadQuestGame.__ayamRuntimeFixesAppliedV5 = true;

  const proto = RoadQuestGame.prototype;
  const originalSetupLights = proto._setupLights;
  const originalLoadSaveState = proto.loadSaveState;
  const originalAddRow = proto._addRow;
  const originalAddRowsAround = proto._addRowsAround;
  const originalCompleteMove = proto._completeMove;
  const originalResize = proto._resize;

  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
  const performanceRank = { normal: 0, pressure: 1, severe: 2 };

  const deterministicNoise = (rowIndex, index) => {
    const x = Math.sin((rowIndex + 1) * 91.73 + (index + 3) * 37.19) * 43758.5453;
    return x - Math.floor(x);
  };

  const isMobileGame = (game) => game.renderProfile?.name !== 'desktop-premium';

  const performanceMode = (game) => {
    if (!isMobileGame(game)) return 'normal';
    return game.__ayamMobilePerformanceMode || 'normal';
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

  const disposeFxGeometries = (object) => {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
    });
  };

  const removeMovingItem = (game, item) => {
    disposeDynamicMaterials(item);
    game.vehicleGroup.remove(item);
  };

  const removeFxItem = (game, item) => {
    game.fxGroup.remove(item);
    item.geometry?.dispose?.();
    if (item.material && !item.material.__shared) item.material.dispose?.();
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

  const targetTrafficCount = (rowIndex, currentCount, game) => {
    const mode = performanceMode(game);
    if (mode === 'severe') {
      if (rowIndex <= 24) return Math.min(currentCount, 1);
      if (rowIndex <= 120) return Math.min(currentCount, 2);
      return Math.min(currentCount, 3);
    }
    if (mode === 'pressure') {
      if (rowIndex <= 18) return Math.min(currentCount, 1);
      if (rowIndex <= 80) return Math.min(currentCount, 2);
      return Math.min(currentCount, 3);
    }

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
    const mode = performanceMode(game);

    if (isMobileGame(game)) {
      if (mode === 'severe') {
        return centerRow >= 38
          ? { forward: 14, backward: 6 }
          : { forward: 16, backward: 6 };
      }
      if (mode === 'pressure') {
        return centerRow >= 38
          ? { forward: 17, backward: 7 }
          : { forward: 19, backward: 7 };
      }
      return centerRow >= 38
        ? { forward: 20, backward: 10 }
        : { forward: 22, backward: 8 };
    }

    return centerRow >= 38
      ? { forward: 28, backward: 14 }
      : { forward: 32, backward: 14 };
  };

  const pixelRatioCapFor = (game) => {
    if (!isMobileGame(game)) return game.renderProfile?.maxPixelRatio || 1.75;

    const mode = performanceMode(game);
    if (mode === 'severe') return 0.9;
    if (mode === 'pressure') return 1.0;
    return game.renderProfile?.name === 'mobile-light' ? 1.0 : 1.15;
  };

  proto._applyMobileQualityProfile = function applyMobileQualityProfile() {
    if (!isMobileGame(this)) return;

    const cap = pixelRatioCapFor(this);
    this.renderProfile.maxPixelRatio = Math.min(this.renderProfile.maxPixelRatio || cap, cap);
    this.renderer.shadowMap.enabled = false;
    if (this.sunlight) this.sunlight.castShadow = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  };

  proto._observeMobileFrameHealth = function observeMobileFrameHealth(rawDelta) {
    if (!isMobileGame(this)) return;

    const now = performance.now();
    const stats = this.__ayamFrameStats || {
      samples: 0,
      sum: 0,
      max: 0,
      lastModeChange: now,
      goodWindows: 0
    };

    const observedDelta = clampNumber(rawDelta, 0, 0.09);
    stats.samples += 1;
    stats.sum += observedDelta;
    stats.max = Math.max(stats.max, observedDelta);

    if (stats.samples < 90) {
      this.__ayamFrameStats = stats;
      return;
    }

    const avg = stats.sum / Math.max(1, stats.samples);
    const currentMode = performanceMode(this);
    let nextMode = 'normal';

    // Keep at least ~45-50 FPS on phones. Once the average frame goes beyond
    // that budget, reduce simulation density and render resolution automatically.
    if (avg > 1 / 38 || stats.max > 0.07) nextMode = 'severe';
    else if (avg > 1 / 50 || stats.max > 0.047) nextMode = 'pressure';

    if (nextMode === 'normal') stats.goodWindows += 1;
    else stats.goodWindows = 0;

    const mayChange = now - stats.lastModeChange > 2600;
    const shouldDegrade = performanceRank[nextMode] > performanceRank[currentMode];
    const shouldRecover = performanceRank[nextMode] < performanceRank[currentMode] && stats.goodWindows >= 4;

    if (mayChange && (shouldDegrade || shouldRecover)) {
      this.__ayamMobilePerformanceMode = nextMode;
      stats.lastModeChange = now;
      this._applyMobileQualityProfile();
      originalResize.call(this);
      this._keepRuntimeWindowNearPlayer();
    }

    this.__ayamFrameStats = {
      samples: 0,
      sum: 0,
      max: 0,
      lastModeChange: stats.lastModeChange,
      goodWindows: stats.goodWindows
    };
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

  proto._capFxItemsForMobile = function capFxItemsForMobile() {
    if (!isMobileGame(this) || !Array.isArray(this.fxItems)) return;
    const mode = performanceMode(this);
    const limit = mode === 'severe' ? 42 : mode === 'pressure' ? 64 : 96;
    if (this.fxItems.length <= limit) return;

    const removed = this.fxItems.splice(0, this.fxItems.length - limit);
    removed.forEach((item) => removeFxItem(this, item));
  };

  proto._keepRuntimeWindowNearPlayer = function keepRuntimeWindowNearPlayer() {
    const row = this.playerPosition?.row || 0;
    const { forward, backward } = activeWindowFor(this, row);
    this._normalizeVisibleTrafficLanes();
    this._trimSimulationWindow(row, forward, backward);
    this._capFxItemsForMobile();
  };

  proto._normalizeTrafficLaneForPlayability = function normalizeTrafficLaneForPlayability(rowIndex, items) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const desiredCount = targetTrafficCount(rowIndex, items.length, this);
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
      if (data.playabilityProfileAppliedV5) return;

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
      data.playabilityProfileAppliedV5 = true;
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
    this._applyMobileQualityProfile();
  };

  proto._resize = function resizeWithAdaptivePixelRatio() {
    this._applyMobileQualityProfile();
    originalResize.call(this);
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
    this.restartPrepared = false;
    this.isPlaying = Boolean(startImmediately);
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.isGameOver = false;
    this.isImpacting = false;
    this.impactStartedAt = 0;
    this.impactVector.set(0, 0);
    this.cheatRespawnPending = false;
    this.cheatRespawnPosition = null;
    this.invulnerableUntil = 0;
    this.waterGraceUntil = 0;
    this.pendingWaterMissUntil = 0;
    this.moveQueue = [];
    this.movement = null;
    this.playerPosition = { row: 0, tile: 0 };
    this.highestRow = 0;
    this.score = 0;
    this.lastMilestone = 0;
    this.lastNearMissAt = 0;
    this.runStartingHighScore = this.highScore;
    this.newRecordThisRun = false;
    this.newRecordScore = 0;
    this.activeRidePlankId = null;
    this.minPlayableRow = 0;
    this.prunedRowDataBefore = 0;

    disposeDynamicMaterials(this.worldGroup);
    disposeDynamicMaterials(this.vehicleGroup);
    disposeDynamicMaterials(this.fxGroup);
    disposeFxGeometries(this.fxGroup);
    this.worldGroup.clear();
    this.vehicleGroup.clear();
    this.fxGroup.clear();
    this.vehicles = [];
    this.planks = [];
    this.fxItems = [];
    this.trafficRows.clear();
    this.waterRows.clear();
    this.waterFlowRows.clear();
    this.waterFlowItems = [];
    this.rowGroups.clear();

    if (this.player) {
      this.scene.remove(this.player);
      this.player = null;
    }

    this._applyMobileQualityProfile();
    this.rows = createInitialRows(PREGENERATE_ROWS);
    this.foundation = createFoundation(this.geometries, this.materials);
    this.worldGroup.add(this.foundation);

    const { forward } = activeWindowFor(this, 0);
    this._addRowsAround(0, forward, 0);

    this.player = createPlayer(this.geometries, this.materials);
    this.scene.add(this.player);
    this._setPlayerWorldPosition(0, 0);
    this._updateCamera(true);
    this.callbacks.onScore(0);
  };

  proto.loadSaveState = function loadSaveStateWithTrim(state, startImmediately = true) {
    const result = originalLoadSaveState.call(this, state, startImmediately);
    this._applyMobileQualityProfile();
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

    this._applyMobileQualityProfile();
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

    const rawDelta = this.clock.getDelta();
    this._observeMobileFrameHealth(rawDelta);

    // Avoid global slow-motion on temporary drops while still preventing huge
    // background-tab jumps. Severe mode receives a slightly wider cap to keep
    // vehicle speed honest when the browser misses frames.
    const mode = performanceMode(this);
    const deltaCap = mode === 'severe' ? 0.06 : 0.05;
    const delta = Math.min(rawDelta, deltaCap);

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

    this.__ayamFrameIndex = (this.__ayamFrameIndex || 0) + 1;
    const flowEvery = mode === 'severe' ? 3 : mode === 'pressure' ? 2 : 1;
    if (this.__ayamFrameIndex % flowEvery === 0) this._updateWaterFlow(delta * flowEvery);

    this._updateFx(delta);
    this._capFxItemsForMobile();
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
        const emergencyFloor = rowIndex <= 24
          ? (compact || superVehicle ? 118 : 92)
          : (compact || superVehicle ? 98 : heavy ? 76 : 86);
        targetSpeed = Math.max(emergencyFloor, Math.min(cruise, frontSpeed * (compact || superVehicle ? 0.7 : 0.64)));
      } else if (gap < comfortGap) {
        const ratio = clampNumber((gap - hardGap) / Math.max(1, comfortGap - hardGap), 0, 1);
        const followSpeed = frontSpeed * (0.8 + 0.17 * ratio);
        targetSpeed = Math.min(cruise, followSpeed + (compact || superVehicle ? 24 : 13) * ratio);
      } else if ((compact || superVehicle) && gap < chaseGap) {
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
