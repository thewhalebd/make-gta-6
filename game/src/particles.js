// Particles and floating text: tyre smoke, muzzle flashes, exhaust puffs,
// impact sparks, the soft "poof" of a hit, and the "+$800" popups. Two
// fixed pools, so nothing is allocated while the game runs. The 3D renderer
// draws each particle as a small box in the world and projects the floating
// texts onto the HUD canvas, so the same popups the 2D game showed still
// float above the street.

export const P_SMOKE = 0;
export const P_SPARK = 1;
export const P_FLASH = 2;
export const P_RING = 3;

const POOL_SIZE = 220;
const TEXT_POOL_SIZE = 24;

export function createParticles() {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    pool.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, color: '#ffffff' });
  }
  const texts = [];
  for (let i = 0; i < TEXT_POOL_SIZE; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, max: 1, text: '', color: '#ffffff' });
  }

  // Grab the first free slot in the pool, or drop the particle if full.
  function spawn(kind, x, y, vx, vy, life, size, color) {
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (p.active) continue;
      p.active = true;
      p.kind = kind;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.max = life;
      p.size = size;
      p.color = color;
      return;
    }
  }

  function spawnText(x, y, text, color) {
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (t.active) continue;
      t.active = true;
      t.x = x;
      t.y = y;
      t.life = 1.4;
      t.max = 1.4;
      t.text = text;
      t.color = color;
      return;
    }
  }

  // A ring of particles flying out from one point in random directions.
  function burst(x, y, kind, count, speed, color, size = 4) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.4 + Math.random() * 0.8);
      const life = 0.35 + Math.random() * 0.4;
      const scale = size * (0.6 + Math.random() * 0.8);
      spawn(kind, x, y, Math.cos(angle) * velocity, Math.sin(angle) * velocity, life, scale, color);
    }
  }

  function update(dt) {
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 26 * dt;
      if (t.life <= 0) t.active = false;
    }
  }

  return { pool, texts, spawn, spawnText, burst, update };
}
