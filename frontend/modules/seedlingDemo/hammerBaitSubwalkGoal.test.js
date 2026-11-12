/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BAIT-SUBWALK-GOAL — the default-tier rows of `SUBWALK_ANCESTOR_CROSSING` (OFF): the
 * switch's plumbing, and a walk with no level change unchanged ON (the generated bait gate, `[bait, collect]`: a
 * stance walk inside a goal walk, no crossing). The witness (ER c3, L40 → the pit → L43, solved ON) is
 * `hammerBaitSubwalkGoal.train.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { SUBWALK_ANCESTOR_CROSSING, SUBWALK_ANCESTOR_CROSSING_COUNTS, SUBWALK_ANCESTOR_CROSSING_DEFAULT,
    withSubwalkAncestorCrossing } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { generateSeedlingLevel, seedlingOracle } from './procgenSeedling.js';
import { PRE_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

describe('hammer-phase BAIT-SUBWALK-GOAL — `SUBWALK_ANCESTOR_CROSSING`', () => {
    it('is OFF by default, named in the worker env channel, and `withSubwalkAncestorCrossing` restores it', () => {
        expect(SUBWALK_ANCESTOR_CROSSING_DEFAULT).toBe(false);
        expect(SUBWALK_ANCESTOR_CROSSING.enabled)
            .toBe(globalThis.process?.env?.SEEDLING_SUBWALK_ANCESTOR_CROSSING === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SUBWALK_ANCESTOR_CROSSING');
        const before = SUBWALK_ANCESTOR_CROSSING.enabled;
        withSubwalkAncestorCrossing(!before, () => expect(SUBWALK_ANCESTOR_CROSSING.enabled).toBe(!before));
        expect(SUBWALK_ANCESTOR_CROSSING.enabled).toBe(before);
    });

    it('a bait stance walk that never changes level (the generated bait gate, seed 1) solves the same plan ON as OFF', () => {
        const out = generateSeedlingLevel({
            seed: 1, palette: PRE_SWORD_PALETTE, defaults: { width: 10, height: 10 },
            skeleton: parseSkeleton('empty', { substrate: 'seedling' }), elements: parseElementSpec('baitgate'),
        });
        const solve = () => seedlingOracle({ model: out.model, items: PRE_SWORD_PALETTE.items }).solve(out.record);
        const off = withSubwalkAncestorCrossing(false, solve);
        SUBWALK_ANCESTOR_CROSSING_COUNTS.handed.length = 0;
        SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched.length = 0;
        const on = withSubwalkAncestorCrossing(true, solve);
        expect(off.verdict).toBe(VERDICT.SOLVED);
        expect(on.verdict).toBe(VERDICT.SOLVED);
        expect(on.ticks).toBe(off.ticks);
        expect(JSON.stringify(on.tape)).toBe(JSON.stringify(off.tape));
        expect(on.records).toEqual(off.records);
        expect(on.records.some((r) => r.strategy === 'bait')).toBe(true);
        expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.handed).toEqual([]);
        expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched).toEqual([]);
    }, 240000);
});
