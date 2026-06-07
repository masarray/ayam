import { existsSync, readFileSync, statSync } from 'node:fs';
import { createInitialRows, extendRows } from '../src/game/world.js';

const requiredFiles = [
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'index.html',
  'vite.config.js',
  'src/game/VoxelCrossing.jsx',
  'src/game/RoadQuestGame.js',
  'src/game/audio.js',
  'public/favicon.svg',
  'public/sw.js',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/audio/mushroom-dance.ogg',
  '.github/workflows/deploy-pages.yml'
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Missing required repository files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}


const crossingSource = readFileSync('src/game/VoxelCrossing.jsx', 'utf8');

const constantsSource = readFileSync('src/game/constants.js', 'utf8');
if (!/export const MOVE_DURATION = 166;/.test(constantsSource)) {
  console.error('Camera mode B requires MOVE_DURATION to stay at 166ms for soft child-friendly movement.');
  process.exit(1);
}
if (!/export const CAMERA_FOLLOW_STIFFNESS = 12\.5;/.test(constantsSource)) {
  console.error('Camera mode B requires CAMERA_FOLLOW_STIFFNESS to stay at 12.5.');
  process.exit(1);
}
if (!/export const PLAYER_RAIL_STAND_Z = 7\.2;/.test(constantsSource)) {
  console.error('Rail standing height should stay tuned to the raised rail-head surface.');
  process.exit(1);
}

const rendererSource = readFileSync('src/game/renderers.js', 'utf8');
if (!/railLine: new THREE\.BoxGeometry\(ENDLESS_VISUAL_WIDTH, 4\.8, RAIL_HEAD_HEIGHT\)/.test(rendererSource)) {
  console.error('Rail geometry should use the raised rail-head profile and aligned wheel contact constants.');
  process.exit(1);
}

if (!/navigator\.vibrate/.test(crossingSource) || !/hapticsEnabled/.test(crossingSource)) {
  console.error('Mobile haptic guard is missing from VoxelCrossing.jsx.');
  process.exit(1);
}
const startFnSource = crossingSource.slice(
  crossingSource.indexOf('const startGame = () => {'),
  crossingSource.indexOf('  const saveGame = () => {')
);
if (startFnSource.includes('unlockAudio')) {
  console.error('Start button must not unlock audio directly; it can block the first mobile frame. Defer audio unlock to movement/menu/idle.');
  process.exit(1);
}
if (startFnSource.includes('reset(true)')) {
  console.error('Start button must not call reset(true); it rebuilds the whole scene and can freeze low-end devices. Use game.start() for first-play flow.');
  process.exit(1);
}


const openMenuFnSource = crossingSource.slice(
  crossingSource.indexOf('  const openMenu = () => {'),
  crossingSource.indexOf('  const closeMenu =')
);
if (openMenuFnSource.includes('unlockAudio')) {
  console.error('Menu open must not unlock audio directly; menu tap should be a pure UI transition to avoid mobile long tasks.');
  process.exit(1);
}
if (!/pauseGame\(\{ keepStarted: true \}\)/.test(openMenuFnSource)) {
  console.error('Menu open should pause the engine without flipping started=false; that avoids overlay churn while opening menu.');
  process.exit(1);
}

const resumeFnSource = crossingSource.slice(
  crossingSource.indexOf('  const resumeGame ='),
  crossingSource.indexOf('  const pauseGame =')
);
if (!/resumeEngineAfterMenuPaint/.test(resumeFnSource) || /deferAudioUnlock/.test(resumeFnSource)) {
  console.error('Menu close/resume must defer WebGL resume until after UI paint and must not unlock audio directly.');
  process.exit(1);
}
if (!/RAIL_HEAD_Y_OFFSET = 19\.5/.test(rendererSource) || !/TRAIN_WHEEL_CENTER_Z/.test(rendererSource)) {
  console.error('Train wheels must stay aligned to the raised rail-head surface.');
  process.exit(1);
}

const gameSource = readFileSync('src/game/RoadQuestGame.js', 'utf8');
if (!/isUiPaused/.test(gameSource) || !/lastPausedRenderAt/.test(gameSource)) {
  console.error('Engine should throttle WebGL rendering while menu/overlay has paused gameplay.');
  process.exit(1);
}

const musicSize = statSync('public/audio/mushroom-dance.ogg').size;
if (musicSize < 1024) {
  console.error('Background music file looks too small or empty.');
  process.exit(1);
}

const rows = createInitialRows(48);
extendRows(rows, 180);
const passabilityErrors = [];
rows.forEach((row) => {
  if (!row) return;

  if (row.type === 'traffic' && ![2, 3, 4].includes(Number(row.roadLaneCount))) {
    passabilityErrors.push(`row ${row.index} has unsupported road lane count: ${row.roadLaneCount}`);
  }
  if (!Array.isArray(row.trees)) return;
  let openTiles = 0;
  for (let tile = -8; tile <= 8; tile += 1) {
    if (!row.blockers?.has(tile)) openTiles += 1;
  }
  if (openTiles < 4) {
    passabilityErrors.push(`row ${row.index} has too few open tiles after tree blockers: ${openTiles}`);
  }
  row.trees.forEach((tile) => {
    if (!row.blockers?.has(tile)) {
      passabilityErrors.push(`row ${row.index} visible tree at tile ${tile} is not a blocker`);
    }
  });
});

if (passabilityErrors.length > 0) {
  console.error(`World passability check failed:\n${passabilityErrors.slice(0, 20).join('\n')}`);
  process.exit(1);
}

console.log('Repository verification passed.');
