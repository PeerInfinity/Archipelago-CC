/**
 * flashPanel/seedlingPlayClock — **THE SEEDLING PLAY CLOCK** (⚖ user, 2026-10-11: "Drain play time too"). It reports
 * the GAME's own clock to Loops as `substrate:playClock {region, running, stats: {gameSeconds}}`, the event the flash
 * bridge relays for a game that calls `__swfBridge.setPlayClock` itself (`flashSubstrate/bridge.js`). Loops charges a
 * COARSE region whose substrate declares `loopSupport.playClock` per GAME second played (`loopState._regionDrainsTime`).
 *
 * ── THE GAME'S TRUTH: `Game.time`, counted in frames ─────────────────────────────────────────────────────────────
 *
 * `botStatus().game_time` IS `Game.time` = `Main.time` (`Game.as:490-497`), advanced by `time += timeRate` once per
 * `Game.update()` (`Game.as:890`) — on dead frames, in text, on the title menu, everywhere a frame steps. The JS
 * runtime's `botStatus().game_time` is its model's step count (`jsRuntimeCore`), the same quantity on the page's own
 * 30-a-second clock. Nothing here reads a wall clock: a frame that did not step costs nothing, and a page at 2× is
 * charged 2 game seconds a wall second.
 *
 * A game SECOND is `SEEDLING_FRAMES_PER_GAME_SECOND` frames (30) — the step every update this game is run at:
 * `FP.elapsed` is clamped to `MAX_ELAPSED = 0.0333` (`Engine.as:162`, `seedlingProfile.fpElapsed`), and the JS page
 * paces its model at `TICKS_PER_SECOND = 30` (`jsRuntimePage.js`). ⚠ `Main.FPS` is 60 and the game's own day length is
 * written `160 * Main.FPS` "seconds" (`Game.as:460`); that is the REQUESTED stage rate, which no runtime here reaches
 * (the bot log measured 24 ticks/s at best), and every physics step the model and the game take is a 1/30 s step.
 *
 * ── RUNNING = THE CLOCK ADVANCED ──────────────────────────────────────────────────────────────────────────────────
 *
 * No flag is consulted: `running` is whether `game_time` moved since the previous read. What stops it is therefore
 * exactly what stops `Game.update()` (source: `Main.as:80-88`, measured by the in-app rows):
 *   - wasm: `Bot.frozen` (`botHold("on")` — the engine's held arrival, a solve in flight, a mid-room delivery) and
 *     `Bot.holding` (a tape that declared `hold` and latched); the opening cutscene's `timeRate` decaying to 0
 *     (`Game.as:918-959`); an engine that does not tick (a page not yet running, a reload);
 *   - js: no session (nothing mounted yet), a HALT, and a solve in flight (`walker.solverHolding` — the room is held).
 * The title MENU, text boxes and the load fade do NOT stop it: `Game.update()` runs through them.
 *
 * ── gameSeconds IS MONOTONIC PER VISIT ────────────────────────────────────────────────────────────────────────────
 *
 * The count is the sum of the FORWARD steps of `game_time` since the visit began (a region change, or a new page).
 * A tape's seam WRITES `Main.time` (`Bot.as:1815`), usually a few frames back, and a reload starts the JS page's count
 * at 0: a backward step contributes nothing, so a visit's `gameSeconds` never goes back (Loops would read a counter
 * that went back as a new visit and charge it all again). The frames played after a seam rewind ARE played — they
 * are stepped again — so they are charged.
 *
 * ── CADENCE ───────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * One `botStatus` read every `PLAY_CLOCK_POLL_MS` (wasm: 14–16 ms of the page's main thread, ~1.5 %), plus one on a
 * region change and one when Loop mode turns on; only in Loop mode, only on the JS or wasm runtime, only while the region binding is not parked. A
 * report goes out on a running edge, on a new visit, and once per read while the clock runs — never per frame, and
 * nothing while a stopped clock stays stopped.
 *
 * ⛔ The Flash (Ruffle) runtime gets NO report from here: its SWF does not call `setPlayClock`, and a report off its
 * `botStatus` would be a second, unmeasured reader of a game this file has not validated. A Flash-runtime region is
 * charged per queued action only (the coarse rule without a clock).
 */

/** The event (`flashSubstrate/bridge.js` `_onSetPlayClock`; `loopState` subscribes). */
export const PLAY_CLOCK_EVENT = 'substrate:playClock';

/** Frames of `Game.time` per game second (see the header: the 1/30 s step every update takes). */
export const SEEDLING_FRAMES_PER_GAME_SECOND = 30;

/** How often the game's clock is read while Loop mode plays a Seedling region. */
export const PLAY_CLOCK_POLL_MS = 1000;

/** The events that read the game's clock at once (beside the poll). */
export const PLAY_CLOCK_SAMPLE_EVENTS = Object.freeze(['gameState:regionChanged', 'gameState:loopModeChanged']);

/** The runtimes whose `botStatus().game_time` is read (the panel's `transport`). */
export const PLAY_CLOCK_TRANSPORTS = Object.freeze(['js', 'wasm']);

/** The game's clock in a `botStatus` readout (a JSON string or an object), or null. */
export function gameFramesOf(status) {
    let st = status;
    if (typeof st === 'string') {
        try { st = JSON.parse(st); } catch { return null; }
    }
    const t = st?.game_time;
    return typeof t === 'number' && Number.isFinite(t) ? t : null;
}

/**
 * The pure half: game-clock samples in, reports out. `sample({region, frames})` returns the report to publish, or
 * null. `frames: null` = the game gave no clock (a page going away): a running clock is reported stopped once.
 */
export class PlayClockReporter {
    constructor({ framesPerSecond = SEEDLING_FRAMES_PER_GAME_SECOND } = {}) {
        if (!(framesPerSecond > 0)) throw new Error(`PlayClockReporter: framesPerSecond must be positive, got ${framesPerSecond}`);
        this.framesPerSecond = framesPerSecond;
        this.reset();
    }

    /** Forget the visit (a new page; the next sample starts one). */
    reset() {
        this.region = null;
        this.lastFrames = null;
        this.playedFrames = 0;
        this.running = false;
    }

    get gameSeconds() { return this.playedFrames / this.framesPerSecond; }

    sample({ region, frames }) {
        if (typeof region !== 'string' || !region) return null;
        if (frames === null || frames === undefined || !Number.isFinite(frames)) {
            if (!this.running || this.region !== region) return null;
            this.running = false;
            return this._report();
        }
        if (region !== this.region) {
            // A new visit: its clock starts here, and it has not been SEEN advancing yet.
            this.region = region;
            this.lastFrames = frames;
            this.playedFrames = 0;
            this.running = false;
            return this._report();
        }
        const step = frames - this.lastFrames;
        this.lastFrames = frames;
        const advanced = step > 0;
        if (advanced) this.playedFrames += step;
        const edge = advanced !== this.running;
        this.running = advanced;
        return advanced || edge ? this._report() : null;
    }

    _report() {
        return { region: this.region, running: this.running, stats: { gameSeconds: this.gameSeconds } };
    }
}

/**
 * The wiring: reads the game on a timer and on a region change, and publishes. Every dependency is resolved at CALL
 * time (a preset switch replaces the page).
 *
 * @param {object} deps
 * @param {object} deps.eventBus         publish/subscribe
 * @param {function} deps.getSurface     the panel's `seedlingPlaybackSurface()` (`transport`), or null
 * @param {function} deps.getGame        the game's callback table (`botStatus`), or null
 * @param {function} deps.getRegion      the current AP region (gameState's), or null
 * @param {function} deps.isLoopModeActive
 * @param {function} [deps.isParked]    true while another substrate owns the player (the region binding parked)
 * @param {object} [deps.timers]         {setInterval, clearInterval}
 */
export class SeedlingPlayClock {
    constructor({ eventBus, getSurface, getGame, getRegion, isLoopModeActive, isParked, timers,
        framesPerSecond = SEEDLING_FRAMES_PER_GAME_SECOND, pollMs = PLAY_CLOCK_POLL_MS } = {}) {
        this.eventBus = eventBus ?? null;
        this.getSurface = getSurface ?? (() => null);
        this.getGame = getGame ?? (() => null);
        this.getRegion = getRegion ?? (() => null);
        this.isLoopModeActive = isLoopModeActive ?? (() => false);
        this.isParked = isParked ?? (() => false);
        this._timers = timers ?? { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (h) => clearInterval(h) };
        this.pollMs = pollMs;
        this.reporter = new PlayClockReporter({ framesPerSecond });
        this._game = null;
        this._timer = null;
        this._unsubs = [];
        /** Diagnostics (the in-app rows read these). */
        this.stats = { reads: 0, reports: 0, last: null };
    }

    start() {
        if (this._timer) return;
        this._timer = this._timers.setInterval(() => this.sampleNow(), this.pollMs);
        if (this.eventBus?.subscribe) {
            // A region change and Loop mode turning on are read AT ONCE: until a region's first report Loops charges
            // it per wall second (its rule for a clock that has not spoken), so the first report must not wait a poll.
            for (const event of PLAY_CLOCK_SAMPLE_EVENTS) {
                const h = () => this.sampleNow();
                const off = this.eventBus.subscribe(event, h);
                this._unsubs.push(typeof off === 'function' ? off : () => this.eventBus.unsubscribe?.(event, h));
            }
        }
    }

    stop() {
        if (this._timer) { this._timers.clearInterval(this._timer); this._timer = null; }
        for (const off of this._unsubs) off();
        this._unsubs = [];
    }

    /** Whether the game's clock is read now (Loop mode, a JS/wasm runtime, an unparked binding). */
    wants() {
        if (!this.isLoopModeActive()) return false;
        if (this.isParked()) return false;
        const transport = this.getSurface()?.transport ?? null;
        return PLAY_CLOCK_TRANSPORTS.includes(transport);
    }

    /** One read of the game's clock; returns the report published, or null. */
    sampleNow() {
        const region = this.getRegion();
        if (!this.wants()) {
            // Leaving the readable state is a stop, said once (a running clock nobody reads is not running).
            return this._publish(this.reporter.sample({ region: this.reporter.region, frames: null }));
        }
        const game = this.getGame();
        if (game !== this._game) {
            // A new page: its clock is a new count, never a step of the old one.
            if (this._game !== null) this._publish(this.reporter.sample({ region: this.reporter.region, frames: null }));
            this._game = game;
            this.reporter.reset();
        }
        let frames = null;
        try { frames = gameFramesOf(game?.botStatus?.()); } catch { frames = null; }
        this.stats.reads += 1;
        return this._publish(this.reporter.sample({ region, frames }));
    }

    _publish(report) {
        if (!report) return null;
        this.stats.reports += 1;
        this.stats.last = report;
        try { this.eventBus?.publish?.(PLAY_CLOCK_EVENT, report); } catch { /* a bus that refuses — the stats still say */ }
        return report;
    }
}
