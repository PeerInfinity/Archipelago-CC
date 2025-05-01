// client/index.js - TEMPORARILY SIMPLIFIED FOR DEBUGGING

import MainContentUI from './ui/mainContentUI.js';
import storage from './core/storage.js';
import connection from './core/connection.js';
import { loadMappingsFromStorage } from './utils/idMapping.js';
import messageHandler from './core/messageHandler.js';
import LocationManager from './core/locationManager.js';
// import {
//   initializeTimerState,
//   attachLoopModeListeners,
// } from './core/timerState.js'; // Commented out
import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
// import ProgressUI from './ui/progressUI.js'; // REMOVED Import

// --- Module Info --- //
export const moduleInfo = {
  name: 'Client',
  description: 'Handles Archipelago client connection and communication.',
};

// --- Settings Schema --- //
// const settingsSchema = {
//   clientSettings: {
//     connection: {
//       serverAddress: {
//         type: 'text',
//         label: 'Server Address',
//         default: 'ws://localhost:38281',
//         description: 'WebSocket address of the Archipelago server.',
//       },
//       password: {
//         type: 'password',
//         label: 'Server Password',
//         default: '',
//         description: 'Password for the Archipelago server (if required).',
//       },
//     },
//     timing: {
//       minCheckDelay: {
//         type: 'number',
//         label: 'Min Check Delay (s)',
//         default: 30,
//         min: 1,
//         description: 'Minimum time before the client checks a location.',
//       },
//       maxCheckDelay: {
//         type: 'number',
//         label: 'Max Check Delay (s)',
//         default: 60,
//         min: 1,
//         description: 'Maximum time before the client checks a location.',
//       },
//     },
//   },
// };

// --- Registration --- //
export function register(registrationApi) {
  console.log('[Client Module] Registering...');

  centralRegistry.registerPanelComponent(
    moduleInfo.name,
    'clientPanel',
    MainContentUI
  );

  // registrationApi.registerSettingsSchema(moduleInfo.name, settingsSchema);

  // Register dispatcher listeners
  registrationApi.registerDispatcherReceiver(
    'network:connectRequest',
    handleConnectRequest
  );
  registrationApi.registerDispatcherReceiver(
    'network:disconnectRequest',
    handleDisconnectRequest
  );
}

// --- Initialization --- //
export async function initialize(moduleId, priorityIndex, initializationApi) {
  console.log(`[Client Module] Initializing with priority ${priorityIndex}...`);
  // Restore initializers
  storage.initialize(); // Assuming storage has an initialize method
  connection.initialize();
  loadMappingsFromStorage(); // Try loading mappings early
  messageHandler.initialize(); // Assuming messageHandler has an initialize method
  LocationManager.initialize();
  // initializeTimerState(); // Still commented out
  // attachLoopModeListeners(); // Still commented out

  // Attach ProgressUI to window for PanelManager  <- REMOVED
  // window.ProgressUI = ProgressUI;                 <- REMOVED
  // console.log('[Client Module] ProgressUI attached to window.'); <- REMOVED

  // Apply settings (Restore this section)
  console.log('[Client Module] Attempting to get settings...');
  let settings = null;
  try {
    settings = await initializationApi.getSettings(); // Add await
    console.log('[Client Module] Settings retrieved:', settings);
  } catch (error) {
    console.error('[Client Module] Error getting settings:', error);
    // Decide how to handle settings error - potentially return or throw
  }

  if (settings?.timing) {
    // Access timerState appropriately if/when restored
    // const timerState = window.timerState;
    console.log('[Client Module] Timing settings found:', settings.timing);
  }

  console.log('[Client Module] Initialization complete.');
}

// --- Post-Initialization --- //
export function postInitialize(postInitializationApi) {
  console.log('[Client Module] Post-initializing...');
  // const settings = postInitializationApi.getSettings(); // Use await? Check settingsManager

  // Example: Connect automatically if settings allow (or based on a specific setting)
  // if (settings?.autoConnect) {
  //    handleConnectRequest({}, postInitializationApi); // Pass API as context?
  // }
}

// --- Dispatcher Handlers --- //
function handleConnectRequest(data, context) {
  console.log('[Client Module] Received connect request via dispatcher.');
  // Ensure connection is initialized (it should be by now)
  // const storage = getStorage(); // How to get storage now? Maybe context?
  const settings = storage.getItem('clientSettings') // Need access to storage
    ? JSON.parse(storage.getItem('clientSettings'))
    : {}; // Get settings

  // Use provided data if available, otherwise use stored settings
  const connectAddress =
    data?.serverAddress || settings?.connection?.serverAddress;
  const connectPassword = data?.password || settings?.connection?.password;

  if (connectAddress) {
    connection.connect(connectAddress, connectPassword);
  } else {
    console.warn(
      '[Client Module] Cannot connect: Connection settings not found.'
    );
    // Optionally publish an error event
    eventBus.publish('error:client', {
      message: 'Connection settings not found.',
    });
  }
}

function handleDisconnectRequest(data, context) {
  console.log('[Client Module] Received disconnect request via dispatcher.');
  // Ensure connection is initialized
  connection.disconnect();
}
