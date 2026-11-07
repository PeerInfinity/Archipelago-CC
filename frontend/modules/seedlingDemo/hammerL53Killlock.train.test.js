/**
 * ⛓ SEEDLING HAMMER-PHASE L53-KILLLOCK — the worker's TWO passes (`ANYTIME_PASSES`) on the census's legs 9001/9002, at
 * the page's held-retry budget (2560): OFF both refuse; ON 9001 answers the FULL pass's 594-tick plan and 9002 the
 * dashless pass's 906-tick plan, each 0 hits on a fresh run (⚖ 30(c)) — the plans the page played (the report's
 * `m/page-sweep-on.tsv`). The dashless-only rows are `hammerL53Killlock.test.js` (default tier); this file is the train
 * tier (`vitest.train.config.js`) for its time.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { withKillLockChaserRewind } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-l53-killlock', name))).toString('utf8'));

function solveBothPasses(leg, on) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const answer = withKillLockChaserRewind(on, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? '') };
    const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource, scratchPersistence: tape.scratchPersistence });
    const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
    return { ok: true, ticks: answer.plan.solution.length, planSha: createHash('sha1').update(plan).digest('hex').slice(0, 12),
        level: fresh.level, hits: fresh.ledger('playerHits').length, deaths: fresh.ledger('playerDeaths').length };
}

describe('hammer-phase L53-KILLLOCK (train) — the worker\'s two passes on 9001 / 9002', () => {
    for (const [name, file, ticks, sha] of [
        ['9001 (L51 door)', 'leg9001-l51-l53-retry2560-request.json.gz', 594, '54a15ec7f984'],
        ['9002 (L48 door)', 'leg9002-l48-l53-retry2560-request.json.gz', 906, 'bf6a54ee9d41'],
    ]) {
        it(`${name}: OFF refuses; ON answers the page's plan, 0 hits in the model, into L54`, () => {
            const leg = FIX(file);
            expect(solveBothPasses(leg, false).ok).toBe(false);
            const on = solveBothPasses(leg, true);
            expect(on).toEqual({ ok: true, ticks, planSha: sha, level: 54, hits: 0, deaths: 0 });
        }, 240_000);
    }
});
