// Phase 7: GPU instancing for creature billboards. One InstancedMesh per species (the
// boss stays a single untouched Sprite, see main.js — instancing one object is pointless)
// cuts draw calls from one-per-creature to one-per-species. No custom shader: each
// instance's matrix is rebuilt every frame from the live camera quaternion, the same
// spherical-billboard trick THREE.Sprite does internally, so visual behavior matches the
// old per-sprite path. State tinting (chase/combat, sleep dim) uses InstancedMesh's
// built-in per-instance color (native in MeshBasicMaterial since three r152, no shader).
import * as THREE from 'three';
import { loadCreatureTexture, getAspect } from './creatureRenderer.js';
import { groundShadow } from './textures.js';

const CAPACITY = 8; // population.js caps non-elite species at 6; this leaves headroom

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _color = new THREE.Color();
const _identityQuat = new THREE.Quaternion();

export function buildSpeciesInstances(scene, speciesKey, def) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: loadCreatureTexture(def.file, def.backgroundMode, null, def.maskCrop, def.chromaKeyTrim),
    transparent: true,
    depthWrite: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
  mesh.count = 0;
  mesh.frustumCulled = false; // instances move independently; per-instance culling isn't worth it at this population size
  scene.add(mesh);

  const shadowGeo = new THREE.CircleGeometry(1, 16); // unit radius; per-frame scale below sets the real size
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ map: groundShadow, transparent: true, depthWrite: false });
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, CAPACITY);
  shadowMesh.count = 0;
  shadowMesh.frustumCulled = false;
  scene.add(shadowMesh);

  return { mesh, shadowMesh, def };
}

// Mirrors src/render/creatureRenderer.js's updateCreatureVisual, per-instance instead of
// per-object. `creatures` is the live list for this species only (already range-filtered
// by the caller for LOD, same as the old per-sprite visible/invisible toggle).
export function updateSpeciesInstances(inst, creatures, camera, heightAt) {
  const { mesh, shadowMesh, def } = inst;
  const n = Math.min(creatures.length, CAPACITY);
  const s = def.scale;
  const aspect = getAspect(def.file);
  const sx = aspect >= 1 ? s : s * aspect;
  const sy = aspect >= 1 ? s / aspect : s;
  const flying = !!def.flying;

  camera.getWorldQuaternion(_quat);

  for (let i = 0; i < n; i++) {
    const c = creatures[i];
    const groundY = heightAt(c.pos.x, c.pos.z);
    const bobY = Math.sin(c.bob * 2) * (flying ? 1.4 : 0.12);
    const halfHeight = sy / 2;
    const baseY = flying ? groundY + 18 + Math.sin(c.bob * 0.3) * 4 : groundY + halfHeight * 0.9;

    _pos.set(c.pos.x, baseY + bobY, c.pos.z);
    _scale.set(sx, sy, 1);
    _mat.compose(_pos, _quat, _scale);
    mesh.setMatrixAt(i, _mat);

    const isActive = c.state === 'CHASE' || c.state === 'COMBAT';
    const dim = c.state === 'SLEEP' ? 0.9 : 1;
    _color.setHex(isActive ? 0xffcbb0 : 0xffffff).multiplyScalar(dim);
    mesh.setColorAt(i, _color);

    const shadowScale = flying ? Math.max(0.3, 1 - (baseY - groundY) / 40) : 1;
    _pos.set(c.pos.x, groundY + 0.03, c.pos.z);
    _scale.set(s * 0.42 * shadowScale, s * 0.42 * shadowScale, 1);
    _mat.compose(_pos, _identityQuat, _scale); // shadows lie flat, geometry is pre-rotated; no billboard quaternion needed
    shadowMesh.setMatrixAt(i, _mat);
  }

  mesh.count = n;
  shadowMesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  shadowMesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
