/**
 * AN-3b: what a click (perform once) and the "perform all remaining" button would do, over the COMMITTED example
 * preset through the runtime model. Nodes are picked from the preset by shape, never typed here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime } from './actionNodesRuntime.js';
import { PERFORM_REFUSALS, planPerform, queueEndRegion } from './nodePerformPlan.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
const P = '1';
const BLOCK = RULES.action_nodes[P];
const PAYLOADS = Object.fromEntries(Object.entries(RULES.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
const fromStart = (p) => p.after.some((s) => s.length === 1 && s[0] === BLOCK.start);
const needsNothing = (p) => !Object.keys(p.requires.resources).length && !Object.keys(p.requires.stats).length;
/** Repeatable, off the start, needing nothing (the example's Do Chores). */
const REPEATABLE = Object.values(PAYLOADS).find((p) => fromStart(p) && p.limit > 1 && needsNothing(p));
/** Once-only, off the start, needing nothing (Train / Read the Notice). */
const ONCE = Object.values(PAYLOADS).find((p) => fromStart(p) && p.limit === 1 && p.kind !== 'start' && needsNothing(p));
/** Off the start, needing a resource nobody holds at load (Eat Bread). */
const NEEDY = Object.values(PAYLOADS).find((p) => fromStart(p) && Object.keys(p.requires.resources).length);
/** Only after REPEATABLE (Buy Bread / Bribe the Guard). */
const AFTER = Object.values(PAYLOADS).find((p) => p.after.length && p.after.every((s) => s.includes(REPEATABLE.node_id)));
const MENU = 'Menu';

let mana;
let rt;
function makeRuntime() {
    const ledger = new ResourceLedger();
    mana = BLOCK.loop.mana;
    const r = new ActionNodesRuntime({
        ledger: () => ledger, publish: () => {}, dispatch: () => {},
        gameState: () => ({ getCurrentMana: () => mana, setPerItemManaTable: () => {} }),
    });
    expect(r.loadWorld(RULES, P)).toBe(true);
    r.onSnapshot({ inventory: {}, checkedLocations: [] });
    return r;
}
const act = (nodeId) => ({ type: 'customAction', actionName: 'act', sourceRegion: nodeId, params: { nodeId } });
const plan = (nodeId, { queue = [], at = MENU, times = 1, isDiscovered } = {}) => planPerform(rt.model, {
    live: rt.liveViewState(), queue, costs: rt.liveCosts(), at, startRegions: [MENU], isDiscovered,
}, nodeId, { times });

beforeEach(() => { rt = makeRuntime(); });

describe('the fixture nodes exist in the preset', () => {
    it('repeatable, once-only, needy and after-repeatable nodes', () => {
        expect(REPEATABLE && ONCE && NEEDY && AFTER).toBeTruthy();
    });
});

describe('⛓ a ready node: the route from where the queue ends, then the acts', () => {
    it('from the loop start (Menu): Menu → start, start → node, one act', () => {
        const p = plan(REPEATABLE.node_id);
        expect(p.ok).toBe(true);
        expect(p.hops.map((h) => [h.from, h.to])).toEqual([[MENU, BLOCK.start], [BLOCK.start, REPEATABLE.node_id]]);
        expect(p.hops[1].exit).toBe(REPEATABLE.after[0] && rt.node(BLOCK.start).exits.find((e) => e.target === REPEATABLE.node_id).name);
        expect(p.acts).toBe(1);
        expect(p.capped).toBe(null);
    });

    it('standing on the node: no hops', () => {
        const p = plan(REPEATABLE.node_id, { at: REPEATABLE.node_id });
        expect(p.ok).toBe(true);
        expect(p.hops).toEqual([]);
        expect(p.acts).toBe(1);
    });

    it('from a sibling: back over the reverse exit, then forward', () => {
        const p = plan(ONCE.node_id, { at: REPEATABLE.node_id, queue: [act(REPEATABLE.node_id)] });
        expect(p.ok).toBe(true);
        expect(p.hops.map((h) => [h.from, h.to])).toEqual([[REPEATABLE.node_id, BLOCK.start], [BLOCK.start, ONCE.node_id]]);
    });

    it('a node opened only by the queue\'s planned clears is routed through them', () => {
        const queue = Array.from({ length: REPEATABLE.limit }, () => act(REPEATABLE.node_id));
        const p = plan(AFTER.node_id, { at: REPEATABLE.node_id, queue });
        expect(p.ok, p.text).toBe(true);
        expect(p.hops.map((h) => h.to)).toEqual([AFTER.node_id]);
    });

    it('the queue end region: the last move\'s destination, else the fallback', () => {
        expect(queueEndRegion([], 'X')).toBe('X');
        expect(queueEndRegion([{ type: 'regionMove', destinationRegion: 'A' }, act('A')], 'X')).toBe('A');
    });
});

describe('⛓ refused by name', () => {
    it('not reached: names what is still to clear', () => {
        const p = plan(AFTER.node_id);
        expect(p.ok).toBe(false);
        expect(p.code).toBe(PERFORM_REFUSALS.notReached);
        expect(p.text).toContain(AFTER.name);
        expect(p.text).toContain(`${REPEATABLE.name} (0/${REPEATABLE.limit})`);
    });

    it('blocked: names the unmet requirement', () => {
        const p = plan(NEEDY.node_id);
        expect(p.code).toBe(PERFORM_REFUSALS.blocked);
        const [, need] = Object.entries(NEEDY.requires.resources)[0];
        expect(p.text).toContain(NEEDY.name);
        expect(p.text).toContain(`needs ${need.name}`);
    });

    it('blocked by mana alone: "not enough mana" (a click never starts what it cannot finish)', () => {
        mana = REPEATABLE.time - 1;
        const p = plan(REPEATABLE.node_id);
        expect(p.code).toBe(PERFORM_REFUSALS.blocked);
        expect(p.text).toBe(`${REPEATABLE.name}: not enough mana`);
    });

    it('done: names the count, at the queue\'s end', () => {
        const queue = Array.from({ length: REPEATABLE.limit }, () => act(REPEATABLE.node_id));
        const p = plan(REPEATABLE.node_id, { queue, at: REPEATABLE.node_id });
        expect(p.code).toBe(PERFORM_REFUSALS.done);
        expect(p.text).toBe(`${REPEATABLE.name} is done this loop (${REPEATABLE.limit}/${REPEATABLE.limit})`);
    });

    it('undiscovered: refused without naming anything about the node', () => {
        const p = plan(REPEATABLE.node_id, { isDiscovered: (id) => id !== REPEATABLE.node_id });
        expect(p.code).toBe(PERFORM_REFUSALS.undiscovered);
        expect(p.text).not.toContain(REPEATABLE.name);
    });

    it('the start has no action', () => {
        expect(plan(BLOCK.start).code).toBe(PERFORM_REFUSALS.start);
    });

    it('a queue that already stops early: nothing after its stop would run', () => {
        const p = plan(REPEATABLE.node_id, { queue: [act(AFTER.node_id)] });
        expect(p.code).toBe(PERFORM_REFUSALS.queueStops);
        expect(p.text).toContain(AFTER.name);
    });

    it('unknown node, no world', () => {
        expect(plan('not-a-node').code).toBe(PERFORM_REFUSALS.unknownNode);
        expect(planPerform(null, {}, 'x').code).toBe(PERFORM_REFUSALS.noWorld);
    });
});

describe('⛓ "perform all remaining": limit − count, capped by the end state', () => {
    it('every performance left, when the mana covers them', () => {
        const p = plan(REPEATABLE.node_id, { times: 'remaining' });
        expect(p.acts).toBe(REPEATABLE.limit);
        expect(p.wanted).toBe(REPEATABLE.limit);
        expect(p.capped).toBe(null);
    });

    it('the remaining count follows the queue: one planned → limit − 1 left', () => {
        const p = plan(REPEATABLE.node_id, { times: 'remaining', queue: [act(REPEATABLE.node_id)], at: REPEATABLE.node_id });
        expect(p.wanted).toBe(REPEATABLE.limit - 1);
        expect(p.acts).toBe(REPEATABLE.limit - 1);
    });

    it('capped by mana: as many as the pool finishes, and the cap is said', () => {
        mana = REPEATABLE.time * (REPEATABLE.limit - 1) + 1;
        const p = plan(REPEATABLE.node_id, { times: 'remaining' });
        expect(p.ok).toBe(true);
        expect(p.acts).toBe(REPEATABLE.limit - 1);
        expect(p.capped.by).toBe('mana');
        expect(p.text).toContain(`×${REPEATABLE.limit - 1} of the ${REPEATABLE.limit} left`);
    });

    it('once means once, even on a repeatable node', () => {
        expect(plan(REPEATABLE.node_id).acts).toBe(1);
    });
});
