/**
 * Tests for the walkTo SOLVER path in loopState (loops-mode rework
 * Phase 4; re-homed onto the Bot radio in M6).
 *
 * Substrates whose loopSupport declares executeVia: 'solver' (bounce)
 * get their regionMove / locationCheck queue actions executed by the
 * substrate's playback bot: the queue parks, walkTo is dispatched, and
 * the resulting locationCheck / regionChanged event completes the action.
 *
 * M6: the ONE trigger is a block set to 'bot' — hence the explicit
 * setBlockMode in the fixture. Before M6 these actions ran from an
 * unconditional fall-through at the end of the frame dispatch, which is
 * why the suite used to pin defaultBlockMode instead. The Bot-branch
 * dispatch matrix and the mode plumbing live in blockModes.test.js;
 * this suite covers the walkTo mechanics themselves.
 */
import {
    describe,
    it,
    expect,
    beforeEach,
    beforeAll,
    afterAll,
} from 'vitest';
import {
    installRafShim,
    uninstallRafShim,
    makeTicker,
    makeStubStateManager,
} from './testHarness.js';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

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

describe('Bot-backed queue execution (loopSupport.executeVia = solver)', () => {
    let loopState, gs, bus;
    let tick;
    let dispatcherPublishes;
    const walkToCalls = [];
    const stopCalls = [];
    let controller;

    beforeEach(() => {
        const dispatcher = {
            publish: (eventName, eventData, opts) => {
                dispatcherPublishes.push({ method: 'publish', eventName, eventData, opts });
            },
            publishToNextModule: (moduleName, eventName, eventData, opts) => {
                dispatcherPublishes.push({ method: 'publishToNextModule', eventName, eventData, opts });
            },
        };
        dispatcherPublishes = [];
        bus = makeFunctionalBus();
        gs = new GameState(bus);
        loopState = new LoopState();
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
                removePathEntry: (idx) => gs.removePathEntry(idx),
                trimPath: (r, i) => gs.trimPath(r, i),
            },
        });
        gs.setStartRegions(['Menu']);
        gs.setCurrentRegion('Menu');
        // Blocks outside the one under test resolve from the default; keep
        // it off Record so no unrelated block parks for hand-play.
        loopState.defaultBlockMode = 'playback';
        tick = makeTicker();
        walkToCalls.length = 0;
        stopCalls.length = 0;
        controller = {
            walkTo: (target) => walkToCalls.push(target),
            stop: () => stopCalls.push('stop'),
        };

        try { substrateRegistry.clear?.(); } catch { /* ignore */ }
        substrateRegistry.register?.({
            id: 'bounce_test',
            label: 'Bounce Test',
            panelComponentType: 'bounceTestPanel',
            loadRegionEvent: 'bounceTest:loadRegion',
            getPlaybackController: () => controller,
            loopSupport: {
                queueActions: ['regionMove', 'locationCheck'],
                executeVia: 'solver',
                manual: true,
                customQueues: false,
            },
        });
        try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
        centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => {
            if (region === 'bounceRegion') {
                return { substrate: 'bounce_test', label: 'Bounce Test', manaEnabled: false };
            }
            return null;
        });

        // Deterministic costs: region moves 10, location checks 20.
        loopState.setCostDataManager({
            isLoaded: () => true,
            getRegionCost: () => 10,
            getLocationCost: () => 20,
            getRegionXpEffect: () => 'cost',
        });
    });

    // Queue: regionMove(Menu→bounceRegion) [0], locationCheck 'Coin' [1],
    // regionMove(bounceRegion→after) [2]. Park the cursor on entry 1.
    // Entries 1 and 2 are the bounceRegion#1 block (the leaving move is
    // rendered inside its SOURCE block), which M6 needs set to 'bot' for
    // the solver to be dispatched at all. Pass mode=null to leave the
    // block on whatever the default/legacy state resolves to.
    function setupBounceQueue(cursorIndex = 1, mode = 'bot') {
        gs.updatePath('bounceRegion', 'go', 'Menu');
        gs.addLocationCheck('Coin', 'bounceRegion');
        gs.updatePath('after', 'bounceRegion__east', 'bounceRegion');
        if (mode) loopState.setBlockMode('bounceRegion', 1, mode);
        loopState.currentActionIndex = cursorIndex;
        loopState.currentAction = loopState.getActionQueue()[cursorIndex];
        loopState.isProcessing = true;
    }

    it('parks on a locationCheck and dispatches walkTo for the location', () => {
        setupBounceQueue(1);
        tick(loopState);
        expect(walkToCalls).toEqual([{ kind: 'location', name: 'Coin' }]);
        expect(loopState._botExecutedAction).not.toBeNull();
        // Parked, not stopped: isProcessing stays true, no RAF runs.
        expect(loopState.isProcessing).toBe(true);
        expect(loopState._animationFrameId).toBeNull();
    });

    it('parks on a regionMove and dispatches walkTo for the exit', () => {
        setupBounceQueue(2);
        tick(loopState);
        expect(walkToCalls).toEqual([{ kind: 'exit', name: 'bounceRegion__east' }]);
    });

    it('completes the locationCheck when its check event arrives, charging the fallback cost', () => {
        setupBounceQueue(1);
        tick(loopState);
        const manaBefore = gs.getCurrentMana();
        const xpBefore = loopState.getRegionXP('bounceRegion').xp;

        loopState._handleBotWake_locationCheck('Coin');

        expect(loopState._botExecutedAction).toBeNull();
        expect(loopState.actionQueueManager.isCompleted(1)).toBe(true);
        expect(gs.getCurrentMana()).toBe(manaBefore - 20);
        // M6: the spend routes through _chargeLiveAction, so it awards region
        // XP 1:1 like every other spend. The direct deductMana it replaced
        // awarded none — a bot could grind a region forever without it
        // getting any cheaper.
        expect(loopState.getRegionXP('bounceRegion').xp).toBe(xpBefore + 20);
        // Cursor advanced to the leaving regionMove.
        expect(loopState.currentActionIndex).toBe(2);
    });

    it('ignores checks for other locations while parked', () => {
        setupBounceQueue(1);
        tick(loopState);
        loopState._handleBotWake_locationCheck('Some Other Loc');
        expect(loopState._botExecutedAction).not.toBeNull();
        expect(loopState.actionQueueManager.isCompleted(1)).toBe(false);
    });

    it('completes the regionMove on arrival WITHOUT re-dispatching user:regionMove', () => {
        setupBounceQueue(2);
        tick(loopState);
        const manaBefore = gs.getCurrentMana();

        bus.publish('gameState:regionChanged', { newRegion: 'after' });

        expect(loopState._botExecutedAction).toBeNull();
        expect(loopState.actionQueueManager.isCompleted(2)).toBe(true);
        expect(gs.getCurrentMana()).toBe(manaBefore - 10);
        // The bridge already moved the player — the duplicate dispatch
        // is suppressed (same as substrate delegation).
        const regionMoves = dispatcherPublishes.filter(
            (p) => p.eventName === 'user:regionMove',
        );
        expect(regionMoves).toEqual([]);
        // loop:moveCompleted still fires for discovery.
        expect(dispatcherPublishes.some((p) => p.eventName === 'loop:moveCompleted')).toBe(true);
    });

    it('unexpected region during a bot walk stops the bot and pauses until reset', () => {
        setupBounceQueue(2);
        tick(loopState);
        const paused = [];
        bus.subscribe('loopState:queuePausedUntilReset', (data) => paused.push(data));

        bus.publish('gameState:regionChanged', { newRegion: 'somewhereElse' });

        expect(stopCalls).toEqual(['stop']);
        expect(loopState._botExecutedAction).toBeNull();
        expect(loopState._queuePausedUntilReset).toBe(true);
        expect(paused[0]).toMatchObject({
            actualRegion: 'somewhereElse',
            expectedRegion: 'after',
            reason: 'botUnexpectedRegion',
        });
        expect(loopState.actionQueueManager.isCompleted(2)).toBe(false);
    });

    it('stopProcessing stops an in-flight bot walk; resume re-dispatches walkTo', () => {
        setupBounceQueue(1);
        tick(loopState);
        expect(walkToCalls).toHaveLength(1);

        loopState.stopProcessing();
        expect(stopCalls).toEqual(['stop']);
        expect(loopState._botExecutedAction).toBeNull();

        // Resume: the cursor is still on the same action, so the next
        // frame re-dispatches walkTo from wherever the player is.
        loopState.isProcessing = true;
        tick(loopState);
        expect(walkToCalls).toHaveLength(2);
        expect(walkToCalls[1]).toEqual({ kind: 'location', name: 'Coin' });
    });

    it('_resetLoop stops an in-flight bot walk', () => {
        setupBounceQueue(1);
        tick(loopState);
        loopState._resetLoop();
        expect(stopCalls).toContain('stop');
        expect(loopState._botExecutedAction).toBeNull();
    });

    it('falls back to generic execution when no controller is mounted', () => {
        controller = null;
        setupBounceQueue(1);
        expect(loopState._shouldBotExecuteCurrentAction()).toBe(false);
    });

    it('does not bot-execute actions in regions of other substrates', () => {
        gs.updatePath('plainRegion', 'go', 'Menu');
        gs.addLocationCheck('Loc P', 'plainRegion');
        loopState.currentActionIndex = 1;
        loopState.currentAction = loopState.getActionQueue()[1];
        expect(loopState._shouldBotExecuteCurrentAction()).toBe(false);
    });

    it('the manual checkbox wins over bot execution', () => {
        // No explicit block mode: the legacy region checkbox resolves the
        // block to Manual, and Manual parks before the Bot branch is reached.
        setupBounceQueue(1, null);
        loopState.setManualRegion('bounceRegion', true);
        const entered = [];
        bus.subscribe('loopState:manualEntered', (data) => entered.push(data));
        tick(loopState);
        // Parked manually — no bot dispatch.
        expect(walkToCalls).toEqual([]);
        expect(entered).toHaveLength(1);
        expect(loopState._manualRegionName).toBe('bounceRegion');
    });

    it('a non-Bot block never reaches the solver (M6: Bot is the only trigger)', () => {
        // Playback on a substrate with no bound recording is the pre-M6
        // fall-through that used to hand the block to walkTo. It parks now.
        setupBounceQueue(1, 'playback');
        tick(loopState);
        expect(walkToCalls).toEqual([]);
        expect(loopState._botExecutedAction).toBeNull();
    });

    it('a Bot block whose controller is gone parks for live play instead of the timer', () => {
        // Ruling 2: never a silent generic-timer teleport through content the
        // solver was meant to play. The block parks (and warns) instead.
        controller = null;
        setupBounceQueue(1);
        const entered = [];
        bus.subscribe('loopState:manualEntered', (data) => entered.push(data));
        tick(loopState);
        expect(walkToCalls).toEqual([]);
        expect(loopState._botExecutedAction).toBeNull();
        expect(entered).toHaveLength(1);
        expect(loopState._manualRegionName).toBe('bounceRegion');
        // The queue did NOT tick the action forward on the generic timer.
        expect(loopState.actionQueueManager.isCompleted(1)).toBe(false);
    });
});
