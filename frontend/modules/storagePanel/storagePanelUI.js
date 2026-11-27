/**
 * StoragePanelUI — every key in this site's localStorage: who owns it, what kind
 * it is, how big; a Clear per row, per section (none for your own data) and per
 * declared family ("Clear all saved modes"). Nothing about other modules is
 * listed here: owners come from their `moduleInfo.storage` (declarationSource.js).
 *
 * The DOCUMENT LIBRARY (an `idb` declaration, lab arc B2) is drawn in its
 * owner's group under its kind: the database, its body bytes, the site's
 * `navigator.storage.estimate()`, `persisted()`, and one row per lineage with
 * a Clear (refused, by name, while anything holds it), plus "Clear leftover
 * drafts". Each draw runs the library's `cleanup` first (⚖ Q2: drafts older
 * than DRAFT_MAX_AGE_MS go), but only when the database already exists: the
 * panel never creates it.
 *
 * ⛓ BOOT WEIGHT. The library is reached by a computed, document-relative
 * `import()` (B1's pattern), which the bundler leaves alone: it is fetched only
 * when the panel draws, and stays out of `dist/bundle.js`.
 */
import settingsManager from '../../app/core/settingsManager.js';
import { LOCAL_STORAGE_QUOTA_CHARS } from '../../app/core/storageKinds.js';
import {
    buildView, confirmText, familyKeys, formatChars, headerText, idbDeclarations, libraryConfirmText, libraryRows,
    refusalText, sectionKeys,
} from './storageModel.js';
import { collectDeclarations, resetDeclarationCache } from './declarationSource.js';
import { getModuleManager } from './moduleManagerRef.js';

export const MODULE_ID = 'storagePanel';

/**
 * The browser dialog every Clear asks through. A test replaces it for the length
 * of a row and restores it (Quick Launch's seam: the in-app harness installs no
 * dialog handler, and Playwright dismisses one nobody handles).
 */
export const dialogs = {
    confirm: (message) => window.confirm(message),
};

/**
 * Which database the library row reads. `null` = the library's own
 * (`DEFAULT_LIBRARY_DB_NAME`). ⚖ An in-app row sets its OWN database name here
 * for its length and restores `null` (the `dialogs` seam's pattern), so it never
 * reads or clears the person's library.
 */
export const librarySource = {
    dbName: null,
};

const appUrl = (rel) => new URL(rel, document.baseURI).href;

/** The library's modules, fetched raw on either boot (see the header). */
export async function loadLibraryModules() {
    const [core, idb] = await Promise.all([
        import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibrary.js')),
        import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibraryIdb.js')),
    ]);
    return { core, idb };
}

/** Class names the in-app rows drive. */
export const CONTROLS = Object.freeze({
    header: 'sp-header',
    refresh: 'sp-refresh',
    section: 'sp-section',
    sectionClear: 'sp-section-clear',
    group: 'sp-group',
    familyClear: 'sp-family-clear',
    row: 'sp-row',
    rowClear: 'sp-row-clear',
    rowDownload: 'sp-row-download',
    library: 'sp-library',
    libraryStatus: 'sp-library-status',
    libraryRow: 'sp-library-row',
    libraryClear: 'sp-library-clear',
    libraryDrafts: 'sp-library-drafts',
    libraryNote: 'sp-library-note',
});

/** `[{ key, chars }]` for every key in `storage` (chars = key + value, the quota's unit). */
export function readEntries(storage = globalThis.localStorage) {
    const entries = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key === null) continue;
        entries.push({ key, chars: key.length + (storage.getItem(key)?.length ?? 0) });
    }
    return entries;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(className, text, title, onClick) {
    const b = el('button', className, text);
    b.type = 'button';
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
}

export class StoragePanelUI {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState || {};
        /** The view the last render drew (tests read it). */
        this.view = null;
        this.entries = [];
        this.declarations = [];
        this._renderGen = 0;
        this._buildDom();
    }

    getRootElement() { return this.rootElement; }

    onMount() { return this.render(); }

    destroy() {
        this._renderGen += 1;
    }

    _buildDom() {
        this.rootElement = el('div', 'storage-panel');
        const bar = el('div', 'sp-bar');
        this.headerEl = el('span', CONTROLS.header, 'Reading…');
        this.headerEl.title = `The quota is ${formatChars(LOCAL_STORAGE_QUOTA_CHARS)} chars (keys + values), `
            + "Chromium's, measured in plan §37.1. It is per site address: localhost:8000 and every other port "
            + 'or host have their own.';
        bar.appendChild(this.headerEl);
        bar.appendChild(button(CONTROLS.refresh, 'Refresh', 'Read the storage again', () => this.render()));
        this.rootElement.appendChild(bar);
        this.noteEl = el('div', 'sp-note');
        this.rootElement.appendChild(this.noteEl);
        this.bodyEl = el('div', 'sp-body');
        this.rootElement.appendChild(this.bodyEl);
    }

    /** Re-read the storage and the declarations; draw. Resolves when drawn. */
    async render() {
        const gen = ++this._renderGen;
        let collected;
        try {
            collected = await collectDeclarations({ moduleManager: getModuleManager() });
        } catch (e) {
            collected = { declarations: [], errors: [`declarations unreadable: ${e.message}`], failures: [] };
        }
        if (gen !== this._renderGen) return;
        this.declarations = collected.declarations;
        this.entries = readEntries();
        this.view = buildView(this.entries, this.declarations, LOCAL_STORAGE_QUOTA_CHARS);
        this.headerEl.textContent = headerText(this.view);
        const problems = [...collected.errors, ...collected.failures];
        this.noteEl.textContent = problems.length
            ? `Some modules' declarations could not be read, so their keys show as Unknown: ${problems.join('; ')}`
            : '';
        const sections = this.view.sections.map((s) => this._drawSection(s));
        this.bodyEl.replaceChildren(...sections);
        await this._drawDatabases(gen, sections);
    }

    /* ── IndexedDB declarations: the document library ─────────────────── */

    /** Open the library on `dbName`, run `fn(lib)`, close the connection (it never stays open). */
    async _withLibrary(mods, dbName, fn) {
        const backend = mods.idb.createIdbBackend({ dbName });
        try {
            return await fn(mods.core.createDocumentLibrary({ backend }));
        } finally {
            await backend.close();
        }
    }

    /** Draw each `idb` declaration in its kind's section, inside its owner's group. */
    async _drawDatabases(gen, sectionNodes) {
        this.library = null;
        const decls = idbDeclarations(this.declarations);
        if (!decls.length) return;
        let mods = null;
        let loadError = null;
        try { mods = await loadLibraryModules(); } catch (e) { loadError = e; }
        if (gen !== this._renderGen) return;
        for (const decl of decls) {
            const sectionNode = sectionNodes.find((n) => n.dataset.section === decl.kind);
            if (!sectionNode) continue;
            sectionNode.querySelector(':scope > .sp-empty')?.remove();
            const node = el('div', `${CONTROLS.group} ${CONTROLS.library}`);
            node.dataset.owner = decl.moduleId;
            node.dataset.idb = decl.value;
            const head = el('div', 'sp-group-head');
            head.appendChild(el('span', 'sp-owner', decl.owner));
            node.appendChild(head);
            node.appendChild(el('div', 'sp-label', decl.label));
            sectionNode.appendChild(node);
            if (!mods || decl.value !== mods.core.DEFAULT_LIBRARY_DB_NAME) {
                node.appendChild(el('div', CONTROLS.libraryStatus, loadError
                    ? `Database ${decl.value}: the library code did not load (${loadError.message}).`
                    : `Database ${decl.value}: this panel has no reader for it.`));
                continue;
            }
            await this._drawLibrary(gen, mods, decl, node);
        }
    }

    async _drawLibrary(gen, mods, decl, node) {
        const dbName = librarySource.dbName ?? decl.value;
        const status = el('div', CONTROLS.libraryStatus, 'Reading…');
        const note = el('div', CONTROLS.libraryNote);
        node.append(status, note);
        if (this._libraryNote) note.textContent = this._libraryNote;
        this._libraryNote = '';
        const exists = await mods.idb.libraryDatabaseExists(dbName);
        if (gen !== this._renderGen) return;
        if (exists === false) {
            // ⛓ The panel never CREATES the database: nothing saved yet means nothing to open.
            status.textContent = `Database ${dbName}: nothing saved yet.`;
            this.library = { dbName, exists: false, rows: [], cleaned: null };
            return;
        }
        const read = await this._withLibrary(mods, dbName, async (lib) => {
            // ⚖ Q2: the panel runs the cleanup rule when it draws (the writers run it on save).
            const cleaned = await lib.cleanup({ now: Date.now() });
            const inv = await lib.inventory();
            const est = await lib.estimate();
            return { cleaned, inv, est };
        });
        let persisted = null;
        try { persisted = await globalThis.navigator?.storage?.persisted?.() ?? null; } catch { persisted = null; }
        if (gen !== this._renderGen) return;
        const { cleaned, inv, est } = read;
        if (inv.status !== 'ok') {
            status.textContent = `Database ${dbName}: ${inv.status}${inv.why ? ` (${inv.why})` : ''}.`;
            this.library = { dbName, exists, rows: [], cleaned, status: inv.status };
            return;
        }
        const rows = libraryRows(inv.lineages);
        this.library = { dbName, exists, rows, cleaned, estimate: est, persisted };
        const site = est.browser
            ? ` · this site's whole browser storage (estimate): ${formatChars(est.browser.usage)} of ${formatChars(est.browser.quota)} bytes`
            : '';
        status.textContent = `Database ${dbName} — ${rows.length} set${rows.length === 1 ? '' : 's'}, `
            + `${formatChars(est.bodyBytes)} bytes of saved documents${site} · persistence: `
            + `${persisted === true ? 'granted' : persisted === false ? 'best-effort (the browser may evict it when space runs low)' : 'unknown'}`;
        status.title = "Saved documents = the library's own stored bodies (UTF-8 bytes). The site estimate is "
            + "navigator.storage.estimate() for the whole origin: every database, cache and the browser's overhead.";
        if (cleaned?.status === 'cleaned' && cleaned.deletedEntries.length) {
            note.textContent = `Auto-cleared ${cleaned.deletedEntries.length} leftover draft`
                + `${cleaned.deletedEntries.length === 1 ? '' : 's'} older than `
                + `${Math.round(mods.core.DRAFT_MAX_AGE_MS / 86_400_000)} days.`;
        }
        const drafts = rows.reduce((sum, r) => sum + r.drafts, 0);
        if (drafts > 0) {
            const b = button(CONTROLS.libraryDrafts, `Clear leftover drafts (${drafts})`,
                "Drafts are the rolling copies an open lab tab keeps; a closed tab's stay behind.",
                () => this.clearLibraryDrafts(drafts));
            node.querySelector('.sp-group-head').appendChild(b);
        }
        const table = el('table', 'sp-rows');
        for (const row of rows) {
            const tr = el('tr', CONTROLS.libraryRow);
            tr.dataset.lineage = row.lineageId;
            const cell = el('td', 'sp-key-cell');
            cell.appendChild(el('div', 'sp-key', row.label));
            cell.appendChild(el('div', 'sp-label', row.counts));
            if (row.heldText) cell.appendChild(el('div', 'sp-held', row.heldText));
            tr.appendChild(cell);
            tr.appendChild(el('td', 'sp-chars', `${formatChars(row.bytes)} B`));
            const actions = el('td', 'sp-actions');
            actions.appendChild(button(CONTROLS.libraryClear, 'Clear', row.held ? row.heldText : null,
                () => this.clearLineage(row)));
            tr.appendChild(actions);
            table.appendChild(tr);
        }
        node.appendChild(table);
    }

    /**
     * Confirm (K1: the `clearKeys` confirm, through the same `dialogs` seam),
     * then delete one lineage. Returns the library's answer, or null when
     * declined. A lineage something holds is REFUSED by the library and the note
     * says why, by name.
     */
    async clearLineage(row) {
        if (!this.library) return null;
        if (!dialogs.confirm(libraryConfirmText(`Clear "${row.label}"`,
            { versions: row.versions, drafts: row.drafts, bytes: row.bytes }))) return null;
        const mods = await loadLibraryModules();
        const answer = await this._withLibrary(mods, this.library.dbName, (lib) => lib.deleteLineage(row.lineageId));
        this._libraryNote = answer.status === 'refused' ? refusalText(row.label, answer)
            : answer.status === 'deleted' ? `Cleared "${row.label}".`
                : `Not cleared: "${row.label}": ${answer.status}${answer.why ? ` (${answer.why})` : ''}.`;
        await this.render();
        return answer;
    }

    /** Confirm, then delete every draft nothing holds ("Clear leftover drafts", ⚖ Q2 by hand). */
    async clearLibraryDrafts(drafts) {
        if (!this.library) return null;
        if (!dialogs.confirm(libraryConfirmText('Clear leftover drafts', { drafts, draftsOnly: true }))) return null;
        const mods = await loadLibraryModules();
        const answer = await this._withLibrary(mods, this.library.dbName, (lib) => lib.deleteDrafts());
        this._libraryNote = answer.status === 'deleted'
            ? `Cleared ${answer.deletedEntries.length} draft${answer.deletedEntries.length === 1 ? '' : 's'}`
                + (answer.kept.length ? `; kept ${answer.kept.length} in use (${answer.kept.map((h) => `${h.kind} in tab ${h.tab_id}`).join('; ')}).` : '.')
            : `Drafts not cleared: ${answer.status}${answer.why ? ` (${answer.why})` : ''}.`;
        await this.render();
        return answer;
    }

    _sizeOf(key) {
        return this.entries.find((e) => e.key === key)?.chars ?? 0;
    }

    _drawSection(section) {
        const node = el('section', CONTROLS.section);
        node.dataset.section = section.id;
        const head = el('div', 'sp-section-head');
        head.appendChild(el('h3', 'sp-section-title',
            `${section.title} — ${section.count} key${section.count === 1 ? '' : 's'}, ${formatChars(section.chars)} chars`));
        if (section.sectionClear && section.count > 0) {
            head.appendChild(button(CONTROLS.sectionClear, section.sectionClear, null,
                () => this.clearKeys(section.sectionClear, sectionKeys(section))));
        }
        node.appendChild(head);
        node.appendChild(el('p', 'sp-blurb', section.blurb));
        if (section.count === 0) node.appendChild(el('p', 'sp-empty', 'Nothing here.'));
        for (const group of section.groups) node.appendChild(this._drawGroup(section, group));
        return node;
    }

    _drawGroup(section, group) {
        const node = el('div', CONTROLS.group);
        node.dataset.owner = group.id;
        const head = el('div', 'sp-group-head');
        head.appendChild(el('span', 'sp-owner', `${group.owner} — ${formatChars(group.chars)} chars`));
        for (const family of group.families) {
            const b = button(CONTROLS.familyClear, family.clearAll, family.label,
                () => this.clearKeys(family.clearAll, familyKeys(family, this.entries, this.declarations)));
            b.dataset.family = family.value;
            head.appendChild(b);
        }
        node.appendChild(head);
        const table = el('table', 'sp-rows');
        for (const row of group.rows) {
            const tr = el('tr', CONTROLS.row);
            tr.dataset.key = row.key;
            // The label sits under the key in one cell: a separate column squeezed the
            // key to a couple of characters in a narrow panel.
            const keyCell = el('td', 'sp-key-cell');
            keyCell.appendChild(el('div', 'sp-key', row.key));
            if (row.label) keyCell.appendChild(el('div', 'sp-label', row.label));
            tr.appendChild(keyCell);
            tr.appendChild(el('td', 'sp-chars', formatChars(row.chars)));
            tr.appendChild(el('td', 'sp-pct', row.pctOfQuota));
            const actions = el('td', 'sp-actions');
            if (section.id === 'user') {
                actions.appendChild(button(CONTROLS.rowDownload, 'Download', 'Save this key\'s value as a file first',
                    () => this.download(row.key)));
            }
            actions.appendChild(button(CONTROLS.rowClear, 'Clear', null, () => this.clearKeys(`Clear "${row.key}"`, [row.key])));
            tr.appendChild(actions);
            table.appendChild(tr);
        }
        node.appendChild(table);
        return node;
    }

    /**
     * Confirm, remove `keys`, redraw. Returns the keys removed ([] when declined).
     * The page's in-memory state is left alone (the confirm says so for the
     * current mode's saved settings).
     */
    async clearKeys(what, keys) {
        if (!keys.length) return [];
        const currentModeKey = settingsManager.getStorageKey?.() ?? null;
        if (!dialogs.confirm(confirmText(what, keys, (k) => this._sizeOf(k), currentModeKey))) return [];
        const removed = [];
        for (const key of keys) {
            try {
                localStorage.removeItem(key);
                removed.push(key);
            } catch (e) {
                console.error(`[storagePanel] could not remove "${key}":`, e);
            }
        }
        await this.render();
        return removed;
    }

    /** Offer `key`'s value as a download (`<key>.json` when it parses, else `.txt`). */
    download(key) {
        const value = localStorage.getItem(key);
        if (value === null) return;
        let isJson = true;
        try { JSON.parse(value); } catch { isJson = false; }
        const blob = new Blob([value], { type: isJson ? 'application/json' : 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${key.replace(/[^\w.-]+/g, '_')}.${isJson ? 'json' : 'txt'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }

    /** Forget the collected declarations and redraw (after a module was enabled). */
    async reloadDeclarations() {
        resetDeclarationCache();
        await this.render();
    }
}
