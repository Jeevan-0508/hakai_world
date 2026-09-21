import * as THREE from 'three';
import { PALETTE } from '../config.js';

export function buildLights(scene) {
  const ambient = new THREE.HemisphereLight(0x5a3420, 0x140a0d, 0.75);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffb37a, 1.2);
  sun.position.set(80, 120, 40);
  scene.add(sun);

  const rim = new THREE.PointLight(PALETTE.emberBright, 0, 200, 2); // extra kick during Red Moon
  scene.add(rim);

  return { ambient, sun, rim };
}

export function updateLights(lights, dn, eventActive) {
  const dayT = dn.t; // 0..1
  // Sun arcs across the sky; below horizon during night window.
  const angle = dayT * Math.PI * 2 - Math.PI / 2;
  const r = 200;
  lights.sun.position.set(Math.cos(angle) * r, Math.max(15, Math.sin(angle) * r), 60);
  const nightAmt = dn.isNight ? 1 : 0;
  lights.sun.intensity = THREE.MathUtils.lerp(1.25, 0.12, nightAmt);
  lights.sun.color.setHex(nightAmt ? 0x8a6ad0 : 0xffb37a);
  lights.ambient.intensity = THREE.MathUtils.lerp(0.8, 0.32, nightAmt);

  const redMoon = eventActive === 'red_moon';
  lights.rim.intensity = redMoon ? 4 : 0;
  lights.rim.color.setHex(0xff2a2a);
  lights.rim.position.set(0, 40, -40);
}
