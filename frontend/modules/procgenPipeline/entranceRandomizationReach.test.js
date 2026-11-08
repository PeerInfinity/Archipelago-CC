/**
 * ER E4a — the evaluator export (`shared/procgen/forwardSimulator.js` `computeTraversableExits`) and the production
 * `reach` binding of the ER shuffle core (`entranceRandomizationReach.js`), on a hand-built rules document.
 * The binding over the Seedling playthrough's AP_1, driven through E3's `randomizeEntrances`, is
 * `scripts/procgen/seedlingErReachBinding.test.js`.
 *
 * ⚠ `computeTraversableExits` lives in the `shared` SUBMODULE: this imports the working tree's copy, which carries the
 * E4a commit (delivered as `er-e4a-shared.patch` until the planner lands it in archipelago-shared).
 */
import { describe, it, expect } from 'vitest';
import {
    buildAccessibilityModel, computeReachableRegions, computeTraversableExits,
} from '../shared/procgen/forwardSimulator.js';
import { makeRulesDocReach, allStateInventory, eventItemsOf } from './entranceRandomizationReach.js';

const has = (item_name, count) => ({ rule: 'Has', args: count ? { item_name, count } : { item_name } });
const T = { rule: 'True_' };
const UNDECIDED = { rule: 'CanReachLocation', args: { location: 'somewhere' } };

/** Menu → A; A → B needs Key; A → C free; B → D free (B unreachable without Key); C → E undecided. */
const doc = () => ({
    start_regions: { 1: { default: ['Menu'], available: [] } },
    regions: {
        1: {
            Menu: { exits: [{ name: 'Menu -> A', connected_region: 'A', access_rule: T }] },
            A: {
                exits: [
                    { name: 'A -> B', connected_region: 'B', access_rule: has('Key') },
                    { name: 'A -> C', connected_region: 'C', access_rule: T },
                ],
            },
            B: { exits: [{ name: 'B -> D', connected_region: 'D', access_rule: T }] },
            C: {
                exits: [{ name: 'C -> E', connected_region: 'E', access_rule: UNDECIDED }],
                locations: [{ name: 'Key Event', id: null, access_rule: T, item: { name: 'Key Flag', advancement: true } }],
            },
            D: { locations: [{ name: 'Chest D', id: 7, access_rule: T, item: { name: 'Key', advancement: true } }] },
            E: {},
        },
    },
    itempool_counts: { 1: { Key: 1, 'Key Flag': 1 } },
    starting_items: { 1: [] },
});

describe('computeTraversableExits (the evaluator export, reusing forwardSimulator.decide)', () => {
    it('an exit whose parent is reachable and whose rule holds is in the set; an unmet rule and an unreachable parent are not', () => {
        const model = buildAccessibilityModel(doc());
        const inv = new Map();
        const reached = computeReachableRegions(model, inv);
        expect([...reached].sort()).toEqual(['A', 'C', 'Menu']);
        const exits = computeTraversableExits(model, inv, reached);
        expect([...exits].sort()).toEqual(['A -> C', 'Menu -> A']);
        expect(exits.has('A -> B')).toBe(false); // the rule is unmet
        expect(exits.has('B -> D')).toBe(false); // the parent is unreachable
    });
    it('the rule held opens it, and the region set defaults to the sweep\'s own', () => {
        const model = buildAccessibilityModel(doc());
        const exits = computeTraversableExits(model, new Map([['Key', 1]]));
        expect([...exits].sort()).toEqual(['A -> B', 'A -> C', 'B -> D', 'Menu -> A']);
    });
    it('an UNDECIDED rule is not traversable, and is recorded by endpoint', () => {
        const model = buildAccessibilityModel(doc());
        const undecided = new Map();
        const exits = computeTraversableExits(model, new Map(), null, undecided);
        expect(exits.has('C -> E')).toBe(false);
        expect([...undecided.keys()]).toContain('exit C -> C -> E');
    });
});

describe('makeRulesDocReach (the reach binding)', () => {
    const shuffled = [
        // A → B is the shufflable exit; it carries nothing else, so the AP exit leaves the model.
        { name: 'A -> B', region: 'A', access_rule: has('Key'), carrier: 'A -> B' },
    ];
    it('the all-state inventory is the pool less the events, and events are swept', () => {
        expect([...allStateInventory(doc())]).toEqual([['Key', 1]]);
        expect([...eventItemsOf(doc())]).toEqual([['Key Event', 'Key Flag']]);
        const r = makeRulesDocReach(doc(), { shuffled })([]);
        expect(r.items.get('Key Flag')).toBe(1);
    });
    it('a disconnected exit leads nowhere until placed, and a placement leads where it says, under its own rule', () => {
        const reach = makeRulesDocReach(doc(), { shuffled });
        const none = reach([]);
        expect(none.regions.has('B')).toBe(false);
        // unplaced, it leads nowhere, but it is TRAVERSABLE (parent reached, rule held): GER places exactly such exits
        expect(none.exits.has('A -> B')).toBe(true);
        expect(makeRulesDocReach(doc(), { shuffled, inventory: new Map() })([]).exits.has('A -> B')).toBe(false);
        const toD = reach([{ exit: 'A -> B', from: 'A', to: 'D' }]);
        expect(toD.regions.has('D')).toBe(true);
        expect(toD.exits.has('A -> B')).toBe(true); // all-state holds the Key
        expect(toD.regions.has('B')).toBe(false);
        const noKey = makeRulesDocReach(doc(), { shuffled, inventory: new Map() })([{ exit: 'A -> B', from: 'A', to: 'D' }]);
        expect(noKey.regions.has('D')).toBe(false);
        expect(noKey.exits.has('A -> B')).toBe(false);
    });
    it('a SHARED carrier stays (the other links still go there); the leg exists only as its placement', () => {
        const reach = makeRulesDocReach(doc(), { shuffled: [{ name: 'A -> B [stair]', region: 'A', access_rule: T, carrier: null }] });
        expect(reach([]).regions.has('B')).toBe(true);
        expect(reach([{ exit: 'A -> B [stair]', from: 'A', to: 'E' }]).regions.has('E')).toBe(true);
    });
    it('is pure: a speculative call does not leak into the next, and the document is untouched', () => {
        const d = doc();
        const before = JSON.stringify(d);
        const reach = makeRulesDocReach(d, { shuffled });
        reach([{ exit: 'A -> B', from: 'A', to: 'D' }]);
        expect(reach([]).regions.has('D')).toBe(false);
        expect(JSON.stringify(d)).toBe(before);
    });
    it('refuses by name an unknown exit, a wrong parent, and a carrier that is not there', () => {
        const reach = makeRulesDocReach(doc(), { shuffled });
        expect(() => reach([{ exit: 'nope', from: 'A', to: 'D' }])).toThrow(/nope is not a shufflable exit/);
        expect(() => reach([{ exit: 'A -> B', from: 'C', to: 'D' }])).toThrow(/leaves A, not C/);
        expect(() => makeRulesDocReach(doc(), { shuffled: [{ name: 'x', region: 'A', access_rule: T, carrier: 'A -> Z' }] }))
            .toThrow(/carrier A -> Z is no exit of A/);
    });
});
