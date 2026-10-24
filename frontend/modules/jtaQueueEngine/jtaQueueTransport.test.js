// Unit tests for the QueueTransport implementations — the seam between the
// JtA action-queue engine/executor and the running game. RemoteTransport must
// reproduce the legacy eventBus protocol 1:1; BridgeTransport must translate
// the executor's command/event vocabulary onto the substrate bridge's
// jta:queueAction request/response channel (and normalize the fork's state).
import { describe, it, expect, beforeEach } from 'vitest';
import { RemoteTransport, BridgeTransport, createQueueTransport } from './jtaQueueTransport.js';

/** Minimal in-memory eventBus with publish/subscribe + a synchronous relay. */
function makeBus() {
    const subs = new Map();
    return {
        published: [],
        publish(event, data, mod) {
            this.published.push({ event, data, mod });
            for (const h of [...(subs.get(event) || [])]) h(data);
        },
        subscribe(event, h) {
            if (!subs.has(event)) subs.set(event, new Set());
            subs.get(event).add(h);
            return () => subs.get(event)?.delete(h);
        },
        unsubscribe(event, h) { subs.get(event)?.delete(h); },
        emit(event, data) { for (const h of [...(subs.get(event) || [])]) h(data); },
    };
}

const flush = () => Promise.resolve();

/** Reply to the most recent jta:queueAction with a fork result/error. */
function replyToLast(bus, { result = null, error = null } = {}) {
    const last = [...bus.published].reverse().find((m) => m.event === 'jta:queueAction');
    bus.emit('jta:queueActionResult', { requestId: last.data.requestId, method: last.data.method, result, error });
}

describe('RemoteTransport — legacy protocol wrapper', () => {
    let bus, t;
    beforeEach(() => { bus = makeBus(); t = new RemoteTransport(bus, 'mod'); });

    it('maps commands to the legacy topics + payloads', () => {
        t.clickTask(42);
        t.clickItem(7, true);
        t.doPrestige();
        t.requestTaskStatus();
        t.requestDetailedState();
        t.dismissGameOver();
        t.requestGameDefs();
        expect(bus.published.map((m) => m.event)).toEqual([
            'jta:clickTask', 'jta:clickItem', 'jta:doPrestige', 'jta:requestTaskStatus',
            'jta:requestDetailedState', 'jta:dismissGameOver', 'jta:requestGameDefs',
        ]);
        expect(bus.published[0].data).toEqual({ taskId: 42 });
        expect(bus.published[1].data).toEqual({ itemType: 7, useAll: true });
        expect(bus.published.every((m) => m.mod === 'mod')).toBe(true);
    });

    it('maps logical events to the legacy topics', () => {
        const seen = [];
        t.on('taskClicked', (d) => seen.push(['taskClicked', d]));
        t.on('detailedState', (d) => seen.push(['detailedState', d]));
        t.on('connected', () => seen.push(['connected']));
        bus.emit('jta:taskClicked', { success: true });
        bus.emit('jta:detailedStateSnapshot', { state: { currentEnergy: 5 } });
        bus.emit('iframe:connected', {});
        expect(seen).toEqual([
            ['taskClicked', { success: true }],
            ['detailedState', { state: { currentEnergy: 5 } }],
            ['connected'],
        ]);
    });

    it('is not the bridge transport', () => {
        expect(t.isBridge).toBe(false);
    });
});

describe('BridgeTransport — substrate channel translation', () => {
    let bus, t;
    beforeEach(() => { bus = makeBus(); t = new BridgeTransport(bus, 'q'); });

    it('identifies as the bridge transport', () => {
        expect(t.isBridge).toBe(true);
    });

    it('clickTask → performTask; success reply → taskClicked{success}', async () => {
        const events = [];
        t.on('taskClicked', (d) => events.push(d));
        t.clickTask(101);
        const cmd = bus.published.find((m) => m.event === 'jta:queueAction');
        expect(cmd.data.method).toBe('performTask');
        expect(cmd.data.args).toEqual([101]);
        replyToLast(bus, { result: { success: true, taskName: 'Explore' } });
        await flush();
        expect(events).toEqual([{ success: true, taskId: 101, error: null, alreadyCompleted: false, walkInFlight: false }]);
    });

    it('clickTask → already-completed reply → taskClicked{alreadyCompleted}', async () => {
        const events = [];
        t.on('taskClicked', (d) => events.push(d));
        t.clickTask(5);
        replyToLast(bus, { result: { success: false, error: 'Task 5 is already completed' } });
        await flush();
        expect(events[0]).toMatchObject({ success: false, alreadyCompleted: true, walkInFlight: false });
    });

    it('clickTask → walk-in-flight reply → taskClicked{walkInFlight}', async () => {
        const events = [];
        t.on('taskClicked', (d) => events.push(d));
        t.clickTask(9);
        replyToLast(bus, { result: { success: false, error: 'playback walk in flight', walkInFlight: true } });
        await flush();
        expect(events[0]).toMatchObject({ success: false, walkInFlight: true });
    });

    it('requestTaskStatus → getStatus reply → taskStatus event', async () => {
        const events = [];
        t.on('taskStatus', (d) => events.push(d));
        t.requestTaskStatus();
        expect(bus.published.at(-1).data.method).toBe('getStatus');
        replyToLast(bus, { result: { activeTaskId: 3, currentEnergy: 88, tasks: [{ id: 3 }], walkInFlight: false } });
        await flush();
        expect(events[0]).toEqual({ activeTaskId: 3, currentEnergy: 88, tasks: [{ id: 3 }], walkInFlight: false });
    });

    it('requestDetailedState normalizes the fork state (arrays → keyed maps)', async () => {
        const events = [];
        t.on('detailedState', (d) => events.push(d));
        t.requestDetailedState();
        expect(bus.published.at(-1).data.method).toBe('getFullState');
        replyToLast(bus, { result: {
            currentEnergy: 50, maxEnergy: 100, currentZone: 2,
            skills: [{ type: 7, level: 3, progress: 12 }],
            items: [{ type: 4, count: 2 }],
            perks: [1],
        } });
        await flush();
        const state = events[0].state;
        expect(state.currentEnergy).toBe(50);
        expect(state.skills).toEqual({ 7: { level: 3, xp: 12 } });
        expect(state.items).toEqual({ 4: 2 });
        expect(state.perks).toEqual([1]);
    });

    it('doPrestige reports failure (unsupported on substrate)', async () => {
        const events = [];
        t.on('prestigeDone', (d) => events.push(d));
        t.doPrestige();
        await flush();
        expect(events[0]).toMatchObject({ success: false });
    });

    it('beginRun records the prior mode and sets Off; endRun restores it', async () => {
        const begin = t.beginRun();
        // 1st request: getAutomationMode
        expect(bus.published.at(-1).data.method).toBe('getAutomationMode');
        replyToLast(bus, { result: 1 /* Zone */ });
        await flush();
        // 2nd request: setAutomationMode(Off=2)
        const setCmd = bus.published.at(-1);
        expect(setCmd.data.method).toBe('setAutomationMode');
        expect(setCmd.data.args).toEqual([2]);
        replyToLast(bus, { result: 2 });
        await begin;

        const end = t.endRun();
        const restore = bus.published.at(-1);
        expect(restore.data.method).toBe('setAutomationMode');
        expect(restore.data.args).toEqual([1]);
        replyToLast(bus, { result: 1 });
        await end;
    });

    it('beginRun leaves automation alone when a walk refuses the change', async () => {
        const begin = t.beginRun();
        replyToLast(bus, { result: 0 /* All */ });        // getAutomationMode
        await flush();
        replyToLast(bus, { result: { walkInFlight: true } }); // setAutomationMode refused
        await begin;
        // endRun must be a no-op — nothing recorded to restore
        const before = bus.published.length;
        await t.endRun();
        expect(bus.published.length).toBe(before);
    });

    it('requestActions → getActions reply → actions event (all-zones catalog source)', async () => {
        const events = [];
        t.on('actions', (d) => events.push(d));
        t.requestActions();
        expect(bus.published.at(-1).data.method).toBe('getActions');
        const report = { zones: [{ zone: 1, name: 'Cave', tasks: [{ id: 5, name: 'Fight' }] }], items: [] };
        replyToLast(bus, { result: report });
        await flush();
        expect(events[0]).toEqual(report);
    });

    it('re-emits the host loop reset as a loopReset transport event', () => {
        const events = [];
        t.on('loopReset', () => events.push(true));
        bus.emit('gameState:loopReset', {});
        expect(events).toEqual([true]);
    });

    it('re-emits dataset reload as a rulesLoaded transport event', () => {
        const events = [];
        t.on('rulesLoaded', () => events.push(true));
        bus.emit('stateManager:rulesLoaded', {});
        expect(events).toEqual([true]);
    });

    it('destroy() unsubscribes from the host bus', () => {
        const events = [];
        t.on('loopReset', () => events.push(true));
        t.destroy();
        bus.emit('gameState:loopReset', {});
        expect(events).toEqual([]);
    });
});

describe('createQueueTransport factory', () => {
    it('returns a BridgeTransport by default (no ?mode=jta)', () => {
        const t = createQueueTransport(makeBus(), 'q');
        expect(t.isBridge).toBe(true);
    });
});
