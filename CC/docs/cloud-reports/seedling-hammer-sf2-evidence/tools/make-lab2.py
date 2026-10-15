# SCRATCH (seedling-hammer-sf2 D1): instrument the LAB copy's `deriveStrike` (never the tracked tree). SF's make-lab,
# re-cut for SF2: the bounded pass's measured-ETA arm (`measuredPair`) gains a lab knob (`STRIKE_ETA_FLOOR.lab`) and
# every derivation runs every variant below in rotating order; the run follows SF_FOLLOW (default `off`) and the shadow
# variants' instrument counts are restored.
#   off            the switch OFF (the base)
#   floor          the admissible floor alone
#   a              SF's shape a (floor + measured ETA, forty kept pairs, previews uncapped)
#   b              SF's shape b (forty distinct cells previewed) — run ONLY at continuation (admission) derivations:
#                  the (d) shapes are b there and another variant elsewhere, composed in the census script
#   cf<K>          (c) a, but past K previews an unknown cell's pair is admitted by the admissible floor alone
#   cs<K>          (c) a, but the pass STOPS where the (K+1)-th preview would be needed
#   co<K>          (c′) a, but past K previews an unknown cell's pair is admitted by OFF's floor (`minTicksBetween`):
#                  K = 0 is OFF's collection exactly
# usage: make-lab2.py <lab>/…/solverBot.js
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, old[:80])
    s = s.replace(old, new)

rep("export function deriveStrike(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {",
    "function deriveStrikeCore(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {")
rep("""        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        return out;
    };""", """        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        globalThis.__SF_WALK?.(run, cell, out);
        return out;
    };""")
# the lab knob in the bounded pass's measured arm
rep("""    const measuredPair = (i, c, mine) => {
        const known = walks.get(c);
        if (known !== undefined && walkRefuses(known, i)) { etaSkipped += 1; return false; }
        if (!opportunityAt(i, c, mine)) return false;
        if (known === undefined) {
            scanned += 1;""", """    const LAB = STRIKE_ETA_FLOOR.lab ?? null;
    const measuredPair = (i, c, mine) => {
        const known = walks.get(c);
        if (known !== undefined && walkRefuses(known, i)) { etaSkipped += 1; return false; }
        if (known === undefined && LAB !== null) {
            if (LAB.shape === 'floor') return opportunityAt(i, c, mine);
            if (LAB.shape === 'cf' && scanned >= LAB.K) return opportunityAt(i, c, mine);
            if (LAB.shape === 'co' && scanned >= LAB.K) {
                if (i - 1 < minTicksBetween(run.state, c)) { labCapSkipped += 1; return false; }
                return opportunityAt(i, c, mine);
            }
        }
        if (!opportunityAt(i, c, mine)) return false;
        if (known === undefined) {
            if (LAB !== null && ((LAB.shape === 'cs' && scanned >= LAB.K)
                || (LAB.shape === 'b' && scanned >= STRIKE_CANDIDATES))) { labStop = true; return false; }
            scanned += 1;""")
rep("""    let scanned = 0;
    let etaSkipped = 0;""", """    let scanned = 0;
    let etaSkipped = 0;
    let labStop = false;
    let labCapSkipped = 0;""")
rep("""            for (const c of cells) {
                // ⛔ BEFORE the truncation, never after: a candidate the movement
                // model provably cannot reach must not consume one of the forty.
                if (i - 1 < floor.get(c)) { unreachable += 1; continue; }
                if (keep(i, c, mine)) opportunities.push({ i, cell: c });
            }""", """            for (const c of cells) {
                // ⛔ BEFORE the truncation, never after: a candidate the movement
                // model provably cannot reach must not consume one of the forty.
                if (i - 1 < floor.get(c)) { unreachable += 1; continue; }
                if (keep(i, c, mine)) opportunities.push({ i, cell: c });
                if (labStop) break;
            }""")
rep("""            for (const c of inReach) {
                if (i - 1 < floor.get(c)) continue;
                if (keep(i, c, mine)) opportunities.push({ i, cell: c });
            }
        }
        if (opportunities.length >= STRIKE_CANDIDATES) { stoppedAt = i; break; }""", """            for (const c of inReach) {
                if (i - 1 < floor.get(c)) continue;
                if (keep(i, c, mine)) opportunities.push({ i, cell: c });
                if (labStop) break;
            }
        }
        if (labStop) { stoppedAt = i; break; }
        if (opportunities.length >= STRIKE_CANDIDATES && LAB?.shape !== 'b') { stoppedAt = i; break; }""")

WRAP = r'''
// ── SF2 LAB (seedling-hammer-sf2 D1, scratch only) ──
const SF_LAB = globalThis.process?.env?.SF_LAB ?? '';
const SF_FOLLOW = globalThis.process?.env?.SF_FOLLOW ?? 'off';
const SF_VARIANTS = (globalThis.process?.env?.SF_VARIANTS ?? 'off,floor,a,b,cf4,cf8,cf16,cs4,cs8,cs16,co2,co4,co8,co16')
    .split(',');
const sfKnob = (v) => {
    if (v === 'off') return { enabled: false, lab: undefined };
    if (v === 'a') return { enabled: true, lab: undefined };
    if (v === 'floor' || v === 'b') return { enabled: true, lab: { shape: v } };
    const m = /^(cf|cs|co)(\d+)$/.exec(v);
    if (!m) throw new Error(`SF2 lab: unknown variant ${v}`);
    return { enabled: true, lab: { shape: m[1], K: Number(m[2]) } };
};
let SF_N = 0;
function sfSnapCounts() {
    return [PRESS_KILL_COST_COUNTS, STRIKE_SCAN_COST_COUNTS, PRESS_KILL_BOMBS_COUNTS, REFUGE_ETA_CUT_COUNTS]
        .map((o) => [o, JSON.parse(JSON.stringify(o))]);
}
function sfRestoreCounts(snap) {
    for (const [o, v] of snap) { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, v); }
}
const sfRes = (r) => (r === null ? null : r.cell === null ? { cell: null, considered: r.considered, unreachable: r.unreachable,
    truncated: r.truncated } : { cell: [r.cell.x, r.cell.y], pressAt: r.pressAt, eta: r.eta, cont: r.fromContinuation ? 1 : 0,
    considered: r.considered, uncert: r.escape === 'uncertified' ? 1 : 0 });
export function deriveStrike(run, bodyId, contacts, notBefore = 0, opts = {}) {
    if (SF_LAB === 'count') { globalThis.__SF_LAB_SINK?.({ n: SF_N++, t: run.ticksCompleted, body: bodyId }); }
    if (SF_LAB !== 'census') return deriveStrikeCore(run, bodyId, contacts, notBefore, opts);
    const n = SF_N++;
    const vs = SF_VARIANTS.filter((v) => v !== 'b' || opts.continuation);
    const k = n % vs.length;
    const order = vs.slice(k).concat(vs.slice(0, k));
    const was = { enabled: STRIKE_ETA_FLOOR.enabled, lab: STRIKE_ETA_FLOOR.lab };
    const snap = sfSnapCounts();
    const rec = { n, t: run.ticksCompleted, body: bodyId, cont: opts.continuation ? 1 : 0, nb: notBefore, V: {} };
    let followed = null; let followErr = null; let followCounts = null;
    for (const v of order) {
        sfRestoreCounts(snap);
        Object.assign(STRIKE_ETA_FLOOR, sfKnob(v));
        let previews = 0;
        globalThis.__SF_WALK = (r) => { if (r === run) previews += 1; };
        let res = null; let err = null;
        const t0 = performance.now();
        try { res = deriveStrikeCore(run, bodyId, contacts, notBefore, opts); } catch (e) { err = e; }
        const ms = performance.now() - t0;
        globalThis.__SF_WALK = undefined;
        rec.V[v] = { res: err ? { threw: String(err?.message).slice(0, 120) } : sfRes(res), ms: +ms.toFixed(2), previews };
        if (v === SF_FOLLOW) { followed = res; followErr = err; followCounts = sfSnapCounts(); }
    }
    STRIKE_ETA_FLOOR.enabled = was.enabled; STRIKE_ETA_FLOOR.lab = was.lab;
    sfRestoreCounts(followCounts);
    globalThis.__SF_LAB_SINK?.(rec);
    if (followErr) throw followErr;
    return followed;
}
'''
rep("/**\n * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate:",
    WRAP + "\n/**\n * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate:")
open(p, 'w').write(s)
print('ok')
