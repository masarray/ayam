import * as THREE from 'three';
import { RoadQuestGame } from './RoadQuestGame.js';

const CONTACT_SHADOW_MAX_INSTANCES = 160;
const CONTACT_SHADOW_Z = 0.72;
const CONTACT_SHADOW_COLOR = 0x111827;

const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3();
const scratchMatrix = new THREE.Matrix4();

function isMobileProfile(game) {
  const profile = String(game?.renderProfile?.name || '');
  return profile.includes('mobile') || profile.includes('light');
}

function shouldUseContactShadows(game) {
  if (!game || game.isDestroyed) return false;
  // Mobile uses fake contact shadows instead of real shadow maps. On desktop,
  // keep fake shadows as a fallback only when real shadows are unavailable.
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
  scratchPosition.set(x, y, CONTACT_SHADOW_Z);
  scratchScale.set(scaleX * weight, scaleY * weight, 1);
  scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
  mesh.setMatrixAt(index, scratchMatrix);
}

function updateMobileContactShadows(game) {
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
  if (!proto || proto.__mobileContactShadowFixesInstalled) return;
  proto.__mobileContactShadowFixesInstalled = true;

  const originalUpdateCamera = proto._updateCamera;
  proto._updateCamera = function updateCameraWithMobileContactShadows(...args) {
    const result = originalUpdateCamera.apply(this, args);
    updateMobileContactShadows(this);
    return result;
  };

  const originalDestroy = proto.destroy;
  proto.destroy = function destroyWithMobileContactShadowCleanup(...args) {
    if (this.__mobileContactShadowMesh) {
      this.__mobileContactShadowMesh.geometry?.dispose?.();
      this.__mobileContactShadowMesh.material?.dispose?.();
      this.__mobileContactShadowMesh = null;
    }
    return originalDestroy.apply(this, args);
  };
}

installMobileContactShadowFixes();
