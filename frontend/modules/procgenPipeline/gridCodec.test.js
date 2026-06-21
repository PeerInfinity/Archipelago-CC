import { describe, it, expect } from 'vitest';

// Side-effect: register the substrates whose payloads the codec must
// survive a round-trip (maze nests Int8Array tiles + Maps; bounce nests
// Maps in its level payload).
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import {
    Grid, serializeGrid, deserializeGrid, growSpheres, buildRulesJson,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';
import { DEFAULT_ITEMS } from '../shared/procgen/library.js';

function growGrid(quotas, start, sphereCount, maxItemsPerRegion) {
    const itemPool = { key_red: 1, key_blue: 1, key_green: 1, victory: 1 };
    const plan = planSpheres({ itemPool, sphereCount, victoryItem: 'victory', seed: 1 });
    return growSpheres({
        regionSize: { width: 8, height: 6 },
        itemLib: DEFAULT_ITEMS,
        seed: 1,
        regionParams: { physicsProfile: 'dj' },
        growthParams: {
            spherePlan: plan,
            maxItemsPerRegion,
            substrateQuotas: quotas,
            ...(start ? { startSubstrate: start } : {}),
        },
    });
}

describe('serializeGrid / deserializeGrid', () => {
    it('a serialized grid is pure JSON (no Map / typed array survives stringify)', () => {
        const { grid } = growGrid({ maze: 4 }, 'maze', 3, 2);
        const serialized = serializeGrid(grid);
        // Must survive a real JSON round-trip with zero loss.
        const json = JSON.stringify(serialized);
        expect(() => JSON.parse(json)).not.toThrow();
        expect(JSON.parse(json)).toEqual(serialized);
    });

    it('round-trips a maze grid back into a byte-identical rules.json', () => {
        const { grid, startCell } = growGrid({ maze: 4 }, 'maze', 3, 2);
        const opts = { startCell, seed: 1, itemLib: DEFAULT_ITEMS };
        const direct = buildRulesJson(grid, opts);

        const revived = deserializeGrid(JSON.parse(JSON.stringify(serializeGrid(grid))));
        expect(revived).toBeInstanceOf(Grid);
        const viaCodec = buildRulesJson(revived, opts);

        expect(viaCodec).toEqual(direct);
    });

    it('round-trips a bounce grid back into a byte-identical rules.json', () => {
        const { grid, startCell } = growGrid({ bounce: 3 }, 'bounce', 2, 4);
        const opts = { startCell, seed: 1, itemLib: DEFAULT_ITEMS };
        const direct = buildRulesJson(grid, opts);

        const revived = deserializeGrid(JSON.parse(JSON.stringify(serializeGrid(grid))));
        const viaCodec = buildRulesJson(revived, opts);

        expect(viaCodec).toEqual(direct);
    });

    it('reconstructs Map and Int8Array region internals exactly', () => {
        const { grid } = growGrid({ maze: 4 }, 'maze', 3, 2);
        const revived = deserializeGrid(JSON.parse(JSON.stringify(serializeGrid(grid))));
        for (const [key, region] of grid.cells.entries()) {
            const payload = region.playable_payload;
            const rPayload = revived.cells.get(key).playable_payload;
            if (payload?.tiles) {
                expect(rPayload.tiles).toBeInstanceOf(Int8Array);
                expect([...rPayload.tiles]).toEqual([...payload.tiles]);
            }
            if (payload?.exits instanceof Map) {
                expect(rPayload.exits).toBeInstanceOf(Map);
                expect([...rPayload.exits.entries()]).toEqual([...payload.exits.entries()]);
            }
        }
    });

    it('preserves teleporter mappings', () => {
        const grid = new Grid({ width: 3, height: 3 });
        grid.setTeleporter({ gx: 0, gy: 0 }, 'N', { gx: 2, gy: 2 });
        const revived = deserializeGrid(JSON.parse(JSON.stringify(serializeGrid(grid))));
        expect(revived.getTeleporter({ gx: 0, gy: 0 }, 'N')).toEqual({ gx: 2, gy: 2 });
    });

    it('rejects non-Grid input to serializeGrid', () => {
        expect(() => serializeGrid({ width: 1, height: 1 })).toThrow(/Grid instance/);
    });
});

describe('Grid.resize (grow-only, for sphere-append)', () => {
    it('grows the bounds losslessly — cells, regions, teleporters survive', () => {
        const { grid } = growGrid({ maze: 4 }, 'maze', 3, 2);
        const before = grid.allRegions().map((r) => ({ ...r.cell, id: r.region_id }));
        const tele = new Map(grid.teleporters);
        grid.setTeleporter({ gx: 0, gy: 0 }, 'N', { gx: 2, gy: 2 });
        const w0 = grid.width;
        const h0 = grid.height;

        grid.resize({ width: w0 + 4, height: h0 + 2 });

        expect(grid.width).toBe(w0 + 4);
        expect(grid.height).toBe(h0 + 2);
        // Every prior region is still at its exact coordinate.
        for (const r of before) {
            expect(grid.hasRegion({ gx: r.gx, gy: r.gy })).toBe(true);
            expect(grid.getRegion({ gx: r.gx, gy: r.gy }).region_id).toBe(r.id);
        }
        // Prior + new teleporters intact; a cell beyond the OLD bounds is now placeable.
        expect(grid.getTeleporter({ gx: 0, gy: 0 }, 'N')).toEqual({ gx: 2, gy: 2 });
        for (const [k, v] of tele) expect(grid.teleporters.get(k)).toBe(v);
        expect(grid.isInBounds({ gx: w0, gy: 0 })).toBe(true);
    });

    it('rejects shrinking (grow-only)', () => {
        const grid = new Grid({ width: 5, height: 5 });
        expect(() => grid.resize({ width: 4, height: 5 })).toThrow(/grow-only/);
        expect(() => grid.resize({ width: 5, height: 3 })).toThrow(/grow-only/);
        // Same size is allowed (no-op).
        expect(() => grid.resize({ width: 5, height: 5 })).not.toThrow();
    });

    it('rejects non-integer dimensions', () => {
        const grid = new Grid({ width: 5, height: 5 });
        expect(() => grid.resize({ width: 6.5, height: 5 })).toThrow(/invalid dimensions/);
    });
});
