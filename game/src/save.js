// Save and continue: the player's money, health, ammo, completed missions and
// position are kept in localStorage, so quitting and coming back resumes the story.
// A save is written after every mission and whenever the player pauses.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number' || !Array.isArray(data.done)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      money: state.money,
      health: state.player.health,
      ammo: state.player.ammo,
      done: state.missions.done.slice(),
      missionIndex: state.missions.index,
      x: state.player.x,
      y: state.player.y,
      timeOfDay: state.timeOfDay,
      kills: state.kills,
      carsStolen: state.carsStolen,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: the game still plays, it just cannot keep a save.
  }
}

export function hasSave() {
  return loadSave() !== null;
}
