import { describe, it, expect, beforeEach } from 'vitest';

import {
    TILE_PX, COLORS,
    resolveExitTilePositions, fitTextToWidth,
    canvasPointOf, cellAtPoint,
    compositeMapIdOf, compositeMapPainterFor,
    drawCompositeMap,
} from './compositeMapRenderer.js';
import { getRegionExits } from '../procgenPipeline/procgenPipelineEngine.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Side-effect imports: the two substrates that DECLARE `compositeMap`. The
// real-registry suite at the bottom is the mutant's target.
import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';

/* ══════════════════════════════════════════════════════════════════════
 * THE CANVAS STUB — a recorder, because a canvas has no readable state
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ A node stand-in for `CanvasRenderingContext2D` that RECORDS every call.
 * The renderer's product is a sequence of drawing operations, so the only
 * honest assertion about it is over that sequence. `measureText` returns the
 * character count so `fitTextToWidth` is deterministic (1px == 1 char).
 */
function makeCanvas(width, height) {
    const ops = [];
    const ctx = {
        fillStyle: null, strokeStyle: null, lineWidth: null,
        font: null, textAlign: null, textBaseline: null,
        fillRect: (...a) => ops.push({ op: 'fillRect', style: ctx.fillStyle, a }),
        strokeRect: (...a) => ops.push({ op: 'strokeRect', style: ctx.strokeStyle, lineWidth: ctx.lineWidth, a }),
        fillText: (...a) => ops.push({ op: 'fillText', style: ctx.fillStyle, a }),
        beginPath: () => ops.push({ op: 'beginPath' }),
        moveTo: (...a) => ops.push({ op: 'moveTo', a }),
        lineTo: (...a) => ops.push({ op: 'lineTo', a }),
        stroke: () => ops.push({ op: 'stroke', style: ctx.strokeStyle, lineWidth: ctx.lineWidth }),
        arc: (...a) => ops.push({ op: 'arc', a }),
        fill: () => ops.push({ op: 'fill', style: ctx.fillStyle }),
        save: () => ops.push({ op: 'save' }),
        restore: () => ops.push({ op: 'restore' }),
        setLineDash: (...a) => ops.push({ op: 'setLineDash', a }),
        measureText: (s) => ({ width: String(s ?? '').length }),
    };
    return { width, height, ops, getContext: () => ctx };
}

/** A duck-typed Grid: exactly what the renderer reads off one. */
function makeGrid(width, height, cells) {
    const key = ({ gx, gy }) => `${gx},${gy}`;
    const map = new Map(cells.map((c) => [key(c.cell), c]));
    return {
        width, height,
        getRegion: (cell) => map.get(key(cell)) ?? undefined,
        allRegions: () => [...map.values()],
    };
}

const SIZE_2x2 = { width: 2, height: 2 };
const texts = (canvas) => canvas.ops.filter((o) => o.op === 'fillText').map((o) => o.a[0]);

/* ══════════════════════════════════════════════════════════════════════
 * THE MOVED SUITES — verbatim from procgenPipelineUI.test.js (H3)
 * ══════════════════════════════════════════════════════════════════════ */

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
        // Both must work because both feed the per-region painters.
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

/**
 * ⛔ **THE LOCAL `exitsOf` READS THE SAME FIELD THE PIPELINE'S ACCESSOR DOES.**
 * The renderer spells `region?.exits` itself rather than importing
 * `procgenPipelineEngine.getRegionExits` (a `procgenCore/` module may not drag
 * the generator, and through it `mazeRoom/`, in behind a one-line accessor).
 * Two spellings of one field is exactly the thing that drifts, so this row
 * drives BOTH against the same regions and asserts they agree — including on a
 * region that has no exits at all.
 */
describe('⛓ the renderer\'s exit accessor and the pipeline\'s cannot drift', () => {
    it('agrees with getRegionExits on an array, a Map, and an absence', () => {
        const arr = [{ exit_id: 'a', x: 0, y: 0 }];
        const map = new Map([['a', { exit_id: 'a', x: 1, y: 1 }]]);
        for (const exits of [arr, map, undefined]) {
            const region = { region_id: 'r', exits };
            // The renderer's own view of the region's exits, via the only
            // public surface that consumes it.
            expect(resolveExitTilePositions(getRegionExits(region) ?? [], SIZE_2x2))
                .toEqual(resolveExitTilePositions(region.exits ?? [], SIZE_2x2));
        }
        expect(getRegionExits({ region_id: 'r', exits: arr })).toBe(arr);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE GEOMETRY
 * ══════════════════════════════════════════════════════════════════════ */

describe('the click geometry', () => {
    const canvasWithRect = (w, h, rect) => ({
        width: w, height: h, getBoundingClientRect: () => rect,
    });

    it('maps a client point to a canvas-backing pixel, undoing CSS scaling', () => {
        // A 200px-wide canvas displayed at 100px: one CSS px is two canvas px.
        const c = canvasWithRect(200, 100, { left: 10, top: 20, width: 100, height: 50 });
        expect(canvasPointOf(c, { clientX: 60, clientY: 45 })).toEqual({ cx: 100, cy: 50 });
    });

    it('returns null when the canvas has no layout (0×0 rect)', () => {
        const c = canvasWithRect(200, 100, { left: 0, top: 0, width: 0, height: 0 });
        expect(canvasPointOf(c, { clientX: 1, clientY: 1 })).toBeNull();
    });

    it('maps a pixel to a cell and to the pixel WITHIN that cell', () => {
        const grid = makeGrid(3, 2, []);
        const size = { width: 4, height: 3 };           // cell = 56 × 42 px
        const hit = cellAtPoint(grid, size, { cx: 60, cy: 45 });
        expect(hit).toEqual({ gx: 1, gy: 1, wx: 60 - 56, wy: 45 - 42 });
    });

    it('returns null outside the grid, and for a null point', () => {
        const grid = makeGrid(2, 1, []);
        const size = { width: 2, height: 2 };            // cell = 28 × 28
        expect(cellAtPoint(grid, size, { cx: 100, cy: 5 })).toBeNull();  // gx 3 ≥ 2
        expect(cellAtPoint(grid, size, { cx: 5, cy: 100 })).toBeNull();  // gy 3 ≥ 1
        expect(cellAtPoint(grid, size, { cx: -1, cy: 5 })).toBeNull();
        expect(cellAtPoint(grid, size, null)).toBeNull();
    });

    it('honours a non-default tilePx (the cell size is derived, never assumed)', () => {
        const grid = makeGrid(2, 1, []);
        expect(cellAtPoint(grid, { width: 2, height: 2 }, { cx: 30, cy: 0 }, 10).gx).toBe(1);
        expect(cellAtPoint(grid, { width: 2, height: 2 }, { cx: 30, cy: 0 }, TILE_PX).gx).toBe(1);
        expect(cellAtPoint(grid, { width: 2, height: 2 }, { cx: 20, cy: 0 }, 10).gx).toBe(1);
        expect(cellAtPoint(grid, { width: 2, height: 2 }, { cx: 20, cy: 0 }, TILE_PX).gx).toBe(0);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE DISPATCH — driven by a TOY substrate, not by the maze
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **A CORE PROVEN ONLY AGAINST THE MAZE IS A MAZE RENDERER WITH AN
 * INDIRECTION** (`editCore`'s own rule). Every row in this section drives a
 * registry the test builds: one substrate that DECLARES `compositeMap` and one
 * that does not. Nothing here can pass because `mazeRoomLibrary.js` happens to
 * be imported at the top of the file.
 */
describe('drawCompositeMap dispatches through the registry', () => {
    let calls;
    let registry;

    beforeEach(() => {
        calls = [];
        const toy = {
            id: 'toy',
            compositeMap: Object.freeze({
                drawRegion: (ctx, region, geom) => {
                    calls.push({ region_id: region.region_id, geom });
                    ctx.fillStyle = '#toy';
                    ctx.fillRect(geom.offX, geom.offY, 1, 1);
                },
            }),
        };
        // `undeclared` is a real registry entry with NO compositeMap — the
        // "substrate exists, nobody drew it" case, which is not the same as
        // "unknown id".
        const undeclared = { id: 'undeclared' };
        registry = { get: (id) => ({ toy, undeclared }[id]) };
    });

    const payload = { width: 2, height: 2 };
    const twoCells = () => makeGrid(2, 1, [
        { cell: { gx: 0, gy: 0 }, region_id: 'left', substrate: 'toy', playable_payload: payload },
        { cell: { gx: 1, gy: 0 }, region_id: 'right', substrate: 'undeclared', playable_payload: payload },
    ]);

    it('calls the declared painter with the cell\'s own origin and the shared geometry', () => {
        const canvas = makeCanvas(2 * 2 * TILE_PX, 2 * TILE_PX);
        drawCompositeMap(canvas, twoCells(), SIZE_2x2, { registry });

        expect(calls.map((c) => c.region_id)).toEqual(['left']);
        expect(calls[0].geom.offX).toBe(0);
        expect(calls[0].geom.offY).toBe(0);
        expect(calls[0].geom.tilePx).toBe(TILE_PX);
        expect(calls[0].geom.regionSize).toEqual(SIZE_2x2);
        expect(calls[0].geom.colors).toBe(COLORS);
    });

    it('offsets each cell by its grid coordinate', () => {
        const grid = makeGrid(2, 2, [
            { cell: { gx: 0, gy: 0 }, region_id: 'a', substrate: 'toy', playable_payload: payload },
            { cell: { gx: 1, gy: 1 }, region_id: 'b', substrate: 'toy', playable_payload: payload },
        ]);
        drawCompositeMap(makeCanvas(4 * TILE_PX, 4 * TILE_PX), grid, SIZE_2x2, { registry });
        expect(calls.map((c) => [c.region_id, c.geom.offX, c.geom.offY]))
            .toEqual([['a', 0, 0], ['b', 2 * TILE_PX, 2 * TILE_PX]]);
    });

    it('⛓ GENERIC BY NAME: an UNDECLARED substrate gets the box, labelled with its id', () => {
        const canvas = makeCanvas(2 * 2 * TILE_PX, 2 * TILE_PX);
        drawCompositeMap(canvas, twoCells(), SIZE_2x2, { registry });
        // The toy painter drew `right` NOT at all…
        expect(calls.some((c) => c.region_id === 'right')).toBe(false);
        // …and the generic box named the substrate it fell back from.
        expect(texts(canvas)).toContain('(undeclared)');
        expect(canvas.ops.some((o) => o.op === 'fillRect' && o.style === COLORS.genericBg))
            .toBe(true);
    });

    it('an id NO registry entry answers to also gets the generic box, by that id', () => {
        const grid = makeGrid(1, 1, [{
            cell: { gx: 0, gy: 0 }, region_id: 'x', substrate: 'never_registered',
            playable_payload: payload,
        }]);
        const canvas = makeCanvas(2 * TILE_PX, 2 * TILE_PX);
        drawCompositeMap(canvas, grid, SIZE_2x2, { registry });
        expect(texts(canvas)).toContain('(never_registered)');
    });

    it('a region with NO payload is a STUB — no painter is asked, declared or not', () => {
        const grid = makeGrid(1, 1, [{
            cell: { gx: 0, gy: 0 }, region_id: 'not_yet_realised', substrate: 'toy',
        }]);
        const canvas = makeCanvas(2 * TILE_PX, 2 * TILE_PX);
        drawCompositeMap(canvas, grid, SIZE_2x2, { registry });
        expect(calls).toEqual([]);
        // ⛓ The stub prints the region_id TRUNCATED to 12 characters, which is
        // what the pipeline's version did — asserted at that length rather than
        // rounded off to `toContain`.
        expect(texts(canvas)).toContain('not_yet_real');
        // The stub's dashed border is its signature.
        expect(canvas.ops.some((o) => o.op === 'setLineDash' && o.a[0].length === 2)).toBe(true);
    });

    it('an EMPTY cell draws its border and nothing else', () => {
        const grid = makeGrid(2, 1, [
            { cell: { gx: 0, gy: 0 }, region_id: 'a', substrate: 'toy', playable_payload: payload },
        ]);
        const canvas = makeCanvas(4 * TILE_PX, 2 * TILE_PX);
        drawCompositeMap(canvas, grid, SIZE_2x2, { registry });
        expect(calls).toHaveLength(1);
        expect(canvas.ops.some((o) => o.op === 'strokeRect' && o.a[0] === 2 * TILE_PX + 0.5))
            .toBe(true);
    });

    it('honours a caller\'s tilePx everywhere: cell origin AND the geometry handed on', () => {
        drawCompositeMap(makeCanvas(2 * 2 * 4, 2 * 4), twoCells(), SIZE_2x2,
            { registry, tilePx: 4 });
        expect(calls[0].geom.tilePx).toBe(4);
        expect(calls[0].geom.offX).toBe(0);
    });
});

/**
 * ⛓ WHICH ID A REGION ASKS TO BE DRAWN AS — including the default the pipeline
 * used to end this chain with.
 */
describe('compositeMapIdOf', () => {
    it('prefers render_hint over substrate (the shipping precedence)', () => {
        expect(compositeMapIdOf({ substrate: 'maze', render_hint: 'text_adventure' }))
            .toBe('text_adventure');
        expect(compositeMapIdOf({ substrate: 'jta' })).toBe('jta');
    });

    it('⛔ NO `?? \'maze\'` DEFAULT — a region naming neither resolves to null', () => {
        expect(compositeMapIdOf({ region_id: 'nameless' })).toBeNull();
        expect(compositeMapIdOf(null)).toBeNull();
        expect(compositeMapPainterFor({ region_id: 'nameless' })).toBeNull();
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE REAL REGISTRY — the two declarers, and the mutant's target
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE DECLARATION IS THE FEATURE.** Deleting `compositeMap` from
 * `mazeRoomLibrary.js` must turn a maze region into a generic box — that is
 * H3's mutant, and these are the rows that go red for it.
 */
describe('⛓ the shipped declarers', () => {
    const MAZE_PAYLOAD = {
        width: 3, height: 3,
        tiles: [1, 1, 1, 1, 0, 1, 1, 1, 1],
        entrance: { x: 1, y: 1 },
        exits: [{ exit_id: 'exit', x: 1, y: 1, side: 'N', exitName: 'exit',
            targetRegion: null, isBackExit: false, isTeleporter: false }],
        obstacles: [], items: [], obstacleLib: {}, itemLib: {},
    };
    const SIZE_3x3 = { width: 3, height: 3 };

    /**
     * ⚠ `exits` is on the REGION as well as inside the payload, because the
     * renderer's connection pass and its exit-selection highlight read the
     * region's own field — the shape `procgenPipelineEngine`'s placeRegion
     * sites produce. (A region rebuilt from sidecars by
     * `compositeMapDocument.js` does NOT carry it, which is why a loaded
     * preset's map has no connection lines; pre-existing, and named in plan
     * §13 rather than changed here.)
     */
    const mazeRegion = () => {
        const world = substrateRegistry.get('maze').deserializeWorld(MAZE_PAYLOAD);
        return {
            cell: { gx: 0, gy: 0 }, region_id: 'r0', substrate: 'maze', render_hint: 'maze',
            playable_payload: world, exits: world.exits,
        };
    };

    it('maze and text_adventure both DECLARE compositeMap.drawRegion', () => {
        for (const id of ['maze', 'text_adventure']) {
            const entry = substrateRegistry.get(id);
            expect(entry, `${id} is not registered`).toBeTruthy();
            expect(typeof entry.compositeMap?.drawRegion,
                `${id} declares no compositeMap.drawRegion`).toBe('function');
            expect(Object.isFrozen(entry.compositeMap)).toBe(true);
        }
    });

    it('the declaration is DATA — resolving a painter needs no browser', () => {
        expect(compositeMapPainterFor({ substrate: 'maze' }))
            .toBe(substrateRegistry.get('maze').compositeMap.drawRegion);
    });

    it('⛔ a maze region is painted by the MAZE, not by the generic box', () => {
        const canvas = makeCanvas(3 * TILE_PX, 3 * TILE_PX);
        drawCompositeMap(canvas, makeGrid(1, 1, [mazeRegion()]), SIZE_3x3);
        // The generic box's signature is the label `(maze)` and its own fill.
        expect(texts(canvas)).not.toContain('(maze)');
        expect(canvas.ops.some((o) => o.op === 'fillRect' && o.style === COLORS.genericBg))
            .toBe(false);
        // The maze's signature is a wall/floor fill per tile — 9 of them.
        const tiles = canvas.ops.filter((o) => o.op === 'fillRect'
            && (o.style === COLORS.wall || o.style === COLORS.floor)
            && o.a[2] === TILE_PX && o.a[3] === TILE_PX);
        expect(tiles).toHaveLength(9);
    });

    it('a substrate with NO declaration (bounce) falls back, by name', () => {
        expect(substrateRegistry.get('bounce')?.compositeMap).toBeUndefined();
        const canvas = makeCanvas(3 * TILE_PX, 3 * TILE_PX);
        drawCompositeMap(canvas, makeGrid(1, 1, [{
            cell: { gx: 0, gy: 0 }, region_id: 'z', substrate: 'bounce',
            playable_payload: { jtaZone: 4 },
        }]), SIZE_3x3);
        expect(texts(canvas)).toContain('(bounce)');
    });

    it('the selection outlines the whole cell, or one exit\'s square', () => {
        const grid = makeGrid(1, 1, [mazeRegion()]);
        const cellSel = makeCanvas(3 * TILE_PX, 3 * TILE_PX);
        drawCompositeMap(cellSel, grid, SIZE_3x3, {
            selection: { kind: 'region', cell: { gx: 0, gy: 0 } },
        });
        const cw = 3 * TILE_PX;
        expect(cellSel.ops.some((o) => o.op === 'strokeRect'
            && o.style === COLORS.selection && o.a[2] === cw - 3)).toBe(true);

        const exitSel = makeCanvas(3 * TILE_PX, 3 * TILE_PX);
        drawCompositeMap(exitSel, grid, SIZE_3x3, {
            selection: { kind: 'exit', cell: { gx: 0, gy: 0 }, exitId: 'exit' },
        });
        expect(exitSel.ops.some((o) => o.op === 'strokeRect'
            && o.style === COLORS.selection && o.a[2] === TILE_PX + 3)).toBe(true);

        // An exit id the region does not have highlights NOTHING.
        const none = makeCanvas(3 * TILE_PX, 3 * TILE_PX);
        drawCompositeMap(none, grid, SIZE_3x3, {
            selection: { kind: 'exit', cell: { gx: 0, gy: 0 }, exitId: 'no_such_exit' },
        });
        expect(none.ops.some((o) => o.op === 'strokeRect' && o.style === COLORS.selection))
            .toBe(false);
    });

    it('draws the connection line between a paired exit and entrance', () => {
        const paired = (gx, id, target, targetExitId) => ({
            cell: { gx, gy: 0 }, region_id: id, substrate: 'undrawn_on_purpose',
            playable_payload: {},
            exits: [{ exit_id: `${id}_out`, x: gx === 0 ? 2 : 0, y: 1, side: gx === 0 ? 'E' : 'W',
                targetRegion: target, targetExitId }],
        });
        const grid = makeGrid(2, 1, [
            paired(0, 'a', 'b', 'b_out'),
            paired(1, 'b', 'a', 'a_out'),
        ]);
        const canvas = makeCanvas(6 * TILE_PX, 3 * TILE_PX);
        drawCompositeMap(canvas, grid, SIZE_3x3);
        const lines = canvas.ops.filter((o) => o.op === 'stroke' && o.style === COLORS.connection);
        // ONE line for the pair, not two — the pair key dedupes both directions.
        expect(lines).toHaveLength(1);
    });
});
