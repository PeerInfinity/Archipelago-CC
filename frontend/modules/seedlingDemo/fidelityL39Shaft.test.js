/**
 * ⛓⛓⛓ SEEDLING FIDELITY L39SHAFT (wave 31) — L39's three-block shaft, the user's solution (⚖ 2026-10-25), as a
 * licensed solver special case (`CONTACT_FIDELITY.l39ShaftPress`, OFF) and two game witnesses (`fidelityL39Shaft.js`):
 *   · D1 `l39shaft-scripted` — `r5-shaft`'s committed tape (`SHAFT_PLAN`), p4g headless on the page's own levels;
 *   · D2 `l39shaft-solver-step66` — the route survey's step 66 SOLVED with `l39ShaftPress` + `collectSpanAim` ON, p4g
 *     headless on the delivered set, replayed with `spinnerPointExact` ON.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    L39_BUTTONS, L39SHAFT_SCRIPTED_WITNESS, L39SHAFT_SOLVER_WITNESS, L39SHAFT_WITNESS_DIR, buttonsUnder,
    compareL39Witness, halfOnReadout, l39LevelSource, l39ModelSamples, lockTimeline, unpackL39Sample,
} from './fidelityL39Shaft.js';
import { L39_SHAFT, STRATEGY_EXECUTORS, l39ShaftIn, l39ShaftState, solveSegment } from './solverBot.js';
import { spinnerFriction } from './spinner.js';
import { spinnerFrictionExact } from './spinnerPoint.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const load = (name) => JSON.parse(readFileSync(join(L39SHAFT_WITNESS_DIR, `${name}.json`), 'utf8'));
const D1 = load(L39SHAFT_SCRIPTED_WITNESS);
const D2 = load(L39SHAFT_SOLVER_WITNESS);
const D1_GAME = D1.samples.map(unpackL39Sample);
const D2_GAME = D2.samples.map(unpackL39Sample);
const KEYS = ['l39ShaftPress', 'collectSpanAim', 'spinnerPointExact'];
const ON = Object.freeze({ l39ShaftPress: true, collectSpanAim: true, spinnerPointExact: true });
const GOALS = Object.freeze([{ kind: 'collect-placement', placement: { x: 72, y: 40 } },
    { kind: 'reach-exit', exit: { x: 144, y: 0 } }]);

/** D2's boot staging: the recorded tape's own, without the solve's equips (the staging the survey handed over). */
const d2Staging = () => {
    const tape = parseTape(JSON.stringify(D2.tape));
    return { tape, staging: { ...stagingFromTape(tape), equips: [] } };
};

/**
 * A model run on the delivered set, advanced through D2's first `n` ticks: the tape's own keys, and its equips BEFORE
 * tick `n` (a later one is the solve's own, and a staged equip at a tick the solver also selects on is refused).
 */
const d2RunAt = async (n) => {
    const { tape } = d2Staging();
    const staging = stagingFromTape(tape);
    const run = createRunForStaging({ ...staging, equips: staging.equips.filter((e) => e.t < n) },
        await l39LevelSource('delivered'));
    const prefix = [];
    for (let t = 0; t < n; t += 1) {
        const held = new Set(heldKeysAt(tape, t));
        prefix.push(held);
        run.advance(held);
    }
    return { run, prefix, boot: tape.boot };
};

describe('L39SHAFT — the switches', () => {
    // ⛓ planning-13's wave-31 flip (⚖ user 2026-10-25, "Flip all 3 ON").
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('all three ship ON', () => {
        for (const k of KEYS) {
            expect(CONTACT_FIDELITY_DEFAULTS[k]).toBe(true);
            expect(CONTACT_FIDELITY[k]).toBe(true);
        }
    });

    it('OFF: `l39shaft` is not a registered verb (switch-gated, not enumerable); ON it is', () => {
        withContactFidelity({ l39ShaftPress: false }, () => expect(STRATEGY_EXECUTORS.l39shaft).toBeUndefined());
        expect(Object.keys(STRATEGY_EXECUTORS)).not.toContain('l39shaft');
        withContactFidelity({ l39ShaftPress: true }, () => expect(typeof STRATEGY_EXECUTORS.l39shaft).toBe('function'));
    });

    it('`spinnerPointExact` OFF is `spinnerFriction`\'s old spelling (`Math.hypot`, `(v / len) * t`); ON it is the '
        + 'runtime\'s `Point` (`sqrt(x*x + y*y)`, `v * (t / len)`) — one ulp apart on a decaying knockback', () => {
        const knock = { vx: 1.6108428073440353, vy: -0.4850286490610595 };
        const old = withContactFidelity({ spinnerPointExact: false }, () => spinnerFriction(knock.vx, knock.vy));
        const neu = withContactFidelity({ spinnerPointExact: true }, () => spinnerFriction(knock.vx, knock.vy));
        expect(neu).toEqual(spinnerFrictionExact(knock.vx, knock.vy, { f: 0.25, moveSpeed: 1, zeroBand: 0.05 }));
        expect(old.vx).toBe(neu.vx);
        expect(old.vy).toBe(-0.4129496054322);
        expect(neu.vy).toBe(-0.41294960543219994);
    });
});

describe('L39SHAFT — the room and its states', () => {
    it('a block straddling an inner and an outer button is on both (the half-on readout, from positions)', () => {
        // (9,8) → (9,7) mid-glide: 8 px north of the inner button's cell
        expect(buttonsUnder(144, 120).sort()).toEqual(['button@144,112', 'button@144,128']);
        expect(buttonsUnder(144, 128)).toEqual(['button@144,128']);
        expect(buttonsUnder(144, 112)).toEqual(['button@144,112']);
        expect(L39_BUTTONS.filter((b) => b.ring === 'inner').map((b) => b.id))
            .toEqual(L39_SHAFT.inner.map((s) => s.presser));
        expect(L39_BUTTONS.filter((b) => b.ring === 'outer').map((b) => b.id))
            .toEqual(L39_SHAFT.outer.map((s) => s.presser));
    });

    it('the solver reads which state the shaft is in, through D2: boot, one, two, all three inner, outer, open', async () => {
        const labels = [];
        for (const t of [0, 300, 800, 2330, 2420, 2500]) {
            const { run } = await d2RunAt(t);
            expect(l39ShaftIn(run)).toBe(true);
            const s = l39ShaftState(run);
            labels.push(`${s.label}${s.locksOpen ? ' open' : ''}`);
        }
        expect(labels).toEqual(['inner 0/3', 'inner 1/3', 'inner 2/3', 'inner', 'outer', 'outer open']);
    }, 120_000);
});

describe('L39SHAFT D1 — the user\'s solution on the game (`l39shaft-scripted`, p4g headless, the page\'s levels)', () => {
    it('the recording replays at 0 px: the player, every fire block, every spinner and L39\'s lock tags, every tick',
        async () => {
            const model = await l39ModelSamples(D1.tape, {}, { set: 'vanilla' });
            expect(model.error).toBeNull();
            expect(D1_GAME.length).toBeGreaterThan(2700);
            expect(compareL39Witness(D1_GAME, model.samples, { lockLag: D1.lockLag })).toEqual([]);
        }, 240_000);

    it('the half-on moment: for 11 ticks (t2250..t2260) every block is on an inner AND an outer button, and the '
        + 'three locks then write {39,0} {39,2} at t2349 and {39,1} at t2351; the pocket lock {39,7} is taken back', () => {
        const h = halfOnReadout(D1_GAME);
        expect(h.allThreeTwoOn).toEqual([2250, 2251, 2252, 2253, 2254, 2255, 2256, 2257, 2258, 2259, 2260]);
        expect(h.allOuter).toBe(2250);
        const pairs = h.twoOn.find((r) => r.t === 2250).under.map((u) => [...u].sort().join(' ')).sort();
        expect(pairs).toEqual(['button@112,144 button@128,144', 'button@144,112 button@144,128',
            'button@160,144 button@176,144']);
        expect(lockTimeline(D1_GAME)).toEqual({ 0: [{ cleared: 2349 }], 1: [{ cleared: 2351 }], 2: [{ cleared: 2349 }],
            7: [{ cleared: 648 }, { restored: 2262 }] });
    });
});

describe('L39SHAFT D2 — the solver\'s own plan on the game (`l39shaft-solver-step66`, p4g, the delivered set)', () => {
    it('the recording replays at 0 px with `spinnerPointExact` ON, and the solved plan ends in L40', async () => {
        const model = await l39ModelSamples(D2.tape, { spinnerPointExact: true }, { set: 'delivered' });
        expect(model.error).toBeNull();
        expect(D2_GAME.length).toBeGreaterThan(3400);
        expect(compareL39Witness(D2_GAME, model.samples, { lockLag: D2.lockLag })).toEqual([]);
        expect(D2.end.level).toBe(40);
        const h = halfOnReadout(D2_GAME);
        expect(h.allThreeTwoOn.length).toBe(11);
        expect(h.allThreeTwoOn).toEqual(halfOnReadout(model.samples).allThreeTwoOn);
    }, 240_000);

    it('MUTANT/CONTROL: with `spinnerPointExact` OFF the same recording disagrees on a spinner, by one ulp', async () => {
        const model = await l39ModelSamples(D2.tape, { spinnerPointExact: false }, { set: 'delivered' });
        const bad = compareL39Witness(D2_GAME, model.samples, { lockLag: D2.lockLag });
        expect(bad.length).toBeGreaterThan(0);
        expect(bad[0]).toMatch(/^t \d+: spinners game/);
        expect(bad.every((b) => b.includes('spinners'))).toBe(true);
    }, 240_000);

    it('the solver, keys ON, plans exactly the recorded tape from the same boot (the survey\'s staging)', async () => {
        const { tape, staging } = d2Staging();
        const levelSource = await l39LevelSource('delivered');
        const solved = await withContactFidelity(ON, () => twoPassSolve({
            makeRun: (persistence) => createRunForStaging({ ...staging, persistence }, levelSource),
            goals: GOALS, name: 'l39shaft-d2', boot: staging.boot, persistence: staging.persistence, log: () => {},
        }));
        expect(solved.out.perTick.length).toBe(tape.tick_count);
        solved.out.perTick.forEach((held, t) => expect([...held].sort()).toEqual([...heldKeysAt(tape, t)].sort()));
        expect(solved.out.equips).toEqual(tape.equips);
        const verbs = solved.out.trace.rows.map((r) => r.strategy?.verb).filter(Boolean);
        expect(verbs).toContain('l39shaft');
    }, 240_000);

    it('CONTROL: OFF, the same boot refuses three links deep — "no REACHABLE stance inside button@144,112"',
        async () => {
            const { staging } = d2Staging();
            const levelSource = await l39LevelSource('delivered');
            await expect(withContactFidelity({ l39ShaftPress: false }, () => twoPassSolve({
                makeRun: (persistence) => createRunForStaging({ ...staging, persistence }, levelSource),
                goals: GOALS, name: 'l39shaft-off', boot: staging.boot, persistence: staging.persistence, log: () => {},
            }))).rejects.toThrow(/no REACHABLE stance inside button@144,112/);
        }, 240_000);

    it('CONTROL: `l39ShaftPress` ON without `collectSpanAim`, the shaft opens and the part\'s approach drifts into '
        + '(4,1)\'s wall', async () => {
        const { staging } = d2Staging();
        const levelSource = await l39LevelSource('delivered');
        await expect(withContactFidelity({ l39ShaftPress: true, collectSpanAim: false }, () => twoPassSolve({
            makeRun: (persistence) => createRunForStaging({ ...staging, persistence }, levelSource),
            goals: GOALS, name: 'l39shaft-noaim', boot: staging.boot, persistence: staging.persistence, log: () => {},
        }))).rejects.toThrow(/sweep was blocked by tile:Blue Wall \(dark\) at \(72,24\)/);
    }, 240_000);
});

describe('L39SHAFT D2 — either state: the solver knows which one it is in and does only what is left', () => {
    const exit = Object.freeze([{ kind: 'reach-exit', exit: { x: 144, y: 0 } }]);
    const solveFrom = async (t) => {
        const { run, prefix, boot } = await d2RunAt(t);
        return withContactFidelity(ON, () => solveSegment({ run, prefix, goals: exit, name: `l39shaft-from-${t}`, boot }));
    };
    const shaftRecord = (out) => out.records.find((r) => r.strategy === 'l39shaft');

    it('all three blocks already on the inner buttons (t2330): no route, one press between them, the fade', async () => {
        const out = await solveFrom(2330);
        const rec = shaftRecord(out);
        expect(rec.start).toBe('inner');
        expect(rec.parks.filter((p) => !p.press)).toEqual([]);
        expect(rec.parks.filter((p) => p.press).length).toBe(1);
        expect(rec.dwell?.ticks).toBeGreaterThan(0);
    }, 240_000);

    it('the blocks already on the outer buttons (t2420, the locks fading): neither route nor press, the fade alone',
        async () => {
            const out = await solveFrom(2420);
            const rec = shaftRecord(out);
            expect(rec.start).toBe('outer');
            expect(rec.parks).toEqual([]);
            expect(rec.dwell?.ticks).toBeGreaterThan(0);
        }, 240_000);

    it('one block home (t300): the two other inner buttons are routed, then the press', async () => {
        const out = await solveFrom(300);
        const rec = shaftRecord(out);
        expect(rec.start).toBe('inner 1/3');
        expect(rec.parks.filter((p) => !p.press).map((p) => p.presser)).toEqual(['button@160,144', 'button@128,144']);
        expect(rec.parks.filter((p) => p.press).length).toBe(1);
    }, 240_000);
});
