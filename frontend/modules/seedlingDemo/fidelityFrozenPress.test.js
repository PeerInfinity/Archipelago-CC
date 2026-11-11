/**
 * ⛓⛓⛓ SEEDLING FIDELITY FROZENPRESS (wave 37) — the walk's strike stands down on a tick whose input the game refuses.
 * Key `frozenPressForecast` (OFF): every run-side `strike.decide` is handed the run's `freezeForecast`
 * (`strikePolicy.strikeDecideOpts`, `levelRun.freezeForecastNow`), and on a refused tick the policy takes no aim and
 * no press. Leg 860 (A5, `forecastShieldBump` + `PRESS_ESCAPE_EXACT` ON) refused at t2119 by `FROZEN_TICK_PRESS`,
 * pressed by `drive`'s strike. The witnesses are recorded on the game (`fixtures/frozenpress-witness/`, p4g
 * headless, 0 px): a press inside the freeze is LOST, the same press on the forecast's first free input lands.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    FROZENPRESS_LANDED_PRESSES, FROZENPRESS_LOST_PRESSES, FROZENPRESS_SPAN, FROZENPRESS_WITNESS_DIR,
    compareFrozenPressWitness, frozenPressLandedTape, frozenPressLostTape, frozenPressModelSamples,
    frozenPressModelTape, unpackFrozenPressSample,
} from './fidelityFrozenPress.js';
import {
    FROZEN_PRESS_COUNTS, STRIKE_AIM, STRIKE_NONE, STRIKE_PRESS, createStrikePolicy, strikeDecideOpts,
} from './strikePolicy.js';
import { FACING_KEYS, facingToward } from './solverBot.js';
import { PROGRESS_FIELD_NAMES } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const load = (name) => JSON.parse(readFileSync(join(FROZENPRESS_WITNESS_DIR, `${name}.json`), 'utf8'));
const W = Object.fromEntries(['frozenpress-l40-lost', 'frozenpress-l40-landed'].map((n) => {
    const w = load(n);
    return [n, { ...w, game: w.samples.map(unpackFrozenPressSample) }];
}));
const turretHitAt = (samples) => samples.find((g) => (g?.turret?.hits ?? 0) > 0)?.t ?? null;

describe('FROZENPRESS — the switch', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_FROZEN_PRESS_FORECAST)(
        'frozenPressForecast ships ON (⚖ user 2026-11-02, the L100 joint flip), followed only by wave-37b keys; its env name is in the worker channel', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.frozenPressForecast).toBe(true);
            expect(CONTACT_FIDELITY.frozenPressForecast).toBe(true);
            // ⛓ wave 37b appended keys after it: L105 `previewBeamTowerDrift`; CEREMONY126 `ceremonyPressForecast`,
            // `ceremonyWalkHandoff`. Any order of those (the slices merge in either order); nothing else.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            const after = keys.slice(keys.indexOf('frozenPressForecast') + 1);
            // ⛓ wave 37d: L25APITEM `apChestItem`; wave 37c: KNOCKBACK376 `rockGoneFencepost` (landed after it); wave 37e: DRILLWATER `drillTerrainSwitch`.
            const W37B = ['previewBeamTowerDrift', 'ceremonyPressForecast', 'ceremonyWalkHandoff', 'apChestItem'];
            const W37C = ['rockGoneFencepost', 'drillTerrainSwitch'];
            // ⛓ wave 38: L39PHANTOM `spinnerRosterGone`, FIRESPINNER `fireSpinnerArm`.
            const W38 = ['spinnerRosterGone', 'fireSpinnerArm'];
            // ⛓ wave 39: ROCKFIRE `fireRockArm`.
            const W39 = ['fireRockArm'];
            expect(after.filter((k) => !W37B.includes(k) && !W37C.includes(k) && !W38.includes(k) && !W39.includes(k))).toEqual([]);
        });
    it('`SEEDLING_FROZEN_PRESS_FORECAST` is a known worker env name; `freezeForecast` is a progress field', () => {
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FROZEN_PRESS_FORECAST');
        expect(PROGRESS_FIELD_NAMES.at(-1)).toBe('freezeForecast');
    });
    it('`strikeDecideOpts`: OFF the object every caller built before (`{ slash }`); ON it adds the forecast', () => {
        const run = { progress: (f) => (f === 'slashInfo' ? 'S' : { refusedNext: true, timerNext: 9, contact: null }) };
        withContactFidelity({ frozenPressForecast: false }, () => {
            expect(strikeDecideOpts(run)).toEqual({ slash: 'S' });
        });
        withContactFidelity({ frozenPressForecast: true }, () => {
            expect(strikeDecideOpts(run)).toEqual({ slash: 'S', freeze: { refusedNext: true, timerNext: 9, contact: null } });
        });
    });
});

describe('FROZENPRESS D1 — the policy stands down on a refused tick (a body in reach, the plain swing)', () => {
    const body = { id: 'bob@0,0', as3: 'Bob', rect: { x: 100, y: 84, w: 12, h: 12, right: 112, bottom: 96 },
        hitsTimer: 0 };
    const state = { x: 106, y: 104, vx: 0, vy: 0, direction: 1 };
    const policy = () => createStrikePolicy({ facingToward, facingKeys: FACING_KEYS });
    const FREE = { refusedNext: false, timerNext: 0, contact: null };
    const FROZEN = { refusedNext: true, timerNext: 12, contact: null };

    it('the control: with no freeze it aims, then presses the next tick (and `freeze: null` is the OFF path)', () => {
        const p = policy();
        expect(p.decide(state, [body], 10, new Set(), { freeze: null }).decision).toBe(STRIKE_AIM);
        expect(p.decide(state, [body], 11, new Set(), { freeze: FREE }).decision).toBe(STRIKE_PRESS);
    });

    it('an owed press on a refused tick is DROPPED (the walk keeps its keys), and the body is aimable again after', () => {
        const before = { ...FROZEN_PRESS_COUNTS };
        const p = policy();
        expect(p.decide(state, [body], 10, new Set(), { freeze: FREE }).decision).toBe(STRIKE_AIM);
        const walk = new Set(['left']);
        const d = p.decide(state, [body], 11, walk, { freeze: FROZEN });
        expect(d.decision).toBe(STRIKE_NONE);
        expect(d.held).toBe(walk);
        expect(p.aimed).toBe(null);
        expect(p.trace.at(-1)).toMatchObject({ tick: 11, target: 'bob@0,0', frozenRefused: { timerNext: 12 } });
        expect(FROZEN_PRESS_COUNTS.dropped - before.dropped).toBe(1);
        // a refused tick takes no aim either
        expect(p.decide(state, [body], 12, new Set(), { freeze: FROZEN }).decision).toBe(STRIKE_NONE);
        expect(p.aimed).toBe(null);
        // the freeze drains: aim, press
        expect(p.decide(state, [body], 13, new Set(), { freeze: FREE }).decision).toBe(STRIKE_AIM);
        expect(p.decide(state, [body], 14, new Set(), { freeze: FREE }).decision).toBe(STRIKE_PRESS);
    });
});

describe('FROZENPRESS — the game witnesses (L40, iceturret@472,400, p4g, 0 px)', () => {
    it('both recordings are p4g\'s, and their tapes are the ones the module builds', async () => {
        for (const [n, build] of [['frozenpress-l40-lost', frozenPressLostTape],
            ['frozenpress-l40-landed', frozenPressLandedTape]]) {
            const tape = await build();
            expect(W[n].page).toBe('seedling_bot_ap_p4g');
            expect(tape.inputs).toEqual(W[n].tape.inputs);
            expect(tape.seam).toEqual(W[n].tape.seam);
        }
        expect(FROZENPRESS_LOST_PRESSES).toEqual([FROZENPRESS_SPAN.contact, FROZENPRESS_SPAN.firstFree - 1]);
        expect(FROZENPRESS_LANDED_PRESSES).toEqual([FROZENPRESS_SPAN.firstFree]);
    });

    it('the game: the volley freezes the player for fourteen inputs (52..65); presses on 52 and 65 are LOST', () => {
        const g = W['frozenpress-l40-lost'].game;
        expect(g.filter((s) => s.frozen > 0 && s.t < 80).map((s) => s.t))
            .toEqual(Array.from({ length: 14 }, (_, i) => 53 + i));
        expect(turretHitAt(g)).toBe(null);
    });

    it('the game: the press on input 66 — the forecast\'s first free one — lands (the turret\'s hits 0 → 1 on t68)', () => {
        const g = W['frozenpress-l40-landed'].game;
        expect(turretHitAt(g)).toBe(68);
    });

    it('the model refuses to author the lost presses (`FROZEN_TICK_PRESS`, on the contact tick\'s press)', async () => {
        const raw = await frozenPressModelSamples(await frozenPressLostTape());
        expect(raw.error).toBe('FROZEN_TICK_PRESS');
    });

    for (const n of ['frozenpress-l40-lost', 'frozenpress-l40-landed']) {
        it(`${n}: the model of its model tape reproduces the game at 0 px, and its forecast names the game's refused `
            + 'inputs', async () => {
            const model = await frozenPressModelSamples(await frozenPressModelTape(n));
            expect(model.error).toBe(null);
            expect(compareFrozenPressWitness(W[n].game, model.samples)).toEqual([]);
            const byT = new Map(W[n].game.map((s) => [s.t, s]));
            const refused = [];
            for (let t = 0; t + 1 < W[n].tape.tick_count; t += 1) {
                expect(model.forecast[t].refusedNext).toBe(byT.get(t + 1).frozen > 0);
                if (model.forecast[t].refusedNext) refused.push(t);
            }
            expect(refused.filter((t) => t < 80)).toEqual(Array.from({ length: 14 }, (_, i) => 52 + i));
            // the forecast saw the contact on the contact tick itself, from the state the tick before left
            expect(model.forecast[FROZENPRESS_SPAN.contact].contact).toMatch(/^iceturret@472,400/);
        });
    }
});
