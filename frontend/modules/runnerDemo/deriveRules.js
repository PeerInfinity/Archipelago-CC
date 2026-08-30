/**
 * Runner derive-rules verifier (plan §4.4; a direct port of the shape
 * of bounceDemo/deriveRules.js).
 *
 * Runs reachability under every subset of the level's relevant ability
 * universe and derives, per goal, the MINIMAL ability sets that make
 * it reachable. Goals are pickups and portals only:
 *
 * - PICKUPS and PORTALS sit in the auto-run wake of their host
 *   platform (the goal-wake invariant, level.js), so goal reachable ⇔
 *   host platform TOUCH-reachable. Touch-reach — not launch-reach — is
 *   the right relation here: any landing on the host crosses its wake
 *   goals even when the player dies right after, so a pickup at a
 *   doomed pre-gate floor's edge (the item-before-the-gate pattern)
 *   derives its true requirement instead of circularly requiring the
 *   gate's own item. `reachablePlatforms` (canRun.js) already IS that
 *   relation: a flood over chainable LAUNCH edges plus one TOUCH step
 *   out of every launchable node.
 * - Plain platforms are NOT goals: normal play skips platforms, and a
 *   level with unreachable decorative platforms is fine. Only pickup
 *   hosts and exit hosts must be reachable.
 *
 * The verifier also checks MONOTONICITY: Archipelago access rules mean
 * "has these items ⇒ accessible", so gaining an item must never make a
 * goal unreachable. Unlike bounce (where an unlocked platform can
 * intercept an automatic flight), runner is monotone BY CONSTRUCTION
 * (plan §3): jumps are voluntary, gated platforms are one-way with
 * drop-through, hazards are non-solid. The check is kept as the
 * design's tripwire — it should never fire, and a violation is a
 * generator/vocabulary defect (e.g. a SOLID gated platform blocking a
 * corridor), not repairable at rule-emission time.
 */

import { DEFAULTS } from './physics.js';
import { activePlatforms, platformGate, effectiveParams } from './suppression.js';
import { buildRunGraph, reachablePlatforms } from './canRun.js';

/**
 * Default reachability: build the full N² launch/touch graph and
 * flood. Sound for any level under any ability set. `reachabilityTable`
 * takes this as an injectable `opts.reach` so strips can swap in the
 * cheaper left-to-right layered flood (`reachableRunPlatforms`, which
 * is verdict-identical on AUTO_RUN levels — canRun.js).
 */
function fullGraphReach(level, abilities, opts) {
    return reachablePlatforms(buildRunGraph(level, abilities, opts));
}

const ALL_ABILITIES = ['doubleJump', 'blue', 'spring', 'glide', 'shield'];

/**
 * The abilities that can possibly matter for this level: movement
 * abilities always (any gap could need Double Jump — the analog of
 * bounce's always-on arrows); platform-existence gates only when the
 * level contains a platform gated on them; the Shield (a params
 * overlay like doubleJump, but on the death threshold — §4.10) only
 * when the level contains a budgeted `bed` hazard — on bed-free
 * levels a hit budget can change nothing the verifier derives
 * (ordinary hazards are avoidable by construction: spike hops, tap
 * arcs, off-corridor saws), so the universe stays small there, the
 * glide precedent. Small (≤ ~5 in v1).
 */
export function abilityUniverse(level) {
    const universe = ['doubleJump'];
    for (const p of level.platforms) {
        const gate = platformGate(p);
        if (gate && !universe.includes(gate)) universe.push(gate);
    }
    if ((level.hazards ?? []).some((hz) => hz.type === 'bed')) {
        universe.push('shield');
    }
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
 * universe. Returns `{ universe, table: Map<setKey, { names,
 * platforms, pickups, exits }> }`.
 *
 * Subsets with identical *effective* level (same active platforms AND
 * same effective physics params — the two gating mechanisms,
 * suppression.js) share one evaluation.
 */
export function reachabilityTable(level, opts = {}) {
    // freeAbilities are ALWAYS held (a starting / locked item the player is
    // guaranteed to have): excluded from the iterated universe and forced
    // true in every subset, so they never appear in a derived requirement
    // (a goal needing only a free ability derives []). Unused in v1 — the
    // runner has no free starting item — kept for parity with bounce and
    // for future Brake/Left starting-inventory cases.
    const freeAbilities = opts.freeAbilities ?? [];
    const universe = (opts.universe ?? abilityUniverse(level))
        .filter((a) => !freeAbilities.includes(a));
    const reach = opts.reach ?? fullGraphReach;
    const C = opts.constants ?? DEFAULTS;
    const table = new Map();
    const bySignature = new Map();

    for (let mask = 0; mask < (1 << universe.length); mask++) {
        const names = universe.filter((_, i) => mask & (1 << i));
        const abilities = abilitySetOf([...names, ...freeAbilities]);
        const signature = JSON.stringify({
            platforms: activePlatforms(level, abilities).map((p) => p.id),
            params: effectiveParams(C, abilities),
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
 *     platforms: { [id]: { ... } },   // only when opts.includePlatforms
 *     defects: [strings],   // unreachable goals + monotonicity breaks
 *   }
 *
 * `opts.includePlatforms` adds the SAME minimal-set analysis for EVERY
 * platform (not just goal hosts) — the per-segment "items required to
 * reach this platform" data the region report/editor surfaces. It
 * reuses the reachability table already built for the goals
 * (goalAnalysis is generic over the row field), so it costs only one
 * extra goalAnalysis per platform; it is OFF by default so the
 * per-attempt verification path never pays for it.
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
    if (opts.includePlatforms) {
        result.platforms = {};
        for (const p of level.platforms ?? []) {
            const a = goalAnalysis(table, 'platforms', p.id);
            a.reachableUnderFull = fullRow.platforms.has(p.id);
            result.platforms[p.id] = a;
        }
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

/** Human-readable rule, e.g. "(doubleJump) OR (blue)". */
export function formatRule(minimalSets) {
    if (minimalSets.length === 0) return 'IMPOSSIBLE';
    if (minimalSets.some((s) => s.length === 0)) return 'ALWAYS';
    return minimalSets
        .map((s) => `(${s.join(' AND ')})`)
        .join(' OR ');
}
