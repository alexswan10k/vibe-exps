"use strict";
/* ============================================================
   Modular Synth — patch model helpers.
   Pure data functions: jack ids, cable validation, patch files.
   No DOM, no audio. Loaded by smoke-test.mjs.
   ============================================================ */

/**
 * Jack ids are `<moduleId>-in-<portId>` / `<moduleId>-out-<portId>`.
 * Module ids are slugified so they can never contain "-in-" / "-out-",
 * which makes the id format reversible with a single lastIndexOf.
 */
function makeJackId(moduleId, dir, portId) {
    return moduleId + "-" + dir + "-" + portId;
}

/** Returns {moduleId, dir, portId} or null if not a jack id. */
function parseJackId(id) {
    if (typeof id !== "string") return null;
    for (const marker of ["-in-", "-out-"]) {
        const idx = id.lastIndexOf(marker);
        if (idx > 0) {
            return {
                moduleId: id.slice(0, idx),
                dir: marker === "-in-" ? "in" : "out",
                portId: id.slice(idx + marker.length),
            };
        }
    }
    return null;
}

function slugifyModuleId(raw) {
    return String(raw)
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 40);
}

/** Lowest unused `<type>_<n>` id for this type, e.g. oscillator -> oscillator_1. */
function nextModuleId(type, modules) {
    const used = new Set(modules.map((m) => m.id));
    for (let n = 1; ; n++) {
        const candidate = type + "_" + n;
        if (!used.has(candidate)) return candidate;
    }
}

/** Control values keyed by id, filled in from the module definition. */
function defaultControls(type) {
    const def = MODULE_DEFS[type];
    const out = {};
    if (!def) return out;
    for (const c of def.controls) out[c.id] = c.default;
    return out;
}

function defaultSteps() {
    const steps = [];
    for (let i = 0; i < SEQUENCER_STEPS; i++) steps.push({ gate: 0, cv: 0.5 });
    return steps;
}

function makeModule(type, id, x, y, controls) {
    return {
        id,
        type,
        x: Math.round(x / RACK_GRID) * RACK_GRID,
        y: Math.round(y / RACK_GRID) * RACK_GRID,
        controls: controls || defaultControls(type),
    };
}

/* ---------- validation ---------- */

/**
 * Why a cable is invalid, or null if it is fine.
 * Returns a human-readable string so the UI can surface it directly.
 */
function cableProblem(cable, moduleById) {
    if (!cable || typeof cable.from !== "string" || typeof cable.to !== "string") {
        return "Cable endpoints are malformed.";
    }
    const from = parseJackId(cable.from);
    const to = parseJackId(cable.to);
    if (!from || !to) return "Cable endpoints are malformed.";
    if (from.dir !== "out") return "A cable has to start at an output.";
    if (to.dir !== "in") return "A cable has to end at an input.";

    const srcModule = moduleById[from.moduleId];
    const dstModule = moduleById[to.moduleId];
    if (!srcModule) return "Cable source module " + from.moduleId + " is missing.";
    if (!dstModule) return "Cable target module " + to.moduleId + " is missing.";

    const srcDef = MODULE_DEFS[srcModule.type];
    const dstDef = MODULE_DEFS[dstModule.type];
    if (!srcDef) return "Unknown module type \"" + srcModule.type + "\".";
    if (!dstDef) return "Unknown module type \"" + dstModule.type + "\".";

    if (!srcDef.outputs.some((p) => p.id === from.portId)) {
        return srcDef.name + " has no output called " + from.portId + ".";
    }
    if (!dstDef.inputs.some((p) => p.id === to.portId)) {
        return dstDef.name + " has no input called " + to.portId + ".";
    }
    if (from.moduleId === to.moduleId) {
        return "A module cannot be patched into itself.";
    }
    return null;
}

/** Can a patch in progress starting at `fromJackId` land on `toJackId`? */
function canPatch(fromJackId, toJackId) {
    const from = parseJackId(fromJackId);
    const to = parseJackId(toJackId);
    if (!from || !to) return false;
    if (from.dir === to.dir) return false;
    if (from.moduleId === to.moduleId) return false;
    return true;
}

/* ---------- patch files ---------- */

const PATCH_VERSION = 2;

function serializePatch(state) {
    return {
        version: PATCH_VERSION,
        modules: state.modules.map((m) => ({
            id: m.id,
            type: m.type,
            x: m.x,
            y: m.y,
            controls: { ...m.controls },
        })),
        cables: state.cables.map((c) => ({ id: c.id, from: c.from, to: c.to })),
        steps: state.steps,
        view: state.view ? { ...state.view } : undefined,
    };
}

/**
 * Validate and repair an untrusted patch file.
 * Returns { patch, errors }. Unknown module types and dangling cables are
 * dropped rather than thrown, so a bad file degrades instead of white-screening.
 */
function normalizePatch(raw) {
    const errors = [];
    const patch = { modules: [], cables: [], steps: {}, view: null };

    if (!raw || typeof raw !== "object") {
        return { patch, errors: ["That file is not a patch."] };
    }

    if (!Array.isArray(raw.modules)) {
        return { patch, errors: ["That file has no modules array."] };
    }

    const seenIds = new Set();
    for (const m of raw.modules) {
        const type = m && m.type;
        if (!MODULE_DEFS[type]) {
            errors.push("Skipped unknown module type \"" + String(type) + "\".");
            continue;
        }
        let id = slugifyModuleId(m.id) || nextModuleId(type, patch.modules);
        while (seenIds.has(id)) id = nextModuleId(type, patch.modules);
        seenIds.add(id);

        const controls = defaultControls(type);
        if (m.controls && typeof m.controls === "object") {
            for (const c of MODULE_DEFS[type].controls) {
                const rawValue = m.controls[c.id];
                if (typeof rawValue === "number" && isFinite(rawValue)) {
                    controls[c.id] = c.type === "switch" ? (rawValue ? 1 : 0) : clamp01(rawValue);
                }
            }
        }
        patch.modules.push({
            id,
            type,
            x: Number.isFinite(m.x) ? m.x : 40,
            y: Number.isFinite(m.y) ? m.y : 40,
            controls,
        });
    }

    const moduleById = {};
    for (const m of patch.modules) moduleById[m.id] = m;

    const seenCables = new Set();
    if (Array.isArray(raw.cables)) {
        raw.cables.forEach((c, i) => {
            const problem = cableProblem(c, moduleById);
            if (problem) {
                errors.push("Dropped cable " + (i + 1) + ": " + problem);
                return;
            }
            const key = c.from + ">" + c.to;
            if (seenCables.has(key)) return;
            seenCables.add(key);
            patch.cables.push({ id: c.id || "c_" + (patch.cables.length + 1), from: c.from, to: c.to });
        });
    }

    if (raw.steps && typeof raw.steps === "object") {
        for (const m of patch.modules) {
            if (m.type !== "sequencer") continue;
            const incoming = raw.steps[m.id];
            patch.steps[m.id] = Array.isArray(incoming)
                ? normaliseSteps(incoming)
                : defaultSteps();
        }
    } else {
        for (const m of patch.modules) {
            if (m.type === "sequencer") patch.steps[m.id] = defaultSteps();
        }
    }

    if (raw.view && Number.isFinite(raw.view.x) && Number.isFinite(raw.view.y) && Number.isFinite(raw.view.k)) {
        patch.view = {
            x: raw.view.x,
            y: raw.view.y,
            k: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw.view.k)),
        };
    }

    return { patch, errors };
}

function normaliseSteps(incoming) {
    const steps = defaultSteps();
    for (let i = 0; i < SEQUENCER_STEPS; i++) {
        const s = incoming[i];
        if (!s || typeof s !== "object") continue;
        steps[i] = {
            gate: s.gate ? 1 : 0,
            cv: clamp01(Number.isFinite(s.cv) ? s.cv : 0.5),
        };
    }
    return steps;
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}