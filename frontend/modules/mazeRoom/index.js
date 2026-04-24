/**
 * mazeRoom — first consumer of the shared simulator-core interface.
 * See NewDocs/plans/procedural-generation/maze-room-generator.md.
 *
 * Engine lives in mazeRoomEngine.js (headless, no DOM). The UI panel
 * lives in mazeRoomUI.js. This file wires the panel into the module
 * registry and re-exports the engine surface so other modules and
 * headless tests can import a single entry point.
 */

import { MazeRoomUI } from './mazeRoomUI.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';

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

export function register(registrationApi) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/mazeRoom/mazeRoom.css';
    document.head.appendChild(link);

    registrationApi.registerPanelComponent('mazeRoomPanel', MazeRoomUI);

    // Skeleton for step 7's procgen player. No consumer yet — this
    // just makes the maze discoverable by the registry. See
    // NewDocs/plans/procedural-generation/procgen-player.md.
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    MazeRoomUI.setModuleApis({ eventBus, dispatcher });

    return () => {
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
    };
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getModuleApis() {
    return { eventBus, dispatcher };
}
