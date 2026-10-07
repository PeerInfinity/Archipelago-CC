/**
 * jsRuntimeSolver ⛓ SHOULD-STOP → ⛓ DETERMINISTIC BUDGET — the anytime passes
 * run under `solveSegment`'s deadline hook (`shouldStop`, fidelity SF2), and
 * every bound is counted in WORK units (one unit per hook call), never in time.
 * Design: `docs/json/developer/procgen/flash.md` ("Pass deadlines").
 *
 *   - every pass of an attempt is bounded at the BUDGET at every site, so a
 *     slow refusal refuses BY NAME (the ⏱ clause) instead of overrunning;
 *   - ⛓ WINDOW WHOLE PASS (⚖ the user, 2026-10-06: *"Yes, stop the whole
 *     pass"*) — once a plan is in hand, EVERY site of the FULL pass trips at
 *     the UPGRADE WINDOW (it was the `sword-dash` site only): the pass returns
 *     what it found inside the window or refuses, and a refusal never
 *     replaces the plan in hand, so the cut is LOSSLESS for that plan; with
 *     no plan in hand the full pass keeps the whole budget;
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
 *   s1 (retired by ⛓ WINDOW WHOLE PASS: tripping every site at the window is now the rule)
 *   w1 only `sword-dash` trips at the window (the rule before)
 *        -> the `passShouldStop` site table and 'L4: the window that holds the WHOLE full pass …' red
 *   w2 the window trips with NO plan in hand
 *        -> the `passShouldStop` site table reds
 *   w3 a refusal cut at the window replaces the plan in hand
 *        -> 'betterAnswer: LOSSLESS …' and 'L4: a 1-unit window …' red
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
    ANYTIME_PASSES, betterAnswer, budgetCut, createInPlaceSolveService, createWorkClock, deadlineOf, FINE_CHECKPOINTS, liveOf,
    passNote, passShouldStop, solveAnytime, solveFromTape, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK, upgradeWindowWork,
} from './jsRuntimeSolver.js';
import { DEADLINE_SITES } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const [DASHLESS, FULL] = ANYTIME_PASSES;

/**
 * L4 from (16,16) with the sword → its stairs down (teleporter 0, to L5). `prefix` = key sets the session
 * plays first, so the request is a CONTINUATION (a solve from a held room, `perTick` non-empty).
 */
function l4StairsSword({ prefix = [] } = {}) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]);
    rt.tick();
    for (const keys of prefix) rt.tick(new Set(keys));
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
    it('the passes name their deadline: dashless every site at the budget, full every site at the window (⛓ WINDOW WHOLE PASS)', () => {
        expect(ANYTIME_PASSES.map((p) => [p.pass, p.stop])).toEqual([['dashless', 'all'], ['full', 'window']]);
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

    it('passShouldStop: no budget → none; every pass trips EVERY site past the budget; full ALSO trips every site past the window, only with a plan in hand — counted in calls, no clock', () => {
        const at = { budgetWork: 10 };
        expect(passShouldStop(DASHLESS, { ...at, budgetWork: null, work: createWorkClock() })).toBeNull();
        expect(passShouldStop(FULL, { ...at, budgetWork: null, windowWork: 3, planInHand: true, work: createWorkClock() })).toBeNull();
        const drive = (p, opts, sites) => { const work = createWorkClock(); const limit = {}; const f = passShouldStop(p, { ...at, ...opts, work, limit });
            return { out: sites.map((s) => f(s)), limit: limit.first ?? null, units: work.units }; };
        const ten = new Array(10).fill('block-route');
        // dashless: calls 1..10 pass, the 11th (any site) trips — `budget`
        expect(drive(DASHLESS, {}, [...ten, 'detour'])).toEqual({ out: [...ten.map(() => false), true], limit: 'budget', units: 11 });
        // full with a plan in hand, window 3: ANY site trips from its 4th unit (⛓ WINDOW WHOLE PASS)
        const f = drive(FULL, { windowWork: 3, planInHand: true }, ['detour', 'detour', 'detour', 'block-route', 'sword-dash']);
        expect(f).toEqual({ out: [false, false, false, true, true], limit: 'window', units: 5 });
        // full with NO plan in hand: no window, but the budget still bounds it (the page's old cut, now work)
        expect(drive(FULL, { windowWork: 3, planInHand: false }, [...ten.map(() => 'sword-dash'), 'sword-dash']).out.slice(-2)).toEqual([false, true]);
        // the attempt's clock is SHARED: units the dashless pass spent count against the full pass
        const work = createWorkClock();
        for (let i = 0; i < 9; i += 1) work.tick();
        const late = passShouldStop(FULL, { budgetWork: 10, windowWork: 3, planInHand: false, work, limit: {} });
        expect([late('detour'), late('detour')]).toEqual([false, true]);
        // … and against the window: with a plan in hand, 9 units spent > a window of 3 — its first ask trips
        const work2 = createWorkClock();
        for (let i = 0; i < 9; i += 1) work2.tick();
        const limit = {};
        expect(passShouldStop(FULL, { budgetWork: 10, windowWork: 3, planInHand: true, work: work2, limit })('detour')).toBe(true);
        expect(limit.first).toBe('window');
    });

    it('⛓ WINDOW WHOLE PASS — the site table: every site × plan in hand / not × pass, at the unit past the window', () => {
        const at = { budgetWork: 10, windowWork: 3 };
        const fourth = (p, planInHand, site) => {
            const work = createWorkClock(); const limit = {};
            const f = passShouldStop(p, { ...at, planInHand, work, limit });
            const first3 = [f('walk'), f('walk'), f('walk')];
            return { first3, fourth: f(site), limit: limit.first ?? null };
        };
        expect(DEADLINE_SITES.length).toBeGreaterThan(5);
        for (const site of DEADLINE_SITES) {
            // full, plan in hand: every site trips past the window
            expect([site, fourth(FULL, true, site)]).toEqual([site, { first3: [false, false, false], fourth: true, limit: 'window' }]);
            // full, NO plan in hand: the only search — the whole budget
            expect([site, fourth(FULL, false, site)]).toEqual([site, { first3: [false, false, false], fourth: false, limit: null }]);
            // dashless: never a window, plan in hand or not
            expect([site, fourth(DASHLESS, true, site)]).toEqual([site, { first3: [false, false, false], fourth: false, limit: null }]);
            expect([site, fourth(DASHLESS, false, site)]).toEqual([site, { first3: [false, false, false], fourth: false, limit: null }]);
        }
    });

    it('betterAnswer: LOSSLESS for the plan in hand — a refusal cut at the window (any site) never replaces a plan', () => {
        for (const first of DEADLINE_SITES) {
            const cut = { ok: false, kind: 'refusal', pass: 'full', message: `hit \`${first}\``, deadline: { tripped: true, first, sites: { [first]: 1 } } };
            expect([first, betterAnswer(plan(2570, 'dashless'), cut)]).toEqual([first, false]);
        }
        expect(betterAnswer(plan(2570, 'dashless'), { ok: false, kind: 'refusal', message: 'no corridor' })).toBe(false);
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

    it('L4: a 1-unit window — the WHOLE full pass stops at its first ask (⛓ WINDOW WHOLE PASS: `walk`, a refusal), and the plan in hand ships (lossless)', () => {
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1e9, upgradeWindowWork: 1 }, { clock: counter() });
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('dashless');
        expect(r.plan.solution.length).toBe(255);
        expect(r.plan.verbs).toEqual(['hold', 'shove', 'walk']);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255, work: 19 },
            { pass: 'full', ok: false, kind: 'refusal', ticks: null, work: 1, deadline: 'walk', limit: 'window' }]);
        expect(budgetCut(r)).toBe(false);
        expect(passNote(r.plan)).toBe('pass dashless, full stopped at its deadline (walk)');
    }, 60000);

    it('L4: the window that holds the WHOLE full pass (19 dashless + 57 full = 76 units) upgrades to 219 t; one unit less ships the dashless 255 t — the window bounds the pass, not its last dash ask', () => {
        const at = (w) => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: w }, { clock: counter() });
        const fits = at(76);
        expect(rows(fits)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255, work: 19 },
            { pass: 'full', ok: true, kind: null, ticks: 219, work: 57 }]);
        expect(fits.plan.pass).toBe('full');
        const short = at(75);
        expect(short.plan.pass).toBe('dashless');
        expect(short.plan.solution.length).toBe(255);
        expect(rows(short)[1]).toMatchObject({ pass: 'full', ok: false, kind: 'refusal', limit: 'window' });
        // the shipped default (80) holds it: L4 still upgrades
        expect(SOLVER_UPGRADE_WINDOW_WORK).toBeGreaterThanOrEqual(76);
    }, 120000);

    it('L4: a 1-unit BUDGET — the dashless pass refuses BY NAME at the `walk` site (⏱; ⛓ RECALIBRATE: the FINE checkpoints ask `walk` before the first block-route), and so does the full pass (no plan in hand: the budget still bounds it) — a budget CUT', () => {
        const heard = [];
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1, upgradeWindowWork: null }, { clock: counter(), onPass: (a) => heard.push(a) });
        expect(heard[0]).toMatchObject({ ok: false, kind: 'refusal', pass: 'dashless', deadline: { tripped: true, first: 'walk' } });
        expect(heard[0].message).toMatch(/at the `walk` site.*⏱ DEADLINE/s);
        expect(heard[0].obstacle ?? null).toBeNull(); // a `walk` trip names no obstacle (fidelity CHECKPOINTS)
        expect(heard[1]).toMatchObject({ ok: false, pass: 'full', deadline: { first: 'walk' } });
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

describe('⛓ RECALIBRATE — every budgeted path asks the FINE checkpoints (`time`, `walk`, the via-set `detour`): the unit the constants are counted in', () => {
    /** One pass's asks under a never-true hook, coarse or fine — what the work clock would count. */
    const asks = (req, fine) => {
        const sites = {};
        const shouldStop = (site) => { sites[site] = (sites[site] ?? 0) + 1; return false; };
        solveFromTape({ ...req, dashMode: DASHLESS.dashMode, shouldStop, fineCheckpoints: fine });
        return sites;
    };
    const CONT = Array.from({ length: 8 }, () => ['down']);

    it('the switch is ON, and the work clock counts fine units: the dashless pass asks `walk` too (coarse it asks block-route only)', () => {
        expect(FINE_CHECKPOINTS).toBe(true);
        const coarse = asks(l4StairsSword(), false);
        const fine = asks(l4StairsSword(), true);
        expect(coarse.walk).toBeUndefined();
        expect(fine.walk).toBeGreaterThan(0);
        const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1e9, upgradeWindowWork: null }, { clock: counter() });
        expect(r.passes[0].work).toBe(total(fine));
    }, 60000);

    it('a CONTINUATION (a request with a prefix — the wasm engine\'s held room, the JS page mid-room) is fine too: a 1-unit budget trips at `walk`', () => {
        const req = l4StairsSword({ prefix: CONT });
        expect(req.perTick.length).toBe(CONT.length + 1);
        const r = solveAnytime({ ...req, budgetWork: 1, upgradeWindowWork: null }, { clock: counter() });
        expect(r.ok).toBe(false);
        expect(r.passes.map((p) => [p.pass, p.deadline, p.limit])).toEqual([['dashless', 'walk', 'budget'], ['full', 'walk', 'budget']]);
        // untripped, the continuation's units are the fine count of its own segment
        const u = solveAnytime({ ...l4StairsSword({ prefix: CONT }), budgetWork: 1e9, upgradeWindowWork: null }, { clock: counter() });
        expect(u.ok).toBe(true);
        expect(u.passes[0].work).toBe(Object.values(asks(l4StairsSword({ prefix: CONT }), true)).reduce((a, b) => a + b, 0));
    }, 90000);

    it('a HELD RETRY (the passes not yet answered — full alone) is fine too: a 1-unit budget trips at `walk`', () => {
        const r = solveAnytime({ ...l4StairsSword(), budgetWork: 1, upgradeWindowWork: null }, { passes: [FULL], clock: counter() });
        expect(r.passes.map((p) => [p.pass, p.deadline, p.limit])).toEqual([['full', 'walk', 'budget']]);
    }, 60000);

    it('in place (no budget) asks nothing — the fine sites ride on the hook, and there is none', () => {
        const h = createInPlaceSolveService({ clock: counter() }).start({ ...l4StairsSword({ prefix: CONT }), budgetWork: 1, upgradeWindowWork: 1 });
        expect(h.result.ok).toBe(true);
        expect(h.result.passes.map((p) => p.work ?? null)).toEqual([null, null]);
    }, 60000);
});
