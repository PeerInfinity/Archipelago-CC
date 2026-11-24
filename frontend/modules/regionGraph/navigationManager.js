import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { getRegionMovesFromPath } from '../shared/pathUtils.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import * as actions from '../regionView/regionActions.js';
import { isRegionGroupNode } from './subRegionGroups.js';

const logger = createUniversalLogger('regionGraph');

const menuPanelRestart = () => centralRegistry.getPublicFunction?.('menuPanel', 'restart')?.();

/**
 * NavigationManager - the Region Graph's movement: the player node, path labels, and the handles the click actions
 * run with (`_handles`; the actions live in `regionView/regionActions.js` and `regionView/clickActions.js`, shared with
 * the Region Map), plus the status flash and the Regions panel's "Show All Regions" box.
 */
export class NavigationManager {
  constructor(ui) {
    this.ui = ui;
  }

  /** The action handles. `gameState` is a getter, so a throwing singleton is caught where it is read. */
  _handles(dispatcher = null, { restart = menuPanelRestart } = {}) {
    return {
      dispatcher,
      stateManager,
      pathFinder: this.ui.pathFinder,
      get gameState() { return getGameStateSingleton(); },
      getRules: () => {
        const last = getLastRawJsonData();
        return { rules: last?.rawJsonData ?? null, playerId: String(last?.selectedPlayerInfo?.playerId ?? '1') };
      },
      restart,
    };
  }

  /** "No path" in the status bar for 2 s, then the region/connection count again. */
  _flashNoPath(text) {
    this.ui.updateStatus(text);
    setTimeout(() => {
      if (this.ui.cy) {
        const nodeCount = this.ui.cy.nodes().filter((n) => !isRegionGroupNode(n)).length;
        const edgeCount = this.ui.cy.edges().length;
        this.ui.updateStatus(`Loaded ${nodeCount} regions, ${edgeCount} connections`);
      }
    }, 2000);
  }

  /**
   * Get the primary start region from stateManager, with fallback
   * @returns {string} The primary start region name
   */
  getPrimaryStartRegion() {
    return actions.primaryStartRegion(this._handles());
  }

  /**
   * Check if a region is a start region
   * @param {string} regionName - The region to check
   * @returns {boolean} Whether the region is a start region
   */
  isStartRegion(regionName) {
    return actions.isStartRegion(this._handles(), regionName);
  }

  onPathUpdate(data) {
    if (!data || !data.path) return;

    logger.debug(`Path updated with ${data.path.length} entries`);

    // Store the path data (filter for only regionMove entries)
    this.ui.currentPath = getRegionMovesFromPath(data.path);
    this.ui.regionPathCounts = data.regionCounts || new Map();
    logger.debug(`Filtered to ${this.ui.currentPath.length} region moves`);

    // Update node labels to include path counts
    if (this.ui.cy) {
      this.ui.cy.nodes().forEach(node => {
        // Skip location nodes, player nodes and group boxes - only update region nodes
        if (node.hasClass('location-node') || node.hasClass('player') || isRegionGroupNode(node)) {
          return;
        }

        const regionName = node.id();
        const count = this.ui.regionPathCounts.get(regionName) || 0;

        // In discovery mode, undiscovered regions show ??? or name depending on setting
        const isDiscoveryModeActive = this.ui.isDiscoveryModeActive || false;
        const showUndiscoveredNames = this.ui.discoverySettings?.showUndiscoveredRegionNames || false;
        if (isDiscoveryModeActive && !discoveryStateSingleton.isRegionDiscovered(regionName)) {
          if (showUndiscoveredNames && !node.hasClass('discovery-hidden')) {
            const staticData = stateManager.getStaticData();
            const regionData = staticData?.regions?.get(regionName);
            node.data('label', regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' '));
          } else {
            node.data('label', '???');
          }
          node.removeClass('in-path path-single path-multiple');
        } else {
          // Update the label to include count if region is in path
          const staticData = stateManager.getStaticData();
          const regionData = staticData?.regions?.get(regionName);
          const baseText = regionData ? this.ui.getRegionDisplayText(regionData) : regionName.replace(/_/g, ' ');

          if (count > 0) {
            node.data('label', `${baseText} (${count})`);
            node.addClass('in-path');

            // Add different classes based on count for visual distinction
            if (count === 1) {
              node.removeClass('path-multiple');
              node.addClass('path-single');
            } else {
              node.removeClass('path-single');
              node.addClass('path-multiple');
            }
          } else {
            node.data('label', baseText);
            node.removeClass('in-path path-single path-multiple');
          }
        }
      });

      // Highlight edges in the path
      this.ui.highlightPathEdges();

      // Update player position now that we have path data
      // Only update immediately if no layout is running, otherwise it will be handled by layoutstop
      if (!this.ui.isLayoutRunning) {
        const currentPlayerRegion = this.getCurrentPlayerLocation();
        if (currentPlayerRegion) {
          this.updatePlayerLocation(currentPlayerRegion);
        }
      } else {
        // Store the region for positioning after layout completes
        this.ui.initialPlayerRegion = this.getCurrentPlayerLocation();
        logger.debug('Deferring player positioning until layout completes');
      }
    }
  }

  updatePlayerLocation(regionName) {
    if (!this.ui.cy) return;

    logger.debug(`Updating player location to: ${regionName}`, { currentPath: this.ui.currentPath });

    // Remove existing player node
    this.ui.cy.remove('#player');

    // Find the target region node
    const regionNode = this.ui.cy.getElementById(regionName);
    if (!regionNode || regionNode.length === 0) {
      // Region may not exist yet (e.g. placeholder before rules load) or in this graph
      const staticData = stateManager.getStaticData?.();
      const existsInStaticData = staticData?.regions?.has(regionName);
      // Detect a stale cy graph: stateManager swapped to a new
      // preset's static data, but cy still holds the previous preset's
      // nodes (or nothing) because loadGraphData hasn't rebuilt yet.
      // Procgen presets in particular hit this on every load —
      // procgenPlayer synthesizes a Menu→region_X_Y user:regionMove
      // in its rulesLoaded handler, gameState propagates that as a
      // regionChanged synchronously, and the new region isn't in cy
      // yet. stateManagerProxy replaces staticDataCache wholesale on
      // each rules load, so reference equality against the cy graph's
      // last-built staticData is an exact, ordering-independent
      // staleness check.
      const isStaleGraph = existsInStaticData
        && staticData !== this.ui.lastBuiltStaticData;
      const logLevel = (!existsInStaticData
                        || !this.ui.graphInitialized
                        || this.isStartRegion(regionName)
                        || isStaleGraph) ? 'debug' : 'warn';
      logger[logLevel](`Region node not found: ${regionName}`);
      return;
    }

    // Get the position of the region node
    const regionPos = regionNode.position();
    logger.verbose(`${regionName} node position`, { regionPos });
    let playerPos = { x: regionPos.x + 30, y: regionPos.y - 30 }; // Default offset position
    logger.verbose('Default player position', { playerPos });

    // Check if player is at the end of the path and should be positioned at exit edge
    // Always use default positioning for start regions
    if (!this.isStartRegion(regionName) && this.ui.currentPath && this.ui.currentPath.length > 0) {
      const lastPathEntry = this.ui.currentPath[this.ui.currentPath.length - 1];
      logger.verbose('Last path entry', { lastPathEntry });

      // If player's current region is the last region in path AND we have exit info
      if (lastPathEntry.destinationRegion === regionName && lastPathEntry.exitUsed) {
        // Find the previous region in the path to determine the incoming edge
        const previousRegion = this.ui.currentPath.length > 1 ?
          this.ui.currentPath[this.ui.currentPath.length - 2].destinationRegion : null;

        logger.verbose(`Previous region in path: ${previousRegion}`);

        if (previousRegion) {
          // Get edge position for the incoming exit
          const exitEdgePos = this.getIncomingExitEdgePosition(regionName, previousRegion, lastPathEntry.exitUsed);

          if (exitEdgePos) {
            playerPos = exitEdgePos;
            logger.verbose('Using exit edge position for player', { playerPos });
          }
        }
      }
    }

    // Add player node at the determined position
    this.ui.cy.add({
      group: 'nodes',
      data: {
        id: 'player',
        label: '👤'
      },
      position: playerPos,
      classes: 'player'
    });

    // Lock the player node to prevent dragging
    this.ui.cy.getElementById('player').lock();

    logger.debug(`Player node added at ${regionName}`, { playerPos });

    // Also highlight the current region
    this.ui.highlightCurrentRegion(regionName);
  }

  getIncomingExitEdgePosition(targetRegionName, sourceRegionName, exitName) {
    // Find the edge that corresponds to the incoming connection
    const sourceNode = this.ui.cy.getElementById(sourceRegionName);
    const targetNode = this.ui.cy.getElementById(targetRegionName);

    if (!sourceNode || sourceNode.length === 0 || !targetNode || targetNode.length === 0) {
      return null;
    }

    // Look for edges between these two regions (in either direction)
    const allEdges = this.ui.cy.edges();

    for (let i = 0; i < allEdges.length; i++) {
      const edge = allEdges[i];
      const edgeData = edge.data();
      const edgeSource = edge.source().id();
      const edgeTarget = edge.target().id();

      // Check if this edge connects our source and target regions
      const isCorrectConnection = (edgeSource === sourceRegionName && edgeTarget === targetRegionName) ||
        (edgeSource === targetRegionName && edgeTarget === sourceRegionName);

      if (isCorrectConnection) {
        // Check if this edge corresponds to the exit we're looking for
        const hasCorrectExitName = edgeData.exitName === exitName ||
          edgeData.forwardExitName === exitName ||
          edgeData.reverseExitName === exitName ||
          (edgeData.label && edgeData.label.includes(exitName));

        if (hasCorrectExitName) {
          const sourcePos = sourceNode.position();
          const targetPos = targetNode.position();

          // Calculate a position along the edge, closer to the target (85% from source to target)
          const t = 0.85;
          const edgePos = {
            x: sourcePos.x + (targetPos.x - sourcePos.x) * t,
            y: sourcePos.y + (targetPos.y - sourcePos.y) * t
          };

          return edgePos;
        }
      }
    }

    // If we couldn't find the specific exit edge, return null to use default positioning
    return null;
  }

  getCurrentPlayerLocation() {
    return actions.currentRegionOf(this._handles(), { onError: (error) => logger.warn('Error getting player location:', error) });
  }

  // The click moves (one step / direct / add to path / overwrite path) left this class in CA-S2: a click runs the
  // panel's click actions (`regionView/clickActions.js` `runClickActions`, see `graphInteractionManager.js`), and the
  // status texts are `clickActions.routeStatusText`. ⚖ "Move player one step" is removed (user, 2026-11-17).

  _reportRestart(from, to, region) {
    logger.info(`No walk from ${from} to ${to}: Restart (→ ${region})`);
    this.ui.updateStatus(`Restart → ${region} (no walk from ${from} to ${to})`);
  }

  /**
   * ⛓ RETURN TO MENU — when the route from `from` to `to` begins with RESTART (`planRoute`: no walk, the flag set,
   * a walk from the restart target), take the Menu panel's Restart and say so. Returns true when it did.
   */
  takeRestartStepToward(from, to, { restart = menuPanelRestart } = {}) {
    const r = actions.takeRestartStep(this._handles(null, { restart }), from, to);
    if (!r.ok) return false;
    this._reportRestart(from, to, r.region);
    return true;
  }

  /**
   * The accessibility/adjacency map pathFinder reads for exit lookups (now `regionActions.buildAdjacencyMap`).
   * @private
   */
  _buildAdjacencyMap() {
    return actions.buildAdjacencyMap(this._handles());
  }

  setShowAllRegions(enabled) {
    // Find the "Show All Regions" checkbox in the Regions panel and set its state
    const showAllCheckbox = document.querySelector('#show-all-regions');
    if (showAllCheckbox && showAllCheckbox.checked !== enabled) {
      showAllCheckbox.checked = enabled;
      // Trigger change event to update the regions display
      showAllCheckbox.dispatchEvent(new Event('change'));
      logger.debug(`Set "Show All Regions" to ${enabled}`);
    }
  }
}