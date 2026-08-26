#!/usr/bin/env node
/*
 * One-time authoring-time tool: compiles the legacy `<script type="text/babel">`
 * JSX block(s) in ../index.html down to plain React.createElement calls, so the
 * shipped page needs NO @babel/standalone at runtime.
 *
 *   node precompile.js            # stage compiled UI -> tools/build-staging/app-ui.js
 *   node precompile.js --apply    # rewrite ../index.html: drop babel tag, add <script src>
 *
 * Semantics are byte-equivalent to what @babel/standalone did in the browser
 * (same compiler, same react preset, same default pragma React.createElement).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Babel = require('/tmp/msx/babel.min.js'); // downloaded once; see header note

const ROOT = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const HTML = path.join(ROOT, 'index.html');
const STAGING = path.join(__dirname, 'build-staging');
const APPLY = process.argv.includes('--apply');

function extractBabelBlocks(src) {
  const blocks = [];
  const re = /<script([^>]*?)type="text\/babel"([^>]*?)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(src))) {
    const attrsBefore = m[1];
    const attrsAfter = m[2];
    // skip blocks meant for other pragma configs (none today, but be explicit)
    const pragmaM = /data-plugins|data-presets="([^"]*)"/.exec(attrsBefore + attrsAfter);
    blocks.push({
      full: m[0],
      body: m[3],
      presetsAttr: pragmaM && !/text\/babel/.test(pragmaM[0]) ? pragmaM[1] : '',
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return blocks;
}

function main() {
  const src = fs.readFileSync(HTML, 'utf8');
  const blocks = extractBabelBlocks(src);
  if (!blocks.length) { console.error('no text/babel blocks found'); process.exit(1); }
  console.log(`found ${blocks.length} text/babel block(s)`);

  const compiledParts = [];
  for (const b of blocks) {
    const presets = b.presetsAttr
      ? b.presetsAttr.split(',').map(s => s.trim()).filter(Boolean)
      : ['react'];
    const out = Babel.transform(b.body, { presets }).code;
    compiledParts.push(out);
  }
  const banner =
    '/* GENERATED FILE — do not edit by hand.\n' +
    ' * Compiled from the former <script type="text/babel"> block of index.html\n' +
    ' * with @babel/standalone (preset react) at authoring time, so the page ships\n' +
    ' * without any runtime Babel. Regenerate via tools/precompile.js.\n' +
    ' * Low-level API note: this is exactly React.createElement output. */\n';
  const compiled = banner + compiledParts.join('\n');

  fs.mkdirSync(STAGING, { recursive: true });
  fs.writeFileSync(path.join(STAGING, 'app-ui.js'), compiled);
  console.log(`staged ${compiled.length} bytes -> tools/build-staging/app-ui.js`);

  if (!APPLY) {
    console.log('dry run only (use --apply to rewrite index.html)');
    return;
  }

  // Apply: replace each babel block with nothing, drop the babel CDN tag,
  // and insert a classic script tag for app-ui.js before the first inline script.
  let outHtml = src;
  for (const b of blocks.sort((a, c) => c.start - a.start)) {
    outHtml = outHtml.slice(0, b.start) + `<!-- legacy UI compiled out to app-ui.js -->` + outHtml.slice(b.end);
  }
  outHtml = outHtml.replace(
    /[ \t]*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^"]*"><\/script>\r?\n/,
    ''
  );
  // Insert app-ui.js just before </body>: the compiled UI consumes
  // window.StudioCore (defined by an earlier inline script) and mounts into
  // #root, so it must load AFTER both.
  const closeBody = outHtml.lastIndexOf('</body>');
  if (closeBody === -1) throw new Error('no </body> found');
  outHtml =
    outHtml.slice(0, closeBody) +
    '<script src="app-ui.js"></script>\n' +
    outHtml.slice(closeBody);

  fs.writeFileSync(HTML, outHtml);
  console.log('APPLIED: index.html now loads app-ui.js; @babel/standalone removed.');
}

main();
