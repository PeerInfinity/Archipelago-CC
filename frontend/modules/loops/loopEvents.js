import loopStateSingleton from './loopStateSingleton.js';
import { gateReasonOutOfScope } from './loopState.js';
import { getLoopsModuleDispatcher, moduleInfo, getGameStateAPI, getPathFinder } from './index.js'; // Import the dispatcher getter, moduleInfo, and gameState API
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';

// Whether loop mode is active. The flag lives on gameState now (so
// substrates/timer read it without coupling to loops); read it through
// the loops gameState API rather than mirroring a UI event.
function loopModeActive() {
  return getGameStateAPI()?.getState?.()?.isLoopModeActive ?? false;
}

// Track the click-to-queue mode setting. 'off' (the default) lets a
// user:locationCheck / user:exitClicked from another panel pass
// through to stateManager even while loop mode is active — the click
// checks immediately, exactly as with loop mode off. 'append' appends
// a single action to the queue iff the click's region matches the
// queue's current end region — mismatches are dropped with feedback
// (loops:clickIgnored). 'rebuildPath' is the legacy "clear queue and
// pathfind from current to target" behavior. Synced from the loops UI
// via the 'loopUI:clickToQueueChanged' event in initializeLoopEvents.
const CLICK_TO_QUEUE_MODES = ['off', 'append', 'rebuildPath'];
let clickToQueueMode = 'off';

// EventBus reference captured at initialization so the click-ignored
// feedback event can be published from the intercept handlers without
// re-importing.
let _eventBus = null;

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
 * Compute the "end region" of the loops queue: the destinationRegion
 * of the last `regionMove` entry in gameState.path, falling back to
 * the player's currentRegion when no regionMove entries exist.
 * Mirrors the implicit-region resolution in gameState's
 * addLocationCheck / addCustomAction.
 *
 * @returns {string|null}
 */
function getQueueEndRegion(gameStateAPI) {
  const path = gameStateAPI?.getPath?.() || [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i]?.type === 'regionMove') {
      return path[i].destinationRegion;
    }
  }
  return gameStateAPI?.getCurrentRegion?.() ?? null;
}

/**
 * Emit loops:clickIgnored so the loops panel can show inline feedback
 * for a dropped click. Best-effort — silently no-ops if the eventBus
 * isn't wired (e.g. headless tests that don't initialize loopEvents).
 */
function publishClickIgnored({ kind, regionName, expectedRegion, payload, reason = null }) {
  if (!_eventBus?.publish) return;
  _eventBus.publish('loops:clickIgnored', {
    kind,                  // 'location' | 'exit' | 'move' | 'explore'
    regionName,            // region of the click
    expectedRegion,        // parked live-play region / queue end region
    reason,                // gate verdict reason when the strict gate blocked it
    payload,               // original event payload for downstream consumers
  });
}

/**
 * Initialize event handlers and subscribe to loop mode + advanced-toggle
 * changes. Should be called when the module initializes.
 * @param {EventBus} eventBus - The event bus instance
 */
export function initializeLoopEvents(eventBus) {
  if (!eventBus) {
    log('error', '[LoopEvents] Cannot initialize: EventBus not provided');
    return;
  }

  _eventBus = eventBus;

  // Subscribe to the click-to-queue mode setting. Default stays 'off'
  // until the UI tells us otherwise.
  eventBus.subscribe('loopUI:clickToQueueChanged', (data) => {
    if (data && CLICK_TO_QUEUE_MODES.includes(data.mode)) {
      clickToQueueMode = data.mode;
      log('info', '[LoopEvents] clickToQueue mode changed:', clickToQueueMode);
    }
  });

  // Note: user:exitClicked is now handled via dispatcher (handleUserExitClickedForLoops)
}

/**
 * Path-rebuild branch: clear the queue, pathfind from the current
 * location to the clicked region, then append the final action
 * (locationCheck or explore). This is the legacy behavior, now gated
 * behind the clickToQueue 'rebuildPath' mode.
 */
function rebuildQueueToLocation(locationName, regionName, isLocationDiscovered) {
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
    if (gameStateAPI.addLocationCheck) {
      gameStateAPI.addLocationCheck(locationName, regionName);
      log('info', `[LoopsModule] Added location check for ${locationName}`);
    }
  } else if (gameStateAPI.addCustomAction) {
    gameStateAPI.addCustomAction('explore', {
      regionName,
      repeatExplore: true,
    });
    log('info', `[LoopsModule] Added explore action for ${regionName}`);
  }
}

/**
 * Append-or-feedback branch: if the click's region matches the queue's
 * current end region, append a single action (locationCheck for
 * discovered locations, customAction:explore for undiscovered). On
 * mismatch, drop the click and publish loops:clickIgnored so the UI
 * can show inline feedback.
 */
function appendLocationOrFeedback(locationName, regionName, isLocationDiscovered) {
  const gameStateAPI = getGameStateAPI();
  if (!gameStateAPI) {
    log('error', '[LoopsModule] GameState API not available');
    return;
  }
  const queueEnd = getQueueEndRegion(gameStateAPI);
  if (queueEnd !== regionName) {
    log('info', `[LoopsModule] Dropping locationCheck for ${locationName} in ${regionName}: queue ends in ${queueEnd}`);
    publishClickIgnored({
      kind: 'location',
      regionName,
      expectedRegion: queueEnd,
      payload: { locationName },
    });
    return;
  }
  if (isLocationDiscovered) {
    gameStateAPI.addLocationCheck?.(locationName, regionName);
    log('info', `[LoopsModule] Appended location check for ${locationName} in ${regionName}`);
  } else {
    gameStateAPI.addCustomAction?.('explore', {
      regionName,
      repeatExplore: true,
    });
    log('info', `[LoopsModule] Appended explore action for ${regionName} (undiscovered location)`);
  }
}

/**
 * Handles the 'user:locationCheck' / 'system:locationCheck' events
 * for the Loops module. Order of decision (M3b, session 66b rulings —
 * "gate first, then mode"):
 *   1. Loop mode off, system event, or fromLoop → propagate up
 *      unchanged (queue execution / substrate-internal events always
 *      pass).
 *   2. The strict action gate:
 *      - exempt (planning source, delegation/solver) → propagate.
 *      - parked live play on a matching Manual/Record block → observe
 *        (charge + capture per the rulings) and propagate; the click
 *        checks for real.
 *      - out of scope (AP-native region, substrate not yet mode-
 *        integrated) → legacy behavior: clickToQueue 'off' passes
 *        through, 'append'/'rebuildPath' intercept as authoring.
 *      - blocked → clickToQueue 'append'/'rebuildPath' still author
 *        (planning is never blocked); 'off' swallows the click and
 *        publishes loops:clickIgnored feedback.
 *
 * @param {object} eventData - The data associated with the event.
 * @param {string} eventName - 'user:locationCheck' or 'system:locationCheck'.
 */
export function handleUserLocationCheckForLoops(eventData, eventName = 'user:locationCheck') {
  const dispatcher = getLoopsModuleDispatcher();

  const passThrough = () => {
    // Expected-outcome tracking for per-region manual mode: a check
    // performed while the player drives a manual region marks the
    // matching queued entry completed. No-ops otherwise.
    loopStateSingleton.noteLocationChecked?.(eventData?.locationName);
    // Completion wake for bot-backed queue execution: a bot-driven
    // pickup's locationCheck completes the parked queue action.
    loopStateSingleton._handleBotWake_locationCheck?.(eventData?.locationName);
    if (dispatcher) {
      dispatcher.publishToNextModule(moduleInfo.name, eventName, eventData, { direction: 'up' });
    }
  };

  // Unconditional pass-through: loop mode off, substrate-internal
  // event, or the queue's own execution re-dispatching.
  const isSystemEvent = eventName === 'system:locationCheck';
  if (!loopModeActive() || isSystemEvent || eventData?.fromLoop === true) {
    passThrough();
    return;
  }

  const locationName = eventData?.locationName;
  const regionName = eventData?.regionName;

  // Strict action gate (M3b).
  const verdict = loopStateSingleton.evaluateActionGate({
    kind: 'location',
    regionName,
    eventName,
    data: eventData,
  });
  if (verdict.allowed && verdict.reason === 'parkedLivePlay') {
    // Live play on the parked block: charge + (in Record) capture,
    // then let the check perform for real.
    loopStateSingleton.observeParkedLiveAction({
      type: 'locationCheck',
      locationName,
      regionName,
    });
    passThrough();
    return;
  }
  if (verdict.allowed && !gateReasonOutOfScope(verdict.reason)) {
    // Exempt dispatch (planning source, delegation/solver execution).
    passThrough();
    return;
  }
  const outOfScope = verdict.allowed; // gate doesn't apply to this event

  // Out-of-scope events keep the legacy pass-through default.
  if (outOfScope && clickToQueueMode === 'off') {
    passThrough();
    return;
  }

  if (!locationName || !regionName) {
    log('warn', '[LoopsModule] Missing locationName or regionName in event data');
    return;
  }

  // Planning modes author the click instead of performing it — never
  // blocked by the gate.
  if (clickToQueueMode === 'rebuildPath' || clickToQueueMode === 'append') {
    if (!discoveryStateSingleton.isRegionDiscovered(regionName)) {
      log('info', `[LoopsModule] Region ${regionName} not discovered, ignoring click`);
      return;
    }
    const isLocationDiscovered = discoveryStateSingleton.isLocationDiscovered(locationName);
    if (clickToQueueMode === 'rebuildPath') {
      rebuildQueueToLocation(locationName, regionName, isLocationDiscovered);
    } else {
      appendLocationOrFeedback(locationName, regionName, isLocationDiscovered);
    }
    return;
  }

  // Blocked live play (strict gate, clickToQueue 'off'). warn (not
  // info) so swallowed clicks are visible in captured logs.
  log('warn', `[LoopsModule] Gate blocked locationCheck for ${locationName} in ${regionName}: ${verdict.reason}`);
  publishClickIgnored({
    kind: 'location',
    regionName,
    expectedRegion: verdict.expectedRegion ?? null,
    reason: verdict.reason,
    payload: { locationName },
  });
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
 * Path-rebuild branch for exit clicks. Clears the queue, pathfinds to
 * the source region, appends the final regionMove (if discovered) or
 * an explore action (if not). Legacy behavior gated behind the
 * clickToQueue 'rebuildPath' mode.
 */
function rebuildQueueToExit({ exitName, sourceRegion, destinationRegion, isDiscovered }) {
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

  loopStateSingleton.clearQueue();

  const moves = buildMoveSequence(path);
  if (!moves) return;

  if (isDiscovered) {
    moves.push({
      type: 'regionMove',
      sourceRegion,
      targetRegion: destinationRegion,
      exitUsed: exitName,
    });
  }

  if (moves.length > 0) {
    moves.forEach((move) => {
      gameStateAPI.updatePath(
        move.targetRegion,
        move.exitUsed,
        move.sourceRegion,
      );
    });
  }

  if (!isDiscovered && gameStateAPI.addCustomAction) {
    gameStateAPI.addCustomAction('explore', {
      regionName: sourceRegion,
      repeatExplore: true,
    });
    log('info', `[LoopEvents] Added explore action for ${sourceRegion}`);
  }
}

/**
 * Append-or-feedback branch for exit clicks: if the click's
 * sourceRegion matches the queue's current end region, append a
 * regionMove (or an explore action for undiscovered exits). On
 * mismatch, drop and publish loops:clickIgnored.
 */
function appendExitOrFeedback({ exitName, sourceRegion, destinationRegion, isDiscovered }) {
  const gameStateAPI = getGameStateAPI();
  if (!gameStateAPI) {
    log('error', '[LoopEvents] GameState API not available');
    return;
  }
  const queueEnd = getQueueEndRegion(gameStateAPI);
  if (queueEnd !== sourceRegion) {
    log('info', `[LoopEvents] Dropping exitClicked for ${exitName} in ${sourceRegion}: queue ends in ${queueEnd}`);
    publishClickIgnored({
      kind: 'exit',
      regionName: sourceRegion,
      expectedRegion: queueEnd,
      payload: { exitName, destinationRegion, isDiscovered },
    });
    return;
  }
  if (isDiscovered) {
    gameStateAPI.updatePath?.(destinationRegion, exitName, sourceRegion);
    log('info', `[LoopEvents] Appended regionMove ${sourceRegion} → ${destinationRegion} via ${exitName}`);
  } else if (gameStateAPI.addCustomAction) {
    gameStateAPI.addCustomAction('explore', {
      regionName: sourceRegion,
      repeatExplore: true,
    });
    log('info', `[LoopEvents] Appended explore action for ${sourceRegion} (undiscovered exit)`);
  }
}

/**
 * Handles the 'user:exitClicked' event from the Exits module via dispatcher.
 * Decision order mirrors handleUserLocationCheckForLoops (M3b "gate
 * first, then mode"): unconditional pass-through for loop-mode-off /
 * fromLoop; then the strict gate (parked live play and exempt
 * dispatches pass; out-of-scope keeps the legacy clickToQueue
 * behavior; blocked clicks author in planning modes or are swallowed
 * with feedback in 'off').
 *
 * @param {object} eventData - The exit click data
 * @param {object} propagationOptions - Options related to event propagation
 */
export function handleUserExitClickedForLoops(eventData, propagationOptions) {
  log('info', '[LoopEvents] Received user:exitClicked event:', eventData);

  const dispatcher = getLoopsModuleDispatcher();

  const passThrough = () => {
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
  };

  if (!loopModeActive() || eventData?.fromLoop === true) {
    passThrough();
    return;
  }

  const verdict = loopStateSingleton.evaluateActionGate({
    kind: 'exit',
    regionName: eventData?.sourceRegion,
    eventName: 'user:exitClicked',
    data: eventData,
  });
  if (verdict.allowed && !gateReasonOutOfScope(verdict.reason)) {
    // Parked live play or an exempt dispatch — the click moves for real
    // (discovery / regions handle it downstream).
    passThrough();
    return;
  }
  const outOfScope = verdict.allowed;

  if (outOfScope && clickToQueueMode === 'off') {
    passThrough();
    return;
  }

  if (clickToQueueMode === 'rebuildPath' || clickToQueueMode === 'append') {
    log('info', '[LoopEvents] Loop mode active, intercepting exit click (authoring)');
    if (clickToQueueMode === 'rebuildPath') {
      rebuildQueueToExit(eventData);
    } else {
      appendExitOrFeedback(eventData);
    }
    return;
  }

  // Blocked live play (strict gate, clickToQueue 'off').
  log('warn', `[LoopEvents] Gate blocked exitClicked for ${eventData?.exitName} in ${eventData?.sourceRegion}: ${verdict.reason}`);
  publishClickIgnored({
    kind: 'exit',
    regionName: eventData?.sourceRegion,
    expectedRegion: verdict.expectedRegion ?? null,
    reason: verdict.reason,
    payload: {
      exitName: eventData?.exitName,
      destinationRegion: eventData?.destinationRegion,
      isDiscovered: eventData?.isDiscovered,
    },
  });
}

/**
 * Handles the 'loop:exploreCompleted' dispatcher event for the Loops
 * module (M3b — new receiver). A performed substrate explore dispatches
 * this event (consumed by discovery, which reveals something); loops
 * receives it FIRST (higher load priority) so the strict gate can
 * swallow disallowed explores and the observation layer can charge +
 * capture allowed parked live-play ones. The queue's own explore
 * completions carry fromLoop and pass through untouched.
 *
 * Unlike clicks, explores have no planning-mode fallback: click-to-
 * queue authors explores via location/exit clicks on undiscovered
 * targets, never via this event.
 */
export function handleLoopExploreCompletedForLoops(eventData, propagationOptions) {
  const dispatcher = getLoopsModuleDispatcher();

  const passThrough = () => {
    if (dispatcher) {
      dispatcher.publishToNextModule(
        moduleInfo.name,
        'loop:exploreCompleted',
        eventData,
        { direction: 'up' }
      );
    }
  };

  if (!loopModeActive() || eventData?.fromLoop === true) {
    passThrough();
    return;
  }

  const regionName = eventData?.regionName;
  const verdict = loopStateSingleton.evaluateActionGate({
    kind: 'explore',
    regionName,
    eventName: 'loop:exploreCompleted',
    data: eventData,
  });
  if (verdict.allowed) {
    if (verdict.reason === 'parkedLivePlay') {
      loopStateSingleton.observeParkedLiveAction({ type: 'explore', regionName });
    }
    passThrough();
    return;
  }

  log('warn', `[LoopEvents] Gate blocked explore in ${regionName}: ${verdict.reason}`);
  publishClickIgnored({
    kind: 'explore',
    regionName,
    expectedRegion: verdict.expectedRegion ?? null,
    reason: verdict.reason,
    payload: {},
  });
}

// Test-only — reset module-scope state between cases. (Loop-mode active
// state lives on gameState now, so it isn't reset here.)
export function _testOnly_resetLoopEvents() {
  clickToQueueMode = 'off';
  _eventBus = null;
}
