/**
 * seedlingDemo/hammerHitPlanRetryRows — the witness of hammer-phase L39-ARRIVAL-HIT's rows (`hammerHitPlanRetry.train.test.js`).
 * Test support only: nothing in the app imports it.
 *   - `solveCapturedL39(seamTime)`: re-measure-11's S1 18:11 (L39 "Totem Part 72,40", `wasm-location-39`), the page
 *     worker's own request (`fixtures/hit-plan-retry/S1-18-11.request.json.gz`, whole: its source is the seed's placed
 *     atlas) with its arrival clock set to `seamTime` (`staging.seam.time`; `null` keeps the capture's own, 29994).
 *     Re-measure-11's L1 18:10 differs from it in that one field and no other (30052).
 *   - The request goes through the PAGE's expiry branch as `seedlingWasmPlayback.pollSolve` takes it (`pageLadder`): the
 *     attempt at the request's budget; a budget-cut answer asks `wasmPlayback.expiryAction`; a 'retry' resumes the
 *     passes the cut left unanswered (`passesAfter`, the service's `answered` rule, `answeredOf`) at
 *     `SOLVE_RETRY_BUDGET_FACTOR`×; the retry's answer against the cut plan by `betterAnswer`.
 *     For a shipped plan, its keys replayed on a FRESH run (`{hits, deaths, end}`).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

import { ANYTIME_PASSES, betterAnswer, budgetCut, passesAfter, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { expiryAction, SOLVE_RETRY_BUDGET_FACTOR } from './wasmPlayback.js';
import { hitPlanHeldOpen } from './hitPlanRetry.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

/** Re-measure-11's two arrival clocks for L39 (S1 18:11 and L1 18:10; the only field the two requests differ in). */
export const L39_SEAM = Object.freeze({ S1: 29994, L1: 30052 });

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/**
 * The service's `answered` (`jsRuntimeSolveService`): the leading request passes that gave a final word — a refusal cut
 * by its deadline did not, nor (`HIT_PLAN_RETRY` ON, `hitPlanHeldOpen`) a plan that bills a hit.
 */
export function answeredOf(res, passes) {
    let n = 0;
    for (const r of (res.passes ?? []).slice(0, passes.length)) {
        if (!r.ok && r.deadline) break;
        if (hitPlanHeldOpen({ ok: r.ok, plan: { modelHits: r.modelHits } })) break;
        n += 1;
    }
    return n;
}

/**
 * The page's expiry branch over `solve(budgetWork, passes)`: `{outcome, res, attempts, retries}`. `outcome` is
 * 'answered' (no cut), 'provisional' (a cut plan played), 'retried' (a held retry asked), or 'give-up' (the goal fails).
 */
export function pageLadder(solve, { budgetWork, passes }) {
    let ps = passes;
    let budget = budgetWork;
    let retries = 0;
    let best = null;
    let res = solve(budget, ps);
    const attempts = [{ budget, passes: res.passes.map(({ ms, ...p }) => p) }];
    let outcome = 'answered';
    while (budgetCut(res)) {
        const action = expiryAction({ provisional: res, retries, unanswered: answeredOf(res, ps) < ps.length });
        if (action === 'give-up') return { outcome: 'give-up', res, attempts, retries };
        if (action === 'provisional') { outcome = outcome === 'retried' ? 'retried' : 'provisional'; break; }
        retries += 1;
        if (betterAnswer(best, res)) best = res;
        ps = passesAfter(ps, answeredOf(res, ps));
        budget *= SOLVE_RETRY_BUDGET_FACTOR;
        if (ps.length === 0) break;
        res = solve(budget, ps);
        attempts.push({ budget, passes: res.passes.map(({ ms, ...p }) => p) });
        outcome = 'retried';
    }
    if (best && !betterAnswer(best, res)) res = best;
    return { outcome, res, attempts, retries };
}

function freshReplay(tape, levelSource, plan) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        equips: tape.equips ?? null, scratchPersistence: tape.scratchPersistence === true });
    const h0 = run.playerHits.length;
    const d0 = run.playerDeaths.length;
    for (const [i, held] of plan.solution.entries()) {
        const slot = plan.equipsAt?.get(i);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(held);
    }
    return { hits: run.playerHits.slice(h0).map((h) => `t${h.t} ${h.source}:${h.id}`),
        deaths: run.playerDeaths.length - d0, end: { level: run.level } };
}

let cached = null;
const fixture = () => {
    cached ??= JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/hit-plan-retry/S1-18-11.request.json.gz', import.meta.url))).toString());
    return cached;
};

/**
 * The captured L39 request at arrival clock `seamTime`, through the page's expiry branch: `{outcome, retries, attempts,
 * ok, pass, answer}` and, for a plan, `ticks` and the fresh replay. `answer` is the replay script's hash (the keys).
 */
export function solveCapturedL39(seamTime = null) {
    const fx = fixture();
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(fx.request);
    if (seamTime !== null) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: seamTime } };
    const levelSource = levelSourceFromAtlas(source.records);
    const solve = (budgetWork, ps) => solveAnytime({ ...tape, source, levelSource, budgetWork }, { passes: ps });
    const { outcome, res, attempts, retries } = pageLadder(solve, { budgetWork: tape.budgetWork, passes });
    const head = { outcome, retries, attempts, ok: res.ok, pass: res.pass ?? null };
    if (!res.ok) return { ...head, message: String(res.message ?? '') };
    return { ...head, ticks: res.plan.solution.length, answer: sha(JSON.stringify(res.plan.solution.map((k) => [...k]))),
        modelHits: res.plan.modelHits ?? null, ...freshReplay(tape, levelSource, res.plan) };
}
