/**
 * procgenCore/substrateOrder — **THE USER'S SUBSTRATE ORDER, FOR EVERY LIST
 * THAT SHOWS SUBSTRATES** (REGISTRATION ORDER RO2; ⚖ user 2026-09-29: *"Sort
 * by id by default, but I want to have a tool somewhere for the user to choose
 * a custom order."*).
 *
 * `substrateRegistry.getAll()` is in id order (RO1) and STAYS so: logic, tests
 * and the generated docs read that. A list a PERSON reads — the pipeline's
 * "Substrates (click to add)" and its per-region override, the hub's
 * Initialise select, the room-editor links, the Substrate Registry panel's
 * columns — passes its ids through `inSubstrateOrder`, which applies the order
 * the user saved (the setting `SUBSTRATE_ORDER_SETTING`, edited with the
 * Registry panel's ▲▼ column controls; "Registry order" clears it).
 *
 * ⛔ PURE AND BROWSER-SAFE: no settings or registry import. The owner of the
 * setting (`substrateRegistryPanel/index.js`) loads it and follows
 * `settings:changed`, handing it here with `setSubstrateOrder`; until then, and
 * in a mode without that module, the order is empty = id order.
 */

/** ⛓ The setting's key under `moduleSettings.substrateRegistryPanel`. */
export const SUBSTRATE_ORDER_KEY = 'substrateOrder';
/** ⛓ The full dotted key (`settingsManager.getSetting` / `settings:changed`). */
export const SUBSTRATE_ORDER_SETTING = `moduleSettings.substrateRegistryPanel.${SUBSTRATE_ORDER_KEY}`;
/** ⛓ The setting's schema: a list of substrate ids; empty = id order. */
export const SUBSTRATE_ORDER_SCHEMA = Object.freeze({
    type: 'array',
    items: { type: 'string' },
    default: [],
    title: 'Substrate order',
    description: 'The order every substrate list shows substrates in (the pipeline\'s pickers, the APWorld '
        + 'Editor\'s Initialise select and room-editor links, the Substrate Registry panel\'s columns). Set it '
        + 'with the Substrate Registry panel\'s column controls; empty = id order. A substrate the list does '
        + 'not name follows the named ones, in id order.',
});

/**
 * The ORDER rule: the ids of `order` that are still in `ids`, in `order`'s
 * order (a stale id is dropped, a repeat counts once), then every id of `ids`
 * that `order` does not name, in `ids`' own order — an entry registered after
 * the user reordered APPENDS rather than vanishing. An empty `order` is the
 * identity.
 *
 * @param {string[]} ids    the live ids, in registry (id) order
 * @param {string[]} order  the display order (may be stale)
 * @returns {string[]}
 */
export function reorderIds(ids, order = []) {
    const live = new Set(ids);
    const head = [...new Set(order)].filter((id) => live.has(id));
    const named = new Set(head);
    return [...head, ...ids.filter((id) => !named.has(id))];
}

let current = [];

/** Install the saved order (anything but a list of strings reads as empty). */
export function setSubstrateOrder(order) {
    current = Array.isArray(order) ? order.filter((id) => typeof id === 'string' && id !== '') : [];
}

/** The saved order, a copy. */
export function substrateOrder() {
    return [...current];
}

/** ⛓⛓ `ids` in the user's order — the one call every substrate list makes. */
export function inSubstrateOrder(ids) {
    return reorderIds(ids, current);
}

/** ⛓ Registry `entries` (objects with an `id`) in the user's order — `inSubstrateOrder` over their ids. */
export function entriesInSubstrateOrder(entries) {
    const byId = new Map(entries.map((e) => [e.id, e]));
    return inSubstrateOrder([...byId.keys()]).map((id) => byId.get(id));
}
