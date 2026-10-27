/**
 * flashPanel/seedlingGameSpeedSettings — ⛓ GAME SPEED (slice `seedling-js-game-speed`, ⚖ the user 2026-10-24/26):
 * the JS runtime page's speed, `flashPanel.seedlingJsSpeed` = a number, 1 (the default, the game's own 30 ticks a
 * second) … → the page's `?speed=<n>`; absent at 1× (today's URL exactly).
 *
 * ⛔ PRESENTATION ONLY: the run is the same tick sequence at every speed, shown faster (`jsRuntimeClock.js`, pinned by
 * `jsRuntimeGameSpeed.test.js`), so — like the graphics switches — a change does NOT re-mount the page: the panel
 * applies it LIVE through the page's `__seedlingJsClock.set(...)` and puts it on the URL for the next mount. The
 * panel also scales its wall-clock item push (`WasmBridgeAdapter` `PUSH_INTERVAL_MS`) by the speed, so a delivery's
 * latency in game TICKS is the same at every speed. Runtime `js` only: the row is hidden on wasm / flash.
 *
 * ⛓ CUSTOM SPEED (slice `seedling-js-custom-speed`, ⚖ the user 2026-10-26): the setting is now a NUMBER, 0.25 … 16
 * in steps of 0.05 (default 1), entered in a number field with quick 1× / 2× / 4× buttons and an ACHIEVED-speed
 * readout beside it. A stored `1x` / `2x` / `4x` (the old three-way choice) reads as 1 / 2 / 4 and the panel writes
 * the number back once (`legacy`). A value outside the range or off the grid is REFUSED with its reason — the field
 * does not write it, and a stored one (the Settings JSON, an old export) plays 1× with the reason shown — never
 * clamped.
 *
 * The range is written here because this panel's closure stays model-free (`flashPanelUI.js`'s JS_RUNTIME_PAGE
 * note); `seedlingGameSpeedSettings.test.js` holds it equal to `jsRuntimeClock`'s and every verdict equal to
 * `jsRuntimeClock.checkGameSpeed`'s.
 */

export const SPEED_SETTING_PROP = 'seedlingJsSpeed';
export const SPEED_SETTING_KEY = `moduleSettings.flashPanel.${SPEED_SETTING_PROP}`;
/** `jsRuntimeClock.GAME_SPEEDS`: the quick buttons. */
export const SPEED_QUICK_CHOICES = Object.freeze([1, 2, 4]);
/** `jsRuntimeClock`'s `MIN_GAME_SPEED` / `MAX_GAME_SPEED` / `GAME_SPEED_STEP`. */
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 16;
export const SPEED_STEP = 0.05;
/** The old three-way choice's spellings, which a stored setting may still carry. */
export const LEGACY_SPEED_VALUES = Object.freeze({ '1x': 1, '2x': 2, '4x': 4 });

/** The schema prop. */
export function gameSpeedSchemaProps() {
    return {
        [SPEED_SETTING_PROP]: {
            type: 'number',
            minimum: SPEED_MIN,
            maximum: SPEED_MAX,
            multipleOf: SPEED_STEP,
            default: 1,
            label: 'Seedling JS: game speed (×)',
            description: `Runtime 'js' only. 1 plays at the game's own speed (30 frames a second, the default); any speed `
                + `from ${SPEED_MIN} to ${SPEED_MAX} in steps of ${SPEED_STEP} plays the same game that much slower or faster — `
                + 'fades included. Purely a matter of how fast it is shown: the game, the bot and the solver do exactly the same '
                + 'things, frame for frame. Above what the browser can keep up with, the panel shows the speed actually '
                + 'achieved. Takes effect at once, without restarting the game.',
        },
    };
}

/**
 * Read a setting value (a number, a stored `2x`, a speed already read): `{ ok: true, speed, legacy }` or
 * `{ ok: false, reason }` (`jsRuntimeClock.checkGameSpeed`'s verdict). Absent = 1. `legacy` = it was a string
 * (the old `1x` / `2x` / `4x`, or a typed `1.5`): the panel writes the number back.
 */
export function readGameSpeed(value) {
    if (value === undefined || value === null || value === '') return { ok: true, speed: 1, legacy: false };
    const legacy = typeof value === 'string';
    const v = legacy && Object.hasOwn(LEGACY_SPEED_VALUES, value) ? LEGACY_SPEED_VALUES[value] : value;
    const raw = typeof v === 'number' ? v : String(v).trim().replace(/\s*[x×]$/i, '');
    const n = typeof raw === 'number' ? raw : (raw === '' ? NaN : Number(raw));
    if (!Number.isFinite(n)) return { ok: false, reason: `${value} is not a number` };
    if (n < SPEED_MIN) return { ok: false, reason: `${n}× is below the minimum ${SPEED_MIN}×` };
    if (n > SPEED_MAX) return { ok: false, reason: `${n}× is above the maximum ${SPEED_MAX}×` };
    const k = Math.round(n / SPEED_STEP);
    if (Math.abs(n / SPEED_STEP - k) > 1e-6) return { ok: false, reason: `${n}× is not a multiple of ${SPEED_STEP}` };
    return { ok: true, speed: Number((k * SPEED_STEP).toFixed(2)), legacy };
}

/** The speed the page plays for a setting value: its speed, or 1 when it is refused (the panel shows the reason). */
export const gameSpeed = (value) => {
    const r = readGameSpeed(value);
    return r.ok ? r.speed : 1;
};

/** The page's query parameter: '' at 1× (today's URL exactly). */
export const gameSpeedPageParam = (value) => (gameSpeed(value) === 1 ? '' : `speed=${gameSpeed(value)}`);

/** A speed for a readout: `1.5×`, `16×`, `0.25×`. */
export const formatSpeed = (speed) => `${Number(speed.toFixed(2))}×`;

/**
 * The achieved-speed readout beside the field: `achieved 7.9×`, flagged `short` when the page delivers under 95 %
 * of the request (the browser cannot keep up). `achieved` = `__seedlingJsClock.achievedSpeed` (0 before a second ran:
 * no readout yet).
 */
export function achievedReadout(requested, achieved) {
    if (!Number.isFinite(achieved) || achieved <= 0) return { text: '', short: false };
    const short = achieved < requested * 0.95;
    return { text: `achieved ${formatSpeed(achieved)}${short ? ' — the browser cannot keep up' : ''}`, short };
}
