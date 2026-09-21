// Real environmental cycle — section 11. Drives lighting/ambience/creature nocturnal flag.
import { WORLD } from '../config.js';

export function makeDayNight() {
  return { t: 0.28, isNight: false }; // start mid-morning
}

export function tickDayNight(dn, dt) {
  dn.t = (dn.t + dt / WORLD.dayLengthSec) % 1;
  dn.isNight = dn.t > 0.55 && dn.t < 0.97;
}

export function clockString(dn) {
  const hrs = (dn.t * 24);
  const h = Math.floor(hrs).toString().padStart(2, '0');
  const m = Math.floor((hrs % 1) * 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
