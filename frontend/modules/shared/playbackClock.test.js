import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackClock } from './playbackClock.js';

function makeManualScheduler() {
    const pending = [];
    return {
        scheduler: {
            schedule(cb) {
                pending.push(cb);
                return () => {
                    const idx = pending.indexOf(cb);
                    if (idx !== -1) pending.splice(idx, 1);
                };
            },
        },
        fire(nowMs) {
            const next = pending.shift();
            if (next) next(nowMs);
        },
        size() { return pending.length; },
    };
}

describe('PlaybackClock', () => {
    it('throws when onTick is missing', () => {
        expect(() => new PlaybackClock({})).toThrow();
    });

    it('starts not running, with default rate', () => {
        const clock = new PlaybackClock({ onTick: () => {} });
        expect(clock.isRunning()).toBe(false);
        expect(clock.getRate()).toBeGreaterThan(0);
    });

    it('start() flips running state and schedules a tick', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(2);
        expect(clock.isRunning()).toBe(true);
        expect(sched.size()).toBe(1);
    });

    it('stop() halts further scheduling', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(2);
        clock.stop();
        sched.fire(0);
        expect(onTick).not.toHaveBeenCalled();
        expect(clock.isRunning()).toBe(false);
    });

    it('fires onTick when interval has elapsed', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(2); // 500ms interval

        sched.fire(0);   // first tick: lastFire was null, fires immediately
        expect(onTick).toHaveBeenCalledTimes(1);

        sched.fire(100); // 100ms later, below 500ms threshold — no fire
        expect(onTick).toHaveBeenCalledTimes(1);

        sched.fire(600); // 600ms later, threshold crossed — fires
        expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('reschedules itself after each fire while running', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(10);

        // After each scheduled callback runs, a new one should be queued
        // (provided the clock is still running).
        sched.fire(0);
        expect(sched.size()).toBe(1);
        sched.fire(200);
        expect(sched.size()).toBe(1);
    });

    it('setRate() updates the firing interval', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(1); // 1000ms interval

        sched.fire(0);
        expect(onTick).toHaveBeenCalledTimes(1);

        clock.setRate(10); // 100ms interval

        sched.fire(150); // elapsed 150ms since last fire — over 100ms — fires
        expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('setRate() rejects invalid rates', () => {
        const clock = new PlaybackClock({ onTick: () => {} });
        expect(() => clock.setRate(0)).toThrow();
        expect(() => clock.setRate(-5)).toThrow();
        expect(() => clock.setRate(NaN)).toThrow();
        expect(() => clock.setRate('foo')).toThrow();
    });

    it('step() fires onTick once regardless of running state', () => {
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick });
        clock.step();
        expect(onTick).toHaveBeenCalledTimes(1);
        expect(clock.isRunning()).toBe(false);
    });

    it('step() works while running and does not affect rate gating', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(2);

        clock.step();
        expect(onTick).toHaveBeenCalledTimes(1);

        sched.fire(0); // first scheduled tick still fires (lastFire was null before tick)
        expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('start() while already running is a no-op', () => {
        const sched = makeManualScheduler();
        const onTick = vi.fn();
        const clock = new PlaybackClock({ onTick, scheduler: sched.scheduler });
        clock.start(2);
        const sizeBefore = sched.size();
        clock.start(5); // would re-set rate but should not double-schedule
        expect(sched.size()).toBe(sizeBefore);
        expect(clock.getRate()).toBe(2); // rate unchanged when start is no-op
    });
});
