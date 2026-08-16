/**
 * procgenCore/areaGraph.test — the lock-and-key layer, driven on ABSTRACT
 * spaces.
 *
 * PROCGEN ELEMENTS arc 1, slice 1 (kickoff §3.1). ⛔ No substrate appears in
 * this file: the spaces below are hand-written area sets (a path, a 3x3 grid, a
 * star, a 4x4 grid with a hole, a 6-cycle), because the module's whole claim is
 * that lock-and-key logic does not know what an area IS. The maze binding
 * (slice 2) is where areas become chambers.
 *
 * ── WHAT THE TWO KINDS OF ROW ARE FOR ─────────────────────────────────
 *
 * · **PROPERTIES** over ≥ 200 seeds per space — the gate for "the graph is
 *   still a lock-and-key graph". ⚠ Every property is asserted only over
 *   ACCEPTED runs, so each space also states how many of its 200 seeds were
 *   accepted, EXACTLY: a change that starts refusing everything would otherwise
 *   turn every property row green by making it vacuous.
 * · **LITERAL FIXTURES** — three whole outputs pasted in (trap 250: a fixed
 *   point tests self-consistency, never correctness). The properties cannot see
 *   a change that keeps every law and MOVES the graph; the fixtures can, and
 *   only the fixtures can.
 *
 * ⛔ REACHABILITY HERE IS THIS FILE'S OWN FIVE-LINE BFS, not
 * `procgenCore/gridFlood.connected` — that floods grid CELLS and an area graph
 * has none (⚖ arc ruling 5's "one flood" is about the grid). And it walks the
 * MODULE'S OWN OUTPUT EDGES rather than the input adjacency, which is the point:
 * a cut claim checked against the input space would be checking the space.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from './procgenRng.js';
import { AreaGraphError, DEFAULT_AREA_BOUNDS, buildAreaGraph } from './areaGraph.js';

/* ── The stream ───────────────────────────────────────────────────────── */

/**
 * mulberry32, transcribed from `shared/rng.js` — the arithmetic the MAZE
 * binding's source uses (`mazeRoom/procgenRng.js`). ⛔ Transcribed rather than
 * imported: a `procgenCore` test that reached into `mazeRoom/` would be a
 * shared module tested through one substrate, which is the thing
 * `skeletonKinds.test.js` says out loud. What is under test here is the DRAW
 * ORDER, and any deterministic stream exercises it.
 */
const mulberry32 = (seed) => {
    let s = seed | 0;
    return () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const SOURCE = Object.freeze({
    name: 'mulberry32 (areaGraph.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});

const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

/* ── The spaces ───────────────────────────────────────────────────────── */

const pathSpace = (n) => {
    const ids = [...Array(n)].map((_, i) => String.fromCharCode(97 + i));
    return {
        name: `path${n}`,
        areas: ids.map((id) => ({ id })),
        adjacency: ids.slice(1).map((id, i) => [ids[i], id]),
        entrance: ids[0],
        goal: ids[n - 1],
    };
};

const gridSpace = (w, h, holes = []) => {
    const present = (x, y) => !holes.some(([hx, hy]) => hx === x && hy === y);
    const id = (x, y) => `r${y}c${x}`;
    const areas = [];
    const adjacency = [];
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) if (present(x, y)) areas.push({ id: id(x, y) });
    }
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            if (!present(x, y)) continue;
            if (x + 1 < w && present(x + 1, y)) adjacency.push([id(x, y), id(x + 1, y)]);
            if (y + 1 < h && present(x, y + 1)) adjacency.push([id(x, y), id(x, y + 1)]);
        }
    }
    return {
        name: `grid${w}x${h}${holes.length ? `-hole` : ''}`,
        areas,
        adjacency,
        entrance: id(0, 0),
        goal: id(w - 1, h - 1),
    };
};

/** A hub with `n` spokes; entrance and goal are two different spokes. */
const starSpace = (n) => {
    const spokes = [...Array(n)].map((_, i) => `p${i}`);
    return {
        name: `star${n}`,
        areas: [{ id: 'hub' }, ...spokes.map((id) => ({ id }))],
        adjacency: spokes.map((id) => ['hub', id]),
        entrance: 'p0',
        goal: 'p1',
    };
};

/** A ring — the only space here where the ENTRANCE and the GOAL are adjacent. */
const cycleSpace = (n) => {
    const ids = [...Array(n)].map((_, i) => String.fromCharCode(97 + i));
    return {
        name: `cycle${n}`,
        areas: ids.map((id) => ({ id })),
        adjacency: ids.map((id, i) => [id, ids[(i + 1) % n]]),
        entrance: ids[0],
        goal: ids[1],
    };
};

const build = (space, seed, bounds) => buildAreaGraph({
    rng: rngFor(seed),
    areas: space.areas,
    adjacency: space.adjacency,
    entrance: space.entrance,
    goal: space.goal,
    bounds,
});

const SEEDS = [...Array(200)].map((_, i) => i + 1);

/**
 * The census the property rows stand on. ⚠ EXACT counts, not "> 0": these are
 * what makes a property row non-vacuous, so they are the first thing that must
 * redden when the module starts refusing.
 */
const CASES = [
    { space: pathSpace(5), bounds: { maxKeys: 1 }, accepted: 200 },
    { space: gridSpace(3, 3), bounds: { maxKeys: 1 }, accepted: 200 },
    { space: gridSpace(3, 3), bounds: { maxKeys: 2 }, accepted: 200 },
    { space: gridSpace(4, 4, [[1, 1]]), bounds: { maxKeys: 2 }, accepted: 200 },
    { space: gridSpace(4, 4, [[1, 1]]), bounds: { maxKeys: 3 }, accepted: 200 },
    { space: starSpace(5), bounds: { maxKeys: 1 }, accepted: 200 },
    { space: cycleSpace(6), bounds: { maxKeys: 1 }, accepted: 200 },
    /** ⚠ the one case that does NOT accept every seed — see property 7. */
    { space: cycleSpace(8), bounds: { maxKeys: 1 }, accepted: 190 },
    { space: gridSpace(3, 3), bounds: { maxKeys: 0 }, accepted: 200 },
];

const label = ({ space, bounds }) => `${space.name} maxKeys=${bounds.maxKeys}`;

/** Every accepted run of one case, with its seed. */
const acceptedRuns = ({ space, bounds }) => SEEDS
    .map((seed) => ({ seed, out: build(space, seed, bounds) }))
    .filter(({ out }) => out.refused === null);

/* ── Reachability over the OUTPUT ─────────────────────────────────────── */

/** Areas reachable from `entrance` holding exactly `inventory`. No collecting. */
const reachableWith = (out, entrance, inventory) => {
    const inv = new Set(inventory);
    const reached = new Set([entrance]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const e of out.edges) {
            if (e.lock !== null && !inv.has(e.lock)) continue;
            if (reached.has(e.a) && !reached.has(e.b)) { reached.add(e.b); changed = true; }
            if (reached.has(e.b) && !reached.has(e.a)) { reached.add(e.a); changed = true; }
        }
    }
    return reached;
};

/**
 * ⛓ THE FORWARD SIMULATION — walk from the entrance, pick up every key in every
 * area you can stand in, repeat until nothing new opens. This is what "the
 * level is solvable" means and it is deliberately NOT the module's own
 * bookkeeping: it reads only `edges` and `areas[*].item`.
 */
const simulate = (out, entrance) => {
    const inv = new Set();
    let reached = new Set([entrance]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const id of reached) {
            const item = out.areas[id].item;
            if (item && /^K\d+$/.test(item) && !inv.has(item)) { inv.add(item); changed = true; }
        }
        const next = reachableWith(out, entrance, inv);
        if (next.size !== reached.size) { reached = next; changed = true; }
    }
    return { reached, inv };
};

const keysBelow = (n) => [...Array(n)].map((_, i) => `K${i}`);

const treeEdges = (out) => out.edges.filter((e) => e.kind === 'tree');
const childOf = (out, edge) => (out.areas[edge.b].parent === edge.a ? edge.b : edge.a);

/* ── 0. The census ────────────────────────────────────────────────────── */

describe('areaGraph — the census the property rows stand on', () => {
    it.each(CASES)('$space.name accepts a known number of the 200 seeds', (kase) => {
        const runs = acceptedRuns(kase);
        expect(`${label(kase)}: ${runs.length}/200`)
            .toBe(`${label(kase)}: ${kase.accepted}/200`);
    });

    /**
     * ⛔ THE VACUOUS ACCEPT THIS MODULE'S FIRST DRAFT SHIPPED. With MetaZelda's
     * own `roomsPerLock = maxRooms / maxKeys` the 5-area path accepted 200/200
     * at `maxKeys: 1` with **no lock at all** — level 0's target was only met
     * once every area was assigned. Every property below was green on it. So
     * "accepted" is not enough: a run that asked for keys must HAVE them.
     */
    it.each(CASES.filter((k) => k.bounds.maxKeys > 0))(
        '$space.name at maxKeys > 0 really carries its keys and locks', (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                expect(`${label(kase)} seed ${seed}: ${out.symbols.join(',')}`)
                    .toBe(`${label(kase)} seed ${seed}: ${keysBelow(kase.bounds.maxKeys).join(',')}`);
                for (const key of keysBelow(kase.bounds.maxKeys)) {
                    const holders = Object.values(out.areas).filter((a) => a.item === key);
                    expect(`${label(kase)} seed ${seed}: ${key} placed ${holders.length}x`)
                        .toBe(`${label(kase)} seed ${seed}: ${key} placed 1x`);
                    const locked = out.edges.filter((e) => e.lock === key);
                    expect(`${label(kase)} seed ${seed}: ${key} locks ${locked.length > 0}`)
                        .toBe(`${label(kase)} seed ${seed}: ${key} locks true`);
                }
            }
        });
});

/* ── 1. Locked edges are CUTS ─────────────────────────────────────────── */

describe('areaGraph — property 1: a K_n lock is a CUT for a player below level n', () => {
    /**
     * ⚠⚠ THE KICKOFF SPELLS THIS "a cut of the area graph between entrance and
     * goal", and that spelling is not quite testable as written, for two
     * reasons this file found and states rather than working around:
     *
     *  · a K_n-locked tree edge into a SIBLING subtree is not on the
     *    entrance→goal path at all, so removing it disconnects nothing between
     *    them;
     *  · with FULL inventory a `graphify` edge may legitimately bypass a tree
     *    edge that IS on the path — ⚖ ruling 16's post-solve shortcut is
     *    precisely such an edge.
     *
     * The claim that is true, stronger, and about the thing the kickoff means
     * (a lock partitions the level) is INVENTORY-GRADED: **holding
     * {K_0..K_{n-1}} and nothing else, no area of key level > n is reachable
     * from the entrance over ANY edge** — tree or graphify. Which makes each
     * K_n lock a cut in the only sense a lock can be one, and covers the goal
     * (property 4 puts it at the top level) as a corollary.
     */
    it.each(CASES.filter((k) => k.bounds.maxKeys > 0))(
        '$space.name — areas above the held key level are unreachable', (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                for (let n = 0; n <= kase.bounds.maxKeys; n += 1) {
                    const reached = reachableWith(out, kase.space.entrance, keysBelow(n));
                    const tooDeep = [...reached].filter((id) => out.areas[id].keyLevel > n);
                    expect(`${label(kase)} seed ${seed} holding ${n} key(s): `
                        + `${JSON.stringify(tooDeep)}`)
                        .toBe(`${label(kase)} seed ${seed} holding ${n} key(s): []`);
                }
            }
        });

    it.each(CASES.filter((k) => k.bounds.maxKeys > 0))(
        '$space.name — and the key OPENS it: the child of every K_n tree edge '
        + 'is reachable at level n+1', (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                for (const edge of treeEdges(out).filter((e) => e.lock !== null)) {
                    const n = Number(edge.lock.slice(1));
                    const child = childOf(out, edge);
                    const without = reachableWith(out, kase.space.entrance, keysBelow(n));
                    const withKey = reachableWith(out, kase.space.entrance, keysBelow(n + 1));
                    expect(`${label(kase)} seed ${seed} ${edge.lock} → ${child}: `
                        + `${without.has(child)}/${withKey.has(child)}`)
                        .toBe(`${label(kase)} seed ${seed} ${edge.lock} → ${child}: false/true`);
                }
            }
        });
});

/* ── 2. Key levels and preconditions ──────────────────────────────────── */

describe('areaGraph — property 2: key levels, preconditions, and where a key lies', () => {
    /**
     * ⛓ THE PORT USES "=", NOT "≤": an area of key level n has precondition
     * EXACTLY {K_0..K_{n-1}} — MetaZelda's `Condition` is a COUNT (its own
     * docblock: *"since there is always a time ordering on the collection of
     * keys, this can be implemented as a count"*), so a precondition is never a
     * sparse subset. `implies` is `keyLevel >= other.keyLevel`, which is where
     * the "≤" lives: a player at level n satisfies every precondition up to n.
     */
    it.each(CASES)('$space.name — precond is exactly K_0..K_{level-1}', (kase) => {
        for (const { seed, out } of acceptedRuns(kase)) {
            for (const [id, area] of Object.entries(out.areas)) {
                expect(`${label(kase)} seed ${seed} ${id}: ${JSON.stringify(area.precond)}`)
                    .toBe(`${label(kase)} seed ${seed} ${id}: `
                        + `${JSON.stringify(keysBelow(area.keyLevel))}`);
            }
        }
    });

    it.each(CASES.filter((k) => k.bounds.maxKeys > 0))(
        '$space.name — every key K_n lies in an area of key level EXACTLY n', (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                for (const [id, area] of Object.entries(out.areas)) {
                    if (!area.item || !/^K\d+$/.test(area.item)) continue;
                    expect(`${label(kase)} seed ${seed} ${area.item} in ${id} at level `
                        + `${area.keyLevel}`)
                        .toBe(`${label(kase)} seed ${seed} ${area.item} in ${id} at level `
                            + `${Number(area.item.slice(1))}`);
                }
            }
        });

    it.each(CASES.filter((k) => k.bounds.maxKeys > 0))(
        '$space.name — a K_n-locked tree edge leads to a child of level n+1', (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                for (const edge of treeEdges(out).filter((e) => e.lock !== null)) {
                    const child = childOf(out, edge);
                    expect(`${label(kase)} seed ${seed} ${edge.lock} → level `
                        + `${out.areas[child].keyLevel}`)
                        .toBe(`${label(kase)} seed ${seed} ${edge.lock} → level `
                            + `${Number(edge.lock.slice(1)) + 1}`);
                }
            }
        });
});

/* ── 3. The one-symbol law ────────────────────────────────────────────── */

describe('areaGraph — property 3: graphify obeys the ONE-SYMBOL law', () => {
    it.each(CASES)('$space.name — equal preconds ⇒ free; one symbol apart ⇒ locked by it',
        (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                for (const edge of out.edges.filter((e) => e.kind === 'graphify')) {
                    const a = out.areas[edge.a];
                    const bb = out.areas[edge.b];
                    const expected = a.keyLevel === bb.keyLevel
                        ? null
                        : `K${Math.max(a.keyLevel, bb.keyLevel) - 1}`;
                    expect(`${label(kase)} seed ${seed} ${edge.a}(${a.keyLevel})–`
                        + `${edge.b}(${bb.keyLevel}): ${edge.lock}`)
                        .toBe(`${label(kase)} seed ${seed} ${edge.a}(${a.keyLevel})–`
                            + `${edge.b}(${bb.keyLevel}): ${expected}`);
                    /**
                     * ⚠⚠ **A GAP OF MORE THAN ONE LEVEL IS LEGAL, AND THAT IS
                     * NOT A HOLE IN THE LAW.** This row first asserted "never
                     * two levels apart" and MEASURED a level-0 ↔ level-2 edge
                     * locked by `K1` (grid4x4-hole, maxKeys 2, seed 4). It is
                     * correct: MetaZelda's `Condition` is a COUNT, so
                     * `Condition({}).and(K1)` is key level **2** — a player
                     * holding K1 necessarily already holds K0, because the keys
                     * are collected in one time order. One symbol really does
                     * make the two conditions identical, and the edge hands the
                     * player nothing they could not already have. So the law is
                     * "the lock is K_{max(level)-1}", asserted above, and the
                     * gap is whatever the tree made.
                     */
                    expect(edge.lock).toBe(expected);
                }
            }
        });

    it.each(CASES)('$space.name — every edge joins areas the SPACE says are adjacent',
        (kase) => {
            const adjacent = new Set(kase.space.adjacency
                .flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
            for (const { seed, out } of acceptedRuns(kase)) {
                for (const edge of out.edges) {
                    expect(`${label(kase)} seed ${seed} ${edge.kind} ${edge.a}|${edge.b}`)
                        .toBe(`${label(kase)} seed ${seed} ${edge.kind} `
                            + `${adjacent.has(`${edge.a}|${edge.b}`) ? `${edge.a}|${edge.b}` : 'NOT-ADJACENT'}`);
                }
                /** and no pair is listed twice (the edge list is a SET of pairs). */
                const pairs = out.edges.map((e) => [e.a, e.b].sort().join('|'));
                expect(`${label(kase)} seed ${seed}: ${pairs.length} edges, `
                    + `${new Set(pairs).size} pairs`)
                    .toBe(`${label(kase)} seed ${seed}: ${pairs.length} edges, `
                        + `${pairs.length} pairs`);
            }
        });
});

/* ── 4. The entrance, the goal, the tree ──────────────────────────────── */

describe('areaGraph — property 4: the entrance is level 0 and the goal is at the top', () => {
    it.each(CASES)('$space.name', (kase) => {
        for (const { seed, out } of acceptedRuns(kase)) {
            const top = Math.max(...Object.values(out.areas).map((a) => a.keyLevel));
            expect(`${label(kase)} seed ${seed}: entrance level `
                + `${out.areas[kase.space.entrance].keyLevel}, item `
                + `${out.areas[kase.space.entrance].item}, goal level `
                + `${out.areas[kase.space.goal].keyLevel} of ${top}, item `
                + `${out.areas[kase.space.goal].item}`)
                .toBe(`${label(kase)} seed ${seed}: entrance level 0, item START, `
                    + `goal level ${top} of ${top}, item GOAL`);
            /** ⚖ arc ruling 2's other half: the top level IS the key budget. */
            expect(top).toBe(kase.bounds.maxKeys);
        }
    });

    it.each(CASES)('$space.name — solutionPath walks entrance→goal along parents', (kase) => {
        for (const { seed, out } of acceptedRuns(kase)) {
            const path = out.solutionPath;
            expect(`${label(kase)} seed ${seed}: ${path[0]}→${path[path.length - 1]}`)
                .toBe(`${label(kase)} seed ${seed}: ${kase.space.entrance}→${kase.space.goal}`);
            for (let i = 1; i < path.length; i += 1) {
                expect(`${label(kase)} seed ${seed}: parent of ${path[i]} is `
                    + `${out.areas[path[i]].parent}`)
                    .toBe(`${label(kase)} seed ${seed}: parent of ${path[i]} is ${path[i - 1]}`);
            }
            /** the tree is a tree: every non-entrance area has a parent, no cycles. */
            for (const [id, area] of Object.entries(out.areas)) {
                if (id === kase.space.entrance) {
                    expect(area.parent).toBeNull();
                    continue;
                }
                let hops = 0;
                let cursor = id;
                while (out.areas[cursor].parent !== null) {
                    cursor = out.areas[cursor].parent;
                    hops += 1;
                    expect(hops).toBeLessThanOrEqual(kase.space.areas.length);
                }
                expect(`${label(kase)} seed ${seed}: ${id} roots at ${cursor}`)
                    .toBe(`${label(kase)} seed ${seed}: ${id} roots at ${kase.space.entrance}`);
            }
        }
    });
});

/* ── 5. The level solves ──────────────────────────────────────────────── */

describe('areaGraph — property 5: the graph is SOLVABLE by forward simulation', () => {
    /**
     * ⛓ Pick up what you can reach, walk what that opens, repeat. Every area
     * must fall out reachable — not only the goal: an unreachable area would be
     * a region a binding carves and no player ever sees.
     */
    it.each(CASES)('$space.name', (kase) => {
        for (const { seed, out } of acceptedRuns(kase)) {
            const { reached, inv } = simulate(out, kase.space.entrance);
            expect(`${label(kase)} seed ${seed}: goal reached ${reached.has(kase.space.goal)}, `
                + `${reached.size}/${kase.space.areas.length} areas, keys ${inv.size}`)
                .toBe(`${label(kase)} seed ${seed}: goal reached true, `
                    + `${kase.space.areas.length}/${kase.space.areas.length} areas, `
                    + `keys ${kase.bounds.maxKeys}`);
        }
    });

    it.each(CASES.filter((k) => k.bounds.maxKeys > 0))(
        '$space.name — and REMOVING any one key strands the goal (the differential)', (kase) => {
            for (const { seed, out } of acceptedRuns(kase)) {
                for (const key of keysBelow(kase.bounds.maxKeys)) {
                    const stripped = {
                        ...out,
                        areas: Object.fromEntries(Object.entries(out.areas).map(([id, a]) => [
                            id, a.item === key ? { ...a, item: null } : a,
                        ])),
                    };
                    const { reached } = simulate(stripped, kase.space.entrance);
                    expect(`${label(kase)} seed ${seed} without ${key}: goal `
                        + `${reached.has(kase.space.goal)}`)
                        .toBe(`${label(kase)} seed ${seed} without ${key}: goal false`);
                }
            }
        });
});

/* ── 6. Determinism ───────────────────────────────────────────────────── */

describe('areaGraph — property 6: the seed IS the identity', () => {
    it('two runs of one seed are byte-identical, and a different seed differs', () => {
        const space = gridSpace(3, 3);
        for (const seed of [1, 2, 3, 7, 42, 199]) {
            const a = JSON.stringify(build(space, seed, { maxKeys: 2 }));
            const b = JSON.stringify(build(space, seed, { maxKeys: 2 }));
            expect(`seed ${seed} twice: ${a === b}`).toBe(`seed ${seed} twice: true`);
        }
        const outs = SEEDS.slice(0, 40)
            .map((seed) => JSON.stringify(build(space, seed, { maxKeys: 2 })));
        /** ⚠ "usually different" is a MEASUREMENT: 40 seeds, how many shapes? */
        expect(`${new Set(outs).size}/40 distinct`).toBe('40/40 distinct');
    });

    it('a run leaves the caller\'s stream advanced by exactly `draws`', () => {
        const rng = rngFor(5);
        rng.next();
        const before = rng.draws;
        const space = gridSpace(3, 3);
        const out = buildAreaGraph({
            rng,
            areas: space.areas,
            adjacency: space.adjacency,
            entrance: space.entrance,
            goal: space.goal,
            bounds: { maxKeys: 2 },
        });
        expect(rng.draws - before).toBe(out.draws);
        const phases = Object.values(out.drawsByPhase).reduce((s, n) => s + n, 0);
        expect(`phases sum ${phases} vs draws ${out.draws}`)
            .toBe(`phases sum ${out.draws} vs draws ${out.draws}`);
    });
});

/* ── 7. Bounds and refusals ───────────────────────────────────────────── */

describe('areaGraph — property 7: every bound is named, and a refusal is data', () => {
    it('past maxRetries it REFUSES by name, with the same draws on two runs', () => {
        const space = pathSpace(3);
        /**
         * ⛓ A 3-area path at `maxKeys: 1`: level 0 is the entrance alone (it
         * holds START), so K0 has nowhere to go — at every seed, every attempt.
         * The honest answer is a refusal that names the reason, not a throw.
         */
        const first = build(space, 3, { maxKeys: 1 });
        const second = build(space, 3, { maxKeys: 1 });
        expect(first.refused?.reason).toBe('no-area-at-that-key-level-can-hold-its-key');
        expect(first.refused?.detail).toMatch(/key K0 needs an area at key level 0/);
        expect(first.attempts).toBe(DEFAULT_AREA_BOUNDS.maxRetries + 1);
        expect(first.draws).toBe(second.draws);
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
        expect(first.areas).toEqual({});
        expect(first.edges).toEqual([]);
    });

    it('maxRetries: 0 spends ONE attempt', () => {
        const out = build(pathSpace(3), 3, { maxKeys: 1, maxRetries: 0 });
        expect(out.attempts).toBe(1);
        expect(out.refused?.attempts).toBe(1);
    });

    it('a space too small for maxKeys refuses by name, naming the budget', () => {
        /**
         * ⛓ 3 areas, 3 keys: `areasPerLock` floors to 0, so growth starts a
         * lock at every step and runs out of areas at key level 2. MEASURED:
         * this is the only shape that reaches this refusal — with
         * `areasPerLock >= 1` the budget is always spent (each added area
         * advances the current level's count), so the reason fires exactly when
         * `maxKeys > areas - 1`.
         */
        const out = build(pathSpace(3), 1, { maxKeys: 3 });
        expect(out.refused?.reason).toBe('the-space-grew-fewer-key-levels-than-maxKeys');
        expect(out.refused?.detail).toMatch(/bounds\.maxKeys is 3/);
        expect(out.refused?.detail).toMatch(/grew 3 key level\(s\) over 3 area\(s\)/);
    });

    /**
     * ⚖ Ruling 2's refusal, shown where it actually happens: an 8-ring at one
     * key, where the tree sometimes reaches the goal (the entrance's neighbour!)
     * before it starts its lock, leaving the goal at level 0 under a level-1
     * graph.
     */
    it('the goal below the top key level is a REFUSAL with ruling 2\'s reason', () => {
        const space = cycleSpace(8);
        const reasons = new Map();
        for (const seed of SEEDS) {
            const out = build(space, seed, { maxKeys: 1 });
            if (out.refused) reasons.set(out.refused.reason, (reasons.get(out.refused.reason) ?? 0) + 1);
        }
        expect([...reasons.entries()]).toEqual([['goal-area-is-not-at-the-highest-key-level', 10]]);
        const refused = SEEDS.map((seed) => build(space, seed, { maxKeys: 1 }))
            .find((out) => out.refused);
        expect(refused.refused.detail).toMatch(/grew at key level 0, but the graph reached/);
    });

    it('maxKeys: 0 ⇒ no locks, no keys, ONE key level — and graphify still runs', () => {
        const space = gridSpace(3, 3);
        let graphifyEdges = 0;
        for (const seed of SEEDS) {
            const out = build(space, seed, { maxKeys: 0 });
            expect(out.refused).toBeNull();
            expect(out.symbols).toEqual([]);
            expect(out.edges.every((e) => e.lock === null)).toBe(true);
            expect(Object.values(out.areas).every((a) => a.keyLevel === 0)).toBe(true);
            expect(Object.values(out.areas).filter((a) => /^K\d+$/.test(a.item ?? '')).length)
                .toBe(0);
            graphifyEdges += out.edges.filter((e) => e.kind === 'graphify').length;
        }
        /** ⚠ MEASURED, so "graphify still runs" is not a claim about a no-op. */
        expect(`${graphifyEdges} graphify edges over 200 seeds`)
            .toBe('277 graphify edges over 200 seeds');
    });

    it('graphifyProbability 0 and 1 bracket the extra edges', () => {
        const space = gridSpace(3, 3);
        for (const seed of [1, 2, 3]) {
            const none = build(space, seed, { maxKeys: 0, graphifyProbability: 0 });
            const all = build(space, seed, { maxKeys: 0, graphifyProbability: 1 });
            expect(none.edges.filter((e) => e.kind === 'graphify').length).toBe(0);
            /** every adjacency the tree did not use, at one key level. */
            expect(all.edges.length).toBe(space.adjacency.length);
        }
    });

    it('refuses a bad bound BY NAME', () => {
        const space = pathSpace(5);
        const at = (bounds) => () => build(space, 1, bounds);
        expect(at({ maxKeys: -1 })).toThrow(/bounds\.maxKeys must be a non-negative integer/);
        expect(at({ maxKeys: 1.5 })).toThrow(AreaGraphError);
        expect(at({ maxRetries: '20' })).toThrow(/bounds\.maxRetries/);
        expect(at({ maxSwitches: -2 })).toThrow(/bounds\.maxSwitches/);
        expect(at({ graphifyProbability: 1.2 }))
            .toThrow(/graphifyProbability must be a number in \[0, 1\]/);
        expect(at({ allowGoalShortcut: 'yes' })).toThrow(/allowGoalShortcut must be a boolean/);
        expect(at({ maxRoooms: 4 })).toThrow(/unknown bound `maxRoooms`/);
    });

    it('the output carries the bounds THAT RAN, frozen', () => {
        const out = build(pathSpace(5), 1, { maxKeys: 1, graphifyProbability: 0.5 });
        expect(out.bounds).toEqual({
            maxKeys: 1,
            maxRetries: 20,
            graphifyProbability: 0.5,
            maxSwitches: 0,
            allowGoalShortcut: true,
        });
        expect(Object.isFrozen(out.bounds)).toBe(true);
        expect(Object.isFrozen(DEFAULT_AREA_BOUNDS)).toBe(true);
    });

    it('refuses a malformed SPACE by name — every one a caller defect, so a THROW', () => {
        const ok = { areas: [{ id: 'a' }, { id: 'b' }], adjacency: [['a', 'b']], entrance: 'a', goal: 'b' };
        const at = (patch) => () => buildAreaGraph({ rng: rngFor(1), ...ok, ...patch });
        expect(at({ areas: [] })).toThrow(/`areas` must be a non-empty array/);
        expect(at({ areas: [{ id: 'a' }, { id: 'a' }] })).toThrow(/duplicate area id "a"/);
        expect(at({ areas: [{ id: 'a' }, { id: {} }] })).toThrow(/needs an `id`/);
        expect(at({ adjacency: [['a', 'z']] })).toThrow(/adjacency names unknown area "z"/);
        expect(at({ adjacency: [['a', 'a'], ['a', 'b']] })).toThrow(/self-loop/);
        expect(at({ adjacency: [['a', 'b'], ['b', 'a']] })).toThrow(/more than once/);
        expect(at({ entrance: 'z' })).toThrow(/`entrance` is "z"/);
        expect(at({ goal: 'z' })).toThrow(/`goal` is "z"/);
        expect(at({ goal: 'a' })).toThrow(/entrance and goal are both "a"/);
        expect(at({ areas: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }))
            .toThrow(/not reachable from the entrance "a": \["c"\]/);
        expect(() => buildAreaGraph({ ...ok })).toThrow(/the rng must carry/);
        expect(at({ areas: [{ id: 'a' }, { id: 'b', capacity: { item: 'no' } }] }))
            .toThrow(/capacity\.item = "no"/);
    });

    it('a goal that cannot be reached over the adjacency says so BY NAME', () => {
        expect(() => buildAreaGraph({
            rng: rngFor(1),
            areas: [{ id: 'a' }, { id: 'b' }, { id: 'far' }],
            adjacency: [['a', 'b']],
            entrance: 'a',
            goal: 'far',
        })).toThrow(/goal area "far" is not reachable from the entrance "a"/);
    });

    it('capacity.item = false pushes the key elsewhere, and refuses when nowhere is left', () => {
        /** a 4-path: level 0 = {a(START), b}; b refusing items leaves nowhere for K0. */
        const ids = ['a', 'b', 'c', 'd'];
        const space = {
            areas: [{ id: 'a' }, { id: 'b', capacity: { item: false } }, { id: 'c' }, { id: 'd' }],
            adjacency: ids.slice(1).map((id, i) => [ids[i], id]),
            entrance: 'a',
            goal: 'd',
        };
        const out = buildAreaGraph({ rng: rngFor(1), ...space, bounds: { maxKeys: 1 } });
        expect(out.refused?.reason).toBe('no-area-at-that-key-level-can-hold-its-key');
    });
});

/* ── 8. The switch (⚖ arc ruling 1: ported, unit-tested, INERT here) ──── */

describe('areaGraph — property 8: placeSwitches, on an abstract graph', () => {
    const space = gridSpace(3, 3);

    it('at maxSwitches: 0 it is INERT — byte-identical to a run without it', () => {
        for (const seed of [1, 2, 3, 11, 77]) {
            const withZero = JSON.stringify(build(space, seed, { maxKeys: 1, maxSwitches: 0 }));
            const without = JSON.stringify(build(space, seed, { maxKeys: 1 }));
            expect(`seed ${seed}: ${withZero === without}`).toBe(`seed ${seed}: true`);
            expect(withZero).not.toMatch(/"SW"|"ON"|"OFF"/);
        }
    });

    it('at maxSwitches: 1 it places SW and locks child edges by ON/OFF', () => {
        const out = build(space, 1, { maxKeys: 1, maxSwitches: 1 });
        expect(out.refused).toBeNull();
        expect(out.symbols).toEqual(['K0', 'SW']);
        const switchAreas = Object.entries(out.areas).filter(([, a]) => a.item === 'SW');
        expect(switchAreas.length).toBe(1);
        const stateLocked = out.edges.filter((e) => e.lock === 'ON' || e.lock === 'OFF');
        expect(stateLocked.length).toBeGreaterThan(0);
        /**
         * ⚠ MORE THAN ONE base area can carry state-locked children, and that is
         * the PORT rather than a slip: `switchLockChildRooms` RECURSES into a
         * child whose edge it did not lock, so a second parent deeper in the
         * tree locks children of its own. What placeSwitches guarantees is the
         * OUTERMOST one: an area on the solution path, with a parent and more
         * than one child.
         */
        for (const edge of stateLocked.filter((e) => e.kind === 'tree')) {
            expect(`${edge.a}→${edge.b} parent ${out.areas[edge.b].parent}`)
                .toBe(`${edge.a}→${edge.b} parent ${edge.a}`);
        }
        const bases = [...new Set(stateLocked.filter((e) => e.kind === 'tree').map((e) => e.a))];
        const onPath = bases.filter((id) => out.solutionPath.includes(id)
            && out.areas[id].parent !== null
            && Object.values(out.areas).filter((a) => a.parent === id).length > 1);
        expect(`${bases.length} base(s), ${onPath.length} of them the solution-path base`)
            .toBe('2 base(s), 1 of them the solution-path base');
        /** and the switch itself sits where the player can reach it before the lock. */
        const switchArea = out.areas[switchAreas[0][0]];
        expect(switchArea.precond.every((p) => p !== 'ON' && p !== 'OFF')).toBe(true);
    });

    it('the state-locked descendants carry the state in their precond', () => {
        const out = build(space, 1, { maxKeys: 1, maxSwitches: 1 });
        for (const edge of out.edges.filter((e) => (e.lock === 'ON' || e.lock === 'OFF')
            && e.kind === 'tree')) {
            const child = childOf(out, edge);
            expect(`${child} precond ${JSON.stringify(out.areas[child].precond)}`)
                .toBe(`${child} precond `
                    + `${JSON.stringify([...keysBelow(out.areas[child].keyLevel), edge.lock])}`);
        }
    });

    /**
     * ⚠ WHAT IS **NOT** ASSERTED HERE: that a switched level is SOLVABLE. A
     * switch is not an item you keep — the player may flip it either way, and
     * whether a particular flip strands them is a question about the realised
     * level, which is arc 2's (the maze BFS over `(player, blocks, pressed)` is
     * its oracle). Ruling 1 keeps `maxSwitches: 0` until then; these rows gate
     * the PORT, not a level.
     */
    it('a run at maxSwitches: 1 over 200 seeds never throws and always places SW', () => {
        let placed = 0;
        for (const seed of SEEDS) {
            const out = build(space, seed, { maxKeys: 1, maxSwitches: 1 });
            if (!out.refused && out.symbols.includes('SW')) placed += 1;
        }
        expect(`${placed}/200 placed a switch`).toBe('200/200 placed a switch');
    });
});

/* ── 9. ⚖ Ruling 16 — the post-solve entrance↔goal shortcut ──────────── */

describe('areaGraph — the POST-SOLVE SHORTCUT (⚖ design ruling 16)', () => {
    const space = cycleSpace(6);

    it('appears at some seeds, locked by the goal level\'s symbol, undirected', () => {
        const shortcuts = [];
        for (const seed of SEEDS) {
            const out = build(space, seed, { maxKeys: 1 });
            if (out.refused) continue;
            const edge = out.edges.find((e) => e.kind === 'graphify'
                && [e.a, e.b].includes(space.entrance) && [e.a, e.b].includes(space.goal));
            if (edge) shortcuts.push({ seed, lock: edge.lock });
        }
        /** ⚠ MEASURED — a count, so a change that kills the shortcut reddens. */
        expect(`${shortcuts.length}/200 seeds`).toBe('36/200 seeds');
        expect([...new Set(shortcuts.map((s) => s.lock))]).toEqual(['K0']);
        expect(shortcuts.slice(0, 3).map((s) => s.seed)).toEqual([10, 11, 12]);
    });

    /**
     * ⛓ UNDIRECTED IS NOT A SPELLING — it is what "freely travel in either
     * direction" means. The edge list has ONE record per pair and the
     * reachability walk above reads it both ways; the check that says so is
     * that the goal is reachable from the entrance in ONE hop with K0, and the
     * entrance from the goal in one hop.
     */
    it('the shortcut is walkable both ways with K0 in hand', () => {
        const out = build(space, 10, { maxKeys: 1 });
        const hop = (from, to) => out.edges.some((e) => (e.lock === null || e.lock === 'K0')
            && ((e.a === from && e.b === to) || (e.b === from && e.a === to)));
        expect(`${hop(space.entrance, space.goal)}/${hop(space.goal, space.entrance)}`)
            .toBe('true/true');
        /** …and with an EMPTY inventory it is not a hop at all. */
        const reached = reachableWith(out, space.entrance, []);
        expect(reached.has(space.goal)).toBe(false);
    });

    it('allowGoalShortcut: false is MetaZelda\'s own behaviour — no graphify edge '
        + 'touches the goal', () => {
        let touching = 0;
        let accepted = 0;
        for (const seed of SEEDS) {
            const out = build(space, seed, { maxKeys: 1, allowGoalShortcut: false });
            if (out.refused) continue;
            accepted += 1;
            touching += out.edges.filter((e) => e.kind === 'graphify'
                && [e.a, e.b].includes(space.goal)).length;
        }
        expect(`${accepted} accepted, ${touching} graphify edges at the goal`)
            .toBe('200 accepted, 0 graphify edges at the goal');
    });
});

/* ── 10. LITERAL FIXTURES (trap 250) ─────────────────────────────────── */

describe('areaGraph — three whole outputs, pasted (trap 250)', () => {
    /**
     * ⛓⛓ THE PROPERTIES ABOVE CANNOT SEE A CHANGE THAT KEEPS EVERY LAW AND
     * MOVES THE GRAPH — a different draw order, a shuffle that lost a draw, an
     * intensity constant. These can. ⚠ They are DRIFT detectors and they say so:
     * a deliberate change to the draw order re-records them, and the as-built
     * says which seed produced which md5.
     */

    /**
     * ⛓ CHECKABLE BY EYE, which is why this one is first: a 5-area path at one
     * key. `a` is the entrance (START), `b` holds K0, the `b→c` edge is locked
     * by K0, and `c`,`d`,`e` are the region beyond it — the player picks the key
     * up in the only level-0 area that can hold one and walks to `e`.
     */
    it('path5, seed 1, maxKeys 1', () => {
        expect(build(pathSpace(5), 1, { maxKeys: 1 })).toEqual({
            areas: {
                a: { keyLevel: 0, precond: [], intensity: 0, item: 'START', parent: null },
                b: { keyLevel: 0, precond: [], intensity: 0.362049, item: 'K0', parent: 'a' },
                c: { keyLevel: 1, precond: ['K0'], intensity: 0.282326, item: null, parent: 'b' },
                d: { keyLevel: 1, precond: ['K0'], intensity: 0.625508, item: null, parent: 'c' },
                e: { keyLevel: 1, precond: ['K0'], intensity: 0.99, item: 'GOAL', parent: 'd' },
            },
            edges: [
                { a: 'a', b: 'b', lock: null, kind: 'tree' },
                { a: 'b', b: 'c', lock: 'K0', kind: 'tree' },
                { a: 'c', b: 'd', lock: null, kind: 'tree' },
                { a: 'd', b: 'e', lock: null, kind: 'tree' },
            ],
            symbols: ['K0'],
            solutionPath: ['a', 'b', 'c', 'd', 'e'],
            bounds: {
                maxKeys: 1,
                maxRetries: 20,
                graphifyProbability: 0.2,
                maxSwitches: 0,
                allowGoalShortcut: true,
            },
            draws: 18,
            drawsByPhase: {
                placeAreas: 12, placeSwitches: 0, intensity: 5, placeKeys: 1, graphify: 0,
            },
            attempts: 1,
            refused: null,
        });
    });

    /** Two key levels, a retry, and a `graphify` edge that is NOT the shortcut. */
    it('grid3x3, seed 7, maxKeys 2', () => {
        expect(build(gridSpace(3, 3), 7, { maxKeys: 2 })).toEqual({
            areas: {
                r0c0: { keyLevel: 0, precond: [], intensity: 0, item: 'START', parent: null },
                r0c1: { keyLevel: 0, precond: [], intensity: 0.199697, item: null, parent: 'r0c0' },
                r0c2: {
                    keyLevel: 2, precond: ['K0', 'K1'], intensity: 0.607645, item: null, parent: 'r0c1',
                },
                r1c0: { keyLevel: 1, precond: ['K0'], intensity: 0.293288, item: null, parent: 'r0c0' },
                r1c1: { keyLevel: 0, precond: [], intensity: 0.38493, item: 'K0', parent: 'r0c1' },
                r1c2: {
                    keyLevel: 2, precond: ['K0', 'K1'], intensity: 0.773273, item: null, parent: 'r0c2',
                },
                r2c0: { keyLevel: 1, precond: ['K0'], intensity: 0.520481, item: null, parent: 'r1c0' },
                r2c1: { keyLevel: 1, precond: ['K0'], intensity: 0.749764, item: 'K1', parent: 'r2c0' },
                r2c2: {
                    keyLevel: 2, precond: ['K0', 'K1'], intensity: 0.99, item: 'GOAL', parent: 'r1c2',
                },
            },
            edges: [
                { a: 'r0c0', b: 'r0c1', lock: null, kind: 'tree' },
                { a: 'r0c1', b: 'r1c1', lock: null, kind: 'tree' },
                { a: 'r0c0', b: 'r1c0', lock: 'K0', kind: 'tree' },
                { a: 'r1c0', b: 'r2c0', lock: null, kind: 'tree' },
                { a: 'r2c0', b: 'r2c1', lock: null, kind: 'tree' },
                { a: 'r0c1', b: 'r0c2', lock: 'K1', kind: 'tree' },
                { a: 'r0c2', b: 'r1c2', lock: null, kind: 'tree' },
                { a: 'r1c2', b: 'r2c2', lock: null, kind: 'tree' },
                { a: 'r2c1', b: 'r1c1', lock: 'K0', kind: 'graphify' },
            ],
            symbols: ['K0', 'K1'],
            solutionPath: ['r0c0', 'r0c1', 'r0c2', 'r1c2', 'r2c2'],
            bounds: {
                maxKeys: 2,
                maxRetries: 20,
                graphifyProbability: 0.2,
                maxSwitches: 0,
                allowGoalShortcut: true,
            },
            draws: 111,
            drawsByPhase: {
                placeAreas: 90, placeSwitches: 0, intensity: 9, placeKeys: 4, graphify: 8,
            },
            attempts: 2,
            refused: null,
        });
    });

    /**
     * ⚖ RULING 16, PINNED: the tree runs the long way round the ring
     * (a→f→e→d→c→b) with K0 behind the `e→d` door, and the direct `a—b` edge —
     * the entrance beside the exit — is the `graphify` shortcut that the goal
     * level's own key opens, in either direction.
     */
    it('cycle6, seed 10, maxKeys 1 — the post-solve shortcut', () => {
        expect(build(cycleSpace(6), 10, { maxKeys: 1 })).toEqual({
            areas: {
                a: { keyLevel: 0, precond: [], intensity: 0, item: 'START', parent: null },
                b: { keyLevel: 1, precond: ['K0'], intensity: 0.99, item: 'GOAL', parent: 'c' },
                c: { keyLevel: 1, precond: ['K0'], intensity: 0.723495, item: null, parent: 'd' },
                d: { keyLevel: 1, precond: ['K0'], intensity: 0.456304, item: null, parent: 'e' },
                e: { keyLevel: 0, precond: [], intensity: 0.571419, item: 'K0', parent: 'f' },
                f: { keyLevel: 0, precond: [], intensity: 0.287881, item: null, parent: 'a' },
            },
            edges: [
                { a: 'a', b: 'f', lock: null, kind: 'tree' },
                { a: 'f', b: 'e', lock: null, kind: 'tree' },
                { a: 'e', b: 'd', lock: 'K0', kind: 'tree' },
                { a: 'd', b: 'c', lock: null, kind: 'tree' },
                { a: 'c', b: 'b', lock: null, kind: 'tree' },
                { a: 'a', b: 'b', lock: 'K0', kind: 'graphify' },
            ],
            symbols: ['K0'],
            solutionPath: ['a', 'f', 'e', 'd', 'c', 'b'],
            bounds: {
                maxKeys: 1,
                maxRetries: 20,
                graphifyProbability: 0.2,
                maxSwitches: 0,
                allowGoalShortcut: true,
            },
            draws: 29,
            drawsByPhase: {
                placeAreas: 20, placeSwitches: 0, intensity: 6, placeKeys: 2, graphify: 1,
            },
            attempts: 1,
            refused: null,
        });
    });
});
