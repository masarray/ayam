export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function tileToX(tileIndex, tileSize) {
  return tileIndex * tileSize;
}

export function rowToY(rowIndex, tileSize) {
  return rowIndex * tileSize;
}

export function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(rowIndex, salt = 17) {
  const x = Math.sin(rowIndex * 999 + salt * 771) * 10000;
  return Math.floor((x - Math.floor(x)) * 1000000000);
}

export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function uniqueRandomTiles(random, count, minTile, maxTile, excluded = []) {
  const blocked = new Set(excluded);
  const tiles = [];
  let guard = 0;
  while (tiles.length < count && guard < 200) {
    guard += 1;
    const tile = Math.floor(random() * (maxTile - minTile + 1)) + minTile;
    if (blocked.has(tile)) continue;
    blocked.add(tile);
    tiles.push(tile);
  }
  return tiles.sort((a, b) => a - b);
}
