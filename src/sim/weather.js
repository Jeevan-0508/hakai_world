// Lightweight weather states — section 12. No physical simulation, just target params.
export const WEATHER_STATES = ['clear', 'fog', 'emberstorm', 'voidcalm'];

export function makeWeather(rng) {
  return { state: 'clear', t: 0, next: 30 + rng() * 40, rng };
}

export function tickWeather(w, dt) {
  w.t += dt;
  if (w.t > w.next) {
    w.t = 0; w.next = 40 + w.rng() * 60;
    const pool = WEATHER_STATES.filter((s) => s !== w.state);
    w.state = pool[Math.floor(w.rng() * pool.length)];
  }
}
