import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    registerBackend, getBackend, listBackends, hasBackend,
    _testOnly_clearRegistry,
} from './registry.js';

// The maze module's import re-registers backends on next import; tests
// in this file work in isolation by clearing the registry before each
// case and re-registering only what they need.

describe('mazeAlgorithms registry', () => {
    let savedSnapshot;

    beforeEach(() => {
        savedSnapshot = listBackends();
        _testOnly_clearRegistry();
    });

    afterEach(() => {
        // Restore real backends for downstream test files in the same
        // run that depend on the registry being populated.
        _testOnly_clearRegistry();
        for (const b of savedSnapshot) registerBackend(b);
    });

    it('registers and retrieves a backend by id', () => {
        const fake = { id: 'fake', name: 'Fake', cellStep: 1, run: () => ({}) };
        registerBackend(fake);
        expect(getBackend('fake')).toBe(fake);
        expect(hasBackend('fake')).toBe(true);
    });

    it('returns null for unknown id', () => {
        expect(getBackend('nope')).toBeNull();
        expect(hasBackend('nope')).toBe(false);
    });

    it('lists every registered backend', () => {
        const a = { id: 'a', run: () => ({}) };
        const b = { id: 'b', run: () => ({}) };
        registerBackend(a);
        registerBackend(b);
        expect(listBackends()).toEqual([a, b]);
    });

    it('rejects backend without an id', () => {
        expect(() => registerBackend({ run: () => ({}) })).toThrow();
    });

    it('rejects backend without a run function', () => {
        expect(() => registerBackend({ id: 'noRun' })).toThrow();
    });

    it('rejects duplicate ids', () => {
        registerBackend({ id: 'dup', run: () => ({}) });
        expect(() => registerBackend({ id: 'dup', run: () => ({}) })).toThrow();
    });
});
