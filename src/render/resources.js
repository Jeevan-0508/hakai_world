import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { softGlow } from './textures.js';

// Grazeable resource nodes (spec section 7/11) — glowing flora/fungus/ember clusters, not
// a UI marker. Amount drives visual scale + glow so depletion/regrowth is readable at a glance.
export function buildResourceVisuals(scene, resources, heightAt) {
  const group = new THREE.Group();
  scene.add(group);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a10, roughness: 0.75, emissive: new THREE.Color(PALETTE.emberBright), emissiveIntensity: 0.9,
  });
  const glowMat = new THREE.SpriteMaterial({ map: softGlow, color: 0xff8a3c, transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending });

  const visuals = resources.map((node) => {
    const y = heightAt(node.pos.x, node.pos.z);
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(node.pos.x, y, node.pos.z);

    // A small irregular cluster of glowing crystal/fungus shards standing in for flora.
    const shardCount = 4;
    const shards = [];
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2 + Math.random() * 0.6;
      const h = 0.6 + Math.random() * 0.7;
      const geo = new THREE.ConeGeometry(0.22, h, 5);
      const mesh = new THREE.Mesh(geo, coreMat);
      mesh.position.set(Math.sin(a) * 0.4, h / 2, Math.cos(a) * 0.4);
      mesh.rotation.z = (Math.random() - 0.5) * 0.3;
      nodeGroup.add(mesh);
      shards.push(mesh);
    }

    const glow = new THREE.Sprite(glowMat.clone());
    glow.scale.set(2.4, 2.4, 1);
    glow.position.y = 0.7;
    nodeGroup.add(glow);

    group.add(nodeGroup);
    return { node, nodeGroup, shards, glow };
  });

  return { group, visuals };
}

export function updateResourceVisuals(vis) {
  for (const v of vis.visuals) {
    const scale = 0.35 + v.node.amount * 0.65;
    v.nodeGroup.scale.setScalar(scale);
    v.glow.material.opacity = 0.15 + v.node.amount * 0.4;
    const dangerTint = v.node.dangerLevel > 0.4 ? 1 : 0;
    v.glow.material.color.setHex(dangerTint ? 0xff3c3c : 0xff8a3c);
  }
}
