/**
 * Text Adventure substrate panel — renders a procgen-emitted region
 * as a textual description with clickable exits and locations.
 *
 * v1 features (this commit):
 *   - Self-activation on textAdventure:loadRegion
 *   - Region heading
 *   - Exit list with compass directions ("Exit south to Overworld")
 *     and accessibility classes (open / closed) reflecting logic-gate
 *     clearance via stateManager + Rule Builder evaluation
 *   - Location list with checked/unchecked separation; unchecked are
 *     clickable, checked are plain text
 *   - Click handlers publish user:regionMove and user:locationCheck
 *     through the module dispatcher
 *   - Reactivity to stateManager:snapshotUpdated (re-renders on
 *     inventory / checkedLocations changes so accessibility flips
 *     immediately)
 *   - Item-on-discovery highlighting (lifts the existing module's
 *     <span class="item-name"> pattern)
 *   - Inventory display ("Your inventory: ...")
 *   - Look button (re-renders the current region)
 *   - Message history with limit
 *   - Arrival message keyed off arrivedFrom.exit_id
 *
 * v2 / deferred:
 *   - Discovery mode
 *   - Custom-data prose templating
 *   - Settings schema
 *   - Text-input command parser
 *   - Standalone mode (load AP rules.json without procgen)
 *
 * The panel reads from the deserialized tile-grid world (same shape
 * the maze panel consumes): exits.Map, items.Map, obstacles.Map,
 * obstacleLib, itemLocationNames. Tile geometry is unused — exits
 * are addressed by exit_id, locations by world.itemLocationNames
 * (canonical AP location names baked in by the pipeline).
 */

import { setPanelInstance, consumePendingLoadRegion, getModuleApis } from './index.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { getDiscoverySettings } from '../discovery/index.js';
// Subscribe through the raw eventBus with an explicit module name —
// can't rely on this.apis.eventBus because Golden Layout may build
// the panel before this module's initialize() has run.
import eventBus from '../../app/core/eventBus.js';

// Compass words for each side. Used to render "Exit {direction} to ..."
const SIDE_TO_DIRECTION = Object.freeze({
    N: 'north', S: 'south', E: 'east', W: 'west',
});

const MESSAGE_HISTORY_LIMIT = 10;

// Coerce stateManager's snapshot.inventory ({ itemName: count }) into
// the Set<itemId> shape isObstacleCleared expects.
function inventoryFromSnapshot(snapshot) {
    if (!snapshot?.inventory) return new Set();
    const set = new Set();
    for (const [id, count] of Object.entries(snapshot.inventory)) {
        if (count > 0) set.add(id);
    }
    return set;
}

function checkedLocationsFromSnapshot(snapshot) {
    const v = snapshot?.checkedLocations;
    if (v instanceof Set) return v;
    if (Array.isArray(v)) return new Set(v);
    return new Set();
}

export class TextAdventureSubstrateUI {
    static moduleApis = null;
    static setModuleApis(apis) { TextAdventureSubstrateUI.moduleApis = apis; }

    constructor(container, _componentState) {
        this.container = container;
        this.world = null;
        this.currentRegionId = null;
        this.arrivedFromExitId = null;
        this.messageHistory = [];

        // Snapshot view; refreshed on stateManager:snapshotUpdated.
        this.inventory = new Set();
        this.checkedLocations = new Set();

        // Track the previous checked-locations set so we can detect new
        // discoveries between snapshots and trigger item-name
        // highlighting in the message history.
        this._previousCheckedLocations = new Set();

        // Discovery-mode filter state. When active, locations and
        // exits not in discoveryStateSingleton are hidden from the UI.
        // Mode flips via discovery:modeChanged; discovery state changes
        // (e.g. populated by another module) are observed via
        // discovery:changed. Initial state read at construction so we
        // don't miss the discovery module's own boot-time setup.
        this.discoveryModeActive = false;
        try {
            this.discoveryModeActive = !!getDiscoverySettings()?.enableDiscoveryMode;
        } catch {
            // Discovery module not loaded yet (headless tests); default off.
        }

        // Guard DOM creation so the panel constructs cleanly in
        // headless test environments (vitest runs under 'node').
        if (typeof document !== 'undefined') {
            this.rootElement = document.createElement('div');
            this.rootElement.className = 'text-adventure-substrate-panel';
            this.rootElement.addEventListener('click', (e) => this._handleClick(e));
        } else {
            this.rootElement = null;
        }

        setPanelInstance(this);

        // If textAdventure:loadRegion fired before this panel mounted,
        // index.js buffered the payload. Drain it now.
        const pending = consumePendingLoadRegion();
        if (pending) {
            this._adoptLoadedRegion(pending);
        }

        this._subscribeToSnapshotUpdates();
        this._subscribeToDiscoveryEvents();
        this.render();

        // The Golden Layout factory wrapper (frontend/app/layout/
        // desktopLayout.js:createGoldenLayoutComponentFactory) calls
        // getRootElement() and appends the returned node to its
        // container. Don't append here too — that would double-mount.
    }

    get apis() { return TextAdventureSubstrateUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }

    _subscribeToSnapshotUpdates() {
        const handler = (data) => {
            const newChecked = checkedLocationsFromSnapshot(data?.snapshot);
            this.inventory = inventoryFromSnapshot(data?.snapshot);
            this._previousCheckedLocations = this.checkedLocations;
            this.checkedLocations = newChecked;
            this.render();
        };
        if (eventBus?.subscribe) {
            eventBus.subscribe('stateManager:snapshotUpdated', handler, 'textAdventureSubstrate');
            this._unsubSnapshot = () =>
                eventBus.unsubscribe?.('stateManager:snapshotUpdated', handler, 'textAdventureSubstrate');
        }
    }

    _subscribeToDiscoveryEvents() {
        if (!eventBus?.subscribe) return;
        const onModeChanged = (data) => {
            this.discoveryModeActive = !!data?.active;
            this.render();
        };
        const onDiscoveryChanged = () => {
            // Re-render when something gets discovered — e.g. another
            // module marked a location while the player wasn't looking.
            this.render();
        };
        eventBus.subscribe('discovery:modeChanged', onModeChanged, 'textAdventureSubstrate');
        eventBus.subscribe('discovery:changed', onDiscoveryChanged, 'textAdventureSubstrate');
        this._unsubDiscoveryMode = () =>
            eventBus.unsubscribe?.('discovery:modeChanged', onModeChanged, 'textAdventureSubstrate');
        this._unsubDiscoveryChanged = () =>
            eventBus.unsubscribe?.('discovery:changed', onDiscoveryChanged, 'textAdventureSubstrate');
    }

    /**
     * Mark every location and exit in the current region as discovered.
     * Text-adventure substrate semantics: walking into a region reveals
     * the whole region. Idempotent — discoveryStateSingleton's
     * mutators no-op when already discovered.
     */
    _discoverEverythingInRegion() {
        if (!this.world || !this.currentRegionId) return;
        if (!discoveryStateSingleton) return;
        // Locations: keyed by AP-canonical name baked into world.itemLocationNames
        // by the pipeline at serialization time.
        if (this.world.itemLocationNames) {
            for (const locationName of this.world.itemLocationNames.values()) {
                if (locationName) discoveryStateSingleton.discoverLocation?.(locationName);
            }
        }
        // Exits: keyed by exitName on each entry. The region itself
        // is also marked via discoverExit's internal cascade.
        if (this.world.exits) {
            for (const exit of this.world.exits.values()) {
                const name = exit.exitName ?? exit.exit_id;
                if (name) discoveryStateSingleton.discoverExit?.(this.currentRegionId, name);
            }
        }
    }

    /**
     * Apply a region payload published via textAdventure:loadRegion.
     * Called by the module-level handler when this panel is mounted,
     * and via the constructor on initial mount with any buffered
     * payload.
     */
    applyLoadedRegion(payload) {
        this._adoptLoadedRegion(payload);
        this.render();
    }

    _adoptLoadedRegion(payload) {
        // Payload shape (per procgen-player.md §"Event flow"):
        //   { region_id, world, arrivedFrom }
        this.world = payload?.world ?? null;
        this.currentRegionId = payload?.region_id ?? null;
        this.arrivedFromExitId = payload?.arrivedFrom?.exit_id ?? null;

        // Refresh state view eagerly so the first render after a
        // region change reflects current inventory / checked locations
        // even if no snapshotUpdated event has arrived yet.
        const snapshot = stateManagerProxySingleton?.getSnapshot?.();
        this.inventory = inventoryFromSnapshot(snapshot);
        this.checkedLocations = checkedLocationsFromSnapshot(snapshot);
        this._previousCheckedLocations = new Set(this.checkedLocations);

        // Text-adventure semantics: entering a region reveals its
        // entire contents. Discovery mode (the UI filter) only
        // affects rendering — the discovery state grows on entry
        // either way.
        this._discoverEverythingInRegion();

        this._addMessage(this._arrivalMessage());
    }

    _arrivalMessage() {
        if (!this.currentRegionId) return '';
        if (!this.arrivedFromExitId || !this.world?.exits?.has(this.arrivedFromExitId)) {
            return `You are now in ${this.currentRegionId}.`;
        }
        const arrivalExit = this.world.exits.get(this.arrivedFromExitId);
        // The arrival exit is the exit IN THIS REGION that points back
        // to where the player came from. Its `side` is the wall that
        // exit sits on, so the player arrived from THAT direction
        // — not the opposite. Standing facing inward at the east
        // wall means you arrived from the east.
        const direction = SIDE_TO_DIRECTION[arrivalExit.side];
        if (!direction) {
            return `You arrive in ${this.currentRegionId} from ${arrivalExit.targetRegion ?? 'elsewhere'}.`;
        }
        const sourceRegion = arrivalExit.targetRegion;
        if (sourceRegion) {
            return `You arrive in ${this.currentRegionId} from ${sourceRegion} (to the ${direction}).`;
        }
        return `You arrive in ${this.currentRegionId} from the ${direction}.`;
    }

    // --- Accessibility lookups ---

    _ruleEvaluator() {
        const snapshot = stateManagerProxySingleton?.getSnapshot?.();
        const staticData = stateManagerProxySingleton?.getStaticData?.();
        if (!snapshot || !staticData) return null;
        const snapshotInterface = createSnapshotInterface(snapshot, staticData);
        return (rule) => evaluateRule(rule, snapshotInterface);
    }

    _isObstacleAtCleared(x, y) {
        const obstacleId = this.world?.obstacles?.get(`${x},${y}`);
        if (!obstacleId) return true; // no gate → trivially open
        const evaluateRuleObstacle = this._ruleEvaluator();
        return isObstacleCleared(obstacleId, this.inventory, this.world.obstacleLib, {
            evaluateRule: evaluateRuleObstacle,
        });
    }

    _isExitOpen(exit) {
        return this._isObstacleAtCleared(exit.x, exit.y);
    }

    _isLocationOpen(itemPosKey) {
        const [x, y] = itemPosKey.split(',').map(Number);
        return this._isObstacleAtCleared(x, y);
    }

    // --- Rendering ---

    render() {
        if (!this.rootElement) return;
        this.rootElement.innerHTML = '';

        if (!this.world || !this.currentRegionId) {
            const placeholder = document.createElement('div');
            placeholder.className = 'text-adventure-placeholder';
            placeholder.textContent = 'Waiting for region…';
            this.rootElement.appendChild(placeholder);
            return;
        }

        this.rootElement.appendChild(this._renderHeading());

        const locationsSection = this._renderLocations();
        if (locationsSection) this.rootElement.appendChild(locationsSection);

        const exitsSection = this._renderExits();
        if (exitsSection) this.rootElement.appendChild(exitsSection);

        this.rootElement.appendChild(this._renderInventory());
        this.rootElement.appendChild(this._renderLookButton());
        this.rootElement.appendChild(this._renderMessageHistory());
    }

    _renderHeading() {
        const heading = document.createElement('h2');
        heading.className = 'text-adventure-region-name';
        heading.textContent = this.currentRegionId;
        return heading;
    }

    _renderExits() {
        if (!this.world?.exits || this.world.exits.size === 0) return null;

        // Filter out undiscovered exits when discovery mode is on.
        // _discoverEverythingInRegion populates on entry, so the
        // filter is normally a no-op for the current region — it
        // matters when this panel renders before population has
        // run, or if discovery state is reset externally.
        const visible = [];
        for (const exit of this.world.exits.values()) {
            if (this._isExitVisibleToUI(exit)) visible.push(exit);
        }
        if (visible.length === 0) return null;

        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-exits';

        const label = document.createElement('div');
        label.className = 'text-adventure-section-label';
        label.textContent = 'Exits';
        section.appendChild(label);

        const list = document.createElement('div');
        for (const exit of visible) {
            list.appendChild(this._renderExitLink(exit));
            list.appendChild(document.createTextNode(' '));
        }
        section.appendChild(list);
        return section;
    }

    _isExitVisibleToUI(exit) {
        if (!this.discoveryModeActive) return true;
        if (!discoveryStateSingleton || !this.currentRegionId) return true;
        const name = exit.exitName ?? exit.exit_id;
        return discoveryStateSingleton.isExitDiscovered?.(this.currentRegionId, name) ?? true;
    }

    _isLocationVisibleToUI(locationName) {
        if (!this.discoveryModeActive) return true;
        if (!discoveryStateSingleton || !locationName) return true;
        return discoveryStateSingleton.isLocationDiscovered?.(locationName) ?? true;
    }

    _renderExitLink(exit) {
        const accessible = this._isExitOpen(exit);
        const direction = SIDE_TO_DIRECTION[exit.side];
        const target = exit.targetRegion ?? '???';
        const label = direction
            ? `Exit ${direction} to ${target}`
            : `Exit to ${target}`;

        const span = document.createElement('span');
        span.className = `text-adventure-link ${accessible ? 'accessible' : 'inaccessible'}`;
        span.dataset.kind = 'exit';
        span.dataset.exitId = exit.exit_id;
        span.textContent = label;
        return span;
    }

    _renderLocations() {
        if (!this.world?.items || this.world.items.size === 0) return null;

        const unchecked = [];
        const checked = [];
        for (const [posKey, itemId] of this.world.items) {
            const locationName = this.world.itemLocationNames?.get(posKey);
            if (!locationName) continue;
            if (!this._isLocationVisibleToUI(locationName)) continue;
            const entry = { posKey, itemId, locationName };
            if (this.checkedLocations.has(locationName)) {
                checked.push(entry);
            } else {
                unchecked.push(entry);
            }
        }
        if (unchecked.length === 0 && checked.length === 0) return null;

        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-locations';

        if (unchecked.length > 0) {
            const label = document.createElement('div');
            label.className = 'text-adventure-section-label';
            label.textContent = 'You can search';
            section.appendChild(label);

            const list = document.createElement('div');
            for (const entry of unchecked) {
                list.appendChild(this._renderLocationLink(entry));
                list.appendChild(document.createTextNode(' '));
            }
            section.appendChild(list);
        }

        if (checked.length > 0) {
            const label = document.createElement('div');
            label.className = 'text-adventure-section-label';
            label.textContent = 'Already searched';
            section.appendChild(label);

            const list = document.createElement('div');
            list.textContent = checked.map((e) => e.locationName).join(', ');
            section.appendChild(list);
        }

        return section;
    }

    _renderLocationLink(entry) {
        const accessible = this._isLocationOpen(entry.posKey);
        const span = document.createElement('span');
        span.className = `text-adventure-link ${accessible ? 'accessible' : 'inaccessible'}`;
        span.dataset.kind = 'location';
        span.dataset.locationName = entry.locationName;
        span.textContent = entry.locationName;
        return span;
    }

    _renderInventory() {
        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-inventory';

        const label = document.createElement('div');
        label.className = 'text-adventure-section-label';
        label.textContent = 'Inventory';
        section.appendChild(label);

        const list = document.createElement('div');
        if (this.inventory.size === 0) {
            list.textContent = 'empty';
        } else {
            list.textContent = [...this.inventory].sort().join(', ');
        }
        section.appendChild(list);
        return section;
    }

    _renderLookButton() {
        const wrapper = document.createElement('div');
        wrapper.className = 'text-adventure-section';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-adventure-look-button';
        button.textContent = 'Look';
        button.dataset.kind = 'look';
        wrapper.appendChild(button);
        return wrapper;
    }

    _renderMessageHistory() {
        const section = document.createElement('div');
        section.className = 'text-adventure-message-history';
        for (const entry of this.messageHistory) {
            const div = document.createElement('div');
            div.className = 'text-adventure-message';
            div.innerHTML = entry.html;
            section.appendChild(div);
        }
        return section;
    }

    // --- Click handling ---

    _handleClick(event) {
        const target = event.target?.closest('[data-kind]');
        if (!target) return;
        const kind = target.dataset.kind;
        if (kind === 'exit') {
            this._onExitClick(target.dataset.exitId);
        } else if (kind === 'location') {
            this._onLocationClick(target.dataset.locationName);
        } else if (kind === 'look') {
            this._onLookClick();
        }
    }

    _onExitClick(exitId) {
        const exit = this.world?.exits?.get(exitId);
        if (!exit || !exit.targetRegion) return;
        if (!this._isExitOpen(exit)) {
            const direction = SIDE_TO_DIRECTION[exit.side];
            const dirText = direction ? ` ${direction}` : '';
            this._addMessage(`The exit${dirText} to ${exit.targetRegion} is blocked.`);
            return;
        }
        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        dispatcher.publish('user:regionMove', {
            sourceRegion: this.currentRegionId,
            targetRegion: exit.targetRegion,
            exitName: exit.exitName ?? exit.exit_id,
        }, { initialTarget: 'bottom' });
    }

    _onLocationClick(locationName) {
        if (!locationName) return;
        if (this.checkedLocations.has(locationName)) {
            this._addMessage(`You have already searched ${locationName}.`);
            return;
        }
        // Find the location's tile to verify accessibility.
        let posKey = null;
        let itemId = null;
        if (this.world?.itemLocationNames) {
            for (const [k, name] of this.world.itemLocationNames) {
                if (name === locationName) {
                    posKey = k;
                    itemId = this.world.items?.get(k);
                    break;
                }
            }
        }
        if (posKey && !this._isLocationOpen(posKey)) {
            this._addMessage(`You cannot reach ${locationName} from here.`);
            return;
        }

        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        dispatcher.publish('user:locationCheck', {
            locationName,
            regionName: this.currentRegionId,
        }, { initialTarget: 'bottom' });

        // Optimistic discovery message: stateManager will dispatch
        // back via snapshotUpdated, and that's when the panel re-renders
        // with the location moved into "Already searched". The message
        // is added eagerly so the player sees feedback even if the
        // snapshot pipeline is asynchronous.
        const itemHtml = itemId
            ? `<span class="item-name">${escapeHtml(itemId)}</span>`
            : 'something';
        this._addMessageHtml(`You search ${escapeHtml(locationName)} and find ${itemHtml}.`);
    }

    _onLookClick() {
        if (!this.currentRegionId) return;
        this._addMessage(`You look around ${this.currentRegionId}.`);
    }

    // --- Messages ---

    /** Add a plain-text message; HTML is escaped before display. */
    _addMessage(text) {
        if (!text) return;
        this._pushMessage(escapeHtml(text));
    }

    /**
     * Add an HTML-pre-formatted message. Caller is responsible for
     * escaping any user-controlled fields (location names, etc.); only
     * trusted markup (e.g. `<span class="item-name">…</span>`) should
     * be passed unescaped.
     */
    _addMessageHtml(html) {
        if (!html) return;
        this._pushMessage(html);
    }

    _pushMessage(html) {
        this.messageHistory.push({ html, timestamp: Date.now() });
        while (this.messageHistory.length > MESSAGE_HISTORY_LIMIT) {
            this.messageHistory.shift();
        }
    }

    destroy() {
        if (this._unsubSnapshot) { this._unsubSnapshot(); this._unsubSnapshot = null; }
        if (this._unsubDiscoveryMode) { this._unsubDiscoveryMode(); this._unsubDiscoveryMode = null; }
        if (this._unsubDiscoveryChanged) { this._unsubDiscoveryChanged(); this._unsubDiscoveryChanged = null; }
        this.rootElement = null;
        this.world = null;
    }
}

// Minimal HTML-escape for messages we render via innerHTML. Shows up
// when the only HTML content is the item-name highlight span we
// inject ourselves; everything else (location names, region names)
// must be escaped because they come from rules.json.
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
