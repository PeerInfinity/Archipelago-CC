/**
 * procgenCore/itemIntroduction — **WHICH ITEMS A SUBSTRATE CAN INTRODUCE INTO A
 * REGION, AND HOW THE PIPELINE ASKS FOR ONE** (⚖ the user, 2026-11-03: *"Yes, add
 * introduced, and integrate it with at least sphere growth mode. Regenerating a
 * region should attempt to match the logic of the first generation, including
 * introduced items. Alternatively, items could be introduced only if the procgen
 * pipeline specifically requests them."* and *"I want the reporting to happen
 * through a substrate agnostic method, like the substrate registry."*).
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * A region generator may put an item of its OWN into a region: a lock and the key
 * that opens it, where the key is the substrate's item, not one the growth mode
 * dealt. Left to the generator, that item is invisible to the world's logic until
 * after the region is built. MEASURED (sphere growth, one key-gate room, seeds
 * 1–3): the unplanned key enters at sphere w+1, the item behind its lock slips to
 * w+2 and every later sphere moves back (`sphere count mismatch: computed 4,
 * planned 3`). So a driver whose plan IS its oracle has to know the item BEFORE
 * the region is realised, which means the pipeline must REQUEST it.
 *
 * ── THE DECLARATION (on a registry entry, beside `locationCapacity`) ──
 *
 *   itemIntroduction: {
 *     introducibleItems(params) -> string[],
 *     replayableItems?() -> string[],
 *     exhaustedRefusal?(regionId, items) -> string,
 *   }
 *
 *   `introducibleItems` lists, IN PREFERENCE ORDER, the items a region of this
 *   substrate built under `params` (the world's region params) can introduce. An
 *   empty list means "none under these params". Introducing item K means two
 *   things. The region holds a location of its own carrying K. Every location the
 *   pipeline rules `Has(K)` stands BEHIND what K opens. `exhaustedRefusal` is the
 *   substrate's sentence for a region that would need an item when every listed
 *   one is already in the world. Without it, the generic sentence below is used.
 *   `replayableItems` lists EVERY item the substrate can introduce under any params. A spec that already carries
 *   a request for one of them (a regenerate) is replayed even when the params the regenerate runs under would not
 *   have asked for it: the request belongs to the region's logic, not to its knobs. Without it, the params' list.
 *
 * ── THE REQUEST (what the realiser hands `generateRegionCore` as `input.introduce`) ──
 *
 *   introduce = { items: { [K]: 1 } }   introduce K (the spec carries a location
 *                                        holding K and a location ruled Has(K));
 *   introduce = { items: {} }           requests are ON for this region, and it is
 *                                        asked for NONE. It must introduce nothing.
 *   (absent)                            requests are off. The substrate does what
 *                                        it did before this capability existed.
 *
 *   ⛓ The request is DERIVED FROM THE SPEC (`introductionRequestOf`): a location
 *   holding a declared item K, plus a location whose rule requires K. So a
 *   regenerate that hands the realiser a region's own document locations (the
 *   APWorld editor's `buildDocumentRegionSpec`) REPLAYS the first generation's
 *   request with nothing recomputed.
 *
 * ⛔ PURE AND BROWSER-SAFE: every function takes an ENTRY (or `null`). There is no
 * registry import and no substrate name. An entry with no declaration answers
 * "none" everywhere here, and every caller keeps its old behaviour.
 */

/** ⛓ The refusal NAMES, spelled once. */
export const ITEM_INTRODUCTION_REFUSAL_NAMES = Object.freeze({
    malformed: 'item-introduction-malformed',
    exhausted: 'introducible-items-exhausted',
    unrequested: 'unrequested-introduction',
});

export const ITEM_INTRODUCTION_REFUSALS = Object.freeze({
    malformed: (id, why) => `${ITEM_INTRODUCTION_REFUSAL_NAMES.malformed}: substrate '${id}' declares `
        + `\`itemIntroduction\`, and ${why}`,
    exhausted: (regionId, items) => `${ITEM_INTRODUCTION_REFUSAL_NAMES.exhausted}: region '${regionId}' would `
        + `introduce an item of its own, and every one it can introduce (${items.join(', ')}) is already in the world. `
        + 'Each introduced item must be new to the world, so the region is refused rather than handed one it shares.',
    unrequested: (regionId, items) => `${ITEM_INTRODUCTION_REFUSAL_NAMES.unrequested}: region '${regionId}' `
        + `holds ${items.map((i) => `'${i}'`).join(', ')}, an item its substrate introduces, and the pipeline did not `
        + 'request it. Under sphere growth the plan IS the oracle, so an item it never scheduled would move every '
        + 'later sphere. Refused rather than shipped with logic that does not match the plan.',
});

/** Does the entry declare the capability at all? */
export function declaresItemIntroduction(entry) {
    return typeof entry?.itemIntroduction?.introducibleItems === 'function';
}

/**
 * The items a region of `entry` built under `params` can introduce, in
 * preference order. `[]` for an entry without the declaration. A malformed answer
 * is refused by name.
 */
export function introducibleItemsOf(entry, params) {
    if (!declaresItemIntroduction(entry)) return [];
    const items = entry.itemIntroduction.introducibleItems(params ?? {});
    if (!Array.isArray(items) || items.some((i) => typeof i !== 'string' || i.length === 0)) {
        throw new Error(ITEM_INTRODUCTION_REFUSALS.malformed(entry.id,
            `its introducibleItems answered ${JSON.stringify(items)}, not an array of non-empty item names`));
    }
    if (new Set(items).size !== items.length) {
        throw new Error(ITEM_INTRODUCTION_REFUSALS.malformed(entry.id,
            `its introducibleItems answered ${JSON.stringify(items)}, which names an item twice`));
    }
    return items;
}

/** Every item `entry` can introduce under any params (`replayableItems`, else the params' own list). */
export function replayableItemsOf(entry, params) {
    if (!declaresItemIntroduction(entry)) return [];
    if (typeof entry.itemIntroduction.replayableItems !== 'function') return introducibleItemsOf(entry, params);
    const items = entry.itemIntroduction.replayableItems();
    if (!Array.isArray(items) || items.some((i) => typeof i !== 'string' || i.length === 0)) {
        throw new Error(ITEM_INTRODUCTION_REFUSALS.malformed(entry.id,
            `its replayableItems answered ${JSON.stringify(items)}, not an array of non-empty item names`));
    }
    return items;
}

/** The sentence for a region with no item left to introduce: the substrate's own, else the generic one. */
export function exhaustedRefusalOf(entry, regionId, items) {
    const own = entry?.itemIntroduction?.exhaustedRefusal;
    return typeof own === 'function' ? own(regionId, items) : ITEM_INTRODUCTION_REFUSALS.exhausted(regionId, items);
}

/** Does `rule` REQUIRE `item`: `Has(item)` itself, or an `And` with it among its children? */
export function ruleRequiresItem(rule, item) {
    if (!rule || typeof rule !== 'object') return false;
    if (rule.rule === 'Has' && rule.args?.item_name === item) return true;
    return rule.rule === 'And' && (rule.children ?? []).some((c) => ruleRequiresItem(c, item));
}

/**
 * The items a realiser SPEC asks this region to introduce: every replayable item K
 * that one spec location holds and another spec location's rule requires.
 * `spec.locations` are `{id, item?, access_rule?}`. Returns `{items: {K: 1}}`, or
 * `null` when the entry declares nothing or the spec asks for nothing. With
 * `spec.introductionRequests === true` (a driver whose requests are ON), an empty
 * ask is `{items: {}}`, never `null`.
 */
export function introductionRequestOf(entry, spec) {
    if (!declaresItemIntroduction(entry)) return null;
    const on = spec?.introductionRequests === true;
    const declared = replayableItemsOf(entry, spec?.params);
    const locations = spec?.locations ?? [];
    const items = {};
    for (const k of declared) {
        const holder = locations.find((l) => l.item === k);
        if (!holder) continue;
        if (locations.some((l) => l !== holder && ruleRequiresItem(l.access_rule, k))) items[k] = 1;
    }
    if (Object.keys(items).length === 0 && !on) return null;
    return Object.freeze({ items: Object.freeze(items) });
}

/**
 * The declared items `locations` hold that `requested` does not account for: the
 * check a driver whose requests are ON makes after a region is built. `locations`
 * are the region's extracted locations (`{item}`).
 */
export function unrequestedIntroductions(entry, params, locations, requested) {
    const declared = new Set(introducibleItemsOf(entry, params));
    if (declared.size === 0) return [];
    const asked = new Set(Object.keys(requested?.items ?? {}));
    return [...new Set((locations ?? []).map((l) => l.item).filter((i) => declared.has(i) && !asked.has(i)))];
}
