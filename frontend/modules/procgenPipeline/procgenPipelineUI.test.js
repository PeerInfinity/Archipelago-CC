import { describe, it, expect } from 'vitest';

import { groupLibraryByFeature, reconstructResultFromSidecars } from './procgenPipelineUI.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Side-effect import: registers the maze substrate so deserializeWorld
// resolves through substrateRegistry when reconstructResultFromSidecars
// runs in the test environment.
import '../mazeRoom/mazeRoomLibrary.js';

// Fixture entries — minimal shape (just id, def.feature, kind) since
// the grouper only reads `def.feature` from each entry.
const ENTRIES = [
    { id: 'key_red',    def: { feature: 'colored_doors_and_keys' }, kind: 'item' },
    { id: 'door_red',   def: { feature: 'colored_doors_and_keys' }, kind: 'obstacle' },
    { id: 'logic_gate', def: { feature: 'logic_gate' },             kind: 'obstacle' },
    { id: 'mystery',    def: { feature: 'feature_no_one_supports' }, kind: 'item' },
];

const MAZE = {
    id: 'maze',
    supportedFeatures: ['logic_gate', 'colored_doors_and_keys'],
};
const TEXT_ADVENTURE = {
    id: 'text_adventure',
    supportedFeatures: ['logic_gate'],
};

describe('groupLibraryByFeature', () => {
    it('with zero substrates selected, every entry falls into unsupported', () => {
        const groups = groupLibraryByFeature(ENTRIES, []);
        expect(groups.common).toEqual([]);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id)).toEqual([
            'key_red', 'door_red', 'logic_gate', 'mystery',
        ]);
    });

    it('with only maze selected, maze-supported entries are common; others unsupported', () => {
        const groups = groupLibraryByFeature(ENTRIES, [MAZE]);
        expect(groups.common.map((e) => e.id)).toEqual(['key_red', 'door_red', 'logic_gate']);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id)).toEqual(['mystery']);
    });

    it('with only text-adventure selected, only logic_gate is common', () => {
        const groups = groupLibraryByFeature(ENTRIES, [TEXT_ADVENTURE]);
        expect(groups.common.map((e) => e.id)).toEqual(['logic_gate']);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id))
            .toEqual(['key_red', 'door_red', 'mystery']);
    });

    it('with both substrates selected, logic_gate is common; colored doors/keys are maze-only', () => {
        const groups = groupLibraryByFeature(ENTRIES, [MAZE, TEXT_ADVENTURE]);
        expect(groups.common.map((e) => e.id)).toEqual(['logic_gate']);
        expect(groups.substrateSpecific).toHaveLength(1);
        const [mazeOnly] = groups.substrateSpecific;
        expect(mazeOnly.label).toBe('maze only');
        expect(mazeOnly.entries.map((e) => e.id)).toEqual(['key_red', 'door_red']);
        expect(groups.unsupported.map((e) => e.id)).toEqual(['mystery']);
    });

    it('groups multiple entries that share the same supporter set under one label', () => {
        // Hypothetical third feature supported by maze only — exercises
        // the "merge into one labelled group" path.
        const entries = [
            ...ENTRIES,
            { id: 'extra_door', def: { feature: 'colored_doors_and_keys' }, kind: 'obstacle' },
        ];
        const groups = groupLibraryByFeature(entries, [MAZE, TEXT_ADVENTURE]);
        const [mazeOnly] = groups.substrateSpecific;
        expect(mazeOnly.label).toBe('maze only');
        expect(mazeOnly.entries.map((e) => e.id))
            .toEqual(['key_red', 'door_red', 'extra_door']);
    });

    it('produces deterministic, alphabetised supporter labels', () => {
        // Three substrates: A and C support feature X; only B
        // supports feature Y. Labels should be "A, C only" and
        // "B only", sorted alphabetically.
        const subs = [
            { id: 'a', supportedFeatures: ['x'] },
            { id: 'b', supportedFeatures: ['y'] },
            { id: 'c', supportedFeatures: ['x'] },
        ];
        const entries = [
            { id: 'x_thing', def: { feature: 'x' }, kind: 'item' },
            { id: 'y_thing', def: { feature: 'y' }, kind: 'item' },
        ];
        const groups = groupLibraryByFeature(entries, subs);
        const labels = groups.substrateSpecific.map((s) => s.label);
        expect(labels).toEqual(['a, c only', 'b only']);
    });

    it('treats a missing or non-array supportedFeatures as "supports nothing"', () => {
        const broken = { id: 'broken' /* no supportedFeatures */ };
        const groups = groupLibraryByFeature(ENTRIES, [broken]);
        // Nothing is common (broken supports nothing), nothing is
        // substrate-specific (no other selection to compare against),
        // everything is unsupported.
        expect(groups.common).toEqual([]);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id))
            .toEqual(['key_red', 'door_red', 'logic_gate', 'mystery']);
    });
});

describe('reconstructResultFromSidecars', () => {
    // Minimum-viable serialized maze region the maze adapter's
    // deserializeWorld accepts. 3x3 walls-only with a single floor
    // tile at the center marked as both entrance and exit.
    const minimalSidecar = (gx, gy) => ({
        substrate: 'maze',
        render_hint: 'maze',
        grid_cell: { gx, gy },
        playable_payload: {
            width: 3,
            height: 3,
            tiles: [1, 1, 1,  1, 0, 1,  1, 1, 1],
            entrance: { x: 1, y: 1 },
            exits: [{ exit_id: 'exit', x: 1, y: 1, side: 'N',
                exitName: 'exit', targetRegion: null,
                isBackExit: false, isTeleporter: false }],
            obstacles: [], items: [], obstacleLib: {}, itemLib: {},
        },
    });

    it('returns null when rules.json has no preset_sidecars', () => {
        expect(reconstructResultFromSidecars({})).toBeNull();
        expect(reconstructResultFromSidecars(null)).toBeNull();
        expect(reconstructResultFromSidecars({ preset_sidecars: {} })).toBeNull();
    });

    it('reconstructs a Grid populated with deserialized regions', () => {
        const result = reconstructResultFromSidecars({
            preset_sidecars: {
                '1': {
                    region_0_0: minimalSidecar(0, 0),
                    region_1_0: minimalSidecar(1, 0),
                },
            },
            procgen_metadata: { driver: 'grid-growth', stop_reason: 'pool_empty' },
        });
        expect(result).not.toBeNull();
        expect(result.grid.width).toBe(2);
        expect(result.grid.height).toBe(1);
        expect(result.regionSize).toEqual({ width: 3, height: 3 });
        expect(result.stats.regionsBuilt).toBe(2);
        expect(result.stats.stopReason).toBe('pool_empty');
        expect(result.fromLoadedPreset).toBe(true);
        // Each placed region should expose its deserialized in-memory
        // world (Map for exits, not a plain array).
        const r = result.grid.getRegion({ gx: 0, gy: 0 });
        expect(r.region_id).toBe('region_0_0');
        expect(r.playable_payload.exits instanceof Map).toBe(true);
    });

    it('sizes the canvas grid by max region dimensions across regions', () => {
        const big = minimalSidecar(0, 0);
        big.playable_payload.width = 5;
        big.playable_payload.height = 4;
        big.playable_payload.tiles = new Array(20).fill(1);
        big.playable_payload.tiles[2 * 5 + 2] = 0;
        big.playable_payload.entrance = { x: 2, y: 2 };
        big.playable_payload.exits[0] = { ...big.playable_payload.exits[0], x: 2, y: 2 };
        const result = reconstructResultFromSidecars({
            preset_sidecars: { '1': {
                region_0_0: big,
                region_0_1: minimalSidecar(0, 1),  // 3x3
            } },
        });
        expect(result.regionSize).toEqual({ width: 5, height: 4 });
    });

    it('skips regions whose substrate has no registered deserializer', () => {
        const sc = minimalSidecar(0, 0);
        sc.substrate = 'no_such_substrate';
        const result = reconstructResultFromSidecars({
            preset_sidecars: { '1': { region_0_0: sc } },
        });
        expect(result).toBeNull();
    });
});
