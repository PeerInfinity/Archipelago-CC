// actionNodes/actionSearch + actionModel — the one-loop model and the exact search.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    applyBoost, buildActionModel, describePlan, isReached, loopStartState, perform, whyNot,
} from './actionModel.js';
import {
    ACTION_SEARCH_REFUSALS, combinationByName, deriveActionLogic, enumerateLoop, itemCombinations,
    minimalCombinations, planTo,
} from './actionSearch.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = JSON.parse(readFileSync(join(HERE, 'graphs/example-village.json'), 'utf8'));
const model = buildActionModel(EXAMPLE);
const ix = (id) => model.nodeIx.get(id);
const run = (state, ids) => ids.reduce((s, id) => {
    expect(whyNot(model, s, ix(id)), id).toBeNull();
    return perform(model, s, ix(id));
}, state);

describe('the model of one loop', () => {
    it('starts from the loop mana plus every boost held; the start is cleared', () => {
        const none = loopStartState(model);
        expect(none.mana).toBe(EXAMPLE.loop.mana);
        expect(isReached(model, none, ix('train'))).toBe(true);
        const boosted = loopStartState(model, { 'strength-boost': 1 });
        expect(boosted.stats[model.statIx.get('strength')]).toBe(EXAMPLE.boons['strength-boost'].gives.stats.strength);
    });
    it('A16: exits open only after the Nth performance', () => {
        const once = run(loopStartState(model), ['do-chores']);
        expect(whyNot(model, once, ix('buy-bread')).code).toBe('not-reached');
        const twice = run(once, ['do-chores']);
        expect(isReached(model, twice, ix('buy-bread'))).toBe(true);
        expect(whyNot(model, twice, ix('do-chores')).code).toBe('limit');
    });
    it('names each refusal: requirement, resource below 0, mana', () => {
        const s = loopStartState(model);
        expect(whyNot(model, s, ix('eat-bread')).code).toBe('resource');
        const trained = run(s, ['train']);
        expect(whyNot(model, trained, ix('leave-the-village')).code).toBe('not-reached');
        const poor = { ...s, mana: 1 };
        expect(whyNot(model, poor, ix('train'))).toMatchObject({ code: 'mana', short: model.nodes[ix('train')].time - 1 });
    });
    it('A4: a boost received mid-loop applies at once', () => {
        const s = applyBoost(model, loopStartState(model), model.boons.findIndex((b) => b.id === 'pocket-money'));
        expect(s.resources[model.resIx.get('gold')]).toBe(EXAMPLE.boons['pocket-money'].gives.resources.gold);
    });
});

describe('the exhaustive enumeration', () => {
    it('every state is distinct, and each recorded plan replays to its state', () => {
        const { entries } = enumerateLoop(model);
        const keys = entries.map((e) => e.state.counts.join(','));
        expect(new Set(keys).size).toBe(keys.length);
        for (let k = 1; k < entries.length; k += 7) {
            const plan = planTo(entries, k).map((i) => model.nodes[i].id);
            expect(run(loopStartState(model), plan).counts).toEqual(entries[k].state.counts);
        }
    });
    it('refuses by name past its state budget, never cuts short', () => {
        expect(() => enumerateLoop(model, { budget: 3 })).toThrow(ACTION_SEARCH_REFUSALS.STATE_BUDGET);
    });
    it('item combinations are the product of (count + 1) and refuse past their budget', () => {
        const product = model.boons.reduce((p, b) => p * (b.count + 1), 1);
        expect(itemCombinations(model)).toHaveLength(product);
        expect(() => itemCombinations(model, product - 1)).toThrow(ACTION_SEARCH_REFUSALS.COMBINATION_BUDGET);
    });
    it('minimal combinations drop every combination above another', () => {
        expect(minimalCombinations([[0, 1], [1, 0], [1, 1], [0, 2]])).toEqual([[0, 1], [1, 0]]);
    });
});

describe('⛓ the derived logic of the example (design §9)', () => {
    const logic = deriveActionLogic(model);
    const rule = (id) => logic.perform[ix(id)].map((w) => combinationByName(model, w.items));
    it('both checks need nothing; the goal needs the Strength Boost', () => {
        expect(rule('guards-locker')).toEqual([{}]);
        expect(rule('move-the-boulder')).toEqual([{}]);
        expect(rule('leave-the-village')).toEqual([{ 'Strength Boost': 1 }]);
    });
    it('the witnesses are the design\'s plans, with the design\'s mana left', () => {
        const w = (id) => logic.perform[ix(id)][0];
        expect(describePlan(model, w('guards-locker').plan)).toBe('Do Chores ×2 → Bribe the Guard → Guard\'s Locker');
        expect(w('guards-locker').manaLeft).toBe(55);
        expect(describePlan(model, w('move-the-boulder').plan)).toBe('Train → Move the Boulder');
        expect(w('move-the-boulder').manaLeft).toBe(40);
        expect(w('leave-the-village').manaLeft).toBe(5);
        // The goal needs the bread: its plan eats it.
        expect(w('leave-the-village').plan).toContain(ix('eat-bread'));
    });
    it('with no items no single loop earns both checks (the wrong-turn property)', () => {
        const { entries } = enumerateLoop(model);
        expect(entries.some(({ state }) => state.counts[ix('guards-locker')] && state.counts[ix('move-the-boulder')])).toBe(false);
    });
    it('⛓ monotone: every combination above a minimal one also earns the target', () => {
        for (const items of itemCombinations(model)) {
            const { entries } = enumerateLoop(model, { items });
            model.nodes.forEach((_, i) => {
                const earns = entries.some((e) => e.via === i);
                const covered = logic.perform[i].some((w) => w.items.every((n, b) => n <= items[b]));
                expect(earns, `${model.nodes[i].id} @ ${items}`).toBe(covered);
            });
        }
    });
    it('reports its search size', () => {
        expect(logic.combinations).toBe(itemCombinations(model).length);
        expect(logic.maxStatesPerCombination).toBeGreaterThan(1);
    });
});
