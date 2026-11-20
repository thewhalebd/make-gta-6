// The Solmar Bay police: patrol cars that spawn at the edge of the camera's view
// when the wanted level rises, chase the player (in a car or on foot), ram the
// player's car, and arrest the player on foot if they hold him long enough.
// When no cop can see the player, the heat cools and the stars fall away. The
// 3D edition keeps the whole chase; the renderer adds the flashing red-and-blue
// light bar on each patrol car's roof.

import { POLICE, WANTED } from './config.js';
import { angleDiff, clamp } from './random.js';

export function createPolice() {
  return { cars: [], spawnTimer: 0, arrestProgress: 0, sirenTimer: 0 };
}

function wantedCarCount(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

export function updatePolice(state, dt) {
  const police = state.police;
  const player = state.player;
  const wanted = state.wanted;
  police.spawnTimer -= dt;
  police.sirenTimer -= dt;

  // Spawn up to the wanted level's car count, just off-screen from the player.
  const want = Math.min(wantedCarCount(wanted), POLICE.maxCops);
  if (police.cars.length < want && police.spawnTimer <= 0) {
    police.spawnTimer = POLICE.spawnInterval;
    const a = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(a) * 700;
    const y = player.y + Math.sin(a) * 700;
    const p = state.city.nearestRoadPoint(Math.max(60, Math.min(3540, x)), Math.max(60, Math.min(2540, y)));
    police.cars.push({
      x: p.x, y: p.y, angle: 0, speed: 0,
      color: POLICE.carColor, kind: 'police', model: 'Police Cruiser', top: POLICE.maxSpeed, accel: POLICE.accel,
    });
    if (police.sirenTimer <= 0) {
      state.audio.siren();
      police.sirenTimer = 3;
    }
  }

  // Chase: steer at the player, accelerate, ram the player's car.
  let anyNear = false;
  for (const cop of police.cars) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d < 900) anyNear = true;
    const wantAngle = Math.atan2(dy, dx);
    cop.angle += clamp(angleDiff(cop.angle, wantAngle), -2.8 * dt, 2.8 * dt);
    const targetSpeed = Math.min(POLICE.maxSpeed, 260 + wanted * 60);
    cop.speed += clamp(targetSpeed - cop.speed, -700 * dt, POLICE.accel * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!state.city.isBlocked(nx, ny, 20)) {
      cop.x = nx;
      cop.y = ny;
    } else {
      cop.speed *= 0.4;
    }
    // Ram the player's car.
    if (player.car && d < 52) {
      player.car.speed *= 0.92;
      cop.speed *= 0.9;
      if (Math.abs(player.car.speed) > 200 && Math.random() < 0.1) state.audio.crash();
    }
    // Arrest on foot: hold the player for arrestTime seconds.
    if (!player.car && d < 30) {
      police.arrestProgress += dt;
      if (police.arrestProgress >= POLICE.arrestTime) {
        state.busted = true;
        police.arrestProgress = 0;
      }
    }
  }
  if (!police.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 34)) {
    police.arrestProgress = Math.max(0, police.arrestProgress - dt * 2);
  }

  // Heat cools when the player is out of sight for a while.
  if (wanted > 0 && !anyNear && state.time - state.lastCrimeTime > WANTED.decayDelay) {
    state.wantedHeat -= WANTED.decayRate * dt;
    if (state.wantedHeat <= state.wanted - 1) {
      state.wanted -= 1;
      state.wantedHeat = state.wanted;
    }
  }
  if (wanted === 0) {
    // Cops give up and drive off once the heat is gone.
    for (let i = police.cars.length - 1; i >= 0; i -= 1) {
      const cop = police.cars[i];
      const d = Math.hypot(cop.x - player.x, cop.y - player.y);
      if (d > 800) police.cars.splice(i, 1);
    }
  }
}

export function clearPolice(state) {
  state.police.cars.length = 0;
  state.police.arrestProgress = 0;
  state.wanted = 0;
  state.wantedHeat = 0;
}
