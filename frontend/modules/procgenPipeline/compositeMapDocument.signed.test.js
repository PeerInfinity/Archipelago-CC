/**
 * ⛓⛓ UNBOUNDED GRID S1 — **A SIGNED LAYOUT DRAWS, PICKS, LAYS OUT AND LINTS LIKE ITS MIN-0 TWIN.**
 *
 * The fixture `test/data/unbounded-grid/procgen_maze_AP_3_signed_rules.json` is the committed
 * `procgen_maze/AP_3` document with every `grid_cell` of slot 1 translated by (−2, −2), so the
 * grid-growth start room `region_2_2` sits at (0,0) (⚖ user 2026-11-16, Q1: signed storage, the start
 * at (0,0)); its cells span (−2,−1)…(1,2), mixed signs. Its `procgen_metadata[1]` keeps `grid_dims`
 * 4×5 and declares `grid_origin` (−2,−2) — the translated declared box, the shape S2 will write. Region
 * NAMES are untouched (renaming is the regeneration's, S4).
 *
 * The twin is the committed preset itself: same pixels, same rects, same picks minus the translation.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { gridForBox, mapBoundsFor, reconstructResultFromSidecars } from './compositeMapDocument.js';
import {
    cellAtPoint, cellOriginPx, drawCompositeMap, TILE_PX,
} from '../procgenCore/compositeMapRenderer.js';
import { cellExtent, drawnBox, gridOriginOf, isSignedCell } from '../procgenCore/cellExtent.js';
import { isGridCell, slotLayout } from '../apworldEditor/regionLayout.js';
import { sidecarIssues, SIDECAR_ISSUE_KINDS as K } from '../apworldEditor/sidecarIssues.js';
// Side-effect import: registers the maze substrate so deserializeWorld resolves.
import '../mazeRoom/mazeRoomLibrary.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const SIGNED = () => read('test/data/unbounded-grid/procgen_maze_AP_3_signed_rules.json');
const TWIN = () => read('frontend/presets/procgen_maze/AP_3/AP_3_rules.json');
const SLOT = '1';
const DX = -2;
const DY = -2;

/** A 2-D context that records every call and property write (the drawn picture, as a value). */
function recordingCanvas(width, height) {
    const log = [];
    const fmt = (a) => (typeof a === 'number' ? Math.round(a * 1000) / 1000
        : (a && typeof a === 'object' ? (a.__tag ?? typeof a) : a));
    const stub = (tag) => new Proxy({ __tag: tag }, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'width') return 0;
            if (k === 'data') return new Uint8ClampedArray(4);
            return (...args) => { log.push([`${tag}.${String(k)}`, ...args.map(fmt)]); return stub(`${tag}.${String(k)}`); };
        },
        set(t, k, v) { log.push([`${tag}.${String(k)}=`, fmt(v)]); return true; },
    });
    const ctx = new Proxy({ __tag: 'ctx' }, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
            if (k === 'canvas') return canvas;
            return (...args) => { log.push([String(k), ...args.map(fmt)]); return stub(String(k)); };
        },
        set(t, k, v) { log.push([`${String(k)}=`, fmt(v)]); return true; },
    });
    const canvas = { width, height, getContext: () => ctx };
    return { canvas, log };
}

function drawn(doc, opts = {}) {
    const res = reconstructResultFromSidecars(doc, { playerId: SLOT, fallback: false });
    const { grid, regionSize } = res;
    const { canvas, log } = recordingCanvas(grid.width * regionSize.width * TILE_PX,
        grid.height * regionSize.height * TILE_PX);
    drawCompositeMap(canvas, grid, regionSize, { ...opts, source: { rules: doc, playerId: SLOT } });
    return { res, canvas, log };
}

const shift = (c) => ({ gx: c.gx + DX, gy: c.gy + DY });

describe('unbounded grid S1 — cellExtent', () => {
    it('min/max + 1, signed, skipping what is not a cell', () => {
        expect(cellExtent([{ gx: -2, gy: 3 }, { gx: 1, gy: -1 }, null, { gx: 0.5, gy: 0 }]))
            .toEqual({ minX: -2, minY: -1, maxX: 1, maxY: 3, width: 4, height: 5 });
        expect(cellExtent([])).toBeNull();
        expect(isSignedCell({ gx: -7, gy: 0 })).toBe(true);
        expect(isSignedCell({ gx: '1', gy: 0 })).toBe(false);
    });

    it('the drawn box always holds the origin (the start room), and a declared box anchored there', () => {
        const ext = cellExtent([{ gx: 4, gy: 4 }, { gx: 7, gy: 10 }]);
        expect(drawnBox(ext)).toEqual({ minX: 0, minY: 0, width: 8, height: 11 });
        const neg = cellExtent([{ gx: -3, gy: -1 }, { gx: -1, gy: -4 }]);
        expect(drawnBox(neg)).toEqual({ minX: -3, minY: -4, width: 4, height: 5 });
        // a DECLARED origin replaces (0,0): the box is the cells + [origin, origin + declared)
        expect(drawnBox(neg, { width: 6, height: 2 }, { gx: -3, gy: -4 }))
            .toEqual({ minX: -3, minY: -4, width: 6, height: 4 });
    });

    it('gridOriginOf: a box at (0,0) is min-0; a Grid with an origin carries its own (S2: the engine Grid, no bridge)', () => {
        expect(gridOriginOf(gridForBox({ width: 2, height: 2 }))).toEqual({ minX: 0, minY: 0 });
        expect(gridOriginOf(gridForBox({ minX: -1, minY: -3, width: 2, height: 2 }))).toEqual({ minX: -1, minY: -3 });
    });
});

describe('unbounded grid S1 — the signed fixture draws like its min-0 twin', () => {
    it('premise: the fixture is the twin translated, start room at (0,0), mixed signs', () => {
        const s = SIGNED().preset_sidecars[SLOT];
        const t = TWIN().preset_sidecars[SLOT];
        expect(Object.keys(s)).toEqual(Object.keys(t));
        for (const name of Object.keys(t)) expect(s[name].grid_cell).toEqual(shift(t[name].grid_cell));
        expect(s.region_2_2.grid_cell).toEqual({ gx: 0, gy: 0 });
        const cells = Object.values(s).map((e) => e.grid_cell);
        expect(cells.some((c) => c.gx < 0) && cells.some((c) => c.gx > 0)).toBe(true);
        expect(cells.some((c) => c.gy < 0) && cells.some((c) => c.gy > 0)).toBe(true);
    });

    it('mapBoundsFor: the same box, starting at the translated origin', () => {
        const sd = SIGNED();
        const td = TWIN();
        const sb = mapBoundsFor(sd, Object.entries(sd.preset_sidecars[SLOT]), SLOT);
        const tb = mapBoundsFor(td, Object.entries(td.preset_sidecars[SLOT]), SLOT);
        expect(tb).toEqual({ minX: 0, minY: 0, width: 4, height: 5, boundsSource: 'extents' });
        expect(sb).toEqual({ ...tb, minX: DX, minY: DY });
    });

    it('reconstruct: signed cells on the grid, the origin on the result', () => {
        const { res } = drawn(SIGNED());
        const twin = drawn(TWIN()).res;
        expect(res.gridOrigin).toEqual({ gx: DX, gy: DY });
        expect(twin.gridOrigin).toEqual({ gx: 0, gy: 0 });
        expect([res.grid.width, res.grid.height]).toEqual([twin.grid.width, twin.grid.height]);
        expect(res.grid.allRegions().map((r) => [r.region_id, r.cell]))
            .toEqual(twin.grid.allRegions().map((r) => [r.region_id, shift(r.cell)]));
        expect(res.stats).toEqual(twin.stats);
    });

    it('the SAME pixels: art on, art off, a region and an exit selected', () => {
        const sres = drawn(SIGNED()).res;
        const first = sres.grid.allRegions()[0];
        const withExit = sres.grid.allRegions().find((r) => [...(r.exits?.values?.() ?? [])].length);
        const exitId = [...withExit.exits.values()][0].exit_id;
        const variants = [
            [{}, {}],
            [{ substrateArt: false }, { substrateArt: false }],
            [{ selection: { kind: 'region', cell: first.cell } },
                { selection: { kind: 'region', cell: { gx: first.cell.gx - DX, gy: first.cell.gy - DY } } }],
            [{ selection: { kind: 'exit', cell: withExit.cell, exitId } },
                { selection: { kind: 'exit', cell: { gx: withExit.cell.gx - DX, gy: withExit.cell.gy - DY }, exitId } }],
        ];
        for (const [sOpts, tOpts] of variants) {
            const s = drawn(SIGNED(), sOpts);
            const t = drawn(TWIN(), tOpts);
            expect([s.canvas.width, s.canvas.height]).toEqual([t.canvas.width, t.canvas.height]);
            expect(s.log.length).toBeGreaterThan(50);
            expect(s.log).toEqual(t.log);
        }
    });

    it('the SAME rects, and every pick returns the signed cell and the same region', () => {
        const s = drawn(SIGNED()).res;
        const t = drawn(TWIN()).res;
        const cw = s.regionSize.width * TILE_PX;
        const ch = s.regionSize.height * TILE_PX;
        for (const r of s.grid.allRegions()) {
            const tc = { gx: r.cell.gx - DX, gy: r.cell.gy - DY };
            expect(cellOriginPx(s.grid, s.regionSize, r.cell)).toEqual(cellOriginPx(t.grid, t.regionSize, tc));
        }
        let picked = 0;
        for (let row = 0; row < s.grid.height; row++) {
            for (let col = 0; col < s.grid.width; col++) {
                for (const [ox, oy] of [[cw / 2, ch / 2], [0, 0], [cw - 1, ch - 1]]) {
                    const pt = { cx: col * cw + ox, cy: row * ch + oy };
                    const sp = cellAtPoint(s.grid, s.regionSize, pt);
                    const tp = cellAtPoint(t.grid, t.regionSize, pt);
                    expect(sp).toEqual({ ...tp, gx: tp.gx + DX, gy: tp.gy + DY });
                    expect(sp).toMatchObject({ gx: col + DX, gy: row + DY });
                    expect(s.grid.getRegion(sp)?.region_id ?? null).toBe(t.grid.getRegion(tp)?.region_id ?? null);
                    if (s.grid.getRegion(sp)) picked += 1;
                }
            }
        }
        expect(picked).toBe(3 * 10);
        const W = s.grid.width * cw;
        const H = s.grid.height * ch;
        for (const pt of [{ cx: -1, cy: 0 }, { cx: 0, cy: -1 }, { cx: W, cy: 0 }, { cx: 0, cy: H }]) {
            expect(cellAtPoint(s.grid, s.regionSize, pt)).toBeNull();
        }
        // the start room is under the pixel of canvas cell (−minX, −minY)
        const start = cellAtPoint(s.grid, s.regionSize, { cx: -DX * cw + 1, cy: -DY * ch + 1 });
        expect(s.grid.getRegion(start).region_id).toBe('region_2_2');
    });

    it('an ALL-NEGATIVE layout with no metadata still draws (the box widens to the origin)', () => {
        const doc = SIGNED();
        delete doc.procgen_metadata;
        for (const e of Object.values(doc.preset_sidecars[SLOT])) {
            e.grid_cell = { gx: e.grid_cell.gx - 5, gy: e.grid_cell.gy - 5 };
        }
        const b = mapBoundsFor(doc, Object.entries(doc.preset_sidecars[SLOT]), SLOT);
        expect(b).toEqual({ minX: -7, minY: -6, width: 8, height: 7, boundsSource: 'extents' });
        const { res, log } = drawn(doc);
        expect(res.stats.regionsBuilt).toBe(10);
        expect(log.length).toBeGreaterThan(50);
    });
});

describe('unbounded grid S1 — the APWorld editor reads the signed fixture', () => {
    it('isGridCell accepts negatives; slotLayout places every cell signed, no clash', () => {
        expect(isGridCell({ gx: -1, gy: -1 })).toBe(true);
        expect(isGridCell({ gx: 1.5, gy: 0 })).toBe(false);
        const doc = SIGNED();
        const lay = slotLayout(doc, SLOT);
        expect(lay.clash).toBeNull();
        expect(lay.cells.size).toBe(10);
        expect(gridOriginOf(lay.grid)).toEqual({ minX: DX, minY: DY });
        for (const [name, c] of lay.cells) {
            expect(c).toEqual(doc.preset_sidecars[SLOT][name].grid_cell);
            expect(lay.grid.getRegion(c).region_id).toBe(name);
        }
        const twin = slotLayout(TWIN(), SLOT);
        expect([lay.grid.width, lay.grid.height]).toEqual([twin.grid.width, twin.grid.height]);
        // the box edges are where the twin's are, translated
        expect(lay.grid.isInBounds({ gx: DX, gy: DY })).toBe(true);
        expect(lay.grid.isInBounds({ gx: DX - 1, gy: 0 })).toBe(false);
        expect(lay.grid.neighborCell({ gx: 0, gy: 0 }, 'W')).toEqual({ gx: -1, gy: 0 });
    });

    it('sidecarIssues: no GRID_CELL_OUTSIDE for the signed fixture, with or without its declared origin', () => {
        const outside = (doc) => sidecarIssues(doc, SLOT).filter((i) => i.kind === K.GRID_CELL_OUTSIDE);
        expect(outside(SIGNED())).toEqual([]);
        const noOrigin = SIGNED();
        delete noOrigin.procgen_metadata[SLOT].grid_origin;
        expect(outside(noOrigin)).toEqual([]);
        const noMeta = SIGNED();
        delete noMeta.procgen_metadata;
        expect(outside(noMeta)).toEqual([]);
    });

    it('sidecarIssues: a DECLARED origin still bounds the near edge, and its far edge', () => {
        const outside = (doc) => sidecarIssues(doc, SLOT).filter((i) => i.kind === K.GRID_CELL_OUTSIDE);
        const near = SIGNED();
        near.preset_sidecars[SLOT].region_2_2.grid_cell = { gx: DX - 1, gy: 0 };
        const hits = outside(near);
        expect(hits).toHaveLength(1);
        expect(hits[0].message).toContain('grid from (-2, -2)');
        expect(hits[0].message).toContain('`grid_origin`');
        const far = SIGNED();
        far.preset_sidecars[SLOT].region_2_2.grid_cell = { gx: DX + 4, gy: 0 };
        expect(outside(far)).toHaveLength(1);
    });
});
