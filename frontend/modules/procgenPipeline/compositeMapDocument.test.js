import { describe, it, expect } from 'vitest';

import { reconstructResultFromSidecars } from './compositeMapDocument.js';
// Side-effect import: registers the maze substrate so deserializeWorld
// resolves through substrateRegistry when reconstructResultFromSidecars
// runs in the test environment.
import '../mazeRoom/mazeRoomLibrary.js';

/**
 * ⛓ APWORLD EDITOR HUB H3. The four rows below MOVED here verbatim from
 * `procgenPipelineUI.test.js` with the function they cover; the `{playerId}`
 * rows are new (H1's `panel.playerId` is what the hub's Map tab passes).
 */

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

describe('reconstructResultFromSidecars', () => {
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

    /**
     * ⛓ H3b. This line used to read `sc.substrate ?? 'maze'`, so an entry with
     * NO substrate was painted as a maze. MEASURED over all 205 committed
     * documents: 1,360 of 1,360 entries carry `substrate`, so the fallback
     * never fired on real data — and on a hand-written document it guesses,
     * where skipping is what every other unknown substrate gets. ⛔ This row is
     * what makes the deletion DRIVEN rather than merely unreachable: restore
     * the `?? 'maze'` and it reds, because the region reconstructs.
     */
    it('⛓ skips an entry with NO substrate rather than guessing maze', () => {
        const sc = minimalSidecar(0, 0);
        delete sc.substrate;
        expect(reconstructResultFromSidecars({
            preset_sidecars: { '1': { region_0_0: sc } },
        })).toBeNull();
    });
});

/**
 * ⛓⛓ **THE SLOT IS READ, NOT ASSUMED** (H1's carry 2). A four-player document
 * whose slots hold DIFFERENT worlds is the only fixture that can tell "read the
 * asked-for slot" from "read the first one" — a same-shaped fixture would pass
 * either way, which is trap 824's vacuous mutant in miniature.
 */
describe('reconstructResultFromSidecars — the player slot', () => {
    const twoSlots = () => ({
        preset_sidecars: {
            // slot "1": ONE region. slot "3": TWO.
            1: { only_region: minimalSidecar(0, 0) },
            3: { left: minimalSidecar(0, 0), right: minimalSidecar(1, 0) },
        },
    });

    it('reads the FIRST slot when no playerId is given (the pipeline path)', () => {
        const r = reconstructResultFromSidecars(twoSlots());
        expect(r.stats.regionsBuilt).toBe(1);
        expect(r.playerId).toBe('1');
    });

    it('reads the NAMED slot, and says which one it read', () => {
        const r = reconstructResultFromSidecars(twoSlots(), { playerId: '3' });
        expect(r.stats.regionsBuilt).toBe(2);
        expect(r.playerId).toBe('3');
        expect(r.grid.getRegion({ gx: 1, gy: 0 }).region_id).toBe('right');
    });

    it('accepts a NUMBER slot as well as a string (the selector hands both)', () => {
        expect(reconstructResultFromSidecars(twoSlots(), { playerId: 3 }).playerId).toBe('3');
    });

    it('falls back to the first slot — and REPORTS it — when the slot is absent', () => {
        const r = reconstructResultFromSidecars(twoSlots(), { playerId: '9' });
        expect(r.playerId).toBe('1');
        expect(r.stats.regionsBuilt).toBe(1);
    });

    it('returns null when the named slot exists but carries no regions', () => {
        expect(reconstructResultFromSidecars(
            { preset_sidecars: { 1: {}, 2: { r: minimalSidecar(0, 0) } } },
            { playerId: '1' },
        )).toBeNull();
    });
});
