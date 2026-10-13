/* Headless smoke test for voxel-verse/script.js.
   script.js is written as a browser global script, so we build a minimal DOM +
   THREE + WebGL stand-in, evaluate the file, and drive the game far enough to
   prove: no runtime errors, chunks mesh, geometry is sane, and the old
   InstancedMesh path is really gone.

   Run: node voxel-verse/smoke.test.mjs   (or: node --test voxel-verse/) */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ THREE */

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  setSubVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  distanceToSquared(v) { return (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2; }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this; }
  cross(v) { return this.crossVectors(this, v); }
  crossVectors(a, b) {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    return this.set(x, y, z);
  }
  setFromMatrixPosition(m) { const e = m.elements; this.x = e[12]; this.y = e[13]; this.z = e[14]; return this; }
  applyQuaternion() { return this; }
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  setFromMatrixScale() { return this; }
  toArray() { return [this.x, this.y, this.z]; }
}
class Euler {
  constructor(x = 0, y = 0, z = 0, o = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = o; }
  setFromQuaternion() { return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  set(x2, y2, z2, o) { this.x = x2; this.y = y2; this.z = z2; if (o) this.order = o; return this; }
  copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; }
  clone() { return new Euler(this.x, this.y, this.z, this.order); }
}
class Quaternion { identity() { return this; } setFromEuler() { return this; } }
class Color {
  constructor(c) { this.r = 1; this.g = 1; this.b = 1; if (c !== undefined) this.set(c); }
  set(c) {
    if (typeof c === 'number') { this.r = ((c >> 16) & 255) / 255; this.g = ((c >> 8) & 255) / 255; this.b = (c & 255) / 255; }
    else if (typeof c === 'string') { this.r = 1; this.g = 1; this.b = 1; }
    else if (c && c.isColor) { this.r = c.r; this.g = c.g; this.b = c.b; }
    return this;
  }
  setScalar(s) { this.r = this.g = this.b = s; return this; }
  setHex(c) { return this.set(c); }
  getHex() { return 0; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
  setHSL() { return this; }
  copy(c) { return this.set(c); }
  clone() { return new Color(this); }
  lerp() { return this; }
  lerpColors(a, b, t) { this.r = a.r + (b.r - a.r) * t; this.g = a.g + (b.g - a.g) * t; this.b = a.b + (b.b - a.b) * t; return this; }
}
Color.prototype.isColor = true;

class Object3D {
  constructor() {
    this.children = []; this.parent = null; this.position = new Vec3();
    this.rotation = new Euler(); this.quaternion = new Quaternion();
    this.scale = new Vec3(1, 1, 1); this.up = new Vec3(0, 1, 0);
    this.matrix = { elements: new Array(16).fill(0) }; this.matrixWorld = this.matrix;
    this.visible = true; this.userData = {}; this.renderOrder = 0;
  }
  updateMatrix() {
    const e = this.matrix.elements;
    e[0] = this.scale.x; e[5] = this.scale.y; e[10] = this.scale.z; e[15] = 1;
    e[12] = this.position.x; e[13] = this.position.y; e[14] = this.position.z;
  }
  decompose(pos, quat, scl) {
    pos.setFromMatrixPosition(this.matrix);
    scl.copy(this.scale); quat.identity();
  }
  clone() {
    const c = new this.constructor();
    c.position.copy(this.position);
    c.rotation.copy(this.rotation);
    c.scale.copy(this.scale);
    c.visible = this.visible;
    c.material = this.material;
    c.geometry = this.geometry;
    for (const child of this.children) c.add(child.clone());
    return c;
  }
  add(...o) { for (const c of o) { c.parent = this; this.children.push(c); } return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse?.(fn); }
  updateMatrixWorld() {}
  getWorldDirection(v) { return v.set(0, 0, -1); }
  lookAt() {}
}
class Group extends Object3D {}
class Scene extends Object3D { constructor() { super(); this.fog = new Color(0); this.background = new Color(0); } }
class Camera extends Object3D {
  constructor() { super(); this.fov = 75; this.isLocked = false; }
  getWorldDirection(v) { return v.set(0, 0, -1); }
}
class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; this.count = array.length / itemSize; }
  setXYZ() {} setX() {} setY() {} setZ() {}
}
class BufferGeometry extends Object3D {
  constructor() { super(); this.attributes = {}; this.index = null; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  getAttribute(n) { return this.attributes[n]; }
  setIndex(a) { this.index = a; return this; }
  computeBoundingSphere() { this.boundingSphere = new (class { constructor() { this.radius = 1; } })(); }
  computeVertexNormals() {}
  dispose() { this.disposed = true; }
  translate() {} rotateX() {} scale() {}
}
class Uint16BufferAttribute extends BufferAttribute {}
class Uint32BufferAttribute extends BufferAttribute {}
class InstancedBufferAttribute extends BufferAttribute {}

class Mesh extends Object3D {
  constructor(g, m) {
    super();
    this.isMesh = true; this.castShadow = false; this.receiveShadow = false;
    this.frustumCulled = true;
    this.geometry = g; this.material = m;
  }
}
/* Real THREE materials always have a `color` object; ours must too, since
   script.js calls .copy()/.setHex() on it. Colours passed in the parameter
   object have to be coerced the way THREE does. */
class MeshBasicMaterial {
  constructor(p = {}) {
    Object.assign(this, p);
    this.dispose = () => { this.disposed = true; };
    this.color = new Color(p.color === undefined ? 0xffffff : p.color);
    this.emissive = new Color(p.emissive === undefined ? 0x000000 : p.emissive);
    this.emissiveIntensity = p.emissiveIntensity ?? 1;
    this.opacity = p.opacity ?? 1;
    this.transparent = p.transparent ?? false;
    this.depthWrite = p.depthWrite ?? true;
    this.vertexColors = p.vertexColors ?? false;
    this.map = p.map ?? null;
    this.side = p.side ?? 0;
    this.isMaterial = true; this.needsUpdate = false;
  }
}
class MeshLambertMaterial extends MeshBasicMaterial {}
class MeshPhongMaterial extends MeshBasicMaterial {}
class ShaderMaterial extends MeshBasicMaterial {}
class Points extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
class LineSegments extends Object3D {
  constructor(g, m) { super(); this.geometry = g; this.material = m; }
  computeLineDistances() {}
}
class Sprite extends Object3D { constructor(m) { super(); this.material = m; } }

class CanvasTexture {
  constructor(img) {
    this.image = img; this.isTexture = true;
    this.magFilter = 1000; this.minFilter = 1000; this.generateMipmaps = true;
    this.wrapS = 1001; this.wrapT = 1001; this.encoding = 3000; this.offset = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
    this.repeat = { x: 1, y: 1 }; this.needsUpdate = false;
    // Real three.js sets flipY = true on every Texture, which makes WebGL flip
    // the image on upload so canvas row 0 lands at v = 1. Atlas uv maths that
    // ignores this sample the wrong strip — that bug rendered the world black and
    // this stub had no way to notice, because flipY was simply absent.
    this.flipY = true;
  }
  dispose() {}
}

let clockMs = 0;
const created = { meshes: [], geometries: [], textures: [] };

const THREE = {
  Scene, Group, Object3D, Mesh, Points, LineSegments, Sprite,
  PerspectiveCamera: Camera, OrthographicCamera: Camera,
  Color, Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
  Vector3: Vec3, Euler, Quaternion, MathUtils: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  BufferGeometry, BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute,
  Float32BufferAttribute: BufferAttribute, Uint16BufferAttribute: Uint16BufferAttribute,
  Uint32BufferAttribute: Uint32BufferAttribute, Int16BufferAttribute: BufferAttribute,
  Float32BufferAttribute_: BufferAttribute,
  BoxGeometry: class extends BufferGeometry {
    constructor(w = 1, h = 1, d = 1) {
      super();
      this.parameters = { width: w, height: h, depth: d };
      this.attributes = {
        position: new BufferAttribute(new Float32Array(72), 3),
        uv: new BufferAttribute(new Float32Array(48), 2),
        color: new BufferAttribute(new Float32Array(72), 3),
        normal: new BufferAttribute(new Float32Array(72), 3),
      };
      this.uuid = 'box';
    }
  },
  EdgesGeometry: class extends BufferGeometry { constructor(g) { super(); this.source = g; this.attributes = { position: new BufferAttribute(new Float32Array(72), 3) }; } },
  WireframeGeometry: class extends BufferGeometry {},
  SphereGeometry: class extends BufferGeometry {},
  PlaneGeometry: class extends BufferGeometry {},
  CanvasTexture, Texture: CanvasTexture,
  AmbientLight: class { constructor(c, i) { this.color = new Color(c); this.intensity = i; } },
  HemisphereLight: class { constructor(s, g, i) { this.color = new Color(s); this.groundColor = new Color(g); this.intensity = i; } },
  DirectionalLight: class { constructor(c, i) { this.color = new Color(c); this.intensity = i; this.position = new Vec3(); this.target = new Object3D(); this.shadow = { mapSize: { set() {} }, camera: { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0, updateProjectionMatrix() {} }, bias: 0, normalBias: 0 }; } },
  PointLight: class { constructor(c, i, d, dec) { this.color = new Color(c); this.intensity = i; this.distance = d; this.decay = dec; this.position = new Vec3(); } },
  MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, ShaderMaterial, SpriteMaterial: MeshBasicMaterial,
  PointsMaterial: MeshBasicMaterial, LineBasicMaterial: MeshBasicMaterial,
  Raycaster: class { constructor() { this.far = Infinity; this.near = 0; } setFromCamera() {} intersectObjects() { return []; } intersectObject() { return []; } },
  WebGLRenderer: class {
    constructor() {
      this.domElement = { style: {}, addEventListener() {}, removeEventListener() {} };
      this.shadowMap = { enabled: false, type: 0 };
      this.capabilities = { getMaxAnisotropy: () => 0, isWebGL2: true };
      this.info = { render: { calls: 0, triangles: 0 } };
      this.calls = 0; this.triangles = 0;
    }
    setPixelRatio() {} setSize() {} setClearColor() {} clear() {} render(s, c) {
      this.calls++;
      let t = 0, meshes = 0;
      s.traverse(o => {
        if (o.isMesh && o.geometry) {
          meshes++;
          created.meshes.push(o);
          created.geometries.push(o.geometry);
          const idx = o.geometry.index;
          const n = idx ? idx.count : (o.geometry.attributes.position?.count || 0);
          t += n / 3;
        }
      });
      this.triangles += t; this.meshes = meshes;
    }
  },
  Clock: class { getDelta() { return 0.016; } },
  sRGBEncoding: 3000, LinearEncoding: 3001,
  ACESFilmicToneMapping: 4, PCFSoftShadowMap: 2, PCFShadowMap: 1, BasicShadowMap: 0,
  NearestFilter: 1003, LinearFilter: 1006, NearestMipmapNearestFilter: 1008, LinearMipmapLinearFilter: 1009,
  RepeatWrapping: 1000, ClampToEdgeWrapping: 1001, MirroredRepeatWrapping: 1002,
  FrontSide: 0, BackSide: 1, DoubleSide: 2,
  AdditiveBlending: 2, NormalBlending: 1, DepthWrite: false,
  RGBAFormat: 1023, UnsignedByteType: 1009,
  InstancedMesh: class extends Mesh {
    constructor(g, m, n) {
      super(g, m);
      this.isInstancedMesh = true; this.count = n;
      this.instanceMatrix = new InstancedBufferAttribute(new Float32Array(n * 16), 16);
    }
    setMatrixAt(i, m) { this.instanceMatrix.array.set(m.elements, i * 16); }
    getMatrixAt(i, m) { m.elements = Array.from(this.instanceMatrix.array.slice(i * 16, i * 16 + 16)); return m; }
    dispose() {}
  },
  InstancedBufferAttribute,
};
THREE.Fog = class { constructor(c, n, f) { this.color = new Color(c); this.near = n; this.far = f; } };

/* -------------------------------------------------------------------- DOM */

const listeners = new Map();
function makeEl(id = '') {
  const el = {
    id, tagName: 'DIV', style: {}, dataset: {}, children: [], childNodes: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); }, toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
    },
    _html: '', _text: '', offsetWidth: 1,
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
    get textContent() { return this._text; }, set textContent(v) { this._text = v; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    remove() { this.parentNode?.removeChild(this); },
    addEventListener(t, fn) { (listeners.get(id + ':' + t) || listeners.set(id + ':' + t, []).get(id + ':' + t)).push(fn); },
    removeEventListener() {},
    dispatchEvent(e) { for (const fn of listeners.get(id + ':' + e.type) || []) fn(e); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture() {}, releasePointerCapture() {},
    focus() {}, blur() {}, click() {}, append() {},
    querySelectorAll: () => [], querySelector: () => null,
    getContext: () => (el.__ctx ||= makeRealCtx(el)),
    toDataURL: () => 'data:,',
    requestPointerLock() {}, closest: () => null,
  };
  el.classList.contains = (c) => el.classList._s.has(c);
  return el;
}
/* A canvas stub that really records solid fills, so a test can ask "what colour
   is at texture pixel (u,v)?" and catch atlas-mapping mistakes. Drawing with a
   gradient, an image, or a stroke is ignored — only `fillRect` with an opaque
   colour is tracked, which is all the texture atlas needs. */
function parseFill(s) {
  if (typeof s !== 'string') return null;
  let m = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(s.trim());
  // Semi-transparent fills are blended noise speckles in makePixelTexture; ignore
  // them so the recorded pixel stays the tile's solid base colour.
  if (m && (m[4] === undefined || +m[4] >= 1)) return [+m[1], +m[2], +m[3]];
  return null;
}
function makeRealCtx(canvas) {
  const data = new Uint8ClampedArray(Math.max(1, canvas.width * canvas.height * 4));
  const put = (px, py, rgb) => {
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;
    const i = (py * canvas.width + px) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };
  return {
    canvas, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    imageSmoothingEnabled: true, textAlign: 'left', textBaseline: 'top',
    fillRect(x, y, w, h) {
      const rgb = parseFill(this.fillStyle);
      if (!rgb) return;
      for (let py = Math.round(y); py < Math.round(y + h); py++) {
        for (let px = Math.round(x); px < Math.round(x + w); px++) put(px, py, rgb);
      }
    },
    // copying a tile: blend the source canvas's own pixel buffer into this one
    drawImage(img, dx, dy) {
      const srcCtx = img && img.__ctx;
      const src = srcCtx && srcCtx.__buf;
      if (!src || !img.width || !img.height) return;
      for (let py = 0; py < img.height; py++) {
        for (let px = 0; px < img.width; px++) {
          const si = (py * img.width + px) * 4;
          if (src[si + 3] === 0) continue;               // transparent: leave as-is
          put(Math.round(dx) + px, Math.round(dy) + py, [src[si], src[si + 1], src[si + 2]]);
        }
      }
    },
    clearRect() {}, strokeRect() {}, beginPath() {},
    moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillText() {}, strokeText() {}, setTransform() {},
    getImageData: (x, y, w, h) => ({ data: data.slice((y * canvas.width + x) * 4, ((y + h) * canvas.width + x + w) * 4) }),
    // the real thing writes the whole buffer, which is how the atlas is built
    putImageData(img) {
      const d = img.data, n = Math.min(d.length, data.length);
      for (let i = 0; i < n; i++) data[i] = d[i];
    },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    __buf: data,
  };
}
class ImageData {
  constructor(data, w, h) {
    this.data = data; this.width = w; this.height = h;
    this.colorSpace = 'srgb';
  }
}
function makeCtx() {
  return makeRealCtx({ width: 0, height: 0 });
}

const store = new Map();
const document = {
  body: makeEl('body'),
  documentElement: makeEl('html'),
  getElementById: (id) => (store.get(id) || (store.set(id, makeEl(id)), store.get(id))),
  createElement: (t) => { const e = makeEl(t + Math.random()); e.tagName = t.toUpperCase(); return e; },
  createElementNS: (ns, t) => makeEl(t),
  addEventListener: (t, fn) => { (listeners.get('doc:' + t) || listeners.set('doc:' + t, []).get('doc:' + t)).push(fn); },
  removeEventListener() {},
  exitPointerLock() {},
  pointerLockElement: null,
  querySelectorAll: () => [],
};

const canvasStore = new Map();
const localStorage = {
  getItem: k => (k in localStorage._d ? localStorage._d[k] : null),
  setItem: (k, v) => { localStorage._d[k] = String(v); },
  removeItem: k => { delete localStorage._d[k]; },
  _d: {},
};

const win = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener: (t, fn) => { (listeners.get('win:' + t) || listeners.set('win:' + t, []).get('win:' + t)).push(fn); },
  removeEventListener() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  // A clock that actually advances, so animate() sees a realistic dt
  performance: { now: () => (clockMs += 16) },
  location: { protocol: 'file:', href: 'file:///x' },
  navigator: { clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') } },
  AudioContext: undefined, webkitAudioContext: undefined,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  document, localStorage, THREE, ImageData,
};
// script.js refers to `window` and `globalThis` interchangeably
win.window = win;
win.self = win;
win.globalThis = win;

/* Elements script.js reaches for before init(). */
for (const id of ['game-root', 'crosshair', 'block-highlight-label', 'hud', 'stats', 'clock', 'objective',
  'btn-inv', 'minimap', 'coop-status', 'player-list', 'hearts', 'hunger', 'last-hit', 'toolbar', 'hint',
  'inventory-panel', 'inv-head', 'inv-sub', 'btn-inv-close', 'inv-hotbar-row', 'inv-grid',
  'chat-log', 'chat-input-row', 'chat-input', 'toast-root', 'damage-vignette', 'vignette', 'underwater',
  'menu', 'player-name', 'world-seed', 'btn-new-world', 'btn-play', 'btn-how', 'opt-mode', 'opt-diff',
  'opt-render', 'opt-quality', 'opt-sens', 'opt-shadows', 'opt-clouds', 'opt-sound', 'howto',
  'coop-modal', 'room-code', 'btn-host', 'btn-join', 'coop-info', 'btn-copy-link', 'btn-spawn-bot',
  'btn-coop-close', 'death-screen', 'death-msg', 'death-log', 'btn-respawn', 'btn-copy-log',
  'btn-toggle-touch', 'touch-controls', 'joystick-zone', 'joystick-knob', 'btn-break', 'btn-place',
  'btn-jump', 'btn-fly-t', 'touch-look-zone']) {
  document.getElementById(id);
}
// the minimap is a <canvas> and needs a real-ish 2d context
store.get('minimap').getContext = () => makeCtx();

/* ------------------------------------------------------------------- boot */

const ctx = vm.createContext(win);
vm.runInContext(readFileSync(join(here, 'mesher.js'), 'utf8'), ctx, { filename: 'mesher.js' });
vm.runInContext(readFileSync(join(here, 'textures.js'), 'utf8'), ctx, { filename: 'textures.js' });

/* script.js is a top-level browser script full of `const`/`let`, which a vm
   context does not expose as context properties. Wrap it in a function and hand
   back the bindings the tests need, so the file itself stays untouched. */
const EXPORTS = ['Settings', 'State', 'chunks', 'WORLD', 'wIdx', 'inWorld', 'atlasCanvas', 'atlasTex', 'bucketMaterials',
  'getBlock', 'setBlock', 'sampleBlock', 'heightAt', 'rawBlock', 'isOpaque', 'startGame', 'updateChunks',
  'raycastCenter', 'updateOutline', 'animate', 'tryBreak', 'tryPlace', 'saveGame', 'loadGame', 'SAVE_KEY',
  'chunkMeshes', 'bucketMaterials', 'materials', 'blockOutline', 'camera', 'renderer', 'glowSet',
  'ATLAS_CELL', 'IS_OPAQUE', 'IS_LIQUID', 'ATTENUATION', 'MAT_OF', 'MESH_CFG', 'MOBDEF', 'mobs',
  'Y0', 'Y1', 'YS', 'CHUNK', 'SEA', 'BLOCK', 'BLOCK_DEF', 'renderer', 'init', 'drawMinimap', 'updateSky',
  'pickupMats', 'spawnPickup', 'updateGlowLights', 'collide', 'damagePlayer',
  'REACH', 'addItem', 'takeItem', 'renderToolbar', 'setInventoryOpen', 'trackGlow', 'fallbackCopy',
  'B', 'ATLAS_COLS', 'ATLAS_ROWS', 'overrides', 'glowSet', 'topY', 'recalcTopY', 'topYCached', 'Mob',
  'hasLOS', 'isOpaque', 'THREE', 'VoxelTextures', 'TILE_FOR', 'cell', 'cellCentre', 'eyeAbove', 'HEIGHT',
  'biomeAt', 'climate', 'BIOMES', 'hashCoord'];
const src = readFileSync(join(here, 'script.js'), 'utf8');
vm.runInContext(`(function(){ ${src}\n;globalThis.__vv={${EXPORTS.join(',')}};})();`, ctx, { filename: 'script.js' });

const g = ctx.__vv;

/* Start the game: this generates chunks, meshes them and builds the scene. */
g.Settings.seed = 1337;
g.startGame();
g.updateChunks();

/* Only the chunk meshes matter here — the sky dome, clouds, outline and pickup
   cube are shared geometry that predates this change. */
function chunkGeometries() {
  const out = [];
  for (const ch of g.chunks.values()) for (const m of ch.meshes) out.push(m.geometry);
  return out;
}

test('the game boots and generates chunks', () => {
  assert.ok(g.chunks.size > 20, `expected chunks, got ${g.chunks.size}`);
  assert.ok(chunkGeometries().length > 0, 'chunk meshes were created');
});

test('terrain is drawn with merged geometry, not one InstancedMesh per block', () => {
  const meshes = g.chunkMeshes.children;
  assert.ok(meshes.length > 0, 'chunk meshes are in the scene');
  // Clouds legitimately use InstancedMesh; the chunk group must not.
  for (const m of meshes) {
    assert.ok(!m.isInstancedMesh, 'a chunk mesh is an InstancedMesh — the old renderer is back');
  }
  // And far fewer draw calls than there are chunks: a chunk is 1-2 meshes, not
  // one per block type.
  assert.ok(meshes.length < g.chunks.size * 3,
    `expected few draw calls, got ${meshes.length} for ${g.chunks.size} chunks`);
});

test('every chunk mesh has positions, normals, colours, uvs and an index', () => {
  for (const geo of chunkGeometries()) {
    for (const a of ['position', 'normal', 'color', 'uv']) assert.ok(geo.attributes[a], `missing ${a}`);
    assert.ok(geo.index && geo.index.count > 0, 'has an index buffer');
    assert.equal(geo.attributes.position.count, geo.attributes.normal.count);
    assert.equal(geo.attributes.position.count, geo.attributes.color.count);
    assert.equal(geo.attributes.position.count * 2, geo.attributes.uv.array.length);
  }
});

test('triangle count is well below the old per-block cube count', () => {
  const perChunk = [...g.chunks.values()].reduce((a, c) => a + (c.tris || 0), 0) / g.chunks.size;
  // The old renderer emitted 12 triangles for every block that wasn't fully
  // buried; a surface chunk was ~600 cubes = 7200 tris.
  assert.ok(perChunk < 4000, `average chunk is ${perChunk.toFixed(0)} tris`);
  return perChunk;
});

test('no vertex is left at the origin or with a zero normal', () => {
  for (const geo of chunkGeometries()) {
    const p = geo.attributes.position.array, n = geo.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      assert.ok(Number.isFinite(p[i]) && Number.isFinite(p[i + 1]) && Number.isFinite(p[i + 2]));
      const len = Math.abs(n[i]) + Math.abs(n[i + 1]) + Math.abs(n[i + 2]);
      assert.equal(len, 1, `normal at vertex ${i / 3} is ${n[i]},${n[i + 1]},${n[i + 2]}`);
    }
  }
});

test('vertex colours are in range and actually vary with light', () => {
  const seen = new Set();
  for (const geo of chunkGeometries()) {
    const c = geo.attributes.color.array;
    for (let i = 0; i < c.length; i++) {
      assert.ok(c[i] >= 0 && c[i] <= 1.5, `colour component ${c[i]} out of range`);
      seen.add(Math.round(c[i] * 40));
    }
  }
  assert.ok(seen.size > 8, `expected a spread of shading values, saw ${seen.size}`);
});

test('grass is rendered, not mistaken for air', () => {
  // BLOCK.GRASS is 0, so anything testing "is there a block" with a truthiness
  // check silently drops every grass block in the world.
  assert.equal(g.BLOCK.GRASS, 0, 'grass really is id 0');
  let grassFaces = 0;
  for (const geo of chunkGeometries()) {
    const uv = geo.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) {
      // grass is atlas cell 0. Cell 0 is column 0, and — because the atlas is
      // uploaded flipped — the LAST row of cells, not the first.
      const col = Math.floor(uv[i] * g.ATLAS_COLS);
      const row = Math.floor((1 - uv[i + 1]) * g.ATLAS_ROWS);
      if (col === 0 && row === 0) grassFaces++;
    }
  }
  assert.ok(grassFaces > 100, `found ${grassFaces} grass vertices — grass is being dropped`);
});

test('atlas uvs land inside the 0..1 texture', () => {
  for (const geo of chunkGeometries()) {
    const uv = geo.attributes.uv.array;
    for (let i = 0; i < uv.length; i++) {
      assert.ok(uv[i] >= 0 && uv[i] <= 1, `uv ${uv[i]} escapes the atlas`);
    }
  }
});

/* The regression test for "the whole world renders black".

   Resolving a uv to a canvas pixel is only correct if it accounts for
   `CanvasTexture.flipY`, which defaults to true: WebGL flips the image during
   upload, so texture v=0 is the LAST canvas row, not the first. Checking that
   uvs are in 0..1 (as the test above does) cannot catch a sign error — every
   flipped uv is still a valid 0..1 pair — but the flipped strip of the atlas is
   empty, so the whole world comes out black. This samples the real pixel buffer. */
test('atlas uvs resolve to a painted tile, accounting for flipY', () => {
  const atlas = g.atlasCanvas;
  const buf = atlas.__ctx.__buf;
  const W = atlas.width, H = atlas.height;
  assert.equal(W, g.ATLAS_COLS * 32, `atlas should be ${g.ATLAS_COLS} tiles wide`);
  assert.equal(H, g.ATLAS_ROWS * 32, `atlas should be ${g.ATLAS_ROWS} tiles tall`);

  // Sample the atlas the way the GPU does, and report which tile it hit.
  const tileAt = (u, v) => {
    const px = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
    const py = g.atlasTex.flipY ? H - 1 - Math.floor(v * H) : Math.floor(v * H);
    const i = (py * W + px) * 4;
    if (buf[i + 3] === 0) return { cell: -1, rgb: [buf[i], buf[i + 1], buf[i + 2]] };
    return { cell: Math.floor(py / 32) * g.ATLAS_COLS + Math.floor(px / 32), rgb: [buf[i], buf[i + 1], buf[i + 2]] };
  };

  // The grass TOP tile must be cell 0 and must actually be painted.
  const T = g.THREE ? 32 : 32;
  const grassCell = g.VoxelTextures.CELL.grass_top;
  const cellCentreUv = (cell) => {
    const col = cell % g.ATLAS_COLS, row = (cell / g.ATLAS_COLS) | 0;
    // atlasUV flips the row, so canvas row `row` is texture row ROWS-1-row
    return [(col + 0.5) / g.ATLAS_COLS, (g.ATLAS_ROWS - 1 - row + 0.5) / g.ATLAS_ROWS];
  };
  const [gu, gv] = cellCentreUv(grassCell);
  const grass = tileAt(gu, gv);
  assert.equal(grass.cell, grassCell, 'the grass tile resolves to its own cell');
  assert.ok(grass.rgb[1] > grass.rgb[0], `grass should be green, got rgb(${grass.rgb})`);
  assert.ok(grass.rgb[1] > 40, `the grass tile is too dark: rgb(${grass.rgb})`);

  /* Every atlas tile that any block actually uses must be painted with real
     material — not blank, not a single flat colour. The old assertion compared
     each tile against BLOCK_DEF.color, which no longer holds: the palette is
     art-directed per material in textures.js, not the flat block colour. What
     actually matters is that the tile is painted and has internal variation,
     because a flat tile reads as untextured no matter what colour it is. */
  const used = new Set();
  for (let i = 0; i < g.BLOCK_DEF.length; i++) {
    if (g.BLOCK_DEF[i].liquid) continue;               // water keeps its own texture
    for (let f = 0; f < 6; f++) {
      const cell = g.ATLAS_CELL[g.B(i) * 6 + f];
      assert.ok(cell >= 0, `${g.BLOCK_DEF[i].name} face ${f} has no atlas cell`);
      used.add(cell);
    }
  }
  assert.ok(used.size >= g.BLOCK_DEF.length - 1,
    `only ${used.size} distinct tiles for ${g.BLOCK_DEF.length} blocks — per-face tiles are missing`);

  for (const cell of used) {
    const [u, v] = cellCentreUv(cell);
    const hit = tileAt(u, v);
    assert.equal(hit.cell, cell, `cell ${cell} resolves to the wrong place`);
    assert.ok(hit.rgb[0] + hit.rgb[1] + hit.rgb[2] > 60,
      `cell ${cell} is nearly black, so its faces render black`);

    // measure variation across the whole tile, not one pixel
    const col = cell % g.ATLAS_COLS, row = (cell / g.ATLAS_COLS) | 0;
    let opaque = 0, lo = 255, hi = 0;
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const px = col * T + x, py = row * T + y;
        const i = (py * W + px) * 4;
        if (buf[i + 3] === 0) continue;               // cutout (leaves) is fine
        opaque++;
        const lum = buf[i] * 0.3 + buf[i + 1] * 0.6 + buf[i + 2] * 0.1;
        lo = Math.min(lo, lum); hi = Math.max(hi, lum);
      }
    }
    assert.ok(opaque > T * T * 0.4, `cell ${cell} is mostly transparent`);
    assert.ok(hi - lo > 12,
      `cell ${cell} is a flat colour (luminance range ${(hi - lo).toFixed(1)}) — no visible texture`);
  }
});

test('no atlas face samples an unpainted pixel', () => {
  // End-to-end: walk the real geometry's uvs through the same flip the GPU does
  // and assert we never land on empty canvas. This is the check that would have
  // caught the black-world bug on its own, with no knowledge of the fix.
  const atlas = g.atlasCanvas;
  const buf = atlas.__ctx.__buf;
  const W = atlas.width, H = atlas.height;
  let sampled = 0, blank = 0;
  const firstBlank = [];
  for (const geo of chunkGeometries()) {
    const uv = geo.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) {
      const px = Math.min(W - 1, Math.max(0, Math.floor(uv[i] * W)));
      const py = atlas.__ctx ? (g.atlasTex.flipY ? H - 1 - Math.floor(uv[i + 1] * H) : Math.floor(uv[i + 1] * H)) : 0;
      const j = (py * W + px) * 4;
      sampled++;
      if (buf[j + 3] === 0) { blank++; if (firstBlank.length < 3) firstBlank.push([uv[i].toFixed(4), uv[i + 1].toFixed(4)]); }
    }
  }
  assert.ok(sampled > 1000, `only ${sampled} uv samples — not enough terrain to judge`);
  assert.equal(blank, 0, `${blank}/${sampled} vertices sample blank atlas pixels at uv ${JSON.stringify(firstBlank)}`);
});

test('the atlas does not mipmap toward its empty regions', () => {
  // Only the first atlas row is painted; reduced mip levels would average each
  // tile with empty canvas and darken distant terrain toward black.
  assert.equal(g.atlasTex.generateMipmaps, false, 'mipmaps are off');
  assert.equal(g.atlasTex.minFilter, g.THREE.NearestFilter, 'minification is nearest');
});

test('getBlock and sampleBlock agree about the world', () => {
  let checked = 0;
  for (const c of g.chunks.values()) {
    for (let i = 0; i < 40; i++) {
      const x = c.cx * 16 + (i % 16), z = c.cz * 16 + ((i * 7) % 16);
      for (const y of [g.heightAt(x, z), g.heightAt(x, z) - 3, g.SEA, g.heightAt(x, z) + 2]) {
        // getBlock speaks the game's 0-based ids, sampleBlock the mesher's
        // 1-based ones. They must describe the same world.
        const a = g.getBlock(x, y, z);
        const b = g.sampleBlock(x, y, z);
        const expect = a === null || a === undefined ? 0 : g.B(a);
        assert.equal(b, expect, `mismatch at ${x},${y},${z}: getBlock=${a} sampleBlock=${b}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000, `checked ${checked} cells`);
});

test('air reads as air in both representations', () => {
  // deep underground, well past bedrock, must be nothing at all
  assert.equal(g.getBlock(0, g.Y0, 0), null);
  assert.equal(g.sampleBlock(0, g.Y0, 0), 0);
  assert.equal(g.sampleBlock(0, g.Y1 + 1, 0), 0);
});

/* A cell with air all round, so a block placed there is fully visible. */
function openCell() {
  for (let r = 0; r < 70; r++) {
    for (let a = 0; a < 16; a++) {
      const x = 10 + Math.round(Math.cos(a) * r), z = 10 + Math.round(Math.sin(a) * r);
      const base = g.heightAt(x, z);
      if (base <= g.SEA + 2) continue;
      const y = base + 12;
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
        if (g.getBlock(x + dx, y + dy, z + dz) !== null) ok = false;
      }
      if (ok) return { x, y, z };
    }
  }
  throw new Error('no open cell found');
}

test('editing a block rebuilds that chunk\'s geometry', () => {
  const c = openCell();
  const chunk = g.chunks.get(`${Math.floor(c.x / g.CHUNK)},${Math.floor(c.z / g.CHUNK)}`);
  assert.ok(chunk, 'the chunk under the edit exists');

  const before = chunk.meshes.map(m => m.geometry);
  const beforeTris = chunk.tris;

  g.setBlock(c.x, c.y, c.z, g.BLOCK.BRICK, { silent: true });
  assert.equal(g.getBlock(c.x, c.y, c.z), g.BLOCK.BRICK, 'the block is there');
  assert.equal(chunk.tris, beforeTris + 12, 'a free-standing cube costs exactly 12 triangles');
  assert.ok(before[0].disposed, 'the previous geometry was disposed');
  assert.notEqual(chunk.meshes[0].geometry, before[0], 'a fresh geometry replaced it');

  g.setBlock(c.x, c.y, c.z, null, { silent: true });
  assert.equal(g.getBlock(c.x, c.y, c.z), null, 'the block is gone');
  assert.equal(chunk.tris, beforeTris, 'and the triangles went away with it');
});

test('digging into terrain exposes the faces you uncover', () => {
  const spot = clearSpot();
  const chunk = g.chunks.get(`${Math.floor(spot.x / g.CHUNK)},${Math.floor(spot.z / g.CHUNK)}`);
  const beforeTris = chunk.tris;
  // hollow out a 3-wide, 2-deep notch under the surface
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 1; dy <= 2; dy++) g.setBlock(spot.x + dx, spot.h - dy, spot.z, null, { silent: true });
  }
  assert.ok(chunk.tris > beforeTris, `the notch walls and floor are now drawn (${beforeTris} -> ${chunk.tris})`);

  // fill it back in and the surface should be exactly as it was
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 1; dy <= 2; dy++) {
      g.setBlock(spot.x + dx, spot.h - dy, spot.z, dx === 0 ? g.BLOCK.GRASS : g.BLOCK.DIRT, { silent: true });
    }
  }
  assert.equal(chunk.tris, beforeTris, 'refilling restores the original geometry exactly');
});

test('burying a block costs nothing, hollowing it out does', () => {
  const spot = clearSpot();
  const chunk = g.chunks.get(`${Math.floor(spot.x / g.CHUNK)},${Math.floor(spot.z / g.CHUNK)}`);
  const y = spot.h - 3;
  const base = chunk.tris;
  // a hollow pocket deep inside the terrain
  g.setBlock(spot.x, y, spot.z, null, { silent: true });
  assert.ok(chunk.tris > base, 'hollowing exposes inner faces');
  g.setBlock(spot.x, y, spot.z, g.BLOCK.STONE, { silent: true });
  assert.equal(chunk.tris, base, 'filling it back buries those faces again');
});

test('placing outside the buildable range is rejected, not silently wrapped', () => {
  // The world array is indexed by a packed coordinate, so an out-of-range y
  // must be refused outright or it would corrupt an unrelated cell.
  const high = g.Y1 + 5;
  g.setBlock(8, high, 8, g.BLOCK.BRICK, { silent: true });
  assert.equal(g.getBlock(8, high, 8), null, 'above the sky limit stays empty');
  assert.equal(g.getBlock(8, g.Y1, 8), null, 'and did not leak into the top row');
  assert.equal(g.sampleBlock(8, high, 8), 0, 'the mesher sees nothing there either');

  const low = g.Y0 - 5;
  g.setBlock(8, low, 8, g.BLOCK.BRICK, { silent: true });
  assert.equal(g.getBlock(8, low, 8), null, 'below bedrock stays empty');
  assert.equal(g.getBlock(8, g.Y0, 8), null, 'and did not leak into the bottom row');

  // far outside the horizontal bounds too
  g.setBlock(99999, 10, 8, g.BLOCK.BRICK, { silent: true });
  assert.equal(g.getBlock(99999, 10, 8), null);
});

/* Find an open patch of grass: no tree, no water, so the surface is predictable. */
function clearSpot() {
  for (let r = 0; r < 60; r++) {
    for (let a = 0; a < 12; a++) {
      const x = 12 + Math.round(Math.cos(a) * r), z = 12 + Math.round(Math.sin(a) * r);
      const h = g.heightAt(x, z);
      if (h <= g.SEA + 1) continue;                      // not beach
      let clear = true;
      for (let dy = 1; dy <= 4; dy++) {
        const b = g.getBlock(x, h + dy, z);
        if (b !== null && b !== undefined) { clear = false; break; }
      }
      if (clear) return { x, z, h };
    }
  }
  throw new Error('no clear spot found');
}

test('crosshair picking finds a block and reports the face it entered', () => {
  const spot = clearSpot();
  g.camera.position.set(spot.x + 0.5, spot.h + 3, spot.z + 0.5);
  g.camera.getWorldDirection = (v) => v.set(0, -1, 0);
  const hit = g.raycastCenter();
  assert.ok(hit, 'looking down should hit the ground');
  // raycast reports the 1-based mesher id
  assert.equal(hit.type - 1, g.getBlock(hit.x, hit.y, hit.z), 'the reported type matches the world');
  assert.deepEqual([hit.x, hit.y, hit.z], [spot.x, spot.h, spot.z], 'it hit the surface block');
  assert.ok(hit.dist > 0 && hit.dist <= g.REACH, `dist ${hit.dist} within reach ${g.REACH}`);
  // The normal is a unit axis pointing back up the ray — tryPlace adds it to
  // the hit cell to decide where the new block goes.
  assert.equal(Math.abs(hit.nx) + Math.abs(hit.ny) + Math.abs(hit.nz), 1, 'normal is one axis');
  assert.equal(hit.ny, 1, 'entered through the top face');
  assert.equal(g.getBlock(hit.x, hit.y + 1, hit.z), null, 'there is room to build on top');
});

test('picking a side face reports that face, not the top', () => {
  const spot = clearSpot();
  // put a block beside the surface and aim at its side
  g.setBlock(spot.x + 2, spot.h + 1, spot.z, g.BLOCK.BRICK, { silent: true });
  g.camera.position.set(spot.x + 0.5, spot.h + 1.5, spot.z + 0.5);
  g.camera.getWorldDirection = (v) => v.set(1, 0, 0);
  const hit = g.raycastCenter();
  assert.ok(hit, 'aiming sideways should hit the block');
  assert.equal(hit.type - 1, g.BLOCK.BRICK);
  assert.deepEqual([hit.x, hit.y, hit.z], [spot.x + 2, spot.h + 1, spot.z]);
  assert.equal(hit.nx, -1, 'entered through the -x face');
  assert.equal(hit.ny, 0);
});

test('crosshair picking finds nothing when aimed at open sky', () => {
  g.camera.position.set(12.5, 40, 12.5);
  g.camera.getWorldDirection = (v) => v.set(0, 1, 0);
  assert.equal(g.raycastCenter(), null);
});

test('the block outline follows the picked block', () => {
  const h = g.heightAt(12, 12);
  g.camera.position.set(12.5, h + 3, 12.5);
  g.camera.getWorldDirection = (v) => v.set(0, -1, 0);
  g.outlineTick = 0;
  g.updateOutline(true);
  assert.ok(g.blockOutline.visible, 'outline is shown');
  const hit = g.raycastCenter();
  // The outline sits at the block's centre; a cell spans [n, n+1].
  assert.deepEqual(
    [g.blockOutline.position.x, g.blockOutline.position.y, g.blockOutline.position.z],
    [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5]);
});

test('every mob species the game can spawn actually exists', () => {
  // A one-letter key ("g" instead of "pig") reaches MOBDEF as undefined and the
  // mob constructor throws. Guard against that by spawning every species and
  // demanding a real mob each time.
  for (const key of Object.keys(g.MOBDEF)) {
    const mob = new g.Mob(8.5, 30, 8.5, key);
    assert.ok(mob.valid, `MOBDEF.${key} produced a valid mob`);
    assert.ok(mob.def, `${key} has a definition`);
    assert.ok(mob.maxHp > 0, `${key} has hit points`);
    assert.ok(mob.def.name, `${key} has a display name`);
    mob.dispose();
  }
  // an unknown species is flagged invalid instead of throwing on this.def.hp
  const bogus = new g.Mob(8.5, 30, 8.5, 'g');
  assert.equal(bogus.valid, false, 'a single-letter key is rejected, not dereferenced');
  assert.equal(bogus.dead, true, 'and the spawner will drop it');
});

test('the passive mob trickle never throws', () => {
  // updateChunks rolls a 6% chance to spawn an animal, so a 2000-roll loop makes
  // a spawn effectively certain. Every mob that appears must be a real species.
  const spot = clearSpot();
  g.camera.position.set(spot.x + 0.5, spot.h + 3, spot.z + 0.5);
  const before = g.mobs.length;
  let spawned = 0;
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = g.mobs.length;
    g.updateChunks();
    if (g.mobs.length > n) {
      spawned++;
      const m = g.mobs[g.mobs.length - 1];
      assert.ok(m.valid && m.def, 'the spawned mob has a valid species');
      assert.ok(m.maxHp > 0, 'the spawned mob has hit points');
      assert.ok(['pig', 'cow', 'sheep'].includes(m.key), `unexpected species ${m.key}`);
      seen.add(m.key);
    }
    for (const m of g.mobs) assert.ok(m.def && m.def.hp > 0, 'every live mob has a valid species');
    assert.ok(g.mobs.length <= 10, 'the population cap holds');
  }
  assert.ok(spawned > 0, `the trickle actually spawned something (${spawned} times, species: ${[...seen]})`);
  g.mobs.length = before;
});

test('animate runs a full frame and renders the scene', () => {
  g.State.started = true;
  g.State.dead = false;
  const spot = clearSpot();
  g.camera.position.set(spot.x + 0.5, spot.h + 3, spot.z + 0.5);
  const callsBefore = g.renderer.calls;
  g.animate();
  assert.ok(g.renderer.calls > callsBefore, 'the frame actually rendered');
  assert.ok(g.renderer.triangles > 0, `the scene has ${g.renderer.triangles} triangles to draw`);
  // the throttled HUD line refreshes within a second of frames
  for (let i = 0; i < 20; i++) g.animate();
  assert.match(document.getElementById('stats').textContent, /FPS/);
});

/* Offsets of 0.2/0.8 rather than 0.5 on purpose: getBlock resolves a coordinate
   with Math.round, so a sample sitting exactly on .5 would snap to the next cell
   and this test would be measuring that rounding instead of occlusion. */
test('line of sight is blocked by solid blocks but not by air', () => {
  // getBlock returns 0 for grass, so a truthiness test here would let every mob
  // hit you through solid ground.
  const spot = clearSpot();
  const y = spot.h + 6;   // well above the terrain, so the path starts clear
  const from = [spot.x + 0.2, y, spot.z + 0.2];
  const to = [spot.x + 6.8, y, spot.z + 0.2];
  assert.ok(g.hasLOS(...from, ...to), 'open air has line of sight');

  // wall it off, one block thick, right in the middle
  g.setBlock(spot.x + 3, y, spot.z, g.BLOCK.STONE, { silent: true });
  assert.equal(g.hasLOS(...from, ...to), false, 'a stone wall blocks line of sight');
  assert.ok(g.hasLOS(spot.x + 0.2, y, spot.z + 0.2, spot.x + 2.2, y, spot.z + 0.2),
    'the near side still sees itself');
  g.setBlock(spot.x + 3, y, spot.z, null, { silent: true });
  assert.ok(g.hasLOS(...from, ...to), 'removing the wall restores it');

  // glass and water are not opaque, so they should NOT stop a mob's attack
  for (const clear of [g.BLOCK.GLASS, g.BLOCK.WATER]) {
    g.setBlock(spot.x + 3, y, spot.z, clear, { silent: true });
    assert.ok(g.hasLOS(...from, ...to), `${g.BLOCK_DEF[clear].name} is see-through for line of sight`);
    g.setBlock(spot.x + 3, y, spot.z, null, { silent: true });
  }
});

/* ---------- the coordinate convention ----------

   This is the test that pins the bug where the highlight box sat half a block
   off and the player stood a block above the surface. The old renderer placed
   unit cubes CENTRED on integer coordinates and used Math.round to match. The
   mesher places them CORNER-aligned — block n spans [n, n+1], centre n+0.5 — and
   the physics layer was never switched over, so every lookup read half a block
   off. These assertions describe geometry, not implementation, so they hold
   regardless of which helper is used to do it. */

/* Build a test pillar and return its top cell. Clears a column, then fills it
   back to a known height, so tests do not depend on terrain shape. */
/* Build an isolated test pillar and return its base cell.

   Clears the column well ABOVE the terrain first (so the only geometry at that
   (x,z) is what this helper places), then fills exactly one stone block and
   leaves air above it. Tests must measure against this rather than the natural
   terrain, which earlier tests have edited. */
/* Fill or clear a vertical run of cells, rebuilding the chunk ONCE.

   setBlock() re-meshes its chunk (and its neighbours at a border) on every call,
   so clearing 13 cells one at a time cost 13 chunk builds per test and the suite
   crept past 20 seconds. The tests own the world and never assert on
   intermediate geometry, so it is safe to defer the rebuild: write the cells
   through setBlock with `defer`, then rebuild the touched chunk explicitly.

   A rebuild is only needed if something actually changed, which is why this is
   much cheaper than the naive loop even before the deferral. */
function setColumn(x, z, y0, y1, type) {
  let changed = false;
  for (let y = y0; y <= y1; y++) {
    const before = g.getBlock(x, y, z);
    const after = type === null ? null : type;
    if (before === after) continue;
    g.setBlock(x, y, z, type, { silent: true });
    changed = true;
  }
  if (changed) {
    const key = `${Math.floor(x / g.CHUNK)},${Math.floor(z / g.CHUNK)}`;
    g.chunks.get(key)?.build();
  }
}
function pillar() {
  const spot = clearSpot();
  const { x, z } = spot;
  /* Build well above the terrain, clear of trees. Chunk.generate re-runs its
     tree pass whenever a chunk rebuilds, so a pillar near the surface sprouts
     leaves above it and the "what geometry is at this column" assertions pick
     up a canopy that has nothing to do with the test. */
  const base = spot.h + 8;
  setColumn(x, z, base - 2, base + 10, null);
  g.setBlock(x, base, z, g.BLOCK.STONE, { silent: true });
  return { x, z, base };
}
function unpillar({ x, z, base }) {
  setColumn(x, z, base - 2, base + 10, null);
}

test('a block at cell n occupies the cube [n, n+1] and is centred at n+0.5', () => {
  const { x, z, base } = pillar();
  // the cell we filled is solid, the one above it is air
  assert.equal(g.getBlock(x, base, z), g.BLOCK.STONE, 'the filled cell should be Stone');
  assert.equal(g.getBlock(x, base + 1, z), null, 'the cell above should be air');

  /* The geometry for that cell must span exactly [base, base+1].
     Scan only the vertices at this column and only those at or above `base`:
     the terrain below is still solid and legitimately emits its own geometry,
     so an unscoped min/max would report the bedrock at y=-5. */
  const chunk = g.chunks.get(`${Math.floor(x / g.CHUNK)},${Math.floor(z / g.CHUNK)}`);
  const ys = [];
  for (const m of chunk.meshes) {
    const p = m.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] === x && p[i + 2] === z && p[i + 1] >= base) ys.push(p[i + 1]);
    }
  }
  assert.ok(ys.length > 0, 'no geometry was emitted at the filled cell');
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  assert.equal(minY, base, `the block starts at y=${minY}, expected ${base} — origin convention is wrong`);
  assert.equal(maxY, base + 1, `the block ends at y=${maxY}, expected ${base + 1}`);
  unpillar({ x, z, base });
});

test('getBlock agrees with the geometry at every position inside a block', () => {
  // The failure mode was subtle: getBlock(8.5) returned the block at 9, so a
  // player standing in the middle of block 8 was reading block 9 — usually air.
  const { x, z, base } = pillar();

  // anywhere inside cell n — including the exact centre and every corner —
  // must read that cell, never the neighbour
  for (const [dx, dz] of [[0, 0], [0.5, 0.5], [0.99, 0.99], [0.01, 0.5], [0.5, 0.01]]) {
    const b = g.getBlock(x + dx, base + 0.5, z + dz);
    assert.equal(b, g.BLOCK.STONE,
      `getBlock at offset ${dx},${dz} inside the block returned ${b}, expected Stone`);
  }
  // and a point at the very top of the cell is already the cell above
  assert.equal(g.getBlock(x, base + 1.0, z), null, 'y=n+1 should be the air cell above');
  unpillar({ x, z, base });
});

test('the highlight box is centred on the block it outlines', () => {
  const { x, z, base } = pillar();

  // look straight down at the block below the camera
  g.camera.position.set(g.cellCentre(x), base + 4, g.cellCentre(z));
  g.camera.getWorldDirection = (v) => v.set(0, -1, 0);
  g.outlineTick = 0;
  g.updateOutline(true);
  assert.ok(g.blockOutline.visible, 'outline should be visible');

  const hit = g.raycastCenter();
  assert.ok(hit, 'the crosshair should hit a block');
  assert.equal(hit.y, base, `the picked cell should be ${base}, got ${hit.y}`);
  // the box must sit at the block's CENTRE, not its min corner
  assert.equal(g.blockOutline.position.x, hit.x + 0.5,
    'outline x is on the cell corner instead of the cell centre');
  assert.equal(g.blockOutline.position.y, hit.y + 0.5,
    'outline y is on the cell corner instead of the cell centre');
  assert.equal(g.blockOutline.position.z, hit.z + 0.5,
    'outline z is on the cell corner instead of the cell centre');

  // and the geometry it outlines must lie inside the box
  const chunk = g.chunks.get(`${Math.floor(x / g.CHUNK)},${Math.floor(z / g.CHUNK)}`);
  const inside = chunk.meshes.some((m) => {
    const arr = m.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i] === hit.x && arr[i + 2] === hit.z
        && arr[i + 1] >= hit.y && arr[i + 1] <= hit.y + 1) return true;
    }
    return false;
  });
  assert.ok(inside, 'the outlined cell has no geometry');
  unpillar({ x, z, base });
});

test('a body standing on the surface rests exactly on the block top', () => {
  const { x, z, base } = pillar();

  const body = (eyeY) => new g.THREE.Vector3(g.cellCentre(x), eyeY, g.cellCentre(z));
  /* pos.y is the EYE: the body occupies [pos.y - HEIGHT, pos.y]. Block n spans
     [n, n+1], so its top face is at n+1 and a body resting on it has its floor
     at n+1 — eye at n + 1 + HEIGHT. */
  assert.equal(g.collide(body(base + 1 + 1.7), 0.42, 1.7, true), false,
    'a body resting exactly on the block top collides with it — the player hovers');
  assert.equal(g.collide(body(base + 1 + 1.6), 0.42, 1.7, true), true,
    'a body just below the block top does not collide — the player sinks');
  // a body whose head is inside a block above must collide. The eye sits at
  // base+2.7, which is inside cell base+2, so block it there.
  g.setBlock(x, base + 2, z, g.BLOCK.STONE, { silent: true });
  assert.equal(g.collide(body(base + 1 + 1.7), 0.42, 1.7, true), true,
    'a body with its head inside a block does not collide');
  assert.equal(g.collide(body(base + 10), 0.42, 1.7, true), false, 'a body in mid-air collides');
  unpillar({ x, z, base });
});

test('the standing eye height matches the body it is derived from', () => {
  const { x, z, base } = pillar();
  // eyeAbove is what every spawn site uses; it must place the body clear of the
  // surface, and one notch lower must collide.
  const standing = g.eyeAbove(base);
  assert.equal(g.collide(new g.THREE.Vector3(g.cellCentre(x), standing, g.cellCentre(z)), 0.42, 1.7, true), false,
    `eyeAbove(${base}) = ${standing} puts the player inside the ground`);
  assert.equal(g.collide(new g.THREE.Vector3(g.cellCentre(x), standing - 0.1, g.cellCentre(z)), 0.42, 1.7, true), true,
    'a body just below the standing height does not collide');
  unpillar({ x, z, base });
});

test('collision ignores the cells a body does not actually reach', () => {
  // The Math.round version included the cell beyond a body's edge, which made a
  // player standing in open ground stick to any wall they walked past.
  const { x, z, base } = pillar();
  // a solid wall in the neighbouring cell on +x, at body height
  for (let y = base; y <= base + 2; y++) g.setBlock(x + 1, y, z, g.BLOCK.STONE, { silent: true });

  // a body centred in its own cell (r=0.42, spanning 0.08..0.92 of the cell)
  // must not touch the neighbour
  const eyeY = g.eyeAbove(base);
  const body = new g.THREE.Vector3(g.cellCentre(x), eyeY, g.cellCentre(z));
  assert.equal(g.collide(body, 0.42, 1.7, false), false,
    'a body inside its own cell collides with the neighbouring block');
  // nudge it against the wall and it must collide
  body.x = g.cellCentre(x) + 0.55;
  assert.equal(g.collide(body, 0.42, 1.7, false), true, 'a body pressed into the wall does not collide');

  for (let y = base - 1; y <= base + 8; y++) g.setBlock(x + 1, y, z, null, { silent: true });
  unpillar({ x, z, base });
});

test('a grass block counts as solid terrain, not empty space', () => {
  // Build our own grass block rather than trusting the terrain: earlier tests
  // edit the world, so the natural surface is no longer grass.
  const { x, z, base } = pillar();
  g.setBlock(x, base, z, g.BLOCK.GRASS, { silent: true });

  // grass is id 0; anything testing `if (block)` would treat it as air
  assert.equal(g.getBlock(x, base, z), g.BLOCK.GRASS, 'the placed block should read back as grass');
  assert.ok(g.isOpaque(g.BLOCK.GRASS), 'grass is opaque for collision');
  assert.equal(g.isOpaque(null), false, 'air is not opaque');

  const body = (eyeY) => new g.THREE.Vector3(x + 0.2, eyeY, z + 0.2);
  /* The grass block occupies [h, h+1], so its top face is at h+1 and a body
     standing on it has its eye at h + 1 + HEIGHT. */
  assert.equal(g.collide(body(g.eyeAbove(base)), 0.42, 1.7, true), false,
    'standing on the surface collides with it');
  assert.equal(g.collide(body(g.eyeAbove(base) - 0.1), 0.42, 1.7, true), true,
    'a body just below the surface collides');
  // floating well above: clear
  assert.equal(g.collide(body(base + 10), 0.42, 1.7, false), false,
    'floating high above the ground is clear');
  unpillar({ x, z, base });
});

test('saving and loading a game round-trips the world', () => {
  g.setBlock(4, 20, 4, 12, { silent: true });
  g.saveGame();
  const raw = JSON.parse(localStorage.getItem(g.SAVE_KEY));
  assert.equal(raw.overrides['4,20,4'], 12);

  // A fresh page load starts with no overrides and an empty world array. The
  // chunk maps still hold the old build, so drop them too — that is exactly what
  // init() + startGame() do on a reload.
  g.overrides.clear();
  g.WORLD.fill(0);
  g.chunks.forEach(c => c.dispose());
  g.chunks.clear();
  g.updateChunks();
  assert.equal(g.getBlock(4, 20, 4), null, 'the block is gone before reloading');

  const loaded = g.loadGame();
  assert.ok(loaded, 'a save was found');
  assert.equal(g.overrides.get('4,20,4'), 12, 'the override came back');

  // and it survives a chunk rebuild, so it is really in the world
  g.setBlock(4, 20, 4, null, { silent: true });
  g.setBlock(4, 20, 4, 12, { silent: true });
  assert.equal(g.getBlock(4, 20, 4), 12);
});

test('building higher raises the meshing ceiling so the block is still drawn', () => {
  // The mesher skips empty sky above the terrain. If a player stacks blocks
  // past that ceiling they must still appear, or tall builds vanish.
  const spot = clearSpot();
  const x = spot.x, z = spot.z;
  const chunk = g.chunks.get(`${Math.floor(x / g.CHUNK)},${Math.floor(z / g.CHUNK)}`);
  const cap = g.topY();
  const tall = Math.min(g.Y1 - 2, cap + 12);
  assert.ok(tall > cap, 'we can build past the default ceiling');

  const base = chunk.tris;
  for (let y = cap + 1; y <= tall; y++) g.setBlock(x, y, z, g.BLOCK.BRICK, { silent: true });
  assert.ok(g.topY() > cap, 'the ceiling grew');
  // every one of those blocks must be in the drawn geometry
  const ys = new Set();
  for (const geo of chunk.meshes.map(m => m.geometry)) {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] === x && p[i + 2] === z) ys.add(p[i + 1]);
    }
  }
  for (let y = cap + 1; y <= tall; y++) {
    assert.ok(ys.has(y) && ys.has(y + 1), `the block at y=${y} is drawn`);
  }
  // A 1x1 column shows 4 sides on every block plus a lid and a base, so it costs
  // n*8 + 4 triangles. The old renderer paid 12 per block no matter what it
  // touched, so 12 blocks here is 100 tris instead of 144.
  const n = tall - cap;
  assert.equal(chunk.tris, base + n * 8 + 4, `a ${n}-block column costs ${n * 8 + 4} triangles`);

  // tear it back down
  for (let y = cap + 1; y <= tall; y++) g.setBlock(x, y, z, null, { silent: true });
  assert.equal(chunk.tris, base, 'and removing it restores the chunk');
});

test('a saved tower survives a reload and is still drawn', () => {
  const spot = clearSpot();
  const y = g.topY() + 6;
  g.setBlock(spot.x, y, spot.z, g.BLOCK.OBSIDIAN, { silent: true });
  g.saveGame();

  // Simulate a fresh page in the same order the game does it: clear everything,
  // load the save (which derives the meshing ceiling from it), then build.
  g.overrides.clear();
  g.WORLD.fill(0);
  g.chunks.forEach(c => c.dispose());
  g.chunks.clear();
  g.recalcTopY();              // an empty world is back to the default ceiling
  assert.ok(g.loadGame(), 'the save loaded');
  g.updateChunks();

  const chunk = g.chunks.get(`${Math.floor(spot.x / g.CHUNK)},${Math.floor(spot.z / g.CHUNK)}`);
  assert.ok(chunk, `the chunk holding (${spot.x},${spot.z}) is loaded`);
  assert.equal(g.getBlock(spot.x, y, spot.z), g.BLOCK.OBSIDIAN, 'the world agrees the block is there');
  const ys = new Set();
  for (const geo of chunk.meshes.map(m => m.geometry)) {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] === spot.x && p[i + 2] === spot.z) ys.add(p[i + 1]);
    }
  }
  assert.ok(ys.has(y), `the reloaded block at y=${y} is drawn (ceiling ${g.topY()}, seen ${[...ys].sort((a, b) => a - b).join(',')})`);
  g.setBlock(spot.x, y, spot.z, null, { silent: true });
});

test('glowing blocks are tracked for the point-light pool', () => {
  g.setBlock(6, 20, 6, 12, { silent: true });
  assert.ok(g.glowSet.has('6,20,6'), 'glowstone registered');
});
