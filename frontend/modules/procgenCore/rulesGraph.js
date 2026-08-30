// frontend/modules/procgenCore/rulesGraph.js
//
// THE walker over a rules.json document's region/exit/location graph — the one
// §15 D7 says did not exist. Before this module there were sixteen production
// sites and ~twenty more in scripts/procgen, each opening its own
// `Object.entries(doc.regions[playerId] ?? {})` loop, and `start_regions` was
// read FIVE different ways.
//
// ⛔ THIS MODULE IS STRUCTURAL AND KNOWS NO RULE LOGIC. `reachableRegions`
// takes its `evaluate` as a PARAMETER because seven rule interpreters exist in
// this repo (§15 D5: ruleBuilderEvaluator, regionAtlasPool, ruleRequirements,
// two byte-identical verifyObstacles, pathAnalyzerLogic, jtaBalance/hostGlue)
// and the core commits to none of them. See `reachableRegions` for what the
// answer means when `evaluate` is absent.
//
// ⛓ THE TWO SHAPES OF `start_regions`, and why the reader is not optional.
// Every rules.json COMMITTED to this repository uses the OBJECT shape,
// `{"1": {default: […], available: […]}}`. The ARRAY shape, `{"1": […]}`,
// lives only in test fixtures (procgenPlayer/index.test.js:75) — but four
// production readers handled both, two handled only one, and
// `apworldEditor/rulesUtils.js:171` read the array shape as "no start region"
// and emitted a false warning for it. `startRegionsOf` is the ONE reader; it
// returns a frozen `{default, available}` from either shape and NEVER puts a
// raw object into an array-named field (which is the defect
// `stateManager/core/initialization.js:199` still has — out of this slice's
// scope, recorded in the as-built).
//
// `available` has exactly one reader in the whole repo
// (`shared/procgen/forwardSimulator.js`), which is why it is easy to drop by
// accident and is returned here as a first-class field rather than left to the
// caller to remember.

import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';

export { DEFAULT_PLAYER_ID };

const EMPTY_START = Object.freeze({
    default: Object.freeze([]),
    available: Object.freeze([]),
});

const asNameArray = (v) => (Array.isArray(v) ? v.filter((n) => typeof n === 'string' && n) : []);

/**
 * The region map for one player — `{regionName: {name, exits[], locations[]}}`.
 * Always an object, never null, so a caller may iterate it unguarded.
 *
 * @param {object} doc a rules.json document
 * @param {string} [playerId]
 */
export function regionsOf(doc, playerId = DEFAULT_PLAYER_ID) {
    const regions = doc?.regions?.[playerId];
    return (regions && typeof regions === 'object' && !Array.isArray(regions)) ? regions : {};
}

/**
 * `{default: string[], available: string[]}` — FROZEN — from EITHER committed
 * shape (an object with those two fields) or the fixture shape (a bare array,
 * which means `default`). Unknown/absent → both empty.
 *
 * @param {object} doc
 * @param {string} [playerId]
 */
export function startRegionsOf(doc, playerId = DEFAULT_PLAYER_ID) {
    const field = doc?.start_regions?.[playerId];
    if (Array.isArray(field)) {
        return Object.freeze({ default: Object.freeze(asNameArray(field)), available: Object.freeze([]) });
    }
    if (field && typeof field === 'object') {
        return Object.freeze({
            default: Object.freeze(asNameArray(field.default)),
            available: Object.freeze(asNameArray(field.available)),
        });
    }
    return EMPTY_START;
}

/**
 * Visit the STRUCTURAL objects of one player's graph — the region records, the
 * exit records, the location records — in document order.
 *
 * Each visitor is optional and receives `(object, ctx)`:
 *   region   → (region,   {regionName})
 *   exit     → (exit,     {regionName, exitName})
 *   location → (location, {regionName, locationName})
 *
 * ⛔ NOT the rule TREES hanging off those objects — that is `walkRuleTrees`.
 * The two were conflated before this module: `walkRules` (rule trees) was the
 * only named walker, so every caller that wanted the structure hand-rolled it.
 *
 * @param {object} doc
 * @param {string} playerId
 * @param {{region?: Function, exit?: Function, location?: Function}} visitors
 */
export function walkRulesGraph(doc, playerId = DEFAULT_PLAYER_ID, visitors = {}) {
    const { region: onRegion, exit: onExit, location: onLocation } = visitors;
    for (const [regionName, region] of Object.entries(regionsOf(doc, playerId))) {
        if (onRegion) onRegion(region, { regionName });
        if (onExit) {
            for (const exit of region?.exits ?? []) {
                onExit(exit, { regionName, exitName: exit?.name });
            }
        }
        if (onLocation) {
            for (const location of region?.locations ?? []) {
                onLocation(location, { regionName, locationName: location?.name });
            }
        }
    }
}

/**
 * Walk every access/item rule tree in the doc for one player, plus their
 * sub-trees (And/Or children, Compare left/right).
 *
 * This is `apworldEditor/rulesUtils.js`'s `walkRules` LIFTED unchanged — that
 * module re-exports it, so its callers and the rename cascades are untouched.
 *
 * visit(node, ctx) is called once per rule node; ctx says where the rule lives:
 *   { regionName, exitName }                              exit access rules
 *   { regionName, locationName }                          location access rules
 *   { regionName, locationName, fieldName: 'item_rule' }  item rules
 *
 * The callback MAY MUTATE `node` in place (the rename cascades rely on it).
 */
export function walkRuleTrees(doc, playerId = DEFAULT_PLAYER_ID, visit) {
    walkRulesGraph(doc, playerId, {
        exit: (exit, ctx) => walkRuleTree(exit?.access_rule, visit, ctx),
        location: (loc, ctx) => {
            walkRuleTree(loc?.access_rule, visit, ctx);
            if (loc?.item_rule) {
                walkRuleTree(loc.item_rule, visit, { ...ctx, fieldName: 'item_rule' });
            }
        },
    });
}

/**
 * One rule tree, depth first. Unknown rule types are walked for structural
 * children but their args are left untouched — we don't know their reference
 * shape.
 */
export function walkRuleTree(node, visit, ctx) {
    if (!node || typeof node !== 'object') return;
    visit(node, ctx);
    if (Array.isArray(node.children)) {
        for (const child of node.children) walkRuleTree(child, visit, ctx);
    }
    if (node.rule === 'Compare' && node.args) {
        if (node.args.left && typeof node.args.left === 'object') {
            walkRuleTree(node.args.left, visit, ctx);
        }
        if (node.args.right && typeof node.args.right === 'object') {
            walkRuleTree(node.args.right, visit, ctx);
        }
    }
}

/**
 * The set of region names reachable from `startRegionsOf(doc).default`, by BFS
 * over exits whose `evaluate(access_rule, ctx)` is true.
 *
 * ⛔ WHAT THE ANSWER MEANS WITHOUT `evaluate`. Omit it and EVERY edge is free,
 * so the result is the STRUCTURAL answer — "which regions are connected to the
 * start at all" — and NOT the logic one. That is the honest default for a core
 * module that owns no interpreter, and it is useful on its own (an unreachable
 * region is unreachable under every rule set, so a structural failure is a real
 * failure). It is NOT a substitute for a logic reachability check: a region the
 * structural walk reaches may still be gated behind an unobtainable item.
 *
 * `evaluate` is called as `(accessRule, {regionName, exitName})`, and an exit
 * with no `connected_region` is skipped whatever it returns.
 *
 * @returns {Set<string>} names, including the start regions themselves — but
 *   only start names that actually EXIST in `regionsOf` (a `start_regions`
 *   entry naming a missing region is a dangling reference, and pretending it
 *   is reachable would hide it).
 */
export function reachableRegions(doc, playerId = DEFAULT_PLAYER_ID, evaluate = null) {
    const regions = regionsOf(doc, playerId);
    const free = typeof evaluate === 'function' ? evaluate : () => true;
    const seen = new Set();
    const queue = [];
    for (const name of startRegionsOf(doc, playerId).default) {
        if (Object.prototype.hasOwnProperty.call(regions, name) && !seen.has(name)) {
            seen.add(name);
            queue.push(name);
        }
    }
    while (queue.length) {
        const regionName = queue.shift();
        for (const exit of regions[regionName]?.exits ?? []) {
            const dest = exit?.connected_region;
            if (!dest || seen.has(dest)) continue;
            if (!Object.prototype.hasOwnProperty.call(regions, dest)) continue;
            if (!free(exit.access_rule, { regionName, exitName: exit?.name })) continue;
            seen.add(dest);
            queue.push(dest);
        }
    }
    return seen;
}
