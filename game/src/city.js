// Solmar Bay itself: the road grid, the blocks of buildings, the beach and the sea,
// the parks and the plaza, and the district names. Everything is generated once from
// the seed, so the same seed always builds the same city. The buildings are solid:
// isBlocked() is what the player, cars and pedestrians ask before they move.
// The 3D renderer reads the same buildings and stands them up with
// buildingHeight3D(), so the city the player drives through is the city the
// collision model already knows.

import { WORLD } from './config.js';
import { chance, hash2, pick, range, rangeInt } from './random.js';

export const DISTRICTS = [
  { name: 'Downtown', x: 1350, y: 450, w: 1350, h: 900, tone: 'city' },
  { name: 'Old Town', x: 0, y: 450, w: 900, h: 900, tone: 'old' },
  { name: 'Market Quarter', x: 1800, y: 900, w: 900, h: 900, tone: 'market' },
  { name: 'The Hills', x: 2700, y: 0, w: 900, h: 900, tone: 'hills' },
  { name: 'Marina', x: 0, y: 1800, w: 900, h: 520, tone: 'marina' },
  { name: 'Beachfront', x: 900, y: 2250, w: 2700, h: 350, tone: 'beach' },
  { name: 'Palm Industrial', x: 2700, y: 1350, w: 900, h: 900, tone: 'industrial' },
];

const ROOF_COLORS = ['#c96f4a', '#d98a5f', '#b85c5c', '#7a9a8a', '#a87c4f', '#8a6fa8', '#5f7fa8', '#c9a24a'];
const WALL_COLORS = ['#e8dcc8', '#d8c8b0', '#c8b8a8', '#e0c8a8', '#b8c8d0', '#d0b8c8'];

export function createCity(random) {
  const roadsX = [];
  const roadsY = [];
  for (let x = WORLD.roadGap; x < WORLD.width; x += WORLD.roadGap) roadsX.push(x);
  for (let y = WORLD.roadGap; y < WORLD.beachY; y += WORLD.roadGap) roadsY.push(y);

  const buildings = [];
  const palms = [];
  const lamps = [];
  const parks = [];
  const pickups = [];

  // One building per block, sometimes two, placed inside the block with a margin
  // from the roads. A few blocks are parks or the market plaza instead.
  const parkBlocks = new Set(['3,1', '5,3', '1,4']);
  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 5; by += 1) {
      const x0 = bx * WORLD.roadGap + WORLD.roadWidth / 2 + 14;
      const y0 = by * WORLD.roadGap + WORLD.roadWidth / 2 + 14;
      const x1 = (bx + 1) * WORLD.roadGap - WORLD.roadWidth / 2 - 14;
      const y1 = (by + 1) * WORLD.roadGap - WORLD.roadWidth / 2 - 14;
      if (y0 > WORLD.beachY - 60) continue;
      if (parkBlocks.has(`${bx},${by}`)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, bx, by });
        for (let p = 0; p < 7; p += 1) {
          palms.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), s: range(random, 0.8, 1.3) });
        }
        continue;
      }
      const count = chance(random, 0.35) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = count === 1 ? range(random, 180, 300) : range(random, 120, 170);
        const h = count === 1 ? range(random, 140, 260) : range(random, 110, 160);
        const x = count === 1 ? x0 + (x1 - x0 - w) / 2 : x0 + b * ((x1 - x0) / 2) + 8;
        const y = y0 + range(random, 0, Math.max(0, y1 - y0 - h));
        const district = DISTRICTS.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h);
        buildings.push({
          x, y, w, h,
          height: rangeInt(random, 1, district && district.tone === 'city' ? 5 : 3),
          roof: pick(random, ROOF_COLORS),
          wall: pick(random, WALL_COLORS),
          district: district ? district.name : 'Solmar Bay',
          windows: rangeInt(random, 2, 5),
        });
      }
    }
  }

  // Palm trees along the beach and the boardwalk, lamps along every road.
  for (let x = 120; x < WORLD.width; x += 170) {
    palms.push({ x: x + range(random, -30, 30), y: WORLD.beachY + 30 + range(random, -8, 8), s: range(random, 0.9, 1.4) });
  }
  for (const rx of roadsX) {
    for (const ry of roadsY) {
      lamps.push({ x: rx + WORLD.roadWidth / 2 + 8, y: ry - WORLD.roadWidth / 2 - 8 });
    }
  }

  // Health and ammo pickups scattered at fixed landmarks.
  pickups.push({ kind: 'health', x: 1150, y: 700, label: 'First Aid' });
  pickups.push({ kind: 'ammo', x: 2050, y: 1150, label: 'Ammo' });
  pickups.push({ kind: 'health', x: 2900, y: 1600, label: 'First Aid' });
  pickups.push({ kind: 'cash', x: 700, y: 1600, label: 'Cash' });
  pickups.push({ kind: 'ammo', x: 3200, y: 500, label: 'Ammo' });

  // Landmarks the missions and the HUD point at.
  const landmarks = {
    garage: { x: 1125, y: 675, label: "Mara's Garage" },
    hideout: { x: 3150, y: 225, label: 'Hill Hideout' },
    marina: { x: 450, y: 2025, label: 'Marina' },
    plaza: { x: 1575, y: 675, label: 'Market Plaza' },
    lifeguard: { x: 3150, y: 2440, label: 'Lifeguard Hut' },
    beachCar: { x: 2700, y: 2400, label: 'Marina Coupe' },
  };

  function onRoad(x, y) {
    const inRoadX = roadsX.some((rx) => Math.abs(x - rx) < WORLD.roadWidth / 2);
    const inRoadY = roadsY.some((ry) => Math.abs(y - ry) < WORLD.roadWidth / 2);
    return inRoadX || inRoadY;
  }

  function isBlocked(x, y, radius) {
    if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;
    if (y > WORLD.beachY + 180) return true; // the sea
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
    }
    return false;
  }

  // Nearest point on a road centreline, for spawning traffic and pedestrians.
  function nearestRoadPoint(x, y) {
    let bestX = roadsX[0];
    let bestY = roadsY[0];
    for (const rx of roadsX) if (Math.abs(rx - x) < Math.abs(bestX - x)) bestX = rx;
    for (const ry of roadsY) if (Math.abs(ry - y) < Math.abs(bestY - y)) bestY = ry;
    if (Math.abs(bestX - x) < Math.abs(bestY - y)) return { x: bestX, y, horizontal: false };
    return { x, y: bestY, horizontal: true };
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    return y > WORLD.beachY ? 'Beachfront' : 'Solmar Bay';
  }

  return { roadsX, roadsY, buildings, palms, lamps, parks, pickups, landmarks, onRoad, isBlocked, nearestRoadPoint, districtAt };
}

// The golden-hour tint for a time of day: 0 = dawn, 0.5 = noon, 1 = dusk.
export function daylightTint(timeOfDay) {
  const t = timeOfDay % 1;
  if (t < 0.2) return { sky: '#ffb37a', overlay: 'rgba(255,150,80,0.10)', sun: 0.35 };
  if (t < 0.45) return { sky: '#ffd9a0', overlay: 'rgba(255,220,150,0.04)', sun: 0.75 };
  if (t < 0.7) return { sky: '#ffe9b8', overlay: 'rgba(255,210,120,0.05)', sun: 0.9 };
  if (t < 0.88) return { sky: '#ff9e6a', overlay: 'rgba(255,120,60,0.14)', sun: 0.55 };
  return { sky: '#7a6a9e', overlay: 'rgba(60,60,140,0.22)', sun: 0.15 };
}

export function buildingShade(building) {
  return hash2(Math.round(building.x), Math.round(building.y));
}

// How tall a building stands in the 3D view: one storey is about 42 units,
// on a 34-unit ground floor, so a 5-storey downtown block rises well above
// the chase camera and the skyline reads from the street.
export function buildingHeight3D(building) {
  return 34 + building.height * 42;
}
