/**
 * ⛓ THE REGION GRAPH'S CLICK HANDLERS AS THEY WERE BEFORE CA-S2 — a FROZEN ORACLE for
 * `clickActions.equivalence.test.js`, and nothing else (no app code imports it).
 *
 * CA-S2 replaced the seven "On Region Node Click" checkboxes and the handler branches that read them with
 * `runClickActions` over `moduleSettings.regionGraph.clickActions`. Its equivalence re-run compares the ADOPTED
 * handlers against these, so they are kept here VERBATIM, extracted with `git show` from base
 * `41561f80944bec3b764d5cc307f71cf15a1e0326` (train 157):
 *   - `LegacyGraphInteraction` = `regionGraph/graphInteractionManager.js` lines 240-392
 *     (`handleLocationNodeClick`, `dispatchLocationCheckEvent`, `handleRegionNodeClick`, `checkAllLocationsInRegion`);
 *   - `LegacyNavigation` = `regionGraph/navigationManager.js` lines 40-49 (`_flashNoPath`) and 284-425
 *     (`attemptMovePlayerOneStepToRegion`, `_reportRestart`, `takeRestartStepToward`,
 *     `attemptMovePlayerDirectlyToRegion`, `addToPath`, `overwritePath`).
 * Only the imports, the class wrappers, `LegacyNavigation`'s `_handles` (the base's, with a null menu restart: the
 * table's planners are recorders) and `setShowAllRegions` (delegated to `ui`) are new; in the bodies, the dynamic
 * `import('./index.js')` is re-pointed to `'../regionGraph/index.js'` (the same module, from this directory).
 * ⛔ Do not edit the method bodies otherwise: they are the measurement.
 * CA-S3: `REGION_GRAPH_SOURCES` left `regionGraph/regionGraphOriginators.js` (only tests named it once the Region Map's
 * interim reader was retired); the base's value is kept here, where the bodies read it. `actions.planOneStepMove` left
 * `regionActions.js` too: the equivalence test's recorder supplies it.
 * CA-S5: `regionGraph:nodeSelected` was RETIRED. `REGION_GRAPH_NODE_SELECTED` and `actions.publishNodeSelected` left the
 * app; the base's name is kept here and the recorder supplies `publishNodeSelected`, so the base's `select` publish is
 * still measured, as the retired channel the equivalence test counts.
 */
import settingsManager from '../../app/core/settingsManager.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import * as actions from './regionActions.js';
import { REGION_GRAPH_ORIGINATORS } from '../regionGraph/regionGraphOriginators.js';

/** The base's event name (`regionGraph/regionGraphOriginators.js` until CA-S5, which retired the event). */
const REGION_GRAPH_NODE_SELECTED = 'regionGraph:nodeSelected';

/** The Region Graph's `user:regionMove` sources at base (`regionGraph/regionGraphOriginators.js` until CA-S3). */
export const REGION_GRAPH_SOURCES = Object.freeze({
    oneStep: 'regionGraph-oneStep',
    direct: 'regionGraph-direct',
    addToPath: 'regionGraph-addToPath',
    overwritePath: 'regionGraph-overwritePath',
});

const logger = createUniversalLogger('regionGraph');
const menuPanelRestart = () => null;

export class LegacyGraphInteraction {
  constructor(ui, eventBus) {
    this.ui = ui;
    this.eventBus = eventBus;
  }

  handleLocationNodeClick(node) {
    const locationName = node.data('locationName') || node.data('label');
    const parentRegion = node.data('parentRegion');

    logger.debug(`Location node clicked: ${locationName} in ${parentRegion}`);

    // Discovery mode: if location checks are disabled, skip the check
    if (!actions.locationChecksAllowed({ active: this.ui.isDiscoveryModeActive, settings: this.ui.discoverySettings })) {
      logger.debug(`Location check disabled by discovery settings, skipping: ${locationName}`);
      return;
    }

    // Check which actions are enabled via checkboxes (same logic as region nodes)
    const movePlayerOneStepCheckbox = this.ui.controlPanel.querySelector('#movePlayerOneStep');
    const movePlayerDirectlyCheckbox = this.ui.controlPanel.querySelector('#movePlayerDirectly');
    const showRegionCheckbox = this.ui.controlPanel.querySelector('#showRegionInPanel');
    const addToPathCheckbox = this.ui.controlPanel.querySelector('#addToPath');
    const overwritePathCheckbox = this.ui.controlPanel.querySelector('#overwritePath');

    // Check if we should add to path (use settings)
    settingsManager.getSetting('moduleSettings.regionGraph.addLocationsToPath', false).then(shouldAddToPath => {
      if (shouldAddToPath) {
        logger.debug(`Adding location ${locationName} to path in region ${parentRegion}`);

        // First, navigate to the region using the same logic as region node clicks
        if (addToPathCheckbox && addToPathCheckbox.checked) {
          this.ui.addToPath(parentRegion, movePlayerOneStepCheckbox && movePlayerOneStepCheckbox.checked);
        } else if (overwritePathCheckbox && overwritePathCheckbox.checked) {
          this.ui.overwritePath(parentRegion, movePlayerOneStepCheckbox && movePlayerOneStepCheckbox.checked);
        } else {
          // Neither path option is checked - handle move player options
          if (movePlayerOneStepCheckbox && movePlayerOneStepCheckbox.checked) {
            this.ui.attemptMovePlayerOneStepToRegion(parentRegion);
          }
          if (movePlayerDirectlyCheckbox && movePlayerDirectlyCheckbox.checked) {
            this.ui.attemptMovePlayerDirectlyToRegion(parentRegion);
          }
        }

        // Then add the location check to the path
        import('../gameState/singleton.js').then(({ getGameStateSingleton }) => {
          actions.addLocationCheckToPath({ gameState: getGameStateSingleton() }, locationName, parentRegion);
          logger.debug(`Added location ${locationName} to player path`);
          // The path update will automatically trigger highlightPathEdges via the event system
        }).catch(error => {
          logger.error('Error adding location to path:', error);
        });
      } else {
        // Original behavior - dispatch location check event
        this.dispatchLocationCheckEvent(locationName, parentRegion);
      }
    }).catch(error => {
      logger.error('Error getting setting:', error);
      // Fallback to original behavior
      this.dispatchLocationCheckEvent(locationName, parentRegion);
    });
  }

  dispatchLocationCheckEvent(locationName, parentRegion) {
    import('../regionGraph/index.js').then(({ moduleDispatcher }) => {
      const r = actions.checkLocation({ dispatcher: moduleDispatcher },
        { locationName, regionName: parentRegion, originator: REGION_GRAPH_ORIGINATORS.check });
      if (r.ok) {
        logger.debug('Dispatched user:locationCheck', { locationName, regionName: parentRegion });
      } else {
        logger.error('moduleDispatcher not available to handle location check.');
      }
    }).catch(error => {
      logger.error('Error importing moduleDispatcher:', error);
    });
  }

  handleRegionNodeClick(node) {
    const regionName = node.id(); // Node ID is the region name

    this.ui.selectedNode = regionName;

    logger.debug(`Node clicked: ${regionName}`);

    // Update visual selection
    this.ui.cy.$('node').removeClass('selected');
    node.addClass('selected');

    // Publish the custom regionGraph event for any other listeners
    actions.publishNodeSelected({ eventBus: this.eventBus }, REGION_GRAPH_NODE_SELECTED, regionName, node.data());

    // Check which actions are enabled via checkboxes
    const movePlayerOneStepCheckbox = this.ui.controlPanel.querySelector('#movePlayerOneStep');
    const movePlayerDirectlyCheckbox = this.ui.controlPanel.querySelector('#movePlayerDirectly');
    const showRegionCheckbox = this.ui.controlPanel.querySelector('#showRegionInPanel');
    const addToPathCheckbox = this.ui.controlPanel.querySelector('#addToPath');
    const overwritePathCheckbox = this.ui.controlPanel.querySelector('#overwritePath');

    // Handle path modifications (Add to path or Overwrite path)
    if (addToPathCheckbox && addToPathCheckbox.checked) {
      this.ui.addToPath(regionName, movePlayerOneStepCheckbox && movePlayerOneStepCheckbox.checked);
    } else if (overwritePathCheckbox && overwritePathCheckbox.checked) {
      this.ui.overwritePath(regionName, movePlayerOneStepCheckbox && movePlayerOneStepCheckbox.checked);
    } else {
      // Neither path option is checked - handle move player options
      // Move player one step towards region (if enabled)
      if (movePlayerOneStepCheckbox && movePlayerOneStepCheckbox.checked) {
        this.ui.attemptMovePlayerOneStepToRegion(regionName);
      }

      // Move player directly to region (if enabled)
      if (movePlayerDirectlyCheckbox && movePlayerDirectlyCheckbox.checked) {
        this.ui.attemptMovePlayerDirectlyToRegion(regionName);
      }
    }

    // Show region in Regions panel (if enabled)
    if (showRegionCheckbox && showRegionCheckbox.checked) {
      // Control "Show All Regions" based on path modification checkboxes
      const shouldShowAll = !(addToPathCheckbox?.checked || overwritePathCheckbox?.checked);
      this.ui.setShowAllRegions(shouldShowAll);

      // Activate the regions panel and navigate it to the region
      actions.showRegionInRegionsPanel({ eventBus: this.eventBus }, regionName);
      logger.debug(`Published ui:activatePanel + ui:navigateToRegion for ${regionName}`);
    }

    // Check all locations in region (if enabled)
    const checkAllLocationsCheckbox = this.ui.controlPanel.querySelector('#checkAllLocationsInRegion');
    if (checkAllLocationsCheckbox && checkAllLocationsCheckbox.checked) {
      this.checkAllLocationsInRegion(regionName);
    }
  }

  checkAllLocationsInRegion(regionName) {
    // Discovery mode: if location checks are disabled, skip
    if (!actions.locationChecksAllowed({ active: this.ui.isDiscoveryModeActive, settings: this.ui.discoverySettings })) {
      logger.debug(`Location checks disabled by discovery settings, skipping bulk check for: ${regionName}`);
      return;
    }

    // The state is read now; the candidates are evaluated once the dispatcher is in hand (as before).
    const staticData = stateManager.getStaticData();
    const regionData = staticData?.regions?.get(regionName);
    if (regionData && regionData.locations && regionData.locations.length > 0) {
      const snapshot = stateManager.getLatestStateSnapshot();
      import('../regionGraph/index.js').then(({ moduleDispatcher }) => {
        const { checked } = actions.checkAccessibleLocationsInRegion(
          { dispatcher: moduleDispatcher, stateManager }, regionName,
          { originator: REGION_GRAPH_ORIGINATORS.bulkCheck, snapshot, staticData });
        if (checked > 0) {
          logger.debug(`Checked ${checked} accessible locations in ${regionName}`);
        }
      }).catch(error => {
        logger.error('Error importing moduleDispatcher for bulk location check:', error);
      });
    }
  }
}

export class LegacyNavigation {
  constructor(ui) {
    this.ui = ui;
  }

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

  setShowAllRegions(enabled) {
    return this.ui.setShowAllRegions(enabled);
  }

  _flashNoPath(text) {
    this.ui.updateStatus(text);
    setTimeout(() => {
      if (this.ui.cy) {
        const nodeCount = this.ui.cy.nodes().length;
        const edgeCount = this.ui.cy.edges().length;
        this.ui.updateStatus(`Loaded ${nodeCount} regions, ${edgeCount} connections`);
      }
    }, 2000);
  }

  attemptMovePlayerOneStepToRegion(targetRegion) {
    const plan = actions.planOneStepMove(this._handles(), targetRegion,
      { onError: (error) => logger.warn('Error getting player location:', error) });
    if (!plan.ok) {
      if (plan.reason === 'no-current') logger.warn('Cannot determine current player location');
      else if (plan.reason === 'already-there') logger.debug(`Player is already in target region: ${targetRegion}`);
      else if (plan.reason === 'no-path') {
        logger.warn(`No accessible path found from ${plan.from} to ${targetRegion}`);
        this._flashNoPath(`No path to ${targetRegion}`);
      } else if (plan.reason === 'no-next-exit') logger.warn('Path found but no next exit determined');
      return;
    }

    // ⛓ RETURN TO MENU (procgenCore/restartRoute.js): one step toward the target from where the player stands.
    // When no walk exists but the slot declares return_to_menu and the start has one, the step IS the Menu
    // panel's Restart (its own path) — never an exit. planOneStepMove has already taken it.
    if (plan.kind === 'restart') {
      this._reportRestart(plan.from, targetRegion, plan.region);
      return;
    }

    const { path, move } = plan;
    logger.info('Moving player via path', { steps: path.steps, nextExit: path.nextExit });

    // Execute the first step of the path using moduleDispatcher
    import('../regionGraph/index.js').then(({ moduleDispatcher }) => {
      if (moduleDispatcher) {
        actions.publishRegionMove(this._handles(moduleDispatcher), move, REGION_GRAPH_SOURCES.oneStep);
        logger.debug(`Published user:regionMove via dispatcher from ${move.sourceRegion} to ${move.targetRegion}`);
      } else {
        logger.warn('moduleDispatcher not available for publishing user:regionMove');
      }
    });

    // Show path info in status
    if (path.length === 1) {
      this.ui.updateStatus(`Moving to ${targetRegion}`);
    } else {
      this.ui.updateStatus(`Moving to ${targetRegion} (${path.length} steps via ${path.steps[1]})`);
    }
  }

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

  attemptMovePlayerDirectlyToRegion(targetRegion) {
    const plan = actions.planDirectMove(this._handles(), targetRegion,
      { onError: (error) => logger.warn('Error getting player location:', error) });
    if (!plan.ok) {
      if (plan.reason === 'no-current') logger.warn('Cannot determine current player location');
      else if (plan.reason === 'already-there') logger.debug(`Player is already in target region: ${targetRegion}`);
      else if (plan.reason === 'no-path') {
        logger.warn(`No accessible path found from ${plan.from} to ${targetRegion}`);
        this._flashNoPath(`No path to ${targetRegion}`);
      } else if (plan.reason === 'no-final-exit') logger.warn('Could not determine final exit name for direct move');
      return;
    }

    const { path, move } = plan;
    logger.info(`Moving player directly to ${targetRegion} via final exit: ${move.exitName}`);

    // Execute the final step of the path directly
    import('../regionGraph/index.js').then(({ moduleDispatcher }) => {
      if (moduleDispatcher) {
        actions.publishRegionMove(this._handles(moduleDispatcher), move, REGION_GRAPH_SOURCES.direct);
        logger.debug(`Published direct user:regionMove via dispatcher from ${move.sourceRegion} to ${targetRegion}`);
      } else {
        logger.warn('moduleDispatcher not available for publishing user:regionMove');
      }
    });

    // Show path info in status
    if (path.length === 1) {
      this.ui.updateStatus(`Moving directly to ${targetRegion}`);
    } else {
      this.ui.updateStatus(`Moving directly to ${targetRegion} (skipping ${path.length - 1} steps)`);
    }
  }

  async addToPath(targetRegion, moveOnlyOneStep = false) {
    const { moduleDispatcher } = await import('../regionGraph/index.js');
    if (!moduleDispatcher) {
      logger.warn('moduleDispatcher not available for publishing user:regionMove');
      return;
    }
    const r = actions.addToPath(this._handles(moduleDispatcher), targetRegion, {
      moveOnlyOneStep,
      source: REGION_GRAPH_SOURCES.addToPath,
      // Disable "Show All Regions" before executing moves
      beforeExecute: () => this.setShowAllRegions(false),
    });
    if (!r.ok) {
      if (r.reason === 'already-there') logger.debug(`Target region ${targetRegion} is already at end of path`);
      else if (r.reason === 'no-path') {
        logger.warn(`No accessible path found from ${r.from} to ${targetRegion}`);
        this.ui.updateStatus(`No path from ${r.from} to ${targetRegion}`);
      }
      return;
    }
    if (r.kind === 'path') {
      logger.info(`Adding to path: ${r.regions.join(' → ')}`);
      this.ui.updateStatus(`Added ${r.dispatched} region(s) to path`);
    }
  }

  async overwritePath(targetRegion, moveOnlyOneStep = false) {
    const { moduleDispatcher } = await import('../regionGraph/index.js');
    if (!moduleDispatcher) {
      logger.warn('moduleDispatcher not available for publishing user:regionMove');
      return;
    }
    // Resets the player to the start region and trims the path back to it, then walks.
    const r = actions.overwritePath(this._handles(moduleDispatcher), targetRegion, {
      moveOnlyOneStep,
      source: REGION_GRAPH_SOURCES.overwritePath,
      // Disable "Show All Regions" before executing moves
      beforeExecute: () => this.setShowAllRegions(false),
    });
    if (!r.ok) {
      if (r.reason === 'already-there') logger.debug(`Target region is ${r.from}, path already reset`);
      else if (r.reason === 'no-path') {
        logger.warn(`No accessible path found from ${r.from} to ${targetRegion}`);
        this.ui.updateStatus(`No path from ${r.from} to ${targetRegion}`);
      }
      return;
    }
    logger.info(`Creating new path: ${r.from} → ${r.regions.join(' → ')}`);
    this.ui.updateStatus(`Created path: ${r.from} → ${targetRegion} (${r.dispatched} steps)`);
  }
}
