/**
 * seedlingDemo/itemLabels — **THE AP NAME OF EACH BOOT FLAG A SEEDLING ROOM CAN
 * GATE ON**, and the ITEM LIBRARY the generated substrate declares from it.
 *
 * A LEAF on purpose (no imports): `procgenRequirements.js` re-exports these
 * beside the differential, but the flash panel's generated entry
 * (`flashSeedlingGenLibrary.js`) is LIGHT — it may not pull the oracle and the
 * solver into the panel's static closure (its own docblock measures that at 94
 * files) — and it needs the same table to declare `libraryItems`.
 *
 * ── ⛓ WHY THE ENTRY DECLARES `libraryItems` (swim T1's merge, 2026-09-29) ──
 * `presetDefs.generate.slow.test.js` refuses a shipped preset whose scenario
 * names an item no item library of its substrates declares (*"the sphere
 * planner places such an id as a gate item anyway, and the world stays
 * green"*). `seedling_generated_swim` names `Progressive Swim` — the first
 * shipped world whose gate item is the GAME's own — and no Seedling substrate
 * declared any library. The library is DERIVED from this table (one item per
 * distinct AP name, in table order), never typed twice: the generated plan's
 * option B named exactly these three legs — an element, a boot flag, and the
 * item in `libraryItems`.
 *
 * A row is an AP item name, or `{item, count}` when the flag is the SECOND of a
 * progressive item (the feather is `Progressive Swim` ×2 — swim T2, D2).
 */

export const ITEM_LABELS = Object.freeze({
    hasSword: 'Progressive Sword',
    hasShield: 'Progressive Shield',
    canSwim: 'Progressive Swim',
    hasFeather: Object.freeze({ item: 'Progressive Swim', count: 2 }),
});

/** `{item, count}` for a flag the table names, else null. */
export function itemLabelOf(flag) {
    const row = ITEM_LABELS[flag];
    if (row === undefined) return null;
    if (typeof row === 'string') return Object.freeze({ item: row, count: 1 });
    return Object.freeze({ item: row.item, count: row.count ?? 1 });
}

/** The words the REPORT speaks for a flag — the AP name, `×N` when it takes
 *  more than one, and the flag itself when the table does not name it. */
export function itemLabel(flag) {
    const l = itemLabelOf(flag);
    if (!l) return flag;
    return l.count > 1 ? `${l.item} ×${l.count}` : l.item;
}

/**
 * ⛓ THE REQUIREMENT A REQUIRED ROW STANDS FOR, in the rule grammar's own
 * spelling — `Has('Progressive Sword')`, `Has('Progressive Swim', 2)`. ⛔ The
 * count is written only when it is not 1, so every row the table held before
 * T2 reads exactly as it did.
 */
export function requirementOf(flag) {
    const l = itemLabelOf(flag);
    const name = l ? l.item : flag;
    return l && l.count > 1 ? `Has('${name}', ${l.count})` : `Has('${name}')`;
}

/** The distinct AP item names the table carries, in table order. */
export const SEEDLING_GATE_ITEM_NAMES = Object.freeze([...new Set(
    Object.keys(ITEM_LABELS).map((flag) => itemLabelOf(flag).item),
)]);

/**
 * The item library the generated Seedling substrate declares: one progression
 * item per distinct AP name above, in the shared library's row shape
 * (`bounceDemoLibrary.BOUNCE_LIBRARY_ITEMS` is the precedent). `id === name`,
 * which is what `mergeSubstrateItemLib` keys on and the scenario names.
 */
/** The feature id that TAGS the gate items (the chart's item-tag law: an id
 *  carried by an entry's progression items; the entry lists it in
 *  `supportedFeatures` so the pipeline's item picker groups them under it). */
export const SEEDLING_ITEMS_FEATURE = 'seedling_items';
const GATE_ITEM_COLORS = Object.freeze(['#c0a040', '#4080d0', '#40b0c0']);
export const SEEDLING_LIBRARY_ITEMS = Object.freeze(Object.fromEntries(
    SEEDLING_GATE_ITEM_NAMES.map((name, i) => [name, Object.freeze({
        id: name,
        name,
        classification: 'progression',
        color: GATE_ITEM_COLORS[i % GATE_ITEM_COLORS.length],
        symbol: 'star',
        feature: SEEDLING_ITEMS_FEATURE,
    })]),
));
