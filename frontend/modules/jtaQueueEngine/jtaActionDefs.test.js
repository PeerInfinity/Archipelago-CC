// Tests for buildCatalogFromReport — the substrate path builds its action
// catalog from a live "currently-loaded actions" report rather than a static
// table, so it must reflect exactly what JtA reports for the loaded zone.
import { describe, it, expect } from 'vitest';
import { buildCatalogFromReport, JTAActionType } from './jtaActionDefs.js';

describe('buildCatalogFromReport', () => {
    it('maps reported current-zone tasks to clickTask catalog entries', () => {
        const cat = buildCatalogFromReport({
            zone: 2,
            tasks: [
                { id: 10, name: 'Explore', maxReps: 5 },
                { id: 11, name: 'Fight Monsters', maxReps: 20 },
            ],
            items: [],
        });
        expect(cat.tasks).toEqual([
            { actionType: JTAActionType.CLICK_TASK, actionId: 10, label: 'Explore', group: 'Zone 3', zoneId: 2, maxReps: 5 },
            { actionType: JTAActionType.CLICK_TASK, actionId: 11, label: 'Fight Monsters', group: 'Zone 3', zoneId: 2, maxReps: 20 },
        ]);
        expect(cat.prestige).toEqual([]); // prestige dropped on the substrate
    });

    it('maps reported held items to useItem entries (best-effort labels)', () => {
        const cat = buildCatalogFromReport({ zone: 0, tasks: [], items: [{ type: 4, count: 3 }] });
        expect(cat.items).toEqual([
            { actionType: JTAActionType.USE_ITEM, actionId: 4, label: 'Item 4', group: 'Items' },
        ]);
    });

    it('tolerates a null/empty report', () => {
        expect(buildCatalogFromReport(null)).toEqual({ tasks: [], items: [], prestige: [] });
        expect(buildCatalogFromReport({})).toEqual({ tasks: [], items: [], prestige: [] });
    });
});
