/**
 * quickLaunch — a panel with a button per registered Golden Layout panel and a
 * link per user guide. The contents are derived from the live registry every
 * render (quickLaunchCatalog.js); nothing about other modules is listed here.
 *
 * Plan: NewDocs/plans/quick-launch-panel-plan.md (Q1: the virtual groups,
 * docs links, activation; the stored tree and edit mode come in Q2).
 */

import { MODULE_ID, QuickLaunchUI } from './quickLaunchUI.js';
import { DOCS_LINK_TARGETS } from '../../app/config/docsBase.js';

export const moduleInfo = {
    name: MODULE_ID,
    title: 'Quick Launch',
    componentType: 'quickLaunchPanel',
    icon: '🚀',
    column: 1,
    description: 'A button for every panel (click to open or bring it forward) and links to the user guides.',
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
