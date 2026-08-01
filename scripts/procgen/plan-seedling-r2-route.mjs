#!/usr/bin/env node
/**
 * plan-seedling-r2-route — compute the R2 full-walk route and write it to
 * `frontend/modules/seedlingDemo/fixtures/r2-route.json`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R2, slice 6. Brief:
 * `CC/docs/plans/seedling-bot-r2-opus-kickoff.md` §9 and §11.
 *
 * Same shape as `plan-seedling-r1-route.mjs` and for the same reasons —
 * this is ROUTE AUTHORING, it gates nothing, the committed leg list is the
 * artifact and this script is how it was arrived at. Read that file's
 * docblock for the doctrine; what follows is only what R2 changed.
 *
 * ── THREE THINGS ARE DIFFERENT, and all three are the rung ─────────────
 *
 * **1. The solids are back.** R1 planned with `noclip: true` and a census
 * of three cheap roles; this plans with collision ON and the full
 * `blocking` census R2 paid for. A component is a 4-connected blob of
 * tiles whose CENTRE the player box fits at with every solid, pixelmask,
 * unmodelled terrain, pit tile, live trigger and avoid volume priced.
 *
 * **2. The geometry is POST-CLEAR.** A tape's `persistence` clears are
 * applied when each world is built, so a cleared lock has already merged
 * the components either side of it and `(level, component)` ids are
 * computed from the world the walk actually meets. Computing them from the
 * pre-clear world would produce a graph whose nodes do not exist.
 *
 * The clear list is DERIVED, not authored: `persistenceClearsFor` reads
 * each level's own entities and offers the tags whose clearing removes a
 * blocker, refusing (by name, with the reason) the ones that would arm a
 * FallRock, make a MoonrockPile appear, boot a ButtonRoom pressed, take a
 * pickup or despawn an enemy. The list is then PRUNED to the levels the
 * route enters and the route is re-planned against the pruned list, which
 * must reproduce it exactly — a fixed point, asserted rather than assumed.
 *
 * **3. There are HOLD EDGES.** A `Lock` whose `tSet >= 0` does not answer
 * to any clear; it answers to its button. So the graph carries an
 * intra-level edge from the component a presser can be reached from to
 * every component that becomes connected once its group opens — derived by
 * flooding the level twice, once with the group shut and once open, rather
 * than declared. R2's route uses exactly one of them (L71's
 * `button@112,176` under `lock@112,160`), and the derivation is what makes
 * that a fact about the map instead of a fact about this file.
 *
 * Run: node scripts/procgen/plan-seedling-r2-route.mjs [--write] [--verbose]
 *      node scripts/procgen/plan-seedling-r2-route.mjs --clears
 *      node scripts/procgen/plan-seedling-r2-route.mjs --reach=71:3
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, persistenceClearsFor, TILE_SIZE } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { contactKey, contactsAt, nodeCentre, plannerObstacleAt } =
    await import(join(MODULE, 'botDriverV2.js'));
const {
    R2_BOOT, R2_HOLD_TICKS, R2_ITEM_ROOMS, R2_LATTICE, R2_NO_HAZARDS,
    R2_SEGMENT_BOUNDARIES,
} = await import(join(MODULE, 'r2Walk.js'));

const WRITE = process.argv.includes('--write');
const VERBOSE = process.argv.includes('--verbose');
const OUT = join(MODULE, 'fixtures', 'r2-route.json');
const LEVEL_COUNT = 116;

/** The plan half of `relax`, exactly as `synthesizeLegs` derives it. */
const PLAN = {
    noclip: false, noHazards: R2_NO_HAZARDS, avoidVolumes: true, lattice: R2_LATTICE,
};
/** Lattice cells per tile row — the component maps are in LATTICE cells. */
const CELLS = TILE_SIZE / R2_LATTICE;

const source = atlasLevelSource();

// ── the clear list ────────────────────────────────────────────────────
const allClears = [];
const refusedClears = [];
for (let level = 0; level < LEVEL_COUNT; level++) {
    const { offered, refused } = persistenceClearsFor(source(level));
    allClears.push(...offered);
    refusedClears.push(...refused);
}

if (process.argv.includes('--clears')) {
    console.log(`${allClears.length} clear(s) OFFERED across ${LEVEL_COUNT} levels:`);
    allClears.forEach((c) => console.log(`  L${c.level} tag ${c.tag}: ${c.note}`));
    console.log(`\n${refusedClears.length} REFUSED:`);
    refusedClears.forEach((c) => console.log(`  L${c.level} tag ${c.tag}: ${c.why}`));
    process.exit(0);
}

/**
 * Plan and tour the whole map under one clear list.
 *
 * A function rather than top-level code because it is run TWICE — once
 * with every offered clear and once with the list pruned to the levels the
 * first run entered — and the two must agree. A pruning that changed the
 * route would mean a clear in a level the walk never enters had been
 * load-bearing, which cannot happen but is worth finding out rather than
 * believing.
 */
function planWith(clears) {
    const clearedByLevel = new Map();
    for (const c of clears) {
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }

    const worlds = new Map();
    const unbuildable = new Map();
    function worldFor(level) {
        if (worlds.has(level)) return worlds.get(level);
        let world = null;
        try {
            const cleared = clearedByLevel.get(level);
            world = buildLevelWorld(source(level), cleared ? { cleared } : undefined);
        } catch (e) {
            unbuildable.set(level, e.message);
        }
        worlds.set(level, world);
        return world;
    }

    /** Is the player box clear at this tile's centre, with `open` unlocked? */
    function freeTile(world, tx, ty, open = null) {
        if (tx < 0 || ty < 0 || tx >= world.width * CELLS || ty >= world.height * CELLS) {
            return false;
        }
        const c = nodeCentre(tx, ty, R2_LATTICE);
        try {
            return plannerObstacleAt(world, c.x, c.y, null,
                { ...PLAN, openActivators: open }) === null;
        } catch {
            // `plannerBlockerAt` never throws; a pixelmask probe can. Treat
            // an unmodellable tile as blocked — this is authoring, and the
            // driver is what turns a wrong answer here into a red.
            return false;
        }
    }

    const componentsCache = new Map();
    /** `Map<"tx,ty", componentId>` for one level, 4-connected. */
    function componentsOf(level, open = null) {
        const key = open === null ? `${level}` : `${level}|${[...open].sort().join(',')}`;
        if (componentsCache.has(key)) return componentsCache.get(key);
        const world = worldFor(level);
        const map = new Map();
        if (!world) { componentsCache.set(key, map); return map; }
        let next = 0;
        for (let ty = 0; ty < world.height * CELLS; ty++) {
            for (let tx = 0; tx < world.width * CELLS; tx++) {
                if (map.has(`${tx},${ty}`) || !freeTile(world, tx, ty, open)) continue;
                const id = next++;
                const queue = [[tx, ty]];
                map.set(`${tx},${ty}`, id);
                while (queue.length > 0) {
                    const [ux, uy] = queue.pop();
                    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                        const k = `${ux + dx},${uy + dy}`;
                        if (map.has(k) || !freeTile(world, ux + dx, uy + dy, open)) continue;
                        map.set(k, id);
                        queue.push([ux + dx, uy + dy]);
                    }
                }
            }
        }
        componentsCache.set(key, map);
        return map;
    }

    /** The components a lattice cell is 4-adjacent to. */
    function componentsTouching(level, cx, cy, open = null) {
        const map = componentsOf(level, open);
        const ids = new Set();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const id = map.get(`${cx + dx},${cy + dy}`);
            if (id !== undefined) ids.add(id);
        }
        return [...ids];
    }

    /**
     * The components a 16x16 VOLUME can be walked into from.
     *
     * ⚠ A trigger, a pit tile and a button are all one TILE across, and the
     * lattice is finer than a tile now — so "the components this tile is
     * 4-adjacent to" stopped being a single lookup. The faithful reading is
     * the one below: take every lattice cell whose centre lies inside the
     * volume (the positions the player would occupy while standing in it)
     * and collect the components of their neighbours. Reading the tile's
     * own four tile-neighbours instead would ask about cells 16 px away and
     * miss the ones actually beside it.
     */
    function componentsAround(level, rect, open = null) {
        const map = componentsOf(level, open);
        const ids = new Set();
        // The rect's own cells, DILATED BY ONE. A 16x16 volume is four cells
        // at pitch 8 and its own cells are blocked (that is what makes it a
        // volume), so the answer is the ring around them.
        //
        // ⚠ It is not "the cells whose centre is inside the rect", which was
        // the first cut and returned NOTHING for L71's button: that rect is
        // `[116,124) x [181,187)` — six pixels tall — and no lattice-8 cell
        // centre falls in it. The hold edge silently did not exist, and the
        // graph reported Dungeon 7 sealed.
        //
        // Erring PERMISSIVE is deliberate. Too strict loses reachability in
        // silence; too loose offers the tour an edge the driver then refuses
        // to walk, by name, before anything is recorded.
        const c0 = Math.floor(rect.x / R2_LATTICE) - 1;
        const c1 = Math.ceil(rect.right / R2_LATTICE);
        const r0 = Math.floor(rect.y / R2_LATTICE) - 1;
        const r1 = Math.ceil(rect.bottom / R2_LATTICE);
        for (let cy = r0; cy <= r1; cy++) {
            for (let cx = c0; cx <= c1; cx++) {
                const id = map.get(`${cx},${cy}`);
                if (id !== undefined) ids.add(id);
            }
        }
        return [...ids];
    }

    /** A tile's own 16x16 rect, for `componentsAround`. */
    const tileRect = (tx, ty) => ({
        x: tx * TILE_SIZE,
        y: ty * TILE_SIZE,
        right: (tx + 1) * TILE_SIZE,
        bottom: (ty + 1) * TILE_SIZE,
    });

    /**
     * The component a PIXEL position stands in, following the
     * FORCED-CONTACT rule: an arrival tile blocked ONLY by trigger volumes
     * and avoid volumes is still standable — the game put the player there
     * — and belongs to the component it can step off into.
     */
    function resolveStanding(level, x, y) {
        const world = worldFor(level);
        if (!world) return null;
        const tx = Math.floor(x / R2_LATTICE);
        const ty = Math.floor(y / R2_LATTICE);
        if (tx < 0 || ty < 0 || tx >= world.width * CELLS || ty >= world.height * CELLS) {
            return null;
        }
        const direct = componentsOf(level).get(`${tx},${ty}`);
        if (direct !== undefined) return { component: direct, contacts: [] };

        const contacts = new Set();
        const volumes = [];
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
            if (o.blocker.rect) volumes.push(o.blocker.rect);
        }
        // ⚠ STEPPING OFF IS A QUESTION ABOUT THE WHOLE VOLUME, not about one
        // cell. At the tile lattice the player stood in exactly one cell and
        // its four neighbours were the answer; at pitch 8 a 16x16 trigger is
        // FOUR cells, and the arrival cell's neighbours can all be inside the
        // same trigger. L3's arrival from L11 is exactly that — every
        // neighbour of the cell it lands in is the trigger it came through,
        // so the tile-lattice reading reported the level unreachable and the
        // whole eastern half of the map with it.
        const ids = new Set();
        for (const rect of volumes) {
            for (const id of componentsAround(level, rect)) ids.add(id);
        }
        if (ids.size === 0) {
            for (const id of componentsTouching(level, tx, ty)) ids.add(id);
        }
        if (ids.size === 0) return null;
        return { component: Math.min(...ids), contacts: [...contacts] };
    }

    const componentAt = (level, x, y) => {
        const s = resolveStanding(level, x, y);
        return s === null ? null : s.component;
    };

    /** Where a pit tile of `world` drops the player, as GAME CTOR args. */
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

    /** Resolve an arrival to its `(level, component)`, following PASS-THROUGHS. */
    function resolveArrival(level, ctorX, ctorY, through = [], seen = new Set()) {
        const world = worldFor(level);
        if (!world) return null;
        const x = ctorX + TILE_SIZE / 2;
        const y = ctorY + TILE_SIZE / 2;
        const tx = Math.floor(x / TILE_SIZE);
        const ty = Math.floor(y / TILE_SIZE);
        const pit = world.pitTiles.find((t) => t.tx === tx && t.ty === ty);
        if (pit) {
            if (seen.has(level)) return null;
            seen.add(level);
            const ctor = fallCtor(world, pit);
            if (!ctor) return null;
            through.push({ level, pit: { tx, ty }, boot: { level, x: ctorX, y: ctorY } });
            return resolveArrival(ctor.level, ctor.x, ctor.y, through, seen);
        }
        const component = componentAt(level, x, y);
        if (component === null) return null;
        return {
            level, component, node: `${level}:${component}`, through,
            boot: { level, x: ctorX, y: ctorY },
        };
    }

    // ── the (level, component) graph ──────────────────────────────────
    const edges = new Map();
    const addEdge = (from, edge) => {
        if (!edges.has(from)) edges.set(from, []);
        edges.get(from).push(edge);
    };
    const holdEdges = [];

    for (let level = 0; level < LEVEL_COUNT; level++) {
        const world = worldFor(level);
        if (!world) continue;
        for (const tp of world.teleporters) {
            if (tp.deactivated) continue;
            const ttx = Math.floor(tp.x / TILE_SIZE);
            const tty = Math.floor(tp.y / TILE_SIZE);
            // A trigger tile that is ALSO a pit tile is not an exit: which
            // of the two fires is FlashPunk bookkeeping the physics refuses
            // to transcribe. Two exist in the whole extract.
            if (world.pitTiles.some((t) => t.tx === ttx && t.ty === tty)) continue;
            const dest = resolveArrival(tp.to, tp.playerx, tp.playery, []);
            if (!dest) continue;
            for (const component of componentsAround(level, tileRect(ttx, tty))) {
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
                if (!dest) continue;
                for (const component of componentsAround(level, tileRect(tile.tx, tile.ty))) {
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

        // ── HOLD EDGES ────────────────────────────────────────────────
        // Derived, not declared. For each presser with responders: flood the
        // level once with its group SHUT (the ids everything else uses) and
        // once with it OPEN, and read off which shut-components the open
        // flood beside the button now reaches. A `Lock` with `tSet >= 0`
        // answers to no clear, only to this — so without the edge the graph
        // says Dungeon 7 is sealed, which is true of the geometry and false
        // of the game.
        for (const p of world.pressers) {
            if (p.t < 0) continue;
            const group = world.activators.filter((a) => a.t === p.t);
            if (group.length === 0) continue;
            const from = componentsAround(level, p.rect);
            if (from.length === 0) continue;
            const fromId = Math.min(...from);
            const openIds = new Set(group.map((a) => a.id));
            const openMap = componentsOf(level, openIds);
            const shutMap = componentsOf(level);
            const seedIds = new Set(componentsAround(level, p.rect, openIds));
            const reached = new Set();
            for (const [key, id] of openMap) {
                if (!seedIds.has(id)) continue;
                const shutId = shutMap.get(key);
                if (shutId !== undefined && shutId !== fromId) reached.add(shutId);
            }
            // ⚠ The stand point is the presser rect's CENTRE, not a lattice
            // node. L71's button is `[116,124) x [181,187)` — six pixels tall,
            // and NO lattice-8 cell centre falls inside it. The target of a
            // hold has to be a position the box overlaps the button at, and
            // the planner's last waypoint is the target itself rather than
            // its cell's centre, so the centre is both legal and the point
            // furthest from every edge.
            const stand = {
                x: (p.rect.x + p.rect.right) / 2,
                y: (p.rect.y + p.rect.bottom) / 2,
            };
            // The flood seeds: the open-map cells the button can be stepped
            // off into, which is the same set `componentsAround` reads.
            const seeds = [];
            const c0 = Math.floor(p.rect.x / R2_LATTICE) - 1;
            const c1 = Math.ceil(p.rect.right / R2_LATTICE);
            const r0 = Math.floor(p.rect.y / R2_LATTICE) - 1;
            const r1 = Math.ceil(p.rect.bottom / R2_LATTICE);
            for (let cy = r0; cy <= r1; cy++) {
                for (let cx = c0; cx <= c1; cx++) {
                    if (openMap.get(`${cx},${cy}`) !== undefined) seeds.push(`${cx},${cy}`);
                }
            }
            for (const toId of reached) {
                const land = landingCell(openMap, shutMap, toId, seeds);
                if (!land) continue;
                addEdge(`${level}:${fromId}`, {
                    to: `${level}:${toId}`,
                    kind: 'hold',
                    toLevel: level,
                    hold: { ticks: R2_HOLD_TICKS, presser: { x: p.x, y: p.y } },
                    presserTag: p.tag,
                    opens: [...openIds],
                    stand,
                    // Where the hold LANDS: the CLOSEST cell of the
                    // destination component, so the leg spends as few ticks
                    // as possible between leaving the button and being
                    // somewhere the lock cannot shut it out of.
                    land,
                    boot: null,
                    through: [],
                });
                holdEdges.push({
                    level, from: fromId, to: toId, presser: `${p.tag}@${p.x},${p.y}`,
                });
            }
        }
    }

    /**
     * The FIRST cell of `toId` a walk from the button reaches, by BFS over
     * the OPEN map.
     *
     * ⚠ NOT the nearest by Manhattan distance, which was the first cut and
     * is the wrong question. A `Lock` re-solidifies the moment the player is
     * off the button and out of the lock (`returnToNormal` is guarded by
     * occupancy alone), so the walk gets exactly ONE pass through it. The
     * nearest cell of the destination component can easily be one that is
     * near in a straight line and reached by going through the lock, round,
     * and back — which would need a second crossing that no longer exists.
     * The first cell the open-map flood reaches is on the near side by
     * construction.
     */
    function landingCell(openMap, shutMap, toId, seeds) {
        const seen = new Set(seeds);
        let frontier = [...seeds];
        while (frontier.length > 0) {
            // Sorted, because this route is a COMMITTED artifact and Map or
            // frontier order is not a tie-break anyone reviewed.
            frontier.sort();
            const next = [];
            for (const key of frontier) {
                if (shutMap.get(key) === toId) {
                    const [cx, cy] = key.split(',').map(Number);
                    return nodeCentre(cx, cy, R2_LATTICE);
                }
                const [cx, cy] = key.split(',').map(Number);
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const k = `${cx + dx},${cy + dy}`;
                    if (seen.has(k) || openMap.get(k) === undefined) continue;
                    seen.add(k);
                    next.push(k);
                }
            }
            frontier = next;
        }
        return null;
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

    return {
        worldFor, componentAt, componentsOf, componentsTouching, edges, bfs,
        pathBetween, unbuildable, holdEdges, clearedByLevel,
    };
}

// ── the tour ──────────────────────────────────────────────────────────
function tour(g) {
    const bootSpawn = { x: R2_BOOT.x + TILE_SIZE / 2, y: R2_BOOT.y + TILE_SIZE / 2 };
    const bootComponent = g.componentAt(R2_BOOT.level, bootSpawn.x, bootSpawn.y);
    if (bootComponent === null) {
        throw new Error(`the boot position (${bootSpawn.x},${bootSpawn.y}) in level `
            + `${R2_BOOT.level} is not in any walkable component`);
    }
    const START = `${R2_BOOT.level}:${bootComponent}`;
    const hops = [];
    let cursor = START;
    const visitOrder = [];
    for (const room of R2_ITEM_ROOMS) {
        const { dist } = g.bfs(cursor);
        const candidates = [...dist.keys()]
            .filter((n) => n.startsWith(`${room.level}:`))
            .sort((a, b) => dist.get(a) - dist.get(b));
        if (candidates.length === 0) {
            const nodesOf = (lv) => [...g.edges.keys()].filter((n) => n.startsWith(`${lv}:`));
            console.error(`\nno path ${cursor} -> L${room.level}. Diagnostics:`);
            console.error(`  ${cursor} leaves by: ${(g.edges.get(cursor) ?? [])
                .map((e) => `${e.kind}->${e.to}`).join(' ') || '(nothing)'}`);
            console.error(`  ${dist.size} node(s) reachable from ${cursor}`);
            console.error(`  L${room.level} components with outgoing edges: `
                + `${nodesOf(room.level).join(' ') || '(none)'}`);
            console.error(`  components of L${room.level}: `
                + `${new Set(g.componentsOf(room.level).values()).size}`);
            throw new Error(`no path to L${room.level} (${room.items.join('+')}) from `
                + `${cursor}. With the solids back this is a SEAL, and a seal the `
                + 'slice-0 feasibility pass did not name is a finding for the user, not '
                + 'an item to trade away.');
        }
        hops.push(...g.pathBetween(cursor, candidates[0]));
        cursor = candidates[0];
        visitOrder.push(`${room.items.join('+')}(L${room.level})`);
    }
    // The tail: back to the cluster hub and out through its pit, so the
    // walk ends on solid floor in L82 rather than in a dead-end room.
    const { dist: fromLast } = g.bfs(cursor);
    const hub = [...fromLast.keys()].filter((n) => n.startsWith('71:'))
        .sort((a, b) => fromLast.get(a) - fromLast.get(b))[0];
    if (!hub) throw new Error(`no path back to the cluster hub L71 from ${cursor}`);
    hops.push(...g.pathBetween(cursor, hub));
    const out = (g.edges.get(hub) ?? []).find((e) => e.kind === 'fall' && e.toLevel === 82);
    if (!out) throw new Error(`L71's fall to L82 is not an edge out of ${hub}`);
    hops.push({ from: hub, edge: out });
    return { hops, visitOrder, START };
}

/**
 * hops -> legs.
 *
 * One leg per level ENTERED, including every pass-through. A HOLD hop is
 * the exception and the reason this is not R1's loop verbatim: it stays
 * INSIDE its level, so it contributes targets to the leg already open
 * rather than starting a new one.
 */
function toLegs(g, hops) {
    const legs = [];
    const legBoots = [];
    const holds = [];
    let standing = { ...R2_BOOT };
    let open = null;
    const openLeg = (level) => {
        legs.push({ level, targets: [] });
        legBoots.push({ ...standing });
        open = legs[legs.length - 1];
        return open;
    };
    for (const { from, edge } of hops) {
        // ⚠ A LEG'S LEVEL IS WHERE THE PLAYER IS, which is the hop's FROM
        // node — not `edge.to`, which is where it goes. The first cut read
        // the destination and produced a leg list whose levels were shifted
        // by one hop: every `exit` named a teleporter the level it was
        // written under does not have.
        const fromLevel = Number(String(from).split(':')[0]);
        if (edge.kind === 'hold') {
            const leg = open ?? openLeg(fromLevel);
            if (leg.level !== edge.toLevel) {
                throw new Error(`a hold edge in L${edge.toLevel} met an open leg in `
                    + `L${leg.level}`);
            }
            leg.targets.push({
                x: edge.stand.x, y: edge.stand.y, hold: { ...edge.hold },
            });
            leg.targets.push({ x: edge.land.x, y: edge.land.y });
            holds.push({
                leg: legs.length - 1,
                level: edge.toLevel,
                presser: `${edge.presserTag}@${edge.hold.presser.x},${edge.hold.presser.y}`,
                ticks: edge.hold.ticks,
                opens: [...edge.opens],
            });
            continue;
        }
        const leg = open ?? openLeg(fromLevel);
        if (leg.level !== fromLevel) {
            throw new Error(`a ${edge.kind} edge out of L${fromLevel} met an open leg `
                + `in L${leg.level}`);
        }
        leg.exit = edge.exit;
        open = null;
        for (const p of edge.through) {
            legs.push({ level: p.level, targets: [], exit: { pit: p.pit } });
            legBoots.push({ ...p.boot });
        }
        standing = { ...edge.boot };
    }
    if (open) throw new Error('the last hop was a hold, so the walk ends mid-level');
    legs.push({ level: standing.level, targets: [] });
    legBoots.push({ ...standing });
    return { legs, legBoots, holds };
}

// ── run 1: every offered clear ────────────────────────────────────────
console.log(`clear list: ${allClears.length} offered, ${refusedClears.length} refused `
    + '(--clears for the full audit)');
const first = planWith(allClears);

// `--reach=<level>:<component>` — what that node can get to, and how far.
// Route authoring is mostly answering that question, and answering it from
// the SAME graph the tour walks is the only version worth having.
const reachArg = process.argv.find((a) => a.startsWith('--reach='));
if (reachArg) {
    const node = reachArg.slice('--reach='.length);
    const { dist } = first.bfs(node);
    const byLevel = new Map();
    for (const [n, d] of dist) {
        const lv = Number(n.split(':')[0]);
        if (!byLevel.has(lv) || byLevel.get(lv) > d) byLevel.set(lv, d);
    }
    console.log(`from ${node}: ${dist.size} node(s), ${byLevel.size} level(s) reachable`);
    console.log([...byLevel.entries()].sort((a, b) => a[0] - b[0])
        .map(([lv, d]) => `L${lv}(d${d})`).join(' '));
    console.log(`\nout of ${node}: ${(first.edges.get(node) ?? [])
        .map((e) => `${e.kind}->${e.to}`).join(' ') || '(nothing)'}`);
    console.log(`\nHOLD edges (${first.holdEdges.length}): ${first.holdEdges
        .map((h) => `L${h.level} ${h.from}->${h.to} via ${h.presser}`).join('; ')}`);
    process.exit(0);
}

const firstTour = tour(first);
const firstLegs = toLegs(first, firstTour.hops);
const routeLevels = new Set(firstLegs.legs.map((l) => l.level));

// ── run 2: pruned to the levels the route enters ──────────────────────
const clears = allClears.filter((c) => routeLevels.has(c.level));
console.log(`pruned to the route's ${routeLevels.size} level(s): ${clears.length} clear(s)`);
const g = planWith(clears);
const { hops, visitOrder, START } = tour(g);
const { legs, legBoots, holds } = toLegs(g, hops);

if (JSON.stringify(legs) !== JSON.stringify(firstLegs.legs)) {
    throw new Error('pruning the clear list to the route\'s own levels CHANGED the '
        + 'route. A clear only affects the level it names, so this cannot happen — '
        + 'which is exactly why it is asserted rather than assumed.');
}

// What each leg STARTS standing inside, computed with the driver's own
// `contactsAt` so the declaration and the check cannot drift apart.
legs.forEach((leg, i) => {
    const world = g.worldFor(leg.level);
    const contacts = contactsAt(world,
        legBoots[i].x + TILE_SIZE / 2, legBoots[i].y + TILE_SIZE / 2,
        { avoidVolumes: true });
    if (contacts.length > 0) leg.contacts = contacts;
});

const grants = R2_ITEM_ROOMS.map((r) => ({ level: r.level, items: [...r.items] }));
for (const grant of grants) {
    if (!legs.some((l) => l.level === grant.level)) {
        throw new Error(`the route never enters L${grant.level}, which grants `
            + `${grant.items.join('+')} — a grant that cannot fire is a route claim `
            + 'that stopped being true');
    }
}

const distinct = new Set(legs.map((l) => l.level));
console.log(`item order: ${visitOrder.join(' -> ')}`);
console.log(`legs ${legs.length}, distinct levels ${distinct.size}, `
    + `falls ${legs.filter((l) => l.exit?.pit).length}, holds ${holds.length}`);
holds.forEach((h) => console.log(`  HOLD leg ${h.leg} L${h.level}: ${h.presser} for `
    + `${h.ticks} ticks, opens ${h.opens.join(' ')}`));
if (VERBOSE) {
    legs.forEach((l, i) => console.log(`  ${String(i).padStart(2)} L${l.level} `
        + `boot(${legBoots[i].x},${legBoots[i].y}) -> `
        + `${l.exit ? (l.exit.pit ? `FALL(${l.exit.pit.tx},${l.exit.pit.ty})`
            : `t(${l.exit.x},${l.exit.y})`) : 'END'}`
        + `${l.targets.length ? `  targets: ${l.targets
            .map((t) => `(${t.x},${t.y})${t.hold ? `[hold ${t.hold.ticks}]` : ''}`)
            .join(' ')}` : ''}`
        + `${l.contacts ? `  contacts: ${l.contacts.join(' ')}` : ''}`));
}

// ── segments ──────────────────────────────────────────────────────────
const boundaries = R2_SEGMENT_BOUNDARIES.map(([level, occurrence], i) => {
    let seen = 0;
    for (let li = 0; li < legs.length; li++) {
        if (legs[li].level !== level) continue;
        seen++;
        if (seen === occurrence) return li;
    }
    throw new Error(`segment boundary ${i}: the route enters L${level} fewer than `
        + `${occurrence} times`);
});
console.log(`segment boundaries at legs ${boundaries.join(', ')}`);

const route = {
    generated_by: 'scripts/procgen/plan-seedling-r2-route.mjs',
    description: 'The R2 walk: every item room still reachable with the SOLIDS BACK, '
        + 'over the (level, component) graph of the POST-CLEAR geometry, with pits as '
        + 'a modelled transport and one HOLD on L71\'s button. Legs carry no targets '
        + 'except where a hold needs them — entering an item room IS collection at '
        + 'this rung.',
    boot: { ...R2_BOOT },
    noHazards: [...R2_NO_HAZARDS],
    item_order: visitOrder,
    start_node: START,
    grants,
    persistence: clears.map((c) => ({ level: c.level, tag: c.tag, note: c.note })),
    persistence_refused: refusedClears
        .filter((c) => routeLevels.has(c.level))
        .map((c) => ({ level: c.level, tag: c.tag, why: c.why })),
    holds,
    segment_boundaries: boundaries,
    leg_boots: legBoots,
    legs,
};

if (g.unbuildable.size > 0) {
    const onRoute = [...g.unbuildable.keys()].filter((l) => routeLevels.has(l));
    console.log(`levels that do not build (${g.unbuildable.size}), on the route: `
        + `${onRoute.join(', ') || 'none'}`);
}
if (WRITE) {
    writeFileSync(OUT, `${JSON.stringify(route, null, 2)}\n`);
    console.log(`\nwrote ${OUT}`);
} else {
    console.log('\n(dry run — pass --write to update fixtures/r2-route.json)');
}
