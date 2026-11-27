/**
 * ⛓ THE NODE LOOK (region-graph-map-look; `nodeLook.js`, `mapLookLayer.js`). Through the panel's own builder on a
 * headless Cytoscape (`regionGraphElements.testkit.js`), over the FROZEN fixture presets (never a live preset digest):
 *   · the setting: its schema default is `graph`, the panel's schema registers it, an unknown value reads as `graph`;
 *     `map` takes effect only with subRegionView = merged;
 *   · `graph` IDENTITY: for every subRegionView value, with nodeLook `graph` (and with `map` in any view but merged)
 *     the element set AND every node's style bypass are exactly what the graph draws with no layer at all;
 *   · `map` + merged: every region / merged node that has a Region Map cell gets its cell (count = the merged node
 *     count less the cell-less ones), a rectangle at the cell's aspect ratio; ids, data and classes are unchanged;
 *     turning it off removes every bypass;
 *   · SHARED CODE: both panels draw a cell through `regionMap/regionMapCellDraw.js` (spied), and no file in
 *     `regionGraph/` draws a pixel of its own;
 *   · the squares' colours follow the view's state, re-coloured on a new view with no rebuild;
 *   · a tap on a square runs the LOCATION click on that location, a tap elsewhere on the node the REGION click.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';

const sm = { staticData: null, snapshot: null, rules: null };
vi.mock('./index.js', () => ({
    getNodeLabelProvider: () => null,
    getEdgeVisibilityFilter: () => null,
    getAccessibilityVisibilityFilter: () => null,
    getModuleEventBus: () => ({ publish() {} }),
    moduleDispatcher: null,
}));
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {
        getStaticData: () => sm.staticData,
        getLatestStateSnapshot: () => sm.snapshot,
        getStartRegions: () => sm.snapshot?.startRegions?.default ?? [],
    },
    getLastRawJsonData: () => (sm.rules ? { rawJsonData: sm.rules, selectedPlayerInfo: { playerId: '1' } } : null),
}));
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async (_k, d) => d, updateSetting: async () => {} } }));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
// The shared cell drawing, spied (the real functions run).
const calls = vi.hoisted(() => ({ art: [], squares: [], label: [], placeholder: [] }));
vi.mock('../regionMap/regionMapCellDraw.js', async (orig) => {
    const real = await orig();
    const spy = (name, fn) => (ctx, p) => { calls[name].push(p.frame?.key); return fn(ctx, p); };
    return {
        ...real,
        drawCellArt: spy('art', real.drawCellArt),
        drawCellSquares: spy('squares', real.drawCellSquares),
        drawCellLabel: spy('label', real.drawCellLabel),
        drawPlaceholderCell: spy('placeholder', real.drawPlaceholderCell),
    };
});

// ⛓ The shipped Seedling atlases → the FROZEN ones the frozen rules were cut against (regionGraphElements.testkit.js
// `FROZEN_ATLASES`): a live restamp (L25) would otherwise leave every frozen `atlas_ref` resolving to nothing.
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { GraphInteractionManager } = await import('./graphInteractionManager.js');
const { MapLookLayer, MAP_NODE_LONG_PX, MAP_NODE_STYLE_KEYS } = await import('./mapLookLayer.js');
const N = await import('./nodeLook.js');
const { SUB_REGION_VIEW_SCHEMA, isRegionGroupNode } = await import('./subRegionGroups.js');
const { RegionMapUI } = await import('../regionMap/regionMapUI.js');
const { squareColorKey } = await import('../regionMap/regionMapOverlay.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();

/** A no-op 2D context that answers what the drawing reads. */
const fakeCtx = () => new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }) },
    { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const fakeCanvas = () => ({ isConnected: true, width: 0, height: 0, dataset: {}, getContext: () => fakeCtx(), remove() {} });

/** Build the graph for `preset` (frozen) at state `stateName`, with `extra` ui fields; → { ui, layer }. */
function build(preset, { stateName = 'mid', layer = true, ...extra } = {}) {
    const rules = kit.loadFrozenRules(preset);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === stateName).snapshot;
    const ui = kit.makeUi(cytoscape, { cy: cytoscape({ headless: true, styleEnabled: true }), ...extra });
    ui.graphContainer = { clientWidth: 1600, clientHeight: 1000, style: {}, appendChild() {} };
    if (layer) ui.mapLook = new MapLookLayer(ui);
    new GraphDataManager(ui).buildGraphFromRegions(regions, null);
    return { ui, layer: ui.mapLook ?? null };
}

/** Elements (ids, data, classes) + every node's style bypass. */
function capture(ui) {
    const bypass = ui.cy.nodes().map((n) => [n.id(), MAP_NODE_STYLE_KEYS.map((k) => n.pstyle?.(k)?.bypass ? n.style(k) : null)]);
    return { elements: kit.serialiseElements(ui.cy), bypass };
}

const layers = [];
afterEach(() => { for (const l of layers.splice(0)) l.dispose(); });

describe('⛓ the setting', () => {
    it('defaults to "graph" from the schema only, and an unknown value reads as the default', () => {
        expect(N.NODE_LOOK_SCHEMA.default).toBe('graph');
        expect([...N.NODE_LOOK_SCHEMA.enum]).toEqual(['graph', 'map']);
        expect(N.normaliseNodeLook(undefined)).toBe('graph');
        expect(N.normaliseNodeLook('cells')).toBe('graph');
        expect(N.normaliseNodeLook('map')).toBe('map');
        expect(N.NODE_LOOK_KEY).toBe('moduleSettings.regionGraph.nodeLook');
    });
    it('the panel registers it in its settings schema beside subRegionView', () => {
        const src = readFileSync(join(HERE, 'index.js'), 'utf8');
        expect(src).toMatch(/nodeLook: \{ \.\.\.NODE_LOOK_SCHEMA, enum: \[\.\.\.NODE_LOOK_SCHEMA\.enum\] \}/);
    });
    it('"map" takes effect with subRegionView = merged ONLY', () => {
        for (const view of SUB_REGION_VIEW_SCHEMA.enum) {
            expect(N.nodeLookApplies('map', view), view).toBe(view === 'merged');
            expect(N.nodeLookApplies('graph', view), view).toBe(false);
        }
    });
});

describe('⛓ graph identity: the element set and the style bypasses are the no-layer ones', () => {
    for (const preset of ['seedling_playthrough', 'alttp']) {
        for (const view of SUB_REGION_VIEW_SCHEMA.enum) {
            it(`${preset} · ${view}`, () => {
                const base = capture(build(preset, { layer: false, subRegionView: view }).ui);
                const looks = view === 'merged' ? [undefined, 'graph'] : [undefined, 'graph', 'map'];
                for (const nodeLook of looks) {
                    const { ui, layer } = build(preset, { subRegionView: view, nodeLook });
                    layers.push(layer);
                    expect(layer.on, `${nodeLook}`).toBe(false);
                    expect(capture(ui), `${preset} ${view} nodeLook=${nodeLook}`).toEqual(base);
                }
                expect(base.bypass.every(([, b]) => b.every((v) => v === null))).toBe(true);
            });
        }
    }
});

describe('⛓ map + merged: each node draws as its Region Map cell', () => {
    it('seedling_playthrough: every node with a cell gets one; elements unchanged; off removes every bypass', () => {
        const base = capture(build('seedling_playthrough', { layer: false, subRegionView: 'merged' }).ui);
        const { ui, layer } = build('seedling_playthrough', { subRegionView: 'merged', nodeLook: 'map' });
        layers.push(layer);
        expect(layer.on).toBe(true);
        const drawn = ui.cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node'));
        const withCell = drawn.filter((n) => n.scratch('_rgMapKey') != null);
        // eslint-disable-next-line no-console
        console.log(`[nodeLook] seedling_playthrough merged: nodes=${drawn.length} cells=${withCell.length} `
            + `without=${drawn.filter((n) => n.scratch('_rgMapKey') == null).map((n) => n.id()).join(',')}`);
        expect(drawn.length).toBe(116);
        expect(withCell.length).toBe(layer.stats.nodes);
        expect(withCell.length).toBeGreaterThanOrEqual(drawn.length - 1);
        for (const n of withCell) {
            const f = layer.frames.get(n.scratch('_rgMapKey'));
            expect(n.style('shape')).toBe('rectangle');
            const [w, h] = [parseFloat(n.style('width')), parseFloat(n.style('height'))];
            expect(Math.max(w, h)).toBeCloseTo(MAP_NODE_LONG_PX, 6);
            if (Math.min(w, h) > 16) expect(w / h).toBeCloseTo(f.cell.w / f.cell.h, 6);
            if (isRegionGroupNode(n, 'merged')) expect(n.scratch('_rgMapKey')).toBe(n.data('groupKey'));
        }
        expect(kit.serialiseElements(ui.cy)).toEqual(base.elements);
        // The bypass capture is not vacuous: map's bypasses read back.
        const on = capture(ui);
        expect(on.bypass.filter(([, b]) => b[0] === 'rectangle').length).toBe(withCell.length);
        ui.nodeLook = 'graph';
        layer.sync();
        expect(layer.on).toBe(false);
        expect(capture(ui)).toEqual(base);
    });

    it('alttp (no painter): every region draws as a generic Region Map cell; nothing throws', () => {
        const { ui, layer } = build('alttp', { subRegionView: 'merged', nodeLook: 'map' });
        layers.push(layer);
        layer.canvas = fakeCanvas();
        ui.cy.nodes().forEach((n, i) => { n.position({ x: 100 + (i % 20) * 80, y: 100 + Math.floor(i / 20) * 80 }); });
        layer.paint();
        expect(layer.stats.nodes).toBe(ui.cy.nodes('.region').length - (ui.cy.nodes('.region').filter((n) => n.scratch('_rgMapKey') == null).length));
        expect(layer.stats.art).toBe(0);
        expect(layer.stats.generic).toBe(layer.stats.cells);
        expect(layer.stats.cells).toBeGreaterThan(0);
    });
});

describe('⛓ shared code', () => {
    it('both panels draw a cell through regionMap/regionMapCellDraw.js', () => {
        for (const k of Object.keys(calls)) calls[k].length = 0;
        // The Region Map: its own methods on a stand-in panel.
        const { layer } = build('seedling_playthrough', { subRegionView: 'merged', nodeLook: 'map' });
        layers.push(layer);
        const key = [...layer.model.cells.keys()].find((k) => layer.model.cells.get(k).tiles.length > 0);
        const map = Object.create(RegionMapUI.prototype);
        Object.assign(map, { model: layer.model, camera: { x: 0, y: 0, zoom: 1 }, vp: { w: 800, h: 600 }, dpr: 1,
            settings: { minSquarePx: 6 }, _squares: [], source: null, _onArt: () => {} });
        const f = layer.frames.get(key);
        map._drawArt(fakeCtx(), f, { art: 0, generic: 0 });
        map._drawSquares(fakeCtx(), f, null);
        map._drawLabel(fakeCtx(), f);
        expect(calls.art).toContain(key);
        expect(calls.squares).toContain(key);
        expect(calls.label).toContain(key);
        // The Region Graph: the layer's paint.
        for (const k of Object.keys(calls)) calls[k].length = 0;
        layer.canvas = fakeCanvas();
        layer.ui.cy.nodes().forEach((n, i) => { n.position({ x: 50 + (i % 15) * 100, y: 50 + Math.floor(i / 15) * 100 }); });
        layer.paint();
        expect(calls.art.length).toBe(layer.stats.cells - layer.stats.fogged);
        expect(calls.squares.length).toBe(calls.art.length);
        expect(calls.label.length).toBe(calls.art.length);
    });

    it('no file in regionGraph/ draws a pixel of its own', () => {
        const files = readdirSync(HERE).filter((f) => f.endsWith('.js') && !f.includes('.test.') && !f.includes('.testkit.'));
        for (const f of files) {
            const src = readFileSync(join(HERE, f), 'latin1');
            expect(src, f).not.toMatch(/\.(fillRect|strokeRect|drawImage|fillText|arc|moveTo|lineTo)\(/);
        }
    });
});

describe('⛓ squares follow the state, re-coloured with no rebuild', () => {
    it('a new view re-colours the same squares; the model is not rebuilt', () => {
        const { ui, layer } = build('seedling_playthrough', { subRegionView: 'merged', nodeLook: 'map' });
        layers.push(layer);
        layer.canvas = fakeCanvas();
        ui.cy.nodes().forEach((n, i) => { n.position({ x: 50 + (i % 15) * 100, y: 50 + Math.floor(i / 15) * 100 }); });
        const locs = [...layer.model.cells.values()].flatMap((c) => c.tiles.map((t) => t.location));
        const regionOfLoc = new Map();
        for (const [name, r] of sm.staticData.regions) for (const l of r.locations ?? []) regionOfLoc.set(l.name, name);
        const viewOf = (state, color) => ({
            locations: new Map(locs.map((l) => [l, { name: l, region: regionOfLoc.get(l), state, visibility: 'shown' }])),
            regions: new Map([...sm.staticData.regions.keys()].map((r) => [r, { color }])),
        });
        const model = layer.model;
        const colours = (view) => {
            layer.view = { get: () => view, dispose() {} };
            layer.paint();
            return layer._squares.map((q) => q.color);
        };
        for (const [state, color] of [['accessible', 'accessible'], ['inaccessible', 'accessible'], ['checked', 'accessible'], ['accessible', null]]) {
            const view = viewOf(state, color);
            const got = colours(view);
            expect(got.length).toBeGreaterThan(0);
            expect(new Set(got)).toEqual(new Set([squareColorKey(view.locations.get(locs[0]), { color })]));
        }
        expect(layer.model).toBe(model);
    });
});

describe('⛓ clicks', () => {
    it('a tap on a square runs the LOCATION click on it; a tap off the squares runs the REGION click', () => {
        const { ui, layer } = build('seedling_playthrough', { subRegionView: 'merged', nodeLook: 'map' });
        layers.push(layer);
        layer.canvas = fakeCanvas();
        ui.cy.nodes().forEach((n, i) => { n.position({ x: 50 + (i % 15) * 100, y: 50 + Math.floor(i / 15) * 100 }); });
        layer.view = { get: () => null, dispose() {} };
        ui.cy.zoom(4);
        const node = ui.cy.nodes().filter((n) => n.scratch('_rgMapKey') != null
            && layer.model.cells.get(n.scratch('_rgMapKey')).tiles.length > 0)[0];
        ui.cy.center(node);
        layer.paint();
        const q = layer._squares.find((s) => s.key === node.scratch('_rgMapKey'));
        expect(q).toBeTruthy();
        const im = new GraphInteractionManager(ui);
        const seen = [];
        im.handleLocationClick = (loc, region) => { seen.push(['location', loc, region]); return 'loc'; };
        im.handleRegionNodeClick = (n, region) => { seen.push(['region', region ?? n.id()]); return 'reg'; };
        expect(im.onNodeTap(node, { renderedPosition: { x: q.sx, y: q.sy } })).toBe('loc');
        expect(seen[0][1]).toBe(q.location);
        expect(seen[0][2]).toBeTruthy();
        const box = node.renderedBoundingBox();
        im.onNodeTap(node, { renderedPosition: { x: box.x1 + 1, y: box.y2 - 1 } });
        expect(seen[1][0]).toBe('region');
        // graph look: the same tap at the square's spot runs the region click.
        ui.nodeLook = 'graph';
        layer.sync();
        im.onNodeTap(node, { renderedPosition: { x: q.sx, y: q.sy } });
        expect(seen[2][0]).toBe('region');
    });
});
