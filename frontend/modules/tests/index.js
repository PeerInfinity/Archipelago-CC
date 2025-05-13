import eventBus from '../../app/core/eventBus.js';
import { TestUI } from './testUI.js';
import { testLogic } from './testLogic.js'; // Assuming testLogic exports an object with methods

// --- Module Info ---
export const moduleInfo = {
  name: 'tests',
  title: 'Tests', // Panel title
  description: 'Automated application feature testing.',
};

// To store the initialization API for testLogic
let initApiInstance = null;

// --- Exports for init system & other modules ---
export { register, initialize };

/**
 * Registration function for the Tests module.
 * @param {object} registrationApi - API provided by the initialization script.
 */
function register(registrationApi) {
  console.log('[Tests Module] Registering...');

  // Register the panel component
  registrationApi.registerPanelComponent('testsPanel', TestUI);

  // Register JSON Data Handler
  registrationApi.registerJsonDataHandler(
    'testsState', // Unique dataKey for the Tests module's savable state
    {
      displayName: 'Tests Configuration', // Label for the JSON Operations UI
      defaultChecked: true, // Whether it's included in JSON export by default
      requiresReload: false, // Can the data be applied live without a page reload
      getSaveDataFunction: async () => {
        // Delegate to testLogic to get the savable state
        if (testLogic && typeof testLogic.getSavableState === 'function') {
          return testLogic.getSavableState();
        }
        console.warn('[Tests Module] getSavableState not found on testLogic.');
        return { tests: [], autoStartTestsOnLoad: false }; // Default empty state
      },
      applyLoadedDataFunction: (loadedData) => {
        // Delegate to testLogic to apply the loaded state
        if (testLogic && typeof testLogic.applyLoadedState === 'function') {
          testLogic.applyLoadedState(loadedData);
        } else {
          console.warn(
            '[Tests Module] applyLoadedState not found on testLogic.'
          );
        }
      },
    }
  );

  // Register events this module might publish (for UI updates, etc.)
  registrationApi.registerEventBusPublisher('tests', 'test:statusChanged');
  registrationApi.registerEventBusPublisher('tests', 'test:conditionReported');
  registrationApi.registerEventBusPublisher('tests', 'test:listUpdated');
  registrationApi.registerEventBusPublisher('tests', 'test:executionStarted');
  registrationApi.registerEventBusPublisher('tests', 'test:completed');
  registrationApi.registerEventBusPublisher('tests', 'test:allRunsCompleted');
  registrationApi.registerEventBusPublisher('tests', 'test:waitingForEvent');

  // Register events this module subscribes to
  // The main one is for auto-starting tests
  registrationApi.registerEventBusSubscriberIntent('init:postInitComplete');

  console.log('[Tests Module] Registration complete.');
}

/**
 * Initialization function for the Tests module.
 * @param {string} moduleId - The unique ID for this module ('tests').
 * @param {number} priorityIndex - The loading priority index.
 * @param {object} initializationApi - API provided by the initialization script.
 */
async function initialize(moduleId, priorityIndex, initializationApi) {
  console.log(`[Tests Module] Initializing with priority ${priorityIndex}...`);
  initApiInstance = initializationApi; // Store for testLogic

  // Make the initializationApi available to testLogic if needed
  if (testLogic && typeof testLogic.setInitializationApi === 'function') {
    testLogic.setInitializationApi(initializationApi);
  }

  // Subscribe to the event that signifies the application is fully loaded
  // and ready for optional actions like starting tests.
  // 'init:postInitComplete' seems like a good candidate.
  eventBus.subscribe('init:postInitComplete', async () => {
    console.log('[Tests Module] Received init:postInitComplete event.');
    if (
      testLogic &&
      typeof testLogic.getAutoStartSetting === 'function' &&
      typeof testLogic.runAllEnabledTests === 'function'
    ) {
      const autoStart = await testLogic.getAutoStartSetting(); // Assuming this might be async if state isn't loaded yet
      if (autoStart) {
        console.log(
          '[Tests Module] autoStartTestsOnLoad is true. Running all enabled tests...'
        );
        // Small delay to ensure the UI has settled from other post-init tasks
        setTimeout(() => {
          testLogic.runAllEnabledTests();
        }, 500);
      } else {
        console.log('[Tests Module] autoStartTestsOnLoad is false.');
      }
    } else {
      console.warn(
        '[Tests Module] testLogic not fully available to check autoStart or run tests.'
      );
    }
  });

  console.log('[Tests Module] Initialization setup complete.');
}

// Potentially export a getter for the initApiInstance if testLogic needs it but can't be passed directly
export function getTestsModuleInitializationApi() {
  return initApiInstance;
}
