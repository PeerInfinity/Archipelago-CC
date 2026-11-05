/**
 * ⛓⛓ SEEDLING HAMMER-PHASE L95-PUNCHER — the train row: leg 160 (`… <- in_L95_624_64 -> location:L12 flag 4:
 * bosslock@416,240 cleared`) solved with the WORKER's two anytime passes, `CLEARTAG_STAND` ON, `CHASER_STAGED_HUNT`
 * OFF and ON. `hammerL95Puncher.test.js` pins the same answer on the dashless pass alone (the pass the plan comes
 * from); this row is the worker-exact dispatch (28 s on a quiet box, over the default tier's ~20 s line). The full
 * pass's dash upgrade is cut by the 640-unit work budget, so the plan is the dashless pass's: lossless, as on the page.
 * The report: `CC/docs/cloud-reports/seedling-hammer-l95-puncher.md`.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    CHASER_STAGED_HUNT_COUNTS, resetChaserStagedHuntCounts, withChaserStagedHunt, withClearTagStand,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEG_L95 = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-l95-puncher',
    'leg160-l95-l12-request.json.gz'))).toString('utf8'));
const PUNCHER = 'puncher@416,256';

function solveLeg(staged) {
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(LEG_L95.requests[0].request);
    const levelSource12 = levelSourceFromAtlas(source.records);
    resetChaserStagedHuntCounts();
    const answer = withClearTagStand(true, () => withChaserStagedHunt(staged,
        () => solveAnytime({ ...tape, source, levelSource: levelSource12 }, { passes })));
    const asks = CHASER_STAGED_HUNT_COUNTS.asks.map((a) => ({ ...a }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? ''), passes: answer.passes, asks };
    const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
    const shadow = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource: levelSource12, scratchPersistence: tape.scratchPersistence });
    return { ok: true, ticks: answer.plan.solution.length, planSha: createHash('sha1').update(plan).digest('hex').slice(0, 12),
        passes: answer.passes, hits: shadow.ledger('playerHits').map((h) => [h.t, h.source, h.id]), asks };
}

describe('hammer-phase L95-PUNCHER (train) — leg 160 with the worker\'s two passes, CLEARTAG ON', () => {
    it('OFF both passes refuse (the ladder exhausted); ON the dashless pass stages and kills (794 t, 0 hits)', () => {
        const off = solveLeg(false);
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/the combat ladder is EXHAUSTED/);
        expect(off.passes.map((p) => [p.pass, p.ok])).toEqual([['dashless', false], ['full', false]]);
        expect(off.asks).toEqual([]);
        const on = solveLeg(true);
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.ticks).toBe(794);
        expect(on.planSha).toBe('b6a1482dccf4');
        // the plan is the dashless pass's; the full pass's upgrade was cut by the work budget (lossless)
        expect(on.passes.map((p) => [p.pass, p.ok, p.limit ?? null])).toEqual([['dashless', true, null], ['full', false, 'budget']]);
        expect(on.asks[0]).toEqual({ id: PUNCHER, t: 0, cell: { x: 376, y: 232 }, wait: 0, verdict: 'staged' });
    }, 240_000);
});
