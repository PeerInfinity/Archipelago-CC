// Region-atlas → MAZE substrate projection
// (CC/docs/plans/region-atlas-plan.md, Phase 5b).
//
// The Phase-4 projection binds an atlas region to the REAL recompiled game, which
// needs a 31 MB machine-local wasm artifact. This one binds the same region to
// the maze substrate instead: the same geometry, the same item gating, walkable
// in the browser with nothing but the committed repo — which is what makes the
// in-app suite able to test it at all.
//
// The two-truths rule (Phase 5b ruling): the atlas and the game's semantics
// tables are the single source of truth. Nothing here hand-codes Seedling
// behaviour. The tile partition is RECOMPUTED from the map document through the
// game-agnostic analyzer (it is deliberately never persisted — plan, Phase 5a),
// while the RULES and the sub-region identities come from the atlas, which also
// holds the hand-authored rows the analyzer cannot write. A recomputed partition
// that disagrees with the atlas's `sub_regions` is therefore a hard error: the
// atlas is stale against the terrain it describes. Disagreement is not mere
// inequality — a producer may prune a door-less pocket, so the atlas may keep a
// subset (see `projectRegionToMaze`) — and a game whose atlas was analysed on its
// OWN grid (an overlay) must hand the projection that grid, or the recompute
// answers a different question.
//
// GAME-AGNOSTIC, like the analyzer core: the caller supplies `gridFor(region)`
// (the game's semantics module builds it) plus `conditionKey` /
// `resolveCondition`. Seedling's wiring lives in flashPanel/seedlingAtlasAnalysis.js.
//
// --- what a sub-region becomes ----------------------------------------------
//
// One maze world per AP (sub-)region, sized to the atlas region's `bounds` and
// using REGION-LOCAL tile coordinates (atlas tile − bounds origin), so every
// world of one region shares one coordinate space:
//
//   floor          the sub-region's own component cells
//   wall           everything else — including other sub-regions, so a crossing
//                  is the ONLY way out (the maze grid is binary; semantics live
//                  in the sparse overlays, per the X1 ruling)
//   boundary exit  an exit tile at the atlas exit's `entrance_tile`, carrying the
//                  AP exit name the graph projection minted (the registry keys
//                  exits on `exitName`, and procgenPlayer looks a crossing up by
//                  the AP name — so this is a hard requirement, not metadata)
//   crossing       an exit tile on the crossing material's FIRST cell out of this
//                  sub-region, plus a `clear_set_type: 'rule'` obstacle carrying
//                  the atlas row's `access_rule`. Stepping on it is impossible
//                  without the items and produces a real `user:regionMove` with
//                  them — the invariant this projection exists to keep
//   location       an item overlay at the location's tile, carrying its AP
//                  `locationName`, so a check fires through the maze's ordinary
//                  pickup path
//
// A door drawn on a wall tile is the NORMAL case in a real game map (Seedling's
// house door sits inside a building whose per-pixel mask this transcription does
// not have), so an exit or location tile that is not walkable is forced to floor
// and, when it is not adjacent to its own sub-region, a corridor is CARVED to it
// through the non-wall cells between. A carved cell keeps its own gate: carving
// a water tile emits the water's rule as an obstacle rather than a free pass.
// Every carve is reported.
//
// --- the exit-id invariant ---------------------------------------------------
//
// A maze payload's `exit_id` IS its `exitName` (check any committed maze preset:
// `{exit_id: 'exit_1', exitName: 'exit_1'}`), and that identity is load-bearing
// rather than cosmetic. mazeRoomEngine keys `world.exits` on `exit_id`, while
// the panel publishes `user:regionMove` with `exitName` and
// procgenPlayer.handleRegionMove resolves the arrival by asking the SOURCE world
// for `exits.get(exitName)` and reading its `targetExitId`. Key them apart and
// that lookup misses, `targetExitId` is never read, and every arrival silently
// falls back to the region's entrance tile instead of the crossing the player
// walked through. So both are the AP exit name here, and `targetExitId` is the
// AP exit name of the edge coming BACK. The atlas's own short id rides along as
// `atlas_exit_id` for traceability; nothing at run time reads it.
//
// Deterministic: no clock, no rng, everything emitted in atlas/geometry order,
// so the committed preset carries an exact `--check` regeneration gate.
//
// Headless-safe: no top-level await, no literal node: imports.

import { apRegionName, internalExitSource } from './regionAtlasValidator.js';
import { analyzeRegion, simplifyRule, describeRule } from './regionAtlasAnalyzer.js';

/** Maze tile values (mazeRoomEngine's TILE_FLOOR / TILE_WALL — kept in sync by test). */
export const MAZE_TILE_FLOOR = 0;
export const MAZE_TILE_WALL = 1;

/** The substrate a maze-flavoured sidecar binds to. */
export const MAZE_SUBSTRATE = 'maze';

/** Item id used for a location the atlas records with no `vanilla_item`. */
export const ATLAS_LOCATION_SLOT_ITEM = 'atlas_location';

const DIRS = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

const crossingExitId = (targetSubRegion) => `cross_${targetSubRegion}`;
const directedKey = (from, to) => `${from}>${to}`;

/** The (sub-)regions one atlas region projects into, paired with their AP names. */
function bindingsFor(region) {
    const subs = region.subgraph?.sub_regions;
    return Array.isArray(subs) && subs.length > 0
        ? subs.map((sub) => ({ sub, apName: apRegionName(region.region_id, sub) }))
        : [{ sub: null, apName: apRegionName(region.region_id) }];
}

/** Does an exit/location belong to sub-region `sub`? (null sub = region has no subgraph.) */
const boundTo = (member, sub) => (sub === null ? true : member.sub_region === sub);

/**
 * The rule for OCCUPYING a cell, from the conditions its terrain declares.
 * Returns `{ rule, unresolved }`; `rule` is null when the cell is unconditional
 * (or when nothing resolved, which the caller reports rather than papering over).
 */
function occupancyRule(cell, resolveCondition) {
    const parts = [];
    const unresolved = [];
    for (const condition of cell.conditions ?? []) {
        const resolved = resolveCondition(condition);
        if (resolved) parts.push(resolved); else unresolved.push(condition);
    }
    if (parts.length === 0) return { rule: null, unresolved };
    return { rule: simplifyRule(parts.length === 1 ? parts[0] : { rule: 'And', children: parts }), unresolved };
}

/**
 * One sub-region's world under construction. Tiles start as all wall; the
 * builder's job is to open exactly what belongs to this piece.
 */
function createWorldBuilder(grid) {
    const tiles = new Array(grid.width * grid.height).fill(MAZE_TILE_WALL);
    return {
        tiles,
        obstacles: new Map(), // posKey -> obstacle id
        items: new Map(), // posKey -> { id, locationName }
        obstacleLib: {},
        byRule: new Map(), // rule JSON -> obstacle id (one lib entry per distinct rule)
        exits: [],
        exitIds: new Set(),
        floor(x, y) { tiles[y * grid.width + x] = MAZE_TILE_FLOOR; },
        isFloor(x, y) {
            if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
            return tiles[y * grid.width + x] === MAZE_TILE_FLOOR;
        },
        /** Register a rule-typed obstacle at (x, y), reusing the lib entry for an identical rule. */
        gate(x, y, rule) {
            const k = JSON.stringify(rule);
            let id = this.byRule.get(k);
            if (id === undefined) {
                id = `atlas_gate_${this.byRule.size}`;
                this.byRule.set(k, id);
                this.obstacleLib[id] = {
                    id,
                    name: describeRule(rule),
                    clear_set_type: 'rule',
                    clear_rule: rule,
                    color: '#b06eb8',
                    display: { mode: 'tree' },
                };
            }
            this.obstacles.set(`${x},${y}`, id);
            return id;
        },
    };
}

/**
 * Force a tile to floor, carving a corridor to `component` when the tile is not
 * adjacent to it. Carving never crosses a `wall` cell — a real wall stays a wall
 * — and a carved cell that gates its own occupancy keeps that gate.
 *
 * @returns {Array<object>} the notes to report (carves, and failures to reach)
 */
function openTileTowards(builder, grid, component, tile, label, resolveCondition) {
    const notes = [];
    const [lx, ly] = tile;
    const inComponent = new Set(component.tiles.map(([x, y]) => `${x},${y}`));
    builder.floor(lx, ly);
    if (inComponent.has(`${lx},${ly}`)) return notes;

    const adjacent = DIRS.some(([dx, dy]) => inComponent.has(`${lx + dx},${ly + dy}`));
    // The tile itself may gate its own occupancy (a chest, a water tile). Keep
    // that gate: a location standing in water still needs the swim.
    const ownCell = grid.cells[ly * grid.width + lx];
    if (ownCell.kind === 'wall') {
        notes.push({
            kind: 'opened_solid', tile, label,
            message: `${label} at [${tile}] sits on solid terrain (${ownCell.labels?.join(', ') || 'wall'}) — opened, because that is where the atlas says the way through is`,
        });
    }
    const own = occupancyRule(ownCell, resolveCondition);
    if (own.rule) builder.gate(lx, ly, own.rule);
    if (own.unresolved.length > 0) {
        notes.push({
            kind: 'opened_unconditional', tile, label,
            message: `${label} sits on terrain whose condition has no AP item behind it — opened WITHOUT a gate`,
        });
    }
    if (adjacent) return notes;

    // Breadth-first through the non-wall cells to the nearest cell of this
    // sub-region's own component, then carve the path it found.
    const prev = new Int32Array(grid.width * grid.height).fill(-2);
    const start = ly * grid.width + lx;
    prev[start] = -1;
    let frontier = [start];
    let hit = -1;
    while (frontier.length > 0 && hit === -1) {
        const next = [];
        for (const i of frontier) {
            const cx = i % grid.width;
            const cy = (i - cx) / grid.width;
            for (const [dx, dy] of DIRS) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
                const n = ny * grid.width + nx;
                if (prev[n] !== -2) continue;
                if (inComponent.has(`${nx},${ny}`)) { prev[n] = i; hit = n; break; }
                if (grid.cells[n].kind === 'wall') continue;
                prev[n] = i;
                next.push(n);
            }
            if (hit !== -1) break;
        }
        frontier = next;
    }
    if (hit === -1) {
        notes.push({
            kind: 'unreachable', tile, label,
            message: `${label} at [${tile}] cannot be reached from sub-region "${component.id}" without crossing a wall — it is walkable in the projection but isolated`,
        });
        return notes;
    }

    const carved = [];
    for (let i = prev[hit]; i !== start && i !== -1; i = prev[i]) {
        const cx = i % grid.width;
        const cy = (i - cx) / grid.width;
        const cell = grid.cells[i];
        builder.floor(cx, cy);
        const { rule, unresolved } = occupancyRule(cell, resolveCondition);
        if (rule) builder.gate(cx, cy, rule);
        carved.push({
            tile: [cx, cy], kind: cell.kind, gated: !!rule, unresolved: unresolved.length,
        });
    }
    if (carved.length > 0) {
        carved.reverse();
        notes.push({
            kind: 'carved', tile, label, cells: carved,
            message: `${label} at [${tile}] is not adjacent to sub-region "${component.id}" — carved ${carved.length} cell(s) to it (`
                + `${carved.map((c) => `[${c.tile}] ${c.kind}${c.gated ? ' gated' : ''}`).join(', ')})`,
        });
        for (const c of carved) {
            if (c.kind === 'directional' || c.kind === 'sink') {
                notes.push({
                    kind: 'carved_through_directional', tile: c.tile, label,
                    message: `the corridor to ${label} crosses a ${c.kind} cell at [${c.tile}], whose per-direction physics the projection does not model — it is passable both ways here`,
                });
            }
            if (c.kind === 'manual' && !c.gated) {
                notes.push({
                    kind: 'carved_through_manual', tile: c.tile, label,
                    message: `the corridor to ${label} crosses a blocker with no derivable rule at [${c.tile}] — passable in the projection`,
                });
            }
        }
    }
    return notes;
}

/**
 * Which directed crossings of one region the projection can realise, and where
 * each one's exit tile sits.
 *
 * A row with a rule projects as a gated crossing. A row the ANALYZER wrote with
 * no rule is a genuinely free crossing and projects ungated. A row with no rule
 * that the analyzer did NOT write is a crossing awaiting a hand-written rule:
 * the compiler makes it a FREE AP exit (the format's default), but a free AP
 * exit must never become a free WALK, so the projection WALLS it and says so.
 */
function planCrossings(region, crossings) {
    const byDirected = new Map(crossings.map((c) => [directedKey(c.from, c.to), c]));
    const planned = new Map(); // "from>to" -> { from, to, tile, rule }
    const notes = [];

    for (const row of region.subgraph?.internal_exits ?? []) {
        const directions = [[row.from, row.to]];
        if (row.bidirectional === true) directions.push([row.to, row.from]);
        for (const [from, to] of directions) {
            const key = directedKey(from, to);
            if (planned.has(key)) continue; // a duplicate row; the first one stands
            const rule = row.access_rule ?? null;
            if (!rule && internalExitSource(row) !== 'analyzer') {
                notes.push({
                    kind: 'walled_unlabelled', from, to,
                    message: `crossing ${from} -> ${to} has no access_rule and was not written by the analyzer — it needs hand authoring, so the projection WALLS it (an unlabelled crossing compiles to a free AP exit, which must not become a free walk)`,
                });
                continue;
            }
            const crossing = byDirected.get(key);
            const entry = crossing?.tiles?.[0];
            if (!entry) {
                notes.push({
                    kind: 'no_geometry', from, to,
                    message: `crossing ${from} -> ${to} is in the atlas but the tile map shows no route for it — the projection WALLS it (re-analyze the region)`,
                });
                continue;
            }
            planned.set(key, { from, to, tile: entry, rule, routes: crossing.conditionSets?.length ?? 0 });
        }
    }
    // A crossing whose rule the analyzer built from several routes only gets the
    // FIRST route's entry cell; the rule still ORs them all, so the logic is
    // right and the geometry realises one of the ways across.
    for (const plan of planned.values()) {
        if (plan.routes > 1) {
            notes.push({
                kind: 'single_route', from: plan.from, to: plan.to,
                message: `crossing ${plan.from} -> ${plan.to} has ${plan.routes} distinct routes; the projection places its exit on the cheapest one's first cell at [${plan.tile}] (the rule still permits every route)`,
            });
        }
    }
    return { planned, notes };
}

/**
 * Project ONE atlas region into maze sidecars — one per AP (sub-)region.
 *
 * @param {object} region the atlas region
 * @param {object} grid the analyzer cell grid for it (game-supplied)
 * @param {object} ctx
 * @param {(condition:object)=>object|null} ctx.resolveCondition
 * @param {(condition:object)=>string} ctx.conditionKey
 * @param {(regionId:string, exitId:string)=>object|undefined} ctx.wiredExit what the
 *   graph projection made of a boundary exit: { apExitName, targetApRegion, targetExitId }
 * @param {(regionId:string, from:string, to:string)=>string|undefined} ctx.internalExitName
 * @param {number} ctx.tileSize
 * @returns {{ sidecars: object, notes: Array, analysis: object }}
 */
export function projectRegionToMaze(region, grid, ctx) {
    const { resolveCondition, conditionKey, wiredExit, internalExitName, tileSize } = ctx;
    // ⛓ A level whose entity rows carry an INTERACTION plays as one shared
    // level world (below). Only a compile that supplies `levelEntitiesFor`
    // asks — every other compile is byte-identical to before.
    const entities = typeof ctx.levelEntitiesFor === 'function' ? ctx.levelEntitiesFor(region, grid) : null;
    if (levelHasInteraction(entities)) return projectLevelWorld(region, grid, ctx, entities);
    const analysis = analyzeRegion(region, grid, { conditionKey, resolveCondition });
    const components = analysis.components;
    const bindings = bindingsFor(region);

    // The atlas and the terrain have to agree about what the pieces ARE before
    // anything is projected onto them. Disagreement means the atlas is stale.
    //
    // ⛓ AGREEMENT IS NOT EQUALITY (tile-primitives levels-gap3, measured over
    // all 115 playthrough regions). A producer may PRUNE a component nothing
    // enters and nothing stands in (the playthrough generator's
    // `pruneUnreachableSubRegions`): the atlas then declares a SUBSET, and a
    // region pruned to one piece declares none. So the check is: every
    // declared sub-region is a computed component, and every component the
    // atlas did not keep binds no exit and no location — a pruned pocket,
    // walled here and named. When the game also supplies the atlas's persisted
    // partition, each declared component must hold exactly the partition's
    // tiles too: a recompute on a grid the atlas was NOT analysed on fails
    // there, by name.
    const declared = bindings.map((b) => b.sub).filter((s) => s !== null).sort();
    const computed = components.map((c) => c.id).sort();
    const boundIds = new Set(analysis.bindings.filter((b) => b.component).map((b) => b.component.id));
    let soleId = null;
    if (declared.length === 0) {
        if (boundIds.size > 1) {
            throw new Error(
                `atlas region "${region.region_id}" declares no subgraph, but its exits and locations stand in `
                + `${boundIds.size} components (${[...boundIds].sort().join(', ')}) — re-analyze the atlas`,
            );
        }
        if (boundIds.size === 1) soleId = [...boundIds][0];
        else if (components.length === 1) soleId = components[0].id;
        else {
            // ⛓ No dry floor holds anything: every exit and location stands on
            // gated terrain (Seedling's all-water levels). The region IS that
            // terrain, which only a level world carries (every non-wall cell
            // floor, a gated one its own rule obstacle).
            if (typeof ctx.levelEntitiesFor === 'function') {
                return projectLevelWorld(region, grid, ctx, entities ?? []);
            }
            throw new Error(
                `atlas region "${region.region_id}" declares no subgraph, and none of its ${components.length} `
                + 'walkable component(s) holds an exit or a location — every one stands on gated terrain, which '
                + 'only a level world (`levelEntitiesFor`) projects',
            );
        }
    } else {
        const missing = declared.filter((d) => !computed.includes(d));
        if (missing.length > 0) {
            throw new Error(
                `atlas region "${region.region_id}" declares sub_regions [${declared.join(', ')}] but its tile map `
                + `computes [${computed.join(', ')}] — the atlas is stale against the map document; re-analyze it`,
            );
        }
    }
    const kept = new Set(declared.length === 0 ? [soleId] : declared);
    const pockets = components.filter((c) => !kept.has(c.id));
    const boundPocket = pockets.filter((c) => boundIds.has(c.id)).map((c) => c.id);
    if (declared.length > 0 && boundPocket.length > 0) {
        throw new Error(
            `atlas region "${region.region_id}" does not declare [${boundPocket.join(', ')}], but an exit or a `
            + 'location stands in it — the atlas is stale against the map document; re-analyze it',
        );
    }
    const partition = declared.length > 0 && typeof ctx.partitionFor === 'function' ? ctx.partitionFor(region) : null;
    if (partition) {
        const [px, py] = partition.origin ?? [0, 0];
        const ox = grid.origin?.x ?? 0;
        const oy = grid.origin?.y ?? 0;
        for (const c of components.filter((k) => kept.has(k.id))) {
            const ch = SHARED_WORLD_ALPHABET[partition.sub_regions.indexOf(c.id)];
            const mine = new Set(c.tiles.map(([x, y]) => `${x + ox - px},${y + oy - py}`));
            let held = 0;
            partition.rows.forEach((row, y) => [...row].forEach((k, x) => { if (k === ch) held += 1; }));
            const agree = c.tiles.length === held
                && [...mine].every((t) => { const [x, y] = t.split(',').map(Number); return partition.rows[y]?.[x] === ch; });
            if (!agree) {
                throw new Error(
                    `atlas region "${region.region_id}": sub-region "${c.id}" computes ${c.tiles.length} tile(s) but `
                    + `the persisted partition holds ${held} — the projection's grid is not the one the atlas was `
                    + 'analysed on (or the partition is stale); regenerate the partition',
                );
            }
        }
    }

    const componentById = new Map(components.map((c) => [c.id, c]));
    const { planned, notes: crossingNotes } = planCrossings(region, analysis.crossings);
    const notes = crossingNotes.map((n) => ({ region_id: region.region_id, ...n }));
    for (const c of pockets) {
        notes.push({
            region_id: region.region_id,
            kind: 'pruned_pocket',
            message: `component "${c.id}" (${c.tiles.length} tile(s)) is not an AP region of the atlas and holds no `
                + 'exit or location — WALLED',
        });
    }
    const local = (tile) => [tile[0] - (grid.origin?.x ?? 0), tile[1] - (grid.origin?.y ?? 0)];

    const sidecars = {};
    for (const { sub, apName } of bindings) {
        const component = componentById.get(sub === null ? soleId : sub);
        const builder = createWorldBuilder(grid);
        for (const [x, y] of component.tiles) builder.floor(x, y);

        const note = (n) => notes.push({ region_id: region.region_id, sub_region: component.id, ...n });
        /**
         * `entry.exitName` is the id (see the exit-id invariant above); it is
         * globally unique by construction, so a collision here means the graph
         * projection handed out the same name twice and is a bug, not a case.
         */
        const addExit = (entry) => {
            const id = entry.exitName ?? entry.atlas_exit_id;
            if (builder.exitIds.has(id)) {
                note({
                    kind: 'exit_id_collision',
                    message: `two exits of "${apName}" both resolve to the AP exit name "${id}" — the second is DROPPED`,
                });
                return;
            }
            const occupiedAt = builder.exits.findIndex((e) => e.x === entry.x && e.y === entry.y);
            const occupied = occupiedAt === -1 ? null : builder.exits[occupiedAt];
            if (occupied) {
                /**
                 * ⛓⛓⛓ **THE SURVIVOR IS THE ONE THAT ACTUALLY CROSSES** (EDITOR
                 * INTEGRATION W6, M2; plan §11.1 A6 / §11.5 / §11.6 item 3).
                 *
                 * ⛔ **WHY THIS EXISTS.** `levelSetExits` lands each arrival ON
                 * the destination's return door — which is what vanilla itself
                 * does four times, and it is SAFE in the real engine because
                 * `Game.update()`'s `!checked` latch fires one entity per entry.
                 * A maze tile has no such latch: one tile is one crossing. So a
                 * GENERATED, linked 2-room set put two exits on tile [8,8] of
                 * every room, and first-wins kept whichever `region.exits`
                 * happened to list first. MEASURED: `level_0` kept its outbound
                 * and `level_1` kept its ARRIVAL — a ONE-WAY TRAP that AP
                 * reachability cannot see (`connections: 2`,
                 * `unwired_exits: []`, and the player is stuck).
                 *
                 * ⛓ An ARRIVAL-ONLY exit (`targetRegion: null`) is never the
                 * better survivor: it is the far end of a `one_way` link, it
                 * leads nowhere from here, and its whole job is to be a place to
                 * ARRIVE — which the entrance tile already provides. So a real
                 * crossing EVICTS one, in either arrival order.
                 *
                 * ⛔ **TWO REAL CROSSINGS STAY A NAMED COLLISION.** There is no
                 * defensible choice between them and inventing one would be the
                 * silent drop this note exists to prevent. Both branches NAME
                 * the collision; only the survivor differs.
                 */
                const incomingCrosses = entry.targetRegion != null;
                const occupiedCrosses = occupied.targetRegion != null;
                if (incomingCrosses && !occupiedCrosses) {
                    note({
                        kind: 'exit_tile_collision',
                        message: `exit "${id}" wants tile [${entry.x},${entry.y}], already taken by "${occupied.exit_id}" — "${occupied.exit_id}" is ARRIVAL-ONLY (it names no target region) and "${id}" is a real crossing, so "${occupied.exit_id}" is DROPPED (one tile can only cross one way)`,
                    });
                    builder.exits.splice(occupiedAt, 1);
                    builder.exitIds.delete(occupied.exit_id);
                    builder.exitIds.add(id);
                    builder.exits.push({ exit_id: id, ...entry });
                    return;
                }
                note({
                    kind: 'exit_tile_collision',
                    message: `exit "${id}" wants tile [${entry.x},${entry.y}], already taken by "${occupied.exit_id}" — DROPPED (one tile can only cross one way)`,
                });
                return;
            }
            builder.exitIds.add(id);
            builder.exits.push({ exit_id: id, ...entry });
        };

        // --- boundary exits ------------------------------------------------
        for (const exit of region.exits ?? []) {
            if (!boundTo(exit, sub)) continue;
            const wired = wiredExit(region.region_id, exit.exit_id);
            if (!wired) continue; // unwired: omitted from the AP graph, so no crossing here either
            // ⛓ NOR AN ARRIVAL-ONLY ONE (session tile-primitives-grow-levels) —
            // the level world's rule below, for the same reason: an exit tile is
            // a dead end (`isDeadEndExit`), so a landing spot in a corridor cut
            // it. Measured over the whole playthrough: 5 seals (L1, L6, L9, L10
            // — the Sword chest too — and L11). It never landed anything: a
            // one-way arrival names the SOURCE exit, which no tile here carries.
            if (!wired.targetApRegion) {
                note({ kind: 'arrival_only_not_emitted', tile: exit.entrance_tile, message: `arrival-only exit "${exit.exit_id}" at [${exit.entrance_tile}] is a landing spot, not a trigger — not emitted (a return lands by its source region)` });
                continue;
            }
            const [x, y] = local(exit.entrance_tile);
            for (const n of openTileTowards(builder, grid, component, [x, y], `exit "${exit.exit_id}"`, resolveCondition)) note(n);
            if (exit.access_rule) builder.gate(x, y, exit.access_rule);
            addExit({
                x,
                y,
                side: exit.side ?? null,
                exitName: wired.apExitName,
                targetRegion: wired.targetApRegion,
                // The AP exit name of the edge coming back, so arriving lands on
                // the crossing tile rather than the region's entrance.
                targetExitId: wired.returnApExitName ?? null,
                isTeleporter: exit.kind === 'teleporter',
                atlas_exit_id: exit.exit_id,
            });
        }

        // --- crossings out of this sub-region -------------------------------
        for (const plan of planned.values()) {
            if (plan.from !== component.id) continue;
            const [x, y] = local(plan.tile);
            builder.floor(x, y);
            if (plan.rule) builder.gate(x, y, plan.rule);
            const reverse = planned.get(directedKey(plan.to, plan.from));
            if (!reverse) {
                note({
                    kind: 'one_way_arrival', from: plan.from, to: plan.to,
                    message: `crossing ${plan.from} -> ${plan.to} has no projected reverse, so arriving in "${plan.to}" lands on its entrance tile rather than at the crossing`,
                });
            }
            addExit({
                x,
                y,
                side: null,
                exitName: internalExitName(region.region_id, plan.from, plan.to) ?? null,
                targetRegion: apRegionName(region.region_id, plan.to),
                targetExitId: reverse
                    ? internalExitName(region.region_id, plan.to, plan.from) ?? null : null,
                isTeleporter: false,
                atlas_exit_id: crossingExitId(plan.to),
            });
        }

        // --- locations ------------------------------------------------------
        for (const loc of region.locations ?? []) {
            if (!boundTo(loc, sub)) continue;
            const [x, y] = local(loc.tile);
            for (const n of openTileTowards(builder, grid, component, [x, y], `location "${loc.name}"`, resolveCondition)) note(n);
            if (loc.access_rule) builder.gate(x, y, loc.access_rule);
            builder.items.set(`${x},${y}`, {
                id: typeof loc.vanilla_item === 'string' && loc.vanilla_item.length > 0
                    ? loc.vanilla_item : ATLAS_LOCATION_SLOT_ITEM,
                locationName: loc.name,
            });
        }

        // --- assemble --------------------------------------------------------
        const [ex, ey] = component.tiles[0];
        const payload = {
            width: grid.width,
            height: grid.height,
            tiles: builder.tiles,
            entrance: { x: ex, y: ey },
            exits: builder.exits,
            obstacles: [...builder.obstacles].map(([key, id]) => {
                const [x, y] = key.split(',').map(Number);
                return { x, y, id };
            }).sort((a, b) => (a.y - b.y) || (a.x - b.x)),
            items: [...builder.items].map(([key, entry]) => {
                const [x, y] = key.split(',').map(Number);
                return { x, y, id: entry.id, locationName: entry.locationName };
            }).sort((a, b) => (a.y - b.y) || (a.x - b.x)),
            obstacleLib: builder.obstacleLib,
            // Atlas provenance. The maze runtime ignores these; they are what
            // makes a dumped sidecar traceable back to the map it came from.
            atlas_region: region.region_id,
            ...(sub === null ? {} : { atlas_sub_region: sub }),
            ...(Number.isInteger(region.map_ref) ? { level: region.map_ref } : {}),
            tile_size: tileSize,
            origin: { x: grid.origin?.x ?? 0, y: grid.origin?.y ?? 0 },
        };
        sidecars[apName] = { substrate: MAZE_SUBSTRATE, playable_payload: payload };
    }

    // Terrain the semantics tables flagged: it is the projection's business
    // because a cell nobody classified is a cell walled by default.
    for (const u of analysis.unclassified) {
        notes.push({
            region_id: region.region_id, kind: 'unclassified', tile: u.tile,
            message: `nothing classifies ${u.what} at [${u.tile}] — the cell is WALLED in the projection`,
        });
    }
    for (const r of analysis.review) {
        notes.push({
            region_id: region.region_id, kind: 'review', tile: r.tile,
            message: `${r.reason} (at [${r.tile}]) — projected as ordinary floor`,
        });
    }
    for (const b of analysis.boundary_candidates) {
        notes.push({
            region_id: region.region_id, kind: 'sink_walled', tile: b.tile,
            message: `the one-way drop at [${b.tile}] leaves the region and the atlas has no boundary exit for it — WALLED in the projection`,
        });
    }
    return { sidecars, notes, analysis };
}

// --- the shared LEVEL WORLD ---------------------------------------------------
//
// ⚖ "Shared level world" (tile-primitives Stage 2, user 2026-10-21). A level
// whose interaction spans its sub-regions — Seedling L15's block, its button,
// the lock it holds and the rocks on the block's path straddle r1c5 and r1c9 —
// cannot be played or searched as one world per sub-region: each world would
// see half the puzzle. Such a level projects into ONE maze world:
//
//   floor          every non-wall cell of the level
//   gated cell     floor + the rule obstacle of its terrain (water = Swim)
//   block          `blocks` (the cell is floor)
//   button         `buttons` + `buttonLib.<id>.holds` = the group's token
//   lock           an obstacle cleared by the HELD token of its group
//   rock           an obstacle with `clear_set: []` and `struck_by` = one
//                  action per item its condition names (`action_lib`)
//   rope           a rock that, struck, ACTIVATES its group's token and is
//                  the AP `event` (the rope's event location; its cell goes to
//                  the one sub-region it borders)
//   trap           `traps` + `trapLib`: its lane refuses the player while
//                  armed (group token absent for 'unless_active', present for
//                  'while_active'); the conditions the atlas charged that lane
//                  with (`charges`) are DROPPED from its cells — the trap
//                  models them (session tile-primitives-arrow-rope)
//   ownership      `shared_world.rows`: which AP sub-region owns each cell, from
//                  the atlas's own partition — walking from a cell of one into
//                  a cell of another IS the crossing (`user:regionMove`), and
//                  every other cell is "no news"
//
// Every AP region name is kept. The payload is carried ONCE (the level's first
// sub-region); every other sub-region's sidecar is an ALIAS `{substrate,
// shared_world: <key>}` that the play-time warehouse resolves to the same
// world object. Nothing is hand-coded: the entity rows come from the game's
// semantics tables (`levelEntitiesFor`) and the ownership from its persisted
// partition (`partitionFor`), the same two-truths rule as above.
//
// ⛔ What a level world does NOT model is WALLED and named, never opened: a
// cell whose terrain condition has no AP item, a directional or sink cell, an
// unmapped puzzle entity. A wall can only make the world harder than the game,
// which keeps it sound (never a solution the game refuses).

/** The interaction primitives a level-world entity row may name. */
export const LEVEL_WORLD_ENTITY_KINDS = Object.freeze(['block', 'button', 'lock', 'rock', 'rope', 'trap']);

/** The maze's default use keys, in order (mazeKeys DEFAULT_USE_KEYS — kept in sync by test). */
export const LEVEL_WORLD_USE_KEYS = Object.freeze(['z', 'x', 'c', 'v']);

/** The ownership alphabet: index into `shared_world.regions` (the partition's own). */
export const SHARED_WORLD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** The token a button group holds, and the ids of its button / lock entries. */
const groupToken = (group) => `sw_${group}`;
const buttonId = (group) => `button_${group}`;
const lockId = (group) => `lock_${group}`;
const rockId = (actions) => `rock_${actions.join('_')}`;
const ropeId = ([x, y]) => `rope_${x}_${y}`;
const trapId = (group, fires) => `trap_${group}_${fires}`;

/**
 * Does this level's entity list carry an interaction (a block, a button, a
 * rock)? A lock alone is not one: with no button its group can never open,
 * and the per-sub-region projection already walls it.
 */
export function levelHasInteraction(entities) {
    return Array.isArray(entities)
        && entities.some((e) => ['block', 'button', 'rock', 'rope', 'trap'].includes(e.kind));
}

/**
 * Project ONE atlas region with an interaction into a shared level world.
 *
 * @param {object} region the atlas region
 * @param {object} grid the analyzer cell grid for it
 * @param {object} ctx `projectRegionToMaze`'s, plus `partitionFor(region)` →
 *   `{sub_regions, rows, origin:[x,y]}` (the atlas's persisted partition)
 * @param {Array<object>} entities `levelEntitiesFor`'s rows:
 *   `{kind, tiles:[[x,y]…] (atlas tiles), group?, strike?:[{action, item}], label}`
 * @returns {{ sidecars: object, notes: Array, analysis: null, sharedWorld: string }}
 */
export function projectLevelWorld(region, grid, ctx, entities) {
    const { resolveCondition, wiredExit, internalExitName, tileSize } = ctx;
    const regionId = region.region_id;
    const bindings = bindingsFor(region);
    const notes = [];
    const note = (n) => notes.push({ region_id: regionId, ...n });
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const local = (tile) => [tile[0] - ox, tile[1] - oy];
    const inGrid = ([x, y]) => x >= 0 && y >= 0 && x < grid.width && y < grid.height;

    // --- ownership: the atlas's own partition, checked against the atlas ----
    // A region with no subgraph is ONE AP region: it owns every cell, and no
    // partition is needed to say so.
    const unsplit = bindings.length === 1 && bindings[0].sub === null;
    const partition = !unsplit && typeof ctx.partitionFor === 'function' ? ctx.partitionFor(region) : null;
    if (!unsplit && !partition) {
        throw new Error(`atlas region "${regionId}" has an interaction (a level world) but no persisted `
            + 'partition says which sub-region owns which tile — regenerate the partition for this atlas');
    }
    if (partition) {
        const declared = bindings.map((b) => b.sub).sort();
        const held = [...partition.sub_regions].sort();
        if (declared.join('|') !== held.join('|')) {
            throw new Error(`atlas region "${regionId}" declares sub_regions [${declared.join(', ')}] but its `
                + `partition holds [${held.join(', ')}] — the partition is stale against the atlas`);
        }
    }
    const [px, py] = partition?.origin ?? [0, 0];
    /** The binding index owning atlas tile `t`, or -1 ("no news"). */
    const ownerOf = ([tx, ty]) => {
        if (unsplit) return 0;
        const ch = partition.rows[ty - py]?.[tx - px];
        if (!ch || ch === '.') return -1;
        const sub = partition.sub_regions[SHARED_WORLD_ALPHABET.indexOf(ch)];
        return bindings.findIndex((b) => b.sub === sub);
    };

    const builder = createWorldBuilder(grid);
    const claimed = new Set(); // local "x,y" an entity row decides
    const keyOf = (x, y) => `${x},${y}`;

    // --- entity rows ---------------------------------------------------------
    const blocks = [];
    const buttons = [];
    const buttonLib = {};
    const actionLib = {};
    const traps = [];
    const trapLib = {};
    const ropeCells = [];
    // A rope run's cells, by key → the items whose strike cuts it (its cut condition, dropped by the terrain pass).
    const ropeRun = new Map();
    /** True iff `c` resolves to exactly a Has, or an Or of Has, over the item set `items` (a rope's cut). */
    const isCutOf = (c, items) => {
        const rule = resolveCondition(c);
        const has = rule?.rule === 'Has' ? [rule] : rule?.rule === 'Or' ? rule.children : null;
        if (!has || has.some((h) => h?.rule !== 'Has' || (h.args?.count ?? 1) !== 1)) return false;
        const names = new Set(has.map((h) => h.args.item_name));
        return names.size === items.size && [...names].every((n) => items.has(n));
    };
    // The lane conditions a trap MODELS, by key: dropped from its lane cells below.
    const condKey = ctx.conditionKey ?? ((c) => JSON.stringify(c));
    const modelled = new Map(); // "x,y" → Set of condition keys
    const groupsWithButton = new Set();
    for (const e of entities) if (e.kind === 'button') groupsWithButton.add(String(e.group));
    const actionFor = (strike) => {
        if (!actionLib[strike.action]) {
            const used = Object.keys(actionLib).length;
            actionLib[strike.action] = {
                item: strike.item,
                primitive: 'strike',
                condition: 'strikes',
                ...(used < LEVEL_WORLD_USE_KEYS.length ? { key: LEVEL_WORLD_USE_KEYS[used] } : {}),
            };
        } else if (actionLib[strike.action].item !== strike.item) {
            throw new Error(`atlas region "${regionId}": action "${strike.action}" names two items `
                + `(${actionLib[strike.action].item}, ${strike.item})`);
        }
        return strike.action;
    };
    for (const e of entities) {
        if (!LEVEL_WORLD_ENTITY_KINDS.includes(e.kind)) {
            throw new Error(`atlas region "${regionId}": level-world entity kind "${e.kind}" is not one of `
                + `${LEVEL_WORLD_ENTITY_KINDS.join(', ')}`);
        }
        const tiles = (e.tiles ?? []).map(local).filter(inGrid);
        if (tiles.length === 0) {
            note({ kind: 'entity_off_grid', message: `${e.label ?? e.kind} has no tile inside the region — skipped` });
            continue;
        }
        if (e.kind === 'block') {
            if (tiles.length !== 1) {
                throw new Error(`atlas region "${regionId}": ${e.label ?? 'a block'} covers ${tiles.length} tiles; `
                    + 'a maze block is one cell');
            }
            const [x, y] = tiles[0];
            builder.floor(x, y);
            claimed.add(keyOf(x, y));
            blocks.push({ x, y });
            continue;
        }
        if (e.kind === 'button') {
            const group = String(e.group);
            buttonLib[buttonId(group)] = { kind: 'button', holds: groupToken(group) };
            for (const [x, y] of tiles) {
                builder.floor(x, y);
                claimed.add(keyOf(x, y));
                buttons.push({ x, y, id: buttonId(group) });
            }
            continue;
        }
        if (e.kind === 'lock') {
            const group = String(e.group);
            if (!groupsWithButton.has(group)) {
                // No button can ever hold it: walled, exactly as the
                // per-sub-region projection walls an unlabelled crossing.
                note({ kind: 'lock_without_button', message: `${e.label ?? 'a lock'} (group ${group}) has no button in this level — WALLED` });
                for (const [x, y] of tiles) claimed.add(keyOf(x, y));
                continue;
            }
            builder.obstacleLib[lockId(group)] = {
                id: lockId(group),
                name: `lock (group ${group})`,
                kind: 'door',
                clear_set: [[groupToken(group)]],
                color: '#3a7',
            };
            for (const [x, y] of tiles) {
                builder.floor(x, y);
                claimed.add(keyOf(x, y));
                builder.obstacles.set(keyOf(x, y), lockId(group));
            }
            continue;
        }
        if (e.kind === 'trap') {
            const group = String(e.group);
            const id = trapId(group, e.fires);
            trapLib[id] = { kind: 'arrow_trap', name: `arrow trap (group ${group}, fires ${e.fires})`, active: groupToken(group), fires: e.fires };
            const lane = (e.lane ?? []).map(local).filter(inGrid);
            traps.push({ x: tiles[0][0], y: tiles[0][1], id, label: e.label ?? id, lane: lane.map(([x, y]) => ({ x, y })) });
            for (const [x, y] of lane) {
                if (!modelled.has(keyOf(x, y))) modelled.set(keyOf(x, y), new Set());
                for (const c of e.charges ?? []) modelled.get(keyOf(x, y)).add(condKey(c));
            }
            continue;
        }
        // rock / rope
        const strikes = e.strike ?? [];
        if (strikes.length === 0) {
            throw new Error(`atlas region "${regionId}": ${e.label ?? `a ${e.kind}`} names no item that strikes it`);
        }
        const actions = strikes.map(actionFor);
        if (e.kind === 'rope') {
            // ⛓ rules-l39 F1 (⚖ the user 2026-10-23, "(a) One obstacle"): an UNCUT rope is solid over its
            // whole RUN — `RopeStart`'s hitbox is `_xend - _x + 16` wide (`RopeStart.as:26`) — and the atlas
            // row carries the run (`run`; its `tiles` is the pulley, the rope's own placement). Every cell of it is ONE obstacle (one id, the same `struck_by`); a hit on any
            // of them cuts the rope, so the run's `clear_set` is the token the cut activates
            // (`ropeTokens`: the struck cell is `broken`, or the rope's event is carried) and a cut anywhere
            // clears every cell. The run's cells are NOT claimed: the terrain pass below lays each one as the
            // atlas grid has it, less its CUT condition (the condition that resolves to exactly this rope's
            // strike items — the rope obstacle models it, as a trap's lane drops what the trap models), so a
            // run cell over water keeps its Swim gate and a wall in the run stays a wall. The obstacle is then
            // set on every run cell the terrain floored. ⚠ After a cut the game keeps the PULLEY solid
            // (`:40-47`); here it opens with the run, as the atlas's own cells do (one tile permissive, named).
            const group = String(e.group);
            if (groupsWithButton.has(group)) {
                throw new Error(`atlas region "${regionId}": ${e.label ?? 'a rope'}'s group ${group} also has a button — `
                    + 'its run would open on a hold, not a cut');
            }
            const run = (e.run ?? tiles).map(local).filter(inGrid);
            const id = ropeId(tiles[0]);
            builder.obstacleLib[id] = {
                id,
                name: e.label ?? id,
                kind: 'rope',
                clear_set: [[groupToken(group)]],
                struck_by: actions,
                activates: groupToken(group),
                ...(e.event ? { event: e.event } : {}),
                color: '#b08a4a',
            };
            const items = new Set(strikes.map((t) => t.item));
            for (const [x, y] of run) ropeRun.set(keyOf(x, y), items);
            ropeCells.push({ id, tiles: run, label: e.label ?? id });
            continue;
        }
        const id = rockId(actions);
        builder.obstacleLib[id] = {
            id,
            name: `rock (${actions.join(' or ')})`,
            kind: 'rock',
            clear_set: [],
            struck_by: actions,
            color: '#7a6a55',
        };
        for (const [x, y] of tiles) {
            builder.floor(x, y);
            claimed.add(keyOf(x, y));
            builder.obstacles.set(keyOf(x, y), id);
        }
    }

    // --- terrain -------------------------------------------------------------
    for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
            if (claimed.has(keyOf(x, y))) continue;
            const cell = grid.cells[y * grid.width + x];
            if (cell.kind === 'open') { builder.floor(x, y); continue; }
            if (cell.kind === 'wall') continue;
            if (cell.kind === 'gated') {
                const drop = modelled.get(keyOf(x, y));
                const cut = ropeRun.get(keyOf(x, y));
                const laneKept = drop ? (cell.conditions ?? []).filter((c) => !drop.has(condKey(c))) : null;
                // A run cell whose ONLY remaining condition is the cut is the rope obstacle's; one that also
                // carries another (L16's (4,1) is water) keeps the cut in its own gate — Swim AND the cut's
                // items, which is what crossing it costs once cut — and takes no rope obstacle (one obstacle
                // per cell: the gate is one).
                const noCut = cut ? (laneKept ?? cell.conditions ?? []).filter((c) => !isCutOf(c, cut)) : null;
                const kept = cut && noCut.length === 0 ? noCut : laneKept;
                if (kept && kept.length === 0) { builder.floor(x, y); continue; }
                const own = occupancyRule(kept ? { ...cell, conditions: kept } : cell, resolveCondition);
                if (own.rule && own.unresolved.length === 0) {
                    builder.floor(x, y);
                    builder.gate(x, y, own.rule);
                } else {
                    note({ kind: 'unresolved_walled', tile: [x + ox, y + oy], message: `a gated cell at [${x + ox},${y + oy}] has a condition with no AP item behind it — WALLED in the level world` });
                }
                continue;
            }
            // directional / sink / an unmapped puzzle entity (a chest, …).
            // Walled; a location or exit standing on it is opened below.
            if (cell.kind === 'directional' || cell.kind === 'sink') {
                note({ kind: 'unmodelled_walled', tile: [x + ox, y + oy], message: `a ${cell.kind} cell at [${x + ox},${y + oy}] is not modelled in a level world — WALLED` });
            }
        }
    }

    // The rope obstacle on every run cell the terrain floored (above).
    for (const { id, tiles } of ropeCells) {
        for (const [x, y] of tiles) {
            if (builder.isFloor(x, y) && !builder.obstacles.has(keyOf(x, y))) builder.obstacles.set(keyOf(x, y), id);
        }
    }

    /** An exit / location tile that is not floor is opened where the atlas puts it. */
    const openAt = ([x, y], label) => {
        if (builder.isFloor(x, y)) return;
        builder.floor(x, y);
        note({ kind: 'opened_solid', tile: [x + ox, y + oy], label, message: `${label} at [${x + ox},${y + oy}] sits on a cell the level world walls — opened, because that is where the atlas puts it` });
    };

    // ⛓ A cell the partition does not own but an exit or a location was OPENED on
    // (L16's pit cells, sinks in the atlas grid) belongs to the sub-region the
    // atlas binds that exit / location to (session tile-primitives-grow-levels;
    // ⚖ "Own opened exit cells") — else no AP region owns the crossing.
    const boundAt = new Map();
    const exits = [];
    const exitAt = new Set();
    for (const exit of region.exits ?? []) {
        const wired = wiredExit(regionId, exit.exit_id);
        if (!wired) continue;
        // ⛓ AN ARRIVAL-ONLY EXIT IS NOT EMITTED (session tile-primitives-levels-gap3).
        // The far end of a one-way link leads nowhere, has no AP name, and in
        // the game is a landing spot, not a trigger. As a maze exit tile it
        // would be a DEAD END (`isDeadEndExit`: every exit tile ends a walk),
        // and in a level world that cuts a corridor — measured: L16 wired made
        // L15's (9,2) landing a dead end and sealed r1c9 → r1c5. A return is
        // landed by its `source_region` (mazeArrival), which never needs it.
        if (!wired.targetApRegion) {
            note({ kind: 'arrival_only_not_emitted', tile: exit.entrance_tile, message: `arrival-only exit "${exit.exit_id}" at [${exit.entrance_tile}] is a landing spot, not a trigger — not emitted (a return lands by its source region)` });
            continue;
        }
        const [x, y] = local(exit.entrance_tile);
        if (exitAt.has(keyOf(x, y))) {
            note({ kind: 'exit_tile_collision', message: `exit "${wired.apExitName}" wants tile [${x},${y}], already taken — DROPPED` });
            continue;
        }
        const owner = ownerOf(exit.entrance_tile);
        const bound = bindings.findIndex((b) => boundTo(exit, b.sub));
        if (owner !== -1 && owner !== bound) {
            throw new Error(`atlas region "${regionId}": exit "${exit.exit_id}" is bound to "${bindings[bound]?.sub}" `
                + `but its tile is owned by "${bindings[owner].sub}" — the partition is stale`);
        }
        openAt([x, y], `exit "${exit.exit_id}"`);
        if (owner === -1 && bound !== -1) boundAt.set(keyOf(x, y), bound);
        if (exit.access_rule) builder.gate(x, y, exit.access_rule);
        exitAt.add(keyOf(x, y));
        exits.push({
            exit_id: wired.apExitName,
            x,
            y,
            side: exit.side ?? null,
            exitName: wired.apExitName,
            targetRegion: wired.targetApRegion,
            targetExitId: wired.returnApExitName ?? null,
            isTeleporter: exit.kind === 'teleporter',
            atlas_exit_id: exit.exit_id,
        });
    }

    // --- locations -----------------------------------------------------------
    for (const loc of region.locations ?? []) {
        const [x, y] = local(loc.tile);
        const owner = ownerOf(loc.tile);
        const bound = bindings.findIndex((b) => boundTo(loc, b.sub));
        if (owner !== -1 && owner !== bound) {
            throw new Error(`atlas region "${regionId}": location "${loc.name}" is bound to "${bindings[bound]?.sub}" `
                + `but its tile is owned by "${bindings[owner].sub}" — the partition is stale`);
        }
        openAt([x, y], `location "${loc.name}"`);
        if (owner === -1 && bound !== -1) boundAt.set(keyOf(x, y), bound);
        if (loc.access_rule) builder.gate(x, y, loc.access_rule);
        builder.items.set(keyOf(x, y), {
            id: typeof loc.vanilla_item === 'string' && loc.vanilla_item.length > 0
                ? loc.vanilla_item : ATLAS_LOCATION_SLOT_ITEM,
            locationName: loc.name,
        });
    }

    // ⛓ A ROPE's cells belong to the ONE sub-region its run borders (the rules' `place`
    // rule for its event, `make-seedling-playthrough-rules` playthroughRopeEvents):
    // it is cut from there, and its event location is that sub-region's.
    for (const { tiles, label } of ropeCells) {
        const own = new Set(tiles.map(([x, y]) => keyOf(x, y)));
        const unowned = tiles.filter(([x, y]) => ownerOf([x + ox, y + oy]) === -1);
        if (unowned.length === 0) continue;
        const beside = new Set(tiles.flatMap(([x, y]) => [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]])
            .filter(([nx, ny]) => !own.has(keyOf(nx, ny)) && inGrid([nx, ny]) && builder.isFloor(nx, ny))
            .map(([nx, ny]) => ownerOf([nx + ox, ny + oy])).filter((o) => o !== -1));
        if (beside.size !== 1) {
            throw new Error(`atlas region "${regionId}": ${label} borders ${beside.size} sub-regions — one was expected`);
        }
        for (const [x, y] of unowned) boundAt.set(keyOf(x, y), [...beside][0]);
    }

    // --- ownership rows, entrances and the in-world crossings' AP names ------
    const rows = [];
    for (let y = 0; y < grid.height; y += 1) {
        let row = '';
        for (let x = 0; x < grid.width; x += 1) {
            const owner = builder.isFloor(x, y) ? ownerOf([x + ox, y + oy]) : -1;
            const own = owner === -1 ? (boundAt.get(keyOf(x, y)) ?? -1) : owner;
            row += own === -1 ? '.' : SHARED_WORLD_ALPHABET[own];
        }
        rows.push(row);
    }
    const entrances = {};
    for (const [i, { sub, apName }] of bindings.entries()) {
        // The arrival a game makes: the first atlas exit bound to this
        // sub-region (its entrance tile), else its first owned floor cell.
        const exit = (region.exits ?? []).find((x) => boundTo(x, sub));
        let at = exit ? local(exit.entrance_tile) : null;
        if (!at) {
            const y = rows.findIndex((r) => r.includes(SHARED_WORLD_ALPHABET[i]));
            at = y === -1 ? null : [rows[y].indexOf(SHARED_WORLD_ALPHABET[i]), y];
        }
        if (!at) {
            throw new Error(`atlas region "${regionId}": sub-region "${sub}" owns no floor cell in the level world`);
        }
        entrances[apName] = { x: at[0], y: at[1] };
    }
    const links = {};
    for (const row of region.subgraph?.internal_exits ?? []) {
        const directions = [[row.from, row.to]];
        if (row.bidirectional === true) directions.push([row.to, row.from]);
        for (const [from, to] of directions) {
            const name = internalExitName(regionId, from, to);
            if (!name) continue;
            const key = `${apRegionName(regionId, from)}>${apRegionName(regionId, to)}`;
            if (!(key in links)) links[key] = name;
        }
    }

    // --- assemble: ONE payload, carried by the first sub-region --------------
    const carrier = bindings[0].apName;
    const sortRows = (a, b) => (a.y - b.y) || (a.x - b.x);
    const payload = {
        width: grid.width,
        height: grid.height,
        tiles: builder.tiles,
        entrance: entrances[carrier],
        exits,
        obstacles: [...builder.obstacles].map(([key, id]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, id };
        }).sort(sortRows),
        items: [...builder.items].map(([key, entry]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, id: entry.id, locationName: entry.locationName };
        }).sort(sortRows),
        obstacleLib: builder.obstacleLib,
        ...(blocks.length > 0 ? { blocks: blocks.sort(sortRows) } : {}),
        ...(buttons.length > 0 ? { buttons: buttons.sort(sortRows), buttonLib } : {}),
        ...(Object.keys(actionLib).length > 0 ? { action_lib: actionLib } : {}),
        ...(traps.length > 0 ? { traps: traps.sort(sortRows), trapLib } : {}),
        shared_world: {
            key: regionId,
            regions: bindings.map((b) => b.apName),
            rows,
            entrances,
            links,
        },
        atlas_region: regionId,
        ...(Number.isInteger(region.map_ref) ? { level: region.map_ref } : {}),
        tile_size: tileSize,
        origin: { x: ox, y: oy },
    };
    const sidecars = {
        [carrier]: { substrate: MAZE_SUBSTRATE, shared_world: regionId, playable_payload: payload },
    };
    for (const { apName } of bindings.slice(1)) {
        sidecars[apName] = { substrate: MAZE_SUBSTRATE, shared_world: regionId };
    }
    note({
        kind: 'level_world',
        message: `projected as ONE shared level world "${regionId}" (${bindings.length} AP region(s), carried by "${carrier}"): `
            + `${blocks.length} block(s), ${buttons.length} button(s), ${Object.keys(actionLib).length} action(s)`
            + `${traps.length > 0 ? `, ${traps.length} arrow trap(s)` : ''}${ropeCells.length > 0 ? `, ${ropeCells.length} rope(s)` : ''}`,
    });
    return { sidecars, notes, analysis: null, sharedWorld: regionId };
}

/**
 * Project a whole atlas into maze sidecars.
 *
 * A region with no `map_ref` has no tiles at all: it stays graph-only and is
 * NAMED, the same discipline the Phase-4 compiler applies to unwired exits and
 * unbound regions — a silent omission reads as a fully-bound map.
 */
export function projectAtlasToMaze(atlas, deps) {
    const { gridFor, resolveCondition, conditionKey, wiredExit, internalExitName } = deps;
    const tileSize = atlas.tile_space?.tile_size ?? 1;
    const sidecars = {};
    const notes = [];
    const unbound = [];
    for (const region of atlas.regions ?? []) {
        const grid = Number.isInteger(region.map_ref) ? gridFor(region) : null;
        if (!grid) {
            unbound.push(region.region_id);
            continue;
        }
        const projected = projectRegionToMaze(region, grid, {
            resolveCondition, conditionKey, wiredExit, internalExitName, tileSize,
        });
        Object.assign(sidecars, projected.sidecars);
        notes.push(...projected.notes);
    }
    return { sidecars, notes, regions_without_map_ref: unbound };
}

/** One-line-per-item human summary of a maze projection's notes, for CLIs. */
export function formatMazeProjectionNotes(notes) {
    const lines = [];
    const bySeverity = { walled_unlabelled: 0, no_geometry: 0, unreachable: 0 };
    for (const n of notes) {
        if (n.kind in bySeverity) bySeverity[n.kind] += 1;
        lines.push(`  [${n.kind}] ${n.region_id}${n.sub_region ? `/${n.sub_region}` : ''}: ${n.message}`);
    }
    const headline = Object.entries(bySeverity).filter(([, c]) => c > 0)
        .map(([k, c]) => `${c} ${k}`).join(', ');
    return [
        `maze projection: ${notes.length} note(s)${headline ? ` (${headline})` : ''}`,
        ...lines,
    ];
}
