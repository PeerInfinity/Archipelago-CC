/**
 * ⛓ `rules-route-survey` — the route survey's legs (`surveyRoute.js`): derived
 * from a sphere order, one per row, over AP's own evaluator with
 * `CanReachRegion` read from the start-anchored fixed point.
 */

import { describe, expect, it } from 'vitest';

import {
    chainBound, deriveLegs, keyItemsOf, makeRuleHolds, pickupsThrough, regionPath, ROUTE_MODES,
    routeOnlyRows,
} from './surveyRoute.js';

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

/**
 * ⛓⛓ FRONTIER2 — the two route modes (⚖ user 2026-10-05: "Both, report
 * separately"). `full` is the legs above; `route-only` keeps the progression
 * pickups and WALKS them.
 */
describe('route-only — the progression pickups, derived, and walked', () => {
    const hasN = (item, count) => ({ rule: 'Has', args: { item_name: item, count } });
    // S ─[Sword]► A ─[Seal×2]► Z ; S holds two Seals and a Lamp; A holds the Key
    const RULES = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: {
            exits: [{ name: 's-a', connected_region: 'A', access_rule: has('Sword') }],
            locations: [{ name: 'Sword spot' }, { name: 'Seal 1' }, { name: 'Seal 2' }, { name: 'Lamp spot' }],
        },
        A: {
            exits: [{ name: 'a-z', connected_region: 'Z', access_rule: hasN('Seal', 2) }],
            locations: [{ name: 'Key spot', access_rule: has('Key') }],
        },
        Z: { exits: [], locations: [{ name: 'End spot' }] },
    });
    const ORDER = [
        { sphere: '0.1', location: 'Sword spot', item: 'Sword' },
        { sphere: '0.2', location: 'Seal 1', item: 'Seal' },
        { sphere: '0.3', location: 'Lamp spot', item: 'Lamp' },
        { sphere: '1.1', location: 'Key spot', item: 'Key' },
        { sphere: '1.2', location: 'Seal 2', item: 'Seal' },
    ];

    it('the modes are named, and full is the first (the default)', () => {
        expect(ROUTE_MODES).toEqual(['full', 'route-only']);
    });

    it('a KEY is an item some rule asks for by a single-copy Has — a counted pool is not one', () => {
        expect([...keyItemsOf(RULES)].sort()).toEqual(['Key', 'Sword']);
    });

    it('route-only keeps the keys and the bound, and names every row it skips', () => {
        const { rows, skipped } = routeOnlyRows(ORDER, keyItemsOf(RULES), '1.2');
        expect(rows.map((r) => r.sphere)).toEqual(['0.1', '1.1', '1.2']);
        expect(skipped).toEqual([
            { sphere: '0.2', location: 'Seal 1', item: 'Seal' },
            { sphere: '0.3', location: 'Lamp spot', item: 'Lamp' },
        ]);
        expect(routeOnlyRows(ORDER, keyItemsOf(RULES)).rows.map((r) => r.sphere)).toEqual(['0.1', '1.1']);
    });

    /**
     * The one-way lock RULES (A) spells: T ─[CanReachRegion(F) ∧ Key]► F, and F
     * is reachable from the START another way (S ─► F, behind the Key). AP's
     * reading lets the route through T's lock from the near side; the WALK
     * reading does not, because the route never stood in F.
     */
    const LOCK = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: {
            exits: [
                { name: 's-t', connected_region: 'T', access_rule: TRUE },
                { name: 's-m', connected_region: 'M', access_rule: TRUE },
            ],
            locations: [{ name: 'Key spot' }],
        },
        M: { exits: [{ name: 'm-n', connected_region: 'N', access_rule: TRUE }] },
        N: { exits: [{ name: 'n-f', connected_region: 'F', access_rule: has('Key') }] },
        T: { exits: [{ name: 't-f', connected_region: 'F', access_rule: {
            rule: 'And', children: [{ rule: 'CanReachRegion', args: { region_name: 'F' } }, has('Key')] } }] },
        F: { exits: [{ name: 'f-g', connected_region: 'G', access_rule: TRUE }] },
        G: { exits: [{ name: 'g-s', connected_region: 'S', access_rule: TRUE }], locations: [{ name: 'Gem spot' }] },
    });
    const LOCK_ORDER = [
        { sphere: '0.1', location: 'Key spot', item: 'Key' },
        { sphere: '1.1', location: 'Gem spot', item: 'Gem' },
    ];
    const lockLegs = (walk) => deriveLegs({ regions: LOCK.regions[1], ruleHolds: makeRuleHolds(LOCK),
        start: 'S', pickups: LOCK_ORDER, spare: [], walk });

    it('AP\'s reading passes the one-way lock from its near side; the WALK goes round', () => {
        expect(lockLegs(false).legs[1].regions).toEqual(['S', 'T', 'F', 'G']);
        const walked = lockLegs(true);
        expect(walked.legs[1].regions).toEqual(['S', 'M', 'N', 'F', 'G']);
        // the leg's own decider is handed back, so its alternatives ask the same question
        expect(walked.legHolds).toHaveLength(2);
        const lock = LOCK.regions[1].T.exits[0].access_rule;
        expect(walked.legHolds[1](lock, { Key: 1 })).toBe(false);
        expect(lockLegs(false).legHolds[1](lock, { Key: 1 })).toBe(true);
    });

    it('once a leg has STOOD in the far side, the lock reads open to the next one', () => {
        const order = [...LOCK_ORDER, { sphere: '2.1', location: 'Key spot', item: 'Key' }];
        const legs = deriveLegs({ regions: LOCK.regions[1], ruleHolds: makeRuleHolds(LOCK),
            start: 'S', pickups: order, spare: [], walk: true });
        const lock = LOCK.regions[1].T.exits[0].access_rule;
        expect(legs.legHolds[2](lock, { Key: 1 })).toBe(true);
    });
});

describe('chainBound — the frontier\'s bound is read off the chain\'s terminal segment', () => {
    const ORDER = [
        { sphere: '0.1', location: 'Level 010 - Sword', item: 'Progressive Sword', level: 10 },
        { sphere: '3.1', location: 'Level 032 - Bob Boss', item: 'Fire', level: 32 },
        { sphere: '7.1', location: 'Level 012 - Witch', item: 'Progressive Sword', level: 12 },
    ];

    it('the terminal segment\'s room and item name the row', () => {
        expect(chainBound(ORDER, [{ name: 'a', level: 0, to: 32 },
            { name: 'b', level: 32, to: null, encounter: 'Fire' }])).toBe('3.1');
        expect(chainBound(ORDER, [{ name: 'c', level: 12, to: null, item: 'Progressive Sword' }])).toBe('7.1');
    });

    it('a tail that is not terminal, or a row nobody can name, refuses by name', () => {
        expect(() => chainBound(ORDER, [{ name: 'x', level: 32, to: 30, encounter: 'Fire' }]))
            .toThrow(/not a terminal segment/);
        expect(() => chainBound(ORDER, [{ name: 'y', level: 33, to: null, encounter: 'Fire' }]))
            .toThrow(/0 sphere-order rows grant 'Fire' in L33/);
    });
});
