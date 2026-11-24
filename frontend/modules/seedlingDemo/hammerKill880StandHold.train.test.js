/**
 * ⛓⛓ SEEDLING HAMMER-PHASE KILL880 (train tier) — `PRESS_KILL_HOLD` (OFF) on a captured page request: the seed-1
 * whole-game wasm walk's L40 Chest goal (re-measure-6 P1, request 19:1, `apitem (880,816) contact`), whose press kill of
 * `spinner@880,848` refuses HAMMER_SAFETY *"There is no step out"* (work 56 a pass, no deadline). Solved by the worker's
 * dispatch (`solveAnytime`) on the request's own staging, dashless pass only (the pass that refuses and the pass ON
 * solves on; the full pass is the same kill at more cost):
 *   - OFF, at the request's own budget: refused HAMMER_SAFETY, and the hold is never asked.
 *   - ON, at the page's held-retry budget (2560): solved; the kept redo held whole hammer periods at the kill's last
 *     stand, and the plan re-driven on a FRESH run of the staging takes no hit and no death, row for row (⚖ 30(c)).
 * The fast rows are `pressKillHold.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { HAMMER_PHASE_RUNG, PRESS_KILL_HOLD_COUNTS, withPressKillHold } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURED = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-kill880', 'P1-19-1-request.json.gz')))
    .toString('utf8'));
const DASHLESS = [ANYTIME_PASSES[0]];

function solve(on, budgetWork) {
    const { passes, source, ...tape } = restoreRequest(CAPTURED.request);
    const levelSource = levelSourceFromAtlas(source.records);
    PRESS_KILL_HOLD_COUNTS.rows.length = 0;
    const answer = withPressKillHold(on, () => solveAnytime({ ...tape, budgetWork, source, levelSource },
        { passes: DASHLESS }));
    return { answer, tape, levelSource, rows: PRESS_KILL_HOLD_COUNTS.rows.map((r) => ({ ...r })) };
}

describe('hammer-phase KILL880: PRESS_KILL_HOLD on the captured L40 Chest press-kill corner (train)', () => {
    it('OFF: the press kill refuses HAMMER_SAFETY ("There is no step out"), and no hold is asked', () => {
        const { answer, tape, rows } = solve(false, CAPTURED.request.budgetWork);
        expect(answer.ok).toBe(false);
        expect(answer.kind).toBe('refusal');
        expect(answer.message).toContain('kill (spinner@880,848) by press');
        expect(answer.message).toContain('There is no step out');
        expect(answer.work).toBeLessThan(tape.budgetWork ?? Infinity);
        expect(rows).toEqual([]);
    }, 400_000);

    it('ON: solved; the kept redo held whole hammer periods at the kill\'s last stand, and a fresh run of the plan '
        + 'takes no hit and no death', () => {
        const { answer, tape, levelSource, rows } = solve(true, 2560);
        expect(answer.ok).toBe(true);
        expect(answer.work).toBeLessThanOrEqual(2560);
        const kept = rows.find((r) => r.verdict === 'solved');
        expect(kept).toBeDefined();
        expect(kept.stand).toBeLessThan(kept.refusedAt);
        const wait = kept.tries.at(-1).wait;
        expect(wait % HAMMER_PHASE_RUNG.horizon).toBe(0);
        const { plan } = answer;
        // the hold is the plan's own ticks: no keys from the stand's end for `wait` ticks
        expect(plan.solution.slice(kept.stand, kept.stand + wait).every((k) => k.size === 0)).toBe(true);
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
            scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
        const h0 = run.playerHits.length;
        let mismatches = 0;
        for (let k = 0; k < plan.solution.length; k += 1) {
            const slot = plan.equipsAt?.get?.(k);
            if (slot !== undefined) run.equipNow(slot);
            run.advance(plan.solution[k]);
            if (plan.expected[k + 1] && JSON.stringify(row()) !== JSON.stringify(plan.expected[k + 1])) mismatches += 1;
        }
        expect(mismatches).toBe(0);
        expect(run.playerHits.slice(h0)).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
    }, 600_000);
});
