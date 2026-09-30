/**
 * procgenPipeline/conceptSelection — **THE RULE SELECTS A REALISATION**
 * (concept library T0, D3; plan `concept-library-plan.md` §3).
 *
 * The planner has fixed a rule for a gate. A substrate DECLARES, on its
 * registry entry's `conceptRealisations`, what it can enforce
 * (`procgenCore/concepts.js`). This module is the step between: which of the
 * entry's declared `requires` placements enforce EXACTLY that rule?
 *
 *   `ruleFor(placement, concepts)`     a placement's needs as Rule Builder JSON
 *                                      (`Has`, `Has` with a count, `And`)
 *   `candidatesFor(rule, entry, o)`    the `requires` placements whose needs
 *                                      equal the rule's EXACT requirement —
 *                                      names AND counts
 *   `selectRealisation(rule, entry, o)` one of them, or null
 *   `decorationsFor(entry, o)`         the `helps` / `none` placements, which
 *                                      no rule ever selects
 *
 * ⛔ **NO CANDIDATE IS A VALUE, NOT AN ERROR** (rule 4): null ⇒ the caller does
 * what it does today. An inexact rule (`Or`, a many-item `HasAny`, anything
 * `extractItemRequirementFromRule` reports `exact: false`) has no candidate by
 * construction — no single placement is equivalent to a disjunction.
 *
 * ⛔⛔ **THE DRAW BUDGET.** `offered` is the world's list of concept ids. An
 * empty or absent list returns no candidate and SPENDS NO DRAW; 0 or 1
 * candidate spends no draw; 2+ spend EXACTLY ONE (`rng.choice`, the shared
 * `rng.js` draw). ⇒ every world that lists no concept is byte-identical to
 * what it was before this module existed, by construction.
 *
 * ⛔ Browser-safe and nameless, like `concepts.js` (asserted by its test).
 */

import { EFFECTS, itemIdOfNeed, normaliseNeed } from '../procgenCore/concepts.js';
import { extractItemRequirementFromRule } from './ruleRequirements.js';

/** ⛓ A placement's needs as `[{name, count}]` — the AP names a rule carries. */
export function needsAsItems(placement, concepts) {
    return (placement?.needs ?? []).map((raw) => {
        const n = normaliseNeed(raw);
        return { name: itemIdOfNeed(n?.concept, concepts), count: n?.count ?? 1 };
    });
}

/**
 * ⛓⛓ **A PLACEMENT'S RULE** — Rule Builder JSON. One need is a `Has` (its
 * `count` written only when it is not 1, the spelling the committed presets
 * use); several are an `And` of them, in declared order; none is `True_`.
 */
export function ruleFor(placement, concepts) {
    const has = needsAsItems(placement, concepts).map(({ name, count }) => (count > 1
        ? { rule: 'Has', args: { item_name: name, count } }
        : { rule: 'Has', args: { item_name: name } }));
    if (!has.length) return { rule: 'True_' };
    if (has.length === 1) return has[0];
    return { rule: 'And', children: has };
}

/** ⛓ The rule's exact requirement as a Map name → count, or null when inexact. */
function exactRequirement(rule) {
    const { requirement, counts, exact } = extractItemRequirementFromRule(rule);
    if (!exact) return null;
    return new Map(requirement.map((name) => [name, counts[name] ?? 1]));
}

function sameRequirement(want, placement, concepts) {
    const have = needsAsItems(placement, concepts);
    if (have.length !== want.size) return false;
    return have.every(({ name, count }) => want.has(name) && want.get(name) === count);
}

const offeredSet = (offered) => (Array.isArray(offered) && offered.length ? new Set(offered) : null);

/**
 * ⛓⛓ **THE CANDIDATES** — in the entry's declared order (concept, then
 * placement), each `{concept, placement, effect, needs, tier, art, mechanic}`.
 * Only a concept in `offered` is considered.
 *
 * @param {object} rule Rule Builder JSON
 * @param {object} entry a registry entry (or a test double)
 * @param {{concepts: object, offered?: string[]}} o
 */
export function candidatesFor(rule, entry, { concepts, offered } = {}) {
    const world = offeredSet(offered);
    if (!world) return [];
    const want = exactRequirement(rule);
    if (!want || want.size === 0) return [];
    const out = [];
    for (const [concept, r] of Object.entries(entry?.conceptRealisations ?? {})) {
        if (!world.has(concept)) continue;
        for (const [key, p] of Object.entries(r.placements ?? {})) {
            if (p.effect !== EFFECTS.REQUIRES) continue;
            if (!sameRequirement(want, p, concepts)) continue;
            out.push({
                concept, placement: key, effect: p.effect, needs: p.needs ?? [],
                tier: r.tier, art: r.art ?? null, mechanic: p.mechanic ?? null,
            });
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ **THE SELECTION** — null (no candidate: the caller falls back), the one
 * candidate (no draw), or ONE `rng.choice` over 2+.
 *
 * @param {object} rule
 * @param {object} entry
 * @param {{concepts: object, offered?: string[], rng?: {choice: Function}}} o
 */
export function selectRealisation(rule, entry, { concepts, offered, rng } = {}) {
    const cands = candidatesFor(rule, entry, { concepts, offered });
    if (cands.length === 0) return null;
    if (cands.length === 1) return cands[0];
    if (!rng || typeof rng.choice !== 'function') {
        throw new Error(`conceptSelection: ${cands.length} candidates for one rule and no rng to `
            + 'choose with. ⛔ This refuses rather than taking the first: a silent first-pick is a '
            + 'draw the seed does not record.');
    }
    return rng.choice(cands);
}

/**
 * ⛓ **THE DECORATIONS** — the `helps` and `none` placements of the offered
 * concepts, in declared order. No rule selects them: a shortcut and a
 * roaming enemy change no reachability the planner fixed.
 */
export function decorationsFor(entry, { offered } = {}) {
    const world = offeredSet(offered);
    if (!world) return [];
    const out = [];
    for (const [concept, r] of Object.entries(entry?.conceptRealisations ?? {})) {
        if (!world.has(concept)) continue;
        for (const [key, p] of Object.entries(r.placements ?? {})) {
            if (p.effect === EFFECTS.REQUIRES) continue;
            out.push({
                concept, placement: key, effect: p.effect, needs: p.needs ?? [],
                tier: r.tier, art: r.art ?? null, mechanic: p.mechanic ?? null,
            });
        }
    }
    return out;
}
