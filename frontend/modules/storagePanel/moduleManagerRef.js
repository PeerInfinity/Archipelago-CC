/**
 * The module manager handle, shared by index.js (which sets it in `initialize`)
 * and the UI / quota notice (which read it). It lives here so the UI never
 * imports index.js (the UI → index.js cycle C6 guards against). Imports nothing.
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
