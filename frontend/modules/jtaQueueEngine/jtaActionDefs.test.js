// Tests for buildCatalogFromReport — the substrate path builds its action
// catalog from a live "currently-loaded actions" report rather than a static
// table, so it must reflect exactly what JtA reports for the loaded zone.
import { describe, it, expect } from 'vitest';
import { buildCatalogFromReport, createQueueEntry, JTAActionType } from './jtaActionDefs.js';

describe('buildCatalogFromReport', () => {
    it('maps all reported zones to clickTask catalog entries grouped by zone name', () => {
        const cat = buildCatalogFromReport({
            zones: [
                { zone: 0, name: 'The Fields', tasks: [{ id: 1, name: 'Explore', maxReps: 5 }] },
                { zone: 1, name: 'Dark Cave', tasks: [
                    { id: 10, name: 'Fight Monsters', maxReps: 20 },
                    { id: 11, name: 'Travel', maxReps: 1 },
                ] },
            ],
            items: [],
        });
        expect(cat.tasks).toEqual([
            { actionType: JTAActionType.CLICK_TASK, actionId: 1, label: 'Explore', group: 'The Fields', zoneId: 0, maxReps: 5 },
            { actionType: JTAActionType.CLICK_TASK, actionId: 10, label: 'Fight Monsters', group: 'Dark Cave', zoneId: 1, maxReps: 20 },
            { actionType: JTAActionType.CLICK_TASK, actionId: 11, label: 'Travel', group: 'Dark Cave', zoneId: 1, maxReps: 1 },
        ]);
        expect(cat.prestige).toEqual([]); // prestige dropped on the substrate
    });

    it('maps reported items to useItem entries with real names, split by artifact flag', () => {
        const cat = buildCatalogFromReport({ zones: [], items: [
            { type: 0, name: 'Food', isArtifact: false },
            { type: 7, name: 'Scroll of Haste', isArtifact: true },
        ] });
        expect(cat.items).toEqual([
            { actionType: JTAActionType.USE_ITEM, actionId: 0, label: 'Food', group: 'Items' },
            { actionType: JTAActionType.USE_ITEM, actionId: 7, label: 'Scroll of Haste', group: 'Artifacts' },
        ]);
    });

    it('falls back to a type label when a name is missing', () => {
        const cat = buildCatalogFromReport({ zones: [], items: [{ type: 4, isArtifact: false }] });
        expect(cat.items[0].label).toBe('Item 4');
    });

    it('tolerates a null/empty report', () => {
        expect(buildCatalogFromReport(null)).toEqual({ tasks: [], items: [], prestige: [] });
        expect(buildCatalogFromReport({})).toEqual({ tasks: [], items: [], prestige: [] });
    });
});

describe('createQueueEntry — the catalogue riders land in params (format slice Q-a)', () => {
    // `zoneId` is jta's zone, not a field of the SHARED shape (plan §23.1 Q3):
    // it rides in `params`, which is also where `taskType` / `maxReps` / `icon`
    // now survive instead of being dropped on the first undoLast (Q2). The jta
    // queue panel's zone column reads `entry.params.zoneId`.
    const catalogEntry = {
        actionType: JTAActionType.CLICK_TASK,
        actionId: 12,
        label: 'Chop Wood',
        group: 'The Fields',
        zoneId: 3,
        taskType: 'normal',
        maxReps: 5,
    };

    it('puts zoneId and the other catalogue riders under params', () => {
        const entry = createQueueEntry(catalogEntry, 4);
        expect(entry.params).toEqual({ zoneId: 3, taskType: 'normal', maxReps: 5 });
        expect(entry.zoneId).toBeUndefined();
    });

    it('keeps the declared fields where they were, and stamps the substrate', () => {
        const entry = createQueueEntry(catalogEntry, 4);
        expect(entry).toMatchObject({
            substrate: 'jta',
            actionType: JTAActionType.CLICK_TASK,
            actionId: 12,
            label: 'Chop Wood',
            group: 'The Fields',
            loops: 4,
            disabled: false,
        });
        expect(typeof entry.entryId).toBe('string');
    });
});
