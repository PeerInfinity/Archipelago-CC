import { DiscoveryState } from './state.js'; // Import the class
import discoveryStateSingleton from './singleton.js'; // <<< IMPORT SINGLETON
// REMOVED: import eventBus from '../../app/core/eventBus.js';

// Import singletons needed for injection
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import settingsManager from '../../app/core/settingsManager.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('discoveryModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[discoveryModule] ${message}`, ...data);
  }
}

// import stateManagerSingleton from '../stateManager/stateManagerSingleton.js'; // OLD

// --- Module Scope Variables ---
// REMOVED: let _discoveryStateInstance = null;
let _moduleEventBus = null;
let _moduleDispatcher = null;
let _unsubscribeHandles = []; // Renamed for clarity

// Module settings cache
let _settings = {
  enableDiscoveryMode: false,
  regionDiscoveryTrigger: 'onEnter',
  autoDiscoverLocations: false,
  autoDiscoverExits: false,
  undiscoveredDisplay: 'hidden'
};

// --- Module Info ---
export const moduleInfo = {
  name: 'discovery', // Use ID for consistency
  description: 'Manages discovery state in loop mode.',
};

/**
 * Registration function for the Discovery module.
 * Registers dispatcher receivers for loop actions that trigger discovery.
 */
export function register(registrationApi) {
  log('info', '[Discovery Module] Registering...');

  // Register events that discovery publishes
  registrationApi.registerEventBusPublisher('discovery:changed');
  registrationApi.registerEventBusPublisher('discovery:locationDiscovered');
  registrationApi.registerEventBusPublisher('discovery:regionDiscovered');
  registrationApi.registerEventBusPublisher('discovery:exitDiscovered');
  registrationApi.registerEventBusPublisher('discovery:modeChanged');

  // Register settings schema for discovery module
  registrationApi.registerSettingsSchema(moduleInfo.name, {
    enableDiscoveryMode: {
      type: 'boolean',
      default: false,
      description: 'Enable discovery mode - filters locations and exits to only show discovered items'
    },
    regionDiscoveryTrigger: {
      type: 'string',
      default: 'onEnter',
      description: 'When to discover regions: onEnter (when first entered) or onExitDiscovered (when an exit leading to them is discovered)'
    },
    autoDiscoverLocations: {
      type: 'boolean',
      default: false,
      description: 'Automatically discover all locations when their region is discovered'
    },
    autoDiscoverExits: {
      type: 'boolean',
      default: false,
      description: 'Automatically discover all exits when their region is discovered'
    },
    undiscoveredDisplay: {
      type: 'string',
      default: 'hidden',
      description: 'How to display undiscovered items: hidden or placeholder (shows as ???)'
    }
  });

  // Register dispatcher receivers for loop events
  registrationApi.registerDispatcherReceiver(
    moduleInfo.name,
    'loop:exploreCompleted',
    handleExploreCompleted,
    null
  );
  registrationApi.registerDispatcherReceiver(
    moduleInfo.name,
    'loop:moveCompleted',
    handleMoveCompleted,
    null
  );
  registrationApi.registerDispatcherReceiver(
    moduleInfo.name,
    'loop:locationChecked',
    handleLocationChecked,
    null
  );
}

/**
 * Initialization function for the Discovery module.
 * Creates instance, injects dependencies, subscribes to reset event.
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', 
    `[Discovery Module] Initializing with priority ${priorityIndex}...`
  );

  // Store APIs
  _moduleEventBus = initializationApi.getEventBus();
  _moduleDispatcher = initializationApi.getDispatcher(); // Store the whole API object

  // REMOVED: Create DiscoveryState instance
  // log('info', '[Discovery Module] Creating DiscoveryState instance...');
  // _discoveryStateInstance = new DiscoveryState();

  // Inject dependencies into the SINGLETON instance
  if (discoveryStateSingleton && _moduleEventBus && stateManager) {
    discoveryStateSingleton.setDependencies({
      eventBus: _moduleEventBus,
      stateManager: stateManager,
    });
    log('info',
      '[Discovery Module] Dependencies injected into DiscoveryState Singleton.'
    );
    // Note: We don't call initialize() here because static data isn't available yet.
    // Discovery will be initialized when stateManager:rulesLoaded is published.
  } else {
    log('error',
      '[Discovery Module] Failed to inject dependencies into DiscoveryState Singleton: Missing instance or APIs.'
    );
  }

  // Clean up previous subscriptions
  _unsubscribeHandles.forEach((unsubscribe) => unsubscribe());
  _unsubscribeHandles = [];

  // Load initial settings
  await loadSettings();

  // Subscribe to loop reset event via INJECTED event bus
  if (_moduleEventBus) {
    log('info', '[Discovery Module] Subscribing to loop:reset');
    const unsubscribe = _moduleEventBus.subscribe('loop:reset', () => {
      log('info', '[Discovery Module] Clearing discovery on loop:reset.');
      if (discoveryStateSingleton) {
        // <<< Use singleton
        discoveryStateSingleton.clearDiscovery();
        // initialize() is now called by handleRulesLoaded
      } else {
        log('error',
          '[Discovery Module] Cannot clear discovery: Singleton not available.'
        );
      }
    }, 'discovery');
    _unsubscribeHandles.push(unsubscribe);

    // Subscribe to stateManager:rulesLoaded to reinitialize when rules change
    log('info', '[Discovery Module] Subscribing to stateManager:rulesLoaded');
    const rulesLoadedUnsubscribe = _moduleEventBus.subscribe(
      'stateManager:rulesLoaded',
      handleRulesLoaded,
      'discovery'
    );
    _unsubscribeHandles.push(rulesLoadedUnsubscribe);

    // Subscribe to settings changes
    log('info', '[Discovery Module] Subscribing to settings:changed');
    const settingsChangedUnsubscribe = _moduleEventBus.subscribe(
      'settings:changed',
      handleSettingsChanged,
      'discovery'
    );
    _unsubscribeHandles.push(settingsChangedUnsubscribe);
  } else {
    log('error',
      '[Discovery Module] EventBus not available for subscriptions.'
    );
  }

  log('info', '[Discovery Module] Initialization complete.');

  // Return cleanup function
  return () => {
    log('info', '[Discovery Module] Cleaning up... Unsubscribing & disposing.');
    _unsubscribeHandles.forEach((unsubscribe) => unsubscribe());
    _unsubscribeHandles = [];

    if (
      discoveryStateSingleton && // <<< Use singleton
      typeof discoveryStateSingleton.dispose === 'function'
    ) {
      discoveryStateSingleton.dispose();
    }

    // Clear references
    // REMOVED: _discoveryStateInstance = null;
    _moduleEventBus = null;
    _moduleDispatcher = null;
  };
}

// REMOVED: postInitialize function

// --- Event Handlers (Updated to use _discoveryStateInstance and _moduleDispatcher) --- //

// Handler for stateManager:rulesLoaded event - Primary Initialization Point for Discovery
function handleRulesLoaded(eventData) {
  log('info', '[Discovery Module] Received stateManager:rulesLoaded via eventBus.');

  if (!discoveryStateSingleton) {
    // <<< Use singleton
    log('error',
      '[Discovery Module] Cannot initialize: DiscoveryState singleton missing.'
    );
    return; // Cannot proceed
  }

  // Check if dependencies have been injected yet
  if (!discoveryStateSingleton.stateManager || !discoveryStateSingleton.eventBus) {
    log('warn',
      '[Discovery Module] Dependencies not yet injected, skipping initialization. Will initialize when module initialize() runs.'
    );
    return;
  }

  // Initialize or re-initialize based on the loaded rules
  log('info',
    '[Discovery Module] Initializing discoverables from stateManager:rulesLoaded handler...'
  );
  try {
    discoveryStateSingleton.initialize(); // <<< Use singleton
  } catch (error) {
    log('error',
      '[Discovery Module] Error initializing DiscoveryState from rulesLoaded:',
      error
    );
  }
}

function handleExploreCompleted(eventData) {
  log('info', '[Discovery Module] Handling loop:exploreCompleted', eventData);
  if (!eventData || !discoveryStateSingleton) return; // <<< Use singleton

  if (eventData.regionName) {
    const wasNewlyDiscovered = discoveryStateSingleton.discoverRegion(eventData.regionName);

    // If region was newly discovered and we have auto-discover settings
    if (wasNewlyDiscovered) {
      autoDiscoverLocationsInRegion(eventData.regionName);
      autoDiscoverExitsInRegion(eventData.regionName);
    }
  }

  // Also discover any explicitly listed locations
  if (
    eventData.discoveredLocations &&
    Array.isArray(eventData.discoveredLocations)
  ) {
    eventData.discoveredLocations.forEach(
      (locName) => discoveryStateSingleton.discoverLocation(locName)
    );
  }

  // Also discover any explicitly listed exits
  if (eventData.discoveredExits && Array.isArray(eventData.discoveredExits)) {
    if (eventData.regionName) {
      eventData.discoveredExits.forEach(
        (exitName) =>
          discoveryStateSingleton.discoverExit(eventData.regionName, exitName)
      );
    }
  }
}

function handleMoveCompleted(eventData) {
  log('info', '[Discovery Module] Handling loop:moveCompleted', eventData);
  if (!eventData || !discoveryStateSingleton) return; // <<< Use singleton

  if (eventData?.destinationRegion) {
    // Only discover the region on move if trigger is 'onEnter'
    if (_settings.regionDiscoveryTrigger === 'onEnter') {
      const wasNewlyDiscovered = discoveryStateSingleton.discoverRegion(eventData.destinationRegion);

      // If region was newly discovered, trigger auto-discovery of locations and exits
      if (wasNewlyDiscovered) {
        autoDiscoverLocationsInRegion(eventData.destinationRegion);
        autoDiscoverExitsInRegion(eventData.destinationRegion);
      }
    }

    // Always discover the exit that was used
    if (eventData.sourceRegion && eventData.exitName) {
      discoveryStateSingleton.discoverExit(
        eventData.sourceRegion,
        eventData.exitName
      );

      // If trigger is 'onExitDiscovered', discovering an exit also discovers the connected region
      if (_settings.regionDiscoveryTrigger === 'onExitDiscovered') {
        const wasNewlyDiscovered = discoveryStateSingleton.discoverRegion(eventData.destinationRegion);
        if (wasNewlyDiscovered) {
          autoDiscoverLocationsInRegion(eventData.destinationRegion);
          autoDiscoverExitsInRegion(eventData.destinationRegion);
        }
      }
    }
  }
}

function handleLocationChecked(eventData) {
  log('info', '[Discovery Module] Handling loop:locationChecked', eventData);
  if (!eventData || !discoveryStateSingleton) return; // <<< Use singleton

  if (eventData?.locationName) {
    discoveryStateSingleton.discoverLocation(eventData.locationName);
    if (eventData.regionName) {
      const wasNewlyDiscovered = discoveryStateSingleton.discoverRegion(eventData.regionName);

      // If region was newly discovered, trigger auto-discovery
      if (wasNewlyDiscovered) {
        autoDiscoverLocationsInRegion(eventData.regionName);
        autoDiscoverExitsInRegion(eventData.regionName);
      }
    }
  }
}

// --- Settings Functions ---

/**
 * Load all discovery settings from settingsManager
 */
async function loadSettings() {
  try {
    _settings.enableDiscoveryMode = await settingsManager.getSetting(
      'moduleSettings.discovery.enableDiscoveryMode', false
    );
    _settings.regionDiscoveryTrigger = await settingsManager.getSetting(
      'moduleSettings.discovery.regionDiscoveryTrigger', 'onEnter'
    );
    _settings.autoDiscoverLocations = await settingsManager.getSetting(
      'moduleSettings.discovery.autoDiscoverLocations', false
    );
    _settings.autoDiscoverExits = await settingsManager.getSetting(
      'moduleSettings.discovery.autoDiscoverExits', false
    );
    _settings.undiscoveredDisplay = await settingsManager.getSetting(
      'moduleSettings.discovery.undiscoveredDisplay', 'hidden'
    );
    log('info', '[Discovery Module] Settings loaded:', _settings);
  } catch (error) {
    log('error', '[Discovery Module] Error loading settings:', error);
  }
}

/**
 * Handle settings changes
 */
async function handleSettingsChanged({ key }) {
  if (key === '*' || key.startsWith('moduleSettings.discovery')) {
    log('info', '[Discovery Module] Settings changed, reloading...');
    const previousEnableMode = _settings.enableDiscoveryMode;
    await loadSettings();

    // If enableDiscoveryMode changed, publish the modeChanged event
    if (_settings.enableDiscoveryMode !== previousEnableMode && _moduleEventBus) {
      _moduleEventBus.publish('discovery:modeChanged', {
        active: _settings.enableDiscoveryMode
      }, 'discovery');
    }
  }
}

/**
 * Auto-discover all locations in a region based on settings
 * @param {string} regionName - The region to auto-discover locations for
 */
function autoDiscoverLocationsInRegion(regionName) {
  if (!_settings.autoDiscoverLocations) return;
  if (!discoveryStateSingleton || !stateManager) return;

  try {
    const staticData = stateManager.getStaticData();
    if (!staticData || !staticData.regions) return;

    const region = staticData.regions.get(regionName);
    if (!region || !region.locations) return;

    for (const location of region.locations) {
      discoveryStateSingleton.discoverLocation(location.name);
    }
    log('info', `[Discovery Module] Auto-discovered locations in region: ${regionName}`);
  } catch (error) {
    log('error', '[Discovery Module] Error auto-discovering locations:', error);
  }
}

/**
 * Auto-discover all exits in a region based on settings
 * @param {string} regionName - The region to auto-discover exits for
 */
function autoDiscoverExitsInRegion(regionName) {
  if (!_settings.autoDiscoverExits) return;
  if (!discoveryStateSingleton || !stateManager) return;

  try {
    const staticData = stateManager.getStaticData();
    if (!staticData || !staticData.regions) return;

    const region = staticData.regions.get(regionName);
    if (!region || !region.exits) return;

    for (const exit of region.exits) {
      discoveryStateSingleton.discoverExit(regionName, exit.name);

      // If regionDiscoveryTrigger is 'onExitDiscovered', also discover the connected region
      if (_settings.regionDiscoveryTrigger === 'onExitDiscovered') {
        discoveryStateSingleton.discoverRegion(exit.connected_region);
      }
    }
    log('info', `[Discovery Module] Auto-discovered exits in region: ${regionName}`);
  } catch (error) {
    log('error', '[Discovery Module] Error auto-discovering exits:', error);
  }
}

/**
 * Get the current discovery settings (for use by other modules)
 * @returns {Object} Current discovery settings
 */
export function getDiscoverySettings() {
  return { ..._settings };
}

// REMOVED: export { discoveryStateSingleton };
