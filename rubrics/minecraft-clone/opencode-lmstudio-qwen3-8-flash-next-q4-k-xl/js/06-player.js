/* player: AABB physics vs voxel grid, swimming, fall damage, block raycast */
'use strict';

const Player = (() => {
  const PW = CFG.PW, PH = CFG.PH;
  const pos = { x: 0, y: 40, z: 0 };     // feet center
  const vel = { x: 0, y: 0, z: 0 };
  let yaw = 0, pitch = 0;
  let onGround = false, coyote = 0, inWater = false, sneakEdge = null;
  let fallDist = 0, hp = 20, regenT = 0, hurtT = 0, stepDist = 0;

  const solidAt = (x, y, z) => {
    if (y < 0) return true;
    if (x < 0 || z < 0 || x >= CFG.SX || z >= CFG.SZ) return true;   // world border walls
    return isSolid(World.get(x | 0, y | 0, z | 0));
  };

  function boxHits(px, py, pz) {
    const x0 = Math.floor(px - PW), x1 = Math.floor(px + PW);
    const y0 = Math.floor(py + .001), y1 = Math.floor(py + PH - .001);
    const z0 = Math.floor(pz - PW), z1 = Math.floor(pz + PW);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
      if (solidAt(x, y, z)) return true;
    return false;
  }

  function moveAxis(a, d) {
    if (!d) return;
    pos[a] += d;
    const eps = 1e-4;
    const x0 = Math.floor(pos.x - PW), x1 = Math.floor(pos.x + PW);
    const y0 = Math.floor(pos.y + .001), y1 = Math.floor(pos.y + PH - .001);
    const z0 = Math.floor(pos.z - PW), z1 = Math.floor(pos.z + PW);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (!solidAt(x, y, z)) continue;
      if (a === 'x') pos.x = d > 0 ? x - PW - eps : x + 1 + PW + eps;
      else if (a === 'y') {
        if (d > 0) { pos.y = y - PH - eps; vel.y = 0; }
        else { land(y + 1 + eps); }
      } else pos.z = d > 0 ? z - PW - eps : z + 1 + PW + eps;
      if (a !== 'y') vel[a] = 0;
      return;
    }
  }

  function land(groundY) {
    pos.y = groundY;
    if (!onGround && !inWater && fallDist > 3.2) Game.damage(Math.ceil(fallDist - 3));
    onGround = true; vel.y = 0; fallDist = 0;
  }

  function groundBelow() {
    const y = pos.y - .06;
    return solidAt(pos.x - PW, y, pos.z - PW) || solidAt(pos.x + PW, y, pos.z - PW) ||
           solidAt(pos.x - PW, y, pos.z + PW) || solidAt(pos.x + PW, y, pos.z + PW);
  }

  function update(dt, inp) {
    const eyeBlock = World.get(Math.floor(pos.x), Math.floor(pos.y + CFG.EYE), Math.floor(pos.z));
    const feetBlock = World.get(Math.floor(pos.x), Math.floor(pos.y + .2), Math.floor(pos.z));
    inWater = eyeBlock === B.WATER || feetBlock === B.WATER;

    // desired horizontal velocity from input, rotated by yaw
    const speed = inp.sneak ? CFG.SNEAK : (inp.sprint && inp.fwd > 0 && !inWater ? CFG.SPRINT : CFG.WALK) * (inWater ? .55 : 1);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    let tx = (-sin * inp.fwd + cos * inp.strafe) * speed;
    let tz = (-cos * inp.fwd - sin * inp.strafe) * speed;

    const accel = onGround ? 14 : (inWater ? 6 : 3.2);
    vel.x += (tx - vel.x) * Math.min(1, accel * dt);
    vel.z += (tz - vel.z) * Math.min(1, accel * dt);

    // vertical
    if (inWater) {
      fallDist = 0;
      vel.y -= CFG.GRAVITY * .32 * dt;
      if (vel.y < -4) vel.y = -4;
      if (inp.jump) vel.y = 4.2;
    } else {
      coyote = onGround ? .12 : Math.max(0, coyote - dt);
      if (inp.jump && coyote > 0) { vel.y = CFG.JUMP_V; coyote = 0; Sfx.jump(); }
      vel.y -= CFG.GRAVITY * dt;
      if (vel.y < -50) vel.y = -50;
    }

    const wasGround = onGround;
    onGround = false;
    const px0 = pos.x, pz0 = pos.z;
    moveAxis('x', vel.x * dt);
    moveAxis('z', vel.z * dt);
    if (inp.sneak && wasGround && !inWater && !groundBelow()) {   // don't sneak off a ledge
      pos.x = px0; pos.z = pz0; vel.x = 0; vel.z = 0;
    }
    moveAxis('y', vel.y * dt);

    if (!onGround) fallDist += Math.max(0, -vel.y * dt);
    // footsteps
    if (onGround && !inp.sneak) {
      stepDist += Math.hypot(vel.x, vel.z) * dt;
      if (stepDist > 2.1) { stepDist = 0; Sfx.step(World.get(Math.floor(pos.x), Math.floor(pos.y - .3), Math.floor(pos.z))); }
    }

    // world border clamp + health regen
    pos.x = clamp(pos.x, PW + .01, CFG.SX - PW - .01);
    pos.z = clamp(pos.z, PW + .01, CFG.SZ - PW - .01);
    if (pos.y < 0) { pos.y = 0; vel.y = 0; }

    hurtT = Math.max(0, hurtT - dt); regenT += dt;
    if (hp < 20 && hurtT <= 0 && regenT > 5) { regenT = 0; hp++; UI.hearts(hp); }

    // camera follows the eyes
    const cam = Scene.camera;
    cam.position.set(pos.x, pos.y + (inp.sneak ? CFG.EYE_SNEAK : CFG.EYE), pos.z);
    cam.rotation.set(pitch, yaw, 0);
  }

  function look(dx, dy) {
    yaw -= dx * UI.sens(); pitch -= dy * UI.sens();
    pitch = clamp(pitch, -Math.PI / 2 + .01, Math.PI / 2 - .01);
  }

  /* Amanatides & Woo voxel traversal from the eye along view direction */
  function raycast() {
    const cam = Scene.camera;
    const o = cam.position, d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = Math.sign(d.x) || 1, stepY = Math.sign(d.y) || 1, stepZ = Math.sign(d.z) || 1;
    const tDX = Math.abs(1 / (d.x || 1e-9)), tDY = Math.abs(1 / (d.y || 1e-9)), tDZ = Math.abs(1 / (d.z || 1e-9));
    let tX = ((stepX > 0 ? x + 1 - o.x : o.x - x)) * tDX;
    let tY = ((stepY > 0 ? y + 1 - o.y : o.y - y)) * tDY;
    let tZ = ((stepZ > 0 ? z + 1 - o.z : o.z - z)) * tDZ;
    let nx = 0, ny = 0, nz = 0, t = 0;

    while (t <= CFG.REACH) {
      const id = World.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { x, y, z, nx, ny, nz, id };
      if (tX < tY && tX < tZ) { x += stepX; t = tX; tX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tY < tZ) { y += stepY; t = tY; tY += tDY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tZ; tZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
    }
    return null;
  }

  function overlapsBlock(bx, by, bz) {   // would placing a block here clip the player?
    return bx + 1 > pos.x - PW && bx < pos.x + PW &&
           by + 1 > pos.y && by < pos.y + PH &&
           bz + 1 > pos.z - PW && bz < pos.z + PW;
  }

  function damage(n) {
    if (hp <= 0) return;
    hp = Math.max(0, hp - n); hurtT = 6; regenT = 0;
    UI.hearts(hp); Sfx.hurt();
    if (hp <= 0) Game.die();
  }

  function spawnAt(x, y, z) { pos.x = x; pos.y = y; pos.z = z; vel.x = vel.y = vel.z = 0; fallDist = 0; }
  function respawn() { hp = 20; UI.hearts(hp); const sx = CFG.SX / 2, sz = CFG.SZ / 2; spawnAt(sx + .5, World.surfaceY(sx | 0, sz | 0) + 1.02, sz + .5); }

  return {
    update, look, raycast, overlapsBlock, damage, spawnAt, respawn, pos, vel, inWater: () => inWater,
    get hp() { return hp; }, set hp(v) { hp = v; UI.hearts(hp); },
    get onGround() { return onGround; }
  };
})();
