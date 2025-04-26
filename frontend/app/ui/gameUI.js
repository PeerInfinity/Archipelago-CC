// gameUI.js - Updated to work directly with console client
// NOTE: Most functionality has been moved to individual modules or init.js

// Keep necessary imports if any methods remain, otherwise remove them.
// import { stateManager } from '../../modules/stateManager/index.js';
// import { LocationUI } from '../../modules/locations/locationUI.js';
// import { ExitUI } from '../../modules/exits/exitUI.js';
// import { RegionUI } from '../../modules/regions/regionUI.js';
// import { InventoryUI } from '../../modules/inventory/inventoryUI.js';
// import { LoopUI } from '../../modules/loops/loopUI.js';
// import eventBus from '../core/eventBus.js';

export class GameUI {
  constructor() {
    console.warn(
      '[GameUI] Constructor called. This class should ideally be empty or removed after refactoring.'
    );
    // All instance creation and event subscriptions should be moved to modules.

    // Removed UI Managers
    // Removed stateManager callback registration
    // Removed eventBus subscriptions
    // Removed Game state properties

    // Initialize tracking set for user clicked items - Does this belong here?
    // Consider if this state should live elsewhere (e.g., specific module or global state)
    window._userClickedItems = new Set();

    // Removed initializeUI calls
    // Removed attachEventListeners call
    // Removed loadDefaultRules call
  }

  // REMOVED: initializeUI
  /*
  initializeUI(jsonData, selectedPlayerId) { ... }
  */

  // REMOVED: attachEventListeners
  /*
  attachEventListeners() { ... }
  */

  // REMOVED: clearExistingData
  /*
  clearExistingData() { ... }
  */

  // REMOVED: loadDefaultRules

  // REMOVED: _enableControlButtons

  // REMOVED: registerConsoleCommands
  /*
  registerConsoleCommands() { ... }
  */

  // REMOVED: initializeMainContentElements
  /*
  initializeMainContentElements(containerElement) { ... }
  */

  // REMOVED: handleLoopModeChange
  /*
  handleLoopModeChange(isActive) { ... }
  */

  // Add any remaining essential methods here, though ideally none.
}
