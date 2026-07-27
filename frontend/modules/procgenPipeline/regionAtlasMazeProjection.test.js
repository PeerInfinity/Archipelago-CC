// Unit tests for the region-atlas → maze substrate projection
// (CC/docs/plans/region-atlas-plan.md, Phase 5b).
//
// Two independent strata, the same discipline the Phase-5a analyzer suite uses:
//
//   1. hand-built ASCII grids in a MADE-UP one-item game. They pin the geometry
//      rules (what becomes floor, what keeps its gate, what gets walled) and, by
//      knowing nothing about Seedling, prove the projection core is game-agnostic.
//   2. the real committed starter atlas, compiled through the real compiler and
//      then loaded through the REAL CONSUMER — mazeRoomEngine's
//      deserializeMazeWorld — so a payload that would not actually play is a red
//      test rather than a discovery at run time.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    deserializeMazeWorld,
    floorReachableSet,
    TILE_FLOOR,
    TILE_WALL,
} from '../mazeRoom/mazeRoomEngine.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import { seedlingMazeProjectionDeps } from '../flashPanel/seedlingAtlasAnalysis.js';
import { compileRegionAtlas } from './regionAtlasCompiler.js';
import {
    projectRegionToMaze,
    projectAtlasToMaze,
    formatMazeProjectionNotes,
    MAZE_TILE_FLOOR,
    MAZE_TILE_WALL,
    MAZE_SUBSTRATE,
    ATLAS_LOCATION_SLOT_ITEM,
} from './regionAtlasMazeProjection.js';

const read = (relative) => JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));

// ─── stratum 1: a made-up game ───────────────────────────────────────────────
//
// One item ("Master Key") behind one flag, one unexplainable blocker, one pit.
// Nothing in this half mentions Seedling.

const KEY = { flag: 'key' };
const MYSTERY = { flag: 'mystery' };
const HAS_KEY = { rule: 'Has', args: { item_name: 'Master Key' } };

const TOY = {
    conditionKey: (c) => (c.flag !== undefined ? `flag:${c.flag}` : JSON.stringify(c)),
    resolveCondition: (c) => (c.flag === 'key' ? HAS_KEY : null),
};

const CHARS = {
    '.': () => ({ kind: 'open' }),
    '#': () => ({ kind: 'wall', labels: ['bedrock'] }),
    K: () => ({ kind: 'gated', conditions: [KEY], labels: ['locked door'] }),
    '?': () => ({ kind: 'manual', manual: ['a puzzle nobody transcribed'] }),
    v: () => ({ kind: 'sink', labels: ['pit'] }),
    m: () => ({ kind: 'gated', conditions: [MYSTERY], labels: ['mystery mist'] }),
};

/**
 * Build an analyzer cell grid from ASCII rows. Mirrors the shape
 * buildSeedlingRegionGrid emits, so the projection cannot tell the difference.
 */
function gridFromAscii(rows, origin = { x: 0, y: 0 }) {
    const height = rows.length;
    const width = rows[0].length;
    const cells = [];
    for (const row of rows) {
        expect(row.length).toBe(width);
        for (const ch of row) {
            const make = CHARS[ch];
            if (!make) throw new Error(`gridFromAscii: no legend entry for "${ch}"`);
            cells.push({
                conditions: [], faces: {}, dirs: {}, manual: [], labels: [], ...make(),
            });
        }
    }
    return { width, height, cells, origin, unclassified: [], review: [], sinks: [] };
}

const noWiring = {
    wiredExit: () => undefined,
    internalExitName: () => null,
    tileSize: 16,
    ...TOY,
};

const project = (region, rows, ctx = {}) => projectRegionToMaze(
    region, gridFromAscii(rows), { ...noWiring, ...ctx },
);

const at = (payload, x, y) => payload.tiles[y * payload.width + x];
const exitOf = (payload, id) => payload.exits.find((e) => e.exit_id === id);
const obstacleAt = (payload, x, y) => payload.obstacles.find((o) => o.x === x && o.y === y);
const noteKinds = (notes) => notes.map((n) => n.kind);

// A corridor region: one cell, a locked door, then a two-cell room.
//   row 1:  . K . .   (x=4 is wall)
// Components anchor at (0,1) -> "r1c0" and (2,1) -> "r1c2".
const CORRIDOR_ROWS = [
    '#####',
    '.K..#',
    '#####',
];

const corridorRegion = (overrides = {}) => clone({
    region_id: 'vault',
    bounds: { x: 0, y: 0, w: 5, h: 3 },
    map_ref: 7,
    exits: [],
    locations: [],
    subgraph: {
        sub_regions: ['r1c0', 'r1c2'],
        internal_exits: [{
            from: 'r1c0', to: 'r1c2', bidirectional: true, source: 'analyzer', access_rule: HAS_KEY,
        }],
    },
    ...overrides,
});

describe('a sub-region becomes its own maze world', () => {
    const { sidecars } = project(corridorRegion(), CORRIDOR_ROWS);

    it('emits one sidecar per sub-region, bound to the maze substrate', () => {
        expect(Object.keys(sidecars)).toEqual(['vault__r1c0', 'vault__r1c2']);
        expect(sidecars.vault__r1c0.substrate).toBe(MAZE_SUBSTRATE);
    });

    it('uses the maze engine\'s own tile values', () => {
        expect(MAZE_TILE_FLOOR).toBe(TILE_FLOOR);
        expect(MAZE_TILE_WALL).toBe(TILE_WALL);
    });

    it('sizes the world to the atlas bounds, in region-LOCAL coordinates', () => {
        const p = sidecars.vault__r1c0.playable_payload;
        expect([p.width, p.height]).toEqual([5, 3]);
        expect(p.tiles.length).toBe(15);
        expect(p.origin).toEqual({ x: 0, y: 0 });
    });

    it('floors THIS sub-region and WALLS the others — a crossing is the only way out', () => {
        const p = sidecars.vault__r1c0.playable_payload;
        expect(at(p, 0, 1)).toBe(TILE_FLOOR); // own cell
        expect(at(p, 2, 1)).toBe(TILE_WALL); // the other sub-region
        expect(at(p, 3, 1)).toBe(TILE_WALL);
        expect(at(p, 0, 0)).toBe(TILE_WALL); // real wall
        const q = sidecars.vault__r1c2.playable_payload;
        expect(at(q, 2, 1)).toBe(TILE_FLOOR);
        expect(at(q, 0, 1)).toBe(TILE_WALL);
    });

    it('spawns at the sub-region\'s anchor tile', () => {
        expect(sidecars.vault__r1c0.playable_payload.entrance).toEqual({ x: 0, y: 1 });
        expect(sidecars.vault__r1c2.playable_payload.entrance).toEqual({ x: 2, y: 1 });
    });

    it('carries the atlas provenance the payload came from', () => {
        const p = sidecars.vault__r1c2.playable_payload;
        expect(p.atlas_region).toBe('vault');
        expect(p.atlas_sub_region).toBe('r1c2');
        expect(p.level).toBe(7);
        expect(p.tile_size).toBe(16);
    });
});

describe('a crossing', () => {
    const { sidecars, notes } = project(corridorRegion(), CORRIDOR_ROWS, {
        internalExitName: (region, from, to) => `${region}:${from}->${to}`,
    });
    const p = sidecars.vault__r1c0.playable_payload;
    const q = sidecars.vault__r1c2.playable_payload;

    it('opens the crossing material\'s first cell and puts the exit on it', () => {
        expect(at(p, 1, 1)).toBe(TILE_FLOOR);
        expect(exitOf(p, 'cross_r1c2')).toMatchObject({
            x: 1, y: 1, targetRegion: 'vault__r1c2', isTeleporter: false, side: null,
        });
    });

    it('gates it with a rule-typed obstacle carrying the ATLAS row\'s rule', () => {
        const id = obstacleAt(p, 1, 1).id;
        const def = p.obstacleLib[id];
        expect(def.clear_set_type).toBe('rule');
        expect(def.clear_rule).toEqual(HAS_KEY);
        // The real runtime clearance check is what has to agree.
        expect(isObstacleCleared(id, new Set(), p.obstacleLib)).toBe(false);
        expect(isObstacleCleared(id, new Set(['Master Key']), p.obstacleLib)).toBe(true);
    });

    it('takes the rule from the ATLAS, not from a recomputed analysis', () => {
        // Same terrain, but the atlas says the door needs a different item. The
        // atlas is the single source of truth for rules (two-truths, Phase 5b) —
        // it is where a hand-authored row lives, and the analyzer cannot write one.
        const HAND = { rule: 'Has', args: { item_name: 'Bolt Cutters' } };
        const region = corridorRegion();
        region.subgraph.internal_exits[0] = {
            from: 'r1c0', to: 'r1c2', bidirectional: true, source: 'manual', access_rule: HAND,
        };
        const only = project(region, CORRIDOR_ROWS).sidecars.vault__r1c0.playable_payload;
        expect(only.obstacleLib[obstacleAt(only, 1, 1).id].clear_rule).toEqual(HAND);
    });

    it('carries the AP exit NAME the graph minted — the registry keys exits on it', () => {
        expect(exitOf(p, 'cross_r1c2').exitName).toBe('vault:r1c0->r1c2');
        expect(exitOf(q, 'cross_r1c0').exitName).toBe('vault:r1c2->r1c0');
    });

    it('links both halves so arriving lands ON the crossing, not at the entrance', () => {
        expect(exitOf(p, 'cross_r1c2').targetExitId).toBe('cross_r1c0');
        expect(exitOf(q, 'cross_r1c0').targetExitId).toBe('cross_r1c2');
        // A symmetric one-cell gate is the SAME tile on both sides.
        expect([exitOf(q, 'cross_r1c0').x, exitOf(q, 'cross_r1c0').y]).toEqual([1, 1]);
        expect(notes.filter((n) => n.kind === 'one_way_arrival')).toEqual([]);
    });

    it('shares one obstacleLib entry between crossings with the same rule', () => {
        // Two doors, one key: the lib gets one entry, both tiles point at it.
        const rows = ['#####', '.K.K.', '#####'];
        const region = corridorRegion({
            subgraph: {
                sub_regions: ['r1c0', 'r1c2', 'r1c4'],
                internal_exits: [
                    { from: 'r1c0', to: 'r1c2', bidirectional: true, source: 'analyzer', access_rule: HAS_KEY },
                    { from: 'r1c2', to: 'r1c4', bidirectional: true, source: 'analyzer', access_rule: HAS_KEY },
                ],
            },
        });
        const mid = project(region, rows).sidecars.vault__r1c2.playable_payload;
        expect(Object.keys(mid.obstacleLib)).toHaveLength(1);
        expect(obstacleAt(mid, 1, 1).id).toBe(obstacleAt(mid, 3, 1).id);
    });
});

describe('a crossing the projection must NOT walk', () => {
    it('WALLS a row with no rule that the analyzer did not write, and says so', () => {
        // `?` is a blocker with no derivable rule: the analyzer emits the row as
        // source:"manual" with no access_rule, the compiler makes it a FREE AP
        // exit — and a free AP exit must never become a free WALK.
        const rows = ['#####', '.?..#', '#####'];
        const region = corridorRegion({
            subgraph: {
                sub_regions: ['r1c0', 'r1c2'],
                internal_exits: [{ from: 'r1c0', to: 'r1c2', bidirectional: true, source: 'manual' }],
            },
        });
        const { sidecars, notes } = project(region, rows);
        const p = sidecars.vault__r1c0.playable_payload;
        expect(p.exits).toEqual([]);
        expect(at(p, 1, 1)).toBe(TILE_WALL);
        expect(noteKinds(notes)).toEqual(['walled_unlabelled', 'walled_unlabelled']);
        expect(notes[0].message).toContain('must not become a free walk');
    });

    it('WALLS a row the tile map shows no route for', () => {
        const rows = ['#####', '.#..#', '#####'];
        const region = corridorRegion();
        const { sidecars, notes } = project(region, rows);
        expect(sidecars.vault__r1c0.playable_payload.exits).toEqual([]);
        expect(noteKinds(notes)).toContain('no_geometry');
    });

    it('opens a row the analyzer wrote with NO rule — that one is genuinely free', () => {
        // A one-way drop: free going down, nothing coming back. The analyzer
        // writes it source:"analyzer" with no rule.
        const rows = ['#####', '.?..#', '#####'];
        const region = corridorRegion({
            subgraph: {
                sub_regions: ['r1c0', 'r1c2'],
                internal_exits: [{ from: 'r1c0', to: 'r1c2', bidirectional: false, source: 'analyzer' }],
            },
        });
        const { sidecars, notes } = project(region, rows);
        const p = sidecars.vault__r1c0.playable_payload;
        expect(exitOf(p, 'cross_r1c2')).toMatchObject({ x: 1, y: 1 });
        expect(p.obstacles).toEqual([]);
        expect(Object.keys(p.obstacleLib)).toEqual([]);
    });

    it('a one-way crossing has no reverse to link, and reports the arrival fallback', () => {
        const rows = ['#####', '.?..#', '#####'];
        const region = corridorRegion({
            subgraph: {
                sub_regions: ['r1c0', 'r1c2'],
                internal_exits: [{ from: 'r1c0', to: 'r1c2', bidirectional: false, source: 'analyzer' }],
            },
        });
        const { sidecars, notes } = project(region, rows);
        expect(exitOf(sidecars.vault__r1c0.playable_payload, 'cross_r1c2').targetExitId).toBeNull();
        expect(sidecars.vault__r1c2.playable_payload.exits).toEqual([]);
        expect(noteKinds(notes)).toContain('one_way_arrival');
    });

    it('WALLS a pit that leaves the region and names it as a boundary-exit candidate', () => {
        const rows = ['#####', '.v..#', '#####'];
        const region = corridorRegion({
            subgraph: { sub_regions: ['r1c0', 'r1c2'], internal_exits: [] },
        });
        const { sidecars, notes } = project(region, rows);
        expect(at(sidecars.vault__r1c0.playable_payload, 1, 1)).toBe(TILE_WALL);
        expect(noteKinds(notes)).toContain('sink_walled');
    });
});

describe('a boundary exit', () => {
    const wired = {
        wiredExit: (regionId, exitId) => ({
            apExitName: `AP:${regionId}/${exitId}`,
            targetApRegion: 'somewhere_else',
            targetExitId: 'way_back',
        }),
    };

    it('places an exit tile at the atlas entrance_tile, carrying the AP name and target', () => {
        const region = corridorRegion({
            exits: [{
                exit_id: 'south_gate', kind: 'edge', side: 'S', exit_tiles: [[3, 1]], entrance_tile: [3, 1], sub_region: 'r1c2',
            }],
            subgraph: { sub_regions: ['r1c0', 'r1c2'], internal_exits: [] },
        });
        const p = project(region, CORRIDOR_ROWS, wired).sidecars.vault__r1c2.playable_payload;
        expect(exitOf(p, 'south_gate')).toEqual({
            exit_id: 'south_gate',
            x: 3,
            y: 1,
            side: 'S',
            exitName: 'AP:vault/south_gate',
            targetRegion: 'somewhere_else',
            targetExitId: 'way_back',
            isTeleporter: false,
        });
    });

    it('is OMITTED entirely when the vanilla layout does not wire it', () => {
        const region = corridorRegion({
            exits: [{
                exit_id: 'nowhere', kind: 'edge', side: 'S', exit_tiles: [[3, 1]], entrance_tile: [3, 1], sub_region: 'r1c2',
            }],
            subgraph: { sub_regions: ['r1c0', 'r1c2'], internal_exits: [] },
        });
        // Default ctx wires nothing.
        expect(project(region, CORRIDOR_ROWS).sidecars.vault__r1c2.playable_payload.exits).toEqual([]);
    });

    it('marks a teleporter kind so the panel can draw it as one', () => {
        const region = corridorRegion({
            exits: [{
                exit_id: 'stairs', kind: 'teleporter', exit_tiles: [[3, 1]], entrance_tile: [3, 1], sub_region: 'r1c2',
            }],
            subgraph: { sub_regions: ['r1c0', 'r1c2'], internal_exits: [] },
        });
        const p = project(region, CORRIDOR_ROWS, wired).sidecars.vault__r1c2.playable_payload;
        expect(exitOf(p, 'stairs')).toMatchObject({ isTeleporter: true, side: null });
    });

    it('collapses a multi-tile span to its entrance_tile, leaving the rest terrain', () => {
        // v1 fence: the maze crosses on ONE tile. The other span tiles stay what
        // the map says they are — here, ordinary floor of the sub-region.
        const region = corridorRegion({
            exits: [{
                exit_id: 'wide', kind: 'edge', side: 'S', exit_tiles: [[2, 1], [3, 1]], entrance_tile: [3, 1], sub_region: 'r1c2',
            }],
            subgraph: { sub_regions: ['r1c0', 'r1c2'], internal_exits: [] },
        });
        const p = project(region, CORRIDOR_ROWS, wired).sidecars.vault__r1c2.playable_payload;
        expect(p.exits.map((e) => [e.x, e.y])).toEqual([[3, 1]]);
        expect(at(p, 2, 1)).toBe(TILE_FLOOR);
    });

    it('gates an exit that carries its own access_rule', () => {
        const region = corridorRegion({
            exits: [{
                exit_id: 'toll', kind: 'edge', side: 'S', exit_tiles: [[3, 1]], entrance_tile: [3, 1], sub_region: 'r1c2', access_rule: HAS_KEY,
            }],
            subgraph: { sub_regions: ['r1c0', 'r1c2'], internal_exits: [] },
        });
        const p = project(region, CORRIDOR_ROWS, wired).sidecars.vault__r1c2.playable_payload;
        expect(p.obstacleLib[obstacleAt(p, 3, 1).id].clear_rule).toEqual(HAS_KEY);
    });
});

describe('opening a door the map draws on solid ground', () => {
    // A real game map puts its doors inside buildings and its stairs in walls;
    // Phase 5a already found four of seven starter-atlas exits sit on
    // non-walkable cells. The projection opens them and says what it did.
    const wired = {
        wiredExit: () => ({ apExitName: 'AP:door', targetApRegion: 'elsewhere', targetExitId: 'back' }),
    };

    it('opens a solid exit tile that is already adjacent, and reports it', () => {
        const rows = ['##X##', '#...#', '#####'].map((r) => r.replace('X', '#'));
        const region = corridorRegion({
            exits: [{ exit_id: 'door', kind: 'teleporter', exit_tiles: [[2, 0]], entrance_tile: [2, 0] }],
            subgraph: undefined,
        });
        delete region.subgraph;
        const { sidecars, notes } = project(region, rows, wired);
        const p = sidecars.vault.playable_payload;
        expect(at(p, 2, 0)).toBe(TILE_FLOOR);
        expect(exitOf(p, 'door')).toMatchObject({ x: 2, y: 0 });
        expect(noteKinds(notes)).toEqual(['opened_solid']);
        expect(notes[0].message).toContain('solid terrain (bedrock)');
    });

    it('carves a corridor when the exit tile is not adjacent to its sub-region', () => {
        // The door sits two manual (un-transcribed) cells from the room.
        const rows = ['##?##', '##?##', '#...#'];
        const region = corridorRegion({
            exits: [{ exit_id: 'door', kind: 'teleporter', exit_tiles: [[2, 0]], entrance_tile: [2, 0] }],
        });
        delete region.subgraph;
        const { sidecars, notes } = project(region, rows, wired);
        const p = sidecars.vault.playable_payload;
        expect(at(p, 2, 0)).toBe(TILE_FLOOR);
        expect(at(p, 2, 1)).toBe(TILE_FLOOR); // carved
        const carved = notes.find((n) => n.kind === 'carved');
        expect(carved.cells).toEqual([{ tile: [2, 1], kind: 'manual', gated: false, unresolved: 0 }]);
        expect(noteKinds(notes)).toContain('carved_through_manual');
        // The whole world stays connected — the door is walkable to.
        const world = deserializeMazeWorld(p);
        expect(floorReachableSet(world).has('2,0')).toBe(true);
    });

    it('KEEPS the gate on a carved cell — a carve must never under-gate', () => {
        // The only way to the door is through a locked cell. Opening it free
        // would hand the player a route the real game charges for.
        const rows = ['##K##', '#...#', '#####'];
        const region = corridorRegion({
            exits: [{ exit_id: 'door', kind: 'teleporter', exit_tiles: [[2, 0]], entrance_tile: [2, 0] }],
        });
        delete region.subgraph;
        const p = project(region, rows, wired).sidecars.vault.playable_payload;
        expect(at(p, 2, 0)).toBe(TILE_FLOOR);
        expect(p.obstacleLib[obstacleAt(p, 2, 0).id].clear_rule).toEqual(HAS_KEY);
    });

    it('reports a gate it opened WITHOUT a rule because no item backs it', () => {
        const rows = ['##m##', '#...#', '#####'];
        const region = corridorRegion({
            exits: [{ exit_id: 'door', kind: 'teleporter', exit_tiles: [[2, 0]], entrance_tile: [2, 0] }],
        });
        delete region.subgraph;
        const { sidecars, notes } = project(region, rows, wired);
        expect(obstacleAt(sidecars.vault.playable_payload, 2, 0)).toBeUndefined();
        expect(noteKinds(notes)).toContain('opened_unconditional');
    });

    it('reports an exit no corridor can reach without breaking a wall', () => {
        const rows = ['##?##', '#####', '#...#'];
        const region = corridorRegion({
            exits: [{ exit_id: 'door', kind: 'teleporter', exit_tiles: [[2, 0]], entrance_tile: [2, 0] }],
        });
        delete region.subgraph;
        const { notes } = project(region, rows, wired);
        expect(noteKinds(notes)).toContain('unreachable');
    });
});

describe('a location', () => {
    const locRegion = (loc) => {
        const region = corridorRegion({ locations: [loc] });
        delete region.subgraph;
        return region;
    };
    const ROOM = ['#####', '#...#', '#####'];

    it('becomes an item overlay carrying the AP location name', () => {
        const p = project(locRegion({ name: 'Vault - Chest', tile: [2, 1], vanilla_item: 'Ruby' }), ROOM)
            .sidecars.vault.playable_payload;
        expect(p.items).toEqual([{ x: 2, y: 1, id: 'Ruby', locationName: 'Vault - Chest' }]);
    });

    it('still gets an overlay when the atlas records no vanilla_item', () => {
        const p = project(locRegion({ name: 'Vault - Empty', tile: [2, 1] }), ROOM)
            .sidecars.vault.playable_payload;
        expect(p.items[0].id).toBe(ATLAS_LOCATION_SLOT_ITEM);
        expect(p.items[0].locationName).toBe('Vault - Empty');
    });

    it('is opened and carved to like an exit — a chest is solid in most games', () => {
        const rows = ['##?##', '##?##', '#...#'];
        const { sidecars, notes } = project(locRegion({ name: 'Vault - Chest', tile: [2, 0], vanilla_item: 'Ruby' }), rows);
        const p = sidecars.vault.playable_payload;
        expect(at(p, 2, 0)).toBe(TILE_FLOOR);
        expect(at(p, 2, 1)).toBe(TILE_FLOOR); // carved
        expect(notes.find((n) => n.kind === 'carved').label).toBe('location "Vault - Chest"');
        expect(floorReachableSet(deserializeMazeWorld(p)).has('2,0')).toBe(true);
    });

    it('carries its own access_rule as a gate on the pickup tile', () => {
        const p = project(locRegion({
            name: 'Vault - Chest', tile: [2, 1], vanilla_item: 'Ruby', access_rule: HAS_KEY,
        }), ROOM).sidecars.vault.playable_payload;
        expect(p.obstacleLib[obstacleAt(p, 2, 1).id].clear_rule).toEqual(HAS_KEY);
    });
});

describe('refusals and collisions', () => {
    it('refuses an atlas whose declared sub_regions disagree with the tile map', () => {
        const region = corridorRegion({
            subgraph: { sub_regions: ['upstairs', 'downstairs'], internal_exits: [] },
        });
        expect(() => project(region, CORRIDOR_ROWS)).toThrow(/stale against the map document/);
    });

    it('refuses a region that declares no subgraph but whose map splits in two', () => {
        const region = corridorRegion();
        delete region.subgraph;
        expect(() => project(region, CORRIDOR_ROWS)).toThrow(/declares no subgraph, but its tile map splits/);
    });

    it('drops a second exit that wants an already-taken tile, loudly', () => {
        // A boundary exit authored right on top of a crossing's entry cell.
        const region = corridorRegion({
            exits: [{
                exit_id: 'on_the_door', kind: 'teleporter', exit_tiles: [[1, 1]], entrance_tile: [1, 1], sub_region: 'r1c0',
            }],
        });
        const { sidecars, notes } = project(region, CORRIDOR_ROWS, {
            wiredExit: () => ({ apExitName: 'AP:x', targetApRegion: 'elsewhere', targetExitId: 'back' }),
        });
        const p = sidecars.vault__r1c0.playable_payload;
        expect(p.exits.map((e) => e.exit_id)).toEqual(['on_the_door']);
        expect(noteKinds(notes)).toContain('exit_tile_collision');
    });
});

describe('whole-atlas projection', () => {
    it('leaves a region with no map_ref graph-only, and NAMES it', () => {
        const graphOnly = { region_id: 'legend', bounds: { x: 0, y: 0, w: 2, h: 2 }, exits: [], locations: [] };
        const { sidecars, regions_without_map_ref: unbound } = projectAtlasToMaze(
            { regions: [graphOnly], tile_space: { tile_size: 16 } },
            { ...noWiring, gridFor: () => gridFromAscii(['..', '..']) },
        );
        expect(sidecars).toEqual({});
        expect(unbound).toEqual(['legend']);
    });

    it('formats its notes one per line, headlined by the severe kinds', () => {
        const lines = formatMazeProjectionNotes([
            { kind: 'walled_unlabelled', region_id: 'a', message: 'm1' },
            { kind: 'carved', region_id: 'a', sub_region: 's', message: 'm2' },
        ]);
        expect(lines[0]).toContain('1 walled_unlabelled');
        expect(lines[1]).toContain('[walled_unlabelled] a: m1');
        expect(lines[2]).toContain('[carved] a/s: m2');
    });
});

// ─── stratum 2: the real committed atlas, through the real consumer ──────────

const STARTER = read('../flashPanel/atlases/seedling.json');
const MAP_DOC = read('../flashPanel/atlases/seedling-map.json');
const GAME_CONFIG = read('../flashPanel/games/seedling.json');

const compileMaze = (atlas = STARTER) => compileRegionAtlas(clone(atlas), {
    mapDoc: MAP_DOC,
    sidecarFlavor: 'maze',
    mazeProjection: seedlingMazeProjectionDeps({ mapDoc: MAP_DOC, gameConfig: GAME_CONFIG }),
});

describe('the real Seedling starter atlas as a maze world', () => {
    const { rules, report } = compileMaze();
    const sidecars = rules.preset_sidecars['1'];
    const apRegions = rules.regions['1'];

    it('binds every AP region of every levelled atlas region', () => {
        // 10 AP regions (6 + 1 + 1 + 2 sub-regions), all four naming a level.
        expect(Object.keys(sidecars).sort()).toEqual(Object.keys(apRegions).filter((n) => n !== 'Menu').sort());
        expect(report.sidecar_flavor).toBe('maze');
        expect(report.regions_without_map_ref).toEqual([]);
    });

    it('boots NO original engine — the maze flavour carries no flash_panel wiring', () => {
        expect(rules.flash_panel).toBeUndefined();
        for (const sc of Object.values(sidecars)) expect(sc.substrate).toBe(MAZE_SUBSTRATE);
    });

    it('every payload loads through the REAL deserializeMazeWorld', () => {
        for (const [name, sc] of Object.entries(sidecars)) {
            const world = deserializeMazeWorld(sc.playable_payload);
            expect(world.width, name).toBe(sc.playable_payload.width);
            expect(world.exits.size, name).toBe(sc.playable_payload.exits.length);
            expect(world.tiles[world.entrance.y * world.width + world.entrance.x], name).toBe(TILE_FLOOR);
        }
    });

    it('every exit and item tile is floor, and walkable to from the spawn', () => {
        for (const [name, sc] of Object.entries(sidecars)) {
            const world = deserializeMazeWorld(sc.playable_payload);
            const reachable = floorReachableSet(world);
            for (const e of world.exits.values()) {
                expect(reachable.has(`${e.x},${e.y}`), `${name}/${e.exit_id}`).toBe(true);
            }
            for (const key of world.items.keys()) expect(reachable.has(key), `${name} item ${key}`).toBe(true);
        }
    });

    it('every exitName is a real AP exit of that AP region, and every target a real AP region', () => {
        for (const [name, sc] of Object.entries(sidecars)) {
            const names = new Set(apRegions[name].exits.map((e) => e.name));
            for (const e of sc.playable_payload.exits) {
                expect(names.has(e.exitName), `${name}/${e.exit_id} -> ${e.exitName}`).toBe(true);
                expect(apRegions[e.targetRegion], `${name}/${e.exit_id} -> ${e.targetRegion}`).toBeDefined();
            }
        }
    });

    it('every targetExitId resolves to an exit of the target payload, pointing back', () => {
        for (const [name, sc] of Object.entries(sidecars)) {
            for (const e of sc.playable_payload.exits) {
                if (!e.targetExitId) continue;
                const target = sidecars[e.targetRegion].playable_payload;
                const back = target.exits.find((t) => t.exit_id === e.targetExitId);
                expect(back, `${name}/${e.exit_id} -> ${e.targetRegion}/${e.targetExitId}`).toBeDefined();
                expect(back.targetRegion).toBe(name);
            }
        }
    });

    it('every obstacle id resolves in its own payload\'s obstacleLib', () => {
        for (const [name, sc] of Object.entries(sidecars)) {
            const p = sc.playable_payload;
            for (const o of p.obstacles) expect(p.obstacleLib[o.id], `${name} ${o.id}`).toBeDefined();
            for (const def of Object.values(p.obstacleLib)) {
                expect(def.clear_set_type).toBe('rule');
                expect(def.clear_rule).toBeTruthy();
            }
        }
    });

    it('gates the analyzer-computed crossings with the items the atlas names', () => {
        // The rock between the first dungeon room and its stairs down.
        const p = sidecars.dungeon1_room1__r0c4.playable_payload;
        const cross = p.exits.find((e) => e.exit_id === 'cross_r8c6');
        const def = p.obstacleLib[p.obstacles.find((o) => o.x === cross.x && o.y === cross.y).id];
        expect(isObstacleCleared(def.id, new Set(), p.obstacleLib)).toBe(false);
        expect(isObstacleCleared(def.id, new Set(['Progressive Sword']), p.obstacleLib)).toBe(true);
        expect(isObstacleCleared(def.id, new Set(['Ghost Spear']), p.obstacleLib)).toBe(true);
    });

    it('carries the one location the starter atlas records, with its AP name', () => {
        expect(sidecars.starting_house.playable_payload.items).toEqual([
            { x: 3, y: 1, id: 'Seal', locationName: 'Starting House - Chest' },
        ]);
        const names = new Set(rules.regions['1'].starting_house.locations.map((l) => l.name));
        expect(names.has('Starting House - Chest')).toBe(true);
    });

    it('WALLS the one crossing the analyzer could not label, in both directions', () => {
        const walled = report.maze_notes.filter((n) => n.kind === 'walled_unlabelled');
        expect(walled.map((n) => `${n.from}->${n.to}`)).toEqual(['r1c6->r8c0', 'r8c0->r1c6']);
        const p = sidecars.overworld_start__r1c6.playable_payload;
        expect(p.exits.map((e) => e.exit_id)).toEqual(['cross_r2c13']);
    });

    it('records every carve it made through the house walls', () => {
        const carved = report.maze_notes.filter((n) => n.kind === 'carved');
        expect(carved.map((n) => n.label)).toEqual(['exit "house_door"', 'exit "owls_nest_stairs"']);
        for (const n of carved) expect(n.cells.every((c) => c.kind === 'manual')).toBe(true);
    });

    it('the start sub-region can leave through both its wired doors, ungated', () => {
        const p = sidecars.overworld_start__r8c0.playable_payload;
        const ungated = p.exits.filter((e) => !p.obstacles.some((o) => o.x === e.x && o.y === e.y));
        expect(ungated.map((e) => e.exit_id).sort()).toEqual(['house_door', 'owls_nest_stairs']);
    });

    it('keeps each direction of an asymmetric crossing at its own cost', () => {
        // The waterfall/water column: one Progressive Swim down, two back up.
        const down = sidecars.overworld_start__r2c13.playable_payload;
        const up = sidecars.overworld_start__r8c0.playable_payload;
        const ruleAt = (p, id) => {
            const e = p.exits.find((x) => x.exit_id === id);
            return p.obstacleLib[p.obstacles.find((o) => o.x === e.x && o.y === e.y).id].clear_rule;
        };
        expect(ruleAt(down, 'cross_r8c0')).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
        expect(ruleAt(up, 'cross_r2c13')).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } });
    });

    it('compiles deterministically — the same atlas, the same bytes', () => {
        expect(JSON.stringify(compileMaze().rules)).toBe(JSON.stringify(compileMaze().rules));
    });

    it('projects the SAME graph as the flash flavour — only the sidecars differ', () => {
        const flash = compileRegionAtlas(clone(STARTER), { mapDoc: MAP_DOC });
        expect(rules.regions).toEqual(flash.rules.regions);
        expect(rules.items).toEqual(flash.rules.items);
        expect(rules.preset_sidecars).not.toEqual(flash.rules.preset_sidecars);
    });

    it('refuses the maze flavour without the game\'s grid + condition vocabulary', () => {
        expect(() => compileRegionAtlas(clone(STARTER), { mapDoc: MAP_DOC, sidecarFlavor: 'maze' }))
            .toThrow(/needs options\.mazeProjection/);
    });
});
