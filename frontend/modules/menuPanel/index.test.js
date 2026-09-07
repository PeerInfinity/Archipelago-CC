/**
 * index.test.js — the menu panel's wiring, driven headlessly.
 *
 * ⛓ WHAT THESE ROWS PROVE.
 *   - the load handshake: the skip hop fires ONCE per load, only when both
 *     `stateManager:rawJsonDataLoaded` and `stateManager:rulesLoaded` have
 *     arrived, in EITHER order;
 *   - the hand-off: with a procgen warehouse claiming the world (a non-null
 *     `procgenPlayer.getResolvedStartRegion()`) this module publishes NOTHING,
 *     so exactly one start move exists per load;
 *   - skip OFF activates the panel instead of moving;
 *   - an exit press is a real `user:regionMove` with a `menuPanel-` source and
 *     procgenPlayer's `{initialTarget:'bottom'}` shape;
 *   - Restart outside loop mode clears the path THEN teleports with the loops
 *     reset's own `fromReset:true, updatePath:false` shape, and in loop mode
 *     delegates to `loopState.restartFromStart` and publishes nothing itself.
 *
 * ⛔ WHAT THEY REFUSE TO PROVE. Nothing about the DOM (`menuPanelUI.js` is not
 * imported here) and nothing about `settingsManager` persistence: the setting is
 * driven through `setSkipMenuEnabled`, whose write-through is exercised only in
 * the app. The end-to-end "an exit press puts a regionMove in the path and the
 * queue runs it" claim is the in-app row `loops-real-actions-processed`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { GameState } from '../gameState/state.js';
import {
    initialize,
    restart,
    takeExit,
    getMenuContent,
    isSkipMenuEnabled,
    setSkipMenuEnabled,
    _testOnly_resetModuleState,
} from './index.js';
import { MOVE_SOURCE_EXIT, MOVE_SOURCE_START, MOVE_SOURCE_RESTART } from './menuPanelEngine.js';

const PLAIN_RULES = {
    game_name: 'Plain',
    seed_name: '1',
    start_regions: { 1: { default: ['Menu'], available: [] } },
    regions: {
        1: {
            Menu: { exits: [{ name: 'GameStart', connected_region: 'Overworld' }] },
            Overworld: { exits: [{ name: 'Back', connected_region: 'Menu' }], locations: [] },
        },
    },
};

function makeBus() {
    const subscribers = new Map();
    const published = [];
    return {
        publish(event, data) { published.push({ event, data }); },
        subscribe(event, cb) {
            if (!subscribers.has(event)) subscribers.set(event, new Set());
            subscribers.get(event).add(cb);
            return () => subscribers.get(event)?.delete(cb);
        },
        emit(event, data) { for (const cb of subscribers.get(event) ?? []) cb(data); },
        published,
    };
}

function makeDispatcher() {
    const published = [];
    return { publish(eventName, data, options) { published.push({ eventName, data, options }); }, published };
}

/** Register the neighbours this module asks centralRegistry for. */
function wire({ gameState, resolvedStart = null, loopModeActive = false, loopState = null }) {
    centralRegistry.registerPublicFunction('gameState', 'getCurrentRegion', () => gameState.getCurrentRegion());
    centralRegistry.registerPublicFunction('gameState', 'isStartRegion', (r) => gameState.isStartRegion(r));
    centralRegistry.registerPublicFunction('gameState', 'clearPath', () => gameState.clearPath());
    centralRegistry.registerPublicFunction('gameState', 'getState', () => gameState);
    centralRegistry.registerPublicFunction('procgenPlayer', 'getResolvedStartRegion', () => resolvedStart);
    centralRegistry.registerPublicFunction('loops', 'isLoopModeActive', () => loopModeActive);
    centralRegistry.registerPublicFunction('loops', 'getLoopState', () => loopState);
}

function freshGameState(currentRegion = 'Menu') {
    const gameState = new GameState({ publish: () => {} });
    gameState.setStartRegions(['Menu']);
    gameState.currentRegion = currentRegion;
    return gameState;
}

describe('menuPanel module', () => {
    let bus;
    let dispatcher;
    let gameState;

    async function boot(opts = {}) {
        bus = makeBus();
        dispatcher = makeDispatcher();
        gameState = opts.gameState ?? freshGameState();
        wire({ gameState, ...opts });
        await initialize('menuPanel', 0, {
            getEventBus: () => bus,
            getDispatcher: () => dispatcher,
            getLogger: () => ({ warn: () => {}, info: () => {}, error: () => {} }),
        });
        await setSkipMenuEnabled(opts.skipMenu ?? true);
        return { bus, dispatcher, gameState };
    }

    function load(order = ['raw', 'rules']) {
        for (const half of order) {
            if (half === 'raw') {
                bus.emit('stateManager:rawJsonDataLoaded', {
                    rawJsonData: PLAIN_RULES,
                    selectedPlayerInfo: { playerId: '1' },
                });
            } else {
                bus.emit('stateManager:rulesLoaded', {});
            }
        }
    }

    beforeEach(() => {
        _testOnly_resetModuleState();
        centralRegistry.publicFunctions.clear();
        // settingsManager writes are stubbed out: this file is about the wiring.
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        centralRegistry.publicFunctions.clear();
        _testOnly_resetModuleState();
    });

    // --- the load handshake --------------------------------------------------

    it('publishes NOTHING until both halves of the load have arrived', async () => {
        await boot();
        bus.emit('stateManager:rawJsonDataLoaded', { rawJsonData: PLAIN_RULES, selectedPlayerInfo: { playerId: '1' } });
        expect(dispatcher.published).toHaveLength(0);
        bus.emit('stateManager:rulesLoaded', {});
        expect(dispatcher.published).toHaveLength(1);
    });

    it('skip ON, plain world: takes the first exit, tagged as this module', async () => {
        await boot();
        load();
        expect(dispatcher.published).toEqual([{
            eventName: 'user:regionMove',
            data: {
                sourceRegion: 'Menu',
                targetRegion: 'Overworld',
                exitName: 'GameStart',
                source: MOVE_SOURCE_START,
            },
            // procgenPlayer's shape: the substrate coordinator sees it first.
            options: { initialTarget: 'bottom' },
        }]);
    });

    it('the hop is order-independent — rulesLoaded first still hops exactly once', async () => {
        await boot();
        load(['rules', 'raw']);
        expect(dispatcher.published.map((p) => p.data.source)).toEqual([MOVE_SOURCE_START]);
    });

    it('a second rulesLoaded alone does not re-hop', async () => {
        await boot();
        load();
        bus.emit('stateManager:rulesLoaded', {});
        expect(dispatcher.published).toHaveLength(1);
    });

    // --- one publisher per load ---------------------------------------------

    it('⛔ stands down when procgenPlayer claims the world (exactly one start move exists)', async () => {
        await boot({ resolvedStart: 'region_0_0' });
        load();
        expect(dispatcher.published).toHaveLength(0);
    });

    it('hops on a procgen-shaped world whose start did NOT resolve — nobody else would', async () => {
        await boot({ resolvedStart: null });
        load();
        expect(dispatcher.published.map((p) => p.data.source)).toEqual([MOVE_SOURCE_START]);
    });

    it('does not hop when the player is not at a start region', async () => {
        await boot({ gameState: freshGameState('Overworld') });
        load();
        expect(dispatcher.published).toHaveLength(0);
    });

    // --- skip OFF ------------------------------------------------------------

    it('skip OFF: no move, and the panel activates itself instead', async () => {
        await boot({ skipMenu: false });
        load();
        expect(dispatcher.published).toHaveLength(0);
        expect(bus.published).toEqual([{ event: 'ui:activatePanel', data: { panelId: 'menuPanel' } }]);
    });

    it('the cached setting is what procgenPlayer will read', async () => {
        await boot({ skipMenu: false });
        expect(isSkipMenuEnabled()).toBe(false);
        await setSkipMenuEnabled(true);
        expect(isSkipMenuEnabled()).toBe(true);
    });

    // --- pressing an exit ----------------------------------------------------

    it('an exit press is a real user:regionMove with an authoring source', async () => {
        await boot({ skipMenu: false });
        load();
        const content = getMenuContent();
        expect(content.exits).toHaveLength(1);
        takeExit(content.exits[0]);
        expect(dispatcher.published).toEqual([{
            eventName: 'user:regionMove',
            data: {
                sourceRegion: 'Menu',
                targetRegion: 'Overworld',
                exitName: 'GameStart',
                source: MOVE_SOURCE_EXIT,
            },
            options: { initialTarget: 'bottom' },
        }]);
    });

    // --- Restart -------------------------------------------------------------

    it('Restart outside loop mode clears the path, then teleports with the loops reset shape', async () => {
        await boot({ gameState: freshGameState('Overworld') });
        gameState.updatePath('Overworld', 'GameStart', 'Menu');
        expect(gameState.getPath()).toHaveLength(1);

        const outcome = restart();

        expect(gameState.getPath()).toHaveLength(0);
        expect(outcome).toEqual({ mode: 'world', target: 'Menu' });
        expect(dispatcher.published).toEqual([{
            eventName: 'user:regionMove',
            data: {
                sourceRegion: 'Overworld',
                targetRegion: 'Menu',
                // The loops reset's own shape: substrates reset themselves and
                // nobody bills the teleport.
                fromReset: true,
                updatePath: false,
                source: MOVE_SOURCE_RESTART,
            },
            options: { initialTarget: 'bottom' },
        }]);
    });

    it('Restart prefers procgenPlayer\'s resolved start over startRegions[0]', async () => {
        await boot({ gameState: freshGameState('region_1_1'), resolvedStart: 'region_0_0' });
        expect(restart().target).toBe('region_0_0');
        expect(dispatcher.published[0].data.targetRegion).toBe('region_0_0');
    });

    it('Restart does NOT re-fire the skip hop (a restart is not a load)', async () => {
        await boot({ gameState: freshGameState('Overworld') });
        restart();
        expect(dispatcher.published.map((p) => p.data.source)).toEqual([MOVE_SOURCE_RESTART]);
    });

    it('Restart in loop mode delegates to loopState.restartFromStart and publishes nothing', async () => {
        const calls = [];
        const loopState = { restartFromStart: (opts) => calls.push(opts) };
        await boot({ gameState: freshGameState('Overworld'), loopModeActive: true, loopState });
        gameState.updatePath('Overworld', 'GameStart', 'Menu');

        const outcome = restart();

        expect(calls).toEqual([{ autoStart: false }]);
        expect(outcome).toEqual({ mode: 'loop', target: null });
        expect(dispatcher.published).toHaveLength(0);
        // The loops reset owns the path in loop mode; this module leaves it alone.
        expect(gameState.getPath()).toHaveLength(1);
    });
});
