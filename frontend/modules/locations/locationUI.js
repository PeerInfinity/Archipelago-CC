// locationUI.js
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { evaluateRule } from '../stateManager/ruleEngine.js';
import commonUI, { debounce } from '../commonUI/index.js';
import messageHandler from '../client/core/messageHandler.js';
import loopStateSingleton from '../loops/loopStateSingleton.js';
import settingsManager from '../../app/core/settingsManager.js';
import eventBus from '../../app/core/eventBus.js';

export class LocationUI {
  constructor(gameUI) {
    this.gameUI = gameUI;
    this.columns = 2; // Default number of columns
    this.rootElement = this.createRootElement(); // Create the root element on instantiation
    this.locationsGrid = this.rootElement.querySelector('#locations-grid'); // Cache grid element
    this.stateUnsubscribeHandles = []; // Array to store unsubscribe functions for state/loop events
    this.settingsUnsubscribe = null;
    // Attach control listeners immediately
    this.attachEventListeners();
    // Subscribe to settings and state events
    this.subscribeToSettings();
    this.subscribeToStateEvents(); // <-- Call new subscription method
  }

  subscribeToSettings() {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }
    this.settingsUnsubscribe = eventBus.subscribe(
      'settings:changed',
      ({ key, value }) => {
        if (key === '*' || key.startsWith('colorblindMode.locations')) {
          console.log('LocationUI reacting to settings change:', key);
          this.updateLocationDisplay();
        }
      }
    );
  }

  onPanelDestroy() {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }
    this.unsubscribeFromStateEvents(); // <-- Call new unsubscribe method
  }

  dispose() {
    this.onPanelDestroy();
  }

  // --- NEW: Event Subscription for State/Loop --- //
  subscribeToStateEvents() {
    try {
      // Ensure no duplicate subscriptions
      this.unsubscribeFromStateEvents();

      console.log('[LocationUI] Subscribing to state and loop events...');
      // Use the imported eventBus singleton directly
      // REMOVED: const eventBus = window.eventBus;

      if (!eventBus) {
        // Check the imported eventBus
        console.error('[LocationUI] Imported EventBus is not available!');
        return;
      }

      const subscribe = (eventName, handler) => {
        console.log(`[LocationUI] Subscribing to ${eventName}`);
        const unsubscribe = eventBus.subscribe(eventName, handler);
        this.stateUnsubscribeHandles.push(unsubscribe);
      };

      // Debounce handler to avoid rapid updates
      const debouncedUpdate = debounce(() => this.updateLocationDisplay(), 50);

      // Subscribe to state changes that affect location display
      subscribe('stateManager:snapshotUpdated', debouncedUpdate);
      subscribe('stateManager:inventoryChanged', debouncedUpdate);
      subscribe('stateManager:regionsComputed', debouncedUpdate);
      subscribe('stateManager:locationChecked', debouncedUpdate);
      subscribe('stateManager:checkedLocationsCleared', debouncedUpdate);
      // Also need rules loaded to trigger initial display
      subscribe('stateManager:rulesLoaded', () => {
        console.log('[LocationUI] Received stateManager:rulesLoaded event.');
        // No need to call update directly, snapshotUpdated will follow
        // debouncedUpdate();
      });

      // Subscribe to loop state changes if relevant
      subscribe('loop:stateChanged', debouncedUpdate);
      subscribe('loop:actionCompleted', debouncedUpdate);
      subscribe('loop:discoveryChanged', debouncedUpdate);
      subscribe('loop:modeChanged', (isLoopMode) => {
        debouncedUpdate(); // Update display based on mode change
        // Show/hide loop-specific controls
        const exploredCheckbox =
          this.rootElement?.querySelector('#show-explored');
        if (exploredCheckbox && exploredCheckbox.parentElement) {
          exploredCheckbox.parentElement.style.display = isLoopMode
            ? 'inline-block'
            : 'none';
        }
      });
    } catch (error) {
      console.error('[LocationUI] Error during subscribeToStateEvents:', error);
    }
  }

  unsubscribeFromStateEvents() {
    if (this.stateUnsubscribeHandles.length > 0) {
      console.log('[LocationUI] Unsubscribing from state and loop events...');
      this.stateUnsubscribeHandles.forEach((unsubscribe) => unsubscribe());
      this.stateUnsubscribeHandles = [];
    }
  }
  // --- END NEW --- //

  // Creates the main DOM structure for the locations panel
  createRootElement() {
    const element = document.createElement('div');
    element.classList.add('locations-panel-container', 'panel-container'); // Add classes for styling
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.height = '100%';
    element.style.overflow = 'hidden';

    // Recreate controls similar to index.html
    element.innerHTML = `
      <div class="control-group location-controls" style="padding: 0.5rem; border-bottom: 1px solid #666; flex-shrink: 0;">
        <select id="sort-select">
          <option value="original">Original Order</option>
          <option value="accessibility">Sort by Accessibility</option>
        </select>
        <label>
          <input type="checkbox" id="show-checked" checked />
          Show Checked
        </label>
        <label>
          <input type="checkbox" id="show-reachable" checked />
          Show Reachable
        </label>
        <label>
          <input type="checkbox" id="show-unreachable" checked />
          Show Unreachable
        </label>
        <label style="display: none"> <!-- Initially hidden, controlled by loop mode -->
          <input type="checkbox" id="show-explored" checked />
          Show Explored
        </label>
        <button id="decrease-columns">-</button>
        <button id="increase-columns">+</button>
      </div>
      <div id="locations-grid" style="flex-grow: 1; overflow-y: auto;">
        <!-- Populated by updateLocationDisplay -->
      </div>
    `;
    return element;
  }

  getRootElement() {
    return this.rootElement;
  }

  async initialize() {
    // Subscriptions are now handled in constructor
    // We still need the initial update call, triggered after ensuring proxy is ready
    console.log('[LocationUI] Initializing panel...');
    try {
      await stateManager.ensureReady(); // Wait for proxy
      console.log(
        '[LocationUI] Proxy ready. Initial display will occur via snapshotUpdated event.'
      );
    } catch (error) {
      console.error(
        '[LocationUI] Error waiting for proxy during initialization:',
        error
      );
      // Display an error state in the UI?
      if (this.locationsGrid) {
        this.locationsGrid.innerHTML =
          '<div class="error-message">Error initializing location data.</div>';
      }
    }
  }

  clear() {
    const locationsGrid = document.getElementById('locations-grid');
    if (locationsGrid) {
      locationsGrid.innerHTML = '';
    }
  }

  update() {
    this.updateLocationDisplay();
  }

  attachEventListeners() {
    // Attach listeners to controls within this.rootElement
    [
      'sort-select',
      'show-checked',
      'show-reachable',
      'show-unreachable',
      'show-explored',
    ].forEach((id) => {
      this.rootElement
        .querySelector(`#${id}`)
        ?.addEventListener('change', () => this.updateLocationDisplay());
    });

    // Modal listeners remain on document for now, might need adjustment
    document.getElementById('modal-close')?.addEventListener('click', () => {
      document.getElementById('location-modal').classList.add('hidden');
    });

    document
      .getElementById('location-modal')
      ?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('location-modal')) {
          document.getElementById('location-modal').classList.add('hidden');
        }
      });

    // Click listener is now on the specific grid within this panel
    this.locationsGrid?.addEventListener('click', (e) => {
      // Only handle clicks that aren't on other clickable elements like links
      if (
        e.target.closest('.region-link') ||
        e.target.closest('.location-link')
      ) {
        return;
      }

      const locationCard = e.target.closest('.location-card');
      if (locationCard) {
        try {
          const encoded = locationCard.dataset.location.replace(/&quot;/g, '"');
          const locationData = JSON.parse(decodeURIComponent(encoded));
          this.handleLocationClick(locationData);
        } catch (error) {
          console.error('Error parsing location data:', error);
        }
      }
    });

    // Column adjustment buttons within this.rootElement
    this.rootElement
      .querySelector('#increase-columns')
      ?.addEventListener('click', () => this.changeColumns(1));
    this.rootElement
      .querySelector('#decrease-columns')
      ?.addEventListener('click', () => this.changeColumns(-1));
  }

  changeColumns(delta) {
    this.columns = Math.max(1, this.columns + delta); // Ensure at least 1 column
    this.updateLocationDisplay();
  }

  handleLocationClick(location) {
    // Log the click event
    console.log('Location clicked:', location);

    // Check if loop mode is active
    const isLoopModeActive = loopStateSingleton.isLoopModeActive;

    if (isLoopModeActive) {
      // LOOP MODE BEHAVIOR

      // If location is already checked, do nothing
      if (stateManager.isLocationChecked(location.name)) return;

      // Get the location's discovered status in loop mode
      const isUndiscovered = !loopStateSingleton.isLocationDiscovered(
        location.name
      );

      // Check if the last action in the queue is already handling this location
      if (loopStateSingleton.actionQueue.length > 0) {
        const lastAction =
          loopStateSingleton.actionQueue[
            loopStateSingleton.actionQueue.length - 1
          ];

        // If the location is undiscovered and the last action is an explore for this region, do nothing
        if (
          isUndiscovered &&
          lastAction.type === 'explore' &&
          lastAction.regionName === location.region
        ) {
          return;
        }

        // If the location is discovered but unchecked and the last action is to check this location, do nothing
        if (
          !isUndiscovered &&
          !stateManager.isLocationChecked(location.name) &&
          lastAction.type === 'checkLocation' &&
          lastAction.locationName === location.name
        ) {
          return;
        }
      }

      // Import the path analyzer logic
      import('../logic/pathAnalyzerLogic.js').then((module) => {
        const pathAnalyzerLogic = new module.PathAnalyzerLogic();

        // Find path from Menu to the region containing this location
        const path = pathAnalyzerLogic.findPathInLoopMode(location.region);

        if (path) {
          // Path found - process it

          // Pause processing the action queue
          loopStateSingleton.setPaused(true);

          // Clear the current queue
          loopStateSingleton.actionQueue = [];
          loopStateSingleton.currentAction = null;
          loopStateSingleton.currentActionIndex = 0;

          // Queue move actions for each region transition
          for (let i = 0; i < path.length - 1; i++) {
            const fromRegion = path[i];
            const toRegion = path[i + 1];

            // Find the exit that connects these regions
            const regionData = stateManager.regions[fromRegion];
            const exitToUse = regionData?.exits?.find(
              (exit) => exit.connected_region === toRegion
            );

            if (exitToUse) {
              // Create and queue a move action
              const moveAction = {
                id: `action_${Date.now()}_${
                  Math.floor(Math.random() * 10000) + i
                }`,
                type: 'moveToRegion',
                regionName: fromRegion,
                exitName: exitToUse.name,
                destinationRegion: toRegion,
                progress: 0,
                completed: false,
              };

              loopStateSingleton.actionQueue.push(moveAction);

              // Make sure the loopUI knows these regions are in the queue
              if (loopStateSingleton) {
                loopStateSingleton.regionsInQueue.add(fromRegion);
                loopStateSingleton.regionsInQueue.add(toRegion);
              }

              // Also, mark the source region to repeat explore
              // This ensures the player doesn't get stuck if the only way forward was through the region just moved from.
              if (loopStateSingleton) {
                loopStateSingleton.setRepeatExplore(fromRegion, true);
              }
            }
          }

          // Add the appropriate action at the final region
          if (isUndiscovered) {
            // If location is undiscovered, queue an explore action
            const exploreAction = {
              id: `action_${Date.now()}_${
                Math.floor(Math.random() * 10000) + path.length
              }`,
              type: 'explore',
              regionName: location.region,
              progress: 0,
              completed: false,
            };

            loopStateSingleton.actionQueue.push(exploreAction);

            // Set the region's "repeat explore action" checkbox to checked
            if (loopStateSingleton && loopStateSingleton.repeatExploreStates) {
              loopStateSingleton.repeatExploreStates.set(location.region, true);
            }
          } else {
            // If location is discovered but unchecked, queue a check location action
            const checkAction = {
              id: `action_${Date.now()}_${
                Math.floor(Math.random() * 10000) + path.length
              }`,
              type: 'checkLocation',
              regionName: location.region,
              locationName: location.name,
              progress: 0,
              completed: false,
            };

            loopStateSingleton.actionQueue.push(checkAction);
          }

          // Begin processing the action queue
          loopStateSingleton.setPaused(false);
          loopStateSingleton.startProcessing();

          // Notify UI components about queue changes
          if (window.eventBus) {
            window.eventBus.publish('loopState:queueUpdated', {
              queue: loopStateSingleton.actionQueue,
            });
          }

          // Update the loop UI
          if (loopStateSingleton) {
            loopStateSingleton.renderLoopPanel();
          }
        } else {
          // Path not found - display error message
          const errorMessage = `Cannot find a path to ${location.region} in loop mode.`;
          console.error(errorMessage);

          // Show error in console or alert
          if (window.consoleManager) {
            window.consoleManager.print(errorMessage, 'error');
          } else {
            alert(errorMessage);
          }
        }
      });

      return;
    }

    // STANDARD NON-LOOP MODE BEHAVIOR

    // If location is already checked, do nothing
    if (stateManager.isLocationChecked(location.name)) return;
    const isAccessible = stateManager.isLocationAccessible(location);
    if (!isAccessible) return;

    // ALWAYS route the check through messageHandler, which handles local/networked logic
    console.log(
      `[LocationUI] Routing check for ${location.name} (ID: ${location.id}) through MessageHandler`
    );
    // Use the globally accessible messageHandler instance if window.messageHandler exists, otherwise fallback
    const handler = window.messageHandler || messageHandler; // Assuming messageHandler is exported/available
    handler
      .checkLocation(location)
      .then((success) => {
        if (success) {
          // Logic inside .then() is optional now, as stateManager notifications handle UI updates.
          // You might still want to show the modal details here if desired.
          // console.log(`[LocationUI] MessageHandler successfully processed check for ${location.name}`);
          // this.showLocationDetails(location); // Optional: Show details modal on success
        } else {
          console.warn(
            `[LocationUI] MessageHandler reported failure checking location ${location.name}`
          );
          // Optional: Display an error message to the user if needed
        }
      })
      .catch((error) => {
        console.error(
          `[LocationUI] Error calling messageHandler.checkLocation:`,
          error
        );
        // Optional: Display an error message to the user
      });
  }

  syncWithState() {
    this.updateLocationDisplay();
  }

  updateLocationDisplay() {
    console.log('[LocationUI] updateLocationDisplay called.');
    if (!this.locationsGrid) {
      console.warn('[LocationUI] locationsGrid element not found.');
      return;
    }

    // Get current snapshot - it SHOULD be ready if this is called after initialize or via event
    let snapshot;
    try {
      snapshot = stateManager.getSnapshot();
    } catch (e) {
      console.error('[LocationUI] Error getting snapshot:', e);
      this.locationsGrid.innerHTML =
        '<div class="error-message">Error retrieving location data.</div>';
      return;
    }

    if (!snapshot || !snapshot.locations) {
      console.log('[LocationUI] Snapshot not ready or no locations found.');
      this.locationsGrid.innerHTML =
        '<div class="loading-message">Loading location data...</div>';
      return;
    }

    // --- Get Filter/Sort Options --- //
    const sortBy =
      this.rootElement.querySelector('#sort-select')?.value || 'original';
    const showChecked =
      this.rootElement.querySelector('#show-checked')?.checked ?? true;
    const showReachable =
      this.rootElement.querySelector('#show-reachable')?.checked ?? true;
    const showUnreachable =
      this.rootElement.querySelector('#show-unreachable')?.checked ?? true;
    const showExplored =
      this.rootElement.querySelector('#show-explored')?.checked ?? true;
    const isLoopModeActive = loopStateSingleton.isLoopModeActive ?? false;

    // --- Get Data From Snapshot --- //
    // Use Object.values if locations is an object, or assume it's an array
    const allLocations = Array.isArray(snapshot.locations)
      ? snapshot.locations
      : Object.values(snapshot.locations);
    const checkedLocationsSet =
      snapshot.checkedLocations instanceof Set
        ? snapshot.checkedLocations
        : new Set(snapshot.checkedLocations || []);
    const reachableRegionsSet =
      snapshot.reachableRegions instanceof Set
        ? snapshot.reachableRegions
        : new Set(snapshot.reachableRegions || []);
    const discoveredLocations =
      loopStateSingleton.discoveredLocations || new Set(); // Get from loopState
    const discoveredRegions = loopStateSingleton.discoveredRegions || new Set(); // Get from loopState
    // Colorblind settings
    const useColorblind = settingsManager.getSetting(
      'colorblindMode.locations',
      true
    );

    // --- Process Locations --- //
    console.log(
      `[LocationUI] Processing ${allLocations.length} locations from snapshot.`
    );
    let filteredLocations = allLocations.map((loc) => {
      const isChecked = checkedLocationsSet.has(loc.name);
      // Ensure loc.region exists and is a string
      const regionName = typeof loc.region === 'string' ? loc.region : '';
      const isReachable =
        reachableRegionsSet.has(regionName) && loc.isAccessible !== false; // Consider direct accessibility flag if present
      const isExplored =
        discoveredRegions.has(regionName) && discoveredLocations.has(loc.name);
      return { ...loc, isChecked, isReachable, isExplored }; // Add derived properties
    });

    // Filter based on checkboxes
    filteredLocations = filteredLocations.filter((loc) => {
      if (!showChecked && loc.isChecked) return false;
      if (!showReachable && loc.isReachable && !loc.isChecked) return false; // Hide reachable only if unchecked
      if (!showUnreachable && !loc.isReachable && !loc.isChecked) return false; // Hide unreachable only if unchecked
      if (isLoopModeActive && !showExplored && !loc.isExplored) return false;
      return true;
    });

    // Sort based on selection
    if (sortBy === 'accessibility') {
      filteredLocations.sort((a, b) => {
        // Checked < Reachable < Unreachable
        if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
        if (a.isReachable !== b.isReachable) return a.isReachable ? -1 : 1;
        return a.name.localeCompare(b.name); // Fallback sort by name
      });
    } else {
      // Default: original (often ID-based) or alphabetical if no original order
      // Assuming original order is inherent or use alphabetical
      filteredLocations.sort((a, b) => a.name.localeCompare(b.name));
    }

    // --- Render Grid --- //
    this.locationsGrid.innerHTML = ''; // Clear previous content
    this.locationsGrid.style.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;

    if (filteredLocations.length === 0) {
      this.locationsGrid.innerHTML =
        '<div class="no-locations-message">No locations match filters.</div>';
      return;
    }

    filteredLocations.forEach((location) => {
      const locationElement = document.createElement('div');
      locationElement.classList.add('location');
      locationElement.dataset.locationName = location.name; // Store name for click handler

      let statusClass = location.isChecked
        ? 'checked'
        : location.isReachable
        ? 'reachable'
        : 'unreachable';
      locationElement.classList.add(statusClass);
      if (isLoopModeActive && location.isExplored) {
        locationElement.classList.add('explored');
      }

      // Colorblind indicator text
      let cbIndicator = '';
      if (useColorblind) {
        if (location.isChecked) cbIndicator = ' [C]';
        else if (location.isReachable) cbIndicator = ' [R]';
        else cbIndicator = ' [U]';
      }

      locationElement.textContent = location.name + cbIndicator;
      locationElement.title = `Region: ${
        location.region || 'Unknown'
      } - ${statusClass.toUpperCase()}`;

      // Attach click listener for details/checking
      locationElement.addEventListener('click', () =>
        this.handleLocationClick(location)
      );

      this.locationsGrid.appendChild(locationElement);
    });
    console.log(`[LocationUI] Rendered ${filteredLocations.length} locations.`);
  }

  showLocationDetails(location) {
    const modal = document.getElementById('location-modal');
    const title = document.getElementById('modal-title');
    const debug = document.getElementById('modal-debug');
    const info = document.getElementById('modal-info');

    const instance = stateManager.instance;
    if (!instance) {
      console.error(
        '[LocationUI] StateManager instance not found in showLocationDetails'
      );
      return;
    }

    title.textContent = location.name;

    const region = instance.regions[location.region];

    if (this.gameUI.debugMode) {
      debug.classList.remove('hidden');
      debug.textContent = JSON.stringify(
        {
          access_rule: location.access_rule,
          path_rules: location.path_rules,
          region_rules: region?.region_rules,
          dungeon: region?.dungeon,
          shop: region?.shop,
        },
        null,
        2
      );
    } else {
      debug.classList.add('hidden');
    }

    info.innerHTML = `
      <div class="space-y-2">
        <div>
          <span class="font-semibold">Status: </span>
          ${
            instance.isLocationChecked(location.name)
              ? 'Checked'
              : instance.isLocationAccessible(location)
              ? 'Available'
              : instance.isRegionReachable(location.region) &&
                (!location.access_rule || !evaluateRule(location.access_rule))
              ? 'Region accessible, but rule fails'
              : !instance.isRegionReachable(location.region) &&
                (!location.access_rule || evaluateRule(location.access_rule))
              ? 'Region inaccessible, but rule passes'
              : 'Locked'
          }
        </div>
        <div>
          <span class="font-semibold">Player: </span>${location.player}
        </div>
        <div>
          <span class="font-semibold">Region: </span>
          <span class="region-link" data-region="${location.region}">${
      location.region
    }</span>
          ${region?.is_light_world ? ' (Light World)' : ''}
          ${region?.is_dark_world ? ' (Dark World)' : ''}
        </div>
        ${
          region?.dungeon
            ? `
            <div>
              <span class="font-semibold">Dungeon: </span>${region.dungeon.name}
            </div>
          `
            : ''
        }
        ${
          location.item &&
          (instance.isLocationChecked(location.name) || this.gameUI.debugMode)
            ? `
            <div>
              <span class="font-semibold">Item: </span>${location.item.name}
              ${location.item.advancement ? ' (Progression)' : ''}
              ${location.item.priority ? ' (Priority)' : ''}
            </div>
          `
            : ''
        }
      </div>
    `;

    // Remove event listeners from region links in the modal, as commonUI handles this
    /* // Old listener removed - commonUI.createRegionLink handles this now
    info.querySelectorAll('.region-link').forEach((link) => {
      link.addEventListener('click', () => {
        const regionName = link.dataset.region;
        if (regionName) {
          // Close the modal first
          document.getElementById('location-modal').classList.add('hidden');
          // Then navigate to the region
          this.gameUI.regionUI.navigateToRegion(regionName);
        }
      });
    });
    */

    modal.classList.remove('hidden');
  }
}

export default LocationUI;
