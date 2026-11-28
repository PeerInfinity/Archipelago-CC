/**
 * ⛓⛓ SEEDLING HAMMER-PHASE L40 CHEST CORNER (train tier) — `PRESS_KILL_HOLD` (OFF) on the whole-game walk's entry-19 stop.
 *
 * Re-measure-10 S2 and re-measure-11 S4 stopped at entry 19 (L40 Chest, `apitem (880,816) contact -> kill
 * (spinner@880,848) by press`, "There is no step out"). The stand-in request is re-measure-9 P1 19:2, which is
 * byte-identical to the committed `hammer-kill880/P1-19-1` fixture except its budget (the page's held retry, 2560) and
 * its passes (the retry sends the full pass alone). This file sends the fixture in that retry's shape, so the request
 * is 19:2's byte for byte, and solves it as the page's worker does (`solveAnytime`) under the
 * base defaults (LATCHED_HOLD_MOVE ON) and under SIX (`PRESS_KILL_START_WAIT`, `PRESS_KILL_REFUGE_BOMBS`,
 * `DASH_STAND_SIGHT`, `OPP_AIM_CHASERS`, `HIT_AVOID_STAND_BOMBS`, `REFUSAL_STAND_BOMBS`):
 *   - PKH OFF: refused HAMMER_SAFETY in both configs (SIX's switches do not answer it), and the hold is never asked.
 *   - SIX + PKH: solved; the kept redo held whole hammer periods at the kill's last stand, inside the budget, and the
 *     plan's keys on a FRESH run of the staging take no hit and no death.
 *   - The same arrival one sampled phase later (seam + 5 ticks, a phase that solves today): byte-identical with PKH
 *     on and off, and the hold is never asked (a success never reaches it).
 * The fast rows are `pressKillHold.test.js`; the dashless-only KILL880 witness is `hammerKill880StandHold.train.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    HAMMER_PHASE_RUNG, PRESS_KILL_HOLD_COUNTS, withDashStandSight, withOppAimChasers, withPressKillHold,
    withPressKillRefugeBombs, withPressKillStartWait,
} from './solverBot.js';
import { ANYTIME_PASSES, replayTape, solveAnytime, withHitAvoidStandBombs, withRefusalStandBombs } from './jsRuntimeSolver.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-kill880', 'P1-19-1-request.json.gz'))).toString('utf8');
/** The page's held-retry budget: the stop request's own (re-measure-9 P1 19:2). */
const RETRY_BUDGET = 2560;
/** The held retry's passes: the request's own widest pass alone (19:2 sends `[full]`). */
const retryPasses = (passes) => passes.filter((p) => p.pass === 'full');

function withSix(fn) {
    const inner = () => withOppAimChasers(true, () => withHitAvoidStandBombs(true, () => withRefusalStandBombs(true, fn)));
    return withPressKillStartWait(true, () => withPressKillRefugeBombs(true, () => withDashStandSight(true, inner)));
}

function solve({ pkh, six, seamShift = 0 }) {
    const captured = JSON.parse(RAW).request;
    captured.staging.seam.time += seamShift;
    captured.budgetWork = RETRY_BUDGET;
    captured.passes = retryPasses(captured.passes ?? ANYTIME_PASSES);
    const { passes, source, ...tape } = restoreRequest(captured);
    const levelSource = levelSourceFromAtlas(source.records);
    PRESS_KILL_HOLD_COUNTS.rows.length = 0;
    const run = () => solveAnytime({ ...tape, source, levelSource }, { passes });
    const answer = withPressKillHold(pkh, () => (six ? withSix(run) : run()));
    const rows = PRESS_KILL_HOLD_COUNTS.rows.map((r) => ({ ...r }));
    let hits = null;
    let deaths = null;
    if (answer.ok) {
        const fresh = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
            scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        const h0 = fresh.playerHits.length;
        const d0 = fresh.playerDeaths.length;
        answer.plan.solution.forEach((held, k) => {
            const slot = answer.plan.equipsAt?.get?.(k);
            if (slot !== undefined) fresh.equipNow(slot);
            fresh.advance(held);
        });
        hits = fresh.playerHits.slice(h0).map((h) => `t${h.t} ${h.source}:${h.id}`);
        deaths = fresh.playerDeaths.length - d0;
    }
    const keys = answer.ok ? createHash('sha1').update(JSON.stringify(answer.plan.solution.map((k) => [...k]))).digest('hex')
        : null;
    return { answer, rows, hits, deaths, keys };
}

describe('hammer-phase L40 CHEST CORNER: the entry-19 stop request at the page\'s retry budget (train)', () => {
    it('PKH OFF, under the base defaults and under SIX: refused HAMMER_SAFETY ("There is no step out"); no hold is asked',
        () => {
            for (const six of [false, true]) {
                const { answer, rows } = solve({ pkh: false, six });
                expect(answer.ok, `six=${six}`).toBe(false);
                expect(answer.kind).toBe('refusal');
                expect(answer.message).toContain('kill (spinner@880,848) by press');
                expect(answer.message).toContain('There is no step out');
                expect(answer.message).toContain('(HAMMER_PHASE_RUNG)');
                expect(rows).toEqual([]);
            }
        }, 600_000);

    it('SIX + PKH: solved inside the budget; the kept redo held whole hammer periods at the last stand; a fresh run '
        + 'takes no hit and no death', () => {
        const { answer, rows, hits, deaths } = solve({ pkh: true, six: true });
        expect(answer.ok).toBe(true);
        expect(answer.passes.map((p) => [p.pass, p.ok])).toEqual([['full', true]]);
        expect(answer.work).toBeLessThanOrEqual(RETRY_BUDGET);
        const kept = rows.find((r) => r.verdict === 'solved');
        expect(kept).toBeDefined();
        expect(kept.stand).toBeLessThan(kept.refusedAt);
        const wait = kept.tries.at(-1).wait;
        expect(wait % HAMMER_PHASE_RUNG.horizon).toBe(0);
        expect(answer.plan.solution.slice(kept.stand, kept.stand + wait).every((k) => k.size === 0)).toBe(true);
        expect(hits).toEqual([]);
        expect(deaths).toBe(0);
    }, 600_000);

    it('one sampled phase later (seam + 5): the same plan with PKH on and off, and the hold is never asked', () => {
        const off = solve({ pkh: false, six: true, seamShift: 5 });
        const on = solve({ pkh: true, six: true, seamShift: 5 });
        expect(off.answer.ok).toBe(true);
        expect(off.hits).toEqual([]);
        expect(on.answer.ok).toBe(true);
        expect(on.keys).toBe(off.keys);
        expect(on.answer.work).toBe(off.answer.work);
        expect(on.rows).toEqual([]);
    }, 600_000);
});
