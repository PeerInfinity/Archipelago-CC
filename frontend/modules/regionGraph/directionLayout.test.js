/**
 * ⛓ THE DIRECTION-AWARE LAYOUT (region-graph-direction-layout; `directionLayout.js`, glue in `layoutControlsManager.js`).
 * Over synthetic worlds and the FROZEN fixture presets (`regionGraphElements.testkit.js` `loadFrozenRules`, never a
 * live preset digest), through the panel's own builder on a headless Cytoscape and the real substrate registry:
 *   · the offset rule: the door's side, and its place along the side (two doors on one side point to two spots);
 *     a door at the centre or with no extent has no preference;
 *   · the edge preference: S→T exits add, T→S exits add NEGATED; a merged node takes its members' exits;
 *   · determinism: two panel builds give the same positions digest, and so do the inputs in other insertion orders;
 *   · strength 0: the exit directions change nothing (the same positions as with every preference removed);
 *   · no overlaps at the drawn size: the ellipse box in every view, the map look's rectangle in merged + map;
 *   · the two-on-one-side levels (13 on the frozen seedling_playthrough): every neighbour within 45° (its side's
 *     wedge) of its preferred direction at the default strength, both of them, with no overlap;
 *   · the settings: schema defaults only, registered by the panel, out-of-range values clamped;
 *   · collapsible: opening or closing a group KEEPS the positions (no layout runs).
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
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async (_k, d) => d, updateSetting: async () => {} } }));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));

// ⛓ The shipped Seedling atlases → the FROZEN ones the frozen rules were cut against (regionGraphElements.testkit.js
// `FROZEN_ATLASES`): a live restamp (L25) would otherwise leave every frozen `atlas_ref` resolving to nothing.
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { LayoutControlsManager } = await import('./layoutControlsManager.js');
const { MapLookLayer } = await import('./mapLookLayer.js');
const { isRegionGroupNode, groupNodeId, SUB_REGION_VIEW_SCHEMA } = await import('./subRegionGroups.js');
const D = await import('./directionLayout.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();
const digest = (positions) => createHash('sha256').update(D.positionsKey(positions)).digest('hex').slice(0, 16);

/** The panel's base node box (regionGraphUI.js's `node` style: 60 × 45, border 2), so `outerWidth` is the drawn one. */
const NODE_STYLE = [{ selector: 'node', style: { width: 60, height: 45, 'border-width': 2, shape: 'ellipse' } }];

/** Build the panel's graph for frozen `preset` in `view` (with `nodeLook`); → { ui, lcm, dm }. */
function build(preset, view, { nodeLook = 'graph', open = [] } = {}) {
    const rules = kit.loadFrozenRules(preset);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === 'mid').snapshot;
    let layouts = 0;
    const ui = kit.makeUi(cytoscape, {
        cy: cytoscape({ headless: true, styleEnabled: true, style: NODE_STYLE }),
        subRegionView: view, nodeLook, runLayout() { layouts += 1; },
    });
    ui.graphContainer = null; // the map look's bypasses only (no canvas)
    ui.mapLook = new MapLookLayer(ui);
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    if (view === 'collapsible') { const set = dm.openGroupKeys(); set.clear(); for (const k of open) set.add(k); }
    dm.buildGraphFromRegions(regions, null);
    const lcm = new LayoutControlsManager(ui);
    ui.layoutControlsManager = lcm;
    return { ui, lcm, dm, layouts: () => layouts };
}

/** Lay out the graph as drawn at `settings` → { positions, inputs, report }. */
function layout(ui, lcm, settings = D.normaliseDirectionSettings()) {
    const inputs = lcm.directionLayoutInputs(settings);
    const { positions, report } = lcm.buildDirectionLayout(settings);
    return { positions, inputs, report };
}

describe('⛓ 1. the offset rule (door tile ÷ level extent)', () => {
    const ext = { w: 20, h: 10 };
    it('a door on the middle of a side points straight out of it, weight 1', () => {
        const e = D.doorOffset([19, 4], ext); // x = 19 (the east edge), y = 4: just above the middle
        expect(e.side).toBe('E');
        expect(e.border).toBe(true);
        expect(e.weight).toBe(1);
        expect(e.dx).toBeGreaterThan(0.99);
        const w = D.doorOffset([0, 4.5], { w: 20, h: 10 }); // the exact middle row of the west edge
        expect(w.side).toBe('W');
        expect([w.dx, w.dy]).toEqual([-1, 0]);
        expect(D.doorOffset([9.5, 0], ext).side).toBe('N');
        expect(D.doorOffset([9.5, 9], ext).side).toBe('S');
    });
    it('the place along the side tilts it: two doors on one side point to two different spots', () => {
        const top = D.doorOffset([19, 0], ext);
        const bottom = D.doorOffset([19, 9], ext);
        expect(top.side).toBe('E');
        expect(bottom.side).toBe('E');
        expect(top.dy).toBeLessThan(0); // up-right
        expect(bottom.dy).toBeGreaterThan(0); // down-right
        // The tilt is DOOR_TILT × the place along the side (±1 at the corners): atan(0.5 × 0.9) ≈ 24°, never past 45°.
        const deg = (o) => (Math.atan2(o.dy, o.dx) * 180) / Math.PI;
        expect(deg(top)).toBeCloseTo(-(Math.atan(D.DOOR_TILT * 0.9) * 180) / Math.PI, 6);
        expect(deg(bottom)).toBeCloseTo((Math.atan(D.DOOR_TILT * 0.9) * 180) / Math.PI, 6);
        expect(top.along).toBeCloseTo(-0.9, 6);
    });
    it('an interior door has a weaker preference; the centre, no tile or no extent has none', () => {
        const mid = D.doorOffset([14.5, 4.5], ext); // half way between the centre and the east edge
        expect(mid.border).toBe(false);
        expect(mid.weight).toBeCloseTo(0.5, 6);
        expect(D.doorOffset([9.5, 4.5], ext)).toBeNull();
        expect(D.doorOffset(null, ext)).toBeNull();
        expect(D.doorOffset([3, 3], null)).toBeNull();
        expect(D.doorOffset([3, 3], { w: 0, h: 5 })).toBeNull();
    });
});

describe('⛓ 2. the preference per drawn edge', () => {
    // A synthetic world: A (20×10) has two east doors, to B (top) and C (bottom); B's door back is on its west side.
    const sidecars = {
        A: { playable_payload: { exits: [
            { exitName: 'A->B', targetRegion: 'B', exit_tiles: [[19, 0]] },
            { exitName: 'A->C', targetRegion: 'C', x: 19, y: 9 },
            { exitName: 'A->D', targetRegion: 'D', x: 10, y: 5 }, // an interior door
        ] } },
        B: { playable_payload: { exits: [{ exitName: 'B->A', targetRegion: 'A', x: 0, y: 5 }] } },
        C: { playable_payload: { exits: [] } },
        D: { playable_payload: { exits: [] } },
    };
    const cell = (k) => ({ members: [k], extent: { w: 20, h: 10 } });
    const model = { cells: new Map(['A', 'B', 'C', 'D'].map((k) => [k, cell(k)])) };
    const tileOf = (e) => (Number.isFinite(e.x) ? [e.x, e.y] : e.exit_tiles?.[0] ?? null);

    it('counts exits with and without a direction, per filter, and the two-on-one-side regions', () => {
        const all = D.exitDirections({ sidecars, model, tileOf, exits: 'all' });
        expect(all.counts).toMatchObject({ exits: 4, withDirection: 4, without: 0, border: 3 });
        const border = D.exitDirections({ sidecars, model, tileOf, exits: 'border' });
        expect(border.counts).toMatchObject({ exits: 4, withDirection: 3, without: 1, border: 3 });
        expect(border.counts.twoOnOneSide).toEqual([{ region: 'A', side: 'E', targets: ['B', 'C'] }]);
        expect(border.counts.twoOnOneSideLevels).toEqual([{ level: 'A', side: 'E', targets: ['B', 'C'] }]);
        expect(D.DIRECTION_EXITS_SCHEMA.default).toBe('border');
    });
    it('S→T adds, T→S adds negated; a merged node takes its members\' exits', () => {
        const { directions } = D.exitDirections({ sidecars, model, tileOf, exits: 'border' });
        const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
        const prefs = D.edgePreferences(nodes, [
            { id: 'A-B', source: 'A', target: 'B' }, { id: 'C-A', source: 'C', target: 'A' }, { id: 'A-D', source: 'A', target: 'D' },
        ], directions);
        const ab = prefs.get('A-B');
        expect(ab.exits).toBe(2); // A's east door and B's west door, both saying "B is east of A"
        expect(ab.dx).toBeGreaterThan(0.9);
        expect(ab.dy).toBeLessThan(0);
        const ca = prefs.get('C-A'); // drawn C → A: A lies WEST of C, a little up
        expect(ca.dx).toBeLessThan(-0.85);
        expect(ca.dy).toBeLessThan(0);
        expect(prefs.has('A-D')).toBe(false); // the interior door is not a border door
        // Merge B and C into one node G: A–G takes both exits (and B's), pointing east.
        const merged = D.edgePreferences([{ id: 'A' }, { id: 'G', members: ['B', 'C'] }, { id: 'D' }],
            [{ id: 'A-G', source: 'A', target: 'G' }], directions);
        expect(merged.get('A-G').exits).toBe(3);
        expect(merged.get('A-G').dx).toBeGreaterThan(0.95);
    });
});

describe('⛓ 3. determinism', () => {
    it('two panel builds give the same positions digest; the inputs in other insertion orders too', () => {
        const a = build('seedling_playthrough', 'merged');
        const b = build('seedling_playthrough', 'merged');
        const pa = layout(a.ui, a.lcm);
        const pb = layout(b.ui, b.lcm);
        expect(digest(pb.positions)).toBe(digest(pa.positions));
        const { nodes, edges, prefs } = pa.inputs;
        const withPrefs = edges.map((e) => ({ ...e, pref: prefs.get(e.id) }));
        const rotate = (xs, k) => [...xs.slice(k), ...xs.slice(0, k)];
        const orders = [
            [[...nodes].reverse(), [...withPrefs].reverse()],
            [rotate(nodes, 37), rotate(withPrefs, 11)],
            // edges with their ends swapped (the preference flips with them)
            [nodes, withPrefs.map((e) => ({ ...e, source: e.target, target: e.source, pref: e.pref && { ...e.pref, dx: -e.pref.dx, dy: -e.pref.dy } }))],
        ];
        const settings = D.normaliseDirectionSettings();
        for (const [ns, es] of orders) expect(digest(D.directionLayout(ns, es, settings).positions)).toBe(digest(pa.positions));
    });
    it('the module reads no clock and no Math.random', () => {
        const src = readFileSync(join(HERE, 'directionLayout.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date/);
    });
});

describe('⛓ 4. strength 0 ignores the exit directions', () => {
    it('the same positions as with every preference removed (a plain spring layout, not fcose)', () => {
        const { ui, lcm } = build('seedling_playthrough', 'merged');
        const { nodes, edges, prefs } = lcm.directionLayoutInputs();
        expect(prefs.size).toBeGreaterThan(50);
        const at0 = D.directionLayout(nodes, edges.map((e) => ({ ...e, pref: prefs.get(e.id) })), { strength: 0, spacing: 40 });
        const none = D.directionLayout(nodes, edges, { strength: 0, spacing: 40 });
        expect(D.positionsKey(at0.positions)).toBe(D.positionsKey(none.positions));
        expect(at0.stats.preferred).toBe(0);
        // …and the direction term is what moves it: strength 0.7 is closer to the directions.
        const at7 = D.directionLayout(nodes, edges.map((e) => ({ ...e, pref: prefs.get(e.id) })), { strength: 0.7, spacing: 40 });
        expect(D.angleErrors(edges, prefs, at7.positions).mean).toBeLessThan(D.angleErrors(edges, prefs, at0.positions).mean / 2);
        expect(ui.subRegionView).toBe('merged');
    });
});

describe('⛓ 5. no overlaps at the drawn size', () => {
    for (const preset of ['seedling_playthrough', 'alttp', 'procgen_maze', 'seedling_atlas']) {
        for (const view of SUB_REGION_VIEW_SCHEMA.enum) {
            it(`${preset} · ${view} · ellipse box`, () => {
                const { ui, lcm } = build(preset, view, view === 'collapsible' && preset === 'seedling_playthrough' ? { open: ['level_108'] } : {});
                const { positions, inputs, report } = layout(ui, lcm);
                expect(inputs.nodes.every((n) => n.w === 62 && n.h === 47)).toBe(true); // 60 × 45 + the 2 px border (Cytoscape `outerWidth`)
                expect(report.overlaps).toBe(0);
                expect(D.overlapCount(inputs.nodes, positions)).toBe(0);
                expect(inputs.nodes.length).toBe(ui.cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node') && !isRegionGroupNode(n, 'box')).length);
            });
        }
    }
    it('seedling_playthrough · merged + map look · the map rectangles (mapNodeSize)', () => {
        const { ui, lcm } = build('seedling_playthrough', 'merged', { nodeLook: 'map' });
        expect(ui.mapLook.sync()).toBe(true);
        const { positions, inputs, report } = layout(ui, lcm);
        const rects = inputs.nodes.filter((n) => n.w !== 62 || n.h !== 47);
        expect(rects.length).toBeGreaterThan(100); // the map look's rectangles, at each level's aspect
        expect(Math.max(...rects.map((n) => Math.max(n.w, n.h)))).toBe(72 + 2);
        expect(report.overlaps).toBe(0);
        expect(D.overlapCount(inputs.nodes, positions)).toBe(0);
        ui.mapLook.dispose();
    });
});

describe('⛓ 6. two exits on one side (frozen seedling_playthrough, merged, default settings)', () => {
    it('both neighbours land within 45° of their own preferred direction, with no overlap', () => {
        const { ui, lcm } = build('seedling_playthrough', 'merged');
        const { positions, inputs, report } = layout(ui, lcm);
        expect(report.counts.twoOnOneSideLevels).toBe(13);
        expect(report.counts.twoOnOneSide).toBe(4); // per rules region (sub-region), as `separate` draws them
        const got = ui.mapLook.regionMapModel();
        const { counts } = D.exitDirections({ sidecars: got.rules.preset_sidecars['1'], model: got.model,
            tileOf: (e) => (Number.isFinite(e.x) ? [e.x, e.y] : e.exit_tiles?.[0] ?? null) });
        expect(counts.twoOnOneSideLevels.length).toBe(13);
        const idOf = (key) => (got.model.cells.get(key).members.length > 1 ? groupNodeId(key) : got.model.cells.get(key).members[0]);
        let worst = 0;
        let pairs = 0;
        for (const c of counts.twoOnOneSideLevels) {
            const spots = [];
            for (const t of c.targets) {
                const A = idOf(c.level);
                const B = idOf(t);
                const e = inputs.edges.find((x) => (x.source === A && x.target === B) || (x.source === B && x.target === A));
                const p = inputs.prefs.get(e.id);
                const sign = e.source === A ? 1 : -1;
                const pa = positions.get(A);
                const pb = positions.get(B);
                const r = Math.hypot(pb.x - pa.x, pb.y - pa.y);
                const err = (Math.acos(((pb.x - pa.x) * p.dx * sign + (pb.y - pa.y) * p.dy * sign) / r) * 180) / Math.PI;
                expect(err, `${c.level} ${c.side} → ${t}`).toBeLessThan(45);
                worst = Math.max(worst, err);
                spots.push(pb);
                pairs += 1;
            }
            expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(spots.length); // two spots, not one
        }
        expect(pairs).toBe(26);
        expect(report.overlaps).toBe(0);
        // eslint-disable-next-line no-console
        console.log(`[direction-two-on-one-side] 13 levels, 26 neighbours, worst ${worst.toFixed(1)}°`);
    });
});

describe('⛓ 7. the settings', () => {
    it('schema defaults only; out-of-range and wrong-type values read clamped or as the default', () => {
        expect(D.normaliseDirectionSettings()).toEqual({ strength: 0.7, spacing: 40, exits: 'border' });
        expect(D.normaliseDirectionSettings({ strength: 7, spacing: -3, exits: 'nope' })).toEqual({ strength: 1, spacing: 0, exits: 'border' });
        expect(D.normaliseDirectionSettings({ strength: 'x', spacing: null, exits: 'all' })).toEqual({ strength: 0.7, spacing: 40, exits: 'all' });
        expect(D.DIRECTION_STRENGTH_KEY).toBe('moduleSettings.regionGraph.directionStrength');
        expect(D.DIRECTION_SPACING_KEY).toBe('moduleSettings.regionGraph.directionSpacing');
        expect(D.DIRECTION_EXITS_KEY).toBe('moduleSettings.regionGraph.directionExits');
    });
    it('the panel registers all three in its settings schema', () => {
        const src = readFileSync(join(HERE, 'index.js'), 'utf8');
        expect(src).toMatch(/directionStrength: \{ \.\.\.DIRECTION_STRENGTH_SCHEMA \}/);
        expect(src).toMatch(/directionSpacing: \{ \.\.\.DIRECTION_SPACING_SCHEMA \}/);
        expect(src).toMatch(/directionExits: \{ \.\.\.DIRECTION_EXITS_SCHEMA, enum: \[\.\.\.DIRECTION_EXITS_SCHEMA\.enum\] \}/);
    });
    it('the panel reads them with no call-site default (the mocked getSetting answers its default: undefined)', async () => {
        const { ui, lcm } = build('alttp', 'separate');
        expect(await lcm.loadDirectionSettings()).toEqual({ strength: 0.7, spacing: 40, exits: 'border' });
        expect(ui.directionSettings).toEqual({ strength: 0.7, spacing: 40, exits: 'border' });
    });
});

describe('⛓ 8. the panel: positions are written as every layout writes them', () => {
    it('a preset layout over the computed positions; the store is written only by saveNodePositions (layoutstop)', () => {
        const { ui, lcm } = build('seedling_atlas', 'merged');
        const store = lcm.positionStore();
        store.clear();
        const { options, positions } = lcm.buildDirectionLayout();
        expect(options.name).toBe('preset');
        expect(store.size).toBe(0);
        ui.cy.layout({ ...options, animate: false, fit: false }).run();
        for (const [id, p] of positions) expect(ui.cy.getElementById(id).position()).toEqual(p);
        lcm.saveNodePositions();
        for (const [id, p] of positions) expect(store.get(id)).toEqual(p);
        expect(ui.lastDirectionLayout.overlaps).toBe(0);
    });
    it('the player marker (a locked node no layout moves) is re-seated on its region when the layout stops', () => {
        const { ui, lcm } = build('seedling_atlas', 'merged');
        const region = ui.cy.nodes('.region')[0].id();
        ui.cy.add({ data: { id: 'player' }, classes: 'player', position: { x: -9999, y: -9999 } }).lock();
        const seated = [];
        ui.getCurrentPlayerLocation = () => region;
        ui.updatePlayerLocation = (r) => seated.push(r);
        const report = lcm.runDirectionLayout({ animate: false });
        expect(report.overlaps).toBe(0);
        expect(seated).toEqual([region]);
        expect(ui.cy.getElementById('player').position()).toEqual({ x: -9999, y: -9999 }); // the layout itself never moved it
    });
    it('collapsible: opening or closing a group KEEPS the positions (no layout runs); a re-run gives the same digest', () => {
        const { ui, lcm, dm, layouts } = build('seedling_playthrough', 'collapsible');
        const first = lcm.buildDirectionLayout();
        ui.cy.layout({ ...first.options, animate: false, fit: false }).run();
        lcm.saveNodePositions();
        const node = ui.cy.nodes().filter((n) => isRegionGroupNode(n, 'merged'))[0];
        const key = node.data('groupKey');
        const others = ui.cy.nodes().filter((n) => n.id() !== node.id() && !n.hasClass('location-node'))
            .map((n) => [n.id(), { ...n.position() }]);
        const before = layouts();
        dm.setSubRegionGroupOpen(key, true);
        dm.setSubRegionGroupOpen(key, false);
        expect(layouts()).toBe(before);
        for (const [id, p] of others) expect(ui.cy.getElementById(id).position()).toEqual(p);
        const again = lcm.buildDirectionLayout();
        expect(digest(again.positions)).toBe(digest(first.positions));
    });
});
