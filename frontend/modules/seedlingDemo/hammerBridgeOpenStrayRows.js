/**
 * seedlingDemo/hammerBridgeOpenStrayRows — the witness of hammer-phase SKIPWALLS' rows (`hammerBridgeOpenStray.test.js`).
 * Test support only: nothing in the app imports it.
 *   - `solveCapturedP1()`: the page worker's own request (re-measure-7's skip probe P1 33:5, `fixtures/bridge-open-stray/`)
 *     solved with `solveAnytime` over the committed atlas and the capture's own L61/L63 records; for a plan, its keys
 *     replayed on a FRESH run (`{hits, deaths, crossed}`).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/**
 * A plan's keys replayed on a fresh run of `staging`, its own equips re-made at their ticks (the bridge thrust needs the
 * Spear selected): `{hits, deaths, crossed}` (`crossed`: `{t, to}` or null).
 */
function freshReplay(staging, perTick, levelSource, plan) {
    const run = replayTape({ staging, perTick, levelSource, scratchPersistence: true });
    let crossed = null;
    for (const [i, held] of plan.solution.entries()) {
        const slot = plan.equipsAt?.get(i);
        if (slot !== undefined) run.equipNow(slot);
        const out = run.advance(held);
        if (out?.transition && crossed === null) crossed = { t: run.ticksCompleted, to: out.transition.to_level };
    }
    return { hits: run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`), deaths: run.playerDeaths.length, crossed };
}

/**
 * The captured P1 33:5 request, solved as the worker does: `{ok, work, answer, passes, message}` and, for a plan, the
 * fresh replay. `answer` is the replay script's hash (`replay-seedling-solve-request.mjs`: the message, or the keys).
 */
export function solveCapturedP1() {
    const url = new URL('./fixtures/bridge-open-stray/P1-33-5.request.json', import.meta.url);
    const fx = JSON.parse(readFileSync(url, 'utf8'));
    const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
    if ((tape.perTick ?? []).length !== 0) throw new Error('the P1 33:5 capture has no prefix; its plan\'s equips index from 0');
    const base = atlasLevelSource();
    const own = new Map(fx.levels.map(([level, record]) => [level, restoreRequest(record)]));
    const levelSource = (level) => own.get(level) ?? base(level);
    const answer = solveAnytime({ ...tape, levelSource }, { passes });
    const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
    const head = { ok: answer.ok, work: answer.work, answer: sha(text),
        passes: (answer.passes ?? []).map(({ ms, ...p }) => p) };
    if (!answer.ok) return { ...head, message: text };
    return { ...head, ticks: answer.plan.solution.length,
        ...freshReplay(tape.staging, tape.perTick ?? [], levelSource, answer.plan) };
}
