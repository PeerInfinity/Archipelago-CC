/**
 * Substrate registry entry for **ActionNodes** (`action_nodes`) — the DATA HALF (slice AN-1).
 *
 * One region is one node, one node is one task: a time cost in mana, stat and resource minimums, results, a limit
 * per loop (design `action-nodes.md`). A world is compiled from a graph document by `actionGraphCompiler.js`, not
 * grown by a layout driver, so this entry declares no build-time hooks.
 *
 * ⛓ WHAT THIS ENTRY DOES NOT DECLARE YET, AND WHY. A declaration is a capability claim that the capability matrix and
 * the Loops panel read. This slice has no runtime, so it declares nothing that needs one:
 *   - `loopSupport` (the `act` verb, its start gate `actionGate`) and `sharing` (mana, plus the two new `stats` and
 *     `resources` categories, which the registry's validator in the `shared` submodule does not know yet): slice 2,
 *     with the runtime, the Loops verb and the ledger.
 *   - `getPlaybackController`, `regionClick`, `loopBot.planLoop`: slice 3, with click-to-play and the live bot.
 *   - `compositeMap.layoutGraph`: with the Region Map panel's click step (the panel is not on main).
 *   - `rulesJsonBlocks`: the `action_nodes[p]` block is graph-dependent and written by the compiler, which is the
 *     only producer; no pipeline driver realises an ActionNodes region.
 * The panel named by `panelComponentType` is slice 2's.
 *
 * Node-importable: no DOM, no panel import.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { envelopeExitNames, REQUIRED_ENVELOPE_FIELD } from '../procgenCore/sidecarFields.js';
import { ACTION_NODE_KINDS } from './actionGraph.js';
import { ACTION_NODES_SUBSTRATE_ID } from './actionGraphCompiler.js';

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
        description: 'Minimums checked before each performance: `{stats, resources}`, each `{<id>: {name, amount}}`. Written by `compileActionGraph`.',
        schema: Object.freeze({
            required: Object.freeze(['stats', 'resources']),
            properties: Object.freeze({ stats: NAMED_AMOUNTS, resources: NAMED_AMOUNTS }),
        }),
    }),
    results: Object.freeze({
        type: 'object', required: true, derived: true,
        description: 'Added after each performance: `{stats, resources, mana}` (resources may be negative). Written by `compileActionGraph`.',
        schema: Object.freeze({
            required: Object.freeze(['stats', 'resources', 'mana']),
            properties: Object.freeze({ stats: NAMED_AMOUNTS, resources: NAMED_AMOUNTS, mana: Object.freeze({ type: 'integer' }) }),
        }),
    }),
    after: Object.freeze({
        type: 'array', required: true, derived: true,
        description: 'The node is reached when every node of one inner set is cleared this loop; empty for the start. Written by `compileActionGraph`.',
        schema: Object.freeze({ items: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }) }),
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

/** The payload's AP location names: the one it carries, or none. */
export function actionNodesApLocationNames(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return typeof payload.location === 'string' && payload.location ? [payload.location] : [];
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
});

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
