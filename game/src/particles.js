// Particles and floating text: tyre smoke, muzzle flashes, exhaust puffs, impact
// sparks, blood-free "poof" hits and the "+$800" popups. One fixed pool, no
// allocation while the game runs.

export const P_SMOKE = 0;
export const P_SPARK = 1;
export const P_FLASH = 2;
export const P_RING = 3;

export function createParticles() {
  const pool = [];
  for (let i = 0; i < 220; i += 1) {
    pool.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, color: '#ffffff' });
  }
  const texts = [];
  for (let i = 0; i < 24; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, max: 1, text: '', color: '#ffffff' });
  }

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

  function burst(x, y, kind, count, speed, color, size = 4) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.4, size * (0.6 + Math.random() * 0.8), color);
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
