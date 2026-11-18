/**
 * actionNodes — the module of the ActionNodes substrate (`action_nodes`, docs/json/developer/procgen/action-nodes.md).
 *
 * Registers the registry entry (`actionNodesLibrary.js`), the substrate's panel (`actionNodesPanel.js`), and wires the
 * runtime (`actionNodesRuntime.js`) to the app:
 *   - `stateManager:rawJsonDataLoaded` → load the world's `action_nodes[p]` block (or forget the last one);
 *   - `stateManager:snapshotUpdated` → boosts (A4) and the checks already made;
 *   - `gameState:loopReset` and `loopState:loopReset` (the two reset flows) → a new loop;
 *   - `loop:actionCompleted` (Loops ran an `act`) → perform the node;
 *   - `crossSubstrate:itemGranted` to `action_nodes` → a resource lands in the ledger.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ACTION_COMPLETED_EVENT } from '../shared/procgen/loopCustomActions.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import {
    chargeMana, gainMana, xpAdjustedCost, fireLoopResetTeleport, getResourceLedger, ITEM_GRANTED_EVENT,
} from '../resourceChannels/resourceChannelsLibrary.js';
import { substrateRegistryEntry } from './actionNodesLibrary.js';
import { getActionNodesRuntime, ACTION_NODES_STATE_EVENT } from './actionNodesRuntime.js';
import {
    ActionNodesPanel, ACTION_NODES_PANEL_COMPONENT_TYPE, setActionNodesDispatcher,
} from './actionNodesPanel.js';

export const moduleInfo = {
    name: 'actionNodes',
    title: 'Action Nodes',
    componentType: ACTION_NODES_PANEL_COMPONENT_TYPE,
    icon: '🎯',
    column: 2,
    category: 'Loop Mode Modules',
    description: 'The ActionNodes substrate: one region is one action. Shows the node you are at, performs or queues its action, and opens its exits.',
    requires: ['gameState', 'resourceChannels'],
};

const MODULE = moduleInfo.name;

export function register(registrationApi) {
    if (!substrateRegistry.has(substrateRegistryEntry.id)) substrateRegistry.register(substrateRegistryEntry);
    registrationApi.registerPanelComponent?.(ACTION_NODES_PANEL_COMPONENT_TYPE, ActionNodesPanel);
    registrationApi.registerEventBusPublisher?.(ACTION_NODES_STATE_EVENT);
    // The runtime's dispatches: a check (once) and the panel's moves outside Loop mode. A node's first clear REVEALS
    // its exits through discovery's public `revealExits` (AN-1b), not a `loop:exploreCompleted` (whose receiver also
    // runs explore's random pick).
    registrationApi.registerDispatcherSender?.('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender?.('user:regionMove', 'bottom', 'first');
    // Tests and the console read the runtime's state.
    registrationApi.registerPublicFunction?.(MODULE, 'getRuntimeSnapshot', () => getActionNodesRuntime().snapshot());
    registrationApi.registerPublicFunction?.(MODULE, 'getRuntime', () => getActionNodesRuntime());
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    const dispatcher = initializationApi.getDispatcher?.() ?? null;
    const logger = initializationApi.getLogger?.() ?? null;
    setActionNodesDispatcher(dispatcher);
    const gs = () => {
        try { return getGameStateSingleton(); } catch { return null; }
    };
    const runtime = getActionNodesRuntime();
    runtime.setEnv({
        publish: (event, data) => eventBus?.publish?.(event, data),
        dispatch: (event, data, opts) => dispatcher?.publish?.(event, data, opts),
        gameState: gs,
        ledger: getResourceLedger,
        chargeMana,
        gainMana,
        xpAdjustedCost,
        revealExits: (regionName, exitNames) => initializationApi.getModuleFunction?.('discovery', 'revealExits')?.(regionName, exitNames),
        fireReset: () => fireLoopResetTeleport({
            sourceRegion: gs()?.getCurrentRegion?.() ?? null,
            dispatcher,
            dispatchOpts: { initialTarget: 'bottom' },
        }),
        log: (level, msg) => (logger?.[level] ? logger[level](msg) : console[level === 'warn' ? 'warn' : 'log'](msg)),
    });
    if (!eventBus?.subscribe) return;
    eventBus.subscribe('stateManager:rawJsonDataLoaded', (data) => {
        const rules = data?.rawJsonData;
        const playerId = data?.selectedPlayerInfo?.playerId ?? '1';
        try {
            runtime.loadWorld(rules, playerId);
        } catch (e) {
            console.warn('[actionNodes] the world could not be loaded', e);
            runtime.unload();
        }
    });
    eventBus.subscribe('stateManager:snapshotUpdated', (data) => runtime.onSnapshot(data?.snapshot));
    eventBus.subscribe('gameState:loopReset', () => runtime.onLoopReset('gameState:loopReset'));
    eventBus.subscribe('loopState:loopReset', () => runtime.onLoopReset('loopState:loopReset'));
    eventBus.subscribe(ACTION_COMPLETED_EVENT, (data) => runtime.onActionCompleted(data));
    eventBus.subscribe(ITEM_GRANTED_EVENT, (data) => runtime.onItemGranted(data));
}
