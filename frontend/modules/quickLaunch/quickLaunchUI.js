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
import { EMPTY_TREE, NODE_KINDS, migrate, resolve, unfiled } from './quickLaunchTree.js';
import { getModuleManager } from './index.js';

// Declared here, not in index.js: index.js imports this file, so a top-level
// read of an index.js const would run before that const is initialized.
export const MODULE_ID = 'quickLaunch';
export const RENDER_DEBOUNCE_MS = 50;
export const DOCS_LINK_SETTING = `moduleSettings.${MODULE_ID}.docsLinkTarget`;
export const TREE_KEY = 'tree';
export const TREE_SETTING = `moduleSettings.${MODULE_ID}.${TREE_KEY}`;
export const DOC_ICON = '📄';
export const URL_ICON = '🔗';
export const MISSING_ICON = '✕';
export const MODULES_TARGET = Object.freeze({ moduleId: 'modules', componentType: 'modulesPanel' });
const REFRESH_EVENTS = ['module:stateChanged', 'app:readyForUiDataLoad', 'settings:changed'];

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
        this._unsubs = [];
        this._buildDom();
        this._scheduleRender = debounce(() => this.render(), RENDER_DEBOUNCE_MS);
        for (const event of REFRESH_EVENTS) {
            this._unsubs.push(eventBus.subscribe(event, () => this._scheduleRender(), MODULE_ID));
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
        bar.append(this.headerEl, modulesButton);
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

    async render() {
        const target = await settingsManager.getSetting(DOCS_LINK_SETTING, DOCS_LINK_TARGETS.github);
        this.tree = migrate(await settingsManager.getSetting(TREE_SETTING, EMPTY_TREE));
        const catalog = this.catalog();
        this.headerEl.textContent = headerText(catalog);
        const sections = [];
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
        return li;
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
        const list = document.createElement('ul');
        list.className = 'ql-list';
        list.append(...node.children.map((n) => this._node(n, target)));
        details.append(summary, list);
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
        summary.textContent = `${group.label} (${group.items.length})`;
        const list = document.createElement('ul');
        list.className = 'ql-list';
        const row = {
            [VIRTUAL_GROUPS.help.id]: (d) => this._docRow(d, target),
            [VIRTUAL_GROUPS.allPanels.id]: (p) => this._panelRow(p, target),
            [VIRTUAL_GROUPS.unfiled.id]: ({ kind, item }) => (kind === NODE_KINDS.doc
                ? this._docRow(item, target) : this._panelRow(item, target)),
        }[group.id];
        list.append(...group.items.map(row));
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
        return li;
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
