import * as THREE from 'three';
import { RoadQuestGame } from './RoadQuestGame.js';
import { TILE_SIZE } from './constants.js';
import { rowToY, tileToX } from './math.js';

const CONTACT_SHADOW_MAX_INSTANCES = 160;
const CONTACT_SHADOW_Z = 0.72;
const CONTACT_SHADOW_COLOR = 0x111827;
const CONTACT_SHADOW_POSITION_SNAP = 0.5;
const HIGH_MOBILE_SHADOW_MAP_SIZE = 512;
const MID_MOBILE_SHADOW_MAP_SIZE = 384;
const REAL_SHADOW_UPGRADE_COOLDOWN_MS = 1800;
const STABLE_SHADOW_ANCHOR_GRID = TILE_SIZE * 2;
const STABLE_SHADOW_OFFSET = Object.freeze({ x: -190, y: -235, z: 430 });

const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3();
const scratchMatrix = new THREE.Matrix4();

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function snapTo(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

function isMobileProfile(game) {
  const profile = String(game?.renderProfile?.name || '');
  return profile.includes('mobile') || profile.includes('light');
}

function mobilePerformanceMode(game) {
  return game?.__ayamMobilePerformanceMode || 'normal';
}

function readNavigatorNumber(name) {
  const value = Number(globalThis.navigator?.[name] || 0);
  return Number.isFinite(value) ? value : 0;
}

function hasReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function hasRealShadowActive(game) {
  return Boolean(game?.renderer?.shadowMap?.enabled && game?.sunlight?.castShadow);
}

function deviceCanTryRealMobileShadow(game) {
  if (!isMobileProfile(game)) return false;
  if (game?.renderProfile?.name === 'mobile-light') return false;
  if (hasReducedMotion()) return false;

  const memory = readNavigatorNumber('deviceMemory');
  const cores = readNavigatorNumber('hardwareConcurrency');
  const dpr = Number(globalThis.devicePixelRatio || 1);
  const maxTextureSize = Number(game?.renderer?.capabilities?.maxTextureSize || 0);

  // Browser privacy can hide memory/CPU values. Treat unknown values as neutral,
  // but require a sane WebGL texture limit so old/weak GPUs stay on blob shadows.
  const memoryOk = memory === 0 || memory >= 6;
  const coresOk = cores === 0 || cores >= 6;
  const gpuOk = maxTextureSize === 0 || maxTextureSize >= 4096;
  const dprOk = dpr <= 3.25;

  return memoryOk && coresOk && gpuOk && dprOk;
}

function configureShadowMapSize(sunlight, size) {
  if (!sunlight?.shadow?.mapSize || !size) return;
  if (sunlight.shadow.mapSize.width === size && sunlight.shadow.mapSize.height === size) return;

  sunlight.shadow.mapSize.set(size, size);
  sunlight.shadow.map?.dispose?.();
  sunlight.shadow.map = null;
  sunlight.shadow.needsUpdate = true;
}

function chooseStickyMobileShadowTier(game, desiredTier) {
  const previousTier = game.__ayamMobileShadowTier;
  if (!previousTier || previousTier === desiredTier) return desiredTier;

  // Downgrade to contact immediately when the device is under pressure. Upgrade
  // back to real shadow only after a cooldown so the mode does not flap and cause
  // visible one-frame shadow glitches.
  if (desiredTier !== 'real') return desiredTier;

  const changedAt = Number(game.__ayamMobileShadowTierChangedAt || 0);
  if (changedAt > 0 && nowMs() - changedAt < REAL_SHADOW_UPGRADE_COOLDOWN_MS) {
    return previousTier;
  }

  return desiredTier;
}

function setMobileShadowTier(game, tier) {
  if (game.__ayamMobileShadowTier === tier) return;
  game.__ayamMobileShadowTier = tier;
  game.__ayamMobileShadowTierChangedAt = nowMs();
}

function stableShadowAnchorFor(game) {
  const row = Number(game?.playerPosition?.row ?? 0);
  const tile = Number(game?.playerPosition?.tile ?? 0);
  const fallbackX = Number(game?.cameraRawTarget?.x ?? game?.cameraTarget?.x ?? 0);
  const fallbackY = Number(game?.cameraRawTarget?.y ?? game?.cameraTarget?.y ?? 0);

  // Directional-light shadow maps shimmer when the light target tracks the
  // smoothed camera every frame. Use the logical chicken row/tile and snap the
  // anchor to a small world grid. The shadow camera is large enough that it does
  // not need to chase sub-tile motion, and the result is much more stable.
  const logicalX = Number.isFinite(tile) ? tileToX(tile, TILE_SIZE) * 0.42 : fallbackX;
  const logicalY = Number.isFinite(row) ? rowToY(row, TILE_SIZE) + 64 : fallbackY;

  return {
    x: snapTo(logicalX, STABLE_SHADOW_ANCHOR_GRID),
    y: snapTo(logicalY, STABLE_SHADOW_ANCHOR_GRID),
    z: 0
  };
}

function updateStableRealShadowAnchor(game, force = false) {
  if (!game?.sunlight || !game?.sunTarget || !hasRealShadowActive(game)) return false;

  const anchor = stableShadowAnchorFor(game);
  const previous = game.__ayamStableShadowAnchor || {};
  const changed = force
    || previous.x !== anchor.x
    || previous.y !== anchor.y
    || previous.z !== anchor.z;

  if (!changed) return false;

  game.__ayamStableShadowAnchor = anchor;
  game.sunTarget.position.set(anchor.x, anchor.y, anchor.z);
  game.sunlight.position.set(
    anchor.x + STABLE_SHADOW_OFFSET.x,
    anchor.y + STABLE_SHADOW_OFFSET.y,
    anchor.z + STABLE_SHADOW_OFFSET.z
  );
  game.sunTarget.updateMatrixWorld();
  game.sunlight.updateMatrixWorld();
  if (game.sunlight.shadow) game.sunlight.shadow.needsUpdate = true;
  return true;
}

function configureAdaptiveMobileShadow(game) {
  if (!isMobileProfile(game) || !game?.renderer) return;

  const mode = mobilePerformanceMode(game);
  const canTryReal = deviceCanTryRealMobileShadow(game);
  const desiredTier = canTryReal && mode === 'normal' ? 'real' : 'contact';
  const tier = chooseStickyMobileShadowTier(game, desiredTier);

  setMobileShadowTier(game, tier);
  game.__ayamMobileShadowCanTryReal = canTryReal;

  if (tier !== 'real') {
    game.renderer.shadowMap.enabled = false;
    if (game.sunlight) game.sunlight.castShadow = false;
    return;
  }

  const shadowSize = mode === 'pressure' ? MID_MOBILE_SHADOW_MAP_SIZE : HIGH_MOBILE_SHADOW_MAP_SIZE;
  game.renderer.shadowMap.enabled = true;
  game.renderer.shadowMap.type = THREE.PCFShadowMap;

  if (game.sunlight) {
    game.sunlight.castShadow = true;
    configureShadowMapSize(game.sunlight, shadowSize);
    updateStableRealShadowAnchor(game, true);
  }
}

function shouldUseContactShadows(game) {
  if (!game || game.isDestroyed) return false;

  // Strong phones can use a small real shadow map in normal mode. When that is
  // active, hide blob shadows to avoid double-dark contact shadows.
  if (hasRealShadowActive(game) || game.__ayamMobileShadowTier === 'real') return false;

  // Low/mid phones, pressure mode, severe mode, and desktop fallback all use the
  // cheap instanced blob-shadow path.
  if (isMobileProfile(game)) return true;
  return !(game.renderer?.shadowMap?.enabled && game.sunlight?.castShadow);
}

function ensureContactShadowMesh(game) {
  if (game.__mobileContactShadowMesh) return game.__mobileContactShadowMesh;

  const geometry = new THREE.CircleGeometry(1, 28);
  const material = new THREE.MeshBasicMaterial({
    color: CONTACT_SHADOW_COLOR,
    transparent: true,
    opacity: isMobileProfile(game) ? 0.15 : 0.11,
    depthWrite: false,
    depthTest: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, CONTACT_SHADOW_MAX_INSTANCES);
  mesh.name = 'mobile-contact-shadows';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Keep the mesh in fxGroup so it follows the same lifecycle as the rest of the
  // game scene and is disposed during engine teardown.
  game.fxGroup?.add(mesh);
  game.__mobileContactShadowMesh = mesh;
  return mesh;
}

function rowDistanceWeight(game, rowIndex) {
  const playerRow = game?.playerPosition?.row ?? 0;
  if (!Number.isFinite(rowIndex)) return 0.86;
  const distance = Math.abs(rowIndex - playerRow);
  if (distance <= 8) return 1;
  if (distance <= 14) return 0.82;
  return 0.62;
}

function applyShadowInstance(mesh, index, x, y, scaleX, scaleY, opacityWeight = 1) {
  // Opacity is shared by the material, so far objects become visually lighter by
  // reducing their scale a little instead of adding a second material/draw call.
  const weight = Math.max(0.52, Math.min(1, opacityWeight));
  const snappedX = snapTo(x, CONTACT_SHADOW_POSITION_SNAP);
  const snappedY = snapTo(y, CONTACT_SHADOW_POSITION_SNAP);
  scratchPosition.set(snappedX, snappedY, CONTACT_SHADOW_Z);
  scratchScale.set(scaleX * weight, scaleY * weight, 1);
  scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
  mesh.setMatrixAt(index, scratchMatrix);
}

function updateMobileContactShadows(game) {
  configureAdaptiveMobileShadow(game);
  if (hasRealShadowActive(game)) updateStableRealShadowAnchor(game);

  const mesh = ensureContactShadowMesh(game);
  const enabled = shouldUseContactShadows(game);
  if (!enabled) {
    mesh.count = 0;
    mesh.visible = false;
    return;
  }

  let count = 0;

  if (game.player?.visible !== false && count < CONTACT_SHADOW_MAX_INSTANCES) {
    const player = game.player;
    // Keep the chicken shadow on the ground plane even while the chicken hops.
    applyShadowInstance(mesh, count, player.position.x, player.position.y - 1.5, 18, 12, 1);
    count += 1;
  }

  const vehicles = Array.isArray(game.vehicles) ? game.vehicles : [];
  for (const obstacle of vehicles) {
    if (count >= CONTACT_SHADOW_MAX_INSTANCES) break;
    if (!obstacle || obstacle.visible === false) continue;
    const data = obstacle.userData || {};
    if (data.sinking) continue;
    if (data.type !== 'vehicle' && data.type !== 'train') continue;

    const width = Math.max(28, Number(data.width) || 80);
    const depth = Math.max(18, Number(data.depth) || 44);
    const rowWeight = rowDistanceWeight(game, data.rowIndex);
    const isTrain = data.type === 'train';
    const scaleX = Math.min(isTrain ? 560 : 132, width * (isTrain ? 0.39 : 0.48));
    const scaleY = Math.min(isTrain ? 32 : 34, depth * (isTrain ? 0.44 : 0.5));

    applyShadowInstance(
      mesh,
      count,
      obstacle.position.x,
      obstacle.position.y,
      scaleX,
      scaleY,
      rowWeight
    );
    count += 1;
  }

  mesh.count = count;
  mesh.visible = count > 0;
  if (count > 0) mesh.instanceMatrix.needsUpdate = true;
}

function installMobileContactShadowFixes() {
  const proto = RoadQuestGame?.prototype;
  if (!proto || proto.__mobileContactShadowFixesInstalledV3) return;
  proto.__mobileContactShadowFixesInstalledV3 = true;

  const originalApplyQualityProfile = proto._applyMobileQualityProfile;
  proto._applyMobileQualityProfile = function applyQualityProfileWithAdaptiveMobileShadows(...args) {
    const result = originalApplyQualityProfile?.apply(this, args);
    configureAdaptiveMobileShadow(this);
    return result;
  };

  const originalSunlightUpdate = proto._updateSunlightForCurrentView;
  proto._updateSunlightForCurrentView = function updateSunlightWithStableShadowAnchor(...args) {
    if (hasRealShadowActive(this)) {
      updateStableRealShadowAnchor(this);
      return;
    }
    return originalSunlightUpdate.apply(this, args);
  };

  const originalUpdateCamera = proto._updateCamera;
  proto._updateCamera = function updateCameraWithMobileContactShadows(...args) {
    const result = originalUpdateCamera.apply(this, args);
    updateMobileContactShadows(this);
    return result;
  };

  const originalDestroy = proto.destroy;
  proto.destroy = function destroyWithMobileContactShadowCleanup(...args) {
    if (this.__mobileContactShadowMesh) {
      this.__mobileContactShadowMesh.parent?.remove?.(this.__mobileContactShadowMesh);
      this.__mobileContactShadowMesh.geometry?.dispose?.();
      this.__mobileContactShadowMesh.material?.dispose?.();
      this.__mobileContactShadowMesh = null;
    }
    return originalDestroy.apply(this, args);
  };
}

installMobileContactShadowFixes();