/**
 * Bounce Demo derive-rules verifier — build-order step 4
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * Runs reachability under every subset of the level's relevant ability
 * universe and derives, per goal, the MINIMAL ability sets that make
 * it reachable. Goals are pickups and portals only:
 *
 * - PICKUPS and PORTALS are both landing-triggered on their host
 *   platform (physics.simulate), so goal reachable ⇔ host platform
 *   reachable. (An earlier positional-portal design needed trajectory
 *   checks quantified over canonical arrival positions; landing-entry
 *   made all of that unnecessary.)
 * - Plain platforms are NOT goals: normal play skips platforms, and a
 *   level with unreachable decorative platforms is fine. Only pickup
 *   hosts and exit hosts must be reachable.
 *
 * The verifier also checks MONOTONICITY: Archipelago access rules mean
 * "has these items ⇒ accessible", so gaining an item must never make a
 * goal unreachable. Unlock-by-suppression can violate this — an
 * unlocked blue/brown platform can INTERCEPT a boosted launch that
 * previously sailed past it (landing happens on the highest platform
 * crossed while falling). Violations are reported as defects the
 * generator must design away; they are not repairable at rule-emission
 * time.
 */

import { activePlatforms } from './suppression.js';
import { buildPlatformGraph, reachablePlatforms, reachableBraidPlatforms } from './canJump.js';

/**
 * Default reachability: build the full N² edge graph and flood. Sound for
 * any level under any ability set. `reachabilityTable` takes this as an
 * injectable `opts.reach` so braids can swap in the cheaper row-aware flood.
 */
function fullGraphReach(level, abilities, opts) {
    return reachablePlatforms(buildPlatformGraph(level, abilities, opts));
}

const ALL_ABILITIES = ['left', 'right', 'springs', 'jetpacks', 'blue', 'brown'];

/**
 * The abilities that can possibly matter for this level: arrows
 * always; springs/jetpacks/blue/brown only when the level contains the
 * corresponding geometry.
 */
export function abilityUniverse(level) {
    const universe = ['left', 'right'];
    if ((level.springs ?? []).length > 0) universe.push('springs');
    if ((level.jetpacks ?? []).length > 0) universe.push('jetpacks');
    const types = new Set(level.platforms.map((p) => p.type));
    if (types.has('blue')) universe.push('blue');
    if (types.has('brown')) universe.push('brown');
    return universe;
}

function abilitySetOf(names) {
    const a = {};
    for (const n of ALL_ABILITIES) a[n] = false;
    for (const n of names) a[n] = true;
    return a;
}

const setKey = (names) => [...names].sort().join('+') || '(none)';

/**
 * Reachability of every goal under every subset of the ability
 * universe. Returns `Map<setKey, { names, platforms, pickups, exits }>`.
 *
 * Subsets with identical *effective* geometry (same active platforms,
 * same allowed arrows, same active boosters) share one evaluation.
 */
export function reachabilityTable(level, opts = {}) {
    // freeAbilities are ALWAYS held (a starting / locked item the player is
    // guaranteed to have — e.g. the braid's free starting arrow): excluded from
    // the iterated universe and forced true in every subset, so they never
    // appear in a derived requirement (a goal needing only a free ability
    // derives []). The grower never gates on them, so this matches.
    const freeAbilities = opts.freeAbilities ?? [];
    const universe = (opts.universe ?? abilityUniverse(level))
        .filter((a) => !freeAbilities.includes(a));
    const reach = opts.reach ?? fullGraphReach;
    const table = new Map();
    const bySignature = new Map();

    for (let mask = 0; mask < (1 << universe.length); mask++) {
        const names = universe.filter((_, i) => mask & (1 << i));
        const abilities = abilitySetOf([...names, ...freeAbilities]);
        const signature = JSON.stringify({
            platforms: activePlatforms(level, abilities).map((p) => p.id),
            left: abilities.left,
            right: abilities.right,
            springs: abilities.springs,
            jetpacks: abilities.jetpacks,
        });

        let entry = bySignature.get(signature);
        if (!entry) {
            const platforms = reach(level, abilities, opts);
            const pickups = new Set((level.pickups ?? [])
                .filter((pk) => platforms.has(pk.on))
                .map((pk) => pk.id));
            const exits = new Set((level.portals ?? [])
                .filter((pt) => platforms.has(pt.on))
                .map((pt) => pt.id));
            entry = { platforms, pickups, exits };
            bySignature.set(signature, entry);
        }
        table.set(setKey(names), { names, ...entry });
    }
    return { universe, table };
}

const isSubset = (a, b) => a.every((n) => b.includes(n));

function goalAnalysis(table, kind, id) {
    const reachableSets = [];
    const unreachableSets = [];
    for (const { names, [kind]: goals } of table.values()) {
        (goals.has(id) ? reachableSets : unreachableSets).push(names);
    }
    // minimal = reachable with no reachable proper subset (set contents
    // are unique per table row, so proper subset ⇔ subset + shorter)
    const minimalSets = reachableSets.filter((s) =>
        !reachableSets.some((t) => t.length < s.length && isSubset(t, s)));
    const violations = [];
    for (const s of reachableSets) {
        for (const t of unreachableSets) {
            if (s.length < t.length && isSubset(s, t)) {
                violations.push({ subset: setKey(s), superset: setKey(t) });
            }
        }
    }
    return { minimalSets: minimalSets.map((s) => [...s].sort()), violations };
}

/**
 * Derive per-goal access information for a level:
 *   {
 *     universe,
 *     pickups: { [id]: { minimalSets, reachableUnderFull, violations } },
 *     exits:   { [id]: { ... } },
 *     defects: [strings],   // unreachable goals + monotonicity breaks
 *   }
 */
export function deriveAccessRules(level, opts = {}) {
    const { universe, table } = reachabilityTable(level, opts);
    const fullRow = table.get(setKey(universe));

    const result = { universe, pickups: {}, exits: {}, defects: [] };
    for (const pk of level.pickups ?? []) {
        const a = goalAnalysis(table, 'pickups', pk.id);
        a.reachableUnderFull = fullRow.pickups.has(pk.id);
        result.pickups[pk.id] = a;
    }
    for (const pt of level.portals ?? []) {
        const a = goalAnalysis(table, 'exits', pt.id);
        a.reachableUnderFull = fullRow.exits.has(pt.id);
        result.exits[pt.id] = a;
    }

    for (const [kind, goals] of [['pickup', result.pickups], ['exit', result.exits]]) {
        for (const [id, a] of Object.entries(goals)) {
            if (a.minimalSets.length === 0) {
                result.defects.push(`${kind} '${id}': unreachable under every ability set`);
            }
            for (const v of a.violations) {
                result.defects.push(`${kind} '${id}': NON-MONOTONE — reachable with`
                    + ` {${v.subset}} but not with {${v.superset}}`);
            }
        }
    }
    return result;
}

/**
 * Braid-specific derive: the per-subset minimal-set table over the cheap
 * row-aware flood (`reachableBraidPlatforms`) instead of the full N² graph.
 *
 * CORRECTNESS PRECONDITION — fork-free braids. The row-aware flood walks
 * adjacent rows upward, so it is verdict-identical to the full solver only
 * when down/within-row edges are redundant for reaching every goal: i.e. a
 * single climbable platform per row (Regime-2 geometry; terminal teleport
 * hosts don't count). On Regime-1 FORK levels under PARTIAL abilities the
 * full solver reaches extra platforms via fall/within-row-wrap edges, so the
 * two intentionally diverge there — Regime 1 verifies under FULL abilities
 * only (a single `reachableBraidPlatforms` query, see generator.js), where
 * they agree.
 *
 * Where they do differ, the row-aware result can only OVER-state a goal's
 * requirement (miss a fall route), which is the safe direction for AP rules
 * (pessimistic; never claims reachable-when-not).
 */
export function deriveBraidAccessRules(level, opts = {}) {
    // freeArrow (the held starting arrow): treated as always-available, so a
    // portal on a tip offset TOWARD it still derives its gate set, not [arrow].
    // terminalPortals: portal hosts never launch (you exit / bounce off, you
    // don't climb on) — so an offset portal tip can't leak a skip route; the
    // straight bypass carries the climb. Both default OFF, so callers that don't
    // pass them (and the column path) are unaffected.
    const freeAbilities = opts.freeArrow
        ? [...new Set([...(opts.freeAbilities ?? []), opts.freeArrow])]
        : (opts.freeAbilities ?? []);
    return deriveAccessRules(level, {
        ...opts, reach: reachableBraidPlatforms, freeAbilities,
    });
}

/** Human-readable rule, e.g. "(springs) OR (blue AND left)". */
export function formatRule(minimalSets) {
    if (minimalSets.length === 0) return 'IMPOSSIBLE';
    if (minimalSets.some((s) => s.length === 0)) return 'ALWAYS';
    return minimalSets
        .map((s) => `(${s.join(' AND ')})`)
        .join(' OR ');
}
