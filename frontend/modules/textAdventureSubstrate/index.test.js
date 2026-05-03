import { describe, it, expect, beforeEach } from 'vitest';

import {
    register, initialize,
    consumePendingLoadRegion,
    setPanelInstance,
    _testOnly_resetModuleState,
} from './index.js';

// Same minimal eventBus / registration shape as mazeRoom's
// index.test.js — keeps the substrate tests independent of the real
// host module wiring.
function makeMockEventBus() {
    const subscribers = new Map();
    const published = [];
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
        settingsSchemas: [],
    };
    return {
        registerPanelComponent: (type, ctor) => { calls.panelComponents.push({ type, ctor }); },
        registerEventBusPublisher: (event) => { calls.eventBusPublishers.push(event); },
        registerDispatcherSender: (event, direction, target) => {
            calls.dispatcherSenders.push({ event, direction, target });
        },
        registerSettingsSchema: (moduleId, schema) => {
            calls.settingsSchemas.push({ moduleId, schema });
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

describe('textAdventureSubstrate index — textAdventure:loadRegion wiring', () => {
    let eventBus;

    beforeEach(async () => {
        _testOnly_resetModuleState();
        eventBus = makeMockEventBus();
        register(makeMockRegistrationApi());
        await initialize('textAdventureSubstrate', 0, makeMockInitApi(eventBus));
    });

    it('publishes ui:activatePanel when textAdventure:loadRegion fires', () => {
        eventBus.publish('textAdventure:loadRegion', {
            region_id: 'region_0_0', world: {}, arrivedFrom: null,
        });
        const activate = eventBus.published.find((p) => p.event === 'ui:activatePanel');
        expect(activate).toBeDefined();
        expect(activate.data).toEqual({ panelId: 'textAdventureSubstratePanel' });
    });

    it('buffers the payload when no panel instance is registered', () => {
        const payload = { region_id: 'region_0_0', world: {}, arrivedFrom: null };
        eventBus.publish('textAdventure:loadRegion', payload);
        const pending = consumePendingLoadRegion();
        expect(pending).toBe(payload);
        expect(consumePendingLoadRegion()).toBeNull();
    });

    it('forwards directly to the panel when one is mounted', () => {
        const calls = [];
        const fakePanel = {
            applyLoadedRegion: (payload) => { calls.push(payload); },
        };
        setPanelInstance(fakePanel);
        const payload = { region_id: 'region_0_0', world: {}, arrivedFrom: null };
        eventBus.publish('textAdventure:loadRegion', payload);
        expect(calls).toEqual([payload]);
        expect(consumePendingLoadRegion()).toBeNull();
    });

    it('latest buffered payload wins when multiple events arrive before mount', () => {
        eventBus.publish('textAdventure:loadRegion', { region_id: 'first' });
        eventBus.publish('textAdventure:loadRegion', { region_id: 'second' });
        const pending = consumePendingLoadRegion();
        expect(pending.region_id).toBe('second');
    });
});

describe('textAdventureSubstrate index — registration', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
    });

    it('registers the panel component under the substrate panel id', () => {
        const reg = makeMockRegistrationApi();
        register(reg);
        const types = reg._calls.panelComponents.map((p) => p.type);
        expect(types).toContain('textAdventureSubstratePanel');
    });

    it('registers user:locationCheck and user:regionMove as dispatcher senders', () => {
        const reg = makeMockRegistrationApi();
        register(reg);
        const events = reg._calls.dispatcherSenders.map((s) => s.event);
        expect(events).toContain('user:locationCheck');
        expect(events).toContain('user:regionMove');
        for (const sender of reg._calls.dispatcherSenders) {
            expect(sender.direction).toBe('bottom');
            expect(sender.target).toBe('first');
        }
    });

    it('registers a settings schema with messageHistoryLimit + autoFocusCommandInput', () => {
        const reg = makeMockRegistrationApi();
        register(reg);
        const entry = reg._calls.settingsSchemas.find(
            (s) => s.moduleId === 'textAdventureSubstrate',
        );
        expect(entry).toBeDefined();
        expect(entry.schema).toHaveProperty('messageHistoryLimit');
        expect(entry.schema.messageHistoryLimit.default).toBe(10);
        expect(entry.schema).toHaveProperty('autoFocusCommandInput');
        expect(entry.schema.autoFocusCommandInput.default).toBe(true);
    });
});
