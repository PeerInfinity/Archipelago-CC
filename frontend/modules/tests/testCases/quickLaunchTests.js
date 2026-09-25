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
 * Handles (quick-launch Q1 W0 (e)): a panel is closed the way its × does with
 * `window.panelManager.destroyPanelByComponentType(type)` (it fires Golden
 * Layout's itemDestroyed → `ui:panelManuallyClosed` → the module is disabled);
 * a tab is found with `window.goldenLayoutInstance.getAllContentItems()`, the
 * call `panelManager.activatePanel` itself searches.
 */

import { registerTest } from '../testRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { DOCS_INDEX } from '../../quickLaunch/generated/docsIndex.js';

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
