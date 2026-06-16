import { RoadQuestGame } from './RoadQuestGame.js';
import {
  MAX_TILE,
  MIN_TILE,
  TILE_SIZE,
  TRAFFIC_MIN_GAP,
  VEHICLE_SAFE_MARGIN
} from './constants.js';

// Smooth traffic motion guard.
// Keep the smart traffic behavior, but prevent frame-by-frame target-speed
// flutter and tiny hard position corrections from becoming visible as micro-jitter.
if (!RoadQuestGame.__ayamSmoothTrafficFixesAppliedV1) {
  RoadQuestGame.__ayamSmoothTrafficFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;

  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const expAlpha = (rate, delta, cap = 1) => Math.min(cap, 1 - Math.exp(-rate * Math.max(0.001, delta)));

  const laneBounds = (margin = VEHICLE_SAFE_MARGIN) => ({
    minX: MIN_TILE * TILE_SIZE - margin,
    maxX: MAX_TILE * TILE_SIZE + margin
  });

  const laneProgress = (vehicle, direction, wrapMin, wrapMax) => (
    direction > 0 ? vehicle.position.x - wrapMin : wrapMax - vehicle.position.x
  );

  const approach = (current, target, accel, brake, delta) => {
    const speedDelta = target - current;
    const limit = (speedDelta >= 0 ? accel : brake) * delta;
    return current + clampNumber(speedDelta, -limit, limit);
  };

  const isCompactVehicle = (data = {}) => {
    const kind = String(data.kind || '').toLowerCase();
    if (/car|taxi|scooter|bike|motor|pickup|van/.test(kind)) return true;
    return Number(data.width || 0) <= 94;
  };

  const isHeavyVehicle = (data = {}) => {
    const kind = String(data.kind || '').toLowerCase();
    if (/bus|truck|tanker|container|dump|tractor|articulated/.test(kind)) return true;
    return Number(data.width || 0) >= 118;
  };

  const isSuperVehicle = (data = {}) => /super|sport/.test(String(data.kind || '').toLowerCase());

  const trafficMode = (data, gap, hardGap, comfortGap, chaseGap, canChase) => {
    const previous = data.followState || 'cruise';
    const hysteresis = clampNumber(hardGap * 0.18, 10, 24);

    if (previous === 'emergency' && gap < hardGap + hysteresis) return 'emergency';
    if (gap < hardGap) return 'emergency';

    if (previous === 'follow' && gap < comfortGap + hysteresis && gap > hardGap - hysteresis) return 'follow';
    if (gap < comfortGap) return 'follow';

    if (canChase) {
      if (previous === 'chase' && gap < chaseGap + hysteresis * 2 && gap > comfortGap - hysteresis) return 'chase';
      if (gap < chaseGap) return 'chase';
    }

    return 'cruise';
  };

  const targetSmoothingRate = (mode) => {
    if (mode === 'emergency') return { rate: 11, cap: 0.42 };
    if (mode === 'follow') return { rate: 4.6, cap: 0.22 };
    if (mode === 'chase') return { rate: 2.2, cap: 0.13 };
    return { rate: 1.55, cap: 0.095 };
  };

  const smoothTargetSpeed = (data, rawTarget, currentSpeed, mode, delta) => {
    if (!Number.isFinite(data.smoothedTargetSpeed)) data.smoothedTargetSpeed = currentSpeed;
    const { rate, cap } = targetSmoothingRate(mode);
    const alpha = expAlpha(rate, delta, cap);
    data.smoothedTargetSpeed = lerp(data.smoothedTargetSpeed, rawTarget, alpha);
    return data.smoothedTargetSpeed;
  };

  proto._updateSmartTrafficLane = function updateSmartTrafficLaneSmooth(items, delta) {
    if (!items.length) return;

    const rowIndex = items[0].userData?.rowIndex ?? 0;
    const laneItems = this._normalizeTrafficLaneForPlayability?.(rowIndex, items) || items;
    if (!laneItems.length) return;

    const direction = laneItems[0].userData.direction || 1;
    const maxVehicleWidth = Math.max(...laneItems.map((vehicle) => vehicle.userData.width || 72));
    const { minX, maxX } = laneBounds(VEHICLE_SAFE_MARGIN);
    const wrapMin = minX - maxVehicleWidth;
    const wrapMax = maxX + maxVehicleWidth;
    const span = wrapMax - wrapMin;

    const moveTrafficVehicle = (vehicle) => {
      const data = vehicle.userData || {};
      const width = data.width || maxVehicleWidth;
      const speed = data.currentSpeed || data.baseSpeed || data.speed || 120;
      vehicle.position.x += direction * speed * delta;

      if (direction > 0 && vehicle.position.x > wrapMax + width * 0.5) {
        vehicle.position.x = wrapMin - width * 0.5;
        data.smoothedTargetSpeed = data.currentSpeed || data.baseSpeed || data.speed || 120;
        data.followState = 'cruise';
      } else if (direction < 0 && vehicle.position.x < wrapMin - width * 0.5) {
        vehicle.position.x = wrapMax + width * 0.5;
        data.smoothedTargetSpeed = data.currentSpeed || data.baseSpeed || data.speed || 120;
        data.followState = 'cruise';
      }
    };

    if (laneItems.length === 1) {
      const data = laneItems[0].userData || {};
      const base = data.baseSpeed || data.speed || 140;
      const maxSpeed = data.maxSpeed || base * 1.12;
      const cruise = clampNumber(data.cruiseSpeed || base, base * 0.96, maxSpeed);
      const currentSpeed = data.currentSpeed || base;
      const smoothed = smoothTargetSpeed(data, cruise, currentSpeed, 'cruise', delta);
      data.followState = 'cruise';
      data.currentSpeed = clampNumber(
        approach(currentSpeed, smoothed, (data.acceleration || 82) * 0.55, (data.brakePower || 130) * 0.55, delta),
        base * 0.9,
        maxSpeed
      );
      moveTrafficVehicle(laneItems[0]);
      return;
    }

    const sorted = laneItems
      .map((vehicle) => ({
        vehicle,
        progress: laneProgress(vehicle, direction, wrapMin, wrapMax)
      }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const item = sorted[i];
      const front = i === sorted.length - 1 ? sorted[0] : sorted[i + 1];
      const data = item.vehicle.userData || {};
      const frontData = front.vehicle.userData || {};
      const frontProgress = front.progress + (i === sorted.length - 1 ? span : 0);
      const gap = frontProgress - item.progress - ((data.width || 72) + (frontData.width || 72)) * 0.5;

      const compact = isCompactVehicle(data);
      const heavy = isHeavyVehicle(data);
      const superVehicle = isSuperVehicle(data);
      const canChase = compact || superVehicle;
      const currentSpeed = data.currentSpeed || data.baseSpeed || data.speed || 120;
      const frontSpeed = frontData.currentSpeed || frontData.baseSpeed || frontData.speed || currentSpeed;
      const base = data.baseSpeed || data.speed || currentSpeed;
      const cruise = data.cruiseSpeed || base;
      const maxSpeed = data.maxSpeed || base * (canChase ? 1.18 : 1.08);
      const hardGap = Math.max(data.minFollowGap || TRAFFIC_MIN_GAP, (data.width || 72) * 0.55, rowIndex <= 24 ? 86 : 68);
      const comfortGap = hardGap + (rowIndex <= 24 ? 82 : 102) + currentSpeed * (canChase ? 0.07 : 0.1);
      const chaseGap = comfortGap + (canChase ? 205 : 88);
      const mode = trafficMode(data, gap, hardGap, comfortGap, chaseGap, canChase);
      let targetSpeed = cruise;

      if (mode === 'emergency') {
        const emergencyFloor = rowIndex <= 24
          ? (canChase ? 116 : 92)
          : (canChase ? 96 : heavy ? 74 : 84);
        targetSpeed = Math.max(emergencyFloor, Math.min(cruise, frontSpeed * (canChase ? 0.72 : 0.66)));
      } else if (mode === 'follow') {
        const ratio = clampNumber((gap - hardGap) / Math.max(1, comfortGap - hardGap), 0, 1);
        const followSpeed = frontSpeed * (0.82 + 0.14 * ratio);
        targetSpeed = Math.min(cruise, followSpeed + (canChase ? 19 : 10) * ratio);
      } else if (mode === 'chase') {
        const ratio = 1 - clampNumber((gap - comfortGap) / Math.max(1, chaseGap - comfortGap), 0, 1);
        targetSpeed = Math.min(maxSpeed, Math.max(cruise, cruise + (maxSpeed - cruise) * (0.24 + 0.36 * ratio)));
      } else if (!heavy && gap > chaseGap * 1.55) {
        targetSpeed = Math.min(maxSpeed, cruise * 1.018);
      }

      const smoothedTarget = smoothTargetSpeed(data, targetSpeed, currentSpeed, mode, delta);
      const acceleration = (data.acceleration || (canChase ? 112 : heavy ? 58 : 82)) * (mode === 'chase' ? 0.86 : 0.72);
      const brakePower = (data.brakePower || (canChase ? 168 : heavy ? 128 : 146)) * (mode === 'emergency' ? 0.92 : 0.68);
      const minOperationalSpeed = rowIndex <= 24
        ? (canChase ? 102 : 82)
        : (canChase ? 88 : heavy ? 72 : 80);

      data.followState = mode;
      data.currentSpeed = clampNumber(
        approach(currentSpeed, smoothedTarget, acceleration, brakePower, delta),
        minOperationalSpeed,
        maxSpeed
      );
    }

    laneItems.forEach(moveTrafficVehicle);

    const settled = laneItems
      .map((vehicle) => ({
        vehicle,
        progress: laneProgress(vehicle, direction, wrapMin, wrapMax)
      }))
      .sort((a, b) => a.progress - b.progress);

    for (let i = settled.length - 1; i >= 0; i -= 1) {
      const item = settled[i];
      const front = i === settled.length - 1 ? settled[0] : settled[i + 1];
      const data = item.vehicle.userData || {};
      const frontData = front.vehicle.userData || {};
      const frontProgress = front.progress + (i === settled.length - 1 ? span : 0);
      const minGap = Math.max(TRAFFIC_MIN_GAP, (data.width || 72) * 0.52, rowIndex <= 24 ? 82 : 62);
      const requiredProgress = frontProgress - ((data.width || 72) + (frontData.width || 72)) * 0.5 - minGap;
      const overlap = item.progress - requiredProgress;
      if (overlap <= 0) continue;

      const base = data.baseSpeed || data.speed || 0;
      const floor = rowIndex <= 24 ? base * 0.58 : Math.max(base * 0.68, isCompactVehicle(data) || isSuperVehicle(data) ? 88 : 72);
      const frontSpeed = frontData.currentSpeed || frontData.baseSpeed || 0;

      // Most tiny corrections are perceived as jitter. Brake first, then only
      // move the mesh when the overlap becomes visually unsafe.
      if (overlap <= 9) {
        data.currentSpeed = Math.min(data.currentSpeed || base, Math.max(frontSpeed * 0.98, floor));
        continue;
      }

      if (overlap <= 30) {
        const softCorrection = (overlap - 9) * 0.32;
        item.vehicle.position.x -= direction * softCorrection;
        data.currentSpeed = Math.min(data.currentSpeed || base, Math.max(frontSpeed * 0.95, floor));
        data.smoothedTargetSpeed = Math.min(data.smoothedTargetSpeed || data.currentSpeed, data.currentSpeed);
        continue;
      }

      item.vehicle.position.x = direction > 0 ? wrapMin + requiredProgress : wrapMax - requiredProgress;
      data.currentSpeed = Math.min(data.currentSpeed || base, Math.max(frontSpeed * 0.9, floor));
      data.smoothedTargetSpeed = Math.min(data.smoothedTargetSpeed || data.currentSpeed, data.currentSpeed);
    }
  };
}
