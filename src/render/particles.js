import * as THREE from 'three';
import { WORLD, PALETTE } from '../config.js';
import { softGlow } from './textures.js';
import { makeRng } from '../sim/rng.js';

// GPU-friendly single-draw-call particle systems — section 20.
export function buildEmbers(scene, count = 260) {
  const rng = makeRng(9001);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() - 0.5) * WORLD.size;
    pos[i * 3 + 1] = rng() * 30;
    pos[i * 3 + 2] = (rng() - 0.5) * WORLD.size;
    speed[i] = 0.6 + rng() * 1.4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: softGlow, size: 1.4, transparent: true, opacity: 0.85, depthWrite: false,
    blending: THREE.AdditiveBlending, color: new THREE.Color(PALETTE.emberBright),
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, speed, intensity: 1 };
}

export function updateEmbers(embers, dt) {
  const pos = embers.points.geometry.attributes.position;
  for (let i = 0; i < embers.speed.length; i++) {
    let y = pos.getY(i) + embers.speed[i] * dt * embers.intensity;
    if (y > 30) y = 0;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}

export function buildRain(scene, count = 700) {
  const rng = makeRng(3131);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() - 0.5) * WORLD.size * 0.8;
    pos[i * 3 + 1] = rng() * 60;
    pos[i * 3 + 2] = (rng() - 0.5) * WORLD.size * 0.8;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: softGlow, size: 0.6, transparent: true, opacity: 0, depthWrite: false, color: 0xff9955, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, count };
}

export function updateRain(rain, dt, active) {
  const target = active ? 0.55 : 0;
  rain.points.material.opacity += (target - rain.points.material.opacity) * Math.min(1, dt * 2);
  if (rain.points.material.opacity < 0.01) return;
  const pos = rain.points.geometry.attributes.position;
  for (let i = 0; i < rain.count; i++) {
    let y = pos.getY(i) - dt * 40;
    if (y < 0) y = 60;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}
