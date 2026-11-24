/**
 * seedlingDemo/hammerFlipblockWitness.train — ⛓ hammer-phase FLIPBLOCK (`CC/docs/cloud-reports/seedling-hammer-flipblock.md`):
 * two seed-1 divergence-sweep legs that an ON arm lost and OFF solves, each a captured page request (its 2560 held
 * retry; `--capture-requests`, data only) solved through the worker's dispatch (`solveAnytime`, the request's own
 * budgets and passes):
 *   - `level_71__r0c6 <- in_L72_0_256 -> location:L71 flag 2: shieldlock@288,256 cleared` (GOAL_START_WAIT): the dashless
 *     pass refuses with the combat ladder EXHAUSTED and the full pass solves. ON, the dashless pass asks no wait (a later
 *     pass follows: `GOAL_START_WAIT_PASS`), so the full pass keeps its budget — the answer is OFF's, byte for byte.
 *   - `level_101__r4c2 <- in_L100_288_96 -> location:L101 flag 0: lightpole@144,64 cleared` (PREVIEW_METER): the dashless
 *     pass solves close to the budget with sparse previews. ON with the shipped allowance (`freeStatesPerAsk`) asks
 *     nothing more — OFF's answer; with no allowance (the SPINNER880 meter) the budget runs out, the loss the sweep saw.
 * The leg is the witness; nothing here reads a level, a coordinate or an entity.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import {
    GOAL_START_WAIT_COUNTS, PREVIEW_METER, PREVIEW_METER_COUNTS, withGoalStartWait, withPreviewMeter,
} from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-flipblock', name))).toString('utf8'));
const L71 = load('L71-flag2-2560-request.json.gz');
const L101 = load('L101-flag0-2560-request.json.gz');

function solve(captured, wrap = (fn) => fn()) {
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(captured.request);
    const levelSource = levelSourceFromAtlas(source.records);
    const answer = wrap(() => solveAnytime({ ...tape, source, levelSource }, { passes }));
    return { answer, budget: tape.budgetWork, passes: answer.passes ?? [] };
}

const bytes = (a) => (a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k].sort())) : String(a.message));
const solvedPass = (a) => a.passes.find((p) => p.ok);

describe('hammer-phase FLIPBLOCK: the ON arms keep the legs OFF solves (train)', () => {
    it('GOAL_START_WAIT: the L71 leg — the dashless pass defers its waits, and the full pass solves as OFF does', () => {
        const off = solve(L71);
        expect(off.answer.ok).toBe(true);
        expect(off.passes[0].ok).toBe(false); // the dashless pass refuses (EXHAUSTED) …
        expect(solvedPass(off.answer).pass).toBe(off.passes[off.passes.length - 1].pass); // … the last pass solves
        GOAL_START_WAIT_COUNTS.tries.length = 0;
        const deferred0 = GOAL_START_WAIT_COUNTS.deferred ?? 0;
        const on = solve(L71, (fn) => withGoalStartWait(true, fn));
        expect((GOAL_START_WAIT_COUNTS.deferred ?? 0) - deferred0).toBeGreaterThan(0);
        expect(GOAL_START_WAIT_COUNTS.tries).toEqual([]); // no wait asked on the dashless pass, none needed on the last
        expect(on.answer.ok).toBe(true);
        expect(on.answer.work).toBeLessThanOrEqual(on.budget);
        expect(on.answer.work).toBe(off.answer.work);
        expect(on.passes.map((p) => [p.pass, p.ok, p.work])).toEqual(off.passes.map((p) => [p.pass, p.ok, p.work]));
        expect(bytes(on.answer)).toBe(bytes(off.answer));
        expect(solvedPass(on.answer).modelHits).toEqual({ hits: 0, deaths: 0 });
    }, 300_000);

    it('PREVIEW_METER: the L101 leg — the shipped allowance asks nothing more and keeps OFF\'s answer; with none, the '
        + 'meter spends the budget', () => {
        const off = solve(L101);
        expect(off.answer.ok).toBe(true);
        expect(solvedPass(off.answer).pass).toBe(off.passes[0].pass); // the dashless pass solves, inside the budget
        expect(solvedPass(off.answer).work).toBeLessThanOrEqual(off.budget);
        Object.assign(PREVIEW_METER_COUNTS, { states: 0, asked: 0, tripped: 0 });
        const on = solve(L101, (fn) => withPreviewMeter(true, fn));
        const counted = { ...PREVIEW_METER_COUNTS };
        expect(counted.states).toBeGreaterThan(0);
        expect(counted.asked).toBe(0);
        expect(on.answer.ok).toBe(true);
        expect(on.answer.work).toBe(off.answer.work);
        expect(on.passes.map((p) => [p.pass, p.ok, p.work])).toEqual(off.passes.map((p) => [p.pass, p.ok, p.work]));
        expect(bytes(on.answer)).toBe(bytes(off.answer));
        expect(solvedPass(on.answer).modelHits).toEqual({ hits: 0, deaths: 0 });
        const was = PREVIEW_METER.freeStatesPerAsk;
        PREVIEW_METER.freeStatesPerAsk = 0;
        let none;
        try {
            none = solve(L101, (fn) => withPreviewMeter(true, fn));
        } finally {
            PREVIEW_METER.freeStatesPerAsk = was;
        }
        expect(none.answer.ok).toBe(false);
        expect(none.passes.some((p) => p.limit === 'budget')).toBe(true);
    }, 300_000);
});
