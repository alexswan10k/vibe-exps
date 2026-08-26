/*
 * Mermaid Studio — entity modes core (window.MSEC)
 * Pure helper layer for the class / ER / state canvas modes.
 * Binding spec: docs/ENTITY_MODES_PLAN.md §2.4.
 *
 * House rules honored here:
 *   - classic script, everything inside one IIFE, single namespace window.MSEC
 *   - NO DOM access anywhere in this file except the lazily-created measuring
 *     canvas inside measureRows/textWidth, which is fully guarded so the file
 *     loads cleanly under Node (where no DOM exists).
 *   - entities are CENTERED rects: x,y = center (same semantics as flowchart nodes)
 */
(function () {
    'use strict';

    var SANS = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    var LH = 17;

    // ------------------------------------------------------------------
    // Lazy measuring context — the ONLY DOM touch in this file (Node-safe)
    // ------------------------------------------------------------------
    var _meas = null;
    var _measTried = false;
    function measCtx() {
        if (_measTried) return _meas;
        _measTried = true;
        try {
            if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
                var c = document.createElement('canvas');
                _meas = (c && c.getContext) ? c.getContext('2d') : null;
            }
        } catch (e) { _meas = null; }
        return _meas;
    }

    /**
     * Canvas-measured text width; falls back to a per-char estimate when no
     * DOM is available (Node harness / exotic embeds). Never throws.
     */
    function textWidth(text, fontSpec, estPerChar) {
        var s = String(text == null ? '' : text);
        var m = measCtx();
        if (m) {
            try { m.font = fontSpec || DEF_TITLE_FONT; return m.measureText(s).width; }
            catch (e) { /* fall through */ }
        }
        return s.length * (estPerChar != null ? estPerChar : 7.2);
    }

    // ------------------------------------------------------------------
    // Tiny utilities
    // ------------------------------------------------------------------
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    var _uidCtr = 0;
    function uid(prefix) { _uidCtr += 1; return (prefix || 'u') + _uidCtr; }

    /**
     * Make `s` safe inside a mermaid double-quoted token.
     * Same convention as the flowchart escLabel: `"` becomes `#quot;`,
     * newlines collapse to spaces (generated output never contains tabs).
     */
    function escQuote(s) {
        return String(s == null ? '' : s)
            .replace(/\r\n?/g, '\n')
            .replace(/"/g, '#quot;')
            .replace(/\n+/g, ' ')
            .trim();
    }

    /**
     * Display name -> ASCII [_a-zA-Z0-9]+ internal id candidate.
     * Diacritics folded, other runs collapsed to '_', leading digit prefixed.
     * Returns '' when nothing usable remains (caller falls back to nextId).
     */
    function sanitizeId(name) {
        var s = String(name == null ? '' : name);
        try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* old engine */ }
        s = s.replace(/[^_a-zA-Z0-9]+/g, '_').replace(/_+$|^_+/g, '');
        if (!s) return '';
        if (/^[0-9]/.test(s)) s = 'E' + s;
        return s.slice(0, 40);
    }

    /** Smallest `prefix<i>` not present in `taken` (Set, array or object-map). */
    function nextId(taken, prefix) {
        prefix = String(prefix == null ? 'E' : prefix);
        var look;
        if (taken instanceof Set) look = function (k) { return taken.has(k); };
        else if (Array.isArray(taken)) look = function (k) { return taken.indexOf(k) >= 0; };
        else if (taken && typeof taken === 'object' && typeof taken.has === 'function') look = function (k) { return taken.has(k); };
        else if (taken && typeof taken === 'object') look = function (k) { return Object.prototype.hasOwnProperty.call(taken, k); };
        else look = function () { return false; };
        var i = 1;
        while (look(prefix + i)) i++;
        return prefix + i;
    }

    // ------------------------------------------------------------------
    // Token tables (binding: plan §2.2)
    // ------------------------------------------------------------------

    /** class relation kinds -> [forward, reverse] mermaid token (gen uses fwd from->to). */
    var CLASS_REL_TOKENS = {
        gen:    ['<|--', '--|>'],
        real:   ['..|>', '<|..'],
        comp:   ['*--', '--*'],
        agg:    ['o--', '--o'],
        assoc:  ['-->', '<--'],
        dep:    ['..>', '<..'],
        link:   ['--', '--'],
        dashed: ['..', '..'],
    };

    /** Ordered kind enums per dialect. */
    var CLASS_REL_KINDS = ['gen', 'real', 'comp', 'agg', 'assoc', 'dep', 'link', 'dashed'];
    var ER_KINDS = ['id', 'nonid'];
    var STATE_KINDS = ['trans'];
    var REL_KINDS = { 'class': CLASS_REL_KINDS, er: ER_KINDS, state: STATE_KINDS };

    /** ER cardinality codes (written at the FROM/left side) and their mirrored right-side form. */
    var ER_CODES = ['|o', '||', '}o', '}|'];
    /** Internal cardinality code -> RIGHT-side emission spelling (binding plan §2.2).
     *  LEFT side always emits the internal code itself: |o || }o }| */
    var CARD_MIRROR = { '|o': 'o|', '||': '||', '}o': 'o{', '}|': '|{' };

    /** Container kind per dialect (er has none -> null). */
    var CONTAINER_KINDS = { 'class': 'namespace', er: null, state: 'composite' };

    /** Default relation kind created by rim-drag per dialect. */
    var DEFAULT_REL = { 'class': 'assoc', er: 'id', state: 'trans' };

    // ------------------------------------------------------------------
    // Text measuring / wrapping
    // ------------------------------------------------------------------

    var DEF_TITLE_FONT = '600 13px ' + SANS;
    var DEF_ROW_FONT = '11.5px ' + MONO;

    /**
     * Size a boxed entity: title band + member rows.
     * Accepts BOTH calling conventions found in the plan/task cards:
     *   measureRows(title, members, cfg)          — task-card order
     *   measureRows(members, title, cfg)          — plan §2.4 order (array first)
     * `title` may be a string OR an array of pre-wrapped lines.
     * Returns { w, h, bandH } — bandH = title-band height incl. separator gap.
     * cfg: { rowH, padX, padTop, padBottom, bandGap, minW, maxW, minH, titleFont, rowFont, titleEst, rowEst }
     */
    function measureRows(a, b, cfg) {
        cfg = cfg || {};
        var title = a, members = b;
        if (Array.isArray(a) && (typeof b === 'string' || b == null)) { members = a; title = b; }
        var titleLines = Array.isArray(title) ? title : [title == null ? '' : String(title)];
        var rows = Array.isArray(members) ? members : [];
        var rowH = cfg.rowH != null ? cfg.rowH : LH;
        var padX = cfg.padX != null ? cfg.padX : 12;
        var padTop = cfg.padTop != null ? cfg.padTop : 7;
        var padBottom = cfg.padBottom != null ? cfg.padBottom : 9;
        var bandGap = cfg.bandGap != null ? cfg.bandGap : 5;
        var minW = cfg.minW != null ? cfg.minW : 90;
        var maxW = cfg.maxW != null ? cfg.maxW : 340;
        var minH = cfg.minH != null ? cfg.minH : 40;
        var titleFont = cfg.titleFont || DEF_TITLE_FONT;
        var rowFont = cfg.rowFont || DEF_ROW_FONT;

        var tw = 0, i, wLine;
        for (i = 0; i < titleLines.length; i++) {
            wLine = textWidth(titleLines[i], titleFont, cfg.titleEst != null ? cfg.titleEst : 7.6);
            if (wLine > tw) tw = wLine;
        }
        var rw = 0;
        for (i = 0; i < rows.length; i++) {
            wLine = textWidth(rows[i], rowFont, cfg.rowEst != null ? cfg.rowEst : 6.9);
            if (wLine > rw) rw = wLine;
        }
        var w = Math.max(tw + padX * 2, rows.length ? rw + 20 : 0, minW);
        w = clamp(w, minW, maxW);
        var bandH = padTop + titleLines.length * rowH + bandGap;
        var h = bandH + rows.length * rowH + padBottom;
        if (h < minH) h = minH;
        return { w: Math.round(w), h: Math.round(h), bandH: Math.round(bandH) };
    }

    /** Greedy word wrap on a character budget; long words are hard-split. Returns array of lines. */
    function wrapLabel(text, maxChars) {
        maxChars = Math.max(4, maxChars | 0);
        var out = [];
        var paras = String(text == null ? '' : text).split('\n');
        for (var pi = 0; pi < paras.length; pi++) {
            var words = paras[pi].split(' ').filter(function (w) { return w !== ''; });
            if (!words.length) { out.push(''); continue; }
            var line = '';
            for (var wi = 0; wi < words.length; wi++) {
                var word = words[wi];
                while (word.length > maxChars) {
                    if (line) { out.push(line); line = ''; }
                    out.push(word.slice(0, maxChars));
                    word = word.slice(maxChars);
                }
                var cand = line ? line + ' ' + word : word;
                if (cand.length <= maxChars || !line) line = cand;
                else { out.push(line); line = word; }
            }
            if (line) out.push(line);
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Layout (dagre, optional at runtime)
    // ------------------------------------------------------------------

    /**
     * Mutates entity x/y (CENTER coordinates) using window.dagre when present.
     * Containers live in doc.containers and are deliberately NOT handed to dagre.
     * Returns true on success, false when dagre is unavailable / graph is empty.
     * opts: { rankdir, nodesep, ranksep, marginx, marginy } (defaults 64 / 84 / 30 / 30).
     */
    function dagreLayout(docArg, opts) {
        opts = opts || {};
        if (typeof window === 'undefined' || !window.dagre) return false;
        var ents = (docArg && docArg.entities) || [];
        if (!ents.length) return false;
        var dagre = window.dagre;
        var g;
        try { g = new dagre.graphlib.Graph(); } catch (e) { return false; }
        if (!g || !g.setGraph) return false;
        g.setGraph({
            rankdir: docArg.dir || opts.rankdir || 'TB',
            nodesep: opts.nodesep != null ? opts.nodesep : 64,
            ranksep: opts.ranksep != null ? opts.ranksep : 84,
            marginx: opts.marginx != null ? opts.marginx : 30,
            marginy: opts.marginy != null ? opts.marginy : 30,
        });
        g.setDefaultEdgeLabel(function () { return {}; });
        var known = {};
        for (var i = 0; i < ents.length; i++) {
            var n = ents[i];
            if (!n || n.id == null) continue;
            known[n.id] = true;
            g.setNode(n.id, { width: n.w || 140, height: n.h || 48 });
        }
        var rels = (docArg && docArg.rels) || [];
        for (var j = 0; j < rels.length; j++) {
            var r = rels[j];
            if (r && known[r.from] && known[r.to]) g.setEdge(r.from, r.to);
        }
        try { dagre.layout(g); } catch (e) { return false; }
        for (var k = 0; k < ents.length; k++) {
            var en = ents[k];
            if (!en || en.id == null) continue;
            var p = null;
            try { p = g.node(en.id); } catch (e2) { p = null; }
            if (p && isFinite(p.x) && isFinite(p.y)) { en.x = Math.round(p.x); en.y = Math.round(p.y); }
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Geometry (centered rects, same semantics as the flowchart board)
    // ------------------------------------------------------------------
    function anchorOf(rect, side) {
        switch (side) {
            case 'l': return { x: rect.x - rect.w / 2, y: rect.y };
            case 'r': return { x: rect.x + rect.w / 2, y: rect.y };
            case 't': return { x: rect.x, y: rect.y - rect.h / 2 };
            default: return { x: rect.x, y: rect.y + rect.h / 2 };
        }
    }
    function sideTowards(rect, tx, ty) {
        var dx = tx - rect.x, dy = ty - rect.y;
        var fx = dx / Math.max(rect.w / 2, 1), fy = dy / Math.max(rect.h / 2, 1);
        return Math.abs(fx) > Math.abs(fy) ? (fx > 0 ? 'r' : 'l') : (fy > 0 ? 'b' : 't');
    }

    window.MSEC = {
        LH: LH,
        SANS: SANS,
        MONO: MONO,
        escQuote: escQuote,
        sanitizeId: sanitizeId,
        nextId: nextId,
        clamp: clamp,
        uid: uid,
        CLASS_REL_TOKENS: CLASS_REL_TOKENS,
        CLASS_REL_KINDS: CLASS_REL_KINDS,
        ER_CODES: ER_CODES,
        ER_KINDS: ER_KINDS,
        STATE_KINDS: STATE_KINDS,
        REL_KINDS: REL_KINDS,
        CARD_MIRROR: CARD_MIRROR,
        CONTAINER_KINDS: CONTAINER_KINDS,
        DEFAULT_REL: DEFAULT_REL,
        measureRows: measureRows,
        wrapLabel: wrapLabel,
        textWidth: textWidth,
        dagreLayout: dagreLayout,
        anchorOf: anchorOf,
        sideTowards: sideTowards,
    };

})();
