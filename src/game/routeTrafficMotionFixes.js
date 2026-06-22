import { RoadQuestGame } from './RoadQuestGame.js';
import { TRAFFIC_MIN_GAP } from './constants.js';

if (!RoadQuestGame.__ayamRouteTrafficMotionFixesAppliedV1) {
  RoadQuestGame.__ayamRouteTrafficMotionFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const originalAddRow = proto._addRow;
  const originalNormalizeTrafficLane = proto._normalizeTrafficLaneForPlayability;
  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

  const noise = (rowIndex, salt = 0) => {
    const x = Math.sin((rowIndex + 1) * 127.13 + (salt + 19) * 59.37) * 43758.5453;
    return x - Math.floor(x);
  };

  const kindText = (data = {}) => String(data.kind || '').toLowerCase();
  const isSuper = (data) => /supercar|super/.test(kindText(data));
  const isFast = (data) => /police|ambulance|sports/.test(kindText(data));
  const isHeavy = (data) => /bus|truck|tanker|container|dump|tractor|articulated/.test(kindText(data)) || Number(data.width || 0) >= 116;
  const isCompact = (data) => /sedan|hatchback|wagon|taxi|pickup|van/.test(kindText(data)) || Number(data.width || 0) <= 96;

  const routePressure = (rowIndex, cycle = 0) => Math.min(1.9, Math.max(0, rowIndex - 4) * 0.0042 + cycle * 0.14);

  const speedBandFor = (rowIndex, data = {}, cycle = 0, laneCount = 2) => {
    const pressure = routePressure(rowIndex, cycle);
    const laneBoost = laneCount >= 4 ? 1.07 : 1;
    if (isSuper(data)) return { min: (340 + pressure * 58) * laneBoost, max: (500 + pressure * 86) * laneBoost };
    if (isFast(data)) return { min: (270 + pressure * 42) * laneBoost, max: (410 + pressure * 68) * laneBoost };
    if (isHeavy(data)) {
      if (rowIndex < 24) return { min: 145, max: 215 };
      if (rowIndex < 80) return { min: 165 + pressure * 18, max: 265 + pressure * 32 };
      return { min: 190 + pressure * 22, max: 315 + pressure * 42 };
    }
    if (isCompact(data)) {
      if (rowIndex < 24) return { min: 205, max: 292 };
      if (rowIndex < 80) return { min: 220 + pressure * 18, max: 345 + pressure * 44 };
      return { min: 250 + pressure * 28, max: 425 + pressure * 64 };
    }
    if (rowIndex < 24) return { min: 185, max: 270 };
    if (rowIndex < 80) return { min: 205 + pressure * 16, max: 322 + pressure * 38 };
    return { min: 230 + pressure * 24, max: 388 + pressure * 56 };
  };

  const meshExtent = (mesh) => {
    const geometry = mesh?.geometry;
    if (!geometry) return { x: 0, y: 0, z: 0 };
    if (!geometry.boundingBox) geometry.computeBoundingBox?.();
    const box = geometry.boundingBox;
    if (!box) return { x: 0, y: 0, z: 0 };
    return {
      x: Math.abs((box.max.x - box.min.x) * (mesh.scale?.x || 1)),
      y: Math.abs((box.max.y - box.min.y) * (mesh.scale?.y || 1)),
      z: Math.abs((box.max.z - box.min.z) * (mesh.scale?.z || 1))
    };
  };

  const stabilizeMovingVehicleShadows = (vehicle) => {
    if (!vehicle || vehicle.userData?.routeShadowStableV1) return;
    vehicle.traverse?.((child) => {
      if (!child?.isMesh) return;
      const extent = meshExtent(child);
      const tinyOrFlat = extent.z <= 7 || extent.x <= 12 || extent.y <= 8;
      child.receiveShadow = false;
      if (tinyOrFlat) child.castShadow = false;
    });
    vehicle.userData.routeShadowStableV1 = true;
  };

  const applyRouteSpeedProfile = (game, rowIndex, items = []) => {
    const row = game.rows?.[rowIndex];
    if (!row?.__routePlannedV1 || row.type !== 'traffic' || !Array.isArray(items)) return items;
    const cycle = Number(row.__routeCycle || 0);
    const laneCount = Number(row.roadLaneCount || 2);
    const pressure = routePressure(rowIndex, cycle);

    items.forEach((vehicle, index) => {
      const data = vehicle.userData || {};
      stabilizeMovingVehicleShadows(vehicle);
      if (data.routeSpeedProfileAppliedV2) return;
      const band = speedBandFor(rowIndex, data, cycle, laneCount);
      const base = Math.round(band.min + noise(rowIndex, index + 31) * (band.max - band.min));
      const extra = (isFast(data) ? 0.08 : 0) + (isSuper(data) ? 0.16 : 0);
      const drive = clampNumber(Number(data.aggression || 0.36) + pressure * 0.1 + extra, 0.22, 0.96);
      const maxSpeed = Math.round(base * (1.14 + drive * 0.26));
      const width = Number(data.width || 72);
      const compact = isCompact(data) || isSuper(data);
      const heavy = isHeavy(data);

      data.speed = base;
      data.baseSpeed = base;
      data.cruiseSpeed = Math.round(base * (0.97 + noise(rowIndex, index + 41) * 0.13));
      data.maxSpeed = maxSpeed;
      data.acceleration = Math.round((compact ? 128 : heavy ? 82 : 108) + drive * 92);
      data.brakePower = Math.round((compact ? 178 : heavy ? 146 : 160) + drive * 92);
      data.aggression = drive;
      data.reaction = clampNumber(0.19 - drive * 0.055, 0.105, 0.19);
      data.currentSpeed = clampNumber(Number(data.currentSpeed || base), base * 0.92, maxSpeed);
      data.minFollowGap = Math.max(TRAFFIC_MIN_GAP, width * (compact ? 0.42 : heavy ? 0.52 : 0.46), rowIndex < 24 ? 62 : 54);
      data.smoothedTargetSpeed = data.currentSpeed;
      data.routeSpeedProfileAppliedV2 = true;
    });

    return items;
  };

  proto._addRow = function addRowWithRouteTrafficMotion(...args) {
    const result = originalAddRow.apply(this, args);
    const row = args[0];
    if (row?.__routePlannedV1 && row.type === 'traffic') applyRouteSpeedProfile(this, row.index, this.trafficRows.get(row.index));
    return result;
  };

  proto._normalizeTrafficLaneForPlayability = function normalizeRouteTrafficMotion(rowIndex, items = []) {
    const normalized = originalNormalizeTrafficLane?.call(this, rowIndex, items) || items;
    return applyRouteSpeedProfile(this, rowIndex, normalized) || normalized;
  };
}
