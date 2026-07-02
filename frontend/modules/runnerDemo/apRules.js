/**
 * Ability ↔ AP item mapping and Rule Builder conversion — the runner
 * side of bounce's apRules.js (plan §4.6; the shared vocabulary is
 * docs/json/developer/procgen/paths-and-obstacles.md).
 *
 * The verifier (deriveRules.js) speaks ability names; rules.json
 * speaks AP item names and Rule Builder JSON. The name table itself
 * lives in gameCore.js (the game runtime maps received items back to
 * abilities with the same table) and is IMPORTED here, not redefined —
 * re-exported so rule-emission consumers (the phase-7 registry entry)
 * have one import site.
 *
 * This module also hosts the registry-declared item/obstacle libraries
 * (RUNNER_LIBRARY_ITEMS / RUNNER_LIBRARY_OBSTACLES). Bounce keeps them
 * in its registry-entry file; runner's registry entry lands in phase 7
 * and will import them from here.
 */

import { makeHasRule, makeAndRule, makeOrRule } from '../shared/rulesJsonBuilder.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './gameCore.js';

export { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME };

// ability id -> stable physics-obstacle id (the obstacles-along-paths
// vocabulary). This id is the THROUGH-LINE that ties the gate template
// (generator.js gap kinds), the verifier's minimal sets, and the
// emitted path together — bounce's `bounce_gate_<ability>` convention.
export const RUNNER_OBSTACLE_ID_BY_ABILITY = Object.freeze(Object.fromEntries(
    Object.keys(ABILITY_ITEM_NAMES).map((ability) => [ability, `runner_gate_${ability}`])));

/**
 * Registry-declared item library: runner's ability items + Victory in
 * the shared-library entry shape (merged with DEFAULT_ITEMS by the
 * pipeline UI). Ids ARE the AP item names; rules.json item names come
 * out verbatim.
 */
export const RUNNER_LIBRARY_ITEMS = Object.freeze(Object.fromEntries([
    ['Double Jump', '#9a6ff0'],
    ['Blue Platforms', '#4080d0'],
].map(([name, color]) => [name, {
    id: name,
    name,
    classification: 'progression',
    color,
    symbol: 'star',
    feature: 'runner_abilities',
}]).concat([[VICTORY_ITEM_NAME, {
    id: VICTORY_ITEM_NAME,
    name: VICTORY_ITEM_NAME,
    classification: 'progression',
    color: '#f5d020',
    symbol: 'star',
    feature: 'runner_abilities',
    is_victory: true,
}]])));

/**
 * Registry-declared OBSTACLE library — the runner side of the
 * obstacles-along-paths vocabulary. One obstacle per ability: "this
 * path crosses the double-jump gap" compiles (via
 * shared/procgen/pathsAndObstaclesCompiler.js) to has("Double Jump").
 * Merged with DEFAULT_OBSTACLES by the consumer.
 *
 * These are the PHYSICS obstacles: each is a combo_list cleared by its
 * single ability item ([[itemName]]). Non-physics gates (foreign
 * items, count > 1) are NOT in this table — they become per-instance
 * `logic_gate` obstacles with an arbitrary clear_rule (see
 * emitObstaclePaths), so physics-first / gate-fallback is one
 * mechanism.
 *
 * Obstacle ids are stable identifiers (`runner_gate_<ability>`), NOT
 * AP item names; each clear_set references the AP item name (runner
 * item ids === AP item names). `runner_ability` back-references the
 * ability id so consumers (and verifyObstacles.js) can map a required
 * ability -> its obstacle id. Derived from ABILITY_ITEM_NAMES so the
 * vocabulary can't drift out of sync with the ability set.
 */
const RUNNER_OBSTACLE_PRESENTATION = Object.freeze({
    doubleJump: { name: 'Double Jump Gap', color: '#9a6ff0' },
    blue: { name: 'Blue Platform Gap', color: '#4080d0' },
});

export const RUNNER_LIBRARY_OBSTACLES = Object.freeze(Object.fromEntries(
    Object.entries(ABILITY_ITEM_NAMES).map(([ability, itemName]) => {
        const id = RUNNER_OBSTACLE_ID_BY_ABILITY[ability];
        const pres = RUNNER_OBSTACLE_PRESENTATION[ability] ?? {};
        return [id, {
            id,
            name: pres.name ?? `${itemName} Gate`,
            clear_set_type: 'combo_list',
            clear_set: [[itemName]],
            color: pres.color ?? '#b06eb8',
            feature: 'runner_abilities',
            runner_ability: ability,
        }];
    })));

/** Stable per-instance logic-gate obstacle id for an authored term
 *  ({ item, count }). Slugged so two goals gating on the same term share
 *  one obstacle def; the count rides the id so Has(x,2) != Has(x,1). */
function authoredObstacleId({ item, count }) {
    const slug = String(item).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return (count ?? 1) > 1 ? `runner_logic_${slug}__x${count}` : `runner_logic_${slug}`;
}

/**
 * Emit a goal's access in the shared paths-and-obstacles vocabulary
 * — the obstacle-reasoning counterpart of composeAuthoredRule. The
 * physics-derived minimal ability sets become OR-of-paths of physics
 * obstacle ids, and authored terms (foreign items, count > 1) become
 * per-term `logic_gate` obstacles ANDed onto EVERY path —
 * physics-first, logic_gate fallback.
 *
 *   minimalSets []   (unreachable) -> paths []                -> compiler False_
 *   minimalSets [[]] (always)      -> one empty-obstacle path -> compiler True_
 *
 * Faithfulness (bounce's contract, asserted by verifyObstacles.js and
 * the unit tests): `compileAccessRule(paths, lib)` reproduces
 * `composeAuthoredRule(minimalSetsToRule(sets), authored)` byte-for-byte
 * for every shape the runner generator produces — single physics set,
 * pure-authored (True_ physics), and multi-set with no authored. (The
 * lone structural divergence — multi-ability physics AND authored, which
 * distributes flat here vs nests there — is logically identical and never
 * generated, since a verified runner goal derives a single minimal set.)
 *
 * @returns {{ paths: Array, authoredDefs: Object }} authoredDefs holds
 *   only the per-instance logic_gate defs; the physics obstacle ids
 *   reference RUNNER_LIBRARY_OBSTACLES above.
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
            feature: 'runner_abilities',
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
                const id = RUNNER_OBSTACLE_ID_BY_ABILITY[ability];
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
 *   []                -> False_  (unreachable — callers should treat as a defect)
 *   [[]]              -> True_   (always reachable)
 *   [['doubleJump']]  -> Has("Double Jump")
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
 * the rule-gated portals/pickups composition: emitted rule = physics
 * requirement AND authored rule. `authoredTerms` is [{ item, count }]
 * in AP item names (anything the physics can't realise: non-ability
 * items like keys, and count > 1 instances of any item). Empty terms
 * return `physicsRule` UNCHANGED, so worlds without authored gates
 * emit byte-identical rules.
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
