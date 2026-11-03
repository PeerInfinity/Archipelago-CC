/**
 * ⛓ ITEM INTRODUCTION — the vocabulary (`procgenCore/itemIntroduction.js`) and the sphere planner's pre-pass
 * (`sphereIntroductions.js`), on hand-built plans and FAKE registry entries: no substrate is named, which is the
 * point (the planner discovers introducible items ONLY through the entry's declaration).
 */

import { describe, it, expect } from 'vitest';

import {
    ITEM_INTRODUCTION_REFUSAL_NAMES, declaresItemIntroduction, introducibleItemsOf, introductionRequestOf,
    replayableItemsOf, ruleRequiresItem, unrequestedIntroductions,
} from '../procgenCore/itemIntroduction.js';
import { scheduleSphereIntroductions } from './sphereIntroductions.js';
import { compareSpheresToPlan } from './spherePlanner.js';
import { sphereHeldItems, compactSphereTree } from './procgenPipelineEngine.js';

const HAS = (item) => ({ rule: 'Has', args: { item_name: item } });
const KEYS = ['K1', 'K2', 'K3'];
/** A fake entry that introduces KEYS when its params say `on`. */
const LOCKS = Object.freeze({
    id: 'locks',
    itemIntroduction: { introducibleItems: (p) => (p?.on ? [...KEYS] : []), replayableItems: () => [...KEYS] },
});
const PLAIN = Object.freeze({ id: 'plain' });
const entryOf = (id) => ({ locks: LOCKS, plain: PLAIN }[id]);

/** Three spheres; wave-w nodes host sphere-(w+1) items, as `placeSphereTreeItems` deals them. */
function world({ substrate = 'locks', hostItems = 2 } = {}) {
    const plan = { spheres: [
        { sphere: 1, items: ['a'] },
        { sphere: 2, items: Array.from({ length: hostItems }, (_, i) => `b${i}`) },
        { sphere: 3, items: ['v'] },
    ] };
    const nodes = [
        { index: 0, wave: 0, parent: null, substrate, gate: [], items: [{ id: 'loc_0', item: 'a' }] },
        { index: 1, wave: 1, parent: 0, substrate: 'plain', gate: ['a'],
            items: plan.spheres[1].items.map((item, i) => ({ id: `loc_${i}`, item })) },
        { index: 2, wave: 2, parent: 1, substrate, gate: ['b0'], items: [{ id: 'loc_0', item: 'v' }] },
    ];
    return { plan, nodes };
}

describe('the vocabulary', () => {
    it('a declaration is read through the entry only; none → nothing', () => {
        expect(declaresItemIntroduction(PLAIN)).toBe(false);
        expect(introducibleItemsOf(PLAIN, { on: true })).toEqual([]);
        expect(introducibleItemsOf(LOCKS, { on: true })).toEqual(KEYS);
        expect(introducibleItemsOf(LOCKS, {})).toEqual([]);
        expect(replayableItemsOf(LOCKS, {})).toEqual(KEYS);
        expect(() => introducibleItemsOf({ id: 'bad', itemIntroduction: { introducibleItems: () => ['x', 'x'] } }))
            .toThrow(new RegExp(`^${ITEM_INTRODUCTION_REFUSAL_NAMES.malformed}: substrate 'bad'.*twice`));
        expect(() => introducibleItemsOf({ id: 'bad', itemIntroduction: { introducibleItems: () => 'x' } }))
            .toThrow(/not an array of non-empty item names/);
    });

    it('ruleRequiresItem: Has, or an And holding it', () => {
        expect(ruleRequiresItem(HAS('K1'), 'K1')).toBe(true);
        expect(ruleRequiresItem({ rule: 'And', children: [HAS('x'), HAS('K1')] }, 'K1')).toBe(true);
        expect(ruleRequiresItem({ rule: 'Or', children: [HAS('K1')] }, 'K1')).toBe(false);
        expect(ruleRequiresItem({ rule: 'True_' }, 'K1')).toBe(false);
    });

    it('the request is DERIVED from the spec: a location holding K and another requiring it', () => {
        const locations = [{ id: 'g', item: 'v', access_rule: HAS('K2') }, { id: 'k', item: 'K2' }];
        /** replayed under ANY params, because the spec carries it */
        expect(introductionRequestOf(LOCKS, { params: {}, locations })).toEqual({ items: { K2: 1 } });
        expect(introductionRequestOf(PLAIN, { params: {}, locations })).toBe(null);
        expect(introductionRequestOf(LOCKS, { params: {}, locations: [{ id: 'k', item: 'K2' }] })).toBe(null);
        /** requests ON with nothing asked → an explicit empty request */
        expect(introductionRequestOf(LOCKS, { params: {}, locations: [], introductionRequests: true }))
            .toEqual({ items: {} });
        expect(unrequestedIntroductions(LOCKS, { on: true }, [{ item: 'K1' }, { item: 'v' }], { items: {} }))
            .toEqual(['K1']);
        expect(unrequestedIntroductions(LOCKS, { on: true }, [{ item: 'K1' }], { items: { K1: 1 } })).toEqual([]);
    });
});

/**
 * A miniature sphere sweep over hand-built nodes (AP's semantics: everything reachable with the items held at
 * the start of a sphere is collected in it). A node is open once its parent is and its `gate` items are held; a
 * location once its node is and its rule's `Has` items are held.
 */
function sweep(nodes) {
    const held = new Set();
    const got = new Set();
    const spheres = [];
    const needs = (rule) => (rule?.rule === 'Has' ? [rule.args.item_name] : []);
    const open = (n) => (n.parent == null || open(nodes.find((m) => m.index === n.parent)))
        && (n.gate ?? []).every((g) => held.has(g));
    for (let s = 1; s < 20; s++) {
        const items = [];
        for (const n of nodes) {
            if (!open(n)) continue;
            for (const l of n.items) {
                const key = `${n.index}/${l.id}`;
                if (got.has(key) || !needs(l.rule).every((i) => held.has(i))) continue;
                got.add(key);
                items.push(l.item);
            }
        }
        if (items.length === 0) break;
        items.forEach((i) => held.add(i));
        spheres.push({ sphere: s, items });
    }
    return spheres;
}

/** Four spheres; a declaring node in waves 0 AND 1, so the wave-1 one is the wave-0 one's HOST (chained). */
function chained() {
    const plan = { spheres: [
        { sphere: 1, items: ['a'] }, { sphere: 2, items: ['b0', 'b1'] },
        { sphere: 3, items: ['c0', 'c1'] }, { sphere: 4, items: ['v'] },
    ] };
    const nodes = [
        { index: 0, wave: 0, parent: null, substrate: 'locks', gate: [], items: [{ id: 'loc_0', item: 'a' }] },
        { index: 1, wave: 1, parent: 0, substrate: 'locks', gate: ['a'],
            items: [{ id: 'loc_0', item: 'b0' }, { id: 'loc_1', item: 'b1' }] },
        { index: 2, wave: 2, parent: 1, substrate: 'plain', gate: ['b0'],
            items: [{ id: 'loc_0', item: 'c0' }, { id: 'loc_1', item: 'c1' }] },
        { index: 3, wave: 3, parent: 2, substrate: 'plain', gate: ['c0'], items: [{ id: 'loc_0', item: 'v' }] },
    ];
    return { plan, nodes };
}

describe('⛓ R1 — CHAINED key-gate rooms: only DEALT items move, in any node order', () => {
    it.each([['index order', [0, 1, 2, 3]], ['host BEFORE its client (shuffled)', [1, 0, 2, 3]]])(
        '%s: each room locks a DEALT item of its host, and the sweep matches the plan', (_, order) => {
            const { plan, nodes } = chained();
            const ordered = order.map((i) => nodes[i]);
            scheduleSphereIntroductions(plan, ordered, { regionParams: { on: true }, entryOf });
            const [client, host] = [nodes[0], nodes[1]];
            expect(client.introduces).toHaveLength(1);
            expect(host.introduces).toHaveLength(1);
            /** the client never takes the host's own key or the item the host locked */
            expect(client.introduces[0].lockedItem).toMatch(/^b[01]$/);
            expect(host.introduces[0].lockedItem).toMatch(/^c[01]$/);
            expect(compareSpheresToPlan(sweep(nodes), plan)).toEqual([]);
            /** and a re-deal REPLAYS the same, in the same order */
            const first = JSON.stringify(nodes.map((n) => n.items));
            const fresh = chained();
            nodes.forEach((n, i) => { n.items = fresh.nodes[i].items; });
            scheduleSphereIntroductions(plan, ordered, { regionParams: { on: true }, entryOf });
            expect(JSON.stringify(nodes.map((n) => n.items))).toBe(first);
        });
});

describe('the planner pre-pass', () => {
    it('a declaring node takes the first FREE item, a sphere-(w+2) item moves behind it, the plan stays exact', () => {
        const { plan, nodes } = world();
        scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf });
        expect(nodes[0].introduces).toEqual([{ item: 'K1', lockedItem: 'b1', lockedFrom: 1 }]);
        expect(nodes[0].items).toEqual([{ id: 'loc_0', item: 'a' }, { id: 'loc_1', item: 'K1' },
            { id: 'loc_2', item: 'b1', rule: HAS('K1') }]);
        expect(nodes[1].items).toEqual([{ id: 'loc_0', item: 'b0' }]);
        /** the last wave has no sphere after it: decided NONE */
        expect(nodes[2].introduces).toEqual([]);
        expect(plan.spheres[0].introduced).toEqual(['K1']);
        /** the oracle and held both count the introduced key */
        expect(compareSpheresToPlan([{ sphere: 1, items: ['a', 'K1'] }, { sphere: 2, items: ['b0', 'b1'] },
            { sphere: 3, items: ['v'] }], plan)).toEqual([]);
        expect(sphereHeldItems(plan, nodes[2], nodes).items).toEqual({ a: 1, K1: 1, b0: 1, b1: 1 });
        /** and the compacted tree records it, ONLY on the declaring nodes */
        const compact = compactSphereTree({ nodes: nodes.map((n) => ({ ...n, usedSides: [] })) });
        expect(compact.nodes.map((n) => n.introduces ?? null)).toEqual([nodes[0].introduces, null, []]);
    });

    it('two eligible nodes take DISTINCT items; an item the plan already holds is never taken', () => {
        const { plan, nodes } = world();
        plan.spheres[2].items.push('K1');
        nodes.splice(1, 0, { index: 9, wave: 0, parent: null, substrate: 'locks', gate: [], items: [] });
        scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf });
        expect(nodes.flatMap((n) => n.introduces ?? []).map((d) => d.item)).toEqual(['K2', 'K3']);
    });

    it('every item taken → the substrate\'s own sentence, else the generic one', () => {
        const { plan, nodes } = world();
        plan.spheres[2].items.push(...KEYS);
        expect(() => scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf }))
            .toThrow(new RegExp(`^${ITEM_INTRODUCTION_REFUSAL_NAMES.exhausted}: region 'node 0'.*K1, K2, K3`));
        const own = { ...LOCKS, itemIntroduction: { ...LOCKS.itemIntroduction, exhaustedRefusal: (r) => `OWN ${r}` } };
        const w = world();
        w.plan.spheres[2].items.push(...KEYS);
        expect(() => scheduleSphereIntroductions(w.plan, w.nodes, { regionParams: { on: true },
            entryOf: (id) => (id === 'locks' ? own : PLAIN) })).toThrow(/^OWN node 0$/);
    });

    it('a non-declaring world is untouched: no `introduces`, no plan change', () => {
        const { plan, nodes } = world({ substrate: 'plain' });
        const before = JSON.stringify({ plan, nodes });
        scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf });
        expect(JSON.stringify({ plan, nodes })).toBe(before);
        const off = world();
        const offBefore = JSON.stringify(off);
        scheduleSphereIntroductions(off.plan, off.nodes, { regionParams: {}, entryOf });
        expect(JSON.stringify(off)).toBe(offBefore);
    });

    it('REPLAY: a re-deal (batched growth) re-applies the RECORDED decision, never a new one', () => {
        const { plan, nodes } = world();
        scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf });
        const first = JSON.stringify(nodes.map((n) => n.items));
        /** what the batched driver does each batch: clear and re-deal, then the pre-pass again */
        nodes.forEach((n) => { n.items = []; });
        nodes[0].items.push({ id: 'loc_0', item: 'a' });
        plan.spheres[1].items.forEach((item, i) => nodes[1].items.push({ id: `loc_${i}`, item }));
        nodes[2].items.push({ id: 'loc_0', item: 'v' });
        scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf });
        expect(JSON.stringify(nodes.map((n) => n.items))).toBe(first);
        expect(plan.spheres[0].introduced).toEqual(['K1']);
    });

    it('a host with ONE item is used when none holds two (it is left a pass-through)', () => {
        const { plan, nodes } = world({ hostItems: 1 });
        scheduleSphereIntroductions(plan, nodes, { regionParams: { on: true }, entryOf });
        expect(nodes[0].introduces).toEqual([{ item: 'K1', lockedItem: 'b0', lockedFrom: 1 }]);
        expect(nodes[1].items).toEqual([]);
    });
});
