/**
 * Behavior-parity tests for the in-process substrate's mana leg
 * (textAdventureSubstrateUI.js). Written against the
 * pre-resourceChannels implementation and kept unchanged across the
 * migration (cross-game R1 slice 2) — passing on both sides is the
 * deduction/XP/reset parity evidence.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { centralRegistry } from '../../app/core/centralRegistry.js';
import {
    createGameStateSingleton,
    _testOnly_resetGameStateSingleton,
} from '../gameState/singleton.js';
import { TextAdventureSubstrateUI } from './textAdventureSubstrateUI.js';

function makeFakeDispatcher() {
    const published = [];
    return {
        published,
        publish(event, data, opts) {
            published.push({ event, data, opts });
        },
    };
}

function stubRegistry({ startRegion = 'Start' } = {}) {
    centralRegistry.publicFunctions.set('procgenPlayer', new Map([
        ['getResolvedStartRegion', () => startRegion],
    ]));
    centralRegistry.publicFunctions.set('loops', new Map([
        ['getCostDataManager', () => null],
    ]));
}

function makePanel({ dispatcher = makeFakeDispatcher() } = {}) {
    const panel = new TextAdventureSubstrateUI(null, {});
    panel.currentRegionId = 'A';
    // `apis` is a getter over the static module apis.
    TextAdventureSubstrateUI.setModuleApis({ dispatcher });
    return { panel, dispatcher };
}

beforeEach(() => {
    _testOnly_resetGameStateSingleton();
    stubRegistry();
});

afterEach(() => {
    centralRegistry.publicFunctions.delete('procgenPlayer');
    centralRegistry.publicFunctions.delete('loops');
    TextAdventureSubstrateUI.setModuleApis(null);
    vi.restoreAllMocks();
});

describe('in-process TA mana leg', () => {
    it('charges default location cost (10) per location with 1:1 XP', () => {
        const gs = createGameStateSingleton(null);
        const { panel } = makePanel();
        panel._deductLocationCheckMana(['L1', 'L2']);
        expect(gs.getCurrentMana()).toBe(80);
        expect(gs.getRegionXP('A').xp).toBe(20);
    });

    it('stops charging mid-list when a check depletes the pool', () => {
        const gs = createGameStateSingleton(null);
        const { panel, dispatcher } = makePanel();
        gs.deductMana(85); // 15 left: L1 → 5, L2 → 0 (reset), L3 uncharged
        panel._deductLocationCheckMana(['L1', 'L2', 'L3']);
        expect(gs.getLoopResetCount()).toBe(1);
        expect(gs.getRegionXP('A').xp).toBe(20);
        expect(dispatcher.published).toHaveLength(1);
    });

    it('charges default region move cost (50) with 1:1 XP to the moved-from region', () => {
        const gs = createGameStateSingleton(null);
        const { panel } = makePanel();
        panel._deductRegionMoveMana('A');
        expect(gs.getCurrentMana()).toBe(50);
        expect(gs.getRegionXP('A').xp).toBe(50);
    });

    it('depletion fires the reset teleport with initialTarget bottom', () => {
        const gs = createGameStateSingleton(null);
        const { panel, dispatcher } = makePanel();
        gs.deductMana(60); // 40 left; move costs 50
        panel._deductRegionMoveMana('A');
        expect(gs.getLoopResetCount()).toBe(1);
        expect(gs.getCurrentMana()).toBe(100);
        expect(dispatcher.published).toEqual([{
            event: 'user:regionMove',
            data: {
                sourceRegion: 'A',
                targetRegion: 'Start',
                fromReset: true,
                updatePath: false,
            },
            opts: { initialTarget: 'bottom' },
        }]);
    });

    it('falls back to the declared start region when procgenPlayer resolves none', () => {
        const gs = createGameStateSingleton(null);
        stubRegistry({ startRegion: null });
        gs.startRegions = ['DeclaredStart'];
        const { panel, dispatcher } = makePanel();
        panel._fireLoopReset();
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published[0].data.targetRegion).toBe('DeclaredStart');
    });

    it('reset fires with no teleport when nothing resolves', () => {
        const gs = createGameStateSingleton(null);
        stubRegistry({ startRegion: null });
        const { panel, dispatcher } = makePanel();
        panel._fireLoopReset();
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published).toHaveLength(0);
    });
});
