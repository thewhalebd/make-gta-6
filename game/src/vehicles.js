// Vehicles: the traffic that fills Solmar Bay's roads, the parked cars waiting to
// be stolen, and the arcade driving model for the car the player is in. Traffic
// cars follow the road grid, keep to their lane, brake for the car ahead and pick
// a new turning at every intersection. The 3D edition keeps the driving model
// exactly; the renderer builds each car from boxes — body, cabin, wheels —
// with the same paint, length and width the 2D game drew.

import { CAR, CAR_MODELS, WORLD } from './config.js';
import { angleDiff, clamp, pick, range } from './random.js';

function makeCar(model, x, y, angle) {
  return {
    model: model.name,
    color: model.color,
    top: model.top,
    accel: model.accel,
    taxi: !!model.taxi,
    x, y, angle,
    speed: 0,
    kind: 'traffic',
    targetX: x,
    targetY: y,
    wait: 0,
    honk: 0,
  };
}

export function createVehicles(city, random) {
  const cars = [];
  // Parked cars along the curbs, ready to be stolen (E to enter).
  const parkedSpots = [
    { x: 2700, y: 2400, model: 3 }, // the Marina Coupe for mission 2
    { x: 700, y: 500, model: 0 },
    { x: 1600, y: 950, model: 1 },
    { x: 2500, y: 1400, model: 4 },
    { x: 1150, y: 1600, model: 1 },
    { x: 2050, y: 500, model: 2 },
    { x: 3200, y: 1850, model: 0 },
    { x: 500, y: 1150, model: 4 },
    { x: 2900, y: 950, model: 1 },
    { x: 1600, y: 2050, model: 2 },
  ];
  for (const spot of parkedSpots) {
    const car = makeCar(CAR_MODELS[spot.model], spot.x, spot.y, Math.PI / 2);
    car.kind = 'parked';
    cars.push(car);
  }
  // Traffic cars on the roads.
  for (let i = 0; i < 26; i += 1) {
    const rx = pick(random, city.roadsX);
    const ry = pick(random, city.roadsY);
    const horizontal = random() < 0.5;
    const car = makeCar(pick(random, CAR_MODELS), horizontal ? range(random, 100, WORLD.width - 100) : rx, horizontal ? ry : range(random, 100, WORLD.beachY - 100), horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
    car.speed = range(random, 120, 220);
    pickNextTarget(car, city, random);
    cars.push(car);
  }
  return cars;
}

function pickNextTarget(car, city, random) {
  // Drive to a nearby intersection, then pick a new one: the car always travels
  // along a road, never across a block.
  const rx = city.roadsX[Math.floor(random() * city.roadsX.length)];
  const ry = city.roadsY[Math.floor(random() * city.roadsY.length)];
  const horizontal = Math.abs(car.y - ry) < Math.abs(car.x - rx) || random() < 0.5;
  if (horizontal) {
    car.targetX = rx;
    car.targetY = car.y;
  } else {
    car.targetX = car.x;
    car.targetY = ry;
  }
  // Snap the target onto the nearest road centreline.
  const p = city.nearestRoadPoint(car.targetX, car.targetY);
  car.targetX = p.x;
  car.targetY = p.y;
}

function carAhead(state, car, look) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < look && side < 40) return true;
  }
  const p = state.player;
  if (!p.inCar) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const along = dx * fx + dy * fy;
    if (along > 0 && along < look && Math.abs(dx * -fy + dy * fx) < 36) return true;
  }
  return false;
}

export function updateTraffic(state, dt) {
  const city = state.city;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    const dx = car.targetX - car.x;
    const dy = car.targetY - car.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 26) {
      pickNextTarget(car, city, state.random);
      continue;
    }
    const want = Math.atan2(dy, dx);
    car.angle += clamp(angleDiff(car.angle, want), -2.2 * dt, 2.2 * dt);
    const blocked = carAhead(state, car, 90);
    const targetSpeed = blocked ? 0 : Math.min(car.top * 0.45, 210);
    car.speed += clamp(targetSpeed - car.speed, -420 * dt, 260 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!city.isBlocked(nx, ny, 20)) {
      car.x = nx;
      car.y = ny;
    } else {
      pickNextTarget(car, city, state.random);
      car.speed = 0;
    }
  }
}

// The car the player drives: arcade handling with drift, skid smoke and a crash
// bounce off buildings. Returns true while the player is driving.
export function drivePlayerCar(state, dt, input) {
  const car = state.player.car;
  if (!car) return false;
  const throttle = input.moveY(); // W = -1 in screen terms; invert below
  const steer = input.moveX();
  const forward = -throttle; // W gives moveY -1, so forward = +1
  const speedSign = car.speed >= 0 ? 1 : -1;
  if (forward > 0) car.speed += car.accel * dt;
  else if (forward < 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= car.speed * 1.4 * dt;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, car.top);
  const steerAmount = CAR.steer * clamp(Math.abs(car.speed) / 200, 0, 1) * speedSign;
  car.angle += steer * steerAmount * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = state.city.isBlocked(nx, ny, 20) || state.city.isBlocked(nx + Math.cos(car.angle) * 22, ny + Math.sin(car.angle) * 22, 12);
  if (hit) {
    if (Math.abs(car.speed) > 160) {
      state.audio.crash();
      state.particles.burst(car.x, car.y, 1, 10, 220, '#ffd94d', 4);
      state.player.health = Math.max(1, state.player.health - 4);
    }
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
    // Skid smoke when steering hard at speed.
    if (Math.abs(steer) > 0.5 && Math.abs(car.speed) > 260 && Math.random() < 0.5) {
      state.particles.spawn(0, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, -Math.cos(car.angle) * 30, -Math.sin(car.angle) * 30, 0.5, 7, '#cfc8b8');
    }
    if (Math.random() < 0.25) {
      state.particles.spawn(0, car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26, 0, 0, 0.35, 4, '#8a8a8a');
    }
  }
  // Bumping into traffic cars shoves them and costs a little speed.
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked') continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 48 && d > 0.01) {
      const push = (48 - d) / 48;
      other.x += ((other.x - car.x) / d) * push * 14;
      other.y += ((other.y - car.y) / d) * push * 14;
      car.speed *= 0.97;
    }
  }
  state.player.x = car.x;
  state.player.y = car.y;
  state.audio.engine(Math.abs(car.speed) / car.top);
  return true;
}

// The nearest parked or traffic car the player could steal, within reach.
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 70;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
