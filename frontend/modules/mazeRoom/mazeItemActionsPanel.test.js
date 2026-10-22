/**
 * ITEM ACTIONS in the maze panel (slice tile-primitives-item-actions): the
 * keys, the in-place verbs, the bump's facing, the cross refusal, the buttons
 * and the render view.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MazeRoomUI } from './mazeRoomUI.js';
import { _testOnly_resetModuleState } from './index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { createState } from './mazeRoomEngine.js';
import { crossEntry, useEntry } from './mazeKeys.js';
import { itemActionPicture, ROCK_CORRIDOR, SWORD } from './mazeItemActions.fixtures.js';
import { hashOf, recordingContext } from './drawOpRecorder.js';

function panelOn(rows, opts) {
    const panel = new MazeRoomUI(null, {});
    panel.world = itemActionPicture(rows, opts);
    panel.world.itemLocationNames = new Map();
    panel.state = createState(panel.world);
    panel.render = () => {};
    return panel;
}

const key = (panel, k, shiftKey = false) => panel._handleKeydown({ key: k, shiftKey, preventDefault: () => {} });

describe('MazeRoomUI — item actions', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        discoveryStateSingleton.discoveredRegions.clear();
        discoveryStateSingleton.discoveredLocations.clear();
        discoveryStateSingleton.discoveredExits.clear();
        discoveryStateSingleton.eventBus = { publish: () => {} };
    });

    it('fetch the sword, Shift+→ turns, Z strikes, the corridor opens', () => {
        const panel = panelOn(ROCK_CORRIDOR);
        for (const k of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowRight']) key(panel, k);
        expect(panel.state.inventory.has(SWORD)).toBe(true);
        expect(panel.state.player_pos).toEqual({ x: 3, y: 1 });
        key(panel, 'ArrowUp', true);                 // turn N, no move
        expect(panel.state.facing).toBe('N');
        expect(panel.state.player_pos).toEqual({ x: 3, y: 1 });
        key(panel, 'ArrowRight', true);              // turn E
        key(panel, 'z');
        expect(panel.state.broken).toEqual(['4,1']);
        expect(panel.message).toBe('Struck the rock with sword.');
        key(panel, 'ArrowRight');
        key(panel, 'ArrowRight');
        expect(panel.state.player_pos).toEqual({ x: 5, y: 1 });
        expect(panel._mazeQueue.getEntries().map((e) => `${e.actionType} ${e.actionId}`)).toEqual([
            'move S', 'move E', 'move N', 'move E', 'turn N', 'turn E', 'use sword', 'move E', 'move E',
        ]);
    });

    it('a bump is refused but turns the player (⚖ "Refusal + facing")', () => {
        const panel = panelOn(ROCK_CORRIDOR);
        expect(panel.state.facing).toBe('S');
        key(panel, 'ArrowUp');                       // wall at (1,0)
        expect(panel._queueRefusal).toBe('move N blocked: wall at (1,0)');
        expect(panel.state.facing).toBe('N');
        expect(panel.state.player_pos).toEqual({ x: 1, y: 1 });
    });

    it('Z without the sword is refused by the engine\'s sentence', () => {
        const panel = panelOn(ROCK_CORRIDOR);
        key(panel, 'z');
        expect(panel._queueRefusal).toBe(`use sword blocked: use sword needs ${SWORD}`);
    });

    it('on a world without an action_lib, Shift+arrow still MOVES and z does nothing', () => {
        const panel = panelOn(ROCK_CORRIDOR, { actionLib: null });
        key(panel, 'ArrowRight', true);
        expect(panel.state.player_pos).toEqual({ x: 2, y: 1 });
        key(panel, 'z');
        expect(panel._mazeQueue.length).toBe(1);
        expect('facing' in panel.state).toBe(false);
    });

    it('a cross entry is refused by name off a shared level world (Stage 2 runs it on one)', () => {
        const panel = panelOn(ROCK_CORRIDOR);
        const reason = panel._executeQueueAction(crossEntry('E',
            { boundary: 'b', sourceRegion: 'r1c5', targetRegion: 'r1c9' }));
        expect(reason).toBe('cross E → r1c9 refused: this world is not a shared level world');
    });

    it('the panel draws a broken rock as floor and a facing tick; a plain world draws neither', () => {
        const draw = (panel) => {
            const ctx = recordingContext();
            panel._drawWorld({ getContext: () => ctx });
            return ctx.__log;
        };
        const whole = draw(panelOn(ROCK_CORRIDOR, { actionLib: null }));
        const fresh = draw(panelOn(ROCK_CORRIDOR));
        const struck = panelOn(ROCK_CORRIDOR);
        struck.state.broken = ['4,1'];
        const broken = draw(struck);
        // the facing tick: an action world draws MORE ops than the plain one
        expect(fresh.length).toBeGreaterThan(whole.length);
        // the struck rock: its obstacle ops are gone
        expect(broken.length).toBeLessThan(fresh.length);
        expect(hashOf(broken)).not.toBe(hashOf(fresh));
    });
});

describe('MazeRoomUI — item-action buttons', () => {
    let saved;
    beforeEach(() => {
        _testOnly_resetModuleState();
        saved = globalThis.document;
        const el = () => {
            const node = {
                children: [], listeners: {}, className: '', textContent: '', title: '', disabled: false,
                appendChild(c) { this.children.push(c); return c; },
                addEventListener(type, fn) { this.listeners[type] = fn; },
                click() { this.listeners.click?.(); },
            };
            return node;
        };
        // ⚠ installed AFTER the panel is constructed (its constructor builds
        // DOM it would then need a full fake for) — see `rowOf`.
        fakeDocument = { createElement: el };
    });
    let fakeDocument;
    const rowOf = (panel) => {
        globalThis.document = fakeDocument;
        return panel._renderItemActionButtons(false);
    };
    afterEach(() => { globalThis.document = saved; });

    it('four turn buttons and Z: sword; clicking presses the same entry as the key', () => {
        const panel = panelOn(ROCK_CORRIDOR);
        const row = rowOf(panel);
        const labels = row.children.map((c) => c.textContent);
        expect(labels).toEqual(['⇡', '⇠', '⇣', '⇢', 'Z: sword', 'facing S']);
        row.children[3].click();                     // turn E
        expect(panel.state.facing).toBe('E');
        panel.state.inventory.add(SWORD);
        panel.state.player_pos = { x: 3, y: 1 };
        row.children[4].click();
        expect(panel.state.broken).toEqual(['4,1']);
        expect(panel._mazeQueue.getEntries().at(-1)).toMatchObject(useEntry('sword'));
    });

    it('no row on a world without an action_lib', () => {
        const panel = panelOn(ROCK_CORRIDOR, { actionLib: null });
        expect(rowOf(panel)).toBeNull();
    });
});
