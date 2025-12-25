import { HelperUI } from './helperUI.js';

// Helper function for logging
function log(level, message, ...data) {
  if (window.logger) {
    window.logger[level]('HelpersModule', message, ...data);
  } else {
    console.log(`[HelpersModule] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'helpers',
  title: 'Helpers',
  componentType: 'helpersPanel',
  icon: 'fn',
  column: 3, // Right column
  description: 'Helper functions display panel.',
};

class HelpersModule {
  constructor() {
    this.ui = null;
    log('info', 'Helpers module instance created.');
  }

  register(registrationApi) {
    registrationApi.registerPanelComponent(
      'helpersPanel',
      HelperUI // Pass the class constructor itself
    );

    // Register EventBus subscriber intentions
    registrationApi.registerEventBusSubscriberIntent(
      'stateManager:snapshotUpdated'
    );
    registrationApi.registerEventBusSubscriberIntent('stateManager:ready');
    registrationApi.registerEventBusSubscriberIntent(
      'stateManager:rulesLoaded'
    );
    registrationApi.registerEventBusSubscriberIntent('settings:changed');

    log('info', 'HelperUI panel component registered.');
  }

  initialize(initializationApi) {
    log('info', 'Helpers module initialized.');
    // No complex initialization needed for this module at this time
  }
}

const helpersModule = new HelpersModule();

export function register(registrationApi) {
  helpersModule.register(registrationApi);
}

export function initialize(initializationApi) {
  helpersModule.initialize(initializationApi);
}
