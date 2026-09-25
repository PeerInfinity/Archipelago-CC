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
import { DOCS_INDEX } from './generated/docsIndex.js';
import { VIRTUAL_GROUPS, buildCatalog, virtualGroups } from './quickLaunchCatalog.js';
import {
    EMPTY_TREE, NODE_KINDS, addGroup, addRef, addUrl, deleteNode, findNode, groupsOf, migrate, moveDown, moveNode,
    moveUp, renameGroup, resolve, unfiled,
} from './quickLaunchTree.js';
import { getModuleManager } from './index.js';

// Declared here, not in index.js: index.js imports this file, so a top-level
// read of an index.js const would run before that const is initialized.
export const MODULE_ID = 'quickLaunch';
export const RENDER_DEBOUNCE_MS = 50;
export const DOCS_LINK_SETTING = `moduleSettings.${MODULE_ID}.docsLinkTarget`;
export const TREE_KEY = 'tree';
export const TREE_SETTING = `moduleSettings.${MODULE_ID}.${TREE_KEY}`;
/** The two views over the same groups: compact rows, or cards that add each item's text. */
export const VIEWS = Object.freeze({ tree: 'tree', cards: 'cards' });
export const VIEW_KEY = 'view';
export const VIEW_SETTING = `moduleSettings.${MODULE_ID}.${VIEW_KEY}`;
export const DOC_ICON = '📄';
export const URL_ICON = '🔗';
export const MISSING_ICON = '✕';
export const MODULES_TARGET = Object.freeze({ moduleId: 'modules', componentType: 'modulesPanel' });
const REFRESH_EVENTS = ['module:stateChanged', 'app:readyForUiDataLoad', 'settings:changed'];

/** Edit mode's controls: one class each, so tests and CSS address them by name. */
export const CONTROLS = Object.freeze({
    edit: 'ql-edit',
    view: 'ql-view',
    up: 'ql-ctl-up',
    down: 'ql-ctl-down',
    rename: 'ql-ctl-rename',
    remove: 'ql-ctl-delete',
    moveTo: 'ql-ctl-move',
    addGroup: 'ql-ctl-add-group',
    addUrl: 'ql-ctl-add-url',
    addTo: 'ql-ctl-add-to',
});
/** The "move to" / "add to" value meaning the top level of the tree. */
export const ROOT_CHOICE = '__root__';
export const ROOT_CHOICE_LABEL = '(top level)';
export const DELETE_GROUP_CONFIRM = 'Delete this group and everything in it?';
export const NEW_GROUP_PROMPT = 'Name of the new group';
export const NEW_GROUP_DEFAULT = 'New group';
export const RENAME_PROMPT = 'Rename the group';
export const URL_HREF_PROMPT = 'Link address (URL)';
export const URL_LABEL_PROMPT = 'Link label';

/**
 * The browser dialogs edit mode asks through. A test replaces a member for
 * the length of a row and restores it: Playwright dismisses a dialog nobody
 * handles (confirm → false, prompt → null), and the in-app harness installs
 * no handler.
 */
export const dialogs = {
    confirm: (message) => window.confirm(message),
    prompt: (message, value) => window.prompt(message, value),
};

/** "N panels · M guides" — the header line, exported so the in-app test builds the same string. */
export function headerText(catalog) {
    return `${catalog.panels.length} panels · ${catalog.docs.length} guides`;
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
        /** Group ids the reader collapsed — kept across re-render, not across reloads (Q3). */
        this.collapsed = new Set();
        /** The stored tree as last read or written (migrated). */
        this.tree = EMPTY_TREE;
        this.editing = false;
        /** The view setting as last read or written. */
        this.view = VIEWS.tree;
        /** Bumped by every render; a render whose awaits finish after a newer one started draws nothing. */
        this._renderGen = 0;
        this._unsubs = [];
        this._buildDom();
        this._scheduleRender = debounce(() => this.render(), RENDER_DEBOUNCE_MS);
        for (const event of REFRESH_EVENTS) {
            this._unsubs.push(eventBus.subscribe(event, (payload) => {
                // Our own tree / view write: `_apply` / `setView` has already rendered from it.
                if (payload?.key === TREE_SETTING && payload.value === this.tree) return;
                if (payload?.key === VIEW_SETTING && payload.value === this.view) return;
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
        modulesButton.textContent = 'Modules ⇄';
        modulesButton.title = 'Open the Modules panel';
        modulesButton.addEventListener('click', () => activate(MODULES_TARGET.moduleId, MODULES_TARGET.componentType));
        this.editButton = document.createElement('button');
        this.editButton.type = 'button';
        this.editButton.className = CONTROLS.edit;
        this.editButton.textContent = 'Edit';
        this.editButton.title = 'Arrange your own groups (the built-in groups stay as they are)';
        this.editButton.setAttribute('aria-pressed', 'false');
        this.editButton.addEventListener('click', () => this.setEditing(!this.editing));
        this.viewButton = document.createElement('button');
        this.viewButton.type = 'button';
        this.viewButton.className = CONTROLS.view;
        this.viewButton.textContent = 'Cards';
        this.viewButton.title = 'Show every item as a card with its description (press again for the compact tree)';
        this.viewButton.setAttribute('aria-pressed', 'false');
        this.viewButton.addEventListener('click',
            () => this.setView(this.view === VIEWS.cards ? VIEWS.tree : VIEWS.cards));
        const buttons = document.createElement('span');
        buttons.className = 'ql-bar-buttons';
        buttons.append(this.viewButton, this.editButton, modulesButton);
        bar.append(this.headerEl, buttons);
        this.groupsEl = document.createElement('div');
        this.groupsEl.className = 'ql-groups';
        this.rootElement.append(bar, this.groupsEl);
        // A destroyed panel (closed tab) must stop re-rendering.
        this.container?.on?.('destroy', () => this.destroy());
    }

    /** The catalog over the live registry and module states. */
    catalog() {
        const manager = getModuleManager();
        return buildCatalog({
            panelComponents: centralRegistry.getAllPanelComponents(),
            moduleStates: manager?.getAllModuleStates?.() ?? {},
            docsIndex: DOCS_INDEX,
            loadPriority: manager?.getLoadPriority?.() ?? [],
        });
    }

    setEditing(on) {
        this.editing = !!on;
        this.editButton.setAttribute('aria-pressed', String(this.editing));
        this.rootElement.classList.toggle('ql-editing', this.editing);
        return this.render();
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
        const gen = ++this._renderGen;
        const target = await settingsManager.getSetting(DOCS_LINK_SETTING, DOCS_LINK_TARGETS.github);
        const tree = migrate(await settingsManager.getSetting(TREE_SETTING, EMPTY_TREE));
        const view = await settingsManager.getSetting(VIEW_SETTING, VIEWS.tree);
        if (gen !== this._renderGen) return; // a newer render is under way; it draws
        this.tree = tree;
        this.view = view === VIEWS.cards ? VIEWS.cards : VIEWS.tree;
        this.viewButton.setAttribute('aria-pressed', String(this.view === VIEWS.cards));
        this.rootElement.classList.toggle('ql-cards', this.view === VIEWS.cards);
        const catalog = this.catalog();
        this.headerEl.textContent = headerText(catalog);
        const sections = [];
        if (this.editing) sections.push(this._rootControls());
        if (this.tree.nodes.length) sections.push(this._stored(resolve(this.tree, catalog), target));
        // Unfiled: hidden when empty, and ALWAYS hidden while the tree is empty —
        // then every entry is unfiled, and All panels / Help already show each one.
        const loose = this.tree.nodes.length ? unfiled(this.tree, catalog) : [];
        if (loose.length) sections.push(this._group({ ...VIRTUAL_GROUPS.unfiled, items: loose }, target));
        sections.push(...virtualGroups(catalog).map((g) => this._group(g, target)));
        this.groupsEl.replaceChildren(...sections);
    }

    /** The user's tree: one list in stored order, a group as a nested `<details>`. */
    _stored(tree, target) {
        const list = document.createElement('ul');
        list.className = 'ql-list ql-root';
        list.append(...tree.nodes.map((n) => this._node(n, target)));
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

    /** "+ group" and "+ url" into `parentId` (null = the top level). */
    _addButtons(parentId) {
        return [
            this._button(CONTROLS.addGroup, '+ group', 'Add a group here', () => {
                const label = dialogs.prompt(NEW_GROUP_PROMPT, NEW_GROUP_DEFAULT);
                if (label != null && label.trim()) this._apply(addGroup, parentId, label.trim());
            }),
            this._button(CONTROLS.addUrl, '+ url', 'Add a link here', () => {
                const href = dialogs.prompt(URL_HREF_PROMPT, 'https://');
                if (href == null || !href.trim()) return;
                const label = dialogs.prompt(URL_LABEL_PROMPT, href.trim());
                if (label != null) this._apply(addUrl, parentId, href.trim(), label.trim());
            }),
        ];
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
            box.append(this._button(CONTROLS.rename, '✎', 'Rename', () => {
                const label = dialogs.prompt(RENAME_PROMPT, node.label);
                if (label != null && label.trim()) this._apply(renameGroup, node.id, label.trim());
            }));
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

    /** "add to ▾" on a row of a virtual group: files a reference, never moves the row. */
    _addTo(kind, ref) {
        return this._select(CONTROLS.addTo, 'add to ▾', this._groupChoices(),
            (parentId) => this._apply(addRef, parentId, kind, ref));
    }

    _userGroup(node, target) {
        const details = document.createElement('details');
        details.className = 'ql-group ql-user';
        details.dataset.groupId = node.id;
        details.open = !this.collapsed.has(node.id);
        details.addEventListener('toggle', () => {
            if (details.open) this.collapsed.delete(node.id);
            else this.collapsed.add(node.id);
        });
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

    /** A virtual group: rows of catalog entries, or (All panels) one sub-group per category. */
    _group(group, target) {
        const details = document.createElement('details');
        details.className = 'ql-group';
        details.dataset.groupId = group.id;
        details.open = !this.collapsed.has(group.id);
        details.addEventListener('toggle', () => {
            if (details.open) this.collapsed.delete(group.id);
            else this.collapsed.add(group.id);
        });
        const summary = document.createElement('summary');
        if (group.groups) {
            const count = group.groups.reduce((n, g) => n + g.items.length, 0);
            summary.textContent = `${group.label} (${count})`;
            const inner = document.createElement('div');
            inner.className = 'ql-subgroups';
            inner.append(...group.groups.map((g) => this._group(g, target)));
            details.classList.add('ql-parent');
            details.append(summary, inner);
            return details;
        }
        summary.textContent = `${group.label} (${group.items.length})`;
        const list = document.createElement('ul');
        list.className = 'ql-list';
        const asEntry = {
            [VIRTUAL_GROUPS.help.id]: (d) => ({ kind: NODE_KINDS.doc, item: d }),
            [VIRTUAL_GROUPS.unfiled.id]: (entry) => entry,
        }[group.id] ?? ((p) => ({ kind: NODE_KINDS.panel, item: p })); // an All panels category
        list.append(...group.items.map(asEntry).map(({ kind, item }) => {
            const doc = kind === NODE_KINDS.doc;
            const li = doc ? this._docRow(item, target) : this._panelRow(item, target);
            if (this.editing) li.append(this._addTo(kind, doc ? item.path : item.componentType));
            return li;
        }));
        details.append(summary, list);
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
