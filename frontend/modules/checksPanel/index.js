/**
 * checksPanel — the "Checked: …, Reachable: …" line as a panel, for the mini row (modules/miniPanels): on
 * its own when only Checks is on; when the Playback Bot is mini too, the bot's mini row shows the line and
 * this panel is taken out. The line itself is commonUI/checksLine.js, which the Console shows too.
 */
import { ChecksPanelUI } from './checksPanelUI.js';

export const moduleInfo = {
    name: 'checksPanel',
    title: 'Checks',
    componentType: 'checksPanel',
    docs: 'docs/json/user/modules/checksPanel.md',
    icon: '✅',
    column: 2,
    category: 'Tracker Panels',
    description: 'The "Checked: …, Reachable: …, Events: …" line on its own — for the mini row (Quick Launch → Mini panels).',
    requires: [],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/checksPanel/checksPanel.css';
        document.head.appendChild(link);
    }
    registrationApi.registerPanelComponent(moduleInfo.componentType, ChecksPanelUI);
    registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
    registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
}

export async function initialize() {}
