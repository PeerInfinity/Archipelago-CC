import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TextAdventurePlaybackController } from './textAdventureSubstratePlayback.js';

// Stub panel mirroring the surface the controller calls into. Records
// click-handler invocations so tests can assert what the controller
// dispatched on each tick.
function makeStubPanel({ exits = new Map(), world = null } = {}) {
    const calls = [];
    const stub = {
        world: world ?? { exits },
        _onLocationClick: (name) => calls.push({ kind: 'location', name }),
        _onExitClick:    (id)   => calls.push({ kind: 'exit', exitId: id }),
        calls,
    };
    return stub;
}

describe('TextAdventurePlaybackController — walkTo resolution', () => {
    it('routes location walkTo through the panel\'s _onLocationClick', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'location', name: 'Cave Entrance' });
        c.step();
        expect(panel.calls).toEqual([{ kind: 'location', name: 'Cave Entrance' }]);
    });

    it('routes exit walkTo by exit_id directly', () => {
        const exits = new Map([
            ['exit_1', { exit_id: 'exit_1', exitName: 'NorthDoor' }],
        ]);
        const panel = makeStubPanel({ exits });
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'exit', name: 'exit_1' });
        c.step();
        expect(panel.calls).toEqual([{ kind: 'exit', exitId: 'exit_1' }]);
    });

    it('routes exit walkTo by exitName via reverse lookup', () => {
        const exits = new Map([
            ['exit_1', { exit_id: 'exit_1', exitName: 'NorthDoor' }],
            ['exit_2', { exit_id: 'exit_2', exitName: 'EastGate' }],
        ]);
        const panel = makeStubPanel({ exits });
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'exit', name: 'EastGate' });
        c.step();
        expect(panel.calls).toEqual([{ kind: 'exit', exitId: 'exit_2' }]);
    });

    it('drops exit walkTo for an unknown name', () => {
        const exits = new Map([
            ['exit_1', { exit_id: 'exit_1', exitName: 'NorthDoor' }],
        ]);
        const panel = makeStubPanel({ exits });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'exit', name: 'NoSuchExit' });
        c.step();
        expect(panel.calls).toEqual([]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('warns and drops tile walkTo (no tile semantics)', () => {
        const panel = makeStubPanel();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'tile', x: 1, y: 2 });
        c.step();
        expect(panel.calls).toEqual([]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('ignores walkTo when no world is loaded', () => {
        const panel = { world: null, _onLocationClick: vi.fn(), _onExitClick: vi.fn() };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'location', name: 'X' });
        c.step();
        expect(panel._onLocationClick).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('idle step is a no-op when no target is queued', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.step();
        c.step();
        expect(panel.calls).toEqual([]);
    });

    it('replaces the queued target on a fresh walkTo (last write wins)', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.walkTo({ kind: 'location', name: 'Loc A' });
        c.walkTo({ kind: 'location', name: 'Loc B' });
        c.step();
        expect(panel.calls).toEqual([{ kind: 'location', name: 'Loc B' }]);
    });
});

describe('TextAdventurePlaybackController — clock', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('play() starts an interval that calls step() at the given rate', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.play(10);  // 10 Hz → 100 ms tick
        c.walkTo({ kind: 'location', name: 'A' });
        vi.advanceTimersByTime(100);
        expect(panel.calls).toEqual([{ kind: 'location', name: 'A' }]);
    });

    it('stop() halts the clock', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.play(10);
        c.stop();
        c.walkTo({ kind: 'location', name: 'A' });
        vi.advanceTimersByTime(1000);
        expect(panel.calls).toEqual([]);
    });

    it('play() is idempotent — calling twice does not stack intervals', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.play(10);
        c.play(10);
        c.walkTo({ kind: 'location', name: 'A' });
        vi.advanceTimersByTime(100);
        // Only one tick should have fired the action.
        expect(panel.calls.filter((c) => c.kind === 'location' && c.name === 'A')).toHaveLength(1);
    });

    it('setRate() while playing reseats the interval at the new rate', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.play(2);   // 500 ms tick
        c.setRate(20);  // 50 ms tick
        c.walkTo({ kind: 'location', name: 'A' });
        // At 60 ms the new rate should have already fired once.
        vi.advanceTimersByTime(60);
        expect(panel.calls).toHaveLength(1);
    });

    it('setRate() while stopped does not start the clock', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.setRate(20);
        c.walkTo({ kind: 'location', name: 'A' });
        vi.advanceTimersByTime(1000);
        expect(panel.calls).toEqual([]);
    });

    it('instant() drains the queued target immediately, leaves the clock alone', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.play(2);
        c.walkTo({ kind: 'location', name: 'A' });
        c.instant();
        expect(panel.calls).toEqual([{ kind: 'location', name: 'A' }]);
        // Clock still runs — a subsequent walkTo + tick fires.
        c.walkTo({ kind: 'location', name: 'B' });
        vi.advanceTimersByTime(500);
        expect(panel.calls.at(-1)).toEqual({ kind: 'location', name: 'B' });
    });

    it('reset() stops the clock and clears the queued target', () => {
        const panel = makeStubPanel();
        const c = new TextAdventurePlaybackController(panel);
        c.play(10);
        c.walkTo({ kind: 'location', name: 'A' });
        c.reset();
        vi.advanceTimersByTime(500);
        expect(panel.calls).toEqual([]);
    });
});
