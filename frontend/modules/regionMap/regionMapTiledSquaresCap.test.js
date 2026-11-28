/**
 * region-map-tiled-squares-cap — ⚖ the user, session 84c8ab35 (archipelago-cc-23), 2026-11-23, answering "the location
 * boxes on levels that do have tiles also have a minimum size (6 px). So when zoomed far out, they can also be larger
 * than their tile. Tell me if you want those to shrink the same way.": "Yes, I also want to prevent the location boxes
 * from growing larger than their tile." Then, asked what happens under a 1 px tile (2026-11-24): "Skip them"
 * (00:35:39.877Z), superseded at 00:36:20.300Z by "Keep a 1 px dot".
 *
 * The rule (`regionMapOverlay.tiledSquareSide`): on a substrate-tiled cell a square's side is
 * `max(1, min(tile, max(minPx, 0.7 · tile)))` (tile = its on-screen side). Nothing is skipped. Centres never move.
 * Untiled (generic) squares are unchanged.
 *
 * ⛔ No preset-derived hard pins: every count over a preset is DERIVED from the preset's own model.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { cellFrames } from './regionMapFrames.js';
import { MAX_ZOOM, MIN_ZOOM } from '../procgenCore/mapCamera.js';
import {
    MIN_SQUARE_PX, TILED_SQUARE_FLOOR_PX, frameSquares, squareAt, squareSide, tiledSquareSide,
} from './regionMapOverlay.js';
import { buildRegionMapModel } from './regionMapModel.js';
import { RegionMapUI } from './regionMapUI.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const SEEDLING = buildRegionMapModel({
    rules: read('../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json'),
});
const ALTTP = buildRegionMapModel({
    rules: read('../../presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json'),
});
const framesOf = (m, mode) => cellFrames(m.layout.positions, new Map([...m.cells].map(([k, c]) => [k, c.extent])), mode);
const tiled = (m) => [...m.cells.values()].filter((c) => c.tileSource === 'substrate' && c.tiles.length);
const VP = { w: 1600, h: 1000 };
const camAt = (f, zoom) => ({ x: f.cell.x + (VP.w / 2 - 100) / zoom, y: f.cell.y + (VP.h / 2 - 100) / zoom, zoom });
const ZOOMS = (() => {
    const z = [];
    for (let v = MIN_ZOOM; v <= MAX_ZOOM; v *= 1.07) z.push(v);
    return z.concat([MAX_ZOOM]);
})();
const EPS = 1e-9;
/** The pre-slice square (base 363564bffa's `frameSquares`, verbatim in effect: `squareSide` for a tile without `size`). */
const today = (f, t, zoom, minPx = MIN_SQUARE_PX) => (Number.isFinite(t.size) ? Math.max(minPx, t.size * f.tilePx * zoom) : squareSide(f, zoom, minPx));

describe('tiled squares never outgrow their tile', () => {
    it('the preset has tiled cells to test (derived, not pinned)', () => {
        expect(tiled(SEEDLING).length).toBeGreaterThan(0);
    });
    for (const mode of ['level', 'uniform']) {
        for (const minPx of [MIN_SQUARE_PX, 1, 20]) {
            it(`seedling_playthrough (${mode}, minPx ${minPx}): over a zoom sweep, side ≤ max(tile, 1 px); = today's side wherever today's ≤ tile; centres and the set unchanged`, () => {
                const frames = framesOf(SEEDLING, mode);
                let capped = 0; let same = 0; let dots = 0;
                for (const c of tiled(SEEDLING)) {
                    const f = frames.get(c.key);
                    for (const zoom of ZOOMS) {
                        const cam = camAt(f, zoom);
                        const before = frameSquares(f, c.tiles, cam, VP, minPx);
                        const after = frameSquares(f, c.tiles, cam, VP, minPx, { capToTile: true });
                        const tile = f.tilePx * zoom;
                        expect(after.length).toBe(c.tiles.length);
                        after.forEach((q, i) => {
                            const b = before[i];
                            // the move set: centres and identity byte-identical
                            expect([q.location, q.kind, q.sx, q.sy]).toEqual([b.location, b.kind, b.sx, b.sy]);
                            expect(b.side).toBe(today(f, c.tiles[i], zoom, minPx));
                            expect(q.side).toBeLessThanOrEqual(Math.max(tile, TILED_SQUARE_FLOOR_PX) + EPS);
                            expect(q.side).toBeGreaterThanOrEqual(TILED_SQUARE_FLOOR_PX);
                            expect('skipped' in q).toBe(false);
                            if (b.side <= tile) { expect(q.side).toBe(b.side); same += 1; }
                            else if (tile >= TILED_SQUARE_FLOOR_PX) { expect(q.side).toBe(tile); capped += 1; }
                            else { expect(q.side).toBe(TILED_SQUARE_FLOOR_PX); dots += 1; }
                            // the setting still holds wherever the tile is at least that big
                            if (tile >= minPx) expect(q.side).toBeGreaterThanOrEqual(minPx - EPS);
                        });
                    }
                }
                // the cap band (1 px ≤ tile < minPx) is empty when minPx is 1
                if (minPx > TILED_SQUARE_FLOOR_PX) expect(capped).toBeGreaterThan(0); else expect(capped).toBe(0);
                expect(same).toBeGreaterThan(0);
                expect(dots).toBeGreaterThan(0);
            });
        }
    }

    it('the formula: max(1, min(tile, max(minPx, 0.7 tile))) — capped only when the tile is under minPx', () => {
        const f = { tilePx: 16 };
        expect(tiledSquareSide(f, 1, 6)).toBe(squareSide(f, 1, 6)); // 16 px tile: 11.2
        expect(tiledSquareSide(f, 6 / 16, 6)).toBe(6); // 6 px tile: the floor, exactly the tile
        expect(tiledSquareSide(f, 0.1, 6)).toBeCloseTo(1.6, 12); // 1.6 px tile: the tile
        expect(tiledSquareSide(f, 0.05, 6)).toBe(1); // a 0.8 px tile: the 1 px dot
    });

    it('the sub-pixel case: under a 1 px tile every square is a 1 px dot (drawn, never skipped)', () => {
        const c = tiled(SEEDLING)[0];
        const f = framesOf(SEEDLING, 'level').get(c.key);
        const zAt1 = TILED_SQUARE_FLOOR_PX / f.tilePx;
        for (const zoom of [zAt1, zAt1 * 0.99, zAt1 / 2, MIN_ZOOM]) {
            const qs = frameSquares(f, c.tiles, camAt(f, zoom), VP, MIN_SQUARE_PX, { capToTile: true });
            expect(qs.length).toBe(c.tiles.length);
            for (const q of qs) expect(q.side).toBe(TILED_SQUARE_FLOOR_PX);
        }
    });

    it('untiled (generic) squares: capToTile is never asked for them, and without it nothing changes', () => {
        const frames = framesOf(ALTTP, 'level');
        for (const c of [...ALTTP.cells.values()].filter((x) => x.tileSource === 'generic').slice(0, 20)) {
            const f = frames.get(c.key);
            for (const zoom of [MIN_ZOOM, 0.1, 1, MAX_ZOOM]) {
                const qs = frameSquares(f, c.tiles, camAt(f, zoom), VP);
                qs.forEach((q, i) => expect(q.side).toBe(today(f, c.tiles[i], zoom)));
            }
        }
    });
});

/** `_drawSquares` on a stand-in panel: the real method, a no-op 2D context. */
function drawWith(model, frame, zoom) {
    const ui = Object.create(RegionMapUI.prototype);
    ui.model = model;
    ui.camera = camAt(frame, zoom);
    ui.vp = VP;
    ui.settings = { minSquarePx: MIN_SQUARE_PX };
    ui._squares = [];
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
    ui._drawSquares(ctx, frame, null);
    return { squares: ui._squares };
}

describe('the panel draws and hit-tests the capped size', () => {
    const c = tiled(SEEDLING).find((x) => x.tiles.length >= 2) ?? tiled(SEEDLING)[0];
    const f = framesOf(SEEDLING, 'level').get(c.key);

    it('a click at a shrunk square\'s centre hits it; just outside its (smaller) half-side misses it', () => {
        const zoom = 0.1; // a 1.6 px tile: today's 6 px square, capped to 1.6
        const { squares } = drawWith(SEEDLING, f, zoom);
        expect(squares.length).toBe(c.tiles.length);
        for (const q of squares) {
            expect(q.side).toBeCloseTo(f.tilePx * zoom, 12);
            expect(squareAt(squares, q.sx, q.sy)?.location).toBeDefined();
        }
        // a lone square: the old 6 px reach (3 px off centre) no longer hits it
        const lone = [squares[0]];
        expect(squareAt(lone, lone[0].sx, lone[0].sy)).toBe(lone[0]);
        expect(squareAt(lone, lone[0].sx + 3, lone[0].sy)).toBeNull();
    });

    it('at the minimum zoom every square is drawn as a 1 px dot, and a click at its centre hits it', () => {
        const { squares } = drawWith(SEEDLING, f, MIN_ZOOM);
        expect(squares.length).toBe(c.tiles.length);
        for (const q of squares) {
            expect(q.side).toBe(TILED_SQUARE_FLOOR_PX);
            expect(squareAt([q], q.sx, q.sy)).toBe(q);
            expect(squareAt([q], q.sx + 1, q.sy)).toBeNull();
        }
    });

    it('zoomed in (tile ≥ minPx), the panel draws today\'s side', () => {
        const zoom = 1;
        const { squares } = drawWith(SEEDLING, f, zoom);
        for (const q of squares) expect(q.side).toBe(squareSide(f, zoom));
    });
});
