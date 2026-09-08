// Rendered entities: mobs (server-simulated) + remote players.
const MOB_STYLE = {
  pig: { color: 0xf0a0b0, body: [0.9, 0.6, 0.6], head: [0.45, 0.45, 0.4], headY: 0.55, eyes: false },
  cow: { color: 0x6b4a2f, body: [1.0, 0.7, 0.7], head: [0.5, 0.5, 0.45], headY: 0.6, eyes: false },
  chicken: { color: 0xf2f2f2, body: [0.4, 0.45, 0.4], head: [0.3, 0.3, 0.3], headY: 0.5, eyes: false },
  sheep: { color: 0xdcdcdc, body: [0.9, 0.65, 0.65], head: [0.4, 0.4, 0.35], headY: 0.55, eyes: false },
  zombie: { color: 0x3a7d3a, body: [0.55, 0.9, 0.4], head: [0.45, 0.45, 0.45], headY: 1.15, eyes: true },
};

function flashable(mat) {
  mat.userData.baseEmissive = mat.emissive.getHex();
  return mat;
}

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
        const node = new THREE.Group();
        const mat = flashable(new THREE.MeshLambertMaterial({ color: st.color }));
        const body = new THREE.Mesh(new THREE.BoxGeometry(...st.body), mat);
        body.position.y = st.body[1] / 2;
        const head = new THREE.Mesh(new THREE.BoxGeometry(...st.head), mat);
        head.position.set(0, st.body[1] + st.head[1] / 2 - 0.08, st.body[2] / 2 + st.head[2] / 2 - 0.1);
        node.add(body, head);
        if (st.eyes) {
          const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
          for (const sx of [-0.11, 0.11]) {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), eyeMat);
            eye.position.set(sx, body.position.y + st.body[1] / 2 + 0.35, st.body[2] / 2 + st.head[2] - 0.08);
            node.add(eye);
          }
        }
        this.scene.add(node);
        const barBg = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, 0.12),
          new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false, transparent: true, opacity: 0.7 }),
        );
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, 0.12),
          new THREE.MeshBasicMaterial({ color: 0x44dd44, depthTest: false }),
        );
        bar.position.z = 0.001;
        barBg.add(bar);
        this.scene.add(barBg);
        e = { node, mat, barBg, bar, topY: st.body[1] + st.head[1], target: null, flashUntil: 0 };
        this.mobs.set(m.id, e);
      }
      e.target = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
      const frac = Math.max(0, m.hp / m.maxHp);
      e.bar.scale.x = Math.max(0.001, frac);
      e.bar.position.x = -(1 - frac) / 2;
      e.bar.material.color.setHex(frac > 0.5 ? 0x44dd44 : frac > 0.25 ? 0xffaa22 : 0xff3333);
      e.barBg.visible = true;
    }
    for (const [id, e] of this.mobs) {
      if (!seen.has(id)) {
        this.scene.remove(e.node);
        this.scene.remove(e.barBg);
        this.mobs.delete(id);
      }
    }
  }

  flash(id) {
    const e = this.mobs.get(id);
    if (e) e.flashUntil = performance.now() + 180;
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
      const center = new THREE.Vector3().copy(e.node.position);
      center.y += e.topY / 2;
      const to = new THREE.Vector3().copy(center).sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > maxDist) continue;
      const perp = new THREE.Vector3().copy(origin).addScaledVector(dir, along).distanceTo(center);
      if (perp < 1.1 && along < bestD) { best = id; bestD = along; }
    }
    return best;
  }

  update(dt, camera) {
    const k = Math.min(1, dt * 10);
    const now = performance.now();
    for (const [, e] of this.mobs) {
      if (!e.target) continue;
      e.node.position.lerp(e.target, k);
      e.barBg.position.copy(e.node.position);
      e.barBg.position.y += e.topY + 0.3;
      if (camera) e.barBg.quaternion.copy(camera.quaternion);
      // hit flash
      e.mat.emissive.setHex(now < e.flashUntil ? 0xff2222 : e.mat.userData.baseEmissive);
    }
    for (const [, e] of this.remotes) {
      if (!e.target) continue;
      e.group.position.lerp(e.target.clone().add(new THREE.Vector3(0, -1.62, 0)), k);
      e.group.rotation.y = e.yaw;
    }
  }
}
