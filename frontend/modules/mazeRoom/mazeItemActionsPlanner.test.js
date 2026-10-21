/**
 * ITEM ACTIONS in the autopather (⚖ "Plan strikes", slice
 * tile-primitives-item-actions): `planItemActions` plans over the engine's own
 * states, so a walk may turn and strike a rock on its way; the visualizer and
 * the panel's queue mirror both use it on item-action worlds.
 */

import { describe, it, expect } from 'vitest';
import { createState, step, useInput, turnInput } from './mazeRoomEngine.js';
import { planItemActions, inputsToEntries, findPath } from './mazeAutopather.js';
import { executeMazeEntry } from './mazeQueueExecutor.js';
import { moveEntry, turnEntry, useEntry, waitEntry } from './mazeKeys.js';
import { MazeRoomVisualizer } from './mazeRoomVisualizer.js';
import {
    itemActionPicture, ROCK_CORRIDOR, ACTION_GADGETS, SWORD,
} from './mazeItemActions.fixtures.js';

const replay = (world, state, inputs, inv) => inputs.reduce((s, i) => {
    const n = step(world, s, i, inv);
    if (n === null) throw new Error(`plan refused at ${i}`);
    return n;
}, state);

describe('planItemActions', () => {
    it('strikes the rock on the way, by the shortest input sequence', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const inv = new Set([SWORD]);
        const plan = planItemActions(w, createState(w), { kind: 'exit', exitId: 'exit' }, { inventory: inv });
        // E, E (now facing E at the rock), USE, E, E — the move already faced it
        expect(plan.inputs).toEqual(['E', 'E', useInput('sword'), 'E', 'E']);
        expect(plan.end).toEqual({ x: 5, y: 1 });
        expect(replay(w, createState(w), plan.inputs, inv).player_pos).toEqual({ x: 5, y: 1 });
        // the tile planner cannot: the rock is not a tile fact
        expect(findPath(w, { x: 1, y: 1 }, { kind: 'exit', exitId: 'exit' }, { inventory: inv })).toBeNull();
    });

    it('turns when the approach does not face the rock', () => {
        const w = itemActionPicture([
            '#####',
            '#.r.#',
            '#.P.#',
            '#...#',
            '#####',
        ]);
        w.exits.clear();
        const inv = new Set([SWORD]);
        const s = createState(w);  // facing S, the rock is N
        const plan = planItemActions(w, s, { kind: 'tile', x: 2, y: 1 }, { inventory: inv });
        expect(plan.inputs).toEqual([turnInput('N'), useInput('sword'), 'N']);
    });

    it('with the sword in the room, the plan fetches it first (in-room pickup)', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const plan = planItemActions(w, createState(w), { kind: 'exit', exitId: 'exit' });
        const end = replay(w, createState(w), plan.inputs);
        expect(end.player_pos).toEqual({ x: 5, y: 1 });
        expect(plan.inputs).toContain(useInput('sword'));
        expect(end.inventory.has(SWORD)).toBe(true);
    });

    it('no path under a playback inventory without the sword → null', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        expect(planItemActions(w, createState(w), { kind: 'exit', exitId: 'exit' },
            { inventory: new Set() })).toBeNull();
    });

    it('the gadgets room: block, button and strike in one plan the executor accepts', () => {
        const w = itemActionPicture(ACTION_GADGETS);
        const plan = planItemActions(w, createState(w), { kind: 'exit', exitId: 'exit' });
        expect(plan).not.toBeNull();
        const entries = inputsToEntries(plan.inputs);
        const end = entries.reduce((s, e) => {
            const { next, reason } = executeMazeEntry(w, s, e);
            if (next === null) throw new Error(reason);
            return next;
        }, createState(w));
        expect(end.player_pos).toEqual({ x: 7, y: 4 });
        expect(end.broken).toEqual(['4,2']);
    });

    it('is null on a world without item actions, and refuses hazards by name', () => {
        const plain = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        expect(planItemActions(plain, createState(plain), { kind: 'tile', x: 2, y: 1 })).toBeNull();
        const w = itemActionPicture(ROCK_CORRIDOR);
        w.hazards = [{ shape: 'line', length: 1, tiles: [{ x: 3, y: 2 }], cycleLength: 2, phase: 0 }];
        expect(() => planItemActions(w, createState(w), { kind: 'tile', x: 2, y: 1 }))
            .toThrow(/has hazards; the engine-state planner does not model hazard timing/);
    });

    it('other exits are dead ends under excludeOtherExits', () => {
        const w = itemActionPicture([
            '#######',
            '#P.Y..#',
            '#######',
        ]);
        w.exits.set('other', { exit_id: 'other', x: 3, y: 1 });
        w._exitsByPos = null;
        expect(planItemActions(w, createState(w), { kind: 'tile', x: 5, y: 1 },
            { excludeOtherExits: true })).toBeNull();
        expect(planItemActions(w, createState(w), { kind: 'tile', x: 5, y: 1 }).length).toBe(4);
    });

    it('closestUnexplored ends on the frontier past the rock', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const seen = new Set(['1,1', '2,1', '3,1', '1,2', '2,2', '3,2', '4,2', '5,2']);
        const plan = planItemActions(w, createState(w), { kind: 'closestUnexplored' },
            { seenTiles: seen, inventory: new Set([SWORD]) });
        expect(plan.end).toEqual({ x: 4, y: 1 });
    });

    it('inputsToEntries maps every family', () => {
        expect(inputsToEntries(['N', 'WAIT', turnInput('E'), useInput('sword')]))
            .toEqual([moveEntry('N'), waitEntry(), turnEntry('E'), useEntry('sword')]);
    });
});

describe('the visualizer walks a strike plan', () => {
    it('walkToTile on an item-action world strikes the rock and arrives', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const v = new MazeRoomVisualizer({});
        v.setWorld(w, 'R');
        v.setInventory(new Set([SWORD]));
        v.walkToTile({ x: 5, y: 1 });
        for (let i = 0; i < 5; i++) v.step();
        const st = v.getState();
        expect(st.player_pos).toEqual({ x: 5, y: 1 });
        expect(st.broken).toEqual(['4,1']);
        expect(st.facing).toBe('E');
        expect(v.isStuck()).toBe(false);
    });

    it('getState carries no facing / broken on a plain world', () => {
        const w = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        const v = new MazeRoomVisualizer({});
        v.setWorld(w, 'R');
        const st = v.getState();
        expect('facing' in st).toBe(false);
        expect('broken' in st).toBe(false);
    });
});
