/**
 * seedlingDemo/apChestDelivery — **A PLAYTHROUGH AP CHEST, IN THE FORM THE DELIVERY SHIPS IT**
 * (seedling fidelity L25APITEM D1, `CONTACT_FIDELITY.apChestItem`).
 *
 * ⛓ WHAT THE GAME PLAYS. The randomizer's delivered set is `rewriteRecordSet(vanillaRecordSet(mapDoc), table)`
 * (`flashPanel/seedlingRandomizerWiring.js`): every rewritable ledger row's entity is replaced by
 * `{type: 'apitem', x: old.x, y: old.y, attrs: {tag, look}}` (`apPlacementRewriter.rewriteRecordSet`). For a chest
 * the tag is its vanilla `@tag` (`tagSource: 'vanilla'`). On the game that element builds `Pickups/APItem`:
 * `super(_x + Tile.w/2, _y + Tile.h/2, graphic, null, false)` + `setHitbox(8, 8, 4, 4)` (`APItem.as:114-115`) — a
 * Mobile with no `type` (in no solids list), an 8×8 box at the cell's centre, taken on OVERLAP from any side
 * (`Pickup.as:78`, `collide("Player", x, y)`), never through `Chest.update`'s bottom line (`Chest.as:63`).
 *
 * ⛓ WHAT THE MODEL ALREADY DOES. `levelWorld` lists an `apitem` (`world.apItems`, the class row's `apItem` box),
 * `solverBot.resolvePlacement` resolves a `collect-placement` at it as strategy `apitem`, and
 * `apItemTakenOnTick` is the game's contact rule, pinned tick for tick (fidelity F2). So the only gap is the ROOM:
 * the route survey stages the UNREWRITTEN map document, where the chest is still a `Chest` Solid.
 *
 * ⛔ CHESTS ONLY. The delivery rewrites pickups, keys, totem parts and the seed too; this slice models the chest
 * rows (the ones the vanilla rule REFUSES at L25). The rest stay vanilla in the survey (a pickup's ceremony is
 * a tick count, not a refusal) and are named as residue in the L25APITEM report.
 * ⛔ NOT the rewriter. `buildPlacementTable` needs the AP placement (`locationItemOf`) to choose a `look`, which a
 * model does not read; the substitution here is the rewriter's element with `look: 'chest'`, and
 * `apChestDelivery.test.js` pins it equal (type, cell, tag) to the real rewriter's output for every chest row.
 */

import { R7_GOAL_LEDGER } from './r7Acceptance.js';
import { entityForLedgerRow } from './seedlingAtlasDerivation.js';

/** The look a model-side chest apitem carries (the model draws nothing from it). */
export const AP_CHEST_LOOK = 'chest';

/**
 * The ledger's chest rows, resolved to their map-document entity.
 * @param {{levels: Array<{level:number, entities:Array}>}} mapDoc
 * @param {Array<object>} [ledger] the goal ledger (default `R7_GOAL_LEDGER`)
 * @returns {Array<{row: object, level: number, entity: object}>}
 */
export function apChestRows(mapDoc, ledger = R7_GOAL_LEDGER) {
    const byLevel = new Map((mapDoc?.levels ?? []).map((l) => [l.level, l]));
    const out = [];
    for (const row of ledger) {
        if (row.kind !== 'chest') continue;
        const room = byLevel.get(row.level);
        if (!room) continue;
        const { entity } = entityForLedgerRow(room, row);
        if (!entity) {
            throw new Error(`apChestDelivery: ledger row ${row.id} has no chest in level ${row.level} — the `
                + 'delivery would refuse to rewrite it, so a model of it would be a guess');
        }
        out.push({ row, level: row.level, entity });
    }
    return out;
}

/**
 * A copy of `mapDoc` with every ledger chest replaced by the `apitem` the delivery writes in its place. The
 * input is not mutated; every other level and entity is carried over by reference.
 * @param {{levels: Array<{level:number, entities:Array}>}} mapDoc
 * @param {Array<object>} [ledger]
 * @returns {object} the document, with `apChestDelivery: {replaced: [{level, x, y, tag}]}` alongside `levels`
 */
export function deliveredChestDocument(mapDoc, ledger = R7_GOAL_LEDGER) {
    const rows = apChestRows(mapDoc, ledger);
    const wanted = new Map(rows.map((r) => [r.level, r.entity]));
    const replaced = [];
    const levels = mapDoc.levels.map((l) => {
        const chest = wanted.get(l.level);
        if (!chest) return l;
        return {
            ...l,
            entities: l.entities.map((e) => {
                if (e !== chest) return e;
                const tag = e.attrs?.tag;
                if (tag === undefined) {
                    throw new Error(`apChestDelivery: the chest @${e.x},${e.y} in level ${l.level} carries no @tag — `
                        + 'the rewriter would ALLOCATE one, and that allocation is the placement table\'s, not a model\'s');
                }
                replaced.push({ level: l.level, x: e.x, y: e.y, tag: Number(tag) });
                return { type: 'apitem', x: e.x, y: e.y, attrs: { tag: String(tag), look: AP_CHEST_LOOK } };
            }),
        };
    });
    return { ...mapDoc, levels, apChestDelivery: { replaced } };
}
