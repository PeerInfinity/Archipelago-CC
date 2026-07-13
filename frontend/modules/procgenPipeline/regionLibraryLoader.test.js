// Unit tests for the region-library loader (region-library F3, headless core).
import { describe, it, expect } from 'vitest';
import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { tileGridPathExtractor } from '../shared/procgen/adapterPrimitives.js';
import { stampLibraryIdentity } from './regionLibraryValidator.js';
import { arrangeShuffledSpiral, librarySourceId } from './procgenPipelineEngine.js';
import { createRng } from '../shared/rng.js';
import {
    parseRegionLibrary, loadServedIndex, loadServedLibrary,
    buildLibrarySpiralConfig, isLoadedLibrarySource, registryCapabilityCheck,
} from './regionLibraryLoader.js';

const maze = substrateRegistry.get('maze');

function demoLibrary() {
    const mk = (id, seed) => {
        const rng = createRng(seed);
        const core = maze.generateRegionCore({
            region_id: id, size: { width: 9, height: 9 },
            entrances: [], exits: ['N', 'E', 'S', 'W'].map((s) => ({ side: s })),
            item_lib: {}, obstacle_lib: {}, rng, params: {}, biome: null,
        });
        maze.placeFromItems(core.world, {
            items_to_place: [{ item_id: 'X', location_id: 'a' }],
            obstacles_to_place: [], arrival_inventory: {}, rng, params: {},
        });
        const ex = tileGridPathExtractor(core.world, { regionId: id });
        return maze.captureLibraryEntry({ region_id: id, playable_payload: core.world, extracted_rules: ex }, { entry_id: id });
    };
    const lib = { schema_version: 1, library_id: 'demo', name: 'Demo', entries: [mk('a', 1), mk('b', 2)] };
    stampLibraryIdentity(lib);
    return lib;
}

// A minimal injectable fetch over an in-memory file map.
function fakeFetch(files) {
    return async (url) => {
        const key = Object.keys(files).find((k) => url.endsWith(k));
        if (key == null) return { ok: false, status: 404 };
        const body = files[key];
        return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
    };
}

describe('regionLibraryLoader', () => {
    it('parses + validates an ad-hoc library, running the registry capability check', () => {
        const lib = demoLibrary();
        const res = parseRegionLibrary(JSON.stringify(lib));
        expect(res.ok).toBe(true);
        expect(res.library.library_id).toBe(lib.library_id);
    });

    it('rejects invalid JSON and a stale-id document', () => {
        expect(parseRegionLibrary('{ not json').ok).toBe(false);
        const lib = demoLibrary();
        lib.entries[0].location_slots = 42; // content changed, id not restamped
        const res = parseRegionLibrary(JSON.stringify(lib));
        expect(res.ok).toBe(false);
        expect(res.errors.some((e) => /content_hash/.test(e))).toBe(true);
    });

    it('restamps a hand-authored document on load', () => {
        const lib = demoLibrary();
        delete lib.provenance;
        lib.library_id = 'handmade';
        const res = parseRegionLibrary(JSON.stringify(lib), { restamp: true });
        expect(res.ok).toBe(true);
        expect(res.library.library_id).toMatch(/^handmade-[0-9a-f]{8}$/);
    });

    it('loads the served index and a served library file', async () => {
        const lib = demoLibrary();
        const fetchImpl = fakeFetch({
            'region_library_files.json': JSON.stringify({ schema_version: 1, libraries: [{ file: 'demo.json', library_id: lib.library_id, name: 'Demo', entry_count: 2, substrates: ['maze'] }] }),
            'demo.json': JSON.stringify(lib),
        });
        const index = await loadServedIndex(fetchImpl);
        expect(index).toHaveLength(1);
        expect(index[0].file).toBe('demo.json');
        const loaded = await loadServedLibrary(fetchImpl, 'demo.json');
        expect(loaded.ok).toBe(true);
        expect(loaded.library.library_id).toBe(lib.library_id);
    });

    it('builds a spiral config fragment that the engine actually consumes', () => {
        const lib = demoLibrary();
        const { substrateQuotas, substrateConfig } = buildLibrarySpiralConfig(
            [{ library: lib, count: 3 }], { substrateQuotas: { maze: 1 } });
        const id = librarySourceId(lib.library_id);
        expect(substrateQuotas).toEqual({ maze: 1, [id]: 3 });
        expect(substrateConfig[id].libraryDoc).toBe(lib);
        // The engine accepts it end-to-end.
        const { grid } = arrangeShuffledSpiral({
            regionSize: { width: 9, height: 9 }, seed: 1, itemPool: {}, obstaclePool: {},
            regionParams: {}, growthParams: { substrateQuotas, substrateConfig }, hazardOpts: null,
        });
        expect([...grid.allRegions()]).toHaveLength(4);
    });

    it('isLoadedLibrarySource guards the panel substrate filter', () => {
        const lib = demoLibrary();
        const id = librarySourceId(lib.library_id);
        const cfg = { [id]: { libraryDoc: lib } };
        expect(isLoadedLibrarySource(id, cfg)).toBe(true);
        expect(isLoadedLibrarySource(id, {})).toBe(false);
        expect(isLoadedLibrarySource('maze', cfg)).toBe(false);
    });

    it('registryCapabilityCheck delegates to the substrate adapter', () => {
        const lib = demoLibrary();
        const good = registryCapabilityCheck(lib.entries[0]);
        expect(good.errors ?? []).toEqual([]);
        const lying = JSON.parse(JSON.stringify(lib.entries[0]));
        lying.location_slots = 99;
        expect(registryCapabilityCheck(lying).errors.some((e) => /location_slots/.test(e))).toBe(true);
    });
});
