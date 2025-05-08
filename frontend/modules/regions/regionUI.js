// regionUI.js
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { evaluateRule } from '../stateManager/ruleEngine.js';
import { PathAnalyzerUI } from '../pathAnalyzer/index.js';
import commonUI from '../commonUI/index.js';
import messageHandler from '../client/core/messageHandler.js';
import loopStateSingleton from '../loops/loopStateSingleton.js';
import settingsManager from '../../app/core/settingsManager.js';
import eventBus from '../../app/core/eventBus.js';
import { debounce } from '../commonUI/index.js';
// Import the exported dispatcher from the module's index
import { moduleDispatcher } from './index.js';
import { createStateSnapshotInterface } from '../stateManager/stateManagerProxy.js';
import {
  renderLogicTree,
  resetUnknownEvaluationCounter,
  logAndGetUnknownEvaluationCounter,
} from '../commonUI/index.js';

export class RegionUI {
  constructor() {
    // Add instance property for unsubscribe handles
    this.unsubscribeHandles = [];

    /**
     * visitedRegions is an array of objects:
     * [{ name: 'Links House', expanded: true, uid: 0 }, ...]
     */
    this.visitedRegions = [];

    // A simple counter to give each visited region block a unique ID
    this.nextUID = 1;

    // If set to true, we'll show **all** regions, ignoring the visited chain
    this.showAll = false;
    this.isInitialized = false; // Add flag
    this.colorblindSettings = {}; // Add colorblind settings cache

    // Create the path analyzer
    this.pathAnalyzer = new PathAnalyzerUI(this);
    this.rootElement = this.createRootElement();
    this.regionsContainer = this.rootElement.querySelector(
      '#region-details-container' // Changed selector
    );
    this.statusElement = null; // Initialize status element ref

    // Subscribe to necessary events when the instance is created
    // REMOVE: this._subscribeToEvents(); // Called by initialize

    this.attachEventListeners();
  }

  // Called by PanelManager when panel is created/shown
  initialize() {
    console.log('[RegionUI] Initializing panel...');
    this.isInitialized = false; // Reset flag
    this.clear(); // Clear previous state
    this._subscribeToEvents(); // Subscribe here
    // Initial render is triggered by stateManager:ready
  }

  _subscribeToEvents() {
    console.log('[RegionUI] Subscribing instance to EventBus events...');
    // Ensure unsubscribed first
    this.unsubscribeHandles.forEach((u) => u());
    this.unsubscribeHandles = [];

    if (!eventBus) {
      console.error('[RegionUI] EventBus not available for subscriptions.');
      return;
    }

    const subscribe = (eventName, handler) => {
      console.log(`[RegionUI] Subscribing to ${eventName}`);
      const unsubscribe = eventBus.subscribe(eventName, handler);
      this.unsubscribeHandles.push(unsubscribe);
    };

    // --- ADDED: Handler for stateManager:ready --- Similar to LocationUI/ExitUI
    const handleReady = () => {
      console.log('[RegionUI] Received stateManager:ready event.');
      if (!this.isInitialized) {
        console.log('[RegionUI] Performing initial setup and render.');
        // Update colorblind settings cache on ready
        this.colorblindSettings =
          settingsManager.getSetting('colorblindMode.regions') || {};

        // Check if we should show only the start region initially
        const showAllCheckbox =
          this.rootElement.querySelector('#show-all-regions');
        this.showAll = showAllCheckbox ? showAllCheckbox.checked : false; // Update showAll state from checkbox
        if (!this.showAll) {
          console.log(
            "[RegionUI] Show All is off, attempting to set start region to 'Menu'..."
          );
          this.showStartRegion('Menu'); // Initialize visitedRegions with Menu
        }

        this.update(); // Initial render (will use populated visitedRegions if showAll is false)
        this.isInitialized = true;
      }
    };
    subscribe('stateManager:ready', handleReady);
    // --- END ADDED ---

    // Debounced update function for subsequent changes
    const debouncedUpdate = debounce(() => {
      if (this.isInitialized) {
        // Only update if initialized
        console.log('[RegionUI] Debounced update triggered.');
        this.update();
      } else {
        // console.log('[RegionUI] Debounced update skipped (not initialized).');
      }
    }, 50);

    // --- Subscribe to snapshot updated for general state changes ---
    subscribe('stateManager:snapshotUpdated', debouncedUpdate);

    // REMOVE: old individual state subscriptions if covered by snapshot
    /*
    subscribe('stateManager:inventoryChanged', (data) => ... );
    subscribe('stateManager:regionsComputed', (data) => ... );
    subscribe('stateManager:locationChecked', (data) => ... );
    subscribe('stateManager:checkedLocationsCleared', (data) => ... );
    */

    // Subscribe to loop state changes (still relevant)
    subscribe('loop:stateChanged', debouncedUpdate);
    subscribe('loop:actionCompleted', debouncedUpdate);
    subscribe('loop:discoveryChanged', debouncedUpdate);
    subscribe('loop:modeChanged', debouncedUpdate);

    // Subscribe to settings changes
    const settingsHandler = ({ key, value }) => {
      if (key === '*' || key.startsWith('colorblindMode.regions')) {
        console.log(
          `[RegionUI] Settings changed (${key}), updating cache and triggering update.`
        );
        // Update local cache
        this.colorblindSettings =
          settingsManager.getSetting('colorblindMode.regions') || {};
        if (this.isInitialized) debouncedUpdate(); // Trigger redraw if initialized
      }
    };
    subscribe('settings:changed', settingsHandler);

    console.log('[RegionUI] Event subscriptions complete.');
  }

  onPanelDestroy() {
    console.log('[RegionUI] Cleaning up subscriptions...');
    this.unsubscribeHandles.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeHandles = []; // Clear handles
    this.pathAnalyzer?.dispose?.();
    console.log('[RegionUI] Cleanup complete.');
  }

  dispose() {
    this.onPanelDestroy();
  }

  createRootElement() {
    const element = document.createElement('div');
    element.classList.add('regions-panel-container', 'panel-container');
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.height = '100%';
    element.style.overflow = 'hidden';

    element.innerHTML = `
      <div class="control-group region-controls" style="padding: 0.5rem; border-bottom: 1px solid #666; flex-shrink: 0;">
        <input type="search" id="region-search" placeholder="Search regions..." style="margin-right: 10px;">
        <select id="region-sort-select" style="margin-right: 10px;">
          <option value="alphabetical" selected>Sort Alphabetical</option>
          <option value="accessibility">Sort by Accessibility</option>
          <!-- Add accessibility_original later if needed -->
        </select>
        <label style="margin-right: 10px;">
          <input type="checkbox" id="region-show-reachable" checked />
          Show Reachable
        </label>
        <label style="margin-right: 10px;">
          <input type="checkbox" id="region-show-unreachable" checked />
          Show Unreachable
        </label>
        <label style="margin-right: 10px;">
          <input type="checkbox" id="show-all-regions" />
          Show Visited Path Only
        </label>
        <button id="expand-collapse-all">Expand All</button>
      </div>
      <div id="region-details-container" style="flex-grow: 1; overflow-y: auto; padding: 0.5rem;">
          <div id="available-regions-section" class="region-category">
              <h3>Available</h3>
              <div class="region-category-content"></div>
          </div>
          <div id="unavailable-regions-section" class="region-category">
              <h3>Unavailable / Unknown</h3>
              <div class="region-category-content"></div>
          </div>
           <!-- Add other sections if needed (e.g., completed) -->
      </div>
    `;
    return element;
  }

  getRootElement() {
    return this.rootElement;
  }

  attachEventListeners() {
    // Search Input
    const searchInput = this.rootElement.querySelector('#region-search');
    if (searchInput) {
      searchInput.addEventListener(
        'input',
        debounce(() => this.renderAllRegions(), 250)
      );
    }

    // Sort Select
    const sortSelect = this.rootElement.querySelector('#region-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => this.renderAllRegions());
    }

    // Filter Checkboxes
    const reachableCheckbox = this.rootElement.querySelector(
      '#region-show-reachable'
    );
    if (reachableCheckbox) {
      reachableCheckbox.addEventListener('change', () =>
        this.renderAllRegions()
      );
    }
    const unreachableCheckbox = this.rootElement.querySelector(
      '#region-show-unreachable'
    );
    if (unreachableCheckbox) {
      unreachableCheckbox.addEventListener('change', () =>
        this.renderAllRegions()
      );
    }

    // Existing Show All/Visited Path Checkbox
    const showAllRegionsCheckbox =
      this.rootElement.querySelector('#show-all-regions');
    if (showAllRegionsCheckbox) {
      // Update label text dynamically based on checked state
      const updateLabel = () => {
        const label = showAllRegionsCheckbox.closest('label');
        if (label) {
          label.childNodes[2].nodeValue = showAllRegionsCheckbox.checked
            ? ' Show All Regions'
            : ' Show Visited Path Only';
        }
      };
      showAllRegionsCheckbox.addEventListener('change', (e) => {
        this.showAll = e.target.checked;
        updateLabel(); // Update label text
        this.renderAllRegions();
      });
      updateLabel(); // Set initial label text
    }

    const expandCollapseAllButton = this.rootElement.querySelector(
      '#expand-collapse-all'
    );
    if (expandCollapseAllButton) {
      expandCollapseAllButton.addEventListener('click', () => {
        if (expandCollapseAllButton.textContent === 'Expand All') {
          this.expandAllRegions();
          expandCollapseAllButton.textContent = 'Collapse All';
        } else {
          this.collapseAllRegions();
          expandCollapseAllButton.textContent = 'Expand All';
        }
      });
    }
  }

  clear() {
    console.log('[RegionUI] Clearing visited regions state.');
    this.visitedRegions = [];
    this.nextUID = 1;
    // REMOVED: Direct DOM manipulation, renderAllRegions handles clearing content
    /*
    if (this.regionsContainer) { ... }
    this._updateSectionVisibility(); 
    */
  }

  update() {
    // No readiness check needed here, it's event driven or called after initialize ensures ready
    console.log('[RegionUI] update() called, calling renderAllRegions().');
    this.renderAllRegions();
  }

  async showStartRegion(startRegionName) {
    console.log(
      `[RegionUI] Attempting to show start region: ${startRegionName}`
    );
    // --- REMOVED: Wait for proxy readiness ---
    /*
    if (!stateManager) { ... }
    try { ... await stateManager.ensureReady(); ... } catch { ... }
    */
    // --- END REMOVED ---

    // Ensure instance and regions are available before proceeding
    const snapshot = stateManager.getLatestStateSnapshot();
    const staticData = stateManager.getStaticData(); // Also check static data

    if (
      !snapshot ||
      !staticData?.regions ||
      !staticData.regions[startRegionName]
    ) {
      console.warn(
        `[RegionUI] Warning: start region ${startRegionName} not found or state/static data not ready.`
      );
      return false; // Indicate failure
    }
    console.log(`[RegionUI] Setting start region: ${startRegionName}`);
    this.visitedRegions = [
      {
        name: startRegionName,
        expanded: true,
        uid: this.nextUID++,
      },
    ];
    // Don't call renderAllRegions here, let the calling context handle it
    return true; // Indicate success
  }

  moveToRegion(oldRegionName, newRegionName) {
    // 1. find the index of oldRegionName in visited array
    const oldIndex = this.visitedRegions.findIndex(
      (r) => r.name === oldRegionName
    );
    if (oldIndex < 0) {
      console.warn(
        `Can't find oldRegionName ${oldRegionName} in visited. Not removing anything.`
      );
      return;
    }

    // 2. remove everything after oldIndex
    this.visitedRegions.splice(oldIndex + 1);

    // 3. collapse the old region block
    this.visitedRegions[oldIndex].expanded = false;

    // 4. Add the new region block (expanded)
    const newBlock = {
      name: newRegionName,
      expanded: true,
      uid: this.nextUID++,
    };
    this.visitedRegions.push(newBlock);

    this.renderAllRegions();
  }

  toggleRegionByUID(uid) {
    const block = this.visitedRegions.find((r) => r.uid === uid);
    if (!block) return;
    block.expanded = !block.expanded;
    this.renderAllRegions();
  }

  expandAllRegions() {
    const snapshot = stateManager.getSnapshot();
    if (this.showAll) {
      if (!snapshot || !snapshot.regions) {
        console.warn(
          '[RegionUI] StateManager instance or regions not ready in expandAllRegions'
        );
        return;
      }
      Object.keys(snapshot.regions).forEach((regionName, index) => {
        const uid = `all_${index}`;
        const regionObj = this.visitedRegions.find((r) => r.uid === uid);
        if (regionObj) {
          regionObj.expanded = true;
        } else {
          this.visitedRegions.push({
            name: regionName,
            expanded: true,
            uid: uid,
          });
        }
      });
    } else {
      this.visitedRegions.forEach((region) => {
        region.expanded = true;
      });
    }
    this.renderAllRegions();
  }

  collapseAllRegions() {
    const snapshot = stateManager.getSnapshot();
    if (this.showAll) {
      if (!snapshot || !snapshot.regions) {
        console.warn(
          '[RegionUI] StateManager instance or regions not ready in collapseAllRegions'
        );
        return;
      }
      Object.keys(snapshot.regions).forEach((regionName, index) => {
        const uid = `all_${index}`;
        const regionObj = this.visitedRegions.find((r) => r.uid === uid);
        if (regionObj) {
          regionObj.expanded = false;
        } else {
          this.visitedRegions.push({
            name: regionName,
            expanded: false,
            uid: uid,
          });
        }
      });
    } else {
      this.visitedRegions.forEach((region) => {
        region.expanded = false;
      });
    }
    this.renderAllRegions();
  }

  renderAllRegions() {
    // REMOVED: Old initialization check, handled by event system now
    /*
    if (!this.isInitialized || !stateManager.getStaticData()?.regions) { ... }
    */
    resetUnknownEvaluationCounter(); // Reset counter
    console.log('[RegionUI] renderAllRegions called.');

    const snapshot = stateManager.getLatestStateSnapshot();
    const staticData = stateManager.getStaticData();
    const useColorblind =
      typeof this.colorblindSettings === 'boolean'
        ? this.colorblindSettings
        : Object.keys(this.colorblindSettings).length > 0;

    console.log(
      '[RegionUI renderAllRegions] Start State - Snapshot:',
      !!snapshot,
      'Static Data:',
      !!staticData
    );

    // Keep data check - Use staticData primarily
    if (!staticData?.regions || !snapshot) {
      // Need snapshot for reachability
      console.warn(
        '[RegionUI] Static region data or snapshot not ready for renderAllRegions.'
      );
      if (
        this.regionsContainer &&
        !this.regionsContainer.innerHTML.includes('Loading')
      ) {
        this.regionsContainer.innerHTML = '<p>Loading region data...</p>';
      }
      this._updateSectionVisibility(); // Ensure sections are hidden if data is loading
      return;
    }

    // Create snapshot interface for rule evals if needed within region blocks
    const snapshotInterface = createStateSnapshotInterface(
      snapshot,
      staticData
    );
    if (!snapshotInterface) {
      console.error(
        '[RegionUI] Failed to create snapshot interface. Rendering may be incomplete.'
      );
      // Decide if we should abort or continue with potentially broken rule displays
    }

    // --- Clear content first ---
    const availableContentContainer = this.regionsContainer.querySelector(
      '#available-regions-section .region-category-content'
    );
    const unavailableContentContainer = this.regionsContainer.querySelector(
      '#unavailable-regions-section .region-category-content'
    );
    if (availableContentContainer) availableContentContainer.innerHTML = '';
    if (unavailableContentContainer) unavailableContentContainer.innerHTML = '';
    if (this.statusElement) this.statusElement.textContent = '';
    // --- End Clearing ---

    const regionContainer = this.rootElement.querySelector(
      '#region-details-container'
    );
    if (!regionContainer) {
      console.error('[RegionUI] region-details-container not found!');
      return;
    }

    // Create fragments for performance
    const availableFragment = document.createDocumentFragment();
    const unavailableFragment = document.createDocumentFragment();
    const unknownFragment = document.createDocumentFragment(); // Keep if needed for unknown state

    // Get filter/sort states from controls
    const searchTerm = this.rootElement
      .querySelector('#region-search')
      .value.toLowerCase();
    const sortMethod = this.rootElement.querySelector(
      '#region-sort-select'
    ).value;
    const showReachable = this.rootElement.querySelector(
      '#region-show-reachable'
    ).checked;
    const showUnreachable = this.rootElement.querySelector(
      '#region-show-unreachable'
    ).checked;
    // this.showAll is updated by its event listener

    let regionsToRender = [];
    if (this.showAll) {
      // Use all regions from static data
      regionsToRender = Object.keys(staticData.regions).map((name) => ({
        name,
        isVisited: false,
        // Determine reachability for filtering/sorting now
        isReachable:
          snapshot.reachability?.[name] === true ||
          snapshot.reachability?.[name] === 'reachable' ||
          snapshot.reachability?.[name] === 'checked',
      }));
    } else {
      // Use only regions from the visited stack
      regionsToRender = this.visitedRegions.map((vr) => ({
        name: vr.name,
        isVisited: true,
        uid: vr.uid,
        expanded: vr.expanded,
        // Determine reachability for filtering/sorting now
        isReachable:
          snapshot.reachability?.[vr.name] === true ||
          snapshot.reachability?.[vr.name] === 'reachable' ||
          snapshot.reachability?.[vr.name] === 'checked',
      }));
      // If visitedRegions is empty, attempt to show start region (needs careful handling to avoid loops)
      if (regionsToRender.length === 0) {
        console.log(
          '[RegionUI] No visited regions to render and Show All is off.'
        );
      }
    }

    // --- APPLY FILTERING ---
    // Search Filter
    if (searchTerm) {
      regionsToRender = regionsToRender.filter((regionInfo) =>
        regionInfo.name.toLowerCase().includes(searchTerm)
      );
    }

    // Reachability Filter
    regionsToRender = regionsToRender.filter((regionInfo) => {
      if (regionInfo.isReachable && !showReachable) return false;
      if (!regionInfo.isReachable && !showUnreachable) return false;
      return true;
    });
    // --- END FILTERING ---

    // --- APPLY SORTING ---
    regionsToRender.sort((a, b) => {
      if (sortMethod === 'accessibility') {
        // Sort reachable (true) before unreachable (false/undefined)
        const reachA = a.isReachable ? 1 : 0;
        const reachB = b.isReachable ? 1 : 0;
        if (reachB !== reachA) {
          return reachB - reachA; // Higher number (reachable) comes first
        }
        // Fallback to name sort for same reachability
        return a.name.localeCompare(b.name);
      } else {
        // Default is 'alphabetical'
        return a.name.localeCompare(b.name);
      }
    });
    // --- END SORTING ---

    // Keep note for later if original order is needed for regions
    // Note: If not showing all, regionsToRender keeps the visitedRegions order initially,
    // but the sort above will override it unless sortMethod is specifically handled.

    for (const regionInfo of regionsToRender) {
      const regionName = regionInfo.name;
      const regionData = staticData.regions[regionName]; // Get static data for the region

      if (!regionData) {
        console.warn(
          `[RegionUI] Static data not found for region '${regionName}' during render.`
        );
        continue; // Skip if static data is missing
      }

      const isReachable = regionInfo.isReachable; // Use pre-calculated reachability

      // Pass snapshot, interface, reachability, and colorblind setting down
      const regionBlock = this.buildRegionBlock(
        regionName,
        regionData,
        snapshot,
        snapshotInterface,
        isReachable, // Pass the boolean reachability status
        useColorblind // Pass the boolean colorblind status
      );

      if (!regionBlock) continue; // Skip if block creation failed

      if (isReachable) {
        availableFragment.appendChild(regionBlock);
      } else {
        unavailableFragment.appendChild(regionBlock);
      }
    }

    // --- Moved Declarations Down and Renamed ---
    // Now query for the containers *again* before appending
    const availableSectionContent = this.regionsContainer.querySelector(
      '#available-regions-section .region-category-content'
    );
    const unavailableSectionContent = this.regionsContainer.querySelector(
      '#unavailable-regions-section .region-category-content'
    );

    if (availableSectionContent)
      availableSectionContent.appendChild(availableFragment);
    if (unavailableSectionContent)
      unavailableSectionContent.appendChild(unavailableFragment);
    // --- End Moved Declarations ---

    this._updateSectionVisibility();
    console.log(`[RegionUI] Finished rendering regions.`);
    logAndGetUnknownEvaluationCounter('RegionPanel update complete'); // Log count
  }

  createRegionLink(regionName, snapshot) {
    // Just call commonUI directly, which now handles event publishing
    return commonUI.createRegionLink(regionName, this.colorblindMode, snapshot);
  }

  /**
   * Navigates to a specific region within the regions panel.
   * Ensures the region block is visible, expanded, scrolls it into view, and highlights it.
   * @param {string} regionName - The name of the region to navigate to.
   */
  navigateToRegion(regionName) {
    if (!this.regionsContainer) {
      return;
    }

    // Ensure the correct view is rendered based on current state
    // (showAll state is handled by renderAllRegions)
    this.renderAllRegions(); // Re-render if needed to ensure the element exists

    // Find the region block using its data attribute within the panel
    // Note: We query within this.regionsContainer specifically
    let regionBlock = this.regionsContainer.querySelector(
      `.region-block[data-region="${regionName}"]`
    );

    // If block not found, maybe it's because "Show All" is off?
    if (!regionBlock && !this.showAll) {
      const showAllCheckbox =
        this.rootElement.querySelector('#show-all-regions');
      if (showAllCheckbox) {
        showAllCheckbox.checked = true;
        this.showAll = true;
        this.renderAllRegions(); // Re-render with all regions visible
        // Try finding the block again
        regionBlock = this.regionsContainer.querySelector(
          `.region-block[data-region="${regionName}"]`
        );
        if (regionBlock) {
          return;
        }
      } else {
        return;
      }
    }

    if (regionBlock) {
      const uidString = regionBlock.dataset.uid;

      // Use uidString to check if it's a 'visited' region (numeric UID) or 'all' region
      const isVisitedRegion = uidString && !isNaN(parseInt(uidString, 10));
      const isExpanded = regionBlock.classList.contains('expanded');

      // Only try to expand visited regions by UID, 'all' regions are handled by showAll
      if (!isExpanded && isVisitedRegion) {
        const uid = parseInt(uidString, 10);
        const regionData = this.visitedRegions.find((r) => r.uid === uid);
        if (regionData) {
          regionData.expanded = true;
          this.renderAllRegions(); // Re-render to reflect expansion
          // Re-query the element after re-render
          const newRegionBlock = this.regionsContainer.querySelector(
            `.region-block[data-region="${regionName}"][data-uid="${uid}"]`
          );
          if (newRegionBlock) {
            regionBlock = newRegionBlock; // Update reference if found
          }
        }
      }

      // Scroll the region block into view
      regionBlock.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest', // Use 'nearest' to minimize scrolling
      });

      // Add a temporary highlight class
      regionBlock.classList.add('highlight-region');
      setTimeout(() => {
        regionBlock.classList.remove('highlight-region');
      }, 1500); // Highlight for 1.5 seconds
    }
  }

  /**
   * Navigate to a specific location in a region
   * @param {string} locationName - The name of the location
   * @param {string} regionName - The name of the region containing the location
   */
  navigateToLocation(locationName, regionName) {
    const regionBlock = this.regionsContainer.querySelector(
      `.region-block[data-region="${regionName}"]`
    );

    if (!regionBlock) {
      this.navigateToRegion(regionName); // Call navigateToRegion to handle visibility
      setTimeout(() => this.navigateToLocation(locationName, regionName), 200);
      return;
    }

    // Ensure the region is expanded if it's a visited region
    if (regionBlock.classList.contains('collapsed')) {
      const uidString = regionBlock.dataset.uid;
      const isVisitedRegion = uidString && !isNaN(parseInt(uidString, 10));
      if (isVisitedRegion) {
        this.toggleRegionByUID(parseInt(uidString, 10));
        setTimeout(
          () => this.navigateToLocation(locationName, regionName),
          200
        );
        return;
      }
    }

    // Now try to find and scroll to the location within the visible region block
    // Use a more specific selector targeting the location link within the wrapper
    const locationElement = regionBlock.querySelector(
      `.location-wrapper .location-link[data-location="${locationName}"]`
    );
    if (locationElement) {
      locationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the parent wrapper for better visibility
      const wrapper = locationElement.closest('.location-wrapper');
      if (wrapper) {
        wrapper.classList.add('highlight-location');
        setTimeout(() => {
          wrapper.classList.remove('highlight-location');
        }, 2000);
      }
    }
  }

  /**
   * Create a clickable link for a location name
   * @param {string} locationName - The name of the location
   * @param {string} regionName - The region containing this location
   * @returns {HTMLElement} - A clickable span element
   */
  createLocationLink(locationName, regionName, snapshot) {
    // Just call commonUI directly, which now handles event publishing
    return commonUI.createLocationLink(
      locationName,
      regionName,
      this.colorblindMode,
      snapshot
    );
  }

  // Modify buildRegionBlock to accept staticData and use it
  buildRegionBlock(
    regionName,
    regionStaticData,
    snapshot,
    snapshotInterface,
    regionIsReachable,
    useColorblind
  ) {
    // Determine if the region is currently expanded based on visitedRegions
    const visitedEntry = this.visitedRegions.find(
      (vr) => vr.name === regionName
    );
    const expanded = visitedEntry ? visitedEntry.expanded : false;
    const uid = visitedEntry ? visitedEntry.uid : this.nextUID++; // Assign UID if new

    // Add to visitedRegions if not already there (e.g., when showAll is true)
    if (!visitedEntry && this.showAll) {
      this.visitedRegions.push({
        name: regionName,
        expanded: false, // Should default to collapsed when adding via showAll?
        uid: uid,
      });
    }

    // Outer container
    const regionBlock = document.createElement('div');
    regionBlock.classList.add('region-block');
    regionBlock.dataset.uid = uid;
    regionBlock.dataset.region = regionName;
    regionBlock.classList.add(expanded ? 'expanded' : 'collapsed');
    regionBlock.classList.toggle('colorblind-mode', useColorblind);

    // Check if Loop Mode is active
    const isLoopModeActive = loopStateSingleton.isLoopModeActive;

    // In Loop Mode, skip rendering if undiscovered (unless showAll logic changes)
    if (
      isLoopModeActive &&
      !loopStateSingleton.isRegionDiscovered(regionName)
    ) {
      // Should potentially return null or an empty div to avoid adding to DOM
      return null;
    }

    // Determine completion status (example logic)
    let totalLocations = regionStaticData.locations?.length || 0;
    let checkedLocationsCount = 0;
    if (regionStaticData.locations && snapshot.flags) {
      // Use snapshot.flags
      const checkedSet = new Set(snapshot.flags);
      checkedLocationsCount = regionStaticData.locations.filter((loc) =>
        checkedSet.has(loc.name)
      ).length;
    }
    const isComplete =
      totalLocations > 0 && checkedLocationsCount === totalLocations;

    // --- Header --- (Uses pre-calculated regionIsReachable)
    const headerEl = document.createElement('div');
    headerEl.classList.add('region-header');
    const regionLabel = regionName + this._suffixIfDuplicate(regionName, uid);

    headerEl.innerHTML = `
        <span class="region-name" title="${regionName}">${regionLabel}</span>
        <span class="region-status">(${checkedLocationsCount}/${totalLocations})</span>
        ${
          useColorblind
            ? `<span class="colorblind-symbol ${
                regionIsReachable ? 'accessible' : 'inaccessible'
              }">${regionIsReachable ? '✓' : '✗'}</span>`
            : ''
        }
        <button class="collapse-btn">${
          expanded ? 'Collapse' : 'Expand'
        }</button>
      `;
    // Add accessibility classes to header
    headerEl.classList.toggle('accessible', regionIsReachable);
    headerEl.classList.toggle('inaccessible', !regionIsReachable);
    headerEl.classList.toggle('completed-region', isComplete);

    // --- Header Click Listener ---
    headerEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('collapse-btn')) {
        e.stopPropagation();
      }
      this.toggleRegionByUID(uid);
    });

    // --- Content (Exits and Locations) ---
    const contentEl = document.createElement('div');
    contentEl.classList.add('region-content');
    contentEl.style.display = expanded ? 'block' : 'none'; // Control visibility

    // World Type
    if (
      regionStaticData.is_light_world !== undefined ||
      regionStaticData.is_dark_world !== undefined
    ) {
      const worldDiv = document.createElement('div');
      worldDiv.innerHTML = `<strong>Light world?</strong> ${
        regionStaticData.is_light_world ?? 'N/A'
      } | <strong>Dark world?</strong> ${
        regionStaticData.is_dark_world ?? 'N/A'
      }`;
      contentEl.prepend(worldDiv); // Add near the top of content
    }

    // Region rules
    if (
      regionStaticData.region_rules &&
      regionStaticData.region_rules.length > 0
    ) {
      const rrContainer = document.createElement('div');
      rrContainer.innerHTML = '<h4>Region Rules</h4>';
      regionStaticData.region_rules.forEach((rule, idx) => {
        const logicDiv = document.createElement('div');
        logicDiv.classList.add('logic-tree');
        logicDiv.innerHTML = `<strong>Rule #${idx + 1}:</strong>`;
        logicDiv.appendChild(
          renderLogicTree(rule, useColorblind, snapshotInterface)
        );
        rrContainer.appendChild(logicDiv);
      });
      contentEl.appendChild(rrContainer);
    }

    // Exits List
    const exitsList = document.createElement('ul');
    exitsList.classList.add('region-exits-list');
    if (regionStaticData.exits && regionStaticData.exits.length > 0) {
      regionStaticData.exits.forEach((exitDef) => {
        // Determine exit accessibility using evaluateRule and snapshotInterface
        let exitAccessible = true;
        if (exitDef.access_rule) {
          try {
            exitAccessible = evaluateRule(
              exitDef.access_rule,
              snapshotInterface
            );
          } catch (e) {
            console.error(
              `[RegionUI] Error evaluating exit rule for ${exitDef.name} in ${regionName}:`,
              e
            );
            exitAccessible = false;
          }
        }
        // Also need to consider connected region reachability from snapshot
        const connectedRegionName = exitDef.connected_region;
        const connectedRegionReachable =
          snapshot.reachability?.[connectedRegionName] === true ||
          snapshot.reachability?.[connectedRegionName] === 'reachable' ||
          snapshot.reachability?.[connectedRegionName] === 'checked';
        const isTraversable =
          regionIsReachable && exitAccessible && connectedRegionReachable;

        // Loop mode discovery check
        const isExitDiscovered =
          !isLoopModeActive ||
          loopStateSingleton.isExitDiscovered(regionName, exitDef.name);
        // TODO: Add filtering based on showExplored checkbox if needed
        if (isLoopModeActive && !isExitDiscovered) {
          // Optionally render differently or skip if not showing undiscovered
          // For now, just mark inaccessible/undiscovered
        }

        const li = document.createElement('li');
        const exitNameDisplay =
          isLoopModeActive && !isExitDiscovered ? '???' : exitDef.name;
        li.appendChild(document.createTextNode(`${exitNameDisplay} → `));
        // Use commonUI.createRegionLink, passing snapshot and useColorblind
        li.appendChild(
          commonUI.createRegionLink(
            connectedRegionName,
            useColorblind,
            snapshot
          )
        );

        // Add move button (from old UI)
        const moveBtn = document.createElement('button');
        moveBtn.classList.add('move-btn');
        moveBtn.textContent = 'Move';
        // Disable if not traversable OR if connected region doesn't exist OR if undiscovered in loop mode
        moveBtn.disabled =
          !isTraversable ||
          !connectedRegionName ||
          (isLoopModeActive && !isExitDiscovered);
        moveBtn.style.marginLeft = '10px';

        moveBtn.addEventListener('click', () => {
          if (!moveBtn.disabled) {
            this.moveToRegion(regionName, connectedRegionName);
          }
        });
        li.appendChild(moveBtn);

        // Apply classes based on overall traversability and discovery
        li.classList.toggle('accessible', isTraversable);
        li.classList.toggle('inaccessible', !isTraversable);
        li.classList.toggle(
          'undiscovered',
          isLoopModeActive && !isExitDiscovered
        );

        // Render logic tree for the exit rule
        if (exitDef.access_rule) {
          const logicTreeElement = renderLogicTree(
            exitDef.access_rule,
            useColorblind,
            snapshotInterface
          );
          const ruleDiv = document.createElement('div');
          ruleDiv.style.marginLeft = '1rem';
          ruleDiv.innerHTML = `Rule: ${logicTreeElement.outerHTML}`;
          li.appendChild(ruleDiv);
        }

        exitsList.appendChild(li);
      });
    } else {
      exitsList.innerHTML = '<li>No exits defined.</li>';
    }
    contentEl.appendChild(exitsList);

    // Locations List
    const locationsList = document.createElement('ul');
    locationsList.classList.add('region-locations-list');
    if (regionStaticData.locations && regionStaticData.locations.length > 0) {
      regionStaticData.locations.forEach((locationDef) => {
        // Determine accessibility using evaluateRule and snapshotInterface
        let locAccessible = true; // Assume accessible if region is reachable and no rule
        if (locationDef.access_rule) {
          try {
            locAccessible = evaluateRule(
              locationDef.access_rule,
              snapshotInterface
            );
          } catch (e) {
            console.error(
              `[RegionUI] Error evaluating location rule for ${locationDef.name} in ${regionName}:`,
              e
            );
            locAccessible = false;
          }
        }
        locAccessible = regionIsReachable && locAccessible; // Must be in reachable region AND pass rule

        const locChecked = snapshot.flags?.includes(locationDef.name) ?? false; // Use flags from snapshot

        // Loop mode discovery check
        const isLocationDiscovered =
          !isLoopModeActive ||
          loopStateSingleton.isLocationDiscovered(locationDef.name);
        // TODO: Add filtering based on showExplored checkbox if needed
        if (isLoopModeActive && !isLocationDiscovered) {
          // Optionally render differently or skip
        }

        const li = document.createElement('li');
        const locationNameDisplay =
          isLoopModeActive && !isLocationDiscovered ? '???' : locationDef.name;
        // Use commonUI.createLocationLink, passing snapshot and useColorblind
        // NOTE: commonUI.createLocationLink currently doesn't take snapshot/colorblind directly.
        // It calculates status internally using snapshot.locations and snapshot.checkedLocations.
        // This might need adjustment in commonUI or we replicate link creation here.
        // For now, create a simple link.
        const locLink = document.createElement('span');
        locLink.textContent = locationNameDisplay;
        locLink.classList.add('location-link'); // Add class for potential future styling/events
        locLink.dataset.location = locationDef.name;
        locLink.dataset.region = regionName;
        li.appendChild(locLink);

        // Add check button logic (can reuse old logic, ensuring canAccess uses new locAccessible)
        const checkBtn = document.createElement('button');
        checkBtn.classList.add('check-loc-btn');
        checkBtn.textContent = 'Check';
        checkBtn.style.display = locChecked ? 'none' : 'inline-block'; // Show if not checked
        checkBtn.disabled = !locAccessible || locChecked; // Disable if not accessible or already checked
        if (isLoopModeActive && !isLocationDiscovered) checkBtn.disabled = true; // Also disable if undiscovered

        checkBtn.addEventListener('click', async () => {
          if (locAccessible && !locChecked) {
            // Mirror logic from LocationUI.handleLocationClick
            try {
              if (loopStateSingleton.isLoopModeActive) {
                console.log(
                  `[RegionUI CheckBtn] Loop mode active, dispatching check request for ${locationDef.name}`
                );
                // Use eventBus for consistency with LocationUI
                eventBus.publish('user:checkLocationRequest', {
                  locationData: locationDef,
                });
              } else {
                console.log(
                  `[RegionUI CheckBtn] Sending checkLocation command for ${locationDef.name}`
                );
                await stateManager.checkLocation(locationDef.name);
                // Snapshot update should handle the visual change
              }
            } catch (error) {
              console.error(
                `[RegionUI CheckBtn] Error checking location ${locationDef.name}:`,
                error
              );
              // Optionally show user feedback
            }
            /* // OLD logic using dispatcher:
                if (moduleDispatcher) {
                    moduleDispatcher.publish('user:checkLocationRequest', {
                        locationData: locationDef, // Pass the static location data
                    });
                } else {
                    console.error('[RegionUI] Cannot publish checkLocationRequest: moduleDispatcher unavailable.');
                }
                */
          }
        });
        li.appendChild(checkBtn);

        if (locChecked) {
          const checkMark = document.createElement('span');
          checkMark.classList.add('check-mark');
          checkMark.textContent = ' ✓';
          li.appendChild(checkMark);
        }

        // Apply classes based on status
        li.classList.toggle('accessible', locAccessible && !locChecked);
        li.classList.toggle('inaccessible', !locAccessible);
        li.classList.toggle('checked-location', locChecked);
        li.classList.toggle(
          'undiscovered',
          isLoopModeActive && !isLocationDiscovered
        );

        // Render logic tree for the location rule
        if (locationDef.access_rule) {
          const logicTreeElement = renderLogicTree(
            locationDef.access_rule,
            useColorblind,
            snapshotInterface
          );
          const ruleDiv = document.createElement('div');
          ruleDiv.style.marginLeft = '1rem';
          ruleDiv.innerHTML = `Rule: ${logicTreeElement.outerHTML}`;
          li.appendChild(ruleDiv);
        }

        locationsList.appendChild(li);
      });
    } else {
      locationsList.innerHTML = '<li>No locations defined.</li>';
    }
    contentEl.appendChild(locationsList);

    // Add Path Analysis section (structure from old UI)
    const pathsControlDiv = document.createElement('div');
    pathsControlDiv.classList.add('paths-control');
    pathsControlDiv.style.marginTop = '1rem'; // Add some spacing
    pathsControlDiv.innerHTML = `
      <div class="paths-buttons">
        <button class="analyze-paths-btn">Analyze Paths</button>
        <span class="paths-count" style="display: none;"></span>
      </div>
    `;
    contentEl.appendChild(pathsControlDiv);

    const pathsContainer = document.createElement('div');
    pathsContainer.classList.add('region-paths');
    pathsContainer.style.display = 'none'; // Initially hidden
    contentEl.appendChild(pathsContainer);

    // Setup the button using the PathAnalyzerUI instance
    const analyzePathsBtn = pathsControlDiv.querySelector('.analyze-paths-btn');
    const pathsCountSpan = pathsControlDiv.querySelector('.paths-count');
    if (analyzePathsBtn && pathsCountSpan && this.pathAnalyzer) {
      this.setupAnalyzePathsButton(
        analyzePathsBtn,
        pathsCountSpan,
        pathsContainer,
        regionName
      );
    } else {
      console.warn(
        '[RegionUI] Could not set up path analysis button for region:',
        regionName
      );
    }

    // Append header and content
    regionBlock.appendChild(headerEl);
    regionBlock.appendChild(contentEl);

    // --- ADD Collapse Button Listener --- >
    const collapseBtn = headerEl.querySelector('.collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent header click listener
        this.toggleRegionByUID(uid);
      });
    }
    // --- END Add Collapse Button Listener --- >

    return regionBlock;
  }

  setupAnalyzePathsButton(
    analyzePathsBtn,
    pathsCountSpan,
    pathsContainer,
    regionName
  ) {
    // Delegate to PathAnalyzerUI
    this.pathAnalyzer.setupAnalyzePathsButton(
      analyzePathsBtn,
      pathsCountSpan,
      pathsContainer,
      regionName
    );
  }

  _suffixIfDuplicate(regionName, uid) {
    // count how many times regionName appears in visited, up to this uid
    const countSoFar = this.visitedRegions.filter(
      (r) => r.name === regionName && r.uid <= uid
    ).length;
    // if it's the first occurrence, return ''
    // if it's the second, return ' (2)', etc.
    return countSoFar > 1 ? ` (${countSoFar})` : '';
  }

  /**
   * Toggles colorblind mode and updates the UI
   */
  toggleColorblindMode() {
    this.colorblindMode = !this.colorblindMode;

    // Update the path analyzer's colorblind mode as well
    this.pathAnalyzer.setColorblindMode(this.colorblindMode);

    // Sync with commonUI
    commonUI.setColorblindMode(this.colorblindMode);

    // Update colorblind indicators in the UI
    this._updateColorblindIndicators();
  }

  /**
   * Helper method to update colorblind indicators across the UI
   */
  _updateColorblindIndicators() {
    // Update all region link indicators (This logic is now handled by commonUI.createRegionLink)
    /* // Old implementation commented out
     this.rootElement.querySelectorAll('.region-link').forEach((link) => {
        // ... (symbol update logic) ...
     });
    */

    // Update logic nodes within this panel
    this.rootElement.querySelectorAll('.logic-node').forEach((node) => {
      const isPassing = node.classList.contains('pass');

      // Remove existing symbol
      const existingSymbol = node.querySelector('.colorblind-symbol');
      if (existingSymbol) existingSymbol.remove();

      // Add new symbol if needed
      if (
        this.colorblindMode &&
        (node.classList.contains('pass') || node.classList.contains('fail'))
      ) {
        const symbolSpan = document.createElement('span');
        symbolSpan.classList.add('colorblind-symbol');
        symbolSpan.textContent = isPassing ? ' ✓' : ' ✗';
        symbolSpan.classList.add(isPassing ? 'accessible' : 'inaccessible');
        node.insertBefore(symbolSpan, node.firstChild); // Insert at beginning
      }
    });
  }

  /**
   * Helper method to handle location checks locally when messageHandler is unavailable
   * @param {Object} location - The location object to check
   * @private
   */
  _handleLocalCheck(location) {
    // Check if the location is actually checkable
    if (location.access_rule && !evaluateRule(location.access_rule)) {
      return; // Don't check locations that aren't accessible
    }

    console.log(
      `RegionUI: Handling local check for location: ${location.name} in ${location.regionName}`
    );

    // Use the imported moduleDispatcher directly
    if (moduleDispatcher) {
      moduleDispatcher.publish('user:checkLocationRequest', {
        locationName: location.name,
        regionName: location.regionName,
      });
    } else {
      console.error(
        '[RegionUI] Cannot publish user:checkLocationRequest: moduleDispatcher is not available.'
      );
    }
  }

  // --- ADDED: Helper to show/hide region categories ---
  _updateSectionVisibility() {
    if (!this.rootElement) return;

    const availableContent = this.rootElement.querySelector(
      '#available-regions-section .region-category-content'
    );
    const unavailableContent = this.rootElement.querySelector(
      '#unavailable-regions-section .region-category-content'
    );

    const availableSection = this.rootElement.querySelector(
      '#available-regions-section'
    );
    const unavailableSection = this.rootElement.querySelector(
      '#unavailable-regions-section'
    );

    if (availableSection) {
      availableSection.style.display =
        availableContent && availableContent.hasChildNodes() ? '' : 'none';
    }
    if (unavailableSection) {
      unavailableSection.style.display =
        unavailableContent && unavailableContent.hasChildNodes() ? '' : 'none';
    }
    // Add checks for other sections (e.g., completed) if they exist
  }
  // --- END ADDED ---
}

export default RegionUI;
