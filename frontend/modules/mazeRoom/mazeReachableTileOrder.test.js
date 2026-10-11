/**
 * The placer's reachable list (APWORLD SUBSTRATE CHANGE C0 → C1, plan §41–§42).
 *
 * Since C1 the placer draws over `reachableTileFixpoint`'s list — every
 * reachable tile ONCE, in the discovery order of a position BFS under everything
 * collectable — not over the full-state BFS's projection, which repeated a tile
 * once per inventory it was first reached under (the multiset C0 kept
 * byte-identical, and whose 2^u states were the maze location cliff).
 *
 * The references are built from `step` itself, never from the subject's
 * representation (trap 1430):
 *   · the SET — the general form (`reachableTilesByKey`, the BFS over `step`
 *     keyed by `mazeVisitedKey`), deduplicated;
 *   · the ORDER — a position-keyed BFS over `step` with `inventoryOverride` set
 *     to the carried items plus every pickup standing on that set.
 */
import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import { reach, makeBfsSolver } from '../shared/simulatorCore.js';
import {
    TILE_WALL, INPUTS, INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    createWorld, createState, isFloor, getObstacle, getExitAt, step,
    extractPathsAndObstacles,
    setTile, setItem, setObstacle, setButton, setBlock, clearItem, clearObstacle,
    generateRegionCore, placeFromItems,
    _testOnly_reachableTileOrders,
} from './mazeRoomEngine.js';
import { DEFAULT_OBSTACLES, isObstacleCleared } from '../shared/procgen/library.js';

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

/** Random worlds, a quarter of them with a carried start item. */
function* randomCases(seed, n) {
    const rng = createRng(seed);
    for (let i = 0; i < n; i++) {
        const world = randomWorld(rng);
        const start = createState(world);
        const carried = rng.next() < 0.25;
        if (carried) start.inventory.add(PICKUP_IDS[Math.floor(rng.next() * PICKUP_IDS.length)]);
        yield { i, world, start, carried };
    }
}

const cellKey = (world, cell) => `${cell % world.width},${Math.floor(cell / world.width)}`;

/**
 * The ORDER reference: the carried items plus every pickup on the general
 * form's reachable set, then ONE position-keyed BFS over `step` with that
 * inventory as its override (FIFO, `INPUTS` order).
 */
function positionBfsUnderEverything(world, start, byKey) {
    const inventory = new Set(start.inventory);
    for (const cell of byKey) {
        const itemId = world.items.get(cellKey(world, cell));
        // A pickup on an exit tile is where the walk ENDS — it opens nothing.
        const [x, y] = cellKey(world, cell).split(',').map(Number);
        if (itemId && !getExitAt(world, x, y)) inventory.add(itemId);
    }
    const width = world.width;
    const first = start.player_pos.y * width + start.player_pos.x;
    const seen = new Set([first]);
    const queue = [start];
    const out = [first];
    for (let head = 0; head < queue.length; head++) {
        // An exit tile is reached, never passed (the engine's isDeadEndExit).
        const at = queue[head].player_pos;
        if (head > 0 && getExitAt(world, at.x, at.y)) continue;
        for (const input of INPUTS) {
            const next = step(world, queue[head], input, inventory);
            if (!next) continue;
            const cell = next.player_pos.y * width + next.player_pos.x;
            if (seen.has(cell)) continue;
            seen.add(cell);
            queue.push(next);
            out.push(cell);
        }
    }
    return out;
}

describe('reachableTileFixpoint — the general form\'s reachable SET, each tile once', () => {
    it('lists exactly the tiles the full-state BFS reaches, none twice, and the placer draws over it — over random worlds whose population opens gates with pickups, repeats tiles, and carries a start item', () => {
        const covered = { repeatedTile: 0, gateCrossed: 0, keyBehindDoor: 0, carriedStart: 0 };
        for (const { i, world, start, carried } of randomCases(20260928, 300)) {
            const { fixpoint, byKey, placer } = _testOnly_reachableTileOrders(world, start);
            expect(fixpoint, `world ${i}`).not.toBeNull();
            expect(new Set(fixpoint).size, `world ${i}: no tile twice`).toBe(fixpoint.length);
            expect([...fixpoint].sort((a, b) => a - b), `world ${i}`).toEqual([...new Set(byKey)].sort((a, b) => a - b));
            expect(placer, `world ${i}`).toEqual(fixpoint);
            if (carried) covered.carriedStart++;
            if (new Set(byKey).size < byKey.length) covered.repeatedTile++;
            const gates = fixpoint.map((c) => world.obstacles.get(cellKey(world, c)))
                .filter((id) => id && world.obstacleLib[id]);
            if (gates.length) covered.gateCrossed++;
            // A gate the START inventory does not clear, on the list: only a
            // pickup collected on the way opened it.
            if (gates.some((id) => !isObstacleCleared(id, start.inventory, world.obstacleLib))) covered.keyBehindDoor++;
        }
        // The property is only as good as the worlds it ran on.
        expect(covered.repeatedTile).toBeGreaterThan(0);
        expect(covered.gateCrossed).toBeGreaterThan(0);
        expect(covered.keyBehindDoor).toBeGreaterThan(0);
        expect(covered.carriedStart).toBeGreaterThan(0);
    });

    it('lists them in the order of ONE position BFS under everything collectable (the draw reads the order too)', () => {
        let differsFromFirstSeen = 0;
        for (const { i, world, start } of randomCases(9282026, 300)) {
            const { fixpoint, byKey } = _testOnly_reachableTileOrders(world, start);
            expect(fixpoint, `world ${i}`).toEqual(positionBfsUnderEverything(world, start, byKey));
            // …which is NOT the general form's first-seen order in general, so
            // this row says something the set row does not.
            if (JSON.stringify(fixpoint) !== JSON.stringify([...new Set(byKey)])) differsFromFirstSeen++;
        }
        expect(differsFromFirstSeen).toBeGreaterThan(0);
    });

    it('hands a world with blocks or buttons to the general form — a HELD button is not monotone, and the fixpoint would lose the door it holds', () => {
        // Row 0: entrance · button_A · door_A · floor (rows 1–2 wall). Standing
        // on the button holds `sw_A`, which opens the door for the step off it
        // (see `step`).
        const buttons = createWorld(4, 3, {
            entrance: { x: 0, y: 0 }, buttonLib: { button_A: { kind: 'button', holds: 'sw_A' } },
        });
        for (let x = 0; x < 4; x++) for (const y of [1, 2]) setTile(buttons, x, y, TILE_WALL);
        buttons.obstacleLib = { ...DEFAULT_OBSTACLES, door_A: { clear_set_type: 'combo_list', clear_set: [['sw_A']] } };
        setButton(buttons, 1, 0, 'button_A');
        setObstacle(buttons, 2, 0, 'door_A');
        const held = _testOnly_reachableTileOrders(buttons, createState(buttons));
        expect(held.fixpoint).toBeNull();
        expect(held.placer).toEqual(held.byKey);
        expect(held.placer).toContain(2);
        expect(held.placer).toContain(3);
        const blocks = createWorld(4, 3, { entrance: { x: 0, y: 0 } });
        setBlock(blocks, 2, 1);
        const pushed = _testOnly_reachableTileOrders(blocks, createState(blocks));
        expect(pushed.fixpoint).toBeNull();
        expect(pushed.placer).toEqual(pushed.byKey);
    });
});

/** An open room (no walls) holding `u` distinct pickups no gate stands on. */
function openRoomWithPickups(u, width = 8, height = 6) {
    const world = createWorld(width, height, { entrance: { x: Math.floor(width / 2), y: Math.floor(height / 2) } });
    world.obstacleLib = { ...DEFAULT_OBSTACLES };
    for (let i = 0; i < u; i++) setItem(world, i % width, Math.floor(i / width), `pickup_${i}`);
    return world;
}

function countingRng(seed) {
    const rng = createRng(seed);
    let draws = 0;
    return { next: () => { draws++; return rng.next(); }, get draws() { return draws; } };
}

describe('pickReachableFloorTile — one draw, uniform over the reachable tiles', () => {
    it('places pickups where a pick over the ORDER reference would, one rng draw per placement', () => {
        // The reference placer: one draw per placement over the reference list,
        // the candidate test applied per tile.
        const referencePlace = (world, items, rng) => {
            const placed = [];
            for (const item_id of items) {
                const excluded = new Set(placed.map((p) => `${p.position.x},${p.position.y}`));
                const width = world.width;
                // An open room: no gate, so the ORDER reference needs no inventory
                // (and the full-state list it would be read from is 2^u long).
                const candidates = positionBfsUnderEverything(world, createState(world), [])
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
        // Pickups already in the room, so the full-state list repeats tiles and a
        // draw over it would land elsewhere.
        for (const [seed, before] of [[1, 0], [2, 3], [3, 5]]) {
            const subjectRng = countingRng(seed);
            const referenceRng = countingRng(seed);
            const subject = placeFromItems(openRoomWithPickups(before), { items_to_place: items, rng: subjectRng });
            const reference = referencePlace(openRoomWithPickups(before), items, referenceRng);
            expect(subject.placed_items, `seed ${seed}`).toEqual(reference);
            expect(subject.placed_items.length).toBe(items.length);
            expect(subjectRng.draws, `seed ${seed}: draws`).toBe(referenceRng.draws);
            expect(subjectRng.draws, `seed ${seed}: one draw per placement`).toBe(items.length);
        }
    });

    it('places u open-room pickups for under 4·u position BFSs over the finished room — polynomial, where the full-state list costs about 2^u of them', () => {
        // The fixpoint costs (passes ≤ 2 in an open room) × tiles per placement,
        // so u placements sit at a small multiple of u position BFSs (measured at
        // C1: 3.4–8.6 of them for u = 10–14); the full-state list costs
        // Σ 2^k·tiles ≈ 2^u of them (the cliff). The bound — 4·u reference BFSs
        // over `step` — sits between the two orders, far from both (trap 1498;
        // the mutant's measurement is in plan §42.1).
        const u = 12;
        const best = (fn) => {
            let ms = Infinity;
            for (let i = 0; i < 5; i++) {
                const t0 = performance.now();
                fn();
                ms = Math.min(ms, performance.now() - t0);
            }
            return ms;
        };
        const items = Array.from({ length: u }, (_, i) => `loc_item_${i}`);
        const placeMs = best(() => placeFromItems(openRoomWithPickups(0, 16, 16), { items_to_place: items, rng: createRng(1) }));
        // No gate stands in the room, so the reference needs no inventory (and
        // asking the full-state BFS for one here would be the cliff itself).
        const finished = openRoomWithPickups(u, 16, 16);
        const start = createState(finished);
        expect(positionBfsUnderEverything(finished, start, []).length).toBe(finished.width * finished.height);
        const onePositionBfsMs = best(() => positionBfsUnderEverything(finished, start, []));
        expect(placeMs).toBeLessThan(4 * u * onePositionBfsMs);
    });
});

describe('placeGateAndKey — a key never lands on a tile that already holds an item', () => {
    it('keeps every earlier placement over corridor rooms with three key/door pairs — a population where the key\'s draw region held an earlier key', () => {
        // PM0's finding (plan §42): the key's candidates excluded only the
        // entrance and the door, so a later pair's key could be dropped onto an
        // earlier pair's key and `setItem` overwrote it — a location lost.
        const pairs = [['key_red', 'door_red'], ['key_green', 'door_green'], ['key_blue', 'door_blue']];
        let rooms = 0;
        let couldHaveHit = 0;
        for (let seed = 1; seed <= 150; seed++) {
            const width = 6 + (seed % 5);
            const height = 5 + (seed % 4);
            const { world } = generateRegionCore({
                region_id: 'r', size: { width, height }, params: {}, rng: createRng(seed),
                entrances: [{ side: 'W', tile: { x: 0, y: Math.floor(height / 2) } }], exits: [{ side: 'E' }],
            });
            const out = placeFromItems(world, {
                items_to_place: [...pairs.map(([key]) => key), 'coin'],
                obstacles_to_place: pairs.map(([, door]) => door),
                rng: createRng(seed * 7),
            });
            rooms++;
            // Every placement is still standing where it was put.
            for (const { item_id, position } of out.placed_items) {
                expect(world.items.get(`${position.x},${position.y}`), `seed ${seed} ${item_id}`).toBe(item_id);
            }
            // Coverage: rebuild the world as it stood at each pair's key draw
            // (the later pairs and this key not yet placed) and ask whether an
            // earlier key stood in the region the key was drawn from.
            const placedPairs = out.placed_obstacles.map((o) => [o, out.placed_items.find((i) => i.item_id === pairs.find(([, d]) => d === o.obstacle_id)[0])]);
            for (let k = 1; k < placedPairs.length; k++) {
                const then = structuredClone(world);
                for (const [door, key] of placedPairs.slice(k + 1)) {
                    clearObstacle(then, door.position.x, door.position.y);
                    clearItem(then, key.position.x, key.position.y);
                }
                clearItem(then, placedPairs[k][1].position.x, placedPairs[k][1].position.y);
                clearItem(then, ...Object.values(out.placed_items.find((i) => i.item_id === 'coin')?.position ?? { x: -1, y: -1 }));
                const region = new Set(_testOnly_reachableTileOrders(then, createState(then)).placer);
                if (placedPairs.slice(0, k).some(([, key]) => region.has(key.position.y * width + key.position.x))) couldHaveHit++;
            }
        }
        expect(rooms).toBeGreaterThan(0);
        expect(couldHaveHit).toBeGreaterThan(0);
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
                // An exit tile is reached, never passed (the engine's
                // isDeadEndExit) — except the entrance a back exit shares.
                const here = s.player_pos;
                const { entrance } = world;
                if (!(here.x === entrance.x && here.y === entrance.y) && getExitAt(world, here.x, here.y)) return null;
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
