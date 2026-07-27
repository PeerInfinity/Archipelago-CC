// The maze substrate's REGION-ATLAS instantiate hook (region-atlas Phase 6).
//
// Where the library hook fills a sides-only or a requirement-targeted slot with
// interchangeable synthetic geometry, this one places a piece of a real game
// map. The three things that makes different are what the tests are about:
// rules ride IN (authored) rather than coming back out of the geometry, surplus
// exits are PRUNED rather than walled off, and locations keep their game names.
//
// Two strata: a hand-built toy payload (which also proves the hook knows nothing
// about Seedling) and the COMMITTED Seedling pool.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import './mazeRoomLibrary.js'; // registers maze (side effect on import)

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const POOL_FILE = path.join(REPO, 'frontend/atlas-pools/seedling-atlas-pool.json');

const maze = substrateRegistry.get('maze');
const has = (item) => ({ rule: 'Has', args: { item_name: item } });

// A 5x3 corridor, all floor, with three exits along it and one item slot.
function toyEntry(overrides = {}) {
    const exit = (id, x, y) => ({
        exit_id: id, exitName: id, x, y, side: null,
        targetRegion: 'somewhere', targetExitId: 'back', isTeleporter: true,
    });
    return {
        entry_id: 'toy__room',
        atlas_region: 'toy',
        atlas_sub_region: 'room',
        substrate: 'maze',
        region_size: { width: 5, height: 3 },
        location_slots: 1,
        exits: [],
        entrances: [],
        payload: {
            width: 5,
            height: 3,
            tiles: new Array(15).fill(0),
            entrance: { x: 2, y: 1 },
            exits: [exit('north_door', 0, 0), exit('south_door', 4, 2), exit('side_door', 4, 0)],
            obstacles: [],
            items: [{ x: 2, y: 2, id: 'Seal', locationName: 'Toy Room - Chest' }],
            obstacleLib: {},
            ...overrides,
        },
    };
}

const call = (entry, ctx) => maze.instantiateAtlasEntryForSpecs(entry, ctx);

describe('instantiateAtlasEntryForSpecs — exits', () => {
    it('prunes every exit when the slot is a LEAF, and reports each one', () => {
        const { region, notes } = call(toyEntry(), {
            region_id: 'region_2_2', exitSides: ['N'], exitRules: {}, locationSpecs: [],
        });
        expect([...region.exits.keys()]).toEqual([]);
        expect(region.exits_placed).toEqual([]);
        expect(notes.filter((n) => n.kind === 'pruned_exit').map((n) => n.exit_id))
            .toEqual(['north_door', 'south_door', 'side_door']);
    });

    it('keeps a pruned exit\'s GEOMETRY — the hole stays, it is just not a route', () => {
        const { region } = call(toyEntry(), {
            region_id: 'r', exitSides: ['N'], exitRules: {}, locationSpecs: [],
        });
        const w = region.playable_payload;
        // the pruned exits' tiles are still walkable floor
        expect(w.tiles[0 * 5 + 0]).toBe(0);
        expect(w.tiles[2 * 5 + 4]).toBe(0);
    });

    it('relabels exits onto the child sides it is given, in payload order', () => {
        const { region } = call(toyEntry(), {
            region_id: 'r', exitSides: ['N', 'E', 'S'], exitRules: {}, locationSpecs: [],
        });
        expect(region.exits_placed).toEqual([
            { exit_id: 'north_door', side: 'E', tile_position: { x: 0, y: 0 } },
            { exit_id: 'south_door', side: 'S', tile_position: { x: 4, y: 2 } },
        ]);
        // The entrance side takes NO atlas exit — the driver's back-portal serves it.
        expect([...region.exits.keys()]).toEqual(['north_door', 'south_door']);
    });

    it('resets the captured stitching identity so the driver owns routing', () => {
        const { region } = call(toyEntry(), {
            region_id: 'r', exitSides: ['N', 'E'], exitRules: {}, locationSpecs: [],
        });
        const ex = region.exits.get('north_door');
        expect(ex.targetRegion).toBeNull();
        expect(ex.targetExitId).toBeNull();
        expect(ex.isTeleporter).toBe(false);
        expect(ex.exitName).toBe('north_door');
    });

    it('throws when the slot needs more sides than the map has ways out', () => {
        expect(() => call(toyEntry(), {
            region_id: 'r', exitSides: ['N', 'E', 'S', 'W'], exitRules: {}, locationSpecs: [],
        })).not.toThrow(); // 3 exits, 3 child sides — exactly enough
        const entry = toyEntry();
        entry.payload.exits = entry.payload.exits.slice(0, 1);
        expect(() => call(entry, {
            region_id: 'r', exitSides: ['N', 'E', 'S'], exitRules: {}, locationSpecs: [],
        })).toThrow(/offers 1 exit\(s\) but the slot needs 2 child side\(s\)/);
    });

    it('PINS the exit-id invariant: a payload exitName that is not its exit_id throws', () => {
        // The Phase-5b defect this guards: procgenPlayer resolves an arrival via
        // exits.get(exitName), so a divergence sends every arrival to the
        // entrance tile instead of the crossing the player walked through.
        const entry = toyEntry();
        entry.payload.exits[0].exitName = 'exit_1';
        expect(() => call(entry, {
            region_id: 'r', exitSides: ['N'], exitRules: {}, locationSpecs: [],
        })).toThrow(/exit_id IS\s+its exitName/);
    });
});

describe('instantiateAtlasEntryForSpecs — authored rules', () => {
    it('stamps the atlas\'s rule onto the retained exit, verbatim', () => {
        const { region } = call(toyEntry(), {
            region_id: 'r',
            exitSides: ['N', 'E'],
            exitRules: { north_door: has('Torch') },
            locationSpecs: [],
        });
        const ex = region.extracted_rules.exits.find((e) => e.id === 'north_door');
        expect(ex.access_rule).toEqual(has('Torch'));
    });

    it('leaves an unruled exit to the ordinary path-walked derivation', () => {
        const { region } = call(toyEntry(), {
            region_id: 'r', exitSides: ['N', 'E'], exitRules: {}, locationSpecs: [],
        });
        const ex = region.extracted_rules.exits.find((e) => e.id === 'north_door');
        expect(ex.access_rule).toBeUndefined();
        expect(ex.paths.length).toBeGreaterThan(0);
    });
});

describe('instantiateAtlasEntryForSpecs — locations', () => {
    it('keeps the atlas\'s location NAME and takes the engine\'s item', () => {
        const { region } = call(toyEntry(), {
            region_id: 'region_2_2',
            exitSides: ['N'],
            exitRules: {},
            locationSpecs: [{ item: 'key_red' }],
        });
        expect(region.extracted_rules.locations).toHaveLength(1);
        const loc = region.extracted_rules.locations[0];
        expect(loc.global_name).toBe('Toy Room - Chest');
        expect(loc.id).toBe('region_2_2__slot_0');
        expect(loc.item).toBe('key_red');
        // the world renders what the fill put there, not the vanilla item
        expect(region.playable_payload.items.get('2,2')).toBe('key_red');
    });

    it('stamps the engine filler on a slot the node has no item for', () => {
        const { region } = call(toyEntry(), {
            region_id: 'r', exitSides: ['N'], exitRules: {}, locationSpecs: [], fillerItem: 'F',
        });
        expect(region.extracted_rules.locations[0].item).toBe('F');
    });

    it('throws — actionably — when the map has fewer slots than the node needs', () => {
        expect(() => call(toyEntry(), {
            region_id: 'r',
            exitSides: ['N'],
            exitRules: {},
            locationSpecs: [{ item: 'a' }, { item: 'b' }],
        })).toThrow(/1 location slot\(s\) but the node needs 2/);
    });

    it('reports a slot the atlas never named rather than silently generating one', () => {
        const entry = toyEntry();
        entry.payload.items[0].locationName = null;
        const { notes } = call(entry, {
            region_id: 'r', exitSides: ['N'], exitRules: {}, locationSpecs: [],
        });
        expect(notes.some((n) => n.kind === 'unnamed_slot')).toBe(true);
    });
});

describe('the COMMITTED Seedling pool, through the hook', () => {
    const pool = JSON.parse(readFileSync(POOL_FILE, 'utf8'));
    const entryFor = (id) => pool.entries.find((e) => e.entry_id === id);

    it('places the six-exit overworld start as a leaf, naming all six prunes', () => {
        const entry = entryFor('overworld_start__r8c0');
        const { region, notes } = call(entry, {
            region_id: entry.entry_id, exitSides: ['S'], exitRules: {}, locationSpecs: [],
        });
        expect(notes.filter((n) => n.kind === 'pruned_exit')).toHaveLength(6);
        expect([...region.exits.keys()]).toEqual([]);
        // The real geometry survives: 109 floor tiles is what Phase 5b measured.
        expect(region.playable_payload.tiles.filter((t) => t === 0)).toHaveLength(109);
    });

    it('spawns on a walkable tile — the projection\'s own entrance', () => {
        for (const entry of pool.entries) {
            const { region } = call(entry, {
                region_id: entry.entry_id, exitSides: ['N'], exitRules: {}, locationSpecs: [],
            });
            const w = region.playable_payload;
            expect(w.tiles[w.entrance.y * w.width + w.entrance.x]).toBe(0);
        }
    });

    it('carries the map\'s own rule gates through as obstacles', () => {
        const entry = entryFor('overworld_start__r2c13');
        const { region } = call(entry, {
            region_id: entry.entry_id, exitSides: ['N'], exitRules: {}, locationSpecs: [],
        });
        const lib = region.playable_payload.obstacleLib;
        const ids = [...region.playable_payload.obstacles.values()];
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) expect(lib[id].clear_set_type).toBe('rule');
    });

    it('gives the starting house its Seedling location name', () => {
        const entry = entryFor('starting_house');
        const { region } = call(entry, {
            region_id: 'region_1_1', exitSides: ['N'], exitRules: {},
            locationSpecs: [{ item: 'victory' }],
        });
        expect(region.extracted_rules.locations[0].global_name)
            .toBe('Starting House - Chest');
    });
});
