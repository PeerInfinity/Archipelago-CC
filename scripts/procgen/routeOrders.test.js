/**
 * ⛓ ROUTE CHOOSER M (`routeOrders.js`) — the orderings the offline measure prices, on a graph small enough to read.
 *
 * Menu -GameStart-> Hub; Hub -> Pit is ONE-WAY in; Hub <-> East. Sphere 0 lists Pit's chest, East's chest and Hub's
 * chest in that (alphabetical) order, and sphere 1 is the goal, in the Pit. The listed order walks into the Pit,
 * Restarts out, and comes back for the goal; the cheapest orderings take Hub, East, then the Pit and its goal, and
 * never Restart.
 */
import { describe, it, expect } from 'vitest';

import { makeRuleHolds } from './surveyRoute.js';
import { goalItemOf, lookaheadDepthOf, orderRows, priceOrdering, routeMetrics, rowsOfSphereLog, walkGraphOf } from './routeOrders.js';

const T = { rule: 'True_' };
function rulesDoc({ bidir = false } = {}) {
    return {
        regions: {
            1: {
                Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: T }], locations: [] },
                Hub: { name: 'Hub', exits: [
                    { name: 'Hub -> Pit', connected_region: 'Pit', access_rule: T },
                    { name: 'Hub -> East', connected_region: 'East', access_rule: T },
                ], locations: [{ name: 'C Hub Chest', access_rule: T, item: { name: 'Coin', advancement: false } }] },
                Pit: { name: 'Pit', exits: [], locations: [
                    { name: 'A Pit Chest', access_rule: T, item: { name: 'Coin', advancement: false } },
                    { name: 'D Pit Goal', access_rule: T, item: { name: 'Victory', advancement: true } }] },
                East: { name: 'East', exits: [{ name: 'East -> Hub', connected_region: 'Hub', access_rule: T }], locations: [
                    { name: 'B East Chest', access_rule: T, item: { name: 'Coin', advancement: false } }] },
            },
        },
        exporter: { 1: { return_to_menu: true, assume_bidirectional_exits: bidir } },
        game_info: { 1: { completion_condition: { type: 'item_check', item: 'Victory' } } },
    };
}
const LOG = [
    { type: 'state_update', sphere_index: '0', player_data: { 1: { sphere_locations: [] } } },
    { type: 'state_update', sphere_index: '0.1', player_data: { 1: { sphere_locations: ['A Pit Chest'] } } },
    { type: 'state_update', sphere_index: '0.2', player_data: { 1: { sphere_locations: ['B East Chest'] } } },
    { type: 'state_update', sphere_index: '0.3', player_data: { 1: { sphere_locations: ['C Hub Chest'] } } },
    { type: 'state_update', sphere_index: '1.1', player_data: { 1: { sphere_locations: ['D Pit Goal'] } } },
];

function setup(opts) {
    const rules = rulesDoc(opts);
    const { regions } = walkGraphOf(rules);
    return { regions, ruleHolds: makeRuleHolds(rules), start: 'Hub', restart: true,
        rows: rowsOfSphereLog(LOG, regions, '1', goalItemOf(rules)) };
}

describe('routeOrders', () => {
    it('reads the bot rows off the sphere log and marks the goal', () => {
        const { rows } = setup();
        expect(rows.map((r) => [r.sphere, r.location, !!r.goal])).toEqual([['0.1', 'A Pit Chest', false],
            ['0.2', 'B East Chest', false], ['0.3', 'C Hub Chest', false], ['1.1', 'D Pit Goal', true]]);
    });

    it('listed walks into the pocket and Restarts; the cheapest orderings never do', () => {
        const ctx = setup();
        const listed = priceOrdering({ ...ctx, ordering: 'listed' });
        expect(listed.metrics).toEqual({ legs: 4, restarts: 1, hops: 6, levelVisits: 0 });
        // unpriced, the Pit (1 hop, listed first) ties East (1 hop) and wins; the sweep finds nothing else to walk to
        for (const ordering of ['sphere-cheapest', 'reachable-cheapest', 'sphere-cheapest+sweep']) {
            const r = priceOrdering({ ...ctx, ordering });
            expect(r.order.map((o) => o.location), ordering)
                .toEqual(['C Hub Chest', 'A Pit Chest', 'B East Chest', 'D Pit Goal']);
            expect(r.metrics.restarts, ordering).toBe(1);
        }
        for (const ordering of ['sphere-cheapest+pocket', 'reachable-cheapest+pocket']) {
            const r = priceOrdering({ ...ctx, ordering });
            expect(r.order.map((o) => o.location), ordering)
                .toEqual(['C Hub Chest', 'B East Chest', 'A Pit Chest', 'D Pit Goal']);
            expect(r.metrics, ordering).toEqual({ legs: 4, restarts: 0, hops: 3, levelVisits: 0 });
        }
    });

    it('the goal is taken last, even where it is the nearest row', () => {
        const ctx = setup();
        const rows = [...ctx.rows].reverse();   // the goal listed FIRST, and 1 hop away
        const order = orderRows({ ...ctx, rows, ordering: 'reachable-cheapest' }).map((o) => o.location);
        expect(order[order.length - 1]).toBe('D Pit Goal');
    });

    it('a pocket is entered last when it is priced (`+pocket`)', () => {
        const ctx = setup();
        // From Hub, the Pit chest (1 hop, a pocket) and the East chest (1 hop) tie on hops; listed, the Pit comes first.
        const rows = ctx.rows.filter((r) => r.location !== 'C Hub Chest');
        expect(orderRows({ ...ctx, rows, ordering: 'reachable-cheapest' })[0].location).toBe('A Pit Chest');
        expect(orderRows({ ...ctx, rows, ordering: 'reachable-cheapest+pocket' })[0].location).toBe('B East Chest');
    });

    it('bidirectional exits add a reverse under the forward rule, only where none is declared', () => {
        const { regions } = walkGraphOf(rulesDoc({ bidir: true }));
        expect(regions.Pit.exits.map((e) => [e.connected_region, e.reverse])).toEqual([['Hub', true]]);
        expect(regions.Hub.exits.filter((e) => e.connected_region === 'East')).toHaveLength(1);
        expect(regions.East.exits.filter((e) => e.connected_region === 'Hub')).toHaveLength(1);
        expect(walkGraphOf(rulesDoc()).regions.Pit.exits).toEqual([]);
    });

    it('a Restart is counted by its warp, not by a walk through a Menu hub', () => {
        const legs = [{ regions: ['Hub', 'Menu', 'Hub'] }, { regions: ['Pit', 'Menu', 'Hub'] }];
        expect(routeMetrics(legs, [['Hub -> Menu', 'GameStart'], ['Restart', 'GameStart']]).restarts).toBe(1);
    });

    it('`+grab`: a row the pick route crosses at zero detour is taken first, and that saves the Restart', () => {
        // Start <-> East; Start -> Hall -> Pit one-way. Sphere 0: the Pit and East; sphere 1: the Hall, on the way in.
        const hall = { name: 'Hall', exits: [{ name: 'Hall -> Pit', connected_region: 'Pit', access_rule: T }],
            locations: [{ name: 'H Hall Chest', access_rule: T, item: { name: 'Coin', advancement: false } }] };
        const rules = { regions: { 1: {
            Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'Start', access_rule: T }], locations: [] },
            Start: { name: 'Start', exits: [{ name: 'Start -> East', connected_region: 'East', access_rule: T },
                { name: 'Start -> Hall', connected_region: 'Hall', access_rule: T }], locations: [] },
            East: { name: 'East', exits: [{ name: 'East -> Start', connected_region: 'Start', access_rule: T }],
                locations: [{ name: 'B East Chest', access_rule: T, item: { name: 'Coin', advancement: false } }] },
            Hall: hall,
            Pit: { name: 'Pit', exits: [], locations: [{ name: 'A Pit Chest', access_rule: T, item: { name: 'Coin', advancement: false } },
                { name: 'Z Pit Chest', access_rule: T, item: { name: 'Coin', advancement: false } }] },
        } }, exporter: { 1: { return_to_menu: true, assume_bidirectional_exits: false } } };
        const log = [['0.1', 'A Pit Chest'], ['0.2', 'B East Chest'], ['1.1', 'H Hall Chest'], ['2.1', 'Z Pit Chest']]
            .map(([sphere_index, n]) => ({ type: 'state_update', sphere_index, player_data: { 1: { sphere_locations: [n] } } }));
        const { regions } = walkGraphOf(rules);
        const ctx = { regions, ruleHolds: makeRuleHolds(rules), start: 'Start', restart: true, rows: rowsOfSphereLog(log, regions) };
        const plain = priceOrdering({ ...ctx, ordering: 'sphere-cheapest+sweep' });
        expect(plain.order.map((o) => o.location)).toEqual(['B East Chest', 'A Pit Chest', 'Z Pit Chest', 'H Hall Chest']);
        expect(plain.metrics).toMatchObject({ restarts: 1 });
        const grab = priceOrdering({ ...ctx, ordering: 'sphere-cheapest+sweep+grab' });
        expect(grab.order.map((o) => o.location)).toEqual(['B East Chest', 'H Hall Chest', 'A Pit Chest', 'Z Pit Chest']);
        expect(grab.metrics).toMatchObject({ restarts: 0, hops: 4 });
    });

    it('`+pocket-item`: a pocket its OWN item opens the way out of is no pocket', () => {
        // From Hub: the Pit (1 hop, one-way in) and East (1 hop) tie. The Pit's chest holds the Key that opens Pit -> Hub.
        const rules = rulesDoc();
        rules.regions[1].Pit.exits = [{ name: 'Pit -> Hub', connected_region: 'Hub', access_rule: { rule: 'Has', args: { item_name: 'Key' } } }];
        rules.regions[1].Pit.locations[0].item = { name: 'Key', advancement: true };
        const { regions } = walkGraphOf(rules);
        const ctx = { regions, ruleHolds: makeRuleHolds(rules), start: 'Hub', restart: true,
            rows: rowsOfSphereLog(LOG, regions, '1', goalItemOf(rules)).filter((r) => r.location !== 'C Hub Chest') };
        // items held NOW: the Pit is a pocket, East goes first; with the Pit chest's own Key held it is not
        expect(orderRows({ ...ctx, ordering: 'reachable-cheapest+pocket' })[0].location).toBe('B East Chest');
        expect(orderRows({ ...ctx, ordering: 'reachable-cheapest+pocket-item' })[0].location).toBe('A Pit Chest');
    });

    it('`+lookahead`: the 2-row sequence beats greedy\'s nearest pick, and `+lookaheadK` names the depth', () => {
        // One-way: Start -> A (1 hop); Start -> Mid -> B (2); B -> A (1); A walks home the long way, A -> C1 -> C2 -> Start.
        // Greedy takes A (1), then B by 3 + 2 = 6 in all; lookahead takes B (2), then A (1) = 3.
        const ex = (from, to) => ({ name: `${from} -> ${to}`, connected_region: to, access_rule: T });
        const chest = (n) => ({ name: n, access_rule: T, item: { name: 'Coin', advancement: false } });
        const rules = { regions: { 1: {
            Start: { name: 'Start', exits: [ex('Start', 'A'), ex('Start', 'Mid')], locations: [] },
            Mid: { name: 'Mid', exits: [ex('Mid', 'B')], locations: [] },
            A: { name: 'A', exits: [ex('A', 'C1')], locations: [chest('A Chest')] },
            B: { name: 'B', exits: [ex('B', 'A')], locations: [chest('B Chest')] },
            C1: { name: 'C1', exits: [ex('C1', 'C2')], locations: [] },
            C2: { name: 'C2', exits: [ex('C2', 'Start')], locations: [] },
        } }, exporter: { 1: { assume_bidirectional_exits: false } } };
        const log = [['0.1', 'A Chest'], ['0.2', 'B Chest']]
            .map(([sphere_index, n]) => ({ type: 'state_update', sphere_index, player_data: { 1: { sphere_locations: [n] } } }));
        const { regions } = walkGraphOf(rules);
        const ctx = { regions, ruleHolds: makeRuleHolds(rules), start: 'Start', restart: false, rows: rowsOfSphereLog(log, regions) };
        const greedy = priceOrdering({ ...ctx, ordering: 'reachable-cheapest' });
        expect(greedy.order.map((o) => o.location)).toEqual(['A Chest', 'B Chest']);
        expect(greedy.metrics).toMatchObject({ restarts: 0, hops: 6 });
        for (const ordering of ['reachable-cheapest+lookahead', 'sphere-cheapest+sweep+lookahead', 'reachable-cheapest+lookahead3']) {
            const look = priceOrdering({ ...ctx, ordering });
            expect(look.order.map((o) => o.location)).toEqual(['B Chest', 'A Chest']);
            expect(look.metrics).toMatchObject({ restarts: 0, hops: 3 });
        }
        expect(lookaheadDepthOf(['sweep', 'lookahead'])).toBe(2);
        expect(lookaheadDepthOf(['lookahead4'])).toBe(4);
        expect(lookaheadDepthOf(['grab'])).toBe(0);
    });
});
