/**
 * ITEM ACTIONS fixtures (slice tile-primitives-item-actions) — worlds read from
 * ASCII pictures, shared by the engine, executor, autopather and tileSpike
 * parity suites so all four speak about the same rooms.
 *
 *   #  wall          P  entrance         X  exit
 *   S  the sword (an item tile — `Progressive Sword`)
 *   r  a rock: obstacle `rock`, `clear_set: []`, `struck_by: ['sword']`
 *   R  door_red (needs key_red)         K  key_red
 *   B  a block                          b  button_A (holds sw_A)
 *   D  door_A (held open by sw_A)       L  a location item (`flag_B`)
 */

import {
    createWorld, setTile, TILE_WALL, setObstacle, setItem, setBlock, setButton,
} from './mazeRoomEngine.js';

export const SWORD = 'Progressive Sword';

export const SWORD_ACTION_LIB = Object.freeze({
    sword: Object.freeze({ item: SWORD, primitive: 'strike', condition: 'strikes', key: 'z' }),
});

export const ROCK_ENTRY = Object.freeze({
    kind: 'rock', clear_set: [], struck_by: ['sword'], color: '#7a6a55',
});

export function itemActionPicture(rows, { actionLib = SWORD_ACTION_LIB } = {}) {
    const height = rows.length;
    const width = rows[0].length;
    let entrance = { x: 0, y: 0 };
    let exit = null;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (rows[y][x] === 'P') entrance = { x, y };
            if (rows[y][x] === 'X') exit = { x, y };
        }
    }
    const w = createWorld(width, height, {
        entrance,
        exits: [{ exit_id: 'exit', ...(exit ?? entrance) }],
        actionLib: actionLib ?? undefined,
        buttonLib: { button_A: { kind: 'button', holds: 'sw_A' } },
    });
    w.obstacleLib = {
        ...w.obstacleLib,
        rock: ROCK_ENTRY,
        door_A: { kind: 'door', clear_set: [['sw_A']], color: '#3a7' },
    };
    w.itemLib = { ...w.itemLib, [SWORD]: { kind: 'item' }, flag_B: { kind: 'flag' } };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const c = rows[y][x];
            if (c === '#') setTile(w, x, y, TILE_WALL);
            if (c === 'S') setItem(w, x, y, SWORD);
            if (c === 'r') setObstacle(w, x, y, 'rock');
            if (c === 'R') setObstacle(w, x, y, 'door_red');
            if (c === 'K') setItem(w, x, y, 'key_red');
            if (c === 'B') setBlock(w, x, y);
            if (c === 'b') setButton(w, x, y, 'button_A');
            if (c === 'D') setObstacle(w, x, y, 'door_A');
            if (c === 'L') setItem(w, x, y, 'flag_B');
        }
    }
    return w;
}

/** The sword lies off the route; the rock seals the exit corridor. */
export const ROCK_CORRIDOR = Object.freeze([
    '#######',
    '#P..rX#',
    '#.S...#',
    '#######',
]);

/**
 * Everything at once, for the ⇔ property: a rock, a key door, a block that
 * can be pushed onto a button holding door_A, and a location behind the rock.
 * The sword is reachable BEFORE the rock is, and the rock is reachable without
 * it, so both sides of every new refusal are exercised.
 */
export const ACTION_GADGETS = Object.freeze([
    '#########',
    '#P.S#...#',
    '#.B.r.L.#',
    '#..b#D#R#',
    '#.K.#..X#',
    '#########',
]);
