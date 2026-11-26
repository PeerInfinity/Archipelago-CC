/**
 * ⛓⛓ SEEDLING HAMMER-PHASE FACE 1 (train tier) — `GOAL_START_WAIT` (OFF) on a captured page request: the seed-1
 * whole-game wasm walk's stop (re-measure-6 A1, request 26:9, the 2560 held retry), a clear-tag goal whose burn
 * stance's combat ladder is EXHAUSTED at the arrival. Solved by the worker's dispatch (`solveAnytime`, the request's own
 * budgets and passes) at the shipped switches:
 *   - OFF: refused, the combat ladder EXHAUSTED (no wait is asked).
 *   - ON: solved inside the request's own budget; the plan starts with an idle (no keys) where the goal began, earns
 *     the goal's flag, and re-driven on a FRESH run of the staging takes no hit and no death, row for row (⚖ 30(c)).
 * The fast rows are `goalStartWait.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { GOAL_START_WAIT, GOAL_START_WAIT_COUNTS, withGoalStartWait } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURED = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-face1', 'A1-26-9-request.json.gz')))
    .toString('utf8'));

function solve(on) {
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(CAPTURED.request);
    const levelSource = levelSourceFromAtlas(source.records);
    GOAL_START_WAIT_COUNTS.tries.length = 0;
    const answer = withGoalStartWait(on, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    return { answer, tape, levelSource, tries: [...GOAL_START_WAIT_COUNTS.tries], budget: tape.budgetWork };
}

describe('hammer-phase FACE 1: GOAL_START_WAIT on the captured L40 burn-stance stop (train)', () => {
    it('OFF: the clear-tag goal is refused, the combat ladder EXHAUSTED, and no wait is asked', () => {
        const { answer, tries } = solve(false);
        expect(answer.ok).toBe(false);
        expect(answer.kind).toBe('refusal');
        expect(answer.message).toContain('the combat ladder is EXHAUSTED');
        expect(tries).toEqual([]);
    }, 300_000);

    it('ON: solved inside the request\'s budget; the plan idles first, earns the goal\'s flag, and a fresh run of it '
        + 'takes no hit and no death', () => {
        const { answer, tape, levelSource, tries, budget } = solve(true);
        expect(answer.ok).toBe(true);
        expect(answer.work).toBeLessThanOrEqual(budget);
        const kept = tries.find((t) => t.ok);
        expect(kept).toBeDefined();
        expect(GOAL_START_WAIT.waits).toContain(kept.wait);
        const { plan } = answer;
        // the kept wait is the plan's own first ticks: no keys
        expect(plan.solution.slice(0, kept.wait).every((k) => k.size === 0)).toBe(true);
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
        const goal = tape.solverGoal.tag;
        expect((run.ledger('earnedClears') ?? []).some((c) => c.level === goal.level && c.tag === goal.tag)).toBe(true);
    }, 600_000);
});
