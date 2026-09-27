/**
 * seedlingDemo — **THE SHORTCUT, ON SEEDLING, GRADED SHORTENS** (seedling
 * substrate S1, D2; plan §2.1 G-b).
 *
 * Arc 5 slice 5 reached the differential's fifth grade on the MAZE and REFUTED
 * it on Seedling by three walls (kickoff §13.6). The first — *the solver
 * derives no break* — moved at R9 L15, and the `shortcut` head is registered
 * as a ROCK on a cycle's short arc (`soloDoor.ROCK_SHORTCUT`), so the other two
 * walls (an optional KILL exhausts the ladder or throws A10 at the ceremony)
 * have no body to fire on.
 *
 * ⛓ THE WITNESS IS A GENERATED LEVEL, measured at S1's W2 (scratch
 * `shortens.mjs`, the as-built's REPRODUCE block): `loopy` 10x10, post-sword,
 * `--elements=shortcut`, bounds 3/4/3 — seed 3 grades **SHORTENS** with the
 * sword 110 ticks and without it SOLVED the long way in 181. ⛔ MUTANT (b) —
 * the head registered with `shortcut.js`'s KILL lock instead — reddens the
 * SHORTENS row: the certification solve walks round the spinner and the
 * dialogued goal throws A10 (arc-5 §13.6 probe 3), so nothing is certified.
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel } from './procgenSeedling.js';
import { POST_SWORD_PALETTE, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import { DEFAULT_BUDGET } from './procgenOracle.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const WITNESS = Object.freeze({ seed: 3, kind: 'loopy', width: 10, height: 10 });
const BOUNDS = Object.freeze({ obstacleTarget: 3, triesPerStep: 4, saturationK: 3 });

const gen = (palette) => generateSeedlingLevel({
    seed: WITNESS.seed, palette, bounds: BOUNDS,
    defaults: { width: WITNESS.width, height: WITNESS.height },
    skeleton: parseSkeleton(WITNESS.kind, { substrate: 'seedling' }),
    elements: parseElementSpec('shortcut'),
});

describe('⛓⛓⛓ the ROCK SHORTCUT on a generated Seedling level', () => {
    it('places, certifies, and the sword grades SHORTENS on the final level', () => {
        const out = gen(POST_SWORD_PALETTE);
        expect(out.model.elements.ran).toBe(true);
        const placed = out.model.elements.placed[0];
        expect(placed.family).toBe('shortcut');
        expect(placed.cost.stepsWalled).toBeGreaterThan(placed.cost.stepsOpen);
        expect(out.certification.certified).toBe(true);
        /** ⛔ NOT `toContain('break')`: the SKELETON's certification solve is free
         *  to walk the long way (measured: `['collect']` here), which is exactly
         *  what a shortcut permits. The saving is the FINAL with-arm's, below. */
        const rep = requirementsFor({
            record: out.record, model: out.model, palette: POST_SWORD_PALETTE,
            summary: out.summary, seed: WITNESS.seed, biome: 'post-sword',
        }, { verdict: 'SOLVED', ticks: out.summary.finalTicks }, { budget: DEFAULT_BUDGET });
        const row = rep.rows.find((r) => r.flag === 'hasSword');
        expect(row.withoutVerdict).toBe('SOLVED');
        expect(row.withoutTicks).toBeGreaterThan(out.summary.finalTicks);
        expect(gradeOf(row)).toBe('SHORTENS');
    }, 120000);

    it('⛔ pre-sword it is refused BY NAME, for free — the seam\'s item gate', () => {
        const out = gen(PRE_SWORD_PALETTE);
        expect(out.certification.gap).toBe('the-element-needs-an-item-this-biome-does-not-grant');
        expect(out.certification.verdict).toBe(null);
        expect(out.model.elements.ran).toBe(false);
    }, 60000);
});
