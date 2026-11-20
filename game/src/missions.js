// Missions and the story: six jobs from Mara Solis and Tito Reyes that pay
// down Dario's $50,000 debt to Cassian Voss. Each mission is a list of steps
// — go to a place, steal a car, deliver it, defeat thugs, escape the police,
// face the boss. Completing a step advances the story, pays cash and saves
// the game. The 3D rebuild keeps all six missions and their rules; only the
// golden marker is now a tall beam in the 3D world instead of a painted
// stripe on a flat map.

import { MISSIONS, STORY } from './config.js';
import { dist } from './random.js';
import { spawnThug } from './combat.js';
import { clearPolice } from './police.js';
import { writeSave } from './save.js';

export function createMissions() {
  return {
    index: 0,
    step: 0,
    active: false,
    done: [],
    banner: '',
    bannerTimer: 0,
    dialogue: '',
    dialogueTimer: 0,
    spawned: false,
    startKills: 0,
    defeated: 0,
    escapeTimer: 0,
    targetCar: null,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] || null;
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function missionObjective(missions) {
  const m = currentMission(missions);
  if (!m) return 'Story complete — Solmar Bay is yours, Dario.';
  if (!missions.active) return `Talk to ${m.giver} — press M to start: ${m.title}`;
  const s = currentStep(missions);
  if (!s) return m.objective;
  if (s.kind === 'defeat') return `${m.objective} (${missions.defeated || 0}/${s.count})`;
  return m.objective;
}

// How much of the debt is still owed, from the missions already finished.
function debtLeft(missions) {
  const paid = missions.done.reduce((sum, id) => {
    const found = MISSIONS.find((x) => x.id === id);
    return sum + (found ? found.pay : 0);
  }, 0);
  return Math.max(0, STORY.debt - paid);
}

export function startMission(state) {
  const missions = state.missions;
  const m = currentMission(missions);
  if (!m || missions.active) return false;
  missions.active = true;
  missions.step = 0;
  missions.spawned = false;
  missions.startKills = state.kills;
  missions.defeated = 0;
  missions.escapeTimer = 0;
  missions.dialogue = m.intro;
  missions.dialogueTimer = 7;
  missions.banner = m.title;
  missions.bannerTimer = 3;
  state.audio.mission();
  // The getaway mission starts with the cops already on the player.
  if (m.id === 'getaway') {
    state.wanted = 3;
    state.wantedHeat = 3;
    state.lastCrimeTime = state.time;
  }
  if (m.id === 'payback') {
    spawnThug(state, 1520, 640);
    spawnThug(state, 1630, 700);
    spawnThug(state, 1575, 740);
  }
  if (m.id === 'king') {
    spawnThug(state, 430, 1980, true);
    spawnThug(state, 500, 2060);
    spawnThug(state, 380, 2060);
  }
  return true;
}

function completeMission(state) {
  const missions = state.missions;
  const m = currentMission(missions);
  state.player.money += m.pay;
  state.player.health = 100;
  missions.done.push(m.id);
  missions.active = false;
  missions.index += 1;
  missions.banner = `MISSION COMPLETE — +$${m.pay}`;
  missions.bannerTimer = 3.5;
  if (m.id === 'king') {
    missions.dialogue = 'Mara: "It\'s over. Voss is done, the debt is gone. Solmar Bay is yours now, Dario — king of the bay."';
  } else {
    missions.dialogue = `Mara: "Good work. Debt left: $${debtLeft(missions).toLocaleString()}."`;
  }
  missions.dialogueTimer = 6;
  state.audio.cash();
  state.audio.mission();
  if (m.id === 'getaway') clearPolice(state);
  writeSave(state);
}

function advanceStep(state) {
  const missions = state.missions;
  const m = currentMission(missions);
  missions.step += 1;
  if (missions.step >= m.steps.length) {
    completeMission(state);
  } else {
    missions.banner = 'Next objective';
    missions.bannerTimer = 1.6;
  }
}

export function updateMissions(state, dt) {
  const missions = state.missions;
  if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
  if (missions.dialogueTimer > 0) missions.dialogueTimer -= dt;
  if (!missions.active) return;
  const m = currentMission(missions);
  const s = currentStep(missions);
  if (!m || !s) return;
  const p = state.player;

  if (s.kind === 'goto') {
    const arrived = dist(p.x, p.y, s.x, s.y) < 70 && (!s.inCar || p.inCar);
    if (arrived) advanceStep(state);
  } else if (s.kind === 'steal') {
    // The target car is the parked Marina Coupe on the beach.
    if (!missions.targetCar) {
      missions.targetCar = state.cars.find((c) => c.model === s.model && Math.abs(c.x - s.x) < 80 && Math.abs(c.y - s.y) < 80) || null;
    }
    if (missions.targetCar && p.car === missions.targetCar) advanceStep(state);
  } else if (s.kind === 'defeat') {
    missions.defeated = state.kills - missions.startKills;
    if (missions.defeated >= s.count) advanceStep(state);
  } else if (s.kind === 'escape') {
    const atHideout = dist(p.x, p.y, s.x, s.y) < 90;
    if (atHideout && state.wanted === 0) {
      advanceStep(state);
    } else if (atHideout && state.wanted > 0) {
      missions.escapeTimer += dt;
      if (missions.escapeTimer > 4) {
        // Hiding in the hills long enough shakes the heat.
        clearPolice(state);
        missions.escapeTimer = 0;
      }
    } else {
      missions.escapeTimer = 0;
    }
  } else if (s.kind === 'boss') {
    if (state.bossDown) advanceStep(state);
  }
}
