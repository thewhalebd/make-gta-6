// Drawing only: the camera, the city, the sea and the beach, the cars and the
// people, the particles and the markers. The camera follows the player smoothly
// and the world is drawn top-down with a little height — building roofs sit
// above their walls, so the city reads as a place, not a flat map.

import { FONT, PALETTE, WORLD } from './config.js';
import { clamp, lerp } from './random.js';
import { daylightTint } from './city.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, scale: 1, camX: 0, camY: 0, zoom: 1 };
  const fonts = new Map();
  function font(size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * ratio);
    canvas.height = Math.round(view.h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.zoom = clamp(Math.min(view.w / 1100, view.h / 760), 0.75, 1.15);
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCamera(state, dt) {
    const p = state.player;
    const tx = clamp(p.x - view.w / 2 / view.zoom, 0, WORLD.width - view.w / view.zoom);
    const ty = clamp(p.y - view.h / 2 / view.zoom, 0, WORLD.height - view.h / view.zoom);
    const k = 1 - Math.pow(0.001, dt);
    view.camX = lerp(view.camX, tx, k);
    view.camY = lerp(view.camY, ty, k);
  }

  function screenToWorld(sx, sy) {
    return { x: view.camX + sx / view.zoom, y: view.camY + sy / view.zoom };
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-26 + 4, -13 + 5, 52, 26);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-26, -13, 52, 26, 7);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 18, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(8, -10, 4, 20);
    // Headlights.
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(24, -10, 3, 5);
    ctx.fillRect(24, 5, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#1c2a44';
      ctx.font = font(9, true);
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 4);
      const flash = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      ctx.beginPath();
      ctx.arc(-2, -8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      ctx.beginPath();
      ctx.arc(-2, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.taxi) {
      ctx.fillStyle = '#1c1c22';
      ctx.font = font(8, true);
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 4);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-29, -16, 58, 32, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(13, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorld(state) {
    const city = state.city;
    const tint = daylightTint(state.timeOfDay);
    const x0 = view.camX - 60;
    const y0 = view.camY - 60;
    const x1 = view.camX + view.w / view.zoom + 60;
    const y1 = view.camY + view.h / view.zoom + 60;

    // Ground: grass, then sand, then the sea.
    ctx.fillStyle = '#8fb573';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, Math.max(y0, WORLD.beachY), x1 - x0, y1 - Math.max(y0, WORLD.beachY));
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, Math.max(y0, WORLD.beachY + 180), x1 - x0, y1 - Math.max(y0, WORLD.beachY + 180));
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
      ctx.fillRect(x, WORLD.beachY + 210 + Math.sin(state.time * 0.7 + x * 0.05) * 6, 46, 4);
    }

    // Parks.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = '#5d9e52';
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }

    // Sidewalks and roads.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2 - 10, 0, WORLD.roadWidth + 20, WORLD.beachY);
    for (const ry of city.roadsY) ctx.fillRect(0, ry - WORLD.roadWidth / 2 - 10, WORLD.width, WORLD.roadWidth + 20);
    ctx.fillStyle = PALETTE.road;
    for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.beachY);
    for (const ry of city.roadsY) ctx.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of city.roadsX) {
      for (let y = Math.floor(y0 / 60) * 60; y < Math.min(y1, WORLD.beachY); y += 60) ctx.fillRect(rx - 2, y, 4, 28);
    }
    for (const ry of city.roadsY) {
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) ctx.fillRect(x, ry - 2, 28, 4);
    }

    // Buildings: wall, then roof shifted up so the city has height.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      const h = 10 + b.height * 7;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h + 6);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - 3, b.y - h, b.w + 6, b.h + h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 3, b.y - h, b.w + 6, b.h + h);
      // Windows on the roof.
      ctx.fillStyle = 'rgba(255,240,200,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 52));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 10 + cx * ((b.w - 20) / cols), b.y - h + 10 + cy * ((b.h + h - 24) / rows), 14, 10);
        }
      }
    }

    // Palm trees on the beach and in the parks.
    for (const palm of city.palms) {
      if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4 * palm.s;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 4 * palm.s, palm.y - 16 * palm.s);
      ctx.stroke();
      ctx.fillStyle = '#3f8f4f';
      for (let f = 0; f < 5; f += 1) {
        const a = (f / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(palm.x + 4 * palm.s + Math.cos(a) * 12 * palm.s, palm.y - 16 * palm.s + Math.sin(a) * 8 * palm.s, 12 * palm.s, 4 * palm.s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Landmark markers: the garage, the hideout, the marina.
    drawLandmark(state, city.landmarks.garage, '#4f8ef7', '🔧');
    drawLandmark(state, city.landmarks.hideout, '#7de07d', '⌂');
    drawLandmark(state, city.landmarks.marina, '#3fa7c4', '⚓');

    // Pickups.
    for (const pickup of city.pickups) {
      if (pickup.taken) continue;
      if (pickup.x < x0 || pickup.x > x1 || pickup.y < y0 || pickup.y > y1) continue;
      const bob = Math.sin(state.time * 3 + pickup.x) * 3;
      ctx.fillStyle = pickup.kind === 'health' ? '#ff6b6b' : pickup.kind === 'ammo' ? '#f2c94c' : '#7de07d';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = font(14, true);
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'health' ? '+' : pickup.kind === 'ammo' ? 'A' : '$', pickup.x, pickup.y + bob + 5);
    }

    // Mission marker: a tall golden beam the player can see across the city.
    if (state.missionMarker) {
      const m = state.missionMarker;
      const pulse = 0.5 + Math.sin(state.time * 5) * 0.2;
      ctx.fillStyle = `rgba(255,217,77,${0.25 * pulse})`;
      ctx.fillRect(m.x - 14, m.y - 240, 28, 240);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1c22';
      ctx.font = font(13, true);
      ctx.textAlign = 'center';
      ctx.fillText('!', m.x, m.y + 5);
      ctx.fillStyle = '#ffd94d';
      ctx.font = font(15, true);
      ctx.fillText(m.label || 'OBJECTIVE', m.x, m.y - 250);
    }

    // Thugs and the boss, ringed in red so the player can spot the fight.
    for (const thug of state.thugs) {
      if (thug.hp <= 0) continue;
      ctx.strokeStyle = thug.boss ? '#ffd94d' : '#f74f4f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(thug.x, thug.y, 17, 0, Math.PI * 2);
      ctx.stroke();
      drawPerson(thug.x, thug.y, thug.angle, thug.boss ? '#1c1c22' : '#5c2e2e', '#d9a06b', false);
      ctx.fillStyle = '#f74f4f';
      ctx.fillRect(thug.x - 16, thug.y - 26, 32, 5);
      ctx.fillStyle = '#7de07d';
      ctx.fillRect(thug.x - 16, thug.y - 26, 32 * (thug.hp / (thug.boss ? 220 : 60)), 5);
      if (thug.boss) {
        ctx.fillStyle = '#ffd94d';
        ctx.font = font(13, true);
        ctx.textAlign = 'center';
        ctx.fillText('CASSIAN VOSS', thug.x, thug.y - 32);
      }
    }

    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.state === 'down');
    }

    // Cars: parked and traffic, then police, then the player's car on top.
    for (const car of state.cars) drawCar(car, false);
    for (const cop of state.police.cars) drawCar(cop, false);
    if (state.player.car) drawCar(state.player.car, true);

    // The player on foot, ringed in gold so he is easy to find in a busy street.
    if (!state.player.inCar) {
      const p = state.player;
      ctx.strokeStyle = 'rgba(255,217,77,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.stroke();
      drawPerson(p.x, p.y, p.angle, '#e2725b', '#f2c9a0', false);
      // A pistol in hand when aiming.
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8);
      ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      ctx.stroke();
      // Direction arrow so the player reads where Dario faces.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bullets.
    for (const b of state.bullets) {
      if (!b.active) continue;
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Particles.
    for (const part of state.particles.pool) {
      if (!part.active) continue;
      const a = part.life / part.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating text.
    for (const t of state.particles.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.fillStyle = t.color;
      ctx.font = font(16, true);
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Golden-hour overlay and the day's tint.
    ctx.fillStyle = tint.overlay;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // A soft vignette so the frame reads as a sunny afternoon.
    const grad = ctx.createRadialGradient(view.camX + view.w / view.zoom / 2, view.camY + view.h / view.zoom / 2, 300, view.camX + view.w / view.zoom / 2, view.camY + view.h / view.zoom / 2, 900);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(20,10,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  function drawLandmark(state, landmark, color, glyph) {
    const x = landmark.x;
    const y = landmark.y;
    if (x < view.camX - 80 || x > view.camX + view.w / view.zoom + 80 || y < view.camY - 80 || y > view.camY + view.h / view.zoom + 80) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = font(14, true);
    ctx.textAlign = 'center';
    ctx.fillText(glyph, x, y + 5);
    ctx.fillStyle = color;
    ctx.font = font(12, true);
    ctx.fillText(landmark.label, x, y + 34);
  }

  function draw(state, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.save();
    ctx.translate(-view.camX * view.zoom, -view.camY * view.zoom);
    ctx.scale(view.zoom, view.zoom);
    drawWorld(state);
    ctx.restore();
    return view;
  }

  return { draw, updateCamera, screenToWorld, view, ctx };
}
