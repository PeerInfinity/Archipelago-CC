/**
 * procgenCore/regionLayoutResolve.test — the resolution order and the adapters (region-map step 3a, D3).
 *
 * Rows: start = (0, 0) on every path; the order grid_cell → hook → generic, and MIXED; the hub rule equal to the
 * engine's `isVirtualStart`; permuted input → the same layout; the Seedling hook over `seedling_playthrough` (R1's
 * stats, measured and pinned), and over a CUSTOM set (the editor's vanilla 116 compiled by `rulesJsonOf`).
 *
 * MUTANTS: dropping `canonicalGraphOrder` (the permutation row); a string sort (the natural-order row); reading
 * `grid_cell` when only some regions carry it (the mixed row); `out_pit` as a join (the kind row).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    canonicalGraphOrder, genericLayoutGraph, naturalCompare, resolveRegionLayout, worldStartOf,
} from './regionLayoutResolve.js';
import { isVirtualStart } from '../procgenPipeline/procgenPipelineEngine.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { seedlingExitLayoutKind } from '../flashPanel/seedlingCompositeMap.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';
import { tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../flashPanel/seedlingSemantics.js';
import { loadRulesSchema } from './jsonSchemaFiles.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import { emptyOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import { createSeedlingSetAdapter, createSetSession, rulesJsonOf, setRecord } from '../seedlingDemo/seedlingSetAdapter.js';
import { editorVanillaSet } from '../seedlingDemo/watchSetEditor.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const PLAYTHROUGH = read('../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const CHESTDOOR = read('../../presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json');
const ALTTP = read('../../presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json');

const clone = (x) => JSON.parse(JSON.stringify(x));
/** A doc of plain regions (generic path): `{name: [exit targets]}`, `locs` = regions with a location. */
const docOf = (graph, { start = 'Menu', locs = [] } = {}) => ({
    start_regions: { 1: { default: [start], available: [] } },
    regions: {
        1: Object.fromEntries(Object.entries(graph).map(([n, ts]) => [n, {
            name: n,
            exits: ts.map((t, i) => ({ name: `${n}_${i}`, connected_region: t })),
            locations: locs.includes(n) ? [{ name: `${n} loc` }] : [],
        }])),
    },
});
const fakeRegistry = (entries) => ({ get: (id) => entries[id] ?? null });
const seq = (positions) => JSON.stringify([...positions]);

describe('naturalCompare / canonicalGraphOrder', () => {
    it('numeric-aware: level_2 before level_10, then the rest by code unit', () => {
        expect(['level_10', 'level_2', 'level_1', 'a', 'B'].sort(naturalCompare)).toEqual(['B', 'a', 'level_1', 'level_2', 'level_10']);
        expect(canonicalGraphOrder({ nodes: ['b', 'a', 'a'], start: 'a', links: [] }).nodes).toEqual(['a', 'b']);
    });
});

describe('the start and the hub (as layoutTopDown reads them)', () => {
    it('the hub rule is the engine\'s isVirtualStart, over every region of three presets', () => {
        for (const doc of [PLAYTHROUGH, CHESTDOOR, ALTTP]) {
            for (const r of Object.values(doc.regions['1'])) {
                const hub = (r?.exits ?? []).length > 0 && (r?.locations ?? []).length === 0;
                expect(hub).toBe(isVirtualStart(r));
            }
        }
    });
    it('a stripped Menu: its first exit is the start, each further exit a root joined to it; the hub is no node', () => {
        const doc = docOf({ Menu: ['A', 'C'], A: ['B'], B: [], C: ['Menu'] });
        expect(worldStartOf(doc, '1')).toEqual({ start: 'A', hub: 'Menu', roots: ['C'] });
        const g = genericLayoutGraph(doc, '1');
        expect(g.nodes).toEqual(['A', 'B', 'C']);
        expect(g.links).toEqual([{ from: 'A', to: 'B', kind: 'join' }, { from: 'A', to: 'C', kind: 'join' }]);
        expect(g.dropped).toBe(1); // C → Menu
    });
    it('a Menu with a location is a real region and is drawn at the origin', () => {
        const r = resolveRegionLayout({ rules: docOf({ Menu: ['A'], A: [] }, { locs: ['Menu'] }), registry: fakeRegistry({}) });
        expect(r.start).toBe('Menu');
        expect(r.positions.get('Menu')).toEqual({ gx: 0, gy: 0 });
    });
});

describe('the resolution order', () => {
    it('1. grid_cell: every display region has one → the stored cells minus the start\'s', () => {
        const rules = clone(CHESTDOOR);
        const r = resolveRegionLayout({ rules });
        expect(r.stats.source).toBe('grid_cell');
        expect(r.positions.get(r.start)).toEqual({ gx: 0, gy: 0 });
        for (const [name, sc] of Object.entries(rules.preset_sidecars['1'])) {
            const s = rules.preset_sidecars['1'][r.start].grid_cell;
            expect(r.positions.get(name)).toEqual({ gx: sc.grid_cell.gx - s.gx, gy: sc.grid_cell.gy - s.gy });
        }
        // a start off the origin of the stored grid: shifted, signed
        rules.regions['1'].Menu.exits[0].connected_region = 'region_1_1';
        const moved = resolveRegionLayout({ rules });
        expect(moved.positions.get('region_1_1')).toEqual({ gx: 0, gy: 0 });
        expect(moved.positions.get('region_0_0')).toEqual({ gx: -1, gy: -1 });
    });

    it('2. hook: the substrate\'s compositeMap.layoutGraph, found through the registry', () => {
        const rules = docOf({ Menu: ['a'], a: ['b'], b: [] });
        rules.preset_sidecars = { 1: { a: { substrate: 'x' }, b: { substrate: 'x' } } };
        const reg = fakeRegistry({
            x: { compositeMap: { layoutGraph: () => ({ nodes: ['a', 'b'], links: [{ from: 'a', to: 'b', dir: 'N', kind: 'join' }] }) } },
        });
        const r = resolveRegionLayout({ rules, registry: reg });
        expect(r.stats.source).toBe('hook');
        expect(r.stats.substrate).toBe('x');
        expect(r.positions.get('a')).toEqual({ gx: 0, gy: 0 });
        expect(r.positions.get('b')).toEqual({ gx: 0, gy: -1 });
        // two substrates, two different hooks → no hook (generic)
        rules.preset_sidecars[1].b.substrate = 'y';
        const reg2 = fakeRegistry({ ...{ x: reg.get('x') }, y: { compositeMap: { layoutGraph: () => null } } });
        expect(resolveRegionLayout({ rules, registry: reg2 }).stats.source).toBe('generic');
    });

    it('3. generic: no sidecars → the rules\' regions and exits, all join, no dir (a classic AP world)', () => {
        const r = resolveRegionLayout({ rules: ALTTP });
        expect(r.stats.source).toBe('generic');
        expect(r.stats.directed).toBe(0);
        expect(r.positions.get(r.start)).toEqual({ gx: 0, gy: 0 });
        expect(r.positions.size).toBe(Object.keys(ALTTP.regions['1']).length - 1); // the stripped Menu is not drawn
        expect(new Set([...r.positions.values()].map((p) => `${p.gx},${p.gy}`)).size).toBe(r.positions.size);
    });

    it('MIXED: some display regions carry grid_cell, some do not → laid out by 2/3, and stats say so', () => {
        const rules = clone(CHESTDOOR);
        delete rules.preset_sidecars['1'].region_1_1.grid_cell;
        const r = resolveRegionLayout({ rules });
        expect(r.stats.source).not.toBe('grid_cell');
        expect(r.stats.mixedGridCell).toEqual({ with: 3, without: 1 });
        expect(r.positions.get(r.start)).toEqual({ gx: 0, gy: 0 });
    });
});

describe('determinism: a permuted document → the same layout', () => {
    const permute = (rules, seed) => {
        const out = clone(rules);
        let a = seed;
        const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
        const shuffle = (xs) => {
            for (let i = xs.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [xs[i], xs[j]] = [xs[j], xs[i]];
            }
            return xs;
        };
        const hub = worldStartOf(rules, '1').hub;
        const regions = out.regions['1'];
        out.regions['1'] = Object.fromEntries(shuffle(Object.entries(regions)).map(([n, r]) => {
            // ⛓ the hub's FIRST exit is the start by definition: it stays first
            if (n === hub) return [n, { ...r, exits: [r.exits[0], ...shuffle(r.exits.slice(1))] }];
            return [n, { ...r, exits: shuffle([...(r.exits ?? [])]) }];
        }));
        if (out.preset_sidecars?.['1']) {
            out.preset_sidecars['1'] = Object.fromEntries(shuffle(Object.entries(out.preset_sidecars['1'])).map(([n, sc]) => {
                const p = sc.playable_payload;
                return [n, { ...sc, playable_payload: { ...p, exits: shuffle([...(p.exits ?? [])]) } }];
            }));
        }
        return out;
    };
    for (const [name, doc] of [['seedling_playthrough (hook)', PLAYTHROUGH], ['alttp (generic)', ALTTP]]) {
        it(name, () => {
            const base = resolveRegionLayout({ rules: doc });
            for (let s = 1; s <= 4; s++) {
                const r = resolveRegionLayout({ rules: permute(doc, s) });
                expect(seq(r.positions)).toBe(seq(base.positions));
                expect(r.groups).toEqual(base.groups);
            }
        });
    }
});

describe('(A) the join audit — the generic producer', () => {
    it('generic (rules exits, no geometry): every link stays `join` — UNCLASSIFIABLE, left as it is (alttp)', () => {
        const g = genericLayoutGraph(ALTTP, '1');
        expect(g.links.length).toBeGreaterThan(0);
        expect(g.links.every((l) => l.kind === 'join' && l.dir == null)).toBe(true);
    });
});

describe('the Seedling hook (compositeMap.layoutGraph)', () => {
    it('kind off the exit_id prefix: stairs down and pits go down, stairs up up, the rest join', () => {
        expect(['out_stairsdown_32_192', 'out_pit_0_0', 'out_stairsup_1_2', 'out_teleporter_0_128', 'out_oracle_64_32', 'in_L0_80_96']
            .map(seedlingExitLayoutKind)).toEqual(['down', 'down', 'up', 'join', 'join', 'join']);
    });

    it('seedling_playthrough: 263 regions fold to 115 levels; R1 groups and the down-below census (MEASURED)', () => {
        const r = resolveRegionLayout({ rules: PLAYTHROUGH });
        expect(r.stats.source).toBe('hook');
        expect(r.stats.substrate).toBe('flash_seedling');
        expect(r.start).toBe('level_0');
        expect(r.positions.get('level_0')).toEqual({ gx: 0, gy: 0 });
        expect(r.positions.size).toBe(115);
        expect(new Set([...r.positions.values()].map((p) => `${p.gx},${p.gy}`)).size).toBe(115);
        // ⛓ measured 2026-11-14 at 9b99178fa7 (the 3a report): groups 21, directed 220, honoured 135, consistent 196,
        //   down 45/45, up 22/22, the start's group 54 levels. RE-MEASURED 2026-11-17 after the join audit (A): the 46
        //   exits that are not edge transitions are `warp` now, so they join nothing (and carry no `dir`)
        expect(r.stats).toMatchObject({
            groups: 43, directed: 184, honoured: 122, consistent: 178,
            down: { across: 62, below: 62 }, up: { across: 25, above: 25 },
        });
        expect(r.groups[0]).toMatchObject({ root: 'level_0', placedBy: 'start' });
        expect(r.groups[0].members.length).toBe(28);
        const count = (k) => r.graph.links.filter((l) => l.kind === k).length;
        expect([count('join'), count('warp'), count('down'), count('up')]).toEqual([184, 46, 64, 26]);
        // ⛓ (P) the source groups sit just above their first successors (MEASURED before (A): 486.81 → 354.73 cells
        //   summed over the 67 cross-group links; after (A): 131 cross-group links, 1561.94 — the warps are long;
        //   after (ii), warp-only groups beside their first warp predecessor: 911.05)
        const byRoot = new Map(r.groups.map((g) => [g.root, g]));
        expect(byRoot.get('level_7')).toMatchObject({ placedBy: 'source', bbox: { minX: -3, minY: 5, maxX: -3, maxY: 5 } });
        // level_32 → level_30: straight over level_30's column, slid UP clear of the groups (ii) put beside level_12
        expect(byRoot.get('level_32')).toMatchObject({ placedBy: 'source', bbox: { minX: 7, minY: -4, maxX: 7, maxY: -4 } });
        const g30 = r.groups.find((g) => g.members.includes('level_30'));
        expect(r.positions.get('level_32').gx).toBe(r.positions.get('level_30').gx);
        expect(r.positions.get('level_32').gy).toBeLessThan(g30.bbox.minY);
        // (ii): the doorway levels sit beside the level that warps into them
        expect(byRoot.get('level_1')).toMatchObject({ placedBy: 'warp', bbox: { minX: 5, minY: 0 } });
        expect(byRoot.get('level_33')).toMatchObject({ placedBy: 'warp', bbox: { minX: 7, minY: 0 } });
        const placedBy = {};
        for (const g of r.groups) placedBy[g.placedBy] = (placedBy[g.placedBy] ?? 0) + 1;
        expect(placedBy).toEqual({ start: 1, below: 17, warp: 11, source: 9, right: 5 });
        expect(r.stats.crossLength).toBe(911.05);
        // every link the hook made from stairs/pits is vertical, and only those
        const kinds = new Set(r.graph.links.map((l) => l.kind));
        expect([...kinds].sort()).toEqual(['down', 'join', 'up', 'warp']);
        expect(r.graph.links.filter((l) => l.kind !== 'join').every((l) => l.dir === null)).toBe(true);
    });

    it('a CUSTOM set (the editor\'s vanilla 116, compiled by rulesJsonOf): the same hook, directions given its atlas', () => {
        const MAP = read('../flashPanel/atlases/seedling-map.json');
        const EMBED = read('../seedlingDemo/fixtures/seedling-vanilla-set.json');
        const DEPS = {
            parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
            atlas: { game: 'seedling', mapDocument: 'custom-set.json' },
        };
        const V = setRecord(editorVanillaSet(EMBED, MAP).set, emptyOverlay());
        const s = createSetSession(createSeedlingSetAdapter(DEPS), V, { base: { kind: 'set', set_id: V.set.set_id } });
        const { rules, atlas } = rulesJsonOf(s, DEPS, { compileRegionAtlas });
        // what a custom world carries: whole-level regions, the shipped payload shape, an atlas nobody ships
        const sc = Object.values(rules.preset_sidecars['1']);
        expect(sc.every((e) => e.substrate === 'flash_seedling' && Array.isArray(e.playable_payload.exits))).toBe(true);
        expect(substrateRegistry.get('flash_seedling').compositeMap.layoutGraph).toBeTypeOf('function');
        const blind = resolveRegionLayout({ rules });
        expect(blind.stats.source).toBe('hook');
        expect(blind.stats.directed).toBe(0); // the derived atlas is not shipped: no level sizes, no directions
        // ⛓ MEASURED: blind (no level sizes, so no exit can be told an edge transition or a warp) R1 joins level_82 /
        //   96 / 98 into the overworld by `join` exits, and a pit or stairs reaches each
        //   from a group BELOW it — a cycle, so 3 of 43 down links cannot land below (the 3a report's R2 motivation)
        expect(blind.stats.down).toEqual({ across: 43, below: 40 });
        expect(blind.stats.vertical.cycleDropped).toBeGreaterThanOrEqual(3);
        const sighted = resolveRegionLayout({ rules, hookCtx: { atlases: { [atlas.atlas_id]: atlas } } });
        expect(sighted.stats.directed).toBeGreaterThan(100);
        // ⛓ (A) MEASURED: with level sizes the warps are told apart (17 → 43 groups); blind, every exit is
        //   UNCLASSIFIABLE and stays `join` (17 groups, as before)
        expect(blind.graph.links.some((l) => l.kind === 'warp')).toBe(false);
        expect(blind.stats.groups).toBe(17);
        expect(sighted.stats.groups).toBe(43);
        expect(sighted.graph.links.filter((l) => l.kind === 'warp').length).toBeGreaterThan(0);
        expect(sighted.positions.get(sighted.start)).toEqual({ gx: 0, gy: 0 });
        expect(sighted.positions.size).toBe(sc.length);
    });
});
