// Population dynamics (spec section 11 continued) — starvation death and reproduction close
// the resource -> creature loop that Phase 2 only made cosmetic (energy could hit 0 forever).
// Checked on a slow cadence like ecosystem.js; population changes are a consequence, not a
// per-frame concern.
import { WORLD } from '../config.js';
import { spawnCreature } from './creature.js';
import { spawnCarcass } from './carcasses.js';

const STARVE_THRESHOLD = 0.04;
const STARVE_SECONDS = 25;      // sustained near-zero energy before death
const REPRODUCE_ENERGY = 0.92;
const REPRODUCE_COOLDOWN = 40;  // seconds, per-creature, after giving birth
const MAX_PER_SPECIES = 6;      // soft cap so a thriving species doesn't run away unbounded

export function tickPopulation(world, dt) {
  world.popT = (world.popT || 0) + dt;
  if (world.popT < 4) return;
  world.popT = 0;

  // Starvation: track consecutive low-energy time; cull once it's sustained, not a single dip.
  for (const c of world.creatures) {
    if (c.energy <= STARVE_THRESHOLD) c.starveT = (c.starveT || 0) + 4;
    else c.starveT = 0;
  }
  const died = world.creatures.filter((c) => c.starveT >= STARVE_SECONDS);
  if (died.length) {
    world.creatures = world.creatures.filter((c) => c.starveT < STARVE_SECONDS);
    world.deaths = (world.deaths || []).concat(died.map((c) => c.id));
    for (const d of died) spawnCarcass(world, d.pos, d.species);
  }

  // Reproduction: thriving, cooled-down, non-elite creatures under their species cap spawn
  // one offspring near the parent's home. Elites (bosses aside) stay single by design.
  const counts = {};
  for (const c of world.creatures) counts[c.species] = (counts[c.species] || 0) + 1;

  const births = [];
  for (const c of world.creatures) {
    if (c.def.tier === 'elite' || c.isBoss) continue;
    c.reproCooldown = Math.max(0, (c.reproCooldown || 0) - 4);
    if (c.energy < REPRODUCE_ENERGY || c.reproCooldown > 0) continue;
    if ((counts[c.species] || 0) >= MAX_PER_SPECIES) continue;
    c.reproCooldown = REPRODUCE_COOLDOWN;
    c.energy *= 0.6; // birth costs the parent energy
    const ang = world.rng() * Math.PI * 2;
    const pos = { x: c.home.x + Math.sin(ang) * 4, z: c.home.z + Math.cos(ang) * 4 };
    const child = spawnCreature(c.species, c.def, pos, world.rng);
    counts[c.species] = (counts[c.species] || 0) + 1;
    births.push(child);
  }
  if (births.length) world.creatures = world.creatures.concat(births);
}
