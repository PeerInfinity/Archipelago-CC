/**
 * Bounce Demo derive-rules verifier — build-order step 4
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * Runs reachability under every subset of the level's relevant ability
 * universe and derives, per goal, the MINIMAL ability sets that make
 * it reachable. Goals are pickups and portals only:
 *
 * - A PICKUP is reachable iff its host platform is reachable
 *   (landing-collection semantics — physics.simulate).
 * - A PORTAL is reachable iff some reachable platform can launch a
 *   trajectory through it (∀ arrival x0, ∃ policy — same conservative
 *   shape as canJump).
 * - Plain platforms are NOT goals: normal play skips platforms, and a
 *   level with unreachable decorative platforms is fine. Only pickup
 *   hosts and exits must be reachable.
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
import {
    ENTRANCE,
    jumpQuery,
    policiesFor,
    buildPlatformGraph,
} from './canJump.js';

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
 * Canonical arrivals: where the player actually lands on each
 * reachable platform when following witnessed jumps from the entrance
 * (BFS over the possible-jump graph, simulating each hop). This is the
 * arrival set the portal check quantifies over — quantifying over the
 * full launch span instead is wrong: a no-arrows player's play is
 * deterministic, so positions the chain never produces cannot occur
 * (the bounce stack's exit would falsely demand arrows).
 *
 * Returns Map<platformId, arrivalX>. A platform whose canonical hops
 * all fail simply gets no arrival (conservative: it then can't witness
 * a portal).
 */
function canonicalArrivals(level, graph, abilities, opts) {
    const arrivals = new Map();
    const queue = [[ENTRANCE, undefined]]; // [node, arrival x]
    while (queue.length > 0) {
        const [node, x0] = queue.shift();
        for (const target of graph.edges.get(node) ?? []) {
            if (arrivals.has(target)) continue;
            const to = level.platforms.find((p) => p.id === target);
            for (const policy of policiesFor(to.x, abilities)) {
                const r = jumpQuery(level, node, abilities, { ...opts, x0, policy: policy.fn });
                if (r.landedOn === target) {
                    arrivals.set(target, r.landing.x);
                    queue.push([target, r.landing.x]);
                    break;
                }
            }
        }
    }
    return arrivals;
}

/** ∃ policy whose jump from (`platformId`, arrival x) touches `portal`. */
function canTouchPortalFrom(level, platformId, x0, portal, abilities, opts) {
    return policiesFor(portal.x, abilities).some((p) =>
        jumpQuery(level, platformId, abilities, { ...opts, x0, policy: p.fn })
            .portalsTouched.includes(portal.id));
}

/**
 * Reachability of every goal under every subset of the ability
 * universe. Returns `Map<setKey, { names, platforms, pickups, exits }>`.
 *
 * Subsets with identical *effective* geometry (same active platforms,
 * same allowed arrows, same active boosters) share one evaluation.
 */
export function reachabilityTable(level, opts = {}) {
    const universe = opts.universe ?? abilityUniverse(level);
    const table = new Map();
    const bySignature = new Map();

    for (let mask = 0; mask < (1 << universe.length); mask++) {
        const names = universe.filter((_, i) => mask & (1 << i));
        const abilities = abilitySetOf(names);
        const signature = JSON.stringify({
            platforms: activePlatforms(level, abilities).map((p) => p.id),
            left: abilities.left,
            right: abilities.right,
            springs: abilities.springs,
            jetpacks: abilities.jetpacks,
        });

        let entry = bySignature.get(signature);
        if (!entry) {
            const graph = buildPlatformGraph(level, abilities, opts);
            const arrivals = canonicalArrivals(level, graph, abilities, opts);
            const platforms = new Set(arrivals.keys());
            const pickups = new Set((level.pickups ?? [])
                .filter((pk) => platforms.has(pk.on))
                .map((pk) => pk.id));
            const exits = new Set((level.portals ?? [])
                .filter((pt) => [...arrivals].some(([pid, x0]) =>
                    canTouchPortalFrom(level, pid, x0, pt, abilities, opts)))
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

/** Human-readable rule, e.g. "(springs) OR (blue AND left)". */
export function formatRule(minimalSets) {
    if (minimalSets.length === 0) return 'IMPOSSIBLE';
    if (minimalSets.some((s) => s.length === 0)) return 'ALWAYS';
    return minimalSets
        .map((s) => `(${s.join(' AND ')})`)
        .join(' OR ');
}
