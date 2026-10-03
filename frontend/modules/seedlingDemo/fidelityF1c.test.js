/**
 * fidelityF1c — Seedling fidelity F1c: the press kill survives any HAMMER
 * PHASE (the HAMMER-PHASE rung, `solverBot.hammerPhaseRung`).
 *
 * F1b measured the wall: on `r9-solve-18`'s committed staging, moving
 * `seam.time` alone across the 45 residues of `Game.time mod 45` (the phase
 * `spinner.hammerLine` swings at) refused 12 of them `HAMMER_SAFETY`, among
 * them residue 42 — the one the campaign chain's re-record puts L18 at. There
 * the press lands at t234, the knocked-back body comes off the wall, and at
 * t249 every key set meets the line: a corner deeper than `stepToward`'s
 * lookahead. The rung previews the executor's own approach one hammer period
 * ahead and, cornered, searches a hold that meets the line at another phase.
 *
 * Every residue below is DERIVED from the committed tape's own clock: the
 * shift that puts it at residue r is `((r − time mod 45) mod 45) − 45`.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the rung off (`hammerPhaseRung` returns `{fired: false}`)
 *        -> the chain-residue row red (HAMMER_SAFETY, "There is no step out.");
 *           the committed-walk row and the remainder row stay green
 *
 * D2 (the spinner arm's declared spelling) is a GAME MEASUREMENT here, not a
 * fix: `f1c-l18-lock-removal` (recorded twice) crosses on the tick the model
 * reaches only under `{18,0}@416`, one tick before the v9 spelling of the
 * spinner ledger's own removal and two before the arm's `removal + 101`. The
 * fix (the ledger's stamp and the spelling) moves every generated spinner
 * kill-lock certification and the `r8-d2` cascade, which the brief did not
 * license, so it is a STOP with the measured moved set in the F1c report; the
 * D2 rows below pin the MEASUREMENT, and name the model's two readings as
 * refuted rather than treating either as right.
 */
import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { HAMMER_PHASE_RUNG, HAMMER_SAFETY } from './solverBot.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import { RESPONDERS, opensOnTick } from './activators.js';

const NAME = 'r9-solve-18';
const TAPE = loadTape(NAME);
const STAGING = stagingFromTape(TAPE);
const PERIOD = SPINNER.hammerPeriod;
const RESIDUE = ((STAGING.seam.time % PERIOD) + PERIOD) % PERIOD;
/** The chain's L18 residue after F1b's window-5 re-solve (F1b D2: 17 → 42). */
const CHAIN_RESIDUE = 42;
/** A residue the rung names rather than solves: a landing's rebound (the sweep's 18–21). */
const REBOUND_RESIDUE = 18;
const shiftTo = (r) => ((((r - RESIDUE) % PERIOD) + PERIOD) % PERIOD) - PERIOD;
const TELEPORTER = { x: 176, y: 112 };

/** `twoPassSolve` exactly as `solve-seedling-r9-campaign` calls it, at a shifted clock. */
async function solveAt(shift) {
    const seam = { ...STAGING.seam, time: STAGING.seam.time + shift };
    const makeRun = (persistence) => createRunForStaging(
        { ...STAGING, seam, persistence, equips: [] }, atlasLevelSource());
    return twoPassSolve({
        makeRun,
        goals: [{ kind: 'reach-exit', exit: TELEPORTER }],
        name: NAME,
        boot: STAGING.boot,
        persistence: STAGING.persistence.filter((c) => c.at === undefined),
        gameTick: async () => { throw new Error('no game oracle here'); },
    });
}

const pressRecords = (out) => (out.records ?? []).filter((r) => r.arm === 'press');

describe('F1c D1 — the HAMMER-PHASE rung (r9-solve-18 across the hammer\'s phases)', () => {
    it('⛓ its bounds are the hammer\'s own: one period of horizon, every other phase of hold, one stall per landing', () => {
        expect(HAMMER_PHASE_RUNG).toEqual({
            horizon: PERIOD,
            maxTicks: PERIOD - 1,
            step: 1,
            maxPerKill: SPINNER.hitsMax,
        });
    });

    it('⛓⛓ at the committed residue the rung never fires: the committed walk, key for key', async () => {
        const r = await solveAt(0);
        expect(r.out.perTick.length).toBe(TAPE.tick_count);
        for (let t = 0; t < TAPE.tick_count; t += 1) {
            expect([...r.out.perTick[t]].sort()).toEqual([...heldKeysAt(TAPE, t)].sort());
        }
        expect(pressRecords(r.out).every((p) => p.phaseStalls === undefined)).toBe(true);
    }, 120_000);

    it('⛓⛓⛓ at the chain\'s residue the press kill SOLVES: a stall meets the line at another phase, no hit, the crossing to L19', async () => {
        const shift = shiftTo(CHAIN_RESIDUE);
        const r = await solveAt(shift);
        const stalls = pressRecords(r.out).flatMap((p) => p.phaseStalls ?? []);
        expect(stalls.length).toBeGreaterThan(0);
        for (const s of stalls) {
            expect(s.corner).toBeGreaterThan(s.from);
            expect(s.ticks).toBeGreaterThanOrEqual(1);
            expect(s.ticks).toBeLessThanOrEqual(HAMMER_PHASE_RUNG.maxTicks);
            expect(s.corner - s.t).toBeLessThan(HAMMER_PHASE_RUNG.horizon);
        }
        const run = createRunForStaging({ ...STAGING, seam: { ...STAGING.seam,
            time: STAGING.seam.time + shift }, persistence: r.persistence, equips: [] },
        atlasLevelSource());
        for (const held of r.out.perTick) run.advance(held);
        expect(run.playerHits).toEqual([]);
        expect(run.transitions.map((x) => x.to_level)).toEqual([TAPE.boot.level + 1]);
    }, 300_000);

    it('⛓ the remainder is NAMED: a residue whose corner a landing\'s rebound makes refuses with the landing in its words', async () => {
        let raised = null;
        try { await solveAt(shiftTo(REBOUND_RESIDUE)); } catch (e) { raised = e; }
        expect(raised?.code).toBe(HAMMER_SAFETY);
        expect(raised.message).toMatch(/There is no step out\./);
        expect(raised.message).toMatch(/LANDED at t\d+: a landing's knockback is player-coupled/);
        expect(raised.message).toMatch(/HAMMER_PHASE_RUNG/);
    }, 300_000);
});

/** Replay a committed tape's keys under a persistence block; the run. */
function replay(name, persistence = null) {
    const tape = loadTape(name);
    const st = stagingFromTape(tape);
    const run = createRunForStaging({ ...st, ...(persistence ? { persistence } : {}) },
        atlasLevelSource());
    for (let t = 0; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t));
    return run;
}

describe('F1c D1 — the game witness of the chain-residue solve (f1c-l18-phase42, recorded twice)', () => {
    const WITNESS = 'f1c-l18-phase42';
    it('⛓⛓ the witness IS the chain-residue staging: the committed boot with only the clock moved', () => {
        const w = stagingFromTape(loadTape(WITNESS));
        expect(((w.seam.time % PERIOD) + PERIOD) % PERIOD).toBe(CHAIN_RESIDUE);
        expect({ ...w.seam, time: null }).toEqual({ ...STAGING.seam, time: null });
        expect(w.rng).toEqual(STAGING.rng);
        expect(w.boot).toEqual(STAGING.boot);
    });

    it('⛓⛓ replayed, no hammer and no body touches the player, and it crosses when the game did', () => {
        const run = replay(WITNESS);
        expect(run.playerHits).toEqual([]);
        expect(run.spinnerContacts).toEqual([]);
        expect(run.transitions.map((x) => x.t))
            .toEqual(loadExpectation(WITNESS).stream.transitions.map((x) => x.t));
    });
});

describe('F1c D2 — L18\'s spinner kill lock, asked of the game (f1c-l18-lock-removal, recorded twice)', () => {
    const WITNESS = 'f1c-l18-lock-removal';
    const GAME_AT = loadTape(WITNESS).persistence.find((p) => p.level === 18 && p.tag === 0).at;
    const GAME_CROSSING = loadExpectation(WITNESS).stream.transitions.map((x) => x.t);
    const untimed = stagingFromTape(loadTape(WITNESS)).persistence.filter((p) => p.at === undefined);
    const at = (n) => untimed.concat([{ level: 18, tag: 0, at: n }]);
    const removal = replay(WITNESS).ledger('spinnerKillLockOpens')
        .filter((o) => !o.nil && o.level === 18).map((o) => o.t);
    const V9_FADE = opensOnTick(RESPONDERS.lock.fade) - 1;

    it('⛓⛓ under the game-sourced declaration the model crosses when the game did', () => {
        expect(replay(WITNESS).transitions.map((x) => x.t)).toEqual(GAME_CROSSING);
    });

    it('⛓⛓ the model\'s own readings are REFUTED: the v9 spelling of its ledger crosses one tick late, the arm\'s removal + 101 two', () => {
        expect(removal.length).toBe(1);
        const v9 = replay(WITNESS, at(removal[0] + V9_FADE)).transitions.map((x) => x.t);
        const arm = replay(WITNESS, at(removal[0] + V9_FADE + 1)).transitions.map((x) => x.t);
        expect(v9).toEqual(GAME_CROSSING.map((t) => t + 1));
        expect(arm).toEqual(GAME_CROSSING.map((t) => t + 2));
    });

    it('⛓ the gap is ONE ledger step: the game\'s tick is the spinner ledger\'s stamp − 1, spelled v9', () => {
        expect(GAME_AT).toBe(removal[0] - 1 + V9_FADE);
    });
});

