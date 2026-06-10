/**
 * Ability ↔ AP item mapping and Rule Builder conversion — build-order
 * step 5 (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * The verifier (deriveRules.js) speaks ability names; rules.json
 * speaks AP item names and Rule Builder JSON. This is the only place
 * the mapping lives.
 */

import { makeHasRule, makeAndRule, makeOrRule } from '../shared/rulesJsonBuilder.js';

export const ABILITY_ITEM_NAMES = Object.freeze({
    left: 'Left arrow',
    right: 'Right arrow',
    springs: 'Springs',
    jetpacks: 'Jetpacks',
    blue: 'Blue platforms',
    brown: 'Brown platforms',
});

export const VICTORY_ITEM_NAME = 'Victory';

/**
 * Convert the verifier's minimal ability sets into one Rule Builder
 * rule: OR over minimal sets, AND over each set's items.
 *   []           -> False_  (unreachable — callers should treat as a defect)
 *   [[]]         -> True_   (always reachable)
 *   [['springs']] -> Has("Springs")
 */
export function minimalSetsToRule(minimalSets) {
    if (minimalSets.length === 0) return { rule: 'False_' };
    return makeOrRule(minimalSets.map((set) =>
        makeAndRule(set.map((ability) => {
            const itemName = ABILITY_ITEM_NAMES[ability];
            if (!itemName) throw new Error(`minimalSetsToRule: unknown ability '${ability}'`);
            return makeHasRule(itemName);
        }))));
}
