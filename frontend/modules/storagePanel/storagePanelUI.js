/**
 * StoragePanelUI — every key in this site's localStorage: who owns it, what kind
 * it is, how big; a Clear per row, per section (none for your own data) and per
 * declared family ("Clear all saved modes"). Nothing about other modules is
 * listed here: owners come from their `moduleInfo.storage` (declarationSource.js).
 */
import settingsManager from '../../app/core/settingsManager.js';
import { LOCAL_STORAGE_QUOTA_CHARS } from '../../app/core/storageKinds.js';
import {
    buildView, confirmText, familyKeys, formatChars, headerText, sectionKeys,
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
        this.bodyEl.replaceChildren(...this.view.sections.map((s) => this._drawSection(s)));
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
