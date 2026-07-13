// Region-library capture → instantiate roundtrip, per substrate (region-library
// F2, gate §5.2). generate → capture → instantiate in a FRESH context → compare
// geometry + rules. For maze the verifier re-extracts the instantiated world
// INDEPENDENTLY (not trusting the captured rules — the verifier must not share
// the capture's assumptions).
import { describe, it, expect, beforeAll } from 'vitest';
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    tileGridPathExtractor,
} from '../shared/procgen/adapterPrimitives.js';
import { assembleZoneRegion } from './procgenPipelineEngine.js';
import { extractZoneRules as bounceExtractZoneRules } from '../bounceDemo/bounceDemoLibrary.js';
import { createRng } from '../shared/rng.js';

describe('maze region-library roundtrip (procedural / re-derived rules)', () => {
    let maze;
    let original;      // the live region descriptor
    let entry;
    beforeAll(() => {
        maze = substrateRegistry.get('maze');
        const rng = createRng(123);
        const core = maze.generateRegionCore({
            region_id: 'orig', size: { width: 11, height: 11 },
            entrances: [], exits: ['N', 'E', 'S', 'W'].map((side) => ({ side })),
            item_lib: {}, obstacle_lib: {}, rng, params: {}, biome: null,
        });
        maze.placeFromItems(core.world, {
            items_to_place: [
                { item_id: 'Sword', location_id: 'a' },
                { item_id: 'Key', location_id: 'b' },
            ],
            obstacles_to_place: [], arrival_inventory: {}, rng, params: {},
        });
        const extracted = tileGridPathExtractor(core.world, { regionId: 'orig' });
        original = { region_id: 'orig', playable_payload: core.world, extracted_rules: extracted };
        entry = maze.captureLibraryEntry(original, { entry_id: 'mz_test', name: 'Test Maze' });
    });

    it('captures an instance-free entry (payload only, carried_rules null)', () => {
        expect(entry.substrate).toBe('maze');
        expect(entry.carried_rules).toBeNull();
        expect(entry.region_size).toEqual({ width: 11, height: 11 });
        expect([...entry.exit_sides].sort()).toEqual(['E', 'N', 'S', 'W']);
        expect(entry.location_slots).toBe(2);
        // Exit targets stripped (no instance stitching leaks into the entry).
        for (const ex of entry.payload.exits) expect(ex.targetRegion).toBeNull();
    });

    it('validateLibraryEntry accepts the captured entry, rejects a lie', () => {
        expect(maze.validateLibraryEntry(entry).errors).toEqual([]);
        const lying = JSON.parse(JSON.stringify(entry));
        lying.location_slots = 99;
        expect(maze.validateLibraryEntry(lying).errors.some((e) => /location_slots/.test(e))).toBe(true);
    });

    it('instantiates geometry byte-identically to the original (independent re-extract)', () => {
        const region = maze.instantiateLibraryEntry(entry, {
            region_id: 'reg_new', exitSides: ['N', 'E', 'S', 'W'], rng: createRng(999),
        });
        // Geometry survives serialize → deserialize.
        expect(region.playable_payload.width).toBe(11);
        expect(region.playable_payload.height).toBe(11);
        expect([...region.playable_payload.tiles]).toEqual([...original.playable_payload.tiles]);

        // INDEPENDENT stratum: re-extract from BOTH worlds and compare exit
        // geometry directly (not via the captured rules).
        const origExtract = tileGridPathExtractor(original.playable_payload, { regionId: 'x' });
        const newExtract = tileGridPathExtractor(region.playable_payload, { regionId: 'x' });
        const sig = (ex) => ex.exits.map((e) => `${e.position.x},${e.position.y},${e.id}`).sort();
        expect(sig(newExtract)).toEqual(sig(origExtract));

        // Slot positions preserved; ids re-stamped to the new region namespace.
        expect(region.extracted_rules.locations).toHaveLength(2);
        for (const loc of region.extracted_rules.locations) {
            expect(loc.id).toMatch(/^reg_new__slot_\d+$/);
            expect(loc.item).toBeNull();
        }
        const posOf = (r) => r.map((l) => `${l.position.x},${l.position.y}`).sort();
        expect(posOf(region.extracted_rules.locations))
            .toEqual(posOf(tileGridPathExtractor(original.playable_payload, { regionId: 'x' }).locations));
    });

    it('is deterministic and rng-free (two instantiations are identical)', () => {
        const a = maze.instantiateLibraryEntry(entry, { region_id: 'r', exitSides: ['N'] });
        const b = maze.instantiateLibraryEntry(entry, { region_id: 'r', exitSides: ['N'] });
        expect([...a.playable_payload.tiles]).toEqual([...b.playable_payload.tiles]);
        expect(a.extracted_rules).toEqual(b.extracted_rules);
    });
});

describe('bounce region-library roundtrip (content / carried rules)', () => {
    let bounce;
    let original;
    let entry;
    beforeAll(() => {
        bounce = substrateRegistry.get('bounce');
        // Build a bounce zone region for zone 0 with E/W exits.
        const zoneRules = bounceExtractZoneRules(0, { region_id: 'orig', exitSides: ['E', 'W'] });
        original = assembleZoneRegion({
            substrate: 'bounce', region_id: 'orig', regionSize: { width: 8, height: 6 },
            exitSides: ['E', 'W'], zoneRules, zonePayload: {},
        });
        entry = bounce.captureLibraryEntry(original, { entry_id: 'bn_test' });
    });

    it('captures carried_rules verbatim + the level payload', () => {
        expect(entry.substrate).toBe('bounce');
        expect(entry.carried_rules).not.toBeNull();
        expect([...entry.exit_sides].sort()).toEqual(['E', 'W']);
        expect(entry.payload.bounceLevel).toBeTruthy();
        expect(Object.keys(entry.payload.sidePortals).sort()).toEqual(['E', 'W']);
        expect(bounce.validateLibraryEntry(entry).errors).toEqual([]);
    });

    it('instantiates an equivalent region for the same sides', () => {
        const region = bounce.instantiateLibraryEntry(entry, {
            region_id: 'reg_b', exitSides: ['E', 'W'], regionSize: { width: 8, height: 6 },
        });
        expect(region.substrate).toBe('bounce');
        // Synthetic exits re-built for the requested sides.
        const sides = region.extracted_rules.exits.map((e) => e.id).sort();
        expect(sides).toEqual(['exit_E', 'exit_W']);
        // ap_locations re-stamped to the new region id.
        for (const name of Object.values(region.playable_payload.ap_locations)) {
            expect(name).toMatch(/^reg_b__/);
        }
        // Same location count as captured.
        expect(region.extracted_rules.locations).toHaveLength(entry.location_slots);
    });

    it('fits a subset of sides and fails loudly on a missing side', () => {
        const region = bounce.instantiateLibraryEntry(entry, {
            region_id: 'sub', exitSides: ['E'], regionSize: { width: 8, height: 6 },
        });
        expect(region.extracted_rules.exits.map((e) => e.id)).toEqual(['exit_E']);
        expect(() => bounce.instantiateLibraryEntry(entry, { region_id: 'no', exitSides: ['N'] }))
            .toThrow(/slot needs side 'N'/);
    });
});
