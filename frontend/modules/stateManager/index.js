// Remove unused legacy imports
// import { StateManager } from './stateManager.js';
// import stateManagerSingleton from './stateManagerSingleton.js';

// Import the singleton proxy instance
import stateManagerProxySingleton from './stateManagerProxySingleton.js';

// Keep track of when initialization is complete
// let isInitialized = false; // No longer needed directly here
// let initializationPromise = null; // Handled by the proxy internally
let initApi = null; // Store the full init API

// --- Module Info ---
export const moduleInfo = {
  name: 'stateManager', // No panel title, use ID
  description: 'Core game state management via Web Worker.',
};

/**
 * Registration function for the StateManager module.
 * Registers events published by the StateManagerProxy.
 * @param {object} registrationApi - API provided by the initialization script.
 */
export function register(registrationApi) {
  console.log('[StateManager Module] Registering...');

  // Register events published by the StateManagerProxy on the EventBus
  registrationApi.registerEventBusPublisher(
    'stateManager',
    'stateManager:rulesLoaded' // Confirms worker loaded initial rules and sent snapshot
  );
  registrationApi.registerEventBusPublisher(
    'stateManager',
    'stateManager:snapshotUpdated' // Indicates a new state snapshot is available in the proxy cache
  );
  registrationApi.registerEventBusPublisher(
    'stateManager',
    'stateManager:computationProgress' // Progress updates during long computations
  );
  registrationApi.registerEventBusPublisher(
    'stateManager',
    'stateManager:workerQueueStatus' // Updates on the worker's internal queue status
  );
  registrationApi.registerEventBusPublisher(
    'stateManager',
    'stateManager:workerError' // Non-critical errors reported by the worker during processing
  );
  registrationApi.registerEventBusPublisher(
    'stateManager',
    'stateManager:error' // Critical errors (e.g., worker init failure, communication failure)
  );
  // Add other specific events forwarded by the proxy if needed (e.g., 'stateManager:itemAdded')

  // Register events this module (or the proxy logic implicitly) might subscribe to
  registrationApi.registerEventBusSubscriberIntent('init:postInitComplete');
  // TODO: Add intents for events the proxy might need to listen for (e.g., server messages for sync)

  console.log('[StateManager Module] Registration complete.');
}

/**
 * Initialization function for the StateManager module.
 * Basic setup, stores the init API.
 * @param {string} moduleId - The unique ID for this module ('stateManager').
 * @param {number} priorityIndex - The loading priority index.
 * @param {object} initializationApi - API provided by the initialization script.
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  console.log(
    `[StateManager Module] Initializing with priority ${priorityIndex}...`
  );
  // Store the full API for use in postInitialize
  initApi = initializationApi;

  // The proxy singleton instance is created automatically when this module is imported.
  // No explicit instance creation needed here.

  console.log(
    '[StateManager Module] Basic initialization complete (proxy singleton exists).'
  );
}

/**
 * Post-initialization function for the StateManager module.
 * Loads default rules by fetching them and sending them to the worker via the proxy.
 * Waits for the worker to confirm loading is complete.
 * @param {object} initializationApi - API provided by the initialization script.
 */
export async function postInitialize(initializationApi) {
  console.log('[StateManager Module] Post-initializing...');
  // Ensure we have the full initApi stored from the initialize step
  const eventBus = initApi?.getEventBus();
  if (!initApi || !eventBus) {
    console.error(
      '[StateManager Module] Initialization API or EventBus not available in postInitialize. Cannot load rules.'
    );
    // Publish a critical error?
    return;
  }

  // Listen for the signal that all modules are post-initialized
  console.log(
    '[StateManager Module] Subscribing to init:postInitComplete on eventBus...'
  );
  eventBus.subscribe('init:postInitComplete', async () => {
    console.log(
      '[StateManager Module] Received init:postInitComplete, triggering load of default rules...'
    );

    try {
      console.log(
        '[StateManager Module] Attempting to load default_rules.json...'
      );
      let jsonData = null;
      let selectedPlayerId = null;
      let playerInfo = null;

      // Fetch the rules JSON
      const response = await fetch('./default_rules.json');
      if (!response.ok) {
        throw new Error(
          `HTTP error fetching default_rules.json! status: ${response.status}`
        );
      }
      jsonData = await response.json();
      console.log(
        '[StateManager Module] Successfully fetched default_rules.json'
      );

      // Player Selection Logic (from old loadAndProcessDefaultRules)
      const playerIds = Object.keys(jsonData.player_names || {});
      const playerNames = jsonData.player_names || {};

      if (playerIds.length === 0) {
        throw new Error('No players found in the JSON data.');
      } else if (playerIds.length === 1) {
        selectedPlayerId = playerIds[0];
        console.log(
          `[StateManager Module] Auto-selected single player ID: ${selectedPlayerId}`
        );
      } else {
        // TODO: Implement proper player selection UI or logic for multiple players
        // For now, just pick the first one as a default fallback
        selectedPlayerId = playerIds[0];
        console.warn(
          `[StateManager Module] Multiple players found, auto-selecting first ID: ${selectedPlayerId}. Implement proper selection.`
        );
        // Example prompt logic (replace with actual UI interaction):
        // const playerOptions = playerIds.map(id => `${id}: ${playerNames[id]}`).join('\n');
        // const choice = prompt(`Select player:\n${playerOptions}`, playerIds[0]);
        // selectedPlayerId = choice ? choice.split(':')[0] : playerIds[0];
      }

      // Construct playerInfo object for the proxy
      playerInfo = {
        playerId: selectedPlayerId,
        playerName:
          playerNames[selectedPlayerId] || `Player ${selectedPlayerId}`,
        // TODO: Determine team correctly if applicable
        team: 0, // Defaulting team to 0
      };

      console.log(`[StateManager Module] Selected player info:`, playerInfo);

      // --> ADD CACHING LOGIC HERE <--
      // Store static data on the proxy before sending load command
      const playerKey = playerInfo.playerId;
      const itemData = jsonData.items?.[playerKey];
      const groupData = jsonData.item_groups?.[playerKey];
      if (itemData && groupData) {
        try {
          stateManagerProxySingleton.setStaticData(itemData, groupData);
          console.log(
            '[StateManager Module] Static item/group data cached on proxy.'
          );
        } catch (e) {
          console.error(
            '[StateManager Module] Failed to cache static data on proxy:',
            e
          );
          // Decide if this is critical? Probably.
        }
      } else {
        console.error(
          '[StateManager Module] Could not extract itemData or groupData for caching.'
        );
        // This is likely a critical error
        throw new Error(
          'Failed to extract necessary static data from rules JSON.'
        );
      }
      // --> END CACHING LOGIC <--

      // Send rules to the worker via the proxy
      console.log('[StateManager Module] Sending rules to worker via proxy...');
      await stateManagerProxySingleton.loadRules(jsonData, playerInfo);
      console.log(
        '[StateManager Module] Worker confirmed rules loaded (proxy loadRules resolved).'
      );

      // Optional: Publish raw JSON data if needed by other modules (like editor)
      eventBus.publish('stateManager:rawJsonDataLoaded', {
        source: 'default_rules.json',
        rawJsonData: jsonData,
        selectedPlayerInfo: playerInfo,
      });
      console.log(
        '[StateManager Module] Published stateManager:rawJsonDataLoaded.'
      );
    } catch (error) {
      console.error(
        `[StateManager Module] Error during rule loading: ${error.message}`,
        error
      );
      // Publish error event
      eventBus.publish('stateManager:error', {
        message: `Failed to load default rules: ${error.message}`,
        isCritical: true, // Treat failure to load rules as critical
      });
      // Optionally re-throw or handle differently
    }
  });

  console.log(
    '[StateManager Module] Post-initialization complete (subscribed to init:postInitComplete).'
  );
}

// Export the singleton proxy instance
export { stateManagerProxySingleton };

// Remove old exports
// export { StateManager }; // Class no longer exported directly
// export { stateManagerSingleton }; // Old singleton removed
// export { stateManager }; // Old instance constant removed

// Remove old internal function
// async function loadAndProcessDefaultRules() { ... }
