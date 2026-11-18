// The HUD and the menus, drawn on the canvas: health and money, the wanted
// stars, the speedometer, the mission objective, the minimap in the corner, the
// dialogue box, the start screen, the pause menu and the busted/wasted screens.
// The minimap shows the roads, the player, the police, the mission marker and
// the garage, so the player can always find the next job.

import { CITY_NAME, FONT, PALETTE, STORY, WORLD } from './config.js';
import { currentMission, missionObjective } from './missions.js';
import { hasSave } from './save.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

const MINIMAP = { x: 16, y: 16, w: 210, h: 150 };

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function font(size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align = 'left', bold = false) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
  }

  function drawStars(state, x, y) {
    for (let i = 0; i < 5; i += 1) {
      ctx.font = font(26, true);
      ctx.fillStyle = i < state.wanted ? PALETTE.wantedStar : 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'left';
      ctx.fillText('★', x + i * 28, y);
    }
  }

  function drawMinimap(state, view) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    panel(x - 6, y - 6, w + 12, h + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#2c4a3a';
    ctx.fillRect(x, y, w, h);
    // Beach and sea.
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(x, y + WORLD.beachY * sy, w, h - WORLD.beachY * sy);
    ctx.fillStyle = '#3fa7c4';
    ctx.fillRect(x, y + (WORLD.beachY + 160) * sy, w, 30);
    // Roads.
    ctx.strokeStyle = '#5a606c';
    ctx.lineWidth = 3;
    for (const rx of state.city.roadsX) {
      ctx.beginPath();
      ctx.moveTo(x + rx * sx, y);
      ctx.lineTo(x + rx * sx, y + WORLD.beachY * sy);
      ctx.stroke();
    }
    for (const ry of state.city.roadsY) {
      ctx.beginPath();
      ctx.moveTo(x, y + ry * sy);
      ctx.lineTo(x + WORLD.width * sx, y + ry * sy);
      ctx.stroke();
    }
    // Mission marker.
    const marker = state.missionMarker;
    if (marker) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(x + marker.x * sx, y + marker.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(x + marker.x * sx, y + marker.y * sy, 10 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Police blips.
    for (const cop of state.police.cars) {
      ctx.fillStyle = '#4f8ef7';
      ctx.beginPath();
      ctx.arc(x + cop.x * sx, y + cop.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player, always centred in the blip's white ring.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + state.player.x * sx, y + state.player.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2725b';
    ctx.beginPath();
    ctx.arc(x + state.player.x * sx, y + state.player.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text(state.player.district || 'Solmar Bay', x, y + h + 22, 14, PALETTE.text, 'left', true);
  }

  function drawHud(state, view) {
    const W = view.w;
    const H = view.h;
    drawMinimap(state, view);
    // Top centre: wanted stars.
    drawStars(state, W / 2 - 70, 44);
    // Top right: money, health, ammo.
    panel(W - 240, 10, 228, 108);
    text(`$${state.player.money.toLocaleString()}`, W - 24, 40, 24, '#7de07d', 'right', true);
    text('HEALTH', W - 226, 66, 13, PALETTE.muted, 'left', true);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(W - 226, 72, 200, 12);
    ctx.fillStyle = state.player.health > 30 ? '#7de07d' : '#f74f4f';
    ctx.fillRect(W - 226, 72, 200 * Math.max(0, state.player.health / 100), 12);
    text(`AMMO ${state.player.ammo}`, W - 24, 106, 15, '#f2c94c', 'right', true);
    // Bottom left: mission objective, panel sized to the text.
    const objective = missionObjective(state.missions);
    ctx.font = font(17, true);
    const objW = Math.min(860, ctx.measureText(objective).width + 32);
    panel(16, H - 92, objW, 76);
    text('MISSION', 30, H - 66, 13, PALETTE.hudAccent, 'left', true);
    text(objective, 30, H - 38, 17, PALETTE.text, 'left', true);
    // Bottom right: speed when driving, controls on foot.
    if (state.player.inCar && state.player.car) {
      const mph = Math.round(Math.abs(state.player.car.speed) * 0.14);
      panel(W - 190, H - 92, 174, 76);
      text(state.player.car.model, W - 174, H - 72, 13, PALETTE.hudAccent, 'left', true);
      text(`${mph}`, W - 30, H - 34, 34, PALETTE.text, 'right', true);
      text('MPH', W - 92, H - 34, 14, PALETTE.muted, 'right', true);
    } else {
      text('WASD move · Shift run · E enter car · F punch · Click shoot · M mission · P pause', W - 16, H - 16, 13, 'rgba(245,241,230,0.75)', 'right');
    }
    // Dialogue box.
    if (state.missions.dialogueTimer > 0 && state.missions.dialogue) {
      const lines = wrapText(state.missions.dialogue, 78);
      panel(16, 212, 620, 30 + lines.length * 22);
      lines.forEach((line, i) => text(line, 30, 238 + i * 22, 16, PALETTE.text));
    }
    // Banner (mission title / complete).
    if (state.missions.bannerTimer > 0 && state.missions.banner) {
      ctx.font = font(30, true);
      ctx.fillStyle = 'rgba(12,16,24,0.6)';
      const bw = ctx.measureText(state.missions.banner).width + 48;
      ctx.beginPath();
      ctx.roundRect(W / 2 - bw / 2, 120, bw, 52, 10);
      ctx.fill();
      text(state.missions.banner, W / 2, 156, 30, PALETTE.hudAccent, 'center', true);
    }
    // "Press E" prompt near a car.
    if (state.nearCar && !state.player.inCar) {
      text(`Press E — ${state.nearCar.model}`, state.player.x - view.camX + 0, state.player.y - view.camY - 40, 15, '#ffffff', 'center', true);
    }
    // Arrest progress bar.
    if (state.police.arrestProgress > 0.2) {
      panel(W / 2 - 140, H - 180, 280, 44);
      text('THE POLICE ARE ARRESTING YOU — MOVE!', W / 2, H - 152, 16, '#ff8080', 'center', true);
    }
  }

  function wrapText(value, maxChars) {
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars) {
        lines.push(line.trim());
        line = word;
      } else line += ' ' + word;
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawTitle(state, best) {
    const W = state.view.w;
    const H = state.view.h;
    ctx.fillStyle = 'rgba(10,14,22,0.45)';
    ctx.fillRect(0, 0, W, H);
    text(CITY_NAME, W / 2, H / 2 - 90, 84, '#ffd94d', 'center', true);
    text('AN OPEN-WORLD CRIME STORY', W / 2, H / 2 - 48, 22, PALETTE.text, 'center', true);
    text(`Dario Cruz owes ${STORY.villain} $${STORY.debt.toLocaleString()}. Work the jobs. Pay the debt. Take the bay.`, W / 2, H / 2 - 8, 17, PALETTE.muted, 'center');
    const saved = hasSave();
    const lines = [
      saved ? 'CONTINUE — your story is saved (press C or click)' : '',
      'NEW GAME — press Space or click',
      '',
      'WASD move · Shift run · E steal / enter car · F punch · Mouse aim, click to shoot',
      'M start mission · P pause · Esc menu · drive, dodge the police, finish all 6 missions',
    ].filter((l) => l !== '');
    lines.forEach((line, i) => text(line, W / 2, H / 2 + 40 + i * 28, 18, i === 0 ? '#7de07d' : PALETTE.text, 'center', i <= 1));
    if (best > 0) text(`Missions done: ${best} / 6`, W / 2, H / 2 + 40 + lines.length * 28, 16, PALETTE.hudAccent, 'center');
  }

  function drawPanel(title, lines, prompt) {
    const W = state.view.w;
    const H = state.view.h;
    ctx.fillStyle = 'rgba(10,14,22,0.6)';
    ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 320, H / 2 - 140, 640, 280);
    text(title, W / 2, H / 2 - 80, 44, PALETTE.text, 'center', true);
    lines.forEach((line, i) => text(line, W / 2, H / 2 - 30 + i * 28, 18, PALETTE.muted, 'center'));
    text(prompt, W / 2, H / 2 + 100, 18, PALETTE.hudAccent, 'center', true);
  }

  return { ctx, text, panel, drawHud, drawTitle, drawPanel, drawMinimap, font };
}
