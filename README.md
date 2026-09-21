# HAKAI // WORLD

*The universe behind the protocol.*

A 2.5D explorable living world built around the existing **HAKAI PROTOCOL** universe —
its creatures, bosses, and dark-fantasy visual identity — reused as real world entities
instead of habit-tracker menu art. Not a dashboard, not a menu screen: you walk into it.

**Play:** open `index.html` on any static server (or GitHub Pages once deployed). No build
step, no npm install — plain ES modules, Three.js loaded from a CDN import map.

## What this is (Phase 1 of an 8-phase build)

HAKAI PROTOCOL's existing assets are AI-generated 2D PNGs (some transparent cutouts, some
full illustrations) — no 3D models, no sprite sheets, no animation frames. So this project
does **not** force full 3D: it's a 2.5D world — real terrain, lighting, fog and particles in
Three.js, with the actual HAKAI creature/boss art as camera-facing billboards, grounded with
soft shadows and a radial alpha mask so illustrated rectangles don't look pasted onto the map.

Shipped in this slice:
- Cinematic open (black screen → `SECTOR // UNKNOWN` → world reveal), no conventional menu
- One biome: ash/ember terrain basin around a procedural ancient structure, ringed by distant
  mountain silhouettes for scale
- 12 HAKAI creatures as living world entities (10 common + 1 elite `primordial_demon` + the
  flying `archangel`), each with a behavior profile (skittish / pack / territorial / sentinel /
  patrol / stalker / flyer) driving an IDLE → WANDER → OBSERVE → INVESTIGATE → CHASE/FLEE →
  COMBAT → RETREAT → RECOVER state machine
- `boss_kragath` guarding the ancient structure
- Day/night cycle (3 min), 4 weather states, 3 rare world events (Red Moon / Biological Shift /
  Void Storm)
- Synthesized Web Audio ambience (no audio files — same approach as the source game's
  `audio_engine.js`): drone, wind, panned creature calls, footsteps, event stinger
- Discovery system (`E` near an undiscovered entity/location), Photo Mode (`P`, pauses sim,
  free orbit camera, screenshot-ready canvas), debug overlay (`F3`)
- Versioned `localStorage` save: player position, discovered species/locations

## Architecture

Strict simulation/render separation (spec section 26):

```
src/sim/      world state, creature FSM, day-night, weather, events — no THREE imports
src/render/   terrain, sky, lights, particles, creature billboards, ancient structure,
              camera rigs, HUD, cinematic — reads sim state, never mutates it
src/audio/    Web Audio synthesis
src/main.js   the only place that ticks sim then renders
```

## Controls

`WASD` move · `Shift` sprint · mouse look (click to lock pointer) · `E` observe ·
`P` photo mode · `F3` debug · `M` mute

## Not built yet (phases 2–8 of the original spec)

Deeper predator/prey ecology, territory visualization beyond spawn radius, Web Worker
simulation offload, LOD/instancing stress-tested past ~30 entities, WebGPU path, mobile
controls. Tracked so the next session picks up cleanly instead of re-auditing.

## Source assets

Creature/boss art and the HAKAI name/lore belong to the existing
[`hakai-protocol-v2`](https://github.com/Jeevan-0508/hakai-protocol-v2) project. This repo
reuses that art (`assets/`) but does not modify or duplicate that game's own gameplay.
