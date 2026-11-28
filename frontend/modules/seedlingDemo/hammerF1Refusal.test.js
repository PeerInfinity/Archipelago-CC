/**
 * seedlingDemo/hammerF1Refusal.test — ⛓ hammer-phase F1-REFUSAL (`REFUSAL_STAND_BOMBS`, OFF): the contracts.
 *   - `jsRuntimeSolver`'s `REFUSAL_STAND_BOMBS`: a ladder that ends in a REFUSAL (no pass cut by the budget), where a press
 *     kill derived a strike with bombs in play, runs its LAST pass once more under `PRESS_KILL_STRIKE_BOMBS`; only a
 *     hitless plan replaces the refusal.
 *   - `solverBot`'s `STRIKE_STAND_LOBBER`: the decision input, armed only by that switch, counted in `deriveStrike`.
 * The request witness (re-measure-9's F1 32:10 under the five switches) is `hammerF1Refusal.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    REFUSAL_STAND_BOMBS, REFUSAL_STAND_BOMBS_DEFAULT, refusalStandBombsAsks, refusalStandBombsPass, withRefusalStandBombs,
} from './jsRuntimeSolver.js';
import {
    STRIKE_STAND_LOBBER, armStrikeStandLobber, disarmStrikeStandLobber, withPressKillStrikeBombs,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const SOURCE = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
const JSRS = readFileSync(new URL('./jsRuntimeSolver.js', import.meta.url), 'utf8');
const SINGLE_GAME = /level\s*===\s*\d|@\d+,\d+|spinner@|bombpusher|bob@/;
/** A top-level function's text in `src`, from `decl` to its closing brace (the first `\n}\n`). */
const bodyIn = (src, decl) => {
    const at = src.indexOf(decl);
    expect(at).toBeGreaterThan(-1);
    return src.slice(at, src.indexOf('\n}\n', at) + 2);
};

describe('REFUSAL_STAND_BOMBS (hammer-phase F1-REFUSAL)', () => {
    it('ships OFF, read from SEEDLING_REFUSAL_STAND_BOMBS, and is a name the solver-env channel carries', () => {
        expect(REFUSAL_STAND_BOMBS_DEFAULT).toBe(false);
        expect(REFUSAL_STAND_BOMBS.enabled).toBe(globalThis.process?.env?.SEEDLING_REFUSAL_STAND_BOMBS === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_REFUSAL_STAND_BOMBS');
    });

    it('its with-wrapper sets the switch inside and restores it after, also on a throw', () => {
        const was = REFUSAL_STAND_BOMBS.enabled;
        expect(withRefusalStandBombs(!was, () => REFUSAL_STAND_BOMBS.enabled)).toBe(!was);
        expect(REFUSAL_STAND_BOMBS.enabled).toBe(was);
        expect(() => withRefusalStandBombs(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(REFUSAL_STAND_BOMBS.enabled).toBe(was);
    });

    it('the decision: only a refusal, with no pass cut by the budget, where a strike had a lobber to ask', () => {
        const refusal = { ok: false, kind: 'refusal', message: 'x' };
        const rows = [{ pass: 'dashless', ok: false }, { pass: 'full', ok: false }];
        expect(refusalStandBombsAsks(refusal, rows, 1)).toBe(true);
        // a solve — hitless or billing a hit — never reaches it (that is HIT_AVOID_STAND_BOMBS' question)
        expect(refusalStandBombsAsks({ ok: true, plan: {} }, rows, 1)).toBe(false);
        // the room's strikes read no lobber: the try would repeat the pass
        expect(refusalStandBombsAsks(refusal, rows, 0)).toBe(false);
        // a budget cut belongs to the held retry
        expect(refusalStandBombsAsks(refusal, [...rows, { pass: 'full', limit: 'budget' }], 3)).toBe(false);
        // a window cut is not a budget cut
        expect(refusalStandBombsAsks(refusal, [{ pass: 'full', limit: 'window' }], 3)).toBe(true);
        // not a refusal: a divergence, a skip, nothing at all
        for (const b of [{ ok: false, kind: 'divergence' }, { ok: false, kind: 'skipped' }, null, undefined]) {
            expect(refusalStandBombsAsks(b, rows, 1)).toBe(false);
        }
    });

    it('with PRESS_KILL_STRIKE_BOMBS already ON the try does not run (a skipped row, named, no answer)', () => {
        const out = withPressKillStrikeBombs(true, () => refusalStandBombsPass({ tape: {}, pass: { pass: 'full', dashMode: 'none' } }));
        expect(out.answer).toBe(null);
        expect(out.row).toMatchObject({ pass: 'refusal-stand-bombs', from: 'full', ok: false, kind: 'skipped' });
    });

    it('source: armed only by the switch, asked after HIT_AVOID_STAND_BOMBS, of the LAST pass, and never writes `limit`', () => {
        expect(JSRS).toContain('const lobberWatch = REFUSAL_STAND_BOMBS.enabled ? armStrikeStandLobber() : null;');
        expect((JSRS.match(/armStrikeStandLobber\(\)/g) ?? [])).toHaveLength(1);
        const at = JSRS.indexOf('if (refusalStandBombsAsks(best, rows, lobberSeen)) {');
        expect(at).toBeGreaterThan(JSRS.indexOf('const sb = standBombsPass({ tape, pass: passes[0], budgetWork, work, clock });'));
        expect(JSRS.slice(at, at + 200)).toContain('pass: passes[passes.length - 1]');
        // the watch is disarmed whenever it was armed, before the decision reads it
        expect(JSRS.indexOf('const lobberSeen = disarmStrikeStandLobber(lobberWatch);')).toBeLessThan(at);
        const fn = bodyIn(JSRS, 'export function refusalStandBombsPass(');
        expect(fn).toContain('standBombsPass({ tape, pass, budgetWork, work, clock })');
        expect(fn).not.toMatch(/limit\s*:/);
        for (const f of [fn, bodyIn(JSRS, 'export function refusalStandBombsAsks(')]) expect(f).not.toMatch(SINGLE_GAME);
    });
});

describe('STRIKE_STAND_LOBBER — the decision input (solverBot)', () => {
    it('arm/disarm: armed it counts from 0; disarm answers the count and restores the previous state', () => {
        const before = { ...STRIKE_STAND_LOBBER };
        const prev = armStrikeStandLobber();
        expect(STRIKE_STAND_LOBBER).toEqual({ watch: true, seen: 0 });
        STRIKE_STAND_LOBBER.seen += 2;
        expect(disarmStrikeStandLobber(prev)).toBe(2);
        expect(STRIKE_STAND_LOBBER).toEqual(before);
    });

    it('source: deriveStrike counts it once, guarded by `watch`, beside PSB\'s pinned gate; PSB gains no reader', () => {
        expect(SOURCE).toContain('    const bombs = (PRESS_KILL_BOMBS.enabled || PRESS_KILL_STRIKE_BOMBS.enabled) && bombsInPlay(run);\n'
            + '    let bombed = 0;\n');
        expect((SOURCE.match(/STRIKE_STAND_LOBBER\.watch && bombsInPlay\(run\)/g) ?? [])).toHaveLength(1);
        expect(SOURCE).toContain('    if (STRIKE_STAND_LOBBER.watch && bombsInPlay(run)) STRIKE_STAND_LOBBER.seen += 1;');
        expect((SOURCE.match(/PRESS_KILL_STRIKE_BOMBS\.enabled/g) ?? [])).toHaveLength(1);
        for (const d of ['export function armStrikeStandLobber(', 'export function disarmStrikeStandLobber(']) {
            expect(bodyIn(SOURCE, d)).not.toMatch(SINGLE_GAME);
        }
    });
});
