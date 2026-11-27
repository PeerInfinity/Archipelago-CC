/**
 * seedlingDemo/hammerLatchedHoldMoveRows — the witness of hammer-phase LATCHED-HOLD's rows
 * (`hammerLatchedHoldMove.train.test.js`). Test support only: nothing in the app imports it.
 *   - `solveCapturedA1()`: the page worker's own request (re-measure-8's whole-game walk A1 32:12,
 *     `fixtures/latched-hold-move/`) solved with `solveAnytime` over the committed atlas and the capture's own L40 record;
 *     for a plan, its keys replayed on a FRESH run (`{hits, deaths, crossed}`).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/** A plan's keys replayed on a fresh run of `staging`, its equips re-made at their ticks: `{hits, deaths, crossed}`. */
function freshReplay(tape, levelSource, plan) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick ?? [], levelSource,
        scratchPersistence: tape.scratchPersistence ?? false, equips: tape.equips ?? null });
    let crossed = null;
    for (const [i, held] of plan.solution.entries()) {
        const slot = plan.equipsAt?.get(i);
        if (slot !== undefined) run.equipNow(slot);
        const out = run.advance(held);
        if (out?.transition && crossed === null) crossed = { t: run.ticksCompleted, to: out.transition.to_level };
    }
    return { hits: run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`), deaths: run.playerDeaths.length, crossed,
        end: { level: run.level, x: run.state.x, y: run.state.y } };
}

/**
 * The captured A1 32:12 request, solved as the worker does: `{ok, work, answer, passes, message}` and, for a plan, the
 * fresh replay. `answer` is the replay script's hash (the message, or the keys).
 */
export function solveCapturedA1() {
    const url = new URL('./fixtures/latched-hold-move/A1-32-12.request.json', import.meta.url);
    const fx = JSON.parse(readFileSync(url, 'utf8'));
    const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
    if ((tape.perTick ?? []).length !== 0) throw new Error('the A1 32:12 capture has no prefix; its plan\'s equips index from 0');
    const base = atlasLevelSource();
    const own = new Map(fx.levels.map(([level, record]) => [level, restoreRequest(record)]));
    const levelSource = (level) => own.get(level) ?? base(level);
    const answer = solveAnytime({ ...tape, levelSource }, { passes });
    const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
    const head = { ok: answer.ok, work: answer.work, answer: sha(text),
        passes: (answer.passes ?? []).map(({ ms, ...p }) => p) };
    if (!answer.ok) return { ...head, message: text };
    return { ...head, ticks: answer.plan.solution.length, modelHits: answer.plan.modelHits ?? null,
        ...freshReplay(tape, levelSource, answer.plan) };
}
