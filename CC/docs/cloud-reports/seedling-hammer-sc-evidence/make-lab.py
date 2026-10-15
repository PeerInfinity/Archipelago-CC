# SCRATCH (seedling-hammer-sc D2): instrument the LAB copy's `deriveStrike` (never the tracked tree).
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, old[:80])
    s = s.replace(old, new)

rep("export function deriveStrike(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {",
    "function deriveStrikeCore(run, bodyId, contacts, notBefore, continuation, floorOf, carriedStore, lab) {")
rep("const carried = STRIKE_SCAN_COST.enabled ? { run, book: undefined } : null;",
    "const carried = STRIKE_SCAN_COST.enabled ? { run, book: undefined, store: carriedStore } : null;")
rep("    const memo = CARRIED_LINES.get(run);", "    const memo = (carried.store ?? CARRIED_LINES).get(run);")
rep("    CARRIED_LINES.set(run, { world: run.world, key, book: carried.book });",
    "    (carried.store ?? CARRIED_LINES).set(run, { world: run.world, key, book: carried.book });")
rep("    const floor = new Map(cells.map((c) => [c, minTicksBetween(run.state, c)]));",
    "    const floor = new Map(cells.map((c) => [c, floorOf(run.state, c)]));")
# pair counting, bounded pass (both arms)
rep("""                if (i - 1 < floor.get(c)) { unreachable += 1; continue; }
                if (opportunityAt(i, c, mine)) opportunities.push({ i, cell: c });""",
    """                if (i - 1 < floor.get(c)) { unreachable += 1; continue; }
                lab.pairs += 1;
                if (opportunityAt(i, c, mine)) opportunities.push({ i, cell: c });""")
rep("""                if (i - 1 < floor.get(c)) continue;
                if (opportunityAt(i, c, mine)) opportunities.push({ i, cell: c });""",
    """                if (i - 1 < floor.get(c)) continue;
                lab.pairs += 1;
                if (opportunityAt(i, c, mine)) opportunities.push({ i, cell: c });""")
rep("""    const rejected = [];
    /**
     * ⛓ U4b D3 — WHAT A CELL'S WALK SAYS DOES NOT DEPEND ON THE TICK.""",
    """    Object.assign(lab, { stoppedAt, kept: opportunities, cells, floor, forecast, index, near, horizon, press,
        opportunityAt, dwellUnsafeAt, notBefore });
    const rejected = [];
    /**
     * ⛓ U4b D3 — WHAT A CELL'S WALK SAYS DOES NOT DEPEND ON THE TICK.""")
rep("""        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        return out;
    };""", """        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        return out;
    };
    lab.walks = walks;
    lab.walkTo = walkTo;""")
rep("""            if (i - 1 < floor.get(c)) continue;
            const known = walks.get(c);""", """            if (i - 1 < floor.get(c)) continue;
            lab.pairs += 1;
            lab.contPairs += 1;
            const known = walks.get(c);""")

WRAP = r'''
// ── SC LAB (seedling-hammer-sc D2, scratch only): the strike scan under the base floor and an admissible one ──
const SC_LAB = globalThis.process?.env?.SC_LAB ?? '';
const SC_VMAX = Number(globalThis.process?.env?.SC_VMAX ?? 1.6);
/** An admissible floor: per-axis speed < 2·moveSpeed (the threshold-then-add), the arrival tolerance taken off, and
 *  a faster incoming velocity honoured (above the cap nothing adds, friction only lowers it). */
function scFloorB(from, to) {
    const v = Math.max(SC_VMAX, Math.abs(from.vx ?? 0), Math.abs(from.vy ?? 0));
    return Math.ceil(Math.max(0, Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) - DEFAULT_TOLERANCE) / v);
}
const CARRIED_LINES_SHADOW = new WeakMap();
let SC_N = 0;
const scLab = () => ({ pairs: 0, contPairs: 0, walks: new Map() });
function scSnapCounts() {
    return [PRESS_KILL_COST_COUNTS, STRIKE_SCAN_COST_COUNTS, PRESS_KILL_BOMBS_COUNTS, REFUGE_ETA_CUT_COUNTS]
        .map((o) => [o, JSON.parse(JSON.stringify(o))]);
}
function scRestoreCounts(snap) {
    for (const [o, v] of snap) { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, v); }
}
const scRes = (r) => (r === null ? null : r.cell === null ? { cell: null, considered: r.considered, unreachable: r.unreachable,
    truncated: r.truncated } : { cell: [r.cell.x, r.cell.y], pressAt: r.pressAt, eta: r.eta, cont: r.fromContinuation ? 1 : 0,
    considered: r.considered, uncert: r.escape === 'uncertified' ? 1 : 0 });
function scWalkStats(run, lab, floorA, floorB) {
    const out = { n: 0, arrived: 0, trunc: 0, underA: 0, maxAminusEta: -Infinity, minEtaMinusB: Infinity, underB: 0,
        maxStep: 0, worst: null };
    for (const [c, w] of lab.walks) {
        out.n += 1;
        if (w.walk.truncated) { out.trunc += 1; continue; }
        out.arrived += 1;
        const fa = floorA(run.state, c); const fb = floorB(run.state, c);
        const eta = w.eta;
        if (eta < fa) out.underA += 1;
        if (eta < fb) out.underB += 1;
        if (fa - eta > out.maxAminusEta) { out.maxAminusEta = fa - eta; out.worst = { x: c.x, y: c.y, fa, fb, eta,
            cheb: Math.max(Math.abs(c.x - run.state.x), Math.abs(c.y - run.state.y)) }; }
        if (eta - fb < out.minEtaMinusB) out.minEtaMinusB = eta - fb;
        let px = run.state.x, py = run.state.y;
        for (const sm of w.walk.samples) {
            const d = Math.max(Math.abs(sm.x - px), Math.abs(sm.y - py));
            if (d > out.maxStep) out.maxStep = d;
            px = sm.x; py = sm.y;
        }
    }
    return out;
}
export function deriveStrike(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {
    if (SC_LAB === 'floorB') return deriveStrikeCore(run, bodyId, contacts, notBefore, continuation, scFloorB, CARRIED_LINES, scLab());
    if (SC_LAB !== 'census') return deriveStrikeCore(run, bodyId, contacts, notBefore, continuation, minTicksBetween, CARRIED_LINES, scLab());
    const n = SC_N++;
    const labA = scLab(); const labB = scLab();
    let resA; let resB; let errA = null; let errB = null; let tA = 0; let tB = 0;
    const runA = () => {
        const t0 = performance.now();
        try { resA = deriveStrikeCore(run, bodyId, contacts, notBefore, continuation, minTicksBetween, CARRIED_LINES, labA); }
        catch (e) { errA = e; }
        tA = performance.now() - t0;
    };
    const runB = () => {
        const snap = scSnapCounts();
        const t0 = performance.now();
        try { resB = deriveStrikeCore(run, bodyId, contacts, notBefore, continuation, scFloorB, CARRIED_LINES_SHADOW, labB); }
        catch (e) { errB = e; }
        tB = performance.now() - t0;
        scRestoreCounts(snap);
    };
    if (n % 2 === 0) { runA(); runB(); } else { runB(); runA(); }
    const rec = { n, t: run.ticksCompleted, body: bodyId, cont: continuation ? 1 : 0, nb: notBefore,
        v0: [run.state.vx ?? 0, run.state.vy ?? 0], cells: labA.cells?.length ?? null,
        A: { res: errA ? { threw: String(errA?.message).slice(0, 120) } : scRes(resA), ms: +tA.toFixed(2), pairs: labA.pairs,
            contPairs: labA.contPairs, previews: labA.walks.size, stoppedAt: labA.stoppedAt ?? null,
            kept: (labA.kept ?? []).map((o) => `${o.i}:${o.cell.x},${o.cell.y}`) },
        B: { res: errB ? { threw: String(errB?.message).slice(0, 120) } : scRes(resB), ms: +tB.toFixed(2), pairs: labB.pairs,
            contPairs: labB.contPairs, previews: labB.walks.size, stoppedAt: labB.stoppedAt ?? null,
            kept: (labB.kept ?? []).map((o) => `${o.i}:${o.cell.x},${o.cell.y}`) } };
    // the dropped (cell, tick) pairs over the base's bounded range: base floor skipped, admissible floor admits, a real
    // opportunity, and the full preview arrives in time (`reach`) — and also transit- and dwell-safe (`plan`)
    if (!errA && labA.opportunityAt) {
        const snap = scSnapCounts();
        let dropped = 0; let reach = 0; let plan = 0; let firstReach = null; let firstPlan = null;
        const end = Math.min(labA.stoppedAt, labA.horizon - labA.press.hitTicks - 2);
        try {
            for (let i = Math.max(1, notBefore); i <= end; i += 1) {
                const mine = labA.forecast[i + 1]?.[labA.index];
                if (!mine) continue;
                const list = (labA.near === null ? null : labA.near.cellsFor(mine)) ?? labA.cells;
                for (const c of list) {
                    const fa = labA.floor.get(c);
                    if (!(i - 1 < fa)) continue;
                    if (i - 1 < scFloorB(run.state, c)) continue;
                    if (!labA.opportunityAt(i, c, mine, { countSighted: false })) continue;
                    dropped += 1;
                    const w = labA.walkTo(c);
                    if (w.walk.truncated || w.eta > i - 1) continue;
                    reach += 1;
                    if (firstReach === null) firstReach = `${i}:${c.x},${c.y}:eta${w.eta}:fa${fa}`;
                    if (w.unsafe || labA.dwellUnsafeAt(c, w.eta, i) !== null) continue;
                    plan += 1;
                    if (firstPlan === null) firstPlan = `${i}:${c.x},${c.y}:eta${w.eta}:fa${fa}`;
                }
            }
        } catch (e) { rec.droppedThrew = String(e?.message).slice(0, 120); }
        scRestoreCounts(snap);
        rec.drop = { dropped, reach, plan, firstReach, firstPlan, end };
    }
    rec.wA = scWalkStats(run, labA, minTicksBetween, scFloorB);
    rec.wB = scWalkStats(run, labB, minTicksBetween, scFloorB);
    globalThis.__SC_LAB_SINK?.(rec);
    if (errA) throw errA;
    return resA;
}
'''
rep("/**\n * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate:",
    WRAP + "\n/**\n * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate:")
open(p, 'w').write(s)
print('ok')
