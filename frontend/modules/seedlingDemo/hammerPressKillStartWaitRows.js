/**
 * seedlingDemo/hammerPressKillStartWaitRows — the witness of hammer-phase STEP149's rows
 * (`hammerPressKillStartWait.train.test.js`). Test support only: nothing in the app imports it.
 *   - `solveCapturedP1_32_10()`: the page worker's own request (re-measure-8's probe P1 32:10, L40 Totem 64,144,
 *     `fixtures/press-kill-start-wait/`) solved with `solveAnytime` over the committed atlas and the capture's own L40
 *     record; for a plan, its keys replayed on a FRESH run after the request's own prefix (`{hits, deaths}`).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/**
 * A plan's keys replayed on a fresh run of `staging` after the request's prefix (its equips re-made at their ticks,
 * the plan's own at theirs, past the prefix): the hits and deaths the plan's own ticks bill.
 */
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
        deaths: run.playerDeaths.length - d0, end: { level: run.level, x: run.state.x, y: run.state.y } };
}

/**
 * The captured P1 32:10 request, solved as the worker does: `{ok, work, answer, passes, message}` and, for a plan, the
 * fresh replay. `answer` is the replay script's hash (`replay-seedling-solve-request.mjs`: the message, or the keys).
 */
export function solveCapturedP1_32_10() {
    const url = new URL('./fixtures/press-kill-start-wait/P1-32-10.request.json', import.meta.url);
    const fx = JSON.parse(readFileSync(url, 'utf8'));
    const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
    const base = atlasLevelSource();
    const own = new Map(fx.levels.map(([level, record]) => [level, restoreRequest(record)]));
    const levelSource = (level) => own.get(level) ?? base(level);
    const answer = solveAnytime({ ...tape, levelSource }, { passes });
    const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
    const head = { ok: answer.ok, work: answer.work, answer: sha(text),
        passes: (answer.passes ?? []).map(({ ms, ...p }) => p) };
    if (!answer.ok) return { ...head, message: text };
    return { ...head, ticks: answer.plan.solution.length, ...freshReplay(tape, levelSource, answer.plan) };
}
