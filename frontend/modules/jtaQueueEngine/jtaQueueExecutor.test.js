// Executor tests driven through a fake QueueTransport — verifies the execution
// loop (task completion via status polling, immediate items, multi-loop
// entries) and the substrate rework's pause-on-block path, with no iframe.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JTAQueueExecutor } from './jtaQueueExecutor.js';
import { ActionQueue } from '../shared/actionQueue/actionQueue.js';
import { createQueueEntry } from './jtaActionDefs.js';

/** A transport whose commands are recorded and whose events are test-driven. */
class FakeTransport {
    constructor() { this.commands = []; this._handlers = new Map(); }
    clickTask(taskId) { this.commands.push(['clickTask', taskId]); }
    clickItem(itemType, useAll) { this.commands.push(['clickItem', itemType, useAll]); }
    doPrestige() { this.commands.push(['doPrestige']); }
    requestTaskStatus() { this.commands.push(['requestTaskStatus']); }
    requestDetailedState() { this.commands.push(['requestDetailedState']); }
    dismissGameOver() { this.commands.push(['dismissGameOver']); }
    requestGameDefs() { this.commands.push(['requestGameDefs']); }
    on(event, h) {
        if (!this._handlers.has(event)) this._handlers.set(event, new Set());
        this._handlers.get(event).add(h);
        return () => this._handlers.get(event)?.delete(h);
    }
    emit(event, data) { for (const h of [...(this._handlers.get(event) || [])]) h(data); }
    count(cmd) { return this.commands.filter((c) => c[0] === cmd).length; }
}

const taskEntry = (id, loops = 1) =>
    createQueueEntry({ actionType: 'clickTask', actionId: id, label: `T${id}`, zoneId: 0 }, loops);
const itemEntry = (id, loops = 1) =>
    createQueueEntry({ actionType: 'useItem', actionId: id, label: `I${id}`, zoneId: 0 }, loops);

describe('JTAQueueExecutor via a fake transport', () => {
    let queue, transport;
    beforeEach(() => { queue = new ActionQueue(); transport = new FakeTransport(); });

    function makeExecutor() {
        const ex = new JTAQueueExecutor(queue, transport, { drainEnabled: false });
        ex.setTrackingState(100, {}); // skip the awaiting-initial-state round-trip
        return ex;
    }

    it('runs an immediate item entry to completion and exhausts', () => {
        queue.add(itemEntry(7));
        const ex = makeExecutor();
        let exhausted = false;
        ex.onQueueExhausted = () => { exhausted = true; };

        ex.start();
        expect(transport.commands).toContainEqual(['clickItem', 7, false]);

        transport.emit('itemClicked', { success: true });
        expect(exhausted).toBe(true);
        expect(ex.snapshot.getStatus(queue.getEntries()[0].entryId).loopsCompleted).toBe(1);
    });

    it('completes a 2-loop task via status polling, re-issuing each loop', () => {
        vi.useFakeTimers();
        try {
            queue.add(taskEntry(11, 2));
            const ex = makeExecutor();
            let exhausted = false;
            ex.onQueueExhausted = () => { exhausted = true; };

            ex.start();
            // loop 1
            transport.emit('taskClicked', { success: true, taskId: 11 });
            vi.advanceTimersByTime(500);
            expect(transport.count('requestTaskStatus')).toBe(1);
            transport.emit('taskStatus', { activeTaskId: null, currentEnergy: 90 });
            // loop 2 re-issued
            expect(transport.count('clickTask')).toBe(2);
            transport.emit('taskClicked', { success: true, taskId: 11 });
            vi.advanceTimersByTime(500);
            transport.emit('taskStatus', { activeTaskId: null, currentEnergy: 80 });

            expect(exhausted).toBe(true);
            expect(ex.snapshot.getStatus(queue.getEntries()[0].entryId).loopsCompleted).toBe(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('skips an already-completed task and advances', () => {
        queue.add(taskEntry(3));
        queue.add(itemEntry(4));
        const ex = makeExecutor();
        ex.start();
        transport.emit('taskClicked', { success: false, alreadyCompleted: true, error: 'done' });
        // advanced to the item entry
        expect(transport.commands).toContainEqual(['clickItem', 4, false]);
    });

    it('pauses (not fails) when a task reply reports a playback walk in flight', () => {
        queue.add(taskEntry(9));
        const ex = makeExecutor();
        let pausedReason = null;
        ex.onPaused = (r) => { pausedReason = r; };

        ex.start();
        transport.emit('taskClicked', { success: false, walkInFlight: true, taskId: 9 });

        expect(pausedReason).toBe('playback walk in flight');
        expect(ex.isRunning).toBe(false);   // paused
        expect(ex.snapshot).not.toBeNull();  // snapshot preserved for resume
        // the entry was NOT marked failed/skipped — still the current entry
        expect(ex.snapshot.currentEntry().actionId).toBe(9);
    });

    it('pauses when a walk starts mid-poll', () => {
        vi.useFakeTimers();
        try {
            queue.add(taskEntry(2));
            const ex = makeExecutor();
            let pausedReason = null;
            ex.onPaused = (r) => { pausedReason = r; };

            ex.start();
            transport.emit('taskClicked', { success: true, taskId: 2 });
            vi.advanceTimersByTime(500);
            transport.emit('taskStatus', { activeTaskId: 2, currentEnergy: 95, walkInFlight: true });

            expect(pausedReason).toBe('playback walk in flight');
            expect(ex.isRunning).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
