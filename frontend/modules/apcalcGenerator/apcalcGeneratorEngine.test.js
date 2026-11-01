// frontend/modules/apcalcGenerator/apcalcGeneratorEngine.test.js
/**
 * The generator's `itempool_counts` follows the exporter's contract:
 * pool = precollected (starting buttons) + placed
 * (`exporter/games/base/world_data.py` get_itempool_counts), because
 * world_generator builds its pool as `itempool_counts − starting_items −
 * locked events` (`world_generator/_template_init.py`). Before the fix the
 * starting buttons were left out, so world_generator's pool came up short of
 * the locations and Generate.py raised `FillError: Unable to fill all
 * locations` at any seed that runs Fill.
 */
import { describe, expect, it } from 'vitest';

import { generate, exportRulesJson, puzzleIdentity, PUZZLE_PARAM_KEYS } from './apcalcGeneratorEngine.js';

const CONFIGS = [
    { seed: 1, numSpheres: 3, opsPerSphere: 2, numsPerSphere: 2, trashPerSphere: 1, maxBranches: 2, reuseAttempts: 0 },
    // the panel's DEFAULT_PARAMS
    { seed: 42, numSpheres: 8, opsPerSphere: 1, numsPerSphere: 2, trashPerSphere: 1, maxBranches: 5, reuseAttempts: 0 },
];

describe('exportRulesJson itempool_counts', () => {
    for (const config of CONFIGS) {
        it(`pools every starting button (seed ${config.seed})`, async () => {
            const rules = exportRulesJson(await generate(config, () => {}));
            const pool = rules.itempool_counts['1'];
            const starting = {};
            for (const name of rules.starting_items['1']) starting[name] = (starting[name] ?? 0) + 1;
            expect(Object.keys(starting).length).toBeGreaterThan(0);

            // placed = the item at every real (id-bearing) location
            const placed = {};
            for (const region of Object.values(rules.regions['1'])) {
                for (const loc of region.locations) {
                    if (loc.id == null) continue;
                    placed[loc.item.name] = (placed[loc.item.name] ?? 0) + 1;
                }
            }
            const nonEventPool = Object.fromEntries(Object.entries(pool)
                .filter(([name]) => rules.items['1'][name]?.id != null));
            const expected = { ...placed };
            for (const [name, n] of Object.entries(starting)) expected[name] = (expected[name] ?? 0) + n;
            expect(nonEventPool).toEqual(expected);

            // world_generator's view: pool − starting fills every location exactly
            const wgPool = Object.entries(nonEventPool)
                .reduce((sum, [name, n]) => sum + n - (starting[name] ?? 0), 0);
            const locations = Object.values(placed).reduce((a, b) => a + b, 0);
            expect(wgPool).toBe(locations);

            // max_count was already precollected + placed; the pool now agrees
            for (const [name, n] of Object.entries(nonEventPool)) {
                expect(rules.items['1'][name].max_count).toBeGreaterThanOrEqual(n);
            }
        });
    }
});

// A browser-built puzzle must not claim worlds/apcalc's "APCalc", and two
// different puzzles must not claim one name (AP keys worlds by game name and
// apworlds by directory).
describe('puzzleIdentity', () => {
    const base = CONFIGS[1];

    it('names the game "APCalc Puzzle <seed>-<hash>" throughout the rules.json', async () => {
        const rules = exportRulesJson(await generate(base, () => {}));
        const id = puzzleIdentity(base);
        expect(id.gameName).toMatch(/^APCalc Puzzle 42-[0-9a-f]{6}$/);
        expect(id.gameDirectory).toBe(`apcalc_puzzle_42_${id.hash}`);
        expect(id.worldClassName).toBe(`APCalcPuzzle42${id.hash}World`);
        expect(rules.game_name).toBe(id.gameName);
        expect(rules.game_directory).toBe(id.gameDirectory);
        expect(rules.world['1'].game).toBe(id.gameName);
        expect(rules.world['1'].world_class_name).toBe(id.worldClassName);
        expect(rules.world['1'].world_directory).toBe(id.gameDirectory);
        expect(rules.game_name).not.toBe('APCalc');
    });

    it('is a pure function of seed + params (the hash is always present)', () => {
        expect(puzzleIdentity({ ...base })).toEqual(puzzleIdentity(base));
        // key order and unrelated fields do not matter
        expect(puzzleIdentity({ extra: 1, ...base }).gameName).toBe(puzzleIdentity(base).gameName);
        // a missing reuseAttempts reads as 0 (auto), as generate() does
        const { reuseAttempts, ...noReuse } = base;
        expect(puzzleIdentity(noReuse).gameName).toBe(puzzleIdentity(base).gameName);
    });

    it('differs when the seed or any one param differs', () => {
        const names = new Set([puzzleIdentity(base).gameName, puzzleIdentity({ ...base, seed: 43 }).gameName]);
        for (const k of PUZZLE_PARAM_KEYS) names.add(puzzleIdentity({ ...base, [k]: (base[k] || 0) + 1 }).gameName);
        expect(names.size).toBe(2 + PUZZLE_PARAM_KEYS.length);
        const dirs = new Set([...names].map(n => n.toLowerCase()));
        expect(dirs.size).toBe(names.size);
    });
});
