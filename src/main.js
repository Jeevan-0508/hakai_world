import * as THREE from 'three';
import { WORLD, SPECIES } from './config.js';
import { createWorld, tickWorld, discover } from './sim/world.js';
import { territoryHolders } from './sim/ecosystem.js';
import { buildTerrain } from './render/terrain.js';
import { buildSky, updateSky } from './render/sky.js';
import { buildLights, updateLights } from './render/lights.js';
import { buildEmbers, updateEmbers, buildRain, updateRain } from './render/particles.js';
import { buildCreatureVisual, updateCreatureVisual, disposeCreatureVisual } from './render/creatureRenderer.js';
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }); // preserveDrawingBuffer: photo-mode capture (section 22) reads this canvas directly
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // billboards + procedural structure only — shadow maps are not worth the cost here

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0508, 0.006);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const world = createWorld();
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
const creatureVisuals = new Map();
for (const c of world.creatures) creatureVisuals.set(c.id, buildCreatureVisual(scene, c, terrain.heightAt));
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

canvas.addEventListener('click', () => {
  if (!photoMode && !pointerLocked) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
window.addEventListener('mousemove', (e) => {
  if (pointerLocked && !photoMode) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  else if (photoMode && mouse.down) { photoRig.drag(e.movementX, e.movementY); }
});
canvas.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('wheel', (e) => { if (photoMode) photoRig.zoom(e.deltaY); });

let debugOn = false;
function toggleDebug() {
  debugOn = !debugOn;
  document.getElementById('debug').classList.toggle('hidden', !debugOn);
}

function togglePhotoMode() {
  photoMode = !photoMode;
  world.paused = photoMode;
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
    showDiscovery('ANCIENT STRUCTURE — LOCATION LOGGED');
    return;
  }
  if (discover(world, target)) showDiscovery(target.species);
}

let started = false;
runIntro(audio, () => { started = true; });

function reconcileCreatureVisuals() {
  // Population dynamics (births/deaths) change world.creatures over time; keep the
  // sprite map in sync instead of rebuilding it every frame.
  const liveIds = new Set(world.creatures.map((c) => c.id));
  for (const [id, vis] of creatureVisuals) {
    if (!liveIds.has(id)) { disposeCreatureVisual(scene, vis); creatureVisuals.delete(id); }
  }
  for (const c of world.creatures) {
    if (!creatureVisuals.has(c.id)) creatureVisuals.set(c.id, buildCreatureVisual(scene, c, terrain.heightAt));
  }

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
    tickWorld(world, dt);
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

    for (const c of world.creatures) {
      const dNow = Math.hypot(c.pos.x - world.player.pos.x, c.pos.z - world.player.pos.z);
      const cv = creatureVisuals.get(c.id);
      if (dNow < 220) { cv.sprite.visible = true; cv.shadow.visible = true; updateCreatureVisual(cv, c); }
      else { cv.sprite.visible = false; cv.shadow.visible = false; }
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
