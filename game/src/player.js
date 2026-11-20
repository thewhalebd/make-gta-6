// Dario Cruz on foot: walk and run, enter and leave cars, pick up health, ammo
// and cash, and take damage. Driving lives in vehicles.js; fighting lives in
// combat.js; this file is the body that walks the streets of Solmar Bay. The 3D
// edition changes one thing about him: on foot the chase camera follows the
// direction he walks, not the direction he aims, so aiming at the mouse never
// swings the camera around.

import { PLAYER, WANTED } from './config.js';
import { clamp } from './random.js';
import { nearestStealableCar } from './vehicles.js';
import { addWanted } from './pedestrians.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    health: PLAYER.health,
    money: PLAYER.startMoney,
    ammo: PLAYER.startAmmo,
    hasGun: true,
    inCar: false,
    car: null,
    punchTimer: 0,
    hurtTimer: 0,
    moving: false,
    district: 'Downtown',
  };
}

export function updatePlayerOnFoot(state, dt, input, mouseWorld) {
  const p = state.player;
  if (p.inCar) return;
  const mx = input.moveX();
  const my = input.moveY();
  const len = Math.hypot(mx, my) || 1;
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    if (!state.city.isBlocked(nx, p.y, PLAYER.radius)) p.x = nx;
    if (!state.city.isBlocked(p.x, ny, PLAYER.radius)) p.y = ny;
    p.angle = Math.atan2(my, mx);
  }
  // Face the mouse when aiming with a weapon ready.
  if (mouseWorld) {
    const dx = mouseWorld.x - p.x;
    const dy = mouseWorld.y - p.y;
    if (Math.hypot(dx, dy) > 30) p.angle = Math.atan2(dy, dx);
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  p.district = state.city.districtAt(p.x, p.y);

  // Bumping into a pedestrian at a run knocks them down — and the law notices.
  if (p.moving && speed > PLAYER.walkSpeed) {
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 22) {
        ped.state = 'down';
        ped.timer = 5;
        addWanted(state, WANTED.hitPedestrian, 'Hit a pedestrian');
      }
    }
  }

  // Pickups: health, ammo, cash lying around the city.
  for (const pickup of state.city.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 30) {
      pickup.taken = true;
      if (pickup.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 40);
        state.particles.spawnText(p.x, p.y - 20, '+40 HEALTH', '#7de07d');
      } else if (pickup.kind === 'ammo') {
        p.ammo += 24;
        state.particles.spawnText(p.x, p.y - 20, '+24 AMMO', '#f2c94c');
      } else {
        p.money += 250;
        state.particles.spawnText(p.x, p.y - 20, '+$250', '#7de07d');
      }
      state.audio.pickup();
    }
  }
  // Slow health recovery when out of trouble.
  if (state.wanted === 0 && p.health < PLAYER.health && p.health > 0) {
    p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  }
}

// E near a car: get in (stealing a parked or traffic car raises the heat).
// E while driving: get out beside the car.
export function tryEnterExitCar(state) {
  const p = state.player;
  if (p.inCar) {
    const car = p.car;
    p.inCar = false;
    p.car = null;
    car.kind = 'parked';
    car.speed = 0;
    const a = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(a) * 40;
    p.y = car.y + Math.sin(a) * 40;
    if (state.city.isBlocked(p.x, p.y, PLAYER.radius)) {
      p.x = car.x - Math.cos(a) * 40;
      p.y = car.y - Math.sin(a) * 40;
    }
    state.audio.engineOff();
    return 'exit';
  }
  const car = nearestStealableCar(state);
  if (!car) return null;
  const wasParked = car.kind === 'parked';
  car.kind = 'player';
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  if (wasParked) {
    state.carsStolen += 1;
    addWanted(state, WANTED.stealCar, 'Stole a car');
    state.particles.spawnText(p.x, p.y - 30, 'STOLEN!', '#ffd94d');
  } else {
    // Yanking a driver out of a moving car is a bigger scene.
    state.carsStolen += 1;
    addWanted(state, WANTED.stealCar, 'Carjacked a driver');
    state.particles.spawnText(p.x, p.y - 30, 'CARJACKED!', '#ffd94d');
  }
  state.audio.engine(0);
  return 'enter';
}

export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.hurtTimer > 0 || p.health <= 0) return;
  p.health -= amount;
  p.hurtTimer = 0.5;
  state.particles.burst(p.x, p.y, 1, 6, 140, '#f74f4f', 4);
  if (p.health <= 0) {
    p.health = 0;
    state.wasted = true;
  }
}
