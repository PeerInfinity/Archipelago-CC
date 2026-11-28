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
import { CONTROLS, dialogs, librarySource, loadLibraryModules } from '../../storagePanel/storagePanelUI.js';
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

/* ── the document library under "Your data" (lab arc B2) ──────────────────
 *
 * ⚖ Each row uses its OWN database (`librarySource.dbName`, the panel's seam,
 * set for the row's length and restored to null), asserts at its start that no
 * database of that name exists, and deletes it at its end (`blocked` logged).
 * The person's library is never read or cleared. The library's modules are
 * reached by the panel's own document-relative loader, so this works on both
 * boots.
 */

const DAY_MS = 24 * 60 * 60_000;
const rowDbName = (rowId) => `archipelago-cc-document-library-test-${rowId}`;
const LIBRARY_OWNER = 'procgenLabPanel';

/** An id-less document member (the library hashes it under NO_ID_KEY). */
const plainMembers = (tag) => [{ role: 'set', idKey: null, doc: { rows: [tag, `${tag}-room`], size: tag.length } }];

function saveReq(lineageId, tag, { draft = false, tab = 'row-tab', label = null } = {}) {
    return {
        lineageId, parent: null, draft, savedBecause: draft ? 'draft' : 'report', substrate: 'in-app-test',
        source: { page: 'in-app-test', tab_id: tab }, label, members: plainMembers(tag),
    };
}

function libraryNode(root) {
    return root.querySelector(`.${CONTROLS.library}[data-owner="${LIBRARY_OWNER}"]`);
}
function lineageRow(root, lineageId) {
    return [...(libraryNode(root)?.querySelectorAll(`.${CONTROLS.libraryRow}`) ?? [])].find((tr) => tr.dataset.lineage === lineageId) ?? null;
}
const noteText = (root) => libraryNode(root)?.querySelector(`.${CONTROLS.libraryNote}`)?.textContent ?? '';
const statusText = (root) => libraryNode(root)?.querySelector(`.${CONTROLS.libraryStatus}`)?.textContent ?? '';

/** Press Refresh and wait until the library block has drawn past "Reading…" and `ready(root)` holds. */
async function redrawLibrary(testController, root, ready, what) {
    root.querySelector(`.${CONTROLS.refresh}`).click();
    return testController.pollForCondition(
        () => { const t = statusText(root); return t !== '' && t !== 'Reading…' && ready(root); },
        what, TIMEOUT_MS, POLL_MS,
    );
}

/**
 * Run `body({mods, dbName, lib, libAt, backends})` on this row's own database;
 * the start and end assertions and the cleanup are here.
 */
async function withRowLibrary(testController, rowId, body) {
    const restoreTab = rememberActiveTab();
    const realConfirm = dialogs.confirm;
    const dbName = rowDbName(rowId);
    const backends = [];
    let mods = null;
    try {
        mods = await loadLibraryModules();
        testController.log(`boot: ${window.__BUNDLED_TEST_CASES__ ? 'bundled' : 'unbundled'}; database ${dbName}`);
        const existed = await mods.idb.libraryDatabaseExists(dbName);
        testController.reportCondition('the browser lists its databases (indexedDB.databases)', existed !== null);
        testController.reportCondition("at the start, the row's database does not exist", existed === false);
        librarySource.dbName = dbName;
        /** A library on this row's database whose clock is `offsetMs` from now (a draft saved "8 days ago"). */
        const libAt = (offsetMs = 0) => {
            const backend = mods.idb.createIdbBackend({ dbName });
            backends.push(backend);
            return mods.core.createDocumentLibrary({ backend, now: () => Date.now() + offsetMs });
        };
        await body({ mods, dbName, lib: libAt(0), libAt, backends });
    } catch (error) {
        testController.log(`ERROR: ${error?.stack ?? error}`);
        testController.reportCondition(`${rowId} error-free`, false);
    } finally {
        dialogs.confirm = realConfirm;
        librarySource.dbName = null;
        for (const b of backends) { try { await b.close(); } catch { /* best effort */ } }
        if (mods) {
            try {
                const del = await mods.idb.deleteLibraryDatabase(dbName);
                if (del.blocked) testController.log('the delete was blocked for a while by an open connection');
                testController.reportCondition("at the end, the row's database is deleted", del.status === 'deleted');
                testController.reportCondition('…and the browser no longer lists it', (await mods.idb.libraryDatabaseExists(dbName)) === false);
            } catch (e) {
                testController.log(`delete failed: ${e?.name}: ${e?.message}`);
                testController.reportCondition("at the end, the row's database is deleted", false);
            }
        }
        // Redraw on the person's library again, so the panel never shows a deleted test database.
        document.querySelector('.storage-panel')?.querySelector(`.${CONTROLS.refresh}`)?.click();
        restoreTab();
    }
    return testController.getOverallResult();
}

async function storagePanelDocumentLibraryRow(testController) {
    return withRowLibrary(testController, 'storage-panel-document-library-row', async ({ lib, libAt }) => {
        const a = await lib.saveVersion(saveReq(null, 'a1', { label: 'Row set A' }));
        const b = await lib.saveVersion(saveReq(null, 'b1', { label: 'Row set B' }));
        const hold = await lib.hold(b.entry_id, { kind: 'game', tab_id: 'this-page', what: 'row hold' });
        const young = await libAt(-6 * DAY_MS).saveVersion(saveReq(b.lineage_id, 'b-draft-6d', { draft: true, tab: 'closed-tab-6d' }));
        testController.reportCondition('two lineages saved, one held, a 6-day-old draft saved',
            a.status === 'saved' && b.status === 'saved' && hold.status === 'held' && young.status === 'saved');

        const root = await openPanel(testController);
        if (!root) return;
        // ⛓ A panel open with nothing old deletes nothing.
        const drew = await redrawLibrary(testController, root, (r) => !!lineageRow(r, a.lineage_id) && !!lineageRow(r, b.lineage_id),
            'the library rows to be drawn');
        testController.reportCondition('the library is listed under Your data, in its owner\'s group, with both lineages', drew
            && libraryNode(root)?.closest(`.${CONTROLS.section}`)?.dataset.section === 'user');
        const counts0 = (await lib.estimate()).counts;
        testController.assertEqual('a panel open with nothing old deletes nothing (entries: 2 versions + 1 draft)', 3, counts0.entries);
        testController.assertEqual('…and says it auto-cleared nothing', '', noteText(root));
        const bytesOf = (lid) => Number((lineageRow(root, lid)?.querySelector('.sp-chars')?.textContent ?? '').replace(/[^\d]/g, ''));
        const inv = (await lib.inventory()).lineages;
        testController.assertEqual("row A's size is its lineage's distinct body bytes", inv.find((l) => l.lineage_id === a.lineage_id).bytes, bytesOf(a.lineage_id));
        testController.reportCondition('both rows show a size', bytesOf(a.lineage_id) > 0 && bytesOf(b.lineage_id) > 0);
        testController.reportCondition('the status names the database, its saved bytes, the site estimate and persistence',
            /Database archipelago-cc-document-library-test-.* — 2 sets, [\d,]+ bytes of saved documents .*persistence: (granted|best-effort|unknown)/.test(statusText(root)));
        testController.reportCondition('the held row says why, by name', (lineageRow(root, b.lineage_id)?.textContent ?? '').includes('In use: game in tab this-page (row hold)'));

        // ⚖ Q2: a draft saved 8 days ago goes when the panel draws; the 6-day-old one stays.
        const old = await libAt(-8 * DAY_MS).saveVersion(saveReq(a.lineage_id, 'a-draft-8d', { draft: true, tab: 'closed-tab-8d' }));
        testController.reportCondition('a draft is saved with its clock 8 days back', old.status === 'saved');
        const swept = await redrawLibrary(testController, root, (r) => /Auto-cleared 1 leftover draft older than 7 days/.test(noteText(r)),
            'the panel-open cleanup to report the old draft');
        testController.reportCondition('the panel open auto-clears the 8-day-old draft and says so', swept);
        testController.assertEqual('the 8-day-old draft is gone', 'absent', (await lib.getEntry(old.entry_id)).status);
        testController.assertEqual('the 6-day-old draft stays', 'held', (await lib.getEntry(young.entry_id)).status);

        // K1: every Clear asks first; Cancel deletes nothing.
        const asked = [];
        const entriesBefore = (await lib.estimate()).counts;
        dialogs.confirm = (m) => { asked.push(m); return false; };
        lineageRow(root, a.lineage_id)?.querySelector(`.${CONTROLS.libraryClear}`)?.click();
        await testController.pollForCondition(() => asked.length === 1, 'the confirm to be asked', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('Clear asks first, naming the set and what it removes',
            /^Clear "Row set A": remove 1 saved version and 0 drafts \([\d,]+ bytes\) from this site's document library\? This cannot be undone\./.test(asked[0] ?? ''));
        await new Promise((r) => setTimeout(r, 300)); // give a (wrong) delete time to land
        testController.assertEqual('Cancel deletes nothing (every store count unchanged)', JSON.stringify(entriesBefore), JSON.stringify((await lib.estimate()).counts));
        testController.assertEqual('…and lineage A is still there', 'held', (await lib.getEntry(a.entry_id)).status);

        dialogs.confirm = (m) => { asked.push(m); return true; };
        lineageRow(root, a.lineage_id)?.querySelector(`.${CONTROLS.libraryClear}`)?.click();
        const gone = await testController.pollForCondition(() => lineageRow(root, a.lineage_id) === null && noteText(root).startsWith('Cleared "Row set A"'),
            'row A to be cleared', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('Clear on the unheld lineage removes it and its row', gone);
        testController.assertEqual('…in the library too', 'absent', (await lib.getEntry(a.entry_id)).status);

        lineageRow(root, b.lineage_id)?.querySelector(`.${CONTROLS.libraryClear}`)?.click();
        const refused = await testController.pollForCondition(() => noteText(root).startsWith('Not cleared: "Row set B" is in use (game in tab this-page (row hold))'),
            'the held lineage to be refused by name', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('Clear on the held lineage is refused by name', refused);
        testController.assertEqual('…and it is still in the library', 'held', (await lib.getEntry(b.entry_id)).status);

        // "Clear leftover drafts" (⚖ Q2 by hand), confirmed.
        const draftsBtn = libraryNode(root)?.querySelector(`.${CONTROLS.libraryDrafts}`);
        testController.assertEqual('the drafts button counts the drafts', 'Clear leftover drafts (1)', draftsBtn?.textContent);
        draftsBtn?.click();
        const draftsGone = await testController.pollForCondition(() => noteText(root).startsWith('Cleared 1 draft'), 'the drafts to be cleared', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('Clear leftover drafts removes the unheld draft', draftsGone);
        testController.assertEqual('the 6-day-old draft is gone now', 'absent', (await lib.getEntry(young.entry_id)).status);
        testController.reportCondition('it asked first, in the same wording', /^Clear leftover drafts: remove 1 draft from this site's document library\? This cannot be undone\./.test(asked.at(-1) ?? ''));
        await lib.release(hold.hold_id);
    });
}

/** Page A: a same-origin frame with its own document, module realm and IndexedDB connection. */
function pageASource({ coreUrl, idbUrl, dbName, nonce }) {
    const cfg = JSON.stringify({ coreUrl, idbUrl, dbName, nonce, day: DAY_MS });
    return `<!doctype html><meta charset="utf-8"><title>page A</title><script type="module">
const cfg = ${cfg};
const [core, idb] = await Promise.all([import(cfg.coreUrl), import(cfg.idbUrl)]);
const backends = [];
const libAt = (off) => { const b = idb.createIdbBackend({ dbName: cfg.dbName }); backends.push(b); return core.createDocumentLibrary({ backend: b, now: () => Date.now() + off }); };
const tag = (t) => [{ role: 'set', idKey: null, doc: { rows: [t, t + '-room'], size: t.length } }];
const req = (lineageId, t, draft, label) => ({ lineageId, parent: null, draft, savedBecause: draft ? 'draft' : 'report', substrate: 'in-app-test', source: { page: 'page-A', tab_id: 'page-A' }, label, members: tag(t) });
try {
    const lib = libAt(0);
    const x = await lib.saveVersion(req(null, 'x1', false, 'Held by page A'));
    const oldDraft = await libAt(-8 * cfg.day).saveVersion(req(x.lineage_id, 'x-draft-8d', true, null));
    const y = await lib.saveVersion(req(null, 'y1', false, 'Not held'));
    const unheldOld = await libAt(-8 * cfg.day).saveVersion(req(y.lineage_id, 'y-draft-8d', true, null));
    const h1 = await lib.hold(x.entry_id, { kind: 'game', tab_id: 'page-A', what: 'page A game' });
    const h2 = await lib.hold(oldDraft.entry_id, { kind: 'game', tab_id: 'page-A', what: 'page A draft' });
    for (const b of backends) await b.close();
    parent.postMessage({ nonce: cfg.nonce, ok: true, x, oldDraft, y, unheldOld, holds: [h1.status, h2.status] }, '*');
} catch (e) {
    parent.postMessage({ nonce: cfg.nonce, ok: false, error: String(e && e.stack || e) }, '*');
}
<\/script>`;
}

async function storagePanelDocumentLibraryOtherTabHold(testController) {
    let frame = null;
    const result = await withRowLibrary(testController, 'storage-panel-document-library-other-tab-hold', async ({ dbName, lib }) => {
        const nonce = `pageA-${Date.now()}-${Math.random()}`;
        const fromA = new Promise((resolve) => {
            const onMessage = (ev) => {
                // about:srcdoc reports origin "null" to its own location, so it posts to '*'; the answer is authenticated here
                if (ev.source !== frame?.contentWindow || ev.data?.nonce !== nonce) return;
                window.removeEventListener('message', onMessage);
                resolve(ev.data);
            };
            window.addEventListener('message', onMessage);
            setTimeout(() => resolve({ ok: false, error: 'page A never answered' }), TIMEOUT_MS);
        });
        frame = document.createElement('iframe');
        frame.style.display = 'none';
        frame.srcdoc = pageASource({
            coreUrl: new URL('./modules/procgenCore/documentLibrary.js', document.baseURI).href,
            idbUrl: new URL('./modules/procgenCore/documentLibraryIdb.js', document.baseURI).href,
            dbName, nonce,
        });
        document.body.appendChild(frame);
        const a = await fromA;
        if (!a.ok) testController.log(`page A: ${a.error}`);
        testController.reportCondition('page A (its own document and connection) saved two sets, two 8-day-old drafts, and holds one set and one draft',
            a.ok && a.holds.join(',') === 'held,held');
        if (!a.ok) return;

        const root = await openPanel(testController);
        if (!root) return;
        const drew = await redrawLibrary(testController, root, (r) => !!lineageRow(r, a.x.lineage_id) && !!lineageRow(r, a.y.lineage_id),
            'both of page A\'s lineages to be drawn on this page');
        testController.reportCondition("this page's panel lists page A's sets", drew);
        testController.reportCondition("the held row names page A's tab", (lineageRow(root, a.x.lineage_id)?.textContent ?? '').includes('In use: game in tab page-A (page A game)'));
        // The panel-open cleanup ran (the unheld old draft is gone) and spared what page A holds.
        testController.assertEqual("the panel-open cleanup removed the UNHELD 8-day-old draft (so it ran)", 'absent', (await lib.getEntry(a.unheldOld.entry_id)).status);
        testController.assertEqual("…and kept page A's HELD 8-day-old draft", 'held', (await lib.getEntry(a.oldDraft.entry_id)).status);
        testController.assertEqual("…and page A's held set", 'held', (await lib.getEntry(a.x.entry_id)).status);

        dialogs.confirm = () => true;
        lineageRow(root, a.x.lineage_id)?.querySelector(`.${CONTROLS.libraryClear}`)?.click();
        const refused = await testController.pollForCondition(
            () => noteText(root).startsWith('Not cleared: "Held by page A" is in use (game in tab page-A (page A game); game in tab page-A (page A draft))'),
            "this page's Clear to be refused naming page A", TIMEOUT_MS, POLL_MS);
        testController.reportCondition("this page's Clear on page A's held lineage is refused by name, exactly as for this page's own hold", refused);
        testController.assertEqual('…and nothing of it was deleted', 2, (await lib.entriesOf(a.x.lineage_id)).entries.length);
    });
    frame?.remove();
    return result;
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
    ['storage-panel-document-library-row', 'Storage panel: the document library, its sizes, Clear and the 7-day draft cleanup',
        'Its own database: two lineages (one held) listed under Your data with sizes; a panel open with nothing old deletes '
        + 'nothing; a draft 8 days old is auto-cleared on open, a 6-day one stays; Clear asks first and Cancel deletes nothing; '
        + 'Clear removes the unheld lineage and refuses the held one by name; Clear leftover drafts.',
        storagePanelDocumentLibraryRow],
    ['storage-panel-document-library-other-tab-hold', 'Storage panel: a hold from another page refuses the Clear',
        "Page A (a same-origin frame, its own connection) holds a set and an 8-day-old draft; this page's panel refuses "
        + "Clear on that set naming page A's tab, and its panel-open cleanup removes an unheld old draft but keeps A's held one.",
        storagePanelDocumentLibraryOtherTabHold],
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
