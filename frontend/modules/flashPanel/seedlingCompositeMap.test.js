/**
 * flashPanel/seedlingCompositeMap — the Seedling composite-map cell (region-map step 1, D2–D3), pinned in node.
 *
 * 1. D2 — the ONE resolver over three committed presets: `seedling_playthrough` (atlas, sub-regions, no
 *    `grid_cell`), `seedling_generated_room` (embedded record, beside maze cells) and `seedling_spiral_room`
 *    (atlas + `grid_cell`). No preset or region name is read.
 * 2. The hooks for steps 2–3: `displayRegionOf` folds a sub-region onto its level off the PAYLOAD; `locationTiles`
 *    places every location of `seedling_playthrough` (items via the atlas `tile`, events via `obstacle`) and a
 *    generated room's own.
 * 3. The painter's async shape on node seams: generic box on a miss, ONE bake per level, the host's redraw called
 *    ONCE per frame however many cells landed, the baked picture fitted and centred with the exit squares on top,
 *    a sub-region cell dimmed outside its tiles, a failure kept (generic, never retried), and no callback = no throw.
 * 4. The declaration: both Seedling entries declare it as DATA, frozen, `artwork: true`, node-importable.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLORS, TILE_PX } from '../procgenCore/compositeMapRenderer.js';
import {
    OUTSIDE_SUB_REGION_DIM, createSeedlingCompositePainter, drawSeedlingCompositeRegion, resolveSeedlingLevel,
    seedlingDisplayRegionOf, seedlingLevelSourceOf, seedlingLocationTiles, subRegionTiles, unplacedSeedlingLocations,
} from './seedlingCompositeMap.js';
import { SEEDLING_BACKGROUND } from '../seedlingDemo/seedlingLevelBake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const MAP = JSON.parse(readFileSync(join(HERE, 'atlases/seedling-map.json'), 'utf8'));
const rulesOf = (preset) => JSON.parse(readFileSync(join(ROOT, `frontend/presets/${preset}/AP_1/AP_1_rules.json`), 'utf8'));
const PLAYTHROUGH = rulesOf('seedling_playthrough');
const GENERATED = rulesOf('seedling_generated_room');
const SPIRAL = rulesOf('seedling_spiral_room');
const sidecars = (rules) => Object.entries(rules.preset_sidecars['1']);
const seedlingSidecars = (rules) => sidecars(rules).filter(([, sc]) => String(sc.substrate).startsWith('flash_seedling'));
const srcOf = (rules) => ({ rules, playerId: '1' });

describe('1. D2 — the level a region shows, from its sidecar alone', () => {
    it('seedling_playthrough: every region is an atlas level of the slot\'s map document, and resolves', () => {
        const all = seedlingSidecars(PLAYTHROUGH);
        expect(all.length).toBeGreaterThan(200);
        const levels = new Set();
        for (const [, sc] of all) {
            const src = seedlingLevelSourceOf(sc.playable_payload, srcOf(PLAYTHROUGH));
            expect(src.kind).toBe('atlas');
            expect(src.mapPath).toBe('modules/flashPanel/atlases/seedling-map.json');
            const { record, levelIndex } = resolveSeedlingLevel(src, MAP);
            expect(levelIndex).toBe(sc.playable_payload.level);
            expect(record.width * record.height).toBeGreaterThan(0);
            levels.add(levelIndex);
        }
        expect(levels.size).toBe(115);
    });

    it('seedling_generated_room: a generated room is its EMBEDDED record (no map document); maze cells are not Seedling', () => {
        const gen = seedlingSidecars(GENERATED);
        expect(gen.length).toBe(2);
        for (const [, sc] of gen) {
            const src = seedlingLevelSourceOf(sc.playable_payload, srcOf(GENERATED));
            expect(src.kind).toBe('record');
            expect(resolveSeedlingLevel(src).record).toBe(sc.playable_payload.record);
        }
        const maze = sidecars(GENERATED).find(([, sc]) => sc.substrate === 'maze')[1];
        expect(seedlingLevelSourceOf(maze.playable_payload, srcOf(GENERATED))).toBe(null);
    });

    it('seedling_spiral_room: an atlas room with a grid_cell, whose atlas region is NOT named level_N', () => {
        const [[, sc]] = seedlingSidecars(SPIRAL);
        expect(sc.grid_cell).toBeTruthy();
        const src = seedlingLevelSourceOf(sc.playable_payload, srcOf(SPIRAL));
        expect(src).toMatchObject({ kind: 'atlas', levelIndex: 0, atlasRegion: 'overworld_start', subRegion: 'r8c0' });
        expect(resolveSeedlingLevel(src, MAP).record).toBeTruthy();
    });

    it('no source → the atlases default map; an atlas level without its map document refuses by name', () => {
        const payload = seedlingSidecars(SPIRAL)[0][1].playable_payload;
        expect(seedlingLevelSourceOf(payload).mapPath).toBe('modules/flashPanel/atlases/seedling-map.json');
        expect(() => resolveSeedlingLevel(seedlingLevelSourceOf(payload))).toThrow(/needs its map document/);
        expect(() => resolveSeedlingLevel({ ...seedlingLevelSourceOf(payload), levelIndex: 9999 }, MAP))
            .toThrow(/has no level 9999/);
        expect(seedlingLevelSourceOf({ gameId: 'seedling' })).toBe(null);
        expect(seedlingLevelSourceOf(null)).toBe(null);
    });

    it('a slot naming another map_document is honoured (custom worlds)', () => {
        const rules = { region_atlas: { 2: { atlas_id: 'x', game: 'seedling', map_document: 'custom-map.json' } } };
        expect(seedlingLevelSourceOf({ level: 3 }, { rules, playerId: 2 }).mapPath)
            .toBe('modules/flashPanel/atlases/custom-map.json');
    });

    it('subRegionTiles: the partition\'s tiles of a sub-region, null for a whole level', () => {
        const [, sc] = sidecars(PLAYTHROUGH).find(([, v]) => v.playable_payload.atlas_sub_region === 'r1c6'
            && v.playable_payload.level === 0);
        const inside = subRegionTiles(seedlingLevelSourceOf(sc.playable_payload));
        expect(inside(6, 1)).toBe(true);
        expect(inside(0, 0)).toBe(false);
        const whole = sidecars(PLAYTHROUGH).find(([, v]) => !v.playable_payload.atlas_sub_region)[1];
        expect(subRegionTiles(seedlingLevelSourceOf(whole.playable_payload))).toBe(null);
    });
});

describe('2. the hooks for steps 2–3', () => {
    it('displayRegionOf folds level_N__rRcC onto level_N through atlas_region (the payload, not the name)', () => {
        for (const [name, sc] of seedlingSidecars(PLAYTHROUGH)) {
            expect(seedlingDisplayRegionOf(name, sc)).toBe(`level_${sc.playable_payload.level}`);
        }
        const [[name, sc]] = seedlingSidecars(SPIRAL);
        expect(seedlingDisplayRegionOf(name, sc)).toBe('overworld_start');
        expect(seedlingDisplayRegionOf(name, sc.playable_payload)).toBe('overworld_start');
        const [genName, gen] = seedlingSidecars(GENERATED)[0];
        expect(seedlingDisplayRegionOf(genName, gen)).toBe(genName);
    });

    it('locationTiles places seedling_playthrough\'s 48 items (atlas tile) + 37 events (obstacle); 3 remote events are residue', async () => {
        const { SEEDLING_PLAYTHROUGH_ATLAS } = await import('./flashSeedlingLibrary.js');
        const atlases = { [SEEDLING_PLAYTHROUGH_ATLAS.atlas_id]: SEEDLING_PLAYTHROUGH_ATLAS };
        const ctx = { rules: PLAYTHROUGH, playerId: '1', atlases };
        const kinds = { item: 0, event: 0 };
        let residue = [];
        for (const [region_id, sc] of seedlingSidecars(PLAYTHROUGH)) {
            const region = { region_id, playable_payload: sc.playable_payload };
            const record = resolveSeedlingLevel(seedlingLevelSourceOf(sc.playable_payload), MAP).record;
            for (const t of seedlingLocationTiles(region, ctx)) {
                kinds[t.kind] += 1;
                expect(t.x >= 0 && t.x < record.width && t.y >= 0 && t.y < record.height, `${t.location} in its level`).toBe(true);
            }
            residue = residue.concat(unplacedSeedlingLocations(region, ctx));
        }
        expect(kinds).toEqual({ item: 48, event: 37 });
        // ⛓ the three events whose obstacle is in ANOTHER level than the region listing them (a remote effect)
        expect(residue.sort()).toEqual(['L39 flag 8: wandlock@144,592 cleared', 'L62 flag 0: lightpole@120,200 cleared',
            'L63 flag 1: lightpole@64,88 cleared'].sort());
    });

    it('locationTiles: a generated room places its own locations (no rules needed); the registry hook wraps it', async () => {
        const [region_id, sc] = seedlingSidecars(GENERATED)[0];
        const region = { region_id, playable_payload: sc.playable_payload };
        const want = sc.playable_payload.locations.map((l) => ({ location: l.name, x: l.cell.tx, y: l.cell.ty, kind: 'item' }));
        expect(seedlingLocationTiles(region)).toEqual(want);
        const { substrateRegistryEntry } = await import('./flashSeedlingGenLibrary.js');
        expect(substrateRegistryEntry.compositeMap.locationTiles(region)).toEqual(want);
    });
});

/* ── the painter, on node seams ── */

function recorder(width = 0, height = 0) {
    const ops = [];
    const ctx = {
        fillStyle: null, strokeStyle: null, lineWidth: null, font: null, textAlign: null, textBaseline: null,
        imageSmoothingEnabled: true, globalAlpha: 1,
        fillRect: (...a) => ops.push({ op: 'fillRect', style: ctx.fillStyle, a }),
        strokeRect: (...a) => ops.push({ op: 'strokeRect', a }),
        fillText: (...a) => ops.push({ op: 'fillText', a }),
        drawImage: (img, ...a) => ops.push({ op: 'drawImage', img, a }),
        save: () => {}, restore: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
        measureText: (s) => ({ width: String(s ?? '').length }),
    };
    return { width, height, ops, ctx, getContext: () => ctx };
}

function seams({ failArt = false } = {}) {
    const macro = [];
    const frames = [];
    const loads = [];
    const made = [];
    const painter = createSeedlingCompositePainter({
        loadArt: async () => { if (failArt) throw new Error('no art in node'); return { art: null, images: new Map() }; },
        loadMapDocument: async (path) => { loads.push(path); return MAP; },
        newCanvas: (w, h) => { const c = recorder(w, h); made.push(c); return c; },
        schedule: (fn) => macro.push(fn),
        frame: (fn) => frames.push(fn),
    });
    const settle = async () => {
        for (let i = 0; i < 50 && macro.length; i++) {
            const fn = macro.shift();
            fn();
            await new Promise((r) => setTimeout(r, 0));
        }
    };
    return { painter, macro, frames, loads, made, settle };
}

const REGION_SIZE = { width: 10, height: 10 };
const cellOf = (rules, pick) => {
    const [region_id, sc] = seedlingSidecars(rules).find(pick ?? (() => true));
    return { region_id, playable_payload: sc.playable_payload, exits: sc.playable_payload.exits };
};

describe('3. the painter: a sync draw over an async, cached bake', () => {
    it('miss → the generic box; the bake lands → ONE redraw per frame for the host; hit → the fitted level + exit squares', async () => {
        const s = seams();
        const region = cellOf(SPIRAL);
        const redraws = [];
        const requestRedraw = () => redraws.push(1);
        const geom = { offX: 0, offY: 0, regionSize: REGION_SIZE, tilePx: TILE_PX, colors: COLORS, source: srcOf(SPIRAL), requestRedraw };
        const first = recorder();
        s.painter.drawRegion(first.ctx, region, geom);
        expect(first.ops.some((o) => o.op === 'fillRect' && o.style === COLORS.genericBg)).toBe(true);
        expect(first.ops.some((o) => o.op === 'drawImage')).toBe(false);
        // a second draw of the same cell before the bake lands queues nothing new
        s.painter.drawRegion(recorder().ctx, region, geom);
        expect(s.painter.stats()).toMatchObject({ requested: 1, pending: 1 });

        await s.settle();
        expect(s.loads).toEqual(['modules/flashPanel/atlases/seedling-map.json']);
        expect(s.painter.stats()).toMatchObject({ baked: 1, failed: 0, pending: 0 });
        expect(s.frames).toHaveLength(1);
        expect(redraws).toEqual([]);
        s.frames.shift()();
        expect(redraws).toEqual([1]);

        const hit = recorder();
        s.painter.drawRegion(hit.ctx, region, geom);
        const img = hit.ops.find((o) => o.op === 'drawImage');
        expect(img).toBeTruthy();
        const cellW = REGION_SIZE.width * TILE_PX;
        const [x, y, w, h] = img.a;
        expect(Math.max(w, h)).toBe(cellW);
        expect(x + w / 2).toBeCloseTo(cellW / 2, 0);
        expect(y + h / 2).toBeCloseTo(cellW / 2, 0);
        expect(hit.ops[0]).toMatchObject({ op: 'fillRect', style: SEEDLING_BACKGROUND });
        const exitSquares = hit.ops.filter((o) => o.op === 'fillRect' && o.style === COLORS.exit);
        expect(exitSquares).toHaveLength(region.exits.length);
    });

    it('a sub-region cell is its WHOLE level with the rest dimmed; two sub-regions of one level share ONE bake', async () => {
        const s = seams();
        const pick = (lvl, sub) => ([, sc]) => sc.playable_payload.level === lvl && sc.playable_payload.atlas_sub_region === sub;
        const a = cellOf(PLAYTHROUGH, pick(0, 'r1c6'));
        const b = cellOf(PLAYTHROUGH, pick(0, 'r7c6'));
        const geom = { offX: 0, offY: 0, regionSize: REGION_SIZE, tilePx: TILE_PX, colors: COLORS, source: srcOf(PLAYTHROUGH), requestRedraw: () => {} };
        s.painter.drawRegion(recorder().ctx, a, geom);
        s.painter.drawRegion(recorder().ctx, b, geom);
        await s.settle();
        expect(s.painter.stats()).toMatchObject({ requested: 1, baked: 1 });
        const ha = recorder();
        const hb = recorder();
        s.painter.drawRegion(ha.ctx, a, geom);
        s.painter.drawRegion(hb.ctx, b, geom);
        const picA = ha.ops.find((o) => o.op === 'drawImage').img;
        const picB = hb.ops.find((o) => o.op === 'drawImage').img;
        expect(picA).not.toBe(picB);
        const dims = (pic) => pic.ops.filter((o) => o.op === 'fillRect' && o.style === OUTSIDE_SUB_REGION_DIM).length;
        const { record } = resolveSeedlingLevel(seedlingLevelSourceOf(a.playable_payload), MAP);
        const inside = subRegionTiles(seedlingLevelSourceOf(a.playable_payload));
        let outside = 0;
        for (let y = 0; y < record.height; y++) for (let x = 0; x < record.width; x++) if (!inside(x, y)) outside += 1;
        expect(dims(picA)).toBe(outside);
        expect(dims(picB)).toBeGreaterThan(0);
    });

    it('many cells landing in one frame → the host is asked ONCE; bakes are capped and lazy', async () => {
        const s = seams();
        const redraws = [];
        const requestRedraw = () => redraws.push(1);
        const geom = { offX: 0, offY: 0, regionSize: REGION_SIZE, tilePx: TILE_PX, colors: COLORS, source: srcOf(PLAYTHROUGH), requestRedraw };
        const levels = new Map();
        for (const [region_id, sc] of seedlingSidecars(PLAYTHROUGH)) {
            if (!levels.has(sc.playable_payload.level) && levels.size < 6) levels.set(sc.playable_payload.level, { region_id, playable_payload: sc.playable_payload, exits: [] });
        }
        for (const r of levels.values()) s.painter.drawRegion(recorder().ctx, r, geom);
        expect(s.macro).toHaveLength(2);
        await s.settle();
        expect(s.painter.stats()).toMatchObject({ requested: 6, baked: 6 });
        expect(s.frames.length).toBeGreaterThanOrEqual(1);
        while (s.frames.length) s.frames.shift()();
        expect(redraws.length).toBeLessThanOrEqual(3);
        expect(redraws.length).toBeGreaterThanOrEqual(1);
    });

    it('a failed bake stays generic, is not retried, and names its reason; no callback never throws', async () => {
        const s = seams({ failArt: true });
        const region = cellOf(SPIRAL);
        const geom = { offX: 0, offY: 0, regionSize: REGION_SIZE, tilePx: TILE_PX, colors: COLORS, source: srcOf(SPIRAL) };
        s.painter.drawRegion(recorder().ctx, region, geom);
        await s.settle();
        expect(s.painter.stats()).toMatchObject({ baked: 0, failed: 1, failures: [{ error: 'no art in node' }] });
        const again = recorder();
        s.painter.drawRegion(again.ctx, region, geom);
        expect(again.ops.some((o) => o.op === 'fillRect' && o.style === COLORS.genericBg)).toBe(true);
        expect(s.macro).toHaveLength(0);
        expect(s.painter.stats().requested).toBe(1);
    });

    it('a generated room bakes from its record, keyed by CONTENT (a re-deserialized copy is a hit)', async () => {
        const s = seams();
        const region = cellOf(GENERATED);
        const geom = { offX: 0, offY: 0, regionSize: REGION_SIZE, tilePx: TILE_PX, colors: COLORS, source: srcOf(GENERATED) };
        s.painter.drawRegion(recorder().ctx, region, geom);
        await s.settle();
        expect(s.loads).toEqual([]);
        const copy = { ...region, playable_payload: structuredClone(region.playable_payload) };
        const hit = recorder();
        s.painter.drawRegion(hit.ctx, copy, geom);
        expect(hit.ops.some((o) => o.op === 'drawImage')).toBe(true);
        expect(s.painter.stats()).toMatchObject({ requested: 1, baked: 1 });
    });
});

describe('4. the declaration', () => {
    it('both Seedling entries declare compositeMap as frozen DATA, artwork: true, the shared painter', async () => {
        expect(globalThis.document).toBeUndefined();
        const { substrateRegistryEntry: atlas } = await import('./flashSeedlingLibrary.js');
        const { substrateRegistryEntry: gen } = await import('./flashSeedlingGenLibrary.js');
        for (const entry of [atlas, gen]) {
            expect(Object.isFrozen(entry.compositeMap)).toBe(true);
            expect(entry.compositeMap.drawRegion).toBe(drawSeedlingCompositeRegion);
            expect(entry.compositeMap.artwork).toBe(true);
            expect(typeof entry.compositeMap.locationTiles).toBe('function');
            expect(entry.compositeMap.displayRegionOf).toBe(seedlingDisplayRegionOf);
        }
    });
});
