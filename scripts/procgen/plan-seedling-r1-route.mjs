#!/usr/bin/env node
/**
 * plan-seedling-r1-route — compute the R1 full-walk route and write it to
 * `frontend/modules/seedlingDemo/fixtures/r1-route.json`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R1, slice 4. Brief:
 * `CC/docs/plans/seedling-bot-r1-opus-kickoff.md` §3.3 and §8.7.
 *
 * ── What this is, and what it is NOT ──────────────────────────────────
 * This is ROUTE AUTHORING. It gates nothing. Its output — the leg list —
 * is committed, reviewed and then consumed by the driver, the fixtures and
 * the verify script; from that point on the ROUTE is the artifact and this
 * script is how it was arrived at, exactly as `--record` is how an oracle
 * recording was arrived at. Re-running it is how you re-author the route
 * after a geometry or pricing change, and the diff it produces is the
 * review surface.
 *
 * It shares the shipped planner's geometry deliberately —
 * `plannerObstacleAt` under the same `relax` the tapes declare — so a route
 * it emits is a route the driver can actually walk. That is NOT a
 * verifier-shared-assumption problem, because this makes no claim: the
 * driver re-plans every leg from scratch and THROWS if the geometry
 * disagrees, and the game then answers with its own observation stream.
 *
 * ── ⚠ LEVELS ARE NOT NODES ────────────────────────────────────────────
 * The search runs over `(level, component)` pairs, where a component is a
 * 4-connected blob of tiles whose CENTRE the player box fits at with every
 * R1 obstacle priced — solids, pixelmasks, unmodelled terrain, pit tiles,
 * live trigger volumes, pickups and proximity hazards.
 *
 * Two levels on the route have their exits in different components (L65's
 * columns 3 and 7 are pit in every row; L60/L63 likewise), so a level-graph
 * BFS picks a trigger that arrives in the wrong half and the walk is
 * stranded with nothing wrong in the code. And L84 has no walkable
 * component AT ALL — the 83 ⇓ 84 arrival lands in the centre of a 3x3 block
 * of pits — so a router that demanded one reports darkshield and darksuit
 * unreachable. Both are the maze bot's `(region, arrival-exit)` lesson
 * arriving on the real map.
 *
 * The first cut of this search kept the node id in an edge record whose
 * label ALSO carried a `to` field — the destination LEVEL — and the spread
 * that merged them silently overwrote the node with the level number. Every
 * subsequent lookup then compared a `"10:0"` against a `10` and found
 * nothing, which presents as "NO PATH to L10" from a graph that has one.
 * Node ids are strings and destinations are named `toLevel` here for that
 * reason.
 *
 * Run: node scripts/procgen/plan-seedling-r1-route.mjs [--write] [--verbose]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, RELAXED_ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { contactKey, contactsAt, plannerObstacleAt, tileCentre } =
    await import(join(MODULE, 'botDriverV2.js'));
const {
    R1_BOOT, R1_ITEM_ROOMS, R1_NO_HAZARDS, R1_PERSISTENCE_EFFECTS,
    R1_SEGMENT_BOUNDARIES,
} = await import(join(MODULE, 'r1Walk.js'));

const WRITE = process.argv.includes('--write');
const VERBOSE = process.argv.includes('--verbose');
const OUT = join(MODULE, 'fixtures', 'r1-route.json');

/** The plan half of `relax`, exactly as `synthesizeLegs` derives it. */
const PLAN = { noclip: true, noHazards: R1_NO_HAZARDS, avoidVolumes: true };

const source = atlasLevelSource();
const worlds = new Map();
const unbuildable = new Map();
function worldFor(level) {
    if (worlds.has(level)) return worlds.get(level);
    let world = null;
    try {
        world = buildLevelWorld(source(level), { roles: RELAXED_ROLES });
    } catch (e) {
        unbuildable.set(level, e.message);
    }
    worlds.set(level, world);
    return world;
}

/** Is the player box clear at this tile's centre, with nothing exempted? */
function freeTile(world, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return false;
    const c = tileCentre(tx, ty);
    try {
        return plannerObstacleAt(world, c.x, c.y, null, PLAN) === null;
    } catch {
        // `plannerBlockerAt` never throws; a pixelmask probe can. Treat an
        // unmodellable tile as blocked — this is authoring, and the driver
        // is what turns a wrong answer here into a red.
        return false;
    }
}

const componentsCache = new Map();
/** `Map<"tx,ty", componentId>` for one level, 4-connected. */
function componentsOf(level) {
    if (componentsCache.has(level)) return componentsCache.get(level);
    const world = worldFor(level);
    const map = new Map();
    if (!world) { componentsCache.set(level, map); return map; }
    let next = 0;
    for (let ty = 0; ty < world.height; ty++) {
        for (let tx = 0; tx < world.width; tx++) {
            if (map.has(`${tx},${ty}`) || !freeTile(world, tx, ty)) continue;
            const id = next++;
            const queue = [[tx, ty]];
            map.set(`${tx},${ty}`, id);
            while (queue.length > 0) {
                const [ux, uy] = queue.pop();
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const key = `${ux + dx},${uy + dy}`;
                    if (map.has(key) || !freeTile(world, ux + dx, uy + dy)) continue;
                    map.set(key, id);
                    queue.push([ux + dx, uy + dy]);
                }
            }
        }
    }
    componentsCache.set(level, map);
    return map;
}

/**
 * The component a PIXEL position stands in, following the FORCED-CONTACT
 * rule: an arrival tile blocked ONLY by trigger volumes and avoid volumes
 * is still standable — the game put the player there — and belongs to the
 * component it can step off into.
 *
 * Everything else (a pit, unmodelled terrain, out of bounds) genuinely
 * cannot be stood on, and the edge is dropped.
 */
function resolveStanding(level, x, y) {
    const world = worldFor(level);
    if (!world) return null;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return null;
    const direct = componentsOf(level).get(`${tx},${ty}`);
    if (direct !== undefined) return { component: direct, contacts: [] };

    const contacts = new Set();
    for (;;) {
        let o;
        try {
            o = plannerObstacleAt(world, x, y, null, { ...PLAN, contacts });
        } catch { return null; }
        if (!o) break;
        if (!['teleporter', 'pickup', 'proximity-hazard'].includes(o.kind)) return null;
        const key = contactKey(o);
        if (contacts.has(key)) return null;
        contacts.add(key);
    }
    // Stepping OFF is the whole of the policy, so the arrival belongs to
    // whatever it can step into. More than one adjacent component would be
    // genuinely ambiguous; the lowest is deterministic and the driver's A*
    // is what finds out if the wrong one was picked.
    const ids = componentsTouching(level, tx, ty);
    if (ids.length === 0) return null;
    return { component: Math.min(...ids), contacts: [...contacts] };
}

/** The component a PIXEL position stands in, or null. */
function componentAt(level, x, y) {
    const s = resolveStanding(level, x, y);
    return s === null ? null : s.component;
}

/** The components a tile is 4-adjacent to — how an exit is entered. */
function componentsTouching(level, tx, ty) {
    const map = componentsOf(level);
    const ids = new Set();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const id = map.get(`${tx + dx},${ty + dy}`);
        if (id !== undefined) ids.add(id);
    }
    return [...ids];
}

/** Where a pit tile of `world` drops the player, as GAME CONSTRUCTOR args. */
function fallCtor(world, tile) {
    const ft = world.fallthrough;
    if (!ft) return null;
    const centreX = tile.tx * TILE_SIZE + TILE_SIZE / 2;
    const centreY = tile.ty * TILE_SIZE + TILE_SIZE / 2;
    return {
        level: ft.level,
        x: Math.floor(Math.max(centreX - ft.offsetX, 0) / TILE_SIZE) * TILE_SIZE,
        y: Math.floor(Math.max(centreY - ft.offsetY, 0) / TILE_SIZE) * TILE_SIZE,
    };
}

/**
 * Resolve an arrival to the `(level, component)` it leaves the player in,
 * following PASS-THROUGHS.
 *
 * An arrival that lands on a pit tile never yields control: the descent
 * ends there, the next tick's state edge fires and the fall chains onward.
 * `through` collects those intermediate levels with the pit tile each one
 * falls down, because the leg list needs a leg for every one of them.
 */
function resolveArrival(level, ctorX, ctorY, through = [], seen = new Set()) {
    const world = worldFor(level);
    if (!world) return null;
    const x = ctorX + TILE_SIZE / 2;
    const y = ctorY + TILE_SIZE / 2;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    const pit = world.pitTiles.find((t) => t.tx === tx && t.ty === ty);
    if (pit) {
        // A pit landing with no control block is `die()`, and a level that
        // falls into itself would be a loop this search must not walk.
        if (seen.has(level)) return null;
        seen.add(level);
        const ctor = fallCtor(world, pit);
        if (!ctor) return null;
        through.push({
            level, pit: { tx, ty }, boot: { level, x: ctorX, y: ctorY },
        });
        return resolveArrival(ctor.level, ctor.x, ctor.y, through, seen);
    }
    const component = componentAt(level, x, y);
    if (component === null) return null;
    return {
        level,
        component,
        node: `${level}:${component}`,
        through,
        boot: { level, x: ctorX, y: ctorY },
    };
}

// ── the (level, component) graph ──────────────────────────────────────
/** `Map<nodeId, Array<edge>>`; an edge's `to` is a NODE ID, never a level. */
const edges = new Map();
const addEdge = (from, edge) => {
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from).push(edge);
};

const pitTriggers = [];
const DROPS = process.argv.includes('--drops');
const drops = [];
/** Why an arrival tile is not steppable — for `--drops`. */
function arrivalBlocker(level, ctorX, ctorY) {
    const world = worldFor(level);
    if (!world) return `L${level} does not build`;
    const x = ctorX + TILE_SIZE / 2;
    const y = ctorY + TILE_SIZE / 2;
    let o = null;
    try { o = plannerObstacleAt(world, x, y, null, PLAN); } catch (e) { return `throw: ${e.message}`; }
    if (!o) return 'nothing (the component lookup itself failed)';
    return `${o.kind} ${o.blocker?.tag ?? o.blocker?.name ?? o.blocker?.cls?.as3 ?? '?'} `
        + `at (${o.blocker?.x ?? o.blocker?.tx},${o.blocker?.y ?? o.blocker?.ty})`;
}

const LEVEL_COUNT = 116;
for (let level = 0; level < LEVEL_COUNT; level++) {
    const world = worldFor(level);
    if (!world) continue;
    for (const tp of world.teleporters) {
        if (tp.deactivated) continue;
        // ⚠ A TRIGGER TILE THAT IS ALSO A PIT TILE IS NOT AN EXIT. Walking
        // into it fires the teleporter (from the position the previous tick
        // left) AND the pit edge (from `getState`, inside the same tick's
        // player update), and which one wins is FlashPunk bookkeeping this
        // module deliberately does not transcribe — `playerPhysicsV2`
        // throws on the conflict by name. Exactly two exist in the whole
        // extract: L43's exit to L37 and L100's to L101.
        const ttx = Math.floor(tp.x / TILE_SIZE);
        const tty = Math.floor(tp.y / TILE_SIZE);
        if (world.pitTiles.some((t) => t.tx === ttx && t.ty === tty)) {
            pitTriggers.push(`L${level} t(${tp.x},${tp.y}) -> L${tp.to}`);
            continue;
        }
        const dest = resolveArrival(tp.to, tp.playerx, tp.playery, []);
        if (!dest) {
            drops.push(`L${level} t(${tp.x},${tp.y}) -> L${tp.to} `
                + `arrival ctor(${tp.playerx},${tp.playery}): `
                + `${arrivalBlocker(tp.to, tp.playerx, tp.playery)}`);
            continue;
        }
        const tx = Math.floor(tp.x / TILE_SIZE);
        const ty = Math.floor(tp.y / TILE_SIZE);
        for (const component of componentsTouching(level, tx, ty)) {
            addEdge(`${level}:${component}`, {
                to: dest.node,
                kind: 'teleporter',
                exit: { x: tp.x, y: tp.y },
                toLevel: dest.level,
                boot: dest.boot,
                through: dest.through,
            });
        }
    }
    if (world.fallthrough) {
        for (const tile of world.pitTiles) {
            const ctor = fallCtor(world, tile);
            const dest = resolveArrival(ctor.level, ctor.x, ctor.y, []);
            if (!dest) {
                drops.push(`L${level} FALL(${tile.tx},${tile.ty}) -> L${ctor.level} `
                    + `arrival ctor(${ctor.x},${ctor.y}): `
                    + `${arrivalBlocker(ctor.level, ctor.x, ctor.y)}`);
                continue;
            }
            for (const component of componentsTouching(level, tile.tx, tile.ty)) {
                addEdge(`${level}:${component}`, {
                    to: dest.node,
                    kind: 'fall',
                    exit: { pit: { tx: tile.tx, ty: tile.ty } },
                    toLevel: dest.level,
                    boot: dest.boot,
                    through: dest.through,
                });
            }
        }
    }
}

function bfs(start) {
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const queue = [start];
    while (queue.length > 0) {
        const u = queue.shift();
        for (const e of edges.get(u) ?? []) {
            if (dist.has(e.to)) continue;
            dist.set(e.to, dist.get(u) + 1);
            prev.set(e.to, { from: u, edge: e });
            queue.push(e.to);
        }
    }
    return { dist, prev };
}

/** The hop chain between two nodes, or null. */
function pathBetween(from, to) {
    const { dist, prev } = bfs(from);
    if (!dist.has(to)) return null;
    const hops = [];
    let cursor = to;
    while (prev.has(cursor)) {
        const { from: u, edge } = prev.get(cursor);
        hops.unshift({ from: u, edge });
        cursor = u;
    }
    return hops;
}

if (DROPS) {
    console.log(`${drops.length} edge(s) dropped for an unsteppable arrival:`);
    drops.forEach((d) => console.log(`  ${d}`));
    process.exit(0);
}

// `--reach=<level>:<component>` — what that node can get to, and how far.
// Route authoring is mostly answering that question, and answering it from
// the SAME graph the tour walks is the only version worth having.
const reachArg = process.argv.find((a) => a.startsWith('--reach='));
if (reachArg) {
    const node = reachArg.slice('--reach='.length);
    const { dist } = bfs(node);
    const byLevel = new Map();
    for (const [n, d] of dist) {
        const lv = Number(n.split(':')[0]);
        if (!byLevel.has(lv) || byLevel.get(lv) > d) byLevel.set(lv, d);
    }
    console.log(`from ${node}: ${dist.size} node(s), `
        + `${byLevel.size} level(s) reachable`);
    console.log([...byLevel.entries()].sort((a, b) => a[0] - b[0])
        .map(([lv, d]) => `L${lv}(d${d})`).join(' '));
    console.log(`\nout of ${node}: ${(edges.get(node) ?? [])
        .map((e) => `${e.kind}->${e.to}`).join(' ') || '(nothing)'}`);
    process.exit(0);
}

// ── the tour ──────────────────────────────────────────────────────────
const bootSpawn = { x: R1_BOOT.x + TILE_SIZE / 2, y: R1_BOOT.y + TILE_SIZE / 2 };
const bootComponent = componentAt(R1_BOOT.level, bootSpawn.x, bootSpawn.y);
if (bootComponent === null) {
    throw new Error(`the boot position (${bootSpawn.x},${bootSpawn.y}) in level `
        + `${R1_BOOT.level} is not in any walkable component`);
}
const START = `${R1_BOOT.level}:${bootComponent}`;

const hops = [];
let cursor = START;
const visitOrder = [];
for (const room of R1_ITEM_ROOMS) {
    const { dist } = bfs(cursor);
    const candidates = [...dist.keys()]
        .filter((n) => n.startsWith(`${room.level}:`))
        .sort((a, b) => dist.get(a) - dist.get(b));
    if (candidates.length === 0) {
        // The diagnostic is part of the tool: "no path" is nearly always a
        // COMPONENT fact ("that level's other half"), and printing the
        // component structure at the failure is what tells the two apart.
        const nodesOf = (lv) => [...edges.keys()].filter((n) => n.startsWith(`${lv}:`));
        console.error(`\nno path ${cursor} -> L${room.level}. Diagnostics:`);
        console.error(`  ${cursor} leaves by: ${(edges.get(cursor) ?? [])
            .map((e) => `${e.kind}->${e.to}`).join(' ') || '(nothing)'}`);
        console.error(`  ${dist.size} node(s) reachable from ${cursor}`);
        console.error(`  L${room.level} components with outgoing edges: `
            + `${nodesOf(room.level).join(' ') || '(none)'}`);
        console.error(`  components of L${room.level}: `
            + `${new Set(componentsOf(room.level).values()).size}`);
        throw new Error(`no path to L${room.level} (${room.items.join('+')}) from `
            + `${cursor}. The item order is FIXED by the R1 recon (§8.7) — a level `
            + 'that has stopped being reachable is a routing regression, not a '
            + 'reordering to absorb.');
    }
    const chain = pathBetween(cursor, candidates[0]);
    hops.push(...chain);
    cursor = candidates[0];
    visitOrder.push(`${room.items.join('+')}(L${room.level})`);
}
// The tail: back to the cluster hub and out through its pit, so the walk
// ends on solid floor in L82 rather than in a dead-end room.
const { dist: fromLast } = bfs(cursor);
const hub = [...fromLast.keys()].filter((n) => n.startsWith('71:'))
    .sort((a, b) => fromLast.get(a) - fromLast.get(b))[0];
if (!hub) throw new Error(`no path back to the cluster hub L71 from ${cursor}`);
hops.push(...pathBetween(cursor, hub));
const out = (edges.get(hub) ?? []).find((e) => e.kind === 'fall' && e.toLevel === 82);
if (!out) throw new Error(`L71's fall to L82 is not an edge out of ${hub}`);
hops.push({ from: hub, edge: out });

// ── hops -> legs ──────────────────────────────────────────────────────
// One leg per level ENTERED, including every pass-through: a pass-through
// level is a leg with no targets and an automatic exit, because the player
// lands on its pit and falls again without ever taking a step.
// `leg_boots[i]` is the GAME CONSTRUCTOR args the run is standing at when
// leg `i` starts — what a segment tape's `boot` block has to declare for
// `atBootPosition()` to agree.
const legs = [];
const legBoots = [];
let standing = { ...R1_BOOT };
for (const { from, edge } of hops) {
    legs.push({ level: Number(from.split(':')[0]), targets: [], exit: edge.exit });
    legBoots.push({ ...standing });
    for (const p of edge.through) {
        legs.push({ level: p.level, targets: [], exit: { pit: p.pit } });
        legBoots.push({ ...p.boot });
    }
    standing = { ...edge.boot };
}
legs.push({ level: standing.level, targets: [] });
legBoots.push({ ...standing });

// What each leg STARTS standing inside — computed with the driver's own
// `contactsAt`, so the declaration in the route and the check in
// `synthesizeLegs` cannot drift apart. Only non-empty ones are written.
legs.forEach((leg, i) => {
    const world = worldFor(leg.level);
    const contacts = contactsAt(world,
        legBoots[i].x + TILE_SIZE / 2, legBoots[i].y + TILE_SIZE / 2,
        { avoidVolumes: true });
    if (contacts.length > 0) leg.contacts = contacts;
});

// ── grants ────────────────────────────────────────────────────────────
const grants = R1_ITEM_ROOMS.map((r) => ({ level: r.level, items: [...r.items] }));
for (const g of grants) {
    if (!legs.some((l) => l.level === g.level)) {
        throw new Error(`the route never enters L${g.level}, which grants `
            + `${g.items.join('+')} — a grant that cannot fire is a route claim that `
            + 'stopped being true');
    }
}

const distinct = new Set(legs.map((l) => l.level));
console.log(`item order: ${visitOrder.join(' -> ')}`);
console.log(`legs ${legs.length}, distinct levels ${distinct.size}, `
    + `falls ${legs.filter((l) => l.exit?.pit).length}, `
    + `pass-throughs ${hops.reduce((n, h) => n + h.edge.through.length, 0)}`);
if (VERBOSE) {
    legs.forEach((l, i) => console.log(`  ${String(i).padStart(2)} L${l.level} `
        + `boot(${legBoots[i].x},${legBoots[i].y}) -> `
        + `${l.exit ? (l.exit.pit ? `FALL(${l.exit.pit.tx},${l.exit.pit.ty})`
            : `t(${l.exit.x},${l.exit.y})`) : 'END'}`
        + `${l.contacts ? `  contacts: ${l.contacts.join(' ')}` : ''}`));
}

// ── persistence effects ───────────────────────────────────────────────
// Each declared effect is bound to the LEG that causes it, by contact key,
// so a route that stopped making the contact is a loud failure rather than
// a volume priced against nothing.
const persistenceEffects = R1_PERSISTENCE_EFFECTS.map((e) => {
    const fromLeg = legs.findIndex((l) => (l.contacts ?? []).includes(e.contact));
    if (fromLeg < 0) {
        throw new Error(`no leg makes contact ${e.contact}, which R1_PERSISTENCE_EFFECTS `
            + `says arms ${e.tag} in L${e.level}. Either the route changed or the `
            + 'effect did.');
    }
    return {
        contact: e.contact, level: e.level, fromLeg, tag: e.tag,
        rect: { ...e.rect }, why: e.why,
    };
});
console.log(`persistence effects: ${persistenceEffects
    .map((e) => `${e.tag} in L${e.level} from leg ${e.fromLeg}`).join('; ') || 'none'}`);

// ── segments ──────────────────────────────────────────────────────────
// Boundaries are LEG INDICES, and every one of them is a level ARRIVAL:
// an arrival's position is exactly the ctor half-tile with zero velocity and
// a fresh terrain state, which is precisely what a parameterised boot
// reproduces. A boundary mid-level could not be booted into at all.
const boundaries = R1_SEGMENT_BOUNDARIES.map((endsAfterLevel, i) => {
    // Each boundary is named by the level the segment ENDS in, plus which
    // occurrence of it — the route revisits L12 four times.
    const [level, occurrence] = endsAfterLevel;
    let seen = 0;
    for (let li = 0; li < legs.length; li++) {
        if (legs[li].level !== level) continue;
        seen++;
        if (seen === occurrence) return li;
    }
    throw new Error(`segment boundary ${i}: the route enters L${level} fewer than `
        + `${occurrence} times`);
});

const route = {
    generated_by: 'scripts/procgen/plan-seedling-r1-route.mjs',
    description: 'The R1 relaxed full walk: every reachable non-combat item room, '
        + 'over the (level, component) graph with pits as a modelled transport. '
        + 'Legs carry no targets — entering an item room IS collection at this rung, '
        + 'so a leg walks from its arrival straight to its named exit.',
    boot: { ...R1_BOOT },
    noHazards: [...R1_NO_HAZARDS],
    item_order: visitOrder,
    grants,
    segment_boundaries: boundaries,
    persistence_effects: persistenceEffects,
    leg_boots: legBoots,
    legs,
};

console.log(`segment boundaries at legs ${boundaries.join(', ')}`);
if (pitTriggers.length > 0) {
    console.log(`triggers refused for standing on a pit tile (${pitTriggers.length}): `
        + `${pitTriggers.join(', ')}`);
}
if (unbuildable.size > 0) {
    console.log(`levels that do not build (${unbuildable.size}): `
        + `${[...unbuildable.keys()].join(', ')}`);
}
if (WRITE) {
    writeFileSync(OUT, `${JSON.stringify(route, null, 2)}\n`);
    console.log(`\nwrote ${OUT}`);
} else {
    console.log('\n(dry run — pass --write to update fixtures/r1-route.json)');
}
