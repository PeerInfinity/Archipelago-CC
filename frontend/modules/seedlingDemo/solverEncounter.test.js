/**
 * ⛓⛓ SEEDLING SWIM U5, D1 — THE `encounter` GOAL.
 *
 * L32's `Level 032 - Bob Boss` is a DROP, not a placement: `BobBoss.death`
 * spawns the Fire at runtime, so the U2–U4 survey's `collect-placement
 * (64,128)` resolved to nothing. The goal kind says what the location is.
 *
 * D1 shipped the kind with an empty executor table, because the model then
 * simulated none of the fight. The BobBoss simulation family
 * (`bobBossFight.js`) landed after it, and the Fire's executor is registered
 * and SOLVES here from `r5-bobboss-fire`'s boot, in an honest run.
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
/** The survey's L32 encounter goal, as `survey-seedling-route.mjs --through=2.2` handed it at
 * step 30 (step 88 since the legs are the whole sphere order, which also adds `location`). */
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
        // ⛓ Fidelity CLEARTAG added `clear-tag` (`fidelityClearTag.test.js`).
        expect(() => assertGoal({ kind: 'reach-cell' }, 0))
            .toThrow(/'reach-exit', 'reach-pit', 'collect-placement', 'encounter' and 'clear-tag'/);
    });
});

describe('solveSegment — encounter L32 from r5-bobboss-fire\'s boot, honest, sword granted', () => {
    const l32Run = () => {
        const staging = solveStaging(stagingFromTape(parseTape(TAPE)));
        expect(staging.boot).toEqual({ level: ARENA.level, ...ARENA.boot });
        return { run: createRunForStaging(staging, atlasLevelSource()), boot: staging.boot };
    };

    it('⛓ SOLVES: arm, seven verified landings, fourteen pages, the Fire, the burn and the pit to L30, untouched', () => {
        const { run, boot } = l32Run();
        const out = solveSegment({ run, goals: [{ ...L32_GOAL }], name: 'u5-encounter', boot });
        // Measured (no shield here; the survey's shielded boot is 1056 and is the
        // committed witness `swim-u5-bobboss-encounter`).
        expect(out.perTick.length).toBe(1042);
        expect(run.level).toBe(30);
        expect(run.transitions).toEqual([{ t: 962, from_level: 32, to_level: 30 }]);
        expect(run.ledger('playerHits')).toEqual([]);
        expect(out.equips).toEqual([{ t: 826, slot: 1 }]);
        const strikes = out.records.filter((r) => r.leg === 'strike');
        expect(strikes.map((r) => r.form)).toEqual([0, 0, 1, 1, 1, 2, 2]);
        expect(strikes.filter((r) => r.killed).map((r) => r.form)).toEqual([0, 1, 2]);
        expect(out.records.find((r) => r.leg === 'drop')).toMatchObject({ landings: 7, pages: 14, t: 825 });
        expect(out.records.find((r) => r.leg === 'burn')).toMatchObject({ id: 'burnabletree@64,0' });
        expect(out.records.at(-1)).toEqual({ goal: 'reach-pit', to: 30, t: 962, coast: 80 });
        // The landings are the RUN's, read off the boss: one `boss-hit` row
        // with `landed` per strike, never a page.
        const landed = run.ledger('bobBossEvents').filter((r) => r.what === 'boss-hit' && r.landed);
        expect(landed.map((r) => r.form)).toEqual([0, 0, 1, 1, 1, 2, 2]);
        expect(run.ledger('bobBossEvents').filter((r) => r.flag).map((r) => r.what))
            .toEqual(['rock-armed', 'fire-removed']);
    }, 120_000);

    it('the registry holds Fire, and an unregistered drop refuses BY NAME before a tick', () => {
        expect(Object.keys(ENCOUNTER_EXECUTORS)).toEqual(['Fire']);
        const { run, boot } = l32Run();
        let err = null;
        try {
            solveSegment({ run, goals: [{ ...L32_GOAL, drop: { item: 'Moonrock' } }],
                name: 'u5-unregistered', boot });
        } catch (e) { err = e; }
        expect(err?.name).toBe('SolverRefusal');
        expect(err.message).toMatch(/no encounter executor is registered for a 'Moonrock' drop in level 32\./);
        expect(err.obstacle).toEqual({ kind: 'unmodelled-encounter', id: 'encounter@64,128' });
        expect(run.ticksCompleted).toBe(0);
    });
});

describe('⛓ the model plays r5-bobboss-fire (the BobBoss simulation family, swim U5)', () => {
    const replay = () => {
        let hasFireAt = null;
        let last = null;
        runTape(TAPE, {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => {
                last = run;
                if (hasFireAt === null && run.progress('inventory')?.hasFire) hasFireAt = t;
            },
        });
        return { run: last, hasFireAt };
    };

    it('the rock arms at t=12, three forms die, and the Fire is earned with both writes', () => {
        const { run, hasFireAt } = replay();
        const ev = run.ledger('bobBossEvents');
        expect(ev.find((r) => r.what === 'rock-armed')).toMatchObject(
            { t: 12, flag: { level: 32, tag: 1, value: false } });
        expect(ev.filter((r) => r.what === 'boss-hit' && r.killed).map((r) => r.form))
            .toEqual([0, 1, 2]);
        expect(ev.filter((r) => r.what === 'dialogue-open').map((r) => r.pages)).toEqual([3, 7, 4]);
        expect(ev.find((r) => r.what === 'fire-removed')).toMatchObject(
            { flag: { level: 31, tag: 29, value: false }, outOfBand: true });
        expect(hasFireAt).not.toBeNull();
        // The game's own dead-frame record for this tape is 345 = 21 boot
        // + 174 rock + 150 Fire phase A (`dead-frame-observations.json`).
        expect(run.deadFrameSpans.map((s) => [s.kind, s.frames]))
            .toEqual([['load', 20], ['freeze', 174], ['ceremony', 150]]);
    });
});
