import { describe, it, expect, beforeEach } from 'vitest';

import {
    register, initialize,
    _testOnly_resetModuleState,
    _testOnly_getWarehouse,
} from './index.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { skipsStart } from '../menuPanel/menuPanelEngine.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

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
    const calls = {
        dispatcherReceivers: [],
        dispatcherSenders: [],
        publicFunctions: new Map(),
        eventBusPublishers: new Set(),
    };
    return {
        registerDispatcherReceiver: (...args) => { calls.dispatcherReceivers.push(args); },
        registerDispatcherSender: (eventName, direction, target) => {
            calls.dispatcherSenders.push({ eventName, direction, target });
        },
        registerPublicFunction: (moduleName, fnName, fn) => {
            calls.publicFunctions.set(`${moduleName}.${fnName}`, fn);
        },
        registerEventBusPublisher: (eventName) => {
            calls.eventBusPublishers.add(eventName);
        },
        _calls: calls,
    };
}

function makeMockInitApi(eventBus, dispatcher, moduleFunctions = {}) {
    return {
        getEventBus: () => eventBus,
        getDispatcher: () => dispatcher,
        getLogger: () => ({ warn: () => {}, info: () => {}, error: () => {} }),
        // menuPanel.isSkipMenuEnabled is looked up here; an api WITHOUT this
        // hook (the default in the block below) is the "menuPanel not loaded"
        // shape, which must keep the pre-M1 unconditional hop.
        getModuleFunction: (moduleId, fnName) => moduleFunctions[`${moduleId}.${fnName}`] ?? null,
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
    label: 'Maze',
    panelComponentType: 'mazeRoomPanel',
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
            // M3b: marks the synthesized placement as a planning source —
            // exempt from the strict action gate and from the loop-mode
            // path-append retirement.
            source: 'procgenPlayer-start',
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
        expect(newLoadEvents[0].data.arrivedFrom).toEqual({ exit_id: 'exit', source_region: 'region_0_0' });
        // Always forwards on the dispatcher chain.
        expect(dispatcher.forwarded).toHaveLength(1);
        expect(dispatcher.forwarded[0].eventName).toBe('user:regionMove');
    });

    it('resolves arrivedFrom.exit_id via the source exit\'s targetExitId', () => {
        // A custom registry entry whose worlds carry an exits Map
        // with a targetExitId on each — simulating a bidirectional
        // sidecar where the source exit names its peer in the target.
        const FAKE_MAZE_BIDIR = {
            id: 'maze',
            loadRegionEvent: 'maze:loadRegion',
            deserializeWorld: (sidecar) => ({
                exits: new Map(Object.entries(sidecar.exits ?? {})),
            }),
        };
        const RULES_BIDIR = {
            start_regions: { 1: ['Menu'] },
            regions: {
                1: {
                    Menu: { exits: [{ name: 'GameStart', connected_region: 'A' }] },
                    A: { exits: [], locations: [] },
                    B: { exits: [], locations: [] },
                },
            },
            preset_sidecars: {
                1: {
                    A: {
                        substrate: 'maze',
                        playable_payload: {
                            exits: { exit: { exit_id: 'exit', targetRegion: 'B', targetExitId: 'A' } },
                        },
                    },
                    B: {
                        substrate: 'maze',
                        playable_payload: { exits: { A: { exit_id: 'A' } } },
                    },
                },
            },
        };

        substrateRegistry.clear();
        substrateRegistry.register(FAKE_MAZE_BIDIR);
        const reg = makeMockRegistrationApi();
        _testOnly_resetModuleState();
        register(reg);
        eventBus = makeMockEventBus();
        dispatcher = makeMockDispatcher();
        initialize('procgenPlayer', 0, makeMockInitApi(eventBus, dispatcher));
        eventBus.publish('stateManager:rawJsonDataLoaded', {
            rawJsonData: RULES_BIDIR, selectedPlayerInfo: { playerId: '1' },
        });

        const handler = reg._calls.dispatcherReceivers[0][2];
        const baseline = eventBus.published.length;
        // Player crosses A's `exit` (the dispatcher names it that way),
        // arriving in B. arrivedFrom.exit_id should resolve to A
        // (B's back-exit id, per source.targetExitId).
        handler({ targetRegion: 'B', exitName: 'exit', sourceRegion: 'A' });
        const newLoadEvents = eventBus.published.slice(baseline)
            .filter((p) => p.event === 'maze:loadRegion');
        expect(newLoadEvents).toHaveLength(1);
        expect(newLoadEvents[0].data.arrivedFrom).toEqual({ exit_id: 'A', source_region: 'A' });
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

    describe('procgen:activeSubstrateChanged', () => {
        function setup() {
            _testOnly_resetModuleState();
            const reg = makeMockRegistrationApi();
            register(reg);
            const bus = makeMockEventBus();
            const disp = makeMockDispatcher();
            initialize('procgenPlayer', 0, makeMockInitApi(bus, disp));
            return { reg, bus, disp };
        }

        function activeSubstrateEvents(bus) {
            return bus.published.filter((p) => p.event === 'procgen:activeSubstrateChanged');
        }

        it('registers procgen:activeSubstrateChanged as a publisher', () => {
            const reg = makeMockRegistrationApi();
            _testOnly_resetModuleState();
            register(reg);
            expect(reg._calls.eventBusPublishers.has('procgen:activeSubstrateChanged')).toBe(true);
        });

        it('exposes getActiveSubstrate as a public function', () => {
            const reg = makeMockRegistrationApi();
            _testOnly_resetModuleState();
            register(reg);
            expect(reg._calls.publicFunctions.has('procgenPlayer.getActiveSubstrate')).toBe(true);
        });

        it('emits the active substrate payload when entering a warehoused region', () => {
            const { reg, bus } = setup();
            bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
            // initial-load synthesis goes through the dispatcher, so
            // drive the receiver directly to simulate the regionMove
            // landing back on this module.
            const handler = reg._calls.dispatcherReceivers[0][2];
            handler({ targetRegion: 'region_0_0', exitName: 'GameStart', sourceRegion: 'Menu' });
            const events = activeSubstrateEvents(bus);
            expect(events).toHaveLength(1);
            expect(events[0].data).toEqual({
                substrate: 'maze',
                componentType: 'mazeRoomPanel',
                label: 'Maze',
                regionId: 'region_0_0',
            });
        });

        it('emits null payload when moving to a non-warehoused region (e.g. Menu)', () => {
            const { reg, bus } = setup();
            bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
            const handler = reg._calls.dispatcherReceivers[0][2];
            // Move into a warehoused region first.
            handler({ targetRegion: 'region_0_0', exitName: 'GameStart', sourceRegion: 'Menu' });
            // Then move back out to Menu (not in the warehouse).
            handler({ targetRegion: 'Menu', exitName: null, sourceRegion: 'region_0_0' });
            const events = activeSubstrateEvents(bus);
            expect(events.length).toBeGreaterThanOrEqual(2);
            expect(events[events.length - 1].data).toBeNull();
        });

        it('emits null when a subsequent rawJsonDataLoaded is non-procgen (warehouse cleared)', () => {
            const { bus } = setup();
            bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
            bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: { start_regions: { 1: ['Menu'] } }, selectedPlayerInfo: { playerId: '1' } });
            const events = activeSubstrateEvents(bus);
            expect(events[events.length - 1].data).toBeNull();
        });

        it('getActiveSubstrate returns the most recently broadcast payload', () => {
            const { reg, bus } = setup();
            bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
            const handler = reg._calls.dispatcherReceivers[0][2];
            handler({ targetRegion: 'region_0_1', exitName: 'exit', sourceRegion: 'region_0_0' });
            const getActiveSubstrate = reg._calls.publicFunctions.get('procgenPlayer.getActiveSubstrate');
            expect(getActiveSubstrate()).toEqual({
                substrate: 'maze',
                componentType: 'mazeRoomPanel',
                label: 'Maze',
                regionId: 'region_0_1',
            });
            handler({ targetRegion: 'Menu', exitName: null, sourceRegion: 'region_0_1' });
            expect(getActiveSubstrate()).toBeNull();
        });
    });
});

/**
 * ⛓ "Skip the menu" — ONE SETTING, TWO PUBLISHERS.
 *
 * WHAT THESE ROWS PROVE. This module's synthesized start hop is gated on
 * `menuPanel.isSkipMenuEnabled()`: OFF ⇒ no `user:regionMove` at all, and the
 * player is left standing at the AP-declared start for the panel to play;
 * ON (and ABSENT — a module set without menuPanel) ⇒ the pre-M1 hop, unchanged.
 * `getResolvedStartRegion()` survives either way, because loop resets teleport
 * to it whether or not the initial hop was taken.
 *
 * WHAT THEY REFUSE TO PROVE. Nothing about the OTHER publisher. That the menu
 * panel does not ALSO hop on a warehoused world is menuPanel's own row
 * (`procgenOwnsStartHop`), and the end-to-end "exactly one move per load" claim
 * is the in-app battery's.
 */
describe('procgenPlayer — the skip-the-menu setting gates the start hop', () => {
    function setup(skipMenu) {
        _testOnly_resetModuleState();
        substrateRegistry.clear();
        substrateRegistry.register(FAKE_MAZE_ENTRY);
        const bus = makeMockEventBus();
        const dispatcher = makeMockDispatcher();
        const reg = makeMockRegistrationApi();
        register(reg);
        const moduleFunctions = skipMenu === undefined
            ? {}
            : { 'menuPanel.isSkipMenuEnabled': () => skipMenu };
        return { bus, dispatcher, reg, moduleFunctions };
    }

    async function load({ bus, dispatcher, reg, moduleFunctions }) {
        await initialize('procgenPlayer', 0, makeMockInitApi(bus, dispatcher, moduleFunctions));
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        bus.publish('stateManager:rulesLoaded', {});
        return reg._calls.publicFunctions;
    }

    it('skip ON: publishes the hop (today\'s behaviour)', async () => {
        const ctx = setup(true);
        await load(ctx);
        expect(ctx.dispatcher.published.map((p) => p.data.source)).toEqual(['procgenPlayer-start']);
    });

    it('skip OFF: publishes NOTHING, and the warehouse is still built', async () => {
        const ctx = setup(false);
        await load(ctx);
        expect(ctx.dispatcher.published).toHaveLength(0);
        expect(_testOnly_getWarehouse().size()).toBe(2);
    });

    it('skip OFF: getResolvedStartRegion still answers, so a loop reset can teleport', async () => {
        const ctx = setup(false);
        const publicFunctions = await load(ctx);
        expect(publicFunctions.get('procgenPlayer.getResolvedStartRegion')()).toBe('region_0_0');
    });

    it('menuPanel absent: the hop fires, exactly as before M1', async () => {
        const ctx = setup(undefined);
        await load(ctx);
        expect(ctx.dispatcher.published.map((p) => p.data.source)).toEqual(['procgenPlayer-start']);
    });

    it('skip OFF then a fresh load with skip ON hops — the value is read per load', async () => {
        let skip = false;
        _testOnly_resetModuleState();
        substrateRegistry.clear();
        substrateRegistry.register(FAKE_MAZE_ENTRY);
        const bus = makeMockEventBus();
        const dispatcher = makeMockDispatcher();
        register(makeMockRegistrationApi());
        await initialize('procgenPlayer', 0, makeMockInitApi(bus, dispatcher, {
            'menuPanel.isSkipMenuEnabled': () => skip,
        }));

        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        bus.publish('stateManager:rulesLoaded', {});
        expect(dispatcher.published).toHaveLength(0);

        skip = true;
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        bus.publish('stateManager:rulesLoaded', {});
        expect(dispatcher.published.map((p) => p.data.source)).toEqual(['procgenPlayer-start']);
    });
    /**
     * ⛓⛓ M2 — **ONE RULE, TWO PUBLISHERS** (⚖ user 2026-09-26: skip only a
     * ONE-exit start). This module hops out of the declared start exactly when
     * `menuPanelEngine.skipsStart` says so — the rule itself imported, the
     * setting through `menuPanel.isSkipMenuEnabled` as before. Swept over 0–2
     * warehoused exits × skip on/off, the hop fires iff the engine rule answers
     * true: a copy of the rule here would drift from menuPanel's.
     */
    const withMenuExits = (n) => ({
        ...SAMPLE_RULES,
        regions: {
            1: {
                ...SAMPLE_RULES.regions['1'],
                Menu: { exits: Array.from({ length: n }, (_, i) => ({ name: `To ${i}`, connected_region: `region_0_${i}` })) },
            },
        },
    });

    it.each([[1, true], [2, true], [1, false], [2, false]])(
        '⛓⛓ %i warehoused Menu exit(s), skip %s: the hop fires iff skipsStart answers true', async (n, skip) => {
            const ctx = setup(skip);
            const doc = withMenuExits(n);
            await initialize('procgenPlayer', 0, makeMockInitApi(ctx.bus, ctx.dispatcher, ctx.moduleFunctions));
            ctx.bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: doc, selectedPlayerInfo: { playerId: '1' } });
            ctx.bus.publish('stateManager:rulesLoaded', {});
            const want = skipsStart(doc, '1', 'Menu', skip);
            expect(want).toBe(skip && n === 1);
            expect(ctx.dispatcher.published.map((p) => p.data.source)).toEqual(want ? ['procgenPlayer-start'] : []);
            // ⛓ the resolved start still answers (a loop reset teleports to it either way).
            expect(ctx.reg._calls.publicFunctions.get('procgenPlayer.getResolvedStartRegion')()).toBe('region_0_0');
        });

    it('⛓ a WAREHOUSED start (its own sidecar) with several exits still loads its payload — nothing is left, so the setting alone rules', async () => {
        const ctx = setup(true);
        const doc = {
            start_regions: { 1: ['region_0_0'] },
            regions: { 1: {
                region_0_0: { exits: [{ name: 'a', connected_region: 'region_0_1' }, { name: 'b', connected_region: 'region_0_1' }] },
                region_0_1: { exits: [] },
            } },
            preset_sidecars: SAMPLE_RULES.preset_sidecars,
        };
        await initialize('procgenPlayer', 0, makeMockInitApi(ctx.bus, ctx.dispatcher, ctx.moduleFunctions));
        ctx.bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: doc, selectedPlayerInfo: { playerId: '1' } });
        ctx.bus.publish('stateManager:rulesLoaded', {});
        expect(ctx.dispatcher.published.map((p) => [p.data.sourceRegion, p.data.targetRegion]))
            .toEqual([[null, 'region_0_0']]);
    });
});

/**
 * ⛓⛓ RESTART — `retakeStartHop`: a Restart re-takes the load's start hop (the same publish), only where the
 * load would have skipped the menu and only once the reset has landed the player on the declared start; and a
 * move along the hop marks the substrate's loadRegion `startHop` (plus `restart` for a re-take).
 */
describe('procgenPlayer — retakeStartHop and the startHop mark', () => {
    let here;
    async function boot(skip = true) {
        _testOnly_resetModuleState();
        substrateRegistry.clear();
        substrateRegistry.register(FAKE_MAZE_ENTRY);
        centralRegistry.publicFunctions.clear();
        here = 'Menu';
        centralRegistry.registerPublicFunction('gameState', 'getCurrentRegion', () => here);
        const bus = makeMockEventBus();
        const dispatcher = makeMockDispatcher();
        const reg = makeMockRegistrationApi();
        register(reg);
        await initialize('procgenPlayer', 0, makeMockInitApi(bus, dispatcher, { 'menuPanel.isSkipMenuEnabled': () => skip }));
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: SAMPLE_RULES, selectedPlayerInfo: { playerId: '1' } });
        bus.publish('stateManager:rulesLoaded', {});
        const move = reg._calls.dispatcherReceivers[0][2];
        return { bus, dispatcher, move, retake: reg._calls.publicFunctions.get('procgenPlayer.retakeStartHop') };
    }

    it('re-publishes the LOAD\'s hop, with restart: true and nothing else changed', async () => {
        const { dispatcher, retake } = await boot(true);
        const load = dispatcher.published[0];
        expect(retake()).toEqual({ taken: true, why: null, region: 'region_0_0' });
        expect(dispatcher.published[1]).toEqual({ ...load, data: { ...load.data, restart: true } });
        expect(load.data).toEqual({ sourceRegion: 'Menu', targetRegion: 'region_0_0', exitName: 'GameStart', source: 'procgenPlayer-start' });
    });

    it('refuses BY NAME: the player not on the declared start, or a load that does not skip the menu', async () => {
        let ctx = await boot(true);
        here = 'region_0_1';
        expect(ctx.retake()).toMatchObject({ taken: false, why: expect.stringContaining('not the declared start') });
        ctx = await boot(false);
        expect(ctx.retake()).toMatchObject({ taken: false, why: expect.stringContaining('does not skip') });
        expect(ctx.dispatcher.published).toHaveLength(0);
    });

    it('a move along the hop marks loadRegion startHop (+ restart on a re-take); any other move does not', async () => {
        const { bus, move } = await boot(true);
        const loads = () => bus.published.filter((p) => p.event === 'maze:loadRegion').map((p) => p.data);
        move({ sourceRegion: 'Menu', targetRegion: 'region_0_0', exitName: 'GameStart', source: 'procgenPlayer-start' });
        move({ sourceRegion: 'region_0_0', targetRegion: 'region_0_1', exitName: 'x' });
        move({ sourceRegion: 'Menu', targetRegion: 'region_0_0', exitName: 'GameStart', source: 'procgenPlayer-start', restart: true });
        expect(loads().map((l) => [l.region_id, l.startHop ?? false, l.restart ?? false]))
            .toEqual([['region_0_0', true, false], ['region_0_1', false, false], ['region_0_0', true, true]]);
    });
});
