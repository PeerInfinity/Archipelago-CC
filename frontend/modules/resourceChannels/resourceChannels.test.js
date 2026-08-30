import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    createGameStateSingleton,
    _testOnly_resetGameStateSingleton,
} from '../gameState/singleton.js';
import { applyRegionXpCostEffect } from '../loops/xpFormulas.js';
import {
    initResourceChannelsLibrary,
    _testOnly_resetResourceChannelsLibrary,
    isManaDeclarer,
    isItemsDeclarer,
    getShareableItemTypes,
    xpAdjustedCost,
    chargeMana,
    gainMana,
    setMaxManaBonus,
    resolveStartRegion,
    fireLoopResetTeleport,
    grantItem,
    ITEM_GRANTED_EVENT,
} from './resourceChannelsLibrary.js';
import {
    initialize as initializeModule,
    RESOURCE_DELTA_EVENT,
    RESOURCE_BONUS_EVENT,
    RESOURCE_RESET_EVENT,
    SUBSTRATE_ITEM_GRANT_EVENT,
} from './index.js';

function makeFakeBus() {
    const handlers = new Map();
    const published = [];
    return {
        published,
        subscribe(event, cb) {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(cb);
            return () => {};
        },
        publish(event, data) {
            published.push({ event, data });
            for (const cb of handlers.get(event) ?? []) cb(data);
        },
    };
}

function makeFakeDispatcher() {
    const published = [];
    return {
        published,
        publish(event, data, opts) {
            published.push({ event, data, opts });
        },
    };
}

let warnSpy;

beforeEach(() => {
    substrateRegistry.clear();
    _testOnly_resetGameStateSingleton();
    _testOnly_resetResourceChannelsLibrary();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    warnSpy.mockRestore();
});

function registerManaSubstrate(id = 'ta', mana = {}) {
    substrateRegistry.register({ id, sharing: { mana } });
}

describe('resourceChannelsLibrary declarations', () => {
    it('isManaDeclarer / isItemsDeclarer reflect the registry sharing field', () => {
        registerManaSubstrate('ta');
        substrateRegistry.register({ id: 'jta', sharing: { items: { types: ['Fish'] } } });
        substrateRegistry.register({ id: 'plain' });
        expect(isManaDeclarer('ta')).toBe(true);
        expect(isManaDeclarer('jta')).toBe(false);
        expect(isManaDeclarer('plain')).toBe(false);
        expect(isManaDeclarer('missing')).toBe(false);
        expect(isItemsDeclarer('jta')).toBe(true);
        expect(isItemsDeclarer('ta')).toBe(false);
    });

    it('getShareableItemTypes resolves static lists, providers, and absence', () => {
        substrateRegistry.register({ id: 'a', sharing: { items: { types: ['x', 'y'] } } });
        substrateRegistry.register({ id: 'b', sharing: { items: { getTypes: () => ['z'] } } });
        substrateRegistry.register({
            id: 'c',
            sharing: { items: { getTypes: () => { throw new Error('boom'); } } },
        });
        substrateRegistry.register({ id: 'd' });
        expect(getShareableItemTypes('a')).toEqual(['x', 'y']);
        expect(getShareableItemTypes('b')).toEqual(['z']);
        expect(getShareableItemTypes('c')).toEqual([]);
        expect(getShareableItemTypes('d')).toBeNull();
        expect(getShareableItemTypes('missing')).toBeNull();
    });
});

describe('mana primitives', () => {
    it('chargeMana deducts, awards 1:1 region XP, and reports depletion', () => {
        registerManaSubstrate('ta');
        const gs = createGameStateSingleton(null);
        expect(gs.getCurrentMana()).toBe(100);

        const first = chargeMana({ substrateId: 'ta', amount: 30, regionId: 'R1' });
        expect(first).toEqual({ charged: true, depleted: false });
        expect(gs.getCurrentMana()).toBe(70);
        expect(gs.getRegionXP('R1').xp).toBe(30);

        const second = chargeMana({ substrateId: 'ta', amount: 70, regionId: 'R1' });
        expect(second.depleted).toBe(true);
        // 100 total XP crosses the level-1 threshold (100): level up,
        // remainder 0.
        expect(gs.getRegionXP('R1').level).toBe(1);
        expect(gs.getRegionXP('R1').xp).toBe(0);
    });

    it('chargeMana without a regionId awards no XP (the bridge-style drain)', () => {
        registerManaSubstrate('jta');
        const gs = createGameStateSingleton(null);
        chargeMana({ substrateId: 'jta', amount: 10 });
        expect(gs.getCurrentMana()).toBe(90);
        expect(gs.getRegionXP('R1').xp ?? 0).toBe(0);
    });

    it('gainMana is unclamped (maxMana is starting mana, not a ceiling)', () => {
        registerManaSubstrate('jta');
        const gs = createGameStateSingleton(null);
        gainMana({ substrateId: 'jta', amount: 50 });
        expect(gs.getCurrentMana()).toBe(150);
        expect(gs.getMaxMana()).toBe(100);
    });

    it('setMaxManaBonus feeds the per-substrate accumulator', () => {
        registerManaSubstrate('jta');
        const gs = createGameStateSingleton(null);
        setMaxManaBonus('jta', 25);
        expect(gs.getMaxMana()).toBe(125);
        setMaxManaBonus('jta', 0);
        expect(gs.getMaxMana()).toBe(100);
    });

    it('warns once (and proceeds) for an undeclared substrate id', () => {
        createGameStateSingleton(null);
        chargeMana({ substrateId: 'ghost', amount: 5 });
        chargeMana({ substrateId: 'ghost', amount: 5 });
        const ghostWarns = warnSpy.mock.calls.filter(
            (c) => String(c[0]).includes("'ghost'"),
        );
        expect(ghostWarns).toHaveLength(1);
    });

    it('xpAdjustedCost matches the inline leg computation', () => {
        registerManaSubstrate('ta');
        const gs = createGameStateSingleton(null);
        // No region → base cost unchanged.
        expect(xpAdjustedCost(50, null)).toBe(50);
        // Level 0 (no XP yet) → same as applying the effect at level 0.
        expect(xpAdjustedCost(50, 'R1')).toBe(applyRegionXpCostEffect(50, 0, undefined));
        // Earn XP, then the region's level feeds the reduction.
        gs.addRegionXP('R1', 500);
        const level = gs.getRegionXP('R1').level;
        expect(level).toBeGreaterThan(0);
        expect(xpAdjustedCost(50, 'R1')).toBe(applyRegionXpCostEffect(50, level, undefined));
    });
});

describe('fireLoopResetTeleport', () => {
    it('resets the pool and dispatches the fromReset teleport via the caller dispatcher', () => {
        registerManaSubstrate('ta');
        const gs = createGameStateSingleton(null);
        gs.startRegions = ['Start'];
        gs.deductMana(100);
        const dispatcher = makeFakeDispatcher();

        const target = fireLoopResetTeleport({
            sourceRegion: 'Deep',
            dispatcher,
            dispatchOpts: { initialTarget: 'bottom' },
        });

        expect(target).toBe('Start');
        expect(gs.getCurrentMana()).toBe(100);
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published).toEqual([{
            event: 'user:regionMove',
            data: {
                sourceRegion: 'Deep',
                targetRegion: 'Start',
                fromReset: true,
                updatePath: false,
            },
            opts: { initialTarget: 'bottom' },
        }]);
    });

    it('omits dispatch opts when none are given (textAdventure-wrapper parity)', () => {
        registerManaSubstrate('ta');
        const gs = createGameStateSingleton(null);
        gs.startRegions = ['Start'];
        const dispatcher = makeFakeDispatcher();
        fireLoopResetTeleport({ sourceRegion: 'Deep', dispatcher });
        expect(dispatcher.published[0].opts).toBeUndefined();
    });

    it('still resets when no start region resolves; teleport skipped', () => {
        registerManaSubstrate('ta');
        const gs = createGameStateSingleton(null);
        const dispatcher = makeFakeDispatcher();
        const target = fireLoopResetTeleport({ sourceRegion: 'Deep', dispatcher });
        expect(target).toBeNull();
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published).toHaveLength(0);
    });

    it('fallbackToDeclaredStart:false ignores gs.startRegions', () => {
        registerManaSubstrate('ta');
        const gs = createGameStateSingleton(null);
        gs.startRegions = ['Start'];
        expect(resolveStartRegion({ fallbackToDeclaredStart: false })).toBeNull();
        expect(resolveStartRegion()).toBe('Start');
    });
});

describe('substrate:itemGrant router leg (P2 outbound)', () => {
    // An iframe bridge publishes substrate:itemGrant for a FOREIGN scheduled
    // award (Fork 1.13); the router forwards to the validating grantItem.
    let bus;
    beforeEach(() => {
        substrateRegistry.register({ id: 'omsi', sharing: { items: { types: ['gold'] } } });
        substrateRegistry.register({ id: 'jta', sharing: { items: { types: ['Fish'] } } });
        createGameStateSingleton(null);
        bus = makeFakeBus();
        initializeModule('resourceChannels', 0, {
            getEventBus: () => bus,
            getDispatcher: () => makeFakeDispatcher(),
        });
    });

    it('forwards a valid grant request to the crossSubstrate:itemGranted bus', () => {
        bus.publish(SUBSTRATE_ITEM_GRANT_EVENT, { to: 'omsi', from: 'jta', itemType: 'gold', count: 2 });
        expect(bus.published).toContainEqual({
            event: ITEM_GRANTED_EVENT,
            data: { to: 'omsi', from: 'jta', itemType: 'gold', count: 2 },
        });
    });

    it('drops invalid requests (undeclared type / unknown substrate) without publishing', () => {
        bus.publish(SUBSTRATE_ITEM_GRANT_EVENT, { to: 'omsi', from: 'jta', itemType: 'sandwich', count: 1 });
        bus.publish(SUBSTRATE_ITEM_GRANT_EVENT, { to: 'ghost', from: 'jta', itemType: 'gold', count: 1 });
        bus.publish(SUBSTRATE_ITEM_GRANT_EVENT, { to: 'omsi', from: 'jta', itemType: 'gold', count: 0 });
        expect(bus.published.filter((p) => p.event === ITEM_GRANTED_EVENT)).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(3);
    });
});

describe('grantItem (crossSubstrate:itemGranted bus)', () => {
    beforeEach(() => {
        substrateRegistry.register({ id: 'jta', sharing: { items: { types: ['Fish'] } } });
        substrateRegistry.register({ id: 'maze', sharing: { mana: {} } });
    });

    it('publishes a validated grant', () => {
        const bus = makeFakeBus();
        initResourceChannelsLibrary({ eventBus: bus });
        const ok = grantItem({ to: 'jta', from: 'maze', itemType: 'Fish', count: 2 });
        expect(ok).toBe(true);
        expect(bus.published).toEqual([{
            event: ITEM_GRANTED_EVENT,
            data: { to: 'jta', from: 'maze', itemType: 'Fish', count: 2 },
        }]);
    });

    it("accepts 'host' as the granting side and defaults count to 1", () => {
        const bus = makeFakeBus();
        initResourceChannelsLibrary({ eventBus: bus });
        expect(grantItem({ to: 'jta', from: 'host', itemType: 'Fish' })).toBe(true);
        expect(bus.published[0].data.count).toBe(1);
    });

    it('rejects invalid grants without publishing', () => {
        const bus = makeFakeBus();
        initResourceChannelsLibrary({ eventBus: bus });
        const bad = [
            { from: 'maze', itemType: 'Fish' },                          // missing to
            { to: 'jta', itemType: 'Fish' },                             // missing from
            { to: 'jta', from: 'maze' },                                 // missing itemType
            { to: 'jta', from: 'maze', itemType: 'Fish', count: 0 },     // bad count
            { to: 'jta', from: 'maze', itemType: 'Fish', count: 1.5 },   // bad count
            { to: 'nope', from: 'maze', itemType: 'Fish' },              // unknown to
            { to: 'jta', from: 'nope', itemType: 'Fish' },               // unknown from
            { to: 'maze', from: 'jta', itemType: 'Fish' },               // to lacks items
            { to: 'jta', from: 'maze', itemType: 'Sword' },              // undeclared type
        ];
        for (const grant of bad) {
            expect(grantItem(grant), JSON.stringify(grant)).toBe(false);
        }
        expect(bus.published).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(bad.length);
    });

    it('rejects when the library is uninitialized', () => {
        expect(grantItem({ to: 'jta', from: 'maze', itemType: 'Fish' })).toBe(false);
    });
});

describe('channel event router (index.js)', () => {
    let bus;
    let dispatcher;
    let gs;

    beforeEach(() => {
        registerManaSubstrate('jta');
        gs = createGameStateSingleton(null);
        gs.startRegions = ['Start'];
        bus = makeFakeBus();
        dispatcher = makeFakeDispatcher();
        initializeModule('resourceChannels', 0, {
            getEventBus: () => bus,
            getDispatcher: () => dispatcher,
        });
    });

    it('routes a negative delta to a pool drain (no XP)', () => {
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'jta', resource: 'mana', amount: -30 });
        expect(gs.getCurrentMana()).toBe(70);
        expect(dispatcher.published).toHaveLength(0);
    });

    it('fires the loop-reset teleport when a drain depletes the pool', () => {
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'jta', resource: 'mana', amount: -100 });
        expect(gs.getCurrentMana()).toBe(100); // refilled by the reset
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published).toEqual([{
            event: 'user:regionMove',
            data: {
                sourceRegion: null,
                targetRegion: 'Start',
                fromReset: true,
                updatePath: false,
            },
            opts: { initialTarget: 'bottom' },
        }]);
    });

    it('routes a positive delta to an unclamped gain', () => {
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'jta', resource: 'mana', amount: 40 });
        expect(gs.getCurrentMana()).toBe(140);
    });

    it('ignores zero / non-numeric delta amounts', () => {
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'jta', resource: 'mana', amount: 0 });
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'jta', resource: 'mana', amount: 'x' });
        expect(gs.getCurrentMana()).toBe(100);
    });

    it('drops events from undeclared substrates and unknown resources', () => {
        substrateRegistry.register({ id: 'noMana' });
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'noMana', resource: 'mana', amount: -30 });
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'ghost', resource: 'mana', amount: -30 });
        bus.publish(RESOURCE_DELTA_EVENT, { substrateId: 'jta', resource: 'gold', amount: -30 });
        bus.publish(RESOURCE_DELTA_EVENT, { resource: 'mana', amount: -30 });
        expect(gs.getCurrentMana()).toBe(100);
        expect(warnSpy).toHaveBeenCalledTimes(4);
    });

    it('routes bonus events into the accumulator, clamped at 0', () => {
        bus.publish(RESOURCE_BONUS_EVENT, { substrateId: 'jta', resource: 'mana', bonus: 30 });
        expect(gs.getMaxMana()).toBe(130);
        bus.publish(RESOURCE_BONUS_EVENT, { substrateId: 'jta', resource: 'mana', bonus: -5 });
        expect(gs.getMaxMana()).toBe(100);
        bus.publish(RESOURCE_BONUS_EVENT, { substrateId: 'jta', resource: 'mana', bonus: 'x' });
        expect(gs.getMaxMana()).toBe(100);
    });

    it('answers a reset request with a loop reset', () => {
        bus.publish(RESOURCE_RESET_EVENT, {
            substrateId: 'jta', resource: 'mana', hostResetCount: 0,
        });
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published[0].data.fromReset).toBe(true);
    });

    it('suppresses the reset when one already covered it (race guard)', () => {
        gs.triggerLoopReset(); // host-side reset the bridge hasn't seen yet
        bus.publish(RESOURCE_RESET_EVENT, {
            substrateId: 'jta', resource: 'mana', hostResetCount: 0,
        });
        expect(gs.getLoopResetCount()).toBe(1); // unchanged — no double reset
    });

    it('resets when the bridge count is current or missing', () => {
        bus.publish(RESOURCE_RESET_EVENT, { substrateId: 'jta', resource: 'mana' });
        expect(gs.getLoopResetCount()).toBe(1);
        bus.publish(RESOURCE_RESET_EVENT, {
            substrateId: 'jta', resource: 'mana', hostResetCount: 1,
        });
        expect(gs.getLoopResetCount()).toBe(2);
    });
});
