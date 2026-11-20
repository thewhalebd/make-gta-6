// Solmar Bay in 3D — the raw-WebGL renderer. No library, no CDN, no assets:
// one WebGL1 shader program (per-vertex colour, lambert sun, distance fog),
// the city baked once into a static buffer, and the cars, people, bullets and
// particles rebuilt each frame into a dynamic buffer. The world model is the
// same 2D top-down one the rest of the game uses: world (x, y) becomes 3D
// (x, 0, y), so a 2D angle a becomes the 3D direction (cos a, 0, sin a).
// A chase camera follows the player or the car, looking slightly ahead.
// The HUD is drawn on a separate 2D canvas by hud.js; this file only owns
// the world. It keeps the old renderer's interface: createRenderer(canvas)
// returns { draw(state, screen), updateCamera(state, dt), screenToWorld(sx, sy), view }.

import { CAMERA, PALETTE, WORLD } from './config.js';
import { angleLerp, clamp, hash2, lerp } from './random.js';
import { buildingHeight3D, buildingShade, daylightTint } from './city.js';

function hexRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function shade(hex, f) {
  const c = hexRgb(hex);
  return [c[0] * f, c[1] * f, c[2] * f];
}

function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// --- tiny mat4 helpers (column-major, as WebGL wants) -----------------------
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function lookAt(eye, center, up) {
  const z = norm3([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
  const x = norm3(cross3(up, z));
  const y = cross3(z, x);
  const out = new Float32Array(16);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  out[15] = 1;
  return out;
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

// --- geometry builder ------------------------------------------------------
// One vertex is 9 floats: position, normal, colour. Culling is off, so winding
// never matters; boxes skip their bottom face, which no camera ever sees.
function makeGeom(capacity) {
  const data = new Float32Array(capacity * 9);
  let count = 0;
  function push(x, y, z, nx, ny, nz, r, g, b) {
    if (count >= capacity) return;
    const o = count * 9;
    data[o] = x; data[o + 1] = y; data[o + 2] = z;
    data[o + 3] = nx; data[o + 4] = ny; data[o + 5] = nz;
    data[o + 6] = r; data[o + 7] = g; data[o + 8] = b;
    count += 1;
  }
  function tri(a, b, c, n, col) {
    push(a[0], a[1], a[2], n[0], n[1], n[2], col[0], col[1], col[2]);
    push(b[0], b[1], b[2], n[0], n[1], n[2], col[0], col[1], col[2]);
    push(c[0], c[1], c[2], n[0], n[1], n[2], col[0], col[1], col[2]);
  }
  function quad(p0, p1, p2, p3, n, col) {
    tri(p0, p1, p2, n, col);
    tri(p0, p2, p3, n, col);
  }
  // Rotate a flat (x, z) offset by rotY about the Y axis. A box's local +X
  // ends up pointing along (cos rotY, 0, -sin rotY), so to face a world
  // angle a, callers pass rotY = -a.
  function rot(x, z, c, s) {
    return [x * c + z * s, -x * s + z * c];
  }
  function box(cx, baseY, cz, sx, sy, sz, topCol, sideCol, rotY = 0) {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const hx = sx / 2;
    const hz = sz / 2;
    const corner = (lx, lz) => {
      const r = rot(lx, lz, c, s);
      return [cx + r[0], cz + r[1]];
    };
    const p00 = corner(-hx, -hz);
    const p10 = corner(hx, -hz);
    const p11 = corner(hx, hz);
    const p01 = corner(-hx, hz);
    const y0 = baseY;
    const y1 = baseY + sy;
    quad([p00[0], y1, p00[1]], [p10[0], y1, p10[1]], [p11[0], y1, p11[1]], [p01[0], y1, p01[1]], [0, 1, 0], topCol);
    const faces = [
      { a: p00, b: p10, n: [0, 0, -1] },
      { a: p10, b: p11, n: [1, 0, 0] },
      { a: p11, b: p01, n: [0, 0, 1] },
      { a: p01, b: p00, n: [-1, 0, 0] },
    ];
    for (const f of faces) {
      const rn = rot(f.n[0], f.n[2], c, s);
      quad([f.a[0], y0, f.a[1]], [f.b[0], y0, f.b[1]], [f.b[0], y1, f.b[1]], [f.a[0], y1, f.a[1]], [rn[0], 0, rn[1]], sideCol);
    }
  }
  function flatQuad(x0, z0, x1, z1, y, col) {
    quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], col);
  }
  // A hollow vertical tube: the mission marker beam and landmark beacons.
  function cylinder(cx, cz, r, y0, y1, col, segments = 8) {
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const n = [Math.cos(am), 0, Math.sin(am)];
      quad(
        [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r],
        [cx + Math.cos(a1) * r, y1, cz + Math.sin(a1) * r],
        [cx + Math.cos(a0) * r, y1, cz + Math.sin(a0) * r],
        n, col,
      );
    }
  }
  return {
    data,
    get count() { return count; },
    reset() { count = 0; },
    tri, quad, box, flatQuad, cylinder,
  };
}

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uMVP;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vColor;
varying float vFog;
void main() {
  vec3 n = normalize(aNormal);
  float diff = max(dot(n, uSunDir), 0.0);
  vColor = aColor * (uAmbient + uSunColor * diff);
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  float d = distance(aPos, uCamPos);
  vFog = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vFog;
uniform vec3 uFogColor;
uniform float uAlpha;
void main() {
  vec3 c = mix(vColor, uFogColor, vFog);
  gl_FragColor = vec4(c, uAlpha);
}
`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('Solmar Bay needs WebGL, and this browser did not offer one.');

  const view = {
    w: 1280, h: 720,
    camX: 1125, camY: 750,
    camHeading: 0,
    eye: [1125 - CAMERA.distance, CAMERA.height, 750],
    target: [1125 + CAMERA.lookAhead, 12, 750],
    px: 1125, py: 750,
    stillTime: 0,
    forward: [1, 0, 0], right: [0, 0, 1], up: [0, 1, 0],
    aspect: 1280 / 720,
    tanHalf: Math.tan(((CAMERA.fov * Math.PI) / 180) / 2),
    mvp: null,
    project: null,
  };

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Solmar Bay shader failed:', gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const loc = {
    mvp: gl.getUniformLocation(prog, 'uMVP'),
    camPos: gl.getUniformLocation(prog, 'uCamPos'),
    sunDir: gl.getUniformLocation(prog, 'uSunDir'),
    sunColor: gl.getUniformLocation(prog, 'uSunColor'),
    ambient: gl.getUniformLocation(prog, 'uAmbient'),
    fogNear: gl.getUniformLocation(prog, 'uFogNear'),
    fogFar: gl.getUniformLocation(prog, 'uFogFar'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    alpha: gl.getUniformLocation(prog, 'uAlpha'),
  };
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aNormal = gl.getAttribLocation(prog, 'aNormal');
  const aColor = gl.getAttribLocation(prog, 'aColor');

  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * ratio);
    canvas.height = Math.round(view.h * ratio);
    view.aspect = view.w / view.h;
  }
  window.addEventListener('resize', resize);
  resize();

  function bindGeom(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 36, 24);
  }

  // --- the static city, baked once -----------------------------------------
  function buildStatic(city) {
    const g = makeGeom(34000);
    const grass = hexRgb(PALETTE.grass);
    const road = hexRgb(PALETTE.road);
    const walk = hexRgb(PALETTE.sidewalk);
    const dash = hexRgb(PALETTE.roadLine);
    // Ground: grass everywhere, so the camera never sees a void at the edges.
    g.flatQuad(-900, -900, WORLD.width + 900, WORLD.height + 1900, 0, grass);
    // Dry-grass patches, so the ground is not one flat green.
    for (let i = 0; i < 48; i += 1) {
      const x = hash2(i, 7) * WORLD.width;
      const z = hash2(i, 13) * WORLD.beachY;
      const s = 120 + hash2(i, 29) * 260;
      g.flatQuad(x, z, x + s, z + s * 0.7, 0.1, shade(hash2(i, 3) > 0.5 ? PALETTE.grassDry : PALETTE.grass, 0.92 + hash2(i, 5) * 0.14));
    }
    // Sand, then the sea stretching to the horizon.
    g.flatQuad(-900, WORLD.beachY, WORLD.width + 900, WORLD.beachY + 180, 0.3, hexRgb(PALETTE.sand));
    g.flatQuad(-900, WORLD.beachY + 150, WORLD.width + 900, WORLD.beachY + 185, 0.35, shade(PALETTE.sand, 0.85));
    g.flatQuad(-900, WORLD.beachY + 180, WORLD.width + 900, WORLD.height + 1900, 0.2, hexRgb(PALETTE.sea));
    // Parks.
    for (const park of city.parks) {
      g.flatQuad(park.x, park.y, park.x + park.w, park.y + park.h, 0.35, hexRgb(PALETTE.park));
    }
    // Sidewalks, roads, centre dashes.
    for (const rx of city.roadsX) g.flatQuad(rx - WORLD.roadWidth / 2 - 10, 0, rx + WORLD.roadWidth / 2 + 10, WORLD.beachY, 0.4, walk);
    for (const ry of city.roadsY) g.flatQuad(0, ry - WORLD.roadWidth / 2 - 10, WORLD.width, ry + WORLD.roadWidth / 2 + 10, 0.4, walk);
    for (const rx of city.roadsX) g.flatQuad(rx - WORLD.roadWidth / 2, 0, rx + WORLD.roadWidth / 2, WORLD.beachY, 0.5, road);
    for (const ry of city.roadsY) g.flatQuad(0, ry - WORLD.roadWidth / 2, WORLD.width, ry + WORLD.roadWidth / 2, 0.5, road);
    for (const rx of city.roadsX) {
      for (let y = 30; y < WORLD.beachY; y += 60) g.flatQuad(rx - 2, y, rx + 2, y + 28, 0.7, dash);
    }
    for (const ry of city.roadsY) {
      for (let x = 30; x < WORLD.width; x += 60) g.flatQuad(x, ry - 2, x + 28, ry + 2, 0.7, dash);
    }
    // Buildings: a dark base, walls, a coloured roof, and a rooftop box on
    // some of them so the skyline is not a row of flat slabs.
    for (const b of city.buildings) {
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      const h = buildingHeight3D(b);
      const wall = hexRgb(b.wall);
      const roof = hexRgb(b.roof);
      g.box(cx, 0, cz, b.w + 6, 8, b.h + 6, shade(b.wall, 0.6), shade(b.wall, 0.6));
      g.box(cx, 0, cz, b.w, h, b.h, roof, wall);
      const s = buildingShade(b);
      if (s > 0.55) {
        g.box(cx + (s - 0.5) * 60, h, cz + (hash2(Math.round(b.x), 3) - 0.5) * 40, 34, 12, 30, shade('#9aa0a8', 0.9), shade('#7a8088', 0.9));
      }
      // A bright roof rim, so the roof reads from the chase camera.
      g.box(cx, h - 2, cz, b.w + 4, 2, b.h + 4, mixRgb(roof, [1, 1, 1], 0.25), roof);
      // Windows on the south and east walls, so the flat walls break up into
      // a city when the chase camera presses against them. A few windows are
      // lit warm; the rest are dark glass.
      const cols = Math.max(1, Math.floor(b.w / 60));
      const rows = Math.max(1, Math.floor(h / 55));
      for (let wi = 0; wi < cols; wi += 1) {
        for (let wj = 0; wj < rows; wj += 1) {
          const lit = hash2(Math.round(b.x) + wi * 7, Math.round(b.y) + wj * 13) > 0.7;
          const winCol = lit ? hexRgb('#ffd98a') : hexRgb('#33414f');
          const wx = b.x + 24 + wi * ((b.w - 48) / cols);
          const wy = 26 + wj * ((h - 40) / rows);
          // South face.
          g.quad([wx, wy, cz + b.h / 2 + 0.6], [wx + 15, wy, cz + b.h / 2 + 0.6], [wx + 15, wy + 11, cz + b.h / 2 + 0.6], [wx, wy + 11, cz + b.h / 2 + 0.6], [0, 0, 1], winCol);
          // East face.
          const ez = b.y + 24 + wi * ((b.h - 48) / cols);
          g.quad([cx + b.w / 2 + 0.6, wy, ez], [cx + b.w / 2 + 0.6, wy, ez + 15], [cx + b.w / 2 + 0.6, wy + 11, ez + 15], [cx + b.w / 2 + 0.6, wy + 11, ez], [1, 0, 0], winCol);
        }
      }
    }
    // Palm trees: a trunk and two crossed canopy slabs.
    for (const palm of city.palms) {
      const s = palm.s;
      const top = 42 * s;
      g.box(palm.x, 0, palm.y, 5 * s, top, 5 * s, hexRgb('#8a6a42'), hexRgb('#7a5a34'));
      g.box(palm.x, top - 4, palm.y, 46 * s, 8, 46 * s, hexRgb('#3f8f4f'), hexRgb('#2f7a3f'));
      g.box(palm.x, top + 2, palm.y, 34 * s, 7, 34 * s, hexRgb('#4fae5f'), hexRgb('#3f8f4f'), Math.PI / 4);
    }
    // Street lamps along every intersection.
    for (const lamp of city.lamps) {
      g.box(lamp.x, 0, lamp.y, 3, 34, 3, hexRgb('#3a3f4a'), hexRgb('#2a2f3a'));
      g.box(lamp.x, 34, lamp.y, 12, 4, 7, hexRgb('#ffe9a0'), hexRgb('#e8d44d'));
    }
    return g;
  }

  // The static city is baked lazily from the live city on the first draw,
  // so the renderer never needs the city before main.js has built it.
  let staticBuf = null;
  let staticCount = 0;

  const dynGeom = makeGeom(24000);
  const dynBuf = gl.createBuffer();
  const transGeom = makeGeom(3000);
  const transBuf = gl.createBuffer();

  function drawCar3(g, car, isPlayer, time) {
    const a = car.angle;
    const rotY = -a;
    const bodyTop = mixRgb(hexRgb(car.color), [1, 1, 1], 0.3);
    const body = hexRgb(car.color);
    const glass = hexRgb('#1c2a44');
    // A gold pad under the player's car, so it is easy to find in traffic.
    if (isPlayer) g.box(car.x, 0.8, car.y, 60, 1.5, 34, hexRgb('#ffd94d'), hexRgb('#ffd94d'), rotY);
    g.box(car.x, 2, car.y, 52, 12, 26, bodyTop, body, rotY);
    const cx = car.x + Math.cos(a) * -4;
    const cz = car.y + Math.sin(a) * -4;
    g.box(cx, 14, cz, 22, 10, 20, glass, glass, rotY);
    const wheel = hexRgb('#1c1c22');
    for (const [lx, lz] of [[-16, -13], [-16, 13], [16, -13], [16, 13]]) {
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      g.box(car.x + lx * c + lz * s, 2, car.y + -lx * s + lz * c, 9, 6, 4, wheel, wheel, rotY);
    }
    if (car.kind === 'police') {
      const flash = Math.floor(time * 4) % 2 === 0;
      const bx = car.x + Math.cos(a) * -4;
      const bz = car.y + Math.sin(a) * -4;
      const side = 7;
      const lx = Math.cos(a + Math.PI / 2);
      const lz = Math.sin(a + Math.PI / 2);
      const red = flash ? hexRgb('#ff3b30') : hexRgb('#7a1010');
      const blue = flash ? hexRgb('#1c3a7a') : hexRgb('#3b82ff');
      g.box(bx + lx * side, 24, bz + lz * side, 9, 5, 7, red, red, rotY);
      g.box(bx - lx * side, 24, bz - lz * side, 9, 5, 7, blue, blue, rotY);
    }
    if (car.taxi) {
      const sx = car.x + Math.cos(a) * -4;
      const sz = car.y + Math.sin(a) * -4;
      g.box(sx, 24, sz, 12, 5, 8, hexRgb('#1c1c22'), hexRgb('#1c1c22'), rotY);
    }
  }

  function drawPerson3(g, x, y, angle, shirt, skin, down) {
    const shirtC = hexRgb(shirt);
    const skinC = hexRgb(skin);
    if (down) {
      g.box(x, 0, y, 26, 8, 12, shirtC, shirtC, -angle);
      g.box(x + Math.cos(angle) * 17, 0, y + Math.sin(angle) * 17, 9, 8, 9, skinC, skinC, -angle);
      return;
    }
    g.box(x, 0, y, 10, 24, 16, shirtC, shirtC, -angle);
    g.box(x, 24, y, 9, 9, 9, skinC, skinC, -angle);
  }

  function drawDynamic(state) {
    const g = dynGeom;
    g.reset();
    const time = state.time;
    // Pickups: spinning diamonds, bobbing above the ground.
    for (const pickup of state.city.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(time * 3 + pickup.x) * 3;
      const col = hexRgb(pickup.kind === 'health' ? '#ff6b6b' : pickup.kind === 'ammo' ? '#f2c94c' : '#7de07d');
      g.box(pickup.x, 12 + bob, pickup.y, 14, 14, 14, col, col, -time * 2);
      g.box(pickup.x, 0.9, pickup.y, 26, 1.5, 26, col, col);
    }
    // Thugs and the boss: a red ring on the ground, a health bar overhead.
    for (const thug of state.thugs) {
      if (thug.hp <= 0) continue;
      const ring = hexRgb(thug.boss ? '#ffd94d' : '#f74f4f');
      const r = thug.boss ? 26 : 20;
      g.box(thug.x - r, 0.9, thug.y, 2 * r, 1.5, 3, ring, ring);
      g.box(thug.x - r, 0.9, thug.y + r, 2 * r, 1.5, 3, ring, ring);
      g.box(thug.x - r, 0.9, thug.y - r, 3, 1.5, 2 * r, ring, ring);
      g.box(thug.x + r, 0.9, thug.y - r, 3, 1.5, 2 * r, ring, ring);
      drawPerson3(g, thug.x, thug.y, thug.angle, thug.boss ? '#1c1c22' : '#5c2e2e', '#d9a06b', false);
      const frac = clamp(thug.hp / (thug.boss ? 220 : 60), 0, 1);
      const dark = [0.15, 0.15, 0.15];
      g.box(thug.x, 46, thug.y, 36, 3, 2, dark, dark);
      if (frac > 0) g.box(thug.x - 18 * (1 - frac), 46, thug.y, 36 * frac, 3, 2, hexRgb('#7de07d'), hexRgb('#7de07d'));
    }
    // Pedestrians.
    for (const ped of state.peds) {
      drawPerson3(g, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.state === 'down');
    }
    // Cars: traffic and parked, then police, then the player's car on top.
    for (const car of state.cars) drawCar3(g, car, false, time);
    for (const cop of state.police.cars) drawCar3(g, cop, false, time);
    if (state.player.car) drawCar3(g, state.player.car, true, time);
    // The player on foot, ringed in gold, pistol in hand when aiming.
    if (!state.player.inCar) {
      const p = state.player;
      const ring = hexRgb('#ffd94d');
      const r = 19;
      g.box(p.x - r, 0.9, p.y, 2 * r, 1.5, 3, ring, ring);
      g.box(p.x - r, 0.9, p.y + r, 2 * r, 1.5, 3, ring, ring);
      g.box(p.x - r, 0.9, p.y - r, 3, 1.5, 2 * r, ring, ring);
      g.box(p.x + r, 0.9, p.y - r, 3, 1.5, 2 * r, ring, ring);
      drawPerson3(g, p.x, p.y, p.angle, '#e2725b', '#f2c9a0', false);
      // A small gold diamond floats above Dario's head, so the player is
      // easy to find in a busy street from the chase camera.
      const gold = hexRgb('#ffd94d');
      g.box(p.x, 48 + Math.sin(time * 3) * 3, p.y, 10, 10, 10, gold, gold, -time * 2);
      const gx = p.x + Math.cos(p.angle) * 15;
      const gy = p.y + Math.sin(p.angle) * 15;
      const dark = hexRgb('#2a2a2a');
      g.box(gx, 15, gy, 14, 3, 3, dark, dark, -p.angle);
    }
    // Bullets: small bright bars along their flight.
    for (const b of state.bullets) {
      if (!b.active) continue;
      const col = hexRgb('#ffe9a0');
      g.box(b.x, 4, b.y, 12, 3, 3, col, col, -Math.atan2(b.vy, b.vx));
    }
    // Particles: little boxes that shrink as they fade.
    let drawn = 0;
    for (const part of state.particles.pool) {
      if (!part.active) continue;
      if (drawn > 140) break;
      drawn += 1;
      const a = part.life / part.max;
      const col = hexRgb(part.color);
      const s = Math.max(1.5, part.size * (0.5 + a * 0.5));
      g.box(part.x, 2, part.y, s, s, s, col, col);
    }
  }

  function drawTransparent(state) {
    const g = transGeom;
    g.reset();
    const gold = hexRgb('#ffd94d');
    // Landmark beacons: the garage, the hideout and the marina.
    const beacons = [
      [state.city.landmarks.garage, '#4f8ef7'],
      [state.city.landmarks.hideout, '#7de07d'],
      [state.city.landmarks.marina, '#3fa7c4'],
    ];
    for (const [mark, color] of beacons) {
      g.cylinder(mark.x, mark.y, 9, 0, 150, hexRgb(color));
    }
    // The mission marker: a tall gold beam and a spinning diamond above it.
    if (state.missionMarker) {
      const m = state.missionMarker;
      const pulse = 0.75 + Math.sin(state.time * 5) * 0.25;
      g.cylinder(m.x, m.y, 15, 0, 280, [gold[0] * pulse, gold[1] * pulse, gold[2] * pulse]);
      g.box(m.x, 60 + Math.sin(state.time * 3) * 4, m.y, 18, 18, 18, gold, gold, -state.time * 2);
    }
  }

  function updateCamera(state, dt) {
    const p = state.player;
    let targetHeading;
    if (p.inCar && p.car) {
      targetHeading = p.car.angle;
    } else {
      const dx = p.x - view.px;
      const dy = p.y - view.py;
      if (Math.hypot(dx, dy) > 0.6) {
        // On foot the camera follows the direction Dario walks, never the
        // mouse-aim angle, or it would swing wildly while shooting.
        targetHeading = Math.atan2(dy, dx);
        view.stillTime = 0;
      } else {
        view.stillTime += dt;
        targetHeading = view.stillTime > 0.6 ? p.angle : view.camHeading;
      }
      view.px = p.x;
      view.py = p.y;
    }
    const speed = p.inCar && p.car ? Math.abs(p.car.speed) : 0;
    // A staged scene may ask for a wider shot (the plaza fight) by setting
    // state.cameraDistance / state.cameraHeight; the game itself never does.
    const baseDist = state.cameraDistance ?? CAMERA.distance;
    const baseHeight = state.cameraHeight ?? CAMERA.height;
    const dist = baseDist + speed * CAMERA.speedDistance;
    const height = baseHeight + speed * CAMERA.speedHeight;
    if (state.cameraSnap) {
      view.camHeading = targetHeading;
    } else {
      view.camHeading = angleLerp(view.camHeading, targetHeading, 1 - Math.pow(0.002, dt));
    }
    const h = view.camHeading;
    const fx = Math.cos(h);
    const fz = Math.sin(h);
    const tx = p.x;
    const tz = p.y;
    const ex = tx - fx * dist;
    const ez = tz - fz * dist;
    const ey = height;
    const lx = tx + fx * CAMERA.lookAhead;
    const lz = tz + fz * CAMERA.lookAhead;
    const ly = 12;
    if (state.cameraSnap) {
      view.eye = [ex, ey, ez];
      view.target = [lx, ly, lz];
    } else {
      const k = 1 - Math.pow(0.0005, dt);
      view.eye = [lerp(view.eye[0], ex, k), lerp(view.eye[1], ey, k), lerp(view.eye[2], ez, k)];
      view.target = [lerp(view.target[0], lx, k), lerp(view.target[1], ly, k), lerp(view.target[2], lz, k)];
    }
    view.camX = tx;
    view.camY = tz;
    const fwd = norm3([lx - view.eye[0], ly - view.eye[1], lz - view.eye[2]]);
    const right = norm3(cross3(fwd, [0, 1, 0]));
    const up = cross3(right, fwd);
    view.forward = fwd;
    view.right = right;
    view.up = up;
  }

  // Unproject a screen point through the camera and meet the ground plane:
  // the mouse aims at the street, not at the sky.
  function screenToWorld(sx, sy) {
    const nx = (sx / view.w) * 2 - 1;
    const ny = 1 - (sy / view.h) * 2;
    const t = view.tanHalf;
    const rx = view.right;
    const up = view.up;
    const fw = view.forward;
    let dx = rx[0] * nx * t * view.aspect + up[0] * ny * t + fw[0];
    let dy = rx[1] * nx * t * view.aspect + up[1] * ny * t + fw[1];
    let dz = rx[2] * nx * t * view.aspect + up[2] * ny * t + fw[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    if (dy >= -0.001) return { x: view.eye[0] + dx * 900, y: view.eye[2] + dz * 900 };
    const s = -view.eye[1] / dy;
    return { x: view.eye[0] + dx * s, y: view.eye[2] + dz * s };
  }

  function project(wx, wy, height = 0) {
    const m = view.mvp;
    if (!m) return null;
    const cx = m[0] * wx + m[4] * height + m[8] * wy + m[12];
    const cy = m[1] * wx + m[5] * height + m[9] * wy + m[13];
    const cw = m[3] * wx + m[7] * height + m[11] * wy + m[15];
    if (cw <= 0.01) return null;
    return { x: ((cx / cw) * 0.5 + 0.5) * view.w, y: (0.5 - (cy / cw) * 0.5) * view.h };
  }
  view.project = project;

  function draw(state) {
    if (!staticBuf) {
      const staticGeom = buildStatic(state.city);
      staticBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
      gl.bufferData(gl.ARRAY_BUFFER, staticGeom.data.subarray(0, staticGeom.count * 9), gl.STATIC_DRAW);
      staticCount = staticGeom.count;
    }
    const tint = daylightTint(state.timeOfDay);
    const sky = hexRgb(tint.sky);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const proj = perspective((CAMERA.fov * Math.PI) / 180, view.w / view.h, 1, 7000);
    const viewMat = lookAt(view.eye, view.target, [0, 1, 0]);
    const mvp = multiply(proj, viewMat);
    view.mvp = mvp;
    gl.useProgram(prog);
    gl.uniformMatrix4fv(loc.mvp, false, mvp);
    gl.uniform3f(loc.camPos, view.eye[0], view.eye[1], view.eye[2]);
    // A low golden-afternoon sun from the west, warm and a little low.
    const sun = norm3([-0.45, 0.78, -0.42]);
    gl.uniform3f(loc.sunDir, sun[0], sun[1], sun[2]);
    const sunI = 0.35 + 0.4 * tint.sun;
    gl.uniform3f(loc.sunColor, 1.0 * sunI, 0.86 * sunI, 0.66 * sunI);
    gl.uniform3f(loc.ambient, 0.46, 0.46, 0.52);
    gl.uniform1f(loc.fogNear, 850);
    gl.uniform1f(loc.fogFar, 4200);
    gl.uniform3f(loc.fogColor, sky[0], sky[1], sky[2]);
    gl.uniform1f(loc.alpha, 1);
    // The baked city.
    bindGeom(staticBuf);
    gl.drawArrays(gl.TRIANGLES, 0, staticCount);
    // Everything that moves, rebuilt this frame.
    drawDynamic(state);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dynGeom.data.subarray(0, dynGeom.count * 9), gl.DYNAMIC_DRAW);
    bindGeom(dynBuf);
    gl.drawArrays(gl.TRIANGLES, 0, dynGeom.count);
    // The translucent beams last, with blending on and depth writes off.
    drawTransparent(state);
    gl.bindBuffer(gl.ARRAY_BUFFER, transBuf);
    gl.bufferData(gl.ARRAY_BUFFER, transGeom.data.subarray(0, transGeom.count * 9), gl.DYNAMIC_DRAW);
    bindGeom(transBuf);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(loc.alpha, 0.32);
    gl.drawArrays(gl.TRIANGLES, 0, transGeom.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return view;
  }

  return { draw, updateCamera, screenToWorld, view };
}
