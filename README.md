# HAKAI // WORLD

*The universe behind the protocol.*

A 2.5D explorable living world built around the existing **HAKAI PROTOCOL** universe —
its creatures, bosses, and dark-fantasy visual identity — reused as real world entities
instead of habit-tracker menu art. Not a dashboard, not a menu screen: you walk into it.

**Play live:** [jeevan-0508.github.io/hakai_world](https://jeevan-0508.github.io/hakai_world/)

No build step, no npm install — plain ES modules, Three.js loaded from a CDN import map.

## What this is (Phase 8 of an 8-phase build, complete)

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

Added in Phase 2:
- 16 resource nodes (glowing flora/fungus clusters) that herbivores/omnivores graze —
  visible shrinking/regrowth, danger-tinted red when predators linger nearby
- `GATHER` state (creatures walk to and feed at a resource node), `PATROL` state (fixed
  waypoint loops for the `patrol` profile), `MIGRATE` state (relocates a creature's home
  when its territory's resources stay depleted or dangerous for a sustained stretch —
  the predator → prey → resource pressure loop, checked on a 6s cadence, not every frame)
- Territory ground decals for `territorial`/`sentinel` species: soft, low-opacity,
  species-tinted textured circles under a creature's home, not a UI marker
- LOD: creature billboards beyond 220 units of the player stop updating/rendering (sim
  still ticks them at full fidelity; this only trims render cost)
- `tests/run.js`: a framework-free assertion runner for `src/sim/*` (RNG determinism,
  world-gen reproducibility, spawn integrity, a 300s stability run, save/load round-trip)

Added in Phase 3:
- Population dynamics closes the loop Phase 2 left cosmetic: a creature stuck near zero
  energy for a sustained stretch (starvation) is removed from the world; a thriving,
  cooled-down, non-elite creature reproduces near its home. A soft per-species cap (6)
  keeps a good season from running away unbounded — verified stable over a 3000-simulated-
  second run with no runaway growth
- Creature billboards are now created/disposed dynamically as the population changes,
  instead of being built once at load

Added in Phase 4:
- Carcasses: a death now leaves a temporary carcass instead of just vanishing. Predators
  and omnivores can scavenge it (`SCAVENGE` state) for a faster energy gain than grazing —
  worth the risk of carrion. An unclaimed carcass rots away on its own after 90 seconds
- Verified with a direct scavenging test (predator standing over a carcass eats it,
  energy rises, state exits cleanly) since the emergent trigger is probabilistic and
  distance-gated by design, not guaranteed in any short random window

Added in Phase 5:
- Touch controls on any touch-capable viewport (feature-detected, no separate mobile
  build): left-side virtual joystick for movement, drag-anywhere-on-the-right to look,
  a tap-to-observe button. Reuses the existing keyboard-boolean movement path and the
  existing mouse-delta look accumulator untouched — camera.js needed zero changes

Added in Phase 6:
- Simulation moved to a Web Worker (src/sim/worker.js). Creatures, boss, resources,
  carcasses, day/night, weather, events and population all tick off the main thread now;
  the render loop only applies a plain-object snapshot each tick instead of stepping the
  sim itself. Player position/yaw stays authoritative on the main thread (sent to the
  worker every frame) so camera look and movement stay tied to render framerate, not sim
  tick rate. Falls back to the old synchronous in-thread tick automatically if `Worker`
  construction fails for any reason

Added in Phase 7:
- Creature billboards moved from one `THREE.Sprite` per creature to one `InstancedMesh`
  per species (`src/render/creatureInstancing.js`), cutting draw calls from one-per-creature
  to one-per-species. No custom shader: each instance's matrix is rebuilt every frame from
  the live camera quaternion, the same spherical-billboard trick `THREE.Sprite` already
  used, so the visual result is the same technique, just batched. Ground shadows are a
  second shared InstancedMesh per species. State tinting (chase/combat, sleep-dim) uses
  InstancedMesh's native per-instance color, no shader work needed. The boss stays a
  single untouched Sprite; instancing one object has no payoff

Added in Phase 8:
- WebGPU render path, feature-detected and optional: if `navigator.gpu` exists, boot
  `THREE.WebGPURenderer` from `three/webgpu`; otherwise (or if WebGPU init throws for any
  reason) keep the WebGL path this project shipped with from day one. Everything else,
  scene, camera, materials, geometries, stays on the plain `three` namespace; only the
  renderer's own construction reaches into `three/webgpu`, which is the documented way to
  mix the two builds. This closes out the original 8-phase spec

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

## Verification note

Phases 6-8 (Web Worker sim, GPU instancing, WebGPU render path) shipped without a stable
full-screen browser session available while building them: verified instead by bundling
with `bun build` (catches syntax/import errors), and by running the real matrix/color and
snapshot logic headlessly against the actual `three`/sim modules outside a browser. Every
new path (Worker construction, WebGPU init) falls back to the pre-Phase-6 behavior if it
fails, so a browser that can't do one of these should still render exactly as before.
Visual correctness of instancing and WebGPU specifically is not confirmed on-screen this
session -- flagging that plainly rather than overclaiming it.

## Source assets

Creature/boss art and the HAKAI name/lore belong to the existing
[`hakai-protocol-v2`](https://github.com/Jeevan-0508/hakai-protocol-v2) project. This repo
reuses that art (`assets/`) but does not modify or duplicate that game's own gameplay.
