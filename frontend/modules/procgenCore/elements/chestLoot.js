/**
 * procgenCore/elements/chestLoot — **THE LOOT CHEST: a chest standing OFF the
 * main path, opened from the cell directly BELOW it** (seedling gen content B1;
 * vanilla's 15 loot chests, one seal piece each, `Level NNN - Chest`).
 *
 * ⚖ The user, 2026-10-30: chests as DOORS first, loot and goal chests after the
 * oracle's "no collect record" fix; 2026-11-01 (via user-decisions-liaison):
 * *"(e) Loot/goal chests"*. The fix landed as `seedling-js-chest-goal-collect`
 * (`procgenOracle.certifyCollects`' chest arm): a `collect-placement` goal on a
 * chest's own placement is certified by the solve's `chest` record. That is how
 * this element is certified — the binding adds the chest as a SECOND collect goal
 * AHEAD of the room's own (`procgenSeedling.seedlingModel`'s `goals`), so every
 * certificate of a loot room says the chest was opened and its piece taken.
 *
 * ── THE PARTS ─────────────────────────────────────────────────────────
 *
 *  · THE CHEST — one floor cell `C` that is NOT on the main path, not the start
 *    and not the goal. ⛓ A chest is `type = "Solid"` until `open()`
 *    (`Chest.as:41`), so `C` is the element's one `doorCell` — the cell the law
 *    walls — though it gates nothing.
 *  · THE STANCE — `S = (C.x, C.y + 1)`, the cell strictly BELOW the chest.
 *    ⛓ `Chest.update` opens on a one-pixel line beneath the chest (`levelWorld`'s
 *    `chest` row, `kind: 'line-below'`), and the solver's `chestStanceBand`
 *    searches from there DOWNWARD only — the game's trigger geometry. `S` is the
 *    element's `clearer`.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ─────────────────────────────────
 *
 *  (i)   OFF THE PATH — `C` is interior skeleton floor, not the start, not the
 *        goal, not on the main path (`no-loot-cell`). ⛓ Off the ONE canonical
 *        shortest path, so with `C` solid that path still runs: the goal stays
 *        reachable and no walk gets shorter — the `none` law, by construction.
 *  (ii)  THE STANCE IS FLOOR — `S` is interior skeleton floor and neither the
 *        start nor the goal (`the-stance-is-not-floor`). ⛔ No carve: a loot
 *        chest decorates the room the connector left; it never re-shapes it.
 *  (iii) THE STANCE IS REACHABLE — with `C` AND the goal walled the start
 *        still floods `S` (`the-chest-walls-off-its-stance`): the chest must not
 *        BE the only way to the cell it is opened from, and the walk to it must
 *        not cross the goal (measured: branchy and rooms seed 1, pre-sword, put
 *        the stance behind the goal pickup, and the certification REFUSED
 *        "no walkable tile path" with the torch as the obstacle).
 *
 * ⛓ ONE DRAW: `rng.pick` over every candidate that passed, the NOOKS first when
 * any exist — a cell with at most one floor 4-neighbour besides its stance (a
 * dead end or a wall-backed alcove, where a vanilla chest stands); the open
 * floor is the fallback, as a door's carved pocket is.
 *
 * ⛔ NOTHING HERE KNOWS A SUBSTRATE: `chest` and `tag` are the binding's words
 * (`procgenSeedlingElements.seedlingOnConnectorEntities`). This file says
 * *chest*, *stance*, *nook*.
 */

import { defineElement, LAW_NONE } from '../elements.js';
import { reachableFrom } from '../gridFlood.js';
import { NB4, cellKey, inInterior } from './roomDoor.js';

/** The id the BINDING looks up — the loot chest. */
export const CHEST_LOOT_CHEST_ID = 'chestloot_chest';

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME, in the order the stages run. */
export const CHEST_LOOT_REFUSALS = Object.freeze([
    'no-loot-cell', 'the-stance-is-not-floor', 'the-chest-walls-off-its-stance',
]);

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildChestLoot(room) {
    const seen = new Set();
    const nooks = [];
    const open = [];
    const onPath = new Set(room.mainPath.map((c) => cellKey(c.x, c.y)));
    const isEnd = (x, y) => (x === room.start.x && y === room.start.y)
        || (x === room.goal.x && y === room.goal.y);
    const floor = (x, y) => inInterior(room, x, y) && room.floorAt(x, y);
    for (let y = 1; y < room.height - 1; y += 1) {
        for (let x = 1; x < room.width - 1; x += 1) {
            /** ⛓ (i) — off the path. */
            if (!floor(x, y) || isEnd(x, y) || onPath.has(cellKey(x, y))) continue;
            seen.add('no-loot-cell');
            /** ⛓ (ii) — the stance, strictly below. */
            const s = Object.freeze({ x, y: y + 1 });
            if (!floor(s.x, s.y) || isEnd(s.x, s.y)) {
                seen.add('the-stance-is-not-floor');
                continue;
            }
            /** ⛓ (iii) — the stance is reached without the chest AND without the goal: the
             *  chest is opened FIRST (it is the certification's first goal), and a walk
             *  through the goal cell would take the goal on the way. */
            const startSide = reachableFrom(room.width, room.height,
                (cx, cy) => room.floorAt(cx, cy) && !(cx === x && cy === y)
                    && !(cx === room.goal.x && cy === room.goal.y), room.start);
            if (!startSide.has(cellKey(s.x, s.y))) {
                seen.add('the-chest-walls-off-its-stance');
                continue;
            }
            const chest = Object.freeze({ x, y });
            const others = NB4.filter(([dx, dy]) => !(dx === 0 && dy === 1)
                && room.floorAt(x + dx, y + dy)).length;
            (others <= 1 ? nooks : open).push(Object.freeze({ chest, stance: s, others }));
        }
    }
    const ok = nooks.length > 0 ? nooks : open;
    if (ok.length === 0) {
        const reason = CHEST_LOOT_REFUSALS.filter((r) => seen.has(r)).pop() ?? 'no-loot-cell';
        return { refused: { reason,
            detail: `no floor cell off the ${room.mainPath.length}-cell main path can hold a LOOT `
                + `CHEST: the deepest stage any cell reached was "${reason}". ⛓ A chest opens from `
                + 'the one-pixel line BELOW it, so the cell under the chest must be floor the start '
                + 'reaches with the chest standing; a loot chest never stands on the main path and '
                + 'never carves.' } };
    }
    return { candidates: Object.freeze(ok), nooks: nooks.length > 0 };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count, nooks) {
    return {
        /** ⛔ No tiles: a loot chest writes no terrain (rule (ii)). */
        tiles: [],
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [{ x: pick.chest.x, y: pick.chest.y, id: CHEST_LOOT_CHEST_ID }],
            items: [],
        },
        doorCells: [{ x: pick.chest.x, y: pick.chest.y }],
        clearer: [{ x: pick.stance.x, y: pick.stance.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: 0,
            carved: 0,
            candidates: count,
            nook: nooks ? 1 : 0,
        },
    };
}

/** The placement shape: ONE chest, its stance directly BELOW it, no terrain. */
export function assertChestLootPlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    if (obstacles.length !== 1 || obstacles[0].id !== CHEST_LOOT_CHEST_ID) {
        fail(`chestLoot: the element is exactly ONE chest (${CHEST_LOOT_CHEST_ID}) — got `
            + `${JSON.stringify(obstacles.map((o) => o.id))}.`);
    }
    const [chest] = obstacles;
    const cells = placement.doorCells;
    if (cells.length !== 1 || cells[0].x !== chest.x || cells[0].y !== chest.y) {
        fail('chestLoot: `doorCells` must be exactly the chest\'s cell.');
    }
    if (placement.clearer.length !== 1) {
        fail('chestLoot: `clearer` must be exactly ONE cell — the stance below the chest.');
    }
    const [s] = placement.clearer;
    if (s.x !== chest.x || s.y !== chest.y + 1) {
        fail(`chestLoot: the stance (${s.x},${s.y}) is not directly BELOW the chest `
            + `(${chest.x},${chest.y}) — a chest opens only from the line beneath it.`);
    }
    if (placement.tiles.length !== 0) {
        fail('chestLoot: a loot chest writes NO terrain — it decorates the room the connector left.');
    }
}

export const CHEST_LOOT = defineElement({
    name: 'chest-loot',
    family: 'chestloot',
    phase: 'on-connector',
    law: LAW_NONE,
    why: 'A LOOT CHEST standing OFF the main path, opened from the cell directly BELOW it — the '
        + 'game\'s one-pixel trigger line — preferring a nook. It gates nothing; it drops a seal '
        + 'piece (an AP location), and the room is certified only by a plan that opens it.',
    params: [],
    construct: (values, site, rng) => {
        const out = buildChestLoot(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
        return placementOf(rng.pick(out.candidates), out.candidates.length, out.nooks);
    },
    assertPlacement: assertChestLootPlacement,
});
