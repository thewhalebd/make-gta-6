# Solmar Bay — an open-world crime story

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/thewhalebd/make-gta-6/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/thewhalebd/make-gta-6/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an original open-world crime game that runs entirely offline in a
desktop browser from static files — no build step, no network requests, no libraries.
The 3D edition renders the city with raw WebGL (one hand-written shader, no engine,
no vendored code) behind a chase camera, with the HUD and minimap drawn on a second
canvas on top.

Dario Cruz comes home to the sun-soaked coastal city of Solmar Bay owing $50,000 to
casino boss Cassian Voss. His old friend Mara Solis runs a garage and gives him jobs
to pay the debt down: steal a Marina Coupe off the beach, run a package to the
lifeguard hut, settle scores with Voss's thugs at the market plaza, outrun the whole
Solmar Bay police force to a hideout in the hills, and finally face Voss himself at
the marina. Six missions, one story, and a city that keeps living around you.

## What's in the city

- **A 3D city to explore on foot and by car** — Downtown, Old Town, the Market Quarter,
  the Marina, the Hills and the Beachfront, with buildings that stand up in real height,
  traffic, pedestrians, parks, palms and a golden-hour sun that moves across the sky,
  all seen from a chase camera that follows Dario or his car.
- **Cars to steal and drive** — six original models (Coral Hatchback, Solmar Sedan,
  Palm Taxi, Marina Coupe, Dune Pickup, the rare Voss GT) with arcade handling,
  skid smoke and crash physics. Press **E** near a car to take it.
- **A wanted level and police who respond** — five stars of heat, patrol cars that
  chase, ram and arrest you, and heat that cools when you stay out of sight.
- **Missions and a story** — six jobs with dialogue, objectives, a golden marker
  beam and cash rewards that pay the debt down.
- **Combat** — fists (**F**) and a pistol (mouse aim, click to shoot), with ammo,
  health pickups and thugs and a boss who fight back.
- **A HUD with a minimap** — health, money, ammo, wanted stars, speedometer,
  mission objective and a live minimap with police blips and the mission marker.
- **Start screen, pause and save** — progress is saved to localStorage after every
  mission; press **C** on the title screen to continue.
- **Sound and music** — a sunny synthesized groove plus gunshots, sirens, engine
  hum and pickup chimes, all made with WebAudio oscillators. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot · drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Run |
| E | Enter / exit a car (steal it) |
| F | Punch |
| Mouse + click | Aim and shoot |
| M | Start the next mission |
| P / Esc | Pause (saves) |
| C (title screen) | Continue a saved game |

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser.

## How to build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json`.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged with
`?shot=chase|play|mission|start&seed=1` (see `shots.json`):

1. `1-chase.jpg` — a police chase in the Marina Coupe, three wanted stars, minimap and mission objective.
2. `2-street.jpg` — Dario on foot on a downtown street, traffic and pedestrians.
3. `3-mission.jpg` — mission 4, "Payback", fighting Voss's thugs at the market plaza.
4. `4-start.jpg` — the Solmar Bay title screen over the living city.

## Structure

The game is split into one-job modules under `game/src/`, drawn in two layers:
`render.js` paints the 3D world with raw WebGL (a single lambert-sun shader, the
city baked once into a static buffer, cars and people rebuilt each frame) on the
`#game` canvas, and `hud.js` draws the HUD, minimap and menus with canvas 2D on
the transparent `#hud` canvas stacked on top. Around them: `config.js` (tuning,
story, missions, camera), `city.js` (city generation and collision),
`vehicles.js` (traffic and driving), `pedestrians.js`, `police.js`,
`player.js`, `combat.js` (fists, pistol, thugs), `missions.js`, `audio.js`
(WebAudio sound and music), `input.js`, `particles.js`, `save.js`, `shots.js`
(deterministic screenshot scenes) and `main.js` (the loop and the screens).

## License

MIT — see `LICENSE`.
