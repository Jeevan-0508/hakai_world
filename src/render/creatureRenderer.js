import * as THREE from 'three';
import { groundShadow } from './textures.js';

// AI-generated creature art is inconsistent: some PNGs are transparent cutouts,
// some (bosses) are full rectangular illustrations with a dark background. Section 19
// says creatures must not look like floating assets pasted onto the map, so every
// texture gets a soft radial alpha mask (fades true edges to 0) regardless of source,
// and the sprite is rescaled to the image's real aspect ratio once it loads.
const texCache = new Map();
const aspectCache = new Map(); // path -> width/height, filled once the image loads; Phase 7 instancing reads it
export function loadMaskedTexture(path, sprite) {
  if (texCache.has(path)) return texCache.get(path);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    const cx = canvas.width / 2, cy = canvas.height * 0.52;
    const r = Math.max(canvas.width, canvas.height) * 0.58;
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.72, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    texture.needsUpdate = true;
    const aspect = img.width / img.height;
    aspectCache.set(path, aspect);
    if (sprite) sprite.userData.aspect = aspect;
  };
  img.src = `assets/${path}`;

  texCache.set(path, texture);
  return texture;
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
  spriteMat.map = loadMaskedTexture(entity.def.file, sprite);
  scene.add(sprite);

  const shadowGeo = new THREE.CircleGeometry(s * 0.42, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ map: groundShadow, transparent: true, depthWrite: false });
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
  const bobY = Math.sin(entity.bob * 2) * (flying ? 1.4 : 0.12);
  const halfHeight = vis.sprite.scale.y / 2;
  const baseY = flying ? groundY + 18 + Math.sin(entity.bob * 0.3) * 4 : groundY + halfHeight * 0.9;
  vis.sprite.position.set(entity.pos.x, baseY + bobY, entity.pos.z);
  vis.shadow.position.set(entity.pos.x, groundY + 0.03, entity.pos.z);
  const alive = entity.state !== 'SLEEP' ? 1 : 0.9;
  vis.sprite.material.opacity = alive;
  const isActive = entity.state === 'CHASE' || entity.state === 'COMBAT';
  vis.sprite.material.color.setHex(isActive ? 0xffcbb0 : 0xffffff);
  const shadowScale = flying ? Math.max(0.3, 1 - (baseY - groundY) / 40) : 1;
  vis.shadow.scale.setScalar(shadowScale);
}

export function disposeCreatureVisual(scene, vis) {
  scene.remove(vis.sprite, vis.shadow);
  vis.sprite.material.dispose();
  vis.shadow.material.dispose();
  vis.shadow.geometry.dispose();
}
