import * as THREE from 'three';
import {
  CAMERA_FOLLOW_STIFFNESS,
  CAMERA_LERP,
  CAMERA_TARGET_STIFFNESS,
  MAX_TILE,
  MIN_TILE,
  MOVE_DURATION,
  PLAYER_DEPTH,
  PLAYER_WIDTH,
  PLAYER_PLANK_STAND_Z,
  PLAYER_RAIL_STAND_Z,
  PLANK_EDGE_SINK_MARGIN,
  PLANK_RIDE_LIMIT_MS,
  PREGENERATE_ROWS,
  TILE_SIZE,
  TRAFFIC_COMFORT_GAP,
  TRAFFIC_MIN_GAP,
  TRAIN_SAFE_MARGIN,
  WATER_PLANK_MIN_GAP,
  VEHICLE_SAFE_MARGIN,
  WATER_SAFE_MARGIN
} from './constants.js';
import { createInitialRows, extendRows } from './world.js';
import {
  applyRendererQuality,
  createFoundation,
  createGeometryCache,
  createMaterials,
  createPlayer,
  createPlank,
  createRowGroup,
  createTrain,
  createVehicle
} from './renderers.js';
import { clamp, easeInOutCubic, easeInOutQuad, easeOutCubic, lerp, rowToY, tileToX } from './math.js';

const DIRECTIONS = new Set(['forward', 'backward', 'left', 'right']);
const DIR_TO_DELTA = {
  forward: { row: 1, tile: 0 },
  backward: { row: -1, tile: 0 },
  left: { row: 0, tile: -1 },
  right: { row: 0, tile: 1 }
};

function createOrthoCamera() {
  const camera = new THREE.OrthographicCamera(-400, 400, 280, -280, 1, 2200);
  camera.up.set(0, 0, 1);
  camera.position.set(300, -330, 310);
  camera.lookAt(0, 0, 0);
  return camera;
}

function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose?.();
    // Materials created per vehicle are disposed here. Shared materials are disposed during engine cleanup.
    if (child.material && !child.material.__shared) {
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose?.());
      else child.material.dispose?.();
    }
  });
}

function disposeDynamicMaterials(object) {
  object.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material.__shared) material.dispose?.();
    });
  });
}

function laneBounds(margin) {
  return {
    minX: MIN_TILE * TILE_SIZE - margin,
    maxX: MAX_TILE * TILE_SIZE + margin
  };
}

function laneProgress(vehicle, direction, wrapMin, wrapMax) {
  return direction > 0 ? vehicle.position.x - wrapMin : wrapMax - vehicle.position.x;
}

const HIGH_SCORE_KEY = 'ayam-sd-high-score';

function detectRenderProfile() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const deviceMemory = Number(nav.deviceMemory || 0);
  const cores = Number(nav.hardwareConcurrency || 0);
  const coarsePointer = typeof window !== 'undefined'
    ? window.matchMedia?.('(pointer: coarse)')?.matches === true
    : false;
  const narrowScreen = typeof window !== 'undefined' ? Math.min(window.innerWidth || 0, window.innerHeight || 0) < 720 : false;
  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
    : false;

  const lowMemory = deviceMemory > 0 && deviceMemory <= 4;
  const lowCore = cores > 0 && cores <= 4;
  const mobileLike = coarsePointer || narrowScreen;
  const lowEnd = reducedMotion || (mobileLike && (lowMemory || lowCore));

  if (lowEnd) {
    return {
      name: 'mobile-light',
      antialias: false,
      maxPixelRatio: 1.25,
      shadowMapSize: 1024,
      powerPreference: 'high-performance'
    };
  }

  if (mobileLike) {
    return {
      name: 'mobile-balanced',
      antialias: true,
      maxPixelRatio: 1.5,
      shadowMapSize: 1536,
      powerPreference: 'high-performance'
    };
  }

  return {
    name: 'desktop-premium',
    antialias: true,
    maxPixelRatio: 1.75,
    shadowMapSize: 2048,
    powerPreference: 'high-performance'
  };
}

function readHighScore() {
  try {
    const value = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    // Storage can be blocked in private/restricted browser contexts. Gameplay still works.
  }
}

function clearHighScore() {
  try {
    localStorage.removeItem(HIGH_SCORE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export class RoadQuestGame {
  constructor(container, options = {}) {
    if (!container) throw new Error('RoadQuestGame requires a container element.');

    this.container = container;
    this.options = {
      milestoneEvery: 5,
      enableMilestoneCallback: false,
      ...options
    };

    this.callbacks = {
      onScore: options.onScore || (() => {}),
      onHighScore: options.onHighScore || (() => {}),
      onGameOver: options.onGameOver || (() => {}),
      onImpact: options.onImpact || (() => {}),
      onReady: options.onReady || (() => {}),
      onMilestone: options.onMilestone || (() => {}),
      onMoveStart: options.onMoveStart || (() => {}),
      onHazardSound: options.onHazardSound || (() => {}),
      onNearMiss: options.onNearMiss || (() => {}),
      onRespawn: options.onRespawn || (() => {}),
      onBlocked: options.onBlocked || (() => {})
    };

    this.scene = new THREE.Scene();
    this.camera = createOrthoCamera();
    this.renderProfile = detectRenderProfile();
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.renderProfile.antialias,
      alpha: false,
      powerPreference: this.renderProfile.powerPreference
    });
    applyRendererQuality(this.renderer);
    this.renderer.domElement.className = 'vc-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Ayam SD game canvas');
    this.renderer.domElement.setAttribute('role', 'img');
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.materials = createMaterials();
    Object.values(this.materials).forEach((material) => { material.__shared = true; });
    this.geometries = createGeometryCache();

    this.worldGroup = new THREE.Group();
    this.vehicleGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.scene.add(this.worldGroup, this.vehicleGroup, this.fxGroup);

    this.rows = [];
    this.minPlayableRow = 0;
    this.prunedRowDataBefore = 0;
    this.rowGroups = new Map();
    this.vehicles = [];
    this.planks = [];
    this.trafficRows = new Map();
    this.waterRows = new Map();
    this.waterFlowItems = [];
    this.waterFlowRows = new Map();
    this.fxItems = [];
    this.moveQueue = [];
    this.player = null;
    this.playerPosition = { row: 0, tile: 0 };
    this.highestRow = 0;
    this.score = 0;
    this.highScore = readHighScore();
    this.runStartingHighScore = this.highScore;
    this.newRecordThisRun = false;
    this.newRecordScore = 0;
    this.activeRidePlankId = null;
    this.isPlaying = false;
    this.isGameOver = false;
    this.isImpacting = false;
    this.impactStartedAt = 0;
    this.impactDuration = 920;
    this.impactReason = 'traffic';
    this.impactVector = new THREE.Vector2(0, 0);
    this.cheatMode = Boolean(options.cheatMode);
    this.cheatRespawnPending = false;
    this.cheatRespawnPosition = null;
    this.invulnerableUntil = 0;
    this.waterGraceUntil = 0;
    this.waterImpactOrigin = new THREE.Vector3();
    this.lastWaterStruggleFx = 0;
    this.movement = null;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraSmoothedTarget = new THREE.Vector3(0, 0, 0);
    this.cameraRawTarget = new THREE.Vector3(0, 0, 0);
    this.cameraOffset = new THREE.Vector3();
    this.cameraDesired = new THREE.Vector3();
    this.renderRequested = null;
    this.lastMilestone = 0;
    this.lastNearMissAt = 0;
    this.touchStart = null;
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handlePointerCancel = this._handlePointerCancel.bind(this);
    this._resize = this._resize.bind(this);
    this._animate = this._animate.bind(this);

    this.resizeObserver = new ResizeObserver(this._resize);
    this.resizeObserver.observe(this.container);
    window.addEventListener('keydown', this._handleKeyDown);
    this.renderer.domElement.addEventListener('pointerdown', this._handlePointerDown, { passive: true });
    this.renderer.domElement.addEventListener('pointermove', this._handlePointerMove, { passive: true });
    this.renderer.domElement.addEventListener('pointerup', this._handlePointerUp, { passive: true });
    this.renderer.domElement.addEventListener('pointercancel', this._handlePointerCancel, { passive: true });

    this._setupLights();
    this.reset(false);
    this._resize();
    this._warmUpRenderer();
    this.callbacks.onReady({ highScore: this.highScore });
    this.callbacks.onHighScore(this.highScore);
    this.renderRequested = requestAnimationFrame(this._animate);
  }

  _warmUpRenderer() {
    try {
      this.renderer.compile?.(this.scene, this.camera);
      this.renderer.render(this.scene, this.camera);
    } catch {
      // Shader warm-up is a performance optimization only. Gameplay still works.
    }
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.62);
    this.scene.add(ambient);

    this.sunTarget = new THREE.Object3D();
    this.sunTarget.position.set(0, 0, 0);
    this.scene.add(this.sunTarget);

    const sunlight = new THREE.DirectionalLight(0xffffff, 1.18);
    sunlight.position.set(-180, -220, 420);
    sunlight.target = this.sunTarget;
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.width = this.renderProfile.shadowMapSize;
    sunlight.shadow.mapSize.height = this.renderProfile.shadowMapSize;
    sunlight.shadow.camera.left = -1050;
    sunlight.shadow.camera.right = 1050;
    sunlight.shadow.camera.top = 1050;
    sunlight.shadow.camera.bottom = -1050;
    sunlight.shadow.camera.near = 8;
    sunlight.shadow.camera.far = 1900;
    sunlight.shadow.bias = -0.00008;
    sunlight.shadow.normalBias = 0.028;
    this.sunlight = sunlight;
    this.scene.add(sunlight);

    const rim = new THREE.DirectionalLight(0xffffff, 0.18);
    rim.position.set(260, 180, 220);
    this.scene.add(rim);
  }

  reset(startImmediately = false) {
    this.restartPrepared = false;
    this.isPlaying = Boolean(startImmediately);
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.isGameOver = false;
    this.isImpacting = false;
    this.impactStartedAt = 0;
    this.impactVector.set(0, 0);
    this.cheatRespawnPending = false;
    this.cheatRespawnPosition = null;
    this.invulnerableUntil = 0;
    this.moveQueue = [];
    this.movement = null;
    this.playerPosition = { row: 0, tile: 0 };
    this.highestRow = 0;
    this.score = 0;
    this.lastMilestone = 0;
    this.lastNearMissAt = 0;
    this.runStartingHighScore = this.highScore;
    this.newRecordThisRun = false;
    this.newRecordScore = 0;
    this.activeRidePlankId = null;
    this.minPlayableRow = 0;
    this.prunedRowDataBefore = 0;

    disposeDynamicMaterials(this.worldGroup);
    disposeDynamicMaterials(this.vehicleGroup);
    disposeDynamicMaterials(this.fxGroup);
    this.worldGroup.clear();
    this.vehicleGroup.clear();
    this.fxGroup.clear();
    this.vehicles = [];
    this.planks = [];
    this.fxItems = [];
    this.trafficRows.clear();
    this.waterRows.clear();
    this.waterFlowRows.clear();
    this.waterFlowItems = [];
    this.rowGroups.clear();

    if (this.player) {
      this.scene.remove(this.player);
      this.player = null;
    }

    this.rows = createInitialRows(PREGENERATE_ROWS);
    this.foundation = createFoundation(this.geometries, this.materials);
    this.worldGroup.add(this.foundation);

    this.rows.forEach((row) => this._addRow(row));

    this.player = createPlayer(this.geometries, this.materials);
    this.scene.add(this.player);
    this._setPlayerWorldPosition(0, 0);
    this._updateCamera(true);
    this.callbacks.onScore(0);
  }

  start() {
    if (this.isGameOver && !this.restartPrepared) this.reset(false);
    this.isGameOver = false;
    this.isImpacting = false;
    this.isPlaying = true;
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.restartPrepared = false;
  }

  prepareRestart() {
    if (!this.isGameOver || this.isImpacting || this.restartPrepared) return false;
    this.reset(false);
    this.restartPrepared = true;
    this.isGameOver = true;
    this.isPlaying = false;
    return true;
  }

  pause() {
    if (!this.isImpacting) {
      this.isPlaying = false;
      this.isUiPaused = true;
      this.lastPausedRenderAt = 0;
    }
  }

  resume() {
    if (!this.isGameOver && !this.isImpacting) {
      this.isPlaying = true;
      this.isUiPaused = false;
      this.lastPausedRenderAt = 0;
      this.clock.getDelta();
    }
  }

  resetHighScore() {
    this.highScore = 0;
    this.runStartingHighScore = 0;
    this.newRecordThisRun = false;
    this.newRecordScore = 0;
    clearHighScore();
    this.callbacks.onHighScore(0);
    return 0;
  }

  getSaveState(extra = {}) {
    return {
      version: 1,
      savedAt: Date.now(),
      row: this.playerPosition.row,
      tile: this.playerPosition.tile,
      highestRow: this.highestRow,
      score: this.score,
      highScore: this.highScore,
      ...extra
    };
  }

  loadSaveState(state, startImmediately = true) {
    const row = Math.max(0, Math.floor(Number(state?.row) || 0));
    const tile = clamp(Math.floor(Number(state?.tile) || 0), MIN_TILE, MAX_TILE);
    const score = Math.max(0, Math.floor(Number(state?.score) || row));
    const highestRow = Math.max(score, Math.floor(Number(state?.highestRow) || row));

    this.reset(false);
    extendRows(this.rows, row + 38);
    this._addRowsAround(row, 42, 24);

    this.playerPosition = { row, tile };
    this.highestRow = highestRow;
    this.score = score;
    this.lastMilestone = Math.floor(score / this.options.milestoneEvery) * this.options.milestoneEvery;
    this.minPlayableRow = Math.max(0, row - 24);
    this.prunedRowDataBefore = Math.max(0, row - 32);
    this.moveQueue = [];
    this.movement = null;
    this.isGameOver = false;
    this.isImpacting = false;
    this.isPlaying = Boolean(startImmediately);
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.activeRidePlankId = null;
    this.invulnerableUntil = performance.now() + 1200;
    this.waterGraceUntil = this.invulnerableUntil;
    this._setPlayerWorldPosition(row, tile);
    this._pruneRowsBehindPlayer();
    this._clearSpawnAroundPlayer(2, 210);
    this._updateCamera(true);
    this.callbacks.onScore(this.score);
    this.callbacks.onHighScore(this.highScore);
    return this.getSaveState();
  }

  continueAfterLife(invulnerableMs = 1200) {
    if (!this.player) return false;
    this.isGameOver = false;
    this.isImpacting = false;
    this.isPlaying = true;
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.moveQueue = [];
    this.movement = null;
    this.activeRidePlankId = null;
    this.cheatRespawnPending = false;
    this.cheatRespawnPosition = null;

    this.invulnerableUntil = performance.now() + invulnerableMs;
    this.waterGraceUntil = this.invulnerableUntil;
    this._setPlayerWorldPosition(this.playerPosition.row, this.playerPosition.tile);
    this.player.rotation.set(0, 0, this.player.rotation.z);
    this.player.scale.setScalar(this.player.userData.baseScale || 0.62);
    this.player.visible = true;
    this._clearSpawnAroundPlayer(2, 220);
    this._updateCamera(true);
    return true;
  }

  setCheatMode(enabled) {
    this.cheatMode = Boolean(enabled);
    if (!this.cheatMode) {
      this.cheatRespawnPending = false;
      this.invulnerableUntil = 0;
      if (this.player) this.player.visible = true;
    }
  }

  queueMove(direction) {
    if (!DIRECTIONS.has(direction)) return false;
    if (!this.isPlaying || this.isGameOver || this.isImpacting) return false;
    if (this.moveQueue.length > 2) return false;

    const from = this._plannedPosition();
    const delta = DIR_TO_DELTA[direction];
    const to = { row: from.row + delta.row, tile: from.tile + delta.tile };
    if (!this._canMoveTo(to.row, to.tile)) {
      this._triggerBlockedBump(direction, from);
      return false;
    }

    this.moveQueue.push(direction);
    if (!this.movement) this._beginNextMove();
    return true;
  }

  destroy() {
    if (this.renderRequested) cancelAnimationFrame(this.renderRequested);
    window.removeEventListener('keydown', this._handleKeyDown);
    this.renderer.domElement.removeEventListener('pointerdown', this._handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this._handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this._handlePointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this._handlePointerCancel);
    this.resizeObserver.disconnect();

    if (this.player) this.scene.remove(this.player);
    disposeObject3D(this.scene);

    Object.values(this.geometries).forEach((geometry) => geometry.dispose?.());
    Object.values(this.materials).forEach((material) => material.dispose?.());
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }

  _addRow(row) {
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
        this.vehicleGroup.add(vehicleGroup);
        this.vehicles.push(vehicleGroup);
        laneVehicles.push(vehicleGroup);
      });
      this.trafficRows.set(row.index, laneVehicles);
    }

    if (row.type === 'rail') {
      row.trains.forEach((train) => {
        const trainGroup = createTrain(train, row, this.geometries, this.materials);
        this.vehicleGroup.add(trainGroup);
        this.vehicles.push(trainGroup);
      });
    }

    if (row.type === 'water') {
      const lanePlanks = [];
      row.planks.forEach((plank) => {
        const plankGroup = createPlank(plank, row, this.geometries, this.materials);
        this.vehicleGroup.add(plankGroup);
        this.planks.push(plankGroup);
        lanePlanks.push(plankGroup);
      });
      this.waterRows.set(row.index, lanePlanks);
    }
  }

  _addRowsAround(centerRow, forwardRows = 42, backwardRows = 24) {
    const start = Math.max(0, centerRow - backwardRows);
    const end = Math.min(this.rows.length - 1, centerRow + forwardRows);
    for (let index = start; index <= end; index += 1) {
      if (this.rows[index]) this._addRow(this.rows[index]);
    }
  }

  _clearSpawnAroundPlayer(rowRadius = 2, clearRadius = 190) {
    if (!this.player) return;
    const playerX = this.player.position.x;

    this.vehicles.forEach((obstacle) => {
      const data = obstacle.userData || {};
      if (!Number.isFinite(data.rowIndex)) return;
      if (Math.abs(data.rowIndex - this.playerPosition.row) > rowRadius) return;

      const halfWidth = (data.width || 72) * 0.5;
      const safetyRadius = clearRadius + halfWidth;
      if (Math.abs(obstacle.position.x - playerX) >= safetyRadius) return;

      const direction = data.direction || (obstacle.position.x >= playerX ? 1 : -1);
      const margin = data.type === 'train' ? TRAIN_SAFE_MARGIN : VEHICLE_SAFE_MARGIN;
      const { minX, maxX } = laneBounds(margin);
      const preferredX = playerX + direction * safetyRadius;
      const fallbackX = playerX - direction * safetyRadius;
      obstacle.position.x = preferredX >= minX - halfWidth && preferredX <= maxX + halfWidth
        ? preferredX
        : clamp(fallbackX, minX - halfWidth, maxX + halfWidth);

      if (data.currentSpeed && data.baseSpeed) {
        data.currentSpeed = Math.min(data.currentSpeed, data.baseSpeed);
      }
    });
  }

  _plannedPosition() {
    let row = this.playerPosition.row;
    let tile = this.playerPosition.tile;
    if (this.movement) {
      row = this.movement.to.row;
      tile = this.movement.to.tile;
    }
    this.moveQueue.forEach((direction) => {
      const delta = DIR_TO_DELTA[direction];
      row += delta.row;
      tile += delta.tile;
    });
    return { row, tile };
  }

  _canMoveTo(row, tile) {
    if (row < this.minPlayableRow) return false;
    if (row < 0 || tile < MIN_TILE || tile > MAX_TILE) return false;
    extendRows(this.rows, row + 18);
    this._addRowsAround(row, 24, 24);
    const targetRow = this.rows[row];
    if (!targetRow) return false;
    if (this._isTileBlocked(targetRow, tile)) return false;
    return true;
  }

  _isTileBlocked(row, tile) {
    if (!row || !Number.isInteger(tile)) return true;
    return row.blockers?.has(tile) === true;
  }

  _triggerBlockedBump(direction, from = this.playerPosition) {
    if (this.isImpacting || this.isGameOver || !this.isPlaying || !this.player) return false;

    const delta = DIR_TO_DELTA[direction];
    if (!delta) return false;

    // If the user taps into a blocker while the chicken is still doing a normal
    // hop, do not silently queue a move into the blocker. The next tap after
    // landing will get a full visible bump.
    if (this.movement && !this.movement.blocked) {
      this.moveQueue = [];
      return false;
    }

    const baseRow = Number.isFinite(from.row) ? from.row : this.playerPosition.row;
    const baseTile = Number.isFinite(from.tile) ? from.tile : this.playerPosition.tile;
    const fromX = tileToX(baseTile, TILE_SIZE);
    const fromY = rowToY(baseRow, TILE_SIZE);
    const standZ = this._getPlayerStandZ(baseRow, baseTile);
    const bumpDistance = TILE_SIZE * 0.46;

    this.movement = {
      blocked: true,
      direction,
      startedAt: performance.now(),
      duration: Math.max(235, MOVE_DURATION * 1.42),
      from: { row: baseRow, tile: baseTile },
      to: { row: baseRow, tile: baseTile },
      fromX,
      fromY,
      fromZ: standZ,
      toX: fromX + delta.tile * bumpDistance,
      toY: fromY + delta.row * bumpDistance,
      toZ: standZ
    };

    this.moveQueue = [];
    this.callbacks.onBlocked({ direction, from: { row: baseRow, tile: baseTile } });
    return true;
  }

  _beginNextMove() {
    if (this.isImpacting || this.isGameOver || !this.isPlaying) return;
    if (this.movement || this.moveQueue.length === 0) return;
    const direction = this.moveQueue.shift();
    const delta = DIR_TO_DELTA[direction];
    const from = { ...this.playerPosition };
    const to = { row: from.row + delta.row, tile: from.tile + delta.tile };

    if (!this._canMoveTo(to.row, to.tile)) return;

    this.movement = {
      direction,
      startedAt: performance.now(),
      from,
      to,
      fromX: tileToX(from.tile, TILE_SIZE),
      fromY: rowToY(from.row, TILE_SIZE),
      fromZ: this.player?.position.z ?? this._getPlayerStandZ(from.row, from.tile),
      toX: tileToX(to.tile, TILE_SIZE),
      toY: rowToY(to.row, TILE_SIZE),
      toZ: this._getPlayerStandZ(to.row, to.tile)
    };

    this.callbacks.onMoveStart({ direction, from, to });
  }

  _completeMove() {
    if (!this.movement) return;
    const completedDirection = this.movement.direction;
    this.playerPosition = { ...this.movement.to };
    this._setPlayerWorldPosition(this.playerPosition.row, this.playerPosition.tile, completedDirection);
    const landedRow = this.rows[this.playerPosition.row];
    if (this._isTileBlocked(landedRow, this.playerPosition.tile)) {
      // Regression guard for late-game decorative trees: if a queued/rapid input
      // somehow lands on a solid tree footprint, snap back instead of allowing a
      // visual tree penetration. Normal movement is already blocked in _canMoveTo.
      this.playerPosition = { ...this.movement.from };
      this._setPlayerWorldPosition(this.playerPosition.row, this.playerPosition.tile, completedDirection);
      this.movement = null;
      this.moveQueue = [];
      return;
    }
    // Water must be decided on landing. Without this guard, a fast repeated tap can
    // queue the next hop and let the chicken cross water without touching a plank.
    this.waterGraceUntil = landedRow?.type === 'water' ? 0 : performance.now() + 105;
    this.movement = null;
    if (landedRow?.type !== 'water' && this.activeRidePlankId) {
      const lastPlank = this.planks.find((plank) => plank.uuid === this.activeRidePlankId);
      if (lastPlank) lastPlank.userData.riderSince = 0;
      this.activeRidePlankId = null;
    }
    if (landedRow?.type === 'water') {
      const supportingPlank = this._findSupportingPlank();
      if (!supportingPlank) {
        this._updateWaterState(0);
        if (this.isImpacting || this.isGameOver) return;
      } else {
        const now = performance.now();
        this.activeRidePlankId = supportingPlank.uuid;
        supportingPlank.userData.riderSince = now;
        this.waterGraceUntil = now + 180;
      }
    }

    if (this.playerPosition.row > this.highestRow) {
      this.highestRow = this.playerPosition.row;
      this.score = this.highestRow;
      this.callbacks.onScore(this.score);

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.newRecordThisRun = true;
        this.newRecordScore = this.score;
        writeHighScore(this.highScore);
        this.callbacks.onHighScore(this.highScore);
      }

      if (
        this.options.enableMilestoneCallback &&
        this.options.milestoneEvery > 0 &&
        this.score % this.options.milestoneEvery === 0 &&
        this.score !== this.lastMilestone
      ) {
        this.lastMilestone = this.score;
        this.callbacks.onMilestone({ row: this.score, score: this.score });
      }
    }

    extendRows(this.rows, this.playerPosition.row + 38);
    this._addRowsAround(this.playerPosition.row, 42, 24);
    this._pruneRowsBehindPlayer();

    this._beginNextMove();
  }

  _pruneRowsBehindPlayer() {
    const keepFromRow = Math.max(0, this.playerPosition.row - 24);
    const pruneDataBefore = Math.max(0, keepFromRow - 8);
    this.minPlayableRow = keepFromRow;

    for (const [rowIndex, rowGroup] of this.rowGroups) {
      if (rowIndex >= keepFromRow) continue;
      disposeDynamicMaterials(rowGroup);
      this.worldGroup.remove(rowGroup);
      this.rowGroups.delete(rowIndex);
      this.waterFlowRows.delete(rowIndex);
    }

    const pruneMovingItem = (item) => {
      if ((item.userData?.rowIndex ?? 0) >= keepFromRow) return false;
      disposeDynamicMaterials(item);
      this.vehicleGroup.remove(item);
      return true;
    };

    this.vehicles = this.vehicles.filter((vehicle) => !pruneMovingItem(vehicle));
    this.planks = this.planks.filter((plank) => !pruneMovingItem(plank));

    for (const rowIndex of Array.from(this.trafficRows.keys())) {
      if (rowIndex < keepFromRow) this.trafficRows.delete(rowIndex);
    }
    for (const rowIndex of Array.from(this.waterRows.keys())) {
      if (rowIndex < keepFromRow) this.waterRows.delete(rowIndex);
    }

    this.waterFlowItems = [];
    this.waterFlowRows.forEach((items) => {
      this.waterFlowItems.push(...items);
    });

    for (let index = this.prunedRowDataBefore; index < pruneDataBefore; index += 1) {
      if (this.rows[index]) this.rows[index] = null;
    }
    this.prunedRowDataBefore = Math.max(this.prunedRowDataBefore, pruneDataBefore);
  }

  _getPlayerStandZ(rowIndex, tile) {
    const row = this.rows[rowIndex];
    if (!row) return 0;

    if (row.type === 'rail') return PLAYER_RAIL_STAND_Z;

    if (row.type === 'water') {
      const x = tileToX(tile, TILE_SIZE);
      const y = rowToY(rowIndex, TILE_SIZE);
      const supportingPlank = this._findSupportingPlankAt(x, y);
      if (supportingPlank) return supportingPlank.position.z + PLAYER_PLANK_STAND_Z;
    }

    return 0;
  }

  _setPlayerWorldPosition(row, tile, direction = 'forward') {
    if (!this.player) return;
    const standZ = this._getPlayerStandZ(row, tile);
    this.player.position.set(tileToX(tile, TILE_SIZE), rowToY(row, TILE_SIZE), standZ);
    const baseScale = this.player.userData.baseScale || 0.72;
    this.player.scale.setScalar(baseScale);
    this._facePlayer(direction, 0);
  }

  _facePlayer(direction, tilt = 0) {
    if (!this.player) return;
    const facing = {
      forward: 0,
      backward: Math.PI,
      left: Math.PI / 2,
      right: -Math.PI / 2
    }[direction] ?? 0;
    this.player.rotation.set(tilt, 0, facing);
  }

  _animate() {
    const delta = Math.min(this.clock.getDelta(), 0.035);

    if (this.isUiPaused && !this.isImpacting) {
      const nowMs = performance.now();
      if (nowMs - this.lastPausedRenderAt > 220) {
        this.lastPausedRenderAt = nowMs;
        this.renderer.render(this.scene, this.camera);
      }
      this.renderRequested = requestAnimationFrame(this._animate);
      return;
    }

    if (this.isImpacting) {
      this._updateVehicles(delta * 0.12);
      this._updateImpactEffect();
    } else if (this.isPlaying && !this.isGameOver) {
      this._updateVehicles(delta);
      this._updatePlayerMovement();
      this._updateWaterState(delta);
      this._checkTrafficCollision();
      if (!this.isImpacting) this._checkNearMiss();
      this._checkHazardSound();
    } else {
      this._updateVehicles(delta * 0.32);
    }

    this._updateWaterFlow(delta);
    this._updateFx(delta);
    this._updateGhostBlink();
    this._updateCamera(false, delta);
    if (this.isImpacting) this._applyCameraShake();
    this.renderer.render(this.scene, this.camera);
    this.renderRequested = requestAnimationFrame(this._animate);
  }

  _updatePlayerMovement() {
    if (!this.movement) {
      this._beginNextMove();
      return;
    }

    const elapsed = performance.now() - this.movement.startedAt;
    const duration = this.movement.blocked ? (this.movement.duration || Math.max(235, MOVE_DURATION * 1.42)) : MOVE_DURATION;
    const t = clamp(elapsed / duration, 0, 1);

    if (this.movement.blocked) {
      const duration = this.movement.duration || Math.max(235, MOVE_DURATION * 1.42);
      const tt = clamp(elapsed / duration, 0, 1);
      const outPhase = tt < 0.38 ? easeOutCubic(tt / 0.38) : 1 - easeOutCubic((tt - 0.38) / 0.62);
      const rebound = Math.sin(Math.PI * tt * 3.1) * Math.max(0, 1 - tt) * 0.13;
      const outward = Math.max(0, Math.min(1.12, outPhase + rebound));
      const hop = Math.sin(Math.PI * outward) * 15 + Math.sin(Math.PI * tt) * 3;
      const x = lerp(this.movement.fromX, this.movement.toX, outward);
      const y = lerp(this.movement.fromY, this.movement.toY, outward);
      this.player.position.set(x, y, (this.movement.fromZ || 0) + hop);

      const baseScale = this.player.userData.baseScale || 0.72;
      const squash = Math.sin(Math.PI * tt) * 0.16;
      const pop = Math.sin(Math.PI * Math.min(1, tt * 1.35)) * 0.08;
      this.player.scale.set(baseScale * (1 + squash), baseScale * (1 + squash * 0.72), baseScale * (1 - squash * 0.55 + pop));

      const tiltAmount = (0.22 * Math.sin(Math.PI * outward)) + (0.08 * Math.sin(Math.PI * tt * 4) * (1 - tt));
      const tilt = this.movement.direction === 'backward' ? -tiltAmount : tiltAmount;
      this._facePlayer(this.movement.direction, tilt);

      if (t >= 1) {
        this._setPlayerWorldPosition(this.movement.from.row, this.movement.from.tile, this.movement.direction);
        this.movement = null;
      }
      return;
    }

    const eased = easeInOutCubic(t);
    const hop = Math.sin(Math.PI * easeInOutQuad(t)) * 13;

    const x = lerp(this.movement.fromX, this.movement.toX, eased);
    const y = lerp(this.movement.fromY, this.movement.toY, eased);
    const surfaceZ = lerp(this.movement.fromZ || 0, this.movement.toZ || 0, eased);
    this.player.position.set(x, y, surfaceZ + hop);

    const tiltAmount = 0.16 * Math.sin(Math.PI * t);
    const tilt = this.movement.direction === 'backward' ? -tiltAmount : tiltAmount;
    this._facePlayer(this.movement.direction, tilt);

    if (t >= 1) this._completeMove();
  }

  _updateVehicles(delta) {
    const trains = [];
    this.vehicles.forEach((vehicle) => {
      if (vehicle.userData.type === 'train') trains.push(vehicle);
    });

    trains.forEach((train) => this._updateFreeMovingObstacle(train, delta, TRAIN_SAFE_MARGIN));

    this.waterRows.forEach((items) => {
      this._updateSmartPlankLane(items, delta);
    });

    this.trafficRows.forEach((items) => {
      this._updateSmartTrafficLane(items, delta);
    });
  }

  _updateWaterFlow(delta) {
    if (!this.waterFlowItems.length) return;
    const boardWrap = (MAX_TILE - MIN_TILE + 12) * TILE_SIZE;
    this.waterFlowItems.forEach((item) => {
      const data = item.userData.waterFlow;
      if (!data) return;
      data.age = (data.age || 0) + delta;
      item.position.x += data.speed * delta;
      item.position.y = data.baseY + Math.sin(data.age * data.rate + data.phase) * data.amp;
      const wrap = data.wrap || boardWrap;
      if (item.position.x > wrap) item.position.x -= wrap * 2;
      if (item.position.x < -wrap) item.position.x += wrap * 2;
      const pulse = 0.84 + Math.sin(data.age * 4.5 + data.phase) * 0.12;
      item.scale.y = Math.max(0.72, pulse);
    });
  }

  _updateFreeMovingObstacle(vehicle, delta, margin) {
    if (vehicle.userData.sinking) return;
    const { direction, speed, width } = vehicle.userData;
    const { minX, maxX } = laneBounds(margin);
    vehicle.position.x += direction * speed * delta;

    if (direction > 0 && vehicle.position.x > maxX + width) {
      vehicle.position.x = minX - width;
    } else if (direction < 0 && vehicle.position.x < minX - width) {
      vehicle.position.x = maxX + width;
    }
  }

  _updateSmartTrafficLane(items, delta) {
    if (!items.length) return;

    const direction = items[0].userData.direction;
    const maxVehicleWidth = Math.max(...items.map((vehicle) => vehicle.userData.width));
    const { minX, maxX } = laneBounds(VEHICLE_SAFE_MARGIN);
    const wrapMin = minX - maxVehicleWidth;
    const wrapMax = maxX + maxVehicleWidth;
    const span = wrapMax - wrapMin;

    if (items.length === 1) {
      this._updateFreeMovingObstacle(items[0], delta, VEHICLE_SAFE_MARGIN);
      return;
    }

    const sorted = items
      .map((vehicle) => ({
        vehicle,
        progress: laneProgress(vehicle, direction, wrapMin, wrapMax)
      }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const item = sorted[i];
      const front = i === sorted.length - 1 ? sorted[0] : sorted[i + 1];
      const currentData = item.vehicle.userData;
      const frontData = front.vehicle.userData;
      const frontProgress = front.progress + (i === sorted.length - 1 ? span : 0);
      const rawGap = frontProgress - item.progress - (currentData.width + frontData.width) * 0.5;
      const aggression = currentData.aggression ?? 0.35;
      const currentSpeed = currentData.currentSpeed || currentData.baseSpeed;
      const frontSpeed = frontData.currentSpeed || frontData.baseSpeed;
      const dynamicGap = Math.min(118, currentSpeed * (0.16 + (1 - aggression) * 0.18));
      const hardGap = Math.max(currentData.minFollowGap || TRAFFIC_MIN_GAP, TRAFFIC_MIN_GAP + currentData.width * 0.1);
      const comfortGap = hardGap + TRAFFIC_COMFORT_GAP + dynamicGap;
      const openRoadGap = comfortGap + 92 + aggression * 90;
      let targetSpeed = currentData.cruiseSpeed || currentData.baseSpeed;

      if (rawGap < hardGap) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, frontSpeed * (0.42 + aggression * 0.18)));
      } else if (rawGap < comfortGap) {
        const ratio = clamp((rawGap - hardGap) / (comfortGap - hardGap), 0, 1);
        const followSpeed = frontSpeed * (0.72 + 0.24 * ratio);
        targetSpeed = Math.min(targetSpeed, followSpeed + (8 + aggression * 18) * ratio);
      } else if (rawGap > openRoadGap && aggression > 0.48) {
        const overtakePulse = Math.sin((performance.now() * 0.0017) + currentData.rowIndex + currentData.width) * 0.5 + 0.5;
        targetSpeed = Math.min(currentData.maxSpeed || currentData.baseSpeed, targetSpeed * (1.04 + aggression * 0.18 + overtakePulse * 0.08));
      }

      const speedDelta = targetSpeed - currentSpeed;
      const accel = speedDelta >= 0 ? currentData.acceleration || 46 : currentData.brakePower || 128;
      const maxStep = accel * delta;
      currentData.currentSpeed = clamp(currentSpeed + clamp(speedDelta, -maxStep, maxStep), 0, currentData.maxSpeed || currentData.baseSpeed * 1.2);
    }

    items.forEach((vehicle) => {
      const { width } = vehicle.userData;
      vehicle.position.x += direction * vehicle.userData.currentSpeed * delta;

      if (direction > 0 && vehicle.position.x > wrapMax + width * 0.5) {
        vehicle.position.x = wrapMin - width * 0.5;
      } else if (direction < 0 && vehicle.position.x < wrapMin - width * 0.5) {
        vehicle.position.x = wrapMax + width * 0.5;
      }
    });

    const settled = items
      .map((vehicle) => ({
        vehicle,
        progress: laneProgress(vehicle, direction, wrapMin, wrapMax)
      }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = settled.length - 1; i >= 0; i -= 1) {
      const item = settled[i];
      const front = i === settled.length - 1 ? settled[0] : settled[i + 1];
      const currentData = item.vehicle.userData;
      const frontData = front.vehicle.userData;
      const frontProgress = front.progress + (i === settled.length - 1 ? span : 0);
      const minGap = TRAFFIC_MIN_GAP + Math.max(currentData.width, frontData.width) * 0.18;
      const requiredProgress = frontProgress - (currentData.width + frontData.width) * 0.5 - minGap;
      if (item.progress > requiredProgress) {
        const clampedProgress = requiredProgress;
        item.progress = clampedProgress;
        item.vehicle.position.x = direction > 0 ? wrapMin + clampedProgress : wrapMax - clampedProgress;
        currentData.currentSpeed = Math.min(currentData.currentSpeed || currentData.baseSpeed, frontData.currentSpeed || frontData.baseSpeed);
      }
    }
  }


  _updateSmartPlankLane(items, delta) {
    if (!items.length) return;
    const direction = items[0].userData.direction;
    const maxWidth = Math.max(...items.map((plank) => plank.userData.width));
    const { minX, maxX } = laneBounds(WATER_SAFE_MARGIN);
    const wrapMin = minX - maxWidth;
    const wrapMax = maxX + maxWidth;
    const span = wrapMax - wrapMin;

    const sorted = items
      .map((plank) => ({ plank, progress: laneProgress(plank, direction, wrapMin, wrapMax) }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const item = sorted[i];
      const front = i === sorted.length - 1 ? sorted[0] : sorted[i + 1];
      const data = item.plank.userData;
      const frontData = front.plank.userData;

      if (data.sinking) {
        this._updatePlankSink(item.plank, delta);
        continue;
      }

      const frontProgress = front.progress + (i === sorted.length - 1 ? span : 0);
      const gap = frontProgress - item.progress - (data.width + frontData.width) * 0.5;
      let targetSpeed = data.baseSpeed;
      if (!frontData.sinking && gap < WATER_PLANK_MIN_GAP) {
        targetSpeed = Math.min(targetSpeed, (frontData.currentSpeed || frontData.baseSpeed) * 0.82);
      }

      data.currentSpeed = lerp(data.currentSpeed || data.baseSpeed, targetSpeed, 0.16);
    }

    items.forEach((plank) => {
      const data = plank.userData;
      if (data.sinking) return;
      if (!data.riderSince && Math.abs(plank.position.z) > 0.05) {
        plank.position.z = lerp(plank.position.z, 0, 0.12);
        plank.rotation.x = lerp(plank.rotation.x, 0, 0.12);
        plank.scale.z = lerp(plank.scale.z, 1, 0.12);
        plank.scale.y = lerp(plank.scale.y, 1, 0.12);
      }
      plank.position.x += direction * (data.currentSpeed || data.baseSpeed) * delta;
      if (direction > 0 && plank.position.x > wrapMax + data.width * 0.5) {
        plank.position.x = wrapMin - data.width * 0.5;
        data.riderSince = 0;
      } else if (direction < 0 && plank.position.x < wrapMin - data.width * 0.5) {
        plank.position.x = wrapMax + data.width * 0.5;
        data.riderSince = 0;
      }
    });
  }

  _sinkPlank(plank, forced = false) {
    if (!plank || plank.userData.sinking) return;
    plank.userData.sinking = true;
    plank.userData.sinkStartedAt = performance.now();
    plank.userData.forcedSink = forced;
  }

  _updatePlankSink(plank) {
    const startedAt = plank.userData.sinkStartedAt || performance.now();
    const t = clamp((performance.now() - startedAt) / 900, 0, 1);
    plank.position.z = -22 * easeInOutQuad(t);
    plank.rotation.x = Math.sin(t * Math.PI) * 0.16 * plank.userData.direction;
    plank.scale.z = Math.max(0.16, 1 - t * 0.72);
    plank.scale.y = Math.max(0.68, 1 - t * 0.22);

    if (t >= 1) {
      const { minX, maxX } = laneBounds(WATER_SAFE_MARGIN);
      const width = plank.userData.width;
      plank.position.x = plank.userData.direction > 0 ? minX - WATER_SAFE_MARGIN - width : maxX + WATER_SAFE_MARGIN + width;
      plank.position.z = 0;
      plank.rotation.x = 0;
      plank.scale.set(1, 1, 1);
      plank.userData.sinking = false;
      plank.userData.riderSince = 0;
      plank.userData.currentSpeed = plank.userData.baseSpeed;
    }
  }

  _spawnSplash(x, y) {
    const foam = this.materials.waterFoam;
    const bright = this.materials.waterBright;
    const makeDrop = (index, ring = 0) => {
      const geometry = new THREE.BoxGeometry(4 + (index % 4) * 1.8, 2.5 + ring, 3.5 + (index % 3) * 1.4);
      const drop = new THREE.Mesh(geometry, index % 3 === 0 ? bright : foam);
      drop.position.set(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 9,
        3 + ring * 2 + Math.random() * 5
      );
      drop.castShadow = false;
      drop.receiveShadow = false;
      const angle = (Math.PI * 2 * index) / 27 + ring * 0.21;
      const radius = 42 + ring * 20 + (index % 6) * 7;
      drop.userData = {
        age: 0,
        life: 0.68 + Math.random() * 0.22,
        vx: Math.cos(angle) * radius,
        vy: Math.sin(angle) * radius * 0.62,
        vz: 86 + ring * 20 + Math.random() * 45,
        gravity: 220,
        rx: (Math.random() - 0.5) * 8,
        ry: (Math.random() - 0.5) * 8,
        rz: (Math.random() - 0.5) * 12,
        scaleEnd: 0.05
      };
      this.fxGroup.add(drop);
      this.fxItems.push(drop);
    };

    for (let i = 0; i < 34; i += 1) makeDrop(i, i % 2);
  }

  _spawnWaterBubbles(x, y) {
    const material = this.materials.waterFoam;
    for (let i = 0; i < 14; i += 1) {
      const geometry = new THREE.BoxGeometry(3 + (i % 3), 2, 2 + (i % 4));
      const bubble = new THREE.Mesh(geometry, material);
      bubble.position.set(
        x + (Math.random() - 0.5) * 42,
        y + (Math.random() - 0.5) * 28,
        -6 + Math.random() * 5
      );
      bubble.castShadow = false;
      bubble.receiveShadow = false;
      bubble.userData = {
        age: 0,
        life: 0.42 + Math.random() * 0.18,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 0.5) * 16,
        vz: 28 + Math.random() * 18
      };
      this.fxGroup.add(bubble);
      this.fxItems.push(bubble);
    }
  }

  _spawnChickenImpactDebris(x, y, z, direction = 1, reason = 'traffic') {
    const trainHit = reason === 'train';
    const featherCount = trainHit ? 30 : 22;
    const bloodCount = trainHit ? 20 : 13;
    const forwardPush = direction >= 0 ? 1 : -1;

    for (let i = 0; i < featherCount; i += 1) {
      const large = i % 4 === 0;
      const geometry = new THREE.BoxGeometry(
        large ? 3.6 : 2.7,
        large ? 12.5 : 9.5,
        1.2
      );
      const material = i % 5 === 0
        ? this.materials.featherShade
        : i % 7 === 0
          ? this.materials.featherTip
          : this.materials.featherWhite;
      const feather = new THREE.Mesh(geometry, material);
      feather.position.set(
        x + (Math.random() - 0.5) * 11,
        y + (Math.random() - 0.5) * 9,
        z + 4 + Math.random() * 8
      );
      feather.castShadow = false;
      feather.receiveShadow = false;
      feather.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const side = (Math.random() - 0.5) * (trainHit ? 96 : 70);
      feather.userData = {
        kind: 'feather',
        age: 0,
        life: 0.95 + Math.random() * 0.58,
        vx: forwardPush * (trainHit ? 92 : 62) + (Math.random() - 0.5) * 70,
        vy: side,
        vz: trainHit ? 112 + Math.random() * 54 : 82 + Math.random() * 42,
        gravity: trainHit ? 96 : 86,
        flutter: 22 + Math.random() * 28,
        flutterRate: 11 + Math.random() * 9,
        seed: Math.random() * Math.PI * 2,
        rx: (Math.random() - 0.5) * 14,
        ry: (Math.random() - 0.5) * 13,
        rz: (Math.random() - 0.5) * 18,
        scaleEnd: 0.08
      };
      this.fxGroup.add(feather);
      this.fxItems.push(feather);
    }

    for (let i = 0; i < bloodCount; i += 1) {
      const size = 3.2 + Math.random() * 4.2;
      const geometry = new THREE.BoxGeometry(size, size, Math.max(1.8, size * 0.65));
      const drop = new THREE.Mesh(geometry, i % 3 === 0 ? this.materials.bloodDark : this.materials.blood);
      drop.position.set(
        x + forwardPush * (3 + Math.random() * 6),
        y + (Math.random() - 0.5) * 8,
        z + 4 + Math.random() * 10
      );
      drop.castShadow = false;
      drop.receiveShadow = false;
      drop.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      drop.userData = {
        kind: 'blood',
        age: 0,
        life: 0.72 + Math.random() * 0.32,
        vx: forwardPush * (62 + Math.random() * 64),
        vy: (Math.random() - 0.5) * 72,
        vz: 58 + Math.random() * 58,
        gravity: 185,
        rx: (Math.random() - 0.5) * 10,
        ry: (Math.random() - 0.5) * 10,
        rz: (Math.random() - 0.5) * 13,
        scaleEnd: 0.18
      };
      this.fxGroup.add(drop);
      this.fxItems.push(drop);
    }

    for (let i = 0; i < (trainHit ? 9 : 6); i += 1) {
      const sizeX = 5 + Math.random() * 10;
      const sizeY = 3 + Math.random() * 7;
      const geometry = new THREE.BoxGeometry(sizeX, sizeY, 1.2);
      const splat = new THREE.Mesh(geometry, i % 2 ? this.materials.blood : this.materials.bloodDark);
      splat.position.set(
        x + forwardPush * (8 + Math.random() * 34),
        y + (Math.random() - 0.5) * 34,
        3.2
      );
      splat.castShadow = false;
      splat.receiveShadow = false;
      splat.rotation.z = Math.random() * Math.PI;
      splat.userData = {
        kind: 'blood-splat',
        age: 0,
        life: 1.18 + Math.random() * 0.45,
        vx: forwardPush * (5 + Math.random() * 10),
        vy: (Math.random() - 0.5) * 8,
        vz: 0,
        gravity: 0,
        scaleEnd: 0.28
      };
      this.fxGroup.add(splat);
      this.fxItems.push(splat);
    }
  }

  _updateFx(delta) {
    if (!this.fxItems.length) return;
    for (let i = this.fxItems.length - 1; i >= 0; i -= 1) {
      const fx = this.fxItems[i];
      const data = fx.userData;
      data.age += delta;
      const t = clamp(data.age / data.life, 0, 1);
      const gravity = data.gravity ?? 140;

      if (data.kind === 'feather') {
        const flutter = Math.sin(data.age * data.flutterRate + data.seed) * data.flutter;
        const drift = Math.cos(data.age * (data.flutterRate * 0.72) + data.seed) * data.flutter * 0.42;
        fx.position.x += (data.vx + drift) * delta;
        fx.position.y += (data.vy + flutter) * delta;
        fx.position.z += data.vz * delta - gravity * delta * Math.max(0.18, t);
        fx.rotation.x += data.rx * delta;
        fx.rotation.y += data.ry * delta;
        fx.rotation.z += data.rz * delta;
      } else {
        fx.position.x += data.vx * delta;
        fx.position.y += data.vy * delta;
        fx.position.z += data.vz * delta - gravity * delta * t;
        fx.rotation.x += (data.rx ?? 0) * delta;
        fx.rotation.y += (data.ry ?? 0) * delta;
        fx.rotation.z += (data.rz ?? 5) * delta;
      }

      const scaleEnd = data.scaleEnd ?? 0.05;
      const scale = Math.max(scaleEnd, 1 - t * (1 - scaleEnd));
      fx.scale.setScalar(scale);
      if (t >= 1) {
        this.fxGroup.remove(fx);
        fx.geometry.dispose?.();
        this.fxItems.splice(i, 1);
      }
    }
  }


  _findSupportingPlankAt(playerX, playerY) {
    for (const plank of this.planks) {
      const { width, depth, sinking } = plank.userData;
      if (sinking) continue;
      if (Math.abs(playerY - plank.position.y) > (depth + PLAYER_DEPTH) * 0.62) continue;
      if (Math.abs(playerX - plank.position.x) <= (width + PLAYER_WIDTH) * 0.54) return plank;
    }
    return null;
  }

  _findSupportingPlank() {
    if (!this.player) return null;
    return this._findSupportingPlankAt(this.player.position.x, this.player.position.y);
  }

  _updateWaterState(delta) {
    if (!this.player || this.isImpacting || this.isGameOver || this.movement) return;
    if (performance.now() < this.invulnerableUntil) return;
    const row = this.rows[this.playerPosition.row];
    if (!row || row.type !== 'water') return;
    if (performance.now() < this.waterGraceUntil) return;

    const supportingPlank = this._findSupportingPlank();
    if (!supportingPlank) {
      this.activeRidePlankId = null;
      this._triggerImpact('water', null);
      return;
    }

    const now = performance.now();
    if (this.activeRidePlankId !== supportingPlank.uuid) {
      this.activeRidePlankId = supportingPlank.uuid;
      supportingPlank.userData.riderSince = now;
    } else if (!supportingPlank.userData.riderSince) {
      supportingPlank.userData.riderSince = now;
    }

    const drift = supportingPlank.userData.direction * supportingPlank.userData.currentSpeed * delta;
    this.player.position.x += drift;
    this.player.position.z = supportingPlank.position.z + PLAYER_PLANK_STAND_Z;
    const tile = clamp(Math.round(this.player.position.x / TILE_SIZE), MIN_TILE, MAX_TILE);
    this.playerPosition.tile = tile;

    const rideAge = now - (supportingPlank.userData.riderSince || now);
    const sinkWarning = clamp((rideAge - 850) / Math.max(1, PLANK_RIDE_LIMIT_MS - 850), 0, 1);
    if (sinkWarning > 0) {
      const easedSink = easeInOutQuad(sinkWarning);
      supportingPlank.position.z = -12 * easedSink;
      supportingPlank.rotation.x = Math.sin(sinkWarning * Math.PI * 3) * 0.055 * supportingPlank.userData.direction;
      supportingPlank.scale.z = Math.max(0.74, 1 - easedSink * 0.18);
      supportingPlank.scale.y = Math.max(0.88, 1 - easedSink * 0.08);
      this.player.position.z = supportingPlank.position.z + PLAYER_PLANK_STAND_Z;
    }
    const boardMin = MIN_TILE * TILE_SIZE;
    const boardMax = MAX_TILE * TILE_SIZE;
    const nearEdge = supportingPlank.position.x - supportingPlank.userData.width * 0.5 < boardMin + PLANK_EDGE_SINK_MARGIN
      || supportingPlank.position.x + supportingPlank.userData.width * 0.5 > boardMax - PLANK_EDGE_SINK_MARGIN;

    if (rideAge > PLANK_RIDE_LIMIT_MS || nearEdge) {
      this._sinkPlank(supportingPlank, true);
      this._triggerImpact('water', supportingPlank);
      return;
    }

    if (this.player.position.x < boardMin - 18 || this.player.position.x > boardMax + 18) {
      this._sinkPlank(supportingPlank, true);
      this._triggerImpact('water', supportingPlank);
    }
  }

  _checkHazardSound() {
    if (!this.player || this.isImpacting || this.isGameOver) return;
    const playerX = this.player.position.x;
    const playerRow = this.playerPosition.row;
    const now = performance.now();

    for (const obstacle of this.vehicles) {
      const { rowIndex, width, type, trainClass, direction, currentSpeed, baseSpeed } = obstacle.userData;
      if (Math.abs(rowIndex - playerRow) > 1) continue;
      const distance = Math.abs(playerX - obstacle.position.x);
      const speed = currentSpeed || baseSpeed || 0;
      if (type === 'train' && distance < width * 0.55 + 190 && (!obstacle.userData.lastSoundAt || now - obstacle.userData.lastSoundAt > 1900)) {
        obstacle.userData.lastSoundAt = now;
        this.callbacks.onHazardSound({ kind: trainClass === 'bullet' ? 'bulletTrain' : 'train', speed, direction });
        if (trainClass !== 'bullet') this.callbacks.onHazardSound({ kind: 'trainHorn', speed, direction });
      }
      if (type === 'vehicle' && rowIndex === playerRow) {
        const leadDistance = direction * (playerX - obstacle.position.x);
        const frontClearance = width * 0.5 + PLAYER_WIDTH * 0.5;
        const hornRange = frontClearance + 54;
        const chickenIsDirectlyAhead = leadDistance > frontClearance && leadDistance < hornRange;
        if (chickenIsDirectlyAhead && (!obstacle.userData.lastSoundAt || now - obstacle.userData.lastSoundAt > 1750)) {
          obstacle.userData.lastSoundAt = now;
          this.callbacks.onHazardSound({ kind: 'carHorn', speed, direction });
        }
      }
    }
  }

  _checkNearMiss() {
    if (!this.player || this.isImpacting || this.isGameOver || this.movement) return;
    const nowMs = performance.now();
    if (nowMs - this.lastNearMissAt < 1250) return;

    const row = this.rows[this.playerPosition.row];
    if (!row || !['traffic', 'rail'].includes(row.type)) return;

    const playerX = this.player.position.x;
    for (const obstacle of this.vehicles) {
      const { rowIndex, width, type, direction, currentSpeed, baseSpeed, trainClass } = obstacle.userData;
      if (rowIndex !== this.playerPosition.row) continue;
      if (type !== 'vehicle' && type !== 'train') continue;

      const speed = currentSpeed || baseSpeed || 0;
      const frontClearance = width * 0.5 + PLAYER_WIDTH * 0.5;
      const leadDistance = direction * (playerX - obstacle.position.x);
      const baseNearWindow = Math.min(44, Math.max(28, speed * 0.18));
      const nearWindow = type === 'train'
        ? (trainClass === 'bullet'
          ? Math.min(190, Math.max(115, speed * 0.24))
          : baseNearWindow)
        : baseNearWindow;
      const almostHit = leadDistance > frontClearance && leadDistance < frontClearance + nearWindow;

      if (almostHit) {
        this.lastNearMissAt = nowMs;
        this.callbacks.onNearMiss({ score: this.score, row: this.playerPosition.row, speed, kind: type === 'train' ? trainClass || 'train' : 'vehicle' });
        break;
      }
    }
  }

  _checkTrafficCollision() {
    if (!this.player || this.isImpacting) return;
    if (performance.now() < this.invulnerableUntil) return;
    const playerX = this.player.position.x;
    const playerY = this.player.position.y;

    for (const vehicle of this.vehicles) {
      const { rowIndex, width, depth } = vehicle.userData;
      const rowY = rowToY(rowIndex, TILE_SIZE);
      if (Math.abs(playerY - rowY) > (depth + PLAYER_DEPTH) * 0.5) continue;
      if (Math.abs(playerX - vehicle.position.x) > (width + PLAYER_WIDTH) * 0.48) continue;
      this._triggerImpact(vehicle.userData.type === 'train' ? 'train' : 'traffic', vehicle);
      break;
    }
  }

  _triggerImpact(reason, obstacle) {
    if (this.isImpacting || this.isGameOver) return;
    const cheatRespawn = this.cheatMode;
    this.isImpacting = true;
    this.isPlaying = false;
    this.impactStartedAt = performance.now();
    this.impactReason = reason;
    this.impactDuration = cheatRespawn ? 640 : reason === 'train' ? 2120 : reason === 'water' ? 1980 : 1880;
    this.cheatRespawnPending = cheatRespawn;
    this.cheatRespawnPosition = cheatRespawn && this.player
      ? {
          row: this.playerPosition.row,
          tile: this.playerPosition.tile,
          x: this.player.position.x,
          y: this.player.position.y,
          z: 0
        }
      : null;
    this.moveQueue = [];
    this.movement = null;

    if (obstacle) {
      const direction = obstacle.userData.direction || 1;
      this.impactVector.set(direction, reason === 'train' ? 1 : reason === 'water' ? 0.38 : 0.55);
    } else {
      this.impactVector.set(0.8, 0.5);
    }

    if (reason === 'water' && this.player) {
      this.waterImpactOrigin.copy(this.player.position);
      this.lastWaterStruggleFx = performance.now();
      this._spawnSplash(this.player.position.x, this.player.position.y);
    } else if (this.player) {
      this._spawnChickenImpactDebris(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z + 14,
        this.impactVector.x || 1,
        reason
      );
    }

    this.callbacks.onImpact({ score: this.score, highScore: this.highScore, reason });
  }

  _updateImpactEffect() {
    if (!this.player) return;
    const elapsed = performance.now() - this.impactStartedAt;
    const t = clamp(elapsed / this.impactDuration, 0, 1);
    const baseScale = this.player.userData.baseScale || 0.72;
    const punch = Math.sin(Math.PI * clamp(t * 1.35, 0, 1));
    const recoil = easeOutCubic(1 - t);

    if (this.impactReason === 'water') {
      const struggle = Math.sin(elapsed * 0.095) * (1 - t);
      const wobbleX = Math.sin(elapsed * 0.072) * 8.2 * (1 - t);
      const wobbleY = Math.cos(elapsed * 0.083) * 6.4 * (1 - t);
      const sink = easeInOutQuad(t);
      this.player.position.x = this.waterImpactOrigin.x + wobbleX;
      this.player.position.y = this.waterImpactOrigin.y + wobbleY;
      this.player.position.z = lerp(0, -30, sink) + struggle * 3.6;
      this.player.scale.setScalar(baseScale * (1 - 0.22 * sink + 0.06 * Math.abs(struggle)));
      this.player.rotation.x = 0.08 + struggle * 0.16;
      this.player.rotation.y = Math.sin(elapsed * 0.071) * 0.22 * (1 - t);
      this.player.rotation.z = Math.sin(elapsed * 0.084) * 0.18 * (1 - t);

      const nowMs = performance.now();
      if (t < 0.82 && nowMs - this.lastWaterStruggleFx > 95) {
        this.lastWaterStruggleFx = nowMs;
        this._spawnWaterBubbles(this.waterImpactOrigin.x, this.waterImpactOrigin.y);
        if (t < 0.36 && Math.random() > 0.45) this._spawnSplash(this.waterImpactOrigin.x, this.waterImpactOrigin.y);
      }
    } else {
      this.player.position.x += this.impactVector.x * 0.42 * recoil;
      this.player.position.z = Math.sin(Math.PI * t) * 18;
      this.player.scale.setScalar(baseScale * (1 + 0.18 * punch));
      this.player.rotation.x = 0.18 + punch * 0.38;
      this.player.rotation.y = this.impactVector.x * punch * 0.32;
      this.player.rotation.z += this.impactVector.x * 0.06 * recoil;
    }

    if (t >= 1) {
      if (this.cheatRespawnPending) {
        this._respawnAfterCheatImpact();
        return;
      }
      this.isImpacting = false;
      this._gameOver(this.impactReason);
    }
  }

  _respawnAfterCheatImpact() {
    const respawn = this.cheatRespawnPosition;
    this.isImpacting = false;
    this.isGameOver = false;
    this.isPlaying = true;
    this.cheatRespawnPending = false;
    this.cheatRespawnPosition = null;
    this.moveQueue = [];
    this.movement = null;
    this.activeRidePlankId = null;
    this.invulnerableUntil = performance.now() + 1000;
    this.waterGraceUntil = this.invulnerableUntil;

    if (respawn && this.player) {
      this.playerPosition = { row: respawn.row, tile: respawn.tile };
      this.player.position.set(respawn.x, respawn.y, respawn.z);
      this.player.rotation.set(0, 0, this.player.rotation.z);
      this.player.scale.setScalar(this.player.userData.baseScale || 0.62);
      this.player.visible = true;
    }

    this.callbacks.onRespawn({
      score: this.score,
      highScore: this.highScore,
      reason: this.impactReason,
      invulnerableMs: 1000
    });
  }

  _updateGhostBlink() {
    if (!this.player) return;
    const now = performance.now();
    if (now >= this.invulnerableUntil) {
      this.player.visible = true;
      return;
    }
    this.player.visible = Math.floor(now / 95) % 2 === 0;
  }

  _applyCameraShake() {
    const elapsed = performance.now() - this.impactStartedAt;
    const t = clamp(elapsed / this.impactDuration, 0, 1);
    const strength = (1 - t) * (this.impactReason === 'train' ? 14 : this.impactReason === 'water' ? 9 : 10);
    const shakeX = (Math.random() - 0.5) * strength;
    const shakeY = (Math.random() - 0.5) * strength;
    const shakeZ = (Math.random() - 0.5) * strength * 0.45;
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;
    this.camera.position.z += shakeZ;
  }

  _gameOver(reason) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isPlaying = false;
    this.isImpacting = false;
    this.moveQueue = [];
    this.movement = null;
    this.callbacks.onGameOver({
      score: this.score,
      highScore: this.highScore,
      previousHighScore: this.runStartingHighScore,
      isNewHighScore: this.newRecordThisRun && this.score >= this.highScore && this.score > this.runStartingHighScore,
      reason
    });
  }

  _updateCamera(force, delta = 1 / 60) {
    if (!this.player) return;
    const rect = this.container.getBoundingClientRect();
    const isPortrait = rect.height > rect.width;

    // Mode B calm camera: follow the logical row/tile, not the chicken's hop
    // arc. The player can bounce, but the camera should not bob with every jump
    // because that feels dizzy on phones. Water-plank drift may still gently
    // influence X so riding a plank does not leave the chicken off-screen.
    const anchor = this.movement?.to || this.playerPosition;
    const logicalX = tileToX(anchor.tile, TILE_SIZE);
    const logicalY = rowToY(anchor.row, TILE_SIZE);
    const ridingPlankX = this.activeRidePlankId ? this.player.position.x : logicalX;
    const lateralWeight = isPortrait ? 0.36 : 0.42;
    const targetX = clamp(
      ridingPlankX * lateralWeight,
      MIN_TILE * TILE_SIZE + 92,
      MAX_TILE * TILE_SIZE - 92
    );
    const targetY = logicalY + (isPortrait ? 88 : 58);
    const targetZ = isPortrait ? 16 : 0;
    this.cameraRawTarget.set(targetX, targetY, targetZ);

    const targetAlpha = 1 - Math.exp(-CAMERA_TARGET_STIFFNESS * Math.max(0.001, delta));
    const followAlpha = Math.max(CAMERA_LERP, 1 - Math.exp(-CAMERA_FOLLOW_STIFFNESS * Math.max(0.001, delta)));

    if (force) {
      this.cameraSmoothedTarget.copy(this.cameraRawTarget);
    } else {
      this.cameraSmoothedTarget.lerp(this.cameraRawTarget, targetAlpha);
    }
    this.cameraTarget.copy(this.cameraSmoothedTarget);

    this.cameraOffset.set(
      isPortrait ? 250 : 305,
      isPortrait ? -345 : -335,
      isPortrait ? 352 : 315
    );
    this.cameraDesired.copy(this.cameraTarget).add(this.cameraOffset);
    if (force) {
      this.camera.position.copy(this.cameraDesired);
    } else {
      this.camera.position.lerp(this.cameraDesired, followAlpha);
    }
    this.camera.lookAt(this.cameraTarget);
    this._updateSunlightForCurrentView();
  }

  _updateSunlightForCurrentView() {
    if (!this.sunlight || !this.sunTarget) return;
    this.sunTarget.position.copy(this.cameraTarget);
    this.sunlight.position.set(
      this.cameraTarget.x - 190,
      this.cameraTarget.y - 235,
      this.cameraTarget.z + 430
    );
    this.sunTarget.updateMatrixWorld();
    this.sunlight.updateMatrixWorld();
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const aspect = width / height;
    const isPortrait = height > width;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.renderProfile.maxPixelRatio));
    this.renderer.setSize(width, height, false);

    const viewHeight = isPortrait ? 690 : 390;
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this._updateCamera(true);
  }

  _handleKeyDown(event) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const key = event.key.toLowerCase();
    const map = {
      arrowup: 'forward',
      w: 'forward',
      arrowdown: 'backward',
      s: 'backward',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right'
    };
    const direction = map[key];
    if (!direction || !this.isPlaying || this.isGameOver || this.isImpacting) return;
    event.preventDefault();
    this.queueMove(direction);
  }

  _commitPointerMove(event, releaseOnly = false) {
    if (!this.touchStart || this.touchStart.consumed) return false;
    const dx = event.clientX - this.touchStart.x;
    const dy = event.clientY - this.touchStart.y;
    const dt = performance.now() - this.touchStart.time;
    const threshold = releaseOnly ? 24 : 34;

    if (dt > 750) {
      this.touchStart = null;
      return false;
    }
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return false;

    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'backward' : 'forward');
    this.touchStart.consumed = true;
    this.queueMove(direction);
    return true;
  }

  _handlePointerDown(event) {
    this.touchStart = { x: event.clientX, y: event.clientY, time: performance.now(), consumed: false };
  }

  _handlePointerMove(event) {
    if (this._commitPointerMove(event, false)) this.touchStart = null;
  }

  _handlePointerUp(event) {
    this._commitPointerMove(event, true);
    this.touchStart = null;
  }

  _handlePointerCancel() {
    this.touchStart = null;
  }
}
