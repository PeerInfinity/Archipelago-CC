/**
 * ⛓⛓⛓ SEEDLING FIDELITY CEREMONY126 (wave 37b) — route-survey step 125 (L64 Ghostspear; the brief's "126").
 * Key `ceremonyPressForecast` (D1, OFF): the walk's strike stands down where a pickup's ceremony would swallow its
 * thrust (`levelRun.freezeForecast.pickupGap`, `strikePolicy.ceremonyGuard`). Key `ceremonyWalkHandoff` (D2, OFF): the
 * collect goal's stance walk ends when its pickup's ceremony starts on it, and the verb pages it. The witnesses are
 * recorded on the game (`fixtures/ceremony126-witness/`, p4g headless, 0 px).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    CEREMONY126_SPAN, CEREMONY126_WITNESS_DIR, ceremony126LostTape, ceremony126ModelSamples, ceremony126SolvedTape,
    compareCeremony126Witness, unpackCeremony126Sample,
} from './fidelityCeremony126.js';
import {
    CEREMONY_PRESS_COUNTS, STRIKE_AIM, STRIKE_NONE, STRIKE_PRESS, ceremonyGuard, createStrikePolicy,
} from './strikePolicy.js';
import { FACING_KEYS, facingToward } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

describe('CEREMONY126 — the switches', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_CEREMONY_PRESS_FORECAST
        || process.env.SEEDLING_CEREMONY_WALK_HANDOFF)(
        'both keys ship OFF, last in the defaults (D1 then D2); their env names are in the worker channel', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.ceremonyPressForecast).toBe(false);
            expect(CONTACT_FIDELITY_DEFAULTS.ceremonyWalkHandoff).toBe(false);
            expect(CONTACT_FIDELITY.ceremonyPressForecast).toBe(false);
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(-2)).toEqual(['ceremonyPressForecast', 'ceremonyWalkHandoff']);
        });
    it('the env names are known worker env names', () => {
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CEREMONY_PRESS_FORECAST');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CEREMONY_WALK_HANDOFF');
    });
});

describe('CEREMONY126 D1 — `ceremonyGuard` and the policy', () => {
    it('`ceremonyGuard`: no forecast, or a forecast without `pickupGap` (the key OFF), is clear', () => {
        expect(ceremonyGuard({ vx: 1, vy: 1 }, null, 1)).toBe(null);
        expect(ceremonyGuard({ vx: 1, vy: 1 }, { refusedNext: false, timerNext: 0, contact: null }, 1)).toBe(null);
        expect(ceremonyGuard({ vx: 1, vy: 1 }, { pickupGap: null }, 1)).toBe(null);
    });
    it('`ceremonyGuard`: a gap within the travel bound refuses; the aim\'s two-tick bound reaches further', () => {
        expect(ceremonyGuard({ vx: 0, vy: 0 }, { pickupGap: 0 }, 1)).toMatchObject({ pickupGap: 0, aheadTicks: 1 });
        const far = { pickupGap: 1000 };
        expect(ceremonyGuard({ vx: 2, vy: 2 }, far, 2)).toBe(null);
        const one = ceremonyGuard({ vx: 2, vy: 0 }, { pickupGap: 0.5 }, 1);
        expect(one).not.toBe(null);
        expect(ceremonyGuard({ vx: 2, vy: 0 }, { pickupGap: one.bound * 1.5 }, 1)).toBe(null);
        expect(ceremonyGuard({ vx: 2, vy: 0 }, { pickupGap: one.bound * 1.5 }, 2)).not.toBe(null);
    });

    const body = { id: 'bob@0,0', as3: 'Bob', rect: { x: 100, y: 84, w: 12, h: 12, right: 112, bottom: 96 }, hitsTimer: 0 };
    const state = { x: 106, y: 104, vx: 0, vy: 0, direction: 1 };
    const policy = () => createStrikePolicy({ facingToward, facingKeys: FACING_KEYS });
    const CLEAR = { refusedNext: false, timerNext: 0, contact: null, pickupGap: null };
    const AT = { refusedNext: false, timerNext: 0, contact: null, pickupGap: 0 };

    it('the control: no pickup near — aim, then press', () => {
        const p = policy();
        expect(p.decide(state, [body], 10, new Set(), { freeze: CLEAR }).decision).toBe(STRIKE_AIM);
        expect(p.decide(state, [body], 11, new Set(), { freeze: CLEAR }).decision).toBe(STRIKE_PRESS);
    });
    it('an owed press with a pickup at the box is DROPPED (walk keys kept); the aim is refused too; clear again → aim', () => {
        const before = { ...CEREMONY_PRESS_COUNTS };
        const p = policy();
        expect(p.decide(state, [body], 10, new Set(), { freeze: CLEAR }).decision).toBe(STRIKE_AIM);
        const walk = new Set(['up']);
        const d = p.decide(state, [body], 11, walk, { freeze: AT });
        expect(d.decision).toBe(STRIKE_NONE);
        expect(d.held).toBe(walk);
        expect(p.aimed).toBe(null);
        expect(p.trace.at(-1)).toMatchObject({ tick: 11, target: 'bob@0,0', ceremonyRefused: { pickupGap: 0 } });
        expect(p.decide(state, [body], 12, new Set(), { freeze: AT }).decision).toBe(STRIKE_NONE);
        expect(CEREMONY_PRESS_COUNTS.press - before.press).toBe(1);
        expect(CEREMONY_PRESS_COUNTS.aim - before.aim).toBe(1);
        expect(p.decide(state, [body], 13, new Set(), { freeze: CLEAR }).decision).toBe(STRIKE_AIM);
    });
});

describe('CEREMONY126 — the model of the witnesses', () => {
    it('the solved tape replays; the ceremony holds the measured span; the spear is collected', async () => {
        const m = await ceremony126ModelSamples(ceremony126SolvedTape());
        expect(m.error).toBe(null);
        expect([m.ceremony[0], m.ceremony.at(-1)]).toEqual([CEREMONY126_SPAN.firstObs, CEREMONY126_SPAN.lastObs]);
        expect(m.collected.map((c) => [c.level, c.item])).toEqual([[64, 'spear']]);
        expect(m.samples.at(-1).level).toBe(62);
        expect(m.samples.every((s) => s.hits === 0)).toBe(true);
    });
    it('the model refuses to author the lost press (`FROZEN_TICK_PRESS`); without it, the tape replays', async () => {
        expect((await ceremony126ModelSamples(ceremony126LostTape(true))).error).toBe('FROZEN_TICK_PRESS');
        expect((await ceremony126ModelSamples(ceremony126LostTape(false))).error).toBe(null);
    });
});

for (const name of ['ceremony126-solved', 'ceremony126-lost']) {
    const path = join(CEREMONY126_WITNESS_DIR, `${name}.json`);
    describe(`CEREMONY126 — the game witness ${name} (p4g, 0 px)`, () => {
        it.skipIf(!existsSync(path))('the game reproduces the model every sampled tick', async () => {
            const w = JSON.parse(readFileSync(path, 'utf8'));
            expect(w.page).toBe('seedling_bot_ap_p4g');
            const tape = name === 'ceremony126-solved' ? ceremony126SolvedTape() : ceremony126LostTape(true);
            expect(w.tape.inputs).toEqual(tape.inputs);
            const model = await ceremony126ModelSamples(name === 'ceremony126-solved' ? tape : ceremony126LostTape(false));
            const game = w.samples.map(unpackCeremony126Sample);
            expect(game.length).toBeGreaterThan(140);
            expect(compareCeremony126Witness(game, model.samples)).toEqual([]);
        });
    });
}

describe('CEREMONY126 — the keys are inert OFF', () => {
    it('OFF, `freezeForecast` carries no `pickupGap` (the FROZENPRESS shape, byte-identical)', async () => {
        const { createTapeStepper } = await import('./tapeRunner.js');
        const { parseTape } = await import('./tapeFormat.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        const read = (on) => withContactFidelity({ ceremonyPressForecast: on }, () => {
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(ceremony126SolvedTape())),
                { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            for (let i = 0; i < 44; i += 1) st.next();
            return run.progress('freezeForecast');
        });
        expect(Object.keys(read(false)).sort()).toEqual(['contact', 'refusedNext', 'timerNext']);
        // obs 43, the state input 42 left (box top 34.27 vs the rect's bottom 34): 0.27 px — the tick before contact
        expect(read(true).pickupGap).toBeCloseTo(0.27, 2);
    });
});
