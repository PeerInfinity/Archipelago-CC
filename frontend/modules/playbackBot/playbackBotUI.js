/**
 * Playback bot — remote control for the maze panel's playthrough
 * visualizer. Mounted in the presets panel's procgen-data section.
 *
 * The bot's controls publish `playback:command` events on the
 * eventBus; the maze panel subscribes and forwards them to its
 * visualizer. Cross-region playback is then driven by the
 * visualizer's exit-cross → user:regionMove → maze:loadRegion
 * chain, just as keyboard play would. The bot itself owns no
 * playback state — it's a remote, not a duplicate engine.
 *
 * Also displays a static "sphere log loaded: N entries" summary
 * so the user can confirm the loader picked up the log they
 * expected (separate file vs embedded fallback both reach this
 * widget identically).
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 5)
 */

import { PlaybackControlBar } from '../shared/playbackControlBar.js';

const DEFAULT_RATE_HZ = 4;
const PLAYBACK_COMMAND_EVENT = 'playback:command';
const PUBLISHER_MODULE = 'presets';

/**
 * Build a Map<locationName, regionName> from stateManager's static
 * region data. Used by the bot to answer "which region does the next
 * sphere-log location live in?" without parsing names.
 *
 * `staticData.regions` is a Map<regionName, regionData> populated from
 * rules.json's per-player regions block; each regionData has a
 * `locations: [{ name, ... }]` array. Locations without a name are
 * skipped (defensive — shouldn't happen for a well-formed rules.json).
 *
 * Pure function — exported for testing.
 */
export function buildLocationIndex(staticData) {
    const index = new Map();
    const regions = staticData?.regions;
    if (!regions || typeof regions.entries !== 'function') return index;
    for (const [regionName, regionData] of regions.entries()) {
        const locations = regionData?.locations;
        if (!Array.isArray(locations)) continue;
        for (const loc of locations) {
            if (!loc?.name) continue;
            index.set(loc.name, regionName);
        }
    }
    return index;
}

/**
 * Flatten a sphere log into an ordered queue of locations the bot
 * should visit, in the order the AP fill assigned them.
 *
 * Consumes the parsed shape that `sphereState.getSphereData()`
 * returns (already filtered to state_update entries, already
 * scoped to the current player, already sorted by sphere index):
 *   [{ sphereIndex, fractionalIndex, locations: [name, ...], ... }]
 *
 * Locations whose region can't be resolved via the index are dropped
 * with no fanfare; the caller is expected to log if it cares (the
 * bot does, in its play loop).
 *
 * Pure function — exported for testing.
 *
 * Returns: [{ locationName, regionName, sphereIndex, fractionalIndex }, ...]
 *   sphereIndex / fractionalIndex are preserved verbatim so the bot's
 *   status line can show "Sphere 0.3 → ..." instead of just a queue
 *   index.
 */
export function buildSphereQueue(sphereData, locationIndex) {
    const queue = [];
    if (!Array.isArray(sphereData)) return queue;
    if (!locationIndex || typeof locationIndex.get !== 'function') return queue;
    for (const entry of sphereData) {
        const locations = entry?.locations;
        if (!Array.isArray(locations)) continue;
        for (const locationName of locations) {
            const regionName = locationIndex.get(locationName);
            if (!regionName) continue;
            queue.push({
                locationName,
                regionName,
                sphereIndex: entry.sphereIndex ?? null,
                fractionalIndex: entry.fractionalIndex ?? null,
            });
        }
    }
    return queue;
}

/**
 * Format a queue entry's sphere index for inclusion in the bot's
 * status line: "Sphere 0 → ", "Sphere 0.1 → ", or "" when the entry
 * has no sphere index. Trailing arrow + space is part of the prefix
 * so callers can do `${sphereTag}walking to ...` cleanly even when
 * the tag is absent.
 *
 * Pure helper — exported for testing.
 */
export function formatSphereTag(entry) {
    if (!entry || entry.sphereIndex == null) return '';
    const s = entry.sphereIndex;
    const f = entry.fractionalIndex;
    const idx = (f != null && f !== 0) ? `${s}.${f}` : `${s}`;
    return `Sphere ${idx} → `;
}

// Module-scope registry of the currently-mounted bot, mirroring the
// setPanelInstance pattern in mazeRoom/index.js. The presets module
// registers dispatcher receivers for user:locationCheck /
// user:regionMove and forwards them via getActiveBot(); the bot
// itself can't register dispatcher receivers because dispatcher
// receivership is module-scoped, and the bot is a UI widget mounted
// inside the presets panel rather than its own module.
let _activeBot = null;
export function setActiveBot(bot) { _activeBot = bot; }
export function getActiveBot() { return _activeBot; }

export class PlaybackBotUI {
    constructor({
        getSphereData,
        getStaticData = null,
        eventBus = null,
        pathFinder = null,
    } = {}) {
        this._getSphereData = getSphereData;
        this._getStaticData = getStaticData;
        this._eventBus = eventBus;
        this._pathFinder = pathFinder;
        this._rate = DEFAULT_RATE_HZ;
        this._element = null;
        this._statusEl = null;
        this._controlBar = null;

        // Sphere-log queue + cursor + region tracking. Built lazily on
        // first play() so the bot can be constructed before the sphere
        // log / static data are available (e.g. mounted as part of a
        // presets-panel render before the user picks a preset).
        this._queue = null;
        this._cursor = 0;
        this._currentRegion = null;
        this._isActive = false;
        // Set of locationNames the bot has seen via user:locationCheck.
        // The bot's _advanceCursor uses this to skip queue entries that
        // were collected incidentally — i.e. picked up while walking
        // through a tile en route to a different head. Without this,
        // the second visit would silently no-op (stateManager already
        // marks the location checked, so the visualizer suppresses the
        // pickup event), and the cursor would stall.
        this._checkedSoFar = new Set();
        this._status = 'idle';
        // Append-only log of bot state transitions (one entry per
        // status change). _render paints the most-recent entries into
        // the widget so the user can scroll back through what the bot
        // decided across the run, instead of losing context as a
        // single-line status overwrites itself. Entries are also
        // deduped against the previous one so a repeat-walkTo (head
        // unchanged) doesn't spam the log.
        this._log = [];
        // Last walkTo target we asked for, as a `${kind}:${name}` sig.
        // Used to suppress redundant walkTo publishes when an event
        // arrives mid-leg (incidental pickup, etc.) and the head
        // hasn't changed.
        this._lastPublishedTarget = null;

        setActiveBot(this);
        this._mount();
    }

    getElement() {
        return this._element;
    }

    destroy() {
        if (this._controlBar) this._controlBar.destroy();
        if (this._element?.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._element = null;
        if (_activeBot === this) setActiveBot(null);
    }

    // --- public controls ---
    // Each forwards as a `playback:command` event. The maze panel's
    // visualizer subscribes and drives the actual playback.
    //
    // play / step / instant also kick the bot's play loop: they ensure
    // the queue is built and publish a walkTo for the current head
    // before the underlying clock command, so the visualizer has a
    // target on the first tick.

    play(rateHz = this._rate) {
        this._rate = rateHz;
        this._ensureQueueBuilt();
        if (this._queue.length === 0) {
            // Thin-remote fallback: no sphere queue to drive, so we
            // just kick the visualizer's clock and let its greedy
            // mode (or whatever else the user has set up) handle the
            // walk. This preserves the bot's pre-Phase-3 role as a
            // pure remote control when the preset has no sphere log.
            this._setStatus('no sphere log');
            this._publish('play', { rateHz });
            this._render();
            return;
        }
        this._isActive = true;
        this._publishNextWalkTo();
        if (!this._isActive) return;    // queue drained or errored — don't start the clock
        this._publish('play', { rateHz });
    }

    stop() {
        // Pause without clearing the cursor — calling play() again
        // resumes from the same head.
        this._isActive = false;
        this._publish('stop');
    }

    step() {
        this._ensureQueueBuilt();
        if (this._queue.length === 0) {
            this._publish('step');
            return;
        }
        this._publishNextWalkTo();
        this._publish('step');
    }

    instant() {
        this._ensureQueueBuilt();
        if (this._queue.length === 0) {
            this._publish('instant');
            return;
        }
        this._isActive = true;
        this._publishNextWalkTo();
        if (!this._isActive) return;
        this._publish('instant');
    }

    reset() {
        this._isActive = false;
        this._cursor = 0;
        this._checkedSoFar.clear();
        this._queue = null;             // rebuild from sphereData on next play
        this._lastPublishedTarget = null;
        this._currentRegion = null;
        this._status = 'idle';
        this._log = [];                 // start a fresh transition history
        this._publish('reset');
        this._render();
    }

    setRate(rateHz) {
        this._rate = rateHz;
        this._publish('setRate', { rateHz });
    }

    // --- public state accessors ---

    getStatus() { return this._status; }
    getCursor() { return this._cursor; }
    getQueueLength() { return this._queue?.length ?? 0; }
    getCurrentRegion() { return this._currentRegion; }
    isActive() { return this._isActive; }
    getLog() { return this._log.slice(); }

    /**
     * Set the bot's current status string AND append a corresponding
     * entry to the log. Deduped against the previous entry's text so
     * mid-leg events that don't change anything don't spam the log.
     * Pure state mutation — caller still has to _render().
     */
    _setStatus(text) {
        this._status = text;
        if (this._log.length === 0 || this._log[this._log.length - 1] !== text) {
            this._log.push(text);
        }
    }

    // --- dispatcher event handlers ---
    // The presets module's register() wires user:locationCheck /
    // user:regionMove to forward here via getActiveBot(). The handlers
    // are also called directly by tests, so the wiring side is
    // independently verifiable.

    onLocationCheck(data) {
        const name = data?.locationName;
        if (!name) return;
        this._checkedSoFar.add(name);
        if (this._isActive) this._publishNextWalkTo();
        this._render();
    }

    onRegionMove(data) {
        const target = data?.targetRegion;
        if (target) this._currentRegion = target;
        if (this._isActive) this._publishNextWalkTo();
        this._render();
    }

    // --- play loop ---

    _ensureQueueBuilt() {
        if (this._queue) return;
        const staticData = this._getStaticData?.();
        const sphereData = this._getSphereData?.();
        if (!staticData || !Array.isArray(sphereData)) {
            this._queue = [];
            return;
        }
        const idx = buildLocationIndex(staticData);
        this._queue = buildSphereQueue(sphereData, idx);
        this._cursor = 0;
        this._lastPublishedTarget = null;
    }

    /**
     * Skip queue entries whose location is already in
     * `_checkedSoFar`. Called both before issuing each walkTo and
     * after each event so the cursor never sits on a stale head.
     */
    _advanceCursor() {
        if (!this._queue) return;
        while (this._cursor < this._queue.length
            && this._checkedSoFar.has(this._queue[this._cursor].locationName)) {
            this._cursor += 1;
        }
    }

    /**
     * Compute the next destination given the current head and emit a
     * walkTo command for it (a same-region location, or the first
     * exit on a PathFinder route to the head's region). Errors short-
     * circuit into a stop + status message.
     */
    _publishNextWalkTo() {
        if (!this._queue) return;
        this._advanceCursor();
        const head = this._queue[this._cursor];
        if (!head) {
            // Queue drained — terminate cleanly. The bot publishes a
            // single 'stop' so the visualizer halts; no greedy
            // fallback runs because controlled mode is sticky on the
            // visualizer side.
            this._setStatus(`finished — ${this._cursor} location${this._cursor === 1 ? '' : 's'} visited`);
            this._isActive = false;
            this._lastPublishedTarget = null;
            this._publish('stop');
            this._render();
            return;
        }
        const progress = `(${this._cursor + 1}/${this._queue.length})`;
        const sphereTag = formatSphereTag(head);
        if (!this._currentRegion) {
            // First user:regionMove hasn't arrived yet — wait for it.
            // Don't fail; just keep idle. The next event will retrigger
            // this method.
            this._setStatus(`${sphereTag}waiting for region ${progress}`);
            this._render();
            return;
        }
        if (head.regionName === this._currentRegion) {
            this._setStatus(`${sphereTag}walking to "${head.locationName}" ${progress}`);
            this._publishWalkTo({ kind: 'location', name: head.locationName });
            this._render();
            return;
        }
        // Cross-region: route via the PathFinder against the real
        // snapshot, so accessibility reflects keys collected so far.
        const path = this._pathFinder?.findPathWithExits?.(this._currentRegion, head.regionName);
        if (!path || !Array.isArray(path.steps) || path.steps.length < 2) {
            this._setStatus(`error: no path from ${this._currentRegion} to ${head.regionName}`);
            this._isActive = false;
            this._lastPublishedTarget = null;
            this._publish('stop');
            this._render();
            return;
        }
        const nextExit = path.steps[1].exitUsed;
        if (!nextExit) {
            this._setStatus(`error: PathFinder returned a step without an exit (${this._currentRegion} → ${head.regionName})`);
            this._isActive = false;
            this._lastPublishedTarget = null;
            this._publish('stop');
            this._render();
            return;
        }
        this._setStatus(`${sphereTag}routing via "${nextExit}" → ${head.regionName} ${progress}`);
        this._publishWalkTo({ kind: 'exit', name: nextExit });
        this._render();
    }

    _publishWalkTo(target) {
        // De-dupe identical consecutive walkTo: an event mid-leg can
        // re-enter _publishNextWalkTo without changing the head, and
        // re-issuing the same walkTo would just have the visualizer
        // re-plan to the same tile. The signature includes the
        // current region because the same exit name (e.g. "exit_1")
        // appears in multiple regions — without the region prefix,
        // a same-named exit in a different region would be silently
        // skipped after a region transition, leaving the visualizer
        // with no target.
        const sig = `${this._currentRegion}:${target.kind}:${target.name}`;
        if (sig === this._lastPublishedTarget) return;
        this._lastPublishedTarget = sig;
        this._publish('walkTo', { target });
    }

    _publish(command, extra = {}) {
        if (!this._eventBus?.publish) {
            // No event bus — log a hint and stay quiet on the wire.
            console.warn(`[playbackBot] eventBus unavailable; cannot publish ${command}`);
            return;
        }
        this._eventBus.publish(PLAYBACK_COMMAND_EVENT, {
            command,
            ...extra,
            source: 'playbackBot',
        }, PUBLISHER_MODULE);
    }

    _mount() {
        if (typeof document === 'undefined') return;
        const root = document.createElement('div');
        root.className = 'playback-bot';

        const heading = document.createElement('div');
        heading.className = 'playback-bot-heading';
        heading.textContent = 'Sphere log replay';
        root.appendChild(heading);

        this._controlBar = new PlaybackControlBar({
            label: 'Bot',
            initialRate: this._rate,
            actions: {
                instant: () => this.instant(),
                step:    () => this.step(),
                play:    (rateHz) => this.play(rateHz),
                stop:    () => this.stop(),
                reset:   () => this.reset(),
                setRate: (rateHz) => this.setRate(rateHz),
            },
        });
        const barEl = this._controlBar.getElement();
        if (barEl) root.appendChild(barEl);

        // Append-only log of bot state transitions. Single-line status
        // would lose context every time the bot decided something new
        // (route via X, walking to Y, finished, etc.). The log keeps
        // the full history so the user can scroll back. _statusEl is
        // kept around as the "header" line that summarizes the most
        // recent state at a glance; the log entries below are the
        // history.
        const statusEl = document.createElement('div');
        statusEl.className = 'playback-bot-status';
        root.appendChild(statusEl);
        this._statusEl = statusEl;

        const logEl = document.createElement('div');
        logEl.className = 'playback-bot-log';
        root.appendChild(logEl);
        this._logEl = logEl;

        const hint = document.createElement('div');
        hint.className = 'playback-bot-hint';
        hint.textContent = 'Drives the maze panel — open it in another column to watch the bot walk.';
        root.appendChild(hint);

        this._element = root;
        this._render();
    }

    _render() {
        if (!this._element) return;
        // Header (most recent status) line. While the bot is doing
        // something (idle is the default at mount time), show the
        // current status. Otherwise fall back to the static sphere-log
        // summary so a freshly-mounted bot still tells the user what
        // sphere log is available.
        if (this._statusEl) {
            if (this._status && this._status !== 'idle') {
                this._statusEl.textContent = this._status;
            } else {
                const data = this._getSphereData?.() ?? [];
                const total = Array.isArray(data) ? data.length : 0;
                this._statusEl.textContent = total > 0
                    ? `Sphere log loaded: ${total} entries.`
                    : 'No sphere log loaded.';
            }
        }

        // Append-only history. Render the full log; the panel's
        // scroll container handles overflow. Each entry is a single
        // <div> so CSS can style them as a tight monospaced list.
        if (this._logEl) {
            // Reuse existing children when possible to avoid replacing
            // the whole DOM each render (which would scroll-jump). A
            // common case is "log grew by one entry"; we just append.
            const existing = this._logEl.children.length;
            if (existing > this._log.length) {
                // Log shrank (reset()) — clear and re-render.
                this._logEl.innerHTML = '';
                for (const text of this._log) {
                    const entry = document.createElement('div');
                    entry.className = 'playback-bot-log-entry';
                    entry.textContent = text;
                    this._logEl.appendChild(entry);
                }
            } else {
                for (let i = existing; i < this._log.length; i += 1) {
                    const entry = document.createElement('div');
                    entry.className = 'playback-bot-log-entry';
                    entry.textContent = this._log[i];
                    this._logEl.appendChild(entry);
                }
            }
            // Auto-scroll to bottom on append so the latest entry is
            // visible. scrollHeight is up-to-date once children are
            // attached synchronously.
            this._logEl.scrollTop = this._logEl.scrollHeight;
        }
    }
}
