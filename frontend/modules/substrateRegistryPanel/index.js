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

export const moduleInfo = {
    name: 'substrateRegistryPanel',
    title: 'Substrate Registry',
    componentType: 'substrateRegistryPanel',
    icon: '🗂️',
    column: 3,
    category: 'Procgen Infrastructure Panels',
    description: 'Shows every registered substrate as a feature matrix, with per-entry detail and drift from the saved snapshot.',
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
}

/** ⚠ Nothing to do: each panel instance reads the registry when it mounts. */
export async function initialize() {}
