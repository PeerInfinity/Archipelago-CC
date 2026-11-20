import { RegionGraphUI } from './regionGraphUI.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import eventBus from '../../app/core/eventBus.js';
import { clickActionsSchemaEntry } from './clickActionsSettings.js';
import { makeRegionGraphCentreAction } from './regionGraphCentreAction.js';
import {
  registerClickAction, unregisterClickAction, REGION_CLICKED, LOCATION_CLICKED, PANEL_ACTION_IDS,
} from '../regionView/clickActions.js';

const logger = createUniversalLogger('regionGraph');

export const moduleInfo = {
  name: 'regionGraph',
  title: 'Region Graph',
  componentType: 'regionGraphPanel',
  docs: 'docs/json/user/modules/regionGraph.md',
  icon: '🌐',
  column: 2, // Middle column,
  category: 'Analysis Panels',
  description: 'A map of regions and exits colored by reachability; click a region to move toward it or check its locations.',
  requires: ['stateManager', 'gameState'],
};

// Store module-level references
export let moduleDispatcher = null; // Export the dispatcher
let moduleId = 'regionGraph'; // Store module ID
let _moduleEventBus = null;
let _pendingOverlayProvider = null;  // stored until a panel instance picks it up
let _nodeLabelProvider = null;       // (nodeId, nodeData) => string | null
let _edgeVisibilityFilter = null;    // (sourceId, targetId) => boolean (true = visible)
let _accessibilityVisibilityFilter = null; // () => boolean (true = show colors)
let _keyForwarder = null;            // (event) => void — forward keydown events to another module
let _panelInstances = new Set();     // all live RegionGraphUI instances

export function registerPanelInstance(instance) { _panelInstances.add(instance); }
export function unregisterPanelInstance(instance) { _panelInstances.delete(instance); }
export function getPendingOverlayProvider() {
  const p = _pendingOverlayProvider;
  _pendingOverlayProvider = null;
  return p;
}
export function getNodeLabelProvider() { return _nodeLabelProvider; }
export function getEdgeVisibilityFilter() { return _edgeVisibilityFilter; }
export function getAccessibilityVisibilityFilter() { return _accessibilityVisibilityFilter; }
export function getKeyForwarder() { return _keyForwarder; }

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  // Fallback wrapper before initialize() runs (e.g., GoldenLayout component creation)
  return {
    publish: (event, data) => eventBus.publish(event, data, 'regionGraph'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'regionGraph'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'regionGraph'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}

export function register(registrationApi) {
  logger.info('Module registering...');
  
  registrationApi.registerPanelComponent('regionGraphPanel', RegionGraphUI);
  
  // Register as event publisher for the same events as region links
  registrationApi.registerEventBusPublisher('ui:activatePanel');
  registrationApi.registerEventBusPublisher('ui:navigateToRegion');
  registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
  registrationApi.registerEventBusPublisher('regionGraph:nodeSelected');
  // ⛓ CA-S4: the generic click events (design §4.3), `{ panelId: 'regionGraph', regionName, locationName? }`, and the
  // Regions panel's `regions.scrollTo` (a location click's action, published on THIS bus).
  registrationApi.registerEventBusPublisher(REGION_CLICKED);
  registrationApi.registerEventBusPublisher(LOCATION_CLICKED);
  registrationApi.registerEventBusPublisher('ui:navigateToLocation');

  registrationApi.registerPublicFunction('regionGraph', 'registerNodeOverlayProvider', (providerOrCallback) => {
    // If panels already exist, register directly; otherwise stash for later
    if (_panelInstances.size > 0) {
      for (const panel of _panelInstances) panel.overlayManager.registerProvider(providerOrCallback);
    } else {
      _pendingOverlayProvider = providerOrCallback;
    }
  });

  // Remove the overlay provider from every panel (its teardown drops the cards, the has-overlay class and the
  // overlay arrow style) and clear a provider still pending for a panel not yet created. ActionNodes registers its
  // node card only while one of its worlds is loaded and removes it here on unload (slice AN-3a).
  registrationApi.registerPublicFunction('regionGraph', 'unregisterNodeOverlayProvider', () => {
    _pendingOverlayProvider = null;
    for (const panel of _panelInstances) panel.overlayManager.unregisterProvider();
  });

  registrationApi.registerPublicFunction('regionGraph', 'refreshNodeOverlays', () => {
    for (const panel of _panelInstances) panel.overlayManager.refresh();
  });

  registrationApi.registerPublicFunction('regionGraph', 'registerNodeLabelProvider', (callback) => {
    _nodeLabelProvider = callback;
    // Refresh labels on any existing panels
    for (const panel of _panelInstances) {
      if (panel.dataManager) panel.dataManager.refreshLabels();
    }
  });

  registrationApi.registerPublicFunction('regionGraph', 'refreshNodeLabels', () => {
    for (const panel of _panelInstances) {
      if (panel.dataManager) panel.dataManager.refreshLabels();
    }
  });

  registrationApi.registerPublicFunction('regionGraph', 'registerEdgeVisibilityFilter', (callback) => {
    _edgeVisibilityFilter = callback;
    for (const panel of _panelInstances) {
      if (panel.dataManager) panel.dataManager.refreshLabels();
    }
  });

  registrationApi.registerPublicFunction('regionGraph', 'registerAccessibilityVisibilityFilter', (callback) => {
    _accessibilityVisibilityFilter = callback;
    for (const panel of _panelInstances) {
      if (panel.dataManager) panel.dataManager.refreshLabels();
    }
  });

  registrationApi.registerPublicFunction('regionGraph', 'registerKeyForwarder', (callback) => {
    _keyForwarder = callback;
  });

  registrationApi.registerSettingsSchema({
    type: 'object',
    properties: {
      // ⛓ What a click runs (CA-S2): the "On click" strip's settings, migrated once from the seven old keys. The last
      // old key, `addLocationsToPath`, left the schema in CA-S4 (the Regions panel reads `clickActions` now).
      clickActions: clickActionsSchemaEntry(),
      locationVisibility: {
        type: 'string',
        default: 'hover',
        enum: ['hover', 'zoom', 'force-show', 'force-hide'],
        label: 'Location visibility',
      },
      wheelSensitivity: { type: 'number', default: 1, label: 'Wheel sensitivity' },
    },
  });
}

export function initialize(mId, priorityIndex, initializationApi) {
  logger.info(`Module initializing with ID: ${mId}`);
  
  // Store the dispatcher reference
  moduleDispatcher = initializationApi.getDispatcher();
  _moduleEventBus = initializationApi.getEventBus();
  moduleId = mId;

  // ⛓ CA-S4: "centre the Region Graph on it", for the OTHER map's "On click" strip (off by default).
  try { registerClickAction(makeRegionGraphCentreAction(() => [..._panelInstances])); }
  catch (e) { logger.warn(`regionGraph.centre not registered: ${e.message}`); }
  return () => { unregisterClickAction(PANEL_ACTION_IDS.graphCentre); };
}

export function postInitialize(initializationApi) {
  logger.info('Post-initialization complete');
}