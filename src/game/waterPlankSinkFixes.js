import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  TILE_SIZE,
  WATER_SAFE_MARGIN
} from './constants.js';
import { clamp, easeInOutQuad, lerp } from './math.js';

// Water plank sink guard.
//
// The original flow had two separate sink phases:
// 1) ride-warning sag slowly pushes the plank down to about z=-12;
// 2) _sinkPlank starts a final sink animation, but _updatePlankSink restarted
//    from z=0, making the chicken appear to pop back to the surface before the
//    water impact splash. This guard preserves the current plank transform as
//    the starting point for the final sink phase and prevents active rider planks
//    from being reset to the surface before the water impact resolves.
if (!RoadQuestGame.__ayamWaterPlankSinkFixesAppliedV1) {
  RoadQuestGame.__ayamWaterPlankSinkFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const FINAL_SINK_DURATION_MS = 900;
  const FINAL_SINK_Z = -24;
  const FINAL_SINK_RESET_HOLD_MS = 360;

  const laneBounds = (margin = WATER_SAFE_MARGIN) => ({
    minX: MIN_TILE * TILE_SIZE - margin,
    maxX: MAX_TILE * TILE_SIZE + margin
  });

  const numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

  proto._sinkPlank = function sinkPlankWithoutSurfacePop(plank, forced = false) {
    if (!plank || plank.userData.sinking) return;

    const data = plank.userData;
    data.sinking = true;
    data.sinkStartedAt = performance.now();
    data.forcedSink = forced;
    data.sinkImpactArmed = Boolean(forced || data.sinkImpactArmed);

    // Preserve the warning-sag pose. The final sink must continue from here;
    // restarting at z=0 is the source of the visible flicker/pop.
    data.sinkStartZ = numberOr(plank.position.z, 0);
    data.sinkStartRotationX = numberOr(plank.rotation.x, 0);
    data.sinkStartScaleZ = numberOr(plank.scale.z, 1);
    data.sinkStartScaleY = numberOr(plank.scale.y, 1);
    data.sinkSettledAt = 0;
  };

  proto._updatePlankSink = function updatePlankSinkWithoutSurfacePop(plank) {
    if (!plank) return;
    const data = plank.userData || {};
    const now = performance.now();
    const startedAt = data.sinkStartedAt || now;
    const t = clamp((now - startedAt) / FINAL_SINK_DURATION_MS, 0, 1);
    const eased = easeInOutQuad(t);

    const startZ = numberOr(data.sinkStartZ, Math.min(0, numberOr(plank.position.z, 0)));
    const startRotationX = numberOr(data.sinkStartRotationX, numberOr(plank.rotation.x, 0));
    const startScaleZ = numberOr(data.sinkStartScaleZ, numberOr(plank.scale.z, 1));
    const startScaleY = numberOr(data.sinkStartScaleY, numberOr(plank.scale.y, 1));

    plank.position.z = lerp(startZ, FINAL_SINK_Z, eased);
    plank.rotation.x = startRotationX + Math.sin(t * Math.PI) * 0.12 * (data.direction || 1);
    plank.scale.z = Math.max(0.14, lerp(startScaleZ, 0.18, eased));
    plank.scale.y = Math.max(0.62, lerp(startScaleY, 0.68, eased));

    if (t < 1) return;

    const riderIsStillActive = this.activeRidePlankId === plank.uuid;
    const shouldHoldSunkForImpact = Boolean(data.sinkImpactArmed || riderIsStillActive || this.isImpacting);

    if (shouldHoldSunkForImpact) {
      data.sinkSettledAt = data.sinkSettledAt || now;
      plank.position.z = FINAL_SINK_Z;
      plank.rotation.x = 0;
      plank.scale.z = 0.18;
      plank.scale.y = 0.68;

      // Once the impact has fully taken over and the active rider is gone, allow
      // stale planks to recycle. During the actual sink/impact, never reset to
      // z=0 because that creates the one-frame surface pop.
      if (this.isImpacting || riderIsStillActive || now - data.sinkSettledAt < FINAL_SINK_RESET_HOLD_MS) return;
    }

    const { minX, maxX } = laneBounds(WATER_SAFE_MARGIN);
    const width = numberOr(data.width, 120);
    plank.position.x = (data.direction || 1) > 0 ? minX - WATER_SAFE_MARGIN - width : maxX + WATER_SAFE_MARGIN + width;
    plank.position.z = 0;
    plank.rotation.x = 0;
    plank.scale.set(1, 1, 1);
    data.sinking = false;
    data.sinkImpactArmed = false;
    data.riderSince = 0;
    data.sinkStartedAt = 0;
    data.sinkStartZ = 0;
    data.sinkStartRotationX = 0;
    data.sinkStartScaleZ = 1;
    data.sinkStartScaleY = 1;
    data.sinkSettledAt = 0;
    data.currentSpeed = data.baseSpeed;
  };
}
