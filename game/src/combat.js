// Combat: fists, the pistol, bullets, and the thugs and the boss who fight back.
// Thugs chase the player and punch; the boss, Cassian Voss, shoots back. Bullets
// are a small pool; a hit on a thug or the boss pays out, a hit on a bystander
// raises the wanted level.

import { PLAYER, WANTED } from './config.js';
import { angleTo, clamp, dist } from './random.js';
import { addWanted, knockPedestrian } from './pedestrians.js';
import { hurtPlayer } from './player.js';

export function createBullets() {
  const bullets = [];
  for (let i = 0; i < 48; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, fromPlayer: true });
  }
  return bullets;
}

export function fireBullet(state, x, y, angle, fromPlayer) {
  for (const b of state.bullets) {
    if (b.active) continue;
    b.active = true;
    b.x = x + Math.cos(angle) * 22;
    b.y = y + Math.sin(angle) * 22;
    b.vx = Math.cos(angle) * 900;
    b.vy = Math.sin(angle) * 900;
    b.life = 0.6;
    b.fromPlayer = fromPlayer;
    state.particles.spawn(2, b.x, b.y, 0, 0, 0.08, 10, '#ffe9a0');
    return true;
  }
  return false;
}

export function punch(state) {
  const p = state.player;
  if (p.punchTimer > 0 || p.inCar) return;
  p.punchTimer = PLAYER.punchCooldown;
  state.audio.punch();
  const hx = p.x + Math.cos(p.angle) * 26;
  const hy = p.y + Math.sin(p.angle) * 26;
  state.particles.burst(hx, hy, 1, 5, 120, '#ffffff', 3);
  // Thugs and the boss take the punch.
  for (const thug of state.thugs) {
    if (thug.hp <= 0) continue;
    if (dist(hx, hy, thug.x, thug.y) < PLAYER.punchRange) damageThug(state, thug, PLAYER.punchDamage);
  }
  // Pedestrians take the punch too — and the police notice.
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(hx, hy, ped.x, ped.y) < PLAYER.punchRange) knockPedestrian(state, ped);
  }
}

export function shootAt(state, mouseWorld) {
  const p = state.player;
  if (p.inCar || p.ammo <= 0) return;
  if (state.fireTimer > 0) return;
  state.fireTimer = PLAYER.fireCooldown;
  p.ammo -= 1;
  p.angle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);
  fireBullet(state, p.x, p.y, p.angle, true);
  state.audio.gunshot();
  state.shotsFired += 1;
  state.lastShotTime = state.time;
  addWanted(state, WANTED.shoot, 'Fired a gun');
  // A muzzle flash and a little kick.
  state.particles.spawn(2, p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 0, 0, 0.07, 12, '#ffe9a0');
}

export function damageThug(state, thug, amount) {
  thug.hp -= amount;
  state.particles.burst(thug.x, thug.y, 1, 6, 160, '#f74f4f', 4);
  if (thug.hp <= 0) {
    thug.hp = 0;
    state.kills += 1;
    state.particles.spawnText(thug.x, thug.y - 24, thug.boss ? 'VOSS DOWN!' : 'THUG DOWN', '#ffd94d');
    state.audio.cash();
    if (thug.boss) state.bossDown = true;
  }
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    if (!b.active) continue;
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || state.city.isBlocked(b.x, b.y, 4)) {
      if (state.city.isBlocked(b.x, b.y, 4)) state.particles.burst(b.x, b.y, 1, 4, 120, '#ffd94d', 3);
      b.active = false;
      continue;
    }
    if (b.fromPlayer) {
      for (const thug of state.thugs) {
        if (thug.hp <= 0) continue;
        if (dist(b.x, b.y, thug.x, thug.y) < 16) {
          damageThug(state, thug, PLAYER.gunDamage);
          b.active = false;
          break;
        }
      }
      if (!b.active) continue;
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 12) {
          knockPedestrian(state, ped);
          b.active = false;
          break;
        }
      }
      if (!b.active) continue;
      for (const cop of state.police.cars) {
        if (dist(b.x, b.y, cop.x, cop.y) < 26) {
          state.particles.burst(cop.x, cop.y, 1, 6, 160, '#4f8ef7', 4);
          addWanted(state, 1, 'Shot at police');
          b.active = false;
          break;
        }
      }
    } else if (dist(b.x, b.y, state.player.x, state.player.y) < 14 && !state.player.inCar) {
      hurtPlayer(state, 9);
      b.active = false;
    }
  }
}

// Thugs: spawn at a spot, chase the player when close, punch when in reach.
// The boss shoots instead of punching.
export function spawnThug(state, x, y, boss = false) {
  const thug = {
    x, y, angle: 0, hp: boss ? 220 : 60, boss,
    speed: boss ? 120 : 150,
    attackTimer: 0,
    shootTimer: 1.2,
    name: boss ? 'Cassian Voss' : "Voss's thug",
  };
  state.thugs.push(thug);
  return thug;
}

export function updateThugs(state, dt) {
  const p = state.player;
  for (const thug of state.thugs) {
    if (thug.hp <= 0) continue;
    const d = dist(thug.x, thug.y, p.x, p.y);
    thug.attackTimer -= dt;
    if (d < 420) {
      const a = angleTo(thug.x, thug.y, p.x, p.y);
      thug.angle = a;
      if (thug.boss) {
        thug.shootTimer -= dt;
        if (thug.shootTimer <= 0 && d < 380 && !p.inCar) {
          thug.shootTimer = 1.1;
          fireBullet(state, thug.x, thug.y, a, false);
          state.audio.gunshot();
        }
      } else if (d > 26) {
        const nx = thug.x + Math.cos(a) * thug.speed * dt;
        const ny = thug.y + Math.sin(a) * thug.speed * dt;
        if (!state.city.isBlocked(nx, ny, 12)) {
          thug.x = nx;
          thug.y = ny;
        }
      } else if (thug.attackTimer <= 0) {
        thug.attackTimer = 0.9;
        hurtPlayer(state, 12);
        state.audio.punch();
      }
    } else if (d < 900) {
      // Drift back toward the plaza when the player is near but not close.
      const a = angleTo(thug.x, thug.y, p.x, p.y);
      const nx = thug.x + Math.cos(a) * thug.speed * 0.4 * dt;
      const ny = thug.y + Math.sin(a) * thug.speed * 0.4 * dt;
      if (!state.city.isBlocked(nx, ny, 12)) {
        thug.x = nx;
        thug.y = ny;
      }
    }
  }
  // Remove the dead once the mission counts them.
  state.thugs = state.thugs.filter((t) => t.hp > 0 || t.boss);
}
