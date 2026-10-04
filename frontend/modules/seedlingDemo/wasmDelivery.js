/**
 * seedlingDemo/wasmDelivery — ⛓⛓ **MID-ROOM REPLAN: AN ITEM ARRIVES WHILE THE
 * WASM PLAYBACK BOT DRIVES** (⚖ the user, 2026-10-03: items can arrive
 * mid-room, from other players too; the solver replans IN the room, never by
 * leaving and re-entering it). The pure decisions behind the wasm engine's
 * DELIVERY GATE (`flashPanel/seedlingWasmPlayback.js`): what an item changes,
 * whether the model can take it mid-run, and the slot order the game will hold.
 *
 * The gate's mechanism (the engine's): while the bot drives, the panel adapter
 * writes the inventory through the engine's gate, which holds back a delivery
 * the game could see. At the next safe point (`botHold("on")` now, mid-tape;
 * or a room the engine already holds) the engine asks `deliveryRefusal` with
 * the PREDICTED items, BEFORE anything is written; on null it writes them,
 * re-stages the room's arrival with them and replans the goal as a
 * continuation from the shadow (W7's machinery), then releases.
 *
 * ── WHY "STAGED AT THE ARRIVAL" IS EXACT (measured, slice `seedling-js-midroom-replan`) ──
 *
 * The model takes state only at construction (`createRunForStaging`), so the
 * item is staged from the room's ARRIVAL and the shipped prefix replayed over
 * it. That is the game only if the item changed nothing before it arrived:
 * the census replayed every solved vanilla leg's plan (126 bare, 149 with the
 * kit) with each of the 14 item properties staged — bare: no item moved any
 * tick; kit: `hasDarkSword` (5 legs, at a slash), `hasGhostSword` (6 — the
 * model REFUSES the ghost press) and `hasDarkShield` (1, L14) did. So the
 * check is not a table of items: it is the replay itself (`prefix`), plus the
 * state no digest carries (`slot-use`, `slot-order`, `slot-index`).
 *
 * ⛔ DOM-FREE and clock-free. No solver or model change.
 */

import { INVENTORY_ITEM_IDS, ITEM_PROPERTIES, inventorySlotsFor } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { runDigest } from './jsRuntimeSolver.js';

/** The engine's policy for an item that arrives while it drives: hold the room, write it, replan in place. */
export const DELIVERY_POLICY = 'hold-and-replan';
/** …and for one the model cannot take mid-run: keep it queued until the room's END (the next arrival). */
export const DELIVERY_FALLBACK = 'room-end';

/** The fourteen game properties an item writes (`botStatus.items`: thirteen booleans and `hitsMax`). */
export const ITEM_PROPERTY_NAMES = Object.freeze(Object.values(ITEM_PROPERTIES).map((p) => p.property));

/**
 * The properties `Inventory.addItemsFromSave` turns into SLOTS (`tapeFormat.inventorySlotsFor`):
 * a weapon the player USES through `Main.primary` / `Main.secondary`. Every other item is passive.
 */
export const SLOT_ITEM_PROPERTIES = Object.freeze(['hasSword', 'hasGhostSword', 'hasFire', 'hasWand', 'hasFireWand', 'hasSpear']);

/** The tape keys that reach a slot: `useItem(primary)`, `useItem(secondary)`, and the inventory menu. */
export const SLOT_KEYS = Object.freeze(['primary', 'secondary', 'inventory', 'inventory2']);

/** `deliveryRefusal`'s clauses, in the order they are asked. */
export const DELIVERY_CLAUSES = Object.freeze(['build', 'prefix', 'slot-use', 'slot-order', 'slot-index']);

/**
 * The game's items after the adapter's `writes` (`[{property, value}]`, the
 * panel's own inventory → write mapping) land over `items` (`botStatus.items`).
 * Writes to anything but an item property are ignored.
 */
export function itemsAfterWrites(items, writes) {
    const out = { ...(items ?? {}) };
    for (const w of writes ?? []) {
        if (ITEM_PROPERTY_NAMES.includes(w?.property)) out[w.property] = w.value;
    }
    return out;
}

/** The item properties whose value differs, `[{property, from, to}]` in `ITEM_PROPERTY_NAMES` order. */
export function itemDelta(before, after) {
    return ITEM_PROPERTY_NAMES.filter((p) => (before?.[p] ?? null) !== (after?.[p] ?? null))
        .map((p) => ({ property: p, from: before?.[p] ?? null, to: after?.[p] ?? null }));
}

/**
 * `staging` with its item rows replaced by `items` (the room's ARRIVAL, as if
 * the item had been held when it began). The arrival staging carries them in
 * `seam.items` (and `hitsMax` beside them as `seam.hits_max` where the
 * latch authored it).
 */
export function stageItems(staging, items) {
    const s = structuredClone(staging);
    s.seam = s.seam ?? {};
    s.seam.items = { ...(s.seam.items ?? {}) };
    for (const p of ITEM_PROPERTY_NAMES) {
        if (p !== 'hitsMax' && items?.[p] !== undefined) s.seam.items[p] = items[p];
    }
    // `hitsMax` is its own row in a latch-authored block (`hits_max`), an `items` key in a JS page's session.
    if (items?.hitsMax !== undefined) {
        if (Object.prototype.hasOwnProperty.call(s.seam, 'hits_max')) s.seam.hits_max = items.hitsMax;
        else s.seam.items.hitsMax = items.hitsMax;
    }
    return s;
}

/**
 * `Inventory.addItemsFromSave` (`Inventory.as:291-330`) applied to the game's
 * CURRENT slot array — what the game will hold after a delivery. ⚠ Not
 * `inventorySlotsFor`: that rebuilds the array from nothing in a fixed order,
 * while the game only ADDS (a push at the end, or a fusion's splice), so a
 * slot that arrives late lands after the ones already held. `removeItem`'s
 * `Main.primary %= items.length` (and secondary) is carried too.
 *
 * @returns {{slots:number[], primary:number, secondary:number}}
 */
export function slotsAfterDelivery({ slots, primary = 0, secondary = 0 }, items) {
    const s = [...(slots ?? [])];
    let p = primary;
    let q = secondary;
    const has = (id) => s.includes(id);
    // `removeItem`'s loop splices without stepping back — transcribed as is.
    const remove = (id) => {
        for (let i = 0; i < s.length; i += 1) if (s[i] === id) s.splice(i, 1);
        if (s.length > 0) { p %= s.length; q %= s.length; }
    };
    const add = (id, pos = -1) => { if (pos >= 0) s.splice(pos, 0, id); else s.push(id); };
    const { sword, fire, wand, spear, ghostsword, firewand } = INVENTORY_ITEM_IDS;
    if (!items.hasGhostSword) {
        if (items.hasSword && !has(sword)) add(sword);
    } else if (!has(ghostsword)) { remove(sword); remove(spear); add(ghostsword, 0); }
    if (!items.hasFireWand) {
        if (items.hasFire && !has(fire)) add(fire);
        if (items.hasWand && !has(wand)) add(wand);
    } else if (!has(firewand)) { remove(fire); remove(wand); add(firewand, 1); }
    if (!items.hasGhostSword) {
        if (items.hasSpear && !has(spear)) add(spear);
    }
    return { slots: s, primary: p, secondary: q };
}

/** `Inventory.getItem(i)`: an index past the end reads `undefined`, coerced to the int **0** — the sword's id. */
export const slotItemAt = (slots, i) => (Number.isInteger(i) && i >= 0 && i < (slots?.length ?? 0) ? slots[i] : 0);

const hitsOf = (run) => (Array.isArray(run.playerHits) ? run.playerHits.length : 0);
const witness = (run) => `${runDigest(run)}|hits ${hitsOf(run)}`;

/**
 * Can the model take `items` mid-run? null, or `{clause, why}` — the first
 * `DELIVERY_CLAUSES` row that refuses, by name. Asked with the PREDICTED
 * items, before anything is written.
 *
 *   build       the room staged with the items does not build, or is not the
 *               room built without them (its first row's digest differs): the
 *               item shapes the room's construction, and the game built it
 *               without the item
 *   prefix      the shipped prefix, replayed with the items staged at the
 *               arrival, leaves the model somewhere else at some tick (digest
 *               + the player's hits): the item would have ACTED before it
 *               arrived (the census: a dark sword's slash, a dark shield's block)
 *   slot-use    a SLOT item, and the prefix pressed a slot key: the weapon's
 *               timers (`slashing`, `firing`, …) are state no digest carries,
 *               and the model's would have run with the item
 *   slot-order  the slots the game will hold (`slotsAfterDelivery`: added at
 *               the end) are not the ones the model derives (`inventorySlotsFor`)
 *   slot-index  a fusion's `removeItem` moves `Main.primary` / `secondary`
 *               (modulo the shorter array) off the staged index
 *
 * @param {object} o
 * @param {object} o.staging  the room's arrival staging (the shadow's recipe)
 * @param {Array<Iterable<string>>} o.shipped  every key set the room has played since that arrival
 * @param {object} o.items    the game's items after the delivery (`itemsAfterWrites`)
 * @param {object} o.status   `botStatus` NOW (before the write): `items`, `inventory_slots`, `primary`, `secondary`
 * @param {object} o.levelSource
 */
export function deliveryRefusal({ staging, shipped, items, status, levelSource }) {
    const no = (clause, why) => ({ clause, why });
    const before = status?.items ?? {};
    const delta = itemDelta(before, items);
    if (delta.length === 0) return null;
    const names = delta.map((d) => d.property).join(', ');
    let withItem;
    let without;
    try {
        withItem = createRunForStaging(stageItems(staging, items), levelSource, { scratchPersistence: true });
        without = createRunForStaging(staging, levelSource, { scratchPersistence: true });
    } catch (err) { return no('build', `the room does not build with ${names} staged: ${String(err?.message ?? err).split('\n')[0]}`); }
    if (witness(withItem) !== witness(without)) {
        return no('build', `the room staged with ${names} is not the room the game built without it (its first row differs)`);
    }
    const keys = (shipped ?? []).map((h) => (h instanceof Set ? h : new Set(h)));
    for (let t = 0; t < keys.length; t += 1) {
        try {
            withItem.advance(keys[t]);
            without.advance(keys[t]);
        } catch (err) { return no('prefix', `the shipped prefix does not replay with ${names} staged (tick ${t + 1}): ${String(err?.message ?? err).split('\n')[0]}`); }
        if (witness(withItem) !== witness(without)) {
            return no('prefix', `with ${names} staged at the arrival the shipped prefix leaves the model elsewhere at tick ${t + 1} of ${keys.length} `
                + '— the item would have acted before it arrived');
        }
    }
    const slotItems = delta.filter((d) => SLOT_ITEM_PROPERTIES.includes(d.property)).map((d) => d.property);
    if (slotItems.length) {
        const used = keys.findIndex((h) => SLOT_KEYS.some((k) => h.has(k)));
        if (used >= 0) {
            return no('slot-use', `${slotItems.join(', ')} is a slot item and the shipped prefix pressed a slot key at tick ${used + 1} `
                + '— the weapon state that press left is not in the replay');
        }
    }
    const pre = { slots: status?.inventory_slots ?? [], primary: status?.primary ?? 0, secondary: status?.secondary ?? 0 };
    const post = slotsAfterDelivery(pre, items);
    const canonical = inventorySlotsFor(items);
    if (JSON.stringify(post.slots) !== JSON.stringify(canonical)) {
        return no('slot-order', `the game will hold slots ${JSON.stringify(post.slots)} (added at the end), the model derives `
            + `${JSON.stringify(canonical)}`);
    }
    if (post.primary !== pre.primary || post.secondary !== pre.secondary) {
        return no('slot-index', `the delivery moves the selected slots (primary ${pre.primary} → ${post.primary}, secondary `
            + `${pre.secondary} → ${post.secondary}) off the staged ones`);
    }
    return null;
}

/**
 * ⛔ THE FIRST LIVE FRAME LAGS THE SLOTS. `Game.update` runs `inventory.update()`
 * (and so `addItemsFromSave`) AFTER `super.update()` steps the player, so on
 * the first frame after the release `useItem` still reads the slots as they
 * were. A continuation whose first tick presses a slot key whose slot the
 * delivery CHANGES (`slotItemAt` before ≠ after) is refused (→ the fallback).
 * (An empty slot reads 0, the sword: a sword delivered to an empty inventory
 * swings on that first frame — measured live, on plan.)
 *
 * @returns {string|null}
 */
export function firstTickSlotRefusal({ before, after, primary = 0, secondary = 0, solution }) {
    const first = new Set(solution?.[0] ?? []);
    for (const [key, index] of [['primary', primary], ['secondary', secondary]]) {
        if (!first.has(key)) continue;
        const was = slotItemAt(before, index);
        const now = slotItemAt(after, index);
        if (was !== now) {
            return `the continuation presses ${key} on its first tick, and the delivery changes that slot (${was} → ${now}) one `
                + 'frame AFTER the player reads it (`inventory.update` runs after the world steps)';
        }
    }
    return null;
}
