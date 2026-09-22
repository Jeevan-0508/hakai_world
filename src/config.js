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
// CreatureVisualProfile fields (Phase 9 visibility fix), extending this same registry
// instead of a parallel one per the spec's 'do not duplicate unnecessarily' rule:
//   backgroundMode      -- 'chromaKey' (real flat background, verified via actual pixel
//                          audit + flood-fill visual inspection of all 13 source PNGs) or
//                          'masked' (busy/scene/photoreal art where chroma-key would eat
//                          the character -- keeps the old radial-vignette fallback).
//   visibilityDistance  -- world units at which the billboard is drawn at all (LOD).
//   discoveryDistance   -- world units within which [E] can name this species, but only
//                          once it also passes the on-screen/in-front-of-camera test in
//                          main.js (section 6/7 -- proximity alone is no longer enough).
// facingMode is deliberately NOT a per-species field: every source asset is a frontal or
// three-quarter illustrated portrait (verified during the same visual audit), not a
// side-view sprite, so camera-facing billboarding (the existing behavior) is correct for
// all of them -- flipping to face movement direction would visibly mismatch the art.
export const SPECIES = {
  goblin_scout:      { file: 'creatures/goblin_scout.png',      tier: 'common', profile: 'skittish',  scale: 2.2, speed: 2.6, diet: 'prey',     nocturnal: false, backgroundMode: 'masked',    visibilityDistance: 130, discoveryDistance: 10 },
  pack_wolf:         { file: 'creatures/pack_wolf.png',         tier: 'common', profile: 'pack',      scale: 2.0, speed: 3.4, diet: 'predator', nocturnal: false, backgroundMode: 'masked',    visibilityDistance: 150, discoveryDistance: 12,
    // Section 3 explicit per-asset override: the source art is a full keyart scene
    // (three wolves + moon + forest canopy), not a single-subject portrait, so the
    // generic centered mask crops moon/trees instead of isolating the pack. Crop to
    // the bottom 58% of the source first (fractions of [x0,y0,x1,y1]) where the wolves
    // actually are, before the radial mask runs on the cropped region -- verified
    // against the real asset, this is the only species that needed it.
    maskCrop: [0, 0.42, 1, 1] },
  direwolf_alpha:    { file: 'creatures/direwolf_alpha.png',    tier: 'common', profile: 'pack',      scale: 2.6, speed: 3.6, diet: 'predator', nocturnal: false, backgroundMode: 'masked',    visibilityDistance: 160, discoveryDistance: 13 },
  elder_direwolf:    { file: 'creatures/elder_direwolf.png',    tier: 'common', profile: 'territorial',scale: 3.0, speed: 2.2, diet: 'predator', nocturnal: false, backgroundMode: 'masked',    visibilityDistance: 170, discoveryDistance: 14 },
  lizardman_shaman:  { file: 'creatures/lizardman_shaman.png',  tier: 'common', profile: 'sentinel',  scale: 2.4, speed: 1.6, diet: 'omnivore',  nocturnal: false, backgroundMode: 'chromaKey', visibilityDistance: 160, discoveryDistance: 13 },
  insectoid_general: { file: 'creatures/insectoid_general.png', tier: 'common', profile: 'patrol',    scale: 3.2, speed: 2.0, diet: 'predator',  nocturnal: false, backgroundMode: 'chromaKey', visibilityDistance: 190, discoveryDistance: 15 },
  hobgoblin_chief:   { file: 'creatures/hobgoblin_chief.png',   tier: 'common', profile: 'territorial',scale: 2.8, speed: 1.8, diet: 'omnivore',  nocturnal: false, backgroundMode: 'chromaKey', visibilityDistance: 190, discoveryDistance: 15,
    // Section 3 explicit per-asset override: this portrait has a decorative watercolor
    // splash walled off from the canvas border by a darker outline, so border-seeded
    // chroma-key alone can never reach it (confirmed via live in-engine capture, not
    // assumption -- see loadChromaKeyTexture). A second off-center ellipse fade cleans
    // it up without touching the sword or body.
    chromaKeyTrim: { cx: 0.48, cy: 0.48, r: 0.72, yscale: 1.05, core: 0.55, edge: 0.95 } },
  demon_knight:      { file: 'creatures/demon_knight.png',      tier: 'common', profile: 'sentinel',  scale: 3.0, speed: 1.4, diet: 'predator',  nocturnal: false, backgroundMode: 'chromaKey', visibilityDistance: 200, discoveryDistance: 16 },
  cryptid_stalker:   { file: 'creatures/cryptid_stalker.png',   tier: 'common', profile: 'stalker',   scale: 2.4, speed: 2.8, diet: 'predator',  nocturnal: true,  backgroundMode: 'masked',    visibilityDistance: 140, discoveryDistance: 11 },
  void_cryptid:      { file: 'creatures/void_cryptid.png',      tier: 'common', profile: 'stalker',   scale: 2.6, speed: 2.4, diet: 'predator',  nocturnal: true,  backgroundMode: 'masked',    visibilityDistance: 140, discoveryDistance: 11 },
  archangel:         { file: 'creatures/archangel.png',        tier: 'common', profile: 'flyer',     scale: 5.0, speed: 4.0, diet: 'wanderer',  nocturnal: false, flying: true, backgroundMode: 'masked', visibilityDistance: 260, discoveryDistance: 22 },
  primordial_demon:  { file: 'creatures/primordial_demon.png',  tier: 'elite',  profile: 'territorial',scale: 4.4, speed: 2.0, diet: 'predator',  nocturnal: false, backgroundMode: 'chromaKey', visibilityDistance: 230, discoveryDistance: 20 },
};

export const BOSS = {
  boss_kragath: { file: 'bosses/boss_kragath.png', scale: 9.5, speed: 1.1, backgroundMode: 'masked', visibilityDistance: 320, discoveryDistance: 26 },
};
