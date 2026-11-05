/**
 * ⛓⛓ SEEDLING HAMMER-PHASE OPP-FREEZE — the press kill's opportunistic strike asks the frozen-tick forecast
 * (`solverBot.OPP_FREEZE_FORECAST`, OFF). ⚖ The user queued it 2026-11-04 from fidelity FROZENPRESS's hand-over (its
 * report § 7): `execKillByPressOnce`'s `opp.decide` built its own `{ slash }` and never asked `strikeDecideOpts(run)`.
 *
 * W0 (`CC/docs/cloud-reports/seedling-hammer-opp-freeze.md`) found NO measured solve where that call is asked on a
 * refused tick (6577 asks, `OPPORTUNISTIC_STRIKE` ON), so the gap is closed by a constructed row: fidelity's L40 freeze
 * tape (`fidelityFrozenPress.js`, the volley's contact on input 52, inputs 52..65 refused; read, not edited), a policy
 * that took its aim on t51 and owes the press on t52, asked with the options the press kill's call builds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { FROZENPRESS_SPAN, frozenPressModelTape, frozenPressPerTick } from './fidelityFrozenPress.js';
import { atlasLevelSource } from './levelSource.js';
import {
    FACING_KEYS, OPP_FREEZE_FORECAST, OPP_FREEZE_FORECAST_DEFAULT, facingToward, oppDecideOpts, withOppFreezeForecast,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { STRIKE_AIM, STRIKE_NONE, STRIKE_PRESS, createStrikePolicy, strikeDecideOpts } from './strikePolicy.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
/** The tick the policy aims; the next is the volley's contact tick, the first refused input. */
const AIM_AT = FROZENPRESS_SPAN.contact - 1;

/**
 * The L40 freeze tape driven to `AIM_AT`, then a strike policy driven on the run with the press kill's options
 * (`oppDecideOpts`), a body placed in the sword's reach above the player. Every decision's keys are what the run
 * advances by, so a press the policy owes on a frozen tick reaches `levelRun.advance`.
 */
async function driveFrozen(on) {
    const tape = await frozenPressModelTape('frozenpress-l40-lost');
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(tape))));
    const per = frozenPressPerTick([]);
    const run = createRunForStaging(staging, atlasLevelSource());
    for (let t = 0; t < AIM_AT; t += 1) run.advance(per[t]);
    const s = run.state;
    const body = { id: 'bob@test', as3: 'Bob', hitsTimer: 0,
        rect: { x: s.x - 6, y: s.y - 22, w: 12, h: 12, right: s.x + 6, bottom: s.y - 10 } };
    const policy = createStrikePolicy({ facingToward, facingKeys: FACING_KEYS });
    const decisions = [];
    let error = null;
    try {
        withOppFreezeForecast(on, () => {
            for (let t = AIM_AT; t < FROZENPRESS_SPAN.firstFree + 3; t += 1) {
                const refused = run.progress('freezeForecast').refusedNext;
                const d = policy.decide(run.state, [body], run.ticksCompleted, per[t], oppDecideOpts(run));
                decisions.push(`${t}:${d.decision}${refused ? ':R' : ''}`);
                run.advance(d.held);
            }
        });
    } catch (e) {
        error = e;
    }
    return { decisions, error, ticks: run.ticksCompleted };
}

describe('hammer-phase OPP-FREEZE — the press kill\'s OPP call asks the frozen-tick forecast', () => {
    it.skipIf(ENV.SEEDLING_OPP_FREEZE_FORECAST !== undefined)('ships OFF', () => {
        expect(OPP_FREEZE_FORECAST.enabled).toBe(false);
        expect(OPP_FREEZE_FORECAST_DEFAULT).toBe(false);
    });

    it('`SEEDLING_OPP_FREEZE_FORECAST` is a known worker env name', () => {
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_OPP_FREEZE_FORECAST');
    });

    it('`oppDecideOpts`: OFF the `{ slash }` the call always built (fidelity\'s key ON or not); ON exactly '
        + '`strikeDecideOpts(run)` — the forecast only while fidelity\'s `frozenPressForecast` is ON', () => {
        const FF = { refusedNext: true, timerNext: 9, contact: null };
        const run = { progress: (f) => (f === 'slashInfo' ? 'S' : FF) };
        for (const fidelity of [true, false]) {
            withContactFidelity({ frozenPressForecast: fidelity }, () => {
                withOppFreezeForecast(false, () => expect(oppDecideOpts(run)).toEqual({ slash: 'S' }));
                withOppFreezeForecast(true, () => {
                    expect(oppDecideOpts(run)).toEqual(strikeDecideOpts(run));
                    expect(oppDecideOpts(run)).toEqual(fidelity ? { slash: 'S', freeze: FF } : { slash: 'S' });
                });
            });
        }
    });

    it('a frozen tick offered to OPP: OFF the owed press lands on the contact tick and the model refuses it '
        + '(`FROZEN_TICK_PRESS`); ON the policy stands down through the freeze, re-aims on the first free tick '
        + 'and presses the next', async () => {
        await withContactFidelity({ frozenPressForecast: true }, async () => {
            const off = await driveFrozen(false);
            expect(off.error?.code).toBe('FROZEN_TICK_PRESS');
            expect(off.decisions).toEqual([`${AIM_AT}:${STRIKE_AIM}`, `${AIM_AT + 1}:${STRIKE_PRESS}:R`]);

            const on = await driveFrozen(true);
            expect(on.error).toBe(null);
            const refused = Array.from({ length: FROZENPRESS_SPAN.firstFree - FROZENPRESS_SPAN.contact },
                (_, i) => `${FROZENPRESS_SPAN.contact + i}:${STRIKE_NONE}:R`);
            expect(on.decisions).toEqual([`${AIM_AT}:${STRIKE_AIM}`, ...refused,
                `${FROZENPRESS_SPAN.firstFree}:${STRIKE_AIM}`, `${FROZENPRESS_SPAN.firstFree + 1}:${STRIKE_PRESS}`,
                `${FROZENPRESS_SPAN.firstFree + 2}:${STRIKE_NONE}`]);
            expect(on.ticks).toBe(FROZENPRESS_SPAN.firstFree + 3);
        });
    }, 120_000);

    it('the source: `execKillByPressOnce`\'s OPP `decide` is asked with `oppDecideOpts(run)`, and builds no '
        + '`{ slash }` of its own', () => {
        const src = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
        const start = src.indexOf('\nfunction execKillByPressOnce(');
        expect(start).toBeGreaterThan(0);
        const end = src.indexOf('\nfunction ', start + 1);
        const body = src.slice(start, end);
        const calls = body.match(/opp\.decide\([^;]*;/g) ?? [];
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain('oppDecideOpts(run)');
        expect(body).not.toContain("{ slash: run.progress('slashInfo') }");
    });
});
