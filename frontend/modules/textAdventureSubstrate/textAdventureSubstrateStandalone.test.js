import { describe, it, expect } from 'vitest';

import {
    synthesizeStandaloneWorld,
    resolveCustomDataUrl,
    customDataUrlForGame,
    pickAutoLoadCustomDataUrl,
} from './textAdventureSubstrateStandalone.js';

describe('synthesizeStandaloneWorld', () => {
    it('returns null for null / undefined input', () => {
        expect(synthesizeStandaloneWorld(null)).toBeNull();
        expect(synthesizeStandaloneWorld(undefined)).toBeNull();
    });

    it('builds exits with side: null and access_rule preserved', () => {
        const region = {
            name: 'Overworld',
            exits: [
                { name: 'east_door', connected_region: 'Cave', access_rule: { has: ['key'] } },
                { name: 'north_path', connected_region: 'Forest' },
            ],
            locations: [],
        };
        const w = synthesizeStandaloneWorld(region);
        expect(w.region_id).toBe('Overworld');
        expect(w.mode).toBe('standalone');
        const e1 = w.exits.get('east_door');
        expect(e1.exit_id).toBe('east_door');
        expect(e1.exitName).toBe('east_door');
        expect(e1.targetRegion).toBe('Cave');
        expect(e1.access_rule).toEqual({ has: ['key'] });
        expect(e1.side).toBeNull();
        expect(w.exits.get('north_path').access_rule).toBeNull();
    });

    it('synthesises loc:<i> posKeys for locations and tracks access_rule by name', () => {
        const region = {
            name: 'X',
            exits: [],
            locations: [
                { name: 'Slay Yorgle', item: { name: 'Sword' }, access_rule: { has: ['shield'] } },
                { name: 'Bridge Key', item: null },
            ],
        };
        const w = synthesizeStandaloneWorld(region);
        expect(w.items.get('loc:0')).toBe('Sword');
        expect(w.items.get('loc:1')).toBeNull();
        expect(w.itemLocationNames.get('loc:0')).toBe('Slay Yorgle');
        expect(w.itemLocationNames.get('loc:1')).toBe('Bridge Key');
        expect(w.locationAccessRules.get('Slay Yorgle')).toEqual({ has: ['shield'] });
        expect(w.locationAccessRules.get('Bridge Key')).toBeNull();
    });

    it('skips exits / locations with no name', () => {
        const w = synthesizeStandaloneWorld({
            name: 'X',
            exits: [{ connected_region: 'A' }, null, { name: 'real', connected_region: 'B' }],
            locations: [{ item: { name: 'X' } }, null, { name: 'real_loc' }],
        });
        expect(w.exits.size).toBe(1);
        expect(w.exits.has('real')).toBe(true);
        expect(w.itemLocationNames.size).toBe(1);
        expect(w.itemLocationNames.get('loc:0')).toBe('real_loc');
    });

    it('always emits empty obstacles + obstacleLib (procgen-only)', () => {
        const w = synthesizeStandaloneWorld({ name: 'X', exits: [], locations: [] });
        expect(w.obstacles.size).toBe(0);
        expect(w.obstacleLib).toEqual({});
    });
});

describe('resolveCustomDataUrl', () => {
    it('returns null for empty / non-string input', () => {
        expect(resolveCustomDataUrl('')).toBeNull();
        expect(resolveCustomDataUrl('   ')).toBeNull();
        expect(resolveCustomDataUrl(null)).toBeNull();
        expect(resolveCustomDataUrl(undefined)).toBeNull();
        expect(resolveCustomDataUrl(42)).toBeNull();
    });

    it('expands a bare name to the legacy customData path', () => {
        expect(resolveCustomDataUrl('adventure'))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
    });

    it('passes a path through verbatim', () => {
        expect(resolveCustomDataUrl('./my/data.json')).toBe('./my/data.json');
        expect(resolveCustomDataUrl('/abs/path.json')).toBe('/abs/path.json');
    });

    it('passes a URL through verbatim', () => {
        expect(resolveCustomDataUrl('http://example.com/data.json'))
            .toBe('http://example.com/data.json');
        expect(resolveCustomDataUrl('https://example.com/data.json'))
            .toBe('https://example.com/data.json');
    });

    it('trims whitespace before classifying', () => {
        expect(resolveCustomDataUrl('  adventure  '))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
    });
});

describe('customDataUrlForGame', () => {
    it('lowercases the game name and slots into the conventional path', () => {
        expect(customDataUrlForGame('Adventure'))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
        expect(customDataUrlForGame('TUNIC'))
            .toBe('./modules/shared/customData/tunic_textadventure.json');
    });

    it('returns null for empty / non-string input', () => {
        expect(customDataUrlForGame(null)).toBeNull();
        expect(customDataUrlForGame(undefined)).toBeNull();
        expect(customDataUrlForGame('')).toBeNull();
        expect(customDataUrlForGame('   ')).toBeNull();
        expect(customDataUrlForGame(42)).toBeNull();
    });
});

describe('pickAutoLoadCustomDataUrl', () => {
    const adventureRules = { world: { 1: { game: 'Adventure' } } };

    it('explicit setting wins when set', () => {
        expect(pickAutoLoadCustomDataUrl(adventureRules, '1', 'tunic'))
            .toBe('./modules/shared/customData/tunic_textadventure.json');
        expect(pickAutoLoadCustomDataUrl(adventureRules, '1', 'http://example/x.json'))
            .toBe('http://example/x.json');
    });

    it('falls back to game-name auto-detect when setting is empty', () => {
        expect(pickAutoLoadCustomDataUrl(adventureRules, '1', ''))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
        expect(pickAutoLoadCustomDataUrl(adventureRules, '1', null))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
    });

    it('reads from the correct player slot', () => {
        const rules = { world: { 1: { game: 'A' }, 2: { game: 'B' } } };
        expect(pickAutoLoadCustomDataUrl(rules, '2', ''))
            .toBe('./modules/shared/customData/b_textadventure.json');
    });

    it('returns null when neither setting nor game name is available', () => {
        expect(pickAutoLoadCustomDataUrl(null, '1', '')).toBeNull();
        expect(pickAutoLoadCustomDataUrl({}, '1', '')).toBeNull();
        expect(pickAutoLoadCustomDataUrl({ world: {} }, '1', '')).toBeNull();
    });
});
