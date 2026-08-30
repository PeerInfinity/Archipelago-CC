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
    SKELETON_KINDS, SkeletonKindError, assertKind, carveSkeleton, enumerateKindValues,
    formatSkeleton, kindsOffered, normalizeSkeleton, paramSchemaFor, parseSkeleton,
    resolveBiome, resolveSkeletonParams, skeletonCatalogue,
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 7 — THE KIND PARAMETERS
 * ══════════════════════════════════════════════════════════════════════ */

describe('skeletonKinds — the declared parameters', () => {
    it('declares them where the MEASUREMENT put them, and nowhere else', () => {
        const keysOf = (k) => paramSchemaFor(k).map((p) => p.key);
        expect(keysOf('empty')).toEqual([]);
        expect(keysOf('classic')).toEqual([]);
        expect(keysOf('corridor')).toEqual([]);
        expect(keysOf('rooms')).toEqual(['minRoom', 'chambers']);
        expect(keysOf('bushy')).toEqual(['prune', 'chambers']);
        expect(keysOf('loopy')).toEqual(['prune', 'chambers']);
        /**
         * ⛔ NO `prune` ON `branchy` — MEASURED: `branchy;prune=1` is
         * byte-identical to `winding` on seeds 1..8, so the knob would be a
         * second spelling of a kind that already has a name. And none on
         * `open`, where full braid leaves nothing to prune (a no-op on 5 seeds
         * × both substrates). Both exclusions are in the file's docblock.
         */
        expect(keysOf('branchy')).toEqual(['chambers']);
        expect(keysOf('open')).toEqual(['chambers']);
        expect(keysOf('winding')).toEqual(['chambers']);
    });

    it('every declared default is TODAY\'S value — the byte-inert claim, as a literal', () => {
        for (const kind of KIND_IDS) {
            for (const p of paramSchemaFor(kind)) {
                expect(p.domain).toContain(p.default);
            }
        }
        expect(resolveSkeletonParams('rooms')).toEqual({ minRoom: 3, chambers: 0 });
        expect(resolveSkeletonParams('bushy')).toEqual({ prune: 0, chambers: 0 });
        // ⛔ `minRoom`'s default IS the literal the table has always passed the
        // backend — a different number would move every `rooms` pair.
        expect(BIOMES.rooms.params.minRoom).toBe(3);
    });

    it('`chambers` is the LAST declared parameter wherever it appears (the draw order)', () => {
        for (const kind of KIND_IDS) {
            const schema = paramSchemaFor(kind);
            const at = schema.findIndex((p) => p.key === 'chambers');
            if (at >= 0) expect(at).toBe(schema.length - 1);
        }
    });

    it('REFUSES an undeclared key and an out-of-domain value, BY NAME', () => {
        expect(() => resolveSkeletonParams('branchy', { minRoom: 2 }))
            .toThrow(/"branchy" has no parameter "minRoom".*It declares \[chambers\]/s);
        expect(() => resolveSkeletonParams('empty', { chambers: 1 }))
            .toThrow(/declares NO parameters/);
        expect(() => resolveSkeletonParams('rooms', { minRoom: 5 }))
            .toThrow(/declared domain \[2, 3, 4\]/);
        expect(() => resolveSkeletonParams('rooms', { chambers: 4 }))
            .toThrow(/declared domain \[0, 1, 2, 3\]/);
    });

    /**
     * ⛔ THE STRING CODEC IS CHECKED AGAINST LITERALS BOTH WAYS before the
     * fixed point — a parser and a formatter that agreed on a wrong spelling
     * would round-trip perfectly (⚖ the arc's first carried finding).
     */
    it('parses and formats against LITERALS, then round-trips', () => {
        expect(parseSkeleton('rooms;minRoom=2;chambers=1', { simulator: true }))
            .toEqual({ kind: 'rooms', params: { minRoom: 2, chambers: 1 } });
        expect(formatSkeleton({ kind: 'rooms', params: { minRoom: 2, chambers: 1 } }))
            .toBe('rooms;minRoom=2;chambers=1');
        expect(formatSkeleton({ kind: 'rooms', params: { chambers: 1, minRoom: 2 } }))
            .toBe('rooms;minRoom=2;chambers=1');
        expect(formatSkeleton({ kind: 'winding' })).toBe('winding');
        expect(formatSkeleton({ kind: 'winding', params: { chambers: 0 } })).toBe('winding');
        for (const s of ['branchy', 'winding;chambers=2', 'rooms;minRoom=4',
            'loopy;prune=1;chambers=3']) {
            expect(formatSkeleton(parseSkeleton(s, { simulator: true }))).toBe(s);
        }
    });

    it('normalizes to a BOTH-SIDES DEFAULT, so an old payload agrees', () => {
        // an old `{kind}` payload and a page at all-defaults are ONE object
        expect(normalizeSkeleton({ kind: 'rooms' }))
            .toEqual(normalizeSkeleton({ kind: 'rooms', params: { minRoom: 3, chambers: 0 } }));
        // …and a NON-default value still diverges by name
        expect(normalizeSkeleton({ kind: 'rooms', params: { minRoom: 2 } }))
            .not.toEqual(normalizeSkeleton({ kind: 'rooms' }));
        expect(normalizeSkeleton(undefined)).toEqual({ kind: DEFAULT_SKELETON_KIND });
    });

    it('the CATALOGUE carries each kind\'s schema, so a page mounts no second list', () => {
        const rows = skeletonCatalogue({ simulator: true });
        const rooms = rows.find((r) => r.kind === 'rooms');
        expect(rooms.params.map((p) => p.key)).toEqual(['minRoom', 'chambers']);
        expect(rooms.params[0].domain).toEqual([2, 3, 4]);
        expect(rooms.params[0].default).toBe(3);
        expect(rows.find((r) => r.kind === 'empty').params).toEqual([]);
    });

    it('enumerateKindValues is templateContract\'s enumerator, over the kind\'s domains', () => {
        expect(enumerateKindValues('empty')).toEqual([{}]);
        expect(enumerateKindValues('winding')).toHaveLength(4);      // chambers 0..3
        expect(enumerateKindValues('rooms')).toHaveLength(12);       // 3 x 4
        expect(enumerateKindValues('rooms')[0]).toEqual({ minRoom: 2, chambers: 0 });
    });
});

describe('skeletonKinds — carveSkeleton under parameters', () => {
    const carve = (kind, seed, params) => {
        const world = grid(11, 11, [0, 0], [10, 10]);
        const out = carveSkeleton(kind, world, rngFor(seed), { params });
        return { world, out };
    };

    /**
     * ⛓⛓⛓ THE BYTE-INERT CLAIM, DRIVEN AT THE ONE PLACE IT IS DECIDED: the
     * post-processor is not APPENDED at the default, so a defaulted carve is
     * the identical tile array AND the identical post-processor list.
     */
    it('a param at its DEFAULT changes neither the tiles nor the ran list', () => {
        for (const kind of ['branchy', 'bushy', 'loopy', 'open', 'rooms', 'winding']) {
            for (const seed of [1, 2, 3]) {
                const bare = carve(kind, seed, undefined);
                const defaulted = carve(kind, seed, kind === 'rooms'
                    ? { minRoom: 3, chambers: 0 } : { chambers: 0 });
                expect([...defaulted.world.tiles]).toEqual([...bare.world.tiles]);
                expect(defaulted.out.postProcessors).toEqual(bare.out.postProcessors);
                expect(bare.out.postProcessors).not.toContain('chambers');
            }
        }
    });

    it('`chambers=k` APPENDS the post-processor LAST and opens more floor', () => {
        const a = carve('winding', 3, { chambers: 0 });
        const b = carve('winding', 3, { chambers: 2 });
        expect(b.out.postProcessors).toEqual(['pruneDeadEnds', 'chambers']);
        expect(floorCount(b.world)).toBeGreaterThan(floorCount(a.world));
        // ⛔ MONOTONE: every cell the bare carve opened is still open.
        for (let i = 0; i < a.world.tiles.length; i += 1) {
            if (a.world.tiles[i] === TILE_FLOOR) expect(b.world.tiles[i]).toBe(TILE_FLOOR);
        }
        expect(shortestPathLength(b.world)).not.toBeNull();
    });

    /**
     * ⛓ AND IT RUNS AFTER THE PRUNE, NOT BEFORE — a chamber stamped first
     * would be pruned back into wall by a kind whose recipe fills dead ends.
     * The subject is `winding`, the one kind whose own post-processor fills.
     */
    it('a chamber stamped on `winding` SURVIVES, because the prune already ran', () => {
        const b = carve('winding', 4, { chambers: 3 });
        const bare = carve('winding', 4, undefined);
        expect(floorCount(b.world)).toBeGreaterThan(floorCount(bare.world));
    });

    it('`minRoom` reaches the BACKEND — a different value builds a different room', () => {
        const two = carve('rooms', 5, { minRoom: 2 });
        const four = carve('rooms', 5, { minRoom: 4 });
        expect([...two.world.tiles]).not.toEqual([...four.world.tiles]);
        expect(two.out.params).toEqual({ minRoom: 2, chambers: 0 });
    });

    it('`prune=1` fills the dead ends of a `bushy` room, and prune=0 is today', () => {
        const off = carve('bushy', 6, { prune: 0 });
        const on = carve('bushy', 6, { prune: 1 });
        expect(on.out.postProcessors).toEqual(['pruneDeadEnds']);
        expect(floorCount(on.world)).toBeLessThan(floorCount(off.world));
        expect(shortestPathLength(on.world)).not.toBeNull();
    });

    /**
     * ⛔ MARGIN IS THE CALLER'S, AND THE CALLER IS THE ONLY ONE WHO KNOWS IT.
     * Driven here at the grid level because the Seedling binding's own border
     * check would REFUSE rather than report — it is the assertion, not the
     * measurement.
     */
    it('margin keeps a stamp off the border; margin 0 lets it reach one', () => {
        const border = (world) => {
            for (let x = 0; x < world.width; x += 1) {
                if (getTile(world, x, 0) === TILE_FLOOR) return true;
                if (getTile(world, x, world.height - 1) === TILE_FLOOR) return true;
            }
            for (let y = 0; y < world.height; y += 1) {
                if (getTile(world, 0, y) === TILE_FLOOR) return true;
                if (getTile(world, world.width - 1, y) === TILE_FLOOR) return true;
            }
            return false;
        };
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const world = grid(10, 10, [1, 1], [5, 7]);
            for (let y = 0; y < 10; y += 1) {
                for (let x = 0; x < 10; x += 1) {
                    if (x === 0 || y === 0 || x === 9 || y === 9) setTile(world, x, y, TILE_WALL);
                }
            }
            carveSkeleton('winding', world, rngFor(seed), {
                params: { chambers: 3 }, margin: 1,
            });
            expect(border(world)).toBe(false);
        }
    });
});
