/**
 * CONTENT SETS TILE-1 — **THE ONE TILE FALLBACK CHAIN** (`mazeTileArt.drawMazeTile`; ⚖ the user 2026-11-15: "I don't
 * want adding a new custom tile type in the library to require updating the default graphics."). In node, on the
 * recorded draw-op log (`drawOpRecorder.js`):
 *
 *   1. The chain's four steps, in order: the theme's art; the caller's own draw; the kind's base; the placeholder —
 *      which never throws and logs each kind once.
 *   2. The bases: every `MAZE_ART_KEYS` row declares one of the closed set; `floor`/`wall` paint the painter's own
 *      colours; the `marker`/`character` colours and the placeholder's are used by no kind (no `COLORS` value, no
 *      composite `COLORS` value), so a fallback is never mistaken for a kind's own look.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordingContext } from './drawOpRecorder.js';
import { COLORS } from './mazeRoomRender.js';
import { COLORS as COMPOSITE_COLORS } from '../procgenCore/compositeMapRenderer.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import {
    MAZE_ART_KEYS, MAZE_ART_THINGS, MAZE_TILE_BASES, MAZE_TILE_PLACEHOLDER, drawMazeTile, mazeTileBaseOf,
    mazeTileStep, resetMazeTilePlaceholderLogForTests,
} from './mazeTileArt.js';

/** A tileArt stub: every key in `keys` resolves to its own one-frame sheet. */
function stubTileArt(keys) {
    const set = new Set(keys);
    const art = {
        has: (k) => set.has(k),
        frameRect: (k) => (set.has(k) ? { sheetRef: `sheet:${k}`, sx: 0, sy: 0, sw: 16, sh: 16 } : null),
        packOf: () => 'stub',
    };
    return { art, images: new Map(keys.map((k) => [`sheet:${k}`, { src: k }])) };
}

const drawn = (fn) => {
    const ctx = recordingContext();
    const step = fn(ctx);
    return { step, log: ctx.__log };
};
const BASE_NAMES = Object.keys(MAZE_TILE_BASES);

describe('the chain, step by step', () => {
    afterEach(() => {
        resetMazeTilePlaceholderLogForTests();
        vi.restoreAllMocks();
    });

    it('1. a row the theme has art for draws the art, and not its own draw', () => {
        const own = vi.fn();
        const { step, log } = drawn((ctx) => drawMazeTile(ctx, stubTileArt([MAZE_ART_KEYS.trap.key]), 'trap', 10, 20, 16, { own }));
        expect(step).toBe('art');
        expect(own).not.toHaveBeenCalled();
        expect(log.join('\n')).toContain(JSON.stringify({ src: MAZE_ART_KEYS.trap.key }));
    });

    it('2. without art, a row draws its own draw — and only that', () => {
        for (const tileArt of [null, stubTileArt([]), { art: createArtLibrary([]), images: new Map() }]) {
            const { step, log } = drawn((ctx) => drawMazeTile(ctx, tileArt, 'trap', 0, 0, 16, {
                own: () => { ctx.fillStyle = COLORS.trap; },
            }));
            expect(step).toBe('default');
            expect(log).toEqual([`fillStyle=${JSON.stringify(COLORS.trap)}`]);
        }
    });

    it('3. a row with no own draw falls back to its declared base', () => {
        const { step, log } = drawn((ctx) => drawMazeTile(ctx, null, 'pulser', 0, 0, 16));
        expect(step).toBe('base');
        expect(log.join('\n')).toContain(JSON.stringify(MAZE_TILE_BASES[MAZE_ART_KEYS.pulser.base].color));
    });

    it('a kind the table does not know draws its declared art key, else its declared base', () => {
        const key = 'fixture:object/lantern';
        const art = drawn((ctx) => drawMazeTile(ctx, stubTileArt([key]), 'lantern', 0, 0, 16, { base: 'marker', artKey: key }));
        expect(art.step).toBe('art');
        for (const base of BASE_NAMES) {
            const { step, log } = drawn((ctx) => drawMazeTile(ctx, stubTileArt([]), 'lantern', 0, 0, 16, { base, artKey: key }));
            expect(step, base).toBe('base');
            expect(log.join('\n'), base).toContain(JSON.stringify(MAZE_TILE_BASES[base].color));
            expect(log.join('\n'), base).not.toContain(JSON.stringify(MAZE_TILE_PLACEHOLDER.color));
        }
    });

    it('4. a kind with no art, no own draw and no base draws the placeholder: no throw, logged once per kind', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const declared of [null, 'not-a-base']) {
            const { step, log } = drawn((ctx) => drawMazeTile(ctx, null, 'lantern', 0, 0, 16, { base: declared }));
            expect(step).toBe('placeholder');
            expect(log.join('\n')).toContain(JSON.stringify(MAZE_TILE_PLACEHOLDER.color));
            expect(log.join('\n')).toContain('fillText("la"');
        }
        expect(() => drawMazeTile(recordingContext(), null, undefined, 0, 0, 16)).not.toThrow();
        drawMazeTile(recordingContext(), null, 'torch', 0, 0, 16);
        expect(warn.mock.calls.map((c) => c[0].match(/"([^"]*)"/)[1])).toEqual(['lantern', 'undefined', 'torch']);
    });

    it('mazeTileStep answers what drawMazeTile does, without drawing', () => {
        const tileArt = stubTileArt([MAZE_ART_KEYS.wall.key]);
        expect(mazeTileStep(tileArt, 'wall')).toBe('art');
        expect(mazeTileStep(tileArt, 'floor', { hasOwn: true })).toBe('default');
        expect(mazeTileStep(tileArt, 'floor')).toBe('base');
        expect(mazeTileStep(tileArt, 'lantern', { base: 'character' })).toBe('base');
        expect(mazeTileStep(tileArt, 'lantern')).toBe('placeholder');
        // an inherited property name is not a row
        expect(mazeTileStep(null, 'constructor')).toBe('placeholder');
    });
});

describe('the bases', () => {
    it('every key-table row declares a base of the closed set', () => {
        for (const thing of MAZE_ART_THINGS) {
            expect(BASE_NAMES, thing).toContain(MAZE_ART_KEYS[thing].base);
            expect(mazeTileBaseOf(thing), thing).toBe(MAZE_ART_KEYS[thing].base);
        }
    });

    it('floor and wall are the painter\'s own colours', () => {
        expect(MAZE_TILE_BASES.floor.color).toBe(COLORS.floor);
        expect(MAZE_TILE_BASES.wall.color).toBe(COLORS.wall);
    });

    it('the marker, character and placeholder colours are no kind\'s, and differ from each other', () => {
        const used = new Set([...Object.values(COLORS), ...Object.values(COMPOSITE_COLORS)].map((c) => String(c).toLowerCase()));
        const own = [MAZE_TILE_BASES.marker.color, MAZE_TILE_BASES.character.color, MAZE_TILE_PLACEHOLDER.color]
            .map((c) => c.toLowerCase());
        expect(own.filter((c) => used.has(c))).toEqual([]);
        expect(new Set(own).size).toBe(own.length);
    });
});
