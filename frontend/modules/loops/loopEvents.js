import loopStateSingleton from './loopStateSingleton.js';
import { getLoopsModuleDispatcher, moduleInfo, getGameStateAPI, getPathFinder } from './index.js'; // Import the dispatcher getter, moduleInfo, and gameState API
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';

// Track loop mode state
let isLoopModeActive = false;

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopEvents', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopEvents] ${message}`, ...data);
  }
}

/**
 * Build a sequence of region moves from a path array.
 * @param {string[]} path - Array of region names from pathfinder
 * @returns {Array|null} Array of move objects, or null on failure
 */
function buildMoveSequence(path) {
  const moves = [];
  for (let i = 0; i < path.length - 1; i++) {
    const fromRegion = path[i];
    const toRegion = path[i + 1];

    const regionData = stateManager.getStaticData()?.regions?.get(fromRegion);
    const exitToUse = regionData?.exits?.find(
      (e) =>
        e.connected_region === toRegion &&
        discoveryStateSingleton.isExitDiscovered(fromRegion, e.name)
    );

    if (exitToUse) {
      moves.push({
        type: 'regionMove',
        sourceRegion: fromRegion,
        targetRegion: toRegion,
        exitUsed: exitToUse.name
      });
    } else {
      log('warn', `[LoopEvents] Could not find discovered exit from ${fromRegion} to ${toRegion}`);
      return null;
    }
  }
  return moves;
}

/**
 * Initialize event handlers and subscribe to loop mode changes
 * Should be called when the module initializes
 * @param {EventBus} eventBus - The event bus instance
 */
export function initializeLoopEvents(eventBus) {
  if (!eventBus) {
    log('error', '[LoopEvents] Cannot initialize: EventBus not provided');
    return;
  }

  // Subscribe to loop mode changes from the UI
  eventBus.subscribe('loopUI:modeChanged', (data) => {
    if (data && typeof data.active === 'boolean') {
      isLoopModeActive = data.active;
      log('info', '[LoopEvents] Loop mode changed:', isLoopModeActive);
    }
  });

  // Note: user:exitClicked is now handled via dispatcher (handleUserExitClickedForLoops)
}

/**
 * When true, loop-mode user:locationCheck events rebuild the queue with
 * a path-to-location (clearQueue → buildMoveSequence → addLocationCheck
 * or customAction(explore)). When false, propagates up the chain
 * unchanged. system:locationCheck is always propagated regardless —
 * it's used by substrates for tile-internal events (e.g. the maze
 * panel publishes system:locationCheck when the player steps on a
 * location tile, including mid-Explore) where queue rebuilds would
 * wipe in-flight actions.
 */
const AUTO_QUEUE_ON_LOCATION_CHECK = true;

/**
 * Handles the 'user:locationCheck' / 'system:locationCheck' events
 * for the Loops module. When loop mode is active AND the event is
 * user:locationCheck AND AUTO_QUEUE_ON_LOCATION_CHECK is on, rebuilds
 * the queue with a path to the location. Otherwise propagates up.
 * @param {object} eventData - The data associated with the event.
 * @param {string} eventName - 'user:locationCheck' or 'system:locationCheck'.
 */
export function handleUserLocationCheckForLoops(eventData, eventName = 'user:locationCheck') {
  const dispatcher = getLoopsModuleDispatcher();

  // Pass-through cases:
  //   - loop mode is off (regions / locations / etc. panels handle
  //     the click via the up-chain handler)
  //   - the intercept is feature-flagged off
  //   - system:locationCheck (substrate-internal, never a queue rebuild
  //     trigger — see flag docstring)
  const isSystemEvent = eventName === 'system:locationCheck';
  if (!isLoopModeActive || !AUTO_QUEUE_ON_LOCATION_CHECK || isSystemEvent) {
    if (dispatcher) {
      dispatcher.publishToNextModule(moduleInfo.name, eventName, eventData, { direction: 'up' });
    }
    return;
  }

  // --- Loop mode is active and the event is a genuine user click:
  // intercept and rebuild the queue with a path to the clicked location.
  const locationName = eventData?.locationName;
  const regionName = eventData?.regionName;
  if (!locationName || !regionName) {
    log('warn', '[LoopsModule] Missing locationName or regionName in event data');
    return;
  }

  const isLocationDiscovered = discoveryStateSingleton.isLocationDiscovered(locationName);
  const isRegionDiscovered = discoveryStateSingleton.isRegionDiscovered(regionName);

  if (!isRegionDiscovered) {
    log('info', `[LoopsModule] Region ${regionName} not discovered, ignoring click`);
    return;
  }

  const gameStateAPI = getGameStateAPI();
  if (!gameStateAPI) {
    log('error', '[LoopsModule] GameState API not available');
    return;
  }

  const pathFinder = getPathFinder();
  if (!pathFinder) {
    log('error', '[LoopsModule] PathFinder not available');
    return;
  }

  const path = pathFinder.findDiscoveredPath(regionName, discoveryStateSingleton);
  if (!path) {
    log('error', `[LoopsModule] Cannot find path to ${regionName}`);
    if (window.consoleManager) {
      window.consoleManager.print(`Cannot find a path to ${regionName} in discovery mode.`, 'error');
    }
    return;
  }

  log('info', `[LoopsModule] Found path to region: ${path.join(' -> ')}`);

  // Clear the current queue before building new one. clearQueue
  // teleports the player to the resolved loop start region (Menu's
  // synthetic-wrapper-bypassed equivalent for procgen) so the substrate
  // panel is in the right region by the time the queue's first
  // delegated action runs.
  loopStateSingleton.clearQueue();

  // Build move sequence along the path
  const moves = buildMoveSequence(path);
  if (!moves) return; // buildMoveSequence logs on failure

  // Phase 6g: append moves to the path WITHOUT dispatching user:regionMove
  // for each step. The prior dispatch-per-step caused gameState's
  // handleRegionMove to call setCurrentRegion for each hop, which
  // walked the player through every region as the queue was built —
  // by Start time the substrate panel was already at the target
  // region instead of the queue's first sourceRegion. updatePath
  // mutates only gameState.path; currentRegion stays put.
  if (moves.length > 0) {
    moves.forEach((move) => {
      gameStateAPI.updatePath(
        move.targetRegion,
        move.exitUsed,
        move.sourceRegion,
      );
    });
  }

  if (isLocationDiscovered) {
    // Discovered location: queue a location check
    if (gameStateAPI.addLocationCheck) {
      gameStateAPI.addLocationCheck(locationName, regionName);
      log('info', `[LoopsModule] Added location check for ${locationName}`);
    }
  } else {
    // Undiscovered location: queue an explore action
    if (gameStateAPI.addCustomAction) {
      gameStateAPI.addCustomAction('explore', {
        regionName: regionName,
        repeatExplore: true
      });
      log('info', `[LoopsModule] Added explore action for ${regionName}`);
    }
  }
}

/**
 * Handles the 'user:itemCheck' event for the Loops module.
 * Currently just passes the event along since we don't have specific plans for Loops mode.
 * @param {object} eventData - The data associated with the event.
 * @param {object} propagationOptions - Options related to event propagation.
 */
export function handleUserItemCheckForLoops(eventData, propagationOptions) {
  log('info', 
    '[LoopsModule] handleUserItemCheckForLoops received event:',
    eventData ? JSON.parse(JSON.stringify(eventData)) : 'undefined',
    'Propagation:',
    propagationOptions ? JSON.parse(JSON.stringify(propagationOptions)) : 'undefined'
  );
  const dispatcher = getLoopsModuleDispatcher(); // Get the dispatcher

  // For now, Loops module just passes the event on unconditionally
  // In the future, this could handle item checking in loop mode
  log('info', 
    '[LoopsModule] Passing user:itemCheck event to next module.'
  );
  
  if (dispatcher) {
    // Propagation direction is 'up' as specified in registerDispatcherReceiver
    dispatcher.publishToNextModule(
      moduleInfo.name,
      'user:itemCheck',
      eventData,
      { direction: 'up' }
    );
    log('info', 
      '[LoopsModule] Propagated user:itemCheck up.',
      eventData
    );
  } else {
    log('error',
      '[LoopsModule] Dispatcher not available for propagation of user:itemCheck.'
    );
  }
}

/**
 * Handles the 'user:exitClicked' event from the Exits module via dispatcher.
 * When loop mode is active, intercepts the event and builds a path to the exit.
 * When loop mode is not active, propagates to the next handler (regions module).
 * @param {object} eventData - The exit click data
 * @param {object} propagationOptions - Options related to event propagation
 */
export function handleUserExitClickedForLoops(eventData, propagationOptions) {
  log('info', '[LoopEvents] Received user:exitClicked event:', eventData);

  const dispatcher = getLoopsModuleDispatcher();

  // If loop mode is NOT active, propagate to next handler (regions module will handle it)
  if (!isLoopModeActive) {
    log('info', '[LoopEvents] Loop mode not active, propagating to next handler');
    if (dispatcher) {
      dispatcher.publishToNextModule(
        moduleInfo.name,
        'user:exitClicked',
        eventData,
        { direction: 'up' }
      );
    } else {
      log('error', '[LoopEvents] Dispatcher not available for propagation');
    }
    return;
  }

  // Loop mode IS active - intercept and handle the event (don't propagate)
  log('info', '[LoopEvents] Loop mode active, intercepting exit click');

  const { exitName, sourceRegion, destinationRegion, isDiscovered } = eventData;

  const gameStateAPI = getGameStateAPI();
  if (!gameStateAPI) {
    log('error', '[LoopEvents] GameState API not available');
    return;
  }

  const pathFinder = getPathFinder();
  if (!pathFinder) {
    log('error', '[LoopEvents] PathFinder not available');
    return;
  }

  const path = pathFinder.findDiscoveredPath(sourceRegion, discoveryStateSingleton);
  if (!path) {
    log('error', `[LoopEvents] Cannot find path to ${sourceRegion}`);
    if (window.consoleManager) {
      window.consoleManager.print(`Cannot find a path to ${sourceRegion} in discovery mode.`, 'error');
    }
    return;
  }

  log('info', `[LoopEvents] Found path to exit: ${path.join(' -> ')}`);

  // Clear the current queue before building new one. clearQueue
  // teleports the player to the resolved loop start region (Menu's
  // synthetic-wrapper-bypassed equivalent for procgen) so the substrate
  // panel is in the right region by the time the queue's first
  // delegated action runs.
  loopStateSingleton.clearQueue();

  // Build the path moves to the source region
  const moves = buildMoveSequence(path);
  if (!moves) return;

  // If exit is discovered, add the final move through it
  if (isDiscovered) {
    moves.push({
      type: 'regionMove',
      sourceRegion: sourceRegion,
      targetRegion: destinationRegion,
      exitUsed: exitName
    });
  }

  // Phase 6g: append moves to the path WITHOUT dispatching user:regionMove
  // for each step. See handleUserLocationCheckForLoops for the rationale.
  if (moves.length > 0) {
    moves.forEach((move) => {
      gameStateAPI.updatePath(
        move.targetRegion,
        move.exitUsed,
        move.sourceRegion,
      );
    });
  }

  // Add explore action if exit is undiscovered
  if (!isDiscovered) {
    if (gameStateAPI.addCustomAction) {
      gameStateAPI.addCustomAction('explore', {
        regionName: sourceRegion,
        repeatExplore: true
      });
      log('info', `[LoopEvents] Added explore action for ${sourceRegion}`);
    }
  }
}
