/**
 * substrateRegistryPanel — **THE LIVE REGISTRY, IN THE APP.** One Golden
 * Layout panel that shows what `substrateRegistry` holds in THIS running app:
 * every entry, every field it carries, what `getPlaybackController()` and the
 * `sharing.items` type list answer right now, and the drift against the
 * checked-in snapshot `procgenDocs/generated/registry.js`.
 *
 * ⛓ A PANEL, not a page (substrate registry panel plan §0): a standalone
 * document has its own module graph and so its own registry singleton, and
 * the snapshot's reading already exists headless (`reference.html`, the
 * generated matrix in `substrate-registry.md`). What only the app can show is
 * this mode's registry, the callable answers, and drift.
 */

import { SubstrateRegistryPanelUI } from './substrateRegistryPanelUI.js';
import {
    SUBSTRATE_ORDER_KEY, SUBSTRATE_ORDER_SCHEMA, SUBSTRATE_ORDER_SETTING, setSubstrateOrder,
} from '../procgenCore/substrateOrder.js';
import settingsManager from '../../app/core/settingsManager.js';

export const moduleInfo = {
    name: 'substrateRegistryPanel',
    title: 'Substrate Registry',
    componentType: 'substrateRegistryPanel',
    icon: '🗂️',
    column: 3,
    category: 'Procgen Infrastructure Panels',
    description: 'Shows every registered substrate in three modes: Plain (the default — what each one can do, in plain statements), Matrix (a feature matrix of its registry fields) and Detail (per-entry values, live answers and drift from the saved snapshot).',
    /** ⛔ Nothing: the registry is an import, not a module dependency. */
    requires: [],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/substrateRegistryPanel/substrateRegistryPanel.css';
        document.head.appendChild(link);
    }
    registrationApi.registerPanelComponent('substrateRegistryPanel', SubstrateRegistryPanelUI);
    // ⛓ REGISTRATION ORDER RO2 — the user's substrate order (⚖ 2026-09-29): a
    //   setting this module OWNS (its column controls edit it); every substrate
    //   list reads it through `procgenCore/substrateOrder.js`.
    registrationApi.registerSettingsSchema({
        type: 'object',
        properties: { [SUBSTRATE_ORDER_KEY]: { ...SUBSTRATE_ORDER_SCHEMA, items: { ...SUBSTRATE_ORDER_SCHEMA.items } } },
    });
}

/**
 * Each panel instance reads the registry when it mounts. What this does: load
 * the saved substrate order into `procgenCore/substrateOrder.js` and follow
 * every change to it (the panel's controls, the Options panel, a settings
 * import or reset), so every substrate list draws in the user's order.
 */
export async function initialize(_moduleId, _priorityIndex, initializationApi) {
    const reload = async () => {
        setSubstrateOrder(await settingsManager.getSetting(SUBSTRATE_ORDER_SETTING, []));
    };
    initializationApi?.getEventBus?.()?.subscribe('settings:changed', (ev) => {
        if (!ev || ev.key === '*' || ev.key === SUBSTRATE_ORDER_SETTING
            || String(ev.key).startsWith('moduleSettings.substrateRegistryPanel')) reload();
    }, 'substrateRegistryPanel');
    await reload();
}
