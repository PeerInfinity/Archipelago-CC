import { GameState } from './state.js';

let instance = null;

export function createGameStateSingleton(eventBus) {
    if (!instance) {
        instance = new GameState(eventBus);
    }
    return instance;
}

export function getGameStateSingleton() {
    if (!instance) {
        throw new Error('GameState singleton not initialized. Call createGameStateSingleton first.');
    }
    return instance;
}

// Test-only — wipe the singleton between cases so each test starts
// with a fresh GameState. App code should never call this.
export function _testOnly_resetGameStateSingleton() {
    instance = null;
}