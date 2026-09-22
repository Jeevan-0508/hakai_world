// SIM WORKER. Owns the authoritative world tick (creatures, boss, resources, carcasses,
// day/night, weather, events, population) off the main thread. The main thread keeps
// player pos/yaw authoritative for responsive camera control and sends it here each
// frame; this file sends back a plain-object snapshot the main thread renders from.
// No THREE, no DOM: this module only ever touches src/sim/*, which was already built
// with zero rendering dependencies, so moving it here is a relocation, not a rewrite.
import { createWorld, tickWorld, discover } from './world.js';

const world = createWorld();
const TICK_MS = 50; // 20Hz sim, independent of render framerate

function snapshot() {
  return {
    time: world.time,
    paused: world.paused,
    dayNight: world.dayNight,
    // .weather/.events carry their own rng closure (weather.js/events.js store it on the
    // object for their own reroll logic) -- postMessage cannot structured-clone a function,
    // so sending these wholesale threw DataCloneError on every single tick and the worker
    // snapshot never reached the main thread. Send only the plain data fields.
    weather: { state: world.weather.state, t: world.weather.t, next: world.weather.next },
    events: { active: world.events.active, t: world.events.t, cooldown: world.events.cooldown },
    structure: { discovered: world.structure.discovered },
    discoveredSpecies: [...world.discoveredSpecies],
    discoveredLocations: [...world.discoveredLocations],
    creatures: world.creatures.map((c) => ({
      id: c.id, species: c.species, pos: c.pos, heading: c.heading, bob: c.bob,
      state: c.state, energy: c.energy, discovered: c.discovered, alive: c.alive,
    })),
    boss: {
      id: world.boss.id, species: world.boss.species, pos: world.boss.pos,
      heading: world.boss.heading, bob: world.boss.bob, state: world.boss.state,
      energy: world.boss.energy, discovered: world.boss.discovered, alive: world.boss.alive,
    },
    resources: world.resources.map((r) => ({ id: r.id, pos: r.pos, kind: r.kind, amount: r.amount, maxAmount: r.maxAmount })),
    carcasses: world.carcasses.map((c) => ({ id: c.id, pos: c.pos, species: c.species, amount: c.amount, age: c.age })),
  };
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'player') {
    world.player.pos = msg.pos;
    world.player.yaw = msg.yaw;
  } else if (msg.type === 'discover') {
    if (msg.special === 'ancient_structure') {
      world.structure.discovered = true;
      world.discoveredLocations.add('ancient_structure');
      return;
    }
    const all = [...world.creatures, world.boss];
    const target = all.find((c) => c.id === msg.id);
    if (target) discover(world, target);
  } else if (msg.type === 'photoMode') {
    world.paused = !!msg.paused;
  } else if (msg.type === 'save') {
    // Save writing stays main-thread-only (localStorage isn't reliably available
    // in every worker context); the main thread pulls player pos/yaw itself and
    // asks us for the discovered sets via the regular snapshot instead.
  }
};

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tickWorld(world, dt);
  postMessage(snapshot());
}, TICK_MS);
