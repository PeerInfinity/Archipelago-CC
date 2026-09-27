/**
 * menuPanelEngine.test.js — the panel's whole derivation, driven on real
 * committed documents and on hand-built edge cases.
 *
 * ⛓ WHAT THESE ROWS PROVE. Everything the panel shows is a function of
 * (document, playerId, currentRegion): the game name and seed, the declared
 * start regions, and ONE ENTRY PER EXIT of the start region the player stands
 * in. Two real presets are read off disk rather than mocked — `alttp`, whose
 * three Save-and-Quit warps are the multi-start case the ruling names, and
 * `adventure`, the single-exit shape 200+ presets share.
 *
 * ⛔ WHAT THEY REFUSE TO PROVE. Nothing about the eventBus, the dispatcher, the
 * setting, or the DOM — this file is the pure half. Whether the right module
 * PUBLISHES the hop is `index.js`'s rows and the in-app battery's.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    MENU_PANEL_MODULE_ID,
    MENU_PANEL_COMPONENT_TYPE,
    SKIP_MENU_SETTING_PATH,
    SKIP_MENU_DEFAULT,
    MOVE_SOURCE_EXIT,
    MOVE_SOURCE_START,
    MOVE_SOURCE_RESTART,
    describeMenu,
    exitsOf,
    firstExitOf,
    procgenOwnsStartHop,
    restartTargetOf,
    skipsStart,
} from './menuPanelEngine.js';

const PRESET = (game) =>
    JSON.parse(readFileSync(
        new URL(`../../presets/${game}/AP_14089154938208861744/AP_14089154938208861744_rules.json`, import.meta.url),
        'utf-8',
    ));

describe('⛓ menuPanelEngine — the constants other files key on', () => {
    it('derives the setting path from the module id, and defaults to skipping', () => {
        expect(SKIP_MENU_SETTING_PATH).toBe(`moduleSettings.${MENU_PANEL_MODULE_ID}.skipMenu`);
        expect(SKIP_MENU_DEFAULT).toBe(true);
    });

    it('stamps every move source with the module id — that PREFIX is what isLoopModePlanningSource matches', () => {
        for (const source of [MOVE_SOURCE_EXIT, MOVE_SOURCE_START, MOVE_SOURCE_RESTART]) {
            expect(source.startsWith(MENU_PANEL_MODULE_ID)).toBe(true);
        }
        expect(new Set([MOVE_SOURCE_EXIT, MOVE_SOURCE_START, MOVE_SOURCE_RESTART]).size).toBe(3);
        expect(MENU_PANEL_COMPONENT_TYPE).toBe(MENU_PANEL_MODULE_ID);
    });
});

describe("⛓ menuPanelEngine — alttp's three starts ARE three exits", () => {
    const doc = PRESET('alttp');
    const start = doc.start_regions['1'].default[0];

    it('one entry per exit, in document order, labelled by the exit name', () => {
        const content = describeMenu(doc, '1', start);
        expect(content.atStartRegion).toBe(true);
        expect(content.exits).toEqual([
            { name: 'Links House S&Q', targetRegion: 'Links House' },
            { name: 'Sanctuary S&Q', targetRegion: 'Sanctuary' },
            { name: 'Old Man S&Q', targetRegion: 'Old Man House' },
        ]);
    });

    it('shows the game name and seed straight out of the document', () => {
        const content = describeMenu(doc, '1', start);
        expect(content.gameName).toBe(doc.game_name);
        expect(content.seedName).toBe(String(doc.seed_name));
        expect(content.startRegions).toEqual([start]);
    });

    it('the skip hop takes the FIRST exit', () => {
        expect(firstExitOf(doc, '1', start)).toEqual({ name: 'Links House S&Q', targetRegion: 'Links House' });
    });

    it('away from the start region there are no exit buttons — only Restart applies', () => {
        const content = describeMenu(doc, '1', 'Links House');
        expect(content.atStartRegion).toBe(false);
        expect(content.exits).toEqual([]);
        // ...but the declared start is still reported, so the panel can say where back is.
        expect(content.startRegions).toEqual([start]);
    });
});

describe('⛓ menuPanelEngine — the single-exit shape', () => {
    const doc = PRESET('adventure');
    const start = doc.start_regions['1'].default[0];

    it('one button, and it is the one the skip hop takes', () => {
        const content = describeMenu(doc, '1', start);
        expect(content.exits).toHaveLength(1);
        expect(content.exits[0]).toEqual(firstExitOf(doc, '1', start));
    });
});

describe('⛓ menuPanelEngine — edge cases the presets do not carry', () => {
    it('drops an exit with no destination, and survives a region with none at all', () => {
        const doc = {
            start_regions: { 1: { default: ['Start'], available: [] } },
            regions: { 1: { Start: { exits: [{ name: 'nowhere' }, { name: 'go', connected_region: 'A' }] }, A: {} } },
        };
        expect(exitsOf(doc, '1', 'Start')).toEqual([{ name: 'go', targetRegion: 'A' }]);
        expect(exitsOf(doc, '1', 'A')).toEqual([]);
        expect(firstExitOf(doc, '1', 'A')).toBeNull();
    });

    it('falls back to the destination when the exit has no name', () => {
        const doc = {
            start_regions: { 1: ['Start'] },
            regions: { 1: { Start: { exits: [{ connected_region: 'A' }] } } },
        };
        expect(exitsOf(doc, '1', 'Start')).toEqual([{ name: null, targetRegion: 'A' }]);
    });

    it('reads the ARRAY start_regions shape too (the fixture shape), through the one reader', () => {
        const doc = {
            start_regions: { 1: ['Start'] },
            regions: { 1: { Start: { exits: [{ name: 'x', connected_region: 'A' }] } } },
        };
        expect(describeMenu(doc, '1', 'Start').startRegions).toEqual(['Start']);
    });

    it('an empty / absent document is described, not thrown on', () => {
        const content = describeMenu({}, '1', null);
        expect(content).toEqual({
            gameName: null, seedName: null, startRegions: [],
            currentRegion: null, atStartRegion: false, exits: [],
        });
        expect(describeMenu(undefined, '1', 'Anything').atStartRegion).toBe(false);
    });

    it('a MULTI-start document offers only the region the player is standing in', () => {
        const doc = {
            start_regions: { 1: { default: ['S1', 'S2'], available: [] } },
            regions: {
                1: {
                    S1: { exits: [{ name: 'a', connected_region: 'A' }] },
                    S2: { exits: [{ name: 'b', connected_region: 'B' }] },
                },
            },
        };
        expect(describeMenu(doc, '1', 'S2').exits).toEqual([{ name: 'b', targetRegion: 'B' }]);
        expect(describeMenu(doc, '1', 'S2').startRegions).toEqual(['S1', 'S2']);
    });
});

describe('⛓ menuPanelEngine — who owns the start hop, and where Restart goes', () => {
    it('procgen owns it exactly when getResolvedStartRegion() answered', () => {
        expect(procgenOwnsStartHop('region_0_0')).toBe(true);
        expect(procgenOwnsStartHop(null)).toBe(false);
        expect(procgenOwnsStartHop(undefined)).toBe(false);
        // ⛔ NOT "the document has preset_sidecars": a procgen document whose
        // start does not resolve leaves the hop to this panel, and must.
        expect(procgenOwnsStartHop('')).toBe(false);
    });

    /**
     * ⛓ M2 (⚖ user 2026-09-26): Restart = returning to the menu — the DECLARED
     * start, never procgenPlayer's first warehoused region (the argument is gone;
     * `index.test.js` holds the module ignoring a registered resolved start).
     */
    it('Restart returns to the FIRST DECLARED start, always', () => {
        expect(restartTargetOf(['Menu'])).toBe('Menu');
        expect(restartTargetOf(['Menu', 'Other'])).toBe('Menu');
        expect(restartTargetOf([])).toBeNull();
        expect(restartTargetOf()).toBeNull();
    });
});

/**
 * ⛓⛓ M2 — **THE ONE START-HOP RULE** (⚖ user 2026-09-26: *"skipping only when the
 * menu has only one exit"*): skip ON and EXACTLY one exit. Both publishers read
 * it (this panel; procgenPlayer through `isSkipMenuEnabled` + this function).
 */
describe('⛓ menuPanelEngine — skipsStart: the setting AND exactly one exit', () => {
    const doc = (n) => ({
        start_regions: { 1: ['S'] },
        regions: { 1: { S: { exits: Array.from({ length: n }, (_, i) => ({ name: `e${i}`, connected_region: `R${i}` })) } } },
    });
    it.each([
        [0, true, false], [1, true, true], [2, true, false],
        [0, false, false], [1, false, false], [2, false, false],
    ])('%i exit(s), skip %s → %s', (n, skip, want) => {
        expect(skipsStart(doc(n), '1', 'S', skip)).toBe(want);
    });

    it('an exit that names no region is not an exit (the panel\'s own exitsOf)', () => {
        const d = doc(1);
        d.regions[1].S.exits.push({ name: 'dangling', connected_region: null });
        expect(skipsStart(d, '1', 'S', true)).toBe(true);
    });

    it('defaults to the schema\'s setting; on the committed documents: adventure (1 exit) skips, alttp (3) does not', () => {
        expect(skipsStart(doc(1), '1', 'S')).toBe(SKIP_MENU_DEFAULT);
        for (const [game, want] of [['adventure', true], ['alttp', false]]) {
            const d = PRESET(game);
            const start = d.start_regions['1'].default[0];
            expect(exitsOf(d, '1', start).length === 1, game).toBe(want);
            expect(skipsStart(d, '1', start, true), game).toBe(want);
        }
    });
});
