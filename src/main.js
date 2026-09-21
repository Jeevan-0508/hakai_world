import * as THREE from 'three';
import { WORLD, SPECIES } from './config.js';
import { createWorld, tickWorld, discover } from './sim/world.js'; // tickWorld/discover: main-thread fallback if the sim worker can't start
import { territoryHolders } from './sim/ecosystem.js';
import { buildTerrain } from './render/terrain.js';
import { buildSky, updateSky } from './render/sky.js';
import { buildLights, updateLights } from './render/lights.js';
import { buildEmbers, updateEmbers, buildRain, updateRain } from './render/particles.js';
import { buildCreatureVisual, updateCreatureVisual } from './render/creatureRenderer.js';
import { buildSpeciesInstances, updateSpeciesInstances } from './render/creatureInstancing.js';
import { buildStructure, updateStructure } from './render/structure.js';
import { buildResourceVisuals, updateResourceVisuals } from './render/resources.js';
import { buildTerritoryVisuals } from './render/territory.js';
import { buildCarcassVisual, updateCarcassVisual, disposeCarcassVisual } from './render/carcasses.js';
import { createFirstPersonRig, createPhotoRig } from './render/camera.js';
import { updateHud, showDiscovery, updateDebug } from './render/hud.js';
import { runIntro } from './render/cinematic.js';
import { writeSave } from './save.js';
import { WorldAudio } from './audio/audio.js';

const canvas = document.getElementById('scene');

// Phase 8: use WebGPU if the browser has it, otherwise the WebGL path this project
// shipped with from day one. Feature-detected and optional, not a forced replacement --
// if navigator.gpu exists but init() fails for any reason (driver quirk, unsupported
// feature), fall straight back to WebGL rather than leave the page broken. Everything
// downstream (scene, camera, materials, geometries) keeps importing the plain 'three'
// namespace as before; only this renderer's own construction reaches into 'three/webgpu',
// which is the documented usage pattern for mixing the two.
let renderer = null;
if (navigator.gpu) {
  try {
    const { WebGPURenderer } = await import('three/webgpu');
    const gpuRenderer = new WebGPURenderer({ canvas, antialias: true });
    await gpuRenderer.init();
    renderer = gpuRenderer;
    console.log('HAKAI // WORLD: running on WebGPU');
  } catch (err) {
    console.error('WebGPU present but failed to initialize, falling back to WebGL:', err);
    renderer = null;
  }
}
if (!renderer) {
  // preserveDrawingBuffer: photo-mode capture (section 22) reads this canvas directly
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
if (renderer.shadowMap) renderer.shadowMap.enabled = false; // billboards + procedural structure only — shadow maps are not worth the cost here

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0508, 0.006);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const world = createWorld();

// Phase 6: the sim (creatures, boss, resources, carcasses, day/night, weather, events,
// population) ticks on a Worker so a busy frame never stalls behavior logic and vice
// versa. Player pos/yaw stays authoritative on the main thread for a responsive camera;
// we push it to the worker each frame and pull back a plain-object snapshot to render.
// src/sim/* has zero DOM/THREE deps, so the worker runs the exact same tickWorld() the
// main thread used before this phase, a relocation, not new sim logic.
let simWorker = null;
let usingWorker = false;
try {
  simWorker = new Worker(new URL('./sim/worker.js', import.meta.url), { type: 'module' });
  simWorker.onmessage = (e) => applySnapshot(e.data);
  simWorker.onerror = (err) => {
    console.error('sim worker crashed, falling back to main-thread simulation:', err);
    usingWorker = false;
  };
  usingWorker = true;
} catch (err) {
  console.error('Workers unavailable, running simulation on the main thread:', err);
  usingWorker = false;
}

function applySnapshot(snap) {
  world.time = snap.time;
  world.paused = snap.paused;
  world.dayNight = snap.dayNight;
  world.weather = snap.weather;
  world.events = snap.events;
  world.structure.discovered = snap.structure.discovered;
  world.discoveredSpecies = new Set(snap.discoveredSpecies);
  world.discoveredLocations = new Set(snap.discoveredLocations);
  world.creatures = snap.creatures.map((c) => ({ ...c, def: SPECIES[c.species] }));
  world.boss = { ...snap.boss, def: world.boss.def };
  world.resources = snap.resources.map((r) => ({ ...r }));
  world.carcasses = snap.carcasses.map((c) => ({ ...c }));
}
const terrain = buildTerrain(scene);
const sky = buildSky(scene);
const lights = buildLights(scene);
const embers = buildEmbers(scene);
const rain = buildRain(scene);
const structureVis = buildStructure(scene, world.structure.pos, terrain.heightAt);
const resourceVis = buildResourceVisuals(scene, world.resources, terrain.heightAt);
buildTerritoryVisuals(scene, territoryHolders(world), terrain.heightAt); // static decals, homes don't move
const audio = new WorldAudio();

const carcassVisuals = new Map();
// Phase 7: one InstancedMesh (+ shared shadow InstancedMesh) per species instead of one
// Sprite per creature -- built once for every species regardless of current live count,
// since population dynamics can bring a species back after a local extinction. The boss
// is a single, unique entity, so it stays the simple untouched Sprite path.
const speciesInstances = new Map();
for (const key of Object.keys(SPECIES)) speciesInstances.set(key, buildSpeciesInstances(scene, key, SPECIES[key]));
const bossVisual = buildCreatureVisual(scene, world.boss, terrain.heightAt);

const fpRig = createFirstPersonRig(camera);
const photoRig = createPhotoRig(camera);
let photoMode = false;

const keys = {};
const mouse = { dx: 0, dy: 0, down: false };
let pointerLocked = false;

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'e' || e.key === 'E') tryDiscover();
  if (e.key === 'p' || e.key === 'P') togglePhotoMode();
  if (e.key === 'F3') toggleDebug();
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

canvas.addEventListener('click', () => {
  if (!isTouch && !photoMode && !pointerLocked) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
window.addEventListener('mousemove', (e) => {
  if (pointerLocked && !photoMode) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  else if (photoMode && mouse.down) { photoRig.drag(e.movementX, e.movementY); }
});
canvas.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('wheel', (e) => { if (photoMode) photoRig.zoom(e.deltaY); });

// Touch controls (spec phase — mobile support). Feature-detected, reuses the existing
// keyboard-boolean movement path and the existing mouse.dx/dy look accumulator untouched,
// so camera.js and the rest of the input pipeline needed zero changes.
if (isTouch) {
  document.getElementById('touch-ui').classList.remove('hidden');
  document.getElementById('hint').textContent = 'DRAG LEFT: MOVE · DRAG RIGHT: LOOK · TAP OBSERVE';

  const stick = document.getElementById('touch-joystick');
  const nub = document.getElementById('touch-joystick-nub');
  let stickPointerId = null;
  const STICK_RADIUS = 48;

  function setStickKeys(dx, dz) {
    const dead = 0.25;
    keys['w'] = dz < -dead;
    keys['s'] = dz > dead;
    keys['a'] = dx < -dead;
    keys['d'] = dx > dead;
  }

  stick.addEventListener('pointerdown', (e) => {
    stickPointerId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointerId) return;
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / STICK_RADIUS, dy = (e.clientY - cy) / STICK_RADIUS;
    const mag = Math.min(1, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    dx = Math.cos(ang) * mag; dy = Math.sin(ang) * mag;
    nub.style.transform = `translate(${dx * STICK_RADIUS}px, ${dy * STICK_RADIUS}px)`;
    setStickKeys(dx, dy);
  });
  function releaseStick(e) {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    nub.style.transform = 'translate(0,0)';
    setStickKeys(0, 0);
  }
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  const lookZone = document.getElementById('touch-look');
  let lookPointerId = null, lastLookX = 0, lastLookY = 0;
  lookZone.addEventListener('pointerdown', (e) => {
    lookPointerId = e.pointerId; lastLookX = e.clientX; lastLookY = e.clientY;
    lookZone.setPointerCapture(e.pointerId);
  });
  lookZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointerId || photoMode) return;
    mouse.dx += e.clientX - lastLookX; mouse.dy += e.clientY - lastLookY;
    lastLookX = e.clientX; lastLookY = e.clientY;
  });
  lookZone.addEventListener('pointerup', (e) => { if (e.pointerId === lookPointerId) lookPointerId = null; });
  lookZone.addEventListener('pointercancel', (e) => { if (e.pointerId === lookPointerId) lookPointerId = null; });

  document.getElementById('touch-discover').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tryDiscover();
  });
}

let debugOn = false;
function toggleDebug() {
  debugOn = !debugOn;
  document.getElementById('debug').classList.toggle('hidden', !debugOn);
}

function togglePhotoMode() {
  photoMode = !photoMode;
  world.paused = photoMode;
  if (usingWorker) simWorker.postMessage({ type: 'photoMode', paused: photoMode });
  document.getElementById('hud').classList.toggle('hidden', photoMode);
  document.getElementById('photo-hud').classList.toggle('hidden', !photoMode);
  if (photoMode) {
    photoRig.setTarget(new THREE.Vector3(world.player.pos.x, terrain.heightAt(world.player.pos.x, world.player.pos.z) + 3, world.player.pos.z));
    if (pointerLocked) document.exitPointerLock();
  }
}

function nearestUndiscovered() {
  let best = null, bestDist = 12;
  const all = [...world.creatures, world.boss];
  for (const c of all) {
    if (c.discovered) continue;
    const d = Math.hypot(c.pos.x - world.player.pos.x, c.pos.z - world.player.pos.z);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  if (!world.structure.discovered) {
    const d = Math.hypot(world.structure.pos.x - world.player.pos.x, world.structure.pos.z - world.player.pos.z);
    if (d < 30) return { special: 'ancient_structure', dist: d };
  }
  return best;
}

function tryDiscover() {
  const target = nearestUndiscovered();
  if (!target) return;
  if (target.special === 'ancient_structure') {
    world.structure.discovered = true;
    world.discoveredLocations.add('ancient_structure');
    if (usingWorker) simWorker.postMessage({ type: 'discover', special: 'ancient_structure' });
    showDiscovery('ANCIENT STRUCTURE — LOCATION LOGGED');
    return;
  }
  // Mutate the local copy immediately for a responsive toast, then tell the worker so
  // its authoritative copy agrees before the next snapshot overwrites ours.
  if (discover(world, target)) {
    if (usingWorker) simWorker.postMessage({ type: 'discover', id: target.id });
    showDiscovery(target.species);
  }
}

let started = false;
runIntro(audio, () => { started = true; });

function reconcileCreatureVisuals() {
  // Instanced species meshes need no build/dispose reconciliation -- mesh.count just
  // tracks the live species population each frame inside updateSpeciesInstances().
  // Carcasses are still individual meshes (max 16 at a time, not the scaling concern).
  const liveCarcassIds = new Set(world.carcasses.map((c) => c.id));
  for (const [id, vis] of carcassVisuals) {
    if (!liveCarcassIds.has(id)) { disposeCarcassVisual(scene, vis); carcassVisuals.delete(id); }
  }
  for (const c of world.carcasses) {
    if (!carcassVisuals.has(c.id)) carcassVisuals.set(c.id, buildCarcassVisual(scene, c, terrain.heightAt));
  }
}

let last = performance.now();
function frame() {
  const now = performance.now();
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (started) {
    if (usingWorker) simWorker.postMessage({ type: 'player', pos: world.player.pos, yaw: world.player.yaw });
    else tickWorld(world, dt); // fallback: no worker, tick synchronously as before Phase 6
    audio.setNight(world.dayNight.isNight);
    audio.setWeather(world.weather.state);
    audio.setEvent(!!world.events.active);
    if (world.events.active?.id === 'red_moon' && !world.events._stingerPlayed) { audio.eventStinger(); world.events._stingerPlayed = true; }
    if (!world.events.active) world.events._stingerPlayed = false;
    audio.update(dt, world);

    let moving = false;
    if (photoMode) { photoRig.update(); }
    else { moving = fpRig.update(world, terrain.heightAt, keys, dt, mouse); }
    if (moving && Math.random() < dt * 4) audio.footstep();

    updateSky(sky, world.dayNight, world.weather);
    updateLights(lights, world.dayNight, world.events.active?.id);
    updateEmbers(embers, dt);
    updateRain(rain, dt, world.weather.state === 'emberstorm');
    updateStructure(structureVis, world.time);
    updateResourceVisuals(resourceVis);
    reconcileCreatureVisuals();

    const bySpecies = new Map();
    for (const c of world.creatures) {
      const dNow = Math.hypot(c.pos.x - world.player.pos.x, c.pos.z - world.player.pos.z);
      if (dNow >= 220) continue; // same LOD cutoff as the old per-sprite visible toggle
      if (!bySpecies.has(c.species)) bySpecies.set(c.species, []);
      bySpecies.get(c.species).push(c);
    }
    for (const [key, inst] of speciesInstances) {
      updateSpeciesInstances(inst, bySpecies.get(key) || [], camera, terrain.heightAt);
    }
    updateCreatureVisual(bossVisual, world.boss);
    for (const vis of carcassVisuals.values()) updateCarcassVisual(vis);

    updateHud(world, nearestUndiscovered());
    if (debugOn) {
      updateDebug(
        `FPS ${Math.round(1 / dt)}\n` +
        `entities ${world.creatures.length + 1}\n` +
        `resources ${world.resources.length}\n` +
        `carcasses ${world.carcasses.length}\n` +
        `draws ${renderer.info.render.calls}\n` +
        `tris ${renderer.info.render.triangles}\n` +
        `state ${world.boss.state}\n` +
        `weather ${world.weather.state}\n` +
        `event ${world.events.active?.id || 'none'}`
      );
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setInterval(() => writeSave(world), 8000);
window.addEventListener('beforeunload', () => writeSave(world));
