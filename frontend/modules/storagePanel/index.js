/**
 * storagePanel — the Storage panel (every localStorage key with its owner, kind
 * and size; Clear per row / section / family) and the quota notice (a banner
 * when a write does not fit, fed by app/core/storageQuota.js).
 */
import eventBus from '../../app/core/eventBus.js';
import { onStorageWriteFailure } from '../../app/core/storageQuota.js';
import { MODULE_ID, StoragePanelUI } from './storagePanelUI.js';
import { showQuotaNotice } from './quotaNotice.js';
import { getModuleManager, setInitializationApi } from './moduleManagerRef.js';

export const moduleInfo = {
    name: MODULE_ID,
    title: 'Storage',
    componentType: 'storagePanel',
    icon: '🗄️',
    column: 1,
    category: 'Data and Configuration Panels',
    description: "Every key this site keeps in your browser's storage: its owner, what kind of data it is and how big; clear what you no longer need.",
    docs: 'docs/json/user/modules/storagePanel.md',
    requires: [],
};

/**
 * Bring the Storage panel forward (Quick Launch's rule): desktop → the module
 * manager's enableModule (it reopens a closed panel and loads a disabled
 * module); mobile (no Golden Layout) → `ui:activatePanel`, which the mobile
 * layout handles.
 */
export function openStoragePanel() {
    if (typeof window !== 'undefined' && window.goldenLayoutInstance) {
        return getModuleManager()?.enableModule(MODULE_ID);
    }
    eventBus.publish('ui:activatePanel', { panelId: moduleInfo.componentType }, MODULE_ID);
    return undefined;
}

let unsubscribeQuota = null;

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/storagePanel/storagePanel.css';
        document.head.appendChild(link);
    }
    registrationApi.registerPanelComponent(moduleInfo.componentType, StoragePanelUI);
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // Registered at register time, before any module initialises, so a settings
    // write that fails during boot is shown too.
    unsubscribeQuota?.();
    unsubscribeQuota = onStorageWriteFailure((notice) => showQuotaNotice(notice, { onOpen: openStoragePanel }));
}

export async function initialize(moduleId, priorityIndex, api) {
    setInitializationApi(api);
}
