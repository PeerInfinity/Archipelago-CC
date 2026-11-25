/**
 * Substrate registry entry for **ActionNodes** (`action_nodes`) — the data half (slice AN-1) and the runtime half
 * (slice AN-2: `loopSupport`, `sharing`).
 *
 * One region is one node, one node is one task: a time cost in mana, stat and resource minimums, results, a limit
 * per loop (design `action-nodes.md`). A world is compiled from a graph document by `actionGraphCompiler.js`, not
 * grown by a layout driver, so this entry declares no build-time hooks.
 *
 * ⛓ WHAT THIS ENTRY DECLARES (AN-2, AN-3a), each backed by `actionNodesRuntime.js`:
 *   - `loopBot.planLoop(context)` (AN-3a): the whole loop's plan for the Playback Bot's loop runner, when every region
 *     of the loaded world is an ActionNodes node (`actionLoopBot.js`; the runner's seam,
 *     `playbackBot/substrateLoopPlanner.js`).
 *   - `loopSupport`: the queue verbs `regionMove`, `act` and (AN-TIME-2) `wait`, ENFORCED (`strictQueueActions`, AN-1b: no explore);
 *     `actionGate`, the start gate Loops asks before an entry
 *     starts; `authoredCosts`, so a cost pass (the pipeline's, the Loops panel's Generate Costs) copies the
 *     compiler's `loop_costs` entries instead of re-pricing them. NOT `manual`: a Manual block parks the queue for
 *     live play, and in Loop mode this substrate's panel QUEUES an `act` (every performance is a queue entry), so a
 *     park would wait for nothing. NOT `record` / `playback`: the strict action gate's pair; the start gate does
 *     that job. NOT `executeVia` / `botActsAtOnce`: they need the playback controller (slice 3).
 *     AN-TIME-2: `pool()`, the loaded world's name and unit for the pool (`{name, unit}`: its `pool`, else "Mana"),
 *     which the Loops and Resources panels show in place of "Mana" (`resourceChannels/poolName.js`), and `clockLine(mana)`, the Resources panel's Time line (null with no
 *     `clock`). On `loopSupport`, not `sharing.mana`: the registry validates `sharing.mana`'s fields (shared/).
 *   - `sharing`: `mana` (outside Loop mode the runtime charges the shared pool itself), `items` (its resources, so a
 *     cross-substrate grant lands in the ledger), `stats` and `resources` (the host ledger keeps them), each list read
 *     from the loaded world.
 *
 * ⛓ WHAT IT DOES NOT DECLARE YET:
 *   - `getPlaybackController`: not needed by the live bot (it plays through the Loops queue).
 *   - The click: AN-3b, a registered click action (after the click-actions series), not a `regionClick` hook.
 *   - `compositeMap.layoutGraph`: with the Region Map panel's click step (the panel is not on main).
 *   - `rulesJsonBlocks`: the `action_nodes[p]` block is graph-dependent and written by the compiler, which is the
 *     only producer; no pipeline driver realises an ActionNodes region.
 * The panel named by `panelComponentType` is `actionNodesPanel.js`.
 *
 * Node-importable: no DOM, no panel import (the runtime is pure).
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { envelopeExitNames, REQUIRED_ENVELOPE_FIELD } from '../procgenCore/sidecarFields.js';
import { ACTION_NODE_KINDS, knowledgeLocationNameOf } from './actionGraph.js';
import { ACTION_NODES_SUBSTRATE_ID, ACT_ACTION } from './actionGraphCompiler.js';
import { getActionNodesRuntime } from './actionNodesRuntime.js';
import { planLiveLoop } from './actionLoopBot.js';
import { WAIT_ACTION } from '../shared/procgen/loopCustomActions.js';

/** `{<knowledge id>: {name}}` (AN-TIME-1): a node's required or learned knowledge flags, names resolved. */
const NAMED_FLAGS = Object.freeze({
    type: 'object',
    additionalProperties: Object.freeze({
        type: 'object',
        required: Object.freeze(['name']),
        properties: Object.freeze({ name: Object.freeze({ type: 'string' }) }),
    }),
});

const NAMED_AMOUNTS = Object.freeze({
    type: 'object',
    additionalProperties: Object.freeze({
        type: 'object',
        required: Object.freeze(['name', 'amount']),
        properties: Object.freeze({ name: Object.freeze({ type: 'string' }), amount: Object.freeze({ type: 'integer' }) }),
    }),
});

/**
 * One descriptor per `playable_payload` key `compileActionGraph` writes (`payloadOf`). Every field is derived: the
 * payload is the graph's node entry with its names resolved, and an edit belongs in the graph.
 */
export const ACTION_NODES_SIDECAR_FIELDS = Object.freeze({
    node_id: Object.freeze({
        type: 'string', required: true, derived: true,
        description: 'The node\'s id in its graph, which is also the region name. Written by `compileActionGraph`.',
    }),
    name: Object.freeze({
        type: 'string', required: true, derived: true,
        description: 'The node\'s display name ("Do Chores"); the queue row and the node card show it. Written by `compileActionGraph`.',
    }),
    kind: Object.freeze({
        type: 'string', required: true, derived: true, enum: ACTION_NODE_KINDS,
        description: 'start | action | check | use | goal (design §1). Written by `compileActionGraph`.',
    }),
    time: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: 'Mana per performance, before any region-XP discount; also `loop_costs[p].regions[<node>].actions.act`. Written by `compileActionGraph`.',
    }),
    limit: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: 'Performances per loop (A16: results after each; exits open after the last). Written by `compileActionGraph`.',
    }),
    requires: Object.freeze({
        type: 'object', required: true, derived: true,
        description: 'Minimums checked before each performance: `{stats, resources}`, each `{<id>: {name, amount}}`, and (AN-TIME-1, only when the node has it) `knowledge`, the flags that must be known, `{<id>: {name}}`. Written by `compileActionGraph`.',
        schema: Object.freeze({
            required: Object.freeze(['stats', 'resources']),
            properties: Object.freeze({ stats: NAMED_AMOUNTS, resources: NAMED_AMOUNTS, knowledge: NAMED_FLAGS }),
        }),
    }),
    results: Object.freeze({
        type: 'object', required: true, derived: true,
        description: 'Added after each performance: `{stats, resources, mana}` (resources may be negative), and (AN-TIME-1, only when the node has it) `learns`, the knowledge flags it teaches, `{<id>: {name}}`, kept across loops. Written by `compileActionGraph`.',
        schema: Object.freeze({
            required: Object.freeze(['stats', 'resources', 'mana']),
            properties: Object.freeze({
                stats: NAMED_AMOUNTS, resources: NAMED_AMOUNTS, mana: Object.freeze({ type: 'integer' }), learns: NAMED_FLAGS,
            }),
        }),
    }),
    after: Object.freeze({
        type: 'array', required: true, derived: true,
        description: 'The node is reached when every node of one inner set is cleared this loop; empty for the start. Written by `compileActionGraph`.',
        schema: Object.freeze({ items: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }) }),
    }),
    window: Object.freeze({
        type: 'object', derived: true,
        description: 'AN-TIME-1: when a performance may START, `{from?, until?}` in units of time spent this loop; started before `from` it first waits until `from` (the wait paid from the pool); after `until`, too late. Absent on a node with no window. Written by `compileActionGraph`.',
        schema: Object.freeze({
            properties: Object.freeze({ from: Object.freeze({ type: 'integer' }), until: Object.freeze({ type: 'integer' }) }),
        }),
    }),
    location: Object.freeze({
        type: 'string', derived: true,
        description: 'The AP location the node carries: a check node\'s or the goal\'s own name. Absent on a node with none. Written by `compileActionGraph`.',
    }),
    position: Object.freeze({
        type: 'object', derived: true,
        description: 'The graph\'s optional `{x, y}` layout hint, copied by `compileActionGraph`.',
        schema: Object.freeze({
            required: Object.freeze(['x', 'y']),
            properties: Object.freeze({ x: Object.freeze({ type: 'number' }), y: Object.freeze({ type: 'number' }) }),
        }),
    }),
    exits: REQUIRED_ENVELOPE_FIELD,
});

/**
 * The payload's location names: the AP location it carries (or none), then (AN-TIME-1) one EVENT location per
 * knowledge flag it teaches, named as the compiler names them (`knowledgeLocationNameOf`).
 */
export function actionNodesApLocationNames(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const own = typeof payload.location === 'string' && payload.location ? [payload.location] : [];
    const learns = payload.results?.learns && typeof payload.results.learns === 'object' ? Object.values(payload.results.learns) : [];
    return [...own, ...learns.map((f) => knowledgeLocationNameOf(payload.name, f.name))];
}

/** The warehouse's world for one node: the payload, with `exits` as a Map keyed by exit name. */
export function deserializeActionNode(payload) {
    if (!payload || typeof payload !== 'object' || typeof payload.node_id !== 'string') {
        throw new Error('action_nodes: a playable_payload needs a node_id');
    }
    const exits = new Map((payload.exits ?? []).map((e) => [e.exitName ?? e.exit_id, { ...e }]));
    const world = { ...payload, exits };
    if (payload.manaEnabled === true) world.manaEnabled = true;
    return world;
}

/** The inverse of `deserializeActionNode`. */
export function serializeActionNode(world) {
    const { exits, ...rest } = world;
    return { ...rest, exits: exits instanceof Map ? [...exits.values()].map((e) => ({ ...e })) : (exits ?? []) };
}

export const substrateRegistryEntry = Object.freeze({
    id: ACTION_NODES_SUBSTRATE_ID,
    label: 'Action Nodes',
    panelComponentType: 'actionNodesPanel',
    loadRegionEvent: 'actionNodes:loadRegion',
    // Not built by any driver, so it realises no shared-library feature.
    supportedFeatures: Object.freeze([]),
    deserializeWorld: deserializeActionNode,
    serializeWorld: serializeActionNode,
    sidecarFields: ACTION_NODES_SIDECAR_FIELDS,
    apLocationNamesOf: actionNodesApLocationNames,
    apExitNamesOf: envelopeExitNames,
    // A node has no tiles: an exit is only an `after` edge.
    regionGeometry: REGION_GEOMETRY.SIDES,
    exitSides: SIDE_AGNOSTIC_EXIT_SIDES,
    // ⛓ The content-pack fill rules this substrate applies (procgenCore/fillRules.js `fillRulesOf`): every rule its
    // resolver can reach — R4 for a sum minimum a binding states, AN-flat for every v1-excluded form (PL-2's list,
    // moved onto the entry in AN-1b).
    fillRules: Object.freeze(['P1', 'T1', 'L1', 'L2', 'W1', 'B1', 'R4', 'AN1', 'AN2', 'AN-flat']),
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', ACT_ACTION, WAIT_ACTION]),
        // ⚖ D6 (Robert 2026-11-16T19:59:48Z): no explore action in ActionNodes. The list above is ENFORCED: a custom
        // action it does not hold is refused at queue time and by the start gate (`loops/strictQueueActions.js`).
        strictQueueActions: true,
        manual: false,
        authoredCosts: true,
        actionGate: (action) => getActionNodesRuntime().gate(action),
        pool: () => {
            const rt = getActionNodesRuntime();
            return rt.isLoaded() ? { name: rt.poolName(), unit: rt.poolUnit() } : null;
        },
        clockLine: (mana) => getActionNodesRuntime().clockLine(mana),
    }),
    // ⛓ The live bot (design §7, AN-3a). `context`: {startRegion, maxMana, inventory, checkedLocations, regionXp}.
    loopBot: Object.freeze({
        planLoop: (context = {}) => {
            const rt = getActionNodesRuntime();
            if (!rt.isLoaded()) return { kind: 'unreachable', reason: 'no ActionNodes world is loaded', path: [], lines: [] };
            // AN-3b: a continuation (`context.continueFrom`) plans the rest of the running loop from the runtime's
            // live counts, stats and resources.
            const continueFrom = context.continueFrom ? { ...context.continueFrom, state: rt.liveState() } : null;
            return planLiveLoop({ ...context, model: rt.model, continueFrom, known: rt.knownIds(), unit: rt.poolUnit() });
        },
    }),
    sharing: Object.freeze({
        mana: Object.freeze({}),
        items: Object.freeze({ getTypes: () => getActionNodesRuntime().resourceIds() }),
        stats: Object.freeze({ getTypes: () => getActionNodesRuntime().statIds() }),
        resources: Object.freeze({ getTypes: () => getActionNodesRuntime().resourceIds() }),
    }),
});

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
