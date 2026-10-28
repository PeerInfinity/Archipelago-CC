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

/**
 * ⛓ A CROSS-ROOM PRESS IS A LOCATION ON ITS BUTTON (session tile-primitives-sphere-order-5, ⚖ 2026-10-27 "Location on the
 * cell"). The compile's press events (`ctx.eventsFor`, mode 'press': a button in this region that latches a flag of
 * ANOTHER level — L38's ButtonRoom opens L39's wand lock) are produced where the game produces them: standing on the
 * button's cell. Each becomes a location of the sub-region its event names (`side`), on that cell, granting the event and
 * gated by nothing of its own — the rules price it as reaching the button (a press with a rule other than True_ is refused
 * by name). Pure: `region.locations` is not touched. Exported for the unit rows.
 */
export function pressLocations(region, events) {
    const bySide = new Map(bindingsFor(region).map((b) => [b.apName, b.sub]));
    return (events ?? []).filter((ev) => ev.mode === 'press').map((ev) => {
        if (ev.tiles.length !== 1) throw new Error(`press event "${ev.name}": ${ev.tiles.length} cells, not the button's one`);
        if (!bySide.has(ev.side)) throw new Error(`press event "${ev.name}": its side "${ev.side}" is no (sub-)region of ${region.region_id}`);
        // The location takes no rule of its own, so a press the rules charge more than its reach would be LOOSER here than
        // there; refused by name until that is a decision (designer review, session tile-primitives-sphere-order-5).
        if (ev.rule && ev.rule.rule !== 'True_') {
            throw new Error(`press event "${ev.name}": its own rule ${JSON.stringify(ev.rule)} is not True_ — a press location carries none`);
        }
        const sub = bySide.get(ev.side);
        return { name: ev.name, tile: ev.tiles[0], vanilla_item: ev.name, ...(sub === null ? {} : { sub_region: sub }) };
    });
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
            const id = this.ruleEntry(rule);
            this.obstacles.set(`${x},${y}`, id);
            return id;
        },
        /** The lib entry for `rule` (one per distinct rule), placed nowhere — an ENTRY GATE names it. */
        ruleEntry(rule) {
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
            return id;
        },
    };
}

/**
 * ⛓ ONE CELL, ONE LOCATION — A STACKED LOCATION SPILLS, BY NAME (session tile-primitives-sphere-order-4, ⚖ 2026-10-27
 * "Spill to nearest floor"). A maze cell grants one location (`world.items` is posKey → item), but the atlas may put two
 * on one tile: L32's Times (the third BobBoss's kill) and Bob Boss (its Fire drop) both stand on the boss rock's tile
 * (5,8), the only such tile in the game. Writing the second over the first silently dropped one (the whole-game
 * certifier's "Bob Boss is not priced"; no maze cell could ever check it). So a location whose cell is taken goes to the
 * nearest FREE floor cell — breadth-first in N E S W order through floor cells `mine` admits (the same piece of the
 * world) that hold no obstacle and no exit (`isExit`), free = no item either — gated by its OWN rule, and the report names it
 * (`location_stacked`). No free cell throws. `toAtlas` maps a local cell to atlas tiles for the report.
 */
function placeLocation(builder, [x, y], loc, { mine, isExit, note, toAtlas }) {
    const entry = {
        id: typeof loc.vanilla_item === 'string' && loc.vanilla_item.length > 0 ? loc.vanilla_item : ATLAS_LOCATION_SLOT_ITEM,
        locationName: loc.name,
    };
    const taken = builder.items.get(`${x},${y}`);
    if (!taken) {
        if (loc.access_rule) builder.gate(x, y, loc.access_rule);
        builder.items.set(`${x},${y}`, entry);
        return;
    }
    const seen = new Set([`${x},${y}`]);
    const queue = [[x, y]];
    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        for (const [nx, ny] of [[cx, cy - 1], [cx + 1, cy], [cx, cy + 1], [cx - 1, cy]]) {
            const key = `${nx},${ny}`;
            // Never THROUGH a gate or an exit: a spill behind a lock, in a part reachable another way, would charge only
            // its own rule — looser than the game (designer review, session tile-primitives-sphere-order-4).
            if (seen.has(key) || !builder.isFloor(nx, ny) || !mine(nx, ny) || builder.obstacles.has(key) || isExit(nx, ny)) continue;
            seen.add(key);
            if (!builder.items.has(key)) {
                if (loc.access_rule) builder.gate(nx, ny, loc.access_rule);
                builder.items.set(key, entry);
                note({
                    kind: 'location_stacked', tile: loc.tile, label: `location "${loc.name}"`,
                    message: `location "${loc.name}" shares [${loc.tile}] with "${taken.locationName}" — one cell grants one location, so it SPILLS to [${toAtlas([nx, ny])}], the nearest free floor cell, gated by its own rule`,
                });
                return;
            }
            queue.push([nx, ny]);
        }
    }
    throw new Error(`location "${loc.name}" shares [${loc.tile}] with "${taken.locationName}" and there is no free floor cell to spill it to`);
}

/**
 * ⛓ EVENTS AS LOCATIONS (session tile-primitives-events-as-locations, ⚖ 2026-10-23 "All AP; world rocks+locks").
 * Bind the compile's AP EVENTS to the obstacles standing on their entity's cells (`ctx.eventsFor(region)` →
 * `[{name, side, mode, tiles}]`, atlas tiles). Each bound cell gets its OWN library entry — the obstacle it had plus
 * `events: [{name, side}]` (the location that prices it, see `tileSpike/deriveTileLogic.js` `eventTargets`):
 *   mode 'open'   the event is the obstacle CLEARED on an earlier visit, so carrying it opens the cell: a struck rock
 *                 gets `clear_set: [[<event>]]` (as a rope's token), a rule cell `Or(<its rule>, And(<its events>))`
 *                 (two events on one cell — L12's magical lock under its boss lock — open it only together);
 *   mode 'latch'  a latched lock: the far side's crossing already costs the event (the compile's `internalExitRules`),
 *                 so the cell's rule stays; the entry only names the event its open side prices.
 * A cell with no obstacle binds nothing; an event none of whose cells holds one is left unmodelled (the certifier
 * names it). A rope keeps its own event (`activates`).
 */
function bindWorldEvents(builder, events, local, inGrid) {
    const byCell = new Map();
    for (const ev of events ?? []) {
        // a press is a location on its button (`pressLocations`); its target is opened by it (`layPressTargets`)
        if (ev.mode === 'press' || ev.mode === 'target') continue;
        for (const [x, y] of ev.tiles.map(local).filter(inGrid)) {
            const key = `${x},${y}`;
            const base = builder.obstacleLib[builder.obstacles.get(key)];
            if (!base || base.activates) continue;
            if (!byCell.has(key)) byCell.set(key, []);
            byCell.get(key).push(ev);
        }
    }
    // The cells of one event that share an obstacle are one cut state (a multi-cell rock), as a rope's run. An event's
    // tiles are ONE entity's (`ctx.eventsFor`), so one cut state never joins two separate game objects.
    const firstCell = new Map();
    for (const [key, evs] of byCell) {
        const base = builder.obstacleLib[builder.obstacles.get(key)];
        const id = `${base.id}~${evs.map((e) => e.name).join('~')}`;
        if (!builder.obstacleLib[id]) {
            const names = evs.filter((e) => e.mode === 'open').map((e) => ({ rule: 'Has', args: { item_name: e.name } }));
            // ⛓ Two events on ONE cell (L12's magical lock on its boss lock) open by their OWN rules (a wand shot, a key
            // touch — `MagicalLock.as`, `BossLock.as`), so each names its rule; the cell passes once both are open
            // (session tile-primitives-sphere-order-2, ⚖ "Lay touched event cells").
            // A one-sided lock names the side it opens from (`probe`, BossLock.as `update`: a line below the lock).
            const own = (e) => ({ ...(evs.length > 1 && e.rule ? { rule: e.rule } : {}), ...(e.probe ? { probe: e.probe } : {}) });
            const entry = { ...base, id, name: `${base.name}: ${evs.map((e) => e.name).join(' + ')}`, events: evs.map((e) => ({ name: e.name, side: e.side, ...own(e) })) };
            if (names.length > 0 && base.struck_by) {
                entry.clear_set = [names.map((n) => n.args.item_name)];
                if (!firstCell.has(id)) firstCell.set(id, key);
                entry.at = firstCell.get(id);
            } else if (names.length > 0 && base.clear_set_type === 'rule') {
                if (!base.clear_rule) throw new Error(`event "${evs[0].name}": obstacle "${base.id}" at ${key} is rule-typed with no clear_rule`);
                entry.clear_rule = { rule: 'Or', children: [base.clear_rule, names.length === 1 ? names[0] : { rule: 'And', children: names }] };
            }
            builder.obstacleLib[id] = entry;
        }
        builder.obstacles.set(key, id);
    }
}

/**
 * ⛓ A PRESS's POCKET DOORS (session tile-primitives-sphere-order-6, ⚖ 2026-10-28 "Lay the producer's door gates"). A press
 * target that seals a landing pocket (L39's wand lock: the L38 teleporter lands in the 2 tiles below it) has its pocket's
 * doors priced on the event by the rules producer (its cross-room-press `exitGates`, mode 'door' rows naming the atlas
 * exit): crossing the barrier is exactly entering or leaving the pocket. The world gates those exit cells on the event
 * too, so it refuses the one walk the rules forbid and the game allows, a round trip into the dead end, which gains
 * nothing. Returns the exit's own rule with every door event joined, or the rule unchanged.
 */
function withPressDoor(exit, events) {
    const doors = (events ?? []).filter((ev) => ev.mode === 'door' && ev.exit_id === exit.exit_id)
        .map((ev) => ({ rule: 'Has', args: { item_name: ev.name } }));
    if (doors.length === 0) return exit.access_rule ?? null;
    const parts = [...(exit.access_rule ? [exit.access_rule] : []), ...doors];
    return simplifyRule(parts.length === 1 ? parts[0] : { rule: 'And', children: parts });
}

/**
 * ⛓ A PRESS's TARGET (session tile-primitives-sphere-order-6, ⚖ 2026-10-28 "Lock cell opened by event"). A cross-room
 * press clears its target for good — the game builds L39's wand lock gone once its flag is in `persistence_cleared` — so
 * the target's cells (mode 'target': the obstacle's entity, in its own level) are laid in this world as one obstacle
 * opened by the event alone, `opened_by` naming it. The analyzer grid has the cell OPEN (the rules charge the exits of the
 * pocket it seals), so a floor cell is gated here; a cell this world does not floor is left out (another world lays it). A
 * cell that already holds an obstacle is refused by name — what a stacked target costs is not settled.
 */
function layPressTargets(builder, events, local, inGrid) {
    for (const ev of events ?? []) {
        if (ev.mode !== 'target') continue;
        const id = `press_target~${ev.name}`;
        for (const [x, y] of ev.tiles.map(local).filter(inGrid)) {
            if (!builder.isFloor(x, y)) continue;
            const held = builder.obstacles.get(`${x},${y}`);
            if (held !== undefined) {
                throw new Error(`press target "${ev.name}": its cell (${x},${y}) already holds obstacle "${held}"`);
            }
            builder.obstacleLib[id] ??= {
                id,
                name: ev.name,
                clear_set_type: 'rule',
                clear_rule: { rule: 'Has', args: { item_name: ev.name } },
                opened_by: ev.name,
                color: '#b06eb8',
                display: { mode: 'tree' },
            };
            builder.obstacles.set(`${x},${y}`, id);
        }
    }
}

/**
 * ⛓ TOUCHED EVENT CELLS (session tile-primitives-sphere-order-2, ⚖ 2026-10-26 "Lay touched event cells"). A
 * per-sub-region world lays its crossings on their FIRST cell only, so an event lock its component touches but no
 * crossing runs through stayed wall, and its event was laid in no world of its own region: L12's 2-wide Red-Key
 * doorway (26,15)+(27,15) — both opened from r0c19 in the game, the analyzer kept one route — and the magical lock
 * stacked on a boss lock at (2,54), whose crossing (to L83) is not wired. Each such cell is floored and gated by its
 * events' own rules (all of them, for a stacked cell: it passes once every lock on it is open), so `bindWorldEvents`
 * binds it; it leads nowhere further in this world. A cell already floor or holding an obstacle is left as it is.
 */
function layTouchedEventCells(builder, events, local, component, inGrid) {
    const mine = new Set(component.tiles.map(([x, y]) => `${x},${y}`));
    const byCell = new Map();
    for (const ev of events ?? []) {
        if (!ev.rule || ev.mode === 'press') continue;
        for (const [x, y] of ev.tiles.map(local).filter(inGrid)) {
            const key = `${x},${y}`;
            if (builder.isFloor(x, y) || builder.obstacles.has(key)) continue;
            if (!DIRS.some(([dx, dy]) => mine.has(`${x + dx},${y + dy}`))) continue;
            if (!byCell.has(key)) byCell.set(key, { x, y, rules: [] });
            byCell.get(key).rules.push(ev.rule);
        }
    }
    for (const { x, y, rules } of byCell.values()) {
        builder.floor(x, y);
        builder.gate(x, y, rules.length === 1 ? rules[0] : { rule: 'And', children: rules });
    }
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
function planCrossings(region, crossings, internalExitRule = null) {
    const byDirected = new Map(crossings.map((c) => [directedKey(c.from, c.to), c]));
    const planned = new Map(); // "from>to" -> { from, to, tile, rule }
    const notes = [];

    for (const row of region.subgraph?.internal_exits ?? []) {
        const directions = [[row.from, row.to]];
        if (row.bidirectional === true) directions.push([row.to, row.from]);
        for (const [from, to] of directions) {
            const key = directedKey(from, to);
            if (planned.has(key)) continue; // a duplicate row; the first one stands
            // ⛓ EVENTS AS LOCATIONS (session tile-primitives-events-as-locations): a one-way row the compile
            // re-priced (`internalExitRules`: a latched lock's far-side return costs its EVENT, not the reach of
            // its open side) gates its tile with that rule — the AP exit's own — not the atlas row's.
            const replaced = row.bidirectional === true ? undefined : internalExitRule?.(region.region_id, from, to);
            const rule = replaced ?? row.access_rule ?? null;
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

/** The planned crossings whose exit tile another crossing out of the same sub-region also takes (all but the first). */
function collidingCrossings(planned) {
    const first = new Map();
    const out = [];
    for (const plan of planned.values()) {
        const key = `${plan.from}|${plan.tile}`;
        if (first.has(key)) out.push(plan); else first.set(key, plan);
    }
    return out;
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
    const { planned, notes: crossingNotes } = planCrossings(region, analysis.crossings, ctx.internalExitRule);
    // ⛓ COLLIDING CROSSINGS (session tile-primitives-water-exits, ⚖ 2026-10-25 "Level world + step gates"). Two
    // crossings out of one sub-region whose exit tile is the SAME cell (a body of water touching several pieces:
    // every way out starts on its first cell) cannot be one maze tile each — a tile crosses one way. Such a level
    // is played as ONE level world instead, where a crossing is the walk itself over the terrain the atlas rows were
    // priced from. Whole game at the slice: L19 L29 L45 L46 L47 L51 L54 L58 L63 L87 L89 L115. A level world WALKS
    // terrain, so a crossing priced by hand or by the physics model (`source` other than the analyzer: L80's pit
    // row) has nothing to walk — such a level stays per sub-region, its collisions named.
    const colliding = collidingCrossings(planned);
    const walkable = (region.subgraph?.internal_exits ?? []).every((row) => internalExitSource(row) === 'analyzer');
    if (colliding.length > 0 && walkable && declared.length > 0 && typeof ctx.levelEntitiesFor === 'function') {
        const world = projectLevelWorld(region, grid, ctx, entities ?? []);
        world.notes.unshift({
            region_id: region.region_id,
            kind: 'colliding_crossings',
            message: `${colliding.length} crossing(s) share an exit tile with another out of the same sub-region `
                + `(${colliding.slice(0, 3).map((c) => `${c.from} -> ${c.to} at [${c.tile}]`).join(', ')}${colliding.length > 3 ? ', …' : ''}) — projected as a level world`,
        });
        return world;
    }
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
        const directional = floorDirectionalCells(builder, grid, component.tiles, resolveCondition, note);
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
                return false;
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
                    return true;
                }
                note({
                    kind: 'exit_tile_collision',
                    message: `exit "${id}" wants tile [${entry.x},${entry.y}], already taken by "${occupied.exit_id}" — DROPPED (one tile can only cross one way)`,
                });
                return false;
            }
            builder.exitIds.add(id);
            builder.exits.push({ exit_id: id, ...entry });
            return true;
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
            // ⛓ A DROPPED exit leaves its tile's gate as it found it (session tile-primitives-water-exits): the
            // survivor's rule stands, never the loser's (L89's r11c12 tile named r1c10, Swim×2, and carried Swim).
            const before = builder.obstacles.get(`${x},${y}`);
            for (const n of openTileTowards(builder, grid, component, [x, y], `exit "${exit.exit_id}"`, resolveCondition)) note(n);
            const exitRule = withPressDoor(exit, ctx.eventsFor?.(region));
            if (exitRule) builder.gate(x, y, exitRule);
            const kept = addExit({
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
            if (!kept) {
                if (before === undefined) builder.obstacles.delete(`${x},${y}`); else builder.obstacles.set(`${x},${y}`, before);
            }
        }

        // --- crossings out of this sub-region -------------------------------
        for (const plan of planned.values()) {
            if (plan.from !== component.id) continue;
            const [x, y] = local(plan.tile);
            builder.floor(x, y);
            const before = builder.obstacles.get(`${x},${y}`);
            if (plan.rule) builder.gate(x, y, plan.rule);
            const reverse = planned.get(directedKey(plan.to, plan.from));
            if (!reverse) {
                note({
                    kind: 'one_way_arrival', from: plan.from, to: plan.to,
                    message: `crossing ${plan.from} -> ${plan.to} has no projected reverse, so arriving in "${plan.to}" lands on its entrance tile rather than at the crossing`,
                });
            }
            const kept = addExit({
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
            if (!kept) {
                if (before === undefined) builder.obstacles.delete(`${x},${y}`); else builder.obstacles.set(`${x},${y}`, before);
            }
        }

        // --- locations ------------------------------------------------------
        const events = ctx.eventsFor?.(region);
        for (const loc of [...(region.locations ?? []), ...pressLocations(region, events)]) {
            if (!boundTo(loc, sub)) continue;
            const [x, y] = local(loc.tile);
            for (const n of openTileTowards(builder, grid, component, [x, y], `location "${loc.name}"`, resolveCondition)) note(n);
            placeLocation(builder, [x, y], loc, {
                mine: () => true, // this builder floors only this sub-region's world
                isExit: (cx, cy) => builder.exits.some((e) => e.x === cx && e.y === cy),
                note,
                toAtlas: ([cx, cy]) => [cx + (grid.origin?.x ?? 0), cy + (grid.origin?.y ?? 0)],
            });
        }

        const inGrid = ([x, y]) => x >= 0 && y >= 0 && x < grid.width && y < grid.height;
        layTouchedEventCells(builder, events, local, component, inGrid);
        layPressTargets(builder, events, local, inGrid);
        bindWorldEvents(builder, events, local, inGrid);
        const entryGates = directional > 0 ? levelWorldEntryGates(builder, grid, new Set(), resolveCondition, new Set(), note) : [];

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
            ...(entryGates.length > 0 ? { entry_gates: entryGates } : {}),
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

/** A step's direction, its delta and the face it crosses on the cell it enters. */
const MOVES = Object.freeze([['N', 0, -1, 'S'], ['E', 1, 0, 'W'], ['S', 0, 1, 'N'], ['W', -1, 0, 'E']]);

/**
 * ⛓ DIRECTIONAL CELLS IN A PER-SUB-REGION WORLD (session tile-primitives-sphere-order-1, ⚖ 2026-10-25 "Entry gates in
 * every world"; water-exits floored them in LEVEL worlds only). The analyzer's components hold no directional cell —
 * it steps THROUGH them (`stepCost`) — so a sub-region joined by one projected as islands: L94 r3c4's two cells are
 * (4,3) and (4,6), joined by the cliffside (4,4)/(4,5) (faces W:null). Every directional cell chained to the
 * component through directional cells is floored here, with its occupancy gate as a gated cell's; its direction
 * physics become ENTRY GATES (`levelWorldEntryGates`, the level world's own). A cell whose condition has no AP item
 * stays a wall, by name. Returns how many were floored (0 ⇒ the world is unchanged and carries no entry gates).
 */
function floorDirectionalCells(builder, grid, tiles, resolveCondition, note) {
    const cellAt = (x, y) => (x >= 0 && y >= 0 && x < grid.width && y < grid.height ? grid.cells[y * grid.width + x] : null);
    const queue = tiles.map(([x, y]) => [x, y]);
    const seen = new Set(queue.map(([x, y]) => `${x},${y}`));
    let floored = 0;
    for (let head = 0; head < queue.length; head += 1) {
        const [x, y] = queue[head];
        for (const [, dx, dy] of MOVES) {
            const [nx, ny] = [x + dx, y + dy];
            const key = `${nx},${ny}`;
            if (seen.has(key) || cellAt(nx, ny)?.kind !== 'directional' || builder.isFloor(nx, ny)) continue;
            seen.add(key);
            const own = occupancyRule(cellAt(nx, ny), resolveCondition);
            if (own.unresolved.length > 0) {
                note({ kind: 'unresolved_walled', tile: [nx, ny], message: `a directional cell at [${nx},${ny}] has a condition with no AP item behind it — WALLED` });
                continue;
            }
            builder.floor(nx, ny);
            if (own.rule) builder.gate(nx, ny, own.rule);
            floored += 1;
            queue.push([nx, ny]);
        }
    }
    return floored;
}

/**
 * ⛓ ENTRY GATES (session tile-primitives-water-exits, ⚖ 2026-10-25 "Level world + step gates") — every directed step
 * between two floor cells of a level world whose terrain gates it, as the region analyzer prices a step
 * (`regionAtlasAnalyzer.stepCost`): the face it crosses, read from BOTH cells; the direction gate of moving that way,
 * read from both cells (a two-tile waterfall gates the climb at each); and the entered cell's `enter` gate. Folded
 * into the cell the step ENTERS (`{x, y, dir, gate}`, `gate` a rule entry of the builder's lib, or null when a face or
 * direction refuses the step), so the engine reads one cell. The occupancy conditions stay the cell's obstacle.
 *   - a cell an ENTITY claimed (a block, a button, a held lock, a rock) contributes none of its own: the entity is
 *     its model (L15/L16's one-way locks are button locks);
 *   - a LATCHED cell's closed side (`enter` null) costs its lock's AP EVENT (bound by `bindWorldEvents`): the lock
 *     opened from its open side stays open every way, which is the analyzer's latch condition; with none bound, no entry;
 *   - a gate condition with no AP item behind it refuses the step (a wall can only make the world harder) and is named;
 *   - a step in `refused` (`"x,y,dir"`) has no entry at all.
 */
function levelWorldEntryGates(builder, grid, claimed, resolveCondition, refused, note) {
    const out = [];
    const cellAt = (x, y) => grid.cells[y * grid.width + x];
    const own = (x, y) => !claimed.has(`${x},${y}`);
    // A latched cell's closed side: entered once its lock was OPENED — the lock's AP event (`bindWorldEvents`, mode
    // 'latch'), as the analyzer prices it (its `latchEvent`); with no event bound there is no way in that side.
    const latchEntry = (x, y, gate) => {
        if (gate !== null) return gate;
        const events = builder.obstacleLib[builder.obstacles.get(`${x},${y}`)]?.events ?? [];
        return events.length > 0 ? events.map((e) => ({ ap_event: e.name })) : null;
    };
    for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
            if (!builder.isFloor(x, y)) continue;
            const v = cellAt(x, y);
            for (const [dir, dx, dy, face] of MOVES) {
                const ux = x - dx;
                const uy = y - dy;
                if (!builder.isFloor(ux, uy)) continue;
                if (refused.has(`${x},${y},${dir}`)) { out.push({ x, y, dir, gate: null }); continue; }
                const u = cellAt(ux, uy);
                const gates = [
                    ...(own(ux, uy) ? [u.faces?.[dir], u.dirs?.[dir]] : []),
                    ...(own(x, y) ? [v.faces?.[face], v.dirs?.[dir], v.latch ? latchEntry(x, y, v.enter?.[dir]) : v.enter?.[dir]] : []),
                ].filter((g) => g !== undefined);
                if (gates.length === 0) continue;
                if (gates.includes(null)) { out.push({ x, y, dir, gate: null }); continue; }
                const conditions = gates.flat();
                const parts = conditions.map((c) => (c.ap_event ? { rule: 'Has', args: { item_name: c.ap_event } } : resolveCondition(c)));
                if (parts.some((p) => !p)) {
                    note({ kind: 'unresolved_entry_refused', tile: [x, y], message: `entering [${x},${y}] moving ${dir} has a gate condition with no AP item behind it — REFUSED in the level world` });
                    out.push({ x, y, dir, gate: null });
                    continue;
                }
                if (parts.length === 0) continue;
                out.push({ x, y, dir, gate: builder.ruleEntry(simplifyRule(parts.length === 1 ? parts[0] : { rule: 'And', children: parts })) });
            }
        }
    }
    return out;
}

/**
 * Project ONE atlas region with an interaction into a shared level world.
 *
 * @param {object} region the atlas region
 * @param {object} grid the analyzer cell grid for it
 * @param {object} ctx `projectRegionToMaze`'s, plus `partitionFor(region)` →
 *   `{sub_regions, rows, origin:[x,y]}` (the atlas's persisted partition)
 * @param {Array<object>} entities `levelEntitiesFor`'s rows:
 *   `{kind, tiles:[[x,y]…] (atlas tiles), group?, strike?:[{action, item} | {action, rule}], reach?, label}` — a
 *   block with a `strike` is moved only by it, from up to `reach` cells (`block_strike`)
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
    let blockPush = null; // 'walk', or a struck block's JSON {by, reach} — one per world
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
    // A strike needs one `item` or, for a fusion, a `rule` (an And of Has — ⚖ 2026-10-25 "action_lib `rule`").
    const needOf = (strike) => (strike.rule !== undefined ? { rule: strike.rule } : { item: strike.item });
    const actionFor = (strike) => {
        if (!actionLib[strike.action]) {
            const used = Object.keys(actionLib).length;
            actionLib[strike.action] = {
                ...needOf(strike),
                primitive: 'strike',
                condition: 'strikes',
                ...(used < LEVEL_WORLD_USE_KEYS.length ? { key: LEVEL_WORLD_USE_KEYS[used] } : {}),
            };
        } else {
            const { item, rule } = actionLib[strike.action];
            const had = JSON.stringify(rule ?? item);
            const now = JSON.stringify(strike.rule ?? strike.item);
            if (had !== now) {
                throw new Error(`atlas region "${regionId}": action "${strike.action}" names two items (${had}, ${now})`);
            }
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
            // ⛓ STRUCK BLOCKS (session tile-primitives-sphere-order-2, ⚖ "Reach-2 strike-push"): a block the game moves
            // only by a hit (Seedling's PushableBlockSpear) names its strike; the world's `block_strike` says so for all.
            const how = e.strike ? JSON.stringify({ by: e.strike.map(actionFor), reach: e.reach }) : 'walk';
            if (blockPush !== null && blockPush !== how) {
                throw new Error(`atlas region "${regionId}": ${e.label ?? 'a block'} is pushed ${how}, another block ${blockPush} `
                    + '— one world moves all its blocks one way (a mixed world is not modelled)');
            }
            blockPush = how;
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
                // ⛓ No button can ever hold it — a ROOM-CLEAR lock (Seedling's kill-locks, tset -1: ⚖ enemies are
                // not holders). Not claimed (session tile-primitives-water-exits, ⚖ 2026-10-25 "Lay the grid's own
                // cell"): the terrain pass lays its cells exactly as the atlas grid has them — a cell the grid gates
                // (the room's decided rule) is floor plus that gate, a wall stays a wall — the same cell the atlas
                // rule of its crossing was priced from. L53 (9,13) and L71 (7,12) had walled a crossing AP lays.
                note({ kind: 'lock_without_button', message: `${e.label ?? 'a lock'} (group ${group}) has no button in this level — laid as the atlas grid has its cells` });
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
                // The rope's ONE cut state: a strike on any run cell is recorded here (`strikeTarget`).
                at: keyOf(...tiles[0]),
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
            // ⛓ A DIRECTIONAL cell (a waterfall, a cliff face, a one-way lock) is floor — plus its occupancy gate, as
            // a gated cell — and its direction physics become ENTRY GATES below (session tile-primitives-water-exits,
            // ⚖ 2026-10-25 "Same entry-gate primitive"): L0's two islands are joined by a waterfall, down free and
            // up with the Feather.
            if (cell.kind === 'directional') {
                const own = occupancyRule(cell, resolveCondition);
                if (own.unresolved.length > 0) {
                    note({ kind: 'unresolved_walled', tile: [x + ox, y + oy], message: `a directional cell at [${x + ox},${y + oy}] has a condition with no AP item behind it — WALLED in the level world` });
                    continue;
                }
                builder.floor(x, y);
                if (own.rule) builder.gate(x, y, own.rule);
                continue;
            }
            // sink / an unmapped puzzle entity (a chest, …). Walled; a location or exit standing on it is opened below.
            if (cell.kind === 'sink') {
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

    /**
     * An exit / location tile that is not floor is opened where the atlas puts it — and, when no floor cell touches
     * it, reached by a corridor CARVED through the non-wall cells between, the per-sub-region rule
     * (`openTileTowards`): a door drawn inside a building whose mask is not transcribed (session
     * tile-primitives-water-exits — L0's door to L86 at (10,17)). A carved cell keeps its occupancy gate; one whose
     * condition has no AP item stops the carve there.
     */
    const openAt = ([x, y], label) => {
        if (builder.isFloor(x, y)) return;
        builder.floor(x, y);
        note({ kind: 'opened_solid', tile: [x + ox, y + oy], label, message: `${label} at [${x + ox},${y + oy}] sits on a cell the level world walls — opened, because that is where the atlas puts it` });
        if (MOVES.some(([, dx, dy]) => builder.isFloor(x + dx, y + dy))) return;
        const prev = new Map([[keyOf(x, y), null]]);
        let frontier = [[x, y]];
        let hit = null;
        while (frontier.length > 0 && hit === null) {
            const next = [];
            for (const [cx, cy] of frontier) {
                for (const [, dx, dy] of MOVES) {
                    const [nx, ny] = [cx + dx, cy + dy];
                    if (!inGrid([nx, ny]) || prev.has(keyOf(nx, ny))) continue;
                    prev.set(keyOf(nx, ny), [cx, cy]);
                    if (builder.isFloor(nx, ny)) { hit = [cx, cy]; break; }
                    const cell = grid.cells[ny * grid.width + nx];
                    if (cell.kind === 'wall' || cell.kind === 'sink' || claimed.has(keyOf(nx, ny))) continue;
                    if (occupancyRule(cell, resolveCondition).unresolved.length > 0) continue;
                    next.push([nx, ny]);
                }
                if (hit !== null) break;
            }
            frontier = next;
        }
        if (hit === null) {
            note({ kind: 'unreachable', tile: [x + ox, y + oy], label, message: `${label} at [${x + ox},${y + oy}] cannot be reached without crossing a wall — isolated in the level world` });
            return;
        }
        const carved = [];
        for (let at = hit; at !== null && keyOf(...at) !== keyOf(x, y); at = prev.get(keyOf(...at))) {
            const [cx, cy] = at;
            const cell = grid.cells[cy * grid.width + cx];
            builder.floor(cx, cy);
            const own = occupancyRule(cell, resolveCondition);
            if (own.rule) builder.gate(cx, cy, own.rule);
            carved.push(`[${cx + ox},${cy + oy}] ${cell.kind}${own.rule ? ' gated' : ''}`);
        }
        note({ kind: 'carved', tile: [x + ox, y + oy], label, message: `${label} at [${x + ox},${y + oy}] touches no floor — carved ${carved.length} cell(s) to it (${carved.reverse().join(', ')})` });
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
        // ⛓ The exit's rule JOINS the cell's terrain gate, never replaces it (session tile-primitives-water-exits): a
        // level world WALKS over an exit tile into its neighbours, so a teleporter in water must still cost the Swim
        // (L58 r4c1's (3,7) → r6c5's (4,7) walked the water holding only a weapon).
        const terrain = builder.obstacleLib[builder.obstacles.get(keyOf(x, y))];
        const exitRule = withPressDoor(exit, ctx.eventsFor?.(region));
        if (exitRule) {
            builder.gate(x, y, terrain?.clear_set_type === 'rule' && terrain.clear_rule
                ? simplifyRule({ rule: 'And', children: [terrain.clear_rule, exitRule] }) : exitRule);
        }
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
    for (const loc of [...(region.locations ?? []), ...pressLocations(region, ctx.eventsFor?.(region))]) {
        const [x, y] = local(loc.tile);
        const owner = ownerOf(loc.tile);
        const bound = bindings.findIndex((b) => boundTo(loc, b.sub));
        if (owner !== -1 && owner !== bound) {
            throw new Error(`atlas region "${regionId}": location "${loc.name}" is bound to "${bindings[bound]?.sub}" `
                + `but its tile is owned by "${bindings[owner].sub}" — the partition is stale`);
        }
        openAt([x, y], `location "${loc.name}"`);
        if (owner === -1 && bound !== -1) boundAt.set(keyOf(x, y), bound);
        const own = owner !== -1 ? owner : bound;
        placeLocation(builder, [x, y], loc, {
            mine: (cx, cy) => (ownerOf([cx + ox, cy + oy]) === -1 ? boundAt.get(keyOf(cx, cy)) : ownerOf([cx + ox, cy + oy])) === own,
            isExit: (cx, cy) => exitAt.has(keyOf(cx, cy)),
            note,
            toAtlas: ([cx, cy]) => [cx + ox, cy + oy],
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
    const isSinkTile = ([x, y]) => inGrid([x, y]) && grid.cells[y * grid.width + x].kind === 'sink';
    const entrances = {};
    for (const [i, { sub, apName }] of bindings.entries()) {
        // The arrival a game makes: the first atlas exit bound to this
        // sub-region (its entrance tile), else its first owned floor cell.
        // ⛓ Only an exit on the sub-region's OWN ground — a cell the partition gives it, never a sink
        // (session tile-primitives-water-exits): an exit opened in water or on a pit is reached from that
        // ground, and an arrival placed on it priced the region from outside it (L89 r11c12's teleporter in
        // the water; L58 r1c4's pit, from which a search walked out).
        const exit = (region.exits ?? []).find((x) => boundTo(x, sub) && ownerOf(x.entrance_tile) === i
            && !isSinkTile(local(x.entrance_tile)));
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

    layPressTargets(builder, ctx.eventsFor?.(region), local, inGrid);
    bindWorldEvents(builder, ctx.eventsFor?.(region), local, inGrid);
    // ⛓ An exit OPENED on a cell the partition does not own (a pit, a teleporter in water) is bound to one
    // sub-region (⚖ "Own opened exit cells"), so it is taken from that sub-region only: stepping onto it from
    // another's ground is refused (session tile-primitives-water-exits — L58 r2c5 fell into r1c4's pit, an
    // exit AP gives r1c4 alone). A wall can only make the world harder.
    const refused = new Set();
    for (const key of exitAt) {
        if (!boundAt.has(key)) continue;
        const [x, y] = key.split(',').map(Number);
        for (const [dir, dx, dy] of MOVES) {
            const ch = rows[y - dy]?.[x - dx];
            if (ch && ch !== '.' && ch !== rows[y][x] && builder.isFloor(x - dx, y - dy)) refused.add(`${x},${y},${dir}`);
        }
    }
    const entryGates = levelWorldEntryGates(builder, grid, claimed, resolveCondition, refused,
        (n) => note({ ...n, tile: [n.tile[0] + ox, n.tile[1] + oy] }));
    // ⛓ BLOCK SINKS (session tile-primitives-sphere-order-1, ⚖ 2026-10-25 "Sink from grid terrain"): in a world with a
    // block, every terrain cell the game's block sinks into (`ctx.blockSinkCell`: Seedling's water, lava, pit) —
    // L8's lane block is shoved into the water to clear the lane. An entity's cell is the entity's, never a sink.
    // ⛓ PIT SINKS (session tile-primitives-pit-sinks-landings): floored or NOT — a pit the player cannot walk is
    // still a cell the block slides into and dies on (a pit is a "Tile", not "Solid": `Tile.as` `types`), as L63's
    // spear block is struck into the pit at [8,6]. The engine lets a block onto a sink cell that is not floor. A block
    // arrives from a floored cell beside it (a push or a strike moves it one cell), so an unfloored sink with no floored
    // neighbour is never entered and is not laid.
    const blockSinks = [];
    if (blocks.length > 0 && typeof ctx.blockSinkCell === 'function') {
        for (let y = 0; y < grid.height; y += 1) {
            for (let x = 0; x < grid.width; x += 1) {
                if (claimed.has(keyOf(x, y))) continue;
                if (!builder.isFloor(x, y) && !MOVES.some(([, dx, dy]) => builder.isFloor(x + dx, y + dy))) continue;
                if (ctx.blockSinkCell(grid.cells[y * grid.width + x])) blockSinks.push({ x, y });
            }
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
        ...(entryGates.length > 0 ? { entry_gates: entryGates } : {}),
        ...(blockSinks.length > 0 ? { block_sinks: blockSinks } : {}),
        ...(blockPush !== null && blockPush !== 'walk'
            ? { block_strike: { struck_by: JSON.parse(blockPush).by, reach: JSON.parse(blockPush).reach } } : {}),
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
