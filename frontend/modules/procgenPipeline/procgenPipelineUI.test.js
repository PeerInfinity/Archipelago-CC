import { describe, it, expect } from 'vitest';

import {
    groupLibraryByFeature,
    reconstructResultFromSidecars,
    resolveExitTilePositions,
    fitTextToWidth,
} from './procgenPipelineUI.js';
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

describe('resolveExitTilePositions', () => {
    const SIZE = { width: 8, height: 6 };

    it('preserves explicit (x, y) verbatim and skips even-distribution', () => {
        const placed = resolveExitTilePositions([
            { exit_id: 'a', x: 3, y: 0, side: 'N' },
            { exit_id: 'b', x: 7, y: 2, side: 'E' },
        ], SIZE);
        expect(placed).toEqual([
            { exit: { exit_id: 'a', x: 3, y: 0, side: 'N' }, x: 3, y: 0 },
            { exit: { exit_id: 'b', x: 7, y: 2, side: 'E' }, x: 7, y: 2 },
        ]);
    });

    it('distributes side-only exits evenly along their wall, avoiding corners', () => {
        // Three N-side exits → fractions 1/4, 2/4, 3/4 of (width-1=7).
        const placed = resolveExitTilePositions([
            { exit_id: 'n1', side: 'N' },
            { exit_id: 'n2', side: 'N' },
            { exit_id: 'n3', side: 'N' },
        ], SIZE);
        expect(placed.map(({ x, y }) => [x, y])).toEqual([[2, 0], [4, 0], [5, 0]]);
        // None landed on the corners.
        for (const { x } of placed) {
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(SIZE.width - 1);
        }
    });

    it('distributes per-side independently and pins to correct wall', () => {
        const placed = resolveExitTilePositions([
            { exit_id: 's1', side: 'S' },
            { exit_id: 'w1', side: 'W' },
            { exit_id: 'e1', side: 'E' },
        ], SIZE);
        const bySide = Object.fromEntries(placed.map(({ exit, x, y }) => [exit.exit_id, { x, y }]));
        expect(bySide.s1.y).toBe(SIZE.height - 1);
        expect(bySide.w1.x).toBe(0);
        expect(bySide.e1.x).toBe(SIZE.width - 1);
    });

    it('mixes (x,y)-bearing and side-only exits in the same region', () => {
        const placed = resolveExitTilePositions([
            { exit_id: 'fixed', x: 0, y: 3, side: 'W' },
            { exit_id: 'distributed', side: 'N' },
        ], SIZE);
        expect(placed).toHaveLength(2);
        const fixed = placed.find((p) => p.exit.exit_id === 'fixed');
        const distributed = placed.find((p) => p.exit.exit_id === 'distributed');
        expect(fixed).toEqual({ exit: { exit_id: 'fixed', x: 0, y: 3, side: 'W' }, x: 0, y: 3 });
        expect(distributed.y).toBe(0);  // N wall
    });

    it('drops exits with neither (x,y) nor a known side', () => {
        const placed = resolveExitTilePositions([
            { exit_id: 'orphan' },                       // no side, no coords
            { exit_id: 'bad_side', side: 'NW' },         // unknown side
            { exit_id: 'good', x: 1, y: 1 },
        ], SIZE);
        expect(placed.map((p) => p.exit.exit_id)).toEqual(['good']);
    });

    it('returns [] for empty / non-array inputs', () => {
        expect(resolveExitTilePositions([], SIZE)).toEqual([]);
        expect(resolveExitTilePositions(undefined, SIZE)).toEqual([]);
        expect(resolveExitTilePositions(null, SIZE)).toEqual([]);
    });

    it('accepts the in-memory Map<exit_id, exit> shape from deserializeWorld', () => {
        // The composite view's just-generated path passes the live
        // in-memory world's exits Map (not the on-disk Array shape).
        // Both must work because both feed _drawRegion.
        const exitsMap = new Map([
            ['a', { exit_id: 'a', x: 3, y: 0, side: 'N' }],
            ['b', { exit_id: 'b', x: 7, y: 2, side: 'E' }],
        ]);
        const placed = resolveExitTilePositions(exitsMap, SIZE);
        expect(placed.map(({ exit, x, y }) => [exit.exit_id, x, y]))
            .toEqual([['a', 3, 0], ['b', 7, 2]]);
    });
});

describe('fitTextToWidth', () => {
    // Stand-in for CanvasRenderingContext2D — measureText returns the
    // string's character count as the width, so 1px == 1 char and the
    // tests stay deterministic.
    const ctx = { measureText: (s) => ({ width: s.length }) };

    it('returns the original string when it already fits', () => {
        expect(fitTextToWidth(ctx, 'hello', 10)).toBe('hello');
        expect(fitTextToWidth(ctx, 'hello', 5)).toBe('hello');
    });

    it('truncates with an ellipsis when over the budget', () => {
        // "longish text" length 12; budget 8 leaves 7 chars + ellipsis
        // since the ellipsis itself counts as 1 in the stub.
        const out = fitTextToWidth(ctx, 'longish text', 8);
        expect(out.endsWith('…')).toBe(true);
        expect(out.length).toBe(8);
    });

    it('returns just the ellipsis when no characters fit', () => {
        expect(fitTextToWidth(ctx, 'anything', 1)).toBe('…');
    });

    it('handles empty / nullish input', () => {
        expect(fitTextToWidth(ctx, '', 100)).toBe('');
        expect(fitTextToWidth(ctx, null, 100)).toBe('');
        expect(fitTextToWidth(ctx, undefined, 100)).toBe('');
    });
});
