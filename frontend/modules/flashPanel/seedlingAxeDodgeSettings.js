/**
 * flashPanel/seedlingAxeDodgeSettings — ⛓ AXE_DODGE HOOK (slice `seedling-js-axe-dodge`, ⚖ the user 2026-10-11; the
 * CONTACT hook's pattern, `seedlingContactSettings.js`). Fidelity's SOLVECOST switch `solverBot.AXE_DODGE_ASK_PER_PREVIEW`
 * as the flashPanel setting `seedlingAxeDodgeAskPerPreview`: `default` | `on` | `off`.
 *
 * ⛔ Why three values and not a boolean: the switch lives in `solverBot.js`, and this panel's static closure stays
 * model-free (`flashPanelUI.js`'s JS_RUNTIME_PAGE note), so the schema cannot READ the switch's default — and a
 * boolean default typed here would be a restatement that can drift from it. `default` is the model's own value,
 * read where the model is loaded (`seedlingDemo/axeDodgeAskHook.js`); `on` / `off` force it.
 *
 * Where the value goes: the JS runtime page (`?axeDodgeAskPerPreview=on|off`, see `jsRuntimePage.js`), the wasm
 * engine (the surface's `wasm.axeDodgeAskPerPreview`, applied to the engine's own module instance at each solve)
 * and every solve worker (the request's `axeDodgeAskPerPreview` stamp, off-default only).
 */

export const AXE_DODGE_SETTING_PROP = 'seedlingAxeDodgeAskPerPreview';
export const AXE_DODGE_SETTING_KEY = `moduleSettings.flashPanel.${AXE_DODGE_SETTING_PROP}`;
export const AXE_DODGE_SETTING_VALUES = Object.freeze(['default', 'on', 'off']);

/** The schema prop. */
export function axeDodgeSchemaProps() {
    return {
        [AXE_DODGE_SETTING_PROP]: {
            type: 'string',
            enum: [...AXE_DODGE_SETTING_VALUES],
            default: 'default',
            label: 'Seedling model: axe-dodge deadline asked per preview',
            description: 'The solver switch `AXE_DODGE_ASK_PER_PREVIEW` (seedlingDemo/solverBot.js has what it changes '
                + 'and the SOLVECOST report that measured it): where the axe dodge asks its work-budget deadline, once per '
                + 'preview (on) or once per stall length (off). `default` is the model\'s own value. Both runtimes, the '
                + 'Playback Bot\'s solver. A value other than the model\'s default is stamped on every solve request and '
                + 'plan, so a plan made with it is labelled; changing it re-mounts the JS runtime page. Leave `default` '
                + 'unless you are measuring the model.',
        },
    };
}

/** A setting value as the hook reads it: `on` / `off`, or null (= the model's own default; anything else too). */
export const axeDodgeOverride = (value) => (value === 'on' || value === 'off' ? value : null);

/** The `axeDodgeAskPerPreview=` query parameter for the JS runtime page: '' at `default` (today's URL exactly). */
export function axeDodgePageParam(value) {
    const v = axeDodgeOverride(value);
    return v ? `axeDodgeAskPerPreview=${v}` : '';
}
