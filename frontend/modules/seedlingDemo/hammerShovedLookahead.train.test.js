// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push. `npm run test:unit:train`.
/**
 * ⛓⛓ SEEDLING HAMMER-PHASE L40-SPINNER-WALLS — `SHOVED_BODY_LOOKAHEAD`'s solve rows (the fast ones:
 * `hammerShovedLookahead.test.js`).
 *
 * Leg `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest`: the page sweep's own capture at base
 * `4c3afd9b32` (`fixtures/hammer-l40-spinner-walls/chest-L39-request.json.gz`, its 2560-work request), re-stamped to an
 * arrival clock, solved by the worker's dispatch (`solveAnytime`) at the shipped defaults:
 *   - clock 5225 OFF: refused, "There is no step out" at (741.44,685.29): a live spinner shoved by the player's own shield
 *     rebounds at ~4 px/tick, and the walk's four-tick lookahead scored the doomed `down` as safe (report § 3);
 *   - clock 5225 ON: solved, no player hit, no death on a fresh run;
 *   - clock 5233 (the clock the page drew at the base): OFF = ON, byte-identical.
 *
 * ⛓ SPINNER-SHOVED-FOLLOWUP (the same switch; report `seedling-hammer-spinner-shoved-followup.md`): leg
 * `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest` at clock 5235, where L40-SPINNER-WALLS' ON returned a
 * plan billing two chaser contacts (`bob@736,752` t776, `bob@736,800` t832): the chaser-priced deep step removes the t832
 * contact, and the t776 one (billed on a tick no deep answer ran, after the corner escape's first OFF-divergent key
 * at t649) is refused by name (`SHOVED_LOOKAHEAD_HIT`). OFF it
 * refuses at the approach corner, as before.
 * ⚖ Robert 2026-11-14 (hammer replan): "Drop the L43 row" — that row cost 1,078 s, nearly all of it OFF's own
 * approach search, so it is not carried; the evidence stays in the follow-up's report (L43 5235 OFF refused / ON
 * refused by name, `SHOVED_LOOKAHEAD_HIT`).
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { withShovedBodyLookahead } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-l40-spinner-walls', name)))
    .toString('utf8'));

/** The leg's request at arrival clock `seam`, solved (switch at `on`), its plan driven on a fresh run. */
function solveAt(name, seam, on) {
    const c0 = FIX(name).requests[0].request;
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest({ ...c0,
        staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
    const levelSource = levelSourceFromAtlas(source.records);
    const answer = withShovedBodyLookahead(on, () => solveAnytime({ ...tape, levelSource }, { passes }));
    if (!answer.ok) return { ok: false, message: answer.message };
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
        hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length };
}

describe('SHOVED_BODY_LOOKAHEAD — L40 Chest from L39, clock 5225 (the shield-bump rebound)', () => {
    it('OFF: refused, no step out, at the approach corner', () => {
        const off = solveAt('chest-L39-request.json.gz', 5225, false);
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/kill \(spinner@880,848\) by press: every key set .* at \(741\.44,685\.29\) in level 40\. There is no step out\./);
    }, 900_000);

    it('ON: solved hitless — 1636 t, no death on a fresh run', () => {
        expect(solveAt('chest-L39-request.json.gz', 5225, true)).toEqual({ ok: true, ticks: 1636, sha: 'f90b8e0581d6',
            hits: 0, deaths: 0 });
    }, 900_000);
});

describe('SHOVED_BODY_LOOKAHEAD — control: the page\'s own clock 5233 is unchanged', () => {
    it('OFF = ON, byte-identical (1317 t)', () => {
        const want = { ok: true, ticks: 1317, sha: 'ff95a231a1b7', hits: 0, deaths: 0 };
        expect(solveAt('chest-L39-request.json.gz', 5233, false)).toEqual(want);
        expect(solveAt('chest-L39-request.json.gz', 5233, true)).toEqual(want);
    }, 900_000);
});
