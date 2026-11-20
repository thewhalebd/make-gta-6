// A small seeded random generator (mulberry32) plus the helpers the city and the
// traffic use, so a ?seed=N screenshot stages exactly the same Solmar Bay every time.
// The 3D camera smooths its heading through angleLerp(), which always turns the
// short way around the circle instead of spinning the long way.

export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function chance(random, p) {
  return random() < p;
}

// A stable hash of two integers, for per-block colour variation that never changes.
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Move angle a toward angle b by fraction t, always the short way around.
export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}
