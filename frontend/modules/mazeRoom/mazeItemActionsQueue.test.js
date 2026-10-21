/**
 * ITEM ACTIONS in the queue (slice tile-primitives-item-actions): the `turn` /
 * `use` / `cross` entry kinds, their key binding, the executor, the recording
 * fold rules and `deriveRequires`.
 */

import { describe, it, expect } from 'vitest';
import { createState } from './mazeRoomEngine.js';
import {
    KEY_MAP, keyToMazeEntry, useKeyBindings, describeMazeAction,
    moveEntry, turnEntry, useEntry, crossEntry, waitEntry, ACTION_TYPES,
} from './mazeKeys.js';
import {
    executeMazeEntry, projectActions, expandEntries, deriveRequires,
} from './mazeQueueExecutor.js';
import {
    itemActionPicture, ROCK_CORRIDOR, SWORD, SWORD_ACTION_LIB,
} from './mazeItemActions.fixtures.js';

const run = (world, state, entries) => entries.reduce((s, e) => {
    const { next, reason } = executeMazeEntry(world, s, e);
    if (next === null) throw new Error(reason);
    return next;
}, state);

const CROSS = { boundary: 'b_r1c5_r1c9', sourceRegion: 'r1c5', targetRegion: 'r1c9' };

describe('keys', () => {
    it('Shift+arrow turns and Z uses — only on an item-action world', () => {
        expect(keyToMazeEntry({ key: 'ArrowUp', shiftKey: true }, SWORD_ACTION_LIB)).toEqual(turnEntry('N'));
        expect(keyToMazeEntry({ key: 'ArrowRight', shiftKey: true }, SWORD_ACTION_LIB)).toEqual(turnEntry('E'));
        expect(keyToMazeEntry({ key: 'z' }, SWORD_ACTION_LIB)).toEqual(useEntry('sword'));
        expect(keyToMazeEntry({ key: 'Z', shiftKey: true }, SWORD_ACTION_LIB)).toEqual(useEntry('sword'));
        expect(keyToMazeEntry({ key: 'ArrowUp' }, SWORD_ACTION_LIB)).toEqual(moveEntry('N'));
        // ⛔ elsewhere nothing moved: Shift+arrow still moves, z is unbound
        expect(keyToMazeEntry({ key: 'ArrowUp', shiftKey: true }, {})).toEqual(KEY_MAP.ArrowUp);
        expect(keyToMazeEntry({ key: 'z' }, {})).toBeNull();
        expect(keyToMazeEntry({ key: ' ' }, undefined)).toEqual(waitEntry());
    });

    it('unkeyed entries take the free defaults Z X C V in id order; a clash is refused', () => {
        const lib = {
            sword: { item: 'Sword', primitive: 'strike', key: 'z' },
            bomb: { item: 'Bomb', primitive: 'strike' },
            axe: { item: 'Axe', primitive: 'strike' },
        };
        expect(useKeyBindings(lib)).toEqual({ z: 'sword', x: 'axe', c: 'bomb' });
        expect(() => useKeyBindings({ a: { key: 'x' }, b: { key: 'X' } }))
            .toThrow("action_lib: a and b are both bound to 'x'");
    });

    it('the vocabulary and its sentences', () => {
        expect(ACTION_TYPES).toEqual(['move', 'wait', 'locationCheck', 'turn', 'use', 'cross']);
        expect(describeMazeAction(turnEntry('W'))).toBe('turn W');
        expect(describeMazeAction(useEntry('sword'))).toBe('use sword');
        expect(describeMazeAction(crossEntry('E', CROSS))).toBe('cross E → r1c9');
        expect(crossEntry('E', CROSS)).toEqual({
            actionType: 'cross', actionId: 'E', substrate: 'maze', params: CROSS,
        });
    });
});

describe('executor', () => {
    it('turn and use run through the engine; a use without the item is refused with the engine sentence', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const s = run(w, createState(w), [moveEntry('E'), moveEntry('E'), turnEntry('E')]);
        expect(s.facing).toBe('E');
        const r = executeMazeEntry(w, s, useEntry('sword'));
        expect(r.next).toBeNull();
        expect(r.reason).toBe(`use sword blocked: use sword needs ${SWORD}`);
        const held = executeMazeEntry(w, s, useEntry('sword'), { inventoryOverride: new Set([SWORD]) });
        expect(held.next.broken).toEqual(['4,1']);
    });

    it('a refused move carries `faced` on an item-action world, and not elsewhere', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const r = executeMazeEntry(w, createState(w), moveEntry('N'));
        expect(r.next).toBeNull();
        expect(r.reason).toBe('move N blocked: wall at (1,0)');
        expect(r.faced.facing).toBe('N');
        const plain = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        expect('faced' in executeMazeEntry(plain, createState(plain), moveEntry('N'))).toBe(false);
    });

    it('cross: the gate is asked BEFORE the step, with the entry\'s own regions', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const s = createState(w);
        const asked = [];
        // a cross into a WALL: a gate that refuses wins, so the gate ran first
        const gated = executeMazeEntry(w, s, crossEntry('N', CROSS), {
            gate: (c) => { asked.push(c); return 'loop mode expects r1c5'; },
        });
        expect(asked).toEqual([CROSS]);
        expect(gated.next).toBeNull();
        expect(gated.reason).toBe('cross N → r1c9 gated: loop mode expects r1c5');
        expect(executeMazeEntry(w, s, crossEntry('N', CROSS), { gate: () => false }).reason)
            .toBe('cross N → r1c9 gated: the loop-mode action gate refused it');
        // the gate passes → the engine step decides; the crossing rides out
        const ok = executeMazeEntry(w, s, crossEntry('E', CROSS), { gate: () => true });
        expect(ok.next.player_pos).toEqual({ x: 2, y: 1 });
        expect(ok.crossing).toEqual(CROSS);
        const wall = executeMazeEntry(w, s, crossEntry('N', CROSS), { gate: () => true });
        expect(wall.reason).toBe('cross N → r1c9 blocked: wall at (1,0)');
        expect(wall.faced.facing).toBe('N');
    });

    it('cross without its params is refused by name', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const r = executeMazeEntry(w, createState(w), { actionType: 'cross', actionId: 'E', substrate: 'maze' });
        expect(r.reason).toBe('cross E → ? refused: a cross entry needs params {boundary, sourceRegion, targetRegion}');
    });
});

describe('recording fold rules', () => {
    it('turn and use fold like moves; cross never folds and keeps its regions', () => {
        const live = [
            useEntry('sword'), useEntry('sword'), turnEntry('E'), turnEntry('E'),
            crossEntry('E', CROSS), crossEntry('E', CROSS), moveEntry('E'),
        ];
        const rec = projectActions(live);
        expect(rec).toEqual([
            { actionType: 'use', actionId: 'sword', substrate: 'maze', loops: 2 },
            { actionType: 'turn', actionId: 'E', substrate: 'maze', loops: 2 },
            { actionType: 'cross', actionId: 'E', substrate: 'maze', params: CROSS, loops: 1 },
            { actionType: 'cross', actionId: 'E', substrate: 'maze', params: CROSS, loops: 1 },
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 1 },
        ]);
        expect(expandEntries(rec).map((e) => describeMazeAction(e)))
            .toEqual(live.map((e) => describeMazeAction(e)));
    });

    it('a refused cross keeps BOTH its regions and the refused mark', () => {
        const rec = projectActions([{ ...crossEntry('N', CROSS), status: { state: 'failed' } }]);
        expect(rec[0].params).toEqual({ ...CROSS, refused: true });
    });
});

describe('deriveRequires', () => {
    it('a walk that strikes the rock requires the sword it carried in', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const start = createState(w);
        start.inventory.add(SWORD);
        const walkActions = [moveEntry('E'), moveEntry('E'), turnEntry('E'), useEntry('sword'),
            moveEntry('E'), moveEntry('E')];
        const { requires } = deriveRequires(w, start, walkActions);
        expect(requires).toEqual([SWORD]);
    });

    it('…and not when the walk picked the sword up on the way', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const walkActions = ['S', 'E', 'N', 'E'].map((d) => moveEntry(d))
            .concat([turnEntry('E'), useEntry('sword'), moveEntry('E'), moveEntry('E')]);
        const end = run(w, createState(w), walkActions);
        expect(end.player_pos).toEqual({ x: 5, y: 1 });
        expect(deriveRequires(w, createState(w), walkActions).requires).toEqual([]);
    });

    it('a refused bump turns the walk (faced) so a later use strikes the right cell', () => {
        const w = itemActionPicture(ROCK_CORRIDOR);
        const start = createState(w);
        start.inventory.add(SWORD);
        // walk to (3,1), bump NORTH into the wall (refused, faces N), then use: it hits AIR
        const s = run(w, start, [moveEntry('E'), moveEntry('E')]);
        const bump = executeMazeEntry(w, s, moveEntry('N'));
        expect(bump.faced.facing).toBe('N');
        expect(executeMazeEntry(w, bump.faced, useEntry('sword')).next.broken).toEqual([]);
        // deriveRequires follows the same turned walk: the swing is accepted (needs the sword)
        const acts = [moveEntry('E'), moveEntry('E'), moveEntry('N'), useEntry('sword')];
        expect(deriveRequires(w, start, acts).requires).toEqual([SWORD]);
    });
});

describe('the maze lab replays item actions', () => {
    it('framesForActions: frames carry facing / broken only on an item-action world', async () => {
        const { framesForActions } = await import('./mazeLab.js');
        const w = itemActionPicture(ROCK_CORRIDOR);
        const lab = { record: w, palette: { items: [SWORD] } };
        const frames = framesForActions(lab, [
            moveEntry('E'), moveEntry('E'),
            { ...moveEntry('N'), params: { refused: true } },   // a recorded bump
            turnEntry('E'), useEntry('sword'), moveEntry('E'),
        ]);
        expect(frames.map((f) => `${f.player.x},${f.player.y} ${f.facing} ${f.broken.join(';')}`)).toEqual([
            '1,1 S ', '2,1 E ', '3,1 E ', '3,1 N ', '3,1 E ', '3,1 E 4,1', '4,1 E 4,1',
        ]);
        const plain = itemActionPicture(ROCK_CORRIDOR, { actionLib: null });
        const plainFrames = framesForActions({ record: plain }, [moveEntry('E')]);
        expect('facing' in plainFrames[1]).toBe(false);
        expect('broken' in plainFrames[1]).toBe(false);
    });
});
