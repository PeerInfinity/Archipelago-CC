// UI Class for this module
import { ExitUI } from './exitUI.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'Exits',
  description: 'Exits display panel.',
};

/**
 * Registration function for the Exits module.
 * Registers the exits panel component.
 */
export function register(registrationApi) {
  console.log('[Exits Module] Registering...');

  // Register the panel component class constructor
  registrationApi.registerPanelComponent('exitsPanel', ExitUI);

  // Register settings schema if needed
  // No specific settings schema for Exits registration.
}
