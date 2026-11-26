// actionNodes — TIME WINDOWS AND KNOWLEDGE KEEP THE LOGIC EXACT (slice AN-TIME-1; design actionnodes-time-design §1–§2).
//
// The logic keeps only MINIMAL item combinations, which is exact only when more items never make a plan impossible.
// This file brute-forces that over random graphs with windows and knowledge, against the REAL search, and shows the
// check has teeth: each reading the design rejected turns it red here.
//
//   1. the real search is UPWARD-CLOSED in the items (exact answer == the minimal-set rule), windows + knowledge;
//   2. the real search equals a FULL-STATE reference search (key = counts|clock|mana|known): the merged key is exact;
//   3. MUTATIONS go red: the time-LEFT reading and an earlier-START item break (1); the plain counts key breaks (2);
//      refusing an early start ("no wait") breaks the relevance cone (4);
//   4. the relevance cone (AN-OMSI-1) gives the same least shortfall as the whole walk, with windows and knowledge.
//
// Slow tier: hundreds of tiny exhaustive searches, synchronous and CPU-bound.
import { describe, expect, it } from 'vitest';

import { buildActionModel, loopStartState } from './actionModel.js';
import { enumerateLoop, itemCombinations } from './actionSearch.js';
import { leastShortPlan } from './actionPlanner.js';

// ── A seeded generator of small valid graphs ──────────────────────────────────────────────────────────────────────
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const PROV = { sources: { t: { type: 'model', model: 'claude-opus-5-5', date: '2026-11-25', session: 'an-time1' } }, default: 't' };

/** A random graph: 5–7 nodes, windows on about half, two knowledge flags, two boons. Null when the pool cannot fit. */
function randomGraph(seed, { windows = true, from = true, knowledge = true } = {}) {
    const r = rng(seed);
    const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const n = ri(5, 7);
    const ids = Array.from({ length: n }, (_, i) => (i === 0 ? 'start' : `n${i}`));
    const nodes = { start: { name: 'Start', kind: 'start', time: 0, limit: 1 } };
    const flags = knowledge ? ['k1', 'k2'] : [];
    for (let i = 1; i < n; i += 1) {
        const node = { name: `N${i}`, kind: i === n - 1 ? 'goal' : (r() < 0.6 ? 'check' : 'action'), time: ri(0, 3), limit: ri(1, 2) };
        node.after = [];
        for (let k = ri(1, 2); k > 0; k -= 1) node.after.push([...new Set([ids[ri(0, i - 1)], ids[ri(0, i - 1)]].slice(0, ri(1, 2)))]);
        const req = {};
        if (r() < 0.4) req.stats = { s1: ri(1, 2) };
        if (r() < 0.3) req.resources = { r1: ri(1, 2) };
        if (flags.length && r() < 0.3) req.knowledge = [flags[ri(0, 1)]];
        if (Object.keys(req).length) node.requires = req;
        const res = {};
        if (r() < 0.4) res.stats = { s1: 1 };
        if (r() < 0.4) res.resources = { r1: r() < 0.6 ? ri(1, 2) : -1 };
        if (r() < 0.15) res.mana = ri(1, 3);
        if (flags.length && r() < 0.3) res.learns = [flags[ri(0, 1)]];
        if (Object.keys(res).length) node.results = res;
        if (windows && r() < 0.5) {
            const f = from && r() < 0.5 ? ri(0, 5) : undefined;
            const u = r() < 0.8 ? (f ?? 0) + ri(0, 4) : undefined;
            if (f !== undefined || u !== undefined) node.window = { ...(f !== undefined ? { from: f } : {}), ...(u !== undefined ? { until: u } : {}) };
        }
        nodes[ids[i]] = node;
    }
    // Every flag needs a teacher: give an unlearned one to a random non-start node.
    for (const f of flags) {
        if (Object.values(nodes).some((x) => x.results?.learns?.includes(f))) continue;
        const t = nodes[ids[ri(1, n - 1)]];
        t.results = { ...(t.results ?? {}), learns: [...(t.results?.learns ?? []), f] };
    }
    const boons = {
        b1: { name: 'B1', count: ri(1, 2), gives: { mana: ri(0, 2), ...(r() < 0.5 ? { stats: { s1: 1 } } : {}) } },
        b2: { name: 'B2', count: 1, gives: { mana: ri(0, 3), ...(r() < 0.5 ? { resources: { r1: ri(1, 2) } } : {}) } },
    };
    const checks = Object.values(nodes).filter((x) => x.kind === 'check').length;
    const copies = boons.b1.count + boons.b2.count;
    if (copies > checks) return null;
    const g = {
        kind: 'action-graph', schema_version: 1, graph_id: `rand-${seed}`, name: 'R', provenance: PROV,
        loop: { mana: ri(4, 10) }, stats: { s1: { name: 'S1' } }, resources: { r1: { name: 'R1' } }, boons, start: 'start', nodes,
        ...(flags.length ? { knowledge: Object.fromEntries(flags.map((f) => [f, { name: f.toUpperCase() }])) } : {}),
    };
    if (copies < checks) { g.boons.filler = { name: 'Filler', count: 1, gives: { mana: 0 } }; g.filler = 'filler'; }
    return g;
}

/** The graphs a test walks: valid ones only (the real validator decides). */
function graphs(base, count, opts) {
    const out = [];
    for (let s = 1; out.length < count && s < count * 4; s += 1) {
        const g = randomGraph(base + s, opts);
        if (!g) continue;
        try { out.push({ seed: base + s, graph: g, model: buildActionModel(g) }); } catch { /* refused by the validator */ }
    }
    return out;
}

// ── A reference search: its own one-loop model, keyed by the WHOLE state, assuming nothing ───────────────────────
// `sem`: 'E2' (the built reading: time spent, an early start waits), 'E1' (an early start is refused), 'L' (the window
// is read against time LEFT), 'shift' (E2, plus an item that starts the clock one unit EARLIER per copy of boon b1).
function refStart(m, items, sem) {
    const B = m.boons.length;
    const stats = m.statIds.map(() => 0);
    const resources = m.resourceIds.map(() => 0);
    let mana = m.loopMana;
    let clock = 0;
    m.boons.forEach((b, i) => {
        const k = items[i] ?? 0;
        mana += b.mana * k;
        for (const [s, n] of b.stats) stats[s] += n * k;
        for (const [r, n] of b.resources) resources[r] += n * k;
        if (sem === 'shift' && i === 0) clock -= k;
    });
    if (sem === 'L') clock = m.loopMana - mana;
    const counts = m.nodes.map(() => 0);
    counts[m.startIndex] = m.nodes[m.startIndex].limit;
    return { counts, mana, clock, stats, resources, known: m.knowledge.map((_, k) => items[B + k] ?? 0) };
}
const refCleared = (m, s, i) => s.counts[i] >= m.nodes[i].limit;
const refReached = (m, s, i) => i === m.startIndex || m.nodes[i].after.some((set) => set.every((j) => refCleared(m, s, j)));
function refLegal(m, s, i, sem, ignoreMana) {
    const n = m.nodes[i];
    if (i === m.startIndex) return false;
    if (!ignoreMana && s.mana <= 1e-9) return false;
    if (!refReached(m, s, i) || s.counts[i] >= n.limit) return false;
    for (const [k, v] of n.reqStats) if (s.stats[k] < v) return false;
    for (const [k, v] of n.reqRes) if (s.resources[k] < v) return false;
    for (const [k, v] of n.addRes) if (s.resources[k] + v < 0) return false;
    for (const k of n.reqKnow) if (!s.known[k]) return false;
    let wait = 0;
    if (sem === 'E1' || sem === 'L') { if (s.clock < n.from) return false; } else wait = Math.max(0, n.from - s.clock);
    if (s.clock + wait > n.until) return false;
    if (!ignoreMana && s.mana + 1e-9 < n.time + wait) return false;
    return true;
}
function refPerform(m, s, i, sem) {
    const n = m.nodes[i];
    const wait = sem === 'E1' || sem === 'L' ? 0 : Math.max(0, n.from - s.clock);
    const counts = s.counts.slice(); counts[i] += 1;
    const stats = s.stats.slice(); const resources = s.resources.slice(); const known = s.known.slice();
    for (const [k, v] of n.addStats) stats[k] += v;
    for (const [k, v] of n.addRes) resources[k] += v;
    for (const k of n.learns) known[k] = 1;
    const mana = s.mana - n.time - wait + n.addMana;
    return { counts, mana, clock: sem === 'L' ? m.loopMana - mana : s.clock + wait + n.time, stats, resources, known };
}
/** Every state, full key. Returns the entries (state, parent, via). */
function refEnumerate(m, start, sem, { ignoreMana = false, allowed } = {}) {
    const key = (s) => `${s.counts}|${s.clock}|${s.mana}|${s.known}`;
    const entries = [{ state: start, parent: -1, via: -1 }];
    const seen = new Set([key(start)]);
    for (let h = 0; h < entries.length; h += 1) {
        const { state } = entries[h];
        for (let i = 0; i < m.nodes.length; i += 1) {
            if (allowed && !allowed[i]) continue;
            if (!refLegal(m, state, i, sem, ignoreMana)) continue;
            const nx = refPerform(m, state, i, sem);
            if (seen.has(key(nx))) continue;
            seen.add(key(nx));
            entries.push({ state: nx, parent: h, via: i });
        }
    }
    return entries;
}
const performedSet = (entries) => new Set(entries.filter((e) => e.via >= 0).map((e) => e.via));

/** Per combination, the nodes some state performs: from the REAL search, or from the reference under `sem`. */
const realLogic = (m, mutate = (x) => x) => itemCombinations(m).map((items) => ({ items, done: performedSet(enumerateLoop(mutate(m), { items }).entries) }));
const refLogic = (m, sem) => itemCombinations(m).map((items) => ({ items, done: performedSet(refEnumerate(m, refStart(m, items, sem), sem)) }));

/** Cells where the exact answer and the minimal-set rule (the upward closure of the combinations that work) differ. */
function nonMonotone(m, logic) {
    const leq = (a, b) => a.every((n, i) => n <= b[i]);
    let cells = 0;
    for (let i = 0; i < m.nodes.length; i += 1) {
        if (i === m.startIndex) continue;
        const yes = logic.filter((r) => r.done.has(i)).map((r) => r.items);
        for (const r of logic) if (yes.some((y) => leq(y, r.items)) !== r.done.has(i)) cells += 1;
    }
    return cells;
}
const sameLogic = (a, b) => a.every((r, k) => r.done.size === b[k].done.size && [...r.done].every((i) => b[k].done.has(i)));

const WINDOWED = graphs(40_000, 400);

describe('time windows and knowledge keep the minimal-set logic exact (AN-TIME-1)', () => {
    it('the generator makes the graphs it claims: windows with `from`, knowledge required and learned', () => {
        expect(WINDOWED.length).toBeGreaterThanOrEqual(300);
        expect(WINDOWED.filter((x) => x.model.nodes.some((n) => n.from > 0)).length).toBeGreaterThan(100);
        expect(WINDOWED.filter((x) => x.model.nodes.some((n) => n.reqKnow.length)).length).toBeGreaterThan(100);
    });

    it('1. the REAL search is upward-closed in the items (boons and knowledge): every graph, every node', () => {
        const broken = WINDOWED.filter(({ model }) => nonMonotone(model, realLogic(model)) > 0).map((x) => x.seed);
        expect(broken).toEqual([]);
    });

    it('2. the REAL search (counts key, earliest clock per layer) equals a full-state reference search', () => {
        const differ = WINDOWED.filter(({ model }) => !sameLogic(realLogic(model), refLogic(model, 'E2'))).map((x) => x.seed);
        expect(differ).toEqual([]);
    });

    it('3a. MUTATION: the time-LEFT reading breaks monotonicity (refused by shape: there is no such reading)', () => {
        const broken = WINDOWED.filter(({ model }) => nonMonotone(model, refLogic(model, 'L')) > 0);
        expect(broken.length).toBeGreaterThan(10);
    });

    it('3b. MUTATION: an item that starts the clock earlier breaks monotonicity (refused: unsupported-earlier-start)', () => {
        const broken = WINDOWED.filter(({ model }) => nonMonotone(model, refLogic(model, 'shift')) > 0);
        expect(broken.length).toBeGreaterThan(10);
    });

    it('3c. MUTATION: the plain counts key (no earliest-clock merge) loses states the full search finds', () => {
        const plain = (m) => ({ ...m, windowed: false });
        const differ = graphs(50_000, 1000).filter(({ model }) => !sameLogic(realLogic(model, plain), refLogic(model, 'E2')));
        expect(differ.length).toBeGreaterThan(0);
    });

    it('4. the relevance cone gives the whole walk\'s least shortfall, with windows and knowledge', () => {
        const differ = [];
        for (const { seed, model } of WINDOWED.slice(0, 250)) {
            for (const items of itemCombinations(model)) {
                const start = loopStartState(model, items);
                for (let t = 0; t < model.nodes.length; t += 1) {
                    if (t === model.startIndex) continue;
                    const cone = leastShortPlan(model, start, t, undefined, undefined, { cone: true });
                    const whole = leastShortPlan(model, start, t, undefined, undefined, { cone: false });
                    if ((cone?.short ?? null) !== (whole?.short ?? null)) differ.push({ seed, t, items });
                }
            }
        }
        expect(differ).toEqual([]);
    });

    it('3d. MUTATION: refusing an early start ("no wait") breaks the cone — the reference finds targets the cone loses', () => {
        // The cone is the planner's (`relevantNodes`), walked by the reference under E1 against the reference's whole walk.
        let lost = 0;
        for (const { model } of graphs(20_000, 300)) {
            for (const items of itemCombinations(model)) {
                const start = refStart(model, items, 'E1');
                for (let t = 0; t < model.nodes.length; t += 1) {
                    if (t === model.startIndex) continue;
                    const whole = performedSet(refEnumerate(model, start, 'E1', { ignoreMana: true })).has(t);
                    const allowed = coneOf(model, start, t);
                    const cone = performedSet(refEnumerate(model, start, 'E1', { ignoreMana: true, allowed })).has(t);
                    if (whole && !cone) lost += 1;
                }
            }
        }
        expect(lost).toBeGreaterThan(0);
    });
});

/** `relevantNodes`' rule, over the reference state (same model fields). */
function coneOf(m, state, target) {
    const sp = m.statIds.map(() => []);
    const rp = m.resourceIds.map(() => []);
    m.nodes.forEach((n, i) => {
        for (const [s, k] of n.addStats) if (k > 0) sp[s].push(i);
        for (const [r, k] of n.addRes) if (k > 0) rp[r].push(i);
    });
    const keep = m.nodes.map(() => false);
    const q = [];
    const add = (i) => { if (!keep[i]) { keep[i] = true; q.push(i); } };
    add(target);
    m.nodes.forEach((n, i) => { if (i !== m.startIndex && n.addMana >= n.time) add(i); });
    while (q.length) {
        const n = m.nodes[q.shift()];
        for (const set of n.after) for (const j of set) add(j);
        for (const [s, k] of n.reqStats) if (state.stats[s] < k) sp[s].forEach(add);
        for (const [r] of n.reqRes) rp[r].forEach(add);
        for (const [r, k] of n.addRes) if (k < 0) rp[r].forEach(add);
        for (const k of n.reqKnow) if (!state.known[k]) m.knowledge[k].learners.forEach(add);
    }
    return keep;
}
