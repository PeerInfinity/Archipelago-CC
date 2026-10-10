/**
 * seedlingDemo/wasmDelivery — ⛓⛓ **MID-ROOM REPLAN: AN ITEM ARRIVES WHILE THE
 * WASM PLAYBACK BOT DRIVES** (⚖ the user, 2026-10-03: items can arrive
 * mid-room, from other players too; the solver replans IN the room, never by
 * leaving and re-entering it). The pure decisions behind the wasm engine's
 * DELIVERY GATE (`flashPanel/seedlingWasmPlayback.js`): what an item changes,
 * whether the model can take it mid-run, and the slot array the game will hold.
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
 * state no digest carries (`slot-use`, `slot-index`).
 *
 * ⛓ SLOTS CONSUMER — the slot ORDER is no longer a clause: every live staging
 * carries the game's own array (`inventory_slots`, off `botStatus`), and the
 * model grows it as the game does (`tapeFormat.appendInventorySlots`), so the
 * model's array after a delivery IS `slotsAfterDelivery`'s by construction.
 *
 * ⛔ DOM-FREE and clock-free. No solver or model change.
 */

import { ITEM_PROPERTIES, appendInventorySlots } from './tapeFormat.js';
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
export const DELIVERY_CLAUSES = Object.freeze(['build', 'prefix', 'slot-use', 'slot-index']);

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
 * ⛓ ENCOUNTERS-2 — the item rows a delivery CHANGES (`itemDelta`'s properties, at their new value): what a
 * re-staging may put at the ARRIVAL. ⛔ Never the game's whole readout: an item the room itself granted
 * mid-room (an encounter's drop — the Fire at L32, the dark sword at L12; a pickup the run collected) is in
 * the game's items but NOT in the room's arrival, and the model's run grants it again on its own tick.
 * Staged at the arrival, `BobBoss`'s constructor removes itself and the shadow is elsewhere from tick 4.
 */
export function deliveredItems(before, after) {
    return Object.fromEntries(itemDelta(before, after).map((d) => [d.property, d.to]));
}

// ── ⛓ KEY DELIVERY — the SAVE-ARRAY channel ────────────────────────────────
//
// A key is not an item property: the game holds it in `Main.SAVE_FILE.data.hasKey`,
// which every host tape boot RESETS to the tape's `save.keys` (`Bot.as`, the R5
// save-array block, unconditional). The panel writes an AP key through the game's
// own setter (`games/seedling.json`: a METHOD-CALL item, `Main.hasKeySet(i, true)`),
// and the write DECLARES the array it lands in (`save_array: 'keys'`, `index`). The
// engine mirrors those into every staging and every shipped tape's declaration, so a
// tape boot never takes back a key AP granted and the model sees what the game holds.

/** The save arrays a delivery may reach: INDEX SETS (`keys`, `totem_parts`). `seal_parts` is positional and never merged. */
export const UNION_SAVE_ARRAYS = Object.freeze(['keys', 'totem_parts']);

/**
 * ⚖ THE MERGE RULE: a save array AP reaches is the UNION of what the game holds and
 * what AP granted — never an overwrite. A key the game picked up in play (a vanilla
 * room's `BossKey`) and AP does not hold stays; a key AP holds and the game lost (a
 * tape boot that declared too few) is restored. Nothing is ever cleared.
 */
export const SAVE_ARRAY_MERGE = 'union';

const sortedUnion = (...lists) => [...new Set(lists.flat().filter((i) => Number.isInteger(i)))].sort((a, b) => a - b);

/** The save arrays `writes` declare (`[{save_array, index}]`, the adapter's method-call items): `{keys: [0, 2]}`. */
export function saveArraysOfWrites(writes) {
    const out = {};
    for (const w of writes ?? []) {
        if (!w?.save_array) continue;
        if (!UNION_SAVE_ARRAYS.includes(w.save_array)) {
            throw new Error(`wasmDelivery: a write declares save array ${JSON.stringify(w.save_array)} — only the index sets `
                + `${UNION_SAVE_ARRAYS.join(', ')} merge (seal_parts is positional)`);
        }
        out[w.save_array] = sortedUnion(out[w.save_array] ?? [], [w.index]);
    }
    return out;
}

/** The game's index sets off `botStatus.save` (booleans → true indices). */
export function liveSaveArrays(status) {
    const out = {};
    for (const name of UNION_SAVE_ARRAYS) {
        const arr = status?.save?.[name];
        if (Array.isArray(arr)) out[name] = arr.flatMap((v, i) => (v ? [i] : []));
    }
    return out;
}

/** `SAVE_ARRAY_MERGE` over any number of `{name: indices}` maps. */
export function mergeSaveArrays(...maps) {
    const out = {};
    for (const m of maps) for (const [name, idx] of Object.entries(m ?? {})) out[name] = sortedUnion(out[name] ?? [], idx ?? []);
    return out;
}

/** What `after` holds that `before` does not, `[{array, index}]` (a merge never removes, so this is the whole delta). */
export function saveDelta(before, after) {
    const rows = [];
    for (const name of UNION_SAVE_ARRAYS) {
        const had = new Set(before?.[name] ?? []);
        for (const i of after?.[name] ?? []) if (!had.has(i)) rows.push({ array: name, index: i });
    }
    return rows;
}

/** `staging` with `arrays` merged into its `save` block (`SAVE_ARRAY_MERGE`). A staging with no such array declares it. */
export function stageSaveArrays(staging, arrays) {
    if (!arrays || Object.keys(arrays).length === 0) return staging;
    const s = structuredClone(staging);
    s.save = { ...(s.save ?? {}) };
    for (const [name, idx] of Object.entries(arrays)) {
        if (!UNION_SAVE_ARRAYS.includes(name)) throw new Error(`wasmDelivery: no union rule for save.${name}`);
        s.save[name] = sortedUnion(s.save[name] ?? [], idx ?? []);
    }
    return s;
}

/**
 * The save arrays a delivery ADDS — in `save` (the predicted arrays) and in neither
 * the staging's `save` nor the game's live arrays: `{keys: [i, …]}` (empty arrays
 * dropped). What `deliveryRefusal` replays and what the engine re-stages.
 */
export function deliveredSaveArrays({ staging, status, save }) {
    const had = mergeSaveArrays(staging?.save ?? {}, liveSaveArrays(status));
    const out = {};
    for (const { array, index } of saveDelta(had, save ?? {})) out[array] = sortedUnion(out[array] ?? [], [index]);
    return out;
}

/**
 * `staging` with its item rows replaced by `items` (the room's ARRIVAL, as if
 * the item had been held when it began). The arrival staging carries them in
 * `seam.items` (and `hitsMax` beside them as `seam.hits_max` where the
 * latch authored it).
 *
 * ⛓ SLOTS CONSUMER — `slots` (the game's `botStatus.inventory_slots` BEFORE the
 * write) replaces the staged `inventory_slots`: the model appends the delivered
 * slot items to it at construction (`appendInventorySlots`), which is the array
 * the game will hold (`slotsAfterDelivery`). Omitted = the staging's own array.
 *
 * ⛓ KEY DELIVERY — `save` (`{keys: [...]}`) is merged into the staging's save
 * arrays (`SAVE_ARRAY_MERGE`): a key delivered mid-room is staged at the arrival.
 */
export function stageItems(staging, items, { slots, save } = {}) {
    const s = structuredClone(stageSaveArrays(staging, save));
    if (Array.isArray(slots)) s.inventory_slots = [...slots];
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
 * CURRENT slot array — what the game will hold after a delivery: the model's
 * own transcription (`tapeFormat.appendInventorySlots`), asked once for
 * `Main.primary` and once for `Main.secondary` (`removeItem` takes both modulo
 * the shorter array, `Inventory.as:118-119`; an emptied array is `% 0`, which
 * the `int` setters coerce to 0). The slot array does not depend on the index.
 *
 * @returns {{slots:number[], primary:number, secondary:number}}
 */
export function slotsAfterDelivery({ slots, primary = 0, secondary = 0 }, items) {
    const p = appendInventorySlots(slots ?? [], items ?? {}, { primary });
    const q = appendInventorySlots(slots ?? [], items ?? {}, { primary: secondary });
    return { slots: p.slots, primary: p.primary, secondary: q.primary };
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
 *   slot-index  a fusion's `removeItem` moves `Main.primary` / `secondary`
 *               (modulo the shorter array) off the staged index: the game
 *               moves it on the frame the item lands, the re-staged model at
 *               the arrival, so the held game is not the shadow. (⛓ SLOTS
 *               CONSUMER: a re-staging over the game's array fuses at the
 *               model's construction, so a moved `primary` is already
 *               `build`'s first-row difference; this clause is what is left —
 *               `secondary`, which the model does not carry.)
 *
 * @param {object} o
 * @param {object} o.staging  the room's arrival staging (the shadow's recipe)
 * @param {Array<Iterable<string>>} o.shipped  every key set the room has played since that arrival
 * @param {object} o.items    the game's items after the delivery (`itemsAfterWrites`)
 * @param {object} [o.save]   ⛓ KEY DELIVERY — the save arrays after it (`{keys: [...]}`, merged; null = none)
 * @param {object} o.status   `botStatus` NOW (before the write): `items`, `inventory_slots`, `primary`, `secondary`
 * @param {object} o.levelSource
 * @param {Map<number, number>} [o.equips]  the slot selections those keys shipped with (room tick → slot)
 */
export function deliveryRefusal({ staging, shipped, items, save = null, status, levelSource, equips = null }) {
    const no = (clause, why) => ({ clause, why });
    const before = status?.items ?? {};
    const delta = itemDelta(before, items);
    // ⛓ KEY DELIVERY — a key the delivery adds that the STAGING does not already hold (the replay's question).
    // Only what is NEW to both the staging and the game: a key the run picked up itself mid-room is in the
    // model's run already, and staging it at the arrival would despawn its pickup there.
    const added = deliveredSaveArrays({ staging, status, save });
    const keyRows = saveDelta({}, added);
    if (delta.length === 0 && keyRows.length === 0) return null;
    const names = [...delta.map((d) => d.property), ...keyRows.map((k) => `save.${k.array}[${k.index}]`)].join(', ');
    let withItem;
    let without;
    try {
        withItem = createRunForStaging(stageItems(staging, deliveredItems(before, items), { save: added }), levelSource, { scratchPersistence: true });
        without = createRunForStaging(staging, levelSource, { scratchPersistence: true });
    } catch (err) { return no('build', `the room does not build with ${names} staged: ${String(err?.message ?? err).split('\n')[0]}`); }
    if (witness(withItem) !== witness(without)) {
        return no('build', `the room staged with ${names} is not the room the game built without it (its first row differs)`);
    }
    const keys = (shipped ?? []).map((h) => (h instanceof Set ? h : new Set(h)));
    for (let t = 0; t < keys.length; t += 1) {
        try {
            // ⛓ WASM EQUIPS — a slot the shipped tapes selected (room tick → slot), re-made before its tick.
            const slot = equips?.get(t);
            if (slot !== undefined) { withItem.equipNow(slot); without.equipNow(slot); }
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
    if (post.primary !== pre.primary || post.secondary !== pre.secondary) {
        return no('slot-index', `the delivery moves the selected slots (primary ${pre.primary} → ${post.primary}, secondary `
            + `${pre.secondary} → ${post.secondary}) off the staged ones`);
    }
    return null;
}

/**
 * ⛓ WASM EQUIPS — null when every slot selection a plan ships names a slot the
 * game will HOLD at that tick, else the refusal BY NAME (the engine refuses the
 * tape before shipping it, never discovers it as a divergence). The game's
 * array there is the one it holds NOW with the items the model holds at the
 * equip appended (`slotsAfterDelivery`); an index past its end is an UNOWNED
 * slot (`Inventory.getItem` reads 0, the sword, whatever the model selected).
 *
 * ⛓ SLOTS CONSUMER — the ORDER is not checked here any more: every live
 * staging carries the game's array (`inventory_slots`) and the solver indexes
 * it (`progress('inventorySlots')`), so the model's index names the game's item.
 *
 * @param {object} o
 * @param {Map<number, number>} o.equipsAt     plan index → slot (`solveFromTape`)
 * @param {Map<number, object>} [o.equipItems] plan index → the model's inventory at that equip
 * @param {number[]} o.slots                   the game's `botStatus.inventory_slots` now
 * @returns {string|null}
 */
export function equipSlotRefusal({ equipsAt, equipItems, slots }) {
    for (const [t, slot] of equipsAt ?? []) {
        const items = equipItems?.get(t);
        if (!items) return `the plan selects slot ${slot} at tick ${t} and carries no record of the model's inventory there — the game's slot cannot be checked`;
        const game = slotsAfterDelivery({ slots: slots ?? [] }, items).slots;
        if (slot >= game.length) {
            return `the plan selects slot ${slot} at tick ${t}, and the game will hold ${game.length} slot(s) ${JSON.stringify(game)} `
                + '— an UNOWNED slot: an index past the end reads 0, the sword';
        }
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
