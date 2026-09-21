import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { runeSigilTexture } from './textures.js';

// One visually spectacular ancient structure — section 14. Procedural (no 3D asset exists
// in the source game), broken ring of pillars + one intact arch + a vertical energy pillar.
export function buildStructure(scene, pos, heightAt) {
  const group = new THREE.Group();
  const y0 = heightAt(pos.x, pos.z);
  group.position.set(pos.x, y0, pos.z);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x1a1216, roughness: 0.9, metalness: 0.1 });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x1a1216, roughness: 0.8, emissive: new THREE.Color(PALETTE.emberBright),
    emissiveMap: runeSigilTexture(), emissiveIntensity: 1.2,
  });

  const pillarCount = 9;
  for (let i = 0; i < pillarCount; i++) {
    const a = (i / pillarCount) * Math.PI * 2;
    const broken = i % 3 === 1;
    const h = broken ? 6 + (i % 2) * 3 : 16;
    const geo = new THREE.CylinderGeometry(1.6, 2, h, 8);
    const mesh = new THREE.Mesh(geo, i % 4 === 0 ? runeMat : stoneMat);
    mesh.position.set(Math.sin(a) * 20, h / 2, Math.cos(a) * 20);
    mesh.rotation.y = a;
    if (broken) mesh.rotation.z = (i % 2 ? 1 : -1) * 0.18;
    group.add(mesh);
  }

  // One intact arch facing the approach path.
  const archMat = runeMat;
  const legGeo = new THREE.BoxGeometry(2.2, 14, 2.2);
  const legL = new THREE.Mesh(legGeo, stoneMat); legL.position.set(-7, 7, 26);
  const legR = new THREE.Mesh(legGeo, stoneMat); legR.position.set(7, 7, 26);
  const top = new THREE.Mesh(new THREE.BoxGeometry(18, 2.4, 2.4), archMat); top.position.set(0, 14.5, 26);
  group.add(legL, legR, top);

  // Vertical energy pillar rising from the center — visible from far away.
  const beamGeo = new THREE.CylinderGeometry(0.6, 1.4, 90, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.emberBright, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 45;
  group.add(beam);

  const coreLight = new THREE.PointLight(PALETTE.emberBright, 6, 60, 2);
  coreLight.position.y = 3;
  group.add(coreLight);

  scene.add(group);
  return { group, beam, coreLight };
}

export function updateStructure(structVis, t) {
  structVis.beam.material.opacity = 0.16 + Math.sin(t * 0.8) * 0.06;
  structVis.coreLight.intensity = 5 + Math.sin(t * 1.3) * 1.5;
}
