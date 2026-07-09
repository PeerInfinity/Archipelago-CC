import { describe, it, expect } from 'vitest';
import { buildOwnPlacements } from './perkOrigin.js';

// staticData as AdapterClient hands it to the bridge: locationItems is a
// Map<locationName, {name, player, ...}|null> and playerId is a STRING, while
// item.player is a NUMBER (see stateManager/core/statePersistence.js).
function staticData(entries, playerId = '1') {
    return { playerId, locationItems: new Map(entries) };
}

const perk = (name, player) => ({ name, player, advancement: true, type: 'None' });

describe('buildOwnPlacements', () => {
    it('returns null when staticData is absent or lacks the fields', () => {
        expect(buildOwnPlacements(null)).toBeNull();
        expect(buildOwnPlacements(undefined)).toBeNull();
        expect(buildOwnPlacements({ playerId: '1' })).toBeNull();
        expect(buildOwnPlacements({ locationItems: new Map() })).toBeNull();
        // locationItems arriving as a plain object (not structured-cloned Map)
        // is not something we can join against — refuse rather than guess.
        expect(buildOwnPlacements({ playerId: '1', locationItems: {} })).toBeNull();
    });

    it('maps each own location to the item name placed on it', () => {
        const own = buildOwnPlacements(staticData([
            ['region_0_0__13', perk('How to Read', 1)],
            ['region_0_0__10', perk('JtA Filler', 1)],
        ]));
        expect(own.byLocation.get('region_0_0__13')).toBe('How to Read');
        expect(own.itemNames).toEqual(new Set(['How to Read', 'JtA Filler']));
    });

    it('compares playerId across the string/number boundary', () => {
        const own = buildOwnPlacements(staticData([['loc', perk('Attunement', 1)]], '1'));
        expect(own.itemNames.has('Attunement')).toBe(true);
    });

    it("excludes another player's item sitting on my location", () => {
        // The two-JtA-slot multiworld: both players own an item named
        // 'Attunement'. The copy on my location is theirs; mine is in their
        // world, so mine must classify as foreign (absent from itemNames).
        const own = buildOwnPlacements(staticData([
            ['region_0_0__13', perk('Attunement', 2)],
            ['region_0_0__14', perk('How to Read', 1)],
        ], '1'));
        expect(own.byLocation.has('region_0_0__13')).toBe(false);
        expect(own.itemNames.has('Attunement')).toBe(false);
        expect(own.itemNames.has('How to Read')).toBe(true);
    });

    it('treats a missing player field as mine (single-player exports)', () => {
        const own = buildOwnPlacements(staticData([
            ['loc', { name: 'How to Write', advancement: true }],
        ]));
        expect(own.itemNames.has('How to Write')).toBe(true);
    });

    it('skips locations with no item, a null item, or a nameless item', () => {
        const own = buildOwnPlacements(staticData([
            ['empty', null],
            ['nameless', { player: 1 }],
            ['blank', perk('', 1)],
            ['real', perk('Mysterious Amulet', 1)],
        ]));
        expect(own.byLocation.size).toBe(1);
        expect(own.byLocation.get('real')).toBe('Mysterious Amulet');
    });
});
