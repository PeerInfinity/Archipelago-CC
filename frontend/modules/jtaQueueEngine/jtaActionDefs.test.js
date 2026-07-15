// Tests for buildCatalogFromReport — the substrate path builds its action
// catalog from a live "currently-loaded actions" report rather than a static
// table, so it must reflect exactly what JtA reports for the loaded zone.
import { describe, it, expect } from 'vitest';
import { buildCatalogFromReport, JTAActionType } from './jtaActionDefs.js';

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

    it('maps reported held items to useItem entries (best-effort labels)', () => {
        const cat = buildCatalogFromReport({ zones: [], items: [{ type: 4, count: 3 }] });
        expect(cat.items).toEqual([
            { actionType: JTAActionType.USE_ITEM, actionId: 4, label: 'Item 4', group: 'Items' },
        ]);
    });

    it('tolerates a null/empty report', () => {
        expect(buildCatalogFromReport(null)).toEqual({ tasks: [], items: [], prestige: [] });
        expect(buildCatalogFromReport({})).toEqual({ tasks: [], items: [], prestige: [] });
    });
});
