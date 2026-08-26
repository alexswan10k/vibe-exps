#!/usr/bin/env node
/*
 * Logic test harness for Mermaid Studio's new entity modes.
 * Loads js/entity-core.js and js/mode-{class,er,state}.js inside a Node vm
 * sandbox and asserts, per mode:
 *   - every template parses with zero errors
 *   - gen(parse(gen(parse(src)))) === gen(parse(src))   (double round-trip)
 *   - generated output starts with the dialect header
 *   - stats(doc) returns a string containing '·'
 *   - empty() output parses cleanly
 * Also smoke-checks window.MSEC presence and helper behaviour.
 * entity-board.js is intentionally NOT executed here (DOM-heavy); it is
 * covered by tools/syntax-check.js compilation instead.
 *
 * Usage: node tools/studio-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function makeSandbox() {
  const window = {};
  const sandbox = {
    window,
    console,
    Math,
    JSON,
    String,
    Number,
    Array,
    Object,
    RegExp,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Set,
    Map,
    Symbol,
    Promise,
    Error,
    TypeError,
    Uint8Array,
    setTimeout,
    clearTimeout,
    // React is never invoked by pure logic files, but a stub keeps any
    // accidental top-level reference harmless.
    React: { createElement: () => ({}) },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, window };
}

function load(sandbox, relFile) {
  vm.runInContext(read(relFile), sandbox, { filename: relFile });
}

let failures = 0;
const fail = msg => { failures++; console.log('FAIL ' + msg); };
const pass = msg => console.log('ok   ' + msg);

// ---------- core ----------
const { sandbox, window } = makeSandbox();
try {
  load(sandbox, 'js/entity-core.js');
  const MSEC = window.MSEC;
  if (!MSEC) fail('entity-core.js did not define window.MSEC');
  else {
    for (const fn of ['escQuote', 'sanitizeId', 'nextId', 'clamp', 'measureRows', 'wrapLabel', 'dagreLayout']) {
      if (typeof MSEC[fn] === 'function') pass('MSEC.' + fn);
      else fail('MSEC.' + fn + ' missing/not a function');
    }
    if (typeof MSEC.clamp === 'function' && MSEC.clamp(5, 0, 3) === 3) pass('MSEC.clamp bounds');
    else fail('MSEC.clamp bounds');
    // measureRows must not throw without DOM
    try {
      const s = MSEC.measureRows ? MSEC.measureRows('Title', ['a', 'b'], {}) : null;
      if (s && s.w > 0 && s.h > 0) pass('MSEC.measureRows headless');
      else fail('MSEC.measureRows headless returned ' + JSON.stringify(s));
    } catch (e) { fail('MSEC.measureRows headless threw: ' + e.message); }
    try {
      MSEC.dagreLayout({ dir: 'TB', entities: [], rels: [], containers: [] }, {});
      pass('MSEC.dagreLayout headless no-dagre path');
    } catch (e) { fail('MSEC.dagreLayout threw headless: ' + e.message); }
  }
} catch (e) {
  fail('entity-core.js execution: ' + e.message);
}

// ---------- modes ----------
const HEADERS = { class: 'classDiagram', er: 'erDiagram', state: 'stateDiagram-v2' };

for (const mode of ['class', 'er', 'state']) {
  const file = 'js/mode-' + mode + '.js';
  if (!fs.existsSync(path.join(ROOT, file))) { fail(file + ' missing'); continue; }
  const sb = makeSandbox();
  try {
    load(sb.sandbox, file);
  } catch (e) { fail(file + ' execution: ' + e.message); continue; }
  const M = sb.window.MSMODES && sb.window.MSMODES[mode];
  if (!M) { fail(file + ' did not register window.MSMODES.' + mode); continue; }
  for (const k of ['id', 'tab', 'empty', 'parse', 'gen', 'stats', 'templates', 'boardCfg']) {
    if (M[k] !== undefined) pass(`${mode}: ${k}`); else fail(`${mode}: ${k} missing`);
  }

  const rt = src => M.gen(M.parse(M.gen(M.parse(src).data)).data);

  let lastDoc = null;
  for (const t of M.templates || []) {
    let doc;
    try {
      const r1 = M.parse(t.src);
      if (r1.errors && r1.errors.length) {
        fail(`${mode}/${t.key}: parse errors: ` + r1.errors.map(e => `L${e.line} ${e.msg}`).join('; '));
        continue;
      }
      doc = r1.data;
      lastDoc = doc;
      pass(`${mode}/${t.key}: parse clean`);
    } catch (e) { fail(`${mode}/${t.key}: parse threw: ${e.message}`); continue; }
    try {
      const g1 = M.gen(doc);
      if (!g1.startsWith(HEADERS[mode])) fail(`${mode}/${t.key}: gen header "${g1.split('\n')[0]}"`);
      const r2 = M.parse(g1);
      if (r2.errors && r2.errors.length) {
        fail(`${mode}/${t.key}: re-parse errors: ` + r2.errors.map(e => `L${e.line} ${e.msg}`).join('; '));
        continue;
      }
      const g2 = M.gen(r2.data);
      if (g2 !== g1) {
        fail(`${mode}/${t.key}: double round-trip unstable\n--- g1 ---\n${g1}\n--- g2 ---\n${g2}`);
        continue;
      }
      const g3 = rt(t.src);
      if (g3 !== g1) { fail(`${mode}/${t.key}: triple-path mismatch`); continue; }
      pass(`${mode}/${t.key}: round-trip stable (${g1.split('\n').length} lines)`);
    } catch (e) { fail(`${mode}/${t.key}: gen/round-trip threw: ${e.message}`); continue; }
  }

  try {
    const st = M.stats(lastDoc || M.empty());
    if (typeof st === 'string' && st.includes('·')) pass(`${mode}: stats ok ("${st}")`);
    else fail(`${mode}: stats unexpected: ${JSON.stringify(st)}`);
  } catch (e) { fail(`${mode}: stats threw: ${e.message}`); }

  try {
    const e1 = M.empty();
    const r = M.parse(M.gen(e1));
    if (r.errors && r.errors.length) fail(`${mode}: empty() doc fails to parse: ` + r.errors.map(x => x.msg).join('; '));
    else pass(`${mode}: empty() round-trips clean`);
  } catch (e) { fail(`${mode}: empty() threw: ${e.message}`); }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall logic tests passed');
process.exit(failures ? 1 : 0);
