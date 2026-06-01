/**
 * Bridge — runs inside the SWFRecomp game iframe. Injected by
 * swfrecompSubstratePanel after the iframe's `load` event fires.
 *
 * Responsibilities (Mode 1 / v1):
 *   - Complete the iframeAdapter handshake (IframeClient).
 *   - On swfrecomp:loadRegion: configure the in-iframe game from the
 *     region payload via the window-exposed `__swfBridge.configure`
 *     contract, then push any already-received items via pollItems.
 *   - Wire the game's cooperative outward call: when the game's
 *     ActionScript calls __swfBridge.sendLocation(flashName), translate
 *     flashName -> AP location id via the region's ap_locations map and
 *     dispatch user:locationCheck up the dispatcher chain.
 *   - On stateManager state changes: re-poll received items into the
 *     game so newly-received items get applied.
 *
 * The `__swfBridge` contract is whatever the recompiled game page
 * exposes on its window. v1's placeholder page stubs it (configure /
 * pollItems no-ops + a manual "complete objective" button calling
 * sendLocation). The real recompiled page fulfils the same contract via
 * the runtime's ExternalInterface outward path (AVM1 confirmed).
 *
 * Host-side counterpart wiring lives in ../swfrecompSubstrate/index.js —
 * that module registers the panel/substrate and brings the panel forward
 * on swfrecomp:loadRegion.
 */

import { IframeClient } from '../iframe-base/iframeClient.js';

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[swfrecomp-bridge]', ...args);
}

// ────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────

const _w = /** @type {any} */ (window);   // __swfBridge lives here (set by the game page)
let _client = null;

// Active-region state
let _currentRegionId = null;
let _world = null;                          // From deserializeWorld in the substrate registry
let _isActive = false;                      // True when this substrate is the current region's

// AP location names we've already reported this region, so a repeated
// sendLocation (or a re-poll) doesn't double-dispatch.
const _reportedLocationNames = new Set();

// ────────────────────────────────────────────────────────────────
// __swfBridge access
// ────────────────────────────────────────────────────────────────

function _bridge() {
    return _w.__swfBridge ?? null;
}

/**
 * Resolve an in-game objective name to an AP *location name* using the
 * region payload's ap_locations map (flash_name -> AP location name).
 * Returns null if the name isn't mapped (e.g. a non-AP objective).
 *
 * Note: the frontend's stateManager is name-keyed — its user:locationCheck
 * handler reads `eventData.locationName` and calls checkLocation(name).
 * So ap_locations maps to AP location *names*, not numeric ids. (The
 * id-based form in the SWFRecomp-CC plan was for talking to a live AP
 * server over websocket; the substrate talks to the name-based
 * stateManager instead.)
 */
function _resolveLocationName(flashName) {
    const map = _world?.ap_locations;
    if (!map) return null;
    const name = map[flashName];
    return (typeof name === 'string' && name.length > 0) ? name : null;
}

/**
 * The game's cooperative outward call. Wired onto __swfBridge so the
 * recompiled game's ActionScript (via ExternalInterface) — or the
 * placeholder's manual button — can report an objective completion.
 */
function _onSendLocation(flashName) {
    if (!_isActive) {
        log('warn', `sendLocation('${flashName}') while inactive — ignored`);
        return;
    }
    const locationName = _resolveLocationName(flashName);
    if (locationName === null) {
        log('warn', `sendLocation('${flashName}') has no ap_locations mapping — ignored`);
        return;
    }
    if (_reportedLocationNames.has(locationName)) return;
    _reportedLocationNames.add(locationName);

    if (!_client) return;
    // stateManager's user:locationCheck handler reads `locationName`.
    _client.publishEventDispatcher('user:locationCheck', {
        locationName,
        regionName: _currentRegionId,
        originator: 'swfrecompSubstrate',
    }, { initialTarget: 'bottom' });
    log('debug', `objective '${flashName}' -> user:locationCheck (locationName=${locationName})`);
}

/**
 * Push received items into the game. Reads the checked/received state
 * from the host snapshot and hands the game its received-item ids via
 * __swfBridge.pollItems so the game can apply effects (id -> flash_name
 * -> effect). The game is responsible for idempotency / de-duping.
 */
function _pollItemsIntoGame() {
    const b = _bridge();
    if (!b || typeof b.pollItems !== 'function') return;
    const snapshot = _client?.getStateSnapshot?.() ?? null;
    // receivedItems shape is owned by stateManager's snapshot; pass it
    // through verbatim and let the game map ids via ap_items. Defensive:
    // tolerate absence.
    const received = snapshot?.receivedItems ?? snapshot?.items ?? [];
    try {
        b.pollItems(received);
    } catch (err) {
        log('error', 'pollItems threw:', err);
    }
}

// ────────────────────────────────────────────────────────────────
// Region loading
// ────────────────────────────────────────────────────────────────

function _handleLoadRegion(payload) {
    if (!payload || !payload.region_id) {
        log('warn', 'swfrecomp:loadRegion with no region_id', payload);
        return;
    }
    const regionId = payload.region_id;
    const world = payload.world ?? {};

    _currentRegionId = regionId;
    _world = world;
    _isActive = true;
    _reportedLocationNames.clear();

    const b = _bridge();
    if (!b || typeof b.configure !== 'function') {
        log('warn', '__swfBridge.configure missing; game not configured for region', regionId);
        return;
    }
    try {
        b.configure({
            gameId: world.gameId ?? null,
            params: world.params ?? {},
            ap_items: world.ap_items ?? {},
            ap_locations: world.ap_locations ?? {},
            regionId,
        });
    } catch (err) {
        log('error', 'configure threw:', err);
        return;
    }

    // Defensive: if static data isn't cached yet, kick off a request so
    // later lookups find it (mirrors the JtA bridge pattern).
    if (!_client?.getStaticData?.()) {
        _client?.requestStaticData?.();
    }
    // Apply whatever's already been received.
    _pollItemsIntoGame();
    log('debug', `loaded region ${regionId} (gameId=${world.gameId ?? '?'})`);
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function main() {
    // Step 1: complete the iframeAdapter handshake.
    _client = new IframeClient();
    const connected = await _client.connect();
    if (!connected) {
        log('error', 'IframeClient.connect() returned false');
        return;
    }

    // Step 2: expose the cooperative outward call on __swfBridge. The
    // game page may have created __swfBridge already (with configure /
    // pollItems); we add/override sendLocation to route into AP. If the
    // page hasn't created it yet, seed a minimal object — the page's own
    // configure/pollItems will be merged when it loads.
    if (!_w.__swfBridge) _w.__swfBridge = {};
    _w.__swfBridge.sendLocation = _onSendLocation;

    // Step 3: subscribe to host events.
    _client.subscribeEventBus('swfrecomp:loadRegion', _handleLoadRegion);

    // When AP state changes (item received elsewhere, etc.), re-poll so
    // the game applies any newly-received items.
    _client.subscribeEventBus('stateManager:snapshotUpdated', () => {
        if (_isActive) _pollItemsIntoGame();
    });

    // If we move away from this region, go inactive.
    _client.subscribeEventBus('gameState:regionChanged', (data) => {
        if (data?.newRegion && data.newRegion !== _currentRegionId) {
            _isActive = false;
        }
    });

    // Re-request static data whenever rules (re)load (mirrors JtA).
    _client.subscribeEventBus('stateManager:rulesLoaded', () => {
        _client?.requestStaticData?.();
    });

    // Step 4: announce ready.
    _client.notifyAppReady();
    log('info', 'connected to host; appReady sent; __swfBridge.sendLocation wired');
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
