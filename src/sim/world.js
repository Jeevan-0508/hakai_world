// WORLD SIMULATION -> WORLD STATE. The renderer only reads this; never writes gameplay state.
import { WORLD, SPECIES, BOSS } from '../config.js';
import { makeRng } from './rng.js';
import { spawnCreature, tickCreature } from './creature.js';
import { makeDayNight, tickDayNight } from './dayNight.js';
import { makeWeather, tickWeather } from './weather.js';
import { makeEvents, tickEvents } from './events.js';
import { loadSave } from '../save.js';
import { makeResources, tickResources } from './resources.js';
import { tickEcosystem } from './ecosystem.js';

export function createWorld() {
  const rng = makeRng(WORLD.seed);
  const save = loadSave();

  const world = {
    rng,
    time: 0,
    paused: false, // set true in photo mode — sim freezes, render keeps going
    player: {
      pos: save.playerPos || { x: 0, y: 1.7, z: 40 },
      yaw: save.playerYaw || Math.PI,
    },
    dayNight: makeDayNight(),
    weather: makeWeather(rng),
    events: makeEvents(rng),
    creatures: [],
    boss: null,
    structure: { pos: { x: 0, z: -60 }, discovered: !!save.discoveredLocations?.includes('ancient_structure') },
    discoveredSpecies: new Set(save.discoveredSpecies || []),
    discoveredLocations: new Set(save.discoveredLocations || []),
    resources: makeResources(rng),
    ecoT: 0,
  };

  const keys = Object.keys(SPECIES);
  keys.forEach((key, i) => {
    const def = SPECIES[key];
    const count = def.tier === 'elite' ? 1 : (def.flying ? 2 : 2 + Math.floor(rng() * 2));
    for (let n = 0; n < count; n++) {
      const ang = rng() * Math.PI * 2;
      const r = 30 + rng() * WORLD.spawnRadius;
      const pos = { x: Math.sin(ang) * r, z: Math.cos(ang) * r };
      world.creatures.push(spawnCreature(key, def, pos, rng));
    }
  });

  const bossDef = BOSS.boss_kragath;
  world.boss = {
    id: 'boss_kragath', species: 'boss_kragath', def: bossDef,
    pos: { x: world.structure.pos.x, y: 0, z: world.structure.pos.z + 14 },
    home: { x: world.structure.pos.x, z: world.structure.pos.z + 14 },
    heading: 0, state: 'SLEEP', stateT: 0, energy: 1, perceptionRange: 34, territoryRadius: 26,
    discovered: world.discoveredSpecies.has('boss_kragath'), bob: 0, isBoss: true, alive: true,
  };

  return world;
}

export function tickWorld(world, dt) {
  world.time += dt;
  if (world.paused) return;

  tickDayNight(world.dayNight, dt);
  tickWeather(world.weather, dt);
  tickEvents(world.events, dt);

  tickResources(world.resources, dt, world.creatures);
  tickEcosystem(world, dt);

  const redMoon = world.events.active?.id === 'red_moon';
  for (const c of world.creatures) tickCreature(c, dt, world, world.rng);
  tickCreature(world.boss, dt, world, world.rng);
  if (redMoon && world.boss.state !== 'COMBAT') {
    // Red Moon stirs the guardian even without the player nearby.
    world.boss.perceptionRange = 60;
  } else {
    world.boss.perceptionRange = 34;
  }
}

export function discover(world, entity) {
  if (entity.discovered) return false;
  entity.discovered = true;
  world.discoveredSpecies.add(entity.species);
  return true;
}
