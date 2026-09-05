import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { reconstructResultFromSidecars } from './compositeMapDocument.js';
import { drawCompositeMap, COLORS, TILE_PX } from '../procgenCore/compositeMapRenderer.js';
// Side-effect import: registers the maze substrate so deserializeWorld
// resolves through substrateRegistry when reconstructResultFromSidecars
// runs in the test environment.
import '../mazeRoom/mazeRoomLibrary.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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

/* ══════════════════════════════════════════════════════════════════════
 * H4a — THE EXITS THAT REACH THE TOP LEVEL, AND THE LINES THEY DRAW
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ A node stand-in for `CanvasRenderingContext2D`. The renderer's product is a
 * sequence of drawing operations, so the only honest assertion about it is over
 * that sequence — the same instrument `compositeMapRenderer.test.js` uses, and
 * the same one `mazeSetLab.test.js:243` records draws through.
 */
function recordingCanvas(width, height) {
    const ops = [];
    const ctx = {
        fillStyle: null, strokeStyle: null, lineWidth: null,
        font: null, textAlign: null, textBaseline: null,
        fillRect: () => ops.push({ op: 'fillRect', style: ctx.fillStyle }),
        strokeRect: () => ops.push({ op: 'strokeRect', style: ctx.strokeStyle }),
        fillText: (...a) => ops.push({ op: 'fillText', style: ctx.fillStyle, a }),
        beginPath: () => ops.push({ op: 'beginPath' }),
        moveTo: (...a) => ops.push({ op: 'moveTo', a }),
        lineTo: (...a) => ops.push({ op: 'lineTo', a }),
        stroke: () => ops.push({ op: 'stroke', style: ctx.strokeStyle }),
        arc: () => ops.push({ op: 'arc' }),
        fill: () => ops.push({ op: 'fill', style: ctx.fillStyle }),
        save: () => ops.push({ op: 'save' }), restore: () => ops.push({ op: 'restore' }),
        setLineDash: () => ops.push({ op: 'setLineDash' }),
        measureText: (s) => ({ width: String(s ?? '').length }),
    };
    return { width, height, ops, getContext: () => ctx };
}

/** ⛓ The connection pass is the ONLY thing drawn in `COLORS.connection`. */
function connectionLinesOf(result) {
    const cv = recordingCanvas(
        result.grid.width * result.regionSize.width * TILE_PX,
        result.grid.height * result.regionSize.height * TILE_PX);
    drawCompositeMap(cv, result.grid, result.regionSize);
    return cv.ops.filter((o) => o.op === 'stroke' && o.style === COLORS.connection).length;
}

/**
 * ⛓ The expected line count, derived from the DOCUMENT rather than from the
 * function under test: one line per unordered reciprocal exit pair whose two
 * endpoints are both placed and both carry tile coordinates. Spelled over the
 * on-disk array shape, so it never runs through `deserializeWorld`.
 */
function reciprocalPairsOf(sidecars) {
    const placed = new Map();
    for (const [rid, sc] of Object.entries(sidecars)) {
        if (!sc?.grid_cell) continue;
        for (const e of sc.playable_payload?.exits ?? []) {
            if (Number.isFinite(e?.x) && Number.isFinite(e?.y)) placed.set(`${rid} ${e.exit_id}`, e);
        }
    }
    const pairs = new Set();
    for (const [rid, sc] of Object.entries(sidecars)) {
        if (!sc?.grid_cell) continue;
        for (const e of sc.playable_payload?.exits ?? []) {
            if (!e?.targetRegion || !e?.targetExitId) continue;
            const from = `${rid} ${e.exit_id}`;
            const to = `${e.targetRegion} ${e.targetExitId}`;
            if (!placed.has(from) || !placed.has(to)) continue;
            pairs.add(from < to ? `${from}|${to}` : `${to}|${from}`);
        }
    }
    return pairs.size;
}

/** Two 3×3 regions side by side whose single exits name each other. */
const linkedPair = () => {
    const left = minimalSidecar(0, 0);
    const right = minimalSidecar(1, 0);
    left.playable_payload.exits[0] = {
        ...left.playable_payload.exits[0],
        exit_id: 'to_right', targetRegion: 'right', targetExitId: 'to_left',
    };
    right.playable_payload.exits[0] = {
        ...right.playable_payload.exits[0],
        exit_id: 'to_left', targetRegion: 'left', targetExitId: 'to_right',
    };
    return { left, right };
};

describe('reconstructResultFromSidecars — the region\'s exits reach the TOP LEVEL', () => {
    /**
     * ⛓⛓ **H4a, and the defect H3 found and was not allowed to fix** (plan
     * §13.1 #6). The engine's own placements set `exits: world.exits`
     * (`procgenPipelineEngine.js:3970`); this reader did not, and the renderer's
     * connection pass reads `region.exits` — so a LOADED document drew its cells
     * and its in-cell exit squares and NOT ONE inter-region line.
     *
     * ⛔ MUTANT: delete `exits: world.exits` from the placement. `regionsBuilt`,
     * the grid dimensions and every cell's pixels stay exactly as they are —
     * which is why the row that catches it counts LINES, not regions.
     */
    it('⛓ places each region with its exits, so the connection pass can see them', () => {
        const { left, right } = linkedPair();
        const result = reconstructResultFromSidecars({
            preset_sidecars: { 1: { left, right } },
        });
        const a = result.grid.getRegion({ gx: 0, gy: 0 });
        expect(a.exits instanceof Map).toBe(true);
        expect([...a.exits.values()].map((e) => e.exit_id)).toEqual(['to_right']);
        // ⛓ and the payload keeps its own copy — the top-level field is a
        //   second READER's view of the same exits, not a move.
        expect(a.playable_payload.exits instanceof Map).toBe(true);
    });

    it('⛓ draws ONE connection line for a reciprocal pair — 0 before H4a', () => {
        const { left, right } = linkedPair();
        const sidecars = { left, right };
        const result = reconstructResultFromSidecars({ preset_sidecars: { 1: sidecars } });
        expect(reciprocalPairsOf(sidecars)).toBe(1);
        expect(connectionLinesOf(result)).toBe(1);
    });

    it('⛓ draws NO line when the exits name nobody (the fixture the other rows use)', () => {
        const result = reconstructResultFromSidecars({
            preset_sidecars: { 1: { a: minimalSidecar(0, 0), b: minimalSidecar(1, 0) } },
        });
        // Every region still carries its exits — there is simply nothing paired.
        expect(result.grid.allRegions().every((r) => r.exits instanceof Map)).toBe(true);
        expect(connectionLinesOf(result)).toBe(0);
    });

    /**
     * ⛓⛓ **THE CLAIM IS ABOUT A COMMITTED DOCUMENT, not a fixture.** The
     * kickoff's row: the loaded `procgen_maze` seed-1 map now has ≥1 connection
     * line. The expected count is DERIVED from that document's own sidecars by
     * a second spelling that never calls the function under test.
     */
    it('⛓ the committed procgen_maze seed-1 document draws every pair it names', () => {
        const doc = JSON.parse(readFileSync(
            join(REPO, 'frontend/presets/procgen_maze/AP_1/AP_1_rules.json'), 'utf8'));
        const sidecars = doc.preset_sidecars['1'];
        const expected = reciprocalPairsOf(sidecars);
        expect(expected).toBeGreaterThanOrEqual(1);
        const result = reconstructResultFromSidecars(doc);
        expect(result.stats.regionsBuilt).toBe(Object.keys(sidecars).length);
        expect(connectionLinesOf(result)).toBe(expected);
    });
});
