/*
 * mode-journey.js — 🧭 User Journey canvas for Mermaid Studio.
 * Implements the `journey` subset of https://mermaid.js.org/syntax/userJourney.html
 *   journey
 *     title My working day
 *     section Go to work
 *       Make tea: 5: Me
 *       Go upstairs: 3: Me
 *       Do work: 1: Me, Cat
 * Scores are 0-5 (int, clamped), actors are comma-separated labels.
 * Classic script, IIFE-wrapped, attaches only window.MSMODES.journey.
 * parse/gen are pure string logic (Node-vm safe: no document/window reads
 * except final registration).
 */
(function () {
    'use strict';

    var HEADER = 'journey';

    function trim(s) { return String(s == null ? '' : s).trim(); }
    function normWs(s) { return String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim(); }

    function sanitizeLabel(s) {
        // Journey task / section names cannot contain ':', '#', ';' or newline
        // in mermaid's lexer ( [^#:\n;]+ ). Replace them with space.
        return normWs(String(s == null ? '' : s).replace(/[:#;]/g, ' ').replace(/\r?\n/g, ' '));
    }
    function sanitizeActor(s) {
        return sanitizeLabel(s);
    }
    function clampScore(n) {
        var v = parseInt(n, 10);
        if (isNaN(v)) return 3;
        if (v < 0) return 0;
        if (v > 5) return 5;
        return v;
    }

    function parseJourney(srcText) {
        var data = { title: '', sections: [] };
        var errors = [];
        var warnings = [];
        var lines = String(srcText == null ? '' : srcText).split(/\r?\n/);
        var sawHeader = false;
        var curSec = null;

        function ensureSection(name, ln) {
            var n = sanitizeLabel(name);
            if (!n) {
                warnings.push({ line: ln, msg: 'empty section name ignored' });
                return null;
            }
            var sec = { name: n, tasks: [] };
            data.sections.push(sec);
            curSec = sec;
            return sec;
        }

        for (var li = 0; li < lines.length; li++) {
            var raw = lines[li];
            var t = trim(raw);
            var ln = li + 1;
            if (!t || t.indexOf('%%') === 0) continue;
            if (!sawHeader) {
                if (/^journey\s*$/i.test(t)) { sawHeader = true; continue; }
                errors.push({ line: ln, msg: 'expected a "journey" header first' });
                return { data: data, errors: errors, warnings: warnings };
            }
            var m;
            if ((m = /^title\s+(.*)$/i.exec(t))) {
                data.title = trim(m[1]);
                continue;
            }
            if ((m = /^section\s+(.+)$/i.exec(t))) {
                ensureSection(m[1], ln);
                continue;
            }
            if (/^accTitle\s*:/i.test(t) || /^accDescr\s*(\{| :)/i.test(t) || /^accDescr\s*:/i.test(t)) {
                warnings.push({ line: ln, msg: t.split(/\s|:/)[0] + ' ignored' });
                // multiline accDescr block: skip until }
                if (/^accDescr\s*\{\s*$/i.test(t)) {
                    for (var k = li + 1; k < lines.length; k++) {
                        if (/^\s*\}\s*$/.test(lines[k])) { li = k; break; }
                    }
                }
                continue;
            }
            // task line:  label : score [: actors]
            // mermaid allows any chars except : # ; newline in label
            // We tolerate leading spaces already trimmed; task label may contain spaces and unicode.
            if (t.indexOf(':') >= 0) {
                // split on first colon, then try to parse remainder as score/actors
                var colon = t.indexOf(':');
                var labelPart = trim(t.slice(0, colon));
                var rest = trim(t.slice(colon + 1));
                if (!labelPart) {
                    warnings.push({ line: ln, msg: 'empty task name ignored' });
                    continue;
                }
                if (labelPart.indexOf('#') >= 0 || labelPart.indexOf(';') >= 0) {
                    warnings.push({ line: ln, msg: 'task label contained #/; — sanitized' });
                    labelPart = sanitizeLabel(labelPart);
                } else {
                    labelPart = sanitizeLabel(labelPart);
                }
                if (!rest) {
                    warnings.push({ line: ln, msg: 'task "' + labelPart + '" missing score; defaulted to 3' });
                    if (!curSec) curSec = ensureSection('Untitled', ln) || { name: 'Untitled', tasks: [] };
                    if (curSec && data.sections.indexOf(curSec) === -1) data.sections.push(curSec);
                    curSec.tasks.push({ label: labelPart, score: 3, actors: [] });
                    continue;
                }
                // rest is like "5: Me, Cat" or "5" or "5 : Me"
                var scoreStr, actorStr;
                var c2 = rest.indexOf(':');
                if (c2 >= 0) {
                    scoreStr = trim(rest.slice(0, c2));
                    actorStr = trim(rest.slice(c2 + 1));
                } else {
                    scoreStr = trim(rest);
                    actorStr = '';
                }
                var sc = parseInt(scoreStr, 10);
                if (isNaN(sc)) {
                    warnings.push({ line: ln, msg: 'task "' + labelPart + '" has non-numeric score "' + scoreStr + '"; defaulted to 3' });
                    sc = 3;
                }
                if (sc < 0 || sc > 5) {
                    warnings.push({ line: ln, msg: 'score ' + sc + ' out of range 0-5; clamped' });
                    sc = clampScore(sc);
                }
                var actors = [];
                if (actorStr) {
                    actors = actorStr.split(',').map(function (a) { return sanitizeActor(trim(a)); }).filter(Boolean);
                }
                if (!curSec) {
                    curSec = ensureSection('Untitled', ln) || { name: 'Untitled', tasks: [] };
                    if (curSec && data.sections.indexOf(curSec) === -1) data.sections.push(curSec);
                }
                curSec.tasks.push({ label: labelPart, score: sc, actors: actors });
                continue;
            }
            warnings.push({ line: ln, msg: 'line ignored: "' + t.slice(0, 32) + '"' });
        }

        if (!sawHeader) errors.push({ line: 1, msg: 'expected a "journey" header first' });
        return { data: data, errors: errors, warnings: warnings };
    }

    function genJourney(doc) {
        var d = doc || {};
        var title = trim(d.title || '');
        var secs = Array.isArray(d.sections) ? d.sections : [];
        var L = ['journey'];
        if (title) L.push('    title ' + title.replace(/[\r\n]+/g, ' ').trim());
        for (var si = 0; si < secs.length; si++) {
            var sec = secs[si];
            if (!sec) continue;
            var secName = sanitizeLabel(sec.name || '');
            if (!secName) secName = 'Section ' + (si + 1);
            var tasks = Array.isArray(sec.tasks) ? sec.tasks : [];
            // skip empty sections that have no tasks? emit anyway for stability if name meaningful; but if truly empty and not first, keep
            L.push('    section ' + secName);
            for (var ti = 0; ti < tasks.length; ti++) {
                var t = tasks[ti];
                if (!t) continue;
                var lab = sanitizeLabel(t.label || '');
                if (!lab) lab = 'Task ' + (ti + 1);
                var sc = clampScore(t.score);
                var actors = Array.isArray(t.actors) ? t.actors.map(function (a) { return sanitizeActor(trim(a)); }).filter(Boolean) : [];
                var line = '      ' + lab + ': ' + sc + ': ' + actors.join(', ');
                // mermaid allows trailing ": " with empty actors? We emit with actor list (may be empty → trailing space trimmed)
                // Keep colon + space even when no actors for round-trip stability
                if (!actors.length) line = '      ' + lab + ': ' + sc;
                L.push(line);
            }
        }
        return L.join('\n');
    }

    function statsJourney(doc) {
        var d = doc || {};
        var secs = Array.isArray(d.sections) ? d.sections : [];
        var nTasks = 0;
        var actorSet = {};
        for (var i = 0; i < secs.length; i++) {
            var ts = secs[i].tasks || [];
            nTasks += ts.length;
            for (var j = 0; j < ts.length; j++) {
                var acts = ts[j].actors || [];
                for (var k = 0; k < acts.length; k++) actorSet[acts[k]] = true;
            }
        }
        var nActors = Object.keys(actorSet).length;
        return secs.length + ' section' + (secs.length === 1 ? '' : 's') + ' \u00B7 ' + nTasks + ' task' + (nTasks === 1 ? '' : 's') + ' \u00B7 ' + nActors + ' actor' + (nActors === 1 ? '' : 's');
    }

    function emptyJourney() {
        return {
            title: 'My working day',
            sections: [
                { name: 'Go to work', tasks: [
                    { label: 'Make tea', score: 5, actors: ['Me'] },
                    { label: 'Go upstairs', score: 3, actors: ['Me'] },
                    { label: 'Do work', score: 1, actors: ['Me', 'Cat'] }
                ] },
                { name: 'Go home', tasks: [
                    { label: 'Go downstairs', score: 5, actors: ['Me'] },
                    { label: 'Sit down', score: 5, actors: ['Me'] }
                ] }
            ]
        };
    }

    var TEMPLATES = [
        {
            key: 'work-day',
            name: '\u2615 Working day',
            src: [
                'journey',
                '    title My working day',
                '    section Go to work',
                '      Make tea: 5: Me',
                '      Go upstairs: 3: Me',
                '      Do work: 1: Me, Cat',
                '    section Go home',
                '      Go downstairs: 5: Me',
                '      Sit down: 5: Me'
            ].join('\n')
        },
        {
            key: 'shopping',
            name: '\uD83D\uDED2 Online shopping',
            src: [
                'journey',
                '    title Online shopping journey',
                '    section Discover',
                '      Browse catalogue: 4: Shopper',
                '      Compare items: 3: Shopper',
                '      Read reviews: 5: Shopper',
                '    section Purchase',
                '      Add to cart: 5: Shopper',
                '      Checkout: 2: Shopper',
                '      Payment: 1: Shopper, System',
                '    section Post-purchase',
                '      Order confirmation: 5: Shopper, System',
                '      Delivery updates: 4: Shopper'
            ].join('\n')
        },
        {
            key: 'health-visit',
            name: '\uD83C\uDFE5 Clinic visit',
            src: [
                'journey',
                '    title Patient clinic visit',
                '    section Before visit',
                '      Book appointment: 3: Patient',
                '      Receive reminder: 4: Patient, System',
                '      Travel to clinic: 2: Patient',
                '    section At clinic',
                '      Check in: 4: Patient, Reception',
                '      Wait: 1: Patient',
                '      See doctor: 5: Patient, Doctor',
                '    section After visit',
                '      Get prescription: 4: Patient',
                '      Follow-up message: 5: Patient, System'
            ].join('\n')
        }
    ];

    window.MSMODES = window.MSMODES || {};
    window.MSMODES.journey = {
        id: 'journey',
        tab: '\uD83E\uDDED Journey',
        kind: 'sheet',
        empty: emptyJourney,
        parse: parseJourney,
        gen: genJourney,
        stats: statsJourney,
        templates: TEMPLATES
    };
})();
