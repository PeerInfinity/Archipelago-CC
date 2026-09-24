import { describe, expect, it } from 'vitest';
import {
    BLANK_ICON, VIRTUAL_GROUPS, buildCatalog, lookupModuleInfo, virtualGroups,
} from './quickLaunchCatalog.js';

class ClassInfoPanel {}
ClassInfoPanel.moduleInfo = { title: 'From Class', icon: '🅲', column: 2 };
class BarePanel {}
class EntryPanel {}
class OffPanel {}

const DOCS = [
    { path: 'docs/json/user/modules/entry.md', title: 'Entry Panel', section: 'user/modules' },
    { path: 'docs/json/user/overview.md', title: 'Overview', section: 'user' },
    { path: 'docs/json/user/quick-start.md', title: 'Quick Start', section: 'user' },
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
    it('docs are the user section first, then user/modules, each by path', () => {
        expect(build().docs.map((d) => d.path)).toEqual([
            'docs/json/user/overview.md', 'docs/json/user/quick-start.md', 'docs/json/user/modules/entry.md',
        ]);
    });

    it('virtualGroups is All panels then Help, holding the catalog lists', () => {
        const cat = build();
        const groups = virtualGroups(cat);
        expect(groups.map((g) => g.id)).toEqual([VIRTUAL_GROUPS.allPanels.id, VIRTUAL_GROUPS.help.id]);
        expect(groups[0].items).toBe(cat.panels);
        expect(groups[1].items).toBe(cat.docs);
    });
});
