/**
 * ITEM ACTIONS in the engine (slice tile-primitives-item-actions, ⚖ 2026-10-21):
 * `facing`, `TURN_<dir>`, `USE:<id>`, the `strike` primitive with per-visit
 * `broken`, and `whyBlocked` sentences for the new refusals.
 */

import { describe, it, expect } from 'vitest';
import {
    createState, createWorld, step, whyBlocked, mazeVisitedKey, INPUTS, INPUT_WAIT,
    INPUT_N, INPUT_E, INPUT_S, INPUT_W,
    turnInput, useInput, worldInputs, hasItemActions, facingAfterBump, strikeTargets,
    serializeMazeEntities, deserializeMazeWorld, setTile, TILE_WALL, checkActionLib,
} from './mazeRoomEngine.js';
import {
    serializeMazeLevel, deserializeMazeLevel, generateMazeLevel, MAZE_PALETTE,
} from './procgenMaze.js';
import { parseAreaSpec } from '../procgenCore/areaSpec.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import {
    itemActionPicture, ROCK_CORRIDOR, ACTION_GADGETS, SWORD, SWORD_ACTION_LIB,
} from './mazeItemActions.fixtures.js';

const walk = (world, state, inputs, inv) => inputs.reduce((s, i) => {
    const n = step(world, s, i, inv);
    if (n === null) throw new Error(`refused ${i} at ${JSON.stringify(s.player_pos)}: ${whyBlocked(world, s, i, inv)}`);
    return n;
}, state);

describe('item actions are OFF on every world without an action_lib (byte-identity)', () => {
    it('a plain world: no facing / broken, inputs unchanged, key literal unchanged', () => {
        const w = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        expect(hasItemActions(w)).toBe(false);
        const s = createState(w);
        expect(Object.keys(s).sort()).toEqual(['inventory', 'player_pos', 'turn']);
        expect(worldInputs(w)).toBe(INPUTS);
        expect(mazeVisitedKey(s)).toBe('1,1|');
        const moved = step(w, s, INPUT_E);
        expect(Object.keys(moved).sort()).toEqual(['inventory', 'player_pos', 'turn']);
        expect(mazeVisitedKey(moved)).toBe('2,1|');
    });

    it('turn and use inputs are refused there, by name, as any unknown input', () => {
        const w = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        const s = createState(w);
        expect(step(w, s, turnInput('N'))).toBeNull();
        expect(step(w, s, useInput('sword'))).toBeNull();
        expect(whyBlocked(w, s, turnInput('N')))
            .toBe("'TURN_N' is not an input on this world — it has no action_lib");
        expect(whyBlocked(w, s, useInput('sword')))
            .toBe("'USE:sword' is not an input on this world — it has no action_lib");
        expect(facingAfterBump(s, INPUT_N)).toBeNull();
    });

    it('serializers emit no action_lib field for such a world', () => {
        const w = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        expect('action_lib' in serializeMazeEntities(w)).toBe(false);
        expect('action_lib' in serializeMazeLevel(w)).toBe(false);
    });

    it('a generated level (seed 2, the Stage 1 room) is unchanged: no action_lib, no facing', () => {
        const world = generateMazeLevel({
            seed: 2, palette: MAZE_PALETTE, width: 15, height: 15,
            skeleton: parseSkeleton('rooms', { simulator: true, substrate: 'the item-actions test' }),
            areas: parseAreaSpec('1'), elements: parseElementSpec('guard;len=2;turns=1'),
        }).record;
        expect(world.blocks.size).toBe(1);
        expect(hasItemActions(world)).toBe(false);
        expect('action_lib' in serializeMazeLevel(world)).toBe(false);
        expect(createState(world).facing).toBeUndefined();
    });

    it('a sidecar without action_lib deserializes to an empty actionLib', () => {
        const w = createWorld(3, 3);
        const sidecar = {
            width: 3, height: 3, tiles: [...w.tiles], entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'exit', x: 2, y: 2 }], obstacles: [], items: [],
        };
        const back = deserializeMazeWorld(sidecar);
        expect(back.actionLib).toEqual({});
        expect(createState(back).facing).toBeUndefined();
    });
});

describe('action_lib round trip and checking', () => {
    it('serializeMazeLevel ⇄ deserializeMazeLevel carries action_lib and the rock entry', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const payload = serializeMazeLevel(w);
        expect(payload.action_lib).toEqual(SWORD_ACTION_LIB);
        const back = deserializeMazeLevel(payload);
        expect(back.actionLib).toEqual(SWORD_ACTION_LIB);
        expect(back.obstacleLib.rock.struck_by).toEqual(['sword']);
        expect(serializeMazeLevel(back)).toEqual(payload);
    });

    it('deserializeMazeWorld reads a sidecar action_lib', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const sidecar = {
            width: w.width, height: w.height, tiles: [...w.tiles], entrance: w.entrance,
            exits: [{ exit_id: 'exit', x: 5, y: 1 }], obstacles: [{ x: 4, y: 1, id: 'rock' }],
            items: [], obstacleLib: { rock: w.obstacleLib.rock }, action_lib: SWORD_ACTION_LIB,
        };
        const back = deserializeMazeWorld(sidecar);
        expect(hasItemActions(back)).toBe(true);
        expect(createState(back).facing).toBe('S');
    });

    it('an unknown primitive is refused by name', () => {
        expect(() => checkActionLib({ hook: { item: 'Hookshot', primitive: 'pull' } }, 'test'))
            .toThrow(/action_lib.hook names primitive "pull"; only 'strike' is modelled/);
    });
});

describe('facing, turn, use, strike', () => {
    it('a fresh state faces S with nothing broken; the key carries both', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const s = createState(w);
        expect(s.facing).toBe('S');
        expect(s.broken).toEqual([]);
        expect(mazeVisitedKey(s)).toBe('1,1||fS|');
    });

    it('a move sets facing; a turn sets it without moving and costs a turn', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const moved = step(w, createState(w), INPUT_E);
        expect(moved.facing).toBe('E');
        const turned = step(w, moved, turnInput('N'));
        expect(turned.player_pos).toEqual(moved.player_pos);
        expect(turned.facing).toBe('N');
        expect(turned.turn).toBe(moved.turn + 1);
    });

    it('a bump: step refuses, facingAfterBump turns (⚖ "Refusal + facing")', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const s = createState(w);
        expect(step(w, s, INPUT_N)).toBeNull();
        const faced = facingAfterBump(s, INPUT_N);
        expect(faced.facing).toBe('N');
        expect(faced.turn).toBe(s.turn);
        expect(faced.player_pos).toEqual(s.player_pos);
    });

    it('the rock is shut until struck; use needs the sword; striking breaks it for this visit', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        let s = walk(w, createState(w), [INPUT_E, INPUT_E]);
        expect(whyBlocked(w, s, INPUT_E)).toBe('rock is shut — strike it (sword)');
        expect(step(w, s, useInput('sword'))).toBeNull();
        expect(whyBlocked(w, s, useInput('sword'))).toBe(`use sword needs ${SWORD}`);
        // fetch the sword (2,2), come back, face E and strike
        s = walk(w, s, [INPUT_S, INPUT_W, INPUT_E, INPUT_N]);
        expect(s.inventory.has(SWORD)).toBe(true);
        expect(s.facing).toBe('N');
        const air = step(w, s, useInput('sword'));
        expect(air.broken).toEqual([]);                 // ⚖ use at air is legal
        expect(air.turn).toBe(s.turn + 1);
        s = walk(w, s, [turnInput('E')]);
        expect(strikeTargets(w, s, 'sword')).toEqual(['4,1']);
        s = walk(w, s, [useInput('sword')]);
        expect(s.broken).toEqual(['4,1']);
        expect(mazeVisitedKey(s)).toMatch(/\|fE\|4,1$/);
        expect(strikeTargets(w, s, 'sword')).toEqual([]);  // already broken
        s = walk(w, s, [INPUT_E, INPUT_E]);
        expect(s.player_pos).toEqual({ x: 5, y: 1 });
        // per visit: a fresh state has the rock back
        expect(createState(w).broken).toEqual([]);
    });

    it('an inventoryOverride is the inventory a use is asked with', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const s = walk(w, createState(w), [INPUT_E, INPUT_E, turnInput('E')], new Set());
        expect(step(w, s, useInput('sword'), new Set())).toBeNull();
        expect(step(w, s, useInput('sword'), new Set([SWORD])).broken).toEqual(['4,1']);
    });

    it('an unknown action id is refused by name', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const s = createState(w);
        expect(step(w, s, useInput('bow'))).toBeNull();
        expect(whyBlocked(w, s, useInput('bow'))).toBe("no action 'bow' in this world's action_lib");
        expect(step(w, s, 'TURN_Q')).toBeNull();
        expect(whyBlocked(w, s, 'TURN_Q')).toBe("'TURN_Q' is not an input");
    });

    it('a block may be pushed through a broken rock, never into a whole one', () => {
        const w = itemActionPicture([
            '#######',
            '#PB.r.#',
            '#######',
        ]);
        let s = createState(w);
        s.inventory.add(SWORD);
        s = walk(w, s, [INPUT_E]);
        expect(s.player_pos).toEqual({ x: 2, y: 1 });
        expect(s.blocks).toEqual(['3,1']);
        expect(step(w, s, INPUT_E)).toBeNull();
        expect(whyBlocked(w, s, INPUT_E))
            .toBe('block at (3,1) cannot move: rock is shut — strike it (sword)');
        // the player cannot reach the rock's face past the block, so break it
        // from a world where the rock starts broken-reachable: strike first
        const open = itemActionPicture(['#######', '#P.rB.#', '#######']);
        let t = createState(open);
        t.inventory.add(SWORD);
        t = walk(open, t, [INPUT_E, turnInput('E'), useInput('sword'), INPUT_E]);
        expect(t.player_pos).toEqual({ x: 3, y: 1 });
        expect(step(open, t, INPUT_E).blocks).toEqual(['5,1']);
    });
});

/** Every state reachable from `createState(world)` by `worldInputs`. */
function reachableStates(world, inv, cap = 20000) {
    const start = createState(world);
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const frontier = [start];
    const inputs = worldInputs(world);
    while (frontier.length > 0) {
        const s = frontier.pop();
        for (const input of inputs) {
            const next = step(world, s, input, inv);
            if (next === null) continue;
            const key = mazeVisitedKey(next);
            if (seen.has(key)) continue;
            seen.set(key, next);
            frontier.push(next);
            if (seen.size > cap) return { states: [...seen.values()], truncated: true };
        }
    }
    return { states: [...seen.values()], truncated: false };
}

describe('whyBlocked ⇔ step over every reachable (state, input) of item-action fixtures', () => {
    const FIXTURES = {
        'the rock corridor': ROCK_CORRIDOR,
        'the action gadgets room': ACTION_GADGETS,
    };
    for (const [name, rows] of Object.entries(FIXTURES)) {
        it(name, () => {
            const world = itemActionPicture(rows);
            const { states, truncated } = reachableStates(world);
            expect(truncated).toBe(false);
            const inputs = [...worldInputs(world), INPUT_WAIT, useInput('bow'), 'TURN_Q'];
            const refusedBy = new Map();
            for (const s of states) {
                for (const input of inputs) {
                    const legal = step(world, s, input) !== null;
                    const why = whyBlocked(world, s, input);
                    expect(`${input}@${mazeVisitedKey(s)} ${why === null}`)
                        .toBe(`${input}@${mazeVisitedKey(s)} ${legal}`);
                    if (!legal) {
                        const kind = why.replace(/\(\d+,\d+\)/g, '(_)');
                        refusedBy.set(kind, (refusedBy.get(kind) ?? 0) + 1);
                    }
                }
            }
            // ⛔ Both sides of each NEW refusal are exercised: a use without the
            // sword, a strike that opens the rock (states with it broken exist).
            expect(refusedBy.get(`use sword needs ${SWORD}`)).toBeGreaterThan(0);
            expect(states.some((s) => s.broken.length > 0)).toBe(true);
            expect(states.some((s) => s.inventory.has(SWORD) && s.broken.length === 0)).toBe(true);
            expect([...refusedBy.keys()].some((k) => k.startsWith('rock is shut'))).toBe(true);
        });
    }

    it('the gadgets room reaches the exit only through a strike', () => {
        const world = itemActionPicture(ACTION_GADGETS);
        const { states } = reachableStates(world);
        const atExit = states.filter((s) => s.player_pos.x === 7 && s.player_pos.y === 4);
        expect(atExit.length).toBeGreaterThan(0);
        expect(atExit.every((s) => s.broken.includes('4,2'))).toBe(true);
        const noActions = itemActionPicture(ACTION_GADGETS, { actionLib: null });
        expect(reachableStates(noActions).states
            .some((s) => s.player_pos.x === 7 && s.player_pos.y === 4)).toBe(false);
    });
});

describe('the wall bump keeps the S2b sentences', () => {
    it('wall / off-grid sentences are unchanged on an action world', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        setTile(w, 1, 2, TILE_WALL);
        const s = createState(w);
        expect(whyBlocked(w, s, INPUT_S)).toBe('wall at (1,2)');
        expect(whyBlocked(w, s, INPUT_W)).toBe('wall at (0,1)');
    });
});
