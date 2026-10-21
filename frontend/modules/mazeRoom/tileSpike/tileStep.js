/**
 * Tile-primitives SPIKE (2026-10-21) — the maze's push + button behaviour re-expressed as
 * ENGINE PRIMITIVES configured by a `tile_lib`, with helper scripts for the CONDITIONS only
 * (⚖ Q2 iii; brief NewDocs/plans/tile-primitives-design-brief.md). The real `step` is the oracle.
 *
 * Primitives, all native here:
 *   enter — the player moves onto a cell             condition: tileLib.cell.enter
 *   push  — a block on that cell moves one further   condition: tileLib.block.may_enter (asked of the cell BEYOND)
 *   hold  — a pressed button derives its token        condition: tileLib.button.pressed
 *   latch — an item cell is picked up on arrival      (no condition; flags are items)
 *
 * Helpers are called as `f(cell, tile)` with `state`/`player` ambient (⚖ Q4 v1): `state.has` reads
 * the EFFECTIVE inventory — carried plus held tokens — through the context's `hasItem`.
 */

import { evaluateRule } from '../../shared/ruleEngine/index.js';
import { INPUT_WAIT, getObstacle, getItem, isFloor, posKey } from '../mazeRoomEngine.js';

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

/** The facts a v1 (cell-local) helper sees about one cell. */
function tileAt(world, x, y, blocks, playerPos) {
    const key = posKey(x, y);
    const obstacle = getObstacle(world, x, y) ?? null;
    let clearSet = null;
    if (obstacle !== null) {
        const entry = world.obstacleLib?.[obstacle];
        if ((entry?.clear_set_type ?? 'combo_list') !== 'combo_list') {
            throw new Error(`spike: obstacle ${obstacle} is ${entry.clear_set_type}, only combo_list is modelled`);
        }
        clearSet = entry?.clear_set ?? [];
    }
    return {
        floor: isFloor(world, x, y),
        block: blocks?.includes(key) ?? false,
        player: playerPos.x === x && playerPos.y === y,
        button: world.buttons?.get(key) ?? null,
        obstacle,
        clear_set: clearSet,
    };
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
 * `{ next: null, refused: { primitive, cell, helper } }`.
 */
export function scriptedStep(world, state, input, helpers, tileLib = MAZE_TILE_LIB) {
    if (input === INPUT_WAIT) {
        return { next: { ...cloneState(state), turn: state.turn + 1 }, refused: null };
    }
    const delta = DELTAS[input];
    if (!delta) return { next: null, refused: { primitive: 'input', cell: null, helper: null } };
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    const inv = scriptedEffectiveInventory(world, state.inventory, state.player_pos, state.blocks, tileLib, helpers);
    const ctx = makeContext(helpers, inv);
    const target = tileAt(world, nx, ny, state.blocks, state.player_pos);
    if (!callHelper(ctx, tileLib.cell.enter, { x: nx, y: ny }, target)) {
        return { next: null, refused: { primitive: 'enter', cell: { x: nx, y: ny }, helper: tileLib.cell.enter } };
    }
    let pushedFrom = null;
    let pushedTo = null;
    if (target.block) {
        const bx = nx + delta.dx;
        const by = ny + delta.dy;
        const beyond = tileAt(world, bx, by, state.blocks, state.player_pos);
        if (!callHelper(ctx, tileLib.block.may_enter, { x: bx, y: by }, beyond)) {
            return { next: null, refused: { primitive: 'push', cell: { x: bx, y: by }, helper: tileLib.block.may_enter } };
        }
        pushedFrom = posKey(nx, ny);
        pushedTo = posKey(bx, by);
    }
    const next = cloneState(state);
    next.player_pos = { x: nx, y: ny };
    next.turn += 1;
    if (pushedFrom !== null) {
        next.blocks[next.blocks.indexOf(pushedFrom)] = pushedTo;
        next.blocks.sort();
    }
    const itemId = getItem(world, nx, ny);
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
    return next;
}
