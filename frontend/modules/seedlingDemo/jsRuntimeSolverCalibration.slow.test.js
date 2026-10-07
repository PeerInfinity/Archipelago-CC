/**
 * jsRuntimeSolver ⛓ RECALIBRATE — the work constants' ANCHOR legs, solved at
 * the shipped defaults (`SOLVER_BUDGET_WORK`, `SOLVER_UPGRADE_WINDOW_WORK`)
 * with the FINE checkpoints on (`FINE_CHECKPOINTS`), exactly as the worker
 * solves them (`solveAnytime`, one work clock per attempt).
 * Design: `docs/json/developer/procgen/flash.md` ("Pass deadlines").
 *
 * The anchors (fidelity CHECKPOINTS' D3 table, re-measured on wave 7):
 *   - swordless L14 (160,64) → its stairs: the slowest SHIPPING dashless pass,
 *     624 fine units (492 coarse) — the budget must ship it in one attempt;
 *   - L30 (240,80) with the sword → its teleporter: the full pass upgrades
 *     237 → 110 t, its last dash ask at unit 50 (16 dashless + 34);
 *   - L40 (480,896) with the sword → its stairs: 417 → 172 t, the last dash
 *     ask at unit 80 (28 + 52). ⛓ WINDOW WHOLE PASS (the whole full pass stops
 *     at the window once a plan is in hand): its full pass spends 57 units, so
 *     the upgrade needs a window of 85 (28 + 57).
 *     ⛓ WINDOW 85 (⚖ the user, 2026-10-07) — THE CALIBRATION RULE: W = the
 *     units the WHOLE full pass needs on the worst upgrading leg (L40 → 85),
 *     not its last dash ask. At the default L40 ships its full 172 t; one unit
 *     less (84) cuts the full pass at the window and the dashless 417 t ships —
 *     the bound is tight.
 *
 * ── THE MUTATION LIST (each row's catcher named) ──
 *   r2 the window back at 40 → 'L30 …' red (the dashless plan is kept)
 *   w1 only `sword-dash` trips at the window (the rule before WINDOW WHOLE PASS) → 'L40 … at 84' reds
 *   w2 the window back at 80 → 'L40 … at the default' reds (the dashless 417 t ships)
 *   r4 the budget back at 500 → 'swordless L14 …' red (its only plan is cut at `detour`)
 *
 * Slow tier (`npm run test:unit:slow`): ~10–60 s per leg, CPU-bound.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { FINE_CHECKPOINTS, solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from './wasmArrival.js';
import { stageItems } from './wasmDelivery.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = indexLevels(MAP);
const SRC = levelSourceFromAtlas(RECORDS);

/** A fresh JS boot at `at` in `level` (with the sword in slot 0 when `sword`), solving to the exit at `tiles`. */
function leg({ level, at, tiles, sword }) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    if (sword) rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, at.x, at.y] }]);
    rt.tick();
    const staging = sword ? stageItems(rt.session.staging, {}, { slots: [0] }) : rt.session.staging;
    const mapped = arrivalSolverGoal({ kind: 'exit', level, tiles }, { staging, levelSource: SRC, record: RECORDS.get(level) });
    expect(mapped.goal).toBeTruthy();
    return arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECORDS, name: `calib-L${level}`,
        scratchPersistence: true });
}
const atDefaults = (req) => solveAnytime({ ...req, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK });
const rows = (r) => r.passes.map(({ ms, ...row }) => row);

describe('⛓ RECALIBRATE — the anchor legs at the shipped defaults (fine units)', () => {
    it('the constants are counted in fine units', () => {
        expect(FINE_CHECKPOINTS).toBe(true);
    });

    it('swordless L14 (the slowest shipping dashless pass, DETOUR): ships its 173 t plan in ONE attempt, 624 units, nothing cut', () => {
        const r = atDefaults(leg({ level: 14, at: { x: 160, y: 64 }, tiles: [[2, 4]], sword: false }));
        expect(r.ok).toBe(true);
        expect(r.plan.pass).toBe('dashless');
        expect(r.plan.solution.length).toBe(173);
        expect(rows(r)[0]).toEqual({ pass: 'dashless', ok: true, kind: null, ticks: 173, work: 624 });
        expect(rows(r)[1]).toMatchObject({ pass: 'full', kind: 'skipped' });
        expect(SOLVER_BUDGET_WORK).toBeGreaterThanOrEqual(624);
    }, 300000);

    it('L30 with the sword: the full pass UPGRADES inside the window (237 → 110 t), its last dash ask at unit 50', () => {
        const r = atDefaults(leg({ level: 30, at: { x: 240, y: 80 }, tiles: [[0, 8]], sword: true }));
        expect(r.ok).toBe(true);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 237, work: 16 },
            { pass: 'full', ok: true, kind: null, ticks: 110, work: 37 }]);
        expect(r.plan.pass).toBe('full');
    }, 300000);

    it('L40 with the sword at the default window: ⛓ WINDOW 85 holds the WHOLE full pass (28 + 57 = 85) — it UPGRADES (417 → 172 t)', () => {
        const r = atDefaults(leg({ level: 40, at: { x: 480, y: 896 }, tiles: [[20, 36]], sword: true }));
        expect(r.ok).toBe(true);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 417, work: 28 },
            { pass: 'full', ok: true, kind: null, ticks: 172, work: 57 }]);
        expect(r.plan.pass).toBe('full');
        expect(SOLVER_UPGRADE_WINDOW_WORK).toBe(85);
    }, 600000);

    it('L40 with the sword at a window of 84 (one unit short of the whole full pass): the full pass is cut at the window — the dashless 417 t ships', () => {
        const r = solveAnytime({ ...leg({ level: 40, at: { x: 480, y: 896 }, tiles: [[20, 36]], sword: true }),
            budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: 84 });
        expect(r.ok).toBe(true);
        expect(rows(r)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 417, work: 28 },
            { pass: 'full', ok: false, kind: 'refusal', ticks: null, work: 57, deadline: 'walk', limit: 'window' }]);
        // Tight: the window trips at unit 85 — the full pass's 57th and LAST unit (its final `walk` ask).
        expect(r.plan.pass).toBe('dashless');
    }, 600000);
});
