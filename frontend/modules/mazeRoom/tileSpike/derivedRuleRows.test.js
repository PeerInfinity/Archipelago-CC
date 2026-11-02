/**
 * THE DERIVED-RULES LABELS (session tile-rules-automation-r-a1), on hand-built certifier rows: the label precedence
 * (problem > echoed > arrival-dependent > path-vs-edge > derived), the Route A region class, and the counts. The rows'
 * shapes are the certifier's (`certifyPlaythroughMaze(…, {rows: true})`); the real-world rows are pinned in
 * scripts/procgen/derivedRulesProbe.test.js.
 */
import { describe, it, expect } from 'vitest';
import { compareRules, labelDerivedRows, summarizeDerivedRows, DERIVED_ROW_LABELS, exitKey, locationKey } from './derivedRuleRows.js';

const has = (item, count) => ({ rule: 'Has', args: count ? { item_name: item, count } : { item_name: item } });
const T = { rule: 'True_' };
const or = (...children) => ({ rule: 'Or', children });
const and = (...children) => ({ rule: 'And', children });

/** A two-region doc: A (plain) exits to B; S1/S2 share one world, S2 entered from S1. */
const RULES = {
    regions: { 1: {
        A: { exits: [{ name: 'A -> B', connected_region: 'B' }], locations: [{ name: 'Chest' }] },
        B: { exits: [] },
        S1: { exits: [{ name: 'S1 -> S2', connected_region: 'S2' }] },
        S2: { exits: [{ name: 'S2 -> B', connected_region: 'B' }] },
    } },
    preset_sidecars: { 1: {
        A: { playable_payload: { atlas_region: 'level_1' } },
        B: { playable_payload: { atlas_region: 'level_2' } },
        S1: { shared_world: 'w', playable_payload: { atlas_region: 'level_3', shared_world: { regions: ['S1', 'S2'] } } },
        S2: { shared_world: 'w' },
    } },
};
const exitRow = (region, name, arrival, derived, ap, verdict = 'agrees') => ({
    kind: 'exit', region, name: 'B', arrival, label: `${region} → B`, minimal: [], derived, ap, verdict, by: [], problem: verdict === 'problem' ? 'p' : null,
    exits: [{ name, minimal: [], derived, ap }],
});
const locRow = (arrival, derived, ap, verdict = 'agrees') => ({
    kind: 'location', region: 'A', name: 'Chest', event: false, arrival, label: 'A @ Chest', minimal: [], derived, ap, verdict, by: [], problem: null,
});
const label = (rows, echoes = []) => labelDerivedRows(rows, { rules: RULES, echoes: new Set(echoes) });

describe('compareRules', () => {
    it('reads truth tables, not spellings, and counts', () => {
        expect(compareRules(has('Swim'), or(has('Swim'), and(has('weapon'), has('Swim'))))).toBe('equal');
        expect(compareRules(has('Swim'), T)).toBe('stricter');
        expect(compareRules(T, has('Swim'))).toBe('looser');
        expect(compareRules(has('Swim'), has('Fire'))).toBe('incomparable');
        expect(compareRules(has('Swim', 2), has('Swim'))).toBe('stricter');
    });
    it('refuses a rule kind a row never carries, by name', () => {
        expect(() => compareRules({ rule: 'CanReachRegion', args: {} }, T)).toThrow(/CanReachRegion/);
    });
});

describe('labelDerivedRows — one label per element row, in precedence order', () => {
    it('the labels are the five, in order', () => {
        expect(DERIVED_ROW_LABELS).toEqual(['problem', 'echoed', 'arrival-dependent', 'path-vs-edge', 'derived']);
    });

    it('derived: equal to the rule by truth table; path-vs-edge: different, yet the certifier agrees', () => {
        const { elements } = label([exitRow('A', 'A -> B', 'entrance', has('Swim'), or(has('Swim'), and(has('X'), has('Swim')))),
            locRow('entrance', has('Swim'), T)]);
        expect(elements.map((e) => [e.key, e.label, e.compare])).toEqual([
            [exitKey('A', 'A -> B'), 'derived', 'equal'], [locationKey('A', 'Chest'), 'path-vs-edge', 'stricter']]);
    });

    it('ECHOED beats agreement: the same equal row is echoed once its rule is copied, never derived', () => {
        const row = exitRow('A', 'A -> B', 'entrance', has('Swim'), has('Swim'));
        expect(label([row]).elements[0].label).toBe('derived');
        expect(label([row], [exitKey('A', 'A -> B')]).elements[0]).toMatchObject({ label: 'echoed', echoed: true, compare: 'equal' });
    });

    it('PROBLEM beats echoed: a certifier problem is never hidden behind an echo', () => {
        const row = exitRow('A', 'A -> B', 'entrance', has('Swim'), T, 'problem');
        expect(label([row], [exitKey('A', 'A -> B')]).elements[0]).toMatchObject({ label: 'problem', echoed: true });
    });

    it('ARRIVAL-DEPENDENT: every row of an element whose arrivals derive different rules (and only those)', () => {
        const { elements, regions } = label([
            exitRow('A', 'A -> B', 'landing 1,8', T, T),
            exitRow('A', 'A -> B', 'landing 15,4', has('Swim'), T, 'accepted'),
            locRow('landing 1,8', T, T), locRow('landing 15,4', T, T),
        ]);
        expect(elements.map((e) => e.label)).toEqual(['arrival-dependent', 'arrival-dependent', 'derived', 'derived']);
        expect(regions.get('A')).toMatchObject({ class: 'several arrivals', dependent: true });
    });

    it('echoed beats arrival-dependent', () => {
        const { elements } = label([exitRow('A', 'A -> B', 'landing 1,8', T, T), exitRow('A', 'A -> B', 'landing 15,4', has('Swim'), T)],
            [exitKey('A', 'A -> B')]);
        expect(elements.map((e) => e.label)).toEqual(['echoed', 'echoed']);
        expect(elements.every((e) => e.arrivalDependent)).toBe(true);
    });

    it('a pair row is echoed when a DIRECT exit between the two is; a transitive pair compares with False', () => {
        const pair = (direct) => ({ kind: 'pair', region: 'S1', name: 'S2', arrival: 'entrance', label: 'S1 → S2', minimal: [[]], derived: T,
            ap: direct ? T : null, exits: direct ? [{ name: 'S1 -> S2', ap: T }] : [], verdict: 'agrees', by: [], problem: null });
        expect(label([pair(true)], [exitKey('S1', 'S1 -> S2')]).elements[0].label).toBe('echoed');
        expect(label([pair(true)]).elements[0].label).toBe('derived');
        expect(label([pair(false)]).elements[0]).toMatchObject({ label: 'path-vs-edge', compare: 'looser' });
    });

    it('ROUTE A class: overridable / several arrivals / internal-only / walked into from another member', () => {
        const { regions, elements } = label([
            exitRow('A', 'A -> B', 'entrance', T, T),
            exitRow('S2', 'S2 -> B', 'from S1', T, T),
        ]);
        expect(regions.get('A').class).toBe('overridable');
        expect(regions.get('S2').class).toBe('internal-only');
        expect(elements.map((e) => e.overridable)).toEqual([true, false]);
        expect(label([exitRow('S2', 'S2 -> B', 'entrance', T, T)]).regions.get('S2').class).toBe('walk-in from another member');
    });

    it('an unknown row kind throws by name', () => {
        expect(() => label([{ kind: 'mystery' }])).toThrow(/mystery/);
    });
});

describe('summarizeDerivedRows', () => {
    it('counts labels per kind, W0-style verdicts per element (arrivals collapsed), arrivals and Route A', () => {
        const s = summarizeDerivedRows(label([
            exitRow('A', 'A -> B', 'landing 1,8', T, T), exitRow('A', 'A -> B', 'landing 15,4', has('Swim'), T),
            locRow('landing 1,8', has('Swim'), T), locRow('landing 15,4', has('Swim'), T),
            exitRow('S1', 'S1 -> B', 'entrance', has('Fire'), has('Fire')),
        ], [exitKey('S1', 'S1 -> B')]));
        expect(s.labels).toEqual({ exit: { 'arrival-dependent': 2, echoed: 1 }, location: { 'path-vs-edge': 2 } });
        expect(s.w0).toEqual({ exit: { 'arrival-dependent': 1, equal: 1 }, location: { stricter: 1 } });
        expect(s.elements).toBe(3);
        expect(s.echoedElements).toBe(1);
        expect(s.arrivals).toEqual({ regionsPriced: 2, arrivalNodes: 3, regionsPerArrivalCount: { 1: 1, 2: 1 }, regionsArrivalDependent: 1 });
        expect(s.routeA).toEqual({ classes: { 'several arrivals': 1, overridable: 1 }, overridableElements: 1, overridableEchoed: 1,
            overridableEchoFree: 0, regionsWithAnEchoFreeOverride: 0 });
    });
});
