/**
 * procgenCore/regionLayout.test — the shared region layout (region-map step 3a, D1–D2).
 *
 * ⛓ THE WRAPPER PROOF: `ORACLE_canonicalLayout` below is `setMapLayout.canonicalLayout` COPIED VERBATIM from the
 * base before the move (9b99178fa7), kept test-only. The wrapper must equal it on random graphs (and
 * `seedlingSetMapLift.test.js`'s digests pin the vanilla 116 + a generated set through the real readers).
 *
 * MUTANTS (each turns a row red): a string sort of `nodes` inside `layoutRegions`; a min-shift in `layoutRegions`;
 * dropping the slide-right; placing a `down` group at the parent's top instead of under its bottom; R1 joining over
 * `down` links.
 */
import { describe, expect, it } from 'vitest';

import {
    CONSISTENT_RINGS, DIRS, GROUPING_RULES, OPPOSITE, RegionLayoutError, groupsOf, groupsR1, layoutGrouped,
    layoutRegions,
} from './regionLayout.js';
import { canonicalLayout } from './setMapLayout.js';

/* ── the oracle: the pre-move function, verbatim (only its `ring`/`RINGS` inlined) ── */
function oracleRing(r) {
    if (r === 0) return [{ dx: 0, dy: 0 }];
    const out = [];
    for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ dx, dy });
        }
    }
    const order = (c) => {
        const a = Math.atan2(c.dy, c.dx);
        return a < 0 ? a + 2 * Math.PI : a;
    };
    return out.sort((a, b) => (Math.abs(a.dx) + Math.abs(a.dy)) - (Math.abs(b.dx) + Math.abs(b.dy))
        || order(a) - order(b));
}
const ORACLE_RINGS = Array.from({ length: 40 }, (_, r) => oracleRing(r));
function ORACLE_canonicalLayout(graph) {
    const { n, start } = graph;
    const adj = Array.from({ length: n }, () => []);
    for (const l of graph.links) {
        if (l.from === l.to) continue;
        adj[l.from].push({ to: l.to, d: l.dir ? DIRS[l.dir] : null });
    }
    for (const l of graph.links) {
        if (l.from === l.to) continue;
        const d = l.dir ? DIRS[OPPOSITE[l.dir]] : null;
        adj[l.to].push({ to: l.from, d, inbound: true });
    }
    for (const list of adj) {
        list.forEach((e, i) => { e.order = i; });
        list.sort((a, b) => (a.d ? 0 : 1) - (b.d ? 0 : 1) || a.order - b.order);
    }
    const pos = new Array(n).fill(null);
    const taken = new Set();
    const k = (x, y) => `${x},${y}`;
    const place = (v, x, y, toward = null) => {
        const ok = (gx, gy) => {
            if (!toward) return true;
            const dx = gx - pos[toward.u].gx;
            const dy = gy - pos[toward.u].gy;
            const along = toward.d.dx * dx + toward.d.dy * dy;
            return along > 0 && Math.abs(toward.d.dy * dx + toward.d.dx * dy) <= along;
        };
        for (let r = 0; ; r += 1) {
            const cells = ORACLE_RINGS[r] ?? oracleRing(r);
            const strict = toward && r < CONSISTENT_RINGS;
            for (const c of cells) {
                const gx = x + c.dx;
                const gy = y + c.dy;
                if (!taken.has(k(gx, gy)) && (!strict || ok(gx, gy))) {
                    pos[v] = { gx, gy };
                    taken.add(k(gx, gy));
                    return;
                }
            }
        }
    };
    const bfs = (root) => {
        const queue = [root];
        while (queue.length) {
            const u = queue.shift();
            for (const { to, d } of adj[u]) {
                if (pos[to] !== null) continue;
                if (d) place(to, pos[u].gx + d.dx, pos[u].gy + d.dy, { u, d });
                else place(to, pos[u].gx, pos[u].gy);
                queue.push(to);
            }
        }
    };
    if (n === 0) return [];
    place(start, 0, 0);
    bfs(start);
    for (let v = 0; v < n; v += 1) {
        if (pos[v] !== null) continue;
        const maxX = Math.max(...pos.filter(Boolean).map((p) => p.gx));
        const minY = Math.min(...pos.filter(Boolean).map((p) => p.gy));
        place(v, maxX + 2, minY);
        bfs(v);
    }
    const mx = Math.min(...pos.map((p) => p.gx));
    const my = Math.min(...pos.map((p) => p.gy));
    return pos.map((p) => Object.freeze({ gx: p.gx - mx, gy: p.gy - my }));
}

/* ── a tiny deterministic rng for the generators (mulberry32) ── */
function rngOf(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const DIR_KEYS = ['N', 'E', 'S', 'W'];
function randomIndexGraph(seed) {
    const r = rngOf(seed);
    const n = 1 + Math.floor(r() * 30);
    const m = Math.floor(r() * n * 2);
    const links = [];
    for (let i = 0; i < m; i++) {
        links.push({
            from: Math.floor(r() * n), to: Math.floor(r() * n), dir: r() < 0.6 ? DIR_KEYS[Math.floor(r() * 4)] : null,
        });
    }
    return { n, start: Math.floor(r() * n), links };
}

describe('D1 — layoutRegions', () => {
    it('the start is exactly (0, 0), with signed coordinates around it (no min-shift)', () => {
        const pos = layoutRegions({
            nodes: ['a', 'b', 'c'], start: 'b', links: [{ from: 'b', to: 'a', dir: 'W' }, { from: 'b', to: 'c', dir: 'N' }],
        });
        expect(pos.get('b')).toEqual({ gx: 0, gy: 0 });
        expect(pos.get('a')).toEqual({ gx: -1, gy: 0 });
        expect(pos.get('c')).toEqual({ gx: 0, gy: -1 });
        for (let s = 1; s <= 50; s++) {
            const g = randomIndexGraph(s);
            const nodes = Array.from({ length: g.n }, (_, i) => `n${i}`);
            const out = layoutRegions({
                nodes, start: `n${g.start}`, links: g.links.map((l) => ({ ...l, from: `n${l.from}`, to: `n${l.to}` })),
            });
            expect(out.get(`n${g.start}`)).toEqual({ gx: 0, gy: 0 });
            expect([...out.keys()]).toEqual(nodes);
            expect(new Set([...out.values()].map((p) => `${p.gx},${p.gy}`)).size).toBe(nodes.length);
        }
    });

    it('is deterministic: the same input gives the same output', () => {
        for (let s = 1; s <= 20; s++) {
            const g = randomIndexGraph(s);
            const graph = () => ({
                nodes: Array.from({ length: g.n }, (_, i) => `r${i}`),
                start: `r${g.start}`,
                links: g.links.map((l) => ({ from: `r${l.from}`, to: `r${l.to}`, dir: l.dir })),
            });
            expect([...layoutRegions(graph())]).toEqual([...layoutRegions(graph())]);
        }
    });

    it('does NO internal sort: the `nodes` order is the canonical order ("10" stays after "2")', () => {
        // three disconnected nodes: each unreached one starts a new component in `nodes` order
        const a = layoutRegions({ nodes: ['0', '2', '10'], start: '0', links: [] });
        const b = layoutRegions({ nodes: ['0', '10', '2'], start: '0', links: [] });
        expect(a.get('2')).toEqual({ gx: 2, gy: 0 });
        expect(a.get('10')).toEqual({ gx: 4, gy: 0 });
        expect(b.get('10')).toEqual({ gx: 2, gy: 0 });
        expect(b.get('2')).toEqual({ gx: 4, gy: 0 });
    });

    it('refuses by name: a duplicate node, a start that is not a node, a link to an unknown node, a bad dir', () => {
        expect(() => layoutRegions({ nodes: ['a', 'a'], start: 'a', links: [] })).toThrow(/listed twice/);
        expect(() => layoutRegions({ nodes: ['a'], start: 'z', links: [] })).toThrow(RegionLayoutError);
        expect(() => layoutRegions({ nodes: ['a'], start: 'a', links: [{ from: 'a', to: 'q' }] })).toThrow(/not in `nodes`/);
        expect(() => layoutRegions({ nodes: ['a', 'b'], start: 'a', links: [{ from: 'a', to: 'b', dir: 'X' }] })).toThrow(/dir/);
        expect(layoutRegions({ nodes: [], start: undefined, links: [] }).size).toBe(0);
    });
});

describe('D1 — setMapLayout.canonicalLayout is a byte-identical wrapper', () => {
    it('equals the pre-move function on 400 random index graphs', () => {
        for (let s = 1; s <= 400; s++) {
            const g = randomIndexGraph(s);
            expect(JSON.stringify(canonicalLayout(g))).toBe(JSON.stringify(ORACLE_canonicalLayout(g)));
        }
    });
    it('keeps its refusal (as the caller\'s own error, named as setMapLayout)', () => {
        expect(() => canonicalLayout({ n: -1, start: 0, links: [] })).toThrow(/setMapLayout: a layout needs a room count/);
        expect(() => canonicalLayout({ n: 2, start: 0, links: [{ from: 0, to: 7 }] }, (m) => { throw new Error(`X ${m}`); }))
            .toThrow(/^X setMapLayout: link/);
        expect(canonicalLayout({ n: 0, start: 0, links: [] })).toEqual([]);
    });
});

/* ── D2 ── */
function randomGroupedGraph(seed, { dag = false } = {}) {
    const r = rngOf(seed);
    const n = 2 + Math.floor(r() * 40);
    const nodes = Array.from({ length: n }, (_, i) => `level_${i}`);
    // clusters: a node's cluster is a contiguous block, so `down` links between blocks make group-level DAGs
    const cluster = [];
    let c = 0;
    for (let i = 0; i < n; i++) {
        if (i > 0 && r() < 0.3) c += 1;
        cluster.push(c);
    }
    const links = [];
    for (let i = 0; i < n * 2; i++) {
        const a = Math.floor(r() * n);
        const b = Math.floor(r() * n);
        if (cluster[a] === cluster[b]) {
            links.push({ from: nodes[a], to: nodes[b], dir: r() < 0.5 ? DIR_KEYS[Math.floor(r() * 4)] : null, kind: 'join' });
        } else if (!dag || cluster[a] < cluster[b]) {
            links.push({ from: nodes[a], to: nodes[b], kind: r() < 0.8 ? 'down' : 'up' });
        }
    }
    // in a DAG an `up` must go from a lower cluster to a higher one: flip the ones the loop made the wrong way
    if (dag) for (const l of links) if (l.kind === 'up') [l.from, l.to] = [l.to, l.from];
    return { nodes, start: nodes[0], links };
}
const boxesClear = (a, b, gap) => a.maxX + gap < b.minX || b.maxX + gap < a.minX
    || a.maxY + gap < b.minY || b.maxY + gap < a.minY;

describe('D2 — groups (R1) and their placement', () => {
    it('R1 = connected components over `join` links only; `down`/`up` never join', () => {
        const g = {
            nodes: ['a', 'b', 'c', 'd', 'e'], start: 'a',
            links: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c', kind: 'down' }, { from: 'c', to: 'd', kind: 'join' },
                { from: 'e', to: 'a', kind: 'up' }],
        };
        expect(groupsR1(g)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
        expect(groupsOf(g, 'R1')).toEqual(groupsOf(g));
        expect(Object.keys(GROUPING_RULES)).toEqual(['R1']);
        expect(() => groupsOf(g, 'R9')).toThrow(/no grouping rule/);
    });

    it('a `down` group sits below, aligned under the linking cell; the start stays at (0, 0)', () => {
        const g = {
            nodes: ['top', 'top2', 'cellar', 'cellar2'], start: 'top',
            links: [{ from: 'top', to: 'top2', dir: 'E' }, { from: 'top2', to: 'cellar', kind: 'down' },
                { from: 'cellar', to: 'cellar2', dir: 'S' }],
        };
        const { positions, groups, stats } = layoutGrouped(g, { gap: 1 });
        expect(positions.get('top')).toEqual({ gx: 0, gy: 0 });
        expect(positions.get('top2')).toEqual({ gx: 1, gy: 0 });
        expect(positions.get('cellar')).toEqual({ gx: 1, gy: 2 });
        expect(positions.get('cellar2')).toEqual({ gx: 1, gy: 3 });
        expect(groups.map((x) => [x.root, x.placedBy])).toEqual([['top', 'start'], ['cellar', 'below']]);
        expect(stats.down).toEqual({ across: 1, below: 1 });
        expect(stats.groups).toBe(2);
        expect(stats.sizes).toEqual([2, 2]);
    });

    it('an `up`-only group goes above; an unlinked group goes right with the gap', () => {
        const g = {
            nodes: ['s', 'attic', 'island'], start: 's',
            links: [{ from: 's', to: 'attic', kind: 'up' }],
        };
        const { positions, groups } = layoutGrouped(g, { gap: 2 });
        expect(positions.get('s')).toEqual({ gx: 0, gy: 0 });
        expect(positions.get('attic')).toEqual({ gx: 0, gy: -3 });
        expect(positions.get('island')).toEqual({ gx: 3, gy: -3 });
        expect(groups.map((x) => x.placedBy)).toEqual(['start', 'above', 'right']);
    });

    it('a group\'s root: the start; else its first member entered by `down`; else by `up`; else its first member', () => {
        const g = {
            nodes: ['s', 'x1', 'x2', 'y1', 'y2'], start: 's',
            links: [{ from: 'x1', to: 'x2' }, { from: 's', to: 'x2', kind: 'down' }, { from: 'y1', to: 'y2' }],
        };
        const { groups, positions } = layoutGrouped(g);
        expect(groups.map((x) => x.root)).toEqual(['s', 'x2', 'y1']);
        expect(positions.get('x2').gx).toBe(0);
    });

    it('never overlaps two groups, and keeps the gap, over 300 random graphs (gap 0..3)', () => {
        for (let s = 1; s <= 300; s++) {
            const g = randomGroupedGraph(s);
            const gap = s % 4;
            const { positions, groups } = layoutGrouped(g, { gap });
            expect(positions.get(g.start)).toEqual({ gx: 0, gy: 0 });
            expect(new Set([...positions.values()].map((p) => `${p.gx},${p.gy}`)).size).toBe(g.nodes.length);
            for (let i = 0; i < groups.length; i++) {
                for (let j = i + 1; j < groups.length; j++) {
                    expect(boxesClear(groups[i].bbox, groups[j].bbox, gap), `seed ${s} groups ${i},${j}`).toBe(true);
                }
            }
            for (const gr of groups) {
                for (const id of gr.members) {
                    const p = positions.get(id);
                    expect(p.gx >= gr.bbox.minX && p.gx <= gr.bbox.maxX && p.gy >= gr.bbox.minY && p.gy <= gr.bbox.maxY).toBe(true);
                }
            }
        }
    });

    it('every `down` link across groups lands with its target group strictly below (DAG relations, 300 graphs)', () => {
        let across = 0;
        for (let s = 1; s <= 300; s++) {
            const g = randomGroupedGraph(s, { dag: true });
            const { groups, stats } = layoutGrouped(g);
            const gOf = new Map(groups.flatMap((x, gi) => x.members.map((id) => [id, gi])));
            for (const l of g.links) {
                const a = gOf.get(l.from);
                const b = gOf.get(l.to);
                if (a === b) continue;
                if (l.kind === 'down') {
                    across += 1;
                    expect(groups[b].bbox.minY, `seed ${s}`).toBeGreaterThan(groups[a].bbox.maxY);
                }
                if (l.kind === 'up') expect(groups[b].bbox.maxY, `seed ${s}`).toBeLessThan(groups[a].bbox.minY);
            }
            expect(stats.down.below).toBe(stats.down.across);
        }
        expect(across).toBeGreaterThan(300); // the property was exercised, not vacuous
    });

    it('is deterministic', () => {
        for (let s = 1; s <= 30; s++) {
            const a = layoutGrouped(randomGroupedGraph(s));
            const b = layoutGrouped(randomGroupedGraph(s));
            expect([...a.positions]).toEqual([...b.positions]);
            expect(a.groups).toEqual(b.groups);
            expect(a.stats).toEqual(b.stats);
        }
    });
});
