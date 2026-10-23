/**
 * Q3 search PROTOTYPE (2026-10-21) — AP logic DERIVED from the tile definition (⚖ Q3 "One def;
 * logic by search"; design session tile-primitives-design, slice tile-primitives-q3-search). Nothing is compiled from
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
 *
 * ITEM ACTIONS (slice tile-primitives-item-actions): on a world with an `action_lib` the search's
 * state is the engine's (facing + per-visit `broken`), its inputs gain the four turns and the uses
 * of HELD items, and the item axis gains every action item whose action strikes an obstacle of the
 * region (a `struck_by` rock names no item in its clear set). Still monotone: more items, more uses.
 *
 * ARROW TRAPS + ROPES (slice tile-primitives-arrow-rope): a rope's EVENT joins the item axis (carried, it
 * silences the lane on a later visit) and is a TARGET of its own — reached when some state has the rope
 * cut (`cuts`), not when the player stands on its cell. An arrival standing in an armed lane reaches
 * NOTHING (⚖ never expect tanking a hit). Still monotone: an item only ever silences or opens.
 */

import {
    createState, getExitAt, getObstacle, mazeVisitedKey, hasItemActions, worldInputs, USE_PREFIX, TURN_PREFIX, INPUTS, turnInput,
} from '../mazeRoomEngine.js';
import { MAZE_TILE_LIB, ruleToClearSet, scriptedStep, scriptedStandsInArmedLane } from './tileStep.js';

/**
 * The rope obstacles that are AP events: `[{key, x, y, event}]` (their `event` named, the cut latches it) —
 * ONE per rope obstacle id, keyed at its canonical cell (`at`, where a strike on any run cell is recorded;
 * rules-l39, ⚖ "(a) One obstacle"), else at its own cell.
 */
export function ropeEvents(world) {
    const out = [];
    const seen = new Set();
    for (const [cell, id] of world.obstacles) {
        const entry = world.obstacleLib?.[id];
        if (!entry?.activates || !entry.event || seen.has(id)) continue;
        seen.add(id);
        const key = entry.at ?? cell;
        const [x, y] = key.split(',').map(Number);
        out.push({ key, x, y, event: entry.event });
    }
    return out;
}

/** Per reached state: the rope events it has cut (`cuts`: rope posKey → the first visited key that cut it). */
function noteCuts(world, ropes, cuts, state, key) {
    if (ropes.length === 0 || !state.broken) return;
    for (const r of ropes) if (!cuts.has(r.key) && state.broken.includes(r.key)) cuts.set(r.key, key);
}

/** The reach of an arrival that stands in an armed lane: nothing (no cell, no cut). */
export const NOTHING_REACHED = Object.freeze({ cells: new Map(), cuts: new Map(), states: 1, planTo: () => null, planToCut: () => null });

/**
 * The region's item axis: every item an obstacle's clear set or rule names, plus every rope's event,
 * minus the tokens buttons hold and ropes activate (derived per step, never carried).
 */
export function regionItems(world) {
    const held = new Set(Object.values(world.buttonLib ?? {}).map((b) => b.holds).filter(Boolean));
    for (const entry of Object.values(world.obstacleLib ?? {})) if (entry?.activates) held.add(entry.activates);
    for (const r of ropeEvents(world)) held.delete(r.event);
    const out = new Set();
    for (const id of new Set(world.obstacles.values())) {
        const entry = world.obstacleLib?.[id];
        if (!entry) continue;
        const sets = (entry.clear_set_type ?? 'combo_list') === 'rule'
            ? ruleToClearSet(entry.clear_rule, id) : (entry.clear_set ?? []);
        for (const combo of sets) for (const item of combo) if (!held.has(item)) out.add(item);
        for (const actionId of entry.struck_by ?? []) {
            const item = world.actionLib?.[actionId]?.item;
            if (item && !held.has(item)) out.add(item);
        }
        if (entry.activates && entry.event) out.add(entry.event);
    }
    return [...out].sort();
}

/**
 * The search's input set: `worldInputs` (moves; turns + uses on an item-action world), minus — in
 * `'ap'` mode, where the inventory is fixed — the uses of items the inventory does not hold (they
 * are refusals at every state, so the search never needs to try them).
 */
export function searchInputs(world, inventory, pickups) {
    const all = worldInputs(world);
    if (!hasItemActions(world) || pickups !== 'ap') return all;
    const have = new Set(inventory);
    return all.filter((input) => {
        if (!input.startsWith(USE_PREFIX)) return true;
        const item = world.actionLib[input.slice(USE_PREFIX.length)]?.item;
        return !item || have.has(item);
    });
}

/**
 * ⛓ FACING-FREE SEARCH (slice tile-primitives-arrow-rope). A turn is always legal and changes nothing but
 * `facing`, so two states that differ only in facing reach exactly the same cells and cuts: a search keys
 * its states WITHOUT facing (`reachKey`) and branches on the four moves plus, per use, the macro
 * `[TURN_<d>, USE:<id>]` for each direction (`reachInputs`) — the witness plan is still a sequence of
 * engine inputs.
 */
export function reachKey(state) {
    return state.facing === undefined ? mazeVisitedKey(state) : mazeVisitedKey({ ...state, facing: '' });
}

const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
/** Does the cell a `TURN_<d>` faces from `at` hold an obstacle (what a use there could break)? */
function obstacleToward(world, at, turn) {
    const [dx, dy] = DIRS[turn.slice(TURN_PREFIX.length)];
    return Boolean(getObstacle(world, at.x + dx, at.y + dy));
}

/** A search's branches: the moves, and each use input as `[TURN_<d>, use]` for the four directions. */
export function reachInputs(inputs) {
    const out = [];
    for (const input of inputs) {
        if (input.startsWith(USE_PREFIX)) for (const d of INPUTS) out.push([turnInput(d), input]);
        else if (!input.startsWith('TURN_')) out.push([input]);
    }
    return out;
}

/**
 * The targets a region's logic prices: each location (item tile), each rope EVENT (`event` set: reached
 * by cutting the rope at x, y) and each exit, by position.
 */
export function regionTargets(world) {
    const out = [];
    for (const [key, item] of world.items) {
        const [x, y] = key.split(',').map(Number);
        out.push({ id: `${item}@${key}`, kind: 'location', item, x, y });
    }
    for (const r of ropeEvents(world)) {
        out.push({ id: `event:${r.event}@${r.key}`, kind: 'location', event: r.event, locationName: r.event, x: r.x, y: r.y });
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
    if (scriptedStandsInArmedLane(world, start, helpers, tileLib)) return NOTHING_REACHED;
    const ropes = ropeEvents(world);
    const cuts = new Map();
    const seen = new Map([[reachKey(start), null]]);
    const cells = new Map([[`${start.player_pos.x},${start.player_pos.y}`, reachKey(start)]]);
    const queue = [start];
    const inputs = reachInputs(searchInputs(world, inventory, pickups));
    const latch = pickups === 'in-room';
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        const at = s.player_pos;
        if (head > 0 && getExitAt(world, at.x, at.y) !== null) continue;
        const from = reachKey(s);
        for (const macro of inputs) {
            // A use at a cell holding no obstacle breaks nothing — it only turns: the same facing-free state.
            if (macro.length === 2 && !obstacleToward(world, at, macro[0])) continue;
            let next = s;
            for (const input of macro) {
                next = scriptedStep(world, next, input, helpers, tileLib, { latch }).next;
                if (next === null) break;
            }
            if (next === null) continue;
            const k = reachKey(next);
            if (seen.has(k)) continue;
            seen.set(k, { from, input: macro });
            queue.push(next);
            noteCuts(world, ropes, cuts, next, k);
            const cell = `${next.player_pos.x},${next.player_pos.y}`;
            if (!cells.has(cell)) cells.set(cell, k);
        }
        if (seen.size > cap) throw new Error(`tile logic: search over ${[...inventory]} exceeded ${cap} states`);
    }
    const planFrom = (k) => {
        if (k === undefined) return null;
        const plan = [];
        for (let link = seen.get(k); link !== null; link = seen.get(k)) { plan.push(link.input); k = link.from; }
        return plan.reverse().flat();
    };
    return {
        cells, cuts, states: seen.size, planTo: (cell) => planFrom(cells.get(cell)), planToCut: (key) => planFrom(cuts.get(key)),
    };
}

/** Did `reach` get to target `t`: a rope event by its cut, anything else by standing on its cell. */
export function reachedTarget(reach, t) {
    return t.event ? reach.cuts.has(`${t.x},${t.y}`) : reach.cells.has(`${t.x},${t.y}`);
}

/** The witness plan to target `t` in `reach`. */
export function planToTarget(reach, t) {
    return t.event ? reach.planToCut(`${t.x},${t.y}`) : reach.planTo(`${t.x},${t.y}`);
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
        ...t, minimal: [], witnesses: [], unreachable: !reachedTarget(full, t),
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
                if (covered(t, set) || !reachedTarget(reach, t)) continue;
                t.minimal.push(set);
                t.witnesses.push({ inventory: set, plan: planToTarget(reach, t) });
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
