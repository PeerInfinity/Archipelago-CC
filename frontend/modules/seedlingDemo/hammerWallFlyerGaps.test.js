/**
 * ⛓ hammer-phase WALLFLYER-GAPS — what survey step 35 (L22 → L29 (192,64), the Sword) needs under the page's work
 * budget, after the `WALLFLYER_KILL_ARM` flip (`CC/docs/cloud-reports/seedling-hammer-wallflyer-gaps.md`).
 *
 * The witness is the survey's own 0-tick boot view (`fixtures/wallflyer-drill-kill/survey-step-35-boot.json`):
 *   · G1 — THE NULL-FORK GUARD. The segment's fork (`replayOntoFork` under `crusher-fork`) is `null` once the caller's
 *     deadline has tripped; the body-family arm took it unguarded (`playWallFlyerKill`'s first `f.ledger`), so a page
 *     budget that ran out inside the arm was rendered as `Cannot read properties of null (reading 'ledger')`. A
 *     deadline that trips every `crusher-fork` ask reaches the arm's first fork at t134 (wallflyer@48,112): the answer
 *     is the climb's own refusal with the ⏱ DEADLINE clause, and the arm names the trip.
 *   · THE MODEL GAP (fidelity's hand-over, not edited here): `dangerMap.staticEnemyDanger` prices every wallflyer at
 *     its `.oel` placement, also one the run has REMOVED. Replaying the step's unbudgeted 539 t plan
 *     (`fixtures/wallflyer-gaps/survey-step-35-plan-539.json`), wallflyer@48,112 and wallflyer@64,80 leave
 *     `wallFlyerBodies` and are still priced; the dashless pass then refuses on "enemy:wallflyer@64,80 (a static
 *     "Enemy" body at its placement …)" — the JS runtime's L22 → L29 refusal, word for word. The row pins the gap AS
 *     IT IS at the shipped defaults, and fidelity's W45 key `wallFlyerCorpseGone` (OFF) closes it when ON.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { contactRect } from './combat.js';
import { withContactFidelity } from './contactFidelity.js';
import { staticEnemyDanger } from './dangerMap.js';
import { liveOf, replayTape, solveFromTape } from './jsRuntimeSolver.js';
import { BODY_FAMILY_KILL_COUNTS, resetBodyFamilyKillCounts, SolverRefusal, WALLFLYER_KILL_ARM } from './solverBot.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
    join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'))));
const STAGING = solveStaging(stagingFromTape(parseTape(readFileSync(
    join(HERE, 'fixtures', 'wallflyer-drill-kill', 'survey-step-35-boot.json'), 'utf8'))));
const PLAN = JSON.parse(readFileSync(join(HERE, 'fixtures', 'wallflyer-gaps', 'survey-step-35-plan-539.json'), 'utf8'));
const EXIT = { x: 192, y: 64 };

afterEach(() => resetBodyFamilyKillCounts());

describe('hammer-phase WALLFLYER-GAPS G1 — a deadline that trips inside the arm\'s fork', () => {
    it('the arm is ON at this base (the witness needs it)', () => {
        expect(WALLFLYER_KILL_ARM.enabled).toBe(globalThis.process?.env?.SEEDLING_WALLFLYER_KILL_ARM !== '0');
    });

    it.runIf(WALLFLYER_KILL_ARM.enabled)('step 35: the named refusal with the ⏱ DEADLINE clause, never a TypeError', () => {
        const shadow = replayTape({ staging: STAGING, perTick: [], levelSource: SOURCE });
        let err = null;
        try {
            solveFromTape({ staging: STAGING, perTick: [], live: liveOf(shadow), levelSource: SOURCE,
                solverGoal: { kind: 'reach-exit', exit: EXIT }, name: 'wallflyer-gaps-g1',
                shouldStop: (site) => site === 'crusher-fork', fineCheckpoints: true });
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.message).toContain('reach-exit (192,64)->L29: the combat ladder is EXHAUSTED');
        expect(err.message).toContain('⏱ DEADLINE: the caller\'s `shouldStop` tripped (first at `crusher-fork`)');
        expect(err.message).not.toContain('Cannot read properties of null');
        expect(BODY_FAMILY_KILL_COUNTS.kills).toEqual([]);
        expect(BODY_FAMILY_KILL_COUNTS.refused).toEqual([{ t: 134, why: 'body-family arm: no hitless kill (0 fork(s)) — '
            + 'wallflyer@48,112: the caller\'s deadline tripped inside the fork' }]);
    }, 120000);
});

describe('hammer-phase WALLFLYER-GAPS — THE MODEL GAP (fidelity\'s hand-over): a removed wallflyer is priced at its placement', () => {
    it('the 539 t plan removes wallflyer@48,112 and wallflyer@64,80, and `staticEnemyDanger` still prices both there', () => {
        const run = createRunForStaging(STAGING, SOURCE);
        const flyers = run.worldFor(22).combat.enemies.filter((e) => e.tag === 'wallflyer');
        expect(flyers.map((e) => `${e.tag}@${e.x},${e.y}`)).toEqual(['wallflyer@64,80', 'wallflyer@128,80',
            'wallflyer@48,112', 'wallflyer@144,112']);
        const at = 432; // the dashless pass's refusal tick (its corridor meets the placement box at (81.0,96.7))
        for (let t = 0; t < at; t += 1) run.advance(new Set(PLAN.keys[t] ? PLAN.keys[t].split('+') : []));
        expect(run.level).toBe(22);
        expect(run.ledger('playerHits')).toEqual([]);
        const live = (run.entities('wallFlyerBodies') ?? []).map((w) => w.id);
        expect(live).toEqual(['wallflyer@128,80', 'wallflyer@144,112']);
        const pricedNow = () => flyers.filter((e) => staticEnemyDanger(run, contactRect(e)).some((d) => d.id === `${e.tag}@${e.x},${e.y}`))
            .map((e) => `${e.tag}@${e.x},${e.y}`);
        // ⛔ THE GAP at the shipped defaults: the two REMOVED bodies are priced (fidelity's `wallFlyerCorpseGone` is OFF).
        expect(pricedNow()).toEqual(['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@48,112', 'wallflyer@144,112']);
        // ⛓ fidelity WALLFLYERCORPSE (W45): with `wallFlyerCorpseGone` ON, `staticEnemyDanger` skips a wallflyer the
        // run no longer holds — only the two live bodies are priced.
        expect(withContactFidelity({ wallFlyerCorpseGone: true }, pricedNow)).toEqual(['wallflyer@128,80', 'wallflyer@144,112']);
    }, 60000);
});
