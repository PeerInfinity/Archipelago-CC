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
 *
 * Helpers are called as `f(cell, tile)` with `state`/`player` ambient (⚖ Q4 v1): `state.has` reads
 * the EFFECTIVE inventory — carried plus held tokens — through the context's `hasItem`.
 */

import { evaluateRule } from '../../shared/ruleEngine/index.js';
import {
    INPUT_WAIT, TURN_PREFIX, USE_PREFIX, getObstacle, getItem, isFloor, posKey,
} from '../mazeRoomEngine.js';

const DELTAS = { N: { dx: 0, dy: -1 }, S: { dx: 0, dy: 1 }, E: { dx: 1, dy: 0 }, W: { dx: -1, dy: 0 } };
const PLAYER = '1';

export const MAZE_TILE_LIB = {
    cell: { primitive: 'enter', enter: 'player_may_enter' },
    block: { primitive: 'push', may_enter: 'block_may_enter' },
    button: { primitive: 'hold', pressed: 'presses' },
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
        countItem: (name) => (inventory.has(name) ? 1 : 0),
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
function tileAt(world, x, y, blocks, playerPos, broken = undefined, actionId = null) {
    const key = posKey(x, y);
    const obstacle = getObstacle(world, x, y) ?? null;
    let clearSet = null;
    if (obstacle !== null) {
        const entry = world.obstacleLib?.[obstacle];
        const type = entry?.clear_set_type ?? 'combo_list';
        if (type === 'rule') clearSet = ruleToClearSet(entry.clear_rule, obstacle);
        else if (type === 'combo_list') clearSet = entry?.clear_set ?? [];
        else throw new Error(`spike: obstacle ${obstacle} is ${type}, only combo_list and rule are modelled`);
    }
    return {
        floor: isFloor(world, x, y),
        block: blocks?.includes(key) ?? false,
        player: playerPos.x === x && playerPos.y === y,
        button: world.buttons?.get(key) ?? null,
        obstacle,
        clear_set: clearSet,
        broken: broken?.includes(key) ?? false,
        struck: actionId !== null && obstacle !== null
            && (world.obstacleLib?.[obstacle]?.struck_by ?? []).includes(actionId),
    };
}

/**
 * A `clear_set_type: 'rule'` obstacle's rule as the combo list the `cleared` helper reads, so the
 * condition is answered against THIS step's effective inventory (held tokens and a search's
 * hypothetical inventory included) — not a stateManager snapshot (brief, spike finding F2).
 * Has / And / Or / True_ / False_ only; any other kind is refused BY NAME (registry D3).
 */
export function ruleToClearSet(rule, obstacle = '?') {
    switch (rule?.rule) {
        case 'True_': return [[]];
        case 'False_': return [];
        case 'Has': return [[rule.args.item_name]];
        case 'Or': return (rule.children ?? []).flatMap((c) => ruleToClearSet(c, obstacle));
        case 'And': return (rule.children ?? []).reduce(
            (acc, c) => acc.flatMap((a) => ruleToClearSet(c, obstacle).map((b) => [...a, ...b])), [[]]);
        default:
            throw new Error(`tile logic: obstacle ${obstacle}'s clear_rule kind ${rule?.rule ?? rule?.type} is not modelled`);
    }
}

/** The HOLD primitive: carried ∪ the token of every button whose `pressed` condition holds. */
export function scriptedEffectiveInventory(world, carried, playerPos, blocks, tileLib, helpers) {
    if (!world.buttons || world.buttons.size === 0) return carried;
    const out = new Set(carried);
    const ctx = makeContext(helpers, carried);
    for (const [key, buttonId] of world.buttons) {
        const token = world.buttonLib?.[buttonId]?.holds;
        if (!token) continue;
        const [x, y] = key.split(',').map(Number);
        if (callHelper(ctx, tileLib.button.pressed, { x, y }, tileAt(world, x, y, blocks, playerPos))) out.add(token);
    }
    return out;
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
        const inv = scriptedEffectiveInventory(world, state.inventory, state.player_pos, state.blocks, tileLib, helpers);
        if (entry.item && !inv.has(entry.item)) {
            return { next: null, refused: { primitive: 'strike', cell: null, helper: null, item: entry.item } };
        }
        const d = DELTAS[state.facing];
        const fx = state.player_pos.x + d.dx;
        const fy = state.player_pos.y + d.dy;
        const facing = tileAt(world, fx, fy, state.blocks, state.player_pos, state.broken, actionId);
        const next = cloneState(state);
        next.turn += 1;
        // ⚖ "use at air" is legal: the condition only decides whether the facing cell BREAKS.
        if (callHelper(makeContext(helpers, inv), entry.condition, { x: fx, y: fy }, facing)) {
            next.broken.push(posKey(fx, fy));
            next.broken.sort();
        }
        return { next, refused: null };
    }
    const delta = DELTAS[input];
    if (!delta) return noInput;
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    const inv = scriptedEffectiveInventory(world, state.inventory, state.player_pos, state.blocks, tileLib, helpers);
    const ctx = makeContext(helpers, inv);
    const target = tileAt(world, nx, ny, state.blocks, state.player_pos, state.broken);
    if (!callHelper(ctx, tileLib.cell.enter, { x: nx, y: ny }, target)) {
        return { next: null, refused: { primitive: 'enter', cell: { x: nx, y: ny }, helper: tileLib.cell.enter } };
    }
    let pushedFrom = null;
    let pushedTo = null;
    if (target.block) {
        const bx = nx + delta.dx;
        const by = ny + delta.dy;
        const beyond = tileAt(world, bx, by, state.blocks, state.player_pos, state.broken);
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
    if (pushedFrom !== null) {
        next.blocks[next.blocks.indexOf(pushedFrom)] = pushedTo;
        next.blocks.sort();
    }
    const itemId = latch ? getItem(world, nx, ny) : null;
    if (itemId) next.inventory.add(itemId);
    return { next, refused: null };
}

function cloneState(state) {
    const next = {
        player_pos: { ...state.player_pos },
        turn: state.turn,
        inventory: new Set(state.inventory),
    };
    if (state.blocks !== undefined) next.blocks = state.blocks.slice();
    if (state.facing !== undefined) next.facing = state.facing;
    if (state.broken !== undefined) next.broken = state.broken.slice();
    return next;
}
