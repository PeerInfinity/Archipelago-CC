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
// atlas is stale against the terrain it describes.
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
    const analysis = analyzeRegion(region, grid, { conditionKey, resolveCondition });
    const components = analysis.components;
    const bindings = bindingsFor(region);

    // The atlas and the terrain have to agree about what the pieces ARE before
    // anything is projected onto them. Disagreement means the atlas is stale.
    const declared = bindings.map((b) => b.sub).filter((s) => s !== null).sort();
    const computed = components.map((c) => c.id).sort();
    if (declared.length === 0) {
        if (components.length !== 1) {
            throw new Error(
                `atlas region "${region.region_id}" declares no subgraph, but its tile map splits into `
                + `${components.length} components (${computed.join(', ')}) — re-analyze the atlas`,
            );
        }
    } else if (declared.join('|') !== computed.join('|')) {
        throw new Error(
            `atlas region "${region.region_id}" declares sub_regions [${declared.join(', ')}] but its tile map `
            + `computes [${computed.join(', ')}] — the atlas is stale against the map document; re-analyze it`,
        );
    }

    const componentById = new Map(components.map((c) => [c.id, c]));
    const { planned, notes: crossingNotes } = planCrossings(region, analysis.crossings);
    const notes = crossingNotes.map((n) => ({ region_id: region.region_id, ...n }));
    const local = (tile) => [tile[0] - (grid.origin?.x ?? 0), tile[1] - (grid.origin?.y ?? 0)];

    const sidecars = {};
    for (const { sub, apName } of bindings) {
        const component = sub === null ? components[0] : componentById.get(sub);
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
            const occupied = builder.exits.find((e) => e.x === entry.x && e.y === entry.y);
            if (occupied) {
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
