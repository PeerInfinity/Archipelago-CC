/**
 * apworldEditor/startingInventoryBlock — **THE STARTING INVENTORY BLOCK, AS
 * DATA** (APWORLD SUBSTRATE CHANGE R3; the substrate-change plan §9.2, ⚖ user
 * 2026-09-23: *"update the APWorld Editor to have a section for starting
 * inventory"*).
 *
 * One block, two hosts: the top of the **Items** tab (the list, an add control,
 * and the needs of every substrate the slot's sidecars carry) and R2's **Region
 * generation** form (the TARGET substrate's needs, above Generate — where a
 * refusal would land). The panel draws; everything it draws is asked here:
 *
 *   · the list — `starting_items[p]` as `{name, count}` in first-appearance
 *     order (the list is a MULTISET; the per-item Start inputs show the same
 *     counts, both off the one list);
 *   · the needs — each substrate's `startingInventory` declaration, read off its
 *     registry entry (`procgenCore/startingInventory.js`), against the list;
 *   · the grant — ONE `set-starting-count {item, count: current + 1}` op (one
 *     undo), or the op's own refusal when the slot does not define the item.
 *
 * ⛔ Names no substrate and no item.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { startingInventoryNeeds } from '../procgenCore/startingInventory.js';
import { startingItemsOf } from './regionRegenerate.js';
import { startingItemRefusal } from './rulesDocOps.js';

/** ⛓ `starting_items[p]` as `{name, count}`, first appearance first. */
export function startingInventoryList(doc, player) {
    const counts = new Map();
    for (const n of startingItemsOf(doc, player)) counts.set(n, (counts.get(n) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count }));
}

/** ⛓ How many times the list holds `item` — the number the per-item Start input shows. */
export function startingCountOf(doc, player, item) {
    return startingItemsOf(doc, player).filter((n) => n === item).length;
}

/** ⛓ The distinct substrate ids the slot's sidecar entries carry, in entry order. */
export function substratesInSlot(doc, player) {
    const out = [];
    for (const e of Object.values(doc?.preset_sidecars?.[player] ?? {})) {
        const id = e?.substrate;
        if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
    }
    return out;
}

/**
 * ⛓⛓ **THE GRANT** — one op that adds ONE more of `item` to the list:
 * `set-starting-count {item, count: current + 1}`.
 */
export function startingGrantOp(doc, player, item) {
    return { op: 'set-starting-count', player, item, count: startingCountOf(doc, player, item) + 1 };
}

/**
 * ⛓⛓⛓ **THE NEEDS OF `substrateIds`, AGAINST THE SLOT'S LIST.** A substrate
 * whose entry declares no `startingInventory` — or that is not registered here
 * — contributes no row.
 *
 * @returns {Array<{substrate: string, anyOf: string[], reason: string, met: boolean,
 *   heldName: string|null, grants: Array<{item: string, op: object, refusal: string|null}>}>}
 */
export function startingNeedRows(doc, player, substrateIds, registry = substrateRegistry) {
    const starting = startingItemsOf(doc, player);
    const rows = [];
    for (const id of substrateIds ?? []) {
        const entry = registry.get(id);
        if (!entry) continue;
        for (const need of startingInventoryNeeds(entry, starting)) {
            rows.push({
                substrate: id,
                ...need,
                grants: need.anyOf.map((item) => ({
                    item,
                    op: startingGrantOp(doc, player, item),
                    refusal: startingItemRefusal(doc, player, item, 1),
                })),
            });
        }
    }
    return rows;
}

/** ⛓ The clause a met / unmet need line ends with. EXPORTED for the rows. */
export const NEED_NONE_HELD = 'none held';
export const NEED_MET = 'met';

/** ⛓ `` `bounce` needs one of Left arrow / Right arrow — none held `` or `… — met: Right arrow`. */
export function needSentence(row) {
    return `\`${row.substrate}\` needs ${row.anyOf.length > 1 ? 'one of ' : ''}${row.anyOf.join(' / ')} — `
        + `${row.met ? `${NEED_MET}: ${row.heldName}` : NEED_NONE_HELD}`;
}
