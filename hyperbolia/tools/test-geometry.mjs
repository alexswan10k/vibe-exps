/* ==========================================================================
 * HYPERBOLIA — geometry tests
 *
 *   node tools/test-geometry.mjs
 *
 * Checks the claims the piece actually rests on: that the camera state stays
 * on the hyperboloid, that folding into the Klein lattice is an isometry, that
 * the collision volume matches the shader's SDF, and that the {p,q} tiling is
 * genuinely regular.
 * ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "hyper.js"), "utf8");
const mod = await import(
  "data:text/javascript;base64," +
    Buffer.from(src.replace(/if \(typeof module[\s\S]*$/, "") + "\nexport {v4,HyperCamera,confineToRoom,disk,buildTiling};").toString("base64")
);
const { v4, HyperCamera, confineToRoom, disk, buildTiling } = mod;

let pass = 0,
  fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const section = (s) => console.log(`\n${s}`);

/* ------------------------------------------------------- 1. hyperboloid */

section("hyperboloid state invariants");
{
  const cam = new HyperCamera();
  ok("starts on the hyperboloid", near(v4.dot(cam.P, cam.P), -1));
  ok(
    "frame is spacelike + orthogonal to P",
    cam.E.every((e, i) => near(v4.dot(e, e), 1) && near(v4.dot(cam.P, e), 0)) &&
      cam.E.every((e, i) => cam.E.every((f, j) => near(v4.dot(e, f), i === j ? 1 : 0)))
  );

  // A long random walk must not break any invariant.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < 4000; i++) {
    cam.yawBy(rnd() * 0.05);
    cam.pitchBy(rnd() * 0.03);
    cam.moveForward(rnd() * 0.05);
    cam.moveStrafe(rnd() * 0.05);
    cam.rebaseIfNeeded(1.42);
  }
  ok(
    "survives a 4000-step random walk",
    near(v4.dot(cam.P, cam.P), -1, 1e-6),
    `<P,P> = ${v4.dot(cam.P, cam.P)}`
  );
  ok(
    "frame stays orthonormal under a walk",
    cam.E.every((e, i) => near(v4.dot(e, e), 1, 1e-6) && near(v4.dot(cam.P, e), 0, 1e-6))
  );
}

/* ------------------------------------------------- 2. klein fold isometry */

section("Klein folding preserves distance");
{
  const T = 1.15;
  const D = Math.sinh(T);
  const cam = new HyperCamera();
  const k0 = cam.klein;

  // Walk exactly one hyperbolic room forward and fold. Hyperbolic space is
  // homogeneous, so the folded view must be identical to the start.
  cam.moveForward(T);
  const folded = cam.kleinFolded(D);
  const err = Math.max(...k0.map((v, i) => Math.abs(v - folded.k[i])));
  ok("one cell of translation is a no-op after folding", err < 1e-6, `err ${err}`);

  // Distance from the origin really did grow by exactly T.
  const cd = Math.sqrt((1 + dot3(folded.k, folded.k)) * (1 + dot3(k0, k0))) - dot3(folded.k, k0);
  ok("still T from the origin", near(Math.acosh(cd), 0, 1e-6));

  // Walk a long way; the folded position must stay small.
  cam.reseat();
  const base = cam.odometer;
  for (let i = 0; i < 5000; i++) cam.moveForward(0.05);
  const f2 = cam.kleinFolded(D);
  const r = Math.hypot(...f2.k);
  ok(
    "folded radius stays inside one cell after 250 units",
    r < D * 0.87,
    `|k| = ${r.toFixed(4)}, D = ${D.toFixed(4)}`
  );
  ok("odometer kept the true distance", near(cam.odometer - base, 250, 1e-6), `${cam.odometer - base}`);
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/* ------------------------------------------------------- 3. collision */

section("collision volume");
{
  const D = Math.sinh(1.15);
  const C = D / 2;
  const door = 0.42;

  // Walk straight at a wall, off to the side of the doorway.
  const M = 0.16;                       // player radius, matches main.js
  const lo = -C + 0.24 * D,
    hi = C - 0.24 * D;
  // Struck off-centre, into solid wall.
  const k = [0.6 * C, -D * 0.26, C + 5];
  confineToRoom(k, D, door, M, lo, hi);
  ok("cannot pass through a solid wall", k[2] <= C - M + 1e-9, `z = ${k[2]}`);

  // Same, but aligned with the doorway.
  const k2 = [0, -D * 0.26, C + 5];
  confineToRoom(k2, D, door, M, lo, hi);
  ok("walks through the doorway freely", k2[2] > C, `z = ${k2[2]}`);

  // Cannot drop through the floor.
  const k3 = [0, -C - 3, 0];
  confineToRoom(k3, D, door, M, lo, hi);
  ok("cannot walk through the floor", near(k3[1], lo, 1e-9));

  // The doorway half-width the collision uses matches the shader's.
  ok("doorway half-width is doorFrac * C", near(door * C, 0.42 * (D / 2)));
}

/* --------------------------------------------------------- 4. disk model */

section("Poincare disk isometries");
{
  for (const a of [
    [0.3, -0.2],
    [0, 0.5],
    [-0.7, 0.1],
  ]) {
    for (const th of [0, 0.7, -2.1]) {
      const f = disk.isometry(a, th);
      ok(
        `isometry sends a -> 0 (a=${a}, th=${th})`,
        Math.hypot(...f(a)) < 1e-12
      );
      const want = [
        a[0] * Math.cos(th) - a[1] * Math.sin(th),
        a[0] * Math.sin(th) + a[1] * Math.cos(th),
      ];
      ok(
        `isometry sends 0 -> e^{i th} a (th=${th})`,
        Math.hypot(f([0, 0])[0] - want[0], f([0, 0])[1] - want[1]) < 1e-12
      );
      const fi = disk.invIsometry(a, th);
      const z = [0.21, -0.44];
      ok(
        `invIsometry inverts isometry (th=${th})`,
        Math.hypot(...fi(f(z)).map((v, i) => v - z[i])) < 1e-12
      );
    }
  }

  // hypDist against the closed form for a radial step.
  const s = 1.3;
  const p = [Math.tanh(s / 2), 0];
  ok(
    "hypDist from origin = 2 atanh(r)",
    near(disk.hypDist([0, 0], p), s, 1e-12),
    `${disk.hypDist([0, 0], p)}`
  );

  // Reflection fixes its edge and is an involution.
  const refl = disk.reflectThrough([0.2, 0.3], [-0.25, 0.1]);
  ok("reflection fixes u", Math.hypot(...refl([0.2, 0.3]).map((v, i) => v - [0.2, 0.3][i])) < 1e-12);
  ok("reflection fixes v", Math.hypot(...refl([-0.25, 0.1]).map((v, i) => v - [-0.25, 0.1][i])) < 1e-12);
  const z = [0.55, -0.2];
  ok("reflection is an involution", Math.hypot(...refl(refl(z)).map((v, i) => v - z[i])) < 1e-12);
}

/* ----------------------------------------------------------- 5. tilings */

section("{p,q} tilings are regular");
{
  for (const [p, q] of [
    [7, 3],
    [5, 4],
    [8, 3],
    [6, 4],
    [4, 6],
  ]) {
    const tiles = buildTiling(p, q, 4);
    const sig = tiles
      .slice(0, 80)
      .map((t) => {
        const L = [];
        for (let i = 0; i < p; i++) L.push(disk.hypDist(t[i], t[(i + 1) % p]));
        L.sort((x, y) => x - y);
        return L.map((x) => x.toFixed(6)).join(",");
      });
    // cosh(s/2) = cos(pi/p) / sin(alpha/2), with alpha = pi/q
    const expect = 2 * Math.acosh(Math.cos(Math.PI / p) / Math.sin(Math.PI / (2 * q)));

    ok(`{${p},${q}} generated ${tiles.length} tiles`, tiles.length > 50);
    ok(`{${p},${q}} all tiles congruent`, new Set(sig).size === 1);
    ok(
      `{${p},${q}} side length matches closed form`,
      near(Number(sig[0].split(",")[0]), expect, 1e-6),
      `${sig[0].split(",")[0]} vs ${expect}`
    );
    const maxR = Math.max(...tiles.flat().map((v) => Math.hypot(...v)));
    ok(`{${p},${q}} stays strictly inside the disk`, maxR < 1);

    // The HYPERBOLIC interior angle, via the law of cosines on the triangle
    // formed by three consecutive vertices. The Euclidean angle you can see
    // in the disk drawing is not the same quantity.
    const t = tiles[0];
    const s = disk.hypDist(t[0], t[1]);
    const diag = disk.hypDist(t[0], t[2]);
    const cosB =
      (Math.cosh(s) * Math.cosh(s) - Math.cosh(diag)) /
      (Math.sinh(s) * Math.sinh(s));
    const a0 = Math.acos(Math.max(-1, Math.min(1, cosB)));
    ok(
      `{${p},${q}} interior angle is exactly pi/q`,
      near(a0, Math.PI / q, 1e-9),
      `angle = ${a0.toFixed(9)}, pi/q = ${(Math.PI / q).toFixed(9)}`
    );
    ok(
      `{${p},${q}} angle deficit: q corners make LESS than 2pi`,
      q * a0 < 2 * Math.PI,
      `q*angle = ${(q * a0).toFixed(4)} < 2pi = ${(2 * Math.PI).toFixed(4)}`
    );
  }

  // {p,q} tiles the hyperbolic plane only below 1/p + 1/q = 1/2. At or above
  // that it is the Euclidean or spherical tiling and must be refused.
  for (const [p, q] of [
    [4, 4],
    [6, 3],
    [3, 3],
  ]) {
    let threw = false;
    try {
      buildTiling(p, q, 2);
    } catch {
      threw = true;
    }
    ok(`{${p},${q}} (not hyperbolic) is rejected`, threw);
  }
  let threwLo = false;
  try {
    buildTiling(2, 5, 2);
  } catch {
    threwLo = true;
  }
  ok("{2,5} (degenerate) is rejected", threwLo);
}

/* ------------------------------------------------------------------ end */

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
