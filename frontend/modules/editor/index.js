// UI Class for this module
import EditorUI from './editorUI.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'Plain Text Editor',
  description: 'Text Editor panel.',
};

/**
 * Registration function for the Editor module.
 * Registers the editor panel component.
 */
export function register(registrationApi) {
  console.log('[Editor Module] Registering...');
  registrationApi.registerPanelComponent('editorPanel', EditorUI);
}
