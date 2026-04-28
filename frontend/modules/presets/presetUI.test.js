import { describe, it, expect } from 'vitest';

import {
    selectIndexFile,
    filterAndSortPresets,
    computeDetailNav,
} from './presetUI.js';

// Fixture index — subset of the real preset_files.json shape with a
// mix of plain, _worldgen, _vanilla, and procgen entries.
const FIXTURE = {
    metadata: { test_data_updated: '...' },
    alttp: {
        name: 'A Link to the Past',
        folders: {
            AP_1: { seed: 1, files: ['AP_1_rules.json', 'AP_1_sphere_log.jsonl'] },
            AP_2: { seed: 2, files: ['AP_2_rules.json'] },
        },
        test_results: {
            minimal_spoiler: { passed: true },
            full_spoiler: { passed: false },
        },
    },
    alttp_worldgen: {
        name: 'A Link to the Past',
        folders: {
            AP_W1: { seed: 1, files: ['AP_W1_rules.json'], has_procgen_data: true },
        },
    },
    alttp_vanilla: {
        name: 'A Link to the Past',
        folders: { AP_V1: { seed: 1, is_vanilla: true, files: ['AP_V1_rules.json'] } },
    },
    adventure: {
        name: 'Adventure',
        folders: { AP_A1: { seed: 1, files: ['AP_A1_rules.json', 'AP_A1_sphere_log.jsonl'] } },
        test_results: { minimal_spoiler: { passed: true } },
    },
    blasphemous: {
        name: 'Blasphemous',
        folders: { AP_B1: { seed: 1, files: ['AP_B1_rules.json'] } },
        // No test_results — "unknown" status.
    },
    multiworld: {
        name: 'Multiworld',
        folders: {
            AP_MW1: {
                seed: 1,
                games: [{ player: 1, name: 'A', game: 'Adventure' }],
                files: ['AP_MW1_rules.json'],
            },
        },
    },
};

describe('selectIndexFile', () => {
    it('defaults to the dev index on a localhost host', () => {
        const result = selectIndexFile({ hostname: 'localhost', search: '' });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('selects the live index on a github.io host', () => {
        const result = selectIndexFile({
            hostname: 'username.github.io',
            search: '',
        });
        expect(result.path).toBe('./presets/preset_files.live.json');
        expect(result.isLive).toBe(true);
    });

    it('also matches custom github.io subdomains', () => {
        const result = selectIndexFile({
            hostname: 'project.user.github.io',
            search: '',
        });
        expect(result.isLive).toBe(true);
    });

    it('treats file:// (empty hostname) as dev', () => {
        const result = selectIndexFile({ hostname: '', search: '' });
        expect(result.isLive).toBe(false);
        expect(result.path).toBe('./presets/preset_files.json');
    });

    it('?index=live forces live regardless of host', () => {
        const result = selectIndexFile({
            hostname: 'localhost',
            search: '?index=live',
        });
        expect(result.path).toBe('./presets/preset_files.live.json');
        expect(result.isLive).toBe(true);
    });

    it('?index=dev forces dev regardless of host', () => {
        const result = selectIndexFile({
            hostname: 'username.github.io',
            search: '?index=dev',
        });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('ignores other ?index= values and falls through to host-based selection', () => {
        const result = selectIndexFile({
            hostname: 'localhost',
            search: '?index=garbage',
        });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('ignores unrelated URL params', () => {
        const result = selectIndexFile({
            hostname: 'localhost',
            search: '?nocache=1&theme=dark',
        });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('handles undefined inputs without throwing', () => {
        expect(() => selectIndexFile()).not.toThrow();
        expect(() => selectIndexFile({})).not.toThrow();
        const r = selectIndexFile();
        expect(r.path).toBe('./presets/preset_files.json');
    });
});

describe('filterAndSortPresets', () => {
    it('drops the metadata top-level entry', () => {
        const out = filterAndSortPresets(FIXTURE, {});
        expect(out.find(([k]) => k === 'metadata')).toBeUndefined();
    });

    it('default sort is by display name A→Z', () => {
        const out = filterAndSortPresets(FIXTURE, {});
        const names = out.map(([, d]) => d.name);
        // Stable sort: three "A Link to the Past" entries in input order
        // (alttp, alttp_worldgen, alttp_vanilla), then Adventure, etc.
        expect(names[0]).toBe('A Link to the Past');
        expect(names[3]).toBe('Adventure');
        expect(names[4]).toBe('Blasphemous');
        expect(names[5]).toBe('Multiworld');
    });

    it('search matches by display name (case-insensitive substring)', () => {
        const out = filterAndSortPresets(FIXTURE, { query: 'past' });
        const dirs = out.map(([k]) => k).sort();
        expect(dirs).toEqual(['alttp', 'alttp_vanilla', 'alttp_worldgen']);
    });

    it('search also matches by gameDirectory id', () => {
        const out = filterAndSortPresets(FIXTURE, { query: 'blasphem' });
        expect(out.map(([k]) => k)).toEqual(['blasphemous']);
    });

    it('filter testStatus=passing keeps only entries with at least one passed test', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { testStatus: 'passing' } });
        const dirs = out.map(([k]) => k).sort();
        expect(dirs).toEqual(['adventure', 'alttp']);
    });

    it('filter testStatus=failing keeps only entries with at least one failed test', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { testStatus: 'failing' } });
        expect(out.map(([k]) => k)).toEqual(['alttp']);
    });

    it('filter testStatus=unknown keeps only entries with no test_results', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { testStatus: 'unknown' } });
        const dirs = out.map(([k]) => k).sort();
        // alttp_worldgen, alttp_vanilla, blasphemous, multiworld have no test_results.
        expect(dirs).toEqual(['alttp_vanilla', 'alttp_worldgen', 'blasphemous', 'multiworld']);
    });

    it('filter worldType=worldgen keeps only directories with _worldgen', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { worldType: 'worldgen' } });
        expect(out.map(([k]) => k)).toEqual(['alttp_worldgen']);
    });

    it('filter worldType=vanilla keeps only directories with _vanilla', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { worldType: 'vanilla' } });
        expect(out.map(([k]) => k)).toEqual(['alttp_vanilla']);
    });

    it('filter worldType=multiworld keeps only the literal multiworld directory', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { worldType: 'multiworld' } });
        expect(out.map(([k]) => k)).toEqual(['multiworld']);
    });

    it('filter worldType=original drops worldgen / vanilla / multiworld', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { worldType: 'original' } });
        const dirs = out.map(([k]) => k).sort();
        expect(dirs).toEqual(['adventure', 'alttp', 'blasphemous']);
    });

    it('filter hasSphereLog=yes requires at least one folder with a *_sphere_log.jsonl', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { hasSphereLog: 'yes' } });
        const dirs = out.map(([k]) => k).sort();
        expect(dirs).toEqual(['adventure', 'alttp']);
    });

    it('filter hasProcgenData=yes requires at least one folder marked has_procgen_data', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { hasProcgenData: 'yes' } });
        expect(out.map(([k]) => k)).toEqual(['alttp_worldgen']);
    });

    it('filter hasProcgenData=no excludes the marked folder', () => {
        const out = filterAndSortPresets(FIXTURE, { filters: { hasProcgenData: 'no' } });
        expect(out.map(([k]) => k)).not.toContain('alttp_worldgen');
    });

    it('sort by seedCount returns most-seeds first', () => {
        const out = filterAndSortPresets(FIXTURE, { sortKey: 'seedCount' });
        // alttp has 2 folders; everyone else has 1.
        expect(out[0][0]).toBe('alttp');
    });

    it('sort by testPassCount returns most-passes first', () => {
        const out = filterAndSortPresets(FIXTURE, { sortKey: 'testPassCount' });
        // adventure and alttp each have 1 pass — both float to the top.
        // Tiebreaker: localeCompare puts 'A Link to the Past' before
        // 'Adventure' (space < 'd'), so alttp comes first.
        expect(out[0][0]).toBe('alttp');
        expect(out[1][0]).toBe('adventure');
    });

    it('combining search + filter narrows correctly', () => {
        const out = filterAndSortPresets(FIXTURE, {
            query: 'past',
            filters: { hasProcgenData: 'yes' },
        });
        expect(out.map(([k]) => k)).toEqual(['alttp_worldgen']);
    });
});

describe('computeDetailNav', () => {
    // Tuples in render order, matching what _currentOrderedTuples
    // would hold after a default-sort renderGamesList:
    //   alttp/AP_1, alttp/AP_2, alttp_worldgen/AP_W1,
    //   alttp_vanilla/AP_V1 — all "A Link to the Past"
    //   adventure/AP_A1 — "Adventure"
    //   blasphemous/AP_B1 — "Blasphemous"
    //   multiworld/AP_MW1/P1 — "Multiworld"
    const tuples = [
        { gameDirectory: 'alttp', seedName: 'AP_1', playerId: null },
        { gameDirectory: 'alttp', seedName: 'AP_2', playerId: null },
        { gameDirectory: 'alttp_worldgen', seedName: 'AP_W1', playerId: null },
        { gameDirectory: 'alttp_vanilla', seedName: 'AP_V1', playerId: null },
        { gameDirectory: 'adventure', seedName: 'AP_A1', playerId: null },
        { gameDirectory: 'blasphemous', seedName: 'AP_B1', playerId: null },
        { gameDirectory: 'multiworld', seedName: 'AP_MW1', playerId: '1' },
    ];

    it('returns nulls when the selection is not in the tuple list', () => {
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'unknown', seedName: 'X', playerId: null });
        expect(nav).toEqual({ prevGame: null, prevSeed: null, nextSeed: null, nextGame: null });
    });

    it('seed nav steps within the same gameDirectory only', () => {
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'alttp', seedName: 'AP_1', playerId: null });
        expect(nav.prevSeed).toBeNull();
        expect(nav.nextSeed?.seedName).toBe('AP_2');
    });

    it('seed nav stops at the gameDirectory boundary even when the next tuple shares a display name', () => {
        // alttp/AP_2 is the last alttp tuple. The next tuple is
        // alttp_worldgen/AP_W1 — same display name "A Link to the
        // Past" — but a different gameDirectory. Seed nav should not
        // cross.
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'alttp', seedName: 'AP_2', playerId: null });
        expect(nav.nextSeed).toBeNull();
    });

    it('game nav jumps to the next display-name group (across gameDirectory boundaries within the group)', () => {
        // From alttp/AP_1: prev game = none (first group); next game =
        // first tuple of "Adventure" group = adventure/AP_A1.
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'alttp', seedName: 'AP_1', playerId: null });
        expect(nav.prevGame).toBeNull();
        expect(nav.nextGame?.gameDirectory).toBe('adventure');
        expect(nav.nextGame?.seedName).toBe('AP_A1');
    });

    it('game nav from within a multi-directory group still goes to next group', () => {
        // From alttp_worldgen/AP_W1 (middle of the "A Link to the Past"
        // group), nextGame should still be adventure/AP_A1.
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'alttp_worldgen', seedName: 'AP_W1', playerId: null });
        expect(nav.nextGame?.gameDirectory).toBe('adventure');
        // prevGame from a non-first member of the group is the first
        // tuple of the previous group — but there is no previous group,
        // so null.
        expect(nav.prevGame).toBeNull();
    });

    it('game nav backwards lands on the FIRST tuple of the previous group', () => {
        // From adventure/AP_A1: prev game = first tuple of "A Link to
        // the Past" group = alttp/AP_1.
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'adventure', seedName: 'AP_A1', playerId: null });
        expect(nav.prevGame?.gameDirectory).toBe('alttp');
        expect(nav.prevGame?.seedName).toBe('AP_1');
    });

    it('returns null nav targets at the ends of the list', () => {
        const first = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'alttp', seedName: 'AP_1', playerId: null });
        expect(first.prevGame).toBeNull();
        expect(first.prevSeed).toBeNull();

        const last = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'multiworld', seedName: 'AP_MW1', playerId: '1' });
        expect(last.nextGame).toBeNull();
        expect(last.nextSeed).toBeNull();
    });

    it('matches the playerId field exactly (multiworld tuples)', () => {
        const navP1 = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'multiworld', seedName: 'AP_MW1', playerId: '1' });
        expect(navP1.prevGame?.gameDirectory).toBe('blasphemous');
        // Selecting with a non-matching playerId should not be found.
        const navP2 = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'multiworld', seedName: 'AP_MW1', playerId: '2' });
        expect(navP2).toEqual({ prevGame: null, prevSeed: null, nextSeed: null, nextGame: null });
    });

    it('attaches the display name as label', () => {
        const nav = computeDetailNav(tuples, FIXTURE,
            { gameDirectory: 'alttp', seedName: 'AP_1', playerId: null });
        expect(nav.nextGame?.label).toBe('Adventure');
    });
});
