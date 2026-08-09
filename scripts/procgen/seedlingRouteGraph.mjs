#!/usr/bin/env node
/**
 * seedlingRouteGraph — the `(level, component)` reachability graph the
 * seedling route planners walk, with ONE implementation and two callers.
 *
 * Region-atlas Phase 8, subtractive ladder. Lifted VERBATIM out of
 * `plan-seedling-r2-route.mjs` at rung R3 slice 0, when the R3 feasibility
 * recon needed the same geometry under a DIFFERENT clear list. Every
 * comment below is R2's, and every one of them names a failure that was
 * paid for once — a second transcription is how they get paid for twice
 * (`levelRun.js` is the precedent: the driver's world swap and the
 * runner's are one implementation because two would be wrong together).
 *
 * What the caller supplies is the EXPERIMENT: the clear list, the plan
 * relaxations, the lattice and the hold-tick floor. What it gets back is
 * the graph and the searches over it; the tour, the leg synthesis and the
 * route file stay in the caller, because those are the rung's claim.
 *
 * ⚠ The R2 route file is a COMMITTED artifact and this refactor must not
 * move it. `plan-seedling-r2-route.mjs --write` followed by a clean
 * `git diff` is the gate, and it is cheap enough to run every time.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { contactKey, nodeCentre, plannerObstacleAt } =
    await import(join(MODULE, 'botDriverV2.js'));

export { TILE_SIZE };

/**
 * Build the graph.
 *
 * @param {object}   opts
 * @param {Function} opts.source      `(level) => levelRecord`
 * @param {Array}    opts.clears      `[{level, tag}]` applied when a world is built
 * @param {object}   opts.plan        the plan half of `relax`, minus the lattice
 * @param {number}   opts.lattice     planning cells per tile edge
 * @param {number}   opts.holdTicks   the hold FLOOR a hold edge declares
 * @param {number}   opts.levelCount  how many levels to scan
 * @param {object=}  opts.cache       `{worlds, components}` Maps reused across
 *                                    calls; keyed by level AND its cleared
 *                                    tags, so two runs differing by one clear
 *                                    share every other level's flood
 * @param {Set=}    opts.excludeLevels levels this caller's census could not
 *                                     build when its route was authored —
 *                                     see the docblock below
 */
export function makeRouteGraph({
    source, clears, plan, lattice, holdTicks, levelCount, cache,
    excludeLevels = null,
}) {
    /** The plan half of `relax`, exactly as `synthesizeLegs` derives it. */
    const PLAN = { ...plan, lattice };
    /** Lattice cells per tile row — the component maps are in LATTICE cells. */
    const CELLS = TILE_SIZE / lattice;
    const R2_LATTICE = lattice;
    const R2_HOLD_TICKS = holdTicks;
    const LEVEL_COUNT = levelCount;

    function planWith(clears) {
        const clearedByLevel = new Map();
        for (const c of clears) {
            if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
            clearedByLevel.get(c.level).push(c.tag);
        }

        // ⚠ THE CACHE KEY IS THE LEVEL PLUS ITS OWN CLEARED TAGS, never the
        // level alone. A clear only affects the level it names (the R2
        // planner asserts exactly that when it prunes), so 115 of 116 floods
        // are identical between two runs that differ by one clear — which is
        // what makes R3's drop-one-out necessity sweep 25 single-level
        // rebuilds instead of 25 whole-map floods. Keying on the level alone
        // would hand a run the PREVIOUS run's geometry and every answer after
        // the first would be a fact about a map nobody planned over.
        const levelKey = (level) =>
            `${level}|${[...(clearedByLevel.get(level) ?? [])].sort((a, b) => a - b).join(',')}`;
        const worlds = cache?.worlds ?? new Map();
        const unbuildable = new Map();
        function worldFor(level) {
            const wk = levelKey(level);
            if (worlds.has(wk)) {
                const w = worlds.get(wk);
                if (w === null && !unbuildable.has(level)) unbuildable.set(level, 'cached');
                return w;
            }
            let world = null;
            // ⛔ THE FROZEN-CENSUS PIN. `excludeLevels` is not an
            // optimisation and it is not a crutch: a committed route file is
            // an ARTIFACT, and the graph it was authored over is part of what
            // makes it reproducible. R5 widened the `blocking` census from
            // the 47 route levels to the whole map (31 levels that threw now
            // build), which gives the BFS edges R3 and R4 never had — and the
            // R4 planner promptly authored a route one leg SHORTER than the
            // one whose six tapes are recorded and frozen. Every caller
            // therefore names the level set its own rung could build, by
            // number, and `--write` goes back to leaving a clean `git diff`.
            // (This is the "pin frozen historical sets BY NAME" rule: a
            // predicate that happened to exclude them would rot silently the
            // next time the census moves.)
            if (excludeLevels?.has(level)) {
                unbuildable.set(level, 'excluded by this caller\'s frozen census pin');
                worlds.set(wk, null);
                return null;
            }
            try {
                const cleared = clearedByLevel.get(level);
                world = buildLevelWorld(source(level), cleared ? { cleared } : undefined);
            } catch (e) {
                unbuildable.set(level, e.message);
            }
            worlds.set(wk, world);
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

        const componentsCache = cache?.components ?? new Map();
        /** `Map<"tx,ty", componentId>` for one level, 4-connected. */
        function componentsOf(level, open = null) {
            const key = open === null
                ? levelKey(level)
                : `${levelKey(level)}#${[...open].sort().join(',')}`;
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

        /**
         * R5: a DIRECTED cell-level flood from one standing position.
         *
         * ⛔ WHY THIS CANNOT BE A COMPONENT FLOOD. A component is an
         * undirected notion, and R4 shipped the ladder's first DIRECTED
         * edge rule: `climbsArmedWaterfall` refuses an upward STEP rather
         * than a cell, because a waterfall is something a route crosses
         * downward all the time. Ask the component machinery about an armed
         * map and it answers optimistically — the two halves of level 0 are
         * one blob because the band is walkable *downward*. The R5 question
         * ("is there a FEATHERLESS crossing of L0's band?") is precisely the
         * one an undirected flood cannot be asked.
         *
         * ⚠ AND IT IS A FIXED POINT, not a flood. Items open doors: the
         * conch arms water, the feather arms an upward waterfall step, the
         * darkshield opens a shield lock, the darksuit makes lethal terrain
         * crossable. So the caller floods, harvests the pickups it reached,
         * and floods again until nothing new appears. `opts.onInventory`
         * is where that loop hooks in.
         *
         * ⚠ PERMISSIVE BY DESIGN, and it says which permissions it took.
         * A kill lock is treated as PASSABLE (its bill is reported, not
         * priced), and so is a `Lock` with a presser somewhere in its level.
         * That is the same policy `componentsAround` states: too strict
         * loses reachability in silence, too loose offers the tour an edge
         * the driver refuses BY NAME before anything is recorded. Every
         * permission taken comes back in `assumed`.
         *
         * @param {object}   o
         * @param {object}   o.start        `{level, x, y}` in PIXELS
         * @param {object}   o.inventory    threaded into `plan` for the
         *                                  planner's own item gates
         * @param {Function} o.stepRefusal  `(world, from, to) => boolean`,
         *                                  cells in LATTICE coordinates
         * @param {Set}      o.openLocks    activator ids treated as open
         * @param {Set=}     o.openBridges  bridge tile keys treated as open
         * @param {Set=}     o.forbidLevels levels the flood must NEVER ENTER —
         *                                  R7 §6.1's trap-boss policy
         *
         * ── R7 slice 0: `forbidLevels`, and why the FILTER lives here ─────
         *
         * ⛔ THREE ROOMS IN THIS GAME ARE TRAPS: L57 (TentacleBeast) and L69
         * (LightBoss) create their exit teleporter only on the boss's death
         * (`TentacleBeast.as:213`, `LightBossController.as:104`), and L82 is
         * the LavaBoss, whose body IS the door. A planner that wanders in
         * unprepared soft-locks the run, so the ruled policy is NEVER ENTER
         * and the question slice 0 must answer is whether that policy costs
         * the collect-all anything.
         *
         * The filter is HERE, in the function that resolves an exit's
         * destination, rather than in the consumer, because a consumer that
         * re-derived "which cells are the entry to L82" would be a second
         * transcription of `exitsOf`'s dilate-the-volume rule — and the two
         * would drift. The consumer names the LEVELS; this code decides which
         * CELLS that means, and reports them back in `forbidden` so the same
         * caller can run the stricter arm (the cells refused outright, not
         * merely the transition) without transcribing anything either.
         *
         * ⚠ ADDITIVE AND DEFAULT-NULL: with `forbidLevels` unset every line
         * below is the code R5 ran, so `recon-seedling-r5.mjs --flood`
         * reproduces its committed numbers.
         */
        function directedFlood({
            start, inventory = null, stepRefusal = null, openLocks = null, openBridges = null,
            forbidLevels = null,
        }) {
            const PLAN_I = inventory ? { ...PLAN, inventory } : PLAN;
            const free = (world, cx, cy, opts = null) => {
                if (cx < 0 || cy < 0
                    || cx >= world.width * CELLS || cy >= world.height * CELLS) return false;
                const c = nodeCentre(cx, cy, R2_LATTICE);
                try {
                    return plannerObstacleAt(world, c.x, c.y, null,
                        { ...PLAN_I, openActivators: openLocks, openBridges, ...(opts ?? {}) }) === null;
                } catch { return false; }
            };
            /**
             * The ring test for a PIT, which is looser by exactly one thing.
             *
             * A leg may DECLARE the contacts it starts inside (R1's forced-
             * contact rule), and three of the ladder's committed pit exits are
             * exactly that: L12's pit to L83 sits inside the 14-entity `pull`
             * cluster's avoid volume, and the R3 route takes it as a leg's
             * named `exit: {pit}`. Asking "is this cell free WITH avoid
             * volumes" therefore reports the whole underworld unreachable —
             * D7, `darkshield` and `darksuit` with it. So the pit ring is
             * tested with `avoidVolumes` off, and every pit ring that only
             * exists because of it is reported as a permission.
             */
            const freeForPit = (world, cx, cy) => free(world, cx, cy, { avoidVolumes: false });

            /**
             * `Map<"cx,cy", transition[]>` over the FREE cells a trigger or
             * pit tile can be walked into FROM.
             *
             * ⛔ NOT "the cells the volume covers". A trigger volume and a pit
             * tile are both planner-forbidden floor, so the obvious reading —
             * step into the exit cell — never fires: the player BOX overlaps
             * the volume from cells outside it too, so the flood meets a
             * blocked ring that is not the volume's own cells and stops with
             * the exit one step away. That was the first cut, and the control
             * caught it: with every hazard coerced and no clears the flood
             * reached 25 levels and MISSED THE SWORD, which R1 collects in
             * four hops.
             *
             * The faithful reading is `componentsAround`'s, which the hold-edge
             * derivation has used since R2: dilate the volume by one lattice
             * cell and take the cells there the player can actually stand in.
             *
             * Keyed by level AND the flood's own open set, because `free`
             * depends on both.
             */
            const exitCache = new Map();
            function exitsOf(level) {
                const key = `${levelKey(level)}#${openLocks ? [...openLocks].sort().join(',') : ''}`;
                if (exitCache.has(key)) return exitCache.get(key);
                const world = worldFor(level);
                const map = new Map();
                if (!world) { exitCache.set(key, map); return map; }
                const mark = (rect, payload, test = free) => {
                    const c0 = Math.floor(rect.x / R2_LATTICE) - 1;
                    const c1 = Math.ceil(rect.right / R2_LATTICE);
                    const r0 = Math.floor(rect.y / R2_LATTICE) - 1;
                    const r1 = Math.ceil(rect.bottom / R2_LATTICE);
                    // R7 §6.1: a transition INTO a forbidden level is not an
                    // edge. Its ring cells are still reported (below), so the
                    // caller can refuse standing on them too.
                    const banned = Boolean(forbidLevels?.has(payload.level));
                    for (let cy = r0; cy <= r1; cy += 1) {
                        for (let cx = c0; cx <= c1; cx += 1) {
                            if (!test(world, cx, cy)) continue;
                            if (test !== free && !free(world, cx, cy)) {
                                assumed.set(`L${level} pit@${payload.via}`,
                                    'its ring is standable only with avoid volumes off — '
                                    + 'a leg-declared forced contact (R1\'s rule)');
                            }
                            const k = `${cx},${cy}`;
                            if (banned) {
                                if (!forbidden.has(level)) forbidden.set(level, new Map());
                                const f = forbidden.get(level);
                                if (!f.has(k)) f.set(k, []);
                                f.get(k).push(`${payload.kind} -> L${payload.level} @${payload.via}`);
                                continue;
                            }
                            if (!map.has(k)) map.set(k, []);
                            map.get(k).push(payload);
                        }
                    }
                };
                for (const tp of world.teleporters) {
                    if (tp.deactivated) continue;
                    const ttx = Math.floor(tp.x / TILE_SIZE);
                    const tty = Math.floor(tp.y / TILE_SIZE);
                    // A trigger tile that is ALSO a pit tile is not an exit —
                    // which of the two fires is FlashPunk bookkeeping the
                    // physics refuses to transcribe. Two exist in the extract.
                    if (world.pitTiles.some((t) => t.tx === ttx && t.ty === tty)) continue;
                    const dest = resolveArrival(tp.to, tp.playerx, tp.playery, []);
                    if (!dest) continue;
                    mark(tileRect(ttx, tty),
                        { kind: 'teleporter', level: dest.level, boot: dest.boot, via: `${tp.x},${tp.y}` });
                }
                if (world.fallthrough) {
                    for (const tile of world.pitTiles) {
                        const ctor = fallCtor(world, tile);
                        const dest = resolveArrival(ctor.level, ctor.x, ctor.y, []);
                        if (!dest) continue;
                        mark(tileRect(tile.tx, tile.ty),
                            { kind: 'fall', level: dest.level, boot: dest.boot, via: `${tile.tx},${tile.ty}` },
                            freeForPit);
                    }
                }
                exitCache.set(key, map);
                return map;
            }

            const seen = new Set();
            const assumed = new Map();
            /** `Map<level, Map<"cx,cy", why[]>>` — rings of refused exits. */
            const forbidden = new Map();
            const arrivals = [];
            const frontier = [];
            const push = (level, cx, cy) => {
                const k = `${level}:${cx},${cy}`;
                if (seen.has(k)) return;
                seen.add(k);
                frontier.push({ level, cx, cy });
            };
            const enter = (level, ctorX, ctorY, why) => {
                const dest = resolveArrival(level, ctorX, ctorY, []);
                if (!dest) return;
                arrivals.push({ ...dest, why });
                const world = worldFor(dest.level);
                if (!world) return;
                const px = dest.boot.x + TILE_SIZE / 2;
                const py = dest.boot.y + TILE_SIZE / 2;
                // The arrival cell is INSIDE its own trigger by construction
                // (the forced-contact rule), so seed the ring around it the
                // way `resolveStanding` does rather than the cell itself.
                const acx = Math.floor(px / R2_LATTICE);
                const acy = Math.floor(py / R2_LATTICE);
                let any = false;
                for (let dy = -2; dy <= 2; dy += 1) {
                    for (let dx = -2; dx <= 2; dx += 1) {
                        if (free(world, acx + dx, acy + dy)) { push(dest.level, acx + dx, acy + dy); any = true; }
                    }
                }
                if (!any) arrivals[arrivals.length - 1].stranded = true;
            };

            enter(start.level, start.x, start.y, 'boot');

            while (frontier.length > 0) {
                const cur = frontier.pop();
                const world = worldFor(cur.level);
                if (!world) continue;
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const nx = cur.cx + dx;
                    const ny = cur.cy + dy;
                    if (!free(world, nx, ny)) continue;
                    if (stepRefusal
                        && stepRefusal(world, { tx: cur.cx, ty: cur.cy }, { tx: nx, ty: ny })) {
                        continue;
                    }
                    push(cur.level, nx, ny);
                }
                for (const exit of exitsOf(cur.level).get(`${cur.cx},${cur.cy}`) ?? []) {
                    const ek = `exit:${cur.level}:${exit.kind}:${exit.via}`;
                    if (seen.has(ek)) continue;
                    seen.add(ek);
                    enter(exit.level, exit.boot.x, exit.boot.y,
                        `${exit.kind} L${cur.level}@${exit.via}`);
                }
            }
            return { seen, arrivals, assumed, forbidden };
        }

        return {
            worldFor, componentAt, componentsOf, componentsTouching, edges, bfs,
            pathBetween, unbuildable, holdEdges, clearedByLevel,
            // R3: which components a VOLUME can be walked into from. R2 used
            // this internally to derive hold edges; R3's tour needs it to
            // narrow "reached" from a component of the LEVEL to the pickup's
            // own tile, so it is exported rather than transcribed a second
            // time.
            componentsAround,
            // R5: see the docblock. Additive — nothing above it changed, and
            // `plan-seedling-r{2,3,4}-route.mjs --write` must still leave a
            // clean `git diff`.
            directedFlood,
        };
    }
    return planWith(clears);
}
