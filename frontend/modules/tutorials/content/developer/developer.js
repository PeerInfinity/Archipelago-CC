/**
 * For developers (catalogue "Developer"; ⚖ the user, 2026-10-10: a track of
 * its own, collapsed in the list): the in-app tests, a spoiler test, the
 * event registry, the Loops Cost Debugger and the Region Marking Tool. All on
 * the default world (Adventure, seed 1) unless a step says otherwise. In
 * progress: each walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { loadWorldWithLog } from '../steps/worlds.js';

const TESTS = { panel: 'testsPanel' };
const SPOILER = { panel: 'spoilerTestPanel' };
const EVENTS = { panel: 'eventsPanel' };
const COSTS = { panel: 'loopsCostDebuggerPanel' };
const MARKING = { panel: 'regionMarkingTool' };
const MODULES = { panel: 'modulesPanel' };

const developer = (t) => Object.freeze({ track: 'developer', status: 'in-progress', doc: null, outro: null, ...t });
const adventure = (id) => loadWorldWithLog(id, 'adventure', 1, 'Adventure');

// ── Tests ────────────────────────────────────────────────────────────────

const TEST_ID = 'test_region_graph_panel_activation';
const testRow = `.test-item[data-test-id="${TEST_ID}"]`;

export const DEV_TESTS = developer({
    id: 'dev-tests',
    title: 'Run the in-app tests',
    summary: 'Run one of the app\'s in-app tests from the Tests panel and read its conditions.',
    firstFailingStep: 'run-test',
    intro: [
        { prose: 'The app tests itself from the inside: each in-app test drives the real panels and asserts on what they show. `npm test` runs a roster of them in a browser; the **Tests** panel runs them by hand, one or all.' },
    ],
    sections: [{
        id: 'run',
        title: 'Run a test',
        blocks: [
            {
                step: {
                    id: 'find-test',
                    text: `Open the **Tests** tab, untick **Hide disabled tests** if it is ticked, and find **Region Graph Panel Activation** (\`${TEST_ID}\`). Each test shows its category, its status, and — once run — the conditions it checked.`,
                    actions: [{ click: { ...TESTS, selector: '#hide-disabled-tests-checkbox:checked', optional: true } }],
                    done: (ctx) => ctx.exists({ ...TESTS, selector: testRow }),
                },
            },
            {
                step: {
                    id: 'run-test',
                    text: 'Press its **Run** button. Its status turns to *passed* (or *failed*), and each condition gets a ✅ or a ❌.',
                    // ⛔ No action: Do it does not press Run. Measured 2026-10-10 (⚖ the user:
                    // "try it and measure"): a test run from the panel while the walk row — itself
                    // an in-app test — is running ends the OUTER run, and the rows after it never
                    // start. So the walk waits for a result no one asked for, and records this step.
                    done: (ctx) => ctx.exists({ ...TESTS, selector: `.test-status-display[data-status-for="${TEST_ID}"].test-status-passed` }),
                    doneTimeoutMs: 3000,
                },
            },
            { prose: '**Run All** runs every ticked test in order; the boxes above it tick them all, hide the unticked ones, or shuffle the order. `npm test -- --mode=<mode>` runs a mode\'s roster in a browser from the terminal, and `--batch=` one named part of it.' },
        ],
    }],
});

// ── Spoiler test ─────────────────────────────────────────────────────────

const spoilerLog = { ...SPOILER, selector: '#spoiler-log-output' };

export const DEV_SPOILER_TEST = developer({
    id: 'dev-spoiler-test',
    title: 'Replay a spoiler test',
    summary: 'Replay a world\'s solution sphere by sphere and check the app\'s logic reaches what the generator said it would.',
    firstFailingStep: null,
    intro: [
        { prose: 'A **spoiler test** replays the generator\'s own solution (the *sphere log* written next to each exported world): sphere by sphere it collects the items and checks that the locations the generator found reachable are the ones the app\'s logic finds reachable. It is how a world\'s export is proved right.' },
    ],
    sections: [{
        id: 'replay',
        title: 'Replay',
        blocks: [
            ...adventure('load'),
            {
                step: {
                    id: 'load-log',
                    text: 'Open the **Spoiler Test** tab and press **Load Suggested Spoiler Log**: the loaded world\'s sphere log.',
                    actions: [{ click: { ...SPOILER, selector: '#load-suggested-spoiler-log' } }],
                    done: (ctx) => ctx.text({ ...SPOILER, selector: '#spoiler-test-name' }) !== '',
                },
            },
            {
                step: {
                    id: 'run-full',
                    text: 'Press **Run Full Test**. Each sphere reports *PASS* or *FAIL*, and the log ends "All spheres passed". (**Step Test** goes one sphere at a time.)',
                    actions: [{ click: { ...SPOILER, selector: '#run-full-spoiler-test' } }],
                    done: (ctx) => ctx.text(spoilerLog).includes('All spheres passed'),
                    doneTimeoutMs: 60000,
                },
            },
            { prose: 'The test checked locations as it went. From the terminal, `npm test -- --mode=test-spoilers --game=<game> --seed=<n>` runs the same replay for any exported world.' },
            ...adventure('reload'),
        ],
    }],
});

// ── Events ───────────────────────────────────────────────────────────────

const EVENT = 'stateManager:rulesLoaded';
const eventSearch = { ...EVENTS, selector: '#event-search' };

export const DEV_EVENTS = developer({
    id: 'dev-events',
    title: 'The event registry',
    summary: 'See which modules publish and subscribe to each event, in the Events panel.',
    firstFailingStep: null,
    intro: [
        { prose: 'The modules talk through two channels: the **event bus** (publish / subscribe) and the **dispatcher** (an event handed from module to module in priority order). The **Events** panel lists every event, and for each one who publishes it and who listens.' },
    ],
    sections: [{
        id: 'events',
        title: 'Find an event',
        blocks: [
            {
                step: {
                    id: 'search',
                    text: `Open the **Events** tab and type **${EVENT}** in its search box: the event every panel waits for when a world finishes loading, with its publisher and its many subscribers.`,
                    actions: [{ fill: { ...eventSearch, value: EVENT } }],
                    done: (ctx) => [...(ctx.query(EVENTS)?.querySelectorAll('.event-bus-event') ?? [])]
                        .some((el) => el.style.display !== 'none' && el.textContent.includes(EVENT)),
                },
            },
            { prose: 'Each publisher and subscriber row has a box: unticking it switches that module\'s side of the event off — handy when hunting a bug, so tick it again afterwards.' },
            {
                step: {
                    id: 'clear',
                    text: 'Clear the search box.',
                    actions: [{ fill: { ...eventSearch, value: '' } }],
                    done: (ctx) => ctx.query(eventSearch)?.value === '',
                },
            },
        ],
    }],
});

// ── Loops Cost Debugger ──────────────────────────────────────────────────

const costStatus = { ...COSTS, selector: '.cd-status' };

export const DEV_LOOPS_COST_DEBUGGER = developer({
    id: 'dev-loops-cost-debugger',
    title: 'The Loops Cost Debugger',
    summary: 'Plan a world\'s solution as a Loop-mode queue and see what each step would cost.',
    firstFailingStep: null,
    intro: [
        { prose: 'The **Loops Cost Debugger** turns a world\'s solution (its sphere log) into Loop-mode actions, and shows what each would cost — the check that a world\'s mana costs make it playable in Loop mode.' },
    ],
    sections: [{
        id: 'plan',
        title: 'Plan',
        blocks: [
            ...adventure('load'),
            {
                step: {
                    id: 'load-log',
                    text: 'Open the **Loops Cost Debugger** tab and press **Load**: the world\'s sphere log, as steps.',
                    actions: [{ click: { ...COSTS, selector: '.cd-btn-load' } }],
                    done: (ctx) => /\/\s*[1-9]/.test(ctx.text({ ...COSTS, selector: '.cd-summary-entries' })),
                    failed: (ctx) => (ctx.text(costStatus).startsWith('No sphere log available') ? ctx.text(costStatus) : null),
                    doneTimeoutMs: 30000,
                },
            },
            {
                step: {
                    id: 'plan-step',
                    text: 'Press **Plan step**: the first step becomes the Loop-mode actions that do it, with their costs.',
                    actions: [{ click: { ...COSTS, selector: '.cd-btn-plan-step' } }],
                    done: (ctx) => ctx.exists({ ...COSTS, selector: '.cd-step-row' }),
                    doneTimeoutMs: 30000,
                },
            },
            { prose: '**Verify** plays the whole plan through the real Loop-mode queue and reports where it runs out of mana.' },
            {
                step: {
                    id: 'reset',
                    text: 'Press **Reset**.',
                    actions: [{ click: { ...COSTS, selector: '.cd-btn-reset' } }],
                    done: (ctx) => !ctx.exists({ ...COSTS, selector: '.cd-step-row' }),
                },
            },
        ],
    }],
});

// ── Region Marking Tool ──────────────────────────────────────────────────

const markingBox = (on) => ({
    click: {
        ...MODULES,
        selector: `.module-entry[data-module-id="regionMarkingTool"] .module-controls input[type="checkbox"]${on ? ':not(:checked)' : ':checked'}`,
        optional: true,
    },
});

export const DEV_REGION_MARKING_TOOL = developer({
    id: 'dev-region-marking-tool',
    title: 'The Region Marking Tool',
    summary: 'Mark a level map\'s regions, exits and locations by hand, and save them as a region atlas.',
    firstFailingStep: 'mark-region',
    intro: [
        { prose: 'The **Region Marking Tool** draws a game\'s level maps and lets you mark them up: regions (rectangles), the exits between them, and the locations in them. The result is a **region atlas** — the JSON a substrate uses to turn a game\'s map into Archipelago regions. It opens on Seedling\'s map. (It has had little testing so far.)' },
        { prose: 'It is part of the Flash mode (`?mode=flash`); in the default mode it is switched on in the Modules panel.' },
    ],
    sections: [{
        id: 'mark',
        title: 'Mark a region',
        blocks: [
            {
                step: {
                    id: 'enable',
                    text: 'Open the **Modules** tab and tick **Region Marking Tool**: its tab opens, with a level of Seedling\'s map.',
                    actions: [markingBox(true)],
                    done: (ctx) => ctx.exists({ ...MARKING, selector: '.rmt-canvas' }),
                    doneTimeoutMs: 30000,
                },
            },
            {
                step: {
                    id: 'region-mode',
                    text: 'Press **Region** among the modes.',
                    actions: [{ click: { ...MARKING, selector: '.rmt-modes .rmt-btn', text: 'Region' } }],
                    done: (ctx) => ctx.query({ ...MARKING, selector: '.rmt-modes .rmt-btn', text: 'Region' })?.classList.contains('rmt-active') === true,
                },
            },
            {
                step: {
                    id: 'mark-region',
                    text: 'Drag a rectangle on the map, and name the region when asked: it joins the list beside the map. **Edge exit**, **Teleporter**, **Entrance** and **Location** mark the rest the same way; **Validate** checks the atlas and **Save** downloads it.',
                    actions: [{ click: { ...MARKING, selector: '.rmt-canvas' } }],
                    done: (ctx) => ctx.exists({ ...MARKING, selector: '.rmt-list li' }),
                },
            },
            {
                step: {
                    id: 'disable',
                    text: 'Untick **Region Marking Tool** in the **Modules** tab to close it.',
                    actions: [markingBox(false)],
                    done: (ctx) => !ctx.query(MARKING),
                },
            },
        ],
    }],
});
