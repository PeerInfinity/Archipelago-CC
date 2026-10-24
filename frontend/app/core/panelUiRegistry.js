/**
 * panelUiRegistry.js — every Golden Layout container's panel UI instance, for code that holds a layout item
 * and needs the panel object (the mini row: modules/miniPanels). Golden Layout calls the panel factory as a
 * plain function and keeps nothing; panelManager's `panelMap` holds only panels that implement `onMount`.
 * panelManager's WrapperComponent records every panel here. A WeakMap, so a destroyed container drops out.
 *
 * Imports nothing, so a unit test can load a module that reads it without the app.
 */
const uiByContainer = new WeakMap();

export function recordPanelUi(container, uiInstance) {
    if (container && uiInstance) uiByContainer.set(container, uiInstance);
}

/** The panel UI instance of a Golden Layout container, or null. */
export function getPanelUi(container) {
    return (container && uiByContainer.get(container)) ?? null;
}
