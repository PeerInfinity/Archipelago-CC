// Region-library spiral placement (region-library F4). A `library:<id>` quota is
// a content source whose entries fill spiral slots; instantiated regions are
// self-contained normal maze regions (the library is a build-time source, absent
// from the compiled world). Covers: generation, fit + repetition, loud no-fit,
// quota-vs-pool validation, and stepped == monolithic.
import { describe, it, expect } from 'vitest';
import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { tileGridPathExtractor } from '../shared/procgen/adapterPrimitives.js';
import { stampLibraryIdentity } from './regionLibraryValidator.js';
import {
    arrangeShuffledSpiral, buildRulesJson, librarySourceId,
} from './procgenPipelineEngine.js';
import {
    newSpiralEnvelope, runSpiralToStep,
    serializeSpiralEnvelope, deserializeSpiralEnvelope,
} from './spiralSteps.js';
import { createRng } from '../shared/rng.js';

const maze = substrateRegistry.get('maze');

function mazeEntry(id, seed, sides = ['N', 'E', 'S', 'W']) {
    const rng = createRng(seed);
    const core = maze.generateRegionCore({
        region_id: id, size: { width: 9, height: 9 },
        entrances: [], exits: sides.map((side) => ({ side })),
        item_lib: {}, obstacle_lib: {}, rng, params: {}, biome: null,
    });
    maze.placeFromItems(core.world, {
        items_to_place: [{ item_id: 'X', location_id: 'a' }],
        obstacles_to_place: [], arrival_inventory: {}, rng, params: {},
    });
    const ex = tileGridPathExtractor(core.world, { regionId: id });
    return maze.captureLibraryEntry(
        { region_id: id, playable_payload: core.world, extracted_rules: ex },
        { entry_id: id, name: id });
}

function library(entries, name = 'Demo') {
    const lib = { schema_version: 1, library_id: 'demo', name, entries };
    stampLibraryIdentity(lib);
    return lib;
}

function config(lib, quotas) {
    const srcId = librarySourceId(lib.library_id);
    return {
        regionSize: { width: 9, height: 9 }, seed: 7,
        itemPool: {}, obstaclePool: {}, regionParams: {},
        growthParams: {
            substrateQuotas: quotas(srcId),
            substrateConfig: { [srcId]: { libraryDoc: lib } },
        },
        hazardOpts: null,
    };
}

describe('region library as a spiral content source', () => {
    it('fills slots with self-contained maze regions', () => {
        const lib = library([mazeEntry('a', 1), mazeEntry('b', 2), mazeEntry('c', 3)]);
        const cfg = config(lib, (id) => ({ maze: 2, [id]: 3 }));
        const { grid } = arrangeShuffledSpiral(cfg);
        const regions = [...grid.allRegions()];
        expect(regions).toHaveLength(5);
        // Every region renders as maze (library maze regions ARE maze regions).
        expect(regions.every((r) => r.substrate === 'maze')).toBe(true);
        // Every region carries a self-contained tile world (tiles is a TypedArray).
        expect(regions.every((r) => r.playable_payload.tiles?.length === 81)).toBe(true);
    });

    it('allows repetition (palette) when the pool is smaller than the quota', () => {
        const lib = library([mazeEntry('only', 1)]); // 1 entry, all 4 sides
        const cfg = config(lib, (id) => ({ [id]: 4 })); // 4 slots from 1 entry
        const { grid } = arrangeShuffledSpiral(cfg);
        expect([...grid.allRegions()]).toHaveLength(4);
    });

    it('fails loudly when no entry fits a slot', () => {
        // Single-side entries can never fit an interior spiral slot (>=2 sides).
        // Pool >= quota (so the arrange-time pool check passes) but no fit.
        const nubs = Array.from({ length: 6 }, (_, i) => mazeEntry(`nub${i}`, i + 1, ['N']));
        const lib = library(nubs);
        const cfg = config(lib, (id) => ({ [id]: 6 }));
        expect(() => arrangeShuffledSpiral(cfg)).toThrow(/no entry fits slot sides/);
    });

    it('rejects an empty library at arrange time', () => {
        const lib = library([mazeEntry('a', 1)]);
        lib.entries = [];
        const cfg = config(lib, (id) => ({ [id]: 2 }));
        expect(() => arrangeShuffledSpiral(cfg)).toThrow(/has no entries/);
    });

    it('rejects a library source with no libraryDoc in config', () => {
        const cfg = {
            regionSize: { width: 9, height: 9 }, seed: 1,
            growthParams: { substrateQuotas: { 'library:ghost': 1 }, substrateConfig: {} },
        };
        expect(() => arrangeShuffledSpiral(cfg)).toThrow(/no libraryDoc/);
    });

    it('the stepped pipeline reproduces the monolithic library world', async () => {
        const lib = library([mazeEntry('a', 1), mazeEntry('b', 2), mazeEntry('c', 3)]);
        const cfg = config(lib, (id) => ({ maze: 2, [id]: 3 }));
        const mono = arrangeShuffledSpiral(cfg);
        const monoRules = buildRulesJson(mono.grid, {
            startCell: mono.startCell, seed: 7,
            procgenMetadata: { driver: 'shuffled-spiral', stop_reason: mono.stats.stopReason },
        });

        let env = newSpiralEnvelope({ config: cfg, compileIn: { seed: 7 } });
        // Serialize/deserialize across every step boundary (the cross-process path).
        for (const step of ['arrange', 'content', 'regions', 'compile']) {
            env = deserializeSpiralEnvelope(serializeSpiralEnvelope(env));
            env = await runSpiralToStep(env, step);
        }
        expect(env.content.library_id).toBe(lib.library_id); // ② materialised
        expect(JSON.stringify(env.compile.rulesJson)).toBe(JSON.stringify(monoRules));
    });

    it('a hand-edit at ② restamps the library id and clears downstream', async () => {
        const lib = library([mazeEntry('a', 1), mazeEntry('b', 2), mazeEntry('c', 3)]);
        const cfg = config(lib, (id) => ({ [id]: 3 }));
        let env = newSpiralEnvelope({ config: cfg, compileIn: { seed: 7 } });
        env = await runSpiralToStep(env, 'compile');
        expect(env.compile).toBeTruthy();
        // Edit the content document and re-cross the boundary.
        env = await runSpiralToStep(env, 'content'); // resets env to ② output? no-op if past
        env.content.entries[0].location_slots = 9;
        const beforeId = env.content.library_id;
        env = deserializeSpiralEnvelope(serializeSpiralEnvelope(env));
        expect(env.content.library_id).not.toBe(beforeId); // restamped
        expect(env.regions).toBeNull(); // downstream cleared
        expect(env.compile).toBeNull();
    });
});
