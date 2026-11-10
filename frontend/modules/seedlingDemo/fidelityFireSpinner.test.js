/**
 * ⛓⛓⛓ fidelity FIRESPINNER (wave 38) — `CONTACT_FIDELITY.fireSpinnerArm`: a Fire press that reaches a SPINNER knocks it
 * back and does no damage (`fidelityFireSpinner.js` has the AS3 and the staging).
 *
 * The game witnesses (p4g, headless, logic-only; `scripts/procgen/probe-seedling-fire-spinner.mjs --record`):
 *   firespinner-l39-knock    r5-shaft's first 680 t + one Fire press at t590 — the flame reaches `spinner@224,112`'s
 *                            BODY on three hit ticks; the game knocks it (v (-0.71,-0.71) → (2.39,1.08) → (5.18,2.90)
 *                            → (8.04,-0.95), the last a wall reflection) with hits 0 and hits_timer 0 throughout
 *   firespinner-l39-phantom  the same prefix + one Fire press at t690 — the flame reaches the spinner's `.oel` CELL
 *                            (232,120), the body is ~80 px off; the game does nothing to any spinner
 *
 * The rows, predicted before the arm was written:
 *   OFF  the phantom press THROWS (*"`FIRE_ARM_POLICY` calls Spinner modelled and this dispatch has no arm for it"*);
 *        the knock press reaches nothing (no throw, no knockback) and the model leaves the game at t596
 *   ON   both witnesses at 0 px on every sampled tick; the knock press's ledger is three knocked hit ticks of 11
 *        dispatches each, then two empty ones (the body left the flame); `hits` 0 and `hitsTimer` 0 throughout
 *
 *   firespinner-r5-press-{delay,glide,repeat}  the three COMMITTED L39 block-glide tapes, played as themselves: their
 *                            t10 Fire press knocks `spinner@224,112` (t17), and glide/repeat's later presses knock
 *                            `spinner@112,88`. The committed expectations hold the player only, so the OFF model's
 *                            spinners had never been checked: OFF leaves the game at t19 on all three; ON is 0 px
 *                            (spinners and fire blocks; the blocks agree in both arms)
 *
 * Mutants (copy + restore, `levelRun.js`): (m1) the knockback FROM the mirror point (direction reversed) → the ON knock
 * row reds; (m2) `t: 'Sword', damage 1` in place of Fire → the ON knock row and the no-damage row red; (m3) the arm
 * ungated (`&& CONTACT_FIDELITY.fireSpinnerArm` dropped) with the census still the placement → the OFF throw row reds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS } from './contactFidelity.js';
import { FIRE_ARM_POLICY } from './presses.js';
import { FIRESPINNER_END, FIRESPINNER_PRESS, FIRESPINNER_THROW_END, FIRESPINNER_THROW_PRESS,
    FIRESPINNER_ROSTER, FIRESPINNER_WITNESS, FIRESPINNER_WITNESS_DIR, committedTape, compareFireSpinnerWitness, fireSpinnerModelSamples, fireSpinnerTape,
    unpackFireSpinnerSample } from './fidelityFireSpinner.js';

const ON = { fireSpinnerArm: true };
const OFF = { fireSpinnerArm: false };
const load = (name) => JSON.parse(readFileSync(join(FIRESPINNER_WITNESS_DIR, `${name}.json`), 'utf8'));
const THROW = '`FIRE_ARM_POLICY` calls Spinner modelled and this dispatch has no arm for it';

describe('fidelity FIRESPINNER — the key', () => {
    it('ships OFF, and FIRE_ARM_POLICY still calls Spinner modelled', () => {
        expect(CONTACT_FIDELITY_KEYS).toContain('fireSpinnerArm');
        expect(CONTACT_FIDELITY_DEFAULTS.fireSpinnerArm).toBe(false);
        expect(FIRE_ARM_POLICY.Spinner.policy).toBe('modelled');
    });

    it('the witness tapes are the staging the module builds (r5-shaft cut, one Fire press)', () => {
        expect(load(FIRESPINNER_WITNESS).tape).toEqual(fireSpinnerTape());
        expect(load('firespinner-l39-phantom').tape).toEqual(fireSpinnerTape({ press: FIRESPINNER_THROW_PRESS,
            end: FIRESPINNER_THROW_END, name: 'firespinner-l39-phantom' }));
    });
});

describe('fidelity FIRESPINNER — OFF: today\'s behaviour, byte for byte', () => {
    it('a press whose flame reaches the spinner\'s .oel CELL (the body ~80 px off) throws', async () => {
        const m = await fireSpinnerModelSamples(load('firespinner-l39-phantom').tape, OFF);
        expect(m.error).toContain(THROW);
    });

    it('a press whose flame reaches the BODY does nothing — the model leaves the game at t596', async () => {
        const rec = load(FIRESPINNER_WITNESS);
        const m = await fireSpinnerModelSamples(rec.tape, OFF);
        expect(m.error).toBeNull();
        const presses = m.firePresses.filter((p) => p.t === FIRESPINNER_PRESS);
        expect(presses.map((p) => p.hits)).toEqual([[], [], [], [], []]);
        const bad = compareFireSpinnerWitness(rec.samples.map(unpackFireSpinnerSample), m.samples);
        expect(bad[0]).toMatch(/^t 596: spinners/);
    });
});

describe('fidelity FIRESPINNER — ON: the game witnesses at 0 px', () => {
    it.each([FIRESPINNER_WITNESS, 'firespinner-l39-phantom'])('%s — every sampled tick: player, spinners, hits, hitsTimer', async (name) => {
        const rec = load(name);
        const m = await fireSpinnerModelSamples(rec.tape, ON);
        expect(m.error).toBeNull();
        const game = rec.samples.map(unpackFireSpinnerSample);
        expect(game.length).toBe(rec.tape.tick_count);
        expect(compareFireSpinnerWitness(game, m.samples)).toEqual([]);
    });

    it('the knock press: three knocked hit ticks of eleven dispatches, then the body is out of the flame', async () => {
        const m = await fireSpinnerModelSamples(load(FIRESPINNER_WITNESS).tape, ON);
        const presses = m.firePresses.filter((p) => p.t === FIRESPINNER_PRESS);
        expect(presses.map((p) => p.fired)).toEqual([594, 595, 596, 597, 598]);
        expect(presses.map((p) => p.hits.map((h) => `${h.id}:${h.knocked}:${h.dispatches}`))).toEqual([
            ['spinner@224,112:true:11'], ['spinner@224,112:true:11'], ['spinner@224,112:true:11'], [], []]);
    });

    it('no damage: hits and hitsTimer stay 0 on every spinner, game and model alike', async () => {
        const rec = load(FIRESPINNER_WITNESS);
        const m = await fireSpinnerModelSamples(rec.tape, ON);
        const all = [...rec.samples.map(unpackFireSpinnerSample), ...m.samples.filter(Boolean)].flatMap((s) => s.spinners);
        expect(all.length).toBeGreaterThan(0);
        expect(all.every((b) => b.hits === 0 && b.ht === 0)).toBe(true);
    });

    it('the phantom press reaches nothing ON (the census tests the live body)', async () => {
        const m = await fireSpinnerModelSamples(load('firespinner-l39-phantom').tape, ON);
        expect(m.firePresses.filter((p) => p.t === FIRESPINNER_THROW_PRESS).flatMap((p) => p.hits)).toEqual([]);
    });

    it.each(FIRESPINNER_ROSTER)('committed %s — ON reproduces the game at 0 px; OFF leaves it at t19 on a spinner', async (name) => {
        const rec = load(`firespinner-${name}`);
        expect(rec.tape).toEqual(committedTape(name));
        const game = rec.samples.map(unpackFireSpinnerSample);
        const on = await fireSpinnerModelSamples(rec.tape, ON);
        expect(on.error).toBeNull();
        expect(compareFireSpinnerWitness(game, on.samples)).toEqual([]);
        const off = await fireSpinnerModelSamples(rec.tape, OFF);
        const bad = compareFireSpinnerWitness(game, off.samples);
        expect(bad[0]).toMatch(/^t 19: spinners/);
        expect(bad.some((b) => b.includes('blocks'))).toBe(false);
    });

    it('the tape end constants are the recorded ones', () => {
        expect(load(FIRESPINNER_WITNESS).end_status).toEqual({ level: 39, tick: FIRESPINNER_END });
    });
});
