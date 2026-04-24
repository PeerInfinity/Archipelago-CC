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

    it('ignores files:jsonLoaded payloads without preset_sidecars', () => {
        eventBus.publish('files:jsonLoaded', { jsonData: { start_regions: { 1: ['Menu'] } }, selectedPlayerId: '1' });
        expect(_testOnly_getWarehouse()).toBeNull();
        const loadEvents = eventBus.published.filter((p) => p.event === 'maze:loadRegion');
        expect(loadEvents).toHaveLength(0);
    });

    it('builds the warehouse and synthesizes user:regionMove(Menu -> start) on procgen-shaped payloads', () => {
        eventBus.publish('files:jsonLoaded', { jsonData: SAMPLE_RULES, selectedPlayerId: '1' });
        const wh = _testOnly_getWarehouse();
        expect(wh.size()).toBe(2);

        // The initial-load path no longer calls publishLoadRegion
        // directly — it publishes a user:regionMove on the dispatcher
        // that the module's own handleRegionMove will route to
        // maze:loadRegion when the chain visits it. The dispatcher
        // publish is what the test asserts.
        expect(dispatcher.published).toHaveLength(1);
        expect(dispatcher.published[0].eventName).toBe('user:regionMove');
        expect(dispatcher.published[0].data).toEqual({
            sourceRegion: 'Menu',
            targetRegion: 'region_0_0',
            exitName: 'GameStart',
        });

        // loadRegion isn't published from handleFilesJsonLoaded itself.
        const loadEvents = eventBus.published.filter((p) => p.event === 'maze:loadRegion');
        expect(loadEvents).toHaveLength(0);
    });

    it('clears the warehouse on a subsequent non-procgen files:jsonLoaded', () => {
        eventBus.publish('files:jsonLoaded', { jsonData: SAMPLE_RULES, selectedPlayerId: '1' });
        expect(_testOnly_getWarehouse()).not.toBeNull();
        eventBus.publish('files:jsonLoaded', { jsonData: { start_regions: { 1: ['Menu'] } }, selectedPlayerId: '1' });
        expect(_testOnly_getWarehouse()).toBeNull();
    });

    it('publishes loadRegion for the target region on user:regionMove (when in warehouse)', () => {
        // First load so warehouse exists
        eventBus.publish('files:jsonLoaded', { jsonData: SAMPLE_RULES, selectedPlayerId: '1' });
        const before = eventBus.published.length;
        // Get the receiver and call it directly (mimicking dispatcher)
        const reg = makeMockRegistrationApi();
        _testOnly_resetModuleState();
        register(reg);
        eventBus = makeMockEventBus();
        dispatcher = makeMockDispatcher();
        initialize('procgenPlayer', 0, makeMockInitApi(eventBus, dispatcher));
        eventBus.publish('files:jsonLoaded', { jsonData: SAMPLE_RULES, selectedPlayerId: '1' });
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
        eventBus.publish('files:jsonLoaded', { jsonData: SAMPLE_RULES, selectedPlayerId: '1' });
        const baseline = eventBus.published.length;
        const handler = reg._calls.dispatcherReceivers[0][2];
        handler({ targetRegion: 'Menu', exitName: null, sourceRegion: 'region_0_0' });
        const newLoadEvents = eventBus.published.slice(baseline)
            .filter((p) => p.event === 'maze:loadRegion');
        expect(newLoadEvents).toHaveLength(0);
        expect(dispatcher.forwarded).toHaveLength(1);
    });
});
