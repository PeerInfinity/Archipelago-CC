/**
 * watchTouchOption — the lab page's "on-screen controls" option for MANUAL (slice `seedling-lab-touch-visible`).
 *
 * ⚠ ITS OWN MODULE, NOT `watchManual.js`: this one imports the flash panel's `touchControls.js` (and through it the
 * `shared` submodule), and `watchManual.js` is imported by the Node producers, whose CI job checks out no submodule.
 * Only the page (`watchViewer.js`) and its test import this.
 */

import { TOUCH_SETTING_VALUES } from '../flashPanel/touchControls.js';
import { resolveTouchOverride } from '../shared/touchInput.js';

/**
 * ⛓⛓ THE LAB'S "ON-SCREEN CONTROLS" OPTION (slice `seedling-lab-touch-visible`) — the flash panel's setting, with the
 * panel's values (`TOUCH_SETTING_VALUES`: auto / on / off) and the panel's default (`auto`), remembered per browser.
 *
 * ⛔ NO SECOND VISIBILITY RULE. These only pick WHICH setting to hand `touchControlsVisible`; the rule itself (on/off
 * decide, auto = `?touch=` then a coarse pointer) is the panel's and is called as is.
 *
 * ⚠ The storage is a per-viewer convenience: every read and write is wrapped, and a page whose storage throws (a
 * private window, blocked site data) gets `auto` and simply does not remember.
 */
export const LAB_TOUCH_STORAGE_KEY = 'seedlingLab.touchControls';
export const LAB_TOUCH_DEFAULT = 'auto';

/** The remembered choice, or `auto` when there is none, it is not one of the panel's values, or storage throws. */
export function readLabTouchSetting(storage) {
    try {
        const v = storage?.getItem(LAB_TOUCH_STORAGE_KEY);
        return TOUCH_SETTING_VALUES.includes(v) ? v : LAB_TOUCH_DEFAULT;
    } catch {
        return LAB_TOUCH_DEFAULT;
    }
}

/** Remember a choice. False (and nothing written) for a value the panel does not have, or when storage throws. */
export function writeLabTouchSetting(storage, value) {
    if (!TOUCH_SETTING_VALUES.includes(value)) return false;
    try {
        storage.setItem(LAB_TOUCH_STORAGE_KEY, value);
        return true;
    } catch {
        return false;
    }
}

/**
 * The setting this page load starts from. A link carrying `?touch=` starts at `auto`, which is where the panel's
 * rule reads `?touch=` — so `?touch=1` / `?touch=0` still decide, whatever was remembered. Otherwise the remembered
 * choice. (Choosing on/off on the page afterwards decides from then on, as it does in the panel.)
 */
export function initialLabTouchSetting({ storage, search }) {
    return resolveTouchOverride(search) === null ? readLabTouchSetting(storage) : LAB_TOUCH_DEFAULT;
}
