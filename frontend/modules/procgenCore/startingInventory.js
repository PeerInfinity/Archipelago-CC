/**
 * procgenCore/startingInventory — **WHAT A SUBSTRATE NEEDS IN THE STARTING
 * INVENTORY, READ OFF ITS REGISTRY ENTRY** (APWORLD SUBSTRATE CHANGE R3; the
 * substrate-change plan §9.2, ⚖ user 2026-09-23: *"register the requirement
 * for the initial arrow key in the substrate registry"*).
 *
 * The slot is DATA on an entry, optional:
 *
 *     startingInventory: { needs: [{ anyOf: ['Left arrow', 'Right arrow'], reason: '…' }] }
 *
 * — each need is met when the starting list holds ANY one of `anyOf`. An entry
 * without the slot needs nothing. The APWorld editor's Starting inventory block
 * draws the needs of every substrate present in a slot's sidecars, with a grant
 * per candidate; the Region generation form draws the target's.
 *
 * ⛔ Names no substrate and no item: every name comes from the entry.
 */

/** ⛓ The registry slot's key. */
export const STARTING_INVENTORY_SLOT = 'startingInventory';

/**
 * ⛓ What is wrong with an entry's declaration — `[]` when it is absent or well
 * formed. A need is `{anyOf: non-empty string[], reason: non-empty string}`.
 */
export function startingInventoryErrors(entry) {
    const decl = entry?.[STARTING_INVENTORY_SLOT];
    if (decl === undefined) return [];
    const errs = [];
    if (!decl || typeof decl !== 'object' || !Array.isArray(decl.needs)) {
        return [`\`${STARTING_INVENTORY_SLOT}\` is {needs: [...]}, got ${JSON.stringify(decl)}`];
    }
    decl.needs.forEach((n, i) => {
        if (!Array.isArray(n?.anyOf) || !n.anyOf.length || !n.anyOf.every((x) => typeof x === 'string' && x)) {
            errs.push(`need ${i}: \`anyOf\` is a non-empty list of item names`);
        }
        if (typeof n?.reason !== 'string' || !n.reason) errs.push(`need ${i}: \`reason\` is a sentence`);
    });
    return errs;
}

/** ⛓ The entry's declared needs, or `[]` (absent or malformed — `startingInventoryErrors` says which). */
export function declaredStartingNeeds(entry) {
    return startingInventoryErrors(entry).length ? [] : (entry?.[STARTING_INVENTORY_SLOT]?.needs ?? []);
}

/**
 * ⛓⛓ **THE ENTRY'S NEEDS, AGAINST A STARTING LIST.**
 *
 * @param {object} entry a registry entry
 * @param {string[]} starting the slot's `starting_items` (a multiset of names)
 * @returns {Array<{anyOf: string[], reason: string, met: boolean, heldName: string|null}>}
 *   `heldName` = the first of `anyOf` (in declared order) the list holds
 */
export function startingInventoryNeeds(entry, starting) {
    const held = new Set((starting ?? []).filter((n) => typeof n === 'string'));
    return declaredStartingNeeds(entry).map((n) => {
        const heldName = n.anyOf.find((x) => held.has(x)) ?? null;
        return { anyOf: [...n.anyOf], reason: n.reason, met: heldName !== null, heldName };
    });
}
