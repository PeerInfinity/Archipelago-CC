/**
 * procgenCore/skeletonKinds — **THE ONE SKELETON VOCABULARY**, tested where it
 * lives.
 *
 * CONSTRUCTIVE-MODE arc, slice 5. ⛔ These rows are SUBSTRATE-FREE: the worlds
 * below are hand-built `gridTiles.js` grids, not `mazeModel().skeleton()` and
 * not a Seedling record. A shared module tested only through one of its two
 * callers is a shared module with one caller and a re-export.
 *
 * ⚠ The per-binding behaviour is gated by `mazeRoom/procgenMaze.test.js` and
 * `seedlingDemo/procgenSeedling.test.js`; this file gates what neither can see —
 * the offer rule, the refusals' wording, and the CONSTRUCTION of `winding`
 * against an independently computed shortest path.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    TILE_FLOOR, TILE_WALL, getTile, setTile,
} from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { getPostProcessor } from '../shared/procgen/mazeAlgorithms/postProcessors.js';
import {
    _testOnly_clearRegistry, getBackend, listBackends, registerBackend,
} from '../shared/procgen/mazeAlgorithms/registry.js';
import '../shared/procgen/mazeAlgorithms/kruskals.js';
import '../shared/procgen/mazeAlgorithms/recursiveBacktracker.js';
import '../shared/procgen/mazeAlgorithms/recursiveDivision.js';
import {
    BIOMES, DEFAULT_BIOME_ID, DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, KIND_IDS,
    SKELETON_KINDS, SkeletonKindError, assertKind, carveSkeleton, kindsOffered, resolveBiome,
    skeletonCatalogue,
} from './skeletonKinds.js';

/** A deterministic stream of the shape the backends take. */
const rngFor = (seed) => {
    let a = (seed >>> 0) || 1;
    return {
        next() {
            a += 0x6d2b79f5;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        },
    };
};

const grid = (w, h, ent, exit) => ({
    width: w,
    height: h,
    tiles: new Int8Array(w * h),
    entrance: { x: ent[0], y: ent[1] },
    exits: new Map([['goal', { exit_id: 'goal', x: exit[0], y: exit[1] }]]),
});

const floorCount = (world) => [...world.tiles].filter((t) => t === TILE_FLOOR).length;

/**
 * ⛔ THE PATH IS COMPUTED HERE, NOT READ OFF THE CARVE. A `winding` claim
 * checked against the carver's own idea of a path would be the carver agreeing
 * with itself; this is a plain BFS over the residue.
 */
const shortestPathLength = (world) => {
    const key = (x, y) => `${x},${y}`;
    const prev = new Map([[key(world.entrance.x, world.entrance.y), null]]);
    const queue = [[world.entrance.x, world.entrance.y]];
    const goal = [...world.exits.values()][0];
    while (queue.length) {
        const [x, y] = queue.shift();
        if (x === goal.x && y === goal.y) {
            let n = 0;
            let k = key(x, y);
            while (k !== null) { n += 1; k = prev.get(k); }
            return n;
        }
        for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
            if (getTile(world, nx, ny) !== TILE_FLOOR) continue;
            if (prev.has(key(nx, ny))) continue;
            prev.set(key(nx, ny), key(x, y));
            queue.push([nx, ny]);
        }
    }
    return null;
};

const render = (world) => {
    const rows = [];
    for (let y = 0; y < world.height; y += 1) {
        let row = '';
        for (let x = 0; x < world.width; x += 1) {
            row += getTile(world, x, y) === TILE_FLOOR ? '.' : '#';
        }
        rows.push(row);
    }
    return rows.join('\n');
};

describe('skeletonKinds — the table and its two defaults', () => {
    it('holds one vocabulary and `SKELETON_KINDS` IS `BIOMES` (not a copy of it)', () => {
        expect(SKELETON_KINDS).toBe(BIOMES);
        expect(KIND_IDS).toEqual([
            'empty', 'classic', 'corridor', 'branchy', 'bushy', 'loopy', 'open', 'rooms',
            'winding',
        ]);
    });

    /**
     * ⛔ THE TWO DEFAULTS ANSWER DIFFERENT QUESTIONS and a test that let them
     * drift together would be the two-spellings failure inside the file written
     * to end it: `classic` is what an unconfigured AP REGION generates,
     * `empty` is what the CONSTRUCTIVE loop starts from.
     */
    it('keeps the REGION default and the CONSTRUCTIVE default apart', () => {
        expect(DEFAULT_BIOME_ID).toBe('classic');
        expect(DEFAULT_SKELETON_KIND).toBe('empty');
        expect(DEFAULT_SKELETON).toEqual({ kind: 'empty' });
    });

    it('resolveBiome still answers exactly as the maze library did', () => {
        expect(resolveBiome(null).id).toBe('classic');
        expect(resolveBiome({ id: 'bushy' }).params).toEqual({ picker: 'random' });
        expect(resolveBiome({ id: 'rooms', paramsOverride: { minRoom: 5 } }).params)
            .toEqual({ minRoom: 5 });
        expect(() => resolveBiome({ id: 'nope' })).toThrow(/unknown biome id 'nope'.*winding/s);
    });
});

describe('skeletonKinds — which kinds a binding OFFERS', () => {
    it('withholds exactly the two simulator-bound kinds from a grid-only binding', () => {
        expect(kindsOffered({ simulator: false }))
            .toEqual(['empty', 'branchy', 'bushy', 'loopy', 'open', 'rooms', 'winding']);
        expect(kindsOffered({ simulator: true })).toEqual(KIND_IDS);
    });

    it('refuses an UNKNOWN kind by name, with the whole vocabulary', () => {
        expect(() => assertKind('spiral', { simulator: true }))
            .toThrow(/"spiral" is not a skeleton kind.*empty, classic, corridor/s);
    });

    /**
     * ⛓ TWO DIFFERENT MISTAKES, TWO DIFFERENT SENTENCES. A reader who typed
     * `corridor` has to learn that the kind EXISTS and this substrate cannot
     * run it — the unknown-kind sentence would send them looking for a typo.
     */
    it('refuses an UNOFFERED kind by name, with what it needs and what IS offered', () => {
        expect(() => assertKind('corridor', { simulator: false, substrate: 'the Seedling page' }))
            .toThrow(/"corridor" needs the maze simulator.*the Seedling page offers \[empty, branchy/s);
        expect(assertKind('corridor', { simulator: true })).toBe('corridor');
    });

    it('lists every kind in the catalogue, greying the unavailable ones WITH the reason', () => {
        const rows = skeletonCatalogue({ simulator: false });
        expect(rows.map((r) => r.kind)).toEqual(KIND_IDS);
        expect(rows.find((r) => r.kind === 'empty').isDefault).toBe(true);
        const corridor = rows.find((r) => r.kind === 'corridor');
        expect(corridor.offered).toBe(false);
        expect(corridor.why).toMatch(/maze simulator/);
        expect(rows.find((r) => r.kind === 'winding').offered).toBe(true);
        expect(rows.find((r) => r.kind === 'winding').postProcessors).toEqual(['pruneDeadEnds']);
        // …and with the simulator, nothing is greyed.
        expect(skeletonCatalogue({ simulator: true }).every((r) => r.offered)).toBe(true);
    });
});

describe('skeletonKinds — carveSkeleton', () => {
    it('REFUSES the open room by name rather than carving nothing', () => {
        expect(() => carveSkeleton('empty', grid(7, 7, [0, 0], [6, 6]), rngFor(1)))
            .toThrow(SkeletonKindError);
        expect(() => carveSkeleton('empty', grid(7, 7, [0, 0], [6, 6]), rngFor(1)))
            .toThrow(/CARVES NOTHING.*a binding must short-circuit it/s);
    });

    /**
     * ⛓ THE MISSING-BACKEND BRANCH, DRIVEN. Backends register ON IMPORT, so
     * the failure mode is a binding whose graph is missing one — and a refusal
     * that named the KIND rather than the import would send a reader to the
     * table instead of to their own imports.
     */
    describe('with an empty registry', () => {
        let saved;
        beforeAll(() => { saved = listBackends(); _testOnly_clearRegistry(); });
        afterAll(() => { _testOnly_clearRegistry(); saved.forEach(registerBackend); });

        it('refuses a kind whose backend nobody imported, naming the import', () => {
            expect(() => carveSkeleton('winding', grid(7, 7, [0, 0], [6, 6]), rngFor(1)))
                .toThrow(/names backend "recursive_backtracker", which is not registered.*ON IMPORT/s);
        });
    });

    it('runs the backend and then the post-processors, reporting both', () => {
        const world = grid(11, 11, [0, 0], [7, 9]);
        const out = carveSkeleton('winding', world, rngFor(1));
        expect(out).toMatchObject({ kind: 'winding', backend: 'recursive_backtracker' });
        expect(out.postProcessors).toEqual(['pruneDeadEnds']);
        expect(out.backendStats.accepted).toBeGreaterThan(0);
    });
});

describe('skeletonKinds — `winding` IS the unique path (the fixture)', () => {
    /**
     * ⛓⛓⛓ THE CONSTRUCTION CLAIM. `winding` is a perfect maze with every dead
     * end filled, so what survives must be the entrance→exit path and NOTHING
     * else — the floor count equals the independently computed shortest-path
     * length. ⛔ Checked as an EQUALITY, not as "mostly wall": a prune that
     * stopped one stub short would still leave a mostly-wall room.
     */
    it.each([1, 2, 3, 4, 5, 6, 7, 8])('leaves exactly the path, and nothing beside it (seed %i)',
        (seed) => {
            const world = grid(11, 11, [0, 0], [7, 9]);
            carveSkeleton('winding', world, rngFor(seed));
            const path = shortestPathLength(world);
            expect(path).not.toBeNull();
            expect(floorCount(world)).toBe(path);
        });

    it('is a corridor a reader can see', () => {
        const world = grid(11, 11, [0, 0], [7, 9]);
        carveSkeleton('winding', world, rngFor(1));
        // Every floor tile is on the one route; every wall tile is wall.
        expect(render(world).split('\n').every((r) => r.length === 11)).toBe(true);
        expect(floorCount(world)).toBeLessThan(11 * 11 / 2);
    });

    /**
     * ⛓⛓ THE THRESHOLD IS **NOT** A TUNED DEPTH, AND THIS IS THE MEASUREMENT
     * THAT SAYS SO. `pruneDeadEnds` re-lists its dead ends inside a
     * `while (changed)` loop, so it runs to a fixed point and 1, 2 and 9999
     * give the SAME residue on a tree. The table states 9999 to name the intent
     * ("fill every dead end") rather than because the number does work.
     */
    it('reaches the same residue at threshold 1, 2 and 9999 (the fixed point, measured)', () => {
        const at = (threshold, seed) => {
            const world = grid(11, 11, [0, 0], [7, 9]);
            const rng = rngFor(seed);
            getBackend('recursive_backtracker').run(world, { picker: 'newest' }, rng);
            getPostProcessor('pruneDeadEnds')(world, { threshold }, rng);
            return render(world);
        };
        for (const seed of [1, 2, 3, 4, 5]) {
            expect(at(1, seed)).toBe(at(9999, seed));
            expect(at(2, seed)).toBe(at(9999, seed));
        }
    });

    it('never fills the entrance or the exit, however long the prune runs', () => {
        for (const seed of [1, 5, 9]) {
            const world = grid(9, 9, [0, 0], [8, 8]);
            carveSkeleton('winding', world, rngFor(seed));
            expect(getTile(world, 0, 0)).toBe(TILE_FLOOR);
            expect(getTile(world, 8, 8)).toBe(TILE_FLOOR);
        }
    });
});

describe('skeletonKinds — every carving kind leaves a SOLVABLE room', () => {
    /**
     * ⛔ THE CENSUS'S OWN PRECONDITION, at the grid level: connectivity is what
     * each backend promises (tree by construction; `recursive_division` repairs
     * its own cuts), and the post-processors only ever open or fill dead ends.
     * A kind that failed this would refuse at step 0 in BOTH bindings.
     */
    it.each(['branchy', 'bushy', 'loopy', 'open', 'rooms', 'winding'])(
        '%s connects the entrance to the goal on an 11x11 grid, seeds 1..12',
        (kind) => {
            for (let seed = 1; seed <= 12; seed += 1) {
                const world = grid(11, 11, [0, 0], [7, 9]);
                carveSkeleton(kind, world, rngFor(seed));
                expect(shortestPathLength(world), `${kind} seed ${seed}`).not.toBeNull();
            }
        },
    );

    /**
     * ⚠ A PRE-WALLED RING SURVIVES EVERY KIND — the fact the Seedling binding
     * rests on (its room has a border and the grid contract knows nothing about
     * one). ⛔ Driven HERE, at the grid level, because the binding's own check
     * is a refusal and a refusal nobody can trigger is a gate that does not
     * gate.
     */
    it.each(['branchy', 'bushy', 'loopy', 'open', 'rooms', 'winding'])(
        '%s leaves a pre-walled border ring walled',
        (kind) => {
            for (let seed = 1; seed <= 8; seed += 1) {
                const world = grid(10, 10, [1, 1], [7, 6]);
                for (let y = 0; y < 10; y += 1) {
                    for (let x = 0; x < 10; x += 1) {
                        if (x === 0 || y === 0 || x === 9 || y === 9) setTile(world, x, y, TILE_WALL);
                    }
                }
                carveSkeleton(kind, world, rngFor(seed));
                for (let i = 0; i < 10; i += 1) {
                    expect(getTile(world, i, 0), `${kind} seed ${seed} top ${i}`).toBe(TILE_WALL);
                    expect(getTile(world, i, 9)).toBe(TILE_WALL);
                    expect(getTile(world, 0, i)).toBe(TILE_WALL);
                    expect(getTile(world, 9, i)).toBe(TILE_WALL);
                }
            }
        },
    );

    it('is DETERMINISTIC — the same seed and kind carve the same room', () => {
        for (const kind of ['branchy', 'loopy', 'rooms', 'winding']) {
            const a = grid(11, 11, [0, 0], [7, 9]);
            const b = grid(11, 11, [0, 0], [7, 9]);
            carveSkeleton(kind, a, rngFor(7));
            carveSkeleton(kind, b, rngFor(7));
            expect(render(a)).toBe(render(b));
        }
    });
});
