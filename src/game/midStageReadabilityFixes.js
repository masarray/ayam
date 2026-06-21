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

// Mid-stage readability guard.
//
// The fully procedural generator can create a visually confusing cluster around
// score 40-55: rail -> road block -> empty grass -> rail -> road -> forest/water.
// On mobile, a tree blocker in that cluster may look like empty space because the
// crown/track perspective hides the blocking trunk tile. This guard gives the
// score-47 section a stable child-readable rhythm with clear safe rows and an
// unobstructed center corridor.
if (!RoadQuestGame.__ayamMidStageReadabilityFixesAppliedV1) {
  RoadQuestGame.__ayamMidStageReadabilityFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const originalAddRowsAround = proto._addRowsAround;
  const originalKeepRuntimeWindowNearPlayer = proto._keepRuntimeWindowNearPlayer;
  const originalCanMoveTo = proto._canMoveTo;

  const READABLE_START = 40;
  const READABLE_END = 56;
  const SAFE_CORRIDOR_TILES = Object.freeze([-2, -1, 0, 1, 2]);
  const MID_STAGE_PLAN = Object.freeze({
    40: { type: 'grass' },
    41: { type: 'traffic', bandId: 41, laneCount: 2, laneIndex: 0, reversed: false },
    42: { type: 'traffic', bandId: 41, laneCount: 2, laneIndex: 1, reversed: false },
    43: { type: 'grass' },
    44: { type: 'rail', trainClass: 'classic' },
    45: { type: 'grass' },
    46: { type: 'water' },
    47: { type: 'grass' },
    48: { type: 'traffic', bandId: 48, laneCount: 2, laneIndex: 0, reversed: true },
    49: { type: 'traffic', bandId: 48, laneCount: 2, laneIndex: 1, reversed: true },
    50: { type: 'grass' },
    51: { type: 'rail', trainClass: 'electric' },
    52: { type: 'grass' },
    53: { type: 'traffic', bandId: 53, laneCount: 2, laneIndex: 0, reversed: false },
    54: { type: 'traffic', bandId: 53, laneCount: 2, laneIndex: 1, reversed: false },
    55: { type: 'grass' },
    56: { type: 'water' }
  });

  const deterministicNoise = (rowIndex, salt = 0) => {
    const x = Math.sin((rowIndex + 1) * 107.71 + (salt + 11) * 43.93) * 43758.5453;
    return x - Math.floor(x);
  };

  const pick = (list, rowIndex, salt = 0) => list[Math.floor(deterministicNoise(rowIndex, salt) * list.length) % list.length];

  const laneDirectionForBand = (laneCount, laneIndex, reversed) => {
    if (laneCount <= 1) return reversed ? -1 : 1;
    const split = Math.ceil(laneCount / 2);
    const direction = laneIndex < split ? -1 : 1;
    return reversed ? -direction : direction;
  };

  const trainProfileFor = (trainClass) => TRAIN_PROFILES.find((profile) => profile.trainClass === trainClass) || TRAIN_PROFILES[0];

  const trainWidth = (profile, carriageCount, carriageWidth) => {
    const tenderWidth = profile.tenderWidth || 0;
    const couplerGap = profile.trainClass === 'bullet' ? 4 : 6;
    return profile.locomotiveWidth + tenderWidth + carriageCount * carriageWidth + (carriageCount + (tenderWidth ? 1 : 0)) * couplerGap + 24;
  };

  const makeOpenGrassRow = (rowIndex) => ({
    index: rowIndex,
    type: 'grass',
    trees: [],
    blockers: new Set()
  });

  const vehicleVariantsForRow = (rowIndex) => {
    const preferredKinds = rowIndex < 48
      ? ['sedan', 'taxi', 'pickup', 'van', 'boxTruck']
      : ['sedan', 'hatchback', 'pickup', 'bus', 'boxTruck'];
    return preferredKinds
      .map((kind) => VEHICLE_VARIANTS.find((variant) => variant.kind === kind))
      .filter(Boolean);
  };

  const makeReadableTrafficRow = (rowIndex, plan) => {
    const laneCount = plan.laneCount || 2;
    const laneIndex = plan.laneIndex || 0;
    const reversed = Boolean(plan.reversed);
    const direction = laneDirectionForBand(laneCount, laneIndex, reversed);
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + VEHICLE_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - VEHICLE_SAFE_MARGIN;
    const variants = vehicleVariantsForRow(rowIndex);
    const count = rowIndex < 48 ? 2 : 3;
    const spacing = span / count;
    const vehicles = [];

    for (let i = 0; i < count; i += 1) {
      const variant = variants[(i + rowIndex + laneIndex) % variants.length] || VEHICLE_VARIANTS[0];
      const jitter = (deterministicNoise(rowIndex, i + 3) - 0.5) * Math.min(spacing * 0.12, TILE_SIZE * 0.8);
      const baseSpeed = Math.round(variant.speedMin + deterministicNoise(rowIndex, i + 7) * (variant.speedMax - variant.speedMin));
      const speed = Math.round(baseSpeed * (rowIndex >= 48 ? 1.08 : 0.96));

      vehicles.push({
        id: `${rowIndex}-readable-${i}`,
        type: 'vehicle',
        kind: variant.kind,
        x: minX + spacing * (i + 0.5) + jitter,
        width: variant.width,
        depth: variant.depth,
        speed,
        baseSpeed: speed,
        cruiseSpeed: speed * (0.93 + deterministicNoise(rowIndex, i + 13) * 0.12),
        maxSpeed: speed * (variant.tier === 'fast' ? 1.22 : 1.14),
        acceleration: variant.tier === 'slow' ? 64 : 94,
        brakePower: variant.tier === 'slow' ? 132 : 154,
        aggression: variant.tier === 'slow' ? 0.22 : 0.38,
        reaction: 0.18,
        minFollowGap: Math.max(TRAFFIC_MIN_GAP, variant.width * 0.5),
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
      roadBandId: plan.bandId ?? rowIndex,
      roadReversed: reversed,
      vehicles,
      blockers: new Set()
    };
  };

  const makeReadableRailRow = (rowIndex, plan) => {
    const profile = trainProfileFor(plan.trainClass || 'classic');
    const carriageCount = Math.min(profile.carriageCountMax, profile.carriageCountMin + (plan.trainClass === 'electric' ? 1 : 0));
    const carriageWidth = Math.round(profile.carriageWidthMin + deterministicNoise(rowIndex, 31) * (profile.carriageWidthMax - profile.carriageWidthMin));
    const width = trainWidth(profile, carriageCount, carriageWidth);
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + TRAIN_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - TRAIN_SAFE_MARGIN;
    const direction = deterministicNoise(rowIndex, 32) > 0.5 ? 1 : -1;
    const speed = Math.round(profile.speedMin + deterministicNoise(rowIndex, 33) * (profile.speedMax - profile.speedMin));

    return {
      index: rowIndex,
      type: 'rail',
      direction,
      speed,
      laneOffset: (deterministicNoise(rowIndex, 34) - 0.5) * 4,
      railTrackCount: 1,
      railTrackIndex: 0,
      railBandId: rowIndex,
      railReversed: direction < 0,
      trains: [{
        id: `${rowIndex}-readable-train-0`,
        type: 'train',
        kind: 'train',
        trainClass: profile.trainClass,
        x: minX + deterministicNoise(rowIndex, 35) * span,
        width,
        depth: profile.depth,
        locomotiveWidth: profile.locomotiveWidth,
        tenderWidth: profile.tenderWidth || 0,
        carriageWidth,
        carriageCount,
        color: pick(TRAIN_PALETTE, rowIndex, 36),
        trimColor: deterministicNoise(rowIndex, 37) > 0.5 ? 0xc7ced6 : 0x394552
      }],
      blockers: new Set()
    };
  };

  const makeReadableWaterRow = (rowIndex) => {
    const direction = deterministicNoise(rowIndex, 41) > 0.5 ? 1 : -1;
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + WATER_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - WATER_SAFE_MARGIN;
    const count = 4;
    const spacing = span / count;
    const speed = 58 + deterministicNoise(rowIndex, 42) * 20;
    const planks = [];

    for (let i = 0; i < count; i += 1) {
      const width = Math.round(118 + deterministicNoise(rowIndex, i + 43) * 32);
      planks.push({
        id: `${rowIndex}-readable-plank-${i}`,
        type: 'plank',
        kind: 'plank',
        x: minX + spacing * (i + 0.5) + (deterministicNoise(rowIndex, i + 51) - 0.5) * 36,
        width,
        depth: 29,
        speed,
        baseSpeed: speed,
        color: pick(PLANK_PALETTE, rowIndex, i + 57),
        rideLimitMs: 3000
      });
    }

    return {
      index: rowIndex,
      type: 'water',
      direction,
      laneOffset: 0,
      planks,
      blockers: new Set()
    };
  };

  const makeReadableRow = (rowIndex) => {
    const plan = MID_STAGE_PLAN[rowIndex];
    if (!plan) return null;
    if (plan.type === 'traffic') return makeReadableTrafficRow(rowIndex, plan);
    if (plan.type === 'rail') return makeReadableRailRow(rowIndex, plan);
    if (plan.type === 'water') return makeReadableWaterRow(rowIndex);
    return makeOpenGrassRow(rowIndex);
  };

  const prepareReadableRowsInWindow = (game, centerRow = 0, forwardRows = 20, backwardRows = 10) => {
    if (!Array.isArray(game.rows)) return;
    const minRow = Math.max(READABLE_START, centerRow - backwardRows);
    const maxRow = Math.min(READABLE_END, centerRow + forwardRows);

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      if (!MID_STAGE_PLAN[rowIndex]) continue;
      if (game.rowGroups?.has?.(rowIndex)) continue;
      game.rows[rowIndex] = makeReadableRow(rowIndex);
    }
  };

  const softenHiddenMidStageBlocker = (row, tile) => {
    if (!row || row.index < READABLE_START || row.index > READABLE_END) return;
    if (!SAFE_CORRIDOR_TILES.includes(tile)) return;
    if (!row.blockers?.has?.(tile)) return;
    row.blockers.delete(tile);
    if (Array.isArray(row.trees)) row.trees = row.trees.filter((treeTile) => treeTile !== tile);
  };

  proto._addRowsAround = function addRowsAroundWithReadableMidStage(centerRow, forwardRows = 24, backwardRows = 24) {
    prepareReadableRowsInWindow(this, centerRow || 0, forwardRows, backwardRows);
    return originalAddRowsAround.call(this, centerRow, forwardRows, backwardRows);
  };

  proto._keepRuntimeWindowNearPlayer = function keepRuntimeWindowNearPlayerWithReadableMidStage(...args) {
    const row = this.playerPosition?.row || 0;
    prepareReadableRowsInWindow(this, row, 20, 10);
    return originalKeepRuntimeWindowNearPlayer.apply(this, args);
  };

  proto._canMoveTo = function canMoveToWithMidStageBlockerAudit(row, tile) {
    const result = originalCanMoveTo.call(this, row, tile);
    if (result) return true;

    const targetRow = this.rows?.[row];
    softenHiddenMidStageBlocker(targetRow, tile);
    if (targetRow && !targetRow.blockers?.has?.(tile)) return true;
    return false;
  };
}
