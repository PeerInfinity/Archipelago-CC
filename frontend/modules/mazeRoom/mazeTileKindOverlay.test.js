/**
 * CONTENT SETS TILE-3 — **THE PLACED TILE KINDS IN BOTH VIEWS** (`mazeTileKindOverlay.drawMazeTileKinds`): the Maze
 * Room panel's pass beside `drawWorld`, and the composite map's maze cell. On the recorded draw-op log:
 *
 *   1. ⛔ A world with no placed kind draws NOTHING in the pass, and the composite cell's ops are the same whether or
 *      not the host hands it declared kinds.
 *   2. Each placed kind draws through TILE-1's chain with TILE-2's lookup at its own cell (offset on the composite
 *      map): its base, the placeholder when undeclared, its art when the stack has the key.
 *   3. As a thing: not under the fog until seen, not on the player's cell.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordingContext } from './drawOpRecorder.js';
import { TILE_FLOOR, deserializeMazeWorld, getTile } from './mazeRoomEngine.js';
import { drawMazeCompositeRegion } from './mazeCompositeMap.js';
import { drawMazeTileKinds } from './mazeTileKindOverlay.js';
import { occupiedWorldCells, withTileKinds } from './mazeTileKinds.js';
import { paintMazeTileBase, paintMazeTilePlaceholder, resetMazeTilePlaceholderLogForTests } from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const META = JSON.parse(readFileSync(join(HERE, '../../presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const PAYLOAD = Object.values(META.preset_sidecars['1']).find((sc) => sc.substrate === 'maze').playable_payload;
const PX = 16;
const KIND = 'tile3-fixture:object/lantern';
const DECLARED = { [KIND]: { artKey: 'tile3-fixture:tile/lantern', base: 'marker', pack: 'tile3-fixture' } };

const plainWorld = () => deserializeMazeWorld(JSON.parse(JSON.stringify(PAYLOAD)));
const free = (w) => {
    const busy = occupiedWorldCells(w);
    const out = [];
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (getTile(w, x, y) === TILE_FLOOR && !busy.has(`${x},${y}`)) out.push({ x, y });
    return out;
};
const ops = (fn) => {
    const ctx = recordingContext();
    const out = fn(ctx);
    return { out, log: ctx.__log };
};
/** True when `run` occurs in `log` as a contiguous run. */
const containsRun = (log, run) => {
    for (let i = 0; i + run.length <= log.length; i++) if (run.every((op, j) => log[i + j] === op)) return true;
    return false;
};
const view = (extra = {}) => ({ tilePx: PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt: null, ...extra });

afterEach(() => {
    resetMazeTilePlaceholderLogForTests();
    vi.restoreAllMocks();
});

describe('1. ⛔ a world with no placed kind draws nothing more', () => {
    it('the pass records no op and returns no draw', () => {
        const got = ops((ctx) => drawMazeTileKinds(ctx, plainWorld(), view({ tileKinds: DECLARED })));
        expect(got.out).toEqual([]);
        expect(got.log).toEqual([]);
    });
    it('the composite cell draws the same ops with and without declared kinds handed in', () => {
        const region = { playable_payload: plainWorld() };
        const draw = (geom) => ops((ctx) => drawMazeCompositeRegion(ctx, region, { offX: 40, offY: 24, tilePx: PX, tileArt: null, ...geom })).log;
        expect(draw({ tileKinds: DECLARED })).toEqual(draw({}));
    });
});

describe('2. each placed kind, through the chain, at its own cell in both views', () => {
    const placed = () => {
        const w = plainWorld();
        const [a, b] = free(w);
        return { a, b, w: withTileKinds(w, { tileKinds: [{ ...a, kind: KIND }, { ...b, kind: 'other:object/x' }] }) };
    };

    it('the panel pass: the declared kind draws its base, the undeclared one the placeholder', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { a, b, w } = placed();
        const got = ops((ctx) => drawMazeTileKinds(ctx, w, view({ tileKinds: DECLARED })));
        expect(got.out).toEqual([{ ...a, kind: KIND, as: 'base' }, { ...b, kind: 'other:object/x', as: 'placeholder' }]
            .sort((p, q) => (p.y - q.y) || (p.x - q.x)));
        expect(containsRun(got.log, ops((ctx) => paintMazeTileBase(ctx, 'marker', a.x * PX, a.y * PX, PX)).log)).toBe(true);
        expect(containsRun(got.log, ops((ctx) => paintMazeTilePlaceholder(ctx, 'other:object/x', b.x * PX, b.y * PX, PX)).log)).toBe(true);
    });

    it('the declared kinds may come from the loaded tileArt instead (`tileArt.tileKinds`)', () => {
        const { a, w } = placed();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const stubArt = { art: { has: () => false, frameRect: () => null, packOf: () => null }, images: new Map(), tileKinds: DECLARED };
        const got = ops((ctx) => drawMazeTileKinds(ctx, w, view({ tileArt: stubArt })));
        expect(got.out.find((d) => d.kind === KIND)).toEqual({ ...a, kind: KIND, as: 'base' });
    });

    it('with art for its key, the kind draws the art', () => {
        const { w } = placed();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const key = DECLARED[KIND].artKey;
        const stubArt = {
            art: { has: (k) => k === key, frameRect: () => ({ sheetRef: 's', sx: 0, sy: 0, sw: 16, sh: 16 }), packOf: () => 'p' },
            images: new Map([['s', { src: 's' }]]),
        };
        const got = ops((ctx) => drawMazeTileKinds(ctx, w, view({ tileArt: stubArt, tileKinds: DECLARED })));
        expect(got.out.find((d) => d.kind === KIND).as).toBe('art');
    });

    it('the composite cell: the same draw at the cell\'s origin', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { a, w } = placed();
        const [offX, offY] = [40, 24];
        const log = ops((ctx) => drawMazeCompositeRegion(ctx, { playable_payload: w }, { offX, offY, tilePx: PX, tileArt: null, tileKinds: DECLARED })).log;
        expect(containsRun(log, ops((ctx) => paintMazeTileBase(ctx, 'marker', offX + a.x * PX, offY + a.y * PX, PX)).log)).toBe(true);
    });
});

describe('3. as a thing: the fog and the player', () => {
    it('a kind under the fog, or on the player\'s cell, is not drawn', () => {
        const w = plainWorld();
        const [a, b] = free(w);
        withTileKinds(w, { tileKinds: [{ ...a, kind: KIND }, { ...b, kind: KIND }] });
        const fogged = drawMazeTileKinds(recordingContext(), w, view({ tileKinds: DECLARED, fogEnabled: true, isTileVisible: (x, y) => x === a.x && y === a.y }));
        expect(fogged.map((d) => [d.x, d.y])).toEqual([[a.x, a.y]]);
        const under = drawMazeTileKinds(recordingContext(), w, view({ tileKinds: DECLARED, playerPos: a }));
        expect(under.map((d) => [d.x, d.y])).toEqual([[b.x, b.y]]);
    });
});
