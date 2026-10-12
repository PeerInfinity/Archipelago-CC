import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    PLAY_CLOCK_EVENT, PLAY_CLOCK_POLL_MS, PLAY_CLOCK_TRANSPORTS, PlayClockReporter, SEEDLING_FRAMES_PER_GAME_SECOND,
    SeedlingPlayClock, gameFramesOf,
} from './seedlingPlayClock.js';
import { TICKS_PER_SECOND } from '../seedlingDemo/jsRuntimePage.js';
import { PROFILE } from '../seedlingDemo/seedlingProfile.js';
import { createJsRuntime } from '../seedlingDemo/jsRuntimeCore.js';

describe('⛓ PLAY CLOCK — the game second', () => {
    it('is 30 frames: the JS page\'s tick rate and the clamped FP.elapsed step every update takes', () => {
        expect(SEEDLING_FRAMES_PER_GAME_SECOND).toBe(TICKS_PER_SECOND);
        expect(Math.round(1 / PROFILE.fpElapsed)).toBe(SEEDLING_FRAMES_PER_GAME_SECOND);
    });

    it('reads `game_time` off a botStatus (JSON or object), nothing else', () => {
        expect(gameFramesOf('{"game_time": 4882, "tick": 0}')).toBe(4882);
        expect(gameFramesOf({ game_time: 12.5 })).toBe(12.5);
        expect(gameFramesOf({ ticks: 9, time: 9 })).toBeNull();
        expect(gameFramesOf('not json')).toBeNull();
        expect(gameFramesOf(null)).toBeNull();
    });

    it('the JS runtime reports its model clock as `game_time` (its step count)', () => {
        const rt = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
        const st = JSON.parse(rt.game.botStatus());
        expect(st.game_time).toBe(st.ticks);
        expect(st.game_time).toBe(0);
        // No session: the run is not stepped, so the clock does not move.
        rt.tick(new Set());
        expect(JSON.parse(rt.game.botStatus()).game_time).toBe(0);
    });
});

describe('⛓ PLAY CLOCK — the reporter (pure)', () => {
    it('a new visit reports at once, stopped, at 0 game seconds', () => {
        const r = new PlayClockReporter();
        expect(r.sample({ region: 'A', frames: 4882 })).toEqual({ region: 'A', running: false, stats: { gameSeconds: 0 } });
    });

    it('running = the clock ADVANCED; gameSeconds = frames played / 30', () => {
        const r = new PlayClockReporter();
        r.sample({ region: 'A', frames: 100 });
        expect(r.sample({ region: 'A', frames: 130 })).toEqual({ region: 'A', running: true, stats: { gameSeconds: 1 } });
        expect(r.sample({ region: 'A', frames: 190 })).toEqual({ region: 'A', running: true, stats: { gameSeconds: 3 } });
    });

    it('MUTANT "running stuck true while paused": a clock that stops is reported stopped once, then silence', () => {
        const r = new PlayClockReporter();
        r.sample({ region: 'A', frames: 0 });
        r.sample({ region: 'A', frames: 30 });
        expect(r.sample({ region: 'A', frames: 30 })).toEqual({ region: 'A', running: false, stats: { gameSeconds: 1 } });
        expect(r.sample({ region: 'A', frames: 30 })).toBeNull();
        expect(r.sample({ region: 'A', frames: 30 })).toBeNull();
        // ...and resumes on the next step.
        expect(r.sample({ region: 'A', frames: 45 })).toEqual({ region: 'A', running: true, stats: { gameSeconds: 1.5 } });
    });

    it('gameSeconds is MONOTONIC per visit: a seam rewind (or a reload\'s 0) contributes nothing', () => {
        const r = new PlayClockReporter();
        const seen = [];
        for (const frames of [1000, 1030, 990, 1020, 0, 60]) {
            const rep = r.sample({ region: 'A', frames });
            if (rep) seen.push(rep.stats.gameSeconds);
        }
        expect(seen).toEqual([0, 1, 1, 2, 2, 4]);
        for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    });

    it('a region change starts a new visit at 0', () => {
        const r = new PlayClockReporter();
        r.sample({ region: 'A', frames: 0 });
        r.sample({ region: 'A', frames: 90 });
        expect(r.sample({ region: 'B', frames: 95 })).toEqual({ region: 'B', running: false, stats: { gameSeconds: 0 } });
        expect(r.sample({ region: 'B', frames: 125 }).stats.gameSeconds).toBe(1);
    });

    it('a game with no clock (a page going away) stops a running clock, once', () => {
        const r = new PlayClockReporter();
        r.sample({ region: 'A', frames: 0 });
        r.sample({ region: 'A', frames: 30 });
        expect(r.sample({ region: 'A', frames: null })).toEqual({ region: 'A', running: false, stats: { gameSeconds: 1 } });
        expect(r.sample({ region: 'A', frames: null })).toBeNull();
    });
});

describe('⛓ PLAY CLOCK — the wiring', () => {
    let frames, transport, loopOn, parked, region, published, clock, game;
    const bus = () => ({
        publish: (event, data) => published.push({ event, data }),
        subscribe: vi.fn(() => () => {}),
    });
    function make() {
        game = { botStatus: () => JSON.stringify({ game_time: frames }) };
        clock = new SeedlingPlayClock({
            eventBus: bus(),
            getSurface: () => ({ transport }),
            getGame: () => game,
            getRegion: () => region,
            isLoopModeActive: () => loopOn,
            isParked: () => parked,
        });
        clock.start();
    }
    beforeEach(() => {
        vi.useFakeTimers();
        frames = 0; transport = 'js'; loopOn = true; parked = false; region = 'A'; published = [];
    });
    afterEach(() => { clock?.stop(); vi.useRealTimers(); });

    it('publishes `substrate:playClock` on the JS and wasm runtimes', () => {
        expect(PLAY_CLOCK_EVENT).toBe('substrate:playClock');
        expect([...PLAY_CLOCK_TRANSPORTS]).toEqual(['js', 'wasm']);
        for (const t of PLAY_CLOCK_TRANSPORTS) {
            transport = t; published = [];
            make();
            vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS);
            expect(published.map((p) => p.event)).toEqual([PLAY_CLOCK_EVENT]);
            clock.stop();
        }
    });

    it('⛔ the Flash (Ruffle) runtime, a parked binding, and Loop mode off read nothing', () => {
        for (const [t, l, p] of [['flash', true, false], ['js', false, false], ['js', true, true], [null, true, false]]) {
            transport = t; loopOn = l; parked = p; published = [];
            make();
            const reads = vi.fn(() => JSON.stringify({ game_time: 0 }));
            game.botStatus = reads;
            vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS * 5);
            expect(reads).not.toHaveBeenCalled();
            expect(published).toEqual([]);
            clock.stop();
        }
    });

    it('MUTANT "wall clock used instead of game time": wall seconds pass, the game clock does not — no seconds', () => {
        make();
        vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS * 10);
        expect(published.every((p) => p.data.stats.gameSeconds === 0)).toBe(true);
        // And the game at 2× (60 frames a wall second) is charged 2 game seconds per wall second.
        published = [];
        for (let i = 0; i < 3; i += 1) { frames += 60; vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS); }
        expect(published.map((p) => p.data.stats.gameSeconds)).toEqual([2, 4, 6]);
    });

    it('CADENCE: at most one report per read while running; a stopped clock is reported once', () => {
        make();
        for (let i = 0; i < 10; i += 1) { frames += 30; vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS); }
        expect(clock.stats.reads).toBe(10);
        expect(published.length).toBeLessThanOrEqual(10);
        published = [];
        vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS * 10); // held (a solve, a botHold): the clock stops
        expect(published.map((p) => p.data.running)).toEqual([false]);
        expect(published[0].data.stats.gameSeconds).toBe(9); // 10 reads, the first was the visit's baseline
    });

    it('leaving Loop mode stops a running clock, once', () => {
        make();
        vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS);
        frames += 30; vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS);
        published = [];
        loopOn = false;
        vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS * 3);
        expect(published.map((p) => p.data)).toEqual([{ region: 'A', running: false, stats: { gameSeconds: 1 } }]);
    });

    it('a new page is a new count (never a step of the old page\'s clock)', () => {
        make();
        frames = 500; vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS);
        frames = 530; vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS);
        published = [];
        game = { botStatus: () => JSON.stringify({ game_time: 2 }) };
        vi.advanceTimersByTime(PLAY_CLOCK_POLL_MS);
        expect(published.map((p) => p.data)).toEqual([
            { region: 'A', running: false, stats: { gameSeconds: 1 } },
            { region: 'A', running: false, stats: { gameSeconds: 0 } },
        ]);
    });

    it('subscribes to the region change (a read at once)', () => {
        make();
        expect(clock.eventBus.subscribe).toHaveBeenCalledWith('gameState:regionChanged', expect.any(Function));
    });
});
