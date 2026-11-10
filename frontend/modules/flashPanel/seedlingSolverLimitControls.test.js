/**
 * ⛓ SOLVER LIMIT OFF — the Flash panel's limit controls and Stop (`seedlingSolverLimitControls.js`) and their settings.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   c1 "no work limit" is a number to type (no boolean setting)          -> 'the settings …' reds
 *   c2 the panel's constants drift from the solver's                     -> 'the panel's engine values …' reds
 *   c3 the backstop's default is handed as 300000 (not null = own)       -> 'backstopMsOf …' reds
 *   c4 un-ticking "no work limit" drops a stored budget                  -> 'wasmBudgetKnobOf …' reds
 *   c5 Stop stops a service that is not busy / is always enabled          -> 'Stop …' and 'the row …' red
 */
import { describe, expect, it } from 'vitest';

import { register } from './index.js';
import {
    ENGINE_BACKSTOP_OFF, ENGINE_NO_LIMIT, SOLVER_BACKSTOP_DEFAULT_SECONDS, SOLVER_LIMIT_PROPS, anySolving, backstopMsOf,
    buildSolverLimitRow, stopSolves, wasmBudgetKnobOf,
} from './seedlingSolverLimitControls.js';
import { SOLVE_BACKSTOP_MS, SOLVE_BACKSTOP_OFF, SOLVER_BUDGET_NO_LIMIT } from '../seedlingDemo/jsRuntimeSolver.js';

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
    register(api);
    return schema;
}

/** A minimal DOM double: elements with children, listeners, style and the attributes the row sets. */
function fakeDocument() {
    const doc = {
        activeElement: null,
        createElement(tag) {
            const listeners = {};
            const el = {
                tag, children: [], style: {}, attrs: {}, disabled: false, checked: false, value: '', textContent: '',
                append(...c) { el.children.push(...c); },
                setAttribute(k, v) { el.attrs[k] = v; },
                addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
                fire(type) { for (const fn of listeners[type] ?? []) fn({ preventDefault() {} }); },
            };
            return el;
        },
    };
    return doc;
}

describe('⛓ SOLVER LIMIT OFF — the settings', () => {
    const props = settingsSchema()?.properties ?? {};

    it('the settings: "no work limit" and "backstop off" are NAMED choices (checkboxes, off by default); the backstop is 300 s', () => {
        expect(props[SOLVER_LIMIT_PROPS.noWorkLimit]).toMatchObject({ type: 'boolean', default: false });
        expect(props[SOLVER_LIMIT_PROPS.noWorkLimit].label).toMatch(/no work limit/);
        expect(props[SOLVER_LIMIT_PROPS.noWorkLimit].description).toMatch(/no budget and no upgrade window/);
        expect(props[SOLVER_LIMIT_PROPS.noWorkLimit].description).toMatch(/plan may differ from the default's/);
        expect(props[SOLVER_LIMIT_PROPS.backstopOff]).toMatchObject({ type: 'boolean', default: false });
        expect(props[SOLVER_LIMIT_PROPS.backstopOff].label).toMatch(/backstop off/);
        expect(props[SOLVER_LIMIT_PROPS.backstopSeconds]).toMatchObject({ type: 'number', default: SOLVE_BACKSTOP_MS / 1000, minimum: 1 });
        // the numeric budget is untouched (0 is still not a value a person types: minimum 1), and points at the checkbox
        expect(props.seedlingWasmSolverBudgetWork).toMatchObject({ type: 'number', default: 640, minimum: 1 });
        expect(props.seedlingWasmSolverBudgetWork.description).toMatch(/no work limit/);
    });

    it('the panel\'s engine values are the solver\'s', () => {
        expect(ENGINE_NO_LIMIT).toBe(SOLVER_BUDGET_NO_LIMIT);
        expect(ENGINE_BACKSTOP_OFF).toBe(SOLVE_BACKSTOP_OFF);
        expect(SOLVER_BACKSTOP_DEFAULT_SECONDS * 1000).toBe(SOLVE_BACKSTOP_MS);
    });
});

describe('⛓ SOLVER LIMIT OFF — what the surface hands the runtimes', () => {
    it('backstopMsOf: off → 0; the default (or unset / junk) → null (the runtime\'s own); else seconds × 1000', () => {
        expect(backstopMsOf({ seconds: 300, off: false })).toBeNull();
        expect(backstopMsOf({ seconds: undefined, off: false })).toBeNull();
        expect(backstopMsOf({ seconds: 'x', off: false })).toBeNull();
        expect(backstopMsOf({ seconds: -3, off: false })).toBeNull();
        expect(backstopMsOf({ seconds: 600, off: false })).toBe(600000);
        expect(backstopMsOf({ seconds: 600, off: true })).toBe(0);
        expect(backstopMsOf({ seconds: 300, off: true })).toBe(0);
    });

    it('wasmBudgetKnobOf: ticked → 0 (no limit); un-ticked → the stored budget as it was (640 / unset keep their meaning)', () => {
        expect(wasmBudgetKnobOf(true, 640)).toBe(0);
        expect(wasmBudgetKnobOf(true, null)).toBe(0);
        expect(wasmBudgetKnobOf(false, 640)).toBe(640);
        expect(wasmBudgetKnobOf(false, 900)).toBe(900);
        expect(wasmBudgetKnobOf(false, null)).toBeNull();
        expect(wasmBudgetKnobOf(undefined, undefined)).toBeNull();
    });

    it('Stop: only a BUSY service is stopped; the count is how many were', () => {
        const svc = (busy) => ({ busy, stops: 0, stop() { this.stops += 1; this.busy = false; return true; } });
        const a = svc(false);
        const b = svc(true);
        expect(anySolving([a])).toBe(false);
        expect(anySolving([a, b])).toBe(true);
        expect(stopSolves([a, b])).toBe(1);
        expect([a.stops, b.stops]).toEqual([0, 1]);
        expect(anySolving([a, b])).toBe(false);
        expect(stopSolves([a, b, null, { get busy() { throw new Error('dead'); } }])).toBe(0);
    });
});

describe('⛓ SOLVER LIMIT OFF — the row', () => {
    it('the row: Stop is disabled until a solve is in flight and calls onStop; each control writes its own setting', () => {
        const doc = fakeDocument();
        const writes = [];
        let stops = 0;
        const row = buildSolverLimitRow(doc, { onWrite: (p, v) => writes.push([p, v]), onStop: () => { stops += 1; } });
        expect(row.stop.disabled).toBe(true);
        row.setSolving(true);
        expect(row.stop.disabled).toBe(false);
        row.stop.fire('click');
        expect(stops).toBe(1);
        row.setSolving(false);
        expect(row.stop.disabled).toBe(true);
        row.noLimit.checked = true;
        row.noLimit.fire('change');
        row.off.checked = true;
        row.off.fire('change');
        row.seconds.value = '600';
        row.seconds.fire('change');
        row.seconds.value = '0'; // refused: not a backstop (that is the checkbox's job)
        row.seconds.fire('change');
        expect(writes).toEqual([[SOLVER_LIMIT_PROPS.noWorkLimit, true], [SOLVER_LIMIT_PROPS.backstopOff, true],
            [SOLVER_LIMIT_PROPS.backstopSeconds, 600]]);
        // it follows the settings back, and says by name what is off
        row.sync({ noWorkLimit: true, backstopSeconds: 300, backstopOff: true });
        expect([row.noLimit.checked, row.off.checked, row.seconds.value, row.seconds.disabled]).toEqual([true, true, '300', true]);
        expect(row.status.textContent).toBe('⚠ no work limit, no backstop: only Stop ends a long solve');
        row.sync({ noWorkLimit: false, backstopSeconds: undefined, backstopOff: false });
        expect([row.noLimit.checked, row.off.checked, row.seconds.value, row.status.textContent]).toEqual([false, false, '300', '']);
        row.sync({ noWorkLimit: true, backstopSeconds: 120, backstopOff: false });
        expect([row.seconds.value, row.status.textContent]).toEqual(['120', '⚠ no work limit']);
    });
});
