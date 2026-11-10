/**
 * Wrapper-side mana display + deduction. Ported from the original
 * textAdventureSubstrate's UI-layer mana logic, but extracted into a
 * standalone module here because the wrapper's panel lives behind an
 * iframe boundary — display info has to be pushed to the engine via
 * an event, and deduction has to run on the host where gameState +
 * costDataManager live.
 *
 * Two responsibilities:
 *   1. Display: track currentMana / maxMana and publish a header-info
 *      event the bridge subscribes to. Only emits when the current
 *      region has manaEnabled (otherwise the readout would be
 *      meaningless for non-mana substrates).
 *   2. Deduction: on detected user:locationCheck / user:regionMove
 *      against the wrapper's current region, deduct the cost from
 *      gameState. Gated against loop mode — when loop mode is active,
 *      loops' _processFrame handles deduction and we'd otherwise
 *      double-bill.
 *
 * ⛓ WHICH REGIONS THE DEDUCTION OWNS. This module is wired whatever the
 * world contains, so `manaEnabled` alone says nothing about who bills a
 * region. Two kinds of region are never charged here (`notChargedHere`):
 *   - another substrate that declares `sharing.mana` bills the pool itself
 *     (maze per tile, jta and omsi by mirroring their native resource);
 *   - a substrate that loop mode prices by its own play, a SUMMARY recording
 *     (`loopSupport.summaryRecording`) or its reported game clock
 *     (`loopSupport.playClock`), costs nothing with loop mode off: the flat
 *     location and move defaults here were never its price (Cloudberry,
 *     Noiz2sa, Bounce, flash_seedling, flash_seedling_gen; ⚖ Robert
 *     2026-11-09, "Remove the charge" and "Free too, as a follow-up").
 * Any other substrate stays on this leg. The display half is unaffected.
 *
 * Depletion resets the loop unless `gameState.noManaDepletionReset` is set:
 * `chargeMana` then reports no depletion and the pool runs negative. A move
 * into a JtA room on a negative pool can still loop-reset, from JtA's own run
 * end, which is exempt from the flag (⚖ Robert 2026-11-09; see chargeMana).
 */

import { centralRegistry } from '../../app/core/centralRegistry.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import {
    xpAdjustedCost,
    chargeMana,
    fireLoopResetTeleport,
    isManaDeclarer,
} from '../resourceChannels/resourceChannelsLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { captureShapeOf, CAPTURE_SHAPES } from '../procgenCore/substratePredicates.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';

// Registry id shared with the in-process textAdventureSubstrate (both
// register the same entry id, guarded; the sharing.mana declaration
// rides whichever wins).
const SUBSTRATE_ID = 'text_adventure';

const HEADER_INFO_EVENT = 'textAdventureSubstrateWrapper:headerInfo';

const DEFAULT_LOCATION_COST = 10;
const DEFAULT_REGION_MOVE_COST = 50;

let _eventBus = null;
let _dispatcher = null;
let _isLoopModeActive = false;
let _currentRegionId = null;
let _currentRegionHasMana = false;
let _previousChecked = new Set();
let _costDataManager = null;

export function getHeaderInfoEvent() { return HEADER_INFO_EVENT; }

export function initManaWiring({ eventBus, dispatcher }) {
    _eventBus = eventBus;
    _dispatcher = dispatcher;
    if (!eventBus?.subscribe) return () => {};

    // Late-mount backfill: gameState may already have a current region
    // and loops may already be active by the time we subscribe (e.g.
    // wrapper module loads after a save restores state). Read the
    // current values directly so we don't wait for the next event.
    backfillFromCurrentState();

    const unsubs = [];

    unsubs.push(eventBus.subscribe('gameState:loopModeChanged', (data) => {
        _isLoopModeActive = !!data?.active;
    }));

    // costDataManager loaded/cleared invalidates the lazy cache and
    // refreshes the readout so the mana line appears as soon as data
    // is available.
    const onCostDataChange = () => {
        _costDataManager = null;
        publishHeaderInfo();
    };
    unsubs.push(eventBus.subscribe('costDataManager:loaded', onCostDataChange));
    unsubs.push(eventBus.subscribe('costDataManager:cleared', onCostDataChange));

    unsubs.push(eventBus.subscribe('gameState:manaChanged', publishHeaderInfo));

    unsubs.push(eventBus.subscribe('gameState:regionChanged', handleRegionChanged));
    unsubs.push(eventBus.subscribe('stateManager:snapshotUpdated', handleSnapshotUpdated));

    return () => {
        for (const u of unsubs) { try { u?.(); } catch { /* ignore */ } }
    };
}

/**
 * Snapshot-update handler. Detects newly-checked locations against
 * the previous snapshot and deducts mana for each one, if the current
 * region has manaEnabled and loop mode is inactive.
 */
function handleSnapshotUpdated(data) {
    const snapshot = data?.snapshot;
    const checked = checkedLocationsFromSnapshot(snapshot);

    if (_shouldDeductMana()) {
        const newly = [];
        for (const name of checked) {
            if (!_previousChecked.has(name)) newly.push(name);
        }
        if (newly.length > 0) deductLocationCheckMana(newly);
    }
    _previousChecked = checked;
    publishHeaderInfo();
}

/**
 * Region-change handler. Refreshes the current-region manaEnabled
 * cache, deducts for moving OUT of the previous region (the cost is
 * charged at depart-time, matching the original substrate's
 * behavior), and re-publishes the header. The reset trigger
 * dispatches a region-move with fromReset:true that we skip here so
 * the teleport-to-start transition doesn't charge an extra move.
 */
function handleRegionChanged(data) {
    const oldRegion = data?.oldRegion ?? null;
    const newRegion = data?.newRegion ?? null;
    const fromReset = !!data?.fromReset;

    // Charge the OLD region's move cost if we were on a manaEnabled
    // region and loop mode is inactive. Resolve manaEnabled for the
    // old region (the cached _currentRegionHasMana applied to it,
    // since it was the current region at the time the event fired).
    if (!fromReset && oldRegion && _currentRegionHasMana && !_isLoopModeActive
        && !notChargedHere(oldRegion)) {
        deductRegionMoveMana(oldRegion);
    }

    _currentRegionId = newRegion;
    _currentRegionHasMana = !!resolveRegionInfo(newRegion)?.manaEnabled;
    publishHeaderInfo();
}

function _shouldDeductMana() {
    return _currentRegionHasMana && !_isLoopModeActive
        && !notChargedHere(_currentRegionId);
}

/**
 * True when a charge from here would be wrong: the region's substrate bills
 * the shared pool itself, or loop mode prices its regions by its own play (see
 * the header). Read from the registry at charge time: this module can
 * initialize before the region's substrate has registered.
 */
function notChargedHere(regionName) {
    const substrate = resolveRegionInfo(regionName)?.substrate;
    if (!substrate || substrate === SUBSTRATE_ID) return false;
    return isManaDeclarer(substrate) || pricedByItsOwnPlay(substrate);
}

function pricedByItsOwnPlay(substrateId) {
    const entry = substrateRegistry.get(substrateId);
    return !!entry && (entry.loopSupport?.playClock === true
        || captureShapeOf(entry) === CAPTURE_SHAPES.SUMMARY);
}

function resolveRegionInfo(regionName) {
    if (!regionName) return null;
    try {
        const fn = centralRegistry.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
        return fn?.(regionName) ?? null;
    } catch {
        return null;
    }
}

function getCostDataManager() {
    if (_costDataManager) return _costDataManager;
    try {
        const fn = centralRegistry.getPublicFunction?.('loops', 'getCostDataManager');
        _costDataManager = fn?.() ?? null;
    } catch {
        _costDataManager = null;
    }
    return _costDataManager;
}

function getLocationCost(name) {
    const cdm = getCostDataManager();
    if (cdm?.isLoaded?.() && typeof cdm.getLocationCost === 'function') {
        const cost = cdm.getLocationCost(name);
        if (typeof cost === 'number') return cost;
    }
    return DEFAULT_LOCATION_COST;
}

function getRegionMoveCost(name) {
    const cdm = getCostDataManager();
    if (cdm?.isLoaded?.() && typeof cdm.getRegionCost === 'function') {
        const cost = cdm.getRegionCost(name);
        if (typeof cost === 'number') return cost;
    }
    return DEFAULT_REGION_MOVE_COST;
}

function deductLocationCheckMana(names) {
    const gs = getGameStateSingleton?.();
    if (!gs) return;
    for (const name of names) {
        const cost = xpAdjustedCost(getLocationCost(name), _currentRegionId);
        const { depleted } = chargeMana({
            substrateId: SUBSTRATE_ID,
            amount: cost,
            regionId: _currentRegionId,
        });
        if (depleted) {
            fireLoopReset();
            return;
        }
    }
}

function deductRegionMoveMana(regionName) {
    const gs = getGameStateSingleton?.();
    if (!gs) return;
    const cost = xpAdjustedCost(getRegionMoveCost(regionName), regionName);
    const { depleted } = chargeMana({
        substrateId: SUBSTRATE_ID,
        amount: cost,
        regionId: regionName,
    });
    if (depleted) fireLoopReset();
}

function fireLoopReset() {
    // No declared-start fallback here: this leg historically resolves
    // the teleport target via procgenPlayer only, and leaves the move
    // undispatched otherwise (the reset itself still fires).
    fireLoopResetTeleport({
        sourceRegion: _currentRegionId,
        dispatcher: _dispatcher,
        fallbackToDeclaredStart: false,
    });
}

function publishHeaderInfo() {
    if (!_eventBus?.publish) return;
    const gs = getGameStateSingleton?.();
    if (!gs || !_currentRegionHasMana) {
        _eventBus.publish(HEADER_INFO_EVENT, { text: null });
        return;
    }
    const cur = gs.getCurrentMana?.() ?? 0;
    const max = gs.getMaxMana?.() ?? 0;
    _eventBus.publish(HEADER_INFO_EVENT, {
        text: `mana: ${cur.toFixed(1)} / ${max.toFixed(1)}`,
    });
}

function checkedLocationsFromSnapshot(snapshot) {
    const v = snapshot?.checkedLocations;
    if (v instanceof Set) return v;
    if (Array.isArray(v)) return new Set(v);
    return new Set();
}

/**
 * Pull whatever state already exists from gameState / loops at init
 * time, so events that fired before we subscribed don't leave us
 * with a null current region or a stale loop-mode flag.
 */
function backfillFromCurrentState() {
    const gs = getGameStateSingleton?.();
    if (gs?.getCurrentRegion) {
        _currentRegionId = gs.getCurrentRegion() ?? null;
        _currentRegionHasMana = !!resolveRegionInfo(_currentRegionId)?.manaEnabled;
    }
    // Loop-mode flag lives on gameState; read it straight off the singleton
    // (no loops-module coupling). Defaults false before gameState exists.
    _isLoopModeActive = !!gs?.isLoopModeActive;
    // Seed previousChecked from the current stateManager snapshot so
    // the first snapshotUpdated doesn't treat already-checked
    // locations as "newly" checked and double-charge.
    try {
        const snap = stateManagerProxySingleton?.getStateSnapshot?.();
        _previousChecked = checkedLocationsFromSnapshot(snap);
    } catch {
        // Stale or absent proxy; leave default empty set.
    }
}
