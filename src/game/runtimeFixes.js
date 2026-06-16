import { RoadQuestGame } from './RoadQuestGame.js';

// Runtime engine guard for mobile playability regressions.
// Keep this file small and deterministic: it patches lifecycle/simulation
// behavior without touching UI state, audio, or quiz flow.
if (!RoadQuestGame.__ayamRuntimeFixesAppliedV2) {
  RoadQuestGame.__ayamRuntimeFixesAppliedV2 = true;

  const proto = RoadQuestGame.prototype;
  const originalSetupLights = proto._setupLights;
  const originalReset = proto.reset;
  const originalLoadSaveState = proto.loadSaveState;
  const originalSmartTrafficLane = proto._updateSmartTrafficLane;

  proto._trimSimulationWindow = function trimSimulationWindow(centerRow = 0, forwardRows = 18, backwardRows = 0) {
    const minRow = Math.max(0, centerRow - backwardRows);
    const maxRow = centerRow + forwardRows;

    for (const [rowIndex, rowGroup] of Array.from(this.rowGroups.entries())) {
      if (rowIndex >= minRow && rowIndex <= maxRow) continue;
      this.worldGroup.remove(rowGroup);
      this.rowGroups.delete(rowIndex);
      this.waterFlowRows.delete(rowIndex);
    }

    const keepMovingItem = (item) => {
      const rowIndex = item.userData?.rowIndex ?? 0;
      if (rowIndex >= minRow && rowIndex <= maxRow) return true;
      this.vehicleGroup.remove(item);
      return false;
    };

    this.vehicles = this.vehicles.filter(keepMovingItem);
    this.planks = this.planks.filter(keepMovingItem);

    for (const rowIndex of Array.from(this.trafficRows.keys())) {
      if (rowIndex < minRow || rowIndex > maxRow) this.trafficRows.delete(rowIndex);
    }
    for (const rowIndex of Array.from(this.waterRows.keys())) {
      if (rowIndex < minRow || rowIndex > maxRow) this.waterRows.delete(rowIndex);
    }

    this.waterFlowItems = this.waterFlowItems.filter((item) => {
      const rowIndex = item.userData?.waterFlow?.rowIndex ?? 0;
      return rowIndex >= minRow && rowIndex <= maxRow;
    });
  };

  proto._setupLights = function setupLightsWithMobileShadowGuard() {
    originalSetupLights.call(this);

    // Mobile WebGL shadow maps are the most expensive part of this scene.
    // Disabling them on phones keeps movement responsive; desktop keeps the
    // premium shadowed look.
    if (this.renderProfile?.name !== 'desktop-premium') {
      this.renderer.shadowMap.enabled = false;
      if (this.sunlight) this.sunlight.castShadow = false;
    }
  };

  proto.reset = function resetWithLightOpeningScene(startImmediately = false) {
    originalReset.call(this, startImmediately);
    // The engine used to add all 48 pre-generated rows to the scene at reset.
    // That meant every off-screen road/train/water object updated every frame
    // before the child had even started playing. Keep only the visible opening
    // window active; rows are still added later by normal movement.
    this._trimSimulationWindow(0, 18, 0);
  };

  proto.loadSaveState = function loadSaveStateWithTrim(state, startImmediately = true) {
    const result = originalLoadSaveState.call(this, state, startImmediately);
    const row = this.playerPosition?.row || 0;
    this._trimSimulationWindow(row, 26, 16);
    return result;
  };

  proto.start = function start() {
    if (this.isGameOver && !this.restartPrepared) this.reset(false);

    this.isRuntimeSuspended = false;
    this.isGameOver = false;
    this.isImpacting = false;
    this.isPlaying = true;
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.restartPrepared = false;

    this._clearSpawnAroundPlayer?.(2, 220);
    this.clock.getDelta();
    this._ensureAnimationLoop();
  };

  proto._animate = function animate() {
    this.renderRequested = null;
    if (this.isDestroyed || this.isRuntimeSuspended) return;
    const delta = Math.min(this.clock.getDelta(), 0.035);

    if (this.isUiPaused && !this.isImpacting) {
      const nowMs = performance.now();
      if (nowMs - this.lastPausedRenderAt > 220) {
        this.lastPausedRenderAt = nowMs;
        this.renderer.render(this.scene, this.camera);
      }
      this._ensureAnimationLoop();
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
      // Menu/intro/game-over frames render the world but do not simulate every
      // vehicle. This prevents the opening screen from burning CPU/GPU before
      // the first playable frame.
    }

    this._updateWaterFlow(delta);
    this._updateFx(delta);
    this._updateGhostBlink();
    this._updateCamera(false, delta);
    if (this.isImpacting) this._applyCameraShake();
    this.renderer.render(this.scene, this.camera);
    this._ensureAnimationLoop();
  };

  proto._updateSmartTrafficLane = function updateSmartTrafficLaneWithOpeningGuard(items, delta) {
    if (!items.length) return;

    const rowIndex = items[0].userData?.rowIndex ?? 0;
    if (rowIndex <= 12) {
      const openingMinSpeed = rowIndex <= 5 ? 128 : 116;
      items.forEach((vehicle) => {
        const data = vehicle.userData;
        data.currentSpeed = Math.max(data.currentSpeed || 0, data.baseSpeed || data.speed || 0, openingMinSpeed);
        this._updateFreeMovingObstacle(vehicle, delta, 260);
      });
      return;
    }

    originalSmartTrafficLane.call(this, items, delta);

    // Never let the traffic-following model collapse into a slow-motion crawl.
    // It may brake, but it must remain readable/playable.
    items.forEach((vehicle) => {
      const data = vehicle.userData || {};
      const base = data.baseSpeed || data.speed || 0;
      data.currentSpeed = Math.max(data.currentSpeed || 0, base * 0.58, 58);
    });
  };
}
