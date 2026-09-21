// Versioned localStorage persistence — section 28. Corruption never breaks the app.
const KEY = 'hakai_world_save_v1';
const VERSION = 1;

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data.version !== VERSION) return {};
    return data;
  } catch {
    return {};
  }
}

export function writeSave(world) {
  try {
    const data = {
      version: VERSION,
      seed: 108420,
      playerPos: world.player.pos,
      playerYaw: world.player.yaw,
      discoveredSpecies: Array.from(world.discoveredSpecies),
      discoveredLocations: Array.from(world.discoveredLocations),
      lastVisit: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable/full — fail silently, never crash the world
  }
}
