import { RoadQuestGame } from './RoadQuestGame.js';

// Runtime engine guard for the opening traffic regression.
// The game can render a non-playing preview before the child taps Start, but
// the traffic must not be time-scaled down to a slow-motion crawl. Keep the
// paused/menu branch frozen, keep impact slow motion intentional, and run the
// preview at the same traffic cadence as normal gameplay.
if (!RoadQuestGame.__ayamRuntimeFixesApplied) {
  RoadQuestGame.__ayamRuntimeFixesApplied = true;

  RoadQuestGame.prototype.start = function start() {
    if (this.isGameOver && !this.restartPrepared) this.reset(false);

    this.isRuntimeSuspended = false;
    this.isGameOver = false;
    this.isImpacting = false;
    this.isPlaying = true;
    this.isUiPaused = false;
    this.lastPausedRenderAt = 0;
    this.restartPrepared = false;

    this.clock.getDelta();
    this._ensureAnimationLoop();
  };

  RoadQuestGame.prototype._animate = function animate() {
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
      this._updateVehicles(delta);
    }

    this._updateWaterFlow(delta);
    this._updateFx(delta);
    this._updateGhostBlink();
    this._updateCamera(false, delta);
    if (this.isImpacting) this._applyCameraShake();
    this.renderer.render(this.scene, this.camera);
    this._ensureAnimationLoop();
  };
}
