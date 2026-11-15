/**
 * ⛓ hammer-phase L41-PUNCHER-LADDER (train tier) — `KILL_HIT_BODY` (`SEEDLING_KILL_HIT_BODY`, OFF): where the removal chooser's head is
 * not on the corridor probe's hit, the kill rung takes the hit's own body (`killHitBodyOf`).
 *
 * The states are the p4g page's own solve requests for the two seed-1 sweep legs to L40's Totem Part 64,144, captured
 * at `4c3afd9b32` (`probe-seedling-divergence-sweep.mjs --mode=inv --capture-requests`), atlas records cut to level 40
 * (`fixtures/hammer-l41-puncher-ladder/`):
 *   - `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144` (arrival (928,96)):
 *     OFF the climb ends EXHAUSTED on `puncher@816,128` with BAIT and KILL reasoning about `spinner@192,128` (the
 *     chooser's head, by the goal); ON the kill rung hunts the puncher and the leg solves, no hit, no death;
 *   - `level_40__r4c4 <- in_L42_240_336 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144` (arrival (848,16)):
 *     the control, solved OFF; ON its plan is byte-identical.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { KILL_HIT_BODY, withKillHitBody } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => restoreRequest(JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures',
    'hammer-l41-puncher-ladder', name))).toString('utf8')).requests[0].request);
const L41 = 'leg855-l41-l40-totem64-request.json.gz';
const L42 = 'leg857-l42-l40-totem64-request.json.gz';
const TIMEOUT = 300_000;

const digest = (plan) => createHash('sha1').update(JSON.stringify(plan.solution.map((k) => [...k])))
    .digest('hex').slice(0, 12);

/** The page's own solve of the fixture's request (its passes, its budget), the switch at `on`. */
function pageSolve(name, on) {
    const { passes, source, ...tape } = FIX(name);
    KILL_HIT_BODY.retargets.length = 0;
    const answer = withKillHitBody(on, () => solveAnytime({ ...tape, levelSource: levelSourceFromAtlas(source.records) },
        { passes }));
    return { answer, retargets: [...KILL_HIT_BODY.retargets], tape, source };
}

/** A plan re-driven on a FRESH run of the staging (⚖ 30(c)): its rows, its hits and deaths, where it ends. */
function drive({ answer, tape, source }) {
    const { plan } = answer;
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    expect(row()).toEqual(plan.expected[0]);
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        if (plan.expected[k + 1]) expect(row()).toEqual(plan.expected[k + 1]);
    }
    return { hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length, level: run.level,
        x: run.state.x, y: run.state.y };
}

afterEach(() => {
    KILL_HIT_BODY.retargets.length = 0;
});

describe('hammer-phase L41-PUNCHER-LADDER — L40 Totem Part 64,144 from L41 (928,96)', () => {
    it('OFF: the climb is EXHAUSTED on the puncher, and BAIT and KILL reason about the spinner by the goal', () => {
        const off = pageSolve(L41, false);
        expect(off.answer.ok).toBe(false);
        expect(off.answer.message).toMatch(/the combat ladder is EXHAUSTED\. The corridor passes through danger at \(840\.3,120\.5\) — chaser:puncher@816,128/);
        expect(off.answer.message).toMatch(/bait: spinner@192,128 is a Spinner/);
        expect(off.answer.message).toMatch(/kill: spinner@192,128 is a live Spinner, and the press arm refused/);
        expect(off.retargets).toEqual([]);
    }, TIMEOUT);

    it('ON: the kill rung hunts puncher@816,128, and the plan reaches the goal with no hit and no death', () => {
        const on = pageSolve(L41, true);
        expect(on.answer.ok).toBe(true);
        expect(on.retargets[0]).toMatchObject({ from: 'spinner@192,128', to: 'puncher@816,128' });
        const d = drive(on);
        expect(d).toMatchObject({ hits: 0, deaths: 0, level: 40 });
        expect(Math.hypot(d.x - 64, d.y - 144)).toBeLessThan(16);
    }, TIMEOUT);
});

describe('hammer-phase L41-PUNCHER-LADDER — the control: the same goal from L42 (848,16)', () => {
    it('solved OFF; ON the plan is byte-identical', () => {
        const off = pageSolve(L42, false);
        const on = pageSolve(L42, true);
        expect(off.answer.ok).toBe(true);
        expect(on.answer.ok).toBe(true);
        expect(digest(on.answer.plan)).toBe(digest(off.answer.plan));
        expect(drive(off)).toMatchObject({ hits: 0, deaths: 0 });
    }, TIMEOUT);
});
