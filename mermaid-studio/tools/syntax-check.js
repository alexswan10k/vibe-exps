#!/usr/bin/env node
/*
 * Static syntax gate for Mermaid Studio's classic-script sources.
 * Compiles each file as a CLASSIC script (no import/export allowed —
 * the app must run from file:/// where ES modules are CORS-blocked).
 * No code is executed.
 *
 *   node tools/syntax-check.js [file.js ...]
 *   (default: every *.js under js/ plus ../tools/build-staging/app-ui.js if present)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function collectTargets(args) {
  if (args.length) return args;
  const out = [];
  const jsDir = path.join(ROOT, 'js');
  if (fs.existsSync(jsDir)) {
    for (const f of fs.readdirSync(jsDir).sort()) {
      if (f.endsWith('.js')) out.push(path.join(jsDir, f));
    }
  }
  const staged = path.join(__dirname, 'build-staging', 'app-ui.js');
  if (fs.existsSync(staged)) out.push(staged);
  return out;
}

const FORBIDDEN = [
  { re: /(^|\n)\s*import\s*[\s(]/, msg: 'ES module import statement' },
  { re: /(^|\n)\s*export\s+/, msg: 'ES module export statement' },
  { re: /\bimport\s*\(/, msg: 'dynamic import()' },
  { re: /<script[^>]*type=["']module["']/, msg: '<script type="module">' },
];

let failed = 0;
for (const file of collectTargets(process.argv.slice(2))) {
  const rel = path.relative(ROOT, file);
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) {
    console.log(`FAIL ${rel} — unreadable: ${e.message}`); failed++; continue;
  }
  // 1. classic-script compilation (catches SyntaxError incl. import/export)
  try {
    new vm.Script(src, { filename: rel });
  } catch (e) {
    console.log(`FAIL ${rel} — syntax: ${e.message}`); failed++; continue;
  }
  // 2. forbidden constructs
  const hits = [];
  for (const f of FORBIDDEN) if (f.re.test(src)) hits.push(f.msg);
  // JSX remnant heuristic: a tag-like token at a statement position.
  // Matches `<Div`/`<div` NOT inside obvious string/comment context is hard
  // statically; instead flag the strongest signal: closing tags & fragments.
  if (/\/>\s*\)|<\/[A-Za-z][\w.]*>\s*[;,)]/.test(src)) hits.push('possible JSX remnant');
  if (hits.length) { console.log(`FAIL ${rel} — ${hits.join('; ')}`); failed++; continue; }
  console.log(`ok   ${rel}`);
}
console.log(failed ? `\n${failed} file(s) FAILED` : '\nall clean');
process.exit(failed ? 1 : 0);
