/*
 * mode-state.js — ⚙️ State canvas mode for Mermaid Studio.
 * Implements the stateDiagram-v2 subset of docs/ENTITY_MODES_PLAN.md §3.3.
 *
 * Classic script, IIFE-wrapped, attaches only window.MSMODES.state.
 * parse/gen are pure string logic (Node-vm safe).
 */
(function () {
    'use strict';

    var BARE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var DIRS = { TB: 1, BT: 1, LR: 1, RL: 1 };
    var SHAPES_SET = { box: 1, note: 1, start: 1, stop: 1, choice: 1, fork: 1, join: 1 };

    function escQuote(s) {
        return String(s == null ? '' : s).replace(/"/g, '#quot;').replace(/\n+/g, ' ').trim();
    }
    function normWs(s) { return String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim(); }

    function sanitizeId(name) {
        var s = String(name == null ? '' : name);
        try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
        s = s.replace(/[^_a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!s) return '';
        if (/^[0-9]/.test(s)) s = 'E' + s;
        return s.slice(0, 40);
    }
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
    // Parse
    // ------------------------------------------------------------------
    function parseState(srcText) {
        var data = { dir: 'TB', entities: [], rels: [], containers: [] };
        var errors = [];
        var warnings = [];
        var lines = String(srcText == null ? '' : srcText).split(/\r?\n/);
        var byId = {};
        var takenIds = {};
        var relSeq = 0;
        var noteSeq = 0;
        var stack = [];

        function takenHas(id) { return !!takenIds[id]; }
        function markTaken(id) { takenIds[id] = true; }
        function nextRelId() {
            var id;
            do { relSeq++; id = 'r' + relSeq; } while (takenHas(id));
            markTaken(id);
            return id;
        }
        function nextNoteId() {
            var id;
            do { noteSeq++; id = 'N' + noteSeq; } while (takenHas(id));
            markTaken(id);
            return id;
        }

        function ensureEntity(id, nameHint, shapeHint, aliasHint) {
            var e = byId[id];
            if (!e) {
                var cleanName = nameHint != null ? nameHint : id;
                var al = aliasHint !== undefined ? aliasHint : (cleanName !== id ? cleanName : null);
                // alias null when name == id; alias = display name when name differs
                if (al === undefined) al = null;
                if (cleanName === id) al = aliasHint != null ? aliasHint : null;
                e = { id: id, name: cleanName, alias: al, shape: shapeHint || 'box', stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 };
                byId[id] = e;
                data.entities.push(e);
                markTaken(id);
                if (stack.length) {
                    var top = stack[stack.length - 1];
                    if (top.members.indexOf(id) < 0) top.members.push(id);
                }
            } else {
                // Preserve alias: only upgrade when new alias is non-null and differs
                if (aliasHint != null && aliasHint !== '' && aliasHint !== e.alias) {
                    e.alias = aliasHint;
                    e.name = nameHint != null ? nameHint : aliasHint;
                } else if (nameHint != null && nameHint !== e.name) {
                    // Only overwrite name if not clobbering an existing alias display name with a bare id
                    if (e.alias == null) {
                        e.name = nameHint;
                        if (nameHint !== id && e.alias == null) e.alias = nameHint;
                    }
                }
                if (shapeHint && shapeHint !== 'box') {
                    if (e.shape === 'box' || e.shape !== shapeHint) e.shape = shapeHint;
                }
                if (stack.length) {
                    var top2 = stack[stack.length - 1];
                    if (top2.members.indexOf(id) < 0) top2.members.push(id);
                }
            }
            return e;
        }
        function ensureStar(kind) {
            var sid = kind === 'start' ? '__start' : '__stop';
            var e = byId[sid];
            if (!e) {
                e = { id: sid, name: '[*]', alias: null, shape: kind, stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 };
                byId[sid] = e;
                data.entities.push(e);
                markTaken(sid);
                if (stack.length) {
                    var top = stack[stack.length - 1];
                    if (top.members.indexOf(sid) < 0) top.members.push(sid);
                }
            }
            return e;
        }

        // locate header
        var sawHeader = false;
        var headerIdx = -1;
        for (var hi = 0; hi < lines.length; hi++) {
            var ht = normWs(lines[hi]);
            if (!ht || ht.indexOf('%%') === 0) continue;
            if (/^stateDiagram(?:-v2)?\s*$/i.test(ht)) { sawHeader = true; headerIdx = hi; break; }
            else {
                errors.push({ line: hi + 1, msg: 'expected a "stateDiagram-v2" header first' });
                return { data: data, errors: errors, warnings: warnings };
            }
        }
        if (!sawHeader) {
            errors.push({ line: 1, msg: 'expected a "stateDiagram-v2" header first' });
            return { data: data, errors: errors, warnings: warnings };
        }

        // main scan after header
        for (var li = headerIdx + 1; li < lines.length; li++) {
            var raw = lines[li];
            var t = raw.trim();
            var ln = li + 1;
            if (!t || t.indexOf('%%') === 0) continue;

            var m;

            // concurrency separator
            if (t === '--') { warnings.push({ line: ln, msg: 'concurrency separator "--" dropped' }); continue; }
            if (/^displayShortName\b/i.test(t)) { warnings.push({ line: ln, msg: 'displayShortName dropped' }); continue; }

            // direction
            if ((m = /^direction\s+(TB|BT|LR|RL)\s*$/i.exec(t))) {
                var dv = m[1].toUpperCase();
                if (stack.length) {
                    var topc = stack[stack.length - 1];
                    if (!topc.dir) topc.dir = dv;
                    else if (topc.dir !== dv) warnings.push({ line: ln, msg: 'duplicate direction inside composite ignored' });
                } else {
                    data.dir = dv;
                    if (!DIRS[dv]) warnings.push({ line: ln, msg: 'unknown direction "' + m[1] + '" kept' });
                }
                continue;
            }
            // warn nested direction inside composite already handled

            // composite start: state ... {
            if (t.charAt(t.length - 1) === '{') {
                var without = t.slice(0, -1).trim();
                if (/^state\b/i.test(without)) {
                    var rest = without.slice(5).trim();
                    var cid = null, ctitle = null;
                    if (!rest) {
                        cid = nextId(takenIds, 'Composite');
                        ctitle = cid;
                    } else if ((m = /^"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(rest))) {
                        ctitle = m[1]; cid = m[2];
                    } else if ((m = /^'([^']+)'\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(rest))) {
                        ctitle = m[1]; cid = m[2];
                    } else if ((m = /^"([^"]+)"$/.exec(rest))) {
                        ctitle = m[1]; cid = sanitizeId(ctitle) || nextId(takenIds, 'Composite');
                        if (takenHas(cid)) cid = nextId(takenIds, cid + '_');
                    } else if ((m = /^'([^']+)'$/.exec(rest))) {
                        ctitle = m[1]; cid = sanitizeId(ctitle) || nextId(takenIds, 'Composite');
                        if (takenHas(cid)) cid = nextId(takenIds, cid + '_');
                    } else if (BARE_ID_RE.test(rest)) {
                        cid = rest; ctitle = rest;
                    } else {
                        warnings.push({ line: ln, msg: 'unrecognized composite header "' + rest.slice(0, 24) + '" dropped' });
                        continue;
                    }
                    if (takenHas(cid) && data.containers.some(function (c) { return c.id === cid; })) {
                        // duplicate container id
                        var orig = cid;
                        cid = nextId(takenIds, orig + '_');
                        warnings.push({ line: ln, msg: 'duplicate composite id "' + orig + '" renamed to "' + cid + '"' });
                    }
                    var cont = { id: cid, title: ctitle, kind: 'composite', members: [], dir: null };
                    if (stack.length) {
                        warnings.push({ line: ln, msg: 'nested composite flattened' });
                        // push but not added to data.containers (flatten)
                        stack.push(cont);
                        markTaken(cid);
                    } else {
                        data.containers.push(cont);
                        stack.push(cont);
                        markTaken(cid);
                    }
                    continue;
                }
            }
            if (t === '}') {
                if (!stack.length) { warnings.push({ line: ln, msg: 'unexpected "}" ignored' }); continue; }
                var popped = stack.pop();
                if (data.containers.indexOf(popped) === -1) {
                    // flattened nested: merge members into outer if any
                    if (stack.length) {
                        var outer = stack[stack.length - 1];
                        for (var mi = 0; mi < popped.members.length; mi++) {
                            var mid = popped.members[mi];
                            if (outer.members.indexOf(mid) < 0) outer.members.push(mid);
                        }
                        if (popped.dir && !outer.dir) outer.dir = popped.dir;
                    } else {
                        // no outer: members already global entities, nothing extra
                    }
                }
                continue;
            }

            // alias: state "Long" as Id   (must be before decorator)
            if ((m = /^state\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i.exec(t))) {
                var alabel = m[1]; var aid = m[2];
                ensureEntity(aid, alabel, 'box', alabel);
                continue;
            }
            if ((m = /^state\s+'([^']+)'\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i.exec(t))) {
                var alabel2 = m[1]; var aid2 = m[2];
                ensureEntity(aid2, alabel2, 'box', alabel2);
                continue;
            }

            // decorator: state Id <<choice|fork|join>>  and unknown
            if ((m = /^state\s+([A-Za-z_][A-Za-z0-9_]*)\s+<<\s*([^>]+?)\s*>>\s*$/.exec(t))) {
                var did = m[1]; var typ = m[2].trim().toLowerCase();
                if (typ === 'choice' || typ === 'fork' || typ === 'join') {
                    ensureEntity(did, did, typ, null);
                } else {
                    warnings.push({ line: ln, msg: 'unknown <<' + m[2] + '>> dropped' });
                    ensureEntity(did, did, 'box', null);
                }
                continue;
            }

            // inline note: note right of X : text   left as well, case-insensitive, optional spaces
            if ((m = /^note\s+(left|right)\s+of\s+([A-Za-z_][A-Za-z0-9_\[\]\*]+)\s*:\s*(.*)$/i.exec(t))) {
                var side = m[1].toLowerCase(); var anchor = m[2]; var txt = m[3];
                // strip trailing spaces
                txt = String(txt).trim();
                // anchor must be a valid id or [*]?? spec says right of X where X is state id; [*] not expected.
                // ensure anchor entity exists if not star
                if (anchor !== '[*]') {
                    if (BARE_ID_RE.test(anchor)) ensureEntity(anchor, anchor, 'box', null);
                    else warnings.push({ line: ln, msg: 'note anchor "' + anchor + '" is not a bare id' });
                }
                var nid = nextNoteId();
                var noteEnt = { id: nid, name: txt.slice(0, 24) || 'Note', alias: null, shape: 'note', stereo: null, members: [txt], anchor: anchor, noteSide: side, x: null, y: null, w: 0, h: 0 };
                byId[nid] = noteEnt;
                data.entities.push(noteEnt);
                markTaken(nid);
                if (stack.length) {
                    var topN = stack[stack.length - 1];
                    if (topN.members.indexOf(nid) < 0) topN.members.push(nid);
                }
                continue;
            }
            // block note start: note right of X  (no colon)
            if ((m = /^note\s+(left|right)\s+of\s+([A-Za-z_][A-Za-z0-9_\[\]\*]+)\s*$/i.exec(t))) {
                var bside = m[1].toLowerCase(); var banchor = m[2];
                var collected = [];
                var found = false;
                var endIdx = -1;
                for (var kj = li + 1; kj < lines.length; kj++) {
                    var nxtRaw = lines[kj];
                    var nxtTrim = nxtRaw.trim();
                    if (/^end\s+note\s*$/i.test(nxtTrim)) { found = true; endIdx = kj; break; }
                    collected.push(nxtTrim);
                }
                if (!found) {
                    errors.push({ line: ln, msg: 'unterminated note block; missing "end note"' });
                    continue;
                }
                // join collected lines: normalized per-line trimmed, blank lines kept as empty
                var blockText = collected.join('\n');
                // trim outer blank lines
                blockText = blockText.replace(/^\n+|\n+$/g, '').trim();
                // normalize leading/trailing whitespace per line already trimmed
                if (blockText === '') blockText = '';
                if (banchor !== '[*]' && BARE_ID_RE.test(banchor)) ensureEntity(banchor, banchor, 'box', null);
                var bnid = nextNoteId();
                var bnote = { id: bnid, name: (blockText.split('\n')[0] || 'Note').slice(0, 24), alias: null, shape: 'note', stereo: null, members: [blockText], anchor: banchor, noteSide: bside, x: null, y: null, w: 0, h: 0 };
                byId[bnid] = bnote;
                data.entities.push(bnote);
                markTaken(bnid);
                if (stack.length) {
                    var topB = stack[stack.length - 1];
                    if (topB.members.indexOf(bnid) < 0) topB.members.push(bnid);
                }
                li = endIdx; // consume block
                continue;
            }

            // transition: A --> B : label  (also allow ->)
            if ((m = /^(\[\*\]|[A-Za-z_][A-Za-z0-9_]*)\s*-+>\s*(\[\*\]|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(.*))?$/.exec(t))) {
                var leftTok = m[1]; var rightTok = m[2]; var lab = m[3] != null ? String(m[3]).trim() : '';
                if (leftTok === '[*]' && rightTok === '[*]') {
                    errors.push({ line: ln, msg: '[*] --> [*] is not allowed' });
                    continue;
                }
                var fromId, toId;
                if (leftTok === '[*]') {
                    fromId = ensureStar('start').id;
                } else {
                    fromId = ensureEntity(leftTok, leftTok, 'box', null).id;
                }
                if (rightTok === '[*]') {
                    toId = ensureStar('stop').id;
                } else {
                    toId = ensureEntity(rightTok, rightTok, 'box', null).id;
                }
                // label may contain quotes; keep as is
                data.rels.push({ id: nextRelId(), from: fromId, to: toId, kind: 'trans', cardA: '', cardB: '', label: lab });
                continue;
            }

            // description: A : text
            if ((m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(t))) {
                var did2 = m[1]; var desc = m[2].trim();
                if (!BARE_ID_RE.test(did2)) { warnings.push({ line: ln, msg: 'description id "' + did2 + '" invalid' }); continue; }
                var ent = ensureEntity(did2, did2, 'box', null);
                ent.members.push(desc);
                continue;
            }

            // fallback: unknown line
            warnings.push({ line: ln, msg: 'line ignored: "' + t.slice(0, 32) + '"' });
        }

        if (stack.length) {
            warnings.push({ line: lines.length, msg: 'composite "' + stack[stack.length - 1].id + '" not closed' });
        }
        return { data: data, errors: errors, warnings: warnings };
    }

    // ------------------------------------------------------------------
    // Gen
    // ------------------------------------------------------------------
    function genState(doc) {
        var d = doc || {};
        var ents = Array.isArray(d.entities) ? d.entities : [];
        var rels = Array.isArray(d.rels) ? d.rels : [];
        var containers = Array.isArray(d.containers) ? d.containers : [];
        var dir = d.dir || 'TB';
        var byId = {};
        for (var i = 0; i < ents.length; i++) if (ents[i] && ents[i].id != null) byId[ents[i].id] = ents[i];

        function isNote(e) { return e && e.shape === 'note'; }
        function isDecorator(e) { return e && (e.shape === 'choice' || e.shape === 'fork' || e.shape === 'join'); }
        function disp(id) {
            var e = byId[id];
            if (!e) return id;
            if (e.shape === 'start' || e.shape === 'stop') return '[*]';
            return e.id;
        }
        var aliasLines = [];
        for (var i = 0; i < ents.length; i++) {
            var e = ents[i];
            if (!e) continue;
            if (e.alias != null && e.alias !== '' && e.shape !== 'note' && e.shape !== 'start' && e.shape !== 'stop') {
                aliasLines.push('state "' + escQuote(e.alias) + '" as ' + e.id);
            }
        }
        var allMemberSet = {};
        for (var ci = 0; ci < containers.length; ci++) {
            var c = containers[ci];
            if (!c || !Array.isArray(c.members)) continue;
            for (var mi = 0; mi < c.members.length; mi++) allMemberSet[c.members[mi]] = true;
        }
        function isInnerRel(r) {
            for (var ci = 0; ci < containers.length; ci++) {
                var c = containers[ci];
                if (!c || !Array.isArray(c.members)) continue;
                if (c.members.indexOf(r.from) >= 0 && c.members.indexOf(r.to) >= 0) return true;
            }
            return false;
        }

        var L = ['stateDiagram-v2'];
        if (dir !== 'TB') L.push('direction ' + dir);
        var hasContent = aliasLines.length || containers.length || ents.length || rels.length;
        if (hasContent) L.push('');

        for (var ai = 0; ai < aliasLines.length; ai++) L.push(aliasLines[ai]);
        var needSep = aliasLines.length > 0;

        // containers (input order)
        for (var ci = 0; ci < containers.length; ci++) {
            var c = containers[ci];
            if (!c) continue;
            if (needSep) L.push('');
            needSep = true;
            var header;
            if (c.title && c.title !== c.id) header = 'state "' + escQuote(c.title) + '" as ' + c.id + ' {';
            else header = 'state ' + c.id + ' {';
            L.push(header);
            if (c.dir && c.dir !== 'TB') L.push('    direction ' + c.dir);
            // inner decorators in members order
            for (var mi = 0; mi < c.members.length; mi++) {
                var e = byId[c.members[mi]];
                if (isDecorator(e)) L.push('    state ' + e.id + ' <<' + e.shape + '>>');
            }
            // inner descriptions
            for (var mi = 0; mi < c.members.length; mi++) {
                var e2 = byId[c.members[mi]];
                if (!e2 || !e2.members || !e2.members.length) continue;
                if (e2.shape === 'note' || e2.shape === 'start' || e2.shape === 'stop') continue;
                if (isDecorator(e2) && false) continue;
                for (var di = 0; di < e2.members.length; di++) {
                    var txt = String(e2.members[di]);
                    if (!txt) continue;
                    L.push('    ' + e2.id + ' : ' + txt);
                }
            }
            // inner notes
            for (var mi2 = 0; mi2 < c.members.length; mi2++) {
                var ne = byId[c.members[mi2]];
                if (!isNote(ne)) continue;
                var ntxt = ne.members[0] || '';
                if (ntxt.indexOf('\n') >= 0) {
                    L.push('    note ' + ne.noteSide + ' of ' + ne.anchor);
                    var parts = ntxt.split('\n');
                    for (var pi = 0; pi < parts.length; pi++) L.push('    ' + parts[pi]);
                    L.push('    end note');
                } else {
                    L.push('    note ' + ne.noteSide + ' of ' + ne.anchor + ' : ' + ntxt);
                }
            }
            // inner transitions in input order filtered
            for (var ri = 0; ri < rels.length; ri++) {
                var r = rels[ri];
                if (!r) continue;
                if (c.members.indexOf(r.from) >= 0 && c.members.indexOf(r.to) >= 0) {
                    var lab = r.label ? ' : ' + r.label : '';
                    L.push('    ' + disp(r.from) + ' --> ' + disp(r.to) + lab);
                }
            }
            L.push('}');
        }

        // outer descriptions
        var outerDescs = [];
        for (var i = 0; i < ents.length; i++) {
            var e3 = ents[i];
            if (!e3) continue;
            if (allMemberSet[e3.id]) continue;
            if (isNote(e3) || e3.shape === 'start' || e3.shape === 'stop' || isDecorator(e3)) continue;
            if (!e3.members || !e3.members.length) continue;
            for (var di2 = 0; di2 < e3.members.length; di2++) {
                var t2 = String(e3.members[di2]);
                if (!t2) continue;
                outerDescs.push(e3.id + ' : ' + t2);
            }
        }
        if (outerDescs.length) {
            if (needSep) L.push('');
            needSep = true;
            for (var k = 0; k < outerDescs.length; k++) L.push(outerDescs[k]);
        }

        // outer decorators
        var outerDecos = [];
        for (var i = 0; i < ents.length; i++) {
            var e4 = ents[i];
            if (!e4) continue;
            if (allMemberSet[e4.id]) continue;
            if (isDecorator(e4)) outerDecos.push('state ' + e4.id + ' <<' + e4.shape + '>>');
        }
        if (outerDecos.length) {
            if (needSep) L.push('');
            needSep = true;
            for (var k = 0; k < outerDecos.length; k++) L.push(outerDecos[k]);
        }

        // outer notes
        var outerNotes = [];
        for (var i = 0; i < ents.length; i++) {
            var e5 = ents[i];
            if (!isNote(e5)) continue;
            if (allMemberSet[e5.id]) continue;
            var ntxt2 = e5.members[0] || '';
            if (ntxt2.indexOf('\n') >= 0) {
                outerNotes.push('note ' + e5.noteSide + ' of ' + e5.anchor);
                var p2 = ntxt2.split('\n');
                for (var pi2 = 0; pi2 < p2.length; pi2++) outerNotes.push(p2[pi2]);
                outerNotes.push('end note');
            } else {
                outerNotes.push('note ' + e5.noteSide + ' of ' + e5.anchor + ' : ' + ntxt2);
            }
        }
        if (outerNotes.length) {
            if (needSep) L.push('');
            needSep = true;
            for (var k = 0; k < outerNotes.length; k++) L.push(outerNotes[k]);
        }

        // outer transitions
        var outerRels = [];
        for (var ri2 = 0; ri2 < rels.length; ri2++) {
            var r2 = rels[ri2];
            if (!r2) continue;
            if (isInnerRel(r2)) continue;
            outerRels.push(r2);
        }
        if (outerRels.length) {
            if (needSep) L.push('');
            needSep = true;
            for (var ri3 = 0; ri3 < outerRels.length; ri3++) {
                var rr = outerRels[ri3];
                var ll = rr.label ? ' : ' + rr.label : '';
                L.push(disp(rr.from) + ' --> ' + disp(rr.to) + ll);
            }
        }

        return L.join('\n');
    }

    function statsState(doc) {
        var d = doc || {};
        var n = Array.isArray(d.entities) ? d.entities.length : 0;
        var m = Array.isArray(d.rels) ? d.rels.length : 0;
        return n + ' states \u00b7 ' + m + ' transitions';
    }

    function emptyState() {
        return {
            dir: 'TB',
            entities: [
                { id: 'Idle', name: 'Idle', alias: null, shape: 'box', stereo: null, members: ['waiting'], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 },
                { id: 'Active', name: 'Active', alias: null, shape: 'box', stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 },
                { id: '__start', name: '[*]', alias: null, shape: 'start', stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 },
                { id: '__stop', name: '[*]', alias: null, shape: 'stop', stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 }
            ],
            rels: [
                { id: 'r1', from: '__start', to: 'Idle', kind: 'trans', cardA: '', cardB: '', label: '' },
                { id: 'r2', from: 'Idle', to: 'Active', kind: 'trans', cardA: '', cardB: '', label: 'activate' },
                { id: 'r3', from: 'Active', to: '__stop', kind: 'trans', cardA: '', cardB: '', label: '' }
            ],
            containers: []
        };
    }

    // ------------------------------------------------------------------
    // Templates (must all be round-trip stable)
    // ------------------------------------------------------------------
    var TEMPLATES = [
        {
            key: 'vending-machine',
            name: '\uD83C\uDF6B Vending Machine',
            src: [
                'stateDiagram-v2',
                '',
                'state VendingMachine {',
                '    direction LR',
                '    state sel <<choice>>',
                '    idle : Idle awaiting coins',
                '    coinsIn : Coins inserted',
                '    dispense : Dispensing product',
                '    note right of coinsIn : amount validated',
                '    note left of sel',
                '        validate selection',
                '        then branch',
                '    end note',
                '    [*] --> idle',
                '    idle --> coinsIn : insert coin',
                '    coinsIn --> sel',
                '    sel --> dispense : valid',
                '    sel --> returnCoin : invalid',
                '    dispense --> [*]',
                '    returnCoin --> [*]',
                '}'
            ].join('\n')
        },
        {
            key: 'traffic-light',
            name: '\uD83D\uDEA6 Traffic Light',
            src: [
                'stateDiagram-v2',
                '',
                'state Lights {',
                '    direction LR',
                '    red : Stop traffic',
                '    green : Allow traffic',
                '    yellow : Prepare to stop',
                '    red --> green : timer',
                '    green --> yellow : timer',
                '    yellow --> red : timer',
                '}',
                '',
                'off : Power off',
                'note right of red : cycle repeats',
                '[*] --> red',
                'off --> red : power on',
                'red --> off : power off',
                'red --> [*]'
            ].join('\n')
        },
        {
            key: 'media-player',
            name: '\u25B6 Media Player',
            src: [
                'stateDiagram-v2',
                '',
                'state "Playing Media" as P1',
                '',
                'idle : Ready to play',
                'P1 : Media is playing',
                'paused : Playback paused',
                'stopped : Playback stopped',
                'audio : Audio track active',
                'video : Video track active',
                'state F1 <<fork>>',
                'state J1 <<join>>',
                'note right of P1 : streaming active',
                'note left of paused',
                '    buffer retained',
                '    while paused',
                'end note',
                '[*] --> idle',
                'idle --> P1 : play',
                'P1 --> paused : pause',
                'paused --> P1 : resume',
                'P1 --> stopped : stop',
                'paused --> stopped : stop',
                'stopped --> [*]',
                'P1 --> F1',
                'F1 --> audio',
                'F1 --> video',
                'audio --> J1',
                'video --> J1',
                'J1 --> stopped'
            ].join('\n')
        }
    ];

    window.MSMODES = window.MSMODES || {};
    window.MSMODES.state = {
        id: 'state',
        tab: '\u2699\uFE0F State',
        empty: emptyState,
        parse: parseState,
        gen: genState,
        stats: statsState,
        templates: TEMPLATES,
        boardCfg: {
            dialect: 'state',
            defaultRel: 'trans',
            palette: [
                { key: 'state', label: 'State', hint: 'new state box' },
                { key: 'start', label: 'Start', hint: '[*] entry' },
                { key: 'stop', label: 'Stop', hint: '[*] terminal' },
                { key: 'choice', label: 'Choice', hint: '<<choice>>' },
                { key: 'fork', label: 'Fork', hint: '<<fork>>' },
                { key: 'join', label: 'Join', hint: '<<join>>' },
                { key: 'note', label: 'Note', hint: 'attached note' }
            ]
        }
    };
})();
