/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE HIT-TIEBREAK — the ANYTIME ranking reads the model's own hit verdict
 * (`jsRuntimeSolver.HIT_AWARE_ANSWER`, OFF). ⚖ The user, 2026-11-17: *"Slice it now (Recommended)"*.
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-hit-tiebreak.md`): `betterAnswer` kept the full pass's plan on
 * length alone. Two page-captured legs (`fixtures/hammer-hit-tiebreak/`, p4g, base 94d5e1be) are the witnesses:
 *   308 `level_30__r2c10 <- in_L31_160_384 -> location:L30 flag 0: bosslock@64,32 cleared` — defaults: dashless 255 t,
 *       0 model hits; full 191 t, `bobsoldier@48,80` at t151 / t171 / t191 and a death. The full pass shipped.
 *   160 `level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 4: bosslock@416,240 cleared` — under FADE_MOVE:
 *       dashless 680 t, 0 hits; full 632 t, `puncher@416,256` twice. The full pass shipped. Defaults: both passes punched.
 * ON, each plan carries `modelHits` (the run it ended on: its `playerHits` rows and deaths past the prefix), and a plan
 * the model predicts hitless beats one it predicts takes a hit, whatever their lengths.
 *
 * Red under a mutant:
 *   betterAnswer ignores the verdict                     -> 'synthetic: hitless beats hit' and both witness ON rows red
 *   the verdict wins even when the switch is OFF         -> 'OFF: …' rows red
 *   same-verdict plans ranked by anything but length     -> 'synthetic: same verdict' red
 *   the stamp read off the shadow, not the run the plan ended on -> the witness rows' stamp = model rows red
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    ANYTIME_PASSES, betterAnswer, HIT_AWARE_ANSWER, HIT_AWARE_ANSWER_DEFAULT, hitVerdictOrder, planTakesHit, replayTape,
    solveAnytime, withHitAwareAnswer,
} from './jsRuntimeSolver.js';
import { withFadeMove } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-hit-tiebreak', name)))
    .toString('utf8'));

const plan = (ticks, hits, { pass = 'p', deaths = 0 } = {}) => ({ ok: true, pass,
    plan: { pass, solution: new Array(ticks).fill([]), ...(hits === null ? {} : { modelHits: { hits, deaths } }) } });
const refusal = (pass = 'p') => ({ ok: false, kind: 'refusal', pass, message: `refused in ${pass}` });
const skipped = { ok: false, kind: 'skipped', message: 'sword-dash is not available here' };

/** A captured leg solved as the worker does; per pass: ticks, the plan's stamp, and the model's hits re-driven. */
function solveLeg(leg, { on, fadeMove = false }) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const seen = [];
    const answer = withFadeMove(fadeMove, () => withHitAwareAnswer(on,
        () => solveAnytime({ ...tape, source, levelSource }, { passes, onPass: (a) => seen.push(a) })));
    expect(answer.ok).toBe(true);
    const rehit = (solution) => {
        const base = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
            scratchPersistence: tape.scratchPersistence });
        const run = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...solution], levelSource,
            scratchPersistence: tape.scratchPersistence });
        return { hits: run.ledger('playerHits').length - base.ledger('playerHits').length,
            deaths: run.playerDeaths.length - base.playerDeaths.length };
    };
    return {
        shipped: answer.plan.pass, ticks: answer.plan.solution.length,
        passes: seen.map((a) => ({ pass: a.pass, ticks: a.plan.solution.length, stamp: a.plan.modelHits ?? null,
            model: rehit(a.plan.solution) })),
        plan: JSON.stringify(answer.plan.solution.map((k) => [...k])),
    };
}

describe('HIT-TIEBREAK — the switch', () => {
    it('is OFF by default, named in the solver env channel, and withHitAwareAnswer restores it (also on a throw)', () => {
        expect(HIT_AWARE_ANSWER_DEFAULT).toBe(false);
        expect(HIT_AWARE_ANSWER.enabled).toBe(ENV.SEEDLING_HIT_AWARE_ANSWER === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_HIT_AWARE_ANSWER');
        const was = HIT_AWARE_ANSWER.enabled;
        expect(withHitAwareAnswer(true, () => HIT_AWARE_ANSWER.enabled)).toBe(true);
        expect(() => withHitAwareAnswer(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(HIT_AWARE_ANSWER.enabled).toBe(was);
    });
});

describe('HIT-TIEBREAK — betterAnswer on synthetic answers (hit / hitless × longer / shorter)', () => {
    it('synthetic: ON, a hitless plan beats a hit plan whatever their lengths, both orders', () => {
        withHitAwareAnswer(true, () => {
            expect(betterAnswer(plan(191, 3, { deaths: 1 }), plan(255, 0))).toBe(true); // 308's shape: longer hitless replaces
            expect(betterAnswer(plan(632, 2), plan(680, 0))).toBe(true); // 160's shape
            expect(betterAnswer(plan(300, 1), plan(200, 0))).toBe(true); // shorter hitless replaces too
            expect(betterAnswer(plan(255, 0), plan(191, 3, { deaths: 1 }))).toBe(false); // the dashless 308 is kept
            expect(betterAnswer(plan(680, 0), plan(632, 2))).toBe(false);
            expect(betterAnswer(plan(200, 0), plan(100, 0, { deaths: 1 }))).toBe(false); // a death alone is a hit verdict
        });
    });

    it('synthetic: same verdict (or a plan with no stamp) → today\'s rule: strictly fewer ticks, a tie keeps the first', () => {
        withHitAwareAnswer(true, () => {
            expect(betterAnswer(plan(180, 0), plan(160, 0))).toBe(true);
            expect(betterAnswer(plan(160, 0), plan(180, 0))).toBe(false);
            expect(betterAnswer(plan(527, 0), plan(527, 0))).toBe(false);
            expect(betterAnswer(plan(632, 2), plan(600, 5))).toBe(true); // both hit: length decides, not the count
            expect(betterAnswer(plan(600, 5), plan(632, 2))).toBe(false);
            expect(betterAnswer(plan(191, null), plan(255, 0))).toBe(false); // unknown verdict: length
            expect(betterAnswer(plan(255, 0), plan(191, null))).toBe(true);
        });
    });

    it('synthetic: refusals and skipped passes behave exactly as OFF', () => {
        const rows = () => [
            betterAnswer(null, plan(10, 1)), betterAnswer(refusal(), plan(10, 1)), betterAnswer(plan(100, 1), refusal()),
            betterAnswer(plan(100, 1), skipped), betterAnswer(refusal('dashless'), refusal('full')),
            betterAnswer(refusal(), skipped), betterAnswer(null, skipped),
        ];
        const off = withHitAwareAnswer(false, rows);
        expect(withHitAwareAnswer(true, rows)).toEqual(off);
        expect(off).toEqual([true, true, false, false, true, false, false]);
    });

    it('OFF: the verdict is never read (length alone, as before)', () => {
        withHitAwareAnswer(false, () => {
            expect(betterAnswer(plan(191, 3, { deaths: 1 }), plan(255, 0))).toBe(false);
            expect(betterAnswer(plan(255, 0), plan(191, 3, { deaths: 1 }))).toBe(true);
        });
    });

    it('planTakesHit / hitVerdictOrder read only the stamp', () => {
        expect(planTakesHit({})).toBe(null);
        expect(planTakesHit({ modelHits: { hits: 0, deaths: 0 } })).toBe(false);
        expect(planTakesHit({ modelHits: { hits: 0, deaths: 1 } })).toBe(true);
        expect(hitVerdictOrder({ modelHits: { hits: 2 } }, { modelHits: { hits: 0 } })).toBe(true);
        expect(hitVerdictOrder({ modelHits: { hits: 0 } }, { modelHits: { hits: 2 } })).toBe(false);
        expect(hitVerdictOrder({ modelHits: { hits: 1 } }, { modelHits: { hits: 2 } })).toBe(null);
        expect(hitVerdictOrder({}, { modelHits: { hits: 0 } })).toBe(null);
    });
});

describe('HIT-TIEBREAK — witness legs (page captures, p4g)', () => {
    const L30 = FIX('leg308-l31-l30-request.json.gz');
    const L12 = FIX('leg160-l95-l12-request.json.gz');

    it('308 OFF: the full pass ships 191 t (the model: 3 hits and a death); no plan carries a stamp', () => {
        const r = solveLeg(L30, { on: false });
        expect([r.shipped, r.ticks]).toEqual(['full', 191]);
        expect(r.passes.map((p) => [p.pass, p.ticks, p.stamp, p.model])).toEqual([
            ['dashless', 255, null, { hits: 0, deaths: 0 }], ['full', 191, null, { hits: 3, deaths: 1 }]]);
    });

    it('308 ON: the stamps equal the model re-driven, and the hitless dashless 255 t ships', () => {
        const r = solveLeg(L30, { on: true });
        for (const p of r.passes) expect(p.stamp).toEqual(p.model);
        expect([r.shipped, r.ticks]).toEqual(['dashless', 255]);
        expect(r.passes.find((p) => p.pass === 'dashless').model).toEqual({ hits: 0, deaths: 0 });
    });

    it('160 defaults: both passes punched — ON = OFF byte for byte (same verdict, the length rule)', () => {
        const off = solveLeg(L12, { on: false });
        const on = solveLeg(L12, { on: true });
        expect(on.passes.map((p) => p.stamp)).toEqual([{ hits: 2, deaths: 0 }, { hits: 2, deaths: 0 }]);
        expect([on.shipped, on.ticks, on.plan]).toEqual([off.shipped, off.ticks, off.plan]);
        expect([off.shipped, off.ticks]).toEqual(['full', 632]);
    });

    it('160 under FADE_MOVE: OFF ships the punched full 632 t; ON ships the hitless dashless 680 t', () => {
        const off = solveLeg(L12, { on: false, fadeMove: true });
        expect([off.shipped, off.ticks]).toEqual(['full', 632]);
        expect(off.passes.map((p) => [p.pass, p.ticks, p.model.hits])).toEqual([['dashless', 680, 0], ['full', 632, 2]]);
        const on = solveLeg(L12, { on: true, fadeMove: true });
        expect([on.shipped, on.ticks]).toEqual(['dashless', 680]);
        for (const p of on.passes) expect(p.stamp).toEqual(p.model);
    });
});
