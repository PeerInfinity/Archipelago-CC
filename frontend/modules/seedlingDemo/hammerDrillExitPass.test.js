/**
 * seedlingDemo/hammerDrillExitPass.test — ⛓⛓ SEEDLING HAMMER-PHASE DRILL-EXIT-PASS (`DRILL_EXIT_PASS`, OFF): when a door
 * leg's walk refuses on a live drill before a tick is spent, residue D-A's timed pass to the crossing
 * (`execDrillTimedPassExit`) is asked ARMED — a held weapon does not skip it, and its wake test's walk is planned to the
 * door (the door allowed, `plannedWalkSamples`' `allowTeleporter`).
 *
 * The wall (ROUTE-WALLS-CENSUS W3): L91's `drill@64,80` stands in the one-tile west passage. At sphere 5.6 the bot holds
 * a sword, so the pass returned at its weapon gate; and the wake test's walk to a door centre never planned (no door
 * allowed), so its straight-line fallback passed 80 px from the drill, outside its 48 px wake range. The combat ladder
 * then refused EXHAUSTED on the drill (no rung offers a static drill). ON, the pass runs after that refusal: searched
 * tick by tick on the run's own forecast, certified on a fork, played on the run (30(c)).
 *
 * The stagings are the page's own (the divergence sweep's captured requests, main 0d575b78ea): the L91 boot at the L89
 * arrival (16,128) or the L92 arrival (240,64) with the sphere-5.6 items; L88's from the L12 arrival, sphere 0.1.
 *
 *   718  L89 arrival → L92 door (240,48)   OFF EXHAUSTED on the drill   ON SOLVED 190 t, hitless, replayed on a fresh run
 *   719  L92 arrival → L89 door (16,144)   OFF EXHAUSTED                ON SOLVED 223 t, hitless (fidelity DRILLWATER's
 *                                                                          `drillTerrainSwitch`, ON since its flip: the drill
 *                                                                          drowns); with that key OFF, REFUSED by name (DRILL D2)
 *   717 / 720  the door beside the arrival  ON = OFF, tick for tick (the walk wakes no drill)
 *   704  L88 → L12 door (96,304)            ON = OFF: the walk refuses on the drill after spending ticks — no pass
 *   707  L88 → L12 door (96,304)            ON = OFF: the walk solves, so no pass is asked (the census's shape — the
 *                                           pass FIRST — refused it)
 *
 * The L28 row (residue D-A's, a sword held, `fidelityResidue.test.js`'s "a Sword run is untouched") is here ON too.
 *
 * Mutants (predicted first; copy + edit + run + restore; results in the report):
 *   m1  the armed call keeps the weapon gate (`!armed` dropped)  → 718 ON red (EXHAUSTED returns)
 *   m2  the armed wake walk without the door (null)               → 718 ON red (the straight line wakes nothing)
 *   m3  the pass asked armed BEFORE the walk (the census's shape) → 707 red (refused: no pass reaches the crossing)
 *   m4  the rung asked after a walk that spent ticks              → predicted none red in the L91 rows; SURVIVED them, so
 *                                                                    the L88 leg-704 row was added (its walk refuses late
 *                                                                    on the drill): 704 red
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import {
    DRILL_EXIT_PASS, DRILL_EXIT_PASS_COUNTS, DRILL_EXIT_PASS_DEFAULT, solveSegment, SolverRefusal, withDrillExitPass,
} from './solverBot.js';
import { withContactFidelity } from './contactFidelity.js';

const SRC = atlasLevelSource();

/** The page's staging for an L91 leg (legs 717–720's captured requests; they differ in the boot and the clock). */
const l91Staging = (boot, time) => ({
    boot: { level: 91, ...boot }, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [], despawn: [],
    equips: [], pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [0, 1], seal_parts: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    rng: { seed: 1515193484, split: true, cosmetic: 0 },
    seam: {
        items: { hasSword: true, hasGhostSword: false, hasShield: true, hasFire: true, hasWand: false, hasFireWand: false,
            canSwim: true, hasSpear: false, hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false,
            hasFeather: false, hasTorch: true },
        beam: false, rock_set: false, hits_max: 3, time, primary: 0, secondary: 0,
        cutscene: [false, false, false, false], menu_state: 0,
    },
    inventory_slots: [0, 1],
});
const FROM_L89 = { x: 16, y: 128 };
const FROM_L92 = { x: 240, y: 64 };
const LEGS = {
    717: { staging: l91Staging(FROM_L89, 5260), exit: { x: 16, y: 144 }, to: 89 },
    718: { staging: l91Staging(FROM_L89, 5225), exit: { x: 240, y: 48 }, to: 92 },
    719: { staging: l91Staging(FROM_L92, 5252), exit: { x: 16, y: 144 }, to: 89 },
    720: { staging: l91Staging(FROM_L92, 5259), exit: { x: 240, y: 48 }, to: 92 },
    707: {
        staging: {
            boot: { level: 88, x: 192, y: 16 }, noclip: false, noDamage: false, noHazards: [], grants: [],
            persistence: [], despawn: [], equips: [], pins: ['sound', 'dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 768692529, split: true, cosmetic: 0 },
            seam: {
                items: { hasSword: true, hasGhostSword: false, hasShield: false, hasFire: false, hasWand: false,
                    hasFireWand: false, canSwim: false, hasSpear: false, hasDarkShield: false, hasDarkSuit: false,
                    hasDarkSword: false, hasFeather: false, hasTorch: false },
                beam: false, rock_set: false, hits_max: 3, time: 4882, primary: 0, secondary: 0,
                cutscene: [false, false, false, false], menu_state: 0,
            },
            inventory_slots: [0],
        },
        exit: { x: 96, y: 304 },
        to: 12,
    },
};
/** L88 leg 704 (its captured boot (32,16), clock 4891 → the L12 door): its walk refuses on the drill AFTER spending ticks. */
LEGS[704] = { ...LEGS[707], staging: { ...LEGS[707].staging, boot: { level: 88, x: 32, y: 16 },
    seam: { ...LEGS[707].staging.seam, time: 4891 } } };

function solveLeg(id) {
    const { staging, exit } = LEGS[id];
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { ...exit } }], name: `drill-exit-${id}`,
            boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
        return { run, out, refusal: null, exit: (out.records ?? []).find((r) => r.goal === 'reach-exit') ?? null };
    } catch (e) {
        // A model guard's by-name refusal is a plain `Error` (levelRun's); the page settles it as a refusal (`settleSolve`).
        if (!(e instanceof SolverRefusal) && !/Refused by name/.test(String(e?.message))) throw e;
        return { run, out: null, refusal: e, exit: null };
    }
}
const keys = (out) => out.perTick.map((h) => [...h].sort().join('+'));
const ON = (fn) => withDrillExitPass(true, fn);
const OFF = (fn) => withDrillExitPass(false, fn);

describe('hammer-phase DRILL-EXIT-PASS: the switch', () => {
    it('ships OFF, and the env alone turns it on', () => {
        expect(DRILL_EXIT_PASS_DEFAULT).toBe(false);
        expect(DRILL_EXIT_PASS.enabled).toBe(globalThis.process?.env?.SEEDLING_DRILL_EXIT_PASS === '1');
        ON(() => expect(DRILL_EXIT_PASS.enabled).toBe(true));
        OFF(() => expect(DRILL_EXIT_PASS.enabled).toBe(false));
    });
});

describe('hammer-phase DRILL-EXIT-PASS: L91, a sword held (legs 717–720)', () => {
    it('OFF: 718 and 719 refuse EXHAUSTED on drill@64,80 (the census\'s W3)', () => OFF(() => {
        for (const id of [718, 719]) {
            const r = solveLeg(id);
            expect(r.refusal?.message).toMatch(/reach-exit \(\d+,\d+\)->L\d+: the combat ladder is EXHAUSTED\. The corridor passes through danger at \([\d.]+,[\d.]+\) — enemy:drill@64,80/);
        }
    }), 120000);

    it('ON: 718 SOLVES — a certified timed pass of 190 t to the L92 crossing, hitless; replayed on a fresh run', () => ON(() => {
        DRILL_EXIT_PASS_COUNTS.armed.length = 0;
        const r = solveLeg(718);
        expect(r.refusal).toBeNull();
        expect(r.out.perTick.length).toBe(190);
        expect(r.run.level).toBe(92);
        expect((r.run.ledger('playerHits') ?? []).length).toBe(0);
        expect(r.exit.drillPass).toMatchObject({ verb: 'drill-pass-exit', drills: ['drill@64,80'], to: 92, ticks: 190,
            certified: true });
        // the walk refused first, before a tick (the census's EXHAUSTED), then the armed pass
        expect(DRILL_EXIT_PASS_COUNTS.armed).toEqual([{ level: 91, door: expect.any(Number), weapon: 'sword',
            drills: ['drill@64,80'] }]);
        // 30(c): the keys driven on a fresh run of the same staging cross to L92 with no hit and no death.
        const fresh = createRunForStaging(LEGS[718].staging, SRC);
        let crossed = null;
        for (const k of r.out.perTick) crossed = fresh.advance(new Set(k)).transition ?? crossed;
        expect(crossed?.to_level).toBe(92);
        expect(fresh.level).toBe(92);
        expect((fresh.ledger('playerHits') ?? []).length).toBe(0);
        expect(fresh.playerDeaths.length).toBe(0);
    }), 180000);

    it('ON, drillTerrainSwitch OFF: 719 REFUSES by name — the drill\'s hop into water is not modelled (fidelity DRILL D2), never a wrong plan', () => ON(() => withContactFidelity({ drillTerrainSwitch: false }, () => {
        // ⛓ the fidelity-OFF witness since fidelity DRILLWATER's flip (⚖ user 2026-11-08): the shipped default solves 719 (below).
        const r = solveLeg(719);
        expect(r.refusal).not.toBeNull();
        // the guard fired on the certificate's FORK: the run itself never played the pass
        expect(r.run.ticksCompleted).toBe(0);
        expect(r.refusal.message).toMatch(/drill@64,80 in level 91 hops onto tile type 1 at \(40,120\) on tick \d+; `Enemy\.update`'s terrain switch \(water, lava, a pit\) is not modelled for a drill\. Refused by name \(fidelity DRILL D2\)/);
    })), 180000);

    it('ON (drillTerrainSwitch ON, the shipped default): 719 SOLVES — a certified 223 t pass to L89, hitless; replayed on a '
        + 'fresh run; 718 is unchanged (190 t)', () => ON(() => {
        // ⛓ fidelity DRILLWATER's flip: the drill follows the player onto the water at (40,120) and drowns
        // (`Enemy.update`'s terrain switch), so the pass the D2 guard refused above is now modelled and certified.
        const r = solveLeg(719);
        expect(r.refusal).toBeNull();
        expect(r.out.perTick.length).toBe(223);
        expect(r.run.level).toBe(89);
        expect((r.run.ledger('playerHits') ?? []).length).toBe(0);
        expect(r.exit.drillPass).toMatchObject({ verb: 'drill-pass-exit', drills: ['drill@64,80'], to: 89, ticks: 223,
            certified: true });
        const fresh = createRunForStaging(LEGS[719].staging, SRC);
        let crossed = null;
        for (const k of r.out.perTick) crossed = fresh.advance(new Set(k)).transition ?? crossed;
        expect(crossed?.to_level).toBe(89);
        expect((fresh.ledger('playerHits') ?? []).length).toBe(0);
        expect(fresh.playerDeaths.length).toBe(0);
        // the key moves 719 only: 718's pass is the same 190 t under the shipped default
        const r718 = solveLeg(718);
        expect(r718.refusal).toBeNull();
        expect(r718.out.perTick.length).toBe(190);
        expect(r718.run.level).toBe(92);
    }), 240000);

    it.each([[717], [720], [707]])('ON = OFF on leg %i (the walk solves, so no pass is asked)', (id) => {
        const off = OFF(() => solveLeg(id));
        const on = ON(() => solveLeg(id));
        expect(off.refusal).toBeNull();
        expect(on.refusal).toBeNull();
        expect(keys(on.out)).toEqual(keys(off.out));
        expect(on.exit.drillPass).toBeUndefined();
    }, 120000);
});

describe('hammer-phase DRILL-EXIT-PASS: a walk that refuses after spending ticks (L88)', () => {
    it('ON = OFF on leg 704: the refusal is the walk\'s, word for word, and no pass is asked', () => {
        const off = OFF(() => solveLeg(704));
        DRILL_EXIT_PASS_COUNTS.armed.length = 0;
        const on = ON(() => solveLeg(704));
        expect(off.refusal).not.toBeNull();
        expect(on.refusal?.message).toBe(off.refusal.message);
        expect(DRILL_EXIT_PASS_COUNTS.armed).toEqual([]);
    }, 180000);
});

describe('hammer-phase DRILL-EXIT-PASS: residue D-A\'s L28 Sword row, ON', () => {
    const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
        obstacle: 'rope@160,64' });
    it('the kill, the cut and the exit from the L26 arrival plan what OFF plans, tick for tick', () => {
        const boot = { level: 28, x: 16, y: 96 };
        const solve = () => {
            const staging = arrivalStaging(boot, { items: ['hasSword'] });
            return solveSegment({ run: createRunForStaging(staging, SRC),
                goals: [{ ...L28_CUT }, { kind: 'reach-exit', exit: { x: 96, y: 0 } }], name: 'drill-exit-l28', boot,
                forkRun: () => createRunForStaging(staging, SRC) });
        };
        const off = OFF(solve);
        const on = ON(solve);
        expect(keys(on)).toEqual(keys(off));
        expect((on.records ?? []).find((r) => r.goal === 'reach-exit').drillPass).toBeUndefined();
    }, 180000);
});
