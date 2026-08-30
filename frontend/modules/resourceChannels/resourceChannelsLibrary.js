/**
 * resourceChannels library — the shared implementation of the loop-mode
 * resource-channel idiom that the substrate mana legs (textAdventure,
 * maze, jta) each re-derived bespokely: XP-adjusted costing, charge →
 * 1:1 region XP, and the out-of-mana ⇒ loop-reset-teleport flow. Plus
 * the cross-substrate item-grant bus (S8: pure notification — the host
 * validates against the substrate registry's sharing declaration and
 * publishes; the owning substrate deposits into its OWN inventory).
 *
 * Design (cross-game-consumable-pool-plan.md, D1/D6/D8/S8):
 *  - Substrates DECLARE participation via the registry entry's
 *    `sharing` field (see shared/procgen/substrateRegistry.js); this
 *    library provides the shared helpers and validates ids against
 *    those declarations. Id-keyed throughout — no substrate names.
 *  - Cost DERIVATION stays substrate-side (per-tile, per-location,
 *    bridge-reported); the helpers take final amounts.
 *  - In-process callers (trusted host code) get a warning on an
 *    undeclared id but proceed; the EVENT router (see index.js), which
 *    is the contract surface for iframe bridges, rejects undeclared
 *    ids outright.
 *
 * The library is deliberately stateless: gameState is resolved through
 * its singleton, the costDataManager through centralRegistry on every
 * call (cheap map lookups — this also removes the three per-leg cached
 * copies and their invalidation-event subscriptions), and dispatchers
 * are caller-provided so each leg keeps publishing through its own.
 */

import { centralRegistry } from '../../app/core/centralRegistry.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { applyRegionXpCostEffect } from '../loops/xpFormulas.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

// Injected by index.js initialize(); used only by grantItem (the one
// helper that publishes on the eventBus itself).
let _eventBus = null;

// Warn-once bookkeeping so a busy leg with a missing declaration
// doesn't flood the console on every tile step.
const _warnedManaIds = new Set();

export const ITEM_GRANTED_EVENT = 'crossSubstrate:itemGranted';

export function initResourceChannelsLibrary({ eventBus }) {
    _eventBus = eventBus ?? null;
}

// Test-only: reset injected state + warn-once sets between cases.
export function _testOnly_resetResourceChannelsLibrary() {
    _eventBus = null;
    _warnedManaIds.clear();
}

function _gs() {
    try {
        return getGameStateSingleton?.() ?? null;
    } catch {
        return null; // singleton not initialized (standalone / early boot)
    }
}

function _getCostDataManager() {
    try {
        const fn = centralRegistry.getPublicFunction?.('loops', 'getCostDataManager');
        return fn?.() ?? null;
    } catch {
        return null;
    }
}

/** True when `substrateId` is registered with a sharing.mana declaration. */
export function isManaDeclarer(substrateId) {
    return substrateRegistry.get(substrateId)?.sharing?.mana !== undefined;
}

/** True when `substrateId` is registered with a sharing.items declaration. */
export function isItemsDeclarer(substrateId) {
    return substrateRegistry.get(substrateId)?.sharing?.items !== undefined;
}

/**
 * The declared shareable item types for a substrate, resolving the
 * static-list vs provider forms. null when the substrate declares no
 * items category (distinct from an empty list).
 */
export function getShareableItemTypes(substrateId) {
    const items = substrateRegistry.get(substrateId)?.sharing?.items;
    if (!items) return null;
    if (Array.isArray(items.types)) return items.types;
    try {
        const types = items.getTypes?.();
        return Array.isArray(types) ? types : [];
    } catch {
        return [];
    }
}

function _warnUndeclaredMana(substrateId, caller) {
    if (_warnedManaIds.has(substrateId)) return;
    _warnedManaIds.add(substrateId);
    console.warn(
        `[resourceChannels] ${caller}: substrate '${substrateId}' has no `
        + 'sharing.mana declaration in its registry entry (proceeding — '
        + 'declare it to silence this warning)',
    );
}

/**
 * XP-adjusted cost for a region: applies the region's XP level and the
 * cost data's per-region XP effect to a base cost. Matches the
 * computation each mana leg performed inline. Returns the base cost
 * unchanged when there is no region / gameState.
 */
export function xpAdjustedCost(baseCost, regionId) {
    if (!regionId) return baseCost;
    const gs = _gs();
    if (!gs) return baseCost;
    const xpData = gs.getRegionXP?.(regionId);
    const effect = _getCostDataManager()?.getRegionXpEffect?.(regionId);
    return applyRegionXpCostEffect(baseCost, xpData?.level ?? 0, effect);
}

/**
 * Charge `amount` mana to the shared pool on behalf of `substrateId`,
 * awarding 1 XP : 1 mana to `regionId` when given (the loops
 * _processFrame ratio all legs match). Depletion is REPORTED, not
 * acted on — the caller runs its own pre-reset cleanup and then calls
 * fireLoopResetTeleport, preserving each leg's exact ordering.
 *
 * @returns {{ charged: boolean, depleted: boolean }}
 */
export function chargeMana({ substrateId, amount, regionId = null }) {
    if (!isManaDeclarer(substrateId)) _warnUndeclaredMana(substrateId, 'chargeMana');
    const gs = _gs();
    if (!gs) return { charged: false, depleted: false };
    gs.deductMana(amount);
    if (regionId) gs.addRegionXP?.(regionId, amount);
    return { charged: true, depleted: (gs.getCurrentMana?.() ?? 0) <= 0 };
}

/**
 * Mirror a substrate-side resource GAIN into the shared pool.
 * Unclamped — maxMana is the loop's STARTING mana, not a ceiling.
 */
export function gainMana({ substrateId, amount }) {
    if (!isManaDeclarer(substrateId)) _warnUndeclaredMana(substrateId, 'gainMana');
    const gs = _gs();
    if (!gs) return { gained: false };
    gs.gainMana(amount);
    return { gained: true };
}

/**
 * Report a substrate's native starting-resource bonus into the shared
 * pool's per-substrate accumulator (folded into maxMana by gameState).
 */
export function setMaxManaBonus(substrateId, bonus) {
    if (!isManaDeclarer(substrateId)) _warnUndeclaredMana(substrateId, 'setMaxManaBonus');
    const gs = _gs();
    if (!gs) return;
    gs.setSubstrateMaxManaBonus(substrateId, bonus);
}

/**
 * Resolve the loop-reset teleport target: procgenPlayer's resolved
 * start region when available, optionally falling back to the first
 * declared start region (all legs but the textAdventure wrapper use
 * the fallback — it passes fallbackToDeclaredStart:false for parity).
 */
export function resolveStartRegion({ fallbackToDeclaredStart = true } = {}) {
    try {
        const fn = centralRegistry.getPublicFunction?.('procgenPlayer', 'getResolvedStartRegion');
        const resolved = fn?.();
        if (resolved) return resolved;
    } catch {
        // procgenPlayer not loaded (standalone flows); fall through.
    }
    if (!fallbackToDeclaredStart) return null;
    return _gs()?.startRegions?.[0] ?? null;
}

/**
 * The shared out-of-mana flow: refill via gameState.triggerLoopReset
 * (always — the reset is not conditional on a resolvable teleport
 * target) and best-effort teleport to the start region by dispatching
 * user:regionMove with fromReset:true / updatePath:false through the
 * CALLER's dispatcher, so each leg keeps its existing propagation
 * (pass dispatchOpts: { initialTarget: 'bottom' } where the leg does
 * so today).
 *
 * @returns {string|null} the teleport target, or null when none
 *   resolved (reset still fired).
 */
export function fireLoopResetTeleport({
    sourceRegion,
    dispatcher,
    dispatchOpts = undefined,
    fallbackToDeclaredStart = true,
} = {}) {
    const gs = _gs();
    if (!gs) return null;
    const startRegion = resolveStartRegion({ fallbackToDeclaredStart });
    gs.triggerLoopReset();
    if (startRegion && dispatcher?.publish) {
        const payload = {
            sourceRegion,
            targetRegion: startRegion,
            fromReset: true,
            updatePath: false,
        };
        if (dispatchOpts) dispatcher.publish('user:regionMove', payload, dispatchOpts);
        else dispatcher.publish('user:regionMove', payload);
    }
    return startRegion;
}

/**
 * Cross-substrate item grant (the S8 notification bus). Validates the
 * grant against the registry's sharing declarations and publishes
 * crossSubstrate:itemGranted; the OWNING substrate (`to`) subscribes,
 * filters on its own id, and deposits into its own inventory — the
 * host keeps no store. Item identity per D2: the namespaced id is
 * `${to}/${itemType}`; the event carries the parts.
 *
 * @param {Object} grant
 * @param {string} grant.to - owning substrate id (must declare sharing.items)
 * @param {string} grant.from - granting substrate id, or 'host' for
 *   host-side sources (award schedules, debug harness)
 * @param {string} grant.itemType - owner-scoped item type
 * @param {number} [grant.count=1] - positive integer
 * @returns {boolean} true when validated + published
 */
export function grantItem({ to, from, itemType, count = 1 } = {}) {
    const reject = (why) => {
        console.warn(`[resourceChannels] grantItem rejected: ${why}`, { to, from, itemType, count });
        return false;
    };
    if (typeof to !== 'string' || !to) return reject('missing to');
    if (typeof from !== 'string' || !from) return reject('missing from');
    if (typeof itemType !== 'string' || !itemType) return reject('missing itemType');
    if (!Number.isInteger(count) || count <= 0) return reject('count must be a positive integer');
    if (!substrateRegistry.has(to)) return reject(`unknown substrate '${to}'`);
    if (from !== 'host' && !substrateRegistry.has(from)) return reject(`unknown substrate '${from}'`);
    const types = getShareableItemTypes(to);
    if (types === null) return reject(`substrate '${to}' declares no sharing.items`);
    if (!types.includes(itemType)) {
        return reject(`'${itemType}' is not a shareable item type of '${to}'`);
    }
    if (!_eventBus?.publish) return reject('resourceChannels not initialized (no eventBus)');
    _eventBus.publish(ITEM_GRANTED_EVENT, { to, from, itemType, count });
    return true;
}
