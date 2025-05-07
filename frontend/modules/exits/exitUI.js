// exitUI.js
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { evaluateRule } from '../stateManager/ruleEngine.js';
import commonUI from '../commonUI/index.js';
import { createStateSnapshotInterface } from '../stateManager/stateManagerProxy.js';
import {
  debounce,
  renderLogicTree,
  resetUnknownEvaluationCounter,
  logAndGetUnknownEvaluationCounter,
} from '../commonUI/index.js';
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
    this.isInitialized = false;
    this.attachEventListeners();
    this.subscribeToSettings();
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

    const handleReady = () => {
      console.log('[ExitUI] Received stateManager:ready event.');
      if (!this.isInitialized) {
        console.log('[ExitUI] Performing initial render.');
        this.updateExitDisplay();
        this.isInitialized = true;
      }
    };
    subscribe('stateManager:ready', handleReady);

    const debouncedUpdate = debounce(() => {
      if (this.isInitialized) {
        this.updateExitDisplay();
      }
    }, 50);

    subscribe('stateManager:snapshotUpdated', debouncedUpdate);
    subscribe('loop:stateChanged', debouncedUpdate);
    subscribe('loop:actionCompleted', debouncedUpdate);
    subscribe('loop:discoveryChanged', debouncedUpdate);
    subscribe('loop:modeChanged', (isLoopMode) => {
      if (this.isInitialized) debouncedUpdate();
      const exploredCheckbox = this.rootElement?.querySelector(
        '#exit-show-explored'
      );
      if (exploredCheckbox?.parentElement) {
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

  // Called when the panel is initialized by PanelManager
  initialize() {
    console.log('[ExitUI] Initializing panel...');
    this.isInitialized = false;
    this.subscribeToStateEvents();
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
    resetUnknownEvaluationCounter();

    const snapshot = stateManager.getLatestStateSnapshot();
    const staticData = stateManager.getStaticData();
    console.log(
      '[ExitUI updateExitDisplay] Start State - Snapshot:',
      !!snapshot,
      'Static Data:',
      !!staticData
    );

    if (!snapshot || !staticData || !staticData.exits || !staticData.regions) {
      console.warn(
        '[ExitUI] Snapshot or static data (exits/regions) not ready. Aborting render.'
      );
      this.exitsGrid.innerHTML = '<p>Loading exit data...</p>';
      return;
    }

    if (!this.exitsGrid) {
      console.warn('[ExitUI] exitsGrid element not found.');
      return;
    }

    const allExits = Object.values(staticData.exits);
    let displayExits = [];

    allExits.forEach((exit) => {
      const fromRegionName = exit.parentRegion;
      const toRegionName = exit.connectedRegion;

      const fromRegionStatus =
        snapshot.reachability?.[fromRegionName] ?? 'unknown';
      const toRegionStatus = snapshot.reachability?.[toRegionName] ?? 'unknown';

      let exitStatus = 'unknown';
      if (fromRegionStatus === 'reachable' && toRegionStatus === 'reachable') {
        exitStatus = 'open';
      } else if (
        fromRegionStatus === 'reachable' ||
        toRegionStatus === 'reachable'
      ) {
        exitStatus = 'partial';
      } else if (
        fromRegionStatus !== 'unknown' &&
        toRegionStatus !== 'unknown'
      ) {
        exitStatus = 'closed';
      }

      displayExits.push({
        ...exit,
        status: exitStatus,
      });
    });

    console.log(`[ExitUI] Processing ${displayExits.length} exits.`);

    this.exitsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    displayExits.forEach((exit) => {
      const card = document.createElement('div');
      card.className = `exit exit-card ${exit.status}`;
      card.dataset.exitName = exit.name;
      card.dataset.regionName = exit.parentRegion;

      const title = document.createElement('span');
      title.className = 'exit-title';
      title.textContent = exit.name;

      const regions = document.createElement('span');
      regions.className = 'exit-regions';
      regions.textContent = ` (${exit.parentRegion} <=> ${exit.connectedRegion})`;

      const header = document.createElement('div');
      header.className = 'exit-header';
      header.appendChild(title);
      header.appendChild(regions);
      card.appendChild(header);

      card.addEventListener('click', () => this.handleExitClick(exit));

      fragment.appendChild(card);
    });

    this.exitsGrid.appendChild(fragment);
    console.log(`[ExitUI] Rendered ${displayExits.length} exits.`);
    logAndGetUnknownEvaluationCounter('ExitPanel update complete');
  }

  getAllExits(instance) {
    if (!instance || !instance.regions) return [];

    const exits = [];
    Object.values(instance.regions).forEach((region) => {
      if (region.exits) {
        region.exits.forEach((exit) => {
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
