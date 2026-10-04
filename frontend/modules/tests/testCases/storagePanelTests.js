/**
 * In-app tests for the Storage panel and the quota notice (enrolled in the
 * regression roster).
 *
 * ⚖ RULED (the user, 2026-09-26): every row SETS the state it expects and
 * cleans up after itself. Each row writes only scratch keys (removed in
 * `finally`) or real keys whose previous value it restores, puts the real
 * dialogs back, and gives the layout's stack back its previously active tab.
 *
 * The panel is reached the way a person reaches it — `openStoragePanel()`, the
 * module manager's enable path Quick Launch also uses — so the rows also prove
 * it is registered and placed right after the JSON panel.
 */

import { registerTest } from '../testRegistry.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { formatChars } from '../../storagePanel/storageModel.js';
import { CONTROLS, dialogs } from '../../storagePanel/storagePanelUI.js';
import { openStoragePanel } from '../../storagePanel/index.js';
import { hideQuotaNotice, quotaNoticeElement } from '../../storagePanel/quotaNotice.js';

const CATEGORY = 'Storage';
const TIMEOUT_MS = 10000;
const POLL_MS = 100;
/** No module declares this: it lands under Unknown. */
const SCRATCH_KEY = '__storagePanelTest_scratch__';
/** Declared by bounceDemo (kind state). */
const DECLARED_KEY = 'bounceDjReal.player';
const DECLARED_OWNER = 'bounceDemo';
/** Matches jtaBalance's cache prefix. */
const SCRATCH_CACHE_KEY = 'jtaBalance_patches_v1___storagePanelTest__';
/** Matches flashPanel's user pattern (/shrumsave$). */
const SCRATCH_USER_KEY = '__storagePanelTest__/shrumsave';

function tabItem(componentType) {
    const items = window.goldenLayoutInstance?.getAllContentItems?.() ?? [];
    return items.find((it) => it.isComponent && it.componentType === componentType) ?? null;
}

/** Restores the Storage tab's stack to the tab it showed before `openPanel`. */
function rememberActiveTab() {
    const stack = tabItem('storagePanel')?.parent ?? null;
    const before = stack?.getActiveComponentItem?.() ?? null;
    return () => {
        if (stack && before && before.parent === stack) stack.setActiveComponentItem(before);
    };
}

/**
 * Open the panel through its real path, press Refresh and wait until the drawn
 * header reflects the storage as it is now. Returns the panel root or null.
 */
async function openPanel(testController) {
    await openStoragePanel();
    const mounted = await testController.pollForCondition(
        () => document.querySelector('.storage-panel') !== null,
        'the Storage panel to be mounted',
        TIMEOUT_MS,
        POLL_MS,
    );
    testController.reportCondition('the Storage panel mounts', mounted);
    if (!mounted) return null;
    const root = document.querySelector('.storage-panel');
    return refresh(testController, root);
}

/** The header's key count and chars as drawn. */
function headerNumbers(root) {
    const m = root.querySelector(`.${CONTROLS.header}`)?.textContent.match(/^(\d+) keys? · ([\d,]+) of/);
    return m ? { keys: Number(m[1]), chars: Number(m[2].replace(/,/g, '')) } : null;
}

/** The storage's own count/total (what the header should say). */
function storageNumbers() {
    let chars = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        chars += k.length + localStorage.getItem(k).length;
    }
    return { keys: localStorage.length, chars };
}

async function refresh(testController, root) {
    root.querySelector(`.${CONTROLS.refresh}`).click();
    const ok = await testController.pollForCondition(
        () => {
            const h = headerNumbers(root);
            const s = storageNumbers();
            return h && h.keys === s.keys && h.chars === s.chars;
        },
        'the header to match the storage after Refresh',
        TIMEOUT_MS,
        POLL_MS,
    );
    testController.reportCondition('after Refresh the header counts every key and char in the storage', ok);
    return ok ? root : null;
}

function rowOf(root, key) {
    return [...root.querySelectorAll(`.${CONTROLS.row}`)].find((tr) => tr.dataset.key === key) ?? null;
}

function sectionOf(el) {
    return el?.closest(`.${CONTROLS.section}`)?.dataset.section ?? null;
}

async function storagePanelListsEveryKeyWithOwnerAndSize(testController) {
    const restoreTab = rememberActiveTab();
    const declaredBefore = localStorage.getItem(DECLARED_KEY);
    try {
        // Placement: the tab directly after the JSON panel's, in the same stack.
        await openStoragePanel();
        const json = tabItem('jsonPanel');
        const storage = tabItem('storagePanel');
        const siblings = json?.parent?.contentItems ?? [];
        testController.reportCondition('the Storage tab follows the JSON tab in its stack',
            !!storage && storage.parent === json?.parent && siblings.indexOf(storage) === siblings.indexOf(json) + 1);

        localStorage.setItem(SCRATCH_KEY, 'x'.repeat(1234));
        localStorage.setItem(DECLARED_KEY, 'storage-panel-test');
        const root = await openPanel(testController);
        if (!root) return testController.getOverallResult();

        const sections = [...root.querySelectorAll(`.${CONTROLS.section}`)].map((s) => s.dataset.section);
        testController.assertEqual('the sections, in order', 'unknown,user,state,cache', sections.join(','));

        const scratch = rowOf(root, SCRATCH_KEY);
        testController.assertEqual('the undeclared scratch key is listed under', 'unknown', sectionOf(scratch));
        testController.assertEqual('its size (key + value chars)', formatChars(SCRATCH_KEY.length + 1234),
            scratch?.querySelector('.sp-chars')?.textContent);

        const declared = rowOf(root, DECLARED_KEY);
        testController.assertEqual(`${DECLARED_KEY} is listed under`, 'state', sectionOf(declared));
        testController.assertEqual(`${DECLARED_KEY}'s owner group`, DECLARED_OWNER,
            declared?.closest(`.${CONTROLS.group}`)?.dataset.owner);
        testController.reportCondition(`${DECLARED_KEY} shows its declared label`,
            (declared?.querySelector('.sp-label')?.textContent ?? '').length > 0);
    } finally {
        localStorage.removeItem(SCRATCH_KEY);
        if (declaredBefore === null) localStorage.removeItem(DECLARED_KEY);
        else localStorage.setItem(DECLARED_KEY, declaredBefore);
        restoreTab();
    }
    return testController.getOverallResult();
}

async function storagePanelRowClearRemovesTheKey(testController) {
    const restoreTab = rememberActiveTab();
    const realConfirm = dialogs.confirm;
    const asked = [];
    try {
        localStorage.setItem(SCRATCH_KEY, 'y'.repeat(500));
        const root = await openPanel(testController);
        if (!root) return testController.getOverallResult();
        const before = headerNumbers(root);
        dialogs.confirm = (message) => { asked.push(message); return true; };

        rowOf(root, SCRATCH_KEY)?.querySelector(`.${CONTROLS.rowClear}`)?.click();
        const gone = await testController.pollForCondition(
            () => rowOf(root, SCRATCH_KEY) === null && localStorage.getItem(SCRATCH_KEY) === null,
            'the scratch row and key to be gone',
            TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('Clear on the row removes the key and its row', gone);
        testController.assertEqual('the confirm names one key and its size',
            `Clear "${SCRATCH_KEY}": remove 1 key (${formatChars(SCRATCH_KEY.length + 500)} chars)`,
            (asked[0] ?? '').split(' from this site')[0]);
        const after = headerNumbers(root);
        testController.assertEqual('the header total drops by the key\'s size',
            before.chars - (SCRATCH_KEY.length + 500), after?.chars);
    } finally {
        dialogs.confirm = realConfirm;
        localStorage.removeItem(SCRATCH_KEY);
        restoreTab();
    }
    return testController.getOverallResult();
}

async function storagePanelSectionClearSparesUserData(testController) {
    const restoreTab = rememberActiveTab();
    const realConfirm = dialogs.confirm;
    // The real cache keys (rebuildable, but not ours): put back exactly as found.
    const realCache = [];
    try {
        localStorage.setItem(SCRATCH_CACHE_KEY, '[]');
        localStorage.setItem(SCRATCH_USER_KEY, 'user data');
        let root = await openPanel(testController);
        if (!root) return testController.getOverallResult();

        const userSection = root.querySelector(`.${CONTROLS.section}[data-section="user"]`);
        testController.reportCondition('the user section has no section-level Clear',
            userSection && !userSection.querySelector(`.${CONTROLS.sectionClear}`));
        testController.assertEqual('the scratch user key is listed under', 'user', sectionOf(rowOf(root, SCRATCH_USER_KEY)));

        const cacheSection = root.querySelector(`.${CONTROLS.section}[data-section="cache"]`);
        const cacheKeys = [...cacheSection.querySelectorAll(`.${CONTROLS.row}`)].map((tr) => tr.dataset.key);
        for (const k of cacheKeys) if (k !== SCRATCH_CACHE_KEY) realCache.push([k, localStorage.getItem(k)]);
        testController.reportCondition('the scratch cache key is listed under cache', cacheKeys.includes(SCRATCH_CACHE_KEY));
        const keysBefore = Object.keys(localStorage).sort();

        dialogs.confirm = () => true;
        cacheSection.querySelector(`.${CONTROLS.sectionClear}`)?.click();
        const cleared = await testController.pollForCondition(
            () => localStorage.getItem(SCRATCH_CACHE_KEY) === null,
            'the cache section to be cleared',
            TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('"Clear all caches" removes the cache keys', cleared);
        const expected = keysBefore.filter((k) => !cacheKeys.includes(k));
        testController.assertEqual('every other key survives (the storage minus the cache section)',
            expected.join('|'), Object.keys(localStorage).sort().join('|'));
        testController.assertEqual('the user key is untouched', 'user data', localStorage.getItem(SCRATCH_USER_KEY));
        root = document.querySelector('.storage-panel');
        testController.reportCondition('the redrawn cache section is empty',
            root.querySelectorAll(`.${CONTROLS.section}[data-section="cache"] .${CONTROLS.row}`).length === 0);
    } finally {
        dialogs.confirm = realConfirm;
        for (const [k, v] of realCache) if (v !== null) localStorage.setItem(k, v);
        localStorage.removeItem(SCRATCH_CACHE_KEY);
        localStorage.removeItem(SCRATCH_USER_KEY);
        restoreTab();
    }
    return testController.getOverallResult();
}

/**
 * Fill the origin with ONE scratch key until nothing more fits, then change a
 * setting so its save needs more room: the settings save must raise the notice
 * naming the mode blob's key. ⚠ LAST in its group: it leaves the origin as it
 * found it (the scratch key removed, the setting restored and saved again).
 */
async function settingsSaveQuotaErrorNotifies(testController) {
    const blobKey = settingsManager.getStorageKey();
    const before = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length]));
    const oldName = await settingsManager.getSetting('playerName');
    let filled = 0;
    try {
        hideQuotaNotice();
        // Largest scratch value that fits (binary search), so the origin is full to the char.
        let lo = 0;
        let hi = 16 * 1024 * 1024;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            try {
                localStorage.setItem(SCRATCH_KEY, 'q'.repeat(mid));
                lo = mid;
            } catch {
                hi = mid - 1;
            }
        }
        localStorage.setItem(SCRATCH_KEY, 'q'.repeat(lo));
        filled = lo;
        testController.log(`filled the origin with ${formatChars(lo)} scratch chars`);
        const evicted = Object.entries(before).filter(([k, len]) => localStorage.getItem(k)?.length !== len).map(([k]) => k);
        testController.assertEqual('the fill evicted or changed no existing key', '', evicted.join(', '));

        await settingsManager.updateSetting('playerName', `${oldName ?? ''}${'p'.repeat(200)}`);
        settingsManager.flushPendingSave();
        const appeared = await testController.pollForCondition(
            () => quotaNoticeElement() !== null,
            'the quota notice to appear',
            TIMEOUT_MS,
            POLL_MS,
        );
        testController.reportCondition('a settings save that does not fit shows the quota notice', appeared);
        const shown = quotaNoticeElement();
        testController.assertEqual('the notice names the key that did not fit', blobKey, shown?.dataset.key);
        testController.reportCondition('the notice text names the key',
            (shown?.textContent ?? '').includes(`"${blobKey}"`));
        testController.reportCondition('the notice offers to open the Storage panel',
            !!shown?.querySelector('.storage-quota-notice-open'));
    } finally {
        localStorage.removeItem(SCRATCH_KEY);
        await settingsManager.updateSetting('playerName', oldName);
        settingsManager.flushPendingSave();
        hideQuotaNotice();
    }
    const after = Object.keys(localStorage);
    testController.reportCondition('no scratch key is left behind', !after.includes(SCRATCH_KEY));
    testController.reportCondition('the origin was actually filled', filled > 0);
    return testController.getOverallResult();
}

const TESTS = [
    ['storage-panel-lists-every-key-with-owner-and-size', 'Storage panel: every key with its owner and size',
        'The Storage tab follows JSON; the sections are Unknown, user, state, cache in that order; an undeclared '
        + 'scratch key is under Unknown with its key+value size; a declared key is under its kind, in its owner\'s group.',
        storagePanelListsEveryKeyWithOwnerAndSize],
    ['storage-panel-row-clear-removes-the-key', 'Storage panel: a row\'s Clear removes the key',
        'A scratch key\'s Clear (confirmed through the dialogs seam) removes the key and its row; the confirm names '
        + 'one key and its size; the header total drops by that size.',
        storagePanelRowClearRemovesTheKey],
    ['storage-panel-section-clear-spares-user-data', 'Storage panel: a section Clear removes that section only',
        'The user section has no section Clear; "Clear all caches" removes the cache section\'s keys and nothing else '
        + '(a scratch user key survives); real cache keys are put back afterwards.',
        storagePanelSectionClearSparesUserData],
    ['settings-save-quota-error-notifies', 'Quota notice: a settings save that does not fit is shown',
        'Fills the origin with one scratch key (evicting nothing), changes a setting so its save needs more room: the '
        + 'banner names the mode blob\'s key and offers the Storage panel. Leaves the origin as it found it.',
        settingsSaveQuotaErrorNotifies],
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
