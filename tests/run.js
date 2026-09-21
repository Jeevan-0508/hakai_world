// Plain assertion runner for src/sim/* — zero framework, zero THREE dependency.
// Run with: node tests/run.js
import { makeRng } from '../src/sim/rng.js';
import { createWorld, tickWorld } from '../src/sim/world.js';
import { writeSave, loadSave } from '../src/save.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', msg); }
}

// --- localStorage stub (save.js reads/writes this; not present under plain node) ---
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

// 1. RNG determinism — same seed must produce the same sequence.
{
  const a = makeRng(42), b = makeRng(42);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert(JSON.stringify(seqA) === JSON.stringify(seqB), 'RNG: same seed produces same sequence');
  assert(seqA.every((n) => n >= 0 && n < 1), 'RNG: values stay in [0,1)');
}

// 2. World generation is reproducible from the configured seed.
{
  localStorage._d = {};
  const w1 = createWorld();
  localStorage._d = {};
  const w2 = createWorld();
  const posA = w1.creatures.map((c) => `${c.species}:${c.pos.x.toFixed(4)}:${c.pos.z.toFixed(4)}`);
  const posB = w2.creatures.map((c) => `${c.species}:${c.pos.x.toFixed(4)}:${c.pos.z.toFixed(4)}`);
  assert(JSON.stringify(posA) === JSON.stringify(posB), 'world-gen: identical seed produces identical spawn layout');
  assert(w1.creatures.length > 0, 'world-gen: spawns at least one creature');
  assert(w1.boss && w1.boss.species === 'boss_kragath', 'world-gen: boss_kragath is present');
  assert(Array.isArray(w1.resources) && w1.resources.length === 16, 'world-gen: 16 resource nodes seeded');
}

// 3. Creature spawn fields are well-formed (no NaN positions, valid state, def attached).
{
  localStorage._d = {};
  const w = createWorld();
  for (const c of w.creatures) {
    assert(Number.isFinite(c.pos.x) && Number.isFinite(c.pos.z), `creature ${c.id}: finite spawn position`);
    assert(typeof c.state === 'string' && c.state.length > 0, `creature ${c.id}: has a state`);
    assert(c.def && c.def.speed > 0, `creature ${c.id}: has a valid species def`);
    assert(c.home && Number.isFinite(c.home.x), `creature ${c.id}: has a home position`);
  }
}

// 4. Simulation runs for a long stretch without throwing or producing NaN state.
{
  localStorage._d = {};
  const w = createWorld();
  let threw = null;
  try {
    for (let i = 0; i < 3000; i++) tickWorld(w, 0.1); // 300 simulated seconds
  } catch (e) { threw = e; }
  assert(!threw, `tickWorld: 300s of simulation runs without throwing${threw ? ' (' + threw.message + ')' : ''}`);
  const allFinite = w.creatures.every((c) => Number.isFinite(c.pos.x) && Number.isFinite(c.pos.z));
  assert(allFinite, 'tickWorld: all creature positions stay finite after long simulation');
  const resourcesInRange = w.resources.every((r) => r.amount >= 0 && r.amount <= r.max);
  assert(resourcesInRange, 'tickWorld: resource amounts stay within [0, max]');
}

// 5. Save/load round-trip preserves player position and discovered sets.
{
  localStorage._d = {};
  const w = createWorld();
  w.player.pos = { x: 12.5, y: 1.7, z: -33.25 };
  w.discoveredSpecies.add('goblin_scout');
  w.discoveredLocations.add('ancient_structure');
  writeSave(w);

  const loaded = loadSave();
  assert(loaded.playerPos && loaded.playerPos.x === 12.5 && loaded.playerPos.z === -33.25, 'save/load: player position round-trips');
  assert(Array.isArray(loaded.discoveredSpecies) && loaded.discoveredSpecies.includes('goblin_scout'), 'save/load: discovered species round-trips');
  assert(Array.isArray(loaded.discoveredLocations) && loaded.discoveredLocations.includes('ancient_structure'), 'save/load: discovered locations round-trips');
}

// 6. Population: starved creatures die, thriving creatures reproduce (species-capped).
{
  const { tickPopulation } = await import('../src/sim/population.js');
  localStorage._d = {};
  const w = createWorld();

  // Force one creature to starve: sustained near-zero energy for longer than the threshold.
  // (Total population can still rise in the same window from unrelated reproduction, so check
  // this specific creature's id, not the raw count.)
  const targetId = w.creatures[0].id;
  w.creatures[0].energy = 0.01;
  for (let i = 0; i < 8; i++) tickPopulation(w, 4); // 8 ticks * 4s spacing > STARVE_SECONDS
  assert(!w.creatures.some((c) => c.id === targetId), 'population: a sustained-zero-energy creature is removed');

  // Force a second creature to thrive: high energy, no cooldown, under species cap.
  localStorage._d = {};
  const w2 = createWorld();
  const before2 = w2.creatures.length;
  const parent = w2.creatures.find((c) => c.def.tier !== 'elite');
  parent.energy = 0.99;
  parent.reproCooldown = 0;
  tickPopulation(w2, 4);
  assert(w2.creatures.length > before2, 'population: a thriving creature reproduces');

  // Species cap: pin every non-elite creature of one species to reproduce-ready and confirm
  // the count never exceeds the soft cap even after many ticks.
  localStorage._d = {};
  const w3 = createWorld();
  for (let t = 0; t < 40; t++) {
    for (const c of w3.creatures) { if (c.def.tier !== 'elite') { c.energy = 0.99; c.reproCooldown = 0; } }
    tickPopulation(w3, 4);
  }
  const counts3 = {};
  for (const c of w3.creatures) counts3[c.species] = (counts3[c.species] || 0) + 1;
  assert(Object.values(counts3).every((n) => n <= 6), 'population: species cap (6) holds under sustained reproduction pressure');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
