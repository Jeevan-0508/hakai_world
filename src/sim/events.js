// Rare world events — section 13. Temporarily changes the world, not constant.
const EVENTS = [
  { id: 'red_moon', label: 'THE RED MOON', desc: 'A HAKAI entity has awakened.' },
  { id: 'bio_shift', label: 'BIOLOGICAL SHIFT', desc: 'Mutation levels rising.' },
  { id: 'void_storm', label: 'VOID STORM', desc: 'Environmental instability detected.' },
];

export function makeEvents(rng) {
  return { active: null, t: 0, cooldown: 90 + rng() * 60, rng };
}

export function tickEvents(ev, dt) {
  if (ev.active) {
    ev.t += dt;
    if (ev.t > ev.active.duration) { ev.active = null; ev.t = 0; ev.cooldown = 100 + ev.rng() * 120; }
    return;
  }
  ev.cooldown -= dt;
  if (ev.cooldown <= 0) {
    const base = EVENTS[Math.floor(ev.rng() * EVENTS.length)];
    ev.active = { ...base, duration: 45 + ev.rng() * 30 };
    ev.t = 0;
  }
}

export function triggerEvent(ev, id) {
  const base = EVENTS.find((e) => e.id === id) || EVENTS[0];
  ev.active = { ...base, duration: 45 };
  ev.t = 0;
}
