import { RegionGraphUI } from './regionGraphUI.js';

export const moduleInfo = {
  name: 'Region Graph',
  description: 'Interactive visualization of region connectivity graph with deterministic layout',
};

export function register(registrationApi) {
  console.log('[Region Graph Module] Registering...');
  
  registrationApi.registerPanelComponent('regionGraphPanel', RegionGraphUI);
}

export function initialize(moduleId, priorityIndex, initializationApi) {
  console.log(`[Region Graph Module] Initializing with ID: ${moduleId}`);
}

export function postInitialize(initializationApi) {
  console.log('[Region Graph Module] Post-initialization complete');
}