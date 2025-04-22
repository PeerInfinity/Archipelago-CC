// init.js - Initialization script for the modular frontend

// Core Singletons/Managers
import panelManagerInstance from './app/core/panelManagerSingleton.js';
import eventBus from './app/core/eventBus.js';
import settingsManager from './app/core/settingsManager.js';
import centralRegistry from './app/core/centralRegistry.js';
import EventDispatcher from './app/core/eventDispatcher.js';

// GoldenLayout (assuming it's loaded globally via script tag)
// declare const goldenLayout: any; // Removed TypeScript declaration

// --- Helper Functions ---

async function fetchJson(url, errorMessage) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`${errorMessage}: ${url}`, error);
    return null; // Return null to indicate failure
  }
}

function getDefaultLayoutConfig() {
  // Define a fallback default layout configuration
  console.warn('Using hardcoded default layout configuration.');
  return {
    settings: {
      showPopoutIcon: false,
    },
    root: {
      type: 'row',
      content: [
        {
          type: 'stack', // Combine into one stack for default
          width: 100,
          content: [
            {
              type: 'component',
              componentType: 'clientPanel', // Placeholder - adjust as modules register
              title: 'Client',
            },
            {
              type: 'component',
              componentType: 'stateManagerPanel', // Placeholder
              title: 'State',
            },
            {
              type: 'component',
              componentType: 'optionsPanel', // Placeholder
              title: 'Options',
            },
          ],
        },
      ],
    },
  };
}

// --- Main Initialization Logic ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Init] Initializing modular application...');

  // Make core instances globally available for debugging (optional)
  window.settingsManager = settingsManager;
  window.eventBus = eventBus;
  window.panelManager = panelManagerInstance;
  window.centralRegistry = centralRegistry; // Expose registry for debug

  let modulesData = null;
  let layoutPresets = {};
  const importedModules = new Map(); // Map<moduleId, moduleObject>
  let dispatcher = null;

  try {
    // --- 1. Load Configuration Files ---
    console.log('[Init] Loading configuration...');
    modulesData = await fetchJson(
      '/frontend/modules.json',
      'Failed to load modules configuration'
    );
    if (
      !modulesData ||
      !modulesData.moduleDefinitions ||
      !modulesData.loadPriority
    ) {
      throw new Error('modules.json is missing, malformed, or empty.');
    }

    // Settings are loaded asynchronously by the manager itself
    await settingsManager.ensureLoaded();
    console.log('[Init] Settings loaded via settingsManager.');

    // Load layout presets (optional)
    layoutPresets =
      (await fetchJson(
        '/frontend/layout_presets.json',
        'Failed to load layout presets (optional)'
      )) || {};

    // --- 2. Import All Defined Modules ---
    console.log('[Init] Importing defined modules...');
    const importPromises = Object.entries(modulesData.moduleDefinitions).map(
      async ([id, definition]) => {
        try {
          const module = await import(definition.path);
          importedModules.set(id, module);
          console.log(`[Init] Successfully imported module: ${id}`);
        } catch (error) {
          console.error(
            `[Init] Failed to import module: ${id} from ${definition.path}`,
            error
          );
          // Decide how to handle failed imports - skip registration/initialization?
          // For now, we just log the error. The module won't be in importedModules.
        }
      }
    );
    await Promise.all(importPromises);
    console.log(
      `[Init] Finished importing modules. ${importedModules.size} loaded.`
    );

    // --- 3. Instantiate Event Dispatcher ---
    dispatcher = new EventDispatcher(centralRegistry, modulesData);
    window.dispatcher = dispatcher; // Expose for debugging
    console.log('[Init] EventDispatcher instantiated.');

    // --- 4. Registration Phase ---
    console.log('[Init] Starting module registration phase...');
    for (const [moduleId, module] of importedModules.entries()) {
      if (typeof module.register === 'function') {
        // Create the registration API specific to this module
        const registrationApi = {
          registerPanelComponent: (componentType, componentFactory) => {
            centralRegistry.registerPanelComponent(
              moduleId,
              componentType,
              componentFactory
            );
          },
          registerEventHandler: (eventName, handlerFunction) => {
            centralRegistry.registerEventHandler(
              moduleId,
              eventName,
              handlerFunction.bind(module)
            ); // Ensure correct 'this' if needed
          },
          registerSettingsSchema: (schemaSnippet) => {
            centralRegistry.registerSettingsSchema(moduleId, schemaSnippet);
          },
          registerPublicFunction: (functionName, functionRef) => {
            centralRegistry.registerPublicFunction(
              moduleId,
              functionName,
              functionRef
            );
          },
        };
        try {
          console.log(`[Init] Registering module: ${moduleId}`);
          module.register(registrationApi);
        } catch (error) {
          console.error(
            `[Init] Error during registration of module: ${moduleId}`,
            error
          );
        }
      }
    }
    console.log('[Init] Module registration phase complete.');
    console.log('[Registry Snapshot]', {
      panels: Array.from(centralRegistry.panelComponents.keys()),
      events: Array.from(centralRegistry.eventHandlers.keys()),
      schemas: Array.from(centralRegistry.settingsSchemas.keys()),
      functions: Array.from(centralRegistry.publicFunctions.keys()),
    });

    // --- 5. Initialization Phase ---
    console.log(
      '[Init] Starting module initialization phase (in priority order)...'
    );
    const { loadPriority } = modulesData;
    for (let i = 0; i < loadPriority.length; i++) {
      const moduleId = loadPriority[i];
      const definition = modulesData.moduleDefinitions[moduleId];
      const moduleInstance = importedModules.get(moduleId);

      if (
        definition?.enabled &&
        moduleInstance &&
        typeof moduleInstance.initialize === 'function'
      ) {
        // Create the initialization API for this module
        const initializationApi = {
          getSettings: async () => settingsManager.getModuleSettings(moduleId),
          getDispatcher: () => ({
            publish: dispatcher.publish.bind(dispatcher),
            publishToPredecessors:
              dispatcher.publishToPredecessors.bind(dispatcher),
          }),
          getEventBus: () => eventBus, // Provide direct access to eventBus for non-priority events
          getModuleFunction: (targetModuleId, functionName) => {
            return centralRegistry.getPublicFunction(
              targetModuleId,
              functionName
            );
          },
          // getSingleton: (name) => { /* Decide how to provide singletons */ },
        };

        try {
          console.log(
            `[Init] Initializing module: ${moduleId} (Priority ${i})`
          );
          // Module initialization can be async if needed
          await moduleInstance.initialize(moduleId, i, initializationApi);
        } catch (error) {
          console.error(
            `[Init] Error during initialization of module: ${moduleId}`,
            error
          );
        }
      } else if (definition?.enabled && !moduleInstance) {
        console.warn(
          `[Init] Module ${moduleId} is enabled but failed to import. Skipping initialization.`
        );
      } else if (
        definition?.enabled &&
        moduleInstance &&
        typeof moduleInstance.initialize !== 'function'
      ) {
        console.log(
          `[Init] Enabled module ${moduleId} has no initialize function. Skipping.`
        );
      }
    }
    console.log('[Init] Module initialization phase complete.');

    // --- 6. Golden Layout Setup ---
    console.log('[Init] Setting up Golden Layout...');
    const containerElement = document.getElementById('goldenlayout-container');
    if (!containerElement) {
      throw new Error('[Init] Golden Layout container element not found!');
    }

    // Check if GoldenLayout global exists
    if (typeof goldenLayout === 'undefined' || !goldenLayout?.GoldenLayout) {
      throw new Error(
        '[Init] GoldenLayout script not loaded or GoldenLayout class not found on window.'
      );
    }

    // Instantiate Golden Layout - V2 Style
    const layout = new goldenLayout.GoldenLayout(containerElement);
    window.goldenLayoutInstance = layout; // Make global for debugging
    console.log('[Init] Golden Layout instance created.');

    // Initialize PanelManager with the layout instance
    panelManagerInstance.initialize(layout);
    console.log('[Init] PanelManager initialized.');

    // Register components discovered during module registration
    if (centralRegistry.panelComponents.size === 0) {
      console.warn('[Init] No panel components were registered by any module!');
    }
    for (const [
      componentType,
      factory,
    ] of centralRegistry.panelComponents.entries()) {
      console.log(
        `[Init] Registering panel component '${componentType}' with Golden Layout.`
      );
      panelManagerInstance.registerPanelComponent(componentType, factory);
    }

    // Determine the layout configuration to load
    let chosenLayoutConfig = null;
    const activeLayoutId = await settingsManager.getActiveLayoutIdentifier();

    if (activeLayoutId === null) {
      console.log('[Init] Active layout is custom.');
      chosenLayoutConfig = await settingsManager.getCustomLayoutConfig();
    } else if (
      typeof activeLayoutId === 'string' &&
      layoutPresets[activeLayoutId]
    ) {
      console.log(`[Init] Active layout is preset: ${activeLayoutId}`);
      chosenLayoutConfig = layoutPresets[activeLayoutId];
    } else {
      console.log(
        `[Init] Active layout '${activeLayoutId}' not found or invalid, using default.`
      );
      // Fallback to custom config if available, otherwise use hardcoded default
      chosenLayoutConfig =
        (await settingsManager.getCustomLayoutConfig()) ||
        getDefaultLayoutConfig();
      if (!(await settingsManager.getCustomLayoutConfig())) {
        console.log('[Init] No custom layout found, using hardcoded default.');
      }
    }

    // If after all checks, we still don't have a config, use the hardcoded default
    if (!chosenLayoutConfig) {
      console.warn(
        '[Init] No valid layout configuration determined, falling back to hardcoded default.'
      );
      chosenLayoutConfig = getDefaultLayoutConfig();
    }

    // Load the chosen layout
    console.log('[Init] Loading layout configuration into Golden Layout...');
    layout.loadLayout(chosenLayoutConfig);
    console.log('[Init] Golden Layout configuration loaded.');

    console.log('[Init] Application initialization sequence complete.');
  } catch (error) {
    console.error('--- FATAL INITIALIZATION ERROR ---', error);
    // Display a user-friendly error message on the page?
    const errorElement = document.getElementById('init-error-message');
    if (errorElement) {
      errorElement.textContent = `Application failed to initialize: ${error.message}. Check console for details.`;
      errorElement.style.display = 'block';
    }
    // Hide loading indicator if it exists
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
});
