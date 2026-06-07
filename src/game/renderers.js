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

const RAIL_HEAD_Y_OFFSET = 17.4;
const RAIL_HEAD_CENTER_Z = 5.6;
const RAIL_HEAD_HEIGHT = 3.4;
const RAIL_HEAD_TOP_Z = RAIL_HEAD_CENTER_Z + RAIL_HEAD_HEIGHT / 2;
const TRAIN_WHEEL_HALF_Z = 5.4;
const TRAIN_WHEEL_CENTER_Z = RAIL_HEAD_TOP_Z + TRAIN_WHEEL_HALF_Z;
const TRAIN_BOGIE_CENTER_Z = TRAIN_WHEEL_CENTER_Z - 1.05;
const TRAIN_UNDERCARRIAGE_Z = TRAIN_WHEEL_CENTER_Z - 0.65;
const TRAIN_BODY_LIFT_Z = 18.8;
const ROAD_WHITE_LINE_WIDTH = 0.58;
const ROAD_EDGE_WHITE_LINE_WIDTH = 0.68;
const ROAD_YELLOW_LINE_WIDTH = 0.58;
const ROAD_DASH_SCALE_Y = 0.54;
const ROAD_MARK_Z = 0.28;
const ROAD_EDGE_MARK_Z = 0.36;
const ROAD_YELLOW_MARK_Z = 0.30;
const ROAD_EDGE_LINE_INSET = 4.25;
const ROAD_EDGE_SHOULDER_INSET = 1.65;

export function createMaterials() {
  const make = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options });
  const makeRoadMark = (color, options = {}) => new THREE.MeshBasicMaterial({
    color,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    ...options
  });
  return {
    grass: make(COLORS.grass),
    grassAlt: make(COLORS.grassAlt),
    grassDeep: make(COLORS.grassDeep),
    grassDark: make(COLORS.grassDark),
    road: make(COLORS.road),
    roadAlt: make(COLORS.roadAlt),
    roadEdge: make(COLORS.roadEdge),
    asphaltMark: makeRoadMark(COLORS.asphaltMark),
    asphaltYellow: makeRoadMark(COLORS.asphaltYellow),
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
    roadDashMark: new THREE.PlaneGeometry(22, 2),
    roadLineLong: new THREE.PlaneGeometry(ENDLESS_VISUAL_WIDTH, 1),
    roadEdgeLineLong: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, ROAD_EDGE_WHITE_LINE_WIDTH, 0.08),
    roadShoulderLong: new THREE.PlaneGeometry(ENDLESS_VISUAL_WIDTH, 1),
    waterRipple: new THREE.BoxGeometry(26, 2, 1),
    waterWave: new THREE.BoxGeometry(54, 2.4, 1),
    waterSparkle: new THREE.BoxGeometry(9, 2, 1),
    waterEdge: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, 4, 3),
    plankBody: new THREE.BoxGeometry(72, 28, 8),
    plankCap: new THREE.BoxGeometry(5, 30, 9),
    plankStripe: new THREE.BoxGeometry(5, 24, 10),
    railBallast: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, 34, 4),
    railLine: new THREE.BoxGeometry(ENDLESS_VISUAL_WIDTH, 3.6, RAIL_HEAD_HEIGHT),
    railSleeper: new THREE.BoxGeometry(9, 32, 3.2),

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
    chickenEyeCute: new THREE.BoxGeometry(3.6, 2.4, 3.6),
    chickenCheek: new THREE.BoxGeometry(3.8, 2, 3),
    chickenTail: new THREE.BoxGeometry(5, 9, 8),

    treeTrunk: new THREE.BoxGeometry(14, 14, 26),
    treeTrunkTop: new THREE.BoxGeometry(11, 11, 20),
    treeCrown: new THREE.BoxGeometry(34, 34, 42),
    treeTop: new THREE.BoxGeometry(28, 28, 28),
    treeCrownSmall: new THREE.BoxGeometry(24, 24, 24),

    wheel: new THREE.BoxGeometry(9.5, 6, 9.5),
    wheelWide: new THREE.BoxGeometry(11, 7, 11),
    smallHub: new THREE.BoxGeometry(3.6, 2.8, 3.6),
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
    sideIntake: new THREE.BoxGeometry(24, 3, 8),
    sideSkirt: new THREE.BoxGeometry(46, 3, 4),
    wheelArch: new THREE.BoxGeometry(15, 3, 10),
    mirror: new THREE.BoxGeometry(4, 5, 5),
    licensePlate: new THREE.BoxGeometry(2, 12, 5),
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
    trainWheel: new THREE.BoxGeometry(10.8, 6.8, 10.8),
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
  const eyeMaterial = dynamicMaterial(0x101217);
  const cheekMaterial = dynamicMaterial(0xf2b8a8);

  // Local +Y is the chicken face/front. The engine rotates this group per move direction.
  box(group, geometries.chickenLeg, materials.chickenLeg, -5, 0, 5);
  box(group, geometries.chickenLeg, materials.chickenLeg, 5, 0, 5);
  box(group, geometries.chickenFoot, materials.chickenLeg, -5, 4, 1.8);
  box(group, geometries.chickenFoot, materials.chickenLeg, 5, 4, 1.8);

  box(group, geometries.chickenBody, materials.chickenWhite, 0, 0, 17);
  box(group, geometries.chickenBelly, materials.chickenShade, 0, 6, 15.5, { castShadow: false });
  box(group, geometries.chickenWing, materials.chickenWing, -11, 0, 16, { scale: { x: 1, y: 1.15, z: 1.05 } });
  box(group, geometries.chickenWing, materials.chickenWing, 11, 0, 16, { scale: { x: 1, y: 1.15, z: 1.05 } });
  box(group, geometries.chickenTail, materials.chickenWing, -6, -12, 22, { scale: { x: 0.9, y: 0.9, z: 1.15 } });
  box(group, geometries.chickenTail, materials.chickenWing, 0, -13.5, 24, { scale: { x: 1, y: 0.8, z: 1.25 } });
  box(group, geometries.chickenTail, materials.chickenWing, 6, -12, 22, { scale: { x: 0.9, y: 0.9, z: 1.15 } });

  box(group, geometries.chickenHead, materials.chickenWhite, 0, 10.5, 31, { scale: { x: 1.12, y: 1.1, z: 1.08 } });
  box(group, geometries.chickenBelly, materials.chickenShade, 0, 18, 31, { scale: { x: 0.52, y: 0.34, z: 0.52 }, castShadow: false });
  box(group, geometries.chickenBeak, materials.chickenBeak, 0, 19.3, 30.3);
  box(group, geometries.chickenWattle, materials.chickenComb, 0, 16.7, 24.3);
  box(group, geometries.chickenComb, materials.chickenComb, 0, 9.5, 40.5);
  box(group, geometries.chickenCombSmall, materials.chickenComb, -4, 8.8, 38.5);
  box(group, geometries.chickenCombSmall, materials.chickenComb, 4, 8.8, 38.5);

  box(group, geometries.chickenEyeCute, eyeMaterial, -4.6, 18.1, 33.4, { castShadow: false });
  box(group, geometries.chickenEyeCute, eyeMaterial, 4.6, 18.1, 33.4, { castShadow: false });
  box(group, geometries.chickenEye, materials.white, -5.2, 19.4, 34.3, { scale: { x: 0.55, y: 0.45, z: 0.55 }, castShadow: false });
  box(group, geometries.chickenEye, materials.white, 4, 19.4, 34.3, { scale: { x: 0.55, y: 0.45, z: 0.55 }, castShadow: false });
  box(group, geometries.chickenCheek, cheekMaterial, -6.4, 18.9, 28.8, { castShadow: false });
  box(group, geometries.chickenCheek, cheekMaterial, 6.4, 18.9, 28.8, { castShadow: false });

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
  const fruitMaterial = dynamicMaterial(variant % 2 ? 0xf1c84b : 0xe76f51);
  const leafA = variant % 2 ? materials.treeAlt : materials.tree;
  const leafB = variant % 2 ? materials.tree : materials.treeAlt;

  box(group, geometries.treeTrunk, materials.trunk, 0, 0, 13);
  box(group, geometries.treeTrunkTop, materials.trunk, variant % 2 ? 3 : -3, 1, 33, { scale: { x: 0.9, y: 0.86, z: 1 } });
  box(group, geometries.treeCrown, leafA, 0, 0, 48, { scale: { x: 1.05, y: 1.02, z: 0.9 } });
  box(group, geometries.treeTop, leafB, -10, -4, 63, { scale: { x: 1.04, y: 0.96, z: 0.86 } });
  box(group, geometries.treeTop, leafA, 10, 6, 61, { scale: { x: 0.92, y: 0.88, z: 0.78 } });
  box(group, geometries.treeCrownSmall, leafB, 0, 1, 77, { scale: { x: 0.88, y: 0.84, z: 0.74 } });
  if (variant % 3 === 0) {
    box(group, geometries.chickenEye, fruitMaterial, -12, 12, 55, { scale: { x: 1.4, y: 1.4, z: 1.4 }, castShadow: false });
    box(group, geometries.chickenEye, fruitMaterial, 13, -10, 66, { scale: { x: 1.25, y: 1.25, z: 1.25 }, castShadow: false });
  }

  return group;
}

function addWheelPair(group, geometries, materials, x, z = 6, wide = false) {
  const wheelGeometry = wide ? geometries.wheelWide : geometries.wheel;
  const wheelZ = z + (wide ? 0.75 : 0.35);
  const tireY = wide ? 17.4 : 17;
  const hubY = wide ? 21.2 : 20.7;
  [-1, 1].forEach((side) => {
    box(group, wheelGeometry, materials.wheel, x, side * tireY, wheelZ);
    box(group, geometries.smallHub, materials.tireHub, x, side * hubY, wheelZ, { castShadow: false });
  });
}

function addWheelArchPair(group, geometries, material, x, y = 17, z = 10) {
  [-1, 1].forEach((side) => {
    box(group, geometries.wheelArch, material, x, side * y, z, { castShadow: false });
  });
}

function addVehicleGrounding(group, vehicle, geometries, materials) {
  const trim = dynamicMaterial(0x111820);
  const widthScale = Math.max(1.35, vehicle.width / 44);
  const depthScale = Math.max(5.4, vehicle.depth / 6);
  box(group, geometries.roadStripe, trim, 0, 0, 4.2, { scale: { x: widthScale, y: depthScale, z: 1.22 }, castShadow: false });
  box(group, geometries.licensePlate, materials.trimLight, vehicle.width * 0.5 + 1, 0, 10.8, { castShadow: false });
}

function addMirrors(group, geometries, material, x = 22, y = 18, z = 24) {
  box(group, geometries.mirror, material, x, -y, z, { castShadow: false });
  box(group, geometries.mirror, material, x, y, z, { castShadow: false });
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
  addWheelArchPair(group, geometries, darkerBodyMaterial, rearWheelX);
  addWheelArchPair(group, geometries, darkerBodyMaterial, frontWheelX);
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
      addWheelArchPair(group, geometries, bodyMaterial, x, 18.6, 9.6);
      box(group, geometries.smallHub, wheelAccent, x, -21.4, 6.0, { scale: { x: 1.2, y: 0.7, z: 1.2 }, castShadow: false });
      box(group, geometries.smallHub, wheelAccent, x, 21.4, 6.0, { scale: { x: 1.2, y: 0.7, z: 1.2 }, castShadow: false });
    });
    group.scale.set(0.82, 0.9, 0.92);
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
  addWheelArchPair(group, geometries, darkerBodyMaterial, -25);
  addWheelArchPair(group, geometries, darkerBodyMaterial, 25);
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
  addWheelArchPair(group, geometries, darkerBodyMaterial, -28);
  addWheelArchPair(group, geometries, darkerBodyMaterial, 28);
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
  addWheelArchPair(group, geometries, bodyMaterial, -31, 18.2, 11);
  addWheelArchPair(group, geometries, bodyMaterial, 31, 18.2, 11);
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
  [-43, 0, 43].forEach((x) => addWheelArchPair(group, geometries, bodyMaterial, x, 20.2, 12));
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

  addVehicleGrounding(group, vehicle, geometries, materials);
  if (!['bus', 'boxTruck', 'dumpTruck', 'tankerTruck', 'containerTruck', 'articulatedTruck'].includes(vehicle.kind)) {
    addMirrors(group, geometries, materials.trimDark, Math.min(vehicle.width * 0.28, 34), Math.max(16, vehicle.depth * 0.52), 23);
  }

  return group;
}

function addTrainBogie(group, geometries, materials, centerX, bodyLength, yOffset = RAIL_HEAD_Y_OFFSET) {
  const gearGroup = group.userData?.trainGearGroup || group;
  const spread = Math.max(18, bodyLength * 0.34);
  box(gearGroup, geometries.roadStripe, materials.railShadow, centerX, 0, TRAIN_UNDERCARRIAGE_Z, { scale: { x: Math.max(1.2, bodyLength / 32), y: 10.4, z: 1.15 }, castShadow: false });
  [centerX - spread, centerX + spread].forEach((x) => {
    box(gearGroup, geometries.trainBogie, materials.railShadow, x, 0, TRAIN_BOGIE_CENTER_Z, { scale: { x: 1, y: 1.18, z: 1 }, castShadow: false });
    [-1, 1].forEach((side) => {
      box(gearGroup, geometries.trainWheel, materials.wheel, x, side * yOffset, TRAIN_WHEEL_CENTER_Z);
      box(gearGroup, geometries.smallHub, materials.tireHub, x, side * (yOffset + 3.4), TRAIN_WHEEL_CENTER_Z, { castShadow: false });
    });
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
    box(group, geometries.sideSkirt, materials.railShadow, centerX - dir * 8, -20.8, 9.5, { scale: { x: headLength / 62, y: 1, z: 0.8 }, castShadow: false });
    box(group, geometries.sideSkirt, materials.railShadow, centerX - dir * 8, 20.8, 9.5, { scale: { x: headLength / 62, y: 1, z: 0.8 }, castShadow: false });

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
    box(group, geometries.sideSkirt, materials.railShadow, cursor, -20.8, 9.2, { scale: { x: carLength / 58, y: 1, z: 0.72 }, castShadow: false });
    box(group, geometries.sideSkirt, materials.railShadow, cursor, 20.8, 9.2, { scale: { x: carLength / 58, y: 1, z: 0.72 }, castShadow: false });
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
    box(group, geometries.bulletStripe, electricAccent, centerX - dir * 4, -21.35, 21.25, { scale: { x: cabLength / 98, y: 0.82, z: 0.68 }, castShadow: false, receiveShadow: false });
    box(group, geometries.bulletStripe, electricAccent, centerX - dir * 4, 21.35, 21.25, { scale: { x: cabLength / 98, y: 0.82, z: 0.68 }, castShadow: false, receiveShadow: false });
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
    box(group, geometries.bulletStripe, electricAccent, cursor, -21.35, 21.25, { scale: { x: carLength / 96, y: 0.82, z: 0.68 }, castShadow: false, receiveShadow: false });
    box(group, geometries.bulletStripe, electricAccent, cursor, 21.35, 21.25, { scale: { x: carLength / 96, y: 0.82, z: 0.68 }, castShadow: false, receiveShadow: false });
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
  const highlightMaterial = dynamicMaterial(plank.color, 1.14);
  box(group, geometries.plankBody, bodyMaterial, 0, -9, 6, { scale: { x: plank.width / 72, y: 0.31, z: 0.92 } });
  box(group, geometries.plankBody, highlightMaterial, 0, 0, 6.4, { scale: { x: plank.width / 72, y: 0.32, z: 0.96 } });
  box(group, geometries.plankBody, bodyMaterial, 0, 9, 6, { scale: { x: plank.width / 72, y: 0.31, z: 0.9 } });
  box(group, geometries.roadStripe, darkerMaterial, 0, -15, 8.6, { scale: { x: plank.width / 22, y: 0.7, z: 1.1 }, castShadow: false });
  box(group, geometries.roadStripe, darkerMaterial, 0, 15, 8.6, { scale: { x: plank.width / 22, y: 0.7, z: 1.1 }, castShadow: false });
  box(group, geometries.plankCap, darkerMaterial, plank.width / 2 - 3, 0, 8, { castShadow: false });
  box(group, geometries.plankCap, darkerMaterial, -plank.width / 2 + 3, 0, 8, { castShadow: false });
  const stripes = Math.max(3, Math.floor(plank.width / 30));
  for (let i = 1; i < stripes; i += 1) {
    const x = -plank.width / 2 + (plank.width / stripes) * i;
    box(group, geometries.plankStripe, materials.plankEdge, x, 0, 11, { scale: { x: 0.65, y: 0.92, z: 0.75 }, castShadow: false });
  }
  for (let i = 0; i < 3; i += 1) {
    const x = -plank.width * 0.28 + i * plank.width * 0.28;
    box(group, geometries.roadStripe, darkerMaterial, x, i % 2 ? -7 : 7, 11.4, { scale: { x: 0.68, y: 0.35, z: 0.55 }, castShadow: false });
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

  const gearGroup = new THREE.Group();
  gearGroup.name = `${group.name} rail gear`;
  const bodyGroup = new THREE.Group();
  bodyGroup.name = `${group.name} raised body`;
  bodyGroup.userData.trainGearGroup = gearGroup;

  if (train.trainClass === 'bullet') {
    createBulletTrain(bodyGroup, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  } else if (train.trainClass === 'classic') {
    createClassicTrain(bodyGroup, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  } else if (train.trainClass === 'freight') {
    createFreightTrain(bodyGroup, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  } else {
    createModernTrain(bodyGroup, train, geometries, materials, bodyMaterial, darkerBodyMaterial);
  }

  bodyGroup.position.z = TRAIN_BODY_LIFT_Z;
  group.add(gearGroup, bodyGroup);

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
    sleeper.position.set(tileToX(tile, TILE_SIZE), y, 2.6);
    sleeper.receiveShadow = true;
    sleeper.castShadow = false;
    group.add(sleeper);
  }

  [-RAIL_HEAD_Y_OFFSET, RAIL_HEAD_Y_OFFSET].forEach((offset) => {
    const railShadow = new THREE.Mesh(geometries.railLine, materials.railShadow);
    railShadow.position.set(0, y + offset + 1.6, RAIL_HEAD_CENTER_Z - 1.0);
    railShadow.receiveShadow = false;
    railShadow.castShadow = false;
    group.add(railShadow);

    const rail = new THREE.Mesh(geometries.railLine, materials.rail);
    rail.position.set(0, y + offset, RAIL_HEAD_CENTER_Z);
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

    const makeEdge = (edgeY, material = materials.roadEdge, thickness = 0.08, z = 0.08) => {
      // Keep the dark shoulder flat. The old raised voxel strip could visually fight with
      // the adjacent white edge line when the camera moved at an isometric angle.
      const edge = new THREE.Mesh(geometries.roadShoulderLong, material);
      edge.scale.set(1, thickness * ROW_DEPTH, 1);
      edge.position.set(0, edgeY, z);
      edge.receiveShadow = false;
      edge.castShadow = false;
      edge.renderOrder = 4;
      group.add(edge);
      return edge;
    };

    const makeRoadLine = (lineY, material, width, z = ROAD_MARK_Z) => {
      const line = new THREE.Mesh(geometries.roadLineLong, material);
      line.scale.set(1, width, 1);
      line.position.set(0, lineY, z);
      line.receiveShadow = false;
      line.castShadow = false;
      line.renderOrder = 10;
      group.add(line);
      return line;
    };

    const makeRoadEdgeLine = (lineY) => {
      // Continuous edge lines are the most visible shimmer candidate. A very shallow
      // raised cuboid gives the GPU a stable depth footprint while still reading as
      // a slim road paint stripe from the camera angle.
      const line = new THREE.Mesh(geometries.roadEdgeLineLong, materials.asphaltMark);
      line.position.set(0, lineY, ROAD_EDGE_MARK_Z);
      line.receiveShadow = false;
      line.castShadow = false;
      line.renderOrder = 11;
      group.add(line);
      return line;
    };

    const makeRoadDash = (tile, edgeY, material = materials.asphaltMark, z = ROAD_MARK_Z) => {
      const stripe = new THREE.Mesh(geometries.roadDashMark, material);
      stripe.position.set(tileToX(tile, TILE_SIZE), edgeY, z);
      stripe.scale.set(0.86, ROAD_DASH_SCALE_Y, 1);
      stripe.castShadow = false;
      stripe.receiveShadow = false;
      stripe.renderOrder = 8;
      group.add(stripe);
    };

    if (!hasRoadBand) {
      makeEdge(y - ROW_DEPTH / 2 + ROAD_EDGE_SHOULDER_INSET, materials.roadEdge, 0.085, 0.08);
      makeEdge(y + ROW_DEPTH / 2 - ROAD_EDGE_SHOULDER_INSET, materials.roadEdge, 0.085, 0.08);
      makeRoadEdgeLine(y - ROW_DEPTH / 2 + ROAD_EDGE_LINE_INSET);
      makeRoadEdgeLine(y + ROW_DEPTH / 2 - ROAD_EDGE_LINE_INSET);
    } else {
      if (isFirstLane) {
        makeEdge(y - ROW_DEPTH / 2 + ROAD_EDGE_SHOULDER_INSET, materials.roadEdge, 0.085, 0.08);
        makeRoadEdgeLine(y - ROW_DEPTH / 2 + ROAD_EDGE_LINE_INSET);
      }

      if (isLastLane) {
        makeEdge(y + ROW_DEPTH / 2 - ROAD_EDGE_SHOULDER_INSET, materials.roadEdge, 0.085, 0.08);
        makeRoadEdgeLine(y + ROW_DEPTH / 2 - ROAD_EDGE_LINE_INSET);
      }

      if (row.roadLaneCount === 2 && !isLastLane) {
        const centerY = y + ROW_DEPTH / 2;
        for (let tile = EXTENDED_TILE_MIN; tile <= EXTENDED_TILE_MAX; tile += 3) {
          makeRoadDash(tile, centerY, materials.asphaltMark);
        }
      }

      const nextLaneDirection = row.roadLaneIndex < row.roadLaneCount - 1
        ? (row.roadLaneIndex + 1 < Math.ceil(row.roadLaneCount / 2) ? -1 : 1) * (row.roadReversed ? -1 : 1)
        : row.direction;
      const separatesOpposingTraffic = row.roadLaneCount >= 3 && !isLastLane && nextLaneDirection !== row.direction;
      if (separatesOpposingTraffic) {
        const yellowGap = 3.5;
        makeRoadLine(y + ROW_DEPTH / 2 - yellowGap, materials.asphaltYellow, ROAD_YELLOW_LINE_WIDTH, ROAD_YELLOW_MARK_Z);
        makeRoadLine(y + ROW_DEPTH / 2 + yellowGap, materials.asphaltYellow, ROAD_YELLOW_LINE_WIDTH, ROAD_YELLOW_MARK_Z);
      } else if (!isLastLane && row.roadLaneCount !== 2) {
        for (let tile = EXTENDED_TILE_MIN; tile <= EXTENDED_TILE_MAX; tile += 3) {
          makeRoadDash(tile, y + ROW_DEPTH / 2 - 1, materials.asphaltMark);
        }
      }
    }

    for (let tile = EXTENDED_TILE_MIN + ((row.index + row.roadLaneIndex) % 3); tile <= EXTENDED_TILE_MAX; tile += 6) {
      const patch = new THREE.Mesh(geometries.roadStripe, row.index % 2 ? materials.roadEdge : materials.roadAlt);
      patch.position.set(tileToX(tile, TILE_SIZE), y + (((tile + row.index) % 3) - 1) * 8, 0.9);
      patch.scale.set(1.25 + ((tile + row.index) % 2) * 0.45, 0.42, 0.7);
      patch.castShadow = false;
      patch.receiveShadow = false;
      group.add(patch);
    }
  }

  if (isRail) {
    group.add(createRailTrack(row.index, geometries, materials));
  }

  if (isWater) {
    group.add(createWaterSurface(row, geometries, materials));
  }

  if (row.type === 'forest' || (row.type === 'grass' && row.trees?.length)) {
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
