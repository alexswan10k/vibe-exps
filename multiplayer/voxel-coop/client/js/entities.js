// Rendered entities: mobs (server-simulated) + remote players.
const MOB_STYLE = {
  pig: { color: 0xf0a0b0, w: 0.7, h: 0.7 },
  cow: { color: 0x6b4a2f, w: 0.8, h: 0.8 },
  chicken: { color: 0xf2f2f2, w: 0.45, h: 0.5 },
  sheep: { color: 0xd8d8d8, w: 0.7, h: 0.75 },
  zombie: { color: 0x3a7d3a, w: 0.6, h: 1.7 },
};

export class Entities {
  constructor(scene) {
    this.scene = scene;
    this.mobs = new Map(); // id -> {mesh, target, hpBar}
    this.remotes = new Map(); // id -> {group, target, yaw}
  }

  setMobs(list) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let e = this.mobs.get(m.id);
      if (!e) {
        const st = MOB_STYLE[m.kind] ?? MOB_STYLE.pig;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(st.w, st.h, st.w),
          new THREE.MeshLambertMaterial({ color: st.color }),
        );
        // eyes for zombies/hostiles
        this.scene.add(mesh);
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false }),
        );
        this.scene.add(bar);
        e = { mesh, bar, st, target: null };
        this.mobs.set(m.id, e);
      }
      e.target = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
      const frac = Math.max(0, m.hp / m.maxHp);
      e.bar.scale.x = frac;
      e.bar.visible = frac < 1;
    }
    for (const [id, e] of this.mobs) {
      if (!seen.has(id)) {
        this.scene.remove(e.mesh);
        this.scene.remove(e.bar);
        this.mobs.delete(id);
      }
    }
  }

  setPlayers(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let e = this.remotes.get(p.id);
      if (!e) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 1.8, 0.6),
          new THREE.MeshLambertMaterial({ color: 0x3b82f6 }),
        );
        body.position.y = 0.9;
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }),
        );
        head.position.y = 1.95;
        group.add(body, head);
        // name tag
        const cv = document.createElement("canvas");
        cv.width = 256; cv.height = 48;
        const g = cv.getContext("2d");
        g.font = "28px sans-serif";
        g.textAlign = "center";
        g.fillStyle = "white";
        g.strokeStyle = "black";
        g.lineWidth = 5;
        g.strokeText(p.name, 128, 34);
        g.fillText(p.name, 128, 34);
        const tex = new THREE.CanvasTexture(cv);
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
        tag.scale.set(2.2, 0.4, 1);
        tag.position.y = 2.6;
        group.add(tag);
        this.scene.add(group);
        e = { group, target: null, yaw: 0 };
        this.remotes.set(p.id, e);
      }
      e.target = new THREE.Vector3(p.p[0], p.p[1], p.p[2]);
      e.yaw = p.yaw;
      e.group.visible = !p.dead;
    }
    for (const [id, e] of this.remotes) {
      if (!seen.has(id)) {
        this.scene.remove(e.group);
        this.remotes.delete(id);
      }
    }
  }

  /** Hit-test click against mobs for attacking. Returns mob id or null. */
  pickMob(origin, dir, maxDist = 4.5) {
    let best = null, bestD = maxDist;
    for (const [id, e] of this.mobs) {
      const to = new THREE.Vector3().copy(e.mesh.position).sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > maxDist) continue;
      const perp = new THREE.Vector3().copy(origin).addScaledVector(dir, along).distanceTo(e.mesh.position);
      if (perp < 1.0 && along < bestD) { best = id; bestD = along; }
    }
    return best;
  }

  update(dt, camera) {
    const k = Math.min(1, dt * 10);
    for (const [, e] of this.mobs) {
      if (!e.target) continue;
      e.mesh.position.lerp(e.target, k);
      e.bar.position.copy(e.mesh.position);
      e.bar.position.y += e.st.h / 2 + 0.35;
      if (camera) e.bar.quaternion.copy(camera.quaternion);
      // hop animation
      e.mesh.position.y += Math.abs(Math.sin(performance.now() / 300)) * 0.03;
    }
    for (const [, e] of this.remotes) {
      if (!e.target) continue;
      e.group.position.lerp(e.target.clone().add(new THREE.Vector3(0, -1.62, 0)), k);
      e.group.rotation.y = e.yaw;
    }
  }
}
