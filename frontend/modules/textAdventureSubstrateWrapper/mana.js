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
 */

import { centralRegistry } from '../../app/core/centralRegistry.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { applyRegionXpCostEffect } from '../loops/xpFormulas.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';

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
    if (!fromReset && oldRegion && _currentRegionHasMana && !_isLoopModeActive) {
        deductRegionMoveMana(oldRegion);
    }

    _currentRegionId = newRegion;
    _currentRegionHasMana = !!resolveRegionInfo(newRegion)?.manaEnabled;
    publishHeaderInfo();
}

function _shouldDeductMana() {
    return _currentRegionHasMana && !_isLoopModeActive;
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
    const cdm = getCostDataManager();
    for (const name of names) {
        const baseCost = getLocationCost(name);
        const xpData = _currentRegionId ? gs.getRegionXP?.(_currentRegionId) : null;
        const effect = _currentRegionId ? cdm?.getRegionXpEffect?.(_currentRegionId) : undefined;
        const cost = applyRegionXpCostEffect(baseCost, xpData?.level ?? 0, effect);
        gs.deductMana(cost);
        if (_currentRegionId) gs.addRegionXP?.(_currentRegionId, cost);
        if (gs.getCurrentMana?.() <= 0) {
            fireLoopReset();
            return;
        }
    }
}

function deductRegionMoveMana(regionName) {
    const gs = getGameStateSingleton?.();
    if (!gs) return;
    const cdm = getCostDataManager();
    const baseCost = getRegionMoveCost(regionName);
    const xpData = gs.getRegionXP?.(regionName);
    const effect = cdm?.getRegionXpEffect?.(regionName);
    const cost = applyRegionXpCostEffect(baseCost, xpData?.level ?? 0, effect);
    gs.deductMana(cost);
    gs.addRegionXP?.(regionName, cost);
    if (gs.getCurrentMana?.() <= 0) fireLoopReset();
}

function fireLoopReset() {
    const gs = getGameStateSingleton?.();
    if (!gs) return;
    const sourceRegion = _currentRegionId;
    gs.triggerLoopReset?.();
    // Resolve the start region via procgenPlayer if available; fall
    // back to leaving the move undispatched if we can't determine one.
    let startRegion = null;
    try {
        const fn = centralRegistry.getPublicFunction?.('procgenPlayer', 'getResolvedStartRegion');
        startRegion = fn?.() ?? null;
    } catch {
        startRegion = null;
    }
    if (startRegion && _dispatcher?.publish) {
        _dispatcher.publish('user:regionMove', {
            sourceRegion,
            targetRegion: startRegion,
            fromReset: true,
            updatePath: false,
        });
    }
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
