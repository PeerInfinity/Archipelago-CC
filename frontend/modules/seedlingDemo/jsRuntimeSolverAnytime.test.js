/**
 * jsRuntimeSolver ⛓ ANYTIME — the solver's passes, cheapest first (the user,
 * 2026-10-04: search without sword dashes first, keep that plan, and fall back
 * on it when the dash search runs out of time), and the wasm engine's expiry
 * policy (O2: a held retry, then a named failure). Design: `docs/json/developer/procgen/flash.md`
 * (the solver mode's anytime passes; Wasm playback step 3); measurement: slice `seedling-js-l16-budget`.
 *
 * The real witness is a census leg slice `seedling-js-l16-budget` measured: L11's chest from
 * (32,16) with the full kit — dashless 180 ticks in ~0.1 s, full 160 ticks
 * (one sword dash saving 21) in ~1.5 s — so the full plan REPLACES the
 * dashless one. L71's chest BARE (no sword, 552 ticks either way): the full
 * pass is SKIPPED by name.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m2 a full plan replaces the provisional one when it is WORSE (or tied)
 *        -> 'betterAnswer: …' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import {
    ANYTIME_PASSES, betterAnswer, createInPlaceSolveService, liveOf, passesAfter, PASS_STRATEGIES, solveAnytime,
} from './jsRuntimeSolver.js';
import { DEFAULT_DASH_MODE } from './solverBot.js';
import { expiryAction, expiryFailure, MAX_SOLVE_RETRIES, SOLVE_RETRY_BUDGET_FACTOR } from './wasmPlayback.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];

/** A fresh JS boot in `level` at `at` (the report's census legs, `leg.mjs`) and its chest request. */
function chestLeg({ level, at, chest, kit }) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    if (kit) rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, at.x, at.y] }]);
    rt.tick();
    const s = rt.session;
    return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: `anytime-L${level}-chest`,
        solverGoal: { kind: 'collect-placement', placement: chest }, scratchPersistence: rt.run.scratchPersistence === true };
}
const l11Chest = ({ kit }) => chestLeg({ level: 11, at: { x: 32, y: 16 }, chest: { x: 32, y: 48 }, kit });
const l71Chest = ({ kit }) => chestLeg({ level: 71, at: { x: 96, y: 0 }, chest: { x: 160, y: 256 }, kit });

const plan = (ticks, pass = 'p') => ({ ok: true, pass, plan: { pass, solution: new Array(ticks).fill([]) } });
const refusal = (pass = 'p') => ({ ok: false, kind: 'refusal', pass, message: `refused in ${pass}` });
const skipped = { ok: false, kind: 'skipped', message: 'sword-dash is not available here' };

describe('⛓ ANYTIME — the passes and the choice between them', () => {
    it('the passes are DASHLESS first, then FULL (the roster\'s own dash mode, i.e. the one search every solve made before)', () => {
        expect(ANYTIME_PASSES.map((p) => [p.pass, p.dashMode, p.adds ?? null]))
            .toEqual([['dashless', 'none', null], ['full', DEFAULT_DASH_MODE, 'sword-dash']]);
        expect(Object.keys(PASS_STRATEGIES)).toEqual(['sword-dash']);
    });

    it('betterAnswer: a plan beats none; a later plan replaces only with STRICTLY fewer ticks; a skip never replaces', () => {
        expect(betterAnswer(null, plan(10))).toBe(true);
        expect(betterAnswer(refusal(), plan(10))).toBe(true);
        expect(betterAnswer(plan(180), plan(160))).toBe(true); // L11 kit: the dash saves 20 ticks
        expect(betterAnswer(plan(160), plan(180))).toBe(false); // worse: kept
        expect(betterAnswer(plan(527), plan(527))).toBe(false); // tied (L71 kit): the cheaper search's plan is kept
        expect(betterAnswer(plan(100), refusal())).toBe(false);
        expect(betterAnswer(plan(100), skipped)).toBe(false);
        expect(betterAnswer(refusal('dashless'), refusal('full'))).toBe(true); // no plan: the fuller search's word
        expect(betterAnswer(refusal(), skipped)).toBe(false);
        expect(betterAnswer(null, skipped)).toBe(false);
    });

    it('passesAfter resumes at the first pass that had not answered', () => {
        expect(passesAfter(ANYTIME_PASSES, 0).map((p) => p.pass)).toEqual(['dashless', 'full']);
        expect(passesAfter(ANYTIME_PASSES, 1).map((p) => p.pass)).toEqual(['full']);
        expect(passesAfter(ANYTIME_PASSES, 2)).toEqual([]);
    });

    it('L11 chest, KIT: dashless 180 ticks, then FULL 160 ticks (one dash) REPLACES it — each pass heard as it lands, the plan named', () => {
        const heard = [];
        const out = solveAnytime(l11Chest({ kit: true }), {
            onPass: (one, best, i) => heard.push({ i, pass: one.pass, ticks: one.plan?.solution.length, best: best.pass }),
        });
        expect(heard).toEqual([
            { i: 0, pass: 'dashless', ticks: 180, best: 'dashless' },
            { i: 1, pass: 'full', ticks: 160, best: 'full' },
        ]);
        expect(out.ok).toBe(true);
        expect(out.pass).toBe('full');
        expect(out.plan.pass).toBe('full');
        expect(out.plan.dashMode).toBe(DEFAULT_DASH_MODE);
        expect(out.plan.passes.map((r) => [r.pass, r.ok, r.ticks])).toEqual([['dashless', true, 180], ['full', true, 160]]);
    });

    it('L71 chest, BARE (no sword): the full pass is SKIPPED by name (it would repeat the dashless search) — the dashless plan (552 ticks) is the answer', () => {
        const out = solveAnytime(l71Chest({ kit: false }));
        expect(out.ok).toBe(true);
        expect(out.pass).toBe('dashless');
        expect(out.plan.solution.length).toBe(552);
        expect(out.passes.map((r) => [r.pass, r.ok, r.kind])).toEqual([['dashless', true, null], ['full', false, 'skipped']]);
    });

    it('the in-place service runs every pass (no budget) and answers with the best, named', () => {
        const h = createInPlaceSolveService().start(l11Chest({ kit: true }));
        expect(h.settled).toBe(true);
        expect(h.result.plan.pass).toBe('full');
        expect(h.result.plan.solution.length).toBe(160);
        const only = createInPlaceSolveService().start({ ...l11Chest({ kit: true }), passes: [ANYTIME_PASSES[0]] });
        expect(only.result.plan.pass).toBe('dashless');
        expect(only.result.plan.solution.length).toBe(180);
    });
});

describe('⛓ O2 — what a wasm solve past its budget does', () => {
    it(`a provisional PLAN plays; else one held retry at ${SOLVE_RETRY_BUDGET_FACTOR}× (the bound is ${MAX_SOLVE_RETRIES}); then the end`, () => {
        expect(SOLVE_RETRY_BUDGET_FACTOR).toBe(4);
        expect(MAX_SOLVE_RETRIES).toBe(1);
        expect(expiryAction({ provisional: plan(206, 'dashless'), retries: 0 })).toBe('provisional');
        expect(expiryAction({ provisional: plan(206, 'dashless'), retries: 1 })).toBe('provisional');
        expect(expiryAction({ provisional: null, retries: 0 })).toBe('retry');
        expect(expiryAction({ provisional: refusal('dashless'), retries: 0 })).toBe('retry');
        expect(expiryAction({ provisional: null, retries: 1 })).toBe('give-up');
    });

    it('the failure names the budgets spent; a pass that DECLINED before the expiry leads (the door-only L14 race)', () => {
        const goal = { kind: 'exit', level: 16, name: 'level_16 -> level_17' };
        expect(expiryFailure({ goal, budgets: [5000, 20000] }))
            .toBe('the solver exceeded 5 s, then 20 s on its held retry on exit in level 16 (terminated)');
        expect(expiryFailure({ goal, budgets: [5000, 20000], refusal: refusal('dashless') }))
            .toBe('the solver declined level_16 -> level_17 in level 16 (pass dashless): refused in dashless — and the solver '
                + 'exceeded 5 s, then 20 s on its held retry on exit in level 16 (terminated)');
    });
});
