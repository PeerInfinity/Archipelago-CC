/**
 * ⛓ TIMER CHECK ORDER (`timer/checkOrder.js`, slice `bot-route-chooser-2b`) — the no-batch tick's pick: the timer's
 * own first location by default (untouched), `routeChooser.chooseNext` by walk cost when the setting names
 * `reachable-cheapest`. The second half drives the real `TimerLogic` no-batch branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../app/core/settingsManager.js', () => ({
    default: { getSetting: vi.fn(async (_key, fallback) => fallback) },
}));

import { DEFAULT_TIMER_CHECK_ORDER, TIMER_CHECK_ORDERS, picksByCost, pickTimerCheck } from './checkOrder.js';
import { TimerLogic } from './timerLogic.js';

const loc = (name, region, advancement = false) => ({ name, region, item: { name: `${name} item`, advancement } });
// Hub -> Near (1); Hub -> Mid -> Far (2); Pit: no walk from Hub
const DIST = { Near: 1, Far: 2 };
const findPath = (from, to) => (from === 'Hub' && DIST[to] !== undefined ? { length: DIST[to], steps: [] } : null);

describe('timer checkOrder', () => {
    it('the default keeps the timer\'s first location, whatever the costs', () => {
        expect(DEFAULT_TIMER_CHECK_ORDER).toBe('sphere-in-order');
        expect(TIMER_CHECK_ORDERS).toEqual(['sphere-in-order', 'reachable-cheapest']);
        expect(picksByCost('sphere-in-order')).toBe(false);
        expect(picksByCost('reachable-cheapest+lookahead')).toBe(false); // not a timer order
        const locs = [loc('far', 'Far'), loc('near', 'Near')];
        expect(pickTimerCheck(locs, { order: 'sphere-in-order', here: 'Hub', findPath })).toBe(locs[0]);
        expect(pickTimerCheck(locs, { order: 'bogus', here: 'Hub', findPath })).toBe(locs[0]);
        expect(pickTimerCheck([], { order: 'reachable-cheapest' })).toBeNull();
    });

    it('`reachable-cheapest` picks the cheapest walk; a location with no walk ranks after every walk', () => {
        const locs = [loc('pit', 'Pit'), loc('far', 'Far'), loc('near', 'Near')];
        expect(pickTimerCheck(locs, { order: 'reachable-cheapest', here: 'Hub', findPath }).name).toBe('near');
        expect(pickTimerCheck([locs[0], locs[1]], { order: 'reachable-cheapest', here: 'Hub', findPath }).name).toBe('far');
        // same region = 0 hops
        expect(pickTimerCheck([locs[1], loc('home', 'Hub')], { order: 'reachable-cheapest', here: 'Hub', findPath }).name).toBe('home');
    });

    it('with no current region the ties decide: progression first, then the timer\'s order', () => {
        const locs = [loc('a', 'Far'), loc('b', 'Near', true), loc('c', 'Near', true)];
        expect(pickTimerCheck(locs, { order: 'reachable-cheapest', here: null, findPath }).name).toBe('b');
        const goal = new Map([['b', { goal: true }]]);
        expect(pickTimerCheck(locs, { order: 'reachable-cheapest', here: null, findPath, meta: goal }).name).toBe('c');
    });
});

describe('TimerLogic no-batch tick', () => {
    let published;
    let logic;
    const snapshotInterfaceOf = (locs) => ({
        snapshot: { checkedLocations: [], inventory: {}, regionReachability: {} },
        staticData: { locations: new Map(locs.map((l) => [l.name, l])), items: new Map(), regions: new Map() },
        isLocationAccessible: () => true,
    });
    beforeEach(() => {
        published = [];
        logic = new TimerLogic({
            stateManager: { getStaticData: () => null, getLatestStateSnapshot: () => null },
            eventBus: { subscribe: () => () => {}, publish: () => {} },
            dispatcher: { publish: (name, payload) => published.push([name, payload.locationName]) },
        });
        logic.batchChecks = false;
        globalThis.window = { centralRegistry: { getPublicFunction: (mod, fn) => (mod === 'gameState' && fn === 'getCurrentRegion' ? () => 'Hub' : null) } };
        // the bot's frozen walk asks the PathFinder per call when it cannot build a map: route it to the table
        logic._pathFinder = { findPathWithExits: findPath };
    });

    it('default: dispatches the first accessible location, as before', async () => {
        const locs = [loc('far', 'Far'), loc('near', 'Near')];
        expect(logic.checkOrder).toBe('sphere-in-order');
        expect(await logic._determineAndDispatchNextLocationCheckWithSnapshot(snapshotInterfaceOf(locs))).toBe(true);
        expect(published).toEqual([['user:locationCheck', 'far']]);
        expect(logic.attemptedChecks.has('far')).toBe(true);
    });

    it('opt-in `reachable-cheapest`: dispatches the chooser\'s target', async () => {
        const locs = [loc('far', 'Far'), loc('near', 'Near')];
        logic.checkOrder = 'reachable-cheapest';
        expect(await logic._determineAndDispatchNextLocationCheckWithSnapshot(snapshotInterfaceOf(locs))).toBe(true);
        expect(published).toEqual([['user:locationCheck', 'near']]);
        expect(logic.attemptedChecks.has('near')).toBe(true);
        expect(logic.attemptedChecks.has('far')).toBe(false);
    });
});
