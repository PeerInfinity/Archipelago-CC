import eventBus from '../../app/core/eventBus.js';

// Basic CSS for the panel
const CSS = `
.modules-panel {
    padding: 10px;
    font-family: sans-serif;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
}
.module-entry {
    border: 1px solid #444;
    border-radius: 4px;
    margin-bottom: 8px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #333;
}
.module-info {
    flex-grow: 1;
    margin-right: 10px;
}
.module-name {
    font-weight: bold;
    margin-bottom: 4px;
}
.module-description {
    font-size: 0.9em;
    color: #ccc;
}
.module-controls {
    display: flex;
    align-items: center;
    gap: 5px;
}
.module-controls label {
    display: flex;
    align-items: center;
    cursor: pointer;
}
.module-controls input[type="checkbox"] {
    margin-right: 5px;
}
/* Basic button styling */
.module-controls button {
    padding: 3px 6px;
    cursor: pointer;
    background-color: #555;
    color: white;
    border: 1px solid #666;
    border-radius: 3px;
}
.module-controls button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}
.module-controls button:hover:not(:disabled) {
    background-color: #777;
}
`;

export class ModulesPanel {
  constructor(container, componentState, api) {
    this.container = container;
    this.api = api; // API provided during module initialization
    this.moduleStates = {}; // Store state like { moduleId: { enabled: true, definition: {...} } }
    this.loadPriority = [];
    this.rootElement = null;
    this.buttonContainer = null; // Added
    this.moduleListContainer = null; // Added

    // GoldenLayout specifics
    this.container.setTitle('Modules');
    this._initializeUI();
  }

  getRootElement() {
    return this.rootElement;
  }

  _initializeUI() {
    // Add basic styling
    const style = document.createElement('style');
    style.textContent = CSS;
    this.container.getElement().appendChild(style);

    // Create main panel container
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'modules-panel';

    // Create container for buttons
    this.buttonContainer = document.createElement('div');
    this.buttonContainer.className = 'modules-panel-buttons';
    this.rootElement.appendChild(this.buttonContainer);

    // Create container for the module list
    this.moduleListContainer = document.createElement('div');
    this.moduleListContainer.className = 'modules-panel-list';
    this.rootElement.appendChild(this.moduleListContainer);

    // Append the main container to Golden Layout
    this.container.getElement().appendChild(this.rootElement);

    // Add the test button to its container
    this._addTestButton();

    // Request module data to populate the list container
    this._requestModuleData();

    // TODO: Listen for external events (e.g., module state changed, panel closed)
    // eventBus.subscribe('module:stateChanged', this._handleModuleStateChange.bind(this));
    // eventBus.subscribe('panel:closed', this._handlePanelClosed.bind(this));
  }

  async _requestModuleData() {
    if (!this.api || typeof this.api.getModuleManager !== 'function') {
      console.error('ModulesPanel: ModuleManager not available via initApi.');
      // Display error in the list container
      if (this.moduleListContainer)
        this.moduleListContainer.textContent =
          'Error: Module management API not available.';
      return;
    }
    try {
      const moduleManager = this.api.getModuleManager();
      // Fetch data using await for clarity
      this.moduleStates = await moduleManager.getAllModuleStates();
      this.loadPriority = await moduleManager.getCurrentLoadPriority();
      this._renderModules();
    } catch (error) {
      console.error('ModulesPanel: Failed to fetch module data:', error);
      if (this.moduleListContainer)
        this.moduleListContainer.textContent = 'Error loading module data.';
    }
  }

  _renderModules() {
    // Target the specific container for the list
    if (!this.moduleListContainer) return;
    this.moduleListContainer.innerHTML = ''; // Clear previous list content

    if (!this.loadPriority || this.loadPriority.length === 0) {
      this.moduleListContainer.textContent =
        'No modules found or priority order missing.';
      return;
    }

    // Render modules in the current load priority order
    this.loadPriority.forEach((moduleId, index) => {
      const state = this.moduleStates[moduleId];
      if (!state || !state.definition) return;
      const module = state.definition;
      const isEnabled = state.enabled;
      const isCoreModule =
        moduleId === 'stateManager' || moduleId === 'modules';
      const entryDiv = document.createElement('div');
      entryDiv.className = 'module-entry';
      entryDiv.dataset.moduleId = moduleId;
      const infoDiv = document.createElement('div');
      infoDiv.className = 'module-info';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'module-name';
      nameDiv.textContent = moduleId;
      const descDiv = document.createElement('div');
      descDiv.className = 'module-description';
      descDiv.textContent = module.description || 'No description';
      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(descDiv);
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'module-controls';
      const enableLabel = document.createElement('label');
      const enableCheckbox = document.createElement('input');
      enableCheckbox.type = 'checkbox';
      enableCheckbox.checked = isEnabled;
      enableCheckbox.disabled = isCoreModule;
      enableCheckbox.addEventListener('change', (event) => {
        this._handleEnableToggle(moduleId, event.target.checked);
      });
      enableLabel.appendChild(enableCheckbox);
      enableLabel.appendChild(document.createTextNode('Enabled'));
      controlsDiv.appendChild(enableLabel);
      const upButton = document.createElement('button');
      upButton.textContent = '▲';
      upButton.title = 'Increase Priority (Move Up)';
      upButton.disabled = isCoreModule || index === 0;
      const downButton = document.createElement('button');
      downButton.textContent = '▼';
      downButton.title = 'Decrease Priority (Move Down)';
      downButton.disabled =
        isCoreModule || index === this.loadPriority.length - 1;
      controlsDiv.appendChild(upButton);
      controlsDiv.appendChild(downButton);
      entryDiv.appendChild(infoDiv);
      entryDiv.appendChild(controlsDiv);

      // Append the entry to the list container
      this.moduleListContainer.appendChild(entryDiv);
    });
  }

  async _handleEnableToggle(moduleId, shouldBeEnabled) {
    console.log(
      `Toggling module ${moduleId} to ${
        shouldBeEnabled ? 'enabled' : 'disabled'
      }`
    );
    if (!this.api || typeof this.api.getModuleManager !== 'function') {
      console.error('Cannot toggle module: ModuleManager not available.');
      this._updateCheckboxVisualState(moduleId, !shouldBeEnabled); // Revert visual state
      return;
    }

    const moduleManager = this.api.getModuleManager();
    try {
      if (shouldBeEnabled) {
        await moduleManager.enableModule(moduleId);
      } else {
        await moduleManager.disableModule(moduleId);
      }
      // Update local state and potentially re-render or update just the checkbox
      this.moduleStates[moduleId].enabled = shouldBeEnabled;
      console.log(`Module ${moduleId} state updated successfully.`);
      // Optional: Could trigger a full re-render if needed: this._renderModules();
    } catch (error) {
      console.error(
        `Failed to ${
          shouldBeEnabled ? 'enable' : 'disable'
        } module ${moduleId}:`,
        error
      );
      // Revert the checkbox state on failure
      this._updateCheckboxVisualState(moduleId, !shouldBeEnabled);
      // Show error message to user?
    }
  }

  // _handlePriorityChange(moduleId, direction) {
  //     console.log(`Changing priority for ${moduleId}: ${direction}`);
  //     // TODO: Implement priority change logic using moduleManager
  //     // This will likely involve calling something like moduleManager.changeModulePriority(moduleId, direction)
  //     // and then calling this._requestModuleData() to refresh the UI.
  // }

  _updateCheckboxVisualState(moduleId, isChecked) {
    const checkbox = this.rootElement.querySelector(
      `.module-entry[data-module-id="${moduleId}"] input[type="checkbox"]`
    );
    if (checkbox) {
      checkbox.checked = isChecked;
      // Potentially update associated UI elements if needed
    }
  }

  // Example handler for external state changes
  _handleModuleStateChange({ moduleId, isEnabled }) {
    console.log(
      `ModulesPanel received external state change for ${moduleId}: ${isEnabled}`
    );
    if (this.moduleStates[moduleId]) {
      this.moduleStates[moduleId].enabled = isEnabled;
      this._updateCheckboxVisualState(moduleId, isEnabled);
    }
  }

  // Example handler for panel closing events
  _handlePanelClosed(closedModuleId) {
    // If closing a panel means the module is disabled, update the checkbox.
    // This depends on how panel closing and module disabling are linked.
    console.log(
      `ModulesPanel received panel closed event for ${closedModuleId}`
    );
    // Assuming closing a panel *implies* disable (this might not be true)
    // Check if the module is actually disabled now before updating UI
    // const moduleManager = this.api.getModuleManager();
    // const state = await moduleManager.getModuleState(closedModuleId);
    // if (state && !state.enabled) {
    //    this._updateCheckboxVisualState(closedModuleId, false);
    // }
  }

  // Called by GoldenLayout when the panel is destroyed
  destroy() {
    console.log('Destroying ModulesPanel');
    // Unsubscribe from events
    // eventBus.unsubscribe('module:stateChanged', this._handleModuleStateChange.bind(this));
    // eventBus.unsubscribe('panel:closed', this._handlePanelClosed.bind(this));

    // Clean up DOM elements
    if (this.rootElement) {
      this.rootElement.remove();
      this.rootElement = null;
    }
    // Other cleanup
  }

  // --- Modify Test Button Method ---
  _addTestButton() {
    const testButton = document.createElement('button');
    testButton.textContent = 'Add Test Panel';
    testButton.style.marginBottom = '10px'; // Keep spacing
    testButton.addEventListener('click', async () => {
      console.log('[ModulesPanel] Test button clicked.');
      if (!this.api || typeof this.api.getModuleManager !== 'function') {
        console.error(
          '[ModulesPanel] Cannot add test panel: ModuleManager API not available.'
        );
        return;
      }
      const moduleManager = this.api.getModuleManager();
      const panelManager = window.panelManager; // Using global reference
      if (
        panelManager &&
        typeof panelManager.createPanelForComponent === 'function'
      ) {
        console.log(
          '[ModulesPanel] Calling panelManager.createPanelForComponent("testPanel", "Test")...'
        );
        try {
          panelManager.createPanelForComponent('testPanel', 'Test');
        } catch (error) {
          console.error(
            '[ModulesPanel] Error calling createPanelForComponent from test button:',
            error
          );
        }
      } else {
        console.error(
          '[ModulesPanel] PanelManager or createPanelForComponent not available.'
        );
      }
    });
    // Append to the dedicated button container
    this.buttonContainer.appendChild(testButton);
  }
  // --- End Test Button Method ---
}
