/**
 * procgenCore/elements/keyGate — **THE KEY GATE: a lock in the only gap of a
 * wall, opened from the SOUTH with a key that lies on the START side** (seedling
 * gen strategy elements round 2; ⚖ the user 2026-11-01, "(b) More strategy
 * elements", and 2026-11-03 on what the key is: *"a randomized AP item whose
 * vanilla placement is the key"*).
 *
 * The generator's gadget for the solver's `keylock` verb. On Seedling the lock
 * is a `bosslock` (`Puzzlements/BossLock.as`: it opens when the player walks its
 * key line — one pixel BELOW the lock — holding `Player.hasKey(keyType)`) and the
 * key is a `bosskey` pickup of the same type, the key's VANILLA LOCATION. In an
 * Archipelago world the key spot is an ordinary location and the key an ordinary
 * item (`seedlingGenRoom`'s `boss-key` row): under vanilla placement the room
 * solves on its own, under randomization the lock is an item requirement.
 *
 * ── THE PARTS ─────────────────────────────────────────────────────────
 *
 *  · THE LOCK — the CHEST DOOR's geometry, cell for cell (`chestDoor.
 *    buildChestDoor`): one main-path cell that is the only gap of a grown wall
 *    (jogging on an east–west crossing), its stance `S` directly BELOW it, and a
 *    carved pocket when `S` is wall. ⛓ The lock and the chest share one reason:
 *    both open from the one-pixel line under them, so the cell under the lock
 *    must be on the start side.
 *  · THE KEY — one floor cell `K` on the START side (the lock, its wall and
 *    the pocket as built), never the start, the goal, the stance or a pocket
 *    cell. OFF the main path when any such cell exists for any lock candidate
 *    (the walk to the lock does not collect it by accident, so the plan names
 *    it); on the main path only as the fallback. `K` is a CLEARER beside the
 *    stance, so the commit's door law asks that the start reaches it with the
 *    lock walled — a key behind its own lock is a room nobody can solve.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ─────────────────────────────────
 *
 *  The chest door's, renamed for a lock (`goal-too-close`, `the-lock-is-not-a-cut`,
 *  `the-stance-is-beyond-the-lock`, `no-stance-pocket`), then `no-key-cell`: no
 *  lock candidate has a start-side floor cell for its key.
 *
 * ONE DRAW: `rng.pick` over every (lock, key) pair of the best tier — off-path
 * keys before on-path ones, and within that the UNCARVED locks before the
 * pocketed ones (the chest door's own preference).
 *
 * ⛔ NOTHING HERE KNOWS A SUBSTRATE: `bosslock`, `bosskey` and their tags are the
 * binding's words (`procgenSeedlingElements.seedlingOnConnectorEntities`).
 */

import { defineElement, LAW_CUT } from '../elements.js';
import { reachableFrom, shortestPath } from '../gridFlood.js';
import { TILE_FLOOR, cellKey, manhattan } from './roomDoor.js';
import { buildChestDoor, chestDoorTiles } from './chestDoor.js';

/**
 * ⛓ THE KEY TYPES — the lock's and the key's colour (⚖ the user 2026-11-03, *"B: Distinct colour per room"*):
 * five, as the game has (`Game.bossLocks` / `Game.bossKeys`, 0..4). ⛔ An omitted `type` is NOT drawn: it is
 * `KEY_GATE_DEFAULT_TYPE`, spelled by the binding as an override (`procgenSeedling`'s on-connector arm), because
 * the colour is the WORLD's allocation (one per key-gate room), never the room stream's.
 */
export const KEY_GATE_TYPES = Object.freeze([0, 1, 2, 3, 4]);
export const KEY_GATE_DEFAULT_TYPE = 0;

/** The ids the BINDING looks up — the lock in the gap and its key. */
export const KEY_GATE_LOCK_ID = 'keygate_lock';
export const KEY_GATE_KEY_ID = 'keygate_key';

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME, in the order the stages run. */
export const KEY_GATE_REFUSALS = Object.freeze([
    'no-lock-cell', 'goal-too-close', 'the-lock-is-not-a-cut',
    'the-stance-is-beyond-the-lock', 'no-stance-pocket', 'no-key-cell',
]);

/** The chest door's stage names, spoken of a lock (`reason:` rows, so the refusal census scans them). */
const LOCK_REASONS = Object.freeze([
    Object.freeze({ chest: 'no-chest-cell', reason: 'no-lock-cell' }),
    Object.freeze({ chest: 'goal-too-close', reason: 'goal-too-close' }),
    Object.freeze({ chest: 'the-chest-is-not-a-cut', reason: 'the-lock-is-not-a-cut' }),
    Object.freeze({ chest: 'the-stance-is-beyond-the-chest', reason: 'the-stance-is-beyond-the-lock' }),
    Object.freeze({ chest: 'no-stance-pocket', reason: 'no-stance-pocket' }),
]);

/**
 * The key cells one lock candidate offers, row-major: start-side floor (with the
 * lock and its wall solid and its pocket carved), not the start, the goal, the
 * stance or a pocket cell. Each is `{x, y, onPath}`.
 */
/** The room's floor once a lock candidate is built: its lock and wall solid, its pocket carved. */
function openWith(room, pick) {
    const wallKeys = new Set(pick.wall.map((c) => cellKey(c.x, c.y)));
    const pocketKeys = new Set(pick.pocket.map((c) => cellKey(c.x, c.y)));
    const lockKey = cellKey(pick.chest.x, pick.chest.y);
    return (x, y) => cellKey(x, y) !== lockKey && !wallKeys.has(cellKey(x, y))
        && (room.floorAt(x, y) || pocketKeys.has(cellKey(x, y)));
}

/**
 * ⛓⛓ **THE KEY'S CORRIDOR — the shortest start→key run on the start side, OWNED as floor.** MEASURED (the first
 * hook room, drawn seed 0.5): a pass-2 `pit-patch` cut the key off from the start, so the only route to it ran
 * THROUGH the lock — and the solver's `keylock` does not refuse a lock whose key the run does not hold, it THROWS
 * (`execKeylock`: "the key is a SUB-ORDER"), which the generator reads as an ABORT, not a rejected candidate. The
 * element owns that corridor so pass 2 can never cut it: the room keeps a start-side way to its key.
 */
export function keyPathFor(room, pick) {
    return shortestPath(room.width, room.height, openWith(room, pick), room.start, pick.key) ?? [];
}

export function keyCellsFor(room, pick) {
    const pocketKeys = new Set(pick.pocket.map((c) => cellKey(c.x, c.y)));
    const open = openWith(room, pick);
    const startSide = reachableFrom(room.width, room.height, open, room.start);
    const onPath = new Set(room.mainPath.map((c) => cellKey(c.x, c.y)));
    const skip = new Set([cellKey(room.start.x, room.start.y), cellKey(room.goal.x, room.goal.y),
        cellKey(pick.stance.x, pick.stance.y), ...pocketKeys]);
    const out = [];
    for (let y = 0; y < room.height; y += 1) {
        for (let x = 0; x < room.width; x += 1) {
            const k = cellKey(x, y);
            if (!startSide.has(k) || skip.has(k)) continue;
            out.push(Object.freeze({ x, y, onPath: onPath.has(k) }));
        }
    }
    return out;
}

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildKeyGate(room) {
    const locks = buildChestDoor(room);
    if (locks.refused) {
        const reason = LOCK_REASONS.find((r) => r.chest === locks.refused.reason)?.reason ?? locks.refused.reason;
        return { refused: { reason, detail: `the KEY GATE's lock is the chest door's cell: ${locks.refused.detail}` } };
    }
    /** Tiers: [off-path key × natural lock, off-path × carved, on-path × natural, on-path × carved]. */
    const tiers = [[], [], [], []];
    for (const pick of locks.candidates) {
        const carved = pick.pocket.length > 0 ? 1 : 0;
        for (const key of keyCellsFor(room, pick)) {
            tiers[(key.onPath ? 2 : 0) + carved].push(Object.freeze({ ...pick, key }));
        }
    }
    const ok = tiers.find((t) => t.length > 0);
    if (!ok) {
        return { refused: { reason: 'no-key-cell',
            detail: `${locks.candidates.length} lock cell(s) passed the chest door's rules, and none has a `
                + 'START-SIDE floor cell for its key (not the start, the goal, the stance or a pocket cell). '
                + '⛓ A key behind its own lock is a room nobody can solve.' } };
    }
    return { candidates: Object.freeze(ok) };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(room, pick, count, keyType) {
    return {
        /** ⛓ The chest door's tiles, plus the key's corridor (`keyPathFor`, the key cell last) OWNED as the
         *  floor it already is — less any cell the chest door already writes. */
        tiles: (() => {
            const lockTiles = chestDoorTiles(room, pick);
            const mine = new Set(lockTiles.map((t) => cellKey(t.x, t.y)));
            const path = keyPathFor(room, pick).filter((c) => !mine.has(cellKey(c.x, c.y))
                && !(c.x === room.start.x && c.y === room.start.y));
            return [...lockTiles, ...path.map((c) => ({ x: c.x, y: c.y, tile: TILE_FLOOR }))];
        })(),
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [
                { x: pick.chest.x, y: pick.chest.y, id: KEY_GATE_LOCK_ID, keyType },
                { x: pick.key.x, y: pick.key.y, id: KEY_GATE_KEY_ID, keyType },
            ],
            items: [],
        },
        doorCells: [{ x: pick.chest.x, y: pick.chest.y }],
        doorSolidForCarve: pick.pocket.length > 0,
        /** ⛓ The stance FIRST (where the lock is opened), then the key — both reachable with the lock walled. */
        clearer: [{ x: pick.stance.x, y: pick.stance.y }, { x: pick.key.x, y: pick.key.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: pick.wall.length,
            carved: pick.pocket.length,
            candidates: count,
            goalDistance: pick.goalDistance,
            keyDistance: manhattan(pick.key, pick.chest),
            keyOnPath: pick.key.onPath ? 1 : 0,
            keyPath: keyPathFor(room, pick).length,
        },
    };
}

/** The placement shape: the LOCK then its KEY; the stance directly BELOW the lock, then the key cell. */
export function assertKeyGatePlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    const ids = obstacles.map((o) => o.id);
    if (obstacles.length !== 2 || ids[0] !== KEY_GATE_LOCK_ID || ids[1] !== KEY_GATE_KEY_ID) {
        fail(`keyGate: the gate is exactly a LOCK then its KEY (${KEY_GATE_LOCK_ID}, ${KEY_GATE_KEY_ID}) — got `
            + `${JSON.stringify(ids)}.`);
        return;
    }
    const [lock, key] = obstacles;
    const cells = placement.doorCells;
    if (cells.length !== 1 || cells[0].x !== lock.x || cells[0].y !== lock.y) {
        fail('keyGate: `doorCells` must be exactly the lock\'s cell.');
    }
    if (placement.clearer.length !== 2) {
        fail('keyGate: `clearer` must be exactly TWO cells — the stance below the lock, then the key.');
    }
    const [s, k] = placement.clearer;
    if (s.x !== lock.x || s.y !== lock.y + 1) {
        fail(`keyGate: the stance (${s.x},${s.y}) is not directly BELOW the lock (${lock.x},${lock.y}) — a `
            + 'boss lock opens only from the line beneath it.');
    }
    if (k.x !== key.x || k.y !== key.y) {
        fail('keyGate: the second clearer must be the key\'s own cell.');
    }
    if (!KEY_GATE_TYPES.includes(lock.keyType) || key.keyType !== lock.keyType) {
        fail(`keyGate: the lock and its key carry ONE key type of [${KEY_GATE_TYPES.join(', ')}] — got `
            + `${JSON.stringify([lock.keyType, key.keyType])}.`);
    }
}

export const KEY_GATE = defineElement({
    name: 'key-gate',
    family: 'keygate',
    phase: 'on-connector',
    law: LAW_CUT,
    why: 'A LOCK standing in the only gap of a wall (a main-path CUT), opened from the cell directly '
        + 'BELOW it with a KEY that lies on the start side, off the main path when it can — the key '
        + 'is the lock\'s vanilla location. The solver\'s `keylock`: collect the key, then walk the '
        + 'lock\'s key line.',
    params: [
        { key: 'type', domain: KEY_GATE_TYPES, default: KEY_GATE_DEFAULT_TYPE,
            why: 'the key type — the lock\'s and its key\'s colour, one of the game\'s five (0 red, 1 green, 2 purple, '
                + '3 blue, 4 yellow). ⛓ A pipeline world gives each key-gate room its own (⚖ "B: Distinct colour per '
                + 'room"); an omitted `type` is 0, never drawn.' },
    ],
    construct: (values, site, rng) => {
        const out = buildKeyGate(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
        return placementOf(site.room, rng.pick(out.candidates), out.candidates.length, values.type);
    },
    assertPlacement: assertKeyGatePlacement,
});
