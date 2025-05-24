// frontend/modules/tests/index.js
import { TestUI } from './testUI.js';
import { testLogic } from './testLogic.js';
import eventBus from '../../app/core/eventBus.js'; // Assuming global eventBus

export const moduleInfo = {
  name: 'tests',
  title: 'Tests', // Title for the panel in GoldenLayout
  description: 'Automated application feature testing.',
};

let appInitializationApi = null;

/**
 * Registration function for the Tests module.
 * @param {object} registrationApi - API provided by the initialization script.
 */
export function register(registrationApi) {
  console.log('[Tests Module] Registering...');

  registrationApi.registerPanelComponent('testsPanel', TestUI);

  registrationApi.registerJsonDataHandler('testsConfig', {
    displayName: 'Tests Configuration',
    defaultChecked: true,
    requiresReload: false, // Test list, enabled states can be updated live. Auto-start applies on next load.
    getSaveDataFunction: async () => {
      console.log('[Tests Module] getSaveDataFunction called for testsConfig');
      return testLogic.getSavableState();
    },
    applyLoadedDataFunction: async (data) => {
      console.log(
        '[Tests Module] applyLoadedDataFunction called for testsConfig with:',
        data
      );
      console.log(
        '[Tests Module] data.autoStartTestsOnLoad:',
        data?.autoStartTestsOnLoad
      );
      await testLogic.applyLoadedState(data);

      // Debug: Check if auto-start was set
      console.log(
        '[Tests Module] After applyLoadedState (awaited), shouldAutoStartTests():',
        testLogic.shouldAutoStartTests()
      );

      // Optionally, trigger a UI refresh if the panel might already be open
      eventBus.publish('test:listUpdated', {
        tests: await testLogic.getTests(),
      });
    },
  });

  console.log('[Tests Module] Registration complete.');
}

/**
 * Initialization function for the Tests module.
 * @param {string} moduleId - The unique ID for this module.
 * @param {number} priorityIndex - The loading priority index.
 * @param {object} initializationApi - API provided by the initialization script.
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  console.log(`[Tests Module] Initializing with priority ${priorityIndex}...`);
  appInitializationApi = initializationApi;

  // Pass the initializationApi to testLogic so it can use moduleManager etc.
  testLogic.setInitializationApi(appInitializationApi);
  testLogic.setEventBus(eventBus); // Pass eventBus to testLogic

  // Listen for the app to be fully ready for basic setup
  eventBus.subscribe('app:readyForUiDataLoad', () => {
    console.log('[Tests Module] app:readyForUiDataLoad received.');

    // Debug: Check current mode
    const currentMode =
      window.G_currentActiveMode ||
      localStorage.getItem('archipelagoToolSuite_lastActiveMode') ||
      'unknown';
    console.log('[Tests Module] Current application mode:', currentMode);
  });

  // Listen for when test loaded state is fully applied (including auto-start check)
  eventBus.subscribe('test:loadedStateApplied', (eventData) => {
    console.log('[Tests Module] test:loadedStateApplied received:', eventData);
    console.log(
      '[Tests Module] Auto-start handling is now done by testLogic.applyLoadedState()'
    );
  });

  console.log('[Tests Module] Initialization complete.');
}

// Function to allow testLogic.js to get the main initialization API if needed later
// (though direct passing during testLogic.initialize is preferred for now)
export function getAppInitializationApi() {
  return appInitializationApi;
}
