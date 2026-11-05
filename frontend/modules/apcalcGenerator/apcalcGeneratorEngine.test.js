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

import {
    generate, exportRulesJson, puzzleIdentity, PUZZLE_PARAM_KEYS, APCALC_GENERATOR_VERSION, retrySeed,
} from './apcalcGeneratorEngine.js';

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

describe('puzzleIdentity hashes the generator version', () => {
    it('a different APCALC_GENERATOR_VERSION would give a different name', async () => {
        expect(Number.isInteger(APCALC_GENERATOR_VERSION)).toBe(true);
        const config = CONFIGS[1];
        const { hash } = puzzleIdentity(config);
        // Recompute the hash the way puzzleIdentity does, at this version and the next.
        const fnv = text => {
            let h = 0x811c9dc5;
            for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
            return h.toString(16).padStart(8, '0').slice(0, 6);
        };
        const input = v => [`v=${v}`, ...PUZZLE_PARAM_KEYS.map(k => `${k}=${Number(config[k]) || 0}`)].join(';');
        expect(fnv(input(APCALC_GENERATOR_VERSION))).toBe(hash);
        expect(fnv(input(APCALC_GENERATOR_VERSION + 1))).not.toBe(hash);
    });
});

// About 1 seed in 2,500 at the default options dead-ends in sphere 6 ("Failed to
// generate chain"). Seed 4821 is one under this engine's RNG (mulberry32); before the
// whole-generation retry it threw. The Python twin of this pin, and the JS<->Python
// parity of the retried puzzle, are in worlds/apcalc/test/.
describe('generate retries a dead-end seed', () => {
    it('seed 4821 at the default params succeeds on its first retry', async () => {
        const logs = [];
        const g = await generate({ ...CONFIGS[1], seed: 4821 }, m => logs.push(m));
        expect(g.generationAttempt).toBe(1);
        expect(logs.some(m => m.includes('Failed to generate chain for sphere 6'))).toBe(true);
        expect(logs.some(m => m.includes(`Retry 1/7: seed ${retrySeed(4821, 1)}`))).toBe(true);
        expect(g.config.seed).toBe(4821); // the config (and so the puzzle's name) keeps the seed asked for
        expect(g.nodes.length).toBeGreaterThan(0);
    });

    it('a seed that succeeds first time is not retried', async () => {
        const g = await generate(CONFIGS[1], () => {});
        expect(g.generationAttempt).toBe(0);
        expect(retrySeed(42, 0)).toBe(42);
    });
});
