/**
 * actionNodes/actionSearch — **THE EXACT ONE-LOOP SEARCH**, and the Archipelago logic derived from it.
 *
 * ⚖ user, 2026-11-15 (design Q2): the logic is DERIVED by exact search, not written along a hand-set path. Because
 * stats and resources reset every loop (A2), the only thing that changes between loops is the items held, so:
 *
 *   A target is in logic exactly when some one-loop plan, starting from the base amounts plus every boost held,
 *   reaches it.
 *
 * Because boosts and stat results are never negative and requirements are minimums (enforced by shape in
 * `actionGraph.js`), that is MONOTONE in the items: more items never make a plan impossible. So the rule for a
 * target is the OR over its MINIMAL item combinations of AND(Has(item, n), …); an empty combination is `True`.
 *
 * `enumerateLoop` walks every state of one loop breadth-first over count vectors (the shape of
 * `shared/simulatorCore.js` `makeBfsSolver`, which stops at the first goal and so cannot list the whole space). BFS
 * order makes each state's recorded plan one with the fewest performances. A state budget bounds it: past the budget
 * the search is REFUSED by name (`search-budget-exceeded`), never cut short silently (design §2, Limits).
 *
 * Pure: no registry, no DOM, no I/O.
 */

import {
    describePlan, isReached, loopStartState, perform, stateKey, whyNot,
} from './actionModel.js';

/** The default state budget of ONE loop's enumeration. */
export const DEFAULT_STATE_BUDGET = 200_000;
/** The default budget on item combinations (the product over boons of count + 1). */
export const DEFAULT_COMBINATION_BUDGET = 4096;

export const ACTION_SEARCH_REFUSALS = Object.freeze({
    STATE_BUDGET: 'search-budget-exceeded',
    COMBINATION_BUDGET: 'combination-budget-exceeded',
});

export class ActionSearchError extends Error {
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.name = 'ActionSearchError';
        this.code = code;
    }
}

/**
 * Every reachable state of one loop.
 * @param {object} model
 * @param {object} [opts]
 * @param {object|number[]} [opts.items]    items held
 * @param {number[]} [opts.costs]           live prices by node index (the bot's XP discounts)
 * @param {boolean} [opts.ignoreMana]       treat mana as unlimited (the bot's "short by how much" question)
 * @param {object} [opts.start]             a start state other than `loopStartState(items)`
 * @param {number} [opts.budget]
 * @returns {{start: object, entries: Array<{state: object, parent: number, via: number}>}}
 *   `entries[0]` is the start; each other entry was reached from `entries[parent]` by performing node `via`.
 */
export function enumerateLoop(model, { items = {}, costs, ignoreMana = false, start, budget = DEFAULT_STATE_BUDGET } = {}) {
    const first = start ?? loopStartState(model, items);
    const entries = [{ state: first, parent: -1, via: -1 }];
    const seen = new Set([stateKey(first)]);
    for (let head = 0; head < entries.length; head += 1) {
        const { state } = entries[head];
        for (let i = 0; i < model.nodes.length; i += 1) {
            if (whyNot(model, state, i, { costs, ignoreMana })) continue;
            const next = perform(model, state, i, { costs });
            const key = stateKey(next);
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({ state: next, parent: head, via: i });
            if (entries.length > budget) {
                throw new ActionSearchError(ACTION_SEARCH_REFUSALS.STATE_BUDGET,
                    `one loop has more than ${budget} states; the exact search refuses this graph (a hand-set path is the fallback, not built yet)`);
            }
        }
    }
    return { start: first, entries };
}

/** The plan (node indices, in order) that reaches `entries[k]`. */
export function planTo(entries, k) {
    const plan = [];
    for (let at = k; at > 0; at = entries[at].parent) plan.push(entries[at].via);
    return plan.reverse();
}

/** Every item combination, as boon-count vectors, smallest total first. */
export function itemCombinations(model, budget = DEFAULT_COMBINATION_BUDGET) {
    const total = model.boons.reduce((p, b) => p * (b.count + 1), 1);
    if (total > budget) {
        throw new ActionSearchError(ACTION_SEARCH_REFUSALS.COMBINATION_BUDGET,
            `${total} item combinations exceed the budget of ${budget}`);
    }
    let combos = [[]];
    for (const b of model.boons) {
        const next = [];
        for (const c of combos) for (let k = 0; k <= b.count; k += 1) next.push([...c, k]);
        combos = next;
    }
    const sum = (v) => v.reduce((a, n) => a + n, 0);
    return combos.sort((a, b) => sum(a) - sum(b) || a.join(',').localeCompare(b.join(',')));
}

const dominates = (a, b) => a.every((n, i) => n <= b[i]);

/** Keep the combinations no other kept one is below (componentwise). Input sorted smallest total first. */
export function minimalCombinations(combos) {
    const kept = [];
    for (const c of combos) if (!kept.some((k) => dominates(k, c))) kept.push(c);
    return kept;
}

/**
 * Derive the logic of the whole graph.
 *
 * For every item combination it enumerates one loop and records, per node, whether some state PERFORMS it (the
 * check's location, the goal) and whether some state REACHES it (the region's way in). It keeps the minimal
 * combinations of each, with the fewest-performances witness plan for each minimal one.
 *
 * @returns {{
 *   combinations: number,
 *   maxStatesPerCombination: number,
 *   perform: Array<Array<{items: number[], plan: number[], manaLeft: number}>>,
 *   reach: Array<number[][]>,
 * }}  `perform[i]` / `reach[i]` are node i's minimal combinations (empty = never, under any items).
 */
export function deriveActionLogic(model, { budget = DEFAULT_STATE_BUDGET, combinationBudget } = {}) {
    const combos = itemCombinations(model, combinationBudget);
    const performBy = model.nodes.map(() => []);
    const reachBy = model.nodes.map(() => []);
    let maxStates = 0;
    for (const items of combos) {
        const { entries } = enumerateLoop(model, { items, budget });
        maxStates = Math.max(maxStates, entries.length);
        const performedAt = model.nodes.map(() => -1);
        const reached = model.nodes.map(() => false);
        entries.forEach(({ state, via }, k) => {
            if (via >= 0 && performedAt[via] < 0) performedAt[via] = k;
            for (let i = 0; i < model.nodes.length; i += 1) if (!reached[i] && isReached(model, state, i)) reached[i] = true;
        });
        model.nodes.forEach((_, i) => {
            if (performedAt[i] >= 0) {
                performBy[i].push({ items, plan: planTo(entries, performedAt[i]), manaLeft: entries[performedAt[i]].state.mana });
            }
            if (reached[i]) reachBy[i].push(items);
        });
    }
    const minimalOf = (rows, itemsOf) => {
        const keep = minimalCombinations(rows.map(itemsOf));
        return rows.filter((r) => keep.includes(itemsOf(r)));
    };
    return {
        combinations: combos.length,
        maxStatesPerCombination: maxStates,
        perform: performBy.map((rows) => minimalOf(rows, (r) => r.items)),
        reach: reachBy.map((rows) => minimalOf(rows, (r) => r)),
    };
}

/** A combination as `{"Strength Boost": 1}` (only the items it needs). */
export function combinationByName(model, items) {
    const out = {};
    model.boons.forEach((b, i) => { if (items[i] > 0) out[b.name] = items[i]; });
    return out;
}

/** A witness row for reports: the items it needs, the plan as text and as node ids, the mana left. */
export function describeWitness(model, w) {
    return {
        items: combinationByName(model, w.items),
        plan: describePlan(model, w.plan),
        steps: w.plan.map((i) => model.nodes[i].id),
        mana_left: w.manaLeft,
    };
}
