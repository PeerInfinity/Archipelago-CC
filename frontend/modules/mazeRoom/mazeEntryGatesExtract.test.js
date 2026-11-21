/**
 * CONTENT SETS PASS-3 part 0 — **EVERY WALKABILITY READER HONOURS `entry_gates`**.
 *
 * PASS-D measured (content-sets-passability-design § 1.3) that on a plain world the generic extractor's geometry and
 * set search (`ghostStep`, `minimalObstacleSets`) and the autopather's `_bfsToGoal` ignored the engine's one-way
 * primitive: a `null`-gated exit was reported reachable with no rule while `step` refused the walk. This file pins the
 * fix:
 *   1. PASS-D's 5×3 corridor, verbatim: plain / a `null` entry gate / a wall.
 *   2. On entry-gate worlds the extractor's reachability equals `step`'s BFS, and the autopather agrees: every single
 *      `null` gate and every pair of them on an open room, for every target (the exit and a pickup).
 *   3. A GATED entry (a gate id) is charged like an obstacle on that directed step: the compiled rule is the gate's,
 *      and `bfsSolver` agrees without and with the item.
 *   4. A world without entry gates extracts exactly as before (the committed presets: the op-log and table gates).
 */
import { describe, expect, it } from 'vitest';

import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    INPUTS, TILE_WALL, bfsSolver, createState, createWorld, extractPathsAndObstacles, floorReachableSet, setItem, setTile,
    whyBlocked,
} from './mazeRoomEngine.js';
import { findPath } from './mazeAutopather.js';

const corridor = () => {
    const w = createWorld(5, 3, { entrance: { x: 0, y: 1 }, exits: [{ x: 4, y: 1, exit_id: 'exit_0', side: 'E' }] });
    for (let x = 0; x < 5; x++) { setTile(w, x, 0, TILE_WALL); setTile(w, x, 2, TILE_WALL); }
    return w;
};
const exitPaths = (w) => extractPathsAndObstacles(w).exits.map((e) => e.paths);
const solve = (w, goal, inv = []) => bfsSolver({
    world: w, startState: { ...createState(w), inventory: new Set(inv) }, goalPred: (s) => s.player_pos.x === goal.x && s.player_pos.y === goal.y,
    options: { budget: 100000 },
}).ok;

describe('1. PASS-D\'s corridor probe', () => {
    it('plain: reachable and free; a null entry gate: unreachable to every reader, like a wall', () => {
        const exit = { x: 4, y: 1 };
        const plain = corridor();
        expect(exitPaths(plain)).toEqual([[{ path_id: 'p1', obstacles: [] }]]);
        expect(solve(plain, exit)).toBe(true);
        expect(findPath(plain, { x: 0, y: 1 }, { kind: 'tile', ...exit })).not.toBeNull();

        const oneway = corridor();
        oneway.entryGates = new Map([['1,1,E', null]]);
        expect(exitPaths(oneway)).toEqual([[]]);   // was [{p1, []}] before PASS-3: reachable with no rule
        expect(solve(oneway, exit)).toBe(false);
        expect(findPath(oneway, { x: 0, y: 1 }, { kind: 'tile', ...exit })).toBeNull();
        expect(floorReachableSet(oneway).has('4,1')).toBe(false);
        expect(whyBlocked(oneway, createState(oneway), 'E')).toMatch(/entry|E/);

        const walled = corridor();
        setTile(walled, 1, 1, TILE_WALL);
        expect(exitPaths(walled)).toEqual(exitPaths(oneway));
        // The gate is one-way: the same corridor walked the other way is open.
        const back = createWorld(5, 3, { entrance: { x: 4, y: 1 }, exits: [{ x: 0, y: 1, exit_id: 'exit_0', side: 'W' }] });
        for (let x = 0; x < 5; x++) { setTile(back, x, 0, TILE_WALL); setTile(back, x, 2, TILE_WALL); }
        back.entryGates = new Map([['1,1,E', null]]);
        expect(exitPaths(back)).toEqual([[{ path_id: 'p1', obstacles: [] }]]);
        expect(solve(back, { x: 0, y: 1 })).toBe(true);
    });
});

describe('2. on entry-gate worlds the extractor\'s reachability equals step\'s BFS, and the autopather agrees', () => {
    // An open 4×3 room: the entrance top-left, the exit bottom-right, a pickup in the middle.
    const W = 4;
    const H = 3;
    const ITEM = { x: 1, y: 1 };
    const EXIT = { x: 3, y: 2 };
    const room = (gates) => {
        const w = createWorld(W, H, { entrance: { x: 0, y: 0 }, exits: [{ ...EXIT, exit_id: 'exit_0', side: 'E' }] });
        setItem(w, ITEM.x, ITEM.y, 'key_red');
        if (gates.length) w.entryGates = new Map(gates.map((g) => [g, null]));
        return w;
    };
    const slots = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const d of INPUTS) slots.push(`${x},${y},${d}`);
    const agree = (gates) => {
        const w = room(gates);
        const ex = extractPathsAndObstacles(w);
        const extracted = {
            exit: ex.exits[0].paths.length > 0,
            item: (ex.locations.find((l) => l.position?.x === ITEM.x && l.position?.y === ITEM.y)?.paths ?? []).length > 0,
        };
        // the engine: a location tile is a check (the BFS never needs the pickup: no obstacle names it)
        const engine = { exit: solve(w, EXIT), item: solve(w, ITEM) };
        const auto = {
            exit: findPath(w, w.entrance, { kind: 'tile', ...EXIT }, { excludeOtherExits: true }) !== null,
            item: findPath(w, w.entrance, { kind: 'tile', ...ITEM }, { excludeOtherExits: true }) !== null,
        };
        return { gates, extracted, engine, auto };
    };

    it('every single null gate', () => {
        const rows = slots.map((g) => agree([g]));
        for (const r of rows) {
            expect(r.extracted, JSON.stringify(r.gates)).toEqual(r.engine);
            expect(r.auto, JSON.stringify(r.gates)).toEqual(r.engine);
        }
    });

    it('every pair of null gates (some of them cut a target off)', () => {
        let cut = 0;
        for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
                const r = agree([slots[i], slots[j]]);
                expect(r.extracted, JSON.stringify(r.gates)).toEqual(r.engine);
                expect(r.auto, JSON.stringify(r.gates)).toEqual(r.engine);
                if (!r.engine.exit || !r.engine.item) cut += 1;
            }
        }
        expect(cut).toBeGreaterThan(0); // the sweep exercises refusal, not only open rooms
    });
});

describe('3. a gated entry is charged like an obstacle on that directed step', () => {
    it('the compiled exit rule is the gate\'s; bfsSolver agrees without and with the item; the other way is free', () => {
        const rule = { rule: 'Has', args: { item_name: 'Progressive Swim' } };
        const w = corridor();
        w.obstacleLib = { ...DEFAULT_OBSTACLES, swim_entry: { ...DEFAULT_OBSTACLES.logic_gate, id: 'swim_entry', clear_rule: rule } };
        w.entryGates = new Map([['2,1,E', 'swim_entry']]);
        const ex = extractPathsAndObstacles(w);
        expect(ex.exits[0].paths).toEqual([{ path_id: 'p1', obstacles: ['swim_entry'] }]);
        const compiled = compileRegion(ex, { obstacleLib: w.obstacleLib });
        expect(compiled.exits[0].rule).toEqual(rule);
        expect(solve(w, { x: 4, y: 1 })).toBe(false);
        expect(solve(w, { x: 4, y: 1 }, ['Progressive Swim'])).toBe(true);
        expect(findPath(w, { x: 0, y: 1 }, { kind: 'tile', x: 4, y: 1 }, { inventory: new Set() })).toBeNull();
        expect(findPath(w, { x: 0, y: 1 }, { kind: 'tile', x: 4, y: 1 }, { inventory: new Set(['Progressive Swim']) })).not.toBeNull();
        // without an inventory the autopather is transparent to clearances (as to obstacles), never to a null gate
        expect(findPath(w, { x: 0, y: 1 }, { kind: 'tile', x: 4, y: 1 })).not.toBeNull();
    });
});

describe('4. a world without entry gates extracts as before', () => {
    it('the corridor and the room: no gate key, no change', () => {
        const a = corridor();
        const b = corridor();
        b.entryGates = new Map();
        expect(JSON.stringify(extractPathsAndObstacles(b))).toBe(JSON.stringify(extractPathsAndObstacles(a)));
    });
});
