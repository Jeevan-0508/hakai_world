// HAKAI // WORLD — world config, palette, asset manifest.
// Assets are static AI-generated 2D PNGs (transparent cutouts for creatures/bosses),
// so Phase 1 uses a 2.5D approach: 3D terrain/lighting/fog + billboard sprites.

export const PALETTE = {
  voidBlack: 0x05030a,
  emberDeep: 0x2a0c08,
  emberMid: 0xc94b30,
  emberBright: 0xff8a3d,
  boneGlow: 0xe8c9a0,
  riftViolet: 0x6b3fa0, // sparing accent, ties back to existing HAKAI brand art
  sickGreen: 0x2f6b4a,  // bioluminescence at night
  skyDay: 0x2a1410,
  skyNight: 0x03020a,
};

export const WORLD = {
  seed: 108420,
  size: 480,            // terrain footprint (units)
  segments: 140,
  dayLengthSec: 180,     // full day/night cycle, fast enough to observe
  spawnRadius: 170,
};

// Creature roster: species metadata driving both sim (behavior profile) and
// render (billboard sprite + scale). habitat/behaviorProfile chosen per spec section 8/9.
export const SPECIES = {
  goblin_scout:      { file: 'creatures/goblin_scout.png',      tier: 'common', profile: 'skittish',  scale: 2.2, speed: 2.6, diet: 'prey',     nocturnal: false },
  pack_wolf:         { file: 'creatures/pack_wolf.png',         tier: 'common', profile: 'pack',      scale: 2.0, speed: 3.4, diet: 'predator', nocturnal: false },
  direwolf_alpha:    { file: 'creatures/direwolf_alpha.png',    tier: 'common', profile: 'pack',      scale: 2.6, speed: 3.6, diet: 'predator', nocturnal: false },
  elder_direwolf:    { file: 'creatures/elder_direwolf.png',    tier: 'common', profile: 'territorial',scale: 3.0, speed: 2.2, diet: 'predator', nocturnal: false },
  lizardman_shaman:  { file: 'creatures/lizardman_shaman.png',  tier: 'common', profile: 'sentinel',  scale: 2.4, speed: 1.6, diet: 'omnivore',  nocturnal: false },
  insectoid_general: { file: 'creatures/insectoid_general.png', tier: 'common', profile: 'patrol',    scale: 3.2, speed: 2.0, diet: 'predator',  nocturnal: false },
  hobgoblin_chief:   { file: 'creatures/hobgoblin_chief.png',   tier: 'common', profile: 'territorial',scale: 2.8, speed: 1.8, diet: 'omnivore',  nocturnal: false },
  demon_knight:      { file: 'creatures/demon_knight.png',      tier: 'common', profile: 'sentinel',  scale: 3.0, speed: 1.4, diet: 'predator',  nocturnal: false },
  cryptid_stalker:   { file: 'creatures/cryptid_stalker.png',   tier: 'common', profile: 'stalker',   scale: 2.4, speed: 2.8, diet: 'predator',  nocturnal: true },
  void_cryptid:      { file: 'creatures/void_cryptid.png',      tier: 'common', profile: 'stalker',   scale: 2.6, speed: 2.4, diet: 'predator',  nocturnal: true },
  archangel:         { file: 'creatures/archangel.png',        tier: 'common', profile: 'flyer',     scale: 5.0, speed: 4.0, diet: 'wanderer',  nocturnal: false, flying: true },
  primordial_demon:  { file: 'creatures/primordial_demon.png',  tier: 'elite',  profile: 'territorial',scale: 4.4, speed: 2.0, diet: 'predator',  nocturnal: false },
};

export const BOSS = {
  boss_kragath: { file: 'bosses/boss_kragath.png', scale: 9.5, speed: 1.1 },
};
