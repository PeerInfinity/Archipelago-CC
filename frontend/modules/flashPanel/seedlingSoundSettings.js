/**
 * flashPanel/seedlingSoundSettings — ⛓ SOUND EFFECTS (slice `seedling-js-sound-effects`, ⚖ the user 2026-10-26:
 * "Sound effects are the first priority … And yes, it should work on mobile"): the JS runtime page's sound.
 *
 *   · `flashPanel.seedlingJsSound`  = `on` (the default) | `off`        → the page's `?sound=off`
 *   · `flashPanel.seedlingJsVolume` = 0 … 100 in tens, default 100      → the page's `?volume=<n>` (none at 100)
 *   · `flashPanel.seedlingJsStart`  = `tests-auto` (the default) | `click` | `auto` → the page's `?start=click`
 *
 * ▶ START. The JS page waits for its ▶ Start (`#btn-start`, the wasm page's id) before it boots, as the wasm page
 * does: the tap is the gesture that unlocks audio (a browser — iOS above all — lets only a gesture start it).
 * AUTOMATED RUNS BYPASS IT: under `tests-auto` an app page loaded in a test mode (`?mode=test…`, every Playwright
 * run) mounts the page WITHOUT `start=click`, so the in-app rows boot it as they always have (and the standalone
 * rows that open `jsRuntime.html` on their own never carry it); the wasm rows press the
 * wasm button themselves, and the JS rows (dozens, in append-only shared files) are not edited. A person never sees
 * `auto` unless they choose it; a test that wants the button sets `click` (a session override).
 *
 * ⛔ PRESENTATION ONLY: sound follows the run and never feeds it, so — like the graphics and the speed — a change is
 * applied LIVE (the page's `__seedlingJsSound.set(...)`), never by a re-mount; the start mode is read at mount.
 * Runtime `js` only: the rows are hidden on wasm / flash.
 */

export const SOUND_SETTING_PROP = 'seedlingJsSound';
export const SOUND_SETTING_KEY = `moduleSettings.flashPanel.${SOUND_SETTING_PROP}`;
export const VOLUME_SETTING_PROP = 'seedlingJsVolume';
export const VOLUME_SETTING_KEY = `moduleSettings.flashPanel.${VOLUME_SETTING_PROP}`;
export const START_SETTING_PROP = 'seedlingJsStart';
export const START_SETTING_KEY = `moduleSettings.flashPanel.${START_SETTING_PROP}`;

export const SOUND_SETTING_VALUES = Object.freeze(['on', 'off']);
export const VOLUME_SETTING_VALUES = Object.freeze([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
export const START_SETTING_VALUES = Object.freeze(['tests-auto', 'click', 'auto']);

/** The schema props. */
export function soundSchemaProps() {
    return {
        [SOUND_SETTING_PROP]: {
            type: 'string',
            enum: [...SOUND_SETTING_VALUES],
            default: 'on',
            label: 'Seedling JS: sound effects',
            description: "Runtime 'js' only. The original game's sound effects (by Rekcahdam), played when the game "
                + 'plays them. They start after the ▶ Start tap (a browser lets only a tap or click start sound). Sound '
                + 'never changes the game: the bot and the solver do exactly the same things with it on or off. Takes '
                + 'effect at once.',
        },
        [VOLUME_SETTING_PROP]: {
            type: 'number',
            enum: [...VOLUME_SETTING_VALUES],
            default: 100,
            label: 'Seedling JS: sound volume (%)',
            description: "Runtime 'js' only. The sound effects' volume, 0–100. Takes effect at once.",
        },
        [START_SETTING_PROP]: {
            type: 'string',
            enum: [...START_SETTING_VALUES],
            default: 'tests-auto',
            label: 'Seedling JS: ▶ Start',
            description: "Runtime 'js' only. `tests-auto` (the default): the game waits for its ▶ Start tap, which "
                + 'turns the sound on, except in an automated test run, which starts it at once. `click`: always wait '
                + 'for the tap. `auto`: start at once (the sound then waits for your first tap in the game). Read when '
                + 'the game page is loaded.',
        },
    };
}

/** `on` unless the value is `off`. */
export const soundMode = (value) => (value === 'off' ? 'off' : 'on');

/** A volume setting (0–100), clamped; anything unreadable = 100. */
export const soundVolume = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 100;
};

/** Is the app page an automated test run? Its `?mode=` starts with `test` (`test`, `test-substrates`, …). */
export const isAutomatedRun = (search) => (new URLSearchParams(search ?? '').get('mode') ?? '').startsWith('test');

/** The start mode the page gets: `click` | `auto`. */
export function startMode(value, appSearch) {
    if (value === 'click' || value === 'auto') return value;
    return isAutomatedRun(appSearch) ? 'auto' : 'click';
}

/** The page's query parameters: '' for on, 100 and `auto`; `start=click` makes the page wait for ▶ Start. */
export function soundPageParams(sound, volume, start) {
    return [
        soundMode(sound) === 'off' ? 'sound=off' : '',
        soundVolume(volume) === 100 ? '' : `volume=${soundVolume(volume)}`,
        start === 'click' ? 'start=click' : '',
    ].filter(Boolean).join('&');
}
