/**
 * Playback bot — remote control for the active substrate's playback
 * controller. The bot resolves the controller for the current region's
 * substrate via substrateRegistry and calls it directly (play / stop /
 * step / instant / reset / setRate / walkTo). Cross-region playback
 * is driven by the substrate's exit-cross → user:regionMove chain,
 * just as keyboard / click play would.
 *
 * The bot is substrate-agnostic above the controller boundary — it
 * builds a queue from sphereState's parsed sphere log and uses
 * PathFinder for inter-region routing. The panel wrapper is
 * responsible for injecting dependencies; the bot itself is a plain
 * widget exercised directly by tests.
 *
 * Plan references:
 *   - NewDocs/plans/procedural-generation/debugging-tools.md (Phase 5)
 *   - NewDocs/plans/procedural-generation/playback-bot-refactor.md (Phase 1)
 */

import { PlaybackControlBar } from '../shared/playbackControlBar.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

const DEFAULT_RATE_HZ = 4;
// LS key for the click-intercept toggle. Persisted separately from
// any per-session bot state because it's a settings-level switch
// (off by default; matches the behaviour the plan specifies).
const LS_INTERCEPT_KEY = 'playbackBot_intercept';
// Cap on how many dispatcher events to keep in the event log so the
// panel stays bounded across long sessions.
const DISPATCHER_LOG_CAP = 200;

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

// Phase 1 of the playback-bot refactor moved active-instance tracking
// out of this widget and into the panel singleton (playbackBot/index.js's
// setActivePanel/getActivePanel). The bot itself is now a plain widget
// owned by PlaybackBotPanel; dispatcher receivers in playbackBot/index.js
// reach it via `getActivePanel()?.getBot()`.

export class PlaybackBotUI {
    constructor({
        getSphereData,
        getStaticData = null,
        getRulesJson = null,
        pathFinder = null,
        stateManagerProxy = null,
        getActiveController = null,
    } = {}) {
        this._getSphereData = getSphereData;
        this._getStaticData = getStaticData;
        // Returns the loaded rules.json (the panel caches it from
        // stateManager:rawJsonDataLoaded). Used by the default
        // _resolveController to look up per-region substrate via
        // preset_sidecars when picking the active controller.
        this._getRulesJson = getRulesJson;
        this._pathFinder = pathFinder;
        // Resolver for the active substrate's PlaybackController. If
        // not injected, defaults to looking up the current region's
        // substrate in the loaded rules.json's preset_sidecars and
        // querying substrateRegistry. Tests can inject a stub
        // controller without mocking the rules.json / registry stack.
        this._getActiveController = getActiveController;
        // Proxy handle used to flush pending worker snapshots before
        // cross-region path-finding. The bot's locationCheck handler
        // fires immediately after the dispatcher propagates the event,
        // but the stateManager worker applies the pickup asynchronously
        // — without a flush, findPathWithExits reads a snapshot that
        // doesn't yet reflect the just-collected key, and any region
        // gated on that key is dropped from the accessibility map.
        // Tests construct the bot without a proxy; the gate below
        // (`if (this._stateManagerProxy?.pingWorker)`) keeps them
        // synchronous in that case.
        this._stateManagerProxy = stateManagerProxy;
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

        // Phase 2 — click-intercept toggle. When on, the module's
        // dispatcher receivers swallow `user:locationCheck` /
        // `user:exitClicked` and route them through walkToLocation /
        // walkToExit instead. Persisted to LS so the choice survives
        // page reloads.
        this._interceptEnabled = loadInterceptFromLS();
        // Append-only log of dispatcher events the module received,
        // each tagged with the disposition (intercepted / propagated).
        // Surfaced in the panel so the user can see the seam working.
        this._dispatcherLog = [];

        // Manual cross-region walkTo target — set by walkToLocation,
        // cleared on arrival or on reset(). Re-dispatched on every
        // onRegionMove so a multi-region route finishes one exit at
        // a time.
        this._pendingManualTarget = null;

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
    }

    // --- public controls ---
    // Each forwards as a `playback:command` event. The maze panel's
    // visualizer subscribes and drives the actual playback.
    //
    // play / step / instant also kick the bot's play loop: they ensure
    // the queue is built and publish a walkTo for the current head
    // before the underlying clock command, so the visualizer has a
    // target on the first tick.

    async play(rateHz = this._rate) {
        this._rate = rateHz;
        this._ensureQueueBuilt();
        if (this._queue.length === 0) {
            // Thin-remote fallback: no sphere queue to drive, so we
            // just kick the visualizer's clock and let its greedy
            // mode (or whatever else the user has set up) handle the
            // walk. This preserves the bot's pre-Phase-3 role as a
            // pure remote control when the preset has no sphere log.
            this._setStatus('no sphere log');
            this._dispatch('play', [rateHz]);
            this._render();
            return;
        }
        this._isActive = true;
        await this._publishNextWalkTo();
        if (!this._isActive) return;    // queue drained or errored — don't start the clock
        this._dispatch('play', [rateHz]);
    }

    stop() {
        // Pause without clearing the cursor — calling play() again
        // resumes from the same head.
        this._isActive = false;
        this._dispatch('stop');
    }

    step() {
        this._ensureQueueBuilt();
        if (this._queue.length === 0) {
            this._dispatch('step');
            return;
        }
        this._publishNextWalkTo();
        this._dispatch('step');
    }

    async instant() {
        this._ensureQueueBuilt();
        if (this._queue.length === 0) {
            this._dispatch('instant');
            return;
        }
        this._isActive = true;
        await this._publishNextWalkTo();
        if (!this._isActive) return;
        this._dispatch('instant');
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
        this._pendingManualTarget = null;
        this._dispatcherLog = [];       // dispatcher event log is run-scoped
        this._dispatch('reset');
        this._render();
    }

    setRate(rateHz) {
        this._rate = rateHz;
        this._dispatch('setRate', [rateHz]);
    }

    // --- public render hook ---
    // Called by the panel wrapper when sphere data changes so the
    // status line picks up the new "Sphere log loaded: N entries"
    // text without requiring the user to press a control first.
    refresh() { this._render(); }

    // --- public state accessors ---

    getStatus() { return this._status; }
    getCursor() { return this._cursor; }
    getQueueLength() { return this._queue?.length ?? 0; }
    getCurrentRegion() { return this._currentRegion; }
    isActive() { return this._isActive; }
    getLog() { return this._log.slice(); }
    isInterceptEnabled() { return this._interceptEnabled; }
    getDispatcherLog() { return this._dispatcherLog.slice(); }
    getCurrentHead() {
        if (!this._queue || this._cursor >= this._queue.length) return null;
        return { ...this._queue[this._cursor] };
    }

    setInterceptEnabled(enabled) {
        this._interceptEnabled = !!enabled;
        saveInterceptToLS(this._interceptEnabled);
        this._render();
    }

    /**
     * Append a dispatcher-log entry. Called by the module's
     * dispatcher receivers (in playbackBot/index.js) for every
     * inbound event so the panel can surface the intercept seam.
     * Disposition is 'intercepted' or 'propagated'.
     */
    logDispatcherEvent(eventName, payload, disposition) {
        const entry = {
            timestamp: Date.now(),
            eventName,
            target: this._dispatcherLogTarget(eventName, payload),
            disposition,
        };
        this._dispatcherLog.push(entry);
        if (this._dispatcherLog.length > DISPATCHER_LOG_CAP) {
            this._dispatcherLog.splice(0, this._dispatcherLog.length - DISPATCHER_LOG_CAP);
        }
        this._render();
    }

    _dispatcherLogTarget(eventName, payload) {
        if (eventName === 'user:locationCheck' || eventName === 'system:locationCheck') {
            return payload?.locationName ?? '?';
        }
        if (eventName === 'user:exitClicked') {
            return payload?.exitName ?? '?';
        }
        if (eventName === 'user:regionMove') {
            return payload?.targetRegion ?? '?';
        }
        return '?';
    }

    // --- manual walkTo entry points ---

    /**
     * Route the bot to a specific named location. Used by the
     * Phase 2 click-intercept (when intercept is on, a real user
     * click on a location card is translated here) and by the
     * manual walkTo input. Bypasses the queue cursor.
     *
     * Stores the target as `_pendingManualTarget` so that if the
     * location lives in a different region, the bot can route
     * through intermediate regions one exit at a time, retrying
     * after each onRegionMove arrival until the target region is
     * reached.
     */
    walkToLocation(name) {
        if (!name) return;
        this._pendingManualTarget = { kind: 'location', name };
        this._dispatchPendingManualTarget();
    }

    /**
     * Route the bot through a specific named exit. v1 assumes the
     * exit lives in the current region (the click came from the
     * Exits panel for the current region's exits). Cross-region
     * exit routing isn't supported here — the regular sphere queue
     * already does that, and the click-intercept use case is
     * "I clicked an exit I can see right now."
     */
    walkToExit(name) {
        if (!name) return;
        this._pendingManualTarget = null;
        this._publishWalkTo({ kind: 'exit', name });
        this._setStatus(`routing via "${name}"`);
        this._render();
    }

    /**
     * Resolve the pending manual target into a single-leg walkTo
     * (direct if same region, exit-step if cross-region). Called on
     * initial walkToLocation / walkToTile and again on every
     * onRegionMove so multi-region routes finish without the user
     * having to re-click. Handles both `kind: 'location'` and
     * `kind: 'tile'` targets — the only difference is how the
     * destination region is determined and what gets published as
     * the final leg.
     */
    async _dispatchPendingManualTarget() {
        const target = this._pendingManualTarget;
        if (!target) return;
        if (target.kind !== 'location' && target.kind !== 'tile') return;

        let targetRegion;
        if (target.kind === 'location') {
            // Find which region the location lives in via the same
            // location-index used by the sphere queue.
            const staticData = this._getStaticData?.();
            const idx = staticData ? buildLocationIndex(staticData) : null;
            targetRegion = idx?.get(target.name) ?? null;
        } else {
            targetRegion = target.region;
        }

        if (!targetRegion || targetRegion === this._currentRegion) {
            // Same region (or unknown — fall through and let the
            // visualizer fail loudly if the target doesn't resolve).
            if (target.kind === 'location') {
                this._publishWalkTo({ kind: 'location', name: target.name });
                this._setStatus(`walking to "${target.name}"`);
            } else {
                this._publishWalkTo({
                    kind: 'tile', region: targetRegion ?? this._currentRegion,
                    x: target.x, y: target.y,
                });
                this._setStatus(`walking to (${targetRegion ?? this._currentRegion ?? '?'} ${target.x},${target.y})`);
            }
            this._pendingManualTarget = null; // arrival ends the route
            this._render();
            return;
        }

        // Cross-region: route via PathFinder, walk to the next exit.
        // _pendingManualTarget stays set; onRegionMove re-enters this
        // method after the bot crosses, picking the next leg. Flush
        // pending snapshot first (see _publishNextWalkTo for why).
        const flush = this._flushSnapshot();
        if (flush) await flush;
        // Re-check after the await — the visualizer may have crossed
        // an exit during the flush, putting us in the target region
        // already. Same logic as _publishNextWalkTo.
        if (targetRegion === this._currentRegion) {
            if (target.kind === 'location') {
                this._publishWalkTo({ kind: 'location', name: target.name });
                this._setStatus(`walking to "${target.name}"`);
            } else {
                this._publishWalkTo({
                    kind: 'tile', region: targetRegion,
                    x: target.x, y: target.y,
                });
                this._setStatus(`walking to (${targetRegion} ${target.x},${target.y})`);
            }
            this._pendingManualTarget = null;
            this._render();
            return;
        }
        const path = this._pathFinder?.findPathWithExits?.(this._currentRegion, targetRegion);
        if (!path || !Array.isArray(path.steps) || path.steps.length < 2) {
            this._setStatus(`error: no path from ${this._currentRegion ?? '?'} to ${targetRegion}`);
            this._pendingManualTarget = null;
            this._render();
            return;
        }
        const nextExit = path.steps[1].exitUsed;
        if (!nextExit) {
            this._setStatus(`error: PathFinder returned no exit (${this._currentRegion} → ${targetRegion})`);
            this._pendingManualTarget = null;
            this._render();
            return;
        }
        this._publishWalkTo({ kind: 'exit', name: nextExit });
        const dest = target.kind === 'location'
            ? `"${target.name}"`
            : `(${targetRegion} ${target.x},${target.y})`;
        this._setStatus(`routing via "${nextExit}" → ${dest}`);
        this._render();
    }

    /**
     * Manual walkTo by tile coordinate. Used by the panel's
     * region-picker + (x, y) input. Returns { ok: false, reason }
     * for invalid args or while the sphere queue is active;
     * otherwise stores the target and returns { ok: true }.
     *
     * If the target region matches the current region, the tile
     * walkTo is published immediately and the visualizer takes over.
     * If different, the target is held as `_pendingManualTarget`
     * and routed through one exit per region transition (mirroring
     * walkToLocation's cross-region logic), retrying on each
     * onRegionMove until the destination region is reached.
     *
     * Tile reachability inside a region is left to the visualizer
     * (which knows tile-level geometry) — it surfaces a blocked-step
     * entry in its log if the tile can't be reached.
     */
    walkToTile(regionName, x, y) {
        if (!regionName || !Number.isFinite(x) || !Number.isFinite(y)) {
            return { ok: false, reason: 'invalid arguments' };
        }
        if (this._isActive) {
            return { ok: false, reason: 'sphere queue is active — stop or reset first' };
        }
        this._pendingManualTarget = { kind: 'tile', region: regionName, x, y };
        this._dispatchPendingManualTarget();
        return { ok: true };
    }

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
        // If this matches the pending manual target, the route is
        // complete — clear it.
        if (this._pendingManualTarget?.name === name) {
            this._pendingManualTarget = null;
        }
        if (this._isActive) this._publishNextWalkTo();
        this._render();
    }

    onRegionMove(data) {
        const target = data?.targetRegion;
        if (target) this._currentRegion = target;
        if (this._isActive) this._publishNextWalkTo();
        // Manual cross-region routes are progressed one exit at a
        // time; re-dispatch the pending target now that the bot is
        // in a new region (it'll either walk to the location or
        // route through the next exit).
        if (this._pendingManualTarget) this._dispatchPendingManualTarget();
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
    async _publishNextWalkTo() {
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
            this._dispatch('stop');
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
        // Flush any pending worker snapshot first — without this, the
        // bot can race ahead of the just-collected pickup, leaving the
        // newly-unlocked region marked 'unreachable' in the snapshot
        // and PathFinder unable to find a route through it.
        const flush = this._flushSnapshot();
        if (flush) await flush;
        // Re-check current region after the flush: an onRegionMove
        // may have fired while we were awaiting the worker round-trip
        // (visualizer crossed an exit on its own clock), and the
        // sphere's target region may now match — in which case we
        // should walk to the location, not call PathFinder with
        // (X, X) and treat its zero-length return as an error.
        if (head.regionName === this._currentRegion) {
            this._setStatus(`${sphereTag}walking to "${head.locationName}" ${progress}`);
            this._publishWalkTo({ kind: 'location', name: head.locationName });
            this._render();
            return;
        }
        const path = this._pathFinder?.findPathWithExits?.(this._currentRegion, head.regionName);
        if (!path || !Array.isArray(path.steps) || path.steps.length < 2) {
            this._setStatus(`error: no path from ${this._currentRegion} to ${head.regionName}`);
            this._isActive = false;
            this._lastPublishedTarget = null;
            this._dispatch('stop');
            this._render();
            return;
        }
        const nextExit = path.steps[1].exitUsed;
        if (!nextExit) {
            this._setStatus(`error: PathFinder returned a step without an exit (${this._currentRegion} → ${head.regionName})`);
            this._isActive = false;
            this._lastPublishedTarget = null;
            this._dispatch('stop');
            this._render();
            return;
        }
        this._setStatus(`${sphereTag}routing via "${nextExit}" → ${head.regionName} ${progress}`);
        this._publishWalkTo({ kind: 'exit', name: nextExit });
        this._render();
    }

    /**
     * Round-trip a ping through the stateManager worker so any pending
     * snapshotUpdated messages are applied to the proxy's uiCache
     * before the caller reads it. Returns null when no proxy is wired
     * so the caller can skip the await entirely — `await null` would
     * still defer to a microtask and break test bots that drive the
     * dispatcher handlers synchronously.
     */
    _flushSnapshot() {
        if (!this._stateManagerProxy?.pingWorker) return null;
        return this._stateManagerProxy
            .pingWorker('playbackBot:flush')
            .catch(() => { /* timeout / worker error — fall through */ });
    }

    _publishWalkTo(target) {
        // De-dupe identical consecutive walkTo: an event mid-leg can
        // re-enter _publishNextWalkTo without changing the head, and
        // re-issuing the same walkTo would just have the controller
        // re-plan to the same target. The signature includes the
        // current region because the same exit name (e.g. "exit_1")
        // appears in multiple regions — without the region prefix,
        // a same-named exit in a different region would be silently
        // skipped after a region transition, leaving the controller
        // with no target. For tile targets the sig must also include
        // (x,y) since `name` is undefined.
        const tail = target.kind === 'tile'
            ? `${target.x},${target.y}`
            : `${target.name}`;
        const sig = `${this._currentRegion}:${target.kind}:${tail}`;
        if (sig === this._lastPublishedTarget) return;
        this._lastPublishedTarget = sig;
        this._dispatch('walkTo', [target]);
        // Make sure the controller's clock is ticking. The sphere
        // queue's play() pattern is "set target, then start clock";
        // manual walkTos (intercept, manual input, cross-region
        // routing) need the same kick so the controller actually
        // executes the plan instead of sitting on a target with a
        // stopped clock.
        this._dispatch('play', [this._rate]);
    }

    /**
     * Resolve the active substrate's PlaybackController and invoke
     * `method(...args)` on it. Silent no-op when no controller is
     * available (e.g. no panel mounted yet, no current region known).
     */
    _dispatch(method, args = []) {
        const controller = this._resolveController();
        if (!controller) return;
        const fn = controller[method];
        if (typeof fn !== 'function') return;
        fn.apply(controller, args);
    }

    /**
     * Find the PlaybackController for the active substrate. If a
     * `getActiveController` resolver was injected, use it. Otherwise
     * default to looking up `_currentRegion`'s substrate via the
     * loaded rules.json's preset_sidecars and asking
     * substrateRegistry. Non-procgen presets (no preset_sidecars)
     * fall back to the maze substrate, preserving the bot's
     * pre-mixed-substrate behaviour.
     */
    _resolveController() {
        if (this._getActiveController) return this._getActiveController() ?? null;
        let substrateId = 'maze';
        const rulesJson = this._getRulesJson?.() ?? null;
        if (rulesJson && this._currentRegion) {
            const sidecars = rulesJson.preset_sidecars?.['1'];
            const sidecar = sidecars?.[this._currentRegion];
            if (sidecar?.substrate) substrateId = sidecar.substrate;
        }
        const entry = substrateRegistry.get(substrateId);
        return entry?.getPlaybackController?.() ?? null;
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

        // Phase 2 — click-intercept toggle. When on, real user clicks
        // on the Locations / Exits panels are routed to the bot's
        // pathfinder instead of being applied immediately. Setting
        // is consulted by the dispatcher receivers in
        // playbackBot/index.js via isInterceptEnabled().
        root.appendChild(this._mountInterceptToggle());

        // Phase 2 — current target line. Mirrors the bot's queue head
        // (or an active manual walkTo target) in plain text below the
        // status line, so the user can see at a glance what the bot
        // is heading toward.
        const targetEl = document.createElement('div');
        targetEl.className = 'playback-bot-target';
        root.appendChild(targetEl);
        this._targetEl = targetEl;

        // Phase 2 — manual walkTo input. Region picker + (x, y)
        // coords + Go button. Disabled while the sphere queue is
        // active (controlled in _render's enabled-toggle pass).
        root.appendChild(this._mountManualWalkTo());

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

        // Phase 2 — dispatcher event log. Append-only history of
        // user:locationCheck / user:exitClicked / user:regionMove
        // events the bot received, with disposition (intercepted /
        // propagated). Useful for verifying the intercept seam.
        const dispLogHeading = document.createElement('div');
        dispLogHeading.className = 'playback-bot-section-heading';
        dispLogHeading.textContent = 'Dispatcher events';
        root.appendChild(dispLogHeading);
        const dispLogEl = document.createElement('div');
        dispLogEl.className = 'playback-bot-dispatcher-log';
        root.appendChild(dispLogEl);
        this._dispLogEl = dispLogEl;

        const hint = document.createElement('div');
        hint.className = 'playback-bot-hint';
        hint.textContent = 'Drives the maze panel — open it in another column to watch the bot walk.';
        root.appendChild(hint);

        this._element = root;
        this._render();
    }

    _mountInterceptToggle() {
        const wrap = document.createElement('label');
        wrap.className = 'playback-bot-intercept';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = this._interceptEnabled;
        cb.addEventListener('change', () => this.setInterceptEnabled(cb.checked));
        wrap.appendChild(cb);
        const text = document.createElement('span');
        text.textContent = ' Route clicks to bot';
        wrap.appendChild(text);
        const sub = document.createElement('div');
        sub.className = 'playback-bot-intercept-sub';
        sub.textContent = 'When on, clicks on the Locations and Exits panels go to the bot instead of triggering immediately.';
        wrap.appendChild(sub);
        this._interceptCheckbox = cb;
        return wrap;
    }

    _mountManualWalkTo() {
        const wrap = document.createElement('div');
        wrap.className = 'playback-bot-manual-walkto';

        const heading = document.createElement('div');
        heading.className = 'playback-bot-section-heading';
        heading.textContent = 'Manual walk-to';
        wrap.appendChild(heading);

        const row = document.createElement('div');
        row.className = 'playback-bot-manual-walkto-row';

        const regionSelect = document.createElement('select');
        regionSelect.className = 'playback-bot-manual-walkto-region';
        wrap.appendChild(regionSelect); // attach to wrap so we can repopulate
        // remove from wrap, then put in row — simpler:
        wrap.removeChild(regionSelect);
        row.appendChild(regionSelect);

        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.className = 'playback-bot-manual-walkto-x';
        xInput.placeholder = 'x';
        xInput.min = '0';
        row.appendChild(xInput);

        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.className = 'playback-bot-manual-walkto-y';
        yInput.placeholder = 'y';
        yInput.min = '0';
        row.appendChild(yInput);

        const goBtn = document.createElement('button');
        goBtn.type = 'button';
        goBtn.className = 'playback-bot-manual-walkto-go';
        goBtn.textContent = 'Go';
        row.appendChild(goBtn);

        wrap.appendChild(row);

        const errEl = document.createElement('div');
        errEl.className = 'playback-bot-manual-walkto-error';
        wrap.appendChild(errEl);

        goBtn.addEventListener('click', () => {
            const region = regionSelect.value;
            const x = Number.parseInt(xInput.value, 10);
            const y = Number.parseInt(yInput.value, 10);
            const r = this.walkToTile(region, x, y);
            errEl.textContent = r.ok ? '' : r.reason;
        });

        this._manualWalkToEl = wrap;
        this._manualWalkToRegionSelect = regionSelect;
        this._manualWalkToXInput = xInput;
        this._manualWalkToYInput = yInput;
        this._manualWalkToGoBtn = goBtn;
        this._manualWalkToErrEl = errEl;
        return wrap;
    }

    _populateManualWalkToRegions() {
        if (!this._manualWalkToRegionSelect) return;
        const select = this._manualWalkToRegionSelect;
        const previous = select.value;
        const staticData = this._getStaticData?.();
        const regions = staticData?.regions;
        const names = [];
        if (regions && typeof regions.keys === 'function') {
            for (const name of regions.keys()) names.push(name);
        }
        names.sort((a, b) => a.localeCompare(b));
        // Only rebuild when the list of names changed — avoids
        // resetting the user's selection on every render. `select.options`
        // exists in real browsers; fall back to children for
        // headless test fakes that don't synthesise it.
        const optionList = select.options
            ? Array.from(select.options)
            : Array.from(select.children ?? []);
        const current = optionList.map((o) => o.value);
        const same = current.length === names.length && current.every((v, i) => v === names[i]);
        if (same) return;
        select.innerHTML = '';
        for (const name of names) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        }
        if (previous && names.includes(previous)) select.value = previous;
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

        // Phase 2 — current target line.
        if (this._targetEl) {
            const head = this.getCurrentHead();
            if (head) {
                this._targetEl.textContent = `Target: location "${head.locationName}" in ${head.regionName}`;
            } else if (this._lastPublishedTarget) {
                this._targetEl.textContent = `Target: ${this._lastPublishedTarget}`;
            } else {
                this._targetEl.textContent = 'Target: —';
            }
        }

        // Phase 2 — intercept toggle stays in sync with model state
        // (e.g., after setInterceptEnabled was called from outside).
        if (this._interceptCheckbox) {
            this._interceptCheckbox.checked = this._interceptEnabled;
        }

        // Phase 2 — manual walk-to: keep the region picker populated
        // from current static data, and disable the inputs when the
        // sphere queue is active.
        this._populateManualWalkToRegions();
        const manualDisabled = this._isActive;
        for (const el of [
            this._manualWalkToRegionSelect,
            this._manualWalkToXInput,
            this._manualWalkToYInput,
            this._manualWalkToGoBtn,
        ]) {
            if (el) el.disabled = manualDisabled;
        }
        if (this._manualWalkToErrEl && manualDisabled) {
            // Replace any prior error with the disabled-reason hint
            // so the user knows why the controls are inert.
            this._manualWalkToErrEl.textContent = '(disabled while sphere queue is active)';
        } else if (this._manualWalkToErrEl && this._manualWalkToErrEl.textContent === '(disabled while sphere queue is active)') {
            this._manualWalkToErrEl.textContent = '';
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

        // Phase 2 — dispatcher event log (separate from the bot's
        // internal status log). Same append-only pattern.
        if (this._dispLogEl) {
            const existing = this._dispLogEl.children.length;
            const total = this._dispatcherLog.length;
            if (existing > total) {
                this._dispLogEl.innerHTML = '';
                for (const entry of this._dispatcherLog) {
                    this._dispLogEl.appendChild(this._renderDispatcherLogEntry(entry));
                }
            } else {
                for (let i = existing; i < total; i += 1) {
                    this._dispLogEl.appendChild(this._renderDispatcherLogEntry(this._dispatcherLog[i]));
                }
            }
            this._dispLogEl.scrollTop = this._dispLogEl.scrollHeight;
        }
    }

    _renderDispatcherLogEntry(entry) {
        const row = document.createElement('div');
        row.className = `playback-bot-dispatcher-log-entry playback-bot-dispatcher-log-${entry.disposition}`;
        const time = new Date(entry.timestamp).toLocaleTimeString();
        row.textContent = `[${time}] ${entry.eventName} "${entry.target}" (${entry.disposition})`;
        return row;
    }
}

function loadInterceptFromLS() {
    if (typeof localStorage === 'undefined') return false;
    try {
        return localStorage.getItem(LS_INTERCEPT_KEY) === 'true';
    } catch (_e) {
        return false;
    }
}

function saveInterceptToLS(enabled) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(LS_INTERCEPT_KEY, enabled ? 'true' : 'false');
    } catch (_e) {
        // ignore (private browsing, quota, etc.)
    }
}
