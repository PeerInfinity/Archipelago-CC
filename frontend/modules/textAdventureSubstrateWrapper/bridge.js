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
function buildWorldFromStaticData(staticData, currentRegion) {
    if (!staticData?.regions) return null;
    const regions = staticData.regions;
    const rooms = {};
    // Side-table: access_rule per exit / item, keyed by room id.
    // The engine itself doesn't care about rules; the bridge stores
    // them so it can evaluate accessibility when state changes.
    const accessRules = {};
    for (const [regionName, regionData] of regions.entries()) {
        if (!regionName || !regionData) continue;
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
        client.publishEventDispatcher('user:regionMove', {
            sourceRegion: fromRoomId,
            targetRegion: targetRoomId,
            exitName: exitId,
        });
    });

    engine.on('command:examine', ({ roomId, itemId }) => {
        log('debug', 'engine command:examine', { roomId, itemId });
        client.publishEventDispatcher('user:locationCheck', {
            locationName: itemId,
            regionName: roomId,
            originator: 'textAdventureSubstrateWrapper',
        });
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
     * Wait for staticData to arrive in the client cache. The
     * AdapterClient auto-requests on connect, but that initial
     * response may be null if it happens before rules load
     * host-side. On rulesLoaded we re-request and poll until the
     * response arrives.
     */
    async function ensureStaticData(timeoutMs = 3000, intervalMs = 100) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const sd = client.getStaticData();
            if (sd?.regions) return sd;
            client.requestStaticData();
            await new Promise(r => setTimeout(r, intervalMs));
        }
        return null;
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
            engine.loadWorld(w);
            engine.batchUpdate(() => {
                applyInventoryFromSnapshot(engine, snapshot);
                applyCheckedLocationsFromSnapshot(engine, snapshot, w);
                if (currentRegion && w.rooms[currentRegion]) {
                    engine.setCurrentRoom(currentRegion);
                }
            });
            if (currentRegion) {
                evaluateAccessibilityForRoom(engine, client, w, currentRegion);
            }
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

    client.subscribeEventBus('gameState:regionChanged', (data) => {
        const newRegion = data?.newRegion;
        if (!newRegion) return;
        lastSeenRegion = newRegion;
        if (!world) return;  // world not built yet; rebuildWorld will pick up lastSeenRegion
        if (world.rooms[newRegion]) {
            engine.setCurrentRoom(newRegion);
            evaluateAccessibilityForRoom(engine, client, world, newRegion);
        } else {
            log('warn', 'gameState:regionChanged for unknown room', newRegion);
        }
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
