/**
 * The placer's reachable-tile BFS on integers (APWORLD SUBSTRATE CHANGE C0, plan
 * §41) — held to the general form it replaced, element for element.
 *
 * `reachableTileOrder` must return EXACTLY the list `reachableTilesByKey` does:
 * the same states in the same discovery order. The list is a multiset whose size
 * and order feed the placer's rng draw, so "the same set of tiles" is not the
 * bar — a list one repeat shorter moves every generated room (plan §40.1).
 *
 * The reference is the general form itself — the BFS over `step` keyed by
 * `mazeVisitedKey`, unchanged but for a head-index queue — so the property does
 * not share the subject's representation (trap 1430).
 */
import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import { reach, makeBfsSolver } from '../shared/simulatorCore.js';
import {
    TILE_WALL, INPUTS, INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    createWorld, createState, isFloor, getObstacle,
    extractPathsAndObstacles,
    setTile, setItem, setObstacle, setButton, setBlock,
    placeFromItems,
    _testOnly_reachableTileOrders,
} from './mazeRoomEngine.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';

const PICKUP_IDS = ['key_a', 'key_b', 'key_c', 'gem', 'coin'];
const ABSENT_ID = 'never_placed';

/** A random rule over the pickup ids (and one id no tile carries). */
function randomRule(rng, depth = 0) {
    const ids = [...PICKUP_IDS, ABSENT_ID];
    const any = () => ids[Math.floor(rng.next() * ids.length)];
    const kind = Math.floor(rng.next() * (depth > 1 ? 3 : 5));
    if (kind === 0) return { rule: 'Has', args: { item_name: any() } };
    if (kind === 1) return { rule: 'HasAll', args: { item_names: [any(), any()] } };
    if (kind === 2) return { rule: 'HasAny', args: { items: [any(), any()] } };
    return { rule: kind === 3 ? 'And' : 'Or', children: [randomRule(rng, depth + 1), randomRule(rng, depth + 1)] };
}

/**
 * A random world: walls, pickups (ids repeat), and obstacles of every clearance
 * kind — single-key doors, two-key and either-key combos, rule gates (some on a
 * pickup's own tile, the way `placeFromRules` places them), an id the library
 * lacks, and a door nothing clears.
 */
function randomWorld(rng) {
    const width = 4 + Math.floor(rng.next() * 4);
    const height = 3 + Math.floor(rng.next() * 3);
    const world = createWorld(width, height, { entrance: { x: 0, y: 0 } });
    world.obstacleLib = { ...DEFAULT_OBSTACLES };
    const cell = () => ({ x: Math.floor(rng.next() * width), y: Math.floor(rng.next() * height) });
    const isEntrance = (p) => p.x === 0 && p.y === 0;
    const walls = Math.floor(width * height * rng.next() * 0.3);
    for (let i = 0; i < walls; i++) {
        const p = cell();
        if (!isEntrance(p)) setTile(world, p.x, p.y, TILE_WALL);
    }
    const pickups = 2 + Math.floor(rng.next() * 7);
    for (let i = 0; i < pickups; i++) {
        const p = cell();
        if (!isEntrance(p)) setItem(world, p.x, p.y, PICKUP_IDS[Math.floor(rng.next() * PICKUP_IDS.length)]);
    }
    const obstacles = Math.floor(rng.next() * 5);
    for (let i = 0; i < obstacles; i++) {
        const p = cell();
        if (isEntrance(p)) continue;
        const id = `ob_${i}`;
        const a = PICKUP_IDS[Math.floor(rng.next() * PICKUP_IDS.length)];
        const b = PICKUP_IDS[Math.floor(rng.next() * PICKUP_IDS.length)];
        const kind = Math.floor(rng.next() * 6);
        if (kind === 0) world.obstacleLib[id] = { clear_set_type: 'combo_list', clear_set: [[a]] };
        else if (kind === 1) world.obstacleLib[id] = { clear_set_type: 'combo_list', clear_set: [[a, b]] };
        else if (kind === 2) world.obstacleLib[id] = { clear_set_type: 'combo_list', clear_set: [[a], [b]] };
        else if (kind === 3) world.obstacleLib[id] = { clear_set_type: 'rule', clear_rule: randomRule(rng) };
        else if (kind === 4) world.obstacleLib[id] = { clear_set_type: 'combo_list', clear_set: [] };
        // kind 5: an id the library lacks — `isObstacleCleared` lets it through.
        setObstacle(world, p.x, p.y, id);
    }
    return world;
}

describe('reachableTileOrder — the integer BFS is the general BFS, element for element', () => {
    it('matches the key-form discovery order over random worlds, and the population exercises repeats, gates opened by a pickup, and a carried start', () => {
        const rng = createRng(20260928);
        const covered = { repeatedTile: 0, gateCrossed: 0, carriedStart: 0 };
        for (let i = 0; i < 300; i++) {
            const world = randomWorld(rng);
            const start = createState(world);
            if (rng.next() < 0.25) {
                start.inventory.add(PICKUP_IDS[Math.floor(rng.next() * PICKUP_IDS.length)]);
                covered.carriedStart++;
            }
            const { byMask, byKey } = _testOnly_reachableTileOrders(world, start);
            expect(byMask, `world ${i}`).toEqual(byKey);
            if (new Set(byKey).size < byKey.length) covered.repeatedTile++;
            const width = world.width;
            const gated = byKey.some((c) => world.obstacles.has(`${c % width},${Math.floor(c / width)}`)
                && world.obstacleLib[world.obstacles.get(`${c % width},${Math.floor(c / width)}`)]);
            if (gated) covered.gateCrossed++;
        }
        // The property is only as good as the worlds it ran on.
        expect(covered.repeatedTile).toBeGreaterThan(0);
        expect(covered.gateCrossed).toBeGreaterThan(0);
        expect(covered.carriedStart).toBeGreaterThan(0);
    });

    it('hands a world with blocks or buttons to the general form', () => {
        const buttons = createWorld(4, 3, { entrance: { x: 0, y: 0 } });
        setButton(buttons, 2, 1, 'button_A');
        expect(_testOnly_reachableTileOrders(buttons, createState(buttons)).byMask).toBeNull();
        const blocks = createWorld(4, 3, { entrance: { x: 0, y: 0 } });
        setBlock(blocks, 2, 1);
        expect(_testOnly_reachableTileOrders(blocks, createState(blocks)).byMask).toBeNull();
    });

    it('tracks distinct pickups up to its mask width, then hands the world to the general form — the width derived by probing', () => {
        // Pickups on walled-off cells: never collected, so the key form stays
        // cheap while the integer form still has to give each id a bit.
        const worldWith = (n) => {
            const width = n + 2;
            const world = createWorld(width, 3, { entrance: { x: 0, y: 0 } });
            for (let x = 0; x < width; x++) setTile(world, x, 1, TILE_WALL);
            for (let x = 0; x < n; x++) setItem(world, x, 2, `pickup_${x}`);
            setItem(world, 1, 0, 'pickup_0');
            return world;
        };
        let limit = null;
        for (let n = 1; n <= 64 && limit === null; n++) {
            const world = worldWith(n);
            const { byMask, byKey } = _testOnly_reachableTileOrders(world, createState(world));
            if (byMask === null) limit = n - 1;
            else expect(byMask).toEqual(byKey);
        }
        expect(limit).not.toBeNull();
        expect(limit).toBeGreaterThan(0);
    });
});

/** An open room (no walls) holding `u` distinct pickups no gate stands on. */
function openRoomWithPickups(u) {
    const world = createWorld(8, 6, { entrance: { x: 4, y: 3 } });
    world.obstacleLib = { ...DEFAULT_OBSTACLES };
    for (let i = 0; i < u; i++) setItem(world, i % 8, Math.floor(i / 8), `pickup_${i}`);
    return world;
}

function countingRng(seed) {
    const rng = createRng(seed);
    let draws = 0;
    return { next: () => { draws++; return rng.next(); }, get draws() { return draws; } };
}

describe('pickReachableFloorTile — the draw is over the SAME multiset', () => {
    it('places pickups where a pick over the key-form list would, with the same number of rng draws', () => {
        // The reference placer: the pre-C0 pickReachableFloorTile over the key
        // form's list (every repeat kept), one draw per placement.
        const referencePlace = (world, items, rng) => {
            const placed = [];
            for (const item_id of items) {
                const excluded = new Set(placed.map((p) => `${p.position.x},${p.position.y}`));
                const width = world.width;
                const candidates = _testOnly_reachableTileOrders(world, createState(world)).byKey
                    .map((c) => ({ x: c % width, y: Math.floor(c / width) }))
                    .filter((t) => !(t.x === world.entrance.x && t.y === world.entrance.y)
                        && ![...world.exits.values()].some((e) => e.x === t.x && e.y === t.y)
                        && !excluded.has(`${t.x},${t.y}`)
                        && !world.items.get(`${t.x},${t.y}`)
                        && !world.obstacles.get(`${t.x},${t.y}`));
                if (candidates.length === 0) break;
                const tile = candidates[Math.floor(rng.next() * candidates.length)];
                setItem(world, tile.x, tile.y, item_id);
                placed.push({ item_id, position: tile });
            }
            return placed;
        };
        const items = Array.from({ length: 8 }, (_, i) => `loc_item_${i}`);
        for (const seed of [1, 2, 3]) {
            const subjectRng = countingRng(seed);
            const referenceRng = countingRng(seed);
            const subject = placeFromItems(openRoomWithPickups(0), { items_to_place: items, rng: subjectRng });
            const reference = referencePlace(openRoomWithPickups(0), items, referenceRng);
            expect(subject.placed_items, `seed ${seed}`).toEqual(reference);
            expect(subjectRng.draws, `seed ${seed}: draws`).toBe(referenceRng.draws);
            expect(subject.placed_items.length).toBe(items.length);
        }
    });

    it('places u open-room pickups for under a quarter of ONE key-form BFS over the finished room (the cliff\'s constant, as a relation)', () => {
        // With the key form, placing u pickups costs a BFS per placement over up to
        // floor × 2^k states (k placed so far): Σ 2^k ≈ 2^u, about ONE key-form BFS
        // over the finished room (measured: the pre-C0 path sits AT this bound).
        // The integer form must bring the whole placement under a QUARTER of it
        // (measured 14–20× under at C0; the margin absorbs a loaded machine).
        const u = 9;
        const best = (fn) => {
            let ms = Infinity;
            for (let i = 0; i < 3; i++) {
                const t0 = performance.now();
                fn();
                ms = Math.min(ms, performance.now() - t0);
            }
            return ms;
        };
        const items = Array.from({ length: u }, (_, i) => `loc_item_${i}`);
        const placeMs = best(() => placeFromItems(openRoomWithPickups(0), { items_to_place: items, rng: createRng(1) }));
        const finished = openRoomWithPickups(u);
        const { byKey } = _testOnly_reachableTileOrders(finished, createState(finished));
        expect(byKey.length).toBeGreaterThan(finished.width * finished.height * 2 ** (u - 1));
        const oneKeyBfsMs = best(() => _testOnly_reachableTileOrders(finished, createState(finished)));
        expect(placeMs * 4).toBeLessThan(oneKeyBfsMs);
    });
});

describe('extractPathsAndObstacles — one ghost BFS tree serves every target', () => {
    it('annotates every exit and pickup exactly as a per-target ghost BFS would', () => {
        // The reference is the pre-C0 shape: one \`reach\` per target over a
        // position-keyed solver whose step sees walls and nothing else.
        const DELTA = { [INPUT_N]: [0, -1], [INPUT_S]: [0, 1], [INPUT_E]: [1, 0], [INPUT_W]: [-1, 0] };
        const ghost = makeBfsSolver({
            inputs: INPUTS,
            visitedKey: (s) => `${s.player_pos.x},${s.player_pos.y}`,
            step: (world, s, input) => {
                const d = DELTA[input];
                const x = s.player_pos.x + d[0];
                const y = s.player_pos.y + d[1];
                return isFloor(world, x, y) ? { ...s, player_pos: { x, y } } : null;
            },
        });
        const reference = (world, position) => {
            const r = reach(world, ghost, createState(world),
                (s) => s.player_pos.x === position.x && s.player_pos.y === position.y);
            if (!r.ok) return [];
            const seen = [];
            let at = { ...createState(world).player_pos };
            for (const input of r.plan) {
                const d = DELTA[input];
                at = { x: at.x + d[0], y: at.y + d[1] };
                const id = getObstacle(world, at.x, at.y);
                if (id && !seen.includes(id)) seen.push(id);
            }
            return [{ path_id: 'p1', obstacles: seen }];
        };
        const rng = createRng(4202609);
        let targets = 0;
        let unreachable = 0;
        let withObstacles = 0;
        let atEntrance = 0;
        for (let i = 0; i < 200; i++) {
            const world = randomWorld(rng);
            // A back exit stands ON the entrance tile (the top-down layout puts it
            // there), so a target whose plan is empty is part of the population.
            if (rng.next() < 0.3) {
                world.exits.set('back', { exit_id: 'back', x: world.entrance.x, y: world.entrance.y });
                atEntrance++;
            }
            const out = extractPathsAndObstacles(world);
            for (const t of [...out.exits, ...out.locations]) {
                const expected = reference(world, t.position);
                expect(t.paths, `world ${i} target ${t.id}`).toEqual(expected);
                targets++;
                if (expected.length === 0) unreachable++;
                else if (expected[0].obstacles.length > 0) withObstacles++;
            }
        }
        expect(targets).toBeGreaterThan(0);
        expect(unreachable).toBeGreaterThan(0);
        expect(withObstacles).toBeGreaterThan(0);
        expect(atEntrance).toBeGreaterThan(0);
    });
});
