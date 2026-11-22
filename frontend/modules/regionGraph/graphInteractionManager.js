import { getModuleEventBus, getNodeLabelProvider, moduleDispatcher } from './index.js';
import settingsManager from '../../app/core/settingsManager.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { runClickActions, clickStatusOf, REGION_CLICKED, LOCATION_CLICKED } from '../regionView/clickActions.js';
import { REGION_GRAPH_ORIGINATORS } from './regionGraphOriginators.js';

const logger = createUniversalLogger('regionGraph');

/**
 * GraphInteractionManager - Handles all user interactions with the graph
 */
export class GraphInteractionManager {
  constructor(ui) {
    this.ui = ui;
    Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });
  }

  setupEventHandlers() {
    this.ui.cy.on('tap', 'node', (evt) => {
      const node = evt.target;

      // Skip if this is the player node
      if (node.hasClass('player')) {
        return;
      }

      // Handle location node clicks
      if (node.hasClass('location-node')) {
        this.handleLocationNodeClick(node);
        return; // Don't process as region node
      }

      // Handle region node clicks
      this.handleRegionNodeClick(node);
    });

    this.ui.cy.on('layoutstop', () => {
      // Keep isLayoutRunning true during animation to prevent premature player positioning

      // Capture the current layout generation so we can detect if the graph
      // was rebuilt before this timeout fires (stale layoutstop from a stopped layout)
      const generation = this.ui.layoutGeneration;

      // Wait for the animation to complete before saving positions and positioning player
      // Animation duration is 1000ms as defined in runLayout
      setTimeout(() => {
        // Skip if the graph was rebuilt since this layout started
        if (generation !== this.ui.layoutGeneration) {
          logger.debug('Skipping stale layoutstop timeout (generation mismatch)');
          return;
        }

        this.ui.isLayoutRunning = false;
        this.ui.saveNodePositions();
        this.ui.dataManager.reseatLocationNodes();
        this.ui.updateStatus('Layout complete');

        // Position the player after layout animation is complete (for initial load)
        if (this.ui.initialPlayerRegion && !this.ui.cy.getElementById('player').length) {
          logger.debug(`Positioning player after layout animation at ${this.ui.initialPlayerRegion}`);
          this.ui.updatePlayerLocation(this.ui.initialPlayerRegion);
          this.ui.initialPlayerRegion = null; // Clear it so we don't reposition on subsequent layouts

          // Refresh node colors now that layout and player positioning are complete
          const snapshot = stateManager.getLatestStateSnapshot();
          if (snapshot) {
            this.ui.dataManager.onStateUpdate({ snapshot });
          }
        }
      }, 1050); // Wait for layout animation (1000ms) plus buffer
    });

    // Hover-mode location visibility. Show this region's locations on
    // mouseover; the previous region's locations (if any) get hidden
    // first so only one region's set is up at a time. Empty graph area
    // and the location ring itself don't trigger hide — locations only
    // disappear when entering a different region or leaving the panel.
    this.ui.cy.on('mouseover', 'node.region', (evt) => {
      if (this.ui.locationVisibilityMode !== 'hover') return;
      const node = evt.target;
      if (node.hasClass('player') || node.hasClass('location-node')) return;
      const regionId = node.id();
      if (this.ui._hoveredLocationRegion === regionId) return;
      if (this.ui._hoveredLocationRegion) {
        this.ui.hideLocationNodesForRegion(this.ui._hoveredLocationRegion);
      }
      this.ui.showLocationNodesForRegion(regionId);
      this.ui._hoveredLocationRegion = regionId;
    });
    if (this.ui.graphContainer) {
      this.ui.graphContainer.addEventListener('mouseleave', () => {
        if (this.ui.locationVisibilityMode !== 'hover') return;
        if (this.ui._hoveredLocationRegion) {
          this.ui.hideLocationNodesForRegion(this.ui._hoveredLocationRegion);
          this.ui._hoveredLocationRegion = null;
        }
      });
    }

    // Update location nodes when region nodes are dragged
    this.ui.cy.on('drag', 'node.region', (evt) => {
      const regionNode = evt.target;
      if (!regionNode.hasClass('player') && !regionNode.hasClass('location-node')) {
        // Update positions during drag
        this.ui.updateLocationNodePositions(regionNode.id());
      }
    });

    // Also update on dragfree (end of drag) to ensure final positions are correct
    this.ui.cy.on('dragfree', 'node.region', (evt) => {
      const regionNode = evt.target;
      if (!regionNode.hasClass('player') && !regionNode.hasClass('location-node')) {
        this.ui.updateLocationNodePositions(regionNode.id());
      }
    });

    const resetButton = this.ui.controlPanel.querySelector('#resetView');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.ui.cy.fit(30);
      });
    }

    const relayoutButton = this.ui.controlPanel.querySelector('#relayout');
    if (relayoutButton) {
      relayoutButton.addEventListener('click', () => {
        this.ui.runLayout(true);
      });
    }

    const exportButton = this.ui.controlPanel.querySelector('#exportPositions');
    if (exportButton) {
      exportButton.addEventListener('click', () => {
        this.ui.exportNodePositions();
      });
    }

    const controlsHeader = this.ui.controlPanel.querySelector('#controlsHeader');
    if (controlsHeader) {
      controlsHeader.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ui.toggleControlPanel();
      });
    }

    // 4-way location visibility radio: hover | zoom | force-show | force-hide.
    // Hover lets the per-region mouseover handlers below drive visibility;
    // zoom keeps the original "auto-show past threshold" behavior; the two
    // force modes pin locations on or off regardless of zoom or hover.
    const radios = this.ui.controlPanel.querySelectorAll(
      'input[name="locationVisibility"]');
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        const mode = e.target.value;
        this.ui.locationVisibilityMode = mode;
        // Leaving hover mode while a region's locations are showing? Drop
        // them so the new mode starts from a clean state.
        if (mode !== 'hover' && this.ui._hoveredLocationRegion) {
          this.ui.hideLocationNodesForRegion(this.ui._hoveredLocationRegion);
          this.ui._hoveredLocationRegion = null;
        }
        settingsManager.updateSetting?.(
          'moduleSettings.regionGraph.locationVisibility', mode);
        this.updateZoomBasedVisibility();
      });
    });
  }

  /**
   * ⛓ A click on a location node (a tap, or the "Go to" picker): the panel's LOCATION click actions
   * (`moduleSettings.regionGraph.clickActions.location`, the "On click" strip; slice CA-S2).
   */
  handleLocationNodeClick(node) {
    const locationName = node.data('locationName') || node.data('label');
    const parentRegion = node.data('parentRegion');

    logger.debug(`Location node clicked: ${locationName} in ${parentRegion}`);
    // ⛓ CA-S4: the generic click event (design §4.3), before the actions, as the Region Map publishes it.
    this.eventBus.publish(LOCATION_CLICKED, { panelId: 'regionGraph', regionName: parentRegion, locationName });
    return this.runClick('location', { regionName: parentRegion, locationName });
  }

  /**
   * ⛓ A click on a region node (a tap, the "Go to" picker, or an overlay card's body): select it (the visual select
   * state), publish the generic `regionView:regionClicked` (CA-S4), then run the panel's REGION click actions.
   * CA-S5 retired `regionGraph:nodeSelected`, which was published here first: nothing in the app heard it.
   */
  handleRegionNodeClick(node) {
    const regionName = node.id(); // Node ID is the region name

    this.ui.selectedNode = regionName;

    logger.debug(`Node clicked: ${regionName}`);

    // Update visual selection
    this.ui.cy.$('node').removeClass('selected');
    node.addClass('selected');

    // ⛓ CA-S4: the generic click event (design §4.3), the Region Map's shape; apcalc and vibeCodingSim hear it.
    this.eventBus.publish(REGION_CLICKED, { panelId: 'regionGraph', regionName });

    return this.runClick('region', { regionName });
  }

  /**
   * The handles the click actions run with (CA-S1 §6.3): the navigation manager's (`stateManager`, `pathFinder`,
   * `gameState`, `getRules`, `restart`) with THIS module's dispatcher, its event bus, its originators, the planners'
   * error log, and "Show All Regions" off before a path edit runs (§6.2: the path edits always did that).
   */
  clickHandles() {
    const nav = this.ui.navigationManager;
    const h = nav._handles(moduleDispatcher);
    return Object.assign(h, {
      eventBus: this.eventBus,
      originators: REGION_GRAPH_ORIGINATORS,
      onError: (error) => logger.warn('Error getting player location:', error),
      beforePathExecute: () => nav.setShowAllRegions(false),
    });
  }

  /**
   * Run the enabled click actions for one click (`runClickActions`, in the R8 order: path, checks, panel actions),
   * then show the route's result in the status bar as the moves always did. → the `runClickActions` answer, or null
   * when the module dispatcher is not up yet (before `initialize`).
   */
  runClick(target, ctx) {
    if (!moduleDispatcher) {
      logger.warn('moduleDispatcher not available: the click actions did not run');
      return null;
    }
    const settings = this.ui.clickActions;
    const discovery = { active: this.ui.isDiscoveryModeActive, settings: this.ui.discoverySettings };
    const result = runClickActions('regionGraph', target, { ...ctx, discovery }, settings, this.clickHandles());
    if (result.skipped?.length) logger.debug('Click actions not loaded:', result.skipped.map((s) => s.id));
    const status = clickStatusOf(result, ctx, settings);
    if (status) {
      if (status.from === 'player' && status.text.startsWith('No path to')) this.ui.navigationManager._flashNoPath(status.text);
      else this.ui.updateStatus(status.text);
    }
    return result;
  }


  highlightCurrentRegion(regionName) {
    if (!this.ui.cy) return;

    this.ui.cy.nodes().removeClass('current');

    const node = this.ui.cy.getElementById(regionName);
    if (node && node.length > 0) {
      node.addClass('current');
    }
  }

  highlightPathEdges() {
    if (!this.ui.cy) return;

    // Remove existing path highlighting from edges
    this.ui.cy.edges().removeClass('in-path');

    // Get the full path including location checks from gameState
    import('../gameState/singleton.js').then(({ getGameStateSingleton }) => {
      const gameState = getGameStateSingleton();
      const fullPath = gameState.getPath();

      if (!fullPath || fullPath.length < 1) return;

      // Highlight edge from start region to first destination
      if (this.ui.currentPath.length > 0 && this.ui.currentPath[0].sourceRegion) {
        const firstSource = this.ui.currentPath[0].sourceRegion;
        const firstDest = this.ui.currentPath[0].destinationRegion;
        const firstEdge = this.ui.cy.edges(`[source="${firstSource}"][target="${firstDest}"], [source="${firstDest}"][target="${firstSource}"]`);
        if (firstEdge && firstEdge.length > 0) {
          firstEdge.addClass('in-path');
        }
      }

      // Highlight edges between consecutive regions in the path (regionMove entries)
      for (let i = 0; i < this.ui.currentPath.length - 1; i++) {
        const source = this.ui.currentPath[i].destinationRegion;
        const target = this.ui.currentPath[i + 1].destinationRegion;

        // Find edge between source and target (consider both directions)
        const edge = this.ui.cy.edges(`[source="${source}"][target="${target}"], [source="${target}"][target="${source}"]`);
        if (edge && edge.length > 0) {
          edge.addClass('in-path');
        }
      }

      // Also highlight edges to checked locations in the path (only if location nodes are visible)
      if (this.ui.locationsVisible) {
        fullPath.forEach(entry => {
          if (entry.type === 'locationCheck') {
            const locationNodeId = `loc_${entry.sourceRegion}_${entry.locationName}`;
            const locationNode = this.ui.cy.getElementById(locationNodeId);

            if (locationNode && locationNode.length > 0) {
              // Highlight the edge from region to location
              const edge = this.ui.cy.edges(`[source="${entry.sourceRegion}"][target="${locationNodeId}"]`);
              if (edge && edge.length > 0) {
                edge.addClass('in-path');
              }
            }
          }
        });
      }
    }).catch(error => {
      logger.error('Error getting path for edge highlighting:', error);
    });
  }

  setupZoomBasedVisibility() {
    // Initialize zoom tracking
    this.ui.currentZoomLevel = this.ui.cy.zoom();
    this.ui.locationsVisible = false;

    // Initialize debounce timer for viewport-based location refresh
    this.viewportRefreshTimer = null;

    // Listen to zoom/pan events
    this.ui.cy.on('zoom pan', () => {
      this.updateZoomBasedVisibility();
      this.ui.updateLocationNodeZOrder();

      // Debounced refresh for viewport-filtered locations
      this.scheduleViewportRefresh();
    });

    // Also update z-order when viewport changes
    this.ui.cy.on('viewport', () => {
      this.ui.updateLocationNodeZOrder();

      // Debounced refresh for viewport-filtered locations
      this.scheduleViewportRefresh();
    });
  }

  /**
   * Schedule a debounced refresh of location nodes when viewport changes.
   * Triggers if locations are visible and viewport-dependent features are enabled
   * (either onlyShowLocationsInView or maxLocationNodes limit).
   */
  scheduleViewportRefresh() {
    // Only schedule refresh if locations are visible
    if (!this.ui.locationsVisible) {
      return;
    }

    // Check if any viewport-dependent feature is enabled
    const hasLocationLimit = (this.ui.maxLocationNodes ?? 100) > 0;
    const hasViewportFilter = this.ui.onlyShowLocationsInView ?? false;

    // Only refresh if a viewport-dependent feature is active
    if (!hasViewportFilter && !hasLocationLimit) {
      return;
    }

    // Clear any existing timer
    if (this.viewportRefreshTimer) {
      clearTimeout(this.viewportRefreshTimer);
    }

    // Get the stabilize delay (default 1000ms)
    const delay = this.ui.viewportStabilizeDelay ?? 1000;

    // Schedule the refresh
    this.viewportRefreshTimer = setTimeout(() => {
      this.viewportRefreshTimer = null;
      if (this.ui.locationsVisible) {
        logger.debug('Viewport stabilized, refreshing location nodes');
        this.ui.refreshLocationNodes();
      }
    }, delay);
  }

  updateZoomBasedVisibility() {
    const zoom = this.ui.cy.zoom();
    const prevZoom = this.ui.currentZoomLevel;
    this.ui.currentZoomLevel = zoom;

    const mode = this.ui.locationVisibilityMode || 'hover';
    if (mode === 'force-show') {
      if (!this.ui.locationsVisible) {
        this.ui.showAllLocationNodes();
        this.ui.locationsVisible = true;
      }
    } else if (mode === 'force-hide') {
      if (this.ui.locationsVisible) {
        this.ui.hideAllLocationNodes();
        this.ui.locationsVisible = false;
      }
    } else if (mode === 'zoom') {
      if (zoom >= this.ui.zoomLevels.showLocationNodes && !this.ui.locationsVisible) {
        this.ui.showAllLocationNodes();
        this.ui.locationsVisible = true;
      } else if (zoom < this.ui.zoomLevels.showLocationNodes && this.ui.locationsVisible) {
        this.ui.hideAllLocationNodes();
        this.ui.locationsVisible = false;
      }
    } else {
      // 'hover' mode — bulk visibility stays off; the per-region
      // mouseover handlers manage individual regions' location nodes.
      // If a previous mode left bulk locations visible, clear them.
      if (this.ui.locationsVisible) {
        this.ui.hideAllLocationNodes();
        this.ui.locationsVisible = false;
      }
    }

    // Update label visibility based on zoom and manual overrides
    this.updateLabelVisibility(zoom);
  }

  updateLabelVisibility(zoom) {
    // Force-show mode: show location labels at the same zoom as region labels.
    const forceShowLocationLabels = this.ui.locationVisibilityMode === 'force-show';
    const edgeLabelStyle = this.ui.edgeLabelsHidden ? '' : 'data(label)';

    // Update visibility of labels based on zoom level
    if (zoom < this.ui.zoomLevels.hideAllLabels) {
      // Hide all labels
      this.ui.cy.style()
        .selector('node').style('label', '')
        .selector('edge').style('label', '')
        .update();
    } else if (zoom < this.ui.zoomLevels.showRegionNames) {
      // Still hide all labels
      this.ui.cy.style()
        .selector('node').style('label', '')
        .selector('edge').style('label', '')
        .update();
    } else if (zoom < this.ui.zoomLevels.showRegionCounts) {
      // Show only region names, no counts
      const staticData = stateManager.getStaticData();
      const isDiscoveryModeActive = this.ui.isDiscoveryModeActive || false;
      const showUndiscoveredNames = this.ui.discoverySettings?.showUndiscoveredRegionNames || false;
      this.ui.cy.nodes().forEach(node => {
        if (!node.hasClass('location-node') && !node.hasClass('player')) {
          const regionName = node.data('regionName') || node.id();
          if (isDiscoveryModeActive && !discoveryStateSingleton.isRegionDiscovered(regionName)) {
            if (showUndiscoveredNames && !node.hasClass('discovery-hidden')) {
              const regionData = staticData?.regions?.get(regionName);
              node.data('label', regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' '));
            } else {
              node.data('label', '???');
            }
          } else {
            const regionData = staticData?.regions?.get(regionName);
            const displayText = regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' ');
            node.data('label', displayText);
          }
        }
      });
      // Apply the labels and hide edge labels
      // Show location labels if forced (at same zoom as region labels)
      this.ui.cy.style()
        .selector('node.region').style('label', 'data(label)')
        .selector('.location-node').style('label', forceShowLocationLabels ? 'data(label)' : '')
        .selector('edge').style('label', '')
        .update();
    } else if (zoom < this.ui.zoomLevels.showRegionEdgeLabels) {
      // Show region names with counts
      this.updateRegionLabelsWithCounts();
      // Show location labels if forced (at same zoom as region labels)
      this.ui.cy.style()
        .selector('node.region').style('label', 'data(label)')
        .selector('.location-node').style('label', forceShowLocationLabels ? 'data(label)' : '')
        .selector('edge').style('label', '')
        .update();
    } else if (zoom < this.ui.zoomLevels.showLocationNodes) {
      // Show region nodes with counts and edge labels
      this.updateRegionLabelsWithCounts();
      // Apply all labels except location nodes (unless forced)
      this.ui.cy.style()
        .selector('node.region').style('label', 'data(label)')
        .selector('node.player').style('label', 'data(label)')
        .selector('.location-node').style('label', forceShowLocationLabels ? 'data(label)' : '')
        .selector('edge[label]').style('label', edgeLabelStyle)
        .selector('.region-location-edge').style('label', '')
        .update();
    } else if (zoom < this.ui.zoomLevels.showLocationLabels) {
      // Show everything except location labels
      this.updateRegionLabelsWithCounts();
      this.ui.cy.style()
        .selector('node.region').style('label', 'data(label)')
        .selector('node.player').style('label', 'data(label)')
        .selector('.location-node').style('label', forceShowLocationLabels ? 'data(label)' : '')
        .selector('edge[label]').style('label', edgeLabelStyle)
        .selector('.region-location-edge').style('label', '')
        .update();
    } else {
      // Show everything including location labels
      this.updateRegionLabelsWithCounts();
      this.ui.cy.style()
        .selector('node.region').style('label', 'data(label)')
        .selector('node.player').style('label', 'data(label)')
        .selector('.location-node').style('label', 'data(label)')
        .selector('edge[label]').style('label', edgeLabelStyle)
        .selector('.region-location-edge').style('label', '')
        .update();
    }

    // Reapply path highlighting after any style updates that might have reset it
    this.highlightPathEdges();
  }

  updateRegionLabelsWithCounts() {
    const staticData = stateManager.getStaticData();
    const isDiscoveryModeActive = this.ui.isDiscoveryModeActive || false;
    const showUndiscoveredNames = this.ui.discoverySettings?.showUndiscoveredRegionNames || false;
    const hasLabelProvider = !!getNodeLabelProvider();
    this.ui.cy.nodes().forEach(node => {
      if (!node.hasClass('location-node') && !node.hasClass('player')) {
        const regionName = node.data('regionName') || node.id();
        // In discovery mode, undiscovered regions show ??? or name depending on setting
        if (isDiscoveryModeActive && !discoveryStateSingleton.isRegionDiscovered(regionName)) {
          if (showUndiscoveredNames && !node.hasClass('discovery-hidden')) {
            const regionData = staticData?.regions?.get(regionName);
            node.data('label', regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' '));
          } else {
            node.data('label', '???');
          }
        } else if (hasLabelProvider) {
          // External label provider controls the label — don't add counts
          // (label already set by onStateUpdate)
        } else {
          const regionData = staticData?.regions?.get(regionName);
          const locationCounts = node.data('locationCounts');
          if (locationCounts && locationCounts.total > 0) {
            const displayText = regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' ');
            const countLabel = `${locationCounts.checked}, ${locationCounts.accessible}, ${locationCounts.inaccessible} / ${locationCounts.total}`;
            node.data('label', `${displayText}\n${countLabel}`);
          } else {
            const displayText = regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' ');
            node.data('label', displayText);
          }
        }
      }
    });
  }
}