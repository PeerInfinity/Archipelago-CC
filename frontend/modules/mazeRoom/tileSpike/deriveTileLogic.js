/**
 * Q3 search PROTOTYPE (2026-10-21) — AP logic DERIVED from the tile definition (⚖ Q3 "One def;
 * logic by search"; design session tile-primitives-design). Nothing is compiled from
 * the tile scripts: per inventory, a BFS over `scriptedStep` says which targets the player can stand
 * on, and the per-target MINIMAL inventories become an ordinary Or-of-And-of-Has rule.
 *
 * The item axis (⚖ slice design): only the items the region's obstacle rules NAME, minus the
 * tokens its buttons hold (those are derived per step, never carried). Enumerated as a lattice by
 * increasing size; a set that already contains a known-sufficient set for every target is skipped.
 * That pruning is sound because clearance is monotone in the inventory, so the reachable set is.
 *
 * `pickups` (⚖ slice design): `'ap'` holds the inventory fixed — a location tile is a check and
 * grants nothing; `'in-room'` latches what the player walks over, as the standalone level plays.
 *
 * Exit tiles are dead ends (the player leaves the region there), as in the engine's own floods.
 */

import { createState, getExitAt, mazeVisitedKey, INPUTS } from '../mazeRoomEngine.js';
import { MAZE_TILE_LIB, ruleToClearSet, scriptedStep } from './tileStep.js';

/** The region's item axis: every item an obstacle's clear set or rule names, minus held tokens. */
export function regionItems(world) {
    const held = new Set(Object.values(world.buttonLib ?? {}).map((b) => b.holds).filter(Boolean));
    const out = new Set();
    for (const id of new Set(world.obstacles.values())) {
        const entry = world.obstacleLib?.[id];
        if (!entry) continue;
        const sets = (entry.clear_set_type ?? 'combo_list') === 'rule'
            ? ruleToClearSet(entry.clear_rule, id) : (entry.clear_set ?? []);
        for (const combo of sets) for (const item of combo) if (!held.has(item)) out.add(item);
    }
    return [...out].sort();
}

/** The targets a region's logic prices: each location (item tile) and each exit, by position. */
export function regionTargets(world) {
    const out = [];
    for (const [key, item] of world.items) {
        const [x, y] = key.split(',').map(Number);
        out.push({ id: `${item}@${key}`, kind: 'location', item, x, y });
    }
    for (const exit of world.exits.values()) out.push({ id: `exit:${exit.exit_id}`, kind: 'exit', x: exit.x, y: exit.y });
    return out;
}

/**
 * BFS over `scriptedStep` from the entrance holding `inventory`. Returns the cells stood on
 * (`"x,y"` → the state that first stood there, for the witness plan) and the state count.
 */
export function reachUnder(world, inventory, helpers, { pickups = 'ap', tileLib = MAZE_TILE_LIB, cap = 200000 } = {}) {
    const start = createState(world);
    start.inventory = new Set(inventory);
    const seen = new Map([[mazeVisitedKey(start), null]]);
    const cells = new Map([[`${start.player_pos.x},${start.player_pos.y}`, mazeVisitedKey(start)]]);
    const states = new Map([[mazeVisitedKey(start), start]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        const at = s.player_pos;
        if (head > 0 && getExitAt(world, at.x, at.y) !== null) continue;
        const from = mazeVisitedKey(s);
        for (const input of INPUTS) {
            const { next } = scriptedStep(world, s, input, helpers, tileLib, { latch: pickups === 'in-room' });
            if (next === null) continue;
            const k = mazeVisitedKey(next);
            if (seen.has(k)) continue;
            seen.set(k, { from, input });
            states.set(k, next);
            queue.push(next);
            const cell = `${next.player_pos.x},${next.player_pos.y}`;
            if (!cells.has(cell)) cells.set(cell, k);
        }
        if (seen.size > cap) throw new Error(`tile logic: search over ${[...inventory]} exceeded ${cap} states`);
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

/**
 * Per-target minimal inventories, by lattice. `{ items, targets: [{...target, minimal: [[item…]…],
 * witness: {inventory, plan}[]}], searched, skipped, states }`. `maxItems` refuses BY NAME rather
 * than enumerating a huge lattice.
 */
export function deriveRegionLogic(world, helpers, { pickups = 'ap', tileLib = MAZE_TILE_LIB, maxItems = 12 } = {}) {
    const items = regionItems(world);
    if (items.length > maxItems) {
        throw new Error(`tile logic: ${items.length} region items exceed the lattice cap ${maxItems}: ${items.join(', ')}`);
    }
    // ⛓ Monotone ⇒ a target the FULL inventory does not reach is False_ at every set; it drops out
    // of the covering test, or it would keep every set of the lattice alive.
    const full = reachUnder(world, items, helpers, { pickups, tileLib });
    const targets = regionTargets(world).map((t) => ({
        ...t, minimal: [], witnesses: [], unreachable: !full.cells.has(`${t.x},${t.y}`),
    }));
    const live = targets.filter((t) => !t.unreachable);
    const covered = (t, set) => t.minimal.some((m) => m.every((i) => set.includes(i)));
    let searched = 1;
    let skipped = 0;
    let states = full.states;
    for (let k = 0; k <= items.length; k++) {
        for (const set of subsetsOfSize(items, k)) {
            if (live.every((t) => covered(t, set))) { skipped += 1; continue; }
            const reach = reachUnder(world, set, helpers, { pickups, tileLib });
            searched += 1;
            states += reach.states;
            for (const t of live) {
                const cell = `${t.x},${t.y}`;
                if (covered(t, set) || !reach.cells.has(cell)) continue;
                t.minimal.push(set);
                t.witnesses.push({ inventory: set, plan: reach.planTo(cell) });
            }
        }
    }
    return { items, targets, searched, skipped, states };
}

/** Minimal sets → a Rule Builder rule in `compileRegion`'s spelling. */
export function ruleFromMinimalSets(minimal) {
    const has = (item) => ({ rule: 'Has', args: { item_name: item } });
    if (minimal.length === 0) return { rule: 'False_' };
    const terms = minimal.map((set) => {
        if (set.length === 0) return { rule: 'True_' };
        return set.length === 1 ? has(set[0]) : { rule: 'And', children: set.map(has) };
    });
    if (terms.some((t) => t.rule === 'True_')) return { rule: 'True_' };
    return terms.length === 1 ? terms[0] : { rule: 'Or', children: terms };
}
