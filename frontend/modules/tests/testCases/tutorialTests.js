/**
 * In-app tests for the Tutorial panel (enrolled in the test-substrates roster:
 * the guided tour needs the Region Graph, which test-regression's
 * modules-nograph.json does not load).
 *
 * ⛓ Expectations are read off the tutorial DATA (content/index.js) and the
 * live layout, never typed: a new step in a tutorial is a new condition here.
 *
 * ⚖ RULED (the user, 2026-09-26): every row SETS the state it expects at its
 * start and cleans up after itself — the panel back on its list, merged, the
 * settings and the layout's active tabs as they were, and (the tour row) the
 * world that was loaded before it.
 */
import { registerTest } from '../testRegistry.js';
import settingsManager from '../../../app/core/settingsManager.js';
import eventBus from '../../../app/core/eventBus.js';
import { TUTORIALS } from '../../tutorials/content/index.js';
import { DEFAULT_DONE_TIMEOUT_MS, TRACKS, panelSteps, validateTutorial } from '../../tutorials/tutorialShape.js';
import { ratchetVerdict, walkTutorial } from '../../tutorials/tutorialWalk.js';
import { COMPONENT_TYPE, CONTROLS, DEFAULTS, MODULE_ID, TutorialUI } from '../../tutorials/tutorialUI.js';
import { TUTORIAL_STACK_ID, componentItems, isSplit, mergeBack } from '../../tutorials/tutorialLayout.js';
import {
    CURSOR_CLASS, OUTLINE_CLASS, hideCursor, performAction, setOutline, waitFor,
} from '../../tutorials/tutorialExecutor.js';
import { buildContext } from '../../tutorials/tutorialContext.js';

const CATEGORY = 'Tutorials';
const WALK_CATEGORY = 'Tutorial walks';
const walkId = (id) => `tutorial-walk-${id}`;
const MOUNT_TIMEOUT_MS = 10000;
const POLL_MS = 100;
const TOUR_ID = 'guided-tour';

/** The live panel, opened if it is closed, back on its list and merged, its settings at `settings`. */
async function freshPanel(tc, settings) {
    if (!TutorialUI.instance) {
        try { await performAction({ activate: { panel: COMPONENT_TYPE } }, { eventBus }); } catch { /* reported below */ }
    }
    const ok = await tc.pollForCondition(() => TutorialUI.instance, 'the Tutorial panel to be mounted', MOUNT_TIMEOUT_MS, POLL_MS);
    tc.reportCondition('the Tutorial panel is mounted', Boolean(ok));
    if (!ok) return null;
    const ui = TutorialUI.instance;
    // ⛓ The instance exists even when the layout factory REFUSED it (the
    // constructor ran first), so a row that drove `ui.root` passed against a
    // detached panel. Assert it is the element its tab shows.
    tc.reportCondition('the panel is mounted in its Golden Layout tab',
        Boolean(ui.root.isConnected && ui.item()?.container?.element?.contains(ui.root)));
    await ui.ready;
    if (ui.tutorial) ui.exit();
    mergeBack(ui.item());
    for (const [k, v] of Object.entries(settings)) await settingsManager.updateModuleSetting(MODULE_ID, k, v);
    await ui._loadSettings();
    ui.render();
    return ui;
}

/** The module's settings as they are now, to put back in `finally`. */
async function savedSettings() {
    const out = {};
    for (const k of [...Object.keys(DEFAULTS), 'progress']) {
        out[k] = await settingsManager.getSetting(`moduleSettings.${MODULE_ID}.${k}`, DEFAULTS[k] ?? null);
    }
    return out;
}

async function restore(ui, settings) {
    if (ui?.tutorial) ui.exit();
    if (ui) mergeBack(ui.item());
    setOutline(null);
    hideCursor();
    for (const [k, v] of Object.entries(settings)) await settingsManager.updateModuleSetting(MODULE_ID, k, v);
    await ui?._loadSettings?.();
    ui?.render?.();
}

/** Every stack's active component, to put back afterwards. */
function activeTabs() {
    const items = window.goldenLayoutInstance?.getAllContentItems?.() ?? [];
    return items.filter((it) => it.isStack).map((stack) => [stack, stack.getActiveComponentItem?.()]);
}

function restoreActiveTabs(saved) {
    for (const [stack, item] of saved) {
        if (item && item.parentItem === stack && stack.getActiveComponentItem?.() !== item) stack.setActiveComponentItem(item, false);
    }
}

// ── rows ─────────────────────────────────────────────────────────────────

async function tutorialPanelListsEveryTutorial(tc) {
    const settings = await savedSettings();
    const ui = await freshPanel(tc, { progress: null });
    if (!ui) return tc.getOverallResult();
    try {
        for (const { tutorial } of TUTORIALS) {
            let valid = true;
            try { validateTutorial(tutorial); } catch (e) { valid = false; tc.log?.(e.message); }
            tc.reportCondition(`tutorial ${tutorial.id} has the tutorial shape`, valid);
        }
        // Where each card belongs (⚖ 2026-10-10): ready ones under their track,
        // in-progress ones in the collapsed In progress section, the developer
        // track in a collapsed section of its own — in that order.
        const all = TUTORIALS.map((e) => e.tutorial);
        const order = Object.keys(TRACKS);
        const byTrack = (list) => order.flatMap((k) => list.filter((t) => t.track === k));
        const where = (t) => (TRACKS[t.track].collapsed ? `.${CONTROLS.developer}`
            : t.status === 'in-progress' ? `.${CONTROLS.drafts}` : null);
        const expected = [
            ...byTrack(all.filter((t) => !where(t))),
            ...byTrack(all.filter((t) => where(t) === `.${CONTROLS.drafts}`)),
            ...byTrack(all.filter((t) => where(t) === `.${CONTROLS.developer}`)),
        ].map((t) => t.id);
        const cards = [...ui.root.querySelectorAll('.tut-card')].map((c) => c.dataset.tutorialId);
        tc.reportCondition(`the list shows one card per tutorial, grouped by track (${cards.join(', ')})`,
            JSON.stringify(cards) === JSON.stringify(expected));
        for (const t of all) {
            const card = ui.root.querySelector(`.tut-card[data-tutorial-id="${t.id}"]`);
            const box = card?.closest('details');
            const want = where(t);
            tc.reportCondition(`${t.id} (${t.status}, track ${t.track}) sits ${want ? `in the collapsed ${want}` : 'in the open list'}`,
                want ? Boolean(box?.matches(want) && !box.open) : Boolean(card && !box));
        }
        tc.reportCondition('every card has a Start button',
            [...ui.root.querySelectorAll('.tut-card')].every((c) => c.querySelector(`.${CONTROLS.start}`)));
        tc.reportCondition('the list links to Quick Launch', Boolean(ui.root.querySelector(`.${CONTROLS.quickLaunch}`)));
    } finally {
        await restore(ui, settings);
    }
    return tc.getOverallResult();
}

async function tutorialStartSplitsAndMergeRestores(tc) {
    const settings = await savedSettings();
    const tabs = activeTabs();
    const ui = await freshPanel(tc, { autoAdvance: false, showOutline: false });
    if (!ui) return tc.getOverallResult();
    try {
        const item = ui.item();
        tc.reportCondition('the Tutorial panel has a Golden Layout tab', Boolean(item));
        if (!item) return tc.getOverallResult();
        const home = item.parentItem;
        tc.reportCondition('before a tutorial starts, the panel shares its stack (the default layout is not split)',
            home.contentItems.length > 1);

        ui.root.querySelector(`.tut-card[data-tutorial-id="${TOUR_ID}"] .${CONTROLS.start}`)?.click();
        const split = await tc.pollForCondition(() => isSplit(ui.item()), 'Start to split the column', MOUNT_TIMEOUT_MS, POLL_MS);
        tc.reportCondition('Start moves the panel into a stack of its own', Boolean(split));
        const bottom = ui.item().parentItem;
        const column = bottom.parent;
        tc.reportCondition(`that stack is ${TUTORIAL_STACK_ID}, in a column, under the stack it came from`,
            bottom.id === TUTORIAL_STACK_ID && column?.isColumn
            && column.contentItems.indexOf(home) === column.contentItems.indexOf(bottom) - 1);
        tc.reportCondition('the stack it came from keeps its other tabs', home.contentItems.length >= 1 && !home.contentItems.includes(ui.item()));

        ui.root.querySelector(`.${CONTROLS.layout}`)?.click();
        tc.reportCondition('Merge puts the panel back into the stack it came from', ui.item()?.parentItem === home);
        tc.reportCondition('… and the column is gone (that stack is a child of the row again)', home.parent?.isRow === true);

        ui.root.querySelector(`.${CONTROLS.layout}`)?.click();
        tc.reportCondition('Split splits it again', isSplit(ui.item()));

        ui.root.querySelector(`.${CONTROLS.exit}`)?.click();
        tc.reportCondition('All tutorials goes back to the list and merges', ui.item()?.parentItem === home && !ui.tutorial
            && Boolean(ui.root.querySelector('.tut-card')));
    } finally {
        await restore(ui, settings);
        restoreActiveTabs(tabs);
    }
    return tc.getOverallResult();
}

async function tutorialCursorAndOutlineReachTabs(tc) {
    const tabs = activeTabs();
    let sawCursor = false;
    const observer = new MutationObserver(() => {
        if (document.querySelector(`.${CURSOR_CLASS}`)) sawCursor = true;
    });
    observer.observe(document.body, { childList: true });
    try {
        // A tab that has spilled into its stack's ▾ list — the path a person finds hardest.
        const items = window.goldenLayoutInstance?.getAllContentItems?.() ?? [];
        const hidden = items.find((it) => it.isComponent && it.tab?.element?.closest('.lm_tabdropdown_list')
            && it.parentItem.getActiveComponentItem() !== it);
        tc.reportCondition('some stack has a tab in its overflow list (the default layout overflows)', Boolean(hidden));
        if (hidden) {
            await performAction({ activate: { panel: hidden.componentType, title: hidden.title } },
                { animate: true, moveMs: 60, eventBus });
            tc.reportCondition(`the animated cursor appeared while reaching ${hidden.title}`, sawCursor);
            tc.reportCondition(`${hidden.title}, reached through the ▾ list, is its stack's active tab`,
                hidden.parentItem.getActiveComponentItem() === hidden);
            tc.reportCondition('the ▾ list is closed again', !hidden.parentItem.element
                .querySelector('.lm_tabdropdown_list')?.offsetParent);
        }
        hideCursor();

        // An ACTIVE tab is always drawn in its header (GL never moves it to the ▾ list).
        const shown = items.find((it) => it.isComponent && it.parentItem?.getActiveComponentItem?.() === it);
        const tab = shown?.tab?.element;
        setOutline(() => tab);
        const outline = document.querySelector(`.${OUTLINE_CLASS}`);
        const o = outline?.getBoundingClientRect();
        const t = tab?.getBoundingClientRect();
        tc.reportCondition('the outline is drawn around its target', Boolean(o && t && o.width > 0
            && o.left <= t.left && o.top <= t.top && o.right >= t.right && o.bottom >= t.bottom));
        setOutline(null);
        tc.reportCondition('setOutline(null) removes it', !document.querySelector(`.${OUTLINE_CLASS}`));
    } finally {
        observer.disconnect();
        setOutline(null);
        hideCursor();
        restoreActiveTabs(tabs);
    }
    return tc.getOverallResult();
}

async function tutorialGuidedTourPlaysEveryStep(tc) {
    const settings = await savedSettings();
    const tabs = activeTabs();
    const ctx = buildContext({ eventBus });
    const before = ctx.rulesSource();
    const ui = await freshPanel(tc, { autoAdvance: true, autoAdvanceDelayMs: 50, animateCursor: false, showOutline: false });
    if (!ui) return tc.getOverallResult();
    const tour = TUTORIALS.find((e) => e.tutorial.id === TOUR_ID).tutorial;
    const steps = panelSteps(tour);
    const budget = steps.reduce((n, { step }) => n + (step.doneTimeoutMs ?? DEFAULT_DONE_TIMEOUT_MS), 0);
    try {
        ui.start(TOUR_ID);
        ui.root.querySelector(`.${CONTROLS.play}`)?.click();
        tc.reportCondition('Play is running', ui.playing);
        const ended = await tc.pollForCondition(() => !ui.playing, 'Play to finish the tour', budget, 250);
        tc.reportCondition(`Play ended (status: "${ui.status}")`, Boolean(ended));
        for (const { step, index } of steps) {
            tc.reportCondition(`step ${index + 1} ${step.id} is done`, ui.doneSteps.has(step.id));
        }
        tc.reportCondition('the panel says Finished on the last step', ui.status === 'Finished.' && ui.isLast());
    } finally {
        await restore(ui, settings);
        restoreActiveTabs(tabs);
        if (typeof before === 'string' && before.startsWith('./presets/') && ctx.rulesSource() !== before) {
            try { await ctx.loadRulesPath(before); } catch (e) { tc.log?.(`could not reload ${before}: ${e.message}`); }
        }
    }
    return tc.getOverallResult();
}

async function tutorialUrlRequestStartsTheTutorial(tc) {
    const settings = await savedSettings();
    const tabs = activeTabs();
    const ui = await freshPanel(tc, { autoAdvance: false, showOutline: false });
    if (!ui) return tc.getOverallResult();
    try {
        const n = panelSteps(TUTORIALS.find((e) => e.tutorial.id === TOUR_ID).tutorial).length;
        const step = Math.min(4, n);
        // Another tab forward first, so "brought forward" is observable.
        const item = ui.item();
        const sibling = item?.parentItem?.contentItems.find((c) => c !== item);
        if (sibling) item.parentItem.setActiveComponentItem(sibling, false);
        const started = await ui.startRequest({ id: TOUR_ID, index: step - 1 });
        tc.reportCondition(`?tutorial=${TOUR_ID}&tutorialStep=${step} starts the tutorial`, started && ui.tutorial?.id === TOUR_ID);
        tc.reportCondition(`… at step ${step} (the panel reads "Step ${step} of ${n}")`,
            ui.root.querySelector(`.${CONTROLS.position}`)?.textContent === `Step ${step} of ${n}`);
        tc.reportCondition('… with the panel forward, in a stack of its own', isSplit(ui.item())
            && ui.item().parentItem.getActiveComponentItem() === ui.item());
        ui.exit();
        const unknown = await ui.startRequest({ id: 'no-such-tutorial', index: 0 });
        tc.reportCondition('an unknown id starts nothing and the list names it', !unknown && !ui.tutorial
            && (ui.root.querySelector(`.${CONTROLS.list} .${CONTROLS.status}`)?.textContent ?? '').includes('no-such-tutorial'));
    } finally {
        ui.notice = null;
        await restore(ui, settings);
        restoreActiveTabs(tabs);
    }
    return tc.getOverallResult();
}

/**
 * A tutorial's WALK row: every step performed with the panel's Do it (an
 * outside step: its stand-in), each `done` waited for, and the result graded
 * by the ratchet against the tutorial's record (tutorialWalk.js).
 */
async function tutorialWalkRow(tc, tutorial) {
    const settings = await savedSettings();
    const tabs = activeTabs();
    const ctx = buildContext({ eventBus });
    const before = ctx.rulesSource();
    const pipelineSetup = readPipelineSetup();
    const ui = await freshPanel(tc, { autoAdvance: false, animateCursor: false, showOutline: false });
    if (!ui) return tc.getOverallResult();
    try {
        ui.start(tutorial.id);
        const outcome = await walkTutorial(tutorial, {
            onStep: ({ index }) => ui._goTo(index),
            perform: async () => {
                if (!(await ui.doIt())) throw new Error(ui.lastError?.message ?? ui.status);
            },
            standIn: ({ step }) => step.standIn(ui.ctx),
            waitDone: async ({ step }) => {
                if (!step.done || ui.doneSteps.has(step.id)) return true;
                // A `failed` state ends the wait at once, with the app's own words.
                let failed = null;
                const ok = await waitFor(async () => {
                    if (ui.doneSteps.has(step.id) || await step.done(ui.ctx)) return true;
                    failed = step.failed ? (await step.failed(ui.ctx)) || null : null;
                    return Boolean(failed);
                }, step.doneTimeoutMs ?? DEFAULT_DONE_TIMEOUT_MS, 250);
                if (failed) throw new Error(`the app shows it cannot finish: ${failed}`);
                return Boolean(ok);
            },
        });
        if (outcome.end !== 'complete') {
            // What the app showed when the walk ended, so a red row needs no rerun to read.
            const bot = document.querySelector('.playback-bot .playback-bot-status')?.textContent.trim();
            tc.log?.(`walk ended at ${outcome.stepId}: panel status "${ui.status}"; rulesSource ${JSON.stringify(ui.ctx.rulesSource())}`
                + (bot ? `; Playback Bot status "${bot}"` : ''));
        }
        const verdict = ratchetVerdict(tutorial, outcome);
        tc.log?.(`${tutorial.id}: ${verdict.message}`);
        tc.reportCondition(`${tutorial.id} — ${verdict.message}`, verdict.ok);
    } finally {
        await restore(ui, settings);
        restoreActiveTabs(tabs);
        restorePipelineSetup(pipelineSetup, tc);
        if (typeof before === 'string' && before.startsWith('./presets/') && ctx.rulesSource() !== before) {
            try { await ctx.loadRulesPath(before); } catch (e) { tc.log?.(`could not reload ${before}: ${e.message}`); }
        }
        ctx.dispose();
    }
    return tc.getOverallResult();
}

// The Procgen Pipeline auto-saves its setup, and the procgen tutorials change
// it (and end with its Reset panel). A row puts back what the page had.
const PIPELINE_SETUP_KEY = 'procgenPipeline_params';

function readPipelineSetup() {
    try { return localStorage.getItem(PIPELINE_SETUP_KEY); } catch { return null; }
}

function restorePipelineSetup(saved, tc) {
    try {
        if (readPipelineSetup() === saved) return;
        if (saved === null) localStorage.removeItem(PIPELINE_SETUP_KEY);
        else localStorage.setItem(PIPELINE_SETUP_KEY, saved);
        const panel = document.querySelector('.procgen-pipeline-panel')?.__panel;
        if (panel) {
            panel._loadFromLocalStorage();
            panel.render();
        }
    } catch (e) {
        tc.log?.(`could not restore the Procgen Pipeline's setup: ${e.message}`);
    }
}

const TESTS = [
    ['tutorial-panel-lists-every-tutorial', 'Tutorial: the list shows every tutorial',
        'Every tutorial in content/index.js passes the shape validator and has a card, in order, with a Start button; '
        + 'the list links to Quick Launch.',
        tutorialPanelListsEveryTutorial],
    ['tutorial-start-splits-and-merge-restores', 'Tutorial: Start splits the column, Merge restores it',
        'The panel shares its stack until a tutorial starts; Start moves it into tutorial-stack under the stack it came '
        + 'from; Merge puts it back and the column collapses; Split splits again; All tutorials merges and shows the list.',
        tutorialStartSplitsAndMergeRestores],
    ['tutorial-cursor-and-outline-reach-tabs', 'Tutorial: the cursor reaches an overflowed tab; the outline follows its target',
        'Activates a tab that sits in its stack\'s ▾ overflow list with the animated cursor (the cursor appears, the tab '
        + 'becomes active, the list closes); the outline is drawn around a tab and removed.',
        tutorialCursorAndOutlineReachTabs],
    ['tutorial-url-request-starts-the-tutorial', 'Tutorial: ?tutorial=<id>&tutorialStep=<n> starts it',
        'The request a ?tutorial= URL makes (startRequest; the parser is a unit row) brings the panel forward, starts the '
        + 'tutorial at the 1-based step and splits; an unknown id starts nothing and the list names it.',
        tutorialUrlRequestStartsTheTutorial],
    ['tutorial-guided-tour-plays-every-step', 'Tutorial: Play performs every step of the Guided Tour',
        'Starts the Guided Tour and presses Play (auto-advance, no animation): every step the panel walks (read off the '
        + 'tutorial data) is performed and its done check turns true, ending on "Finished.". Reloads the world loaded before.',
        tutorialGuidedTourPlaysEveryStep],
];

for (const [id, name, description, testFunction] of TESTS) {
    registerTest({
        id,
        name,
        description,
        testFunction,
        category: CATEGORY,
        enabled: false, // runs where a roster enrols it (the substrates config)
    });
}

// One walk row per tutorial (tutorials.test.js checks the roster enrols each).
for (const { tutorial } of TUTORIALS) {
    registerTest({
        id: walkId(tutorial.id),
        name: `Tutorial walk: ${tutorial.title}`,
        description: `Performs every step of "${tutorial.title}" with Do it (outside steps: their stand-in) and grades `
            + `the result by its record (${tutorial.status === 'ready' ? 'ready: every step must work'
                : `in progress: firstFailingStep ${tutorial.firstFailingStep ?? 'null'}`}). Reloads the world loaded before.`,
        // Named per row: the registry tells test functions apart by name.
        testFunction: { [`walk_${tutorial.id.replace(/-/g, '_')}`]: (tc) => tutorialWalkRow(tc, tutorial) }[`walk_${tutorial.id.replace(/-/g, '_')}`],
        category: WALK_CATEGORY,
        enabled: false,
    });
}
