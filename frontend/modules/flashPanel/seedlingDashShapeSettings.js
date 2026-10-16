/**
 * flashPanel/seedlingDashShapeSettings — ⛓ DASH-SHAPE STAMP (slice `seedling-js-dash-shape-stamp`, ⚖ the user
 * 2026-10-16: *"Prepare the flip"*; the DASH-ONLY WINDOW settings' pattern, `seedlingDashOnlyWindowSettings.js`).
 * Hammer's three SEEDLING DB solver switches (`solverBot.DASH_LEG_PRECHECK` / `DASH_NO_SWING_PREFIX` /
 * `DASH_KEEP_PARTIAL`) as three flashPanel settings, each `default` | `on` | `off`.
 *
 * Three settings, not one grouped one: the switches are independent (each has its own env var and scope, and a flip
 * may take them one at a time), and an enum per switch is what the settings UI renders as a choice. The STAMP and the
 * page's query are grouped (`dashShape`, one field / one `?dashShape=` spec), because the solve takes them together.
 * `default` is the switch's own value where the solver runs (OFF in the browser), so no default is restated here
 * (this panel's static closure stays model-free: `seedlingDemo/dashShapeHook.js` reads the switches).
 *
 * Where the value goes: the JS runtime page (`?dashShape=<key>:on|off,…`, see `jsRuntimePage.js`), the wasm engine
 * (the surface's `wasm.dashShape`, applied to the engine's own module instance at each solve) and every solve worker
 * (the request's `dashShape` stamp, off-default keys only).
 */

/** Each stamp key (`dashShapeHook.DASH_SHAPE_KEYS`, the same order; a unit row holds them equal) → its setting prop. */
export const DASH_SHAPE_SETTING_PROPS = Object.freeze({
    legPrecheck: 'seedlingDashLegPrecheck',
    noSwingPrefix: 'seedlingDashNoSwingPrefix',
    keepPartial: 'seedlingDashKeepPartial',
});
export const DASH_SHAPE_SETTING_KEYS = Object.freeze(Object.fromEntries(Object.entries(DASH_SHAPE_SETTING_PROPS)
    .map(([k, prop]) => [k, `moduleSettings.flashPanel.${prop}`])));
export const DASH_SHAPE_SETTING_VALUES = Object.freeze(['default', 'on', 'off']);

const LABELS = {
    legPrecheck: ['the dash search skips a corridor whose undashed leg is too long', 'DASH_LEG_PRECHECK',
        'On: the sword-dash search refuses a corridor whose UNDASHED walk has a leg past the preview bound plus its '
        + 'margin, before it previews any candidate.'],
    noSwingPrefix: ['the dash search drops the swing-only prefix', 'DASH_NO_SWING_PREFIX',
        'On: the sword-dash search no longer tries the swing-only prefix of the dash chain.'],
    keepPartial: ['a dash-search deadline keeps the windows already accepted', 'DASH_KEEP_PARTIAL',
        'On: when the sword-dash search hits its deadline it keeps the dash windows it had already accepted, instead '
        + 'of dropping the whole schedule.'],
};

/** The schema props (three). */
export function dashShapeSchemaProps() {
    return Object.fromEntries(Object.entries(DASH_SHAPE_SETTING_PROPS).map(([k, prop]) => {
        const [label, name, what] = LABELS[k];
        return [prop, {
            type: 'string',
            enum: [...DASH_SHAPE_SETTING_VALUES],
            default: 'default',
            label: `Seedling solver: ${label}`,
            description: `The solver switch \`${name}\` (seedlingDemo/solverBot.js has what it changes). ${what} `
                + '`default` is the switch\'s own value (off). Both runtimes, the Playback Bot\'s solver. A value other '
                + 'than the default is stamped on every solve request and plan (`dashShape`), so a plan made with it is '
                + 'labelled; changing it re-mounts the JS runtime page. Leave `default` unless you are measuring the solver.',
        }];
    }));
}

/** A setting value as the hook reads it: `on` / `off`, or null (= the switch's own default; anything else too). */
export const dashShapeOverride = (value) => (value === 'on' || value === 'off' ? value : null);

/** The three settings' values → `{key: 'on'|'off'|'default'}` (every key present; unknown values → `default`). */
export const dashShapeSettingValues = (values = {}) => Object.fromEntries(Object.keys(DASH_SHAPE_SETTING_PROPS)
    .map((k) => [k, dashShapeOverride(values?.[k]) ?? 'default']));

/** The settings' values → the page's spec (`key:on|off`, comma-joined, the forced keys only; '' when none). */
export const dashShapeSpec = (values = {}) => Object.entries(dashShapeSettingValues(values))
    .filter(([, v]) => v !== 'default').map(([k, v]) => `${k}:${v}`).join(',');

/** The `dashShape=` query parameter for the JS runtime page: '' when every setting is `default` (today's URL exactly). */
export function dashShapePageParam(values) {
    const spec = dashShapeSpec(values);
    return spec ? `dashShape=${encodeURIComponent(spec)}` : '';
}
