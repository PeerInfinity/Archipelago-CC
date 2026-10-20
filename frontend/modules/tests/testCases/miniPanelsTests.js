/**
 * In-app tests for the mini row (modules/miniPanels) and its Quick Launch section.
 *
 * ⛓ Every row drives the live default layout through the miniPanels module's public functions or the
 * Quick Launch section's own buttons, and reads the result off Golden Layout (`mini-row:` stacks) and the DOM.
 *
 * ⚖ Every row SETS the state it expects at its start (all mini wishes off, the row locked) and puts it back in
 * `finally`, so no row owes its precondition to the row before it (feedback: in-app tests set their own state).
 * The wishes are saved to localStorage (`miniPanels_state`); the reset writes them back to the defaults.
 */
import { registerTest } from '../testRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';

const CATEGORY = 'Mini Panels';
const TIMEOUT_MS = 20000;
const POLL_MS = 100;
/** A mini row is "fitted" when its stack is no taller than this (one or two rows of content, no header). */
const FITTED_MAX_PX = 90;

const mini = (name) => centralRegistry.getPublicFunction('miniPanels', name);
const state = () => mini('getState')();

function tabItem(componentType) {
    const items = window.goldenLayoutInstance?.getAllContentItems?.() ?? [];
    return items.find((it) => it.isComponent && it.componentType === componentType) ?? null;
}

const miniStackOf = (componentType) => {
    const stack = tabItem(componentType)?.parentItem;
    return stack?.isStack && typeof stack.id === 'string' && stack.id.startsWith('mini-row:') ? stack : null;
};

const anyMiniStack = () => (window.goldenLayoutInstance?.getAllContentItems?.() ?? [])
    .some((it) => it.isStack && typeof it.id === 'string' && it.id.startsWith('mini-row:'));

async function resetMini(testController) {
    const available = typeof mini('getState') === 'function';
    testController.reportCondition('the miniPanels module is loaded', available);
    if (!available) return false;
    await mini('setBotMini')(false);
    await mini('setChecksOn')(false);
    await mini('setLocked')(true);
    const clean = await testController.pollForCondition(
        () => !anyMiniStack() && state().bot !== 'mini' && state().checks === 'off',
        'the mini row to be empty', TIMEOUT_MS, POLL_MS);
    testController.reportCondition('start: no mini row, bot not mini, Checks off', clean);
    return clean;
}

async function checksThenBotThenExpand(testController) {
    if (!await resetMini(testController)) return testController.getOverallResult();
    try {
        await mini('setChecksOn')(true);
        const checksRow = await testController.pollForCondition(
            () => miniStackOf('checksPanel') !== null
                && /^Checked: \d+\/\d+/.test(document.querySelector('.checks-panel-content')?.textContent ?? ''),
            'the Checks panel in a mini row, showing the line', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('Checks alone: its own mini row with the "Checked:" line', checksRow);
        const fitted = await testController.pollForCondition(
            () => (miniStackOf('checksPanel')?.element?.offsetHeight ?? 999) <= FITTED_MAX_PX,
            'the Checks row fitted to its content', TIMEOUT_MS, POLL_MS);
        testController.reportCondition(`the Checks row is fitted (≤ ${FITTED_MAX_PX}px)`, fitted);

        await mini('setBotMini')(true);
        const botRow = await testController.pollForCondition(
            () => miniStackOf('playbackBotPanel') !== null
                && document.querySelector('.playback-bot-panel')?.classList.contains('pb-mini'),
            'the Playback Bot in a mini row, in its mini view', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the bot goes mini: its own row, mini view', botRow);
        const merged = await testController.pollForCondition(
            () => tabItem('checksPanel') === null
                && /^Checked: /.test(document.querySelector('.pb-mini-checks:not([hidden])')?.textContent ?? ''),
            'the checks line inside the bot\'s mini row, the Checks panel gone', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('both on: the line rides in the bot\'s row and the Checks panel is taken out', merged);
        testController.assertEqual('state.checks', 'in-bot', state().checks);
        const botFitted = await testController.pollForCondition(
            () => (miniStackOf('playbackBotPanel')?.element?.offsetHeight ?? 999) <= FITTED_MAX_PX,
            'the bot row fitted to its content', TIMEOUT_MS, POLL_MS);
        testController.reportCondition(`the bot row is fitted (≤ ${FITTED_MAX_PX}px)`, botFitted);

        document.querySelector('.pb-mini-expand')?.click();
        const expanded = await testController.pollForCondition(
            () => state().bot === 'full' && miniStackOf('playbackBotPanel') === null
                && !document.querySelector('.playback-bot-panel')?.classList.contains('pb-mini'),
            'the bot back to full after ⤢', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('⤢ expands the bot back into a full panel', expanded);
        const checksBack = await testController.pollForCondition(
            () => miniStackOf('checksPanel') !== null, 'the Checks panel back in its own row', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('with the bot full again, Checks has its own row again', checksBack);
    } finally {
        await resetMini(testController);
    }
    return testController.getOverallResult();
}

async function lockedAndDraggable(testController) {
    if (!await resetMini(testController)) return testController.getOverallResult();
    try {
        await mini('setBotMini')(true);
        const locked = await testController.pollForCondition(
            () => miniStackOf('playbackBotPanel')?.headerShow === false, 'a headerless (locked) mini stack', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('locked: the bot\'s mini stack has no tab header', locked);

        await mini('setLocked')(false);
        const draggable = await testController.pollForCondition(
            () => !!miniStackOf('playbackBotPanel')?.headerShow
                && document.querySelector('.playback-bot-panel')?.classList.contains('pb-mini'),
            'a mini stack with a tab header', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('draggable: the same panel, still mini, now under a tab header', draggable);

        await mini('setLocked')(true);
        const relocked = await testController.pollForCondition(
            () => miniStackOf('playbackBotPanel')?.headerShow === false, 'headerless again', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('locked again: no tab header', relocked);
    } finally {
        await resetMini(testController);
    }
    return testController.getOverallResult();
}

async function quickLaunchSectionSwitches(testController) {
    if (!await resetMini(testController)) return testController.getOverallResult();
    const row = (key) => document.querySelector(`.quick-launch-panel .ql-mini-row[data-mini="${key}"]`);
    try {
        const drawn = await testController.pollForCondition(
            () => ['checks', 'bot', 'tutorial', 'locked'].every((k) => row(k)), 'the Mini panels rows', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the Mini panels section draws Checks, Playback Bot, Tutorial and Mini row', drawn);
        if (!drawn) return testController.getOverallResult();
        testController.assertEqual('Checks row state', 'off', row('checks').dataset.state);

        row('checks').querySelector('.ql-mini-toggle').click();
        const on = await testController.pollForCondition(
            () => row('checks')?.dataset.state === 'own-row' && miniStackOf('checksPanel') !== null,
            'Checks on through its Quick Launch button', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the Checks button turns Checks on (own row) and the row says so', on);

        row('bot').querySelector('.ql-mini-toggle').click();
        const botMini = await testController.pollForCondition(
            () => row('bot')?.dataset.state === 'mini' && row('checks')?.dataset.state === 'in-bot',
            'the bot mini through its Quick Launch button', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the Playback Bot button makes it mini; the Checks row reads "in the bot\'s row"', botMini);

        const tutorialBefore = row('tutorial').dataset.state;
        if (tutorialBefore !== 'closed') {
            row('tutorial').querySelector('.ql-mini-toggle').click();
            const flipped = await testController.pollForCondition(
                () => row('tutorial')?.dataset.state === (tutorialBefore === 'split' ? 'merged' : 'split'),
                'the Tutorial split/merge through its Quick Launch button', TIMEOUT_MS, POLL_MS);
            testController.reportCondition('the Tutorial button splits / merges it', flipped);
            row('tutorial')?.querySelector('.ql-mini-toggle')?.click();   // back as it was
            await testController.pollForCondition(() => row('tutorial')?.dataset.state === tutorialBefore,
                'the Tutorial back as it was', TIMEOUT_MS, POLL_MS);
        }
    } finally {
        await resetMini(testController);
    }
    return testController.getOverallResult();
}

const TESTS = [
    ['mini-panels-checks-then-bot-then-expand', 'Mini panels: Checks, then the bot, then ⤢',
        'Checks on: the Checks panel in a fitted mini row of its own. The bot mini too: the bot\'s fitted mini row shows the '
        + 'checks line and the Checks panel is taken out. ⤢ in the bot\'s row: the bot is a full panel again and Checks '
        + 'gets its own row back. Ends with everything off.',
        checksThenBotThenExpand],
    ['mini-panels-locked-and-draggable', 'Mini panels: locked and draggable',
        'The bot mini in a locked row has no tab header; draggable re-creates its stack with one (the same panel, still '
        + 'mini); locked again removes it.',
        lockedAndDraggable],
    ['mini-panels-quick-launch-section', 'Mini panels: the Quick Launch section switches them',
        'The Quick Launch panel\'s Mini panels section draws a row each for Checks, Playback Bot, Tutorial and Mini row; '
        + 'its buttons turn Checks on, make the bot mini (Checks then reads "in the bot\'s row") and split / merge the '
        + 'Tutorial (put back as it was).',
        quickLaunchSectionSwitches],
];

for (const [id, name, description, testFunction] of TESTS) {
    registerTest({
        id,
        name,
        description,
        testFunction,
        category: CATEGORY,
        enabled: false, // runs where a roster enrols it (the regression config)
    });
}
