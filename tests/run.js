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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
