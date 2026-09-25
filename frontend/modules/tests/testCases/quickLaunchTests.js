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
 * ⛓ The Q2 rows (the stored tree, edit mode, Unfiled) each END by writing
 * the tree setting back to EMPTY_TREE and leaving edit mode, in `finally` —
 * so no row owes its state to the row before it, and the Q1 rows (which
 * count buttons on an empty tree) are unaffected by where these run. The Q3
 * rows (categories, cards, filter, collapsed groups) end the same way and
 * also put the view back to tree, clear the filter box and empty
 * collapsedGroups (`restoreQ3`).
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
import { DOCS_INDEX } from '../../quickLaunch/generated/docsIndex.js';
import { CATEGORY_ORDER } from '../../quickLaunch/generated/docsIndex.js';
import { OTHER_CATEGORY, VIRTUAL_GROUPS, lookupModuleInfo } from '../../quickLaunch/quickLaunchCatalog.js';
import { EMPTY_TREE, NODE_KINDS } from '../../quickLaunch/quickLaunchTree.js';
import {
    COLLAPSED_KEY, COLLAPSED_SETTING, CONTROLS, MODULE_ID, ROOT_CHOICE, TREE_KEY, TREE_SETTING, VIEWS, VIEW_KEY,
    VIEW_SETTING, dialogs,
} from '../../quickLaunch/quickLaunchUI.js';

const CATEGORY = 'Quick Launch';
const MOUNT_TIMEOUT_MS = 10000;
const ACTION_TIMEOUT_MS = 10000;
const POLL_MS = 100;
const OPEN_TARGET = 'inventoryPanel';
const CLOSE_TARGET = 'eventsPanel';

/** The panel's root once it shows a button per registered panel; null if it never does. */
async function panelRoot(testController) {
    const expected = centralRegistry.getAllPanelComponents().size;
    const ready = await testController.pollForCondition(
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
    testController.assertEqual('header counts the registry and the docs index',
        `${expected.length} panels · ${DOCS_INDEX.length} guides`, header);
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
    return testController.getOverallResult();
}

async function quickLaunchDocLinksResolveToIndex(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const paths = DOCS_INDEX.map((d) => d.path);
    const links = [...root.querySelectorAll('.ql-doc a, .ql-help a')];
    const helpLinks = root.querySelectorAll('.ql-help a').length;
    testController.log(`${links.length} doc links (${helpLinks} in Help); index has ${paths.length}`);
    testController.assertEqual('Help has one link per indexed guide', paths.length, helpLinks);
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
const virtualRow = (root, groupId, predicate) => [...root.querySelectorAll(`details[data-group-id="${groupId}"] > .ql-list > li`)]
    .find(predicate) ?? null;

/** Choose `value` in a "move to" / "add to" select, as a person would. */
function pick(select, value) {
    select.value = value;
    select.dispatchEvent(new Event('change'));
}

/** Put everything a Q2 row may have changed back: edit mode off, the tree empty, the real dialogs. */
async function restoreQ2(testController, root, savedDialogs) {
    Object.assign(dialogs, savedDialogs);
    const edit = root?.querySelector(`.${CONTROLS.edit}`);
    if (edit?.getAttribute('aria-pressed') === 'true') edit.click();
    await writeTree(EMPTY_TREE);
    await testController.pollForCondition(
        () => !document.querySelector('.quick-launch-panel .ql-root, .quick-launch-panel .ql-ctl'),
        'Quick Launch to render the empty tree again',
        ACTION_TIMEOUT_MS,
        POLL_MS,
    );
}

async function quickLaunchEmptyTreeRendersAsQ1(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
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
        testController.assertEqual('header counts the registry and the docs index',
            `${centralRegistry.getAllPanelComponents().size} panels · ${DOCS_INDEX.length} guides`,
            root.querySelector('.ql-header')?.textContent ?? '');
        testController.assertEqual('no edit controls outside edit mode', 0, root.querySelectorAll('.ql-ctl').length);
        testController.assertEqual('the Edit button is not pressed', 'false',
            root.querySelector(`.${CONTROLS.edit}`)?.getAttribute('aria-pressed'));
    } finally {
        await restoreQ2(testController, root, saved);
    }
    return testController.getOverallResult();
}

async function quickLaunchEditOpsPersist(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
    const answers = [];
    dialogs.prompt = () => answers.shift() ?? null;
    dialogs.confirm = () => true;
    const until = (cond, what) => testController.pollForCondition(cond, what, ACTION_TIMEOUT_MS, POLL_MS);
    const docPath = DOCS_INDEX[0]?.path;
    const docRow = () => virtualRow(root, VIRTUAL_GROUPS.help.id, (li) => li.querySelector('a')?.title === docPath);
    // All panels holds one sub-group per category (Q3): the row sits in whichever one Inventory declares.
    const invRow = () => root.querySelector(`details[data-group-id="${VIRTUAL_GROUPS.allPanels.id}"] `
        + `.ql-panel[data-component-type="${OPEN_TARGET}"]`)?.closest('li') ?? null;
    try {
        await writeTree(EMPTY_TREE);
        root.querySelector(`.${CONTROLS.edit}`)?.click();
        testController.reportCondition('Edit shows the top-level controls',
            await until(() => root.querySelector(`.ql-root-ctl .${CONTROLS.addGroup}`), 'the root "+ group" button'));

        answers.push('Mine');
        root.querySelector(`.ql-root-ctl .${CONTROLS.addGroup}`).click();
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

        answers.push('Mine 2');
        userGroup(root, 'Mine').querySelector(`:scope > .ql-ctl-row .${CONTROLS.rename}`).click();
        testController.reportCondition('✎ renames the group', await until(() => userGroup(root, 'Mine 2'), 'group "Mine 2"'));

        answers.push('Scratch');
        root.querySelector(`.ql-root-ctl .${CONTROLS.addGroup}`).click();
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
        await restoreQ2(testController, root, saved);
    }
    return testController.getOverallResult();
}

async function quickLaunchUnfiledShowsUnreferenced(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
    try {
        await writeTree({ version: 1, nodes: [{ id: 'filed-1', kind: NODE_KINDS.panel, ref: OPEN_TARGET }] });
        const sel = `details[data-group-id="${VIRTUAL_GROUPS.unfiled.id}"]`;
        const shown = await testController.pollForCondition(() => root.querySelector(sel),
            'the Unfiled group to appear', ACTION_TIMEOUT_MS, POLL_MS);
        testController.reportCondition('filing one panel shows Unfiled', !!shown);
        const unfiledEl = root.querySelector(sel);
        const expected = centralRegistry.getAllPanelComponents().size - 1 + DOCS_INDEX.length;
        testController.assertEqual('Unfiled rows = registry panels - 1 + indexed guides', expected,
            unfiledEl?.querySelectorAll(':scope > .ql-list > li').length);
        testController.reportCondition('the filed panel is not in Unfiled',
            !unfiledEl?.querySelector(`.ql-panel[data-component-type="${OPEN_TARGET}"]`));
        testController.assertEqual('Unfiled comes right after the stored list', VIRTUAL_GROUPS.unfiled.id,
            topGroupIds(root)[0]);
    } finally {
        await restoreQ2(testController, root, saved);
    }
    return testController.getOverallResult();
}

async function quickLaunchDuplicateRefsBothActivate(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
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
        await restoreQ2(testController, root, saved);
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

/** restoreQ2, plus the view back to tree, the filter box empty and no saved collapsed groups. */
async function restoreQ3(testController, root, savedDialogs) {
    if (root?.querySelector(`.${CONTROLS.filter}`)?.value) typeFilter(root, '');
    await settingsManager.updateModuleSetting(MODULE_ID, VIEW_KEY, VIEWS.tree);
    await settingsManager.updateModuleSetting(MODULE_ID, COLLAPSED_KEY, []);
    await restoreQ2(testController, root, savedDialogs);
    await testController.pollForCondition(
        () => !root?.classList.contains('ql-cards') && !root?.querySelector('.ql-desc'),
        'Quick Launch to be back in the tree view',
        ACTION_TIMEOUT_MS,
        POLL_MS,
    );
}

async function quickLaunchCategoriesGroupEveryPanel(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
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
        await restoreQ3(testController, root, saved);
    }
    return testController.getOverallResult();
}

async function quickLaunchCardsViewShowsDescriptions(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
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
        await restoreQ3(testController, root, saved);
    }
    return testController.getOverallResult();
}

async function quickLaunchFilterKeepsAncestorsOpen(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
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
        await restoreQ3(testController, root, saved);
    }
    return testController.getOverallResult();
}

async function quickLaunchCollapsedGroupsPersist(testController) {
    const root = await panelRoot(testController);
    if (!root) return testController.getOverallResult();
    const saved = { ...dialogs };
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
        await restoreQ3(testController, root, saved);
    }
    return testController.getOverallResult();
}

const TESTS = [
    ['quick-launch-lists-every-registered-panel', 'Quick Launch: a button per registered panel',
        'Asserts the Quick Launch panel draws one button per componentType centralRegistry.getAllPanelComponents() '
        + 'holds (read at run time), lists itself, and its header counts the registry and the docs index.',
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
        + 'one link per indexed guide.',
        quickLaunchDocLinksResolveToIndex],
    ['quick-launch-empty-tree-renders-as-q1', 'Quick Launch: an empty tree draws what Q1 drew',
        'With the tree setting at EMPTY_TREE: no stored section, no Unfiled group, exactly All panels + Help, the '
        + 'Q1 header, no edit controls.',
        quickLaunchEmptyTreeRendersAsQ1],
    ['quick-launch-edit-ops-persist', 'Quick Launch: edit-mode buttons write the tree',
        'Drives the edit-mode controls by clicking (add group, add to ▾ ×3, ▲, ✎, add + delete an empty group), '
        + 'reads the setting back and compares its shape minus ids, then leaves edit mode and checks the render.',
        quickLaunchEditOpsPersist],
    ['quick-launch-unfiled-shows-unreferenced', 'Quick Launch: Unfiled lists what the tree does not reference',
        'Files one panel; Unfiled then holds every other registered panel and every indexed guide (the count is '
        + 'read off the registry and DOCS_INDEX).',
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
