/**
 * flashPanel/seedlingGameSpeedSettings — ⛓ GAME SPEED (slice `seedling-js-game-speed`, ⚖ the user 2026-10-24/26):
 * the JS runtime page's speed, `flashPanel.seedlingJsSpeed` = `1x` (the default, the game's own 30 ticks a second)
 * | `2x` | `4x`. → the page's `?speed=2|4`; absent at 1× (today's URL exactly).
 *
 * ⛔ PRESENTATION ONLY: the run is the same tick sequence at every speed, shown faster (`jsRuntimeClock.js`, pinned by
 * `jsRuntimeGameSpeed.test.js`), so — like the graphics switches — a change does NOT re-mount the page: the panel
 * applies it LIVE through the page's `__seedlingJsClock.set(...)` and puts it on the URL for the next mount. The
 * panel also scales its wall-clock item push (`WasmBridgeAdapter` `PUSH_INTERVAL_MS`) by the speed, so a delivery's
 * latency in game TICKS is the same at every speed. Runtime `js` only: the row is hidden on wasm / flash.
 *
 * The values are written here because this panel's closure stays model-free (`flashPanelUI.js`'s JS_RUNTIME_PAGE
 * note); `seedlingGameSpeedSettings.test.js` holds them equal to `jsRuntimeClock.GAME_SPEEDS`.
 */

export const SPEED_SETTING_PROP = 'seedlingJsSpeed';
export const SPEED_SETTING_KEY = `moduleSettings.flashPanel.${SPEED_SETTING_PROP}`;
/** `jsRuntimeClock.GAME_SPEEDS`, as the setting spells them. */
export const SPEED_SETTING_VALUES = Object.freeze(['1x', '2x', '4x']);

/** The schema prop. */
export function gameSpeedSchemaProps() {
    return {
        [SPEED_SETTING_PROP]: {
            type: 'string',
            enum: [...SPEED_SETTING_VALUES],
            default: '1x',
            label: 'Seedling JS: game speed',
            description: "Runtime 'js' only. `1x` plays at the game's own speed (30 frames a second, the default); `2x` "
                + 'and `4x` play the same game two or four times faster — fades included. Purely a matter of how fast it '
                + 'is shown: the game, the bot and the solver do exactly the same things, frame for frame. Takes effect '
                + 'at once, without restarting the game.',
        },
    };
}

/** A setting value (`2x`) or a speed already read (2) as the page reads it: 1 | 2 | 4 (anything unknown = 1). */
export const gameSpeed = (value) => {
    const i = SPEED_SETTING_VALUES.indexOf(typeof value === 'number' ? `${value}x` : String(value));
    return i < 0 ? 1 : [1, 2, 4][i];
};

/** The page's query parameter: '' at 1× (today's URL exactly). */
export const gameSpeedPageParam = (value) => (gameSpeed(value) === 1 ? '' : `speed=${gameSpeed(value)}`);
