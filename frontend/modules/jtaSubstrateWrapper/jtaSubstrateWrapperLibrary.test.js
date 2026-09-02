import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { validateEntry } from '../shared/actionQueue/actionTypes.js';
import { JTA_VANILLA_DATASET } from './vanillaDataset.js';
import { stampDatasetIdentity } from './datasetValidator.js';
import {
    setJtaDataset,
    substrateRegistryEntry,
    convertPerformedActionsToQueue,
    ingestVisitRecording,
    noteCatalogNames,
    takeLastVisitRecording,
    _testOnly_clearActionNames,
} from './jtaSubstrateWrapperLibrary.js';

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

describe('jta per-visit recording converter (M4 fine-grained)', () => {
    it('converts a coalesced task rep-run to one clickTask with loops=reps', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'task', name: 'Chop Wood', task_id: 12, zone_id: 3, reps: 5 },
        ]);
        expect(out).toHaveLength(1);
        // ⛔ NO entryId and NO label (format slice Q-a, A1/A8): a recording has
        // to be byte-identical to a second capture of the same visit, and the
        // name is derived by describeAction rather than stored.
        expect(out[0]).toEqual({
            substrate: 'jta',
            actionType: 'clickTask',
            actionId: 12,
            loops: 5,
            disabled: false,
        });
    });

    it('converts an item use to one useItem with actionId=ItemType and loops=count', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'item', name: 'Food', item: 7, count: 3, zone_id: 3 },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]).toEqual({
            substrate: 'jta',
            actionType: 'useItem',
            actionId: 7,
            loops: 3,
            disabled: false,
        });
    });

    it('preserves interleaved order across tasks and items', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'task', name: 'A', task_id: 1, reps: 2 },
            { type: 'item', name: 'Potion', item: 4, count: 1 },
            { type: 'task', name: 'B', task_id: 2, reps: 1 },
        ]);
        expect(out.map((e) => e.actionType)).toEqual(['clickTask', 'useItem', 'clickTask']);
        expect(out.map((e) => e.actionId)).toEqual([1, 4, 2]);
    });

    it('defaults a missing/zero rep-count to 1 (never a zero-loop entry)', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'task', name: 'A', task_id: 1 },
            { type: 'item', name: 'P', item: 2 },
        ]);
        expect(out[0].loops).toBe(1);
        expect(out[1].loops).toBe(1);
    });

    it('skips malformed entries (no task_id / no item) rather than emitting bad actions', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'task', name: 'no id' },
            { type: 'item', name: 'no item' },
            { type: 'task', name: 'ok', task_id: 9, reps: 1 },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].actionId).toBe(9);
    });

    it('returns [] for non-array input', () => {
        expect(convertPerformedActionsToQueue(null)).toEqual([]);
        expect(convertPerformedActionsToQueue(undefined)).toEqual([]);
    });

    it('mints NO entry ids — two captures of the same visit are byte-identical', () => {
        const visit = [
            { type: 'task', name: 'A', task_id: 1, reps: 1 },
            { type: 'item', name: 'Food', item: 7, count: 2 },
        ];
        // Run TWICE rather than reasoning about it: a wall-clock id would make
        // these differ and no byte-identity gate could ever be written.
        const first = JSON.stringify(convertPerformedActionsToQueue(visit));
        const second = JSON.stringify(convertPerformedActionsToQueue(visit));
        expect(second).toBe(first);
        expect(first).not.toMatch(/entryId/);
    });

    it('every entry carries its substrate, so a viewer can tell whose move it is', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'task', name: 'A', task_id: 1, reps: 1 },
            { type: 'item', name: 'Food', item: 7, count: 2 },
        ]);
        expect(out.map((e) => e.substrate)).toEqual(['jta', 'jta']);
    });

    it('every converted entry is a LEGAL shared entry', () => {
        const out = convertPerformedActionsToQueue([
            { type: 'task', name: 'A', task_id: 1, reps: 1 },
            { type: 'item', name: 'Food', item: 7, count: 2 },
        ]);
        for (const entry of out) expect(validateEntry(entry)).toBeNull();
    });
});

describe('jta describeAction — the labeller that replaced the stored label (A8)', () => {
    beforeEach(() => { _testOnly_clearActionNames(); });

    it('gives back the labels the converter used to store, over one recording', () => {
        const visit = [
            { type: 'task', name: 'Chop Wood', task_id: 12, reps: 5 },
            { type: 'item', name: 'Food', item: 7, count: 3 },
        ];
        const out = convertPerformedActionsToQueue(visit);
        expect(out.map((e) => substrateRegistryEntry.describeAction(e)))
            .toEqual(['Chop Wood', 'Food']);
    });

    it('can be fed from an action CATALOGUE instead of a capture', () => {
        noteCatalogNames({
            tasks: [{ actionType: 'clickTask', actionId: 4, label: 'Buy Glasses' }],
            items: [{ actionType: 'useItem', actionId: 2, label: 'Potion' }],
        });
        expect(substrateRegistryEntry.describeAction({ actionType: 'clickTask', actionId: 4 }))
            .toBe('Buy Glasses');
        expect(substrateRegistryEntry.describeAction({ actionType: 'useItem', actionId: 2 }))
            .toBe('Potion');
    });

    it('names an unknown id rather than returning nothing', () => {
        expect(substrateRegistryEntry.describeAction({ actionType: 'clickTask', actionId: 99 }))
            .toBe('clickTask 99');
        expect(substrateRegistryEntry.describeAction(null)).toBe('');
    });
});

describe('jta per-visit recording stash (M4 sole-persister pull)', () => {
    it('takeLastRecording pulls-and-clears the last ingested recording', () => {
        ingestVisitRecording({
            region: 'r1',
            departureExitId: 'east',
            actions: [{ type: 'task', name: 'A', task_id: 1, reps: 2 }],
        });
        const rec = takeLastVisitRecording();
        expect(rec.departureExitId).toBe('east');
        expect(rec.actions).toHaveLength(1);
        expect(rec.actions[0].actionType).toBe('clickTask');
        // Pull-once: a second take returns null (can't be re-pulled by a later block).
        expect(takeLastVisitRecording()).toBeNull();
    });

    it('the registry entry exposes takeLastRecording delegating to the stash', () => {
        ingestVisitRecording({ region: 'r2', departureExitId: null, actions: [] });
        const rec = substrateRegistryEntry.takeLastRecording();
        expect(rec).toMatchObject({ departureExitId: null, actions: [] });
        expect(substrateRegistryEntry.takeLastRecording()).toBeNull();
    });

    it('a later ingest overwrites an un-pulled recording', () => {
        ingestVisitRecording({ region: 'r1', departureExitId: 'a', actions: [] });
        ingestVisitRecording({ region: 'r1', departureExitId: 'b', actions: [] });
        expect(takeLastVisitRecording().departureExitId).toBe('b');
    });
});
