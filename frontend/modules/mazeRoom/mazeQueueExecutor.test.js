import { describe, it, expect } from 'vitest';

import {
    TILE_WALL,
    createWorld, createState,
    setTile, setObstacle, setItem, setBlock,
} from './mazeRoomEngine.js';
import {
    ACTION_MOVE, ACTION_WAIT, ACTION_LOCATION_CHECK,
    moveEntry, waitEntry, locationCheckEntry, describeMazeAction, KEY_MAP, DIRECTIONS,
} from './mazeKeys.js';
import {
    executeMazeEntry,
    expandEntries,
    expandedLength,
    intendedTileFor,
    isRefused,
    projectActions,
    MOVE_DIR_TO_INPUT,
} from './mazeQueueExecutor.js';

// ---------------------------------------------------------------------------
// Three fixture worlds, READ rather than assembled (the mazeRoomEngine test's
// `picture` convention). One character per tile:
//   '#' wall · '.' floor · 'P' entrance · 'X' exit
//   'R' door_red · 'K' key_red · 'B' a pushable block
// ---------------------------------------------------------------------------

function picture(rows) {
    const height = rows.length;
    const width = rows[0].length;
    let entrance = { x: 0, y: 0 };
    let exit = null;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (rows[y][x] === 'P') entrance = { x, y };
            if (rows[y][x] === 'X') exit = { x, y };
        }
    }
    const w = createWorld(width, height, {
        entrance,
        exits: [{ exit_id: 'exit', ...(exit ?? entrance) }],
    });
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const c = rows[y][x];
            if (c === '#') setTile(w, x, y, TILE_WALL);
            if (c === 'B') setBlock(w, x, y);
            if (c === 'R') setObstacle(w, x, y, 'door_red');
            if (c === 'K') setItem(w, x, y, 'key_red');
        }
    }
    return w;
}

/** Fixture 1 — an open room: every move but the walls is legal. */
const openRoom = () => picture([
    '#####',
    '#P..#',
    '#...#',
    '#..X#',
    '#####',
]);

/** Fixture 2 — a door and its key: the same move is refused, then allowed. */
const doorKey = () => picture([
    '######',
    '#PKR.#',
    '######',
]);

/** Fixture 3 — the block gadget: a push, and a push into a wall. */
const guardGadget = () => picture([
    '#####',
    '#PB.#',
    '#####',
]);

describe('mazeQueueExecutor — executeMazeEntry over an OPEN ROOM', () => {
    it('a legal move returns a NEW state one tile along, and no reason', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, moveEntry('E'));
        expect(reason).toBeNull();
        expect(next).not.toBe(state);
        expect(next.player_pos).toEqual({ x: 2, y: 1 });
        expect(next.turn).toBe(1);
        // Pure: the state handed in is untouched.
        expect(state.player_pos).toEqual({ x: 1, y: 1 });
    });

    it('every direction in DIRECTIONS maps to an engine input', () => {
        for (const dir of DIRECTIONS) expect(MOVE_DIR_TO_INPUT[dir]).toBeTruthy();
    });

    it('a move into a wall is REFUSED, and the reason names the target cell', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, moveEntry('N'));
        expect(next).toBeNull();
        expect(reason).toBe('move N blocked at (1,0): wall or off-grid');
    });

    it('an off-grid move is refused rather than throwing', () => {
        const world = picture(['P.', '..']);
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, moveEntry('N'));
        expect(next).toBeNull();
        expect(reason).toContain('wall or off-grid');
    });

    it('a wait passes the turn to the CALLER: same state object, no reason', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, waitEntry());
        // S2a routes this through step(); until then a wait is the caller's
        // turn (mana + hazard tick) around an unchanged engine state.
        expect(next).toBe(state);
        expect(reason).toBeNull();
    });

    it('a locationCheck is a no-op for the engine — the publish is the panel\'s', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, locationCheckEntry('Sword'));
        expect(next).toBe(state);
        expect(reason).toBeNull();
    });

    it('an unknown actionType is refused BY NAME', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, { actionType: 'teleport' });
        expect(next).toBeNull();
        expect(reason).toBe("unknown maze action type 'teleport'");
    });

    it('an unknown move direction is refused BY NAME (the old makeAction throw)', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, { actionType: ACTION_MOVE, actionId: 'NE' });
        expect(next).toBeNull();
        expect(reason).toBe("unknown move direction 'NE'");
    });

    it('no world or state is refused rather than throwing', () => {
        expect(executeMazeEntry(null, null, moveEntry('E'))).toEqual({
            next: null, reason: 'no world or state loaded',
        });
    });
});

describe('mazeQueueExecutor — executeMazeEntry over a DOOR + KEY', () => {
    it('the door refuses and the reason names the OBSTACLE, not just the cell', () => {
        const world = doorKey();
        const state = createState(world);
        // (1,1) P → (2,1) K → (3,1) R. Step onto the key first.
        const onKey = executeMazeEntry(world, state, moveEntry('E')).next;
        expect(onKey.player_pos).toEqual({ x: 2, y: 1 });
        // Without the key in the effective inventory the door refuses.
        const barred = executeMazeEntry(world, { ...onKey, inventory: new Set() }, moveEntry('E'));
        expect(barred.next).toBeNull();
        expect(barred.reason).toBe("move E blocked at (3,1): obstacle 'door_red'");
    });

    it('the SAME entry is allowed once the key is carried', () => {
        const world = doorKey();
        const state = createState(world);
        // No inventoryOverride → step() picks the key up into state.inventory.
        const onKey = executeMazeEntry(world, state, moveEntry('E')).next;
        expect(onKey.inventory.has('key_red')).toBe(true);
        const through = executeMazeEntry(world, onKey, moveEntry('E'));
        expect(through.reason).toBeNull();
        expect(through.next.player_pos).toEqual({ x: 3, y: 1 });
    });

    it('inventoryOverride is the playback-mode truth: state.inventory is NOT '
        + 'consulted and NOT mutated', () => {
        const world = doorKey();
        const state = createState(world);
        state.inventory.add('key_red');
        const onKey = executeMazeEntry(world, state, moveEntry('E'), {
            inventoryOverride: new Set(),
        });
        // The key tile was stepped onto, but the override kept it out.
        expect(onKey.next.inventory.has('key_red')).toBe(true); // cloned from state
        const barred = executeMazeEntry(world, onKey.next, moveEntry('E'), {
            inventoryOverride: new Set(),
        });
        expect(barred.next).toBeNull();
        expect(barred.reason).toContain('door_red');
    });
});

describe('mazeQueueExecutor — executeMazeEntry over the BLOCK gadget', () => {
    it('a push moves the block and the player', () => {
        const world = guardGadget();
        const state = createState(world);
        expect(state.blocks).toEqual(['2,1']);
        const { next, reason } = executeMazeEntry(world, state, moveEntry('E'));
        expect(reason).toBeNull();
        expect(next.player_pos).toEqual({ x: 2, y: 1 });
        expect(next.blocks).toEqual(['3,1']);
    });

    it('a push into a wall is refused with a reason that names NEITHER a wall '
        + 'at the target NOR an obstacle — the target cell is open floor', () => {
        const world = guardGadget();
        let state = createState(world);
        state = executeMazeEntry(world, state, moveEntry('E')).next; // block to (3,1)
        const stuck = executeMazeEntry(world, state, moveEntry('E'));
        expect(stuck.next).toBeNull();
        // (3,1) is floor and carries no obstacle: the refusal falls through to
        // the bare form, which is exactly what whyBlocked (S2b) will replace.
        expect(stuck.reason).toBe('move E blocked at (3,1)');
    });
});

describe('mazeKeys — the vocabulary the panel and the lab share', () => {
    it('KEY_MAP binds arrows and WASD to moves and space to a wait', () => {
        expect(KEY_MAP.ArrowUp).toEqual({ actionType: 'move', actionId: 'N', substrate: 'maze' });
        expect(KEY_MAP.w).toEqual(KEY_MAP.ArrowUp);
        expect(KEY_MAP.W).toEqual(KEY_MAP.ArrowUp);
        expect(KEY_MAP.d).toEqual({ actionType: 'move', actionId: 'E', substrate: 'maze' });
        expect(KEY_MAP[' ']).toEqual({ actionType: 'wait', actionId: null, substrate: 'maze' });
    });

    it('every entry carries the maze substrate stamp, so a cross-substrate '
        + "viewer can tell a maze 'move' from a platformer one", () => {
        for (const entry of Object.values(KEY_MAP)) expect(entry.substrate).toBe('maze');
        expect(locationCheckEntry('L').substrate).toBe('maze');
    });

    it('describeMazeAction is the ONE owner of the wording', () => {
        expect(describeMazeAction(moveEntry('E'))).toBe('move E');
        expect(describeMazeAction(waitEntry())).toBe('wait');
        expect(describeMazeAction(locationCheckEntry('Sword Room'))).toBe('check Sword Room');
        expect(describeMazeAction({ actionType: ACTION_LOCATION_CHECK })).toBe('check');
        expect(describeMazeAction(null)).toBe('');
    });

    it('the ×n suffix is the CALLER\'s: a folded entry still describes as one', () => {
        expect(describeMazeAction(moveEntry('E', 7))).toBe('move E');
    });

    it('intendedTileFor answers where a direction points', () => {
        expect(intendedTileFor({ x: 2, y: 2 }, 'N')).toEqual({ x: 2, y: 1 });
        expect(intendedTileFor({ x: 2, y: 2 }, 'S')).toEqual({ x: 2, y: 3 });
        expect(intendedTileFor({ x: 2, y: 2 }, 'E')).toEqual({ x: 3, y: 2 });
        expect(intendedTileFor({ x: 2, y: 2 }, 'W')).toEqual({ x: 1, y: 2 });
    });
});

describe('mazeQueueExecutor — projectActions / expandEntries (the recording)', () => {
    it('folds a run of identical moves into ONE entry with loops: n', () => {
        const live = [moveEntry('E'), moveEntry('E'), moveEntry('E'), moveEntry('E')];
        expect(projectActions(live)).toEqual([
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 4 },
        ]);
    });

    it('a DIFFERENT direction breaks the run', () => {
        const live = [moveEntry('E'), moveEntry('E'), moveEntry('N'), moveEntry('E')];
        expect(projectActions(live).map((e) => `${e.actionId}:${e.loops}`))
            .toEqual(['E:2', 'N:1', 'E:1']);
    });

    it('a locationCheck NEVER folds — two checks of one location are two events', () => {
        const live = [locationCheckEntry('L'), locationCheckEntry('L')];
        expect(projectActions(live)).toHaveLength(2);
    });

    it('a locationCheck also does not JOIN two runs that surround it', () => {
        const live = [moveEntry('E'), locationCheckEntry('L'), moveEntry('E')];
        expect(projectActions(live).map((e) => `${e.actionType}:${e.loops}`))
            .toEqual(['move:1', 'locationCheck:1', 'move:1']);
    });

    it('ROUND TRIP: 4 E-moves, 3 waits and a check between them fold and '
        + 'expand back to the original entry list', () => {
        const live = [
            moveEntry('E'), moveEntry('E'), moveEntry('E'), moveEntry('E'),
            locationCheckEntry('Sword Room'),
            waitEntry(), waitEntry(), waitEntry(),
        ];
        const folded = projectActions(live);
        expect(folded.map((e) => `${e.actionType}×${e.loops}`))
            .toEqual(['move×4', 'locationCheck×1', 'wait×3']);
        expect(expandEntries(folded))
            .toEqual(live.map((e) => ({ ...e, loops: 1 })));
    });

    it('the projection is BYTE-STABLE across two captures of the same slice '
        + '(no entryId, no status, fixed key order)', () => {
        const live = [moveEntry('E'), moveEntry('E'), locationCheckEntry('L')];
        const a = JSON.stringify(projectActions(live));
        const b = JSON.stringify(projectActions(live));
        expect(a).toBe(b);
        expect(a).not.toContain('entryId');
        expect(a).not.toContain('status');
        expect(a).toBe(
            '[{"actionType":"move","actionId":"E","substrate":"maze","loops":2},'
            + '{"actionType":"locationCheck","actionId":"L","substrate":"maze","loops":1}]',
        );
    });

    it('slices with from/to — the visit recorder records only ITS OWN turns', () => {
        const live = [moveEntry('N'), moveEntry('E'), moveEntry('E'), moveEntry('S')];
        expect(projectActions(live, 1, 3)).toEqual([
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 2 },
        ]);
    });

    it('drops entryId and status that a LIVE entry carries', () => {
        const live = [{
            entryId: 'aq_123_1', actionType: 'move', actionId: 'E',
            substrate: 'maze', loops: 1, disabled: false,
            status: { state: 'completed', loopsCompleted: 1 },
        }];
        expect(projectActions(live)).toEqual([
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 1 },
        ]);
    });

    it('a FAILED entry is KEPT and marked params.refused — it consumed a turn, '
        + 'so dropping it would shift every later hazard phase', () => {
        const live = [
            { ...moveEntry('E'), status: { state: 'completed' } },
            { ...moveEntry('N'), status: { state: 'failed', error: 'wall' } },
            { ...moveEntry('E'), status: { state: 'completed' } },
        ];
        const folded = projectActions(live);
        expect(folded).toEqual([
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 1 },
            {
                actionType: 'move', actionId: 'N', substrate: 'maze',
                params: { refused: true }, loops: 1,
            },
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 1 },
        ]);
        expect(isRefused(folded[1])).toBe(true);
    });

    it('a refused entry does NOT fold with an identical SUCCEEDING one — they '
        + 'are different events', () => {
        const live = [
            { ...moveEntry('E'), status: { state: 'failed', error: 'wall' } },
            { ...moveEntry('E'), status: { state: 'completed' } },
        ];
        expect(projectActions(live)).toHaveLength(2);
    });

    it('two refused entries in a row DO fold', () => {
        const live = [
            { ...moveEntry('E'), status: { state: 'failed' } },
            { ...moveEntry('E'), status: { state: 'failed' } },
        ];
        const folded = projectActions(live);
        expect(folded).toHaveLength(1);
        expect(folded[0]).toMatchObject({ loops: 2, params: { refused: true } });
    });

    it('expandEntries carries params.refused onto every expanded copy', () => {
        const folded = [{
            actionType: 'move', actionId: 'E', substrate: 'maze',
            params: { refused: true }, loops: 3,
        }];
        const out = expandEntries(folded);
        expect(out).toHaveLength(3);
        expect(out.every((e) => e.params.refused === true && e.loops === 1)).toBe(true);
        // Copies, not aliases — a live queue mutating one must not touch the rest.
        expect(out[0].params).not.toBe(out[1].params);
    });

    it('expandedLength is the TURN count a recording replays to', () => {
        expect(expandedLength([moveEntry('E', 7), waitEntry(2)])).toBe(9);
        expect(expandedLength([])).toBe(0);
        expect(expandedLength(null)).toBe(0);
    });

    it('a loops: 0 entry expands to nothing (the shared rule is >= 0, not >= 1)', () => {
        expect(expandEntries([moveEntry('E', 0)])).toEqual([]);
    });

    it('non-entry junk is skipped rather than recorded', () => {
        expect(projectActions([null, 'x', { nope: 1 }, moveEntry('E')]))
            .toEqual([{ actionType: 'move', actionId: 'E', substrate: 'maze', loops: 1 }]);
        expect(projectActions(null)).toEqual([]);
        expect(expandEntries(null)).toEqual([]);
    });

    it('a wait entry keeps actionId null through the round trip', () => {
        const folded = projectActions([waitEntry(), waitEntry()]);
        expect(folded[0]).toEqual({
            actionType: ACTION_WAIT, actionId: null, substrate: 'maze', loops: 2,
        });
        expect(expandEntries(folded)[1].actionId).toBeNull();
    });
});
