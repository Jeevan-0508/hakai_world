// PREDATOR -> PREY -> RESOURCE emergent pressure (spec section 11/12). Cheap, evaluated
// on a slow cadence (not every frame) since it drives long-term migration, not motion.
import { WORLD } from '../config.js';
import { STATE } from './creature.js';

export function tickEcosystem(world, dt) {
  world.ecoT = (world.ecoT || 0) + dt;
  if (world.ecoT < 6) return;
  world.ecoT = 0;

  for (const c of world.creatures) {
    if (c.def.diet === 'predator' || c.def.flying) continue; // predators follow prey directly, not resource pressure
    const nearby = world.resources.filter((r) => Math.hypot(r.pos.x - c.home.x, r.pos.z - c.home.z) < c.territoryRadius);
    if (!nearby.length) continue;
    const avgAmount = nearby.reduce((s, r) => s + r.amount, 0) / nearby.length;
    const avgDanger = nearby.reduce((s, r) => s + r.dangerLevel, 0) / nearby.length;
    const stressed = avgAmount < 0.25 || avgDanger > 0.65;
    c.depletionStreak = stressed ? (c.depletionStreak || 0) + 1 : 0;

    if (c.depletionStreak > 3 && c.state !== STATE.MIGRATE) {
      const ang = world.rng() * Math.PI * 2;
      const r = 30 + world.rng() * WORLD.spawnRadius;
      c.migrateTarget = { x: Math.sin(ang) * r, z: Math.cos(ang) * r };
      c.state = STATE.MIGRATE; c.stateT = 0; c.depletionStreak = 0;
    }
  }
}

// Territory "field" for rendering — territorial/sentinel species mark ground around
// home rather than a UI overlay (section 12). Not a sim concern beyond exposing homes.
export function territoryHolders(world) {
  return world.creatures.filter((c) => c.def.profile === 'territorial' || c.def.profile === 'sentinel');
}
