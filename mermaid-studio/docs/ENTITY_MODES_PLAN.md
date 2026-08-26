# ENTITY MODES PLAN — class · ER · state (binding spec)

Status: BINDING. Written by the integrator from a full read of index.html.
All builder agents follow this exactly. Only the integrator edits index.html.

## 0. Design decisions

- All three new modes are **canvas modes** (like flowchart): imperative SVG board +
  bidirectional sync with the code panel. No sheet/rows view, **no React components**
  in new files. React stays in the compiled legacy UI only.
- One **shared entity layer**: boxed entities containing member-row lists + labeled
  relations with per-dialect endpoint markers/cardinalities + containers + notes.
- Files are **classic scripts** (file:// entry point ⇒ no ES modules, no dynamic
  import, no fetch of local resources). Every new file wraps everything in an IIFE
  and exposes a single window namespace.
- Legacy JSX block will be precompiled offline to `app-ui.js`
  (React.createElement) — runtime Babel removed. Compiled block declares these
  GLOBAL lexical bindings: App C DUR_RE2 FPill GANTT_STATUS_OPTS GANTT_STATUS_STYLE
  GanttDateInput GanttSheet GanttVisual JoinField MODE_LIST ModeShell PAL_ICONS
  PIE_COLORS PalIcon PieSheet PieValueInput PieVisual RowBtns SEQ_ARROW_LABELS
  SEQ_ARROW_STYLE STORE_KEY SeqSheet SeqVisual UCheck UField USelect VIEW_PREFS
  clampPill dayLabel deepClone downloadBlob escapeHtml fmtDur fmtIso isIso loadSaved
  makeApi niceTicks pieBounds polarPt resolveGantt seqArrowStyle seqLayout slicePath
  todayIso useCallback useEffect useHostSize useMemo useReducer useRef useState
  useUndoablePre — new files must never declare these at top level (IIFE solves it).
- Store stays `mermaid-studio-v2` (no schema change: docs are keyed per mode;
  loader ignores unknown mode keys; new modes seed lazily via existing ensureDoc).

## 1. File map & load order

In index.html <head>, AFTER the existing CDN tags (react, react-dom, dagre, mermaid),
BEFORE all inline scripts and BEFORE app-ui.js:

```html
<script src="js/entity-core.js"></script>   <!-- window.MSEC -->
<script src="js/entity-board.js"></script>  <!-- window.MSBoard.EntityBoard -->
<script src="js/mode-class.js"></script>    <!-- window.MSMODES.class -->
<script src="js/mode-er.js"></script>       <!-- window.MSMODES.er -->
<script src="js/mode-state.js"></script>    <!-- window.MSMODES.state -->
```

After the compiled `app-ui.js` script tag, the integrator appends ONE inline script:

```html
<script>
(function () {
  'use strict';
  var extra = window.MSMODES || {};
  Object.keys(extra).forEach(function (k) {
    extra[k].kind = 'canvas';
    C.MODES[k] = extra[k];
  });
  MODE_LIST.push.apply(MODE_LIST, Object.keys(extra));
})();
</script>
```

(`C` and `MODE_LIST` are global lexical bindings from app-ui.js — visible here.)

## 2. Frozen contracts

### 2.1 EntityDoc (identical envelope for all three dialects)

```js
{
  dir: 'TB' | 'BT' | 'LR' | 'RL',
  entities: [{
    id: String,          // internal, ASCII [_a-zA-Z0-9]+
    name: String,        // display name (may contain spaces/unicode)
    alias: String|null,  // mermaid alias when name isn't a bare id (else null)
    shape: 'box'|'note'|'start'|'stop'|'choice'|'fork'|'join',
    stereo: String|null, // e.g. '<<choice>>' is expressed via shape; stereo reserved
    members: [String],   // raw row strings, dialect-formatted (see §3)
    anchor: String|null, // note anchoring: entity id or '' (floating)
    noteSide: 'left'|'right'|null,
    x: Number|null, y: Number|null, w: Number, h: Number,   // w/h managed by board
  }],
  rels: [{
    id: String, from: String, to: String,
    kind: String,        // dialect enum below
    cardA: String, cardB: String,  // endpoint cardinality, '' = none
    label: String,                 // '' = none
  }],
  containers: [{
    id: String, title: String,
    kind: 'namespace'|'composite',   // er has none
    members: [entityId],
  }],
}
```

Rules: `parse()` returns positions as null (board keeps previous positions on
re-parse, mirroring flowchart's mergeIntoModel philosophy — but for these modes
the integrator's applyTyped path simply replaces data and the BOARD preserves
x/y by id internally, so parse always emits null positions and gen ignores them).
`gen()` output never includes coordinates. Notes are entities (shape:'note')
with `members[0]` = text and `anchor` pointing at an entity id ('' = floating).

### 2.2 Relation-kind enums & mermaid tokens

class (symmetric token pair [fwd, rev]; gen uses fwd form from→to):
- gen: `<|--` , rev `--|>`
- real: `..|>` , rev `<|..`
- comp: `*--` , rev `--*`
- agg: `o--` , rev `--o`
- assoc: `-->` , rev `<--`
- dep: `..>` , rev `<..`
- link: `--` , rev `--`
- dashed: `..` , rev `..`

er: kind is `'id'` (solid) or `'nonid'` (dotted). Internal cardinality codes (both
ends): `'|o'` zero-or-one, `'||'` exactly-one, `'}o'` zero-or-many, `'}|'`
one-or-many. EMISSION differs per side (mermaid official grammar):
- LEFT end emits:  `|o` `||` `}o` `}|`
- RIGHT end emits: `o|` `||` `o{` `|{`
Parser ACCEPTS both spellings on either side and normalizes into internal codes
so cardA always describes FROM, cardB describes TO.
Gen: `FROM <cardA-left-form><line><cardB-right-form> TO : label`
(e.g. `CUSTOMER ||--o{ ORDER : places`).

state: kind `'trans'` only. cardA/cardB always ''.

### 2.3 SVG marker vocabulary (board renders these; ids namespaced per dialect)

- arrow (open V): class assoc/dep, state trans, er both
- hollow triangle: class gen/real
- filled diamond: class comp
- hollow diamond: class agg
- crow's foot: er `}o`/`}|`; one-bar: `|o`/`||` (bar count differs: 1 vs 2? — spec:
  `|o`,`||` render ONE tick bar nearest entity; `}o` renders fork; `}|` renders
  fork + bar)
- dashed variants derive stroke-dasharray on the path, not markers.

### 2.4 Namespaces

- `window.MSEC` — pure helpers ONLY (no DOM access anywhere in this file):
  escQuote, sanitizeId, nextId(taken,prefix), measureRows(members,title,cfg)
  → {w,h} (uses canvas.measureText created lazily via document ONLY IF available,
  else char-count estimate — MUST not throw in Node where document is undefined),
  wrapLabel(text,maxChars), dagreLayout(doc, opts) → mutates x/y (guards on
  window.dagre presence, returns false if absent),
  CARD_MIRROR map, CLASS_REL_TOKENS/ER_CODES/… token tables,
  clamp(v,a,b), uid counter helper.
- `window.MSBoard` — `{ EntityBoard: class }`. Constructor:
  `new EntityBoard(wrapEl, hostEl, svc, cfg)` where svc =
  `{ toast(msg,type), snapshot(), pushUndo(pre), onChanged(), onZoom(k), isHelpOpen() }`
  (same contract flowchart's Board gets) and cfg comes from the mode registry:
  `{ dialect, defaultRel, markers: fn(kind,sel)->{start,end}, palette: [{key,label,hint}] }`.
- `window.MSMODES` — `{ class: ModeDef, er: ModeDef, state: ModeDef }` where

```js
ModeDef = {
  id: 'class'|'er'|'state',
  tab: '🏛 Class'|'🗄 ER'|'⚙️ State',
  empty(): Doc,                       // fresh doc with 2-3 sample entities
  parse(srcText): { data: Doc, errors:[{line,msg}], warnings:[{line,msg}] },
  gen(doc): String,                   // canonical mermaid, no trailing newline
  stats(doc): String,                 // 'N entities · M relations'
  templates: [{ key, name, src }],    // ≥3, all round-trip stable
  boardCfg: { dialect, defaultRel, palette: [{key,label,hint}], emptyStatsHint },
}
```

Board public API (must mirror flowchart Board surface used by App):
setModel, renderAll, normalizeModel, setActive, setSnap, fitView, layoutNow,
changeDir(dir), centerWorld(), clearSelection, deleteSel, groupSel(containerize),
ungroupSel, addTile(key, worldPtOrNull), onKeyDown(e)->bool handled, destroy().

### 2.5 Interaction spec (EntityBoard)

- Pan: space+drag / wheel zoom (reuse constants: wheel factor exp(-dy*0.0013),
  zoom clamp 0.2–3). Grid snap 16px when snapOn.
- Entities: drag to move (moves container members together when dragging a
  container body? NO — containers recompute bounds from members, like subgraphs;
  dragging container TITLE drags all members).
- Rim handles (4 sides, shown on hover/select) → drag to another entity rim →
  creates rel with cfg.defaultRel (class 'assoc', er 'id'+cards '||'/'}o',
  state 'trans'). Self-relations allowed (loop curve like flowchart).
- Double-click entity box → overlay textarea editor: FIRST LINE = display name,
  remaining lines = member rows (one per line). Commit Enter / cancel Esc.
  For note shape: whole text = members[0].
  For start/stop/choice/fork/join: editor edits display name only (label above).
- Double-click relation → overlay FORM (built with plain DOM, not React):
  selects for kind (dialect list), text inputs for cardA/cardB (er & class),
  label; Apply/Cancel buttons.
- Selection click / shift-click multi; Shift+drag rubber band; Delete key deletes
  selection (entities prune touching rels + container membership).
- Undo: every mutating op calls svc.pushUndo(svc.snapshot()) BEFORE changing,
  then svc.onChanged() after (exact pattern of flowchart Board.changed()).
- Containers via Ctrl+G groupSel → dialog-less default title ('Namespace1' /
  'Composite1'), Ctrl+Shift+G ungroupSel. Container membership is cosmetic
  grouping (mermaid namespace/composite blocks regenerated from it).
- Auto layout: MSEC.dagreLayout honoring doc.dir; containers excluded from dagre,
  bounds drawn around members afterwards (+ padding 26/48 like sgBounds).

## 3. Dialect specs

### 3.1 class — header `classDiagram`

Supported subset:
- header line `classDiagram`, optional `direction TB|BT|LR|RL` (default TB)
- `class Foo` / `class Foo~T~` (generics stripped into name display `Foo<T>`;
  tilde form accepted, gen emits tilde form)
- member lines via braces block or `Foo : member` repeats; visibility prefix
  `+ - # ~` optional; classifiers trailing `*` (abstract) `$` (static) preserved
  verbatim as text; parens detection purely cosmetic
- relations incl. cardinality: `A "1" --> "0..*" B : label`, labels optional,
  `|label|` pipe form NOT supported (warning + dropped label)
- `note "text"` floating; `note for Foo "text"` anchored
- `namespace Name { ... }` one nesting level (deeper → warning, flattened)
Warned & dropped: classDef/cssClass/style lines, <<Interface>>/<<Abstract>>
stereotypes kept as plain text in name? DECISION: keep stereotype text as part of
name display (e.g. `Foo«interface»`)? NO — strip `<<...>>` into warnings, keep
bare name. click/link/callback directives dropped.
Gen canonical order: header, direction, namespaces(blocks), classes(alpha),
notes, rels (input order), one blank line between groups. Members sorted? NO —
preserve author order. Bare-id names emitted bare; names that are NOT valid bare
identifiers use mermaid's bracket-label form `class <Id>["<Display>"]` and ALL
relation endpoints reference the bare `<Id>` (classDiagram has NO `"Disp" as id`
alias syntax — that is state-diagram grammar).

### 3.2 er — header `erDiagram`

Supported subset:
- header, optional direction LR|TB|RL|BT (default LR)
- entity attribute block: `ENTITY { type name KEYS "comment" ... }`; type may be
  bare word or word(parens) e.g. `varchar(20)`; keys comma-sep subset of
  PK/FK/UK; comment optional double-quoted single line; attribute alone
  `type name` fine. Rows stored verbatim minus normalization.
- bare entity references (no block) auto-create entities
- relations: `A ||--o{ B : verb`, dotted `..` non-identifying variant; both
  cardinality families on both sides
Warned & dropped: QUOTED entity names are NOT supported (mermaid v11 erDiagram
cannot be relied on to parse them) → warning + sanitize to UPPER_SNAKE id
(spaces→'_'); keys outside allowed set → warning; role keywords after comment dropped.
Gen canonical: header, direction, entity blocks (alpha, attrs in author order,
comment quoted), blank line, rels input order with spaces exactly
`A ||--o{ B : verb`.

### 3.3 state — header `stateDiagram-v2`

Supported subset:
- transitions `A --> B : label` (label optional); `[*]` becomes shape 'start'
  when on left, 'stop' when on right; BOTH sides [*] → error
- description lines `A : some text` (multiple accumulate in member order)
- `state "Long Label" as X2` alias form; bare ids otherwise
- composite: `state Cname { ... inner transitions/notes ... direction LR? }`;
  composites become containers kind 'composite' whose members are inner states;
  inner-only constructs stay scoped (parser holds a stack); nested composites →
  warning + flatten contents into outer
- `state C1 <<choice>>` / `<<fork>>` / `<<join>>` → shapes
- notes: `note right of X : text` / `note left of X : text`; block note form
  (`note right of X \n text \n end note`) supported
Warned & dropped: concurrency `--` region separators inside composites,
`displayShortName`, custom theme/classes.
Gen canonical: header, direction, alias declarations first (only when needed),
composites as blocks (members indented 4), descriptions, notes, transitions in
input order. Start/stop emit `[*]`.

## 4. Templates (binding minimums — builders MAY add more)

Each template must satisfy: parses with zero errors, gen(parse(src)) round-trips
stable, exercises ≥6 entities/rels, uses its dialect's headline features.

**class**: `software-system` (Vehicle hierarchy w/ generics + abstract member +
composition Car↔Engine + dependency + note + namespace Geometry with Point/Polygon);
`company-model` (Employee/Manager inheritance + aggregation Department);
`mvc-notes` (Controller→Model dependency, View composition, floating + anchored notes).

**er**: `ecommerce` (CUSTOMER ||--o{ ORDER ||--|{ ORDER_ITEM }|--|| PRODUCT,
varchar(40) types, PK/FK/UK, comments); `blog` (USER, POST, COMMENT, TAG w/
non-identifying dotted rel); `clinic` (PATIENT, APPOINTMENT, DOCTOR w/ |o cards).

**state**: `vending-machine` (idle→coinInserted→dispensing w/ choice
<<choice>> returnCoin branch + stop states); `traffic-light` (composite
`Lights` w/ direction LR + cycle); `media-player` (paused/playing aliases w/
long labels, fork/join, notes both forms).

Full sources: builders author them following §3 subsets EXACTLY; integrator
verifies each against the subset tables and mermaid semantics.

## 5. Integration checklist (integrator-only; anchors are quoted snippets)

1. Head scripts: insert block from §1 immediately after the mermaid CDN
   `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>`.
2. Replace entire legacy babel block + drop unpkg @babel tag via tools/precompile.js --apply
   (staged compile already verified). Resulting page loads app-ui.js before inline merge script.
3. Append merge script from §1 after app-ui.js script tag.
4. In compiled app-ui.js (owned post-compile; regenerate-safe because precompile.js
   --apply is one-shot and won't rerun): hand-edit these exact spots —
   a. `const MODE_LIST = ['flowchart', 'sequence', 'gantt', 'pie'];` → leave, merge script pushes.
   b. boot effect: locate `const b = new C.Board(wrapRef.current, boardHostRef.current, svc);`
      — after `b.setActive(modeRef.current === 'flowchart');` add creation loop:
      ```js
      window.__ENTITY_BOARDS = {};
      Object.keys(window.MSMODES||{}).forEach(function(k){
        var M = C.MODES[k];
        var res = M.parse(M.templates[0].src);
        if (!docsRef.current[k] || !docsRef.current[k].data)
          docsRef.current[k] = { data: res.errors.length ? M.empty() : res.data };
        var EB = window.MSBoard.EntityBoard;
        var eb = new EB(wrapRef.current, boardHostRef.current, svc,
                        Object.assign({ modeId: k }, M.boardCfg));
        eb.setModel(docsRef.current[k].data);
        eb.setSnap(snapRef.current);
        eb.setActive(false);
        eb.root.style.display = 'none';   // hide WHOLE wrapper incl. pill/editor
        window.__ENTITY_BOARDS[k] = eb;
      });
      ```
      plus matching destroy loop in cleanup.
   c. introduce `const activeBoard = () => boardRef.current && boardRef.current.isActive ? boardRef.current : (window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[modeRef.current]) || null;`
      — simpler: helper `boardFor(m)` returning flowchart board or entity board;
      replace `isFc` gating: `const isFc = mode === 'flowchart';` →
      `const isCanvas = mode === 'flowchart' || !!(window.MSMODES && window.MSMODES[mode]);`
      and swap the `isFc ?` usages for canvas visibility/palette to isCanvas —
      AUDIT ALL FIVE usages: topbar contents div, palette aside gate, canvas-wrap
      display, `{!isFc && <ModeShell/>}`, and fcNodes (guard
      `(curData.nodes || curData.entities || []).length` so entity docs don't crash it).
      Palette drag payloads: `'ms-tile:' + mode + ':' + key`.
      keeping flowchart-specific palette content behind `mode === 'flowchart'` and adding
      an entity-palette branch rendering `C.MODES[mode].boardCfg.palette` tiles that call
      `window.__ENTITY_BOARDS[mode].addTile(key, null)`.
   d. topbar controls calling `boardRef.current.X()` inside the canvas-gated groups →
      route through boardFor(mode) (zoom/snap/layout/dir/group/delete). ALSO generalize
       the direction USelect onCommitPre which hardcodes a flowchart snapshot —
       use the current mode's doc.
   e. applyTyped/applyTemplate/Clear flowchart branches → generalize:
      `if (isCanvasLike(m)) { …boardFor(m).setModel(data)… } else {…}` preserving
      flowchart's mergeIntoModel branch verbatim.
       ALSO restoreSnapshot currently setModel's only the flowchart board —
       extend it to entity boards, else undo in entity modes never repaints.
   f. switchMode: `boardRef.current.setActive(...)` → also toggle entity boards
      active + root.style.display (the WHOLE per-board wrapper div, not bare svg —
       otherwise pill/editor overlays leak when hidden), and re-setModel from
       docsRef as cheap idempotent safety.
    g2. global keydown router `if (boardRef.current && boardRef.current.onKeyDown(e)) return;`
       must route through boardFor(modeRef.current) so Del/Esc/F/Ctrl+G/Ctrl+D
       reach the ACTIVE entity board (currently only flowchart receives keys).
   g. help modal Modes list + Supported-syntax list: add three entries.
5. Verify store: no change (§0).

## 6. Test harness (tools/studio-check.js — integrator writes after builders land)

Node, zero deps: stubs `global.window = global` (+ minimal `document` undefined-safe
paths), `global.React = { createElement: () => ({}) }` (mode files never invoke it),
then `vm.runInContext` each js file in a shared sandbox; asserts per mode:
templates parse error-free; `gen(parse(gen(parse(src)))) === gen(parse(src))`;
gen output first line equals dialect header; stats() returns string containing '·';
empty() parses clean. Exits non-zero on any failure. Plus tools/syntax-check.js
(already built) gates classic-script compilation + forbidden constructs.

## 7. Task cards

**Core builder** — creates ONLY `js/entity-core.js` + `js/entity-board.js` per §2.
Acceptance: syntax-check ok; MSEC has zero DOM references except guarded
measureText lazy canvas; EntityBoard implements full §2.4 API; both files IIFE-wrapped.

**Class/ER/State builders** — each creates ONLY `js/mode-{class,er,state}.js` per
§2.5 ModeDef + §3 dialect spec + §4 templates. Acceptance: syntax-check ok; file
registers exactly one key onto window.MSMODES; parse/gen pure (no document/window
access beyond `window.MSMODES` registration); all templates stable under double
round-trip (self-testable in Node with window stub — include a `if (typeof module !== 'undefined')` guard? NO — keep files pure browser classic scripts; testing happens via integrator harness loading them in vm).

**Hard rules for ALL builders**: do not touch index.html; do not create extra files;
no ES module syntax; no JSX; no external deps beyond existing CDN tags; no top-level
declarations outside your IIFE except the one window namespace you attach to.

## 8. Risks / edge cases

- ER types with parens vs relation arrows: parse attributes ONLY inside `{}` blocks;
  bare-line heuristics limited to known relation regex first.
- Class generics `~T~` conflict with visibility `~`: tilde pairs only matched when
  balanced and adjacent to identifier boundaries.
- State `[*]` on both ends → hard error with line number.
- Quoted display names containing `:` (class member separator) — member lines split
  on FIRST `:` only; entity names never contain `:`.
- Alias generation collisions (O1 taken) → nextId helper.
- dagre absent (offline) → layoutNow returns false, toast 'dagre unavailable'.
- Mermaid strictness: generated output must avoid tabs (spaces only) and trailing
  whitespace; blank-line separation between logical groups aids mermaid parser.
