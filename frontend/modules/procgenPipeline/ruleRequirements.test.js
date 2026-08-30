import { describe, it, expect } from 'vitest';
import { extractItemRequirementFromRule } from './ruleRequirements.js';
import {
    makeHasRule, makeAndRule, makeOrRule, makeTrueRule, makeAtLeastRule,
} from '../shared/rulesJsonBuilder.js';

describe('extractItemRequirementFromRule', () => {
    it('True_ -> empty requirement, exact', () => {
        expect(extractItemRequirementFromRule(makeTrueRule()))
            .toEqual({ requirement: [], counts: {}, exact: true });
    });

    it('Has -> single item, exact', () => {
        expect(extractItemRequirementFromRule(makeHasRule('Blue platforms')))
            .toEqual({ requirement: ['Blue platforms'], counts: {}, exact: true });
    });

    it('Has with count -> count carried, exact', () => {
        expect(extractItemRequirementFromRule(makeHasRule('Jetpacks', 3)))
            .toEqual({ requirement: ['Jetpacks'], counts: { Jetpacks: 3 }, exact: true });
    });

    it('And of Has -> union of items, exact', () => {
        const rule = makeAndRule([makeHasRule('Blue platforms'), makeHasRule('Springs')]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['Blue platforms', 'Springs'], counts: {}, exact: true });
    });

    it('And takes the max count for a repeated item', () => {
        const rule = makeAndRule([makeHasRule('Coin', 2), makeHasRule('Coin', 5)]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['Coin'], counts: { Coin: 5 }, exact: true });
    });

    it('HasAll -> all items at count 1, exact', () => {
        const rule = { rule: 'HasAll', args: { items: ['Left arrow', 'Right arrow'] } };
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['Left arrow', 'Right arrow'], counts: {}, exact: true });
    });

    it('Or -> necessary subset only, not exact', () => {
        // (A AND B) OR (A AND C)  =>  A is necessary; B,C are not.
        const rule = makeOrRule([
            makeAndRule([makeHasRule('A'), makeHasRule('B')]),
            makeAndRule([makeHasRule('A'), makeHasRule('C')]),
        ]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['A'], counts: {}, exact: false });
    });

    it('Or with no common item -> empty, not exact', () => {
        const rule = makeOrRule([makeHasRule('A'), makeHasRule('B')]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: [], counts: {}, exact: false });
    });

    it('Or takes the min count for a shared item', () => {
        const rule = makeOrRule([makeHasRule('A', 2), makeHasRule('A', 5)]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['A'], counts: { A: 2 }, exact: false }); // min(2,5)=2
    });

    it('unsupported construct -> empty, not exact', () => {
        expect(extractItemRequirementFromRule({ rule: 'CountItem', args: {} }))
            .toEqual({ requirement: [], counts: {}, exact: false });
        expect(extractItemRequirementFromRule(null))
            .toEqual({ requirement: [], counts: {}, exact: false });
    });

    it('AtLeast with count == #children behaves like And (union, exact)', () => {
        const rule = makeAtLeastRule(2, [makeHasRule('A'), makeHasRule('B')]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['A', 'B'], counts: {}, exact: true });
    });

    it('AtLeast with count < #children -> necessary subset only, not exact', () => {
        // 2 of [ (A&B), (A&C), (A&D) ] => A is the only item common to all, inexact.
        const rule = makeAtLeastRule(2, [
            makeAndRule([makeHasRule('A'), makeHasRule('B')]),
            makeAndRule([makeHasRule('A'), makeHasRule('C')]),
            makeAndRule([makeHasRule('A'), makeHasRule('D')]),
        ]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: ['A'], counts: {}, exact: false });
    });

    it('AtLeast with count == 0 -> empty requirement, exact', () => {
        const rule = makeAtLeastRule(0, [makeHasRule('A')]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: [], counts: {}, exact: true });
    });

    it('AtLeast with count > #children -> empty, not exact', () => {
        const rule = makeAtLeastRule(3, [makeHasRule('A'), makeHasRule('B')]);
        expect(extractItemRequirementFromRule(rule))
            .toEqual({ requirement: [], counts: {}, exact: false });
    });
});
