import { describe, expect, it } from 'vitest';
import { OTHER_CATEGORY, VIRTUAL_GROUPS, categoryGroupId } from './quickLaunchCatalog.js';
import { buildViewModel, filterView, groupSize } from './quickLaunchFilter.js';
import { EMPTY_TREE, NODE_KINDS } from './quickLaunchTree.js';

const ORDER = ['UI Panel Modules', 'Loop Mode Modules'];
const P = (componentType, title, description, category) => ({ componentType, moduleId: componentType, title, description, category });
const CATALOG = {
    panels: [
        P('inventoryPanel', 'Inventory', 'Inventory display panel.', 'UI Panel Modules'),
        P('eventsPanel', 'Events', 'Displays registered event publishers.', 'UI Panel Modules'),
        P('loopsPanel', 'Loops', 'Loop mode logic and UI.', 'Loop Mode Modules'),
        P('mysteryPanel', 'Mystery', 'Declares nothing we know.', 'Not A Section'),
    ],
    docs: [
        { path: 'docs/json/user/overview.md', title: 'Overview', section: 'user', summary: 'Inventory is mentioned here.' },
        { path: 'docs/json/user/modules/inventory.md', title: 'Inventory Panel', section: 'user/modules', summary: '' },
    ],
};
const TREE = {
    version: 1,
    nodes: [
        { id: 'g1', kind: 'group', label: 'Mine', children: [
            { id: 'n1', kind: 'panel', ref: 'inventoryPanel' },
            { id: 'g2', kind: 'group', label: 'Deep', children: [{ id: 'n2', kind: 'panel', ref: 'eventsPanel' }] },
        ] },
        { id: 'u1', kind: 'url', href: 'https://example.org', label: 'Example site' },
        { id: 'm1', kind: 'panel', ref: 'gonePanel' },
        { id: 'g3', kind: 'group', label: 'Loopy stuff', children: [{ id: 'n3', kind: 'doc', ref: 'docs/json/user/overview.md' }] },
    ],
};
const model = (tree = TREE) => buildViewModel(tree, CATALOG, ORDER);
const ids = (m) => m.groups.map((g) => g.id);
const rows = (group) => (group.groups ? group.groups.flatMap(rows) : group.entries.map((e) => e.item.componentType ?? e.item.path));

describe('buildViewModel', () => {
    it('an empty tree: no stored nodes, no Unfiled, All panels then Help', () => {
        const m = model(EMPTY_TREE);
        expect(m.stored).toEqual([]);
        expect(ids(m)).toEqual([VIRTUAL_GROUPS.allPanels.id, VIRTUAL_GROUPS.help.id]);
    });

    it('All panels holds the category sub-groups, Other last; Help holds the guides', () => {
        const [all, help] = model(EMPTY_TREE).groups;
        expect(all.groups.map((g) => g.label)).toEqual([...ORDER, OTHER_CATEGORY]);
        expect(all.groups[0].id).toBe(categoryGroupId(ORDER[0]));
        expect(groupSize(all)).toBe(CATALOG.panels.length);
        expect(help.entries.every((e) => e.kind === NODE_KINDS.doc)).toBe(true);
    });

    it('a non-empty tree: resolved stored nodes and an Unfiled group first', () => {
        const m = model();
        expect(ids(m)[0]).toBe(VIRTUAL_GROUPS.unfiled.id);
        expect(m.stored[0].children[0].item.title).toBe('Inventory');
        expect(m.stored[2].missing).toBe(true);
        expect(rows(m.groups[0])).toEqual(['loopsPanel', 'mysteryPanel', 'docs/json/user/modules/inventory.md']);
    });
});

describe('filterView', () => {
    it('a blank query is identity (the same object)', () => {
        const m = model();
        expect(filterView(m, '')).toBe(m);
        expect(filterView(m, '   ')).toBe(m);
        expect(filterView(m, undefined)).toBe(m);
    });

    it('matches titles case-insensitively and keeps every ancestor group, with only the matching rows', () => {
        const f = filterView(model(), 'INV');
        // Stored: Mine > Inventory (Deep holds no match and is gone).
        expect(f.stored).toHaveLength(1);
        expect(f.stored[0].id).toBe('g1');
        expect(f.stored[0].children.map((n) => n.id)).toEqual(['n1']);
        // Virtual: the Inventory panel under its category, the Inventory guide in Unfiled and Help.
        const all = f.groups.find((g) => g.id === VIRTUAL_GROUPS.allPanels.id);
        expect(all.groups.map((g) => g.label)).toEqual(['UI Panel Modules']);
        expect(rows(all)).toEqual(['inventoryPanel']);
        expect(rows(f.groups.find((g) => g.id === VIRTUAL_GROUPS.help.id))).toEqual(['docs/json/user/modules/inventory.md']);
        expect(rows(f.groups.find((g) => g.id === VIRTUAL_GROUPS.unfiled.id))).toEqual(['docs/json/user/modules/inventory.md']);
    });

    it('matches a panel by a word of its description', () => {
        const f = filterView(model(EMPTY_TREE), 'publishers');
        expect(f.groups.flatMap(rows)).toEqual(['eventsPanel']);
    });

    it('does not match a guide by its summary (title only)', () => {
        const f = filterView(model(EMPTY_TREE), 'mentioned');
        expect(f.groups).toEqual([]);
    });

    it('a nested match keeps both ancestors', () => {
        const f = filterView(model(), 'events');
        expect(f.stored.map((n) => n.id)).toEqual(['g1']);
        expect(f.stored[0].children.map((n) => n.id)).toEqual(['g2']);
        expect(f.stored[0].children[0].children.map((n) => n.id)).toEqual(['n2']);
    });

    it('a group whose label matches keeps everything in it', () => {
        const m = model();
        const f = filterView(m, 'loopy');
        expect(f.stored.map((n) => n.id)).toEqual(['g3']);
        expect(f.stored[0]).toBe(m.stored[3]); // kept whole, not rebuilt
        expect(f.stored[0].children.map((n) => n.id)).toEqual(['n3']);
    });

    it('a virtual group label match keeps the whole group (a category, or Help)', () => {
        const f = filterView(model(EMPTY_TREE), 'loop mode');
        expect(f.groups.flatMap(rows)).toEqual(['loopsPanel']);
        const h = filterView(model(EMPTY_TREE), 'help');
        expect(rows(h.groups[0])).toHaveLength(CATALOG.docs.length);
    });

    it('matches a link by its label, and a dangling ref by its ref', () => {
        expect(filterView(model(), 'example').stored.map((n) => n.id)).toEqual(['u1']);
        expect(filterView(model(), 'gonepanel').stored.map((n) => n.id)).toEqual(['m1']);
    });

    it('no match anywhere leaves nothing', () => {
        expect(filterView(model(), 'zzzz')).toEqual({ stored: [], groups: [] });
    });

    it('does not change its input', () => {
        const m = model();
        const before = JSON.stringify(m);
        filterView(m, 'inv');
        expect(JSON.stringify(m)).toBe(before);
    });
});
