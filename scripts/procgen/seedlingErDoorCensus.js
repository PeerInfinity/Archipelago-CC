/**
 * seedlingErDoorCensus — the pure half of `census-seedling-er-doorways.mjs` (ENTRANCE RANDOMIZATION E1,
 * the DOOR CENSUS): every doorway of the Seedling playthrough atlas, classified by a STATED rule; each
 * doorway's reverse derived from GAME DATA (`seedlingReturnSpawns.returnSpawnTable`) with a landing-distance
 * heuristic as a cross-check only; and, for the doorways a v1 STAIRS shuffle moves (⚖ user 2026-11-01: Q1
 * stairs only, Q2 coupled only, Q5 zero unclassified), every fact the shuffle would have to recompute.
 *
 * ⛔ IT IS A MEASUREMENT, NOT A GATE (the house census law): no I/O here; the CLI hands the documents in and
 * prints. `seedlingErDoorCensus.test.js` pins the counts on the committed atlas.
 *
 * ── THE UNIT ─────────────────────────────────────────────────────────────
 * A DOORWAY is the set of out-exits of ONE level that share a CLASS and a TARGET level and whose exit tiles
 * are 4-adjacent (union-find over the tiles). A screen edge is many one-tile teleporters and one doorway; a
 * stair is one tile and one doorway. The doorway is the unit of shuffling.
 *
 * ── THE CLASS RULES (every out-exit must match exactly one, or Q5 STOPS) ─────
 *   R-LINK    the exit id is `out_<type>_<x>_<y>` (`seedlingAtlasDerivation.outExitId`), and the map level holds
 *             an entity of that type at (x, y) whose type is a link tag (`LINK_TAGS`) and whose integer `@to` is
 *             the connection's target level. CLASS = the entity type: `stairsdown`, `stairsup`, `teleporter`.
 *             A teleporter whose tile lies on the level's outer tile ring is `teleporter/edge` (a screen edge),
 *             any other is `teleporter/door`.
 *   R-PIT     the exit id is `out_pit_<ax>_<ay>` (the derivation's pit spelling) and the level's `control`
 *             entity carries an integer `@fallthrough` (`seedlingAtlasDerivation.pitOf`). CLASS `pit`; when
 *             the target is not `@fallthrough` the fall CHAINS through a door (`seedlingPitChains`) and the
 *             class is `pit/chained`.
 *   R-WARP    the exit id is `out_<type>_<x>_<y>`, `<type>` is a `named_rooms` TRIGGER
 *             (`TRIGGER_FOR_NAMED_ROOM`), the map level holds that entity at (x, y), and the arrival exit is the
 *             manifest warp's (`in_<key>_L…`, `namedInExitId`). CLASS `warp` (a death/boss warp).
 *   Anything else is UNCLASSIFIED and is returned by name; the CLI prints a Q5 STOP.
 *
 * ── THE REVERSE RULES ─────────────────────────────────────────────────────
 *   GAME DATA  doorway D (A→B) has reverse E when, for a tile of D, `returnSpawnTable` names a link `via` in B
 *              whose `@to` is A and whose `(playerx, playery)` lands within MAX_RETURN_DISTANCE_TILES of D — and
 *              E is the doorway of B holding `out_<via.type>_<via.x>_<via.y>`. A doorway whose tiles name more
 *              than one E is AMBIGUOUS.
 *   ONE-WAY    a doorway with no game-data reverse is classified by why: `pit` and `warp` are one-way by
 *              construction (no link entity, nothing to reverse); a link with no reverse is "one-way by game
 *              data: no reverse link lands within MAX_RETURN_DISTANCE_TILES" (`one-way/far` when B holds a
 *              link back to A whose landing is further away, `one-way/none` when B holds no link to A at all).
 *   HEURISTIC  (cross-check only) E is a landing-heuristic reverse of D when E goes B→A and some tile of E lies
 *              within HEURISTIC_RADIUS_TILES (Chebyshev) of a landing tile of D. Disagreements are reported.
 */

/** The landing-heuristic radius, in tiles (Chebyshev). A cross-check, never the pairing. */
export const HEURISTIC_RADIUS_TILES = 3;

/** The doorway classes a v1 shuffle moves (⚖ user 2026-11-01, Q1: stairs only). */
export const IN_SCOPE_CLASSES = Object.freeze(['stairsdown', 'stairsup']);
/** A stair's coupled reverse is the opposite direction. */
export const OPPOSITE = Object.freeze({ stairsdown: 'stairsup', stairsup: 'stairsdown' });

const levelOfRegion = (id) => {
    const m = /^level_(\d+)$/.exec(id);
    return m ? Number(m[1]) : null;
};
/** `level_12__r0c37` → 12; `level_17` → 17. */
export const levelOfApRegion = (name) => {
    const m = /^level_(\d+)(?:__|$)/.exec(name);
    return m ? Number(m[1]) : null;
};
const cmpTile = (a, b) => (a[1] - b[1]) || (a[0] - b[0]);
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

/**
 * Classify one out-exit by the class rules above.
 * @returns {{cls: string, rule: string} | {cls: null, why: string}}
 */
export function classifyExit({ level, exit, conn, mapLevel, bounds, triggerKeys }) {
    const m = /^out_([a-z]+)_(-?\d+)_(-?\d+)$/.exec(exit.exit_id);
    const toLevel = levelOfRegion(conn.to[0]);
    if (!m) return { cls: null, why: `exit id ${exit.exit_id} is not out_<type>_<x>_<y>` };
    const [, type, xs, ys] = m;
    const x = Number(xs);
    const y = Number(ys);
    const entities = mapLevel?.entities ?? [];
    if (type === 'pit') {
        const control = entities.find((e) => e.type === 'control');
        const fall = Number(control?.attrs?.fallthrough);
        if (!Number.isInteger(fall)) return { cls: null, why: `L${level} ${exit.exit_id}: no control @fallthrough` };
        return fall === toLevel
            ? { cls: 'pit', rule: 'R-PIT' }
            : { cls: 'pit/chained', rule: 'R-PIT', fallthrough: fall };
    }
    const e = entities.find((en) => en.type === type && Number(en.x) === x && Number(en.y) === y);
    if (!e) return { cls: null, why: `L${level} ${exit.exit_id}: no ${type} entity at (${x}, ${y}) in the map` };
    if (triggerKeys[type]) {
        const key = triggerKeys[type];
        if (!conn.to[1].startsWith(`in_${key}_L${level}_`)) {
            return { cls: null, why: `L${level} ${exit.exit_id}: a ${type} trigger whose arrival ${conn.to[1]} is not the ${key} warp` };
        }
        return { cls: 'warp', rule: 'R-WARP', key };
    }
    if (!['teleporter', 'stairsup', 'stairsdown'].includes(type)) {
        return { cls: null, why: `L${level} ${exit.exit_id}: ${type} is neither a link tag nor a named-room trigger` };
    }
    if (Number(e.attrs?.to) !== toLevel) {
        return { cls: null, why: `L${level} ${exit.exit_id}: the entity's @to ${e.attrs?.to} is not the connection's L${toLevel}` };
    }
    if (type !== 'teleporter') return { cls: type, rule: 'R-LINK' };
    const [tx, ty] = exit.exit_tiles[0];
    const edge = tx === 0 || ty === 0 || tx === bounds.w - 1 || ty === bounds.h - 1;
    return { cls: edge ? 'teleporter/edge' : 'teleporter/door', rule: 'R-LINK' };
}

/** The coarse class GER / the brief speak in. */
export const kindOf = (cls) => (cls.startsWith('teleporter') ? 'teleporter' : cls.startsWith('pit') ? 'pit' : cls === 'warp' ? 'death' : cls);

/**
 * Merge the atlas's out-exits into doorways and classify each.
 * @param {object} atlas the playthrough atlas
 * @param {object} mapDoc the map document the atlas derives from (the DELIVERED/patched set)
 * @param {{triggerKeys: Object<string, string>}} o trigger entity type → named_rooms key
 */
export function doorwaysOf(atlas, mapDoc, { triggerKeys }) {
    const regionById = new Map(atlas.regions.map((r) => [r.region_id, r]));
    const exitOf = (rid, eid) => (regionById.get(rid)?.exits ?? []).find((e) => e.exit_id === eid);
    const mapLevelOf = new Map(mapDoc.levels.map((L) => [L.level, L]));
    const unclassified = [];
    const groups = new Map(); // `${level}|${cls}|${to}` -> [{exit, conn, landing}]
    for (const conn of atlas.vanilla_layout.connections) {
        const [rid, eid] = conn.from;
        const region = regionById.get(rid);
        const exit = exitOf(rid, eid);
        const level = region?.map_ref;
        if (!exit) { unclassified.push({ from: conn.from, to: conn.to, why: 'no such out-exit in the atlas' }); continue; }
        const verdict = classifyExit({
            level, exit, conn, mapLevel: mapLevelOf.get(level), bounds: region.bounds, triggerKeys,
        });
        if (!verdict.cls) { unclassified.push({ from: conn.from, to: conn.to, why: verdict.why }); continue; }
        const arrival = exitOf(conn.to[0], conn.to[1]);
        const to = levelOfRegion(conn.to[0]);
        const k = `${level}|${verdict.cls}|${to}`;
        if (!groups.has(k)) groups.set(k, { level, cls: verdict.cls, to, rows: [] });
        groups.get(k).rows.push({ exit, conn, arrival, verdict });
    }
    const doorways = [];
    for (const g of groups.values()) {
        // union-find over 4-adjacent tiles
        const parent = g.rows.map((_, i) => i);
        const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        for (let i = 0; i < g.rows.length; i += 1) {
            for (let j = i + 1; j < g.rows.length; j += 1) {
                const adj = g.rows[i].exit.exit_tiles.some((a) => g.rows[j].exit.exit_tiles
                    .some((b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 1));
                if (adj) parent[find(i)] = find(j);
            }
        }
        const parts = new Map();
        g.rows.forEach((row, i) => {
            const r = find(i);
            if (!parts.has(r)) parts.set(r, []);
            parts.get(r).push(row);
        });
        for (const rows of parts.values()) {
            const tiles = rows.flatMap((r) => r.exit.exit_tiles).sort(cmpTile);
            const landings = rows.map((r) => r.arrival?.entrance_tile).filter(Boolean).sort(cmpTile);
            const exits = rows.map((r) => r.exit.exit_id).sort();
            doorways.push({
                id: `L${g.level}:${exits[0]}${exits.length > 1 ? `+${exits.length - 1}` : ''}`,
                level: g.level, to: g.to, cls: g.cls, kind: kindOf(g.cls), rule: rows[0].verdict.rule,
                exits, tiles, landings,
                subRegions: [...new Set(rows.map((r) => r.exit.sub_region ?? null))].sort(),
                arrivals: rows.map((r) => ({ exit_id: r.conn.to[1], sub_region: r.arrival?.sub_region ?? null }))
                    .sort((a, b) => a.exit_id.localeCompare(b.exit_id)),
                ...(rows[0].verdict.fallthrough !== undefined ? { fallthrough: rows[0].verdict.fallthrough } : {}),
            });
        }
    }
    doorways.sort((a, b) => (a.level - b.level) || a.exits[0].localeCompare(b.exits[0]));
    return { doorways, unclassified };
}

/**
 * Derive every doorway's reverse (game data) and the heuristic cross-check.
 * @param {Array} doorways `doorwaysOf(...).doorways`
 * @param {Map} returnTable `returnSpawnTable(mapDoc)`
 * @param {object} mapDoc for the one-way sub-reasons
 * @param {(level, tx, ty) => string} returnKey
 */
export function pairDoorways(doorways, returnTable, mapDoc, returnKey) {
    const byExit = new Map();
    for (const d of doorways) for (const e of d.exits) byExit.set(`${d.level}|${e}`, d);
    const mapLevelOf = new Map(mapDoc.levels.map((L) => [L.level, L]));
    for (const d of doorways) {
        const named = new Set();
        for (const [tx, ty] of d.tiles) {
            const back = returnTable.get(returnKey(d.level, tx, ty));
            if (!back) continue;
            const e = byExit.get(`${back.via.level}|out_${back.via.type}_${back.via.x}_${back.via.y}`);
            named.add(e ? e.id : `UNWIRED:L${back.via.level}:${back.via.type}@${back.via.x},${back.via.y}`);
        }
        d.reverseGame = [...named].sort();
        const heur = doorways.filter((e) => e.level === d.to && e.to === d.level
            && e.tiles.some((t) => d.landings.some((l) => cheb(t, l) <= HEURISTIC_RADIUS_TILES)));
        d.reverseHeuristic = heur.map((e) => e.id).sort();
        if (d.reverseGame.length === 1) {
            d.pairing = 'game';
            d.reverse = d.reverseGame[0];
        } else if (d.reverseGame.length > 1) {
            d.pairing = 'AMBIGUOUS';
            d.reverse = null;
        } else {
            d.reverse = null;
            if (d.kind === 'pit') d.pairing = 'one-way/pit: a fall has no link entity to reverse';
            else if (d.kind === 'death') d.pairing = 'one-way/warp: a named-room warp has no link entity to reverse';
            else {
                const backLinks = (mapLevelOf.get(d.to)?.entities ?? [])
                    .filter((e) => ['teleporter', 'stairsup', 'stairsdown'].includes(e.type) && Number(e.attrs?.to) === d.level);
                d.pairing = backLinks.length
                    ? 'one-way/far: L<to> links back to L<level>, but no reverse link lands within MAX_RETURN_DISTANCE_TILES'
                    : 'one-way/none: L<to> holds no link back to L<level>';
            }
        }
    }
    const byId = new Map(doorways.map((d) => [d.id, d]));
    const disagreements = [];
    for (const d of doorways) {
        const g = d.reverseGame.join(',');
        const h = d.reverseHeuristic.join(',');
        if (g !== h) disagreements.push({ id: d.id, cls: d.cls, game: d.reverseGame, heuristic: d.reverseHeuristic });
        d.reverseIsMutual = d.reverse ? byId.get(d.reverse)?.reverse === d.id : null;
    }
    return { disagreements };
}

/** Q2/Q5: every in-scope doorway has exactly one game reverse, mutual, of the opposite stairs direction. */
export function stairsProof(doorways) {
    const byId = new Map(doorways.map((d) => [d.id, d]));
    const stairs = doorways.filter((d) => IN_SCOPE_CLASSES.includes(d.cls));
    const failures = [];
    for (const d of stairs) {
        const why = [];
        if (d.reverseGame.length !== 1) why.push(`${d.reverseGame.length} game-data reverses`);
        const r = d.reverse && byId.get(d.reverse);
        if (r && r.cls !== OPPOSITE[d.cls]) why.push(`reverse ${r.id} is ${r.cls}, not ${OPPOSITE[d.cls]}`);
        if (r && r.reverse !== d.id) why.push(`reverse ${r.id} does not pair back (its reverse: ${r.reverse})`);
        if (d.tiles.length !== 1) why.push(`${d.tiles.length} tiles (a stair is one)`);
        if (why.length) failures.push({ id: d.id, why });
    }
    const pairs = stairs.filter((d) => d.cls === 'stairsdown' && d.reverse).map((d) => [d.id, d.reverse]);
    return { stairs: stairs.length, down: stairs.filter((d) => d.cls === 'stairsdown').length,
        up: stairs.filter((d) => d.cls === 'stairsup').length, pairs, failures };
}

// ── rules helpers ─────────────────────────────────────────────────────────

const conjuncts = (rule) => (!rule ? [] : rule.rule === 'And' ? rule.children : [rule]);
const isTrue = (rule) => !rule || rule.rule === 'True_' || rule.rule === 'True';
/** Every item name a rule node names. */
export function itemsOf(node, out = new Set()) {
    if (!node || typeof node !== 'object') return out;
    const a = node.args ?? {};
    if (typeof a.item_name === 'string') out.add(a.item_name);
    for (const n of a.item_names ?? []) out.add(n);
    for (const c of node.children ?? []) itemsOf(c, out);
    return out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Does `own` already require `want` (equal, or a conjunct equal)? */
const implied = (own, want) => !!own && (same(own, want) || conjuncts(own).some((c) => same(c, want)));

/**
 * (B) — every gated AP exit carrying a STAIRS connection, its conjuncts classified by owner.
 *
 * OWNER RULES (per conjunct of the AP exit's rule):
 *   LANDING    it names an EVENT item (an AP_1 location with a null id holding it) OWNED by the LANDING
 *              level — a gate of the room the player lands in (a rope cut, a button barrier, an obstacle the
 *              landing sits in): under a shuffle it follows the LANDING (the target exit). An event's OWNER is
 *              the level of the persistence flag it clears when its name is an obstacle event's
 *              (`flagLevelOf`, the inverse of `seedlingObstacleEvents.obstacleEventName`), else the level its
 *              event location lies in. (A cross-room button's event location is the PRESSER's room, but the
 *              barrier it clears — the thing that cuts the landing — is in the flag's room.)
 *   DEPARTURE  it is the departure atlas exit's own `access_rule` (or a conjunct of it: the analyzer's
 *              in-room cost of reaching the door), or it names an event of the DEPARTURE level: it stays on
 *              the doorway under a shuffle.
 *   LANDING/terrain  it is neither, and the producer's lethal-landing pass gated this departure for that
 *              landing (`lethalGated` holds "<region>/<exit>"): the landing's terrain, follows the landing.
 *   UNATTRIBUTED anything else, named.
 */
export function stairsGates({ doorways, atlas, rules, lethalGated = new Set(), apRegionName, flagLevelOf = () => null }) {
    const regions = rules.regions?.['1'] ?? rules.regions;
    const eventLevel = new Map();
    for (const [name, r] of Object.entries(regions)) {
        for (const loc of r.locations ?? []) {
            if (loc.id === null || loc.id === undefined) {
                if (loc.item?.name) eventLevel.set(loc.item.name, flagLevelOf(loc.item.name) ?? levelOfApRegion(name));
            }
        }
    }
    const regionById = new Map(atlas.regions.map((r) => [r.region_id, r]));
    const exitOf = (rid, eid) => (regionById.get(rid)?.exits ?? []).find((e) => e.exit_id === eid);
    const conns = atlas.vanilla_layout.connections;
    // AP exit name -> doorway classes it carries
    const carried = new Map();
    const doorwayOfExit = new Map();
    for (const d of doorways) for (const e of d.exits) doorwayOfExit.set(`${d.level}|${e}`, d);
    for (const c of conns) {
        const fromExit = exitOf(c.from[0], c.from[1]);
        const toExit = exitOf(c.to[0], c.to[1]);
        const fromAp = apRegionName(c.from[0], fromExit?.sub_region ?? null);
        const toAp = apRegionName(c.to[0], toExit?.sub_region ?? null);
        const key = `${fromAp} -> ${toAp}`;
        const d = doorwayOfExit.get(`${regionById.get(c.from[0])?.map_ref}|${c.from[1]}`);
        if (!carried.has(key)) carried.set(key, []);
        carried.get(key).push({ conn: c, fromExit, doorway: d });
    }
    let crossLevel = 0;
    let gated = 0;
    let gatedLandingEvent = 0;
    let gatedLandingTerrain = 0;
    const stairsRows = [];
    const missing = [];
    for (const [name, r] of Object.entries(regions)) {
        for (const ex of r.exits ?? []) {
            const a = levelOfApRegion(name);
            const b = levelOfApRegion(ex.connected_region);
            if (a === null || b === null || a === b) continue;
            crossLevel += 1;
            const carry = carried.get(`${name} -> ${ex.connected_region}`) ?? [];
            const isGated = !isTrue(ex.access_rule);
            const owners = conjuncts(isGated ? ex.access_rule : null).map((c) => {
                const events = [...itemsOf(c)].filter((i) => eventLevel.has(i));
                if (events.some((i) => eventLevel.get(i) === b)) return { conjunct: c, owner: 'LANDING', events };
                if (carry.some((k) => implied(k.fromExit?.access_rule, c))) return { conjunct: c, owner: 'DEPARTURE', events };
                if (events.length && events.every((i) => eventLevel.get(i) === a)) return { conjunct: c, owner: 'DEPARTURE', events };
                if (carry.some((k) => lethalGated.has(`${k.conn.from[0]}/${k.conn.from[1]}`))) return { conjunct: c, owner: 'LANDING/terrain', events };
                return { conjunct: c, owner: 'UNATTRIBUTED', events };
            });
            if (isGated) {
                gated += 1;
                if (owners.some((o) => o.owner === 'LANDING')) gatedLandingEvent += 1;
                else if (owners.some((o) => o.owner === 'LANDING/terrain')) gatedLandingTerrain += 1;
            }
            const stairs = carry.filter((k) => k.doorway && IN_SCOPE_CLASSES.includes(k.doorway.cls));
            if (carry.length === 0) missing.push(`${name} -> ${ex.connected_region}`);
            if (isGated && stairs.length) {
                stairsRows.push({
                    apExit: `${name} -> ${ex.connected_region}`,
                    doorways: [...new Set(stairs.map((k) => k.doorway.id))].sort(),
                    sharedWith: [...new Set(carry.filter((k) => !stairs.includes(k)).map((k) => k.doorway?.id ?? `${k.conn.from}`))].sort(),
                    owners: owners.map((o) => ({ owner: o.owner, rule: o.conjunct, events: o.events })),
                });
            }
        }
    }
    stairsRows.sort((x, y) => x.apExit.localeCompare(y.apExit));
    return { crossLevel, gated, gatedLandingEvent, gatedLandingTerrain, stairsRows, apExitsWithNoConnection: missing.sort() };
}

/**
 * (A) — the producer's readers of the MAP's game links, found by SCANNING its source (never a hand list).
 *
 * SCAN RULE: a LINK READER is `gameLandings` / `returnSpawnTable` (they read `@to`/`@playerx`/`@playery`), or
 * any function the producer imports whose exported definition (in `moduleSources`) calls `gameLandings(` or
 * reads `playerx`. Every producer line that calls a reader, or names a top-level binding bound to a reader's
 * result, is a row, attributed to its enclosing top-level declaration.
 *
 * @param {string} source the producer's text
 * @param {Object<string, string>} moduleSources imported specifier (as written) → that module's text
 */
export function scanLinkReaders(source, moduleSources) {
    const readers = new Set(['gameLandings', 'returnSpawnTable']);
    // Every export of every module handed in, with its body (to the next top-level `export`).
    const bodies = new Map();
    const exportsOf = new Map();
    for (const [spec, text] of Object.entries(moduleSources)) {
        const names = [];
        for (const def of text.matchAll(/\nexport (?:async )?(?:function (\w+)\s*\(|const (\w+)\s*=)/g)) {
            const name = def[1] ?? def[2];
            const rest = text.slice(def.index + 1);
            const end = rest.slice(1).search(/\nexport /);
            // Code only: a comment that MENTIONS `playerx` is not a read of it.
            const code = (end < 0 ? rest : rest.slice(0, end + 1)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            bodies.set(name, (bodies.get(name) ?? '') + code);
            names.push(name);
        }
        exportsOf.set(spec, names);
    }
    // Fixpoint: an export that reads `playerx` or calls a reader is a reader (one module may call another's).
    for (let grew = true; grew;) {
        grew = false;
        for (const [name, body] of bodies) {
            if (readers.has(name)) continue;
            const calls = [...readers].some((r) => new RegExp(`\\b${r}\\(`).test(body));
            if (/playerx/.test(body) || calls) { readers.add(name); grew = true; }
        }
    }
    // Only the readers the producer IMPORTS can be called from it.
    const imported = new Set();
    for (const m of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+imp\('([^']+)'\)/g)) {
        for (const raw of m[1].split(',')) imported.add(raw.trim().split(/\s*:\s*/)[0].trim());
    }
    // A namespace import (`const OV = await imp('…')`) imports every export, called as `OV.<name>(`.
    for (const m of source.matchAll(/const\s+(\w+)\s*=\s*await\s+imp(?:ort)?\('([^']+)'\)/g)) {
        for (const n of exportsOf.get(m[2]) ?? []) imported.add(n);
    }
    // A destructured dynamic import of a sibling (`await import('./x.js')`).
    for (const m of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\('([^']+)'\)/g)) {
        for (const raw of m[1].split(',')) imported.add(raw.trim().split(/\s*:\s*/)[0].trim());
    }
    for (const r of [...readers]) if (!imported.has(r)) readers.delete(r);
    const lines = source.split('\n');
    const decls = [];
    lines.forEach((l, i) => {
        const m = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/.exec(l);
        if (m) decls.push({ line: i + 1, name: m[1] ?? m[2] });
    });
    const enclosing = (n) => [...decls].reverse().find((d) => d.line <= n)?.name ?? '(module)';
    const bound = new Map(); // top-level binding -> reader
    const rows = [];
    const callRe = new RegExp(`\\b(${[...readers].join('|')})\\(`, 'g');
    lines.forEach((l, i) => {
        if (/^\s*(\*|\/\/|\/\*)/.test(l)) return;
        if (/^const\s*\{/.test(l) || /await imp\(/.test(l)) return;
        for (const m of l.matchAll(callRe)) {
            const top = /^(?:export\s+)?const\s+(\w+)\s*=/.exec(l);
            if (top && enclosing(i + 1) === top[1]) bound.set(top[1], m[1]);
            rows.push({ line: i + 1, fn: enclosing(i + 1), reads: m[1], via: null, text: l.trim().slice(0, 140) });
        }
    });
    for (const [name, reader] of bound) {
        const re = new RegExp(`\\b${name}\\b`);
        lines.forEach((l, i) => {
            if (/^\s*(\*|\/\/)/.test(l) || !re.test(l)) return;
            if (enclosing(i + 1) === name) return;
            rows.push({ line: i + 1, fn: enclosing(i + 1), reads: reader, via: name, text: l.trim().slice(0, 140) });
        });
    }
    rows.sort((a, b) => a.line - b.line);
    return { readers: [...readers].sort(), rows };
}

/**
 * (A) part 2 — which reader rows read a STAIRS landing. `domains` maps a reader row's `fn` to the landings
 * it consumes (`{from, door, level}`, the `gameLandings` row shape) as the CLI measured them (keyed by `fn`,
 * else `reads:<reader>` for a reader whose domain is the same wherever it is called); a row with no domain is returned in `unmeasured` (named, never guessed).
 */
export function readerStairsExposure(scan, domains, stairsDoors) {
    const out = [];
    const unmeasured = [];
    for (const row of scan.rows) {
        const dom = domains[row.fn] ?? domains[`reads:${row.reads}`];
        if (!dom) { unmeasured.push(`${row.fn}:${row.line}`); continue; }
        const stairs = dom.landings.filter((L) => stairsDoors.has(`${L.from}|${L.door}`));
        out.push({ ...row, domain: dom.what, landings: dom.landings.length, stairsLandings: stairs.map((L) => `L${L.from} ${L.door} -> L${L.level}`).sort() });
    }
    return { rows: out, unmeasured: [...new Set(unmeasured)].sort() };
}

/**
 * The whole census.
 * @param {object} i inputs (see the CLI's `loadCensusInputs`)
 */
export function censusErDoorways(i) {
    const { doorways, unclassified } = doorwaysOf(i.atlas, i.mapDoc, { triggerKeys: i.triggerKeys });
    const { disagreements } = pairDoorways(doorways, i.returnTable, i.mapDoc, i.returnKey);
    const proof = stairsProof(doorways);
    const byId = new Map(doorways.map((d) => [d.id, d]));
    const stairs = doorways.filter((d) => IN_SCOPE_CLASSES.includes(d.cls));
    const stairsDoors = new Set(stairs.flatMap((d) => d.exits.map((e) => {
        const m = /^out_(\w+?)_(-?\d+)_(-?\d+)$/.exec(e);
        return `${d.level}|${m[1]}@${m[2]},${m[3]}`;
    })));
    const count = (key) => {
        const m = new Map();
        for (const d of doorways) m.set(d[key], (m.get(d[key]) ?? 0) + 1);
        return Object.fromEntries([...m].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    };
    const pairingCounts = count('pairing');

    // (A)
    const scan = i.producerSource ? scanLinkReaders(i.producerSource, i.moduleSources ?? {}) : null;
    const exposure = scan ? readerStairsExposure(scan, i.readerDomains ?? {}, stairsDoors) : null;
    // (B)
    const gates = i.rules ? stairsGates({ doorways, atlas: i.atlas, rules: i.rules, lethalGated: i.lethalGated, apRegionName: i.apRegionName, flagLevelOf: i.flagLevelOf }) : null;
    // (C) a stairs doorway a pit chain fires through
    const chains = (i.pitChains ?? []).map((c) => {
        const m = /^(\w+)@(-?\d+),(-?\d+)$/.exec(c.via);
        const fired = stairs.find((d) => d.level === c.landing.level
            && d.exits.some((e) => e.endsWith(`_${m[2]}_${m[3]}`) && (m[1] === 'stairs' ? /^out_stairs/.test(e) : e.startsWith(`out_${m[1]}_`))));
        const pit = doorways.find((d) => d.kind === 'pit' && d.level === c.from && d.to === c.ends.level);
        return { pit: pit?.id ?? `L${c.from} pit`, landsIn: c.landing.level, fires: c.via, stairsDoorway: fired?.id ?? null,
            stairsReverse: fired?.reverse ?? null, ends: c.ends };
    });
    // (D) permissive bindings in a level a stairs doorway lands in or leaves from
    const stairsLevels = new Map();
    for (const d of stairs) {
        for (const lv of [d.level, d.to]) {
            if (!stairsLevels.has(lv)) stairsLevels.set(lv, []);
            stairsLevels.get(lv).push(d.id);
        }
    }
    const regionById = new Map(i.atlas.regions.map((r) => [r.region_id, r]));
    const permissive = (i.permissiveBindings ?? []).map((b) => {
        const slash = b.indexOf('/');
        const rid = b.slice(0, slash);
        const id = b.slice(slash + 1);
        const lv = levelOfRegion(rid);
        const region = regionById.get(rid);
        const sub = (region?.exits ?? []).find((e) => e.exit_id === id)?.sub_region
            ?? (region?.locations ?? []).find((l) => l.name === id)?.sub_region ?? null;
        const touching = stairsLevels.get(lv) ?? [];
        const arrivals = stairs.filter((d) => d.to === lv);
        const intoSub = arrivals.filter((d) => d.arrivals.some((a) => a.sub_region === sub)).map((d) => d.id);
        const fromSub = stairs.filter((d) => d.level === lv && d.subRegions.includes(sub)).map((d) => d.id);
        return {
            binding: b, level: lv, subRegion: sub, stairsArriveInLevel: arrivals.map((d) => d.id).sort(),
            stairsArriveInSubRegion: intoSub.sort(), stairsLeaveSubRegion: fromSub.sort(),
            stairsTouch: [...new Set(touching)].sort(),
            atRisk: intoSub.length > 0,
        };
    }).sort((a, b) => (a.level - b.level) || a.binding.localeCompare(b.binding));
    // (E) start
    const startLevel = levelOfRegion(i.atlas.vanilla_layout.start_region);
    const startSub = i.atlas.vanilla_layout.start_sub_region ?? null;
    const startStairs = stairs.filter((d) => d.level === startLevel && d.subRegions.includes(startSub)).map((d) => d.id);
    const intoStart = stairs.filter((d) => d.to === startLevel && d.arrivals.some((a) => a.sub_region === startSub)).map((d) => d.id);
    // (F) entry-gate floors
    const floors = (i.entryGateLevels ?? []).slice().sort((a, b) => a - b);
    const intoFloors = stairs.filter((d) => floors.includes(d.to) || floors.includes(d.level)).map((d) => d.id);

    // PINS (design output): a stairs doorway a stated rule says cannot move in v1.
    const pins = [];
    for (const c of chains) {
        if (c.stairsDoorway) {
            pins.push({ doorway: c.stairsDoorway, rule: 'PIN-CHAIN', why: `the ${c.pit} fall lands in L${c.landsIn} and fires it mid-descent (${c.fires}); its destination is the pit's outcome` });
            if (c.stairsReverse) pins.push({ doorway: c.stairsReverse, rule: 'PIN-CHAIN (coupled)', why: `the reverse of ${c.stairsDoorway} (Q2: a pair moves together)` });
        }
    }
    for (const p of proof.failures) pins.push({ doorway: p.id, rule: 'PIN-UNPAIRED', why: p.why.join('; ') });

    return {
        atlasId: i.atlas.atlas_id,
        connections: i.atlas.vanilla_layout.connections.length,
        oneWayConnections: i.atlas.vanilla_layout.connections.filter((c) => c.one_way === true).length,
        doorways: doorways.length,
        byClass: count('cls'),
        byKind: count('kind'),
        byRule: count('rule'),
        pairingCounts,
        heuristicPaired: doorways.filter((d) => d.reverseHeuristic.length > 0).length,
        gamePaired: doorways.filter((d) => d.pairing === 'game').length,
        disagreements,
        unclassified,
        proof,
        oneWay: doorways.filter((d) => d.pairing !== 'game').map((d) => ({ id: d.id, cls: d.cls, to: d.to, pairing: d.pairing })),
        scan, exposure, gates, chains, permissive,
        start: { level: startLevel, subRegion: startSub, stairsInStartSubRegion: startStairs.sort(), stairsIntoStartSubRegion: intoStart.sort() },
        floors: { levels: floors, stairsDoorways: intoFloors.sort() },
        pins,
        doorwayList: doorways,
        byId,
    };
}
