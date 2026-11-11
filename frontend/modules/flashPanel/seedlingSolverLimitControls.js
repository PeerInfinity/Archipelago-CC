/**
 * ⛓ SOLVER LIMIT OFF — the Flash panel's solver limit controls and its Stop button (the Solver section's top row).
 *
 * ⚖ The user, 2026-11-10: "It was specifically in the panel that I wanted the option to disable the timeout. And I
 * agree that if we do that, then we should add a manual stop button." — "Which limit should off turn off?" → "Both";
 * and "I don't currently see the solver limit control in the flash panel. I want to add it there."
 *
 * The row:
 *  - **Stop** — enabled only while a solve is in flight. It stops the solve through the shared worker service
 *    (`jsRuntimeSolveService` `stop`: the worker is TERMINATED and the handle settles `kind: 'stopped'`); both
 *    runtimes turn that answer into a goal that FAILS BY NAME ("the solve was stopped by the player …") and release
 *    the room, and the next solve builds a fresh worker. The JS page and the wasm engines use the same service.
 *  - **No work limit** — `flashPanel.seedlingSolverNoWorkLimit` (a checkbox: a NAMED choice, never "type 0", since the
 *    upgrade window beside it reads 0 as "the whole budget"). Ticked, both runtimes solve with the engine value 0:
 *    no budget, no upgrade window, no held retry.
 *  - **Backstop (s)** — `flashPanel.seedlingSolverBackstopSeconds` (default 300), and **off** —
 *    `flashPanel.seedlingSolverBackstopOff` (engine value 0 ms).
 * Each control writes the SAME setting the Settings panel writes and follows it back, so the two never disagree.
 *
 * ⛔ Import-free: the panel imports no solver (the constants below are the solver's, pinned by
 * `seedlingSolverLimitControls.test.js` against `jsRuntimeSolver.js`).
 */

/** The three settings (props under `moduleSettings.flashPanel.`). */
export const SOLVER_LIMIT_PROPS = Object.freeze({
    noWorkLimit: 'seedlingSolverNoWorkLimit',
    backstopSeconds: 'seedlingSolverBackstopSeconds',
    backstopOff: 'seedlingSolverBackstopOff',
});

/** The backstop's default, seconds (`jsRuntimeSolver.SOLVE_BACKSTOP_MS` / 1000 — pinned by the test). */
export const SOLVER_BACKSTOP_DEFAULT_SECONDS = 300;
/** The engine value of "no work limit" (`jsRuntimeSolver.SOLVER_BUDGET_NO_LIMIT`). */
export const ENGINE_NO_LIMIT = 0;
/** The engine value of "backstop off" (`jsRuntimeSolver.SOLVE_BACKSTOP_OFF`). */
export const ENGINE_BACKSTOP_OFF = 0;

/**
 * The backstop a surface hands the runtimes, in ms: 0 = off; null = the runtime's own (the setting at its default,
 * or a value that is not a positive number of seconds); else seconds × 1000.
 */
export function backstopMsOf({ seconds, off } = {}) {
    if (off === true) return ENGINE_BACKSTOP_OFF;
    if (seconds === null || seconds === undefined || seconds === '') return null;
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0 || n === SOLVER_BACKSTOP_DEFAULT_SECONDS) return null;
    return Math.round(n * 1000);
}

/**
 * The wasm engine's budget knob: 0 (no work limit) when ticked, else the numeric setting's cached value (null =
 * the engine's own). A stored pre-slice value (640, unset) keeps its meaning: un-ticked passes it through.
 */
export const wasmBudgetKnobOf = (noWorkLimit, budgetWork) => (noWorkLimit === true ? ENGINE_NO_LIMIT : (budgetWork ?? null));

/** Is any of these solve services solving (Stop is enabled only then)? */
export function anySolving(services) {
    for (const s of services ?? []) {
        try { if (s?.busy === true) return true; } catch { /* a dead service is not solving */ }
    }
    return false;
}

/** Stop every solve in flight among these services; returns how many were stopped. */
export function stopSolves(services) {
    let n = 0;
    for (const s of services ?? []) {
        try { if (s?.busy === true && s.stop?.() === true) n += 1; } catch { /* already gone */ }
    }
    return n;
}

const CONTROL_CSS = 'background:#333;color:#e0e0e0;border:1px solid #555;padding:2px 4px;border-radius:3px;';

/**
 * Build the row. `specs` = the schema specs by prop (tooltips); `onWrite(prop, value)` writes a setting; `onStop()`
 * presses Stop. Returns `{element, stop, noLimit, seconds, off, status, sync(values), setSolving(on)}`.
 */
export function buildSolverLimitRow(doc, { specs = new Map(), onWrite, onStop }) {
    const row = doc.createElement('div');
    row.className = 'flash-panel-solver-limits';
    row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-top:4px;font-size:12px;color:#aaa;min-width:0;';
    const tip = (prop) => { const s = specs.get(prop) ?? {}; return [s.label, s.description].filter(Boolean).join(' — '); };

    const stop = doc.createElement('button');
    stop.type = 'button';
    stop.className = 'flash-panel-solver-stop';
    stop.textContent = 'Stop solve';
    stop.title = 'Stop the solve in progress: its worker is terminated and the walk fails, saying so';
    stop.disabled = true;
    stop.style.cssText = 'background:#e94560;color:#fff;border:none;padding:3px 10px;border-radius:3px;cursor:pointer;';
    stop.addEventListener('click', () => onStop?.());

    const check = (cls, text, prop) => {
        const label = doc.createElement('label');
        label.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
        label.title = tip(prop);
        const input = doc.createElement('input');
        input.type = 'checkbox';
        input.className = cls;
        input.addEventListener('change', () => onWrite?.(prop, input.checked));
        const span = doc.createElement('span');
        span.textContent = text;
        label.append(input, span);
        return { label, input };
    };
    const noLimit = check('flash-panel-solver-no-limit', 'No work limit', SOLVER_LIMIT_PROPS.noWorkLimit);

    const secLabel = doc.createElement('label');
    secLabel.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
    secLabel.title = tip(SOLVER_LIMIT_PROPS.backstopSeconds);
    const secName = doc.createElement('span');
    secName.textContent = 'Backstop';
    const seconds = doc.createElement('input');
    seconds.type = 'number';
    seconds.min = '1';
    seconds.step = '1';
    seconds.className = 'flash-panel-solver-backstop-seconds';
    seconds.style.cssText = `${CONTROL_CSS}width:5em;`;
    seconds.setAttribute('aria-label', 'Solver backstop (seconds)');
    seconds.addEventListener('change', () => {
        const n = Number(seconds.value);
        if (seconds.value !== '' && Number.isFinite(n) && n >= 1) onWrite?.(SOLVER_LIMIT_PROPS.backstopSeconds, n);
    });
    const secUnit = doc.createElement('span');
    secUnit.textContent = 's';
    secLabel.append(secName, seconds, secUnit);
    const off = check('flash-panel-solver-backstop-off', 'Backstop off', SOLVER_LIMIT_PROPS.backstopOff);

    const status = doc.createElement('span');
    status.className = 'flash-panel-solver-limit-status';
    status.style.cssText = 'color:#e9c95a;';

    row.append(stop, noLimit.label, secLabel, off.label, status);

    return {
        element: row, stop, noLimit: noLimit.input, seconds, off: off.input, status,
        /** Show the settings' values now: `{noWorkLimit, backstopSeconds, backstopOff}`. */
        sync({ noWorkLimit, backstopSeconds, backstopOff } = {}) {
            noLimit.input.checked = noWorkLimit === true;
            off.input.checked = backstopOff === true;
            const v = backstopSeconds === null || backstopSeconds === undefined ? String(SOLVER_BACKSTOP_DEFAULT_SECONDS) : String(backstopSeconds);
            if (doc.activeElement !== seconds && seconds.value !== v) seconds.value = v;
            seconds.disabled = backstopOff === true;
            const said = [noWorkLimit === true ? 'no work limit' : null, backstopOff === true ? 'no backstop' : null].filter(Boolean);
            status.textContent = said.length === 2 ? `⚠ ${said.join(', ')}: only Stop ends a long solve`
                : said.length ? `⚠ ${said[0]}` : '';
        },
        /** Stop is enabled only while a solve is in flight. */
        setSolving(on) { if (stop.disabled === Boolean(on)) stop.disabled = !on; },
    };
}
