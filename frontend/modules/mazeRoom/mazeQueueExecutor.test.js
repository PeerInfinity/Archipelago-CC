import { describe, it, expect } from 'vitest';

import {
    TILE_WALL,
    createWorld, createState,
    setTile, setObstacle, setItem, setBlock, setButton,
} from './mazeRoomEngine.js';
import { startStateFor } from './procgenMaze.js';
import {
    ACTION_MOVE, ACTION_WAIT, ACTION_LOCATION_CHECK,
    moveEntry, waitEntry, locationCheckEntry, describeMazeAction, KEY_MAP, DIRECTIONS,
} from './mazeKeys.js';
import {
    deriveRequires,
    executeMazeEntry,
    expandEntries,
    expandedLength,
    intendedTileFor,
    isRefused,
    mazeWorldDigest,
    projectActions,
    refuseReplayPreconditions,
    stampRecordingPreconditions,
    MOVE_DIR_TO_INPUT,
} from './mazeQueueExecutor.js';

// ---------------------------------------------------------------------------
// Three fixture worlds, READ rather than assembled (the mazeRoomEngine test's
// `picture` convention). One character per tile:
//   '#' wall · '.' floor · 'P' entrance · 'X' exit
//   'R' door_red · 'K' key_red · 'B' a pushable block
// ---------------------------------------------------------------------------

/** ⛓ SLICE R-b — the gadget's per-instance entries, the engine test's own
 *  (`mazeRoomEngine.test.js`): a door cleared by a HOLD, the button that holds
 *  it, and a flag the walk picks up. ⛔ `shared/procgen/library.js` is not
 *  touched by this arc — these ride on the world's own copies. */
const DOOR_A_ENTRY = {
    name: 'Door A', id: 'door_A', clear_set_type: 'combo_list', clear_set: [['sw_A']],
};
const BUTTON_A_ENTRY = { name: 'Button A', id: 'button_A', kind: 'button', holds: 'sw_A' };
const FLAG_B_ENTRY = { name: 'Flag B', id: 'flag_B', kind: 'flag', classification: 'progression' };

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
    w.obstacleLib = { ...w.obstacleLib, door_A: DOOR_A_ENTRY };
    w.itemLib = { ...w.itemLib, flag_B: FLAG_B_ENTRY };
    w.buttonLib = { button_A: BUTTON_A_ENTRY };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const c = rows[y][x];
            if (c === '#') setTile(w, x, y, TILE_WALL);
            if (c === 'B') setBlock(w, x, y);
            if (c === 'b') setButton(w, x, y, 'button_A');
            if (c === 'D') setObstacle(w, x, y, 'door_A');
            if (c === 'F') setItem(w, x, y, 'flag_B');
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

    // ⛓⛓ S2b — THE REASON IS THE ENGINE'S. `refusalReason` delegates to
    // `mazeRoomEngine.whyBlocked`, so a wall and an off-grid target are now two
    // different sentences (they were one, `wall or off-grid`, because the old
    // derivation only had `isFloor` to ask).
    it('a move into a wall is REFUSED, and the reason names the WALL and its cell', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, moveEntry('N'));
        expect(next).toBeNull();
        expect(reason).toBe('move N blocked: wall at (1,0)');
    });

    it('an off-grid move is refused rather than throwing, and says so BY NAME', () => {
        const world = picture(['P.', '..']);
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, moveEntry('N'));
        expect(next).toBeNull();
        expect(reason).toBe('move N blocked: off the grid');
    });

    // ⛓ S2a — a wait is an ENGINE transition now: `step(world, state,
    // INPUT_WAIT)` returns a NEW state with `turn + 1`. Before this slice it
    // returned `state` itself and the CALLER was expected to pass the turn.
    it('a wait is an ENGINE transition: a NEW state, turn + 1, no reason', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, waitEntry());
        expect(reason).toBeNull();
        expect(next).not.toBe(state);
        expect(next.turn).toBe(state.turn + 1);
        expect(next.player_pos).toEqual(state.player_pos);
        expect([...next.inventory]).toEqual([...state.inventory]);
    });

    it('a wait picks NOTHING up while standing on an item tile', () => {
        const world = doorKey();
        const state = createState(world);
        const onKey = executeMazeEntry(world, state, moveEntry('E')).next;
        expect([...onKey.inventory]).toEqual(['key_red']);
        const empty = { ...onKey, inventory: new Set() };
        const waited = executeMazeEntry(world, empty, waitEntry()).next;
        expect([...waited.inventory]).toEqual([]);
        expect(waited.turn).toBe(empty.turn + 1);
    });

    it('a wait leaves `blocks` alone — nothing is pushed', () => {
        const world = guardGadget();
        const state = createState(world);
        const waited = executeMazeEntry(world, state, waitEntry()).next;
        expect(waited.blocks).toEqual(state.blocks);
        // ...and the SAME state pushes when the entry is the move, so the
        // fixture's blocks really are reachable from here.
        const pushed = executeMazeEntry(world, state, moveEntry('E')).next;
        expect(pushed.blocks).not.toEqual(state.blocks);
    });

    it('N waits advance the turn by N — the executor is the only author', () => {
        const world = openRoom();
        let state = createState(world);
        for (let i = 0; i < 4; i++) {
            state = executeMazeEntry(world, state, waitEntry()).next;
        }
        expect(state.turn).toBe(4);
        expect(state.player_pos).toEqual(createState(world).player_pos);
    });

    it('a locationCheck is a no-op for the engine — the publish is the panel\'s', () => {
        const world = openRoom();
        const state = createState(world);
        const { next, reason } = executeMazeEntry(world, state, locationCheckEntry('Sword'));
        // ⛓ `next === state` is now the locationCheck's ALONE: it is the one
        // verb the engine has no opinion about. A wait no longer answers this
        // way (see the S2a rows above), so no caller may read `next === state`
        // as "the entry did nothing".
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
        // ⛓ S2b: the door's own sentence, with WHAT IT NEEDS — the old form
        // could only name the obstacle id, because `effectiveInventory` is
        // engine-private and the executor would not re-derive it.
        expect(barred.reason).toBe('move E blocked: door_red is shut — needs key_red');
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

    it('a push into a wall names the BLOCK and what is beyond it — the target '
        + 'cell is open floor and neither a wall nor an obstacle refused it', () => {
        const world = guardGadget();
        let state = createState(world);
        state = executeMazeEntry(world, state, moveEntry('E')).next; // block to (3,1)
        const stuck = executeMazeEntry(world, state, moveEntry('E'));
        expect(stuck.next).toBeNull();
        // ⛓ S2b: the old derivation fell through to a bare `blocked at (3,1)`
        // here — floor, no obstacle, and nothing left to say. `whyBlocked` walks
        // `step`'s own push guards, so the sentence names the block AND the
        // reason it cannot move.
        expect(stuck.reason).toBe('move E blocked: block at (3,1) cannot move: beyond is a wall');
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE R-b — RECORDING PRECONDITIONS (census gaps R3 + R4)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ The S2b property fixture, VERBATIM: the key is OFF the route, so the door
 * is reachable BEFORE the key is. That is what lets one walk (key, then door)
 * answer `[]` and another (booted holding the key, straight at the door) answer
 * `['key_red']` on the SAME level — a fixture on which every route picks the key
 * up first could not tell the two apart (mutant (c)'s lesson, one level down).
 */
const doorKeyOffRoute = () => picture([
    '######',
    '#P.R.#',
    '#.K..#',
    '######',
]);

/** ⛓ The 7×7 guard gadget — a door held by a BUTTON and a FLAG to collect. */
const pushLane = () => picture([
    '#######',
    '#P....#',
    '##.B#.#',
    '##....#',
    '##b#.##',
    '####DF#',
    '#######',
]);

const moves = (...dirs) => dirs.map((d) => moveEntry(d));

describe('mazeWorldDigest — R4, the level a walk was driven on', () => {
    it('two identical levels agree, and one changed tile moves it', () => {
        const a = doorKeyOffRoute();
        const b = doorKeyOffRoute();
        expect(mazeWorldDigest(a)).toBe(mazeWorldDigest(b));
        expect(mazeWorldDigest(a)).toMatch(/^[0-9a-f]{8}$/);
        setTile(b, 4, 1, TILE_WALL);
        expect(mazeWorldDigest(b)).not.toBe(mazeWorldDigest(a));
    });

    it('an OVERLAY change moves it too — a level is not only its tiles', () => {
        const a = doorKeyOffRoute();
        const b = doorKeyOffRoute();
        setItem(b, 4, 1, 'key_red');
        expect(mazeWorldDigest(b)).not.toBe(mazeWorldDigest(a));
    });

    /**
     * ⛔ THE PIN, AND THE COMMAND THAT PRODUCED IT. The S2b manual-arm subject
     * room — `lab.html?seed=1&width=5&height=5&skeleton=winding`, the room
     * `check-maze-lab` CLAIM 22 drives by keyboard — at the SKELETON rung:
     *
     *   node --input-type=module -e "
     *     const {generateStep, readLabParams} =
     *       await import('./frontend/modules/mazeRoom/mazeLab.js');
     *     const {mazeWorldDigest} =
     *       await import('./frontend/modules/mazeRoom/mazeQueueExecutor.js');
     *     const p = readLabParams('seed=1&width=5&height=5&skeleton=winding');
     *     console.log(mazeWorldDigest(generateStep({ ...p, step: 0 }).record));"
     *
     * ⚠ It moves if `serializeMazeLevel`'s bytes move, if the FNV constants
     * move, or if that seed's skeleton moves — which is exactly what a pin is
     * for. The level itself is asserted here so a reader can see WHAT is hashed
     * rather than only the hash.
     */
    it('the S2b subject room hashes to 8223c3a9 (the pin)', () => {
        const w = createWorld(5, 5, {
            entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'goal', x: 1, y: 3 }],
        });
        const tiles = [0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1];
        for (let i = 0; i < tiles.length; i += 1) {
            if (tiles[i] === TILE_WALL) setTile(w, i % 5, Math.floor(i / 5), TILE_WALL);
        }
        expect(mazeWorldDigest(w)).toBe('8223c3a9');
    });
});

describe('deriveRequires — R3, what the walk had to be carrying', () => {
    it('a walk that collects the key on the way in needs NOTHING carried in', () => {
        const w = doorKeyOffRoute();
        // S, E (onto the key), N, E (through the door)
        expect(deriveRequires(w, startStateFor(w, null), moves('S', 'E', 'N', 'E')))
            .toEqual({ requires: [], why: null });
    });

    it('the SAME level, a walk booted WITH the key straight at the door, needs it', () => {
        const w = doorKeyOffRoute();
        expect(deriveRequires(w, startStateFor(w, ['key_red']), moves('E', 'E')))
            .toEqual({ requires: ['key_red'], why: null });
    });

    it('a walk that never reaches the door needs nothing', () => {
        const w = doorKeyOffRoute();
        expect(deriveRequires(w, startStateFor(w, ['key_red']), moves('E')))
            .toEqual({ requires: [], why: null });
    });

    /**
     * ⛔ THE HOLD IS NOT AN ITEM. The guard gadget's door is cleared by `sw_A`,
     * which `effectiveInventory` derives from the stance every turn and never
     * stores — nothing a replayer could be carrying satisfies it, so naming it
     * in `requires` would mint a refusal no player could ever clear. The FLAG
     * is a pickup, and it is collected ON the walk, so it subtracts out too.
     */
    it('the guard gadget needs NOTHING: the door is a HOLD and the flag a pickup', () => {
        const w = pushLane();
        const plan = ['E', 'E', 'S', 'N', 'E', 'E', 'S', 'S', 'W',
            'W', 'N', 'W', 'S', 'E', 'E', 'S', 'S', 'E'];
        const start = startStateFor(w, null);
        expect(deriveRequires(w, start, moves(...plan))).toEqual({ requires: [], why: null });
    });

    it('a REFUSED turn contributes nothing — the walk did not cross anything', () => {
        const w = doorKeyOffRoute();
        // N is a wall from the entrance; the door is never reached.
        expect(deriveRequires(w, startStateFor(w, ['key_red']), moves('N')))
            .toEqual({ requires: [], why: null });
    });

    /**
     * ⛔ A `rule`-TYPED GATE IS NOT DERIVABLE AND SAYS SO. `clear_set_type:
     * 'rule'` is a Rule Builder expression against an inventory; there is no
     * combination to read off it, and a guess printed as a fact is worse than a
     * recording that admits it does not know. R2 still catches such a walk.
     */
    it('a rule-typed gate answers requires: null WITH a reason naming it', () => {
        const w = doorKeyOffRoute();
        setObstacle(w, 3, 1, 'logic_gate_0');
        w.obstacleLib = {
            ...w.obstacleLib,
            logic_gate_0: {
                id: 'logic_gate_0', clear_set_type: 'rule', clear_rule: { rule: 'True_' },
            },
        };
        const out = deriveRequires(w, startStateFor(w, null), moves('E', 'E'));
        expect(out.requires).toBeNull();
        expect(out.why).toBe('rule-typed gate logic_gate_0 at turn 1');
    });

    /** ⛔ …and only when the walk actually CROSSED it: a rule gate standing
     *  somewhere else on the level is not this walk's problem. */
    it('a rule-typed gate the walk never crosses does not spoil the derivation', () => {
        const w = doorKeyOffRoute();
        setObstacle(w, 4, 1, 'logic_gate_0');
        w.obstacleLib = {
            ...w.obstacleLib,
            logic_gate_0: {
                id: 'logic_gate_0', clear_set_type: 'rule', clear_rule: { rule: 'True_' },
            },
        };
        expect(deriveRequires(w, startStateFor(w, ['key_red']), moves('E', 'E')))
            .toEqual({ requires: ['key_red'], why: null });
    });

    it('an obstacle id the library does not hold is NO gate (isObstacleCleared is permissive)', () => {
        const w = doorKeyOffRoute();
        setObstacle(w, 2, 1, 'door_nobody_declared');
        expect(deriveRequires(w, startStateFor(w, null), moves('E', 'E')))
            .toEqual({ requires: [], why: null });
    });

    it('no world / no start state answers null with a reason rather than throwing', () => {
        expect(deriveRequires(null, null, []).requires).toBeNull();
        expect(deriveRequires(null, null, []).why).toBe('no world or start state to derive from');
    });
});

describe('stampRecordingPreconditions — ONE stamp, both recorders', () => {
    it('writes both fields onto the envelope, in place', () => {
        const w = doorKeyOffRoute();
        const rec = { actions: projectActions(moves('E', 'E')) };
        const out = stampRecordingPreconditions(rec, w, startStateFor(w, ['key_red']));
        expect(out).toBe(rec);
        expect(rec.worldDigest).toBe(mazeWorldDigest(w));
        expect(rec.requires).toEqual(['key_red']);
    });

    /** ⚠ ABSENT, not `null`: a recording saying `requires: null` would be
     *  indistinguishable from one written before this slice, and "this
     *  recording does not say" is the truth in both cases. */
    it('omits `requires` entirely when the walk crossed something underivable', () => {
        const w = doorKeyOffRoute();
        setObstacle(w, 2, 1, 'logic_gate_0');
        w.obstacleLib = {
            ...w.obstacleLib,
            logic_gate_0: {
                id: 'logic_gate_0', clear_set_type: 'rule', clear_rule: { rule: 'True_' },
            },
        };
        const rec = { actions: projectActions(moves('E')) };
        stampRecordingPreconditions(rec, w, startStateFor(w, null));
        expect('requires' in rec).toBe(false);
        expect(typeof rec.worldDigest).toBe('string');
    });
});

describe('refuseReplayPreconditions — the refusal BEFORE step 0', () => {
    it('a recording carrying NEITHER field is still replayable (R2 is the net)', () => {
        const w = doorKeyOffRoute();
        expect(refuseReplayPreconditions({ actions: [] }, { world: w })).toBeNull();
        expect(refuseReplayPreconditions({ actions: [] },
            { world: w, startInventory: new Set() })).toBeNull();
    });

    it('a matching digest and a held requirement pass', () => {
        const w = doorKeyOffRoute();
        const rec = stampRecordingPreconditions(
            { actions: projectActions(moves('E', 'E')) }, w, startStateFor(w, ['key_red']));
        expect(refuseReplayPreconditions(rec, { world: w, startInventory: ['key_red'] }))
            .toBeNull();
    });

    it('a level that MOVED refuses, naming BOTH digests', () => {
        const w = doorKeyOffRoute();
        const rec = stampRecordingPreconditions(
            { actions: projectActions(moves('E', 'E')) }, w, startStateFor(w, ['key_red']));
        const moved = doorKeyOffRoute();
        setTile(moved, 4, 1, TILE_WALL);
        const said = refuseReplayPreconditions(rec,
            { world: moved, startInventory: ['key_red'] });
        expect(said).toContain(`digest ${rec.worldDigest}`);
        expect(said).toContain(`this level is ${mazeWorldDigest(moved)}`);
        expect(said).toContain('the level moved or was edited');
    });

    /** ⛓ The same mismatch on a SELF-CONTAINED document (a lab walk carries its
     *  own level) is not "the level moved" — it is a file somebody edited. */
    it('…and a self-contained walk says the DOCUMENT was edited instead', () => {
        const w = doorKeyOffRoute();
        const rec = stampRecordingPreconditions({ actions: [] }, w, startStateFor(w, null));
        const moved = doorKeyOffRoute();
        setTile(moved, 4, 1, TILE_WALL);
        const said = refuseReplayPreconditions(rec, { world: moved, selfContained: true });
        expect(said).toContain('its own payload is');
        expect(said).toContain('edited by hand after the walk was recorded');
    });

    /** ⛔ EVERY missing id, not the first: a walk short two keys that named one
     *  would send the reader back for a second refusal. */
    it('a missing requirement refuses NAMING EVERY missing id', () => {
        const rec = { requires: ['key_green', 'key_red'] };
        const w = doorKeyOffRoute();
        expect(refuseReplayPreconditions(rec, { world: w, startInventory: [] }))
            .toBe('this walk needs key_green and key_red, and the start inventory holds none of them');
        expect(refuseReplayPreconditions(rec, { world: w, startInventory: ['key_green'] }))
            .toBe('this walk needs key_green and key_red, and the start inventory is missing key_red');
        expect(refuseReplayPreconditions(rec, { world: w, startInventory: ['key_red'] }))
            .toBe('this walk needs key_green and key_red, and the start inventory is missing key_green');
    });

    it('an empty `requires` never refuses, and a Set start inventory is read as one', () => {
        const w = doorKeyOffRoute();
        expect(refuseReplayPreconditions({ requires: [] }, { world: w })).toBeNull();
        expect(refuseReplayPreconditions({ requires: ['key_red'] },
            { world: w, startInventory: new Set(['key_red']) })).toBeNull();
    });

    it('the DIGEST is asked first — a stale level refuses even when the items are held', () => {
        const w = doorKeyOffRoute();
        const rec = stampRecordingPreconditions(
            { actions: projectActions(moves('E', 'E')) }, w, startStateFor(w, ['key_red']));
        const moved = doorKeyOffRoute();
        setTile(moved, 4, 1, TILE_WALL);
        expect(refuseReplayPreconditions(rec, { world: moved, startInventory: ['key_red'] }))
            .toContain('the level moved or was edited');
    });

    it('no recording, or no world, is not a refusal', () => {
        expect(refuseReplayPreconditions(null, { world: doorKeyOffRoute() })).toBeNull();
        expect(refuseReplayPreconditions({ requires: ['key_red'] }, {})).toBeNull();
    });
});
