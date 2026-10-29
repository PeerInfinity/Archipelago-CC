/**
 * Keypress latency in the maze panel (slice maze-keypress-latency).
 *
 * The "Paths & obstacles" / "Compiled rules" readout (slice
 * maze-keypress-latency). It re-ran the whole extraction + compile on every
 * render — every keypress — for JSON shown inside a CLOSED <details>: ~97% of
 * a Seedling press. It is now computed only while a block is open, cached per
 * world object, and recomputed after an edit or for a new world.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MazeRoomUI } from './mazeRoomUI.js';
import { _testOnly_resetModuleState } from './index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { createState, generateMaze } from './mazeRoomEngine.js';
import { PALETTE_TYPES } from './mazeRoomEditor.js';

// Just enough DOM for `_renderRules` (the suite runs under node).
function fakeElement(tag) {
    const listeners = {};
    return {
        tagName: tag.toUpperCase(),
        children: [],
        style: {},
        className: '',
        textContent: '',
        open: false,
        appendChild(child) { this.children.push(child); return child; },
        replaceChildren(...kids) { this.children = kids; },
        addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
        fire(ev) { for (const fn of listeners[ev] ?? []) fn({ preventDefault() {} }); },
    };
}

function readoutBlocks(panel) {
    return panel._renderRules().children.filter((c) => c.tagName === 'DETAILS');
}

function openBlock(block) {
    block.open = true;
    block.fire('toggle');
}

function panelOnGeneratedMaze() {
    const panel = new MazeRoomUI(null, {});
    // Installed after construction: the constructor builds its own DOM when
    // a document exists, and this one only serves the readout.
    globalThis.document = { createElement: fakeElement };
    const { world } = generateMaze({ width: 9, height: 9, seed: 3 });
    panel.world = world;
    panel.state = createState(world);
    // Every render the press makes rebuilds the readout, as render() does.
    panel.render = () => { panel._lastReadout = readoutBlocks(panel); };
    return panel;
}

// A direction the player can take from where it stands.
function pressAMove(panel) {
    const before = `${panel.state.player_pos.x},${panel.state.player_pos.y}`;
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
        panel._handleKeydown({ key, shiftKey: false, preventDefault() {} });
        if (`${panel.state.player_pos.x},${panel.state.player_pos.y}` !== before) return;
    }
    throw new Error('no direction moved the player');
}

describe('MazeRoomUI — rules readout is lazy and cached', () => {
    let savedDocument;
    beforeEach(() => {
        _testOnly_resetModuleState();
        discoveryStateSingleton.discoveredRegions.clear();
        discoveryStateSingleton.discoveredLocations.clear();
        discoveryStateSingleton.discoveredExits.clear();
        discoveryStateSingleton.eventBus = { publish: () => {} };
        savedDocument = globalThis.document;
    });
    afterEach(() => {
        globalThis.document = savedDocument;
    });

    it('a move with the readout closed does NOT compute it', () => {
        const panel = panelOnGeneratedMaze();
        const compute = vi.spyOn(panel, '_computeRulesReadout');
        pressAMove(panel);
        pressAMove(panel);
        expect(compute).not.toHaveBeenCalled();
        expect(panel._lastReadout).toHaveLength(2);
    });

    it('opening a block computes it ONCE; it stays open, and moves reuse it', () => {
        const panel = panelOnGeneratedMaze();
        const compute = vi.spyOn(panel, '_computeRulesReadout');
        panel.render();
        openBlock(panel._lastReadout[0]);
        expect(compute).toHaveBeenCalledTimes(1);
        const pre = panel._lastReadout[0].children.find((c) => c.tagName === 'PRE');
        expect(JSON.parse(pre.textContent)).toBeTypeOf('object');

        pressAMove(panel);
        pressAMove(panel);
        expect(panel._lastReadout[0].open).toBe(true);
        expect(panel._lastReadout[1].open).toBe(false);
        // Opening the second block shares the same computation.
        openBlock(panel._lastReadout[1]);
        expect(compute).toHaveBeenCalledTimes(1);
    });

    it('an edit invalidates it: the next render of the open block recomputes', () => {
        const panel = panelOnGeneratedMaze();
        const compute = vi.spyOn(panel, '_computeRulesReadout');
        panel.render();
        openBlock(panel._lastReadout[0]);
        expect(compute).toHaveBeenCalledTimes(1);

        const editor = panel._ensureEditor();
        editor.selectType(PALETTE_TYPES.WALL);
        const { x, y } = panel.state.player_pos;
        // The tile beside the player that is floor today.
        const target = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
            .find(([tx, ty]) => { const r = editor.applyAt(structuredClone(panel.world), tx, ty); return r.ok && r.type !== 'noop'; });
        panel._applyEditAt(...target);
        // _applyEditAt's verifier pass recomputes once; the render reuses it.
        expect(compute).toHaveBeenCalledTimes(2);
        expect(panel._lastReadout[0].open).toBe(true);
    });

    it('a new world recomputes (the cache is per world object)', () => {
        const panel = panelOnGeneratedMaze();
        const compute = vi.spyOn(panel, '_computeRulesReadout');
        panel.render();
        openBlock(panel._lastReadout[0]);
        panel.world = generateMaze({ width: 9, height: 9, seed: 4 }).world;
        panel.state = createState(panel.world);
        panel.render();
        expect(compute).toHaveBeenCalledTimes(2);
    });
});

describe('MazeRoomUI — one keypress renders once', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        discoveryStateSingleton.eventBus = { publish: () => {} };
    });

    it('a press whose step crosses regions (renders asked: several) rebuilds the DOM ONCE, before the press returns', () => {
        const panel = new MazeRoomUI(null, {});
        const { world } = generateMaze({ width: 9, height: 9, seed: 3 });
        panel.applyLoadedRegion({ region_id: 'A', world, arrivedFrom: null });
        const asked = vi.spyOn(panel, 'render');
        const built = vi.spyOn(panel, '_renderNow').mockImplementation(() => {});
        // The crossing loads the next region from inside the step, as
        // procgenPlayer does (maze:loadRegion → applyLoadedRegion → render).
        panel._runEntry = () => {
            panel.applyLoadedRegion({ region_id: 'B', world: generateMaze({ width: 9, height: 9, seed: 4 }).world, arrivedFrom: null });
            panel.render();
            return { ok: true };
        };
        panel._handleKeydown({ key: 'ArrowRight', shiftKey: false, preventDefault() {} });
        expect(panel.currentRegionId).toBe('B');
        expect(asked.mock.calls.length).toBeGreaterThan(1);
        expect(built).toHaveBeenCalledTimes(1);
        // Outside a press, render() is immediate as before.
        panel.render();
        expect(built).toHaveBeenCalledTimes(2);
    });

    it('a render asked inside a press that THROWS still lands', () => {
        const panel = new MazeRoomUI(null, {});
        const built = vi.spyOn(panel, '_renderNow').mockImplementation(() => {});
        expect(() => panel._batchRenders(() => { panel.render(); throw new Error('boom'); })).toThrow('boom');
        expect(built).toHaveBeenCalledTimes(1);
        expect(panel._renderBatchDepth).toBe(0);
    });
});

describe('MazeRoomUI — focus on an already-focused root', () => {
    let savedDocument;
    beforeEach(() => { savedDocument = globalThis.document; });
    afterEach(() => { globalThis.document = savedDocument; });

    it('skips the layout probe (getClientRects forces a synchronous layout)', () => {
        const panel = new MazeRoomUI(null, {});
        const el = { getClientRects: vi.fn(() => [{}]), focus: vi.fn() };
        panel.rootElement = el;
        globalThis.document = { activeElement: el };
        panel._focusWhenVisible();
        expect(el.getClientRects).not.toHaveBeenCalled();
        expect(panel._focusTimer).toBeNull();
        // Not focused: probe and focus, as before.
        globalThis.document = { activeElement: null };
        panel._focusWhenVisible();
        expect(el.getClientRects).toHaveBeenCalledTimes(1);
        expect(el.focus).toHaveBeenCalledTimes(1);
    });
});
