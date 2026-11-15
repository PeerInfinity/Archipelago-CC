/**
 * PER-ACTION STANCES in the engine (session tile-fire-breaks-rocks): an obstacle entry's `struck_from` names, per
 * action, the stances that action strikes it from; an action it is `struck_by` but does NOT name there strikes it
 * through its cells, as before. Seedling's ordinary rock is the case: the Sword's slash hits it through its cell
 * (`Player.as:924` → `genericHit`), the flame only from a tile whose flame reaches that rock and no other responder
 * (`Player.as:1015-1035`, the rules' own `rockFireSides`). The scripted step agrees with the native one on every
 * reachable state.
 */

import { describe, it, expect } from 'vitest';
import {
    createWorld, setTile, TILE_WALL, setObstacle, createState, step, mazeVisitedKey, worldInputs, INPUT_S,
    useInput, turnInput, strikeTargets, stanceStrikes, serializeMazeEntities, deserializeMazeWorld,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const SWORD = 'Progressive Sword';
const FIRE = 'Fire';
const EIGHT = Object.freeze([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]);
const ACTIONS = Object.freeze({
    sword: Object.freeze({ item: SWORD, primitive: 'strike', condition: 'strikes', key: 'x' }),
    fire: Object.freeze({
        item: FIRE, primitive: 'strike', condition: 'strikes', key: 'f',
        footprint: Object.freeze({ N: EIGHT, E: EIGHT, S: EIGHT, W: EIGHT }),
    }),
});

/**
 * A corridor west (1,1)-(2,1), the rock (3,1), east (4,1)-(5,1). The flame's only stance is (5,1), EAST of the rock:
 * the west side (2,1) has a second responder in its flame in the game, so the census gives it none. The sword
 * breaks it from either side; Fire only from the east.
 */
function rockPicture({ stances = ['5,1,N', '5,1,E', '5,1,S', '5,1,W'] } = {}) {
    const rows = ['#######', '#.....#', '#######'];
    const w = createWorld(7, 3, { entrance: { x: 1, y: 1 }, exits: [{ exit_id: 'exit', x: 5, y: 1 }], actionLib: ACTIONS });
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 7; x++) if (rows[y][x] === '#') setTile(w, x, y, TILE_WALL);
    w.obstacleLib = {
        ...w.obstacleLib,
        rock_3_1: {
            id: 'rock_3_1', kind: 'rock', clear_set: [], struck_by: ['sword', 'fire'], struck_from: { fire: stances }, at: '3,1',
        },
    };
    setObstacle(w, 3, 1, 'rock_3_1');
    return w;
}
const at = (world, x, y, facing, items) => ({ ...createState(world), inventory: new Set(items), player_pos: { x, y }, facing });

describe('a rock struck through its cell by the sword and from its stances by Fire', () => {
    const world = rockPicture();

    it('the sword strikes it through its cell from the west', () => {
        expect(strikeTargets(world, at(world, 2, 1, 'E', [SWORD]), 'sword')).toEqual(['3,1']);
    });

    it("Fire's footprint covers it from the west, but the west is no stance: nothing breaks", () => {
        expect(strikeTargets(world, at(world, 2, 1, 'E', [FIRE]), 'fire')).toEqual([]);
        expect(stanceStrikes(world, at(world, 2, 1, 'E', [FIRE]), 'fire')).toEqual([]);
    });

    it('Fire from the east stance breaks it whatever the facing; the cell next to it is not a stance', () => {
        for (const f of ['N', 'E', 'S', 'W']) expect(strikeTargets(world, at(world, 5, 1, f, [FIRE]), 'fire')).toEqual(['3,1']);
        expect(strikeTargets(world, at(world, 4, 1, 'W', [FIRE]), 'fire')).toEqual([]);
        const s = step(world, at(world, 5, 1, 'W', [FIRE]), useInput('fire'));
        expect(s.broken).toEqual(['3,1']);
        expect(step(world, { ...s, player_pos: { x: 4, y: 1 } }, 'W').player_pos).toEqual({ x: 3, y: 1 });
    });

    it('an entry naming EVERY action it is struck by in struck_from is struck from stances only (the pole shape)', () => {
        const all = rockPicture();
        all.obstacleLib.rock_3_1 = { ...all.obstacleLib.rock_3_1, struck_from: { fire: ['5,1,W'], sword: ['4,1,W'] } };
        expect(strikeTargets(all, at(all, 2, 1, 'E', [SWORD]), 'sword')).toEqual([]);
        expect(strikeTargets(all, at(all, 4, 1, 'W', [SWORD]), 'sword')).toEqual(['3,1']);
    });

    it('round-trips through the sidecar and refuses an entry with no canonical cell by name', () => {
        const sc = {
            width: world.width, height: world.height, tiles: [...world.tiles], entrance: world.entrance, exits: [...world.exits.values()],
            obstacles: [{ x: 3, y: 1, id: 'rock_3_1' }], items: [], ...serializeMazeEntities(world),
        };
        const back = deserializeMazeWorld({ ...sc, obstacleLib: world.obstacleLib, action_lib: ACTIONS });
        expect(back.obstacleLib.rock_3_1.struck_from).toEqual({ fire: ['5,1,N', '5,1,E', '5,1,S', '5,1,W'] });
        const bad = (entry) => () => deserializeMazeWorld({ ...sc, obstacleLib: { rock_3_1: { ...world.obstacleLib.rock_3_1, ...entry } }, action_lib: ACTIONS });
        expect(bad({ at: undefined })).toThrow(/needs one canonical cell/);
        expect(bad({ struck_from: { spear: ['5,1,W'] } })).toThrow(/names "spear", which the entry is not struck_by/);
    });
});

describe('scripted ≡ native over every reachable state of the rock picture', () => {
    for (const [name, items, expectBreak] of [['nothing', [], false], ['sword', [SWORD], true], ['fire', [FIRE], false], ['both', [SWORD, FIRE], true]]) {
        it(name, () => {
            // Fire alone never reaches the east stance (the rock is between): no break from the west.
            const world = rockPicture();
            const start = { ...createState(world), inventory: new Set(items) };
            const seen = new Map([[mazeVisitedKey(start), start]]);
            const queue = [start];
            let strikes = 0;
            while (queue.length) {
                const s = queue.shift();
                for (const input of [...worldInputs(world), INPUT_S, turnInput('E')]) {
                    const native = step(world, s, input);
                    const { next } = scriptedStep(world, s, input, HELPERS);
                    expect(next === null ? null : mazeVisitedKey(next), `${input}@${mazeVisitedKey(s)}`)
                        .toBe(native === null ? null : mazeVisitedKey(native));
                    if (native && native.broken?.length > (s.broken?.length ?? 0)) strikes += 1;
                    if (native && !seen.has(mazeVisitedKey(native))) { seen.set(mazeVisitedKey(native), native); queue.push(native); }
                }
            }
            expect(strikes > 0).toBe(expectBreak);
        });
    }
});
