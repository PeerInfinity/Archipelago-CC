/**
 * The module manager handle, shared by index.js (which sets it in `initialize`)
 * and quickLaunchUI.js (which reads it when activating a panel or drawing the
 * catalog). It lives here, not in index.js, so the UI never imports index.js:
 * index.js imports the UI and reads its `MODULE_ID` at evaluation, and a UI →
 * index.js import made that a cycle which threw a TDZ ReferenceError whenever
 * the UI was imported first (test discovery in a mode with quickLaunch disabled).
 * This file imports nothing, so neither side's evaluation depends on it.
 */

let initializationApi = null;

/** Called by index.js `initialize` with the initialization api. */
export function setInitializationApi(api) {
    initializationApi = api;
}

/** The module manager, once `initialize` has run (null before). */
export function getModuleManager() {
    return initializationApi?.getModuleManager?.() ?? null;
}
