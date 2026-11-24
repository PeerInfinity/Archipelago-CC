// ⛓ CONTENT SETS PL-2 — the fill-rule table (Z.6, version 1): each rule as Z.6 states it, the not-yet rows refused
// by name, and the per-substrate lists.
import { describe, expect, it } from 'vitest';

import {
    FILL_RULES, FILL_RULES_FIELD, RULE_HELPERS, RULE_STATUS, fillRule, fillRulesOf, ruleTag,
} from './fillRules.js';
import { substrateRegistryEntry as actionNodesEntry } from '../actionNodes/actionNodesLibrary.js';

/** The rule ids Z.6 names (the design's table), and the three it leaves for later. */
const Z6_BUILT = ['P1', 'T1', 'R1', 'R2', 'R3', 'R4', 'L1', 'L2', 'W1', 'B1', 'AN1', 'AN2', 'AN-flat'];
const Z6_NOT_YET = ['X1', 'X2', 'AN3'];
const apply = (id, args) => fillRule(id).apply(args);

describe('the table', () => {
    it('holds every rule Z.6 names, each with an id, a version, and Z.6\'s words', () => {
        expect(new Set(Object.keys(FILL_RULES))).toEqual(new Set([...Z6_BUILT, ...Z6_NOT_YET]));
        for (const [key, r] of Object.entries(FILL_RULES)) {
            expect(r.id).toBe(key);
            expect(Number.isInteger(r.version) && r.version >= 1).toBe(true);
            expect(r.fills.length && r.how.length).toBeTruthy();
            expect(ruleTag(key)).toBe(`${key}@${r.version}`);
        }
        for (const id of Z6_BUILT) expect(FILL_RULES[id].status).toBe(RULE_STATUS.BUILT);
        for (const id of Z6_NOT_YET) expect(FILL_RULES[id].status).toBe(RULE_STATUS.NOT_YET);
    });

    it('X1, X2 and AN3 are listed as not yet, and refused by name when asked for', () => {
        for (const id of Z6_NOT_YET) {
            expect(() => fillRule(id)).toThrow(new RegExp(`rule ${id} is listed as not yet built`));
            expect(() => fillRulesOf({ id: 'x', [FILL_RULES_FIELD]: ['L1', id] }))
                .toThrow(new RegExp(`substrate "x" asks for rule ${id}, which the table lists as not yet built`));
        }
        expect(() => fillRulesOf({ id: 'x', [FILL_RULES_FIELD]: ['Q9'] })).toThrow(/substrate "x" asks for rule "Q9", which the table does not hold/);
        expect(() => ruleTag('Q9')).toThrow(/no rule "Q9"/);
    });

    it('a substrate\'s list: its entry\'s own, else none (AN-1b: no table row is left)', () => {
        expect(fillRulesOf({ id: 'action_nodes' })).toEqual([]);
        expect(fillRulesOf({ id: 'action_nodes', [FILL_RULES_FIELD]: ['W1'] })).toEqual(['W1']);
        expect(fillRulesOf({ id: 'maze' })).toEqual([]);
    });

    it('⛓ the ActionNodes registry entry declares its list, and the resolver reads it there; every rule on it is built', () => {
        expect(actionNodesEntry[FILL_RULES_FIELD].length).toBeGreaterThan(0);
        expect(fillRulesOf(actionNodesEntry)).toEqual(actionNodesEntry[FILL_RULES_FIELD]);
        for (const id of actionNodesEntry[FILL_RULES_FIELD]) expect(FILL_RULES[id].status).toBe(RULE_STATUS.BUILT);
    });
});

describe('each rule, as Z.6 states it', () => {
    it('P1: a placeless task goes after the start', () => {
        expect(apply('P1', { startId: 'start' })).toEqual([['start']]);
    });

    it('T1: cost ÷ source start × receiving start', () => {
        expect(apply('T1', { cost: 400, sourceStart: 250, receivingStart: 100 })).toBe(160);
        expect(RULE_HELPERS.t1Share({ cost: 25, sourceStart: 100 })).toBe(0.25);
        expect(() => apply('T1', { cost: 1, sourceStart: 0, receivingStart: 1 })).toThrow(/T1: sourceStart 0 is not usable/);
    });

    it('R1: the smallest level at which cost × limit fits the starting clock', () => {
        const costAt = (level) => 100 / (1 + level / 10);     // a falling curve
        expect(apply('R1', { costAt, limit: 2, startClock: 100, maxLevel: 50 })).toBe(10);
        expect(apply('R1', { costAt, limit: 1, startClock: 100, maxLevel: 50 })).toBe(0);
        expect(apply('R1', { costAt: () => 1000, limit: 1, startClock: 100, maxLevel: 5 })).toBeNull();
    });

    it('R2: after the owner, else the same-place task that gives the most', () => {
        expect(apply('R2', { owner: 'a', givers: [{ task: 'b', gives: 9 }] })).toEqual({ after: [['a']] });
        expect(apply('R2', { givers: [{ task: 'b', gives: 1 }, { task: 'c', gives: 3 }] })).toEqual({ after: [['c']] });
        expect(apply('R2', { givers: [] })).toBeNull();
    });

    it('R3: after the first same-place giver', () => {
        expect(apply('R3', { givers: ['b', 'c'] })).toEqual({ after: [['b']] });
        expect(apply('R3', { givers: [] })).toBeNull();
    });

    it('R4: each of k stats ≥ sum ÷ k; alternatives → the first set', () => {
        expect(apply('R4', { sum: 35, stats: ['combat', 'magic'] })).toEqual({ combat: 18, magic: 18 });
        expect(RULE_HELPERS.firstSet([['a'], ['b']])).toEqual([['a']]);
    });

    it('L1: max(1, ⌊clock ÷ time⌋); a growing limit at the stat\'s maximum', () => {
        expect(apply('L1', { startClock: 100, time: 30 })).toBe(3);
        expect(apply('L1', { startClock: 100, time: 300 })).toBe(1);
        expect(apply('L1', { startClock: 100, time: 30, timeAtMax: 10 })).toBe(10);
        expect(apply('L1', { startClock: 100, time: 0 })).toBe(1);
    });

    it('L2: the number held', () => {
        expect(apply('L2', { held: 3 })).toBe(3);
        expect(apply('L2', { held: 0 })).toBe(1);
    });

    it('W1 lists and never writes (the entry is shown by its id); B1 lists', () => {
        expect(apply('W1', { id: 'p:task/x' })).toBe('p:task/x');
        expect(apply('B1', {})).toBeNull();
    });

    it('AN1: the sum of the stat\'s gains (gain × limit) over the after ancestors', () => {
        expect(apply('AN1', { ancestors: [{ gain: 1, limit: 2 }, { gain: 3, limit: 1 }] })).toBe(5);
        expect(apply('AN1', { ancestors: [] })).toBe(0);
    });

    it('AN2: round(weight × rate × share × 10), at least 1', () => {
        expect(apply('AN2', { weight: 1, share: 0.2 })).toBe(2);
        expect(apply('AN2', { weight: 0.5, rate: 2, share: 0.35 })).toBe(4);
        expect(apply('AN2', { weight: 0.1, share: 0.01 })).toBe(1);
    });

    it('AN-flat: each form', () => {
        expect(apply('AN-flat', { form: 'result-when', value: { stat: 's', when: 'every_nth' } })).toBe('each');
        expect(apply('AN-flat', { form: 'result-when', value: { opens: 'p', when: 'last' } })).toBe('last');
        expect(apply('AN-flat', { form: 'alternative-requires', value: [['a'], ['b']] })).toEqual([['a']]);
        expect(apply('AN-flat', { form: 'multipart', value: 7 })).toBe(7);
        expect(apply('AN-flat', { form: 'modifies', value: {} })).toBeNull();
        expect(() => apply('AN-flat', { form: 'teleport' })).toThrow(/AN-flat: form "teleport" is not one of/);
    });
});
