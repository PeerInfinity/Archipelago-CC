/**
 * ⛓ SOLVER LIMIT OFF (⚖ the user 2026-11-10: "Which limit should off turn off?" → "Both") — the engine values of
 * "no work limit" (a budget of 0) and "backstop off" (0 ms), one rule on every runtime, and what "no limit" does to the
 * held retry, the upgrade window and the progress meter.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   n1 `budgetKnob` reads 0 as the fallback (640)                 -> 'the knobs …' reds
 *   n2 `backstopKnob` reads 0 as the fallback (300 s)             -> 'the knobs …' reds
 *   n3 `backstopPassed` fires with the backstop off               -> 'the knobs …' reds
 *   n8 "no limit" read as an unbounded budget (the window kept)   -> 'no limit installs NO deadline …' reds
 *   n5 a no-limit attempt labels its budget `0`                   -> 'the attempt and the meter …' reds
 *   n6 the meter reads limit 0 as a limit (NaN / 0 %)             -> 'the attempt and the meter …' reds
 *   n7 the tap stamps no `noLimit`                                -> 'the attempt and the meter …' reds
 *   (n4, the page sending 640 for 0, is `jsRuntimeSolveService.test.js`'s 'no work limit (0) …' row.)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import {
    ANYTIME_PASSES, backstopKnob, backstopPassed, budgetCut, budgetKnob, budgetLimited, budgetText, createWorkClock, liveOf,
    ownBudgetClause, passShouldStop, solveAnytime, SOLVE_BACKSTOP_MS, SOLVE_BACKSTOP_OFF, SOLVE_STOPPED_BY_PLAYER,
    SOLVER_BUDGET_NO_LIMIT, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK,
} from './jsRuntimeSolver.js';
import { explicitAttempt } from './jsRuntimeSolveService.js';
import { attemptLabel, createProgressTap, requestIdentity } from './solveProgressTap.js';
import { withDashOnlyWindow } from './dashOnlyWindowHook.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { meterOf, noLimitMeterText, requestText } from '../flashPanel/seedlingSolveProgress.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));

/** L4 from (16,16) with the sword → its stairs (`jsRuntimeSolverShouldStop.test.js`'s fixture: dashless 255 t, full 219 t). */
function l4StairsSword() {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]);
    rt.tick();
    const s = rt.session;
    const tp = rt.run.world.teleporters[0];
    return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: 'limit-off-L4',
        solverGoal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }, scratchPersistence: rt.run.scratchPersistence === true };
}
const counter = () => { let n = 0; return () => n++; };
const rows = (r) => r.passes.map(({ ms, ...row }) => row);
const keys = (r) => r.plan.solution.map((k) => [...k].sort());

describe('⛓ SOLVER LIMIT OFF — the knobs (one rule for every runtime)', () => {
    it('the knobs: 0 = no limit / off, a positive number is itself, anything else is the fallback', () => {
        expect([SOLVER_BUDGET_NO_LIMIT, SOLVE_BACKSTOP_OFF]).toEqual([0, 0]);
        // budget
        expect(budgetKnob(0, 640)).toBe(0);
        expect(budgetKnob('0', 640)).toBe(0);
        expect(budgetKnob(800, 640)).toBe(800);
        expect(budgetKnob(640, 1)).toBe(640); // a stored pre-slice value keeps its meaning
        for (const v of [null, undefined, '', -5, NaN, Infinity, 'junk']) expect([v, budgetKnob(v, 640)]).toEqual([v, 640]);
        expect([0, 640, null].map(budgetLimited)).toEqual([false, true, false]);
        expect(budgetText(640)).toBe('640 work units');
        expect(budgetText(0)).toBe('no work limit');
        expect(ownBudgetClause(640)).toBe('the solve\'s own budget is 640 work units');
        expect(ownBudgetClause(0)).toBe('the solve had no work limit');
        // backstop
        expect(backstopKnob(0, SOLVE_BACKSTOP_MS)).toBe(0);
        expect(backstopKnob(600000, SOLVE_BACKSTOP_MS)).toBe(600000);
        for (const v of [null, undefined, '', -1, NaN]) expect(backstopKnob(v, SOLVE_BACKSTOP_MS)).toBe(SOLVE_BACKSTOP_MS);
        expect(backstopPassed(300, 301)).toBe(true);
        expect(backstopPassed(300, 300)).toBe(false);
        expect(backstopPassed(0, 1e12)).toBe(false); // off never passes
        expect(SOLVE_STOPPED_BY_PLAYER).toBe('the solve was stopped by the player');
    });

    it('the defaults are unchanged: 640 work, window 85, backstop 300 s; a fresh page reads them', () => {
        expect([SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK, SOLVE_BACKSTOP_MS]).toEqual([640, 85, 300000]);
        const page = createJsRuntime().playback;
        expect([page.solverBudgetWork, page.solverBackstopMs]).toEqual([640, 300000]);
        expect([createJsRuntime({ solverBudgetWork: 0 }).playback.solverBudgetWork,
            createJsRuntime({ solverBackstopMs: 0 }).playback.solverBackstopMs]).toEqual([0, 0]);
    });

    it('no limit installs NO deadline: `passShouldStop` answers null for a budget of 0, on every pass, plan in hand or not', () => {
        for (const p of ANYTIME_PASSES) {
            for (const planInHand of [false, true]) {
                expect(passShouldStop(p, { budgetWork: 0, windowWork: 1, planInHand, work: createWorkClock() })).toBeNull();
                expect(typeof passShouldStop(p, { budgetWork: 640, windowWork: 1, planInHand, work: createWorkClock() })).toBe('function');
            }
        }
    });
});

describe('⛓ SOLVER LIMIT OFF — L4 stairs with the sword (a real solve)', () => {
    it('both defaults and no limit: the SAME plan where the defaults trip nothing (no pass row carries a deadline)', () => {
        const def = solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }, { clock: counter() });
        const off = solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_NO_LIMIT, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }, { clock: counter() });
        expect(rows(def).some((r) => r.deadline)).toBe(false);
        expect([def.plan.pass, def.plan.solution.length]).toEqual(['full', 219]);
        expect(keys(off)).toEqual(keys(def));
        expect(off.plan.pass).toBe(def.plan.pass);
        // no limit counts no work (no deadline is asked) and stamps none
        expect(rows(off)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255 }, { pass: 'full', ok: true, kind: null, ticks: 219 }]);
        expect(off.plan.work).toBeUndefined();
        expect(off.plan.deadline).toBeNull();
    }, 120000);

    it('L4, a window-cut request (window 1): the defaults\' budget ships the window\'s dashless plan; NO LIMIT ships the full pass\'s (deadline null) — no limit turns the upgrade window off too', () => {
        // pinned to the WHOLE-PASS window, as `jsRuntimeSolverShouldStop.test.js`'s 1-unit-window row is
        const cut = withDashOnlyWindow(false, () => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: 1 }, { clock: counter() }));
        expect([cut.plan.pass, cut.plan.solution.length]).toEqual(['dashless', 255]);
        expect(rows(cut)[1]).toMatchObject({ pass: 'full', ok: false, deadline: 'walk', limit: 'window' });
        for (const dashOnly of [false, true]) {
            const off = withDashOnlyWindow(dashOnly, () => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_NO_LIMIT, upgradeWindowWork: 1 }, { clock: counter() }));
            expect([dashOnly, off.plan.pass, off.plan.solution.length, off.plan.deadline]).toEqual([dashOnly, 'full', 219, null]);
            expect(rows(off).some((r) => r.deadline || r.limit)).toBe(false);
            // ⛓ the HELD RETRY reads `budgetCut`: no pass is ever cut by a budget, so it never fires
            expect(budgetCut(off)).toBe(false);
        }
    }, 120000);
});

describe('⛓ SOLVER LIMIT OFF — the attempt and the meter', () => {
    it('the attempt and the meter: no label for no limit; the meter says "no work limit" by name, never NaN, 0 % or Infinity', () => {
        // the service keeps only real budgets: a no-limit attempt has none (the request line then names "no work limit")
        expect(explicitAttempt({ retry: 0, budgets: [0] })).toEqual({ retry: 0, budgets: [] });
        expect(explicitAttempt({ retry: 1, budgets: [640, 2560] })).toEqual({ retry: 1, budgets: [640, 2560] });
        expect(attemptLabel({ retry: 0, budgets: [] })).toBe('');
        const req = requestIdentity({ name: 'n', budgetWork: 0, solverGoal: { kind: 'reach-exit' } }, { attempt: { retry: 0, budgets: [] } });
        expect(requestText(req)).toBe('request: n · goal reach-exit · no work limit');
        expect(requestText(requestIdentity({ name: 'n', budgetWork: 640 }, { attempt: { retry: 0, budgets: [640] } })))
            .toBe('request: n · attempt 640');
        // the tap stamps "no limit" by name
        const posts = [];
        let now = 0;
        const tap = createProgressTap({ passes: ANYTIME_PASSES, clock: () => now, budgetWork: 0, windowAt: null, minIntervalMs: 50,
            post: (s) => posts.push(s) });
        tap.hook('walk', () => ({ v: 1, seq: 1, segment: { name: 't', index: 0, level: 4, outcome: 'running' }, tree: null, tiles: null,
            budget: { asks: { walk: 3, detour: 1 }, work: {} } }));
        now += 10;
        tap.finish();
        const snap = posts[0];
        expect(snap.budget.limit).toEqual({ shouldStop: null, noLimit: true });
        const m = meterOf(snap);
        expect(m).toEqual({ spent: 0, limit: null, window: null, fraction: null, noLimit: true });
        expect(noLimitMeterText(snap)).toBe('no work limit · 4 checkpoints this segment (work is counted only under a limit)');
        // the defaults' meter is unchanged (no `noLimit` key)
        expect(meterOf({ budget: { spent: { shouldStop: 64 }, limit: { shouldStop: 640, window: 85 } } }))
            .toEqual({ spent: 64, limit: 640, window: 85, fraction: 0.1 });
        // a limit of 0 is never a limit (no NaN / Infinity)
        expect(meterOf({ budget: { spent: { shouldStop: 5 }, limit: { shouldStop: 0 } } })).toMatchObject({ limit: null, fraction: null });
    });
});
