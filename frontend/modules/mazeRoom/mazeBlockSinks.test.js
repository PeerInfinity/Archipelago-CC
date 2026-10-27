/**
 * BLOCK SINKS (session tile-primitives-sphere-order-1, ⚖ 2026-10-25 "Sink from grid terrain"). Seedling's
 * `PushableBlock` is destroyed when it comes to rest on water, lava or a pit (`PushableBlock.as:81`: tile t 1 / 17 / 6
 * → `destroy = true`; water is a "Tile", not "Solid", so the block slides in). The maze refused a block into an
 * uncleared obstacle, so L8's lane block — which the game shoves into the water to open the way to L9 — needed Swim.
 * A world's `block_sinks` cells now take a pushed block whatever their clearance and remove it for the visit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    createWorld, createState, step, whyBlocked, mazeVisitedKey, worldInputs, setTile, setObstacle, setBlock,
    TILE_WALL, INPUTS, INPUT_E, INPUT_WAIT, checkBlockSinks, sinksBlock, blocksAfterPush,
    serializeMazeEntities, deserializeMazeWorld, getExitAt,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { deriveRequires } from './mazeQueueExecutor.js';
import { moveEntry } from './mazeKeys.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };
import { buildPlaythroughMaze } from '../../../scripts/procgen/make-seedling-playthrough-maze.mjs';

const SWIM = 'Progressive Swim';

/**
 *   #  wall   P entrance   X exit   B block   w water (Swim) that SINKS a block   v water that does not
 */
function picture(rows, { sinks = true } = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const find = (ch) => {
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rows[y][x] === ch) return { x, y };
        return null;
    };
    const entrance = find('P');
    const w = createWorld(width, height, { entrance, exits: [{ exit_id: 'exit', ...(find('X') ?? entrance) }] });
    w.obstacleLib = { ...w.obstacleLib, water: { kind: 'terrain', clear_set: [[SWIM]], color: '#36c' } };
    const sinkCells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const c = rows[y][x];
            if (c === '#') setTile(w, x, y, TILE_WALL);
            if (c === 'B') setBlock(w, x, y);
            if (c === 'w' || c === 'v') setObstacle(w, x, y, 'water');
            if (c === 'w' && sinks) sinkCells.push({ x, y });
        }
    }
    if (sinkCells.length > 0) w.blockSinks = checkBlockSinks(sinkCells, width, height, 'test');
    return w;
}

/** L8's shape: the lane block (4,3) stands in the only corridor to the exit; water beside it at (3,3). */
const LANE = [
    '#######',
    '#P....#',
    '####..#',
    '###wB.#',
    '####.##',
    '####X##',
    '#######',
];

const reachable = (world, inventory = new Set()) => {
    const start = createState(world);
    start.inventory = inventory;
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const frontier = [start];
    while (frontier.length) {
        const s = frontier.pop();
        for (const input of worldInputs(world)) {
            const n = step(world, s, input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.set(mazeVisitedKey(n), n);
            frontier.push(n);
        }
    }
    return [...seen.values()];
};
const reachesExit = (world, inv) => reachable(world, inv).some((s) => getExitAt(world, s.player_pos.x, s.player_pos.y));

describe('block_sinks — checked, round-tripped', () => {
    it('cells off the grid, duplicates and a non-list are refused by name', () => {
        expect(() => checkBlockSinks({}, 3, 3, 't')).toThrow(/"block_sinks" must be a list/);
        expect(() => checkBlockSinks([{ x: 3, y: 0 }], 3, 3, 't')).toThrow(/is not a cell of the 3x3 grid/);
        expect(() => checkBlockSinks([{ x: 1, y: 1 }, { x: 1, y: 1 }], 3, 3, 't')).toThrow(/lists \(1,1\) twice/);
    });

    it('serializeMazeEntities ⇄ deserializeMazeWorld carries the sinks; a world without them emits none', () => {
        const w = picture(['#####', '#PBw#', '#####']);
        const out = serializeMazeEntities(w);
        expect(out.block_sinks).toEqual([{ x: 3, y: 1 }]);
        const back = deserializeMazeWorld({ ...out, width: w.width, height: w.height, tiles: [...w.tiles],
            entrance: w.entrance, exits: [{ exit_id: 'exit', x: 1, y: 1 }],
            obstacles: [{ x: 3, y: 1, id: 'water' }], items: [], obstacleLib: w.obstacleLib });
        expect(sinksBlock(back, 3, 1)).toBe(true);
        expect('block_sinks' in serializeMazeEntities(picture(['#####', '#PBv#', '#####']))).toBe(false);
    });

    it('blocksAfterPush moves a block, or drops it on a sink', () => {
        const w = picture(['######', '#PB.w#', '######']);
        expect(blocksAfterPush(w, ['2,1', '9,9'], '2,1', '3,1')).toEqual(['3,1', '9,9']);
        expect(blocksAfterPush(w, ['2,1', '9,9'], '2,1', '4,1')).toEqual(['9,9']);
    });
});

describe('a block pushed onto a sink is gone; the water stays water', () => {
    it('the push into the water is legal without Swim, and the block leaves the state', () => {
        const w = picture(['######', '#P.Bw#', '######']);
        const s = step(w, createState(w), INPUT_E);
        const pushed = step(w, s, INPUT_E);
        expect(pushed).not.toBeNull();
        expect(pushed.player_pos).toEqual({ x: 3, y: 1 });
        expect(pushed.blocks).toEqual([]);
        expect(step(w, pushed, INPUT_E)).toBeNull();
        expect(whyBlocked(w, pushed, INPUT_E)).toMatch(/^water is shut/);
    });

    it('without the sink the same push is refused, by name', () => {
        const w = picture(['######', '#P.Bv#', '######']);
        const s = step(w, createState(w), INPUT_E);
        expect(step(w, s, INPUT_E)).toBeNull();
        expect(whyBlocked(w, s, INPUT_E)).toMatch(/^block at \(3,1\) cannot move: water is shut/);
    });

    it("L8's shape: the exit is reached empty-handed only because the block sinks", () => {
        expect(reachesExit(picture(LANE), new Set())).toBe(true);
        expect(reachesExit(picture(LANE, { sinks: false }), new Set())).toBe(false);
        expect(reachesExit(picture(LANE, { sinks: false }), new Set([SWIM]))).toBe(true);
    });

    it('a walk that sinks a block REQUIRES nothing for the water it shoved it into', () => {
        const w = picture(['######', '#P.Bw#', '######']);
        const { requires } = deriveRequires(w, createState(w), [moveEntry('E'), moveEntry('E')]);
        expect(requires).toEqual([]);
    });
});

describe('whyBlocked ⇔ step and scripted ≡ native over every reachable (state, input) with sinks', () => {
    for (const [name, rows] of [['lane', LANE], ['two blocks, one sink', ['########', '#P.B.Bw#', '#......#', '########']]]) {
        for (const inv of [[], [SWIM]]) {
            it(`${name}, holding [${inv}]`, () => {
                const w = picture(rows);
                let sank = 0;
                for (const s of reachable(w, new Set(inv))) {
                    for (const input of [...INPUTS, INPUT_WAIT]) {
                        const oracle = step(w, s, input);
                        expect(whyBlocked(w, s, input) === null, `${input}@${mazeVisitedKey(s)}`).toBe(oracle !== null);
                        const { next } = scriptedStep(w, s, input, HELPERS);
                        expect(next === null, `scripted ${input}@${mazeVisitedKey(s)}`).toBe(oracle === null);
                        if (oracle) expect(mazeVisitedKey(next)).toBe(mazeVisitedKey(oracle));
                        if (oracle && oracle.blocks.length < s.blocks.length) sank += 1;
                    }
                }
                expect(sank).toBeGreaterThan(0);
            });
        }
    }

    it('a scripted block_may_enter that forgets the sink is caught', () => {
        const body = HELPERS.block_may_enter.body;
        const forgetful = structuredClone(HELPERS);
        // the real body is an `and` whose third conjunct is `(tile.sink or cleared(...))`: keep `cleared` only
        const i = body.conditions.findIndex((c) => c.type === 'or' && c.conditions.some((d) => d.type === 'helper'));
        expect(i).toBeGreaterThan(-1);
        forgetful.block_may_enter.body.conditions[i] = body.conditions[i].conditions[1];
        const w = picture(['######', '#P.Bw#', '######']);
        const s = step(w, createState(w), INPUT_E);
        expect(step(w, s, INPUT_E)).not.toBeNull();
        expect(scriptedStep(w, s, INPUT_E, forgetful).next).toBeNull();
        expect(scriptedStep(w, s, INPUT_E, HELPERS).next).not.toBeNull();
    });
});

describe('Seedling L8 — the projection lays the water as sinks and the lane opens empty-handed', () => {
    let payload;
    beforeAll(() => {
        const rules = JSON.parse(buildPlaythroughMaze({ levels: ['level_7', 'level_8', 'level_9'] }).text);
        payload = rules.preset_sidecars['1'].level_8.playable_payload;
    }, 300_000);

    it('block_sinks holds the water beside the lane block (5,7); a level world without a block carries none', () => {
        expect(payload.blocks).toEqual([{ x: 7, y: 3 }, { x: 6, y: 7 }]);
        expect(payload.block_sinks).toContainEqual({ x: 5, y: 7 });
        const committed = JSON.parse(readFileSync(new URL('../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json',
            import.meta.url), 'utf8'));
        for (const [name, sc] of Object.entries(committed.preset_sidecars['1'])) {
            if (!sc.playable_payload?.blocks) expect(sc.playable_payload?.block_sinks, name).toBeUndefined();
        }
    });

    it('from its arrival, L8 reaches its exit to L9 holding nothing', () => {
        const w = deserializeMazeWorld(payload);
        const exit = payload.exits.find((e) => e.targetRegion === 'level_9');
        const states = reachable({ ...w, items: new Map() }, new Set());
        expect(states.some((s) => s.player_pos.x === exit.x && s.player_pos.y === exit.y)).toBe(true);
    });
});
