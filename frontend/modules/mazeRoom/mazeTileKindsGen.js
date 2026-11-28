/**
 * mazeRoom/mazeTileKindsGen — **THE GENERATOR PLACES DECLARED TILE KINDS** (⛓ CONTENT SETS GEN-1: the "Randomly placed
 * tiles" biome, `mazeRegionBiomes.js` `scattered`; walkable and blocked kinds. ⛓ GEN-3: `needs` kinds. ⛓ GEN-4: `one-way`).
 *
 * ⚖ Robert, 2026-11-22: kinds qualify only with `generate: true` (Q3), only from the world's "what exists" packs, never
 * a theme (Q4), and placement must preserve the logic (Q5). Q6 (planner): walkable and blocked first.
 *
 * THE LAW. A kind is kept on a cell only if, with it lowered there (`mazeTileKinds.lowerTileKind`):
 *   (a) every floor cell reachable from the entrance before is still reachable (walls and ⛓ GEN-4 `gate: null` entry
 *       gates; obstacles transparent);
 *   (b) the region's compiled rules — `compileRegion(extractPathsAndObstacles(world))` — are byte-equal;
 *   (c) the walk is unchanged (`tileKindWalk`): `longestShortestPath` (the loop-mode cost per tile) in a room with no
 *       entry gate; ⛓ GEN-4 — with gates, the same measure in both directions through them, plus the pairs walkable
 *       one way only;
 *   (d) ⛓ GEN-3 — for a pass that says so (`needs`, ⛓ GEN-4 `one-way`), (b) holds from EVERY ARRIVAL TILE too (`arrivalTiles`: the exits a
 *       linked reverse exit lands on), each extracted as if it were the entrance. The extractor measures from the
 *       entrance only; a pool on a back exit's only corridor would strand a player who arrives there without the item.
 * ⛓ GEN-3 — for `needs`, (b) and (d) ask for EQUIVALENCE, not bytes (`equivalentRules`: `And`/`Or` flattened, `True_`
 * dropped from an `And`, children de-duplicated and sorted): a pool on a cell already behind a Swim gate compiles to
 * `And(Has Swim, Has Swim)`. The SHIPPED rules stay the pre-placement ones (the serializer never re-extracts).
 * What each pass is checked against is DATA (`TILE_KIND_PASS_LAWS`), not an if-chain.
 * A walkable kind changes no tile, so it holds the law by construction and is not re-checked. Under the law the
 * world's `rules.json` outside `preset_sidecars` does not move: no location, rule, sphere or loop cost.
 *
 * WHERE. Two wrappers on the registry entry (the `things` idiom, `mazeThings.js`), both outermost:
 *   · `tileKindsRegionCore(core)` — a region whose biome is a region biome gets its `base` handed to the engine, its
 *     own biome stamped back on the world, and (for a tile-placing biome) a position-less PLAN: the qualifying kinds,
 *     the numbers, and the region rng's state READ (never advanced);
 *   · `tileKindsSerializer(serialize)` — with a plan, the world is serialized once to seat its things, then the kinds
 *     are placed on a copy (avoiding the things' cells), and the copy is serialized. With no plan, or nothing placed,
 *     the inner serializer's output is returned as it is.
 * At serialize time every roll is spent (the content modules draw after the extraction), and the region's rules were
 * compiled before placement, so they cannot move. Only the generation path ever holds a plan: a world loaded from a
 * document has none, so a re-serialize (the APWorld editor, the round trip) places nothing.
 *
 * ⛔ NO RNG DRAW. Every choice is `hash32` (FNV-1a): the kind for slot i by `<rng state>:<region id>:kind:<i>`, the
 * cells for slot i ranked by `<rng state>:<region id>:<i>:<x>,<y>`.
 *
 * ⛔ OUTSIDE THE ENGINE CLOSURE: it only CALLS the engine (`extractPathsAndObstacles`).
 */
import { extractPathsAndObstacles, getTile, isFloor, TILE_FLOOR } from './mazeRoomEngine.js';
import { computeLongestShortestPath } from './mazeGeometry.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import {
    BLOCKED_PASS, DEFAULT_TERRAIN_PASS, NEEDS_PASS, ONE_WAY_PASS, liftTileKind, lowerTileKind, needsRealisationRefusal, occupiedWorldCells, tileKindRefusal,
} from './mazeTileKinds.js';
import { terrainGenerates, terrainOf } from '../packStructure/packStructure.js';
import { engineBiomeOf, isRegionBiome, nonDefaultTileKinds, placesTileKinds, resolvedTileKinds, TILE_KINDS_KEY } from './mazeRegionBiomes.js';
import { hash32 } from './mazeThings.js';

/** How a kept kind's compiled rules must compare with the room's before it (law b, and law d's arrivals). */
export const RULES_COMPARE = Object.freeze({ bytes: 'byte-equal', equivalent: 'equivalent' });

/**
 * ⛓ **WHAT THE LAW ASKS OF EACH PASS THE GENERATOR PLACES** (GEN-1 walkable + blocked; ⛓ GEN-3 needs; one-way is
 * GEN-4's row). `lowers`: the kind changes the grid or the obstacles, so the law is checked at all. `rules`: how law (b)
 * compares (`RULES_COMPARE`). `fromArrivals`: law (d), (b) repeated from every arrival tile. `qualify(kind, world)`: a
 * per-world refusal sentence, or null (a needs kind's item must be one this world realises).
 */
export const TILE_KIND_PASS_LAWS = Object.freeze({
    [DEFAULT_TERRAIN_PASS]: Object.freeze({ lowers: false }),
    [BLOCKED_PASS]: Object.freeze({ lowers: true, rules: RULES_COMPARE.bytes, fromArrivals: false }),
    [NEEDS_PASS]: Object.freeze({
        lowers: true, rules: RULES_COMPARE.equivalent, fromArrivals: true,
        qualify: (d, world) => needsRealisationRefusal(world, d.kind, d.needs),
    }),
    // ⛓ GEN-4 — a one-way kind owns its cell's entry gates (`lowerTileKind`: a `gate: null` entry for every direction
    //   not in its baked `dirs`). It adds no requirement, so (b) stays byte-equal; it can strand a way in, so (d).
    [ONE_WAY_PASS]: Object.freeze({ lowers: true, rules: RULES_COMPARE.bytes, fromArrivals: true }),
});
/** The passes the generator places (the keys of `TILE_KIND_PASS_LAWS`). */
export const GENERATED_TILE_KIND_PASSES = Object.freeze(Object.keys(TILE_KIND_PASS_LAWS));
/** How many ranked cells one slot tries before it is skipped (a slot with no legal cell is not a refusal). */
export const TILE_KIND_TRIES_PER_SLOT = 60;
/** The world field the plan rides on (never serialized: the engine's serializer copies named fields only). */
export const TILE_KIND_PLAN_FIELD = 'tileKindPlan';

export const TILE_KIND_GEN_REFUSALS = Object.freeze({
    noKinds: (biome, why) => `maze biome "${biome}" places tile kinds, but ${why}. Name a pack under "what exists" whose `
        + `terrain entries say generate: true (pass ${GENERATED_TILE_KIND_PASSES.join(', ')}), or pick another biome`,
});

/**
 * ⛓ **THE KINDS THIS WORLD'S GENERATOR MAY PLACE**, `[{kind, pass}]` in the content set's concept order: a pack
 * concept with a tile `base`, from a pack the world names under `exists` (`contentSet.structureIds`), presenting a
 * terrain entry that says `generate: true`, whose pass is one this slice places and whose look does not lie
 * (`tileKindRefusal`).
 */
export function generatedTileKinds(contentSet) {
    const structure = contentSet?.structure ?? null;
    const packs = new Set(contentSet?.structureIds ?? []);
    if (!structure || !packs.size) return [];
    const out = [];
    for (const key of contentSet.concepts?.keys() ?? []) {
        const c = contentSet.concepts.get(key);
        if (typeof c.base !== 'string' || !packs.has(c.pack) || !terrainGenerates(c, structure)) continue;
        const terrain = terrainOf(c, structure);
        if (!GENERATED_TILE_KIND_PASSES.includes(terrain.pass)) continue;
        if (tileKindRefusal(key, { [key]: { base: c.base, ...terrain } })) continue;
        out.push({ kind: key, ...terrain });
    }
    return out;
}

/**
 * ⛓ GEN-3 — **THE KINDS THIS REGION'S WORLD CAN REALISE**: `kinds` less those whose pass's `qualify` refuses them on
 * `world` (a needs kind whose item the world's item library does not hold: `needsRealisationRefusal`).
 */
export function realisableTileKinds(kinds, world) {
    return kinds.filter((d) => !TILE_KIND_PASS_LAWS[d.pass]?.qualify?.(d, world));
}

/**
 * ⛓ GEN-3 — **A RULE IN ITS EQUIVALENCE FORM**: `And` and `Or` flattened into themselves, `True_` dropped from an `And`
 * (an `And` of nothing is `True_`), children de-duplicated and sorted, a one-child `And`/`Or` replaced by its child.
 * Every step is a boolean identity (associativity, idempotence, commutativity, the unit), so two rules with one form
 * are equivalent. `And(Has Swim, Has Swim)` → `Has Swim`.
 */
export function equivalentRule(rule) {
    if (!rule || typeof rule !== 'object' || (rule.rule !== 'And' && rule.rule !== 'Or')) return rule;
    let kids = (rule.children ?? []).map(equivalentRule).flatMap((c) => (c?.rule === rule.rule ? c.children : [c]));
    if (rule.rule === 'And') kids = kids.filter((c) => c?.rule !== 'True_');
    const byKey = new Map(kids.map((c) => [JSON.stringify(c), c]));
    const sorted = [...byKey.keys()].sort().map((k) => byKey.get(k));
    if (!sorted.length) return rule.rule === 'And' ? { rule: 'True_' } : rule;
    return sorted.length === 1 ? sorted[0] : { rule: rule.rule, children: sorted };
}

/** A compiled region with every rule in its equivalence form (`equivalentRule`). */
export function equivalentRules(compiled) {
    return {
        ...compiled,
        exits: compiled.exits.map((e) => ({ ...e, rule: equivalentRule(e.rule) })),
        locations: compiled.locations.map((l) => ({ ...l, rule: equivalentRule(l.rule) })),
    };
}

/** The region's compiled rules, from `entrance` (default: the world's), as one string in the `compare` form (law b). */
const compiledRules = (world, regionId, compare = RULES_COMPARE.bytes, entrance = null) => {
    const compiled = compileRegion(extractPathsAndObstacles(entrance ? { ...world, entrance } : world, { regionId }),
        { obstacleLib: world.obstacleLib });
    return JSON.stringify(compare === RULES_COMPARE.equivalent ? equivalentRules(compiled) : compiled);
};

/**
 * ⛓ GEN-3 — **THE ARRIVAL TILES** (law d): where a player can land in this room other than its entrance, `[{x, y}]`.
 * In a world that links reverse exits (any exit carries `targetExitId`), every linked exit: its reverse lands on it
 * (`mazeArrival.resolveMazeArrival`'s first arm). In a world that links none (the spiral), every exit with a target
 * region: the arrival's `source_region` arm lands on such an exit (a world later stamped `arrival: 'zone'` lands on the
 * entrance instead, so this is the conservative side). A room whose payload already says `arrival: 'zone'`: none.
 * The entrance itself is left out (law b measures it).
 */
export function arrivalTiles(world) {
    if (world?.arrival === 'zone' || !world?.exits?.values) return [];
    const exits = [...world.exits.values()];
    const linked = exits.some((e) => e?.targetExitId);
    const seen = new Set([`${world.entrance.x},${world.entrance.y}`]);
    const out = [];
    for (const e of exits) {
        if (!(linked ? e?.targetExitId : e?.targetRegion)) continue;
        const k = `${e.x},${e.y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ x: e.x, y: e.y });
    }
    return out;
}

/** The four moves, each by the direction it ENTERS the next cell moving (an entry gate's key, `TERRAIN_DIRS`). */
const MOVES = Object.freeze([['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]);
/** ⛓ GEN-4 — entering (x, y) moving `dir` is refused by a `gate: null` entry (a one-way kind's; `mazeRoomEngine`'s
 *  `step` reads the same key). A gate with an id is a clearance, transparent here as an obstacle is. */
const entryShut = (world, x, y, dir) => world.entryGates?.has(`${x},${y},${dir}`) === true
    && world.entryGates.get(`${x},${y},${dir}`) === null;

/** Floor cells reachable from the entrance over the grid and its `null` entry gates (law a; GEN-D § 2.4). */
function floorReach(world) {
    const start = `${world.entrance.x},${world.entrance.y}`;
    const seen = new Set([start]);
    const queue = [[world.entrance.x, world.entrance.y]];
    while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dir, dx, dy] of MOVES) {
            const nx = x + dx;
            const ny = y + dy;
            const k = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height || seen.has(k)) continue;
            if (getTile(world, nx, ny) !== TILE_FLOOR || entryShut(world, nx, ny, dir)) continue;
            seen.add(k);
            queue.push([nx, ny]);
        }
    }
    return seen;
}

/** The directed walk from `from` to `to` over floor and `null` entry gates, in steps; null when there is none. */
function directedWalk(world, from, to) {
    if (!isFloor(world, from.x, from.y) || !isFloor(world, to.x, to.y)) return null;
    if (from.x === to.x && from.y === to.y) return 0;
    const seen = new Set([`${from.x},${from.y}`]);
    let frontier = [[from.x, from.y]];
    for (let d = 1; frontier.length; d++) {
        const next = [];
        for (const [x, y] of frontier) {
            for (const [dir, dx, dy] of MOVES) {
                const nx = x + dx;
                const ny = y + dy;
                const k = `${nx},${ny}`;
                if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height || seen.has(k)) continue;
                if (!isFloor(world, nx, ny) || entryShut(world, nx, ny, dir)) continue;
                if (nx === to.x && ny === to.y) return d;
                seen.add(k);
                next.push([nx, ny]);
            }
        }
        frontier = next;
    }
    return null;
}

/**
 * ⛓ GEN-4 — **THE WALK (law c)**, `{ length, oneWayPairs }`. With no entry gate on the room, `length` is
 * `computeLongestShortestPath` exactly as GEN-1 measured it (the loop-mode cost's denominator, the payload's
 * `longestShortestPath`) and `oneWayPairs` is 0 (an undirected grid has none). With entry gates, `length` is the same
 * longest shortest path between the entrance and the exits, but measured in BOTH directions of every pair and through
 * the gates, and `oneWayPairs` counts the pairs walkable one way only: `computeLongestShortestPath` is undirected and
 * blind to the gates, so a ledge that forces a detour, or that makes a pair one-way (an unwalkable pair is skipped by
 * the length), would otherwise never move it. Held equal, the payload's recorded value stays the true walk.
 */
export function tileKindWalk(world) {
    if (!world?.entryGates?.size) return { length: computeLongestShortestPath(world), oneWayPairs: 0 };
    const ends = [];
    const add = (p) => { if (!ends.some((q) => q.x === p.x && q.y === p.y)) ends.push({ x: p.x, y: p.y }); };
    if (world.entrance) add(world.entrance);
    for (const e of world.exits?.values?.() ?? []) add(e);
    if (ends.length < 2) return { length: 1, oneWayPairs: 0 };
    let longest = 0;
    let oneWayPairs = 0;
    for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) {
            const there = directedWalk(world, ends[i], ends[j]);
            const back = directedWalk(world, ends[j], ends[i]);
            if ((there === null) !== (back === null)) oneWayPairs++;
            for (const len of [there, back]) if (len !== null && len > longest) longest = len;
        }
    }
    return { length: longest > 0 ? longest : 1, oneWayPairs };
}

/** The walk's length alone (`tileKindWalk`). */
export const tileKindWalkLength = (world) => tileKindWalk(world).length;

/** The law's three refusals, by name (`tileKindLawRefusal`). */
export const TILE_KIND_LAW = Object.freeze({
    cutsOffFloor: 'cuts-off-floor',
    movesWalkLength: 'moves-walk-length',
    changesRules: 'changes-rules',
    strandsArrival: 'strands-arrival',
});

/**
 * The world's law baseline before a kind is tried: its floor reach, walk length, and compiled rules in each form the
 * plan's passes compare by (`rules[compare]`), plus each arrival tile's (`arrivals[compare]`) when a pass asks for (d).
 * `passes` defaults to every pass the generator places.
 */
export function tileKindLawBase(world, regionId, passes = GENERATED_TILE_KIND_PASSES) {
    const laws = passes.map((p) => TILE_KIND_PASS_LAWS[p]).filter((l) => l?.lowers);
    const rules = {};
    const arrivals = {};
    const tiles = laws.some((l) => l.fromArrivals) ? arrivalTiles(world) : [];
    for (const l of laws) {
        rules[l.rules] ??= compiledRules(world, regionId, l.rules);
        if (l.fromArrivals) arrivals[l.rules] ??= tiles.map((at) => ({ at, rules: compiledRules(world, regionId, l.rules, at) }));
    }
    return { reach: floorReach(world), walk: tileKindWalk(world), rules, arrivals };
}

/**
 * ⛓ **THE LAW, FOR ONE CELL** — with kind `d` lowered on (x, y), the first law it breaks (`TILE_KIND_LAW`), or null.
 * `world` is left with the kind lowered either way: the caller lifts it on a refusal. `base` is
 * `tileKindLawBase(world)` from before the kind was lowered.
 */
export function tileKindLawRefusal(world, x, y, d, regionId, base) {
    const law = TILE_KIND_PASS_LAWS[d.pass];
    if (!law) throw new Error(`tileKindLawRefusal: the generator places no "${d.pass}" kind (${GENERATED_TILE_KIND_PASSES.join(', ')})`);
    lowerTileKind(world, x, y, d);
    if (!law.lowers) return null;
    // The kind's own cell is exempt only when it lowered to a wall (a pillar); a kind that keeps it floor must stay
    // reachable itself (⛓ GEN-4: a ledge no move can enter would be a wall that looks like a ledge).
    const own = getTile(world, x, y) === TILE_FLOOR ? null : `${x},${y}`;
    const after = floorReach(world);
    for (const c of base.reach) if (c !== own && !after.has(c)) return TILE_KIND_LAW.cutsOffFloor;
    const walk = tileKindWalk(world);
    if (walk.length !== base.walk.length || walk.oneWayPairs !== base.walk.oneWayPairs) return TILE_KIND_LAW.movesWalkLength;
    if (compiledRules(world, regionId, law.rules) !== base.rules[law.rules]) return TILE_KIND_LAW.changesRules;
    if (law.fromArrivals) {
        for (const a of base.arrivals[law.rules]) {
            if (compiledRules(world, regionId, law.rules, a.at) !== a.rules) return TILE_KIND_LAW.strandsArrival;
        }
    }
    return null;
}

/** How many kinds a room with `free` free cells gets: `min(cap, max(min, round(percent × free / 100)))`, 0 with none. */
export function tileKindSlotCount(free, { percent, cap, min }) {
    if (free <= 0) return 0;
    return Math.min(cap, Math.max(min, Math.round((percent * free) / 100)));
}

/**
 * ⛓ **PLACE THE PLAN'S KINDS ON `world`** (mutated: lowered cells, `world.tileKinds`). Returns
 * `{ slots, placed, skipped, tries }`.
 */
export function placeTileKinds(world, plan, regionId) {
    const stats = { slots: 0, placed: 0, skipped: 0, tries: 0 };
    if (!plan?.kinds?.length) return stats;
    if (!(world.tileKinds instanceof Map)) world.tileKinds = new Map();
    const occupied = occupiedWorldCells(world);
    const free = [];
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            const k = `${x},${y}`;
            if (getTile(world, x, y) === TILE_FLOOR && !occupied.has(k) && !world.tileKinds.has(k)) free.push([x, y]);
        }
    }
    stats.slots = tileKindSlotCount(free.length, plan.numbers);
    if (!stats.slots) return stats;
    const seed = `${plan.seedKey}:${regionId ?? ''}`;
    const passes = [...new Set(plan.kinds.map((d) => d.pass))];
    let base = null;
    for (let i = 0; i < stats.slots; i++) {
        const ranked = free.filter(([x, y]) => !world.tileKinds.has(`${x},${y}`))
            .map(([x, y]) => [hash32(`${seed}:${i}:${x},${y}`), x, y])
            .sort((a, b) => a[0] - b[0])
            .slice(0, TILE_KIND_TRIES_PER_SLOT);
        // The slot's kind is the hash's; when that kind finds no legal cell (a pillar in a corridor room), the next
        // kinds in the plan's order are tried in turn, so a room that can hold a rug gets one.
        const first = hash32(`${seed}:kind:${i}`) % plan.kinds.length;
        let kept = false;
        for (let j = 0; j < plan.kinds.length && !kept; j++) {
            const d = plan.kinds[(first + j) % plan.kinds.length];
            for (const [, x, y] of ranked) {
                stats.tries++;
                if (!TILE_KIND_PASS_LAWS[d.pass]?.lowers) {
                    // A walkable kind writes no tile: the law holds by construction.
                    kept = true;
                } else {
                    // Each check is against the world as it now stands (a kept pillar is a wall the next baseline
                    // sees); the law holds for each placement in turn, so it holds for all of them.
                    base ??= tileKindLawBase(world, regionId, passes);
                    kept = !tileKindLawRefusal(world, x, y, d, regionId, base);
                    if (kept) base = null;
                    else liftTileKind(world, x, y);
                }
                if (kept) {
                    world.tileKinds.set(`${x},${y}`, d.kind);
                    break;
                }
            }
        }
        if (kept) stats.placed++;
        else stats.skipped++;
    }
    return stats;
}

/**
 * ⛓ **THE REGISTRY ENTRY'S `generateRegionCore`, OUTERMOST.** A biome reference that is not a region biome passes
 * through untouched (every committed world). A region biome: the engine builds its `base`; the world and the result
 * carry the region biome's stamp (`{id}`, plus `tileKinds` when its numbers are not the biome's own); a tile-placing
 * biome records the plan, refused by name when the world offers no kind to place.
 */
export const tileKindsRegionCore = (core) => (input = {}) => {
    const ref = input.biome ?? null;
    if (!ref || !isRegionBiome(ref.id)) return core(input);
    const state = typeof input.rng?.getState === 'function' ? input.rng.getState() : 0;
    const numbers = resolvedTileKinds(ref, input.params?.[TILE_KINDS_KEY] ?? null);
    let kinds = null;
    if (placesTileKinds(ref.id)) {
        kinds = generatedTileKinds(input.params?.contentSet);
        if (!kinds.length) {
            const why = input.params?.contentSet?.structureIds?.length
                ? `none of its "what exists" packs (${input.params.contentSet.structureIds.join(', ')}) offers a kind with generate: true and pass ${GENERATED_TILE_KIND_PASSES.join(' or ')}`
                : 'the world names no pack under "what exists"';
            throw new Error(TILE_KIND_GEN_REFUSALS.noKinds(ref.id, why));
        }
    }
    const out = core({ ...input, biome: engineBiomeOf(ref) });
    const diff = nonDefaultTileKinds(ref.id, numbers);
    const stamp = {
        id: ref.id,
        ...(ref.paramsOverride ? { paramsOverride: ref.paramsOverride } : {}),
        ...(diff ? { [TILE_KINDS_KEY]: diff } : {}),
    };
    if (out?.world) {
        out.world.biome = stamp;
        // ⛓ GEN-3 — a needs kind qualifies only where this region's world realises its item (its item library).
        if (kinds) out.world[TILE_KIND_PLAN_FIELD] = { seedKey: state, kinds: realisableTileKinds(kinds, out.world), numbers };
    }
    if (out && 'biome' in out) out.biome = stamp;
    return out;
};

/**
 * ⛓ **THE REGISTRY ENTRY'S `serializeWorld`, OUTERMOST.** No plan ⇒ the inner serializer, untouched. A plan ⇒ the
 * world serialized once (its things seated), the kinds placed on a copy that keeps those things where they are, and
 * the copy serialized; with no kind placed, the first output is returned.
 */
export const tileKindsSerializer = (serialize) => (world, extractedRules, ...rest) => {
    const plan = world?.[TILE_KIND_PLAN_FIELD];
    if (!plan) return serialize(world, extractedRules, ...rest);
    const first = serialize(world, extractedRules, ...rest);
    // ⛓ GEN-3 — a needs kind places an obstacle: the copy gets its own obstacles Map (its obstacleLib is replaced
    //   copy-on-write by `lowerTileKind`), so the world itself is never touched.
    const copy = { ...world, tiles: world.tiles.slice(), tileKinds: new Map(), obstacles: new Map(world.obstacles ?? []) };
    delete copy[TILE_KIND_PLAN_FIELD];
    if (Array.isArray(first.things)) copy.things = JSON.parse(JSON.stringify(first.things));
    const stats = placeTileKinds(copy, plan, extractedRules?.region_id);
    if (!stats.placed) return first;
    return serialize(copy, extractedRules, ...rest);
};
