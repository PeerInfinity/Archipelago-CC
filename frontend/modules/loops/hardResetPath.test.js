/**
 * hardResetPath.test.js — what the Loops panel's Hard Reset button does to the
 * PATH, driven through the handler itself.
 *
 * ⛓ WHAT THIS ROW PROVES. `LoopUI._handleHardResetClick` is called with a real
 * `GameState` behind `this.gameStateAPI` and a two-entry path; afterwards the
 * path must be EMPTY and `GameState` must not have warned.
 *
 * ⛔ WHAT IT REFUSES TO PROVE. Nothing about mana, XP, discovery or storage —
 * the handler touches all four and this row stubs them out. It is a row about
 * ONE line.
 *
 * ⚠ WHY IT DRIVES THE HANDLER AND NOT A HELPER. The defect it pins was a
 * WRONG ARGUMENT at the call site (`trimPath(1)` — the number 1 read as a
 * region NAME), so a row that called `clearPath()` itself would have been green
 * against the broken build. Restoring `this.gameStateAPI.trimPath(1)` in
 * `loopUI.js` reds this file: the path stays at 2 and GameState warns
 * "[GameState] Region 1 instance 1 not found in path" — the same warning the
 * pre-fix drive printed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoopUI } from './loopUI.js';
import loopState from './loopStateSingleton.js';
import { GameState } from '../gameState/state.js';

/** A GameState with a start region and a two-move path, as after real play. */
function playedGameState() {
    const gameState = new GameState({ publish: () => {} });
    gameState.setStartRegions(['Menu']);
    gameState.updatePath('Overworld', 'GameStart', 'Menu');
    gameState.updatePath('Cave', 'CaveDoor', 'Overworld');
    return gameState;
}

/**
 * The minimum `this` the handler dereferences, plus a real gameStateAPI over
 * `gameState`. Everything else is a spy: this row is about the path.
 */
function handlerThis(gameState) {
    return {
        gameStateAPI: {
            getState: () => gameState,
            clearPath: () => gameState.clearPath(),
            trimPath: (regionName, instanceNumber) => gameState.trimPath(regionName, instanceNumber),
        },
        expansionState: { clear: () => {}, setRegionExpanded: () => {} },
        regionsInQueue: new Set(),
        getPrimaryStartRegion: () => gameState.startRegions[0],
        renderLoopPanel: () => {},
    };
}

describe('⛓ Loops Hard Reset clears the path', () => {
    let confirmBefore;
    let warnSpy;
    let savedCurrentAction;
    let savedCurrentActionIndex;
    let savedIsProcessing;

    beforeEach(() => {
        confirmBefore = globalThis.confirm;
        // The handler is gated on a confirm() the node environment has no
        // implementation for; the row answers "yes".
        globalThis.confirm = () => true;
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        savedCurrentAction = loopState.currentAction;
        savedCurrentActionIndex = loopState.currentActionIndex;
        savedIsProcessing = loopState.isProcessing;
    });

    afterEach(() => {
        globalThis.confirm = confirmBefore;
        warnSpy.mockRestore();
        loopState.currentAction = savedCurrentAction;
        loopState.currentActionIndex = savedCurrentActionIndex;
        loopState.isProcessing = savedIsProcessing;
    });

    it('empties a two-entry path (⛔ trimPath(1) left it at 2 and warned)', () => {
        const gameState = playedGameState();
        expect(gameState.getPath()).toHaveLength(2);

        LoopUI.prototype._handleHardResetClick.call(handlerThis(gameState));

        expect(gameState.getPath()).toHaveLength(0);
        const warnings = warnSpy.mock.calls.map((args) => args.join(' '));
        expect(warnings.filter((w) => w.includes('not found in path'))).toEqual([]);
    });

    it('is a no-op on an already-empty path, and still does not warn', () => {
        const gameState = new GameState({ publish: () => {} });
        gameState.setStartRegions(['Menu']);
        expect(gameState.getPath()).toHaveLength(0);

        LoopUI.prototype._handleHardResetClick.call(handlerThis(gameState));

        expect(gameState.getPath()).toHaveLength(0);
        const warnings = warnSpy.mock.calls.map((args) => args.join(' '));
        expect(warnings.filter((w) => w.includes('not found in path'))).toEqual([]);
    });
});
