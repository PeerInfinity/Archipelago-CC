import { describe, it, expect, beforeEach } from 'vitest';

import {
    register, initialize,
    _testOnly_resetModuleState,
    _testOnly_getWarehouse,
} from './index.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

function makeMockEventBus() {
    const subscribers = new Map();
    const published = [];
    const registeredPublishers = new Set();
    return {
        publish(event, data) {
            published.push({ event, data });
            const subs = subscribers.get(event);
            if (subs) for (const cb of subs) cb(data);
        },
        subscribe(event, cb) {
            if (!subscribers.has(event)) subscribers.set(event, new Set());
            subscribers.get(event).add(cb);
            return () => subscribers.get(event)?.delete(cb);
        },
        registerPublisher(event) { registeredPublishers.add(event); },
        published, registeredPublishers,
    };
}

function makeMockDispatcher() {
    const forwarded = [];
    const published = [];
    return {
        publish(eventName, data, options) {
            published.push({ eventName, data, options });
        },
        publishToNextModule(moduleId, eventName, data, opts) {
            forwarded.push({ moduleId, eventName, data, opts });
        },
        forwarded, published,
    };
}

function makeMockRegistrationApi() {
    const calls = { dispatcherReceivers: [], dispatcherSenders: [] };
    return {
        registerDispatcherReceiver: (...args) => { calls.dispatcherReceivers.push(args); },
        registerDispatcherSender: (eventName, direction, target) => {
            calls.dispatcherSenders.push({ eventName, direction, target });
        },
        _calls: calls,
    };
}

function makeMockInitApi(eventBus, dispatcher) {
    return {
        getEventBus: () => eventBus,
        getDispatcher: () => dispatcher,
        getLogger: () => ({ warn: () => {}, info: () => {}, error: () => {} }),
    };
}

const SAMPLE_RULES = {
    start_regions: { 1: ['Menu'] },
    regions: {
        1: {
            Menu: { exits: [{ name: 'GameStart', connected_region: 'region_0_0' }] },
            region_0_0: { exits: [], locations: [] },
            region_0_1: { exits: [], locations: [] },
        },
    },
    preset_sidecars: {
        1: {
            region_0_0: { substrate: 'maze', playable_payload: { tag: 'r00' } },
            region_0_1: { substrate: 'maze', playable_payload: { tag: 'r01' } },
        },
    },
};

const FAKE_MAZE_ENTRY = {
    id: 'maze',
    loadRegionEvent: 'maze:loadRegion',
    deserializeWorld: (sidecar) => ({ kind: 'world', tag: sidecar.tag }),
};

describe('procgenPlayer index', () => {
    let eventBus;
    let dispatcher;

    beforeEach(async () => {
        _testOnly_resetModuleState();
        substrateRegistry.clear();
        substrateRegistry.register(FAKE_MAZE_ENTRY);
        eventBus = makeMockEventBus();
        dispatcher = makeMockDispatcher();
        register(makeMockRegistrationApi());
        await initialize('procgenPlayer', 0, makeMockInitApi(eventBus, dispatcher));
    });

    it('registers a dispatcher receiver for user:regionMove', () => {
        _testOnly_resetModuleState();
        const reg = makeMockRegistrationApi();
        register(reg);
        const events = reg._calls.dispatcherReceivers.map((args) => args[1]);
        expect(events).toEqual(['user:regionMove']);
    });

    it('registers as a dispatcher sender for user:regionMove (initial-load synthesis)', () => {
        _testOnly_resetModuleState();
        const reg = makeMockRegistrationApi();
        register(reg);
        const senders = reg._calls.dispatcherSenders.map((s) => s.eventName);
        expect(senders).toContain('user:regionMove');
    });

    it('registers as publisher for every substrate loadRegion event', () => {
        expect(eventBus.registeredPublishers.has('maze:loadRegion')).toBe(true);
    });

    it('ignores rawJsonDataLoaded payloads without preset_sidecars', () => {
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: { start_regions: { 1: ['Menu'] } }, selectedPlayerInfo: { playerId: '1' } });
        eventBus.publish('stateManager:rulesLoaded', {});
        expect(_testOnly_getWarehouse()).toBeNull();
        expect(dispatcher.published).toHaveLength(0);
    });

    it('builds the warehouse on rawJsonDataLoaded but defers the publish until rulesLoaded', () => {
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        const wh = _testOnly_getWarehouse();
        expect(wh.size()).toBe(2);
        // Nothing published yet — the initial user:regionMove is
        // deferred so it doesn't race gameState's reset() on rulesLoaded.
        expect(dispatcher.published).toHaveLength(0);
    });

    it('publishes the synthesized user:regionMove on stateManager:rulesLoaded', () => {
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        eventBus.publish('stateManager:rulesLoaded', {});
        expect(dispatcher.published).toHaveLength(1);
        expect(dispatcher.published[0].eventName).toBe('user:regionMove');
        expect(dispatcher.published[0].data).toEqual({
            sourceRegion: 'Menu',
            targetRegion: 'region_0_0',
            exitName: 'GameStart',
        });
    });

    it('does not republish on subsequent stateManager:rulesLoaded firings', () => {
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        eventBus.publish('stateManager:rulesLoaded', {});
        eventBus.publish('stateManager:rulesLoaded', {});
        expect(dispatcher.published).toHaveLength(1);
    });

    it('clears the warehouse on a subsequent non-procgen rawJsonDataLoaded', () => {
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        expect(_testOnly_getWarehouse()).not.toBeNull();
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: { start_regions: { 1: ['Menu'] } }, selectedPlayerInfo: { playerId: '1' } });
        expect(_testOnly_getWarehouse()).toBeNull();
    });

    it('publishes loadRegion for the target region on user:regionMove (when in warehouse)', () => {
        const reg = makeMockRegistrationApi();
        _testOnly_resetModuleState();
        register(reg);
        eventBus = makeMockEventBus();
        dispatcher = makeMockDispatcher();
        initialize('procgenPlayer', 0, makeMockInitApi(eventBus, dispatcher));
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        const handler = reg._calls.dispatcherReceivers[0][2];

        const baseline = eventBus.published.length;
        handler({ targetRegion: 'region_0_1', exitName: 'exit', sourceRegion: 'region_0_0' });
        const newLoadEvents = eventBus.published.slice(baseline)
            .filter((p) => p.event === 'maze:loadRegion');
        expect(newLoadEvents).toHaveLength(1);
        expect(newLoadEvents[0].data.region_id).toBe('region_0_1');
        expect(newLoadEvents[0].data.arrivedFrom).toEqual({ exit_id: 'exit' });
        // Always forwards on the dispatcher chain.
        expect(dispatcher.forwarded).toHaveLength(1);
        expect(dispatcher.forwarded[0].eventName).toBe('user:regionMove');
    });

    it('does not publish loadRegion for region moves to non-warehoused regions, but still forwards', () => {
        const reg = makeMockRegistrationApi();
        _testOnly_resetModuleState();
        register(reg);
        eventBus = makeMockEventBus();
        dispatcher = makeMockDispatcher();
        initialize('procgenPlayer', 0, makeMockInitApi(eventBus, dispatcher));
        eventBus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        const baseline = eventBus.published.length;
        const handler = reg._calls.dispatcherReceivers[0][2];
        handler({ targetRegion: 'Menu', exitName: null, sourceRegion: 'region_0_0' });
        const newLoadEvents = eventBus.published.slice(baseline)
            .filter((p) => p.event === 'maze:loadRegion');
        expect(newLoadEvents).toHaveLength(0);
        expect(dispatcher.forwarded).toHaveLength(1);
    });
});
