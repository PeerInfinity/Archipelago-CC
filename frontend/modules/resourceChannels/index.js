/**
 * resourceChannels — panel-less host module owning the generic
 * cross-substrate resource-channel machinery (layer R of the
 * cross-game consumable-pool plan; procgen-owned per ruling D1):
 *
 *  - Initializes the shared helper library (resourceChannelsLibrary.js)
 *    that the in-process mana legs call directly.
 *  - Hosts the CHANNEL EVENT ROUTER: the generic, id-keyed event
 *    vocabulary iframe-substrate bridges use instead of bespoke
 *    per-substrate events (replacing the jta:bridge* pattern):
 *      substrate:resourceDelta { substrateId, resource:'mana', amount }
 *        signed; negative drains the pool (depletion ⇒ loop reset +
 *        teleport), positive mirrors gains (unclamped).
 *      substrate:resourceBonus { substrateId, resource:'mana', bonus }
 *        the substrate's native starting-resource bonus, folded into
 *        maxMana via the per-substrate accumulator.
 *      substrate:resourceReset { substrateId, resource:'mana', hostResetCount }
 *        game-initiated reset request; answered with a loop reset
 *        UNLESS one already fired since the bridge last synced its
 *        reset count (the pool-exhaustion race guard).
 *    The router is the sharing CONTRACT surface: events from substrate
 *    ids without a matching registry sharing declaration are rejected
 *    (warn + drop), so participation is always declared, never implied.
 *  - Publishes the crossSubstrate:itemGranted notification bus (S8)
 *    via the library's validating grantItem helper; exposed as a
 *    public function as the debug harness until P1 wires production
 *    consumers.
 */

import { getGameStateSingleton } from '../gameState/singleton.js';
import {
    initResourceChannelsLibrary,
    isManaDeclarer,
    chargeMana,
    gainMana,
    setMaxManaBonus,
    fireLoopResetTeleport,
    grantItem,
    getShareableItemTypes,
    ITEM_GRANTED_EVENT,
} from './resourceChannelsLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

export const RESOURCE_DELTA_EVENT = 'substrate:resourceDelta';
export const RESOURCE_BONUS_EVENT = 'substrate:resourceBonus';
export const RESOURCE_RESET_EVENT = 'substrate:resourceReset';
// Substrate-initiated item grants (P2 outbound leg): an iframe bridge
// publishes this when its game's award executor routes a FOREIGN scheduled
// award (Fork 1.13 item_schedule) — the router forwards to the validating
// library grantItem (declared substrates/types; invalid grants warn+drop).
export const SUBSTRATE_ITEM_GRANT_EVENT = 'substrate:itemGrant';

export const moduleInfo = {
    name: 'resourceChannels',
    description:
        'Generic cross-substrate resource channels: the shared mana '
        + 'charge/XP/reset helper, the id-keyed channel event router for '
        + 'iframe substrate bridges, and the cross-substrate item-grant '
        + 'notification bus.',
    requires: ['gameState'],
};

const moduleId = 'resourceChannels';

let _dispatcher = null;

export function register(registrationApi) {
    // Dispatched when a channel drain depletes the pool (or a bridge
    // requests a reset) — the loop-reset teleport, same sender shape
    // the substrate wrappers use.
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    registrationApi.registerEventBusSubscriberIntent(RESOURCE_DELTA_EVENT);
    registrationApi.registerEventBusSubscriberIntent(RESOURCE_BONUS_EVENT);
    registrationApi.registerEventBusSubscriberIntent(RESOURCE_RESET_EVENT);
    registrationApi.registerEventBusPublisher(ITEM_GRANTED_EVENT);

    // Debug harness (and the P1 grant entry point): fire a validated
    // cross-substrate grant / inspect the registry's sharing
    // declarations from the console or test controller.
    registrationApi.registerPublicFunction(moduleId, 'grantItem', (grant) => grantItem(grant));
    registrationApi.registerPublicFunction(moduleId, 'getSharingDeclarations', () => {
        const out = {};
        for (const entry of substrateRegistry.getAll()) {
            if (!entry.sharing) continue;
            out[entry.id] = {
                mana: entry.sharing.mana !== undefined
                    ? { ...entry.sharing.mana }
                    : undefined,
                items: entry.sharing.items !== undefined
                    ? { types: getShareableItemTypes(entry.id) }
                    : undefined,
            };
        }
        return out;
    });
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    _dispatcher = initializationApi.getDispatcher?.() ?? null;
    initResourceChannelsLibrary({ eventBus });
    if (!eventBus) return;

    eventBus.subscribe(RESOURCE_DELTA_EVENT, (data) => handleResourceDelta(data));
    eventBus.subscribe(RESOURCE_BONUS_EVENT, (data) => handleResourceBonus(data));
    eventBus.subscribe(RESOURCE_RESET_EVENT, (data) => handleResourceReset(data));
    eventBus.subscribe(SUBSTRATE_ITEM_GRANT_EVENT, (data) => {
        grantItem({ to: data?.to, from: data?.from, itemType: data?.itemType, count: data?.count });
    });
}

/**
 * Contract check shared by all three handlers: the event must name a
 * registered substrate that declares the addressed channel category.
 * v1 has a single channel — 'mana'.
 */
function _validChannelEvent(data, eventName) {
    const substrateId = data?.substrateId;
    const resource = data?.resource;
    if (typeof substrateId !== 'string' || !substrateId) {
        console.warn(`[resourceChannels] ${eventName}: missing substrateId`, data);
        return false;
    }
    if (resource !== 'mana') {
        console.warn(
            `[resourceChannels] ${eventName}: unknown resource '${resource}' `
            + `from '${substrateId}' (v1 channels: mana)`,
        );
        return false;
    }
    if (!isManaDeclarer(substrateId)) {
        console.warn(
            `[resourceChannels] ${eventName}: substrate '${substrateId}' has no `
            + 'sharing.mana declaration — event dropped',
        );
        return false;
    }
    return true;
}

function _gs() {
    try {
        return getGameStateSingleton?.() ?? null;
    } catch {
        return null;
    }
}

function handleResourceDelta(data) {
    if (!_validChannelEvent(data, RESOURCE_DELTA_EVENT)) return;
    const amount = Number(data?.amount) || 0;
    if (amount === 0) return;
    const substrateId = data.substrateId;
    if (amount > 0) {
        gainMana({ substrateId, amount });
        return;
    }
    const { depleted } = chargeMana({ substrateId, amount: -amount });
    if (depleted) _fireReset();
}

function handleResourceBonus(data) {
    if (!_validChannelEvent(data, RESOURCE_BONUS_EVENT)) return;
    const bonus = Number(data?.bonus);
    if (!Number.isFinite(bonus)) return;
    setMaxManaBonus(data.substrateId, Math.max(0, bonus));
}

function handleResourceReset(data) {
    if (!_validChannelEvent(data, RESOURCE_RESET_EVENT)) return;
    const gs = _gs();
    if (!gs) return;
    // Pool-exhaustion race guard: if a loop reset already fired since
    // the bridge last synced its reset count (energy and pool hitting
    // 0 together — the delta handler reset first), this game-side
    // reset is already covered.
    const bridgeCount = Number(data?.hostResetCount);
    if (Number.isFinite(bridgeCount) && gs.getLoopResetCount() > bridgeCount) {
        return;
    }
    _fireReset();
}

function _fireReset() {
    const gs = _gs();
    if (!gs) return;
    const target = fireLoopResetTeleport({
        sourceRegion: gs.getCurrentRegion?.() ?? null,
        dispatcher: _dispatcher,
        dispatchOpts: { initialTarget: 'bottom' },
    });
    if (!target) {
        console.warn('[resourceChannels] no resolvable start region; loop reset teleport skipped');
    }
}
