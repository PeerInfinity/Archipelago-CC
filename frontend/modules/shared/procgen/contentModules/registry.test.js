import { describe, it, expect, beforeEach } from 'vitest';
import {
    registerContentModule,
    getContentModule,
    listContentModules,
    hasContentModule,
    _testOnly_clearRegistry,
} from './registry.js';

beforeEach(() => {
    _testOnly_clearRegistry();
});

describe('contentModules registry — registration', () => {
    it('accepts a module with just an id', () => {
        registerContentModule({ id: 'minimal' });
        expect(hasContentModule('minimal')).toBe(true);
        expect(getContentModule('minimal')).toEqual({ id: 'minimal' });
    });

    it('accepts a module with every hook + schema', () => {
        const module = {
            id: 'full',
            generate: () => {},
            serialize: () => ({}),
            deserialize: () => {},
            tickRuntime: () => {},
            validateMove: () => true,
            onMove: () => {},
            render: () => {},
            resetOnEntry: () => {},
            procgenSettingsSchema: { count: { type: 'integer', default: 1 } },
            runtimeSettingsSchema: { speed: { type: 'number', default: 1 } },
        };
        expect(() => registerContentModule(module)).not.toThrow();
        expect(getContentModule('full')).toBe(module);
    });

    it('accepts a module with a partial hook set', () => {
        const module = {
            id: 'partial',
            generate: () => {},
            render: () => {},
            resetOnEntry: () => {},
        };
        expect(() => registerContentModule(module)).not.toThrow();
        expect(getContentModule('partial')).toBe(module);
    });

    it('stores modules by reference (no defensive copy)', () => {
        const module = { id: 'shared', generate: () => 1 };
        registerContentModule(module);
        // Caller can mutate; the registry reflects the change.
        module.generate = () => 2;
        expect(getContentModule('shared').generate()).toBe(2);
    });
});

describe('contentModules registry — validation', () => {
    it('rejects non-object inputs', () => {
        expect(() => registerContentModule(null)).toThrow(/must be an object/);
        expect(() => registerContentModule(undefined)).toThrow(/must be an object/);
        expect(() => registerContentModule('hazard')).toThrow(/must be an object/);
        expect(() => registerContentModule(42)).toThrow(/must be an object/);
    });

    it('rejects missing / non-string / empty id', () => {
        expect(() => registerContentModule({})).toThrow(/non-empty string id/);
        expect(() => registerContentModule({ id: '' })).toThrow(/non-empty string id/);
        expect(() => registerContentModule({ id: 123 })).toThrow(/non-empty string id/);
        expect(() => registerContentModule({ id: null })).toThrow(/non-empty string id/);
    });

    it('rejects duplicate ids', () => {
        registerContentModule({ id: 'dup' });
        expect(() => registerContentModule({ id: 'dup' })).toThrow(/duplicate id 'dup'/);
    });

    it('rejects non-function hooks', () => {
        expect(() =>
            registerContentModule({ id: 'a', generate: 'not a fn' }),
        ).toThrow(/'a'\.generate must be a function/);
        expect(() =>
            registerContentModule({ id: 'b', tickRuntime: {} }),
        ).toThrow(/'b'\.tickRuntime must be a function/);
        expect(() =>
            registerContentModule({ id: 'c', render: 42 }),
        ).toThrow(/'c'\.render must be a function/);
    });

    it('rejects non-object schemas', () => {
        expect(() =>
            registerContentModule({ id: 'a', procgenSettingsSchema: 'nope' }),
        ).toThrow(/procgenSettingsSchema must be a plain object/);
        expect(() =>
            registerContentModule({ id: 'b', procgenSettingsSchema: [] }),
        ).toThrow(/procgenSettingsSchema must be a plain object/);
        expect(() =>
            registerContentModule({ id: 'c', runtimeSettingsSchema: null }),
        ).toThrow(/runtimeSettingsSchema must be a plain object/);
    });

    it('allows undefined hooks / schemas without complaint', () => {
        expect(() =>
            registerContentModule({
                id: 'opts',
                generate: undefined,
                procgenSettingsSchema: undefined,
            }),
        ).not.toThrow();
    });

    it('treats every documented hook as optional', () => {
        // No hooks at all is valid — useful for module stubs / tests.
        expect(() => registerContentModule({ id: 'bare' })).not.toThrow();
        expect(getContentModule('bare')).toEqual({ id: 'bare' });
    });
});

describe('contentModules registry — lookups', () => {
    it('hasContentModule returns false for missing ids', () => {
        expect(hasContentModule('nope')).toBe(false);
    });

    it('hasContentModule returns true after register', () => {
        registerContentModule({ id: 'hazard' });
        expect(hasContentModule('hazard')).toBe(true);
    });

    it('getContentModule returns null for missing ids', () => {
        expect(getContentModule('nope')).toBeNull();
    });

    it('listContentModules returns insertion order', () => {
        registerContentModule({ id: 'first' });
        registerContentModule({ id: 'second' });
        registerContentModule({ id: 'third' });
        const all = listContentModules();
        expect(all.map((m) => m.id)).toEqual(['first', 'second', 'third']);
    });

    it('listContentModules returns a fresh array each call', () => {
        registerContentModule({ id: 'a' });
        const a = listContentModules();
        a.push({ id: 'tampered' });
        expect(listContentModules().map((m) => m.id)).toEqual(['a']);
    });

    it('listContentModules returns an empty array when registry is empty', () => {
        expect(listContentModules()).toEqual([]);
    });
});

describe('contentModules registry — _testOnly_clearRegistry', () => {
    it('clears every registered module', () => {
        registerContentModule({ id: 'a' });
        registerContentModule({ id: 'b' });
        expect(listContentModules()).toHaveLength(2);
        _testOnly_clearRegistry();
        expect(listContentModules()).toHaveLength(0);
        expect(hasContentModule('a')).toBe(false);
    });

    it('allows re-registering after clear', () => {
        registerContentModule({ id: 'a', generate: () => 1 });
        _testOnly_clearRegistry();
        expect(() =>
            registerContentModule({ id: 'a', generate: () => 2 }),
        ).not.toThrow();
        expect(getContentModule('a').generate()).toBe(2);
    });
});
