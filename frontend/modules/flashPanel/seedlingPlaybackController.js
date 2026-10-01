/**
 * ⛓⛓ **THE PLAYBACK BOT'S CONTROLLER FOR GENERATED SEEDLING ROOMS** (Seedling
 * JS runtime J2; plan `NewDocs/plans/seedling-js-substrate-plan.md`).
 *
 * The registry entry `flash_seedling_gen` returns this from
 * `getPlaybackController()`. It is a HOST-SIDE object that answers the
 * contract (`docs/json/developer/procgen/substrate-registry.md#playback`) and
 * walks nothing itself: the walk is the JS runtime page's own
 * (`seedlingDemo/jsRuntimeWalker.js`, asked once per tick INSIDE the page's
 * clock — no second clock), reached through the page's same-origin handle
 * `window.__seedlingJsRuntime.playback`.
 *
 * ── ⛓ WHY A DIRECT HANDLE AND NOT AN EVENT-BUS PROXY (W0 decision) ───────
 *
 * Bounce's controller is a `PlaybackProxy`: fire-and-forget over the event
 * bus, so `walkTo` returns nothing. This one must be able to say NO
 * synchronously — the bot turns `walkTo(...) === false` into a terminal, named
 * status (`playbackBotUI._publishWalkTo`), and a Seedling region under the wasm
 * runtime, or an AP name the generated rooms do not hold, must reach that
 * status rather than a silent wait. The flash panel's iframe is same-origin
 * and `WasmBridgeAdapter` already calls into its window synchronously, so the
 * controller does the same. ⛔ Nothing here imports the model: the panel's
 * static import closure is unchanged (the model is the PAGE's closure).
 *
 * ── WHAT `walkTo` ANSWERS ───────────────────────────────────────────────
 *
 *   false  + `lastRefusal`  the panel runs another runtime (wasm / flash):
 *                           only the JS runtime has feet; the name is not a
 *                           location / exit of the generated rooms; the page
 *                           refused the resolved goal.
 *   true                    accepted — handed to the page, or HELD until the
 *                           page and the generated arm's report are up (the
 *                           bot's first walkTo can outrun both). A held goal
 *                           is retried on a timer.
 *
 * ⛔ AN ACCEPTED GOAL THAT FAILS LATER IS NOT SILENT EITHER: a held goal whose
 * panel comes up on another runtime, one never handed over within
 * `PENDING_GIVE_UP_MS`, and a live walk the page gives up on
 * (`jsRuntimeWalker`'s FAILED) all go out through `onWalkFailed` — which
 * `flashPanel/index.js` publishes as `playback:walkFailed`, the bot's terminal
 * named status (`PlaybackBotUI.onWalkFailed`).
 *
 * Name → cell maps come from the generated arm's assembly REPORT
 * (`assembleGeneratedSeedlingSet(...).report`: `apitems` and `doors`), which
 * the panel keeps from its load. Exit names arrive in either spelling the
 * graph uses — bare `exit_0` or `{regionId}__{exitName}` — as
 * `flashSubstrate/bridge.js` `_translateWalkTo` accepts them; a bare name is
 * read against the room the player is IN (the live level), the one fact that
 * cannot lag a region move.
 *
 * `play`/`stop`/`step`/`reset` pass through to the page's walker; `instant` is
 * `play` (the game has one 30 tick/s clock, and a burst of ticks off it would
 * be a second one); `setRate` is a no-op (bounce's answer: no scriptable clock).
 */

/** The substrate this controller walks. */
export const SEEDLING_PLAYBACK_SUBSTRATE = 'flash_seedling_gen';
/** How often a held goal is retried, and when one is given up on (logged). */
export const PENDING_RETRY_MS = 250;
export const PENDING_GIVE_UP_MS = 60000;

/**
 * Map an AP-vocabulary target to a goal in the generated set's own terms.
 *
 * @param {{kind:string, name?:string, x?:number, y?:number}} target
 * @param {{apitems:Array, doors:Array}} report  the assembly report
 * @param {{liveLevel?:number|null, region?:string|null}} [where]
 * @returns {{goal:object}|{refused:string}}
 */
export function resolveSeedlingGoal(target, report, { liveLevel = null, region = null } = {}) {
    const name = target?.name;
    if (target?.kind === 'location') {
        const a = (report?.apitems ?? []).find((x) => x.location === name);
        if (!a) return { refused: `"${name}" is not an AP location of the generated Seedling rooms` };
        return { goal: { kind: 'location', level: a.room, tag: a.tag, name } };
    }
    if (target?.kind === 'exit') {
        const doors = report?.doors ?? [];
        const door = doors.find((d) => name === `${d.region}__${d.exitName}` || name === `${d.region}__${d.exit_id}`)
            ?? (Number.isInteger(liveLevel) ? doors.find((d) => d.room === liveLevel
                && (d.exitName === name || d.exit_id === name)) : null)
            ?? (region ? doors.find((d) => d.region === region && (d.exitName === name || d.exit_id === name)) : null);
        if (!door) {
            return { refused: `"${name}" is not an exit of ${Number.isInteger(liveLevel)
                ? `the generated room the player is in (level ${liveLevel})` : 'the generated Seedling rooms'}` };
        }
        return { goal: { kind: 'exit', level: door.room, tile: [door.cell.tx, door.cell.ty], name } };
    }
    if (target?.kind === 'tile') {
        if (!Number.isInteger(liveLevel)) return { refused: 'a tile target needs the player in a generated room' };
        return { goal: { kind: 'tile', level: liveLevel, tile: [target.x, target.y] } };
    }
    return { refused: `not a walk target: ${JSON.stringify(target)}` };
}

/** The refusal for a panel that is not running the JS runtime. */
export function notJsRuntimeRefusal(transport, setting) {
    return `${SEEDLING_PLAYBACK_SUBSTRATE} regions are walked only on the Seedling JS runtime — the Flash Panel `
        + `is running the ${transport ?? 'unknown'} runtime (setting '${setting ?? 'auto'}'); set Flash Panel → `
        + "Runtime to 'js' to let the Playback Bot walk generated rooms";
}

export class SeedlingPlaybackController {
    /**
     * @param {object} deps
     * @param {() => object|null} deps.getSurface  the panel's
     *   `seedlingPlaybackSurface()` — `{transport, setting, report, jsRuntime}`
     *   — or null when no panel is mounted
     * @param {(msg:string, level?:string) => void} [deps.log]
     * @param {(e:{substrate:string, target:object, reason:string}) => void} [deps.onWalkFailed]
     * @param {object} [deps.timers] `{setInterval, clearInterval}` (tests)
     * @param {() => number} [deps.now]
     */
    constructor({
        getSurface, log = () => {}, onWalkFailed = () => {}, now = () => Date.now(),
        timers = { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (h) => clearInterval(h) },
    } = {}) {
        this._getSurface = getSurface;
        this._log = log;
        this._onWalkFailed = onWalkFailed;
        this._now = now;
        this._watched = null;
        this._unwatch = null;
        this._lastTarget = null;
        this._timers = timers;
        this._pending = null;
        this._playing = false;
        this._retry = null;
        this.lastRefusal = null;
        this.lastGoal = null;
    }

    walkTo(target) {
        this.lastRefusal = null;
        const s = this._getSurface?.() ?? null;
        if (s && s.transport && s.transport !== 'js') return this._refuse(notJsRuntimeRefusal(s.transport, s.setting));
        const out = this._apply(target, s);
        if (out === 'pending') {
            this._hold(target);
            return true;
        }
        this._clearPending();
        return out;
    }

    play() { this._playing = true; this._page()?.play(); }
    stop() { this._playing = false; this._clearPending(); this._page()?.stop(); }
    step() { this._page()?.step(); }
    instant() { this.play(); }
    reset() { this._playing = false; this._clearPending(); this._page()?.reset(); }
    setRate() { /* the game's own 30 tick/s clock is the only clock */ }

    /** The page's walk state, for readouts and rows: `{state, reason, goal}` or null. */
    status() {
        const p = this._page();
        return p ? { state: p.state, reason: p.reason, goal: p.goal, pending: this._pending?.target ?? null } : null;
    }

    // ── internals ─────────────────────────────────────────────────────────

    _page(surface = this._getSurface?.()) {
        return surface?.transport === 'js' ? (surface.jsRuntime?.playback ?? null) : null;
    }

    _refuse(reason) {
        this.lastRefusal = reason;
        this._log(`[playback] walkTo refused — ${reason}`, 'warn');
        return false;
    }

    /** true / false (refused) / 'pending' (not resolvable YET). */
    _apply(target, s) {
        const page = this._page(s);
        if (!s || !s.transport || !page || !s.report) return 'pending';
        const liveLevel = s.jsRuntime?.run?.level ?? null;
        const r = resolveSeedlingGoal(target, s.report, { liveLevel, region: s.region ?? null });
        if (r.refused) return this._refuse(r.refused);
        const answer = page.walkTo(r.goal);
        if (!answer?.ok) return this._refuse(`the JS runtime refused ${JSON.stringify(r.goal)}: ${answer?.reason ?? 'no answer'}`);
        this.lastGoal = r.goal;
        this._lastTarget = target;
        this._watch(page);
        if (this._playing) page.play();
        return true;
    }

    /** Relay the page's FAILED walks (one subscription per page; a remount is a new page). */
    _watch(page) {
        if (this._watched === page) return;
        this._unwatch?.();
        this._watched = page;
        this._unwatch = typeof page.onWalk === 'function' ? page.onWalk((e) => {
            if (e?.state !== 'failed') return;
            this._fail(this._lastTarget, `the JS runtime's walk failed: ${e.message ?? page.reason ?? 'no reason given'}`);
        }) : null;
    }

    _fail(target, reason) {
        this.lastRefusal = reason;
        this._log(`[playback] ${reason}`, 'warn');
        try { this._onWalkFailed({ substrate: SEEDLING_PLAYBACK_SUBSTRATE, target, reason }); } catch { /* a listener's bug */ }
    }

    _hold(target) {
        this._pending = { target, since: this._now() };
        if (this._retry) return;
        this._retry = this._timers.setInterval(() => this._retryPending(), PENDING_RETRY_MS);
    }

    _retryPending() {
        if (!this._pending) { this._clearPending(); return; }
        const s = this._getSurface?.() ?? null;
        if (s && s.transport && s.transport !== 'js') {
            const { target } = this._pending;
            this._clearPending();
            this._fail(target, notJsRuntimeRefusal(s.transport, s.setting));
            return;
        }
        const { target } = this._pending;
        const out = this._apply(target, s);
        if (out !== 'pending') {
            this._clearPending();
            if (out === false) this._fail(target, this.lastRefusal);
            return;
        }
        if (this._now() - this._pending.since > PENDING_GIVE_UP_MS) {
            this._clearPending();
            this._fail(target, `the walkTo was never handed to the JS runtime — no `
                + `${!s ? 'flash panel' : !s.report ? 'generated level set (the AP placement load)' : 'JS runtime page'} `
                + `within ${PENDING_GIVE_UP_MS / 1000} s`);
        }
    }

    _clearPending() {
        this._pending = null;
        if (this._retry) { this._timers.clearInterval(this._retry); this._retry = null; }
    }
}
