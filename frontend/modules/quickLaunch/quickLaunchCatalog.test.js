import { describe, expect, it } from 'vitest';
import {
    BLANK_ICON, OTHER_CATEGORY, VIRTUAL_GROUPS, buildCatalog, categoryGroupId, drawnHelpSections, helpDocs,
    helpGroupId, lookupModuleInfo, virtualGroups,
} from './quickLaunchCatalog.js';
import { CATEGORY_ORDER, HELP_SECTIONS } from './generated/docsIndex.js';

class ClassInfoPanel {}
ClassInfoPanel.moduleInfo = { title: 'From Class', icon: '🅲', column: 2 };
class BarePanel {}
class EntryPanel {}
class OffPanel {}

const DOCS = [
    { path: 'docs/json/user/modules/entry.md', title: 'Entry Panel', section: 'user/modules', summary: 'Entry guide.' },
    { path: 'docs/json/user/overview.md', title: 'Overview', section: 'user' },
    { path: 'docs/json/user/quick-start.md', title: 'Quick Start', section: 'user' },
    { path: 'docs/json/games/one/README.md', title: 'One', section: 'games/one' },
    { path: 'docs/json/dev/tool.md', title: 'Tool', section: 'dev' },
];

const SECTIONS = [
    { dir: 'user/modules', label: 'Panel Guides', order: 0, audience: 'panel', docs: ['docs/json/user/modules/entry.md'], children: [] },
    { dir: 'user', label: 'User Guides', order: 10, audience: 'user',
        docs: ['docs/json/user/overview.md', 'docs/json/user/quick-start.md', 'docs/json/user/gone.md'], children: [] },
    { dir: 'games', label: 'Games', order: 30, audience: 'user', docs: [],
        children: [{ dir: 'games/one', label: 'One', single: true, docs: ['docs/json/games/one/README.md'] }] },
    { dir: 'dev', label: 'Dev', order: 110, audience: 'developer', docs: ['docs/json/dev/tool.md'], children: [] },
];

const fixture = () => new Map([
    ['barePanel', { moduleId: 'bare', componentClass: BarePanel, moduleInfo: null }],
    ['classPanel', { moduleId: 'classy', componentClass: ClassInfoPanel, moduleInfo: null }],
    ['entryPanel', {
        moduleId: 'entry',
        componentClass: EntryPanel,
        moduleInfo: {
            title: 'Entry', icon: '🅴', column: 1, description: 'declared on the entry',
            docs: 'docs/json/user/modules/entry.md',
        },
    }],
    ['offPanel', {
        moduleId: 'off',
        componentClass: OffPanel,
        moduleInfo: { name: 'offModule', icon: '⭘', docs: 'docs/json/user/modules/missing.md' },
    }],
]);

const STATES = { bare: { enabled: true }, classy: { enabled: true }, entry: { enabled: true }, off: { enabled: false } };
const PRIORITY = ['entry', 'classy', 'off'];

const build = (over = {}) => buildCatalog({
    panelComponents: fixture(), moduleStates: STATES, docsIndex: DOCS, loadPriority: PRIORITY, ...over,
});
const panel = (cat, ct) => cat.panels.find((p) => p.componentType === ct);

describe('buildCatalog — panels', () => {
    it('lists every registered componentType exactly once', () => {
        expect(build().panels.map((p) => p.componentType).sort())
            .toEqual([...fixture().keys()].sort());
    });

    it('reads moduleInfo off the registry entry', () => {
        expect(panel(build(), 'entryPanel')).toMatchObject({
            moduleId: 'entry', title: 'Entry', icon: '🅴', column: 1,
            description: 'declared on the entry', enabled: true,
        });
    });

    it('falls back to componentClass.moduleInfo', () => {
        expect(panel(build(), 'classPanel')).toMatchObject({ title: 'From Class', icon: '🅲', column: 2 });
    });

    it('a module declaring nothing is titled by its componentType with a blank icon', () => {
        expect(panel(build(), 'barePanel')).toMatchObject({
            title: 'barePanel', icon: BLANK_ICON, description: '', column: null, docs: null,
        });
    });

    it('title falls back to moduleInfo.name before the componentType', () => {
        expect(panel(build(), 'offPanel').title).toBe('offModule');
    });

    it('enabled comes from the module states', () => {
        expect(panel(build(), 'offPanel').enabled).toBe(false);
        expect(panel(build({ moduleStates: {} }), 'entryPanel').enabled).toBe(false);
    });

    it('docs is the declared path only when the index lists it', () => {
        expect(panel(build(), 'entryPanel').docs).toBe('docs/json/user/modules/entry.md');
        expect(panel(build(), 'offPanel').docs).toBeNull();
    });

    it('summary is the declared guide\'s first paragraph, empty without one', () => {
        expect(panel(build(), 'entryPanel').summary).toBe('Entry guide.');
        expect(panel(build(), 'offPanel').summary).toBe('');
        expect(build().docs.find((d) => d.path.endsWith('entry.md')).summary).toBe('Entry guide.');
        expect(build().docs.find((d) => d.path.endsWith('overview.md')).summary).toBe('');
    });

    it('orders by loadPriority index, then title, unlisted modules last', () => {
        expect(build().panels.map((p) => p.componentType))
            .toEqual(['entryPanel', 'classPanel', 'offPanel', 'barePanel']);
        expect(build().panels.map((p) => p.order)).toEqual([0, 1, 2, PRIORITY.length]);
    });

    it('uses the injected lookup', () => {
        const cat = build({ lookup: (ct) => ({ title: `T:${ct}`, icon: '*' }) });
        expect(cat.panels.every((p) => p.title === `T:${p.componentType}` && p.icon === '*')).toBe(true);
    });

    it('the default lookup is entry.moduleInfo, then componentClass.moduleInfo, then null', () => {
        const m = fixture();
        expect(lookupModuleInfo('entryPanel', m.get('entryPanel'))).toBe(m.get('entryPanel').moduleInfo);
        expect(lookupModuleInfo('classPanel', m.get('classPanel'))).toBe(ClassInfoPanel.moduleInfo);
        expect(lookupModuleInfo('barePanel', m.get('barePanel'))).toBeNull();
    });
});

describe('buildCatalog — docs and virtual groups', () => {
    it('docs are every indexed doc, by path (a stored ref to any of them resolves)', () => {
        expect(build().docs.map((d) => d.path)).toEqual([...DOCS.map((d) => d.path)].sort());
    });

    it('help draws the user sections, in order, paths resolved; a path the index lacks is dropped', () => {
        const cat = build({ helpSections: SECTIONS });
        expect(cat.help.map((s) => s.dir)).toEqual(['user', 'games']);
        expect(cat.help[0].docs.map((d) => d.title)).toEqual(['Overview', 'Quick Start']);
        expect(cat.help[1].children[0].docs[0]).toBe(cat.docs.find((d) => d.path === 'docs/json/games/one/README.md'));
        expect(helpDocs(cat).map((d) => d.title)).toEqual(['Overview', 'Quick Start', 'One']);
    });

    it('showDeveloperDocs adds the developer sections; the panel audience is never drawn', () => {
        const cat = build({ helpSections: SECTIONS, showDeveloperDocs: true });
        expect(cat.help.map((s) => s.dir)).toEqual(['user', 'games', 'dev']);
        expect(drawnHelpSections(SECTIONS, true).some((s) => s.audience === 'panel')).toBe(false);
        expect(drawnHelpSections(HELP_SECTIONS).map((s) => s.label)).toEqual(['User Guides', 'Features', 'Playable Games']);
    });

    it('virtualGroups is All panels (split by category) then Help (split by section)', () => {
        const cat = build({ helpSections: SECTIONS });
        const groups = virtualGroups(cat);
        expect(groups.map((g) => g.id)).toEqual([VIRTUAL_GROUPS.allPanels.id, VIRTUAL_GROUPS.help.id]);
        expect(groups[0].items).toBeUndefined();
        expect(groups[0].groups.flatMap((g) => g.items)).toEqual(cat.panels); // nothing declares one: all Other
        expect(groups[1].items).toBeUndefined();
        expect(groups[1].groups.map((g) => [g.id, g.label, g.items.length, g.groups.length])).toEqual([
            [helpGroupId('user'), 'User Guides', 2, 0],
            [helpGroupId('games'), 'Games', 1, 0], // a single child is a row, not a sub-group
        ]);
    });
});

describe('categories', () => {
    const ORDER = ['Alpha Modules', 'Beta Modules', 'Gamma Modules'];
    const withCategories = () => {
        const m = fixture();
        m.get('entryPanel').moduleInfo.category = 'Beta Modules';
        m.get('offPanel').moduleInfo.category = 'Alpha Modules';
        m.get('barePanel').moduleInfo = { category: 'Beta Modules' };
        ClassInfoPanel.moduleInfo.category = 'No Such Section';
        return m;
    };
    const grouped = () => {
        const cat = build({ panelComponents: withCategories() });
        return virtualGroups(cat, ORDER)[0].groups;
    };
    const restore = () => { delete ClassInfoPanel.moduleInfo.category; };

    it('a declared category is carried on the catalog entry; none declared is Other', () => {
        expect(panel(build(), 'entryPanel').category).toBe(OTHER_CATEGORY);
        try {
            expect(panel(build({ panelComponents: withCategories() }), 'entryPanel').category).toBe('Beta Modules');
        } finally { restore(); }
    });

    it('one sub-group per non-empty category, in the given order, Other last', () => {
        try {
            expect(grouped().map((g) => g.label)).toEqual(['Alpha Modules', 'Beta Modules', OTHER_CATEGORY]);
        } finally { restore(); }
    });

    it('load-priority order is kept inside a category', () => {
        try {
            const beta = grouped().find((g) => g.label === 'Beta Modules');
            expect(beta.items.map((p) => p.componentType)).toEqual(['entryPanel', 'barePanel']);
        } finally { restore(); }
    });

    it('an unknown category string lands in Other', () => {
        try {
            const other = grouped().find((g) => g.label === OTHER_CATEGORY);
            expect(other.items.map((p) => p.componentType)).toEqual(['classPanel']);
            expect(other.items[0].category).toBe('No Such Section');
        } finally { restore(); }
    });

    it('Other is left out when every panel declares a listed category', () => {
        const cat = build();
        for (const p of cat.panels) p.category = 'Gamma Modules';
        expect(virtualGroups(cat, ORDER)[0].groups.map((g) => g.label)).toEqual(['Gamma Modules']);
    });

    it('sub-group ids are all-panels/<slug>, one per category', () => {
        expect(categoryGroupId('UI Panel Modules')).toBe('all-panels/ui-panel-modules');
        expect(categoryGroupId('Game and Tool Modules')).toBe('all-panels/game-and-tool-modules');
        const ids = [...CATEGORY_ORDER, OTHER_CATEGORY].map(categoryGroupId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('defaults to the generated CATEGORY_ORDER', () => {
        const cat = build();
        cat.panels.forEach((p, i) => { p.category = CATEGORY_ORDER[i % CATEGORY_ORDER.length]; });
        const labels = virtualGroups(cat)[0].groups.map((g) => g.label);
        expect(labels).toEqual(CATEGORY_ORDER.filter((c) => labels.includes(c)));
    });
});
