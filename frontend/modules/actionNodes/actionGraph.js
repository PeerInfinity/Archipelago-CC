/**
 * actionNodes/actionGraph — **THE GRAPH DOCUMENT** of the ActionNodes substrate (kind `action-graph`) and its
 * validator. Every refusal has a NAME (`ACTION_GRAPH_REFUSALS`); a test asserts the name, never the wording.
 *
 * A graph is the RESOLVED document: one file with every number and word inline. The field names follow the shared
 * task shape (`requires`, `results`, `limit`, `after`), so a later pack resolver can produce exactly this document
 * and nothing downstream changes. See `docs/json/developer/procgen/action-nodes.md` § The graph document.
 *
 * ⛓ MONOTONICITY IS ENFORCED BY SHAPE. The logic (`actionSearch.js`) keeps only the MINIMAL item combinations that
 * earn a target, which is correct only when holding more items can never make a plan impossible. That holds because:
 * no boon gives a negative amount, no stat result is negative, and every requirement is a minimum. A graph that
 * breaks any of these is refused here by name, so the search never has to check (`gotchas.md` § A minimal-set
 * search over an item lattice assumes monotonicity).
 *
 * ⛓ THE PER-ITEM STARTING-MANA BOOST (⚖ user, 2026-11-15: "I want to make the mana boost provided by each item
 * configurable. I still want the default to be 10."). A boon's `gives.mana` is the mana that item adds to every
 * loop's starting pool. When a boon does not state it, it is `DEFAULT_MANA_PER_ITEM` (10, the same constant the
 * global "every received item adds mana" setting uses), so a boon that says nothing behaves as every item does today.
 * `resolvedBoostOf` is the one place that default is applied.
 *
 * Pure: no registry, no DOM, no I/O.
 */

import { DEFAULT_MANA_PER_ITEM } from '../shared/procgen/loopCostDefaults.js';
import { REGION_XP_EFFECTS } from '../shared/procgen/xpFormulas.js';
import { SOURCE_FIELDS, parseProvenance } from '../contentPacks/provenance.js';

/** The document kind every graph states. */
export const ACTION_GRAPH_KIND = 'action-graph';
/** The one schema version this code reads. */
export const ACTION_GRAPH_SCHEMA_VERSION = 1;

/** The node kinds (design §1). `start` is the one node every loop begins at. */
export const ACTION_NODE_KINDS = Object.freeze(['start', 'action', 'check', 'use', 'goal']);

/**
 * The provenance source types (content-sets Z.7) and the fields each may carry. ⛓ CONTENT SETS PL-2: ONE validator —
 * this is `contentPacks/provenance.js`'s table, re-exported, so a graph and a pack layer are checked by the same code.
 */
export const PROVENANCE_SOURCE_FIELDS = SOURCE_FIELDS;

/** Every way a graph is refused, by name. */
export const ACTION_GRAPH_REFUSALS = Object.freeze({
    NOT_A_GRAPH: 'not-a-graph',
    WRONG_KIND: 'wrong-kind',
    UNSUPPORTED_VERSION: 'unsupported-schema-version',
    UNKNOWN_FIELD: 'unknown-field',
    BAD_FIELD: 'bad-field',
    BAD_LOOP: 'bad-loop',
    UNKNOWN_STAT: 'unknown-stat',
    UNKNOWN_RESOURCE: 'unknown-resource',
    UNKNOWN_NODE: 'unknown-node',
    NEGATIVE_BOOST: 'negative-boost',
    NEGATIVE_STAT_RESULT: 'negative-stat-result',
    BAD_AMOUNT: 'bad-amount',
    BAD_LIMIT: 'bad-limit',
    BAD_TIME: 'bad-time',
    BAD_KIND: 'bad-kind',
    START_NOT_ONE: 'start-not-one',
    START_HAS_PARTS: 'start-has-parts',
    NODE_WITHOUT_AFTER: 'node-without-after',
    NODE_UNREACHABLE: 'node-unreachable',
    GOAL_NOT_ONE: 'goal-not-one',
    DUPLICATE_NAME: 'duplicate-name',
    ITEM_POOL_SHORT: 'item-pool-short',
    ITEM_POOL_OVERFLOW: 'item-pool-overflow',
    BAD_FILLER: 'bad-filler',
    // Forms the first version leaves out (design §1), refused by name so a graph that needs one says so.
    ALTERNATIVE_REQUIREMENTS: 'unsupported-alternative-requirements',
    RESULT_TIMING: 'unsupported-result-timing',
    GROWING_LIMIT: 'unsupported-growing-limit',
    MODIFIES: 'unsupported-modifies',
    MAXIMUM_REQUIREMENT: 'unsupported-maximum-requirement',
    // Provenance (Z.7): presence and form.
    NO_PROVENANCE: 'no-provenance',
    BAD_PROVENANCE: 'bad-provenance',
    UNLISTED_SOURCE: 'unlisted-source',
});

/** Thrown by `assertActionGraph`; `.code` is the first refusal's name, `.errors` all of them. */
export class ActionGraphError extends Error {
    constructor(errors) {
        super(`action graph refused: ${errors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('; ')}`);
        this.name = 'ActionGraphError';
        this.code = errors[0]?.code ?? null;
        this.errors = errors;
    }
}

const TOP_FIELDS = Object.freeze(['kind', 'schema_version', 'graph_id', 'name', 'loop', 'stats', 'resources',
    'boons', 'filler', 'start', 'settings', 'nodes', 'provenance']);
const NODE_FIELDS = Object.freeze(['name', 'kind', 'time', 'requires', 'results', 'limit', 'after', 'position',
    'src']);
const BOON_FIELDS = Object.freeze(['name', 'count', 'gives', 'src']);
const AMOUNT_GROUPS = Object.freeze(['stats', 'resources']);
const RESULT_FIELDS = Object.freeze(['stats', 'resources', 'mana']);
const GIVES_FIELDS = Object.freeze(['stats', 'resources', 'mana']);
const SETTINGS_FIELDS = Object.freeze(['xpGainScale', 'xpEffect']);

/** The graph-wide settings a graph may leave out, and their values (design §8). */
export const DEFAULT_GRAPH_SETTINGS = Object.freeze({ xpGainScale: 1, xpEffect: 'cost' });

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const isPosInt = (v) => Number.isInteger(v) && v >= 1;

/**
 * A boon's boost as the logic and the runtime read it: every amount present, mana defaulted.
 * @returns {{stats: Object<string, number>, resources: Object<string, number>, mana: number}}
 */
export function resolvedBoostOf(boon) {
    const gives = boon?.gives ?? {};
    return {
        stats: { ...(gives.stats ?? {}) },
        resources: { ...(gives.resources ?? {}) },
        mana: gives.mana ?? DEFAULT_MANA_PER_ITEM,
    };
}

/** The graph's settings with defaults applied. */
export function resolvedSettingsOf(graph) {
    return { ...DEFAULT_GRAPH_SETTINGS, ...(graph?.settings ?? {}) };
}

/**
 * Validate a graph document.
 * @returns {{ok: boolean, errors: Array<{code: string, path: string, message: string}>}}
 */
export function validateActionGraph(graph) {
    const errors = [];
    const err = (code, path, message) => errors.push({ code, path, message });
    const R = ACTION_GRAPH_REFUSALS;

    if (!isPlainObject(graph)) {
        err(R.NOT_A_GRAPH, '', 'the document is not a JSON object');
        return { ok: false, errors };
    }
    if (graph.kind !== ACTION_GRAPH_KIND) err(R.WRONG_KIND, 'kind', `expected '${ACTION_GRAPH_KIND}', got ${JSON.stringify(graph.kind)}`);
    if (graph.schema_version !== ACTION_GRAPH_SCHEMA_VERSION) {
        err(R.UNSUPPORTED_VERSION, 'schema_version', `this code reads version ${ACTION_GRAPH_SCHEMA_VERSION}`);
    }
    for (const key of Object.keys(graph)) if (!TOP_FIELDS.includes(key)) err(R.UNKNOWN_FIELD, key, 'not a graph field');
    for (const key of ['graph_id', 'name', 'start']) {
        if (typeof graph[key] !== 'string' || !graph[key]) err(R.BAD_FIELD, key, 'must be a non-empty string');
    }
    if (!isPlainObject(graph.loop) || !isPosInt(graph.loop.mana) || Object.keys(graph.loop).some((k) => k !== 'mana')) {
        err(R.BAD_LOOP, 'loop', '`loop` must be {mana: <a whole number of at least 1>}');
    }
    const stats = isPlainObject(graph.stats) ? graph.stats : {};
    const resources = isPlainObject(graph.resources) ? graph.resources : {};
    for (const [group, table] of [['stats', graph.stats], ['resources', graph.resources]]) {
        if (!isPlainObject(table)) { err(R.BAD_FIELD, group, 'must be an object'); continue; }
        for (const [id, def] of Object.entries(table)) {
            if (!isPlainObject(def) || typeof def.name !== 'string' || !def.name) err(R.BAD_FIELD, `${group}.${id}`, 'needs a name');
        }
    }
    const settings = graph.settings ?? {};
    if (!isPlainObject(settings)) err(R.BAD_FIELD, 'settings', 'must be an object');
    else {
        for (const key of Object.keys(settings)) if (!SETTINGS_FIELDS.includes(key)) err(R.UNKNOWN_FIELD, `settings.${key}`, 'not a setting');
        if (settings.xpGainScale !== undefined && !(typeof settings.xpGainScale === 'number' && settings.xpGainScale >= 0)) {
            err(R.BAD_FIELD, 'settings.xpGainScale', 'must be a number ≥ 0');
        }
        if (settings.xpEffect !== undefined && !REGION_XP_EFFECTS.includes(settings.xpEffect)) {
            err(R.BAD_FIELD, 'settings.xpEffect', `must be one of ${REGION_XP_EFFECTS.join(', ')}`);
        }
    }

    // Amount maps: `{<id>: <integer>}` over a declared stat or resource table.
    const checkAmounts = (path, value, { sign, group }) => {
        if (value === undefined) return;
        if (!isPlainObject(value)) { err(R.BAD_FIELD, path, 'must be an object of amounts'); return; }
        const table = group === 'stats' ? stats : resources;
        for (const [id, n] of Object.entries(value)) {
            if (!Object.hasOwn(table, id)) {
                err(group === 'stats' ? R.UNKNOWN_STAT : R.UNKNOWN_RESOURCE, `${path}.${id}`, `no ${group.slice(0, -1)} '${id}'`);
            }
            if (!Number.isInteger(n)) err(R.BAD_AMOUNT, `${path}.${id}`, 'amounts are whole numbers');
            else if (sign === 'boost' && n < 0) err(R.NEGATIVE_BOOST, `${path}.${id}`, 'a boon never takes away');
            else if (sign === 'stat-result' && n < 0) err(R.NEGATIVE_STAT_RESULT, `${path}.${id}`, 'stats only go up');
            else if (sign === 'minimum' && n < 1) err(R.BAD_AMOUNT, `${path}.${id}`, 'a minimum is at least 1');
            else if (sign === 'nonzero' && n === 0) err(R.BAD_AMOUNT, `${path}.${id}`, 'a result of 0 says nothing');
        }
    };

    // Boons.
    const boons = isPlainObject(graph.boons) ? graph.boons : {};
    if (!isPlainObject(graph.boons)) err(R.BAD_FIELD, 'boons', 'must be an object');
    const names = new Map();
    const claimName = (name, path) => {
        if (names.has(name)) err(R.DUPLICATE_NAME, path, `'${name}' is also ${names.get(name)}`);
        else names.set(name, path);
    };
    let poolSize = 0;
    for (const [id, boon] of Object.entries(boons)) {
        const path = `boons.${id}`;
        if (!isPlainObject(boon)) { err(R.BAD_FIELD, path, 'must be an object'); continue; }
        for (const key of Object.keys(boon)) if (!BOON_FIELDS.includes(key)) err(R.UNKNOWN_FIELD, `${path}.${key}`, 'not a boon field');
        if (typeof boon.name !== 'string' || !boon.name) err(R.BAD_FIELD, `${path}.name`, 'needs a name');
        else claimName(boon.name, path);
        if (!isPosInt(boon.count)) err(R.BAD_FIELD, `${path}.count`, 'a whole number of at least 1');
        else poolSize += boon.count;
        const gives = boon.gives ?? {};
        if (!isPlainObject(gives)) { err(R.BAD_FIELD, `${path}.gives`, 'must be an object'); continue; }
        for (const key of Object.keys(gives)) if (!GIVES_FIELDS.includes(key)) err(R.UNKNOWN_FIELD, `${path}.gives.${key}`, 'not a boost part');
        checkAmounts(`${path}.gives.stats`, gives.stats, { sign: 'boost', group: 'stats' });
        checkAmounts(`${path}.gives.resources`, gives.resources, { sign: 'boost', group: 'resources' });
        if (gives.mana !== undefined) {
            if (!Number.isInteger(gives.mana)) err(R.BAD_AMOUNT, `${path}.gives.mana`, 'a whole number');
            else if (gives.mana < 0) err(R.NEGATIVE_BOOST, `${path}.gives.mana`, 'a boon never takes away');
        }
        if ('modifies' in gives) err(R.MODIFIES, `${path}.gives.modifies`, 'effects on other nodes are not in version 1');
    }
    if (graph.filler !== undefined && !Object.hasOwn(boons, graph.filler)) {
        err(R.BAD_FILLER, 'filler', `'${graph.filler}' is not a boon`);
    }

    // Nodes.
    const nodes = isPlainObject(graph.nodes) ? graph.nodes : {};
    if (!isPlainObject(graph.nodes) || Object.keys(nodes).length === 0) err(R.BAD_FIELD, 'nodes', 'needs at least one node');
    let starts = 0;
    let goals = 0;
    let checks = 0;
    for (const [id, node] of Object.entries(nodes)) {
        const path = `nodes.${id}`;
        if (!isPlainObject(node)) { err(R.BAD_FIELD, path, 'must be an object'); continue; }
        for (const key of Object.keys(node)) {
            if (key === 'when') err(R.RESULT_TIMING, `${path}.when`, 'results apply after every performance in version 1');
            else if (key === 'modifies') err(R.MODIFIES, `${path}.modifies`, 'effects on other nodes are not in version 1');
            else if (!NODE_FIELDS.includes(key)) err(R.UNKNOWN_FIELD, `${path}.${key}`, 'not a node field');
        }
        if (typeof node.name !== 'string' || !node.name) err(R.BAD_FIELD, `${path}.name`, 'needs a name');
        else claimName(node.name, path);
        if (!ACTION_NODE_KINDS.includes(node.kind)) err(R.BAD_KIND, `${path}.kind`, `one of ${ACTION_NODE_KINDS.join(', ')}`);
        if (node.kind === 'start') starts += 1;
        if (node.kind === 'goal') goals += 1;
        if (node.kind === 'check') checks += 1;
        if (!isNonNegInt(node.time)) err(R.BAD_TIME, `${path}.time`, 'mana per performance: a whole number ≥ 0');
        if (isPlainObject(node.limit)) err(R.GROWING_LIMIT, `${path}.limit`, 'a limit is one number per loop in version 1');
        else if (!isPosInt(node.limit)) err(R.BAD_LIMIT, `${path}.limit`, 'every node has a limit: a whole number ≥ 1 (A12)');

        // Requirements: minimums only, one set.
        if (Array.isArray(node.requires)) {
            err(R.ALTERNATIVE_REQUIREMENTS, `${path}.requires`, 'one requirement set in version 1');
        } else if (node.requires !== undefined) {
            if (!isPlainObject(node.requires)) err(R.BAD_FIELD, `${path}.requires`, 'must be an object');
            else {
                for (const key of Object.keys(node.requires)) {
                    if (key === 'max' || key === 'maximums') err(R.MAXIMUM_REQUIREMENT, `${path}.requires.${key}`, 'requirements are minimums');
                    else if (!AMOUNT_GROUPS.includes(key)) err(R.UNKNOWN_FIELD, `${path}.requires.${key}`, 'stats or resources');
                }
                checkAmounts(`${path}.requires.stats`, node.requires.stats, { sign: 'minimum', group: 'stats' });
                checkAmounts(`${path}.requires.resources`, node.requires.resources, { sign: 'minimum', group: 'resources' });
            }
        }
        // Results.
        if (node.results !== undefined) {
            if (!isPlainObject(node.results)) err(R.BAD_FIELD, `${path}.results`, 'must be an object');
            else {
                for (const key of Object.keys(node.results)) {
                    if (key === 'when') err(R.RESULT_TIMING, `${path}.results.when`, 'results apply after every performance in version 1');
                    else if (!RESULT_FIELDS.includes(key)) err(R.UNKNOWN_FIELD, `${path}.results.${key}`, 'stats, resources or mana');
                }
                checkAmounts(`${path}.results.stats`, node.results.stats, { sign: 'stat-result', group: 'stats' });
                checkAmounts(`${path}.results.resources`, node.results.resources, { sign: 'nonzero', group: 'resources' });
                if (node.results.mana !== undefined && !(Number.isInteger(node.results.mana) && node.results.mana >= 1)) {
                    err(R.BAD_AMOUNT, `${path}.results.mana`, 'mana awarded: a whole number ≥ 1');
                }
            }
        }
        // `after`: a list of sets of node ids; the start node has none, every other node has one.
        if (node.kind === 'start') {
            const parts = ['requires', 'results', 'after'].filter((k) => node[k] !== undefined);
            if (parts.length || node.time !== 0) {
                err(R.START_HAS_PARTS, path, 'the start node costs nothing and has no requirements, results or `after`');
            }
        } else if (!Array.isArray(node.after) || node.after.length === 0) {
            err(R.NODE_WITHOUT_AFTER, `${path}.after`, 'every node but the start says which nodes open it');
        } else {
            node.after.forEach((set, i) => {
                if (!Array.isArray(set) || set.length === 0) {
                    err(R.BAD_FIELD, `${path}.after[${i}]`, 'a non-empty list of node ids');
                    return;
                }
                for (const ref of set) {
                    if (!Object.hasOwn(nodes, ref)) err(R.UNKNOWN_NODE, `${path}.after[${i}]`, `no node '${ref}'`);
                    else if (ref === id) err(R.UNKNOWN_NODE, `${path}.after[${i}]`, 'a node cannot open itself');
                }
            });
        }
        if (node.position !== undefined && !(isPlainObject(node.position)
            && Number.isFinite(node.position.x) && Number.isFinite(node.position.y))) {
            err(R.BAD_FIELD, `${path}.position`, '{x, y}');
        }
    }
    if (starts !== 1) err(R.START_NOT_ONE, 'nodes', `exactly one start node (found ${starts})`);
    if (typeof graph.start === 'string' && nodes[graph.start]?.kind !== 'start') {
        err(R.START_NOT_ONE, 'start', `'${graph.start}' is not the start node`);
    }
    if (goals !== 1) err(R.GOAL_NOT_ONE, 'nodes', `exactly one goal node (found ${goals})`);

    // Every node can be reached through `after` from the start, at least structurally.
    if (errors.length === 0) {
        const opened = new Set([graph.start]);
        let grew = true;
        while (grew) {
            grew = false;
            for (const [id, node] of Object.entries(nodes)) {
                if (opened.has(id) || !Array.isArray(node.after)) continue;
                if (node.after.some((set) => set.every((ref) => opened.has(ref)))) { opened.add(id); grew = true; }
            }
        }
        for (const id of Object.keys(nodes)) {
            if (!opened.has(id)) err(R.NODE_UNREACHABLE, `nodes.${id}`, 'no chain of `after` sets reaches it from the start');
        }
    }

    // The item pool fills the check locations exactly (the goal holds the Victory event, not a pool item).
    if (errors.length === 0) {
        if (poolSize > checks) {
            err(R.ITEM_POOL_OVERFLOW, 'boons', `${poolSize} boon copies for ${checks} check locations`);
        } else if (poolSize < checks && graph.filler === undefined) {
            err(R.ITEM_POOL_SHORT, 'boons', `${poolSize} boon copies for ${checks} check locations, and no \`filler\` boon`);
        }
    }

    // Provenance (Z.7): sources, a listed default, every `src` listed, each source's type fields present.
    validateProvenance(graph, err);

    return { ok: errors.length === 0, errors };
}

function validateProvenance(graph, err) {
    const R = ACTION_GRAPH_REFUSALS;
    const prov = graph.provenance;
    if (!isPlainObject(prov)) { err(R.NO_PROVENANCE, 'provenance', 'every graph names its sources (Z.7)'); return; }
    // ⛓ CONTENT SETS PL-2: the block is checked by the pack layer's one validator (`parseProvenance`), so a graph and
    // a pack layer accept exactly the same sources. Its refusal sentence is kept; the name is this module's.
    try {
        parseProvenance(prov, graph.graph_id ?? '(graph)', 'action-graph');
    } catch (e) {
        const unlistedDefault = isPlainObject(prov.sources) && typeof prov.default === 'string' && prov.default
            && !Object.hasOwn(prov.sources, prov.default);
        err(unlistedDefault ? R.UNLISTED_SOURCE : R.BAD_PROVENANCE, unlistedDefault ? 'provenance.default' : 'provenance', e.message);
        return;
    }
    for (const [group, table] of [['nodes', graph.nodes], ['boons', graph.boons]]) {
        for (const [id, entry] of Object.entries(isPlainObject(table) ? table : {})) {
            if (entry?.src !== undefined && !Object.hasOwn(prov.sources, entry.src)) {
                err(R.UNLISTED_SOURCE, `${group}.${id}.src`, `'${entry.src}' is not a listed source`);
            }
        }
    }
}

/** Validate, and throw `ActionGraphError` naming every refusal when the graph is not valid. */
export function assertActionGraph(graph) {
    const { ok, errors } = validateActionGraph(graph);
    if (!ok) throw new ActionGraphError(errors);
    return graph;
}

/** The node ids that open `nodeId` — one per member of its `after` sets, de-duplicated, in order. */
export function predecessorsOf(graph, nodeId) {
    const out = [];
    for (const set of graph.nodes[nodeId]?.after ?? []) for (const ref of set) if (!out.includes(ref)) out.push(ref);
    return out;
}

/** The node ids `nodeId` opens: its exits. In `nodes` order. */
export function successorsOf(graph, nodeId) {
    return Object.keys(graph.nodes).filter((id) => predecessorsOf(graph, id).includes(nodeId));
}
