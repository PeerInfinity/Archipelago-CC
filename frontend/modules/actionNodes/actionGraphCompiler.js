/**
 * actionNodes/actionGraphCompiler — **AN ACTION GRAPH → AN ORDINARY `rules.json`**, with the Archipelago logic
 * derived by exact search and the A6 proof in the document.
 *
 * A standalone compiler in the shape of `procgenPipeline/regionAtlasCompiler.js` `compileRegionAtlas`: it builds on
 * `makeRulesJsonScaffold` and the rule helpers (`shared/rulesJsonBuilder.js`) and touches no generator. The graph IS
 * the content, so there is no layout driver (design §2).
 *
 *   1. validate the graph (`actionGraph.js`, refusal by name);
 *   2. regions: `Menu` → the start node; one region per node; for each `after` edge A→B a FORWARD exit A→B (gated by
 *      "some one-loop plan reaches B") and a REVERSE exit B→A (ungated, `reverse: true` in the payload): movement
 *      between nodes reached this loop is free (⚖ Robert 2026-11-16T17:41:55Z; two-way edges, planner 21:09:12Z). There
 *      is no return-to-start exit: reaching the start is the `Menu → start` hop, as in every substrate;
 *   3. locations: one per check node (its name); the goal node holds the `Victory` event item;
 *   4. items: each boon `count` times, then the graph's `filler` boon to match the check count;
 *   5. access rules from `actionSearch.js` `deriveActionLogic`: a location's rule is "some one-loop plan performs the
 *      node with the items held", an exit's is "some one-loop plan reaches the node it leads to";
 *   6. a deterministic assumed fill (seeded), so the world is a complete, placed rules.json;
 *   7. `preset_sidecars[p]`, the `action_nodes[p]` block, `procgen_metadata[p]` with the logic and proof report,
 *      `provenance[p]`;
 *   8. the sphere log, `shared/procgen/forwardSimulator.js` `generateSphereLog`, embedded;
 *   9. `loop_costs[p]`, written directly: the costs are the graph's own (move cost 0, A10; `actions.act` = time);
 *  10. `discovery_mode[p] = {enabled: true, bundle: 'actionNodes'}` (AN-1b: the discovery policy, Loop mode on or off).
 *
 * ⛓ THE A6 PROOF (design §7). A6: in each loop at least one location check can be earned. The compiler refuses by
 * name when (1) a check or the goal has no item combination that earns it (`check-never-earnable`), or (2) the sphere
 * log over the derived rules does not reach the goal (`goal-not-in-logic`). A check is in logic exactly when a
 * one-loop plan earns it, and Archipelago's fill guarantees an unchecked in-logic location whenever the game is not
 * waiting on another world; so whenever the player is not waiting, some loop earns a check.
 *
 * Pure apart from the deterministic rng: no registry, no DOM, no I/O. The output is byte-stable for a given graph and
 * seed (no clock).
 */

import {
    makeAndRule, makeExit, makeHasRule, makeLocation, makeOrRule, makeRegion, makeRulesJsonScaffold, makeTrueRule,
} from '../shared/rulesJsonBuilder.js';
import { createRng } from '../shared/rng.js';
import { generateSphereLog } from '../shared/procgen/forwardSimulator.js';
import { DEFAULT_LOCATION_COST, DEFAULT_MANA_PER_ITEM, START_REGION_MOVE_COST } from '../shared/procgen/loopCostDefaults.js';
import { GOAL_ITEM } from '../procgenCore/goalItem.js';
import { allocateIdsBySortedName, namespaceNamed } from '../procgenCore/apIdNamespaces.js';
import { predecessorsOf, resolvedBoostOf, resolvedSettingsOf, successorsOf } from './actionGraph.js';
import { buildActionModel } from './actionModel.js';
import { DEFAULT_STATE_BUDGET, deriveActionLogic, describeWitness, combinationByName } from './actionSearch.js';

/** The substrate id every compiled region names. */
export const ACTION_NODES_SUBSTRATE_ID = 'action_nodes';
/** The game identity of a compiled world. */
export const ACTION_NODES_GAME = Object.freeze({
    gameName: 'Action Nodes',
    gameDirectory: 'action_nodes',
    worldClassName: 'ActionNodesWorld',
});
/** The per-world block's schema version (`action_nodes[p].schema_version`). */
export const ACTION_NODES_BLOCK_VERSION = 1;
/** The Loops queue verb that performs a node (⚖ user 2026-11-15, Q4). */
export const ACT_ACTION = 'act';
/** The `discovery_mode[p].bundle` a compiled world names (discovery/worldDiscoveryMode.js `ACTION_NODES_BUNDLE`). */
export const ACTION_NODES_DISCOVERY_BUNDLE = 'actionNodes';
/** The `procgen_metadata[p].driver` a compiled world records. */
export const ACTION_GRAPH_DRIVER = 'action-graph-compiler';

export const ACTION_COMPILE_REFUSALS = Object.freeze({
    CHECK_NEVER_EARNABLE: 'check-never-earnable',
    NODE_NEVER_REACHED: 'node-never-reached',
    GOAL_NOT_IN_LOGIC: 'goal-not-in-logic',
    FILL_FAILED: 'fill-failed',
});

export class ActionCompileError extends Error {
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.name = 'ActionCompileError';
        this.code = code;
    }
}

const MENU = 'Menu';
const exitNameOf = (from, to) => `${from} -> ${to}`;

/**
 * ⛓ TWO-WAY EDGES (AN-1b). Every node's exits, forward first (in `successorsOf` order), then its reverse exits back to
 * each predecessor (in `predecessorsOf` order). A reverse exit is ungated: the logic does not change meaning, because
 * every location and forward-exit rule is already the exact one-loop answer (the search assumes free movement), so a
 * region reachable through a reverse exit gains no location and no exit. The Region Graph merges an exit pair A→B +
 * B→A into ONE edge, so the graph still draws one edge per `after` edge.
 * @returns {{to: string, reverse: boolean}[]}
 */
export function nodeExitsOf(graph, id) {
    return [
        ...successorsOf(graph, id).map((to) => ({ to, reverse: false })),
        ...predecessorsOf(graph, id).map((to) => ({ to, reverse: true })),
    ];
}

/** A rule over the minimal combinations: Or of And(Has(item, n)…); an empty combination is True. */
function ruleOf(model, combos) {
    if (combos.some((c) => c.every((n) => n === 0))) return makeTrueRule();
    return makeOrRule(combos.map((c) => makeAndRule(
        model.boons.flatMap((b, i) => (c[i] > 0 ? [makeHasRule(b.name, c[i])] : [])),
    )));
}

const satisfies = (combos, held) => combos.some((c) => c.every((n, i) => n <= held[i]));

/**
 * The item pool, one entry per copy: every boon `count` times, then the filler boon to match the check count.
 * @returns {number[]} boon indices
 */
function itemPoolOf(model, graph) {
    const pool = model.boons.flatMap((b, i) => Array.from({ length: b.count }, () => i));
    const short = model.checkIndices.length - pool.length;
    if (short > 0) {
        const filler = model.boons.findIndex((b) => b.id === graph.filler);
        for (let k = 0; k < short; k += 1) pool.push(filler);
    }
    return pool;
}

/**
 * Assumed fill over the derived rules: each progression copy goes to an empty check that is in logic with every copy
 * not yet placed, plus whatever the placed copies then unlock; the rest go to the remaining checks. Seeded and
 * deterministic.
 * @returns {Map<number, number>} check node index → boon index
 */
function assumedFill(model, logic, pool, progression, seed) {
    const rng = createRng(seed);
    const checks = model.checkIndices;
    const placed = new Map();
    const prog = rng.shuffle(pool.filter((b) => progression.has(b)));
    const rest = pool.filter((b) => !progression.has(b));
    const vectorOf = (copies) => {
        const v = model.boons.map(() => 0);
        for (const b of copies) v[b] += 1;
        return v;
    };
    while (prog.length) {
        const item = prog.pop();
        const held = vectorOf(prog);
        let grew = true;
        const collected = new Set();
        while (grew) {
            grew = false;
            for (const [loc, b] of placed) {
                if (collected.has(loc) || !satisfies(logic.perform[loc].map((w) => w.items), held)) continue;
                collected.add(loc);
                held[b] += 1;
                grew = true;
            }
        }
        const open = checks.filter((c) => !placed.has(c) && satisfies(logic.perform[c].map((w) => w.items), held));
        if (!open.length) {
            throw new ActionCompileError(ACTION_COMPILE_REFUSALS.FILL_FAILED,
                `no check in logic can hold '${model.boons[item].name}'`);
        }
        placed.set(open[Math.floor(rng.next() * open.length)], item);
    }
    const empty = rng.shuffle(checks.filter((c) => !placed.has(c)));
    rest.forEach((b, k) => placed.set(empty[k], b));
    return placed;
}

/** The node entry with names resolved — the `playable_payload` the runtime reads. */
function payloadOf(graph, model, id, { locationName, exits }) {
    const n = graph.nodes[id];
    const named = (amounts, table) => Object.fromEntries(Object.entries(amounts ?? {}).map(([k, v]) => [k, { name: table[k].name, amount: v }]));
    const payload = {
        node_id: id,
        name: n.name,
        kind: n.kind,
        time: n.time,
        limit: n.limit,
        requires: {
            stats: named(n.requires?.stats, graph.stats),
            resources: named(n.requires?.resources, graph.resources),
        },
        results: {
            stats: named(n.results?.stats, graph.stats),
            resources: named(n.results?.resources, graph.resources),
            mana: n.results?.mana ?? 0,
        },
        after: (n.after ?? []).map((set) => [...set]),
        exits,
    };
    if (locationName) payload.location = locationName;
    if (n.position) payload.position = { ...n.position };
    return payload;
}

/**
 * Compile a graph.
 * @param {object} graph - an `action-graph` document
 * @param {object} [opts]
 * @param {number} [opts.playerId=1]
 * @param {number} [opts.seed=1]
 * @param {number} [opts.budget] - the one-loop state budget
 * @param {string} [opts.graphPath] - where the graph lives, recorded in `procgen_metadata[p]`
 * @returns {{rules: object, report: object}}
 */
export function compileActionGraph(graph, { playerId = 1, seed = 1, budget = DEFAULT_STATE_BUDGET, graphPath = null } = {}) {
    const model = buildActionModel(graph);
    const logic = deriveActionLogic(model, { budget });
    const p = String(playerId);
    const settings = resolvedSettingsOf(graph);

    // A6 (1): every check and the goal is earnable under some items; every node is reachable under some items.
    model.nodes.forEach((node, i) => {
        if (i === model.startIndex) return;
        if ((node.kind === 'check' || node.kind === 'goal') && logic.perform[i].length === 0) {
            throw new ActionCompileError(ACTION_COMPILE_REFUSALS.CHECK_NEVER_EARNABLE,
                `'${node.name}' cannot be performed in any one loop with any items`);
        }
        if (logic.reach[i].length === 0) {
            throw new ActionCompileError(ACTION_COMPILE_REFUSALS.NODE_NEVER_REACHED,
                `'${node.name}' is not reached in any one loop with any items`);
        }
    });

    // Items: progression when any derived rule names them.
    const progression = new Set();
    for (const rows of [...logic.perform.map((ws) => ws.map((w) => w.items)), ...logic.reach]) {
        for (const c of rows) c.forEach((n, i) => { if (n > 0) progression.add(i); });
    }
    const pool = itemPoolOf(model, graph);
    const placement = assumedFill(model, logic, pool, progression, seed);

    const ns = namespaceNamed('action-nodes');
    const goalNode = model.nodes[model.goalIndex];
    const locationIds = allocateIdsBySortedName([...model.checkIndices.map((i) => model.nodes[i].name), goalNode.name], ns.locationBase);
    const itemIds = allocateIdsBySortedName([...model.boons.map((b) => b.name), GOAL_ITEM], ns.itemBase);

    const rules = makeRulesJsonScaffold({ ...ACTION_NODES_GAME, seed, playerName: 'Player1', startRegions: [MENU] });
    if (p !== '1') {
        for (const key of ['regions', 'start_regions', 'items', 'item_groups', 'itempool_counts', 'world', 'game_info',
            'canonical_placements', 'progression_mapping', 'starting_items']) {
            rules[key] = { [p]: rules[key]['1'] };
        }
        rules.player_names = { [p]: 'Player1' };
    }
    rules.world[p].world_directory = ACTION_NODES_GAME.gameDirectory;
    rules.game_info[p] = { completion_condition: { type: 'item_check', item: GOAL_ITEM } };
    // ⛓ The world LISTS its back-exits (the reverse exits below), so it states that none may be assumed. `true` would
    // let consumers construct a back-exit for every listed exit — `start -> Menu` included, which does not exist (the
    // Regions panel would show the Menu entrance as two-way and the pathfinder would route through it). Absent would
    // leave it to auto-detection. The reverse exits themselves are the mechanism, not this flag.
    rules.exporter = { [p]: { assume_bidirectional_exits: false } };

    const regions = { [MENU]: makeRegion(MENU, [makeExit(exitNameOf(MENU, graph.start), graph.start, makeTrueRule())], []) };
    const sidecars = {};
    const performRules = {};
    model.nodes.forEach((node, i) => {
        const id = node.id;
        const edges = nodeExitsOf(graph, id);
        const exitsOut = edges.map(({ to, reverse }) => makeExit(exitNameOf(id, to), to,
            reverse ? makeTrueRule() : ruleOf(model, logic.reach[model.nodeIx.get(to)])));
        const locations = [];
        let locationName = null;
        if (node.kind === 'check' || node.kind === 'goal') {
            locationName = node.name;
            const rule = ruleOf(model, logic.perform[i].map((w) => w.items));
            performRules[node.name] = rule;
            const loc = makeLocation(node.name, locationIds.get(node.name), rule);
            if (node.kind === 'goal') {
                loc.item = { name: GOAL_ITEM, player: Number(p), advancement: true, type: 'progression' };
                loc.locked = true;
            } else {
                const b = model.boons[placement.get(i)];
                const adv = progression.has(placement.get(i));
                loc.item = { name: b.name, player: Number(p), advancement: adv, type: adv ? 'progression' : 'useful' };
            }
            locations.push(loc);
        }
        regions[id] = makeRegion(id, exitsOut, locations);
        sidecars[id] = {
            substrate: ACTION_NODES_SUBSTRATE_ID,
            render_hint: ACTION_NODES_SUBSTRATE_ID,
            playable_payload: payloadOf(graph, model, id, {
                locationName,
                exits: exitsOut.map((e, k) => ({
                    exit_id: e.connected_region, exitName: e.name, targetRegion: e.connected_region,
                    ...(edges[k].reverse ? { reverse: true } : {}),
                })),
            }),
        };
    });
    rules.regions[p] = regions;

    // Items table and pool.
    const itemsTable = {};
    const poolCounts = {};
    for (const b of pool) poolCounts[model.boons[b].name] = (poolCounts[model.boons[b].name] ?? 0) + 1;
    model.boons.forEach((b, i) => {
        if (!poolCounts[b.name]) return;
        itemsTable[b.name] = {
            name: b.name, id: itemIds.get(b.name), groups: [],
            classification: progression.has(i) ? 'progression' : (b.id === graph.filler ? 'filler' : 'useful'),
            type: null, max_count: poolCounts[b.name],
        };
    });
    itemsTable[GOAL_ITEM] = { name: GOAL_ITEM, id: itemIds.get(GOAL_ITEM), groups: [], classification: 'progression', type: null, max_count: 1 };
    rules.items[p] = itemsTable;
    rules.itempool_counts[p] = { ...poolCounts, [GOAL_ITEM]: 1 };
    rules.preset_sidecars = { [p]: sidecars };

    // The per-world block the runtime reads (design §1, "Per world").
    rules.action_nodes = { [p]: actionNodesBlockOf(graph, model) };

    // The sphere log over the derived rules, and A6 (2): it must reach the goal.
    const sphereLog = generateSphereLog(rules, { playerId: Number(p), metadata: { seed, seed_name: rules.seed_name } });
    const reachedGoal = sphereLog.some((e) => e.player_data?.[p]?.sphere_locations?.includes(goalNode.name));
    if (!reachedGoal) {
        throw new ActionCompileError(ACTION_COMPILE_REFUSALS.GOAL_NOT_IN_LOGIC,
            `the sphere log over the derived rules never reaches '${goalNode.name}'`);
    }
    rules.sphere_log = sphereLog;

    const report = proofReportOf(graph, model, logic, sphereLog, { p, placement, progression, budget });
    rules.procgen_metadata = {
        [p]: {
            driver: ACTION_GRAPH_DRIVER,
            graph_id: graph.graph_id,
            ...(graphPath ? { graph_path: graphPath } : {}),
            region_count: Object.keys(regions).length,
            action_logic: report,
        },
    };
    rules.provenance = { [p]: { generator: 'frontend/modules/actionNodes/actionGraphCompiler.js', graph_id: graph.graph_id, graph_provenance: graph.provenance } };
    rules.loop_costs = { [p]: loopCostsOf(graph, model, settings) };
    // ⚖ Robert 2026-11-16T19:59:48Z (discovery): the world's own discovery policy, in and out of Loop mode — the
    // discovery module's `actionNodes` bundle (worldDiscoveryMode.js). Per world: no other world sees it.
    rules.discovery_mode = { [p]: { enabled: true, bundle: ACTION_NODES_DISCOVERY_BUNDLE } };
    return { rules, report };
}

/**
 * `action_nodes[p]`: what the runtime needs that the per-region payloads do not say.
 *
 * ⛓ `boosts` is keyed by Archipelago ITEM NAME and every row states its `mana` (the per-item starting-mana boost,
 * default `DEFAULT_MANA_PER_ITEM`). `mana_per_item_default` is that default, written so the runtime never needs a
 * second copy: an item with no row (none in a compiled world today) gets it. While an ActionNodes world is loaded
 * the runtime (slice 2) takes each received item's mana from this table INSTEAD OF the global flat
 * `gameState.manaPerItem` term, so with every row at the default the two agree exactly.
 */
export function actionNodesBlockOf(graph, model = buildActionModel(graph)) {
    const boosts = {};
    for (const b of model.boons) {
        const r = resolvedBoostOf(graph.boons[b.id]);
        boosts[b.name] = { boon_id: b.id, stats: r.stats, resources: r.resources, mana: r.mana };
    }
    return {
        schema_version: ACTION_NODES_BLOCK_VERSION,
        graph_id: graph.graph_id,
        name: graph.name,
        loop: { mana: graph.loop.mana },
        stats: Object.fromEntries(Object.entries(graph.stats).map(([k, v]) => [k, { name: v.name }])),
        resources: Object.fromEntries(Object.entries(graph.resources).map(([k, v]) => [k, { name: v.name }])),
        boosts,
        mana_per_item_default: DEFAULT_MANA_PER_ITEM,
        start: graph.start,
        goal: model.nodes[model.goalIndex].id,
        action: ACT_ACTION,
        settings: resolvedSettingsOf(graph),
    };
}

/** `loop_costs[p]`: the AUTHORED costs. Every node moves for 0 (A10) and acts for its `time`. */
function loopCostsOf(graph, model, settings) {
    const regions = { [MENU]: { moveCost: START_REGION_MOVE_COST, xpEffect: settings.xpEffect } };
    for (const node of model.nodes) {
        regions[node.id] = {
            moveCost: 0,
            xpEffect: settings.xpEffect,
            xpGainScale: settings.xpGainScale,
            actions: { [ACT_ACTION]: node.time },
        };
    }
    return {
        version: '1.0',
        generatedFrom: `action-graph:${graph.graph_id}`,
        regions,
        locations: {},
        defaultRegionCost: 0,
        defaultLocationCost: DEFAULT_LOCATION_COST,
        defaultRegionXpEffect: settings.xpEffect,
    };
}

/** The logic and A6 report recorded in `procgen_metadata[p].action_logic`. */
function proofReportOf(graph, model, logic, sphereLog, { p, placement, progression, budget }) {
    const ruleText = (combos) => (combos.some((c) => c.every((n) => n === 0)) ? 'True'
        : combos.map((c) => Object.entries(combinationByName(model, c)).map(([k, n]) => (n > 1 ? `Has(${k}, ${n})` : `Has(${k})`)).join(' & ')).join(' | '));
    const targets = {};
    model.nodes.forEach((node, i) => {
        if (node.kind !== 'check' && node.kind !== 'goal') return;
        targets[node.name] = {
            node: node.id,
            kind: node.kind,
            rule: ruleText(logic.perform[i].map((w) => w.items)),
            witnesses: logic.perform[i].map((w) => describeWitness(model, w)),
        };
    });
    const exits = {};
    for (const id of model.nodeIds) {
        for (const from of predecessorsOf(graph, id)) exits[exitNameOf(from, id)] = ruleText(logic.reach[model.nodeIx.get(id)]);
    }
    // Per sphere: which checks are open at once (A5's aim, reported, not enforced). Walked over the derived logic
    // itself, every location counted — the embedded sphere log lists only ADVANCEMENT pickups, so a check holding a
    // useful item would be missing from it.
    const spheres = [];
    {
        const held = model.boons.map(() => 0);
        const done = new Set();
        const targetsOf = [...model.checkIndices, model.goalIndex];
        for (;;) {
            const open = targetsOf.filter((i) => !done.has(i) && satisfies(logic.perform[i].map((w) => w.items), held));
            if (!open.length) break;
            spheres.push({ sphere: spheres.length, open_at_once: open.length, checks: open.map((i) => model.nodes[i].name) });
            for (const i of open) {
                done.add(i);
                if (placement.has(i)) held[placement.get(i)] += 1;
            }
        }
    }
    const advancementPicks = sphereLog.filter((e) => e.type === 'state_update')
        .flatMap((e) => e.player_data?.[p]?.sphere_locations ?? []);
    return {
        search: {
            item_combinations: logic.combinations,
            max_states_per_combination: logic.maxStatesPerCombination,
            state_budget: budget,
        },
        targets,
        exits,
        placements: Object.fromEntries([...placement].map(([c, b]) => [model.nodes[c].name, model.boons[b].name])),
        progression_items: [...progression].map((i) => model.boons[i].name).sort(),
        a6: {
            every_check_earnable: true,
            sphere_log_reaches_goal: true,
            sphere_log_advancement_picks: advancementPicks,
            spheres,
            statement: 'A check is in logic exactly when a one-loop plan earns it with the items held; the fill places an '
                + 'unchecked in-logic check whenever the game is not waiting on another world, so every loop not waiting '
                + 'can earn one.',
        },
    };
}

/**
 * The fill of a compiled world, read back from its locations: check node id → boon id. What the headless bot plays
 * against, so it plays the document's own placements and never a second fill.
 */
export function placementsFromRules(rules, model, playerId = '1') {
    const p = String(playerId);
    const boonByName = new Map(model.boons.map((b) => [b.name, b.id]));
    const out = {};
    for (const id of model.nodeIds) {
        for (const loc of rules.regions?.[p]?.[id]?.locations ?? []) {
            const item = typeof loc.item === 'string' ? loc.item : loc.item?.name;
            if (boonByName.has(item)) out[id] = boonByName.get(item);
        }
    }
    return out;
}
