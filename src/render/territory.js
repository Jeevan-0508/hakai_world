import * as THREE from 'three';
import { PALETTE } from '../config.js';

// Territory ground cues (spec section 12) — subtle textured decals under territorial/sentinel
// creatures' homes, NOT giant colored circles. Low opacity, soft radial falloff, species-tinted.
function decalTexture(colorHex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(colorHex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},0.55)`);
  g.addColorStop(0.55, `rgba(${rgb},0.22)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // faint cracked-ground streaks so it reads as terrain wear, not a UI marker.
  ctx.strokeStyle = `rgba(${rgb},0.3)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const a = (i / 6) * Math.PI * 2;
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(a) * (30 + Math.random() * 30), 64 + Math.sin(a) * (30 + Math.random() * 30));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function tintFor(profile) {
  return profile === 'sentinel' ? PALETTE.riftViolet : PALETTE.emberMid;
}

export function buildTerritoryVisuals(scene, holders, heightAt) {
  const group = new THREE.Group();
  scene.add(group);
  const decals = holders.map((c) => {
    const y = heightAt(c.home.x, c.home.z) + 0.03;
    const geo = new THREE.CircleGeometry(c.territoryRadius, 24);
    const mat = new THREE.MeshBasicMaterial({
      map: decalTexture(tintFor(c.def.profile)), transparent: true, depthWrite: false, opacity: 0.16,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(c.home.x, y, c.home.z);
    group.add(mesh);
    return mesh;
  });
  return { group, decals };
}
