// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, cross
// at intersections, chat in the plaza, and run away when gunfire goes off
// or a car bears down on them. Hitting one with a car or a fist raises the
// heat. The 3D edition keeps their walks and their rules; the renderer just
// draws each one as a small box figure in the street instead of a painted
// circle.

import { WORLD } from './config.js';
import { pick, range } from './random.js';

const NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felix', 'Greta', 'Hugo', 'Iris', 'Jonas', 'Kira', 'Leo', 'Mina', 'Nico', 'Olga', 'Pablo', 'Rosa', 'Sofia', 'Tomas', 'Uma'];
const SHIRTS = ['#e2725b', '#4f7fb8', '#f2c94c', '#7a9a5b', '#c94f7c', '#8a6fa8', '#e8e0d0', '#5fb8a8'];
const SKINS = ['#f2c9a0', '#d9a06b', '#b87a4a', '#8a5a30', '#e8b88a'];

export function createPedestrians(city, random, count = 42) {
  const people = [];
  for (let i = 0; i < count; i += 1) {
    const spot = city.nearestRoadPoint(
      range(random, 100, WORLD.width - 100),
      range(random, 100, WORLD.beachY - 100),
    );
    people.push({
      name: pick(random, NAMES),
      x: spot.x + range(random, -60, 60),
      y: spot.y + range(random, -60, 60),
      angle: range(random, 0, Math.PI * 2),
      speed: range(random, 34, 62),
      shirt: pick(random, SHIRTS),
      skin: pick(random, SKINS),
      state: 'walk', // walk | flee | down
      targetX: spot.x,
      targetY: spot.y,
      timer: range(random, 0, 4),
      panic: 0,
    });
  }
  return people;
}

// Pick a new place to stroll to, near where the pedestrian already is.
function pickStrollTarget(ped, city, random) {
  const spot = city.nearestRoadPoint(
    ped.x + range(random, -500, 500),
    ped.y + range(random, -500, 500),
  );
  ped.targetX = spot.x + range(random, -40, 40);
  ped.targetY = spot.y + range(random, -40, 40);
}

export function updatePedestrians(state, dt) {
  const city = state.city;
  const px = state.player.x;
  const py = state.player.y;
  const recentShot = state.shotsFired > 0 && state.time - state.lastShotTime < 2;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        ped.x = ped.targetX;
        ped.y = ped.targetY;
      }
      continue;
    }
    const nearPlayer = Math.hypot(ped.x - px, ped.y - py) < 130;
    const playerCar = state.player.car;
    const carThreat = playerCar
      && Math.abs(playerCar.speed) > 120
      && Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y) < 120;
    if ((recentShot && nearPlayer) || carThreat || (state.wanted >= 3 && nearPlayer)) {
      ped.state = 'flee';
      ped.panic = 2.5;
    }
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - py, ped.x - px);
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * 150 * dt;
      const ny = ped.y + Math.sin(away) * 150 * dt;
      if (!city.isBlocked(nx, ny, 10)) {
        ped.x = nx;
        ped.y = ny;
      }
      if (ped.panic <= 0) {
        ped.state = 'walk';
        pickStrollTarget(ped, city, state.random);
      }
      continue;
    }
    ped.timer -= dt;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12 || ped.timer <= 0) {
      pickStrollTarget(ped, city, state.random);
      ped.timer = range(state.random, 3, 9);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!city.isBlocked(nx, ny, 10)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      pickStrollTarget(ped, city, state.random);
    }
  }
}

// A punch or a car hit knocks a pedestrian down and raises the wanted level.
export function knockPedestrian(state, ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.timer = 6;
  ped.targetX = ped.x;
  ped.targetY = ped.y;
  state.particles.burst(ped.x, ped.y, 1, 8, 160, '#f2c94c', 4);
  addWanted(state, 1, 'Hit a pedestrian');
}

export function addWanted(state, stars, reason) {
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedHeat = Math.max(state.wantedHeat, state.wanted);
  state.lastCrimeTime = state.time;
  state.lastCrimeReason = reason;
}
