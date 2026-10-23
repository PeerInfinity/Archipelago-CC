/**
 * Seedling fidelity ROPE (wave 22): the `rope` verb — a `RopeStart` CUT on purpose, behind
 * `CONTACT_FIDELITY.ropeCutVerb` (OFF).
 *
 *   · D1 (the game): rules-2's rope-events game probe (7 tapes; it lands with `rules-rope-events`) + fidelity F7's `probe-seedling-f7-reentry.mjs`
 *     witness the cuts themselves; `fixtures/rope-witness/` (`probe-seedling-rope-verb.mjs --record`, p4g) are THIS
 *     verb's own plans played on the game, replayed here against the model at 0 px.
 *   · D2 (the verb): `OBSTACLE_STRATEGIES['solid:rope'] = 'rope'` and `STRATEGY_EXECUTORS.rope = execRope`, switch-gated
 *     rows (non-enumerable, absent OFF); the stance is the PULL rung's (`deriveSwingStance` + `pullStanceAdmit`), the
 *     act `execPull`; a clear-tag on the rope's tag finishes on the run's `ropePulls` row (a cut is no `earnedClears`
 *     row — `levelRun.earnedClearsNow` has no rope arm).
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 `execRope`'s `ropePulls` assertion inverted (`if (pulled)`)
 *        -> "the verb's own swing" reds: the refusal "holds no pull of rope@32,16".
 *   m2 `ropeWritten` dropped from `written()` (`?? null` only)
 *        -> every ON SOLVES row reds with `not-written` (the cut is never read as written).
 *   m3 the `bootPulled` arm in `execClearTag` removed
 *        -> "a rope booted pulled is already-clear" reds: `cannot-act` ("already pulled").
 *   m4 the weapon gate removed from `resolveRopeStrategy`
 *        -> "no sword: cannot-act" reds: the walk to the stance runs and the swing never lands (refused later, other
 *           reason).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { OBSTACLE_STRATEGIES, solveSegment, SolverRefusal, STRATEGY_EXECUTORS } from './solverBot.js';
import { clearTagVerbOf } from './jsRuntimeSolver.js';
import { ROPE_WITNESS_DIR, ROPE_WITNESSES, compareWitness, modelSamples, ropePlan } from './fidelityRope.js';

const SRC = atlasLevelSource();
const L16 = Object.freeze({ kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' });
const L28 = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const FROM_L15 = Object.freeze({ level: 16, x: 32, y: 64 });
const FROM_L25 = Object.freeze({ level: 28, x: 96, y: 16 });

const solve = (boot, goal, { items = ['hasSword'], cleared = [] } = {}) => {
    const run = createRunForStaging(arrivalStaging(boot, { items, cleared }), SRC);
    try {
        const out = solveSegment({ run, goals: [{ ...goal }], name: `rope-row-${boot.level}`, boot });
        return { run, out, refusal: null };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e };
    }
};
const ON = (fn) => withContactFidelity({ ropeCutVerb: true }, fn);
// ⛓ planning-9's flip (⚖ user "Yes, flip it", 2026-10-21): the switch is ON by default, so the OFF rows say so.
const OFF = (fn) => withContactFidelity({ ropeCutVerb: false }, fn);
const clearTagRow = (out) => out.records.find((r) => r.goal === 'clear-tag');

describe('fidelity ROPE — the switch', () => {
    it('is ON by default (planning-9\'s flip)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.ropeCutVerb).toBe(true);
        expect(CONTACT_FIDELITY.ropeCutVerb).toBe(true);
    });
    it('OFF: no row, no verb — the enumerated tables are what they were (the row is non-enumerable either way)', () => OFF(() => {
        expect(OBSTACLE_STRATEGIES['solid:rope']).toBeUndefined();
        expect(STRATEGY_EXECUTORS.rope).toBeUndefined();
        expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:rope');
        expect(Object.keys(STRATEGY_EXECUTORS)).not.toContain('rope');
        expect(clearTagVerbOf('solid:rope')).toEqual({ verb: null, registered: false });
    }));
    it('ON: `solid:rope` selects `rope`, registered — and the JS mapping reads it (`clearTagVerbOf`)', () => ON(() => {
        expect(OBSTACLE_STRATEGIES['solid:rope']).toBe('rope');
        expect(typeof STRATEGY_EXECUTORS.rope).toBe('function');
        expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:rope');
        expect(clearTagVerbOf('solid:rope')).toEqual({ verb: 'rope', registered: true });
    }));
    it('OFF: a clear-tag on L16\'s rope refuses `no-verb` by name', () => OFF(() => {
        const { refusal } = solve(FROM_L15, L16);
        expect(refusal.obstacle).toMatchObject({ kind: 'clear-tag', id: 'rope@32,16', reason: 'no-verb' });
        expect(refusal.message).toMatch(/no strategy row exists for solid:rope/);
    }));
});

describe('fidelity ROPE — D2: the clear-tag on a rope\'s own tag (the switch ON)', () => {
    it('L16 from the L15 arrival: {16,0} cut on the way to the stance (the walk\'s strike), 112 t, no hit', () => ON(() => {
        const { run, out, refusal } = solve(FROM_L15, L16);
        expect(refusal).toBeNull();
        expect(clearTagRow(out)).toMatchObject({ arm: 'cleared-in-passing', flag: { level: 16, tag: 0 },
            obstacle: 'rope@32,16', by: 'rope@32,16', ledgerAt: 90, confirmedAt: 112 });
        expect(out.perTick.length).toBe(112);
        expect(run.ledger('ropePulls')).toEqual([{ id: 'rope@32,16', level: 16, t: 90,
            flag: { level: 16, tag: 0, outOfBand: false } }]);
        expect(run.damage.hits).toBe(0);
        // ⛔ the measured gap the finish works round: the cut is no `earnedClears` row.
        expect(run.ledger('earnedClears').some((c) => c.level === 16 && c.tag === 0)).toBe(false);
    }));
    it('L16 from (72,40): the verb\'s own swing (`execPull`: aim, press t26), written t27, confirmed t28', () => ON(() => {
        const { run, out, refusal } = solve({ level: 16, x: 72, y: 40 }, L16);
        expect(refusal).toBeNull();
        expect(clearTagRow(out)).toMatchObject({ arm: 'verb', strategy: 'rope', verb: 'rope', pressedAt: 26,
            pulledAt: 27, confirmedAt: 28, group: 0,
            silenced: ['arrowtrap@96,32', 'arrowtrap@112,32', 'arrowtrap@128,32'] });
        expect(run.ledger('ropePulls').map((p) => p.id)).toEqual(['rope@32,16']);
    }));
    // ⛓ DRILLKILL's flip (⚖ user "Harvest + flip ON", 2026-10-23): ON the Sword kills L28's drills first (170 t,
    // `fidelityDrillKill.test.js`); the verb's own 52 t cut is read with drillKillFirst OFF.
    it('L28 from the L25 arrival: {28,0} cut, 52 t (drillKillFirst OFF)', () => ON(() => withContactFidelity({ drillKillFirst: false }, () => {
        const { run, out, refusal } = solve(FROM_L25, L28);
        expect(refusal).toBeNull();
        expect(clearTagRow(out)).toMatchObject({ arm: 'cleared-in-passing', flag: { level: 28, tag: 0 },
            ledgerAt: 44, confirmedAt: 52 });
        expect(run.ledger('ropePulls').map((p) => p.id)).toEqual(['rope@160,64']);
    })));
    it('a rope booted pulled (its tag cleared) is `already-clear`, no tick', () => ON(() => {
        const { out, refusal } = solve(FROM_L15, L16, { cleared: [0] });
        expect(refusal).toBeNull();
        expect(clearTagRow(out)).toMatchObject({ arm: 'already-clear' });
        expect(out.perTick.length).toBe(0);
    }));
    it.each([
        ['no item', [], /holds NOTHING/],
        ['the Spear alone', ['hasSpear'], /fires `spear`/],
    // ⛓ planning-10's ROPESTANCE flip: `ropeCutAnyWeapon` is ON by default (the Spear and Fire cut too —
    //   fidelityRopeStance's rows), so the sword-only refusal is read with it OFF.
    ])('%s: `cannot-act`, naming the sword swing this verb drives (ropeCutAnyWeapon OFF)', (_, items, why) => ON(() => withContactFidelity({ ropeCutAnyWeapon: false }, () => {
        const { refusal } = solve(FROM_L15, L16, { items });
        expect(refusal.obstacle).toMatchObject({ kind: 'clear-tag', id: 'rope@32,16', reason: 'cannot-act' });
        expect(refusal.message).toMatch(why);
    })));
});

describe('fidelity ROPE — D1: the verb\'s plans on the game (p4g), at 0 px', () => {
    const recorded = Object.fromEntries(ROPE_WITNESSES.map((w) => [w.name,
        JSON.parse(readFileSync(join(ROPE_WITNESS_DIR, `${w.name}.json`), 'utf8'))]));
    it('three witnesses, recorded on p4g', () => {
        expect(Object.keys(recorded)).toEqual(['rope-l16-cut-cross', 'rope-l16-verb', 'rope-l28-cut']);
        for (const r of Object.values(recorded)) expect(r.page).toBe('seedling_bot_ap_p4g');
    });
    for (const w of ROPE_WITNESSES) {
        it(`${w.name}: the solver plans the recorded tape today, and the model is the game on every tick`, async () => {
            const r = recorded[w.name];
            // ⛓ DRILLKILL's flip: the recorded rope-l28-cut is the cut WITHOUT the drill kill (52 t) — planned drillKillFirst OFF.
            const { tape } = await withContactFidelity({ drillKillFirst: false }, () => ropePlan(w));
            expect(tape.inputs).toEqual(r.tape.inputs);
            expect(tape.tick_count).toBe(r.tape.tick_count);
            const model = await modelSamples(r.tape);
            expect(compareWitness(r.samples, model.samples).slice(0, 6)).toEqual([]);
            // The game holds the rope's flag from the pull + 1 (the write is `hit()`'s, at the pull).
            const first = r.samples.find((s) => s.level === r.tape.boot.level && s.cleared.includes(0))?.t;
            expect(first).toBe(model.pulls[0].t + 1);
            expect(r.end.level).toBe(w.to);
            if (w.flags.includes(1)) expect(r.samples.find((s) => s.cleared.includes(1))?.t).toBe(first);
        }, 120000);
    }
});
