/*
 * Mermaid Studio — entity canvas board (window.MSBoard.EntityBoard)
 * Imperative SVG board for the class / ER / state modes.
 * Binding spec: docs/ENTITY_MODES_PLAN.md §2.1–§2.5.
 *
 * House rules honored here:
 *   - classic script, one IIFE, attaches window.MSBoard.EntityBoard only
 *   - plain DOM/SVG APIs, no React, no JSX
 *   - mirrors the flowchart Board's proven patterns (pan/zoom, rim-dot link
 *     drag, band select, pill toolbar, overlay editors, dagre layout,
 *     svc undo contract, parallel bezier edges, self-loop curve)
 *   - all visuals are SVG presentation attributes / inline styles so NO
 *     stylesheet edits are required; only pre-existing global classes
 *     (.board .band .pill .pill-shape-name .editor-overlay) are reused
 *   - does not depend on window.StudioCore or any inline script at load time
 */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var SANS = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    var GRID = 16;
    var LH = 17;
    var DIRS = ['TB', 'BT', 'LR', 'RL'];
    var NOTE_WRAP_CHARS = 36;

    // theme literals lifted from index.html CSS vars / rules
    var T = {
        entFill: '#131f36',
        entStroke: '#4a6079',
        selStroke: '#22d3ee',
        glow: 'drop-shadow(0 0 6px rgba(34,211,238,.45))',
        sepStroke: '#223047',
        titleFill: '#dbe6f3',
        memFill: '#b6c4d8',
        noteFill: '#152238',
        noteFold: '#1e2f4d',
        dotFill: '#c3d5ec',
        barFill: '#8fa6c4',
        line: '#7e93ae',
        lineHover: '#b9c8dc',
        chipFill: 'rgba(13,21,38,.92)',
        chipStroke: '#223047',
        chipText: '#b6c4d8',
        cardText: '#9fb3cc',
        contStroke: '#35507a',
        contSelStroke: '#22d3ee',
        contFill: 'rgba(56,84,128,.08)',
        contTab: 'rgba(53,80,122,.42)',
        contTabSel: 'rgba(34,211,238,.16)',
        contText: '#7f96b4',
        handleFill: '#0b1220',
    };

    var TITLE_FONT = '600 13px ' + SANS;
    var ROW_FONT = '11.5px ' + MONO;
    var LABEL_FONT = '500 11.5px ' + SANS;
    var CONT_FONT = '600 11.5px ' + SANS;
    var NAME_FONT = '600 12.5px ' + SANS;

    var KIND_LABELS = {
        gen: 'generalization', real: 'realization', comp: 'composition', agg: 'aggregation',
        assoc: 'association', dep: 'dependency', link: 'link', dashed: 'dashed link',
        id: 'identifying', nonid: 'non-identifying', trans: 'transition',
    };
    var SPECIAL_SIZE = {
        start: { w: 26, h: 26 },
        stop: { w: 26, h: 26 },
        choice: { w: 48, h: 46 },
        fork: { w: 74, h: 6 },
        join: { w: 74, h: 6 },
    };
    var DASH_KINDS = { dep: 1, dashed: 1, nonid: 1 };

    // ------------------------------------------------------------------
    // marker vocabulary (pre-registered per dialect, namespaced ids)
    // ------------------------------------------------------------------
    var MARKER_SHAPES = {
        ah: {
            refX: 8, mw: 8,
            draw: c => `<path d="M1.5,1 L9,5 L1.5,9" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        tri: {
            refX: 8.5, mw: 9,
            draw: c => `<path d="M1,1.5 L9,5 L1,8.5 Z" fill="#131f36" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/>`,
        },
        diaF: { refX: 9, mw: 7.5, draw: c => `<path d="M0.5,5 L5,1.5 L9.5,5 L5,8.5 Z" fill="${c}"/>` },
        diaH: {
            refX: 9, mw: 7.5,
            draw: c => `<path d="M0.5,5 L5,1.5 L9.5,5 L5,8.5 Z" fill="#131f36" stroke="${c}" stroke-width="1.4"/>`,
        },
        crow: {
            refX: 9.2, mw: 9,
            draw: c => `<path d="M0.6,0.8 L9.4,5 L0.6,9.2 M0.6,5 L9.4,5" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
        },
        crowb: {
            refX: 9.2, mw: 9.5,
            draw: c => `<path d="M3,0.8 L3,9.2 M3,0.8 L9.4,5 L3,9.2 M3,5 L9.4,5" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        bar1: { refX: 7.4, mw: 7, draw: c => `<path d="M7,1 L7,9" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
        bar2: {
            refX: 8.4, mw: 8,
            draw: c => `<path d="M4.6,1 L4.6,9 M8.2,1 L8.2,9" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`,
        },
    };
    var DIALECT_MARKERS = { 'class': ['ah', 'tri', 'diaF', 'diaH'], er: ['ah', 'crow', 'crowb', 'bar1', 'bar2'], state: ['ah'] };
    // plan §2.3: |o & || -> ONE tick bar nearest entity; }o -> fork; }| -> fork + bar
    var ER_CARD_MARKER = { '|o': 'msc-bar1', '||': 'msc-bar1', '}o': 'msc-crow', '}|': 'msc-crowb' };
    var BUILTIN_CLASS_MARKERS = {
        gen: ['msc-tri', ''],
        real: ['', 'msc-tri'],
        comp: ['msc-diaF', ''],
        agg: ['msc-diaH', ''],
        assoc: ['', 'msc-ah'],
        dep: ['', 'msc-ah'],
        link: ['', ''],
        dashed: ['', ''],
    };

    // ------------------------------------------------------------------
    // small DOM helpers
    // ------------------------------------------------------------------
    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }

    let _meas = null;
    let _measTried = false;
    function measCtx() {
        if (_measTried) return _meas || null;
        _measTried = true;
        try {
            const c = document.createElement('canvas');
            _meas = (c && c.getContext) ? c.getContext('2d') : null;
        } catch (e) { _meas = null; }
        return _meas;
    }
    function tw(font, s, est) {
        const ctx = measCtx();
        if (ctx) { ctx.font = font; return ctx.measureText(String(s == null ? '' : s)).width; }
        return String(s == null ? '' : s).length * est;
    }

    function isNum(v) { return typeof v === 'number' && isFinite(v); }

    // ==================================================================
    // EntityBoard
    // ==================================================================
    class EntityBoard {
        constructor(wrapEl, hostEl, svc, cfg) {
            this.svc = svc || {};
            this.cfg = cfg || {};
            this.dialect = this.cfg.dialect || 'class';
            this.model = null;
            this.view = { x: 0, y: 0, k: 1 };
            this.selEnts = new Set();
            this.selRels = new Set();
            this.selCont = null;
            this.hoverEntId = null;
            this.hoverRelId = null;
            this.drag = null;
            this.spaceDown = false;
            this.pendSnap = null;
            this.snapOn = true;
            this.active = true;
            this.edMode = null;      // {type:'ent'|'cont', id}
            this.formRelId = null;
            this.fitTimer = null;
            this.wrap = wrapEl;
            this.host = hostEl;

            this.sizeCfg = {
                rowH: LH, padX: 12, minW: 90, maxW: 340,
                titleFont: TITLE_FONT, rowFont: ROW_FONT, titleEst: 7.6, rowEst: 6.9,
            };

            // --- svg scaffold (mirrors flowchart Board assembly)
            this.svg = svgEl('svg', { class: 'board' });
            this.defsEl = svgEl('defs', {});
            this.world = svgEl('g', {});
            this.contLayer = svgEl('g', {});
            this.relLayer = svgEl('g', {});
            this.entLayer = svgEl('g', {});
            this.tempLayer = svgEl('g', { class: 'tempLayer' });
            this.world.appendChild(this.contLayer);
            this.world.appendChild(this.relLayer);
            this.world.appendChild(this.entLayer);
            this.world.appendChild(this.tempLayer);
            this.svg.appendChild(this.defsEl);
            this.svg.appendChild(this.world);

            this.band = document.createElement('div');
            this.band.className = 'band';
            this.pill = document.createElement('div');
            this.pill.className = 'pill';
            this.pillName = document.createElement('span');
            this.pillName.className = 'pill-shape-name';
            const mkBtn = (txt, title, cls) => {
                const b = document.createElement('button');
                b.textContent = txt;
                b.title = title || '';
                if (cls) b.className = cls;
                return b;
            };
            this.pilEdit = mkBtn('✎', 'Edit entity');
            this.pilDup = mkBtn('⧉', 'Duplicate');
            this.pilDel = mkBtn('🗑', 'Delete', 'danger');
            this.pill.appendChild(this.pillName);
            this.pill.appendChild(this.pilEdit);
            this.pill.appendChild(this.pilDup);
            this.pill.appendChild(this.pilDel);

            this.editor = document.createElement('textarea');
            this.editor.className = 'editor-overlay';
            this.editor.spellcheck = false;

            this.form = this.buildForm();

            // All board DOM lives inside a single wrapper so the integrator can
            // hide/show the whole board (including overlays) via this.root
            this.root = document.createElement('div');
            this.root.className = 'entity-board-root';
            this.root.style.cssText = 'position:absolute;inset:0;';
            this.root.appendChild(this.svg);
            this.root.appendChild(this.band);
            this.root.appendChild(this.pill);
            this.root.appendChild(this.editor);
            this.root.appendChild(this.form);
            hostEl.appendChild(this.root);

            this.buildDefs();

            // --- events
            this._onWheel = e => {
                if (!this.active) return;
                e.preventDefault();
                const p = this.screenPt(e);
                this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0013));
            };
            this._onDown = e => this.onPointerDown(e);
            this._onMove = e => this.onPointerMove(e);
            this._onUp = e => this.onPointerUp(e);
            this._onDbl = e => this.onDblClick(e);
            this._onLeave = () => this.clearHover();
            this.svg.addEventListener('wheel', this._onWheel, { passive: false });
            this.svg.addEventListener('pointerdown', this._onDown);
            this.svg.addEventListener('pointermove', this._onMove);
            this.svg.addEventListener('pointerup', this._onUp);
            this.svg.addEventListener('dblclick', this._onDbl);
            this.svg.addEventListener('pointerleave', this._onLeave);

            this.pilEdit.addEventListener('click', () => {
                if (this.selEnts.size === 1) this.openEntityEditor([...this.selEnts][0]);
            });
            this.pilDup.addEventListener('click', () => this.duplicateSel());
            this.pilDel.addEventListener('click', () => this.deleteSel());

            this._edInput = () => this.autosizeEditor();
            this._edKey = e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.closeEditor(false); }
                if (e.key === 'Escape') { e.preventDefault(); this.closeEditor(true); }
                e.stopPropagation();
            };
            this._edBlur = () => this.closeEditor(false);
            this.editor.addEventListener('input', this._edInput);
            this.editor.addEventListener('keydown', this._edKey);
            this.editor.addEventListener('blur', this._edBlur);

            this._onKey = e => this.onKeyDown(e);
            this._onKeyUp = e => {
                if (e.key === ' ') { this.spaceDown = false; this.svg.style.cursor = ''; }
            };
            this._onResize = () => this.positionPill();
            window.addEventListener('keydown', this._onKey);
            window.addEventListener('keyup', this._onKeyUp);
            window.addEventListener('resize', this._onResize);

            // palette drag-drop from wrap (tiles carry `ms-tile:<modeId>:<key>` payload;
            // also accept legacy `tile:<key>` and flowchart `shape:<key>` for compat)
            if (wrapEl) {
                this._onDragOver = e => e.preventDefault();
                this._onDrop = e => {
                    if (!this.active) return;
                    e.preventDefault();
                    let data = '';
                    try { data = e.dataTransfer.getData('text/plain') || ''; } catch (err) { data = ''; }
                    let m = /^ms-tile:([^:]+):(.+)$/.exec(data);
                    if (m) {
                        const modeId = m[1];
                        const key = m[2];
                        if (this.cfg.modeId && modeId !== this.cfg.modeId) return;
                        const p = this.screenPt(e);
                        this.addTile(key, this.screenToWorld(p.x, p.y));
                        return;
                    }
                    m = /^(?:tile|shape):(.+)$/.exec(data);
                    if (!m) return;
                    const p2 = this.screenPt(e);
                    this.addTile(m[1], this.screenToWorld(p2.x, p2.y));
                };
                wrapEl.addEventListener('dragover', this._onDragOver);
                wrapEl.addEventListener('drop', this._onDrop);
            }
        }

        // --------------------------------------------------------------
        // lifecycle
        // --------------------------------------------------------------
        destroy() {
            window.removeEventListener('keydown', this._onKey);
            window.removeEventListener('keyup', this._onKeyUp);
            window.removeEventListener('resize', this._onResize);
            this.svg.removeEventListener('wheel', this._onWheel);
            this.svg.removeEventListener('pointerdown', this._onDown);
            this.svg.removeEventListener('pointermove', this._onMove);
            this.svg.removeEventListener('pointerup', this._onUp);
            this.svg.removeEventListener('dblclick', this._onDbl);
            this.svg.removeEventListener('pointerleave', this._onLeave);
            this.editor.removeEventListener('input', this._edInput);
            this.editor.removeEventListener('keydown', this._edKey);
            this.editor.removeEventListener('blur', this._edBlur);
            if (this.wrap) {
                this.wrap.removeEventListener('dragover', this._onDragOver);
                this.wrap.removeEventListener('drop', this._onDrop);
            }
            clearTimeout(this.fitTimer);
        }

        isActive() { return this.active; }
        setActive(a) {
            this.active = !!a;
            if (!a) {
                this.clearSelection();
                this.refreshSelClasses();
                this.hidePill();
                this.closeEditor(true);
                this.hideForm();
            }
        }
        setSnap(b) { this.snapOn = !!b; }

        buildDefs() {
            const shapes = DIALECT_MARKERS[this.dialect] || DIALECT_MARKERS['class'];
            let html = '';
            shapes.forEach(name => {
                const sp = MARKER_SHAPES[name];
                [['n', T.line], ['s', T.selStroke]].forEach(pair => {
                    html += `<marker id="msc-${name}-${pair[0]}" viewBox="0 0 10 10" refX="${sp.refX}" refY="5"` +
                        ` markerWidth="${sp.mw}" markerHeight="${sp.mw}" orient="auto-start-reverse">${sp.draw(pair[1])}</marker>`;
                });
            });
            this.defsEl.innerHTML = html;
        }

        // --------------------------------------------------------------
        // svc helpers (contract: toast/snapshot/pushUndo/onChanged/onZoom/isHelpOpen)
        // --------------------------------------------------------------
        toast(msg, type) { if (typeof this.svc.toast === 'function') this.svc.toast(msg, type); }
        takeSnap() { return typeof this.svc.snapshot === 'function' ? this.svc.snapshot() : ''; }
        pushUndo(pre) { if (typeof this.svc.pushUndo === 'function') this.svc.pushUndo(pre); }

        /** standard mutation epilogue: normalize + repaint + notify (undo already pushed by caller BEFORE mutating) */
        changed(opts) {
            opts = opts || {};
            this.normalizeModel();
            this.renderAll();
            if (!opts.keepView) this.fitSoon();
            if (typeof this.svc.onChanged === 'function') this.svc.onChanged();
        }

        fitSoon() {
            clearTimeout(this.fitTimer);
            this.fitTimer = setTimeout(() => this.fitView(), 60);
        }

        // --------------------------------------------------------------
        // model access
        // --------------------------------------------------------------
        entById(id) { return this.model ? (this.model.entities.find(n => n.id === id) || null) : null; }
        relById(id) { return this.model ? (this.model.rels.find(r => r.id === id) || null) : null; }
        contById(id) { return this.model ? (this.model.containers.find(c => c.id === id) || null) : null; }

        allIds() {
            const out = new Set();
            if (!this.model) return out;
            this.model.entities.forEach(n => out.add(n.id));
            this.model.rels.forEach(r => out.add(r.id));
            this.model.containers.forEach(c => out.add(c.id));
            return out;
        }

        defaultDir() { return this.dialect === 'er' ? 'LR' : 'TB'; }

        setModel(m) {
            const prev = this.model;
            this.model = (m && typeof m === 'object') ? m : { dir: this.defaultDir(), entities: [], rels: [], containers: [] };
            // [DEBUG-7f3a] migrate legacy docs (nodes/edges -> entities/rels) that cause LHS blank
            if (!Array.isArray(this.model.entities) && Array.isArray(this.model.nodes)) {
              console.log('[DEBUG-7f3a] migrating', this.dialect, 'nodes->entities', this.model.nodes.length);
              this.model.entities = this.model.nodes;
              delete this.model.nodes;
            }
            if (!Array.isArray(this.model.rels) && Array.isArray(this.model.edges)) {
              console.log('[DEBUG-7f3a] migrating', this.dialect, 'edges->rels');
              this.model.rels = this.model.edges;
              delete this.model.edges;
            }
            if (!Array.isArray(this.model.entities)) this.model.entities = [];
            if (!Array.isArray(this.model.rels)) this.model.rels = [];
            if (!Array.isArray(this.model.containers)) this.model.containers = [];

            // board keeps x/y by id across re-apply (parse emits null positions)
            const prevPos = new Map();
            if (prev && Array.isArray(prev.entities)) {
                prev.entities.forEach(n => { if (n && isNum(n.x) && isNum(n.y)) prevPos.set(n.id, n); });
            }
            this.model.entities.forEach(n => {
                if (!isNum(n.x) || !isNum(n.y)) {
                    const p = prevPos.get(n.id);
                    n.x = p ? p.x : null;
                    n.y = p ? p.y : null;
                }
            });

            this.normalizeModel();

            // place anything still unpositioned: dagre first, grid cascade fallback
            const missing = this.model.entities.filter(n => !isNum(n.x) || !isNum(n.y));
            const placed = missing.length > 0;
            if (placed) {
                if (!MSEC.dagreLayout(this.model)) this.autoPlace(missing);
                this.normalizeModel();
            }

            this.clearSelection();
            this.closeEditor(true);
            this.hideForm();
            this.renderAll();
            if (placed) this.fitSoon();   // keep view stable on plain text re-syncs
        }

        autoPlace(list) {
            let x = 40, y = 40, rowH = 0;
            for (const n of list) {
                if (!isNum(n.w) || !isNum(n.h)) continue;
                if (x + n.w > 1500 && x > 40) { x = 40; y += rowH + 56; rowH = 0; }
                n.x = Math.round(x + n.w / 2);
                n.y = Math.round(y + n.h / 2);
                x += n.w + 70;
                if (n.h > rowH) rowH = n.h;
            }
        }

        sizeEntity(n) {
            const shape = n.shape || 'box';
            if (SPECIAL_SIZE[shape]) {
                const s = SPECIAL_SIZE[shape];
                n.w = s.w; n.h = s.h;
                return;
            }
            if (shape === 'note') {
                const text = (n.members && n.members[0] != null) ? String(n.members[0]) : '';
                const lines = MSEC.wrapLabel(text, NOTE_WRAP_CHARS);
                n._lines = lines.length ? lines : [''];
                let wMax = 0;
                for (const l of n._lines) wMax = Math.max(wMax, tw(ROW_FONT, l, 6.9));
                n.w = Math.round(Math.min(Math.max(wMax + 30, 90), 320));
                n.h = Math.round(Math.max(n._lines.length * LH + 18, 44));
                return;
            }
            // box: wrap very long titles onto <=3 lines
            const name = n.name == null ? '' : String(n.name);
            const maxTitleW = this.sizeCfg.maxW - 24;
            let titleLines = [name];
            if (tw(TITLE_FONT, name, 7.6) > maxTitleW) {
                const approxChars = Math.max(8, Math.floor(maxTitleW / 7.6));
                titleLines = MSEC.wrapLabel(name, approxChars).slice(0, 3);
            }
            n._titleLines = titleLines;
            const r = MSEC.measureRows(titleLines, n.members || [], this.sizeCfg);
            n.w = r.w; n.h = r.h; n._bandH = r.bandH;
        }

        normalizeModel() {
            const m = this.model;
            if (!m) return;
            if (!DIRS.includes(m.dir)) m.dir = this.defaultDir();
            if (!Array.isArray(m.entities)) m.entities = [];
            if (!Array.isArray(m.rels)) m.rels = [];
            if (!Array.isArray(m.containers)) m.containers = [];

            // unique entity ids
            const seen = new Set();
            m.entities.forEach(n => {
                if (!n) return;
                let id = n.id == null ? '' : String(n.id);
                if (!id || seen.has(id)) {
                    const taken = this.allIds();
                    id = MSEC.nextId(taken, MSEC.sanitizeId(n.name) || (this.dialect === 'er' ? 'E' : 'e'));
                    n.id = id;
                }
                seen.add(n.id);
                if (!n.shape) n.shape = 'box';
                if (!Array.isArray(n.members)) n.members = [];
                this.sizeEntity(n);
            });

            // rels: prune dangling, coerce kind/cards to dialect enum
            const kinds = MSEC.REL_KINDS[this.dialect] || MSEC.REL_KINDS['class'];
            const defKind = MSEC.DEFAULT_REL[this.dialect] || 'assoc';
            m.rels = m.rels.filter(r => r && r.from != null && r.to != null &&
                m.entities.some(n => n.id === r.from) && m.entities.some(n => n.id === r.to));
            m.rels.forEach(r => {
                if (!r.id) r.id = MSEC.nextId(seen, 'r');
                seen.add(r.id);
                if (!kinds.includes(r.kind)) r.kind = defKind;
                if (this.dialect === 'er') {
                    if (!MSEC.ER_CODES.includes(r.cardA)) r.cardA = '';
                    if (!MSEC.ER_CODES.includes(r.cardB)) r.cardB = '';
                } else if (this.dialect === 'state') {
                    r.cardA = ''; r.cardB = '';
                } else {
                    r.cardA = r.cardA == null ? '' : String(r.cardA).trim().slice(0, 10);
                    r.cardB = r.cardB == null ? '' : String(r.cardB).trim().slice(0, 10);
                }
                r.label = r.label == null ? '' : String(r.label);
            });

            // containers: valid kind, members pruned, empties dropped
            const contKind = MSEC.CONTAINER_KINDS[this.dialect];
            m.containers = m.containers.filter(() => !!contKind);
            m.containers.forEach(c => { if (!c.kind) c.kind = contKind; });
            m.containers.forEach(c => {
                if (!c.members) c.members = [];
            });
            const known = new Set(m.entities.map(n => n.id));
            m.containers.forEach(c => {
                const uniq = [];
                c.members.forEach(id => { if (known.has(id) && !uniq.includes(id)) uniq.push(id); });
                c.members = uniq;
            });
            m.containers = m.containers.filter(c => c.members.length > 0);
            m.containers.forEach(c => {
                if (!c.id) { c.id = MSEC.nextId(seen, 'C'); seen.add(c.id); }
                if (!c.title) c.title = c.id;
            });
            if (this.selCont && !this.contById(this.selCont)) this.selCont = null;
        }

        // --------------------------------------------------------------
        // view / zoom
        // --------------------------------------------------------------
        screenPt(e) {
            const r = this.svg.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        }
        screenToWorld(px, py) {
            return { x: (px - this.view.x) / this.view.k, y: (py - this.view.y) / this.view.k };
        }
        worldToScreen(wx, wy) {
            return { x: wx * this.view.k + this.view.x, y: wy * this.view.k + this.view.y };
        }
        centerWorld() {
            return this.screenToWorld(this.svg.clientWidth / 2, this.svg.clientHeight / 2);
        }
        applyViewTransform() {
            this.world.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`);
            if (typeof this.svc.onZoom === 'function') this.svc.onZoom(Math.round(this.view.k * 100));
            this.positionPill();
        }
        zoomAt(px, py, factor) {
            const k2 = Math.min(3, Math.max(0.2, this.view.k * factor));
            factor = k2 / this.view.k;
            this.view.x = px - (px - this.view.x) * factor;
            this.view.y = py - (py - this.view.y) * factor;
            this.view.k = k2;
            this.applyViewTransform();
        }
        zoomCenter(f) { this.zoomAt(this.svg.clientWidth / 2, this.svg.clientHeight / 2, f); }

        fitView() {
            if (!this.model || !this.model.entities.length) {
                this.view = { x: 0, y: 0, k: 1 };
                this.applyViewTransform();
                return;
            }
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const n of this.model.entities) {
                if (!isNum(n.x) || !isNum(n.y)) continue;
                minX = Math.min(minX, n.x - n.w / 2); maxX = Math.max(maxX, n.x + n.w / 2);
                minY = Math.min(minY, n.y - n.h / 2); maxY = Math.max(maxY, n.y + n.h / 2);
            }
            if (minX === Infinity) { this.view = { x: 0, y: 0, k: 1 }; this.applyViewTransform(); return; }
            const cw = this.svg.clientWidth, ch = this.svg.clientHeight;
            const pad = 70;
            const k = Math.min((cw - pad * 2) / Math.max(maxX - minX, 1), (ch - pad * 2) / Math.max(maxY - minY, 1), 1.4);
            this.view.k = Math.max(k, 0.2);
            this.view.x = (cw - (minX + maxX) * this.view.k) / 2;
            this.view.y = (ch - (minY + maxY) * this.view.k) / 2;
            this.applyViewTransform();
        }

        layoutNow() {
            if (!this.model) return false;
            const snap = this.takeSnap();           // pre-state, pushed only on success
            const ok = MSEC.dagreLayout(this.model);
            if (!ok) {
                this.toast(window.dagre ? 'nothing to lay out' : 'dagre unavailable', window.dagre ? undefined : 'err');
                return false;
            }
            this.pushUndo(snap);
            this.changed({ keepView: true });
            setTimeout(() => this.fitView(), 80);
            return true;
        }

        changeDir(dir) {
            if (!this.model || !DIRS.includes(dir)) return false;
            const snap = this.takeSnap();
            this.model.dir = dir;
            MSEC.dagreLayout(this.model);           // best-effort relayout attempt
            this.pushUndo(snap);
            this.changed({ keepView: true });
            return true;
        }

        // --------------------------------------------------------------
        // selection
        // --------------------------------------------------------------
        clearSelection() {
            this.selEnts.clear();
            this.selRels.clear();
            this.selCont = null;
            this.hidePill();
        }

        selectAll() {
            if (!this.model) return;
            this.clearSelection();
            this.model.entities.forEach(n => this.selEnts.add(n.id));
            this.model.rels.forEach(r => this.selRels.add(r.id));
            this.refreshSelClasses();
            this.showPill();
        }

        refreshSelClasses() {
            if (!this.model) return;
            for (const el of this.entLayer.children) {
                const n = this.entById(el.dataset.id);
                if (!n) continue;
                const sel = this.selEnts.has(el.dataset.id);
                el.classList.toggle('sel', sel);
                this.paintSelection(el, n, sel, this.hoverEntId === el.dataset.id);
            }
            for (const el of this.relLayer.children) {
                const rel = this.relById(el.dataset.id);
                if (!rel) continue;
                const sel = this.selRels.has(el.dataset.id);
                el.classList.toggle('sel', sel);
                this.paintRelSelection(el, rel, sel, this.hoverRelId === el.dataset.id);
            }
            for (const el of this.contLayer.children) {
                const c = this.contById(el.dataset.id);
                if (!c) continue;
                const sel = this.selCont === el.dataset.id;
                el.classList.toggle('sel', sel);
                const box = el.querySelector('.cbox');
                const tab = el.querySelector('.ctab');
                if (box) { box.setAttribute('stroke', sel ? T.contSelStroke : T.contStroke); box.setAttribute('fill', sel ? 'rgba(34,211,238,.06)' : T.contFill); }
                if (tab) tab.setAttribute('fill', sel ? T.contTabSel : T.contTab);
            }
            this.showPill();
        }

        paintSelection(g, n, sel, hovered) {
            const main = g.querySelector('.main');
            if (main) {
                main.setAttribute('stroke', sel ? T.selStroke : T.entStroke);
                main.style.filter = sel ? T.glow : '';
            }
            for (const hd of g.children) {
                if (!hd.classList || !hd.classList.contains('handle')) continue;
                hd.style.opacity = (sel || hovered) ? '1' : '0';
            }
        }

        paintRelSelection(g, rel, sel, hovered) {
            const line = g.querySelector('.line');
            if (line) {
                line.setAttribute('stroke', sel ? T.selStroke : (hovered ? T.lineHover : T.line));
                const mk = this.resolveMarkers(rel, sel);
                if (mk.start) line.setAttribute('marker-start', mk.start); else line.removeAttribute('marker-start');
                if (mk.end) line.setAttribute('marker-end', mk.end); else line.removeAttribute('marker-end');
            }
            const chipRect = g.querySelector('.elabel rect');
            if (chipRect) chipRect.setAttribute('stroke', sel ? T.selStroke : T.chipStroke);
        }

        clearHover() {
            if (this.hoverEntId) {
                const g = this.entLayer.querySelector(`[data-id="${this.hoverEntId}"]`);
                const n = this.entById(this.hoverEntId);
                if (g && n) this.paintSelection(g, n, this.selEnts.has(this.hoverEntId), false);
            }
            if (this.hoverRelId) {
                const g = this.relLayer.querySelector(`[data-id="${this.hoverRelId}"]`);
                const rel = this.relById(this.hoverRelId);
                if (g && rel) this.paintRelSelection(g, rel, this.selRels.has(this.hoverRelId), false);
            }
            this.hoverEntId = null;
            this.hoverRelId = null;
        }

        updateHover(target) {
            if (this.drag || !this.active) return;
            const eg = target && target.closest ? target.closest('.ent') : null;
            const rg = target && target.closest ? target.closest('.rel') : null;
            const hid = eg ? eg.dataset.id : null;
            const rid = rg ? rg.dataset.id : null;
            if (hid !== this.hoverEntId) {
                const oldG = this.hoverEntId && this.entLayer.querySelector(`[data-id="${this.hoverEntId}"]`);
                const oldN = this.hoverEntId && this.entById(this.hoverEntId);
                if (oldG && oldN) this.paintSelection(oldG, oldN, this.selEnts.has(this.hoverEntId), false);
                this.hoverEntId = hid;
                const n = hid && this.entById(hid);
                if (eg && n) this.paintSelection(eg, n, this.selEnts.has(hid), true);
            }
            if (rid !== this.hoverRelId) {
                const oldG = this.hoverRelId && this.relLayer.querySelector(`[data-id="${this.hoverRelId}"]`);
                const oldR = this.hoverRelId && this.relById(this.hoverRelId);
                if (oldG && oldR) this.paintRelSelection(oldG, oldR, this.selRels.has(this.hoverRelId), false);
                this.hoverRelId = rid;
                const rel = rid && this.relById(rid);
                if (rg && rel) this.paintRelSelection(rg, rel, this.selRels.has(rid), true);
            }
        }

        // --------------------------------------------------------------
        // deletion / grouping / duplication
        // --------------------------------------------------------------
        deleteSel() {
            if (!this.model) return;
            if (!this.selEnts.size && !this.selRels.size && !this.selCont) return;
            const snap = this.takeSnap();
            if (this.selRels.size) {
                this.model.rels = this.model.rels.filter(r => !this.selRels.has(r.id));
            }
            if (this.selEnts.size) {
                this.model.entities = this.model.entities.filter(n => !this.selEnts.has(n.id));
                this.model.rels = this.model.rels.filter(r => !this.selEnts.has(r.from) && !this.selEnts.has(r.to));
            }
            if (this.selCont) this.model.containers = this.model.containers.filter(c => c.id !== this.selCont);
            // prune container membership for deleted entities (empty containers drop in normalize)
            this.model.containers.forEach(c => { c.members = c.members.filter(id => !this.selEnts.has(id)); });
            this.clearSelection();
            this.pushUndo(snap);
            this.changed({ keepView: true });
        }

        groupSel() {
            if (!this.model) return;
            const kind = MSEC.CONTAINER_KINDS[this.dialect];
            if (!kind) { this.toast('containers are not supported in ER diagrams', 'err'); return; }
            if (!this.selEnts.size) { this.toast('select some entities first'); return; }
            const snap = this.takeSnap();
            let cont = this.model.containers.find(c => c.members.some(id => this.selEnts.has(id)));
            if (cont) {
                for (const id of this.selEnts) if (!cont.members.includes(id)) cont.members.push(id);
            } else {
                const count = this.model.containers.filter(c => c.kind === kind).length;
                const base = kind === 'namespace' ? 'Namespace' : 'Composite';
                const taken = this.allIds();
                const id = MSEC.nextId(taken, kind === 'namespace' ? 'NS' : 'CO');
                let n2 = count;
                let title = base + (n2 + 1);
                while (this.model.containers.some(c => c.title === title)) { n2++; title = base + (n2 + 1); }
                cont = { id, title, kind, members: [...this.selEnts] };
                this.model.containers.push(cont);
            }
            this.selCont = cont.id;
            this.pushUndo(snap);
            this.changed({ keepView: true });
            this.toast('grouped as ' + cont.title);
        }

        ungroupSel() {
            if (!this.model) return;
            const hits = this.model.containers.filter(c =>
                (this.selCont === c.id) || c.members.some(id => this.selEnts.has(id)));
            if (!hits.length) { this.toast('no container under selection'); return; }
            const snap = this.takeSnap();
            this.model.containers = this.model.containers.filter(c => !hits.includes(c));
            if (this.selCont && hits.some(c => c.id === this.selCont)) this.selCont = null;
            this.pushUndo(snap);
            this.changed({ keepView: true });
        }

        duplicateSel() {
            if (!this.model || !this.selEnts.size) return;
            const snap = this.takeSnap();
            const map = new Map();
            const clones = [];
            for (const id of this.selEnts) {
                const src = this.entById(id);
                if (!src) continue;
                const n = JSON.parse(JSON.stringify(src));
                n.id = MSEC.nextId(this.allIds(), MSEC.sanitizeId(src.name) ||
                    (this.dialect === 'er' ? 'E' : 'e'));
                map.set(id, n.id);
                n.x += GRID * 2; n.y += GRID * 2;
                this.model.entities.push(n);
                clones.push(n.id);
            }
            for (const r of this.model.rels.slice()) {
                if (map.has(r.from) && map.has(r.to)) {
                    this.model.rels.push({
                        id: MSEC.nextId(this.allIds(), 'r'),
                        from: map.get(r.from), to: map.get(r.to),
                        kind: r.kind, cardA: r.cardA, cardB: r.cardB, label: r.label,
                    });
                }
            }
            this.clearSelection();
            clones.forEach(id => this.selEnts.add(id));
            this.pushUndo(snap);
            this.changed({ keepView: true });
            this.refreshSelClasses();
            this.showPill();
        }

        resolveDefaultRel() {
            const dr = this.cfg.defaultRel;
            let kind = null, cardA = null, cardB = null;
            if (typeof dr === 'string') kind = dr;
            else if (dr && typeof dr === 'object') { kind = dr.kind; cardA = dr.cardA; cardB = dr.cardB; }
            const kinds = MSEC.REL_KINDS[this.dialect] || MSEC.REL_KINDS['class'];
            const defKind = MSEC.DEFAULT_REL[this.dialect] || 'assoc';
            if (!kinds.includes(kind)) kind = defKind;
            if (this.dialect === 'er') {
                if (!MSEC.ER_CODES.includes(cardA)) cardA = '||';
                if (!MSEC.ER_CODES.includes(cardB)) cardB = '}o';
            } else {
                cardA = ''; cardB = '';
            }
            return { kind, cardA, cardB };
        }

        addRelation(from, to, pendSnap) {
            const spec = this.resolveDefaultRel();
            const snap = pendSnap != null ? pendSnap : this.takeSnap();
            this.model.rels.push({
                id: MSEC.nextId(this.allIds(), 'r'),
                from, to, kind: spec.kind, cardA: spec.cardA, cardB: spec.cardB, label: '',
            });
            this.pushUndo(snap);
            this.changed({ keepView: true });
        }

        addTile(key, worldPtOrNull) {
            if (!this.model) return;
            const snap = this.takeSnap();
            const rawKey = String(key || '').toLowerCase();
            const shape = Object.prototype.hasOwnProperty.call(SPECIAL_SIZE, rawKey) || rawKey === 'note'
                ? rawKey : 'box';
            const baseNames = { 'class': 'Class', er: 'ENTITY', state: 'State' };
            const n = {
                id: '',
                name: shape === 'note' ? 'Note' : (baseNames[this.dialect] || 'Entity'),
                alias: null,
                shape,
                stereo: null,
                members: shape === 'note' ? ['note text'] : [],
                anchor: shape === 'note' ? '' : null,
                noteSide: null,
                x: 0, y: 0, w: 0, h: 0,
            };
            this.sizeEntity(n);
            const c = worldPtOrNull || this.centerWorld();
            n.x = this.snapOn ? Math.round((c.x + (Math.random() * 60 - 30)) / GRID) * GRID : c.x;
            n.y = this.snapOn ? Math.round((c.y + (Math.random() * 60 - 30)) / GRID) * GRID : c.y;
            n.id = MSEC.nextId(this.allIds(), MSEC.sanitizeId(n.name) || (this.dialect === 'er' ? 'E' : 'e'));
            this.model.entities.push(n);
            this.clearSelection();
            this.selEnts.add(n.id);
            this.pushUndo(snap);
            this.changed({ keepView: true });
            this.refreshSelClasses();
            this.showPill();
        }

        // --------------------------------------------------------------
        // geometry: relations
        // --------------------------------------------------------------
        edgeGeom(rel) {
            const a = this.entById(rel.from), b = this.entById(rel.to);
            if (!a || !b || !isNum(a.x) || !isNum(b.x)) return null;
            const p1t = { x: 0, y: 0 }, p2t = { x: 0, y: 0 }, c1 = { x: 0, y: 0 }, c2 = { x: 0, y: 0 };
            if (a.id === b.id) {
                // self-loop like flowchart
                const sx = a.x + a.w * 0.25, sy = a.y - a.h / 2;
                const ex = a.x + a.w / 2, ey = a.y - a.h * 0.25;
                p1t.x = sx; p1t.y = sy; p2t.x = ex; p2t.y = ey;
                c1.x = sx + 105; c1.y = sy - 105; c2.x = ex + 105; c2.y = ey - 105;
            } else {
                const s1 = MSEC.sideTowards(a, b.x, b.y);
                const s2 = MSEC.sideTowards(b, a.x, a.y);
                const q1 = MSEC.anchorOf(a, s1), q2 = MSEC.anchorOf(b, s2);
                // parallel offset when multiple edges share the unordered pair
                const par = this.model.rels.filter(o =>
                    (o.from === rel.from && o.to === rel.to) || (o.from === rel.to && o.to === rel.from));
                const pi = par.indexOf(rel);
                const off = pi <= 0 ? 0 : (pi % 2 ? 1 : -1) * Math.ceil(pi / 2) * 24;
                const dirV = v => v === 'l' ? [-1, 0] : v === 'r' ? [1, 0] : v === 't' ? [0, -1] : [0, 1];
                const dv1 = dirV(s1), dv2 = dirV(s2);
                const dist = Math.max(Math.hypot(q2.x - q1.x, q2.y - q1.y), 1);
                const k = Math.min(Math.max(dist * 0.34, 26), 140);
                let nx = 0, ny = 0;
                if (off) {
                    const lx = (q2.x - q1.x) / dist, ly = (q2.y - q1.y) / dist;
                    nx = -ly * off; ny = lx * off;
                }
                p1t.x = q1.x; p1t.y = q1.y; p2t.x = q2.x; p2t.y = q2.y;
                c1.x = q1.x + dv1[0] * k + nx; c1.y = q1.y + dv1[1] * k + ny;
                c2.x = q2.x + dv2[0] * k + nx; c2.y = q2.y + dv2[1] * k + ny;
            }
            const bez = t => {
                const u = 1 - t;
                return {
                    x: u * u * u * p1t.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2t.x,
                    y: u * u * u * p1t.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2t.y,
                };
            };
            const tan = t => {
                const u = 1 - t;
                return {
                    x: 3 * u * u * (c1.x - p1t.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p2t.x - c2.x),
                    y: 3 * u * u * (c1.y - p1t.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p2t.y - c2.y),
                };
            };
            const mid = bez(0.5);
            // cardinality anchor points near each end, offset along the edge normal (~14px)
            const cardPt = t => {
                const p = bez(t), d = tan(t);
                const len = Math.max(Math.hypot(d.x, d.y), 0.001);
                let nxv = -d.y / len, nyv = d.x / len;
                if (nyv > 0) { nxv = -nxv; nyv = -nyv; }   // keep texts on the upper side of travel
                return { x: p.x + nxv * 14, y: p.y + nyv * 14 };
            };
            const d = `M${p1t.x},${p1t.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2t.x},${p2t.y}`;
            return { d, mx: mid.x, my: mid.y, cardA: cardPt(0.15), cardB: cardPt(0.85) };
        }

        builtinMarkers(rel) {
            const v = this.selRels.has(rel.id) ? '-s' : '-n';
            if (this.dialect === 'er') {
                const cm = code => (ER_CARD_MARKER[code] ? ER_CARD_MARKER[code] + v : '');
                return { start: cm(rel.cardA), end: cm(rel.cardB) };
            }
            if (this.dialect === 'state') return { start: '', end: 'msc-ah' + v };
            const pair = BUILTIN_CLASS_MARKERS[rel.kind] || ['', ''];
            return { start: pair[0] ? pair[0] + v : '', end: pair[1] ? pair[1] + v : '' };
        }

        resolveMarkers(rel, selected) {
            let spec = null;
            if (typeof this.cfg.markers === 'function') {
                try { spec = this.cfg.markers(rel.kind, selected); } catch (e) { spec = null; }
            }
            if (!spec || typeof spec !== 'object') spec = this.builtinMarkers(rel);
            const wrapUrl = v => {
                if (!v) return null;
                v = String(v);
                return v.indexOf('url(#') === 0 ? v : `url(#${v})`;
            };
            return { start: wrapUrl(spec.start), end: wrapUrl(spec.end) };
        }

        paintRelDecor(g, rel, geo) {
            const oldCards = g.querySelector('.cards');
            if (oldCards) oldCards.remove();
            const oldChip = g.querySelector('.elabel');
            if (oldChip) oldChip.remove();
            const hasCards = !!(rel.cardA || rel.cardB);
            if (hasCards) {
                const cg = svgEl('g', { class: 'cards' });
                const mk = (txt, pt) => {
                    const t = svgEl('text', {
                        x: pt.x, y: pt.y, 'text-anchor': 'middle',
                        fill: T.cardText, 'font-size': 11, 'font-style': 'italic',
                        'font-family': SANS, 'paint-order': 'stroke',
                        stroke: 'rgba(7,11,20,.85)', 'stroke-width': 3,
                        'user-select': 'none',
                    });
                    t.textContent = txt;
                    return t;
                };
                if (rel.cardA) cg.appendChild(mk(rel.cardA, geo.cardA));
                if (rel.cardB) cg.appendChild(mk(rel.cardB, geo.cardB));
                g.appendChild(cg);
            }
            if (rel.label) {
                const lw = tw(LABEL_FONT, rel.label, 6.6) + 12;
                const lab = svgEl('g', { class: 'elabel', transform: `translate(${geo.mx},${geo.my})` });
                lab.appendChild(svgEl('rect', {
                    x: -lw / 2, y: -9, width: lw, height: 18, rx: 5,
                    fill: T.chipFill, stroke: this.selRels.has(rel.id) ? T.selStroke : T.chipStroke,
                }));
                const txt = svgEl('text', {
                    'text-anchor': 'middle', dy: '4', fill: T.chipText,
                    'font-size': 11.5, 'font-weight': 500, 'font-family': SANS, 'user-select': 'none',
                });
                txt.textContent = rel.label;
                lab.appendChild(txt);
                g.appendChild(lab);
            }
        }

        redrawRel(rel) {
            const g = this.relLayer.querySelector(`[data-id="${rel.id}"]`);
            if (!g) return;
            const geo = this.edgeGeom(rel);
            if (!geo) return;
            g.querySelector('.hit').setAttribute('d', geo.d);
            g.querySelector('.line').setAttribute('d', geo.d);
            this.paintRelDecor(g, rel, geo);
        }

        // --------------------------------------------------------------
        // rendering
        // --------------------------------------------------------------
        renderAll() {
            if (!this.model) return;
            this.renderConts();
            this.renderRels();
            this.renderEnts();
            this.positionPill();
        }

        renderEnts() {
            this.entLayer.innerHTML = '';
            for (const n of this.model.entities) {
                if (!isNum(n.x) || !isNum(n.y)) continue;
                const sel = this.selEnts.has(n.id);
                const g = svgEl('g', {
                    class: 'ent' + (sel ? ' sel' : ''),
                    'data-id': n.id,
                    transform: `translate(${n.x},${n.y})`,
                });
                g.style.cursor = 'move';
                this.paintEntBody(g, n, sel);
                // rim handles with data-side (link-drag sources)
                const hw = n.w / 2, hh = n.h / 2;
                [['t', 0, -hh], ['r', hw, 0], ['b', 0, hh], ['l', -hw, 0]].forEach(spec => {
                    const hd = svgEl('circle', {
                        class: 'handle', 'data-side': spec[0],
                        cx: spec[1], cy: spec[2], r: 5.5,
                        fill: T.handleFill, stroke: T.selStroke, 'stroke-width': 2,
                    });
                    hd.style.opacity = sel ? '1' : '0';
                    hd.style.cursor = 'crosshair';
                    hd.style.transition = 'opacity .12s';
                    g.appendChild(hd);
                });
                this.entLayer.appendChild(g);
            }
        }

        paintEntBody(g, n, sel) {
            const hw = n.w / 2, hh = n.h / 2;
            const strokeCol = sel ? T.selStroke : T.entStroke;
            const shape = n.shape || 'box';

            // generous invisible hit area for thin/small shapes (bars, dots)
            if (shape !== 'box') {
                g.appendChild(svgEl('rect', {
                    x: -(hw + 8), y: -(hh + 8), width: n.w + 16, height: n.h + 16,
                    fill: '#000000', 'fill-opacity': 0, stroke: 'none',
                }));
            }

            if (shape === 'start' || shape === 'stop') {
                let ring;
                if (shape === 'start') {
                    ring = svgEl('circle', { cx: 0, cy: 0, r: 12.5, fill: 'none', stroke: strokeCol, 'stroke-width': 1.5 });
                    g.appendChild(ring);
                    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 8.5, fill: T.dotFill, stroke: strokeCol, 'stroke-width': 1 }));
                } else {
                    ring = svgEl('circle', { cx: 0, cy: 0, r: 12, fill: 'none', stroke: strokeCol, 'stroke-width': 1.6 });
                    g.appendChild(ring);
                    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 7, fill: 'none', stroke: strokeCol, 'stroke-width': 1.6 }));
                }
                ring.classList.add('main');
            } else if (shape === 'choice') {
                const pts = [[-hw, 0], [0, -hh], [hw, 0], [0, hh]].map(p => p.join(',')).join(' ');
                const poly = svgEl('polygon', { points: pts, fill: T.entFill, stroke: strokeCol, 'stroke-width': 1.6 });
                poly.classList.add('main');
                if (sel) poly.style.filter = T.glow;
                g.appendChild(poly);
            } else if (shape === 'fork' || shape === 'join') {
                const bar = svgEl('rect', {
                    x: -hw, y: -3, width: n.w, height: 6, rx: 1.5,
                    fill: T.barFill, stroke: sel ? T.selStroke : T.barFill, 'stroke-width': sel ? 1.6 : 0,
                });
                bar.classList.add('main');
                if (sel) bar.style.filter = T.glow;
                g.appendChild(bar);
            } else if (shape === 'note') {
                const f = 13;
                const main = svgEl('path', {
                    d: `M${-hw},${-hh} H${hw - f} L${hw},${-hh + f} V${hh} H${-hw} Z`,
                    fill: T.noteFill, stroke: strokeCol, 'stroke-width': 1.5, 'stroke-linejoin': 'round',
                });
                main.classList.add('main');
                if (sel) main.style.filter = T.glow;
                g.appendChild(main);
                g.appendChild(svgEl('path', {
                    d: `M${hw - f},${-hh} V${-hh + f} H${hw}`,
                    fill: 'none', stroke: strokeCol, 'stroke-width': 1.2, opacity: 0.8,
                }));
                const lines = n._lines && n._lines.length ? n._lines : [''];
                const startY = -((lines.length - 1) * LH) / 2 + LH * 0.32;
                const txt = svgEl('text', {
                    'text-anchor': 'start', x: -hw + 10, fill: T.memFill,
                    'font-size': 11.5, 'font-family': MONO, 'font-style': 'italic', 'user-select': 'none',
                });
                lines.forEach((ln, i) => {
                    const ts = svgEl('tspan', { x: -hw + 10, y: startY + i * LH });
                    ts.textContent = ln;
                    txt.appendChild(ts);
                });
                g.appendChild(txt);
                this.paintTitleName(g, n, strokeCol);
                return;
            } else {
                // box: title band + separator + member rows
                const bandH = n._bandH != null ? n._bandH : 29;
                const main = svgEl('rect', {
                    x: -hw, y: -hh, width: n.w, height: n.h, rx: 8,
                    fill: T.entFill, stroke: strokeCol, 'stroke-width': 1.6,
                });
                main.classList.add('main');
                if (sel) main.style.filter = T.glow;
                g.appendChild(main);
                g.appendChild(svgEl('line', {
                    x1: -hw + 1, x2: hw - 1, y1: -hh + bandH, y2: -hh + bandH,
                    stroke: T.sepStroke, 'stroke-width': 1,
                }));
                const titleLines = n._titleLines && n._titleLines.length ? n._titleLines : [n.name || ''];
                const title = svgEl('text', {
                    'text-anchor': 'middle', fill: T.titleFill,
                    'font-size': 13, 'font-weight': 600, 'font-family': SANS, 'user-select': 'none',
                });
                const startY = -hh + 7 + LH * 0.74;
                titleLines.forEach((ln, i) => {
                    const ts = svgEl('tspan', { x: 0, y: startY + i * LH });
                    ts.textContent = ln;
                    title.appendChild(ts);
                });
                g.appendChild(title);
                const members = n.members || [];
                if (members.length) {
                    const rows = svgEl('text', {
                        'text-anchor': 'start', fill: T.memFill,
                        'font-size': 11.5, 'font-family': MONO, 'user-select': 'none',
                    });
                    members.forEach((memRow, i) => {
                        const ts = svgEl('tspan', { x: -hw + 10, y: -hh + bandH + LH * 0.78 + i * LH });
                        ts.textContent = memRow;
                        rows.appendChild(ts);
                    });
                    g.appendChild(rows);
                }
                return;
            }
            this.paintTitleName(g, n, strokeCol);
        }

        paintTitleName(g, n, strokeColUnused) {
            const label = (n.name || '').trim();
            if (!label) return;
            const txt = svgEl('text', {
                'text-anchor': 'middle', x: 0, y: -(n.h / 2 + 9),
                fill: T.titleFill, 'font-size': 12.5, 'font-weight': 600,
                'font-family': SANS, 'user-select': 'none',
            });
            txt.textContent = label;
            g.appendChild(txt);
        }

        renderRels() {
            this.relLayer.innerHTML = '';
            for (const rel of this.model.rels) {
                const geo = this.edgeGeom(rel);
                if (!geo) continue;
                const sel = this.selRels.has(rel.id);
                const g = svgEl('g', { class: 'rel rk-' + rel.kind + (sel ? ' sel' : ''), 'data-id': rel.id });
                g.appendChild(svgEl('path', {
                    class: 'hit', d: geo.d, stroke: 'transparent', 'stroke-width': 16,
                    fill: 'none', 'pointer-events': 'stroke',
                }));
                const lineAttrs = {
                    class: 'line', d: geo.d,
                    stroke: sel ? T.selStroke : T.line, 'stroke-width': 1.7,
                    fill: 'none', 'pointer-events': 'none',
                };
                if (DASH_KINDS[rel.kind]) lineAttrs['stroke-dasharray'] = '5 5';
                const mk = this.resolveMarkers(rel, sel);
                if (mk.start) lineAttrs['marker-start'] = mk.start;
                if (mk.end) lineAttrs['marker-end'] = mk.end;
                g.appendChild(svgEl('path', lineAttrs));
                this.paintRelDecor(g, rel, geo);
                this.relLayer.appendChild(g);
            }
        }

        contBounds(c) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const id of c.members) {
                const n = this.entById(id);
                if (!n || !isNum(n.x)) continue;
                minX = Math.min(minX, n.x - n.w / 2);
                minY = Math.min(minY, n.y - n.h / 2);
                maxX = Math.max(maxX, n.x + n.w / 2);
                maxY = Math.max(maxY, n.y + n.h / 2);
            }
            if (minX === Infinity) return { x: 0, y: 0, w: 10, h: 10 };
            return { x: minX - 26, y: minY - 48, w: maxX - minX + 52, h: maxY - minY + 76 };
        }

        renderConts() {
            this.contLayer.innerHTML = '';
            for (const c of this.model.containers) {
                const b = this.contBounds(c);
                const sel = this.selCont === c.id;
                const g = svgEl('g', { class: 'cont' + (sel ? ' sel' : ''), 'data-id': c.id });
                g.style.cursor = 'move';
                g.appendChild(svgEl('rect', {
                    class: 'cbox', x: b.x, y: b.y, width: b.w, height: b.h, rx: 12,
                    fill: sel ? 'rgba(34,211,238,.06)' : T.contFill,
                    stroke: sel ? T.contSelStroke : T.contStroke, 'stroke-width': 1.4,
                }));
                const tabW = tw(CONT_FONT, c.title || c.id, 7) + 18;
                g.appendChild(svgEl('rect', {
                    class: 'ctab', x: b.x + 10, y: b.y + 9, width: tabW, height: 20, rx: 6,
                    fill: sel ? T.contTabSel : T.contTab,
                }));
                const tt = svgEl('text', {
                    class: 'ctab-text', x: b.x + 19, y: b.y + 23,
                    fill: T.contText, 'font-size': 11.5, 'font-weight': 600,
                    'letter-spacing': '0.04em', 'font-family': SANS, 'user-select': 'none',
                });
                tt.textContent = c.title || c.id;
                g.appendChild(tt);
                this.contLayer.appendChild(g);
            }
        }

        fastUpdatePositions(ids) {
            for (const el of this.entLayer.children) {
                if (!ids.has(el.dataset.id)) continue;
                const n = this.entById(el.dataset.id);
                if (n) el.setAttribute('transform', `translate(${n.x},${n.y})`);
            }
            for (const rel of this.model.rels) {
                if (!ids.has(rel.from) && !ids.has(rel.to)) continue;
                this.redrawRel(rel);
            }
            for (const el of this.contLayer.children) {
                const c = this.contById(el.dataset.id);
                if (!c || !c.members.some(id => ids.has(id))) continue;
                const b = this.contBounds(c);
                const box = el.querySelector('.cbox');
                const tab = el.querySelector('.ctab');
                const label = el.querySelector('.ctab-text');
                if (box) { box.setAttribute('x', b.x); box.setAttribute('y', b.y); box.setAttribute('width', b.w); box.setAttribute('height', b.h); }
                if (tab) { tab.setAttribute('x', b.x + 10); tab.setAttribute('y', b.y + 9); }
                if (label) { label.setAttribute('x', b.x + 19); label.setAttribute('y', b.y + 23); }
            }
            this.positionPill();
        }

        // --------------------------------------------------------------
        // pill toolbar
        // --------------------------------------------------------------
        showPill() {
            if (!this.selEnts.size || !this.active) { this.hidePill(); return; }
            this.pill.style.display = 'flex';
            if (this.selEnts.size === 1) {
                const n = this.entById([...this.selEnts][0]);
                this.pillName.textContent = n ? (n.name || n.id).slice(0, 22) : '';
            } else {
                this.pillName.textContent = this.selEnts.size + ' entities';
            }
            this.positionPill();
        }
        hidePill() { this.pill.style.display = 'none'; }

        positionPill() {
            if (this.pill.style.display === 'none' || !this.selEnts.size || !this.model) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity;
            for (const id of this.selEnts) {
                const n = this.entById(id);
                if (!n || !isNum(n.x)) continue;
                minX = Math.min(minX, n.x - n.w / 2); maxX = Math.max(maxX, n.x + n.w / 2);
                minY = Math.min(minY, n.y - n.h / 2);
            }
            if (minX === Infinity) { this.hidePill(); return; }
            const tl = this.worldToScreen((minX + maxX) / 2, minY);
            const pw = this.pill.offsetWidth || 200;
            let x = tl.x - pw / 2;
            x = Math.max(8, Math.min(x, this.svg.clientWidth - pw - 8));
            const y = Math.max(8, tl.y - 44);
            this.pill.style.left = x + 'px';
            this.pill.style.top = y + 'px';
        }

        // --------------------------------------------------------------
        // overlay editors
        // --------------------------------------------------------------
        openEditorAt(screenX, screenY, width, value, onCommit) {
            this.edMode = { onCommit };
            this.editor.style.display = 'block';
            this.editor.value = value;
            this.editor.style.left = Math.round(screenX - width / 2) + 'px';
            this.editor.style.top = Math.round(screenY) + 'px';
            this.autosizeEditor(width);
            this.editor.focus();
            this.editor.select();
        }

        autosizeEditor(maxW) {
            const cap = maxW || 380;
            this.editor.style.width = 'auto';
            this.editor.style.height = 'auto';
            const w = Math.max(120, Math.min(this.editor.scrollWidth + 18, cap));
            this.editor.style.width = w + 'px';
            this.editor.style.height = Math.min(this.editor.scrollHeight + 4, 220) + 'px';
        }

        closeEditor(cancel) {
            if (this.editor.style.display !== 'block') return false;
            const val = this.editor.value;
            const mode = this.edMode;
            this.editor.style.display = 'none';
            this.edMode = null;
            if (!cancel && mode && mode.onCommit) mode.onCommit(val);
            return true;
        }

        openEntityEditor(id) {
            const n = this.entById(id);
            if (!n) return;
            const shape = n.shape || 'box';
            let value;
            if (shape === 'note') value = (n.members && n.members[0]) || '';
            else if (SPECIAL_SIZE[shape]) value = n.name || '';
            else value = [n.name || ''].concat(n.members || []).join('\n');
            const p = this.worldToScreen(n.x, n.y - n.h / 2 - 8);
            this.openEditorAt(p.x, p.y, Math.max(160, Math.min(n.w * this.view.k + 40, 380)), value, v => {
                const snap = this.takeSnap();
                this.applyEntityText(n, v, shape);
                this.pushUndo(snap);
                this.changed({ keepView: true });
            });
        }

        applyEntityText(n, rawValue, shape) {
            const val = String(rawValue == null ? '' : rawValue).replace(/\r\n?/g, '\n');
            if (shape === 'note') {
                n.members = [val.trim()];
            } else if (SPECIAL_SIZE[shape]) {
                const first = val.split('\n')[0].trim();
                if (first) n.name = first;
            } else {
                const lines = val.split('\n');
                const name = lines[0].trim();
                if (name) n.name = name;
                n.members = lines.slice(1).map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '');
            }
            this.sizeEntity(n);
        }

        openContainerEditor(cid) {
            const c = this.contById(cid);
            if (!c) return;
            const b = this.contBounds(c);
            const p = this.worldToScreen(b.x + 12, b.y + 4);
            this.openEditorAt(p.x, p.y, 140, c.title, v => {
                const snap = this.takeSnap();
                c.title = String(v || '').trim().split('\n')[0] || c.title;
                this.pushUndo(snap);
                this.changed({ keepView: true });
            });
        }

        // --------------------------------------------------------------
        // relation form overlay (plain DOM)
        // --------------------------------------------------------------
        buildForm() {
            const f = document.createElement('div');
            f.className = 'entity-rel-form';
            const st = f.style;
            st.position = 'absolute'; st.zIndex = '50'; st.display = 'none';
            st.background = '#101c33'; st.border = '1px solid #22d3ee'; st.borderRadius = '10px';
            st.padding = '10px 12px'; st.boxShadow = '0 8px 28px rgba(0,0,0,.55)';
            st.fontFamily = SANS; st.fontSize = '12px'; st.color = '#e2e8f0'; st.minWidth = '216px';
            st.lineHeight = '1.5';

            const row = (labelText, control) => {
                const wrapDiv = document.createElement('div');
                wrapDiv.style.marginBottom = '6px';
                const lb = document.createElement('div');
                lb.textContent = labelText;
                lb.style.cssText = 'font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:2px;';
                control.style.width = '100%';
                control.style.cssText += ';background:#0b1220;border:1px solid #223047;color:#e2e8f0;border-radius:6px;padding:4px 7px;font-size:12px;outline:none;box-sizing:border-box;';
                wrapDiv.appendChild(lb);
                wrapDiv.appendChild(control);
                f.appendChild(wrapDiv);
                return wrapDiv;
            };

            this.fKind = document.createElement('select');
            this.fLabel = document.createElement('input');
            this.fLabel.type = 'text'; this.fLabel.placeholder = 'label';
            this.fCardA = document.createElement('input');
            this.fCardA.type = 'text'; this.fCardA.placeholder = '|o || }o }|';
            this.fCardB = document.createElement('input');
            this.fCardB.type = 'text'; this.fCardB.placeholder = '|o || }o }|';
            row('kind', this.fKind);
            this.fLabelRow = row('label', this.fLabel);
            this.fCardARow = row('card A (from)', this.fCardA);
            this.fCardBRow = row('card B (to)', this.fCardB);

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;margin-top:4px;';
            const apply = document.createElement('button');
            apply.textContent = 'Apply';
            apply.className = 'primary';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(apply);
            f.appendChild(btnRow);

            this._formKey = e => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.hideForm(); }
                if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
                    e.preventDefault(); this.applyForm();
                }
                e.stopPropagation();
            };
            f.addEventListener('keydown', this._formKey);
            this._applyHandler = () => this.applyForm();
            this._cancelHandler = () => this.hideForm();
            apply.addEventListener('click', this._applyHandler);
            cancelBtn.addEventListener('click', this._cancelHandler);
            return f;
        }

        openRelForm(relId) {
            const rel = this.relById(relId);
            if (!rel || !this.model) return;
            const kinds = MSEC.REL_KINDS[this.dialect] || [];
            this.fKind.innerHTML = '';
            kinds.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = k + (KIND_LABELS[k] ? ' — ' + KIND_LABELS[k] : '');
                this.fKind.appendChild(opt);
            });
            this.fKind.value = rel.kind;
            if (this.fKind.value !== rel.kind && kinds.length) this.fKind.value = kinds[0];
            this.fLabel.value = rel.label || '';
            const showCards = this.dialect === 'er' || this.dialect === 'class';
            this.fCardARow.style.display = showCards ? '' : 'none';
            this.fCardBRow.style.display = showCards ? '' : 'none';
            this.fCardA.value = rel.cardA || '';
            this.fCardB.value = rel.cardB || '';
            this.formRelId = relId;
            const geo = this.edgeGeom(rel);
            const p = geo ? this.worldToScreen(geo.mx, geo.my) : { x: this.svg.clientWidth / 2, y: this.svg.clientHeight / 3 };
            this.form.style.display = 'block';
            const fw = this.form.offsetWidth || 230, fh = this.form.offsetHeight || 190;
            this.form.style.left = Math.max(8, Math.min(p.x - fw / 2, this.svg.clientWidth - fw - 8)) + 'px';
            this.form.style.top = Math.max(8, Math.min(p.y - fh / 2, this.svg.clientHeight - fh - 8)) + 'px';
            try { this.fLabel.focus(); } catch (e) { /* noop */ }
        }

        hideForm() {
            this.form.style.display = 'none';
            this.formRelId = null;
        }

        applyForm() {
            const rel = this.formRelId && this.relById(this.formRelId);
            if (!rel) { this.hideForm(); return; }
            let cardA = this.fCardA.value.trim();
            let cardB = this.fCardB.value.trim();
            if (this.dialect === 'er') {
                if (cardA && !MSEC.ER_CODES.includes(cardA)) { this.toast('card must be blank or |o || }o }|', 'err'); return; }
                if (cardB && !MSEC.ER_CODES.includes(cardB)) { this.toast('card must be blank or |o || }o }|', 'err'); return; }
            } else if (this.dialect === 'state') {
                cardA = ''; cardB = '';
            } else {
                cardA = cardA.slice(0, 10);
                cardB = cardB.slice(0, 10);
            }
            const snap = this.takeSnap();
            const kinds = MSEC.REL_KINDS[this.dialect] || [];
            rel.kind = kinds.includes(this.fKind.value) ? this.fKind.value : rel.kind;
            rel.label = this.fLabel.value.trim();
            rel.cardA = cardA;
            rel.cardB = cardB;
            this.pushUndo(snap);
            this.hideForm();
            this.changed({ keepView: true });
        }

        // --------------------------------------------------------------
        // pointer interaction (mirrors flowchart Board patterns)
        // --------------------------------------------------------------
        capture(e) {
            try { if (this.svg.setPointerCapture) this.svg.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        }

        onPointerDown(e) {
            if (!this.active || !this.model) return;
            if (e.button === 2) return;
            this.hideForm();
            const sp = this.screenPt(e);
            const t = e.target;

            // rim handles -> link drag
            const handleEl = t.closest && t.closest('.handle');
            if (handleEl) {
                const eg = handleEl.closest && handleEl.closest('.ent');
                if (eg) {
                    const nid = eg.dataset.id;
                    const n = this.entById(nid);
                    if (n) {
                        this.drag = {
                            mode: 'link', from: nid, side: handleEl.dataset.side,
                            start: MSEC.anchorOf(n, handleEl.dataset.side), hover: null,
                        };
                        this.pendSnap = this.takeSnap();
                        const temp = svgEl('path', { stroke: T.selStroke, 'stroke-width': 1.8, 'stroke-dasharray': '6 5', fill: 'none', 'pointer-events': 'none' });
                        this.tempLayer.appendChild(temp);
                        this.drag.temp = temp;
                        this.capture(e);
                        return;
                    }
                }
            }

            // entities -> select + drag move
            const ng = t.closest && t.closest('.ent');
            if (ng) {
                const id = ng.dataset.id;
                if (e.shiftKey) {
                    if (this.selEnts.has(id)) this.selEnts.delete(id); else this.selEnts.add(id);
                } else if (!this.selEnts.has(id)) {
                    this.clearSelection();
                    this.selEnts.add(id);
                }
                this.refreshSelClasses();
                this.showPill();
                const wp = this.screenToWorld(sp.x, sp.y);
                const orig = new Map();
                for (const nid of this.selEnts) {
                    const n = this.entById(nid);
                    if (n) orig.set(nid, { x: n.x, y: n.y });
                }
                this.drag = { mode: 'nodes', startW: wp, orig, moved: false, sx: sp.x, sy: sp.y };
                this.pendSnap = this.takeSnap();
                this.capture(e);
                return;
            }

            // relations -> select
            const rg = t.closest && t.closest('.rel');
            if (rg) {
                const id = rg.dataset.id;
                if (e.shiftKey) {
                    if (this.selRels.has(id)) this.selRels.delete(id); else this.selRels.add(id);
                } else {
                    this.clearSelection();
                    this.selRels.add(id);
                }
                this.refreshSelClasses();
                this.hidePill();
                return;
            }

            // containers -> select + drag moves ALL member entities
            const cg = t.closest && t.closest('.cont');
            if (cg) {
                const sid = cg.dataset.id;
                this.selCont = sid;
                this.refreshSelClasses();
                const c = this.contById(sid);
                const orig = new Map();
                if (c) {
                    for (const mid of c.members) {
                        const n = this.entById(mid);
                        if (n) orig.set(mid, { x: n.x, y: n.y });
                    }
                }
                this.drag = { mode: 'cont', sid, startW: this.screenToWorld(sp.x, sp.y), orig, moved: false, sx: sp.x, sy: sp.y };
                this.pendSnap = this.takeSnap();
                this.capture(e);
                return;
            }

            // pan (space+drag or middle-drag)
            if (this.spaceDown || e.button === 1) {
                if (e.button === 1) e.preventDefault();
                this.drag = { mode: 'pan', sx: sp.x, sy: sp.y, vx: this.view.x, vy: this.view.y };
                this.capture(e);
                return;
            }

            if (e.shiftKey) {
                // rubber-band select
                this.drag = { mode: 'band', sx: sp.x, sy: sp.y };
                this.band.style.display = 'block';
                this.band.style.left = sp.x + 'px';
                this.band.style.top = sp.y + 'px';
                this.band.style.width = '0px';
                this.band.style.height = '0px';
                this.drag.baseSel = new Set(this.selEnts);
                this.capture(e);
            } else {
                this.clearSelection();
                this.refreshSelClasses();
                this.drag = { mode: 'pan', sx: sp.x, sy: sp.y, vx: this.view.x, vy: this.view.y };
                this.capture(e);
            }
        }

        onPointerMove(e) {
            const drag = this.drag;
            if (!drag || !this.active) { this.updateHover(e.target); return; }
            const sp = this.screenPt(e);

            if (drag.mode === 'pan') {
                this.view.x = drag.vx + (sp.x - drag.sx);
                this.view.y = drag.vy + (sp.y - drag.sy);
                this.applyViewTransform();
                return;
            }

            if (drag.mode === 'band') {
                const x = Math.min(drag.sx, sp.x), y = Math.min(drag.sy, sp.y);
                this.band.style.left = x + 'px';
                this.band.style.top = y + 'px';
                this.band.style.width = Math.abs(sp.x - drag.sx) + 'px';
                this.band.style.height = Math.abs(sp.y - drag.sy) + 'px';
                const a = this.screenToWorld(drag.sx, drag.sy), b = this.screenToWorld(sp.x, sp.y);
                const r = { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
                this.selEnts = new Set(drag.baseSel);
                for (const n of this.model.entities) {
                    if (!isNum(n.x)) continue;
                    if (n.x + n.w / 2 >= r.x1 && n.x - n.w / 2 <= r.x2 &&
                        n.y + n.h / 2 >= r.y1 && n.y - n.h / 2 <= r.y2) this.selEnts.add(n.id);
                }
                this.refreshSelClasses();
                return;
            }

            if (drag.mode === 'nodes' || drag.mode === 'cont') {
                const wp = this.screenToWorld(sp.x, sp.y);
                let dx = wp.x - drag.startW.x, dy = wp.y - drag.startW.y;
                if (!drag.moved && Math.abs(sp.x - drag.sx) + Math.abs(sp.y - drag.sy) < 3) return;
                if (!drag.moved) { this.pushUndo(this.pendSnap); drag.moved = true; }  // one undo per drag gesture
                if (this.snapOn && drag.orig.size === 1) {
                    const o = [...drag.orig.values()][0];
                    dx = Math.round((o.x + dx) / GRID) * GRID - o.x;
                    dy = Math.round((o.y + dy) / GRID) * GRID - o.y;
                } else {
                    dx = Math.round(dx); dy = Math.round(dy);
                }
                const touched = new Set();
                for (const [nid, o] of drag.orig) {
                    const n = this.entById(nid);
                    if (!n) continue;
                    n.x = o.x + dx; n.y = o.y + dy;
                    touched.add(nid);
                }
                this.fastUpdatePositions(touched);
                return;
            }

            if (drag.mode === 'link') {
                const wp = this.screenToWorld(sp.x, sp.y);
                // self-relations allowed: do NOT skip the source entity
                let best = null, bestD = Infinity;
                for (const n of this.model.entities) {
                    if (!isNum(n.x)) continue;
                    const d = (n.x - wp.x) ** 2 + (n.y - wp.y) ** 2;
                    const rad = Math.max(Math.hypot(n.w, n.h) / 2 + 34 / this.view.k, 52 / this.view.k);
                    if (d < rad * rad && d < bestD) { best = n; bestD = d; }
                }
                drag.hover = best ? best.id : null;
                const end = best
                    ? MSEC.anchorOf(best, MSEC.sideTowards(best, drag.start.x, drag.start.y))
                    : wp;
                const mx = (drag.start.x + end.x) / 2;
                const my = Math.min(drag.start.y, end.y) - 40;
                drag.temp.setAttribute('d', `M${drag.start.x},${drag.start.y} Q ${mx},${my} ${end.x},${end.y}`);
            }
        }

        onPointerUp(e) {
            const drag = this.drag;
            if (!drag) return;
            if (drag.mode === 'link') {
                if (drag.temp) drag.temp.remove();
                if (drag.hover) this.addRelation(drag.from, drag.hover, this.pendSnap);
            } else if ((drag.mode === 'nodes' || drag.mode === 'cont') && drag.moved) {
                this.changed({ keepView: true });   // commit positions; undo was pushed at first move
            }
            this.band.style.display = 'none';
            this.drag = null;
            this.pendSnap = null;
        }

        onDblClick(e) {
            if (!this.active || !this.model) return;
            const t = e.target;
            const ng = t.closest && t.closest('.ent');
            if (ng) { this.openEntityEditor(ng.dataset.id); return; }
            const rg = t.closest && t.closest('.rel');
            if (rg) { this.openRelForm(rg.dataset.id); return; }
            const cg = t.closest && t.closest('.cont');
            if (cg) { this.openContainerEditor(cg.dataset.id); return; }
        }

        // --------------------------------------------------------------
        // keyboard
        // --------------------------------------------------------------
        onKeyDown(e) {
            if (!this.active || !this.model) return false;
            const tag = (e.target.tagName || '').toLowerCase();
            const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
            if (e.key === ' ' && !typing) { this.spaceDown = true; this.svg.style.cursor = 'grab'; }
            if (typing) return false;
            if (this.svc.isHelpOpen && this.svc.isHelpOpen()) return false;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSel(); return true; }
            if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.selectAll(); return true; }
            if (mod && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (e.shiftKey) this.ungroupSel(); else this.groupSel();
                return true;
            }
            if (mod) return false;
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSel(); return true; }
            if (e.key === 'Escape') {
                if (this.form.style.display === 'block') { this.hideForm(); return true; }
                this.clearSelection();
                this.refreshSelClasses();
                return true;
            }
            if (e.key === 'Enter') {
                if (this.selEnts.size === 1) { e.preventDefault(); this.openEntityEditor([...this.selEnts][0]); }
                return true;
            }
            if (e.key === 'f' || e.key === 'F') { this.fitView(); return true; }
            if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                if (!this.selEnts.size) return true;
                const step = e.shiftKey ? 1 : GRID;
                const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
                const snap = this.takeSnap();
                const touched = new Set();
                for (const id of this.selEnts) {
                    const n = this.entById(id);
                    if (!n) continue;
                    n.x += d[0]; n.y += d[1];
                    touched.add(id);
                }
                this.pushUndo(snap);
                this.fastUpdatePositions(touched);
                this.changed({ keepView: true });
                return true;
            }
            return false;
        }
    }

    window.MSBoard = window.MSBoard || {};
    window.MSBoard.EntityBoard = EntityBoard;

})();
