/* ==========================================================================
 * HYPERBOLIA — hyperbolic geometry kernel
 *
 * Pure, framework-free math used by the camera, the HUD and the Poincaré disk
 * visualiser. Nothing here touches the DOM or WebGL.
 *
 * The state lives in the HYPERBOLOID MODEL: a point is a unit timelike 4-vector
 * P with <P,P> = -P0^2 + P1^2 + P2^2 + P3^2 = -1. The camera carries an
 * orthonormal spacelike frame E1,E2,E3 with <P,Ei> = 0.
 *
 * For rendering we fold the camera into the KLEIN MODEL, k = (P1,P2,P3)/P0,
 * where hyperbolic planes are Euclidean planes and geodesics are straight
 * lines. That fold is a similarity lattice isometry, so folding by any cell
 * offset leaves every distance intact while keeping coordinates small.
 * ========================================================================== */

/* ------------------------------------------------------------ vector ops */

const v4 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s, a[3] * s],
  addScaled: (a, b, s) => [
    a[0] + b[0] * s,
    a[1] + b[1] * s,
    a[2] + b[2] * s,
    a[3] + b[3] * s,
  ],
  /** Minkowski inner product <a,b> = -a0 b0 + a1 b1 + a2 b2 + a3 b3 */
  dot: (a, b) =>
    -a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3],
  len: (a) => Math.sqrt(Math.max(0, a[1] ** 2 + a[2] ** 2 + a[3] ** 2)),
  norm: (a) => {
    const l = v4.len(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l, a[3] / l];
  },
};

/* --------------------------------------------------- lattice translation */

// Unit spacelike tangents of the three geodesics leaving the hyperboloid
// origin. These are the boost directions for the lattice translations — note
// they are SPACELIKE (norm +1), not the timelike axis points.
const AXIS = [
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

/**
 * Chart spacing between neighbouring room centres, for a hyperbolic room
 * size T. Moving T along a geodesic out of the origin puts the camera at
 * chart coordinate sinh(T).
 */
const kleinFromRoomSize = (T) => Math.sinh(T);

/** Inverse of the above. */
const roomSizeFromKlein = (D) => Math.asinh(D);

/* ------------------------------------------------------------- the camera */

class HyperCamera {
  constructor() {
    this.P = [1, 0, 0, 0];
    this.E = [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    /** Hyperbolic distance walked from the origin — never resets. */
    this.odometer = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.foldCount = 0;
  }

  /**
   * Current chart coordinates: the SPATIAL part of the hyperboloid point.
   *
   * This is the "spatial" chart, in which P = (sqrt(1+|k|^2), k). It is the
   * chart that makes geodesics through the ORIGIN straight, and it is
   * unbounded, which is what lets the lattice be infinite:
   *
   *   cosh d(a,b) = sqrt(1+|a|^2) sqrt(1+|b|^2) - a.b
   *   d(0,k)     = asinh(|k|)
   *
   * (It is not the Klein ball model, which is bounded to |k| < 1 and would
   * run out of room after a handful of cells.)
   */
  get klein() {
    return [this.P[1], this.P[2], this.P[3]];
  }

  /** cosh of the hyperbolic distance between two chart points. */
  static coshDist(a, b) {
    const ta = Math.sqrt(1 + a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    const tb = Math.sqrt(1 + b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
    return ta * tb - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
  }

  /**
   * Klein position folded into the cell containing the origin, plus the cell
   * index it was folded by. Everything the shader sees stays inside |k| < D.
   */
  kleinFolded(D) {
    const k = this.klein;
    const cell = k.map((c) => Math.round(c / D));
    return { k: [k[0] - cell[0] * D, k[1] - cell[1] * D, k[2] - cell[2] * D], cell };
  }

  /** Euclidean (Klein) tangent frame, as unit vectors for the view matrix. */
  tangentFrame() {
    const [e1, e2, e3] = this.E.map((e) => {
      const s = [e[1], e[2], e[3]];
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      return [s[0] / l, s[1] / l, s[2] / l];
    });
    return { e1, e2, e3 };
  }

  /**
   * Apply the Lorentz boost of hyperbolic length `s` along the unit spacelike
   * tangent `A` (which must satisfy <A,A> = 1 and <P,A> = 0).
   *
   * The boost is fixed on the hyperboloid by
   *     B(P) = c P + s A ,   B(A) = s P + c A
   * and is the identity on the two dimensions orthogonal to both. Writing any
   * vector as V = a P + b A + W gives
   *     a = -<V,P> ,  b = <V,A>
   *     B(V) = V + (a(c-1) + b s) P + (a s + b(c-1)) A
   *
   * Every geometric quantity the app reports — the odometer, the cell index,
   * the fold below — depends on this being exactly right.
   */
  boostAlong(A, s) {
    if (s === 0) return;
    const c = Math.cosh(s);
    const sh = Math.sinh(s);
    const P = this.P;
    const map = (V) => {
      const a = -v4.dot(V, P);
      const b = v4.dot(V, A);
      const dP = a * (c - 1) + b * sh;
      const dA = a * sh + b * (c - 1);
      const out = new Array(4);
      for (let i = 0; i < 4; i++) out[i] = V[i] + dP * P[i] + dA * A[i];
      return out;
    };
    this.P = map(P);
    this.E = this.E.map(map);
  }

  /** Translate the camera by hyperbolic distance s along lattice axis `i`. */
  translateAxis(i, s) {
    this.boostAlong(AXIS[i], s);
  }

  /**
   * Move `dist` along the camera's forward axis (signed).
   * Uses an exact Lorentz boost, so the path traced is a true geodesic even
   * at hyperbolic distances in the hundreds.
   */
  moveForward(dist) {
    this.boostAlong(this.E[2], dist);
    this.odometer += Math.abs(dist);
  }

  /** Move `dist` along the camera's right axis (signed). */
  moveStrafe(dist) {
    this.boostAlong(this.E[0], dist);
  }

  /**
   * Rewrite the camera at its cell-local position, for numeric hygiene only.
   *
   * The renderer is handed cell-LOCAL coordinates and recovers the cell index
   * from each marching point, so the image depends on nothing but where you
   * stand and which way you face. Relabelling the position is invisible.
   *
   * Note this is NOT an isometry of the lattice, so no cell number is carried
   * across it — a banked index would count nothing meaningful. There is no
   * reason to track one: every room is identical.
   */
  foldIntoCell(D) {
    const k = this.klein;
    const offset = k.map((c) => Math.round(c / D));
    if (offset[0] === 0 && offset[1] === 0 && offset[2] === 0) return false;
    this.reseatFromKlein(k.map((c, i) => c - offset[i] * D));
    this.foldCount++;
    return true;
  }

  /**
   * Keep the raw chart coordinates small enough to stay exact. They grow like
   * sinh(distance), which overflows a float64 around 700 units out — some 500
   * rooms of continuous walking — so this is insurance rather than something a
   * player will normally see.
   */
  rebaseIfNeeded(D) {
    if (Math.hypot(...this.klein) < 300) return false;
    return this.foldIntoCell(D);
  }

  /**
   * Cell-LOCAL coordinates — exactly what the renderer wants. The shader
   * recovers the cell from each marching point, so the image is a function of
   * `k` alone and stays well-conditioned however far you walk.
   */
  folded(D) {
    const k = this.klein;
    return { k: k.map((c, i) => c - Math.round(c / D) * D) };
  }

  /**
   * Rotate the frame. `u`/`v` are the two frame vectors spanning the plane
   * orthogonal to `axis`; returns the pair after turning by `angle`.
   */
  static rotatePair(axis, u, v, angle) {
    const au = v4.dot(axis, u);
    const av = v4.dot(axis, v);
    const un = v4.sub(u, v4.scale(axis, au));
    const vn = v4.sub(v, v4.scale(axis, av));
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      u: v4.addScaled(v4.scale(un, c), vn, s),
      v: v4.addScaled(v4.scale(vn, c), un, -s),
    };
  }

  /** Yaw about the camera's up axis. Positive turns right. */
  yawBy(angle) {
    this.yaw += angle;
    const { u, v } = HyperCamera.rotatePair(this.E[1], this.E[2], this.E[0], angle);
    this.E[2] = u;
    this.E[0] = v;
  }

  /** Pitch about the camera's right axis. */
  pitchBy(angle) {
    this.pitch += angle;
    const { u, v } = HyperCamera.rotatePair(this.E[0], this.E[2], this.E[1], angle);
    this.E[2] = u;
    this.E[1] = v;
  }

  /**
   * Re-seat the state at a Klein position supplied by collision, keeping the
   * current viewing direction.
   *
   * The spatial part of a hyperboloid tangent IS its Klein direction, so we
   * lift each frame direction at the new point (its time component is forced
   * by tangency) and re-orthonormalise in the Minkowski product.
   */
  reseatFromKlein(k) {
    const P0 = Math.sqrt(1 + k[0] ** 2 + k[1] ** 2 + k[2] ** 2);
    this.P = [P0, k[0], k[1], k[2]];

    const lift = (e) => [
      (k[0] * e[0] + k[1] * e[1] + k[2] * e[2]) / P0,
      e[0],
      e[1],
      e[2],
    ];
    const old = this.tangentFrame();
    const vecs = [lift(old.e1), lift(old.e2), lift(old.e3)];

    // Minkowski Gram-Schmidt: project out earlier vectors, then normalise.
    const orth = (v, against) => {
      let out = v;
      for (const a of against) {
        const num = v4.dot(out, a);
        const den = v4.dot(a, a);
        if (Math.abs(den) > 1e-12) out = v4.sub(out, v4.scale(a, num / den));
      }
      const l2 = v4.dot(out, out);
      return l2 > 1e-12 ? v4.scale(out, 1 / Math.sqrt(l2)) : out;
    };

    const v1 = orth(vecs[0], []);
    const v2 = orth(vecs[1], [v1]);
    const v3 = orth(vecs[2], [v1, v2]);
    this.E = [v1, v2, v3];
  }

  /** Reset the frame so the camera looks along an axis again. */
  reseat() {
    this.P = [1, 0, 0, 0];
    this.E = [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    this.yaw = 0;
    this.pitch = 0;
  }
}

/* -------------------------------------------- collision inside a room */

// Shared with the shader: the room is the Klein cube of half-extent C centred
// on cell*D, with a square doorway of half-width doorR punched in all six
// faces. The player is a sphere of `margin`.
//
// Axis 1 (up/down) is always clamped to [minY,maxY] so you cannot walk out
// through the floor — but the doorway is still *visible* when you look down,
// which is how you see the room beneath your feet.
function confineToRoom(k, D, doorFrac, margin, minY, maxY) {
  const C = D * 0.5;
  const lim = C - margin;
  const doorR = doorFrac * C;
  const limDoor = doorR - margin;
  let hit = false;

  const floor = minY == null ? -C + margin : minY;
  const ceil = maxY == null ? C - margin : maxY;
  if (k[1] < floor) {
    k[1] = floor;
    hit = true;
  }
  if (k[1] > ceil) {
    k[1] = ceil;
    hit = true;
  }

  for (const i of [0, 2]) {
    if (Math.abs(k[i]) <= lim) continue;
    const j = i === 0 ? 2 : 0;
    const inDoor = Math.abs(k[j]) < limDoor;
    if (!inDoor) {
      k[i] = Math.sign(k[i]) * lim;
      hit = true;
    }
  }
  return hit;
}

/* ------------------------------------------------ Poincare disk utilities */

// Möbius isometry of the unit disk:
//
//     f(z) = e^{i*theta} * (a - z) / (1 - conj(a) z)
//
// which sends a -> 0 and 0 -> e^{i*theta} a. Composing two of these gives the
// rotation group, and reflecting a tile across the geodesic through u and v
// is  isometry(v, alpha) . isometry(u, -alpha)  with alpha the tile's
// interior angle.
const disk = {
  isometry(a, theta) {
    const ar = a[0];
    const ai = a[1];
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return (z) => {
      const mr = ar - z[0];
      const mi = ai - z[1];
      const dr = 1 - (ar * z[0] + ai * z[1]);
      const di = -(ar * z[1] - ai * z[0]);
      const den = dr * dr + di * di || 1e-12;
      const nr = (mr * dr + mi * di) / den;
      const ni = (mi * dr - mr * di) / den;
      return [nr * c - ni * s, nr * s + ni * c];
    };
  },

  /**
   * Hyperbolic distance between two disk points:
   *   tanh(d/2) = |a - b| / |1 - conj(a) b|
   */
  hypDist(a, b) {
    const num = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dr = 1 - (a[0] * b[0] + a[1] * b[1]);
    const di = -(a[0] * b[1] - a[1] * b[0]);
    const den = Math.hypot(dr, di) || 1e-12;
    return 2 * Math.atanh(Math.min(0.99999999, num / den));
  },

  /**
   * Inverse of isometry(a, theta):
   *   z -> (a - e^{-i*theta} z) / (1 - conj(a) e^{-i*theta} z)
   * Note this is NOT isometry(a, -theta) — the two differ.
   */
  invIsometry(a, theta) {
    const ar = a[0];
    const ai = a[1];
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return (z) => {
      // m = e^{-i*theta} z
      const mr = z[0] * c + z[1] * s;
      const mi = -z[0] * s + z[1] * c;
      const nr = ar - mr;
      const ni = ai - mi;
      const dr = 1 - (ar * mr + ai * mi);
      const di = -(ar * mi - ai * mr);
      const den = dr * dr + di * di || 1e-12;
      return [(nr * dr + ni * di) / den, (ni * dr - nr * di) / den];
    };
  },

  mapPoly(f, poly) {
    return poly.map(f);
  },

  /**
   * Reflection in the geodesic through two interior points u and v.
   *
   * Built by conjugation: rotate the frame so the geodesic becomes the real
   * axis, where reflection is just complex conjugation, then rotate back.
   * This fixes u and v exactly (up to float error), which the naive
   * "compose two rotations by twice the interior angle" trick does not.
   */
  reflectThrough(u, v) {
    const w = disk.isometry(u, 0)(v);
    const phi = -Math.atan2(w[1], w[0]);
    const F = disk.isometry(u, phi);
    const Fi = disk.invIsometry(u, phi);
    return (z) => {
      const f = F(z);
      return Fi([f[0], -f[1]]);
    };
  },
};

/**
 * Build a {p,q} tiling of the hyperbolic plane centred on the origin.
 * Each tile is an array of p vertices [x,y]. Tiles are grown by repeated
 * reflection across shared edges; `rings` bounds the breadth of the growth.
 *
 * The circumradius of the tile follows from the right triangle (centre,
 * vertex, edge-midpoint), whose angles are pi/p, pi/q and pi/2. With alpha =
 * pi/q the interior angle,
 * cosh(s/2) = cos(pi/p) / sin(alpha/2)   and   cosh(r) = cos(alpha/2) / sin(pi/p)
 * so cosh(R) = cos(pi/p)cos(alpha/2) / (sin(pi/p)sin(alpha/2)).
 *
 * Note the HALF angle: using alpha instead of alpha/2 silently produces a
 * tiling with twice the interior angle, in which only q/2 tiles meet at each
 * vertex instead of q.
 *
 * A {p,q} tiling tiles the HYPERBOLIC plane only when 1/p + 1/q < 1/2. At
 * equality it becomes the ordinary Euclidean plane, where the whole plane no
 * longer fits in a disk and this formula is meaningless — so we refuse it.
 */
function buildTiling(p, q, rings) {
  if (!(p >= 3 && q >= 3)) throw new Error(`invalid tiling {${p},${q}}`);
  if (1 / p + 1 / q >= 0.5 - 1e-12) {
    throw new Error(
      `{${p},${q}} is Euclidean or spherical (1/p + 1/q >= 1/2), not hyperbolic`
    );
  }
  const half = Math.PI / (2 * q);
  const coshR =
    (Math.cos(Math.PI / p) * Math.cos(half)) /
    (Math.sin(Math.PI / p) * Math.sin(half));
  const circum = Math.tanh(Math.acosh(coshR) / 2);

  const interior = Math.PI / q;

  const base = [];
  for (let i = 0; i < p; i++) {
    const a = (i / p) * Math.PI * 2 + Math.PI / p;
    base.push([circum * Math.cos(a), circum * Math.sin(a)]);
  }

  const tiles = [base];
  const seen = new Set();
  const key = (poly) =>
    poly
      .map((v) => `${v[0].toFixed(5)},${v[1].toFixed(5)}`)
      .sort()
      .join("|");

  let frontier = [base];
  for (let r = 0; r < rings; r++) {
    const next = [];
    for (const poly of frontier) {
      for (let e = 0; e < p; e++) {
        const u = poly[e];
        const v = poly[(e + 1) % p];
        const nb = disk.mapPoly(disk.reflectThrough(u, v), poly);
        // A genuine neighbour shares the edge u-v exactly; anything else is a
        // reflection back onto the tile we started from.
        const shared = nb.filter(
          (w) =>
            Math.min(
              Math.hypot(w[0] - u[0], w[1] - u[1]),
              Math.hypot(w[0] - v[0], w[1] - v[1])
            ) < 1e-6
        ).length;
        if (shared !== 2) continue;
        const k = key(nb);
        if (seen.has(k)) continue;
        seen.add(k);
        tiles.push(nb);
        next.push(nb);
      }
    }
    frontier = next;
    if (frontier.length > 3000) break;
  }
  return tiles;
}

if (typeof module !== 'undefined') {
  module.exports = {
    v4,
    AXIS,
    HyperCamera,
    confineToRoom,
    disk,
    buildTiling,
    kleinFromRoomSize,
    roomSizeFromKlein,
  };
}
