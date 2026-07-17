import { afterEach, describe, expect, it } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { JTA_VANILLA_DATASET } from './vanillaDataset.js';
import { stampDatasetIdentity } from './datasetValidator.js';
import { setJtaDataset, substrateRegistryEntry } from './jtaSubstrateWrapperLibrary.js';

// The library registers on import (side effect) — same pattern the
// maze / textAdventure / omsi libraries use.

describe('jta sharing declaration (cross-game P1 slice 1)', () => {
    afterEach(() => {
        setJtaDataset(null);
    });

    it('is registered on import under id "jta"', () => {
        expect(substrateRegistry.has('jta')).toBe(true);
        expect(substrateRegistry.get('jta')).toBe(substrateRegistryEntry);
    });

    it('declares mana and items, nothing else', () => {
        expect(Object.keys(substrateRegistryEntry.sharing).sort()).toEqual(['items', 'mana']);
        expect(typeof substrateRegistryEntry.sharing.items.getTypes).toBe('function');
        expect(substrateRegistryEntry.sharing.items.types).toBeUndefined();
    });

    it('getTypes returns the vanilla item names minus the behavior-slotted artifacts', () => {
        const types = substrateRegistryEntry.sharing.items.getTypes();
        const artifacts = JTA_VANILLA_DATASET.items
            .filter((it) => it.behavior != null)
            .map((it) => it.name);
        expect(artifacts).toHaveLength(4); // the 4 behavior-slotted artifacts
        expect(types).toHaveLength(JTA_VANILLA_DATASET.items.length - artifacts.length);
        expect(types).toContain('Food');
        for (const name of artifacts) expect(types).not.toContain(name);
        // Well-formed for grant validation: non-empty unique strings.
        expect(types.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
        expect(new Set(types).size).toBe(types.length);
    });

    it('getTypes tracks the ACTIVE dataset (dataset worlds rename items)', () => {
        const doc = structuredClone(JTA_VANILLA_DATASET);
        const foodIdx = doc.items.findIndex((it) => it.name === 'Food');
        doc.items[foodIdx].name = 'Space Rations';
        stampDatasetIdentity(doc);
        setJtaDataset(doc);
        const types = substrateRegistryEntry.sharing.items.getTypes();
        expect(types).toContain('Space Rations');
        expect(types).not.toContain('Food');

        setJtaDataset(null);
        expect(substrateRegistryEntry.sharing.items.getTypes()).toContain('Food');
    });
});
