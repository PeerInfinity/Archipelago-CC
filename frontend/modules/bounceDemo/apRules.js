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

// ability id -> stable physics-obstacle id (the obstacles-along-paths
// vocabulary, topdown-bounce-obstacle-refactor.md Phase 3). The geometry
// defs (presentation colors) live in bounceDemoLibrary's
// BOUNCE_LIBRARY_OBSTACLES; this id is the THROUGH-LINE that ties the
// obstacle primitive's geometry, the verifier, and the emitted path
// together. Lives here (not bounceDemoLibrary) so the emitter below can
// reference it without a cycle through the registry module.
export const BOUNCE_OBSTACLE_ID_BY_ABILITY = Object.freeze(Object.fromEntries(
    Object.keys(ABILITY_ITEM_NAMES).map((ability) => [ability, `bounce_gate_${ability}`])));

/** Stable per-instance logic-gate obstacle id for an authored term
 *  ({ item, count }). Slugged so two goals gating on the same term share
 *  one obstacle def; the count rides the id so Has(x,2) != Has(x,1). */
function authoredObstacleId({ item, count }) {
    const slug = String(item).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return (count ?? 1) > 1 ? `bounce_logic_${slug}__x${count}` : `bounce_logic_${slug}`;
}

/**
 * Emit a goal's access in the shared paths-and-obstacles vocabulary
 * (topdown-bounce-obstacle-refactor.md Phase 3) — the obstacle-reasoning
 * counterpart of composeAuthoredRule. The physics-derived minimal ability
 * sets become OR-of-paths of physics obstacle ids, and authored terms
 * (foreign items, count > 1) become per-term `logic_gate` obstacles ANDed
 * onto EVERY path — physics-first, logic_gate fallback.
 *
 *   minimalSets []   (unreachable) -> paths []                -> compiler False_
 *   minimalSets [[]] (always)      -> one empty-obstacle path -> compiler True_
 *
 * Faithfulness (asserted by the Phase-3 verifier and the unit tests):
 * `compileAccessRule(paths, lib)` reproduces
 * `composeAuthoredRule(minimalSetsToRule(sets), authored)` byte-for-byte
 * for every shape bounce's generator produces — single physics set,
 * pure-authored (True_ physics), and multi-set with no authored. (The
 * lone structural divergence — multi-ability physics AND authored, which
 * distributes flat here vs nests there — is logically identical and never
 * generated, since a verified bounce goal derives a single minimal set.)
 *
 * @returns {{ paths: Array, authoredDefs: Object }} authoredDefs holds
 *   only the per-instance logic_gate defs; the physics obstacle ids
 *   reference bounceDemoLibrary's BOUNCE_LIBRARY_OBSTACLES.
 */
export function emitObstaclePaths(minimalSets, authoredTerms = []) {
    const authoredDefs = {};
    const authoredIds = (authoredTerms ?? []).map((term) => {
        const id = authoredObstacleId(term);
        const count = term.count ?? 1;
        authoredDefs[id] = {
            id,
            name: `${term.item}${count > 1 ? ` x${count}` : ''} Gate`,
            clear_set_type: 'rule',
            clear_rule: makeHasRule(term.item, count),
            feature: 'bounce_abilities',
        };
        return id;
    });
    const paths = minimalSets.map((set, i) => ({
        path_id: `p${i + 1}`,
        // Mirror minimalSetsToRule's AND order exactly (the verifier emits
        // already-sorted sets): physics obstacles in set order, then the
        // authored gates.
        obstacles: [
            ...set.map((ability) => {
                const id = BOUNCE_OBSTACLE_ID_BY_ABILITY[ability];
                if (!id) throw new Error(`emitObstaclePaths: unknown ability '${ability}'`);
                return id;
            }),
            ...authoredIds,
        ],
    }));
    return { paths, authoredDefs };
}

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
