/**
 * Bridge — runs inside the SWFRecomp game iframe. Injected by
 * flashSubstratePanel after the iframe's `load` event fires.
 *
 * Responsibilities (Mode 1 / v1):
 *   - Complete the iframeAdapter handshake (IframeClient).
 *   - On the loadRegion event: configure the in-iframe game from the
 *     region payload via the window-exposed `__swfBridge.configure`
 *     contract, then push any already-received items via pollItems.
 *   - Wire the game's cooperative outward calls: when the game calls
 *     __swfBridge.sendLocation(flashName), translate flashName -> AP
 *     location name via the region's ap_locations map and dispatch
 *     user:locationCheck up the dispatcher chain; when it calls
 *     __swfBridge.sendExit(portalId, side), resolve the exit from the
 *     region payload's exits and dispatch user:regionMove.
 *   - On stateManager state changes: re-poll received items into the
 *     game so newly-received items get applied.
 *   - Rule-gated portals/pickups: when the region payload carries
 *     `gate_rules` ({ portals: {id: rule}, pickups: {id: rule} } in
 *     Rule Builder JSON — authored gate terms the game's own physics
 *     can't realise), evaluate each rule against the live inventory
 *     and push per-goal BOOLEANS into the game via
 *     __swfBridge.setGateStates({ portals, pickups }) (true = open),
 *     after configure and on every state change — the same cadence as
 *     pollItems. The game stays Archipelago-naive: it only ever sees
 *     booleans, and renders locked goals visibly locked.
 *   - Playback bot (optional): when the iframe URL carries a
 *     `playbackControlEvent` query param, subscribe to that event and
 *     execute PlaybackController commands published by the host-side
 *     proxy (the landed textAdventureSubstrateWrapper pattern). walkTo
 *     targets arrive in AP vocabulary ({kind:'location'|'exit', name})
 *     and are translated to game-local goal ids (ap_locations inverted
 *     for pickups; exits → side → params.sidePortals for portals)
 *     before being handed to the game via the optional
 *     __swfBridge.botWalkTo contract method. A target that doesn't
 *     resolve yet (the bot's walkTo can outrun the region's loadRegion
 *     after a transition) is held pending and re-applied after
 *     configure. The game plays itself through its real physics — the
 *     bridge never simulates anything.
 *
 * The loadRegion event name is read from the iframe URL's
 * `loadRegionEvent` query param (set by the panel's iframeSrc), so
 * substrates that reuse this bridge with their own panel + registry
 * entry (e.g. bounceDemo's 'bounce:loadRegion') don't get configured by
 * the other substrate's region loads. Defaults to 'flash:loadRegion'.
 *
 * The `__swfBridge` contract is whatever the recompiled game page
 * exposes on its window. v1's placeholder page stubs it (configure /
 * pollItems no-ops + a manual "complete objective" button calling
 * sendLocation). The real recompiled page fulfils the same contract via
 * the runtime's ExternalInterface outward path (AVM1 confirmed).
 *
 * Host-side counterpart wiring lives in ../flashSubstrate/index.js —
 * that module registers the panel/substrate and brings the panel forward
 * on flash:loadRegion.
 */

import { IframeClient } from '../iframe-base/iframeClient.js';
import { evaluateRuleAgainstInventory } from '../shared/procgen/library.js';

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[flash-bridge]', ...args);
}

// ────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────

const _w = /** @type {any} */ (window);   // __swfBridge lives here (set by the game page)
let _client = null;

// Which host event delivers this iframe's region loads (see header).
const LOAD_REGION_EVENT =
    new URLSearchParams(window.location.search).get('loadRegionEvent')
    || 'flash:loadRegion';

// Which host event delivers playback-bot controller commands (see
// header). No param = no playback support (plain flash games).
const PLAYBACK_CONTROL_EVENT =
    new URLSearchParams(window.location.search).get('playbackControlEvent')
    || null;

// Active-region state
let _currentRegionId = null;
let _world = null;                          // From deserializeWorld in the substrate registry
let _isActive = false;                      // True when this substrate is the current region's

// AP location names we've already reported this region, so a repeated
// sendLocation (or a re-poll) doesn't double-dispatch.
const _reportedLocationNames = new Set();

// ────────────────────────────────────────────────────────────────
// Capabilities (integration axis — Option B, payload-carried)
// ────────────────────────────────────────────────────────────────
//
// A region's `world.flashCapabilities` declares HOW this game integrates
// — which bridge methods/styles it uses. It rides the flash:loadRegion
// payload (not the substrate registry), because only the in-iframe bridge
// consumes it. See flash-substrate-unification.md §"Capability axis".
//
// Vocabulary is an OPEN BAG, formalized incrementally as each style is
// implemented. Declared so far:
//   - locations: 'cooperative'   — the game reports objective completion
//                                   outward via __swfBridge.sendLocation
//                                   (the only style implemented in Mode 1).
//                                   Future: 'memory_poke' (host polls game
//                                   state via readState — plan step 5).
//   - items:     'pull'          — the bridge hands received items to the
//                                   game via __swfBridge.pollItems.
//                                   Future: 'push' (getItemQueue-style —
//                                   plan step 4).
//
// Defaults preserve the pre-capability behavior: a region with no
// flashCapabilities is treated as cooperative locations + pull items, so
// existing payloads keep working unchanged.
const CAP_DEFAULTS = Object.freeze({
    locations: 'cooperative',
    items: 'pull',
});

function _capabilities() {
    const c = _world?.flashCapabilities;
    if (!c || typeof c !== 'object') return CAP_DEFAULTS;
    return {
        locations: c.locations ?? CAP_DEFAULTS.locations,
        items: c.items ?? CAP_DEFAULTS.items,
    };
}

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
    if (_capabilities().locations !== 'cooperative') {
        // This region's game doesn't report locations cooperatively (e.g.
        // a future memory-poke game). An outward sendLocation here is
        // unexpected — ignore rather than dispatch a check the game model
        // doesn't own.
        log('warn', `sendLocation('${flashName}') but region locations='${_capabilities().locations}' (not cooperative) — ignored`);
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
        originator: 'flashSubstrate',
    }, { initialTarget: 'bottom' });
    log('debug', `objective '${flashName}' -> user:locationCheck (locationName=${locationName})`);
}

/**
 * The game's cooperative exit call — the region-move counterpart of
 * sendLocation. The game reports WHICH portal the player landed on and
 * the grid side it serves (it learns the side from params.sidePortals);
 * the region payload's exits carry side -> {exitName, targetRegion}, so
 * the side picks the exit and we dispatch user:regionMove the same way
 * the JtA bridge does. portalId is a fallback key (and log context) for
 * payloads whose exits are keyed by portal id rather than side.
 */
function _onSendExit(portalId, side) {
    if (!_isActive) {
        log('warn', `sendExit('${portalId}', side=${side}) while inactive — ignored`);
        return;
    }
    const exits = _world?.exits;
    // Exits arrive as the deserialized Map<exitName, exit> when the
    // payload structured-clones intact; tolerate the on-disk array too.
    const list = exits instanceof Map ? [...exits.values()]
        : (Array.isArray(exits) ? exits : []);
    const exit = (side ? list.find((e) => e?.side === side) : null)
        ?? list.find((e) => e?.exitName === portalId || e?.exit_id === portalId);
    if (!exit) {
        log('warn', `sendExit('${portalId}', side=${side}) matches no region exit — ignored`);
        return;
    }
    if (!_client) return;
    _client.publishEventDispatcher('user:regionMove', {
        sourceRegion: _currentRegionId,
        targetRegion: exit.targetRegion ?? null,
        exitName: exit.exitName ?? exit.exit_id ?? null,
    }, { initialTarget: 'bottom' });
    log('debug', `exit '${portalId}' (side=${side}) -> user:regionMove `
        + `(${_currentRegionId} -> ${exit.targetRegion ?? '?'})`);
}

/**
 * Push received items into the game. Reads the checked/received state
 * from the host snapshot and hands the game its received-item ids via
 * __swfBridge.pollItems so the game can apply effects (id -> flash_name
 * -> effect). The game is responsible for idempotency / de-duping.
 */
function _pollItemsIntoGame() {
    if (_capabilities().items !== 'pull') {
        // This region's game receives items by another style (e.g. a
        // future 'push' / getItemQueue model where the game pulls on its
        // own cadence). Don't push via pollItems.
        return;
    }
    const b = _bridge();
    if (!b || typeof b.pollItems !== 'function') return;
    const snapshot = _client?.getStateSnapshot?.() ?? null;
    // The snapshot relayed to iframes is stateManagerProxy's uiCache:
    // owned items live in `inventory` as a {itemName: count} object.
    // Hand the game the owned item NAMES; it maps names to effects via
    // ap_items / its own table. (No snapshot shape carries a
    // receivedItems array — an earlier draft of this function expected
    // one and consequently always polled an empty list.)
    const inv = snapshot?.inventory;
    const received = (inv && typeof inv === 'object')
        ? Object.entries(inv)
            .filter(([, count]) => Number(count) > 0)
            .map(([name]) => name)
        : [];
    try {
        b.pollItems(received);
    } catch (err) {
        log('error', 'pollItems threw:', err);
    }
}

/**
 * Evaluate the region's authored gate rules (payload `gate_rules`)
 * against the live inventory and push the resulting booleans into the
 * game via __swfBridge.setGateStates. True = open; goals without a
 * rule are open by default (the game treats absent ids as unlocked).
 * No-op when the region carries no gate_rules or the game page
 * doesn't implement setGateStates (e.g. plain flash games).
 */
function _pushGateStates() {
    const gateRules = _world?.gate_rules;
    if (!gateRules || typeof gateRules !== 'object') return;
    const b = _bridge();
    if (!b || typeof b.setGateStates !== 'function') return;
    // The snapshot's inventory is {itemName: count}; the evaluator
    // wants a Map for count-aware Has(item, n) rules.
    const inv = _client?.getStateSnapshot?.()?.inventory;
    const inventory = new Map(
        (inv && typeof inv === 'object') ? Object.entries(inv) : []);
    const evaluate = (rules) => Object.fromEntries(
        Object.entries(rules ?? {}).map(([id, rule]) =>
            [id, evaluateRuleAgainstInventory(rule, inventory)]));
    try {
        b.setGateStates({
            portals: evaluate(gateRules.portals),
            pickups: evaluate(gateRules.pickups),
        });
    } catch (err) {
        log('error', 'setGateStates threw:', err);
    }
}

// ────────────────────────────────────────────────────────────────
// Playback bot (host PlaybackProxy → game botWalkTo/botStop)
// ────────────────────────────────────────────────────────────────

// The bot's walkTo for a region can arrive BEFORE that region's
// loadRegion (both ride the same eventBus relay, published by
// different host modules during the same region transition). Held
// here and re-applied after configure; last write wins.
let _pendingWalkTo = null;

/**
 * Translate an AP-vocabulary walkTo target into a game-local goal.
 * Returns { kind: 'pickup' | 'portal', id } or null when the target
 * doesn't resolve in the active region (wrong region, or a tile
 * target — bounce has no tile semantics).
 */
function _translateWalkTo(target) {
    if (!target || !_world) return null;
    if (target.kind === 'location') {
        for (const [flashName, apName] of Object.entries(_world.ap_locations ?? {})) {
            if (apName === target.name) return { kind: 'pickup', id: flashName };
        }
        return null;
    }
    if (target.kind === 'exit') {
        const exits = _world.exits;
        const list = exits instanceof Map ? [...exits.values()]
            : (Array.isArray(exits) ? exits : []);
        // The bot publishes PathFinder's exit names — the AP-namespaced
        // `{regionId}__{exitName}` form from staticData. Sidecar exits
        // carry the bare exitName/exit_id, so match both shapes (the
        // same tolerance mazeRoomUI's resolver applies).
        const prefix = _currentRegionId ? `${_currentRegionId}__` : null;
        const exit = list.find((e) => e?.exitName === target.name
            || e?.exit_id === target.name
            || (prefix && (target.name === `${prefix}${e?.exitName}`
                || target.name === `${prefix}${e?.exit_id}`)));
        if (!exit) return null;
        const portalId = _world.params?.sidePortals?.[exit.side];
        return portalId ? { kind: 'portal', id: portalId } : null;
    }
    return null;
}

/** Resolve + hand the target to the game. False = keep it pending. */
function _applyWalkTo(target) {
    if (!_isActive) return false;
    const b = _bridge();
    if (!b || typeof b.botWalkTo !== 'function') return false;
    const goal = _translateWalkTo(target);
    if (!goal) return false;
    b.botWalkTo(goal);
    log('debug', `walkTo ${target.kind} '${target.name}' -> bot goal`, goal);
    return true;
}

function _handlePlaybackControl(payload) {
    const method = payload?.method;
    const args = Array.isArray(payload?.args) ? payload.args : [];
    const b = _bridge();
    switch (method) {
        case 'walkTo': {
            _pendingWalkTo = args[0] ?? null;
            if (_applyWalkTo(_pendingWalkTo)) _pendingWalkTo = null;
            return;
        }
        case 'stop':
            _pendingWalkTo = null;
            b?.botStop?.();
            return;
        case 'reset':
            _pendingWalkTo = null;
            b?.botStop?.();
            b?.reset?.();
            return;
        case 'play':
        case 'step':
        case 'instant':
            // The game's own 60Hz loop always runs; "engaged" simply
            // means the driver has a target. Re-try a pending one.
            if (_pendingWalkTo && _applyWalkTo(_pendingWalkTo)) _pendingWalkTo = null;
            return;
        case 'setRate':
            return; // no scriptable clock to retune
        default:
            log('warn', 'playback control: unknown method', method);
    }
}

// ────────────────────────────────────────────────────────────────
// Region loading
// ────────────────────────────────────────────────────────────────

function _handleLoadRegion(payload) {
    if (!payload || !payload.region_id) {
        log('warn', `${LOAD_REGION_EVENT} with no region_id`, payload);
        return;
    }
    const regionId = payload.region_id;
    const world = payload.world ?? {};

    _currentRegionId = regionId;
    _world = world;
    _isActive = true;

    // Locations of THIS region the host already has checked (region
    // revisits): re-seed the dedupe set with their AP names so a
    // re-fired objective never double-dispatches, and hand the game
    // their in-game ids so it can mark them collected up front instead
    // of re-offering them.
    _reportedLocationNames.clear();
    const checkedNames = new Set(
        _client?.getStateSnapshot?.()?.checkedLocations ?? []);
    const checkedFlashNames = [];
    for (const [flashName, apName] of Object.entries(world.ap_locations ?? {})) {
        if (checkedNames.has(apName)) {
            _reportedLocationNames.add(apName);
            checkedFlashNames.push(flashName);
        }
    }

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
            flashCapabilities: _capabilities(),
            regionId,
            checkedLocations: checkedFlashNames,
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
    // Apply whatever's already been received, and the current lock
    // states for any rule-gated portals/pickups.
    _pollItemsIntoGame();
    _pushGateStates();
    // A bot walkTo that outran this loadRegion resolves now.
    if (_pendingWalkTo && _applyWalkTo(_pendingWalkTo)) _pendingWalkTo = null;
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

    // Step 2: expose the cooperative outward calls on __swfBridge. The
    // game page may have created __swfBridge already (with configure /
    // pollItems); we add/override sendLocation + sendExit to route into
    // AP. If the page hasn't created it yet, seed a minimal object — the
    // page's own configure/pollItems will be merged when it loads.
    if (!_w.__swfBridge) _w.__swfBridge = {};
    _w.__swfBridge.sendLocation = _onSendLocation;
    _w.__swfBridge.sendExit = _onSendExit;

    // Step 3: subscribe to host events.
    _client.subscribeEventBus(LOAD_REGION_EVENT, _handleLoadRegion);

    // Playback-bot control channel (only when the embedding panel
    // declared one via the iframe URL — see header).
    if (PLAYBACK_CONTROL_EVENT) {
        _client.subscribeEventBus(PLAYBACK_CONTROL_EVENT, _handlePlaybackControl);
    }

    // When AP state changes (item received elsewhere, etc.), re-poll so
    // the game applies any newly-received items, and re-evaluate the
    // authored gate rules (a new key may open a locked portal/pickup).
    _client.subscribeEventBus('stateManager:snapshotUpdated', () => {
        if (_isActive) {
            _pollItemsIntoGame();
            _pushGateStates();
        }
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
    log('info', `connected to host; appReady sent; __swfBridge.sendLocation/sendExit `
        + `wired; loadRegion event: ${LOAD_REGION_EVENT}`);
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
