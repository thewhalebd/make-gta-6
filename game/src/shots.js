// The screenshot scenes behind ?shot=start|play|chase|mission. Each one stages
// the real game — the same state the player gets, with the same systems running
// — then plays it forward a few seconds with a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { startMission } from './missions.js';

function simulate(state, seconds, drive) {
  // Step the world forward with the traffic and pedestrians moving; the player
  // drives forward in the chase scene, walks in the others.
  for (let i = 0; i < seconds / STEP; i += 1) {
    state.stepWorld(STEP, drive);
  }
}

export function stageShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    p.x = 1800;
    p.y = 900;
    state.timeOfDay = 0.62;
    state.cameraSnap = true;
    simulate(state, 2, false);
    return 'title';
  }
  if (name === 'chase') {
    // The player in a Marina Coupe on the beach road, three stars, police behind.
    const car = state.cars.find((c) => c.model === 'Marina Coupe');
    p.x = car.x;
    p.y = car.y;
    p.car = car;
    p.inCar = true;
    car.kind = 'player';
    car.angle = Math.PI;
    car.speed = 420;
    state.wanted = 3;
    state.wantedHeat = 3;
    state.lastCrimeTime = state.time;
    state.missions.active = true;
    state.missions.index = 4; // The Getaway
    state.missions.step = 0;
    state.missions.dialogue = 'Tito: "Voss tipped the cops — lose them and get to the hideout in the hills!"';
    state.missions.dialogueTimer = 7;
    state.missions.banner = '5 — The Getaway';
    state.missions.bannerTimer = 3;
    for (let i = 0; i < 3; i += 1) {
      state.police.cars.push({
        x: car.x + 260 + i * 70, y: car.y + (i - 1) * 60, angle: Math.PI, speed: 380,
        color: '#e8e8e8', kind: 'police', model: 'Police Cruiser', top: 600, accel: 700,
      });
    }
    state.cameraSnap = true;
    simulate(state, 1.2, true);
    return 'play';
  }
  if (name === 'mission') {
    // Mission 4 in progress: Dario at the market plaza facing Voss's thugs.
    state.missions.index = 3;
    startMission(state);
    p.x = 1575;
    p.y = 800;
    p.angle = -Math.PI / 2;
    state.cameraSnap = true;
    simulate(state, 0.8, false);
    return 'play';
  }
  // play: Dario on foot on a busy downtown street, traffic and pedestrians around.
  p.x = 1800;
  p.y = 950;
  state.missions.index = 0;
  state.missions.dialogue = 'Mara: "Dario! Get to my garage — the blue wrench on your map."';
  state.missions.dialogueTimer = 7;
  state.cameraSnap = true;
  simulate(state, 3, false);
  return 'play';
}

// The autopilot the staged scenes use while they play forward: drive straight
// ahead (chase) or stroll toward the nearest road (on foot).
export function autopilotDrive(state) {
  const car = state.player.car;
  if (!car) return { throttle: 0, steer: 0 };
  return { throttle: 1, steer: 0 };
}
