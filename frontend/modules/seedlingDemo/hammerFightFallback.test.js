/**
 * hammerFightFallback — SEEDLING HAMMER-PHASE B3: the REPLAY REWIND (on `solveSegment`'s `forkRun`, `replayToTick`)
 * and the fight as a FALLBACK where today's press kill refuses (`HAMMER_FIGHT_FALLBACK`).
 *
 * ⚖ The user (2026-10-10): *"run the fight search only where today's path refuses … can only add solves"*, and
 * *"Yes, please fold replay rewind into B3."* — behind its own flag, OFF by default.
 *
 * The refusing fixture is L18's `r9-solve-18` staging with `HAMMER_ESCAPE` off: ten of its 45 hammer residues refuse
 * *"There is no step out."* (`HAMMER_SAFETY`, F1c's measurement), residue 4 among them. The admission arm's fixture is
 * a generated certify record (`fixtures/hammer-b3-admission-c3.json`, empty pairs c3's n387).
 *
 * ── THE MUTATION LIST (run during development; each row's catcher named) ──
 *
 *   m1 the rewind's factory built without the pass's persistence (`twoPassSolve`: `makeRun([])`) -> the exactness row
 *      (and `check-seedling-rewind-exactness --row=l18`: 5 mismatches)
 *   b3b-m2 the prefix replay dropped (`replayTo`: `from: prefix.length` on the boot factory) -> the b3b prefix row
 *      (and `check-seedling-rewind-exactness --row=fork-prefix`)
 *   m2 the "replace only if it solves" check removed (a failed retry adopted) -> the refusal-stands row
 *   m3 the trigger widened to every refusal -> the trigger row
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { ENTITY_FAMILY_NAMES, LEDGER_KIND_NAMES, PROGRESS_FIELD_NAMES } from './levelRun.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { forkRunFor, replayTape } from './jsRuntimeSolver.js';
import { CRUSHER_WITNESSES, crusherStaging } from '../../../scripts/procgen/plan-seedling-crusher-witness.mjs';
import { twoPassSolve } from './twoPassSolve.js';
import { solve } from './procgenOracle.js';
import { SPINNER } from './spinner.js';
import {
    FIGHT_FALLBACK_CODES, HAMMER_ESCAPE, HAMMER_FIGHT, HAMMER_FIGHT_BOUNDS, HAMMER_FIGHT_FALLBACK, HAMMER_SAFETY, REWIND_PROBE,
    STRIKE_BOUND_EXHAUSTED, SolverBotError, SolverRefusal, isFightFallbackRefusal, replayToTick, withHammerEscape,
    withHammerFight, withHammerFightFallback,
} from './solverBot.js';

const SOURCE = atlasLevelSource();
const R9 = stagingFromTape(loadTape('r9-solve-18'));
const seamAt = (residue) => {
    const P = SPINNER.hammerPeriod;
    const was = ((R9.seam.time % P) + P) % P;
    return { ...R9.seam, time: R9.seam.time + ((((residue - was) % P) + P) % P) - P };
};
const solveR9At = (residue) => {
    const seam = seamAt(residue);
    const makeRun = (persistence) => createRunForStaging({ ...R9, seam, persistence, equips: [] }, SOURCE);
    return twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: 'r9-solve-18',
        boot: R9.boot, persistence: R9.persistence.filter((c) => c.at === undefined),
        gameTick: async () => { throw new Error('no game oracle here'); } });
};
const keys = (perTick) => perTick.map((h) => [...h].sort().join('+')).join(',');
const refusalOf = async (p) => p.then(() => null, (e) => e);

/** The observable state of a run, as text (the exactness gate's fingerprint, `rewindExactnessHook.js`). */
const fingerprint = (run) => JSON.stringify({
    t: run.ticksCompleted, level: run.level, state: run.state, clock: run.gameTimeAt(0),
    entities: ENTITY_FAMILY_NAMES.map((n) => run.entities(n)),
    progress: PROGRESS_FIELD_NAMES.map((n) => run.progress(n)),
    ledgers: LEDGER_KIND_NAMES.map((n) => run.ledger(n)),
}, (_k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v));

const ADMISSION = JSON.parse(readFileSync(new URL('./fixtures/hammer-b3-admission-c3.json', import.meta.url), 'utf8'));
const solveAdmission = () => solve(ADMISSION.levelRecord, ADMISSION.staging, ADMISSION.goals, ADMISSION.budget,
    ADMISSION.opts);
const KILLLOCK = JSON.parse(readFileSync(new URL('./fixtures/hammer-b3-admission-c4-killlock.json', import.meta.url),
    'utf8'));
const solveKillLock = () => solve(KILLLOCK.levelRecord, KILLLOCK.staging, KILLLOCK.goals, KILLLOCK.budget,
    KILLLOCK.opts);

describe('hammer-phase B3 — the replay rewind', () => {
    it('⛓⛓⛓ the rewound run IS the live run: at every kill start and every 50th tick of a solve, byte for byte', async () => {
        const seen = [];
        REWIND_PROBE.ticks = { has: (t) => t > 0 && t % 50 === 0 };
        REWIND_PROBE.sink = (p) => seen.push({ t: p.t, kind: p.kind, live: fingerprint(p.live),
            back: fingerprint(p.rewound()) });
        try {
            await solveR9At(40);
        } finally {
            REWIND_PROBE.ticks = null;
            REWIND_PROBE.sink = null;
        }
        expect(seen.filter((p) => p.kind === 'kill-start').length).toBeGreaterThan(0);
        expect(seen.filter((p) => p.kind === 'tick').length).toBeGreaterThanOrEqual(10);
        for (const p of seen) expect(p.back, `t${p.t} (${p.kind})`).toBe(p.live);
    }, 300_000);

    it('⛓⛓ `replayToTick` replays keys, equips before their tick and takes after it, and refuses a factory from another state', () => {
        const make = () => createRunForStaging({ ...R9, seam: seamAt(40), equips: [] }, SOURCE);
        const straight = make();
        const perTick = Array.from({ length: 30 }, (_, t) => new Set(t % 3 ? ['right'] : ['down']));
        perTick.slice(0, 20).forEach((h) => straight.advance(h));
        expect(fingerprint(replayToTick({ makeRun: make, perTick, to: 20 }))).toBe(fingerprint(straight));
        expect(() => replayToTick({ makeRun: make, perTick, to: 31 })).toThrow(/outside the replayable span/);
        expect(() => replayToTick({ makeRun: () => { const r = make(); r.advance(new Set()); return r; },
            perTick, to: 5 })).toThrow(/must build the run the segment was handed/);
    }, 300_000);

    it('⛓⛓ b3b — on a BOOT factory the prefix is replayed too (the factory re-makes the PLAY\'s equips); skipping it is refused by the clock check', async () => {
        // The JS worker's factory (`forkRunFor`): a boot run whose first `prefixLength` advances re-make the PLAY's
        // equips. The staging is the JS arc's own fork fixture (`jsRuntimeSolverForkRun`: L42's arrival, two slots).
        const staging = await crusherStaging(CRUSHER_WITNESSES[0]);
        const perTick = Array.from({ length: 30 }, (_, t) => new Set(t < 6 ? ['left'] : ['up']));
        const play = new Map([[3, 1]]);
        const straight = replayTape({ staging, perTick: perTick.slice(0, 10), levelSource: SOURCE, equips: play });
        const handover = { at: 10, ticks: straight.ticksCompleted };
        perTick.slice(10, 20).forEach((h) => straight.advance(h));
        const makeRun = forkRunFor({ staging, levelSource: SOURCE, equips: play, prefixLength: 10 });
        expect(fingerprint(replayToTick({ makeRun, perTick, to: 20, handover }))).toBe(fingerprint(straight));
        // the control: the same factory without the play's equip is another run
        expect(fingerprint(replayToTick({ makeRun: forkRunFor({ staging, levelSource: SOURCE }), perTick, to: 20,
            handover }))).not.toBe(fingerprint(straight));
        // the mutant b3b-m2 (the prefix replay dropped: `from: prefix.length` on a boot factory) is refused by name
        expect(() => replayToTick({ makeRun, perTick, from: 10, to: 20, handover }))
            .toThrow(/must build the run the segment was handed/);
    }, 300_000);
});

describe('hammer-phase B3 — HAMMER_FIGHT_FALLBACK (OFF by default)', () => {
    it('⛓⛓ OFF by default, rewind mode by default, the switch restores; the trigger is the two press-kill codes', () => {
        expect(HAMMER_FIGHT_FALLBACK.enabled).toBe(false);
        expect(HAMMER_FIGHT_FALLBACK.mode).toBe('rewind');
        withHammerFightFallback(true, () => {
            expect(HAMMER_FIGHT_FALLBACK.enabled).toBe(true);
            expect(HAMMER_FIGHT_FALLBACK.mode).toBe('whole');
        }, 'whole');
        expect(HAMMER_FIGHT_FALLBACK).toEqual({ enabled: false, mode: 'rewind' });
        expect(FIGHT_FALLBACK_CODES).toEqual([HAMMER_SAFETY, STRIKE_BOUND_EXHAUSTED]);
        expect(isFightFallbackRefusal(new SolverBotError('x', { code: HAMMER_SAFETY }))).toBe(true);
        expect(isFightFallbackRefusal(new SolverBotError('x', { code: STRIKE_BOUND_EXHAUSTED }))).toBe(true);
        expect(isFightFallbackRefusal(new SolverBotError('x'))).toBe(false);
        expect(isFightFallbackRefusal(new SolverRefusal('x'))).toBe(false);
        const answered = new SolverBotError('x', { code: HAMMER_SAFETY });
        answered.fightFallback = { verdict: 'refused' };
        expect(isFightFallbackRefusal(answered)).toBe(false);
    }, 300_000);

    it('⛓⛓⛓ a refusal today, OFF: the refusal is byte-identical and carries no fallback; ON: the rewind retry SOLVES it, keys = the fight\'s', async () => {
        await withHammerEscape(false, async () => {
            const off = await refusalOf(solveR9At(4));
            expect(off).toBeInstanceOf(SolverBotError);
            expect(off.code).toBe(HAMMER_SAFETY);
            expect(off.message).toMatch(/There is no step out\. The corner formed/);
            expect(off.message).not.toMatch(/HAMMER_FIGHT_FALLBACK/);
            expect(off.fightFallback).toBe(undefined);
            const on = await withHammerFightFallback(true, () => solveR9At(4));
            expect(on.out.fightFallbacks).toEqual([{ t: 0, how: 'rewind', refused: HAMMER_SAFETY, refusedAt: 267,
                bodies: ['spinner@48,96', 'spinner@112,48'], verdict: 'solved', ticks: 324, fights: 1 }]);
            const kill = on.out.records.find((r) => r.strategy === 'kill');
            expect(kill.fightFallback.verdict).toBe('solved');
            expect(on.out.perTick.length).toBe(349);
            expect(on.passes.at(-1)).toMatchObject({ kind: 'solve', ticks: 349, fightFallbacks: 1 });
            const fight = await withHammerFight(true, () => solveR9At(4));
            expect(keys(on.out.perTick)).toBe(keys(fight.out.perTick));
            // the whole-solve retry reaches the same verdict and keys, recorded as passes
            const whole = await withHammerFightFallback(true, () => solveR9At(4), 'whole');
            expect(keys(whole.out.perTick)).toBe(keys(fight.out.perTick));
            expect(whole.passes.filter((p) => p.kind === 'fight-fallback').map((p) => [p.how, p.verdict]))
                .toEqual([['whole', 'solved'], ['whole', 'solved'], ['whole', 'solved']]);
            expect(whole.out.fightFallbacks).toBe(undefined);
        });
    }, 300_000);

    it('⛓⛓⛓ a retry that does not solve is UNDONE: the original refusal stands, its words unchanged plus one sentence', async () => {
        await withHammerEscape(false, async () => {
            const off = await refusalOf(solveR9At(4));
            HAMMER_FIGHT.bounds = { ...HAMMER_FIGHT_BOUNDS, maxExpansions: 1 };
            let on;
            try {
                on = await refusalOf(withHammerFightFallback(true, () => solveR9At(4)));
            } finally {
                HAMMER_FIGHT.bounds = null;
            }
            expect(on).toBeInstanceOf(SolverBotError);
            expect(on.code).toBe(off.code);
            expect(on.message.startsWith(`${off.message} The fight fallback (\`HAMMER_FIGHT_FALLBACK\`) rewound to `
                + 'the kill\'s first tick (t0) and redid the kill with the fight on; it did not solve (HAMMER_SAFETY: '))
                .toBe(true);
            expect(on.fightFallback).toMatchObject({ t: 0, how: 'rewind', refused: HAMMER_SAFETY, refusedAt: 267,
                verdict: 'refused', retryRefused: HAMMER_SAFETY });
        });
    }, 300_000);

    it('⛓⛓⛓ a success never asks it: ON, a solve that succeeds today is byte-identical and records nothing', async () => {
        expect(HAMMER_ESCAPE.enabled).toBe(true);
        const off = await solveR9At(40);
        const on = await withHammerFightFallback(true, () => solveR9At(40));
        expect(keys(on.out.perTick)).toBe(keys(off.out.perTick));
        expect(JSON.stringify(on.out.records)).toBe(JSON.stringify(off.out.records));
        expect(JSON.stringify(on.passes)).toBe(JSON.stringify(off.passes));
        expect(on.out.fightFallbacks).toBe(undefined);
        expect(Object.keys(on.out)).toEqual(Object.keys(off.out));
    }, 300_000);

    it('⛓⛓ inert while the fight itself is on (the retry would be the same path)', async () => {
        const fight = await withHammerFight(true, () => solveR9At(4));
        const both = await withHammerFight(true, () => withHammerFightFallback(true, () => solveR9At(4)));
        expect(keys(both.out.perTick)).toBe(keys(fight.out.perTick));
        expect(both.out.fightFallbacks).toBe(undefined);
    }, 300_000);

    it('⛓⛓⛓ the admission arm: a ladder whose last rung (the press arm) refused its admission is SOLVED with the fight on; OFF unchanged', () => {
        const off = solveAdmission();
        expect(off.verdict).toBe('REFUSED');
        expect(off.reasonText).toMatch(/the combat ladder is EXHAUSTED/);
        expect(off.reasonText).toMatch(/kill: spinner@16,64 is a live Spinner, and the press arm refused/);
        expect(off.reasonText).not.toMatch(/HAMMER_FIGHT_FALLBACK/);
        const on = withHammerFightFallback(true, solveAdmission);
        expect(on.verdict).toBe('SOLVED');
        expect(on.ticks).toBe(withHammerFight(true, solveAdmission).ticks);
        expect(on.fightFallbacks).toEqual([{ t: 0, how: 'admission', refused: 'PRESS_ADMISSION',
            bodies: ['spinner@16,64'], verdict: 'solved', ticks: 55, fights: 1 }]);
    }, 300_000);

    it('⛓⛓⛓ the admission arm at the kill-lock order: "no weapon" (every arm refused) is SOLVED with the fight on; OFF unchanged', () => {
        const off = solveKillLock();
        expect(off.verdict).toBe('REFUSED');
        expect(off.reasonText).toMatch(/the kill work order has no weapon — no \(cell, tick\) in level 900/);
        expect(off.reasonText).not.toMatch(/HAMMER_FIGHT_FALLBACK/);
        const on = withHammerFightFallback(true, solveKillLock);
        expect(on.verdict).toBe('SOLVED');
        expect(on.ticks).toBe(withHammerFight(true, solveKillLock).ticks);
        expect(on.fightFallbacks).toEqual([{ t: 0, how: 'admission', refused: 'PRESS_ADMISSION',
            bodies: ['spinner@80,80', 'spinner@80,112'], verdict: 'solved', ticks: 569, fights: 1 }]);
    }, 300_000);
});
