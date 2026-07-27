// Region-atlas sphere-growth POOL document (region-atlas Phase 6).
//
// Two strata, the discipline the rest of this arc uses:
//   - hand-built entries in a made-up game, which pin the vocabulary fence and
//     the entrance arithmetic without depending on Seedling at all; and
//   - the COMMITTED pool built from the real starter atlas, where the numbers
//     are the map's and a semantics-table change shows up here as a red test
//     rather than as a silently different world.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
    ATLAS_POOL_SCHEMA_VERSION,
    atlasSourceId, isAtlasSourceId, atlasSourceGame,
    conjunctiveHasTerms, entryRequirement,
    buildAtlasPool, validateAtlasPool, stampPoolIdentity, computePoolContentHash,
} from './regionAtlasPool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const POOL_FILE = path.join(REPO, 'frontend/atlas-pools/seedling-atlas-pool.json');

const has = (item, count) => ({ rule: 'Has', args: { item_name: item, ...(count ? { count } : {}) } });

describe('atlas source ids', () => {
    it('round-trips a game through the source id', () => {
        expect(atlasSourceId('seedling')).toBe('atlas:seedling');
        expect(isAtlasSourceId('atlas:seedling')).toBe(true);
        expect(atlasSourceGame('atlas:seedling')).toBe('seedling');
    });

    it('does not claim library ids or plain substrates', () => {
        expect(isAtlasSourceId('library:demo')).toBe(false);
        expect(isAtlasSourceId('maze')).toBe(false);
        expect(atlasSourceGame('maze')).toBe(null);
    });
});

describe('conjunctiveHasTerms — the v1 gate vocabulary', () => {
    it('treats no rule and True_ as free', () => {
        expect(conjunctiveHasTerms(null)).toEqual([]);
        expect(conjunctiveHasTerms({ rule: 'True_' })).toEqual([]);
    });

    it('accepts a single-instance Has', () => {
        expect(conjunctiveHasTerms(has('Feather'))).toEqual(['Feather']);
        expect(conjunctiveHasTerms(has('Feather', 1))).toEqual(['Feather']);
    });

    it('accepts a conjunction and de-duplicates it', () => {
        const rule = { rule: 'And', children: [has('Feather'), has('Wand'), has('Feather')] };
        expect(conjunctiveHasTerms(rule)).toEqual(['Feather', 'Wand']);
    });

    it('flattens nested conjunctions', () => {
        const rule = {
            rule: 'And',
            children: [has('A'), { rule: 'And', children: [has('B'), has('C')] }],
        };
        expect(conjunctiveHasTerms(rule)).toEqual(['A', 'B', 'C']);
    });

    it('REJECTS a disjunction — the sphere gate has no encoding for it', () => {
        expect(conjunctiveHasTerms({ rule: 'Or', children: [has('Wand'), has('Fire Wand')] }))
            .toBeNull();
    });

    it('REJECTS a count gate, and rejects it inside a conjunction too', () => {
        expect(conjunctiveHasTerms(has('Progressive Swim', 2))).toBeNull();
        expect(conjunctiveHasTerms({
            rule: 'And', children: [has('Feather'), has('Progressive Swim', 2)],
        })).toBeNull();
    });

    it('rejects anything else rather than guessing', () => {
        expect(conjunctiveHasTerms({ rule: 'False_' })).toBeNull();
        expect(conjunctiveHasTerms({ rule: 'Compare', args: {} })).toBeNull();
        expect(conjunctiveHasTerms('Has(x)')).toBeNull();
    });
});

describe('entryRequirement — which way in, and what it costs', () => {
    const entry = (entrances) => ({ entry_id: 'e', entrances });

    it('is free when any entrance is', () => {
        const req = entryRequirement(entry([
            { via: 'b', access_rule: has('Feather') },
            { via: 'a', access_rule: null },
        ]));
        expect(req.gate).toEqual([]);
        expect(req.via).toBe('a');
        expect(req.declined).toBeNull();
    });

    it('takes the CHEAPEST expressible entrance, not the first', () => {
        const req = entryRequirement(entry([
            { via: 'a', access_rule: { rule: 'And', children: [has('X'), has('Y')] } },
            { via: 'b', access_rule: has('Z') },
        ]));
        expect(req.gate).toEqual(['Z']);
        expect(req.via).toBe('b');
    });

    it('skips an out-of-vocabulary entrance but keeps an expressible one', () => {
        const req = entryRequirement(entry([
            { via: 'a', access_rule: { rule: 'Or', children: [has('X'), has('Y')] } },
            { via: 'b', access_rule: has('Z') },
        ]));
        expect(req.gate).toEqual(['Z']);
    });

    it('DECLINES when every way in is out of vocabulary, and says which', () => {
        const req = entryRequirement(entry([
            { via: 'a', access_rule: { rule: 'Or', children: [has('X'), has('Y')] } },
        ]));
        expect(req.gate).toBeNull();
        expect(req.declined).toContain('a');
        expect(req.declined).toContain('v1 gate vocabulary');
    });

    it('DECLINES a region with no projected way in', () => {
        const req = entryRequirement(entry([]));
        expect(req.gate).toBeNull();
        expect(req.declined).toBe('no projected way in');
    });

    it('breaks ties deterministically by entrance id', () => {
        const a = entryRequirement(entry([
            { via: 'zzz', access_rule: has('X') }, { via: 'aaa', access_rule: has('Y') },
        ]));
        const b = entryRequirement(entry([
            { via: 'aaa', access_rule: has('Y') }, { via: 'zzz', access_rule: has('X') },
        ]));
        expect(a.via).toBe('aaa');
        expect(b.via).toBe('aaa');
    });
});

// A minimal made-up game: one region split in two, joined by a gated crossing,
// plus a wired boundary door. Small enough to read, complete enough to exercise
// every branch of buildAtlasPool.
function toyAtlas() {
    return {
        schema_version: 1,
        atlas_id: 'toy-0000',
        game: 'toy',
        tile_space: { tile_size: 8, map_document: 'toy-map.json' },
        regions: [{
            region_id: 'cave',
            bounds: { x: 0, y: 0, w: 4, h: 4 },
            exits: [{
                exit_id: 'front_door', kind: 'teleporter', sub_region: 'west',
                exit_tiles: [[0, 0]], entrance_tile: [0, 0],
                access_rule: { rule: 'Has', args: { item_name: 'Key' } },
            }],
            subgraph: {
                sub_regions: ['west', 'east'],
                internal_exits: [{
                    from: 'west', to: 'east', bidirectional: true, source: 'analyzer',
                    access_rule: { rule: 'Has', args: { item_name: 'Torch' } },
                }],
            },
            locations: [{ name: 'Cave - Chest', sub_region: 'east', tile: [3, 3] }],
        }],
        vanilla_layout: { start_region: 'cave', start_sub_region: 'west', connections: [] },
    };
}

function toyRules() {
    const world = (name, exits, items) => ({
        substrate: 'maze',
        playable_payload: {
            width: 4,
            height: 4,
            tiles: new Array(16).fill(0),
            entrance: { x: 0, y: 0 },
            exits,
            obstacles: [],
            items,
            obstacleLib: {},
            atlas_region: 'cave',
            atlas_sub_region: name,
        },
    });
    const ex = (id, atlasExitId, x, y) => ({
        exit_id: id, exitName: id, x, y, side: null, targetRegion: null,
        targetExitId: null, isTeleporter: false, atlas_exit_id: atlasExitId,
    });
    return {
        preset_sidecars: {
            1: {
                cave__west: world('west', [
                    ex('cave__west -> cave__east', 'cross_east', 1, 1),
                    ex('cave__west -> other', 'front_door', 0, 0),
                ], []),
                cave__east: world('east', [
                    ex('cave__east -> cave__west', 'cross_west', 2, 1),
                ], [{ x: 3, y: 3, id: 'Gem', locationName: 'Cave - Chest' }]),
            },
        },
    };
}

describe('buildAtlasPool', () => {
    it('makes one entry per projected sub-region, carrying the atlas binding', () => {
        const { pool } = buildAtlasPool(toyAtlas(), toyRules());
        expect(pool.schema_version).toBe(ATLAS_POOL_SCHEMA_VERSION);
        expect(pool.game).toBe('toy');
        expect(pool.flavor).toBe('maze');
        expect(pool.map_document).toBe('toy-map.json');
        expect(pool.entries.map((e) => e.entry_id)).toEqual(['cave__west', 'cave__east']);
        expect(pool.entries[0].atlas_region).toBe('cave');
        expect(pool.entries[0].atlas_sub_region).toBe('west');
        expect(pool.entries[1].location_slots).toBe(1);
        expect(pool.entries[1].locations).toEqual([{ name: 'Cave - Chest', vanilla_item: 'Gem' }]);
    });

    it('carries the ATLAS\'s own rule on each exit, never a re-derived one', () => {
        const { pool } = buildAtlasPool(toyAtlas(), toyRules());
        const west = pool.entries.find((e) => e.entry_id === 'cave__west');
        const crossing = west.exits.find((e) => e.kind === 'crossing');
        const boundary = west.exits.find((e) => e.kind === 'boundary');
        expect(crossing.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Torch' } });
        expect(crossing.to_sub_region).toBe('east');
        expect(boundary.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Key' } });
    });

    it('reads an INBOUND crossing\'s cost off the row that points at the region', () => {
        const { pool } = buildAtlasPool(toyAtlas(), toyRules());
        const east = pool.entries.find((e) => e.entry_id === 'cave__east');
        // east's only way in is west's crossing, which the bidirectional row prices
        // at the Torch — even though east itself has no boundary exit at all.
        expect(east.entrances).toHaveLength(1);
        expect(east.entrances[0].kind).toBe('crossing');
        expect(east.entrances[0].from_entry).toBe('cave__west');
        expect(entryRequirement(east).gate).toEqual(['Torch']);
    });

    it('prices an ASYMMETRIC crossing per direction', () => {
        const atlas = toyAtlas();
        atlas.regions[0].subgraph.internal_exits = [
            { from: 'west', to: 'east', bidirectional: false, source: 'analyzer', access_rule: null },
            {
                from: 'east', to: 'west', bidirectional: false, source: 'analyzer',
                access_rule: { rule: 'Has', args: { item_name: 'Feather' } },
            },
        ];
        const { pool } = buildAtlasPool(atlas, toyRules());
        const east = pool.entries.find((e) => e.entry_id === 'cave__east');
        const west = pool.entries.find((e) => e.entry_id === 'cave__west');
        // Falling down into east is free; the climb back into west costs a Feather.
        expect(entryRequirement(east).gate).toEqual([]);
        expect(west.entrances.find((e) => e.kind === 'crossing').access_rule)
            .toEqual({ rule: 'Has', args: { item_name: 'Feather' } });
    });

    it('stamps a content hash that changes when the content does', () => {
        const { pool } = buildAtlasPool(toyAtlas(), toyRules());
        expect(pool.pool_id).toMatch(/^toy-atlas-pool-[0-9a-f]{8}$/);
        expect(validateAtlasPool(pool).ok).toBe(true);
        pool.entries[0].location_slots = 99;
        expect(validateAtlasPool(pool).ok).toBe(false);
    });

    it('re-stamping is idempotent', () => {
        const { pool } = buildAtlasPool(toyAtlas(), toyRules());
        const first = pool.pool_id;
        stampPoolIdentity(pool);
        expect(pool.pool_id).toBe(first);
        expect(pool.provenance.content_hash).toBe(computePoolContentHash(pool));
    });

    it('refuses a rules.json with no maze sidecars', () => {
        expect(() => buildAtlasPool(toyAtlas(), {})).toThrow(/no preset_sidecars/);
    });

    it('refuses a sidecar naming a region the atlas does not have', () => {
        const rules = toyRules();
        rules.preset_sidecars[1].cave__west.playable_payload.atlas_region = 'nowhere';
        expect(() => buildAtlasPool(toyAtlas(), rules)).toThrow(/does not contain/);
    });
});

describe('validateAtlasPool', () => {
    const good = () => buildAtlasPool(toyAtlas(), toyRules()).pool;

    it('accepts the generated document', () => {
        const r = validateAtlasPool(good());
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
    });

    it('catches a payload/capability lie', () => {
        const pool = good();
        pool.entries[0].region_size = { width: 99, height: 99 };
        stampPoolIdentity(pool, 'toy-atlas-pool');
        expect(validateAtlasPool(pool).errors.join(' ')).toMatch(/region_size contradicts/);
    });

    it('catches an exit row the payload does not have', () => {
        const pool = good();
        pool.entries[0].exits.push({ exit_id: 'ghost', kind: 'boundary', access_rule: null });
        stampPoolIdentity(pool, 'toy-atlas-pool');
        expect(validateAtlasPool(pool).errors.join(' ')).toMatch(/not in the payload/);
    });

    it('PINS the exit-id invariant: a payload exit_id IS its exitName', () => {
        const pool = good();
        pool.entries[0].payload.exits[0].exitName = 'something_else';
        stampPoolIdentity(pool, 'toy-atlas-pool');
        expect(validateAtlasPool(pool).errors.join(' '))
            .toMatch(/exit_id IS its exitName/);
    });

    it('warns rather than errors about an entry nothing points at', () => {
        const pool = good();
        pool.entries[1].entrances = [];
        stampPoolIdentity(pool, 'toy-atlas-pool');
        const r = validateAtlasPool(pool);
        expect(r.ok).toBe(true);
        expect(r.warnings.join(' ')).toMatch(/no way in/);
    });
});

describe('the COMMITTED Seedling pool', () => {
    const pool = JSON.parse(readFileSync(POOL_FILE, 'utf8'));

    it('validates', () => {
        const r = validateAtlasPool(pool);
        expect(r.errors).toEqual([]);
    });

    it('is one entry per AP sub-region of the starter atlas', () => {
        expect(pool.game).toBe('seedling');
        expect(pool.entries.map((e) => e.entry_id)).toEqual([
            'overworld_start__r1c6',
            'overworld_start__r2c13',
            'overworld_start__r4c16',
            'overworld_start__r8c0',
            'overworld_start__r11c19',
            'overworld_start__r14c0',
            'starting_house',
            'owls_nest_entrance',
            'dungeon1_room1__r0c4',
            'dungeon1_room1__r8c6',
        ]);
    });

    it('reproduces the real map\'s requirement census', () => {
        const census = Object.fromEntries(pool.entries.map((e) => {
            const req = entryRequirement(e);
            return [e.entry_id, req.declined ? 'DECLINED' : req.gate.join('+') || 'FREE'];
        }));
        expect(census).toEqual({
            // Reachable only across a "Sword OR Ghost Spear" crossing — a
            // disjunction, which the v1 gate vocabulary cannot carry.
            overworld_start__r1c6: 'DECLINED',
            overworld_start__r11c19: 'DECLINED',
            dungeon1_room1__r8c6: 'DECLINED',
            // Across water: a single-instance Has, which it can.
            overworld_start__r2c13: 'Progressive Swim',
            overworld_start__r4c16: 'Progressive Swim',
            overworld_start__r14c0: 'Progressive Swim',
            // Doors and stairs the map charges nothing for.
            overworld_start__r8c0: 'FREE',
            starting_house: 'FREE',
            owls_nest_entrance: 'FREE',
            dungeon1_room1__r0c4: 'FREE',
        });
    });

    it('offers exactly the locations the map was marked with', () => {
        const slots = pool.entries.filter((e) => e.location_slots > 0);
        expect(slots).toHaveLength(1);
        expect(slots[0].entry_id).toBe('starting_house');
        expect(slots[0].locations).toEqual([
            { name: 'Starting House - Chest', vanilla_item: 'Seal' },
        ]);
    });

    it('has a region with MORE exits than a sphere cell has sides', () => {
        // The case the placement path has to prune: the overworld start has six
        // ways out and a grid cell has four sides.
        const start = pool.entries.find((e) => e.entry_id === 'overworld_start__r8c0');
        expect(start.exits.length).toBe(6);
    });
});
