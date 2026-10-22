/**
 * Seedling fidelity ROPESTANCE (wave 23): the `rope` verb and the PULL rung cut a rope with the SPEAR and with FIRE,
 * behind `CONTACT_FIDELITY.ropeCutAnyWeapon` (OFF).
 *
 *   · W0: the run already cuts with all three weapons (`levelRun.pullRope` from the fire arm and the weapon-strike arm);
 *     the solver refused every run whose selected slot was not the sword.
 *   · D1 (the game): `fixtures/ropestance-witness/` (`probe-seedling-rope-stance.mjs --record`, p4g) — the solver's own
 *     plans played on the game, replayed here against the model at 0 px.
 *   · D2 (the verb): `resolveRopeCut` / `execRopeCut` — the selected Spear or Fire first, then held weapons by `equip`;
 *     the stances ranked and walked in order; the presses are `runSpear`'s / `runFire`'s `rope` targets.
 *   · D3 (the rung): the PULL rung's silencer cut takes the same arms; its post-condition stays the group's latch.
 *   · The drill INTERIM: L28's drills are not stepped by the model (`drillStateFor` admits a lone drill), so a rope stance
 *     and its walk keep out of an unstepped drill's trigger; the L28 spear from the L25 side refuses by name.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 `ropeCutWeapons` returns [] (no swordless weapon)
 *        -> every ON SOLVED row reds with `cannot-act` ("no slot holds a Sword, Fire or Spear").
 *   m2 `execRopeCut`'s approach loop rethrows on the first refused walk (`throw e` unconditionally)
 *        -> "L16 fire from the L15 arrival" reds: the ladder's EXHAUSTED refusal at the (24,40) stance.
 *   m3 `runSpear`'s rope wait 2 -> 0
 *        -> the spear rows red: "is STILL its full span after 0 tick(s)".
 *   m4 `unsteppedDrills` returns []
 *        -> "L28 spear from the L25 arrival refuses" reds: it SOLVES (the stance the game hit at t59).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { ROPESTANCE_WITNESS_DIR, ROPESTANCE_WITNESSES, compareWitness, modelSamples, ropeStancePlan }
    from './fidelityRopeStance.js';

const SRC = atlasLevelSource();
const L16 = Object.freeze({ kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' });
const L28 = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const FROM_L15 = Object.freeze({ level: 16, x: 32, y: 64 });
const FROM_L25 = Object.freeze({ level: 28, x: 96, y: 16 });
const TO_L17 = Object.freeze({ kind: 'reach-pit', pit: { tx: 12, ty: 3, x: 192, y: 48 } });

const solve = (boot, goal, items) => {
    const run = createRunForStaging(arrivalStaging(boot, { items }), SRC);
    try {
        return { run, out: solveSegment({ run, goals: [{ ...goal }], name: `ropestance-${boot.level}`, boot }),
            refusal: null };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e };
    }
};
const ON = (fn) => withContactFidelity({ ropeCutAnyWeapon: true }, fn);
const OFF = (fn) => withContactFidelity({ ropeCutAnyWeapon: false }, fn);
const cutRow = (out) => out.records.find((r) => r.goal === 'clear-tag');

describe('fidelity ROPESTANCE — the switch', () => {
    it('is OFF by default', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.ropeCutAnyWeapon).toBe(false);
        expect(CONTACT_FIDELITY.ropeCutAnyWeapon).toBe(false);
    });
    it.each([['the Spear', ['hasSpear'], /fires `spear`/], ['Fire', ['hasFire'], /fires `fire`/]])(
        'OFF: %s alone refuses `cannot-act`, naming the sword swing (byte-identical)', (_, items, why) => OFF(() => {
            const { refusal } = solve(FROM_L15, L16, items);
            expect(refusal.obstacle).toMatchObject({ kind: 'clear-tag', id: 'rope@32,16', reason: 'cannot-act' });
            expect(refusal.message).toMatch(why);
        }));
    it('with the SWORD selected, ON plans what OFF plans, tick for tick', () => {
        const off = OFF(() => solve(FROM_L15, L16, ['hasSword']));
        const on = ON(() => solve(FROM_L15, L16, ['hasSword']));
        expect(on.out.perTick.map((h) => [...h].join('+'))).toEqual(off.out.perTick.map((h) => [...h].join('+')));
        expect(cutRow(on.out)).toEqual(cutRow(off.out));
    });
});

describe('fidelity ROPESTANCE — D2: the clear-tag on a rope\'s own tag, no sword (the switch ON)', () => {
    it('L16 from the L15 arrival, the Spear: a thrust north from (40,56), press t26, cut t27, no hit', () => ON(() => {
        const { run, out, refusal } = solve(FROM_L15, L16, ['hasSpear']);
        expect(refusal).toBeNull();
        expect(cutRow(out)).toMatchObject({ arm: 'verb', weapon: 'spear', stance: { x: 40, y: 56 }, pressTick: 26,
            pulledAt: 27, slot: null, flag: { level: 16, tag: 0 } });
        expect(out.perTick.length).toBe(29);
        expect(run.damage.hits).toBe(0);
    }));
    it('L16 from the L15 arrival, Fire: (24,40)\'s walk refuses at no tick (bob@16,16), (88,40) cuts at t162', () => ON(() => {
        const { run, out, refusal } = solve(FROM_L15, L16, ['hasFire']);
        expect(refusal).toBeNull();
        expect(cutRow(out)).toMatchObject({ arm: 'verb', weapon: 'fire', stance: { x: 88, y: 40 }, pressTick: 158,
            pulledAt: 162 });
        expect(run.damage.hits).toBe(0);
    }), 120000);
    it('the Wand selected, the Spear held: the spear\'s slot is selected for the thrust and the wand\'s restored', () => ON(() => {
        const { out, refusal } = solve(FROM_L15, L16, ['hasWand', 'hasSpear']);
        expect(refusal).toBeNull();
        expect(cutRow(out)).toMatchObject({ weapon: 'spear', slot: 1, restoredSlot: 0, pressTick: 26 });
        expect(out.equips).toEqual([{ t: 26, slot: 1 }, { t: 29, slot: 0 }]);
    }));
    it('L28 from the L25 arrival, Fire: (152,56), cut t82 (the rock\'s fall on the same write)', () => ON(() => {
        const { run, out, refusal } = solve(FROM_L25, L28, ['hasFire']);
        expect(refusal).toBeNull();
        expect(cutRow(out)).toMatchObject({ weapon: 'fire', stance: { x: 152, y: 56 }, pulledAt: 82 });
        expect(run.damage.hits).toBe(0);
    }));
    it('L28 from the L25 arrival, the Spear: refused by name — every stance is in the UNSTEPPED drill\'s trigger', () => ON(() => {
        const { refusal } = solve(FROM_L25, L28, ['hasSpear']);
        expect(refusal.obstacle).toMatchObject({ kind: 'clear-tag', id: 'rope@160,64', reason: 'unresolved' });
        expect(refusal.message).toMatch(/UNSTEPPED drill \(\[drill@80,96, drill@128,96\]/);
    }));
    it('the Wand alone: `cannot-act`, naming the three weapons that cut', () => ON(() => {
        const { refusal } = solve(FROM_L15, L16, ['hasWand']);
        expect(refusal.obstacle).toMatchObject({ reason: 'cannot-act' });
        expect(refusal.message).toMatch(/no slot holds a Sword, Fire or Spear/);
    }));
});

describe('fidelity ROPESTANCE — D3: the PULL rung\'s silencer cut (L16 from the L15 arrival -> the pit to L17)', () => {
    it('Fire alone, OFF: the ladder exhausts (the PULL rung asks only a sword)', () => OFF(() => {
        const { refusal } = solve(FROM_L15, TO_L17, ['hasFire']);
        expect(refusal.message).toMatch(/combat ladder is EXHAUSTED/);
    }));
    it('Fire alone, ON: the rung cuts rope@32,16 with fire from (88,40), the lanes latch, the walk reaches L17', () => ON(() => {
        const { run, out, refusal } = solve(FROM_L15, TO_L17, ['hasFire']);
        expect(refusal).toBeNull();
        expect(out.records.find((r) => r.strategy === 'pull')).toMatchObject({ weapon: 'fire', stance: { x: 88, y: 40 },
            pressTick: 158, silenced: ['arrowtrap@96,32', 'arrowtrap@112,32', 'arrowtrap@128,32'] });
        expect(run.level).toBe(17);
    }), 120000);
});

describe('fidelity ROPESTANCE — D1: the plans on the game (p4g), at 0 px', () => {
    const recorded = Object.fromEntries(ROPESTANCE_WITNESSES.map((w) => [w.name,
        JSON.parse(readFileSync(join(ROPESTANCE_WITNESS_DIR, `${w.name}.json`), 'utf8'))]));
    it('five witnesses, recorded on p4g', () => {
        expect(Object.keys(recorded)).toEqual(['ropestance-l16-spear', 'ropestance-l16-fire',
            'ropestance-l28-spear-east', 'ropestance-l28-fire', 'ropestance-l28-wand-spear-east']);
        for (const r of Object.values(recorded)) expect(r.page).toBe('seedling_bot_ap_p4g');
    });
    for (const w of ROPESTANCE_WITNESSES) {
        it(`${w.name}: the solver plans the recorded tape today, and the model is the game on every tick`, async () => {
            const r = recorded[w.name];
            const { tape } = await ropeStancePlan(w);
            expect(tape.inputs).toEqual(r.tape.inputs);
            expect(tape.equips ?? []).toEqual(r.tape.equips ?? []);
            expect(tape.tick_count).toBe(r.tape.tick_count);
            const model = await modelSamples(r.tape);
            expect(compareWitness(r.samples, model.samples).slice(0, 6)).toEqual([]);
            const first = r.samples.find((s) => s.level === r.tape.boot.level && s.cleared.includes(0))?.t;
            expect(first).toBe(model.pulls[0].t + 1);
            expect(r.end.level).toBe(w.to);
            expect(r.samples.every((s) => !s.hits)).toBe(true);
        }, 120000);
    }
});
