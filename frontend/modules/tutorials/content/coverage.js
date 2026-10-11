/**
 * coverage.js — which frontend features the tutorials do NOT cover, and why.
 *
 * ⚖ The user, 2026-10-10: every frontend feature appears in at least one
 * tutorial, and there is a list of the panels deliberately given none. The
 * unit is the PANEL (its componentType; design check A1), plus a hand-kept
 * list of features that are not panels.
 *
 * `tutorials.test.js` holds every registered panel (every module config's
 * modules) to exactly ONE of:
 *   - covered: some tutorial's actions name it, or its `covers` lists it;
 *   - NO_TUTORIAL: deliberately none, with the reason (shown in the docs);
 *   - NOT_COVERED_YET: a tutorial is planned; it may only SHRINK — a panel a
 *     tutorial now covers must leave this list.
 *
 * ⛔ Imports nothing (the guide generator reads it in node).
 */

/** Panels deliberately given no tutorial: componentType → { title (its tab), why } (⚖ the user, 2026-10-10). */
export const NO_TUTORIAL = Object.freeze({
    jtaActionQueue: { title: 'JtA Action Queue', why: 'Part of the non-procgen Journey to Ascension, which is deprecated.' },
    jtaGameDataPanel: { title: 'JtA Game Data', why: 'Part of the non-procgen Journey to Ascension, which is deprecated.' },
    jtaCostDebuggerPanel: { title: 'JtA Cost Debugger', why: 'Deprecated.' },
    ruleConverterPanel: { title: 'Rule Converter', why: 'Deprecated.' },
    tileMapAnalyzer: { title: 'Tile Map Analyzer', why: 'Currently a failed experiment.' },
    metaGamePanel: { title: 'Meta Game', why: 'Deprecated (an early draft of the procgen idea).' },
    progressBarPanel: { title: 'Progress Bars', why: 'Deprecated, with the Meta Game panel.' },
});

/**
 * Panels a DRAFT names that are not built yet: componentType → the feature
 * that will build it. A draft written for an unfinished feature (⚖ the user,
 * 2026-10-10: write every tutorial now, record where it stops) may target
 * one; the census refuses the entry once the panel is registered.
 */
export const PLANNED_PANELS = Object.freeze({
    swfRecompilerPanel: 'F2 — the in-browser SWF recompiler (SWFRecomp-CC), not built yet',
});

/** Panels a tutorial is planned for, not written yet: componentType → the planned tutorial. */
export const NOT_COVERED_YET = Object.freeze({
});

/**
 * Features that are not a panel. `tutorial`: the id of a tutorial that covers
 * it, or null with `planned` naming the planned one.
 */
export const FEATURES = Object.freeze([
    { id: 'tutorial-links', title: 'Opening a tutorial from a ?tutorial= link', tutorial: 'guided-tour' },
    { id: 'layouts', title: 'Moving, splitting and closing panels; saving the layout with the mode', tutorial: 'start-workbench' },
    { id: 'modes', title: 'App modes (?mode=…)', tutorial: 'metamath-demo' },
    { id: 'loop-mode', title: 'Loop mode', tutorial: 'procgen-loop-mode-jta' },
    { id: 'lab-pages', title: 'The procgen lab pages (demos.html, the Seedling lab)', tutorial: 'procgen-seedling' },
    { id: 'local-multiworld', title: 'Generating a multiworld and connecting to a local server', tutorial: 'procgen-to-multiworld' },
]);
