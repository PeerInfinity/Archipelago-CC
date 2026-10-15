# SCRATCH (seedling-hammer-sf D2): instrument the LAB copy's `deriveStrike` (never the tracked tree). SC's make-lab,
# re-cut for SF's switch: every derivation runs four variants of the scan — OFF (the base floor), `floor` (the
# admissible floor alone), `a` (floor + measured ETA, forty kept pairs) and `b` (floor + measured ETA, forty distinct
# cells previewed) — in rotating order, and the run follows SF_FOLLOW (default `off`). The instrument counts of the
# shadow variants are restored, so the run is the followed variant's.   usage: make-lab.py <lab>/…/solverBot.js
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

WRAP = r'''
// ── SF LAB (seedling-hammer-sf D2, scratch only) ──
const SF_LAB = globalThis.process?.env?.SF_LAB ?? '';
const SF_FOLLOW = globalThis.process?.env?.SF_FOLLOW ?? 'off';
const SF_VARIANTS = ['off', 'floor', 'a', 'b'];
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
    // SF_LAB=count: only count the derivations (which producers reach `deriveStrike` at all)
    if (SF_LAB === 'count') { globalThis.__SF_LAB_SINK?.({ n: SF_N++, t: run.ticksCompleted, body: bodyId }); }
    if (SF_LAB !== 'census') return deriveStrikeCore(run, bodyId, contacts, notBefore, opts);
    const n = SF_N++;
    const k = n % SF_VARIANTS.length;
    const order = SF_VARIANTS.slice(k).concat(SF_VARIANTS.slice(0, k));
    const was = { enabled: STRIKE_ETA_FLOOR.enabled, shape: STRIKE_ETA_FLOOR.shape };
    const snap = sfSnapCounts();
    const rec = { n, t: run.ticksCompleted, body: bodyId, cont: opts.continuation ? 1 : 0, nb: notBefore,
        v0: [run.state.vx ?? 0, run.state.vy ?? 0], ice: run.state.hazard?.onIce ? 1 : 0, V: {} };
    const walkSeen = new Map();
    const floorOn = strikeEtaFloorOf(run);
    let followed = null; let followErr = null; let followCounts = null;
    for (const v of order) {
        sfRestoreCounts(snap);
        STRIKE_ETA_FLOOR.enabled = v !== 'off';
        STRIKE_ETA_FLOOR.shape = v === 'off' ? undefined : v;
        let previews = 0;
        globalThis.__SF_WALK = (r, cell, out) => {
            if (r !== run) return;
            previews += 1;
            const key = `${cell.x},${cell.y}`;
            if (!walkSeen.has(key)) walkSeen.set(key, { eta: out.eta, trunc: out.walk.truncated ? 1 : 0,
                fOff: minTicksBetween(run.state, cell), fOn: floorOn(cell) });
        };
        let res = null; let err = null;
        const t0 = performance.now();
        try { res = deriveStrikeCore(run, bodyId, contacts, notBefore, opts); } catch (e) { err = e; }
        const ms = performance.now() - t0;
        globalThis.__SF_WALK = undefined;
        rec.V[v] = { res: err ? { threw: String(err?.message).slice(0, 120) } : sfRes(res), ms: +ms.toFixed(2), previews,
            scanned: res?.scanned ?? null, etaSkipped: res?.etaSkipped ?? null };
        if (v === SF_FOLLOW) { followed = res; followErr = err; followCounts = sfSnapCounts(); }
    }
    STRIKE_ETA_FLOOR.enabled = was.enabled; STRIKE_ETA_FLOOR.shape = was.shape;
    sfRestoreCounts(followCounts);
    // admissibility over every arrived preview of every variant (one per cell: the walk does not depend on the variant)
    const w = { arrived: 0, underOff: 0, maxOffMinusEta: null, underOn: 0, minEtaMinusOn: null, worst: null };
    for (const [key, x] of walkSeen) {
        if (x.trunc) continue;
        w.arrived += 1;
        if (x.eta < x.fOff) w.underOff += 1;
        if (x.eta < x.fOn) { w.underOn += 1; w.worst = { key, ...x }; }
        if (w.maxOffMinusEta === null || x.fOff - x.eta > w.maxOffMinusEta) w.maxOffMinusEta = x.fOff - x.eta;
        if (w.minEtaMinusOn === null || x.eta - x.fOn < w.minEtaMinusOn) w.minEtaMinusOn = x.eta - x.fOn;
    }
    rec.w = w;
    globalThis.__SF_LAB_SINK?.(rec);
    if (followErr) throw followErr;
    return followed;
}
'''
rep("/**\n * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate:",
    WRAP + "\n/**\n * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate:")
open(p, 'w').write(s)
print('ok')
