// exitUI.js
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { evaluateRule } from '../stateManager/ruleEngine.js';
import commonUI, { debounce } from '../commonUI/index.js';
import loopStateSingleton from '../loops/loopStateSingleton.js';
import eventBus from '../../app/core/eventBus.js';
import settingsManager from '../../app/core/settingsManager.js';

export class ExitUI {
  constructor(gameUI) {
    this.gameUI = gameUI;
    this.columns = 2; // Default number of columns
    this.rootElement = this.createRootElement();
    this.exitsGrid = this.rootElement.querySelector('#exits-grid');
    this.stateUnsubscribeHandles = [];
    this.settingsUnsubscribe = null;
    this.attachEventListeners();
    this.subscribeToSettings();
    this.subscribeToStateEvents();
  }

  subscribeToSettings() {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }
    this.settingsUnsubscribe = eventBus.subscribe(
      'settings:changed',
      ({ key, value }) => {
        if (key === '*' || key.startsWith('colorblindMode.exits')) {
          console.log('ExitUI reacting to settings change:', key);
          this.updateExitDisplay();
        }
      }
    );
  }

  onPanelDestroy() {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }
    this.unsubscribeFromStateEvents();
  }

  dispose() {
    this.onPanelDestroy();
  }

  subscribeToStateEvents() {
    this.unsubscribeFromStateEvents();
    console.log('[ExitUI] Subscribing to state and loop events...');

    if (!eventBus) {
      console.error('[ExitUI] EventBus not available!');
      return;
    }

    const subscribe = (eventName, handler) => {
      console.log(`[ExitUI] Subscribing to ${eventName}`);
      const unsubscribe = eventBus.subscribe(eventName, handler);
      this.stateUnsubscribeHandles.push(unsubscribe);
    };

    const debouncedUpdate = debounce(() => this.updateExitDisplay(), 50);

    subscribe('stateManager:snapshotUpdated', debouncedUpdate);
    subscribe('stateManager:inventoryChanged', debouncedUpdate);
    subscribe('stateManager:regionsComputed', debouncedUpdate);
    subscribe('stateManager:rulesLoaded', debouncedUpdate);

    subscribe('loop:stateChanged', debouncedUpdate);
    subscribe('loop:actionCompleted', debouncedUpdate);
    subscribe('loop:discoveryChanged', debouncedUpdate);
    subscribe('loop:modeChanged', (isLoopMode) => {
      debouncedUpdate();
      const exploredCheckbox = this.rootElement?.querySelector(
        '#exit-show-explored'
      );
      if (exploredCheckbox && exploredCheckbox.parentElement) {
        exploredCheckbox.parentElement.style.display = isLoopMode
          ? 'inline-block'
          : 'none';
      }
    });
  }

  unsubscribeFromStateEvents() {
    if (this.stateUnsubscribeHandles.length > 0) {
      console.log('[ExitUI] Unsubscribing from state and loop events...');
      this.stateUnsubscribeHandles.forEach((unsubscribe) => unsubscribe());
      this.stateUnsubscribeHandles = [];
    }
  }

  createRootElement() {
    const element = document.createElement('div');
    element.classList.add('exits-panel-container', 'panel-container');
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.height = '100%';
    element.style.overflow = 'hidden';

    element.innerHTML = `
       <div class="control-group exit-controls" style="padding: 0.5rem; border-bottom: 1px solid #666; flex-shrink: 0;">
        <select id="exit-sort-select">
          <option value="original">Original Order</option>
          <option value="accessibility">Sort by Accessibility</option>
        </select>
        <label>
          <input type="checkbox" id="exit-show-reachable" checked />
          Show Reachable
        </label>
        <label>
          <input type="checkbox" id="exit-show-unreachable" checked />
          Show Unreachable
        </label>
        <label style="display: none"> <!-- Controlled by loop mode -->
          <input type="checkbox" id="exit-show-explored" checked />
          Show Explored
        </label>
        <button id="exit-decrease-columns">-</button>
        <button id="exit-increase-columns">+</button>
      </div>
      <div id="exits-grid" style="flex-grow: 1; overflow-y: auto;">
        <!-- Populated by updateExitDisplay -->
      </div>
    `;
    return element;
  }

  getRootElement() {
    return this.rootElement;
  }

  /**
   * Handle click on an exit card in loop mode
   * @param {Object} exit - The exit data
   */
  handleExitClick(exit) {
    // Get loop mode status
    const isLoopModeActive = loopStateSingleton.isLoopModeActive;

    if (!isLoopModeActive) return;

    // Determine if the exit is discovered
    const isExitDiscovered = loopStateSingleton.isExitDiscovered(
      exit.region,
      exit.name
    );

    // --- New Logic for Initial Checks ---
    if (loopStateSingleton.actionQueue.length > 0) {
      const lastAction =
        loopStateSingleton.actionQueue[
          loopStateSingleton.actionQueue.length - 1
        ];

      if (!isExitDiscovered) {
        // If exit is undiscovered, and the last action is an explore for this exit's region, do nothing
        if (
          lastAction.type === 'explore' &&
          lastAction.regionName === exit.region
        ) {
          return;
        }
      } else {
        // If exit is discovered, check if a move action for this specific exit already exists
        const moveExists = loopStateSingleton.actionQueue.some(
          (action) =>
            action.type === 'moveToRegion' &&
            action.regionName === exit.region && // The region *containing* the exit
            action.exitName === exit.name && // The specific exit name
            action.destinationRegion === exit.connected_region // The destination matches
        );
        if (moveExists) {
          return; // Do nothing if the move action is already queued
        }

        // Also check if the *last* action is a move corresponding to clicking this exit
        // This prevents queuing the same move twice if the user clicks rapidly
        if (
          lastAction.type === 'moveToRegion' &&
          lastAction.regionName === exit.region &&
          lastAction.exitName === exit.name
        ) {
          return;
        }
      }
    }
    // --- End New Logic for Initial Checks ---

    // Import the path analyzer logic
    import('../logic/pathAnalyzerLogic.js').then((module) => {
      const pathAnalyzerLogic = new module.PathAnalyzerLogic();

      // Find path from Menu to the region containing this exit
      // Include only discovered regions in the path search
      const path = pathAnalyzerLogic.findPathInLoopMode(exit.region);

      if (path) {
        // Path found - process it

        // Pause processing the action queue
        loopStateSingleton.setPaused(true);

        // Clear the current queue
        loopStateSingleton.actionQueue = [];
        loopStateSingleton.currentAction = null;
        loopStateSingleton.currentActionIndex = 0;

        // Queue move actions for each region transition along the path
        for (let i = 0; i < path.length - 1; i++) {
          const fromRegion = path[i];
          const toRegion = path[i + 1];

          // Find the exit that connects these regions (using discovered exits)
          const instance = stateManager.instance;
          const regionData = instance?.regions[fromRegion];
          // Important: Find the exit within the *discovered* exits for the 'fromRegion'
          const exitToUse = regionData?.exits?.find(
            (e) =>
              e.connected_region === toRegion &&
              loopStateSingleton.isExitDiscovered(fromRegion, e.name)
          );

          if (exitToUse) {
            // Create and queue a move action (moveToRegion)
            const moveAction = {
              id: `action_${Date.now()}_${
                Math.floor(Math.random() * 10000) + i
              }`,
              type: 'moveToRegion',
              regionName: fromRegion, // Where the move action starts
              exitName: exitToUse.name, // The exit being used
              destinationRegion: toRegion, // Where the move action ends
              progress: 0,
              completed: false,
            };

            loopStateSingleton.actionQueue.push(moveAction);
          } else {
            console.warn(
              `Could not find a discovered exit from ${fromRegion} to ${toRegion} while building path.`
            );
            // Optional: Handle this case more robustly, maybe stop queueing?
          }
        }

        // --- New Logic for Final Action ---
        if (!isExitDiscovered) {
          // If the exit is undiscovered, queue an explore action
          const exploreAction = {
            id: `action_${Date.now()}_${
              Math.floor(Math.random() * 10000) + path.length
            }`,
            type: 'explore',
            regionName: exit.region, // Explore the region the exit is *in*
            progress: 0,
            completed: false,
          };
          loopStateSingleton.actionQueue.push(exploreAction);

          // Set the region's "repeat explore action" checkbox to checked
          if (loopStateSingleton) {
            loopStateSingleton.setRepeatExplore(exit.region, true);
          }
        } else {
          // If the exit is discovered, queue a move action *through* this specific exit
          const moveThroughExitAction = {
            id: `action_${Date.now()}_${
              Math.floor(Math.random() * 10000) + path.length
            }`,
            type: 'moveToRegion', // Still a 'moveToRegion' type
            regionName: exit.region, // Start in the region containing the clicked exit
            exitName: exit.name, // Use the specific exit that was clicked
            destinationRegion: exit.connected_region, // Go to the connected region
            progress: 0,
            completed: false,
          };
          loopStateSingleton.actionQueue.push(moveThroughExitAction);
        }
        // --- End New Logic for Final Action ---

        // Begin processing the action queue
        loopStateSingleton.setPaused(false);
        loopStateSingleton.startProcessing(); // This will pick up the new queue

        // Notify UI components about queue changes
        eventBus.publish('loopState:queueUpdated', {
          queue: loopStateSingleton.actionQueue,
        });
      } else {
        // Path not found - display error message
        const errorMessage = `Cannot find a path to ${exit.region} in loop mode.`;
        console.error(errorMessage);

        // Show error in console or alert
        if (window.consoleManager) {
          window.consoleManager.print(errorMessage, 'error');
        } else {
          alert(errorMessage);
        }
      }
    });
  }

  async initialize() {
    console.log('[ExitUI] Initializing panel...');
    // Subscriptions are handled in constructor
    // Need initial update after ensuring proxy is ready
    try {
      await stateManager.ensureReady(); // Wait for proxy
      console.log('[ExitUI] Proxy ready, performing initial display update.');
      this.updateExitDisplay(); // Call initial update after proxy is ready
    } catch (error) {
      console.error(
        '[ExitUI] Error waiting for proxy during initialization:',
        error
      );
      // Display an error state in the UI?
      if (this.exitsGrid) {
        this.exitsGrid.innerHTML =
          '<div class="error-message">Error initializing exit data.</div>';
      }
    }
  }

  clear() {
    if (this.exitsGrid) {
      this.exitsGrid.innerHTML = '';
    }
  }

  update() {
    this.updateExitDisplay();
  }

  attachEventListeners() {
    // Sorting and filtering
    [
      'exit-sort-select',
      'exit-show-reachable',
      'exit-show-unreachable',
      'exit-show-explored',
    ].forEach((id) => {
      this.rootElement
        .querySelector(`#${id}`)
        ?.addEventListener('change', () => this.updateExitDisplay());
    });

    // Column adjustment buttons
    this.rootElement
      .querySelector('#exit-increase-columns')
      ?.addEventListener('click', () => this.changeColumns(1));
    this.rootElement
      .querySelector('#exit-decrease-columns')
      ?.addEventListener('click', () => this.changeColumns(-1));
  }

  changeColumns(delta) {
    this.columns = Math.max(1, this.columns + delta); // Ensure at least 1 column
    this.updateExitDisplay();
  }

  syncWithState() {
    this.updateExitDisplay();
  }

  updateExitDisplay() {
    console.log('[ExitUI] updateExitDisplay called.');
    if (!this.exitsGrid) {
      console.warn('[ExitUI] exitsGrid element not found.');
      return;
    }

    // Get current snapshot
    let snapshot;
    try {
      snapshot = stateManager.getSnapshot();
    } catch (e) {
      console.error('[ExitUI] Error getting snapshot:', e);
      this.exitsGrid.innerHTML =
        '<div class="error-message">Error retrieving exit data.</div>';
      return;
    }

    if (!snapshot || !snapshot.regions) {
      console.log('[ExitUI] Snapshot not ready or no region data found.');
      this.exitsGrid.innerHTML =
        '<div class="loading-message">Loading exit data...</div>';
      return;
    }

    // --- Get Filter/Sort Options --- //
    const sortBy =
      this.rootElement.querySelector('#exit-sort-select')?.value || 'original';
    const showReachable =
      this.rootElement.querySelector('#exit-show-reachable')?.checked ?? true;
    const showUnreachable =
      this.rootElement.querySelector('#exit-show-unreachable')?.checked ?? true;
    const showExplored =
      this.rootElement.querySelector('#exit-show-explored')?.checked ?? true;
    const isLoopModeActive = loopStateSingleton.isLoopModeActive ?? false;

    // --- Get Data From Snapshot --- //
    const allRegions = snapshot.regions || {}; // Get regions from snapshot
    const reachableRegionsSet =
      snapshot.reachableRegions instanceof Set
        ? snapshot.reachableRegions
        : new Set(snapshot.reachableRegions || []);
    const discoveredExits = loopStateSingleton.discoveredExits || new Map(); // Get from loopState
    const discoveredRegions = loopStateSingleton.discoveredRegions || new Set(); // Get from loopState
    const useColorblind = settingsManager.getSetting(
      'colorblindMode.exits',
      true
    );

    // --- Process Exits --- //
    console.log(`[ExitUI] Processing regions from snapshot.`);
    let allExits = [];
    Object.entries(allRegions).forEach(([regionName, regionData]) => {
      if (regionData.exits && Array.isArray(regionData.exits)) {
        regionData.exits.forEach((exit) => {
          allExits.push({ ...exit, region: regionName }); // Add region name to exit data
        });
      }
    });

    let filteredExits = allExits.map((exit) => {
      const isRegionReachable = reachableRegionsSet.has(exit.region);
      const ruleResult =
        !exit.access_rule || evaluateRule(exit.access_rule, snapshot); // Pass snapshot to evaluateRule
      const isReachable = isRegionReachable && ruleResult;
      const isExitExplored =
        discoveredRegions.has(exit.region) &&
        (discoveredExits.get(exit.region)?.has(exit.name) ?? false);
      const isDestinationRegionExplored = discoveredRegions.has(
        exit.connected_region
      );
      const isExplored = isExitExplored && isDestinationRegionExplored; // Both exit and dest must be explored
      return { ...exit, isReachable, isExplored }; // Add derived properties
    });

    // Filter based on checkboxes
    filteredExits = filteredExits.filter((exit) => {
      if (!showReachable && exit.isReachable) return false;
      if (!showUnreachable && !exit.isReachable) return false;
      if (isLoopModeActive && !showExplored && !exit.isExplored) return false;
      return true;
    });

    // Sort based on selection
    if (sortBy === 'accessibility') {
      filteredExits.sort((a, b) => {
        if (a.isReachable !== b.isReachable) return a.isReachable ? -1 : 1; // Reachable first
        return (a.region + a.name).localeCompare(b.region + b.name); // Fallback sort
      });
    } else {
      // Default: original (region + name)
      filteredExits.sort((a, b) =>
        (a.region + a.name).localeCompare(b.region + b.name)
      );
    }

    // --- Render Grid --- //
    this.exitsGrid.innerHTML = ''; // Clear previous content
    this.exitsGrid.style.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;

    if (filteredExits.length === 0) {
      this.exitsGrid.innerHTML =
        '<div class="no-exits-message">No exits match filters.</div>';
      return;
    }

    filteredExits.forEach((exit) => {
      const exitElement = document.createElement('div');
      exitElement.classList.add('exit');
      exitElement.dataset.exitName = exit.name;
      exitElement.dataset.regionName = exit.region;

      let statusClass = exit.isReachable ? 'reachable' : 'unreachable';
      exitElement.classList.add(statusClass);
      if (isLoopModeActive && exit.isExplored) {
        exitElement.classList.add('explored');
      }

      // Colorblind indicator text
      let cbIndicator = '';
      if (useColorblind) {
        cbIndicator = exit.isReachable ? ' [R]' : ' [U]';
      }

      exitElement.textContent = `${exit.region} -> ${exit.name} -> ${
        exit.connected_region || '???'
      }${cbIndicator}`;
      exitElement.title = `From: ${exit.region} - To: ${
        exit.connected_region || '???'
      } - ${statusClass.toUpperCase()}`;

      // Attach click listener for loop mode interaction
      if (isLoopModeActive) {
        exitElement.addEventListener('click', () => this.handleExitClick(exit));
      }

      this.exitsGrid.appendChild(exitElement);
    });
    console.log(`[ExitUI] Rendered ${filteredExits.length} exits.`);
  }

  getAllExits(instance) {
    if (!instance || !instance.regions) return [];

    const exits = [];
    Object.values(instance.regions).forEach((region) => {
      if (region.exits) {
        region.exits.forEach((exit) => {
          // Add region name to each exit for reference
          exits.push({
            ...exit,
            region: region.name,
            player: region.player || 1,
          });
        });
      }
    });

    return exits;
  }
}

export default ExitUI;
