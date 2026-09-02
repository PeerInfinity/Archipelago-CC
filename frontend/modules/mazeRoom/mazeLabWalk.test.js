/**
 * mazeLabWalk — the maze lab's MANUAL arm, headless (slice S2b).
 *
 * ⛔ Every row here drives the SESSION, never a DOM: the arm's whole point is
 * that "a person drove this walk" is a fact about a queue and a list of frames,
 * and the browser row (`check-maze-lab` CLAIM 22) presses real keys at the
 * other end of the same functions.
 */

import { describe, expect, it } from 'vitest';

import {
    MazeRoomEditor, PALETTE_TYPES, applyEdit, framesForActions, generateStep, labPayload,
} from './mazeLab.js';
import { moveEntry, waitEntry, locationCheckEntry } from './mazeKeys.js';
import { ACTION_QUEUE_FORMAT } from '../shared/actionQueue/actionTypes.js';
import {
    createWalkSession, describeReplayRefusal, refuseWalkDocument, witnessOf,
} from './mazeLabWalk.js';

/**
 * ⛓ THE FIXTURE LEVEL — seed 1 at 5x5, whose oracle plan is exactly
 * `S S S E`: entrance (0,0), goal (1,3), one exit `goal`. ⛔ Read off the
 * generator rather than typed: the plan below is asserted against `solveState`
 * in `mazeLab.test.js`, and a fixture whose route this file INVENTED would go
 * stale the first time the seed's level moved.
 */
const ROOM = { width: 5, height: 5 };
const level = () => generateStep({ seed: 1, step: 0, ...ROOM });
const PLAN = ['S', 'S', 'S', 'E'];

/** …and the same level with `door_red` painted onto the route, plus a starting
 *  `key_red` in the PALETTE. The one construction whose replay can disagree
 *  with its drive (the round trip's own mutant, plan §5.7). */
const doorKeyLevel = () => {
    const base = level();
    const editor = new MazeRoomEditor({
        itemLib: base.record.itemLib,
        obstacleLib: base.record.obstacleLib,
    });
    editor.selectType(PALETTE_TYPES.OBSTACLE);
    editor.selectObstacleId('door_red');
    const { state, result } = applyEdit(base, editor, 0, 2);
    expect(result.ok).toBe(true);
    return Object.freeze({ ...state, palette: { ...state.palette, items: ['key_red'] } });
};

const walkOf = (state, dirs) => {
    const session = createWalkSession(state);
    for (const dir of dirs) session.press(moveEntry(dir));
    return session;
};

describe('createWalkSession — one press, one entry, one frame', () => {
    it('opens with the START frame and nothing else', () => {
        const session = createWalkSession(level());
        expect(session.frames).toHaveLength(1);
        expect(session.frames[0].player).toEqual({ x: 0, y: 0 });
        expect(session.frames[0].turn).toBe(0);
        expect(session.frames[0].input).toBeNull();
        expect(session.queue.length).toBe(0);
        expect(session.moves).toBe(0);
        expect(session.reachedGoal).toBe(false);
    });

    it('a press appends ONE entry, executes it AT ONCE and pushes ONE frame', () => {
        const session = createWalkSession(level());
        const { entry, reason } = session.press(moveEntry('S'));
        expect(reason).toBeNull();
        expect(session.queue.length).toBe(1);
        expect(session.queue.getEntries()[0].entryId).toBe(entry.entryId);
        expect(session.frames).toHaveLength(2);
        expect(session.frames[1].player).toEqual({ x: 0, y: 1 });
        expect(session.frames[1].turn).toBe(1);
        expect(session.moves).toBe(1);
    });

    it('the ORACLE\'s own goal predicate says when the walk arrived', () => {
        const session = walkOf(level(), PLAN);
        expect(session.reachedGoal).toBe(true);
        expect(session.frames).toHaveLength(PLAN.length + 1);
        expect(session.frames.at(-1).player).toEqual({ x: 1, y: 3 });
    });

    it('a spec that is not a queue entry is REFUSED by the shared validator', () => {
        const session = createWalkSession(level());
        expect(() => session.press({ dir: 'N' }))
            .toThrow(/not a queue entry — actionType must be a non-empty string/);
        expect(session.queue.length).toBe(0);
    });

    it('no level, no session — a walk is driven ON a level', () => {
        expect(() => createWalkSession({})).toThrow(/no level on screen/);
    });
});

describe('a REFUSED press is KEPT and MARKED (plan §28)', () => {
    it('the entry stays in the queue, FAILED, and the reason is whyBlocked\'s', () => {
        const session = createWalkSession(level());
        const { reason } = session.press(moveEntry('N')); // (0,0) — off the top edge
        expect(reason).toBe('move N blocked: off the grid');
        expect(session.refused).toBe(1);
        expect(session.moves).toBe(0);
        expect(session.queue.length).toBe(1);
        const entry = session.queue.getEntries()[0];
        expect(session.queue.getStatus(entry.entryId).state).toBe('failed');
    });

    it('…and it pushes a frame EQUAL to the previous engine state, turn included', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('S'));
        const before = session.frames.at(-1);
        session.press(moveEntry('W')); // off the left edge
        const after = session.frames.at(-1);
        expect(session.frames).toHaveLength(3);
        expect(after.player).toEqual(before.player);
        // ⛔ The TURN does not advance: `step` never returned a new state, so
        //   the engine did not tick. A frame that bumped it would be the page
        //   inventing a turn the recording's replay cannot reproduce.
        expect(after.turn).toBe(before.turn);
        expect(after.input.params.refused).toBe(true);
    });

    it('…and the RECORDING keeps it, stamped, because it consumed a turn', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('N'));
        session.press(moveEntry('S'));
        const { actions } = session.fold();
        expect(actions).toEqual([
            { actionType: 'move', actionId: 'N', substrate: 'maze', params: { refused: true }, loops: 1 },
            { actionType: 'move', actionId: 'S', substrate: 'maze', loops: 1 },
        ]);
    });

    it('a refused press REPLAYS as a completion — the round trip is still faithful', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('N'));
        session.press(moveEntry('S'));
        expect(session.roundTrip()).toEqual({ faithful: true, mismatches: [] });
    });
});

describe('WAIT — an engine input, in the lab too (S2a)', () => {
    it('a wait advances the TURN and leaves the player where they were', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('S'));
        const before = session.frames.at(-1);
        const { reason } = session.press(waitEntry());
        expect(reason).toBeNull();
        expect(session.waits).toBe(1);
        expect(session.moves).toBe(1);
        const after = session.frames.at(-1);
        expect(after.player).toEqual(before.player);
        expect(after.turn).toBe(before.turn + 1);
    });

    it('…and a walk with a wait in it round-trips', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('S'));
        session.press(waitEntry());
        session.press(moveEntry('S'));
        expect(session.roundTrip().faithful).toBe(true);
        expect(session.turns).toBe(3);
    });
});

describe('the RECORDING — the loops SavedQueue envelope plus a `lab` block', () => {
    it('fold() names every envelope field, and the LEVEL rides in `lab.payload`', () => {
        const state = level();
        const session = walkOf(state, PLAN);
        const doc = session.fold();
        expect(doc.substrate).toBe('maze');
        expect(doc.format).toBe(ACTION_QUEUE_FORMAT);
        expect(doc.regionName).toBeNull();
        expect(doc.arrivalExitId).toBe('entrance');
        // ⛓ The exit STANDING ON the final cell, asked of the world.
        expect(doc.departureExitId).toBe('goal');
        expect(doc.locationsChecked).toEqual([]);
        expect(doc.manaAtEntry).toBe(0);
        expect(doc.manaAtExit).toBe(0);
        expect(doc.manaMin).toBe(0);
        expect(doc.name).toBe('lab: entrance→goal');
        expect(doc.lab.generator).toBe('frontend/modules/mazeRoom/lab.html');
        expect(doc.lab.author).toBe('hand');
        expect(doc.lab.reachedGoal).toBe(true);
        expect(doc.lab.refused).toBe(0);
        expect(doc.lab.payload).toEqual(labPayload(state));
    });

    it('the actions are FOLDED — a three-step run is ONE entry with `loops: 3`', () => {
        const doc = walkOf(level(), PLAN).fold();
        expect(doc.actions).toEqual([
            { actionType: 'move', actionId: 'S', substrate: 'maze', loops: 3 },
            { actionType: 'move', actionId: 'E', substrate: 'maze', loops: 1 },
        ]);
    });

    it('a walk that did not arrive names no departure and says so in its name', () => {
        const doc = walkOf(level(), ['S']).fold();
        expect(doc.departureExitId).toBeNull();
        expect(doc.name).toBe('lab: entrance→stopped');
        expect(doc.lab.reachedGoal).toBe(false);
    });

    it('`itemsPickedUp` is the FRAMES\' inventory delta, not a second tally', () => {
        const state = doorKeyLevel();
        const session = createWalkSession(state);
        expect(session.frames[0].inventory).toEqual(['key_red']);
        // The palette's starting key was already held, so nothing was PICKED UP.
        expect(session.fold().itemsPickedUp).toEqual([]);
    });

    it('a locationCheck is recorded, never folded, and costs a frame but no TURN', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('S'));
        const before = session.frames.at(-1);
        session.press(locationCheckEntry('a_chest'));
        session.press(locationCheckEntry('a_chest'));
        const doc = session.fold();
        expect(doc.locationsChecked).toEqual(['a_chest', 'a_chest']);
        expect(session.frames).toHaveLength(4);
        expect(session.frames.at(-1).turn).toBe(before.turn);
        expect(session.moves).toBe(1);
    });
});

describe('the ROUND TRIP — the acceptance row', () => {
    it('a hand walk replays to the SAME frames, by every engine field', () => {
        const session = walkOf(level(), PLAN);
        const { faithful, mismatches } = session.roundTrip();
        expect(faithful).toBe(true);
        expect(mismatches).toEqual([]);
        const replayed = framesForActions(level(), session.fold().actions);
        expect(replayed).toHaveLength(session.frames.length);
    });

    it('the DOOR-KEY level round-trips because both sides boot the SAME way', () => {
        const state = doorKeyLevel();
        const session = walkOf(state, PLAN);
        expect(session.reachedGoal).toBe(true);
        expect(session.roundTrip().faithful).toBe(true);
    });

    /**
     * ⛓⛓⛓ **THE VACUITY CONTROL** (trap 824/825, and the plan's own §5.7
     * mutant, run here as a ROW rather than only as a build mutant): boot the
     * REPLAY side WITHOUT the palette's key and the same actions do not replay
     * at all. If this passed, `roundTrip` would be comparing something that
     * cannot differ.
     */
    it('booting the REPLAY without the palette items REFUSES at the door', () => {
        const state = doorKeyLevel();
        const session = walkOf(state, PLAN);
        const blind = Object.freeze({ ...state, palette: { ...state.palette, items: null } });
        expect(framesForActions(blind, session.fold().actions)).toBeNull();
        expect(framesForActions(state, session.fold().actions)).not.toBeNull();
    });
});

describe('a walk DOCUMENT — what it must survive before anything is drawn', () => {
    const doc = () => walkOf(level(), PLAN).fold();

    it('a well-formed walk is accepted', () => {
        expect(refuseWalkDocument(doc())).toBeNull();
    });

    it('refuses what is not an object, by name', () => {
        expect(refuseWalkDocument(null)).toMatch(/a walk is a JSON object/);
        expect(refuseWalkDocument([])).toMatch(/a walk is a JSON object/);
    });

    it('refuses another substrate\'s recording BY NAME', () => {
        expect(refuseWalkDocument({ ...doc(), substrate: 'jta' }))
            .toMatch(/names substrate "jta", not "maze"/);
    });

    it('refuses a format this page does not speak', () => {
        expect(refuseWalkDocument({ ...doc(), format: 'mazeQueue/0' }))
            .toMatch(/names format "mazeQueue\/0", and this page speaks actionQueue\/1/);
    });

    it('refuses an empty walk, and one whose action is not an entry', () => {
        expect(refuseWalkDocument({ ...doc(), actions: [] })).toMatch(/carries no actions/);
        expect(refuseWalkDocument({ ...doc(), actions: [{ actionId: 'N' }] }))
            .toMatch(/action 0 is not a queue entry — actionType must be a non-empty string/);
    });

    it('refuses a walk with no level in it — a lab walk is self-contained', () => {
        const bare = doc();
        delete bare.lab;
        expect(refuseWalkDocument(bare)).toMatch(/carries no `lab\.payload`/);
    });
});

describe('a walk replayed on the WRONG level refuses BY NAME, at the index', () => {
    it('names the input index, the entry and the engine\'s own reason', () => {
        const session = walkOf(level(), PLAN);
        const actions = session.fold().actions;
        // Paint a wall across the route's second step.
        const base = level();
        const editor = new MazeRoomEditor({
            itemLib: base.record.itemLib,
            obstacleLib: base.record.obstacleLib,
        });
        editor.selectType(PALETTE_TYPES.WALL);
        const walled = applyEdit(base, editor, 0, 2).state;
        expect(framesForActions(walled, actions)).toBeNull();
        const said = describeReplayRefusal(walled, actions);
        expect(said).toMatch(/^input 1 \(move \(S\)\) is illegal on this level/);
        expect(said).toContain('wall at (0,2)');
        expect(said).toContain('driven on a different level, or the level moved');
    });

    it('the INDEX is the TURN index — a folded run is expanded before counting', () => {
        const session = createWalkSession(level());
        session.press(moveEntry('S'));
        session.press(moveEntry('S'));
        session.press(moveEntry('S'));
        const actions = session.fold().actions;
        expect(actions).toHaveLength(1);
        expect(actions[0].loops).toBe(3);
        const base = level();
        const editor = new MazeRoomEditor({
            itemLib: base.record.itemLib,
            obstacleLib: base.record.obstacleLib,
        });
        editor.selectType(PALETTE_TYPES.WALL);
        const walled = applyEdit(base, editor, 0, 3).state;
        expect(describeReplayRefusal(walled, actions)).toMatch(/^input 2 \(move \(S\)\)/);
    });
});

describe('the WITNESS clause, and the SEAM', () => {
    it('says nothing at all until a hand walk reaches the goal', () => {
        expect(witnessOf(level(), null)).toEqual({ clause: null, seam: null });
        expect(witnessOf(level(), { reachedGoal: false, moves: 3 }))
            .toEqual({ clause: null, seam: null });
    });

    it('names the MOVE count and says it is a witness, not a certification', () => {
        const state = level();
        const session = walkOf(state, PLAN);
        const { clause, seam } = witnessOf(state, session);
        expect(clause).toBe('walked to the goal by hand in 4 move(s) — a witness, not the '
            + "oracle's certification");
        expect(seam).toBeNull();
        // ⛔ §13.1: `certified` is the ORACLE's answer and this touches nothing
        //   — the tri-state is exactly what it was before the walk was driven.
        expect(state.certified).toBe(level().certified);
    });

    /**
     * ⛓⛓⛓ **THE SEAM, DRIVEN WITH A STUBBED REFUSING ORACLE.** Unreachable
     * without a broken oracle — which is exactly why the browser row cannot
     * claim it and this one can: a state whose `certified` is `false` while a
     * hand walk stands on its goal IS the disagreement, whatever produced it.
     */
    it('a level the oracle REFUSED that a hand walk solved prints the SEAM', () => {
        const state = level();
        const session = walkOf(state, PLAN);
        const refusedByOracle = Object.freeze({ ...state, certified: false });
        const { clause, seam } = witnessOf(refusedByOracle, session);
        expect(clause).toContain('a witness, not the oracle');
        expect(seam).toBe('⛔ SEAM: the oracle refused this level and a hand walk reached '
            + 'its goal');
    });

    it('an UNCERTIFIED level (certification never asked) is NOT a seam', () => {
        const state = level();
        const session = walkOf(state, PLAN);
        expect(witnessOf(Object.freeze({ ...state, certified: null }), session).seam).toBeNull();
    });
});

describe('there is no UNDO in v1 — the queue refuses the done region by design', () => {
    it('every entry of an append-and-execute session is DONE, so removeAt is refused', () => {
        const session = walkOf(level(), ['S', 'S']);
        expect(session.queue.cursor).toBe(2);
        // `remove` of a done entry would silently move the cursor under the
        // frames; the arm offers RESTART instead, and the panel says so.
        expect(() => session.queue.add(moveEntry('N'), 0)).toThrow(/inside the done region/);
    });
});
