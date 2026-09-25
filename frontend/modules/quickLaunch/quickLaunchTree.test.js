import { describe, expect, it } from 'vitest';
import {
    EMPTY_TREE, INTO_ITSELF_MESSAGE, NODE_KINDS, NOT_A_GROUP_MESSAGE, TREE_VERSION, UNKNOWN_NODE_MESSAGE,
    addGroup, addRef, addUrl, deleteNode, findNode, groupsOf, migrate, moveDown, moveNode, moveUp, newId,
    refsOf, renameGroup, resolve, unfiled,
} from './quickLaunchTree.js';

/** A fixture built through the ops themselves, with readable ids. */
function fixture() {
    let t = EMPTY_TREE;
    t = addGroup(t, null, 'A', 'gA');
    t = addGroup(t, 'gA', 'A1', 'gA1');
    t = addRef(t, 'gA', 'panel', 'inventoryPanel', 'p1');
    t = addRef(t, 'gA1', 'doc', 'docs/json/user/overview.md', 'd1');
    t = addGroup(t, null, 'B', 'gB');
    t = addUrl(t, null, 'https://example.org', 'Example', 'u1');
    return t;
}

const catalog = {
    panels: [
        { componentType: 'inventoryPanel', moduleId: 'inventory', title: 'Inventory' },
        { componentType: 'eventsPanel', moduleId: 'events', title: 'Events' },
    ],
    docs: [
        { path: 'docs/json/user/overview.md', title: 'Overview' },
        { path: 'docs/json/user/guided-tour.md', title: 'Guided Tour' },
    ],
};

const ids = (nodes) => nodes.map((n) => n.id);
const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };

describe('quickLaunchTree constants', () => {
    it('EMPTY_TREE is version 1 with no nodes, frozen', () => {
        expect(EMPTY_TREE).toEqual({ version: TREE_VERSION, nodes: [] });
        expect(TREE_VERSION).toBe(1);
        expect(Object.isFrozen(EMPTY_TREE)).toBe(true);
        expect(Object.values(NODE_KINDS)).toEqual(['group', 'panel', 'doc', 'url']);
    });

    it('newId returns distinct non-empty strings', () => {
        const got = new Set(Array.from({ length: 50 }, () => newId()));
        expect(got.size).toBe(50);
        for (const id of got) expect(typeof id === 'string' && id.length > 0).toBe(true);
    });
});

describe('quickLaunchTree ops', () => {
    it('never mutate their input (every op on a deep-frozen tree)', () => {
        const t = deepFreeze(fixture());
        expect(() => {
            addGroup(t, 'gB', 'x'); renameGroup(t, 'gA', 'y'); deleteNode(t, 'gA'); moveNode(t, 'p1', 'gB', 0);
            moveUp(t, 'gB'); moveDown(t, 'gA'); addRef(t, null, 'panel', 'z'); addUrl(t, 'gA1', 'h', 'l');
            migrate(t); resolve(t, catalog); unfiled(t, catalog); groupsOf(t);
        }).not.toThrow();
    });

    it('addGroup appends at the root and inside a group', () => {
        const t = fixture();
        expect(ids(t.nodes)).toEqual(['gA', 'gB', 'u1']);
        expect(findNode(t, 'gA').node.children.map((n) => n.id)).toEqual(['gA1', 'p1']);
        expect(findNode(t, 'gA1').node).toMatchObject({ kind: 'group', label: 'A1', children: [expect.anything()] });
    });

    it('addGroup into a non-group or an unknown id throws RangeError', () => {
        expect(() => addGroup(fixture(), 'p1', 'x')).toThrow(new RangeError(`${NOT_A_GROUP_MESSAGE} "p1"`));
        expect(() => addGroup(fixture(), 'nope', 'x')).toThrow(new RangeError(`${UNKNOWN_NODE_MESSAGE} "nope"`));
    });

    it('renameGroup relabels only the group; a non-group or unknown id throws', () => {
        const t = renameGroup(fixture(), 'gA1', 'Renamed');
        expect(findNode(t, 'gA1').node.label).toBe('Renamed');
        expect(findNode(t, 'gA').node.label).toBe('A');
        expect(() => renameGroup(t, 'p1', 'x')).toThrow(RangeError);
        expect(() => renameGroup(t, 'nope', 'x')).toThrow(UNKNOWN_NODE_MESSAGE);
    });

    it('deleteNode removes a leaf, or a group with its whole subtree', () => {
        const t = fixture();
        expect(findNode(deleteNode(t, 'p1'), 'p1')).toBeNull();
        const noA = deleteNode(t, 'gA');
        expect(ids(noA.nodes)).toEqual(['gB', 'u1']);
        expect(['gA1', 'p1', 'd1'].map((id) => findNode(noA, id))).toEqual([null, null, null]);
        expect(() => deleteNode(t, 'nope')).toThrow(UNKNOWN_NODE_MESSAGE);
    });

    it('moveNode moves across levels, clamps the index, keeps the node', () => {
        const t = fixture();
        const m = moveNode(t, 'd1', null, 0);
        expect(ids(m.nodes)).toEqual(['d1', 'gA', 'gB', 'u1']);
        expect(findNode(m, 'gA1').node.children).toEqual([]);
        expect(ids(moveNode(t, 'u1', 'gB', 99).nodes)).toEqual(['gA', 'gB']);
        expect(findNode(moveNode(t, 'u1', 'gB', -5), 'u1').parent.id).toBe('gB');
        // index is in the destination list AFTER removal: moving gA to index 1 of the root puts it after gB
        expect(ids(moveNode(t, 'gA', null, 1).nodes)).toEqual(['gB', 'gA', 'u1']);
    });

    it('moveNode refuses a group into itself or its descendant, a non-group target, an unknown id', () => {
        const t = fixture();
        expect(() => moveNode(t, 'gA', 'gA', 0)).toThrow(INTO_ITSELF_MESSAGE);
        expect(() => moveNode(t, 'gA', 'gA1', 0)).toThrow(INTO_ITSELF_MESSAGE);
        expect(() => moveNode(t, 'p1', 'u1', 0)).toThrow(NOT_A_GROUP_MESSAGE);
        expect(() => moveNode(t, 'nope', null, 0)).toThrow(UNKNOWN_NODE_MESSAGE);
        expect(() => moveNode(t, 'p1', 'nope', 0)).toThrow(UNKNOWN_NODE_MESSAGE);
    });

    it('moveUp / moveDown swap with a sibling and are no-ops at the edge', () => {
        const t = fixture();
        expect(ids(moveUp(t, 'gB').nodes)).toEqual(['gB', 'gA', 'u1']);
        expect(ids(moveDown(t, 'gB').nodes)).toEqual(['gA', 'u1', 'gB']);
        expect(moveUp(t, 'gA')).toBe(t);
        expect(moveDown(t, 'u1')).toBe(t);
        expect(ids(findNode(moveUp(t, 'p1'), 'gA').node.children)).toEqual(['p1', 'gA1']);
        expect(() => moveUp(t, 'nope')).toThrow(UNKNOWN_NODE_MESSAGE);
        expect(() => moveDown(t, 'nope')).toThrow(UNKNOWN_NODE_MESSAGE);
    });

    it('addRef adds panel and doc refs, allows duplicates, refuses other kinds', () => {
        let t = addRef(fixture(), null, 'panel', 'inventoryPanel', 'p2');
        expect(findNode(t, 'p2').node).toEqual({ id: 'p2', kind: 'panel', ref: 'inventoryPanel' });
        t = addRef(t, 'gB', 'doc', 'docs/json/user/overview.md', 'd2');
        expect(findNode(t, 'd2').parent.id).toBe('gB');
        expect(() => addRef(t, null, 'url', 'x')).toThrow(RangeError);
        expect(() => addRef(t, null, 'group', 'x')).toThrow(RangeError);
        expect(() => addRef(t, 'nope', 'panel', 'x')).toThrow(UNKNOWN_NODE_MESSAGE);
    });

    it('addUrl adds a url node; an empty label falls back to the href', () => {
        const t = addUrl(fixture(), 'gB', 'https://a.b', '', 'u2');
        expect(findNode(t, 'u2')).toMatchObject({ node: { kind: 'url', href: 'https://a.b', label: 'https://a.b' } });
        expect(() => addUrl(t, 'nope', 'h', 'l')).toThrow(UNKNOWN_NODE_MESSAGE);
    });

    it('findNode returns node/parent/index, null parent at the root, null when absent', () => {
        const t = fixture();
        expect(findNode(t, 'gB')).toMatchObject({ parent: null, index: 1 });
        expect(findNode(t, 'd1')).toMatchObject({ parent: { id: 'gA1' }, index: 0 });
        expect(findNode(t, 'nope')).toBeNull();
    });

    it('groupsOf lists every group depth-first with its depth', () => {
        expect(groupsOf(fixture())).toEqual([
            { id: 'gA', label: 'A', depth: 0 }, { id: 'gA1', label: 'A1', depth: 1 }, { id: 'gB', label: 'B', depth: 0 },
        ]);
        expect(groupsOf(EMPTY_TREE)).toEqual([]);
    });
});

describe('quickLaunchTree migrate', () => {
    it('null / garbage → EMPTY_TREE', () => {
        for (const bad of [null, undefined, 3, 'x', [], {}, { nodes: 'no' }]) expect(migrate(bad)).toBe(EMPTY_TREE);
    });

    it('a well-formed v1 tree is returned as the same object', () => {
        const t = fixture();
        expect(migrate(t)).toBe(t);
        expect(migrate(EMPTY_TREE)).toBe(EMPTY_TREE);
    });

    it('a versionless / older tree is normalised to v1', () => {
        const m = migrate({ nodes: [{ id: 'a', kind: 'panel', ref: 'x' }] });
        expect(m).toEqual({ version: 1, nodes: [{ id: 'a', kind: 'panel', ref: 'x' }] });
    });

    it('drops unknown kinds, fills missing fields, replaces missing and duplicate ids', () => {
        const m = migrate({
            version: 1,
            nodes: [
                { id: 'a', kind: 'group', label: 'G' },
                { id: 'a', kind: 'panel', ref: 'x' },
                { kind: 'doc', ref: 'p' },
                { id: 'z', kind: 'bogus' },
                'junk',
                { id: 'u', kind: 'url', href: 'h' },
            ],
        });
        expect(m.nodes.map((n) => n.kind)).toEqual(['group', 'panel', 'doc', 'url']);
        expect(m.nodes[0]).toEqual({ id: 'a', kind: 'group', label: 'G', children: [] });
        expect(new Set(m.nodes.map((n) => n.id)).size).toBe(4);
        expect(m.nodes[3]).toEqual({ id: 'u', kind: 'url', href: 'h', label: 'h' });
    });

    it('is idempotent', () => {
        const once = migrate({ nodes: [{ kind: 'group', children: [{ kind: 'panel', ref: 'x' }] }] });
        expect(migrate(once)).toBe(once);
    });
});

describe('quickLaunchTree resolve / unfiled', () => {
    it('resolve attaches the catalog item, or missing:true on a dangling ref, never throwing', () => {
        let t = addRef(fixture(), null, 'panel', 'goneP', 'x1');
        t = addRef(t, null, 'doc', 'docs/gone.md', 'x2');
        const r = resolve(t, catalog);
        expect(findNode(r, 'p1').node.item.title).toBe('Inventory');
        expect(findNode(r, 'd1').node.item.title).toBe('Overview');
        expect(findNode(r, 'x1').node).toMatchObject({ ref: 'goneP', missing: true });
        expect(findNode(r, 'x2').node).toMatchObject({ missing: true });
        expect(findNode(r, 'u1').node).toEqual(findNode(t, 'u1').node);
        expect(() => resolve(t, { panels: [], docs: [] })).not.toThrow();
    });

    it('unfiled lists the catalog entries no node references, panels then docs', () => {
        expect(unfiled(fixture(), catalog)).toEqual([
            { kind: 'panel', item: catalog.panels[1] }, { kind: 'doc', item: catalog.docs[1] },
        ]);
        expect(unfiled(EMPTY_TREE, catalog)).toHaveLength(4);
        expect(refsOf(fixture())).toEqual(new Set(['panel:inventoryPanel', 'doc:docs/json/user/overview.md']));
    });
});

describe('quickLaunchTree property: 200 seeded random ops', () => {
    // mulberry32 — a fixed seed makes the sequence the same on every run.
    function rng(seed) {
        let a = seed;
        return () => {
            a |= 0; a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const allNodes = (t) => {
        const out = [];
        const walk = (ns) => ns.forEach((n) => { out.push(n); if (n.kind === 'group') walk(n.children); });
        walk(t.nodes);
        return out;
    };
    const refCounts = (t) => {
        const m = new Map();
        for (const n of allNodes(t)) if (n.ref !== undefined) m.set(`${n.kind}:${n.ref}`, (m.get(`${n.kind}:${n.ref}`) ?? 0) + 1);
        return m;
    };
    const lostRefs = (before, after) => [...refCounts(before)].filter(([k, c]) => (refCounts(after).get(k) ?? 0) < c);

    it('never duplicates an id, never loses a ref it did not delete, migrate stays identity', () => {
        const rand = rng(20260924);
        const pick = (arr) => arr[Math.floor(rand() * arr.length)];
        let t = fixture();
        let seq = 0;
        const problems = [];
        for (let step = 0; step < 200; step += 1) {
            const nodes = allNodes(t);
            const groups = nodes.filter((n) => n.kind === 'group');
            const anyId = () => (nodes.length ? pick(nodes).id : null);
            const parent = () => (groups.length && rand() < 0.7 ? pick(groups).id : null);
            const before = t;
            const op = pick(['addGroup', 'renameGroup', 'deleteNode', 'moveNode', 'moveUp', 'moveDown', 'addRef', 'addUrl']);
            let deleting = null;
            try {
                seq += 1;
                switch (op) {
                case 'addGroup': t = addGroup(t, parent(), `g${seq}`, `n${seq}`); break;
                case 'renameGroup': if (groups.length) t = renameGroup(t, pick(groups).id, `r${seq}`); break;
                case 'deleteNode': deleting = anyId(); if (deleting) t = deleteNode(t, deleting); break;
                case 'moveNode': { const id = anyId(); if (id) t = moveNode(t, id, parent(), Math.floor(rand() * 5)); break; }
                case 'moveUp': { const id = anyId(); if (id) t = moveUp(t, id); break; }
                case 'moveDown': { const id = anyId(); if (id) t = moveDown(t, id); break; }
                case 'addRef': t = addRef(t, parent(), pick(['panel', 'doc']), pick(['inventoryPanel', 'eventsPanel', 'docs/json/user/overview.md', 'gone']), `n${seq}`); break;
                case 'addUrl': t = addUrl(t, parent(), `https://x/${seq}`, `u${seq}`, `n${seq}`); break;
                default: break;
                }
            } catch (e) {
                // Only the "into itself" refusal is a legal outcome of a random move.
                if (!(e instanceof RangeError && e.message.startsWith(INTO_ITSELF_MESSAGE))) problems.push(`${step} ${op}: ${e.message}`);
            }
            const idsNow = allNodes(t).map((n) => n.id);
            if (new Set(idsNow).size !== idsNow.length) problems.push(`${step} ${op}: duplicate id`);
            if (!deleting) {
                const lost = lostRefs(before, t);
                if (lost.length) problems.push(`${step} ${op}: lost ${lost.join(',')}`);
            } else {
                // A delete may only lose refs from the deleted subtree.
                const gone = findNode(before, deleting).node;
                const sub = { nodes: [gone] };
                const expected = new Map(refCounts(before));
                for (const [k, c] of refCounts(sub)) expected.set(k, expected.get(k) - c);
                for (const [k, c] of expected) if ((refCounts(t).get(k) ?? 0) !== c) problems.push(`${step} delete: ref ${k}`);
            }
            if (migrate(t) !== t) problems.push(`${step} ${op}: migrate is not identity`);
            expect(() => resolve(t, catalog)).not.toThrow();
        }
        expect(problems).toEqual([]);
        expect(allNodes(t).length).toBeGreaterThan(0);
    });
});
