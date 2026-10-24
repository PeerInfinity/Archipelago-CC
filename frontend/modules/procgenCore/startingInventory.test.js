/**
 * procgenCore/startingInventory — **THE `startingInventory` SLOT, ASKED OF THE
 * REAL REGISTRY** (APWORLD SUBSTRATE CHANGE R3).
 *
 * ⛓ The libraries are the capability-matrix generator's (`REGISTRY_LIBRARIES`,
 * derived — trap 574), loaded at module scope as `sidecarFieldsRegistry.test.js`
 * does. ⛔ THE POPULATION IS EVERY REGISTERED ENTRY, not "entries with the
 * slot": a row that selected the declaring entries would filter its own mutant
 * out.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    STARTING_INVENTORY_SLOT, declaredStartingNeeds, startingInventoryErrors, startingInventoryNeeds,
} from './startingInventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ENTRIES = substrateRegistry.getAll();
/** The names an entry carries as its own vocabulary: its library items and drift items. */
const vocabularyOf = (e) => new Set([...Object.keys(e.libraryItems ?? {}), ...(e.driftItems ?? [])]);

describe('⛓⛓ the declarations in the registry', () => {
    it('the population is every registered entry, and at least one declares the slot', () => {
        expect(ENTRIES.length).toBeGreaterThan(6);
        expect(ENTRIES.filter((e) => e[STARTING_INVENTORY_SLOT] !== undefined).length).toBeGreaterThan(0);
    });

    it.each(ENTRIES.map((e) => [e.id, e]))('%s: the declaration, when present, is well formed and names only '
        + 'items the entry itself carries (libraryItems ∪ driftItems)', (_id, entry) => {
        expect(startingInventoryErrors(entry)).toEqual([]);
        const vocab = vocabularyOf(entry);
        for (const need of declaredStartingNeeds(entry)) {
            for (const name of need.anyOf) expect(vocab.has(name), `${entry.id} needs "${name}" it does not carry`).toBe(true);
        }
    });

    it.each(ENTRIES.filter((e) => typeof e.prepareSphereGrowth === 'function').map((e) => [e.id, e]))(
        '⛓ %s: what prepareSphereGrowth GRANTS meets every declared need — the two say one fact',
        (_id, entry) => {
            const itemPool = Object.fromEntries([...vocabularyOf(entry)].map((n) => [n, 1]));
            for (const seed of [1, 2, 3, 4, 5]) {
                const out = entry.prepareSphereGrowth({ itemPool, quotas: { [entry.id]: 1 }, seed, substrateId: entry.id });
                const granted = out?.startingItems ?? [];
                const needs = startingInventoryNeeds(entry, granted);
                // ⛓ "One fact" both ways. A hook that GRANTS nothing (flash_seedling's only
                // resets its placed-room set — seedling-pipeline T3) must declare NO need;
                // a hook that grants must declare the need its grant meets.
                if (granted.length === 0) {
                    expect(needs, `seed ${seed}: the entry grants nothing yet declares a need`).toEqual([]);
                    continue;
                }
                expect(needs.length, 'the entry grants a starting item but declares no need').toBeGreaterThan(0);
                expect(needs.every((n) => n.met), `seed ${seed}: granted ${granted}`).toBe(true);
            }
        },
    );
});

describe('startingInventoryNeeds / startingInventoryErrors', () => {
    const entry = { id: 'x', [STARTING_INVENTORY_SLOT]: { needs: [{ anyOf: ['A', 'B'], reason: 'why' }] } };

    it('⛓ none held → unmet; one held → met with its name; the first declared wins when both are', () => {
        expect(startingInventoryNeeds(entry, [])).toEqual([{ anyOf: ['A', 'B'], reason: 'why', met: false, heldName: null }]);
        expect(startingInventoryNeeds(entry, ['C', 'B'])[0]).toMatchObject({ met: true, heldName: 'B' });
        expect(startingInventoryNeeds(entry, ['B', 'A'])[0]).toMatchObject({ met: true, heldName: 'A' });
    });

    it('⛓ an entry without the slot needs nothing', () => {
        expect(startingInventoryNeeds({ id: 'y' }, ['A'])).toEqual([]);
        expect(startingInventoryErrors({ id: 'y' })).toEqual([]);
    });

    it('⛔ a malformed declaration is named and needs nothing', () => {
        expect(startingInventoryErrors({ [STARTING_INVENTORY_SLOT]: ['A'] })).toHaveLength(1);
        const bad = { [STARTING_INVENTORY_SLOT]: { needs: [{ anyOf: [], reason: '' }] } };
        expect(startingInventoryErrors(bad)).toHaveLength(2);
        expect(startingInventoryNeeds(bad, ['A'])).toEqual([]);
    });
});
