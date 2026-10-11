/**
 * Tracking: one short tutorial per tracker panel (catalogue "Tracker (ALTTP)
 * — own tutorials"). Each loads A Link to the Past seed 1 fresh, then shows
 * its panel. In progress: each walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { ALTTP, addItem, isChecked, loadAlttp } from '../steps/tracker.js';
import { CLIENT } from '../steps/multiworld.js';

const PATH = { panel: 'pathAnalyzerPanel' };
const GRAPH = { panel: 'regionGraphPanel' };
const DUNGEONS = { panel: 'dungeonsPanel' };
const HELPERS = { panel: 'helpersPanel' };
const CHECKLIST = { panel: 'spoilerChecklistPanel' };
const TIMER = { panel: 'timerPanel' };
const MODULES = { panel: 'modulesPanel' };
const CM6 = { panel: 'editorCodeMirror6Panel' };
const EDITOR = { panel: 'editorPanel' };

const intro = (what) => [
    { prose: what },
    { prose: `It uses an exported seed of *${ALTTP.title}*, loaded fresh; the *Track a game* tutorial covers the basics.` },
];

const tracker = ({ id, title, summary, intro: introText, sections, outro = null, firstFailingStep = null, covers }) => Object.freeze({
    id,
    title,
    summary,
    track: 'tracker',
    status: 'in-progress',
    firstFailingStep,
    ...(covers ? { covers } : {}),
    doc: null,
    intro: intro(introText),
    sections: [{ id: 'load', title: 'Load the game', blocks: loadAlttp() }, ...sections],
    outro,
});

/** Tick (or untick) a module in the Modules panel; the box is left alone when it is already that way. */
const moduleBox = (moduleId, on) => ({
    click: {
        ...MODULES,
        selector: `.module-entry[data-module-id="${moduleId}"] .module-controls input[type="checkbox"]${on ? ':not(:checked)' : ':checked'}`,
        optional: true,
    },
});

// ── Path Analyzer ────────────────────────────────────────────────────────

const pathInput = { ...PATH, selector: '[data-testid="path-analyzer-region-input"]' };
const pathResults = { ...PATH, selector: '.path-analysis-results' };

export const TRACKER_PATH_ANALYZER = tracker({
    id: 'tracker-path-analyzer',
    title: 'Tracking: why can\'t I get there?',
    summary: 'Ask the Path Analyzer how to reach a region, and which items each way needs.',
    intro: 'The **Path Analyzer** finds the ways into a region from where you are, and what each way needs — the answer to "what am I missing?".',
    sections: [{
        id: 'analyze',
        title: 'Analyze a path',
        blocks: [
            {
                step: {
                    id: 'region',
                    text: 'Open the **Path Analyzer** tab and type **Death Mountain** as the target region.',
                    actions: [{ fill: { ...pathInput, value: 'Death Mountain' } }],
                    done: (ctx) => ctx.query(pathInput)?.value === 'Death Mountain',
                },
            },
            {
                step: {
                    id: 'analyze',
                    text: 'Press **Analyze Paths**. The result lists the paths in and the requirements along them — here, lifting the rock at the Death Mountain entrance, or the Flute.',
                    actions: [{ click: { ...PATH, selector: '[data-testid="path-analyzer-analyze-button"]' } }],
                    done: (ctx) => ctx.text(pathResults).includes('Analysis complete!'),
                    failed: (ctx) => ctx.text({ ...PATH, selector: '.path-analysis-results .error-message' }),
                    doneTimeoutMs: 60000,
                },
            },
            { prose: 'Each region in the **Regions** panel has its own **Analyze Paths** button, which does the same for that region.' },
        ],
    }],
});

// ── Region Graph ─────────────────────────────────────────────────────────

const goTo = { ...GRAPH, selector: 'details.rg-pick' };
const graphLocation = "Blind's Hideout - Left";

export const TRACKER_REGION_GRAPH = tracker({
    id: 'tracker-region-graph',
    title: 'Tracking: the Region Graph',
    summary: 'Track a game on the Region Graph: regions coloured by reachability, clicked to move, check and show.',
    intro: 'The **Region Graph** draws the game as regions joined by exits, coloured by what you can reach; each region shows its counts of checked, reachable and unreachable locations.',
    sections: [{
        id: 'graph',
        title: 'The graph',
        blocks: [
            {
                step: {
                    id: 'open-graph',
                    text: 'Open the **Region Graph** tab. Drag to pan, scroll to zoom; the player is the marker on the start region.',
                    actions: [{ activate: GRAPH }],
                    done: (ctx) => ctx.isPanelShowing(GRAPH) && ctx.exists({ ...GRAPH, selector: 'canvas' }),
                },
            },
            {
                step: {
                    id: 'open-controls',
                    text: 'Press **+** beside *Controls*. **On Region Node Click** says what a click on a region does: move the player there, show it in the Regions panel, add it to the path.',
                    actions: [{ click: { ...GRAPH, selector: '#controlsHeader', optional: true } }],
                    done: (ctx) => ctx.text({ ...GRAPH, selector: '#toggleControls' }) === '−',
                },
            },
            {
                step: {
                    id: 'open-go-to',
                    text: 'Unfold **Go to**: it picks a region or a location by name and does what clicking its node does — handy when a node is hard to find.',
                    actions: [{ click: { ...GRAPH, selector: 'details.rg-pick:not([open]) > summary', optional: true } }],
                    done: (ctx) => ctx.query(goTo)?.open === true,
                },
            },
            {
                step: {
                    id: 'go-to-region',
                    text: 'Choose the region **Blinds Hideout**: the player moves there, and the Regions panel shows it.',
                    actions: [{ fill: { ...GRAPH, selector: 'input.rg-pick-region', value: 'Blinds Hideout' } }],
                    done: (ctx) => ctx.text({ ...GRAPH, selector: '.rg-pick-status' }) === 'Went to region Blinds Hideout.',
                },
            },
            {
                step: {
                    id: 'go-to-location',
                    text: `Back on the **Region Graph**, choose the location **${graphLocation}**: it is checked, as a click on its node would, and the region's counts change.`,
                    actions: [{ fill: { ...GRAPH, selector: 'input.rg-pick-location', value: graphLocation } }],
                    done: (ctx) => isChecked(ctx, graphLocation),
                },
            },
            {
                step: {
                    id: 'fold-go-to',
                    text: 'Fold **Go to** and the controls again.',
                    actions: [
                        { click: { ...GRAPH, selector: 'details.rg-pick[open] > summary', optional: true } },
                        { click: { ...GRAPH, selector: '#controlsHeader' } },
                    ],
                    done: (ctx) => ctx.query(goTo)?.open === false && ctx.text({ ...GRAPH, selector: '#toggleControls' }) === '+',
                },
            },
        ],
    }],
});

// ── Dungeons ─────────────────────────────────────────────────────────────

const eastern = { ...DUNGEONS, selector: '.region-block[data-dungeon="Eastern Palace"]' };

export const TRACKER_DUNGEONS = tracker({
    id: 'tracker-dungeons',
    title: 'Tracking: dungeons',
    summary: 'See a dungeon\'s regions and boss in the Dungeons panel.',
    intro: 'The **Dungeons** panel groups a game\'s regions by dungeon, with its bosses.',
    sections: [{
        id: 'dungeon',
        title: 'A dungeon',
        blocks: [
            {
                step: {
                    id: 'search',
                    text: 'Open the **Dungeons** tab and type **Eastern** in the search box.',
                    actions: [{ fill: { ...DUNGEONS, selector: '#dungeon-search', value: 'Eastern' } }],
                    done: (ctx) => ctx.exists(eastern),
                },
            },
            {
                step: {
                    id: 'unfold',
                    text: 'Click **Eastern Palace** to unfold it: its regions, and its boss. A region links to the Regions panel.',
                    actions: [{ click: { ...DUNGEONS, selector: '.region-block[data-dungeon="Eastern Palace"].collapsed .region-header', optional: true } }],
                    done: (ctx) => ctx.query(eastern)?.classList.contains('expanded') === true,
                },
            },
            {
                step: {
                    id: 'clear',
                    text: 'Clear the search box.',
                    actions: [{ fill: { ...DUNGEONS, selector: '#dungeon-search', value: '' } }],
                    done: (ctx) => ctx.query({ ...DUNGEONS, selector: '#dungeon-search' })?.value === '',
                },
            },
        ],
    }],
});

// ── Helpers ──────────────────────────────────────────────────────────────

const liftRocks = { ...HELPERS, selector: '.region-block[data-helper="can_lift_rocks"] .region-status' };

export const TRACKER_HELPERS = tracker({
    id: 'tracker-helpers',
    title: 'Tracking: helpers',
    summary: 'Watch a game\'s helper rules — "can lift rocks" and the like — turn true as you collect items.',
    intro: 'A game\'s logic is built from **helpers**: named rules such as *can lift rocks*, used by many locations and exits. The **Helpers** panel shows each one\'s current answer.',
    sections: [{
        id: 'helper',
        title: 'A helper',
        blocks: [
            {
                step: {
                    id: 'search',
                    text: 'Open the **Helpers** tab and type **can_lift_rocks**: it is *false* — you have no gloves.',
                    actions: [{ fill: { ...HELPERS, selector: '#helper-search', value: 'can_lift_rocks' } }],
                    done: (ctx) => ctx.text(liftRocks) === 'false',
                },
            },
            ...addItem('glove', 'Progressive Glove', 'the first one is the Power Glove'),
            {
                step: {
                    id: 'true-now',
                    text: 'Back in **Helpers**, **can_lift_rocks** is *true* now — and every rule that uses it has changed with it.',
                    actions: [{ activate: HELPERS }],
                    done: (ctx) => ctx.text(liftRocks) === 'true',
                },
            },
            {
                step: {
                    id: 'clear',
                    text: 'Clear the search box.',
                    actions: [{ fill: { ...HELPERS, selector: '#helper-search', value: '' } }],
                    done: (ctx) => ctx.query({ ...HELPERS, selector: '#helper-search' })?.value === '',
                },
            },
        ],
    }],
});

// ── Spoiler Checklist ────────────────────────────────────────────────────

const checklistLocation = "Blind's Hideout - Left";

export const TRACKER_SPOILER_CHECKLIST = tracker({
    id: 'tracker-spoiler-checklist',
    title: 'Tracking: the Spoiler Checklist',
    summary: 'Follow a seed\'s spoiler sphere by sphere, and see which item each location holds.',
    intro: 'The **Spoiler Checklist** lists a seed\'s locations in the order its spoiler log solves them — sphere by sphere — with the item each one holds. It spoils the seed, by design.',
    sections: [{
        id: 'checklist',
        title: 'The checklist',
        blocks: [
            {
                step: {
                    id: 'open',
                    text: 'Open the **Spoiler Checklist** tab: the current sphere is highlighted; later ones are what you cannot reach yet.',
                    actions: [{ activate: CHECKLIST }],
                    done: (ctx) => ctx.exists({ ...CHECKLIST, selector: '.sphere-section' }),
                },
            },
            {
                step: {
                    id: 'check',
                    text: `Click **${checklistLocation}** (it holds the Flute) to check it: the Flute is yours, and what it opens moves up.`,
                    actions: [{ click: { ...CHECKLIST, selector: '.location-row .location-name', text: checklistLocation } }],
                    done: (ctx) => isChecked(ctx, checklistLocation),
                },
            },
            { prose: '**Simulate received items** gives you each checked location\'s item, as a single-player game would; **Sync Now** brings the checklist up to date with checks made elsewhere.' },
        ],
    }],
});

// ── Timer ────────────────────────────────────────────────────────────────

const timerButton = { ...CLIENT, selector: '#timer-control-button' };
const checksSent = { ...CLIENT, selector: '#timer-checks-sent' };
const TIMER_MODULE = 'timerPanel';

export const TRACKER_TIMER = tracker({
    id: 'tracker-timer',
    covers: ['timerPanel'],
    title: 'Tracking: the timer',
    summary: 'Let the timer check reachable locations by itself, in the Console or in a tab of its own.',
    intro: 'The **timer** checks a reachable location every few seconds by itself — a game that plays itself, for testing or for watching the logic unfold. It sits in the **Console**, or in a **Timer** tab of its own when the Console is closed.',
    sections: [
        {
            id: 'console',
            title: 'In the Console',
            blocks: [
                {
                    step: {
                        id: 'begin',
                        text: 'Open the **Console** tab and press **Begin**: the bar fills, and each time it does a reachable location is checked. *Checked* counts them.',
                        actions: [{ click: { ...timerButton, text: 'Begin' } }],
                        done: (ctx) => /^Checked: [1-9]/.test(ctx.text(checksSent)),
                        doneTimeoutMs: 60000,
                    },
                },
                {
                    step: {
                        id: 'stop',
                        text: 'Press **Stop**. **Quick Check** checks one location at once, without waiting.',
                        actions: [{ click: { ...timerButton, text: 'Stop' } }],
                        done: (ctx) => ctx.text(timerButton) === 'Begin',
                    },
                },
            ],
        },
        {
            id: 'own-tab',
            title: 'In a tab of its own',
            blocks: [
                {
                    step: {
                        id: 'enable-panel',
                        text: 'Open the **Modules** tab and tick **Timer Panel**: a **Timer** tab opens. The timer itself has ONE home: while the **Console** tab is open it stays there (by design), and it moves into the Timer tab when the Console is closed.',
                        actions: [moduleBox(TIMER_MODULE, true)],
                        done: (ctx) => ctx.exists(TIMER),
                    },
                },
                {
                    step: {
                        id: 'disable-panel',
                        text: 'Untick **Timer Panel** to close the Timer tab again.',
                        actions: [moduleBox(TIMER_MODULE, false)],
                        done: (ctx) => !ctx.query(TIMER) && ctx.exists(timerButton),
                    },
                },
            ],
        },
    ],
});

// ── The Editor ───────────────────────────────────────────────────────────

const cmSource = { ...CM6, selector: '.editor-controls select' };
const EDITOR_MODULE = 'editor';

export const TRACKER_EDITOR = tracker({
    id: 'tracker-editor',
    covers: ['editorPanel'],
    title: 'Tracking: the rules in the Editor',
    summary: 'Read the loaded game\'s rules JSON — and other data — in the Editor.',
    intro: 'The **Editor** shows the loaded game\'s logic as JSON — the `rules.json` the tracker reads — and other data: the latest state snapshot, the static data, the command queue.',
    sections: [
        {
            id: 'editor',
            title: 'The rules',
            blocks: [
                {
                    step: {
                        id: 'rules',
                        text: 'Open the **Editor** tab and choose **Active Rules JSON** in its drop-down: the whole file, with its regions, items, locations and rules.',
                        actions: [{ select: { ...cmSource, value: 'rules' } }],
                        done: (ctx) => ctx.text({ ...CM6, selector: '.cm-content' }).includes('"regions"'),
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'fold',
                        text: 'Press **Fold All** to see only the top-level keys; **Unfold All** opens them again.',
                        actions: [{ click: { ...CM6, selector: '.editor-controls button', text: 'Fold All' } }],
                        done: (ctx) => ctx.exists({ ...CM6, selector: '.cm-foldPlaceholder' }),
                    },
                },
                {
                    step: {
                        id: 'snapshot',
                        text: 'Choose **Latest Snapshot** instead: the current state — inventory, checked locations, reachable regions.',
                        actions: [{ select: { ...cmSource, value: 'latestSnapshot' } }],
                        done: (ctx) => ctx.query(cmSource)?.value === 'latestSnapshot',
                    },
                },
            ],
        },
        {
            id: 'plain',
            title: 'The plain editor',
            blocks: [
                {
                    step: {
                        id: 'enable-plain',
                        text: 'There is also a plain-text **Editor**, for very large files. Open the **Modules** tab and tick **Editor** to open it.',
                        actions: [moduleBox(EDITOR_MODULE, true)],
                        done: (ctx) => ctx.exists({ ...EDITOR, selector: 'textarea.editor-textarea' }),
                    },
                },
                {
                    step: {
                        id: 'disable-plain',
                        text: 'Untick **Editor** in the **Modules** tab to close it again.',
                        actions: [moduleBox(EDITOR_MODULE, false)],
                        done: (ctx) => !ctx.query(EDITOR),
                    },
                },
            ],
        },
    ],
});

