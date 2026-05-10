import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    MazeRoomQueue,
    makeAction,
    ACTION_MOVE,
    ACTION_WAIT,
    ACTION_LOCATION_CHECK,
    STATUS_PENDING,
    STATUS_DONE,
    _testOnly_resetIdCounter,
} from './mazeRoomQueue.js';

beforeEach(() => {
    _testOnly_resetIdCounter();
});

// ---------------------------------------------------------------
// makeAction validation
// ---------------------------------------------------------------

describe('makeAction', () => {
    it('builds a move action with direction', () => {
        const a = makeAction({ type: ACTION_MOVE, dir: 'N' });
        expect(a.type).toBe(ACTION_MOVE);
        expect(a.dir).toBe('N');
        expect(a.status).toBe(STATUS_PENDING);
        expect(typeof a.id).toBe('number');
    });

    it('builds a wait action without dir or locationName', () => {
        const a = makeAction({ type: ACTION_WAIT });
        expect(a.type).toBe(ACTION_WAIT);
        expect(a.dir).toBeUndefined();
        expect(a.locationName).toBeUndefined();
    });

    it('builds a locationCheck action with locationName', () => {
        const a = makeAction({ type: ACTION_LOCATION_CHECK, locationName: 'Foo' });
        expect(a.type).toBe(ACTION_LOCATION_CHECK);
        expect(a.locationName).toBe('Foo');
    });

    it('rejects unknown types', () => {
        expect(() => makeAction({ type: 'jump' })).toThrow(/unknown action type/);
    });

    it('rejects move without a valid dir', () => {
        expect(() => makeAction({ type: ACTION_MOVE })).toThrow(/dir N\/E\/S\/W/);
        expect(() => makeAction({ type: ACTION_MOVE, dir: 'X' })).toThrow();
    });

    it('rejects locationCheck without a locationName string', () => {
        expect(() => makeAction({ type: ACTION_LOCATION_CHECK })).toThrow(/locationName/);
        expect(() => makeAction({ type: ACTION_LOCATION_CHECK, locationName: 42 })).toThrow();
    });

    it('rejects non-object specs', () => {
        expect(() => makeAction(null)).toThrow();
        expect(() => makeAction(undefined)).toThrow();
        expect(() => makeAction('move')).toThrow();
    });

    it('assigns monotonically increasing ids', () => {
        const a = makeAction({ type: ACTION_WAIT });
        const b = makeAction({ type: ACTION_WAIT });
        expect(b.id).toBeGreaterThan(a.id);
    });
});

// ---------------------------------------------------------------
// Construction
// ---------------------------------------------------------------

describe('MazeRoomQueue — construction', () => {
    it('starts empty and idle', () => {
        const q = new MazeRoomQueue();
        expect(q.length).toBe(0);
        expect(q.isIdle()).toBe(true);
        expect(q.pendingCount()).toBe(0);
        expect(q.executionIndex).toBe(0);
        expect(q.editCursor).toBeNull();
    });

    it('accepts a no-op executor by default', () => {
        const q = new MazeRoomQueue();
        // Should not throw on append-and-execute path
        expect(() => q.handleInput({ type: ACTION_WAIT })).not.toThrow();
    });

    it('snapshot is independent of internal state', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        const snap = q.snapshot();
        snap.actions[0].status = 'TAMPERED';
        expect(q.actions[0].status).toBe(STATUS_PENDING);
    });
});

// ---------------------------------------------------------------
// handleInput — append-and-execute at tail
// ---------------------------------------------------------------

describe('MazeRoomQueue — handleInput append-and-execute', () => {
    it('runs the executor when cursor is null and queue is empty', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        const dispo = q.handleInput({ type: ACTION_MOVE, dir: 'N' });
        expect(dispo).toBe('append-execute');
        expect(executor).toHaveBeenCalledTimes(1);
        const ranAction = executor.mock.calls[0][0];
        expect(ranAction.type).toBe(ACTION_MOVE);
        expect(ranAction.dir).toBe('N');
        expect(q.actions[0].status).toBe(STATUS_DONE);
        expect(q.executionIndex).toBe(1);
        expect(q.isIdle()).toBe(true);
    });

    it('runs the executor for each input in sequence', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.handleInput({ type: ACTION_MOVE, dir: 'N' });
        q.handleInput({ type: ACTION_MOVE, dir: 'E' });
        q.handleInput({ type: ACTION_WAIT });
        expect(executor).toHaveBeenCalledTimes(3);
        expect(q.length).toBe(3);
        expect(q.executionIndex).toBe(3);
        expect(q.actions.every((a) => a.status === STATUS_DONE)).toBe(true);
    });

    it('append-and-executes when editCursor is explicitly at the tail', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.setEditCursor(1); // tail position
        const dispo = q.handleInput({ type: ACTION_MOVE, dir: 'E' });
        // editCursor === actions.length (1 === 1) → not < length → append path
        // After push: executionIndex(0) === length-1(1)? No, 0 !== 1.
        // So this is plain append, not append-execute.
        expect(dispo).toBe('append');
        expect(executor).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------
// handleInput — insert when editCursor is set
// ---------------------------------------------------------------

describe('MazeRoomQueue — handleInput insert', () => {
    it('inserts at editCursor without executing', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.append({ type: ACTION_MOVE, dir: 'E' });
        q.setEditCursor(0);
        const dispo = q.handleInput({ type: ACTION_WAIT });
        expect(dispo).toBe('insert');
        expect(executor).not.toHaveBeenCalled();
        expect(q.length).toBe(3);
        expect(q.actions[0].type).toBe(ACTION_WAIT);
        expect(q.actions[1].type).toBe(ACTION_MOVE);
        expect(q.actions[1].dir).toBe('N');
    });

    it('advances editCursor after insert so next insert lands after', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.append({ type: ACTION_MOVE, dir: 'E' });
        q.setEditCursor(0);
        q.handleInput({ type: ACTION_WAIT });
        expect(q.editCursor).toBe(1);
        q.handleInput({ type: ACTION_WAIT });
        expect(q.editCursor).toBe(2);
        // Final order: WAIT, WAIT, MOVE-N, MOVE-E
        expect(q.actions.map((a) => a.type)).toEqual([
            ACTION_WAIT, ACTION_WAIT, ACTION_MOVE, ACTION_MOVE,
        ]);
    });

    it('insert does not execute even when cursor is at first pending', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.append({ type: ACTION_MOVE, dir: 'E' });
        // executionIndex=0, length=2. setEditCursor(0) clamps to executionIndex (0).
        q.setEditCursor(0);
        q.handleInput({ type: ACTION_WAIT });
        // The new action is at index 0 (where executionIndex points), but
        // it's an insert (cursor was set), not an append-execute.
        expect(executor).not.toHaveBeenCalled();
        expect(q.actions[0].status).toBe(STATUS_PENDING);
    });
});

// ---------------------------------------------------------------
// setEditCursor clamping
// ---------------------------------------------------------------

describe('MazeRoomQueue — setEditCursor', () => {
    it('clamps negative indices up to executionIndex', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.stepOne(); // executionIndex now 1
        q.setEditCursor(-5);
        expect(q.editCursor).toBe(1);
    });

    it('clamps overshoot down to length', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.setEditCursor(99);
        expect(q.editCursor).toBe(1);
    });

    it('clamps cursor placed within the done region up to executionIndex', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.stepOne();
        q.stepOne();
        // executionIndex=2, length=2. Setting to 0 clamps to 2.
        q.setEditCursor(0);
        expect(q.editCursor).toBe(2);
    });

    it('null restores tail (append) behavior', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.setEditCursor(0);
        q.handleInput({ type: ACTION_WAIT }); // insert
        expect(executor).not.toHaveBeenCalled();
        q.setEditCursor(null);
        q.handleInput({ type: ACTION_WAIT }); // append-and-execute? executionIndex=0, new length=3, 0!==2 → plain append
        expect(executor).not.toHaveBeenCalled();
        expect(q.editCursor).toBeNull();
    });

    it('ignores non-integer indices (no mutation)', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.setEditCursor(0);
        const before = q.editCursor;
        q.setEditCursor(1.5);
        expect(q.editCursor).toBe(before);
        q.setEditCursor('foo');
        expect(q.editCursor).toBe(before);
    });
});

// ---------------------------------------------------------------
// deleteAt
// ---------------------------------------------------------------

describe('MazeRoomQueue — deleteAt', () => {
    it('deletes a pending action and returns true', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.append({ type: ACTION_MOVE, dir: 'E' });
        const ok = q.deleteAt(0);
        expect(ok).toBe(true);
        expect(q.length).toBe(1);
        expect(q.actions[0].dir).toBe('E');
    });

    it('refuses to delete already-executed actions', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.stepOne(); // executionIndex=1
        const ok = q.deleteAt(0);
        expect(ok).toBe(false);
        expect(q.length).toBe(2);
    });

    it('returns false on out-of-range index', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        expect(q.deleteAt(5)).toBe(false);
        expect(q.deleteAt(-1)).toBe(false);
        expect(q.length).toBe(1);
    });

    it('shifts editCursor down when deletion is before it', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.setEditCursor(2);
        q.deleteAt(0);
        expect(q.editCursor).toBe(1);
    });

    it('does not shift editCursor when deletion is at or after it', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.setEditCursor(1);
        q.deleteAt(2);
        expect(q.editCursor).toBe(1);
        q.deleteAt(1);
        expect(q.editCursor).toBe(1);
    });

    it('rejects non-integer indices', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        expect(q.deleteAt(0.5)).toBe(false);
        expect(q.deleteAt(null)).toBe(false);
    });
});

// ---------------------------------------------------------------
// clearPending and clearAll
// ---------------------------------------------------------------

describe('MazeRoomQueue — clear*', () => {
    it('clearPending preserves done history', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.stepOne();
        q.clearPending();
        expect(q.length).toBe(1);
        expect(q.actions[0].status).toBe(STATUS_DONE);
        expect(q.executionIndex).toBe(1);
        expect(q.editCursor).toBeNull();
    });

    it('clearPending also clears the editCursor when there were no pending actions', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.stepOne();
        q.editCursor = 1; // bypass clamp logic; possible if cursor was set then queue drained
        q.clearPending();
        expect(q.editCursor).toBeNull();
    });

    it('clearAll resets everything', () => {
        const q = new MazeRoomQueue();
        q.append({ type: ACTION_WAIT });
        q.stepOne();
        q.append({ type: ACTION_WAIT });
        q.setEditCursor(1);
        q.clearAll();
        expect(q.length).toBe(0);
        expect(q.executionIndex).toBe(0);
        expect(q.editCursor).toBeNull();
    });

    it('clearAll on an already-empty queue does not emit', () => {
        const q = new MazeRoomQueue();
        const listener = vi.fn();
        q.subscribe(listener);
        q.clearAll();
        expect(listener).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------
// append / appendAll (programmatic)
// ---------------------------------------------------------------

describe('MazeRoomQueue — programmatic append', () => {
    it('append does not execute', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        const a = q.append({ type: ACTION_MOVE, dir: 'N' });
        expect(executor).not.toHaveBeenCalled();
        expect(a.status).toBe(STATUS_PENDING);
        expect(q.executionIndex).toBe(0);
    });

    it('appendAll batches into a single emit', () => {
        const q = new MazeRoomQueue();
        const listener = vi.fn();
        q.subscribe(listener);
        q.appendAll([
            { type: ACTION_MOVE, dir: 'N' },
            { type: ACTION_MOVE, dir: 'E' },
            { type: ACTION_WAIT },
        ]);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(q.length).toBe(3);
    });

    it('appendAll on empty input is a no-op (no emit)', () => {
        const q = new MazeRoomQueue();
        const listener = vi.fn();
        q.subscribe(listener);
        const result = q.appendAll([]);
        expect(result).toEqual([]);
        expect(listener).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------
// stepOne
// ---------------------------------------------------------------

describe('MazeRoomQueue — stepOne', () => {
    it('advances exactly one action', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.append({ type: ACTION_MOVE, dir: 'E' });
        const ok = q.stepOne();
        expect(ok).toBe(true);
        expect(executor).toHaveBeenCalledTimes(1);
        expect(q.executionIndex).toBe(1);
        expect(q.actions[0].status).toBe(STATUS_DONE);
        expect(q.actions[1].status).toBe(STATUS_PENDING);
    });

    it('returns false when idle', () => {
        const q = new MazeRoomQueue();
        expect(q.stepOne()).toBe(false);
    });
});

describe('MazeRoomQueue — markCurrentDone / drainPending', () => {
    it('markCurrentDone advances without invoking the executor', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.append({ type: ACTION_MOVE, dir: 'N' });
        q.append({ type: ACTION_MOVE, dir: 'E' });
        expect(q.markCurrentDone()).toBe(true);
        expect(executor).not.toHaveBeenCalled();
        expect(q.executionIndex).toBe(1);
        expect(q.actions[0].status).toBe(STATUS_DONE);
        expect(q.actions[1].status).toBe(STATUS_PENDING);
    });

    it('markCurrentDone returns false when idle', () => {
        const q = new MazeRoomQueue();
        expect(q.markCurrentDone()).toBe(false);
    });

    it('drainPending marks every remaining pending done without executor', () => {
        const executor = vi.fn();
        const q = new MazeRoomQueue({ executor });
        q.appendAll([
            { type: ACTION_MOVE, dir: 'N' },
            { type: ACTION_MOVE, dir: 'E' },
            { type: ACTION_LOCATION_CHECK, locationName: 'Slay Yorgle' },
        ]);
        q.markCurrentDone();
        expect(q.drainPending()).toBe(2);
        expect(executor).not.toHaveBeenCalled();
        expect(q.isIdle()).toBe(true);
        expect(q.actions.every((a) => a.status === STATUS_DONE)).toBe(true);
    });

    it('drainPending returns 0 and skips emit when idle', () => {
        const q = new MazeRoomQueue();
        const listener = vi.fn();
        q.subscribe(listener);
        expect(q.drainPending()).toBe(0);
        expect(listener).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------
// subscribe / unsubscribe
// ---------------------------------------------------------------

describe('MazeRoomQueue — subscribe', () => {
    it('emits on each mutation', () => {
        const q = new MazeRoomQueue();
        const listener = vi.fn();
        q.subscribe(listener);
        q.append({ type: ACTION_WAIT });
        q.append({ type: ACTION_WAIT });
        q.stepOne();
        q.setEditCursor(1);
        q.deleteAt(1);
        // append × 2 + stepOne × 1 + setEditCursor × 1 + deleteAt × 1 = 5
        expect(listener).toHaveBeenCalledTimes(5);
    });

    it('unsubscribe stops further notifications', () => {
        const q = new MazeRoomQueue();
        const listener = vi.fn();
        const unsubscribe = q.subscribe(listener);
        q.append({ type: ACTION_WAIT });
        unsubscribe();
        q.append({ type: ACTION_WAIT });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('a throwing listener does not break the queue', () => {
        const q = new MazeRoomQueue();
        const bad = vi.fn(() => { throw new Error('boom'); });
        const good = vi.fn();
        q.subscribe(bad);
        q.subscribe(good);
        // Suppress the console.warn output
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        q.append({ type: ACTION_WAIT });
        expect(good).toHaveBeenCalledTimes(1);
        expect(q.length).toBe(1);
        warn.mockRestore();
    });

    it('rejects non-function listeners', () => {
        const q = new MazeRoomQueue();
        expect(() => q.subscribe('foo')).toThrow();
    });
});

// ---------------------------------------------------------------
// Executor contract
// ---------------------------------------------------------------

describe('MazeRoomQueue — executor contract', () => {
    it('executor exception still marks the action done and emits', () => {
        const executor = vi.fn(() => { throw new Error('engine.step rejected'); });
        const q = new MazeRoomQueue({ executor });
        const listener = vi.fn();
        q.subscribe(listener);
        // The exception propagates out of handleInput; the queue's
        // try/finally still advances state.
        expect(() => q.handleInput({ type: ACTION_WAIT })).toThrow(/engine.step/);
        expect(q.actions[0].status).toBe(STATUS_DONE);
        expect(q.executionIndex).toBe(1);
        // emit fires after the action is appended (1 call) and after
        // _executeOne's finally (1 call). 2 total.
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('executor sees a pending action (status flip happens after)', () => {
        let observed;
        const executor = vi.fn((a) => { observed = a.status; });
        const q = new MazeRoomQueue({ executor });
        q.handleInput({ type: ACTION_WAIT });
        expect(observed).toBe(STATUS_PENDING);
    });
});
