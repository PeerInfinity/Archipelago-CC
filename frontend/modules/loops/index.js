// Core state and UI for this module
import loopStateSingleton from './loopStateSingleton.js';
import { LoopUI } from './loopUI.js';
import { handleUserLocationCheckForLoops, handleUserItemCheckForLoops, handleUserExitClickedForLoops, initializeLoopEvents } from './loopEvents.js'; // Import handlers

// Cost generation and management
import { CostGenerator } from './costGenerator.js';
import { CostDataManager } from './costDataManager.js';
import { PathFinder } from '../shared/pathfinder.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'loops',
  title: 'Loops',
  componentType: 'loopsPanel',
  icon: '🔄',
  column: 3, // Right column
  description: 'Loop mode logic and UI panel.',
  requires: ['stateManager', 'discovery'],
};

// Other dependencies
// import discoveryStateSingleton from '../discovery/singleton.js'; // Need discovery state
// import eventBus from '../../app/core/eventBus.js'; // Use injected
// import settingsManager from '../../app/core/settingsManager.js'; // Use injected

// Store instance and API
let loopInstance = null;
let _moduleEventBus = null;
let moduleDispatcher = null; // To store the full dispatcher instance
let _gameStateAPI = null; // Store gameState API for access by loopUI

// Cost generation instances
let _costGenerator = null;
let _costDataManager = null;
let _pathFinder = null;

// Export dispatcher for use by other files in this module (e.g., loopEvents.js)
export function getLoopsModuleDispatcher() {
  return moduleDispatcher;
}

// Export function to get gameState API for use by loopUI
export function getGameStateAPI() {
  return _gameStateAPI;
}

// Export cost generation components
export function getCostGenerator() {
  return _costGenerator;
}

export function getCostDataManager() {
  return _costDataManager;
}

export function getPathFinder() {
  return _pathFinder;
}

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  // Fallback wrapper before initialize() runs (e.g., GoldenLayout component creation)
  return {
    publish: (event, data) => eventBus.publish(event, data, 'loops'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'loops'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'loops'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}

let loopUnsubscribeHandles = [];

// --- Import the actual singletons needed for injection ---
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import eventBus from '../../app/core/eventBus.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopsModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopsModule] ${message}`, ...data);
  }
}

// ----------------------------------------------------- //

// --- Event Handlers --- //

// Pick up loop_costs from an in-memory rules.json before stateManager
// finishes loading them. Fires for editor / procgenPipeline paths where
// there's no URL to refetch from.
function handleFilesJsonLoaded(eventData) {
  if (!_costDataManager) return;
  const jsonData = eventData?.jsonData;
  const sourceName = eventData?.sourceName ?? 'unknown';
  const embedded = jsonData?.loop_costs;
  if (embedded) {
    _costDataManager.applyEmbeddedLoopCosts(embedded, sourceName);
  }
}

// Handler for rules loaded
async function handleRulesLoaded(eventData) {
  log('info', '[Loops Module] Received stateManager:rulesLoaded');

  // Set start regions on gameState from static data
  const staticData = stateManager.getStaticData();
  if (staticData?.startRegions && _gameStateAPI?.setStartRegions) {
    _gameStateAPI.setStartRegions(staticData.startRegions);
    log('info', '[Loops Module] Set start regions:', staticData.startRegions);
  }

  // Try to pick up loop_costs embedded in the rules.json. The procgen
  // pipeline / editor flows already populated cost data via
  // files:jsonLoaded above; this branch only matters when rules were
  // loaded from a real file path. tryLoadEmbedded is a no-op on
  // synthetic source names so it won't fight with the in-memory load.
  if (_costDataManager) {
    const rulesPath = eventData?.source;
    let loadedNow = false;
    if (typeof rulesPath === 'string' && rulesPath.length > 0) {
      try {
        loadedNow = await _costDataManager.tryLoadEmbedded(rulesPath);
      } catch (err) {
        log('warn', '[Loops Module] tryLoadEmbedded threw:', err);
      }
    }
    // Clear only when no source resolved AND no in-memory load
    // populated cost data. isLoaded() reflects either path.
    if (!loadedNow && !_costDataManager.isLoaded()) {
      _costDataManager.clear();
      log('info', '[Loops Module] No embedded loop_costs; cost data cleared for new rules');
    }
  }

  // Full reset of loop state for new rules (clears XP, mana, explore states, etc.)
  if (
    loopStateSingleton &&
    typeof loopStateSingleton.resetForNewRules === 'function'
  ) {
    loopStateSingleton.resetForNewRules();
  } else {
    log('warn',
      '[Loops Module] LoopState singleton or resetForNewRules method not available when handling stateManager:rulesLoaded.'
    );
  }

  // Auto-enter loop mode when the freshly-loaded preset carries its
  // own cost data (procgen pipeline's "Enable loop mode" toggle, or
  // any other source that set loop_costs). The presence of cost data
  // is a strong signal "this preset was generated with loop mode in
  // mind". activatePanel:false keeps the substrate panel visible
  // instead of pushing the loops panel to front.
  if (_costDataManager?.isLoaded() && _moduleEventBus?.publish) {
    log('info', '[Loops Module] Cost data is loaded; auto-entering loop mode');
    _moduleEventBus.publish('loops:setLoopMode', {
      action: 'enable',
      activatePanel: false,
    });
  }

  // Potentially trigger UI update if loopInstance exists
  loopInstance?.renderLoopPanel();
}

// Removed old handleCheckLocationRequest as it will be replaced by handleUserLocationCheckForLoops from loopEvents.js

/**
 * Registration function for the Loops module.
 * Registers the loops panel and potentially primary event handlers.
 */
export function register(registrationApi) {
  log('info', '[Loops Module] Registering...');

  // Dynamically load module CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'modules/loops/loop.css';
  document.head.appendChild(link);
  log('info', '[Loops Module] CSS loaded');

  // Register panel component with the CLASS CONSTRUCTOR directly
  registrationApi.registerPanelComponent(
    'loopsPanel',
    LoopUI // Pass the class constructor directly
  );

  // Register public functions for external access (e.g., tests)
  registrationApi.registerPublicFunction(moduleInfo.name, 'getLoopState', () => {
    return loopStateSingleton;
  });

  // Note: gameState functions are accessed directly via the 'gameState' module's
  // public API, not re-exported through loops. Internal loops code uses _gameStateAPI.

  registrationApi.registerPublicFunction(moduleInfo.name, 'getLoopsModuleDispatcher', () => {
    return moduleDispatcher;
  });

  // Register cost generation public functions
  registrationApi.registerPublicFunction(moduleInfo.name, 'getCostGenerator', () => {
    return _costGenerator;
  });

  registrationApi.registerPublicFunction(moduleInfo.name, 'getCostDataManager', () => {
    return _costDataManager;
  });

  registrationApi.registerPublicFunction(moduleInfo.name, 'getPathFinder', () => {
    return _pathFinder;
  });

  // Register Loops settings schema snippet
  registrationApi.registerSettingsSchema({
    type: 'object',
    properties: {
      defaultSpeed: {
        type: 'number',
        minimum: 0.1,
        default: 100,
        label: 'Default Loop Speed',
      },
      autoRestart: {
        type: 'boolean',
        default: false,
        label: 'Auto-Restart Queue',
      },
      loopModeEnabled: {
        type: 'boolean',
        default: false,
        label: 'Auto-Enter Loop Mode',
      },
      // Add other loop-specific settings here
    },
  });

  // user: + system:locationCheck — same handler, both forwarded.
  for (const evName of ['user:locationCheck', 'system:locationCheck']) {
    registrationApi.registerDispatcherReceiver(
      moduleInfo.name,
      evName,
      (data) => handleUserLocationCheckForLoops(data, evName),
      { direction: 'up', condition: 'conditional', timing: 'immediate' }
    );
  }

  // Register dispatcher receiver for user:itemCheck
  registrationApi.registerDispatcherReceiver(
    moduleInfo.name,
    'user:itemCheck',
    handleUserItemCheckForLoops,
    { direction: 'up', condition: 'conditional', timing: 'immediate' }
  );

  // Register dispatcher receiver for user:exitClicked
  // When loop mode is active, this handler intercepts the event (blocks both discovery and move)
  // When loop mode is not active, it propagates to discovery module, then regions module
  registrationApi.registerDispatcherReceiver(
    moduleInfo.name,
    'user:exitClicked',
    handleUserExitClickedForLoops,
    { direction: 'up', condition: 'conditional', timing: 'immediate' }
  );

  // Register dispatcher sender for loop action events (consumed by discovery module)
  registrationApi.registerDispatcherSender('loop:exploreCompleted', 'bottom');
  registrationApi.registerDispatcherSender('loop:moveCompleted', 'bottom');

  // Register events that loops publishes
  registrationApi.registerEventBusPublisher('loopState:actionCompleted');
  registrationApi.registerEventBusPublisher('loopState:autoRestartChanged');
  registrationApi.registerEventBusPublisher('loopState:pauseStateChanged');
  registrationApi.registerEventBusPublisher('loopState:processingStopped');
  registrationApi.registerEventBusPublisher('loopState:progressUpdated');
  registrationApi.registerEventBusPublisher('loopState:queueCompleted');
  registrationApi.registerEventBusPublisher('loopState:queueUpdated');
  registrationApi.registerEventBusPublisher('loopState:speedChanged');
  registrationApi.registerEventBusPublisher('loopState:stateLoaded');
  // gameState owns the resource economy and registers gameState:manaChanged
  // / gameState:xpChanged itself, but loopState._processFrame also emits
  // gameState:xpChanged each frame for fine-grained UI progress (gameState's
  // addRegionXP only fires on level-up). Re-register here so the eventBus
  // recognizes loops as a co-publisher.
  registrationApi.registerEventBusPublisher('gameState:xpChanged');
  registrationApi.registerEventBusPublisher('loopState:loopReset');

  // Phase 6: substrate-handled completion protocol. Loops publishes
  // substrateActionBegan when parking a maze-region action; the
  // substrate panel responds with substrateActionCompleted (which it
  // also publishes — the substrate is the canonical owner of that
  // event but loops dispatches into the same eventBus, so co-register
  // here for the substrate's UI-side response wiring too).
  registrationApi.registerEventBusPublisher('loops:substrateActionBegan');
  registrationApi.registerEventBusPublisher('loops:substrateActionCompleted');
  registrationApi.registerEventBusPublisher('loopState:newActionStarted');
  registrationApi.registerEventBusPublisher('loopState:exploreActionRepeated');
  registrationApi.registerEventBusPublisher('loopUI:modeChanged');
  registrationApi.registerEventBusPublisher('loops:setLoopMode');

  // Cost generation events
  registrationApi.registerEventBusPublisher('costGenerator:progress');
  registrationApi.registerEventBusPublisher('costGenerator:complete');
  registrationApi.registerEventBusPublisher('costDataManager:loaded');
  registrationApi.registerEventBusPublisher('costDataManager:loadError');
  registrationApi.registerEventBusPublisher('costDataManager:cleared');
}

/**
 * Initialization function for the Loops module.
 * Initializes loop state, loads settings, subscribes to events.
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `[Loops Module] Initializing with priority ${priorityIndex}...`);

  // Store API references
  _moduleEventBus = initializationApi.getEventBus();
  moduleDispatcher = initializationApi.getDispatcher(); // Store the full dispatcher instance

  const moduleSettings = await initializationApi.getModuleSettings(moduleId);

  // Get gameState public API functions
  const gameStateAPI = {
    getPath: initializationApi.getModuleFunction('gameState', 'getPath'),
    trimPath: initializationApi.getModuleFunction('gameState', 'trimPath'),
    setAllowLoops: initializationApi.getModuleFunction('gameState', 'setAllowLoops'),
    addLocationCheck: initializationApi.getModuleFunction('gameState', 'addLocationCheck'),
    addCustomAction: initializationApi.getModuleFunction('gameState', 'addCustomAction'),
    insertLocationCheckAt: initializationApi.getModuleFunction('gameState', 'insertLocationCheckAt'),
    insertCustomActionAt: initializationApi.getModuleFunction('gameState', 'insertCustomActionAt'),
    removeLocationCheckAt: initializationApi.getModuleFunction('gameState', 'removeLocationCheckAt'),
    removeCustomActionAt: initializationApi.getModuleFunction('gameState', 'removeCustomActionAt'),
    clearActionsAt: initializationApi.getModuleFunction('gameState', 'clearActionsAt'),
    removeAllActionsOfType: initializationApi.getModuleFunction('gameState', 'removeAllActionsOfType'),
    getCurrentRegion: initializationApi.getModuleFunction('gameState', 'getCurrentRegion'),
    getRegionCounts: initializationApi.getModuleFunction('gameState', 'getRegionCounts'),
    setStartRegions: initializationApi.getModuleFunction('gameState', 'setStartRegions'),
    isStartRegion: initializationApi.getModuleFunction('gameState', 'isStartRegion'),
    reset: initializationApi.getModuleFunction('gameState', 'reset'),
    getState: initializationApi.getModuleFunction('gameState', 'getState'),
    // Loop-mode resource API
    getCurrentMana: initializationApi.getModuleFunction('gameState', 'getCurrentMana'),
    getMaxMana: initializationApi.getModuleFunction('gameState', 'getMaxMana'),
    deductMana: initializationApi.getModuleFunction('gameState', 'deductMana'),
    refillMana: initializationApi.getModuleFunction('gameState', 'refillMana'),
    recalculateMaxMana: initializationApi.getModuleFunction('gameState', 'recalculateMaxMana'),
    getRegionXP: initializationApi.getModuleFunction('gameState', 'getRegionXP'),
    addRegionXP: initializationApi.getModuleFunction('gameState', 'addRegionXP'),
  };
  
  // Store the API for access by loopUI
  _gameStateAPI = gameStateAPI;
  
  if (!gameStateAPI.getPath) {
    log('error', '[Loops Module] Could not get gameState API functions');
  }

  // Initialize LoopState singleton (which might load from storage)
  log('info', '[Loops Module] Initializing LoopState singleton...');
  if (loopStateSingleton) {
    try {
      // Inject dependencies BEFORE initializing loopState itself
      loopStateSingleton.setDependencies({
        eventBus: _moduleEventBus,
        stateManager: stateManager,
        dispatcher: moduleDispatcher, // Pass dispatcher to loopStateSingleton if needed
        gameState: gameStateAPI.getPath ? gameStateAPI : null
      });

      loopStateSingleton.initialize();
      // Apply settings
      loopStateSingleton.setGameSpeed(moduleSettings?.defaultSpeed ?? 100);
      loopStateSingleton.setAutoRestartQueue(
        moduleSettings?.autoRestart ?? false
      );
      log('info', 
        '[Loops Module] LoopState singleton initialized and settings applied.'
      );
    } catch (error) {
      log('error', 
        '[Loops Module] Error initializing LoopState singleton:',
        error
      );
      // If state fails, maybe disable the module?
    }
  } else {
    log('error', 
      '[Loops Module] LoopState singleton not available during initialization.'
    );
  }

  // Initialize loop events handlers
  initializeLoopEvents(_moduleEventBus);

  // Initialize cost generation components
  log('info', '[Loops Module] Initializing cost generation components...');
  try {
    // Create PathFinder instance
    _pathFinder = new PathFinder(stateManager);

    // Create CostDataManager instance
    _costDataManager = new CostDataManager(_moduleEventBus);

    // Create CostGenerator instance with dependencies
    _costGenerator = new CostGenerator({
      loopState: loopStateSingleton,
      stateManager: stateManager,
      pathFinder: _pathFinder,
      eventBus: _moduleEventBus,
      costDataManager: _costDataManager,
      dispatcher: moduleDispatcher,
      gameStateAPI: gameStateAPI,
    });

    // Inject costDataManager into loopState for per-region/per-location cost lookups
    if (loopStateSingleton && typeof loopStateSingleton.setCostDataManager === 'function') {
      loopStateSingleton.setCostDataManager(_costDataManager);
    }

    log('info', '[Loops Module] Cost generation components initialized');

    // Expose loops game data on window for console debugging/editing
    if (typeof window !== 'undefined') {
      window.loops = {
        // Core state
        get state() { return loopStateSingleton; },
        get costData() { return _costDataManager; },
        get costGenerator() { return _costGenerator; },
        get pathFinder() { return _pathFinder; },
        get gameState() { return _gameStateAPI; },

        // Convenience accessors (mana state lives in gameState; setters route
        // through gameState's emitManaChanged for the canonical event).
        get mana() { return loopStateSingleton.currentMana; },
        set mana(v) {
          loopStateSingleton.currentMana = v;
          gameStateAPI.getState?.()?.emitManaChanged?.();
        },
        get maxMana() { return loopStateSingleton.maxMana; },
        set maxMana(v) {
          loopStateSingleton.maxMana = v;
          gameStateAPI.getState?.()?.emitManaChanged?.();
        },
        get speed() { return loopStateSingleton.gameSpeed; },
        set speed(v) { loopStateSingleton.setGameSpeed(v); },
        get instant() { return loopStateSingleton.instantMode; },
        set instant(v) { loopStateSingleton.setInstantMode(v); },
        get paused() { return loopStateSingleton.isPaused; },
        set paused(v) { loopStateSingleton.setPaused(v); },

        // XP helpers
        getXP(region) { return loopStateSingleton.getRegionXP(region); },
        addXP(region, amount) { loopStateSingleton.addRegionXP(region, amount); },

        // Queue
        get queue() { return loopStateSingleton.getActionQueue(); },

        // Summary
        help() {
          console.log(`
loops.state          - Full LoopState object
loops.costData       - CostDataManager (region/location costs)
loops.costGenerator  - CostGenerator instance
loops.pathFinder     - PathFinder instance
loops.gameState    - GameState API

loops.mana           - Get/set current mana
loops.maxMana        - Get/set max mana
loops.speed          - Get/set game speed
loops.instant        - Get/set instant mode
loops.paused         - Get/set paused state

loops.getXP(region)  - Get XP data for a region
loops.addXP(region, amount) - Add XP to a region
loops.queue          - Current action queue
          `.trim());
        },
      };
      // Keep legacy reference
      window.costDataManager = _costDataManager;
    }
  } catch (error) {
    log('error', '[Loops Module] Error initializing cost generation components:', error);
  }

  // Clean up previous subscriptions before adding new ones
  loopUnsubscribeHandles.forEach((unsubscribe) => unsubscribe());
  loopUnsubscribeHandles = [];

  // Subscribe to settings changes
  if (_moduleEventBus) {
    const subscribe = (eventName, handler) => {
      log('info', `[Loops Module] Subscribing to ${eventName}`);
      try {
        const unsubscribe = _moduleEventBus.subscribe(eventName, handler);
        loopUnsubscribeHandles.push(unsubscribe);
      } catch (e) {
        log('error', `[Loops Module] Failed to subscribe to ${eventName}:`, e);
      }
    };

    // Note: defaultSpeed and autoRestart are managed by DisplaySettingsManager
    // in loopUI.js which persists them to localStorage. The settings:changed
    // handler was removed here because settingsManager doesn't persist, so
    // its values would reset localStorage-saved settings on every event.

    // Subscribe to stateManager:rulesLoaded to reset loop state when rules change
    loopUnsubscribeHandles.push(
      _moduleEventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded)
    );

    // Pick up loop_costs from in-memory rules.json data on the
    // procgen-pipeline / editor-apply paths (no URL to refetch from).
    // The rulesLoaded handler still runs afterwards but its
    // tryLoadEmbedded skips synthetic sources, so it leaves the
    // freshly-set cost data alone.
    loopUnsubscribeHandles.push(
      _moduleEventBus.subscribe('files:jsonLoaded', handleFilesJsonLoaded)
    );
  } else {
    log('error',
      '[Loops Module] EventBus not available during initialization.'
    );
  }

  log('info', '[Loops Module] Initialization complete.');

  // Return cleanup function
  return () => {
    log('info', '[Loops Module] Cleaning up... Unsubscribing from events.');
    loopUnsubscribeHandles.forEach((unsubscribe) => unsubscribe());
    loopUnsubscribeHandles = [];
    _moduleEventBus = null; // Clear references
    moduleDispatcher = null; // Clear the dispatcher on cleanup

    // Clear cost generation components
    _costGenerator = null;
    _costDataManager = null;
    _pathFinder = null;

    // Clear window references
    if (typeof window !== 'undefined') {
      delete window.loops;
      delete window.costDataManager;
    }

    // Call dispose on loopStateSingleton if it exists
    if (
      loopStateSingleton &&
      typeof loopStateSingleton.dispose === 'function'
    ) {
      log('info', '[Loops Module] Disposing LoopState singleton.');
      loopStateSingleton.dispose();
    }
  };
}

// Export singletons/instances if needed (avoid if possible)
// export { loopStateSingleton }; // Already exported by its own file
