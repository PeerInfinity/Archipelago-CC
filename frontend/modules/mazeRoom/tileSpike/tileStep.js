/**
 * Tile-primitives SPIKE (2026-10-21) — the maze's push + button behaviour re-expressed as
 * ENGINE PRIMITIVES configured by a `tile_lib`, with helper scripts for the CONDITIONS only
 * (⚖ Q2 iii; design session tile-primitives-design, slice tile-primitives-spike). The real `step` is the oracle.
 *
 * Primitives, all native here:
 *   enter — the player moves onto a cell             condition: tileLib.cell.enter
 *   push  — a block on that cell moves one further   condition: tileLib.block.may_enter (asked of the cell BEYOND)
 *   hold  — a pressed button derives its token        condition: tileLib.button.pressed
 *   latch — an item cell is picked up on arrival      (no condition; flags are items)
 *   strike — ITEM ACTIONS: `USE:<id>` breaks the FACING cell for this visit
 *            condition: the `action_lib` entry's `condition` helper (`strikes`); the entry's `item`
 *            must be in the effective inventory (data, not a condition). `TURN_<dir>` sets facing.
 *   lane   — ARROW TRAPS: the player may not END a move on a cell of an armed lane
 *            condition: tileLib.trap.armed, asked of the destination with the stance AFTER the move
 *   cut    — ROPES: a rope obstacle activates its group token while cut      condition: tileLib.rope.cut
 *   sink   — BLOCK SINKS: a block pushed onto a sink cell is removed (the push primitive's effect); the
 *            `block_may_enter` condition lets it in through `tile.sink` whatever the cell's own clearance
 *   entry  — ENTRY GATES: entering a cell MOVING one way (a waterfall climbed north) needs its gate; read by
 *            the enter / push conditions through `tile.entry` (the gate's combos for THIS move's direction)
 *   strike-push — STRUCK BLOCKS (`block_strike`): a block is never walk-pushed; a use of a listed action moves
 *            every block within `reach` ahead one cell, farthest first (the push primitive's data, not a
 *            condition)                                  condition: tileLib.block.may_enter (asked of each next cell)
 *
 * Helpers are called as `f(cell, tile)` with `state`/`player` ambient (⚖ Q4 v1): `state.has` reads
 * the EFFECTIVE inventory — carried plus held tokens — through the context's `hasItem`.
 */

import { evaluateRule } from '../../shared/ruleEngine/index.js';
import {
    INPUT_WAIT, TURN_PREFIX, USE_PREFIX, getObstacle, getItem, isFloor, posKey, copyInventory, holdInInventory, actionItems, actionUsable,
    blocksAfterPush, sinksBlock, footprintCells, blockStrikeCells,
} from '../mazeRoomEngine.js';

const DELTAS = { N: { dx: 0, dy: -1 }, S: { dx: 0, dy: 1 }, E: { dx: 1, dy: 0 }, W: { dx: -1, dy: 0 } };
const PLAYER = '1';

export const MAZE_TILE_LIB = {
    cell: { primitive: 'enter', enter: 'player_may_enter' },
    block: { primitive: 'push', may_enter: 'block_may_enter' },
    button: { primitive: 'hold', pressed: 'presses' },
    trap: { primitive: 'lane', armed: 'lane_armed' },
    rope: { primitive: 'cut', cut: 'rope_cut' },
};

/**
 * ⛔ A FRESH context per inventory. The rule engine caches helper results on
 * `context._helperCache` keyed by name + JSON(args) ONLY — the inventory is not in the key,
 * so a context reused after the inventory changed would answer from the old one.
 */
function makeContext(helpers, inventory) {
    return {
        _isSnapshotInterface: true,
        getPlayerId: () => PLAYER,
        getStaticData: () => ({ helpers: { [PLAYER]: helpers } }),
        hasItem: (name) => inventory.has(name),
        // ⛓ COUNTED ITEMS: a Map inventory answers its count (`state.count`); a Set holds everything once.
        countItem: (name) => (inventory instanceof Map ? inventory.get(name) ?? 0 : (inventory.has(name) ? 1 : 0)),
    };
}

function callHelper(context, name, cell, tile) {
    const rule = { type: 'helper', name, args: [{ type: 'name', name: 'cell' }, { type: 'name', name: 'tile' }] };
    const result = evaluateRule(rule, context, 0, { cell, tile });
    if (typeof result !== 'boolean') throw new Error(`tile helper ${name} returned ${String(result)}, not a boolean`);
    return result;
}

/**
 * The facts a v1 (cell-local) helper sees about one cell. `broken` is the state's per-visit list;
 * `actionId` is the use being asked about (`struck` = the obstacle lists it in `struck_by`).
 */
function tileAt(world, x, y, blocks, playerPos, broken = undefined, actionId = null, dir = null) {
    const key = posKey(x, y);
    const obstacle = getObstacle(world, x, y) ?? null;
    const clearSet = obstacle === null ? null : clearSetOf(world, obstacle);
    const lanes = (world.trapLanes?.get(key) ?? []).map((i) => world.trapLib[world.traps[i].id]);
    // ⛓ ENTRY GATES: the gate on entering this cell moving `dir` — its combos, `[]` for no entry that way, null for none.
    const gateKey = dir === null ? null : `${key},${dir}`;
    let entry = null;
    if (gateKey !== null && world.entryGates?.has(gateKey)) {
        const gate = world.entryGates.get(gateKey);
        entry = gate === null ? [] : clearSetOf(world, gate);
    }
    const rope = obstacle !== null ? world.obstacleLib?.[obstacle] : null;
    return {
        floor: isFloor(world, x, y),
        block: blocks?.includes(key) ?? false,
        player: playerPos.x === x && playerPos.y === y,
        button: world.buttons?.get(key) ?? null,
        obstacle,
        clear_set: clearSet,
        // ⛓ rules-l39: an obstacle's cut is recorded at its canonical cell (`at`, a rope's run), so that is where
        // this cell's `broken` is read — the native `strikeTargets` / `isOpen` agree.
        broken: broken?.includes(rope?.at ?? key) ?? false,
        struck: actionId !== null && obstacle !== null
            && (world.obstacleLib?.[obstacle]?.struck_by ?? []).includes(actionId),
        // ARROW TRAPS: the group tokens of the traps whose lane holds this cell, by how they fire.
        lane_unless: lanes.filter((e) => e.fires === 'unless_active').map((e) => e.active),
        lane_while: lanes.filter((e) => e.fires === 'while_active').map((e) => e.active),
        // ROPES: the event a cut of this obstacle is (null when it is not a rope).
        event: rope?.activates ? (rope.event ?? null) : null,
        entry,
        // BLOCK SINKS: a block pushed here sinks (water, lava, a pit).
        sink: sinksBlock(world, x, y),
    };
}

/** An obstacle-lib entry's clearance as `[item, n]` combos — an obstacle's, or an ENTRY GATE's (either type). */
function clearSetOf(world, id) {
    const entry = world.obstacleLib?.[id];
    const type = entry?.clear_set_type ?? 'combo_list';
    if (type === 'rule') return ruleToClearSet(entry.clear_rule, id);
    if (type === 'combo_list') return (entry?.clear_set ?? []).map((combo) => combo.map((item) => [item, 1]));
    throw new Error(`spike: obstacle ${id} is ${type}, only combo_list and rule are modelled`);
}

/** Join two `[item, n]` combos: an item named by both needs the larger count. */
function joinCombos(a, b) {
    const need = new Map(a);
    for (const [item, n] of b) need.set(item, Math.max(need.get(item) ?? 0, n));
    return [...need];
}

/**
 * A `clear_set_type: 'rule'` obstacle's rule as the combo list the `cleared` helper reads, so the
 * condition is answered against THIS step's effective inventory (held tokens and a search's
 * hypothetical inventory included) — not a stateManager snapshot (brief, spike finding F2).
 * A combo is a list of `[item, n]` pairs: ⛓ COUNTED ITEMS (session tile-primitives-counted-rules, ⚖ "Count map"; this
 * replaced grow-levels' "Refuse counted rules") — `Has(item, count n)` needs n, which `cleared` asks via `state.count`.
 * Has / And / Or / True_ / False_ only; any other kind is refused BY NAME (registry D3).
 */
export function ruleToClearSet(rule, obstacle = '?') {
    switch (rule?.rule) {
        case 'True_': return [[]];
        case 'False_': return [];
        case 'Has': return [[[rule.args.item_name, rule.args.count ?? 1]]];
        case 'Or': return (rule.children ?? []).flatMap((c) => ruleToClearSet(c, obstacle));
        case 'And': return (rule.children ?? []).reduce(
            (acc, c) => acc.flatMap((a) => ruleToClearSet(c, obstacle).map((b) => joinCombos(a, b))), [[]]);
        default:
            throw new Error(`tile logic: obstacle ${obstacle}'s clear_rule kind ${rule?.rule ?? rule?.type} is not modelled`);
    }
}

/**
 * The HOLD primitive: carried ∪ the token of every button whose `pressed` condition holds — and the CUT
 * primitive: ∪ the token every rope `activates` whose `cut` condition holds (`broken` = this visit's).
 */
const ROPES = new WeakMap();
/** The world's rope cells `[[posKey, id]]`, cached per obstacle map (rebuilt when it changes size). */
function ropeCells(world) {
    const hit = ROPES.get(world.obstacles);
    if (hit && hit.size === world.obstacles.size && hit.lib === world.obstacleLib) return hit.ropes;
    const ropes = [...world.obstacles].filter(([, id]) => world.obstacleLib?.[id]?.activates);
    ROPES.set(world.obstacles, { size: world.obstacles.size, lib: world.obstacleLib, ropes });
    return ropes;
}

export function scriptedEffectiveInventory(world, carried, playerPos, blocks, tileLib, helpers, broken = undefined) {
    const ropes = ropeCells(world);
    if ((!world.buttons || world.buttons.size === 0) && ropes.length === 0) return carried;
    const out = copyInventory(carried);
    const ctx = makeContext(helpers, carried);
    for (const [key, buttonId] of world.buttons ?? []) {
        const token = world.buttonLib?.[buttonId]?.holds;
        if (!token) continue;
        const [x, y] = key.split(',').map(Number);
        if (callHelper(ctx, tileLib.button.pressed, { x, y }, tileAt(world, x, y, blocks, playerPos))) holdInInventory(out, token);
    }
    for (const [key, id] of ropes) {
        const [x, y] = key.split(',').map(Number);
        if (callHelper(ctx, tileLib.rope.cut, { x, y }, tileAt(world, x, y, blocks, playerPos, broken))) {
            holdInInventory(out, world.obstacleLib[id].activates);
        }
    }
    return out;
}

/**
 * The LANE condition at the player's cell of `state` (a search's arrival in a live lane reaches nothing).
 * The primitive covers LANE cells only: elsewhere no trap aims, and the helper is not asked.
 */
export function scriptedStandsInArmedLane(world, state, helpers, tileLib = MAZE_TILE_LIB) {
    const { x, y } = state.player_pos;
    if (!world.trapLanes?.has(posKey(x, y))) return false;
    const inv = scriptedEffectiveInventory(world, state.inventory, state.player_pos, state.blocks, tileLib, helpers, state.broken);
    return callHelper(makeContext(helpers, inv), tileLib.trap.armed, { x, y },
        tileAt(world, x, y, state.blocks, state.player_pos, state.broken));
}

/**
 * `step`'s contract: the next state, or a refusal naming the PRIMITIVE that refused —
 * `{ next: null, refused: { primitive, cell, helper } }`. `latch: false` turns the item pickup
 * off: an AP-logic search holds a fixed inventory and a location tile grants nothing.
 */
export function scriptedStep(world, state, input, helpers, tileLib = MAZE_TILE_LIB, { latch = true } = {}) {
    if (input === INPUT_WAIT) {
        return { next: { ...cloneState(state), turn: state.turn + 1 }, refused: null };
    }
    const noInput = { next: null, refused: { primitive: 'input', cell: null, helper: null } };
    if (typeof input === 'string' && input.startsWith(TURN_PREFIX)) {
        const dir = input.slice(TURN_PREFIX.length);
        if (state.facing === undefined || !DELTAS[dir]) return noInput;
        const next = cloneState(state);
        next.facing = dir;
        next.turn += 1;
        return { next, refused: null };
    }
    if (typeof input === 'string' && input.startsWith(USE_PREFIX)) {
        const actionId = input.slice(USE_PREFIX.length);
        const entry = state.facing === undefined ? undefined : world.actionLib?.[actionId];
        if (!entry) return noInput;
        const inv = scriptedEffectiveInventory(world, state.inventory, state.player_pos, state.blocks, tileLib, helpers, state.broken);
        if (!actionUsable(entry, inv)) {
            return { next: null, refused: { primitive: 'strike', cell: null, helper: null, item: actionItems(entry).join(' + ') } };
        }
        const d = DELTAS[state.facing];
        const next = cloneState(state);
        next.turn += 1;
        // ⚖ "use at air" is legal: the condition only decides whether each cell of the use's footprint BREAKS
        // (⛓ WEAPON FOOTPRINTS: the native `footprintCells` — the faced cell unless the action carries a `footprint`).
        const ctx = makeContext(helpers, inv);
        const struck = new Set();
        for (const { x: fx, y: fy } of footprintCells(world, state, actionId)) {
            const cell = tileAt(world, fx, fy, state.blocks, state.player_pos, state.broken, actionId);
            if (!callHelper(ctx, entry.condition, { x: fx, y: fy }, cell)) continue;
            // ⛓ rules-l39: an obstacle's canonical cell (`at`, a rope's run) takes the strike — the native
            // `strikeTargets`' key, so the two paths hold one cut state; a run hit on several cells of ONE use is
            // cut once (whether it was cut before is the helper's question, never answered here).
            const key = world.obstacleLib?.[getObstacle(world, fx, fy)]?.at ?? posKey(fx, fy);
            if (!struck.has(key)) next.broken.push(key);
            struck.add(key);
        }
        next.broken.sort();
        // ⛓ STRUCK BLOCKS (session tile-primitives-sphere-order-2): the native `strikePushes` over the native
        // `blockStrikeCells` (farthest first), the next cell asked of the push condition; a block moved off a button
        // may arm the lane the player stands in.
        if (world.blockStrike?.struckBy.includes(actionId) && state.blocks?.length) {
            const moved = next.blocks;
            for (const { x, y } of blockStrikeCells(world, state, actionId)) {
                if (!next.blocks.includes(posKey(x, y))) continue;
                const bx = x + d.dx;
                const by = y + d.dy;
                const beyond = tileAt(world, bx, by, next.blocks, state.player_pos, state.broken, null, state.facing);
                if (!callHelper(ctx, tileLib.block.may_enter, { x: bx, y: by }, beyond)) continue;
                next.blocks = blocksAfterPush(world, next.blocks, posKey(x, y), posKey(bx, by));
            }
            if (next.blocks !== moved && world.trapLanes && scriptedStandsInArmedLane(world, next, helpers, tileLib)) {
                return { next: null, refused: { primitive: 'lane', cell: { ...state.player_pos }, helper: tileLib.trap.armed } };
            }
        }
        return { next, refused: null };
    }
    const delta = DELTAS[input];
    if (!delta) return noInput;
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    const inv = scriptedEffectiveInventory(world, state.inventory, state.player_pos, state.blocks, tileLib, helpers, state.broken);
    const ctx = makeContext(helpers, inv);
    const target = tileAt(world, nx, ny, state.blocks, state.player_pos, state.broken, null, input);
    if (!callHelper(ctx, tileLib.cell.enter, { x: nx, y: ny }, target)) {
        return { next: null, refused: { primitive: 'enter', cell: { x: nx, y: ny }, helper: tileLib.cell.enter } };
    }
    let pushedFrom = null;
    let pushedTo = null;
    if (target.block && world.blockStrike) {
        return { next: null, refused: { primitive: 'push', cell: { x: nx, y: ny }, helper: null } };
    }
    if (target.block) {
        const bx = nx + delta.dx;
        const by = ny + delta.dy;
        const beyond = tileAt(world, bx, by, state.blocks, state.player_pos, state.broken, null, input);
        if (!callHelper(ctx, tileLib.block.may_enter, { x: bx, y: by }, beyond)) {
            return { next: null, refused: { primitive: 'push', cell: { x: bx, y: by }, helper: tileLib.block.may_enter } };
        }
        pushedFrom = posKey(nx, ny);
        pushedTo = posKey(bx, by);
    }
    const next = cloneState(state);
    next.player_pos = { x: nx, y: ny };
    next.turn += 1;
    if (next.facing !== undefined) next.facing = input;
    // ⛓ BLOCK SINKS: the push primitive's effect — onto a sink cell the block is gone (the helper said it may enter).
    if (pushedFrom !== null) next.blocks = blocksAfterPush(world, next.blocks, pushedFrom, pushedTo);
    if (world.trapLanes && scriptedStandsInArmedLane(world, next, helpers, tileLib)) {
        return { next: null, refused: { primitive: 'lane', cell: { x: nx, y: ny }, helper: tileLib.trap.armed } };
    }
    const itemId = latch ? getItem(world, nx, ny) : null;
    if (itemId) holdInInventory(next.inventory, itemId);
    return { next, refused: null };
}

function cloneState(state) {
    const next = {
        player_pos: { ...state.player_pos },
        turn: state.turn,
        inventory: copyInventory(state.inventory),
    };
    if (state.blocks !== undefined) next.blocks = state.blocks.slice();
    if (state.facing !== undefined) next.facing = state.facing;
    if (state.broken !== undefined) next.broken = state.broken.slice();
    return next;
}
