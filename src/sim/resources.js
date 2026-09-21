// Resource layer for the PREDATOR -> PREY -> RESOURCE loop (spec section 11).
// A resource node is a patch of grazeable ground (glowing flora/fungus/embers).
// Herbivores/omnivores deplete it; it regrows slowly; depletion drives migration.
import { WORLD } from '../config.js';
import { makeRng } from './rng.js';

export function makeResources(rng) {
  const nodes = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 20 + rng() * (WORLD.spawnRadius * 0.9);
    nodes.push({
      id: i,
      pos: { x: Math.sin(ang) * r, z: Math.cos(ang) * r },
      amount: 1, max: 1,
      regen: 0.015 + rng() * 0.01,
      dangerLevel: 0, // rises with nearby predator presence, decays otherwise
    });
  }
  return nodes;
}

export function tickResources(resources, dt, creatures) {
  // Predator pressure per node (cheap O(nodes*creatures), fine at this entity count).
  for (const node of resources) {
    node.amount = Math.min(node.max, node.amount + node.regen * dt);
    let predatorNear = 0;
    for (const c of creatures) {
      const d = Math.hypot(c.pos.x - node.pos.x, c.pos.z - node.pos.z);
      if (d < 30 && c.def.diet === 'predator') predatorNear++;
    }
    const targetDanger = Math.min(1, predatorNear / 3);
    node.dangerLevel += (targetDanger - node.dangerLevel) * Math.min(1, dt * 0.3);
  }
}

export function nearestResource(pos, resources, { avoidDanger = false } = {}) {
  let best = null, bestScore = Infinity;
  for (const node of resources) {
    if (node.amount < 0.15) continue;
    if (avoidDanger && node.dangerLevel > 0.6) continue;
    const d = Math.hypot(node.pos.x - pos.x, node.pos.z - pos.z);
    const score = d + node.dangerLevel * 40;
    if (score < bestScore) { bestScore = score; best = node; }
  }
  return best;
}
