/**
 * seedlingDemo/hammerPkswHitsRows — the witness of hammer-phase PKSW-HITS's rows (`hammerPkswHits.train.test.js`).
 * Test support only: nothing in the app imports it.
 *   - `solveCapturedTotem64(seamTime)`: the page worker's own request (re-measure-8's probe P1 32:10, L40 Totem 64,144,
 *     `fixtures/press-kill-start-wait/P1-32-10.request.json`, STEP149's fixture) with its arrival clock set to
 *     `seamTime` (`staging.seam.time`; `null` keeps the capture's own). Re-measure-8's A1 32:10 differs from P1 32:10 in
 *     that one field and no other (A1 79143, P1 82082), so A1 is this fixture at 79143. Solved with `solveAnytime` over
 *     the committed atlas and the capture's own L40 record; for a plan, its keys replayed on a FRESH run after the
 *     request's own prefix (`{hits, deaths}`).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

/** Re-measure-8's two captured arrival clocks for 32:10 (the only field the two requests differ in). */
export const TOTEM64_SEAM = Object.freeze({ A1: 79143, P1: 82082 });

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

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
 * The captured 32:10 request at arrival clock `seamTime`, solved as the worker does: `{ok, work, answer, passes,
 * message}` and, for a plan, `ticks` and the fresh replay. `answer` is the replay script's hash (the message, or the keys).
 */
export function solveCapturedTotem64(seamTime = null) {
    const url = new URL('./fixtures/press-kill-start-wait/P1-32-10.request.json', import.meta.url);
    const fx = JSON.parse(readFileSync(url, 'utf8'));
    const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
    if (seamTime !== null) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: seamTime } };
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
