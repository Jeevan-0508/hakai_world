import * as THREE from 'three';

const EYE_HEIGHT = 1.7;

export function createFirstPersonRig(camera) {
  let pitch = 0;
  return {
    applyLook(dx, dy) {
      camera.rotation.order = 'YXZ';
    },
    update(world, heightAt, keys, dt, mouse) {
      const p = world.player;
      p.yaw -= mouse.dx * 0.0022;
      pitch = THREE.MathUtils.clamp(pitch - mouse.dy * 0.0022, -1.1, 1.1);
      mouse.dx = 0; mouse.dy = 0;

      const forward = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      let mx = 0, mz = 0;
      if (keys['w']) mz += 1;
      if (keys['s']) mz -= 1;
      if (keys['d']) mx += 1;
      if (keys['a']) mx -= 1;
      const len = Math.hypot(mx, mz) || 1;
      const sprint = keys['shift'] ? 1.8 : 1;
      const speed = 7 * sprint;
      p.pos.x += (forward.x * mz + right.x * mx) / len * speed * dt * (mx || mz ? 1 : 0);
      p.pos.z += (forward.z * mz + right.z * mx) / len * speed * dt * (mx || mz ? 1 : 0);

      const groundY = heightAt(p.pos.x, p.pos.z);
      const bob = (mx || mz) ? Math.sin(performance.now() * 0.012) * 0.05 : 0;
      camera.position.set(p.pos.x, groundY + EYE_HEIGHT + bob, p.pos.z);
      camera.rotation.set(pitch, p.yaw, 0, 'YXZ');
      return (mx !== 0 || mz !== 0);
    },
  };
}

export function createPhotoRig(camera) {
  const target = new THREE.Vector3();
  let dist = 14, az = 0, pol = 1.1;
  return {
    setTarget(v) { target.copy(v); },
    drag(dx, dy) { az -= dx * 0.005; pol = THREE.MathUtils.clamp(pol - dy * 0.005, 0.2, Math.PI - 0.2); },
    zoom(delta) { dist = THREE.MathUtils.clamp(dist + delta * 0.01, 3, 80); },
    update() {
      const x = target.x + dist * Math.sin(pol) * Math.sin(az);
      const y = target.y + dist * Math.cos(pol) + 2;
      const z = target.z + dist * Math.sin(pol) * Math.cos(az);
      camera.position.set(x, y, z);
      camera.lookAt(target);
    },
  };
}
