/**
 * mazeRoom/procgenMazeAreas.test — THE MAZE AREA BINDING (PROCGEN ELEMENTS arc
 * 1, slice 2).
 *
 * ⛓ In its OWN file rather than appended to `procgenMaze.test.js`, for one
 * reason: the ≤ 1-area claim needs a COUNTING SPY on `procgenCore/areaGraph.js`,
 * and a `vi.mock` at the top of the 37-row file would put every existing row
 * under a mocked module for a claim that is not about them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = { buildAreaGraph: 0 };
vi.mock('../procgenCore/areaGraph.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildAreaGraph: (...args) => {
            calls.buildAreaGraph += 1;
            return actual.buildAreaGraph(...args);
        },
    };
});

const { createWorld, getItem, getObstacle, setTile, TILE_FLOOR, TILE_WALL } =
    await import('./mazeRoomEngine.js');
const { reachableFrom } = await import('../procgenCore/gridFlood.js');
const { DEFAULT_ITEMS, DEFAULT_OBSTACLES } = await import('../shared/procgen/library.js');
const {
    areaLibraries, deserializeMazeLevel, doorLevelOf, generateMazeLevel, mazeModel,
    partitionMazeAreas, requireOutcome, serializeMazeLevel, verifyAreaLevels,
} = await import('./procgenMaze.js');

beforeEach(() => { calls.buildAreaGraph = 0; });

/**
 * ⛓ A HAND-DRAWN ROOM, read top to bottom exactly as it looks. `#` is wall.
 * ⛔ The grid is a LITERAL a reader can check by eye — a fixture the test
 * computed would test the partition against the partition.
 */
const roomOf = (rows, { entrance = { x: 0, y: 0 }, goal }) => {
    const height = rows.length;
    const width = rows[0].length;
    for (const r of rows) expect(r.length).toBe(width);
    const world = createWorld(width, height, {
        entrance, exits: [{ exit_id: 'goal', x: goal.x, y: goal.y }],
    });
    rows.forEach((row, y) => [...row].forEach((c, x) => {
        setTile(world, x, y, c === '#' ? TILE_WALL : TILE_FLOOR);
    }));
    return world;
};

/**
 * THREE 3x3 CHAMBERS IN A ROW, joined by ONE gap cell each. The gap is a
 * corridor by the 2x2 rule (every 2x2 square containing it holds a wall), the
 * chambers are areas, and both the entrance and the goal fall INSIDE one.
 */
const THREE_CHAMBERS = [
    '...#...#...',
    '.........,.'.replace(',', '.'),   // gaps at (3,1) and (7,1)
    '...#...#...',
    '###########',
    '###########',
    '###########',
    '###########',
    '###########',
    '###########',
    '###########',
    '###########',
];

describe('procgenMaze — THE AREA PARTITION, on a hand-drawn room', () => {
    it('⛓ THE LITERAL ANSWER: three areas, two adjacency pairs, the gaps are EDGES', () => {
        const world = roomOf(THREE_CHAMBERS, { goal: { x: 10, y: 0 } });
        const p = partitionMazeAreas(world, {
            entrance: { x: 0, y: 0 }, goal: { x: 10, y: 0 },
        });

        expect(p.areas.map((a) => a.id)).toEqual(['A0', 'A1', 'A2']);
        expect(p.areas.map((a) => a.size)).toEqual([9, 9, 9]);
        expect(p.areas.map((a) => a.synthetic)).toEqual([false, false, false]);
        expect(p.areas[0].cells.map((c) => `${c.x},${c.y}`)).toEqual(
            ['0,0', '1,0', '2,0', '0,1', '1,1', '2,1', '0,2', '1,2', '2,2'],
        );
        // ⛓ THE GAP CELLS ARE NOT IN ANY AREA — they are the edges.
        expect(p.labelAt(3, 1)).toBe(null);
        expect(p.labelAt(7, 1)).toBe(null);
        expect(p.corridorComponents.map((c) => [c.size, c.touches]))
            .toEqual([[1, ['A0', 'A1']], [1, ['A1', 'A2']]]);
        expect(p.adjacency.map((e) => `${e.a}-${e.b}`)).toEqual(['A0-A1', 'A1-A2']);
        // ⛔ A0 and A2 are NOT adjacent: their only corridor route passes THROUGH A1.
        expect(p.adjacency.some((e) => e.a === 'A0' && e.b === 'A2')).toBe(false);
        expect(p.entranceArea).toBe('A0');
        expect(p.goalArea).toBe('A2');
        expect(p.deadFloorCells).toBe(0);
    });

    it('⛓ THE BOUNDARY is the area-side cell, not the corridor cell — where a door goes', () => {
        const world = roomOf(THREE_CHAMBERS, { goal: { x: 10, y: 0 } });
        const p = partitionMazeAreas(world, {
            entrance: { x: 0, y: 0 }, goal: { x: 10, y: 0 },
        });
        expect(p.areas[0].boundary.map((c) => `${c.x},${c.y}`)).toEqual(['2,1']);
        expect(p.areas[1].boundary.map((c) => `${c.x},${c.y}`)).toEqual(['4,1', '6,1']);
        expect(p.areas[2].boundary.map((c) => `${c.x},${c.y}`)).toEqual(['8,1']);
    });

    it('⛓ A 1-WIDE CORRIDOR IS NEVER AN AREA — the whole room is edges plus two singletons', () => {
        const world = roomOf([
            '.....',
            '####.',
            '.....',
            '.####',
            '.....',
        ], { goal: { x: 4, y: 4 } });
        const p = partitionMazeAreas(world, { entrance: { x: 0, y: 0 }, goal: { x: 4, y: 4 } });
        // ⛓ two SYNTHETIC one-cell areas, grown on the entrance and the goal
        // because neither lies in a chamber. This is the shape the AREA CENSUS
        // found at EVERY un-chambered carved kind.
        expect(p.areas.map((a) => [a.id, a.size, a.synthetic]))
            .toEqual([['A0', 1, true], ['A1', 1, true]]);
    });

    it('⛓ AN OPEN ROOM IS **ONE** AREA — which is why the binding must not call the module', () => {
        const world = roomOf(['.....', '.....', '.....'], { goal: { x: 4, y: 2 } });
        const p = partitionMazeAreas(world, { entrance: { x: 0, y: 0 }, goal: { x: 4, y: 2 } });
        expect(p.areas.length).toBe(1);
        expect(p.areas[0].size).toBe(15);
        expect(p.entranceArea).toBe('A0');
        expect(p.goalArea).toBe('A0');
    });

    it('⛔ FLOOR THE ENTRANCE CANNOT REACH IS NOT PARTITIONED — the `rooms` seed-6 defect', () => {
        const world = roomOf([
            '...##',
            '...##',
            '#####',
            '##...',
            '##...',
        ], { goal: { x: 2, y: 0 } });
        const p = partitionMazeAreas(world, { entrance: { x: 0, y: 0 }, goal: { x: 2, y: 0 } });
        expect(p.areas.map((a) => a.id)).toEqual(['A0']);
        expect(p.deadFloorCells).toBe(6);
        expect(p.labelAt(3, 3)).toBe(null);
    });
});

describe('procgenMaze — ⚖ RULING 3: at `keys: 0` and at <= 1 area the module is NOT CALLED', () => {
    it('⛓ `keys: 0` — the COUNTING SPY sees ZERO calls, and no draw is spent', () => {
        const plain = mazeModel({ seed: 3, skeleton: { kind: 'rooms' } });
        expect(calls.buildAreaGraph).toBe(0);
        const explicit = mazeModel({ seed: 3, skeleton: { kind: 'rooms' }, areas: { keys: 0 } });
        expect(calls.buildAreaGraph).toBe(0);
        expect(explicit.areas.ran).toBe(false);
        expect(explicit.areas.calledModule).toBe(false);
        expect(explicit.areas.partition).toBe(null);
        // ⛓ AND THE ROOM IS THE SAME ROOM, byte for byte — the claim ruling 3
        // makes is about a code path that does not execute.
        expect(serializeMazeLevel(explicit.skeleton()))
            .toEqual(serializeMazeLevel(plain.skeleton()));
    });

    it('⛓ `empty` at `keys: 1` — the partition is ONE area, so the module is STILL not called',
        () => {
            const model = mazeModel({ seed: 1, skeleton: { kind: 'empty' }, areas: { keys: 1 } });
            expect(calls.buildAreaGraph).toBe(0);
            expect(model.areas.calledModule).toBe(false);
            expect(model.areas.refused.reason).toBe('the-partition-yields-one-area-or-fewer');
            // ⛔ AND THE ROOM IS UNTOUCHED: no door, no key, no wall.
            expect(model.skeleton().obstacles.size).toBe(0);
            expect(model.skeleton().items.size).toBe(0);
        });

    it('⛓ at `keys: 1` on `rooms` the module IS called — or the two rows above are vacuous',
        () => {
            mazeModel({ seed: 1, skeleton: { kind: 'rooms' }, areas: { keys: 1 } });
            expect(calls.buildAreaGraph).toBe(1);
        });
});

describe('procgenMaze — THE REALISATION', () => {
    const RAN = [];
    for (let seed = 1; seed <= 24; seed += 1) {
        const model = mazeModel({ seed, skeleton: { kind: 'rooms' }, areas: { keys: 1 } });
        if (model.areas.ran) RAN.push({ seed, model });
    }

    it('⛓ the fixed spec really does run on a MAJORITY of seeds — the rows below are not '
        + 'green because nothing happened', () => {
        expect(RAN.length).toBeGreaterThanOrEqual(12);
    });

    it('every DOOR sits on a BOUNDARY cell of an area at its own key level', () => {
        for (const { seed, model } of RAN) {
            const { partition, graph, doors } = model.areas;
            for (const d of doors) {
                const area = partition.areas.find((a) => a.id === d.area);
                const where = `seed ${seed} door ${d.symbol}@(${d.x},${d.y})`;
                expect(`${where} on a boundary cell`).toBe(
                    `${where} ${area.boundary.some((c) => c.x === d.x && c.y === d.y)
                        ? 'on a boundary cell' : 'ELSEWHERE'}`,
                );
                expect(`${where} level`).toBe(`${where} ${graph.areas[d.area].keyLevel}` === `${where} ${d.level}`
                    ? `${where} level` : `${where} MISMATCHED`);
                expect(doorLevelOf(`door_${d.symbol}`)).toBe(d.level);
            }
        }
    });

    it('⛓ EVERY TREE EDGE\'s lock is realised at the CHILD\'s own boundary — §3.2\'s rule, '
        + 'which the area rule GENERALISES rather than replaces', () => {
        for (const { seed, model } of RAN) {
            const { graph, doors } = model.areas;
            for (const e of graph.edges.filter((x) => x.kind === 'tree' && x.lock !== null)) {
                const onChild = doors.filter((d) => d.area === e.b && d.symbol === e.lock);
                expect(`seed ${seed} ${e.a}->${e.b} lock ${e.lock}: doors on the child`)
                    .toBe(`seed ${seed} ${e.a}->${e.b} lock ${e.lock}: `
                        + `${onChild.length > 0 ? 'doors on the child' : 'NONE'}`);
            }
        }
    });

    it('every KEY sits INSIDE its own area, and never on a boundary / the entrance / the goal',
        () => {
            for (const { seed, model } of RAN) {
                const { partition, graph, keys } = model.areas;
                const world = model.skeleton();
                for (const k of keys) {
                    const area = partition.areas.find((a) => a.id === k.area);
                    const at = `seed ${seed} key ${k.symbol}@(${k.x},${k.y})`;
                    expect(`${at} inside ${k.area}`).toBe(
                        `${at} ${area.cells.some((c) => c.x === k.x && c.y === k.y)
                            ? `inside ${k.area}` : `NOT inside ${k.area}`}`,
                    );
                    expect(area.boundary.some((c) => c.x === k.x && c.y === k.y)).toBe(false);
                    expect(`${k.x},${k.y}`).not.toBe(`${world.entrance.x},${world.entrance.y}`);
                    expect(`${k.x},${k.y}`).not.toBe(`${model.goalCell.tx},${model.goalCell.ty}`);
                    // ⛓ and the module put the symbol there, not this binding.
                    expect(graph.areas[k.area].item).toBe(k.symbol);
                    expect(getItem(world, k.x, k.y)).toBe(`key_${k.symbol}`);
                }
            }
        });

    it('⛓ the PER-INSTANCE LIBRARY ENTRIES exist — without them a `door_K0` is a gate that '
        + 'does not gate (`isObstacleCleared` returns TRUE for an unknown id)', () => {
        const { model } = RAN[0];
        const world = model.skeleton();
        for (const symbol of model.areas.graph.symbols) {
            expect(world.obstacleLib[`door_${symbol}`].clear_set).toEqual([[`key_${symbol}`]]);
            expect(world.itemLib[`key_${symbol}`].classification).toBe('progression');
        }
        // ⛔ ADDITIVE: the six colour ids the v1 palette uses are untouched.
        expect(world.obstacleLib.door_red).toBe(DEFAULT_OBSTACLES.door_red);
        expect(world.itemLib.key_red).toBe(DEFAULT_ITEMS.key_red);
        expect(areaLibraries([]).addedObstacles).toEqual({});
    });
});

describe('procgenMaze — ⛓⛓ THE LEVEL-n VERIFICATION (the ONE flood)', () => {
    /**
     * ⛔ THE PROPERTY IS RE-DERIVED HERE FROM THE PARTITION AND THE GRAPH, not
     * read off `model.areas.refused`. Asking the binding whether the binding
     * agreed with itself is the fixed-point trap (⚖ trap 250); this walks the
     * grid independently and compares SETS.
     */
    const check = (model) => {
        const { partition, graph } = model.areas;
        const world = model.skeleton();
        const levelOf = new Map(partition.areas.map((a) => [a.id, graph.areas[a.id].keyLevel]));
        const maxLevel = Math.max(...levelOf.values());
        for (let n = 0; n <= maxLevel; n += 1) {
            const expected = new Set();
            for (const a of partition.areas) {
                if (levelOf.get(a.id) <= n) for (const c of a.cells) expected.add(`${c.x},${c.y}`);
            }
            for (const comp of partition.corridorComponents) {
                if (comp.touches.some((id) => levelOf.get(id) <= n)) {
                    for (const k of comp.cells) expected.add(k);
                }
            }
            const actual = reachableFrom(world.width, world.height, (x, y) => {
                if (world.tiles[y * world.width + x] !== TILE_FLOOR) return false;
                const lvl = doorLevelOf(getObstacle(world, x, y));
                return lvl === null || lvl <= n;
            }, { x: world.entrance.x, y: world.entrance.y });
            expect(`n=${n} ${[...actual].sort().join(' ')}`)
                .toBe(`n=${n} ${[...expected].sort().join(' ')}`);
        }
        return maxLevel;
    };

    for (const spec of [{ kind: 'rooms' }, { kind: 'rooms', params: { minRoom: 2 } }]) {
        const label = spec.params ? `rooms;minRoom=${spec.params.minRoom}` : 'rooms';
        it(`⛓ the reachable set at every key level is EXACT — ${label}, seeds 1..24`, () => {
            let ran = 0;
            let locked = 0;
            for (let seed = 1; seed <= 24; seed += 1) {
                const model = mazeModel({ seed, skeleton: spec, areas: { keys: 1 } });
                if (!model.areas.ran) continue;
                ran += 1;
                if (check(model) >= 1) locked += 1;
            }
            // ⛓ non-vacuity, twice: the spec ran, AND the rooms it produced
            // really have a level >= 1 (a room with no lock passes the property
            // for free).
            expect(ran).toBeGreaterThanOrEqual(12);
            expect(locked).toBe(ran);
        });
    }

    /**
     * ⛓⛓ **THE VERIFICATION CAN SAY NO — BOTH WAYS.** Without these two rows the
     * property above is a claim nothing can falsify (⚖ trap 250 / `feedback_
     * fixture_must_discriminate_two_builds`): every seed passes, so "it passed"
     * would be evidence about nothing. ⛔ Both mutations are IN THE TEST, on a
     * clone — the shipped realisation is untouched.
     *
     * ⚠ AND A ONE-DOOR MUTATION WAS NOT ENOUGH, which is itself a finding: on
     * `rooms` seed 1 the level-1 area carries THREE doors and removing one left
     * the reachable set unchanged, because that particular boundary cell's
     * corridor is only reachable THROUGH the area it guards. So the row removes
     * every door of the symbol.
     */
    it('⛓ IT SAYS NO when a door is MISSING — the extra cells are named', () => {
        const model = mazeModel({ seed: 1, skeleton: { kind: 'rooms' }, areas: { keys: 1 } });
        expect(model.areas.ran).toBe(true);
        const world = model.skeleton();
        for (const d of model.areas.doors) world.obstacles.delete(`${d.x},${d.y}`);
        const said = verifyAreaLevels(world, {
            partition: model.areas.partition, graph: model.areas.graph,
        });
        expect(said).not.toBe(null);
        expect(said.level).toBe(0);
        expect(said.detail).toMatch(/REACHED but not claimed/);
    });

    it('⛓ IT SAYS NO when a door is SPURIOUS — a lock on a level-0 area is caught too', () => {
        const model = mazeModel({ seed: 1, skeleton: { kind: 'rooms' }, areas: { keys: 1 } });
        const world = model.skeleton();
        const level0 = model.areas.partition.areas
            .find((a) => model.areas.graph.areas[a.id].keyLevel === 0 && a.boundary.length
                && a.id !== model.areas.partition.entranceArea);
        expect(level0).toBeTruthy();
        world.obstacles.set(`${level0.boundary[0].x},${level0.boundary[0].y}`, 'door_K0');
        const said = verifyAreaLevels(world, {
            partition: model.areas.partition, graph: model.areas.graph,
        });
        expect(said).not.toBe(null);
        expect(said.detail).toMatch(/UNREACHABLE but claimed/);
    });
});

describe('procgenMaze — REFUSALS are graded, never thrown', () => {
    it('⛓ `keys: 3` on the default 11x11 room REFUSES on nearly every seed, with the '
        + 'module\'s OWN reason, and leaves the carved room untouched', () => {
        let refused = 0;
        const reasons = new Set();
        for (let seed = 1; seed <= 12; seed += 1) {
            const model = mazeModel({ seed, skeleton: { kind: 'rooms' }, areas: { keys: 3 } });
            if (model.areas.ran) continue;
            refused += 1;
            reasons.add(model.areas.refused.reason);
            // ⛔ AND THE ROOM STILL SOLVES: a refused graph leaves the CARVED
            // room exactly as the carve left it.
            expect(model.skeleton().obstacles.size).toBe(0);
            expect(model.skeleton().items.size).toBe(0);
        }
        // ⚠ 11 of 12, not 12 of 12 — one seed's partition really does grow four
        // key levels at 11x11, and asserting 12 would have been a bound about
        // this measurement rather than about the rule.
        expect(refused).toBe(11);
        expect([...reasons].some((r) => r.includes('key-level') || r.includes('maxKeys')))
            .toBe(true);
    });

    it('the refusal names `maxKeys` as a TARGET rather than a ceiling', () => {
        const model = mazeModel({ seed: 1, skeleton: { kind: 'rooms' }, areas: { keys: 3 } });
        expect(model.areas.refused.detail).toMatch(/TARGET, not a ceiling/);
        expect(model.areas.calledModule).toBe(true);
    });

    it('an out-of-domain spec refuses at the CODEC, before any grid exists', () => {
        expect(() => mazeModel({ seed: 1, areas: { keys: 9 } }))
            .toThrow(/declared domain \[0, 1, 2, 3\]/);
    });
});

describe('procgenMaze — the level, the payload and the SOLVE', () => {
    const RUN = generateMazeLevel({
        seed: 1, bounds: { obstacleTarget: 3 }, skeleton: { kind: 'rooms' }, areas: { keys: 1 },
    });

    it('⛓ THE SKELETON SOLVE CERTIFIES THE ROOM **WITH** ITS DOORS AND KEYS', () => {
        // `generateLevel` THROWS at step 0 if the skeleton does not solve, so
        // reaching this line is the certification; the row states what it means.
        expect(RUN.trace[0].outcome).toBe('KEPT');
        expect(RUN.trace[0].verdict).toBe('SOLVED');
        expect(RUN.summary.finalCertification.collected).toContain('key_K0');
    });

    it('⛓ the payload carries the per-instance libraries, and a ROUND TRIP keeps the GATE',
        () => {
            const payload = serializeMazeLevel(RUN.record);
            expect(Object.keys(payload.obstacleLib)).toEqual(['door_K0']);
            expect(Object.keys(payload.itemLib)).toEqual(['key_K0']);
            const back = deserializeMazeLevel(payload);
            expect(back.obstacleLib.door_K0.clear_set).toEqual([['key_K0']]);
            expect(serializeMazeLevel(back)).toEqual(payload);
        });

    it('⛔ and at `areas: 0` the payload has NO library field at all — which is what keeps '
        + 'the per-kind CLI md5s byte-identical', () => {
        const plain = generateMazeLevel({
            seed: 1, bounds: { obstacleTarget: 3 }, skeleton: { kind: 'rooms' },
        });
        const payload = serializeMazeLevel(plain.record);
        expect('obstacleLib' in payload).toBe(false);
        expect('itemLib' in payload).toBe(false);
        expect(plain.summary.elements).toBe(undefined);
        expect(plain.summary.areas).toBe(undefined);
        expect(plain.summary.kept.every((k) => k.cost === undefined)).toBe(true);
    });

    it('⛓ ⚖ RULING 20 — the SOLVER-WORK RECORDS, per element and per kept template', () => {
        const [e] = RUN.summary.elements;
        expect(e.symbol).toBe('K0');
        expect(e.doorCount).toBeGreaterThan(0);
        expect(typeof e.planWith).toBe('number');
        expect(typeof e.planWithout).toBe('number');
        expect(typeof e.expandedWith).toBe('number');
        // ⛓ §3.5's DIFFERENTIAL: remove the key, keep the doors, and the goal
        // is gone. That is the PROOF that the lock is a cut.
        expect(e.planWithoutKey).toBe(null);
        expect(e.isCut).toBe(true);
        expect(typeof e.planKeyToDoor).toBe('number');
        for (const k of RUN.summary.kept) {
            expect(typeof k.cost.planBefore).toBe('number');
            expect(typeof k.cost.planAfter).toBe('number');
            expect(typeof k.cost.expandedAfter).toBe('number');
        }
        // ⛔ NO WALL CLOCK anywhere in the record (⚖ ruling 20's own exclusion).
        expect(JSON.stringify(RUN.summary.elements)).not.toMatch(/ms|time|clock/i);
    });

    it('⛓ THE DRIFT DETECTOR — the whole area block at a pinned seed (⚠ a fixture, so it '
        + 'reddens for ANY graph change BY DESIGN; slice 1 §8.5\'s shape)', () => {
        const a = RUN.summary.areas;
        expect(a.spec).toEqual({ keys: 1 });
        expect(a.graph.symbols).toEqual(['K0']);
        expect(a.partition).toEqual({
            areaCount: 5,
            syntheticCount: 1,
            adjacencyCount: 5,
            corridorComponents: 5,
            entranceArea: 'A0',
            goalArea: 'A4',
        });
        expect(a.graph.solutionPath).toEqual(['A0', 'A1', 'A4']);
        expect(a.doors.map((d) => `${d.symbol}@${d.x},${d.y}`))
            .toEqual(['K0@0,8', 'K0@7,8', 'K0@10,6']);
        expect(a.keys.map((k) => `${k.symbol}@${k.x},${k.y}`)).toEqual(['K0@6,1']);
    });

    it('⛓ TWO CALLS OF ONE SEED ARE BYTE-IDENTICAL — the areas spend draws from the ROOM '
        + 'stream and nothing else', () => {
        const again = generateMazeLevel({
            seed: 1, bounds: { obstacleTarget: 3 }, skeleton: { kind: 'rooms' },
            areas: { keys: 1 },
        });
        expect(JSON.stringify(serializeMazeLevel(again.record)))
            .toBe(JSON.stringify(serializeMazeLevel(RUN.record)));
        expect(JSON.stringify(again.summary.areas)).toBe(JSON.stringify(RUN.summary.areas));
        expect(again.summary.drawsSpent).toBe(RUN.summary.drawsSpent);
    });

    it('⛓ ⚖ RULING 16 — a GRAPHIFY edge exists at some seed, and it is locked or free by the '
        + 'ONE-SYMBOL law', () => {
        let found = 0;
        for (let seed = 1; seed <= 24; seed += 1) {
            const model = mazeModel({ seed, skeleton: { kind: 'rooms' }, areas: { keys: 1 } });
            if (!model.areas.ran) continue;
            for (const e of model.areas.graph.edges.filter((x) => x.kind === 'graphify')) {
                found += 1;
                const la = model.areas.graph.areas[e.a].keyLevel;
                const lb = model.areas.graph.areas[e.b].keyLevel;
                // the lock is K_{max(level)-1}, or null when the levels are equal
                expect(e.lock).toBe(la === lb ? null : `K${Math.max(la, lb) - 1}`);
            }
        }
        expect(found).toBeGreaterThan(0);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ RULE-DIRECTED — `require: [K…]` (slice 3, §3.5)
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenMaze — the `require` directive', () => {
    const BOUNDS = {
        obstacleTarget: 3, triesPerStep: 4, saturationK: 3, anchorTriesPerCandidate: 1,
    };
    /** ⛓ 15x15 `rooms` is where two keys fit (the acceptance table, §9.5). */
    const run = (o) => generateMazeLevel({
        bounds: BOUNDS, width: 15, height: 15, skeleton: { kind: 'rooms' }, ...o,
    });

    it('⛓⛓ a MET directive carries the differential as its proof, graded STRONG', () => {
        const out = run({ seed: 1, areas: { keys: 1 }, require: ['K0'] });
        const req = out.summary.require;
        expect(req.refused).toBe(null);
        expect(req.asked).toEqual(['K0']);
        expect(req.met).toHaveLength(1);
        const [m] = req.met;
        expect(m.symbol).toBe('K0');
        expect(m.grade).toBe('STRONG');
        // ⛔ THE PROOF: the goal is REACHABLE with the key and UNREACHABLE without it.
        expect(m.planWith).toBeGreaterThan(0);
        expect(m.planWithoutKey).toBe(null);
        expect(m.doorCount).toBeGreaterThan(0);
        // …and the element it was read off says the same thing, so the summary
        // is a projection of the cost record rather than a second answer.
        const e = out.summary.elements.find((x) => x.symbol === 'K0');
        expect(e.isCut).toBe(true);
        expect(m.planWith).toBe(e.planWith);
    });

    it('⛔ NO run without a directive grows a `require` field (the bytes do not move)', () => {
        const out = run({ seed: 1, areas: { keys: 1 } });
        expect('require' in out.summary).toBe(false);
        expect(requireOutcome({ require: null, areas: out.model.areas })).toBe(null);
        expect(requireOutcome({ require: [], areas: out.model.areas })).toBe(null);
    });

    it('⛔ REFUSES a symbol beyond `maxKeys` BY NAME — no bound is widened', () => {
        const out = run({ seed: 1, areas: { keys: 1 }, require: ['K1'] });
        const r = out.summary.require;
        expect(r.met).toEqual([]);
        expect(r.refused.reason).toBe('no-key-level-admits-this-symbol-within-maxkeys');
        expect(r.refused.detail).toMatch(/declares maxKeys=1, whose symbols are \[K0\]/);
        expect(r.refused.detail).toMatch(/No bound is widened/);
        // ⛓ …and the LEVEL is still the level the spec asked for: a refused
        // directive does not rebuild the room behind the caller's back.
        expect(out.model.areas.ran).toBe(true);
        expect(out.model.areas.graph.symbols).toEqual(['K0']);
    });

    it('⛔ REFUSES at `areas=0`, where the module never runs', () => {
        const out = run({ seed: 1, areas: { keys: 0 }, require: ['K0'] });
        expect(out.summary.require.refused.reason).toBe('the-directive-needs-the-area-graph');
        expect(out.summary.require.refused.detail).toMatch(/at `areas=0`/);
        expect('areas' in out.summary).toBe(false);
    });

    it('⛔ carries the GRAPH\'s own refusal VERBATIM when the binding did not run', () => {
        /** ⛓ 11x11 at two keys is the honest refusal case (§9.5: 4/24 run). */
        const out = generateMazeLevel({
            bounds: BOUNDS, seed: 2, skeleton: { kind: 'rooms' },
            areas: { keys: 2 }, require: ['K0', 'K1'],
        });
        const r = out.summary.require;
        expect(r.refused.reason).toBe('the-area-graph-refused');
        expect(out.model.areas.ran).toBe(false);
        // the binding's own reason, inside the directive's sentence
        expect(r.refused.detail).toContain(out.model.areas.refused.reason);
        expect(r.refused.detail).toMatch(/rather than retried/);
    });

    /**
     * ⛓⛓⛓ THE ARM THE REAL CORPUS NEVER FIRES — DRIVEN ANYWAY.
     *
     * Measured over `rooms`/`rooms;minRoom=2` × 11x11/15x15 × keys 1..2 ×
     * seeds 1..24: **148 placed symbols, 148 cuts, ZERO non-cuts**, because the
     * goal sits at the HIGHEST key level and a door guards every boundary cell
     * of every area at its level — so removing any key seals the goal. ⇒ the
     * `is not a cut` refusal cannot be reached with a real seed today, and a
     * test that waited for one would be a claim nothing can falsify. It is
     * driven here with an element record whose `isCut` is false.
     */
    it('⛔ REFUSES a symbol whose KEY ablation still solves — the differential is the proof', () => {
        const areas = { spec: { keys: 1 }, ran: true, graph: { symbols: ['K0'] } };
        const r = requireOutcome({
            require: ['K0'],
            areas,
            elements: [{ symbol: 'K0', isCut: false, planWith: 12, planWithoutKey: 17,
                doorCount: 3, key: { x: 4, y: 4 } }],
        });
        expect(r.refused.reason).toBe('the-required-symbol-is-not-a-cut');
        expect(r.refused.detail).toMatch(/still leaves the goal reachable in 17 step\(s\)/);
        // …and the SAME element with `isCut` true is MET, so the row above is
        // about the cut and not about the shape of the record.
        expect(requireOutcome({
            require: ['K0'],
            areas,
            elements: [{ symbol: 'K0', isCut: true, planWith: 12, planWithoutKey: null,
                doorCount: 3, key: { x: 4, y: 4 } }],
        }).refused).toBe(null);
    });

    it('⛔ REFUSES a symbol the graph declares but no element measured', () => {
        const r = requireOutcome({
            require: ['K1'],
            areas: { spec: { keys: 2 }, ran: true, graph: { symbols: ['K0', 'K1'] } },
            elements: [{ symbol: 'K0', isCut: true }],
        });
        expect(r.refused.reason).toBe('the-required-symbol-was-not-placed');
        expect(r.refused.detail).toMatch(/vacuous half/);
    });

    it('⛓ TWO symbols are met TOGETHER, each with its own differential', () => {
        /** ⛓ seed picked by the ACCEPTANCE table, not by luck: 15x15 keys=2. */
        let found = null;
        for (let seed = 1; seed <= 24 && !found; seed += 1) {
            const out = run({ seed, areas: { keys: 2 }, require: ['K0', 'K1'] });
            if (out.summary.require.refused === null) found = out;
        }
        expect(found, 'no 15x15 rooms seed in 1..24 hosts two keys').not.toBe(null);
        expect(found.summary.require.met.map((m) => m.symbol)).toEqual(['K0', 'K1']);
        expect(found.summary.require.met.every((m) => m.grade === 'STRONG'
            && m.planWithoutKey === null)).toBe(true);
    });

    /**
     * ⛓⛓ THE NON-VACUITY GUARD FOR THE WHOLE FAMILY (trap 292): the corpus the
     * rows above stand on must actually contain met runs AND refused runs, or
     * every "over the seeds where it ran" claim is about the empty set.
     */
    it('⛓ over seeds 1..24 the directive is BOTH met and refused, and every met run is a cut', () => {
        let met = 0;
        let refused = 0;
        for (let seed = 1; seed <= 24; seed += 1) {
            const out = run({ seed, areas: { keys: 2 }, require: ['K0', 'K1'] });
            const r = out.summary.require;
            if (r.refused) { refused += 1; continue; }
            met += 1;
            expect(r.met.every((m) => m.planWithoutKey === null && m.grade === 'STRONG')).toBe(true);
        }
        expect(met).toBeGreaterThan(0);
        expect(refused).toBeGreaterThan(0);
        expect(met + refused).toBe(24);
    });
});
