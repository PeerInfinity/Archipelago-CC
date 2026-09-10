import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { reconstructResultFromSidecars } from './compositeMapDocument.js';
import { DEFAULT_REGION_SIZE } from './procgenPipelineEngine.js';
import { drawCompositeMap, COLORS, TILE_PX } from '../procgenCore/compositeMapRenderer.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Side-effect import: registers the maze substrate so deserializeWorld
// resolves through substrateRegistry when reconstructResultFromSidecars
// runs in the test environment.
import '../mazeRoom/mazeRoomLibrary.js';
// ⛓ M0 — and the ZONE substrate the four-player fixture's slots 3/4 carry.
// Before M0 no row here needed it: a bounce slot returned null before any
// adapter was asked for a world.
import '../bounceDemo/bounceDemoLibrary.js';

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

/* ══════════════════════════════════════════════════════════════════════
 * M0 — THE CELL SIZE, AND THE ZONE WORLDS THAT NOW DRAW
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The slot's own `grid_cell` count — the expectation, read off the document. */
function cellsIn(sidecars) {
    return Object.values(sidecars ?? {}).filter((sc) => !!sc?.grid_cell).length;
}

/**
 * ⛓ The largest tile-grid payload in a slot, spelled a second way — over the
 * on-disk arrays, never through the function under test. `null` when no entry
 * carries tile geometry at all, which is what makes a zone slot a zone slot.
 */
function tilePayloadSizeOf(sidecars) {
    let w = 0;
    let h = 0;
    for (const sc of Object.values(sidecars ?? {})) {
        const p = sc?.playable_payload ?? {};
        if (Number.isFinite(p.width) && p.width > w) w = p.width;
        if (Number.isFinite(p.height) && p.height > h) h = p.height;
    }
    return (w > 0 && h > 0) ? { width: w, height: h } : null;
}

const readPreset = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));

const FOUR_PLAYER = 'frontend/presets/multiworld/AP_05594871498841892311/'
    + 'AP_05594871498841892311_rules.json';
/**
 * ⛓ A committed slot whose payloads carry tile geometry **that is not the
 * engine's default**. It has to be: every other tile-grid document in the
 * corpus is 8×6 — the same numbers `DEFAULT_REGION_SIZE` holds — so a row built
 * on one of those agrees with a fallback that ignored the payload entirely, and
 * the precedence mutant would stay green. Measured over the 42 populated slots:
 * this one is 20×20 and the three `procgen_topdown/AP_7…9` are 22×20; the other
 * 22 that draw a tile grid are all 8×6.
 */
const NON_DEFAULT_TILE_PRESET = 'frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json';

describe('reconstructResultFromSidecars — the cell size (M0)', () => {
    /**
     * ⛓⛓ **THE ZONE SLOT THAT USED TO BE "no map".** The four-player fixture's
     * slot 3 is `Bounce Demo WorldGen`: five regions, a `grid_cell` on every
     * one, and no `width`/`height` in the payload at all — a bounce level's
     * geometry is `params.bounceLevel.size` in PIXELS. Until M0 the function
     * returned null here before placing a region, and the hub said so.
     *
     * ⛔ MUTANT A (the fallback removed, `maxW === 0 ⇒ null` restored): this row
     * reds and the two payload rows below stay green.
     */
    it('⛓ a ZONE slot draws, at the engine default cell size', () => {
        const doc = readPreset(FOUR_PLAYER);
        const sidecars = doc.preset_sidecars['3'];
        // The premise, off the document: cells everywhere, tile geometry nowhere.
        expect(cellsIn(sidecars)).toBeGreaterThan(0);
        expect(tilePayloadSizeOf(sidecars)).toBeNull();

        const r = reconstructResultFromSidecars(doc, { playerId: '3' });
        expect(r).not.toBeNull();
        expect(r.regionSizeSource).toBe('default');
        expect(r.regionSize).toEqual({ ...DEFAULT_REGION_SIZE });
        expect(r.stats.regionsBuilt).toBe(cellsIn(sidecars));
    });

    /**
     * ⛓ **PRECEDENCE (a) OVER (c), ON A COMMITTED DOCUMENT.** The size is the
     * document's own largest payload, derived here by a second spelling — and
     * the row asserts it DIFFERS from the default, because a fixture that
     * agreed with the fallback could not tell the two rules apart (which is
     * exactly what a row on any 8×6 preset would be).
     *
     * ⛔ MUTANT B (the default consulted before the payload): this row reds.
     */
    it('⛓ a TILE-GRID slot keeps its own size, which is not the default', () => {
        const doc = readPreset(NON_DEFAULT_TILE_PRESET);
        const sidecars = doc.preset_sidecars['1'];
        const expected = tilePayloadSizeOf(sidecars);
        expect(expected).not.toBeNull();
        expect(expected).not.toEqual({ ...DEFAULT_REGION_SIZE });

        const r = reconstructResultFromSidecars(doc, { playerId: '1' });
        expect(r.regionSizeSource).toBe('payload');
        expect(r.regionSize).toEqual(expected);
    });

    /**
     * ⛓ …and MIXED, which is the case the corpus cannot show: every committed
     * slot that mixes a tile-grid substrate with a zone one is 8×6, so a
     * committed mixed row would agree with the fallback. Here one region carries
     * tile geometry and the other carries none, at a size the default is not.
     *
     * ⛔ MUTANT B again, and this one is the mixed half of it.
     */
    it('⛓ ONE tile-grid region in a slot sizes the whole slot', () => {
        const tiled = minimalSidecar(0, 0);
        tiled.playable_payload.width = 5;
        tiled.playable_payload.height = 4;
        tiled.playable_payload.tiles = new Array(20).fill(1);
        tiled.playable_payload.tiles[2 * 5 + 2] = 0;
        tiled.playable_payload.entrance = { x: 2, y: 2 };
        tiled.playable_payload.exits[0] = { ...tiled.playable_payload.exits[0], x: 2, y: 2 };
        // ⛔ The zone half is a REAL committed bounce entry, not a maze sidecar
        //   with its `width`/`height` deleted: that would be a payload no
        //   serializer writes, and `deserializeMazeWorld` throws on it — so the
        //   row would have been testing a shape the corpus cannot hold.
        const zone = { ...Object.values(readPreset(FOUR_PLAYER).preset_sidecars['3'])[0] };
        zone.grid_cell = { gx: 1, gy: 0 };
        expect(tilePayloadSizeOf({ zone })).toBeNull();

        const r = reconstructResultFromSidecars({
            preset_sidecars: { 1: { tiled, zone } },
        });
        expect(r.regionSizeSource).toBe('payload');
        expect(r.regionSize).toEqual({ width: 5, height: 4 });
        expect(r.stats.regionsBuilt).toBe(2);
    });

    /**
     * ⛓⛓ **THE SEAM, DRIVEN.** No shipped substrate declares a
     * `compositeMap.cellSize` — by ⚖, because nothing measured needs a size
     * other than the default and a declaration nobody needs is a hand list of
     * substrate names. So the row that proves the branch exists registers its
     * OWN entry and removes it again: a real substrate given a declaration for
     * the sake of a test would be that hand list.
     *
     * ⛔ MUTANT C (the declaration ignored): this row reds; the two above stay
     * green, because neither slot has a declaring substrate in it.
     */
    it('⛓ a DECLARED compositeMap.cellSize wins over the engine default', () => {
        const id = 'm0_scratch_declares_a_cell_size';
        // ⛔ `substrateRegistry.clear()` is the wrong tool — it would drop the
        //    maze and bounce registrations every other row in this file needs.
        substrateRegistry.register({
            id,
            deserializeWorld: (payload) => ({ ...payload, exits: new Map() }),
            compositeMap: { cellSize: { width: 13, height: 7 } },
        });
        try {
            const sc = minimalSidecar(0, 0);
            sc.substrate = id;
            sc.render_hint = id;
            delete sc.playable_payload.width;
            delete sc.playable_payload.height;
            const r = reconstructResultFromSidecars({ preset_sidecars: { 1: { only: sc } } });
            expect(r.regionSizeSource).toBe('declared');
            expect(r.regionSize).toEqual({ width: 13, height: 7 });
            expect(r.regionSize).not.toEqual({ ...DEFAULT_REGION_SIZE });
            expect(r.stats.regionsBuilt).toBe(1);
        } finally {
            substrateRegistry.entries.delete(id);
        }
    });

    /**
     * ⛓ **AND THE NULL THAT SURVIVES.** M0 moved the null rule to "no region
     * could be placed"; a slot whose entries carry no `grid_cell` still has no
     * layout to draw, however sizeable its payloads are. Two of the corpus's
     * four remaining nulls are this case with a real tile payload behind them
     * (the atlas-derived rooms), which is why the fixture keeps its geometry.
     */
    it('⛓ a slot with NO grid_cell on any entry is still null', () => {
        const a = minimalSidecar(0, 0);
        const b = minimalSidecar(1, 0);
        delete a.grid_cell;
        delete b.grid_cell;
        expect(tilePayloadSizeOf({ a, b })).not.toBeNull();
        expect(reconstructResultFromSidecars({ preset_sidecars: { 1: { a, b } } })).toBeNull();
    });
});
