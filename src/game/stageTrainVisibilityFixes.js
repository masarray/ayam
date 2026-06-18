import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  TILE_SIZE,
  TRAIN_PALETTE,
  TRAIN_PROFILES,
  TRAIN_SAFE_MARGIN
} from './constants.js';

// Mid-stage train visibility guard.
//
// StageBalance intentionally forces rail rows around 34, 51, and 68, but those
// rows can start simulating many moves before the player reaches them. A train
// may therefore be in its off-screen/wrap phase exactly when the chicken arrives.
// This guard keeps the row deterministic and primes the row-68 train approach
// shortly before the player reaches it, without adding extra trains or mesh load.
if (!RoadQuestGame.__ayamStageTrainVisibilityFixesAppliedV1) {
  RoadQuestGame.__ayamStageTrainVisibilityFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const originalAddRowsAround = proto._addRowsAround;
  const originalKeepRuntimeWindowNearPlayer = proto._keepRuntimeWindowNearPlayer;

  const GUARANTEED_MID_RAIL_ROWS = Object.freeze([34, 51, 68]);
  const PRIME_ROW = 68;
  const PRIME_START_OFFSET = 4;
  const PRIME_END_OFFSET = 1;

  const deterministicNoise = (rowIndex, salt = 0) => {
    const x = Math.sin((rowIndex + 1) * 103.91 + (salt + 7) * 47.23) * 43758.5453;
    return x - Math.floor(x);
  };

  const trainProfileFor = (trainClass) => TRAIN_PROFILES.find((profile) => profile.trainClass === trainClass) || TRAIN_PROFILES[0];

  const trainWidth = (profile, carriageCount, carriageWidth) => {
    const tenderWidth = profile.tenderWidth || 0;
    const couplerGap = profile.trainClass === 'bullet' ? 4 : 6;
    return profile.locomotiveWidth + tenderWidth + carriageCount * carriageWidth + (carriageCount + (tenderWidth ? 1 : 0)) * couplerGap + 24;
  };

  const trainColor = (rowIndex, salt = 0) => TRAIN_PALETTE[Math.floor(deterministicNoise(rowIndex, salt) * TRAIN_PALETTE.length) % TRAIN_PALETTE.length];

  const makeReadableMidRailRow = (rowIndex, sourceRow = null) => {
    const trainClass = rowIndex >= 68
      ? 'electric'
      : deterministicNoise(rowIndex, 4) > 0.55
        ? 'freight'
        : 'classic';
    const profile = trainProfileFor(trainClass);
    const carriageCount = Math.min(profile.carriageCountMax, profile.carriageCountMin + (rowIndex >= 68 ? 1 : 0));
    const carriageWidth = Math.round(profile.carriageWidthMin + deterministicNoise(rowIndex, 5) * (profile.carriageWidthMax - profile.carriageWidthMin));
    const width = trainWidth(profile, carriageCount, carriageWidth);
    const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + TRAIN_SAFE_MARGIN * 2;
    const minX = MIN_TILE * TILE_SIZE - TRAIN_SAFE_MARGIN;
    const direction = sourceRow?.direction ?? (deterministicNoise(rowIndex, 6) > 0.5 ? 1 : -1);
    const speed = rowIndex >= 68
      ? 470 + deterministicNoise(rowIndex, 7) * 120
      : profile.speedMin + deterministicNoise(rowIndex, 8) * (profile.speedMax - profile.speedMin);

    return {
      index: rowIndex,
      type: 'rail',
      direction,
      speed,
      laneOffset: sourceRow?.laneOffset ?? (deterministicNoise(rowIndex, 9) - 0.5) * 4,
      railTrackCount: sourceRow?.railTrackCount || 1,
      railTrackIndex: sourceRow?.railTrackIndex || 0,
      railBandId: sourceRow?.railBandId ?? rowIndex,
      railReversed: sourceRow?.railReversed ?? direction < 0,
      trains: [{
        id: `${rowIndex}-readable-train-0`,
        type: 'train',
        kind: 'train',
        trainClass,
        x: minX + deterministicNoise(rowIndex, 10) * span,
        width,
        depth: profile.depth,
        locomotiveWidth: profile.locomotiveWidth,
        tenderWidth: profile.tenderWidth || 0,
        carriageWidth,
        carriageCount,
        color: trainColor(rowIndex, 11),
        trimColor: deterministicNoise(rowIndex, 12) > 0.5 ? 0xc7ced6 : 0x394552
      }],
      blockers: new Set()
    };
  };

  const ensureMidRailRowsInWindow = (game, centerRow = 0, forwardRows = 20, backwardRows = 10) => {
    if (!Array.isArray(game.rows)) return;
    const minRow = Math.max(0, centerRow - backwardRows);
    const maxRow = centerRow + forwardRows;

    GUARANTEED_MID_RAIL_ROWS.forEach((rowIndex) => {
      if (rowIndex < minRow || rowIndex > maxRow) return;
      if (game.rowGroups?.has?.(rowIndex)) return;
      const row = game.rows[rowIndex];
      if (row?.type === 'rail' && Array.isArray(row.trains) && row.trains.length) return;
      game.rows[rowIndex] = makeReadableMidRailRow(rowIndex, row);
    });
  };

  const trainLeadDistance = (train, playerX) => {
    const { direction = 1, width = 220 } = train.userData || {};
    const frontX = train.position.x + direction * width * 0.5;
    return direction * (playerX - frontX);
  };

  const isUsefulTrainApproach = (train, playerX) => {
    const { direction = 1, width = 220 } = train.userData || {};
    const boardMin = MIN_TILE * TILE_SIZE;
    const boardMax = MAX_TILE * TILE_SIZE;
    const visibleMin = boardMin - width * 0.72;
    const visibleMax = boardMax + width * 0.72;
    const lead = trainLeadDistance(train, playerX);

    if (train.position.x >= visibleMin && train.position.x <= visibleMax) return true;
    // A just-offscreen approaching train is also useful; it will enter the board
    // within a readable reaction window instead of feeling absent.
    return lead > -60 && lead < 620 && direction * (playerX - train.position.x) > 0;
  };

  const primeReadableTrainApproach = (game) => {
    const playerRow = game.playerPosition?.row ?? 0;
    if (playerRow < PRIME_ROW - PRIME_START_OFFSET || playerRow > PRIME_ROW - PRIME_END_OFFSET) return;
    if (!game.rowGroups?.has?.(PRIME_ROW)) return;

    const trains = Array.isArray(game.vehicles)
      ? game.vehicles.filter((vehicle) => vehicle.userData?.type === 'train' && vehicle.userData?.rowIndex === PRIME_ROW)
      : [];
    if (!trains.length) return;

    const train = trains[0];
    const data = train.userData || {};
    if (data.stageVisibilityPrimedV1) return;

    const playerX = game.player?.position?.x ?? 0;
    if (!isUsefulTrainApproach(train, playerX)) {
      const boardMin = MIN_TILE * TILE_SIZE;
      const boardMax = MAX_TILE * TILE_SIZE;
      const width = Math.max(180, Number(data.width) || 260);
      const direction = data.direction || 1;

      train.position.x = direction > 0
        ? boardMin - width * 0.55 - TILE_SIZE * 0.8
        : boardMax + width * 0.55 + TILE_SIZE * 0.8;
    }

    const speed = Math.max(Number(data.speed) || Number(data.baseSpeed) || 0, 480);
    data.speed = Math.min(speed, 620);
    data.baseSpeed = data.speed;
    data.currentSpeed = data.speed;
    data.stageVisibilityPrimedV1 = true;
    data.hornedNearChicken = false;
    data.hornApproachId = null;
    data.lastPassSoundAt = 0;
  };

  proto._addRowsAround = function addRowsAroundWithMidTrainVisibility(centerRow, forwardRows = 24, backwardRows = 24) {
    ensureMidRailRowsInWindow(this, centerRow || 0, forwardRows, backwardRows);
    const result = originalAddRowsAround.call(this, centerRow, forwardRows, backwardRows);
    ensureMidRailRowsInWindow(this, centerRow || 0, forwardRows, backwardRows);
    return result;
  };

  proto._keepRuntimeWindowNearPlayer = function keepRuntimeWindowNearPlayerWithMidTrainVisibility(...args) {
    const row = this.playerPosition?.row || 0;
    ensureMidRailRowsInWindow(this, row, 20, 10);
    const result = originalKeepRuntimeWindowNearPlayer.apply(this, args);
    primeReadableTrainApproach(this);
    return result;
  };
}
