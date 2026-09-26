/**
 * In-app tests for the Quick Launch panel (enrolled in the regression roster).
 *
 * ⛓ Every expectation is read off the live app at run time — the registry's
 * panel components, the module states, the generated docs index — never typed.
 *
 * ⛓ The panel is the first tab of the default layout's left stack and is
 * mounted at boot, so these rows find its DOM directly. ⛔ They never publish
 * `ui:activatePanel`: the panel's own buttons are what is under test.
 *
 * ⛓ Each row leaves the layout as it found it: the activation row restores the
 * stack's previously active tab; the reopen row ends with Events open again.
 *
 * ⚖ RULED (the user, 2026-09-26): every row SETS the state it expects at its
 * start and cleans up after itself. `panelRoot` — the first call of every
 * panel row — runs `resetQuickLaunch` before it waits for the buttons, and
 * every row that changes anything runs it again in `finally`. The state:
 * the real dialogs, the filter box empty, the fold button at "Collapse all",
 * showDeveloperDocs false, the view tree, collapsedGroups [], edit mode off,
 * the tree EMPTY_TREE. So no row owes its precondition to the row before it,
 * and each passes alone.
 *
 * Handles (quick-launch Q1 W0 (e)): a panel is closed the way its × does with
 * `window.panelManager.destroyPanelByComponentType(type)` (it fires Golden
 * Layout's itemDestroyed → `ui:panelManuallyClosed` → the module is disabled);
 * a tab is found with `window.goldenLayoutInstance.getAllContentItems()`, the
 * call `panelManager.activatePanel` itself searches.
 */

import { registerTest } from '../testRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { CATEGORY_ORDER, DOCS_INDEX, HELP_SECTIONS } from '../../quickLaunch/generated/docsIndex.js';
import {
    OTHER_CATEGORY, VIRTUAL_GROUPS, buildCatalog, drawnHelpSections, lookupModuleInfo,
} from '../../quickLaunch/quickLaunchCatalog.js';
import { EMPTY_TREE, NODE_KINDS, refCounts } from '../../quickLaunch/quickLaunchTree.js';
import { completeModuleInfo } from '../../../app/initialization/completeModuleInfo.js';
import {
    COLLAPSED_KEY, COLLAPSED_SETTING, CONTROLS, DEVELOPER_DOCS_KEY, DEVELOPER_DOCS_SETTING, FOLD_DISABLED_TITLE, FOLD_TEXT,
    FOLD_TITLE, INLINE, MODULE_ID, ROOT_CHOICE, TREE_KEY, TREE_SETTING, VIEWS, VIEW_KEY, VIEW_SETTING, dialogs, filedText,
} from '../../quickLaunch/quickLaunchUI.js';
import { buildViewModel, countText, filterView } from '../../quickLaunch/quickLaunchFilter.js';

const CATEGORY = 'Quick Launch';
const MOUNT_TIMEOUT_MS = 10000;
const ACTION_TIMEOUT_MS = 10000;
const POLL_MS = 100;
const OPEN_TARGET = 'inventoryPanel';
const CLOSE_TARGET = 'eventsPanel';

/**
 * The panel's root, reset to the rows' initial state (`resetQuickLaunch`),
 * once it shows a button per registered panel; null if it never does.
 */
async function panelRoot(testController) {
    const expected = centralRegistry.getAllPanelComponents().size;
    const mounted = await testController.pollForCondition(
        () => document.querySelector('.quick-launch-panel'),
        'the Quick Launch panel to be mounted',
        MOUNT_TIMEOUT_MS,
        POLL_MS,
    );
    if (mounted) await resetQuickLaunch(testController, document.querySelector('.quick-launch-panel'));
    const ready = mounted && await testController.pollForCondition(
        () => document.querySelectorAll('.quick-launch-panel .ql-panel').length === expected,
        `Quick Launch panel to show ${expected} panel buttons`,
        MOUNT_TIMEOUT_MS,
        POLL_MS,
    );
    testController.reportCondition('Quick Launch panel is mounted with every panel button', ready);
    return ready ? document.querySelector('.quick-launch-panel') : null;
}

/** The layout's component item for `componentType`, or null. */
function tabItem(componentType) {
    const items = window.goldenLayoutInstance?.getAllContentItems?.() ?? [];
    return items.find((it) => it.isComponent && it.componentType === componentType) ?? null;
}

const isActiveTab = (item) => !!item?.parent?.getActiveComponentItem && item.parent.getActiveComponentItem() === item;
const moduleEnabled = (moduleId) => window.moduleManagerApi?.getAllModuleStates?.()?.[moduleId]?.enabled === true;
const rowButton = (root, componentType) => root.querySelector(`.ql-panel[data-component-type="${componentType}"]`);
/** The doc paths Help draws with showDeveloperDocs at its default (off), read off the generated sections. */
const drawnDocPaths = (showDeveloperDocs = false) => drawnHelpSections(HELP_SECTIONS, showDeveloperDocs)
    .flatMap((s) => [...s.docs, ...s.children.flatMap((c) => c.docs)]);

async function quickLaunchListsEveryRegisteredPanel(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();

    const expected = [...centralRegistry.getAllPanelComponents().keys()];
    testController.log(`registry: ${expected.length} panel components`);
    const drawn = new Set([...root.querySelectorAll('.ql-panel')].map((b) => b.dataset.componentType));
    testController.assertEqual('panel buttons == getAllPanelComponents().size', expected.length, drawn.size);
    testController.assertEqual('every componentType has a button (missing)', '',
        expected.filter((ct) => !drawn.has(ct)).join(', '));
    testController.reportCondition('the panel lists itself', drawn.has('quickLaunchPanel'));

    const header = root.querySelector('.ql-header')?.textContent ?? '';
    testController.assertEqual('header counts the registry and the docs Help draws',
        `${expected.length} panels · ${drawnDocPaths().length} docs`, header);
    return testController.getOverallResult();
}

async function quickLaunchButtonActivatesOpenPanel(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const item = tabItem(OPEN_TARGET);
    testController.reportCondition(`${OPEN_TARGET} has a tab`, item !== null);
    if (!item) return testController.getOverallResult();

    const stack = item.parent;
    const before = stack.getActiveComponentItem();
    try {
        if (before === item) {
            // Make the click observable: bring a sibling forward first.
            const sibling = stack.contentItems.find((c) => c !== item);
            testController.reportCondition(`${OPEN_TARGET}'s stack has another tab`, !!sibling);
            if (!sibling) return testController.getOverallResult();
            stack.setActiveComponentItem(sibling);
        }
        testController.reportCondition(`${OPEN_TARGET} is not the active tab before the click`, !isActiveTab(item));
        const button = rowButton(root, OPEN_TARGET);
        testController.reportCondition(`${OPEN_TARGET} has a button`, button !== null);
        button?.click();
        const active = await testController.pollForCondition(
            () => isActiveTab(tabItem(OPEN_TARGET)),
            `${OPEN_TARGET} to become the active tab of its stack`,
            ACTION_TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition(`clicking its button brings ${OPEN_TARGET} forward`, active);
    } finally {
        if (before && before.parent === stack) stack.setActiveComponentItem(before);
    }
    return testController.getOverallResult();
}

async function quickLaunchButtonReopensClosedPanel(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const moduleId = centralRegistry.getAllPanelComponents().get(CLOSE_TARGET)?.moduleId;
    testController.reportCondition(`${CLOSE_TARGET} is registered`, !!moduleId);
    testController.reportCondition(`${CLOSE_TARGET} has a tab and is enabled at the start`,
        tabItem(CLOSE_TARGET) !== null && moduleEnabled(moduleId));
    if (!moduleId) return testController.getOverallResult();

    try {
        await window.panelManager.destroyPanelByComponentType(CLOSE_TARGET);
        const disabled = await testController.pollForCondition(
            () => !moduleEnabled(moduleId) && tabItem(CLOSE_TARGET) === null,
            `${moduleId} to be disabled after its tab is closed`,
            ACTION_TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('closing the tab disables the module', disabled);
        const dotOff = await testController.pollForCondition(
            () => rowButton(root, CLOSE_TARGET)?.querySelector('.ql-dot.ql-off') != null,
            `${CLOSE_TARGET}'s dot to show closed`,
            ACTION_TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('the row\'s dot follows the close', dotOff);

        rowButton(root, CLOSE_TARGET)?.click();
        const reopened = await testController.pollForCondition(
            () => moduleEnabled(moduleId) && tabItem(CLOSE_TARGET) !== null,
            `${moduleId} to be enabled with a tab again`,
            ACTION_TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('clicking its button reopens the panel', reopened);
        const dotOn = await testController.pollForCondition(
            () => rowButton(root, CLOSE_TARGET)?.querySelector('.ql-dot.ql-on') != null,
            `${CLOSE_TARGET}'s dot to show open`,
            ACTION_TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('the row\'s dot follows the reopen', dotOn);
    } finally {
        // A failed reopen must not leave Events closed for the rows after this one.
        if (tabItem(CLOSE_TARGET) === null) {
            await window.moduleManagerApi?.enableModule?.(moduleId);
            await testController.pollForCondition(() => tabItem(CLOSE_TARGET) !== null,
                `${CLOSE_TARGET} open again (cleanup)`, ACTION_TIMEOUT_MS, POLL_MS);
        }
    }
    return testController.getOverallResult();
}

async function quickLaunchDocLinksResolveToIndex(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const paths = DOCS_INDEX.map((d) => d.path);
    const links = [...root.querySelectorAll('.ql-doc a, .ql-help a')];
    const helpLinks = root.querySelectorAll('.ql-help a').length;
    testController.log(`${links.length} doc links (${helpLinks} in Help); index has ${paths.length}, Help draws ${drawnDocPaths().length}`);
    testController.assertEqual('Help has one link per doc its sections draw', drawnDocPaths().length, helpLinks);
    testController.reportCondition('some panel row carries a ? link', root.querySelectorAll('.ql-doc a').length > 0);
    const unresolved = links.filter((a) => !paths.some((p) => a.href.endsWith(p))).map((a) => a.href);
    testController.assertEqual('every doc href ends with a DOCS_INDEX path (unresolved)', '', unresolved.join(', '));
    const sameTab = links.filter((a) => a.target !== '_blank').map((a) => a.href);
    testController.assertEqual('every doc link opens a new tab (target != _blank)', '', sameTab.join(', '));
    return testController.getOverallResult();
}

// ── Q2: the stored tree ───────────────────────────────────────────────────

const clone = (v) => JSON.parse(JSON.stringify(v));
const writeTree = (tree) => settingsManager.updateModuleSetting(MODULE_ID, TREE_KEY, clone(tree));
const readTree = () => settingsManager.getSetting(TREE_SETTING, EMPTY_TREE);
const withoutIds = (nodes) => nodes.map(({ id, children, ...rest }) => (
    children ? { ...rest, children: withoutIds(children) } : rest));
const topGroupIds = (root) => [...root.querySelectorAll(':scope > .ql-groups > details')].map((d) => d.dataset.groupId);
const userGroup = (root, label) => [...root.querySelectorAll('.ql-user')]
    .find((d) => d.querySelector(':scope > summary')?.textContent.startsWith(`${label} (`)) ?? null;

/** Type `text` into an inline form's input and press Enter, as a person would. */
function typeAndEnter(input, text) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

/** Choose `value` in a "move to" / "add to" select, as a person would. */
function pick(select, value) {
    select.value = value;
    select.dispatchEvent(new Event('change'));
}

/** The dialogs as the module defines them, captured at import: every reset puts these back. */
const REAL_DIALOGS = { ...dialogs };
const foldButton = (root) => root?.querySelector(`.${CONTROLS.fold}`);

/**
 * ⚖ RULED (5): put the panel in the state every row starts from and ends in —
 * the real dialogs, the filter box empty, the fold button at "Collapse all",
 * showDeveloperDocs false, the view tree, collapsedGroups [], edit mode off,
 * the tree EMPTY_TREE — and wait until the panel draws it. The filter is
 * cleared FIRST: the fold button is disabled while it has text.
 */
async function resetQuickLaunch(testController, root) {
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    Object.assign(dialogs, REAL_DIALOGS);
    if (root?.querySelector(`.${CONTROLS.filter}`)?.value) typeFilter(root, '');
    await until(() => foldButton(root) && !foldButton(root).disabled, 'the fold button enabled (the filter empty)');
    // "Expand all" writes collapsedGroups [] and opens everything — the state written below anyway.
    if (foldButton(root)?.textContent === FOLD_TEXT.expand) foldButton(root).click();
    await settingsManager.updateModuleSetting(MODULE_ID, DEVELOPER_DOCS_KEY, false);
    await settingsManager.updateModuleSetting(MODULE_ID, VIEW_KEY, VIEWS.tree);
    await settingsManager.updateModuleSetting(MODULE_ID, COLLAPSED_KEY, []);
    const edit = root?.querySelector(`.${CONTROLS.edit}`);
    if (edit?.getAttribute('aria-pressed') === 'true') edit.click();
    await writeTree(EMPTY_TREE);
    await until(
        () => root && !root.querySelector('.ql-root, .ql-ctl, .ql-desc') && !root.classList.contains('ql-cards')
            && foldButton(root)?.textContent === FOLD_TEXT.collapse
            && !root.querySelector(`details[data-group-id^="${VIRTUAL_GROUPS.help.id}/developer"]`),
        'Quick Launch back at its initial state (empty tree, tree view, no edit controls, "Collapse all", no developer section)',
    );
}

async function quickLaunchEmptyTreeRendersAsQ1(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    try {
        await writeTree(EMPTY_TREE);
        const settled = await testController.pollForCondition(
            () => !root.querySelector('.ql-root'),
            'no stored section with an empty tree',
            ACTION_TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('an empty tree draws no stored section (.ql-root)', settled);
        testController.assertEqual('the sections are exactly the two Q1 virtual groups',
            [VIRTUAL_GROUPS.allPanels.id, VIRTUAL_GROUPS.help.id].join(','), topGroupIds(root).join(','));
        testController.reportCondition('no Unfiled group while the tree is empty',
            !root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.unfiled.id}"]`));
        testController.assertEqual('header counts the registry and the docs Help draws',
            `${centralRegistry.getAllPanelComponents().size} panels · ${drawnDocPaths().length} docs`,
            root.querySelector('.ql-header')?.textContent ?? '');
        testController.assertEqual('no edit controls outside edit mode', 0, root.querySelectorAll('.ql-ctl').length);
        testController.assertEqual('the Edit button is not pressed', 'false',
            root.querySelector(`.${CONTROLS.edit}`)?.getAttribute('aria-pressed'));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchEditOpsPersist(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    dialogs.confirm = () => true;
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    /** Click "+ group" at the top level and type the name into the inline input it opens. */
    const addTopGroup = async (label) => {
        root.querySelector(`.ql-root-ctl .${CONTROLS.addGroup}`).click();
        // pollForCondition answers true/false, not the element: query it again once it is there.
        const opened = await until(() => root.querySelector(`.${INLINE.group}`), 'the inline group-name input');
        const input = opened ? root.querySelector(`.${INLINE.group}`) : null;
        testController.reportCondition(`"+ group" opens an inline name input (for "${label}")`, !!input);
        if (input) typeAndEnter(input, label);
    };
    const docPath = drawnDocPaths()[0];
    const docRow = () => [...root.querySelectorAll(`details[data-group-id="${VIRTUAL_GROUPS.help.id}"] .ql-help`)]
        .find((li) => li.querySelector('a')?.title === docPath) ?? null;
    // All panels holds one sub-group per category (Q3): the row sits in whichever one Inventory declares.
    const invRow = () => root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.allPanels.id}"] `
        + `.ql-panel[data-component-type="${OPEN_TARGET}"]`)?.closest('li') ?? null;
    try {
        await writeTree(EMPTY_TREE);
        root.querySelector(`.${CONTROLS.edit}`)?.click();
        testController.reportCondition('Edit shows the top-level controls',
            await until(() => root.querySelector(`.ql-root-ctl .${CONTROLS.addGroup}`), 'the root "+ group" button'));

        await addTopGroup('Mine');
        testController.reportCondition('"+ group" adds the group', await until(() => userGroup(root, 'Mine'), 'group "Mine"'));
        const mine = userGroup(root, 'Mine').dataset.groupId;

        pick(invRow().querySelector(`.${CONTROLS.addTo}`), mine);
        await until(() => userGroup(root, 'Mine')?.querySelectorAll('.ql-node').length === 1, 'Inventory filed in Mine');
        pick(docRow().querySelector(`.${CONTROLS.addTo}`), mine);
        await until(() => userGroup(root, 'Mine')?.querySelectorAll('.ql-node').length === 2, 'the guide filed in Mine');
        pick(invRow().querySelector(`.${CONTROLS.addTo}`), ROOT_CHOICE);
        await until(() => root.querySelectorAll('.ql-root > .ql-node[data-kind="panel"]').length === 1,
            'a second Inventory at the top level');

        userGroup(root, 'Mine').querySelector(`.ql-node[data-kind="doc"] .${CONTROLS.up}`).click();
        await until(() => userGroup(root, 'Mine')?.querySelector('.ql-node')?.dataset.kind === 'doc', 'the guide moved up');

        userGroup(root, 'Mine').querySelector(`:scope > .ql-ctl-row .${CONTROLS.rename}`).click();
        const renaming = await until(() => root.querySelector(`.ql-user > summary > .${INLINE.rename}`), 'the inline rename input');
        const renameInput = renaming ? root.querySelector(`.ql-user > summary > .${INLINE.rename}`) : null;
        testController.reportCondition('✎ turns the label into an input holding it', renameInput?.value === 'Mine');
        if (renameInput) typeAndEnter(renameInput, 'Mine 2');
        testController.reportCondition('✎ renames the group', await until(() => userGroup(root, 'Mine 2'), 'group "Mine 2"'));

        await addTopGroup('Scratch');
        await until(() => userGroup(root, 'Scratch'), 'group "Scratch"');
        dialogs.confirm = () => false; // an EMPTY group must not ask
        userGroup(root, 'Scratch').querySelector(`:scope > .ql-ctl-row .${CONTROLS.remove}`).click();
        testController.reportCondition('✕ deletes an empty group without asking',
            await until(() => !userGroup(root, 'Scratch'), 'group "Scratch" gone'));

        const stored = await readTree();
        testController.assertEqual('the stored tree, minus ids', JSON.stringify([
            { kind: NODE_KINDS.group, label: 'Mine 2', children: [
                { kind: NODE_KINDS.doc, ref: docPath }, { kind: NODE_KINDS.panel, ref: OPEN_TARGET }] },
            { kind: NODE_KINDS.panel, ref: OPEN_TARGET },
        ]), JSON.stringify(withoutIds(stored?.nodes ?? [])));

        // Leaving edit mode renders again, from the setting.
        root.querySelector(`.${CONTROLS.edit}`).click();
        const shown = await until(() => !root.querySelector('.ql-ctl')
            && userGroup(root, 'Mine 2')?.querySelector(':scope > summary').textContent === 'Mine 2 (2)',
        'the read view to show "Mine 2 (2)"');
        testController.reportCondition('a fresh render shows the group and its two items', shown);
        testController.assertEqual('top-level order: the stored list, then Unfiled, All panels, Help',
            [VIRTUAL_GROUPS.unfiled.id, VIRTUAL_GROUPS.allPanels.id, VIRTUAL_GROUPS.help.id].join(','),
            topGroupIds(root).join(','));
        testController.reportCondition('the stored list comes first', root.querySelector('.ql-groups')?.firstElementChild?.classList.contains('ql-root'));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchUnfiledShowsUnreferenced(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    try {
        await writeTree({ version: 1, nodes: [{ id: 'filed-1', kind: NODE_KINDS.panel, ref: OPEN_TARGET }] });
        const sel = `details[data-group-id="${VIRTUAL_GROUPS.unfiled.id}"]`;
        const shown = await testController.pollForCondition(() => root.querySelector(sel),
            'the Unfiled group to appear', ACTION_TIMEOUT_MS, POLL_MS);
        testController.reportCondition('filing one panel shows Unfiled', !!shown);
        const unfiledEl = root.querySelector(sel);
        const expected = centralRegistry.getAllPanelComponents().size - 1 + drawnDocPaths().length;
        testController.assertEqual('Unfiled rows = registry panels - 1 + the docs Help draws', expected,
            unfiledEl?.querySelectorAll(':scope > .ql-list > li').length);
        testController.reportCondition('the filed panel is not in Unfiled',
            !unfiledEl?.querySelector(`.ql-panel[data-component-type="${OPEN_TARGET}"]`));
        testController.assertEqual('Unfiled comes right after the stored list', VIRTUAL_GROUPS.unfiled.id,
            topGroupIds(root)[0]);
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchDuplicateRefsBothActivate(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const item = tabItem(OPEN_TARGET);
    testController.reportCondition(`${OPEN_TARGET} has a tab`, item !== null);
    if (!item) return testController.getOverallResult();
    const stack = item.parent;
    const before = stack.getActiveComponentItem();
    const sibling = stack.contentItems.find((c) => c !== item);
    testController.reportCondition(`${OPEN_TARGET}'s stack has another tab`, !!sibling);
    try {
        await writeTree({ version: 1, nodes: [
            { id: 'dup-a', kind: NODE_KINDS.panel, ref: OPEN_TARGET },
            { id: 'dup-g', kind: NODE_KINDS.group, label: 'Dup', children: [
                { id: 'dup-b', kind: NODE_KINDS.panel, ref: OPEN_TARGET }] },
        ] });
        const both = await testController.pollForCondition(
            () => root.querySelectorAll('.ql-root .ql-node[data-kind="panel"] .ql-panel').length === 2,
            'two stored Inventory rows', ACTION_TIMEOUT_MS, POLL_MS);
        testController.reportCondition('both references render', both);
        for (const nodeId of ['dup-a', 'dup-b']) {
            if (sibling) stack.setActiveComponentItem(sibling);
            testController.reportCondition(`${OPEN_TARGET} is in the background before clicking ${nodeId}`,
                !isActiveTab(tabItem(OPEN_TARGET)));
            root.querySelector(`.ql-node[data-node-id="${nodeId}"] .ql-panel`)?.click();
            const active = await testController.pollForCondition(
                () => isActiveTab(tabItem(OPEN_TARGET)),
                `${OPEN_TARGET} to become active after clicking ${nodeId}`, ACTION_TIMEOUT_MS, POLL_MS);
            testController.reportCondition(`clicking ${nodeId} brings ${OPEN_TARGET} forward`, active);
        }
    } finally {
        if (before && before.parent === stack) stack.setActiveComponentItem(before);
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

// ── Q3: categories, the cards view, the filter, collapsed groups ─────────

const summaryLabel = (details) => details.querySelector(':scope > summary')?.textContent.replace(/ \(\d+\)$/, '') ?? '';
const allPanelsEl = (root) => root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.allPanels.id}"]`);
/** The registry's moduleInfo for `componentType`, through the panel's own lookup order. */
const infoOf = (componentType) => lookupModuleInfo(componentType, centralRegistry.getAllPanelComponents().get(componentType)) || {};

/** Type into the filter box as a person does. */
function typeFilter(root, text) {
    const input = root.querySelector(`.${CONTROLS.filter}`);
    input.value = text;
    input.dispatchEvent(new Event('input'));
}

async function quickLaunchCategoriesGroupEveryPanel(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    try {
        await writeTree(EMPTY_TREE);
        // The categories present, read off the registry: a declared one CATEGORY_ORDER lists, else Other.
        const registry = centralRegistry.getAllPanelComponents();
        const expected = new Set([...registry.keys()].map((ct) => {
            const c = infoOf(ct).category;
            return CATEGORY_ORDER.includes(c) ? c : OTHER_CATEGORY;
        }));
        testController.log(`registry: ${registry.size} panels in ${expected.size} categories`);
        const all = allPanelsEl(root);
        testController.reportCondition('All panels is drawn', !!all);
        if (!all) return testController.getOverallResult();
        const subs = [...all.querySelectorAll(':scope > .ql-subgroups > details')];
        const labels = subs.map(summaryLabel);
        testController.assertEqual('sub-group labels == the categories present in the registry',
            [...expected].sort().join(' | '), [...labels].sort().join(' | '));
        testController.assertEqual('sub-groups follow CATEGORY_ORDER, Other last',
            [...CATEGORY_ORDER, OTHER_CATEGORY].filter((c) => expected.has(c)).join(' | '), labels.join(' | '));
        const buttons = [...all.querySelectorAll('.ql-panel')];
        testController.assertEqual('All panels holds one button per registered panel', registry.size, buttons.length);
        const misplaced = buttons.filter((b) => {
            const label = summaryLabel(b.closest('details'));
            const c = infoOf(b.dataset.componentType).category;
            return label !== (CATEGORY_ORDER.includes(c) ? c : OTHER_CATEGORY);
        }).map((b) => b.dataset.componentType);
        testController.assertEqual('every panel sits under its own category (misplaced)', '', misplaced.join(', '));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchCardsViewShowsDescriptions(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    try {
        await writeTree(EMPTY_TREE);
        const toggle = root.querySelector(`.${CONTROLS.view}`);
        testController.reportCondition('the bar has a view toggle', !!toggle);
        testController.assertEqual('the toggle starts unpressed (tree view)', 'false', toggle?.getAttribute('aria-pressed'));
        toggle?.click();
        const cards = await until(() => root.classList.contains('ql-cards') && root.querySelector('.ql-card'), 'the cards view');
        testController.reportCondition('clicking the toggle switches to cards', !!cards);
        testController.assertEqual('the view setting is cards', VIEWS.cards, await settingsManager.getSetting(VIEW_SETTING));
        testController.assertEqual('the toggle reads pressed', 'true', toggle?.getAttribute('aria-pressed'));
        const buttons = [...allPanelsEl(root).querySelectorAll('.ql-panel')];
        const described = buttons.filter((b) => infoOf(b.dataset.componentType).description);
        testController.log(`${described.length} of ${buttons.length} panel cards have a moduleInfo.description`);
        testController.reportCondition('some panel declares a description', described.length > 0);
        const wrong = described.filter((b) => b.querySelector('.ql-desc')?.textContent !== infoOf(b.dataset.componentType).description)
            .map((b) => b.dataset.componentType);
        testController.assertEqual('every described panel card shows its description (wrong)', '', wrong.join(', '));
        toggle?.click();
        const back = await until(() => !root.classList.contains('ql-cards') && !root.querySelector('.ql-desc'), 'the tree view');
        testController.reportCondition('clicking again returns to the tree view', !!back);
        testController.assertEqual('the view setting is tree', VIEWS.tree, await settingsManager.getSetting(VIEW_SETTING));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchFilterKeepsAncestorsOpen(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const group = () => root.querySelector('details[data-group-id="flt-g"]');
    try {
        await writeTree({ version: 1, nodes: [{ id: 'flt-g', kind: NODE_KINDS.group, label: 'Filtered', children: [
            { id: 'flt-inv', kind: NODE_KINDS.panel, ref: OPEN_TARGET },
            { id: 'flt-ev', kind: NODE_KINDS.panel, ref: CLOSE_TARGET }] }] });
        await settingsManager.updateModuleSetting(MODULE_ID, COLLAPSED_KEY, ['flt-g']);
        testController.reportCondition('the stored group is drawn collapsed',
            !!await until(() => group() && !group().open, 'group "Filtered" drawn, collapsed'));

        typeFilter(root, 'inv');
        const opened = await until(() => group()?.open
            && [...group().querySelectorAll('.ql-panel')].map((b) => b.dataset.componentType).join() === OPEN_TARGET,
        'the collapsed group open, holding only Inventory');
        testController.reportCondition('typing "inv" opens the group and shows only Inventory in it', !!opened);
        testController.reportCondition(`${CLOSE_TARGET} is drawn nowhere while filtering`,
            !root.querySelector(`.ql-panel[data-component-type="${CLOSE_TARGET}"]`));
        const shownTypes = new Set([...root.querySelectorAll('.ql-panel')].map((b) => b.dataset.componentType));
        testController.assertEqual('the only panel drawn is Inventory', OPEN_TARGET, [...shownTypes].join(','));
        testController.assertEqual('the filter does not touch the saved collapsed groups', JSON.stringify(['flt-g']),
            JSON.stringify(await settingsManager.getSetting(COLLAPSED_SETTING)));

        typeFilter(root, '');
        const closed = await until(() => group() && !group().open
            && group().querySelectorAll('.ql-panel').length === 2, 'the group collapsed again, both rows back');
        testController.reportCondition('clearing the filter restores the collapsed state', !!closed);
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchCollapsedGroupsPersist(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const group = () => root.querySelector('details[data-group-id="col-g"]');
    const tree = { version: 1, nodes: [{ id: 'col-g', kind: NODE_KINDS.group, label: 'Folding', children: [
        { id: 'col-inv', kind: NODE_KINDS.panel, ref: OPEN_TARGET }] }] };
    try {
        await settingsManager.updateModuleSetting(MODULE_ID, COLLAPSED_KEY, []);
        await writeTree(tree);
        testController.reportCondition('the stored group is drawn open',
            !!await until(() => group()?.open, 'group "Folding" drawn, open'));
        const first = group();
        first.querySelector(':scope > summary').click();
        const stored = await until(async () => {
            const v = await settingsManager.getSetting(COLLAPSED_SETTING);
            return Array.isArray(v) && v.join() === 'col-g';
        }, 'collapsedGroups to hold the group id');
        testController.reportCondition('collapsing the group through its summary saves its id', !!stored);

        // Re-render from the settings: a foreign write of the same tree redraws every element.
        await writeTree(tree);
        const redrawn = await until(() => group() && group() !== first, 'the group redrawn');
        testController.reportCondition('the panel re-rendered (a new element)', !!redrawn);
        testController.reportCondition('after the re-render the group is still collapsed', group()?.open === false);
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

// ── P6: Help sections from the docs tree, the fold button, the developer docs ──

const helpSection = (root, dir) => root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.help.id}/${dir}"]`);
const summaryCount = (details) => Number(details?.querySelector(':scope > summary')?.textContent.match(/\((\d+)\)$/)?.[1]);
const sectionDocCount = (s) => s.docs.length + s.children.reduce((n, c) => n + c.docs.length, 0);
const rowPaths = (details) => [...details.querySelectorAll(':scope > .ql-list > li.ql-help a')].map((a) => a.title);
async function quickLaunchHelpSectionsFollowTheDocsMarkers(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    try {
        await settingsManager.updateModuleSetting(MODULE_ID, DEVELOPER_DOCS_KEY, false);
        // Read off the generated module here, not through the panel's own filter.
        const expected = HELP_SECTIONS.filter((s) => s.audience === 'user');
        testController.log(`HELP_SECTIONS: ${HELP_SECTIONS.length} sections, ${expected.length} with audience user`);
        testController.reportCondition('the docs tree marks some user section', expected.length > 0);
        const drawn = await testController.pollForCondition(
            () => root.querySelectorAll(`details[data-group-id="${VIRTUAL_GROUPS.help.id}"] > .ql-subgroups > details`).length === expected.length,
            'Help to hold one sub-group per user section', ACTION_TIMEOUT_MS, POLL_MS);
        testController.reportCondition('Help holds one sub-group per user section', drawn);
        const helpEl = root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.help.id}"]`);
        const subs = [...helpEl.querySelectorAll(':scope > .ql-subgroups > details')];
        testController.assertEqual('the drawn section labels == HELP_SECTIONS (audience user), in order',
            expected.map((s) => s.label).join(' | '), subs.map(summaryLabel).join(' | '));
        testController.assertEqual('Help has no rows of its own', 0, helpEl.querySelectorAll(':scope > .ql-list').length);
        for (const section of expected) {
            const el = helpSection(root, section.dir);
            testController.reportCondition(`section ${section.dir} is drawn`, !!el);
            if (!el) continue;
            testController.assertEqual(`${section.label}: summary count`, sectionDocCount(section), summaryCount(el));
            const singles = section.children.filter((c) => c.single);
            testController.assertEqual(`${section.label}: rows = own docs, then each single sub-directory's doc`,
                [...section.docs, ...singles.flatMap((c) => c.docs)].join(' | '), rowPaths(el).join(' | '));
            const nested = section.children.filter((c) => !c.single);
            const nestedEls = [...el.querySelectorAll(':scope > .ql-subgroups > details')];
            testController.assertEqual(`${section.label}: sub-groups = the sub-directories holding more than one doc`,
                nested.map((c) => `${c.label} (${c.docs.length})`).join(' | '),
                nestedEls.map((d) => d.querySelector(':scope > summary').textContent).join(' | '));
            for (const child of nested) {
                const childEl = helpSection(root, child.dir);
                testController.assertEqual(`${child.label}: rows`, child.docs.join(' | '), childEl ? rowPaths(childEl).join(' | ') : '(not drawn)');
            }
        }
        testController.reportCondition('some section nests a sub-directory (the rule is exercised)',
            expected.some((s) => s.children.some((c) => !c.single)));
        testController.reportCondition('some sub-directory is a single row (the rule is exercised)',
            expected.some((s) => s.children.some((c) => c.single)));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchPanelGuidesNotListedInHelp(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    try {
        const panelGuides = new Set(HELP_SECTIONS.filter((s) => s.audience === 'panel').flatMap((s) => s.docs));
        testController.log(`${panelGuides.size} panel guides (audience panel)`);
        testController.reportCondition('the docs tree marks a panel section with guides', panelGuides.size > 0);
        const helpLinks = [...root.querySelectorAll(`details[data-group-id="${VIRTUAL_GROUPS.help.id}"] .ql-help a`)];
        const listed = helpLinks.filter((a) => [...panelGuides].some((p) => a.href.endsWith(p))).map((a) => a.title);
        testController.assertEqual('no Help row links a panel guide (listed)', '', listed.join(', '));
        const indexed = new Set(DOCS_INDEX.map((d) => d.path));
        const registry = [...centralRegistry.getAllPanelComponents().keys()];
        const withDocs = registry.filter((ct) => indexed.has(infoOf(ct).docs));
        testController.log(`${withDocs.length} of ${registry.length} panels declare an indexed guide`);
        testController.reportCondition('some panel declares a guide', withDocs.length > 0);
        const noMark = withDocs.filter((ct) => !rowButton(root, ct)?.closest('li')?.querySelector('.ql-doc a')?.href.endsWith(infoOf(ct).docs));
        testController.assertEqual('every panel row whose moduleInfo declares a guide shows its ? (missing)', '', noMark.join(', '));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchFoldButtonCollapsesThenExpands(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const details = () => [...root.querySelectorAll('.ql-groups details')];
    try {
        await settingsManager.updateModuleSetting(MODULE_ID, COLLAPSED_KEY, []);
        await writeTree({ version: 1, nodes: [
            { id: 'fold-a', kind: NODE_KINDS.group, label: 'Fold A', children: [
                { id: 'fold-inv', kind: NODE_KINDS.panel, ref: OPEN_TARGET },
                { id: 'fold-b', kind: NODE_KINDS.group, label: 'Fold B', children: [
                    { id: 'fold-ev', kind: NODE_KINDS.panel, ref: CLOSE_TARGET }] }] }] });
        testController.reportCondition('the stored groups are drawn open',
            !!await until(() => root.querySelectorAll('.ql-user').length === 2 && details().every((d) => d.open), 'two user groups, all open'));
        const button = foldButton(root);
        testController.assertEqual('the fold button starts at "Collapse all"', FOLD_TEXT.collapse, button?.textContent);
        const userIds = [...root.querySelectorAll('.ql-user')].map((d) => d.dataset.groupId);

        button?.click();
        const closed = await until(() => details().length > 0 && details().every((d) => !d.open), 'every group closed');
        testController.reportCondition('a click closes every drawn group', !!closed);
        testController.assertEqual('the button now reads "Expand all"', FOLD_TEXT.expand, button?.textContent);
        const stored = await until(async () => {
            const v = await settingsManager.getSetting(COLLAPSED_SETTING);
            return Array.isArray(v) && v.length === userIds.length;
        }, 'collapsedGroups to hold the user group ids');
        testController.reportCondition('collapsedGroups was written', !!stored);
        testController.assertEqual('collapsedGroups == every user group id', [...userIds].sort().join(),
            [...(await settingsManager.getSetting(COLLAPSED_SETTING)) ?? []].sort().join());

        button?.click();
        const opened = await until(() => details().length > 0 && details().every((d) => d.open), 'every group open');
        testController.reportCondition('a second click opens every drawn group', !!opened);
        testController.assertEqual('the button reads "Collapse all" again', FOLD_TEXT.collapse, button?.textContent);
        testController.assertEqual('collapsedGroups is []', '[]', JSON.stringify(await settingsManager.getSetting(COLLAPSED_SETTING)));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchDeveloperDocsBehindSetting(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const developer = HELP_SECTIONS.filter((s) => s.audience === 'developer');
    const drawnDev = () => developer.filter((s) => helpSection(root, s.dir));
    try {
        testController.log(`developer sections: ${developer.map((s) => `${s.label} (${sectionDocCount(s)})`).join(' · ')}`);
        testController.reportCondition('the docs tree marks some developer section', developer.length > 0);
        await settingsManager.updateModuleSetting(MODULE_ID, DEVELOPER_DOCS_KEY, false);
        testController.reportCondition('showDeveloperDocs false: no developer section is drawn',
            !!await until(() => drawnDev().length === 0 && root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.help.id}"]`), 'no developer section'));

        await settingsManager.updateModuleSetting(MODULE_ID, DEVELOPER_DOCS_KEY, true);
        testController.assertEqual('the setting reads true', true, await settingsManager.getSetting(DEVELOPER_DOCS_SETTING));
        const shown = await until(() => drawnDev().length === developer.length, 'every developer section drawn');
        testController.reportCondition('showDeveloperDocs true: every developer section appears (no reload)', !!shown);
        testController.assertEqual('each developer section shows its count',
            developer.map((s) => `${s.label} (${sectionDocCount(s)})`).join(' | '),
            developer.map((s) => helpSection(root, s.dir)?.querySelector(':scope > summary').textContent ?? '(missing)').join(' | '));
        const subs = [...root.querySelectorAll(`details[data-group-id="${VIRTUAL_GROUPS.help.id}"] > .ql-subgroups > details`)];
        testController.assertEqual('the developer sections come after the user ones, in HELP_SECTIONS order',
            drawnHelpSections(HELP_SECTIONS, true).map((s) => s.label).join(' | '), subs.map(summaryLabel).join(' | '));
        testController.assertEqual('the header counts the docs drawn',
            `${centralRegistry.getAllPanelComponents().size} panels · ${drawnDocPaths(true).length} docs`,
            root.querySelector('.ql-header')?.textContent ?? '');

        await settingsManager.updateModuleSetting(MODULE_ID, DEVELOPER_DOCS_KEY, false);
        testController.reportCondition('back to false: the developer sections go again',
            !!await until(() => drawnDev().length === 0, 'no developer section'));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

// ── P3: the fold under a filter, the filter's Escape and count, the "filed N×" badge ──

/** The rows the panel draws, counted in the DOM: panel buttons, guide rows, links, dangling refs. */
const drawnRows = (root) => root.querySelectorAll('.ql-groups .ql-panel, .ql-groups .ql-help, .ql-groups .ql-url, .ql-groups .ql-missing').length;
const countEl = (root) => root.querySelector(`.${CONTROLS.count}`);

async function quickLaunchFoldDisabledUnderFilter(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const group = () => root.querySelector('details[data-group-id="fd-g"]');
    try {
        await writeTree({ version: 1, nodes: [{ id: 'fd-g', kind: NODE_KINDS.group, label: 'Fold filter', children: [
            { id: 'fd-inv', kind: NODE_KINDS.panel, ref: OPEN_TARGET }] }] });
        testController.reportCondition('the stored group is drawn open', !!await until(() => group()?.open, 'group "Fold filter" open'));
        const button = foldButton(root);
        testController.reportCondition('with the filter empty the fold button is enabled', button?.disabled === false);
        testController.assertEqual('its tooltip is the mode\'s', FOLD_TITLE.collapse, button?.title);

        typeFilter(root, 'inv');
        const disabled = await until(() => button?.disabled === true, 'the fold button disabled');
        testController.reportCondition('typing in the filter disables the fold button', !!disabled);
        testController.assertEqual('its tooltip says to clear the filter', FOLD_DISABLED_TITLE, button?.title);
        testController.assertEqual('the filter leaves the button\'s mode alone', FOLD_TEXT.collapse, button?.textContent);
        button?.click(); // a disabled button fires no click
        await new Promise((r) => setTimeout(r, 300));
        testController.reportCondition('a click on the disabled button folds nothing', group()?.open === true);
        testController.assertEqual('…and writes no collapsedGroups', '[]', JSON.stringify(await settingsManager.getSetting(COLLAPSED_SETTING)));

        typeFilter(root, '');
        const enabled = await until(() => button?.disabled === false, 'the fold button enabled again');
        testController.reportCondition('clearing the filter enables it again', !!enabled);
        testController.assertEqual('with its mode\'s tooltip back', FOLD_TITLE.collapse, button?.title);
        testController.assertEqual('still at "Collapse all"', FOLD_TEXT.collapse, button?.textContent);
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchFilterEscAndCount(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const input = root.querySelector(`.${CONTROLS.filter}`);
    const QUERY = 'inv';
    // A stored group, a nested link and a dangling ref, so the count covers every kind of row.
    const tree = { version: 1, nodes: [
        { id: 'cnt-g', kind: NODE_KINDS.group, label: 'Counted', children: [
            { id: 'cnt-inv', kind: NODE_KINDS.panel, ref: OPEN_TARGET },
            { id: 'cnt-url', kind: NODE_KINDS.url, href: 'https://example.org', label: 'Example' }] },
        { id: 'cnt-gone', kind: NODE_KINDS.panel, ref: 'noSuchPanelForTheCount' }] };
    try {
        await writeTree(tree);
        await until(() => root.querySelector('.ql-root .ql-url') && root.querySelector('.ql-root .ql-missing'), 'the stored rows drawn');
        testController.reportCondition('the count is hidden while the filter is empty', countEl(root)?.hidden === true);
        const all = drawnRows(root);

        // The same number through the exported pure functions, over the live registry and docs.
        const catalog = buildCatalog({
            panelComponents: centralRegistry.getAllPanelComponents(),
            moduleStates: window.moduleManagerApi?.getAllModuleStates?.() ?? {},
            docsIndex: DOCS_INDEX,
            helpSections: HELP_SECTIONS,
            showDeveloperDocs: false,
            loadPriority: [],
        });
        const model = buildViewModel(await readTree(), catalog);
        const expected = countText(model, filterView(model, QUERY));
        testController.log(`rows drawn unfiltered: ${all}; countText for "${QUERY}": ${expected}`);

        typeFilter(root, QUERY);
        const shown = await until(() => countEl(root)?.hidden === false && drawnRows(root) < all, 'the filtered view with its count');
        testController.reportCondition(`typing "${QUERY}" shows the count`, !!shown);
        const text = countEl(root)?.textContent;
        testController.assertEqual('the count is "N of M" over the rows drawn (DOM)', `${drawnRows(root)} of ${all}`, text);
        testController.assertEqual('the count == countText(model, filterView(model, query))', expected, text);

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        const cleared = await until(() => input.value === '' && countEl(root)?.hidden === true && drawnRows(root) === all,
            'Escape to clear the filter and redraw every row');
        testController.reportCondition('Escape clears the filter, hides the count and redraws every row', !!cleared);
        testController.reportCondition('the fold button is enabled again', foldButton(root)?.disabled === false);
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

async function quickLaunchFiledBadgeInEditMode(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const badges = () => [...root.querySelectorAll(`.${CONTROLS.filed}`)];
    try {
        await writeTree({ version: 1, nodes: [
            { id: 'bdg-a', kind: NODE_KINDS.panel, ref: OPEN_TARGET },
            { id: 'bdg-g', kind: NODE_KINDS.group, label: 'Badged', children: [
                { id: 'bdg-b', kind: NODE_KINDS.panel, ref: OPEN_TARGET },
                { id: 'bdg-c', kind: NODE_KINDS.panel, ref: CLOSE_TARGET }] }] });
        await until(() => root.querySelectorAll('.ql-root .ql-node[data-kind="panel"]').length === 3, 'the three stored rows');
        testController.assertEqual('no badge outside edit mode', 0, badges().length);

        root.querySelector(`.${CONTROLS.edit}`)?.click();
        await until(() => root.querySelector('.ql-root-ctl'), 'edit mode');
        const counts = refCounts(await readTree());
        const allPanels = allPanelsEl(root);
        const rowBadge = (ct) => allPanels?.querySelector(`.ql-panel[data-component-type="${ct}"]`)?.closest('li')?.querySelector(`.${CONTROLS.filed}`);
        testController.assertEqual(`${OPEN_TARGET}'s All panels row reads its filed count`,
            filedText(counts.get(`${NODE_KINDS.panel}:${OPEN_TARGET}`)), rowBadge(OPEN_TARGET)?.textContent);
        testController.assertEqual(`${OPEN_TARGET} is filed twice`, filedText(2), rowBadge(OPEN_TARGET)?.textContent);
        testController.assertEqual(`${CLOSE_TARGET}'s row reads 1×`, filedText(1), rowBadge(CLOSE_TARGET)?.textContent);
        testController.assertEqual('All panels holds one badge per filed ref', counts.size,
            allPanels?.querySelectorAll(`.${CONTROLS.filed}`).length);
        testController.assertEqual('no badge in the stored tree, Unfiled or Help', 0,
            badges().filter((b) => !allPanels?.contains(b)).length);

        root.querySelector(`.${CONTROLS.edit}`)?.click();
        testController.reportCondition('leaving edit mode removes the badges',
            !!await until(() => !root.querySelector('.ql-ctl') && badges().length === 0, 'no badges'));
    } finally {
        await resetQuickLaunch(testController, root);
    }
    return testController.getOverallResult();
}

/**
 * The mobile tab bar's input, checked on the desktop layout (a row cannot switch
 * layout): every registered panel's own moduleInfo gives the title, name and icon the
 * mobile registration shows, with no componentType fallback firing. The lookup is
 * the registry's (sources 1–2 of layoutManager.js setupMobileLayout); the loader's
 * maps (sources 3–4) are not reachable from here, and a panel that needed them
 * fails this row rather than passing it.
 */
async function mobileTabBarResolvesEveryPanel(testController) {
    const entries = [...centralRegistry.getAllPanelComponents()];
    testController.log(`registry: ${entries.length} panel components`);
    testController.reportCondition('the registry holds panel components', entries.length > 0);

    const noInfo = [];
    const noTitle = [];
    const noName = [];
    const iconless = [];
    for (const [componentType, entry] of entries) {
        const raw = lookupModuleInfo(componentType, entry);
        if (!raw) { noInfo.push(componentType); continue; }
        const info = completeModuleInfo(componentType, raw);
        if (!raw.title || info.title !== raw.title) noTitle.push(componentType);
        if (!raw.name || info.name !== raw.name) noName.push(componentType);
        if (!info.icon) iconless.push(componentType);
    }
    testController.assertEqual('panels whose moduleInfo is unreachable', '', noInfo.join(', '));
    testController.assertEqual('panels without a declared title', '', noTitle.join(', '));
    testController.assertEqual('panels without a declared name', '', noName.join(', '));
    // The icon set is the registry's own: a panel that declares no icon would show its title's first letter.
    // Since P7 every panel declares one.
    testController.assertEqual('panels declaring no icon (tab would show the title\'s first letter)', '',
        iconless.join(', '));
    return testController.getOverallResult();
}

const TESTS = [
    ['quick-launch-lists-every-registered-panel', 'Quick Launch: a button per registered panel',
        'Asserts the Quick Launch panel draws one button per componentType centralRegistry.getAllPanelComponents() '
        + 'holds (read at run time), lists itself, and its header counts the registry and the docs Help draws.',
        quickLaunchListsEveryRegisteredPanel],
    ['quick-launch-button-activates-open-panel', 'Quick Launch: a button brings an open panel forward',
        'Makes Inventory a background tab, clicks its Quick Launch button, and polls until Inventory is the '
        + 'active item of its stack; restores the stack\'s previous active tab.',
        quickLaunchButtonActivatesOpenPanel],
    ['quick-launch-button-reopens-closed-panel', 'Quick Launch: a button reopens a closed panel',
        'Closes Events as its × does (destroyPanelByComponentType), waits for the module to be disabled and the '
        + 'row\'s dot to go hollow, clicks the row, and polls until the module is enabled with a tab again.',
        quickLaunchButtonReopensClosedPanel],
    ['quick-launch-doc-links-resolve-to-index', 'Quick Launch: every doc link is an indexed guide in a new tab',
        'Every .ql-doc and .ql-help link\'s href ends with a DOCS_INDEX path and has target="_blank"; Help holds '
        + 'one link per doc its sections draw (HELP_SECTIONS, developer sections off).',
        quickLaunchDocLinksResolveToIndex],
    ['quick-launch-empty-tree-renders-as-q1', 'Quick Launch: an empty tree draws what Q1 drew',
        'With the tree setting at EMPTY_TREE: no stored section, no Unfiled group, exactly All panels + Help, the '
        + 'Q1 header, no edit controls.',
        quickLaunchEmptyTreeRendersAsQ1],
    ['quick-launch-edit-ops-persist', 'Quick Launch: edit-mode buttons write the tree',
        'Drives the edit-mode controls as a person does (+ group and ✎ typed into their inline inputs, add to ▾ ×3, ▲, '
        + 'add + delete an empty group), '
        + 'reads the setting back and compares its shape minus ids, then leaves edit mode and checks the render.',
        quickLaunchEditOpsPersist],
    ['quick-launch-unfiled-shows-unreferenced', 'Quick Launch: Unfiled lists what the tree does not reference',
        'Files one panel; Unfiled then holds every other registered panel and every doc Help draws (the count is '
        + 'read off the registry and HELP_SECTIONS).',
        quickLaunchUnfiledShowsUnreferenced],
    ['quick-launch-duplicate-refs-both-activate', 'Quick Launch: two references to one panel both activate it',
        'Stores Inventory twice (top level and in a group); clicking each brings Inventory forward.',
        quickLaunchDuplicateRefsBothActivate],
    ['quick-launch-categories-group-every-panel', 'Quick Launch: All panels is split by module category',
        'Every .ql-panel in All panels sits in the sub-group named by its moduleInfo.category (Other when it '
        + 'declares none CATEGORY_ORDER lists); the sub-group labels are exactly the categories the registry holds, '
        + 'in CATEGORY_ORDER, Other last.',
        quickLaunchCategoriesGroupEveryPanel],
    ['quick-launch-cards-view-shows-descriptions', 'Quick Launch: the cards view shows each panel\'s description',
        'Switches to cards through the bar toggle; every panel card whose moduleInfo declares a description shows '
        + 'it; the view setting follows; switching back removes the text.',
        quickLaunchCardsViewShowsDescriptions],
    ['quick-launch-filter-keeps-ancestors-open', 'Quick Launch: the filter opens the groups holding a match',
        'A stored group (Inventory + Events) saved collapsed; typing "inv" draws it open with only Inventory, and '
        + 'no Events anywhere; clearing the box draws it collapsed again.',
        quickLaunchFilterKeepsAncestorsOpen],
    ['quick-launch-collapsed-groups-persist', 'Quick Launch: a collapsed user group stays collapsed',
        'Collapses a stored group through its summary; collapsedGroups holds its id; after a re-render the '
        + 'redrawn group is still collapsed.',
        quickLaunchCollapsedGroupsPersist],
    ['quick-launch-help-sections-follow-the-docs-markers', 'Quick Launch: Help sections follow the docs-tree markers',
        'With showDeveloperDocs off, Help holds one sub-group per HELP_SECTIONS entry with audience user (read off the '
        + 'generated module), in order, each counting its docs; a section\'s rows are its own docs then each single '
        + 'sub-directory\'s doc, and each sub-directory holding more than one doc is a nested sub-group.',
        quickLaunchHelpSectionsFollowTheDocsMarkers],
    ['quick-launch-panel-guides-not-listed-in-help', 'Quick Launch: the panel guides are not listed in Help',
        'No Help row links a guide of the audience-panel section; every panel whose moduleInfo declares an indexed '
        + 'guide shows its ? on its row.',
        quickLaunchPanelGuidesNotListedInHelp],
    ['quick-launch-fold-button-collapses-then-expands', 'Quick Launch: the fold button collapses, then expands',
        'With two stored groups (one nested): "Collapse all" closes every drawn group, reads "Expand all" and writes '
        + 'every user group id to collapsedGroups; "Expand all" opens every group, reads "Collapse all", writes [].',
        quickLaunchFoldButtonCollapsesThenExpands],
    ['quick-launch-developer-docs-behind-setting', 'Quick Launch: the developer docs are behind showDeveloperDocs',
        'showDeveloperDocs false: no developer section; true: every audience-developer section appears with its '
        + 'count, after the user ones, and the header counts them; false again: they go.',
        quickLaunchDeveloperDocsBehindSetting],
    ['quick-launch-fold-disabled-under-filter', 'Quick Launch: the fold button is disabled while filtering',
        'A stored group; typing in the filter disables the fold button (tooltip: clear the filter), a click folds and '
        + 'writes nothing, the mode stays "Collapse all"; clearing the filter enables it with its tooltip back.',
        quickLaunchFoldDisabledUnderFilter],
    ['quick-launch-filter-esc-and-count', 'Quick Launch: Escape clears the filter; the count reads "N of M"',
        'With a stored group, link and dangling ref: the count is hidden, typing "inv" shows "N of M" equal to the '
        + 'rows drawn in the DOM and to countText over the live catalog; Escape clears the box, hides the count and '
        + 'redraws every row.',
        quickLaunchFilterEscAndCount],
    ['quick-launch-filed-badge-in-edit-mode', 'Quick Launch: edit mode badges a built-in row with its filed count',
        'Inventory filed twice and Events once: in edit mode their All panels rows read "2×" and "1×" (refCounts over '
        + 'the stored tree), no badge elsewhere; leaving edit mode removes them.',
        quickLaunchFiledBadgeInEditMode],
    ['mobile-tab-bar-resolves-every-panel', 'Mobile tab bar: every panel resolves a title, name and icon from its moduleInfo',
        'For every registered panel, the moduleInfo the mobile layout registers (the registry\'s lookup) declares a '
        + 'title, a name and an icon, so no componentType or first-letter fallback fires (read off the registry).',
        mobileTabBarResolvesEveryPanel],
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
