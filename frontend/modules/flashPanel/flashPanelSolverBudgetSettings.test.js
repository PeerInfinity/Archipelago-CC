/**
 * ⛓ DETERMINISTIC BUDGET (⚖ the user, 2026-10-05: *"I want plans to be
 * identical on every machine"*) — the flashPanel settings that bound the
 * Seedling solver are WORK units, and their schema defaults ARE the solver's
 * own constants (`jsRuntimeSolver.SOLVER_BUDGET_WORK`,
 * `SOLVER_UPGRADE_WINDOW_WORK`): a default typed into the schema that drifts
 * from the constant would make the panel solve under a different budget than
 * every node gate, probe and test measured.
 *
 * ⛔ The old millisecond keys (`seedlingWasmSolverBudgetMs`,
 * `seedlingSolverUpgradeWindowMs`) are GONE from the schema, not aliased: a
 * value saved under them is no longer read (the migration note in `index.js`).
 */
import { describe, expect, it } from 'vitest';

import { register } from './index.js';
import { SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from '../seedlingDemo/jsRuntimeSolver.js';

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, {
        get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; },
    });
    register(api);
    return schema;
}

describe('the solver budget settings are WORK units, defaulted to the solver\'s constants', () => {
    const props = settingsSchema()?.properties ?? {};

    it('the wasm budget: `seedlingWasmSolverBudgetWork`, default SOLVER_BUDGET_WORK', () => {
        expect(props.seedlingWasmSolverBudgetWork).toMatchObject({ type: 'number', default: SOLVER_BUDGET_WORK, minimum: 1 });
        expect(props.seedlingWasmSolverBudgetWork.label).toMatch(/work units/);
    });

    it('the upgrade window: `seedlingSolverUpgradeWindowWork`, default SOLVER_UPGRADE_WINDOW_WORK (0 = the whole budget)', () => {
        expect(props.seedlingSolverUpgradeWindowWork).toMatchObject({ type: 'number', default: SOLVER_UPGRADE_WINDOW_WORK, minimum: 0 });
        expect(props.seedlingSolverUpgradeWindowWork.label).toMatch(/work units/);
    });

    it('the millisecond keys are gone (not aliased)', () => {
        expect(props.seedlingWasmSolverBudgetMs).toBeUndefined();
        expect(props.seedlingSolverUpgradeWindowMs).toBeUndefined();
    });
});
