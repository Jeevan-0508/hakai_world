import * as THREE from 'three';
import { WORLD, PALETTE } from '../config.js';
import { makeRng } from '../sim/rng.js';

// Cheap value-noise (no external noise lib) — deterministic from WORLD.seed.
function makeNoise2D(seed) {
  const rng = makeRng(seed);
  const grid = 64, table = new Float32Array(grid * grid);
  for (let i = 0; i < table.length; i++) table[i] = rng();
  const at = (x, y) => table[((y % grid) + grid) % grid * grid + (((x % grid) + grid) % grid)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function buildTerrain(scene) {
  const noise = makeNoise2D(WORLD.seed);
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z) / (WORLD.size * 0.5);
    let h = noise(x * 0.03, z * 0.03) * 6 + noise(x * 0.08, z * 0.08) * 2;
    h -= Math.max(0, d - 0.5) * 18; // basin toward the structure, rim rises at edges
    if (d < 0.12) h *= d / 0.12; // flatten near structure center
    pos.setY(i, h);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x241417),
    roughness: 0.92, metalness: 0.05,
    emissive: new THREE.Color(PALETTE.emberDeep), emissiveIntensity: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Distant ring of jagged silhouettes for scale (section 18).
  const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x030202 });
  const rng = makeRng(WORLD.seed + 7);
  const group = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rng() * 0.2;
    const r = WORLD.size * 0.62 + rng() * 60;
    const h = 40 + rng() * 90;
    const geoM = new THREE.ConeGeometry(14 + rng() * 20, h, 5);
    const m = new THREE.Mesh(geoM, silhouetteMat);
    m.position.set(Math.sin(a) * r, h / 2 - 6, Math.cos(a) * r);
    m.rotation.y = rng() * Math.PI;
    group.add(m);
  }
  scene.add(group);

  return { mesh, heightAt: (x, z) => {
    let h = noise(x * 0.03, z * 0.03) * 6 + noise(x * 0.08, z * 0.08) * 2;
    const d = Math.hypot(x, z) / (WORLD.size * 0.5);
    h -= Math.max(0, d - 0.5) * 18;
    if (d < 0.12) h *= d / 0.12;
    return h;
  } };
}
