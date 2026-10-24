/**
 * seedling-fidelity-spearrect — THE SPEAR'S TEST AS THE GAME RUNS IT, FOR EVERY SPEAR ARM (`CONTACT_FIDELITY.spearGameTest`).
 *
 * `Player.spear()` (`Player.as:954-992`): a 32x5 rect from the `int` origin (`spearX`/`spearY`, `Player.as:1341-1348`),
 * `collideRectInto` → `Entity.collideRect`'s INCLUSIVE edges (`Entity.as:263`), `genericHit` with no reach gate and no
 * line test, on T+1, T+3 and T+5 (`spearDelayMax` 1). D2's rows: the rule (`presses.spearGameRect`,
 * `pressRectTouches`, `spearHitRect`), its switch, and the fold of DRILL's drill-only copy into it.
 */
import { describe, expect, it } from 'vitest';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    DOWN, LEFT, RIGHT, SPEAR_HIT_TICKS, SPEAR_REPEAT_OFFSETS, UP, pressRectTouches, spearGameRect,
    spearHitRect, spearRect,
} from './presses.js';

const box = (x, y, w, h) => ({ x, y, right: x + w, bottom: y + h });

describe('fidelity SPEARRECT D2 — the rule', () => {
    // ⛓ shipped OFF; planning-10's flip (⚖ user "Harvest + flip ON", 2026-10-22) turns it ON.
    it('ships ON (flipped), and OFF `spearHitRect` IS `spearRect` (byte-identical)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.spearGameTest).toBe(true);
        if (!globalThis.process?.env?.SEEDLING_SPEAR_GAME_TEST && !globalThis.process?.env?.SEEDLING_CONTACT_FIDELITY) {
            expect(CONTACT_FIDELITY.spearGameTest).toBe(true);
        }
        withContactFidelity({ spearGameTest: false }, () => {
            for (const d of [RIGHT, UP, LEFT, DOWN]) {
                expect(spearHitRect(125.13, 72.9, d)).toEqual(spearRect(125.13, 72.9, d));
            }
        });
    });

    it('ON `spearHitRect` is `spearGameRect`: the origin truncated, the four cases of `spear()`', () => {
        withContactFidelity({ spearGameTest: true }, () => {
            for (const d of [RIGHT, UP, LEFT, DOWN]) expect(spearHitRect(125.13, 72.9, d)).toEqual(spearGameRect(125.13, 72.9, d));
        });
        // dir 0: spearX = int(x), spearY = int(y + 1); rect (sx, sy - 2.5 + 1, 32, 5)
        expect(spearGameRect(125.13, 72.9, RIGHT)).toMatchObject({ x: 125, y: 71.5, w: 32, h: 5, right: 157, bottom: 76.5 });
        // dir 1: spearX = int(x + 1), spearY = int(y + 2); rect (sx - 2.5 + 1, sy - 32, 5, 32)
        expect(spearGameRect(125.13, 72.9, UP)).toMatchObject({ x: 124.5, y: 42, w: 5, h: 32 });
        // dir 2: spearX = int(x), spearY = int(y + 1 + 1); rect (sx - 32, sy - 2.5, 32, 5)
        expect(spearGameRect(125.13, 72.9, LEFT)).toMatchObject({ x: 93, y: 71.5, w: 32, h: 5 });
        // dir 3: spearX = int(x - 1), spearY = int(y + 2); rect (sx - 2.5, sy, 5, 32)
        expect(spearGameRect(125.13, 72.9, DOWN)).toMatchObject({ x: 121.5, y: 74, w: 5, h: 32 });
        // an integer stance: the game's rect is `spearRect`'s, plus the inclusive flag
        for (const d of [RIGHT, UP, LEFT, DOWN]) {
            const { inclusive, ...r } = spearGameRect(120, 72, d);
            expect(inclusive).toBe(true);
            expect(r).toEqual(spearRect(120, 72, d));
        }
    });

    it('DRILL\'s measured case: the player at x 125.13 facing east, a box ending at x 125 — the game\'s rule hits, the strict float rect misses', () => {
        const b = box(109, 70, 16, 4); // right edge 125
        expect(pressRectTouches(spearGameRect(125.13, 72.02, RIGHT), b)).toBe(true);
        expect(pressRectTouches(spearRect(125.13, 72.02, RIGHT), b)).toBe(false);
    });

    it('and the other way: a box the float rect reaches past the truncated origin and the game\'s does not', () => {
        // facing east from y 72.9: the game's rect bottom is int(73.9) - 1.5 + 5 = 76.5; the float rect's 77.4
        const b = box(130, 77, 8, 8);
        expect(pressRectTouches(spearRect(125.13, 72.9, RIGHT), b)).toBe(true);
        expect(pressRectTouches(spearGameRect(125.13, 72.9, RIGHT), b)).toBe(false);
    });

    it('`pressRectTouches` is inclusive only for a rect that says so; every other press rect stays strict', () => {
        const touching = box(157, 70, 8, 8); // left edge on the rect's right edge (157)
        expect(pressRectTouches(spearGameRect(125, 72, RIGHT), touching)).toBe(true);
        expect(pressRectTouches(spearRect(125, 72, RIGHT), touching)).toBe(false);
    });

    it('the repeats: T+3 and T+5 are offsets 2 and 4 from the first test (`SPEAR_HIT_TICKS`)', () => {
        expect(SPEAR_HIT_TICKS.ticks).toEqual([1, 3, 5]);
        expect(SPEAR_REPEAT_OFFSETS).toEqual([2, 4]);
    });
});

/**
 * D1 — the game witnesses (`fixtures/spearrect-witness/`, recorded on p4g headless by
 * `scripts/procgen/probe-seedling-spearrect.mjs --record`), replayed against the model in node: ON it reproduces each
 * recording at 0 px (the player on every observation, every sampled row of the witnessed class); OFF it does not, at the
 * named tick.
 */
describe('fidelity SPEARRECT D1 — the game witnesses', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { SPEARRECT_WITNESS_DIR, SPEARRECT_WITNESSES, compareSpearRectWitness, spearRectModel } = await import('./fidelitySpearRect.js');
    const load = (w) => JSON.parse(readFileSync(join(SPEARRECT_WITNESS_DIR, `${w.name}.json`), 'utf8'));
    /**
     * OFF's first disagreement with the game, per witness: the tick, the class, the game's facts and the old model's
     * (a jellyfish's `hits/hitsTimer`, its position dropped here; the ON rows compare the positions too).
     */
    const OFF_FIRST = {
        'spearrect-l98-jelly-repeat': { t: 39, cls: 'Jellyfish', game: ['0/0', '0/0', '3/30'], model: ['0/0', '0/0', '1/19'] },
        'spearrect-l63-jelly-reach': { t: 9, cls: 'Jellyfish', game: ['0/0', '2/28'], model: ['0/0', '0/0'] },
        'spearrect-l40-turret-corner': { t: 8, cls: 'IceTurret', game: ['2/30'], model: ['0/0'] },
        'spearrect-l63-block-far-edge': { t: 15, cls: 'PushableBlockSpear', game: ['112.5,96'], model: ['112,96'] },
        'spearrect-l63-block-truncated-y': { t: 16, cls: 'PushableBlockSpear', game: ['112,96'], model: ['113,96'] },
    };
    it('every witness is recorded on p4g, the default build', () => {
        expect(SPEARRECT_WITNESSES.map((w) => w.name)).toEqual(Object.keys(OFF_FIRST));
        for (const w of SPEARRECT_WITNESSES) expect(load(w).game.build).toBe('seedling_bot_ap_p4g');
    });
    for (const w of SPEARRECT_WITNESSES) {
        it(`${w.name}: ON, the model reproduces the game at 0 px (the player, every ${w.classes.join('/')} row)`, async () => {
            const rec = load(w);
            const m = await spearRectModel(rec.tape, { killLock: w.killLock });
            expect(m.error).toBe(null);
            const c = compareSpearRectWitness(rec.game, m, w.classes);
            expect(c.player).toEqual([]);
            expect(c.bodies).toEqual([]);
            expect(c.compared).toBeGreaterThan(20);
        });
        it(`${w.name}: OFF, the model parts from the game at t${OFF_FIRST[w.name].t} (the witness for the key)`, async () => {
            const rec = load(w);
            const m = await spearRectModel(rec.tape, { over: { spearGameTest: false }, killLock: w.killLock });
            const c = compareSpearRectWitness(rec.game, m, w.classes);
            const facts = (xs) => xs.map((f) => f.split('@')[0]);
            const first = c.bodies[0];
            expect({ ...first, game: facts(first.game), model: facts(first.model) }).toEqual(OFF_FIRST[w.name]);
        });
    }
});
