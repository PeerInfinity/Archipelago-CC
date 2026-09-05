/**
 * mazeSerializer — THE DIRECT rows for `serializeMazeWorld`.
 *
 * ⛓ APWORLD EDITOR HUB slice H3b. ⚠ MEASURED at the move: the function had NO
 * direct unit test. `procgenPipelineEngine.test.js`'s `buildPresetSidecars`
 * describe reaches it through the substrate registry — those 26 rows are about
 * the PIPELINE's sidecar assembly and stay there (the H3b brief expected 10 of
 * them to move; they drive `buildPresetSidecars`, which did not move, and §6's
 * own pin says the engine test's 203 rows are UNMOVED). What was missing is a
 * row that calls the serializer itself. These are those rows.
 *
 * The mutant this file must catch: drop `longestShortestPath` from the returned
 * payload — i.e. sever the ONE reason the function needed `mazeGeometry.js`,
 * which is the import that came with it out of the pipeline.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeMazeWorld } from './mazeSerializer.js';
import { createWorld, deserializeMazeWorld, setTile, TILE_FLOOR } from './mazeRoomEngine.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';

/**
 * A small OPEN room (every tile floor) with an entrance at (0,0), two named
 * exits, one obstacle and one item. Open so `computeLongestShortestPath` has a
 * path to find; small so the expected numbers can be reasoned about by hand.
 */
function room() {
    const world = createWorld(5, 3, {
        entrance: { x: 0, y: 0 },
        exits: [
            { exit_id: 'e_east', x: 4, y: 1, side: 'E', exitName: 'r1__E', targetRegion: 'r2' },
            { exit_id: 'e_south', x: 2, y: 2, side: 'S', targetExitId: 'e_north', isBackExit: true },
        ],
    });
    for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) setTile(world, x, y, TILE_FLOOR);
    world.obstacles.set('3,1', 'door_red');
    world.items.set('1,1', 'key_red');
    return world;
}

const EXTRACTED = {
    region_id: 'r1',
    locations: [{ id: 'key_red_pickup', position: { x: 1, y: 1 } }],
    exits: [{ id: 'r1__to__r2', target_region: 'r2' }],
};

describe('serializeMazeWorld — the payload shape', () => {
    it('flattens tiles / obstacles / items into JSON-safe shapes', () => {
        const p = serializeMazeWorld(room(), EXTRACTED);
        expect(p.width).toBe(5);
        expect(p.height).toBe(3);
        expect(Array.isArray(p.tiles)).toBe(true);
        expect(p.tiles).toHaveLength(15);
        expect(p.entrance).toEqual({ x: 0, y: 0 });
        expect(p.obstacles).toEqual([{ x: 3, y: 1, id: 'door_red' }]);
        expect(p.items).toEqual([{ x: 1, y: 1, id: 'key_red', locationName: 'r1__key_red_pickup__1_1' }]);
        // Nothing survives that JSON.stringify would drop or rewrite.
        expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    });

    it('bakes the AP-canonical locationName through makeLocationName', () => {
        const p = serializeMazeWorld(room(), EXTRACTED);
        expect(p.items[0].locationName).toBe(makeLocationName('r1', 'key_red_pickup', { x: 1, y: 1 }));
    });

    it('prefers an extracted global_name over the constructed one', () => {
        const p = serializeMazeWorld(room(), {
            ...EXTRACTED,
            locations: [{ id: 'key_red_pickup', position: { x: 1, y: 1 }, global_name: 'Chosen Name' }],
        });
        expect(p.items[0].locationName).toBe('Chosen Name');
    });

    it('leaves locationName null for an item with no matching extracted location', () => {
        const p = serializeMazeWorld(room(), { region_id: 'r1', locations: [], exits: [] });
        expect(p.items[0].locationName).toBeNull();
    });

    /**
     * ⛔ THE MUTANT ROW. `longestShortestPath` is the ONLY reason this module
     * imports `mazeGeometry.js` — the import that travelled with the function
     * out of `procgenPipelineEngine.js`. Drop the field (or the call) and this
     * reds; nothing else in this file would.
     */
    it('⛓ always carries longestShortestPath, computed over the tile grid', () => {
        const p = serializeMazeWorld(room(), EXTRACTED);
        expect(typeof p.longestShortestPath).toBe('number');
        // Entrance (0,0) → the further of the two exits, (4,1): 4 east + 1
        // south = 5 steps on an open 5x3 grid. (2,2) is 4 steps away.
        expect(p.longestShortestPath).toBe(5);
    });

    it('bakes exitName / targetRegion from the extracted exits, keeping the bidirectional metadata', () => {
        const p = serializeMazeWorld(room(), EXTRACTED);
        expect(p.exits).toHaveLength(2);
        const [east, south] = p.exits;
        expect(east).toMatchObject({ exit_id: 'e_east', x: 4, y: 1, side: 'E', exitName: 'r1__E', targetRegion: 'r2' });
        expect(south).toMatchObject({ exit_id: 'e_south', targetExitId: 'e_north', isBackExit: true, isTeleporter: false });
    });

    it('an extracted exit whose id matches wins over the world copy', () => {
        const world = room();
        const p = serializeMazeWorld(world, {
            ...EXTRACTED,
            exits: [{ id: 'e_east', target_region: 'r9' }],
        });
        expect(p.exits[0].exitName).toBe('e_east');
        expect(p.exits[0].targetRegion).toBe('r9');
    });
});

describe('serializeMazeWorld — the library extras', () => {
    it('carries only obstacleLib / itemLib entries the base library does not have', () => {
        const world = room();
        world.obstacleLib = { door_red: { id: 'door_red' }, logic_gate_7: { id: 'logic_gate_7' } };
        world.itemLib = { key_red: { id: 'key_red' }, foreign_thing: { id: 'foreign_thing' } };
        const p = serializeMazeWorld(world, EXTRACTED,
            { door_red: { id: 'door_red' } }, { key_red: { id: 'key_red' } });
        expect(Object.keys(p.obstacleLib)).toEqual(['logic_gate_7']);
        expect(Object.keys(p.itemLib)).toEqual(['foreign_thing']);
    });
});

describe('serializeMazeWorld — the OMITTED overlays (byte-identity discipline)', () => {
    it('omits hazards / consumableTiles / manaTiles ENTIRELY when empty', () => {
        const p = serializeMazeWorld(room(), EXTRACTED);
        expect('hazards' in p).toBe(false);
        expect('consumableTiles' in p).toBe(false);
        expect('manaTiles' in p).toBe(false);
    });

    it('serializes hazards stripped of runtime phase', () => {
        const world = room();
        world.hazards = [{ shape: 'line', length: 2, tiles: [{ x: 1, y: 0 }, { x: 2, y: 0 }], cycleLength: 4, phase: 3 }];
        const p = serializeMazeWorld(world, EXTRACTED);
        expect(p.hazards).toEqual([{ shape: 'line', length: 2, tiles: [{ x: 1, y: 0 }, { x: 2, y: 0 }], cycleLength: 4 }]);
        expect('phase' in p.hazards[0]).toBe(false);
    });

    it('serializes the X1 overlays as position-keyed arrays', () => {
        const world = room();
        world.consumableTiles.set('2,1', { substrate: 'omsi', type: 'mana', count: 2 });
        world.manaTiles.set('3,0', 7);
        const p = serializeMazeWorld(world, EXTRACTED);
        expect(p.consumableTiles).toEqual([{ x: 2, y: 1, substrate: 'omsi', type: 'mana', count: 2 }]);
        expect(p.manaTiles).toEqual([{ x: 3, y: 0, amount: 7 }]);
    });
});

describe('⛓ serializeMazeWorld is the inverse of its module sibling', () => {
    it('round-trips through deserializeMazeWorld back to a playable world', () => {
        const world = room();
        const restored = deserializeMazeWorld(serializeMazeWorld(world, EXTRACTED));
        expect(restored.width).toBe(world.width);
        expect(restored.height).toBe(world.height);
        expect(Array.from(restored.tiles)).toEqual(Array.from(world.tiles));
        expect(restored.entrance).toEqual(world.entrance);
        expect([...restored.exits.keys()]).toEqual([...world.exits.keys()]);
        expect([...restored.obstacles]).toEqual([...world.obstacles]);
        expect([...restored.items]).toEqual([...world.items]);
    });
});

/**
 * ⛓⛓ **THE INVERSION H3b FIXED, STATED AS A LAW.**
 *
 * Before this slice the maze module imported `procgenPipelineEngine.js` to get
 * its OWN serializer — from `mazeSetAdapter.js` and three test files — and the
 * shared submodule's `adapterPrimitives.js` reached through the pipeline for
 * half of a round trip whose other half it took from here.
 *
 * ⚠ THE LAW IS ABOUT THE ENGINE, NOT ABOUT `procgenPipeline/` WHOLE. The H3b
 * brief asked for "no maze file imports `procgenPipeline/`". DERIVED by parsing
 * the specifiers (not by eyeballing a grep — the first pass here said "eleven"
 * and was wrong): `mazeRoom/` made TWENTY `../procgenPipeline/` imports over
 * eight files before this slice, of which four were the serializer. SIXTEEN
 * remain, over six files, naming five modules — `regionAtlasCompiler`,
 * `regionAtlasValidator`, `regionAtlasMazeProjection`, `regionLibraryValidator`,
 * `regionLibraryLoader`: the ATLAS/LIBRARY vocabulary, which the maze lab
 * genuinely consumes and which no ruling has moved. Asserting the broader claim
 * would have been a red row, not a law. The ENGINE is the one this slice
 * emptied, and the count it names is 0.
 *
 * ⛔ The roster is read off the DIRECTORY (trap 574's rule), so a maze file
 * added later joins this scan by existing.
 */
describe('⛔ mazeRoom imports nothing from the pipeline ENGINE', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const MAZE_FILES = readdirSync(here, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.js'))
        .map((d) => d.name)
        .sort();
    const importsOf = (name) => [...readFileSync(join(here, name), 'utf8')
        .matchAll(/^\s*(?:import|export)\b[^'"]*from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

    it('the scan found the module (a zero-file sweep proves nothing)', () => {
        expect(MAZE_FILES.length).toBeGreaterThan(20);
        expect(MAZE_FILES).toContain('mazeSerializer.js');
        expect(MAZE_FILES).toContain('mazeSetAdapter.js');
        // ⛔ non-vacuity: the scanner really reads specifiers out of these files.
        expect(importsOf('mazeSerializer.js')).toContain('./mazeGeometry.js');
        expect(importsOf('mazeSetAdapter.js')).toContain('./mazeSerializer.js');
    });

    it.each(MAZE_FILES)('%s imports no procgenPipelineEngine', (name) => {
        for (const spec of importsOf(name)) {
            expect(spec.includes('procgenPipelineEngine'),
                `${name} imports "${spec}" — the maze module owns its serializer since H3b`)
                .toBe(false);
        }
    });
});
