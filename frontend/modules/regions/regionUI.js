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

    // Add colorblind mode property
    this.colorblindMode = false;

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

    // --- ADDED: Handler for stateManager:ready ---
    const handleReady = () => {
      console.log('[RegionUI] Received stateManager:ready event.');
      if (!this.isInitialized) {
        console.log('[RegionUI] Performing initial setup and render.');
        this.update(); // Initial render
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

    // REMOVE: Specific handler for rules loaded (now handled by :ready)
    /*
    const rulesLoadedHandler = async (data) => { ... };
    subscribe('stateManager:rulesLoaded', rulesLoadedHandler);
    */

    // Wrap other handlers
    const updateHandler = (eventData) => {
      if (this.isInitialized) {
        console.log(
          `[RegionUI] Event received, triggering debounced update. Event: ${eventData.eventName}`,
          eventData
        );
        debouncedUpdate();
      }
    };

    const settingsHandler = ({ key, value }) => {
      if (key === '*' || key.startsWith('colorblindMode.regions')) {
        console.log(
          `[RegionUI] Settings changed (${key}), triggering debounced update.`
        );
        if (this.isInitialized) debouncedUpdate();
      }
    };

    // Subscribe to state changes that affect region display
    subscribe('stateManager:inventoryChanged', (data) =>
      updateHandler({ eventName: 'stateManager:inventoryChanged', data })
    );
    subscribe('stateManager:regionsComputed', (data) =>
      updateHandler({ eventName: 'stateManager:regionsComputed', data })
    );
    subscribe('stateManager:locationChecked', (data) =>
      updateHandler({ eventName: 'stateManager:locationChecked', data })
    );
    subscribe('stateManager:checkedLocationsCleared', (data) =>
      updateHandler({ eventName: 'stateManager:checkedLocationsCleared', data })
    );

    // Subscribe to loop state changes
    subscribe('loop:stateChanged', (data) =>
      updateHandler({ eventName: 'loop:stateChanged', data })
    );
    subscribe('loop:actionCompleted', (data) =>
      updateHandler({ eventName: 'loop:actionCompleted', data })
    );
    subscribe('loop:discoveryChanged', (data) =>
      updateHandler({ eventName: 'loop:discoveryChanged', data })
    );
    subscribe('loop:modeChanged', (data) =>
      updateHandler({ eventName: 'loop:modeChanged', data })
    );

    // Subscribe to settings changes
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
        <label>
          <input type="checkbox" id="show-all-regions" />
          Show All Regions
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
    const showAllRegionsCheckbox =
      this.rootElement.querySelector('#show-all-regions');
    if (showAllRegionsCheckbox) {
      showAllRegionsCheckbox.addEventListener('change', (e) => {
        this.showAll = e.target.checked;
        this.renderAllRegions();
      });
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
    // REMOVE ensureReady checks (if any)
    // --- Log data state at function start --- >
    const snapshot = stateManager.getLatestStateSnapshot();
    const staticData = stateManager.getStaticData();
    console.log(
      '[RegionUI renderAllRegions] Start State - Snapshot:',
      !!snapshot,
      'Static Data:',
      !!staticData
    );
    // --- End log ---

    // Keep data check
    if (!snapshot || !staticData || !staticData.regions) {
      // console.warn('[RegionUI] Snapshot or static region data not ready for renderAllRegions.');
      if (
        this.regionsContainer &&
        !this.regionsContainer.innerHTML.includes('Loading')
      ) {
        this.regionsContainer.innerHTML = '<p>Loading region data...</p>';
      }
      return;
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

    // Use staticData.regions as the source of truth for region definitions
    const sortedRegionNames = Object.keys(staticData.regions).sort();

    for (const regionName of sortedRegionNames) {
      const regionData = staticData.regions[regionName];
      const isReachable =
        snapshot.reachableRegions?.includes(regionName) || false;

      // Pass staticData to buildRegionBlock
      const regionBlock = this.buildRegionBlock(
        regionName,
        regionData,
        snapshot,
        staticData,
        isReachable
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
    staticData,
    isReachable
  ) {
    // Determine if the region is currently expanded based on visitedRegions
    const visitedEntry = this.visitedRegions.find(
      (vr) => vr.name === regionName
    );
    const expanded = visitedEntry ? visitedEntry.expanded : false;
    const uid = visitedEntry ? visitedEntry.uid : this.nextUID++; // Assign UID if new

    // Add to visitedRegions if not already there (e.g., when showAll is true)
    if (!visitedEntry) {
      this.visitedRegions.push({
        name: regionName,
        expanded: false,
        uid: uid,
      });
    }

    // Outer container
    const regionBlock = document.createElement('div');
    regionBlock.classList.add('region-block');
    regionBlock.dataset.uid = uid;
    regionBlock.dataset.region = regionName;
    regionBlock.classList.add(expanded ? 'expanded' : 'collapsed');
    regionBlock.classList.toggle('colorblind-mode', this.colorblindMode);

    // Determine accessibility based on the passed 'isReachable' flag (from snapshot)
    const regionIsAccessible = isReachable;

    // Determine completion status (example logic)
    let totalLocations = regionStaticData.locations?.length || 0;
    let checkedLocationsCount = 0;
    if (regionStaticData.locations && snapshot.checkedLocations) {
      const checkedSet = new Set(snapshot.checkedLocations);
      checkedLocationsCount = regionStaticData.locations.filter((loc) =>
        checkedSet.has(loc.name)
      ).length;
    }
    const isComplete =
      totalLocations > 0 && checkedLocationsCount === totalLocations;

    // --- Header ---
    const headerEl = document.createElement('div');
    headerEl.classList.add('region-header');
    const regionLabel = regionName + this._suffixIfDuplicate(regionName, uid);

    headerEl.innerHTML = `
        <span class="region-name" title="${regionName}">${regionLabel}</span>
        <span class="region-status">(${checkedLocationsCount}/${totalLocations})</span>
        ${
          this.colorblindMode
            ? `<span class="colorblind-symbol ${
                regionIsAccessible ? 'accessible' : 'inaccessible'
              }">${regionIsAccessible ? '✓' : '✗'}</span>`
            : ''
        }
        <button class="collapse-btn">${
          expanded ? 'Collapse' : 'Expand'
        }</button>
      `;
    // Add accessibility classes to header
    headerEl.classList.toggle('accessible', regionIsAccessible);
    headerEl.classList.toggle('inaccessible', !regionIsAccessible);
    headerEl.classList.toggle('completed-region', isComplete);

    // --- ADD Click Listener to Header --- >
    headerEl.addEventListener('click', (e) => {
      // Prevent collapse button click from triggering header toggle
      if (e.target.classList.contains('collapse-btn')) {
        e.stopPropagation(); // Stop event from bubbling up
      }
      this.toggleRegionByUID(uid);
    });
    // --- END Add Click Listener ---

    // --- Content (Exits and Locations) ---
    const contentEl = document.createElement('div');
    contentEl.classList.add('region-content');
    contentEl.style.display = expanded ? 'block' : 'none'; // Control visibility

    // Exits List
    const exitsList = document.createElement('ul');
    exitsList.classList.add('region-exits-list');
    if (regionStaticData.exits && regionStaticData.exits.length > 0) {
      // Find the corresponding region data in the snapshot which has calculated accessibility
      const snapshotRegionData = snapshot.regions?.[regionName];
      regionStaticData.exits.forEach((exitDef) => {
        // Find the corresponding exit in the snapshot data to get its accessibility
        const snapshotExit = snapshotRegionData?.exits?.find(
          (e) => e.name === exitDef.name
        );
        const exitAccessible = snapshotExit?.isAccessible ?? false; // Default to false if not found in snapshot

        const li = document.createElement('li');
        li.innerHTML = commonUI.createRegionLink(
          exitDef.connected_region,
          exitDef.name,
          exitAccessible, // Use pre-calculated value
          this.colorblindMode
        );
        li.classList.toggle('accessible', exitAccessible);
        li.classList.toggle('inaccessible', !exitAccessible);
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
        // Find the corresponding location in the snapshot data (top-level locations array)
        const snapshotLocation = snapshot.locations?.find(
          (l) => l.name === locationDef.name
        );
        const locAccessible = snapshotLocation?.isAccessible ?? false;
        const locChecked = snapshotLocation?.isChecked ?? false; // Use isChecked from snapshot

        const li = document.createElement('li');
        li.innerHTML = commonUI.createLocationLink(
          locationDef.name,
          locAccessible, // Use pre-calculated value
          locChecked, // Use pre-calculated value
          this.colorblindMode
        );
        li.classList.toggle('accessible', locAccessible);
        li.classList.toggle('inaccessible', !locAccessible);
        li.classList.toggle('checked-location', locChecked);
        locationsList.appendChild(li);
      });
    } else {
      locationsList.innerHTML = '<li>No locations defined.</li>';
    }
    contentEl.appendChild(locationsList);

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
