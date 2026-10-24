/**
 * hammerEscapeGenerated (SLOW tier) — hammer-phase A2's regression row for the escape on a GENERATED level: one
 * whole `generateSeedlingLevel` (every certify solve of the attempt loop), ~1 min alone and several under load, so it
 * runs in `npm run test:unit:slow`, not the default tier.
 *
 * Mutant (run at A2): `previewOrDeath` returning the raw step (the throw escapes) -> this row red (GenerationAborted,
 * "the player DROWNED in level 900").
 */
import { describe, expect, it } from 'vitest';

import { paletteFor } from './watchGenerate.js';
import { generateSeedlingLevel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { withHammerEscape } from './solverBot.js';
/**
 * ⛓ HAMMER-PHASE A2 — A PREVIEWED DEATH IS A STEP NOT TAKEN (`solverBot.previewOrDeath`). With the escape ON, the
 * certify solve of `empty post-sword seed 30` (the c3/c6 pair dumps' row) previewed a key set that drowned in the
 * pass-1 `water-pool`; the preview stepper THROWS a death refusal, and `stepToward`'s lookahead and
 * `landsClearOfHammers` (under the HAMMER-PHASE rung's `previewPressApproach`) let it escape the solve, so the level
 * ABORTED. Off, the same seed is a certified level; on, it must be one too.
 */
describe('hammer-phase A2 — a previewed death is a step not taken', () => {
    it('⛓⛓ empty post-sword seed 30 generates a certified level with the escape ON (it aborted on a preview\'s drown)', () => {
        const gen = () => generateSeedlingLevel({ seed: 30, palette: paletteFor('post-sword'),
            bounds: { obstacleTarget: 3 }, skeleton: seedlingSkeletonSpec('empty') });
        const on = withHammerEscape(true, gen);
        expect(on.summary.stop).toBe('TARGET_REACHED');
        expect(on.summary.finalTicks).toBeGreaterThan(0);
    }, 300_000);
});
