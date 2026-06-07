import {
  MAX_TILE,
  MIN_TILE,
  PLANK_PALETTE,
  STARTING_ROWS,
  SUPERCAR_PALETTE,
  TRAFFIC_MIN_GAP,
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

function trafficTierWeights(rowIndex) {
  if (rowIndex < 40) {
    return { slow: 12, medium: 4, fast: 1.1, super: 0.05 };
  }
  if (rowIndex < 80) {
    const t = (rowIndex - 40) / 40;
    return {
      slow: 6 - t * 3.2,
      medium: 7 + t * 1.8,
      fast: 3.2 + t * 4.4,
      super: rowIndex < 50 ? 0.35 + t * 0.55 : 0.45 + t * 0.9
    };
  }
  const t = Math.min(1, (rowIndex - 80) / 70);
  return {
    slow: 1.2,
    medium: 2.8 - t * 0.8,
    fast: 5.2 + t * 1.8,
    super: 8 + t * 7
  };
}

function vehiclePoolForRow(rowIndex) {
  const tierWeights = trafficTierWeights(rowIndex);
  return VEHICLE_VARIANTS.map((variant) => ({
    ...variant,
    weight: (variant.weight || 1) * (tierWeights[variant.tier || 'medium'] || 1)
  }));
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

function createTreeBlockers(trees) {
  // Collision follows the trunk/core tile only. The crown is decorative and must
  // not block neighbouring tiles, otherwise the player feels stopped far away
  // from the visible trunk.
  return new Set(trees);
}

function generateGrassRow(rowIndex, random = null, withDecorTrees = false) {
  const shouldDecorate = withDecorTrees || rowIndex >= 80;
  const trees = shouldDecorate && random
    ? uniqueRandomTiles(random, 2 + Math.floor(random() * 3), MIN_TILE, MAX_TILE, [-2, -1, 0, 1, 2])
    : [];

  const blockers = createTreeBlockers(trees);

  return {
    index: rowIndex,
    type: 'grass',
    trees,
    blockers
  };
}

function rowsSinceOpenGrass(rows, rowIndex) {
  for (let i = rowIndex - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (!row) continue;
    if (row.type === 'grass') return rowIndex - i;
  }
  return rowIndex;
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
    blockers: createTreeBlockers(softened)
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
  if (rowIndex >= 100) return 4;
  const roll = random();
  if (rowIndex < 10) return roll < 0.82 ? 2 : 3;
  if (rowIndex < 18) return roll < 0.64 ? 2 : 3;
  if (roll < 0.2) return 4;
  if (roll < 0.52) return 3;
  return 2;
}

function laneDirectionForBand(laneCount, laneIndex, reversed) {
  if (laneCount <= 1) return reversed ? -1 : 1;
  // Two directions within the same road block: left half one way, right half the opposite.
  const split = Math.ceil(laneCount / 2);
  const direction = laneIndex < split ? -1 : 1;
  return reversed ? -direction : direction;
}

function railBandContinuation(rows, rowIndex) {
  const previous = rows[rowIndex - 1];
  if (!previous || previous.type !== 'rail') return null;
  if (!previous.railTrackCount || previous.railTrackCount <= 1) return null;
  if (previous.railTrackIndex >= previous.railTrackCount - 1) return null;
  return {
    bandId: previous.railBandId,
    trackCount: previous.railTrackCount,
    trackIndex: previous.railTrackIndex + 1,
    reversed: previous.railReversed
  };
}


function recentTypeCount(rows, rowIndex, type, lookback) {
  let count = 0;
  for (let i = Math.max(0, rowIndex - lookback); i < rowIndex; i += 1) {
    if (rows[i]?.type === type) count += 1;
  }
  return count;
}

function shouldSoftenRailPressure(rows, rowIndex) {
  // Rows around the low 80s are usually where children already feel proud of a
  // long run. Do not let the generator stack bullet-train rows back-to-back here.
  if (rowIndex < 80 || rowIndex > 92) return false;
  return recentTypeCount(rows, rowIndex, 'rail', 4) >= 1;
}

function chooseCooldownRowAfterRail(rowIndex, random) {
  const roll = random();
  if (roll < 0.44) return generateGrassRow(rowIndex, random, true);
  if (roll < 0.74) return generateTrafficRow(rowIndex, random);
  return generateWaterRow(rowIndex, random);
}

function generateLateGameStageRow(rowIndex, random) {
  const cycle = (rowIndex - 100) % 21;
  const cycleBase = rowIndex - cycle;
  const park = () => generateGrassRow(rowIndex, random, true);
  const highway4 = (laneIndex, bandOffset = 0) => generateTrafficRow(rowIndex, random, {
    bandId: cycleBase + bandOffset,
    laneCount: 4,
    laneIndex,
    reversed: (cycleBase + bandOffset) % 2 === 0
  });
  const road2 = (laneIndex, bandOffset = 0) => generateTrafficRow(rowIndex, random, {
    bandId: cycleBase + bandOffset,
    laneCount: 2,
    laneIndex,
    reversed: (cycleBase + bandOffset) % 2 !== 0
  });
  const rail2 = (trackIndex, bandOffset = 0) => generateRailRow(rowIndex, random, {
    bandId: cycleBase + bandOffset,
    trackCount: 2,
    trackIndex,
    reversed: (cycleBase + bandOffset) % 2 === 0
  });

  switch (cycle) {
    case 0: return rail2(0, 0);
    case 1: return rail2(1, 0);
    case 2: return park();
    case 3: return highway4(0, 3);
    case 4: return highway4(1, 3);
    case 5: return highway4(2, 3);
    case 6: return highway4(3, 3);
    case 7: return park();
    case 8: return generateWaterRow(rowIndex, random);
    case 9: return road2(0, 9);
    case 10: return road2(1, 9);
    case 11: return park();
    case 12: return rail2(0, 12);
    case 13: return rail2(1, 12);
    case 14: return park();
    case 15: return generateWaterRow(rowIndex, random);
    case 16: return highway4(0, 16);
    case 17: return highway4(1, 16);
    case 18: return highway4(2, 16);
    case 19: return highway4(3, 16);
    default: return park();
  }
}

function chooseTrafficVariant(rowIndex, random, vehiclePool, chosenVariants = []) {
  const supercar = VEHICLE_VARIANTS.find((variant) => variant.kind === 'supercar');
  const superCount = chosenVariants.filter((variant) => variant.kind === 'supercar').length;
  const superLimit = rowIndex < 50
    ? 0
    : rowIndex < 80
      ? 1
      : rowIndex < 100
        ? 1
        : 2;

  if (supercar && rowIndex >= 50) {
    const chance = rowIndex < 80
      ? 0.015 + Math.min(0.04, (rowIndex - 50) * 0.0014)
      : 0.18 + Math.min(0.22, (rowIndex - 80) * 0.0035);
    if (superCount < superLimit && random() < chance) return supercar;
  }

  const usedKinds = new Set(chosenVariants.map((variant) => variant.kind));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const variant = weightedPick(random, vehiclePool);
    if (variant.kind === 'supercar' && superCount >= superLimit) continue;
    if (!usedKinds.has(variant.kind) || usedKinds.size >= Math.min(5, vehiclePool.length - 1)) return variant;
  }

  const fallbackPool = vehiclePool.filter((variant) => {
    if (variant.kind === 'supercar' && superCount >= superLimit) return false;
    return !usedKinds.has(variant.kind);
  });
  if (fallbackPool.length) return weightedPick(random, fallbackPool);

  const legalPool = vehiclePool.filter((variant) => variant.kind !== 'supercar' || superCount < superLimit);
  return weightedPick(random, legalPool.length ? legalPool : vehiclePool);
}

function generateTrafficRow(rowIndex, random, roadBand = null) {
  const { speedMultiplier } = difficultyForRow(rowIndex);
  const vehiclePool = vehiclePoolForRow(rowIndex);
  const laneCount = roadBand?.laneCount || chooseRoadLaneCount(rowIndex, random);
  const laneIndex = roadBand?.laneIndex || 0;
  const roadBandId = roadBand?.bandId ?? rowIndex;
  const reversed = roadBand?.reversed ?? random() > 0.5;
  const direction = laneCount > 1 ? laneDirectionForBand(laneCount, laneIndex, reversed) : (random() > 0.5 ? 1 : -1);
  const laneOffset = laneCount > 1 ? 0 : (random() - 0.5) * 6;
  const span = (MAX_TILE - MIN_TILE + 1) * TILE_SIZE + VEHICLE_SAFE_MARGIN * 2;
  const minX = MIN_TILE * TILE_SIZE - VEHICLE_SAFE_MARGIN;

  // Later rows get denser lanes, but spacing still prevents pile-ups.
  const highwayBonus = rowIndex >= 100 && laneCount === 4 ? 2 : 0;
  const densityBonus = laneCount > 1 && rowIndex > 18 ? 1 : 0;
  let desiredCount = 2 + Math.floor(random() * 4) + densityBonus + highwayBonus + (rowIndex > 28 && random() > 0.58 ? 1 : 0);
  if (rowIndex >= 80) desiredCount = Math.min(desiredCount, laneCount >= 4 ? 5 : 4);
  if (rowIndex >= 100 && laneCount >= 4) desiredCount = Math.min(desiredCount, random() > 0.72 ? 5 : 4);
  const vehicles = [];
  const chosenVariants = [];
  let safetyBudget = span - 140;

  for (let i = 0; i < desiredCount; i += 1) {
    const variant = chooseTrafficVariant(rowIndex, random, vehiclePool, chosenVariants);
    const minGap = Math.max(rowIndex >= 100 ? 138 : rowIndex >= 80 ? 118 : 92, variant.width * 0.86);
    if (safetyBudget - variant.width - minGap < 0 && chosenVariants.length >= 2) break;
    chosenVariants.push(variant);
    safetyBudget -= variant.width + minGap;
  }

  const count = Math.max(2, chosenVariants.length);
  const spacing = span / count;
  const laneCruiseBias = (rowIndex >= 100 && laneCount === 4 ? 1.02 : 0.86) + random() * 0.32;

  for (let i = 0; i < count; i += 1) {
    const variant = chosenVariants[i] || chooseTrafficVariant(rowIndex, random, vehiclePool, chosenVariants);
    const maxJitter = Math.min(spacing * 0.12, TILE_SIZE * 0.82);
    let x = minX + spacing * (i + 0.5) + (random() - 0.5) * maxJitter;
    const crossingGap = rowIndex >= 100 ? TILE_SIZE * 3.1 : rowIndex >= 80 ? TILE_SIZE * 2.35 : 0;
    if (crossingGap > 0 && Math.abs(x) < crossingGap) {
      const side = x >= 0 ? 1 : -1;
      x = side * (crossingGap + 18 + random() * 42);
    }
    const baseSpeed = variant.speedMin + random() * (variant.speedMax - variant.speedMin);
    const aggression = variant.tier === 'super'
      ? 0.82 + random() * 0.18
      : variant.tier === 'fast'
        ? 0.56 + random() * 0.26
        : variant.tier === 'slow'
          ? 0.12 + random() * 0.28
          : 0.34 + random() * 0.28;
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
      cruiseSpeed: speed * (0.92 + random() * 0.22),
      maxSpeed: speed * (1.1 + aggression * 0.34),
      acceleration: 18 + aggression * 82 + random() * 22,
      brakePower: 92 + aggression * 96 + random() * 35,
      aggression,
      reaction: 0.14 + random() * 0.18,
      minFollowGap: Math.max(TRAFFIC_MIN_GAP, variant.width * (0.42 + (1 - aggression) * 0.26)),
      color: variant.kind === 'supercar'
        ? pick(random, SUPERCAR_PALETTE)
        : variant.fixedColor || pick(random, VEHICLE_PALETTE),
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

function generateRailRow(rowIndex, random, railBand = null) {
  const { speedMultiplier, trainIntensity } = difficultyForRow(rowIndex);
  const trackCount = railBand?.trackCount || (rowIndex >= 100 && random() < 0.68 ? 2 : 1);
  const trackIndex = railBand?.trackIndex || 0;
  const reversed = railBand?.reversed ?? random() > 0.5;
  const direction = trackCount > 1
    ? (trackIndex % 2 === 0 ? 1 : -1) * (reversed ? -1 : 1)
    : (random() > 0.5 ? 1 : -1);
  const laneOffset = trackCount > 1 ? (trackIndex === 0 ? -5 : 5) : (random() - 0.5) * 4;
  const midGameRailRelief = rowIndex >= 78 && rowIndex <= 92;
  const availableProfiles = TRAIN_PROFILES
    .filter((profile) => !profile.unlockRow || rowIndex >= profile.unlockRow)
    .map((profile) => {
      let weight = profile.trainClass === 'bullet'
        ? profile.weight + trainIntensity * 5.5
        : profile.trainClass === 'electric'
          ? profile.weight + trainIntensity * 1.6
          : profile.trainClass === 'classic'
            ? Math.max(1.2, profile.weight - trainIntensity * 1.8)
            : profile.weight + trainIntensity * 1.1;

      // Score 80–90 was becoming a bullet-train wall. Keep rail exciting, but
      // give this stage more readable electric/freight trains instead of repeated
      // high-speed bullets.
      if (midGameRailRelief) {
        if (profile.trainClass === 'bullet') weight *= 0.18;
        if (profile.trainClass === 'electric') weight *= 1.28;
        if (profile.trainClass === 'freight') weight *= 1.2;
        if (profile.trainClass === 'classic') weight *= 1.08;
      }

      return { ...profile, weight };
    });
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
  const rawSpeed = (profile.speedMin + random() * (profile.speedMax - profile.speedMin)) * appliedMultiplier;
  const speed = midGameRailRelief && profile.trainClass === 'bullet'
    ? Math.min(rawSpeed, 780)
    : rawSpeed;
  const multiTrainChance = midGameRailRelief ? 0.04 : 0.22 + trainIntensity * 0.2;
  const trainCount = rowIndex > 38 && random() < multiTrainChance && width < span * 0.58 ? 2 : 1;
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
    railTrackCount: trackCount,
    railTrackIndex: trackIndex,
    railBandId: railBand?.bandId ?? rowIndex,
    railReversed: reversed,
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
  const count = rowIndex > 28 ? (random() > 0.62 ? 4 : 3) : 2 + Math.floor(random() * 2);
  const spacing = span / count;
  const laneSpeed = (50 + random() * 46) * (0.85 + Math.min(0.48, speedMultiplier - 1));
  const planks = [];

  for (let i = 0; i < count; i += 1) {
    const width = randomInt(random, 92, rowIndex > 26 ? 138 : 152);
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

  if (rowIndex >= 100) return generateLateGameStageRow(rowIndex, random);

  const continuation = roadBandContinuation(rows, rowIndex);
  if (continuation) return generateTrafficRow(rowIndex, random, continuation);
  const railContinuation = railBandContinuation(rows, rowIndex);
  if (railContinuation) return generateRailRow(rowIndex, random, railContinuation);

  // First playable rows must feel fair for children: light traffic and trees only, no rail/water surprise.
  if (rowIndex < 9) {
    return random() < 0.34 ? generateForestRow(rowIndex, random) : generateTrafficRow(rowIndex, random);
  }

  const lastThree = previousTypes(rows, rowIndex, 3);
  const lastTwo = lastThree.slice(-2);
  const { hazardBonus, waterChance, railChance } = difficultyForRow(rowIndex);
  const openGrassGap = rowsSinceOpenGrass(rows, rowIndex);

  // Every stage needs a real breathing row. Forest rows are scenic blockers; pure
  // grass is the reliable safe reset where players can pause and plan.
  if (openGrassGap >= 6) return generateGrassRow(rowIndex, random);

  if (rowIndex >= 80) {
    const previous = rows[rowIndex - 1]?.type;
    const roll = random();
    const railCooldown = shouldSoftenRailPressure(rows, rowIndex);

    if (railCooldown && previous !== 'rail') {
      return chooseCooldownRowAfterRail(rowIndex, random);
    }

    if (previous === 'water') {
      if (railCooldown) return roll < 0.64 ? generateTrafficRow(rowIndex, random) : generateGrassRow(rowIndex, random, true);
      return roll < 0.58 ? generateTrafficRow(rowIndex, random) : roll < 0.82 ? generateRailRow(rowIndex, random) : generateGrassRow(rowIndex, random);
    }
    if (previous === 'traffic') {
      if (railCooldown) return roll < 0.46 ? generateWaterRow(rowIndex, random) : roll < 0.74 ? generateGrassRow(rowIndex, random, true) : generateTrafficRow(rowIndex, random);
      return roll < 0.36 ? generateRailRow(rowIndex, random) : roll < 0.62 ? generateWaterRow(rowIndex, random) : generateGrassRow(rowIndex, random);
    }
    if (previous === 'rail') {
      return roll < 0.52 ? generateTrafficRow(rowIndex, random) : roll < 0.76 ? generateWaterRow(rowIndex, random) : generateGrassRow(rowIndex, random);
    }
    if (roll < 0.52) return generateTrafficRow(rowIndex, random);
    if (!railCooldown && roll < 0.76) return generateRailRow(rowIndex, random);
    if (roll < 0.9) return generateWaterRow(rowIndex, random);
    return generateGrassRow(rowIndex, random);
  }

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
