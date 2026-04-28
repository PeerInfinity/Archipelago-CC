import { describe, it, expect } from 'vitest';

import {
    selectIndexFile,
    filterAndSortPresets,
    computeDetailNav,
    parseSphereLogShape,
    buildSphereEnrichment,
    computeProcgenStats,
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

    it('default sort is index order — preserves Object.entries iteration order', () => {
        const out = filterAndSortPresets(FIXTURE, {});
        // FIXTURE iteration order: alttp, alttp_worldgen, alttp_vanilla,
        // adventure, blasphemous, multiworld (metadata is dropped).
        expect(out.map(([k]) => k)).toEqual([
            'alttp', 'alttp_worldgen', 'alttp_vanilla',
            'adventure', 'blasphemous', 'multiworld',
        ]);
    });

    it('explicit sortKey="name" sorts by display name A→Z', () => {
        const out = filterAndSortPresets(FIXTURE, { sortKey: 'name' });
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

describe('parseSphereLogShape', () => {
    it('returns an empty array for empty input', () => {
        expect(parseSphereLogShape('')).toEqual([]);
        expect(parseSphereLogShape(null)).toEqual([]);
        expect(parseSphereLogShape(undefined)).toEqual([]);
    });

    it('skips the metadata line and counts state_update lines per integer sphere', () => {
        const text = [
            JSON.stringify({ type: 'metadata', seed: 1 }),
            JSON.stringify({ type: 'state_update', sphere_index: '0' }),
            JSON.stringify({ type: 'state_update', sphere_index: '0.1' }),
            JSON.stringify({ type: 'state_update', sphere_index: '0.2' }),
            JSON.stringify({ type: 'state_update', sphere_index: '1' }),
            JSON.stringify({ type: 'state_update', sphere_index: '1.1' }),
            JSON.stringify({ type: 'state_update', sphere_index: '2' }),
        ].join('\n');
        expect(parseSphereLogShape(text)).toEqual([
            { integerSphere: 0, fractionalCount: 3, sphereIndices: ['0', '0.1', '0.2'] },
            { integerSphere: 1, fractionalCount: 2, sphereIndices: ['1', '1.1'] },
            { integerSphere: 2, fractionalCount: 1, sphereIndices: ['2'] },
        ]);
    });

    it('orders entries ascending even when input is unsorted', () => {
        const text = [
            JSON.stringify({ type: 'state_update', sphere_index: '5' }),
            JSON.stringify({ type: 'state_update', sphere_index: '0' }),
            JSON.stringify({ type: 'state_update', sphere_index: '2' }),
        ].join('\n');
        const out = parseSphereLogShape(text);
        expect(out.map((e) => e.integerSphere)).toEqual([0, 2, 5]);
    });

    it('preserves JSONL order within each integer sphere (sphereIndices)', () => {
        const text = [
            // Out-of-order on purpose: the parser must preserve the
            // file's emission order, not numerical fractional order.
            JSON.stringify({ type: 'state_update', sphere_index: '0.3' }),
            JSON.stringify({ type: 'state_update', sphere_index: '0' }),
            JSON.stringify({ type: 'state_update', sphere_index: '0.1' }),
        ].join('\n');
        const [row] = parseSphereLogShape(text);
        expect(row.sphereIndices).toEqual(['0.3', '0', '0.1']);
        expect(row.fractionalCount).toBe(3);
    });

    it('does NOT emit zero-count rows for missing integer spheres in between', () => {
        // Spheres 0 and 5 with nothing in between — output skips 1-4.
        const text = [
            JSON.stringify({ type: 'state_update', sphere_index: '0' }),
            JSON.stringify({ type: 'state_update', sphere_index: '5' }),
        ].join('\n');
        const out = parseSphereLogShape(text);
        expect(out.map((e) => e.integerSphere)).toEqual([0, 5]);
    });

    it('silently skips malformed lines and unknown record types', () => {
        const text = [
            'not-json',
            '',
            JSON.stringify({ type: 'state_update', sphere_index: '0' }),
            JSON.stringify({ type: 'unknown_record', sphere_index: '7' }),
            JSON.stringify({ type: 'state_update' /* missing sphere_index */ }),
            JSON.stringify({ type: 'state_update', sphere_index: 5 /* not a string */ }),
            JSON.stringify({ type: 'state_update', sphere_index: 'banana' }),
            JSON.stringify({ type: 'state_update', sphere_index: '0.1' }),
        ].join('\n');
        expect(parseSphereLogShape(text)).toEqual([
            { integerSphere: 0, fractionalCount: 2, sphereIndices: ['0', '0.1'] },
        ]);
    });

    it('handles sphere_index strings with no fractional part', () => {
        const text = [
            JSON.stringify({ type: 'state_update', sphere_index: '3' }),
            JSON.stringify({ type: 'state_update', sphere_index: '3' }),
            JSON.stringify({ type: 'state_update', sphere_index: '3' }),
        ].join('\n');
        expect(parseSphereLogShape(text)).toEqual([
            { integerSphere: 3, fractionalCount: 3, sphereIndices: ['3', '3', '3'] },
        ]);
    });
});

describe('buildSphereEnrichment', () => {
    const sphereData = [
        { sphereIndex: '0',   integerSphere: 0, fractionalSphere: 0, locations: ['L0a', 'L0b'] },
        { sphereIndex: '0.1', integerSphere: 0, fractionalSphere: 1, locations: ['L0c'] },
        { sphereIndex: '1',   integerSphere: 1, fractionalSphere: 0, locations: ['L1a'] },
        { sphereIndex: '1.1', integerSphere: 1, fractionalSphere: 1, locations: ['L1b'] },
        { sphereIndex: '2',   integerSphere: 2, fractionalSphere: 0, locations: [] },
    ];

    it('returns an empty Map for empty / missing input', () => {
        expect(buildSphereEnrichment(null).size).toBe(0);
        expect(buildSphereEnrichment([]).size).toBe(0);
    });

    it('builds a Map keyed by sphereIndex with locations attached', () => {
        const map = buildSphereEnrichment(sphereData);
        expect(map.size).toBe(5);
        expect(map.get('0').locations).toEqual(['L0a', 'L0b']);
        expect(map.get('1.1').locations).toEqual(['L1b']);
    });

    it('marks status without currentSphere as unknown', () => {
        const map = buildSphereEnrichment(sphereData);
        for (const v of map.values()) expect(v.status).toBe('unknown');
    });

    it('classifies status relative to currentSphere', () => {
        const map = buildSphereEnrichment(sphereData,
            { currentSphere: { integerSphere: 1, fractionalSphere: 0 } });
        // Before current → completed
        expect(map.get('0').status).toBe('completed');
        expect(map.get('0.1').status).toBe('completed');
        // Current
        expect(map.get('1').status).toBe('current');
        // After current → future
        expect(map.get('1.1').status).toBe('future');
        expect(map.get('2').status).toBe('future');
    });

    it('demotes "completed" to "current" when locations are not all checked', () => {
        // Sphere 0 should be "completed" by index ordering, but L0a
        // is unchecked, so it gets demoted to "current".
        const map = buildSphereEnrichment(sphereData, {
            currentSphere: { integerSphere: 1, fractionalSphere: 0 },
            checkedLocations: new Set(['L0b', 'L0c']),
        });
        expect(map.get('0').status).toBe('current');
        // 0.1 has only L0c, which IS checked → stays completed.
        expect(map.get('0.1').status).toBe('completed');
    });

    it('promotes "current" to "completed" when all locations are checked', () => {
        const map = buildSphereEnrichment(sphereData, {
            currentSphere: { integerSphere: 1, fractionalSphere: 0 },
            checkedLocations: new Set(['L1a']),
        });
        expect(map.get('1').status).toBe('completed');
    });

    it('skips sphere entries with non-string sphereIndex', () => {
        const broken = [
            { sphereIndex: '0', integerSphere: 0, fractionalSphere: 0, locations: [] },
            { /* no sphereIndex */ integerSphere: 1, fractionalSphere: 0, locations: [] },
            { sphereIndex: 42, integerSphere: 2, fractionalSphere: 0, locations: [] },
        ];
        const map = buildSphereEnrichment(broken);
        expect([...map.keys()]).toEqual(['0']);
    });
});

describe('computeProcgenStats', () => {
    function makeRegionSidecar({ substrate = 'maze', width = 8, height = 6,
        exits = [], items = [], obstacleLib = {} } = {}) {
        return {
            substrate,
            render_hint: substrate,
            grid_cell: { gx: 0, gy: 0 },
            playable_payload: { width, height, exits, items, obstacles: [], obstacleLib },
        };
    }

    it('returns null for non-procgen rules.json (no preset_sidecars)', () => {
        expect(computeProcgenStats({})).toBeNull();
        expect(computeProcgenStats({ regions: { '1': {} } })).toBeNull();
    });

    it('returns null for empty preset_sidecars', () => {
        expect(computeProcgenStats({ preset_sidecars: { '1': {} } })).toBeNull();
    });

    it('counts regions per substrate', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': {
                R1: makeRegionSidecar({ substrate: 'maze' }),
                R2: makeRegionSidecar({ substrate: 'maze' }),
                R3: makeRegionSidecar({ substrate: 'text_adventure' }),
            }},
        });
        expect(stats.regionCount).toBe(3);
        expect(stats.substrateCounts).toEqual({ maze: 2, text_adventure: 1 });
    });

    it('per-region exits exclude back-exits and teleporters', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': {
                R1: makeRegionSidecar({
                    exits: [
                        { exit_id: 'a', isBackExit: false, isTeleporter: false },
                        { exit_id: 'b', isBackExit: true,  isTeleporter: false },
                        { exit_id: 'c', isBackExit: false, isTeleporter: true  },
                        { exit_id: 'd', isBackExit: false, isTeleporter: false },
                    ],
                }),
            }},
        });
        expect(stats.regions[0].exits).toBe(2);
    });

    it('per-region locations count items with locationName', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': {
                R1: makeRegionSidecar({
                    items: [
                        { x: 1, y: 1, id: 'sword', locationName: 'Slay Yorgle' },
                        { x: 2, y: 2, id: 'key',   locationName: 'Bridge Key' },
                        { x: 3, y: 3, id: 'foo',   locationName: null },
                    ],
                }),
            }},
        });
        expect(stats.regions[0].locations).toBe(2);
    });

    it('per-region density is (exits + locations) / area', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': {
                R1: makeRegionSidecar({
                    width: 10, height: 10,
                    exits: [{ exit_id: 'a' }, { exit_id: 'b' }],
                    items: [
                        { locationName: 'L1' },
                        { locationName: 'L2' },
                        { locationName: 'L3' },
                    ],
                }),
            }},
        });
        expect(stats.regions[0].density).toBeCloseTo(0.05, 5);
    });

    it('counts logic_gate obstacleLib entries (clear_set_type=rule) across regions', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': {
                R1: makeRegionSidecar({ obstacleLib: {
                    logic_gate_1: { clear_set_type: 'rule' },
                    door_red: { clear_set_type: 'combo_list' },
                }}),
                R2: makeRegionSidecar({ obstacleLib: {
                    logic_gate_2: { clear_set_type: 'rule' },
                    logic_gate_3: { clear_set_type: 'rule' },
                }}),
            }},
        });
        expect(stats.totalLogicGates).toBe(3);
    });

    it('passes through procgen_metadata fields', () => {
        const stats = computeProcgenStats({
            procgen_metadata: {
                driver: 'top-down',
                source_game: 'Adventure',
                source_counts: { regions: 6, locations: 25, exits: 17, logic_gates: 12 },
                stop_reason: 'all_placed',
                grid_dims: { width: 3, height: 3 },
            },
            preset_sidecars: { '1': {
                R1: makeRegionSidecar(),
            }},
        });
        expect(stats.driver).toBe('top-down');
        expect(stats.sourceGame).toBe('Adventure');
        expect(stats.sourceCounts).toEqual({ regions: 6, locations: 25, exits: 17, logic_gates: 12 });
        expect(stats.stopReason).toBe('all_placed');
        expect(stats.gridDims).toEqual({ width: 3, height: 3 });
    });

    it('reports null driver for older procgen output without procgen_metadata', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': { R1: makeRegionSidecar() } },
        });
        expect(stats.driver).toBeNull();
        expect(stats.sourceCounts).toBeNull();
        expect(stats.stopReason).toBeNull();
    });

    it('outputCounts aggregates across all regions', () => {
        const stats = computeProcgenStats({
            preset_sidecars: { '1': {
                R1: makeRegionSidecar({
                    exits: [{ exit_id: 'a' }, { exit_id: 'b' }],
                    items: [{ locationName: 'L1' }],
                }),
                R2: makeRegionSidecar({
                    exits: [{ exit_id: 'c' }],
                    items: [{ locationName: 'L2' }, { locationName: 'L3' }],
                }),
            }},
        });
        expect(stats.outputCounts).toEqual({
            regions: 2, locations: 3, exits: 3, logic_gates: 0,
        });
    });
});
