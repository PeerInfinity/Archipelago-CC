/**
 * The Q3 search over a SHARED LEVEL WORLD (tile-primitives Stage 2, session tile-primitives-stage2-l15):
 * AP logic per OWNING sub-region, as a CERTIFIER (⚖ user, 2026-10-21: "Certifier" — the preset's rules
 * stay the atlas's; this derives them from the played world and the tests hold the two equal).
 *
 * A level world carries every sub-region of one level in one maze world (`world.sharedWorld`: which AP
 * region owns which cell). The rule for the AP exit `from → to` is the set of inventories with which a
 * player who ARRIVES in `from` (its `shared_world.entrances` cell, the level freshly entered: blocks
 * home, nothing broken) can stand on ANY cell `to` owns. Searched exactly like `deriveRegionLogic`: the
 * item axis is `regionItems` (rule items + the items of actions that strike an obstacle), enumerated as a
 * lattice by increasing size with superset pruning; each inventory a BFS over `scriptedStep` in `'ap'`
 * mode (`native: true` walks the engine's own `step` instead — the same answer, ~10× faster). Boundary
 * exit tiles stay dead ends.
 */

import { regionItems, reachUnder } from './deriveTileLogic.js';
import { MAZE_TILE_LIB } from './tileStep.js';
import {
    createState, step, getExitAt, mazeVisitedKey, worldInputs, sharedWorldOwnerAt, USE_PREFIX,
} from '../mazeRoomEngine.js';

/**
 * `reachUnder`'s answer from the NATIVE engine `step` (⚖ Q6 "native default"; the item-actions parity
 * suite holds the scripted step ≡ the native one). `'ap'` mode: the inventory is fixed and a location tile
 * grants nothing, so the walk runs on the world without its item overlay.
 */
export function nativeReachUnder(world, inventory, { cap = 400000 } = {}) {
    const w = { ...world, items: new Map() };
    const start = createState(w);
    start.inventory = new Set(inventory);
    const have = start.inventory;
    const inputs = worldInputs(w).filter((input) => {
        if (!input.startsWith(USE_PREFIX)) return true;
        const item = w.actionLib[input.slice(USE_PREFIX.length)]?.item;
        return !item || have.has(item);
    });
    const seen = new Map([[mazeVisitedKey(start), null]]);
    const cells = new Map([[`${start.player_pos.x},${start.player_pos.y}`, mazeVisitedKey(start)]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        if (head > 0 && getExitAt(w, s.player_pos.x, s.player_pos.y) !== null) continue;
        const from = mazeVisitedKey(s);
        for (const input of inputs) {
            const next = step(w, s, input);
            if (next === null) continue;
            const k = mazeVisitedKey(next);
            if (seen.has(k)) continue;
            seen.set(k, { from, input });
            queue.push(next);
            const cell = `${next.player_pos.x},${next.player_pos.y}`;
            if (!cells.has(cell)) cells.set(cell, k);
        }
        if (seen.size > cap) throw new Error(`level-world logic: native search over ${[...inventory]} exceeded ${cap} states`);
    }
    const planTo = (cell) => {
        let k = cells.get(cell);
        if (k === undefined) return null;
        const plan = [];
        for (let link = seen.get(k); link !== null; link = seen.get(k)) { plan.push(link.input); k = link.from; }
        return plan.reverse();
    };
    return { cells, states: seen.size, planTo };
}

function* subsetsOfSize(items, k, from = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = from; i <= items.length - (k - acc.length); i++) {
        acc.push(items[i]);
        yield* subsetsOfSize(items, k, i + 1, acc);
        acc.pop();
    }
}

/** The same world, entered at `region`'s arrival cell. */
export function enteredAt(world, region) {
    const at = world.sharedWorld?.entrances?.[region];
    if (!at) throw new Error(`level-world logic: no entrance for "${region}" in this shared world`);
    return { ...world, entrance: { x: at.x, y: at.y } };
}

/**
 * Per-(from, to) minimal inventories over a shared level world.
 *
 * @returns {{ items: string[], pairs: Array<{from, to, minimal: string[][], witnesses: Array<{inventory,
 *   plan, cell}>, unreachable: boolean}>, searched: number, states: number }}
 */
export function deriveLevelWorldLogic(world, helpers, { tileLib = MAZE_TILE_LIB, maxItems = 12, native = false } = {}) {
    const sw = world.sharedWorld;
    if (!sw) throw new Error('level-world logic: the world is not a shared level world');
    const items = regionItems(world);
    if (items.length > maxItems) {
        throw new Error(`level-world logic: ${items.length} items exceed the lattice cap ${maxItems}: ${items.join(', ')}`);
    }
    const owned = (cells, to) => {
        for (const cell of cells.keys()) {
            const [x, y] = cell.split(',').map(Number);
            if (sharedWorldOwnerAt(world, x, y) === to) return cell;
        }
        return null;
    };
    const pairs = [];
    let searched = 0;
    let states = 0;
    for (const from of sw.regions) {
        const entered = enteredAt(world, from);
        const reachOf = (set) => (native ? nativeReachUnder(entered, set)
            : reachUnder(entered, set, helpers, { pickups: 'ap', tileLib }));
        const full = reachOf(items);
        searched += 1;
        states += full.states;
        const live = sw.regions.filter((to) => to !== from).map((to) => ({
            from, to, minimal: [], witnesses: [], unreachable: owned(full.cells, to) === null,
        }));
        pairs.push(...live);
        const open = live.filter((p) => !p.unreachable);
        const covered = (p, set) => p.minimal.some((m) => m.every((i) => set.includes(i)));
        for (let k = 0; k <= items.length; k++) {
            for (const set of subsetsOfSize(items, k)) {
                if (open.every((p) => covered(p, set))) continue;
                const reach = reachOf(set);
                searched += 1;
                states += reach.states;
                for (const p of open) {
                    if (covered(p, set)) continue;
                    const cell = owned(reach.cells, p.to);
                    if (cell === null) continue;
                    p.minimal.push(set);
                    p.witnesses.push({ inventory: set, plan: reach.planTo(cell), cell });
                }
            }
        }
    }
    return { items, pairs, searched, states };
}
