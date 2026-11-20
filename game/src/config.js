// Solmar Bay — the single source of truth for numbers, names and colours.
//
// Everything tunable lives here so the rest of the game never hard-codes a
// value twice: the size of the city, how the chase camera sits behind Dario,
// how fast he walks and drives, how the police respond, what the six missions
// pay, and the golden-afternoon palette the WebGL renderer lights with.
//
// The city, the people, the cars and the story are all invented for this
// entry. Nothing is borrowed from any commercial game.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay.save.v1';

export const CITY_NAME = 'SOLMAR BAY';
export const GAME_TITLE = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'an open-world crime story';

// The world is 3600 by 2600 units. Roads sit on a 450-unit grid and the
// southern strip, past y = 2320, is sand and then sea.
export const WORLD = {
  width: 3600,
  height: 2600,
  roadGap: 450,
  roadWidth: 96,
  beachY: 2320,
};

// Chase camera: distance and height behind the player, how far ahead it
// looks, and how much both stretch as the car picks up speed. 60 degrees
// of perspective, the usual third-person framing.
export const CAMERA = {
  fov: 60,
  distance: 260,
  height: 120,
  lookAhead: 170,
  speedDistance: 0.12,
  speedHeight: 0.05,
};

// Dario Cruz comes home owing casino boss Cassian Voss $50,000. His old
// friend Mara Solis runs a garage and hands him the jobs that pay it down.
export const STORY = {
  hero: 'Dario Cruz',
  ally: 'Mara Solis',
  mechanic: 'Tito Reyes',
  villain: 'Cassian Voss',
  gang: "Voss's crew",
  debt: 50000,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 320,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.45,
  gunDamage: 34,
  gunRange: 420,
  fireCooldown: 0.22,
  startAmmo: 24,
  startMoney: 120,
};

// Arcade driving: acceleration, braking, steering and grip for the car
// Dario is driving. Individual models scale top speed and acceleration.
export const CAR = {
  accel: 620,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  length: 52,
  width: 26,
};

// The cars of Solmar Bay. Each one has its own paint and its own feel;
// the Voss GT is the rare fast one.
export const CAR_MODELS = [
  { name: 'Coral Hatchback', color: '#e2725b', top: 430, accel: 540 },
  { name: 'Solmar Sedan', color: '#4f7fb8', top: 480, accel: 580 },
  { name: 'Palm Taxi', color: '#f2c94c', top: 460, accel: 560, taxi: true },
  { name: 'Marina Coupe', color: '#c94f7c', top: 560, accel: 660 },
  { name: 'Dune Pickup', color: '#7a9a5b', top: 470, accel: 600 },
  { name: 'Voss GT', color: '#1c1c22', top: 640, accel: 760, rare: true },
];

export const POLICE = {
  carColor: '#e8e8e8',
  maxSpeed: 600,
  accel: 700,
  // How long a cop must stay touching Dario on foot before the bust lands.
  arrestTime: 1.6,
  spawnInterval: 2.2,
  maxCops: 6,
};

// Wanted level, 0 to 5 stars. Heat fades once no cop can see Dario.
export const WANTED = {
  decayDelay: 6,
  decayRate: 0.35,
  stealCar: 1,
  shoot: 2,
  hitPedestrian: 1,
  killThug: 0,
};

export const MISSIONS = [
  {
    id: 'homecoming',
    title: '1 — Homecoming',
    giver: 'Mara Solis',
    pay: 800,
    intro: 'Mara: "Dario! You came back. Voss still owns your debt — $50,000. Work for me and we pay it down. First: get to my garage, the blue wrench on your map."',
    objective: 'Drive or walk to Mara\'s Garage',
    steps: [{ kind: 'goto', x: 1125, y: 675, label: "Mara's Garage" }],
  },
  {
    id: 'hotwheels',
    title: '2 — Hot Wheels',
    giver: 'Mara Solis',
    pay: 1500,
    intro: 'Mara: "A Marina Coupe is parked by the beach. Take it — quietly — and bring it to the garage. If the cops see you take it, lose them."',
    objective: 'Steal the Marina Coupe and deliver it to the garage',
    steps: [
      { kind: 'steal', model: 'Marina Coupe', x: 2700, y: 2400, label: 'Marina Coupe' },
      { kind: 'goto', x: 1125, y: 675, label: "Mara's Garage", inCar: true },
    ],
  },
  {
    id: 'beachrun',
    title: '3 — Beach Run',
    giver: 'Tito Reyes',
    pay: 2000,
    intro: 'Tito: "Package for the lifeguard hut, south beach. Cops are watching the boardwalk — keep it smooth, no trouble, and you get paid."',
    objective: 'Deliver the package to the lifeguard hut on the beach',
    steps: [{ kind: 'goto', x: 3150, y: 2440, label: 'Lifeguard Hut' }],
  },
  {
    id: 'payback',
    title: '4 — Payback',
    giver: 'Mara Solis',
    pay: 3000,
    intro: 'Mara: "Voss sent three of his boys to shake down the market. Go to the plaza and send them packing. Fists or the pistol — your call."',
    objective: 'Deal with 3 of Voss\'s thugs at the market plaza',
    steps: [{ kind: 'defeat', count: 3, x: 1575, y: 675, label: 'Market Plaza' }],
  },
  {
    id: 'getaway',
    title: '5 — The Getaway',
    giver: 'Tito Reyes',
    pay: 4000,
    intro: 'Tito: "Voss tipped the cops — they\'re all over you! Get to the hideout in the hills and stay out of sight until the heat dies down."',
    objective: 'Escape the police and reach the hill hideout',
    steps: [{ kind: 'escape', x: 3150, y: 225, label: 'Hill Hideout' }],
  },
  {
    id: 'king',
    title: '6 — King of Solmar',
    giver: 'Mara Solis',
    pay: 10000,
    intro: 'Mara: "This ends tonight. Voss is at the marina with his crew. Take him down and the debt dies with him. Good luck, Dario."',
    objective: 'Defeat Cassian Voss at the marina',
    steps: [{ kind: 'boss', x: 450, y: 2025, label: 'Marina — Cassian Voss' }],
  },
];

// Golden-afternoon palette: warm sky, green city, pale sand, blue sea.
export const PALETTE = {
  sky: '#ffd9a0',
  grass: '#7fb069',
  grassDry: '#a8b06a',
  sand: '#ecd9a0',
  sea: '#3fa7c4',
  seaDeep: '#2b7fa3',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  buildingRoof: '#c96f4a',
  buildingWall: '#8a5a44',
  park: '#5d9e52',
  text: '#f5f1e6',
  muted: '#cfc8b8',
  hudPanel: 'rgba(12,16,24,0.72)',
  hudAccent: '#f2c94c',
  wantedStar: '#ffd94d',
  policeBlue: '#4f8ef7',
  policeRed: '#f74f4f',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
