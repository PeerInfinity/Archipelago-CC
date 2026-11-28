/**
 * ⛓ FLOORS (region-graph-floors; `floors.js`, the floor links in `dungeonGroups.js`'s two-step block step, glue and
 * measures in `layoutControlsManager.js`, labels in `dungeonBoxLayer.js`). Over the FROZEN fixtures (rules AND the
 * Seedling atlases they were cut against, as `directionLayout.test.js` / `dungeonGroups.test.js`) and small synthetic
 * models:
 *   · 1. the vertical-direction rule: an interior stair east of centre points east; one at the centre gives none;
 *   · 2. the floor numbering: up, down, a pit, a conflict and an unreached group; the labels; the frozen presets' counts;
 *   · 3. the floor gap: a bigger gap → a longer floor link, its direction kept;
 *   · 4. `none` / `soft` keep their base digests; `twoStep` with the floor links off IS dungeon-groups' twoStep;
 *        worlds with no vertical link (alttp, the maze, seedling_atlas) are unchanged;
 *   · 5. determinism; 6. the setting: schema default only, registered, a write re-runs.
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
// ⛓ The shipped Seedling atlases → the FROZEN ones the frozen rules were cut against (as directionLayout.test.js).
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { LayoutControlsManager, isDirectionSettingKey } = await import('./layoutControlsManager.js');
const { MapLookLayer } = await import('./mapLookLayer.js');
const { isRegionGroupNode, SUB_REGION_VIEW_SCHEMA } = await import('./subRegionGroups.js');
const { DungeonBoxLayer, DUNGEON_BOX_CLASS } = await import('./dungeonBoxLayer.js');
const D = await import('./directionLayout.js');
const G = await import('./dungeonGroups.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();
const digest = (positions) => createHash('sha256').update(D.positionsKey(positions)).digest('hex').slice(0, 16);
const NODE_STYLE = [{ selector: 'node', style: { width: 60, height: 45, 'border-width': 2, shape: 'ellipse' } }];
const VALUES = G.DUNGEON_GROUPING_SCHEMA.enum;

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


const F = await import('./floors.js');
const S = () => D.normaliseDirectionSettings();
const layout = (lcm, grouping, extra = {}, opts = {}) => lcm.buildDirectionLayout(S(), { grouping, groupStrength: 0.5, ...extra }, opts);

/** A small synthetic Region Map model: display key = group-member level; `links` `[from, to, kind]`. */
function model({ start, groups, links, extents = {} }) {
    const groupOf = new Map();
    for (const [id, members] of Object.entries(groups)) for (const m of members) groupOf.set(m, id);
    const cells = new Map([...groupOf.keys()].map((k) => [k, { key: k, members: [k], extent: extents[k] ?? { w: 20, h: 10 } }]));
    return {
        groupOf, cells,
        layout: { start, groups: Object.entries(groups).map(([id, members]) => ({ id, root: id, members })), graph: { links: links.map(([from, to, kind]) => ({ from, to, kind })) } },
    };
}

describe('⛓ 1. the direction of a vertical link (option (a): where the stair sits in its level)', () => {
    it('an INTERIOR stair east of centre points east; north-west points north-west; the vector rule, not the side rule', () => {
        const east = F.stairOffset([15, 5], { w: 20, h: 11 }); // v = 0: due east
        expect([east.dx, east.dy]).toEqual([1, 0]);
        expect(east.weight).toBeCloseTo(2 * (15.5 / 20 - 0.5), 9);
        const nw = F.stairOffset([3, 1], { w: 20, h: 10 });
        expect(nw.dx).toBeLessThan(0);
        expect(nw.dy).toBeLessThan(0);
        // The door rule (`doorOffset`) would snap it to a side's normal ± a tilt; the vector rule keeps the angle.
        const [u, v] = [3.5 / 20 - 0.5, 1.5 / 10 - 0.5];
        expect(Math.atan2(nw.dy, nw.dx)).toBeCloseTo(Math.atan2(v, u), 9);
    });
    it('at (or within the tolerance of) the centre: no direction, length only; no tile or extent: null', () => {
        expect(F.STAIR_CENTRE_TOLERANCE).toBe(0.05);
        expect(F.stairOffset([10, 5], { w: 21, h: 11 })).toMatchObject({ centre: true });
        expect(F.stairOffset([10, 6], { w: 20, h: 12 })).toMatchObject({ centre: true }); // u = 0.025, v ≈ 0.042
        expect(F.stairOffset([11, 6], { w: 20, h: 12 }).centre).toBeUndefined(); // u = 0.075: a direction
        expect(F.stairOffset(null, { w: 20, h: 10 })).toBeNull();
        expect(F.stairOffset([1, 1], null)).toBeNull();
    });
    it('verticalExits reads the kind off the model\'s layout graph: cross-group only, a T→S exit negated on its edge', () => {
        const m = model({ start: 'A', groups: { A: ['A'], B: ['B'], C: ['C'] }, links: [['A', 'B', 'down'], ['B', 'A', 'up'], ['A', 'C', 'warp']] });
        const sidecars = {
            A: { playable_payload: { exits: [{ exit_id: 's1', targetRegion: 'B', x: 17, y: 5 }, { exit_id: 'w', targetRegion: 'C', x: 0, y: 5 }] } },
            B: { playable_payload: { exits: [{ exit_id: 's2', targetRegion: 'A', x: 2, y: 5 }] } },
            C: { playable_payload: { exits: [] } },
        };
        const tileOf = (e) => [e.x, e.y];
        const { exits, counts } = F.verticalExits({ sidecars, model: m, tileOf });
        expect(counts).toEqual({ vertical: 2, withDirection: 2, centre: 0, without: 0, inGroup: 0 });
        expect(exits.map((e) => [e.from, e.to, e.kind])).toEqual([['A', 'B', 'down'], ['B', 'A', 'up']]);
        // A's stairs east (→ B east of A); B's stairs back west (→ A west of B): both say B lies EAST of A.
        const v = F.verticalEdges([{ id: 'A' }, { id: 'B' }, { id: 'C' }], [{ id: 'e1', source: 'A', target: 'B' }, { id: 'e2', source: 'A', target: 'C' }], exits);
        expect([...v.keys()]).toEqual(['e1']);
        expect(v.get('e1').pref.dx).toBeGreaterThan(0.99);
        expect(v.get('e1').exits).toBe(2);
    });
    it('the frozen presets: vertical links with a direction, without one, at the centre (the stairs inside a group stay flat)', () => {
        const want = {
            seedling_playthrough: { vertical: 87, withDirection: 82, centre: 5, without: 0, inGroup: 3 },
            seedling_atlas: { vertical: 0, withDirection: 0, centre: 0, without: 0, inGroup: 0 },
            alttp: { vertical: 0, withDirection: 0, centre: 0, without: 0, inGroup: 0 },
            procgen_maze: { vertical: 0, withDirection: 0, centre: 0, without: 0, inGroup: 0 },
        };
        for (const [preset, counts] of Object.entries(want)) {
            const { lcm, ui } = build(preset, preset === 'alttp' || preset === 'procgen_maze' ? 'separate' : 'merged');
            const { report } = layout(lcm, 'twoStep');
            expect(report.floors.counts, preset).toEqual(counts);
            ui.mapLook.dispose();
        }
    });
});

describe('⛓ 2. floor numbers and labels', () => {
    // G0 (start) —down→ G1 —pit (down)→ G2;  G0 —up→ U;  X —up→ G0 (so X = −1) and G1 —up→ X (X = 0: a CONFLICT);
    // W only by a warp (unreached).
    const m = model({
        start: 'g0',
        groups: { G0: ['g0'], G1: ['g1'], G2: ['g2'], U: ['u'], X: ['x'], W: ['w'] },
        links: [['g0', 'g1', 'down'], ['g1', 'g2', 'down'], ['g0', 'u', 'up'], ['g1', 'x', 'up'], ['x', 'g0', 'up'], ['g0', 'w', 'warp']],
    });
    it('BFS from the start\'s group: down −1, up +1, first assignment wins; a conflict reported with both paths', () => {
        const n = F.floorNumbers(m);
        expect(n.start).toBe('G0');
        expect(Object.fromEntries(n.floorOf)).toEqual({ G0: 0, G1: -1, G2: -2, U: 1, X: -1 });
        expect(n.unreached).toEqual(['W']);
        expect(n.conflicts.length).toBe(1);
        const c = n.conflicts[0];
        expect([c.group, c.floor, c.other]).toEqual(['X', -1, 0]);
        expect(c.path.map((p) => p.group)).toEqual(['G0', 'X']);
        expect(c.otherPath.map((p) => p.group)).toEqual(['G0', 'G1', 'X']);
        expect(c.via).toEqual({ from: 'g1', to: 'x', kind: 'up' });
        expect(n.conflictGroups).toBe(1);
    });
    it('the labels: Ground floor, Floor +n, Floor −n, " · k" on a shared floor (BFS order), Floor ? for the unreached', () => {
        expect([0, 1, -1, -12, null].map(F.floorName)).toEqual(['Ground floor', 'Floor +1', 'Floor −1', 'Floor −12', 'Floor ?']);
        const labels = F.floorLabels(F.floorNumbers(m));
        expect(Object.fromEntries(labels)).toEqual({
            G0: 'Ground floor', G1: 'Floor −1 · 1', X: 'Floor −1 · 2', G2: 'Floor −2', U: 'Floor +1', W: 'Floor ?',
        });
    });
    it('seedling_playthrough: 23 groups numbered (−5 … +1), 20 unreached, 4 conflicting links on 2 groups; the box labels', () => {
        const doc = fakeDoc();
        const { ui, lcm } = build('seedling_playthrough', 'merged', { doc });
        const { report, boxes } = layout(lcm, 'twoStepBoxes');
        expect(report.floors).toMatchObject({ numbered: 23, unreached: 20, conflicts: 4, conflictGroups: 2, floorRange: [-5, 1] });
        const n = F.floorNumbers(ui.mapLook.regionMapModel().model);
        expect(n.conflicts.map((c) => c.group)).toEqual(['level_5', 'level_5', 'level_7', 'level_7']);
        const byRoot = Object.fromEntries(boxes.map((b) => [b.root, b.label]));
        expect(byRoot.level_0).toBe('Ground floor · 1');
        expect(byRoot.level_2).toBe('Floor −1 · 2');
        expect(byRoot.level_48).toBe('Floor ?');
        expect(boxes.length).toBe(11);
        // The DOM box keeps the root id.
        ui.dungeonBoxes = new DungeonBoxLayer(ui, { doc });
        ui.dungeonBoxes.show(boxes);
        const el = ui.dungeonBoxes.boxes.find((b) => b.root === 'level_0').el;
        expect([el.dataset.root, el.title]).toEqual(['level_0', 'Ground floor · 1 (level_0)']);
        expect(ui.dungeonBoxes.report().find((b) => b.root === 'level_0').label).toBe('Ground floor · 1');
        ui.mapLook.dispose();
    });
});

describe('⛓ 3. the floor gap', () => {
    it('synthetic: two floors joined by an east stair — a bigger gap puts the lower floor further away, still east', () => {
        const nodes = [{ id: 'a1', w: 40, h: 30, dungeon: 'A' }, { id: 'a2', w: 40, h: 30, dungeon: 'A' }, { id: 'b1', w: 40, h: 30, dungeon: 'B' }];
        const edges = [
            { id: 'f', source: 'a1', target: 'a2', pref: { dx: 0, dy: 1, weight: 1 } },
            { id: 'v', source: 'a2', target: 'b1', vertical: { pref: { dx: 1, dy: 0, weight: 1 }, exits: 1 } },
        ];
        const at = (floorGap) => G.groupedDirectionLayout(nodes, edges, { ...S(), grouping: 'twoStep', floorGap }).positions;
        let last = -Infinity;
        for (const gap of [0, 80, 160, 320, 600]) {
            const p = at(gap);
            const dx = p.get('b1').x - p.get('a2').x; const dy = p.get('b1').y - p.get('a2').y;
            const d = Math.hypot(dx, dy);
            expect(d, `gap ${gap}`).toBeGreaterThan(last);
            expect(Math.acos(dx / d) * 180 / Math.PI, `gap ${gap} angle`).toBeLessThan(30);
            // The flat link inside A is the same at every gap (A is laid out alone).
            expect(p.get('a2').y - p.get('a1').y).toBeCloseTo(at(0).get('a2').y - at(0).get('a1').y, 6);
            last = d;
        }
    });
    it('seedling_playthrough merged: the vertical links lengthen with the gap and keep their direction; the flat links inside a floor do not move', () => {
        const { lcm, ui } = build('seedling_playthrough', 'merged', { nodeLook: 'map' });
        const before = layout(lcm, 'twoStep', {}, { floorLinks: false }).report.floors;
        const r = [0, 160, 320].map((floorGap) => layout(lcm, 'twoStep', { floorGap }).report);
        expect(r[0].floors.meanVerticalLength).toBeLessThan(r[1].floors.meanVerticalLength);
        expect(r[1].floors.meanVerticalLength).toBeLessThan(r[2].floors.meanVerticalLength);
        for (const x of r) {
            expect(x.floors.verticalError.mean).toBeLessThan(before.verticalError.mean / 2);
            // The same relative positions inside each floor (to the 0.01 px the block offset's rounding leaves).
            expect(x.floors.flatInsideError.n).toBe(before.flatInsideError.n);
            expect(x.floors.flatInsideError.mean).toBeCloseTo(before.flatInsideError.mean, 2);
            expect([x.overlaps, x.blockOverlaps, x.intruders]).toEqual([0, 0, 0]);
        }
        // At the default gap, a floor link is about twice a flat one.
        expect(r[1].floors.meanVerticalLength / r[1].floors.meanFlatLength).toBeGreaterThan(1.6);
        ui.mapLook.dispose();
    });
});

describe('⛓ 4. what does not change', () => {
    // Measured with the BASE files (001abda603's directionLayout / dungeonGroups / layoutControlsManager) swapped in.
    const BASE = [
        ['seedling_playthrough', 'merged', 'map', '48510dda5cfe0ac1', '8bcb73cc31da688e', 'e6a0b61ec5dd74a0'],
        ['seedling_playthrough', 'separate', 'graph', 'a910c31693a7a238', 'c3501f925c63c8c3', 'f10c595e676026be'],
        ['seedling_playthrough', 'nested', 'graph', '48206cd66f15c8d4', 'c4697b0efde12c1b', 'e7377cd44dcad995'],
        ['seedling_playthrough', 'collapsible', 'graph', '2d2365b85af7d12d', '068d2a98e1e1e4f7', '2067aec5bc31e858'],
        ['seedling_atlas', 'merged', 'map', '351569e6ae955cb7', '842a9d1bb3132b44', '8761ce1d6ebe287a'],
    ];
    for (const [preset, view, nodeLook, soft5, soft1, twoStep] of BASE) {
        it(`${preset} · ${view} · ${nodeLook}: soft (0.5, 1) = base; twoStep with the floor links off = base`, () => {
            const { lcm, ui } = build(preset, view, { nodeLook });
            expect(digest(lcm.buildDirectionLayout(S(), { grouping: 'soft', groupStrength: 0.5 }).positions)).toBe(soft5);
            expect(digest(lcm.buildDirectionLayout(S(), { grouping: 'soft', groupStrength: 1 }).positions)).toBe(soft1);
            expect(digest(layout(lcm, 'twoStep', {}, { floorLinks: false }).positions)).toBe(twoStep);
            // `none` / `soft` never read the floors.
            expect(layout(lcm, 'none').report.floors).toBeNull();
            ui.mapLook.dispose();
        });
    }
    it('no vertical link → the floors change nothing: seedling_atlas twoStep = base; alttp and the maze inert, no box', () => {
        const { lcm, ui } = build('seedling_atlas', 'merged', { nodeLook: 'map' });
        for (const floorGap of [0, 160, 600]) expect(digest(layout(lcm, 'twoStep', { floorGap }).positions)).toBe('8761ce1d6ebe287a');
        const { boxes } = layout(lcm, 'twoStepBoxes');
        expect(boxes.map((b) => [b.root, b.label])).toEqual([['dungeon1_room1', 'Floor ?']]);
        ui.mapLook.dispose();
        for (const [preset, want] of [['alttp', '64fd43393961d213'], ['procgen_maze', 'f6866e94f5279b9e']]) {
            const b = build(preset, 'separate');
            for (const v of ['twoStep', 'twoStepBoxes']) {
                const out = layout(b.lcm, v, { floorGap: 600 });
                expect(digest(out.positions), `${preset} ${v}`).toBe(want);
                expect(out.boxes).toEqual([]);
            }
        }
    });
});

describe('⛓ 5. determinism', () => {
    it('two builds give the same floor-layout digest at three gaps; floors.js reads no clock and no Math.random', () => {
        for (const view of ['merged', 'separate']) {
            const a = build('seedling_playthrough', view); const b = build('seedling_playthrough', view);
            for (const floorGap of [0, 160, 600]) {
                expect(digest(layout(a.lcm, 'twoStep', { floorGap }).positions)).toBe(digest(layout(b.lcm, 'twoStep', { floorGap }).positions));
            }
            expect(digest(layout(a.lcm, 'twoStepBoxes').positions)).toBe(digest(layout(a.lcm, 'twoStep').positions));
            // Other insertion orders of the model's links → the same numbering.
            const m = a.ui.mapLook.regionMapModel().model;
            const rev = { ...m, layout: { ...m.layout, graph: { ...m.layout.graph, links: [...m.layout.graph.links].reverse() } } };
            const x = F.floorNumbers(m); const y = F.floorNumbers(rev);
            expect([...y.floorOf].sort()).toEqual([...x.floorOf].sort());
            expect(y.conflicts.length).toBe(x.conflicts.length);
        }
        const src = readFileSync(join(HERE, 'floors.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date/);
    });
});

describe('⛓ 6. the Floor gap setting', () => {
    it('schema default only; out of range clamped; wrong type the default; a write re-runs (never rebuilds)', () => {
        expect(F.FLOOR_GAP_KEY).toBe('moduleSettings.regionGraph.floorGap');
        expect([F.FLOOR_GAP_SCHEMA.default, F.FLOOR_GAP_SCHEMA.minimum, F.FLOOR_GAP_SCHEMA.maximum]).toEqual([160, 0, 600]);
        expect([F.normaliseFloorGap(), F.normaliseFloorGap(-5), F.normaliseFloorGap(9999), F.normaliseFloorGap('x'), F.normaliseFloorGap(true), F.normaliseFloorGap(80)])
            .toEqual([160, 0, 600, 160, 160, 80]);
        expect(isDirectionSettingKey(F.FLOOR_GAP_KEY)).toBe(true);
        const src = readFileSync(join(HERE, 'index.js'), 'utf8');
        expect(src).toMatch(/floorGap: \{ \.\.\.FLOOR_GAP_SCHEMA \}/);
    });
    it('the panel reads it with no call-site default, and its control shows it', async () => {
        const { ui, lcm } = build('alttp', 'separate');
        expect((await lcm.loadGroupingSettings()).floorGap).toBe(160);
        expect(readFileSync(join(HERE, 'layoutControlsManager.js'), 'utf8')).toMatch(/id="floorGap"/);
        ui.groupingSettings = { grouping: 'twoStep', groupStrength: 0.5, floorGap: 240 };
        expect(lcm.buildDirectionLayout().report.stats.grouping).toMatchObject({ inert: true }); // alttp: inert at any gap
    });
});
