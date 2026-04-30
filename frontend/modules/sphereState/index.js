// frontend/modules/sphereState/index.js

import { createSphereStateSingleton, getSphereStateSingleton } from './singleton.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import {
  compareSphereIndex,
  computeCrossPlayerItems,
  computeGrantDelta,
  getCumulativeBaseItems,
  grantUpToSphere,
} from './crossPlayerItems.js';

// Helper function for logging
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('sphereStateModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[sphereStateModule] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'sphereState',
  description: 'Manages sphere log data and player progression through spheres.',
  requires: ['stateManager'],
  // NO componentType - this is a non-UI module
};

// Store module-level references
let moduleEventBus = null;
let moduleId = 'sphereState';

/**
 * Registration function for the sphereState module.
 * @param {object} registrationApi - API provided by the initialization script.
 */
export async function register(registrationApi) {
  log('info', '[sphereState Module] Registering...');

  // Register public functions
  registrationApi.registerPublicFunction(moduleId, 'getSphereData', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getSphereData();
  });

  registrationApi.registerPublicFunction(moduleId, 'getCurrentSphere', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getCurrentSphere();
  });

  registrationApi.registerPublicFunction(moduleId, 'getCurrentIntegerSphere', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getCurrentIntegerSphere();
  });

  registrationApi.registerPublicFunction(moduleId, 'getCurrentFractionalSphere', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getCurrentFractionalSphere();
  });

  registrationApi.registerPublicFunction(moduleId, 'getCheckedLocations', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getCheckedLocations();
  });

  registrationApi.registerPublicFunction(moduleId, 'isLocationChecked', (locationName) => {
    const sphereState = getSphereStateSingleton();
    return sphereState.isLocationChecked(locationName);
  });

  registrationApi.registerPublicFunction(moduleId, 'getAccessibleLocations', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getAccessibleLocations();
  });

  registrationApi.registerPublicFunction(moduleId, 'getAccessibleRegions', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getAccessibleRegions();
  });

  registrationApi.registerPublicFunction(moduleId, 'isSphereComplete', (integerSphere, fractionalSphere) => {
    const sphereState = getSphereStateSingleton();
    return sphereState.isSphereComplete(integerSphere, fractionalSphere);
  });

  registrationApi.registerPublicFunction(moduleId, 'isIntegerSphereComplete', (integerSphere) => {
    const sphereState = getSphereStateSingleton();
    return sphereState.isIntegerSphereComplete(integerSphere);
  });

  registrationApi.registerPublicFunction(moduleId, 'getSphereByIndex', (integerSphere, fractionalSphere) => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getSphereByIndex(integerSphere, fractionalSphere);
  });

  registrationApi.registerPublicFunction(moduleId, 'getAllSpheresForInteger', (integerSphere) => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getAllSpheresForInteger(integerSphere);
  });

  registrationApi.registerPublicFunction(moduleId, 'getCurrentPlayerId', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getCurrentPlayerId();
  });

  registrationApi.registerPublicFunction(moduleId, 'loadSphereLog', async (filePath, preloadedContent) => {
    const sphereState = getSphereStateSingleton();
    return await sphereState.loadSphereLog(filePath, preloadedContent);
  });

  registrationApi.registerPublicFunction(moduleId, 'setCurrentPlayerId', (playerId) => {
    const sphereState = getSphereStateSingleton();
    return sphereState.setCurrentPlayerId(playerId);
  });

  registrationApi.registerPublicFunction(moduleId, 'isFocusedMode', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.isFocusedMode();
  });

  registrationApi.registerPublicFunction(moduleId, 'getFocusLocations', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getFocusLocations();
  });

  registrationApi.registerPublicFunction(moduleId, 'getLogHeader', () => {
    const sphereState = getSphereStateSingleton();
    return sphereState.getLogHeader();
  });

  // Cross-player item computation (used by loopsCostDebugger verify, spoilerChecklist sync)
  registrationApi.registerPublicFunction(moduleId, 'compareSphereIndex', compareSphereIndex);
  registrationApi.registerPublicFunction(moduleId, 'computeCrossPlayerItems',
    (upToSphere, inclusive) => computeCrossPlayerItems(upToSphere, inclusive));
  registrationApi.registerPublicFunction(moduleId, 'computeGrantDelta',
    (crossPlayerItems, currentInventory) => computeGrantDelta(crossPlayerItems, currentInventory));
  registrationApi.registerPublicFunction(moduleId, 'getCumulativeBaseItems',
    (upToSphere, inclusive) => getCumulativeBaseItems(upToSphere, inclusive));
  registrationApi.registerPublicFunction(moduleId, 'grantItemsUpToSphere',
    (sphereIndex) => grantUpToSphere(sphereIndex));

  // Register event publishers
  registrationApi.registerEventBusPublisher('sphereState:dataLoaded');
  registrationApi.registerEventBusPublisher('sphereState:dataCleared');
  registrationApi.registerEventBusPublisher('sphereState:currentSphereChanged');
  registrationApi.registerEventBusPublisher('sphereState:allSpheresComplete');

  log('info', '[sphereState Module] Registration complete.');
}

/**
 * Initialization function for the sphereState module.
 * @param {string} mId - The unique ID for this module.
 * @param {number} priorityIndex - The loading priority index.
 * @param {object} initializationApi - API provided by the initialization script.
 */
export async function initialize(mId, priorityIndex, initializationApi) {
  moduleId = mId;
  log('info', `[${moduleId} Module] Initializing with priority ${priorityIndex}...`);

  // Store the event bus reference
  moduleEventBus = initializationApi.getEventBus();

  // Create the singleton instance
  createSphereStateSingleton(moduleEventBus);

  // Subscribe to stateManager:rulesLoaded via eventBus
  if (moduleEventBus) {
    moduleEventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded);
    log('info', `[${moduleId} Module] Subscribed to stateManager:rulesLoaded via eventBus`);

    moduleEventBus.subscribe('stateManager:snapshotUpdated', handleSnapshotUpdated);
    log('info', `[${moduleId} Module] Subscribed to stateManager:snapshotUpdated via eventBus`);
  }

  log('info', `[${moduleId} Module] Initialization complete.`);
}

/**
 * Handle rules loaded event
 */
function handleRulesLoaded(data, propagationOptions) {
  log('info', `[${moduleId} Module] Received stateManager:rulesLoaded event`, data);

  const sphereState = getSphereStateSingleton();

  // Reset sphere state when new rules are loaded
  sphereState.reset();

  // Extract current player ID from event data or static data
  let playerId = data?.playerId;
  if (!playerId) {
    playerId = sphereState.updatePlayerIdFromStaticData();
  } else {
    sphereState.setCurrentPlayerId(playerId);
  }

  if (!playerId) {
    log('warn', 'Could not determine current player ID from event or static data');
  } else {
    log('info', `Current player ID: ${playerId}`);
  }

  // Try to get sourceName from event data or stateManager
  let sourceName = data?.source || stateManager.getCurrentRulesSource?.();

  if (!sourceName) {
    log('warn', 'Source name not available, cannot auto-load sphere log');
    return;
  }

  log('info', `Rules source: ${sourceName}`);

  // Extract game directory, preset directory, and seed ID from sourceName
  // Expected formats:
  //   Single-player: "./presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json"
  //   Multiworld:    "./presets/multiworld/AP_14089154938208861744/AP_14089154938208861744_P2_rules.json"
  //   Vanilla:       "./presets/alttp/AP_14089154938208861744_v/AP_14089154938208861744_rules.json"
  //   Canonical:     "./presets/adventure_worldgen/AP_14089154938208861744_c/AP_14089154938208861744_rules.json"
  //   Both:          "./presets/game_worldgen/AP_14089154938208861744_vc/AP_14089154938208861744_rules.json"
  // The preset directory may have a placement suffix (_v, _c, _vc) but the sphere log filename does not.
  // The sphere log is shared and named: AP_14089154938208861744_sphere_log.jsonl (without _P{N} or placement suffix)
  const match = sourceName.match(/presets\/([^/]+)\/((AP_\d+)(?:_[a-z]+)?)\/\3(?:_P\d+)?_rules\.json$/);
  if (!match) {
    // If sourceName indicates data loaded from localStorage or editor, this is expected
    const isFromLocalStorage = sourceName === 'moduleSpecificConfigProvidedRules';
    const isFromEditor = sourceName === 'editorApply';
    const isFromProcgen = sourceName === 'procgenPipeline';
    const isFromHardcodedFallback = sourceName.startsWith('hardcodedFallback:');
    const isExpectedNonFilePath = isFromLocalStorage || isFromEditor || isFromProcgen || isFromHardcodedFallback;
    log(
      isExpectedNonFilePath ? 'info' : 'warn',
      `Could not parse sourceName format: ${sourceName}` +
      (isFromLocalStorage ? ' (Rules loaded from localStorage without file path)' : '') +
      (isFromEditor ? ' (Rules applied from editor)' : '') +
      (isFromProcgen ? ' (Rules generated by procgen pipeline)' : '') +
      (isFromHardcodedFallback ? ' (Using hardcoded fallback sphere log)' : '')
    );

    // For hardcoded fallback, load the embedded sphere log
    if (isFromHardcodedFallback) {
      import('../../data/fallbackRules.js').then(({ FALLBACK_SPHERE_LOG }) => {
        sphereState.loadSphereLog('hardcodedFallback:apquest_sphere_log', FALLBACK_SPHERE_LOG).then(success => {
          if (success) {
            log('info', 'Hardcoded fallback sphere log loaded successfully');
          } else {
            log('warn', 'Failed to load hardcoded fallback sphere log');
          }
        });
      });
    }

    return;
  }

  const gameDir = match[1];
  const presetDir = match[2];
  const seedId = match[3];

  log('info', `Extracted game: ${gameDir}, preset dir: ${presetDir}, seed: ${seedId}`);

  const sphereLogPath = `./presets/${gameDir}/${presetDir}/${seedId}_sphere_log.jsonl`;
  log('info', `Auto-loading sphere log: embedded-first, separate-file fallback (${sphereLogPath})`);

  // Embedded-first priority: when the rules.json has its own
  // sphere_log field (Phase 4 procgen output), use that directly to
  // avoid a noisy 404 on the separate-file fetch. Only fall through
  // to fetching `<seedId>_sphere_log.jsonl` when the embedded field
  // is absent (e.g., older Python-generated presets that ship the
  // sphere log as a sibling file).
  loadEmbeddedFirstThenFile(sphereState, sourceName, sphereLogPath).then(success => {
    if (!success) {
      log('warn', `Sphere log unavailable: neither embedded nor separate file usable (${sphereLogPath})`);
    }
  });
}

/**
 * Phase 4 loader: prefer the embedded sphere_log on the loaded
 * rules.json, fall back to fetching the separate `.jsonl` file when
 * absent. The embedded-first order avoids a noisy 404 in the
 * common case where a procgen preset has only the embedded field.
 *
 * Returns a Promise resolving to true on success, false when neither
 * source yields a usable sphere log.
 */
async function loadEmbeddedFirstThenFile(sphereState, rulesPath, separateFilePath) {
  // Step 1: try the embedded field. The rules.json was loaded
  // moments ago by stateManager, so the fetch is almost always a
  // browser-cache hit. We re-parse rather than relying on stateManager's
  // transformed staticData, which strips fields we don't index.
  if (rulesPath && typeof fetch === 'function') {
    try {
      const response = await fetch(rulesPath);
      if (response.ok) {
        const rulesDoc = await response.json();
        const entries = rulesDoc?.sphere_log;
        if (Array.isArray(entries) && entries.length > 0) {
          const jsonlText = entries.map((e) => JSON.stringify(e)).join('\n');
          const ok = await sphereState.loadSphereLog(`embedded:${rulesPath}`, jsonlText);
          if (ok) {
            log('info', `Embedded sphere log loaded from rules.json (${entries.length} entries).`);
            return true;
          }
          log('warn', 'Embedded sphere log parse failed; falling through to separate file.');
        }
      }
    } catch (err) {
      log('warn', `Could not check embedded sphere log on ${rulesPath}: ${err.message}; falling through to separate file.`);
    }
  }

  // Step 2: fall back to fetching the separate `.jsonl` file. This
  // is the path Python-generated presets ship the sphere log on.
  log('info', `Embedded sphere_log absent; trying separate file: ${separateFilePath}`);
  const ok = await sphereState.loadSphereLog(separateFilePath);
  if (ok) {
    log('info', 'Sphere log loaded from separate file.');
  }
  return ok;
}

/**
 * Handle snapshot updated event
 */
function handleSnapshotUpdated(data, propagationOptions) {
  const sphereState = getSphereStateSingleton();

  // Update current sphere based on new snapshot
  sphereState.updateCurrentSphere();
}