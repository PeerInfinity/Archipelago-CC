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
    ruleConverterPanel: { title: 'Rule Converter', why: 'Very out of date; it may be deprecated or removed.' },
    tileMapAnalyzer: { title: 'Tile Map Analyzer', why: 'Currently a failed experiment.' },
});

/** Panels a tutorial is planned for, not written yet: componentType → the planned tutorial. */
export const NOT_COVERED_YET = Object.freeze({
    // Getting started — "Your workbench"
    quickLaunchPanel: 'Your workbench',
    tutorialPanel: 'Your workbench',
    jsonPanel: 'Your workbench',
    storagePanel: 'Your workbench',
    modulesPanel: 'Your workbench',
    optionsPanel: 'Your workbench',
    settingsPanel: 'Your workbench',
    // Procgen
    mazeGameDataPanel: 'Procgen: each pipeline mode, with Maze',
    apworldEditorPanel: 'Procgen: a generated world in the APWorld Editor, to a multiworld',
    clientPanel: 'Procgen: a generated world in the APWorld Editor, to a multiworld',
    flashSubstratePanel: 'Procgen: the Seedling features',
    procgenLabPanel: 'Procgen: the Seedling features',
    textAdventureSubstrateWrapperPanel: 'Procgen: a mixed world',
    bounceDemoPanel: 'Procgen: a mixed world',
    noiz2saSubstratePanel: 'Procgen: a mixed world',
    runnerDemoPanel: 'Procgen: a mixed world',
    substrateRegistryPanel: 'Procgen: a mixed world',
    bounceRegionEditorPanel: 'Procgen: the Bounce Region Editor',
    jtaSubstrateWrapperPanel: 'Procgen: Journey to Ascension in Loop mode',
    omsiSubstrateWrapperPanel: 'Procgen: everything, in Loop mode',
    // Seedling
    flashPanel: 'Seedling: recompile the original SWF and run it',
    // Loop mode
    loopsPanel: 'Loop mode: Adventure',
    loopStatsPanel: 'Loop mode: Adventure',
    discoveryPanel: 'Loop mode: Adventure',
    gameStatePanel: 'Loop mode: Adventure',
    menuPanel: 'Loop mode: Adventure',
    // MetaMath, DepGraph, APCalc
    proofQueuePanel: 'MetaMath: play a demo preset',
    proofGraphPanel: 'MetaMath: play a demo preset',
    apcalcPanel: 'APCalc: play a demo preset',
    apcalcGeneratorPanel: 'APCalc: generate a seed, to an .apworld',
    // Tracking a game (ALTTP)
    presetsPanel: 'Tracking: ALTTP',
    exitsPanel: 'Tracking: ALTTP',
    regionsPanel: 'Tracking: ALTTP',
    pathAnalyzerPanel: 'Tracking: the Path Analyzer',
    dungeonsPanel: 'Tracking: Dungeons',
    helpersPanel: 'Tracking: Helpers',
    spoilerChecklistPanel: 'Tracking: the Spoiler Checklist',
    timerPanel: 'Tracking: the Timer',
    editorPanel: 'Tracking: viewing the rules in the Editor',
    editorCodeMirror6Panel: 'Tracking: viewing the rules in the Editor',
    metaGamePanel: 'Undecided — the Meta Game panel may be deprecated (⚖ 2026-10-10)',
    progressBarPanel: 'Undecided — goes with the Meta Game panel',
    // Other
    iframeManagerPanel: 'Other: embedding pages and windows',
    iframePanel: 'Other: embedding pages and windows',
    windowManagerPanel: 'Other: embedding pages and windows',
    windowPanel: 'Other: embedding pages and windows',
    vibeCodingSimPanel: 'Other: the Vibe Coding Simulator (low priority; kept out of the main indexes)',
    // For developers
    testsPanel: 'Developers: run the in-app tests',
    spoilerTestPanel: 'Developers: replay a spoiler test',
    eventsPanel: 'Developers: watch the event bus',
    loopsCostDebuggerPanel: 'Developers: the Loops Cost Debugger',
    regionMarkingTool: 'Developers: the Region Marking Tool',
});

/**
 * Features that are not a panel. `tutorial`: the id of a tutorial that covers
 * it, or null with `planned` naming the planned one.
 */
export const FEATURES = Object.freeze([
    { id: 'tutorial-links', title: 'Opening a tutorial from a ?tutorial= link', tutorial: 'guided-tour' },
    { id: 'layouts', title: 'Moving, splitting and closing panels; layout presets', tutorial: null, planned: 'Your workbench' },
    { id: 'modes', title: 'App modes (?mode=…)', tutorial: null, planned: 'MetaMath, DepGraph and APCalc tutorials' },
    { id: 'loop-mode', title: 'Loop mode', tutorial: null, planned: 'Loop mode: Adventure' },
    { id: 'lab-pages', title: 'The procgen lab pages (demos.html, the Seedling lab)', tutorial: null, planned: 'Procgen: the Seedling features' },
    { id: 'local-multiworld', title: 'Generating a multiworld and connecting to a local server', tutorial: null, planned: 'Procgen: a generated world in the APWorld Editor, to a multiworld' },
]);
