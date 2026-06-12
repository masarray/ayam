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
  'public/audio/mushroom-dance.mp3',
  'docs/START_AUDIO_ROAD_TREE_AUDIT.md',
  'docs/REVIVE_LEARNING_LOOP_AUDIT.md',
  '.github/workflows/deploy-pages.yml'
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Missing required repository files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}


const crossingSource = readFileSync('src/game/VoxelCrossing.jsx', 'utf8');
const gameSource = readFileSync('src/game/RoadQuestGame.js', 'utf8');

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

const worldSource = readFileSync('src/game/world.js', 'utf8');
if (!/Math\.max\(2, Math\.min\(4, roadBand\?\.laneCount/.test(worldSource) || !/generatePreLateGameBridgeRow/.test(worldSource)) {
  console.error('Traffic generator must clamp road lane count to 2-4 lanes and bridge row 99 so orphan 1-lane-looking roads cannot appear.');
  process.exit(1);
}

const rendererSource = readFileSync('src/game/renderers.js', 'utf8');
if (!/railLine: new THREE\.BoxGeometry\(ENDLESS_VISUAL_WIDTH, 3\.6, RAIL_HEAD_HEIGHT\)/.test(rendererSource)) {
  console.error('Rail geometry should use a slim raised rail-head profile and aligned wheel contact constants.');
  process.exit(1);
}
if (!/ROAD_EDGE_WHITE_LINE_WIDTH = 2\.2/.test(rendererSource) || !/ROAD_YELLOW_LINE_WIDTH = 2\.5/.test(rendererSource) || !/ROAD_WHITE_LINE_WIDTH = 2\.0/.test(rendererSource)) {
  console.error('Road edge and yellow center markings should stay visually narrow but stable enough to avoid mobile shimmer.');
  process.exit(1);
}
if (!/ROAD_MARK_Z = 0\.28/.test(rendererSource) || !/ROAD_EDGE_MARK_Z = 0\.36/.test(rendererSource) || !/ROAD_YELLOW_MARK_Z = 0\.30/.test(rendererSource)) {
  console.error('Road markings need dedicated Z lifts so thin lines do not fight with asphalt during camera movement.');
  process.exit(1);
}
if (!/ROAD_EDGE_LINE_INSET = 2\.7/.test(rendererSource) || !/ROAD_EDGE_SHOULDER_INSET = 0\.95/.test(rendererSource)) {
  console.error('Road edge lines should sit near the asphalt edge so vehicles stay visually inside the boundary.');
  process.exit(1);
}
if (!/row\.roadLaneCount === 2 && !isLastLane/.test(rendererSource) || /row\.roadLaneCount === 2[\s\S]{0,220}asphaltYellow/.test(rendererSource)) {
  console.error('Two-lane roads must use a white dashed divider only, never yellow center markings.');
  process.exit(1);
}
if (!/roadLineLong: new THREE\.PlaneGeometry\(ENDLESS_VISUAL_WIDTH, 1\)/.test(rendererSource) || !/roadDashMark: new THREE\.PlaneGeometry\(22, ROAD_WHITE_LINE_WIDTH\)/.test(rendererSource) || !/stripe\.scale\.set\(0\.86, 1, 1\)/.test(rendererSource) || !/roadEdgeLineLong: new THREE\.BoxGeometry\(ENDLESS_VISUAL_WIDTH, ROAD_EDGE_WHITE_LINE_WIDTH, 0\.08\)/.test(rendererSource) || !/roadShoulderLong: new THREE\.PlaneGeometry\(ENDLESS_VISUAL_WIDTH, 1\)/.test(rendererSource)) {
  console.error('Road markings must use stable geometry, and dashed white road marks must directly follow ROAD_WHITE_LINE_WIDTH.');
  process.exit(1);
}
if (/ROAD_DASH_SCALE_Y/.test(rendererSource)) {
  console.error('ROAD_WHITE_LINE_WIDTH must drive dashed white marking thickness directly; do not hide it behind ROAD_DASH_SCALE_Y.');
  process.exit(1);
}
if (!/makeRoadMark/.test(rendererSource) || !/polygonOffsetFactor: -8/.test(rendererSource) || !/renderOrder = 11/.test(rendererSource) || !/makeRoadEdgeLine/.test(rendererSource)) {
  console.error('Road marking materials must use polygon offset, fixed render order, and dedicated edge-line geometry for stable mobile rendering.');
  process.exit(1);
}

if (!/WATER_FLOW_Y_MARGIN/.test(rendererSource) || !/minY: y - ROW_DEPTH \/ 2 \+ WATER_FLOW_Y_MARGIN/.test(rendererSource)) {
  console.error('Water flow white lines must store river row bounds so they cannot drift into grass rows.');
  process.exit(1);
}

if (!/navigator\.vibrate/.test(crossingSource) || !/hapticsEnabled/.test(crossingSource)) {
  console.error('Mobile haptic guard is missing from VoxelCrossing.jsx.');
  process.exit(1);
}

if (!/audioRef\.current\?\.markUserInteracted\?\.\(\)/.test(crossingSource) || !/warmMusic\?\.\(\)/.test(crossingSource) || !/deferMusicResume/.test(crossingSource)) {
  console.error('Start flow must avoid AudioContext creation, warm music only, and leave BGM resume to delayed gameplay flow.');
  process.exit(1);
}

const audioSource = readFileSync('src/game/audio.js', 'utf8');
if (!/mushroom-dance\.mp3/.test(audioSource) || /mushroom-dance\.ogg`/.test(audioSource)) {
  console.error('Runtime background music should prefer mushroom-dance.mp3, not OGG, for faster mobile startup.');
  process.exit(1);
}
if (!/userInteracted/.test(audioSource)) {
  console.error('Audio engine should gate autoplay until a real user gesture has occurred.');
  process.exit(1);
}
if (!/musicVolume = 0\.22/.test(audioSource) || !/sfxVolume = 1\.45/.test(audioSource)) {
  console.error('SFX should be mixed clearly above the background music without increasing Start-path media work.');
  process.exit(1);
}
if (!/const WATER_FLOW_Y_MARGIN = 16/.test(rendererSource) || !/rowIndex[\s\S]*wrap: BOARD_WIDTH \* 0\.62/.test(rendererSource) || !/item\.visible = isStillWater/.test(gameSource)) {
  console.error('Water foam must stay clipped to active water rows and never drift into grass rows.');
  process.exit(1);
}
if (!/musicContext/.test(audioSource) || !/resumeMusicFromTrustedGesture/.test(audioSource) || !/setMusicContext/.test(audioSource)) {
  console.error('Background music must use a context-aware lazy engine with trusted-gesture resume and quiz/game-over suppression.');
  process.exit(1);
}
if (!/preload = 'auto'/.test(audioSource) || !/preload = 'metadata'/.test(audioSource)) {
  console.error('BGM should warm lazily in the background using metadata/auto preload, not stay unloaded forever.');
  process.exit(1);
}
if (!/wheel: new THREE\.BoxGeometry\(9\.5, 6, 9\.5\)/.test(rendererSource) || !/trainWheel: new THREE\.BoxGeometry\(10\.8, 6\.8, 10\.8\)/.test(rendererSource)) {
  console.error('Vehicle/train wheels should stay slightly enlarged and aligned to road/rail surfaces.');
  process.exit(1);
}
const cssSource = [
  'src/game/VoxelCrossing.css',
  'src/game/styles/index.css',
  'src/game/styles/legacy.css',
  'src/game/styles/tokens.css',
  'src/game/styles/shell.css',
  'src/game/styles/buttons.css',
  'src/game/styles/overlays.css',
  'src/game/styles/effects.css',
  'src/game/styles/celebrations.css',
  'src/game/styles/pwa.css',
  'src/game/styles/badges.css',
  'src/game/styles/hud.css',
  'src/game/styles/controls.css',
  'src/game/styles/menu.css',
  'src/game/styles/quiz.css'
].map((file) => readFileSync(file, 'utf8')).join('\n');
if (!/const QUIZ_SIZE = 1;/.test(crossingSource) || !/const MAX_LIVES = 2;/.test(crossingSource) || !/REVIVE_COIN_REWARD = 5/.test(crossingSource) || /GAME_OVERS_BEFORE_QUIZ/.test(crossingSource)) {
  console.error('Learning loop must use one-question revive, two-life reserve-heart flow, and no periodic 5-question quiz cycle.');
  process.exit(1);
}

if (!/reviveOfferOpen/.test(crossingSource) || !/reviveOfferPending/.test(crossingSource) || !/openReviveQuiz/.test(crossingSource) || !/reserve_heart_used/.test(crossingSource) || !/vc-revive-offer-card/.test(cssSource) || !/vc-revive-pending/.test(cssSource)) {
  console.error('Revive quiz must be opt-in: first hit spends reserve heart, second hit shows only revive pending/offer before any question appears.');
  process.exit(1);
}

if (!/modalOverlayActive \? 'quiz-active' : ''/.test(crossingSource) || !/quiz-stale-repair/.test(crossingSource) || !/Watchdog: if a stale async flag blocks the loader/.test(crossingSource)) {
  console.error('Revive quiz state must have a stale-state repair guard and quiz-active must only apply while an actual modal overlay is active.');
  process.exit(1);
}
if (!/!reviveOfferPending && !reviveOfferOpen && !quizDue && quiz\.status === 'idle'/.test(crossingSource)) {
  console.error('Game-over result overlay must not render while revive pending/offer is active.');
  process.exit(1);
}
if (!/COINS_KEY/.test(crossingSource) || !/awardCoins\(REVIVE_COIN_REWARD(?:,\s*\{[^}]*animate:\s*true[^}]*\})?\)/.test(crossingSource) || !/vc-coin-hud/.test(cssSource)) {
  console.error('Revive learning loop must include persistent coins and visible coin HUD reward feedback.');
  process.exit(1);
}
if (!/reviveCorrect/.test(audioSource) || !/reviveWrong/.test(audioSource) || !/Benar! \+/.test(crossingSource) || !/Belum tepat/.test(crossingSource)) {
  console.error('Revive quiz needs friendly correct/wrong feedback without noisy copy.');
  process.exit(1);
}
if (!/const QUIZ_FEEDBACK_DELAY_MS = 2000;/.test(crossingSource) || !/feedbackVisible: false/.test(crossingSource) || !/setTimeout\(\(\) => \{[\s\S]*feedbackVisible: true[\s\S]*QUIZ_FEEDBACK_DELAY_MS/.test(crossingSource) || !/quizFeedbackVisible && !quiz\.explanationOpen \? 'feedback-open'/.test(crossingSource)) {
  console.error('Revive quiz feedback modal must wait 2 seconds after answer selection so the child can read the green/red answer state before the modal appears.');
  process.exit(1);
}

if (!/ChalkboardExplanationText/.test(crossingSource) || !/vc-explanation-page/.test(crossingSource) || !/Pembahasan/.test(crossingSource) || !/vc-explain-board/.test(cssSource)) {
  console.error('Wrong revive answer must offer a full-page chalkboard text explanation, not a tiny feedback card only.');
  process.exit(1);
}
if (!/white-space: normal !important/.test(cssSource) || !/text-overflow: unset !important/.test(cssSource) || !/-webkit-line-clamp: unset !important/.test(cssSource)) {
  console.error('Answer choices must show full long text; ellipsis/clamp truncation is not allowed in revive quiz.');
  process.exit(1);
}
if (!/nearest non-water open row/.test(gameSource) || !/candidate.type === 'water'/.test(gameSource)) {
  console.error('Revive should not put the player back on a water tile that can instantly drown again.');
  process.exit(1);
}
if (!/font-size: 40px;/.test(cssSource) || !/\.vc-life-hud[\s\S]*background: transparent;/.test(cssSource)) {
  console.error('Life HUD should use large bare hearts without background or border.');
  process.exit(1);
}
if (!/CHEAT MODE/.test(crossingSource) || /QA cheat mode/.test(crossingSource) || !/ctrlKey && event\.altKey && event\.shiftKey/.test(crossingSource) || !/vc-dock-visual/.test(crossingSource) || !/ControlArrowIcon/.test(crossingSource) || !/MenuActionIcon/.test(crossingSource) || !/movePadSide/.test(crossingSource) || !/move-pad-left/.test(cssSource) || !/border-radius: 999px;/.test(cssSource)) {
  console.error('Cheat mode must be secret-hotkey only, controls should support left/right move pad, and menu/move buttons need consistent icon styling.');
  process.exit(1);
}
if (!/MATERIAL_ICON_PATHS/.test(crossingSource) || !/keyboard_arrow_up/.test(crossingSource) || !/workspace_premium/.test(crossingSource) || !/Google Material Icons/.test(crossingSource)) {
  console.error('UI icons must use Google Material Icons path data, not hand-drawn custom paths.');
  process.exit(1);
}
const startFnSource = crossingSource.slice(
  crossingSource.indexOf('const startGame = () => {'),
  crossingSource.indexOf('  const saveGame = () => {')
);
if (startFnSource.includes('reset(true)')) {
  console.error('Start button must not call reset(true); it rebuilds the whole scene and can freeze low-end devices. Use game.start() for first-play flow.');
  process.exit(1);
}
if (/unlock\?\.\(/.test(startFnSource) || /allowMusic:\s*true/.test(startFnSource) || /startMusic\?\.\(/.test(startFnSource)) {
  console.error('Start button must not directly start music in the critical click path. Only lazy background warm/resume is allowed.');
  process.exit(1);
}
if (!/runWhenIdle\([\s\S]*warmMusic\?\.\(\)/.test(startFnSource) || /resumeMusic\?\.\(\)/.test(startFnSource)) {
  console.error('Start flow should only warm music in idle work and must not resume BGM directly.');
  process.exit(1);
}
if (/gameRef\.current\?\.start\(\)/.test(startFnSource) || !/startEngineAfterIntroPaint\(\)/.test(startFnSource)) {
  console.error('Start button should paint the UI first and defer engine start by animation frames.');
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
if (!/RAIL_HEAD_Y_OFFSET = 17\.4/.test(rendererSource) || !/TRAIN_WHEEL_CENTER_Z/.test(rendererSource)) {
  console.error('Train wheels must stay aligned to the raised rail-head surface.');
  process.exit(1);
}

if (!/isUiPaused/.test(gameSource) || !/lastPausedRenderAt/.test(gameSource)) {
  console.error('Engine should throttle WebGL rendering while menu/overlay has paused gameplay.');
  process.exit(1);
}

if (!/_triggerBlockedBump\(direction/.test(gameSource) || !/blocked:\s*true/.test(gameSource) || !/duration:\s*Math\.max\(235/.test(gameSource) || !/player\.scale\.set/.test(gameSource) || !/blockedBounce/.test(audioSource)) {
  console.error('Blocked movement must create a visible juicy bump animation with squash/stretch and doeng SFX.');
  process.exit(1);
}

const musicSize = statSync('public/audio/mushroom-dance.mp3').size;
if (musicSize < 1024) {
  console.error('Background music file looks too small or empty.');
  process.exit(1);
}
if (musicSize > 600 * 1024) {
  console.error(`Background music is too large for the public mobile build: ${musicSize} bytes. Keep mushroom-dance.mp3 compressed.`);
  process.exit(1);
}

const rows = createInitialRows(48);
extendRows(rows, 180);

const orphanRoadBandErrors = [];
for (let index = 0; index < rows.length - 2; index += 1) {
  const row = rows[index];
  if (!row || row.type !== 'traffic') continue;
  if (![2, 3, 4].includes(Number(row.roadLaneCount))) {
    orphanRoadBandErrors.push(`row ${index} has unsupported lane count ${row.roadLaneCount}`);
    continue;
  }
  if (row.roadLaneIndex > 0) {
    const previous = rows[index - 1];
    const comesFromPrevious = previous?.type === 'traffic'
      && previous.roadBandId === row.roadBandId
      && previous.roadLaneCount === row.roadLaneCount
      && previous.roadLaneIndex === row.roadLaneIndex - 1;
    if (!comesFromPrevious) orphanRoadBandErrors.push(`row ${index} is lane ${row.roadLaneIndex} of road band ${row.roadBandId} but row ${index - 1} is not the previous lane`);
  }
  if (row.roadLaneIndex < row.roadLaneCount - 1) {
    const next = rows[index + 1];
    const continues = next?.type === 'traffic'
      && next.roadBandId === row.roadBandId
      && next.roadLaneCount === row.roadLaneCount
      && next.roadLaneIndex === row.roadLaneIndex + 1;
    if (!continues) orphanRoadBandErrors.push(`row ${index} starts/continues road band ${row.roadBandId} but row ${index + 1} does not continue it`);
  }
}
if (orphanRoadBandErrors.length > 0) {
  console.error(`Road band continuity check failed:\n${orphanRoadBandErrors.slice(0, 20).join('\n')}`);
  process.exit(1);
}

const passabilityErrors = [];

const openingTypes = rows.slice(4, 13).map((row) => row?.type);
const expectedOpeningTypes = ['traffic', 'traffic', 'forest', 'water', 'forest', 'traffic', 'traffic', 'traffic', 'traffic'];
if (JSON.stringify(openingTypes) !== JSON.stringify(expectedOpeningTypes)) {
  console.error(`Opening world flow mismatch: ${openingTypes.join(', ')}`);
  process.exit(1);
}
if ((rows[4]?.roadLaneCount !== 2) || (rows[5]?.roadLaneCount !== 2) || ![9,10,11,12].every((index) => rows[index]?.roadLaneCount === 4)) {
  console.error('Opening rows must be 2-lane road, forest, river, forest, then 4-lane road.');
  process.exit(1);
}
if (![96,97,98,99].every((index) => rows[index]?.type === 'traffic' && rows[index]?.roadLaneCount === 4 && rows[index]?.roadBandId === 96 && rows[index]?.roadLaneIndex === index - 96)) {
  console.error('Rows 96-99 must be a complete 4-lane road block so score 99 never looks like an orphan 1-lane road.');
  process.exit(1);
}
for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
  const row = rows[rowIndex];
  if (!row?.trees?.length) {
    passabilityErrors.push(`start row ${rowIndex} should include decorative trees`);
  }
  for (const centerTile of [-1, 0, 1]) {
    if (row?.blockers?.has(centerTile)) {
      passabilityErrors.push(`start row ${rowIndex} must keep center tile ${centerTile} open`);
    }
  }
}
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

if (!/v3\.5\.21 owner: bottom control dock/.test(cssSource) || !/v3\.5\.22 owner: gameplay HUD/.test(cssSource) || !/\.vc-shell\.move-pad-left \.vc-control-dock[\s\S]*flex-direction: row-reverse/.test(cssSource) || !/\.vc-move-pad[\s\S]*grid-template-columns: repeat\(3, var\(--vc-control-hit-size\)\)/.test(cssSource) || !/\.vc-best-hud[\s\S]*top: calc\(var\(--vc-hud-top\) \+ var\(--vc-coin-height\) \+ 5px\)/.test(cssSource)) {
  console.error('HUD/control ownership must keep menu opposite the move pad and keep coin/best in a compact top-right stack.');
  process.exit(1);
}


if (!/ChalkboardExplanationText/.test(crossingSource) || !/quiz-active/.test(crossingSource) || /<span className="quiz-mark">✓<\/span>/.test(crossingSource) || /<span className="quiz-mark">×<\/span>/.test(crossingSource)) {
  console.error('Revive quiz must have a safe chalkboard explanation page, disabled underlay controls, and Material-icon answer marks.');
  process.exit(1);
}

if (!/ChalkboardExplanationText/.test(crossingSource) || /ExplanationVisual/.test(crossingSource)) {
  console.error('Revive explanation must use chalkboard text only, not the old visual renderer.');
  process.exit(1);
}
if (!/quiz-active/.test(crossingSource) || !/vc-quiz-options[\s\S]*grid-template-columns: 1fr/.test(cssSource) || !/vc-explain-board/.test(cssSource)) {
  console.error('Revive quiz layout must disable background controls, stack action buttons, and use chalkboard explanation.');
  process.exit(1);
}


if (/className="(?:glass-card|mini-badge|start-button|icon-close|vc-boot-loader|loader-orb|impact-stinger|near-miss-stinger|result-card|reward-aura|star-reward|gold-star|reward-copy)(?:\s|")/.test(crossingSource)) {
  console.error('CSS ownership phase 4 must not use legacy shell/overlay/button/effect primitive class names in VoxelCrossing.jsx.');
  process.exit(1);
}
if (!/v3\.5\.26 owner: game shell/.test(cssSource) || !/v3\.5\.26 owner: shared UI button primitives/.test(cssSource) || !/v3\.5\.26 owner: screen overlay and glass-card primitives/.test(cssSource) || !/v3\.5\.26 owner: impact and reward visual effects/.test(cssSource)) {
  console.error('CSS ownership phase 4 owner file headers are missing.');
  process.exit(1);
}
if (!/vc-app-shell/.test(crossingSource) || !/vc-game-host/.test(crossingSource) || !/vc-loading-overlay/.test(crossingSource) || !/vc-screen-overlay/.test(crossingSource) || !/vc-glass-card/.test(crossingSource) || !/vc-mini-badge/.test(crossingSource) || !/vc-primary-button/.test(crossingSource) || !/vc-icon-button/.test(crossingSource) || !/vc-impact-stinger/.test(crossingSource) || !/vc-near-miss-stinger/.test(crossingSource) || !/vc-result-overlay/.test(crossingSource)) {
  console.error('CSS ownership phase 4 class contract is incomplete in VoxelCrossing.jsx.');
  process.exit(1);
}
if (!/@import '\.\/shell\.css';/.test(cssSource) || !/@import '\.\/buttons\.css';/.test(cssSource) || !/@import '\.\/overlays\.css';/.test(cssSource) || !/@import '\.\/effects\.css';/.test(cssSource)) {
  console.error('CSS ownership phase 4 owner files must be imported from styles/index.css.');
  process.exit(1);
}


if (!/APP_EXIT_FALLBACK_DELAY_MS = 260/.test(crossingSource) || !/window\.close\(\)/.test(crossingSource) || !/Keluar App/.test(crossingSource) || !/Tutup Menu/.test(crossingSource) || !/Tes Getar/.test(crossingSource) || !/function canUseHaptics/.test(crossingSource) || !/test:\s*\[80, 55, 95, 55, 120\]/.test(crossingSource)) {
  console.error('PWA close fallback and Android haptic test contract must stay intact.');
  process.exit(1);
}
if (!/v3\.5\.27 owner: PWA exit affordance and Android haptic test/.test(cssSource) || !/vc-menu-haptic-test/.test(cssSource) || !/vc-app-exit-overlay/.test(cssSource) || !/vc-primary-button\.ghost/.test(cssSource)) {
  console.error('PWA close/haptic v3.5.27 styling ownership is incomplete.');
  process.exit(1);
}


if (!/OFFLINE_WARM_ASSET_PATHS[\s\S]*data\/questionBanks\.json[\s\S]*audio\/mushroom-dance\.mp3[\s\S]*audio\/kids-yay\.mp3/.test(crossingSource) || !/AYAM_SD_WARM_CACHE/.test(crossingSource) || !/AYAM_SD_WARM_CACHE/.test(readFileSync('public/sw.js', 'utf8'))) {
  console.error('PWA hardening phase 5 must warm-cache quiz and audio assets for offline play after first app idle.');
  process.exit(1);
}
if (!/const suspendedDuringImpact = impactingRef\.current === true;/.test(crossingSource) || !/suspendedDuringImpact/.test(crossingSource) || !/continueFromAppPause/.test(crossingSource)) {
  console.error('PWA hardening phase 5 must handle Android background/back during impact without returning to a stuck impact state.');
  process.exit(1);
}
if (/fonts\.googleapis/.test(readFileSync('src/game/styles/legacy.css', 'utf8'))) {
  console.error('Legacy CSS must not duplicate the Google Fonts import; the app shell owns the single font import.');
  process.exit(1);
}
if (/className="(?:pwa-install-overlay|pwa-install-card|pwa-install-orbit|pwa-benefits|pwa-install-help|pwa-install-actions|pwa-install-primary|pwa-install-later|badge-unlock-overlay|badge-unlock-card|badge-aura|badge-emblem|badge-meta|badge-continue|badge-board-overlay|badge-board-card|badge-board-head|badge-board-summary|badge-family-list|badge-family-card|badge-family-title|badge-family-progress|badge-grid|badge-tile|badge-tile-medal|badge-tile-lock|badge-board-actions|badge-share-button)(?:\s|")/.test(crossingSource) || /className=\{`(?:badge-unlock-overlay|badge-tile)/.test(crossingSource)) {
  console.error('CSS ownership phase 5 must not use legacy PWA install or badge overlay class names in VoxelCrossing.jsx.');
  process.exit(1);
}
if (!/v3\.5\.29 owner: PWA install prompt/.test(cssSource) || !/v3\.5\.29 owner: badge unlock and badge board overlays/.test(cssSource) || !/@import '\.\/pwa\.css';/.test(cssSource) || !/@import '\.\/badges\.css';/.test(cssSource)) {
  console.error('CSS ownership phase 5 owner files and imports are missing.');
  process.exit(1);
}
if (!/vc-pwa-install-overlay/.test(crossingSource) || !/vc-pwa-install-card/.test(crossingSource) || !/vc-badge-unlock-overlay/.test(crossingSource) || !/vc-badge-board-overlay/.test(crossingSource) || !/vc-badge-tile/.test(crossingSource) || !/vc-badge-share-button/.test(crossingSource)) {
  console.error('CSS ownership phase 5 class contract is incomplete in VoxelCrossing.jsx.');
  process.exit(1);
}

if (/className={?`?[^\n]*vc-overlay/.test(crossingSource) || /className="vc-overlay/.test(crossingSource)) {
  console.error('CSS ownership phase 6 must detach active React overlays from the legacy vc-overlay primitive.');
  process.exit(1);
}
if (!/v3\.5\.30 owner: revive quiz must be a true full-screen hard modal/.test(cssSource) || !/\.vc-shell\.portrait \.vc-revive-quiz-overlay[\s\S]*height: 100dvh/.test(cssSource) || !/\.vc-shell\.portrait \.vc-revive-quiz-overlay \.vc-revive-card[\s\S]*overflow: hidden/.test(cssSource)) {
  console.error('CSS ownership phase 6 must keep revive quiz full-screen in portrait and prevent card/page scrollbars.');
  process.exit(1);
}
if (!/const quizRuntimeLockActive = gameOver && !menuOpen/.test(crossingSource) || !/quizRuntimeLockActive[\s\S]*gameRef\.current\?\.suspendRuntime\?\.\(\)/.test(crossingSource) || !/openReviveQuiz[\s\S]*gameRef\.current\?\.suspendRuntime\?\.\(\)/.test(crossingSource)) {
  console.error('Revive quiz must hard-pause the 3D runtime before and during the full-screen learning overlay.');
  process.exit(1);
}



if (/className={`?(?:confetti-layer|confetti-piece)|className="(?:confetti-layer|confetti-piece|coin-icon-glyph)(?:\s|")/.test(crossingSource) || /className={`vc-confetti-piece piece-/.test(crossingSource)) {
  console.error('CSS ownership phase 7 must not use legacy confetti or coin glyph class names in VoxelCrossing.jsx. Use vc-confetti-* owner classes.');
  process.exit(1);
}
if (!/v3\.5\.31 owner: celebration burst primitives/.test(cssSource) || !/@import '\.\/celebrations\.css';/.test(cssSource) || !/vc-confetti-layer/.test(crossingSource) || !/vc-confetti-piece/.test(crossingSource) || !/--vc-celebration-z/.test(cssSource)) {
  console.error('CSS ownership phase 7 celebration owner file, import, tokens, or JSX contract is incomplete.');
  process.exit(1);
}

if (!/APP_BACKGROUND_PAUSE_REASONS/.test(crossingSource) || !/hardPauseAppRuntime/.test(crossingSource) || !/visibilitychange/.test(crossingSource) || !/pagehide/.test(crossingSource) || !/beforeunload/.test(crossingSource) || !/popstate/.test(crossingSource) || !/suspendRuntime/.test(gameSource) || !/resumeRuntime/.test(gameSource) || !/isRuntimeSuspended/.test(gameSource)) {
  console.error('PWA lifecycle hard-pause contract must stop game runtime and audio on Android Home/Back/background.');
  process.exit(1);
}


if (/className="vc-hud|className="score-value|className="score-label|className="high-value|className="high-label|className="coin-hud|className="life-hud|className="best-hud|className="cheat-chip/.test(crossingSource)) {
  console.error('HUD ownership phase 2 must not use legacy HUD class names in VoxelCrossing.jsx.');
  process.exit(1);
}
if (!/vc-game-hud vc-score-hud/.test(crossingSource) || !/vc-coin-hud/.test(crossingSource) || !/vc-game-hud vc-best-hud/.test(crossingSource) || !/vc-life-hud/.test(crossingSource) || !/vc-cheat-chip/.test(crossingSource)) {
  console.error('HUD ownership phase 2 class contract is incomplete.');
  process.exit(1);
}


if (/className="(?:quiz-card|revive-card|quiz-question|quiz-question-count|quiz-options|revive-options|quiz-option|quiz-option-key|quiz-option-text|quiz-mark|quiz-next-button|quiz-feedback|quiz-feedback-title|revive-actions|explanation-page|explain-question|explain-board|revive-offer-card|revive-offer-actions)|className=\{`(?:quiz-card|quiz-option|quiz-feedback|vc-overlay quiz)/.test(crossingSource)) {
  console.error('Quiz ownership phase 3 must not use legacy revive quiz class names in VoxelCrossing.jsx.');
  process.exit(1);
}
if (!/v3\.5\.23 owner: revive quiz/.test(cssSource) || !/vc-revive-offer-card/.test(crossingSource) || !/vc-quiz-overlay vc-revive-quiz-overlay/.test(crossingSource) || !/vc-quiz-card vc-revive-card/.test(crossingSource) || !/vc-quiz-question/.test(crossingSource) || !/vc-quiz-option/.test(crossingSource) || !/vc-quiz-button/.test(crossingSource) || !/vc-explain-board/.test(crossingSource)) {
  console.error('Quiz ownership phase 3 class contract is incomplete.');
  process.exit(1);
}
if (!/\.vc-quiz-option[\s\S]*white-space: normal/.test(cssSource) || !/\.vc-quiz-option-text[\s\S]*text-overflow: unset/.test(cssSource) || !/\.vc-revive-card\.feedback-open \.vc-revive-feedback/.test(cssSource)) {
  console.error('Quiz ownership phase 3 must keep full answer text and centered feedback modal ownership in quiz.css.');
  process.exit(1);
}

if (!/function usesHeavyVehicleHorn/.test(gameSource) || !/kind: heavyVehicle \? 'truckHorn' : 'carHorn'/.test(gameSource) || !/truckHorn\(\)/.test(audioSource)) {
  console.error('Heavy vehicle horn routing must keep truck/bus horn separate from small car horn.');
  process.exit(1);
}

console.log('Repository verification passed.');
