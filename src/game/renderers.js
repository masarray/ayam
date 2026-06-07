import * as THREE from 'three';
import {
  BOARD_WIDTH,
  COLORS,
  MAX_TILE,
  MIN_TILE,
  ROW_DEPTH,
  TILE_SIZE
} from './constants.js';
import { rowToY, tileToX } from './math.js';

const ENDLESS_VISUAL_WIDTH = BOARD_WIDTH + TILE_SIZE * 54;
const ENDLESS_FOUNDATION_WIDTH = BOARD_WIDTH + TILE_SIZE * 62;
const EXTENDED_TILE_MIN = MIN_TILE - 28;
const EXTENDED_TILE_MAX = MAX_TILE + 28;

export function createMaterials() {
  const make = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options });
  return {
    grass: make(COLORS.grass),
    grassAlt: make(COLORS.grassAlt),
    grassDeep: make(COLORS.grassDeep),
    grassDark: make(COLORS.grassDark),
    road: make(COLORS.road),
    roadAlt: make(COLORS.roadAlt),
    roadEdge: make(COLORS.roadEdge),
    asphaltMark: make(COLORS.asphaltMark),
    water: make(COLORS.water),
    waterAlt: make(COLORS.waterAlt),
    waterDeep: make(COLORS.waterDeep),
    waterBright: make(COLORS.waterBright, { transparent: true, opacity: 0.62, depthWrite: false }),
    waterFoam: make(COLORS.waterFoam, { transparent: true, opacity: 0.72, depthWrite: false }),
    plank: make(COLORS.plank),
    plankDark: make(COLORS.plankDark),
    plankEdge: make(COLORS.plankEdge),
    ballast: make(COLORS.ballast),
    ballastDark: make(COLORS.ballastDark),
    rail: make(COLORS.rail),
    railShadow: make(COLORS.railShadow),
    sleeper: make(COLORS.sleeper),
    chickenWhite: make(COLORS.chickenWhite),
    chickenShade: make(COLORS.chickenShade),
    chickenWing: make(COLORS.chickenWing),
    chickenComb: make(COLORS.chickenComb),
    chickenBeak: make(COLORS.chickenBeak),
    chickenLeg: make(COLORS.chickenLeg),
    featherWhite: make(COLORS.featherWhite),
    featherShade: make(COLORS.featherShade),
    featherTip: make(COLORS.featherTip),
    blood: make(COLORS.blood),
    bloodDark: make(COLORS.bloodDark),
    trunk: make(COLORS.trunk),
    tree: make(COLORS.tree),
    treeAlt: make(COLORS.treeAlt),
    wheel: make(COLORS.wheel),
    tireHub: make(COLORS.tireHub),
    window: make(COLORS.glass),
    glassDark: make(COLORS.glassDark),
    headlight: make(COLORS.headlight),
    tailLight: make(COLORS.tailLight),
    chrome: make(COLORS.chrome),
    trimLight: make(COLORS.trimLight),
    trimDark: make(COLORS.trimDark),
    white: make(COLORS.white),
    shadow: new THREE.ShadowMaterial({ opacity: 0.22 })
  };
}

export function createGeometryCache() {
  const tank = new THREE.CylinderGeometry(16, 16, 70, 12);
  tank.rotateZ(Math.PI / 2);
  const classicBoiler = new THREE.CylinderGeometry(15, 15, 58, 12);
  classicBoiler.rotateZ(Math.PI / 2);

  return {
    row: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, ROW_DEPTH, 5),
    rowWide: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, ROW_DEPTH, 5),
    roadStripe: new THREE.BoxGeometry(22, 2, 1),
    waterRipple: new THREE.BoxGeometry(26, 2, 1),
    waterWave: new THREE.BoxGeometry(54, 2.4, 1),
    waterSparkle: new THREE.BoxGeometry(9, 2, 1),
    waterEdge: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, 4, 3),
    plankBody: new THREE.BoxGeometry(72, 28, 8),
    plankCap: new THREE.BoxGeometry(5, 30, 9),
    plankStripe: new THREE.BoxGeometry(5, 24, 10),
    railBallast: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, 34, 4),
    railLine: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, 4, 4),
    railSleeper: new THREE.BoxGeometry(9, 32, 5),

    chickenBody: new THREE.BoxGeometry(18, 17, 19),
    chickenBelly: new THREE.BoxGeometry(14, 9, 13),
    chickenHead: new THREE.BoxGeometry(14, 14, 13),
    chickenBeak: new THREE.BoxGeometry(7, 8, 4),
    chickenComb: new THREE.BoxGeometry(5, 6, 7),
    chickenCombSmall: new THREE.BoxGeometry(4, 5, 5),
    chickenWattle: new THREE.BoxGeometry(5, 5, 5),
    chickenWing: new THREE.BoxGeometry(5, 13, 11),
    chickenLeg: new THREE.BoxGeometry(3.5, 3.5, 8),
    chickenFoot: new THREE.BoxGeometry(7, 5, 3),
    chickenEye: new THREE.BoxGeometry(2.2, 2.2, 2.2),

    treeTrunk: new THREE.BoxGeometry(14, 14, 26),
    treeCrown: new THREE.BoxGeometry(34, 34, 42),
    treeTop: new THREE.BoxGeometry(28, 28, 28),

    wheel: new THREE.BoxGeometry(8, 5, 8),
    wheelWide: new THREE.BoxGeometry(9, 6, 9),
    smallHub: new THREE.BoxGeometry(3, 2.4, 3),
    carBody: new THREE.BoxGeometry(60, 28, 16),
    carLongBody: new THREE.BoxGeometry(76, 30, 16),
    carCabin: new THREE.BoxGeometry(27, 22, 14),
    carCabinTall: new THREE.BoxGeometry(31, 24, 18),
    carHood: new THREE.BoxGeometry(25, 27, 9),
    carTrunk: new THREE.BoxGeometry(21, 27, 8),
    carRoof: new THREE.BoxGeometry(26, 21, 5),
    carWindshield: new THREE.BoxGeometry(4, 18, 7),
    carRearWindow: new THREE.BoxGeometry(4, 18, 7),
    carSideWindow: new THREE.BoxGeometry(15, 3, 8),
    carFrontLight: new THREE.BoxGeometry(4, 8, 4),
    carRearLight: new THREE.BoxGeometry(4, 7, 4),
    bumper: new THREE.BoxGeometry(4, 25, 5),
    grille: new THREE.BoxGeometry(3, 15, 5),
    taxiSign: new THREE.BoxGeometry(17, 10, 4),
    lightBar: new THREE.BoxGeometry(20, 9, 5),
    spoiler: new THREE.BoxGeometry(24, 5, 7),
    aeroFin: new THREE.BoxGeometry(5, 22, 7),
    pickupBed: new THREE.BoxGeometry(34, 26, 13),
    pickupRail: new THREE.BoxGeometry(34, 4, 8),
    vanBody: new THREE.BoxGeometry(86, 34, 27),
    vanRoof: new THREE.BoxGeometry(66, 30, 6),
    busBody: new THREE.BoxGeometry(118, 37, 31),
    busWindow: new THREE.BoxGeometry(12, 3, 9),
    busDoor: new THREE.BoxGeometry(3, 12, 20),
    truckTrailer: new THREE.BoxGeometry(78, 34, 29),
    truckCabin: new THREE.BoxGeometry(32, 32, 25),
    truckWindshield: new THREE.BoxGeometry(4, 22, 9),
    truckCabinRoof: new THREE.BoxGeometry(24, 26, 5),
    truckCargoTop: new THREE.BoxGeometry(62, 28, 5),
    dumpBed: new THREE.BoxGeometry(70, 34, 24),
    dumpLoad: new THREE.BoxGeometry(55, 26, 10),
    tractorHood: new THREE.BoxGeometry(34, 24, 15),
    tractorCab: new THREE.BoxGeometry(24, 24, 27),
    tanker: tank,
    container: new THREE.BoxGeometry(90, 35, 31),

    bulletLoco: new THREE.BoxGeometry(126, 36, 29),
    bulletNose: (() => {
      const geo = new THREE.ConeGeometry(18, 42, 4);
      geo.rotateZ(-Math.PI / 2);
      geo.rotateX(Math.PI / 4);
      return geo;
    })(),
    bulletRoof: new THREE.BoxGeometry(104, 29, 5),
    bulletCarriage: new THREE.BoxGeometry(112, 35, 28),
    bulletWindowStrip: new THREE.BoxGeometry(78, 3.5, 7),
    bulletStripe: new THREE.BoxGeometry(96, 3, 4),
    modernLoco: new THREE.BoxGeometry(104, 38, 31),
    modernNose: new THREE.BoxGeometry(30, 34, 23),
    modernCabinGlass: new THREE.BoxGeometry(4, 24, 11),
    modernRoof: new THREE.BoxGeometry(82, 32, 5),
    modernCarriage: new THREE.BoxGeometry(96, 36, 29),
    trainWindow: new THREE.BoxGeometry(11, 4, 9),
    trainWindowWide: new THREE.BoxGeometry(24, 4, 9),
    trainWindowStrip: new THREE.BoxGeometry(74, 4, 8),
    trainCoupler: new THREE.BoxGeometry(9, 12, 6),
    trainBogie: new THREE.BoxGeometry(24, 28, 5),
    trainWheel: new THREE.BoxGeometry(9, 6, 9),
    classicBoiler,
    classicPilot: new THREE.BoxGeometry(16, 30, 12),
    classicCabin: new THREE.BoxGeometry(30, 32, 30),
    classicTender: new THREE.BoxGeometry(54, 34, 25),
    classicChimney: new THREE.BoxGeometry(12, 12, 20),
    classicCarriage: new THREE.BoxGeometry(78, 35, 29),
    freightLoco: new THREE.BoxGeometry(100, 38, 31),
    freightLongHood: new THREE.BoxGeometry(58, 34, 24),
    freightCab: new THREE.BoxGeometry(30, 32, 29),
    freightWagon: new THREE.BoxGeometry(84, 36, 24),
    freightContainer: new THREE.BoxGeometry(76, 32, 28),

    foundation: new THREE.BoxGeometry(ENDLESS_FOUNDATION_WIDTH, TILE_SIZE * 156, 4),
    checkpoint: new THREE.BoxGeometry(32, 8, 4)
  };
}

function setupMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(group, geometry, material, x, y, z, options = {}) {
  const mesh = setupMesh(new THREE.Mesh(geometry, material));
  mesh.position.set(x, y, z);
  if (options.castShadow === false) mesh.castShadow = false;
  if (options.receiveShadow === false) mesh.receiveShadow = false;
  if (options.scale) mesh.scale.set(options.scale.x ?? 1, options.scale.y ?? 1, options.scale.z ?? 1);
  group.add(mesh);
  return mesh;
}

function dynamicMaterial(color, scalar = 1) {
  const colorValue = scalar === 1 ? new THREE.Color(color) : new THREE.Color(color).multiplyScalar(scalar);
  return new THREE.MeshLambertMaterial({ color: colorValue });
}

export function createFoundation(geometries, materials) {
  const foundation = new THREE.Mesh(geometries.foundation, materials.grassDeep);
  foundation.position.set(0, TILE_SIZE * 38, -8);
  foundation.receiveShadow = true;
  foundation.castShadow = false;
  return foundation;
}

export function createPlayer(geometries, materials) {
  const group = new THREE.Group();
  group.name = 'Chicken Player';

  // Local +Y is the chicken face/front. The engine rotates this group per move direction.
  box(group, geometries.chickenLeg, materials.chickenLeg, -5, 0, 5);
  box(group, geometries.chickenLeg, materials.chickenLeg, 5, 0, 5);
  box(group, geometries.chickenFoot, materials.chickenLeg, -5, 4, 1.8);
  box(group, geometries.chickenFoot, materials.chickenLeg, 5, 4, 1.8);

  box(group, geometries.chickenBody, materials.chickenWhite, 0, 0, 17);
  box(group, geometries.chickenBelly, materials.chickenShade, 0, 6, 15.5, { castShadow: false });
  box(group, geometries.chickenWing, materials.chickenWing, -11, -1, 16);
  box(group, geometries.chickenWing, materials.chickenWing, 11, -1, 16);

  box(group, geometries.chickenHead, materials.chickenWhite, 0, 10.5, 30.5);
  box(group, geometries.chickenBeak, materials.chickenBeak, 0, 19.3, 30.3);
  box(group, geometries.chickenWattle, materials.chickenComb, 0, 16.7, 24.3);
  box(group, geometries.chickenComb, materials.chickenComb, 0, 9.5, 40.5);
  box(group, geometries.chickenCombSmall, materials.chickenComb, -4, 8.8, 38.5);
  box(group, geometries.chickenCombSmall, materials.chickenComb, 4, 8.8, 38.5);

  const eyeMaterial = dynamicMaterial(0x111111);
  box(group, geometries.chickenEye, eyeMaterial, -4.2, 17.8, 32.6, { castShadow: false });
  box(group, geometries.chickenEye, eyeMaterial, 4.2, 17.8, 32.6, { castShadow: false });

  // Keep the character readable but no longer oversized against cars and rail.
  group.scale.setScalar(0.62);
  group.userData.facing = 'forward';
  group.userData.baseScale = 0.62;
  return group;
}

export function createTree(tileIndex, rowIndex, geometries, materials, variant = 0) {
  const group = new THREE.Group();
  group.position.set(tileToX(tileIndex, TILE_SIZE), rowToY(rowIndex, TILE_SIZE), 0);
  group.name = `Tree ${rowIndex}:${tileIndex}`;

  box(group, geometries.treeTrunk, materials.trunk, 0, 0, 13);
  box(group, geometries.treeCrown, variant % 2 ? materials.treeAlt : materials.tree, 0, 0, 42);
  if (variant % 3 === 0) box(group, geometries.treeTop, variant % 2 ? materials.tree : materials.treeAlt, 0, 0, 65);

  return group;
}

function addWheelPair(group, geometries, materials, x, z = 6, wide = false) {
  const wheelGeometry = wide ? geometries.wheelWide : geometries.wheel;
  [-1, 1].forEach((side) => {
    box(group, wheelGeometry, materials.wheel, x, side * 17, z);
    box(group, geometries.smallHub, materials.tireHub, x, side * 20.5, z, { castShadow: false });
  });
}

function addLights(group, geometries, materials, frontX, rearX, frontY = 8, rearY = 7) {
  [-frontY, frontY].forEach((y) => box(group, geometries.carFrontLight, materials.headlight, frontX, y, 13, { castShadow: false }));
  [-rearY, rearY].forEach((y) => box(group, geometries.carRearLight, materials.tailLight, rearX, y, 12, { castShadow: false }));
  box(group, geometries.grille, materials.trimDark, frontX - 1, 0, 13, { castShadow: false });
}

function addSideGlass(group, geometries, materials, xList, y = -15, z = 24) {
  xList.forEach((x) => box(group, geometries.carSideWindow, materials.glassDark, x, y, z, { castShadow: false }));
}

function createPassengerCar(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  const kind = vehicle.kind;
  const isWagon = kind === 'wagon';
  const isHatch = kind === 'hatchback';
  const body = isWagon ? geometries.carLongBody : geometries.carBody;
  const cabin = isHatch ? geometries.carCabinTall : geometries.carCabin;

  const bodyLength = isWagon ? 78 : 66;
  const frontX = isWagon ? 41 : 35;
  const rearX = isWagon ? -42 : -35;
  const cabinX = isWagon ? -7 : isHatch ? -8 : -4;

  box(group, body, bodyMaterial, 0, 0, 8.5);
  box(group, geometries.carHood, darkerBodyMaterial, isHatch ? 19 : 24, 0, 17.5, { scale: { x: isHatch ? 0.58 : 0.88, y: 0.98, z: 0.62 } });
  if (!isHatch) box(group, geometries.carTrunk, darkerBodyMaterial, isWagon ? -31 : -24, 0, 17, { scale: { x: isWagon ? 1.05 : 0.78, y: 0.98, z: 0.62 } });

  // Cabin uses body color; dark glass is applied as flush thin panels on the sides/front/rear.
  box(group, cabin, darkerBodyMaterial, cabinX, 0, isHatch ? 22.5 : 22, { scale: { x: isWagon ? 1.34 : 1, y: 1, z: 0.92 } });
  box(group, geometries.carRoof, bodyMaterial, cabinX, 0, isHatch ? 33.5 : 32, { scale: { x: isWagon ? 1.22 : 1, y: 1, z: 1 }, castShadow: false });

  box(group, geometries.carWindshield, materials.glassDark, isWagon ? 18 : 13, 0, 24, { scale: { x: 0.8, y: 1.05, z: 1.1 }, castShadow: false });
  box(group, geometries.carRearWindow, materials.glassDark, isWagon ? -31 : -20, 0, 23.5, { scale: { x: 0.8, y: 1.05, z: 1.05 }, castShadow: false });
  addSideGlass(group, geometries, materials, isWagon ? [-24, -7, 10] : [-12, 4], -15, 24.5);
  addSideGlass(group, geometries, materials, isWagon ? [-24, -7, 10] : [-12, 4], 15, 24.5);

  if (kind === 'taxi') {
    box(group, geometries.taxiSign, materials.headlight, -6, 0, 35, { castShadow: false });
  }

  const frontWheelX = isWagon ? 27 : 21;
  const rearWheelX = isWagon ? -28 : -22;
  addWheelPair(group, geometries, materials, rearWheelX, 5);
  addWheelPair(group, geometries, materials, frontWheelX, 5);
  addLights(group, geometries, materials, frontX, rearX);
  box(group, geometries.bumper, materials.chrome, frontX + 2, 0, 7, { castShadow: false });
  box(group, geometries.bumper, materials.chrome, rearX - 2, 0, 7, { castShadow: false });
  box(group, geometries.roadStripe, materials.trimLight, 0, 0, 19.5, { scale: { x: bodyLength / 44, y: 0.42, z: 0.5 }, castShadow: false });
}

function createSportsCar(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  const isSuper = vehicle.kind === 'supercar';
  if (isSuper) {
    const black = dynamicMaterial(0x07090d);
    const darkTrim = dynamicMaterial(0x111820);
    const wheelAccent = dynamicMaterial(0xf06f16);
    const bright = dynamicMaterial(0xfff7d4);
    const whiteStripe = dynamicMaterial(0xffffff);

    // Dedicated low, long supercar silhouette: pointed nose, black glass canopy,
    // side intakes, splitter, rear diffuser, and wide performance wheels.
    box(group, geometries.carLongBody, bodyMaterial, 0, 0, 6.4, { scale: { x: 1.24, y: 1.18, z: 0.62 } });
    box(group, geometries.carHood, bodyMaterial, 34, 0, 12.4, { scale: { x: 1.04, y: 1.12, z: 0.42 } });
    box(group, geometries.carHood, bodyMaterial, 49, 0, 9.8, { scale: { x: 0.52, y: 0.98, z: 0.28 } });
    box(group, geometries.carTrunk, bodyMaterial, -36, 0, 12.2, { scale: { x: 1.05, y: 1.12, z: 0.42 } });
    box(group, geometries.carCabin, black, -4, 0, 20.6, { scale: { x: 1.18, y: 1.02, z: 0.58 }, castShadow: false });
    box(group, geometries.carRoof, black, -11, 0, 26.4, { scale: { x: 1.22, y: 1.04, z: 0.42 }, castShadow: false });
    box(group, geometries.truckWindshield, black, 22, 0, 20.8, { scale: { x: 1.25, y: 1.18, z: 0.82 }, castShadow: false });
    box(group, geometries.carRearWindow, black, -35, 0, 20.2, { scale: { x: 1.15, y: 1.08, z: 0.72 }, castShadow: false });

    [-1, 1].forEach((side) => {
      box(group, geometries.busWindow, black, -10, side * 20.2, 17.2, { scale: { x: 1.45, y: 0.42, z: 0.64 }, castShadow: false });
      box(group, geometries.roadStripe, darkTrim, -1, side * 20.8, 10.6, { scale: { x: 1.95, y: 0.95, z: 1.18 }, castShadow: false });
      box(group, geometries.roadStripe, whiteStripe, -4, side * 21.8, 6.4, { scale: { x: 2.15, y: 0.42, z: 0.58 }, castShadow: false });
      box(group, geometries.carFrontLight, bright, 49, side * 10.6, 13.8, { scale: { x: 1.25, y: 0.62, z: 0.68 }, castShadow: false });
      box(group, geometries.carRearLight, materials.tailLight, -51, side * 11, 13, { scale: { x: 1.08, y: 0.7, z: 0.72 }, castShadow: false });
    });

    box(group, geometries.bumper, black, 55, 0, 6, { scale: { x: 1.1, y: 1.28, z: 0.6 }, castShadow: false });
    box(group, geometries.roadStripe, black, 49, 0, 5.2, { scale: { x: 1.7, y: 1.35, z: 0.8 }, castShadow: false });
    box(group, geometries.bumper, black, -55, 0, 6.2, { scale: { x: 1.05, y: 1.25, z: 0.62 }, castShadow: false });
    box(group, geometries.spoiler, black, -45, 0, 20.4, { scale: { x: 1.55, y: 1.18, z: 0.62 }, castShadow: false });
    box(group, geometries.aeroFin, black, -45, -18.6, 16, { scale: { x: 0.85, y: 0.55, z: 1.08 }, castShadow: false });
    box(group, geometries.aeroFin, black, -45, 18.6, 16, { scale: { x: 0.85, y: 0.55, z: 1.08 }, castShadow: false });

    [42, 31, 20].forEach((x, index) => {
      box(group, geometries.roadStripe, darkerBodyMaterial, x, 0, 16.2 + index * 0.9, { scale: { x: 0.7 + index * 0.22, y: 1.05 - index * 0.12, z: 0.4 }, castShadow: false });
    });
    [-26, -36, -46].forEach((x, index) => {
      box(group, geometries.roadStripe, darkerBodyMaterial, x, 0, 16 + index * 0.7, { scale: { x: 0.72, y: 1.02 - index * 0.14, z: 0.36 }, castShadow: false });
    });

    [-31, 31].forEach((x) => {
      addWheelPair(group, geometries, materials, x, 5, true);
      box(group, geometries.smallHub, wheelAccent, x, -21.4, 5.2, { scale: { x: 1.2, y: 0.7, z: 1.2 }, castShadow: false });
      box(group, geometries.smallHub, wheelAccent, x, 21.4, 5.2, { scale: { x: 1.2, y: 0.7, z: 1.2 }, castShadow: false });
    });
    return;
  }

  const accent = dynamicMaterial(isSuper ? 0x48d8ff : vehicle.trimColor || 0xd4d9df);
  box(group, geometries.carLongBody, bodyMaterial, 0, 0, 7.2, { scale: { x: isSuper ? 0.96 : 0.88, y: 1.06, z: 0.72 } });
  box(group, geometries.carHood, darkerBodyMaterial, 25, 0, 14.6, { scale: { x: 0.86, y: 1.04, z: 0.45 } });
  box(group, geometries.carTrunk, darkerBodyMaterial, -25, 0, 14, { scale: { x: 0.78, y: 1.04, z: 0.38 } });
  box(group, geometries.carCabin, materials.glassDark, -4, 0, 20.5, { scale: { x: 0.78, y: 0.9, z: 0.66 }, castShadow: false });
  box(group, geometries.carRoof, darkerBodyMaterial, -4, 0, 26.3, { scale: { x: 0.82, y: 0.86, z: 0.45 }, castShadow: false });
  box(group, geometries.spoiler, accent, -33, 0, 19, { scale: { x: isSuper ? 1.28 : 1, y: 1, z: 1 }, castShadow: false });
  if (isSuper) {
    box(group, geometries.aeroFin, accent, 2, -18, 12.5, { castShadow: false });
    box(group, geometries.aeroFin, accent, 2, 18, 12.5, { castShadow: false });
  }
  addWheelPair(group, geometries, materials, -25, 5, isSuper);
  addWheelPair(group, geometries, materials, 25, 5, isSuper);
  addLights(group, geometries, materials, 42, -42, 10, 8);
  box(group, geometries.roadStripe, accent, 2, 0, 17.8, { scale: { x: 1.65, y: 0.36, z: 0.45 }, castShadow: false });
}

function createPoliceCar(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  createPassengerCar(group, { ...vehicle, kind: 'sedan' }, geometries, materials, bodyMaterial, darkerBodyMaterial);
  const blue = dynamicMaterial(0x2f7fd8);
  box(group, geometries.lightBar, blue, -5, -4.5, 35.5, { scale: { x: 0.55, y: 0.5, z: 1 }, castShadow: false });
  box(group, geometries.lightBar, materials.tailLight, -5, 4.5, 35.5, { scale: { x: 0.55, y: 0.5, z: 1 }, castShadow: false });
  box(group, geometries.roadStripe, blue, 0, -16, 20.8, { scale: { x: 1.35, y: 0.7, z: 0.7 }, castShadow: false });
  box(group, geometries.roadStripe, blue, 0, 16, 20.8, { scale: { x: 1.35, y: 0.7, z: 0.7 }, castShadow: false });
}

function createPickup(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  box(group, geometries.carBody, bodyMaterial, 4, 0, 8.5, { scale: { x: 0.76, y: 1.08, z: 0.92 } });
  box(group, geometries.carHood, darkerBodyMaterial, 35, 0, 18, { scale: { x: 0.72, y: 1.02, z: 0.72 } });
  box(group, geometries.carCabinTall, darkerBodyMaterial, 17, 0, 23);
  box(group, geometries.carRoof, bodyMaterial, 17, 0, 34, { castShadow: false });
  box(group, geometries.pickupBed, darkerBodyMaterial, -22, 0, 13);
  box(group, geometries.pickupRail, bodyMaterial, -22, -15, 23);
  box(group, geometries.pickupRail, bodyMaterial, -22, 15, 23);
  box(group, geometries.carWindshield, materials.glassDark, 34, 0, 24, { castShadow: false });
  box(group, geometries.carRearWindow, materials.glassDark, 1, 0, 24, { castShadow: false });
  addSideGlass(group, geometries, materials, [18], -16, 24.5);
  addSideGlass(group, geometries, materials, [18], 16, 24.5);
  addWheelPair(group, geometries, materials, -28, 5);
  addWheelPair(group, geometries, materials, 28, 5);
  addLights(group, geometries, materials, 44, -44);
  box(group, geometries.bumper, materials.chrome, 46, 0, 7, { castShadow: false });
}

function createAmbulance(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  createVan(group, vehicle, geometries, materials, bodyMaterial);
  const red = dynamicMaterial(0xd92d34);
  const blue = dynamicMaterial(0x2f7fd8);
  box(group, geometries.lightBar, red, 22, 0, 36.5, { castShadow: false });
  box(group, geometries.roadStripe, red, -9, -19.2, 20.5, { scale: { x: 2.4, y: 0.7, z: 1 }, castShadow: false });
  box(group, geometries.roadStripe, blue, -9, 19.2, 20.5, { scale: { x: 2.4, y: 0.7, z: 1 }, castShadow: false });
  box(group, geometries.carRearLight, red, -28, -19.5, 25, { scale: { x: 1, y: 0.5, z: 2.4 }, castShadow: false });
  box(group, geometries.carRearLight, red, -28, 19.5, 25, { scale: { x: 1, y: 0.5, z: 2.4 }, castShadow: false });
}

function createVan(group, vehicle, geometries, materials, bodyMaterial) {
  box(group, geometries.vanBody, bodyMaterial, 0, 0, 13.5);
  box(group, geometries.vanRoof, materials.trimLight, -5, 0, 30.5, { castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 45, 0, 24, { castShadow: false });
  [-24, -6, 12, 30].forEach((x) => box(group, geometries.busWindow, materials.glassDark, x, -18.2, 24, { castShadow: false }));
  [-24, -6, 12, 30].forEach((x) => box(group, geometries.busWindow, materials.glassDark, x, 18.2, 24, { castShadow: false }));
  box(group, geometries.busDoor, materials.trimDark, 20, -18.5, 16, { castShadow: false });
  addWheelPair(group, geometries, materials, -31, 6, true);
  addWheelPair(group, geometries, materials, 31, 6, true);
  addLights(group, geometries, materials, 46, -46, 10, 8);
  box(group, geometries.bumper, materials.chrome, 48, 0, 8, { castShadow: false });
}

function createBus(group, vehicle, geometries, materials, bodyMaterial) {
  box(group, geometries.busBody, bodyMaterial, 0, 0, 15.5);
  box(group, geometries.modernRoof, materials.trimLight, 0, 0, 34, { scale: { x: 1.22, y: 1.05, z: 0.7 }, castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 61, 0, 26, { castShadow: false });
  [-42, -24, -6, 12, 30].forEach((x) => box(group, geometries.busWindow, materials.glassDark, x, -20.2, 27, { castShadow: false }));
  [-42, -24, -6, 12, 30].forEach((x) => box(group, geometries.busWindow, materials.glassDark, x, 20.2, 27, { castShadow: false }));
  box(group, geometries.busDoor, materials.trimDark, 42, -20.5, 17, { castShadow: false });
  box(group, geometries.roadStripe, materials.glassDark, -8, -20.5, 29, { scale: { x: 2.7, y: 0.7, z: 1 }, castShadow: false });
  box(group, geometries.roadStripe, materials.glassDark, -8, 20.5, 29, { scale: { x: 2.7, y: 0.7, z: 1 }, castShadow: false });
  [-43, 0, 43].forEach((x) => addWheelPair(group, geometries, materials, x, 6, true));
  addLights(group, geometries, materials, 63, -63, 10, 8);
}

function createDumpTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  box(group, geometries.dumpBed, bodyMaterial, -28, 0, 16.5, { scale: { x: 1, y: 1, z: 1.08 } });
  box(group, geometries.dumpLoad, materials.railShadow, -32, 0, 34, { castShadow: false });
  box(group, geometries.truckCabin, darkerBodyMaterial, 42, 0, 12.5);
  box(group, geometries.truckCabinRoof, bodyMaterial, 39, 0, 28, { castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 60, 0, 26, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 34, -17.2, 24, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 34, 17.2, 24, { castShadow: false });
  [-50, -18, 42].forEach((x) => addWheelPair(group, geometries, materials, x, 6, true));
  addLights(group, geometries, materials, 61, -66, 10, 8);
}

function createTractor(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  box(group, geometries.tractorHood, bodyMaterial, 18, 0, 13);
  box(group, geometries.tractorCab, darkerBodyMaterial, -13, 0, 22);
  box(group, geometries.trainWindow, materials.glassDark, -13, -14, 28, { castShadow: false });
  box(group, geometries.trainWindow, materials.glassDark, -13, 14, 28, { castShadow: false });
  box(group, geometries.carWindshield, materials.glassDark, 33, 0, 20, { scale: { x: 0.8, y: 0.9, z: 0.9 }, castShadow: false });
  box(group, geometries.carRearLight, materials.trimDark, 2, 0, 35, { scale: { x: 0.55, y: 0.55, z: 3.2 }, castShadow: false });
  addWheelPair(group, geometries, materials, -22, 7, true);
  addWheelPair(group, geometries, materials, 25, 5);
  addLights(group, geometries, materials, 38, -36, 8, 7);
}

function createBoxTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  box(group, geometries.truckTrailer, bodyMaterial, -22, 0, 14.5);
  box(group, geometries.truckCargoTop, materials.trimLight, -22, 0, 31, { castShadow: false });
  box(group, geometries.truckCabin, darkerBodyMaterial, 43, 0, 12.5);
  box(group, geometries.truckCabinRoof, bodyMaterial, 40, 0, 28, { castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 60, 0, 26, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 35, -17.2, 24, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 35, 17.2, 24, { castShadow: false });
  [-50, -12, 44].forEach((x) => addWheelPair(group, geometries, materials, x, 6, true));
  addLights(group, geometries, materials, 61, -62, 10, 8);
}

function createArticulatedTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  box(group, geometries.truckCabin, darkerBodyMaterial, 68, 0, 12.5);
  box(group, geometries.truckCabinRoof, bodyMaterial, 65, 0, 28, { castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 86, 0, 26, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 59, -17.2, 24, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 59, 17.2, 24, { castShadow: false });
  box(group, geometries.truckTrailer, bodyMaterial, 12, 0, 15, { scale: { x: 0.9, y: 1, z: 1 } });
  box(group, geometries.truckTrailer, bodyMaterial, -68, 0, 15, { scale: { x: 0.9, y: 1, z: 1 } });
  box(group, geometries.truckCargoTop, materials.trimLight, 12, 0, 31, { scale: { x: 0.9, y: 1, z: 1 }, castShadow: false });
  box(group, geometries.truckCargoTop, materials.trimLight, -68, 0, 31, { scale: { x: 0.9, y: 1, z: 1 }, castShadow: false });
  box(group, geometries.trainCoupler, materials.railShadow, -29, 0, 10, { scale: { x: 1.4, y: 1.2, z: 0.8 }, castShadow: false });
  box(group, geometries.trainCoupler, materials.railShadow, 38, 0, 10, { scale: { x: 1.2, y: 1.1, z: 0.8 }, castShadow: false });
  [-96, -56, -14, 27, 70].forEach((x) => addWheelPair(group, geometries, materials, x, 6, true));
  addLights(group, geometries, materials, 87, -108, 10, 8);
}

function createTankerTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  const tank = setupMesh(new THREE.Mesh(geometries.tanker, bodyMaterial));
  tank.position.set(-27, 0, 18);
  group.add(tank);
  box(group, geometries.truckCabin, darkerBodyMaterial, 46, 0, 12.5);
  box(group, geometries.truckCabinRoof, bodyMaterial, 43, 0, 28, { castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 64, 0, 26, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 38, -17.2, 24, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 38, 17.2, 24, { castShadow: false });
  box(group, geometries.carRearLight, materials.chrome, -64, 0, 18, { scale: { x: 0.8, y: 2.2, z: 1.2 }, castShadow: false });
  [-57, -17, 47].forEach((x) => addWheelPair(group, geometries, materials, x, 6, true));
  addLights(group, geometries, materials, 65, -72, 10, 8);
}

function createContainerTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  box(group, geometries.container, bodyMaterial, -31, 0, 15.5);
  for (let x = -64; x <= 2; x += 20) {
    box(group, geometries.carRearLight, darkerBodyMaterial, x, -18.4, 17, { scale: { x: 0.4, y: 0.55, z: 4 }, castShadow: false });
    box(group, geometries.carRearLight, darkerBodyMaterial, x, 18.4, 17, { scale: { x: 0.4, y: 0.55, z: 4 }, castShadow: false });
  }
  box(group, geometries.truckCabin, darkerBodyMaterial, 52, 0, 12.5);
  box(group, geometries.truckCabinRoof, bodyMaterial, 49, 0, 28, { castShadow: false });
  box(group, geometries.truckWindshield, materials.glassDark, 70, 0, 26, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 43, -17.2, 24, { castShadow: false });
  box(group, geometries.busWindow, materials.glassDark, 43, 17.2, 24, { castShadow: false });
  [-70, -28, 15, 54].forEach((x) => addWheelPair(group, geometries, materials, x, 6, true));
  addLights(group, geometries, materials, 71, -80, 10, 8);
}

export function createVehicle(vehicle, row, geometries, materials) {
  const group = new THREE.Group();
  group.name = `${vehicle.kind} ${vehicle.id}`;
  group.position.set(vehicle.x, rowToY(row.index, TILE_SIZE) + row.laneOffset, 0);

  // Every vehicle is modeled with its front facing local +X.
  // When the lane direction is -X, rotate the whole group so headlights and cabin always lead.
  group.rotation.z = row.direction >= 0 ? 0 : Math.PI;
  group.userData = {
    rowIndex: row.index,
    direction: row.direction,
    speed: vehicle.speed,
    baseSpeed: vehicle.baseSpeed || vehicle.speed,
    cruiseSpeed: vehicle.cruiseSpeed || vehicle.speed,
    maxSpeed: vehicle.maxSpeed || vehicle.speed * 1.16,
    acceleration: vehicle.acceleration || 44,
    brakePower: vehicle.brakePower || 118,
    aggression: vehicle.aggression || 0.35,
    reaction: vehicle.reaction || 0.2,
    minFollowGap: vehicle.minFollowGap || 42,
    currentSpeed: vehicle.speed * (0.92 + (vehicle.aggression || 0.35) * 0.12),
    width: vehicle.width,
    depth: vehicle.depth,
    type: vehicle.type,
    kind: vehicle.kind
  };

  const bodyMaterial = dynamicMaterial(vehicle.color);
  const darkerBodyMaterial = dynamicMaterial(vehicle.color, 0.82);

  switch (vehicle.kind) {
    case 'sports':
    case 'supercar':
      createSportsCar(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'police':
      createPoliceCar(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'ambulance':
      createAmbulance(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'pickup':
      createPickup(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'van':
      createVan(group, vehicle, geometries, materials, bodyMaterial);
      break;
    case 'bus':
      createBus(group, vehicle, geometries, materials, bodyMaterial);
      break;
    case 'boxTruck':
      createBoxTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'articulatedTruck':
      createArticulatedTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'dumpTruck':
      createDumpTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'tractor':
      createTractor(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'tankerTruck':
      createTankerTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    case 'containerTruck':
      createContainerTruck(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
    default:
      createPassengerCar(group, vehicle, geometries, materials, bodyMaterial, darkerBodyMaterial);
      break;
  }

  return group;
}

function addTrainBogie(group, geometries, materials, centerX, bodyLength, yOffset = 20) {
  const spread = Math.max(18, bodyLength * 0.34);
  [centerX - spread, centerX + spread].forEach((x) => {
    box(group, geometries.trainBogie, materials.railShadow, x, 0, 5, { castShadow: false });
    [-1, 1].forEach((side) => box(group, geometries.trainWheel, materials.wheel, x, side * yOffset, 6));
  });
}

function addTrainWindows(group, geometries, materials, centerX, count, spacing, y = -20, z = 28) {
  const start = centerX - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i += 1) {
    box(group, geometries.trainWindow, materials.glassDark, start + i * spacing, y, z, { castShadow: false });
  }
}

function addCoupler(group, geometries, materials, x) {
  box(group, geometries.trainCoupler, materials.railShadow, x, 0, 8, { castShadow: false });
}


function createBulletTrain(group, train, geometries, materials, bodyMaterial, accentMaterial) {
  const headLength = Math.max(136, train.locomotiveWidth);
  const carLength = train.carriageWidth;
  const frontX = train.width / 2 - 10;
  const rearX = -train.width / 2 + 10;
  const noseOffset = 30;

  function addBulletHead(anchorX, isFront) {
    const dir = isFront ? 1 : -1;
    const centerX = anchorX - dir * (headLength * 0.34);

    box(group, geometries.bulletLoco, bodyMaterial, centerX, 0, 14.8, { scale: { x: headLength / 126, y: 1, z: 1 } });
    box(group, geometries.bulletRoof, materials.trimLight, centerX - dir * 8, 0, 31.6, { scale: { x: headLength / 126, y: 1, z: 0.52 }, castShadow: false });
    box(group, geometries.bulletWindowStrip, materials.glassDark, centerX - dir * 2, -18.8, 26.2, { scale: { x: headLength / 134, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.bulletWindowStrip, materials.glassDark, centerX - dir * 2, 18.8, 26.2, { scale: { x: headLength / 134, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.bulletStripe, accentMaterial, centerX - dir * 1, -20.6, 20.5, { scale: { x: headLength / 102, y: 1, z: 0.75 }, castShadow: false });
    box(group, geometries.bulletStripe, accentMaterial, centerX - dir * 1, 20.6, 20.5, { scale: { x: headLength / 102, y: 1, z: 0.75 }, castShadow: false });

    const nose = setupMesh(new THREE.Mesh(geometries.bulletNose, accentMaterial));
    nose.position.set(anchorX + dir * noseOffset, 0, 16);
    if (!isFront) nose.rotation.z = Math.PI;
    group.add(nose);

    // Cockpit glass wedge, inspired by modern high-speed trains with pointed nose at both ends.
    box(group, geometries.truckWindshield, materials.glassDark, anchorX + dir * 12, 0, 24.5, { scale: { x: 0.78, y: 0.88, z: 0.9 }, castShadow: false });
    box(group, geometries.carFrontLight, isFront ? materials.headlight : materials.tailLight, anchorX + dir * 24, -9, 17.8, { scale: { x: 0.9, y: 0.76, z: 0.95 }, castShadow: false });
    box(group, geometries.carFrontLight, isFront ? materials.headlight : materials.tailLight, anchorX + dir * 24, 9, 17.8, { scale: { x: 0.9, y: 0.76, z: 0.95 }, castShadow: false });
    addTrainBogie(group, geometries, materials, centerX, headLength, 19);

    return { centerX };
  }

  const frontHead = addBulletHead(frontX, true);
  let cursor = frontHead.centerX - headLength / 2 - 8;
  for (let i = 0; i < train.carriageCount; i += 1) {
    cursor -= carLength / 2;
    box(group, geometries.bulletCarriage, bodyMaterial, cursor, 0, 14.5, { scale: { x: carLength / 112, y: 1, z: 1 } });
    box(group, geometries.bulletWindowStrip, materials.glassDark, cursor, -19.5, 26.8, { scale: { x: carLength / 112, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.bulletWindowStrip, materials.glassDark, cursor, 19.5, 26.8, { scale: { x: carLength / 112, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.bulletStripe, accentMaterial, cursor, -20.8, 20.8, { scale: { x: carLength / 98, y: 1, z: 0.74 }, castShadow: false });
    box(group, geometries.bulletStripe, accentMaterial, cursor, 20.8, 20.8, { scale: { x: carLength / 98, y: 1, z: 0.74 }, castShadow: false });
    box(group, geometries.bulletRoof, materials.trimLight, cursor, 0, 31.7, { scale: { x: carLength / 126, y: 1, z: 0.46 }, castShadow: false });
    addTrainBogie(group, geometries, materials, cursor, carLength, 19);
    addCoupler(group, geometries, materials, cursor + carLength / 2 + 3);
    cursor -= carLength / 2 + 8;
  }

  addBulletHead(rearX, false);
}
function createModernTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  const cabLength = Math.max(108, train.locomotiveWidth);
  const carLength = train.carriageWidth;
  const frontX = train.width / 2 - 14;
  const rearX = -train.width / 2 + 14;
  const electricAccent = dynamicMaterial(0x37c6d8);

  function addPantograph(centerX, width = 28) {
    box(group, geometries.roadStripe, materials.trimDark, centerX, -6, 38.5, { scale: { x: width / 22, y: 0.55, z: 1.4 }, castShadow: false });
    box(group, geometries.roadStripe, materials.trimDark, centerX, 6, 38.5, { scale: { x: width / 22, y: 0.55, z: 1.4 }, castShadow: false });
    box(group, geometries.roadStripe, electricAccent, centerX, 0, 43, { scale: { x: 0.32, y: 3.1, z: 1.2 }, castShadow: false });
  }

  function addCommuterCab(anchorX, isFront) {
    const dir = isFront ? 1 : -1;
    const centerX = anchorX - dir * (cabLength * 0.3);
    box(group, geometries.modernLoco, bodyMaterial, centerX, 0, 15.2, { scale: { x: cabLength / 104, y: 1, z: 1 } });
    box(group, geometries.modernRoof, materials.trimLight, centerX - dir * 2, 0, 33.2, { scale: { x: cabLength / 104, y: 1, z: 0.92 }, castShadow: false });

    // Front face and destination-panel feel, like commuter/metro train with symmetrical cab ends.
    box(group, geometries.modernNose, darkerBodyMaterial, anchorX - dir * 10, 0, 15.5, { scale: { x: 0.96, y: 1.04, z: 1.14 } });
    box(group, geometries.truckWindshield, materials.glassDark, anchorX + dir * 1, 0, 28.5, { scale: { x: 0.78, y: 1.35, z: 1.15 }, castShadow: false });
    box(group, geometries.roadStripe, darkerBodyMaterial, anchorX + dir * 2, 0, 8.2, { scale: { x: 1.1, y: 8.7, z: 1.2 }, castShadow: false });
    box(group, geometries.bulletStripe, electricAccent, centerX - dir * 4, -20.8, 21, { scale: { x: cabLength / 98, y: 1, z: 0.72 }, castShadow: false });
    box(group, geometries.bulletStripe, electricAccent, centerX - dir * 4, 20.8, 21, { scale: { x: cabLength / 98, y: 1, z: 0.72 }, castShadow: false });
    box(group, geometries.carFrontLight, isFront ? materials.headlight : materials.tailLight, anchorX + dir * 7, -12, 18.4, { castShadow: false });
    box(group, geometries.carFrontLight, isFront ? materials.headlight : materials.tailLight, anchorX + dir * 7, 12, 18.4, { castShadow: false });
    addTrainWindows(group, geometries, materials, centerX - dir * 10, 3, 17.5, -20.2, 27.2);
    addTrainWindows(group, geometries, materials, centerX - dir * 10, 3, 17.5, 20.2, 27.2);
    addTrainBogie(group, geometries, materials, centerX, cabLength, 20);
    return centerX;
  }

  const frontCenter = addCommuterCab(frontX, true);
  let cursor = frontCenter - cabLength / 2 - 8;
  for (let i = 0; i < train.carriageCount; i += 1) {
    cursor -= carLength / 2;
    const material = i % 2 ? darkerBodyMaterial : bodyMaterial;
    box(group, geometries.modernCarriage, material, cursor, 0, 14.5, { scale: { x: carLength / 96, y: 1, z: 1 } });
    box(group, geometries.trainWindowStrip, materials.glassDark, cursor, -20, 27, { scale: { x: carLength / 96, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.trainWindowStrip, materials.glassDark, cursor, 20, 27, { scale: { x: carLength / 96, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.modernRoof, materials.trimLight, cursor, 0, 32, { scale: { x: carLength / 104, y: 1, z: 0.55 }, castShadow: false });
    box(group, geometries.bulletStripe, electricAccent, cursor, -20.8, 21, { scale: { x: carLength / 96, y: 1, z: 0.72 }, castShadow: false });
    box(group, geometries.bulletStripe, electricAccent, cursor, 20.8, 21, { scale: { x: carLength / 96, y: 1, z: 0.72 }, castShadow: false });
    if (i % 2 === 0) addPantograph(cursor, 24);
    addTrainBogie(group, geometries, materials, cursor, carLength, 20);
    addCoupler(group, geometries, materials, cursor + carLength / 2 + 4);
    cursor -= carLength / 2 + 8;
  }
  addCommuterCab(rearX, false);
}
function createClassicTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  const locoLength = train.locomotiveWidth;
  const tenderLength = train.tenderWidth || 54;
  const carLength = train.carriageWidth;
  const frontX = train.width / 2 - 18;
  const locoCenter = frontX - locoLength / 2;

  // Steam locomotive head at the front only.
  const boiler = setupMesh(new THREE.Mesh(geometries.classicBoiler, bodyMaterial));
  boiler.position.set(locoCenter + 10, 0, 22);
  group.add(boiler);
  box(group, geometries.classicPilot, darkerBodyMaterial, frontX - 8, 0, 11, { castShadow: false, scale: { x: 1.1, y: 1.02, z: 1 } });
  box(group, geometries.classicCabin, darkerBodyMaterial, locoCenter - 28, 0, 23);
  box(group, geometries.trainWindow, materials.glassDark, locoCenter - 28, -18, 30, { castShadow: false });
  box(group, geometries.trainWindow, materials.glassDark, locoCenter - 28, 18, 30, { castShadow: false });
  box(group, geometries.classicChimney, materials.trimDark, locoCenter + 24, 0, 42);
  box(group, geometries.carFrontLight, materials.headlight, frontX - 1, 0, 21, { scale: { x: 1, y: 1.3, z: 1 }, castShadow: false });
  addTrainBogie(group, geometries, materials, locoCenter, locoLength, 20);

  let cursor = locoCenter - locoLength / 2 - 8;
  cursor -= tenderLength / 2;
  box(group, geometries.classicTender, darkerBodyMaterial, cursor, 0, 13.5);
  box(group, geometries.roadStripe, bodyMaterial, cursor, 0, 28, { scale: { x: 1.5, y: 7, z: 2 }, castShadow: false });
  addTrainBogie(group, geometries, materials, cursor, tenderLength, 20);
  addCoupler(group, geometries, materials, cursor + tenderLength / 2 + 4);
  cursor -= tenderLength / 2 + 8;

  // Rear is made of passenger carriages, not another locomotive head.
  for (let i = 0; i < train.carriageCount; i += 1) {
    cursor -= carLength / 2;
    const material = i % 2 ? darkerBodyMaterial : bodyMaterial;
    box(group, geometries.classicCarriage, material, cursor, 0, 14.5, { scale: { x: carLength / 78, y: 1, z: 1 } });
    addTrainWindows(group, geometries, materials, cursor, 3, 18, -19.5, 27);
    addTrainWindows(group, geometries, materials, cursor, 3, 18, 19.5, 27);
    // Carriage rear cap so the tail reads as passenger carriage instead of a duplicate front.
    if (i === train.carriageCount - 1) {
      const tailX = cursor - carLength / 2 + 4;
      box(group, geometries.classicCabin, material, tailX, 0, 18, { scale: { x: 0.24, y: 1.04, z: 0.76 } });
      box(group, geometries.trainWindowWide, materials.glassDark, tailX - 1, 0, 28.5, { scale: { x: 0.42, y: 1.12, z: 0.9 }, castShadow: false });
      box(group, geometries.carRearLight, materials.tailLight, tailX - 5, -10, 17, { castShadow: false });
      box(group, geometries.carRearLight, materials.tailLight, tailX - 5, 10, 17, { castShadow: false });
    }
    addTrainBogie(group, geometries, materials, cursor, carLength, 20);
    addCoupler(group, geometries, materials, cursor + carLength / 2 + 4);
    cursor -= carLength / 2 + 8;
  }
}
function createFreightTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial) {
  const locoLength = train.locomotiveWidth;
  const carLength = train.carriageWidth;
  let frontX = train.width / 2 - 16;
  let locoCenter = frontX - locoLength / 2;

  box(group, geometries.freightLoco, bodyMaterial, locoCenter, 0, 15.5, { scale: { x: locoLength / 100, y: 1, z: 1 } });
  box(group, geometries.freightLongHood, darkerBodyMaterial, locoCenter + 16, 0, 28, { castShadow: true });
  box(group, geometries.freightCab, darkerBodyMaterial, locoCenter - 34, 0, 32);
  box(group, geometries.trainWindow, materials.glassDark, locoCenter - 34, -17.5, 34, { castShadow: false });
  box(group, geometries.trainWindow, materials.glassDark, locoCenter - 34, 17.5, 34, { castShadow: false });
  box(group, geometries.modernCabinGlass, materials.glassDark, frontX - 4, 0, 28, { castShadow: false });
  box(group, geometries.carFrontLight, materials.headlight, frontX + 2, -9, 18, { castShadow: false });
  box(group, geometries.carFrontLight, materials.headlight, frontX + 2, 9, 18, { castShadow: false });
  addTrainBogie(group, geometries, materials, locoCenter, locoLength, 20.5);

  let cursor = locoCenter - locoLength / 2 - 8;
  for (let i = 0; i < train.carriageCount; i += 1) {
    cursor -= carLength / 2;
    const material = i % 2 ? darkerBodyMaterial : bodyMaterial;
    box(group, geometries.freightWagon, materials.railShadow, cursor, 0, 10, { scale: { x: carLength / 84, y: 1, z: 1 } });
    box(group, geometries.freightContainer, material, cursor, 0, 24, { scale: { x: carLength / 84, y: 1, z: 1 } });
    box(group, geometries.roadStripe, materials.trimLight, cursor, -18, 39, { scale: { x: carLength / 40, y: 1, z: 1 }, castShadow: false });
    box(group, geometries.roadStripe, materials.trimLight, cursor, 18, 39, { scale: { x: carLength / 40, y: 1, z: 1 }, castShadow: false });
    addTrainBogie(group, geometries, materials, cursor, carLength, 20.5);
    addCoupler(group, geometries, materials, cursor + carLength / 2 + 4);
    cursor -= carLength / 2 + 8;
  }
}


export function createPlank(plank, row, geometries, materials) {
  const group = new THREE.Group();
  group.name = `plank ${plank.id}`;
  group.position.set(plank.x, rowToY(row.index, TILE_SIZE) + row.laneOffset, 0);
  group.userData = {
    rowIndex: row.index,
    direction: row.direction,
    speed: plank.speed,
    baseSpeed: plank.baseSpeed || plank.speed,
    currentSpeed: plank.speed,
    width: plank.width,
    depth: plank.depth,
    type: 'plank',
    kind: 'plank'
  };

  const bodyMaterial = dynamicMaterial(plank.color);
  const darkerMaterial = dynamicMaterial(plank.color, 0.72);
  box(group, geometries.plankBody, bodyMaterial, 0, 0, 6, { scale: { x: plank.width / 72, y: 1, z: 1 } });
  box(group, geometries.plankCap, darkerMaterial, plank.width / 2 - 3, 0, 7, { castShadow: false });
  box(group, geometries.plankCap, darkerMaterial, -plank.width / 2 + 3, 0, 7, { castShadow: false });
  const stripes = Math.max(2, Math.floor(plank.width / 32));
  for (let i = 1; i < stripes; i += 1) {
    const x = -plank.width / 2 + (plank.width / stripes) * i;
    box(group, geometries.plankStripe, materials.plankEdge, x, 0, 11, { castShadow: false });
  }
  return group;
}

export function createTrain(train, row, geometries, materials) {
  const group = new THREE.Group();
  group.name = `${train.trainClass || 'train'} ${train.id}`;
  group.position.set(train.x, rowToY(row.index, TILE_SIZE) + row.laneOffset, 0);
  group.rotation.z = row.direction >= 0 ? 0 : Math.PI;
  group.userData = {
    rowIndex: row.index,
    direction: row.direction,
    speed: row.speed,
    baseSpeed: row.speed,
    currentSpeed: row.speed,
    width: train.width,
    depth: train.depth,
    type: 'train',
    kind: 'train',
    trainClass: train.trainClass || 'modern'
  };

  const bodyMaterial = train.trainClass === 'bullet' ? dynamicMaterial(0xf4f0e8) : dynamicMaterial(train.color);
  const darkerBodyMaterial = train.trainClass === 'bullet' ? dynamicMaterial(0xd92d34) : dynamicMaterial(train.color, 0.76);

  if (train.trainClass === 'bullet') {
    createBulletTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  } else if (train.trainClass === 'classic') {
    createClassicTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  } else if (train.trainClass === 'freight') {
    createFreightTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  } else {
    createModernTrain(group, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  }

  return group;
}

export function createRoadStripe(tileIndex, rowIndex, geometries, material) {
  const stripe = new THREE.Mesh(geometries.roadStripe, material);
  stripe.position.set(tileToX(tileIndex, TILE_SIZE), rowToY(rowIndex, TILE_SIZE), 1.4);
  stripe.castShadow = false;
  stripe.receiveShadow = false;
  return stripe;
}


function createWaterSurface(row, geometries, materials) {
  const rowIndex = row.index;
  const direction = row.direction || 1;
  const group = new THREE.Group();
  group.name = `Water surface ${rowIndex}`;
  const y = rowToY(rowIndex, TILE_SIZE);

  const deepBand = new THREE.Mesh(geometries.rowWide, materials.waterDeep);
  deepBand.position.set(0, y, -1.2);
  deepBand.userData.waterFlowBaseY = y;
  deepBand.scale.set(1, 0.78, 1);
  deepBand.castShadow = false;
  deepBand.receiveShadow = true;
  group.add(deepBand);

  const topEdge = new THREE.Mesh(geometries.waterEdge, materials.waterFoam);
  topEdge.position.set(0, y + ROW_DEPTH / 2 - 2, 2.3);
  topEdge.castShadow = false;
  topEdge.receiveShadow = false;
  group.add(topEdge);

  const bottomEdge = topEdge.clone();
  bottomEdge.position.y = y - ROW_DEPTH / 2 + 2;
  group.add(bottomEdge);

  for (let tile = EXTENDED_TILE_MIN; tile <= EXTENDED_TILE_MAX; tile += 2) {
    const phase = (rowIndex * 17 + tile * 11) % 7;
    const wave = new THREE.Mesh(phase % 3 === 0 ? geometries.waterWave : geometries.waterRipple, phase % 2 ? materials.waterBright : materials.waterFoam);
    wave.position.set(tileToX(tile, TILE_SIZE) + (phase - 3) * 3, y + ((phase % 5) - 2) * 4, 2.8 + (phase % 2) * 0.4);
    wave.userData.waterFlow = {
      baseX: wave.position.x,
      baseY: wave.position.y,
      direction,
      speed: direction * (18 + (phase % 5) * 7),
      phase: phase * 1.37,
      amp: 1.6 + (phase % 3) * 0.9,
      rate: 2.4 + (phase % 4) * 0.34,
      wrap: BOARD_WIDTH * 0.62
    };
    wave.castShadow = false;
    wave.receiveShadow = false;
    wave.rotation.z = (phase - 3) * 0.035;
    wave.scale.x = 0.75 + (phase % 4) * 0.18;
    group.add(wave);
  }

  for (let tile = EXTENDED_TILE_MIN; tile <= EXTENDED_TILE_MAX; tile += 4) {
    const sparkle = new THREE.Mesh(geometries.waterSparkle, materials.waterFoam);
    sparkle.position.set(tileToX(tile, TILE_SIZE) + ((rowIndex + tile) % 3) * 8, y + (((rowIndex + tile) % 5) - 2) * 5, 3.2);
    sparkle.userData.waterFlow = {
      baseX: sparkle.position.x,
      baseY: sparkle.position.y,
      direction,
      speed: direction * (26 + ((rowIndex + tile) % 4) * 8),
      phase: (rowIndex + tile) * 0.7,
      amp: 1.2,
      rate: 3.1,
      wrap: BOARD_WIDTH * 0.62
    };
    sparkle.castShadow = false;
    sparkle.receiveShadow = false;
    sparkle.rotation.z = ((rowIndex + tile) % 4) * 0.4;
    group.add(sparkle);
  }
  return group;
}

function createRailTrack(rowIndex, geometries, materials) {
  const group = new THREE.Group();
  const y = rowToY(rowIndex, TILE_SIZE);

  const ballast = new THREE.Mesh(geometries.railBallast, materials.ballastDark);
  ballast.position.set(0, y, 0.2);
  ballast.receiveShadow = true;
  group.add(ballast);

  for (let tile = EXTENDED_TILE_MIN; tile <= EXTENDED_TILE_MAX; tile += 1) {
    const sleeper = new THREE.Mesh(geometries.railSleeper, materials.sleeper);
    sleeper.position.set(tileToX(tile, TILE_SIZE), y, 3.5);
    sleeper.receiveShadow = true;
    sleeper.castShadow = false;
    group.add(sleeper);
  }

  [-10, 10].forEach((offset) => {
    const railShadow = new THREE.Mesh(geometries.railLine, materials.railShadow);
    railShadow.position.set(0, y + offset + 2, 6.4);
    railShadow.receiveShadow = false;
    railShadow.castShadow = false;
    group.add(railShadow);

    const rail = new THREE.Mesh(geometries.railLine, materials.rail);
    rail.position.set(0, y + offset, 8.2);
    rail.receiveShadow = false;
    rail.castShadow = false;
    group.add(rail);
  });

  return group;
}

export function createRowGroup(row, geometries, materials) {
  const group = new THREE.Group();
  group.name = `Row ${row.index} ${row.type}`;
  const y = rowToY(row.index, TILE_SIZE);
  const isTraffic = row.type === 'traffic';
  const isRail = row.type === 'rail';
  const isWater = row.type === 'water';
  const rowMaterial = isTraffic
    ? (row.index % 2 ? materials.road : materials.roadAlt)
    : isWater
      ? (row.index % 2 ? materials.water : materials.waterAlt)
      : (row.index % 2 ? materials.grass : materials.grassAlt);

  const base = new THREE.Mesh(isTraffic ? geometries.row : geometries.rowWide, rowMaterial);
  base.position.set(0, y, -2.5);
  base.receiveShadow = true;
  group.add(base);

  if (isTraffic) {
    const hasRoadBand = row.roadLaneCount && row.roadLaneCount > 1;
    const isFirstLane = !hasRoadBand || row.roadLaneIndex === 0;
    const isLastLane = !hasRoadBand || row.roadLaneIndex === row.roadLaneCount - 1;

    const makeEdge = (edgeY, material = materials.roadEdge, thickness = 0.08, z = 0.1) => {
      const edge = new THREE.Mesh(geometries.row, material);
      edge.scale.set(1, thickness, 1);
      edge.position.set(0, edgeY, z);
      edge.receiveShadow = false;
      edge.castShadow = false;
      group.add(edge);
      return edge;
    };

    if (isLastLane) makeEdge(y + ROW_DEPTH / 2 - 2);
    else makeEdge(y + ROW_DEPTH / 2 - 1, materials.asphaltMark, 0.025, 1.2);

    if (isFirstLane) makeEdge(y - ROW_DEPTH / 2 + 2);

    // Dashed lane markers along the driving direction. Consecutive traffic rows read as 3-lane/4-lane roads.
    for (let tile = EXTENDED_TILE_MIN; tile <= EXTENDED_TILE_MAX; tile += 3) {
      group.add(createRoadStripe(tile, row.index, geometries, materials.asphaltMark));
    }
  }

  if (isRail) {
    group.add(createRailTrack(row.index, geometries, materials));
  }

  if (isWater) {
    group.add(createWaterSurface(row, geometries, materials));
  }

  if (row.type === 'forest') {
    row.trees.forEach((tile, index) => group.add(createTree(tile, row.index, geometries, materials, index + row.index)));
  }

  // Subtle progress marker every five safe rows. The question modal can be hooked externally.
  if (row.index > 0 && row.index % 5 === 0 && !isTraffic && !isRail && !isWater) {
    const checkpoint = new THREE.Mesh(geometries.checkpoint, new THREE.MeshLambertMaterial({ color: 0xf5d36d }));
    checkpoint.position.set(0, y, 1.5);
    checkpoint.receiveShadow = true;
    group.add(checkpoint);
  }

  return group;
}

export function applyRendererQuality(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(COLORS.sky, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
