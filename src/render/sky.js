import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { star } from './textures.js';
import { makeRng } from '../sim/rng.js';

const vert = `varying vec3 vWorldPos; void main(){ vWorldPos=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const frag = `
uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundGlow; uniform float dayFactor;
varying vec3 vWorldPos;
void main(){
  float h = normalize(vWorldPos).y;
  float t = smoothstep(-0.05, 0.55, h);
  vec3 col = mix(horizonColor, topColor, t);
  col = mix(col, groundGlow, smoothstep(0.4, -0.2, h) * 0.35);
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(PALETTE.voidBlack) },
    horizonColor: { value: new THREE.Color(PALETTE.emberDeep) },
    groundGlow: { value: new THREE.Color(PALETTE.emberMid) },
    dayFactor: { value: 1 },
  };
  const geo = new THREE.SphereGeometry(700, 24, 16);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);

  // Starfield, fades in at night.
  const rng = makeRng(4242);
  const starCount = 900;
  const starGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 650;
    const theta = rng() * Math.PI * 2, phi = Math.acos(rng() * 0.9);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.9 + 40;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ map: star, size: 3.2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // A huge distant floating rift — the "what's THAT?" object (section 18), violet accent tying to HAKAI brand art.
  const riftGeo = new THREE.IcosahedronGeometry(30, 1);
  const riftMat = new THREE.MeshBasicMaterial({ color: PALETTE.riftViolet, transparent: true, opacity: 0.35, wireframe: true });
  const rift = new THREE.Mesh(riftGeo, riftMat);
  rift.position.set(-260, 160, -420);
  scene.add(rift);

  return { sky, stars, rift, uniforms };
}

export function updateSky(sky, dn, weather) {
  const night = dn.isNight;
  const nightAmt = night ? Math.min(1, (dn.t - 0.55) / 0.08) * Math.min(1, (0.97 - dn.t) / 0.08 + 0.7) : 0;
  const clamp = Math.max(0, Math.min(1, nightAmt));
  sky.uniforms.topColor.value.copy(new THREE.Color(PALETTE.voidBlack)).lerp(new THREE.Color(0x02010a), clamp);
  const dayHorizon = new THREE.Color(PALETTE.emberDeep);
  const nightHorizon = new THREE.Color(0x08030f);
  sky.uniforms.horizonColor.value.copy(dayHorizon).lerp(nightHorizon, clamp);
  sky.stars.material.opacity = clamp * 0.9;
  sky.rift.rotation.y += 0.0006;
  sky.rift.position.y = 160 + Math.sin(performance.now() * 0.00015) * 10;

  if (weather.state === 'voidcalm') sky.rift.material.opacity = 0.6;
  else sky.rift.material.opacity = 0.35;
}
