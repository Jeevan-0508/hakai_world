import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { softGlow } from './textures.js';

// Carcass visuals — a dark, sunken, guttering shape (not a body model; matches the
// low-poly-suggestion style of resources.js). Shrinks and dims as it's picked clean/rots.
export function buildCarcassVisual(scene, carcass, heightAt) {
  const y = heightAt(carcass.pos.x, carcass.pos.z);
  const group = new THREE.Group();
  group.position.set(carcass.pos.x, y, carcass.pos.z);

  const mat = new THREE.MeshStandardMaterial({ color: 0x1c0f0c, roughness: 0.95, emissive: new THREE.Color(PALETTE.emberDeep), emissiveIntensity: 0.4 });
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mat);
  mound.scale.set(1.3, 0.45, 1);
  mound.position.y = 0.3;
  group.add(mound);

  const glowMat = new THREE.SpriteMaterial({ map: softGlow, color: 0x8a2f18, transparent: true, depthWrite: false, opacity: 0.3, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(1.6, 1.6, 1);
  glow.position.y = 0.25;
  group.add(glow);

  scene.add(group);
  return { carcass, group, mound, glow, mat };
}

export function updateCarcassVisual(vis) {
  const t = Math.max(0.08, vis.carcass.amount / vis.carcass.max);
  vis.group.scale.setScalar(0.5 + t * 0.5);
  vis.glow.material.opacity = 0.1 + t * 0.25;
}

export function disposeCarcassVisual(scene, vis) {
  scene.remove(vis.group);
  vis.mat.dispose();
  vis.mound.geometry.dispose();
  vis.glow.material.dispose();
}
