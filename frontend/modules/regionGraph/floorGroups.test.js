/**
 * ⛓ FLOOR GROUPING (region-graph-dungeon-groups; `floorGroups.js`, `floorBoxLayer.js`, glue in
 * `layoutControlsManager.js`). Over the FROZEN fixture presets (`regionGraphElements.testkit.js` `loadFrozenRules` and
 * `loadFrozenAtlas`, never a live preset digest), through the panel's own builder on a headless Cytoscape:
 *   · `none` IS today's layout: the positions digests pinned at the base (102dcbeb16), per view and look;
 *   · the groups are the Region Map's (`buildRegionMapModel().groupOf`), per preset; alttp and the maze are INERT
 *     (no drawn edge joins two floor groups): every value gives `none`'s positions;
 *   · `soft` at strength 0 equals `none`;
 *   · `twoStep` / `twoStepBoxes`: blocks never overlap, no node lies inside another floor group's block, 0 node overlaps,
 *     in every view and both node looks;
 *   · determinism per value: two builds, and the inputs in other insertion orders;
 *   · the boxes: an overlay, never an element (every reader skips it); one per floor group of 2+; a later layout clears it;
 *     `nested` + `twoStepBoxes` keeps its compound boxes;
 *   · the settings: schema defaults only, registered by the panel.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';

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
// ⛓ region-graph-floor-rename-letters: a settings STORE, so a write reads back (the round trip); empty = every key
// answers its call-site default (undefined), as before.
const store = vi.hoisted(() => new Map());
vi.mock('../../app/core/settingsManager.js', () => ({ default: {
    getSetting: async (k, d) => (store.has(k) ? store.get(k) : d),
    updateSetting: async (k, v) => { store.set(k, v); },
} }));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
// ⛓ The shipped Seedling atlases → the FROZEN ones the frozen rules were cut against (as directionLayout.test.js).
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { LayoutControlsManager, isDirectionSettingKey } = await import('./layoutControlsManager.js');
const { MapLookLayer } = await import('./mapLookLayer.js');
const { isRegionGroupNode, SUB_REGION_VIEW_SCHEMA } = await import('./subRegionGroups.js');
const { FloorBoxLayer, FLOOR_BOX_CLASS } = await import('./floorBoxLayer.js');
const D = await import('./directionLayout.js');
const G = await import('./floorGroups.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();
const digest = (positions) => createHash('sha256').update(D.positionsKey(positions)).digest('hex').slice(0, 16);
const NODE_STYLE = [{ selector: 'node', style: { width: 60, height: 45, 'border-width': 2, shape: 'ellipse' } }];
const VALUES = G.FLOOR_GROUPING_SCHEMA.enum;

/** A minimal DOM for the box layer (vitest runs in node): elements with style, dataset, children. */
function fakeDoc() {
    const make = (tag) => {
        const el = {
            tagName: tag, style: {}, dataset: {}, children: [], parentNode: null, className: '', textContent: '',
            get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.children.indexOf(this); return p.children[i + 1] ?? null; },
            classList: { contains(c) { return String(el.className).split(/\s+/).includes(c); } },
            setAttribute(k, v) {
                if (k !== 'style') { this[k] = v; return; }
                for (const decl of String(v).split(';')) {
                    const i = decl.indexOf(':');
                    if (i > 0) this.style[decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = decl.slice(i + 1).trim();
                }
            },
            appendChild(c) { c.parentNode?.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = this; this.children.push(c); return c; },
            remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } },
            querySelector(sel) {
                const cls = sel.replace(/^\./, '');
                const walk = (n) => { for (const c of n.children) { if (c.classList.contains(cls)) return c; const f = walk(c); if (f) return f; } return null; };
                return walk(this);
            },
        };
        return el;
    };
    return { createElement: make };
}

/** Build the panel's graph for frozen `preset` in `view` with `nodeLook` → { ui, lcm, dm }. */
function build(preset, view, { nodeLook = 'graph', open = [], doc = null } = {}) {
    const rules = kit.loadFrozenRules(preset);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === 'mid').snapshot;
    const ui = kit.makeUi(cytoscape, {
        cy: cytoscape({ headless: true, styleEnabled: true, style: NODE_STYLE }), subRegionView: view, nodeLook,
    });
    ui.graphContainer = doc ? doc.createElement('div') : null;
    ui.mapLook = new MapLookLayer(ui);
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    if (view === 'collapsible') { const set = dm.openGroupKeys(); set.clear(); for (const k of open) set.add(k); }
    dm.buildGraphFromRegions(regions, null);
    const lcm = new LayoutControlsManager(ui);
    ui.layoutControlsManager = lcm;
    if (nodeLook === 'map') expect(ui.mapLook.sync()).toBe(true);
    return { ui, lcm, dm };
}

const run = (lcm, grouping, groupStrength = G.FLOOR_GROUP_STRENGTH_SCHEMA.default) => lcm.buildDirectionLayout(
    D.normaliseDirectionSettings(), { grouping, groupStrength });

describe('⛓ 1. `none` is today\'s Direction-aware layout (digests at the base 102dcbeb16, frozen fixtures)', () => {
    // Measured with the base's own `directionLayout.js` + `layoutControlsManager.js`, default settings.
    const BASE = [
        ['seedling_playthrough', 'merged', 'map', 'a39c9bbf91314acc'],
        ['seedling_playthrough', 'nested', 'graph', 'aef1e2df01b4c3c3'],
        ['seedling_playthrough', 'collapsible', 'graph', '0cb6622a7ac83579'],
        ['seedling_playthrough', 'separate', 'graph', 'da15dea78ba5526c'],
        ['seedling_atlas', 'merged', 'map', '14c364da558358a6'],
        ['alttp', 'separate', 'graph', '64fd43393961d213'],
        ['procgen_maze', 'separate', 'graph', 'f6866e94f5279b9e'],
    ];
    for (const [preset, view, nodeLook, want] of BASE) {
        it(`${preset} · ${view} · ${nodeLook}`, () => {
            const { lcm, ui } = build(preset, view, { nodeLook });
            expect(G.normaliseGroupingSettings().grouping).toBe('none');
            expect(digest(run(lcm, 'none').positions)).toBe(want);
            // …and the default call (no grouping argument: the schema default) is that one.
            expect(digest(lcm.buildDirectionLayout().positions)).toBe(want);
            ui.mapLook.dispose();
        });
    }
});

describe('⛓ 2. the groups are the Region Map\'s', () => {
    it('per preset: the counts and sizes (a node outside the model, the Menu, has none)', () => {
        const want = {
            seedling_playthrough: { merged: [116, 43, 1, [28, 11, 9, 9, 8, 5, 4, 3, 2, 2, 2]], separate: [307, 43, 1, [92, 60, 28, 20, 12, 11, 7, 6, 6, 5, 5]] },
            seedling_atlas: { merged: [5, 3, 1, [2, 1, 1]], separate: [11, 3, 1, [6, 3, 1]] },
            alttp: { separate: [239, 3, 1, [236, 1, 1]] },
            procgen_maze: { separate: [11, 1, 1, [10]] },
        };
        for (const [preset, views] of Object.entries(want)) {
            for (const [view, [nodes, floorGroups, ungrouped, sizes]] of Object.entries(views)) {
                const { lcm, ui } = build(preset, view);
                const { report } = run(lcm, 'none');
                expect([report.nodes, report.floorGroups, report.ungrouped], `${preset} ${view}`).toEqual([nodes, floorGroups, ungrouped]);
                expect(report.floorGroupSizes.slice(0, sizes.length), `${preset} ${view}`).toEqual(sizes);
                // The same reader as the Region Map: model.groupOf, display key → group id.
                const model = ui.mapLook.regionMapModel().model;
                expect(new Set(model.groupOf.values()).size).toBe(model.layout.groups.length);
            }
        }
    });
    it('a merged node by its group key; a sub-region by its level (separate): one floor group per level', () => {
        const { lcm, ui } = build('seedling_playthrough', 'separate');
        const model = ui.mapLook.regionMapModel().model;
        const of = lcm.floorGroupOfNode(model);
        const r = G.floorGroupReader(model);
        let multi = 0;
        for (const [key, cell] of model.cells) {
            const drawn = cell.members.map((m) => ui.cy.getElementById(m)).filter((n) => n.length === 1);
            if (drawn.length > 1) multi += 1;
            for (const n of drawn) expect(of(n), `${key} ${n.id()}`).toBe(r.ofKey(key));
        }
        expect(multi).toBeGreaterThan(50); // levels split into 2+ sub-regions, each sub-region in its level's floor group
    });
    it('alttp and the maze are INERT: no drawn edge joins two floor groups, so every value gives `none`\'s positions', () => {
        for (const preset of ['alttp', 'procgen_maze']) {
            const { lcm } = build(preset, 'separate');
            const none = digest(run(lcm, 'none').positions);
            for (const v of VALUES) {
                const out = run(lcm, v);
                expect(digest(out.positions), `${preset} ${v}`).toBe(none);
                if (v !== 'none') expect(out.report.stats.grouping).toMatchObject({ inert: true, crossEdges: 0 });
            }
        }
    });
});

describe('⛓ 3. soft at strength 0 equals none', () => {
    for (const view of ['merged', 'separate']) {
        it(`seedling_playthrough · ${view}`, () => {
            const { lcm } = build('seedling_playthrough', view);
            const none = digest(run(lcm, 'none').positions);
            expect(digest(run(lcm, 'soft', 0).positions)).toBe(none);
            // …and above 0 it moves the nodes, towards less mixing.
            const soft = run(lcm, 'soft', 0.5);
            expect(digest(soft.positions)).not.toBe(none);
            expect(soft.report.mixing.mixed).toBeLessThan(run(lcm, 'none').report.mixing.mixed / 2);
        });
    }
});

describe('⛓ 4. twoStep / twoStepBoxes: blocks never overlap, no node in another floor group\'s block', () => {
    const cases = [...SUB_REGION_VIEW_SCHEMA.enum.map((v) => ['seedling_playthrough', v, 'graph']),
        ['seedling_playthrough', 'merged', 'map'], ['seedling_atlas', 'merged', 'map'], ['seedling_atlas', 'separate', 'graph']];
    for (const [preset, view, nodeLook] of cases) {
        it(`${preset} · ${view} · ${nodeLook}`, () => {
            const { lcm, ui } = build(preset, view, { nodeLook, open: view === 'collapsible' ? ['level_108'] : [] });
            for (const v of ['twoStep', 'twoStepBoxes']) {
                const { report, positions } = run(lcm, v);
                const inputs = lcm.directionLayoutInputs();
                expect(report.overlaps, v).toBe(0);
                expect(D.overlapCount(inputs.nodes, positions)).toBe(0);
                expect(report.blockOverlaps, v).toBe(0);
                expect(report.intruders, v).toBe(0);
                const check = G.blockCheck(inputs.nodes, positions, G.blockPad(40));
                expect([check.blockOverlaps, check.intruders]).toEqual([0, 0]);
                expect(report.stats.grouping.inert).toBe(false);
            }
            // The boxes value places the nodes exactly as twoStep does.
            expect(digest(run(lcm, 'twoStepBoxes').positions)).toBe(digest(run(lcm, 'twoStep').positions));
            ui.mapLook.dispose();
        });
    }
    it('every view and both looks work with every value: 0 overlaps', () => {
        for (const view of SUB_REGION_VIEW_SCHEMA.enum) {
            const { lcm } = build('seedling_playthrough', view);
            for (const v of VALUES) expect(run(lcm, v).report.overlaps, `${view} ${v}`).toBe(0);
        }
        const { lcm, ui } = build('seedling_playthrough', 'merged', { nodeLook: 'map' });
        for (const v of VALUES) expect(run(lcm, v).report.overlaps, `merged map ${v}`).toBe(0);
        ui.mapLook.dispose();
    });
    it('a node with no floor group (the Menu) is a block of one; twoStep separates far better than none', () => {
        const { lcm } = build('seedling_playthrough', 'merged');
        const none = run(lcm, 'none').report;
        const two = run(lcm, 'twoStep').report;
        expect(two.ungrouped).toBe(1);
        expect(two.stats.grouping.blocks).toBe(two.floorGroups + two.ungrouped);
        expect(two.mixing.mixed).toBe(0);
        expect(none.mixing.mixed).toBeGreaterThan(20);
    });
});

describe('⛓ 5. determinism, per value', () => {
    it('two panel builds give the same digest; the inputs in other insertion orders too', () => {
        const a = build('seedling_playthrough', 'merged');
        const b = build('seedling_playthrough', 'merged');
        const { nodes, edges, prefs, model, sidecars } = a.lcm.directionLayoutInputs();
        // ⛓ region-graph-floors: the two-step values' edges carry their vertical links (`floorsOf`), as the panel's.
        const floors = a.lcm.floorsOf(model, sidecars, nodes, edges);
        expect(floors.vertical.size).toBeGreaterThan(0);
        const flip = (p) => p && { ...p, dx: -p.dx, dy: -p.dy };
        const rotate = (xs, k) => [...xs.slice(k), ...xs.slice(0, k)];
        const settings = D.normaliseDirectionSettings();
        for (const v of VALUES) {
            const withPrefs = edges.map((e) => {
                const vert = (v === 'twoStep' || v === 'twoStepBoxes') ? floors.vertical.get(e.id) : undefined;
                return vert ? { ...e, pref: prefs.get(e.id), vertical: vert } : { ...e, pref: prefs.get(e.id) };
            });
            const da = digest(run(a.lcm, v).positions);
            expect(digest(run(b.lcm, v).positions), v).toBe(da);
            const orders = [
                [[...nodes].reverse(), [...withPrefs].reverse()],
                [rotate(nodes, 37), rotate(withPrefs, 11)],
                [nodes, withPrefs.map((e) => ({
                    ...e, source: e.target, target: e.source, pref: flip(e.pref),
                    ...(e.vertical ? { vertical: { ...e.vertical, pref: flip(e.vertical.pref) } } : {}),
                }))],
            ];
            for (const [ns, es] of orders) {
                // ⛓ region-graph-floor-stacking: the two-step values stack by floor, as the panel passes it.
                const floorBands = (v === 'twoStep' || v === 'twoStepBoxes') ? G.floorBandsOf(floors.numbering) : null;
                const out = G.groupedDirectionLayout(ns, es, { ...settings, grouping: v, groupStrength: 0.5, floorBands });
                expect(digest(out.positions), v).toBe(da);
            }
        }
    });
    it('the modules read no clock and no Math.random', () => {
        for (const f of ['floorGroups.js', 'directionLayout.js']) {
            const src = readFileSync(join(HERE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            expect(src, f).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date/);
        }
    });
});

describe('⛓ 6. the boxes: an overlay every reader skips', () => {
    it('one box per floor group of 2+ drawn nodes, round its members, apart; the element set and saved positions unchanged', () => {
        const doc = fakeDoc();
        const { ui, lcm } = build('seedling_playthrough', 'merged', { doc });
        ui.floorBoxes = new FloorBoxLayer(ui, { doc });
        ui.groupingSettings = { grouping: 'twoStepBoxes', groupStrength: 0.5 };
        const built0 = lcm.buildDirectionLayout();
        ui.cy.layout({ ...built0.options, animate: false, fit: false }).run();
        const before = kit.digestOf(kit.serialiseElements(ui.cy));
        const nodesBefore = ui.cy.nodes().length;
        const built = lcm.buildDirectionLayout();
        ui.cy.layout({ ...built.options, animate: false, fit: false }).run();
        ui.floorBoxes.show(built.boxes);
        const report = ui.floorBoxes.report();
        expect(report.length).toBe(built.report.floorGroupSizes.filter((n) => n >= 2).length);
        expect(report.length).toBe(11);
        // Drawn: one element per box in the layer, inside the graph container (not in cy).
        const layer = ui.graphContainer.children.find((c) => c.classList.contains('rg-floor-boxes'));
        expect(layer.children.filter((c) => c.className === FLOOR_BOX_CLASS).length).toBe(11);
        expect(layer.children.every((c) => c.style.display === 'block')).toBe(true);
        // Each box holds its members' boxes; no two boxes overlap; the label is the FLOOR's (region-graph-floors), and
        // the group id stays as the box's root.
        const model = ui.mapLook.regionMapModel().model;
        const ids = new Set(model.layout.groups.map((g) => g.id));
        for (const b of report) {
            expect(ids.has(b.root)).toBe(true);
            expect(b.label).toMatch(/^Floor (0|[+\u2212]\d+)[A-Z]+$|^Floor (\?|[0+\u2212]\d* to [0+\u2212]\d*) [A-Z]+$/);
            for (const id of b.members) {
                const bb = ui.cy.getElementById(id).boundingBox({ includeLabels: false });
                expect(bb.x1 >= b.box.x1 && bb.x2 <= b.box.x2 && bb.y1 >= b.box.y1 && bb.y2 <= b.box.y2).toBe(true);
            }
        }
        for (let i = 0; i < report.length; i += 1) for (let j = i + 1; j < report.length; j += 1) {
            const a = report[i].box; const c = report[j].box;
            expect(a.x1 < c.x2 && c.x1 < a.x2 && a.y1 < c.y2 && c.y1 < a.y2, `${report[i].label} × ${report[j].label}`).toBe(false);
        }
        // Every reader of the element set: unchanged (no element added, no class, no data), and so the picker's
        // `regionName` nodes, the pathfinder's staticData, counts and hub detection; saved positions hold nodes only.
        expect(ui.cy.nodes().length).toBe(nodesBefore);
        expect(ui.cy.nodes(`.${FLOOR_BOX_CLASS}`).length).toBe(0);
        const after = kit.serialiseElements(ui.cy);
        expect(kit.digestOf(after)).toBe(before);
        lcm.saveNodePositions();
        const store = lcm.positionStore();
        expect([...store.keys()].every((id) => ui.cy.getElementById(id).length === 1)).toBe(true);
        expect(store.size).toBe(nodesBefore);
        expect([...sm.staticData.regions.keys()].some((k) => k.startsWith('rg-floor'))).toBe(false);
        ui.mapLook.dispose();
    });
    it('another layout\'s start clears them; a rebuild clears them; a run of another value draws none', () => {
        const doc = fakeDoc();
        const { ui, lcm, dm } = build('seedling_playthrough', 'merged', { doc });
        ui.floorBoxes = new FloorBoxLayer(ui, { doc });
        ui.groupingSettings = { grouping: 'twoStepBoxes', groupStrength: 0.5 };
        const first = lcm.runDirectionLayout({ animate: false });
        expect(first.boxes).toBe(11);
        expect(ui.floorBoxes.boxes.length).toBe(11);
        ui.cy.layout({ name: 'grid', animate: false }).run();
        expect(ui.floorBoxes.boxes.length).toBe(0);
        lcm.runDirectionLayout({ animate: false });
        expect(ui.floorBoxes.boxes.length).toBe(11);
        dm.buildGraphFromRegions(sm.staticData.regions, null);
        expect(ui.floorBoxes.boxes.length).toBe(0);
        ui.groupingSettings = { grouping: 'twoStep', groupStrength: 0.5 };
        expect(lcm.runDirectionLayout({ animate: false }).boxes).toBe(0);
        expect(ui.floorBoxes.boxes.length).toBe(0);
        ui.mapLook.dispose();
    });
    it('nested + twoStepBoxes: the compound sub-region boxes stay as they were; the floor group boxes are not elements', () => {
        const doc = fakeDoc();
        const { ui, lcm } = build('seedling_playthrough', 'nested', { doc });
        ui.floorBoxes = new FloorBoxLayer(ui, { doc });
        ui.groupingSettings = { grouping: 'twoStepBoxes', groupStrength: 0.5 };
        const compounds = ui.cy.nodes().filter((n) => isRegionGroupNode(n, 'box')).map((n) => n.id()).sort();
        expect(compounds.length).toBe(60);
        const report = lcm.runDirectionLayout({ animate: false });
        expect(report.overlaps).toBe(0);
        expect(report.blockOverlaps).toBe(0);
        expect(report.boxes).toBeGreaterThan(5);
        expect(ui.cy.nodes().filter((n) => isRegionGroupNode(n, 'box')).map((n) => n.id()).sort()).toEqual(compounds);
        // A nested box's members are all in ONE floor group (their level's), so a compound box sits inside one floor group box.
        const of = lcm.floorGroupOfNode(ui.mapLook.regionMapModel().model);
        ui.cy.nodes().filter((n) => isRegionGroupNode(n, 'box')).forEach((box) => {
            expect(new Set(box.children().map((c) => of(c))).size, box.id()).toBe(1);
        });
        ui.mapLook.dispose();
    });
    it('the player marker (locked) is never laid out and is re-seated on its region', () => {
        const { ui, lcm } = build('seedling_atlas', 'merged');
        ui.groupingSettings = { grouping: 'twoStep', groupStrength: 0.5 };
        const region = ui.cy.nodes('.region')[0].id();
        ui.cy.add({ data: { id: 'player' }, classes: 'player', position: { x: -9999, y: -9999 } }).lock();
        const seated = [];
        ui.getCurrentPlayerLocation = () => region;
        ui.updatePlayerLocation = (r) => seated.push(r);
        const report = lcm.runDirectionLayout({ animate: false });
        expect(lcm.directionLayoutInputs().nodes.some((n) => n.id === 'player')).toBe(false);
        expect(report.blockOverlaps).toBe(0);
        expect(seated).toEqual([region]);
        expect(ui.cy.getElementById('player').position()).toEqual({ x: -9999, y: -9999 });
    });
});

describe('⛓ 7. the settings', () => {
    it('schema defaults only; out-of-range and wrong-type values read clamped or as the default', () => {
        expect(G.normaliseGroupingSettings()).toEqual({ grouping: 'none', groupStrength: 0.5 });
        expect(G.normaliseGroupingSettings({ grouping: 'nope', groupStrength: 9 })).toEqual({ grouping: 'none', groupStrength: 1 });
        expect(G.normaliseGroupingSettings({ grouping: 'twoStepBoxes', groupStrength: 'x' })).toEqual({ grouping: 'twoStepBoxes', groupStrength: 0.5 });
        expect(G.FLOOR_GROUPING_SCHEMA.enum).toEqual(['none', 'soft', 'twoStep', 'twoStepBoxes']);
        expect(Object.keys(G.FLOOR_GROUPING_LABELS)).toEqual([...G.FLOOR_GROUPING_SCHEMA.enum]);
        expect(G.FLOOR_GROUPING_KEY).toBe('moduleSettings.regionGraph.floorGrouping');
        expect(G.FLOOR_GROUP_STRENGTH_KEY).toBe('moduleSettings.regionGraph.floorGroupStrength');
        expect([G.FLOOR_GROUP_STRENGTH_SCHEMA.minimum, G.FLOOR_GROUP_STRENGTH_SCHEMA.maximum]).toEqual([0, 1]);
        // A write re-runs the layout if it is drawn (never a rebuild), as the other Direction-aware settings.
        expect(isDirectionSettingKey(G.FLOOR_GROUPING_KEY)).toBe(true);
        expect(isDirectionSettingKey(G.FLOOR_GROUP_STRENGTH_KEY)).toBe(true);
    });
    it('the panel registers both in its settings schema', () => {
        const src = readFileSync(join(HERE, 'index.js'), 'utf8');
        expect(src).toMatch(/floorGrouping: \{ \.\.\.FLOOR_GROUPING_SCHEMA, enum: \[\.\.\.FLOOR_GROUPING_SCHEMA\.enum\] \}/);
        expect(src).toMatch(/floorGroupStrength: \{ \.\.\.FLOOR_GROUP_STRENGTH_SCHEMA \}/);
    });
    it('the panel reads them with no call-site default (the mocked getSetting answers its default: undefined)', async () => {
        const { ui, lcm } = build('alttp', 'separate');
        // ⛓ region-graph-floors: the floor gap rides with them (its schema default).
        expect(await lcm.loadGroupingSettings()).toEqual({ grouping: 'none', groupStrength: 0.5, floorGap: 160 });
        await lcm.loadDirectionSettings();
        expect(ui.groupingSettings).toEqual({ grouping: 'none', groupStrength: 0.5, floorGap: 160 });
    });
    // ⛓ region-graph-floor-rename-letters (⚖ 2026-11-28T03:38:16.825Z "There is no need to worry about backwards
    // compatibility for the saves"): the renamed keys round-trip; the OLD keys are not read (no migration).
    it('the renamed keys round-trip (floorGrouping, floorGroupStrength); the old dungeon* keys are ignored', async () => {
        const settingsManager = (await import('../../app/core/settingsManager.js')).default;
        const { ui, lcm } = build('alttp', 'separate');
        try {
            await settingsManager.updateSetting('moduleSettings.regionGraph.dungeonGrouping', 'twoStepBoxes');
            await settingsManager.updateSetting('moduleSettings.regionGraph.dungeonGroupStrength', 0.9);
            expect(await lcm.loadGroupingSettings()).toEqual({ grouping: 'none', groupStrength: 0.5, floorGap: 160 });
            await settingsManager.updateSetting(G.FLOOR_GROUPING_KEY, 'twoStep');
            await settingsManager.updateSetting(G.FLOOR_GROUP_STRENGTH_KEY, 0.25);
            expect(await lcm.loadGroupingSettings()).toEqual({ grouping: 'twoStep', groupStrength: 0.25, floorGap: 160 });
            expect(ui.groupingSettings.grouping).toBe('twoStep');
            for (const v of G.FLOOR_GROUPING_SCHEMA.enum) {
                await settingsManager.updateSetting(G.FLOOR_GROUPING_KEY, v);
                expect((await lcm.loadGroupingSettings()).grouping).toBe(v);
            }
        } finally {
            store.clear();
        }
    });
});
