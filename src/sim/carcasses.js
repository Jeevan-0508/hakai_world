// Carcasses (spec section 11/12 continued) — a death (starvation, eventually combat) leaves
// a temporary resource for predators/omnivores, closing the loop the other direction: death
// feeds the living instead of just vanishing. Decays and disappears on its own if unclaimed.
const LIFESPAN = 90;      // seconds before a carcass rots away entirely, claimed or not
const START_AMOUNT = 0.7; // smaller than a live resource node — a body isn't a pasture

export function spawnCarcass(world, pos, speciesKey) {
  world.carcasses = world.carcasses || [];
  world.carcasses.push({
    id: `carcass_${world.nextCarcassId = (world.nextCarcassId || 0) + 1}`,
    species: speciesKey,
    pos: { x: pos.x, z: pos.z },
    amount: START_AMOUNT,
    max: START_AMOUNT,
    age: 0,
  });
}

export function tickCarcasses(world, dt) {
  if (!world.carcasses || !world.carcasses.length) return;
  for (const c of world.carcasses) c.age += dt;
  world.carcasses = world.carcasses.filter((c) => c.age < LIFESPAN && c.amount > 0.02);
}

// Only predators/omnivores scavenge; a fresh-enough carcass within range and not already
// picked clean. Closer + fresher wins (no danger-avoidance here — carrion draws them in).
export function nearestCarcass(pos, carcasses, range) {
  let best = null, bestScore = Infinity;
  for (const c of carcasses || []) {
    const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
    if (d > range) continue;
    const score = d - c.amount * 6;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}
