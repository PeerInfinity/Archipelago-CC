/**
 * ⛓ THE FLOOR SOLVER (region-graph-floor-solver; `floorSolver.js`) over small synthetic Region Map models:
 *   · 1. the model: a stretched stair; a doorway that MUST change floor and one that must NOT; an unreached group;
 *   · 2. contradictions: a pit loop back to the start — the drop rule, the alternatives, the range label;
 *   · 3. the intervals, the spans and the pick checked against BRUTE FORCE on ≤ 8-group fixtures;
 *   · 4. the spans on a fixture with a known answer; the doorway bound is ONE constant (and the ±2 experiment);
 *   · 5. determinism (insertion orders), the budget fallback, the labels.
 * The frozen presets (and the report's tables): floorSolver.presets.test.js.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as FS from './floorSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A synthetic Region Map model: `groups` {id: [display keys]}, `links` [[from, to, kind]] over display keys. */
function model({ start, groups, links }) {
    const groupOf = new Map();
    for (const [id, members] of Object.entries(groups)) for (const m of members) groupOf.set(m, id);
    return {
        groupOf,
        layout: {
            start, groups: Object.entries(groups).map(([id, members]) => ({ id, root: members[0], members })),
            graph: { links: links.map(([from, to, kind]) => ({ from, to, kind })) },
        },
    };
}
const obj = (m) => Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const conn = (sol, a, b) => sol.connections.find((c) => c.a === a && c.b === b);

describe('⛓ 1. the model', () => {
    it('a consistent fixture with a STRETCHED stair: S ↓ A ↓ B and B ↑ S → B is two floors down, its stair back spans 2', () => {
        const m = model({
            start: 's1',
            groups: { S: ['s1', 's2', 's3'], A: ['a1', 'a2'], B: ['b1', 'b2'] },
            links: [['s1', 'a1', 'down'], ['a1', 's1', 'up'], ['a2', 'b1', 'down'], ['b2', 's3', 'up']],
        });
        const sol = FS.solveFloors(m);
        expect(sol.exact).toBe(true);
        expect(obj(sol.floorOf)).toEqual({ A: -1, B: -2, S: 0 });
        expect(obj(sol.interval)).toEqual({ A: [-1, -1], B: [-2, -2], S: [0, 0] });
        expect(sol.stretch).toBe(1);
        expect(sol.contradictions).toEqual([]);
        // The stair and its return twin are ONE connection (one constraint).
        expect(conn(sol, 'a1', 's1').links.map((l) => l.kind)).toEqual(['up', 'down']);
        expect(sol.connections.length).toBe(3);
        const amb = FS.floorAmbiguities(sol);
        expect(amb.stairs.map((c) => [c.a, c.b, c.delta, c.range, c.mustStretch, c.stretched])).toEqual([['b2', 's3', 2, [2, 2], true, true]]);
        expect(obj(FS.floorLabels(sol))).toEqual({ A: 'Floor −1', B: 'Floor −2', S: 'Ground floor' });
    });

    it('a doorway that MUST change floor (beside a pit) and one that must NOT (its far side is pinned by stairs)', () => {
        const m = model({
            start: 's1',
            groups: { S: ['s1', 's2', 's3', 's4'], A: ['a'], D: ['d'], E: ['e1', 'e2'] },
            // S —pit→ A and S —door— A: the door must go down one. S —door— D, D ↓ E, S ↓ E: D = E + 1 = 0.
            links: [['s1', 'a', 'down'], ['s2', 'a', 'warp'], ['a', 's2', 'warp'], ['s3', 'd', 'warp'], ['d', 'e1', 'down'], ['s4', 'e2', 'down']],
        });
        const sol = FS.solveFloors(m);
        expect(obj(sol.floorOf)).toEqual({ A: -1, D: 0, E: -1, S: 0 });
        expect(conn(sol, 'a', 's2')).toMatchObject({ doorway: true, stair: false, range: [1, 1], delta: 1 }); // A → S: up one
        expect(conn(sol, 'd', 's3')).toMatchObject({ doorway: true, stair: false, range: [0, 0], delta: 0 });
        const amb = FS.floorAmbiguities(sol);
        expect(amb.doorways).toEqual([]);
        expect(amb.forcedDoorways.map((c) => [c.a, c.b, c.range])).toEqual([['a', 's2', [1, 1]], ['d', 's3', [0, 0]]]);
    });

    it('an UNREACHED group (no link from the start reaches it) has no number: "Floor ?", and is counted', () => {
        const m = model({
            start: 's', groups: { S: ['s'], A: ['a'], W: ['w1', 'w2'], X: ['x'] },
            links: [['s', 'a', 'warp'], ['w1', 'x', 'down'], ['w2', 'w1', 'join']],
        });
        const sol = FS.solveFloors(m);
        expect(sol.unreached).toEqual(['W', 'X']);
        expect([...sol.floorOf.keys()].sort()).toEqual(['A', 'S']);
        expect(sol.interval.has('W')).toBe(false);
        const labels = FS.floorLabels(sol);
        expect([labels.get('W'), labels.get('X')]).toEqual(['Floor ?', 'Floor ?']);
        // A doorway that need not change floor: the pick keeps it level; its range is the bound.
        expect(conn(sol, 'a', 's')).toMatchObject({ range: [-1, 1], delta: 0 });
        expect(labels.get('A')).toBe('Ground floor · 2');
        expect(labels.get('S')).toBe('Ground floor · 1');
        // No start at all: every group unreached.
        expect(FS.solveFloors({ ...m, layout: { ...m.layout, start: null } }).unreached).toEqual(['A', 'S', 'W', 'X']);
    });
});

describe('⛓ 2. contradictions: the drop rule', () => {
    // S ↓ A (s1 → a) and A ↓ S (a → s2): a pit loop back to the start with no way up. P hangs off S by a doorway,
    // Q off A by a doorway.
    const m = model({
        start: 's1',
        groups: { S: ['s1', 's2', 's3'], A: ['a', 'a2'], P: ['p'], Q: ['q'] },
        links: [['s1', 'a', 'down'], ['a', 's2', 'down'], ['s3', 'p', 'warp'], ['p', 's3', 'warp'], ['a2', 'q', 'warp']],
    });
    it('the fewest connections are dropped (1 here); each minimum drop set is an alternative; the cycle is listed', () => {
        const sol = FS.solveFloors(m);
        expect(sol.dropRule).toBe('minimum');
        expect(sol.contradictions).toEqual([{ groups: ['A', 'S'], connections: [conn(sol, 'a', 's1').id, conn(sol, 'a', 's2').id] }]);
        expect(sol.alternatives).toEqual([[conn(sol, 'a', 's1').id], [conn(sol, 'a', 's2').id]]);
        expect(conn(sol, 'a', 's1').dropped).toBe(true);
        expect(conn(sol, 'p', 's3').dropped).toBeUndefined();
    });
    it('a contradiction group gets the RANGE across the alternatives ("Floor −1 to +1"); so does one whose pick differs', () => {
        const sol = FS.solveFloors(m);
        // Drop S ↓ A: A ↓ S puts A ABOVE (+1); drop A ↓ S: A is −1. S is on the cycle: its range is just 0.
        expect(obj(sol.ranged)).toEqual({ A: [-1, 1], Q: [-2, 2], S: [0, 0] });
        expect(obj(sol.floorOf)).toEqual({ P: 0 }); // the same pick in every alternative: shown
        const labels = FS.floorLabels(sol);
        // S's range is one floor, so it reads as that floor, and shares "Ground floor" with P (· k by discovery order).
        expect(obj(labels)).toEqual({ A: 'Floor −1 to +1', P: 'Ground floor · 2', Q: 'Floor −2 to +2', S: 'Ground floor · 1' });
    });
    it('independent loops each lose a connection: every combination is an alternative, every cycle listed', () => {
        const m2 = model({
            start: 's1',
            groups: { S: ['s1', 's2', 's3', 's4'], A: ['a'], B: ['b'] },
            links: [['s1', 'a', 'down'], ['a', 's2', 'down'], ['s3', 'b', 'up'], ['b', 's4', 'up']],
        });
        const sol = FS.solveFloors(m2);
        expect(sol.dropRule).toBe('minimum');
        expect(sol.alternatives.length).toBe(4);
        expect(sol.alternatives.every((d) => d.length === 2)).toBe(true);
        expect(sol.contradictions.map((c) => c.groups)).toEqual([['A', 'S'], ['B', 'S']]);
        expect(obj(sol.ranged)).toEqual({ A: [-1, 1], B: [-1, 1], S: [0, 0] });
    });
});

/* ── 3. brute force ──────────────────────────────────────────────────────────────────────────────────────────── */

/** A deterministic random fixture of `g` groups (one display key per link end) → the model. */
function randomModel(seed, g, nLinks) {
    let x = seed >>> 0;
    const rnd = (k) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % k; };
    const ids = Array.from({ length: g }, (_, i) => `G${i}`);
    const groups = Object.fromEntries(ids.map((id) => [id, []]));
    const links = [];
    const add = (ga, gb, kind) => {
        const a = `${ga.toLowerCase()}_${groups[ga].length}`; groups[ga].push(a);
        const b = `${gb.toLowerCase()}_${groups[gb].length}`; groups[gb].push(b);
        links.push([a, b, kind]);
        if (kind === 'warp' && rnd(2)) links.push([b, a, 'warp']);
        if (kind !== 'warp' && rnd(2)) links.push([b, a, kind === 'down' ? 'up' : 'down']);
    };
    for (let i = 1; i < g; i += 1) add(ids[rnd(i)], ids[i], ['down', 'up', 'warp', 'warp'][rnd(4)]); // a spanning tree
    for (let i = g - 1; i < nLinks; i += 1) {
        const a = rnd(g); let b = rnd(g - 1); if (b >= a) b += 1;
        add(ids[a], ids[b], ['down', 'up', 'warp'][rnd(3)]);
    }
    return model({ start: groups.G0[0], groups, links });
}

/**
 * Every assignment in [−R, R] of the non-start groups with the LEAST total stretch (branch and bound on the partial
 * stretch, which only grows; ties all kept) → the solver's measures, by enumeration.
 */
function bruteForce(m, bound, R, base = m) {
    // The groups (and their order) are `base`'s reached ones: dropping a connection never un-reaches a group (§5).
    const B = FS.floorConnections(base, { bound });
    const C = FS.floorConnections(m, { bound });
    const names = [...B.reached].sort();
    const ix = new Map(names.map((g, i) => [g, i]));
    const seq = [...B.order.keys()].map((g) => ix.get(g)).filter((i) => names[i] !== C.start); // BFS order: closes early
    const rank = new Map([[ix.get(C.start), -1], ...seq.map((i, k) => [i, k])]);
    const cons = C.connections.map((c) => ({ u: ix.get(c.ga), v: ix.get(c.gb), lo: c.lo, hi: c.hi, stair: c.stair, door: !c.stair && c.doorway }));
    const closesAt = seq.map(() => []);
    for (const c of cons) closesAt[Math.max(rank.get(c.u), rank.get(c.v))]?.push(c);
    const f = new Array(names.length).fill(0);
    let all = []; let bestStretch = Infinity; let visited = 0;
    const rec = (k, stretch) => {
        visited += 1;
        if (k === seq.length) {
            if (stretch < bestStretch) { bestStretch = stretch; all = []; }
            let door = 0;
            for (const c of cons) if (c.door) door += Math.abs(f[c.v] - f[c.u]);
            all.push({ f: [...f], stretch, door, span: Math.max(...f) - Math.min(...f) + 1 });
            return;
        }
        for (let v = -R; v <= R; v += 1) {
            f[seq[k]] = v;
            let st = stretch; let ok = true;
            for (const c of closesAt[k]) {
                const d = f[c.v] - f[c.u];
                if (d < c.lo || d > c.hi) { ok = false; break; }
                if (c.stair) st += Math.abs(d) - 1;
            }
            if (ok && st <= bestStretch) rec(k + 1, st);
        }
    };
    rec(0, 0);
    if (!all.length) return { consistent: 0 };
    const sMin = Math.min(...all.map((a) => a.stretch));
    const adm = all.filter((a) => a.stretch === sMin);
    const interval = new Map(names.map((g, i) => [g, [Math.min(...adm.map((a) => a.f[i])), Math.max(...adm.map((a) => a.f[i]))]]));
    const dMin = Math.min(...adm.map((a) => a.door));
    const a2 = adm.filter((a) => a.door === dMin);
    const kMin = Math.min(...a2.map((a) => a.span));
    let a3 = a2.filter((a) => a.span === kMin);
    for (const g of names) { // stage 4: sorted ids, nearest 0
        const i = ix.get(g);
        const vals = new Set(a3.map((a) => a.f[i]));
        const best = Math.min(...[...vals].map(Math.abs));
        const v = vals.has(best) && vals.has(-best) && best !== 0 ? null : vals.has(best) ? best : -best; // a tie: null
        a3 = a3.filter((a) => a.f[i] === v);
    }
    return {
        names, consistent: all.length, visited, sMin, interval,
        takes: new Map(names.map((g, i) => [g, new Set(adm.map((a) => a.f[i]))])), pick: a3.length === 1 ? new Map(names.map((g, i) => [g, a3[0].f[i]])) : null,
        min: Math.min(...adm.map((a) => a.span)), max: Math.max(...adm.map((a) => a.span)), edge: adm.some((a) => a.f.some((v) => Math.abs(v) === R)),
    };
}

describe('⛓ 3. the solve against brute force (≤ 8 groups)', () => {
    // Consistent draws (at ±1 and ±2), each with a stretched stair and an ambiguous doorway (found by a sweep of seeds).
    const cases = [[3, 6, 9], [7, 7, 11], [13, 7, 11], [16, 7, 11], [23, 8, 13], [36, 6, 9], [41, 8, 13], [56, 8, 13], [82, 7, 11], [125, 8, 13]];
    for (const [seed, g, nLinks] of cases) {
        for (const bound of [1, 2]) {
            it(`seed ${seed}, ${g} groups, ${nLinks} connections, doorway bound ±${bound}: intervals, spans, stretch, pick`, () => {
                const m = randomModel(seed, g, nLinks);
                const sol = FS.solveFloors(m, { bound });
                expect(sol.contradictions).toEqual([]);
                expect(sol.stretch).toBeGreaterThan(0);
                const R = g + 1;
                const bf = bruteForce(m, bound, R);
                expect(bf.consistent).toBeGreaterThan(0);
                expect(bf.edge, 'the brute-force box is large enough').toBe(false);
                expect(sol.exact).toBe(true);
                expect(obj(sol.interval)).toEqual(obj(bf.interval));
                expect([sol.spans.min, sol.spans.max]).toEqual([bf.min, bf.max]);
                expect(sol.stretch).toBe(bf.sMin);
                expect(bf.pick).not.toBeNull();
                expect(obj(sol.floorOf)).toEqual(obj(bf.pick));
            });
        }
    }
    it('the intervals are CONTIGUOUS: every floor from lo to hi is taken by some admissible assignment', () => {
        let checked = 0;
        for (const [seed, g, n] of cases) {
            const m = randomModel(seed, g, n);
            const sol = FS.solveFloors(m);
            if (sol.contradictions.length) continue;
            const bf = bruteForce(m, 1, g + 1);
            for (const [grp, [lo, hi]] of sol.interval) {
                for (let v = lo; v <= hi; v += 1) expect(bf.takes.get(grp).has(v), `${seed} ${grp} = ${v}`).toBe(true);
                expect(bf.takes.get(grp).size).toBe(hi - lo + 1);
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(20);
    });
});

describe('⛓ 3b. the drop rule against brute force', () => {
    /** `m` without the links of connections `ids` (of `sol`). */
    const without = (m, sol, ids) => {
        const pairs = new Set(ids.map((id) => { const c = sol.connections.find((x) => x.id === id); return `${c.a}\u0000${c.b}`; }));
        const links = m.layout.graph.links.filter((l) => !pairs.has(l.from < l.to ? `${l.from}\u0000${l.to}` : `${l.to}\u0000${l.from}`));
        return { ...m, layout: { ...m.layout, graph: { links } } };
    };
    const subsets = (xs, k) => (k === 0 ? [[]] : xs.flatMap((x, i) => subsets(xs.slice(i + 1), k - 1).map((r) => [x, ...r])));
    // Inconsistent draws. A consistent difference system has a solution within ±(groups · max(1, bound)), so a brute
    // force over that box that finds nothing proves inconsistency.
    for (const [seed, g, n] of [[7, 6, 10], [11, 7, 11], [91, 7, 9]]) {
        it(`seed ${seed}: the alternatives are EXACTLY the minimum drop sets; each solves as brute force says`, () => {
            const m = randomModel(seed, g, n);
            const sol = FS.solveFloors(m);
            expect(sol.dropRule).toBe('minimum');
            const k = sol.alternatives[0].length;
            const ids = sol.connections.map((c) => c.id);
            const ok = (drop) => bruteForce(without(m, sol, drop), 1, g + 1, m).consistent > 0;
            for (let j = 0; j < k; j += 1) for (const d of subsets(ids, j)) expect(ok(d), `drop ${d}`).toBe(false);
            expect(subsets(ids, k).filter(ok)).toEqual(sol.alternatives);
            // The ranged groups: their range is the union of each alternative's intervals.
            const per = sol.alternatives.map((d) => FS.solveFloors(without(m, sol, d)));
            for (const [grp, [lo, hi]] of sol.ranged) {
                expect(lo).toBe(Math.min(...per.map((p) => p.interval.get(grp)[0])));
                expect(hi).toBe(Math.max(...per.map((p) => p.interval.get(grp)[1])));
            }
            for (const [grp, v] of sol.floorOf) expect(per.every((p) => p.floorOf.get(grp) === v)).toBe(true);
            expect(sol.contradictions.length).toBeGreaterThan(0);
        });
    }
});

describe('⛓ 4. the spans; the doorway bound', () => {
    // S — A — B by doorways: each may change floor by one, or not.
    const m = model({ start: 's', groups: { S: ['s'], A: ['a1', 'a2'], B: ['b'] }, links: [['s', 'a1', 'warp'], ['a2', 'b', 'warp']] });
    it('a known answer: the pick keeps all on the ground floor (span 1); the max span counts both doors as floors (3)', () => {
        const sol = FS.solveFloors(m);
        expect(sol.spans).toEqual({ pick: 1, min: 1, max: 3 });
        expect(obj(sol.interval)).toEqual({ A: [-1, 1], B: [-2, 2], S: [0, 0] });
        expect(FS.floorAmbiguities(sol).doorways.length).toBe(2);
    });
    it('the ±1 bound is ONE constant: the default IS DOORWAY_FLOOR_BOUND; ±2 widens the max span to 5', () => {
        expect(FS.DOORWAY_FLOOR_BOUND).toBe(1);
        const a = FS.solveFloors(m); const b = FS.solveFloors(m, { bound: FS.DOORWAY_FLOOR_BOUND });
        expect([a.bound, obj(a.interval), a.spans]).toEqual([b.bound, obj(b.interval), b.spans]);
        const w = FS.solveFloors(m, { bound: 2 });
        expect(w.spans).toEqual({ pick: 1, min: 1, max: 5 });
        expect(w.interval.get('B')).toEqual([-4, 4]);
        // The source names the bound in one place: the constant, then only the `bound` parameter.
        const src = readFileSync(join(HERE, 'floorSolver.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(src.match(/DOORWAY_FLOOR_BOUND/g).length).toBe(3); // the export + the two defaults
        expect(src).toMatch(/\[-bound, bound\]/);
    });
});

describe('⛓ 5. determinism, the budget, the labels', () => {
    it('two insertion orders (links reversed, groups reversed) → the same pick, intervals, labels', () => {
        for (const [seed, g, n] of [[7, 6, 10], [23, 8, 12], [3, 8, 11]]) {
            const m = randomModel(seed, g, n);
            const rev = {
                ...m,
                layout: { ...m.layout, groups: [...m.layout.groups].reverse(), graph: { links: [...m.layout.graph.links].reverse() } },
                groupOf: new Map([...m.groupOf].reverse()),
            };
            const a = FS.solveFloors(m); const b = FS.solveFloors(rev);
            expect(obj(b.floorOf)).toEqual(obj(a.floorOf));
            expect(obj(b.interval)).toEqual(obj(a.interval));
            expect(obj(FS.floorLabels(b))).toEqual(obj(FS.floorLabels(a)));
        }
        const src = readFileSync(join(HERE, 'floorSolver.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date/);
    });
    it('past the budget the solve falls back (exact: false) to nearest-0 fixing on the last face: still consistent', () => {
        const m = randomModel(23, 8, 12);
        const exact = FS.solveFloors(m);
        const cut = FS.solveFloors(m, { budget: 200 });
        expect(exact.exact).toBe(true);
        expect(cut.exact).toBe(false);
        expect(cut.floorOf.size).toBe(exact.floorOf.size);
        for (const c of cut.connections) {
            const d = cut.floorOf.get(c.gb) - cut.floorOf.get(c.ga);
            expect(d >= c.lo && d <= c.hi, `${c.a}–${c.b}`).toBe(true);
        }
        expect(FS.solveFloors(m, { budget: 200 }).floorOf).toEqual(cut.floorOf); // a count, not a clock
    });
    it('the names: Ground floor, Floor +n / −n (U+2212), a range, Floor ?', () => {
        expect([0, 1, -1, -12, null].map(FS.floorName)).toEqual(['Ground floor', 'Floor +1', 'Floor −1', 'Floor −12', 'Floor ?']);
        expect([[-3, -1], [0, 2], [-1, 1], [2, 2], [null, 1]].map(([a, b]) => FS.floorRangeName(a, b)))
            .toEqual(['Floor −3 to −1', 'Floor 0 to +2', 'Floor −1 to +1', 'Floor +2', 'Floor ?']);
    });
});
