/**
 * region-map-squares-rings — three fixes from the user's manual test (⚖ session 84c8ab35, 2026-11-23):
 *   1. "the title text currently overlaps the boxes for the locations, for regions with no tiles. I want to move the
 *      location boxes lower so that the title text doesn't overlap it."
 *   2. "When the region map zooms out, I don't want the circles to grow larger than the size of the tile they are
 *      circling, even if that makes them too small to see when zooming out."
 *   3. "I want to make the location boxes bigger in the region map, for regions without tiles. … Maybe double their
 *      current width and height. They can be scaled back down for regions that have too many locations to fit at the
 *      bigger size."
 *
 * ⛔ No preset-derived hard pins (js-19 e3): every count over a preset is DERIVED from the preset's own model.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { cellFrames, DEFAULT_EXTENT, WORLD_TILE_PX } from './regionMapFrames.js';
import { MAX_ZOOM, MIN_ZOOM } from '../procgenCore/mapCamera.js';
import {
    DOOR_RING_HALO_HALF_PX, DOOR_RING_MAX_R_PX, DOOR_RING_SKIP_R_PX, GENERIC_PITCH_MAX_TILES, GENERIC_SQUARE_FRACTION,
    LABEL_MIN_CELL_PX, MIN_SQUARE_PX, SQUARE_TILE_FRACTION, doorRingRadius, frameSquares, genericLocationTiles,
    labelBottomPx, legacyGenericLocationTiles, squareAt,
} from './regionMapOverlay.js';
import { GENERIC_ART_CELLS_GET_BIG_PLACES, buildRegionMapModel, usesBigGenericPlaces } from './regionMapModel.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const PRESETS = {
    alttp: '../../presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    tunic: '../../presets/tunic/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    ladx: '../../presets/ladx/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    // soe's `Ingame` is the most crowded region over the committed presets (the shrink case)
    soe: '../../presets/soe/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    seedling_playthrough: '../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json',
};
const models = Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, buildRegionMapModel({ rules: read(p) })]));
const framesOf = (m, mode) => cellFrames(m.layout.positions, new Map([...m.cells].map(([k, c]) => [k, c.extent])), mode);
const generic = (m) => [...m.cells.values()].filter((c) => c.tileSource === 'generic');
const crowdest = (m) => generic(m).reduce((a, c) => (!a || c.tiles.length > a.tiles.length ? c : a), null);
const VP = { w: 1600, h: 1000 };
/** A camera with the frame's cell top-left at screen (0, 0)… shifted so the cell sits at (100, 100). */
const camAt = (f, zoom) => ({ x: f.cell.x + (VP.w / 2 - 100) / zoom, y: f.cell.y + (VP.h / 2 - 100) / zoom, zoom });
const ZOOMS = (() => {
    const z = [];
    for (let v = MIN_ZOOM; v <= MAX_ZOOM; v *= 1.07) z.push(v);
    return z.concat([MAX_ZOOM]);
})();
const EPS = 1e-9;

describe('1. the title never overlaps an untiled region\'s squares', () => {
    for (const game of ['alttp', 'tunic', 'ladx', 'soe']) {
        for (const mode of ['level', 'uniform']) {
            it(`${game} (${mode}): at every zoom the label is drawn, every square's top is below the label box`, () => {
                const m = models[game];
                const frames = framesOf(m, mode);
                let checked = 0;
                for (const c of generic(m)) {
                    const f = frames.get(c.key);
                    // the label's world band is tallest at the smallest zoom it is drawn: pin that zoom exactly too
                    const zLabel = LABEL_MIN_CELL_PX / f.cell.w;
                    for (const zoom of [zLabel, ...ZOOMS]) {
                        const cw = f.cell.w * zoom;
                        const cam = camAt(f, zoom);
                        const qs = frameSquares(f, c.tiles, cam, VP);
                        if (cw >= LABEL_MIN_CELL_PX) {
                            const bottom = labelBottomPx(cw);
                            for (const q of qs) expect(q.sy - q.side / 2 - 100).toBeGreaterThanOrEqual(bottom - EPS);
                        } else {
                            // ⚖ js-23 edit 3: where the label is NOT drawn (cell < 60 px) the squares are placed as if
                            // it were: the same tiles, so each square at its own (unfloored) size clears the label box
                            // of a 60 px cell scaled to this zoom. (The `minPx` floor makes every square bigger than
                            // its place out here; there is no label to overlap.)
                            const bottom = labelBottomPx(LABEL_MIN_CELL_PX) * (cw / LABEL_MIN_CELL_PX);
                            qs.forEach((q, i) => {
                                const own = c.tiles[i].size * f.tilePx * zoom;
                                expect(q.sy - own / 2 - 100).toBeGreaterThanOrEqual(bottom - EPS);
                            });
                        }
                        checked += qs.length;
                    }
                }
                expect(checked).toBeGreaterThan(0);
            });
        }
    }
    it('the positions are zoom-independent (placed once, in tiles)', () => {
        const t = genericLocationTiles(['a', 'b'], DEFAULT_EXTENT);
        expect(t.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y))).toBe(true);
        expect(genericLocationTiles(['a', 'b'], DEFAULT_EXTENT)).toEqual(t);
    });
});

describe('2. a door ring is never larger than its tile', () => {
    it('outer diameter (halo included) ≤ the tile on screen, at every zoom; capped zoomed in; skipped under 1 px', () => {
        let drawn = 0;
        let skipped = 0;
        for (const zoom of ZOOMS) {
            const tile = WORLD_TILE_PX * zoom;
            const r = doorRingRadius(tile);
            if (r == null) {
                skipped += 1;
                // skipped exactly when the stroke centre would be under DOOR_RING_SKIP_R_PX (no sub-pixel ring)
                expect(Math.min(DOOR_RING_MAX_R_PX, tile / 2 - DOOR_RING_HALO_HALF_PX)).toBeLessThan(DOOR_RING_SKIP_R_PX);
                continue;
            }
            drawn += 1;
            expect(r).toBeGreaterThanOrEqual(DOOR_RING_SKIP_R_PX);
            expect(r).toBeLessThanOrEqual(DOOR_RING_MAX_R_PX);
            expect(2 * (r + DOOR_RING_HALO_HALF_PX)).toBeLessThanOrEqual(tile + EPS);
        }
        expect(drawn).toBeGreaterThan(0);
        expect(skipped).toBeGreaterThan(0);
        expect(doorRingRadius(WORLD_TILE_PX * MAX_ZOOM)).toBe(DOOR_RING_MAX_R_PX);
        // the zoomed-out case: a 1.6 px tile (Seedling at Fit all) → r would be −0.95 px: no ring
        expect(doorRingRadius(1.6)).toBe(null);
        // the boundary: r = 1 exactly is drawn, a hair under is not
        expect(doorRingRadius(2 * (1 + DOOR_RING_HALO_HALF_PX))).toBe(1);
        expect(doorRingRadius(2 * (1 + DOOR_RING_HALO_HALF_PX) - 0.01)).toBe(null);
    });
});

describe('3. bigger squares for regions without tiles; a crowded one shrinks to fit', () => {
    const inCellNoOverlap = (f, tiles) => {
        // at a zoom where the squares are their own size (not the minPx floor)
        const zoom = 4;
        const qs = frameSquares(f, tiles, camAt(f, zoom), VP);
        const c = { x0: 100, y0: 100, x1: 100 + f.cell.w * zoom, y1: 100 + f.cell.h * zoom };
        for (const q of qs) {
            expect(q.side).toBeGreaterThan(MIN_SQUARE_PX);
            expect(q.sx - q.side / 2).toBeGreaterThanOrEqual(c.x0 - EPS);
            expect(q.sx + q.side / 2).toBeLessThanOrEqual(c.x1 + EPS);
            expect(q.sy + q.side / 2).toBeLessThanOrEqual(c.y1 + EPS);
        }
        for (let i = 0; i < qs.length; i += 1) {
            for (let j = i + 1; j < qs.length; j += 1) {
                const a = qs[i];
                const b = qs[j];
                const apart = Math.abs(a.sx - b.sx) >= (a.side + b.side) / 2 - EPS || Math.abs(a.sy - b.sy) >= (a.side + b.side) / 2 - EPS;
                expect(apart).toBe(true);
            }
        }
        return qs;
    };
    it('a small region: side doubled (2 × the tile fraction); clicks hit it', () => {
        const m = models.alttp;
        const c = m.cells.get('Sewers Secret Room');
        expect(c.tileSource).toBe('generic');
        const f = framesOf(m, 'level').get(c.key);
        expect(GENERIC_SQUARE_FRACTION * GENERIC_PITCH_MAX_TILES).toBeCloseTo(2 * SQUARE_TILE_FRACTION, 12);
        for (const t of c.tiles) expect(t.size).toBeCloseTo(2 * SQUARE_TILE_FRACTION, 12);
        const qs = inCellNoOverlap(f, c.tiles);
        expect(qs[0].side).toBeCloseTo(2 * SQUARE_TILE_FRACTION * f.tilePx * 4, 9);
        // ⚖ js-23 edit 3: a click at the centre of a bigger square hits it, and just inside its new edge too
        for (const q of qs) {
            expect(squareAt(qs, q.sx, q.sy)?.location).toBe(q.location);
            expect(squareAt(qs, q.sx + q.side / 2 - 0.5, q.sy - q.side / 2 + 0.5)?.location).toBe(q.location);
        }
    });
    it('alttp\'s most crowded untiled region still fits at the doubled size (derived, named in the report)', () => {
        const m = models.alttp;
        const c = crowdest(m);
        const f = framesOf(m, 'level').get(c.key);
        for (const t of c.tiles) expect(t.size).toBeCloseTo(2 * SQUARE_TILE_FRACTION, 12);
        inCellNoOverlap(f, c.tiles);
    });
    it('the most crowded region over the presets (soe) shrinks until it fits: inside, below the band, no overlap; clicks hit', () => {
        const m = models.soe;
        const c = crowdest(m);
        const f = framesOf(m, 'level').get(c.key);
        expect(c.tiles[0].size).toBeLessThan(2 * SQUARE_TILE_FRACTION);
        const qs = inCellNoOverlap(f, c.tiles);
        expect(qs).toHaveLength(c.tiles.length);
        for (const q of [qs[0], qs[qs.length - 1]]) expect(squareAt(qs, q.sx, q.sy)?.location).toBe(q.location);
    });
    it('every untiled cell on the classic presets is inside its cell with no overlap (both modes)', () => {
        for (const game of ['alttp', 'tunic', 'ladx', 'soe']) {
            for (const mode of ['level', 'uniform']) {
                const frames = framesOf(models[game], mode);
                for (const c of generic(models[game])) inCellNoOverlap(frames.get(c.key), c.tiles);
            }
        }
    });
    it('tiled squares carry no size: the tile-fraction rule is unchanged for them', () => {
        const m = models.seedling_playthrough;
        const tiled = [...m.cells.values()].filter((c) => c.tileSource === 'substrate');
        expect(tiled.length).toBeGreaterThan(0);
        for (const c of tiled) for (const t of c.tiles) expect(t.size).toBeUndefined();
    });
});

describe('the art-cell switch (⚖ the user, 84c8ab35, 2026-11-23T21:05:24Z: "Only levels without art")', () => {
    it('the predicate: a no-art untiled cell always gets the new places; an art cell follows the switch', () => {
        expect(usesBigGenericPlaces({ region: null })).toBe(true);
        expect(usesBigGenericPlaces({ region: {} })).toBe(GENERIC_ART_CELLS_GET_BIG_PLACES);
        expect(GENERIC_ART_CELLS_GET_BIG_PLACES).toBe(false);
    });
    it('the maze: art cells keep the legacy places (no size), no-art cells get the new ones (derived counts)', () => {
        const m = buildRegionMapModel({ rules: read('../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json') });
        const g = generic(m);
        const art = g.filter((c) => c.region);
        const bare = g.filter((c) => !c.region);
        expect(art.length).toBeGreaterThan(0);
        expect(bare.length).toBeGreaterThan(0);
        for (const c of art) expect(c.tiles).toEqual(legacyGenericLocationTiles(c.tiles.map((t) => t.location), DEFAULT_EXTENT));
        for (const c of bare) for (const t of c.tiles) expect(t.size).toBeGreaterThan(0);
    });
    it('the legacy places are base 6dbadc7364\'s: a 2-tile grid from (1, 3), no size', () => {
        const t = legacyGenericLocationTiles(['a', 'b', 'c'], DEFAULT_EXTENT);
        expect(t).toEqual([
            { location: 'a', x: 1, y: 3, kind: 'item' }, { location: 'b', x: 3, y: 3, kind: 'item' },
            { location: 'c', x: 5, y: 3, kind: 'item' },
        ]);
    });
});
