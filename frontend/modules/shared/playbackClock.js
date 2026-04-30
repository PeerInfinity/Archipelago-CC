/**
 * Playback clock — substrate-neutral timing primitive for the
 * playthrough visualizer and the playback bot. Drives `onTick`
 * calls at a configurable rate (Hz), with start / stop / single-
 * step / rate-change controls.
 *
 * Designed to be testable without a real animation frame loop:
 * `_tick(nowMs)` is the pure entry point that decides whether
 * onTick should fire given the current time. In production, a
 * thin scheduler layer drives `_tick` from requestAnimationFrame.
 * Tests can call `_tick` directly with controlled timestamps.
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 1.2)
 */

const DEFAULT_RATE_HZ = 4;

export class PlaybackClock {
    constructor({ onTick, scheduler = null } = {}) {
        if (typeof onTick !== 'function') {
            throw new Error('PlaybackClock requires an onTick function');
        }
        this._onTick = onTick;
        this._rateHz = DEFAULT_RATE_HZ;
        this._running = false;
        this._lastFireMs = null;
        this._scheduler = scheduler ?? defaultScheduler();
        this._cancelScheduled = null;
    }

    isRunning() { return this._running; }
    getRate() { return this._rateHz; }

    setRate(rateHz) {
        const r = Number(rateHz);
        if (!Number.isFinite(r) || r <= 0) {
            throw new Error(`PlaybackClock.setRate: rate must be a positive finite number, got ${rateHz}`);
        }
        this._rateHz = r;
    }

    start(rateHz) {
        if (this._running) return;
        if (rateHz != null) this.setRate(rateHz);
        this._running = true;
        this._lastFireMs = null;
        this._scheduleNext();
    }

    stop() {
        this._running = false;
        if (this._cancelScheduled) {
            this._cancelScheduled();
            this._cancelScheduled = null;
        }
    }

    /**
     * Fire onTick once, regardless of running state. No-op-on-rate;
     * step is intended for "advance one frame" UI buttons.
     */
    step() {
        this._onTick();
    }

    /**
     * Pure tick gate: given the current time, fires onTick if the
     * configured interval has elapsed since the last fire. Public
     * (underscore-prefixed) so the scheduler layer and tests can
     * drive it.
     */
    _tick(nowMs) {
        if (!this._running) return;
        const intervalMs = 1000 / this._rateHz;
        if (this._lastFireMs == null || nowMs - this._lastFireMs >= intervalMs) {
            this._lastFireMs = nowMs;
            this._onTick();
        }
    }

    _scheduleNext() {
        if (!this._running) return;
        this._cancelScheduled = this._scheduler.schedule((nowMs) => {
            this._tick(nowMs);
            if (this._running) this._scheduleNext();
        });
    }
}

function defaultScheduler() {
    if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
        return {
            schedule(callback) {
                const id = requestAnimationFrame((nowMs) => callback(nowMs));
                return () => cancelAnimationFrame(id);
            },
        };
    }
    return {
        schedule(callback) {
            const id = setTimeout(() => callback(Date.now()), 16);
            return () => clearTimeout(id);
        },
    };
}
