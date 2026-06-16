import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  TILE_SIZE,
  TRAFFIC_MIN_GAP,
  TRAIN_PALETTE,
  TRAIN_PROFILES,
  TRAIN_SAFE_MARGIN,
  VEHICLE_SAFE_MARGIN
} from './constants.js';

// Stage balance guard.
// Goal: keep desktop as light as mobile while restoring a livelier early/mid
// traffic flow and reintroducing high-speed trains from score 80+.
if (!RoadQuestGame.__ayamStageBalanceFixesAppliedV1) {
  RoadQuestGame.__ayamStageBalanceFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const originalApplyMobileQualityProfile = proto._applyMobileQualityProfile;
  const originalObserveFrameHealth = proto._observeMobileFrameHealth;
  const originalAddRowsAround = proto._addRowsAround;
  const originalAddRow = proto._addRow;
  const originalCapFxItemsForMobile = proto._capFxItemsForMobile;

  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
  const performanceRank = { normal: 0, pressure: 1, severe: 2 };

  const deterministicNoise = (rowIndex, salt = 0) => {
    const x = Math.sin((rowIndex + 1) * 97.17 + (salt + 5) * 41.39) * 43758.5453;
    return x - Math.floor(x);
  };

  const isDesktopGame = (game) => game.renderProfile?.name === 'desktop-premium';
  const isMobileGame = (game) => !isDesktopGame(game);
  const desktopMode = (game) => game.__ayamDesktopPerformanceMode || 'normal';
  const mobileMode = (game) => game.__ayamMobilePerformanceMode || 'normal';
  const deviceMode = (game) => (isDesktopGame(game) ? desktopMode(game) : mobileMode(game));

  const activeWindowFor = (game, centerRow = 0) => {
    const mode = deviceMode(game);

    // Desktop was previously allowed to keep a much larger active window than
    // phones. That makes score 80-100 laggy because row 96+ and row 100+ heavy
    // blocks are built too early. Keep desktop close to mobile budgets.
    if (centerRow >= 80) {
      if (mode === 'severe') return { forward: 9, backward: 5 };
      if (mode === 'pressure') return { forward: 11, backward: 6 };
      return { forward: 12, backward: 6 };
    }

    if (centerRow >= 38) {
      if (mode === 'severe') return { forward: 12, backward: 6 };
      if (mode === 'pressure') return { forward: 14, backward: 7 };
      return { forward: 16, backward: 8 };
    }

    if (mode === 'severe') return { forward: 16, backward: 6 };
    if (mode === 'pressure') return { forward: 18, backward: 7 };
    return { forward: 22, backward: 8 };
  };

  const applyDesktopLightQuality = (game) => {
    if (!isDesktopGame(game) || !game.renderer) return;

    const mode = desktopMode(game);
    const cap = mode === 'severe' ? 1.0 : mode === 'pressure' ? 1.08 : 1.15;
    game.renderProfile.maxPixelRatio = Math.min(game.renderProfile.maxPixelRatio || cap, cap);
    game.renderer.shadowMap.enabled = false;
    if (game.sunlight) game.sunlight.castShadow = false;
    game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  };

  const disposeFxItem = (game, item) => {
    game.fxGroup?.remove?.(item);
    item.geometry?.dispose?.();
    if (item.material && !item.material.__shared) item.material.dispose?.();
  };

  const capFxItemsForAllDevices = (game) => {
    if (!Array.isArray(game.fxItems)) return;
    const mode = deviceMode(game);
    const desktop = isDesktopGame(game);
    const limit = mode === 'severe'
      ? (desktop ? 56 : 42)
      : mode === 'pressure'
        ? (desktop ? 78 : 64)
        : (desktop ? 110 : 96);

    if (game.fxItems.length <= limit) return;
    const removed = game.fxItems.splice(0, game.fxItems.length - limit);
    removed.forEach((item) => disposeFxItem(game, item));
  };

  const observeDesktopFrameHealth = (game, rawDelta) => {
    if (!isDesktopGame(game)) return;

    const now = performance.now();
    const stats = game.__ayamDesktopFrameStats || {
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

    if (stats.samples < 75) {
      game.__ayamDesktopFrameStats = stats;
      return;
    }

    const avg = stats.sum / Math.max(1, stats.samples);
    const currentMode = desktopMode(game);
    let nextMode = 'normal';

    if (avg > 1 / 42 || stats.max > 0.06) nextMode = 'severe';
    else if (avg > 1 / 54 || stats.max > 0.042) nextMode = 'pressure';

    if (nextMode === 'normal') stats.goodWindows += 1;
    else stats.goodWindows = 0;

    const mayChange = now - stats.lastModeChange > 2400;
    const shouldDegrade = performanceRank[nextMode] > performanceRank[currentMode];
    const shouldRecover = performanceRank[nextMode] < performanceRank[currentMode] && stats.goodWindows >= 4;

    if (mayChange && (shouldDegrade || shouldRecover)) {
      game.__ayamDesktopPerformanceMode = nextMode;
      stats.lastModeChange = now;
      game._applyMobileQualityProfile?.();
      game._keepRuntimeWindowNearPlayer?.();
    }

    game.__ayamDesktopFrameStats = {
      samples: 0,
      sum: 0,
      max: 0,
      lastModeChange: stats.lastModeChange,
      goodWindows: stats.goodWindows
    };
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
    const mode = deviceMode(game);

    if (mode === 'severe') {
      if (rowIndex <= 18) return Math.min(currentCount, 2);
      return Math.min(currentCount, 2);
    }

    if (mode === 'pressure') {
      if (rowIndex <= 12) return Math.min(currentCount, 2);
      if (rowIndex <= 80) return Math.min(currentCount, 3);
      return Math.min(currentCount, 2);
    }

    // Restore some life in rows 0-60. Previous caps made the game feel too empty.
    // Late rows stay capped because 4-lane roads and bullet trains are expensive.
    if (rowIndex <= 12) return Math.min(currentCount, 2);
    if (rowIndex <= 60) return Math.min(currentCount, 3);
    if (rowIndex <= 95) return Math.min(currentCount, 3);
    return Math.min(currentCount, 2);
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

  const speedBandForRow = (rowIndex, data) => {
    const compact = isCompactVehicle(data);
    const heavy = isHeavyVehicle(data);
    const superVehicle = isSuperVehicle(data);

    if (superVehicle) {
      if (rowIndex < 80) return { min: 245, max: 395, variance: 54 };
      return { min: 305, max: 520, variance: 72 };
    }

    if (rowIndex <= 12) {
      return compact
        ? { min: 188, max: 258, variance: 34 }
        : heavy
          ? { min: 156, max: 220, variance: 28 }
          : { min: 172, max: 242, variance: 32 };
    }

    if (rowIndex <= 60) {
      return compact
        ? { min: 178, max: 270, variance: 44 }
        : heavy
          ? { min: 146, max: 232, variance: 34 }
          : { min: 164, max: 252, variance: 38 };
    }

    if (rowIndex <= 95) {
      return compact
        ? { min: 188, max: 312, variance: 50 }
        : heavy
          ? { min: 152, max: 248, variance: 36 }
          : { min: 174, max: 286, variance: 44 };
    }

    return compact
      ? { min: 198, max: 330, variance: 52 }
      : heavy
        ? { min: 154, max: 252, variance: 36 }
        : { min: 176, max: 296, variance: 44 };
  };

  const removeVehicle = (game, vehicle) => {
    vehicle?.traverse?.((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material.__shared) material.dispose?.();
      });
    });
    game.vehicleGroup?.remove?.(vehicle);
  };

  proto._normalizeTrafficLaneForPlayability = function normalizeTrafficLaneForBalancedStage(rowIndex, items = []) {
    if (!Array.isArray(items) || !items.length) return items;

    const desiredCount = targetTrafficCount(rowIndex, items.length, this);
    let laneItems = items;

    if (desiredCount < items.length) {
      const selected = new Set(selectEvenlySpacedVehicles(items, desiredCount));
      const removed = new Set(items.filter((vehicle) => !selected.has(vehicle)));
      removed.forEach((vehicle) => removeVehicle(this, vehicle));
      this.vehicles = this.vehicles.filter((vehicle) => !removed.has(vehicle));
      laneItems = items.filter((vehicle) => selected.has(vehicle));
      this.trafficRows.set(rowIndex, laneItems);
    }

    laneItems.forEach((vehicle, index) => {
      const data = vehicle.userData || {};
      if (data.playabilityProfileAppliedV7) return;

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
      data.maxSpeed = targetBase * (superVehicle ? 1.25 : compact ? 1.18 : heavy ? 1.07 : 1.13);
      data.acceleration = Math.max(data.acceleration || 0, superVehicle ? 140 : compact ? 112 : heavy ? 60 : 86);
      data.brakePower = Math.max(data.brakePower || 0, superVehicle ? 190 : compact ? 164 : heavy ? 128 : 146);
      data.currentSpeed = clampNumber(data.currentSpeed || targetBase, targetBase * 0.94, data.maxSpeed);
      data.minFollowGap = Math.max(
        data.minFollowGap || TRAFFIC_MIN_GAP,
        data.width * (compact || superVehicle ? 0.48 : heavy ? 0.6 : 0.54),
        rowIndex <= 12 ? 88 : rowIndex <= 60 ? 78 : 70
      );
      data.playabilityProfileAppliedV7 = true;
    });

    return laneItems;
  };

  const trainProfileFor = (trainClass) => TRAIN_PROFILES.find((profile) => profile.trainClass === trainClass) || TRAIN_PROFILES[0];

  const trainWidth = (profile, carriageCount, carriageWidth) => {
    const tenderWidth = profile.tenderWidth || 0;
    const couplerGap = profile.trainClass === 'bullet' ? 4 : 6;
    return profile.locomotiveWidth + tenderWidth + carriageCount * carriageWidth + (carriageCount + (tenderWidth ? 1 : 0)) * couplerGap + 24;
  };

  const trainColor = (rowIndex, salt = 0) => TRAIN_PALETTE[Math.floor(deterministicNoise(rowIndex, salt) * TRAIN_PALETTE.length) % TRAIN_PALETTE.length];

  const makeBalancedRailRow = (rowIndex, sourceRow = null, forceClass = null) => {
    const forcedBullet = forceClass === 'bullet' || (rowIndex >= 80 && (forceClass || deterministicNoise(rowIndex, 9) > 0.28));
    const trainClass = forcedBullet
      ? 'bullet'
      : rowIndex >= 55 && deterministicNoise(rowIndex, 10) > 0.52
        ? 'electric'
        : deterministicNoise(rowIndex, 11) > 0.5
          ? 'freight'
          : 'classic';
    const profile = trainProfileFor(trainClass);
    const bullet = trainClass === 'bullet';
    const carriageCount = bullet
      ? (deterministicNoise(rowIndex, 12) > 0.64 ? 5 : 4)
      : Math.min(profile.carriageCountMax, profile.carriageCountMin + (deterministicNoise(rowIndex, 13) > 0.58 ? 1 : 0));
    const carriageWidth = Math.round(profile.carriageWidthMin + deterministicNoise(rowIndex, 14) * (profile.carriageWidthMax - profile.carriageWidthMin));
    const width = trainWidth(profile, carriageCount, carriageWidth);
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + TRAIN_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - TRAIN_SAFE_MARGIN;
    const trackCount = sourceRow?.railTrackCount || 1;
    const trackIndex = sourceRow?.railTrackIndex || 0;
    const reversed = sourceRow?.railReversed ?? deterministicNoise(rowIndex, 15) > 0.5;
    const direction = sourceRow?.direction ?? (trackCount > 1
      ? (trackIndex % 2 === 0 ? 1 : -1) * (reversed ? -1 : 1)
      : (deterministicNoise(rowIndex, 16) > 0.5 ? 1 : -1));
    const laneOffset = sourceRow?.laneOffset ?? (trackCount > 1 ? (trackIndex === 0 ? -5 : 5) : (deterministicNoise(rowIndex, 17) - 0.5) * 4);
    const baseSpeed = bullet
      ? 820 + deterministicNoise(rowIndex, 18) * 260
      : profile.speedMin + deterministicNoise(rowIndex, 19) * (profile.speedMax - profile.speedMin);

    return {
      index: rowIndex,
      type: 'rail',
      direction,
      speed: baseSpeed,
      laneOffset,
      railTrackCount: trackCount,
      railTrackIndex: trackIndex,
      railBandId: sourceRow?.railBandId ?? rowIndex,
      railReversed: reversed,
      trains: [{
        id: `${rowIndex}-balanced-train-0`,
        type: 'train',
        kind: 'train',
        trainClass,
        x: minX + deterministicNoise(rowIndex, 20) * span,
        width,
        depth: profile.depth,
        locomotiveWidth: profile.locomotiveWidth,
        tenderWidth: profile.tenderWidth || 0,
        carriageWidth,
        carriageCount,
        color: trainColor(rowIndex, 21),
        trimColor: deterministicNoise(rowIndex, 22) > 0.5 ? 0xc7ced6 : 0x394552
      }],
      blockers: new Set()
    };
  };

  const shouldForceRailPreview = (rowIndex) => {
    if (rowIndex < 30) return false;
    if (rowIndex >= 80) return rowIndex % 9 === 3; // 84, 93, 102, 111, ...
    return rowIndex % 17 === 0; // 34, 51, 68: restore mid-game train presence.
  };

  const prepareRowForStageBalance = (row, forceRail = false) => {
    if (!row) return row;
    if (forceRail) return makeBalancedRailRow(row.index, row, row.index >= 80 ? 'bullet' : null);
    if (row.type === 'rail' && row.index >= 80) return makeBalancedRailRow(row.index, row, deterministicNoise(row.index, 30) > 0.25 ? 'bullet' : null);
    return row;
  };

  const ensureStageRailRows = (game, centerRow, forwardRows, backwardRows) => {
    if (!Array.isArray(game.rows)) return;
    const minRow = Math.max(0, centerRow - backwardRows);
    const maxRow = centerRow + forwardRows;

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      if (rowIndex <= centerRow + 3) continue;
      if (game.rowGroups?.has?.(rowIndex)) continue;
      const row = game.rows[rowIndex];
      if (!row) continue;
      if (row.type === 'water') continue;
      if (!shouldForceRailPreview(rowIndex)) continue;
      game.rows[rowIndex] = makeBalancedRailRow(rowIndex, row, rowIndex >= 80 ? 'bullet' : null);
    }
  };

  proto._applyMobileQualityProfile = function applyAllDeviceQualityProfile() {
    originalApplyMobileQualityProfile?.call(this);
    applyDesktopLightQuality(this);
  };

  proto._observeMobileFrameHealth = function observeAllDeviceFrameHealth(rawDelta) {
    originalObserveFrameHealth?.call(this, rawDelta);
    observeDesktopFrameHealth(this, rawDelta);
  };

  proto._capFxItemsForMobile = function capFxItemsForAllDevices() {
    originalCapFxItemsForMobile?.call(this);
    capFxItemsForAllDevices(this);
  };

  proto._addRowsAround = function addRowsAroundWithStageBalance(centerRow, forwardRows = 24, backwardRows = 24) {
    const row = centerRow || 0;
    const { forward, backward } = activeWindowFor(this, row);
    const cappedForward = Math.min(forwardRows, forward);
    const cappedBackward = Math.min(backwardRows, backward);
    ensureStageRailRows(this, row, cappedForward, cappedBackward);
    return originalAddRowsAround.call(this, row, cappedForward, cappedBackward);
  };

  proto._addRow = function addRowWithStageBalance(row) {
    return originalAddRow.call(this, prepareRowForStageBalance(row));
  };

  proto._limitRailRowForPerformance = function limitRailRowForBalancedPerformance(rowIndex) {
    const trains = this.vehicles.filter((vehicle) => vehicle.userData?.type === 'train' && vehicle.userData?.rowIndex === rowIndex);
    const maxTrains = 1;
    if (trains.length <= maxTrains) return;

    const keep = new Set(trains.slice(0, maxTrains));
    trains.forEach((train) => {
      if (keep.has(train)) return;
      removeVehicle(this, train);
    });
    this.vehicles = this.vehicles.filter((vehicle) => vehicle.userData?.rowIndex !== rowIndex || vehicle.userData?.type !== 'train' || keep.has(vehicle));
  };

  proto._keepRuntimeWindowNearPlayer = function keepRuntimeWindowNearPlayerBalanced() {
    const row = this.playerPosition?.row || 0;
    const { forward, backward } = activeWindowFor(this, row);
    ensureStageRailRows(this, row, forward, backward);
    this._normalizeVisibleTrafficLanes?.();
    this._trimSimulationWindow?.(row, forward, backward);
    this._capFxItemsForMobile?.();
  };
}
