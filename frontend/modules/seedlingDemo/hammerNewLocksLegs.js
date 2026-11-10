/**
 * ⛓ SEEDLING HAMMER-PHASE NEW-LOCKS — the five captured legs and the one way the rows solve them, shared by
 * `hammerNewLocks.test.js` and `hammerNewLocks.train.test.js` (test support only: nothing in the solver imports it).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    KILLLOCK_LINE_STANCE_COUNTS, resetKillLockLineStanceCounts, withKillLockChaserRewind, withKillLockClearWrite,
    withKillLockLineStance, withRockLockKill,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-new-locks', name))).toString('utf8'));
export const LEG_223 = FIX('leg223-l16-l18-request.json.gz');
export const LEG_286 = FIX('leg286-l25-l26-request.json.gz');
export const LEG_289 = FIX('leg289-l27-l26-request.json.gz');
export const LEG_910 = FIX('leg910-l48-l53-retry2560-request.json.gz');
export const LEG_911 = FIX('leg911-l51-l53-request.json.gz');

export const ALL = { write: true, rock: true, rewind: true, line: true };
export const NONE = { write: false, rock: false, rewind: false, line: false };

/** Run `fn` with the four switches set as named (each restored after). */
const under = ({ write, rock, rewind, line }, fn) => withKillLockClearWrite(write, () => withRockLockKill(rock,
    () => withKillLockChaserRewind(rewind, () => withKillLockLineStance(line, fn))));

export function staged(leg) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    return { passes, source, tape, levelSource: levelSourceFromAtlas(source.records) };
}

/** A captured leg solved as the worker does, under the switches; the plan re-driven on a fresh run. */
export function solveLeg(leg, switches) {
    const { passes, source, tape, levelSource } = staged(leg);
    resetKillLockLineStanceCounts();
    const answer = under(switches, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    const line = KILLLOCK_LINE_STANCE_COUNTS.rows.map(({ id, stance, verdict }) => ({ id, stance, verdict }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? ''), obstacle: answer.obstacle ?? null, line };
    const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource, scratchPersistence: tape.scratchPersistence });
    const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
    return { ok: true, ticks: answer.plan.solution.length,
        planSha: createHash('sha1').update(plan).digest('hex').slice(0, 12), verbs: answer.plan.verbs,
        level: fresh.level, hits: fresh.ledger('playerHits').length, deaths: fresh.ledger('playerDeaths').length,
        earned: fresh.ledger('earnedClears').map((c) => `${c.level}:${c.tag}`),
        writes: fresh.scratchClears.map(({ level, tag, at, lock }) => ({ level, tag, at, lock })),
        stillSolid: (fresh.world.solids ?? []).some((s) => /lock$/.test(s.tag ?? '')), line };
}
