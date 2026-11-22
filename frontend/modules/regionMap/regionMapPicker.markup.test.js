/**
 * regionMapPicker — what `regionMapPicker.test.js` does not pin, written at base 39b1df8cbd (region-view-dedup) BEFORE
 * the picker's wiring moved onto `regionView/goToPicker.js`, and passed there unchanged:
 *   - the markup (`buildRegionMapPicker`, byte for byte by digest, with its per-instance datalist ids);
 *   - the refresh on a box's focus, the returned `refresh`, a blank box, and a click that throws.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { MAP_PICKER, buildRegionMapPicker, setupRegionMapPicker } from './regionMapPicker.js';

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

function fakeUi({ click } = {}) {
    const frames = new Map([['a', { key: 'a' }], ['b', { key: 'b' }]]);
    const calls = [];
    return {
        calls,
        frames,
        model: { cells: new Map([['a', { tiles: [{ location: 'A chest' }] }], ['b', { tiles: [] }]]) },
        view: { get: () => ({ locations: new Map() }) },
        _visibilityOf: () => 'shown',
        clickCell: click ?? (async (f, sq) => { calls.push(['click', f.key, sq]); return { cell: f.key }; }),
        centreOnRegion: (k) => { calls.push(['centre', k]); },
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('regionMapPicker (markup and wiring)', () => {
    it('keeps its markup byte for byte, with per-instance list ids', () => {
        const doc = { createElement: (tag) => ({ tag, className: '', innerHTML: '', style: {} }) };
        const a = buildRegionMapPicker(doc);
        const b = buildRegionMapPicker(doc);
        const n = (el) => Number(/region-map-pick-region-list-(\d+)/.exec(el.innerHTML)[1]);
        expect(n(b)).toBe(n(a) + 1);
        expect(a.innerHTML.includes(`region-map-pick-location-list-${n(a)}"`)).toBe(true);
        const canon = (el) => JSON.stringify({ tag: el.tag, className: el.className, style: el.style,
            innerHTML: el.innerHTML.replaceAll(`-list-${n(el)}"`, '-list-N"') });
        expect(canon(a)).toBe(canon(b));
        expect(canon(a).length).toBe(1102);
        expect(createHash('sha256').update(canon(a)).digest('hex'))
            .toBe('0052aadcebaf4bf548586ec59995e49587000c5679c868d0bc76806b092a41a6');
        expect(MAP_PICKER).toEqual({ section: 'details.region-map-pick', region: 'input.region-map-pick-region',
            location: 'input.region-map-pick-location', status: '.region-map-pick-status' });
    });

    it('refreshes on a focus and through the returned refresh, open or not', () => {
        const ui = fakeUi();
        const p = fakeRoot();
        const api = setupRegionMapPicker(ui, p.root);
        expect(p.lists[0].children).toEqual([]);
        p.location.fire('focus');
        expect(p.lists[0].children.map((o) => o.value)).toEqual(['a', 'b']);
        ui.frames.delete('b');
        api.refresh();
        expect(p.lists[0].children.map((o) => o.value)).toEqual(['a']);
        ui.frames.delete('a');
        p.region.fire('focus');
        expect(p.lists[0].children).toEqual([]);
        // A closing toggle does not refresh.
        ui.frames.set('a', { key: 'a' });
        p.root.fire('toggle');
        expect(p.lists[0].children).toEqual([]);
    });

    it('ignores a blank box and reports a click that throws', async () => {
        const ui = fakeUi({ click: async () => { throw new Error('boom'); } });
        const p = fakeRoot();
        setupRegionMapPicker(ui, p.root);
        p.region.value = '  ';
        p.region.fire('change');
        await flush();
        expect(p.status.textContent).toBe('');
        p.region.value = 'a';
        p.region.fire('change');
        await flush();
        expect(p.status.textContent).toBe('Could not go to a: boom');
        p.location.value = 'A chest';
        p.location.fire('change');
        await flush();
        expect(p.status.textContent).toBe('Could not go to A chest: boom');
        expect(ui.calls).toEqual([]);
    });
});
