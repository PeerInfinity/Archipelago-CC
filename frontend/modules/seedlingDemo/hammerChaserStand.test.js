/**
 * seedlingDemo/hammerChaserStand.test — ⛓ hammer-phase CHASER-STAND: the contracts of its two switches, both OFF.
 *   - `OPP_AIM_CHASERS`: the press kill's drive offers the OPP policy an in-reach body for an AIM only when the aim's
 *     own landing is clear of every chaser (PKC's `landsClearOfChasers`).
 *   - `PRESS_KILL_STRIKE_BOMBS`: `deriveStrike`'s stand asks the lobber (`PRESS_KILL_BOMBS`' stand half, on its own).
 *   - `HIT_AVOID_STAND_BOMBS` (`jsRuntimeSolver`): after the ladder, a plan that still bills a hit asks the first pass
 *     again with `PRESS_KILL_STRIKE_BOMBS` ON, once; only a hitless plan replaces it.
 * The request witnesses (re-measure-9's F1 32:10 and re-measure-8's P1 32:10 at seam +7) are
 * `hammerChaserStand.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    OPP_AIM_CHASERS, OPP_AIM_CHASERS_COUNTS, OPP_AIM_CHASERS_DEFAULT, PRESS_KILL_STRIKE_BOMBS,
    PRESS_KILL_STRIKE_BOMBS_DEFAULT, oppAimClearOfChasers, resetOppAimChasersCounts, withOppAimChasers,
    withPressKillStrikeBombs,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    HIT_AVOID_STAND_BOMBS, HIT_AVOID_STAND_BOMBS_DEFAULT, standBombsPass, withHitAvoidStandBombs,
} from './jsRuntimeSolver.js';

const SOURCE = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
const JSRS = readFileSync(new URL('./jsRuntimeSolver.js', import.meta.url), 'utf8');

/** A top-level function's text, from its declaration to its closing brace (the first `\n}\n`). */
const bodyOf = (decl) => {
    const at = SOURCE.indexOf(decl);
    expect(at).toBeGreaterThan(-1);
    return SOURCE.slice(at, SOURCE.indexOf('\n}\n', at) + 2);
};
const SINGLE_GAME = /level\s*===\s*\d|@\d+,\d+|spinner@|bombpusher|bob@/;

describe.each([
    ['OPP_AIM_CHASERS', OPP_AIM_CHASERS, OPP_AIM_CHASERS_DEFAULT, withOppAimChasers],
    ['PRESS_KILL_STRIKE_BOMBS', PRESS_KILL_STRIKE_BOMBS, PRESS_KILL_STRIKE_BOMBS_DEFAULT, withPressKillStrikeBombs],
    ['HIT_AVOID_STAND_BOMBS', HIT_AVOID_STAND_BOMBS, HIT_AVOID_STAND_BOMBS_DEFAULT, withHitAvoidStandBombs],
])('%s (hammer-phase CHASER-STAND)', (name, sw, dflt, withIt) => {
    it('ships OFF, and its env name is in the worker\'s table', () => {
        expect(dflt).toBe(false);
        expect(sw.enabled).toBe(globalThis.process?.env?.[`SEEDLING_${name}`] === '1');
        expect(SOLVER_ENV_NAMES).toContain(`SEEDLING_${name}`);
    });

    it('its with-wrapper sets the switch inside and restores it after, also on a throw', () => {
        const was = sw.enabled;
        expect(withIt(!was, () => sw.enabled)).toBe(!was);
        expect(sw.enabled).toBe(was);
        expect(() => withIt(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(sw.enabled).toBe(was);
    });
});

describe('OPP_AIM_CHASERS — the drive\'s one reader', () => {
    it('source: one call site, in the press kill\'s OPP offer, guarded by the switch; PKC\'s own predicate', () => {
        const calls = SOURCE.match(/oppAimClearOfChasers\(run, opp, /g) ?? [];
        expect(calls).toHaveLength(1);
        expect(SOURCE).toContain('const offered = OPP_AIM_CHASERS.enabled ? oppAimClearOfChasers(run, opp, offered0) : offered0;');
        const fn = bodyOf('export function oppAimClearOfChasers(');
        expect(fn).toContain('landsClearOfChasers(run, new Set([FACING_KEYS[facingToward(run.state, b.rect)]]))');
        // a press already owed is never withheld; a room with no chaser forecast reads nothing
        expect(fn).toContain('policy?.aimed !== null || !run.chaserForecast?.()');
        expect(fn).not.toMatch(SINGLE_GAME);
    });

    const body = (x, y) => ({ id: 'b', rect: { x, y, width: 8, height: 8 } });
    const fakeRun = (forecast) => ({ state: { x: 100, y: 100 }, chaserForecast: () => forecast });

    it('OFF, a press owed, no chaser forecast, or no body in reach: the offer is returned unchanged, nothing asked', () => {
        const bodies = [body(400, 400)];
        resetOppAimChasersCounts();
        expect(withOppAimChasers(false, () => oppAimClearOfChasers(fakeRun({}), { aimed: null }, bodies))).toBe(bodies);
        expect(withOppAimChasers(true, () => oppAimClearOfChasers(fakeRun({}), { aimed: 'x' }, bodies))).toBe(bodies);
        expect(withOppAimChasers(true, () => oppAimClearOfChasers(fakeRun(null), { aimed: null }, bodies))).toBe(bodies);
        expect(withOppAimChasers(true, () => oppAimClearOfChasers(fakeRun({}), { aimed: null }, bodies))).toEqual(bodies);
        expect(OPP_AIM_CHASERS_COUNTS).toEqual({ asked: 0, withheld: 0 });
    });
});

describe('PRESS_KILL_STRIKE_BOMBS — deriveStrike\'s stand question', () => {
    it('source: the stand half is BW\'s own question, asked under either switch; the refuge is not touched', () => {
        expect(SOURCE).toContain('    const bombs = (PRESS_KILL_BOMBS.enabled || PRESS_KILL_STRIKE_BOMBS.enabled) && bombsInPlay(run);\n    let bombed = 0;');
        expect(bodyOf('function refugeAsksBombs(run) {')).not.toContain('PRESS_KILL_STRIKE_BOMBS');
        expect((SOURCE.match(/PRESS_KILL_STRIKE_BOMBS\.enabled/g) ?? [])).toHaveLength(1);
    });
});

describe('HIT_AVOID_STAND_BOMBS — solveAnytime\'s one reader', () => {
    it('source: asked after the hit-avoid pass, only of a plan that still bills a hit; only a hitless plan replaces it', () => {
        const at = JSRS.indexOf('if (HIT_AVOID_STAND_BOMBS.enabled && best?.ok === true && best.kind !== \'divergence\' '
            + '&& planTakesHit(best.plan) === true) {');
        expect(at).toBeGreaterThan(JSRS.indexOf('const avoid = hitAvoidPass('));
        expect((JSRS.match(/if \(HIT_AVOID_STAND_BOMBS\.enabled/g) ?? [])).toHaveLength(1);
        const fn = JSRS.slice(JSRS.indexOf('export function standBombsPass('), JSRS.indexOf('\n}\n', JSRS.indexOf('export function standBombsPass(')));
        expect(fn).toContain('withPressKillStrikeBombs(true, () => settleSolve(() => solveFromTape(');
        expect(fn).toContain("const hitless = one.ok && !one.plan.deadline && planTakesHit(one.plan) === false;");
        // a budget cut is the row's `cut`, never `limit` (which would send the shipped plan to a held retry)
        expect(fn).not.toMatch(/limit\s*:/);
        expect(fn).not.toMatch(SINGLE_GAME);
    });

    it('with PRESS_KILL_STRIKE_BOMBS already ON the try does not run (a skipped row, no answer)', () => {
        const out = withPressKillStrikeBombs(true, () => standBombsPass({ tape: {}, pass: { dashMode: 'none' } }));
        expect(out.answer).toBe(null);
        expect(out.row).toMatchObject({ pass: 'stand-bombs', ok: false, kind: 'skipped' });
    });
});
