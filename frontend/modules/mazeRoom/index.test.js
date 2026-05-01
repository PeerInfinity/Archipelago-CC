import { describe, it, expect, beforeEach } from 'vitest';

import {
    register, initialize,
    consumePendingLoadRegion,
    setPanelInstance,
    _testOnly_resetModuleState,
} from './index.js';

// Minimal eventBus mock — records publishes; subscribers are normal
// callbacks invoked synchronously by publish(). Mirrors the shape the
// real per-module wrapper exposes.
function makeMockEventBus() {
    const subscribers = new Map();   // event -> Set<callback>
    const published = [];            // [{event, data}]
    return {
        publish(event, data) {
            published.push({ event, data });
            const subs = subscribers.get(event);
            if (subs) for (const cb of subs) cb(data);
        },
        subscribe(event, callback) {
            if (!subscribers.has(event)) subscribers.set(event, new Set());
            subscribers.get(event).add(callback);
            return () => subscribers.get(event)?.delete(callback);
        },
        published,
    };
}

function makeMockRegistrationApi() {
    const calls = {
        panelComponents: [],
        eventBusPublishers: [],
        dispatcherSenders: [],
    };
    return {
        registerPanelComponent: (type, ctor) => { calls.panelComponents.push({ type, ctor }); },
        registerEventBusPublisher: (event) => { calls.eventBusPublishers.push(event); },
        registerDispatcherSender: (event, direction, target) => {
            calls.dispatcherSenders.push({ event, direction, target });
        },
        _calls: calls,
    };
}

function makeMockInitApi(eventBus) {
    return {
        getEventBus: () => eventBus,
        getDispatcher: () => ({}),
    };
}

describe('mazeRoom index — maze:loadRegion wiring', () => {
    let eventBus;

    beforeEach(async () => {
        _testOnly_resetModuleState();
        eventBus = makeMockEventBus();
        register(makeMockRegistrationApi());
        await initialize('mazeRoom', 0, makeMockInitApi(eventBus));
    });

    it('publishes ui:activatePanel when maze:loadRegion fires', () => {
        eventBus.publish('maze:loadRegion', { region_id: 'region_0_0', world: {}, arrivedFrom: null });
        const activate = eventBus.published.find((p) => p.event === 'ui:activatePanel');
        expect(activate).toBeDefined();
        expect(activate.data).toEqual({ panelId: 'mazeRoomPanel' });
    });

    it('buffers the payload when no panel instance is registered', () => {
        const payload = { region_id: 'region_0_0', world: {}, arrivedFrom: null };
        eventBus.publish('maze:loadRegion', payload);
        const pending = consumePendingLoadRegion();
        expect(pending).toBe(payload);
        // Buffer is drained — second call returns null.
        expect(consumePendingLoadRegion()).toBeNull();
    });

    it('forwards directly to the panel when one is mounted', () => {
        const calls = [];
        const fakePanel = {
            applyLoadedRegion: (payload) => { calls.push(payload); },
        };
        setPanelInstance(fakePanel);
        const payload = { region_id: 'region_0_0', world: {}, arrivedFrom: null };
        eventBus.publish('maze:loadRegion', payload);
        expect(calls).toEqual([payload]);
        // Nothing buffered — the panel handled it directly.
        expect(consumePendingLoadRegion()).toBeNull();
    });

    it('latest buffered payload wins when multiple events arrive before mount', () => {
        eventBus.publish('maze:loadRegion', { region_id: 'first' });
        eventBus.publish('maze:loadRegion', { region_id: 'second' });
        const pending = consumePendingLoadRegion();
        expect(pending.region_id).toBe('second');
    });
});

describe('mazeRoom index — dispatcher sender registration', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
    });

    it('registers user/system:locationCheck and user:regionMove as dispatcher senders', () => {
        const reg = makeMockRegistrationApi();
        register(reg);
        const events = reg._calls.dispatcherSenders.map((s) => s.event);
        expect(events).toContain('user:locationCheck');
        expect(events).toContain('system:locationCheck');
        expect(events).toContain('user:regionMove');
        // All registered with the same chain semantics regionGraph uses.
        for (const sender of reg._calls.dispatcherSenders) {
            expect(sender.direction).toBe('bottom');
            expect(sender.target).toBe('first');
        }
    });
});
