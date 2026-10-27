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
import { distinctArrivals, nativeReachUnder } from './deriveLevelWorldLogic.js';
import { createWorld, setTile, setBlock, TILE_WALL } from '../mazeRoomEngine.js';
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

    it('both L31 worlds certify clean: the crossing between them lands ON the bosslock, shut in both worlds', () => {
        // r24c10 → r5c24 lands on (12,27), the lock both plain worlds lay. Holding no key that arrival is no AP state,
        // and the source's own walk onto its exit cell already pays for the lock — so it is skipped, not reported.
        // Unskipped, it walked back LOOSER both ways (2 rows, measured in the slice).
        const { problems } = certifyPlaythroughMaze(RULES, HELPERS, {
            native: true, regions: [REGION, 'level_31__r24c10'], atlas: ATLAS,
        });
        expect(problems).toEqual([]);
    });

    it('MUTANT: land the stairs on the entrance cell and both rows come back, derived False', () => {
        const { problems } = run(withLanding([24, 5]));
        expect(problems.filter((p) => p.startsWith(`${REGION} `) && /derived false, atlas true/.test(p))).toHaveLength(2);
    });
});

/**
 * The dedupe matches an arrival's FRESH state — position, blocks, broken cells (`reachKey`) — never its cell alone
 * (designer-2's condition, 2026-10-26). In this corridor A reaches B's cell only by pushing the block past it; from B's
 * fresh arrival (block at home) the far cell (6,1) is reachable, which no walk from A ever is.
 *
 *   # # # # # # # #
 *   # A C ▣ B . . #      A (1,1) the entrance · C (2,1) · ▣ block (3,1) · B (4,1) · the far cell (6,1)
 *   # # # # # # # #
 */
describe('distinctArrivals — one search per arrival class, matched on the fresh STATE', () => {
    const world = (() => {
        const w = createWorld(8, 3, { entrance: { x: 1, y: 1 }, exits: [{ exit_id: 'exit', x: 1, y: 1 }] });
        for (let x = 0; x < 8; x++) for (const y of [0, 2]) setTile(w, x, y, TILE_WALL);
        setTile(w, 0, 1, TILE_WALL);
        setTile(w, 7, 1, TILE_WALL);
        setBlock(w, 3, 1);
        return w;
    })();
    const B = { x: 4, y: 1 };
    const C = { x: 2, y: 1 };

    it('B keeps its own search: its cell is walked onto from A only with the block moved', () => {
        expect(nativeReachUnder(world, []).cells.has('4,1')).toBe(true);
        expect(nativeReachUnder(world, []).cells.has('6,1')).toBe(false);
        expect(nativeReachUnder({ ...world, entrance: B }, []).cells.has('6,1')).toBe(true);
        expect(distinctArrivals(world, [null, B])).toEqual([null, B]);
    });

    it('C, a step from A with the block at home both ways, is priced by A\'s search', () => {
        expect(distinctArrivals(world, [null, C, B])).toEqual([null, B]);
    });

    it('MUTANT: matching by CELL (A reaches B\'s cell) would drop B and lose (6,1)', () => {
        const byCell = (arrivals) => arrivals.filter((a, i) => i === 0
            || !nativeReachUnder(world, []).cells.has(`${a.x},${a.y}`));
        expect(byCell([null, B])).toEqual([null]);
    });
});
