import eventBus from '../../app/core/eventBus.js';
// Corrected import for settingsManager (default import)
import settingsManager from '../../app/core/settingsManager.js';
// import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js'; // If needed later

export class JsonUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    this.rootElement = null;
    this.currentModeDisplay = null;
    this.modeNameInput = null;
    this.checkboxes = {};
    this.knownModesList = null;
    this.modesJsonList = null; // For modes from modes.json

    this._createBaseUI();
    this._populateKnownModesList(); // Initial population

    // Listen for GoldenLayout destroy event
    this.container.on('destroy', () => {
      this._destroy();
    });

    // Listen for the actual active mode determined by init.js
    eventBus.subscribe('app:activeModeDetermined', (data) => {
      if (data && data.activeMode) {
        console.log(
          `[JsonUI] Received app:activeModeDetermined, updating display to: ${data.activeMode}`
        );
        this.updateCurrentModeDisplay(data.activeMode);
      } else {
        console.warn(
          '[JsonUI] Received app:activeModeDetermined but no activeMode in payload.',
          data
        );
      }
    });

    // Listen for modes.json being loaded
    eventBus.subscribe('app:modesJsonLoaded', (data) => {
      if (data && data.modesConfig) {
        console.log(
          '[JsonUI] Received app:modesJsonLoaded event, populating modes.json list.'
        );
        this._populateModesJsonList(data.modesConfig);
      } else {
        console.warn(
          '[JsonUI] Received app:modesJsonLoaded event but no modesConfig in payload.',
          data
        );
      }
    });

    // Check if modes.json was already loaded and the event missed
    if (window.G_modesConfig) {
      console.log(
        '[JsonUI] G_modesConfig already exists on window. Populating modes.json list directly.'
      );
      this._populateModesJsonList(window.G_modesConfig);
    }

    // TODO: Populate current mode, known modes, and checkbox states
    // this.updateCurrentModeDisplay('default'); // Initial placeholder - REMOVED, will be set by event
  }

  _createBaseUI() {
    const html = `
      <div class="json-panel-container panel-container" style="overflow-y: auto; height: 100%;">
        <div class="sidebar-header">
          <h2>JSON Data Management</h2>
        </div>

        <div class="json-section">
          <h3>Current Mode: <span id="json-current-mode">default</span></h3>
          <label for="json-mode-name">Mode Name for Save/Load:</label>
          <input type="text" id="json-mode-name" value="default" />
        </div>

        <div class="json-section">
          <h4>Include in Operations:</h4>
          <div class="checkbox-container">
            <input type="checkbox" id="json-chk-rules" data-config-key="rulesConfig" checked />
            <label for="json-chk-rules">Rules Config (rules.json)</label>
          </div>
          <div class="checkbox-container">
            <input type="checkbox" id="json-chk-modules" data-config-key="moduleConfig" checked />
            <label for="json-chk-modules">Module Config (modules.json)</label>
          </div>
          <div class="checkbox-container">
            <input type="checkbox" id="json-chk-layout" data-config-key="layoutConfig" />
            <label for="json-chk-layout">Layout Config (layout_presets.json / Current)</label>
          </div>
          <div class="checkbox-container">
            <input type="checkbox" id="json-chk-settings" data-config-key="userSettings" />
            <label for="json-chk-settings">User Settings (settings.json)</label>
          </div>
          <!-- Placeholder for module-specific data checkboxes -->
        </div>

        <div class="json-section button-group">
          <button id="json-btn-save-file" class="button">Save Combined to File</button>
          <label class="file-input-button-label">
            Load Combined from File
            <input type="file" id="json-btn-load-file" accept=".json" style="display: none;" />
          </label>
          <button id="json-btn-save-localstorage" class="button">Save to LocalStorage</button>
          <button id="json-btn-reset-defaults" class="button button-danger">Reset All Defaults</button>
        </div>

        <div class="json-section">
          <h4>Known Modes in LocalStorage:</h4>
          <ul id="json-known-modes-list">
            <!-- Modes will be populated here by JS -->
            <li><span>No modes found in LocalStorage.</span></li>
          </ul>
        </div>

        <div class="json-section">
          <h4>Known Modes in modes.json:</h4>
          <ul id="json-modes-json-list">
            <!-- Modes from modes.json will be populated here -->
            <li><span>Loading modes from modes.json...</span></li>
          </ul>
        </div>
      </div>
    `;

    // Create a temporary wrapper to parse the HTML and get the main panel element
    const tempWrapper = document.createElement('div');
    tempWrapper.innerHTML = html.trim();
    this.rootElement = tempWrapper.firstChild; // Assign the actual panel element to this.rootElement

    // Now that this.rootElement is assigned, append it to the container
    this.container.element.appendChild(this.rootElement);

    // And then get references to inner elements using this.rootElement
    this.currentModeDisplay =
      this.rootElement.querySelector('#json-current-mode');
    this.modeNameInput = this.rootElement.querySelector('#json-mode-name');
    this.knownModesList = this.rootElement.querySelector(
      '#json-known-modes-list'
    );
    this.modesJsonList = this.rootElement.querySelector(
      '#json-modes-json-list'
    ); // Get new list

    this.checkboxes.rulesConfig =
      this.rootElement.querySelector('#json-chk-rules');
    this.checkboxes.moduleConfig =
      this.rootElement.querySelector('#json-chk-modules');
    this.checkboxes.layoutConfig =
      this.rootElement.querySelector('#json-chk-layout');
    this.checkboxes.userSettings =
      this.rootElement.querySelector('#json-chk-settings');

    this._attachEventListeners(this.rootElement);
  }

  _attachEventListeners(contextElement) {
    const saveFileButton = contextElement.querySelector('#json-btn-save-file');
    const loadFileLabel = contextElement.querySelector(
      '.file-input-button-label'
    );
    const loadFileInput = contextElement.querySelector('#json-btn-load-file');
    const saveLocalStorageButton = contextElement.querySelector(
      '#json-btn-save-localstorage'
    );
    const resetDefaultsButton = contextElement.querySelector(
      '#json-btn-reset-defaults'
    );

    if (saveFileButton) {
      saveFileButton.addEventListener('click', () => this._handleSaveToFile());
    }
    if (loadFileInput) {
      loadFileInput.addEventListener('change', (event) =>
        this._handleLoadFromFile(event)
      );
    }
    if (saveLocalStorageButton) {
      saveLocalStorageButton.addEventListener('click', () =>
        this._handleSaveToLocalStorage()
      );
    }
    if (resetDefaultsButton) {
      resetDefaultsButton.addEventListener('click', () =>
        this._handleResetDefaults()
      );
    }
    // TODO: Add event listeners for delete mode buttons when they are generated
  }

  updateCurrentModeDisplay(modeName) {
    if (this.currentModeDisplay) {
      this.currentModeDisplay.textContent = modeName || 'N/A';
    }
    if (this.modeNameInput) {
      this.modeNameInput.value = modeName || '';
    }
  }

  getSelectedConfigKeys() {
    const selectedKeys = [];
    for (const key in this.checkboxes) {
      if (this.checkboxes[key] && this.checkboxes[key].checked) {
        selectedKeys.push(this.checkboxes[key].dataset.configKey);
      }
    }
    return selectedKeys;
  }

  _downloadJSON(data, filename) {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`[JsonUI] Successfully triggered download for ${filename}`);
    } catch (error) {
      console.error('[JsonUI] Error preparing JSON for download:', error);
      alert('Error preparing data for download. See console for details.');
    }
  }

  _gatherSelectedData() {
    const selectedDataKeys = this.getSelectedConfigKeys();
    const dataToSave = {};

    console.log('[JsonUI] Gathering data for keys:', selectedDataKeys);

    if (selectedDataKeys.includes('rulesConfig')) {
      dataToSave.rulesConfig = window.G_combinedModeData?.rulesConfig;
      console.log(
        '[JsonUI] Included rulesConfig:',
        dataToSave.rulesConfig ? 'Exists' : 'MISSING'
      );
    }
    if (selectedDataKeys.includes('moduleConfig')) {
      dataToSave.moduleConfig = window.G_combinedModeData?.moduleConfig;
      console.log(
        '[JsonUI] Included moduleConfig:',
        dataToSave.moduleConfig ? 'Exists' : 'MISSING'
      );
    }
    if (selectedDataKeys.includes('layoutConfig')) {
      // Save the current live layout state
      if (
        window.goldenLayoutInstance &&
        typeof window.goldenLayoutInstance.toJSON === 'function'
      ) {
        dataToSave.layoutConfig = window.goldenLayoutInstance.toJSON();
        console.log(
          '[JsonUI] Included current layoutConfig from window.goldenLayoutInstance:',
          dataToSave.layoutConfig ? 'Exists' : 'MISSING'
        );
      } else if (
        this.container &&
        this.container.layoutManager &&
        typeof this.container.layoutManager.toJSON === 'function'
      ) {
        // Fallback to container.layoutManager if global is not found (less likely for current setup but good to have a check)
        dataToSave.layoutConfig = this.container.layoutManager.toJSON();
        console.warn(
          '[JsonUI] Used this.container.layoutManager.toJSON() as fallback for layoutConfig:',
          dataToSave.layoutConfig ? 'Exists' : 'MISSING'
        );
      } else {
        // Fallback to loaded preset if live one isn't available
        dataToSave.layoutConfig = window.G_combinedModeData?.layoutConfig;
        console.warn(
          '[JsonUI] Could not get live layout, falling back to preset layoutConfig from G_combinedModeData:',
          dataToSave.layoutConfig ? 'Exists' : 'MISSING'
        );
      }
    }
    if (selectedDataKeys.includes('userSettings')) {
      try {
        // Assuming settingsManager is imported and has a method to get all settings
        dataToSave.userSettings = settingsManager.getSettings(); // User to verify this method
        console.log(
          '[JsonUI] Included userSettings:',
          dataToSave.userSettings ? 'Exists' : 'MISSING'
        );
      } catch (e) {
        console.error('[JsonUI] Failed to get userSettings:', e);
        dataToSave.userSettings = null; // Indicate failure
      }
    }
    // TODO: Add logic for other module-specific data if checkboxes are added for them
    return dataToSave;
  }

  _handleSaveToFile() {
    const modeName = this.modeNameInput.value.trim() || 'default';
    const dataToSave = this._gatherSelectedData();

    if (Object.keys(dataToSave).length === 0) {
      alert('No data types selected to save.');
      return;
    }

    const combinedData = {
      modeName: modeName, // Store the mode name within the file
      savedTimestamp: new Date().toISOString(),
      ...dataToSave,
    };

    console.log(
      `[JsonUI] Save to file. Mode: ${modeName}, Data:`,
      combinedData
    );
    this._downloadJSON(combinedData, `${modeName}_config.json`);
  }

  _handleLoadFromFile(event) {
    const file = event.target.files[0];
    if (!file) {
      console.log('[JsonUI] No file selected for loading.');
      return;
    }
    console.log(`[JsonUI] Load from file selected: ${file.name}`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);
        console.log('[JsonUI] File content parsed successfully:', loadedData);

        const modeName =
          loadedData.modeName || this.modeNameInput.value.trim() || 'default';
        const rulesConfig = loadedData.rulesConfig;
        const moduleConfig = loadedData.moduleConfig;

        if (!rulesConfig || !moduleConfig) {
          alert(
            'Loaded file is missing required rulesConfig or moduleConfig. Cannot apply.'
          );
          console.error(
            '[JsonUI] Loaded file missing rulesConfig or moduleConfig.',
            loadedData
          );
          return;
        }

        if (this.modeNameInput && modeName) {
          this.modeNameInput.value = modeName;
          this.updateCurrentModeDisplay(modeName); // Also update the <span>
        }

        const dataToStore = {
          modeName: modeName,
          savedTimestamp: new Date().toISOString(),
          rulesConfig: rulesConfig,
          moduleConfig: moduleConfig,
          // layoutConfig and userSettings are intentionally omitted as per user request for now
        };

        const G_LOCAL_STORAGE_MODE_PREFIX = 'archipelagoToolSuite_modeData_'; // Match init.js

        try {
          localStorage.setItem(
            `${G_LOCAL_STORAGE_MODE_PREFIX}${modeName}`,
            JSON.stringify(dataToStore)
          );
          localStorage.setItem('archipelagoToolSuite_lastActiveMode', modeName);
          console.log(
            `[JsonUI] Successfully stored mode '${modeName}' data from file to LocalStorage:`,
            dataToStore
          );
          alert(
            `Data for mode '${modeName}' (rules and modules config) loaded from file and saved to LocalStorage. Please RELOAD the page to apply the changes.`
          );
          this._populateKnownModesList(); // Refresh after loading and saving from file
        } catch (storageError) {
          console.error(
            '[JsonUI] Error saving loaded data to LocalStorage:',
            storageError
          );
          alert(
            'Error saving loaded data to LocalStorage. Storage might be full or disabled. See console for details.'
          );
        }
      } catch (error) {
        console.error('[JsonUI] Error parsing JSON from file:', error);
        alert(
          'Failed to parse JSON from file. Ensure it is a valid JSON configuration.'
        );
      }
    };
    reader.onerror = (e) => {
      console.error('[JsonUI] Error reading file:', e);
      alert('Error reading file.');
    };
    reader.readAsText(file);

    // Reset file input to allow loading the same file again
    event.target.value = null;
  }

  _handleSaveToLocalStorage() {
    const modeName = this.modeNameInput.value.trim();
    if (!modeName) {
      alert('Please enter a mode name to save data to LocalStorage.');
      this.modeNameInput.focus();
      return;
    }

    const dataToSave = this._gatherSelectedData();

    if (Object.keys(dataToSave).length === 0) {
      alert('No data types selected to save to LocalStorage.');
      return;
    }

    const combinedData = {
      modeName: modeName, // Ensure modeName is stored IN the object as well
      savedTimestamp: new Date().toISOString(),
      ...dataToSave,
    };

    const G_LOCAL_STORAGE_MODE_PREFIX = 'archipelagoToolSuite_modeData_'; // Match init.js

    try {
      localStorage.setItem(
        `${G_LOCAL_STORAGE_MODE_PREFIX}${modeName}`,
        JSON.stringify(combinedData)
      );
      console.log(
        `[JsonUI] Saved to LocalStorage for mode: ${modeName}, Data:`,
        combinedData
      );

      // Update the UI to reflect the saved mode name
      this.updateCurrentModeDisplay(modeName);

      // Set this mode as the last active mode for the next page load
      localStorage.setItem('archipelagoToolSuite_lastActiveMode', modeName);

      alert(
        `Configuration for mode '${modeName}' saved to LocalStorage. Please RELOAD the page to apply the changes.`
      );
      this._populateKnownModesList(); // Refresh after saving
    } catch (error) {
      console.error('[JsonUI] Error saving to LocalStorage:', error);
      alert(
        'Error saving to LocalStorage. The storage might be full or disabled.'
      );
    }
  }

  _handleResetDefaults() {
    const confirmReset = confirm(
      'Are you sure you want to reset all defaults? This will clear the last active mode and any saved settings for the "default" mode from LocalStorage. The application will reload using hardcoded defaults.'
    );

    if (confirmReset) {
      try {
        localStorage.removeItem('archipelagoToolSuite_lastActiveMode');
        localStorage.removeItem('archipelagoToolSuite_modeData_default');
        console.log(
          '[JsonUI] Defaults reset: Cleared last active mode and "default" mode data from LocalStorage.'
        );
        alert(
          'Defaults have been reset. Please RELOAD the page to apply hardcoded default configurations.'
        );
        // Optionally, update UI to reflect this reset if not reloading immediately
        this.updateCurrentModeDisplay('default');
        // Consider also clearing known modes list or refreshing it
      } catch (error) {
        console.error(
          '[JsonUI] Error resetting defaults in LocalStorage:',
          error
        );
        alert('Error resetting defaults. See console for details.');
      }
    }
  }

  _destroy() {
    console.log('[JsonUI] Destroying JSON panel UI and listeners.');
    // Remove event listeners if any were attached directly to document or eventBus without specific handles
    // For listeners attached to elements within this.rootElement, they will be garbage collected with the element.
  }

  _populateKnownModesList() {
    if (!this.knownModesList) return;

    const knownModes = [];
    const prefix = 'archipelagoToolSuite_modeData_'; // Must match G_LOCAL_STORAGE_MODE_PREFIX in init.js

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          knownModes.push(key.substring(prefix.length));
        }
      }
    } catch (e) {
      console.error(
        '[JsonUI] Error accessing localStorage to get known modes:',
        e
      );
      // Display error in the list itself or just log
      this.knownModesList.innerHTML =
        '<li><span style="color: red;">Error fetching modes.</span></li>';
      return;
    }

    // Clear existing list items
    this.knownModesList.innerHTML = '';

    if (knownModes.length === 0) {
      this.knownModesList.innerHTML =
        '<li><span>No modes found in LocalStorage.</span></li>';
    } else {
      knownModes.sort(); // Sort alphabetically for consistent display
      knownModes.forEach((modeName) => {
        const listItem = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = modeName;
        listItem.appendChild(nameSpan);

        // TODO: Add Load button
        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load';
        loadButton.classList.add('button', 'button-small'); // Add appropriate classes
        loadButton.style.marginLeft = '10px';
        loadButton.onclick = () => this._handleLoadModeFromList(modeName);
        listItem.appendChild(loadButton);

        // TODO: Add Delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('button', 'button-danger', 'button-small');
        deleteButton.style.marginLeft = '5px';
        deleteButton.onclick = () => this._handleDeleteModeFromList(modeName);
        listItem.appendChild(deleteButton);

        this.knownModesList.appendChild(listItem);
      });
    }
  }

  _handleLoadModeFromList(modeName) {
    if (!modeName) return;

    console.log(
      `[JsonUI] Setting "${modeName}" as next active mode from list.`
    );
    this.updateCurrentModeDisplay(modeName); // Updates input and span

    try {
      localStorage.setItem('archipelagoToolSuite_lastActiveMode', modeName);
      alert(
        `Mode "${modeName}" has been set as the active mode. Please RELOAD the page to apply this mode.`
      );
    } catch (error) {
      console.error(
        '[JsonUI] Error setting last active mode from list:',
        error
      );
      alert('Error setting active mode. See console for details.');
    }
  }

  _handleDeleteModeFromList(modeName) {
    if (!modeName) return;

    const confirmDelete = confirm(
      `Are you sure you want to delete all saved data for mode "${modeName}" from LocalStorage? This action cannot be undone.`
    );

    if (confirmDelete) {
      const modeDataKey = `archipelagoToolSuite_modeData_${modeName}`;
      const lastActiveModeKey = 'archipelagoToolSuite_lastActiveMode';
      try {
        localStorage.removeItem(modeDataKey);
        console.log(
          `[JsonUI] Deleted mode data for "${modeName}" from LocalStorage (Key: ${modeDataKey}).`
        );

        const currentLastActive = localStorage.getItem(lastActiveModeKey);
        if (currentLastActive === modeName) {
          localStorage.removeItem(lastActiveModeKey);
          console.log(
            `[JsonUI] Cleared last active mode because it was the deleted mode "${modeName}".`
          );
        }

        alert(`Mode "${modeName}" has been deleted from LocalStorage.`);
        this._populateKnownModesList(); // Refresh the list
      } catch (error) {
        console.error(
          `[JsonUI] Error deleting mode "${modeName}" from LocalStorage:`,
          error
        );
        alert(`Error deleting mode "${modeName}". See console for details.`);
      }
    }
  }

  _populateModesJsonList(modesConfig) {
    if (!this.modesJsonList) return;

    this.modesJsonList.innerHTML = ''; // Clear existing items

    if (!modesConfig || Object.keys(modesConfig).length === 0) {
      this.modesJsonList.innerHTML =
        '<li><span>No modes defined in modes.json.</span></li>';
      return;
    }

    const modeNames = Object.keys(modesConfig).sort();

    modeNames.forEach((modeName) => {
      const listItem = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = modeName;
      listItem.appendChild(nameSpan);

      const loadButton = document.createElement('button');
      loadButton.textContent = 'Load';
      loadButton.classList.add('button', 'button-small');
      loadButton.style.marginLeft = '10px';
      loadButton.onclick = () => this._handleLoadModeFromModesJson(modeName);
      listItem.appendChild(loadButton);

      this.modesJsonList.appendChild(listItem);
    });
  }

  _handleLoadModeFromModesJson(modeName) {
    if (!modeName) return;
    console.log(
      `[JsonUI] Attempting to load mode "${modeName}" from modes.json by reloading with URL parameter.`
    );
    // Show a confirmation before reloading
    const confirmLoad = confirm(
      `This will reload the application to activate mode "${modeName}" using its definition in modes.json. Any unsaved changes in the current session might be lost. Continue?`
    );
    if (confirmLoad) {
      const newUrl = `${window.location.pathname}?mode=${encodeURIComponent(
        modeName
      )}`;
      window.location.href = newUrl;
    }
  }
}
