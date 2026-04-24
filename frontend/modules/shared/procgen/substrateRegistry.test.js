import { describe, it, expect, beforeEach } from 'vitest';

import { substrateRegistry } from './substrateRegistry.js';

describe('substrateRegistry', () => {
    beforeEach(() => {
        substrateRegistry.clear();
    });

    it('register stores an entry by id', () => {
        const entry = { id: 'maze', panelComponentType: 'mazeRoomPanel' };
        substrateRegistry.register(entry);
        expect(substrateRegistry.get('maze')).toBe(entry);
        expect(substrateRegistry.has('maze')).toBe(true);
    });

    it('getAll returns all registered entries', () => {
        substrateRegistry.register({ id: 'maze' });
        substrateRegistry.register({ id: 'incremental' });
        const all = substrateRegistry.getAll();
        expect(all).toHaveLength(2);
        expect(all.map((e) => e.id).sort()).toEqual(['incremental', 'maze']);
    });

    it('register rejects duplicate ids', () => {
        substrateRegistry.register({ id: 'maze' });
        expect(() => substrateRegistry.register({ id: 'maze' }))
            .toThrow(/already registered/);
    });

    it('register rejects entries without an id', () => {
        expect(() => substrateRegistry.register({})).toThrow(/id must be/);
        expect(() => substrateRegistry.register(null)).toThrow(/must be an object/);
    });

    it('get returns undefined for unknown ids', () => {
        expect(substrateRegistry.get('nonexistent')).toBeUndefined();
        expect(substrateRegistry.has('nonexistent')).toBe(false);
    });
});
