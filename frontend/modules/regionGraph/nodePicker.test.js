/**
 * nodePicker — the Region Graph's "Go to" (region-view-dedup: written at base 39b1df8cbd, BEFORE the picker moved onto
 * `regionView/goToPicker.js`, and passed there unchanged). vitest runs `environment: 'node'`, so the picker's root is
 * a small fake (the boxes, the lists, the status; listeners kept) and Cytoscape is a fake `cy`. Pinned here:
 *   - the markup (`pickerHTML`, byte for byte, by digest) and the selectors;
 *   - the lists: the region nodes the graph shows (players, location nodes and `discovery-hidden` ones left out) and
 *     every location of those regions (discovery's undiscovered left out in discovery mode), sorted;
 *   - when the lists refresh: on open (`toggle`), on a box's focus, and through `ui.refreshNodePicker` only while open;
 *   - choosing a region / a location: the SAME tap handler, the centring, and the status wording; an unknown name
 *     taps nothing.
 * The in-app row `test_region_graph_node_picker` drives the real panel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

const staticData = { regions: new Map() };
vi.mock('../stateManager/index.js', () => ({ stateManagerProxySingleton: { getStaticData: () => staticData } }));
const undiscovered = new Set();
vi.mock('../discovery/singleton.js', () => ({ default: { isLocationDiscovered: (n) => !undiscovered.has(n) } }));

const { PICKER, pickerHTML, setupNodePicker } = await import('./nodePicker.js');

class El {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; this.open = false; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    fire(type) { for (const fn of this.listeners[type] ?? []) fn(); }
    replaceChildren(...kids) { this.children = kids; }
}
globalThis.document ??= undefined;

function fakeNode(id, classes, data) {
    return { id: () => id, hasClass: (c) => classes.includes(c), data: (k) => data[k], _id: id };
}

function fakeUi() {
    const regionList = new El('datalist'); const locationList = new El('datalist');
    const parts = { [PICKER.region]: new El('input'), [PICKER.location]: new El('input'), [PICKER.status]: new El('div'),
        '#rg-pick-region-list': regionList, '#rg-pick-location-list': locationList };
    const root = new El('details');
    root.querySelector = (sel) => parts[sel] ?? null;
    const nodes = [
        fakeNode('Zed', ['region'], { regionName: 'Zed' }),
        fakeNode('Hub', ['region'], { regionName: 'Hub' }),
        fakeNode('Gone', ['region', 'discovery-hidden'], { regionName: 'Gone' }),
        fakeNode('player', ['player'], { regionName: 'Hub' }),
        fakeNode('loc_Hub_Chest', ['location-node'], { locationName: 'Hub Chest', label: 'Hub Chest', parentRegion: 'Hub' }),
        fakeNode('anon', ['region'], {}),
    ];
    const calls = [];
    const list = (arr) => Object.assign(arr, { filter: (f) => list(Array.prototype.filter.call(arr, f)) });
    const cy = {
        nodes: (sel) => list(sel === '.location-node' ? nodes.filter((n) => n.hasClass('location-node')) : [...nodes]),
        zoom: () => 0.5,
        animate: (opts, o2) => calls.push(['animate', opts.center.eles._id ?? 'stand-in', opts.zoom, o2.duration]),
    };
    const ui = {
        cy,
        isDiscoveryModeActive: false,
        controlPanel: { querySelector: (sel) => (sel === PICKER.section ? root : null) },
        interactionManager: {
            handleRegionNodeClick: (n) => calls.push(['region', n._id]),
            handleLocationNodeClick: (n) => calls.push(['location', n._id ?? 'stand-in',
                n.data('locationName'), n.data('label'), n.data('parentRegion')]),
        },
    };
    return { ui, root, parts, regionList, locationList, calls };
}

const values = (list) => list.children.map((o) => o.value);

beforeEach(() => {
    staticData.regions = new Map([
        ['Hub', { locations: [{ name: 'Hub Chest' }, { name: 'Hub Bell' }] }],
        ['Zed', { locations: [{ name: 'Zed Key' }] }],
        ['Gone', { locations: [{ name: 'Gone Gem' }] }],
    ]);
    undiscovered.clear();
    globalThis.document = { createElement: (t) => new El(t) };
});

describe('nodePicker (the Region Graph)', () => {
    it('keeps its markup byte for byte', () => {
        const html = pickerHTML();
        expect(html.length).toBe(1135);
        expect(createHash('sha256').update(html).digest('hex'))
            .toBe('74d05aa2fc966f534de03fd2c74423096bdbfe3c5106d9b54985c0dd78ec5afa');
        expect(PICKER).toEqual({ section: 'details.rg-pick', region: 'input.rg-pick-region',
            location: 'input.rg-pick-location', status: '.rg-pick-status' });
    });

    it('lists the shown region nodes and their locations, sorted, when opened or focused', () => {
        const { ui, root, parts, regionList, locationList } = fakeUi();
        setupNodePicker(ui);
        expect(values(regionList)).toEqual([]);
        root.open = true; root.fire('toggle');
        expect(values(regionList)).toEqual(['Hub', 'Zed']);
        expect(values(locationList)).toEqual(['Hub Bell', 'Hub Chest', 'Zed Key']);
        expect(regionList.children.every((o) => o.tagName === 'option')).toBe(true);
        // Discovery mode leaves undiscovered locations out; a focus re-reads.
        ui.isDiscoveryModeActive = true; undiscovered.add('Hub Bell');
        parts[PICKER.location].fire('focus');
        expect(values(locationList)).toEqual(['Hub Chest', 'Zed Key']);
        undiscovered.add('Zed Key');
        parts[PICKER.region].fire('focus');
        expect(values(locationList)).toEqual(['Hub Chest']);
    });

    it('refreshes through ui.refreshNodePicker only while open', () => {
        const { ui, root, regionList } = fakeUi();
        setupNodePicker(ui);
        expect(typeof ui.refreshNodePicker).toBe('function');
        ui.refreshNodePicker();
        expect(values(regionList)).toEqual([]);
        root.open = true;
        ui.refreshNodePicker();
        expect(values(regionList)).toEqual(['Hub', 'Zed']);
        root.open = false; root.fire('toggle');
        staticData.regions.set('Zed', { locations: [] });
        expect(values(regionList)).toEqual(['Hub', 'Zed']);
    });

    it('taps the region node, centres on it and says so', () => {
        const { ui, parts, calls } = fakeUi();
        setupNodePicker(ui);
        const box = parts[PICKER.region];
        box.value = '  Zed '; box.fire('change');
        expect(calls).toEqual([['region', 'Zed'], ['animate', 'Zed', 1, 300]]);
        expect(parts[PICKER.status].textContent).toBe('Went to region Zed.');
        box.value = 'Gone'; box.fire('change');
        expect(parts[PICKER.status].textContent).toBe('No region "Gone" in the graph.');
        box.value = '   '; box.fire('change');
        expect(parts[PICKER.status].textContent).toBe('No region "Gone" in the graph.');
        expect(calls.length).toBe(2);
    });

    it('taps a drawn location node, or a stand-in for an undrawn one', () => {
        const { ui, parts, calls } = fakeUi();
        setupNodePicker(ui);
        const box = parts[PICKER.location];
        box.value = 'Hub Chest'; box.fire('change');
        expect(parts[PICKER.status].textContent).toBe('Went to location Hub Chest (in Hub).');
        box.value = 'Zed Key'; box.fire('change');
        expect(parts[PICKER.status].textContent).toBe('Went to location Zed Key (in Zed).');
        box.value = 'Gone Gem'; box.fire('change');
        expect(parts[PICKER.status].textContent).toBe('No location "Gone Gem" in the graph\'s regions.');
        expect(calls).toEqual([
            ['location', 'loc_Hub_Chest', 'Hub Chest', 'Hub Chest', 'Hub'], ['animate', 'loc_Hub_Chest', 1, 300],
            ['location', 'stand-in', 'Zed Key', 'Zed Key', 'Zed'], ['animate', 'Zed', 1, 300],
        ]);
    });

    it('does nothing without its section', () => {
        const { ui } = fakeUi();
        ui.controlPanel.querySelector = () => null;
        expect(setupNodePicker(ui)).toBeUndefined();
        expect(ui.refreshNodePicker).toBeUndefined();
    });
});
