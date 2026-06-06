export const TILE_SIZE = 42;
export const MIN_TILE = -8;
export const MAX_TILE = 8;
export const TILES_PER_ROW = MAX_TILE - MIN_TILE + 1;
export const BOARD_WIDTH = TILES_PER_ROW * TILE_SIZE;
export const ROW_DEPTH = TILE_SIZE;
export const PLAYER_WIDTH = 10;
export const PLAYER_DEPTH = 10;
export const PLAYER_HEIGHT = 22;
export const MOVE_DURATION = 145;
export const STARTING_ROWS = 4;
export const PREGENERATE_ROWS = 48;
export const CAMERA_LERP = 0.105;
export const VEHICLE_SAFE_MARGIN = 140;
export const TRAIN_SAFE_MARGIN = 520;
export const WATER_SAFE_MARGIN = 300;
export const PLANK_RIDE_LIMIT_MS = 3000;
export const PLANK_EDGE_SINK_MARGIN = 42;
export const TRAFFIC_MIN_GAP = 34;
export const TRAFFIC_COMFORT_GAP = 86;
export const WATER_PLANK_MIN_GAP = 74;

export const COLORS = Object.freeze({
  sky: 0x83c83f,
  grass: 0x9fd044,
  grassAlt: 0x8ab537,
  grassDeep: 0x79a22f,
  grassDark: 0x5f8f21,
  road: 0x2f3440,
  roadAlt: 0x383d49,
  roadEdge: 0x252a34,
  asphaltMark: 0xc9d2de,
  water: 0x3f96c7,
  waterAlt: 0x2f83b3,
  waterDeep: 0x1d5f86,
  waterBright: 0x66b8da,
  waterFoam: 0xbcecf5,
  plank: 0xa06a3a,
  plankDark: 0x734622,
  plankEdge: 0x563318,
  ballast: 0x5f6872,
  ballastDark: 0x48515b,
  rail: 0xc5cbd2,
  railShadow: 0x333943,
  sleeper: 0x5b3c24,
  chickenWhite: 0xf8faf0,
  chickenShade: 0xe0e7d4,
  chickenWing: 0xdce5d2,
  chickenComb: 0xd64237,
  chickenBeak: 0xf0b63c,
  chickenLeg: 0xd98a32,
  featherWhite: 0xfffbef,
  featherShade: 0xe7ead9,
  featherTip: 0xcfd6c5,
  blood: 0x8f1d24,
  bloodDark: 0x5f1117,
  trunk: 0x5c351b,
  tree: 0x5f9116,
  treeAlt: 0x76a91e,
  shadow: 0x000000,
  wheel: 0x191d24,
  tireHub: 0x555d69,
  glass: 0x182332,
  glassDark: 0x0b1118,
  headlight: 0xf9eeb5,
  tailLight: 0x8f1722,
  white: 0xffffff,
  panel: 0x1f2530,
  trimLight: 0xd4d9df,
  trimDark: 0x36404c,
  chrome: 0xc8ccd2,
  trainRed: 0xb12b35,
  trainBlue: 0x486484,
  trainGreen: 0x4f7b41,
  trainYellow: 0xbca740,
  trainOrange: 0xc87235,
  trainCream: 0xd8d2b8,
  trainSteel: 0x657489
});

export const VEHICLE_PALETTE = [
  0xa9292d,
  0xa9a43b,
  0x5a8d34,
  0xa8b7df,
  0xc66a34,
  0x7c8da6,
  0xd8d2b8,
  0x73588f,
  0x2f6f8f,
  0xe2b93c,
  0xe7e2cf,
  0x2b5872
];

export const VEHICLE_VARIANTS = Object.freeze([
  { kind: 'sedan', width: 66, depth: 30, speedMin: 86, speedMax: 148, weight: 16 },
  { kind: 'hatchback', width: 58, depth: 29, speedMin: 92, speedMax: 158, weight: 12 },
  { kind: 'wagon', width: 78, depth: 31, speedMin: 78, speedMax: 136, weight: 9 },
  { kind: 'taxi', width: 66, depth: 30, speedMin: 84, speedMax: 146, weight: 7, fixedColor: 0xe2b93c },
  { kind: 'pickup', width: 82, depth: 32, speedMin: 72, speedMax: 126, weight: 9 },
  { kind: 'van', width: 90, depth: 34, speedMin: 66, speedMax: 118, weight: 8 },
  { kind: 'bus', width: 120, depth: 38, speedMin: 54, speedMax: 96, weight: 6 },
  { kind: 'boxTruck', width: 120, depth: 38, speedMin: 52, speedMax: 94, weight: 7 },
  { kind: 'tankerTruck', width: 130, depth: 39, speedMin: 50, speedMax: 90, weight: 4 },
  { kind: 'containerTruck', width: 146, depth: 40, speedMin: 48, speedMax: 86, weight: 4 }
]);

export const PLANK_PALETTE = [
  COLORS.plank,
  0xb97a43,
  0x8b562e,
  0xc08752
];

export const TRAIN_PALETTE = [
  COLORS.trainRed,
  COLORS.trainBlue,
  COLORS.trainGreen,
  COLORS.trainYellow,
  COLORS.trainOrange,
  COLORS.trainCream,
  COLORS.trainSteel
];

export const TRAIN_PROFILES = Object.freeze([
  {
    trainClass: 'bullet',
    weight: 2,
    unlockRow: 18,
    speedMin: 430,
    speedMax: 650,
    locomotiveWidth: 150,
    carriageWidthMin: 114,
    carriageWidthMax: 136,
    carriageCountMin: 5,
    carriageCountMax: 9,
    depth: 37
  },
  {
    trainClass: 'modern',
    weight: 5,
    speedMin: 258,
    speedMax: 356,
    locomotiveWidth: 112,
    carriageWidthMin: 92,
    carriageWidthMax: 110,
    carriageCountMin: 4,
    carriageCountMax: 6,
    depth: 38
  },
  {
    trainClass: 'classic',
    weight: 4,
    speedMin: 82,
    speedMax: 134,
    locomotiveWidth: 96,
    tenderWidth: 54,
    carriageWidthMin: 72,
    carriageWidthMax: 86,
    carriageCountMin: 2,
    carriageCountMax: 4,
    depth: 38
  },
  {
    trainClass: 'freight',
    weight: 3,
    speedMin: 112,
    speedMax: 176,
    locomotiveWidth: 104,
    carriageWidthMin: 78,
    carriageWidthMax: 94,
    carriageCountMin: 4,
    carriageCountMax: 7,
    depth: 40
  }
]);
