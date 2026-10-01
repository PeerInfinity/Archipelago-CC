/**
 * ⛓⛓ SEEDLING SWIM U5, D1 — THE `encounter` GOAL.
 *
 * L32's `Level 032 - Bob Boss` is a DROP, not a placement: `BobBoss.death`
 * spawns the Fire at runtime, so the U2–U4 survey's `collect-placement
 * (64,128)` resolved to nothing. The goal kind says what the location is.
 *
 * ⛔ AND IT REFUSES, BY NAME, BEFORE A TICK — because the model does not
 * simulate the fight. That is measured, not assumed. The last describe block
 * replays `r5-bobboss-fire` through the model and pins what the model does NOT
 * do: the arena's `fallrocklarge` never falls, no dead span beyond the level
 * load, and no `hasFire`. Those rows are the guard on `ENCOUNTER_EXECUTORS`
 * being empty. The day the model simulates the fight they go red, and the
 * executor is owed.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { ENCOUNTER_EXECUTORS, assertGoal, solveSegment } from './solverBot.js';
import { ARENA } from './bobBoss.js';

const TAPE = JSON.parse(readFileSync(
    new URL('./fixtures/tapes/r5-bobboss-fire.json', import.meta.url), 'utf8'));
/** The survey's step-30 goal, as `survey-seedling-route.mjs --through=2.2` hands it. */
const L32_GOAL = Object.freeze({
    kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit',
});

describe('assertGoal — encounter', () => {
    it('accepts the L32 goal and a `then: null` one', () => {
        expect(assertGoal(L32_GOAL, 0)).toBe(L32_GOAL);
        const terminal = { ...L32_GOAL, then: null };
        expect(assertGoal(terminal, 0)).toBe(terminal);
    });

    it('refuses a missing anchor, a missing drop, and a `then` it does not own', () => {
        expect(() => assertGoal({ ...L32_GOAL, at: undefined }, 0))
            .toThrow(/encounter needs at \{x, y\}/);
        expect(() => assertGoal({ ...L32_GOAL, drop: {} }, 0))
            .toThrow(/encounter needs at \{x, y\}/);
        expect(() => assertGoal({ ...L32_GOAL, then: 'reach-exit' }, 0))
            .toThrow(/then 'reach-pit' \| null/);
        expect(() => assertGoal({ ...L32_GOAL, then: undefined }, 0))
            .toThrow(/then 'reach-pit' \| null/);
    });

    it('the unknown-kind refusal lists every kind the solver owns', () => {
        expect(() => assertGoal({ kind: 'reach-cell' }, 0))
            .toThrow(/'reach-exit', 'reach-pit', 'collect-placement' and 'encounter'/);
    });
});

describe('solveSegment — encounter L32 from the survey boot (72,120), sword granted', () => {
    const l32Run = () => {
        const staging = solveStaging(stagingFromTape(parseTape(TAPE)));
        expect(staging.boot).toEqual({ level: ARENA.level, ...ARENA.boot });
        return { run: createRunForStaging(staging, atlasLevelSource()), boot: staging.boot };
    };

    it('⛔ refuses BY NAME, before a tick: no executor for a Fire drop, because the model has no fight', () => {
        const { run, boot } = l32Run();
        let err = null;
        try {
            solveSegment({ run, goals: [{ ...L32_GOAL }], name: 'u5-encounter', boot });
        } catch (e) { err = e; }
        expect(err?.name).toBe('SolverRefusal');
        expect(err.message).toMatch(/^solverBot\(u5-encounter\) encounter \(64,128\)->Fire: no encounter executor is registered for a 'Fire' drop in level 32\./);
        expect(err.message).toMatch(/DIVERGES from the game at t=15, the arm frame/);
        expect(err.obstacle).toEqual({ kind: 'unmodelled-encounter', id: 'encounter@64,128' });
        expect(run.ticksCompleted).toBe(0);
    });

    it('the registry is the gate: no Fire row', () => {
        expect(Object.keys(ENCOUNTER_EXECUTORS)).not.toContain('Fire');
    });
});

describe('⛔ why the registry is empty: the model does not play r5-bobboss-fire', () => {
    const replay = () => {
        let hasFire = false;
        let last = null;
        runTape(TAPE, {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => {
                last = run;
                if (run.progress('inventory')?.hasFire) hasFire = true;
            },
        });
        return { run: last, hasFire };
    };

    it('the arena rock never falls, nothing freezes the run past the load, and Fire is never earned', () => {
        const { run, hasFire } = replay();
        expect(run.world.fallRocks.map((r) => r.id)).toEqual(['fallrocklarge@64,128']);
        expect(run.rockFalls).toEqual([]);
        expect(run.deadFrameSpans.map((s) => s.kind)).toEqual(['load']);
        expect(hasFire).toBe(false);
    });
});
