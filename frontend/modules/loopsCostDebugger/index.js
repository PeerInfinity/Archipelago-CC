/**
 * Loops Cost Debugger Module
 *
 * Step-through debugger for the Loops cost generation algorithm.
 * Plans cost generation steps from a sphere log and displays
 * detailed reasoning for each step.
 */

import { CostDebuggerUI } from './costDebuggerUI.js';
import { CostPlanner } from './costPlanner.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopsCostDebugger', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopsCostDebugger] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'loopsCostDebugger',
  title: 'Loops Cost Debugger',
  componentType: 'loopsCostDebuggerPanel',
  icon: '',
  column: 1,
  description: 'Step-through debugger for Loops cost generation algorithm.',
  requires: ['loops', 'sphereState'],
};

// Module-level references
let thisModuleId = moduleInfo.name;
let moduleEventBus = null;
let moduleDispatcher = null;
let costPlannerInstance = null;

/**
 * Registration function
 */
export function register(registrationApi) {
  log('info', `[${moduleInfo.name}] Registering...`);

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'modules/loopsCostDebugger/costDebugger.css';
  document.head.appendChild(link);

  // Register panel component
  registrationApi.registerPanelComponent('loopsCostDebuggerPanel', CostDebuggerUI);

  // Register public functions
  registrationApi.registerPublicFunction(moduleInfo.name, 'getCostPlanner', () => costPlannerInstance);
  registrationApi.registerPublicFunction(moduleInfo.name, 'getPlannedSteps', () =>
    costPlannerInstance?.getPlannedSteps() || []
  );
  registrationApi.registerPublicFunction(moduleInfo.name, 'getCostData', () =>
    costPlannerInstance?.getCostData() || null
  );
  registrationApi.registerPublicFunction(moduleInfo.name, 'getSphereLog', getSphereLog);

  // Register event publishers
  registrationApi.registerEventBusPublisher('loopsCostDebugger:stepPlanned');
  registrationApi.registerEventBusPublisher('loopsCostDebugger:allPlanned');
  registrationApi.registerEventBusPublisher('loopsCostDebugger:reset');

  log('info', `[${moduleInfo.name}] Registration complete.`);
}

/**
 * Initialization function
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  thisModuleId = moduleId;
  moduleEventBus = initializationApi.getEventBus();
  moduleDispatcher = initializationApi.getDispatcher();

  log('info', `[${thisModuleId}] Initializing...`);

  // Create cost planner
  costPlannerInstance = new CostPlanner({
    stateManager: stateManagerProxySingleton,
    eventBus: moduleEventBus,
  });

  // Expose on window for console debugging
  if (typeof window !== 'undefined') {
    window.costPlanner = costPlannerInstance;
  }

  log('info', `[${thisModuleId}] Initialization complete.`);

  return () => {
    log('info', `[${thisModuleId}] Cleaning up...`);
    costPlannerInstance = null;
    moduleEventBus = null;
    moduleDispatcher = null;
    if (typeof window !== 'undefined') {
      delete window.costPlanner;
    }
  };
}

// =========================================================================
// Exports for UI component
// =========================================================================

export function getCostPlanner() {
  return costPlannerInstance;
}

export function getModuleEventBus() {
  if (moduleEventBus) return moduleEventBus;
  // Fallback wrapper before initialize() runs
  return {
    publish: (event, data) => eventBus.publish(event, data, 'loopsCostDebugger'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'loopsCostDebugger'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'loopsCostDebugger'),
  };
}

/**
 * True when the raw entries carry the incremental (`new_inventory_details`)
 * shape the planner reads. A verbose log's raw entries only have cumulative
 * `inventory_details`, so every itemsReceived would read as 0 — those must go
 * through the cumulative→delta reconstruction below instead.
 */
function rawLogIsIncremental(entries) {
  const first = entries.find(e => e?.type === 'state_update' && e.player_data);
  const firstPlayerData = first && Object.values(first.player_data)[0];
  return !!firstPlayerData && firstPlayerData.new_inventory_details !== undefined;
}

/**
 * Get sphere log data for the cost planner, in raw JSONL entry shape
 * (`{ type: 'state_update', sphere_index, player_data: { <id>: {...} } }`).
 *
 * Prefers sphereState's retained raw entries: they carry EVERY player's slice,
 * so the planner's own player filter decides which one is used. The fallback
 * rebuilds entries from the current player's parsed (cumulative) sphere data.
 *
 * @returns {Array|null} Sphere log entries in raw JSONL format
 */
export function getSphereLog() {
  // Preferred: the literal log sphereState parsed, all players intact.
  const getRawSphereLog = centralRegistry.getPublicFunction('sphereState', 'getRawSphereLog');
  const rawLog = getRawSphereLog?.();
  if (Array.isArray(rawLog) && rawLog.length > 0 && rawLogIsIncremental(rawLog)) {
    return rawLog;
  }

  // Fallback: parsed sphere data (current player only) converted to raw format
  const getSphereData = centralRegistry.getPublicFunction('sphereState', 'getSphereData');
  if (getSphereData) {
    const sphereData = getSphereData();
    if (sphereData && Array.isArray(sphereData) && sphereData.length > 0) {
      const getIdFn = centralRegistry.getPublicFunction('sphereState', 'getCurrentPlayerId');
      // No player-1 default: keying the rebuilt log to a guessed player makes a
      // mismatch look like a successful load with an empty world.
      const playerId = getIdFn?.() || stateManagerProxySingleton?.getStaticData?.()?.playerId;
      if (!playerId) {
        log('error', 'Cannot build sphere log: no current player id is known');
        return null;
      }
      // sphereData.inventoryDetails is CUMULATIVE (accumulated by sphereState).
      // Convert to incremental deltas to match the raw JSONL new_inventory_details format.
      let previousBaseItems = {};
      return sphereData.map((sphere) => {
        const currentBaseItems = sphere.inventoryDetails?.base_items || {};

        // Compute incremental delta from cumulative
        const deltaItems = {};
        for (const [item, count] of Object.entries(currentBaseItems)) {
          const prev = previousBaseItems[item] || 0;
          if (count > prev) {
            deltaItems[item] = count - prev;
          }
        }
        previousBaseItems = { ...currentBaseItems };

        const hasNewItems = Object.keys(deltaItems).length > 0;
        return {
          type: 'state_update',
          sphere_index: sphere.sphereIndex ?? sphere.integerSphere ?? 0,
          player_data: {
            [String(playerId)]: {
              sphere_locations: sphere.locations || [],
              new_accessible_regions: sphere.accessibleRegions || [],
              new_inventory_details: hasNewItems ? { base_items: deltaItems } : {},
            },
          },
        };
      });
    }
  }

  return null;
}
