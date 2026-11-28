/**
 * ⛓ SEEDLING HAMMER-PHASE STEP-189 — the two captured L71 requests and the one way the rows solve them, shared by
 * `hammerStep189.test.js` and `hammerStep189.train.test.js` (test support only: nothing in the solver imports it).
 *
 * Re-measure-11 P1 (skip mode, FIVE): 38:6 (L71 → the chest at (160,256)) and 39:1 (L71 → the exit (96,0) → L75), the
 * page worker's own requests, their `source` trimmed to L71 and its teleporter targets.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { KILLLOCK_PINNED_SPEAR_COUNTS, resetKillLockPinnedSpearCounts, withKillLockPinnedSpear } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-step189-lavarunner', name))).toString('utf8'));
export const REQ_38_6 = FIX('rm11-p1-38-6-l71-chest-request.json.gz');
export const REQ_39_1 = FIX('rm11-p1-39-1-l71-exit-l75-request.json.gz');

export function staged(leg) {
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(leg.requests[0].request);
    return { passes, source, tape, levelSource: levelSourceFromAtlas(source.records) };
}

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/** A captured request solved as the worker does with `KILLLOCK_PINNED_SPEAR` set to `on`; a plan re-driven on a fresh run. */
export function solveStep189(leg, on) {
    const { passes, source, tape, levelSource } = staged(leg);
    resetKillLockPinnedSpearCounts();
    const answer = withKillLockPinnedSpear(on, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    const rows = KILLLOCK_PINNED_SPEAR_COUNTS.rows.map(({ id, stance, dir, verdict }) => ({ id, stance, dir, verdict }));
    const passRows = (answer.passes ?? []).map((p) => [p.pass, p.ok]);
    if (!answer.ok) {
        const text = String(answer.message ?? '');
        return { ok: false, answer: sha(text), message: text, work: answer.work, passes: passRows, rows };
    }
    // the plan's keys AND its slot selections (`equipsAt`: the spear), tick by tick, on a fresh run after the prefix
    const fresh = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null,
        scratchPersistence: tape.scratchPersistence === true });
    const h0 = fresh.ledger('playerHits').length;
    const d0 = fresh.ledger('playerDeaths').length;
    for (const [k, held] of answer.plan.solution.entries()) {
        const slot = answer.plan.equipsAt?.get(k);
        if (slot !== undefined) fresh.equipNow(slot);
        fresh.advance(held);
    }
    return { ok: true, answer: sha(JSON.stringify(answer.plan.solution.map((k) => [...k]))), ticks: answer.plan.solution.length,
        work: answer.work, passes: passRows, level: fresh.level, hits: fresh.ledger('playerHits').length - h0,
        deaths: fresh.ledger('playerDeaths').length - d0, rows };
}
