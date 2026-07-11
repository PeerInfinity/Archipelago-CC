import { describe, it, expect } from 'vitest';
import { buildOwnPlacements, staticDataMatchesRegion } from './perkOrigin.js';

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

describe('staticDataMatchesRegion', () => {
    const apLocations = { 13: 'region_0_0__13', 14: 'region_0_0__14' };
    const sd = (names) => staticData(names.map((n) => [n, perk('x', 1)]));

    it('accepts staticData covering every location of the region', () => {
        expect(staticDataMatchesRegion(
            sd(['region_0_0__13', 'region_0_0__14', 'region_1_0__20']), apLocations)).toBe(true);
    });

    it('rejects staticData from another world (a fresh object with stale content)', () => {
        expect(staticDataMatchesRegion(sd(['other_world__1']), apLocations)).toBe(false);
        // Partial coverage is still the wrong world.
        expect(staticDataMatchesRegion(sd(['region_0_0__13']), apLocations)).toBe(false);
    });

    it('rejects when there is nothing to match against', () => {
        expect(staticDataMatchesRegion(null, apLocations)).toBe(false);
        expect(staticDataMatchesRegion(sd(['region_0_0__13']), null)).toBe(false);
        // A base-scope jta region carries no ap_locations — nothing to verify.
        expect(staticDataMatchesRegion(sd(['region_0_0__13']), {})).toBe(false);
    });
});

// --- The forced perk-category definition (Phase 5e follow-up) ---------------

describe('activePerkItemNames', () => {
    it('derives the dataset perk names from placed perks only', async () => {
        const { activePerkItemNames } = await import('./perkOrigin.js');
        const dataset = {
            zones: [
                { tasks: [{ id: 10, perk: 0 }, { id: 11, perk: null }] },
                { tasks: [{ id: 30, perk: 2 }, { id: 31, perk: 0 }] },
            ],
            perks: [{ name: 'First Light' }, { name: 'Unplaced' }, { name: 'Deep Sight' }],
        };
        expect(activePerkItemNames(dataset)).toEqual(['First Light', 'Deep Sight']);
    });

    it('falls back to the vanilla snapshot when no dataset is given', async () => {
        const { activePerkItemNames } = await import('./perkOrigin.js');
        const names = activePerkItemNames(null);
        expect(names.length).toBeGreaterThan(20);
        expect(names).toContain('How to Read');
    });
});

describe('perkHolderTaskIds / forcedPerkCategoryIds', () => {
    const apLocations = { 13: 'r0__13', 14: 'r0__14', 20: 'r1__20' };
    const perkNames = new Set(['How to Read', 'Attunement']);

    it('joins own placements (bare names) to holder task ids', async () => {
        const { perkHolderTaskIds } = await import('./perkOrigin.js');
        const byLocation = new Map([
            ['r0__13', 'JtA Filler'],
            ['r0__14', 'Attunement'],
            ['r1__20', 'How to Read'],
        ]);
        expect(perkHolderTaskIds({
            apLocations,
            itemAtLocation: (n) => byLocation.get(n),
            perkNames,
        })).toEqual([14, 20]);
    });

    it('applies the player guard to placement objects', async () => {
        const { perkHolderTaskIds } = await import('./perkOrigin.js');
        const byLocation = new Map([
            ['r0__13', { name: 'How to Read', player: 2 }],   // another player's copy
            ['r0__14', { name: 'Attunement', player: 1 }],
            ['r1__20', { name: 'How to Read' }],              // single-player export = mine
        ]);
        expect(perkHolderTaskIds({
            apLocations,
            itemAtLocation: (n) => byLocation.get(n),
            perkNames,
            playerId: '1',
        })).toEqual([14, 20]);
    });

    it('accepts string items (Pass-A presets place items as bare names)', async () => {
        const { perkHolderTaskIds } = await import('./perkOrigin.js');
        expect(perkHolderTaskIds({
            apLocations: { 13: 'r0__13' },
            itemAtLocation: () => 'How to Read',
            perkNames,
        })).toEqual([13]);
    });

    it('unions native and holder legs', async () => {
        const { forcedPerkCategoryIds } = await import('./perkOrigin.js');
        expect(forcedPerkCategoryIds([13, 15], [14, 15])).toEqual(new Set([13, 14, 15]));
        expect(forcedPerkCategoryIds(null, [1])).toEqual(new Set([1]));
    });
});
