import { createGameStateSingleton, getGameStateSingleton } from './singleton.js';
import { stateManagerProxySingleton } from '../stateManager/index.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'gameState',
  description: 'Manages game state including current region, path history, and movement.',
  requires: ['stateManager'],
};

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('gameState', message, ...data);
  } else {
    const consoleMethod =
      console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[gameState] ${message}`, ...data);
  }
}

// Store module-level references
let moduleDispatcher = null;
let moduleId = 'gameState';

export async function register(registrationApi) {
    // Register dispatcher receivers for events
    registrationApi.registerDispatcherReceiver(
        moduleId,
        'user:regionMove',
        handleRegionMove,
        { direction: 'up', condition: 'unconditional', timing: 'immediate' }
    );
    
    registrationApi.registerDispatcherReceiver(
        moduleId,
        'gameState:trimPath',
        handleTrimPath,
        { direction: 'up', condition: 'unconditional', timing: 'immediate' }
    );
    
    // user: + system:locationCheck — same handler, propagation
    // forwards the same event name (see handleLocationCheck).
    for (const evName of ['user:locationCheck', 'system:locationCheck']) {
        registrationApi.registerDispatcherReceiver(
            moduleId,
            evName,
            (data) => handleLocationCheck(data, evName),
            { direction: 'up', condition: 'unconditional', timing: 'immediate' }
        );
    }

    registrationApi.registerDispatcherReceiver(
        moduleId,
        'user:customAction',
        handleCustomAction,
        { direction: 'up', condition: 'unconditional', timing: 'immediate' }
    );

    // Register event publishers
    registrationApi.registerEventBusPublisher('gameState:regionChanged');
    registrationApi.registerEventBusPublisher('gameState:pathUpdated');
    registrationApi.registerEventBusPublisher('gameState:manaChanged');
    registrationApi.registerEventBusPublisher('gameState:xpChanged');
    registrationApi.registerEventBusPublisher('gameState:loopReset');

    // Export public functions
    registrationApi.registerPublicFunction(moduleId, 'getCurrentRegion', () => {
        const gameState = getGameStateSingleton();
        return gameState.getCurrentRegion();
    });

    registrationApi.registerPublicFunction(moduleId, 'getState', () => {
        const gameState = getGameStateSingleton();
        return gameState;
    });
    
    registrationApi.registerPublicFunction(moduleId, 'getPath', () => {
        const gameState = getGameStateSingleton();
        return gameState.getPath();
    });
    
    registrationApi.registerPublicFunction(moduleId, 'getRegionCounts', () => {
        const gameState = getGameStateSingleton();
        return gameState.getRegionCounts();
    });
    
    registrationApi.registerPublicFunction(moduleId, 'setAllowLoops', (allowLoops) => {
        const gameState = getGameStateSingleton();
        return gameState.setAllowLoops(allowLoops);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'getAllowLoops', () => {
        const gameState = getGameStateSingleton();
        return gameState.getAllowLoops();
    });
    
    registrationApi.registerPublicFunction(moduleId, 'trimPath', (regionName, instanceNumber) => {
        const gameState = getGameStateSingleton();
        return gameState.trimPath(regionName, instanceNumber);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'addLocationCheck', (locationName, regionName) => {
        const gameState = getGameStateSingleton();
        return gameState.addLocationCheck(locationName, regionName);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'addCustomAction', (actionName, params) => {
        const gameState = getGameStateSingleton();
        return gameState.addCustomAction(actionName, params);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'insertLocationCheckAt', (locationName, targetRegionName, targetInstanceNumber, locationRegionName) => {
        const gameState = getGameStateSingleton();
        return gameState.insertLocationCheckAt(locationName, targetRegionName, targetInstanceNumber, locationRegionName);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'insertCustomActionAt', (actionName, targetRegionName, targetInstanceNumber, params) => {
        const gameState = getGameStateSingleton();
        return gameState.insertCustomActionAt(actionName, targetRegionName, targetInstanceNumber, params);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'removePathEntry', (pathIndex) => {
        const gameState = getGameStateSingleton();
        return gameState.removePathEntry(pathIndex);
    });

    registrationApi.registerPublicFunction(moduleId, 'removeLocationCheckAt', (locationName, targetRegionName, targetInstanceNumber) => {
        const gameState = getGameStateSingleton();
        return gameState.removeLocationCheckAt(locationName, targetRegionName, targetInstanceNumber);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'removeCustomActionAt', (actionName, targetRegionName, targetInstanceNumber) => {
        const gameState = getGameStateSingleton();
        return gameState.removeCustomActionAt(actionName, targetRegionName, targetInstanceNumber);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'clearActionsAt', (targetRegionName, targetInstanceNumber) => {
        const gameState = getGameStateSingleton();
        return gameState.clearActionsAt(targetRegionName, targetInstanceNumber);
    });
    
    registrationApi.registerPublicFunction(moduleId, 'removeAllActionsOfType', (actionType, specificName) => {
        const gameState = getGameStateSingleton();
        return gameState.removeAllActionsOfType(actionType, specificName);
    });

    registrationApi.registerPublicFunction(moduleId, 'setStartRegions', (regions) => {
        const gameState = getGameStateSingleton();
        return gameState.setStartRegions(regions);
    });

    registrationApi.registerPublicFunction(moduleId, 'isStartRegion', (regionName) => {
        const gameState = getGameStateSingleton();
        return gameState.isStartRegion(regionName);
    });

    registrationApi.registerPublicFunction(moduleId, 'setPath', (pathArray, startRegion) => {
        const gameState = getGameStateSingleton();
        return gameState.setPath(pathArray, startRegion);
    });

    registrationApi.registerPublicFunction(moduleId, 'reset', () => {
        const gameState = getGameStateSingleton();
        return gameState.reset();
    });

    registrationApi.registerPublicFunction(moduleId, 'clearPath', () => {
        const gameState = getGameStateSingleton();
        return gameState.clearPath();
    });

    registrationApi.registerPublicFunction(moduleId, 'updatePath', (targetRegion, exitUsed, sourceRegion) => {
        const gameState = getGameStateSingleton();
        return gameState.updatePath(targetRegion, exitUsed, sourceRegion);
    });

    // Loop-mode resource API (mana / region XP)
    registrationApi.registerPublicFunction(moduleId, 'getCurrentMana', () => {
        return getGameStateSingleton().getCurrentMana();
    });
    registrationApi.registerPublicFunction(moduleId, 'getMaxMana', () => {
        return getGameStateSingleton().getMaxMana();
    });
    registrationApi.registerPublicFunction(moduleId, 'deductMana', (amount) => {
        return getGameStateSingleton().deductMana(amount);
    });
    registrationApi.registerPublicFunction(moduleId, 'refillMana', () => {
        return getGameStateSingleton().refillMana();
    });
    registrationApi.registerPublicFunction(moduleId, 'recalculateMaxMana', (snapshot) => {
        return getGameStateSingleton().recalculateMaxMana(snapshot);
    });
    registrationApi.registerPublicFunction(moduleId, 'getRegionXP', (regionName) => {
        return getGameStateSingleton().getRegionXP(regionName);
    });
    registrationApi.registerPublicFunction(moduleId, 'addRegionXP', (regionName, amount) => {
        return getGameStateSingleton().addRegionXP(regionName, amount);
    });
    registrationApi.registerPublicFunction(moduleId, 'triggerLoopReset', () => {
        return getGameStateSingleton().triggerLoopReset();
    });
    registrationApi.registerPublicFunction(moduleId, 'getLoopResetCount', () => {
        return getGameStateSingleton().getLoopResetCount();
    });
    registrationApi.registerPublicFunction(moduleId, 'getSubstrateMaxManaBonus', (substrateId) => {
        return getGameStateSingleton().getSubstrateMaxManaBonus(substrateId);
    });
    registrationApi.registerPublicFunction(moduleId, 'setSubstrateMaxManaBonus', (substrateId, bonus) => {
        return getGameStateSingleton().setSubstrateMaxManaBonus(substrateId, bonus);
    });
    registrationApi.registerPublicFunction(moduleId, 'getAllSubstrateMaxManaBonuses', () => {
        return getGameStateSingleton().getAllSubstrateMaxManaBonuses();
    });
    registrationApi.registerPublicFunction(moduleId, 'getIncludePerItemMaxMana', () => {
        return getGameStateSingleton().getIncludePerItemMaxMana();
    });
    registrationApi.registerPublicFunction(moduleId, 'setIncludePerItemMaxMana', (enabled) => {
        return getGameStateSingleton().setIncludePerItemMaxMana(enabled);
    });
    // Note: recordBestPath / getBestPath / clearBestPaths were removed
    // when saved queues moved to loops/savedQueueStore.js. New consumers
    // should import that module directly.
}

export async function initialize(mId, priorityIndex, initializationApi) {
    moduleId = mId;
    log('info', `[${moduleId} Module] Initializing with priority ${priorityIndex}...`);

    // Store the dispatcher reference
    moduleDispatcher = initializationApi.getDispatcher();
    
    // Create the singleton instance
    const eventBus = initializationApi.getEventBus();
    createGameStateSingleton(eventBus);
    
    // Subscribe to stateManager:rulesLoaded via eventBus (not dispatcher)
    if (eventBus) {
        eventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded);
        log('info', `[${moduleId} Module] Subscribed to stateManager:rulesLoaded via eventBus`);

        // Subscribe to iframe/window app ready events to send initial state
        eventBus.subscribe('iframe:appReady', handleRemoteAppReady);
        eventBus.subscribe('window:appReady', handleRemoteAppReady);
        log('info', `[${moduleId} Module] Subscribed to remote app ready events`);

        // Subscribe to snapshotUpdated to recalculate maxMana from inventory
        eventBus.subscribe('stateManager:snapshotUpdated', handleSnapshotUpdated);
    }

    log('info', `[${moduleId} Module] Initialization complete.`);
}

function handleRemoteAppReady(data, propagationOptions) {
    log('info', `[${moduleId} Module] Remote app ready, sending current region state`);

    const gameState = getGameStateSingleton();
    const currentRegion = gameState.getCurrentRegion();

    if (currentRegion) {
        // Publish current region to the newly ready remote
        // No timeout needed - the remote app is fully initialized and subscribed
        const eventBus = gameState.eventBus;
        if (eventBus) {
            eventBus.publish('gameState:regionChanged', {
                newRegion: currentRegion,
                oldRegion: null,
                source: 'gameState-init'
            });
            log('info', `[${moduleId} Module] Published initial region: ${currentRegion}`);
        }
    }
}

function handleSnapshotUpdated(eventData) {
    if (!eventData || !eventData.snapshot) return;
    const gameState = getGameStateSingleton();
    gameState.recalculateMaxMana(eventData.snapshot);
}

function handleRulesLoaded(data, propagationOptions) {
    log('info', `[${moduleId} Module] Received stateManager:rulesLoaded event`);

    const gameState = getGameStateSingleton();

    // Set start regions from static data BEFORE reset
    const staticData = stateManagerProxySingleton.getStaticData();
    if (staticData?.startRegions) {
        gameState.setStartRegions(staticData.startRegions);
        log('info', `[${moduleId} Module] Set start regions:`, staticData.startRegions);
    }

    gameState.reset();
    
    // Propagate event to the next module (up direction)
    if (moduleDispatcher) {
        moduleDispatcher.publishToNextModule(
            moduleId,
            'stateManager:rulesLoaded',
            data,
            { direction: 'up' }
        );
    } else {
        log('error', `[${moduleId} Module] Dispatcher not available for propagation of stateManager:rulesLoaded event`);
    }
}

function handleRegionMove(data, propagationOptions) {
    log('info', `[${moduleId} Module] Received user:regionMove event`, data);
    
    const gameState = getGameStateSingleton();
    const currentRegionBefore = gameState.getCurrentRegion();
    log('info', `[${moduleId} Module] Current region before processing: ${currentRegionBefore}`);
    
    if (data && data.targetRegion) {
        // Check if path should be updated. Default: true. Skipped when:
        //  - the caller explicitly sets updatePath:false
        //  - fromLoop:true (the loops queue or substrate-driven Phase 6
        //    walking is dispatching this; the path entry is already in
        //    the queue from when the action was originally enqueued)
        const shouldUpdatePath = data.updatePath !== false && !data.fromLoop;
        log('info', `[${moduleId} Module] Path update enabled: ${shouldUpdatePath}`);

        if (shouldUpdatePath) {
            // Update path with exit information BEFORE updating current region
            // This allows updatePath to properly detect the current vs target region
            gameState.updatePath(
                data.targetRegion,
                data.exitName || null,
                data.sourceRegion || null
            );
        }

        // Always update current region. Pass fromReset through so
        // substrate panels can skip mana deduction on the reset
        // transition (gameState.triggerLoopReset → user:regionMove
        // dispatch with fromReset: true).
        gameState.setCurrentRegion(
            data.targetRegion,
            data.fromReset ? { fromReset: true } : {},
        );
    }
    
    // Propagate event to the next module (up direction)
    if (moduleDispatcher) {
        moduleDispatcher.publishToNextModule(
            moduleId,
            'user:regionMove',
            data,
            { direction: 'up' }
        );
    } else {
        log('error', `[${moduleId} Module] Dispatcher not available for propagation of user:regionMove event`);
    }
}

function handleTrimPath(data, propagationOptions) {
    log('info', `[${moduleId} Module] Received gameState:trimPath event`, data);

    const gameState = getGameStateSingleton();
    // Use null to let trimPath use its default (first start region)
    const regionName = data?.regionName || null;
    const instanceNumber = data?.instanceNumber || 1;

    gameState.trimPath(regionName, instanceNumber);
    
    // Propagate event to the next module (up direction)
    if (moduleDispatcher) {
        moduleDispatcher.publishToNextModule(
            moduleId,
            'gameState:trimPath',
            data,
            { direction: 'up' }
        );
    } else {
        log('error', `[${moduleId} Module] Dispatcher not available for propagation of gameState:trimPath event`);
    }
}

function handleLocationCheck(data, eventName = 'user:locationCheck') {
    log('info', `[${moduleId} Module] Received ${eventName} event`, data);

    const gameState = getGameStateSingleton();
    if (data && data.locationName) {
        // Skip adding to path when the event comes from the loops module's
        // action queue completion — the path entry was already added when
        // the loop queue was initially built.
        if (!data.fromLoop) {
            const staticData = stateManagerProxySingleton.getStaticData();
            gameState.addLocationCheck(data.locationName, data.regionName, staticData);
        }
    }

    // Propagate event to the next module (up direction). Forward the
    // same event name we received so user:/system: stays consistent.
    if (moduleDispatcher) {
        moduleDispatcher.publishToNextModule(
            moduleId,
            eventName,
            data,
            { direction: 'up' }
        );
    } else {
        log('error', `[${moduleId} Module] Dispatcher not available for propagation of ${eventName} event`);
    }
}

function handleCustomAction(data, propagationOptions) {
    log('info', `[${moduleId} Module] Received user:customAction event`, data);
    
    const gameState = getGameStateSingleton();
    if (data && data.actionName) {
        gameState.addCustomAction(data.actionName, data.params || {});
    }
    
    // Propagate event to the next module (up direction)
    if (moduleDispatcher) {
        moduleDispatcher.publishToNextModule(
            moduleId,
            'user:customAction',
            data,
            { direction: 'up' }
        );
    } else {
        log('error', `[${moduleId} Module] Dispatcher not available for propagation of user:customAction event`);
    }
}