/**
 * flashPanel/seedlingGraphicsSettings — ⛓ GRAPHICS G1 (slice `seedling-js-graphics-g01`, ⚖ the user 2026-10-16):
 * the JS runtime page's two COSMETIC settings, both default = today's page exactly.
 *
 *   · `seedlingJsGraphics` — `rects` (the rectangle view, the default) or a content-pack STACK named in
 *     `frontend/packs/packs.json`'s `graphics` (`seedling` = the original Seedling sheets + the Archipelago
 *     pickup). → the page's `?graphics=<stack>`.
 *   · `seedlingJsCamera` — `room` (the whole room, the default) or `follow` (the original 160×160 view
 *     following the player). → the page's `?camera=follow`.
 *   · ⛓ G5 `seedlingJsLights` — `on` (the default: with a graphics stack, the room is darkened and lit as the
 *     game's night layer does) or `off` (the pre-G5 paint, op for op). Without a stack it does nothing.
 *     → the page's `?lights=off`.
 *   · ⛓ G6 `seedlingJsEffects` — `on` (the default: with a stack, the rain and the lava glow are drawn) or `off`
 *     (a stack without those two families, op for op). Without a stack it does nothing. → the page's `?effects=off`.
 *
 * ⛔ Cosmetic only: neither reaches the model, a solve request or a plan (the renderer only reads the run), so —
 * unlike the KILLLOCK / CONTACT / AXE_DODGE hooks — a change does NOT re-mount the page. The panel applies it LIVE
 * through the page's `__seedlingJsGraphics.set(...)` and puts it on the URL for the next mount.
 *
 * The value lists are written here because this panel's closure stays model-free (`flashPanelUI.js`'s
 * JS_RUNTIME_PAGE note); `seedlingGraphicsSettings.test.js` holds them equal to the registry's stacks and the
 * renderer's `CAMERA_MODES`.
 */

export const GRAPHICS_SETTING_PROP = 'seedlingJsGraphics';
export const CAMERA_SETTING_PROP = 'seedlingJsCamera';
export const GRAPHICS_SETTING_KEY = `moduleSettings.flashPanel.${GRAPHICS_SETTING_PROP}`;
export const CAMERA_SETTING_KEY = `moduleSettings.flashPanel.${CAMERA_SETTING_PROP}`;
export const LIGHTS_SETTING_PROP = 'seedlingJsLights';
export const LIGHTS_SETTING_KEY = `moduleSettings.flashPanel.${LIGHTS_SETTING_PROP}`;
export const EFFECTS_SETTING_PROP = 'seedlingJsEffects';
export const EFFECTS_SETTING_KEY = `moduleSettings.flashPanel.${EFFECTS_SETTING_PROP}`;
/** ⛓ G6 — the page's `?effects=` values. */
export const EFFECTS_SETTING_VALUES = Object.freeze(['on', 'off']);
/** ⛓ G5 — the page's `?lights=` values. */
export const LIGHTS_SETTING_VALUES = Object.freeze(['on', 'off']);
/** `rects` + every stack in `frontend/packs/packs.json`'s `graphics`. */
export const GRAPHICS_SETTING_VALUES = Object.freeze(['rects', 'seedling']);
/** `seedlingSkinRenderer.CAMERA_MODES`. */
export const CAMERA_SETTING_VALUES = Object.freeze(['room', 'follow']);

/** The schema props. */
export function graphicsSchemaProps() {
    return {
        [GRAPHICS_SETTING_PROP]: {
            type: 'string',
            enum: [...GRAPHICS_SETTING_VALUES],
            default: 'rects',
            label: 'Seedling JS: graphics',
            description: "Runtime 'js' only. `rects` draws the room as coloured rectangles (the default). `seedling` "
                + 'draws the tiles, cliffs, buildings, trees, rocks, poles and other scenery with the original Seedling '
                + 'graphics and the AP item with the Archipelago logo; anything it has no picture for yet (the player, '
                + 'enemies, chests, blocks, locks…) is still a rectangle. Purely visual — it never changes what the game '
                + 'or the bot does. Takes effect at once, without restarting the game.',
        },
        [CAMERA_SETTING_PROP]: {
            type: 'string',
            enum: [...CAMERA_SETTING_VALUES],
            default: 'room',
            label: 'Seedling JS: camera',
            description: "Runtime 'js' only. `room` shows the whole room (the default). `follow` shows the original "
                + "game's 160×160 view, following the player as the game's own camera does. Purely visual; takes "
                + 'effect at once.',
        },
        [LIGHTS_SETTING_PROP]: {
            type: 'string',
            enum: [...LIGHTS_SETTING_VALUES],
            default: 'on',
            label: 'Seedling JS: lights',
            description: "Runtime 'js', with a graphics stack only. `on` (the default) darkens the room and draws its "
                + "lights, glows and shadows the way the original game's night layer does. `off` skips that layer, "
                + 'which is the most expensive picture to draw. Purely visual; takes effect at once.',
        },
        [EFFECTS_SETTING_PROP]: {
            type: 'string',
            enum: [...EFFECTS_SETTING_VALUES],
            default: 'on',
            label: 'Seedling JS: effects',
            description: "Runtime 'js', with a graphics stack only. `on` (the default) draws the rain and, with the lights "
                + "on, the lava's glow. `off` leaves those two out (the lava glow is the costliest part of the lights). "
                + 'Dialogue text is always drawn. Purely visual; takes effect at once.',
        },
    };
}

/** A setting value as the page reads it: a known stack, or null (= rectangles; anything unknown too). */
export const graphicsStack = (value) => (GRAPHICS_SETTING_VALUES.includes(value) && value !== 'rects' ? value : null);
/** A camera value as the page reads it: `follow`, or `room` for anything else. */
export const cameraMode = (value) => (value === 'follow' ? 'follow' : 'room');

/** A lights value as the page reads it: `off`, or `on` for anything else. */
export const lightsMode = (value) => (value === 'off' ? 'off' : 'on');

/** An effects value as the page reads it: `off`, or `on` for anything else. */
export const effectsMode = (value) => (value === 'off' ? 'off' : 'on');

/** The page's query parameters: '' at the defaults (today's URL exactly). */
export function graphicsPageParams(graphics, camera, lights, effects) {
    const stack = graphicsStack(graphics);
    return [stack ? `graphics=${stack}` : '', cameraMode(camera) !== 'room' ? `camera=${cameraMode(camera)}` : '',
        lightsMode(lights) === 'off' ? 'lights=off' : '', effectsMode(effects) === 'off' ? 'effects=off' : '']
        .filter(Boolean).join('&');
}
