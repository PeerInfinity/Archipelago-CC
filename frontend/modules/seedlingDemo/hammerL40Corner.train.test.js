// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push. `npm run test:unit:train`.
/**
 * hammerL40Corner — SEEDLING HAMMER-PHASE L40-CORNER: the L40 spinner corner (seed 1's Boss Key 2 prerequisite, flag 12's
 * burn stance, and the Chest leg's press) is answered at the SHIPPED budget by two switches that already exist, OFF.
 * The brief's premise (an arrival-phase press with no wait option) did not hold: a press-phase wait was built, measured
 * and NOT shipped (`CC/docs/cloud-reports/seedling-hammer-l40-corner.md` § 4, § 8).
 *
 * The witness is the committed request of leg `level_40__r48c54 <- in_L39_144_0 ~> level_40__r23c29 -> location:L40
 * flag 12: wandlock@480,560 cleared` (`fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz`), re-stamped to an
 * arrival clock and solved by the worker's dispatch (`solveAnytime`) at budget 2560 (the page's held retry). Measured at
 * the slice's base `f43e2de82a` over 5213..5257 (one hammer period): 40/45 solve hitless; 5241/5242 refuse on
 * `spinner@816,848` (the corner 7 ticks after the press LANDED at t1360 — word for word the wasm A2 "Level 040 - Chest"
 * stop), 5225/5227/5228 on `spinner@880,848`.
 *   · `PRESS_ESCAPE_SHIELD_CLAIM` ON (the SPIN slice's switch): 5241 and 5242 solve hitless, flags 40:0 and 40:12 earned;
 *   · `SHOVED_BODY_LOOKAHEAD` ON (the L40-SPINNER-WALLS switch): 5225 solves hitless.
 * The rows pin those three answers and the OFF refusal they replace; they do not flip anything.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { withShovedBodyLookahead } from './solverBot.js';
import { withPressEscapeShieldClaim } from './pressKillGuards.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REQUEST = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-chain',
    'leg871-l39-l40-request.json.gz'))).toString('utf8')).requests[0].request;
const BUDGET = 2560;

/** The leg's request at arrival clock `seam`, solved inside `wrap`, its plan driven on a fresh run. */
function solveAt(seam, wrap = (fn) => fn()) {
    const { passes = ANYTIME_PASSES, source, budgetWork: _b, ...tape } = restoreRequest({ ...REQUEST,
        staging: { ...REQUEST.staging, seam: { ...REQUEST.staging.seam, time: seam } } });
    const levelSource = levelSourceFromAtlas(source.records);
    const answer = wrap(() => solveAnytime({ ...tape, budgetWork: BUDGET, levelSource }, { passes }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? '') };
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const hits0 = run.playerHits.length;
    for (let k = 0; k < answer.plan.solution.length; k += 1) {
        const slot = answer.plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(answer.plan.solution[k]);
    }
    return { ok: true, ticks: answer.plan.solution.length,
        sha: createHash('sha256').update(JSON.stringify(answer.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length,
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() };
}

describe('hammer-phase L40-CORNER — the L40 spinner corner, answered by the existing OFF switches (train)', () => {
    it('⛓ OFF at clock 5241 the press kill of spinner@816,848 refuses: the corner after the landing at t1360', () => {
        const r = solveAt(5241);
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/burn stance \(burnabletree@872,784\) -> kill \(spinner@816,848\) by press: every key set/);
        expect(r.message).toMatch(/There is no step out\./);
        expect(r.message).toMatch(/LANDED at t1360/);
    }, 600_000);

    it('⛓⛓ PRESS_ESCAPE_SHIELD_CLAIM ON solves 5241 and 5242 hitless, flag 12 earned', () => {
        for (const [seam, ticks, sha] of [[5241, 1110, '106c40080ca0'], [5242, 1169, 'ed9ae605061d']]) {
            const r = solveAt(seam, (fn) => withPressEscapeShieldClaim(true, fn));
            expect(r, `clock ${seam}`).toMatchObject({ ok: true, ticks, sha, hits: 0, deaths: 0 });
            expect(r.clears).toEqual(['40:0', '40:12']);
        }
    }, 900_000);

    it('⛓⛓ SHOVED_BODY_LOOKAHEAD ON solves 5225 (spinner@880,848\'s refusal) hitless, flag 12 earned', () => {
        const r = solveAt(5225, (fn) => withShovedBodyLookahead(true, fn));
        expect(r).toMatchObject({ ok: true, ticks: 1715, sha: '3e354fdefb42', hits: 0, deaths: 0 });
        expect(r.clears).toEqual(['40:0', '40:12']);
    }, 900_000);
});
