// The screenshot scenes behind ?shot=start|play|chase|mission. Each one
// stages the real game — the same state the player gets, with the same
// systems running — then plays it forward a few seconds with a simple
// autopilot, so the frame is what a short session really looks like and the
// same seed always gives the same frame. In the 3D edition the chase camera
// follows the staged player or car, so each scene is framed from behind the
// action the way the game itself plays.

import { STEP } from './config.js';
import { startMission } from './missions.js';

// Step the world forward with traffic and pedestrians moving; the player
// drives forward in the chase scene and walks in the others.
function simulate(state, seconds, drive) {
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
    // Three patrol cars behind the player's car, spread side by side at one
    // distance instead of in a line: a line puts the nearest car below the
    // bottom of the frame, while a row sits across the lower frame together.
    // The staged drive is only half a second, so they hold that distance.
    // The camera pulls back for this shot, so the row is in the lower frame
    // instead of pressed against the lens.
    const offsets = [-90, 0, 90];
    for (let i = 0; i < 3; i += 1) {
      state.police.cars.push({
        x: car.x + 100,
        y: car.y + offsets[i],
        angle: Math.PI,
        speed: 440,
        color: '#e8e8e8',
        kind: 'police',
        model: 'Police Cruiser',
        top: 600,
        accel: 700,
      });
    }
    state.cameraDistance = 380;
    state.cameraSnap = true;
    simulate(state, 0.5, true);
    return 'play';
  }
  if (name === 'mission') {
    // Mission 4 in progress: Dario at the market plaza facing Voss's thugs.
    // The camera pulls up and back for this one, so the whole plaza fight
    // — Dario, the three thugs and their rings — fits in the frame.
    state.missions.index = 3;
    startMission(state);
    p.x = 1575;
    p.y = 800;
    p.angle = -Math.PI / 2;
    state.cameraDistance = 330;
    state.cameraHeight = 200;
    state.cameraSnap = true;
    simulate(state, 0.8, false);
    return 'play';
  }
  // play: Dario on foot on a busy downtown street, traffic and pedestrians
  // around. He stands on the road itself, so the chase camera sits on the
  // street too and looks down it, instead of pressing against a building wall.
  p.x = 2100;
  p.y = 900;
  p.angle = 0;
  state.missions.index = 0;
  state.missions.dialogue = 'Mara: "Dario! Get to my garage — the blue wrench on your map."';
  state.missions.dialogueTimer = 7;
  state.cameraSnap = true;
  simulate(state, 3, false);
  return 'play';
}

// The autopilot the staged scenes use while they play forward: drive
// straight ahead (chase) or stroll toward the nearest road (on foot).
export function autopilotDrive(state) {
  const car = state.player.car;
  if (!car) return { throttle: 0, steer: 0 };
  return { throttle: 1, steer: 0 };
}
