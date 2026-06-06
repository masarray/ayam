import {
  MAX_TILE,
  MIN_TILE,
  PLANK_PALETTE,
  STARTING_ROWS,
  TILE_SIZE,
  TRAIN_PALETTE,
  TRAIN_PROFILES,
  TRAIN_SAFE_MARGIN,
  VEHICLE_PALETTE,
  VEHICLE_SAFE_MARGIN,
  VEHICLE_VARIANTS,
  WATER_SAFE_MARGIN
} from './constants.js';
import { clamp, hashSeed, mulberry32, pick, uniqueRandomTiles } from './math.js';

function previousTypes(rows, rowIndex, count) {
  const types = [];
  for (let i = Math.max(0, rowIndex - count); i < rowIndex; i += 1) {
    if (rows[i]) types.push(rows[i].type);
  }
  return types;
}

function weightedPick(random, list) {
  const total = list.reduce((sum, item) => sum + (item.weight || 1), 0);
  let roll = random() * total;
  for (const item of list) {
    roll -= item.weight || 1;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

function difficultyForRow(rowIndex) {
  // Starts gentle, then increases slowly after the player has crossed several rows.
  const extraRows = Math.max(0, rowIndex - 6);
  const speedMultiplier = 1 + Math.min(0.78, extraRows * 0.014);
  const hazardBonus = Math.min(0.19, extraRows * 0.0034);
  const waterChance = rowIndex < 14 ? 0 : Math.min(0.25, 0.075 + (rowIndex - 14) * 0.004);
  // More railway pressure later, but still inserts safe/forest rows to avoid impossible chains.
  const railChance = rowIndex < 10 ? 0.09 : Math.min(0.36, 0.16 + Math.max(0, rowIndex - 18) * 0.006);
  const trainIntensity = Math.min(1, Math.max(0, (rowIndex - 22) / 28));
  return { speedMultiplier, hazardBonus, waterChance, railChance, trainIntensity };
}

function randomInt(random, min, maxInclusive) {
  return min + Math.floor(random() * (maxInclusive - min + 1));
}

function generateForestRow(rowIndex, random) {
  const treeCount = 4 + Math.floor(random() * 5);
  const excluded = [-1, 0, 1];
  const tiles = uniqueRandomTiles(random, treeCount, MIN_TILE, MAX_TILE, excluded);

  // Avoid creating a total wall. Leave at least one tile in each broad zone.
  const softened = tiles.filter((tile, index) => {
    if (index < 2) return true;
    const leftBlocked = tiles.filter((t) => t < -2).length > 4;
    const midBlocked = tiles.filter((t) => t >= -2 && t <= 2).length > 3;
    const rightBlocked = tiles.filter((t) => t > 2).length > 4;
    if (leftBlocked && tile < -2) return random() > 0.45;
    if (midBlocked && tile >= -2 && tile <= 2) return random() > 0.55;
    if (rightBlocked && tile > 2) return random() > 0.45;
    return true;
  });

  return {
    index: rowIndex,
    type: 'forest',
    trees: softened,
    blockers: new Set(softened)
  };
}

function roadBandContinuation(rows, rowIndex) {
  const previous = rows[rowIndex - 1];
  if (!previous || previous.type !== 'traffic') return null;
  if (!previous.roadLaneCount || previous.roadLaneCount <= 1) return null;
  if (previous.roadLaneIndex >= previous.roadLaneCount - 1) return null;
  return {
    bandId: previous.roadBandId,
    laneCount: previous.roadLaneCount,
    laneIndex: previous.roadLaneIndex + 1,
    reversed: previous.roadReversed
  };
}

function chooseRoadLaneCount(rowIndex, random) {
  if (rowIndex < 10) return 1;
  const roll = random();
  if (rowIndex > 18 && roll < 0.22) return 4;
  if (rowIndex > 12 && roll < 0.44) return 3;
  return 1;
}

function laneDirectionForBand(laneCount, laneIndex, reversed) {
  if (laneCount <= 1) return reversed ? -1 : 1;
  // Two directions within the same road block: left half one way, right half the opposite.
  const split = Math.ceil(laneCount / 2);
  const direction = laneIndex < split ? -1 : 1;
  return reversed ? -direction : direction;
}

function generateTrafficRow(rowIndex, random, roadBand = null) {
  const { speedMultiplier } = difficultyForRow(rowIndex);
  const laneCount = roadBand?.laneCount || chooseRoadLaneCount(rowIndex, random);
  const laneIndex = roadBand?.laneIndex || 0;
  const roadBandId = roadBand?.bandId ?? rowIndex;
  const reversed = roadBand?.reversed ?? random() > 0.5;
  const direction = laneCount > 1 ? laneDirectionForBand(laneCount, laneIndex, reversed) : (random() > 0.5 ? 1 : -1);
  const laneOffset = laneCount > 1 ? 0 : (random() - 0.5) * 6;
  const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + VEHICLE_SAFE_MARGIN * 2;
  const minX = MIN_TILE * TILE_SIZE - VEHICLE_SAFE_MARGIN;

  // Later rows get denser lanes, but spacing still prevents pile-ups.
  const densityBonus = laneCount > 1 && rowIndex > 18 ? 1 : 0;
  const desiredCount = 2 + Math.floor(random() * 4) + densityBonus + (rowIndex > 28 && random() > 0.58 ? 1 : 0);
  const vehicles = [];
  const chosenVariants = [];
  let safetyBudget = span - 140;

  for (let i = 0; i < desiredCount; i += 1) {
    const variant = weightedPick(random, VEHICLE_VARIANTS);
    const minGap = variant.width > 115 ? 114 : 84;
    if (safetyBudget - variant.width - minGap < 0 && chosenVariants.length >= 2) break;
    chosenVariants.push(variant);
    safetyBudget -= variant.width + minGap;
  }

  const count = Math.max(2, chosenVariants.length);
  const spacing = span / count;
  const laneCruiseBias = 0.86 + random() * 0.32;

  for (let i = 0; i < count; i += 1) {
    const variant = chosenVariants[i] || weightedPick(random, VEHICLE_VARIANTS);
    const maxJitter = Math.min(spacing * 0.12, TILE_SIZE * 0.82);
    const x = minX + spacing * (i + 0.5) + (random() - 0.5) * maxJitter;
    const baseSpeed = variant.speedMin + random() * (variant.speedMax - variant.speedMin);
    const speed = clamp(
      baseSpeed * laneCruiseBias * speedMultiplier,
      variant.speedMin * 0.82,
      variant.speedMax * (1.05 + Math.min(0.45, speedMultiplier - 1))
    );

    vehicles.push({
      id: `${rowIndex}-${i}`,
      type: 'vehicle',
      kind: variant.kind,
      x,
      width: variant.width,
      depth: variant.depth,
      speed,
      baseSpeed: speed,
      color: variant.fixedColor || pick(random, VEHICLE_PALETTE),
      trimColor: random() > 0.5 ? 0xd2d8df : 0x9eabb8
    });
  }

  return {
    index: rowIndex,
    type: 'traffic',
    direction,
    laneOffset,
    roadLaneCount: laneCount,
    roadLaneIndex: laneIndex,
    roadBandId,
    roadReversed: reversed,
    vehicles,
    blockers: new Set()
  };
}

function generateRailRow(rowIndex, random) {
  const { speedMultiplier, trainIntensity } = difficultyForRow(rowIndex);
  const direction = random() > 0.5 ? 1 : -1;
  const laneOffset = (random() - 0.5) * 4;
  const availableProfiles = TRAIN_PROFILES
    .filter((profile) => !profile.unlockRow || rowIndex >= profile.unlockRow)
    .map((profile) => ({
      ...profile,
      // Later rows should feel more tense: faster modern/bullet trains appear more often.
      weight: profile.trainClass === 'bullet'
        ? profile.weight + trainIntensity * 5.5
        : profile.trainClass === 'modern'
          ? profile.weight + trainIntensity * 1.6
          : profile.trainClass === 'classic'
            ? Math.max(1.2, profile.weight - trainIntensity * 1.8)
            : profile.weight + trainIntensity * 1.1
    }));
  const profile = weightedPick(random, availableProfiles);
  const carriageCount = randomInt(random, profile.carriageCountMin, profile.carriageCountMax);
  const carriageWidth = randomInt(random, profile.carriageWidthMin, profile.carriageWidthMax);
  const tenderWidth = profile.tenderWidth || 0;
  const couplerGap = profile.trainClass === 'bullet' ? 4 : 6;
  const width = profile.locomotiveWidth + tenderWidth + carriageCount * carriageWidth + (carriageCount + (tenderWidth ? 1 : 0)) * couplerGap + 24;
  const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + TRAIN_SAFE_MARGIN * 2;
  const minX = MIN_TILE * TILE_SIZE - TRAIN_SAFE_MARGIN;
  const isClassic = profile.trainClass === 'classic';
  const appliedMultiplier = isClassic ? 0.84 + Math.min(0.2, speedMultiplier - 1) : speedMultiplier;
  const speed = (profile.speedMin + random() * (profile.speedMax - profile.speedMin)) * appliedMultiplier;
  const trainCount = rowIndex > 38 && random() < 0.22 + trainIntensity * 0.2 && width < span * 0.58 ? 2 : 1;
  const offset = span / trainCount;
  const startX = minX + random() * span;
  const trains = [];

  for (let i = 0; i < trainCount; i += 1) {
    trains.push({
      id: `${rowIndex}-train-${i}`,
      type: 'train',
      kind: 'train',
      trainClass: profile.trainClass,
      x: minX + ((startX - minX + offset * i) % span),
      width,
      depth: profile.depth,
      locomotiveWidth: profile.locomotiveWidth,
      tenderWidth,
      carriageWidth,
      carriageCount,
      color: pick(random, TRAIN_PALETTE),
      trimColor: random() > 0.5 ? 0xc7ced6 : 0x394552
    });
  }

  return {
    index: rowIndex,
    type: 'rail',
    direction,
    speed,
    laneOffset,
    trains,
    blockers: new Set()
  };
}

function generateWaterRow(rowIndex, random) {
  const { speedMultiplier } = difficultyForRow(rowIndex);
  const direction = random() > 0.5 ? 1 : -1;
  const laneOffset = (random() - 0.5) * 3;
  const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + WATER_SAFE_MARGIN * 2;
  const minX = MIN_TILE * TILE_SIZE - WATER_SAFE_MARGIN;
  const count = rowIndex > 28 ? 3 : 2 + Math.floor(random() * 2);
  const spacing = span / count;
  const laneSpeed = (50 + random() * 46) * (0.85 + Math.min(0.48, speedMultiplier - 1));
  const planks = [];

  for (let i = 0; i < count; i += 1) {
    const width = randomInt(random, 84, rowIndex > 26 ? 128 : 146);
    const speed = laneSpeed * (0.94 + random() * 0.1);
    const x = minX + spacing * (i + 0.5) + (random() - 0.5) * Math.min(54, spacing * 0.18);
    planks.push({
      id: `${rowIndex}-plank-${i}`,
      type: 'plank',
      kind: 'plank',
      x,
      width,
      depth: 29,
      speed,
      baseSpeed: speed,
      color: pick(random, PLANK_PALETTE),
      rideLimitMs: 3000
    });
  }

  return {
    index: rowIndex,
    type: 'water',
    direction,
    laneOffset,
    planks,
    blockers: new Set()
  };
}

export function generateRow(rowIndex, rows) {
  if (rowIndex < STARTING_ROWS) {
    return {
      index: rowIndex,
      type: 'grass',
      blockers: new Set()
    };
  }

  const random = mulberry32(hashSeed(rowIndex, 41));

  const continuation = roadBandContinuation(rows, rowIndex);
  if (continuation) return generateTrafficRow(rowIndex, random, continuation);

  // First playable rows must feel fair for children: light traffic and trees only, no rail/water surprise.
  if (rowIndex < 9) {
    return random() < 0.34 ? generateForestRow(rowIndex, random) : generateTrafficRow(rowIndex, random);
  }

  const lastThree = previousTypes(rows, rowIndex, 3);
  const lastTwo = lastThree.slice(-2);
  const { hazardBonus, waterChance, railChance } = difficultyForRow(rowIndex);
  const hazardTypes = new Set(['traffic', 'rail', 'water']);
  const hazardStreak = lastTwo.every((type) => hazardTypes.has(type));
  const forestStreak = lastTwo.every((type) => type === 'forest');
  const waterStreak = lastTwo.every((type) => type === 'water');
  const railStreak = lastTwo.every((type) => type === 'rail');

  if (hazardStreak || waterStreak || railStreak) return generateForestRow(rowIndex, random);

  if (forestStreak) {
    const postForestRoll = random();
    if (rowIndex >= 14 && postForestRoll < waterChance) return generateWaterRow(rowIndex, random);
    if (postForestRoll < waterChance + railChance) return generateRailRow(rowIndex, random);
    return generateTrafficRow(rowIndex, random);
  }

  const roll = random();
  const forestLimit = Math.max(0.14, 0.25 - hazardBonus * 0.45);
  const waterLimit = forestLimit + waterChance;
  const railLimit = waterLimit + railChance;
  const trafficLimit = Math.min(0.94, railLimit + 0.54 + hazardBonus * 0.2);

  if (roll < forestLimit) return generateForestRow(rowIndex, random);
  if (rowIndex >= 14 && roll < waterLimit) return generateWaterRow(rowIndex, random);
  if (roll < railLimit) return generateRailRow(rowIndex, random);
  if (roll < trafficLimit) return generateTrafficRow(rowIndex, random);
  return generateForestRow(rowIndex, random);
}

export function createInitialRows(count = 48) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    rows[index] = generateRow(index, rows);
  }
  return rows;
}

export function extendRows(rows, targetRowIndex) {
  while (rows.length <= targetRowIndex) {
    const index = rows.length;
    rows[index] = generateRow(index, rows);
  }
  return rows;
}
