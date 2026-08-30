/**
 * P1-d — the "found X for Player Y" readout, as state rather than as a log
 * line (EDITOR INTEGRATION slice P1; plan §17.5).
 *
 * ⛓ The panel's DOM is browser-only and P1-e reads the ELEMENT on the real
 * page. These rows are the half that can be asserted anywhere: what the widget
 * SAYS, given the payloads `seedlingRegionGlue._itemFound` publishes.
 */
import { describe, expect, it } from 'vitest';

import { RECENT_LIMIT, createApFoundReadout } from './seedlingRandomizerReadout.js';

/** The payload shape the glue publishes (`seedlingRegionGlue.js:_itemFound`). */
const find = (item, player, forSelf, location) => ({
    location, item, player, forSelf, message: `[ap placement] found ${item}`,
});

describe('the readout', () => {
    it('starts empty and says so in words a person can read', () => {
        const r = createApFoundReadout();
        expect(r.found).toBe(0);
        expect(r.headline()).toMatch(/no Archipelago placements/);
        expect(r.lines()).toEqual([]);
    });

    it('counts, and is SINGULAR at one', () => {
        const r = createApFoundReadout();
        r.record(find('Progressive Sword', 1, true, 'Level 010 - Sword'));
        expect(r.headline()).toBe('1 placement found');
        r.record(find('Seal', 2, false, 'Level 011 - Chest'));
        expect(r.headline()).toBe('2 placements found');
    });

    it('keeps the LAST three, newest first, and names the receiving player', () => {
        const r = createApFoundReadout();
        for (let i = 0; i < 5; i += 1) r.record(find(`Item${i}`, 2, false, `Loc${i}`));
        expect(r.recent).toHaveLength(RECENT_LIMIT);
        expect(r.lines()).toEqual([
            'Item4 → Player 2 @ Loc4',
            'Item3 → Player 2 @ Loc3',
            'Item2 → Player 2 @ Loc2',
        ]);
    });

    it('says "you" for this slot\'s own item', () => {
        const r = createApFoundReadout();
        r.record(find('Wand', 1, true, 'Level 043 - Wand'));
        expect(r.lines()[0]).toBe('Wand → you @ Level 043 - Wand');
    });

    /**
     * ⛔ A PAYLOAD IT CANNOT RENDER IS NOT COUNTED. The headline and the rows
     * are two views of one list; a find counted but not shown makes them
     * disagree, which is the one way a readout actively misleads.
     */
    it('refuses a payload with no location or no item, and the count does not move', () => {
        const r = createApFoundReadout();
        expect(r.record({ item: 'Wand' })).toBe(false);
        expect(r.record({ location: 'Level 043 - Wand' })).toBe(false);
        expect(r.record()).toBe(false);
        expect(r.found).toBe(0);
        expect(r.lines()).toEqual([]);
    });

    it('a limit of one keeps only the newest', () => {
        const r = createApFoundReadout({ limit: 1 });
        r.record(find('A', 1, true, 'L1'));
        r.record(find('B', 1, true, 'L2'));
        expect(r.lines()).toEqual(['B → you @ L2']);
        expect(r.found).toBe(2);
    });
});
