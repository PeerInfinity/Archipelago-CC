/**
 * THE PIXEL PULL DISC (slice tile-pixel-pull-disc, ⚖ Robert 2026-11-21 "Hybrid + direction check"). The game decides a
 * LavaTrap launch per FRAME on the player's origin (`LavaTrap.as:81-88`): `int(FP.distance(trap, player)) <= chompRange`
 * on the REAL origin (`FP.as:264` takes `Number`s), and `World.collideLine("Solid", …)` from the trap to the origin
 * truncated to int (`World.as:411`), the game's own DDA. `lavaTrapPulls` classifies each tile over its standable origins:
 * ALWAYS (pulled wherever the player stands in it), PARTIAL (somewhere), NEVER.
 *
 * Rows from the GAME, taped on the p4g build with the Dark Suit (fresh page each):
 * - L77 int (77,191): at rest at (77.97, 191.48) for 80+ ticks, NO reel — the DDA from (104,200) reads y = 191.999… at
 *   x = 80, inside wall (5,11); an exact segment sampler reads 192.0, outside it.
 * - L77 int (72,191): at rest at (72.95, 191.45) (real d 32.21), REELED 6 ticks after range entry — the int point itself is
 *   33.24 px out, so a range test on the int origin would miss it.
 * The mutant (back to the centre test: a tile is in the disc iff its CENTRE is in range on a clear centre line) reds the
 * class rows.
 */
import { describe, it, expect } from 'vitest';
import { PLAYTHROUGH_MAP, playthroughGridFor, playthroughLavaTrapPulls } from './make-seedling-playthrough-rules.mjs';
import { pullLineClear, pullsOrigin, pullClass, LAVATRAP_PULL } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const T = 16;
const levelOf = (n) => (PLAYTHROUGH_MAP.levels ?? PLAYTHROUGH_MAP).find((l) => l.level === n);
function wallsOf(n) {
    const g = playthroughGridFor(levelOf(n), {});
    return (x, y) => g.cells[y * g.width + x]?.kind === 'wall';
}
const pullAt = (n, tile) => playthroughLavaTrapPulls(levelOf(n)).find((p) => p.tile.join() === tile.join());
const has = (list, t) => list.some((c) => c.join() === t.join());
const classOf = (p, t) => (has(p.always, t) ? 'always' : has(p.partial, t) ? 'partial' : 'never');

/** The OLD line test (the per-px segment sampler `pullLineClear` was before the DDA), for the grazing-corner row. */
function samplerClear(a, b, solid, aPx) {
    const [ax, ay] = aPx;
    const [bx, by] = [b[0] * T + T / 2, b[1] * T + T / 2];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let s = 1; s < steps; s += 1) {
        const x = Math.floor((ax + ((bx - ax) * s) / steps) / T);
        const y = Math.floor((ay + ((by - ay) * s) / steps) / T);
        if ((x === a[0] && y === a[1]) || (x === b[0] && y === b[1])) continue;
        if (solid(x, y)) return false;
    }
    return true;
}

/** The MUTANT: the centre test (main before the pixel disc) — in iff the tile CENTRE is in range on a clear line. */
function centreClass(t, trap, solid) {
    const c = [trap[0] * T + T / 2, trap[1] * T + T / 2];
    const p = [t[0] * T + T / 2, t[1] * T + T / 2];
    return Math.hypot(p[0] - c[0], p[1] - c[1]) <= LAVATRAP_PULL.chompRange && pullLineClear(t, trap, T, solid) ? 'always' : 'never';
}

// one row per class, per trap, from the levels (game-taped where marked)
const CLASS_ROWS = [
    { level: 77, trap: [6, 12], tile: [6, 13], cls: 'always' },
    { level: 77, trap: [6, 12], tile: [4, 11], cls: 'partial' }, // the SE sliver: reeled from a stop at (75.80, 191.45)
    { level: 77, trap: [6, 12], tile: [3, 11], cls: 'never' },
    { level: 78, trap: [9, 3], tile: [10, 3], cls: 'always' },
    { level: 78, trap: [9, 3], tile: [11, 4], cls: 'partial' }, // reeled from x < 180.86 on y = 72, not from x >= 183.6
    { level: 78, trap: [9, 6], tile: [11, 6], cls: 'never' }, // the pull-line cut (wall (10,6))
    { level: 80, trap: [5, 6], tile: [5, 5], cls: 'always' },
    { level: 80, trap: [5, 6], tile: [4, 8], cls: 'partial' }, // standing at (72, 131.5): d 31.8, line cut, not reeled
];

describe('the pixel disc classifies each tile over its standable origins', () => {
    for (const r of CLASS_ROWS) {
        it(`L${r.level} trap (${r.trap}): (${r.tile}) is ${r.cls.toUpperCase()}`, () => {
            const p = pullAt(r.level, r.trap);
            expect(classOf(p, r.tile)).toBe(r.cls);
            expect(pullClass(r.tile, r.trap, [r.trap[0] * T + T / 2, r.trap[1] * T + T / 2], T, wallsOf(r.level))).toBe(r.cls);
            expect(has(p.from, r.tile)).toBe(r.cls !== 'never');
        });
    }

    it('MUTANT: the centre test disagrees with at least one row of every non-trivial class (so the rows would red)', () => {
        const wrong = CLASS_ROWS.filter((r) => centreClass(r.tile, r.trap, wallsOf(r.level)) !== r.cls);
        // the centre test has no PARTIAL class at all, and calls the L77 sliver tile NEVER (its centre is 35.8 px out)
        expect(wrong.map((r) => `L${r.level} (${r.tile})`)).toEqual(expect.arrayContaining(['L77 (4,11)', 'L78 (11,4)', 'L80 (4,8)']));
    });

    it('every pull lists its range: a superset of its disc', () => {
        for (const n of [77, 78, 80, 108]) {
            for (const p of playthroughLavaTrapPulls(levelOf(n))) {
                for (const t of p.from) expect(has(p.range, t), `L${n} (${p.tile}) (${t})`).toBe(true);
            }
        }
    });
});

describe('the line is the game\'s own collideLine DDA (World.as:411)', () => {
    const solid = wallsOf(77);
    it('L77 int (77,191) → trap (6,12): BLOCKED by the DDA, CLEAR by the old sampler (taped: no reel in 80 ticks)', () => {
        expect(pullLineClear([4, 11], [6, 12], T, solid, [77, 191])).toBe(false);
        expect(samplerClear([4, 11], [6, 12], solid, [77, 191])).toBe(true);
        expect(pullsOrigin([77.97, 191.48], [4, 11], [6, 12], T, solid)).toBe(false);
    });

    it('L77 int (75,191) and (74,191): clear by both (taped: reeled)', () => {
        expect(pullsOrigin([75.8, 191.45], [4, 11], [6, 12], T, solid)).toBe(true);
        expect(pullsOrigin([74.21, 191.05], [4, 11], [6, 12], T, solid)).toBe(true);
        expect(pullsOrigin([74.21, 190.45], [4, 11], [6, 12], T, solid)).toBe(false); // taped: not reeled
    });
});

describe('the range is measured on the REAL origin (LavaTrap.as:81, FP.as:264)', () => {
    const solid = wallsOf(77);
    it('L77 int (72,191): the real origin (72.95, 191.45) is in range though the int point is not (taped: reeled)', () => {
        expect(Math.hypot(72 - 104, 191 - 200)).toBeGreaterThanOrEqual(LAVATRAP_PULL.chompRange + 1);
        expect(pullsOrigin([72.95, 191.45], [4, 11], [6, 12], T, solid)).toBe(true);
        // the MUTANT (range on the int origin) misses it
        expect(Math.trunc(Math.hypot(72 - 104, 191 - 200)) <= LAVATRAP_PULL.chompRange).toBe(false);
    });
});
