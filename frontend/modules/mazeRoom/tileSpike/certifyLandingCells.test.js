/**
 * LANDING CELLS (session tile-primitives-landing-cells): the certifier judges a crossing by the cell the GAME lands
 * it on — the atlas connection's to-end `entrance_tile`, an arrival-only `in_*` exit the projection never emits —
 * on the smallest compile that has a landing-gated crossing onto arrival-only water, L56 + L57.
 *
 * L56's pit drops into L57's water at (6,10). The rules producer gates the DEPARTURE on the Swim (the landing gate:
 * an item-less arrival there drowns); the maze world's pit is dry, and nothing judged the arrival, so the world crossed
 * free — LOOSER than its AP rule (whole game: 5 rows, gated-tiles). ⚖ user 2026-10-23: "Certifier only" + "Any shut
 * obstacle": a crossing is refused at an inventory for which the game's landing cell is shut.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze, atlasLandings } from './certifyPlaythroughMaze.js';
import { deserializeMazeWorld, getObstacle, getExitAt, isFloor } from '../mazeRoomEngine.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const SWIM = 'Progressive Swim';
const CROSSING = 'level_56 -> level_57';

/** A copy of the atlas with L57's pit landing from L56 moved to `tile` (atlas coordinates). */
const withLanding = (tile) => {
    const copy = structuredClone(ATLAS);
    copy.regions.find((r) => r.region_id === 'level_57').exits.find((e) => e.exit_id === 'in_pit_L56_6_10').entrance_tile = tile;
    return copy;
};

describe('the game\'s landing cell (L56 → L57, a pit into water)', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_56', 'level_57'] }).text);
    const run = (atlas) => certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: ['level_56'], atlas });
    const l57 = deserializeMazeWorld(RULES.preset_sidecars['1'].level_57.playable_payload);
    const { origin } = RULES.preset_sidecars['1'].level_57.playable_payload;
    const cells = [...Array(l57.height).keys()].flatMap((y) => [...Array(l57.width).keys()].map((x) => [x, y]));

    it('atlasLandings reads the to-end entrance_tile, in the target world\'s own coordinates, onto Swim water', () => {
        const at = atlasLandings(ATLAS, RULES).get(CROSSING);
        expect(at).toEqual({ x: 6 - origin.x, y: 10 - origin.y });
        expect(l57.obstacleLib[getObstacle(l57, at.x, at.y)].clear_rule).toEqual({ rule: 'Has', args: { item_name: SWIM } });
    });

    it('certifies clean: the crossing derives as needing the Swim, as its landing gate says', () => {
        const { problems, lines } = run(ATLAS);
        expect(problems).toEqual([]);
        const minimal = JSON.parse(lines.find((l) => l.startsWith('level_56->level_57=')).split('=')[1]);
        expect(minimal.length).toBeGreaterThan(0);
        for (const set of minimal) expect(set).toContain(SWIM);
    });

    it('the cell comes from the ATLAS: land the pit under another gate and the crossing no longer agrees', () => {
        // L57 holds no dry floor; any cell whose obstacle is not the Swim water gives a different truth table.
        const swim = getObstacle(l57, 6 - origin.x, 10 - origin.y);
        const other = cells.find(([x, y]) => isFloor(l57, x, y) && getObstacle(l57, x, y) !== swim && getExitAt(l57, x, y) === null);
        const { problems } = run(withLanding([other[0] + origin.x, other[1] + origin.y]));
        expect(problems.filter((p) => p.startsWith('level_56 → level_57 holding ['))).toHaveLength(1);
    });

    it('a landing on a cell the maze world WALLS is a problem by name', () => {
        const wall = cells.find(([x, y]) => !isFloor(l57, x, y));
        const { problems } = run(withLanding([wall[0] + origin.x, wall[1] + origin.y]));
        expect(problems).toContain(`${CROSSING}: the game lands on (${wall[0]},${wall[1]}) in level_57, which the maze world walls`);
    });

    it('a landing on a COMBO-LIST obstacle reads its items: the crossing opens once the item is held', () => {
        // The same water as a combo_list (an array of item COMBINATIONS, as a door, rope or button token is written).
        const combo = structuredClone(RULES);
        const payload = combo.preset_sidecars['1'].level_57.playable_payload;
        const id = getObstacle(l57, 6 - origin.x, 10 - origin.y);
        payload.obstacleLib[id] = { ...payload.obstacleLib[id], clear_set_type: 'combo_list', clear_set: [[SWIM]] };
        delete payload.obstacleLib[id].clear_rule;
        const { problems, lines } = certifyPlaythroughMaze(combo, HELPERS, { native: true, regions: ['level_56'], atlas: ATLAS });
        expect(problems).toEqual([]);
        const minimal = JSON.parse(lines.find((l) => l.startsWith('level_56->level_57=')).split('=')[1]);
        expect(minimal.length).toBeGreaterThan(0);
        for (const set of minimal) expect(set).toContain(SWIM);
    });

    it('refuses to certify without the atlas (an unjudged arrival is how the looser rows hid)', () => {
        expect(() => certifyPlaythroughMaze(RULES, HELPERS, { native: true })).toThrow(/atlas/);
    });
});
