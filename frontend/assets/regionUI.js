// regionUI.js
import stateManager from './stateManagerSingleton.js';
import { evaluateRule } from './ruleEngine.js';

export class RegionUI {
  constructor(gameUI) {
    this.gameUI = gameUI;

    /**
     * visitedRegions is an array of objects:
     * [{ name: 'Links House', expanded: true, uid: 0 }, ...]
     */
    this.visitedRegions = [];

    // A simple counter to give each visited region block a unique ID
    this.nextUID = 1;

    // If set to true, we'll show **all** regions, ignoring the visited chain
    this.showAll = false;

    // Add colorblind mode property
    this.colorblindMode = false;

    // Configure maximum iterations for path finding to prevent UI freezes
    this.maxPathFinderIterations = 10000;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const showAllRegionsCheckbox = document.getElementById('show-all-regions');
    if (showAllRegionsCheckbox) {
      showAllRegionsCheckbox.addEventListener('change', (e) => {
        this.showAll = e.target.checked;
        this.renderAllRegions();
      });
    }

    const expandCollapseAllButton = document.getElementById(
      'expand-collapse-all'
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

  initialize() {
    this.clear();
    this.showStartRegion('Menu');

    // Add CSS styles for multiple exits
    const styles = document.createElement('style');
    styles.innerHTML = `
      .transition-header {
        padding: 5px;
        margin-top: 10px;
        margin-bottom: 5px;
        border-radius: 4px;
        background-color: rgba(0, 0, 0, 0.2);
      }
      
      .path-exit-rule-container {
        position: relative;
      }
      
      .path-exit-rule-container::before {
        content: "";
        position: absolute;
        top: 0;
        left: -10px;
        width: 10px;
        height: 50%;
        border-bottom: 1px solid #555;
        border-left: 1px solid #555;
      }
      
      .path-exit-rule-container:first-of-type::before {
        display: none;
      }
    `;
    document.head.appendChild(styles);
  }

  clear() {
    this.visitedRegions = [];
    this.nextUID = 1;
    const regionsContainer = document.getElementById('regions-panel');
    if (regionsContainer) {
      regionsContainer.innerHTML = '';
    }
  }

  update() {
    this.renderAllRegions();
  }

  log(msg) {
    if (window.consoleManager) {
      window.consoleManager.print(msg, 'info');
    } else {
      console.log(msg);
    }
  }

  showStartRegion(startRegionName) {
    if (!stateManager.regions[startRegionName]) {
      this.log(
        `Warning: start region ${startRegionName} not found in stateManager.regions.`
      );
      return;
    }
    this.visitedRegions = [
      {
        name: startRegionName,
        expanded: true,
        uid: this.nextUID++,
      },
    ];
    this.renderAllRegions();
  }

  moveToRegion(oldRegionName, newRegionName) {
    // 1. find the index of oldRegionName in visited array
    const oldIndex = this.visitedRegions.findIndex(
      (r) => r.name === oldRegionName
    );
    if (oldIndex < 0) {
      this.log(
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
    if (this.showAll) {
      Object.keys(stateManager.regions).forEach((regionName, index) => {
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
    if (this.showAll) {
      Object.keys(stateManager.regions).forEach((regionName, index) => {
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
    const container = document.getElementById('regions-panel');
    if (!container) {
      this.log('No #regions-panel element found');
      return;
    }
    container.innerHTML = '';

    if (this.showAll) {
      // Show all regions ignoring path logic
      Object.keys(stateManager.regions).forEach((regionName, index) => {
        const rData = stateManager.regions[regionName];
        const uid = `all_${index}`; // or any stable unique key
        const regionObj = this.visitedRegions.find((r) => r.uid === uid);
        const expanded = regionObj ? regionObj.expanded : true; // expand all by default
        const regionBlock = this.buildRegionBlock(
          rData,
          regionName,
          expanded,
          uid
        );
        container.appendChild(regionBlock);
      });
    } else {
      // Normal visited chain
      for (const regionObj of this.visitedRegions) {
        const { name: regionName, expanded, uid } = regionObj;
        const rData = stateManager.regions[regionName];
        if (!rData) continue;
        const regionBlock = this.buildRegionBlock(
          rData,
          regionName,
          expanded,
          uid
        );
        container.appendChild(regionBlock);
      }
    }
  }

  findPathsToRegion(targetRegion, maxPaths = 100) {
    const paths = [];

    // Use stateManager's computeReachableRegions to check if the target is reachable at all
    const reachableRegions = stateManager.computeReachableRegions();

    if (!reachableRegions.has(targetRegion)) {
      console.debug(
        `Target region ${targetRegion} is not reachable according to stateManager`
      );
      // Still attempt to find paths, which might reveal why it's unreachable
    }

    const startRegions = stateManager.getStartRegions();

    for (const startRegion of startRegions) {
      if (paths.length >= maxPaths) break;
      this._findPathsDFS(
        startRegion,
        targetRegion,
        [startRegion],
        new Set([startRegion]),
        paths,
        maxPaths
      );
    }

    return paths;
  }

  _findPathsDFS(
    currentRegion,
    targetRegion,
    currentPath,
    visited,
    allPaths,
    maxPaths
  ) {
    if (currentRegion === targetRegion && currentPath.length > 1) {
      allPaths.push([...currentPath]);
      return;
    }

    if (allPaths.length >= maxPaths) return;

    const regionData = stateManager.regions[currentRegion];
    if (!regionData) return;

    for (const exit of regionData.exits || []) {
      const nextRegion = exit.connected_region;
      if (!nextRegion || visited.has(nextRegion)) continue;

      visited.add(nextRegion);
      currentPath.push(nextRegion);
      this._findPathsDFS(
        nextRegion,
        targetRegion,
        currentPath,
        visited,
        allPaths,
        maxPaths
      );
      currentPath.pop();
      visited.delete(nextRegion);
    }
  }

  createRegionLink(regionName) {
    const link = document.createElement('span');
    link.textContent = regionName;
    link.classList.add('region-link');
    link.dataset.region = regionName;
    link.title = `Click to view the ${regionName} region`;

    link.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToRegion(regionName);
    });

    return link;
  }
  /*
  createLocationLink(locationName, regionName) {
    const link = document.createElement('span');
    link.textContent = locationName;
    link.classList.add('location-link');
    link.dataset.location = locationName;
    link.dataset.region = regionName;
    link.title = `Click to view the ${regionName} region containing this location`;

    link.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToRegion(regionName);
    });

    return link;
  }
*/

  /**
   * Navigate to a specific region in the regions panel
   * @param {string} regionName - The name of the region to navigate to
   */
  navigateToRegion(regionName) {
    // Switch to the regions view
    this.gameUI.setViewMode('regions');

    // Important: Set the radio button for regions view
    document.querySelector(
      'input[name="view-mode"][value="regions"]'
    ).checked = true;

    // Enable "Show all regions" if it's not already enabled
    const showAllCheckbox = document.getElementById('show-all-regions');
    if (showAllCheckbox && !showAllCheckbox.checked) {
      showAllCheckbox.checked = true;
      this.showAll = true;
      this.renderAllRegions();
    }

    // Wait for the rendering to complete, then scroll to the region
    setTimeout(() => {
      const regionElement = document.querySelector(
        `.region-block[data-region="${regionName}"]`
      );
      if (regionElement) {
        // Expand the region if it's collapsed
        if (!regionElement.classList.contains('expanded')) {
          const uid = regionElement.dataset.uid;
          this.toggleRegionByUID(uid);
        }

        // Scroll the region into view
        regionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Highlight the region briefly
        regionElement.classList.add('highlight-region');
        setTimeout(() => {
          regionElement.classList.remove('highlight-region');
        }, 2000);
      }
    }, 100);
  }

  /**
   * Navigate to a specific location in a region
   * @param {string} locationName - The name of the location
   * @param {string} regionName - The name of the region containing the location
   */
  navigateToLocation(locationName, regionName) {
    // First navigate to the region
    this.navigateToRegion(regionName);

    // Then wait a bit longer and try to find and scroll to the location
    setTimeout(() => {
      const locationElement = document.querySelector(
        `.region-block[data-region="${regionName}"] .location-wrapper:has(span[data-location="${locationName}"])`
      );
      if (locationElement) {
        locationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        locationElement.classList.add('highlight-location');
        setTimeout(() => {
          locationElement.classList.remove('highlight-location');
        }, 2000);
      }
    }, 300);
  }

  /**
   * Create a clickable link for a location name
   * @param {string} locationName - The name of the location
   * @param {string} regionName - The region containing this location
   * @returns {HTMLElement} - A clickable span element
   */
  createLocationLink(locationName, regionName) {
    const link = document.createElement('span');
    link.textContent = locationName;
    link.classList.add('location-link');
    link.dataset.location = locationName;
    link.dataset.region = regionName;
    link.title = `Click to view ${locationName} in the ${regionName} region`;

    link.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToLocation(locationName, regionName);
    });

    return link;
  }

  // Update buildRegionBlock method to move the Show Paths button to the bottom
  // and implement the new path display functionality
  buildRegionBlock(rData, regionName, expanded, uid) {
    // Outer container
    const regionBlock = document.createElement('div');
    regionBlock.classList.add('region-block');
    regionBlock.dataset.uid = uid;
    regionBlock.dataset.region = regionName;
    regionBlock.classList.add(expanded ? 'expanded' : 'collapsed');

    // Check if we have a valid inventory before evaluating rules
    const inventory = stateManager?.inventory;
    if (!inventory) {
      return document.createElement('div'); // Return empty div if no inventory
    }

    const isAccessible = stateManager.isRegionReachable(regionName);

    // Header
    const headerEl = document.createElement('div');
    headerEl.classList.add('region-header');
    const regionLabel = regionName + this._suffixIfDuplicate(regionName, uid);

    headerEl.innerHTML = `
    <span class="region-name" style="color: ${
      isAccessible ? 'inherit' : 'red'
    }">${regionLabel}${
      this.colorblindMode
        ? `<span class="colorblind-symbol ${
            isAccessible ? 'accessible' : 'inaccessible'
          }">
        ${isAccessible ? ' ✓' : ' ✗'}
      </span>`
        : ''
    }</span>
    <button class="collapse-btn">${expanded ? 'Collapse' : 'Expand'}</button>
  `;
    regionBlock.appendChild(headerEl);

    // Collapse button event listener
    headerEl.querySelector('.collapse-btn').addEventListener('click', () => {
      this.toggleRegionByUID(uid);
    });

    if (expanded) {
      const detailEl = document.createElement('div');
      detailEl.classList.add('region-details');

      detailEl.innerHTML += `
      <div><strong>Light world?</strong> ${rData.is_light_world}</div>
      <div><strong>Dark world?</strong> ${rData.is_dark_world}</div>
    `;

      // Region rules
      if (rData.region_rules?.length > 0) {
        const rrContainer = document.createElement('div');
        rrContainer.innerHTML = '<h4>Region Rules</h4>';
        rData.region_rules.forEach((rule, idx) => {
          const logicDiv = document.createElement('div');
          logicDiv.classList.add('logic-tree');
          logicDiv.innerHTML = `<strong>Rule #${idx + 1}:</strong>`;
          logicDiv.appendChild(this.renderLogicTree(rule));
          rrContainer.appendChild(logicDiv);
        });
        detailEl.appendChild(rrContainer);
      }

      // Exits
      if (rData.exits?.length > 0) {
        const exitsContainer = document.createElement('div');
        exitsContainer.classList.add('region-exits-container');
        exitsContainer.innerHTML = '<h4>Exits</h4>';

        rData.exits.forEach((exit) => {
          const exitWrapper = document.createElement('div');
          exitWrapper.classList.add('exit-wrapper');

          // Remove inventory parameter
          const canAccess = evaluateRule(exit.access_rule);
          const colorClass = canAccess ? 'accessible' : 'inaccessible';

          // Create wrapper for exit info
          const exitInfo = document.createElement('span');
          exitInfo.classList.add(colorClass);
          exitInfo.textContent = `${exit.name} → `;

          // Add connected region as a link if it exists
          if (exit.connected_region) {
            const regionLink = this.createRegionLink(exit.connected_region);
            regionLink.classList.add(colorClass);
            exitInfo.appendChild(regionLink);
          } else {
            exitInfo.textContent += '(none)';
          }

          exitWrapper.appendChild(exitInfo);

          // Add move button
          const moveBtn = document.createElement('button');
          moveBtn.classList.add('move-btn');
          moveBtn.textContent = 'Move';
          moveBtn.disabled = !(canAccess && exit.connected_region);
          moveBtn.addEventListener('click', () => {
            if (canAccess && exit.connected_region) {
              this.moveToRegion(regionName, exit.connected_region);
            }
          });
          exitWrapper.appendChild(moveBtn);

          if (exit.access_rule) {
            const logicTreeDiv = document.createElement('div');
            logicTreeDiv.classList.add('logic-tree');
            logicTreeDiv.appendChild(this.renderLogicTree(exit.access_rule));
            exitWrapper.appendChild(logicTreeDiv);
          }

          exitsContainer.appendChild(exitWrapper);
        });

        detailEl.appendChild(exitsContainer);
      }

      // Locations
      if (rData.locations?.length > 0) {
        const locContainer = document.createElement('div');
        locContainer.classList.add('region-locations-container');
        locContainer.innerHTML = '<h4>Locations</h4>';

        rData.locations.forEach((loc) => {
          const locDiv = document.createElement('div');
          locDiv.classList.add('location-wrapper');

          // Remove inventory parameter
          const canAccess = evaluateRule(loc.access_rule);
          const isChecked = stateManager.isLocationChecked(loc.name);
          const colorClass = isChecked
            ? 'checked-loc'
            : canAccess
            ? 'accessible'
            : 'inaccessible';

          // Create a location link instead of a simple span
          const locLink = this.createLocationLink(loc.name, regionName);
          locLink.classList.add(colorClass);
          locDiv.appendChild(locLink);

          // Add check button and check mark
          const checkBtn = document.createElement('button');
          checkBtn.classList.add('check-loc-btn');
          checkBtn.textContent = 'Check';
          checkBtn.style.display = isChecked ? 'none' : '';
          checkBtn.disabled = !canAccess;
          checkBtn.addEventListener('click', () => {
            if (canAccess && !isChecked && loc.item) {
              this.gameUI.inventoryUI.modifyItemCount(loc.item.name);
              stateManager.checkLocation(loc.name);
              this.renderAllRegions();
            }
          });
          locDiv.appendChild(checkBtn);

          if (isChecked) {
            const checkMark = document.createElement('span');
            checkMark.classList.add('check-mark');
            checkMark.textContent = '✓';
            locDiv.appendChild(checkMark);
          }

          if (loc.access_rule) {
            const logicTreeDiv = document.createElement('div');
            logicTreeDiv.classList.add('logic-tree');
            logicTreeDiv.appendChild(this.renderLogicTree(loc.access_rule));
            locDiv.appendChild(logicTreeDiv);
          }

          locContainer.appendChild(locDiv);
        });

        detailEl.appendChild(locContainer);
      }

      // Add Show Paths button at the bottom of the region details
      const pathsControlDiv = document.createElement('div');
      pathsControlDiv.classList.add('paths-control');
      pathsControlDiv.innerHTML = `
      <div class="paths-buttons">
        <button class="analyze-paths-btn">Analyze Paths</button>
        <span class="paths-count" style="display: none;"></span>
      </div>
    `;
      detailEl.appendChild(pathsControlDiv);

      // Add the paths container
      const pathsContainer = document.createElement('div');
      pathsContainer.classList.add('region-paths');
      pathsContainer.style.display = 'none';
      detailEl.appendChild(pathsContainer);

      // Comprehensive "Analyze Paths" button functionality
      const analyzePathsBtn =
        pathsControlDiv.querySelector('.analyze-paths-btn');
      const pathsCountSpan = pathsControlDiv.querySelector('.paths-count');

      // Set up the single unified button handler
      this.setupAnalyzePathsButton(
        analyzePathsBtn,
        pathsCountSpan,
        pathsContainer,
        regionName
      );

      // Append detailEl to regionBlock
      regionBlock.appendChild(detailEl);
    }

    return regionBlock;
  }

  /**
   * Comprehensive handler for the Analyze Paths button with toggle controls
   */
  setupAnalyzePathsButton(
    analyzePathsBtn,
    pathsCountSpan,
    pathsContainer,
    regionName
  ) {
    analyzePathsBtn.addEventListener('click', () => {
      // Clear existing analysis
      if (pathsContainer.style.display === 'block') {
        pathsContainer.style.display = 'none';
        pathsContainer.innerHTML = '';
        pathsCountSpan.style.display = 'none';
        analyzePathsBtn.textContent = 'Analyze Paths';

        const toggleContainer = document.querySelector('.path-toggle-controls');
        if (toggleContainer) toggleContainer.remove();

        return;
      }

      // Begin analysis
      analyzePathsBtn.textContent = 'Analyzing...';
      analyzePathsBtn.disabled = true;
      pathsContainer.style.display = 'block';

      // Add warning for potentially complex regions
      const regionData = stateManager.regions[regionName];
      if (regionData && Object.keys(stateManager.regions).length > 100) {
        const warningMessage = document.createElement('div');
        warningMessage.className = 'performance-warning';
        warningMessage.innerHTML = `
          <strong>⚠️ Performance Warning</strong>: This region is part of a complex world with many regions. 
          Path analysis may take longer than usual. Continue?
          <div class="warning-buttons">
            <button id="proceed-analysis" class="button">Proceed</button>
            <button id="cancel-analysis" class="button">Cancel</button>
          </div>
        `;

        pathsContainer.innerHTML = '';
        pathsContainer.appendChild(warningMessage);

        // Add event listeners for the warning buttons
        document
          .getElementById('proceed-analysis')
          .addEventListener('click', () => {
            // Continue with analysis, but with a lower path count limit
            this.performPathAnalysis(
              regionName,
              pathsContainer,
              pathsCountSpan,
              analyzePathsBtn,
              50
            ); // Lower max paths
          });

        document
          .getElementById('cancel-analysis')
          .addEventListener('click', () => {
            pathsContainer.style.display = 'none';
            pathsContainer.innerHTML = '';
            analyzePathsBtn.textContent = 'Analyze Paths';
            analyzePathsBtn.disabled = false;
          });

        return; // Exit early to show the warning first
      }

      // Normal case - proceed with analysis
      this.performPathAnalysis(
        regionName,
        pathsContainer,
        pathsCountSpan,
        analyzePathsBtn,
        100
      ); // Normal max paths
    });
  }

  /**
   * Perform the actual path analysis, extracted from setupAnalyzePathsButton
   * @param {string} regionName - Region name to analyze paths for
   * @param {HTMLElement} pathsContainer - Container to display paths in
   * @param {HTMLElement} pathsCountSpan - Element to display path counts
   * @param {HTMLElement} analyzePathsBtn - The button that triggered the analysis
   * @param {number} maxPaths - Maximum number of paths to find
   */
  performPathAnalysis(
    regionName,
    pathsContainer,
    pathsCountSpan,
    analyzePathsBtn,
    maxPaths
  ) {
    pathsContainer.innerHTML = '';

    // PHASE 1: Check actual reachability using stateManager
    const isRegionActuallyReachable =
      stateManager.isRegionReachable(regionName);

    // Create the status indicator first - this will appear at the top
    const statusIndicator = document.createElement('div');
    statusIndicator.classList.add('region-status-indicator');
    statusIndicator.style.marginBottom = '15px';
    statusIndicator.style.padding = '10px';
    statusIndicator.style.borderRadius = '4px';

    // Create containers for analysis results
    const requirementsDiv = document.createElement('div');
    requirementsDiv.classList.add('compiled-results-container');
    requirementsDiv.id = 'path-summary-section';
    requirementsDiv.innerHTML = '<h4>Path Requirements Analysis:</h4>';

    const pathsDiv = document.createElement('div');
    pathsDiv.classList.add('path-regions-container');

    // PHASE 2: Perform traditional path analysis
    const allPaths = this.findPathsToRegion(regionName, maxPaths);

    // Track path statistics
    let accessiblePathCount = 0;
    let canonicalPath = null; // Will store the first viable path found

    // Process all paths as before
    const allNodes = {
      primaryBlockers: [],
      secondaryBlockers: [],
      tertiaryBlockers: [],
      primaryRequirements: [],
      secondaryRequirements: [],
      tertiaryRequirements: [],
    };

    if (allPaths.length > 0) {
      // Process and analyze paths
      allPaths.forEach((path, pathIndex) => {
        const transitions = this._findAllTransitions(path);
        let pathHasIssues = false;

        // CRITICAL FIX: Check if this path is fully viable by ensuring every transition has at least one accessible exit
        for (const transition of transitions) {
          if (!transition.transitionAccessible) {
            pathHasIssues = true;
            break;
          }
        }

        if (!pathHasIssues) {
          accessiblePathCount++;
          if (!canonicalPath) {
            canonicalPath = path; // Store first viable path
          }
        }

        // Generate path element and add to container
        const pathEl = this._processPath(path, pathsDiv, allNodes, pathIndex);

        // If this is a viable path, mark it specially
        if (!pathHasIssues) {
          pathEl.classList.add('viable-path');
          pathEl.style.borderLeft = '3px solid #4caf50';
        }

        pathsDiv.appendChild(pathEl);
      });
    }

    // Set status indicator based on actual reachability and path analysis
    if (isRegionActuallyReachable) {
      if (accessiblePathCount > 0) {
        // Region is reachable and we found viable paths
        statusIndicator.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
        statusIndicator.style.border = '1px solid #4CAF50';
        statusIndicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: bold; color: #4CAF50;">✓ Region Reachable</span>
            <span>This region is reachable with ${accessiblePathCount} viable path(s).</span>
          </div>
        `;
      } else {
        // Region is reachable but our path analysis didn't find viable paths
        statusIndicator.style.backgroundColor = 'rgba(255, 152, 0, 0.2)';
        statusIndicator.style.border = '1px solid #FF9800';
        statusIndicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: bold; color: #FF9800;">⚠️ Algorithm Discrepancy</span>
            <span>This region is marked as reachable by stateManager, but no viable paths were found by path analysis. This suggests there may be special cases or complex rule interactions that the path finder doesn't handle correctly.</span>
          </div>
        `;
      }
    } else {
      // Region is not reachable
      statusIndicator.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
      statusIndicator.style.border = '1px solid #F44336';
      statusIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: bold; color: #F44336;">✗ Region Unreachable</span>
          <span>This region is currently unreachable. Review the paths below to understand what's blocking access.</span>
        </div>
      `;
    }

    // Add all sections to the container
    pathsContainer.appendChild(statusIndicator);
    pathsContainer.appendChild(requirementsDiv);

    // Only show toggle controls if we found paths
    if (allPaths.length > 0) {
      // Add toggle controls for filtering paths
      const toggleContainer = this._createToggleControls(pathsContainer);
      pathsContainer.appendChild(toggleContainer);
    }

    // Add paths visualization
    pathsContainer.appendChild(pathsDiv);

    // Show empty message if no paths found
    if (allPaths.length === 0) {
      const noPathsMessage = document.createElement('div');
      noPathsMessage.classList.add('empty-message');
      noPathsMessage.innerHTML = `
        <p>No paths were found to this region. This could be due to:</p>
        <ul>
          <li>The region requires items or abilities we don't have</li>
          <li>The region has a non-standard access mechanism</li>
          <li>There's a bug in the path-finding algorithm</li>
        </ul>
      `;
      pathsDiv.appendChild(noPathsMessage);

      // Try to provide more details about why no paths were found
      this._analyzeDirectConnections(regionName, pathsDiv);
    }

    // Display paths count
    if (allPaths.length > 0) {
      pathsCountSpan.textContent = `(${allPaths.length} paths)`;
      pathsCountSpan.style.display = 'inline';
    }

    // Populate the requirements analysis section
    this.displayCompiledList(allNodes, requirementsDiv);

    // Only do this if we found at least one path
    if (allPaths.length > 0) {
      // Create show/hide all buttons
      const expandCollapseDiv = document.createElement('div');
      expandCollapseDiv.style.display = 'flex';
      expandCollapseDiv.style.justifyContent = 'flex-end';
      expandCollapseDiv.style.marginBottom = '10px';
      expandCollapseDiv.style.gap = '5px';

      const showAllBtn = document.createElement('button');
      showAllBtn.className = 'show-exit-rules-btn';
      showAllBtn.textContent = 'Show All Rules';
      showAllBtn.addEventListener('click', () => {
        document
          .querySelectorAll('.path-exit-rule-container')
          .forEach((container) => {
            container.style.display = 'block';
          });
      });

      const hideAllBtn = document.createElement('button');
      hideAllBtn.className = 'show-exit-rules-btn';
      hideAllBtn.textContent = 'Hide All Rules';
      hideAllBtn.addEventListener('click', () => {
        document
          .querySelectorAll('.path-exit-rule-container')
          .forEach((container) => {
            container.style.display = 'none';
          });
      });

      expandCollapseDiv.appendChild(showAllBtn);
      expandCollapseDiv.appendChild(hideAllBtn);
      pathsContainer.insertBefore(expandCollapseDiv, pathsDiv);
    }

    // Wait until the first paint to display sorted buttons to avoid layout thrashing
    requestAnimationFrame(() => {
      // Restore the button
      analyzePathsBtn.textContent = 'Clear Analysis';
      analyzePathsBtn.disabled = false;
    });
  }

  /**
   * Enhanced toggle controls that include entrance paths section
   */
  _createToggleControls(container) {
    const toggleContainer = document.createElement('div');
    toggleContainer.classList.add('path-toggle-controls');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.gap = '10px';
    toggleContainer.style.marginBottom = '15px';
    toggleContainer.style.flexWrap = 'wrap';

    const toggles = [
      {
        id: 'toggle-summary',
        initialText: 'Hide Summary',
        selector: '#path-summary-section',
        showText: 'Show Summary',
        hideText: 'Hide Summary',
      },
      {
        id: 'toggle-passing-exits',
        initialText: 'Hide Passing Exits',
        selector: '.passing-exit',
        showText: 'Show Passing Exits',
        hideText: 'Hide Passing Exits',
      },
      {
        id: 'toggle-failing-exits',
        initialText: 'Hide Failing Exits',
        selector: '.failing-exit',
        showText: 'Show Failing Exits',
        hideText: 'Hide Failing Exits',
      },
    ];

    // Create each toggle button
    toggles.forEach((toggle) => {
      const button = document.createElement('button');
      button.id = toggle.id;
      button.textContent = toggle.initialText;
      button.style.padding = '5px 10px';
      button.style.backgroundColor = '#333';
      button.style.color = '#fff';
      button.style.border = '1px solid #666';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';

      // Set up the toggle functionality
      let isHidden = false;
      button.addEventListener('click', () => {
        isHidden = !isHidden;
        button.textContent = isHidden ? toggle.showText : toggle.hideText;

        // Toggle visibility of the targeted elements
        const elements = document.querySelectorAll(toggle.selector);
        elements.forEach((el) => {
          el.style.display = isHidden ? 'none' : 'block';
        });
      });

      toggleContainer.appendChild(button);
    });

    // Add toggle for showing viable paths first
    const viablePathsToggle = document.createElement('button');
    viablePathsToggle.id = 'toggle-viable-paths-first';
    viablePathsToggle.textContent = 'Show Viable Paths First';
    viablePathsToggle.style.padding = '5px 10px';
    viablePathsToggle.style.backgroundColor = '#4caf50'; // Green to indicate it's active
    viablePathsToggle.style.color = '#fff';
    viablePathsToggle.style.border = '1px solid #666';
    viablePathsToggle.style.borderRadius = '4px';
    viablePathsToggle.style.cursor = 'pointer';

    let viablePathsFirst = true; // Start with viable paths first

    viablePathsToggle.addEventListener('click', () => {
      viablePathsFirst = !viablePathsFirst;
      viablePathsToggle.textContent = viablePathsFirst
        ? 'Show Viable Paths First'
        : 'Show Original Order';
      viablePathsToggle.style.backgroundColor = viablePathsFirst
        ? '#4caf50'
        : '#333';

      // Get all path elements
      const pathsContainer = document.querySelector('.path-regions-container');
      if (!pathsContainer) return;

      const pathElements = Array.from(
        pathsContainer.querySelectorAll('.region-path')
      );
      const derivedPathEl = pathsContainer.querySelector(
        '.derived-canonical-path'
      );

      // Sort based on preference
      if (viablePathsFirst) {
        pathElements.sort((a, b) => {
          const aIsViable = a.classList.contains('viable-path');
          const bIsViable = b.classList.contains('viable-path');
          return bIsViable - aIsViable; // Viable paths first
        });
      } else {
        // Reset to original order - this requires adding a data attribute with original index
        pathElements.sort((a, b) => {
          return (
            parseInt(a.dataset.originalIndex || '0') -
            parseInt(b.dataset.originalIndex || '0')
          );
        });
      }

      // Remove existing elements
      pathElements.forEach((el) => el.remove());

      // Re-append in new order
      const headerElement = pathsContainer.querySelector('h4');
      if (headerElement) {
        const insertPoint = headerElement.nextSibling;

        // Put derived path first if it exists
        if (derivedPathEl) {
          pathsContainer.insertBefore(derivedPathEl, insertPoint);
        }
      }

      // Then add sorted paths
      pathElements.forEach((el) => {
        pathsContainer.appendChild(el);
      });
    });

    toggleContainer.appendChild(viablePathsToggle);

    // Add "Collapse All" button for path details
    const collapseAllButton = document.createElement('button');
    collapseAllButton.id = 'toggle-collapse-all';
    collapseAllButton.textContent = 'Collapse All';
    collapseAllButton.style.padding = '5px 10px';
    collapseAllButton.style.backgroundColor = '#333';
    collapseAllButton.style.color = '#fff';
    collapseAllButton.style.border = '1px solid #666';
    collapseAllButton.style.borderRadius = '4px';
    collapseAllButton.style.cursor = 'pointer';

    let allCollapsed = false;
    collapseAllButton.addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      collapseAllButton.textContent = allCollapsed
        ? 'Expand All'
        : 'Collapse All';

      // Get all exit rule containers
      const exitContainers = document.querySelectorAll('.path-exit-rules');
      exitContainers.forEach((container) => {
        container.style.display = allCollapsed ? 'none' : 'block';
      });

      // Update all toggle indicators
      const indicators = document.querySelectorAll('.path-toggle-indicator');
      indicators.forEach((indicator) => {
        indicator.textContent = allCollapsed ? '►' : '▼';
      });
    });

    toggleContainer.appendChild(collapseAllButton);

    container.insertBefore(toggleContainer, container.firstChild);
  }

  /**
   * Finds paths to a region that use entrances (incoming connections)
   * This complements the existing path finder which only uses exits
   *
   * @param {string} targetRegion - The region to find paths to
   * @returns {Array} - Array of entrance paths that lead to the target region
   */
  // findEntrancePathsToRegion method has been removed to align with exit-only approach

  /**
   * Find all transitions in a path, including blocked and open transitions
   * @param {Array<string>} path - Array of region names
   * @returns {Array<Object>} - Array of transition objects
   */
  _findAllTransitions(path) {
    const transitions = [];

    for (let i = 0; i < path.length - 1; i++) {
      const fromRegion = path[i];
      const toRegion = path[i + 1];

      const fromAccessible = stateManager.isRegionReachable(fromRegion);
      const toAccessible = stateManager.isRegionReachable(toRegion);

      // Get the region data
      const fromRegionData = stateManager.regions[fromRegion];
      if (!fromRegionData || !fromRegionData.exits) continue;

      // Find ALL exits that connect these regions
      const availableExits = fromRegionData.exits.filter(
        (e) => e.connected_region === toRegion
      );

      if (availableExits.length === 0) continue;

      // Log what we found for debugging
      console.log(
        `Transition ${fromRegion} → ${toRegion}: Found ${availableExits.length} exits`
      );

      // Evaluate all exits to determine if ANY are accessible
      const accessibleExits = availableExits.filter(
        (exit) => !exit.access_rule || evaluateRule(exit.access_rule)
      );

      // Log the accessible exits
      console.log(
        `Transition ${fromRegion} → ${toRegion}: ${accessibleExits.length} accessible exits:`,
        accessibleExits.map((e) => e.name)
      );

      // The transition is accessible if ANY exit is accessible
      const transitionAccessible = accessibleExits.length > 0;

      // Add this transition to our list
      transitions.push({
        fromRegion,
        toRegion,
        exits: availableExits,
        isBlocking: fromAccessible && !toAccessible,
        // The transition is accessible if ANY exit is accessible
        transitionAccessible: transitionAccessible,
      });
    }

    // Add this to the end of the _findAllTransitions method, just before returning transitions
    console.log('Path transitions debug:');
    transitions.forEach((t) => {
      console.log(
        `Transition ${t.fromRegion} → ${t.toRegion}:`,
        `Accessible: ${t.transitionAccessible}`,
        `Exits: ${t.exits.length}`,
        `Accessible exits: ${
          t.exits.filter((e) => !e.access_rule || evaluateRule(e.access_rule))
            .length
        }`
      );
    });

    return transitions;
  }

  /**
   * Log debug information during region accessibility calculations
   * @private
   */
  _logDebug(message, data = null) {
    if (this.debugMode) {
      const logMsg = `[RegionUI] ${message}`;
      if (data !== null) {
        console.log(logMsg, data);
      } else {
        console.log(logMsg);
      }
    }
  }

  /**
   * Debug a specific transition between two regions
   * @param {Array<Object>} transitions - List of transitions
   * @param {string} fromRegion - Starting region name
   * @param {string} toRegion - Destination region name
   * @returns {Object|null} - The transition object if found
   * @private
   */
  _debugTransition(transitions, fromRegion, toRegion) {
    const transition = transitions.find(
      (t) => t.fromRegion === fromRegion && t.toRegion === toRegion
    );

    if (!transition) {
      console.log(
        `DEBUG: No transition found from ${fromRegion} to ${toRegion}`
      );
      return;
    }

    console.log(`DEBUG: Transition ${fromRegion} → ${toRegion}:`);
    console.log(
      `  Marked as: ${
        transition.transitionAccessible ? 'ACCESSIBLE' : 'INACCESSIBLE'
      }`
    );
    console.log(`  Exits count: ${transition.exits.length}`);

    transition.exits.forEach((exit, i) => {
      const accessible = !exit.access_rule || evaluateRule(exit.access_rule);
      console.log(
        `  Exit ${i + 1}/${transition.exits.length}: ${exit.name} - ${
          accessible ? 'ACCESSIBLE' : 'INACCESSIBLE'
        }`
      );
    });

    return transition;
  }

  /**
   * Analyze all direct connections to a region
   * @private
   */
  _analyzeDirectConnections(regionName, container) {
    const allNodes = {
      primaryBlockers: [],
      secondaryBlockers: [],
      tertiaryBlockers: [],
      primaryRequirements: [],
      secondaryRequirements: [],
      tertiaryRequirements: [],
    };

    const regionData = stateManager.regions[regionName];

    // 1. Analyze region's own rules
    if (regionData?.region_rules?.length > 0) {
      const rulesContainer = document.createElement('div');
      rulesContainer.innerHTML = '<h5>Region Rules:</h5>';
      container.appendChild(rulesContainer);

      regionData.region_rules.forEach((rule, idx) => {
        if (!rule) return;

        const ruleDiv = document.createElement('div');
        ruleDiv.style.marginLeft = '20px';
        ruleDiv.style.marginBottom = '10px';

        const ruleElement = this.renderLogicTree(rule);
        ruleDiv.appendChild(ruleElement);
        rulesContainer.appendChild(ruleDiv);

        // Analyze nodes
        const nodeResults = this.extractCategorizedNodes(ruleElement);
        Object.keys(allNodes).forEach((key) => {
          allNodes[key].push(...nodeResults[key]);
        });
      });
    }

    // 2. Analyze entrances to this region
    const entrancesContainer = document.createElement('div');
    entrancesContainer.innerHTML = '<h5>Entrances to this region:</h5>';
    let entranceCount = 0;

    Object.entries(stateManager.regions).forEach(
      ([otherRegionName, otherRegionData]) => {
        if (otherRegionName === regionName) return;

        if (otherRegionData.exits) {
          const entrances = otherRegionData.exits.filter(
            (exit) => exit.connected_region === regionName && exit.access_rule
          );

          if (entrances.length > 0) {
            entrances.forEach((entrance) => {
              entranceCount++;

              const entranceDiv = document.createElement('div');
              entranceDiv.style.marginLeft = '20px';
              entranceDiv.style.marginBottom = '15px';

              // Create header for this entrance
              const header = document.createElement('div');
              header.innerHTML = `<strong>From ${otherRegionName}:</strong> ${entrance.name}`;
              entranceDiv.appendChild(header);

              // Show the rule
              const ruleElement = this.renderLogicTree(entrance.access_rule);
              entranceDiv.appendChild(ruleElement);
              entrancesContainer.appendChild(entranceDiv);

              // Analyze nodes
              const nodeResults = this.extractCategorizedNodes(ruleElement);
              Object.keys(allNodes).forEach((key) => {
                allNodes[key].push(...nodeResults[key]);
              });
            });
          }
        }
      }
    );

    if (entranceCount > 0) {
      container.appendChild(entrancesContainer);
    } else {
      entrancesContainer.innerHTML += '<p>No entrances with rules found.</p>';
      container.appendChild(entrancesContainer);
    }

    // 3. Display requirement analysis
    const requirementsDiv = document.createElement('div');
    requirementsDiv.classList.add('compiled-results-container');
    requirementsDiv.innerHTML = '<h4>Requirements Analysis:</h4>';
    this.displayCompiledList(allNodes, requirementsDiv);

    // Insert requirements at the top
    container.insertBefore(requirementsDiv, container.firstChild);
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

  renderLogicTree(rule) {
    const root = document.createElement('div');
    root.classList.add('logic-node');

    if (!rule) {
      root.textContent = '(no rule)';
      return root;
    }

    const result = evaluateRule(rule);
    root.classList.toggle('pass', !!result);
    root.classList.toggle('fail', !result);

    // Add colorblind symbol if colorblind mode is enabled
    if (this.colorblindMode) {
      const symbolSpan = document.createElement('span');
      symbolSpan.classList.add('colorblind-symbol');

      if (result) {
        symbolSpan.textContent = '✓ ';
        symbolSpan.classList.add('accessible');
      } else {
        symbolSpan.textContent = '✗ ';
        symbolSpan.classList.add('inaccessible');
      }

      root.appendChild(symbolSpan);
    }

    const label = document.createElement('div');
    label.classList.add('logic-label');
    label.textContent = `Type: ${rule.type}`;
    root.appendChild(label);

    switch (rule.type) {
      case 'constant':
        root.appendChild(document.createTextNode(` value: ${rule.value}`));
        break;
      case 'item_check':
        root.appendChild(document.createTextNode(` item: ${rule.item}`));
        break;
      case 'count_check':
        root.appendChild(
          document.createTextNode(` ${rule.item} >= ${rule.count}`)
        );
        break;
      case 'group_check':
        root.appendChild(document.createTextNode(` group: ${rule.group}`));
        break;
      case 'helper':
        root.appendChild(
          document.createTextNode(
            ` helper: ${rule.name}, args: ${JSON.stringify(rule.args)}`
          )
        );
        break;
      case 'and':
      case 'or': {
        const ul = document.createElement('ul');
        rule.conditions.forEach((cond) => {
          const li = document.createElement('li');
          li.appendChild(this.renderLogicTree(cond));
          ul.appendChild(li);
        });
        root.appendChild(ul);
        break;
      }
      case 'state_method':
        root.appendChild(
          document.createTextNode(
            ` method: ${rule.method}, args: ${JSON.stringify(rule.args)}`
          )
        );
        break;
      default:
        root.appendChild(document.createTextNode(' [unhandled rule type] '));
    }
    return root;
  }

  /**
   * Extract categorized leaf nodes from a logic tree element
   * @param {HTMLElement} treeElement - The logic tree DOM element to analyze
   * @return {Object} - Object containing the categorized node lists
   */
  extractCategorizedNodes(treeElement) {
    // Initialize result categories with the six new categories
    const nodes = {
      primaryBlockers: [],
      secondaryBlockers: [],
      tertiaryBlockers: [],
      primaryRequirements: [],
      secondaryRequirements: [],
      tertiaryRequirements: [],
    };

    // Check if this is a failing or passing node
    const isFailing = treeElement.classList.contains('fail');
    const isPassing = treeElement.classList.contains('pass');

    // Get the current tree evaluation result
    const treeEvaluationResult = isPassing;

    // Process based on node type
    const nodeType = this.getNodeType(treeElement);

    if (nodeType && this.isLeafNodeType(nodeType)) {
      // This is a leaf node, extract its data
      const nodeData = this.extractNodeData(treeElement, nodeType);

      if (nodeData) {
        // Categorize the node based on the new algorithm
        if (isFailing) {
          if (treeEvaluationResult) {
            // Tree already passes despite this node's failure - Tertiary blocker
            nodes.tertiaryBlockers.push(nodeData);
          } else {
            // Calculate what would happen if this node passed instead
            const hypotheticalResult = this.evaluateTreeWithNodeFlipped(
              treeElement,
              true
            );

            if (hypotheticalResult) {
              // Tree would pass if this node passed - Primary blocker
              nodes.primaryBlockers.push(nodeData);
            } else {
              // Tree would still fail - Secondary blocker
              nodes.secondaryBlockers.push(nodeData);
            }
          }
        } else if (isPassing) {
          if (!treeEvaluationResult) {
            // Tree already fails despite this node's passing - Tertiary requirement
            nodes.tertiaryRequirements.push(nodeData);
          } else {
            // Calculate what would happen if this node failed instead
            const hypotheticalResult = this.evaluateTreeWithNodeFlipped(
              treeElement,
              false
            );

            if (!hypotheticalResult) {
              // Tree would fail if this node failed - Primary requirement
              nodes.primaryRequirements.push(nodeData);
            } else {
              // Tree would still pass - Secondary requirement
              nodes.secondaryRequirements.push(nodeData);
            }
          }
        }
      }
    } else {
      // For non-leaf nodes, recursively check children
      const childLists = treeElement.querySelectorAll('ul');
      childLists.forEach((ul) => {
        ul.querySelectorAll('li').forEach((li) => {
          if (li.firstChild) {
            const childResults = this.extractCategorizedNodes(li.firstChild);
            // Merge results
            Object.keys(nodes).forEach((key) => {
              nodes[key].push(...childResults[key]);
            });
          }
        });
      });
    }

    return nodes;
  }

  /**
   * Evaluates what the tree result would be if a specific node's value was flipped
   * @param {HTMLElement} nodeElement - The node to flip
   * @param {boolean} newValue - The new value to assume for this node
   * @return {boolean} - The hypothetical tree evaluation result
   */
  evaluateTreeWithNodeFlipped(nodeElement, newValue) {
    // Find the root node of the tree
    let root = nodeElement;
    let parent = root.parentElement;

    while (parent) {
      if (
        parent.classList &&
        (parent.classList.contains('logic-tree') || parent.tagName === 'BODY')
      ) {
        break;
      }
      if (
        parent.classList &&
        (parent.classList.contains('pass') || parent.classList.contains('fail'))
      ) {
        root = parent;
      }
      parent = parent.parentElement;
    }

    // Now simulate evaluation with the flipped node
    return this.simulateEvaluation(root, nodeElement, newValue);
  }

  /**
   * Simulates rule evaluation with a specific node's value flipped
   * @param {HTMLElement} currentNode - Current node in the tree traversal
   * @param {HTMLElement} targetNode - The node to flip
   * @param {boolean} newTargetValue - The new value for the target node
   * @return {boolean} - The simulated evaluation result
   */
  simulateEvaluation(currentNode, targetNode, newTargetValue) {
    // If this is the target node, return the flipped value
    if (currentNode === targetNode) {
      return newTargetValue;
    }

    // Otherwise, evaluate based on the node type
    const nodeType = this.getNodeType(currentNode);
    if (!nodeType) return false;

    switch (nodeType) {
      case 'constant':
      case 'item_check':
      case 'count_check':
      case 'group_check':
      case 'helper':
      case 'state_method':
        // For leaf nodes, return their actual value unless they're the target
        return currentNode.classList.contains('pass');

      case 'and': {
        // For AND nodes, check all children - all must be true
        const childResults = [];
        const childLists = currentNode.querySelectorAll('ul');
        childLists.forEach((ul) => {
          ul.querySelectorAll('li').forEach((li) => {
            if (li.firstChild) {
              childResults.push(
                this.simulateEvaluation(
                  li.firstChild,
                  targetNode,
                  newTargetValue
                )
              );
            }
          });
        });
        return childResults.every(Boolean);
      }

      case 'or': {
        // For OR nodes, check all children - at least one must be true
        const childResults = [];
        const childLists = currentNode.querySelectorAll('ul');
        childLists.forEach((ul) => {
          ul.querySelectorAll('li').forEach((li) => {
            if (li.firstChild) {
              childResults.push(
                this.simulateEvaluation(
                  li.firstChild,
                  targetNode,
                  newTargetValue
                )
              );
            }
          });
        });
        return childResults.some(Boolean);
      }

      default:
        return false;
    }
  }

  /**
   * Determines the type of a logic node from its DOM element
   * @param {HTMLElement} element - The DOM element representing a logic node
   * @return {string|null} - The type of the logic node or null if not found
   */
  getNodeType(element) {
    const logicLabel = element.querySelector('.logic-label');
    if (logicLabel) {
      const typeMatch = logicLabel.textContent.match(/Type: (\w+)/);
      if (typeMatch && typeMatch[1]) {
        return typeMatch[1];
      }
    }
    return null;
  }

  /**
   * Checks if a node type is a leaf node type
   * @param {string} nodeType - The type of the logic node
   * @return {boolean} - True if it's a leaf node type, false otherwise
   */
  isLeafNodeType(nodeType) {
    return [
      'constant',
      'item_check',
      'count_check',
      'group_check',
      'helper',
      'state_method',
    ].includes(nodeType);
  }

  /**
   * Deduplicates a list of nodes, treating functions with different args as unique
   * @param {Array} nodes - List of nodes to deduplicate
   * @return {Array} - Deduplicated list
   */
  deduplicateNodes(nodes) {
    const uniqueNodes = [];
    const seenIdentifiers = new Set();

    nodes.forEach((node) => {
      // Create an identifier that includes function arguments if present
      let identifier = node.identifier;

      // If this is a helper node or state_method node with args, include them in the identifier
      if (
        (node.type === 'helper' || node.type === 'state_method') &&
        node.args
      ) {
        // Use a consistent string representation of the args
        const argsString =
          typeof node.args === 'string' ? node.args : JSON.stringify(node.args);

        identifier = `${identifier}:${argsString}`;
      }

      if (!seenIdentifiers.has(identifier)) {
        seenIdentifiers.add(identifier);
        uniqueNodes.push(node);
      }
    });

    return uniqueNodes;
  }

  /**
   * Extract data from nodes, ensuring function arguments are properly captured
   */
  extractNodeData(element, nodeType) {
    const textContent = element.textContent;
    const isFailing = element.classList.contains('fail');
    // Default display color - red for failing nodes, green for passing nodes
    const displayColor = isFailing ? '#f44336' : '#4caf50';

    switch (nodeType) {
      case 'constant':
        const valueMatch = textContent.match(/value: (true|false)/i);
        if (valueMatch) {
          return {
            type: 'constant',
            value: valueMatch[1].toLowerCase() === 'true',
            display: `Constant: ${valueMatch[1]}`,
            displayElement: this._createNodeDisplay(
              'Constant:',
              valueMatch[1],
              displayColor
            ),
            identifier: `constant_${valueMatch[1]}`,
          };
        }
        break;

      case 'item_check':
        const itemMatch = textContent.match(
          /item: ([^,]+?)($|\s(?:Type:|helper:|method:|group:))/
        );
        if (itemMatch) {
          const itemName = itemMatch[1].trim();
          return {
            type: 'item_check',
            item: itemName,
            display: `Need item: ${itemName}`,
            displayElement: this._createNodeDisplay(
              'Need item:',
              itemName,
              displayColor
            ),
            identifier: `item_${itemName}`,
          };
        }
        break;

      case 'count_check':
        const countMatch = textContent.match(/(\w+) >= (\d+)/);
        if (countMatch) {
          return {
            type: 'count_check',
            item: countMatch[1],
            count: parseInt(countMatch[2], 10),
            display: `Need ${countMatch[2]}× ${countMatch[1]}`,
            displayElement: this._createNodeDisplay(
              `Need ${countMatch[2]}×`,
              countMatch[1],
              displayColor
            ),
            identifier: `count_${countMatch[1]}_${countMatch[2]}`,
          };
        }
        break;

      case 'group_check':
        const groupMatch = textContent.match(
          /group: ([^,]+?)($|\s(?:Type:|helper:|method:|item:))/
        );
        if (groupMatch) {
          const groupName = groupMatch[1].trim();
          return {
            type: 'group_check',
            group: groupName,
            display: `Need group: ${groupName}`,
            displayElement: this._createNodeDisplay(
              'Need group:',
              groupName,
              displayColor
            ),
            identifier: `group_${groupName}`,
          };
        }
        break;

      case 'helper':
        // Extract both the helper name and its arguments
        const helperMatch = textContent.match(
          /helper: ([^,]+?), args: (\[.*\]|\{.*\}|".*?"|null|\d+)/
        );
        if (helperMatch) {
          const helperName = helperMatch[1].trim();
          const helperArgs = helperMatch[2].trim();

          // Create the base display text and element with colored function name
          const displayElement = this._createNodeDisplay(
            'Helper function:',
            helperName,
            displayColor
          );

          // Add formatted arguments (as DOM elements)
          const argsElement = this.formatArguments(helperArgs);
          if (argsElement) {
            displayElement.appendChild(argsElement);
          }

          return {
            type: 'helper',
            name: helperName,
            args: helperArgs, // Save raw args string for deduplication
            display:
              `Helper function: ${helperName}` + (argsElement ? ' (...)' : ''),
            displayElement: displayElement,
            identifier: `helper_${helperName}`, // Base identifier, args handled in deduplication
          };
        }
        break;

      case 'state_method':
        // Extract both the method name and its arguments
        const methodMatch = textContent.match(
          /method: ([^,]+?), args: (\[.*\]|\{.*\}|".*?"|null|\d+)/
        );
        if (methodMatch) {
          const methodName = methodMatch[1].trim();
          const methodArgs = methodMatch[2].trim();

          // Create the base display text and element with colored method name
          const displayElement = this._createNodeDisplay(
            'State method:',
            methodName,
            displayColor
          );

          // Add formatted arguments (as DOM elements)
          const argsElement = this.formatArguments(methodArgs);
          if (argsElement) {
            displayElement.appendChild(argsElement);
          }

          return {
            type: 'state_method',
            method: methodName,
            args: methodArgs, // Save raw args string for deduplication
            display:
              `State method: ${methodName}` + (argsElement ? ' (...)' : ''),
            displayElement: displayElement,
            identifier: `method_${methodName}`, // Base identifier, args handled in deduplication
          };
        }
        break;
    }

    return null;
  }

  /**
   * Create a display element with label text and colored value
   * @param {string} label - The label text (e.g., "Need item:")
   * @param {string} value - The value to display (e.g., "Moon Pearl")
   * @param {string} valueColor - The color for the value
   * @returns {HTMLElement} - The created display element
   * @private
   */
  _createNodeDisplay(label, value, valueColor) {
    const container = document.createElement('span');

    // Add the label in white color
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${label} `;
    labelSpan.style.color = '#e0e0e0'; // White-ish color for labels
    container.appendChild(labelSpan);

    // Add the value with the specified color
    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    valueSpan.style.color = valueColor;
    container.appendChild(valueSpan);

    return container;
  }

  /**
   * Format arguments for display in a user-friendly way
   * @param {String} argsString - JSON string of arguments
   * @return {HTMLElement|null} - DOM element containing formatted arguments or null if no args
   */
  formatArguments(argsString) {
    try {
      // Handle empty args
      if (argsString === '[]' || argsString === '{}') {
        return null;
      }

      // Try to parse the JSON
      let args;
      try {
        args = JSON.parse(argsString);
      } catch (e) {
        // If parsing fails, return a simple text node with the raw string
        const span = document.createElement('span');
        span.textContent = ` (${argsString})`;
        span.style.color = '#e0e0e0'; // Light gray color for better visibility
        return span;
      }

      // Create a container for the arguments
      const container = document.createElement('span');
      container.textContent = ' (';
      container.style.color = '#e0e0e0'; // Light gray color for better visibility

      if (Array.isArray(args)) {
        if (args.length === 0) return null;

        // Process each argument
        args.forEach((arg, index) => {
          if (index > 0) {
            const comma = document.createTextNode(', ');
            container.appendChild(comma);
          }

          // Check if the argument is a potential region name (string)
          if (typeof arg === 'string') {
            this._appendPossibleRegionLink(container, arg);
          } else {
            // For non-string values, use appropriate colors
            const textNode = document.createTextNode(JSON.stringify(arg));
            const span = document.createElement('span');

            // Color code based on value type
            if (typeof arg === 'number') {
              span.style.color = '#ffcf40'; // Gold color for numbers
            } else if (typeof arg === 'boolean') {
              span.style.color = arg ? '#80c080' : '#c08080'; // Green for true, red for false
            } else {
              span.style.color = '#c0c0ff'; // Light blue for other types
            }

            span.appendChild(textNode);
            container.appendChild(span);
          }
        });
      } else if (typeof args === 'object' && args !== null) {
        const entries = Object.entries(args);
        if (entries.length === 0) return null;

        // Process each key-value pair
        entries.forEach(([key, value], index) => {
          if (index > 0) {
            const comma = document.createTextNode(', ');
            container.appendChild(comma);
          }

          // Add the key with a specific color
          const keyNode = document.createTextNode(`${key}: `);
          const keySpan = document.createElement('span');
          keySpan.style.color = '#a0a0a0'; // Gray for keys
          keySpan.appendChild(keyNode);
          container.appendChild(keySpan);

          // Check if the value is a potential region name (string)
          if (typeof value === 'string') {
            this._appendPossibleRegionLink(container, value);
          } else {
            // For non-string values, use appropriate colors
            const textNode = document.createTextNode(JSON.stringify(value));
            const span = document.createElement('span');

            // Color code based on value type
            if (typeof value === 'number') {
              span.style.color = '#ffcf40'; // Gold color for numbers
            } else if (typeof value === 'boolean') {
              span.style.color = value ? '#80c080' : '#c08080'; // Green for true, red for false
            } else {
              span.style.color = '#c0c0ff'; // Light blue for other types
            }

            span.appendChild(textNode);
            container.appendChild(span);
          }
        });
      } else {
        // For primitive values
        if (typeof args === 'string') {
          this._appendPossibleRegionLink(container, args);
        } else {
          const textNode = document.createTextNode(args);
          const span = document.createElement('span');

          // Color code based on value type
          if (typeof args === 'number') {
            span.style.color = '#ffcf40'; // Gold color for numbers
          } else if (typeof args === 'boolean') {
            span.style.color = args ? '#80c080' : '#c08080'; // Green for true, red for false
          } else {
            span.style.color = '#c0c0ff'; // Light blue for other types
          }

          span.appendChild(textNode);
          container.appendChild(span);
        }
      }

      // Add closing parenthesis
      container.appendChild(document.createTextNode(')'));

      return container;
    } catch (e) {
      // If any error occurs in formatting, return a simple text node
      console.error('Error formatting arguments:', e);
      const span = document.createElement('span');
      span.textContent = ` (${argsString})`;
      span.style.color = '#e0e0e0'; // Light gray color for better visibility
      return span;
    }
  }

  /**
   * Helper function to check if a string is a region name and create a link if it is
   * @param {HTMLElement} container - The container to append to
   * @param {string} text - The text to check
   * @private
   */
  _appendPossibleRegionLink(container, text) {
    // Get the list of all known regions from stateManager.regions (not getRegions)
    const allRegions = Object.keys(stateManager.regions || {});

    // Check if the text matches a known region name
    if (allRegions.includes(text)) {
      // Check accessibility for color coding
      const regionAccessible = stateManager.isRegionReachable(text);

      // Create a span with appropriate styling
      const regionSpan = document.createElement('span');
      regionSpan.textContent = text;
      regionSpan.classList.add('region-link');
      regionSpan.dataset.region = text;
      regionSpan.style.color = regionAccessible ? '#4caf50' : '#f44336';
      regionSpan.style.cursor = 'pointer';
      regionSpan.style.textDecoration = 'underline';
      regionSpan.title = `Click to view the ${text} region`;

      // Store a reference to this (RegionUI instance)
      const self = this;

      // Create a proper event listener
      regionSpan.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Find the closest region-container to get the RegionUI instance
        const regionContainer = document.querySelector('.regions-container');
        if (regionContainer && regionContainer._regionUI) {
          regionContainer._regionUI.navigateToRegion(text);
        } else if (window.regionUI) {
          // Try global regionUI if available
          window.regionUI.navigateToRegion(text);
        } else if (self && typeof self.navigateToRegion === 'function') {
          // Try this instance if available
          self.navigateToRegion(text);
        } else {
          console.error('Could not find RegionUI instance to navigate');
        }

        return false;
      });

      container.appendChild(regionSpan);
    } else {
      // Not a region, use an appropriate color for string values
      const textNode = document.createTextNode(text);
      const span = document.createElement('span');
      span.style.color = '#c0ffff'; // Cyan color for strings
      span.appendChild(textNode);
      container.appendChild(span);
    }
  }

  /**
   * Checks if a node is in an OR branch
   * @param {HTMLElement} element - The element to check
   * @return {boolean} - True if the node is in an OR branch
   */
  isInOrBranch(element) {
    // Check parent nodes for an OR operator
    let current = element;
    while (current) {
      // Go up to the li if we're on a div
      if (current.tagName !== 'LI') {
        current = current.parentElement;
        continue;
      }

      // Check if the parent ul is under an OR node
      const parentUl = current.parentElement;
      if (parentUl && parentUl.tagName === 'UL') {
        const orNode = parentUl.parentElement;
        if (orNode) {
          const nodeType = this.getNodeType(orNode);
          if (nodeType === 'or') {
            return true;
          }
        }
      }

      current = current.parentElement;
    }

    return false;
  }

  /**
   * Checks if the node has any passing siblings
   * @param {HTMLElement} element - The element to check
   * @return {boolean} - True if the node has passing siblings
   */
  hasPassingSibling(element) {
    // Find the parent li element
    let currentElement = element;
    while (currentElement && currentElement.tagName !== 'LI') {
      currentElement = currentElement.parentElement;
    }

    if (!currentElement) return false;

    // Get the parent ul
    const parentUl = currentElement.parentElement;
    if (!parentUl) return false;

    // Check if any siblings have a passing class
    const siblings = parentUl.querySelectorAll('li > div.logic-node');
    for (const sibling of siblings) {
      if (sibling !== element && sibling.classList.contains('pass')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if the node is the only failing node in its context
   * @param {HTMLElement} element - The element to check
   * @return {boolean} - True if the node is a solo blocker
   */
  isSoloBlocker(element) {
    // Find the topmost parent with the 'fail' class
    let current = element;
    let parent = current.parentElement;
    while (parent) {
      // Go up until we find a node with pass class or reach the top
      if (parent.classList && parent.classList.contains('pass')) {
        break;
      }

      if (parent.classList && parent.classList.contains('fail')) {
        current = parent;
      }

      parent = parent.parentElement;
    }

    // Now count the number of failing leaf nodes in this subtree
    const failingLeafNodes = this.countFailingLeafNodes(current);
    return failingLeafNodes === 1;
  }

  /**
   * Counts the number of failing leaf nodes in a tree
   * @param {HTMLElement} element - The root element to check
   * @return {number} - The count of failing leaf nodes
   */
  countFailingLeafNodes(element) {
    let count = 0;

    // Check if this is a failing leaf node
    if (element.classList.contains('fail')) {
      const nodeType = this.getNodeType(element);
      if (nodeType && this.isLeafNodeType(nodeType)) {
        return 1;
      }
    }

    // Recursively check children
    const childLists = element.querySelectorAll('ul');
    childLists.forEach((ul) => {
      ul.querySelectorAll('li').forEach((li) => {
        if (li.firstChild) {
          count += this.countFailingLeafNodes(li.firstChild);
        }
      });
    });

    return count;
  }

  /**
   * Checks if a passing node is critical (if it failed, would the tree fail?)
   * @param {HTMLElement} element - The element to check
   * @return {boolean} - True if the node is critical
   */
  isNodeCritical(element) {
    // For leaf nodes in AND branches, they're critical
    // For leaf nodes in OR branches with no other passing siblings, they're critical

    if (this.isInOrBranch(element)) {
      // In OR branch - critical only if no other siblings pass
      return !this.hasPassingSibling(element);
    } else {
      // In AND branch or root - critical by default
      return true;
    }
  }

  /**
   * Displays the compiled lists of nodes categorized by type
   * @param {Object} nodeLists - Object containing the categorized node lists
   * @param {HTMLElement} container - Container element to place the list
   */
  displayCompiledList(nodeLists, container) {
    // Clear any existing content
    container.innerHTML = '';

    // Add overall container with styling
    const listContainer = document.createElement('div');
    listContainer.classList.add('compiled-rules-list');
    listContainer.style.margin = '10px 0';
    listContainer.style.padding = '10px';
    listContainer.style.backgroundColor = '#2a2a2a';
    listContainer.style.borderRadius = '5px';
    listContainer.style.border = '1px solid #444';

    const {
      primaryBlockers,
      secondaryBlockers,
      tertiaryBlockers,
      primaryRequirements,
      secondaryRequirements,
      tertiaryRequirements,
    } = nodeLists;

    console.log('Node counts:', {
      primaryBlockers: primaryBlockers.length,
      secondaryBlockers: secondaryBlockers.length,
      tertiaryBlockers: tertiaryBlockers.length,
      primaryRequirements: primaryRequirements.length,
      secondaryRequirements: secondaryRequirements.length,
      tertiaryRequirements: tertiaryRequirements.length,
    });

    // Deduplicate all node lists
    const deduplicatedPrimaryBlockers = this.deduplicateNodes(primaryBlockers);
    const deduplicatedSecondaryBlockers =
      this.deduplicateNodes(secondaryBlockers);
    const deduplicatedTertiaryBlockers =
      this.deduplicateNodes(tertiaryBlockers);
    const deduplicatedPrimaryRequirements =
      this.deduplicateNodes(primaryRequirements);
    const deduplicatedSecondaryRequirements = this.deduplicateNodes(
      secondaryRequirements
    );
    const deduplicatedTertiaryRequirements =
      this.deduplicateNodes(tertiaryRequirements);

    console.log('After deduplication:', {
      primaryBlockers: deduplicatedPrimaryBlockers.length,
      secondaryBlockers: deduplicatedSecondaryBlockers.length,
      tertiaryBlockers: deduplicatedTertiaryBlockers.length,
      primaryRequirements: deduplicatedPrimaryRequirements.length,
      secondaryRequirements: deduplicatedSecondaryRequirements.length,
      tertiaryRequirements: deduplicatedTertiaryRequirements.length,
    });

    // Create sections for each node list with descriptive titles
    this._createNodeListSection(
      listContainer,
      deduplicatedPrimaryBlockers,
      'Primary Blockers',
      'These items directly block access. Acquiring them would unblock the path.',
      '#f44336' // Red color for blockers
    );

    this._createNodeListSection(
      listContainer,
      deduplicatedSecondaryBlockers,
      'Secondary Blockers',
      'These items are failing but are not the only blockers on their paths.',
      '#ff9800' // Orange color for secondary blockers
    );

    this._createNodeListSection(
      listContainer,
      deduplicatedTertiaryBlockers,
      'Tertiary Blockers',
      'These items are failing but do not affect path accessibility.',
      '#ffeb3b' // Yellow color for tertiary blockers
    );

    this._createNodeListSection(
      listContainer,
      deduplicatedPrimaryRequirements,
      'Primary Requirements',
      'These items are critical for access. Removing them would block the path.',
      '#4caf50' // Green color for requirements
    );

    this._createNodeListSection(
      listContainer,
      deduplicatedSecondaryRequirements,
      'Secondary Requirements',
      'These items are helping but are not critical. Other items could substitute.',
      '#2196f3' // Blue color for secondary requirements
    );

    this._createNodeListSection(
      listContainer,
      deduplicatedTertiaryRequirements,
      'Tertiary Requirements',
      'These items are satisfied but not affecting path accessibility.',
      '#9e9e9e' // Gray color for tertiary requirements
    );

    // If all sections are empty, show a message
    if (
      deduplicatedPrimaryBlockers.length === 0 &&
      deduplicatedSecondaryBlockers.length === 0 &&
      deduplicatedTertiaryBlockers.length === 0 &&
      deduplicatedPrimaryRequirements.length === 0 &&
      deduplicatedSecondaryRequirements.length === 0 &&
      deduplicatedTertiaryRequirements.length === 0
    ) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'No requirements found for this region.';
      emptyMsg.classList.add('empty-list-message');
      emptyMsg.style.padding = '10px';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.style.color = '#aaa';
      emptyMsg.style.textAlign = 'center';
      listContainer.appendChild(emptyMsg);
    }

    container.appendChild(listContainer);
  }

  /**
   * Displays a section of nodes in the compiled list
   * @param {HTMLElement} container - Container to add the section to
   * @param {Array} nodes - List of nodes to display
   * @param {string} title - Section title
   * @param {string} description - Section description
   * @param {string} sectionColor - Color for this section
   */
  _createNodeListSection(container, nodes, title, description, sectionColor) {
    if (nodes.length === 0) return;

    const section = document.createElement('div');
    section.classList.add('node-list-section');
    section.style.margin = '10px 0';
    section.style.padding = '10px';
    section.style.backgroundColor = '#333';
    section.style.borderRadius = '4px';
    section.style.border = '1px solid #444';

    const header = document.createElement('h3');
    header.textContent = `${title} (${nodes.length})`;
    header.style.margin = '0 0 8px 0';
    header.style.fontSize = '16px';
    header.style.fontWeight = 'bold';
    header.style.color = '#fff';
    section.appendChild(header);

    const desc = document.createElement('p');
    desc.textContent = description;
    desc.classList.add('section-description');
    desc.style.margin = '0 0 10px 0';
    desc.style.fontSize = '13px';
    desc.style.color = '#aaa';
    section.appendChild(desc);

    const list = document.createElement('ul');
    list.style.margin = '8px 0';
    list.style.paddingLeft = '25px';
    list.style.listStyleType = 'disc';

    nodes.forEach((node) => {
      const item = document.createElement('li');
      item.style.margin = '4px 0';

      // Use displayElement if available, otherwise use display text
      if (node.displayElement) {
        // Clone the element and customize based on section
        const clonedElement = node.displayElement.cloneNode(true);

        // Find all value spans (the second child of each container)
        const valueSpans = clonedElement.querySelectorAll('span:nth-child(2)');
        valueSpans.forEach((span) => {
          // Skip region links when setting the section color
          if (!span.classList.contains('region-link')) {
            span.style.color = sectionColor;
          }
        });

        // Ensure all region links have correct colors based on accessibility
        const regionLinks = clonedElement.querySelectorAll('.region-link');
        regionLinks.forEach((link) => {
          const regionName = link.dataset.region;
          if (regionName) {
            const regionAccessible = stateManager.isRegionReachable(regionName);
            link.style.color = regionAccessible ? '#4caf50' : '#f44336';
          }
        });

        item.appendChild(clonedElement);
      } else {
        item.textContent = node.display;
        item.style.color = sectionColor;
      }

      list.appendChild(item);
    });
    section.appendChild(list);

    container.appendChild(section);
  }

  /**
   * Process each path and create collapsible exit lists
   * @param {Array} path - The path to process
   * @param {HTMLElement} pathsDiv - The container for all paths
   * @param {Object} allNodes - Object containing node categories
   * @returns {HTMLElement} - The created path element
   */
  _processPath(path, pathsDiv, allNodes, pathIndex = 0) {
    // Create path element
    const pathEl = document.createElement('div');
    pathEl.classList.add('region-path');
    pathEl.dataset.originalIndex = pathIndex.toString();
    pathEl.style.marginBottom = '10px';

    // Create the path visualization with collapsible header
    const pathHeader = document.createElement('div');
    pathHeader.classList.add('path-header');
    pathHeader.style.display = 'flex';
    pathHeader.style.alignItems = 'center';
    pathHeader.style.cursor = 'pointer';
    pathHeader.style.padding = '5px';
    pathHeader.style.borderRadius = '4px';
    pathHeader.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';

    // Add toggle indicator
    const toggleIndicator = document.createElement('span');
    toggleIndicator.classList.add('path-toggle-indicator');
    toggleIndicator.textContent = '▼'; // Down arrow for expanded
    toggleIndicator.style.marginRight = '8px';
    toggleIndicator.style.fontSize = '10px';
    toggleIndicator.style.transition = 'transform 0.2s';
    pathHeader.appendChild(toggleIndicator);

    // Create the path visualization
    const pathText = document.createElement('div');
    pathText.classList.add('path-regions');
    pathText.style.flex = '1';

    // Analyze the transitions in this path - this is finding all exits correctly
    const transitions = this._findAllTransitions(path);

    // Call debug function for problematic transitions
    this._debugTransition(transitions, 'Light World', 'East Dark World');
    this._debugTransition(transitions, 'East Dark World', 'Pyramid Fairy');

    // DEBUG: Log transitions and their accessibility for this path
    console.log('Path analysis for:', path);
    transitions.forEach((t) => {
      console.log(
        `Transition ${t.fromRegion} → ${t.toRegion}:`,
        `Accessible: ${t.transitionAccessible}`,
        `Exits: ${t.exits.length}`
      );
    });

    // Create container for exit rules (this will be toggled)
    const exitRulesContainer = document.createElement('div');
    exitRulesContainer.classList.add('path-exit-rules');
    exitRulesContainer.style.display = 'block'; // Start expanded

    // Track if the path chain is unbroken so far
    let pathChainIntact = true;
    let lastAccessibleRegionIndex = -1;

    // Display the path regions
    path.forEach((region, index) => {
      // Check region's general accessibility
      const regionAccessible = stateManager.isRegionReachable(region);

      // Determine color based on accessibility and path integrity
      let regionColor;

      if (!regionAccessible) {
        // Region is completely inaccessible: RED
        regionColor = '#f44336';
        pathChainIntact = false;
      } else if (index === 0) {
        // First region is accessible, start of path: GREEN
        regionColor = '#4caf50';
        lastAccessibleRegionIndex = 0;
      } else if (pathChainIntact) {
        // Find the transition between the previous region and this one
        const prevRegion = path[index - 1];
        const transition = transitions.find(
          (t) => t.fromRegion === prevRegion && t.toRegion === region
        );

        // Add debugging to check transitions
        console.log(
          `Looking for transition ${prevRegion} → ${region}: ${
            transition ? 'FOUND' : 'NOT FOUND'
          }`
        );
        if (transition) {
          console.log(
            `  Transition accessible: ${transition.transitionAccessible}`
          );
          console.log(`  Exit count: ${transition.exits.length}`);
          console.log(
            `  Accessible exits: ${
              transition.exits.filter(
                (e) => !e.access_rule || evaluateRule(e.access_rule)
              ).length
            }`
          );
        }

        // FIX: Check if ANY exit is accessible for this transition
        if (transition && transition.transitionAccessible) {
          // This link in the chain works - region is accessible via this path: GREEN
          console.log(
            `Region ${region} from ${prevRegion}: ACCESSIBLE transition found`
          );
          regionColor = '#4caf50';
          lastAccessibleRegionIndex = index;
        } else {
          // No accessible exits - region is accessible but not via this path: ORANGE
          console.log(
            `Region ${region} from ${prevRegion}: INACCESSIBLE transition, details:`,
            transition
              ? `Found transition, accessible=${transition.transitionAccessible}`
              : 'No transition found'
          );
          regionColor = '#ff9800';
          pathChainIntact = false;
        }
      } else {
        // Previous link was broken - region is accessible but not via this path: ORANGE
        regionColor = '#ff9800';
      }

      // Create a span for the region with the appropriate color
      const regionSpan = document.createElement('span');
      regionSpan.textContent = region;
      regionSpan.style.color = regionColor;
      regionSpan.classList.add('region-link');
      regionSpan.dataset.region = region;

      // Add colorblind symbol if needed - FIX: Use correct accessibility status
      if (this.colorblindMode) {
        const symbolSpan = document.createElement('span');
        symbolSpan.classList.add('colorblind-symbol');

        if (regionColor === '#4caf50') {
          // Green - accessible
          symbolSpan.textContent = ' ✓';
          symbolSpan.classList.add('accessible');
        } else if (regionColor === '#f44336') {
          // Red - inaccessible
          symbolSpan.textContent = ' ✗';
          symbolSpan.classList.add('inaccessible');
        } else if (regionColor === '#ff9800') {
          // Orange - partial
          symbolSpan.textContent = ' ⚠';
          symbolSpan.classList.add('partial');
        }

        regionSpan.appendChild(symbolSpan);
      }

      regionSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateToRegion(region);
      });

      // Add the region to the path
      pathText.appendChild(regionSpan);

      // Add an arrow between regions (except for the last one)
      if (index < path.length - 1) {
        // Find the transition for this arrow
        const toRegion = path[index + 1];
        const transition = transitions.find(
          (t) => t.fromRegion === region && t.toRegion === toRegion
        );

        // FIX: Color the arrow based on transition accessibility
        const arrowColor =
          transition && transition.transitionAccessible ? '#4caf50' : '#ff9800';

        const arrow = document.createElement('span');
        arrow.textContent = ' → ';
        arrow.style.color = arrowColor; // FIX: Apply correct color to arrow
        pathText.appendChild(arrow);
      }
    });

    // Add path text to header
    pathHeader.appendChild(pathText);

    // Add click handler for toggling exit rules
    pathHeader.addEventListener('click', () => {
      const isExpanded = exitRulesContainer.style.display !== 'none';

      // Toggle visibility
      exitRulesContainer.style.display = isExpanded ? 'none' : 'block';

      // Update toggle indicator
      toggleIndicator.textContent = isExpanded ? '►' : '▼'; // Right arrow when collapsed, down when expanded
    });

    // Add header to path element
    pathEl.appendChild(pathHeader);

    // Add exit rule for transitions if any
    if (transitions.length > 0) {
      transitions.forEach((transition) => {
        // Create a header for this transition
        const transitionHeader = document.createElement('div');
        transitionHeader.classList.add('transition-header');
        transitionHeader.style.marginTop = '10px';
        transitionHeader.style.marginBottom = '5px';
        transitionHeader.style.fontWeight = 'bold';

        // FIX: Color the transition header based on whether ANY exit is accessible
        const transitionColor = transition.transitionAccessible
          ? '#4caf50' // Green if ANY exit is accessible
          : '#f44336'; // Red if NO exits are accessible

        transitionHeader.style.color = transitionColor;

        // Count how many exits are accessible
        const accessibleExitCount = transition.exits.filter(
          (exit) => !exit.access_rule || evaluateRule(exit.access_rule)
        ).length;

        // FIX: Update text to make it clearer, with "transition" in correct color
        transitionHeader.innerHTML = `<span style="color: ${transitionColor};">Transition:</span> ${
          transition.fromRegion
        } → ${transition.toRegion} 
          <span style="color: ${transitionColor};">(${
          transition.transitionAccessible ? 'Accessible' : 'Blocked'
        })</span>`;

        // FIX: If multiple exits, add indicator with exits count in WHITE color
        if (transition.exits.length > 1) {
          transitionHeader.innerHTML += ` <span style="color: #cecece; font-weight: normal;">
            [${accessibleExitCount}/${transition.exits.length} exits available]</span>`;
        }

        exitRulesContainer.appendChild(transitionHeader);

        // Create a container for multiple exits
        const exitsContainer = document.createElement('div');
        exitsContainer.classList.add('exits-container');
        exitsContainer.style.marginLeft = '20px';

        // Add each exit rule
        transition.exits.forEach((exit, exitIndex) => {
          const exitAccessible =
            !exit.access_rule || evaluateRule(exit.access_rule);

          // Create exit rule container
          const exitRuleContainer = document.createElement('div');
          exitRuleContainer.classList.add('path-exit-rule-container');
          exitRuleContainer.classList.add(
            exitAccessible ? 'passing-exit' : 'failing-exit'
          );
          exitRuleContainer.style.display = 'block';
          exitRuleContainer.style.marginTop = '5px';
          exitRuleContainer.style.marginBottom = '10px';
          exitRuleContainer.style.padding = '5px';
          exitRuleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';

          // Set the border color based on rule evaluation
          exitRuleContainer.style.borderLeft = exitAccessible
            ? '3px solid #4caf50' // Green for accessible exits
            : '3px solid #f44336'; // Red for inaccessible exits

          // Create header for exit - include numbering if multiple exits
          const exitHeader = document.createElement('div');
          exitHeader.classList.add('path-exit-header');
          exitHeader.style.color = exitAccessible ? '#4caf50' : '#f44336';

          // Add exit numbering if multiple exits
          if (transition.exits.length > 1) {
            exitHeader.innerHTML = `<strong>Exit ${exitIndex + 1}/${
              transition.exits.length
            }:</strong> ${transition.fromRegion} → ${exit.name} → ${
              transition.toRegion
            }`;
          } else {
            exitHeader.innerHTML = `<strong>Exit:</strong> ${transition.fromRegion} → ${exit.name} → ${transition.toRegion}`;
          }

          exitRuleContainer.appendChild(exitHeader);

          // Show the exit rule if it exists
          if (exit.access_rule) {
            const ruleContainer = document.createElement('div');
            ruleContainer.classList.add('path-exit-rule');
            const ruleElement = this.renderLogicTree(exit.access_rule);
            ruleContainer.appendChild(ruleElement);
            exitRuleContainer.appendChild(ruleContainer);

            // Analyze nodes from this exit for our categories
            const nodeResults = this.extractCategorizedNodes(ruleElement);
            Object.keys(allNodes).forEach((key) => {
              allNodes[key].push(...nodeResults[key]);
            });
          }

          // Add to exits container
          exitsContainer.appendChild(exitRuleContainer);
        });

        // Add all exits to the main container
        exitRulesContainer.appendChild(exitsContainer);
      });
    }

    // Add exit rules container to path element
    pathEl.appendChild(exitRulesContainer);

    // FIX: If the entire path is viable, mark it visually
    if (pathChainIntact) {
      pathEl.classList.add('viable-path');
      pathEl.style.borderLeft = '3px solid #4caf50';
    }

    return pathEl;
  }

  /**
   * Enhanced path finder that focuses only on exits
   * @param {string} targetRegion - The region to find paths to
   * @param {number} maxPaths - Maximum number of paths to find
   * @returns {Array} - Array of enhanced paths with connection details
   */
  findEnhancedPathsToRegion(targetRegion, maxPaths = 100) {
    // Find paths using the standard exit-based approach
    const exitPaths = this.findPathsToRegion(targetRegion, maxPaths);
    const enhancedPaths = [];

    // Process each path to add connection information
    for (const path of exitPaths) {
      // For each adjacent pair of regions in the path, find exit connections
      const enhancedPath = {
        regions: path,
        connections: [],
      };

      for (let i = 0; i < path.length - 1; i++) {
        const fromRegion = path[i];
        const toRegion = path[i + 1];

        // Find the exit connection
        const fromRegionData = stateManager.regions[fromRegion];
        if (!fromRegionData || !fromRegionData.exits) continue;

        const exit = fromRegionData.exits.find(
          (e) => e.connected_region === toRegion
        );

        if (exit) {
          enhancedPath.connections.push({
            fromRegion,
            toRegion,
            exit: {
              type: 'exit',
              name: exit.name,
              fromRegion,
              toRegion,
              rule: exit.access_rule,
              accessible: !exit.access_rule || evaluateRule(exit.access_rule),
            },
          });
        } else {
          // No explicit exit found, add a placeholder
          enhancedPath.connections.push({
            fromRegion,
            toRegion,
            exit: null,
          });
        }
      }

      enhancedPaths.push(enhancedPath);
    }

    return enhancedPaths;
  }

  /**
   * Process a single enhanced path for display
   * @param {Object} enhancedPath - Path with region and connection data
   * @param {HTMLElement} container - Container element to add the path to
   * @returns {HTMLElement} - The created path element
   */
  _processEnhancedPath(enhancedPath, container) {
    // Create path element with collapsible header
    const pathEl = document.createElement('div');
    pathEl.classList.add('region-path');
    pathEl.style.marginBottom = '15px';

    // Create header for path
    const pathHeader = document.createElement('div');
    pathHeader.classList.add('path-header');
    pathHeader.style.cursor = 'pointer';
    pathHeader.style.padding = '8px';
    pathHeader.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    pathHeader.style.borderRadius = '4px';
    pathHeader.style.display = 'flex';
    pathHeader.style.alignItems = 'center';

    // Add toggle indicator
    const toggleIndicator = document.createElement('span');
    toggleIndicator.classList.add('path-toggle-indicator');
    toggleIndicator.textContent = '▼'; // Down arrow for expanded
    toggleIndicator.style.marginRight = '8px';
    toggleIndicator.style.transition = 'transform 0.2s';
    pathHeader.appendChild(toggleIndicator);

    // Create the path visualization
    const pathText = document.createElement('div');
    pathText.classList.add('path-regions');
    pathText.style.flex = '1';

    // Track path viability
    let pathIsViable = true;

    // Process each region in the path
    enhancedPath.regions.forEach((region, index) => {
      // Determine color based on accessibility
      const regionAccessible = stateManager.isRegionReachable(region);

      let regionColor;
      if (!regionAccessible) {
        // Region completely inaccessible
        regionColor = '#f44336'; // Red
        pathIsViable = false;
      } else if (index === 0) {
        // First region and accessible
        regionColor = '#4caf50'; // Green
      } else if (pathIsViable) {
        // Check if connection to this region is viable
        const prevConnection =
          index > 0 ? enhancedPath.connections[index - 1] : null;

        if (prevConnection) {
          // Check if the exit works
          const exitViable = prevConnection.exit?.accessible || false;

          if (exitViable) {
            // Exit works - region is accessible via this path
            regionColor = '#4caf50'; // Green
          } else {
            // Exit doesn't work - region is accessible but not via this path
            regionColor = '#ff9800'; // Orange
            pathIsViable = false;
          }
        } else {
          // No connection info
          regionColor = '#ff9800'; // Orange - uncertain path
          pathIsViable = false;
        }
      } else {
        // Previous link broken
        regionColor = '#ff9800'; // Orange
      }

      // Create region span
      const regionSpan = document.createElement('span');
      regionSpan.textContent = region;
      regionSpan.style.color = regionColor;
      regionSpan.classList.add('region-link');
      regionSpan.dataset.region = region;

      // Add colorblind symbol if needed
      if (this.colorblindMode) {
        const symbolSpan = document.createElement('span');
        symbolSpan.classList.add('colorblind-symbol');

        if (regionColor === '#4caf50') {
          // Green - accessible
          symbolSpan.textContent = ' ✓';
          symbolSpan.classList.add('accessible');
        } else if (regionColor === '#f44336') {
          // Red - inaccessible
          symbolSpan.textContent = ' ✗';
          symbolSpan.classList.add('inaccessible');
        } else if (regionColor === '#ff9800') {
          // Orange - partial
          symbolSpan.textContent = ' ⚠';
          symbolSpan.classList.add('partial');
        }

        regionSpan.appendChild(symbolSpan);
      }

      regionSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateToRegion(region);
      });

      // Add region to path text
      pathText.appendChild(regionSpan);

      // Add arrow if not the last region
      if (index < enhancedPath.regions.length - 1) {
        // Find connection for this arrow
        const connection = enhancedPath.connections[index];

        // FIX: Color arrow based on exit accessibility
        const arrowColor =
          connection && connection.exit?.accessible ? '#4caf50' : '#ff9800';

        const arrow = document.createElement('span');
        arrow.textContent = ' → '; // Simple arrow
        arrow.style.color = arrowColor; // FIX: Apply correct color to arrow
        pathText.appendChild(arrow);
      }
    });

    // Add path text to header
    pathHeader.appendChild(pathText);
    pathEl.appendChild(pathHeader);

    // If path is viable, mark it visually
    if (pathIsViable) {
      pathEl.classList.add('viable-path');
      pathEl.style.borderLeft = '3px solid #4caf50';
    }

    // Create details container (for rules)
    const exitRulesContainer = document.createElement('div');
    exitRulesContainer.classList.add('path-exit-rules');
    exitRulesContainer.style.display = 'block'; // Start expanded
    exitRulesContainer.style.paddingLeft = '15px';
    exitRulesContainer.style.marginTop = '5px';

    // Add explanation
    const explanationDiv = document.createElement('div');
    explanationDiv.style.marginTop = '5px';
    explanationDiv.style.fontStyle = 'italic';
    explanationDiv.style.color = '#888';
    explanationDiv.textContent =
      "This path was derived from stateManager's reachability data and represents a logically viable path.";
    exitRulesContainer.appendChild(explanationDiv);

    // Process connections to show rules - with enhancement for multiple exits
    enhancedPath.connections.forEach((connection, index) => {
      const { fromRegion, toRegion } = connection;

      // Check if there might be multiple exits between these regions
      const fromRegionData = stateManager.regions[fromRegion];
      if (!fromRegionData) return;

      // Find ALL possible exits between these regions
      const multipleExits =
        fromRegionData.exits?.filter((e) => e.connected_region === toRegion) ||
        [];

      // Skip if no exits found
      if (multipleExits.length === 0) return;

      // Count accessible exits
      const accessibleExits = multipleExits.filter(
        (exit) => !exit.access_rule || evaluateRule(exit.access_rule)
      );
      const transitionAccessible = accessibleExits.length > 0;

      // Create a transition header that indicates multiple exits when present
      const transitionHeader = document.createElement('div');
      transitionHeader.classList.add('transition-header');
      transitionHeader.style.marginTop = '10px';
      transitionHeader.style.marginBottom = '5px';
      transitionHeader.style.fontWeight = 'bold';

      // FIX: Transition color based on ANY accessible exit
      const transitionColor = transitionAccessible ? '#4caf50' : '#f44336';
      transitionHeader.style.color = transitionColor;

      // FIX: Make transition text use correct color
      transitionHeader.innerHTML = `<span style="color: ${transitionColor};">Transition:</span> ${fromRegion} → ${toRegion}`;

      // FIX: Add indicator for multiple exits if applicable, in WHITE color
      if (multipleExits.length > 1) {
        transitionHeader.innerHTML += ` <span style="color: #cecece; font-weight: normal;">
          [${accessibleExits.length}/${multipleExits.length} exits available]</span>`;
      }

      exitRulesContainer.appendChild(transitionHeader);

      // Add each possible exit with its rule
      multipleExits.forEach((exit, exitIndex) => {
        // Evaluate exit rule
        const exitAccessible =
          !exit.access_rule || evaluateRule(exit.access_rule);

        // Create exit rule container
        const exitRuleContainer = document.createElement('div');
        exitRuleContainer.classList.add('path-exit-rule-container');
        exitRuleContainer.classList.add(
          exitAccessible ? 'passing-exit' : 'failing-exit'
        );
        exitRuleContainer.style.marginLeft = '20px';
        exitRuleContainer.style.marginTop = '5px';
        exitRuleContainer.style.marginBottom = '10px';
        exitRuleContainer.style.padding = '5px';
        exitRuleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        exitRuleContainer.style.borderLeft = exitAccessible
          ? '3px solid #4caf50'
          : '3px solid #f44336';

        // Create header for exit
        const exitHeader = document.createElement('div');
        exitHeader.classList.add('path-exit-header');
        exitHeader.style.color = exitAccessible ? '#4caf50' : '#f44336';

        // Add exit number if multiple exits
        if (multipleExits.length > 1) {
          exitHeader.innerHTML = `<strong>Exit ${exitIndex + 1}/${
            multipleExits.length
          }:</strong> ${fromRegion} → ${exit.name} → ${toRegion}`;
        } else {
          exitHeader.innerHTML = `<strong>Exit:</strong> ${fromRegion} → ${exit.name} → ${toRegion}`;
        }

        exitRuleContainer.appendChild(exitHeader);

        // Add rule tree if available
        if (exit.access_rule) {
          const ruleContainer = document.createElement('div');
          ruleContainer.classList.add('path-exit-rule');
          const ruleElement = this.renderLogicTree(exit.access_rule);
          ruleContainer.appendChild(ruleElement);
          exitRuleContainer.appendChild(ruleContainer);
        }

        // Add to container
        exitRulesContainer.appendChild(exitRuleContainer);
      });
    });

    // Add toggle functionality to header
    pathHeader.addEventListener('click', () => {
      const isExpanded = exitRulesContainer.style.display !== 'none';
      exitRulesContainer.style.display = isExpanded ? 'none' : 'block';
      toggleIndicator.textContent = isExpanded ? '►' : '▼'; // Change arrow
    });

    // Add details to path element
    pathEl.appendChild(exitRulesContainer);

    return pathEl;
  }

  /**
   * Sets up the Analyze Paths button with the exit-only approach
   */
  setupAnalyzePathsButton(
    analyzePathsBtn,
    pathsCountSpan,
    pathsContainer,
    regionName
  ) {
    analyzePathsBtn.addEventListener('click', () => {
      // Clear existing analysis
      if (pathsContainer.style.display === 'block') {
        pathsContainer.style.display = 'none';
        pathsContainer.innerHTML = '';
        pathsCountSpan.style.display = 'none';
        analyzePathsBtn.textContent = 'Analyze Paths';

        // Find and remove any toggle controls if they exist
        const toggleContainer = document.querySelector('.path-toggle-controls');
        if (toggleContainer) {
          toggleContainer.remove();
        }

        return;
      }

      // Begin analysis
      analyzePathsBtn.textContent = 'Analyzing...';
      analyzePathsBtn.disabled = true;

      // Make sure paths container is visible
      pathsContainer.style.display = 'block';

      // Check if the region is actually reachable according to stateManager
      const isRegionActuallyReachable =
        stateManager.isRegionReachable(regionName);

      // Display a spinner while processing
      const spinner = document.createElement('div');
      spinner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div style="font-size: 16px; margin-right: 10px;">Finding paths...</div>
          <div class="spinner" style="
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 4px solid #3498db;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
          "></div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      pathsContainer.appendChild(spinner);

      // Use setTimeout to allow the spinner to render before starting path analysis
      setTimeout(() => {
        try {
          // Find enhanced paths using the exit-only approach
          const MAX_PATHS = 100;
          const enhancedPaths = this.findEnhancedPathsToRegion(
            regionName,
            MAX_PATHS
          );

          // Create categories for node analysis
          const allNodes = {
            primaryBlockers: [],
            secondaryBlockers: [],
            tertiaryBlockers: [],
            primaryRequirements: [],
            secondaryRequirements: [],
            tertiaryRequirements: [],
          };

          // Create section for the requirement analysis
          const requirementsDiv = document.createElement('div');
          requirementsDiv.classList.add('compiled-results-container');
          requirementsDiv.id = 'path-summary-section';
          requirementsDiv.innerHTML = '<h4>Path Requirements Analysis:</h4>';

          // Create div for paths
          const pathsDiv = document.createElement('div');
          pathsDiv.classList.add('path-regions-container');

          // Track fully viable paths
          let fullViablePaths = 0;

          // Process each path - both for display and analysis
          if (enhancedPaths.length > 0) {
            enhancedPaths.forEach((enhancedPath, pathIndex) => {
              // Check if this path is fully viable
              let pathViable = true;

              // A path is viable if each segment has a working exit
              for (const connection of enhancedPath.connections) {
                const exitViable = connection.exit?.accessible || false;

                if (!exitViable) {
                  pathViable = false;
                  break;
                }
              }

              if (pathViable) {
                fullViablePaths++;
              }

              // For each connection, analyze rules for the summary
              for (const connection of enhancedPath.connections) {
                // Analyze exit rules
                if (connection.exit && connection.exit.rule) {
                  const ruleElement = this.renderLogicTree(
                    connection.exit.rule
                  );
                  const nodeResults = this.extractCategorizedNodes(ruleElement);

                  // Merge results into allNodes
                  Object.keys(allNodes).forEach((key) => {
                    allNodes[key].push(...nodeResults[key]);
                  });
                }
              }

              // Process the path for display
              const pathEl = this._processEnhancedPath(enhancedPath, pathsDiv);
              pathsDiv.appendChild(pathEl);
            });
          }

          // Add a status indicator
          const statusIndicator = document.createElement('div');
          statusIndicator.classList.add('region-status-indicator');
          statusIndicator.style.marginBottom = '15px';
          statusIndicator.style.padding = '10px';
          statusIndicator.style.borderRadius = '4px';

          if (isRegionActuallyReachable) {
            if (fullViablePaths > 0) {
              // Region is reachable with viable paths
              statusIndicator.style.backgroundColor = 'rgba(76, 175, 80, 0.2)'; // Green
              statusIndicator.style.border = '1px solid #4CAF50';
              statusIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: bold; color: #4CAF50;">✓ Region Reachable</span>
                  <span>This region is reachable with ${fullViablePaths} viable path(s).</span>
                </div>
              `;
            } else if (enhancedPaths.length > 0) {
              // Region is reachable but all found paths have issues
              statusIndicator.style.backgroundColor = 'rgba(255, 152, 0, 0.2)'; // Orange
              statusIndicator.style.border = '1px solid #FF9800';
              statusIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: bold; color: #FF9800;">⚠️ Reachability Gap</span>
                  <span>This region is marked as reachable by stateManager, but none of the analyzed paths are fully viable. This may indicate the region is accessible through a different approach than this analysis shows.</span>
                </div>
              `;
            } else {
              // No paths found at all, but region is reachable
              statusIndicator.style.backgroundColor = 'rgba(255, 152, 0, 0.2)'; // Orange
              statusIndicator.style.border = '1px solid #FF9800';
              statusIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: bold; color: #FF9800;">⚠️ No Paths Found</span>
                  <span>This region is marked as reachable, but no paths were found. This may indicate a complex connection or special case not covered by the path finder.</span>
                </div>
              `;
            }
          } else {
            // Region is not reachable
            statusIndicator.style.backgroundColor = 'rgba(244, 67, 54, 0.2)'; // Red
            statusIndicator.style.border = '1px solid #F44336';
            statusIndicator.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: bold; color: #F44336;">✕ Region Unreachable</span>
                <span>This region is currently unreachable with your inventory.</span>
              </div>
            `;
          }

          // Add paths header
          if (enhancedPaths.length > 0) {
            const pathsHeader = document.createElement('h4');
            pathsHeader.textContent = `Paths to this region: (${enhancedPaths.length} found)`;
            pathsDiv.insertBefore(pathsHeader, pathsDiv.firstChild);
            pathsCountSpan.textContent = `(${enhancedPaths.length} paths found)`;
            pathsCountSpan.style.display = 'inline';
          } else {
            const noneFound = document.createElement('p');
            noneFound.textContent = 'No paths found to this region.';
            pathsDiv.appendChild(noneFound);
          }

          // If stateManager says the region is reachable but we couldn't find a viable path,
          // try to find a canonical path using our improved method
          if (isRegionActuallyReachable && fullViablePaths === 0) {
            const enhancedCanonicalPath = this.findCanonicalPath(regionName);

            if (
              enhancedCanonicalPath &&
              enhancedCanonicalPath.regions.length > 0
            ) {
              const derivedPathEl = document.createElement('div');
              derivedPathEl.classList.add('derived-canonical-path');
              derivedPathEl.classList.add('region-path'); // Add this class for compatibility with toggles
              derivedPathEl.classList.add('viable-path'); // Mark as viable
              derivedPathEl.style.padding = '10px';
              derivedPathEl.style.marginTop = '10px';
              derivedPathEl.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
              derivedPathEl.style.border = '1px solid #4CAF50';
              derivedPathEl.style.borderRadius = '4px';
              derivedPathEl.style.borderLeft = '3px solid #4caf50';

              // Create header with collapsible behavior
              const pathHeader = document.createElement('div');
              pathHeader.classList.add('path-header');
              pathHeader.style.display = 'flex';
              pathHeader.style.alignItems = 'center';
              pathHeader.style.cursor = 'pointer';
              pathHeader.style.padding = '5px';
              pathHeader.style.borderRadius = '4px';
              pathHeader.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';

              // Add toggle indicator
              const toggleIndicator = document.createElement('span');
              toggleIndicator.classList.add('path-toggle-indicator');
              toggleIndicator.textContent = '▼'; // Down arrow for expanded
              toggleIndicator.style.marginRight = '8px';
              toggleIndicator.style.fontSize = '10px';
              toggleIndicator.style.transition = 'transform 0.2s';
              pathHeader.appendChild(toggleIndicator);

              // Add title
              const titleSpan = document.createElement('span');
              titleSpan.textContent =
                'Canonical Path (derived from stateManager)';
              titleSpan.style.fontWeight = 'bold';
              pathHeader.appendChild(titleSpan);

              derivedPathEl.appendChild(pathHeader);

              // Create the path display
              const pathRegionsDiv = document.createElement('div');
              pathRegionsDiv.classList.add('path-regions');
              pathRegionsDiv.style.fontWeight = 'bold';
              pathRegionsDiv.style.marginTop = '8px';

              // Add each region with links
              enhancedCanonicalPath.regions.forEach((region, index) => {
                // Create a span for the region
                const regionSpan = document.createElement('span');
                regionSpan.textContent = region;
                regionSpan.classList.add('region-link');
                regionSpan.dataset.region = region;
                regionSpan.style.color = '#4CAF50';
                regionSpan.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.navigateToRegion(region);
                });

                // Add colorblind symbol if needed
                if (this.colorblindMode) {
                  const symbolSpan = document.createElement('span');
                  symbolSpan.classList.add('colorblind-symbol');
                  symbolSpan.textContent = ' ✓';
                  symbolSpan.classList.add('accessible');
                  regionSpan.appendChild(symbolSpan);
                }

                pathRegionsDiv.appendChild(regionSpan);

                // Add arrow between regions if not the last one
                if (index < enhancedCanonicalPath.regions.length - 1) {
                  const arrow = document.createElement('span');
                  arrow.textContent = ' → ';
                  pathRegionsDiv.appendChild(arrow);
                }
              });

              pathHeader.appendChild(pathRegionsDiv);

              // Create details container for exit rules
              const exitRulesContainer = document.createElement('div');
              exitRulesContainer.classList.add('path-exit-rules');
              exitRulesContainer.style.display = 'block'; // Start expanded

              // Add explanation
              const explanationDiv = document.createElement('div');
              explanationDiv.style.marginTop = '5px';
              explanationDiv.style.fontStyle = 'italic';
              explanationDiv.style.color = '#888';
              explanationDiv.textContent =
                "This path was derived from stateManager's reachability data and represents a logically viable path.";
              exitRulesContainer.appendChild(explanationDiv);

              // Add exit rule details for each connection
              if (enhancedCanonicalPath.connections.length > 0) {
                enhancedCanonicalPath.connections.forEach((connection) => {
                  if (connection.exit) {
                    // Create exit rule container
                    const exitRuleContainer = document.createElement('div');
                    exitRuleContainer.classList.add('path-exit-rule-container');
                    exitRuleContainer.classList.add(
                      connection.exit.accessible
                        ? 'passing-exit'
                        : 'failing-exit'
                    );
                    exitRuleContainer.style.display = 'block';
                    exitRuleContainer.style.marginLeft = '20px';
                    exitRuleContainer.style.marginTop = '5px';
                    exitRuleContainer.style.marginBottom = '10px';
                    exitRuleContainer.style.padding = '5px';
                    exitRuleContainer.style.backgroundColor =
                      'rgba(0, 0, 0, 0.2)';

                    // Set the border color
                    exitRuleContainer.style.borderLeft = connection.exit
                      .accessible
                      ? '3px solid #4caf50'
                      : '3px solid #f44336';

                    // Create header for exit
                    const exitHeader = document.createElement('div');
                    exitHeader.classList.add('path-exit-header');
                    exitHeader.style.color = connection.exit.accessible
                      ? '#4caf50'
                      : '#f44336';
                    exitHeader.innerHTML = `<strong>Exit:</strong> ${connection.fromRegion} → ${connection.exit.name} → ${connection.toRegion}`;
                    exitRuleContainer.appendChild(exitHeader);

                    // Add rule tree if available
                    if (connection.exit.rule) {
                      const ruleContainer = document.createElement('div');
                      ruleContainer.classList.add('path-exit-rule');

                      // Create a DOM representation of the rule
                      const ruleElement = this.renderLogicTree(
                        connection.exit.rule
                      );
                      ruleContainer.appendChild(ruleElement);
                      exitRuleContainer.appendChild(ruleContainer);

                      // Analyze rules for categories
                      const nodeResults =
                        this.extractCategorizedNodes(ruleElement);
                      Object.keys(allNodes).forEach((key) => {
                        allNodes[key].push(...nodeResults[key]);
                      });
                    }

                    exitRulesContainer.appendChild(exitRuleContainer);
                  }
                });
              }

              derivedPathEl.appendChild(exitRulesContainer);

              // Add toggle functionality to header
              pathHeader.addEventListener('click', () => {
                const isExpanded = exitRulesContainer.style.display !== 'none';

                // Toggle visibility
                exitRulesContainer.style.display = isExpanded
                  ? 'none'
                  : 'block';

                // Update toggle indicator
                toggleIndicator.textContent = isExpanded ? '►' : '▼'; // Right arrow when collapsed, down when expanded
              });

              // Add to path display
              pathsDiv.insertBefore(derivedPathEl, pathsDiv.firstChild);
            }
          }

          // Display categorized requirements
          this.displayCompiledList(allNodes, requirementsDiv);

          // Add everything to the container
          pathsContainer.innerHTML = '';
          pathsContainer.appendChild(statusIndicator);
          pathsContainer.appendChild(requirementsDiv);
          pathsContainer.appendChild(pathsDiv);

          // Create new toggle controls
          this._createPathToggleControls(pathsContainer);

          // Done analyzing
          analyzePathsBtn.textContent = 'Clear Analysis';
          analyzePathsBtn.disabled = false;
        } catch (error) {
          // Handle any errors in path analysis
          pathsContainer.innerHTML = '';
          const errorDiv = document.createElement('div');
          errorDiv.style.color = '#f44336';
          errorDiv.style.padding = '10px';
          errorDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
          errorDiv.style.borderRadius = '4px';
          errorDiv.style.margin = '10px 0';
          errorDiv.innerHTML = `
            <h4>Error Finding Paths</h4>
            <p>${error.message}</p>
            <pre>${error.stack}</pre>
          `;
          pathsContainer.appendChild(errorDiv);

          // Reset button
          analyzePathsBtn.textContent = 'Analyze Paths';
          analyzePathsBtn.disabled = false;

          console.error('Path analysis error:', error);
        }
      }, 50); // Small delay to allow spinner to render
    });
  }

  /**
   * Create toggle controls for path display
   */
  _createPathToggleControls(container) {
    // Add styles for colorblind mode symbols
    const colorblindStyles = document.createElement('style');
    colorblindStyles.textContent = `
      .colorblind-symbol {
        display: inline-block;
        margin-left: 4px;
        font-weight: bold;
      }
      
      .colorblind-symbol.accessible {
        color: #4caf50;
      }
      
      .colorblind-symbol.inaccessible {
        color: #f44336;
      }
      
      .colorblind-symbol.partial {
        color: #ff9800;
      }
      
      /* Style for logic tree colorblind symbols */
      .logic-node .colorblind-symbol {
        margin-right: 5px;
        margin-left: 0;
      }
    `;

    // Only add styles once
    if (!document.querySelector('style[data-colorblind-styles]')) {
      colorblindStyles.setAttribute('data-colorblind-styles', 'true');
      document.head.appendChild(colorblindStyles);
    }

    const toggleContainer = document.createElement('div');
    toggleContainer.classList.add('path-toggle-controls');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.gap = '10px';
    toggleContainer.style.marginBottom = '15px';
    toggleContainer.style.flexWrap = 'wrap';

    // Define all toggle buttons
    const toggles = [
      {
        id: 'toggle-summary',
        initialText: 'Hide Summary',
        selector: '#path-summary-section',
        showText: 'Show Summary',
        hideText: 'Hide Summary',
      },
      {
        id: 'toggle-passing-exits',
        initialText: 'Hide Passing Exits',
        selector: '.passing-exit',
        showText: 'Show Passing Exits',
        hideText: 'Hide Passing Exits',
      },
      {
        id: 'toggle-failing-exits',
        initialText: 'Hide Failing Exits',
        selector: '.failing-exit',
        showText: 'Show Failing Exits',
        hideText: 'Hide Failing Exits',
      },
    ];

    // Create each toggle button
    toggles.forEach((toggle) => {
      const button = document.createElement('button');
      button.id = toggle.id;
      button.textContent = toggle.initialText;
      button.style.padding = '5px 10px';
      button.style.backgroundColor = '#333';
      button.style.color = '#fff';
      button.style.border = '1px solid #666';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';

      // Set up the toggle functionality
      let isHidden = false;
      button.addEventListener('click', () => {
        isHidden = !isHidden;
        button.textContent = isHidden ? toggle.showText : toggle.hideText;

        // Toggle visibility of the targeted elements
        const elements = document.querySelectorAll(toggle.selector);
        elements.forEach((el) => {
          el.style.display = isHidden ? 'none' : 'block';
        });
      });

      toggleContainer.appendChild(button);
    });

    // Add "Collapse All" button
    const collapseAllButton = document.createElement('button');
    collapseAllButton.id = 'toggle-collapse-all';
    collapseAllButton.textContent = 'Collapse All';
    collapseAllButton.style.padding = '5px 10px';
    collapseAllButton.style.backgroundColor = '#333';
    collapseAllButton.style.color = '#fff';
    collapseAllButton.style.border = '1px solid #666';
    collapseAllButton.style.borderRadius = '4px';
    collapseAllButton.style.cursor = 'pointer';

    let allCollapsed = false;
    collapseAllButton.addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      collapseAllButton.textContent = allCollapsed
        ? 'Expand All'
        : 'Collapse All';

      // Get all path details containers including canonical path
      const detailsContainers = document.querySelectorAll(
        '.path-details, .path-exit-rules'
      );
      detailsContainers.forEach((container) => {
        container.style.display = allCollapsed ? 'none' : 'block';
      });

      // Update all toggle indicators including canonical path
      const indicators = document.querySelectorAll('.path-toggle-indicator');
      indicators.forEach((indicator) => {
        indicator.textContent = allCollapsed ? '►' : '▼';
      });
    });

    toggleContainer.appendChild(collapseAllButton);

    // Add colorblind mode toggle
    const colorblindModeToggle = document.createElement('button');
    colorblindModeToggle.id = 'toggle-colorblind-mode';
    colorblindModeToggle.textContent = this.colorblindMode
      ? 'Disable Colorblind Mode'
      : 'Enable Colorblind Mode';
    colorblindModeToggle.style.padding = '5px 10px';
    colorblindModeToggle.style.backgroundColor = this.colorblindMode
      ? '#7e57c2'
      : '#333';
    colorblindModeToggle.style.color = '#fff';
    colorblindModeToggle.style.border = '1px solid #666';
    colorblindModeToggle.style.borderRadius = '4px';
    colorblindModeToggle.style.cursor = 'pointer';

    colorblindModeToggle.addEventListener('click', () => {
      this.toggleColorblindMode();
      colorblindModeToggle.textContent = this.colorblindMode
        ? 'Disable Colorblind Mode'
        : 'Enable Colorblind Mode';
      colorblindModeToggle.style.backgroundColor = this.colorblindMode
        ? '#7e57c2'
        : '#333';
    });

    toggleContainer.appendChild(colorblindModeToggle);

    // Insert toggle controls at the beginning
    container.insertBefore(toggleContainer, container.firstChild);
  }

  /**
   * Derives a canonical path to a region using stateManager's approach
   * @param {string} targetRegion - The target region to find a path to
   * @returns {Array|null} - An array of region names forming a path, or null if no path exists
   */
  _deriveCanonicalPath(targetRegion) {
    const result = this.findCanonicalPath(targetRegion);
    return result ? result.regions : null;
  }

  /**
   * Finds a reliable canonical path using the same BFS approach as stateManager
   * @param {string} targetRegion - The target region to find a path to
   * @returns {Array|null} - An array of region names forming a path, or null if no path exists
   */
  findCanonicalPath(targetRegion) {
    // First check if the region is reachable according to stateManager
    const reachableRegions = new Set(stateManager.computeReachableRegions());
    if (!reachableRegions.has(targetRegion)) {
      return null; // Target isn't reachable according to stateManager
    }

    // Record predecessor information during a BFS search
    const predecessors = new Map();
    const exitInfo = new Map(); // Store the exit used between regions
    const queue = [...stateManager.getStartRegions()];
    const visited = new Set(queue);

    // Track level of search to ensure we find shortest path
    const nodeLevel = new Map();
    queue.forEach((region) => nodeLevel.set(region, 0));

    while (queue.length > 0) {
      const currentRegion = queue.shift();
      const currentLevel = nodeLevel.get(currentRegion);

      // Found target region, reconstruct path
      if (currentRegion === targetRegion) {
        return this._reconstructCanonicalPath(
          predecessors,
          exitInfo,
          targetRegion
        );
      }

      // Process all exits from the current region
      const currentRegionData = stateManager.regions[currentRegion];
      if (!currentRegionData) continue;

      for (const exit of currentRegionData.exits || []) {
        if (!exit.connected_region) continue;

        // Check if this exit is traversable
        const exitAccessible =
          !exit.access_rule || evaluateRule(exit.access_rule);
        if (!exitAccessible) continue;

        const nextRegion = exit.connected_region;
        if (!reachableRegions.has(nextRegion)) continue;

        const newLevel = currentLevel + 1;

        if (!visited.has(nextRegion)) {
          // First time seeing this region - use this path
          visited.add(nextRegion);
          queue.push(nextRegion);
          nodeLevel.set(nextRegion, newLevel);
          predecessors.set(nextRegion, currentRegion);
          exitInfo.set(`${currentRegion}->${nextRegion}`, exit);
        }
        // If we find a shorter path, update it
        else if (
          nodeLevel.has(nextRegion) &&
          newLevel < nodeLevel.get(nextRegion)
        ) {
          // Update to shorter path
          nodeLevel.set(nextRegion, newLevel);
          predecessors.set(nextRegion, currentRegion);
          exitInfo.set(`${currentRegion}->${nextRegion}`, exit);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstructs a path from predecessors map
   * @param {Map} predecessors - Map of region to its predecessor
   * @param {Map} exitInfo - Map of region pairs to the exit used
   * @param {string} targetRegion - Target region
   * @returns {Object} - Object containing the path and exit information
   */
  _reconstructCanonicalPath(predecessors, exitInfo, targetRegion) {
    const regions = [targetRegion];
    const connections = [];
    let current = targetRegion;

    while (predecessors.has(current)) {
      const previous = predecessors.get(current);

      // Add the connection to our connections list
      const exitKey = `${previous}->${current}`;
      const exit = exitInfo.get(exitKey);

      if (exit) {
        connections.unshift({
          fromRegion: previous,
          toRegion: current,
          exit: {
            type: 'exit',
            name: exit.name,
            fromRegion: previous,
            toRegion: current,
            rule: exit.access_rule,
            accessible: true, // Must be accessible since we're using it in our path
          },
        });
      }

      regions.unshift(previous);
      current = previous;
    }

    return {
      regions: regions,
      connections: connections,
    };
  }

  /**
   * Get an accessibility symbol based on the status
   * @param {string} status - 'accessible', 'inaccessible', or 'partial'
   * @returns {string} - HTML for the symbol
   */
  _getAccessibilitySymbol(status) {
    if (!this.colorblindMode) return '';

    let symbol = '';
    switch (status) {
      case 'accessible':
        symbol = '✓';
        break;
      case 'inaccessible':
        symbol = '✗';
        break;
      case 'partial':
        symbol = '⚠';
        break;
      default:
        return '';
    }

    return `<span class="colorblind-symbol ${status}">${symbol}</span>`;
  }

  toggleColorblindMode() {
    this.colorblindMode = !this.colorblindMode;

    // Instead of re-running the path analysis which is expensive,
    // just update the existing elements directly:
    const regionContainer = document.getElementById('regions-panel');

    // Add a loading indicator during the DOM update
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = 'Updating display...';
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.zIndex = '9999';
    document.body.appendChild(loadingIndicator);

    // Use requestAnimationFrame to ensure UI updates before heavy processing
    requestAnimationFrame(() => {
      // Use small batches with setTimeout to avoid blocking the UI
      setTimeout(() => {
        // Update colorblind indicators on existing elements
        this._updateColorblindIndicators();

        // Remove loading indicator
        document.body.removeChild(loadingIndicator);
      }, 10);
    });
  }

  // Helper method to update colorblind indicators
  _updateColorblindIndicators() {
    // Update all region link indicators
    document.querySelectorAll('.region-link').forEach((link) => {
      // Remove any existing colorblind symbols
      const existingSymbol = link.querySelector('.colorblind-symbol');
      if (existingSymbol) existingSymbol.remove();

      // Get the region name and check if it's reachable
      const regionName = link.dataset.region;
      if (!regionName) return;

      const isReachable = stateManager.isRegionReachable(regionName);

      // Add colorblind symbol if needed
      if (this.colorblindMode) {
        const symbolSpan = document.createElement('span');
        symbolSpan.classList.add('colorblind-symbol');
        symbolSpan.textContent = isReachable ? ' ✓' : ' ✗';
        symbolSpan.classList.add(isReachable ? 'accessible' : 'inaccessible');
        link.appendChild(symbolSpan);
      }
    });

    // Update exit rules
    document
      .querySelectorAll('.path-exit-rule-container')
      .forEach((container) => {
        const isPassing = container.classList.contains('passing-exit');
        const header = container.querySelector('.path-exit-header');

        if (header) {
          // Remove existing symbol
          const existingSymbol = header.querySelector('.colorblind-symbol');
          if (existingSymbol) existingSymbol.remove();

          // Add new symbol if needed
          if (this.colorblindMode) {
            const symbolSpan = document.createElement('span');
            symbolSpan.classList.add('colorblind-symbol');
            symbolSpan.textContent = isPassing ? ' ✓' : ' ✗';
            symbolSpan.classList.add(isPassing ? 'accessible' : 'inaccessible');
            header.appendChild(symbolSpan);
          }
        }
      });

    // Update logic nodes
    document.querySelectorAll('.logic-node').forEach((node) => {
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
        node.appendChild(symbolSpan);
      }
    });
  }
}

export default RegionUI;
