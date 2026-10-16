#!/usr/bin/env python3
# SCRATCH (seedling-hammer-wc D1): instrument a COPY of solverBot.js / levelRun.js (never the tracked tree).
#   make-lab-wc.py <tree>
# With WC_LAB=1 the lab records, per deriveStrike call, the walk previews by source (bounded pass / walk loop /
# continuation), their samples and wall time, strikeEscape's time, and the REUSE BOUND: for every strike-sourced
# preview, whether an earlier preview IN THE SAME KILL to the same cell, under the same stepper inputs, already walked
# the new start state (index 0 = a repeat, k > 0 = a suffix), and whether its trajectory / its full samples equal the
# new ones. Records go to $WC_LAB_OUT (one JSON line per derivation, plus a summary line per process).
import sys, re
root = sys.argv[1]
sb = f"{root}/frontend/modules/seedlingDemo/solverBot.js"
lr = f"{root}/frontend/modules/seedlingDemo/levelRun.js"

def sub(src, old, new, count=1):
    n = src.count(old)
    assert n == count, f"expected {count} of {old[:70]!r}, found {n}"
    return src.replace(old, new)

s = open(sb).read()

LAB = r'''
// ════════ SCRATCH LAB (seedling-hammer-wc D1) — never committed ════════
const WCL = globalThis.__WCL ??= {
    on: globalThis.process?.env?.WC_LAB === '1', src: 'other', kill: 0, killScope: null, deriv: null, recs: [],
    trail: null, wantKey: false, stepKey: null, byCaller: {}, esc: { n: 0, ms: 0 }, derivMs: 0, killMs: 0,
};
function wcStr(v) {
    if (v === null || v === undefined) return String(v);
    if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (typeof v !== 'object') return typeof v === 'function' ? 'fn' : JSON.stringify(v);
    if (v instanceof Set) return 'S[' + [...v].map(String).sort().join(',') + ']';
    if (v instanceof Map) return 'M[' + [...v].map(([k, x]) => wcStr(k) + '=' + wcStr(x)).join(',') + ']';
    if (Array.isArray(v)) return '[' + v.map(wcStr).join(',') + ']';
    let o = '{' + Object.keys(v).sort().map((k) => k + ':' + wcStr(v[k])).join(',');
    for (const sy of Object.getOwnPropertySymbols(v)) o += ',' + String(sy) + ':' + wcStr(v[sy]);
    return o + '}';
}
function wcHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const wcStateHash = (st) => wcHash(wcStr(st));
const wcSampleSig = (sm) => `${sm.x},${sm.y},${wcStr(sm.held)},${sm.wp}`;
const wcEntitySig = (sm) => wcHash(wcStr([sm.arrows, sm.chasers, sm.spits ?? null, sm.grenades ?? null]));
const wcEntityFree = (walk) => walk.samples.every((sm) => sm.arrows === null && sm.chasers === null
    && sm.spits === undefined && sm.grenades === undefined);
function wcBucket(d, src) {
    return d.by[src] ??= { n: 0, samples: 0, msBody: 0, msWalkTo: 0, repeat: 0, repeatSamples: 0, suffix: 0,
        suffixSamples: 0, invalid: 0, fullEqualSamples: 0, entityFreeSamples: 0, reusableSamples: 0,
        prevDerivSamples: 0, crossKill: 0 };
}
/** the reuse analysis of one strike-sourced preview, against the kill's earlier previews to the same cell */
function wcReuse(run, cell, walk, trail, bucket) {
    const scope = WCL.killScope;
    if (scope === null) return;
    const key = `${cell.x},${cell.y}|${WCL.stepKey}`;
    const sigs = walk.samples.map(wcSampleSig);
    const ents = walk.samples.map(wcEntitySig);
    const free = wcEntityFree(walk);
    const start = wcStateHash(run.state);
    if (free) bucket.entityFreeSamples += sigs.length;
    const list = scope.byKey.get(key) ?? [];
    let found = null;
    for (const e of list) {
        const k = e.index.get(start);
        if (k !== undefined) { found = { e, k }; break; }
    }
    if (found !== null) {
        const { e, k } = found;
        const old = e.sigs.slice(k);
        const same = old.length === sigs.length && old.every((x, j) => x === sigs[j])
            && e.trunc === (walk.truncated?.kind ?? null);
        if (!same) bucket.invalid += 1;
        else {
            if (k === 0) { bucket.repeat += 1; bucket.repeatSamples += sigs.length; }
            else { bucket.suffix += 1; bucket.suffixSamples += sigs.length; }
            const oldEnts = e.ents.slice(k);
            const fullEq = oldEnts.every((x, j) => x === ents[j]);
            if (fullEq) bucket.fullEqualSamples += sigs.length;
            if (free) bucket.reusableSamples += sigs.length;
            if (e.deriv === WCL.deriv.id - 1 || e.deriv === WCL.deriv.prevId) bucket.prevDerivSamples += sigs.length;
        }
    }
    const index = new Map();
    trail.forEach((h, j) => { if (!index.has(h)) index.set(h, j); });
    list.push({ index, sigs, ents, trunc: walk.truncated?.kind ?? null, deriv: WCL.deriv.id });
    scope.byKey.set(key, list);
}
if (WCL.on && !WCL.exitHooked) {
    WCL.exitHooked = true;
    globalThis.process.on('exit', () => {
        const out = globalThis.process.env.WC_LAB_OUT;
        if (!out) return;
        const fs = globalThis.process.getBuiltinModule('node:fs');
        const lines = WCL.recs.map((r) => JSON.stringify({ pid: globalThis.process.pid, ...r }));
        lines.push(JSON.stringify({ pid: globalThis.process.pid, summary: true, byCaller: WCL.byCaller, esc: WCL.esc,
            derivMs: WCL.derivMs, killMs: WCL.killMs }));
        fs.appendFileSync(out, lines.join('\n') + '\n');
    });
}
export function previewWalk(run, wps, tolerance = 0, opts = {}) {
    if (!WCL.on) return previewWalkBody(run, wps, tolerance, opts);
    const src = WCL.src;
    const strikeSrc = src.startsWith('strike:');
    const prevTrail = WCL.trail;
    const prevWant = WCL.wantKey;
    WCL.trail = strikeSrc ? [] : null;
    WCL.wantKey = strikeSrc;
    WCL.src = 'nested';
    const t0 = performance.now();
    let out;
    let trail;
    try {
        out = previewWalkBody(run, wps, tolerance, opts);
    } finally {
        const ms = performance.now() - t0;
        trail = WCL.trail;
        WCL.trail = prevTrail;
        WCL.wantKey = prevWant;
        WCL.src = src;
        const b = WCL.byCaller[src] ??= { n: 0, samples: 0, ms: 0 };
        b.n += 1; b.ms += ms; b.samples += out?.samples?.length ?? 0;
        WCL.lastBodyMs = ms;
    }
    if (strikeSrc) WCL.lastTrail = trail;
    return out;
}
// ════════ /SCRATCH LAB ════════
'''

s = sub(s, "export function previewWalk(run, wps, tolerance = 0,", LAB + "\nfunction previewWalkBody(run, wps, tolerance = 0,")
# the pre-step state of every transit sample (the suffix rule's index)
s = sub(s, """            if (strike) bodiesForPolicy = (chasers ? chasers.bodies() : null) ?? [];
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            truncated = lethalFloorOf(st);
            if (truncated) break;
            if (st.transition) {
                // A crossing ends the preview""", """            if (strike) bodiesForPolicy = (chasers ? chasers.bodies() : null) ?? [];
            if (WCL.trail) WCL.trail.push(wcStateHash(st));
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            truncated = lethalFloorOf(st);
            if (truncated) break;
            if (st.transition) {
                // A crossing ends the preview""")
# walkTo: the source, the body's and the danger loop's time, the reuse analysis
s = sub(s, """    const walkTo = (cell) => {
        if (walks.has(cell)) return walks.get(cell);
        const walk = previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE);""",
"""    const walkTo = (cell, wcSrc = 'strike:?') => {
        if (walks.has(cell)) return walks.get(cell);
        const wcPrev = WCL.src;
        WCL.src = wcSrc;
        const wcT0 = performance.now();
        const walk = previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE);
        WCL.src = wcPrev;""")
s = sub(s, """        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        return out;
    };""", """        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        if (WCL.on && WCL.deriv) {
            const b = wcBucket(WCL.deriv, wcSrc);
            b.n += 1; b.samples += walk.samples.length; b.msBody += WCL.lastBodyMs;
            b.msWalkTo += performance.now() - wcT0;
            wcReuse(run, cell, walk, WCL.lastTrail, b);
        }
        return out;
    };""")
s = sub(s, "if (walkRefuses(walkTo(c), i)) { etaSkipped += 1; return false; }",
           "if (walkRefuses(walkTo(c, 'strike:pass'), i)) { etaSkipped += 1; return false; }")
s = sub(s, "const { walk, unsafe } = walkTo(o.cell);", "const { walk, unsafe } = walkTo(o.cell, 'strike:walk');")
s = sub(s, "const { walk, eta, unsafe } = walkTo(c);", "const { walk, eta, unsafe } = walkTo(c, 'strike:cont');")
# deriveStrike: one record per call
s = sub(s, "export function deriveStrike(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {",
"""export function deriveStrike(run, bodyId, contacts, notBefore = 0, o = {}) {
    if (!WCL.on) return deriveStrikeBody(run, bodyId, contacts, notBefore, o);
    const prev = WCL.deriv;
    const id = (WCL.derivN = (WCL.derivN ?? 0) + 1);
    WCL.stepKey = null;
    const d = WCL.deriv = { id, prevId: WCL.lastDerivInKill ?? null, kill: WCL.kill, t: run.ticksCompleted,
        cont: o.continuation === true, by: {}, escN: 0, escMs: 0, state: wcStateHash(run.state),
        hits: (run.ledger('spinnerPressHits') ?? []).length, body: bodyId, notBefore,
        floor: STRIKE_ETA_FLOOR.enabled };
    const t0 = performance.now();
    let out;
    try {
        out = deriveStrikeBody(run, bodyId, contacts, notBefore, o);
    } finally {
        d.ms = performance.now() - t0;
        WCL.derivMs += d.ms;
        d.stepKey = WCL.stepKey;
        d.cell = out?.cell ? `${out.cell.x},${out.cell.y}@${out.pressAt}` : null;
        WCL.recs.push(d);
        WCL.deriv = prev;
        if (prev === null) WCL.lastDerivInKill = id;
    }
    return out;
}
function deriveStrikeBody(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {""")
s = sub(s, "function strikeEscape(run, { cell, i, eta, walk, mine, bodyId, caller }) {",
"""function strikeEscape(run, o) {
    if (!WCL.on) return strikeEscapeBody(run, o);
    const t0 = performance.now();
    try {
        return strikeEscapeBody(run, o);
    } finally {
        const ms = performance.now() - t0;
        WCL.esc.n += 1; WCL.esc.ms += ms;
        if (WCL.deriv) { WCL.deriv.escN += 1; WCL.deriv.escMs += ms; }
    }
}
function strikeEscapeBody(run, { cell, i, eta, walk, mine, bodyId, caller }) {""")
s = sub(s, "export function deriveRefuge(run, contacts, untilIndex) {",
"""export function deriveRefuge(run, contacts, untilIndex) {
    if (!WCL.on) return deriveRefugeBody(run, contacts, untilIndex);
    const prev = WCL.src;
    WCL.src = 'refuge';
    try { return deriveRefugeBody(run, contacts, untilIndex); } finally { WCL.src = prev; }
}
function deriveRefugeBody(run, contacts, untilIndex) {""")
s = sub(s, "function execKillByPressOnce(run, perTick, resolved, ctx) {",
"""function execKillByPressOnce(run, perTick, resolved, ctx) {
    if (!WCL.on) return execKillByPressOnceBody(run, perTick, resolved, ctx);
    const prevScope = WCL.killScope;
    const prevKill = WCL.kill;
    WCL.kill = (WCL.killN = (WCL.killN ?? 0) + 1);
    WCL.killScope = { byKey: new Map() };
    WCL.lastDerivInKill = null;
    const t0 = performance.now();
    try { return execKillByPressOnceBody(run, perTick, resolved, ctx); } finally {
        WCL.killMs += performance.now() - t0;
        WCL.killScope = prevScope; WCL.kill = prevKill; }
}
function execKillByPressOnceBody(run, perTick, resolved, ctx) {""")
open(sb, 'w').write(s)

l = open(lr).read()
l = sub(l, "            const damageAtStart = { ...damage };",
"""            const damageAtStart = { ...damage };
            // SCRATCH LAB (seedling-hammer-wc D1): what this stepper reads, for the reuse key
            const wcl = globalThis.__WCL;
            if (wcl?.on && wcl.wantKey) {
                const { level: _w, ...rest } = opts;
                const ids = wcl.worldIds ??= new WeakMap();
                if (!ids.has(world)) ids.set(world, (wcl.worldN = (wcl.worldN ?? 0) + 1));
                wcl.stepKey = `w${ids.get(world)}:` + globalThis.__WCLHASH(globalThis.__WCLSTR(
                    { rest, iFrame, damageAtStart, pulls: pullsFor(level), fidelity: globalThis.__WCLFID?.() ?? null }));
            }""")
open(lr, 'w').write(l)

# the stepper key helpers + the fidelity switches, exposed from the lab's solverBot
s = open(sb).read()
s = sub(s, "// ════════ /SCRATCH LAB ════════",
        "globalThis.__WCLSTR = wcStr; globalThis.__WCLHASH = wcHash;\n"
        "globalThis.__WCLFID = () => ({ ...CONTACT_FIDELITY });\n// ════════ /SCRATCH LAB ════════")
open(sb, 'w').write(s)
print("lab OK")
