/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BAIT-REMOVED — the default-tier rows of `BAIT_TARGET_GONE` (OFF): the switch's plumbing,
 * and a LIVE-body bait unchanged ON (the generated bait gate, `[bait, collect]`). The witnesses (L99 east Sword only
 * solved ON; L40 c3 past the bait) are `hammerBaitRemoved.train.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { BAIT_TARGET_GONE, BAIT_TARGET_GONE_COUNTS, BAIT_TARGET_GONE_DEFAULT, withBaitTargetGone } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { generateSeedlingLevel, seedlingOracle } from './procgenSeedling.js';
import { PRE_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

describe('hammer-phase BAIT-REMOVED — `BAIT_TARGET_GONE`', () => {
    it('is OFF by default, named in the worker env channel, and `withBaitTargetGone` restores it', () => {
        expect(BAIT_TARGET_GONE_DEFAULT).toBe(false);
        expect(BAIT_TARGET_GONE.enabled).toBe(globalThis.process?.env?.SEEDLING_BAIT_TARGET_GONE === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_BAIT_TARGET_GONE');
        const before = BAIT_TARGET_GONE.enabled;
        withBaitTargetGone(!before, () => expect(BAIT_TARGET_GONE.enabled).toBe(!before));
        expect(BAIT_TARGET_GONE.enabled).toBe(before);
    });

    it('a live-body bait (the generated bait gate, seed 1) solves the same plan ON as OFF, and nothing is counted gone', () => {
        const out = generateSeedlingLevel({
            seed: 1, palette: PRE_SWORD_PALETTE, defaults: { width: 10, height: 10 },
            skeleton: parseSkeleton('empty', { substrate: 'seedling' }), elements: parseElementSpec('baitgate'),
        });
        const solve = () => seedlingOracle({ model: out.model, items: PRE_SWORD_PALETTE.items }).solve(out.record);
        const off = withBaitTargetGone(false, solve);
        BAIT_TARGET_GONE_COUNTS.gone.length = 0;
        const on = withBaitTargetGone(true, solve);
        expect(off.verdict).toBe(VERDICT.SOLVED);
        expect(on.verdict).toBe(VERDICT.SOLVED);
        expect(on.ticks).toBe(off.ticks);
        expect(JSON.stringify(on.tape)).toBe(JSON.stringify(off.tape));
        expect(on.records).toEqual(off.records);
        /** the bait is the live-body DWELL (139 ticks, the body removed by the room inside its bound), not `bait-gone` */
        expect(on.records.find((r) => r.strategy === 'bait')).toMatchObject({ kind: 'dwell', ticks: 139, target: 'bob@16,80' });
        expect(BAIT_TARGET_GONE_COUNTS.gone).toEqual([]);
    }, 240000);
});
