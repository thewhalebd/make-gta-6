// Solmar Bay — boot and the one loop. The game moves between six screens:
// title, play, paused, busted, wasted and win. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is there.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { PLAYER, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createParticles } from './particles.js';
import { createVehicles, drivePlayerCar, nearestStealableCar, updateTraffic } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice } from './police.js';
import { createPlayer, hurtPlayer, tryEnterExitCar, updatePlayerOnFoot } from './player.js';
import { createBullets, punch, shootAt, updateBullets, updateThugs } from './combat.js';
import { createMissions, currentMission, currentStep, startMission, updateMissions } from './missions.js';
import { createHud, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, SCREEN_WIN } from './hud.js';
import { createRenderer } from './render.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const audio = createAudio();
const renderer = createRenderer(canvas);
const hud = createHud(canvas);

function createState() {
  const state = {
    random, city, audio,
    time: 0,
    timeOfDay: 0.55, // a golden afternoon in Solmar Bay
    player: createPlayer(1125, 750),
    cars: createVehicles(city, random),
    peds: createPedestrians(city, random, 42),
    police: createPolice(),
    particles: createParticles(),
    bullets: createBullets(),
    thugs: [],
    missions: createMissions(),
    wanted: 0,
    wantedHeat: 0,
    lastCrimeTime: -100,
    lastCrimeReason: '',
    lastShotTime: -100,
    shotsFired: 0,
    fireTimer: 0,
    kills: 0,
    carsStolen: 0,
    busted: false,
    wasted: false,
    bossDown: false,
    missionMarker: null,
    nearCar: null,
    cameraSnap: false,
    view: renderer.view,
  };
  return state;
}

const state = createState();

// One fixed step of the whole world. `drive` is the staged-scene autopilot:
// when set, the player's car is driven forward instead of reading the keyboard.
state.stepWorld = function stepWorld(dt, drive) {
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + dt / 240) % 1; // a full day in 4 minutes
  if (state.fireTimer > 0) state.fireTimer -= dt;
  if (drive && state.player.car) {
    const fakeInput = { moveX: () => 0, moveY: () => -1, running: () => false };
    drivePlayerCar(state, dt, fakeInput);
  }
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePolice(state, dt);
  updateThugs(state, dt);
  updateBullets(state, dt);
  updateMissions(state, dt);
  state.particles.update(dt);
  // The golden marker on the map and in the world.
  const m = currentMission(state.missions);
  const s = currentStep(state.missions);
  if (m && s && state.missions.active) {
    state.missionMarker = { x: s.x, y: s.y, label: s.label || m.title };
  } else if (m && !state.missions.active) {
    state.missionMarker = { x: city.landmarks.garage.x, y: city.landmarks.garage.y, label: "Mara's Garage" };
  } else {
    state.missionMarker = null;
  }
  if (state.busted || state.wasted) {
    // handled by the screen machine in runGame
  }
};

function respawn(state) {
  const p = state.player;
  if (p.car) {
    p.car.kind = 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.inCar = false;
  p.x = 1125;
  p.y = 750;
  p.health = PLAYER.health;
  p.ammo = Math.max(p.ammo, 12);
  state.wanted = 0;
  state.wantedHeat = 0;
  state.police.cars.length = 0;
  state.thugs.length = 0;
  state.busted = false;
  state.wasted = false;
  state.cameraSnap = true;
  state.audio.engineOff();
}

function runShot(name) {
  const screen = stageShot(state, name);
  state.cameraSnap = true;
  renderer.updateCamera(state, 1);
  let painted = 0;
  function paint() {
    renderer.draw(state, screen);
    if (screen === SCREEN_TITLE) hud.drawTitle(state, state.missions.done.length);
    else hud.drawHud(state, renderer.view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function applySave(save) {
    state.player.money = save.money;
    state.player.health = save.health;
    state.player.ammo = save.ammo;
    state.missions.done = save.done.slice();
    state.missions.index = save.missionIndex;
    state.player.x = save.x;
    state.player.y = save.y;
    state.timeOfDay = save.timeOfDay || 0.55;
    state.kills = save.kills || 0;
    state.carsStolen = save.carsStolen || 0;
  }

  function startGame(continueSaved) {
    const save = continueSaved ? loadSave() : null;
    if (save) applySave(save);
    audio.unlock();
    audio.startMusic();
    screen = SCREEN_PLAY;
    announce(`Playing in Solmar Bay. ${state.missions.done.length} missions done.`);
  }

  function pauseGame() {
    screen = SCREEN_PAUSED;
    writeSave(state);
    announce('Paused. Progress saved.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        respawn(state);
        screen = SCREEN_PLAY;
        announce('Back on the streets of Solmar Bay.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      pauseGame();
      return;
    }
    if (actions & ACTION_ENTER) tryEnterExitCar(state);
    if (actions & ACTION_PUNCH) punch(state);
    if (actions & ACTION_INTERACT) {
      if (startMission(state)) announce(`Mission started: ${currentMission(state.missions).title}`);
    }
  }

  function step() {
    const mouse = input.mouse();
    const mouseWorld = renderer.screenToWorld(mouse.x, mouse.y);
    if (state.player.inCar) {
      drivePlayerCar(state, STEP, input);
    } else {
      updatePlayerOnFoot(state, STEP, input, mouseWorld);
      if (mouse.down) shootAt(state, mouseWorld);
    }
    state.nearCar = state.player.inCar ? null : nearestStealableCar(state);
    state.stepWorld(STEP, false);
    if (state.busted) {
      state.player.money = Math.max(0, state.player.money - 300);
      state.audio.busted();
      writeSave(state);
      screen = SCREEN_BUSTED;
      announce('Busted! The police took $300 and dropped you at the garage.');
    } else if (state.wasted) {
      state.player.money = Math.max(0, Math.floor(state.player.money / 2));
      state.audio.busted();
      writeSave(state);
      screen = SCREEN_WASTED;
      announce('Wasted! You woke up at the garage with half your cash gone.');
    } else if (state.missions.index >= 6) {
      state.audio.mission();
      writeSave(state);
      screen = SCREEN_WIN;
      announce('You are the king of Solmar Bay.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
      // The title screen still shows the living city behind it.
      if (screen === SCREEN_TITLE) {
        state.time += STEP;
        updateTraffic(state, STEP);
        updatePedestrians(state, STEP);
        state.particles.update(STEP);
      }
    }
    if (state.cameraSnap) {
      renderer.updateCamera(state, 1);
      state.cameraSnap = false;
    } else {
      renderer.updateCamera(state, 1 / 60);
    }
    renderer.draw(state, screen);
    if (screen === SCREEN_TITLE) hud.drawTitle(state, state.missions.done.length);
    else if (screen === SCREEN_PAUSED) {
      hud.drawHud(state, renderer.view);
      hud.drawPanel('Paused', ['Your progress is saved.', `Money $${state.player.money.toLocaleString()} · Missions ${state.missions.done.length}/6`], 'Press P or click to resume');
    } else if (screen === SCREEN_BUSTED) {
      hud.drawHud(state, renderer.view);
      hud.drawPanel('BUSTED', ['The Solmar Bay police caught you.', 'They took $300 of your cash.'], 'Press Space to get back out there');
    } else if (screen === SCREEN_WASTED) {
      hud.drawHud(state, renderer.view);
      hud.drawPanel('WASTED', ['You got taken down on the streets.', 'You woke up at the garage, half your cash gone.'], 'Press Space to get back out there');
    } else if (screen === SCREEN_WIN) {
      hud.drawHud(state, renderer.view);
      hud.drawPanel('KING OF SOLMAR BAY', ['The debt is paid. Voss is finished.', `You finished with $${state.player.money.toLocaleString()} and ${state.kills} takedowns.`], 'Press Space to keep playing the city');
    } else {
      hud.drawHud(state, renderer.view);
    }
  }

  // Continue with C on the title screen; Space starts a new game.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && loadSave()) startGame(true);
  });
  canvas.addEventListener('pointerdown', () => {
    if (screen === SCREEN_TITLE && loadSave()) {
      // A click on the title starts a new game; C continues a saved one.
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) pauseGame();
  });

  announce('Solmar Bay. Press Space or click to start. Press C to continue a saved game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
