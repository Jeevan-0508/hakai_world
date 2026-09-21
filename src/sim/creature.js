// Creature FSM — section 8/9/10/11 of spec. Lightweight, per-profile behavior, no rendering here.
import { nearestResource } from './resources.js';

export const STATE = {
  IDLE: 'IDLE', WANDER: 'WANDER', OBSERVE: 'OBSERVE', INVESTIGATE: 'INVESTIGATE',
  CHASE: 'CHASE', FLEE: 'FLEE', COMBAT: 'COMBAT', RETREAT: 'RETREAT', RECOVER: 'RECOVER',
  SLEEP: 'SLEEP', PATROL: 'PATROL', GATHER: 'GATHER', MIGRATE: 'MIGRATE',
};

let nextId = 1;

export function spawnCreature(speciesKey, species, pos, rng) {
  return {
    id: nextId++,
    species: speciesKey,
    def: species,
    pos: { x: pos.x, y: 0, z: pos.z },
    home: { x: pos.x, z: pos.z },
    heading: rng() * Math.PI * 2,
    state: species.nocturnal ? STATE.SLEEP : STATE.IDLE,
    stateT: 0,
    energy: 0.6 + rng() * 0.4,
    perceptionRange: species.profile === 'stalker' ? 42 : 26,
    territoryRadius: species.profile === 'territorial' ? 22 : 60,
    discovered: false,
    bob: rng() * Math.PI * 2,
    alive: true,
    depletionStreak: 0,
    patrolIndex: 0,
    patrolPoints: species.profile === 'patrol' ? makePatrolLoop(pos, rng) : null,
    gatherNode: null,
    migrateTarget: null,
  };
}

function makePatrolLoop(home, rng) {
  const pts = [];
  const n = 4;
  const r = 18 + rng() * 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: home.x + Math.sin(a) * r, z: home.z + Math.cos(a) * r });
  }
  return pts;
}

const WANDER_SPEED_MULT = { skittish: 1.0, pack: 1.0, territorial: 0.6, sentinel: 0.4, patrol: 0.8, stalker: 0.9, flyer: 1.2 };
const CAN_FORAGE = (def) => (def.diet === 'prey' || def.diet === 'omnivore') && !def.flying;

export function tickCreature(c, dt, world, rng) {
  c.stateT += dt;
  c.bob += dt;
  const distFromHome = Math.hypot(c.pos.x - c.home.x, c.pos.z - c.home.z);
  const playerDist = Math.hypot(c.pos.x - world.player.pos.x, c.pos.z - world.player.pos.z);
  const isNight = world.dayNight.isNight;
  const shouldSleep = c.def.nocturnal ? !isNight : (isNight && c.def.profile !== 'stalker' && rng() < 0.0003);

  // Global transitions
  if (shouldSleep && c.state !== STATE.SLEEP && c.state !== STATE.COMBAT) {
    c.state = STATE.SLEEP; c.stateT = 0;
  } else if (!shouldSleep && c.state === STATE.SLEEP) {
    c.state = STATE.IDLE; c.stateT = 0;
  }

  if (c.state !== STATE.SLEEP && c.state !== STATE.MIGRATE) {
    if (playerDist < c.perceptionRange && c.state !== STATE.CHASE && c.state !== STATE.FLEE) {
      c.state = (c.def.diet === 'predator' && c.def.profile !== 'sentinel') ? STATE.INVESTIGATE
              : (c.def.profile === 'skittish' ? STATE.FLEE : STATE.OBSERVE);
      c.stateT = 0;
    }
    if (playerDist > c.perceptionRange * 1.8 && (c.state === STATE.FLEE || c.state === STATE.CHASE || c.state === STATE.OBSERVE)) {
      c.state = c.def.profile === 'patrol' ? STATE.PATROL : STATE.WANDER; c.stateT = 0;
    }
  }

  const mult = WANDER_SPEED_MULT[c.def.profile] || 0.8;
  let speed = 0;
  switch (c.state) {
    case STATE.SLEEP:
      break;
    case STATE.IDLE:
      if (CAN_FORAGE(c.def) && c.energy < 0.75 && rng() < 0.01) {
        const node = nearestResource(c.pos, world.resources, { avoidDanger: true });
        if (node) { c.gatherNode = node; c.state = STATE.GATHER; c.stateT = 0; break; }
      }
      if (c.stateT > 2 + rng() * 3) {
        c.state = c.def.profile === 'patrol' ? STATE.PATROL : STATE.WANDER;
        c.stateT = 0; c.heading = rng() * Math.PI * 2;
      }
      break;
    case STATE.WANDER:
      speed = c.def.speed * mult * 0.35;
      if (distFromHome > c.territoryRadius) {
        c.heading = Math.atan2(c.home.x - c.pos.x, c.home.z - c.pos.z);
      } else if (c.stateT > 4 + rng() * 4) {
        c.heading += (rng() - 0.5) * 1.4; c.stateT = 0;
      }
      if (rng() < 0.002) { c.state = STATE.IDLE; c.stateT = 0; }
      break;
    case STATE.PATROL: {
      const wp = c.patrolPoints[c.patrolIndex];
      speed = c.def.speed * mult * 0.5;
      c.heading = Math.atan2(wp.x - c.pos.x, wp.z - c.pos.z);
      if (Math.hypot(wp.x - c.pos.x, wp.z - c.pos.z) < 2) c.patrolIndex = (c.patrolIndex + 1) % c.patrolPoints.length;
      break;
    }
    case STATE.GATHER: {
      const node = c.gatherNode;
      if (!node || node.amount < 0.05 || node.dangerLevel > 0.7) { c.state = STATE.WANDER; c.stateT = 0; c.gatherNode = null; break; }
      const d = Math.hypot(node.pos.x - c.pos.x, node.pos.z - c.pos.z);
      if (d > 1.5) { speed = c.def.speed * mult * 0.6; c.heading = Math.atan2(node.pos.x - c.pos.x, node.pos.z - c.pos.z); }
      else {
        node.amount = Math.max(0, node.amount - dt * 0.06);
        c.energy = Math.min(1, c.energy + dt * 0.09);
        if (c.stateT > 5 || c.energy > 0.95) { c.state = STATE.WANDER; c.stateT = 0; c.gatherNode = null; }
      }
      break;
    }
    case STATE.MIGRATE: {
      const t = c.migrateTarget;
      speed = c.def.speed * mult * 0.7;
      c.heading = Math.atan2(t.x - c.pos.x, t.z - c.pos.z);
      if (Math.hypot(t.x - c.pos.x, t.z - c.pos.z) < 4) {
        c.home = { x: t.x, z: t.z }; c.migrateTarget = null; c.state = STATE.IDLE; c.stateT = 0;
      }
      break;
    }
    case STATE.OBSERVE:
      c.heading = Math.atan2(world.player.pos.x - c.pos.x, world.player.pos.z - c.pos.z);
      if (c.stateT > 3) { c.state = STATE.WANDER; c.stateT = 0; }
      break;
    case STATE.INVESTIGATE:
      speed = c.def.speed * mult * 0.5;
      c.heading = Math.atan2(world.player.pos.x - c.pos.x, world.player.pos.z - c.pos.z);
      if (playerDist < c.perceptionRange * 0.5 && c.def.diet === 'predator') { c.state = STATE.CHASE; c.stateT = 0; }
      break;
    case STATE.CHASE:
      speed = c.def.speed;
      c.heading = Math.atan2(world.player.pos.x - c.pos.x, world.player.pos.z - c.pos.z);
      if (playerDist < 4.5) { c.state = STATE.COMBAT; c.stateT = 0; }
      if (distFromHome > c.territoryRadius * 1.4) { c.state = STATE.RETREAT; c.stateT = 0; }
      break;
    case STATE.FLEE:
      speed = c.def.speed * 1.1;
      c.heading = Math.atan2(c.pos.x - world.player.pos.x, c.pos.z - world.player.pos.z);
      break;
    case STATE.COMBAT:
      c.energy -= dt * 0.08;
      if (c.stateT > 2.5 || c.energy < 0.2) { c.state = STATE.RETREAT; c.stateT = 0; }
      break;
    case STATE.RETREAT:
      speed = c.def.speed * 0.8;
      c.heading = Math.atan2(c.home.x - c.pos.x, c.home.z - c.pos.z);
      if (distFromHome < 4) { c.state = STATE.RECOVER; c.stateT = 0; }
      break;
    case STATE.RECOVER:
      c.energy = Math.min(1, c.energy + dt * 0.1);
      if (c.energy > 0.8) { c.state = STATE.IDLE; c.stateT = 0; }
      break;
  }

  if (speed > 0) {
    c.pos.x += Math.sin(c.heading) * speed * dt;
    c.pos.z += Math.cos(c.heading) * speed * dt;
  }
}
