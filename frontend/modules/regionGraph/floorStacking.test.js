/**
 * ⛓ region-graph-floor-stacking — the two-step floor grouping stacks its blocks BY FLOOR: higher floor ⇒ higher on
 * the screen (`floorGroups.js` `stackByFloor`, `floorOrderCheck`).
 *
 * ⚖ The user, session 84c8ab35: 2026-11-28T03:33:37.957Z "Yes, I want to arrange the blocks on the map by floor, so
 * higher floors sit above lower ones."; 2026-11-28T03:46:31.484Z "Replace (Recommended)" (no new setting: the
 * stair-direction block placement goes); 2026-11-28T03:55:11.570Z "Floor order wins (Recommended)" (strict bands; a
 * stair's east / west side only orders the blocks within a band — the between-block direction error rising is
 * accepted, reported here, not pinned as a regression).
 *
 * Inputs are FROZEN: rules (`fixtures/sub-region-view`, `mazeRoom/fixtures/region-map-hooks/procgen_topdown`) and the
 * Seedling atlases they were cut against (`loadFrozenAtlas`). "Before" = `floorStacking: false` (the region-graph-floors
 * placement).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
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
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
await import('../mazeRoom/mazeRoomLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { LayoutControlsManager } = await import('./layoutControlsManager.js');
const { MapLookLayer } = await import('./mapLookLayer.js');
const D = await import('./directionLayout.js');
const G = await import('./floorGroups.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();
const digest = (positions) => createHash('sha256').update(D.positionsKey(positions)).digest('hex').slice(0, 16);
const NODE_STYLE = [{ selector: 'node', style: { width: 60, height: 45, 'border-width': 2, shape: 'ellipse' } }];
const TOPDOWN = () => JSON.parse(gunzipSync(readFileSync(join(HERE, '..', 'mazeRoom', 'fixtures', 'region-map-hooks', 'procgen_topdown.rules.json.gz'))).toString('utf8'));
const S = () => D.normaliseDirectionSettings();

function build(preset, view, nodeLook = 'graph') {
    const rules = preset === 'procgen_topdown' ? TOPDOWN() : kit.loadFrozenRules(preset);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === 'mid').snapshot;
    const ui = kit.makeUi(cytoscape, {
        cy: cytoscape({ headless: true, styleEnabled: true, style: NODE_STYLE }), subRegionView: view, nodeLook, runLayout() {},
    });
    ui.graphContainer = null;
    ui.mapLook = new MapLookLayer(ui);
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    dm.buildGraphFromRegions(regions, null);
    const lcm = new LayoutControlsManager(ui);
    ui.layoutControlsManager = lcm;
    if (nodeLook === 'map') expect(ui.mapLook.sync()).toBe(true);
    return { ui, lcm };
}
const run = (lcm, grouping, extra = {}, opts = {}) => lcm.buildDirectionLayout(S(), { grouping, groupStrength: 0.5, ...extra }, opts);

/** The measures the report quotes: order, overlaps, angle error inside / between blocks. */
function measures(out) {
    const r = out.report;
    const f = r.floors;
    return {
        pairs: r.floorOrder.pairs, violations: r.floorOrder.violations, stacked: r.floorOrder.stacked,
        overlaps: r.overlaps, blockOverlaps: r.blockOverlaps, intruders: r.intruders,
        inside: f.flatInsideError, betweenFlat: f.flatBetweenError, vertical: f.verticalError, all: r.meanAngleError,
        layoutMs: r.layoutMs, solveMs: f.solveMs,
    };
}

describe('⛓ 1. seedling_playthrough: every pair of blocks on different floors is vertically ordered', () => {
    for (const [view, nodeLook] of [['merged', 'map'], ['merged', 'graph'], ['separate', 'graph']]) {
        it(`${view} · ${nodeLook}: violations before > 0, after 0; overlaps 0; inside-block error unchanged`, () => {
            const { lcm, ui } = build('seedling_playthrough', view, nodeLook);
            for (const v of ['twoStep', 'twoStepBoxes']) {
                const before = measures(run(lcm, v, {}, { floorStacking: false }));
                const after = measures(run(lcm, v));
                expect(before.stacked).toBe(false);
                expect(after.stacked).toBe(true);
                expect(after.pairs).toBe(before.pairs);
                expect(after.pairs).toBeGreaterThan(0);
                expect(before.violations).toBeGreaterThan(0);
                expect(after.violations).toBe(0);
                expect([after.overlaps, after.blockOverlaps, after.intruders]).toEqual([0, 0, 0]);
                // Inside a block nothing moves relative to its block (to the 0.01 px rounding).
                expect(after.inside.n).toBe(before.inside.n);
                expect(after.inside.mean).toBeCloseTo(before.inside.mean, 2);
                expect(after.solveMs).toBeLessThan(50);
                // eslint-disable-next-line no-console
                if (v === 'twoStep') console.log(`[floor-stacking] ${view}·${nodeLook}: pairs ${after.pairs}, violations ${before.violations} → ${after.violations}; `
                    + `inside ${before.inside.mean?.toFixed(1)}° → ${after.inside.mean?.toFixed(1)}° (n ${after.inside.n}); `
                    + `between-flat ${before.betweenFlat.mean?.toFixed(1)}° → ${after.betweenFlat.mean?.toFixed(1)}° (n ${after.betweenFlat.n}); `
                    + `vertical ${before.vertical.mean?.toFixed(1)}° → ${after.vertical.mean?.toFixed(1)}° (n ${after.vertical.n}); `
                    + `all ${before.all?.toFixed(1)}° → ${after.all?.toFixed(1)}°; layout ${after.layoutMs.toFixed(0)} ms, solve ${after.solveMs.toFixed(1)} ms`);
            }
            ui.mapLook.dispose();
        });
    }
    it('the bands: one per floor, highest on top, floorGap apart; a bigger gap spreads them, the order holds at every gap', () => {
        const { lcm, ui } = build('seedling_playthrough', 'merged', 'map');
        let lastSpan = -Infinity;
        for (const floorGap of [0, 160, 600]) {
            const out = run(lcm, 'twoStep', { floorGap });
            const bands = out.report.stats.grouping.bands;
            expect(bands.map((b) => b.band)).toEqual([1, 0, -1, -2, -3, -4, -5]);
            for (let i = 1; i < bands.length; i += 1) expect(bands[i].y1 - bands[i - 1].y2).toBeCloseTo(floorGap, 6);
            expect(bands.reduce((a, b) => a + b.blocks, 0)).toBe(out.report.stats.grouping.blocks);
            expect(out.report.floorOrder.violations).toBe(0);
            expect(out.report.blockOverlaps).toBe(0);
            const span = bands.at(-1).y2 - bands[0].y1;
            expect(span).toBeGreaterThan(lastSpan);
            lastSpan = span;
        }
        ui.mapLook.dispose();
    });
});

describe('⛓ 2. range and unreached groups; the guard (synthetic)', () => {
    const block = (g, n = 2) => Array.from({ length: n }, (_, i) => ({ id: `${g}${i}`, w: 40, h: 30, floorGroup: g }));
    const nodes = [...block('A'), ...block('B'), ...block('C'), ...block('R'), ...block('U'), { id: 'menu', w: 40, h: 30 }];
    const edges = [
        { id: 'a', source: 'A0', target: 'A1', pref: { dx: 1, dy: 0, weight: 1 } },
        { id: 'ab', source: 'A1', target: 'B0', vertical: { pref: { dx: 1, dy: 0, weight: 1 }, exits: 1 } },
        { id: 'bc', source: 'B1', target: 'C0', vertical: { pref: { dx: 0, dy: -1, weight: 1 }, exits: 1 } },
        { id: 'ar', source: 'A0', target: 'R0' },
        { id: 'cu', source: 'C1', target: 'U0' },
        { id: 'm', source: 'menu', target: 'A0' },
    ];
    const numbering = { floorOf: new Map([['A', 0], ['B', -1], ['C', -3]]), ranged: new Map([['R', [-3, -2]]]), unreached: ['U'] };
    const out = (bands, floorGap = 160) => G.groupedDirectionLayout(nodes, edges, { ...S(), grouping: 'twoStep', floorGap, floorBands: bands });
    it('floorBandsOf: a pick its floor; a range its midpoint rounded UP; unreached its own band', () => {
        const { bandOf, rangeOf } = G.floorBandsOf(numbering);
        expect([...bandOf].sort()).toEqual([['A', 0], ['B', -1], ['C', -3], ['R', -2], ['U', G.UNREACHED_BAND]].sort());
        expect(Object.is(G.floorBandsOf({ ranged: new Map([['x', [-1, 0]]]) }).bandOf.get('x'), 0)).toBe(true); // never −0
        expect(rangeOf.get('R')).toEqual([-3, -2]);
        expect(rangeOf.has('U')).toBe(false);
    });
    it('the bands top to bottom: 0 (A + the Menu), −1, −2 (the range), −3, then unreached; an empty floor adds a gap', () => {
        const r = out(G.floorBandsOf(numbering));
        expect(r.stats.grouping.bands.map((b) => [b.band, b.blocks])).toEqual([[0, 2], [-1, 1], [-2, 1], [-3, 1], [G.UNREACHED_BAND, 1]]);
        const yOf = (g) => r.blocks.find((b) => b.floorGroup === g);
        expect(yOf('A').y2).toBeLessThanOrEqual(yOf('B').y1);
        expect(yOf('B').y2).toBeLessThanOrEqual(yOf('R').y1);
        expect(yOf('R').y2).toBeLessThanOrEqual(yOf('C').y1);
        expect(yOf('C').y2).toBeLessThanOrEqual(yOf('U').y1);
        const check = G.floorOrderCheck(r.blocks, G.floorBandsOf(numbering).rangeOf);
        // A, B, C, R ordered pairwise except R against C (−3 lies in −3…−2): 5 pairs; 0 violations.
        expect(check).toEqual({ pairs: 5, violations: 0 });
        // A gap with an empty floor between: B (−1) and C (−3) with no range group between them.
        const noRange = { ...numbering, ranged: new Map() };
        const r2 = out(G.floorBandsOf(noRange), 100);
        const bs = r2.stats.grouping.bands;
        const iB = bs.findIndex((b) => b.band === -1);
        expect(bs[iB + 1].band).toBe(-3);
        expect(bs[iB + 1].y1 - bs[iB].y2).toBeCloseTo(200, 6);
    });
    it('within a band: the relaxation\'s left-right order, no overlap; the order check sees a band swapped', () => {
        const flat = { floorOf: new Map([['A', 0], ['B', 0], ['C', -1], ['R', -1]]), ranged: new Map(), unreached: [] };
        const r = out(G.floorBandsOf(flat));
        const before = out(null);
        const top = ['A', 'B'].map((g) => [g, r.blocks.find((b) => b.floorGroup === g), before.blocks.find((b) => b.floorGroup === g)]);
        const sx = (b) => (b.x1 + b.x2) / 2;
        expect(Math.sign(sx(top[0][1]) - sx(top[1][1]))).toBe(Math.sign(sx(top[0][2]) - sx(top[1][2])));
        expect(G.blockCheck(nodes, r.positions, r.stats.grouping.pad).blockOverlaps).toBe(0);
        // Swap two bands' y: the check counts every cross pair.
        const swapped = r.blocks.map((b) => (b.floorGroup === 'A' || b.floorGroup === 'B' ? { ...b, y1: b.y1 + 1000, y2: b.y2 + 1000 } : b));
        expect(G.floorOrderCheck(swapped, G.floorBandsOf(flat).rangeOf)).toEqual({ pairs: 4, violations: 4 });
    });
    it('the guard: no numbering, or fewer than 2 numbered floors → today\'s placement, byte for byte', () => {
        const base = digest(out(null).positions);
        expect(digest(out(G.floorBandsOf(null)).positions)).toBe(base);
        const one = { floorOf: new Map([['A', 0], ['B', 0], ['C', 0]]), ranged: new Map(), unreached: ['U', 'R'] };
        expect(digest(out(G.floorBandsOf(one)).positions)).toBe(base);
        expect(out(G.floorBandsOf(one)).stats.grouping.bands).toBeNull();
    });
    it('determinism: other insertion orders of nodes and edges → the same positions', () => {
        const bands = G.floorBandsOf(numbering);
        const a = digest(out(bands).positions);
        const rev = G.groupedDirectionLayout([...nodes].reverse(), [...edges].reverse(), { ...S(), grouping: 'twoStep', floorBands: bands });
        expect(digest(rev.positions)).toBe(a);
    });
});

describe('⛓ 3. what does not change', () => {
    it('none and soft never stack (their positions do not depend on floorStacking)', () => {
        const { lcm, ui } = build('seedling_playthrough', 'merged', 'map');
        for (const v of ['none', 'soft']) {
            expect(digest(run(lcm, v).positions), v).toBe(digest(run(lcm, v, {}, { floorStacking: false }).positions));
            expect(run(lcm, v).report.floorOrder).toBeNull();
        }
        ui.mapLook.dispose();
    });
    for (const [preset, view, nodeLook] of [['alttp', 'separate', 'graph'], ['procgen_topdown', 'merged', 'map'], ['procgen_maze', 'separate', 'graph'], ['seedling_atlas', 'merged', 'map']]) {
        it(`${preset} · ${view}: twoStep / twoStepBoxes = the placement before (no world of fewer than 2 floors stacks)`, () => {
            const { lcm, ui } = build(preset, view, nodeLook);
            for (const v of ['twoStep', 'twoStepBoxes']) {
                const after = run(lcm, v);
                expect(digest(after.positions), `${preset} ${v}`).toBe(digest(run(lcm, v, {}, { floorStacking: false }).positions));
                expect(after.report.stats.grouping?.bands ?? null).toBeNull();
            }
            ui.mapLook.dispose();
        });
    }
});

describe('⛓ 4. purity', () => {
    it('floorGroups.js reads no clock and no Math.random', () => {
        const src = readFileSync(join(HERE, 'floorGroups.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date/);
    });
});
