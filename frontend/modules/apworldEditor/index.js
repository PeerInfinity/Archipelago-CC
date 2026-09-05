// UI Class for this module
import ApworldEditorUI from './apworldEditorUI.js';
import eventBus from '../../app/core/eventBus.js';

// Direct hand-off channel (§2.2): procgen's "Open in APWorld Editor" publishes
// this with { jsonData } instead of the global files:jsonLoaded, so handing a
// world to the editor doesn't wake the substrate panels (which self-activate on
// a full app load and would steal focus). The UI adopts it immediately when
// open; otherwise it's stashed here and drained when the panel mounts.
export const APWORLD_EDITOR_LOAD_RULES = 'apworldEditor:loadRules';

/**
 * ⛓⛓⛓ H4c — **THE OTHER REVERSE LINK: "select this region."** The bounce
 * region editor is a Golden Layout panel in the SAME app as the hub, so it
 * needs no protocol: it raises this panel and names the region it was editing.
 *
 * ⛔ It carries NO document. `loadRules` above hands over a world; this one
 * says *"you already hold one — look at this region of it"*, and a link that
 * pushed a document would silently replace whatever the reader was editing.
 * The hub answers on the document it HAS, and says so when that document does
 * not hold the region (`selectRegion` returns whether it does).
 *
 * ⚠ `player` is OPTIONAL: the bounce editor is opened on ONE region and does
 * not carry the slot it came from, so `null` means *"whichever slot the hub is
 * showing"* rather than a guess this module would have made on its behalf.
 */
export const APWORLD_EDITOR_SELECT_REGION = 'apworldEditor:selectRegion';

let _moduleEventBus = null;
let _pendingEditorRules = null;
let _pendingSelectRegion = null;

/**
 * Consume (and clear) a stashed hand-off, or null. Called by the UI on mount.
 *
 * ⛓ H4c — **THE STASH IS `{jsonData, source}`, NOT THE DOCUMENT ALONE.** Every
 * intake decides its provenance (H2's rule), and the only place a hand-off's
 * provenance is known is the publisher: the pipeline, the marking tool, or —
 * new in H4c — a lab page whose reverse link `procgenLabPanel` forwarded. A
 * stash that carried the bytes and dropped the story would leave the panel
 * filing three different doors under one word.
 *
 * @returns {{jsonData: object, source: string|null}|null}
 */
export function consumePendingEditorRules() {
  const r = _pendingEditorRules;
  _pendingEditorRules = null;
  return r;
}

/**
 * Consume (and clear) a stashed region selection, or null.
 *
 * ⛓ The SAME one-shot stash `consumePendingEditorRules` uses, for the same
 * measured reason: the hub's subscription lives on the PANEL, so a door pressed
 * while the panel has never been mounted would publish into nothing. The
 * module's `initialize()` always runs; the panel's `initialize()` runs when
 * somebody opens it.
 */
export function consumePendingSelectRegion() {
  const r = _pendingSelectRegion;
  _pendingSelectRegion = null;
  return r;
}

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  return {
    publish: (event, data) => eventBus.publish(event, data, 'apworldEditor'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'apworldEditor'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'apworldEditor'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('apworldEditorModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[apworldEditorModule] ${message}`, ...data);
  }
}

export const moduleInfo = {
  name: 'apworldEditor',
  title: 'APWorld Editor',
  componentType: 'apworldEditorPanel',
  icon: '🧩',
  column: 3,
  description: 'GUI editor for apworld rules.json (regions, exits, locations, access rules).',
  requires: ['stateManager'],
};

export function register(registrationApi) {
  log('info', '[APWorld Editor Module] Registering...');
  registrationApi.registerPanelComponent('apworldEditorPanel', ApworldEditorUI);

  registrationApi.registerEventBusPublisher('files:jsonLoaded');
  registrationApi.registerEventBusPublisher('apworldEditor:rulesEdited');

  /**
   * ⛓⛓⛓ H5 — **AND A DEFECT THIS SLICE FOUND: `ui:activatePanel` WAS NEVER
   * REGISTERED HERE.** `eventBus.publish` refuses an unregistered publisher —
   * it logs a warning and RETURNS (`eventBus.js:126-129`) — so H1's Links tab
   * Open button and H3's "Open region graph" button have both been silently
   * doing nothing in the real app since they shipped. Neither in-app row
   * pressed them: they assert the ROWS the tabs draw. Same family as H4b's
   * trap 1180 (an unregistered publish is DROPPED) and the `procgenLab:
   * levelChanged` finding.
   *
   * ⛔ The list below is checked against the panel's own `publish(` call sites
   * by `documentLinks.test.js`, so the next door to be added cannot forget it.
   */
  registrationApi.registerEventBusPublisher('ui:activatePanel');
  // H5's block doors, published from this module's bus by
  // `DOCUMENT_KEY_EDITORS[...].open`.
  registrationApi.registerEventBusPublisher('procgenPipeline:loadRules');
  registrationApi.registerEventBusPublisher('loopsCostDebugger:loadRules');
}

export function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `[APWorld Editor Module] Initializing (${moduleId}, priority ${priorityIndex})...`);
  _moduleEventBus = initializationApi.getEventBus();
  // Stash hand-offs that arrive before the panel exists; the UI drains them on
  // mount. When the panel is already open, the UI's own subscription adopts the
  // rules and clears this slot, so it never goes stale.
  _moduleEventBus.subscribe(APWORLD_EDITOR_LOAD_RULES, (ev) => {
    if (ev && ev.jsonData) {
      _pendingEditorRules = { jsonData: ev.jsonData, source: ev.source ?? null };
    }
  }, 'apworldEditor');
  _moduleEventBus.subscribe(APWORLD_EDITOR_SELECT_REGION, (ev) => {
    if (ev && typeof ev.region === 'string' && ev.region !== '') {
      _pendingSelectRegion = { region: ev.region, player: ev.player ?? null };
    }
  }, 'apworldEditor');
  log('info', '[APWorld Editor Module] Initialized successfully');
}
