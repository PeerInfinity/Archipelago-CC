/**
 * jsRuntimeSolver ⛓ SHOULD-STOP — the anytime passes run under `solveSegment`'s
 * deadline hook (`shouldStop`, fidelity SF2). Design: `docs/json/developer/procgen/flash.md`
 * (the solver mode's anytime passes).
 *
 *   - the DASHLESS pass is bounded at the BUDGET at every site, so a slow
 *     refusal refuses BY NAME (the ⏱ clause) instead of overrunning;
 *   - the FULL pass's dash search stops at the UPGRADE WINDOW (only the
 *     `sword-dash` site, the one lossless site) once a plan is in hand, so the
 *     pass RETURNS a plan instead of being cut; the shorter plan is kept;
 *   - the window is a setting (`flashPanel.seedlingSolverUpgradeWindowMs`):
 *     absent / 0 = the whole budget (today's behaviour).
 *
 * The witness is a fresh boot in L4 at (16,16) WITH the sword, its stairs down
 * (the teleporter to L5): the dashless plan is 255 ticks (hold, shove, walk),
 * the full plan 219 (a dash) — and its shove is REQUIRED, so a trip at every
 * site refuses at `block-route` (the lossy case). The clock is a COUNTER (one
 * unit per read), so every row is a pure function of where the hook tripped.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   s1 the full pass trips EVERY site at the window (lossy)
 *        -> 'L4: a 1-unit window …' reds (the full pass refuses at block-route)
 *   s2 a tripped full plan LONGER than the dashless one replaces it
 *        -> 'betterAnswer: a tripped (partial-dash) plan …' reds
 *   s3 the window is ignored (the full pass gets the whole budget)
 *        -> 'L4: a 1-unit window …' and the `passShouldStop` table red
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import {
    ANYTIME_PASSES, betterAnswer, createInPlaceSolveService, deadlineOf, liveOf, passNote, passShouldStop, solveAnytime,
    upgradeWindowMs,
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
/** A counter clock: one unit per read — the hook's own reads included. */
const counter = () => { let n = 0; return () => n++; };
const rows = (r) => r.passes.map(({ ms, ...row }) => row);

const plan = (ticks, pass = 'p', extra = {}) => ({ ok: true, pass, plan: { pass, solution: new Array(ticks).fill([]), ...extra } });

describe('⛓ SHOULD-STOP — the window and each pass\'s deadline', () => {
    it('the passes name their deadline: dashless every site, full the dash site only', () => {
        expect(ANYTIME_PASSES.map((p) => [p.pass, p.stop])).toEqual([['dashless', 'all'], ['full', 'sword-dash']]);
        expect(DEADLINE_SITES).toContain('sword-dash');
    });

    it('upgradeWindowMs: absent / 0 / junk = the whole budget (today); a window is never longer than its budget', () => {
        expect(upgradeWindowMs(5000)).toBe(5000);
        expect(upgradeWindowMs(5000, null)).toBe(5000);
        expect(upgradeWindowMs(5000, 0)).toBe(5000);
        expect(upgradeWindowMs(5000, -3)).toBe(5000);
        expect(upgradeWindowMs(5000, 'junk')).toBe(5000);
        expect(upgradeWindowMs(5000, 1000)).toBe(1000);
        expect(upgradeWindowMs(20000, 1000)).toBe(1000); // the held retry keeps the user's window
        expect(upgradeWindowMs(5000, 60000)).toBe(5000);
    });

    it('passShouldStop: no budget → none; dashless trips EVERY site at the budget; full trips ONLY the dash site at the window, and only with a plan in hand', () => {
        let t = 0;
        const clock = () => t;
        const at = { startedAt: 100, budgetMs: 5000, clock };
        expect(passShouldStop(DASHLESS, { ...at, budgetMs: null })).toBeNull();
        expect(passShouldStop(FULL, { ...at, budgetMs: null, windowMs: 1000, planInHand: true })).toBeNull();
        expect(passShouldStop(FULL, { ...at, windowMs: 1000, planInHand: false })).toBeNull(); // the only search left
        const dashless = passShouldStop(DASHLESS, at);
        const full = passShouldStop(FULL, { ...at, windowMs: 1000, planInHand: true });
        const fullDefault = passShouldStop(FULL, { ...at, planInHand: true });
        t = 1099;
        expect(DEADLINE_SITES.map((s) => [dashless(s), full(s)])).toEqual(DEADLINE_SITES.map(() => [false, false]));
        t = 1100; // the window
        expect(DEADLINE_SITES.map((s) => full(s))).toEqual(DEADLINE_SITES.map((s) => s === 'sword-dash'));
        expect(fullDefault('sword-dash')).toBe(false);
        t = 5099;
        expect(dashless('block-route')).toBe(false);
        t = 5100; // the budget
        expect(DEADLINE_SITES.map((s) => dashless(s))).toEqual(DEADLINE_SITES.map(() => true));
        expect(DEADLINE_SITES.map((s) => fullDefault(s))).toEqual(DEADLINE_SITES.map((s) => s === 'sword-dash'));
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
        expect(passNote(p, { expired: true })).toBe('pass dashless, full stopped at its deadline (sword-dash), the later pass ran out of budget');
        expect(passNote({ pass: 'full' })).toBe('pass full');
    });
});

describe('⛓ SHOULD-STOP — L4 stairs with the sword (dashless 255 t, full 219 t with a dash, a REQUIRED shove)', () => {
    it('the default window (= the budget) is today: the full plan (219 t) replaces the dashless one, nothing tripped', () => {
        const r = solveAnytime({ ...l4StairsSword(), budgetMs: 1e9, upgradeWindowMs: null }, { clock: counter() });
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('full');
        expect(r.plan.solution.length).toBe(219);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255 }, { pass: 'full', ok: true, kind: null, ticks: 219 }]);
        expect(r.plan.deadline).toBeNull();
    }, 60000);

    it('L4: a 1-unit window — the full pass\'s DASH search stops, the pass RETURNS a plan (lossless: no refusal), and the dashless plan (not longer) is kept', () => {
        const r = solveAnytime({ ...l4StairsSword(), budgetMs: 1e9, upgradeWindowMs: 1 }, { clock: counter() });
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('dashless');
        expect(r.plan.solution.length).toBe(255);
        expect(r.plan.verbs).toEqual(['hold', 'shove', 'walk']);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255 },
            { pass: 'full', ok: true, kind: null, ticks: 255, deadline: 'sword-dash' }]);
        expect(passNote(r.plan)).toBe('pass dashless, full stopped at its deadline (sword-dash)');
    }, 60000);

    it('L4: a 1-unit BUDGET — the dashless pass refuses BY NAME at block-route (⏱), and the full pass (no plan in hand: no deadline) solves', () => {
        const heard = [];
        const r = solveAnytime({ ...l4StairsSword(), budgetMs: 1, upgradeWindowMs: null }, { clock: counter(), onPass: (a) => heard.push(a) });
        expect(heard[0]).toMatchObject({ ok: false, kind: 'refusal', pass: 'dashless', deadline: { tripped: true, first: 'block-route' } });
        expect(heard[0].message).toMatch(/hit `deadline`.*⏱ DEADLINE/s);
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('full');
        expect(r.plan.solution.length).toBe(219);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: false, kind: 'refusal', ticks: null, deadline: 'block-route' },
            { pass: 'full', ok: true, kind: null, ticks: 219 }]);
    }, 60000);

    it('the in-place service has no budget, so no deadline: a request\'s budget and window are dropped', () => {
        const h = createInPlaceSolveService({ clock: counter() }).start({ ...l4StairsSword(), budgetMs: 1, upgradeWindowMs: 1 });
        expect(h.result.plan.pass).toBe('full');
        expect(h.result.passes.map((p) => p.deadline ?? null)).toEqual([null, null]);
    }, 60000);
});
