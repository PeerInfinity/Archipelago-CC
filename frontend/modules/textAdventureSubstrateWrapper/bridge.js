/**
 * Bridge — runs inside the iframe. Connects to the host via
 * IframeClient (which uses the existing iframeAdapter postMessage
 * protocol), instantiates the engine in managed mode, and translates
 * AP state into engine API calls / engine events into AP dispatcher
 * events.
 *
 * Phase 1 scope:
 *  - Standalone rules.json playback only (no procgen sidecars).
 *  - Build the engine's world ONCE from staticData.regions when rules
 *    load. Engine sees the full region map; setCurrentRoom drives the
 *    "you are here" view.
 *  - Click an exit  → dispatch user:regionMove via host.
 *  - Click an item  → dispatch user:locationCheck via host.
 *  - Inventory      → mirror snapshot.inventory into engine sidebar.
 *  - Collected      → mark engine items collected from snapshot.checkedLocations.
 *  - Accessibility  → deferred (everything accessible by default).
 *  - Discovery / fog → deferred.
 */

import { IframeClient } from '../iframe-base/iframeClient.js';
import { TextAdventureEngine } from '../textAdventureEngine/engine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { installPlaybackBridge } from './playbackBridge.js';
import {
    customRegionEnterMessage,
    customLocationCheckMessage,
    customLocationInaccessibleMessage,
    customLocationAlreadyCheckedMessage,
    customExitMoveMessage,
    customExitInaccessibleMessage,
} from './templating.js';

const statusEl = document.getElementById('status');
const appEl = document.getElementById('app');

function setStatus(text, kind = '') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = kind;
}

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[tasw-bridge]', ...args);
}

// Plain HTML escaper for the generic-fallback discovery message. The
// templating module has its own copy for templated content; this one
// is used only for the small inline span we build directly.
function escapeHtmlPlain(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ─── World translation ────────────────────────────────────────────

/**
 * Build a complete engine world from staticData.regions. The engine
 * gets the full map upfront; setCurrentRoom moves the "you are here"
 * pointer as the player walks.
 *
 * AP region shape (from staticData.regions, a Map):
 *   { name, exits: [{name, connected_region, access_rule}],
 *     locations: [{name, item: {name}, access_rule}] }
 *
 * Engine world shape (per spec):
 *   { rooms: {[id]: {id, title, description, exits, items}}, startRoomId }
 */
// Procgen mode tracking — populated from the host's initialState
// event (which the host derives from stateManager:rawJsonDataLoaded
// detecting preset_sidecars). When _procgenMode is true and
// _procgenSidecarRegions has entries, buildWorldFromStaticData
// excludes regions not in that set — so synthetic Menu wrappers and
// other non-substrate regions don't appear in the engine's world.
// In standalone mode (no sidecars) the filter is bypassed and every
// AP region becomes a room, preserving the original behavior.
let _procgenMode = false;
let _procgenSidecarRegions = null;  // Set<string> | null
// Per-region exit-side overrides extracted from procgen sidecar
// payloads on textAdventure:loadRegion. The bridge's primary world
// model is built from staticData.regions (which carries no side info);
// these overrides re-introduce N/E/S/W tagging so the engine renders
// procgen exits in the compass grid. Keyed by regionName → Map of
// exitName → side ('N' | 'E' | 'S' | 'W').
const _exitSideOverrides = new Map();
// Custom-data document cache. Populated from initialState; consumed
// by the templating layer when it lands. null until the host pushes
// a value (typically after stateManager:rawJsonDataLoaded fires).
let _customData = null;
export function getCustomData() { return _customData; }

/**
 * Pull per-exit side info out of a procgen sidecar payload. The
 * payload shape varies slightly between substrates; check both
 * exitName and exit_id key names so this works with both engine-
 * native and bridge-native exit ids.
 */
function captureExitSidesFromSidecar(regionName, world) {
    if (!regionName || !world || !Array.isArray(world.exits)) return;
    const map = new Map();
    for (const exit of world.exits) {
        const name = exit?.exitName ?? exit?.exit_id;
        const side = exit?.side;
        if (name && (side === 'N' || side === 'E' || side === 'S' || side === 'W')) {
            map.set(name, side);
        }
    }
    if (map.size === 0) {
        _exitSideOverrides.delete(regionName);
    } else {
        _exitSideOverrides.set(regionName, map);
    }
}

/**
 * Mutate one room's exits to carry the cached side overrides so the
 * engine's compass-grid renderer picks them up on its next render.
 * Idempotent; safe to call on every loadRegion.
 */
function applyExitSideOverridesToWorld(regionName) {
    if (!regionName) return;
    const overrides = _exitSideOverrides.get(regionName);
    if (!overrides) return;
    // World is module-scope in main(); pulled in via closure when
    // this is reached. Guard against early calls before rebuildWorld
    // has populated it.
    if (typeof _activeWorld !== 'object' || !_activeWorld) return;
    const room = _activeWorld.rooms?.[regionName];
    if (!room?.exits) return;
    for (const exit of room.exits) {
        const side = overrides.get(exit.id);
        if (side) exit.side = side;
    }
}

// Active world reference set by rebuildWorld so the side-override
// applier (which fires from event handlers, not main's closure) can
// reach it. Mirrors the `world` local in main(); kept in sync there.
let _activeWorld = null;

function buildWorldFromStaticData(staticData, currentRegion) {
    if (!staticData?.regions) return null;
    const regions = staticData.regions;
    const filterToSidecarRegions = (
        _procgenMode
        && _procgenSidecarRegions instanceof Set
        && _procgenSidecarRegions.size > 0
    );
    const rooms = {};
    // Side-table: access_rule per exit / item, keyed by room id.
    // The engine itself doesn't care about rules; the bridge stores
    // them so it can evaluate accessibility when state changes.
    const accessRules = {};
    for (const [regionName, regionData] of regions.entries()) {
        if (!regionName || !regionData) continue;
        if (filterToSidecarRegions && !_procgenSidecarRegions.has(regionName)) {
            continue;
        }
        rooms[regionName] = {
            id: regionName,
            title: regionName,
            description: `You are in ${regionName}.`,
            exits: (regionData.exits ?? []).map(e => ({
                id: e.name,
                label: e.connected_region
                    ? `${e.name} (to ${e.connected_region})`
                    : e.name,
                targetRoomId: e.connected_region ?? regionName,
            })),
            items: (regionData.locations ?? []).map(loc => ({
                id: loc.name,
                label: loc.name,
                // itemName is the AP item the location contains (e.g.
                // "Sword"), distinct from the location name itself
                // (e.g. "Slay Yorgle"). Used by the templating layer
                // for the {item} placeholder and by the generic check
                // message. May be null when the AP rules don't expose
                // an item (synthetic / placeholder locations).
                itemName: loc.item?.name ?? null,
                description: loc.item?.name
                    ? `${loc.name} — checking sends '${loc.item.name}'.`
                    : loc.name,
            })),
        };
        accessRules[regionName] = {
            exits: Object.fromEntries(
                (regionData.exits ?? []).map(e => [e.name, e.access_rule ?? null])
            ),
            items: Object.fromEntries(
                (regionData.locations ?? []).map(l => [l.name, l.access_rule ?? null])
            ),
        };
    }
    const startRoomId = currentRegion && rooms[currentRegion]
        ? currentRegion
        : (rooms['Menu'] ? 'Menu' : Object.keys(rooms)[0]);
    if (!startRoomId) return null;
    return { rooms, startRoomId, accessRules };
}

// ─── Snapshot → engine state ──────────────────────────────────────

function applyInventoryFromSnapshot(engine, snapshot) {
    const inv = snapshot?.inventory;
    if (!inv) return;
    const items = {};
    // Inventory may be a Map or plain object depending on serialization.
    const entries = inv instanceof Map ? Array.from(inv.entries()) : Object.entries(inv);
    for (const [name, count] of entries) {
        if (!name || !count) continue;
        items[name] = { count, label: name };
    }
    engine.setInventory(items);
}

/**
 * Evaluate access rules for one room's exits and items, push results
 * to the engine. Defaults to accessible=true if a rule is null or
 * evaluation throws.
 *
 * Procgen note: obstacles are not evaluated here as a separate gate.
 * The procgen pipeline (shared/procgen/pathsAndObstaclesCompiler.js)
 * compiles per-tile obstacles into the exit/location's access_rule
 * before they land in rules.json, so evaluating access_rule alone
 * captures both standalone-style "needs item X" gates and procgen-
 * style "tile is blocked by obstacle Y" gates. The original substrate
 * had a separate _isObstacleAtCleared path only because it consumed
 * raw sidecar data; the wrapper consumes staticData and gets the
 * compiled equivalent.
 */
function evaluateAccessibilityForRoom(engine, client, world, roomId) {
    if (!world || !roomId) return;
    const room = world.rooms[roomId];
    const rules = world.accessRules?.[roomId];
    if (!room || !rules) return;
    const snapshot = client.getStateSnapshot();
    const staticData = client.getStaticData();
    if (!snapshot || !staticData) return;

    let ctx;
    try {
        ctx = createSnapshotInterface(snapshot, staticData, {});
    } catch (err) {
        log('warn', 'createSnapshotInterface failed:', err);
        return;
    }

    function evalRule(rule) {
        if (rule == null) return true;
        try {
            return !!evaluateRule(rule, ctx);
        } catch (err) {
            log('debug', 'rule eval threw, defaulting accessible:', err);
            return true;
        }
    }

    engine.batchUpdate(() => {
        for (const exit of room.exits) {
            engine.setExitAccessible(roomId, exit.id, evalRule(rules.exits[exit.id]));
        }
        for (const item of room.items) {
            engine.setItemAccessible(roomId, item.id, evalRule(rules.items[item.id]));
        }
    });
}

function applyCheckedLocationsFromSnapshot(engine, snapshot, world) {
    const checked = snapshot?.checkedLocations;
    if (!checked || !world) return;
    const checkedSet = checked instanceof Set
        ? checked
        : new Set(Array.isArray(checked) ? checked : []);
    engine.batchUpdate(() => {
        for (const room of Object.values(world.rooms)) {
            for (const item of room.items) {
                if (checkedSet.has(item.id)) {
                    engine.setItemCollected(room.id, item.id, true);
                }
            }
        }
    });
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
    setStatus('Connecting to host…');

    const client = new IframeClient();
    const connected = await client.connect();
    if (!connected) {
        setStatus('Failed to connect to host', 'error');
        log('error', 'IframeClient.connect() returned false');
        return;
    }
    setStatus('Connected — waiting for rules', 'connected');
    log('info', 'Connected to host');

    const engine = new TextAdventureEngine(appEl, { managed: true });

    // Engine → AP: translate command events into dispatcher publishes.
    // Payload shapes match what gameState/locations expect (see
    // textAdventureSubstrateUI.js and locations/locationUI.js).
    engine.on('command:move', ({ fromRoomId, exitId, targetRoomId }) => {
        log('debug', 'engine command:move', { fromRoomId, exitId, targetRoomId });
        // Push the exit's move prose (custom or generic) before
        // dispatching, so the message lands before the region change.
        const templated = customExitMoveMessage(_customData, exitId, {
            destinationRegion: targetRoomId,
        });
        if (templated) {
            engine.displayMessage(templated, 'normal', { html: true });
        }
        client.publishEventDispatcher('user:regionMove', {
            sourceRegion: fromRoomId,
            targetRegion: targetRoomId,
            exitName: exitId,
        });
    });

    engine.on('command:examine', ({ roomId, itemId }) => {
        log('debug', 'engine command:examine', { roomId, itemId });
        // Resolve the item the location contains (loc.item.name) vs.
        // the location name itself. Templates expect {item} = the
        // actual reward and {locationName} = the spot being searched;
        // conflating the two showed location names where item names
        // should appear. wasUnchecked is true (the engine fires
        // command:examine before the snapshot round-trip), so {item}
        // gets the styled tae-item-name span.
        const item = world?.rooms[roomId]?.items.find(i => i.id === itemId);
        const locationName = item?.label ?? itemId;
        const itemNameRaw = item?.itemName ?? null;
        const templated = customLocationCheckMessage(_customData, itemId, {
            item: itemNameRaw ?? 'something',
            wasUnchecked: true,
        });
        if (templated) {
            engine.displayMessage(templated, 'discovery', { html: true });
        } else {
            // Mirror the original substrate's generic check message
            // so the verb makes the action's intent ("search") clear
            // — "discover" was being mistaken for the explore action.
            const itemHtml = itemNameRaw
                ? `<span class="tae-item-name">${escapeHtmlPlain(itemNameRaw)}</span>`
                : 'something';
            engine.displayMessage(
                `You search ${escapeHtmlPlain(locationName)} and find ${itemHtml}.`,
                'discovery',
                { html: true },
            );
        }
        client.publishEventDispatcher('user:locationCheck', {
            locationName: itemId,
            regionName: roomId,
            originator: 'textAdventureSubstrateWrapper',
        });
    });

    engine.on('command:examineBlocked', ({ roomId, itemId, reason }) => {
        const item = world?.rooms[roomId]?.items.find(i => i.id === itemId);
        const itemLabel = item?.label ?? itemId;
        if (reason === 'collected') {
            const t = customLocationAlreadyCheckedMessage(_customData, itemId, { item: itemLabel });
            engine.displayMessage(
                t ?? `${itemLabel}: already examined.`,
                'system',
                t ? { html: true } : {},
            );
        } else {
            const t = customLocationInaccessibleMessage(_customData, itemId, { item: itemLabel });
            engine.displayMessage(
                t ?? `You can't interact with that: ${itemLabel}.`,
                'error',
                t ? { html: true } : {},
            );
        }
    });

    engine.on('command:moveBlocked', ({ fromRoomId, exitId, targetRoomId }) => {
        const exit = world?.rooms[fromRoomId]?.exits.find(e => e.id === exitId);
        const exitLabel = exit?.label ?? exitId;
        const t = customExitInaccessibleMessage(_customData, exitId, {
            destinationRegion: targetRoomId,
        });
        engine.displayMessage(
            t ?? `You can't go that way: ${exitLabel}.`,
            'error',
            t ? { html: true } : {},
        );
    });

    engine.on('command:explore', ({ roomId }) => {
        log('debug', 'engine command:explore', { roomId });
        // Out-of-loop-mode behavior: dispatch loop:exploreCompleted
        // directly. Discovery module's handler picks one undiscovered
        // location or exit and reveals it; the discovery events fire
        // back through our existing subscriptions.
        client.publishEventDispatcher('loop:exploreCompleted', {
            regionName: roomId,
        });
    });

    // World cache — rebuild if rules change.
    let world = null;
    let rebuildInFlight = false;
    // Last region seen via gameState:regionChanged. Tracked so we can
    // pick it up if the event fires before the world is built.
    let lastSeenRegion = null;
    // Last initialState received. Cached so rebuildWorld can re-apply
    // discovered flags after the world is built (initialState often
    // arrives before staticData polling completes).
    let pendingInitialState = null;

    /**
     * Force a fresh staticData fetch and wait for the response.
     *
     * Why force-fresh: the AdapterClient caches staticData from the
     * first response and keeps returning it via getStaticData() until
     * a new response overwrites it. On rules-change events (e.g.
     * switching from a standalone preset to a procgen one), the
     * cached value is stale. We request fresh and wait until the
     * cached reference changes (each response is a freshly-serialized
     * object, so a new response = new reference).
     *
     * Falls back to whatever's in the cache after timeout if no fresh
     * response arrives.
     */
    async function ensureStaticData(timeoutMs = 3000, intervalMs = 100) {
        const before = client.getStaticData();
        client.requestStaticData();
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const now = client.getStaticData();
            if (now?.regions && now !== before) return now;
            await new Promise(r => setTimeout(r, intervalMs));
            client.requestStaticData();
        }
        // Timed out waiting for a fresh response; return whatever we have.
        return client.getStaticData();
    }

    async function rebuildWorld() {
        if (rebuildInFlight) return;
        rebuildInFlight = true;
        try {
            const staticData = await ensureStaticData();
            if (!staticData) {
                log('warn', 'rebuildWorld: timed out waiting for staticData');
                setStatus('No staticData received', 'error');
                return;
            }
            const snapshot = client.getStateSnapshot();
            const currentRegion = snapshot?.currentRegion ?? lastSeenRegion ?? null;
            const w = buildWorldFromStaticData(staticData, currentRegion);
            if (!w) {
                log('warn', 'rebuildWorld: staticData arrived but has no regions');
                return;
            }
            world = w;
            _activeWorld = w;
            // Replay any cached side overrides — sidecar loadRegion
            // events may have fired before the world was built, in
            // which case the overrides got cached but couldn't be
            // applied. Apply them now so the first compass render is
            // correct.
            for (const regionName of _exitSideOverrides.keys()) {
                applyExitSideOverridesToWorld(regionName);
            }
            engine.loadWorld(w);
            engine.batchUpdate(() => {
                applyInventoryFromSnapshot(engine, snapshot);
                applyCheckedLocationsFromSnapshot(engine, snapshot, w);
                if (currentRegion && w.rooms[currentRegion]) {
                    // Route through applyRegionChange so the templated
                    // enter message fires on the initial mount too,
                    // not just on subsequent gameState transitions.
                    applyRegionChange(currentRegion, 'rebuildWorld');
                }
            });
            // Re-apply any initialState that arrived before the world
            // was built (discoveryMode already applied; this fills in
            // room/item discovered flags now that we have a world).
            if (pendingInitialState) {
                applyInitialState(pendingInitialState);
            }
            setStatus('Connected', 'connected');
            log('info', `world built: ${Object.keys(w.rooms).length} rooms, current=${currentRegion}`);
        } finally {
            rebuildInFlight = false;
        }
    }

    function applySnapshot() {
        const snapshot = client.getStateSnapshot();
        if (!world) return;
        engine.batchUpdate(() => {
            applyInventoryFromSnapshot(engine, snapshot);
            applyCheckedLocationsFromSnapshot(engine, snapshot, world);
        });
        if (lastSeenRegion) {
            evaluateAccessibilityForRoom(engine, client, world, lastSeenRegion);
        }
    }

    // AP → engine: subscribe to host events.
    client.subscribeEventBus('stateManager:rulesLoaded', () => {
        log('info', 'stateManager:rulesLoaded — rebuilding world');
        rebuildWorld();
    });

    client.subscribeEventBus('stateManager:snapshotUpdated', () => {
        if (!world) {
            // Snapshot arrived before world was built — try to build now.
            rebuildWorld();
        } else {
            applySnapshot();
        }
    });

    function applyInitialState(data) {
        if (!data) return;
        if (data.discoveryMode) {
            engine.setDiscoveryMode(data.discoveryMode);
        }
        if (data.engineSettings && typeof data.engineSettings === 'object') {
            for (const [key, value] of Object.entries(data.engineSettings)) {
                engine.setOption(key, value);
            }
        }
        if ('customData' in data) {
            // null is a valid reset (rules changed, no prose for the
            // new game); explicitly accept it instead of ignoring.
            _customData = data.customData;
        }
        // Update procgen-mode filter state from the host. We do NOT
        // trigger a rebuildWorld here — staticData isn't refreshed
        // until stateManager:rulesLoaded fires (which happens AFTER
        // rawJsonDataLoaded → initialState). Triggering a rebuild now
        // would pick up the previous preset's regions, filter them
        // all out, and produce an empty world; the subsequent
        // rulesLoaded-triggered rebuild would then be blocked by
        // rebuildInFlight. Trust the rulesLoaded subscription to do
        // the rebuild with both the new procgen state and fresh
        // staticData in place.
        _procgenMode = !!data.procgenMode;
        _procgenSidecarRegions = Array.isArray(data.procgenSidecarRegions)
            ? new Set(data.procgenSidecarRegions)
            : null;
        if (!world) return;
        engine.batchUpdate(() => {
            for (const regionName of data.discoveredRegions ?? []) {
                if (world.rooms[regionName]) {
                    engine.setRoomDiscovered(regionName, true);
                }
            }
            for (const locationName of data.discoveredLocations ?? []) {
                for (const room of Object.values(world.rooms)) {
                    if (room.items.some(i => i.id === locationName)) {
                        engine.setItemDiscovered(room.id, locationName, true);
                        break;
                    }
                }
            }
            // discoveredExits is an array of {regionName, exitName} pairs.
            for (const { regionName, exitName } of data.discoveredExits ?? []) {
                if (world.rooms[regionName]?.exits.some(e => e.id === exitName)) {
                    engine.setExitDiscovered(regionName, exitName, true);
                }
            }
        });
    }

    // Discovery initial state — relayed by the wrapper's host-side
    // index.js on iframe:appReady. Carries the current discovery
    // mode and the sets of already-discovered regions / locations
    // (the iframe protocol has no native way to query these on
    // connect).
    client.subscribeEventBus('textAdventureSubstrateWrapper:initialState', (data) => {
        log('debug', 'initialState received', data);
        pendingInitialState = data;
        applyInitialState(data);  // applies what it can; if no world, only mode applies
    });

    // Host-pushed header info (mana readout etc.). The host computes
    // the text; the engine just renders it. Null text hides the bar.
    client.subscribeEventBus('textAdventureSubstrateWrapper:headerInfo', (data) => {
        engine.setHeaderInfo(data && data.text ? { text: data.text } : null);
    });

    // Panel became the active tab in its Golden Layout stack. Refocus
    // the engine's command input so the player can immediately type
    // without clicking. Setting-gated via autoFocusCommandInput inside
    // the engine.
    client.subscribeEventBus('textAdventureSubstrateWrapper:panelShown', () => {
        engine.maybeFocus();
    });

    // Discovery incremental events.
    client.subscribeEventBus('discovery:modeChanged', (data) => {
        const mode = data?.active ? 'discovered' : 'full';
        log('debug', 'discovery:modeChanged', mode);
        engine.setDiscoveryMode(mode);
    });

    client.subscribeEventBus('discovery:regionDiscovered', (data) => {
        const regionName = data?.regionName;
        if (!regionName || !world?.rooms[regionName]) return;
        engine.setRoomDiscovered(regionName, true);
    });

    client.subscribeEventBus('discovery:locationDiscovered', (data) => {
        const locationName = data?.locationName;
        if (!locationName || !world) return;
        // Find which room the location belongs to.
        for (const room of Object.values(world.rooms)) {
            if (room.items.some(i => i.id === locationName)) {
                engine.setItemDiscovered(room.id, locationName, true);
                return;
            }
        }
    });

    client.subscribeEventBus('discovery:exitDiscovered', (data) => {
        const { regionName, exitName } = data ?? {};
        if (!regionName || !exitName || !world) return;
        engine.setExitDiscovered(regionName, exitName, true);
    });

    function applyRegionChange(newRegion, source) {
        if (!newRegion) return;
        lastSeenRegion = newRegion;
        if (!world) return;
        if (world.rooms[newRegion]) {
            // Push the templated (or generic) enter message before
            // setCurrentRoom — the engine's managed mode skips its
            // own room description, so this is the only enter prose
            // the player sees.
            const templated = customRegionEnterMessage(_customData, newRegion);
            engine.displayMessage(
                templated ?? `You are in ${newRegion}.`,
                'normal',
                templated ? { html: true } : {},
            );
            engine.setCurrentRoom(newRegion);
            evaluateAccessibilityForRoom(engine, client, world, newRegion);
        } else {
            log('warn', `${source} for unknown room`, newRegion);
        }
    }

    client.subscribeEventBus('gameState:regionChanged', (data) => {
        applyRegionChange(data?.newRegion, 'gameState:regionChanged');
    });

    // Procgen mode: procgenPlayer fires textAdventure:loadRegion with
    // {region_id, world, arrivedFrom}. The tile-grid bits inside
    // `world` aren't needed (compiled access_rules cover gating), but
    // exit `side` IS needed for compass-grid rendering and isn't in
    // staticData. Extract it here, cache for later loads, and apply
    // to the current world if it's already built.
    client.subscribeEventBus('textAdventure:loadRegion', (data) => {
        const regionName = data?.region_id;
        captureExitSidesFromSidecar(regionName, data?.world);
        applyExitSideOverridesToWorld(regionName);
        applyRegionChange(regionName, 'textAdventure:loadRegion');
    });

    // Install the playback bridge so the host-side PlaybackProxy can
    // drive walkTo / play / step / etc. from the playback bot. The
    // bridge owns its own clock and dispatches AP events directly via
    // the client (it doesn't touch the engine; bot-issued walks
    // resolve through the standard user:regionMove / user:locationCheck
    // chain, which discovery + gameState already handle, and the
    // engine UI updates from the host snapshots that come back).
    installPlaybackBridge({
        client,
        getWorld: () => world,
        getCurrentRegion: () => lastSeenRegion,
        log,
    });

    client.notifyAppReady();

    // Always attempt an initial build. ensureStaticData polls + re-
    // requests, so this succeeds whether or not rules are loaded yet
    // (and is idempotent if rulesLoaded fires concurrently). Covers
    // the case where the bridge connects AFTER the host's
    // rulesLoaded event, missing it entirely.
    log('info', 'initial rebuildWorld attempt at connect');
    rebuildWorld();
}

main().catch(err => {
    log('error', 'fatal:', err);
    setStatus(`Error: ${err.message}`, 'error');
});
