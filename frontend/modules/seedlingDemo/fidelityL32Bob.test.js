/**
 * ⛓⛓ SEEDLING FIDELITY L32BOB (wave 32) — THE BOB BOSS FORECAST CARRIES THE SWING ALREADY IN FLIGHT
 * (`CONTACT_FIDELITY.encounterSwingInFlight`, OFF by default).
 *
 * W0. The JS arc's L32 Bob encounter declined from a staging with "the forecast landed form N's hit at +k and the
 * run's boss reports M landing(s) — the forecast and the run disagree" (`execBobBossEncounter`). Reproduced here on
 * `apb-l32-fresh-no-fire`'s staging solved as a CONTINUATION of its own tape: the first 380 ticks are the prefix,
 * and tick 376 is a press whose swing is still testing (`Player.slash()` tests on every tick `slashing` is up: T+1 …
 * T+5). The run fires that swing's T+5 test at t381 and it LANDS (form 1: 1 → 2 hits); the forecast built its tests
 * from an empty map, so it kept form 1 at 1 and landed its own press at +58: the run counts 2, and the executor
 * declines. The first disagreement is the FORECAST's (+1, the in-flight test).
 *
 * The game agrees with the run (p4g headless, `probe-seedling-encounter-ticks.mjs --tape=apb-l32-fresh-no-fire
 * --from=370 --to=560`, 191 sampled ticks, game and model boss rows 0 px apart): form 1 starts its death flight at
 * t426 on both, i.e. after its THIRD landing (t425), and the only presses form 1 took landed at 351, 381 and 425
 * (pinned below on the model's ledger, which reproduces the game there).
 *
 * D1. ON, `bobBossForecast()` hands out the run's `swordWindow` and a `slash` at a thrust's own scale, and
 * `forecastEncounterPlan` steps that window with `advance`'s own `swordWindowStep` / `swordWindowReplace` /
 * `swordWindowSchedule`; the executor checks the run's landings against every landing the forecast made through its
 * own press's. OFF: byte-identical (no `window`, the old decline text).
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the forecast ignores `fc.window` (`win` seeded EMPTY ON)
 *        -> "ON: the continuation solves" reds (the decline returns), and "the strike plan counts…" reds (landings 1).
 *   m2 the press does not REPLACE the in-flight window (no `swordWindowReplace`)
 *        -> no row reds at k 380 (the in-flight swing's last test is t381, before any press): NOT caught here; the
 *           targeted prefix census in the report (every in-swing prefix of the four L32 stagings) is its net.
 *   m3 the executor compares against 1 (the `plan.landings ?? 1` reverted)
 *        -> "ON: the continuation solves" reds with the decline text naming "(the forecast's landings: 2)".
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { searchEncounterStrike, solveSegment, SolverRefusal } from './solverBot.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';

const TAPE = JSON.parse(readFileSync(new URL('./fixtures/tapes/apb-l32-fresh-no-fire.json', import.meta.url), 'utf8'));
const SRC = atlasLevelSource();
const GOAL = Object.freeze({ kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: null });
/** The continuation's seam: the tape's own first 380 ticks (the press at 376 still testing). */
const K = 380;
const prefix = Array.from({ length: K }, (_, t) => new Set(heldKeysAt(TAPE, t)));
const staging = () => solveStaging(stagingFromTape(parseTape({ ...TAPE, tick_count: 0, inputs: [] })));

/** A run at the seam (the prefix replayed). */
function runAtSeam() {
    const run = createRunForStaging(staging(), SRC, { scratchPersistence: true });
    for (const h of prefix) run.advance(h);
    return run;
}
/** The encounter solved from the seam: the result, or the refusal. */
function solveFromSeam() {
    const run = runAtSeam();
    try {
        return { out: solveSegment({ run, goals: [{ ...GOAL }], name: 'l32bob', boot: staging().boot, prefix, dashMode: 'none' }), run };
    } catch (e) {
        if (e instanceof SolverRefusal) return { refusal: e, run };
        throw e;
    }
}
const landed = (run) => run.ledger('bobBossEvents').filter((r) => r.what === 'boss-hit' && r.landed);

describe('fidelity L32BOB — the swing in flight', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.encounterSwingInFlight).toBe(false);
    });

    it('W0 — the tape: form 1 lands at 351, 381 (press 376, its T+5) and 425 — the game\'s death flight starts at t426', () => {
        const run = createRunForStaging(staging(), SRC, { scratchPersistence: true });
        for (let t = 0; t < TAPE.tick_count; t += 1) run.advance(new Set(heldKeysAt(TAPE, t)));
        expect(landed(run).filter((r) => r.form === 1).map((r) => [r.pressTick, r.t])).toEqual([[348, 351], [376, 381], [420, 425]]);
    });

    it('W0 — the seam is inside the 376 swing (slashing, its window still testing)', () => {
        const run = runAtSeam();
        expect(run.ticksCompleted).toBe(K);
        expect(run.progress('slashInfo').state.slashing).toBe(true);
        const boss = run.entities('bobBoss').get('boss');
        expect([boss.form, boss.hits]).toEqual([1, 1]);
    });

    it('OFF: the continuation declines by the old text — the forecast lands +58, the run counts 2', () => {
        const { refusal } = withContactFidelity({ encounterSwingInFlight: false }, solveFromSeam);
        expect(refusal?.message).toMatch(/the forecast landed form 1's hit at \+58 and the run's boss reports 2 landing\(s\) — the forecast and the run disagree\.$/);
    });

    it('OFF: the forecast hands out no window, and the strike plan carries no count', () => {
        withContactFidelity({ encounterSwingInFlight: false }, () => {
            const run = runAtSeam();
            expect('window' in run.bobBossForecast()).toBe(false);
            const plan = searchEncounterStrike(run);
            expect(plan).toMatchObject({ n: 53, landedAt: 58 });
            expect('landings' in plan).toBe(false);
        });
    });

    it('ON: the strike plan counts the in-flight landing (2), and its own press is searched against the run\'s boss', () => {
        withContactFidelity({ encounterSwingInFlight: true }, () => {
            const run = runAtSeam();
            expect(run.bobBossForecast().window.repeats.length).toBeGreaterThan(0);
            expect(searchEncounterStrike(run)).toMatchObject({ n: 40, landedAt: 45, landings: 2 });
        });
    });

    it('ON: the continuation solves — both reports, untouched, still in L32', () => {
        const { out, refusal, run } = withContactFidelity({ encounterSwingInFlight: true }, solveFromSeam);
        expect(refusal?.message).toBeUndefined();
        expect(out.perTick.length - K).toBe(459);
        expect([run.apReportSlotHeld(32, 3), run.apReportSlotHeld(32, 4), run.level]).toEqual([false, false, 32]);
        expect(run.ledger('playerHits')).toHaveLength(0);
    });
});

/**
 * D2 — THE SOLVE, FROM EVERY L32 STAGING. The census (the report: every prefix of each staging's own solved plan that
 * ends inside a swing, 4 × 35) declines OFF at exactly three prefixes per staging — the three whose swing's T+5 test
 * still lands — and solves all 140 ON. One of each staging's three is pinned here, continued from its committed tape.
 */
const D2 = [
    // [tape, seam k, OFF's +landedAt]
    ['swim-u5-bobboss-encounter', 380, 58],
    ['enc-l32-live-arrival', 373, 58],
    ['enc-l32-fallen-door', 379, 58],
    ['apb-l32-fresh-fire-held', 380, 58],
];
function solveTapeSeam(name, k) {
    const tape = JSON.parse(readFileSync(new URL(`./fixtures/tapes/${name}.json`, import.meta.url), 'utf8'));
    const st = solveStaging(stagingFromTape(parseTape({ ...tape, tick_count: 0, inputs: [] })));
    const pre = Array.from({ length: k }, (_, t) => new Set(heldKeysAt(tape, t)));
    const run = createRunForStaging(st, SRC, { scratchPersistence: true });
    for (const h of pre) run.advance(h);
    try {
        solveSegment({ run, goals: [{ ...GOAL }], name: 'l32bob-d2', boot: st.boot, prefix: pre, dashMode: 'none' });
        return { run, refusal: null };
    } catch (e) {
        if (e instanceof SolverRefusal) return { run, refusal: e };
        throw e;
    }
}
describe('fidelity L32BOB D2 — every L32 staging, continued inside its form-1 swing', () => {
    it.each(D2)('%s @%i: OFF declines (+%i, 2 landings); ON both reports, untouched', (name, k, at) => {
        const off = withContactFidelity({ encounterSwingInFlight: false }, () => solveTapeSeam(name, k));
        expect(off.refusal?.message).toContain(`the forecast landed form 1's hit at +${at} and the run's boss reports 2 landing(s)`);
        const on = withContactFidelity({ encounterSwingInFlight: true }, () => solveTapeSeam(name, k));
        expect(on.refusal?.message).toBeUndefined();
        expect([on.run.apReportSlotHeld(32, 3), on.run.apReportSlotHeld(32, 4), on.run.level]).toEqual([false, false, 32]);
        expect(on.run.ledger('playerHits')).toHaveLength(0);
    });
});
