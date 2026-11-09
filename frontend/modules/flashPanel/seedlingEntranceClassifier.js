/**
 * seedlingEntranceClassifier — **SEEDLING'S `entranceClassifier` HOOK** (ENTRANCE RANDOMIZATION E4b, ER plan §3.5):
 * the playthrough atlas's doorways → what the entrance-shuffle mode may move, by a STATED rule per doorway.
 *
 * ⚖ user 2026-11-01: Q1 STAIRS ONLY (screen edges and pits are out, not even as an option) · Q2 COUPLED ONLY ·
 * Q5 ZERO UNCLASSIFIED (a doorway no rule classifies STOPS the classifier, by name).
 *
 * ── IT REUSES E1's CENSUS, IT DOES NOT RESTATE IT ──────────────────────
 * The doorway unit, the class rules (R-LINK / R-PIT / R-WARP), the GAME-DATA reverse and the PINS are E1's
 * (`scripts/procgen/seedlingErDoorCensus.js` `censusErDoorways`): this module takes that census's RESULT as its input
 * (the node hook `scripts/procgen/seedlingEntranceShuffleHooks.mjs` loads it), so there is one pairing rule in the tree.
 * What it adds is the shuffle's reading of it:
 *
 *   C-SCOPE     a doorway is IN SCOPE iff its census class is in `inScopeClasses` (E1's `IN_SCOPE_CLASSES`: stairsdown,
 *               stairsup). Every other class is OUT, counted by class (`outOfScope`).
 *   C-ONE       an in-scope doorway is ONE atlas exit with ONE tile (a stair); anything else STOPS (Q5).
 *   C-PAIR      its reverse is E1's game-data reverse: in scope, of the opposite class, naming it back. A doorway E1
 *               could not pair is pinned by E1's PIN-UNPAIRED; one this reading cannot pair STOPS.
 *   C-BESIDE    its BESIDE-ARRIVAL — where a door placed at it lands — is the arrival exit its reverse's connection
 *               lands on (`conn(rev(D)).to`, E1's design note), and it lies in D's own atlas region and sub-region (the
 *               landing beside a stair is in the stair's own component: GER's coupled contract). Else STOP.
 *   PINS        E1's (PIN-CHAIN, PIN-UNPAIRED), plus PIN-PERMISSIVE: a stair whose BESIDE-ARRIVAL lands in the sub-region
 *               of a permissive binding the census marks AT RISK (E1 (D): its approach cost is dropped, so a shuffle
 *               would hand that permissiveness to another arrival) — with its coupled reverse (Q2). Each pin is named
 *               with its rule and why; a pin always takes its reverse with it.
 *
 * `target_group_lookup` is GER's, from the census's `OPPOSITE`: a stairsdown lands beside a stairsup and back.
 *
 * ⛔ PURE: no I/O. The atlas and the census are never mutated. Out of scope (named, not done here): screen edges,
 * pits, decoupled, item shuffling with ER.
 */

const q = (v) => JSON.stringify(v);

/** `L40:out_stairsdown_320_576` → `['level_40', 'out_stairsdown_320_576']` (E1's doorway id, a one-exit doorway). */
export function doorwayEndpoint(id) {
    const m = /^L(\d+):([a-z0-9_]+)$/.exec(id);
    if (!m) throw new Error(`seedlingEntranceClassifier: ${q(id)} is not a one-exit doorway id (L<level>:<exit_id>)`);
    return [`level_${m[1]}`, m[2]];
}

/**
 * @param {object} atlas the playthrough atlas the census was taken over (`atlas_id` must match)
 * @param {object} o
 * @param {object} o.census `censusErDoorways(...)` over this atlas (needs `doorwayList`, `unclassified`, `pins`, `permissive`)
 * @param {string[]} o.inScopeClasses E1's `IN_SCOPE_CLASSES`
 * @param {Object<string,string>} o.opposite E1's `OPPOSITE`
 * @returns {{atlasId: string, doorways: Array<{id, group, type, from, arrival, reverse, pinned}>,
 *   target_group_lookup: Object<string,string[]>, pinned: Array<{doorway, rule, why}>, outOfScope: Object<string,number>}}
 * @throws {Error} a Q5 STOP, naming every doorway no rule classifies
 */
export function classifySeedlingEntrances(atlas, { census, inScopeClasses, opposite }) {
    if (census.atlasId !== undefined && census.atlasId !== atlas.atlas_id) {
        throw new Error(`seedlingEntranceClassifier: the census was taken over ${census.atlasId}, not ${atlas.atlas_id}`);
    }
    const stops = [];
    for (const u of census.unclassified ?? []) stops.push(`${u.from.join('/')} -> ${u.to.join('/')}: ${u.why}`);
    const regionById = new Map(atlas.regions.map((r) => [r.region_id, r]));
    const exitOf = ([rid, eid]) => (regionById.get(rid)?.exits ?? []).find((e) => e.exit_id === eid) ?? null;
    const connFrom = new Map(atlas.vanilla_layout.connections.map((c) => [`${c.from[0]}/${c.from[1]}`, c]));

    const outOfScope = {};
    const inScope = [];
    for (const d of census.doorwayList) {
        if (inScopeClasses.includes(d.cls)) inScope.push(d);
        else outOfScope[d.cls] = (outOfScope[d.cls] ?? 0) + 1;
    }
    const byId = new Map(inScope.map((d) => [d.id, d]));
    const pinned = new Map();
    const pin = (doorway, rule, why) => { if (!pinned.has(doorway)) pinned.set(doorway, { doorway, rule, why }); };
    for (const p of census.pins ?? []) pin(p.doorway, p.rule, p.why);

    const rows = [];
    for (const d of inScope) {
        // C-ONE
        if (d.exits.length !== 1 || d.tiles.length !== 1) {
            stops.push(`${d.id}: a ${d.cls} doorway of ${d.exits.length} exit(s) / ${d.tiles.length} tile(s) — a stair is one (C-ONE)`);
            continue;
        }
        const from = doorwayEndpoint(d.id);
        const conn = connFrom.get(from.join('/'));
        if (!conn) { stops.push(`${d.id}: the atlas has no connection from it`); continue; }
        // C-PAIR
        const r = d.reverse ? byId.get(d.reverse) : null;
        const paired = r && r.cls === opposite[d.cls] && r.reverse === d.id;
        if (!paired) {
            if (!pinned.has(d.id)) stops.push(`${d.id}: no in-scope ${opposite[d.cls]} reverse naming it back (C-PAIR; E1 pairs it with ${q(d.reverse)})`);
            rows.push({ id: d.id, group: d.cls, type: 'two_way', from, arrival: null, reverse: null });
            continue;
        }
        // C-BESIDE
        const rconn = connFrom.get(doorwayEndpoint(r.id).join('/'));
        const arrival = rconn ? rconn.to : null;
        const own = exitOf(from);
        const beside = arrival ? exitOf(arrival) : null;
        if (!rconn || !beside) { stops.push(`${d.id}: its reverse ${r.id}'s connection lands on no atlas exit (C-BESIDE)`); continue; }
        if (arrival[0] !== from[0] || (beside.sub_region ?? null) !== (own.sub_region ?? null)) {
            stops.push(`${d.id}: the arrival beside it (${arrival.join('/')}, sub-region ${q(beside.sub_region ?? null)}) is not in its own `
                + `${from[0]} sub-region ${q(own.sub_region ?? null)} (C-BESIDE)`);
            continue;
        }
        rows.push({ id: d.id, group: d.cls, type: 'two_way', from, arrival, reverse: r.id, subRegion: own.sub_region ?? null });
    }
    // PIN-PERMISSIVE: a stair whose beside-arrival lands in an AT-RISK permissive binding's sub-region.
    for (const p of census.permissive ?? []) {
        if (!p.atRisk) continue;
        for (const row of rows) {
            if (row.arrival && row.from[0] === `level_${p.level}` && row.subRegion === p.subRegion) {
                pin(row.id, 'PIN-PERMISSIVE', `${p.binding} [${p.subRegion}] drops its approach cost (E1 (D) AT RISK); a stair landing in its sub-region keeps its vanilla arrival`);
            }
        }
    }
    // A pin takes its coupled reverse (Q2).
    for (const p of [...pinned.values()]) {
        const r = byId.get(p.doorway)?.reverse;
        if (r && byId.has(r)) pin(r, `${p.rule} (coupled)`, `the reverse of ${p.doorway} (Q2: a pair moves together)`);
    }
    if (stops.length) {
        throw new Error(`seedlingEntranceClassifier: Q5 STOP — ${stops.length} doorway(s) no stated rule classifies: ${stops.join('; ')}`);
    }
    const lookup = {};
    for (const cls of inScopeClasses) lookup[cls] = [opposite[cls]];
    return {
        atlasId: atlas.atlas_id,
        doorways: rows.map(({ subRegion, ...row }) => ({ ...row, pinned: pinned.has(row.id) })),
        target_group_lookup: lookup,
        pinned: [...pinned.values()].sort((a, b) => a.doorway.localeCompare(b.doorway)),
        outOfScope: Object.fromEntries(Object.entries(outOfScope).sort((a, b) => a[0].localeCompare(b[0]))),
    };
}
