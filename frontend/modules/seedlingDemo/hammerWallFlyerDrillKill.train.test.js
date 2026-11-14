/**
 * ⛓ hammer-phase WALLFLYER-DRILL-KILL — the route survey's two lost solves under the corridor flip, OFF and ON
 * (train tier: each solve is 10-40 s). The witnesses are the survey's own 0-tick boot views
 * (`fixtures/wallflyer-drill-kill/survey-step-{35,84}-boot.json`, the CORRIDORFLIP witnesses' staging):
 *   · step 35, L22 → the teleporter at (192,64): OFF the ladder EXHAUSTS on `wallflyer@48,112`; ON the chaser arm
 *     takes `bob@96,144`, then the wallflyer arm strikes `wallflyer@48,112` and `wallflyer@64,80` where they rest;
 *   · step 84, L88 → the teleporter at (32,0): OFF EXHAUSTED on `drill@128,160`; ON the drill arm kills it.
 * Both ON plans were played on the game (p4g, headless, clock shift [0]): no hit, the crossing on the model's tick.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import {
    BODY_FAMILY_KILL_COUNTS, resetBodyFamilyKillCounts, withDrillExitPass, withDrillKillArm, withWallFlyerKillArm,
} from './solverBot.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
    join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'))));

async function solveStep(step, goals) {
    const boot = readFileSync(join(HERE, 'fixtures', 'wallflyer-drill-kill', `survey-step-${step}-boot.json`), 'utf8');
    const staging = solveStaging(stagingFromTape(parseTape(boot)));
    const makeRun = (persistence) => createRunForStaging({ ...staging, persistence }, SOURCE);
    const res = await twoPassSolve({ makeRun, goals, name: `wdk-step-${step}`, boot: staging.boot,
        persistence: staging.persistence, log: () => {} });
    const run = makeRun(staging.persistence);
    for (const held of res.out.perTick) run.advance(held);
    return { res, run };
}
const STEP35 = () => solveStep(35, [{ kind: 'reach-exit', exit: { x: 192, y: 64 } }]);
const STEP84 = () => solveStep(84, [{ kind: 'reach-exit', exit: { x: 32, y: 0 } }]);
const both = (on, fn) => withWallFlyerKillArm(on, () => withDrillKillArm(on, fn));

afterEach(() => resetBodyFamilyKillCounts());

describe('hammer-phase WALLFLYER-DRILL-KILL — survey step 35 (L22 → L29), the corridor flip ON', () => {
    it('OFF: EXHAUSTED at wallflyer@48,112', async () => {
        await expect(both(false, STEP35)).rejects.toThrow(/combat ladder is EXHAUSTED[\s\S]*wallflyer@48,112/);
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(0);
    });

    it('ON: two wallflyers struck where they rest, and the step crosses to L29 with no hit (539 t)', async () => {
        const { res, run } = await both(true, STEP35);
        expect(BODY_FAMILY_KILL_COUNTS.kills.map((k) => [k.id, k.family, k.forks])).toEqual([
            ['wallflyer@48,112', 'wallflyer', 1], ['wallflyer@64,80', 'wallflyer', 1]]);
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(run.level).toBe(29);
        expect(res.out.perTick.length).toBe(539);
    });
});

describe('hammer-phase WALLFLYER-DRILL-KILL — survey step 84 (L88 → L87), the corridor flip ON', () => {
    // ⛓ hammer stack (DRILL_EXIT_PASS default ON + the corridor flip): the arms-OFF step now crosses by the drill exit
    //   pass (246 t, no hit; measured planning-8), so the refusal the drill arm answers is the one DRILL_EXIT_PASS=0 gives.
    it('OFF (DRILL_EXIT_PASS off): EXHAUSTED at drill@128,160 ("not a body this run can watch die")', async () => {
        await expect(withDrillExitPass(false, () => both(false, STEP84)))
            .rejects.toThrow(/combat ladder is EXHAUSTED[\s\S]*drill@128,160/);
    });

    it('OFF at the stack defaults (DRILL_EXIT_PASS on): L87 reached with no hit, and the drill arm is never asked', async () => {
        const { run } = await both(false, STEP84);
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(run.level).toBe(87);
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(0);
    });

    it('ON (the drill arm alone): drill@128,160 killed from its south pre-stance, L87 reached with no hit (354 t)', async () => {
        const { res, run } = await withWallFlyerKillArm(false, () => withDrillKillArm(true, STEP84));
        expect(BODY_FAMILY_KILL_COUNTS.kills.map((k) => [k.id, k.family, k.forks])).toEqual([
            ['drill@128,160', 'drill', 1]]);
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.level).toBe(87);
        expect(res.out.perTick.length).toBe(354);
    });
});
