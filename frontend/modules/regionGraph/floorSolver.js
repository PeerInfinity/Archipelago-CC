/**
 * ⛓ THE FLOOR SOLVER (region-graph-floor-solver). The Region Graph's floor numbers come from a CONSTRAINT SOLVE over
 * every link between two groups, not a first-come walk. Replaces region-graph-floors' BFS numbering (`floorNumbers`).
 *
 * ⚖ The user, session 84c8ab35, 2026-11-27T19:37:08.935Z: "The starting region is ground floor. Stairs up and down go up
 * or down a floor. Pits go down a floor. What if we make it context-dependent whether a doorway that isn't stairs
 * changes the floor? … Is there a way that we can track the ambiguities, and get a number for the largest number of
 * total floors if we count each ambiguous case as a floor transition? And then, can we set up some of the transitions
 * as transitioning more than one floor, to resolve the ambiguity? And for remaining ambiguities, rather than displaying
 * a question mark for the floor number, can we display a range of floors it could possibly be, depending on
 * interpretation?" — and, 2026-11-27T19:43:32.300Z: (1) doorways "start with -1 to +1"; (2) "If there is a set of picks
 * that makes the layout consistent, then we can display those picks instead of the range. Otherwise we should show the
 * range."; (3) the totals "only in a report for now"; (4) "treat teleporters as ambiguous, like doors."
 *
 * ── 1. THE MODEL ─────────────────────────────────────────────────────────────────────────────────────────────────
 * One integer floor f(g) per GROUP (R1 groups: components over `join` links, so a walk never changes floor), the start
 * region's group f = 0. A CONNECTION is an unordered pair of display keys {a, b} in two different groups, with every
 * `down` / `up` / `warp` link between them (a stair and its return twin are ONE connection, so one constraint). Each
 * link bounds Δ = f(group of b) − f(group of a):
 *   · `up` a → b: Δ ≥ +1;  · `down` a → b (stairs down, a pit): Δ ≤ −1;  (no bound on |Δ|: a stair may span floors)
 *   · `warp` (a doorway or a teleporter, ruling 4): −B ≤ Δ ≤ +B, B = `DOORWAY_FLOOR_BOUND` (1, ruling 1).
 * A connection's bound is the intersection of its links'. Each bound is a DIFFERENCE CONSTRAINT f(v) − f(u) ≤ w (an
 * arc u → v of weight w). A group no connection path from the start reaches is UNREACHED: no number, "Floor ?".
 *
 * ── 2. CONSISTENT, AND ADMISSIBLE ───────────────────────────────────────────────────────────────────────────────
 * The system is CONSISTENT iff its arc graph has no negative cycle (Bellman-Ford). A negative cycle is a CONTRADICTION
 * (e.g. pits all the way round a loop back to the start). With stairs unbounded, the floors a group can take in SOME
 * consistent assignment are mostly half-infinite (a stair can always be stretched further), which says nothing. So the
 * reading is: a stair spans ONE floor unless more is needed (the user: "set up SOME of the transitions as transitioning
 * more than one floor, to resolve the ambiguity"). The STRETCH of a stair is |Δ| − 1, and an ADMISSIBLE assignment is a
 * consistent one with the minimum TOTAL stretch S*. The admissible set is again a difference system (§3), so:
 *   · each group's INTERVAL [lo, hi] over it is the shortest-path bounds from and to the start (hi = d(s, g),
 *     lo = −d(g, s)), and it is CONTIGUOUS: for any lo ≤ v ≤ hi, pinning f(g) = v (arcs s→g of v, g→s of −v) adds only
 *     cycles of weight v + d(g, s) = v − lo ≥ 0, hi − v ≥ 0, or 0, so it stays consistent, and a difference system
 *     with integer weights has integer solutions (its matrix is totally unimodular);
 *   · the MAXIMUM floor count ("count each ambiguous case as a floor transition") is max over a, b of d(b, a), + 1 —
 *     max f(a) − f(b) over the set is d(b, a), exactly; the MINIMUM is the least K with "every f within K − 1" (two
 *     extra nodes M ≥ f ≥ m, an arc m → M of K − 1) still consistent.
 *
 * ── 3. THE SOLVE: min-cost flow, cycle-cancelling ───────────────────────────────────────────────────────────────
 * Minimising a linear objective (or Σ|Δ| over some arcs) over a difference system is the LP dual of a min-cost flow:
 * arc u → v of weight w is an uncapacitated arc of cost w; a node with objective coefficient c sends c units out; an
 * |Δ| term over (u, v) is two zero-cost arcs of capacity 1 (u → v, v → u). Start from a feasible flow, cancel negative
 * residual cycles (Bellman-Ford) until none is left. The OPTIMAL FACE is then the difference system of the residual
 * arcs (a forward arc while flow < cap, a reverse arc of −w while flow > 0): complementary slackness says exactly which
 * constraints must be tight. So every stage hands the next one a difference system, and each stage only narrows it.
 *
 * ── 4. THE PICK (ruling 2: one consistent pick where one exists), lexicographic, deterministic ──────────────────
 *   1. least TOTAL stair stretch Σ(|Δ| − 1) — the admissible set;
 *   2. least Σ|Δ| over pure doorways (at B = 1: the fewest floor-changing doorways);
 *   3. least span (max − min floor);
 *   4. then each group in sorted id order takes the value of its remaining interval nearest 0 (unique: an interval
 *      holding both −k and +k holds 0), pinned before the next.
 * Cost: each cancelled cycle lowers an integer objective by ≥ 1 (stage 1 ≤ S* cycles, stage 2 ≤ the doorways), each
 * Bellman-Ford O(V·E); stage 3 a linear search over K; stage 4 two Bellman-Fords per group. V ≈ groups, E ≈ 2–4 per
 * connection. Every relaxation is counted (`ops`); past `SOLVE_BUDGET` the solve stops where it is and stage 4 runs on
 * the last finished face (`exact: false`) — a count, not a clock, so it is deterministic.
 *
 * ── 5. CONTRADICTIONS (the drop rule) ───────────────────────────────────────────────────────────────────────────
 * When the system is inconsistent, drop the FEWEST connections that make it consistent: a bounded search tree (each
 * negative cycle met must lose one of its connections; try each, k = 1, 2, … `MAX_DROP`), which finds EVERY minimum
 * drop set (an ALTERNATIVE), up to `MAX_ALTERNATIVES`. Each alternative is solved as above. The CONTRADICTIONS are the
 * distinct negative cycles met. A group on one, or whose pick differs between alternatives, is RANGED: it gets
 * [min lo, max hi] of its intervals across the alternatives, and the label "Floor −3 to −1". Every other group's pick
 * is the same in every alternative, so the picks shown are one consistent assignment. No drop set of ≤ MAX_DROP: drop
 * the first connection of each cycle met, in turn (greedy), and say so (`dropRule: 'greedy'`).
 *
 * ── 6. LABELS (⛓ region-graph-floor-rename-letters) ──────────────────────────────────────────────────────────────
 * ⚖ The user, session 84c8ab35, 2026-11-28T03:33:37.957Z: "I want to replace the number after the floor with a letter,
 * to make it easier to read, like Floor 1A." — and (AskUserQuestion, 2026-11-28T03:38:16.825Z) "Floor 0A, Floor −1B":
 * the ground floor is Floor 0, and EVERY group gets a letter, even the only one on its floor.
 * The floor: "Floor 0", "Floor +1", "Floor −2" (U+2212; "+" kept so a floor above reads as the mirror of one below);
 * a range "Floor −3 to −1", "Floor 0 to +2"; unreached "Floor ?". Then the LETTER (`floorLetter`: A … Z, AA, AB, …),
 * k = the group's place, among the groups sharing that floor text, in BFS discovery order from the start over the
 * connections (sorted ids; unreached groups, which BFS never meets, by id): "Floor 0A", "Floor −1B". A letter is glued
 * to a single floor ("Floor −1B") but set off by a space after a range or "?" ("Floor −3 to −1 A", "Floor ? A"), so
 * it never reads as belonging to the range's last floor alone.
 *
 * ⛔ DETERMINISTIC: sorted ids, fixed arc order; no clock, no `Math.random`. ⛔ PURE: no DOM, no Cytoscape, no substrate.
 */

/** ⚖ ruling 1: a doorway / teleporter may change floor by at most this much ("start with -1 to +1"). */
export const DOORWAY_FLOOR_BOUND = 1;
/** Relaxations the exact solve may spend before it falls back (§4). */
export const SOLVE_BUDGET = 4_000_000;
/** The drop rule's largest drop set (§5), and the most alternatives it keeps. */
export const MAX_DROP = 3;
export const MAX_ALTERNATIVES = 32;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const STAIR = new Set(['down', 'up']);
const KINDS = new Set(['down', 'up', 'warp']);

class BudgetExceeded extends Error {}

/* ── the connections ──────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The model's connections between groups → `{ start, groups, connections, order, reached, unreached }`. A connection is
 * `{ id, a, b, ga, gb, links: [{from, to, kind}], stair, doorway, lo, hi }` (Δ = f(gb) − f(ga), a < b), sorted (a, b).
 * `order` = BFS discovery order from the start's group over the connections (sorted neighbours).
 */
export function floorConnections(model, { bound = DOORWAY_FLOOR_BOUND } = {}) {
    const groupOf = model?.groupOf instanceof Map ? model.groupOf : new Map();
    const groups = [...new Set(model?.layout?.groups?.map((g) => g.id) ?? groupOf.values())].sort(cmp);
    const start = model?.layout?.start != null ? groupOf.get(model.layout.start) ?? null : null;
    const byPair = new Map();
    for (const l of model?.layout?.graph?.links ?? []) {
        const kind = l.kind ?? 'join';
        if (!KINDS.has(kind)) continue;
        const gf = groupOf.get(l.from); const gt = groupOf.get(l.to);
        if (gf == null || gt == null || gf === gt) continue;
        const fwd = l.from < l.to;
        const [a, b] = fwd ? [l.from, l.to] : [l.to, l.from];
        const k = `${a}\u0000${b}`;
        if (!byPair.has(k)) byPair.set(k, { a, b, ga: groupOf.get(a), gb: groupOf.get(b), links: [], stair: false, doorway: false, lo: -Infinity, hi: Infinity });
        const c = byPair.get(k);
        if (c.links.some((x) => x.from === l.from && x.to === l.to && x.kind === kind)) continue;
        c.links.push({ from: l.from, to: l.to, kind });
        // Δ(from → to)'s bounds, then seen from a → b.
        let [lo, hi] = kind === 'down' ? [-Infinity, -1] : kind === 'up' ? [1, Infinity] : [-bound, bound];
        if (!fwd) [lo, hi] = [-hi, -lo];
        c.lo = Math.max(c.lo, lo); c.hi = Math.min(c.hi, hi);
        if (STAIR.has(kind)) c.stair = true; else c.doorway = true;
    }
    const connections = [...byPair.values()].sort((x, y) => cmp(x.a, y.a) || cmp(x.b, y.b));
    connections.forEach((c, i) => {
        c.id = i;
        c.links.sort((x, y) => cmp(x.from, y.from) || cmp(x.to, y.to) || cmp(x.kind, y.kind));
    });
    const adj = new Map(groups.map((g) => [g, new Set()]));
    for (const c of connections) { adj.get(c.ga)?.add(c.gb); adj.get(c.gb)?.add(c.ga); }
    const order = new Map();
    if (start != null && adj.has(start)) {
        order.set(start, 0);
        const queue = [start];
        while (queue.length) {
            const g = queue.shift();
            for (const h of [...adj.get(g)].sort(cmp)) if (!order.has(h)) { order.set(h, order.size); queue.push(h); }
        }
    }
    return { start, groups, connections, order, reached: [...order.keys()], unreached: groups.filter((g) => !order.has(g)) };
}

/* ── graph primitives (each relaxation counted against the budget) ───────────────────────────────────────────── */

function spend(ctx, n) {
    ctx.ops += n;
    if (ctx.ops > ctx.budget) throw new BudgetExceeded();
}

/** Shortest distances from `src` over `edges` [{u, v, w}] (no negative cycle assumed); Infinity = unreachable. */
function shortest(ctx, n, edges, src, reverse = false) {
    const d = new Array(n).fill(Infinity);
    d[src] = 0;
    for (let it = 0; it < n; it += 1) {
        spend(ctx, edges.length);
        let moved = false;
        for (const e of edges) {
            const [u, v] = reverse ? [e.v, e.u] : [e.u, e.v];
            if (d[u] !== Infinity && d[u] + e.w < d[v]) { d[v] = d[u] + e.w; moved = true; }
        }
        if (!moved) break;
    }
    return d;
}

/** A negative cycle over `edges` → the edge indices around it (in order), or null. */
function negativeCycle(ctx, n, edges) {
    const d = new Array(n).fill(0);
    const pred = new Array(n).fill(-1);
    let last = -1;
    for (let it = 0; it < n; it += 1) {
        spend(ctx, edges.length);
        last = -1;
        for (let i = 0; i < edges.length; i += 1) {
            const e = edges[i];
            if (d[e.u] + e.w < d[e.v]) { d[e.v] = d[e.u] + e.w; pred[e.v] = i; last = e.v; }
        }
        if (last === -1) return null;
    }
    let x = last;
    for (let i = 0; i < n; i += 1) x = edges[pred[x]].u;
    const cycle = [];
    for (let y = x; ;) {
        const i = pred[y];
        cycle.unshift(i);
        y = edges[i].u;
        if (y === x) break;
    }
    return cycle;
}

/**
 * Min-cost flow by cycle-cancelling over `arcs` [{u, v, w, cap, flow}] (mutated) → the optimal face, the residual
 * arcs as a difference system [{u, v, w}] (§3).
 */
function cancelCycles(ctx, n, arcs) {
    for (;;) {
        const res = [];
        for (let i = 0; i < arcs.length; i += 1) {
            const a = arcs[i];
            if (a.flow < a.cap) res.push({ u: a.u, v: a.v, w: a.w, arc: i, dir: 1 });
            if (a.flow > 0) res.push({ u: a.v, v: a.u, w: -a.w, arc: i, dir: -1 });
        }
        const cyc = negativeCycle(ctx, n, res);
        if (!cyc) return dedupeEdges(res);
        let push = Infinity;
        for (const i of cyc) { const r = res[i]; const a = arcs[r.arc]; push = Math.min(push, r.dir > 0 ? a.cap - a.flow : a.flow); }
        if (!Number.isFinite(push)) throw new Error('floorSolver: an unbounded flow (the system is inconsistent)');
        for (const i of cyc) { const r = res[i]; arcs[r.arc].flow += r.dir * push; }
    }
}

function dedupeEdges(edges) {
    const best = new Map();
    for (const e of edges) {
        const k = e.u * 100003 + e.v;
        if (!best.has(k) || e.w < best.get(k).w) best.set(k, { u: e.u, v: e.v, w: e.w });
    }
    return [...best.values()].sort((x, y) => x.u - y.u || x.v - y.v);
}

const uncapped = (edges) => edges.map((e) => ({ u: e.u, v: e.v, w: e.w, cap: Infinity, flow: 0 }));

/* ── one alternative's solve (§2–4) ──────────────────────────────────────────────────────────────────────────── */

/** The arcs of `conns` over node indices `ix` (a connection's hi: ga → gb of hi; its lo: gb → ga of −lo). */
function systemArcs(conns, ix) {
    const out = [];
    for (const c of conns) {
        const u = ix.get(c.ga); const v = ix.get(c.gb);
        if (u === undefined || v === undefined) continue;
        if (Number.isFinite(c.hi)) out.push({ u, v, w: c.hi, conn: c.id, side: 'hi' });
        if (Number.isFinite(c.lo)) out.push({ u: v, v: u, w: -c.lo, conn: c.id, side: 'lo' });
    }
    return out;
}

/** f(g) bounds over a difference system → { lo[], hi[] } from / to node `s`. */
function bounds(ctx, n, edges, s) {
    const hi = shortest(ctx, n, edges, s);
    const back = shortest(ctx, n, edges, s, true);
    return { hi, lo: back.map((x) => 0 - x) }; // 0 − x: never −0
}

/** All-pairs shortest distances (Floyd–Warshall) over a difference system. */
function allPairs(ctx, n, edges) {
    const d = Array.from({ length: n }, (_, i) => { const r = new Array(n).fill(Infinity); r[i] = 0; return r; });
    for (const e of edges) if (e.w < d[e.u][e.v]) d[e.u][e.v] = e.w;
    spend(ctx, n * n * n);
    for (let k = 0; k < n; k += 1) for (let i = 0; i < n; i += 1) {
        const dik = d[i][k];
        if (dik === Infinity) continue;
        const ri = d[i]; const rk = d[k];
        for (let j = 0; j < n; j += 1) if (dik + rk[j] < ri[j]) ri[j] = dik + rk[j];
    }
    return d;
}

/** The least span K (floors, max − min + 1) over a difference system of `n` groups, and that face (with M = n, m = n+1). */
function leastSpan(ctx, n, edges, kMax) {
    const withK = (K) => {
        const e = [...edges];
        for (let g = 0; g < n; g += 1) { e.push({ u: n, v: g, w: 0 }); e.push({ u: g, v: n + 1, w: 0 }); }
        e.push({ u: n + 1, v: n, w: K - 1 });
        return e;
    };
    for (let K = 1; K <= kMax; K += 1) {
        const e = withK(K);
        if (!negativeCycle(ctx, n + 2, e)) return { K, edges: e };
    }
    return { K: kMax, edges: withK(kMax) };
}

/** Stage 4: each node in `seq` order pinned to its interval's value nearest 0 → the pick (array over 0..n−1). */
function fixNearestZero(ctx, nAll, edges, s, seq) {
    const e = [...edges];
    const pick = new Array(nAll).fill(null);
    pick[s] = 0;
    for (const g of seq) {
        if (g === s) continue;
        const hi = shortest(ctx, nAll, e, s)[g];
        const lo = -shortest(ctx, nAll, e, s, true)[g];
        const v = lo > 0 ? lo : hi < 0 ? hi : 0;
        if (!Number.isFinite(v)) continue;
        pick[g] = v;
        e.push({ u: s, v: g, w: v }); e.push({ u: g, v: s, w: -v });
    }
    return pick;
}

/**
 * One consistent system (the connections `conns`, every one of them kept) over the reached groups → its admissible
 * intervals, the pick, the spans, and per connection its Δ range and pick. Throws BudgetExceeded only through `ctx`.
 */
function solveConsistent(ctx, names, s, conns) {
    const n = names.length;
    const ix = new Map(names.map((g, i) => [g, i]));
    const base = systemArcs(conns, ix);
    const stage = { reached: 0 };
    let face = base.map(({ u, v, w }) => ({ u, v, w }));
    let face1 = null;
    let face2 = null;
    let spanFace = null;
    try {
        // Stage 1: least total stair stretch. A stair a → b that must go UP (lo ≥ 1) has stretch Δ − 1: gb sends one unit
        // to ga along its lo arc; one that must go DOWN (hi ≤ −1), −Δ − 1: ga sends one to gb along its hi arc.
        const arcs1 = base.map((a) => ({ u: a.u, v: a.v, w: a.w, cap: Infinity, flow: 0, conn: a.conn, side: a.side }));
        for (const c of conns) {
            if (!c.stair || c.lo > c.hi) continue;
            const side = c.lo >= 1 ? 'lo' : c.hi <= -1 ? 'hi' : null;
            const a = side && arcs1.find((x) => x.conn === c.id && x.side === side);
            if (a) a.flow = 1;
        }
        face1 = cancelCycles(ctx, n, arcs1);
        face = face1; stage.reached = 1;
        // Stage 2: least Σ|Δ| over the pure doorways (two zero-cost arcs of capacity 1 each).
        const arcs2 = uncapped(face1);
        for (const c of conns) {
            if (c.stair || !c.doorway) continue;
            const u = ix.get(c.ga); const v = ix.get(c.gb);
            arcs2.push({ u, v, w: 0, cap: 1, flow: 0 }, { u: v, v: u, w: 0, cap: 1, flow: 0 });
        }
        face2 = cancelCycles(ctx, n, arcs2);
        face = face2; stage.reached = 2;
        // Stage 3: least span over that face.
        spanFace = leastSpan(ctx, n, face2, n * Math.max(1, conns.length + 1) + 1).edges;
        stage.reached = 3;
    } catch (err) {
        if (!(err instanceof BudgetExceeded)) throw err;
        ctx.exact = false;
    }
    // Stage 4 (always, on the last finished face; out of budget it runs on a fresh allowance so a pick exists).
    const seq = names.map((g, i) => i).sort((x, y) => cmp(names[x], names[y]));
    let pickArr;
    const last = spanFace ?? face;
    const nAll = spanFace ? n + 2 : n;
    try {
        pickArr = fixNearestZero(ctx, nAll, last, s, seq);
    } catch (err) {
        if (!(err instanceof BudgetExceeded)) throw err;
        ctx.exact = false;
        const relief = { ...ctx, ops: 0, budget: Infinity };
        pickArr = fixNearestZero(relief, nAll, last, s, seq);
    }
    // The admissible set's measures (stage 1's face; out of budget before it, the consistent set itself).
    const adm = face1 ?? base.map(({ u, v, w }) => ({ u, v, w }));
    let lo; let hi; let D = null; let minSpan = null;
    try {
        ({ lo, hi } = bounds(ctx, n, adm, s));
        D = allPairs(ctx, n, adm);
        minSpan = face1 ? leastSpan(ctx, n, face1, n * Math.max(1, conns.length + 1) + 1).K : null;
    } catch (err) {
        if (!(err instanceof BudgetExceeded)) throw err;
        ctx.exact = false;
        const relief = { ...ctx, ops: 0, budget: Infinity };
        ({ lo, hi } = bounds(relief, n, adm, s));
        D = allPairs(relief, n, adm);
    }
    let maxSpan = 1;
    for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) if (D[b][a] + 1 > maxSpan) maxSpan = D[b][a] + 1;
    const pick = new Map(); const interval = new Map();
    names.forEach((g, i) => { pick.set(g, pickArr[i]); interval.set(g, [lo[i], hi[i]]); });
    const vals = [...pick.values()].filter(Number.isFinite);
    const perConn = new Map();
    let stretch = 0;
    for (const c of conns) {
        const u = ix.get(c.ga); const v = ix.get(c.gb);
        const range = [0 - D[v][u], D[u][v]];
        const delta = pickArr[v] - pickArr[u];
        if (c.stair && Number.isFinite(delta)) stretch += Math.abs(delta) - 1;
        perConn.set(c.id, { range, delta });
    }
    return {
        pick, interval, perConn, stretch, stage: stage.reached,
        spans: { pick: vals.length ? Math.max(...vals) - Math.min(...vals) + 1 : 0, min: minSpan, max: Number.isFinite(maxSpan) ? maxSpan : null },
    };
}

/* ── the solve ────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Solve the floors of a Region Map `model` → {
 *   start, bound, exact, ops, dropRule: 'none' | 'minimum' | 'greedy', order: Map<group, bfs index>,
 *   floorOf: Map<group, n>           — the PICKED groups (ruling 2),
 *   ranged: Map<group, [lo, hi]>     — the groups a contradiction leaves without one consistent pick (§5),
 *   unreached: [group],              — no connection path from the start: "Floor ?",
 *   interval: Map<group, [lo, hi]>   — every reached group's admissible interval (across the alternatives),
 *   connections: [{ ...connection, range: [lo, hi] (Δ over the admissible set), delta (the pick's), dropped? }],
 *   contradictions: [{ groups, connections: [id] }], alternatives: [[dropped connection ids]],
 *   spans: { pick, min, max }, stretch (the pick's total), stages (the last exact stage, 3 = all) }
 * `bound` = the doorway bound (the ±2 experiment passes 2).
 */
export function solveFloors(model, { bound = DOORWAY_FLOOR_BOUND, budget = SOLVE_BUDGET } = {}) {
    const C = floorConnections(model, { bound });
    const ctx = { ops: 0, budget, exact: true };
    const names = [...C.reached].sort(cmp);
    const empty = {
        start: C.start, bound, exact: true, ops: 0, dropRule: 'none', order: C.order, floorOf: new Map(), ranged: new Map(),
        unreached: C.unreached, interval: new Map(), connections: [], contradictions: [], alternatives: [], spans: { pick: 0, min: null, max: null },
        stretch: 0, stages: 0,
    };
    if (C.start == null || !names.length) return empty;
    const reached = new Set(names);
    const conns = C.connections.filter((c) => reached.has(c.ga) && reached.has(c.gb));
    const ix = new Map(names.map((g, i) => [g, i]));
    const s = ix.get(C.start);
    const n = names.length;
    const allArcs = systemArcs(conns, ix);

    // §5: contradictions and the drop rule.
    const cycles = new Map();
    const cycleOf = (dropped) => {
        const keep = allArcs.filter((a) => !dropped.has(a.conn));
        const cyc = negativeCycle(ctx, n, keep);
        if (!cyc) return null;
        const ids = [...new Set(cyc.map((i) => keep[i].conn))].sort((x, y) => x - y);
        const key = ids.join(',');
        if (!cycles.has(key)) cycles.set(key, { groups: [...new Set(cyc.map((i) => names[keep[i].u]))].sort(cmp), connections: ids });
        return ids;
    };
    let alternatives = [[]];
    let dropRule = 'none';
    if (cycleOf(new Set())) {
        alternatives = [];
        dropRule = 'minimum';
        const found = new Set();
        const search = (dropped, k) => {
            if (alternatives.length >= MAX_ALTERNATIVES) return;
            const ids = cycleOf(dropped);
            if (!ids) {
                const key = [...dropped].sort((x, y) => x - y).join(',');
                if (!found.has(key)) { found.add(key); alternatives.push([...dropped].sort((x, y) => x - y)); }
                return;
            }
            if (dropped.size >= k) return;
            for (const id of ids) { const d = new Set(dropped); d.add(id); search(d, k); }
        };
        for (let k = 1; k <= MAX_DROP && !alternatives.length; k += 1) search(new Set(), k);
        alternatives.sort((x, y) => x.join(',') < y.join(',') ? -1 : x.join(',') > y.join(',') ? 1 : 0);
        if (!alternatives.length) {
            dropRule = 'greedy';
            const d = new Set();
            for (let ids = cycleOf(d); ids; ids = cycleOf(d)) d.add(ids[0]);
            alternatives = [[...d].sort((x, y) => x - y)];
        }
    }

    const solved = alternatives.map((drop) => {
        const ds = new Set(drop);
        return solveConsistent(ctx, names, s, conns.filter((c) => !ds.has(c.id)));
    });
    const canon = solved[0];
    const onCycle = new Set([...cycles.values()].flatMap((c) => c.groups));
    const floorOf = new Map(); const ranged = new Map(); const interval = new Map();
    for (const g of names) {
        const lo = Math.min(...solved.map((r) => r.interval.get(g)[0]));
        const hi = Math.max(...solved.map((r) => r.interval.get(g)[1]));
        interval.set(g, [lo, hi]);
        const picks = new Set(solved.map((r) => r.pick.get(g)));
        if (onCycle.has(g) || picks.size > 1) ranged.set(g, [lo, hi]);
        else if (Number.isFinite(canon.pick.get(g))) floorOf.set(g, canon.pick.get(g));
    }
    const droppedSomewhere = new Set(alternatives.flat());
    const connections = conns.map((c) => {
        const p = canon.perConn.get(c.id);
        return { ...c, range: p ? p.range : null, delta: p ? p.delta : null, ...(droppedSomewhere.has(c.id) ? { dropped: true } : {}) };
    });
    return {
        start: C.start, bound, exact: ctx.exact, ops: ctx.ops, dropRule, order: C.order, floorOf, ranged, unreached: C.unreached,
        interval, connections, contradictions: [...cycles.values()], alternatives,
        spans: {
            pick: canon.spans.pick,
            min: solved.every((r) => r.spans.min != null) ? Math.min(...solved.map((r) => r.spans.min)) : null,
            max: solved.every((r) => r.spans.max != null) ? Math.max(...solved.map((r) => r.spans.max)) : null,
        },
        stretch: canon.stretch, stages: Math.min(...solved.map((r) => r.stage)),
    };
}

/* ── the ambiguities (the report's list) ─────────────────────────────────────────────────────────────────────── */

/**
 * The ambiguous connections of a solve → `{ doorways: [conn] (a pure doorway whose Δ is not forced), stairs: [conn]
 * (a stair whose |Δ| can or must exceed 1, or is stretched in the pick), forcedDoorways: [conn] (a doorway whose Δ
 * is forced: `range` lo = hi) }`. Each with `mustStretch` / `canStretch` / `stretched` for a stair.
 */
export function floorAmbiguities(sol) {
    const doorways = []; const stairs = []; const forcedDoorways = [];
    for (const c of sol.connections) {
        if (!c.range) continue;
        const [lo, hi] = c.range;
        if (!c.stair && c.doorway) (lo < hi ? doorways : forcedDoorways).push(c);
        if (c.stair) {
            const minAbs = lo > 0 ? lo : hi < 0 ? -hi : 0;
            const maxAbs = Math.max(Math.abs(lo), Math.abs(hi));
            const mustStretch = minAbs > 1;
            const canStretch = maxAbs > 1;
            const stretched = Number.isFinite(c.delta) && Math.abs(c.delta) > 1;
            if (mustStretch || canStretch || stretched) stairs.push({ ...c, mustStretch, canStretch, stretched });
        }
    }
    return { doorways, stairs, forcedDoorways };
}

/* ── labels ───────────────────────────────────────────────────────────────────────────────────────────────────── */

const signed = (n) => (n === 0 ? '0' : n > 0 ? `+${n}` : `−${-n}`);

/** The k-th letter (k ≥ 0), spreadsheet-column style: 0 "A" … 25 "Z", 26 "AA", 27 "AB", … 701 "ZZ", 702 "AAA". */
export function floorLetter(k) {
    if (!Number.isInteger(k) || k < 0) throw new RangeError(`floorLetter: ${k} is not an index`);
    let s = '';
    for (let n = k + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
}

/** A floor number's name, without its letter: 0 "Floor 0", +n "Floor +n", −n "Floor −n" (U+2212), none "Floor ?". */
export function floorName(n) {
    if (!Number.isInteger(n)) return 'Floor ?';
    return `Floor ${signed(n)}`;
}

/** A range's name, without its letter: "Floor −3 to −1", "Floor 0 to +2"; a one-floor range is that floor's name. */
export function floorRangeName(lo, hi) {
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) return 'Floor ?';
    if (lo === hi) return floorName(lo);
    return `Floor ${signed(lo)} to ${signed(hi)}`;
}

/** A floor name plus its letter: glued to a single floor ("Floor 0A"), after a space for a range or "?" (§6). */
export function withFloorLetter(name, k) {
    const glued = /^Floor [0+−]\d*$/.test(name);
    return `${name}${glued ? '' : ' '}${floorLetter(k)}`;
}

/**
 * Every group's label → `Map<group, label>` (§6): a pick's floor name, a ranged group's range, an unreached group
 * "Floor ?"; then each its letter among the groups sharing that name, in BFS discovery order (unreached: by id).
 */
export function floorLabels(sol) {
    const base = new Map();
    for (const [g, n] of sol.floorOf) base.set(g, floorName(n));
    for (const [g, [lo, hi]] of sol.ranged) base.set(g, floorRangeName(lo, hi));
    for (const g of sol.unreached) base.set(g, floorName(null));
    const byLabel = new Map();
    for (const [g, l] of base) { if (!byLabel.has(l)) byLabel.set(l, []); byLabel.get(l).push(g); }
    const out = new Map();
    for (const [l, gs] of byLabel) {
        gs.sort((a, b) => (sol.order.get(a) ?? Infinity) - (sol.order.get(b) ?? Infinity) || cmp(a, b));
        gs.forEach((g, i) => out.set(g, withFloorLetter(l, i)));
    }
    return out;
}
