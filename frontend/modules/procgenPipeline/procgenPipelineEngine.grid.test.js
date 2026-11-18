/**
 * ⛓⛓ THE `Grid` BOX (unbounded grid, slice S2): an optional origin, an UNBOUNDED kind, and the `grid_dims` /
 * `grid_origin` writer. ⚖ user 2026-11-15/16 (Q1: signed storage, the start room at (0,0)). Every driver still
 * builds a bounded, min-0 grid; these rows pin the new shapes and that the old shape is byte-identical.
 *
 * `test/data/unbounded-grid/grid_growth_3x2_seed5_serialized.json` was written by `serializeGrid` at `e4ce4854e5`
 * (the base, before S2), from `growMaze({gridDims: 3×2, regionSize: 6×6, itemPool: {key_red: 1}, obstaclePool:
 * {door_red: 1}, seed: 5})`: TODAY's transport format, with no origin field.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import '../mazeRoom/mazeRoomLibrary.js';
import {
    Grid, cellKey, serializeGrid, deserializeGrid, findDisconnectedCell, growMaze, buildRulesJson,
} from './procgenPipelineEngine.js';
import { gridOriginOf, recordedGridBox } from '../procgenCore/cellExtent.js';

const FIXTURE = fileURLToPath(new URL(
    '../../../test/data/unbounded-grid/grid_growth_3x2_seed5_serialized.json', import.meta.url));

const stub = (id) => ({ region_id: id, extracted_rules: { exits: [] } });
const rng0 = { next: () => 0 };

describe('Grid with an origin', () => {
    const box = () => new Grid({ width: 3, height: 2, minX: -2, minY: -1 });

    it('omitting the origin is today\'s grid: min (0,0), the same own fields', () => {
        const g = new Grid({ width: 3, height: 2 });
        expect(g.bounded).toBe(true);
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 3, h: 2, x: 0, y: 0 });
        expect(gridOriginOf(g)).toEqual({ minX: 0, minY: 0 });
        expect(Object.keys(g)).toEqual(['width', 'height', 'minX', 'minY', 'cells', 'teleporters']);
    });

    it('rejects a non-integer origin, and keeps rejecting a bad size', () => {
        expect(() => new Grid({ width: 3, height: 2, minX: 0.5 })).toThrow(/origin/);
        expect(() => new Grid({ width: 0, height: 2, minX: -1 })).toThrow(/invalid dimensions/);
        expect(() => new Grid(undefined)).toThrow(/invalid dimensions/);
    });

    it('isInBounds is [minX, minX+width) × [minY, minY+height)', () => {
        const g = box();
        for (const [gx, gy, ok] of [[-2, -1, true], [0, 0, true], [0, -1, true], [-3, 0, false],
            [1, 0, false], [-2, -2, false], [-2, 1, false]]) {
            expect(g.isInBounds({ gx, gy }), `(${gx},${gy})`).toBe(ok);
        }
    });

    it('places signed cells, stores them signed, and refuses outside the box', () => {
        const g = box();
        g.placeRegion({ gx: -2, gy: -1 }, stub('A'));
        expect(g.getRegion({ gx: -2, gy: -1 }).cell).toEqual({ gx: -2, gy: -1 });
        expect([...g.cells.keys()]).toEqual([cellKey({ gx: -2, gy: -1 })]);
        expect(() => g.placeRegion({ gx: 1, gy: 0 }, stub('B'))).toThrow(/out of bounds/);
    });

    it('neighbours stop at the box on both sides', () => {
        const g = box();
        expect(g.neighborCell({ gx: -2, gy: -1 }, 'W')).toBeNull();
        expect(g.neighborCell({ gx: -2, gy: -1 }, 'N')).toBeNull();
        expect(g.neighborCell({ gx: -2, gy: -1 }, 'E')).toEqual({ gx: -1, gy: -1 });
        expect(g.neighborCell({ gx: 0, gy: 0 }, 'E')).toBeNull();
        expect(g.neighborCell({ gx: 0, gy: 0 }, 'S')).toBeNull();
        g.placeRegion({ gx: -1, gy: -1 }, stub('A'));
        expect(g.openSides({ gx: -1, gy: -1 }).sort()).toEqual(['E', 'S', 'W']);
    });

    it('resize grows on the negative side, keeps every cell where it is, and is grow-only on each side', () => {
        const g = box();
        g.placeRegion({ gx: -2, gy: -1 }, stub('A'));
        g.setTeleporter({ gx: -2, gy: -1 }, 'x', { gx: 0, gy: 0 });
        g.resize({ width: 5, height: 4, minX: -4, minY: -2 });
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 5, h: 4, x: -4, y: -2 });
        expect(g.getRegion({ gx: -2, gy: -1 }).region_id).toBe('A');
        expect(g.getTeleporter({ gx: -2, gy: -1 }, 'x')).toEqual({ gx: 0, gy: 0 });
        expect(g.isInBounds({ gx: -4, gy: -2 })).toBe(true);
        expect(g.isInBounds({ gx: 0, gy: 1 })).toBe(true);
        // Today's call (no origin) keeps the origin and grows the far side.
        g.resize({ width: 6, height: 4 });
        expect({ x: g.minX, w: g.width }).toEqual({ x: -4, w: 6 });
        // Each side is grow-only: raising minX at all cuts the near edge; lowering it without enough width
        // cuts the far one. Lowering it WITH enough width is a grow.
        expect(() => g.resize({ width: 6, height: 4, minX: -3 })).toThrow(/does not contain/);
        expect(() => g.resize({ width: 7, height: 5, minX: -3, minY: -2 })).toThrow(/does not contain/);
        expect(() => g.resize({ width: 6, height: 4, minX: -5 })).toThrow(/does not contain/);
        g.resize({ width: 7, height: 4, minX: -5 });
        expect({ x: g.minX, w: g.width }).toEqual({ x: -5, w: 7 });
        // The origin-keeping shrink keeps today's message.
        expect(() => g.resize({ width: 2, height: 4 })).toThrow('Grid.resize is grow-only: 2x4 < 7x4');
    });

    it('findDisconnectedCell scans the box from its origin', () => {
        const g = new Grid({ width: 3, height: 1, minX: -5, minY: 7 });
        // Empty: the box centre, measured from the origin.
        expect(findDisconnectedCell(g, rng0)).toEqual({ gx: -4, gy: 7 });
        g.placeRegion({ gx: -5, gy: 7 }, stub('A'));
        // Only (-3, 7) is ≥ 2 away from (-5, 7).
        expect(findDisconnectedCell(g, rng0)).toEqual({ gx: -3, gy: 7 });
    });

    it('serialises the origin, only when it is not (0,0), and round-trips it', () => {
        const g = box();
        g.placeRegion({ gx: -2, gy: 0 }, stub('A'));
        g.setTeleporter({ gx: -2, gy: 0 }, 'e1', { gx: 0, gy: -1 });
        const s = serializeGrid(g);
        expect(Object.keys(s)).toEqual(['width', 'height', 'minX', 'minY', 'teleporters', 'cells']);
        expect({ minX: s.minX, minY: s.minY }).toEqual({ minX: -2, minY: -1 });
        const back = deserializeGrid(JSON.parse(JSON.stringify(s)));
        expect({ w: back.width, h: back.height, x: back.minX, y: back.minY }).toEqual({ w: 3, h: 2, x: -2, y: -1 });
        expect(back.getRegion({ gx: -2, gy: 0 }).region_id).toBe('A');
        expect(back.getTeleporter({ gx: -2, gy: 0 }, 'e1')).toEqual({ gx: 0, gy: -1 });
        expect(JSON.stringify(serializeGrid(back))).toBe(JSON.stringify(s));
        // An origin only on one axis is still carried, both fields.
        const s2 = serializeGrid(new Grid({ width: 1, height: 1, minX: 0, minY: 3 }));
        expect({ minX: s2.minX, minY: s2.minY }).toEqual({ minX: 0, minY: 3 });
    });
});

describe('Grid(null) — unbounded', () => {
    it('an EMPTY unbounded grid is 0×0 at (0,0): defined, never NaN', () => {
        const g = new Grid(null);
        expect(g.bounded).toBe(false);
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 0, h: 0, x: 0, y: 0 });
        expect(gridOriginOf(g)).toEqual({ minX: 0, minY: 0 });
        // The empty-grid branch of findDisconnectedCell lands on (0,0): the Q1 start cell.
        expect(findDisconnectedCell(g, rng0)).toEqual({ gx: 0, gy: 0 });
    });

    it('every integer cell is in bounds; a neighbour is never null', () => {
        const g = new Grid(null);
        expect(g.isInBounds({ gx: -1000, gy: 1e6 })).toBe(true);
        expect(g.isInBounds({ gx: 0.5, gy: 0 })).toBe(false);
        expect(g.neighborCell({ gx: 0, gy: 0 }, 'W')).toEqual({ gx: -1, gy: 0 });
        expect(g.neighborCell({ gx: 0, gy: 0 }, 'N')).toEqual({ gx: 0, gy: -1 });
        expect(g.openSides({ gx: 0, gy: 0 }).sort()).toEqual(['E', 'N', 'S', 'W']);
    });

    it('width/height/minX/minY track the placed cells (place, move, remove)', () => {
        const g = new Grid(null);
        g.placeRegion({ gx: 0, gy: 0 }, stub('S'));
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 1, h: 1, x: 0, y: 0 });
        g.placeRegion({ gx: -3, gy: 2 }, stub('A'));
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 4, h: 3, x: -3, y: 0 });
        g.relocateRegions([{ from: { gx: -3, gy: 2 }, to: { gx: 5, gy: -4 } }]);
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 6, h: 5, x: 0, y: -4 });
        g.removeRegion({ gx: 5, gy: -4 });
        expect({ w: g.width, h: g.height, x: g.minX, y: g.minY }).toEqual({ w: 1, h: 1, x: 0, y: 0 });
    });

    it('resize refuses: there is no box to grow', () => {
        expect(() => new Grid(null).resize({ width: 9, height: 9 })).toThrow(/unbounded/);
    });

    it('serialises as {unbounded: true} and round-trips', () => {
        const g = new Grid(null);
        g.placeRegion({ gx: -1, gy: 0 }, stub('A'));
        const s = serializeGrid(g);
        expect(Object.keys(s)).toEqual(['unbounded', 'teleporters', 'cells']);
        const back = deserializeGrid(JSON.parse(JSON.stringify(s)));
        expect(back.bounded).toBe(false);
        expect({ w: back.width, x: back.minX }).toEqual({ w: 1, x: -1 });
        expect(JSON.stringify(serializeGrid(back))).toBe(JSON.stringify(s));
    });
});

describe('today\'s transport format (back compat)', () => {
    it('a grid serialised at the base, with no origin, deserialises to a min-0 Grid and re-serialises byte for byte', () => {
        const text = readFileSync(FIXTURE, 'utf8');
        const obj = JSON.parse(text);
        expect(Object.keys(obj)).toEqual(['width', 'height', 'teleporters', 'cells']);
        const g = deserializeGrid(obj);
        expect({ bounded: g.bounded, w: g.width, h: g.height, x: g.minX, y: g.minY })
            .toEqual({ bounded: true, w: 3, h: 2, x: 0, y: 0 });
        expect(`${JSON.stringify(serializeGrid(g))}\n`).toBe(text);
    });

    it('a min-0 grid grown today serialises with no origin field', () => {
        const { grid } = growMaze({
            gridDims: { width: 3, height: 2 }, regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 1 }, obstaclePool: { door_red: 1 }, seed: 5, regionParams: {},
        });
        expect(`${JSON.stringify(serializeGrid(grid))}\n`).toBe(readFileSync(FIXTURE, 'utf8'));
    });
});

describe('grid_dims / grid_origin (the writer)', () => {
    it('recordedGridBox: the cells\' box widened to (0,0); an origin only when it is negative', () => {
        expect(recordedGridBox([])).toEqual({ grid_dims: { width: 0, height: 0 }, grid_origin: null });
        // min 0, and min ABOVE 0 (seedling_atlas_sphere AP_1 starts at (4,4)): max + 1, as before S2.
        expect(recordedGridBox([{ gx: 0, gy: 0 }, { gx: 2, gy: 1 }]))
            .toEqual({ grid_dims: { width: 3, height: 2 }, grid_origin: null });
        expect(recordedGridBox([{ gx: 4, gy: 4 }, { gx: 6, gy: 5 }]))
            .toEqual({ grid_dims: { width: 7, height: 6 }, grid_origin: null });
        // A negative min: max − min + 1 from the min, which is the origin.
        expect(recordedGridBox([{ gx: -2, gy: 1 }, { gx: 1, gy: 3 }]))
            .toEqual({ grid_dims: { width: 4, height: 4 }, grid_origin: { gx: -2, gy: 0 } });
        expect(recordedGridBox([{ gx: 3, gy: -1 }]))
            .toEqual({ grid_dims: { width: 4, height: 2 }, grid_origin: { gx: 0, gy: -1 } });
    });

    it('buildRulesJson: a translated, unbounded grid writes the same document but grid_cell, + grid_origin', () => {
        const opts = {
            gridDims: { width: 3, height: 2 }, regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 1 }, obstaclePool: { door_red: 1 }, seed: 5, regionParams: {},
        };
        const { grid, startCell } = growMaze(opts);
        const meta = { procgenMetadata: { driver: 'grid-growth' } };
        const base = buildRulesJson(grid, { startCell, ...meta });
        expect(base.procgen_metadata['1'].grid_dims).toEqual({ width: 3, height: 2 });
        expect(Object.hasOwn(base.procgen_metadata['1'], 'grid_origin')).toBe(false);

        // The same regions, translated so the start room sits at (0,0), on an UNBOUNDED grid.
        const dx = -startCell.gx;
        const dy = -startCell.gy;
        const shift = (c) => ({ gx: c.gx + dx, gy: c.gy + dy });
        const moved = new Grid(null);
        for (const r of grid.allRegions()) moved.placeRegion(shift(r.cell), r);
        for (const [k, v] of grid.teleporters) {
            const [from, exit] = k.split(':');
            const [fx, fy] = from.split(',').map(Number);
            const [tx, ty] = v.split(',').map(Number);
            moved.setTeleporter(shift({ gx: fx, gy: fy }), exit, shift({ gx: tx, gy: ty }));
        }
        expect(moved.minX).toBeLessThan(0);
        const out = buildRulesJson(moved, { startCell: { gx: 0, gy: 0 }, ...meta });
        const m = out.procgen_metadata['1'];
        expect(m.grid_dims).toEqual({ width: 3, height: 2 });
        expect(m.grid_origin).toEqual({ gx: dx, gy: dy });
        expect(Object.keys(m).indexOf('grid_origin')).toBe(Object.keys(m).indexOf('grid_dims') + 1);

        // Everything else is the same document: put the cells back and drop the origin.
        for (const sc of Object.values(out.preset_sidecars['1'])) {
            if (sc.grid_cell) sc.grid_cell = { gx: sc.grid_cell.gx - dx, gy: sc.grid_cell.gy - dy };
        }
        delete m.grid_origin;
        expect(out).toEqual(base);
    });
});
