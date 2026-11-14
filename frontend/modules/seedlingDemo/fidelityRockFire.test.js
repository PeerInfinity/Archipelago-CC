/**
 * ⛓⛓⛓ fidelity ROCKFIRE (wave 39) — `CONTACT_FIDELITY.fireRockArm`: a Fire press that reaches a BREAKABLE ROCK breaks it
 * exactly when a swing would (`fidelityRockFire.js` has the AS3 and the stagings).
 *
 * The game witnesses (p4g, headless, logic-only; `scripts/procgen/probe-seedling-rock-fire.mjs --record`), each holding
 * the player against the rock, `primary` on input 10; the rock is read through its SOLID (x moves on the observation the
 * cell opens) and its persistence WRITE (`botStatus.persistence_cleared`):
 *   - `rockfire-l40-fire`                  L40 `breakablerock@176,128` (rockType 0), Fire, no Ghost Sword: BREAKS — the
 *                                          flag on obs 22, the cell on obs 23 (the flame also reaches `@176,144`)
 *   - `rockfire-l40-fire-ghost`            the same with the Ghost Sword held: BREAKS, the same ticks
 *   - `rockfire-l40-sword`                 the control, the Sword: the flag on obs 19, the cell on obs 20 (three ticks
 *                                          sooner: a swing's first test is press + 1, the flame's first hit tick press + 4)
 *   - `rockfire-l40-fire-twice`            a second Fire press (input 30) with the rect over the two GONE rocks' cells:
 *                                          nothing there; it breaks the third rock, `@160,144`
 *   - `rockfire-l101-ghostrock-fire`       L101 `breakablerockghost@224,96` (rockType 1), Fire, no Ghost Sword: NOTHING,
 *                                          for the whole tape
 *   - `rockfire-l101-ghostrock-fire-ghost` the same with the Ghost Sword held: BREAKS (22 / 23)
 *
 * PREDICTED before the arm was written (from the AS3, and from the game's write tick): ON, the first hit tick is 14
 * (`fired`), `goneAt` 21, five hit ticks (14..18) of FIVE dispatches each (a rock is `type = "Solid"`), the first
 * breaking and the next four `already breaking`; a ghost rock without the Ghost Sword is five `rockType 1 > 0` rows;
 * all at 0 px. OFF: every Fire tape throws.
 *
 * Mutants (copy + restore, `levelRun.js` / `presses.js`): (m1) the rock breaks whatever the inventory
 * (`rockBreaksUnder` → `true` in `hitBreakableRock`) → the ghost-rock-without-Ghost-Sword rows red; (m2) the census type
 * left at "Rock" (the `fireRockArm` override dropped in `fireRespondersIn`) → the two dispatch-count rows red; (m3) the arm
 * ungated (`&& CONTACT_FIDELITY.fireRockArm` dropped) → the OFF throw rows red; (m4) the fire arm's hit a tick late
 * (`hitRock(st, rock, ticksCompleted + 1)`) → every breaking 0 px row reds, the Sword control with them (one model).
 */
import { describe, expect, it } from 'vitest';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS } from './contactFidelity.js';
import { FIRE_ARM_POLICY } from './presses.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { ROCKFIRE_TAPES, ROCKFIRE_WITNESSES, compareRockFireWitness, firstCleared, firstMoveAfter, rockFireModelSamples,
    rockFireTape, rockFireWitness, unpackRockFireSample } from './fidelityRockFire.js';

const ON = { fireRockArm: true };
const OFF = { fireRockArm: false };
const THROW = '`FIRE_ARM_POLICY` calls BreakableRock modelled and this dispatch has no arm for it';
const FIRE = ROCKFIRE_WITNESSES.filter((n) => ROCKFIRE_TAPES[n].weapon === 'fire');
const game = (name) => rockFireWitness(name).samples.map(unpackRockFireSample);
const rockRows = (m) => m.presses.filter((p) => p.weapon === 'fire').map((p) => ({ fired: p.fired, hits: p.hits }));

describe('fidelity ROCKFIRE — the key', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_FIRE_ROCK_ARM)(
        'ships ON (⚖ user 2026-11-11, the ROCKFIRE flip), followed in the defaults only by wave 40\'s key; its env name is a known worker env name; FIRE_ARM_POLICY still calls BreakableRock modelled', () => {
            expect(CONTACT_FIDELITY_KEYS).toContain('fireRockArm');
            expect(CONTACT_FIDELITY_DEFAULTS.fireRockArm).toBe(true);
            expect(CONTACT_FIDELITY.fireRockArm).toBe(true);
            // ⛓ wave 40: FIREBREAK `fireBreakArm`, then FENCEPOST `spinnerRemoveRead`, landed after it.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf('fireRockArm') + 1)).toEqual(['fireBreakArm', 'spinnerRemoveRead', 'fallRockHoldsButton', 'corridorForecastMemo']); // ⛓ wave 41: ROCKBUTTON
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FIRE_ROCK_ARM');
            expect(FIRE_ARM_POLICY.BreakableRock.policy).toBe('modelled');
        });
});

describe('fidelity ROCKFIRE D0 — the game (p4g recordings)', () => {
    it('every witness is recorded, and is the tape the fold builds today', async () => {
        for (const name of ROCKFIRE_WITNESSES) {
            const w = rockFireWitness(name);
            expect(w.page, name).toBe('seedling_bot_ap_p4g');
            expect(w.tape, name).toEqual(JSON.parse(JSON.stringify(await rockFireTape(name))));
        }
    });

    it('the rock breaks exactly when `rockType <= (hasGhostSword ? 1 : 0)`, whatever the weapon', () => {
        const seen = Object.fromEntries(ROCKFIRE_WITNESSES.map((name) => {
            const g = game(name).filter((s) => s.t < ROCKFIRE_TAPES[name].ticks);
            return [name, { opens: firstMoveAfter(g, 11), written: firstCleared(g, ROCKFIRE_TAPES[name].flag.tag) }];
        }));
        expect(seen).toEqual({
            'rockfire-l40-fire': { opens: 23, written: 22 },
            'rockfire-l40-sword': { opens: 20, written: 19 },
            'rockfire-l40-fire-ghost': { opens: 23, written: 22 },
            'rockfire-l40-fire-twice': { opens: 23, written: 22 },
            'rockfire-l101-ghostrock-fire': { opens: null, written: null },
            'rockfire-l101-ghostrock-fire-ghost': { opens: 23, written: 22 },
        });
        for (const name of ROCKFIRE_WITNESSES) {
            expect(seen[name].written !== null, name).toBe(ROCKFIRE_TAPES[name].breaks);
        }
    });

    it('the second press breaks the third rock and writes nothing else: {40,23} first cleared on obs 42', () => {
        const g = game('rockfire-l40-fire-twice');
        expect(firstCleared(g, 23)).toBe(42);
        expect(firstCleared(g, 24)).toBe(22);
    });
});

describe('fidelity ROCKFIRE D1 — OFF: the throw, exactly as before', () => {
    it.each(FIRE)('%s: the model throws at the first hit tick that reaches the rock', async (name) => {
        const m = await rockFireModelSamples(rockFireWitness(name).tape, OFF);
        expect(m.error).toContain(THROW);
    });

    it('the Sword control is the game at 0 px in both arms (the hoisted rock hit is the sword arm\'s own body)', async () => {
        const w = rockFireWitness('rockfire-l40-sword');
        for (const over of [OFF, ON]) {
            const m = await rockFireModelSamples(w.tape, over);
            expect(m.error).toBe(null);
            expect(compareRockFireWitness(game('rockfire-l40-sword'), m.samples, w.tape.tick_count,
                ROCKFIRE_TAPES['rockfire-l40-sword'].rockTags)).toEqual([]);
            expect(m.rocks).toEqual([
                { id: 'breakablerock@176,128', hitTick: 11, goneAt: 18, tag: 22 },
                { id: 'breakablerock@176,144', hitTick: 11, goneAt: 18, tag: 24 }]);
        }
    });
});

describe('fidelity ROCKFIRE D1 — ON: the game at 0 px', () => {
    it.each(ROCKFIRE_WITNESSES)('%s: the player and the rock flags equal the game on every sampled tick', async (name) => {
        const w = rockFireWitness(name);
        const m = await rockFireModelSamples(w.tape, ON);
        expect(m.error).toBe(null);
        const g = game(name);
        expect(g.filter((s) => s.t < w.tape.tick_count)).toHaveLength(w.tape.tick_count);
        expect(compareRockFireWitness(g, m.samples, w.tape.tick_count, ROCKFIRE_TAPES[name].rockTags)).toEqual([]);
    });

    it('a rockType-0 rock, no Ghost Sword: five hit ticks (14..18) of five dispatches; the first breaks, the rest change nothing', async () => {
        for (const name of ['rockfire-l40-fire', 'rockfire-l40-fire-ghost']) {
            const m = await rockFireModelSamples(rockFireWitness(name).tape, ON);
            const rows = rockRows(m);
            expect(rows.map((r) => r.fired), name).toEqual([14, 15, 16, 17, 18]);
            expect(rows[0].hits, name).toEqual([
                { as3: 'BreakableRock', id: 'breakablerock@176,128', broke: true, goneAt: 21, why: null, dispatches: 5 },
                { as3: 'BreakableRock', id: 'breakablerock@176,144', broke: true, goneAt: 21, why: null, dispatches: 5 }]);
            for (const r of rows.slice(1)) {
                expect(r.hits.map((h) => [h.broke, h.goneAt, h.dispatches, h.why]), name).toEqual([
                    [false, 21, 5, 'already breaking — `play("break")` early-returns'],
                    [false, 21, 5, 'already breaking — `play("break")` early-returns']]);
            }
            expect(m.rocks, name).toEqual([
                { id: 'breakablerock@176,128', hitTick: 14, goneAt: 21, tag: 22 },
                { id: 'breakablerock@176,144', hitTick: 14, goneAt: 21, tag: 24 }]);
        }
    });

    it('a ghost rock: without the Ghost Sword five refused hit ticks and nothing broken; with it, broken at 14 → 21', async () => {
        const none = await rockFireModelSamples(rockFireWitness('rockfire-l101-ghostrock-fire').tape, ON);
        expect(rockRows(none).map((r) => r.fired)).toEqual([14, 15, 16, 17, 18]);
        for (const r of rockRows(none)) {
            expect(r.hits).toEqual([{ as3: 'BreakableRock', id: 'breakablerockghost@224,96', broke: false,
                why: 'rockType 1 > 0 — this weapon cannot break it', dispatches: 5 }]);
        }
        expect(none.rocks).toEqual([]);
        const held = await rockFireModelSamples(rockFireWitness('rockfire-l101-ghostrock-fire-ghost').tape, ON);
        expect(rockRows(held)[0].hits).toEqual([{ as3: 'BreakableRock', id: 'breakablerockghost@224,96', broke: true,
            goneAt: 21, why: null, dispatches: 5 }]);
        expect(held.rocks).toEqual([{ id: 'breakablerockghost@224,96', hitTick: 14, goneAt: 21, tag: 2 }]);
    });

    it('the second press: the third rock breaks at 34 → 41; the two gone rocks are no-op rows (the census is the placement)', async () => {
        const m = await rockFireModelSamples(rockFireWitness('rockfire-l40-fire-twice').tape, ON);
        expect(m.rocks).toEqual([
            { id: 'breakablerock@176,128', hitTick: 14, goneAt: 21, tag: 22 },
            { id: 'breakablerock@176,144', hitTick: 14, goneAt: 21, tag: 24 },
            { id: 'breakablerock@160,144', hitTick: 34, goneAt: 41, tag: 23 }]);
        const second = rockRows(m).filter((r) => r.fired >= 34);
        expect(second.map((r) => r.fired)).toEqual([34, 35, 36, 37, 38]);
        expect(second.flatMap((r) => r.hits.filter((h) => h.broke).map((h) => h.id))).toEqual(['breakablerock@160,144']);
    });

    it('a room BUILT without its rocks (the three flags cleared at the boot): no rock row and no throw, in both arms', async () => {
        const t = await rockFireTape('rockfire-l40-fire');
        const tape = { ...t, name: 'rockfire-l40-fire-cleared', persistence: [...t.persistence,
            ...[22, 23, 24].map((tag) => ({ level: 40, tag, note: '' }))] };
        for (const over of [OFF, ON]) {
            const m = await rockFireModelSamples(tape, over);
            expect(m.error).toBe(null);
            expect(rockRows(m).flatMap((r) => r.hits)).toEqual([]);
            expect(m.rocks).toEqual([]);
        }
    });
});
