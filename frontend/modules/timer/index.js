// frontend/modules/timer/index.js
import { TimerLogic } from './timerLogic.js';
import { stateManagerProxySingleton } from '../stateManager/index.js'; // For dependency injection


// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('timerModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[timerModule] ${message}`, ...data);
  }
}

export const moduleInfo = {
  name: 'timer',
  description: 'The location check timer: checks reachable locations on a delay. Headless — the Playback Bot\'s "any reachable location" mode drives it.',
  requires: ['stateManager'],
};

let timerLogicInstance = null;
let dispatcher = null; // Stored from initializationApi
let moduleEventBus = null; // Stored from initializationApi

/**
 * Registration function for the Timer module.
 * @param {object} registrationApi - API provided by the initialization script.
 */
export function register(registrationApi) {
  log('info', `[Timer Module] Registering module: ${moduleInfo.name}`);

  registrationApi.registerPublicFunction(
    moduleInfo.name,
    'setCheckDelay',
    (minSeconds, maxSeconds = null) => {
      if (
        timerLogicInstance &&
        typeof timerLogicInstance.setCheckDelay === 'function'
      ) {
        log('info',
          `[Timer Module] setCheckDelay called with min=${minSeconds}, max=${maxSeconds}`
        );
        timerLogicInstance.setCheckDelay(minSeconds, maxSeconds);
        return true;
      } else {
        log('error',
          '[Timer Module] setCheckDelay called but TimerLogic instance or method not ready.'
        );
        return false;
      }
    }
  );

  // Register public functions for test access
  registrationApi.registerPublicFunction(
    moduleInfo.name,
    'getTimerLogic',
    () => timerLogicInstance
  );

  // Register events this module publishes
  registrationApi.registerEventBusPublisher('timer:started');
  registrationApi.registerEventBusPublisher('timer:stopped');
  registrationApi.registerEventBusPublisher('timer:progressUpdate');
  registrationApi.registerEventBusPublisher('ui:notification');

  // Register events this module subscribes to
  registrationApi.registerEventBusSubscriberIntent(
    moduleInfo.name,
    'settings:changed'
  );

  // ADDED: Declare that this module sends 'user:locationCheck' via the dispatcher
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');

  // Timer settings. batchChecks (default true) = check all accessible
  // locations in one tick via stateManager.batchCheckLocations (fast, bypasses
  // the dispatcher). When false, the timer dispatches one user:locationCheck
  // per tick through the dispatcher so the loops panel can steer it.
  // Key: moduleSettings.timer.batchChecks (read in timerLogic).
  registrationApi.registerSettingsSchema({
    type: 'object',
    properties: {
      batchChecks: {
        type: 'boolean',
        default: true,
        label: 'Batch location checks',
      },
    },
  });

  log('info', `[${moduleInfo.name} Module] Registration complete.`);
}

/**
 * Initialization function for the Timer module.
 * @param {string} moduleId - The unique ID for this module.
 * @param {number} priorityIndex - The loading priority index.
 * @param {object} initializationApi - API provided by the initialization script.
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', 
    `[${moduleInfo.name} Module] Initializing with priority ${priorityIndex}... (ID: ${moduleId})`
  );

  dispatcher = initializationApi.getDispatcher();
  log('info', 
    '[Timer Module] dispatcher type from initializationApi:',
    typeof dispatcher,
    dispatcher
  );
  moduleEventBus = initializationApi.getEventBus();

  if (!dispatcher || !moduleEventBus) {
    log('error', 
      `[${moduleInfo.name} Module] Critical error: Dispatcher or EventBus not available.`
    );
    return () => {}; // Return an empty cleanup function
  }

  try {
    timerLogicInstance = new TimerLogic({
      stateManager: stateManagerProxySingleton,
      eventBus: moduleEventBus,
      dispatcher: dispatcher,
      moduleName: moduleInfo.name, // Pass module name for logging
    });

    if (
      timerLogicInstance &&
      typeof timerLogicInstance.initialize === 'function'
    ) {
      timerLogicInstance.initialize();
    } else {
      log('error', 
        `[${moduleInfo.name} Module] timerLogicInstance or its initialize method is problematic.`
      );
    }
  } catch (error) {
    log('error', 
      `[${moduleInfo.name} Module] Error during instantiation or initialization of TimerLogic:`,
      error
    );
  }

  log('info', `[${moduleInfo.name} Module] Initialization complete.`);

  return () => {
    log('info', `[${moduleInfo.name} Module] Cleaning up...`);
    if (
      timerLogicInstance &&
      typeof timerLogicInstance.dispose === 'function'
    ) {
      timerLogicInstance.dispose();
    }
    timerLogicInstance = null;
    dispatcher = null;
    moduleEventBus = null;
  };
}

// No postInitialize needed for this module currently.
// export async function postInitialize(initializationApi) {}
