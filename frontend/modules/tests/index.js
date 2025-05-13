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
    applyLoadedDataFunction: (data) => {
      console.log(
        '[Tests Module] applyLoadedDataFunction called for testsConfig with:',
        data
      );
      testLogic.applyLoadedState(data);
      // Optionally, trigger a UI refresh if the panel might already be open
      eventBus.publish('test:listUpdated', { tests: testLogic.getTests() });
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

  // Listen for the app to be fully ready before considering auto-start
  eventBus.subscribe('app:readyForUiDataLoad', async () => {
    console.log('[Tests Module] app:readyForUiDataLoad received.');
    // Ensure testLogic has loaded its state (which includes autoStartTestsOnLoad)
    // applyLoadedState should have been called by now if there was saved data.
    if (testLogic.shouldAutoStartTests()) {
      console.log(
        '[Tests Module] autoStartTestsOnLoad is true. Running all enabled tests.'
      );
      try {
        await testLogic.runAllEnabledTests();
      } catch (error) {
        console.error(
          '[Tests Module] Error during auto-start of tests:',
          error
        );
      }
    } else {
      console.log(
        '[Tests Module] autoStartTestsOnLoad is false or not yet determined.'
      );
    }
  });

  console.log('[Tests Module] Initialization complete.');
}

// Function to allow testLogic.js to get the main initialization API if needed later
// (though direct passing during testLogic.initialize is preferred for now)
export function getAppInitializationApi() {
  return appInitializationApi;
}
