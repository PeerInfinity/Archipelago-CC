/**
 * ⛓ LIGHTS WIRING (slice `seedling-js-lights-wiring`) — the L69 fight reaches the solver from the JS runtime's goal
 * mapping, behind `CONTACT_FIDELITY.lightsBossFight` (fidelity LIGHTS), and nothing moves while it is OFF:
 *
 *   leg 607  exit `out_lightbosscontroller_72_72` (no live teleporter until `endState()`)
 *            → `solverGoalFor` → `{kind: 'sequence', goals: [clear-tag {69,0}, reach-exit (72,72)]}` (`FIGHT_EXITS`)
 *   leg 608  `Level 069 - Lights` (a boss report the vanilla map refused) → the controller's `atlasBossGoal`
 *            → `solverGoalFor` → the same `clear-tag` (pinned in `seedlingVanillaArmMap.test.js`)
 *
 * ⛔ THE STAGINGS ARE fidelity's game witnesses (`fixtures/lights-witness/`), the goals the ones fidelity's own solve
 * test hands `twoPassSolve` (`fidelityLights.slow.test.js`' GOALS) — so the mapping is pinned to what the model solves.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 `fightExitOf` ignores `cleared`      -> "a revisit (the tag cleared)…" reds (a second fight is asked).
 *   m2 the sequence drops its reach-exit    -> "ON: the exit is the fight, then the exit" reds on the exact goal.
 *   m3 the seam not gated (OFF reaches it)  -> "OFF: byte-identical" reds (OFF has no `lightsControllers`, so only a
 *                                              mutant that builds the rows itself can reach it).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { solveStaging, stagingFromTape } from './tapeRunner.js';
import { arrivalSolverGoal } from './wasmArrival.js';
import { FIGHT_EXITS, fightExitGoal, solverGoalFor, solverGoalsOf } from './jsRuntimeSolver.js';
import { assertGoal } from './solverBot.js';

const levelSource = atlasLevelSource();
const stagingOf = (name) => solveStaging(stagingFromTape(parseTape(JSON.stringify(JSON.parse(readFileSync(
    new URL(`./fixtures/lights-witness/${name}.json`, import.meta.url), 'utf8')).tape))));
/** Leg 607's goal, as the sweep's legs list spells it (`exit_id` out_lightbosscontroller_72_72, tile (4,4)). */
const EXIT = { kind: 'exit', level: 69, tiles: [[4, 4]], name: 'level_69 -> level_36' };
/** fidelity's solve test's GOALS (`fidelityLights.slow.test.js`). */
const FIDELITY_GOALS = [
    { kind: 'clear-tag', tag: { level: 69, tag: 0 }, at: { x: 72, y: 72 }, obstacle: 'lightbosscontroller@72,72' },
    { kind: 'reach-exit', exit: { x: 72, y: 72 } },
];
const map = (lights, staging = stagingOf('lights-stand')) => withContactFidelity({ lightsBossFight: lights },
    () => arrivalSolverGoal(EXIT, { staging, levelSource, record: levelSource(69) }));

describe('LIGHTS WIRING — leg 607: the exit only the fight opens', () => {
    it('OFF: byte-identical — the old refusal, by its old text', () => {
        expect(map(false)).toEqual({ walker: 'no live teleporter resolved for the exit' });
    });

    it('ON: the exit is the fight, then the exit — fidelity\'s own GOALS, every field read off the model', () => {
        const m = map(true);
        expect(m).toEqual({ goal: { kind: 'sequence', goals: FIDELITY_GOALS } });
        expect(solverGoalsOf(m.goal)).toEqual(FIDELITY_GOALS);
        // each is a goal the solver accepts (its shape check)
        for (const g of solverGoalsOf(m.goal)) expect(() => assertGoal(g, 'lights-wiring')).not.toThrow();
    });

    it('a revisit (the tag cleared): the world already has the exit, so it is the door\'s plain reach-exit', () => {
        const st = stagingOf('lights-stand');
        const m = map(true, { ...st, persistence: [...st.persistence, { level: 69, tag: 0 }] });
        expect(m).toEqual({ goal: { kind: 'reach-exit', exit: { x: 72, y: 72 } } });
    });

    it('an exit on other cells is not the fight\'s (the old refusal)', () => {
        const m = withContactFidelity({ lightsBossFight: true }, () => arrivalSolverGoal({ ...EXIT, tiles: [[1, 1]] },
            { staging: stagingOf('lights-stand'), levelSource, record: levelSource(69) }));
        expect(m).toEqual({ walker: 'no live teleporter resolved for the exit' });
    });

    it('an unregistered verb is refused BY THE SOLVER\'S REASON (`no-verb`), never handed over', () => {
        // the controller row as the world lists it; OFF the `lights` row is absent from the tables
        const controller = { id: 'lightbosscontroller@72,72', x: 72, y: 72, tag: 0, flierNum: 6, cleared: false };
        const exit = FIGHT_EXITS[0].exitOf(controller);
        const m = withContactFidelity({ lightsBossFight: false }, () => fightExitGoal(EXIT, { level: 69 }, { controller, exit }));
        expect(m.goal).toBeUndefined();
        expect(m.refusal).toEqual({ kind: 'clear-tag', reason: 'no-verb', flag: { level: 69, tag: 0 }, id: controller.id });
        expect(m.walker).toMatch(/no strategy row exists for solid:lightbosscontroller/);
    });

    it('solverGoalFor reads the world it is handed (no controllers listed → the old refusal)', () => {
        expect(solverGoalFor(EXIT, { run: { level: 69, world: { teleporters: [] } }, resolved: { allowTeleporter: null } }))
            .toEqual({ walker: 'no live teleporter resolved for the exit' });
        expect(solverGoalsOf({ kind: 'reach-exit', exit: { x: 1, y: 2 } })).toEqual([{ kind: 'reach-exit', exit: { x: 1, y: 2 } }]);
    });
});
