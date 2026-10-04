/**
 * ⛓ `rules-route-survey` — the route survey's legs (`surveyRoute.js`): derived
 * from a sphere order, one per row, over AP's own evaluator with
 * `CanReachRegion` read from the start-anchored fixed point.
 */

import { describe, expect, it } from 'vitest';

import { deriveLegs, makeRuleHolds, pickupsThrough, regionPath } from './surveyRoute.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const TRUE = { rule: 'True_' };
const doc = (regions) => ({
    regions: { 1: regions }, start_regions: { 1: { default: ['Menu'], available: [] } },
    progression_mapping: { 1: {} },
});

describe('pickupsThrough + deriveLegs — the legs come from the sphere order', () => {
    // S ─► A (Sword @ A) ; A ─[Sword]► B (Key @ B) ; B ─[Key]► C (Gem @ C)
    const RULES = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: { exits: [{ name: 's-a', connected_region: 'A', access_rule: TRUE }] },
        A: {
            exits: [{ name: 'a-b', connected_region: 'B', access_rule: has('Sword') }],
            locations: [{ name: 'Sword spot' }],
        },
        B: {
            exits: [{ name: 'b-c', connected_region: 'C', access_rule: has('Key') }],
            locations: [{ name: 'Key spot' }],
        },
        C: { exits: [], locations: [{ name: 'Gem spot' }] },
    });
    const ORDER = [
        { sphere: '0.1', location: 'Sword spot', item: 'Sword' },
        { sphere: '1.1', location: 'Key spot', item: 'Key' },
        { sphere: '2.1', location: 'Gem spot', item: 'Gem' },
    ];
    const legsFor = (through) => deriveLegs({
        regions: RULES.regions[1], ruleHolds: makeRuleHolds(RULES), start: 'S',
        pickups: pickupsThrough(ORDER, through), spare: [],
    }).legs;

    it('an order of 3 spheres yields 3 legs, in order, each holding what the earlier ones earned', () => {
        const legs = legsFor('end');
        expect(legs.map((l) => l.sphere)).toEqual(['0.1', '1.1', '2.1']);
        expect(legs.map((l) => l.regions)).toEqual([['S', 'A'], ['A', 'B'], ['B', 'C']]);
        expect(legs.map((l) => l.itemsHeld)).toEqual([[], ['Sword'], ['Sword', 'Key']]);
        expect(legs.every((l) => !l.outOfOrder)).toBe(true);
    });

    it('--through=<row> stops AT that row, inclusive; an unknown label refuses by name', () => {
        expect(legsFor('1.1').map((l) => l.sphere)).toEqual(['0.1', '1.1']);
        expect(() => pickupsThrough(ORDER, '1.2')).toThrow(/no sphere-order row is labelled '1\.2'.*sphere 1 has 1\.1/);
    });

    it('a row the route cannot WALK to is deferred, the next reachable row taken, and both named', () => {
        // the Key's room is only reachable from S; once at C the way back needs
        // the Ore, which AP's order collects AFTER the Key (position-free)
        const oneWay = doc({
            Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
            S: { exits: [{ name: 's-c', connected_region: 'C', access_rule: TRUE },
                { name: 's-b', connected_region: 'B', access_rule: has('Gem') }] },
            B: { exits: [], locations: [{ name: 'Key spot' }] },
            C: { exits: [{ name: 'c-s', connected_region: 'S', access_rule: has('Ore') }],
                locations: [{ name: 'Gem spot' }, { name: 'Ore spot' }] },
        });
        const order = [
            { sphere: '0.1', location: 'Gem spot', item: 'Gem' },
            { sphere: '1.1', location: 'Key spot', item: 'Key' },
            { sphere: '1.2', location: 'Ore spot', item: 'Ore' },
        ];
        const derive = (spare) => deriveLegs({ regions: oneWay.regions[1], ruleHolds: makeRuleHolds(oneWay),
            start: 'S', pickups: order.slice(0, 2), spare });
        expect(() => derive(null)).toThrow(/NO path from C to B/);
        expect(() => derive([])).toThrow(/no remaining sphere-order row is reachable from C: blocked C -> S/);
        const { legs } = derive([order[2]]);
        expect(legs.map((l) => l.sphere)).toEqual(['0.1', '1.2', '1.1']);
        expect(legs[1]).toMatchObject({ pulledForward: true,
            outOfOrder: { deferred: ['1.1'], because: 'no path from C',
                blocked: [{ from: 'C', to: 'S', rule: has('Ore') }] } });
        expect(legs[2].regions).toEqual(['C', 'S', 'B']);
    });
});

describe('makeRuleHolds — CanReachRegion is decided as AP decides it', () => {
    // S ─[CanReachRegion(R)]► T ; S ─[Ore]► R. T is open only once R is
    // reachable FROM THE START — AP's can_reach_region, not the leg's path.
    const RULES = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: {
            exits: [
                { name: 's-t', connected_region: 'T',
                    access_rule: { rule: 'CanReachRegion', args: { region_name: 'R' } } },
                { name: 's-r', connected_region: 'R', access_rule: has('Ore') },
            ],
        },
        R: { exits: [] },
        T: { exits: [] },
    });
    const holds = makeRuleHolds(RULES);

    it('the CanReachRegion edge is honoured: shut without the Ore, open (and walked directly) with it', () => {
        expect(regionPath(RULES.regions[1], holds, 'S', 'T', {})).toBeNull();
        expect(regionPath(RULES.regions[1], holds, 'S', 'T', { Ore: 1 })).toEqual(['S', 'T']);
    });

    it('a rule the shared engine cannot decide THROWS rather than reading as satisfied', () => {
        const odd = makeRuleHolds(doc({
            Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
            S: { exits: [{ name: 'x', connected_region: 'X', access_rule: { rule: 'CanReachLocation', args: { location_name: 'nope' } } }] },
            X: { exits: [] },
        }));
        expect(() => odd(TRUE, {})).toThrow(/undecidable over an inventory/);
    });
});
