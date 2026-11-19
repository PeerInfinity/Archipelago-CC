/**
 * The node states (design §4, AN-3a) over the COMMITTED example preset, through the runtime model. Every node and
 * number is read from the preset, never typed here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime } from './actionNodesRuntime.js';
import { NODE_STATES, NOT_ENOUGH_MANA, nodeStateOf, nodeStates, queueEndState, viewStateOf } from './nodeStates.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
const P = '1';
const BLOCK = RULES.action_nodes[P];
const PAYLOADS = Object.fromEntries(Object.entries(RULES.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
const fromStart = (p) => p.after.some((s) => s.length === 1 && s[0] === BLOCK.start);
/** A node off the start, repeatable, whose results add a resource (the example's Do Chores). */
const REPEATABLE = Object.values(PAYLOADS).find((p) => fromStart(p) && p.limit > 1 && Object.keys(p.results.resources).length);
/** A node after REPEATABLE needing a resource it gives. */
const NEEDY = Object.values(PAYLOADS).find((p) => p.after.some((s) => s.includes(REPEATABLE.node_id))
    && Object.keys(p.requires.resources).length);
/** A node needing a stat (with a stat-giving node off the start). */
const STATTY = Object.values(PAYLOADS).find((p) => Object.keys(p.requires.stats).length
    && p.after.some((s) => s.every((m) => fromStart(PAYLOADS[m]))));

let mana;
let ledger;
function makeRuntime() {
    ledger = new ResourceLedger();
    mana = BLOCK.loop.mana;
    const rt = new ActionNodesRuntime({
        ledger: () => ledger, publish: () => {}, dispatch: () => {},
        gameState: () => ({ getCurrentMana: () => mana, setPerItemManaTable: () => {} }),
    });
    expect(rt.loadWorld(RULES, P)).toBe(true);
    rt.onSnapshot({ inventory: {}, checkedLocations: [] });
    return rt;
}
const act = (nodeId, extra = {}) => ({ type: 'customAction', actionName: 'act', sourceRegion: nodeId, params: { nodeId }, ...extra });

describe('the fixture nodes exist in the preset', () => {
    it('a repeatable resource node, a node needing its resource, a node needing a stat', () => {
        expect(REPEATABLE && NEEDY && STATTY).toBeTruthy();
    });
});

describe('⛓ nodeStates at load', () => {
    let rt;
    beforeEach(() => { rt = makeRuntime(); });

    it('the start is done; its neighbours are ready, or blocked naming the unmet line; the rest not reached', () => {
        const { states } = rt.nodeStates();
        expect(states[BLOCK.start].state).toBe(NODE_STATES.DONE);
        for (const p of Object.values(PAYLOADS)) {
            if (p.node_id === BLOCK.start) continue;
            const s = states[p.node_id];
            if (!fromStart(p)) { expect(s.state, p.node_id).toBe(NODE_STATES.NOT_REACHED); continue; }
            const needs = Object.keys(p.requires.resources).length + Object.keys(p.requires.stats).length;
            expect(s.state, p.node_id).toBe(needs ? NODE_STATES.BLOCKED : NODE_STATES.READY);
            if (needs) expect(s.unmet.text).toMatch(/^needs /);
        }
    });

    it('count, limit and price ride along', () => {
        const s = rt.nodeStates().states[REPEATABLE.node_id];
        expect(s).toMatchObject({ count: 0, limit: REPEATABLE.limit, price: REPEATABLE.time });
    });

    it('undiscovered wins over every other state', () => {
        const { states } = rt.nodeStates({ isDiscovered: (id) => id !== REPEATABLE.node_id && id !== BLOCK.start });
        expect(states[REPEATABLE.node_id].state).toBe(NODE_STATES.UNDISCOVERED);
        expect(states[BLOCK.start].state).toBe(NODE_STATES.UNDISCOVERED);
    });
});

describe('⛓ nodeStates follow the live state', () => {
    let rt;
    beforeEach(() => { rt = makeRuntime(); });

    it('a clear: the node is done, its targets reached; a reset puts it all back', () => {
        while (!rt.isCleared(REPEATABLE.node_id)) rt.perform(REPEATABLE.node_id);
        let { states } = rt.nodeStates();
        expect(states[REPEATABLE.node_id].state).toBe(NODE_STATES.DONE);
        expect(states[NEEDY.node_id].state).not.toBe(NODE_STATES.NOT_REACHED);
        rt.onLoopReset('test');
        ({ states } = rt.nodeStates());
        expect(states[REPEATABLE.node_id].state).toBe(NODE_STATES.READY);
        expect(states[NEEDY.node_id].state).toBe(NODE_STATES.NOT_REACHED);
    });

    it('short only of mana: blocked, "not enough mana"', () => {
        mana = REPEATABLE.time - 1;
        const s = rt.nodeStates().states[REPEATABLE.node_id];
        expect(s.state).toBe(NODE_STATES.BLOCKED);
        expect(s.unmet).toEqual({ ...NOT_ENOUGH_MANA });
        mana = 0;
        expect(rt.nodeStates().states[REPEATABLE.node_id].unmet).toEqual({ ...NOT_ENOUGH_MANA });
    });

    it('a requirement outranks mana: short of both names the requirement', () => {
        while (!rt.isCleared(REPEATABLE.node_id)) rt.perform(REPEATABLE.node_id);
        ledger.resetRun({}); // nothing held: NEEDY's resource minimum is unmet
        mana = 0;
        const s = rt.nodeStates().states[NEEDY.node_id];
        expect(s.state).toBe(NODE_STATES.BLOCKED);
        expect(s.unmet.code).toBe('resource');
    });
});

describe('⛓ while a queue is being planned: the END of the queue', () => {
    let rt;
    beforeEach(() => { rt = makeRuntime(); });
    const clearing = () => Array.from({ length: REPEATABLE.limit }, () => act(REPEATABLE.node_id));

    it('planned acts count: the queued node is done and its successors reached, the live counts untouched', () => {
        const { states, basis } = rt.nodeStates({ queue: clearing() });
        expect(basis).toBe('queue-end');
        expect(states[REPEATABLE.node_id].state).toBe(NODE_STATES.DONE);
        expect(states[NEEDY.node_id].state).toBe(NODE_STATES.READY);
        expect(rt.counts[rt.nodeIndex(REPEATABLE.node_id)]).toBe(0);
    });

    it('the planned acts spend the mana: the next click sees what is left', () => {
        mana = REPEATABLE.time * REPEATABLE.limit; // exactly enough for the clearing acts
        const s = rt.nodeStates({ queue: clearing() }).states[NEEDY.node_id];
        expect(s.state).toBe(NODE_STATES.BLOCKED);
        expect(s.unmet.code).toBe('mana');
    });

    it('while the queue RUNS the live state rules: queued acts do not count', () => {
        const { states, basis } = rt.nodeStates({ queue: clearing(), running: true });
        expect(basis).toBe('live');
        expect(states[REPEATABLE.node_id].state).toBe(NODE_STATES.READY);
        expect(states[NEEDY.node_id].state).toBe(NODE_STATES.NOT_REACHED);
    });

    it('completed entries are already in the live state and are not applied twice', () => {
        rt.perform(REPEATABLE.node_id);
        const q = [act(REPEATABLE.node_id, { completed: true }), act(REPEATABLE.node_id)];
        expect(rt.nodeStates({ queue: q }).states[REPEATABLE.node_id].state).toBe(NODE_STATES.DONE);
    });

    it('the walk stops where the queue would: an act the gate refuses, named', () => {
        const q = [act(NEEDY.node_id), ...clearing()];
        const r = queueEndState(rt.model, rt.liveViewState(), q, { costs: rt.liveCosts() });
        expect(r.applied).toBe(0);
        expect(r.stoppedAt).toMatchObject({ nodeId: NEEDY.node_id, code: 'not-reached' });
        expect(rt.nodeStates({ queue: q }).stoppedAt.nodeId).toBe(NEEDY.node_id);
    });

    it('moves change nothing (free, A10)', () => {
        const move = { type: 'regionMove', sourceRegion: BLOCK.start, destinationRegion: REPEATABLE.node_id };
        expect(viewStateOf(rt.model, rt.liveViewState(), { queue: [move] }).basis).toBe('live');
    });
});

describe('the pure functions', () => {
    it('nodeStates is nodeStateOf over every node', () => {
        const rt = makeRuntime();
        const all = nodeStates(rt.model, rt.liveViewState());
        rt.model.nodes.forEach((n, i) => expect(all[n.id]).toEqual(nodeStateOf(rt.model, rt.liveViewState(), i)));
    });
});
