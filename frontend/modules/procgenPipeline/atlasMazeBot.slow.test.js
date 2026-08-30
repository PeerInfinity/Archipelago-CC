/**
 * Region atlas Phase 8, slice A — the HEADLESS WITNESS.
 *
 * A world containing pieces of a real Seedling map is proven playable by
 * WALKING IT, tile by tile, through the real maze engine — no browser, no
 * substrate panel, no pipeline internals.
 *
 * Why this file exists at all: the sphere oracle (compareSpheresToPlan) and the
 * atlas sorter share the placement's own assumptions, so they cannot witness
 * their own correctness. This bot does not. Its whole input is the COMMITTED
 * preset — `rules.json` for the logic and its `preset_sidecars` for the
 * geometry — and its whole output is "the player got there". It imports the
 * sorter, the projection and the compiler NOT AT ALL.
 *
 * Two presets, two different claims:
 *
 *   seedling_atlas_sphere — BEATABILITY. A grown world with real map regions
 *     placed in it. Every canonical location is checked in a logic-consistent
 *     order (pinned against the preset's own EMBEDDED sphere log — this preset
 *     has no .jsonl sidecar), `victory` is acquired, nothing stalls.
 *
 *   seedling_atlas_maze — TRAVERSAL COMPLETENESS. This preset is a FIXTURE,
 *     not a beatable world: its completion condition is constant-true and the
 *     items its gates name are not in its pool, so "beat it" is not a claim
 *     that could be made. What IS claimable is that the projected map is
 *     WALKABLE: grant the gate items externally and every region can be
 *     entered, every exit crossed, the one marked location checked — and with
 *     the items withheld the gated exits are genuinely shut.
 *
 * Three things about the walk are load-bearing, and each has bitten before:
 *
 *   1. INVENTORY IS A Map<name, count>, end to end. `inventoryCount` reads a
 *      Map directly, so Has/HasAll/HasAny/AtLeast/count gates all evaluate with
 *      zero stubbing — which is the only reason the `Progressive Swim x2` gate
 *      in overworld_start__r8c0 can be tested headlessly at all.
 *
 *   2. AN EXIT-TILE STEP *IS* A CROSSING. In-app, stepping onto an exit tile
 *      fires `exit_cross` → `user:regionMove`. So the bot may never treat a
 *      crossing cell as ordinary floor on the way somewhere else. Every
 *      in-region walk therefore runs with `excludeOtherExits`, and when that
 *      severs the route (20x20 atlas sub-regions are mostly wall with a
 *      handful of scattered exit tiles) the bot routes around it THROUGH THE
 *      REGION GRAPH — cross, and come back standing on the far tile — rather
 *      than teleporting or quietly walking through.
 *
 *   3. ROUTE OVER THE SIDECAR EXIT SET, NEVER THE AP GRAPH. AP lists exits the
 *      projection deliberately WALLED (`overworld_start__r1c6 <-> r8c0` is an
 *      unlabelled crossing, walled in both directions by Phase 5b). A router
 *      that trusts the AP graph picks one, finds no tile to walk to, and
 *      stalls in silence. The bot's geometry comes from the sidecars alone.
 *
 * It lives in the *.slow tier beside braidSphereBot because that is where the
 * fork's playback witnesses live, not because it is expensive: the walk is
 * engine-stepped rather than wall-clock, so ~400 steps across 24 real maze
 * worlds take about a tenth of a second. CI runs this tier
 * (`npm run test:unit:slow`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
    buildAccessibilityModel, pickNextTarget, generateSphereLog, computeAccessibleLocations,
} from '../shared/procgen/forwardSimulator.js';
import {
    deserializeMazeWorld, step, detectStepEvents, isFloor, getExitAt, getObstacle,
} from '../mazeRoom/mazeRoomEngine.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import { findPath, stepsToInputs } from '../mazeRoom/mazeAutopather.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const PLAYER = '1';

const loadPreset = (game) => JSON.parse(readFileSync(
    path.join(REPO, `frontend/presets/${game}/AP_1/AP_1_rules.json`), 'utf8'));

// Safety ceiling on a single walk. Every region here is at most 20x20, so a
// leg that needs more than this is a planner/engine disagreement, not a long
// corridor.
const MAX_LEG_STEPS = 2000;

// ---------------------------------------------------------------------------
// The bot
// ---------------------------------------------------------------------------

/**
 * Deserialize every maze-substrate sidecar into a real playable world. This is
 * the SAME call the runtime warehouse makes (procgenPlayerEngine.buildWarehouse
 * -> the maze substrate's deserialize), so the geometry the bot walks is the
 * geometry the panel would render.
 */
function loadWorlds(rulesDoc) {
    const sidecars = rulesDoc.preset_sidecars?.[PLAYER] ?? {};
    const worlds = new Map();
    for (const [name, entry] of Object.entries(sidecars)) {
        if (entry?.substrate !== 'maze') continue;
        worlds.set(name, deserializeMazeWorld(entry.playable_payload));
    }
    return worlds;
}

/** Mirrors procgenPlayerEngine.findStartRegion: skip the synthetic Menu. */
function resolveStartRegion(rulesDoc, worlds) {
    const decl = rulesDoc.start_regions?.[PLAYER];
    const declared = Array.isArray(decl?.default) ? decl.default[0]
        : (Array.isArray(decl) ? decl[0] : null);
    if (!declared) return null;
    if (worlds.has(declared)) return declared;
    for (const exit of rulesDoc.regions?.[PLAYER]?.[declared]?.exits ?? []) {
        if (worlds.has(exit.connected_region)) return exit.connected_region;
    }
    return null;
}

/**
 * Where the player stands on arrival, mirroring procgenPlayer's handleRegionMove
 * + the maze panel's arrival spawn (procgenPlayer/index.js:171-186): the SOURCE
 * exit's `targetExitId` names an exit IN THE TARGET world, and the player lands
 * on its tile. A one-way crossing has no reverse row to land on, so the
 * destination's own entrance is the documented fallback (`one_way_arrival`).
 */
function arrivalTile(world, exitId) {
    if (exitId && world.exits?.has(exitId)) {
        const e = world.exits.get(exitId);
        return { x: e.x, y: e.y, viaEntrance: false };
    }
    return { x: world.entrance.x, y: world.entrance.y, viaEntrance: true };
}

const nodeKey = (region, exitId) => `${region}|${exitId ?? '@entrance'}`;

function walkOpts(world, inventory) {
    return {
        inventory,
        obstacleLib: world.obstacleLib,
        // Invariant 2: a crossing cell is not floor to walk over.
        excludeOtherExits: true,
    };
}

/**
 * Plan a route from a (region, arrival-exit) node to a goal, over the SIDECAR
 * exit graph (invariant 3). BFS across region nodes; the position inside a
 * region is a function of WHICH exit you arrived through, which is exactly what
 * makes "cross and come back" a legitimate way to reach a tile that
 * `excludeOtherExits` walled off from the entrance.
 *
 * `goalTileIn(region, world)` returns the tile to finish on, or null if this
 * region cannot host the goal.
 *
 * Returns { legs: [{region, exitId}], region, tile } — the exits to cross in
 * order, then the region and tile of the final walk.
 */
function planRoute(worlds, inventory, from, goalTileIn) {
    const seen = new Set([nodeKey(from.region, from.exitId)]);
    let frontier = [{ region: from.region, exitId: from.exitId, legs: [] }];
    while (frontier.length > 0) {
        const next = [];
        for (const node of frontier) {
            const world = worlds.get(node.region);
            if (!world) continue;
            const at = arrivalTile(world, node.exitId);

            const goalTile = goalTileIn(node.region, world, at);
            if (goalTile) {
                const p = findPath(world, at, { kind: 'tile', x: goalTile.x, y: goalTile.y },
                    walkOpts(world, inventory));
                if (p) return { legs: node.legs, region: node.region, tile: goalTile };
            }

            for (const exit of world.exits.values()) {
                if (!worlds.has(exit.targetRegion)) continue;
                const key = nodeKey(exit.targetRegion, exit.targetExitId ?? null);
                if (seen.has(key)) continue;
                const p = findPath(world, at, { kind: 'tile', x: exit.x, y: exit.y },
                    walkOpts(world, inventory));
                if (!p) continue;
                seen.add(key);
                next.push({
                    region: exit.targetRegion,
                    exitId: exit.targetExitId ?? null,
                    legs: [...node.legs, { region: node.region, exitId: exit.exit_id }],
                });
            }
        }
        frontier = next;
    }
    return null;
}

function createBot(rulesDoc, opts = {}) {
    const model = buildAccessibilityModel(rulesDoc, PLAYER);
    const worlds = loadWorlds(rulesDoc);
    const placements = rulesDoc.canonical_placements?.[PLAYER] ?? {};
    // `startAt` drops the bot at a specific (region, arrival-exit) node instead
    // of the world's start — used to interrogate one region's routing directly.
    const startAt = opts.startAt ?? null;
    const start = startAt?.region ?? resolveStartRegion(rulesDoc, worlds);

    // Map<name, count>, never a Set (invariant 1).
    const inventory = new Map();
    for (const name of rulesDoc.starting_items?.[PLAYER] ?? []) {
        inventory.set(name, (inventory.get(name) ?? 0) + 1);
    }
    for (const [name, count] of Object.entries(opts.grantedItems ?? {})) {
        inventory.set(name, (inventory.get(name) ?? 0) + count);
    }

    const bot = {
        model,
        worlds,
        inventory,
        region: start,
        exitId: startAt?.exitId ?? null,
        pos: start ? arrivalTile(worlds.get(start), startAt?.exitId ?? null) : null,
        checked: new Set(),
        checkOrder: [],
        visitedRegions: new Set(start ? [start] : []),
        crossed: new Set(),
        oneWayArrivals: [],
        steps: 0,
        findings: [],
    };

    /**
     * Grant whatever `canonical_placements` says this location holds.
     *
     * Before granting, check AP logic INDEPENDENTLY: was this location actually
     * accessible with what the player held a moment ago? The bot only ever
     * walks toward targets `pickNextTarget` chose, but it also picks up
     * anything it happens to step on EN ROUTE — and a tile route that reaches a
     * chest AP logic says is still locked is an under-gated projection, which
     * is exactly the class of bug a tile-walking witness exists to catch.
     */
    function collect(world, x, y) {
        const name = world.itemLocationNames?.get(`${x},${y}`);
        if (!name || bot.checked.has(name)) return;
        if (model.locationIndex.has(name)
            && !computeAccessibleLocations(model, bot.inventory).has(name)) {
            bot.findings.push(`${name} was physically reachable but AP logic says it is NOT `
                + `accessible yet (held: ${describeInventory(bot.inventory)})`);
        }
        bot.checked.add(name);
        bot.checkOrder.push(name);
        const item = placements[name] ?? model.locationIndex.get(name)?.item?.name ?? null;
        if (item) bot.inventory.set(item, (bot.inventory.get(item) ?? 0) + 1);
    }

    /** Take one engine step, folding in whatever it produced. */
    function stepOnce(world, state, input, expectExitId) {
        const before = { x: state.player_pos.x, y: state.player_pos.y };
        const nextState = step(world, state, input, bot.inventory);
        if (!nextState) {
            throw new Error(`[atlasMazeBot] the engine REFUSED a planned step ${input} from `
                + `(${before.x},${before.y}) in ${bot.region} — planner/engine disagreement`);
        }
        bot.steps += 1;
        const after = nextState.player_pos;
        for (const ev of detectStepEvents(world, before, after)) {
            if (ev.type === 'pickup') collect(world, after.x, after.y);
            if (ev.type === 'exit_cross' && ev.exit_id !== expectExitId) {
                // An unplanned crossing is the vacuous-negative trap: in-app it
                // would publish a regionMove nobody asked for. Never tolerate it.
                throw new Error(`[atlasMazeBot] UNPLANNED crossing of ${ev.exit_id} in `
                    + `${bot.region} while walking to `
                    + `${expectExitId ?? 'a non-exit tile'}`);
            }
        }
        return nextState;
    }

    function canStandOn(world, x, y) {
        if (!isFloor(world, x, y)) return false;
        const obstacleId = getObstacle(world, x, y);
        if (obstacleId && !isObstacleCleared(obstacleId, bot.inventory, world.obstacleLib)) return false;
        return true;
    }

    /**
     * Walk to `tile` inside the current region. If the tile is an exit, the
     * arrival IS the crossing and the bot relocates.
     *
     * The entrance-==-exit-tile case is real and common (an atlas region's
     * back-exit is retargeted onto its own entrance tile, and a point-gate
     * crossing puts both sides' exits on ONE shared cell): the player can
     * already be standing on the exit it wants to cross. A zero-length path
     * fires no event, so the bot steps OFF and back ON — which is what a human
     * player would do, and what the engine's own same-exit guard
     * (`newExit && (!oldExit || oldExit.exit_id !== newExit.exit_id)`) expects.
     * It never fabricates a move event it did not earn.
     */
    function walkTo(tile) {
        const world = bot.worlds.get(bot.region);
        const exit = getExitAt(world, tile.x, tile.y);
        const expectExitId = exit ? exit.exit_id : null;
        let state = {
            player_pos: { x: bot.pos.x, y: bot.pos.y },
            turn: 0,
            inventory: new Set(),
        };

        if (state.player_pos.x === tile.x && state.player_pos.y === tile.y) {
            if (!exit) return true; // already there, nothing to do
            const bounce = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
                .map((d) => ({ x: tile.x + d.dx, y: tile.y + d.dy }))
                .find((p) => canStandOn(world, p.x, p.y) && !getExitAt(world, p.x, p.y));
            if (!bounce) {
                bot.findings.push(`${bot.region}: exit ${expectExitId} sits on an isolated tile — `
                    + 'no neighbour to step off to, so the crossing cannot be re-entered');
                return false;
            }
            const dirs = stepsToInputs([{ x: tile.x, y: tile.y }, bounce, { x: tile.x, y: tile.y }]);
            state = stepOnce(world, state, dirs[0], null);
            state = stepOnce(world, state, dirs[1], expectExitId);
        } else {
            const plan = findPath(world, bot.pos, { kind: 'tile', x: tile.x, y: tile.y },
                walkOpts(world, bot.inventory));
            if (!plan) return false;
            const inputs = stepsToInputs(plan.steps);
            if (inputs.length > MAX_LEG_STEPS) {
                throw new Error(`[atlasMazeBot] leg of ${inputs.length} steps in ${bot.region} `
                    + 'exceeds the per-leg budget');
            }
            for (let i = 0; i < inputs.length; i++) {
                // Only the LAST step may land on the goal exit.
                state = stepOnce(world, state, inputs[i], i === inputs.length - 1 ? expectExitId : null);
            }
        }

        bot.pos = { x: state.player_pos.x, y: state.player_pos.y };
        if (!exit) return true;

        // Cross.
        bot.crossed.add(`${bot.region}|${exit.exit_id}`);
        const target = bot.worlds.get(exit.targetRegion);
        if (!target) {
            bot.findings.push(`${bot.region}: exit ${exit.exit_id} targets `
                + `${exit.targetRegion}, which has no sidecar`);
            return false;
        }
        const landing = arrivalTile(target, exit.targetExitId ?? null);
        if (landing.viaEntrance) {
            bot.oneWayArrivals.push(`${bot.region}|${exit.exit_id} -> ${exit.targetRegion}`);
        }
        // The arrival must be FLOOR. A generated region's grid-mirror tile is
        // very likely solid rock inside a real map; Phase 6 retargets the
        // back-exit for exactly this reason, and a silent landing-in-a-wall
        // keeps every compile and every oracle green.
        if (!isFloor(target, landing.x, landing.y)) {
            throw new Error(`[atlasMazeBot] arrival in ${exit.targetRegion} at `
                + `(${landing.x},${landing.y}) is a WALL`);
        }
        bot.region = exit.targetRegion;
        bot.exitId = exit.targetExitId ?? null;
        bot.pos = { x: landing.x, y: landing.y };
        bot.visitedRegions.add(bot.region);
        // Standing on a fresh tile can be standing on an item.
        collect(target, landing.x, landing.y);
        return true;
    }

    /** Execute a planned route: cross each leg, then the final walk. */
    function follow(route) {
        for (const leg of route.legs) {
            if (bot.region !== leg.region) {
                throw new Error(`[atlasMazeBot] route desync: at ${bot.region}, leg expects ${leg.region}`);
            }
            const world = bot.worlds.get(bot.region);
            const exit = world.exits.get(leg.exitId);
            if (!exit) throw new Error(`[atlasMazeBot] leg names unknown exit ${leg.exitId}`);
            if (!walkTo({ x: exit.x, y: exit.y })) return false;
        }
        if (bot.region !== route.region) return false;
        // An arrive-only goal is satisfied by BEING here. Walking to the tile
        // would be a no-op at best and, when the arrival tile is itself an
        // exit, an unwanted crossing at worst.
        if (route.tile.arriveOnly) return true;
        return walkTo(route.tile);
    }

    bot.planRoute = (goalTileIn) => planRoute(
        bot.worlds, bot.inventory, { region: bot.region, exitId: bot.exitId }, goalTileIn);
    bot.follow = follow;
    bot.walkTo = walkTo;
    return bot;
}

/** Goal predicate: the tile holding a named AP location. */
const locationGoal = (locationName) => (regionName, world) => {
    for (const [key, name] of world.itemLocationNames ?? []) {
        if (name !== locationName) continue;
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    }
    return null;
};

/** Goal predicate: a specific exit of a specific region (walk to it = cross it). */
const exitGoal = (targetRegion, exitId) => (regionName, world) => {
    if (regionName !== targetRegion) return null;
    const exit = world.exits.get(exitId);
    return exit ? { x: exit.x, y: exit.y } : null;
};

/** Goal predicate: simply BE in a region — arriving is the whole goal. */
const visitGoal = (targetRegion) => (regionName, world, at) => (
    regionName === targetRegion ? { x: at.x, y: at.y, arriveOnly: true } : null);

const describeInventory = (inventory) => (
    [...inventory].map(([name, count]) => `${name} x${count}`).sort().join(', ') || '(nothing)');

/**
 * The beatability walk: repeatedly ask the shared forward simulator what to
 * seek next, then physically go and get it. The ORDER comes from
 * `pickNextTarget` — the one target-selection implementation in the fork — so
 * this bot cannot invent an order the logic does not allow.
 */
function playThrough(bot, { maxTargets = 200 } = {}) {
    for (let i = 0; i < maxTargets; i++) {
        const target = pickNextTarget(bot.model, {
            inventory: bot.inventory,
            checkedLocations: bot.checked,
        });
        if (!target) return { stalled: false };
        const route = bot.planRoute(locationGoal(target.location));
        if (!route) {
            return {
                stalled: true,
                reason: `no tile route from ${bot.region} to ${target.location} `
                    + `(logic says it is reachable) — inventory ${[...bot.inventory].map(([k, v]) => `${k}x${v}`).join(', ')}`,
            };
        }
        if (!bot.follow(route)) {
            return { stalled: true, reason: `route to ${target.location} failed mid-execution` };
        }
        if (!bot.checked.has(target.location)) {
            return { stalled: true, reason: `walked to ${target.location} but no pickup fired` };
        }
    }
    return { stalled: true, reason: 'target budget exhausted' };
}

/**
 * Visit every region the world contains, from wherever the bot currently
 * stands. Beating a world does not require entering regions that hold nothing
 * — but every placed atlas region must still be ENTERABLE, and its arrival
 * tile must be walkable floor (walkTo throws otherwise). Returns the regions
 * that could not be reached.
 */
function sweepRegions(bot) {
    const missed = [];
    for (const name of [...bot.worlds.keys()].sort()) {
        if (bot.visitedRegions.has(name)) continue;
        const route = bot.planRoute(visitGoal(name));
        if (!route || !bot.follow(route)) missed.push(name);
    }
    return missed;
}

/** Integer sphere index per location, read off an embedded sphere log. */
function spheresFromLog(log) {
    const out = new Map();
    for (const entry of log) {
        if (entry?.type !== 'state_update') continue;
        const sphere = Number(String(entry.sphere_index).split('.')[0]);
        for (const name of entry.player_data?.[PLAYER]?.sphere_locations ?? []) {
            out.set(name, sphere);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// seedling_atlas_sphere — beatability
// ---------------------------------------------------------------------------

describe('region atlas Phase 8 — a sphere-grown world with real Seedling regions is BEATABLE', () => {
    let rulesDoc; let bot; let result; let missedRegions;

    beforeAll(() => {
        rulesDoc = loadPreset('seedling_atlas_sphere');
        bot = createBot(rulesDoc);
        result = playThrough(bot);
        // The playthrough only visits regions that hold something. Sweep the
        // rest afterwards so the arrival-lands-on-floor witness covers EVERY
        // placed atlas region, not just the ones on the critical path.
        missedRegions = sweepRegions(bot);
    });

    it('walks the whole world without stalling', () => {
        expect(result.reason ?? null, 'stall').toBe(null);
        expect(result.stalled).toBe(false);
    });

    it('checks EVERY canonical location', () => {
        const canonical = Object.keys(rulesDoc.canonical_placements[PLAYER]).sort();
        expect([...bot.checked].sort()).toEqual(canonical);
    });

    it('acquires the completion item', () => {
        const goal = rulesDoc.game_info?.[PLAYER]?.completion_condition;
        expect(goal?.type, 'this preset really has an item goal').toBe('item_check');
        expect(bot.inventory.get(goal.item) ?? 0).toBeGreaterThan(0);
    });

    it('enters every region the world contains, landing on floor each time', () => {
        // walkTo throws on a wall landing, so reaching here already proves the
        // arrivals were walkable; this pins the COVERAGE. A generated region's
        // grid-mirror back-exit tile is very likely solid rock inside a real
        // map — Phase 6 retargets it onto the projection's own entrance tile
        // precisely so this assertion can hold.
        expect(missedRegions, 'unreachable regions').toEqual([]);
        expect([...bot.visitedRegions].sort())
            .toEqual([...bot.worlds.keys()].sort());
    });

    it('really walked — bounded steps, and enough of them to be a walk', () => {
        // A lower bound as well as an upper one: every assertion above is
        // satisfiable by a bot that teleports, so pin that real tiles went by.
        // Measured 2026-07-28 on the whole-atlas world: 573 steps, 33 crossings
        // (245 / 25 before the vocabulary lift put all ten map regions in).
        expect(bot.steps, `steps=${bot.steps}`).toBeGreaterThan(100);
        expect(bot.steps, `steps=${bot.steps}`).toBeLessThan(20000);
        expect(bot.crossed.size, 'crossings').toBeGreaterThanOrEqual(bot.worlds.size - 1);
    });

    it('opens the map\'s sword-or-spear crossings with EITHER weapon', () => {
        // The acceptance headline for the vocabulary lift. Four of the ten map
        // regions sit behind `Progressive Sword OR Ghost Spear`; the sorter
        // scheduled only ONE of those items, and a gate re-synthesised from the
        // scheduled disjunct would have quietly killed the other branch. So walk
        // it: hold only the Sword, then only the Spear, and each time the tiles
        // in front of those crossings must actually be walkable.
        const orGated = [];
        for (const [regionName, world] of bot.worlds) {
            for (const exit of world.exits.values()) {
                const obstacleId = getObstacle(world, exit.x, exit.y);
                const def = obstacleId ? world.obstacleLib?.[obstacleId] : null;
                const text = JSON.stringify(def?.clear_set ?? def?.rule ?? def ?? null);
                if (text.includes('Ghost Spear') && text.includes('Progressive Sword')) {
                    orGated.push({ regionName, exit, obstacleId });
                }
            }
        }
        expect(orGated.length, 'this world really has sword-or-spear crossings')
            .toBeGreaterThan(0);
        for (const branch of ['Progressive Sword', 'Ghost Spear']) {
            const only = new Map([[branch, 1]]);
            for (const { regionName, exit, obstacleId } of orGated) {
                const world = bot.worlds.get(regionName);
                expect(isObstacleCleared(obstacleId, only, world.obstacleLib),
                    `${regionName}|${exit.exit_id} with only ${branch}`).toBe(true);
            }
            // ...and neither branch is a free pass: with NEITHER weapon the same
            // crossing stays shut, so the assertion above is about the OR and
            // not about a gate that was never really there.
            for (const { regionName, exit, obstacleId } of orGated) {
                const world = bot.worlds.get(regionName);
                expect(isObstacleCleared(obstacleId, new Map(), world.obstacleLib),
                    `${regionName}|${exit.exit_id} with nothing`).toBe(false);
            }
        }
    });

    it('the preset\'s EMBEDDED sphere log is what the shared simulator regenerates', () => {
        // This preset carries no .jsonl sidecar — the embedded `sphere_log`
        // array IS the log, and consumers prefer it. Regenerating it from the
        // committed rules must reproduce it exactly, or the embedded log is
        // stale and every consumer downstream is reading a lie.
        expect(rulesDoc.sphere_log, 'embedded sphere log').toBeInstanceOf(Array);
        expect(generateSphereLog(rulesDoc)).toEqual(rulesDoc.sphere_log);
    });

    it('walks exactly the advancement locations the embedded sphere log names', () => {
        const spheres = spheresFromLog(rulesDoc.sphere_log);
        expect(spheres.size, 'the log names advancement locations').toBeGreaterThan(0);
        expect(bot.checkOrder.filter((name) => spheres.has(name)).sort())
            .toEqual([...spheres.keys()].sort());
    });

    it('checks every location in a LOGIC-CONSISTENT order', () => {
        // Not sphere-monotonic, and deliberately not asserted as such: the
        // shared `pickNextTarget` walks the alphabetically-first ACCESSIBLE
        // location, so a sphere-1 pick whose name sorts earlier legitimately
        // precedes a still-untouched sphere-0 one. What must hold — and what
        // the walk could actually violate, by reaching a chest through
        // under-gated terrain — is that each location was AP-accessible at the
        // moment the bot checked it. `collect` verifies that against the model
        // independently of whatever the router believed.
        expect(bot.findings, 'logic violations during the walk').toEqual([]);

        // And replay it: re-deriving accessibility from the check order alone
        // must reproduce the same walk, with no location taken early.
        const inventory = new Map();
        for (const name of rulesDoc.starting_items?.[PLAYER] ?? []) {
            inventory.set(name, (inventory.get(name) ?? 0) + 1);
        }
        for (const name of bot.checkOrder) {
            expect(computeAccessibleLocations(bot.model, inventory).has(name), name).toBe(true);
            const item = rulesDoc.canonical_placements[PLAYER][name];
            if (item) inventory.set(item, (inventory.get(item) ?? 0) + 1);
        }
    });

    it('routes AROUND a crossing that excludeOtherExits severs, via the region graph', () => {
        // The positive control for invariant 2. A region whose exits are
        // mutually unreachable without stepping OVER an intervening crossing
        // (the common shape: a back-exit sitting on the region's own entrance
        // tile) has no good in-region answer — treating that cell as floor
        // publishes a regionMove nobody asked for; walling it severs the region.
        // The bot takes neither option: it crosses out and comes back, arriving
        // ON the tile that was in the way.
        //
        // The severed pair is DISCOVERED rather than named, so a regenerated
        // world keeps testing the thing instead of testing a stale region id.
        let found = null;
        for (const [regionName, world] of bot.worlds) {
            const opts = (strict) => ({
                inventory: bot.inventory, obstacleLib: world.obstacleLib, excludeOtherExits: strict,
            });
            for (const from of world.exits.values()) {
                for (const to of world.exits.values()) {
                    if (from.exit_id === to.exit_id) continue;
                    const goal = { kind: 'tile', x: to.x, y: to.y };
                    const start = { x: from.x, y: from.y };
                    if (findPath(world, start, goal, opts(false))
                            && !findPath(world, start, goal, opts(true))) {
                        found = found ?? { regionName, from: from.exit_id, to: to.exit_id };
                    }
                }
            }
        }
        expect(found, 'some region in this world really is severed by excludeOtherExits')
            .toBeTruthy();
        const { regionName, from, to } = found;
        // Every exit of that region was crossed during the playthrough anyway.
        for (const exit of bot.worlds.get(regionName).exits.values()) {
            expect(bot.crossed.has(`${regionName}|${exit.exit_id}`),
                `${regionName}|${exit.exit_id}`).toBe(true);
        }

        // And here is HOW: standing where an arrival through `from` puts the
        // player, the planner answers the severed request with a route that
        // LEAVES the region and comes back — never with a straight walk over
        // the intervening crossing.
        const probe = createBot(rulesDoc, {
            grantedItems: Object.fromEntries(bot.inventory),
            startAt: { region: regionName, exitId: from },
        });
        const route = probe.planRoute(exitGoal(regionName, to));
        expect(route, `the planner found a way from ${from} to ${to} in ${regionName}`)
            .toBeTruthy();
        expect(route.legs.length, 'it is not a straight in-region walk').toBeGreaterThan(0);
        expect(route.legs.some((leg) => leg.region !== regionName),
            `legs ${JSON.stringify(route.legs)}`).toBe(true);
        expect(probe.follow(route), 'and it is walkable').toBe(true);
        expect(probe.crossed.has(`${regionName}|${to}`)).toBe(true);
    });

    it('routes over the SIDECAR exit set, not the AP graph', () => {
        // The AP graph is a superset: it lists the Menu -> start hop, and (in
        // the maze preset) crossings the projection walled. Nothing the bot
        // crossed may be absent from the sidecars.
        for (const key of bot.crossed) {
            const [region, exitId] = key.split('|');
            expect(bot.worlds.get(region)?.exits?.has(exitId), key).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// seedling_atlas_maze — traversal completeness
// ---------------------------------------------------------------------------

// The gate vocabulary of the committed maze preset. These items are NOT in the
// preset's pool (it holds one Seal) — the preset is a projection fixture, so
// the bot is granted them the way the in-app leg grants through stateManager.
const MAZE_GATE_ITEMS = { 'Progressive Swim': 2, 'Progressive Sword': 1 };

function sidecarExits(worlds) {
    const out = [];
    for (const [region, world] of worlds) {
        for (const exit of world.exits.values()) out.push({ region, exitId: exit.exit_id });
    }
    return out;
}

/** Cross every exit reachable under `granted`, greedily and deterministically. */
function traverseEverything(bot) {
    const wanted = sidecarExits(bot.worlds);
    let progress = true;
    while (progress) {
        progress = false;
        for (const { region, exitId } of wanted) {
            if (bot.crossed.has(`${region}|${exitId}`)) continue;
            const route = bot.planRoute(exitGoal(region, exitId));
            if (!route) continue;
            if (bot.follow(route)) progress = true;
        }
    }
    return wanted.filter(({ region, exitId }) => !bot.crossed.has(`${region}|${exitId}`));
}

describe('region atlas Phase 8 — the projected Seedling map is fully TRAVERSABLE', () => {
    let rulesDoc; let bot; let uncrossed; let walk;

    beforeAll(() => {
        rulesDoc = loadPreset('seedling_atlas_maze');
        bot = createBot(rulesDoc, { grantedItems: MAZE_GATE_ITEMS });
        // Check the marked location first (the same pickNextTarget loop the
        // beatable preset uses — here it terminates after the one chest),
        // then sweep every remaining crossing.
        walk = playThrough(bot);
        uncrossed = traverseEverything(bot);
    });

    it('is the fixture it claims to be (constant-true goal, gate items absent from the pool)', () => {
        // Guard against a future regeneration turning this into a beatable
        // world without anyone noticing — the assertions below would then be
        // testing the wrong claim.
        expect(rulesDoc.game_info?.[PLAYER]?.completion_condition)
            .toEqual({ type: 'constant', value: true });
        for (const item of Object.keys(MAZE_GATE_ITEMS)) {
            expect(rulesDoc.itempool_counts?.[PLAYER]?.[item] ?? 0, `${item} in pool`).toBe(0);
        }
    });

    it('crosses EVERY exit the sidecars declare', () => {
        expect(uncrossed.map((e) => `${e.region}|${e.exitId}`)).toEqual([]);
        // The committed projection declares 20 (10 sub-regions, 10 reciprocal
        // pairs). Pinning the count keeps a regeneration that DROPS exits from
        // passing a "crossed them all" assertion with a shorter list.
        expect(bot.crossed.size, 'crossings').toBe(20);
        expect(bot.steps, `steps=${bot.steps}`).toBeGreaterThan(50);
    });

    it('enters EVERY region', () => {
        expect([...bot.visitedRegions].sort()).toEqual([...bot.worlds.keys()].sort());
    });

    it('checks the one location the atlas marks', () => {
        expect(walk.reason ?? null, 'stall').toBe(null);
        expect(bot.checkOrder).toEqual(['Starting House - Chest']);
    });

    it('an exit tile is NOT floor — the loose route would fire a crossing, the strict one does not', () => {
        // The other half of invariant 2's positive control. In owls_nest_entrance
        // the shortest walk from the spawn to the dungeon descent goes straight
        // over the stairs back to the overworld: in-app that step publishes
        // user:regionMove and the player is somewhere else entirely, while the
        // walk carries on believing it is still in the room.
        const world = bot.worlds.get('owls_nest_entrance');
        const descent = world.exits.get('owls_nest_entrance -> dungeon1_room1__r0c4');
        const from = { x: world.entrance.x, y: world.entrance.y };
        const goal = { kind: 'tile', x: descent.x, y: descent.y };
        const base = { inventory: bot.inventory, obstacleLib: world.obstacleLib };
        const loose = findPath(world, from, goal, base);
        const strict = findPath(world, from, goal, { ...base, excludeOtherExits: true });
        const crossingsOnRoute = (p) => p.steps.slice(1, -1)
            .filter((t) => getExitAt(world, t.x, t.y))
            .map((t) => getExitAt(world, t.x, t.y).exit_id);
        expect(loose, 'a loose route exists').toBeTruthy();
        expect(crossingsOnRoute(loose), 'the loose route walks over another exit')
            .toEqual(['owls_nest_entrance -> overworld_start__r8c0']);
        expect(strict, 'a crossing-free route also exists').toBeTruthy();
        expect(crossingsOnRoute(strict)).toEqual([]);
    });

    it('never crosses an exit the AP graph lists but the projection WALLED', () => {
        // r1c6 <-> r8c0 is an unlabelled crossing: Phase 5b walls it in both
        // directions, but the AP compiler still emits the pair. A router
        // trusting AP picks it, resolves no tile, and stalls in silence.
        const apOnly = [];
        for (const [region, def] of Object.entries(rulesDoc.regions[PLAYER])) {
            const world = bot.worlds.get(region);
            if (!world) continue;
            for (const exit of def.exits ?? []) {
                if (!world.exits.has(exit.name)) apOnly.push(`${region}|${exit.name}`);
            }
        }
        expect(apOnly, 'the walled pair is still in the AP graph').toEqual([
            'overworld_start__r1c6|overworld_start__r1c6 -> overworld_start__r8c0',
            'overworld_start__r8c0|overworld_start__r8c0 -> overworld_start__r1c6',
        ]);
        for (const key of apOnly) expect(bot.crossed.has(key), key).toBe(false);
    });

    it('a COUNT gate opens at exactly the right count and not one earlier', () => {
        // overworld_start__r8c0's two crossings to r2c13 / r4c16 sit behind
        // `Has(Progressive Swim, count: 2)` — the water column costs one
        // Progressive Swim going down and two coming back up. This is the
        // assertion that only a Map<name,count> inventory can make; a
        // count-collapsed Set opens it at 1 and the whole gate evaporates.
        const gated = [
            ['overworld_start__r8c0', 'overworld_start__r8c0 -> overworld_start__r2c13'],
            ['overworld_start__r8c0', 'overworld_start__r8c0 -> overworld_start__r4c16'],
        ];
        const reachable = (swim) => {
            const probe = createBot(rulesDoc, { grantedItems: { 'Progressive Swim': swim } });
            return gated.map(([region, exitId]) => !!probe.planRoute(exitGoal(region, exitId)));
        };
        expect(reachable(0), 'no Swim').toEqual([false, false]);
        expect(reachable(1), 'one Swim — one short').toEqual([false, false]);
        expect(reachable(2), 'two Swim — open').toEqual([true, true]);
    });

    it('a rule-gated exit is SHUT without its item and OPEN with it', () => {
        // The dungeon descent behind (Progressive Sword OR Ghost Spear), and
        // the same rule again on the overworld crossing to r11c19. Either
        // disjunct opens it — which is why the analyzer emits an Or rather
        // than a leave-one-out diff.
        const gated = [
            ['dungeon1_room1__r0c4', 'dungeon1_room1__r0c4 -> dungeon1_room1__r8c6'],
            ['overworld_start__r8c0', 'overworld_start__r8c0 -> overworld_start__r11c19'],
        ];
        const reachable = (granted) => {
            const probe = createBot(rulesDoc, { grantedItems: granted });
            return gated.map(([region, exitId]) => !!probe.planRoute(exitGoal(region, exitId)));
        };
        expect(reachable({}), 'nothing held').toEqual([false, false]);
        expect(reachable({ 'Progressive Sword': 1 }), 'sword').toEqual([true, true]);
        expect(reachable({ 'Ghost Spear': 1 }), 'the OTHER disjunct').toEqual([true, true]);
    });

    it('reports every one-way arrival rather than hiding it', () => {
        // A crossing with no reverse row lands on the destination's entrance
        // (Phase 5b's `one_way_arrival` fence). The committed atlas has none;
        // if one appears, this names it instead of letting the bot silently
        // spawn somewhere the map did not choose.
        expect(bot.oneWayArrivals).toEqual([]);
    });

    it('surfaces its findings rather than routing around them silently', () => {
        expect(bot.findings).toEqual([]);
    });
});
