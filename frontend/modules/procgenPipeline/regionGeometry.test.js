/**
 * procgenPipeline/regionGeometry — **THE ENGINE MINTS EXIT TILES BY THE
 * DECLARATION, AND A NEIGHBOUR MIRRORS THE TILE IT ALWAYS DID** (PRESET
 * SIDECARS slice G0).
 *
 * A registry entry's `regionGeometry` (`procgenCore/regionGeometry.js`) is
 * `'tiles'` (absent = the default) or `'sides'`. For a sides-only substrate the
 * engine writes no `exits[].x/y`, no `exits_placed[].tile_position`, no
 * `extracted_rules.exits[].position`; where a neighbour used to MIRROR such a
 * tile (a maze child's entrance, a reciprocal back-exit) it mirrors the
 * perimeter midpoint of that side instead — the tile the parent carried before.
 *
 * ⛔ THE POPULATIONS ARE SELECTED BY THE LAW, NOT BY A NAME: the first describe
 * iterates EVERY registered entry and derives its expectation from
 * `geometryOf`. The A/B rows below flip ONE entry's declaration through a
 * registry spy and compare the two worlds built from the same seed — so the
 * row asserts WHAT THE DECLARATION DOES, and "the maze bytes did not move" is
 * a structural diff, never a literal tile.
 *
 * ⛓ The libraries are `REGISTRY_LIBRARIES` (derived, never a literal list),
 * loaded at MODULE scope — a top-level `await` is module loading, which no hook
 * timeout applies to (`regionRoundTrip.test.js` measured the maze library
 * graph outrunning vitest's 10 s hook budget).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { mirrorTileAcrossSide } from '../shared/procgen/spatialPrimitives.js';
import {
    DEFAULT_REGION_SIZE, Grid, REGION_GEOMETRY, SIDES, arrangeShuffledSpiral,
    assembleZoneRegion, buildRulesJson, generateRegion, geometryOf, getRegionEntrance,
    getRegionExits, growSpheres, reconcileBidirectionalExits, topDownFromRulesJson,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';
import { GATEABLE_ITEMS } from '../bounceDemo/bounceDemoLibrary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const ENTRIES = substrateRegistry.getAll();
const SIDES_ONLY = ENTRIES.filter((e) => geometryOf(e) === REGION_GEOMETRY.SIDES);
const TILE_FIELDS = Object.freeze({
    exit: ['x', 'y'], placed: ['tile_position'], extracted: ['position'],
});
// A sides-only region stamps no ENTRANCE tile either (plan §19.3: no `entrance`).
const REGION_TILE_FIELDS = Object.freeze(['entrance']);

afterEach(() => vi.restoreAllMocks());

/**
 * Build with ONE entry's declaration replaced (`undefined` = removed). The
 * registry's entries are frozen, so the spy hands the engine a fresh COPY per
 * lookup (a copy per call re-reads any getter, e.g. `zoneCount`).
 */
function withGeometry(id, value, build) {
    const realGet = substrateRegistry.get.bind(substrateRegistry);
    const spy = vi.spyOn(substrateRegistry, 'get').mockImplementation((q) => {
        const entry = realGet(q);
        if (q !== id || !entry) return entry;
        const { regionGeometry: _declared, ...rest } = entry;
        return value === undefined ? rest : { ...rest, regionGeometry: value };
    });
    try {
        return build();
    } finally {
        spy.mockRestore();
    }
}

// The region fields a byte-identity dump reads (the dump-*.mjs harnesses' shape,
// except that an absent entrance stays ABSENT, so dropping one reads as a removal).
function dumpGrid(grid) {
    const out = {};
    for (const region of grid.allRegions()) {
        const exitMap = getRegionExits(region);
        const entrance = getRegionEntrance(region);
        out[region.region_id] = {
            substrate: region.substrate,
            extracted_rules: region.extracted_rules,
            exits_placed: region.exits_placed,
            placed_items: region.placed_items,
            payload: {
                ...(region.playable_payload ?? {}),
                exits: exitMap instanceof Map ? [...exitMap.values()] : (exitMap ?? []),
                ...(entrance ? { entrance } : {}),
            },
        };
    }
    return out;
}

// Every difference between two JSON values, as { kind, path } (path = key array).
function structuralDiff(a, b, path = [], out = []) {
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
        if (Array.isArray(a) && a.length !== b.length) {
            out.push({ kind: 'LENGTH', path });
            return out;
        }
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (!(k in b)) out.push({ kind: 'REMOVED', path: [...path, k] });
            else if (!(k in a)) out.push({ kind: 'ADDED', path: [...path, k] });
            else structuralDiff(a[k], b[k], [...path, k], out);
        }
        const common = (x, y) => Object.keys(x).filter((k) => k in y);
        if (common(a, b).join() !== common(b, a).join()) out.push({ kind: 'KEY_ORDER', path });
        return out;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ kind: 'CHANGED', path });
    return out;
}

/**
 * ⛓ THE A/B LAW, asserted on a whole world: `before` = the entry undeclared
 * (today's tiles), `after` = declared sides. Every difference must be the
 * REMOVAL of a tile field on a region of that substrate; the diff must not be
 * empty (a declaration that did nothing would pass everything else); and no
 * exit of such a region may keep a tile.
 */
function expectOnlyTileFieldsDropped(before, after, id) {
    const diffs = structuralDiff(before, after);
    expect(diffs.length, 'the declaration changed nothing').toBeGreaterThan(0);
    const tileKeys = new Set([...Object.values(TILE_FIELDS).flat(), ...REGION_TILE_FIELDS]);
    const regionsOf = (p) => (p[0] === 'grid' ? before.grid[p[1]] : null);
    for (const d of diffs) {
        expect(d.kind, d.path.join('/')).toBe('REMOVED');
        expect(tileKeys.has(d.path.at(-1)), d.path.join('/')).toBe(true);
        const region = regionsOf(d.path);
        if (region) expect(region.substrate, d.path.join('/')).toBe(id);
    }
    for (const region of Object.values(after.grid).filter((r) => r.substrate === id)) {
        for (const e of region.payload.exits) expect('x' in e || 'y' in e).toBe(false);
        for (const p of region.exits_placed) expect('tile_position' in p).toBe(false);
        for (const x of region.extracted_rules.exits) expect('position' in x).toBe(false);
        expect(region.payload.entrance).toBeUndefined();
    }
    return diffs;
}

describe('⛓⛓ the declaration decides whether assembleZoneRegion mints exit tiles', () => {
    const assemble = (substrate) => assembleZoneRegion({
        substrate, region_id: 'r', regionSize: DEFAULT_REGION_SIZE, exitSides: SIDES,
        zoneRules: null, zonePayload: {},
    });

    it('the population holds BOTH geometries — the rows below are not vacuous', () => {
        expect(SIDES_ONLY.length).toBeGreaterThan(0);
        expect(ENTRIES.length).toBeGreaterThan(SIDES_ONLY.length);
    });

    it.each(ENTRIES.map((e) => [e.id, geometryOf(e)]))('%s (%s): tiles on every exit iff the '
        + 'geometry is tiles', (id, geometry) => {
        const r = assemble(id);
        const tiles = geometry === REGION_GEOMETRY.TILES;
        for (const e of r.exits.values()) {
            expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(tiles);
            expect('x' in e || 'y' in e).toBe(tiles);
        }
        for (const p of r.exits_placed) expect('tile_position' in p).toBe(tiles);
        for (const x of r.extracted_rules.exits) expect('position' in x).toBe(tiles);
    });

    it.each(SIDES_ONLY.map((e) => [e.id]))('%s: declared sides drops EXACTLY the tile fields — the '
        + 'same region undeclared differs by nothing else', (id) => {
        const undeclared = withGeometry(id, undefined, () => assemble(id));
        const declared = assemble(id);
        const view = (r) => ({
            exits: [...r.exits.values()], exits_placed: r.exits_placed,
            extracted: r.extracted_rules.exits,
        });
        const diffs = structuralDiff(view(undeclared), view(declared));
        const tileKeys = new Set(Object.values(TILE_FIELDS).flat());
        expect(diffs.length).toBe(SIDES.length * Object.values(TILE_FIELDS).flat().length);
        for (const d of diffs) {
            expect(d.kind).toBe('REMOVED');
            expect(tileKeys.has(d.path.at(-1))).toBe(true);
        }
    });
});

describe('⛓⛓ the mirror fallback: a neighbour of a sides-only region mirrors the tile it '
    + 'always did', () => {
    it.each(SIDES_ONLY.map((e) => [e.id]))('%s parent → reciprocal back-exit on a tile region: '
        + 'mirrored off the tile the parent carried when undeclared', (id) => {
        const size = DEFAULT_REGION_SIZE;
        const build = () => {
            const grid = new Grid({ width: 2, height: 1 });
            const parent = assembleZoneRegion({
                substrate: id, region_id: 'region_0_0', regionSize: size, exitSides: ['E'],
                zoneRules: null, zonePayload: {},
            });
            parent.exits.get('exit_E').targetRegion = 'region_1_0';
            grid.placeRegion({ gx: 0, gy: 0 }, parent);
            grid.placeRegion({ gx: 1, gy: 0 }, {
                substrate: 'maze', region_id: 'region_1_0', exits: new Map(),
                extracted_rules: { region_id: 'region_1_0', exits: [], locations: [] },
                exits_placed: [],
            });
            reconcileBidirectionalExits(grid, size, 'add');
            return grid;
        };
        const carried = withGeometry(id, undefined, build).getRegion({ gx: 0, gy: 0 })
            .exits.get('exit_E');
        const grid = build();
        const back = grid.getRegion({ gx: 1, gy: 0 }).exits.get('region_0_0');
        const expected = mirrorTileAcrossSide({ x: carried.x, y: carried.y }, 'E', size);
        expect(Number.isFinite(carried.x)).toBe(true);
        expect({ x: back.x, y: back.y }).toEqual(expected);
        expect(grid.getRegion({ gx: 1, gy: 0 }).extracted_rules.exits[0].position).toEqual(expected);
        // …and the sides-only source itself still carries none.
        expect('x' in grid.getRegion({ gx: 0, gy: 0 }).exits.get('exit_E')).toBe(false);
    });

    it.each(SIDES_ONLY.map((e) => [e.id]))('%s: the sphere / top-down realiser CANNOT be handed '
        + 'this substrate today (no zone realiser) — the only live reach is the spiral', (id) => {
        expect(() => generateRegion({
            substrate: id, region_id: 'r', size: DEFAULT_REGION_SIZE, rng: { next: () => 0 },
            exits: [{ side: 'E' }], locations: [],
        })).toThrow(/neither generateRegionCore nor generateZoneForSpecs/);
    });

    // ⛓ So the SPHERE site (a maze child of a sides-only parent — and the throw
    // at a parent with no `exits_placed` on that side) is driven through a zone
    // substrate that HAS a realiser, declared sides by the spy. The world built
    // undeclared is today's; the maze regions must not move by one byte.
    it('sphere: bounce declared sides — no throw at a bounce PARENT of a maze child, and the world '
        + 'differs from the undeclared one ONLY by the tile fields dropped on bounce regions', () => {
        const pool = {
            'Right arrow': 1, 'Left arrow': 1, Springs: 1, key_red: 1, key_blue: 1, victory: 1,
        };
        const build = () => {
            const plan = planSpheres({
                itemPool: pool, sphereCount: 3, pins: { 'Right arrow': 1, 'Left arrow': 1 },
                victoryItem: 'victory', gateableItems: GATEABLE_ITEMS, seed: 4,
            });
            const { grid, startCell, tree } = growSpheres({
                regionSize: { width: 8, height: 6 }, seed: 4,
                growthParams: {
                    spherePlan: plan, substrateQuotas: { maze: 99, bounce: 1 },
                    startSubstrate: 'bounce', fillerCount: 1,
                },
            });
            return {
                grid: dumpGrid(grid),
                rulesJson: buildRulesJson(grid, { startCell, seed: 4, embedSphereLog: false }),
                mazeChildrenOfBounce: tree.nodes.filter((n) => n.parent != null
                    && n.substrate === 'maze' && tree.nodes[n.parent].substrate === 'bounce').length,
            };
        };
        const { mazeChildrenOfBounce: undeclaredPairs, ...before } = build();
        const { mazeChildrenOfBounce: pairs, ...after } = withGeometry('bounce', REGION_GEOMETRY.SIDES, build);
        // The case under test exists in this world: a maze child mirrors a bounce parent's exit.
        expect(pairs).toBeGreaterThan(0);
        expect(pairs).toBe(undeclaredPairs);
        expectOnlyTileFieldsDropped(before, after, 'bounce');
        const maze = (w) => Object.fromEntries(Object.entries(w.grid).filter(([, r]) => r.substrate === 'maze'));
        expect(maze(after)).toEqual(maze(before));
    });

    it('top-down: bounce declared sides — the BounceZone → End maze child is unmoved; the bounce '
        + 'region stamps no entrance and its back-exit no tile', () => {
        const source = {
            start_regions: { 1: { default: ['Menu'] } },
            assume_bidirectional_exits: true,
            game_name: 'G0TopDown',
            regions: {
                1: {
                    Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: { rule: 'True_' } }], locations: [] },
                    Hub: { name: 'Hub', exits: [{ name: 'enterBounce', connected_region: 'BounceZone', access_rule: { rule: 'True_' } }], locations: [] },
                    BounceZone: {
                        name: 'BounceZone',
                        exits: [{ name: 'toEnd', connected_region: 'End', access_rule: { rule: 'Has', args: { item_name: 'Blue platforms' } } }],
                        locations: [{ name: 'Bounce_Pickup', item: { name: 'Blue platforms' }, access_rule: { rule: 'True_' } }],
                    },
                    End: { name: 'End', exits: [], locations: [{ name: 'End_Goal', item: { name: 'Victory' } }] },
                },
            },
        };
        const build = () => {
            const res = topDownFromRulesJson(source, {
                gridDims: { width: 5, height: 5 }, seed: 1,
                substrateByRegion: { Menu: 'maze', Hub: 'maze', BounceZone: 'bounce', End: 'maze' },
                freeItems: ['Right arrow', 'Left arrow'],
            });
            return {
                grid: dumpGrid(res.grid),
                rulesJson: buildRulesJson(res.grid, {
                    startCell: res.startCell, seed: 1, embedSphereLog: false, assumeBidirectional: true,
                }),
            };
        };
        const before = build();
        const after = withGeometry('bounce', REGION_GEOMETRY.SIDES, build);
        const diffs = expectOnlyTileFieldsDropped(before, after, 'bounce');
        // The bounce region stamped an entrance tile undeclared, and none declared.
        expect(before.grid.BounceZone.payload.entrance).toBeDefined();
        expect(diffs.some((d) => d.path.join('/') === 'grid/BounceZone/payload/entrance')).toBe(true)
        expect(after.grid.End).toEqual(before.grid.End);
    });
});

describe('⛓ spiral (the jta/omsi path): a world with the declaration MASKED is today\'s — the '
    + 'declared world differs from it only by the dropped tile fields', () => {
    const PRESETS = {
        mixed: { seed: 1, quotas: { maze: 4, jta: 4 }, items: { key_red: 2, key_blue: 2 } },
        mixedS3: { seed: 3, quotas: { maze: 5, jta: 3 }, items: { key_red: 2, key_blue: 2, key_green: 1 } },
    };
    it.each(Object.entries(PRESETS))('%s', (_name, p) => {
        const build = () => {
            const { grid, stats, startCell } = arrangeShuffledSpiral({
                regionSize: { width: 8, height: 6 }, itemPool: { ...p.items }, obstaclePool: {},
                seed: p.seed, regionParams: {},
                growthParams: { substrateQuotas: p.quotas, startSubstrate: 'maze' },
                hazardOpts: null,
            });
            return {
                grid: dumpGrid(grid),
                rulesJson: buildRulesJson(grid, {
                    startCell, seed: p.seed, enableLoopMode: false, regionXpEffect: 'cost',
                    procgenMetadata: { driver: 'shuffled-spiral', stop_reason: stats.stopReason },
                }),
            };
        };
        const before = withGeometry('jta', undefined, build);
        const after = build();
        expectOnlyTileFieldsDropped(before, after, 'jta');
        const maze = (w) => Object.fromEntries(Object.entries(w.grid).filter(([, r]) => r.substrate !== 'jta'));
        expect(Object.keys(maze(after)).length).toBeGreaterThan(0);
        expect(maze(after)).toEqual(maze(before));
        // No compiled name, region or rule moved — only the sidecars' exit tiles.
        const { preset_sidecars: _a, ...restBefore } = before.rulesJson;
        const { preset_sidecars: _b, ...restAfter } = after.rulesJson;
        expect(restAfter).toEqual(restBefore);
    });
});
