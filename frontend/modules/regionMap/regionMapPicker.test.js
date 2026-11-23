/**
 * regionMapPicker — the Region Map's "Go to" (region-map tutorial, G1). vitest runs `environment: 'node'`, so the
 * picker's root is a small fake (the boxes, the lists, the status; listeners kept). Pinned here:
 *   - the lists: the DRAWN cells (discovery's hidden left out) and their squares' locations (hidden and placeholder
 *     left out), sorted;
 *   - choosing a region / a location calls the panel's `clickCell(frame, square)` — the pointer-up path — with the
 *     frame a canvas click on that cell hits and `{ location }` for a square, then centres on the cell, then says so;
 *   - an unknown name clicks nothing.
 * That the picker's click EQUALS a canvas click (the same `lastClick`, the same bus record, master off included) is
 * the in-app row `region-map-go-to-equals-canvas-click` (it needs the real panel).
 */
import { describe, it, expect } from 'vitest';
import { MAP_PICKER, pickableCells, pickableLocations, setupRegionMapPicker } from './regionMapPicker.js';

class El {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; this.open = false; }
    get ownerDocument() { return { createElement: (t) => new El(t) }; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    fire(type) { for (const fn of this.listeners[type] ?? []) fn(); }
    replaceChildren(...kids) { this.children = kids; }
}

function fakeRoot() {
    const root = new El('details');
    const parts = { [MAP_PICKER.region]: new El('input'), [MAP_PICKER.location]: new El('input'), [MAP_PICKER.status]: new El('span') };
    const lists = [new El('datalist'), new El('datalist')];
    root.querySelector = (sel) => parts[sel] ?? null;
    root.querySelectorAll = (sel) => (sel === 'datalist' ? lists : []);
    return { root, region: parts[MAP_PICKER.region], location: parts[MAP_PICKER.location], status: parts[MAP_PICKER.status], lists };
}

/** A panel with three cells: `a` shown (two squares, one hidden by discovery), `b` a placeholder, `c` hidden. */
function fakeUi() {
    const frame = (key) => ({ key, cell: { x: 0, y: 0, w: 10, h: 10 } });
    const frames = new Map(['b', 'a', 'c'].map((k) => [k, frame(k)]));
    const vis = { a: 'shown', b: 'placeholder', c: 'hidden' };
    const view = {
        locations: new Map([['A chest', { visibility: 'shown' }], ['A secret', { visibility: 'hidden' }], ['B chest', { visibility: 'shown' }]]),
    };
    const cells = new Map([
        ['a', { tiles: [{ location: 'A chest', kind: 'item' }, { location: 'A secret', kind: 'item' }, { location: 'A flag', kind: 'event' }] }],
        ['b', { tiles: [{ location: 'B chest', kind: 'item' }] }],
        ['c', { tiles: [{ location: 'C chest', kind: 'item' }] }],
    ]);
    const calls = [];
    return {
        calls,
        frames,
        model: { cells },
        view: { get: () => view },
        _visibilityOf: (k) => vis[k],
        clickCell: async (f, sq) => { calls.push(['click', f.key, sq]); return { n: calls.length, cell: f.key }; },
        centreOnRegion: (k) => { calls.push(['centre', k]); return true; },
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('regionMapPicker', () => {
    it('lists the drawn cells and their visible locations', () => {
        const ui = fakeUi();
        expect([...pickableCells(ui).keys()]).toEqual(['b', 'a']);
        expect([...pickableLocations(ui).entries()]).toEqual([
            ['A chest', { key: 'a', kind: 'item' }], ['A flag', { key: 'a', kind: 'event' }],
        ]);
        const ui2 = fakeUi();
        const p = fakeRoot();
        setupRegionMapPicker(ui2, p.root);
        p.root.open = true;
        p.root.fire('toggle');
        expect(p.lists[0].children.map((o) => o.value)).toEqual(['a', 'b']);
        expect(p.lists[1].children.map((o) => o.value)).toEqual(['A chest', 'A flag']);
    });

    it('a region goes through clickCell with the cell\'s frame, then centres, then says so', async () => {
        const ui = fakeUi();
        const p = fakeRoot();
        const api = setupRegionMapPicker(ui, p.root);
        expect(await api.goToRegion('a')).toEqual({ n: 1, cell: 'a' });
        expect(ui.calls).toEqual([['click', 'a', null], ['centre', 'a']]);
        expect(p.status.textContent).toBe('Went to region a.');
        // The box's change does the same.
        p.region.value = ' b ';
        p.region.fire('change');
        await flush();
        expect(ui.calls.slice(2)).toEqual([['click', 'b', null], ['centre', 'b']]);
    });

    it('a location goes through clickCell with its square, on its cell', async () => {
        const ui = fakeUi();
        const p = fakeRoot();
        const api = setupRegionMapPicker(ui, p.root);
        await api.goToLocation('A flag');
        expect(ui.calls).toEqual([['click', 'a', { location: 'A flag', kind: 'event' }], ['centre', 'a']]);
        expect(p.status.textContent).toBe('Went to location A flag (in a).');
    });

    it('an unknown, hidden or placeholder name clicks nothing', async () => {
        const ui = fakeUi();
        const p = fakeRoot();
        const api = setupRegionMapPicker(ui, p.root);
        expect(await api.goToRegion('c')).toBe(null);
        expect(p.status.textContent).toBe('No region "c" on the map.');
        expect(await api.goToLocation('A secret')).toBe(null);
        expect(await api.goToLocation('B chest')).toBe(null);
        expect(p.status.textContent).toBe('No location "B chest" in the map\'s cells.');
        expect(ui.calls).toEqual([]);
    });
});
