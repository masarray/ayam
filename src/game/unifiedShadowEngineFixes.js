import * as THREE from 'three';
import { RoadQuestGame } from './RoadQuestGame.js';
import { MAX_TILE, MIN_TILE, TILE_SIZE } from './constants.js';
import { rowToY, tileToX } from './math.js';

if (!RoadQuestGame.__ayamUnifiedShadowEngineAppliedV1) {
  RoadQuestGame.__ayamUnifiedShadowEngineAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const MAX_SHADOWS = 260;
  const SHADOW_Z = 0.58;
  const SNAP = 0.5;
  const TREE_LOOKBACK = 12;
  const TREE_LOOKAHEAD = 18;

  const scratchPosition = new THREE.Vector3();
  const scratchQuaternion = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();
  const scratchMatrix = new THREE.Matrix4();

  const snap = (value, step = SNAP) => Math.round(value / step) * step;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function disableRealShadowMap(game) {
    if (!game?.renderer) return;
    game.renderer.shadowMap.enabled = false;
    game.renderer.shadowMap.autoUpdate = false;
    if (game.sunlight) {
      game.sunlight.castShadow = false;
      if (game.sunlight.shadow) game.sunlight.shadow.needsUpdate = false;
    }
  }

  function hideLegacyShadowMeshes(game) {
    const oldMobile = game?.__mobileContactShadowMesh;
    if (oldMobile) {
      oldMobile.visible = false;
      oldMobile.count = 0;
    }
  }

  function ensureUnifiedShadowMesh(game) {
    if (game.__ayamUnifiedShadowMesh) return game.__ayamUnifiedShadowMesh;

    const geometry = new THREE.CircleGeometry(1, 36);
    const material = new THREE.MeshBasicMaterial({
      color: 0x111827,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    });

    const mesh = new THREE.InstancedMesh(geometry, material, MAX_SHADOWS);
    mesh.name = 'ayam-unified-soft-shadows';
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    game.fxGroup?.add(mesh);
    game.__ayamUnifiedShadowMesh = mesh;
    return mesh;
  }

  function setShadow(mesh, index, x, y, sx, sy, weight = 1) {
    scratchPosition.set(snap(x), snap(y), SHADOW_Z);
    const safeWeight = clamp(weight, 0.42, 1);
    scratchScale.set(Math.max(2, sx * safeWeight), Math.max(2, sy * safeWeight), 1);
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    mesh.setMatrixAt(index, scratchMatrix);
  }

  function distanceWeight(game, rowIndex) {
    const playerRow = Number(game?.playerPosition?.row || 0);
    if (!Number.isFinite(rowIndex)) return 0.78;
    const distance = Math.abs(rowIndex - playerRow);
    if (distance <= 5) return 1;
    if (distance <= 10) return 0.82;
    if (distance <= 16) return 0.62;
    return 0.46;
  }

  function addPlayerShadow(game, mesh, count) {
    if (!game.player || game.player.visible === false || count >= MAX_SHADOWS) return count;
    setShadow(mesh, count, game.player.position.x, game.player.position.y - 1.2, 18, 12, 1);
    return count + 1;
  }

  function addMovingObjectShadows(game, mesh, count) {
    const vehicles = Array.isArray(game.vehicles) ? game.vehicles : [];
    for (const object of vehicles) {
      if (count >= MAX_SHADOWS) break;
      if (!object || object.visible === false) continue;
      const data = object.userData || {};
      if (data.sinking) continue;
      if (data.type !== 'vehicle' && data.type !== 'train') continue;

      const rowWeight = distanceWeight(game, data.rowIndex);
      const width = Math.max(28, Number(data.width) || 70);
      const depth = Math.max(18, Number(data.depth) || 34);
      const train = data.type === 'train';
      const sx = train ? Math.min(620, width * 0.36) : Math.min(142, width * 0.52);
      const sy = train ? Math.min(34, depth * 0.48) : Math.min(38, depth * 0.58);
      setShadow(mesh, count, object.position.x, object.position.y, sx, sy, rowWeight);
      count += 1;
    }
    return count;
  }

  function addPlankShadows(game, mesh, count) {
    const planks = Array.isArray(game.planks) ? game.planks : [];
    for (const plank of planks) {
      if (count >= MAX_SHADOWS) break;
      if (!plank || plank.visible === false) continue;
      const data = plank.userData || {};
      const rowWeight = distanceWeight(game, data.rowIndex);
      if (rowWeight < 0.5) continue;
      const width = Math.max(70, Number(data.width) || 120);
      setShadow(mesh, count, plank.position.x, plank.position.y, Math.min(118, width * 0.34), 13, rowWeight * 0.72);
      count += 1;
    }
    return count;
  }

  function addTreeShadows(game, mesh, count) {
    const rows = Array.isArray(game.rows) ? game.rows : [];
    const playerRow = Number(game?.playerPosition?.row || 0);
    const minRow = Math.max(0, playerRow - TREE_LOOKBACK);
    const maxRow = playerRow + TREE_LOOKAHEAD;

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      if (count >= MAX_SHADOWS) break;
      const row = rows[rowIndex];
      if (!row || !Array.isArray(row.trees) || row.trees.length === 0) continue;
      const weight = distanceWeight(game, rowIndex) * 0.78;
      for (const tile of row.trees) {
        if (count >= MAX_SHADOWS) break;
        if (!Number.isFinite(tile)) continue;
        if (tile < MIN_TILE || tile > MAX_TILE) continue;
        setShadow(mesh, count, tileToX(tile, TILE_SIZE), rowToY(rowIndex, TILE_SIZE) - 4, 26, 18, weight);
        count += 1;
      }
    }
    return count;
  }

  function sanitizeShadowFlags(game) {
    const now = performance.now();
    if (game.__ayamShadowSanitizedAt && now - game.__ayamShadowSanitizedAt < 1300) return;
    game.__ayamShadowSanitizedAt = now;

    game.scene?.traverse?.((object) => {
      if (!object?.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }

  function updateUnifiedShadows(game) {
    if (!game || game.isDestroyed) return;
    disableRealShadowMap(game);
    hideLegacyShadowMeshes(game);
    sanitizeShadowFlags(game);

    const mesh = ensureUnifiedShadowMesh(game);
    let count = 0;
    count = addPlayerShadow(game, mesh, count);
    count = addMovingObjectShadows(game, mesh, count);
    count = addPlankShadows(game, mesh, count);
    count = addTreeShadows(game, mesh, count);

    mesh.count = count;
    mesh.visible = count > 0;
    if (count > 0) mesh.instanceMatrix.needsUpdate = true;
  }

  const originalApplyQuality = proto._applyMobileQualityProfile;
  proto._applyMobileQualityProfile = function applyQualityWithUnifiedShadows(...args) {
    const result = originalApplyQuality?.apply(this, args);
    disableRealShadowMap(this);
    return result;
  };

  const originalUpdateCamera = proto._updateCamera;
  proto._updateCamera = function updateCameraWithUnifiedShadows(...args) {
    const result = originalUpdateCamera.apply(this, args);
    updateUnifiedShadows(this);
    return result;
  };

  const originalAddRow = proto._addRow;
  proto._addRow = function addRowWithUnifiedShadowSanitize(...args) {
    const result = originalAddRow.apply(this, args);
    disableRealShadowMap(this);
    return result;
  };

  const originalDestroy = proto.destroy;
  proto.destroy = function destroyUnifiedShadowEngine(...args) {
    if (this.__ayamUnifiedShadowMesh) {
      this.__ayamUnifiedShadowMesh.parent?.remove?.(this.__ayamUnifiedShadowMesh);
      this.__ayamUnifiedShadowMesh.geometry?.dispose?.();
      this.__ayamUnifiedShadowMesh.material?.dispose?.();
      this.__ayamUnifiedShadowMesh = null;
    }
    return originalDestroy.apply(this, args);
  };
}
