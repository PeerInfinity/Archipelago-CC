// UI Class for this module
import { LocationUI } from './locationUI.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'Locations',
  description: 'Locations display panel.',
};

/**
 * Registration function for the Locations module.
 * Registers the locations panel component.
 */
export function register(registrationApi) {
  console.log('[Locations Module] Registering...');

  // Register the panel component class constructor
  registrationApi.registerPanelComponent('locationsPanel', LocationUI);

  // Register settings schema if needed
  // No settings schema specific to Locations registration.
}
