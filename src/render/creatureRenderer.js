import * as THREE from 'three';
import { groundShadow } from './textures.js';

// AI-generated creature art is inconsistent, and Phase 9's visibility audit (see
// CREATURE_VISIBILITY_FIX notes) found the root cause of "HUD names a creature the
// player can't see": every source PNG is a fully-opaque RGBA rectangle (zero real
// alpha), and the old universal radial vignette only cleared the far corners, leaving
// a soft-edged "framed painting" floating in the world instead of an isolated creature.
//
// Fix: two real background-removal strategies, chosen per asset in config.js
// (SPECIES[key].backgroundMode), based on an actual pixel-level audit of all 13
// creature/boss images (dimensions, alpha histogram, corner colors) plus a visual
// check of real flood-fill output against each asset:
//   'chromaKey'  — asset has a genuinely flat/near-flat background (verified: solid
//                  color, low-noise studio backdrop). Flood-fills from the border
//                  using ONE fixed reference color (the median of all border pixels),
//                  so it can't leak through internal color gradients the way a
//                  neighbor-to-neighbor "magic wand" would (that approach was tried
//                  and rejected: it ate 93% of a test asset via soft brushstrokes).
//                  Also crops to the surviving silhouette's bounding box, which fixes
//                  the rendered aspect ratio to the actual character instead of the
//                  full illustration rectangle.
//   'masked'     — asset is a full "keyart" scene (its own background, action shot, or
//                  photoreal texture with no isolatable flat region) where chroma-key
//                  actively damages the character. Verified per-asset via real flood-
//                  fill output inspection, not assumed. Keeps the original radial
//                  vignette as the least-bad fallback for these.
const texCache = new Map();
const aspectCache = new Map(); // path -> width/height, filled once the image loads; instancing reads it

function medianBorderColor(data, width, height) {
  const rs = [], gs = [], bs = [];
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  };
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y++) { sample(0, y); sample(width - 1, y); }
  const mid = (arr) => { arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; };
  return [mid(rs), mid(gs), mid(bs)];
}

// Border-flood chroma-key: only propagates from pixels close (< tolerance) to the fixed
// global reference; pixels in [tolerance, 2*tolerance) get a soft partial alpha and do
// NOT propagate further (stops the flood at soft edges instead of leaking through them).
function chromaKeyToAlpha(imageData, tolerance = 30) {
  const { data, width, height } = imageData;
  const ref = medianBorderColor(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0, qTail = 0;
  const pushBorder = (x, y) => {
    const p = y * width + x;
    if (!visited[p]) { visited[p] = 1; queue[qTail++] = p; }
  };
  for (let x = 0; x < width; x++) { pushBorder(x, 0); pushBorder(x, height - 1); }
  for (let y = 0; y < height; y++) { pushBorder(0, y); pushBorder(width - 1, y); }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % width, y = (p / width) | 0;
    const i = p * 4;
    const dr = data[i] - ref[0], dg = data[i + 1] - ref[1], db = data[i + 2] - ref[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < tolerance) {
      data[i + 3] = 0;
      if (x > 0) { const np = p - 1; if (!visited[np]) { visited[np] = 1; queue[qTail++] = np; } }
      if (x < width - 1) { const np = p + 1; if (!visited[np]) { visited[np] = 1; queue[qTail++] = np; } }
      if (y > 0) { const np = p - width; if (!visited[np]) { visited[np] = 1; queue[qTail++] = np; } }
      if (y < height - 1) { const np = p + width; if (!visited[np]) { visited[np] = 1; queue[qTail++] = np; } }
    } else if (dist < tolerance * 2) {
      const t = (dist - tolerance) / tolerance;
      data[i + 3] = Math.round(255 * t);
    }
  }

}

// Separated from chromaKeyToAlpha so a second pass (applyEllipseTrim) can run on the
// alpha channel first, and the crop bbox reflects what's actually left visible.
function bboxFromAlpha(imageData) {
  const { data, width, height } = imageData;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 }; // degenerate, keep everything
  const pad = 4;
  return {
    minX: Math.max(0, minX - pad), minY: Math.max(0, minY - pad),
    maxX: Math.min(width - 1, maxX + pad), maxY: Math.min(height - 1, maxY + pad),
  };
}

// chromaKeyTrim: { cx, cy, r, yscale, core, edge } as fractions of the image (cx/cy/r)
// or ratios (yscale/core/edge). Multiplies the surviving alpha by an off-center ellipse
// fade -- see loadChromaKeyTexture for why this exists (hobgoblin_chief only, so far).
function applyEllipseTrim(imageData, trim) {
  const { data, width, height } = imageData;
  const cx = width * trim.cx, cy = height * trim.cy;
  const rBase = Math.min(width, height) * trim.r;
  for (let y = 0; y < height; y++) {
    const dy = (y - cy) / trim.yscale;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const d = Math.hypot(dx, dy) / rBase;
      let m = 1;
      if (d >= trim.edge) m = 0;
      else if (d > trim.core) m = 1 - (d - trim.core) / (trim.edge - trim.core);
      if (m < 1) {
        const i = (y * width + x) * 4 + 3;
        data[i] = Math.round(data[i] * m);
      }
    }
  }
}

function loadChromaKeyTexture(path, sprite, texture, chromaKeyTrim) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    chromaKeyToAlpha(imageData, 30);
    // Section 3 explicit per-asset override: some source paintings have a decorative
    // background splash (watercolor bleed, ink flourish) that sits close enough to the
    // parchment/backdrop color for a human eye to read as "background" but is walled
    // off from the canvas border by a darker outline, so the border-seeded flood fill
    // can never reach it -- it survives as a disconnected island no matter how far the
    // color tolerance is pushed. hobgoblin_chief is the only species with this defect
    // (found via live in-engine capture, not assumption). Rather than special-case the
    // algorithm per-pixel, fade an off-center ellipse over the *already chroma-keyed*
    // alpha as a second, independent pass -- multiplicative, so it only ever removes
    // more, never restores what chroma-key already correctly kept. Centered right of
    // frame-middle and wide enough that the sword and body survive at full opacity.
    if (chromaKeyTrim) applyEllipseTrim(imageData, chromaKeyTrim);
    const bbox = bboxFromAlpha(imageData);
    ctx.putImageData(imageData, 0, 0);

    const cropW = bbox.maxX - bbox.minX + 1, cropH = bbox.maxY - bbox.minY + 1;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    cropCanvas.getContext('2d').drawImage(canvas, bbox.minX, bbox.minY, cropW, cropH, 0, 0, cropW, cropH);

    texture.image = cropCanvas;
    texture.needsUpdate = true;
    const aspect = cropW / cropH;
    aspectCache.set(path, aspect);
    if (sprite) sprite.userData.aspect = aspect;
  };
  img.src = `assets/${path}`;
}

function loadRadialMaskedTexture(path, sprite, texture, maskCrop) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    // Section 3 explicit per-asset override: maskCrop is [x0,y0,x1,y1] as fractions
    // of the source image. Most masked-mode species are single-subject portraits
    // where a centered mask already isolates the creature; a few (pack_wolf) are
    // full keyart scenes where the subject only occupies part of the frame, and the
    // generic center mask would crop scenery (moon, trees) instead. When present,
    // draw only the cropped region into the canvas before masking, so the source
    // PNG on disk is untouched and every other species is unaffected.
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (maskCrop) {
      sx = maskCrop[0] * img.width;
      sy = maskCrop[1] * img.height;
      sw = (maskCrop[2] - maskCrop[0]) * img.width;
      sh = (maskCrop[3] - maskCrop[1]) * img.height;
    }
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.globalCompositeOperation = 'destination-in';
    // Tightened per the visibility audit: the original 0.72 opaque-radius stop barely
    // trimmed the corners, leaving exactly the "framed painting" look the spec calls
    // out. These 8 species have no usable flat background for chroma-key (keyart
    // scenes, close-up action shots, or a background that matches the creature's own
    // skin), so a mask is still the only option -- but it must actually read as a
    // creature silhouette, not a portrait in a box. Solid core ends at 0.40 of the
    // shorter dimension, fully transparent by 0.82, and the ellipse is stretched
    // taller than wide (creatures are portrait-framed, not circular).
    const cx = canvas.width / 2, cy = canvas.height * 0.46;
    const rBase = Math.min(canvas.width, canvas.height) * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 1.22);
    const g = ctx.createRadialGradient(0, 0, rBase * 0.12, 0, 0, rBase);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.40, 'rgba(255,255,255,1)');
    g.addColorStop(0.82, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-cx, -cy / 1.22, canvas.width * 2, canvas.height * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    texture.image = canvas;
    texture.needsUpdate = true;
    const aspect = canvas.width / canvas.height;
    aspectCache.set(path, aspect);
    if (sprite) sprite.userData.aspect = aspect;
  };
  img.src = `assets/${path}`;
}

// backgroundMode: 'chromaKey' | 'masked' (default), keyed per species in config.js.
// maskCrop (optional): [x0,y0,x1,y1] fractional crop applied before masking -- see
// loadRadialMaskedTexture for why pack_wolf is currently the only species that needs it.
export function loadCreatureTexture(path, backgroundMode, sprite, maskCrop, chromaKeyTrim) {
  const cacheKey = `${path}|${backgroundMode}|${maskCrop ? maskCrop.join(',') : ''}|${chromaKeyTrim ? 'trim' : ''}`;
  if (texCache.has(cacheKey)) return texCache.get(cacheKey);
  const placeholder = document.createElement('canvas');
  placeholder.width = placeholder.height = 4;
  const texture = new THREE.CanvasTexture(placeholder);
  texture.colorSpace = THREE.SRGBColorSpace;

  if (backgroundMode === 'chromaKey') loadChromaKeyTexture(path, sprite, texture, chromaKeyTrim);
  else loadRadialMaskedTexture(path, sprite, texture, maskCrop);

  texCache.set(cacheKey, texture);
  return texture;
}

// Back-compat alias: some callers only have the path (no backgroundMode lookup handy).
// Defaults to the original universal radial mask.
export function loadMaskedTexture(path, sprite) {
  return loadCreatureTexture(path, 'masked', sprite);
}

// Cached aspect ratio for a species texture, or 1 (square, corrected once the real image
// loads and instancing recomputes matrices next frame) if not loaded yet.
export function getAspect(path) {
  return aspectCache.get(path) || 1;
}

export function buildCreatureVisual(scene, entity, heightAt) {
  const spriteMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: true });
  const sprite = new THREE.Sprite(spriteMat);
  const s = entity.def.scale;
  sprite.scale.set(s, s, 1);
  sprite.userData.baseScale = s;
  spriteMat.map = loadCreatureTexture(entity.def.file, entity.def.backgroundMode, sprite, entity.def.maskCrop, entity.def.chromaKeyTrim);
  scene.add(sprite);

  const shadowGeo = new THREE.CircleGeometry(s * 0.42, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ map: groundShadow, transparent: true, depthWrite: false, opacity: entity.def.shadowOpacity ?? 1 });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  scene.add(shadow);

  return { sprite, shadow, heightAt };
}

export function updateCreatureVisual(vis, entity) {
  const aspect = vis.sprite.userData.aspect;
  if (aspect && !vis.sprite.userData.scaled) {
    const s = vis.sprite.userData.baseScale;
    vis.sprite.scale.set(aspect >= 1 ? s : s * aspect, aspect >= 1 ? s / aspect : s, 1);
    vis.sprite.userData.scaled = true;
  }

  const groundY = vis.heightAt(entity.pos.x, entity.pos.z);
  const flying = entity.def.flying;
  const vOffset = entity.def.verticalOffset ?? 0;
  const bobAmp = entity.state === 'CHASE' || entity.state === 'FLEE' ? 0.22 : 0.12;
  const bobY = Math.sin(entity.bob * (entity.state === 'FLEE' ? 3.2 : 2)) * (flying ? 1.4 : bobAmp);
  const halfHeight = vis.sprite.scale.y / 2;
  const baseY = flying ? groundY + 18 + Math.sin(entity.bob * 0.3) * 4 : groundY + halfHeight * 0.9 + vOffset;
  vis.sprite.position.set(entity.pos.x, baseY + bobY, entity.pos.z);
  vis.shadow.position.set(entity.pos.x, groundY + 0.03, entity.pos.z);
  const alive = entity.state !== 'SLEEP' ? 1 : 0.9;
  vis.sprite.material.opacity = alive;
  const isActive = entity.state === 'CHASE' || entity.state === 'COMBAT';
  vis.sprite.material.color.setHex(isActive ? 0xffcbb0 : 0xffffff);
  const shadowBase = entity.def.shadowScale ?? 1;
  const shadowScale = flying ? Math.max(0.3, 1 - (baseY - groundY) / 40) * shadowBase : shadowBase;
  vis.shadow.scale.setScalar(shadowScale);
}

export function disposeCreatureVisual(scene, vis) {
  scene.remove(vis.sprite, vis.shadow);
  vis.sprite.material.dispose();
  vis.shadow.material.dispose();
  vis.shadow.geometry.dispose();
}
