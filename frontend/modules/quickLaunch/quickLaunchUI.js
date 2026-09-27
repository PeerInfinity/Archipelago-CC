/**
 * QuickLaunchUI — the Quick Launch panel: a header line, a "Modules ⇄" button,
 * the user's own arrangement (the stored tree, quickLaunchTree.js), then the
 * virtual groups (Unfiled, All panels, Help) as `<details>` sections.
 *
 * Everything drawn comes from `buildCatalog` over the live registry at render
 * time; the panel re-renders on `module:stateChanged` so the state dots follow
 * panels being opened and closed. The DOM is built with createElement +
 * textContent throughout.
 */

import eventBus from '../../app/core/eventBus.js';
import settingsManager from '../../app/core/settingsManager.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { DOCS_LINK_TARGETS, docsHref } from '../../app/config/docsBase.js';
import { debounce } from '../commonUI/index.js';
import { DOCS_INDEX, HELP_SECTIONS } from './generated/docsIndex.js';
import { VIRTUAL_GROUPS, buildCatalog, helpDocs } from './quickLaunchCatalog.js';
import { buildViewModel, countText, filterView, foldAll, groupIds, groupSize, knownCollapsed } from './quickLaunchFilter.js';
import {
    EMPTY_TREE, NODE_KINDS, addGroup, addRef, addUrl, deleteNode, findNode, groupsOf, migrate, moveDown, moveNode,
    moveUp, refCounts, renameGroup,
} from './quickLaunchTree.js';
import { getModuleManager } from './moduleManagerRef.js';

// Declared here, not in index.js: index.js imports this file and reads MODULE_ID
// at evaluation (moduleInfo.name), and tests/testCases/quickLaunchTests.js imports
// it from here. This file must never import ./index.js — with that edge, importing
// this file FIRST (test discovery, in a mode where quickLaunch is disabled) ran
// index.js before MODULE_ID existed: the TDZ ReferenceError of slice P9. The module
// manager handle lives in moduleManagerRef.js for that reason.
export const MODULE_ID = 'quickLaunch';
export const RENDER_DEBOUNCE_MS = 50;
export const DOCS_LINK_SETTING = `moduleSettings.${MODULE_ID}.docsLinkTarget`;
export const TREE_KEY = 'tree';
export const TREE_SETTING = `moduleSettings.${MODULE_ID}.${TREE_KEY}`;
/** The two views over the same groups: compact rows, or cards that add each item's text. */
export const VIEWS = Object.freeze({ tree: 'tree', cards: 'cards' });
export const VIEW_KEY = 'view';
export const VIEW_SETTING = `moduleSettings.${MODULE_ID}.${VIEW_KEY}`;
/**
 * The ids of the groups folded shut — the user's own AND the built-in ones
 * (`all-panels`, `all-panels/<category>`, `help`, `help/<dir>`, `help/<dir>/<sub>`,
 * `unfiled`; saved since P7). Saved per mode.
 */
export const COLLAPSED_KEY = 'collapsedGroups';
export const COLLAPSED_SETTING = `moduleSettings.${MODULE_ID}.${COLLAPSED_KEY}`;
/** Draw the `developer` Help sections too (HELP_SECTIONS audience); off by default. */
export const DEVELOPER_DOCS_KEY = 'showDeveloperDocs';
export const DEVELOPER_DOCS_SETTING = `moduleSettings.${MODULE_ID}.${DEVELOPER_DOCS_KEY}`;
export const FILTER_PLACEHOLDER = 'Filter…';
/**
 * The fold button's two states, by what its NEXT click does (⚖ the user,
 * 2026-09-26: "clicking the button does what the button says, and switches the
 * button to the other mode, no matter what the current expansion and collapse
 * state is"). The state is the panel's own: every panel starts at `collapse`;
 * it is not saved.
 */
export const FOLD_MODES = Object.freeze({ collapse: 'collapse', expand: 'expand' });
export const FOLD_TEXT = Object.freeze({ collapse: 'Collapse all', expand: 'Expand all' });
export const FOLD_TITLE = Object.freeze({
    collapse: 'Fold every group shut',
    expand: 'Open every group',
});
/**
 * The fold button's tooltip while the filter box has text: the button is
 * disabled then (⚖ the user, 2026-09-26 — a fold under a filter has no
 * visible meaning, since the filter draws every group holding a match open).
 */
export const FOLD_DISABLED_TITLE = 'Clear the filter to fold';
export const MODULES_TEXT = 'Modules ⇄';
export const EDIT_TEXT = 'Edit';
export const CARDS_TEXT = 'Cards';
export const NO_MATCH_TEXT = 'Nothing matches the filter.';
/** The match count's tooltip ("N of M" — the rows drawn, of the rows the panel draws unfiltered). */
export const COUNT_TITLE = 'Rows shown, of all rows';
export const DOC_ICON = '📄';
export const URL_ICON = '🔗';
export const MISSING_ICON = '✕';
/** Edit mode's badge on a built-in group's row that is filed in your groups: "N×". */
export const filedText = (n) => `${n}×`;
export const filedTitle = (n) => `Filed ${n === 1 ? 'once' : `${n} times`} in your groups`;
export const MODULES_TARGET = Object.freeze({ moduleId: 'modules', componentType: 'modulesPanel' });
const REFRESH_EVENTS = ['module:stateChanged', 'app:readyForUiDataLoad', 'settings:changed'];

/** Edit mode's controls: one class each, so tests and CSS address them by name. */
export const CONTROLS = Object.freeze({
    edit: 'ql-edit',
    view: 'ql-view',
    filter: 'ql-filter',
    count: 'ql-count',
    fold: 'ql-fold',
    up: 'ql-ctl-up',
    down: 'ql-ctl-down',
    rename: 'ql-ctl-rename',
    remove: 'ql-ctl-delete',
    moveTo: 'ql-ctl-move',
    addGroup: 'ql-ctl-add-group',
    addUrl: 'ql-ctl-add-url',
    addTo: 'ql-ctl-add-to',
    filed: 'ql-filed',
});
/** The "move to" / "add to" value meaning the top level of the tree. */
export const ROOT_CHOICE = '__root__';
export const ROOT_CHOICE_LABEL = '(top level)';
export const DELETE_GROUP_CONFIRM = 'Delete this group and everything in it?';
/**
 * Edit mode's inline forms (P3; they replace `prompt()`): ✎ turns a group's
 * label into an input, "+ group" and "+ url" open a form at the end of the
 * list they add to. Enter (or the Add button) commits, Escape cancels, and
 * focus leaving the form commits what it holds (an empty name or address
 * cancels). One class each, so tests and CSS address them by name.
 */
export const INLINE = Object.freeze({
    form: 'ql-inline-form',
    rename: 'ql-inline-rename',
    group: 'ql-inline-group',
    href: 'ql-inline-href',
    label: 'ql-inline-label',
    add: 'ql-inline-add',
});
export const NEW_GROUP_PLACEHOLDER = 'Name of the new group';
export const URL_HREF_PLACEHOLDER = 'https://…';
export const URL_LABEL_PLACEHOLDER = 'Label (optional)';
export const URL_ADD_TEXT = 'Add';

/**
 * The browser dialog edit mode still asks through: deleting a group that holds
 * something. A test replaces it for the length of a row and restores it:
 * Playwright dismisses a dialog nobody handles (confirm → false), and the
 * in-app harness installs no handler.
 */
export const dialogs = {
    confirm: (message) => window.confirm(message),
};

/** "N panels · M docs" (M = the docs Help draws) — the header line, exported so the in-app test builds the same string. */
export function headerText(catalog) {
    return `${catalog.panels.length} panels · ${helpDocs(catalog).length} docs`;
}

/**
 * Bring a panel forward, reopening it if it was closed.
 *
 * Desktop (a Golden Layout instance exists): `moduleManager.enableModule` — it
 * activates an open panel's tab, recreates a closed one in its column, and
 * loads a module that was never enabled. `ui:activatePanel` is NOT used there:
 * the panel manager's handler does nothing for a tab that is not in the layout.
 *
 * Mobile (no `window.goldenLayoutInstance`): `enableModule` reaches the desktop
 * panel manager, which the mobile layout never initializes — for an enabled
 * module it logs "Cannot activate panel" and returns, for a disabled one
 * `createPanelForComponent` refuses. The mobile layout manager subscribes
 * `ui:activatePanel` and shows the tab (`mobileLayoutManager.js` showPanel), so
 * on mobile this publishes that instead; it reaches the tabs mobile built at boot.
 */
export function activate(moduleId, componentType) {
    if (typeof window !== 'undefined' && window.goldenLayoutInstance) {
        return getModuleManager()?.enableModule(moduleId);
    }
    eventBus.publish('ui:activatePanel', { panelId: componentType }, MODULE_ID);
    return undefined;
}

export class QuickLaunchUI {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState || {};
        /**
         * The collapsedGroups setting as a Set: its CACHE. The setting is the one
         * source of truth — every render reloads this from it, and every change
         * (a summary toggle, the fold button) goes through `_writeCollapsed`.
         */
        this.collapsed = new Set();
        /** The collapsedGroups array as last read or written. */
        this.collapsedStored = [];
        /** The filter box's text; never saved. */
        this.query = '';
        /** The stored tree as last read or written (migrated). */
        this.tree = EMPTY_TREE;
        this.editing = false;
        /** The view setting as last read or written. */
        this.view = VIEWS.tree;
        /** What the fold button's next click does (FOLD_MODES); never saved. */
        this.foldMode = FOLD_MODES.collapse;
        /** The model the last render drew (filtered when a filter is on): what the fold button acts on. */
        this._shown = null;
        /** Bumped by every render; a render whose awaits finish after a newer one started draws nothing. */
        this._renderGen = 0;
        this._unsubs = [];
        this._buildDom();
        /** The inline form open now ({ close }), or null; a render it would destroy waits for it to close. */
        this._inline = null;
        this._renderDeferred = false;
        this._scheduleRender = debounce(() => {
            if (this._inline) this._renderDeferred = true;
            else this.render();
        }, RENDER_DEBOUNCE_MS);
        for (const event of REFRESH_EVENTS) {
            this._unsubs.push(eventBus.subscribe(event, (payload) => {
                // Our own tree / view write: `_apply` / `setView` has already rendered from it.
                if (payload?.key === TREE_SETTING && payload.value === this.tree) return;
                if (payload?.key === VIEW_SETTING && payload.value === this.view) return;
                if (payload?.key === COLLAPSED_SETTING && payload.value === this.collapsedStored) return;
                this._scheduleRender();
            }, MODULE_ID));
        }
    }

    getRootElement() { return this.rootElement; }

    onMount() { this.render(); }

    destroy() {
        for (const off of this._unsubs) off();
        this._unsubs = [];
    }

    _buildDom() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'quick-launch-panel';
        const bar = document.createElement('div');
        bar.className = 'ql-bar';
        this.headerEl = document.createElement('span');
        this.headerEl.className = 'ql-header';
        const modulesButton = document.createElement('button');
        modulesButton.type = 'button';
        modulesButton.className = 'ql-modules';
        modulesButton.textContent = MODULES_TEXT;
        modulesButton.title = 'Open the Modules panel';
        modulesButton.addEventListener('click', () => activate(MODULES_TARGET.moduleId, MODULES_TARGET.componentType));
        this.editButton = document.createElement('button');
        this.editButton.type = 'button';
        this.editButton.className = CONTROLS.edit;
        this.editButton.textContent = EDIT_TEXT;
        this.editButton.title = 'Arrange your own groups (the built-in groups stay as they are)';
        this.editButton.setAttribute('aria-pressed', 'false');
        this.editButton.addEventListener('click', () => this.setEditing(!this.editing));
        this.viewButton = document.createElement('button');
        this.viewButton.type = 'button';
        this.viewButton.className = CONTROLS.view;
        this.viewButton.textContent = CARDS_TEXT;
        this.viewButton.title = 'Show every item as a card with its description (press again for the compact tree)';
        this.viewButton.setAttribute('aria-pressed', 'false');
        this.viewButton.addEventListener('click',
            () => this.setView(this.view === VIEWS.cards ? VIEWS.tree : VIEWS.cards));
        this.filterInput = document.createElement('input');
        this.filterInput.type = 'search';
        this.filterInput.className = CONTROLS.filter;
        this.filterInput.placeholder = FILTER_PLACEHOLDER;
        this.filterInput.title = 'Show only the items whose title, description or group matches (Esc clears)';
        this.filterInput.addEventListener('input', () => {
            this.query = this.filterInput.value;
            this._scheduleRender();
        });
        // Escape clears the box (and re-renders); with the box already empty it does nothing.
        this.filterInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !this.filterInput.value) return;
            e.preventDefault();
            this.filterInput.value = '';
            this.query = '';
            this.render();
        });
        this.countEl = document.createElement('span');
        this.countEl.className = CONTROLS.count;
        this.countEl.title = COUNT_TITLE;
        this.countEl.hidden = true;
        this.foldButton = document.createElement('button');
        this.foldButton.type = 'button';
        this.foldButton.className = CONTROLS.fold;
        this.foldButton.addEventListener('click', () => this.fold());
        this._showFoldMode();
        // Two rows: the header and the filter, then the buttons — so nothing wraps in the narrow left column.
        const top = document.createElement('div');
        top.className = 'ql-bar-row ql-bar-top';
        top.append(this.headerEl, this.filterInput, this.countEl);
        const buttons = document.createElement('div');
        buttons.className = 'ql-bar-row ql-bar-buttons';
        buttons.append(this.viewButton, this.foldButton, this.editButton, modulesButton);
        bar.append(top, buttons);
        this.groupsEl = document.createElement('div');
        this.groupsEl.className = 'ql-groups';
        this.rootElement.append(bar, this.groupsEl);
        // A destroyed panel (closed tab) must stop re-rendering.
        this.container?.on?.('destroy', () => this.destroy());
    }

    /** The catalog over the live registry and module states; Help drawn per `showDeveloperDocs`. */
    catalog(showDeveloperDocs = false) {
        const manager = getModuleManager();
        return buildCatalog({
            panelComponents: centralRegistry.getAllPanelComponents(),
            moduleStates: manager?.getAllModuleStates?.() ?? {},
            docsIndex: DOCS_INDEX,
            helpSections: HELP_SECTIONS,
            showDeveloperDocs,
            loadPriority: manager?.getLoadPriority?.() ?? [],
        });
    }

    setEditing(on) {
        this.editing = !!on;
        this.editButton.setAttribute('aria-pressed', String(this.editing));
        this.rootElement.classList.toggle('ql-editing', this.editing);
        return this.render();
    }

    /** The fold button's text (its mode) and, disabled while the filter has text, its tooltip. */
    _showFoldMode() {
        this.foldButton.textContent = FOLD_TEXT[this.foldMode];
        this.foldButton.disabled = !!this._filtering;
        this.foldButton.title = this._filtering ? FOLD_DISABLED_TITLE : FOLD_TITLE[this.foldMode];
    }

    /**
     * The fold button: do what it says to every group the last render drew —
     * the user's and the built-in ones alike, one `collapsedGroups` write
     * (skipped by the settings:changed guard) — then show the other mode. Does
     * nothing while the filter has text (the button is disabled then).
     */
    async fold() {
        const shown = this._shown;
        if (this._filtering || !shown) return;
        const open = this.foldMode === FOLD_MODES.expand;
        this.foldMode = open ? FOLD_MODES.collapse : FOLD_MODES.expand;
        this._showFoldMode();
        await this._writeCollapsed(foldAll(shown, open, [...this.collapsed]));
        await this.render();
    }

    /**
     * THE write of `collapsedGroups` (the fold button and every summary toggle):
     * `ids` cut to the groups this tree and catalog can draw (`knownCollapsed` —
     * the developer sections counted even while hidden, and Unfiled even while
     * the tree is empty, so hiding them does not forget their folds), then the
     * cache follows. Our own write is skipped by the settings:changed guard.
     */
    _writeCollapsed(ids) {
        const model = buildViewModel(this.tree, this.catalog(true));
        const next = knownCollapsed(ids, new Set([...groupIds(model), VIRTUAL_GROUPS.unfiled.id]));
        this.collapsed = new Set(next);
        this.collapsedStored = next;
        return settingsManager.updateModuleSetting(MODULE_ID, COLLAPSED_KEY, next);
    }

    /** Switch views: write the setting (per mode, like the tree) and render from it. */
    async setView(view) {
        this.view = view === VIEWS.cards ? VIEWS.cards : VIEWS.tree;
        await settingsManager.updateModuleSetting(MODULE_ID, VIEW_KEY, this.view);
        await this.render();
    }

    /**
     * One edit: run a pure op on the current tree, write the result, render
     * from it. The write publishes `settings:changed` for our own key; the
     * subscriber skips that event (its value IS `this.tree`), so an edit
     * renders once, not twice. A refused op (RangeError) changes nothing.
     * The op runs on the setting as it is NOW, not on the last render's copy.
     */
    async _apply(op, ...args) {
        const current = migrate(await settingsManager.getSetting(TREE_SETTING, EMPTY_TREE));
        let next;
        try {
            next = op(current, ...args);
        } catch (err) {
            console.warn('[quickLaunch] edit refused:', err.message);
            return;
        }
        if (next === current) return;
        this.tree = next;
        await settingsManager.updateModuleSetting(MODULE_ID, TREE_KEY, next);
        await this.render();
    }

    async render() {
        // An open inline form stays live while this render reads the settings; it is carried across the redraw below.
        this._renderDeferred = false;
        const gen = ++this._renderGen;
        const target = await settingsManager.getSetting(DOCS_LINK_SETTING, DOCS_LINK_TARGETS.github);
        const tree = migrate(await settingsManager.getSetting(TREE_SETTING, EMPTY_TREE));
        const view = await settingsManager.getSetting(VIEW_SETTING, VIEWS.tree);
        const stored = await settingsManager.getSetting(COLLAPSED_SETTING, []);
        const developerDocs = await settingsManager.getSetting(DEVELOPER_DOCS_SETTING, false);
        if (gen !== this._renderGen) return; // a newer render is under way; it draws
        this.tree = tree;
        this._loadCollapsed(stored);
        this.view = view === VIEWS.cards ? VIEWS.cards : VIEWS.tree;
        this.viewButton.setAttribute('aria-pressed', String(this.view === VIEWS.cards));
        this.rootElement.classList.toggle('ql-cards', this.view === VIEWS.cards);
        const catalog = this.catalog(developerDocs === true);
        this.headerEl.textContent = headerText(catalog);
        const model = buildViewModel(this.tree, catalog);
        const shown = filterView(model, this.query);
        // While filtering, every group drawn is open (it holds a match); `collapsed` is left as it is.
        this._filtering = shown !== model;
        this._shown = shown;
        this._showFoldMode();
        this.countEl.hidden = !this._filtering;
        this.countEl.textContent = this._filtering ? countText(model, shown) : '';
        const sections = [];
        if (this.editing) sections.push(this._rootControls());
        if (shown.stored.length) sections.push(this._stored(shown.stored, target));
        sections.push(...shown.groups.map((g) => this._group(g, target)));
        if (this._filtering && !shown.stored.length && !shown.groups.length) {
            const none = document.createElement('p');
            none.className = 'ql-no-match';
            none.textContent = NO_MATCH_TEXT;
            sections.push(none);
        }
        const carried = this._carryInline();
        this.groupsEl.replaceChildren(...sections);
        carried?.();
    }

    /**
     * ⛓ P7 — THE INLINE-FORM RACE. A form opened while an earlier commit's
     * `_apply` is still awaiting its write was closed by that commit's render,
     * with what had been typed (measured: ✎ on B straight after Enter on A, the
     * write slowed to 600 ms — B's input, focused and holding its text, was gone
     * when the write landed). So a render CARRIES the open form across its
     * redraw: this closes it and returns a function that re-opens it on the new
     * DOM with its text, focus and caret (null when no form is open). A form
     * whose target is gone (its group deleted) is not re-opened. Deferring the
     * render instead was the alternative: it would leave the commit before it
     * undrawn (A's old label) for as long as the form stays open.
     */
    _carryInline() {
        const form = this._inline;
        if (!form) return null;
        const inputs = [...form.el.querySelectorAll('input')];
        const values = inputs.map((i) => i.value);
        const focused = inputs.indexOf(document.activeElement);
        const caret = focused >= 0 ? [inputs[focused].selectionStart, inputs[focused].selectionEnd] : null;
        form.close();
        return () => {
            const el = form.reopen?.();
            if (!el) return;
            const again = [...el.querySelectorAll('input')];
            again.forEach((input, i) => { if (i < values.length) input.value = values[i]; });
            const target = again[focused];
            if (target) {
                target.focus();
                if (caret) target.setSelectionRange(...caret);
            }
        };
    }

    /** The collapsedGroups setting as last read: the cache `collapsed` is replaced by it. */
    _loadCollapsed(stored) {
        this.collapsedStored = stored;
        this.collapsed = new Set(Array.isArray(stored) ? stored : []);
    }

    /**
     * Wire a group's `<details>`: its initial state, and a reader's toggle
     * writing `collapsedGroups` (every group, built-in or the user's). Setting
     * `open` fires `toggle` too, so only a real change counts; a group drawn
     * forced-open by the filter records nothing.
     */
    _collapsible(details, id) {
        const forced = this._filtering;
        details.open = forced || !this.collapsed.has(id);
        details.addEventListener('toggle', () => {
            if (forced || !details.isConnected) return;
            const nowCollapsed = !details.open;
            if (nowCollapsed === this.collapsed.has(id)) return;
            const next = new Set(this.collapsed);
            if (nowCollapsed) next.add(id);
            else next.delete(id);
            this._writeCollapsed([...next]);
        });
    }

    /** The user's tree: one list in stored order, a group as a nested `<details>`. */
    _stored(nodes, target) {
        const list = document.createElement('ul');
        list.className = 'ql-list ql-root';
        list.append(...nodes.map((n) => this._node(n, target)));
        return list;
    }

    _node(node, target) {
        let li;
        if (node.kind === NODE_KINDS.group) {
            li = document.createElement('li');
            li.className = 'ql-user-group';
            li.append(this._userGroup(node, target));
        } else if (node.missing) {
            li = this._missingRow(node);
        } else if (node.kind === NODE_KINDS.panel) {
            li = this._panelRow(node.item, target);
        } else if (node.kind === NODE_KINDS.doc) {
            li = this._docRow(node.item, target);
        } else {
            li = this._urlRow(node);
        }
        li.classList.add('ql-node');
        li.dataset.nodeId = node.id;
        li.dataset.kind = node.kind;
        if (this.editing && node.kind !== NODE_KINDS.group) li.append(this._nodeControls(node));
        return li;
    }

    _button(className, text, title, onClick) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ql-ctl ${className}`;
        b.textContent = text;
        b.title = title;
        b.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return b;
    }

    /** A `<select>` whose first option is an inert placeholder; picking a choice calls `onPick(groupId|null)`. */
    _select(className, placeholder, choices, onPick) {
        const select = document.createElement('select');
        select.className = `ql-ctl ${className}`;
        const head = document.createElement('option');
        head.value = '';
        head.textContent = placeholder;
        head.disabled = true;
        head.selected = true;
        select.append(head);
        for (const { value, label } of choices) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.append(option);
        }
        select.addEventListener('change', () => {
            if (select.value) onPick(select.value === ROOT_CHOICE ? null : select.value);
        });
        return select;
    }

    /** The top level plus every group, indented by depth — minus `excludeId`'s own subtree. */
    _groupChoices(excludeId = null) {
        const excluded = new Set();
        if (excludeId) {
            const hit = findNode(this.tree, excludeId);
            if (hit?.node.kind === NODE_KINDS.group) {
                excluded.add(excludeId);
                for (const g of groupsOf({ nodes: hit.node.children })) excluded.add(g.id);
            }
        }
        return [
            { value: ROOT_CHOICE, label: ROOT_CHOICE_LABEL },
            ...groupsOf(this.tree).filter((g) => !excluded.has(g.id))
                .map((g) => ({ value: g.id, label: `${'\u00a0\u00a0'.repeat(g.depth + 1)}${g.label}` })),
        ];
    }

    /** "+ group" and "+ url" into `parentId` (null = the top level): each opens an inline form. */
    _addButtons(parentId) {
        return [
            this._button(CONTROLS.addGroup, '+ group', 'Add a group here', () => this._openGroupForm(parentId)),
            this._button(CONTROLS.addUrl, '+ url', 'Add a link here', () => this._openUrlForm(parentId)),
        ];
    }

    /** An `<input>` for an inline form; clicks and keys stay inside it (a `<summary>` parent would toggle). */
    _inlineInput(className, placeholder, value = '') {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = `ql-ctl ${className}`;
        input.placeholder = placeholder;
        input.value = value;
        input.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
        input.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); });
        return input;
    }

    /**
     * Run an inline form: `el` is its box, `commit()` returns the op to apply
     * (`[op, ...args]`) or null (nothing to add). Enter commits, Escape
     * cancels, focus leaving `el` commits. Closing re-renders (through the
     * commit's `_apply`, or directly). `reopen()` opens the same form afresh
     * and returns its box, or null — what a render carrying it calls (`_carryInline`).
     */
    _runInline(el, commit, focus, reopen) {
        this._inline?.close();
        let open = true;
        const close = () => { open = false; if (this._inline?.el === el) this._inline = null; };
        const finish = (apply) => {
            if (!open) return;
            close();
            const op = apply ? commit() : null;
            if (op) this._apply(...op);
            else this.render();
        };
        this._inline = { el, close, reopen };
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        });
        el.addEventListener('focusout', (e) => {
            if (!el.contains(e.relatedTarget) && el.isConnected) finish(true);
        });
        el.finish = finish;
        focus.focus();
        return el;
    }

    /** The list `parentId`'s children are drawn in (null = the top level), created when the tree is empty. */
    _targetList(parentId) {
        if (parentId) {
            const details = this.groupsEl.querySelector(`details.ql-user[data-group-id="${parentId}"]`);
            if (!details) return null;
            details.open = true;
            return details.querySelector(':scope > .ql-list');
        }
        let list = this.groupsEl.querySelector(':scope > .ql-root');
        if (!list) {
            list = document.createElement('ul');
            list.className = 'ql-list ql-root';
            this.groupsEl.querySelector(':scope > .ql-root-ctl')?.after(list);
        }
        return list;
    }

    /** "+ group": a name input at the end of the list the group goes into (returns its box, or null). */
    _openGroupForm(parentId) {
        const list = this._targetList(parentId);
        if (!list) return null;
        const li = document.createElement('li');
        li.className = INLINE.form;
        const input = this._inlineInput(INLINE.group, NEW_GROUP_PLACEHOLDER);
        li.append(input);
        list.append(li);
        return this._runInline(li, () => {
            const label = input.value.trim();
            return label ? [addGroup, parentId, label] : null;
        }, input, () => this._openGroupForm(parentId));
    }

    /** "+ url": address and label inputs and an Add button, at the end of the list the link goes into (its box, or null). */
    _openUrlForm(parentId) {
        const list = this._targetList(parentId);
        if (!list) return null;
        const li = document.createElement('li');
        li.className = INLINE.form;
        const href = this._inlineInput(INLINE.href, URL_HREF_PLACEHOLDER);
        const label = this._inlineInput(INLINE.label, URL_LABEL_PLACEHOLDER);
        const add = this._button(INLINE.add, URL_ADD_TEXT, 'Add the link', () => li.finish(true));
        li.append(href, label, add);
        list.append(li);
        return this._runInline(li, () => {
            const address = href.value.trim();
            return address ? [addUrl, parentId, address, label.value.trim() || address] : null;
        }, href, () => this._openUrlForm(parentId));
    }

    /** ✎: the group's label becomes an input in its summary (returns its box, or null). */
    _openRename(node) {
        const summary = node && this.groupsEl.querySelector(`details.ql-user[data-group-id="${node.id}"] > summary`);
        if (!summary) return null;
        const input = this._inlineInput(INLINE.rename, node.label, node.label);
        summary.replaceChildren(input);
        this._runInline(summary, () => {
            const label = input.value.trim();
            return label && label !== node.label ? [renameGroup, node.id, label] : null;
        }, input, () => this._openRename(findNode(this.tree, node.id)?.node));
        input.select();
        return summary;
    }

    _rootControls() {
        const row = document.createElement('div');
        row.className = 'ql-ctl-row ql-root-ctl';
        row.append(...this._addButtons(null));
        return row;
    }

    /** ▲ ▼ (✎ for a group) ✕ and "move to ▾" for one stored node. */
    _nodeControls(node) {
        const box = document.createElement('span');
        box.className = 'ql-ctls';
        box.append(
            this._button(CONTROLS.up, '▲', 'Move up', () => this._apply(moveUp, node.id)),
            this._button(CONTROLS.down, '▼', 'Move down', () => this._apply(moveDown, node.id)),
        );
        if (node.kind === NODE_KINDS.group) {
            box.append(this._button(CONTROLS.rename, '✎', 'Rename', () => this._openRename(node)));
        }
        box.append(
            this._button(CONTROLS.remove, '✕', 'Remove from your groups', () => {
                const nonEmpty = node.kind === NODE_KINDS.group && node.children.length > 0;
                if (nonEmpty && !dialogs.confirm(DELETE_GROUP_CONFIRM)) return;
                this._apply(deleteNode, node.id);
            }),
            this._select(CONTROLS.moveTo, 'move to ▾', this._groupChoices(node.id),
                (parentId) => this._apply(moveNode, node.id, parentId, Infinity)),
        );
        return box;
    }

    /** "N×": how many times a built-in group's row is filed in the stored tree (edit mode, N ≥ 1). */
    _filedBadge(n) {
        const badge = document.createElement('span');
        badge.className = CONTROLS.filed;
        badge.textContent = filedText(n);
        badge.title = filedTitle(n);
        return badge;
    }

    /** "add to ▾" on a row of a virtual group: files a reference, never moves the row. */
    _addTo(kind, ref) {
        return this._select(CONTROLS.addTo, 'add to ▾', this._groupChoices(),
            (parentId) => this._apply(addRef, parentId, kind, ref));
    }

    _userGroup(node, target) {
        const details = document.createElement('details');
        details.className = 'ql-group ql-user';
        details.dataset.groupId = node.id;
        this._collapsible(details, node.id);
        const summary = document.createElement('summary');
        summary.textContent = `${node.label} (${node.children.length})`;
        details.append(summary);
        if (this.editing) {
            const row = document.createElement('div');
            row.className = 'ql-ctl-row';
            row.append(this._nodeControls(node), ...this._addButtons(node.id));
            details.append(row);
        }
        const list = document.createElement('ul');
        list.className = 'ql-list';
        list.append(...node.children.map((n) => this._node(n, target)));
        details.append(list);
        return details;
    }

    /** A ref whose target the catalog does not hold: greyed, showing the ref itself. */
    _missingRow(node) {
        const li = document.createElement('li');
        li.className = 'ql-missing';
        const icon = document.createElement('span');
        icon.className = 'ql-icon';
        icon.textContent = MISSING_ICON;
        const text = document.createElement('span');
        text.className = 'ql-title';
        text.textContent = node.ref;
        text.title = `${node.kind} "${node.ref}" is not in this app's catalog`;
        li.append(icon, text);
        return li;
    }

    _urlRow(node) {
        const li = document.createElement('li');
        li.className = 'ql-url';
        if (this.view === VIEWS.cards) li.classList.add('ql-card');
        const icon = document.createElement('span');
        icon.className = 'ql-icon';
        icon.textContent = URL_ICON;
        const a = document.createElement('a');
        a.href = node.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = node.label;
        a.title = node.href;
        li.append(icon, a);
        return li;
    }

    /**
     * A virtual group: its rows, then its sub-groups (All panels: one per
     * category; Help: one per section, and a section's sub-directories).
     */
    _group(group, target) {
        const details = document.createElement('details');
        details.className = 'ql-group';
        details.dataset.groupId = group.id;
        this._collapsible(details, group.id);
        const summary = document.createElement('summary');
        summary.textContent = `${group.label} (${groupSize(group)})`;
        details.append(summary);
        if (group.entries.length) {
            const filed = this.editing ? refCounts(this.tree) : null;
            const list = document.createElement('ul');
            list.className = 'ql-list';
            list.append(...group.entries.map(({ kind, item }) => {
                const doc = kind === NODE_KINDS.doc;
                const li = doc ? this._docRow(item, target) : this._panelRow(item, target);
                if (this.editing) {
                    const ref = doc ? item.path : item.componentType;
                    const n = filed.get(`${kind}:${ref}`) ?? 0;
                    if (n > 0) li.append(this._filedBadge(n));
                    li.append(this._addTo(kind, ref));
                }
                return li;
            }));
            details.append(list);
        }
        if (group.groups.length) {
            const inner = document.createElement('div');
            inner.className = 'ql-subgroups';
            inner.append(...group.groups.map((g) => this._group(g, target)));
            details.classList.add('ql-parent');
            details.append(inner);
        }
        return details;
    }

    _panelRow(item, target) {
        const li = document.createElement('li');
        li.className = 'ql-panel-row';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ql-panel';
        button.dataset.componentType = item.componentType;
        button.dataset.moduleId = item.moduleId;
        if (item.description) button.title = item.description;
        const icon = document.createElement('span');
        icon.className = 'ql-icon';
        icon.textContent = item.icon;
        const title = document.createElement('span');
        title.className = 'ql-title';
        title.textContent = item.title;
        const dot = document.createElement('span');
        dot.className = `ql-dot ${item.enabled ? 'ql-on' : 'ql-off'}`;
        dot.title = item.enabled ? 'enabled (open)' : 'closed';
        button.append(icon, title, dot);
        if (this.view === VIEWS.cards) {
            li.classList.add('ql-card');
            // A card's text: the module's own description, else its guide's first paragraph, else none.
            const text = item.description || item.summary;
            if (text) button.append(this._desc(text));
        }
        button.addEventListener('click', () => activate(item.moduleId, item.componentType));
        li.append(button);
        if (item.docs) {
            const wrap = document.createElement('span');
            wrap.className = 'ql-doc';
            wrap.append(this._link(item.docs, '?', target, `${item.title} guide`));
            li.append(wrap);
        }
        return li;
    }

    _docRow(doc, target) {
        const li = document.createElement('li');
        li.className = 'ql-help';
        li.dataset.section = doc.section;
        const icon = document.createElement('span');
        icon.className = 'ql-icon';
        icon.textContent = DOC_ICON;
        li.append(icon, this._link(doc.path, doc.title, target, doc.path));
        if (this.view === VIEWS.cards) {
            li.classList.add('ql-card');
            if (doc.summary) li.append(this._desc(doc.summary));
        }
        return li;
    }

    /** A card's line of text. */
    _desc(text) {
        const desc = document.createElement('span');
        desc.className = 'ql-desc';
        desc.textContent = text;
        return desc;
    }

    _link(path, text, target, tooltip) {
        const a = document.createElement('a');
        a.href = docsHref(path, target);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = text;
        a.title = tooltip;
        return a;
    }
}
