/**
 * regionMap.test — the Region Map panel's PURE parts (region-map step 3b): the cell geometry (`cellFrames`, both
 * modes, signed coordinates), the cull, the camera math, the square layout and its minimum size, the colour rule,
 * and the model over real presets.
 *
 * ⛔ No preset-derived hard pins (js-19 e3): every count over a preset is DERIVED from what the preset itself says
 * (its sidecars, its rules locations, the layout's own answer), so a later rules move cannot stop a train here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_EXTENT, GAP_PX, GUTTER_PX, UNIFORM_SIDE_TILES, WORLD_TILE_PX, cellFrames, frameAt, framesBounds,
    tileCentre, visibleFrames,
} from './regionMapFrames.js';
import {
    MAX_ZOOM, MIN_ZOOM, easeCamera, fitCamera, panBy, screenToWorld, viewRect, worldToScreen, zoomAround,
} from './regionMapCamera.js';
import {
    MIN_SQUARE_PX, frameSquares, genericLocationTiles, squareAt, squareColorKey, squareSide,
} from './regionMapOverlay.js';
import { buildRegionMapModel, exitTileOf } from './regionMapModel.js';
import { REGION_MAP_SETTING_DEFAULTS, REGION_MAP_SETTINGS_SCHEMA } from './regionMapSettings.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';
import { regionsOf } from '../procgenCore/rulesGraph.js';
import { computeRegionView } from '../regionView/regionViewState.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const PLAYTHROUGH = read('../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const CHESTDOOR = read('../../presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json');
const ALTTP = read('../../presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json');

const pos = (entries) => new Map(entries.map(([k, gx, gy]) => [k, { gx, gy }]));
const ext = (entries) => new Map(entries.map(([k, w, h]) => [k, { w, h }]));

describe('cellFrames — sized by level (the default)', () => {
    const P = pos([['s', 0, 0], ['e', 1, 0], ['w', -1, 0], ['n', 0, -1], ['far', 3, 0]]);
    const E = ext([['s', 20, 10], ['e', 5, 5], ['w', 10, 30], ['n', 6, 6], ['far', 4, 4]]);
    const F = cellFrames(P, E);

    it('one tile scale; column 0 starts at x = 0; negative columns extend left (signed, nothing normalised)', () => {
        for (const f of F.values()) expect(f.tilePx).toBe(WORLD_TILE_PX);
        expect(F.get('s').cell.x).toBe(GUTTER_PX / 2);
        expect(F.get('w').cell.x).toBeLessThan(0);
        expect(F.get('n').cell.y).toBeLessThan(0);
        expect(F.get('s').w).toBe(20 * WORLD_TILE_PX);
        expect(F.get('s').h).toBe(10 * WORLD_TILE_PX);
    });
    it('a column is as wide as its widest level, a row as tall as its tallest (+ the gutter)', () => {
        // column 0 holds s (20 wide) and n (6 wide): both cells are 20 tiles wide.
        expect(F.get('n').cell.w).toBe(20 * WORLD_TILE_PX);
        // row 0 holds s (10), e (5), w (30), far (4): every cell in it is 30 tiles tall.
        for (const k of ['s', 'e', 'w', 'far']) expect(F.get(k).cell.h).toBe(30 * WORLD_TILE_PX);
        expect(F.get('e').cell.x - (F.get('s').cell.x + F.get('s').cell.w)).toBe(GUTTER_PX);
    });
    it('a level sits centred in its cell', () => {
        const f = F.get('e');
        expect(f.x - f.cell.x).toBe(Math.floor((f.cell.w - f.w) / 2));
        expect(f.y - f.cell.y).toBe(Math.floor((f.cell.h - f.h) / 2));
    });
    it('an EMPTY layout column (the gap between groups) stays a gap', () => {
        // columns 2 is empty: far's cell starts one GAP after e's slot ends.
        const slotEndE = F.get('e').cell.x + F.get('e').cell.w + GUTTER_PX / 2;
        expect(F.get('far').cell.x - GUTTER_PX / 2).toBe(slotEndE + GAP_PX);
    });
    it('no extent → DEFAULT_EXTENT, flagged estimated', () => {
        const G = cellFrames(pos([['a', 0, 0]]), new Map());
        expect(G.get('a').ext).toMatchObject({ ...DEFAULT_EXTENT, estimated: true });
        expect(G.get('a').w).toBe(DEFAULT_EXTENT.w * WORLD_TILE_PX);
    });
    it('refuses an unknown mode by name', () => {
        expect(() => cellFrames(P, E, 'log')).toThrow(/unknown cell size mode 'log'/);
    });
});

describe('cellFrames — uniform cells (the toggle)', () => {
    const P = pos([['a', 0, 0], ['b', 1, 0], ['c', -2, 1]]);
    const E = ext([['a', 60, 30], ['b', 5, 5], ['c', 10, 40]]);
    const F = cellFrames(P, E, 'uniform');
    const side = UNIFORM_SIDE_TILES * WORLD_TILE_PX;

    it('every cell is the same square; each level scaled to fit it, letterboxed', () => {
        for (const f of F.values()) expect([f.cell.w, f.cell.h]).toEqual([side, side]);
        expect(F.get('a').w).toBe(side);
        expect(F.get('a').h).toBe(side / 2);
        expect(F.get('b').w).toBe(side);
        expect(F.get('b').tilePx).toBe(side / 5);
        expect(F.get('c').h).toBe(side);
        expect(F.get('c').cell.x).toBeLessThan(0);
    });
    it('the two modes give different frames for the same layout', () => {
        const L = cellFrames(P, E, 'level');
        expect(JSON.stringify([...L])).not.toBe(JSON.stringify([...F]));
    });
});

describe('the cull and hit-tests', () => {
    const F = [...cellFrames(pos([['a', 0, 0], ['b', 5, 0], ['c', -5, 0]]), new Map()).values()];
    it('visibleFrames keeps exactly the cells meeting the rectangle', () => {
        const a = F.find((f) => f.key === 'a');
        const vis = visibleFrames(F, { x0: a.cell.x + 1, y0: a.cell.y + 1, x1: a.cell.x + 2, y1: a.cell.y + 2 });
        expect(vis.map((f) => f.key)).toEqual(['a']);
        const all = framesBounds(F);
        expect(visibleFrames(F, all).map((f) => f.key)).toEqual(['a', 'b', 'c']);
        expect(visibleFrames(F, { x0: all.x1 + 1, y0: 0, x1: all.x1 + 9, y1: 9 })).toEqual([]);
    });
    it('frameAt finds the cell under a world point; tileCentre is the tile centre', () => {
        const b = F.find((f) => f.key === 'b');
        expect(frameAt(F, b.cell.x + 3, b.cell.y + 3).key).toBe('b');
        expect(frameAt(F, -1e9, 0)).toBe(null);
        expect(tileCentre(b, 0, 0)).toEqual({ x: b.x + b.tilePx / 2, y: b.y + b.tilePx / 2 });
    });
});

describe('the camera', () => {
    const vp = { w: 800, h: 600 };
    it('world → screen → world round-trips, signed', () => {
        const cam = { x: -340, y: 120, zoom: 0.37 };
        const s = worldToScreen(cam, vp, -1000, 50);
        const w = screenToWorld(cam, vp, s.x, s.y);
        expect(w.x).toBeCloseTo(-1000, 9);
        expect(w.y).toBeCloseTo(50, 9);
        expect(worldToScreen(cam, vp, cam.x, cam.y)).toEqual({ x: 400, y: 300 });
    });
    it('zoomAround keeps the world point under the cursor fixed, and clamps', () => {
        const cam = { x: 10, y: 20, zoom: 1 };
        const before = screenToWorld(cam, vp, 123, 456);
        const z = zoomAround(cam, vp, 123, 456, 2.5);
        const after = screenToWorld(z, vp, 123, 456);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
        expect(zoomAround(cam, vp, 0, 0, 1e9).zoom).toBe(MAX_ZOOM);
        expect(zoomAround(cam, vp, 0, 0, 1e-9).zoom).toBe(MIN_ZOOM);
    });
    it('panBy moves the world with the pointer; fitCamera shows the whole box; viewRect is the inverse box', () => {
        const cam = panBy({ x: 0, y: 0, zoom: 2 }, 100, -50);
        expect(cam).toEqual({ x: -50, y: 25, zoom: 2 });
        const box = { x0: -500, y0: -100, x1: 1500, y1: 900 };
        const fit = fitCamera(box, vp, { margin: 0 });
        const r = viewRect(fit, vp);
        expect(r.x0).toBeLessThanOrEqual(box.x0 + 1e-9);
        expect(r.x1).toBeGreaterThanOrEqual(box.x1 - 1e-9);
        expect(r.y0).toBeLessThanOrEqual(box.y0 + 1e-9);
        expect(r.y1).toBeGreaterThanOrEqual(box.y1 - 1e-9);
    });
    it('easeCamera runs from a to b', () => {
        const a = { x: 0, y: 0, zoom: 1 };
        const b = { x: 100, y: -40, zoom: 4 };
        expect(easeCamera(a, b, 0)).toEqual(a);
        expect(easeCamera(a, b, 1)).toEqual(b);
        expect(easeCamera(a, b, 0.5).zoom).toBeCloseTo(2, 9);
    });
});

describe('location squares', () => {
    const f = cellFrames(pos([['a', 0, 0]]), ext([['a', 10, 10]])).get('a');
    const vp = { w: 400, h: 400 };
    it('centred on the tile; never under the minimum side, at any zoom', () => {
        for (const zoom of [MIN_ZOOM, 0.01, 0.1, 1, 4]) {
            const cam = { x: f.x, y: f.y, zoom };
            const [q] = frameSquares(f, [{ location: 'L', x: 3, y: 7, kind: 'item' }], cam, vp);
            const c = worldToScreen(cam, vp, f.x + 3.5 * f.tilePx, f.y + 7.5 * f.tilePx);
            expect(q.sx).toBeCloseTo(c.x, 9);
            expect(q.sy).toBeCloseTo(c.y, 9);
            expect(q.side).toBeGreaterThanOrEqual(MIN_SQUARE_PX);
        }
        expect(squareSide(f, 4)).toBeGreaterThan(MIN_SQUARE_PX);
        expect(squareSide(f, 0.01, 9)).toBe(9);
    });
    it('squareAt hits the last drawn square under the point', () => {
        const qs = [{ location: 'a', sx: 10, sy: 10, side: 6 }, { location: 'b', sx: 12, sy: 10, side: 6 }];
        expect(squareAt(qs, 11, 10).location).toBe('b');
        expect(squareAt(qs, 100, 100)).toBe(null);
    });
    it('generic places fit the extent and keep their order', () => {
        const names = Array.from({ length: 30 }, (_, i) => `l${i}`);
        const t = genericLocationTiles(names, DEFAULT_EXTENT);
        expect(t.map((x) => x.location)).toEqual(names);
        for (const x of t) {
            expect(x.x).toBeLessThan(DEFAULT_EXTENT.w);
            expect(x.y).toBeLessThan(DEFAULT_EXTENT.h);
        }
    });
});

describe('the square colour (as the Region Graph shows it)', () => {
    it('checked → checked; a null region colour → unknown; green only when both say accessible', () => {
        expect(squareColorKey({ state: 'checked' }, { color: null })).toBe('checked');
        expect(squareColorKey({ state: 'accessible' }, { color: null })).toBe('unknown');
        expect(squareColorKey({ state: 'accessible' }, { color: 'accessible' })).toBe('accessible');
        expect(squareColorKey({ state: 'accessible' }, { color: 'inaccessible' })).toBe('inaccessible');
        expect(squareColorKey({ state: 'inaccessible' }, { color: 'accessible' })).toBe('inaccessible');
        expect(squareColorKey(undefined, undefined)).toBe('unknown');
    });
});

describe('the settings schema', () => {
    it('declares every panel setting with its default (the schema is the source of the defaults)', () => {
        expect(REGION_MAP_SETTING_DEFAULTS).toEqual({
            followPlayer: true, cellSize: 'level', groupingRule: 'R1', showLinks: true, showUndiscovered: true, minSquarePx: 6,
        });
        expect(REGION_MAP_SETTINGS_SCHEMA.properties.cellSize.enum).toEqual(['level', 'uniform']);
    });
});

/** Every location the preset's rules list for its (non-hub) regions. */
const rulesLocations = (rules, p) => Object.values(regionsOf(rules, p)).flatMap((r) => (r.locations ?? []).map((l) => l.name));

describe('the model over real presets (counts DERIVED from each preset, never pinned)', () => {
    it('seedling_playthrough: one cell per display level, every location placed, every cell sized, no sub-region dim', () => {
        const m = buildRegionMapModel({ rules: PLAYTHROUGH, registry: substrateRegistry });
        expect(m.layout.stats.source).toBe('hook');
        const sidecars = PLAYTHROUGH.preset_sidecars[m.player];
        const levels = new Set(Object.values(sidecars).map((s) => s.playable_payload.atlas_region));
        expect(m.cells.size).toBe(levels.size);
        expect([...m.cells.keys()].sort()).toEqual([...levels].sort());
        const placed = [...m.cells.values()].flatMap((c) => c.tiles.map((t) => t.location));
        const want = rulesLocations(PLAYTHROUGH, m.player);
        expect(new Set(placed).size).toBe(placed.length);
        expect(placed.length + m.unplaced.length).toBe(want.length);
        expect(m.unplaced).toEqual([]);
        for (const c of m.cells.values()) {
            expect(c.extent).not.toBe(null);
            expect(c.region.playable_payload).not.toHaveProperty('atlas_sub_region');
            expect(c.region.exits).toEqual([]);
            expect(c.tileSource).toBe('substrate');
        }
    });
    it('seedling_playthrough: a cross-level event is placed in the level that holds its object', () => {
        const m = buildRegionMapModel({ rules: PLAYTHROUGH, registry: substrateRegistry });
        const remote = [...m.cells.values()].flatMap((c) => c.tiles.filter((t) => t.remoteFrom).map((t) => ({ ...t, key: c.key })));
        const regions = regionsOf(PLAYTHROUGH, m.player);
        const sidecars = PLAYTHROUGH.preset_sidecars[m.player];
        const expected = Object.entries(regions).flatMap(([name, r]) => (r.locations ?? [])
            .filter((l) => Number.isInteger(l.obstacle?.level) && l.obstacle.level !== sidecars[name]?.playable_payload?.level)
            .map((l) => l.name));
        expect(remote.map((t) => t.location).sort()).toEqual(expected.sort());
        for (const t of remote) {
            const lv = regions[t.remoteFrom].locations.find((l) => l.name === t.location).obstacle.level;
            expect(Object.values(sidecars).find((s) => s.playable_payload.atlas_region === t.key).playable_payload.level).toBe(lv);
        }
    });
    it('seedling_playthrough: links join DIFFERENT groups only, from real door tiles', () => {
        const m = buildRegionMapModel({ rules: PLAYTHROUGH, registry: substrateRegistry });
        expect(m.links.length).toBeGreaterThan(0);
        for (const l of m.links) {
            expect(m.groupOf.get(l.from)).not.toBe(m.groupOf.get(l.to));
            expect(Array.isArray(l.a)).toBe(true);
        }
    });
    it('alttp (no sidecars, no hook): the generic layout, generic boxes, every location on a generic place', () => {
        const m = buildRegionMapModel({ rules: ALTTP, registry: substrateRegistry });
        expect(m.layout.stats.source).toBe('generic');
        for (const c of m.cells.values()) {
            expect(c.region).toBe(null);
            expect(c.tileSource).toBe('generic');
        }
        const placed = [...m.cells.values()].flatMap((c) => c.tiles.map((t) => t.location));
        expect(placed.length).toBe(rulesLocations(ALTTP, m.player).length);
        expect(m.unplaced).toEqual([]);
    });
    it('a generated preset (grid_cell): the stored cells, start at the origin', () => {
        const m = buildRegionMapModel({ rules: CHESTDOOR, registry: substrateRegistry });
        expect(m.layout.stats.source).toBe('grid_cell');
        expect(m.layout.positions.get(m.layout.start)).toEqual({ gx: 0, gy: 0 });
        expect(m.cells.size).toBe(m.layout.positions.size);
    });
    it('exitTileOf reads x/y first, then exit_tiles[0]', () => {
        expect(exitTileOf({ x: 1, y: 2, exit_tiles: [[9, 9]] })).toEqual([1, 2]);
        expect(exitTileOf({ exit_tiles: [[3, 4]] })).toEqual([3, 4]);
        expect(exitTileOf({ side: 'N' })).toBe(null);
    });
});

describe('the region view folds the committed sidecars (the step-2 sidecarIndex fix, end to end)', () => {
    it('seedling_playthrough: every model cell is a display group of the view, with the same members', () => {
        const m = buildRegionMapModel({ rules: PLAYTHROUGH, registry: substrateRegistry });
        const regions = regionsOf(PLAYTHROUGH, m.player);
        const staticData = { regions: new Map(Object.entries(regions)) };
        const snapshot = { regionReachability: {}, checkedLocations: [] };
        const discovery = { isRegionDiscovered: () => true, isLocationDiscovered: () => true, isExitDiscovered: () => true };
        const view = computeRegionView({ snapshot, staticData, discovery, registry: substrateRegistry, rules: PLAYTHROUGH, playerId: m.player });
        for (const [key, cell] of m.cells) {
            expect(view.displayGroups.get(key)?.members, key).toEqual(cell.members);
        }
        for (const [name, rec] of view.regions) {
            if (PLAYTHROUGH.preset_sidecars[m.player][name]) expect(m.cells.has(rec.displayKey), name).toBe(true);
        }
    });
});
