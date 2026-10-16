/**
 * flashPanel/seedlingDashOnlyWindowSettings — ⛓ DASH-ONLY WINDOW (slice `seedling-js-dash-window`, ⚖ the user
 * 2026-10-16; the AXE_DODGE hook's settings, `seedlingAxeDodgeSettings.js`). The JS arc's solver switch
 * `seedlingDemo/dashOnlyWindowHook.DASH_ONLY_WINDOW` as the flashPanel setting `seedlingDashOnlyWindow`:
 * `default` | `on` | `off`.
 *
 * Three values, not a boolean, as for axe dodge: `default` is the switch's own value where the solver runs (OFF in
 * the browser), so no default is restated here; `on` / `off` force it.
 *
 * Where the value goes: the JS runtime page (`?dashOnlyWindow=on|off`, see `jsRuntimePage.js`), the wasm engine
 * (the surface's `wasm.dashOnlyWindow`, applied to the engine's own module instance at each solve) and every solve
 * worker (the request's `dashOnlyWindow` stamp, off-default only).
 */

export const DASH_ONLY_WINDOW_SETTING_PROP = 'seedlingDashOnlyWindow';
export const DASH_ONLY_WINDOW_SETTING_KEY = `moduleSettings.flashPanel.${DASH_ONLY_WINDOW_SETTING_PROP}`;
export const DASH_ONLY_WINDOW_SETTING_VALUES = Object.freeze(['default', 'on', 'off']);

/** The schema prop. */
export function dashOnlyWindowSchemaProps() {
    return {
        [DASH_ONLY_WINDOW_SETTING_PROP]: {
            type: 'string',
            enum: [...DASH_ONLY_WINDOW_SETTING_VALUES],
            default: 'default',
            label: 'Seedling solver: the upgrade window counts only sword-dash asks',
            description: 'The solver switch `DASH_ONLY_WINDOW` (seedlingDemo/dashOnlyWindowHook.js has what it changes). '
                + 'Off: once a plan is in hand, the upgrade window stops the WHOLE full pass. On: the window counts only '
                + 'the sword-dash search\'s asks and stops only that search; the rest of the full pass runs on the whole '
                + 'budget. `default` is the switch\'s own value (off). Both runtimes, the Playback Bot\'s solver. A value '
                + 'other than the default is stamped on every solve request and plan, so a plan made with it is labelled; '
                + 'changing it re-mounts the JS runtime page. Leave `default` unless you are measuring the solver.',
        },
    };
}

/** A setting value as the hook reads it: `on` / `off`, or null (= the switch's own default; anything else too). */
export const dashOnlyWindowOverride = (value) => (value === 'on' || value === 'off' ? value : null);

/** The `dashOnlyWindow=` query parameter for the JS runtime page: '' at `default` (today's URL exactly). */
export function dashOnlyWindowPageParam(value) {
    const v = dashOnlyWindowOverride(value);
    return v ? `dashOnlyWindow=${v}` : '';
}
