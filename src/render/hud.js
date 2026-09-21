import { clockString } from '../sim/dayNight.js';

const els = {};
function q(id) { return els[id] || (els[id] = document.getElementById(id)); }

export function updateHud(world, nearestUndiscovered) {
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
