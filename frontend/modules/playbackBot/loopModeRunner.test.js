import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoopModeRunner } from './loopModeRunner.js';

// Menu --GameStart--> Overworld (Gate)
function makeGame({ costsLoaded = true, loopMode = true, substrate = () => false } = {}) {
    const handlers = new Map();
    const game = {
        exits: new Set(),
        locations: new Set(),
        checked: new Set(),
        paths: [],
        statuses: [],
        repeat: new Map(),
        loopState: {
            autoRestartQueue: true,
            costDataManager: { isLoaded: () => costsLoaded },
            setAutoRestartQueue(v) { this.autoRestartQueue = v; },
            restartFromStart: vi.fn(),
            stopProcessing: vi.fn(),
            setRepeatExplore: (r, v) => game.repeat.set(r, v),
            getRepeatExplore: (r) => game.repeat.get(r) ?? false,
            _calculateActionCost: () => 10,
        },
        gameState: { isLoopModeActive: loopMode, getMaxMana: () => 100, setPath: (p) => game.paths.push(p) },
        publish(event, data = {}) { for (const h of [...(handlers.get(event) ?? [])]) h(data); },
        publishData(event, data) { for (const h of [...(handlers.get(event) ?? [])]) h(data); },
        listeners: (event) => handlers.get(event)?.size ?? 0,
    };
    const runner = new LoopModeRunner({
        getLoopState: () => game.loopState,
        getGameState: () => game.gameState,
        getStartRegion: () => 'Menu',
        nextTarget: () => (game.checked.has('Gate') ? null : { locationName: 'Gate', regionName: 'Overworld' }),
        exitsOf: (r) => (r === 'Menu' ? [{ name: 'GameStart', to: 'Overworld' }] : []),
        locationsOf: (r) => (r === 'Overworld' ? ['Gate'] : []),
        isLocationCheckable: (l) => !game.checked.has(l),
        discovery: {
            isExitDiscovered: (r, e) => game.exits.has(`${r}:${e}`),
            isLocationDiscovered: (l) => game.locations.has(l),
        },
        isDiscoveryActive: () => true,
        isSubstrateRegion: substrate,
        subscribe: (event, h) => {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(h);
            return () => handlers.get(event).delete(h);
        },
        onStatus: (t) => game.statuses.push(t),
        onFinished: vi.fn(),
    });
    return { game, runner };
}

const kinds = (path) => path.map((e) => (e.type === 'regionMove' ? `move:${e.destinationRegion}`
    : e.type === 'customAction' ? `explore:${e.sourceRegion}` : `check:${e.locationName}`));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LoopModeRunner', () => {
    it('without costs it waits, saying Generate Costs first, and retries', () => {
        const { game, runner } = makeGame({ costsLoaded: false });
        runner.start();
        expect(game.statuses.at(-1)).toMatch(/Generate Costs first/);
        expect(game.loopState.restartFromStart).not.toHaveBeenCalled();
        game.loopState.costDataManager.isLoaded = () => true;
        vi.advanceTimersByTime(1000);
        expect(game.loopState.restartFromStart).toHaveBeenCalledTimes(1);
    });

    it('each loop goes back to the start by Loops\' clearQueue before its path is written', () => {
        const { game, runner } = makeGame();
        const order = [];
        game.loopState.clearQueue = () => order.push('clear');
        const setPath = game.gameState.setPath;
        game.gameState.setPath = (p) => { order.push('setPath'); setPath(p); };
        runner.start();
        expect(order).toEqual(['clear', 'setPath']);
    });

    it('a region whose queue takes no explore counts as discovered: the loop checks instead of exploring there', () => {
        const { game, runner } = makeGame();
        game.exits.add('Menu:GameStart');
        runner._d.supportsQueueAction = (region, type) => !(region === 'Overworld' && type === 'explore');
        runner._d.regionOfLocation = (l) => (l === 'Gate' ? 'Overworld' : null);
        runner.start();
        expect(kinds(game.paths.at(-1))).toEqual(['move:Overworld', 'check:Gate']);
    });

    it('a loop that reaches a region it never planned is ended and planned again', () => {
        const { game, runner } = makeGame();
        game.exits.add('Menu:GameStart');
        runner.start();
        expect(kinds(game.paths.at(-1))).toEqual(['move:Overworld', 'explore:Overworld']);
        game.publish('gameState:regionChanged', { newRegion: 'Overworld' });          // planned: fine
        expect(game.loopState.stopProcessing).not.toHaveBeenCalled();
        game.publishData('gameState:regionChanged', { newRegion: 'Elsewhere' });
        expect(game.loopState.stopProcessing).toHaveBeenCalled();
        expect(game.statuses.some((t) => /left the plan for Elsewhere/.test(t))).toBe(true);
    });

    it('waits while loop mode is off', () => {
        const { game, runner } = makeGame({ loopMode: false });
        runner.start();
        expect(game.statuses.at(-1)).toMatch(/loop mode is off/);
    });

    it('plays explore loops until the target is found, then a check loop, then finishes', () => {
        const { game, runner } = makeGame();
        runner.start();
        expect(game.loopState.autoRestartQueue).toBe(false);
        expect(kinds(game.paths.at(-1))).toEqual(['explore:Menu']);
        expect(game.repeat.get('Menu')).toBe(true);
        expect(game.loopState.restartFromStart).toHaveBeenCalledWith({ autoStart: true });

        // The loop runs out of mana having found the exit.
        game.exits.add('Menu:GameStart');
        game.publish('loopState:loopReset');
        vi.advanceTimersByTime(0);
        expect(kinds(game.paths.at(-1))).toEqual(['move:Overworld', 'explore:Overworld']);

        game.locations.add('Gate');
        game.publish('loopState:loopReset');
        vi.advanceTimersByTime(0);
        expect(kinds(game.paths.at(-1))).toEqual(['move:Overworld', 'check:Gate']);

        game.checked.add('Gate');
        game.publish('loopState:queueCompleted');
        vi.advanceTimersByTime(0);
        expect(game.statuses.at(-1)).toMatch(/^finished — 3 loops/);
        expect(runner.isActive()).toBe(false);
        expect(game.loopState.autoRestartQueue).toBe(true);     // the user's choice is back
        expect(game.repeat.get('Menu')).toBe(false);
        expect(game.repeat.get('Overworld')).toBe(false);
    });

    it('a loop never ends twice: the listeners go when it ends', () => {
        const { game, runner } = makeGame();
        runner.start();
        expect(game.listeners('loopState:loopReset')).toBe(1);
        game.publish('loopState:queueCompleted');
        expect(game.listeners('loopState:loopReset')).toBe(0);
        vi.advanceTimersByTime(0);
        expect(game.listeners('loopState:loopReset')).toBe(1);
        expect(game.paths).toHaveLength(2);
    });

    it('a loop that ended without a reset resets the run before the next loop; a mana-out does not owe one', () => {
        const { game, runner } = makeGame();
        game.gameState.triggerLoopReset = vi.fn();
        runner.start();
        expect(game.gameState.triggerLoopReset).not.toHaveBeenCalled();     // the first loop owes nothing
        game.publish('loopState:loopReset');                                 // mana-out: the run was reset
        vi.advanceTimersByTime(0);
        expect(game.gameState.triggerLoopReset).not.toHaveBeenCalled();
        game.publish('loopState:queueCompleted');                            // the queue ran out first
        vi.advanceTimersByTime(0);
        expect(game.gameState.triggerLoopReset).toHaveBeenCalledTimes(1);
        expect(game.paths).toHaveLength(3);
        game.exits.add('Menu:GameStart');                                    // ended early (explored)
        game.publish('loopState:actionCompleted');
        vi.advanceTimersByTime(0);
        expect(game.gameState.triggerLoopReset).toHaveBeenCalledTimes(2);
    });

    it('ends an explore loop as soon as its region hides nothing more', () => {
        const { game, runner } = makeGame();
        runner.start();
        expect(kinds(game.paths.at(-1))).toEqual(['explore:Menu']);
        game.publish('loopState:actionCompleted');          // still hidden: keeps going
        expect(game.loopState.stopProcessing).not.toHaveBeenCalled();
        game.exits.add('Menu:GameStart');                   // the explore found the exit
        game.publish('loopState:actionCompleted');
        expect(game.loopState.stopProcessing).toHaveBeenCalled();
        vi.advanceTimersByTime(0);
        expect(kinds(game.paths.at(-1))).toEqual(['move:Overworld', 'explore:Overworld']);
        expect(game.statuses.some((t) => /ended early \(explored\)/.test(t))).toBe(true);
    });

    it('a loop whose actions spend no mana is ended after the free-spin limit', () => {
        const { game, runner } = makeGame();
        game.gameState.currentMana = 100;
        runner.start();
        for (let i = 0; i < 200; i += 1) game.publish('loopState:actionCompleted');
        expect(game.loopState.stopProcessing).toHaveBeenCalled();
        expect(game.statuses.some((t) => /200 actions spent no mana/.test(t))).toBe(true);
    });

    it('once plays exactly one loop', () => {
        const { game, runner } = makeGame();
        runner.start({ once: true });
        game.publish('loopState:loopReset');
        vi.advanceTimersByTime(5000);
        expect(game.paths).toHaveLength(1);
        expect(runner.isActive()).toBe(false);
    });

    it('stop pauses the queue and restores the settings', () => {
        const { game, runner } = makeGame();
        runner.start();
        runner.stop();
        expect(game.loopState.stopProcessing).toHaveBeenCalled();
        expect(game.loopState.autoRestartQueue).toBe(true);
        game.publish('loopState:loopReset');
        vi.advanceTimersByTime(5000);
        expect(game.paths).toHaveLength(1);
    });

    it('a substrate region the queue cannot play (no coarse shape, no Bot solver) waits and names it', () => {
        const { game, runner } = makeGame({ substrate: (r) => r === 'Overworld' });
        game.exits.add('Menu:GameStart');
        runner.start();
        expect(game.statuses.at(-1)).toMatch(/Overworld is a substrate region the Loops queue cannot play yet/);
        expect(game.loopState.restartFromStart).not.toHaveBeenCalled();
    });

    it('sets Bot on solver regions and Playback on coarse ones, and puts the user\'s modes back on stop', () => {
        const { game, runner } = makeGame({ substrate: (r) => r === 'Overworld' || r === 'Menu' });
        game.exits.add('Menu:GameStart');
        const modes = new Map([['Menu#1', 'manual']]);
        Object.assign(game.loopState, {
            getRegionCaptureShape: (r) => (r === 'Menu' ? 'coarse' : 'fine'),
            regionSolver: (r) => (r === 'Overworld' ? 'delegation' : null),
            blockModeStates: modes,
            setBlockMode: (r, i, m) => modes.set(`${r}#${i}`, m),
        });
        runner._d.queueBlocks = () => [{ name: 'Menu', instance: 1 }, { name: 'Overworld', instance: 1 }];
        runner.start();
        expect(modes.get('Menu#1')).toBe('playback');
        expect(modes.get('Overworld#1')).toBe('bot');
        runner.stop();
        expect(modes.get('Menu#1')).toBe('manual');
        expect(modes.has('Overworld#1')).toBe(false);
    });

    it('a coarse region WITH a Bot solver (Seedling) gets Bot, not Playback', () => {
        const { game, runner } = makeGame({ substrate: (r) => r === 'Menu' });
        const modes = new Map();
        Object.assign(game.loopState, {
            getRegionCaptureShape: () => 'coarse',
            regionSolver: () => 'walkTo',
            blockModeStates: modes,
            setBlockMode: (r, i, m) => modes.set(`${r}#${i}`, m),
        });
        runner._d.queueBlocks = () => [{ name: 'Menu', instance: 1 }];
        runner.start();
        expect(modes.get('Menu#1')).toBe('bot');
    });
});
