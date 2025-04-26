import eventBus from '../../../app/core/eventBus.js';

export default class EditorUI {
  constructor() {
    // ... (constructor logic) ...
    this.pendingData = null; // Initialize pendingData
  }

  // ... (getRootElement, etc.) ...

  initialize() {
    // ... (initialize logic) ...
    // If there was pending data, load it now
    if (this.pendingData) {
      this.loadJsonData(this.pendingData);
      this.pendingData = null; // Clear pending data
    }
    // ... (rest of initialize logic) ...
  }

  /**
   * Loads new JSON data into the editor.
   * @param {object} jsonData - The JSON data object to load.
   */
  loadJsonData(jsonData) {
    if (this.editor) {
      console.log('[EditorUI] Loading new JSON data into editor...');
      try {
        this.editor.set(jsonData);
        console.log('[EditorUI] JSON data loaded successfully.');
      } catch (error) {
        console.error('[EditorUI] Error loading JSON data into editor:', error);
        // Optionally display an error message in the UI
      }
    } else {
      console.warn('[EditorUI] Editor instance not available, storing data.');
      // Store the data to load it when the editor is initialized
      this.pendingData = jsonData;
    }
  }

  onPanelOpen() {
    // ... (onPanelOpen logic) ...
  }

  onPanelDestroy() {
    // ... (onPanelDestroy logic) ...
  }

  onPanelResize(width, height) {
    // ... (onPanelResize logic) ...
  }
}
