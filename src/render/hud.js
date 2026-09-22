import { clockString } from '../sim/dayNight.js';

const els = {};
function q(id) { return els[id] || (els[id] = document.getElementById(id)); }

// nearestUndiscovered: onscreen + close enough to actually name (real discovery target).
// sensed: nearby but off-screen/behind the player -- undiscovered, so the HUD may only
// hint that *something* is out there (a direction), never a species name. This is the
// section 8 rule: naming requires the player to have actually turned toward the creature.
export function updateHud(world, nearestUndiscovered, sensed) {
  q('clock').textContent = clockString(world.dayNight);
  q('weather-label').textContent = world.weather.state.toUpperCase();

  const banner = q('event-banner');
  if (world.events.active) {
    banner.textContent = world.events.active.label;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  const prompt = q('prompt');
  if (nearestUndiscovered) prompt.classList.remove('hidden');
  else prompt.classList.add('hidden');

  const senseEl = q('sense-indicator');
  if (!nearestUndiscovered && sensed) {
    senseEl.classList.remove('hidden');
    q('sense-arrow').style.transform = `rotate(${sensed.angleDeg}deg)`;
  } else {
    senseEl.classList.add('hidden');
  }
}

let discoveryTimer = null;
export function showDiscovery(speciesLabel) {
  const el = q('discovery');
  q('discovery-species').textContent = speciesLabel.toUpperCase().replace(/_/g, ' ');
  el.classList.remove('hidden');
  clearTimeout(discoveryTimer);
  discoveryTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

export function updateDebug(info) {
  q('debug').textContent = info;
}
