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

/**
 * AND a goal's AUTHORED gate terms onto its physics-derived rule —
 * the rule-gated portals/pickups composition (sphere-driven growth
 * priority #2): emitted rule = physics requirement AND authored rule.
 * `authoredTerms` is [{ item, count }] in AP item names (anything the
 * physics can't realise: non-ability items like keys, and count > 1
 * instances of any item). Empty terms return `physicsRule` UNCHANGED,
 * so worlds without authored gates emit byte-identical rules.
 */
export function composeAuthoredRule(physicsRule, authoredTerms) {
    if (!authoredTerms || authoredTerms.length === 0) return physicsRule;
    const terms = authoredTerms.map(({ item, count }) => makeHasRule(item, count ?? 1));
    if (physicsRule && physicsRule.rule !== 'True_') {
        return makeAndRule([physicsRule, ...terms]);
    }
    return makeAndRule(terms);
}

/** The authored terms alone as one rule (the bridge-evaluated lock). */
export function authoredTermsToRule(authoredTerms) {
    return makeAndRule(
        (authoredTerms ?? []).map(({ item, count }) => makeHasRule(item, count ?? 1)));
}
