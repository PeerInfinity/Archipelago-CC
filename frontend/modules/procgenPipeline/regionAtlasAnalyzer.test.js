// Unit tests for the region-atlas analyzer
// (CC/docs/plans/region-atlas-plan.md, Phase 5a, Deliverable 2).
//
// Two strata, deliberately: hand-built grids where the expected partition is
// obvious by eye, and the real Seedling map, where the analyzer has to survive
// terrain nobody designed for it. The hand-built ones use a tiny made-up
// condition vocabulary, so they also prove the core really is game-agnostic —
// nothing in them mentions Seedling.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    findComponents,
    findCrossings,
    buildInternalExits,
    componentForTile,
    componentId,
    analyzeRegion,
    applyRegionAnalysis,
    formatAnalysisReport,
    simplifyRule,
    describeRule,
} from './regionAtlasAnalyzer.js';
import { validateRegionAtlas } from './regionAtlasValidator.js';
import {
    analyzeSeedlingRegion,
    applySeedlingRegionAnalysis,
    seedlingAnalyzerOptions,
} from '../flashPanel/seedlingAtlasAnalysis.js';

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const MAP = read('../flashPanel/atlases/seedling-map.json');
const GAME_CONFIG = read('../flashPanel/games/seedling.json');
const STARTER = read('../flashPanel/atlases/seedling.json');

const clone = (v) => JSON.parse(JSON.stringify(v));

// --- a tiny made-up game -----------------------------------------------------
//
// Conditions are plain strings; a rule is Has(<string>). Nothing here is
// Seedling, which is the point.
const OPTIONS = {
    conditionKey: (c) => String(c),
    resolveCondition: (c) => (c === 'unobtainable' ? null : { rule: 'Has', args: { item_name: c } }),
};

/**
 * Build a grid from an ASCII map, one character per cell:
 *   '.' open   '#' wall   '~' gated on `a`   '=' gated on `b`
 *   'v' one-way south (free down, blocked up)   'o' pit sink
 *   '?' manual blocker   'c' cave: north FACE walled, sides free
 */
function gridOf(rows, origin = { x: 0, y: 0 }) {
    const width = rows[0].length;
    const height = rows.length;
    const cells = [];
    for (const row of rows) {
        for (const ch of row) {
            const cell = { kind: 'open', conditions: [], faces: {}, dirs: {}, manual: [], labels: [] };
            if (ch === '#') cell.kind = 'wall';
            else if (ch === '~') { cell.kind = 'gated'; cell.conditions = ['a']; }
            else if (ch === '=') { cell.kind = 'gated'; cell.conditions = ['b']; }
            else if (ch === 'v') { cell.kind = 'directional'; cell.dirs = { N: null }; }
            else if (ch === 'o') { cell.kind = 'sink'; cell.labels = ['pit']; }
            else if (ch === '?') { cell.kind = 'manual'; cell.manual = ['a puzzle']; }
            else if (ch === 'c') { cell.kind = 'directional'; cell.faces = { N: null }; }
            cells.push(cell);
        }
    }
    return { width, height, cells, origin, unclassified: [], review: [], sinks: [] };
}

const idsOf = (analysis) => analysis.components.map((c) => c.id);
const rowsOf = (analysis) => analysis.internal_exits;

describe('components', () => {
    it('names a component for its own minimum (y, x) tile, in atlas coordinates', () => {
        expect(componentId(3, 7)).toBe('r7c3');
        const grid = gridOf(['..#..', '..#..'], { x: 10, y: 20 });
        const { components } = findComponents(grid);
        expect(components.map((c) => c.id)).toEqual(['r20c10', 'r20c13']);
        expect(components[0].size).toBe(4);
    });

    it('never puts "__" in an id, whatever the coordinates', () => {
        for (const [x, y] of [[0, 0], [-3, 12], [999, 4]]) {
            expect(componentId(x, y)).not.toContain('__');
        }
    });

    it('finds one component when the region is one walkable piece', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['....', '....']), OPTIONS);
        expect(analysis.components).toHaveLength(1);
        expect(analysis.split).toBe(false);
        expect(analysis.internal_exits).toEqual([]);
    });

    it('does not merge two areas a wall separates', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.#.', '.#.']), OPTIONS);
        expect(idsOf(analysis)).toEqual(['r0c0', 'r0c2']);
        // A wall is not a crossing: there is no way across at any item state.
        expect(analysis.internal_exits).toEqual([]);
    });
});

describe('crossings', () => {
    it('labels a gated strip with its condition, both ways', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.~.']), OPTIONS);
        expect(idsOf(analysis)).toEqual(['r0c0', 'r0c2']);
        expect(rowsOf(analysis)).toEqual([{
            from: 'r0c0',
            to: 'r0c2',
            bidirectional: true,
            source: 'analyzer',
            access_rule: { rule: 'Has', args: { item_name: 'a' } },
        }]);
    });

    it('ANDs the conditions a single route has to pay in series', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.~=.']), OPTIONS);
        expect(rowsOf(analysis)[0].access_rule).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'a' } },
                { rule: 'Has', args: { item_name: 'b' } },
            ],
        });
    });

    it('ORs two parallel routes with different conditions', () => {
        // The case leave-one-out ability diffing gets wrong (ruling 1): removing
        // either item alone leaves the other route open, so a diff would call
        // this crossing free.
        const parallel = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf([
            '.~.',
            '.=.',
        ]), OPTIONS);
        expect(idsOf(parallel)).toEqual(['r0c0', 'r0c2']);
        expect(rowsOf(parallel)).toHaveLength(1);
        expect(rowsOf(parallel)[0].access_rule).toEqual({
            rule: 'Or',
            children: [
                { rule: 'Has', args: { item_name: 'a' } },
                { rule: 'Has', args: { item_name: 'b' } },
            ],
        });
    });

    it('drops a route that costs strictly more than another', () => {
        // Left route: 'a'. Right route: 'a' then 'b'. Paying both is never
        // required, so the crossing is just 'a'.
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf([
            '.~.',
            '#.#',
            '.~.',
            '#=#',
        ]), OPTIONS);
        const rule = rowsOf(analysis).find((r) => r.access_rule)?.access_rule;
        expect(describeRule(rule)).toBe('a');
    });

    it('emits a one-way pair when the two directions differ', () => {
        // 'v' is free downward and blocked upward.
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.', 'v', '.']), OPTIONS);
        expect(idsOf(analysis)).toEqual(['r0c0', 'r2c0']);
        expect(rowsOf(analysis)).toEqual([
            { from: 'r0c0', to: 'r2c0', bidirectional: false, source: 'analyzer' },
        ]);
    });

    it('fuses two areas a free crossing joins both ways', () => {
        // A cave mouth gates its NORTH face only, so walking through it sideways
        // is free in both directions — that is one place, not two with a free
        // internal exit between them.
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.c.']), OPTIONS);
        expect(analysis.components).toHaveLength(1);
        expect(analysis.split).toBe(false);
    });

    it('keeps the north face of a cave impassable in both directions', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.', 'c']), OPTIONS);
        expect(analysis.components).toHaveLength(1); // only the top '.' is walkable
        expect(rowsOf(analysis)).toEqual([]);
    });

    it('reports a pit as a boundary-exit candidate, never as a crossing', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.o.']), OPTIONS);
        expect(idsOf(analysis)).toEqual(['r0c0', 'r0c2']);
        expect(rowsOf(analysis)).toEqual([]);
        expect(analysis.boundary_candidates).toEqual([
            { sub_region: 'r0c0', tile: [1, 0], labels: ['pit'], note: expect.stringContaining('one-way drop') },
            { sub_region: 'r0c2', tile: [1, 0], labels: ['pit'], note: expect.stringContaining('one-way drop') },
        ]);
    });

    it('makes a puzzle blocker a hand-authoring row with no rule', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf(['.?.']), OPTIONS);
        expect(rowsOf(analysis)).toEqual([
            { from: 'r0c0', to: 'r0c2', bidirectional: true, source: 'manual' },
        ]);
        expect(analysis.needs_authoring).toHaveLength(1);
        expect(analysis.needs_authoring[0].reasons).toEqual(['a puzzle']);
        expect(formatAnalysisReport(analysis).join('\n')).toMatch(/NEED HAND AUTHORING/);
    });

    it('prefers a labelled route over a manual one between the same pair', () => {
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, gridOf([
            '.~.',
            '.?.',
        ]), OPTIONS);
        expect(rowsOf(analysis)).toEqual([{
            from: 'r0c0',
            to: 'r0c2',
            bidirectional: true,
            source: 'analyzer',
            access_rule: { rule: 'Has', args: { item_name: 'a' } },
        }]);
        expect(analysis.needs_authoring).toEqual([]);
    });

    it('falls back to hand authoring when no item backs the condition', () => {
        const options = { ...OPTIONS, conditionKey: (c) => String(c) };
        const grid = gridOf(['.~.']);
        for (const cell of grid.cells) if (cell.kind === 'gated') cell.conditions = ['unobtainable'];
        const analysis = analyzeRegion({ region_id: 'r', exits: [], locations: [] }, grid, options);
        expect(rowsOf(analysis)[0]).toEqual({ from: 'r0c0', to: 'r0c2', bidirectional: true, source: 'manual' });
        expect(analysis.unresolved_conditions).toContain('unobtainable');
    });

    it('needs a conditionKey helper rather than guessing at condition identity', () => {
        expect(() => findCrossings(gridOf(['.']), findComponents(gridOf(['.'])), {}))
            .toThrow(/conditionKey/);
        expect(() => buildInternalExits([], {})).toThrow(/resolveCondition/);
    });
});

describe('rule tidying', () => {
    const has = (item_name, count) => ({ rule: 'Has', args: count === undefined ? { item_name } : { item_name, count } });

    it('keeps the strongest count in an AND and the weakest in an OR', () => {
        // A swim across followed by a waterfall climb: two copies of the same
        // progressive, where the larger already implies the smaller.
        expect(simplifyRule({ rule: 'And', children: [has('Swim'), has('Swim', 2)] }))
            .toEqual(has('Swim', 2));
        expect(simplifyRule({ rule: 'Or', children: [has('Swim', 2), has('Swim')] }))
            .toEqual(has('Swim'));
    });

    it('flattens a nested same-operator tree and drops duplicates', () => {
        expect(simplifyRule({
            rule: 'Or',
            children: [has('A'), { rule: 'Or', children: [has('B'), has('A')] }],
        })).toEqual({ rule: 'Or', children: [has('A'), has('B')] });
    });

    it('leaves a mixed tree and a non-Has child alone', () => {
        const mixed = { rule: 'And', children: [has('A'), { rule: 'Or', children: [has('B'), has('C')] }] };
        expect(simplifyRule(mixed)).toEqual(mixed);
        expect(simplifyRule(has('A'))).toEqual(has('A'));
        expect(simplifyRule({ rule: 'True_' })).toEqual({ rule: 'True_' });
    });

    it('does not touch a Has carrying arguments it does not understand', () => {
        const exotic = { rule: 'Has', args: { item_name: 'A', count: { rule: 'CountItem' } } };
        expect(simplifyRule({ rule: 'And', children: [exotic, has('A')] }))
            .toEqual({ rule: 'And', children: [exotic, has('A')] });
    });
});

describe('placing exits and locations', () => {
    const grid = gridOf(['.~.']);
    const componentsResult = findComponents(grid);

    it('places a tile that sits in a component exactly', () => {
        const hit = componentForTile(grid, componentsResult, [0, 0]);
        expect(hit.exact).toBe(true);
        expect(hit.component.id).toBe('r0c0');
    });

    it('places a tile on crossing material by proximity, and says so', () => {
        const hit = componentForTile(grid, componentsResult, [1, 0]);
        expect(hit.exact).toBe(false);
        expect(hit.component.id).toBe('r0c0'); // tie broken by id
        expect(hit.reason).toMatch(/nearest component/);
    });

    it('reports a tile outside the grid rather than placing it', () => {
        expect(componentForTile(grid, componentsResult, [9, 9]).component).toBeNull();
    });

    it('places a tile on a wall NEXT to a room — a door drawn on the wall line', () => {
        const walled = gridOf(['#.']);
        const hit = componentForTile(walled, findComponents(walled), [0, 0]);
        expect(hit.exact).toBe(false);
        expect(hit.component.id).toBe('r0c1');
    });

    it('reports a tile with no walkable component anywhere to reach', () => {
        const solid = gridOf(['##', '##']);
        const hit = componentForTile(solid, findComponents(solid), [0, 0]);
        expect(hit.component).toBeNull();
        expect(hit.reason).toMatch(/no walkable component/);
    });
});

// --- the merge ---------------------------------------------------------------

const makeAtlas = (regionOverrides = {}) => ({
    schema_version: 1,
    atlas_id: 'toy',
    game: 'toy',
    provenance: { generator: 'test' },
    tile_space: { tile_size: 16 },
    regions: [{
        region_id: 'room',
        bounds: { x: 0, y: 0, w: 3, h: 1 },
        exits: [
            { exit_id: 'w', kind: 'edge', side: 'W', exit_tiles: [[0, 0]], entrance_tile: [0, 0] },
            { exit_id: 'e', kind: 'edge', side: 'E', exit_tiles: [[2, 0]], entrance_tile: [2, 0] },
        ],
        locations: [{ name: 'Room - Chest', tile: [2, 0], vanilla_item: 'Thing' }],
        annotations: { rules_source: 'manual' },
        ...regionOverrides,
    }],
    vanilla_layout: { start_region: 'room', connections: [] },
});

const analyzeRoom = (atlas, rows = ['.~.']) => analyzeRegion(atlas.regions[0], gridOf(rows), OPTIONS);

describe('applying a split', () => {
    it('writes the subgraph and binds every exit and location by geometry', () => {
        const atlas = makeAtlas();
        const result = applyRegionAnalysis(atlas, analyzeRoom(atlas));
        const region = atlas.regions[0];
        expect(region.subgraph.sub_regions).toEqual(['r0c0', 'r0c2']);
        expect(region.subgraph.internal_exits).toHaveLength(1);
        expect(region.exits.map((e) => e.sub_region)).toEqual(['r0c0', 'r0c2']);
        expect(region.locations[0].sub_region).toBe('r0c2');
        expect(atlas.vanilla_layout.start_sub_region).toBe('r0c0');
        expect(region.annotations.rules_source).toBe('analyzer');
        expect(result.problems).toEqual([]);
        expect(validateRegionAtlas(atlas).ok).toBe(true);
    });

    it('OMITS the subgraph when there is no split, rather than emitting a one-entry one', () => {
        const atlas = makeAtlas();
        applyRegionAnalysis(atlas, analyzeRoom(atlas, ['...']));
        const region = atlas.regions[0];
        expect(region.subgraph).toBeUndefined();
        expect(region.exits.every((e) => e.sub_region === undefined)).toBe(true);
        expect(atlas.vanilla_layout.start_sub_region).toBeUndefined();
        const result = validateRegionAtlas(atlas);
        expect(result.ok).toBe(true);
        // The one-entry warning is exactly what this avoids.
        expect(result.warnings.some((w) => /single sub_region/.test(w))).toBe(false);
    });

    it('restamps the identity, so a stale projection is visible downstream', () => {
        const atlas = makeAtlas();
        const before = atlas.atlas_id;
        applyRegionAnalysis(atlas, analyzeRoom(atlas));
        expect(atlas.atlas_id).not.toBe(before);
        expect(atlas.atlas_id.startsWith('toy-')).toBe(true);
        expect(validateRegionAtlas(atlas).ok).toBe(true);
    });

    it('is idempotent: re-analysing unchanged input reproduces the document', () => {
        const atlas = makeAtlas();
        applyRegionAnalysis(atlas, analyzeRoom(atlas));
        const first = JSON.stringify(atlas);
        applyRegionAnalysis(atlas, analyzeRoom(atlas));
        expect(JSON.stringify(atlas)).toBe(first);
    });
});

describe('re-analysis and hand-authored rows (ruling 2)', () => {
    it('replaces its own rows and keeps a hand-authored one byte-exact', () => {
        const atlas = makeAtlas();
        applyRegionAnalysis(atlas, analyzeRoom(atlas));
        const region = atlas.regions[0];
        const handWritten = {
            from: 'r0c2',
            to: 'r0c0',
            bidirectional: false,
            source: 'manual',
            access_rule: { rule: 'Has', args: { item_name: 'Secret Password' } },
        };
        region.subgraph.internal_exits.push(clone(handWritten));

        // Re-analyse against a grid whose gate has changed from 'a' to 'b'.
        const rerun = analyzeRegion(region, gridOf(['.=.']), OPTIONS);
        applyRegionAnalysis(atlas, rerun);

        const rows = atlas.regions[0].subgraph.internal_exits;
        expect(rows.filter((r) => r.source === 'analyzer')).toEqual([{
            from: 'r0c0',
            to: 'r0c2',
            bidirectional: true,
            source: 'analyzer',
            access_rule: { rule: 'Has', args: { item_name: 'b' } },
        }]);
        expect(rows.filter((r) => r.source === 'manual')).toEqual([handWritten]);
        expect(atlas.regions[0].annotations.rules_source).toBe('mixed');
        expect(validateRegionAtlas(atlas).ok).toBe(true);
    });

    it('does not grow a duplicate row each run for a crossing it cannot label', () => {
        // The analyzer writes its own unlabelled crossings as source:"manual",
        // so without the round-trip rule a second run preserves them AND emits
        // them again — one extra row per run, for ever.
        const atlas = makeAtlas();
        applyRegionAnalysis(atlas, analyzeRoom(atlas, ['.?.']));
        const first = JSON.stringify(atlas.regions[0].subgraph.internal_exits);
        expect(JSON.parse(first)).toEqual([
            { from: 'r0c0', to: 'r0c2', bidirectional: true, source: 'manual' },
        ]);
        applyRegionAnalysis(atlas, analyzeRoom(atlas, ['.?.']));
        expect(JSON.stringify(atlas.regions[0].subgraph.internal_exits)).toBe(first);
    });

    it('lets an authored rule stand instead of re-asking the question', () => {
        const atlas = makeAtlas();
        applyRegionAnalysis(atlas, analyzeRoom(atlas, ['.?.']));
        // The author labels the crossing the analyzer could not.
        atlas.regions[0].subgraph.internal_exits[0].access_rule = { rule: 'Has', args: { item_name: 'Crowbar' } };
        applyRegionAnalysis(atlas, analyzeRoom(atlas, ['.?.']));
        expect(atlas.regions[0].subgraph.internal_exits).toEqual([{
            from: 'r0c0',
            to: 'r0c2',
            bidirectional: true,
            source: 'manual',
            access_rule: { rule: 'Has', args: { item_name: 'Crowbar' } },
        }]);
    });

    it('remaps a hand-authored row onto renamed sub-regions via what they held', () => {
        const atlas = makeAtlas({
            subgraph: {
                sub_regions: ['west', 'east'],
                internal_exits: [{
                    from: 'west', to: 'east', bidirectional: false, access_rule: { rule: 'True_' },
                }],
            },
        });
        const region = atlas.regions[0];
        region.exits[0].sub_region = 'west';
        region.exits[1].sub_region = 'east';
        region.locations[0].sub_region = 'east';
        atlas.vanilla_layout.start_sub_region = 'west';

        applyRegionAnalysis(atlas, analyzeRoom(atlas));
        const rows = atlas.regions[0].subgraph.internal_exits;
        // The hand row survives, its endpoints moved to the components its
        // exits landed in.
        expect(rows.find((r) => r.source === 'manual')).toEqual({
            from: 'r0c0', to: 'r0c2', bidirectional: false, source: 'manual', access_rule: { rule: 'True_' },
        });
        expect(atlas.vanilla_layout.start_sub_region).toBe('r0c0');
        expect(validateRegionAtlas(atlas).ok).toBe(true);
    });

    it('reports a hand-authored row whose endpoint vanished instead of guessing', () => {
        const atlas = makeAtlas({
            subgraph: {
                sub_regions: ['west', 'attic'],
                internal_exits: [{ from: 'west', to: 'attic', bidirectional: true }],
            },
        });
        // 'attic' binds nothing, so nothing says where it went.
        atlas.regions[0].exits[0].sub_region = 'west';
        atlas.regions[0].exits[1].sub_region = 'west';
        atlas.regions[0].locations[0].sub_region = 'west';
        atlas.vanilla_layout.start_sub_region = 'west';

        const result = applyRegionAnalysis(atlas, analyzeRoom(atlas));
        expect(result.problems.map((p) => p.kind)).toContain('unmappable_manual_exit');
        expect(atlas.regions[0].subgraph.internal_exits.every((r) => r.source !== 'manual')).toBe(true);
        expect(validateRegionAtlas(atlas).ok).toBe(true);
    });

    it('reports a hand-authored row it had to drop because the split disappeared', () => {
        const atlas = makeAtlas({
            subgraph: {
                sub_regions: ['west', 'east'],
                internal_exits: [{ from: 'west', to: 'east', bidirectional: true, source: 'manual' }],
            },
        });
        atlas.regions[0].exits[0].sub_region = 'west';
        atlas.regions[0].exits[1].sub_region = 'east';
        atlas.regions[0].locations[0].sub_region = 'east';
        atlas.vanilla_layout.start_sub_region = 'west';

        const result = applyRegionAnalysis(atlas, analyzeRoom(atlas, ['...']));
        expect(result.problems.map((p) => p.kind)).toEqual(['dropped_manual_exit']);
        expect(atlas.regions[0].subgraph).toBeUndefined();
    });
});

// --- real data ---------------------------------------------------------------

describe('the real Seedling map', () => {
    const deps = { mapDoc: MAP, gameConfig: GAME_CONFIG };

    it('has an engine binding that explains every flag it uses', () => {
        expect(seedlingAnalyzerOptions(GAME_CONFIG).unresolved).toEqual([]);
    });

    it('analyzes all three starter regions without error', () => {
        for (const region of STARTER.regions) {
            const analysis = analyzeSeedlingRegion(clone(STARTER), region.region_id, deps);
            expect(analysis.skipped, region.region_id).toBeUndefined();
            expect(analysis.unclassified, region.region_id).toEqual([]);
            expect(analysis.components.length, region.region_id).toBeGreaterThan(0);
        }
    });

    it('finds the starting house is one room — a no-split result, asserted not skipped', () => {
        const analysis = analyzeSeedlingRegion(clone(STARTER), 'starting_house', deps);
        expect(analysis.split).toBe(false);
        expect(analysis.components).toHaveLength(1);
        expect(analysis.internal_exits).toEqual([]);
        // And applying it leaves the region exactly as the author wrote it.
        const atlas = clone(STARTER);
        const before = JSON.stringify(atlas.regions.find((r) => r.region_id === 'starting_house'));
        applySeedlingRegionAnalysis(atlas, analyzeSeedlingRegion(atlas, 'starting_house', deps));
        expect(JSON.stringify(atlas.regions.find((r) => r.region_id === 'starting_house'))).toBe(before);
    });

    it('refuses a region id that is not in the atlas, and skips one with no map_ref', () => {
        expect(() => analyzeSeedlingRegion(clone(STARTER), 'atlantis', deps)).toThrow(/has no region/);
        const atlas = clone(STARTER);
        delete atlas.regions[0].map_ref;
        expect(analyzeSeedlingRegion(atlas, atlas.regions[0].region_id, deps).skipped).toMatch(/graph-only/);
    });

    it('classifies every cell of every level the extract holds', () => {
        // The same guard the census suite runs, from the analyzer's side: a
        // level with an unclassified cell would silently become open ground.
        const atlas = clone(STARTER);
        const region = atlas.regions[0];
        const gaps = [];
        for (const level of MAP.levels) {
            region.map_ref = level.level;
            region.bounds = { x: 0, y: 0, w: level.width, h: level.height };
            region.exits = [];
            region.locations = [];
            const analysis = analyzeSeedlingRegion(atlas, region.region_id, deps);
            for (const u of analysis.unclassified) gaps.push(`level ${level.level}: ${u.what}`);
            for (const o of analysis.overflow) gaps.push(`level ${level.level}: condition overflow at ${o}`);
        }
        expect(gaps).toEqual([]);
    });

    it('produces only rules whose items the game config knows', () => {
        const known = new Set(GAME_CONFIG.ap_items.map((i) => i.ap_name));
        const atlas = clone(STARTER);
        const region = atlas.regions[0];
        const unknown = new Set();
        const walk = (rule) => {
            if (!rule || typeof rule !== 'object') return;
            if (rule.rule === 'Has' && !known.has(rule.args?.item_name)) unknown.add(rule.args?.item_name);
            for (const child of rule.children ?? []) walk(child);
        };
        for (const level of MAP.levels) {
            region.map_ref = level.level;
            region.bounds = { x: 0, y: 0, w: level.width, h: level.height };
            region.exits = [];
            region.locations = [];
            for (const row of analyzeSeedlingRegion(atlas, region.region_id, deps).internal_exits) {
                walk(row.access_rule);
            }
        }
        expect([...unknown]).toEqual([]);
    });
});
