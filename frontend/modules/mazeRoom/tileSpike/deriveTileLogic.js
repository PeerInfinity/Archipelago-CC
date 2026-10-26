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
    actionItems, actionUsable, blockWithinReach,
} from '../mazeRoomEngine.js';
import { MAZE_TILE_LIB, ruleToClearSet, scriptedStep, scriptedStandsInArmedLane } from './tileStep.js';
import { isObstacleCleared } from '../../shared/procgen/library.js';

/* ── COUNTED ITEMS (session tile-primitives-counted-rules, ⚖ 2026-10-23) ─────────────────────────────────────────
 * ⚖ "Count map": a lattice POINT is a sorted list of item names in which an item held n times appears n times
 * (`['Progressive Shield', 'Progressive Shield', 'Wand']`); `inventoryOf` turns it into the engine's inventory — a Set
 * when nothing repeats (byte-for-byte the old search), else a `Map<item, count>`.
 * ⚖ "Threshold levels": an item's axis is {0, 1} ∪ the counts the region's rules NAME (Shield 0,1,2; Seal 0,1,16), not
 * 0..max — the answers only change at a named count. Points are enumerated by increasing RANK (the sum of the level
 * indices; for an all-binary axis, exactly the old subsets by size, in the old order), and a point covering a known
 * minimal one on every item is skipped: clearance is monotone in every count, so the reachable set is.
 */

/** A point's inventory: a Set when every item is held once, else a count Map. */
export function inventoryOf(point) {
    const counts = new Map();
    for (const item of point) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts.size === point.length ? new Set(point) : counts;
}

/** How many of each item a point holds. */
export function pointCounts(point) {
    const counts = new Map();
    for (const item of point) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
}

/** Does `point` hold at least what `minimal` does, item by item (multiset inclusion)? */
export function pointCovers(point, minimal) {
    const have = pointCounts(point);
    for (const [item, n] of pointCounts(minimal)) if ((have.get(item) ?? 0) < n) return false;
    return true;
}

/** A point for display: `Seal×16` rather than sixteen names. */
export function formatPoint(point) {
    return [...pointCounts(point)].map(([item, n]) => (n > 1 ? `${item}×${n}` : item)).join(',');
}

/** The counts a rule's `Has` nodes name, merged into `out` (item → Set of counts). */
export function ruleLevels(rule, out = new Map()) {
    if (rule?.rule === 'Has') {
        const item = rule.args.item_name;
        if (!out.has(item)) out.set(item, new Set());
        out.get(item).add(rule.args.count ?? 1);
    }
    for (const c of rule?.children ?? []) ruleLevels(c, out);
    return out;
}

/**
 * The lattice axis for `items`: `[{item, levels: [n…] ascending}]` — ALWAYS level 1, plus every count `levels` names.
 * ⛔ Level 1 is never dropped (designer-2 review of 970fb3c827): an implicit "at least one" — a strike's item, a
 * combo_list item, a scripted `state.has`, an event — names no count, so an item whose only NAMED count is n ≥ 2
 * would otherwise be tested at 0 and n only: the search over-charged a struck rock (Sword×2), and the certifier never
 * saw a world that crosses with ONE where the AP rule says two (a LOOSER row).
 */
export function latticeAxis(items, levels = new Map()) {
    return [...items].sort().map((item) => ({ item, levels: [...new Set([1, ...(levels.get(item) ?? [])])].sort((a, b) => a - b) }));
}

/** The axis's top point: every item at its highest level. */
export function fullPoint(axis) {
    return axis.flatMap(({ item, levels }) => Array(levels[levels.length - 1]).fill(item));
}

function* pointsOfRank(axis, k, from = 0, acc = []) {
    if (k === 0) { yield acc.slice(); return; }
    for (let i = from; i < axis.length; i++) {
        const { item, levels } = axis[i];
        for (let j = 1; j <= Math.min(k, levels.length); j++) {
            const n = levels[j - 1];
            for (let c = 0; c < n; c++) acc.push(item);
            yield* pointsOfRank(axis, k - j, i + 1, acc);
            acc.length -= n;
        }
    }
}

/** Every point of the axis by increasing rank (see above). */
export function* latticePoints(axis) {
    const top = axis.reduce((sum, a) => sum + a.levels.length, 0);
    for (let k = 0; k <= top; k++) yield* pointsOfRank(axis, k);
}

/** Every point of the axis in MASK order (item 0 the fastest digit) — for an all-binary axis, the old `subsets` order. */
export function* allPoints(axis) {
    const digit = axis.map(() => 0);
    for (;;) {
        yield axis.flatMap(({ item, levels }, i) => (digit[i] === 0 ? [] : Array(levels[digit[i] - 1]).fill(item)));
        let i = 0;
        while (i < axis.length && digit[i] === axis[i].levels.length) digit[i++] = 0;
        if (i === axis.length) return;
        digit[i] += 1;
    }
}

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

/**
 * ⛓ EVENTS AS LOCATIONS (session tile-primitives-events-as-locations) — every STRUCK obstacle that is an AP event:
 * the ropes (`ropeEvents`) and the rocks the projection bound an event to (`bindWorldEvents`: `events` + `struck_by`),
 * `[{key, x, y, event, side?}]`, keyed at the obstacle's canonical cell. Reached by its CUT, as a rope's.
 */
export function cutEvents(world) {
    const out = ropeEvents(world);
    const seen = new Set();
    for (const [cell, id] of world.obstacles) {
        const entry = world.obstacleLib?.[id];
        if (!entry?.events || !entry.struck_by || seen.has(id)) continue;
        seen.add(id);
        const key = entry.at ?? cell;
        const [x, y] = key.split(',').map(Number);
        for (const ev of entry.events) out.push({ key, x, y, event: ev.name, side: ev.side });
    }
    return out;
}

/**
 * ⛓ EVENTS AS LOCATIONS — every event bound to a NON-struck obstacle (a gated cell, a latched lock):
 * `[{event, side, cells: ["x,y"…]}]`. The game opens such an obstacle from beside it (a burn, a wand shot, a key
 * line), so its event is reached when the player stands on a cell 4-adjacent to one of `cells` while that cell's
 * obstacle is CLEARED for the inventory (`eventAdjacentCell`) — never with the event itself in hand. An event that
 * shares its cell with another names its own `rule` (session tile-primitives-sphere-order-2), which it opens by.
 */
export function gateEvents(world) {
    const byEvent = new Map();
    for (const [cell, id] of world.obstacles) {
        const entry = world.obstacleLib?.[id];
        if (!entry?.events || entry.struck_by) continue;
        for (const ev of entry.events) {
            if (!byEvent.has(ev.name)) {
                byEvent.set(ev.name, { event: ev.name, side: ev.side, cells: [], ...(ev.rule ? { rule: ev.rule } : {}), ...(ev.probe ? { probe: ev.probe } : {}) });
            }
            byEvent.get(ev.name).cells.push(cell);
        }
    }
    for (const g of byEvent.values()) g.cells.sort();
    return [...byEvent.values()];
}

/** The neighbour a one-sided lock is opened from, by its `probe` side. */
const PROBE_STEP = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });

/**
 * The reached cell beside gate event `t` from which its obstacle opens for `set` (`gateEvents`), or `null`. A one-sided
 * lock (`probe`, session tile-primitives-sphere-order-2: `BossLock.update` tests the key on a line just BELOW the lock)
 * opens from that neighbour only.
 */
export function eventAdjacentCell(world, reach, t, set) {
    const inv = inventoryOf(set);
    if (inv.has(t.event)) return null;
    const own = new Set(t.cells);
    // An event that names its own `rule` (one of several on a stacked cell) opens by it, not by the cell's.
    const ownLib = t.rule ? { own: { clear_set_type: 'rule', clear_rule: t.rule } } : null;
    for (const cell of t.cells) {
        if (!(ownLib ? isObstacleCleared('own', inv, ownLib) : isObstacleCleared(world.obstacles.get(cell), inv, world.obstacleLib))) continue;
        const [x, y] = cell.split(',').map(Number);
        for (const [dx, dy] of t.probe ? [PROBE_STEP[t.probe]] : [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const n = `${x + dx},${y + dy}`;
            if (!own.has(n) && reach.cells.has(n)) return n;
        }
    }
    return null;
}

/** Per reached state: the rope events it has cut (`cuts`: rope posKey → the first visited key that cut it). */
function noteCuts(world, ropes, cuts, state, key) {
    if (ropes.length === 0 || !state.broken) return;
    for (const r of ropes) if (!cuts.has(r.key) && state.broken.includes(r.key)) cuts.set(r.key, key);
}

/** The reach of an arrival that stands in an armed lane: nothing (no cell, no cut). */
export const NOTHING_REACHED = Object.freeze({ cells: new Map(), cuts: new Map(), states: 1, planTo: () => null, planToCut: () => null });

/** The obstacle-lib ids a world gates on: its placed obstacles' and its ENTRY GATES' (a null entry gate names none). */
const gateIds = (world) => new Set([...world.obstacles.values(), ...[...(world.entryGates?.values() ?? [])].filter((g) => g !== null)]);

/**
 * The region's item axis: every item an obstacle's (or an entry gate's) clear set or rule names, plus every rope's
 * event, minus the tokens buttons hold and ropes activate (derived per step, never carried).
 */
export function regionItems(world) {
    const held = new Set(Object.values(world.buttonLib ?? {}).map((b) => b.holds).filter(Boolean));
    for (const entry of Object.values(world.obstacleLib ?? {})) if (entry?.activates) held.add(entry.activates);
    for (const r of ropeEvents(world)) held.delete(r.event);
    const out = new Set();
    for (const id of gateIds(world)) {
        const entry = world.obstacleLib?.[id];
        if (!entry) continue;
        const sets = (entry.clear_set_type ?? 'combo_list') === 'rule'
            ? ruleToClearSet(entry.clear_rule, id) : (entry.clear_set ?? []);
        for (const combo of sets) for (const pair of combo) {
            const item = Array.isArray(pair) ? pair[0] : pair;
            if (!held.has(item)) out.add(item);
        }
        for (const actionId of entry.struck_by ?? []) {
            for (const item of actionItems(world.actionLib?.[actionId])) if (!held.has(item)) out.add(item);
        }
        if (entry.activates && entry.event) out.add(entry.event);
        for (const ev of entry.events ?? []) out.add(ev.name);
    }
    // ⛓ STRUCK BLOCKS: the items of the actions that move the world's blocks.
    if (world.blocks?.size > 0) {
        for (const actionId of world.blockStrike?.struckBy ?? []) {
            for (const item of actionItems(world.actionLib?.[actionId])) if (!held.has(item)) out.add(item);
        }
    }
    return [...out].sort();
}

/**
 * ⛓ COUNTED ITEMS — the counts the region's obstacle rules name, per item of `regionItems` (item → Set of counts);
 * an item no rule counts above 1 is absent (binary).
 */
export function regionLevels(world) {
    const out = new Map();
    for (const id of gateIds(world)) {
        const entry = world.obstacleLib?.[id];
        if ((entry?.clear_set_type ?? 'combo_list') === 'rule') ruleLevels(entry.clear_rule, out);
    }
    for (const [item, ns] of [...out]) if (ns.size === 1 && ns.has(1)) out.delete(item);
    return out;
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
        return actionUsable(world.actionLib[input.slice(USE_PREFIX.length)], have);
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
/**
 * Does the cell a `TURN_<d>` faces from `at` hold an obstacle (what a use there could break)? — or, on a STRUCK-BLOCK
 * world, does a block stand within its `reach` that way (what a use there could move)?
 */
function obstacleToward(world, state, macro) {
    const at = state.player_pos;
    const [dx, dy] = DIRS[macro[0].slice(TURN_PREFIX.length)];
    if (getObstacle(world, at.x + dx, at.y + dy)) return true;
    return blockWithinReach(world, { ...state, facing: macro[0].slice(TURN_PREFIX.length) }, macro[1].slice(USE_PREFIX.length));
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
    for (const r of cutEvents(world)) {
        out.push({
            id: `event:${r.event}@${r.key}`, kind: 'location', event: r.event, locationName: r.event, x: r.x, y: r.y,
            ...(r.side ? { side: r.side } : {}),
        });
    }
    for (const g of gateEvents(world)) {
        const [x, y] = g.cells[0].split(',').map(Number);
        out.push({
            id: `event:${g.event}@${g.cells[0]}`, kind: 'location', event: g.event, locationName: g.event, x, y,
            side: g.side, adjacent: true, cells: g.cells, ...(g.rule ? { rule: g.rule } : {}), ...(g.probe ? { probe: g.probe } : {}),
        });
    }
    for (const exit of world.exits.values()) out.push({ id: `exit:${exit.exit_id}`, kind: 'exit', x: exit.x, y: exit.y });
    return out;
}

/**
 * A search's next state, marked `walkedOn` when a MOVE put it on an exit tile: every exit tile ends a walk. ⛓ Only
 * a move does (session tile-primitives-water-exits): an arrival ON its exit tile that turns and strikes has not taken
 * the exit — L0 r11c19 lands on its exit facing the event rock at (18,11), and the search had ended at the strike.
 */
export function endsWalk(world, from, next) {
    const { x, y } = next.player_pos;
    if (x === from.player_pos.x && y === from.player_pos.y) return next;
    return getExitAt(world, x, y) === null ? next : { ...next, walkedOn: true };
}

/**
 * BFS over `scriptedStep` from the entrance holding `inventory`. Returns the cells stood on
 * (`"x,y"` → the state that first stood there, for the witness plan) and the state count.
 */
export function reachUnder(world, inventory, helpers, { pickups = 'ap', tileLib = MAZE_TILE_LIB, cap = 200000 } = {}) {
    const start = createState(world);
    start.inventory = inventoryOf(inventory);
    if (scriptedStandsInArmedLane(world, start, helpers, tileLib)) return NOTHING_REACHED;
    const ropes = cutEvents(world);
    const cuts = new Map();
    const seen = new Map([[reachKey(start), null]]);
    const cells = new Map([[`${start.player_pos.x},${start.player_pos.y}`, reachKey(start)]]);
    const queue = [start];
    const inputs = reachInputs(searchInputs(world, inventory, pickups));
    const latch = pickups === 'in-room';
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        if (s.walkedOn) continue;
        const from = reachKey(s);
        for (const macro of inputs) {
            // A use at a cell holding no obstacle (and no block in reach) changes nothing — it only turns: the same facing-free state.
            if (macro.length === 2 && !obstacleToward(world, s, macro)) continue;
            let next = s;
            for (const input of macro) {
                next = scriptedStep(world, next, input, helpers, tileLib, { latch }).next;
                if (next === null) break;
            }
            if (next === null) continue;
            const k = reachKey(next);
            if (seen.has(k)) continue;
            seen.set(k, { from, input: macro });
            queue.push(endsWalk(world, s, next));
            noteCuts(world, ropes, cuts, next, k);
            const cell = `${next.player_pos.x},${next.player_pos.y}`;
            if (!cells.has(cell)) cells.set(cell, k);
        }
        if (seen.size > cap) throw new Error(`tile logic: search over ${formatPoint(inventory)} exceeded ${cap} states`);
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

/**
 * Did `reach` (holding `set`) get to target `t`: a struck event by its cut, a gate event from beside its obstacle
 * (`eventAdjacentCell`, which needs `world` and `set`), anything else by standing on its cell. An event is never
 * reached holding its own item.
 */
export function reachedTarget(reach, t, set = null, world = null) {
    if (t.event && set?.includes(t.event)) return false;
    if (t.adjacent) return eventAdjacentCell(world, reach, t, set ?? []) !== null;
    return t.event ? reach.cuts.has(`${t.x},${t.y}`) : reach.cells.has(`${t.x},${t.y}`);
}

/** The cell a witness to target `t` ends on (a gate event's: the cell beside it; else `t`'s own). */
export function targetCell(reach, t, set = null, world = null) {
    return t.adjacent ? eventAdjacentCell(world, reach, t, set ?? []) : `${t.x},${t.y}`;
}

/** The witness plan to target `t` in `reach` (holding `set`). */
export function planToTarget(reach, t, set = null, world = null) {
    if (t.adjacent) return reach.planTo(eventAdjacentCell(world, reach, t, set ?? []));
    return t.event ? reach.planToCut(`${t.x},${t.y}`) : reach.planTo(`${t.x},${t.y}`);
}

/**
 * Per-target minimal inventories, by lattice. `{ items, levels, targets: [{...target, minimal: [[item…]…],
 * witness: {inventory, plan}[]}], searched, skipped, states }` (a minimal set is a POINT: a counted item repeats).
 * `maxItems` refuses BY NAME rather than enumerating a huge lattice.
 */
export function deriveRegionLogic(world, helpers, { pickups = 'ap', tileLib = MAZE_TILE_LIB, maxItems = 12 } = {}) {
    const items = regionItems(world);
    if (items.length > maxItems) {
        throw new Error(`tile logic: ${items.length} region items exceed the lattice cap ${maxItems}: ${items.join(', ')}`);
    }
    // ⛓ Monotone ⇒ a target the FULL inventory does not reach is False_ at every set; it drops out
    // of the covering test, or it would keep every set of the lattice alive.
    const levels = regionLevels(world);
    const axis = latticeAxis(items, levels);
    const top = fullPoint(axis);
    const full = reachUnder(world, top, helpers, { pickups, tileLib });
    const targets = regionTargets(world).map((t) => ({
        ...t, minimal: [], witnesses: [], unreachable: !reachedTarget(full, t, top.filter((i) => i !== t.event), world),
    }));
    const live = targets.filter((t) => !t.unreachable);
    const covered = (t, set) => t.minimal.some((m) => pointCovers(set, m));
    let searched = 1;
    let skipped = 0;
    let states = full.states;
    for (const set of latticePoints(axis)) {
        if (live.every((t) => covered(t, set))) { skipped += 1; continue; }
        const reach = reachUnder(world, set, helpers, { pickups, tileLib });
        searched += 1;
        states += reach.states;
        for (const t of live) {
            if (covered(t, set) || !reachedTarget(reach, t, set, world)) continue;
            t.minimal.push(set);
            t.witnesses.push({ inventory: set, plan: planToTarget(reach, t, set, world) });
        }
    }
    return { items, levels, targets, searched, skipped, states };
}

/**
 * Minimal sets → a Rule Builder rule in `compileRegion`'s spelling. ⚖ "Has count ≥2 only" (session
 * tile-primitives-counted-rules): an item a minimal point holds n ≥ 2 times is `Has(item, count n)`; `count` is
 * written only then, so an uncounted rule is the old spelling byte for byte.
 */
export function ruleFromMinimalSets(minimal) {
    const has = ([item, n]) => ({ rule: 'Has', args: n > 1 ? { item_name: item, count: n } : { item_name: item } });
    if (minimal.length === 0) return { rule: 'False_' };
    const terms = minimal.map((set) => {
        const need = [...pointCounts(set)];
        if (need.length === 0) return { rule: 'True_' };
        return need.length === 1 ? has(need[0]) : { rule: 'And', children: need.map(has) };
    });
    if (terms.some((t) => t.rule === 'True_')) return { rule: 'True_' };
    return terms.length === 1 ? terms[0] : { rule: 'Or', children: terms };
}
