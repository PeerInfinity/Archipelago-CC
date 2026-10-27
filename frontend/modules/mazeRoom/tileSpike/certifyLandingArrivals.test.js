/**
 * LANDING-ROOTED ARRIVALS (session tile-primitives-pit-sinks-landings): a region is priced from the cells the GAME
 * lands its AP crossings on (`atlasLandings`), not from its entrance cell — on the smallest compile that shows the gap,
 * L29 + L31.
 *
 * L31 r5c24's entrance cell (24,5) is the partition's first cell. It sits behind the stairs exit up to L29 at (24,6),
 * and an exit tile ends a walk, so a search from (24,5) never got past the stairs: the region's lock (12,28) and its
 * way on to r24c10 derived False while AP says the Green Key (whole game: 2 rows, tile-primitives-whole-game-classify).
 * The game lands L29's stairs down at (24,7), below the stairs (atlas `in_L29_112_32`), and from there the key opens it
 * (fidelity sweep legs 318/319).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze, atlasLandings } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const REGION = 'level_31__r5c24';
const CROSSING = 'level_29__r2c2 -> level_31__r5c24';

/** A copy of the atlas with L29's stairs landing in L31 moved to `tile`. */
const withLanding = (tile) => {
    const copy = structuredClone(ATLAS);
    copy.regions.find((r) => r.region_id === 'level_31').exits.find((e) => e.exit_id === 'in_L29_112_32').entrance_tile = tile;
    return copy;
};

describe('landing-rooted arrivals (L29 → L31 r5c24, the stairs down)', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_29', 'level_31'] }).text);
    const payload = RULES.preset_sidecars['1'][REGION].playable_payload;
    const run = (atlas) => certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: [REGION], atlas });

    it('the entrance cell is above the stairs exit; the game lands below it', () => {
        expect(payload.entrance).toEqual({ x: 24, y: 5 });
        expect(payload.exits.find((e) => e.targetRegion === 'level_29__r2c2')).toMatchObject({ x: 24, y: 6 });
        expect(atlasLandings(ATLAS, RULES).get(CROSSING)).toEqual({ x: 24, y: 7 });
    });

    it('certifies clean, priced from the landing: the Green Key opens the lock and the way on', () => {
        const { problems, lines } = run(ATLAS);
        expect(problems).toEqual([]);
        expect(lines).toContain(`${REGION}->level_31__r24c10<@24,7=[["Green Key"]]`);
        expect(lines.some((l) => l.startsWith(`${REGION}->level_31__r24c10=`))).toBe(false); // the entrance is no arrival here
    });

    it('MUTANT: land the stairs on the entrance cell and both rows come back, derived False', () => {
        const { problems } = run(withLanding([24, 5]));
        expect(problems.filter((p) => p.startsWith(`${REGION} `) && /derived false, atlas true/.test(p))).toHaveLength(2);
    });
});
