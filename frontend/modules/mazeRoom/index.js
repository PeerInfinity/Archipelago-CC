/**
 * mazeRoom — the maze substrate
 * (docs/json/developer/procgen/maze.md).
 *
 * Engine lives in mazeRoomEngine.js (headless, no DOM). The UI panel
 * lives in mazeRoomUI.js. This file wires the panel into the module
 * registry and re-exports the engine surface so other modules and
 * headless tests can import a single entry point.
 */

import { MazeRoomUI } from './mazeRoomUI.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

export * from './mazeRoomEngine.js';
export { substrateRegistryEntry } from './mazeRoomLibrary.js';

export const moduleInfo = {
    name: 'mazeRoom',
    title: 'Maze Room',
    componentType: 'mazeRoomPanel',
    icon: '🧩',
    column: 3,
    description: 'Generate and play walls-only maze rooms (simulator-core v1 consumer)',
    requires: [],
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;
let unsubLoadRegion = null;

// Buffer for a maze:loadRegion event that arrived before the panel
// was mounted. MazeRoomUI's constructor drains it on mount via
// consumePendingLoadRegion(). See docs/json/developer/procgen/maze.md
// §"Panel and runtime".
let pendingLoadRegion = null;

function handleLoadRegion(payload) {
    // Self-activate. No-op when the panel is already the active item
    // in its stack; in any other case ui:activatePanel is what brings
    // it (or causes it to be created) into focus.
    //
    // Skip activation when the loops panel has "Keep this panel focused"
    // on AND the queue is currently driving (loops.isFocusLocked()).
    // The substrate still picks up the loadRegion payload for rendering;
    // only the tab-switch is suppressed.
    const focusLocked = centralRegistry.getPublicFunction?.('loops', 'isFocusLocked')?.();
    if (!focusLocked && eventBus?.publish) {
        eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });
    }
    if (panelInstance && typeof panelInstance.applyLoadedRegion === 'function') {
        panelInstance.applyLoadedRegion(payload);
    } else {
        // Panel will pick this up in its constructor on mount.
        pendingLoadRegion = payload;
    }
}

export function consumePendingLoadRegion() {
    const p = pendingLoadRegion;
    pendingLoadRegion = null;
    return p;
}

// Test-only — reset module-scope state between cases.
export function _testOnly_resetModuleState() {
    panelInstance = null;
    eventBus = null;
    dispatcher = null;
    pendingLoadRegion = null;
    if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
}

export function register(registrationApi) {
    // No-op under headless test environments; the stylesheet only
    // matters when the panel is actually rendered.
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/mazeRoom/mazeRoom.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent('mazeRoomPanel', MazeRoomUI);

    // Self-activation on maze:loadRegion publishes ui:activatePanel.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    // Phase 3 visualizer publishes per-step playback snapshots so
    // opt-in subscribers (this panel itself, future bot consumers)
    // can mirror the simulated state without affecting stateManager.
    registrationApi.registerEventBusPublisher('playback:snapshotUpdated');

    // Phase 6: substrate-handled completion. The loops module
    // registers loops:substrateActionCompleted as the canonical owner,
    // but the maze panel is the actual publisher (it walks the
    // autopath and signals back to the loops queue when done). Co-
    // register so the eventBus recognizes mazeRoom as a publisher too.
    registrationApi.registerEventBusPublisher('loops:substrateActionCompleted');

    // The maze panel is the original source of these AP-level events
    // when the player triggers them by walking around in playback
    // mode. Both go on the dispatcher (chain-of-authority) so other
    // modules (gameState, discovery, MetaGame, stateManager) can see
    // and act on them in the standard order.
    if (typeof registrationApi.registerDispatcherSender === 'function') {
        registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
        // system:locationCheck — visualizer pickups (keyboard play
        // and bot play) publish here. Distinct from user: so the
        // playback bot's Phase 2 click-intercept can swallow only
        // real user clicks. Terminal handlers subscribe to both.
        registrationApi.registerDispatcherSender('system:locationCheck', 'bottom', 'first');
        registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    }

    // Make the maze discoverable by the substrate registry.
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    MazeRoomUI.setModuleApis({ eventBus, dispatcher });

    // The procgen player (step 8) is the eventual publisher of
    // maze:loadRegion. Step 5 ships only the receiver side — the
    // event can also be published manually (or by tests) to drive
    // the maze panel directly.
    if (eventBus?.subscribe) {
        unsubLoadRegion = eventBus.subscribe(
            substrateRegistryEntry.loadRegionEvent,
            handleLoadRegion,
        );
    }

    // Browser-console debug accessor, mirroring window.loops. Lets
    // dev / smoke tests poke the panel without going through the
    // module's exports: `mazeRoom.panel`, `mazeRoom.world`, etc.
    if (typeof window !== 'undefined') {
        window.mazeRoom = {
            get panel() { return panelInstance; },
            get world() { return panelInstance?.world; },
            get state() { return panelInstance?.state; },
            get queue() { return panelInstance?._mazeQueue; },
            rerender() { panelInstance?.render(); },
        };
    }

    return () => {
        if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
        pendingLoadRegion = null;
        if (typeof window !== 'undefined') delete window.mazeRoom;
    };
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getPanelInstance() {
    return panelInstance;
}

export function getModuleApis() {
    return { eventBus, dispatcher };
}
