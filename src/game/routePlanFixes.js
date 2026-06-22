import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  PLANK_PALETTE,
  TILE_SIZE,
  TRAFFIC_MIN_GAP,
  TRAIN_PALETTE,
  TRAIN_PROFILES,
  TRAIN_SAFE_MARGIN,
  VEHICLE_PALETTE,
  VEHICLE_SAFE_MARGIN,
  VEHICLE_VARIANTS,
  WATER_SAFE_MARGIN
} from './constants.js';
import { createPlank, createRowGroup, createTrain, createVehicle } from './renderers.js';

// Authoritative deterministic route planner.
//
// Previous playability patches were added as separate guards: stage balance,
// train visibility, and mid-stage readability. Each guard could still rewrite a
// future row independently, so roads, rail rows, and safe grass could feel
// inconsistent. This planner is the final source of truth for route structure:
// safe tree grass -> road block -> safe tree grass -> river/rail/etc. Density,
// speed, and aggression grow per cycle, but the macro route stays readable.
if (!RoadQuestGame.__ayamRoutePlanFixesAppliedV1) {
  RoadQuestGame.__ayamRoutePlanFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const originalAddRow = proto._addRow;
  const originalCanMoveTo = proto._canMoveTo;

  const ROUTE_START_ROW = 4;
  const ROUTE_PLAN = Object.freeze([
    { kind: 'grass' },
    { kind: 'road', lanes: 2 },
    { kind: 'grass' },
    { kind: 'water' },
    { kind: 'grass' },
    { kind: 'rail', trainClass: 'classic', tracks: 1 },
    { kind: 'grass' },
    { kind: 'road', lanes: 4 },
    { kind: 'grass' },
    { kind: 'rail', trainClass: 'bullet', tracks: 1 },
    { kind: 'grass' },
    { kind: 'water' },
    { kind: 'grass' },
    { kind: 'road', lanes: 4 },
    { kind: 'grass' },
    { kind: 'rail', trainClass: 'bullet', tracks: 2 },
    { kind: 'grass' },
    { kind: 'road', lanes: 4 },
    { kind: 'grass' },
    { kind: 'water' },
    { kind: 'rail', trainClass: 'electric', tracks: 2 },
    { kind: 'rail', trainClass: 'bullet', tracks: 2 },
    { kind: 'grass' },
    { kind: 'road', lanes: 4 },
    { kind: 'grass' }
  ]);

  const EDGE_TREE_PATTERNS = Object.freeze([
    [-8, -6, 6, 8],
    [-7, -5, 5, 7],
    [-8, -4, 6],
    [-6, -5, 7, 8],
    [-8, -7, 4, 7],
    [-7, 5, 6, 8]
  ]);

  const ROAD_2L_VEHICLES = Object.freeze(['sedan', 'hatchback', 'taxi', 'pickup', 'van', 'boxTruck']);
  const ROAD_4L_VEHICLES = Object.freeze(['sedan', 'hatchback', 'wagon', 'taxi', 'pickup', 'van', 'bus', 'boxTruck', 'dumpTruck', 'sports', 'police', 'ambulance', 'supercar']);

  const deterministicNoise = (rowIndex, salt = 0) => {
    const x = Math.sin((rowIndex + 1) * 113.37 + (salt + 17) * 53.91) * 43758.5453;
    return x - Math.floor(x);
  };

  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
  const pick = (list, rowIndex, salt = 0) => list[Math.floor(deterministicNoise(rowIndex, salt) * list.length) % list.length];
  const variantByKind = (kind) => VEHICLE_VARIANTS.find((variant) => variant.kind === kind);
  const trainProfileFor = (trainClass) => TRAIN_PROFILES.find((profile) => profile.trainClass === trainClass) || TRAIN_PROFILES[0];

  const expandRoutePlan = () => {
    const expanded = [];
    ROUTE_PLAN.forEach((section, sectionIndex) => {
      if (section.kind === 'road') {
        for (let laneIndex = 0; laneIndex < section.lanes; laneIndex += 1) {
          expanded.push({ ...section, sectionIndex, laneIndex, laneCount: section.lanes });
        }
      } else if (section.kind === 'rail' && section.tracks > 1) {
        for (let trackIndex = 0; trackIndex < section.tracks; trackIndex += 1) {
          expanded.push({ ...section, sectionIndex, trackIndex, trackCount: section.tracks });
        }
      } else {
        expanded.push({ ...section, sectionIndex, laneIndex: 0, trackIndex: 0, laneCount: 1, trackCount: 1 });
      }
    });
    return expanded;
  };

  const ROUTE_ROWS = Object.freeze(expandRoutePlan());
  const ROUTE_CYCLE_LENGTH = ROUTE_ROWS.length;

  const routeMetaForRow = (rowIndex) => {
    if (rowIndex < ROUTE_START_ROW) return null;
    const routeOffset = rowIndex - ROUTE_START_ROW;
    const cycle = Math.floor(routeOffset / ROUTE_CYCLE_LENGTH);
    const localIndex = routeOffset % ROUTE_CYCLE_LENGTH;
    const meta = ROUTE_ROWS[localIndex];
    return { ...meta, cycle, localIndex, routeOffset };
  };

  const cyclePressureFor = (rowIndex, cycle) => {
    const rowPressure = Math.max(0, rowIndex - ROUTE_START_ROW) * 0.0038;
    const cyclePressure = cycle * 0.13;
    return Math.min(1.75, rowPressure + cyclePressure);
  };

  const laneDirectionForBand = (laneCount, laneIndex, reversed) => {
    if (laneCount <= 1) return reversed ? -1 : 1;
    const split = Math.ceil(laneCount / 2);
    const direction = laneIndex < split ? -1 : 1;
    return reversed ? -direction : direction;
  };

  const trainWidth = (profile, carriageCount, carriageWidth) => {
    const tenderWidth = profile.tenderWidth || 0;
    const couplerGap = profile.trainClass === 'bullet' ? 4 : 6;
    return profile.locomotiveWidth + tenderWidth + carriageCount * carriageWidth + (carriageCount + (tenderWidth ? 1 : 0)) * couplerGap + 24;
  };

  const treePatternForRow = (rowIndex, cycle) => {
    const base = EDGE_TREE_PATTERNS[(rowIndex + cycle) % EDGE_TREE_PATTERNS.length];
    if (cycle < 2) return base;
    const extra = deterministicNoise(rowIndex, 9) > 0.55 ? (deterministicNoise(rowIndex, 10) > 0.5 ? -4 : 4) : null;
    return extra === null || base.includes(extra) ? base : [...base, extra];
  };

  const makeGrassRow = (rowIndex, meta) => {
    const trees = treePatternForRow(rowIndex, meta.cycle);
    return {
      index: rowIndex,
      type: 'grass',
      trees,
      blockers: new Set(trees),
      __routePlannedV1: true,
      __routeKind: 'grass',
      __routeCycle: meta.cycle
    };
  };

  const vehicleKindsForRoad = (lanes, cycle) => {
    const kinds = lanes >= 4 ? ROAD_4L_VEHICLES : ROAD_2L_VEHICLES;
    if (cycle < 1) return kinds.filter((kind) => !['supercar', 'sports', 'police', 'ambulance'].includes(kind));
    if (cycle < 2) return kinds.filter((kind) => kind !== 'supercar');
    return kinds;
  };

  const makeTrafficRow = (rowIndex, meta) => {
    const laneCount = meta.laneCount || meta.lanes || 2;
    const laneIndex = meta.laneIndex || 0;
    const cycle = meta.cycle;
    const pressure = cyclePressureFor(rowIndex, cycle);
    const reversed = (meta.sectionIndex + cycle) % 2 === 1;
    const direction = laneDirectionForBand(laneCount, laneIndex, reversed);
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + VEHICLE_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - VEHICLE_SAFE_MARGIN;
    const baseCount = laneCount >= 4 ? 3 : 2;
    const densityBonus = Math.min(laneCount >= 4 ? 3 : 2, Math.floor(cycle / 2) + (rowIndex >= 85 ? 1 : 0));
    const vehicleCount = Math.min(laneCount >= 4 ? 6 : 4, baseCount + densityBonus);
    const spacing = span / vehicleCount;
    const variantKinds = vehicleKindsForRoad(laneCount, cycle);
    const vehicles = [];

    for (let i = 0; i < vehicleCount; i += 1) {
      const variant = variantByKind(variantKinds[(i + rowIndex + laneIndex) % variantKinds.length]) || VEHICLE_VARIANTS[0];
      const jitter = (deterministicNoise(rowIndex, i + 3) - 0.5) * Math.min(spacing * 0.16, TILE_SIZE * 0.92);
      const aggression = clampNumber(
        (variant.tier === 'slow' ? 0.24 : variant.tier === 'fast' ? 0.52 : variant.tier === 'super' ? 0.76 : 0.38) + pressure * 0.12,
        0.18,
        0.92
      );
      const baseSpeed = variant.speedMin + deterministicNoise(rowIndex, i + 7) * (variant.speedMax - variant.speedMin);
      const speed = Math.round(baseSpeed * (0.98 + pressure * 0.16 + (laneCount >= 4 ? 0.05 : 0)));

      vehicles.push({
        id: `${rowIndex}-route-${i}`,
        type: 'vehicle',
        kind: variant.kind,
        x: minX + spacing * (i + 0.5) + jitter,
        width: variant.width,
        depth: variant.depth,
        speed,
        baseSpeed: speed,
        cruiseSpeed: speed * (0.94 + deterministicNoise(rowIndex, i + 13) * 0.14),
        maxSpeed: speed * (1.12 + aggression * 0.3),
        acceleration: Math.round(64 + aggression * 120),
        brakePower: Math.round(112 + aggression * 118),
        aggression,
        reaction: clampNumber(0.2 - aggression * 0.06, 0.11, 0.2),
        minFollowGap: Math.max(TRAFFIC_MIN_GAP, variant.width * (0.48 + (1 - aggression) * 0.14)),
        color: variant.fixedColor || pick(VEHICLE_PALETTE, rowIndex, i + 21),
        trimColor: deterministicNoise(rowIndex, i + 23) > 0.5 ? 0xd2d8df : 0x9eabb8
      });
    }

    return {
      index: rowIndex,
      type: 'traffic',
      direction,
      laneOffset: 0,
      roadLaneCount: laneCount,
      roadLaneIndex: laneIndex,
      roadBandId: `${meta.cycle}-${meta.sectionIndex}`,
      roadReversed: reversed,
      vehicles,
      blockers: new Set(),
      __routePlannedV1: true,
      __routeKind: `road${laneCount}`,
      __routeCycle: cycle
    };
  };

  const makeWaterRow = (rowIndex, meta) => {
    const cycle = meta.cycle;
    const pressure = cyclePressureFor(rowIndex, cycle);
    const direction = (rowIndex + cycle) % 2 === 0 ? 1 : -1;
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + WATER_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - WATER_SAFE_MARGIN;
    const plankCount = Math.min(6, 4 + Math.floor(cycle / 2));
    const spacing = span / plankCount;
    const laneSpeed = 56 + deterministicNoise(rowIndex, 31) * 22 + pressure * 10;
    const planks = [];

    for (let i = 0; i < plankCount; i += 1) {
      const width = Math.round(118 + deterministicNoise(rowIndex, i + 33) * 34);
      planks.push({
        id: `${rowIndex}-route-plank-${i}`,
        type: 'plank',
        kind: 'plank',
        x: minX + spacing * (i + 0.5) + (deterministicNoise(rowIndex, i + 41) - 0.5) * Math.min(44, spacing * 0.18),
        width,
        depth: 29,
        speed: laneSpeed,
        baseSpeed: laneSpeed,
        color: pick(PLANK_PALETTE, rowIndex, i + 51),
        rideLimitMs: 3000
      });
    }

    return {
      index: rowIndex,
      type: 'water',
      direction,
      laneOffset: 0,
      planks,
      blockers: new Set(),
      __routePlannedV1: true,
      __routeKind: 'water',
      __routeCycle: cycle
    };
  };

  const makeRailRow = (rowIndex, meta) => {
    const cycle = meta.cycle;
    const requestedClass = meta.trainClass || 'classic';
    const trainClass = requestedClass === 'bullet'
      ? 'bullet'
      : cycle >= 2 && requestedClass === 'classic' && deterministicNoise(rowIndex, 61) > 0.55
        ? 'electric'
        : requestedClass;
    const profile = trainProfileFor(trainClass);
    const bullet = trainClass === 'bullet';
    const trackCount = meta.trackCount || meta.tracks || 1;
    const trackIndex = meta.trackIndex || 0;
    const directionBase = trackCount > 1
      ? (trackIndex % 2 === 0 ? 1 : -1)
      : (deterministicNoise(rowIndex, 62) > 0.5 ? 1 : -1);
    const reversed = (meta.sectionIndex + cycle) % 2 === 1;
    const direction = reversed ? -directionBase : directionBase;
    const pressure = cyclePressureFor(rowIndex, cycle);
    const carriageCount = bullet
      ? Math.min(7, 4 + Math.floor(cycle / 2))
      : Math.min(profile.carriageCountMax, profile.carriageCountMin + (cycle >= 1 ? 1 : 0));
    const carriageWidth = Math.round(profile.carriageWidthMin + deterministicNoise(rowIndex, 63) * (profile.carriageWidthMax - profile.carriageWidthMin));
    const width = trainWidth(profile, carriageCount, carriageWidth);
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + TRAIN_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - TRAIN_SAFE_MARGIN;
    const speed = Math.round((profile.speedMin + deterministicNoise(rowIndex, 64) * (profile.speedMax - profile.speedMin)) * (bullet ? 1 + pressure * 0.08 : 0.95 + pressure * 0.08));

    return {
      index: rowIndex,
      type: 'rail',
      direction,
      speed,
      laneOffset: trackCount > 1 ? (trackIndex === 0 ? -5 : 5) : (deterministicNoise(rowIndex, 65) - 0.5) * 4,
      railTrackCount: trackCount,
      railTrackIndex: trackIndex,
      railBandId: `${cycle}-${meta.sectionIndex}`,
      railReversed: reversed,
      trains: [{
        id: `${rowIndex}-route-train-0`,
        type: 'train',
        kind: 'train',
        trainClass,
        x: minX + deterministicNoise(rowIndex, 66) * span,
        width,
        depth: profile.depth,
        locomotiveWidth: profile.locomotiveWidth,
        tenderWidth: profile.tenderWidth || 0,
        carriageWidth,
        carriageCount,
        color: pick(TRAIN_PALETTE, rowIndex, 67),
        trimColor: deterministicNoise(rowIndex, 68) > 0.5 ? 0xc7ced6 : 0x394552
      }],
      blockers: new Set(),
      __routePlannedV1: true,
      __routeKind: bullet ? `fastRail${trackCount}` : `rail${trackCount}`,
      __routeCycle: cycle
    };
  };

  const makeRouteRow = (rowIndex) => {
    const meta = routeMetaForRow(rowIndex);
    if (!meta) return null;
    if (meta.kind === 'grass') return makeGrassRow(rowIndex, meta);
    if (meta.kind === 'road') return makeTrafficRow(rowIndex, meta);
    if (meta.kind === 'water') return makeWaterRow(rowIndex, meta);
    if (meta.kind === 'rail') return makeRailRow(rowIndex, meta);
    return makeGrassRow(rowIndex, meta);
  };

  const isDesktopGame = (game) => game.renderProfile?.name === 'desktop-premium';
  const deviceMode = (game) => isDesktopGame(game)
    ? (game.__ayamDesktopPerformanceMode || 'normal')
    : (game.__ayamMobilePerformanceMode || 'normal');

  const activeWindowFor = (game, centerRow = 0) => {
    const mode = deviceMode(game);
    if (centerRow >= 80) {
      if (mode === 'severe') return { forward: 10, backward: 5 };
      if (mode === 'pressure') return { forward: 12, backward: 6 };
      return { forward: 14, backward: 7 };
    }
    if (centerRow >= 38) {
      if (mode === 'severe') return { forward: 13, backward: 6 };
      if (mode === 'pressure') return { forward: 16, backward: 7 };
      return { forward: 20, backward: 9 };
    }
    if (mode === 'severe') return { forward: 16, backward: 6 };
    if (mode === 'pressure') return { forward: 20, backward: 7 };
    return { forward: 24, backward: 9 };
  };

  const ensureRouteRows = (game, start, end) => {
    if (!Array.isArray(game.rows)) return;
    for (let rowIndex = Math.max(ROUTE_START_ROW, start); rowIndex <= end; rowIndex += 1) {
      if (game.rowGroups?.has?.(rowIndex)) continue;
      game.rows[rowIndex] = makeRouteRow(rowIndex);
    }
  };

  proto._addRow = function addRowWithAuthoritativeRoute(row) {
    if (!row?.__routePlannedV1) return originalAddRow.call(this, row);
    if (this.rowGroups.has(row.index)) return;

    const rowGroup = createRowGroup(row, this.geometries, this.materials);
    this.rowGroups.set(row.index, rowGroup);
    this.worldGroup.add(rowGroup);

    if (row.type === 'water') {
      rowGroup.traverse((child) => {
        if (child.userData?.waterFlow) {
          this.waterFlowItems.push(child);
          if (!this.waterFlowRows.has(row.index)) this.waterFlowRows.set(row.index, []);
          this.waterFlowRows.get(row.index).push(child);
        }
      });
    }

    if (row.type === 'traffic') {
      const laneVehicles = [];
      row.vehicles.forEach((vehicle) => {
        const vehicleGroup = createVehicle(vehicle, row, this.geometries, this.materials);
        vehicleGroup.userData.routePlanned = true;
        this.vehicleGroup.add(vehicleGroup);
        this.vehicles.push(vehicleGroup);
        laneVehicles.push(vehicleGroup);
      });
      this.trafficRows.set(row.index, laneVehicles);
    }

    if (row.type === 'rail') {
      row.trains.forEach((train) => {
        const trainGroup = createTrain(train, row, this.geometries, this.materials);
        trainGroup.userData.routePlanned = true;
        this.vehicleGroup.add(trainGroup);
        this.vehicles.push(trainGroup);
      });
    }

    if (row.type === 'water') {
      const lanePlanks = [];
      row.planks.forEach((plank) => {
        const plankGroup = createPlank(plank, row, this.geometries, this.materials);
        plankGroup.userData.routePlanned = true;
        this.vehicleGroup.add(plankGroup);
        this.planks.push(plankGroup);
        lanePlanks.push(plankGroup);
      });
      this.waterRows.set(row.index, lanePlanks);
    }
  };

  proto._addRowsAround = function addRowsAroundWithAuthoritativeRoute(centerRow, forwardRows = 24, backwardRows = 24) {
    const row = centerRow || 0;
    const { forward, backward } = activeWindowFor(this, row);
    const cappedForward = Math.min(forwardRows, forward);
    const cappedBackward = Math.min(backwardRows, backward);
    const start = Math.max(0, row - cappedBackward);
    const end = Math.min(this.rows.length - 1, row + cappedForward);

    ensureRouteRows(this, start, end);
    for (let index = start; index <= end; index += 1) {
      if (this.rows[index]) this._addRow(this.rows[index]);
    }
  };

  proto._keepRuntimeWindowNearPlayer = function keepRuntimeWindowNearPlayerWithAuthoritativeRoute() {
    const row = this.playerPosition?.row || 0;
    const { forward, backward } = activeWindowFor(this, row);
    const start = Math.max(0, row - backward);
    const end = Math.min(this.rows.length - 1, row + forward);

    ensureRouteRows(this, start, end);
    this._normalizeVisibleTrafficLanes?.();
    this._trimSimulationWindow?.(row, forward, backward);
    this._capFxItemsForMobile?.();
  };

  const originalNormalizeTrafficLane = proto._normalizeTrafficLaneForPlayability;
  proto._normalizeTrafficLaneForPlayability = function normalizeTrafficLaneWithRoutePlan(rowIndex, items = []) {
    const row = this.rows?.[rowIndex];
    if (!row?.__routePlannedV1 || row.type !== 'traffic' || !Array.isArray(items)) {
      return originalNormalizeTrafficLane?.call(this, rowIndex, items) || items;
    }

    const cycle = row.__routeCycle || 0;
    const pressure = cyclePressureFor(rowIndex, cycle);
    items.forEach((vehicle, index) => {
      const data = vehicle.userData || {};
      if (data.routeProfileAppliedV1) return;
      const base = Number(data.baseSpeed || data.speed || 120);
      const aggression = clampNumber(Number(data.aggression || 0.36) + pressure * 0.08, 0.18, 0.95);
      data.speed = base;
      data.baseSpeed = base;
      data.cruiseSpeed = base * (0.94 + deterministicNoise(rowIndex, index + 81) * 0.14);
      data.maxSpeed = base * (1.12 + aggression * 0.28);
      data.acceleration = Math.max(Number(data.acceleration || 0), 72 + aggression * 112);
      data.brakePower = Math.max(Number(data.brakePower || 0), 118 + aggression * 126);
      data.currentSpeed = clampNumber(Number(data.currentSpeed || base), base * 0.9, data.maxSpeed);
      data.minFollowGap = Math.max(Number(data.minFollowGap || TRAFFIC_MIN_GAP), Number(data.width || 70) * (0.46 + (1 - aggression) * 0.13));
      data.routeProfileAppliedV1 = true;
    });
    return items;
  };

  proto._canMoveTo = function canMoveToWithAuthoritativeRoute(row, tile) {
    const result = originalCanMoveTo.call(this, row, tile);
    if (result) return true;

    // Grass rows intentionally have trees, but the center corridor must remain
    // readable and playable across every cycle.
    const targetRow = this.rows?.[row];
    if (targetRow?.__routePlannedV1 && targetRow.type === 'grass' && Math.abs(tile) <= 2) {
      targetRow.blockers?.delete?.(tile);
      if (Array.isArray(targetRow.trees)) targetRow.trees = targetRow.trees.filter((treeTile) => treeTile !== tile);
      return true;
    }
    return false;
  };
}
