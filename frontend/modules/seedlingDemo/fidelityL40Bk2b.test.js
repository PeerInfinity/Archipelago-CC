/**
 * seedling-fidelity-l40bk2b (wave 33) — L40 Boss Key 2's `bobsoldier@880,832` met in its notch above the one-tile
 * corridor. `orbitFreeAim` ships OFF.
 *
 * ⛓ W0/D1 (`l40bk2b-orbit-plain`, p4g): from the corridor staging (step 67's boot west of the notch, both corridor
 * spinners banked) the SHIPPED orbit kill's candidate `r 22 cw far 110°` steers straight at its circle point and the
 * blade lands at t55 (and t75); the model agrees at 0 px. OFF the solver's orbit arm finds no hitless candidate.
 *
 * ⛓ D1 (`orbitFreeAim`): each orbit aim is projected onto the free point nearest it; the solver kills the BobSoldier
 * hitless (removed at t125): `l40bk2b-orbit-free` is those ticks on p4g at 0 px.
 *
 * ⛓ D2 (`strategyBoundDistinct`): `MAX_STRATEGIES_PER_GOAL` counts DISTINCT applications, with `STRATEGY_BOUND_TOTAL`
 * (8) in all as the backstop. Measured on leg 853 with OPP ON (node only; the captured request is not committed):
 * Boss Key 2's goal applies shove, hold(wandlock@448,432), burn, hold(wandlock@448,432) and then needs the latch's
 * hold(wandlock@480,560); OFF that fifth application is refused, ON the chain runs to `iceturret@472,400`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { ORBIT_FREE_AIM, strategyBoundReached } from './solverBot.js';
import { compareCorpseBumpWitness } from './fidelityCorpseBump.js';
import { L40BK2B_AFTER_REMOVAL, L40BK2B_D1_SWITCHES, L40BK2B_WITNESS_DIR, l40Bk2bBoot, l40Bk2bFreeChecks,
    l40Bk2bModelSamples, l40Bk2bPlainChecks, l40Bk2bRemovalTick, l40Bk2bShippedOrbit, l40Bk2bSolve,
    unpackL40Bk2bSample } from './fidelityL40Bk2b.js';

const witness = (name) => JSON.parse(readFileSync(join(L40BK2B_WITNESS_DIR, `${name}.json`), 'utf8'));

describe('L40BK2B — the switch and the staging', () => {
    it('orbitFreeAim ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.orbitFreeAim).toBe(false);
    });

    it('the projection searches 10° steps out to 180° each side, at four radius offsets', () => {
        expect(ORBIT_FREE_AIM.step * ORBIT_FREE_AIM.turns).toBeCloseTo(Math.PI, 12);
        expect(ORBIT_FREE_AIM.radii).toEqual([0, 4, -4, 8]);
    });

    it('the staging boots in the corridor and banks spinner@816,848 {40,15} and spinner@880,848 {40,16}; the chest, the tree and the BobSoldier stand', async () => {
        const boot = await l40Bk2bBoot();
        expect(boot.boot).toEqual({ level: 40, x: 832, y: 848 });
        const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
        expect(run.entities('spinnerBodies').map((b) => b.id)).not.toContain('spinner@816,848');
        expect(run.entities('spinnerBodies').map((b) => b.id)).not.toContain('spinner@880,848');
        expect(run.world.chests.some((c) => c.id === 'chest@880,816')).toBe(true);
        expect(run.world.burnableTrees.some((t) => t.id === 'burnabletree@872,784')).toBe(true);
        expect(run.entities('chasers').map((c) => c.id)).toContain('bobsoldier@880,832');
    });
});

describe('L40BK2B W0 — the shipped orbit in the notch, on the game (`l40bk2b-orbit-plain`)', () => {
    const w = witness('l40bk2b-orbit-plain');
    const game = w.samples.map(unpackL40Bk2bSample);

    it('the recording: the blade lands on the player at t55', () => {
        const checks = l40Bk2bPlainChecks(game);
        expect(checks.map((c) => [c.name, c.ok])).toEqual(checks.map((c) => [c.name, true]));
        expect(game.find((g) => g.hits > 0)?.t).toBe(55);
    });

    it('the model reproduces it at 0 px, both hits included (t55, t75)', async () => {
        const model = await l40Bk2bModelSamples(w.tape, {});
        expect(model.error).toBeNull();
        expect(compareCorpseBumpWitness(game, model.samples)).toEqual([]);
        expect(game.filter((g) => model.samples[g.t].hits !== g.hits)).toEqual([]);
        expect(model.hits.map((h) => [h.t, h.source, h.id, h.died])).toEqual([
            [55, 'sword', 'bobsoldier@880,832', false],
            [75, 'sword', 'bobsoldier@880,832', false],
        ]);
    });

    it('the recorded tape is the shipped orbit\'s own keys (candidate 2, orbitFreeAim OFF)', async () => {
        const { keys, hitAt } = await l40Bk2bShippedOrbit(2);
        expect(hitAt).toBe(55);
        expect(keys.length).toBe(w.tape.tick_count);
    });

    it('OFF the solver\'s orbit arm finds no hitless candidate', async () => {
        const { out, refusal } = await l40Bk2bSolve({ orbitFreeAim: false });
        expect(out).toBeNull();
        expect(refusal.message).toContain('orbit arm: no orbit kill of bobsoldier@880,832 is hitless (20 fork(s) of 20)');
    }, 180_000);
});

describe('L40BK2B D1 — the projected orbit, on the game (`l40bk2b-orbit-free`)', () => {
    const w = witness('l40bk2b-orbit-free');
    const game = w.samples.map(unpackL40Bk2bSample);

    it('the recording: never hit, and the BobSoldier is gone from t125', () => {
        const checks = l40Bk2bFreeChecks(game);
        expect(checks.map((c) => [c.name, c.ok])).toEqual(checks.map((c) => [c.name, true]));
        expect(w.tape.tick_count).toBe(125 + L40BK2B_AFTER_REMOVAL);
    });

    it('the model (D1 ON, and OFF: D1 is solver-only) reproduces it at 0 px', async () => {
        for (const over of [L40BK2B_D1_SWITCHES, { orbitFreeAim: false }]) {
            const model = await l40Bk2bModelSamples(w.tape, over);
            expect(model.error).toBeNull();
            expect(compareCorpseBumpWitness(game, model.samples)).toEqual([]);
            expect(model.hits).toEqual([]);
        }
    });

    it('ON the solver kills the BobSoldier by the orbit arm: its ticks are the recorded tape\'s, key for key', async () => {
        const { refusal } = await l40Bk2bSolve(L40BK2B_D1_SWITCHES);
        const perTick = refusal.perTick.map((k) => [...k].sort());
        expect(await l40Bk2bRemovalTick(perTick)).toBe(125);
        const { createTapeStepper } = await import('./tapeRunner.js');
        const recorded = [];
        const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: atlasLevelSource(),
            onTick: (t, s, held) => { if (held) recorded[t] = [...held].sort(); } });
        for (let r = st.next(); !r.done; r = st.next());
        expect(perTick.slice(0, w.tape.tick_count)).toEqual(recorded.slice(0, w.tape.tick_count));
        // the next refusal is the plain world's chest proximity (a staging artifact; the AP leg's chest is an apitem)
        expect(refusal.message).toContain('the route entered a proximity-hazard — chest at (880,816)');
    }, 180_000);
});

describe('L40BK2B D2 — the strategy bound counts distinct applications', () => {
    // ⛓ leg 853's applications (OPP ON, orbitFreeAim ON) when the latch's hold is asked for
    const leg853 = ['shove(pushableblockfire@576,576)', 'hold(wandlock@448,432)', 'burn(burnabletree@872,784)',
        'hold(wandlock@448,432)'];

    it('strategyBoundDistinct ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.strategyBoundDistinct).toBe(false);
    });

    it('OFF every application counts: leg 853\'s four refuse the fifth', () => {
        withContactFidelity({ strategyBoundDistinct: false }, () => {
            expect(strategyBoundReached(leg853.slice(0, 3))).toBe(false);
            expect(strategyBoundReached(leg853)).toBe(true);
        });
    });

    it('ON the distinct ones count (leg 853 has three), and four distinct still refuse', () => {
        withContactFidelity({ strategyBoundDistinct: true }, () => {
            expect(strategyBoundReached(leg853)).toBe(false);
            expect(strategyBoundReached([...leg853, 'hold(wandlock@480,560)'])).toBe(true);
        });
    });

    it('ON a goal that repeats one application is stopped at 8 in all (the loop\'s backstop)', () => {
        withContactFidelity({ strategyBoundDistinct: true }, () => {
            expect(strategyBoundReached(Array(7).fill('hold(wandlock@448,432)'))).toBe(false);
            expect(strategyBoundReached(Array(8).fill('hold(wandlock@448,432)'))).toBe(true);
        });
    });
});
