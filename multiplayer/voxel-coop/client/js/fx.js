// Break feedback: MC-style crack overlay on the targeted block + debris particles.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

function crackTexture(stage) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 16, 16);
  const r = rng(1000 + stage * 77);
  const strokes = 3 + stage * 3;
  g.strokeStyle = "rgba(15,10,5,0.85)";
  g.lineWidth = 1;
  for (let i = 0; i < strokes; i++) {
    let x = r() * 16, y = r() * 16;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 2 + Math.floor(r() * 3);
    for (let k = 0; k < segs; k++) {
      x += (r() - 0.5) * 9;
      y += (r() - 0.5) * 9;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

export class CrackOverlay {
  constructor(scene) {
    this.textures = [];
    for (let s = 0; s < 6; s++) this.textures.push(crackTexture(s));
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.stage = -1;
  }

  show(x, y, z, frac) {
    const stage = Math.max(0, Math.min(5, Math.floor(frac * 6)));
    if (stage !== this.stage) {
      this.stage = stage;
      this.mesh.material.map = this.textures[stage];
      this.mesh.material.needsUpdate = true;
    }
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
    this.stage = -1;
  }
}

export class Particles {
  constructor(scene, max = 240) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -9999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, sizeAttenuation: true,
      transparent: true, opacity: 0.95, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this.tmpColor = new THREE.Color();
  }

  burst(x, y, z, hex, n = 12) {
    this.tmpColor.setHex(hex);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.7;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.7;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.7;
      this.vel[i * 3] = (Math.random() - 0.5) * 4;
      this.vel[i * 3 + 1] = Math.random() * 4 + 1;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 4;
      const v = 0.8 + Math.random() * 0.35;
      this.col[i * 3] = Math.min(1, this.tmpColor.r * v);
      this.col[i * 3 + 1] = Math.min(1, this.tmpColor.g * v);
      this.col[i * 3 + 2] = Math.min(1, this.tmpColor.b * v);
      this.life[i] = 0.4 + Math.random() * 0.3;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -9999;
        continue;
      }
      this.vel[i * 3 + 1] -= 18 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    if (any) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
