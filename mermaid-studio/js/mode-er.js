/*
 * mode-er.js — 🗄 ER canvas mode for Mermaid Studio.
 *
 * Implements the erDiagram subset of docs/ENTITY_MODES_PLAN.md §3.2 (as
 * corrected by the integrator): attribute blocks; identifying (--) vs
 * non-identifying (..) relations; cardinality spellings from EITHER side
 * normalized so cardA describes FROM and cardB TO; left side emits
 * |o || }o }| and the right side its mirror o| || o{ |{ (never o} or |}).
 * Quoted entity names are unsupported: they warn and fold into a
 * sanitized UPPER_SNAKE entity; gen never emits quoted names.
 *
 * Classic script, IIFE-wrapped, attaches only window.MSMODES.er.
 * parse/gen are pure string logic (Node-vm safe: no document/window reads).
 */
(function () {
    'use strict';

    var BARE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var TYPE_RE = /^[A-Za-z_][A-Za-z0-9_]*(\([^()]*\))?$/;
    var ER_KEYS = { PK: 1, FK: 1, UK: 1 };
    var DIRS = { LR: 1, TB: 1, RL: 1, BT: 1 };

    // Written spelling → semantic code stored on the doc (left/as-is form).
    // Left-side spellings pass through; right-side mirrored spellings and a
    // few tolerated mixes are folded onto their left-form equivalent, so a
    // token found before the line describes FROM and one after it describes TO.
    var CARD_SEMANTIC = {
        '|o': '|o', '||': '||', '}o': '}o', '}|': '}|',   // left-form spellings
        'o|': '|o', 'o{': '}o', 'o}': '}o',               // right-side mirrored
        '|{': '}|', '|}': '}|', '{|': '|o'                // tolerated mixes
    };
    // Semantic code → how it is written on the RIGHT of the relation line
    // (mirrored per mermaid's er syntax: A ||--o{ B).
    var CARD_MIRROR = { '|o': 'o|', '||': '||', '}o': 'o{', '}|': '|{' };
    var KIND_OF_LINE = { '--': 'id', '..': 'nonid' };
    var LINE_OF_KIND = { id: '--', nonid: '..' };

    var ENT_SRC = '("([^"]*)"|([A-Za-z_][A-Za-z0-9_]*))';
    var CARD_SRC = '((?:[|}o{]{2})?)';
    var REL_RE = new RegExp('^' + ENT_SRC + '[ \\t]*' + CARD_SRC + '[ \\t]*(--|\\.\\.)[ \\t]*' + CARD_SRC + '[ \\t]*' + ENT_SRC + '(?:[ \\t]*:[ \\t]*(.*))?$');
    var OPEN_RE = new RegExp('^' + ENT_SRC + '[ \\t]*\\{$');
    var NAME_RE = new RegExp('^' + ENT_SRC + '$');

    function normWs(s) {
        return String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim();
    }

    // ENT group layout at base index i: m[i] full token, m[i+1] quoted inner,
    // m[i+2] bare word. Returns sanitized UPPER_SNAKE bare id.
    function sanitizeEntName(name) {
        var s = String(name == null ? '' : name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
        if (!s) s = 'ENTITY';
        if (/^[0-9]/.test(s)) s = '_' + s;
        return s;
    }

    function parseEr(srcText) {
        var data = { dir: 'LR', entities: [], rels: [], containers: [] };
        var errors = [];
        var warnings = [];
        var lines = String(srcText == null ? '' : srcText).split(/\r?\n/);
        var byName = {};
        var takenIds = {};
        var relTaken = {};
        var autoSeq = 0;
        var relSeq = 0;
        var sawHeader = false;
        var inBlock = null;

        function nextAutoId() {
            var id;
            do { autoSeq++; id = 'O' + autoSeq; } while (takenIds[id]);
            takenIds[id] = true;
            return id;
        }
        function nextRelId() {
            var id;
            do { relSeq++; id = 'r' + relSeq; } while (relTaken[id]);
            relTaken[id] = true;
            return id;
        }
        function entName(m, i, ln) {
            var raw;
            var wasQuoted = false;
            if (m[i + 1] != null && m[i + 1] !== '') { raw = m[i + 1]; wasQuoted = true; }
            else raw = m[i + 2] || '';
            if (wasQuoted) {
                var san = sanitizeEntName(raw);
                warnings.push({ line: ln, msg: 'quoted entity name "' + raw + '" not supported; using ' + san });
                return san;
            }
            return raw;
        }
        function ensureEntity(name) {
            var e = byName[name];
            if (e) return e;
            var id;
            if (BARE_ID_RE.test(name)) {
                id = name;
                var n = 1;
                while (takenIds[id]) { n++; id = name + '_' + n; }
            } else {
                id = nextAutoId();
            }
            takenIds[id] = true;
            e = { id: id, name: name, alias: null, shape: 'box', stereo: null, members: [], anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 };
            byName[name] = e;
            data.entities.push(e);
            return e;
        }

        // `type name [KEYS] ["comment"]` → canonical row string, or null.
        function attrRow(t, ln) {
            var q1 = t.indexOf('"');
            var comment = null;
            var prefix = t;
            var tail = '';
            if (q1 >= 0) {
                prefix = t.slice(0, q1);
                var q2 = t.indexOf('"', q1 + 1);
                if (q2 < 0) {
                    tail = t.slice(q1 + 1);
                    warnings.push({ line: ln, msg: 'unterminated comment quote; dropped' });
                } else {
                    comment = normWs(t.slice(q1 + 1, q2));
                    tail = t.slice(q2 + 1);
                }
            }
            var extra = normWs(tail);
            if (extra) warnings.push({ line: ln, msg: 'role words after comment dropped ("' + extra.slice(0, 24) + '")' });
            var toks = prefix.split(/\s+/).filter(Boolean);
            if (toks.length < 2) {
                warnings.push({ line: ln, msg: 'attribute row needs a type and a name; ignored' });
                return null;
            }
            var type = toks[0];
            var name = toks[1];
            if (!TYPE_RE.test(type)) {
                warnings.push({ line: ln, msg: 'unsupported attribute type "' + type + '"; row ignored' });
                return null;
            }
            if (!BARE_ID_RE.test(name)) {
                warnings.push({ line: ln, msg: 'bad attribute name "' + name + '"; row ignored' });
                return null;
            }
            var keys = [];
            for (var ki = 2; ki < toks.length; ki++) {
                var parts = toks[ki].split(',');
                for (var pi = 0; pi < parts.length; pi++) {
                    var k = parts[pi].trim().toUpperCase();
                    if (!k) continue;
                    if (ER_KEYS[k]) {
                        if (keys.indexOf(k) < 0) keys.push(k);
                    } else {
                        warnings.push({ line: ln, msg: 'attribute key "' + k + '" not in PK/FK/UK; dropped' });
                    }
                }
            }
            if (comment != null) comment = comment.replace(/"/g, "'");
            return type + ' ' + name + (keys.length ? ' ' + keys.join(',') : '') + (comment ? ' "' + comment + '"' : '');
        }

        for (var li = 0; li < lines.length; li++) {
            var t = normWs(lines[li]);
            var ln = li + 1;
            if (!t || t.indexOf('%%') === 0) continue;
            if (!sawHeader) {
                if (/^erDiagram\s*$/i.test(t)) { sawHeader = true; continue; }
                errors.push({ line: ln, msg: 'expected an "erDiagram" header first' });
                return { data: data, errors: errors, warnings: warnings };
            }
            if (inBlock) {
                if (t === '}') { inBlock = null; continue; }
                if (/^direction\b/i.test(t)) {
                    warnings.push({ line: ln, msg: 'nested direction ignored' });
                    continue;
                }
                var rowOut = attrRow(t, ln);
                if (rowOut != null) inBlock.members.push(rowOut);
                continue;
            }
            var m;
            if ((m = /^direction\s+(\S+)$/i.exec(t))) {
                var dv = m[1].toUpperCase();
                data.dir = dv;
                if (!DIRS[dv]) warnings.push({ line: ln, msg: 'unknown direction "' + m[1] + '" kept' });
                continue;
            }
            if (/^note\b/i.test(t)) {
                warnings.push({ line: ln, msg: 'notes are not part of ER diagrams; line dropped' });
                continue;
            }
            if ((m = OPEN_RE.exec(t))) {
                var nm = entName(m, 1, ln);
                if (nm) inBlock = ensureEntity(nm);
                else warnings.push({ line: ln, msg: 'empty entity name; ignored' });
                continue;
            }
            if (t === '{') {
                warnings.push({ line: ln, msg: 'orphan "{" ignored' });
                continue;
            }
            if (t === '}') {
                warnings.push({ line: ln, msg: 'unexpected "}" ignored' });
                continue;
            }
            if ((m = NAME_RE.exec(t))) {
                var nm2 = entName(m, 1, ln);
                var nj = li + 1;
                while (nj < lines.length) {
                    var nt = normWs(lines[nj]);
                    if (!nt || nt.indexOf('%%') === 0) { nj++; continue; }
                    break;
                }
                if (nm2 && nj < lines.length && normWs(lines[nj]) === '{') {
                    inBlock = ensureEntity(nm2);
                    li = nj; // the '{' line is consumed next iteration
                    continue;
                }
                warnings.push({ line: ln, msg: 'entity "' + (nm2 || '?') + '" named without an attribute block; ignored' });
                continue;
            }
            if ((m = REL_RE.exec(t))) {
                var fromE = ensureEntity(entName(m, 1, ln));
                var toE = ensureEntity(entName(m, 7, ln));
                var ca = CARD_SEMANTIC[m[4]];
                var cb = CARD_SEMANTIC[m[6]];
                if (m[4] && !ca) {
                    ca = '';
                    warnings.push({ line: ln, msg: 'unrecognized cardinality "' + m[4] + '" dropped' });
                }
                if (m[6] && !cb) {
                    cb = '';
                    warnings.push({ line: ln, msg: 'unrecognized cardinality "' + m[6] + '" dropped' });
                }
                var label = m[10] != null ? normWs(m[10]) : '';
                if (label.length > 1 && label.charAt(0) === '"' && label.charAt(label.length - 1) === '"') {
                    label = normWs(label.slice(1, -1)).replace(/"/g, "'");
                } else {
                    label = label.replace(/"/g, "'");
                }
                data.rels.push({
                    id: nextRelId(),
                    from: fromE.id,
                    to: toE.id,
                    kind: KIND_OF_LINE[m[5]] || 'id',
                    cardA: ca || '',
                    cardB: cb || '',
                    label: label
                });
                continue;
            }
            if (t.indexOf('--') >= 0 || t.indexOf('..') >= 0) {
                errors.push({ line: ln, msg: 'cannot parse relation "' + t.slice(0, 32) + '"' });
                continue;
            }
            warnings.push({ line: ln, msg: 'line ignored' });
        }
        if (!sawHeader) {
            errors.push({ line: 1, msg: 'expected an "erDiagram" header first' });
        } else if (inBlock) {
            warnings.push({ line: lines.length, msg: 'attribute block for "' + inBlock.name + '" not closed' });
        }
        return { data: data, errors: errors, warnings: warnings };
    }

    function dispOf(e) {
        return BARE_ID_RE.test(e.name) ? e.name : '"' + e.name + '"';
    }

    function genEr(doc) {
        var d = doc || {};
        var ents = Array.isArray(d.entities) ? d.entities : [];
        var rels = Array.isArray(d.rels) ? d.rels : [];
        var L = ['erDiagram'];
        if (d.dir && d.dir !== 'LR') L.push('direction ' + String(d.dir));
        var byId = {};
        var i;
        for (i = 0; i < ents.length; i++) {
            if (ents[i] && ents[i].id != null) byId[ents[i].id] = ents[i];
        }
        // Only entities that carry attribute rows emit blocks; bare mentions
        // are inferred by mermaid from the relations that reference them.
        var blocks = ents.filter(function (e) {
            return !!(e && e.name && Array.isArray(e.members) && e.members.length > 0);
        });
        blocks.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
        if (blocks.length) {
            L.push('');
            for (i = 0; i < blocks.length; i++) {
                var e = blocks[i];
                L.push(dispOf(e) + ' {');
                for (var mi = 0; mi < e.members.length; mi++) {
                    L.push('  ' + normWs(e.members[mi]));
                }
                L.push('}');
            }
        }
        if (rels.length) {
            if (blocks.length) L.push('');
            for (i = 0; i < rels.length; i++) {
                var r = rels[i];
                var f = r ? byId[r.from] : null;
                var tt = r ? byId[r.to] : null;
                if (!f || !tt) continue;
                var s = dispOf(f) + ' ' + (r.cardA || '') +
                    (LINE_OF_KIND[r.kind] || '--') +
                    (CARD_MIRROR[r.cardB] !== undefined ? CARD_MIRROR[r.cardB] : (r.cardB || '')) +
                    ' ' + dispOf(tt);
                var lab = normWs(r.label).replace(/"/g, "'");
                // mermaid erDiagram requires ` : label` — even ` : ""` for empty, otherwise parse error `Expecting COLON`
                if (lab) s += ' : ' + (/\s/.test(lab) ? '"' + lab + '"' : lab);
                else s += ' : ""';
                L.push(s);
            }
        }
        return L.join('\n');
    }

    function statsEr(doc) {
        var d = doc || {};
        var n = Array.isArray(d.entities) ? d.entities.length : 0;
        var m = Array.isArray(d.rels) ? d.rels.length : 0;
        return n + ' entities · ' + m + ' relationships';
    }

    function mkEnt(id, members) {
        return { id: id, name: id, alias: null, shape: 'box', stereo: null, members: members, anchor: null, noteSide: null, x: null, y: null, w: 0, h: 0 };
    }

    function emptyDoc() {
        return {
            dir: 'LR',
            entities: [
                mkEnt('CUSTOMER', ['string id PK', 'varchar(120) email UK', 'varchar(60) full_name']),
                mkEnt('ORDER', ['string id PK', 'string customer_id FK', 'decimal(10,2) total', 'datetime placed_at'])
            ],
            rels: [{ id: 'r1', from: 'CUSTOMER', to: 'ORDER', kind: 'id', cardA: '||', cardB: '}o', label: 'places' }],
            containers: []
        };
    }

    var TEMPLATES = [
        {
            key: 'ecommerce', name: '🛒 E-commerce orders',
            src: [
                'erDiagram',
                '',
                'CUSTOMER {',
                '  string id PK',
                '  varchar(120) email UK "login handle"',
                '  varchar(40) phone',
                '  datetime created_at',
                '}',
                'ORDER {',
                '  string id PK',
                '  string customer_id FK',
                '  decimal(10,2) total',
                '  text shipping_address',
                '}',
                'ORDER_ITEM {',
                '  string id PK',
                '  string order_id FK',
                '  string product_id FK',
                '  int quantity',
                '}',
                'PRODUCT {',
                '  string sku PK "unique stock code"',
                '  varchar(40) title',
                '  decimal(10,2) price',
                '  int stock_qty',
                '}',
                'SUPPLIER {',
                '  string id PK',
                '  varchar(40) company_name UK "legal name"',
                '  varchar(40) country',
                '}',
                '',
                'CUSTOMER ||--o{ ORDER : places',
                'ORDER ||--|{ ORDER_ITEM : contains',
                'ORDER_ITEM }|--|| PRODUCT : references',
                'PRODUCT }o..o{ SUPPLIER : stocked-by'
            ].join('\n')
        },
        {
            key: 'blog', name: '📝 Blog content',
            src: [
                'erDiagram',
                '',
                'COMMENT {',
                '  string id PK',
                '  string post_id FK',
                '  string author_id FK',
                '  text body',
                '  datetime created_at',
                '}',
                'POST {',
                '  string id PK',
                '  string author_id FK',
                '  varchar(200) title',
                '  text body',
                '  boolean published',
                '}',
                'TAG {',
                '  string id PK',
                '  varchar(40) slug UK "url-friendly tag"',
                '  varchar(80) label',
                '}',
                'USER {',
                '  string id PK',
                '  varchar(80) username UK "login handle"',
                '  varchar(120) email UK',
                '}',
                '',
                'USER ||--o{ POST : writes',
                'POST }o..o{ TAG : tagged',
                'POST ||--o{ COMMENT : has'
            ].join('\n')
        },
        {
            key: 'clinic', name: '🏥 Clinic schedule',
            src: [
                'erDiagram',
                'direction TB',
                '',
                'APPOINTMENT {',
                '  string id PK',
                '  string patient_id FK',
                '  string doctor_id FK',
                '  datetime scheduled_at',
                '  varchar(40) status "booked, checked-in, done"',
                '}',
                'DOCTOR {',
                '  string id PK',
                '  varchar(80) full_name UK',
                '  varchar(40) specialty',
                '}',
                'TREATMENT_ROOM {',
                '  string id PK',
                '  varchar(40) room_label UK',
                '  int capacity',
                '}',
                'PATIENT {',
                '  string id PK',
                '  varchar(80) full_name',
                '  date date_of_birth',
                '  varchar(40) phone',
                '}',
                '',
                'APPOINTMENT }|--|| PATIENT : for',
                'DOCTOR ||--o{ APPOINTMENT : holds',
                'APPOINTMENT |o--o| TREATMENT_ROOM : assigned-to'
            ].join('\n')
        }
    ];

    window.MSMODES = window.MSMODES || {};
    window.MSMODES.er = {
        id: 'er',
        tab: '🗄 ER',
        empty: emptyDoc,
        parse: parseEr,
        gen: genEr,
        stats: statsEr,
        templates: TEMPLATES,
        boardCfg: {
            dialect: 'er',
            defaultRel: 'id',
            palette: [
                { key: 'entity', label: 'Entity', hint: 'new entity' },
                { key: 'attr-hint', label: 'Tip', hint: 'dbl-click to add attribute rows' }
            ],
            emptyStatsHint: 'drag between entity rims to relate them'
        }
    };
})();
