/**
 * Tests for Manual mode action handling in loopState.
 *
 * Manual entries pause queue processing, auto-activate the substrate
 * panel, and wait for either a region change (advance past the manual
 * entry on matching exit; otherwise set _queuePausedUntilReset) or
 * mana-zero (trigger a loop reset).
 */
import {
    describe,
    it,
    expect,
    beforeEach,
    beforeAll,
    afterAll,
    vi,
} from 'vitest';
import {
    installRafShim,
    uninstallRafShim,
    makeWired,
    makeTicker,
    makeStubStateManager,
} from './testHarness.js';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

// Functional eventBus stub — testHarness.makeBus is publish-only,
// but manual-mode wake handlers need real subscribe/fire behavior.
function makeFunctionalBus() {
    const subs = new Map();
    const events = [];
    return {
        events,
        subscribe: (name, cb) => {
            if (!subs.has(name)) subs.set(name, []);
            subs.get(name).push(cb);
            return () => {
                const list = subs.get(name);
                if (!list) return;
                const i = list.indexOf(cb);
                if (i !== -1) list.splice(i, 1);
            };
        },
        unsubscribe: (name, cb) => {
            const list = subs.get(name);
            if (!list) return;
            const i = list.indexOf(cb);
            if (i !== -1) list.splice(i, 1);
        },
        publish: (name, data) => {
            events.push({ name, data });
            (subs.get(name) ?? []).slice().forEach((cb) => cb(data));
        },
    };
}

function wireWithFunctionalBus({ startRegion = 'Menu' } = {}) {
    const bus = makeFunctionalBus();
    const gs = new GameState(bus);
    const loopState = new LoopState();
    const dispatcher = { publish: () => {}, publishToNextModule: () => {} };
    loopState.setDependencies({
        eventBus: bus,
        stateManager: makeStubStateManager(),
        dispatcher,
        gameState: {
            getState: () => gs,
            getPath: () => gs.getPath(),
            getCurrentRegion: () => gs.getCurrentRegion(),
            getCurrentMana: () => gs.getCurrentMana(),
            getMaxMana: () => gs.getMaxMana(),
            refillMana: () => gs.refillMana(),
            clearPath: () => gs.clearPath(),
            addLocationCheck: (l, r, sd) => gs.addLocationCheck(l, r, sd),
            addCustomAction: (a, p) => gs.addCustomAction(a, p),
            addManualAction: (r) => gs.addManualAction(r),
            removePathEntry: (idx) => gs.removePathEntry(idx),
            trimPath: (r, i) => gs.trimPath(r, i),
        },
    });
    gs.setStartRegions([startRegion]);
    gs.setCurrentRegion(startRegion);
    return { loopState, gs, bus, dispatcher };
}

describe('Manual mode — processFrame handling', () => {
    let loopState, gs, bus, dispatcher;
    let tick;

    beforeEach(() => {
        ({ loopState, gs, bus, dispatcher } = wireWithFunctionalBus());
        tick = makeTicker();
        // Register a fake substrate so the manual handler can resolve
        // a panel componentType for the test region. The auto-activate
        // publish is what we'll assert.
        try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
        try { substrateRegistry.clear?.(); } catch { /* ignore */ }
        substrateRegistry.register?.({
            id: 'test_substrate',
            label: 'Test',
            panelComponentType: 'testSubstratePanel',
            loadRegionEvent: 'test:loadRegion',
        });
        centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => {
            if (region === 'manualRegion') {
                return { substrate: 'test_substrate', label: 'Test', manaEnabled: true };
            }
            return null;
        });
    });

    function setupManualQueue() {
        // Queue: regionMove(Menu→manualRegion), manual(manualRegion), regionMove(manualRegion→nextRegion)
        gs.updatePath('manualRegion', 'go', 'Menu');
        gs.addManualAction('manualRegion');
        gs.updatePath('nextRegion', 'exit', 'manualRegion');
        loopState.setLoopModeActive?.(true);
        loopState.startProcessing();
    }

    it('publishes ui:activatePanel for the substrate panel when a manual entry is reached', () => {
        setupManualQueue();
        // Skip to the manual action.
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        const activatePublishes = [];
        const sub = bus.events?.length;
        const off = bus.subscribe('ui:activatePanel', (data) => {
            activatePublishes.push(data);
        });
        tick(loopState);
        off?.();
        expect(activatePublishes).toContainEqual({ panelId: 'testSubstratePanel' });
    });

    it('stops processing on entering a manual entry (queue parks)', () => {
        setupManualQueue();
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);
        expect(loopState.isProcessing).toBe(false);
        expect(loopState._manualActionEntered).toBe(true);
    });

    it('publishes loopState:manualEntered with the expected next region', () => {
        setupManualQueue();
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        const events = [];
        bus.subscribe('loopState:manualEntered', (data) => events.push(data));
        tick(loopState);
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            regionName: 'manualRegion',
            expectedNextRegion: 'nextRegion',
        });
    });

    it('advances past the manual entry on a matching regionChanged', () => {
        setupManualQueue();
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);
        // Player exits to the expected region.
        const resumeEvents = [];
        bus.subscribe('loopState:manualResumed', (data) => resumeEvents.push(data));
        bus.publish('gameState:regionChanged', { newRegion: 'nextRegion' });
        expect(resumeEvents).toEqual([{ targetRegion: 'nextRegion' }]);
        expect(loopState.currentActionIndex).toBe(2);
        expect(loopState._manualActionEntered).toBe(false);
        expect(loopState._queuePausedUntilReset).toBe(false);
    });

    it('sets _queuePausedUntilReset on mismatched regionChanged', () => {
        setupManualQueue();
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);
        const pausedEvents = [];
        bus.subscribe('loopState:queuePausedUntilReset', (data) => pausedEvents.push(data));
        bus.publish('gameState:regionChanged', { newRegion: 'wrongRegion' });
        expect(loopState._queuePausedUntilReset).toBe(true);
        expect(pausedEvents).toHaveLength(1);
        expect(pausedEvents[0]).toMatchObject({
            actualRegion: 'wrongRegion',
            expectedRegion: 'nextRegion',
            reason: 'manualWrongRegion',
        });
        // currentActionIndex did NOT advance.
        expect(loopState.currentActionIndex).toBe(1);
    });

    it('triggers a loop reset when mana hits zero during manual mode', () => {
        setupManualQueue();
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);
        // Drain mana to zero.
        gs.currentMana = 0;
        bus.publish('gameState:manaChanged', {});
        // Loop reset puts cursor back to 0.
        expect(loopState.currentActionIndex).toBe(0);
        // Mana refilled.
        expect(gs.currentMana).toBe(gs.maxMana);
    });

    it('_resetLoop clears _queuePausedUntilReset and _manualActionEntered', () => {
        setupManualQueue();
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);
        // Force the paused-until-reset state.
        bus.publish('gameState:regionChanged', { newRegion: 'wrongRegion' });
        expect(loopState._queuePausedUntilReset).toBe(true);

        loopState._resetLoop();

        expect(loopState._queuePausedUntilReset).toBe(false);
        expect(loopState._manualActionEntered).toBe(false);
    });

    it('_processFrame is a no-op while _queuePausedUntilReset is set', () => {
        setupManualQueue();
        loopState._queuePausedUntilReset = true;
        loopState.isProcessing = true;
        const beforeIndex = loopState.currentActionIndex;
        tick(loopState);
        expect(loopState.currentActionIndex).toBe(beforeIndex);
        expect(loopState.isProcessing).toBe(false);
    });

    it('wake handlers are no-ops when current action is not manual', () => {
        // Standard non-manual queue. The wake handlers should NOT
        // advance anything.
        gs.updatePath('manualRegion', 'go', 'Menu');
        gs.updatePath('nextRegion', 'exit', 'manualRegion');
        loopState.startProcessing();
        const before = {
            idx: loopState.currentActionIndex,
            paused: loopState._queuePausedUntilReset,
        };
        bus.publish('gameState:regionChanged', { newRegion: 'someRandomRegion' });
        bus.publish('gameState:manaChanged', {});
        expect(loopState.currentActionIndex).toBe(before.idx);
        expect(loopState._queuePausedUntilReset).toBe(before.paused);
    });
});

describe('Manual mode — cost calculation', () => {
    let loopState, gs;
    beforeEach(() => {
        ({ loopState, gs } = makeWired());
    });

    it('manual entries cost 0 mana (no queue-side accrual)', () => {
        gs.addManualAction('Menu');
        const action = loopState.getActionQueue()[0];
        expect(loopState._calculateActionCost(action)).toBe(0);
    });

    it('customQueue entries cost 0 mana (substrate consumes during replay)', () => {
        gs.addCustomQueueAction('Menu', { recordedAt: 1 }, 'queue-name');
        const action = loopState.getActionQueue()[0];
        expect(loopState._calculateActionCost(action)).toBe(0);
    });
});

describe('Custom Queue — processFrame handling', () => {
    let loopState, gs, bus;
    let tick;
    const replayCalls = [];
    const FAKE_SUBSTRATE_ENTRY = {
        id: 'test_substrate',
        label: 'Test',
        panelComponentType: 'testSubstratePanel',
        loadRegionEvent: 'test:loadRegion',
        getPlaybackController: () => ({
            replayActions: (actions, opts) => {
                replayCalls.push({ actions, opts });
            },
        }),
    };

    beforeEach(() => {
        ({ loopState, gs, bus } = wireWithFunctionalBus());
        tick = makeTicker();
        replayCalls.length = 0;
        try { substrateRegistry.clear?.(); } catch { /* ignore */ }
        substrateRegistry.register?.(FAKE_SUBSTRATE_ENTRY);
        try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
        centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => {
            if (region === 'cqRegion') {
                return { substrate: 'test_substrate', label: 'Test', manaEnabled: true };
            }
            return null;
        });
        // Seed loopState's cached rules data so the savedQueue lookup
        // can compute a rules-hash.
        bus.publish('stateManager:rawJsonDataLoaded', {
            rawJsonData: { regions: { 1: ['cqRegion'] } },
        });
    });

    function setupCustomQueueQueue() {
        // Pre-seed a saved queue for cqRegion via the savedQueueStore.
        const rulesHash = require('../shared/rulesHash.js').hashRulesData({ regions: { 1: ['cqRegion'] } });
        // Use a synchronous import indirection via the dynamic require
        // — vitest under node supports both.
        return rulesHash;
    }

    it('looks up the saved queue and dispatches replayActions on the substrate', async () => {
        const { saveQueue, _testOnly_clearAll } = await import('./savedQueueStore.js');
        const { hashRulesData, clearRulesHashCache } = await import('../shared/rulesHash.js');
        _testOnly_clearAll();
        clearRulesHashCache();
        const rulesHash = hashRulesData({ regions: { 1: ['cqRegion'] } });
        saveQueue(rulesHash, {
            regionName: 'cqRegion',
            substrate: 'test_substrate',
            arrivalExitId: 'entrance',
            departureExitId: 'north',
            actions: [{ type: 'move', dir: 'N' }, { type: 'move', dir: 'E' }],
            manaAtEntry: 100, manaAtExit: 90, manaMin: 88,
            locationsChecked: [], itemsPickedUp: [],
            recordedAt: 7777,
        });

        // Build a queue: regionMove(Menu→cqRegion), customQueue(cqRegion), regionMove(cqRegion→after)
        gs.updatePath('cqRegion', 'go', 'Menu');
        gs.addCustomQueueAction('cqRegion', { recordedAt: 7777 }, 'my saved queue');
        gs.updatePath('after', 'north', 'cqRegion');
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;

        tick(loopState);

        expect(replayCalls).toHaveLength(1);
        expect(replayCalls[0].actions).toEqual([
            { type: 'move', dir: 'N' },
            { type: 'move', dir: 'E' },
        ]);
        expect(loopState._manualActionEntered).toBe(true);
        expect(loopState.isProcessing).toBe(false);
    });

    it('publishes manualEntered with customQueue metadata', async () => {
        const { saveQueue, _testOnly_clearAll } = await import('./savedQueueStore.js');
        const { hashRulesData, clearRulesHashCache } = await import('../shared/rulesHash.js');
        _testOnly_clearAll();
        clearRulesHashCache();
        const rulesHash = hashRulesData({ regions: { 1: ['cqRegion'] } });
        saveQueue(rulesHash, {
            regionName: 'cqRegion',
            substrate: 'test_substrate',
            arrivalExitId: 'entrance',
            departureExitId: 'n',
            actions: [{ type: 'wait' }],
            manaAtEntry: 100, manaAtExit: 99, manaMin: 99,
            locationsChecked: [], itemsPickedUp: [],
            recordedAt: 9000,
        });

        gs.updatePath('cqRegion', 'go', 'Menu');
        gs.addCustomQueueAction('cqRegion', { recordedAt: 9000 }, 'queue9');
        gs.updatePath('after', 'n', 'cqRegion');
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;

        const entered = [];
        bus.subscribe('loopState:manualEntered', (data) => entered.push(data));
        tick(loopState);

        expect(entered).toHaveLength(1);
        expect(entered[0]).toMatchObject({
            regionName: 'cqRegion',
            expectedNextRegion: 'after',
            customQueue: { queueName: 'queue9', recordedAt: 9000 },
        });
    });

    it('falls through to manual-mode banner when the saved queue is missing', async () => {
        const { _testOnly_clearAll } = await import('./savedQueueStore.js');
        const { clearRulesHashCache } = await import('../shared/rulesHash.js');
        _testOnly_clearAll();
        clearRulesHashCache();

        gs.updatePath('cqRegion', 'go', 'Menu');
        gs.addCustomQueueAction('cqRegion', { recordedAt: 12345 }, 'missing');
        gs.updatePath('after', 'n', 'cqRegion');
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;

        tick(loopState);

        // No replay was dispatched (no saved queue exists).
        expect(replayCalls).toEqual([]);
        // Manual-mode flags are still set so the player can drive
        // and the same wake handlers fire on exit.
        expect(loopState._manualActionEntered).toBe(true);
        expect(loopState.isProcessing).toBe(false);
    });

    it('matching regionChanged advances past the customQueue entry', async () => {
        const { saveQueue, _testOnly_clearAll } = await import('./savedQueueStore.js');
        const { hashRulesData, clearRulesHashCache } = await import('../shared/rulesHash.js');
        _testOnly_clearAll();
        clearRulesHashCache();
        const rulesHash = hashRulesData({ regions: { 1: ['cqRegion'] } });
        saveQueue(rulesHash, {
            regionName: 'cqRegion', substrate: 'test_substrate',
            arrivalExitId: 'entrance', departureExitId: 'n',
            actions: [{ type: 'wait' }],
            manaAtEntry: 100, manaAtExit: 99, manaMin: 99,
            locationsChecked: [], itemsPickedUp: [],
            recordedAt: 5,
        });

        gs.updatePath('cqRegion', 'go', 'Menu');
        gs.addCustomQueueAction('cqRegion', { recordedAt: 5 });
        gs.updatePath('after', 'n', 'cqRegion');
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);

        bus.publish('gameState:regionChanged', { newRegion: 'after' });
        expect(loopState.currentActionIndex).toBe(2);
        expect(loopState._manualActionEntered).toBe(false);
        expect(loopState._queuePausedUntilReset).toBe(false);
    });

    it('mismatched regionChanged sets _queuePausedUntilReset (same as manual mode)', async () => {
        const { saveQueue, _testOnly_clearAll } = await import('./savedQueueStore.js');
        const { hashRulesData, clearRulesHashCache } = await import('../shared/rulesHash.js');
        _testOnly_clearAll();
        clearRulesHashCache();
        const rulesHash = hashRulesData({ regions: { 1: ['cqRegion'] } });
        saveQueue(rulesHash, {
            regionName: 'cqRegion', substrate: 'test_substrate',
            arrivalExitId: 'entrance', departureExitId: 'n',
            actions: [{ type: 'wait' }],
            manaAtEntry: 100, manaAtExit: 99, manaMin: 99,
            locationsChecked: [], itemsPickedUp: [],
            recordedAt: 5,
        });

        gs.updatePath('cqRegion', 'go', 'Menu');
        gs.addCustomQueueAction('cqRegion', { recordedAt: 5 });
        gs.updatePath('after', 'n', 'cqRegion');
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        loopState.isProcessing = true;
        tick(loopState);

        bus.publish('gameState:regionChanged', { newRegion: 'wrongRegion' });
        expect(loopState._queuePausedUntilReset).toBe(true);
    });
});
