import { describe, expect, it } from 'vitest';
import { OTHER_CATEGORY, VIRTUAL_GROUPS, categoryGroupId, helpGroupId } from './quickLaunchCatalog.js';
import {
    buildViewModel, countText, filterView, foldAll, groupIds, groupSize, knownCollapsed, rowCount, userGroupIds,
    virtualGroupIds,
} from './quickLaunchFilter.js';
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
        { path: 'docs/json/games/multi/README.md', title: 'Multi Game', section: 'games/multi', summary: '' },
        { path: 'docs/json/games/multi/rules.md', title: 'Multi Rules', section: 'games/multi', summary: '' },
        { path: 'docs/json/games/solo/README.md', title: 'Solo Game', section: 'games/solo', summary: '' },
        { path: 'docs/json/user/overview.md', title: 'Overview', section: 'user', summary: 'Inventory is mentioned here.' },
        { path: 'docs/json/user/modules/inventory.md', title: 'Inventory Panel', section: 'user/modules', summary: '' },
    ],
};
// What buildCatalog makes of HELP_SECTIONS: the drawn sections, paths resolved (the panel guide is not drawn).
const doc = (path) => CATALOG.docs.find((d) => d.path === path);
CATALOG.help = [
    { dir: 'user', label: 'User Guides', docs: [doc('docs/json/user/overview.md')], children: [] },
    { dir: 'games', label: 'Playable Games', docs: [], children: [
        { dir: 'games/multi', label: 'Multi Game', single: false,
            docs: [doc('docs/json/games/multi/README.md'), doc('docs/json/games/multi/rules.md')] },
        { dir: 'games/solo', label: 'Solo Game', single: true, docs: [doc('docs/json/games/solo/README.md')] },
    ] },
];
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
const rows = (group) => [...group.entries.map((e) => e.item.componentType ?? e.item.path), ...group.groups.flatMap(rows)];

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
        expect(help.entries).toEqual([]);
        expect(help.groups.map((g) => g.id)).toEqual([helpGroupId('user'), helpGroupId('games')]);
    });

    it('Help: a section holds its rows (own docs, then single children) and a sub-group per multi-doc child', () => {
        const help = model(EMPTY_TREE).groups.find((g) => g.id === VIRTUAL_GROUPS.help.id);
        const games = help.groups[1];
        expect(games.label).toBe('Playable Games');
        expect(rows({ entries: games.entries, groups: [] })).toEqual(['docs/json/games/solo/README.md']);
        expect(games.groups.map((g) => [g.id, g.label, g.entries.length])).toEqual([[helpGroupId('games/multi'), 'Multi Game', 2]]);
        expect(games.entries.every((e) => e.kind === NODE_KINDS.doc)).toBe(true);
        expect(groupSize(help)).toBe(4);
        expect(rows(help)).not.toContain('docs/json/user/modules/inventory.md');
    });

    it('a non-empty tree: resolved stored nodes and an Unfiled group first', () => {
        const m = model();
        expect(ids(m)[0]).toBe(VIRTUAL_GROUPS.unfiled.id);
        expect(m.stored[0].children[0].item.title).toBe('Inventory');
        expect(m.stored[2].missing).toBe(true);
        // Unfiled's docs are the ones Help draws: the panel guide is not offered, the filed overview is not.
        expect(rows(m.groups[0])).toEqual(['loopsPanel', 'mysteryPanel',
            'docs/json/games/multi/README.md', 'docs/json/games/multi/rules.md', 'docs/json/games/solo/README.md']);
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
        // Virtual: the Inventory panel under its category; its guide is in neither Help nor Unfiled (a panel guide).
        const all = f.groups.find((g) => g.id === VIRTUAL_GROUPS.allPanels.id);
        expect(all.groups.map((g) => g.label)).toEqual(['UI Panel Modules']);
        expect(rows(all)).toEqual(['inventoryPanel']);
        expect(f.groups.map((g) => g.id)).toEqual([VIRTUAL_GROUPS.allPanels.id]);
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
        expect(rows(h.groups[0])).toHaveLength(4); // every doc Help draws
    });

    it('a Help section or sub-group label match keeps it whole, under its ancestors', () => {
        const f = filterView(model(EMPTY_TREE), 'playable');
        expect(f.groups.map((g) => g.id)).toEqual([VIRTUAL_GROUPS.help.id]);
        expect(f.groups[0].groups.map((g) => g.id)).toEqual([helpGroupId('games')]);
        expect(rows(f.groups[0])).toHaveLength(3);
        const m = filterView(model(EMPTY_TREE), 'multi game');
        expect(rows(m.groups[0])).toEqual(['docs/json/games/multi/README.md', 'docs/json/games/multi/rules.md']);
        expect(m.groups[0].groups[0].entries).toEqual([]); // the section keeps only the matching sub-group
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

describe('fold (the Collapse all / Expand all button)', () => {
    it('userGroupIds: every stored group, nested ones too, in order; virtualGroupIds: every virtual group and sub-group', () => {
        const m = model();
        expect(userGroupIds(m)).toEqual(['g1', 'g2', 'g3']);
        const v = virtualGroupIds(m);
        expect(v[0]).toBe(VIRTUAL_GROUPS.unfiled.id);
        expect(v).toContain(categoryGroupId(ORDER[0]));
        expect(v).toContain(helpGroupId('games/multi'));
        expect(v).not.toContain('g1');
    });

    it('groupIds: the user groups, then every virtual group and sub-group', () => {
        const m = model();
        expect(groupIds(m)).toEqual([...userGroupIds(m), ...virtualGroupIds(m)]);
    });

    it('collapse over the whole view writes every group id, built-in ones too (P7); expand writes []', () => {
        const m = model();
        expect(foldAll(m, false, [])).toEqual(groupIds(m));
        expect(foldAll(m, false, ['g2', VIRTUAL_GROUPS.help.id])).toEqual(groupIds(m));
        expect(foldAll(m, true, ['g1', 'g3', VIRTUAL_GROUPS.allPanels.id])).toEqual([]);
    });

    it('under a filter only the groups drawn are touched; the others keep their state', () => {
        const f = filterView(model(), 'loopy'); // draws g3 only
        expect(groupIds(f)).toEqual(['g3']);
        expect(foldAll(f, false, ['g1', VIRTUAL_GROUPS.help.id])).toEqual(['g3', 'g1', VIRTUAL_GROUPS.help.id]);
        expect(foldAll(f, true, ['g1', 'g3'])).toEqual(['g1']);
    });

    it('an empty tree: the built-in groups still fold', () => {
        const m = model(EMPTY_TREE);
        expect(foldAll(m, false, [])).toEqual(virtualGroupIds(m));
        expect(foldAll(m, false, [])).toContain(VIRTUAL_GROUPS.allPanels.id);
        expect(foldAll(m, true, virtualGroupIds(m))).toEqual([]);
    });

    it('knownCollapsed: the one filter of every write — unknown ids dropped, duplicates once, order kept', () => {
        const known = new Set(['g1', VIRTUAL_GROUPS.help.id, helpGroupId('games/multi')]);
        expect(knownCollapsed([helpGroupId('games/multi'), 'dead', 'g1', 'g1', VIRTUAL_GROUPS.help.id], known))
            .toEqual([helpGroupId('games/multi'), 'g1', VIRTUAL_GROUPS.help.id]);
        expect(knownCollapsed(['g1'], ['g1'])).toEqual(['g1']);
        expect(knownCollapsed(null, known)).toEqual([]);
    });
});

describe('rowCount / countText (the filter box\'s "N of M")', () => {
    it('counts every drawn row: stored leaves (panel, doc, url, dangling ref; nested too) plus every virtual row', () => {
        const m = model();
        // Stored leaves: n1, n2 (nested), u1, m1 (dangling), n3 = 5. Virtual: Unfiled + All panels + Help.
        const virtual = m.groups.reduce((n, g) => n + groupSize(g), 0);
        expect(virtual).toBe(5 + 4 + 4); // Unfiled: loops, mystery + 3 unfiled drawn docs; All panels 4; Help 4
        expect(rowCount(m)).toBe(5 + virtual);
    });

    it('an empty tree counts only the virtual rows', () => {
        expect(rowCount(model(EMPTY_TREE))).toBe(CATALOG.panels.length + 4);
    });

    it('countText over a filter: the rows the cut keeps, of the rows the model draws', () => {
        const m = model();
        const f = filterView(m, 'loop'); // the "Loopy stuff" group (n3) + the Loops panel in Unfiled and in All panels
        expect(rowCount(f)).toBe(3);
        expect(countText(m, f)).toBe(`3 of ${rowCount(m)}`);
        expect(countText(m, filterView(m, 'zzz-nothing'))).toBe(`0 of ${rowCount(m)}`);
        expect(countText(m, filterView(m, ''))).toBe(`${rowCount(m)} of ${rowCount(m)}`);
    });
});
