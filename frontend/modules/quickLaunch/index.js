/**
 * quickLaunch — a panel with a button per registered Golden Layout panel and a
 * link per user guide. The contents are derived from the live registry every
 * render (quickLaunchCatalog.js); nothing about other modules is listed here.
 *
 * Plan: NewDocs/plans/quick-launch-panel-plan.md (Q1: the virtual groups,
 * docs links, activation; Q2: the stored tree, edit mode, Unfiled; Q3: categories,
 * the cards view, the filter, collapsed groups).
 */

import { MODULE_ID, QuickLaunchUI, VIEWS } from './quickLaunchUI.js';
import { DOCS_LINK_TARGETS } from '../../app/config/docsBase.js';
import { EMPTY_TREE } from './quickLaunchTree.js';

export const moduleInfo = {
    name: MODULE_ID,
    title: 'Quick Launch',
    componentType: 'quickLaunchPanel',
    icon: '🚀',
    column: 1,
    category: 'UI Panel Modules',
    description: 'A button for every panel (click to open or bring it forward) and links to the user guides.',
    docs: 'docs/json/user/modules/quickLaunch.md',
    requires: [],
};

let initializationApi = null;

/** The module manager, once `initialize` has run (null before). */
export function getModuleManager() {
    return initializationApi?.getModuleManager?.() ?? null;
}

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/quickLaunch/quickLaunch.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(moduleInfo.componentType, QuickLaunchUI);

    registrationApi.registerSettingsSchema({
        docsLinkTarget: {
            type: 'string',
            default: DOCS_LINK_TARGETS.github,
            enum: Object.values(DOCS_LINK_TARGETS),
            label: 'Docs link target',
            description: "Where the guide links point: 'github' opens the guide on GitHub (works everywhere); "
                + "'local' opens the copy this server serves (works on the dev server, 404s on GitHub Pages, "
                + 'which publishes no user guides).',
        },
        view: {
            type: 'string',
            default: VIEWS.tree,
            enum: Object.values(VIEWS),
            label: 'View',
            description: "'tree' draws each item as one compact row; 'cards' adds each item's description "
                + "(or its guide's first paragraph). The panel's Cards button switches it. Saved per mode.",
        },
        collapsedGroups: {
            type: 'array',
            default: [],
            label: 'Collapsed groups',
            description: 'The ids of your own groups that are folded shut (written when you fold or unfold one). '
                + "Ids no longer in the arrangement are ignored and dropped on the next write. Saved per mode; "
                + "the built-in groups' folding is not saved.",
        },
        tree: {
            type: 'object',
            default: EMPTY_TREE,
            label: 'Arrangement',
            description: "Your own groups of Quick Launch items (the panel's Edit button builds it). Saved per mode. "
                + "Nodes are {id, kind:'group', label, children} | {id, kind:'panel', ref:<componentType>} | "
                + "{id, kind:'doc', ref:<docs path>} | {id, kind:'url', href, label}. Empty = only the built-in groups.",
        },
    });

    // Re-render when a panel opens or closes, when module states become readable, and on a setting change.
    registrationApi.registerEventBusSubscriberIntent('module:stateChanged');
    registrationApi.registerEventBusSubscriberIntent('app:readyForUiDataLoad');
    registrationApi.registerEventBusSubscriberIntent('settings:changed');
    // The mobile layout's activation path (see `activate` in quickLaunchUI.js).
    registrationApi.registerEventBusPublisher('ui:activatePanel');
}

export async function initialize(moduleId, priorityIndex, api) {
    initializationApi = api;
}
