// First-person viewmodel: right arm + held item, camera-attached, MC-style.
// Blocks render as mini cubes (real textures), tools as low-poly voxel builds
// (handle + tier-colored head), everything else as an icon billboard.
import { isPlaceable } from "./config.js";
import { itemIconURL } from "./icons.js";

const TIERS = { wood: 0xa0713d, stone: 0x888888, iron: 0xd8d8dc, gold: 0xf4c20d, diamond: 0x5ff2e0 };
const TOOLS = {
  108: ["pick", "wood"], 109: ["pick", "stone"], 110: ["pick", "iron"],
  124: ["pick", "gold"], 126: ["pick", "diamond"],
  111: ["sword", "wood"], 113: ["sword", "stone"], 114: ["sword", "iron"],
  125: ["sword", "gold"], 127: ["sword", "diamond"],
  116: ["axe", "wood"], 117: ["axe", "stone"], 118: ["axe", "iron"],
  128: ["axe", "gold"], 129: ["axe", "diamond"],
  119: ["shovel", "wood"], 120: ["shovel", "stone"], 121: ["shovel", "iron"],
  130: ["shovel", "gold"], 131: ["shovel", "diamond"],
};
const HANDLE = 0x8a5f30;
const SKIN = 0xf0c8a0;
const SLEEVE = 0x3a6fd8;

function lam(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, emissive: 0x222222, ...extra });
}

export class Hand {
  constructor(camera, materials) {
    this.camera = camera;
    this.materials = materials;
    this.heldId = -1;
    this.swingT = 1;   // 0..1 attack/mine swing (1 = idle)
    this.switchT = 1;  // hotbar-switch pop-in
    this.eatT = 1;     // eating raise
    this.bobPhase = 0;
    this.iconTex = new Map();

    this.group = new THREE.Group();
    this.rig = new THREE.Group();
    this.rigBase = new THREE.Vector3(0.36, -0.37, -0.78);
    this.rig.position.copy(this.rigBase);
    this.rig.rotation.y = -0.12;
    this.group.add(this.rig);

    // forearm: sleeve + fist, angled up from bottom-right
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.42), lam(SLEEVE));
    sleeve.position.set(0, -0.1, 0.22);
    sleeve.rotation.x = 0.35;
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.16), lam(SKIN));
    fist.position.set(0, 0.0, 0.02);
    this.rig.add(sleeve, fist);

    // item rides above the fist; swing/eat animate this pivot
    this.itemPivot = new THREE.Group();
    this.itemPivotBase = new THREE.Vector3(0, 0.16, -0.12);
    this.itemPivot.position.copy(this.itemPivotBase);
    this.baseTilt = -0.35;
    this.itemPivot.rotation.x = this.baseTilt;
    this.rig.add(this.itemPivot);
    this.item = null;

    // never shadowed, never culled (lives 1m from the eye)
    this.group.traverse((o) => { o.frustumCulled = false; });
    camera.add(this.group);
  }

  setHeld(id) {
    id = id ?? 0;
    if (id === this.heldId) return;
    this.heldId = id;
    if (this.item) {
      this.itemPivot.remove(this.item);
      this.item = null;
    }
    if (!id) return;
    this.item = this.buildItem(id);
    if (this.item) {
      this.item.traverse((o) => { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; });
      this.itemPivot.add(this.item);
      this.switchT = 0; // pop-in
    }
  }

  buildItem(id) {
    if (TOOLS[id]) return this.buildTool(...TOOLS[id]);
    if (id === 15) return this.buildTorch(); // flat yellow cube reads badly — stick + glow head
    if (isPlaceable(id)) {
      const mat = this.materials[id];
      if (!mat) return null;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), mat));
      return g;
    }
    const tex = this.texFor(id);
    if (!tex) return null;
    const g = new THREE.Group();
    // unlit: handheld bits must read at a glance, day or night (tools shade, icons don't)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    );
    m.rotation.y = 0.35;
    g.add(m);
    return g;
  }

  buildTool(kind, tier) {
    const head = TIERS[tier];
    const g = new THREE.Group();
    const add = (w, h, d, x, y, z, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
      m.position.set(x, y, z);
      g.add(m);
    };
    if (kind === "sword") {
      add(0.09, 0.5, 0.05, 0, -0.25, 0, HANDLE);       // grip
      add(0.26, 0.06, 0.08, 0, 0.02, 0, HANDLE);       // guard
      add(0.1, 0.62, 0.045, 0, 0.36, 0, head);         // blade
      add(0.035, 0.62, 0.05, -0.03, 0.36, 0, 0xffffff); // glint
    } else if (kind === "pick") {
      add(0.08, 0.62, 0.08, 0, -0.12, 0, HANDLE);
      add(0.5, 0.1, 0.09, 0, 0.22, 0, head);
      add(0.09, 0.2, 0.08, -0.24, 0.12, 0, head);      // left tip
      add(0.09, 0.2, 0.08, 0.24, 0.12, 0, head);       // right tip
    } else if (kind === "axe") {
      add(0.08, 0.62, 0.08, 0, -0.12, 0, HANDLE);
      add(0.26, 0.22, 0.07, 0.12, 0.16, 0, head);      // head
      add(0.1, 0.3, 0.06, 0.22, 0.02, 0, head);        // beard
      add(0.26, 0.04, 0.075, 0.12, 0.26, 0, 0xffffff); // glint
    } else { // shovel
      add(0.08, 0.55, 0.08, 0, -0.15, 0, HANDLE);
      add(0.16, 0.28, 0.06, 0, 0.24, 0, head);         // blade
      add(0.05, 0.28, 0.065, -0.05, 0.24, 0, 0xffffff);
    }
    g.rotation.z = -0.25;
    g.scale.setScalar(0.85);
    return g;
  }

  buildTorch() {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), lam(HANDLE));
    stick.position.y = -0.08;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshLambertMaterial({ color: 0xffcf4d, emissive: 0xcc7717 }),
    );
    head.position.y = 0.22;
    g.add(stick, head);
    g.rotation.z = -0.2;
    return g;
  }

  texFor(id) {
    let t = this.iconTex.get(id);
    if (t) return t;
    const url = itemIconURL(id);
    if (!url) return null;
    t = new THREE.TextureLoader().load(url);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    this.iconTex.set(id, t);
    return t;
  }

  /** Restart the swing unless one is mid-flight (mining re-triggers on loop). */
  swing() { if (this.swingT >= 1) this.swingT = 0; }
  eat() { if (this.eatT >= 1) this.eatT = 0; }

  update(dt, moving) {
    // walk bob
    this.bobPhase += dt * (moving ? 9 : 2.5);
    const amp = moving ? 0.028 : 0.008;
    this.rig.position.set(
      this.rigBase.x + Math.cos(this.bobPhase * 0.5) * amp * 0.7,
      this.rigBase.y + Math.abs(Math.sin(this.bobPhase)) * amp,
      this.rigBase.z,
    );
    // swing: chop down + thrust forward
    this.swingT = Math.min(1, this.swingT + dt / 0.32);
    const k = Math.sin(Math.min(1, this.swingT) * Math.PI);
    // switch pop: scale up from 60%
    this.switchT = Math.min(1, this.switchT + dt / 0.18);
    const s = 0.6 + 0.4 * this.switchT;
    // eat: raise to the face + tilt
    this.eatT = Math.min(1, this.eatT + dt / 0.55);
    const e = Math.sin(Math.min(1, this.eatT) * Math.PI);
    this.itemPivot.rotation.x = this.baseTilt - k * 1.15 - e * 0.7;
    this.itemPivot.rotation.z = -e * 0.5;
    this.itemPivot.position.set(
      this.itemPivotBase.x,
      this.itemPivotBase.y + e * 0.28,
      this.itemPivotBase.z - k * 0.28 + e * 0.12,
    );
    if (this.item) this.item.scale.setScalar(s);
  }
}
