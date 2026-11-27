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
 * ⛓ WINDOWS AND THE STATE KEY (AN-TIME-1, design §2 row 3). With no window a state's clock is a function of its
 * counts, so the key stays the counts and the walk is exactly what it always was. With a window an early node WAITS,
 * so two plans to the same counts can reach different clocks. All plans to one count vector have the same length, so
 * they are all in one BFS layer: the walk goes layer by layer and keeps, per count vector, the EARLIEST clock (then
 * the most mana; prices are fixed within a walk, so the mana left is the pool + gains − clock and the earliest clock
 * dominates). Measured exact against a full-state search on 1,000 random windowed graphs; the plain counts key
 * differs on 5. The first-found entry wins a tie, and entries are appended in the order the plain walk finds them,
 * so a windowless graph would come out the same either way — the merge still runs only for a windowed graph.
 *
 * ⛓ KNOWLEDGE IN THE LATTICE. `itemCombinations` enumerates each boon from 0 to its `count`, then each knowledge flag
 * 0/1: a flag known from an earlier loop is one more item dimension (compiled as an event item). With no knowledge
 * the combinations are exactly what they were.
 *
 * Pure: no registry, no DOM, no I/O.
 */

import {
    describePlan, isReached, loopStartState, perform, stateKey, whyNot,
} from './actionModel.js';
import { knowledgeItemNameOf } from './actionGraph.js';

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
 * @param {boolean[]} [opts.allowed]       only these node indices may be performed (the planner's relevance cone,
 *                                          `actionPlanner.js` `relevantNodes`); absent = every node
 * @returns {{start: object, entries: Array<{state: object, parent: number, via: number}>}}
 *   `entries[0]` is the start; each other entry was reached from `entries[parent]` by performing node `via`.
 */
export function enumerateLoop(model, {
    items = {}, costs, ignoreMana = false, start, budget = DEFAULT_STATE_BUDGET, allowed,
} = {}) {
    const first = start ?? loopStartState(model, items);
    const entries = [{ state: first, parent: -1, via: -1 }];
    const seen = new Set([stateKey(first)]);
    const refuse = () => new ActionSearchError(ACTION_SEARCH_REFUSALS.STATE_BUDGET,
        `one loop has more than ${budget} states; the exact search refuses this graph (a hand-set path is the fallback, not built yet)`);
    if (model.windowed) {
        // Layer by layer; per count vector the earliest clock, then the most mana (see the header).
        let layer = [0];
        while (layer.length) {
            const best = new Map();
            for (const head of layer) {
                const { state } = entries[head];
                for (let i = 0; i < model.nodes.length; i += 1) {
                    if (allowed && !allowed[i]) continue;
                    if (whyNot(model, state, i, { costs, ignoreMana })) continue;
                    const next = perform(model, state, i, { costs });
                    const key = stateKey(next);
                    if (seen.has(key)) continue;
                    const b = best.get(key);
                    if (!b || next.clock < b.state.clock - 1e-9
                        || (Math.abs(next.clock - b.state.clock) <= 1e-9 && next.mana > b.state.mana + 1e-9)) {
                        best.set(key, { state: next, parent: head, via: i });
                    }
                }
            }
            layer = [];
            for (const [key, entry] of best) {
                seen.add(key);
                entries.push(entry);
                layer.push(entries.length - 1);
                if (entries.length > budget) throw refuse();
            }
        }
        return { start: first, entries };
    }
    for (let head = 0; head < entries.length; head += 1) {
        const { state } = entries[head];
        for (let i = 0; i < model.nodes.length; i += 1) {
            if (allowed && !allowed[i]) continue;
            if (whyNot(model, state, i, { costs, ignoreMana })) continue;
            const next = perform(model, state, i, { costs });
            const key = stateKey(next);
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({ state: next, parent: head, via: i });
            if (entries.length > budget) throw refuse();
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

/** The upper bound of each logic dimension: every boon's `count`, then 1 per knowledge flag. */
export function logicDimensionsOf(model) {
    return [...model.boons.map((b) => b.count), ...(model.knowledge ?? []).map(() => 1)];
}

/** The Archipelago item each logic dimension stands for: the boon names, then each flag's event item. */
export function logicItemNamesOf(model) {
    return [...model.boons.map((b) => b.name), ...(model.knowledge ?? []).map((k) => knowledgeItemNameOf(k.name))];
}

/** Every item combination, as vectors over the logic dimensions (boons, then knowledge), smallest total first. */
export function itemCombinations(model, budget = DEFAULT_COMBINATION_BUDGET) {
    const dims = logicDimensionsOf(model);
    const total = dims.reduce((p, n) => p * (n + 1), 1);
    if (total > budget) {
        throw new ActionSearchError(ACTION_SEARCH_REFUSALS.COMBINATION_BUDGET,
            `${total} item combinations exceed the budget of ${budget}`);
    }
    let combos = [[]];
    for (const max of dims) {
        const next = [];
        for (const c of combos) for (let k = 0; k <= max; k += 1) next.push([...c, k]);
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

/** A combination as `{"Strength Boost": 1, "Knows: …": 1}` (only the items it needs). */
export function combinationByName(model, items) {
    const out = {};
    logicItemNamesOf(model).forEach((name, i) => { if (items[i] > 0) out[name] = items[i]; });
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
