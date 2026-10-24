/**
 * Ported from the deprecated textAdventureSubstrate's
 * textAdventureSubstrateStandalone.test.js (2026-07-26) — the URL-resolution
 * half. The wrapper had the same three functions buried unexported in
 * index.js with no coverage; they now live in customData.js.
 *
 * The other half of the original file covered `synthesizeStandaloneWorld`,
 * which has no wrapper counterpart to port to: the wrapper builds its world
 * inside the iframe (bridge.js `buildWorldFromStaticData`), from staticData
 * rather than from a single region object. Covering that needs an in-app test,
 * not a unit test.
 *
 * These paths matter beyond tidiness: they are how a game gets its prose, and
 * the resolution order is a compatibility contract — users' existing
 * `autoLoadCustomData` settings were written against the deprecated module.
 */
import { describe, it, expect } from 'vitest';

import {
    resolveCustomDataUrl,
    customDataUrlForGame,
    pickAutoLoadCustomDataUrl,
} from './customData.js';

describe('resolveCustomDataUrl', () => {
    it('maps a bare name onto the conventional path', () => {
        expect(resolveCustomDataUrl('adventure'))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
    });

    it('passes through anything containing a slash', () => {
        expect(resolveCustomDataUrl('./custom/mine.json')).toBe('./custom/mine.json');
        expect(resolveCustomDataUrl('/abs/path.json')).toBe('/abs/path.json');
    });

    it('passes through absolute URLs', () => {
        expect(resolveCustomDataUrl('http://example.com/data.json'))
            .toBe('http://example.com/data.json');
        expect(resolveCustomDataUrl('https://example.com/data.json'))
            .toBe('https://example.com/data.json');
    });

    it('trims whitespace before classifying', () => {
        expect(resolveCustomDataUrl('  adventure  '))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
    });

    it('returns null for empty / non-string input', () => {
        expect(resolveCustomDataUrl('')).toBeNull();
        expect(resolveCustomDataUrl('   ')).toBeNull();
        expect(resolveCustomDataUrl(null)).toBeNull();
        expect(resolveCustomDataUrl(undefined)).toBeNull();
        expect(resolveCustomDataUrl(42)).toBeNull();
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

    it('resolves the Adventure preset the textadventure mode actually loads', () => {
        // Not a synthetic case: ?mode=textadventure and the default mode both
        // load presets/adventure, whose rules.json carries game "Adventure",
        // and modules/shared/customData/adventure_textadventure.json exists.
        // This is the end-to-end name→file hop that gives that mode its prose.
        expect(pickAutoLoadCustomDataUrl({ world: { 1: { game: 'Adventure' } } }, '1', ''))
            .toBe('./modules/shared/customData/adventure_textadventure.json');
    });
});
