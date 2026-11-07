/**
 * ⛓⛓⛓ SEEDLING FIDELITY CEREMONYEXACT (wave 37c) — `ceremonyPressForecast` made EXACT (one tick, stepped).
 *
 * CEREMONY126's D1 refused a press whenever a pickup lay within `aheadTicks × oneTickTravelBound` of the player — a
 * CONSERVATIVE bound that stood down where the next tick would not touch (W0 here: 19 / 18 / 84 stand-downs on L40
 * legs 368 / 371 and the L40 kill rung, NONE of which the exact forecast refuses; they moved the WANDHOLD / L100FIX
 * witness plans and hammer's kill-rung pins). The exact forecast (`levelRun.ceremonyStepNow`, carried non-enumerable
 * on `freezeForecast` as `ceremonyStep`) steps the held sets the policy is about to send with the run's own stepper
 * and refuses only when a pickup's ceremony would start on the press's thrust tick. Game witnesses:
 * `ceremony126-lost` (input 43, LOST) and `ceremonyexact-kept` (input 42, the bound refused it, the exact forecast
 * does not) — p4g headless, 0 px (`fixtures/ceremony126-witness/`).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { withContactFidelity } from './contactFidelity.js';
import {
    CEREMONY126_SPAN, CEREMONY126_WITNESS_DIR, CEREMONYEXACT_KEPT_PRESS, ceremony126LostTape, ceremony126ModelSamples,
    ceremonyExactKeptTape, compareCeremony126Witness, unpackCeremony126Sample,
} from './fidelityCeremony126.js';
import {
    CEREMONY_EXACT_COUNTS, CEREMONY_PRESS_COUNTS, STRIKE_AIM, STRIKE_NONE, STRIKE_PRESS, ceremonyExact, ceremonyGuard,
    ceremonyReach, createStrikePolicy, oneTickTravelBound,
} from './strikePolicy.js';
import { FACING_KEYS, facingToward } from './solverBot.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

/** A forecast whose `ceremonyStep` answers `answer(held)` and counts its asks (non-enumerable, as the run's). */
function fakeFreeze(pickupGap, answer) {
    const asked = [];
    const f = { refusedNext: false, timerNext: 0, contact: null, pickupGap };
    Object.defineProperty(f, 'ceremonyStep', {
        value: (held) => { asked.push(held.map((h) => [...h].sort().join('+'))); return answer(held); },
        enumerable: false,
    });
    return { f, asked };
}

describe('CEREMONYEXACT — `ceremonyGuard`\'s exact arm', () => {
    it('`ceremonyReach` is `oneTickTravelBound` at one tick and sound tick by tick beyond it', () => {
        expect(ceremonyReach(1.5, -2, 1)).toBeCloseTo(oneTickTravelBound(1.5, -2), 12);
        const add = oneTickTravelBound(0, 0);
        expect(ceremonyReach(0, 0, 2)).toBeCloseTo(3 * add, 12);
        expect(ceremonyReach(3, 4, 2)).toBeCloseTo(10 + 3 * add, 12);
    });
    it('no `held` (a 3-argument caller, hammer\'s OPP-FREEZE) or no `ceremonyStep`: CEREMONY126\'s bound, unchanged', () => {
        const { f, asked } = fakeFreeze(0.5, () => null);
        expect(ceremonyGuard({ vx: 2, vy: 0 }, f, 1)).toMatchObject({ pickupGap: 0.5, aheadTicks: 1 });
        expect(ceremonyGuard({ vx: 2, vy: 0 }, f, 1).exact).toBeUndefined();
        expect(asked).toEqual([]);
        const plain = { refusedNext: false, timerNext: 0, contact: null, pickupGap: 0.5 };
        expect(ceremonyExact(plain)).toBe(false);
        expect(ceremonyGuard({ vx: 2, vy: 0 }, plain, 1, { held: [new Set(['primary'])] }))
            .toEqual({ pickupGap: 0.5, bound: oneTickTravelBound(2, 0), aheadTicks: 1 });
        expect(ceremonyGuard({ vx: 2, vy: 0 }, null, 1, { held: [new Set(['primary'])] })).toBe(null);
        expect(ceremonyGuard({ vx: 2, vy: 0 }, { pickupGap: null }, 1, { held: [new Set(['primary'])] })).toBe(null);
    });
    it('with `held`: refuses ONLY when the step names a ceremony; a gap beyond the n-tick reach is not stepped', () => {
        const before = { ...CEREMONY_EXACT_COUNTS };
        const clear = fakeFreeze(0.5, () => null);
        expect(ceremonyGuard({ vx: 2, vy: 0 }, clear.f, 1, { held: [new Set(['primary'])] })).toBe(null);
        expect(clear.asked).toEqual([['primary']]);
        const hit = fakeFreeze(0.5, () => ({ at: 1, tag: 'ghostspear', x: 72, y: 24 }));
        expect(ceremonyGuard({ vx: 2, vy: 0 }, hit.f, 1, { held: [new Set(['primary', 'up'])] }))
            .toMatchObject({ exact: true, startsAt: 1, pickup: 'ghostspear@72,24', aheadTicks: 1 });
        const far = fakeFreeze(ceremonyReach(2, 0, 2) + 0.01, () => ({ at: 1, tag: 'x', x: 0, y: 0 }));
        expect(ceremonyGuard({ vx: 2, vy: 0 }, far.f, 2, { held: [new Set(['up']), new Set(['primary'])] })).toBe(null);
        expect(far.asked).toEqual([]);
        expect(CEREMONY_EXACT_COUNTS.stepped - before.stepped).toBe(2);
        expect(CEREMONY_EXACT_COUNTS.cleared - before.cleared).toBe(1);
    });
});

describe('CEREMONYEXACT — the policy asks with the keys it sends', () => {
    const body = { id: 'bob@0,0', as3: 'Bob', rect: { x: 100, y: 84, w: 12, h: 12, right: 112, bottom: 96 }, hitsTimer: 0 };
    const state = { x: 106, y: 104, vx: 0, vy: 0, direction: 1 };
    const policy = () => createStrikePolicy({ facingToward, facingKeys: FACING_KEYS });

    it('an aim is asked (its key, then the press alone) only once the pick is known; a clear step aims and presses', () => {
        const p = policy();
        const { f, asked } = fakeFreeze(0, () => null);
        const aim = p.decide(state, [body], 10, new Set(['left']), { freeze: f });
        expect(aim.decision).toBe(STRIKE_AIM);
        expect(asked).toEqual([[[...aim.held][0], 'primary']]);
        const press = p.decide(state, [body], 11, new Set(['left']), { freeze: f });
        expect(press.decision).toBe(STRIKE_PRESS);
        expect(asked.at(-1)).toEqual(['primary']);
    });
    it('a step that names a ceremony drops the aim (counted, traced by pickup), and the press half too', () => {
        const before = { ...CEREMONY_PRESS_COUNTS };
        const p = policy();
        const hit = fakeFreeze(0, () => ({ at: 2, tag: 'ghostspear', x: 72, y: 24 }));
        expect(p.decide(state, [body], 10, new Set(['left']), { freeze: hit.f }).decision).toBe(STRIKE_NONE);
        expect(p.trace.at(-1)).toMatchObject({ tick: 10, target: 'bob@0,0',
            ceremonyRefused: { exact: true, startsAt: 2, pickup: 'ghostspear@72,24' } });
        expect(p.trace.at(-1).why).toContain('ghostspear@72,24');
        expect(CEREMONY_PRESS_COUNTS.aim - before.aim).toBe(1);
        // aimed on a clear tick, the press half then meets the ceremony
        const q = policy();
        let ceremonyNext = false;
        const mixed = fakeFreeze(0, () => (ceremonyNext ? { at: 1, tag: 'ghostspear', x: 72, y: 24 } : null));
        expect(q.decide(state, [body], 10, new Set(), { freeze: mixed.f }).decision).toBe(STRIKE_AIM);
        ceremonyNext = true;
        expect(q.decide(state, [body], 11, new Set(), { freeze: mixed.f }).decision).toBe(STRIKE_NONE);
        expect(CEREMONY_PRESS_COUNTS.press - before.press).toBe(1);
        expect(q.aimed).toBe(null);
    });
});

/** The model's run over a tape, stopped at the boundary before input `k`, with the key ON. */
function runAt(tapeJson, k) {
    return withContactFidelity({ ceremonyPressForecast: true }, () => {
        const tape = parseTape(JSON.stringify(tapeJson));
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        for (let i = 0; i <= k; i += 1) st.next();
        return { run, tape };
    });
}

describe('CEREMONYEXACT — the exact forecast on L64 (route-survey step 125)', () => {
    it('OFF the forecast carries neither `pickupGap` nor `ceremonyStep`; ON its enumerable shape is CEREMONY126\'s', () => {
        const off = withContactFidelity({ ceremonyPressForecast: false }, () => {
            const { run } = runAt(ceremony126LostTape(false), 43);
            return run.progress('freezeForecast');
        });
        expect(Object.keys(off).sort()).toEqual(['contact', 'refusedNext', 'timerNext']);
        expect(ceremonyExact(off)).toBe(false);
        const { run } = runAt(ceremony126LostTape(false), 43);
        const on = withContactFidelity({ ceremonyPressForecast: true }, () => run.progress('freezeForecast'));
        expect(Object.keys(on).sort()).toEqual(['contact', 'pickupGap', 'refusedNext', 'timerNext']);
        expect(JSON.parse(JSON.stringify(on))).toEqual({ ...on });
        expect(ceremonyExact(on)).toBe(true);
        expect(Object.getOwnPropertyDescriptor(on, 'ceremonyStep').enumerable).toBe(false);
    });
    it('input 43 (the lost press): the ceremony starts on its thrust\'s tick; input 42 (kept): the bound refuses, exact does not', () => {
        for (const [k, startsAt] of [[CEREMONYEXACT_KEPT_PRESS - 2, null], [CEREMONYEXACT_KEPT_PRESS - 1, null],
            [CEREMONYEXACT_KEPT_PRESS, null], [CEREMONYEXACT_KEPT_PRESS + 1, 1]]) {
            const { run, tape } = runAt(ceremony126LostTape(false), k);
            withContactFidelity({ ceremonyPressForecast: true }, () => {
                const f = run.progress('freezeForecast');
                const held = [new Set([...heldKeysAt(tape, k), 'primary'])];
                expect(ceremonyGuard(run.state, f, 1)).not.toBe(null);
                const exact = ceremonyGuard(run.state, f, 1, { held });
                if (startsAt === null) expect(exact).toBe(null);
                else expect(exact).toMatchObject({ exact: true, startsAt, pickup: 'ghostspear@72,24' });
            });
        }
    });
    it('a PURE READ: asking the step moves no digest part and no tick (DIGESTREAD)', () => {
        const { run, tape } = runAt(ceremony126LostTape(false), 43);
        withContactFidelity({ ceremonyPressForecast: true }, () => {
            const before = run.stateDigest();
            const t = run.ticksCompleted;
            const s = { ...run.state };
            const f = run.progress('freezeForecast');
            expect(f.ceremonyStep([new Set([...heldKeysAt(tape, 43), 'primary'])])).toMatchObject({ at: 1, tag: 'ghostspear' });
            expect(f.ceremonyStep([new Set(['down']), new Set(['primary'])])).toBe(null);
            expect(run.stateDigest()).toBe(before);
            expect(run.ticksCompleted).toBe(t);
            expect(run.state).toEqual(s);
        });
    });
});

describe('CEREMONYEXACT — the game witness `ceremonyexact-kept` (p4g, 0 px)', () => {
    const path = join(CEREMONY126_WITNESS_DIR, 'ceremonyexact-kept.json');
    it('the model authors the kept press (no `FROZEN_TICK_PRESS`) and its ceremony holds the measured span', async () => {
        const m = await ceremony126ModelSamples(ceremonyExactKeptTape());
        expect(m.error).toBe(null);
        expect([m.ceremony[0], m.ceremony.at(-1)]).toEqual([CEREMONY126_SPAN.firstObs, CEREMONY126_SPAN.lastObs]);
        expect(m.samples.at(-1).level).toBe(62);
    });
    it.skipIf(!existsSync(path))('the game reproduces the model every sampled tick', async () => {
        const w = JSON.parse(readFileSync(path, 'utf8'));
        expect(w.page).toBe('seedling_bot_ap_p4g');
        expect(w.tape.inputs).toEqual(ceremonyExactKeptTape().inputs);
        const model = await ceremony126ModelSamples(ceremonyExactKeptTape());
        const game = w.samples.map(unpackCeremony126Sample);
        expect(game.length).toBeGreaterThan(140);
        expect(compareCeremony126Witness(game, model.samples)).toEqual([]);
    });
});
