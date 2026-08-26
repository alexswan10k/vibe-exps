// Feedback loop for mermaid-studio sequence editor bugs.
// Usage: node loop.mjs [testNameSubstring ...]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';

const ROOT = path.resolve('..', 'mermaid-studio');
const PORT = 8931;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(PORT, r));

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

const SEED = `sequenceDiagram
    participant A as Alice
    participant B as Bob
    participant C as Carol
    A->>B: hello
    B-->>C: hi there
    Note over B,C: the note
    C->>A: ping`;

const results = [];
let filter = process.argv.slice(2);

async function seed() {
  // tests assume we start on the Sequence tab with its document loaded
  const onSeq = await page.evaluate(() => {
    const el = document.querySelector('.mode-tab.on');
    return !!el && el.textContent.includes('Sequence');
  });
  if (!onSeq) {
    await page.locator('.mode-tab', { hasText: 'Sequence' }).click();
    await page.waitForTimeout(250);
  }
  await page.fill('.code-ta', SEED);
  await page.waitForFunction(expected => document.querySelector('.code-ta').value === expected &&
    document.querySelector('.sync-chip').classList.contains('ok'), SEED, { timeout: 5000 });
}

const code = () => page.evaluate(() => document.querySelector('.code-ta').value);
async function waitCodeInclude(sub, timeout = 3000) {
  await page.waitForFunction(s => document.querySelector('.code-ta')?.value.includes(s), sub, { timeout });
}
async function waitCodeExclude(sub, timeout = 3000) {
  await page.waitForFunction(s => !document.querySelector('.code-ta')?.value.includes(s), sub, { timeout });
}
const pillVisible = () => page.locator('.fpill').count().then(c => c > 0);

async function gotoVisual() {
  await page.locator('.rp-head.viz-head button', { hasText: 'Visual' }).click();
}
async function gotoRows() {
  await page.locator('.rp-head.viz-head button', { hasText: 'Rows' }).click();
}

// ---------- scenarios ----------

async function t1_toolbarAddMessage() {
  await gotoVisual();
  const before = await code();
  await page.locator('.viz-head button', { hasText: '+ Message' }).click();
  await waitCodeInclude('message');
  const after = await code();
  return after.split('\n').length === before.split('\n').length + 1 && after.includes('A->>B: message');
}

async function t2_clickRowOpensPill() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  return await pillVisible();
}

async function t3_pillDeleteButton() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  if (!(await pillVisible())) return 'fail: pill did not open on row click';
  await page.locator('.fpill button.mini-btn.del').click();
  await waitCodeExclude('hello');
  const c = await code();
  return c.includes('B-->>C: hi there') && !c.includes('A->>B: hello');
}

async function t4_pillTextFieldTyping() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  const inp = page.locator('.fpill input.sin');
  if (!(await pillVisible())) return 'fail: pill did not open';
  await inp.click();
  if (!(await pillVisible())) return 'fail: pill vanished when clicking into its text field';
  await page.keyboard.press('End');
  await page.keyboard.type('XY', { delay: 60 });
  await page.waitForTimeout(120);
  if (!(await pillVisible())) return 'fail: pill vanished while typing';
  const focused = await page.evaluate(() => document.activeElement?.tagName === 'INPUT');
  if (!focused) return 'fail: input lost focus while typing';
  const val = await inp.inputValue();
  if (val !== 'helloXY') return 'fail: typed text lost, value=' + JSON.stringify(val);
  await waitCodeInclude('helloXY');
  return true;
}

async function t5_pillSelectChange() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  if (!(await pillVisible())) return 'fail: pill did not open';
  const sel = page.locator('.fpill select').nth(0);
  await sel.selectOption('C');
  await page.waitForTimeout(150);
  if (!(await pillVisible())) return 'fail: pill vanished after changing a select';
  await waitCodeInclude('C->>B: hello');
  // second change still possible?
  await sel.selectOption('A');
  await page.waitForTimeout(150);
  if (!(await pillVisible())) return 'fail: pill vanished after second select change';
  await waitCodeInclude('A->>B: hello');
  return true;
}

async function t5b_pillToggleActAndDelete() {
  // select an activation bar and toggle/delete it from the pill
  await gotoVisual();
  // add two act items via toolbar to have something to click
  await page.locator('.viz-head button', { hasText: '+ Act' }).click();
  await page.waitForTimeout(100);
  await page.locator('.viz-head button', { hasText: '+ Deact' }).first().count(); // noop guard
  await page.locator('rect.s-act').last().click({ force: true }).catch(() => {});
  // s-act bars exist as spans too; the clickable row rects are rendered per act item
  const cnt = await page.locator('svg g rect.s-act').count();
  if (!cnt) return 'skip: no act bars rendered';
  await page.locator('svg g rect.s-act').last().click({ force: true });
  if (!(await pillVisible())) return 'fail: pill did not open for activation bar';
  await page.locator('.fpill button.mini-btn', { hasText: '⇄' }).click();
  await page.waitForTimeout(150);
  if (!(await pillVisible())) return 'fail: pill vanished after toggle';
  const c = await code();
  if (!c.includes('deactivate')) return 'fail: toggle did not flip activate->deactivate';
  await page.locator('.fpill button.mini-btn.del').click();
  await page.waitForTimeout(150);
  const c2 = await code();
  return c2.split('\n').length === c.split('\n').length - 1;
}

async function t6_rowsNoteWhoComma() {
  await gotoRows();
  const who = page.locator('input[placeholder="A,B"]');
  if ((await who.count()) === 0) return 'skip: no note who-field found';
  await who.click();
  await page.keyboard.press('End');
  await page.keyboard.press(',');
  await page.waitForTimeout(80);
  const v = await who.inputValue();
  if (v !== 'B,C,') return 'fail: comma eaten while typing, value=' + JSON.stringify(v);
  await page.keyboard.type('A', { delay: 40 });
  await page.waitForTimeout(200);
  const v2 = await who.inputValue();
  if (v2 !== 'B,C,A') return 'fail: continued typing broken, value=' + JSON.stringify(v2);
  await waitCodeInclude('Note over B,C,A');
  return true;
}

async function t7_endpointDragRetarget() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  const ends = page.locator('.s-endpoint');
  if ((await ends.count()) !== 2) return 'fail: endpoints not shown after select (' + (await ends.count()) + ')';
  const ep = ends.nth(1); // "to" endpoint
  const bb = await ep.boundingBox();
  if (!bb) return 'fail: endpoint box null';
  // target: C lifeline x-position — read third participant head centre
  const svgBox = await page.locator('.viz-body svg').first().boundingBox();
  const heads = await page.$$eval('.viz-body svg text.s-head-txt', els => els.map(e => ({ x: +e.getAttribute('x'), txt: e.textContent })));
  const cx = heads.find(h => h.txt.startsWith('C')).x;
  const tx = svgBox.x + cx, ty = bb.y + bb.height / 2;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(bb.x + (tx - bb.x) * i / 8, ty, { steps: 2 });
  await page.mouse.up();
  await waitCodeInclude('A->>C: hello');
  return true;
}

async function t8_dragReorderItem() {
  await gotoVisual();
  const line = page.locator('g.s-msg').nth(1).locator('path.line'); // "hi there"
  const bb = await line.boundingBox();
  const sx = bb.x + Math.min(20, bb.width / 4), sy = bb.y + bb.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(sx, sy + i * 7, { steps: 2 });
  await page.mouse.up();
  if (process.env.DBG) {
    console.log('DBG line bb=', JSON.stringify(bb), 'dropY=', sy + 70);
    console.log('DBG code after drag:\n' + (await page.evaluate(() => document.querySelector('.code-ta').value)));
  }
  await waitCodeInclude('Note over B,C: the note\n    B-->>C: hi there');
  const c = await code();
  const iNote = c.indexOf('Note over B,C');
  const iHi = c.indexOf('hi there');
  const iPing = c.indexOf('ping');
  return iNote !== -1 && iNote < iHi && iHi < iPing;
}

async function t9_rowsSheetOps() {
  await gotoRows();
  // add + delete a message row
  const rowsBefore = await page.locator('.scard').nth(1).locator('.trow').count();
  await page.locator('.scard-h button', { hasText: '+ Message' }).click();
  await page.waitForTimeout(120);
  const rowsAfter = await page.locator('.scard').nth(1).locator('.trow').count();
  if (rowsAfter !== rowsBefore + 1) return 'fail: + Message did not add a row';
  await page.locator('.scard').nth(1).locator('.trow').last().locator('button[title="Delete"]').click();
  await page.waitForTimeout(120);
  const rowsDel = await page.locator('.scard').nth(1).locator('.trow').count();
  if (rowsDel !== rowsBefore) return 'fail: delete did not remove row';
  // participant move up: swap B before A
  await page.locator('.scard').nth(0).locator('.trow').nth(1).locator('button[title="Move up"]').click();
  await waitCodeInclude('participant B as Bob\n    participant A as Alice');
  // move it back down
  await page.locator('.scard').nth(0).locator('.trow').nth(0).locator('button[title="Move down"]').click();
  await waitCodeInclude('participant A as Alice\n    participant B as Bob');
  return true;
}

async function t10_gapInsertCircle() {
  await gotoVisual();
  const zones = page.locator('rect.s-ins');
  const n = await zones.count();
  if (n < 2) return 'fail: no insert zones';
  await zones.nth(1).hover();
  await page.waitForTimeout(80);
  const btn = page.locator('circle.s-ins-btn');
  if ((await btn.count()) !== 1) return 'fail: insert circle did not appear on hover';
  await btn.click();
  await page.waitForTimeout(200);
  const c = await code();
  const lines = c.split('\n');
  const iHello = lines.findIndex(l => l.includes('hello'));
  const iMsg = lines.findIndex(l => l.includes(': message'));
  const iHi = lines.findIndex(l => l.includes('hi there'));
  return iHello !== -1 && iMsg === iHello + 1 && iHi === iMsg + 1;
}

async function t11_undoAfterPillEdit() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  if (!(await pillVisible())) return 'skip: pill broken';
  const sel = page.locator('.fpill select').nth(0);
  await sel.selectOption('C');
  await page.waitForTimeout(250);
  await page.keyboard.press('Control+z').catch(() => {});
  await page.keyboard.press('Meta+z').catch(() => {});
  await page.waitForTimeout(250);
  const c = await code();
  return c.includes('A->>B: hello');
}

async function t12_backgroundClickDeselects() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  if (!(await pillVisible())) return 'fail: pill did not open';
  const box = await page.locator('.viz-body svg').boundingBox();
  // click empty canvas below the last row, far from any element
  const h = +(await page.locator('.viz-body svg').getAttribute('height'));
  await page.mouse.click(box.x + box.width - 40, box.y + h - 10);
  await page.waitForTimeout(120);
  if (await pillVisible()) return 'fail: background click no longer deselects';
  return true;
}

async function t13_rowsParticipantDeleteCleansRefs() {
  await gotoRows();
  // delete participant B: messages touching B must go, others stay
  await page.locator('.scard').nth(0).locator('.trow').nth(1).locator('button[title="Delete"]').click();
  await waitCodeExclude('participant B as Bob');
  const c = await code();
  const bad =
    c.includes('A->>B') || c.includes('B-->>C') ||
    /Note over [^\n]*B[^\n]*:/.test(c) && !/Note over B,C/.test(c) === false; // note over B,C must be gone
  if (c.includes('A->>B: hello')) return 'fail: message referencing deleted participant survived';
  if (c.includes('Note over B,C')) return 'fail: note referencing deleted participant survived';
  if (!c.includes('C->>A: ping')) return 'fail: unrelated message was removed too';
  return true;
}

async function t14_autonumberToggle() {
  await gotoRows();
  const cb = page.locator('.scard').nth(0).locator('input[type=checkbox]').first();
  await cb.click();
  await waitCodeInclude('autonumber');
  let c = await code();
  if (!/^sequenceDiagram\n    autonumber$/m.test(c)) return 'fail: autonumber line missing after toggle on:\n' + c;
  await cb.click();
  await page.waitForTimeout(200);
  c = await code();
  if (c.includes('autonumber')) return 'fail: autonumber still present after toggle off';
  return true;
}

async function t15_typingSourceClearsSelection() {
  await gotoVisual();
  await page.locator('g.s-msg').nth(0).click();
  if (!(await pillVisible())) return 'fail: pill did not open';
  // replace the whole document by typing in the source panel
  await page.fill('.code-ta', SEED.replace('hello', 'goodbye'));
  await page.waitForTimeout(700); // let the 380ms parse debounce fire
  await page.waitForFunction(expected => document.querySelector('.code-ta').value === expected,
    SEED.replace('hello', 'goodbye'), { timeout: 5000 });
  if (await pillVisible()) return 'fail: stale selection survived full document replacement';
  return true;
}

async function t16_gapCircleNoFlicker() {
  await gotoVisual();
  const zones = page.locator('rect.s-ins');
  await zones.nth(1).hover();
  await page.waitForTimeout(60);
  const btn = page.locator('circle.s-ins-btn');
  if ((await btn.count()) !== 1) return 'fail: circle did not appear';
  // move onto the top edge of the circle, which lies OUTSIDE the old 12px band
  const bb = await btn.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + 2, { steps: 3 });
  await page.waitForTimeout(120);
  if ((await btn.count()) !== 1) return 'fail: insert circle flickered away at its edge';
  await btn.click();
  await waitCodeInclude(': message');
  return true;
}

async function t17_piePillEditing() {
  await page.locator('.mode-tab', { hasText: 'Pie' }).click();
  await page.waitForTimeout(250);
  await page.fill('.code-ta', 'pie\n    title T\n    "Alpha" : 30\n    "Beta" : 70');
  await page.waitForTimeout(700); // let parse-debounce replace the template doc
  const expected = 'pie\n    title T\n    "Alpha" : 30\n    "Beta" : 70';
  await page.waitForFunction(exp => document.querySelector('.code-ta')?.value === exp, expected, { timeout: 5000 });
  await page.locator('path.p-slice').nth(0).click();
  if (!(await pillVisible())) return 'fail: pie pill did not open';
  const inp = page.locator('.fpill input.sin').first();
  await inp.click();
  if (!(await pillVisible())) return 'fail: pie pill vanished when clicked into';
  await page.keyboard.press('Control+a').catch(() => {});
  await page.keyboard.press('Meta+a').catch(() => {});
  await page.keyboard.type('Gamma', { delay: 50 });
  await page.waitForTimeout(150);
  if (!(await pillVisible())) return 'fail: pie pill vanished while typing';
  const v = await inp.inputValue();
  if (v !== 'Gamma') return 'fail: pie label value=' + JSON.stringify(v);
  await waitCodeInclude('"Gamma"');
  return true;
}

async function t18_ganttPillEditing() {
  await page.locator('.mode-tab', { hasText: 'Gantt' }).click();
  await page.waitForTimeout(250);
  const src = 'gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %d %b\n    section S1\n    Task one :t1, 2026-01-05, 3d\n    Task two :after t1, 2d';
  await page.fill('.code-ta', src);
  await page.waitForTimeout(800); // let parse-debounce replace the template doc
  // note: the textarea keeps the raw typed text after apply (editSrc==='code'),
  // so don't wait on it here — the doc itself has been replaced already
  const trace = [];
  trace.push('ta=' + JSON.stringify(await page.evaluate(() => document.querySelector('.code-ta').value)));
  trace.push('sync=' + await page.evaluate(() => document.querySelector('.sync-chip').className));
  trace.push('bars=' + await page.locator('g.g-bar rect').count());
  await page.locator('g.g-bar rect').first().click({ force: true });
  trace.push('pill=' + await page.locator('.fpill').count());
  const inp = page.locator('.fpill input.sin').first();
  await inp.click();
  if (!(await pillVisible())) return 'fail: gantt pill vanished when clicked into | ' + trace.join(' ');
  await page.keyboard.press('End');
  await page.keyboard.type('X', { delay: 50 });
  await page.waitForTimeout(150);
  if (!(await pillVisible())) return 'fail: gantt pill vanished while typing | ' + trace.join(' ');
  try {
    await waitCodeInclude('Task oneX', 4000);
  } catch (e) {
    return 'fail: Task oneX never landed | ' + trace.join(' ') +
      ' | code=' + JSON.stringify(await code());
  }
  return true;
}

const TESTS = [
  ['T1 toolbar +Message', t1_toolbarAddMessage],
  ['T2 click row opens pill', t2_clickRowOpensPill],
  ['T3 pill delete button', t3_pillDeleteButton],
  ['T4 pill text field typing', t4_pillTextFieldTyping],
  ['T5 pill select change', t5_pillSelectChange],
  ['T5b pill act toggle/delete', t5b_pillToggleActAndDelete],
  ['T6 rows note who comma', t6_rowsNoteWhoComma],
  ['T7 endpoint drag retarget', t7_endpointDragRetarget],
  ['T8 drag reorder item', t8_dragReorderItem],
  ['T9 rows sheet ops', t9_rowsSheetOps],
  ['T10 gap insert circle', t10_gapInsertCircle],
  ['T11 undo after pill edit', t11_undoAfterPillEdit],
  ['T12 background click deselects', t12_backgroundClickDeselects],
  ['T13 rows participant delete cleans refs', t13_rowsParticipantDeleteCleansRefs],
  ['T14 autonumber toggle', t14_autonumberToggle],
  ['T15 typing source clears selection', t15_typingSourceClearsSelection],
  ['T16 gap circle no flicker at edges', t16_gapCircleNoFlicker],
  ['T17 pie pill editing', t17_piePillEditing],
  ['T18 gantt pill editing', t18_ganttPillEditing],
];

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(() => window.__STUDIO_READY === true, null, { timeout: 20000 });
await page.locator('.mode-tab', { hasText: 'Sequence' }).click();
await page.waitForTimeout(300);

for (const [name, fn] of TESTS) {
  if (filter.length && !filter.some(f => name.toLowerCase().includes(f.toLowerCase()))) continue;
  try {
    await seed();
    const r = await fn();
    results.push([name, r]);
  } catch (e) {
    results.push([name, 'error: ' + String(e.message || e).split('\n')[0].slice(0, 160)]);
  }
}

console.log('\n===== RESULTS =====');
let fails = 0;
for (const [name, r] of results) {
  const pass = r === true;
  if (!pass) fails++;
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + (pass ? '' : '  -> ' + r));
}
if (consoleErrors.length) {
  console.log('\n--- console errors ---');
  for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log(' * ' + e.slice(0, 220));
}
console.log(`\n${results.length - fails}/${results.length} passed`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
