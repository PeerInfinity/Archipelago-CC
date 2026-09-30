/**
 * seedlingBossLockCensus — the pure half of `census-seedling-bosslocks.mjs`
 * (SEEDLING SWIM T4, D2 / plan R-j).
 *
 * ── WHAT THE GAME SAYS ────────────────────────────────────────────────
 *
 * `BossLock.update` (`vendor/seedling/src/Puzzlements/BossLock.as:58-63`)
 * opens the lock only when the player is on the ONE-PIXEL ROW BELOW it:
 * `collideLine("Player", x - originX + m, y - originY + height + 1, …)`. So
 * the key opens the lock from its SOUTH side only. Once it is open the
 * persistence tag keeps it open (`Game.setPersistence(tag, false)`, then
 * `check()` removes it on every later entry). Every one of the 14 placements
 * carries a tag >= 0.
 *
 * Consequence for reachability: the crossing is exactly one-way.
 * - SOUTH -> NORTH holds under the key.
 * - NORTH -> SOUTH is never needed: if the south side is reachable at all, the
 *   player can open the lock from there, and the south side is already
 *   reached.
 *
 * A rule that crosses NORTH -> SOUTH on the key alone is therefore too
 * PERMISSIVE. It is the class `REFUTATION_LOG` entry 2 records: a wall the
 * analyzer could not see, so AP walked through it.
 *
 * ── WHAT THE ATLAS SAYS ───────────────────────────────────────────────
 *
 * `seedlingSemantics.ENTITY_SEMANTICS.bosslock` is `kind: 'gated'`, which the
 * analyzer pays in EITHER direction. For each lock, the census reads:
 * - the analyzer's component on each of the lock tile's four sides;
 * - the atlas's internal exit between the north and south components (its
 *   rule, and whether it is bidirectional);
 * - whether the north side has a way in that is not this lock (a boundary
 *   `in_*` exit bound to it, or another internal exit into it).
 *
 * ⛔ A MEASUREMENT, NOT A GATE. The census reports; it refuses nothing.
 */

const SIDES = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });

/** Every `item_name` a Rule Builder tree mentions. */
const itemNames = (rule) => (!rule ? [] : [
    ...(rule.args?.item_name ? [rule.args.item_name] : []),
    ...(rule.args?.item_names ?? []),
    ...(rule.children ?? []).flatMap(itemNames),
]);

/** The class-level probe side of each one-sided lock class, read off the AS3. */
export const LOCK_PROBE_SIDES = Object.freeze({
    // BossLock.as:61 — `y - originY + height + 1`: the row BELOW the lock.
    bosslock: 'S',
    // ShieldLock.as:32 — `collide("Player", x - 1, y)`: the lock's box moved one pixel
    // WEST, so the player on its west side. REPORTED only (these rows belong to T3/S1).
    shieldlock: 'W',
    shieldlocknorm: 'W',
});

/**
 * One row per placed lock of `tags` in `levels`.
 *
 * @param {object} p
 * @param {object[]} p.levels  map-extract level records (`seedling-map.json` `levels`)
 * @param {object} p.atlas     the committed playthrough atlas document
 * @param {(level:object) => object} p.gridFor  the generator's analyzer grid for one level
 * @param {(grid:object) => {components:object[], indexOf:Int32Array|number[]}} p.findComponents
 * @param {string[]} [p.tags]
 */
export function censusLocks({ levels, atlas, gridFor, findComponents, tags = ['bosslock'] }) {
    const regionsByLevel = new Map();
    for (const r of atlas.regions) {
        if (!regionsByLevel.has(r.map_ref)) regionsByLevel.set(r.map_ref, []);
        regionsByLevel.get(r.map_ref).push(r);
    }
    const rows = [];
    for (const level of [...levels].sort((a, b) => a.level - b.level)) {
        const locks = (level.entities ?? []).filter((e) => tags.includes(e.type));
        if (locks.length === 0) continue;
        const grid = gridFor(level);
        const { components, indexOf } = findComponents(grid);
        const region = (regionsByLevel.get(level.level) ?? [])[0] ?? null;
        const internal = region?.subgraph?.internal_exits ?? [];
        const subRegions = new Set(region?.subgraph?.sub_regions ?? []);
        for (const e of locks) {
            const probe = LOCK_PROBE_SIDES[e.type];
            const tile = [Math.floor(e.x / 16), Math.floor(e.y / 16)];
            const onGrid = e.x % 16 === 0 && e.y % 16 === 0;
            const cell = grid.cells[tile[1] * grid.width + tile[0]];
            const sides = {};
            for (const [d, [dx, dy]] of Object.entries(SIDES)) {
                const x = tile[0] + dx;
                const y = tile[1] + dy;
                if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) { sides[d] = 'edge'; continue; }
                const i = indexOf[y * grid.width + x];
                const c = grid.cells[y * grid.width + x];
                sides[d] = i >= 0 ? components[i].id : `(${c.kind})`;
            }
            // The FAR sides: every side (not the probe's) whose component is a different sub-region.
            const probeComp = sides[probe];
            const farDirs = Object.keys(SIDES).filter((d) => d !== probe && sides[d] !== probeComp
                && subRegions.has(sides[d]) && subRegions.has(probeComp));
            const farComps = [...new Set(farDirs.map((d) => sides[d]))];
            const farComp = farComps[0] ?? sides[{ S: 'N', N: 'S', W: 'E', E: 'W' }[probe]];
            const between = internal.filter((x) => (x.from === probeComp && farComps.includes(x.to))
                || (farComps.includes(x.from) && x.to === probeComp));
            const forward = between.find((x) => x.from === probeComp || x.bidirectional) ?? null;
            const edge = forward ?? between[0] ?? null;
            // Two-way means the far -> probe direction pays the LOCK: its rule names the key the
            // forward rule names. A reverse that pays something else (L12's water) is another way.
            const keys = itemNames(edge?.access_rule).filter((n) => / Key$/.test(n));
            const reverse = between.filter((x) => x.bidirectional || (farComps.includes(x.from) && x.to === probeComp));
            const twoWay = !!edge && reverse.some((x) => keys.some((k) => itemNames(x.access_rule).includes(k)));
            // Does the far side have a way in that is not this crossing? (A boundary `in_*` exit
            // bound to it, or another internal exit into it — one hop, not a reachability proof.)
            const farEntrances = (region?.exits ?? []).filter((x) => farComps.includes(x.sub_region) && /^in_/.test(x.exit_id))
                .map((x) => x.exit_id);
            const farOther = internal.filter((x) => x !== edge && ((farComps.includes(x.to) && x.from !== probeComp)
                || (x.bidirectional && farComps.includes(x.from) && x.to !== probeComp)))
                .map((x) => `${x.from}${x.bidirectional ? '<->' : '->'}${x.to}`);
            const material = Object.values(sides).filter((v) => /^\((?!wall)/.test(v));
            let verdict;
            if (!onGrid && cell?.kind !== 'gated') verdict = 'NOT-SEALED (off-grid: the lock claims no whole tile)';
            else if (farComps.length === 0) {
                verdict = material.length > 0
                    ? `NOT A SEPARATOR (no far sub-region beside it; crossing material ${material.join(' ')} beyond)`
                    : 'NOT A SEPARATOR (no far sub-region beside it)';
            } else if (!edge) verdict = 'NO EDGE (no internal exit between the probe side and the far side)';
            else if (!twoWay) verdict = 'AGREES (one-way, probe side -> far side)';
            else if (farEntrances.length > 0 || farOther.length > 0) verdict = 'DISAGREES — TWO-WAY, AND THE FAR SIDE HAS ITS OWN WAY IN';
            else verdict = 'DISAGREES — TWO-WAY, INERT (the far side is reached only through this lock)';
            rows.push({
                level: level.level,
                tag: e.type,
                at: `${e.x},${e.y}`,
                tile,
                keyType: e.attrs?.keyType !== undefined ? Number(e.attrs.keyType) : null,
                persistTag: e.attrs?.tag !== undefined ? Number(e.attrs.tag) : null,
                cellKind: cell?.kind ?? null,
                probe,
                sides,
                probeSide: probeComp,
                farSide: farComp,
                farDirs,
                rule: edge ? { from: edge.from, to: edge.to, bidirectional: !!edge.bidirectional, access_rule: edge.access_rule ?? null } : null,
                ruleDirections: edge ? (twoWay ? 'both' : `${probeComp}->${farComps.join('|')}`) : null,
                farEntrances,
                farOther,
                verdict,
            });
        }
    }
    return rows;
}

/** The counts the vitest row pins: verdict class -> n. */
export function censusCounts(rows) {
    const out = {};
    for (const r of rows) {
        const k = r.verdict.split(' ')[0] + (r.verdict.includes('OWN WAY IN') ? ':LIVE' : r.verdict.includes('INERT') ? ':INERT' : '');
        out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}
