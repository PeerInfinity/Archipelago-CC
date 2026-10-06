/**
 * jsRuntimeSolver ⛓ SHOULD-STOP → ⛓ DETERMINISTIC BUDGET — the anytime passes
 * run under `solveSegment`'s deadline hook (`shouldStop`, fidelity SF2), and
 * every bound is counted in WORK units (one unit per hook call), never in time.
 * Design: `docs/json/developer/procgen/flash.md` ("Pass deadlines").
 *
 *   - every pass of an attempt is bounded at the BUDGET at every site, so a
 *     slow refusal refuses BY NAME (the ⏱ clause) instead of overrunning;
 *   - the FULL pass's dash search stops at the UPGRADE WINDOW (only the
 *     `sword-dash` site, the one lossless site) once a plan is in hand, so the
 *     pass RETURNS a plan instead of being cut; the shorter plan is kept;
 *   - the window is a setting (`flashPanel.seedlingSolverUpgradeWindowWork`):
 *     0 = the whole budget;
 *   - ⛔ the CLOCK DECIDES NOTHING: a clock that jumps by a day per read gives
 *     the same answer as a counter (the user, 2026-10-05: plans identical on
 *     every machine).
 *
 * The witness is a fresh boot in L4 at (16,16) WITH the sword, its stairs down
 * (the teleporter to L5): the dashless plan is 255 ticks (hold, shove, walk),
 * the full plan 219 (a dash) — and its shove is REQUIRED, so a trip at every
 * site refuses at `block-route` (the lossy case).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   s1 the full pass trips EVERY site at the window (lossy)
 *        -> 'L4: a 1-unit window …' reds (the full pass refuses at block-route)
 *   s2 a tripped full plan LONGER than the dashless one replaces it
 *        -> 'betterAnswer: a tripped (partial-dash) plan …' reds
 *   s3 the window is ignored (the full pass gets the whole budget)
 *        -> 'L4: a 1-unit window …' and the `passShouldStop` table red
 *   d1 a WALL-CLOCK read back in the stop decision (`clock() - startedAt > budget`)
 *        -> 'the clock decides nothing …' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import {
    ANYTIME_PASSES, betterAnswer, budgetCut, createInPlaceSolveService, createWorkClock, deadlineOf, liveOf, passNote,
    passShouldStop, solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK, upgradeWindowWork,
} from './jsRuntimeSolver.js';
import { DEADLINE_SITES } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const [DASHLESS, FULL] = ANYTIME_PASSES;

/** L4 from (16,16) with the sword → its stairs down (teleporter 0, to L5). */
function l4StairsSword() {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]);
    rt.tick();
    const s = rt.session;
    const tp = rt.run.world.teleporters[0];
    return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: 'should-stop-L4',
        solverGoal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }, scratchPersistence: rt.run.scratchPersistence === true };
}
/** A counter clock (it only times the rows' `ms` now). */
const counter = () => { let n = 0; return () => n++; };
/** A clock that jumps a DAY per read: if anything but `ms` read it, the answer would change. */
const wildClock = () => { let n = 0; return () => (n += 86400000); };
const rows = (r) => r.passes.map(({ ms, ...row }) => row);

const plan = (ticks, pass = 'p', extra = {}) => ({ ok: true, pass, plan: { pass, solution: new Array(ticks).fill([]), ...extra } });

describe('⛓ SHOULD-STOP — the window and each pass\'s deadline', () => {
    it('the passes name their deadline: dashless every site, full the dash site only', () => {
        expect(ANYTIME_PASSES.map((p) => [p.pass, p.stop])).toEqual([['dashless', 'all'], ['full', 'sword-dash']]);
        expect(DEADLINE_SITES).toContain('sword-dash');
    });

    it('upgradeWindowWork: absent / 0 / junk = the whole budget; a window is never longer than its budget', () => {
        expect(upgradeWindowWork(400)).toBe(400);
        expect(upgradeWindowWork(400, null)).toBe(400);
        expect(upgradeWindowWork(400, 0)).toBe(400);
        expect(upgradeWindowWork(400, -3)).toBe(400);
        expect(upgradeWindowWork(400, 'junk')).toBe(400);
        expect(upgradeWindowWork(400, 40)).toBe(40);
        expect(upgradeWindowWork(1600, 40)).toBe(40); // the held retry keeps the user's window
        expect(upgradeWindowWork(400, 6000)).toBe(400);
        expect(SOLVER_UPGRADE_WINDOW_WORK).toBeLessThan(SOLVER_BUDGET_WORK);
    });

    it('passShouldStop: no budget → none; every pass trips EVERY site past the budget; full ALSO trips the dash site past the window, only with a plan in hand — counted in calls, no clock', () => {
        const at = { budgetWork: 10 };
        expect(passShouldStop(DASHLESS, { ...at, budgetWork: null, work: createWorkClock() })).toBeNull();
        expect(passShouldStop(FULL, { ...at, budgetWork: null, windowWork: 3, planInHand: true, work: createWorkClock() })).toBeNull();
        const drive = (p, opts, sites) => { const work = createWorkClock(); const limit = {}; const f = passShouldStop(p, { ...at, ...opts, work, limit });
            return { out: sites.map((s) => f(s)), limit: limit.first ?? null, units: work.units }; };
        const ten = new Array(10).fill('block-route');
        // dashless: calls 1..10 pass, the 11th (any site) trips — `budget`
        expect(drive(DASHLESS, {}, [...ten, 'detour'])).toEqual({ out: [...ten.map(() => false), true], limit: 'budget', units: 11 });
        // full with a plan in hand, window 3: the dash site trips at its 4th unit; other sites run on to the budget
        const f = drive(FULL, { windowWork: 3, planInHand: true }, ['detour', 'detour', 'detour', 'block-route', 'sword-dash']);
        expect(f).toEqual({ out: [false, false, false, false, true], limit: 'window', units: 5 });
        // full with NO plan in hand: no window, but the budget still bounds it (the page's old cut, now work)
        expect(drive(FULL, { windowWork: 3, planInHand: false }, [...ten.map(() => 'sword-dash'), 'sword-dash']).out.slice(-2)).toEqual([false, true]);
        // the attempt's clock is SHARED: units the dashless pass spent count against the full pass
        const work = createWorkClock();
        for (let i = 0; i < 9; i += 1) work.tick();
        const late = passShouldStop(FULL, { budgetWork: 10, windowWork: 3, planInHand: true, work, limit: {} });
        expect([late('detour'), late('detour')]).toEqual([false, true]);
    });

    it('betterAnswer: a tripped (partial-dash) plan replaces the one in hand only when SHORTER (SF: L15 511 t vs dashless 509 t)', () => {
        const tripped = { deadline: { tripped: true, first: 'sword-dash', sites: { 'sword-dash': 1 } } };
        expect(betterAnswer(plan(509, 'dashless'), plan(511, 'full', tripped))).toBe(false);
        expect(betterAnswer(plan(509, 'dashless'), plan(509, 'full', tripped))).toBe(false);
        expect(betterAnswer(plan(509, 'dashless'), plan(482, 'full', tripped))).toBe(true);
        expect(deadlineOf(plan(482, 'full', tripped))).toEqual(tripped.deadline);
        expect(deadlineOf({ ok: false, kind: 'refusal', deadline: tripped.deadline })).toEqual(tripped.deadline);
        expect(deadlineOf(plan(10))).toBeNull();
    });

    it('passNote names a pass that stopped at its deadline', () => {
        const p = { pass: 'dashless', passes: [{ pass: 'dashless', ok: true }, { pass: 'full', ok: true, deadline: 'sword-dash' }] };
        expect(passNote(p)).toBe('pass dashless, full stopped at its deadline (sword-dash)');
        expect(passNote(p, { expired: true })).toBe('pass dashless, full stopped at its deadline (sword-dash), the later pass ran out of its work budget');
        expect(passNote({ pass: 'full' })).toBe('pass full');
    });
});

describe('⛓ SHOULD-STOP — L4 stairs with the sword (dashless 255 t, full 219 t with a dash, a REQUIRED shove)', () => {
    it('a window of the whole budget: the full plan (219 t) replaces the dashless one, nothing tripped; the units are counted', () => {
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1e9, upgradeWindowWork: null }, { clock: counter() });
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('full');
        expect(r.plan.solution.length).toBe(219);
        const [d, f] = rows(r);
        expect([d, f].map(({ work, ...x }) => x)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255 }, { pass: 'full', ok: true, kind: null, ticks: 219 }]);
        expect(d.work).toBeGreaterThan(0); // the shove's block-route search
        expect(f.work).toBeGreaterThan(0);
        expect(r.plan.work).toBe(d.work + f.work);
        expect(r.plan.deadline).toBeNull();
        expect(budgetCut(r)).toBe(false);
    }, 60000);

    it('the clock decides nothing: the default budgets on a clock that jumps a DAY per read answer exactly as on a counter', () => {
        const strip = (r) => JSON.stringify({ ok: r.ok, pass: r.pass, ticks: r.plan?.solution.length, keys: r.plan?.solution.map((k) => [...k].sort()),
            rows: rows(r) });
        const req = { ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK };
        const a = solveAnytime(req, { clock: counter() });
        const b = solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }, { clock: wildClock() });
        expect(a.ok).toBe(true);
        expect(strip(b)).toBe(strip(a));
    }, 120000);

    it('L4: a 1-unit window — the full pass\'s DASH search stops, the pass RETURNS a plan (lossless: no refusal), and the dashless plan (not longer) is kept', () => {
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1e9, upgradeWindowWork: 1 }, { clock: counter() });
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('dashless');
        expect(r.plan.solution.length).toBe(255);
        expect(r.plan.verbs).toEqual(['hold', 'shove', 'walk']);
        expect(rows(r).map(({ work, ...x }) => x)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255 },
            { pass: 'full', ok: true, kind: null, ticks: 255, deadline: 'sword-dash', limit: 'window' }]);
        expect(budgetCut(r)).toBe(false);
        expect(passNote(r.plan)).toBe('pass dashless, full stopped at its deadline (sword-dash)');
    }, 60000);

    it('L4: a 1-unit BUDGET — the dashless pass refuses BY NAME at block-route (⏱), and so does the full pass (no plan in hand: the budget still bounds it) — a budget CUT', () => {
        const heard = [];
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1, upgradeWindowWork: null }, { clock: counter(), onPass: (a) => heard.push(a) });
        expect(heard[0]).toMatchObject({ ok: false, kind: 'refusal', pass: 'dashless', deadline: { tripped: true, first: 'block-route' } });
        expect(heard[0].message).toMatch(/hit `deadline`.*⏱ DEADLINE/s);
        expect(r.ok).toBe(false);
        expect(r.deadline).toBeTruthy();
        expect(rows(r).map(({ work, ...x }) => ({ pass: x.pass, ok: x.ok, limit: x.limit }))).toEqual([
            { pass: 'dashless', ok: false, limit: 'budget' }, { pass: 'full', ok: false, limit: 'budget' }]);
        expect(budgetCut(r)).toBe(true);
    }, 60000);

    it('betterAnswer: a refusal CUT by its deadline never replaces one that was not (the decline leads)', () => {
        const decline = { ok: false, kind: 'refusal', message: 'no corridor' };
        const cut = { ok: false, kind: 'refusal', message: 'hit deadline', deadline: { tripped: true, first: 'block-route', sites: {} } };
        expect(betterAnswer(decline, cut)).toBe(false);
        expect(betterAnswer(cut, decline)).toBe(true);
        expect(betterAnswer(cut, { ...cut })).toBe(true);
    });

    it('the in-place service has no budget, so no deadline: a request\'s budget and window are dropped', () => {
        const h = createInPlaceSolveService({ clock: counter() }).start({ ...l4StairsSword(), budgetWork: 1, upgradeWindowWork: 1 });
        expect(h.result.plan.pass).toBe('full');
        expect(h.result.passes.map((p) => p.deadline ?? null)).toEqual([null, null]);
        expect(h.result.passes.map((p) => p.work ?? null)).toEqual([null, null]);
    }, 60000);
});
