/**
 * seedlingAtlasDoorCensus — the pure half of `census-seedling-atlas-doors.mjs`
 * (SEEDLING SWIM S2 D2): a region atlas's INTERNAL exits (the `subgraph`
 * crossings between sub-regions of one level) by rule and by level, the rows
 * whose rule needs `Progressive Swim`, which of those levels a committed bot
 * tape WITNESSES with water armed, and whether the pipeline's content source can
 * reach either side of a row. No I/O: the CLI and the vitest row hand the
 * documents in.
 */

/** The item the swim rows are about — the AP name the analyzer writes. */
export const SWIM_ITEM = 'Progressive Swim';

/** A rule node as one short string (`Has(Fire)`, `Has(Progressive Swim, 2)`, `And(…)`), `(none)` when absent. */
export function ruleLabel(node) {
    if (!node) return '(none)';
    if (node.rule === 'Has') {
        const count = node.args?.count;
        return `Has(${node.args?.item_name}${count !== undefined && count !== 1 ? `, ${count}` : ''})`;
    }
    if (node.rule === 'HasAny' || node.rule === 'HasAll') return `${node.rule}(${(node.args?.item_names ?? []).join(', ')})`;
    if (Array.isArray(node.children)) return `${node.rule}(${node.children.map(ruleLabel).join(', ')})`;
    return `${node.rule}(${JSON.stringify(node.args ?? {})})`;
}

/** Every item name a rule node mentions, at any depth. */
export function ruleItems(node, out = new Set()) {
    if (!node || typeof node !== 'object') return out;
    const a = node.args ?? {};
    if (typeof a.item_name === 'string') out.add(a.item_name);
    for (const n of a.item_names ?? []) out.add(n);
    for (const c of node.children ?? []) ruleItems(c, out);
    return out;
}

/**
 * The tapes that WITNESS water for a level: a tape boots in level L, water is
 * ARMED (`noHazards` lacks `'water'`), and its grants hold a tag whose AP item is
 * `Progressive Swim` (`swimTags`, read off `ITEM_FOR_TAG` by the caller). A tape
 * with water armed and NO swim tag is listed as a NO-SWIM tape for L (the strict
 * side's candidates — only one that enters water is a drown control, and this
 * census does not replay).
 *
 * ⚠ BOUND: the boot level only. A tape that walks into another level is not
 * replayed here, so it witnesses only where it boots; and a witness says the
 * swim ability and live water met in that level, not that the tape crossed any
 * particular internal exit.
 *
 * @param {Array<{file: string, tape: object}>} tapes
 * @param {string[]} swimTags
 */
export function swimWitnesses(tapes, swimTags) {
    const swim = new Set(swimTags);
    const witness = new Map(); // level -> [file]
    const noSwim = new Map();
    for (const { file, tape } of tapes) {
        if ((tape.noHazards ?? []).includes('water')) continue;
        const level = tape.boot?.level;
        if (!Number.isInteger(level)) continue;
        const held = (tape.grants ?? []).some((g) => (g.items ?? []).some((it) => swim.has(it)));
        const into = held ? witness : noSwim;
        if (!into.has(level)) into.set(level, []);
        into.get(level).push(file);
    }
    return { witness, noSwim };
}

/**
 * The census.
 *
 * @param {object} atlas a region atlas document
 * @param {object} o
 * @param {Map<number, string[]>} o.witness level -> witnessing tapes (`swimWitnesses`)
 * @param {Map<number, string[]>} [o.noSwim] level -> water-armed tapes with no swim tag
 * @param {Set<string>} [o.placeable] `"<region_id>/<sub_region>"` of every room the
 *   content source can place (a sub-region with ≥1 wired door)
 */
export function censusAtlasDoors(atlas, { witness, noSwim = new Map(), placeable = new Set() }) {
    const byRule = new Map();
    const byLevel = new Map();
    const swimRows = [];
    let regionsWithSubgraph = 0;
    let subRegions = 0;
    let internalExits = 0;
    for (const region of atlas.regions ?? []) {
        const sg = region.subgraph;
        if (!sg) continue;
        regionsWithSubgraph += 1;
        subRegions += (sg.sub_regions ?? []).length;
        for (const ie of sg.internal_exits ?? []) {
            internalExits += 1;
            const label = ruleLabel(ie.access_rule);
            byRule.set(label, (byRule.get(label) ?? 0) + 1);
            const level = region.map_ref;
            const row = byLevel.get(level) ?? { level, region_id: region.region_id, internal: 0, swim: 0 };
            row.internal += 1;
            if (ruleItems(ie.access_rule).has(SWIM_ITEM)) {
                row.swim += 1;
                swimRows.push({
                    level, region_id: region.region_id, from: ie.from, to: ie.to, rule: label,
                    fromPlaceable: placeable.has(`${region.region_id}/${ie.from}`),
                    toPlaceable: placeable.has(`${region.region_id}/${ie.to}`),
                });
            }
            byLevel.set(level, row);
        }
    }
    const swimLevels = [...byLevel.values()].filter((r) => r.swim > 0)
        .map((r) => ({
            ...r,
            witnesses: witness.get(r.level) ?? [],
            noSwimTapes: noSwim.get(r.level) ?? [],
            verdict: (witness.get(r.level) ?? []).length ? 'WITNESSED' : 'BOT-UNCERTIFIED',
        }))
        .sort((a, b) => (b.swim - a.swim) || (a.level - b.level));
    return {
        atlasId: atlas.atlas_id,
        regions: (atlas.regions ?? []).length,
        regionsWithSubgraph,
        subRegions,
        internalExits,
        byRule: [...byRule].sort((a, b) => b[1] - a[1]).map(([rule, count]) => ({ rule, count })),
        swim: swimRows.length,
        swimLevels,
        witnessedLevels: swimLevels.filter((r) => r.verdict === 'WITNESSED').map((r) => r.level),
        uncertifiedLevels: swimLevels.filter((r) => r.verdict !== 'WITNESSED').map((r) => r.level),
        swimRowsWithPlaceableSide: swimRows.filter((r) => r.fromPlaceable || r.toPlaceable).length,
        swimRowsBothSidesPlaceable: swimRows.filter((r) => r.fromPlaceable && r.toPlaceable).length,
        swimRows,
    };
}
