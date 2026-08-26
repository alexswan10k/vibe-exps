/*
 * mode-class.js — 🏛 Class canvas mode for Mermaid Studio.
 *
 * Implements the classDiagram subset of docs/ENTITY_MODES_PLAN.md §3.1
 * (as corrected): header + optional direction, class Foo / Foo~T~ with
 * braces or Foo : member lines, 8 relation kinds with reversed tokens,
 * quoted cardinalities, label after :, floating + anchored notes, single-
 * level namespace. Warned/dropped: classDef/cssClass/style/click/link,
 * <<stereotypes>> stripped, |pipe| labels dropped.
 *
 * Classic script, IIFE-wrapped, attaches only window.MSMODES.class.
 * parse/gen are pure string logic (Node-vm safe: no document/window reads
 * except the final registration).
 */
(function () {
    'use strict';

    var BARE_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
    var BARE_ASCII_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var DIRS = { TB: 1, BT: 1, LR: 1, RL: 1 };

    // Token -> {kind, rev}. Forward token is gen's fwd form.
    var TOK_KIND = {
        '<|--': { kind: 'gen', rev: false },
        '--|>': { kind: 'gen', rev: true },
        '..|>': { kind: 'real', rev: false },
        '<|..': { kind: 'real', rev: true },
        '*--': { kind: 'comp', rev: false },
        '--*': { kind: 'comp', rev: true },
        'o--': { kind: 'agg', rev: false },
        '--o': { kind: 'agg', rev: true },
        '-->': { kind: 'assoc', rev: false },
        '<--': { kind: 'assoc', rev: true },
        '..>': { kind: 'dep', rev: false },
        '<..': { kind: 'dep', rev: true },
        '--': { kind: 'link', rev: false },
        '..': { kind: 'dashed', rev: false }
    };
    var TOKENS_SORTED = ['<|--', '--|>', '..|>', '<|..', '*--', '--*', 'o--', '--o', '-->', '<--', '..>', '<..', '--', '..'];
    function escReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    var TOKEN_ALT = TOKENS_SORTED.map(escReg).join('|');
    // relation regex: from, cardA, token, cardB, to, label (after :)
    var REL_RE = new RegExp('^(\\S+)\\s*(?:"([^"]*)"\\s*)?(' + TOKEN_ALT + ')\\s*(?:"([^"]*)"\\s*)?(\\S+)(?:\\s*:\\s*(.*))?\\s*$');

    function sanitizeId(name) {
        var s = String(name == null ? '' : name);
        try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
        s = s.replace(/[^_A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!s) return '';
        if (/^[0-9]/.test(s)) s = 'C' + s;
        return s.slice(0, 40);
    }

    function isBare(name) {
        try { return BARE_RE.test(name); } catch (e) { return BARE_ASCII_RE.test(name); }
    }

    function trim(s) { return String(s == null ? '' : s).trim(); }

    // ------------------------------------------------------------------
    // Parse
    // ------------------------------------------------------------------
    function parseClass(srcText) {
        var data = { dir: 'TB', entities: [], rels: [], containers: [] };
        var errors = [];
        var warnings = [];
        var lines = String(srcText == null ? '' : srcText).split(/\r?\n/);

        var byId = {};
        var taken = {};
        var relSeq = 0;
        var noteSeq = 0;
        var sawHeader = false;
        var containerStack = [];
        var classBlock = null; // entity currently open with {

        function isTaken(id) { return Object.prototype.hasOwnProperty.call(taken, id); }
        function addTaken(id) { taken[id] = true; }
        function nextNoteId() {
            var id;
            do { noteSeq++; id = 'N' + noteSeq; } while (isTaken(id));
            addTaken(id);
            return id;
        }
        function nextRelId() {
            var id;
            do { relSeq++; id = 'r' + relSeq; } while (false);
            // rel ids not in taken map but keep unique
            return id;
        }

        function ensureEntity(display, idHint) {
            var id = idHint;
            if (!id) {
                id = sanitizeId(display);
                if (!id) id = 'C' + (Object.keys(byId).length + 1);
                var base = id, n = 1;
                while (isTaken(id) && byId[id] && byId[id].name !== display) {
                    n++; id = base + '_' + n;
                }
            } else {
                // ensure uniqueness if collision with different display
                if (isTaken(id) && byId[id] && byId[id].name !== display) {
                    var b = id, k = 1;
                    var cand = b;
                    while (isTaken(cand)) { k++; cand = b + '_' + k; }
                    id = cand;
                }
            }
            var ex = byId[id];
            if (ex) return ex;
            var ent = { id: id, name: display, alias: null, shape: 'box', stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 };
            byId[id] = ent;
            addTaken(id);
            data.entities.push(ent);
            if (containerStack.length) {
                var cur = containerStack[containerStack.length - 1];
                if (cur.members.indexOf(id) === -1) cur.members.push(id);
            }
            return ent;
        }

        function ensureByRef(raw) {
            var m = /^([A-Za-z_][A-Za-z0-9_]*)~([^~]+)~$/.exec(raw);
            if (m) {
                var base = m[1], inner = m[2];
                var disp = base + '<' + inner + '>';
                return ensureEntity(disp, base);
            }
            if (BARE_ASCII_RE.test(raw) || isBare(raw)) {
                return ensureEntity(raw, raw);
            }
            var sid = sanitizeId(raw);
            if (!sid) sid = 'C' + (Object.keys(byId).length + 1);
            var bs = sid, nn = 1;
            while (isTaken(sid) && byId[sid] && byId[sid].name !== raw) { nn++; sid = bs + '_' + nn; }
            return ensureEntity(raw, sid);
        }

        for (var li = 0; li < lines.length; li++) {
            var raw = lines[li];
            var t = trim(raw);
            var ln = li + 1;
            if (!t || t.indexOf('%%') === 0) continue;
            if (!sawHeader) {
                if (/^classDiagram\s*$/i.test(t)) { sawHeader = true; continue; }
                errors.push({ line: ln, msg: 'expected a "classDiagram" header first' });
                return { data: data, errors: errors, warnings: warnings };
            }

            // direction
            var dm = /^direction\s+(TB|BT|LR|RL)\s*$/i.exec(t);
            if (dm) { data.dir = dm[1].toUpperCase(); if (!DIRS[data.dir]) warnings.push({ line: ln, msg: 'unknown direction "' + dm[1] + '" kept' }); continue; }

            // warned & dropped directives
            if (/^(classDef|cssClass)\b/.test(t)) { warnings.push({ line: ln, msg: t.split(/\s/)[0] + ' ignored' }); continue; }
            if (/^style\b/.test(t)) { warnings.push({ line: ln, msg: 'style ignored' }); continue; }
            if (/^click\b/.test(t)) { warnings.push({ line: ln, msg: 'click ignored' }); continue; }
            if (/^link\b/.test(t)) { warnings.push({ line: ln, msg: 'link ignored' }); continue; }
            if (/^(accTitle|accDescr)\b/.test(t)) { warnings.push({ line: ln, msg: t.split(/\s/)[0] + ' ignored' }); continue; }

            // stereotype stripping (<< >>) — keep name but warn
            if (t.indexOf('<<') !== -1 && t.indexOf('>>') !== -1) {
                warnings.push({ line: ln, msg: 'stereotype <<...>> stripped' });
                t = t.replace(/<<[^>]*>>/g, '').trim();
                t = t.replace(/\s{2,}/g, ' ');
                if (!t) continue;
            }

            // namespace open
            var nsM = /^namespace\s+("[^"]+"|'[^']+'|\S+)\s*\{\s*$/.exec(t);
            if (nsM) {
                if (containerStack.length) warnings.push({ line: ln, msg: 'nested namespaces flattened' });
                var titleRaw = nsM[1];
                var title = titleRaw;
                if ((title.charAt(0) === '"' && title.charAt(title.length - 1) === '"') || (title.charAt(0) === "'" && title.charAt(title.length - 1) === "'")) {
                    title = title.slice(1, -1);
                }
                var cid = isBare(title) ? title : sanitizeId(title);
                if (!cid) cid = 'NS' + (data.containers.length + 1);
                var baseCid = cid, ck = 1;
                while (isTaken(cid) || data.containers.some(function (c) { return c.id === cid; })) { ck++; cid = baseCid + '_' + ck; }
                addTaken(cid);
                var cont = { id: cid, title: title, kind: 'namespace', members: [] };
                data.containers.push(cont);
                containerStack.push(cont);
                continue;
            }
            // closing brace
            if (t === '}') {
                if (classBlock) { classBlock = null; continue; }
                if (containerStack.length) { containerStack.pop(); continue; }
                warnings.push({ line: ln, msg: 'unexpected "}" ignored' });
                continue;
            }
            // inline closing with content before? handle " }"? already covered.

            // note: floating or anchored
            var notePat = /^note\s+(?:for\s+(\S+)\s+)?(?:"([^"]*)"|'([^']*)')\s*$/i;
            var nm = notePat.exec(t);
            if (nm) {
                var forRaw = nm[1] || null;
                var txt = nm[2] != null ? nm[2] : (nm[3] != null ? nm[3] : '');
                var anchor = '';
                if (forRaw) {
                    // resolve target entity id
                    var tgt = byId[forRaw];
                    if (!tgt) {
                        // try tilde normalization
                        var tm = /^([A-Za-z_][A-Za-z0-9_]*)~([^~]+)~$/.exec(forRaw);
                        if (tm) {
                            var bd = tm[1];
                            tgt = byId[bd];
                        }
                    }
                    if (!tgt) {
                        // create placeholder for forward reference
                        tgt = ensureByRef(forRaw);
                        // placeholder is a class, keep it; warning?
                    }
                    anchor = tgt.id;
                }
                var nid = nextNoteId();
                var noteEnt = { id: nid, name: 'Note', alias: null, shape: 'note', stereo: null, members: [txt], anchor: anchor, noteSide: null, x: null, y: null, w: 0, h: 0 };
                byId[nid] = noteEnt;
                // taken already
                data.entities.push(noteEnt);
                continue;
            }

            // attempt relation parse
            var rm = REL_RE.exec(t);
            if (rm) {
                var fromRaw = rm[1];
                var cardA = rm[2] != null ? rm[2] : '';
                var token = rm[3];
                var cardB = rm[4] != null ? rm[4] : '';
                var toRaw = rm[5];
                var labelRaw = rm[6] != null ? trim(rm[6]) : '';
                // pipe label check
                if (labelRaw && /^\|.*\|$/.test(labelRaw)) {
                    warnings.push({ line: ln, msg: '|pipe| labels dropped' });
                    labelRaw = '';
                } else if (labelRaw && labelRaw.indexOf('|') === 0 && labelRaw.indexOf('|', 1) !== -1) {
                    // also catch embedded pipe form before colon? Already handled
                }
                // strip surrounding quotes from label if present
                if (labelRaw.length >= 2 && ((labelRaw.charAt(0) === '"' && labelRaw.charAt(labelRaw.length - 1) === '"') || (labelRaw.charAt(0) === "'" && labelRaw.charAt(labelRaw.length - 1) === "'"))) {
                    labelRaw = labelRaw.slice(1, -1).trim();
                }
                labelRaw = labelRaw.replace(/"/g, "'");

                var info = TOK_KIND[token];
                if (!info) { warnings.push({ line: ln, msg: 'unknown relation token "' + token + '" ignored' }); continue; }
                var fromIdRaw = fromRaw;
                var toIdRaw = toRaw;
                var ca = cardA;
                var cb = cardB;
                if (info.rev) {
                    var tmpR = fromIdRaw; fromIdRaw = toIdRaw; toIdRaw = tmpR;
                    var tmpC = ca; ca = cb; cb = tmpC;
                }
                var fromEnt = ensureByRef(fromIdRaw);
                var toEnt = ensureByRef(toIdRaw);
                data.rels.push({ id: nextRelId(), from: fromEnt.id, to: toEnt.id, kind: info.kind, cardA: ca || '', cardB: cb || '', label: labelRaw || '' });
                continue;
            }

            // class definition line (starts with class)
            if (/^class\s+/.test(t)) {
                // isolate after 'class'
                var rest = t.replace(/^class\s+/, '').trim();
                // detect trailing brace
                var hasBrace = false;
                if (/\{\s*$/.test(rest)) {
                    hasBrace = true;
                    rest = rest.replace(/\{\s*$/, '').trim();
                }
                // bracket display extraction: Id["Display"]
                var brIdx = rest.indexOf('["');
                var brDisp = null;
                var idPart = rest;
                if (brIdx !== -1) {
                    var endBr = rest.lastIndexOf('"]');
                    if (endBr !== -1 && endBr > brIdx) {
                        brDisp = rest.slice(brIdx + 2, endBr);
                        brDisp = brDisp.replace(/#quot;/g, '"');
                        idPart = trim(rest.slice(0, brIdx));
                        // ignore any trailing after "]" already stripped
                    }
                }
                // idPart may contain tilde generics: Foo~T~
                var tildeM = /^([A-Za-z_][A-Za-z0-9_]*)~([^~]+)~$/.exec(idPart);
                if (tildeM) {
                    var baseN = tildeM[1], innerN = tildeM[2];
                    var dispN = baseN + '<' + innerN + '>';
                    // if bracket display overrides, use that
                    if (brDisp != null) dispN = brDisp;
                    var entT = ensureEntity(dispN, baseN);
                    if (hasBrace) classBlock = entT;
                    continue;
                }
                if (brDisp != null) {
                    var bid = idPart;
                    if (!BARE_ASCII_RE.test(bid)) bid = sanitizeId(bid) || 'C' + (Object.keys(byId).length + 1);
                    var entB = ensureEntity(brDisp, bid);
                    if (hasBrace) classBlock = entB;
                    continue;
                }
                // simple bare id
                if (idPart) {
                    // idPart could be bare or maybe quoted display without id? fallback
                    var bareId = idPart;
                    if (!isBare(bareId)) {
                        // non-bare without bracket: sanitize to id, keep display
                        var sId = sanitizeId(bareId);
                        if (!sId) sId = 'C' + (Object.keys(byId).length + 1);
                        var entX = ensureEntity(bareId, sId);
                        if (hasBrace) classBlock = entX;
                    } else {
                        var entS = ensureEntity(bareId, bareId);
                        if (hasBrace) classBlock = entS;
                    }
                }
                continue;
            }

            // inside class braces: treat as member line (must precede colon check)
            if (classBlock) {
                classBlock.members.push(t);
                continue;
            }

            // Foo : member lines (colon members) — only when not inside a class block
            // left side must be a bare class id (or tilde generic), not a member signature like "+x"
            var colonM = /^(\S+)\s*:\s*(.+)\s*$/.exec(t);
            if (colonM) {
                var clsRef = colonM[1];
                var memTxt = trim(colonM[2]);
                var isClsRef = BARE_ASCII_RE.test(clsRef) || /^([A-Za-z_][A-Za-z0-9_]*)~([^~]+)~$/.test(clsRef) || isBare(clsRef);
                if (isClsRef) {
                    var clsEnt = ensureByRef(clsRef);
                    clsEnt.members.push(memTxt);
                    continue;
                }
            }

            // fallback
            warnings.push({ line: ln, msg: 'line ignored: "' + t.slice(0, 32) + '"' });
        }

        if (!sawHeader) errors.push({ line: 1, msg: 'expected a "classDiagram" header first' });
        if (classBlock) warnings.push({ line: lines.length, msg: 'class block for "' + classBlock.name + '" not closed' });
        if (containerStack.length) warnings.push({ line: lines.length, msg: 'namespace "' + containerStack[containerStack.length - 1].title + '" not closed' });

        return { data: data, errors: errors, warnings: warnings };
    }

    // ------------------------------------------------------------------
    // Gen
    // ------------------------------------------------------------------
    var TOKEN_OF_KIND = {
        gen: '<|--',
        real: '..|>',
        comp: '*--',
        agg: 'o--',
        assoc: '-->',
        dep: '..>',
        link: '--',
        dashed: '..'
    };

    function escDisp(s) {
        return String(s == null ? '' : s).replace(/"/g, '#quot;').replace(/\r\n?/g, ' ').trim();
    }

    function genClass(doc) {
        var d = doc || {};
        var ents = Array.isArray(d.entities) ? d.entities : [];
        var rels = Array.isArray(d.rels) ? d.rels : [];
        var containers = Array.isArray(d.containers) ? d.containers : [];
        var L = ['classDiagram'];
        if (d.dir && d.dir !== 'TB') L.push('direction ' + String(d.dir));

        var byId = {};
        for (var i = 0; i < ents.length; i++) if (ents[i] && ents[i].id != null) byId[ents[i].id] = ents[i];

        // helper to emit a single class entity as lines
        function classLines(e, indent) {
            indent = indent || '';
            var name = e.name != null ? String(e.name) : e.id;
            var id = e.id;
            var members = Array.isArray(e.members) ? e.members : [];
            // generic detection: name is "Base<Inner>" and id == Base
            var gm = /^([A-Za-z_][A-Za-z0-9_]*)<(.+)>$/.exec(name);
            if (gm && gm[1] === id) {
                var inner = gm[2];
                var head = indent + 'class ' + id + '~' + inner + '~';
                if (members.length) {
                    var out = [head + ' {'];
                    for (var a = 0; a < members.length; a++) out.push(indent + '    ' + String(members[a]));
                    out.push(indent + '}');
                    return out;
                }
                return [head];
            }
            var bareOk = isBare(name) && name === id;
            if (bareOk) {
                var hdr = indent + 'class ' + name;
                if (members.length) {
                    var arr = [hdr + ' {'];
                    for (var b = 0; b < members.length; b++) arr.push(indent + '    ' + String(members[b]));
                    arr.push(indent + '}');
                    return arr;
                }
                return [hdr];
            } else {
                var disp = escDisp(name);
                var h = indent + 'class ' + id + '["' + disp + '"]';
                if (members.length) {
                    var ap = [h + ' {'];
                    for (var c = 0; c < members.length; c++) ap.push(indent + '    ' + String(members[c]));
                    ap.push(indent + '}');
                    return ap;
                }
                return [h];
            }
        }

        // containers sorted alpha by title
        var contSorted = containers.slice().sort(function (a, b) {
            var at = a.title || a.id, bt = b.title || b.id;
            return at < bt ? -1 : at > bt ? 1 : 0;
        });

        var inContainer = {};
        for (var ci = 0; ci < contSorted.length; ci++) {
            var cm = contSorted[ci].members || [];
            for (var mi = 0; mi < cm.length; mi++) inContainer[cm[mi]] = true;
        }

        if (contSorted.length) {
            L.push('');
            for (var cii = 0; cii < contSorted.length; cii++) {
                var cc = contSorted[cii];
                L.push('namespace ' + cc.title + ' {');
                var mids = (cc.members || []).slice().sort();
                for (var mk = 0; mk < mids.length; mk++) {
                    var eid = mids[mk];
                    var ee = byId[eid];
                    if (!ee || ee.shape === 'note') continue;
                    var cls = classLines(ee, '    ');
                    for (var q = 0; q < cls.length; q++) L.push(cls[q]);
                }
                L.push('}');
            }
        }

        var bare = ents.filter(function (e) { return e && e.shape !== 'note' && !inContainer[e.id]; });
        bare.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
        if (bare.length) {
            L.push('');
            for (var bi = 0; bi < bare.length; bi++) {
                var be = bare[bi];
                var lines = classLines(be, '');
                for (var r = 0; r < lines.length; r++) L.push(lines[r]);
            }
        } else if (!contSorted.length) {
            // ensure blank separation still? but need blank before notes? handle later
        }

        var notes = ents.filter(function (e) { return e && e.shape === 'note'; });
        notes.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
        if (notes.length) {
            if (L.length && L[L.length - 1] !== '') L.push('');
            for (var ni = 0; ni < notes.length; ni++) {
                var ne = notes[ni];
                var txt = (ne.members && ne.members[0] != null) ? String(ne.members[0]) : '';
                var esc = txt.replace(/"/g, "'").replace(/\r?\n/g, ' ');
                if (ne.anchor) {
                    L.push('note for ' + ne.anchor + ' "' + esc + '"');
                } else {
                    L.push('note "' + esc + '"');
                }
            }
        }

        if (rels.length) {
            L.push('');
            for (var ri = 0; ri < rels.length; ri++) {
                var rr = rels[ri];
                if (!rr || !byId[rr.from] || !byId[rr.to]) continue;
                var tok = TOKEN_OF_KIND[rr.kind] || '--';
                var left = rr.cardA ? ' "' + String(rr.cardA).replace(/"/g, "'") + '"' : '';
                var right = rr.cardB ? ' "' + String(rr.cardB).replace(/"/g, "'") + '"' : '';
                var line = rr.from + left + ' ' + tok + right + ' ' + rr.to;
                if (rr.label) {
                    var lab = trim(String(rr.label));
                    if (lab) line += ' : ' + lab;
                }
                L.push(line);
            }
        }

        return L.join('\n');
    }

    function statsClass(doc) {
        var d = doc || {};
        var n = Array.isArray(d.entities) ? d.entities.length : 0;
        var m = Array.isArray(d.rels) ? d.rels.length : 0;
        return n + ' entities \u00B7 ' + m + ' relations';
    }

    function emptyDoc() {
        return {
            dir: 'TB',
            entities: [
                { id: 'Foo', name: 'Foo', alias: null, shape: 'box', stereo: null, members: ['+value: int'], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 },
                { id: 'Bar', name: 'Bar', alias: null, shape: 'box', stereo: null, members: ['+name: string'], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 }
            ],
            rels: [{ id: 'r1', from: 'Foo', to: 'Bar', kind: 'assoc', cardA: '', cardB: '', label: '' }],
            containers: []
        };
    }

    // ------------------------------------------------------------------
    // Templates (all round-trip stable; exercises headline features)
    // ------------------------------------------------------------------
    var TEMPLATES = [
        {
            key: 'software-system',
            name: '\uD83D\uDE97 Software system',
            src: [
                'classDiagram',
                '',
                'namespace Geometry {',
                '    class Point {',
                '        +x: int',
                '        +y: int',
                '    }',
                '    class Polygon {',
                '        +points: List~Point~',
                '        +area(): double',
                '    }',
                '}',
                '',
                'class Vehicle {',
                '    +name: string',
                '    +draw()*',
                '}',
                'class Car {',
                '    +count$ : int',
                '    +engine: Engine',
                '}',
                'class Bicycle',
                'class Engine',
                'class Wheel',
                'class Driver',
                'class Cache~T~ {',
                '    +get(key: T): T',
                '    +put(key: T, value: T)',
                '}',
                '',
                'note "Floating design note: prefer composition over inheritance"',
                'note for Car "Car has 4 wheels in this model"',
                '',
                'Vehicle <|-- Car : inherits',
                'Vehicle <|-- Bicycle',
                'Car "1" *-- "1" Engine : contains',
                'Car "1" o-- "4" Wheel : has',
                'Driver ..> Car : uses',
                'Polygon ..> Point : references',
                'Engine -- Wheel : linked',
                'Point .. Polygon : dashed link'
            ].join('\n')
        },
        {
            key: 'company-model',
            name: '\uD83C\uDFE2 Company model',
            src: [
                'classDiagram',
                '',
                'class Employee {',
                '    +name: string',
                '    +id: int',
                '    +work()',
                '}',
                'class Manager {',
                '    +teamSize: int',
                '}',
                'class Engineer {',
                '    +specialty: string',
                '}',
                'class Department {',
                '    +deptName: string',
                '}',
                'class Project {',
                '    +title: string',
                '    +deadline: string',
                '}',
                '',
                'Employee <|-- Manager',
                'Employee <|-- Engineer',
                'Department o-- Employee : employs',
                'Department "1" -- "1..*" Project : manages',
                'Employee "1" -- "0..*" Project : works on'
            ].join('\n')
        },
        {
            key: 'mvc-notes',
            name: '\uD83E\uDDE9 MVC notes',
            src: [
                'classDiagram',
                '',
                'class Model {',
                '    +data: string',
                '    +update()',
                '}',
                'class View {',
                '    +render()',
                '}',
                'class Controller {',
                '    +handleInput()',
                '}',
                'class Service {',
                '    +fetch()',
                '}',
                'class Router {',
                '    +route()',
                '}',
                '',
                'note "MVC pattern separates concerns"',
                'note for Model "Model holds application data"',
                'note for View "View renders Model"',
                '',
                'Controller ..> Model : depends',
                'View *-- Model : observes',
                'Controller --> View : updates',
                'Service ..> Model : uses',
                'Router --> Controller : forwards',
                'View -- Service : link'
            ].join('\n')
        }
    ];

    window.MSMODES = window.MSMODES || {};
    window.MSMODES.class = {
        id: 'class',
        tab: '\uD83C\uDFDB Class',
        empty: emptyDoc,
        parse: parseClass,
        gen: genClass,
        stats: statsClass,
        templates: TEMPLATES,
        boardCfg: {
            dialect: 'class',
            defaultRel: 'assoc',
            palette: [
                { key: 'classbox', label: 'Class', hint: 'new class' },
                { key: 'note', label: 'Note', hint: 'floating note' }
            ],
            emptyStatsHint: 'drag between class rims to relate them'
        }
    };
})();
