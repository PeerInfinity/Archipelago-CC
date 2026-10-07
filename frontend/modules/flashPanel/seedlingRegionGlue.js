/**
 * Host-side glue between procgen and the real Seedling game
 * (CC/docs/plans/region-atlas-plan.md, Phase 4 — projection 3).
 *
 * It subscribes `flashSeedling:loadRegion`, feeds the game's property reports
 * into `SeedlingRegionBinding` (the pure state machine — traps and rulings
 * documented there), and applies the effects it returns:
 *
 *   teleport   -> the flashPanel adapter's existing invocation queue, i.e. the
 *                 `teleport` recipe in games/seedling.json — one shipped
 *                 AP<->game translation, not a second one (ruling 2)
 *   regionMove -> `user:regionMove` on the dispatcher with
 *                 `initialTarget: 'bottom'`, the dialect every substrate bridge
 *                 uses; procgenPlayer receives it, loads the target region and
 *                 forwards up the chain so gameState follows
 *   warn       -> LOUD: console.warn AND the panel's own log
 *   bounce     -> (G4) a teleport home: a refused door's swap is REVERSED
 *   locked     -> (G4) a panel line + `flashSeedling:doorLocked` on the bus
 *
 * ⛓⛓ **LOGICAL LINKS** (§5.17): it also READS THE PLAYER'S POSITION (`botStatus`, every
 * `POSITION_POLL_MS`) while the binding `wantsPosition()` — a level with sub-regions — and no bot walk is in
 * flight (`isBotWalking`: the bot's route credits its links itself, `creditLogicalLink`). The first read
 * after a bot walk is a BASELINE (where the player stands, no move). A logical `regionMove` is the same
 * `user:regionMove`, carrying `logical: true`.
 *
 * ⛓⛓ **AND IT SUBSCRIBES `procgen:activeSubstrateChanged`** (EDITOR INTEGRATION
 * W6, H2; plan §11.1 A2 / §11.6 item 2). flashPanel is not procgen-only, so it
 * deliberately has no `SubstrateInactiveOverlay` and the game keeps running
 * while a maze region owns the player. That is fine for the PANEL and wrong for
 * the BINDING: without this, a still-live game's level change resolved a
 * crossing out of a region that was no longer current. The bounce bridge has
 * had the same guard since it shipped (`flashSubstrate/bridge.js:204-207`).
 *
 * ⛔ THE SUBSCRIPTION IS THE PANEL'S ONLY STAKE, AND IT IS NOT THE PANEL'S. The
 * park is a fact about what the binding may read, so it is wired here — the one
 * place that already holds the event bus and the binding — and `flashPanelUI`
 * is untouched.
 *
 * It lives here rather than in flashSubstrate because it drives flashPanel's
 * `WasmBridgeAdapter`. Note that flashSubstrate's in-iframe bridge DROPS
 * `arrivedFrom` today; this consumes it host-side instead, which is what makes
 * "arrive at the exit you came through" work at all.
 */

import { FLASH_SEEDLING_SUBSTRATE_ID } from './flashSeedlingLibrary.js';
import { FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
import { SeedlingRegionBinding } from './seedlingRegionBinding.js';
import { RESTARTED_EVENT, restartTargetOf } from '../menuPanel/menuPanelEngine.js';
import { SeedlingEventCollector } from './seedlingEventCollector.js';

/** procgenPlayer's own broadcast of "which substrate owns the player now". */
export const ACTIVE_SUBSTRATE_EVENT = 'procgen:activeSubstrateChanged';

/**
 * ⛓ The panel readout M1 owes the user: *"found X for Player Y"*, the instant
 * the check fires, off the host's own placement table rather than a round trip
 * to the server. Published on the module event bus so the panel can render it
 * without this file knowing what a panel is.
 */
export const AP_ITEM_FOUND_EVENT = 'flashSeedling:apItemFound';

/**
 * ⛓ SEEDLING GENERATED G4 — a door the HOST refused: `{sourceRegion, region,
 * exit, exitId, needs, message}`. Published on the module event bus beside the
 * panel line, so a readout can show it without this file knowing what a panel is.
 */
export const DOOR_LOCKED_EVENT = 'flashSeedling:doorLocked';

/**
 * ⛓ LOGICAL LINKS — how often the player's position is read on a level with sub-regions. A wasm
 * `botStatus` costs 14–16 ms of the page's main thread (measured at W1, `flash.md` § Wasm playback: "read
 * it once per arrival, never per frame"), so four reads a second are ~6 % of it, and only on a level with
 * sub-regions and no bot walk in flight. The JS runtime's read is a property access.
 */
export const POSITION_POLL_MS = 250;

/**
 * ⛓ LOOP-MODE RESTART — the loops' reset (`loopState._resetLoop` and every caller: the Loops panel's Restart, the Menu
 * panel's Restart in loop mode, an out-of-mana reset). It refills mana and rewinds the queue; it moves nobody.
 */
export const LOOP_RESET_EVENT = 'loopState:loopReset';

/** The `source` of the move the loop-reset fallback publishes (`handleLoopReset`). */
export const LOOP_RESET_MOVE_SOURCE = 'flashSeedling-loopReset';

export class SeedlingRegionGlue {
    /**
     * @param {object} deps
     * @param {object} deps.eventBus         module event bus (subscribe/unsubscribe)
     * @param {function} deps.getDispatcher  resolves the module dispatcher lazily
     * @param {string} deps.loadRegionEvent  the substrate's loadRegion event name
     * @param {string|string[]} [deps.substrateId]  which substrate id(s) are OURS;
     *   defaults to BOTH entries that play in this panel (`flash_seedling` and,
     *   seedling generated G1, `flash_seedling_gen` — one load event, one glue),
     *   their registry constants, never a literal spelled here
     * @param {function} [deps.getPanel]     resolves the active flashPanel instance
     * @param {function} [deps.now]          injectable clock (tests)
     * @param {function} [deps.canPass]      G4 — the door predicate
     *   (`seedlingDoorGate.createDoorGate` over the state manager); absent =
     *   every door passes, today's behaviour
     */
    constructor({ eventBus, getDispatcher, loadRegionEvent, substrateId, getPanel, now, canPass, isBotWalking,
        timers, getProcgen, stopBotWalks, getEvents, collectEvent, getLoop } = {}) {
        this.eventBus = eventBus ?? null;
        this.getDispatcher = getDispatcher ?? (() => null);
        this.loadRegionEvent = loadRegionEvent;
        const ours = substrateId ?? [FLASH_SEEDLING_SUBSTRATE_ID, FLASH_SEEDLING_GEN_SUBSTRATE_ID];
        this.substrateIds = new Set(Array.isArray(ours) ? ours : [ours]);
        this.getPanel = getPanel ?? (() => null);
        this.binding = new SeedlingRegionBinding({ now, canPass });
        this.adapter = null;
        this.delivery = null;
        /** H6 — the AP check binding. Set from outside, like the delivery. */
        this.checkBinding = null;
        /**
         * ⛓ OBSTACLE EVENTS — the runtime collector (`seedlingEventCollector.js`): a game-state event is collected when
         * the GAME's persistence flag turns set (live: a `pendingCheck` clear; at load: `botStatus.persistence_cleared`).
         * `getEvents()` = the slot's game-state events; `collectEvent(location)` = a LOCAL event check (never a server
         * check: the location has no id). Absent = no collector (today's behaviour).
         */
        this.collectEvent = typeof collectEvent === 'function' ? collectEvent : null;
        this.eventCollector = typeof getEvents === 'function' && this.collectEvent
            ? new SeedlingEventCollector({ getEvents, insideHostStart: (seq) => this.checkBinding?.insideHostStart?.(seq) ?? false })
            : null;
        /** Whether this adapter's game has had its load-time read (`syncEventsFromGame`). */
        this._eventsSynced = false;
        this._unsubs = [];
        this._handler = (payload) => this.handleLoadRegion(payload);
        this._activeHandler = (payload) => this.handleActiveSubstrateChanged(payload);
        this._restartHandler = (payload) => this.handleMenuRestart(payload);
        this._loopResetHandler = (payload) => this.handleLoopReset(payload);
        /**
         * ⛓ LOOP-MODE RESTART — `{isLoopModeActive, getCurrentRegion, getStartRegions, getActionQueue}`, resolved at
         * CALL time (gameState's and loops' public functions). Absent = the fallback never fires.
         */
        this.getLoop = getLoop ?? (() => null);
        this.lastLoopReset = null;
        /**
         * ⛓ RESTART — procgenPlayer's public functions (`getResolvedStartRegion`, `getRegionInfo`,
         * `retakeStartHop`), resolved at CALL time; and the Playback Bot controllers' stop.
         */
        this.getProcgen = getProcgen ?? (() => null);
        this.stopBotWalks = stopBotWalks ?? (() => 0);
        this.lastRestart = null;
        // Diagnostics — the verify script reads these rather than inferring
        // behaviour from console text.
        this.stats = { loads: 0, teleports: 0, regionMoves: 0, warnings: 0, parks: 0,
            resumes: 0, setDeliveries: 0, locationChecks: 0, itemsFound: 0, doorsLocked: 0, bounces: 0,
            logicalMoves: 0, positionReads: 0, restarts: 0, eventsCollected: 0, loopResets: 0 };
        /** ⛓ LOGICAL LINKS — is a Playback Bot walk in flight (its route credits its own links)? */
        this.isBotWalking = isBotWalking ?? (() => false);
        this._timers = timers ?? { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (h) => clearInterval(h) };
        this._positionTimer = null;
        /** The next position read is a BASELINE (set while a bot walk is in flight). */
        this._baselineNext = false;
        /** ⛓ §5.19 — why no position is read now (the randomized load's mount + reset window), or null. */
        this._positionHold = null;
    }

    /**
     * ⛓ §5.19 — THE RESET WINDOW. While the randomized load mounts the set and resets the player
     * (`seedlingRandomizerWiring.runSeedlingRandomizerLoad`), the player stands at TRANSIENT positions: the
     * page's pre-reset boot (`Main.as:51`), the mount, then the explicit start. A logical move credited off
     * one of them is a move nobody made (the reset sends no swap the binding marks, so `wantsPosition` cannot
     * see the window). No position is read while held.
     */
    holdPositionWatch(why) {
        this._positionHold = why || 'held';
    }

    /**
     * ⛓ §5.19 — the reset LANDED (or the load ended): the edge is RE-ARMED (`binding.rearmPosition`), so the
     * first read after it is judged where the player now stands — a human the reset put in another sub-region
     * than the AP region is moved there, through the gate, exactly as a step would.
     */
    releasePositionWatch() {
        if (!this._positionHold) return;
        this._positionHold = null;
        this.binding.rearmPosition();
    }

    /** ⛓ LOGICAL LINKS — the sub-region map (`seedlingSubRegions.buildSubRegionMap`), or null. */
    setSubRegions(map) {
        this.binding.setSubRegions(map);
        this._baselineNext = false;
        return this;
    }

    /**
     * ⛓ LOGICAL LINKS — the Playback Bot's route names a link: the binding credits it, and the move is
     * PUBLISHED on the next turn (the bot's `walkTo` is still on the stack, and the move re-enters the bot).
     * `{ok}` or `{ok: false, reason}`.
     */
    creditLogicalLink(name) {
        const r = this.binding.creditLink(name);
        if (!r.ok) return r;
        Promise.resolve().then(() => this.apply(r.effects));
        return { ok: true };
    }

    /** One position read: the game's `botStatus` (live player), handed to the binding. */
    readPosition() {
        if (!this.adapter || !this.binding.wantsPosition()) return;
        if (this._positionHold) return;
        if (this.isBotWalking()) { this._baselineNext = true; return; }
        let st = null;
        try {
            const game = this.adapter._getFlash?.() ?? null;
            const raw = game?.botStatus?.();
            st = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { st = null; }
        if (!st || !Number.isInteger(st.level) || st.level < 0) return;
        this.stats.positionReads += 1;
        const baseline = this._baselineNext;
        this._baselineNext = false;
        this.apply(this.binding.onPlayerPosition({ level: st.level, x: Number(st.x), y: Number(st.y) }, { baseline }));
    }

    _startPositionWatch() {
        if (this._positionTimer) return;
        this._positionTimer = this._timers.setInterval(() => this.readPosition(), POSITION_POLL_MS);
    }

    _stopPositionWatch() {
        if (!this._positionTimer) return;
        this._timers.clearInterval(this._positionTimer);
        this._positionTimer = null;
    }

    start() {
        if (this._unsubs.length > 0 || !this.eventBus?.subscribe) return;
        /**
         * ⛔ BOTH SUBSCRIPTIONS OR NEITHER. A glue that heard `loadRegion` but
         * not the active-substrate broadcast is exactly the pre-W6 state, and it
         * is the one shape that reads as "wired" while doing the wrong thing.
         */
        this._unsubs.push(this._subscribe(this.loadRegionEvent, this._handler));
        this._unsubs.push(this._subscribe(ACTIVE_SUBSTRATE_EVENT, this._activeHandler));
        // ⛓ RESTART — the Menu panel's Restart (see handleMenuRestart).
        this._unsubs.push(this._subscribe(RESTARTED_EVENT, this._restartHandler));
        // ⛓ LOOP-MODE RESTART — the loops' reset (see handleLoopReset).
        this._unsubs.push(this._subscribe(LOOP_RESET_EVENT, this._loopResetHandler));
        this._startPositionWatch();
    }

    /** eventBus.subscribe returns an unsubscribe fn in some hosts and nothing
     *  in others; fall back to the explicit call. */
    _subscribe(event, handler) {
        const off = this.eventBus.subscribe(event, handler);
        return typeof off === 'function' ? off : () => this.eventBus.unsubscribe?.(event, handler);
    }

    stop() {
        for (const off of this._unsubs) off();
        this._unsubs = [];
        this._stopPositionWatch();
        this.detachAdapter();
    }

    /**
     * The panel built an adapter. Everything the binding knows about the game's
     * state came from the previous one, so restart its view — which also
     * re-arms the arrival teleport for the region we are already in.
     */
    attachAdapter(adapter) {
        if (!adapter || adapter === this.adapter) return;
        this.detachAdapter();
        this.adapter = adapter;
        adapter.onStateReport = (property, value) => {
            /**
             * ⛔ BOTH BINDINGS SEE EVERY REPORT, AND THE ADAPTER HAS ONE HOOK.
             * `onStateReport` is a single slot, so a second consumer that
             * assigned it would silently REPLACE the first. Fanning out here
             * keeps the two state machines pure and independent — neither
             * knows the other exists, and each ignores every property but its
             * own.
             */
            this.apply(this.binding.onStateReport(property, value));
            if (this.checkBinding) {
                this.apply(this.checkBinding.onStateReport(property, value));
            }
            // ⛓ OBSTACLE EVENTS — the third reader of the same reports (a cleared event flag).
            if (this.eventCollector) this.apply(this.eventCollector.onStateReport(property, value));
        };
        this._standDownAdapter();
        this.binding.onGameRestart();
        this.checkBinding?.onGameRestart();
        this.eventCollector?.onGameRestart();
        this._eventsSynced = false;
    }

    /**
     * ⛓ OBSTACLE EVENTS — THE LOAD-TIME READ: the game's cleared persistence slots as they stand
     * (`botStatus().persistence_cleared`, both runtimes), so a save where the rock is already broken collects its
     * event. One `botStatus` per adapter (wasm: 14–16 ms), at the first region load and again once an AP load has
     * bound its checks. Returns the effects applied, or null when the game gave no readout.
     */
    syncEventsFromGame() {
        if (!this.eventCollector || !this.adapter) return null;
        let st = null;
        try {
            const raw = this.adapter._getFlash?.()?.botStatus?.();
            st = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { st = null; }
        if (!Array.isArray(st?.persistence_cleared)) return null;
        this._eventsSynced = true;
        const effects = this.eventCollector.onLoad(st.persistence_cleared);
        this.apply(effects);
        return effects;
    }

    detachAdapter() {
        if (this.adapter && this.adapter.onStateReport) this.adapter.onStateReport = null;
        this.adapter = null;
    }

    /**
     * ⛓⛓ **H8 — THE AP LEVEL SET GOES IN BEFORE THE FIRST REGION LOAD**
     * (EDITOR INTEGRATION §17.1.4). A region load teleports the player into a
     * room; delivering the rewritten rooms afterwards would replace the room
     * under the player and hand them a different game than the one AP
     * generated. So the gate runs FIRST, and a delivery that refuses is LOUD.
     *
     * ⛔ THE DELIVERY IS SET FROM OUTSIDE, NEVER CONSTRUCTED HERE. It needs
     * `planLevelSetChunks`, and a static import of the level-set graph from
     * this file would add 794 KB of source to the shipped bundle (measured —
     * `seedlingLevelSetDelivery.js`'s header carries the four figures). The
     * glue owns the ORDERING and nothing else.
     */
    setDelivery(delivery) {
        this.delivery = delivery ?? null;
        return this;
    }

    /**
     * ⛓⛓ **H6 — THE CHECK BINDING**, set from outside for the same reason the
     * delivery is: it holds the PLACEMENT TABLE, and a static import of
     * `apPlacementRewriter.js` from this file would add 87 files / 4,868,066 B
     * to the shipped bundle. The glue owns the WIRING and nothing else.
     */
    setCheckBinding(checkBinding) {
        this.checkBinding = checkBinding ?? null;
        this._standDownAdapter();
        // ⛓ OBSTACLE EVENTS — an AP load just landed: read the game's cleared flags once more.
        this.syncEventsFromGame();
        return this;
    }

    /**
     * ⛔⛔ **RETIRING THE UNDO QUEUE, FOR THE COVERED LOCATIONS ONLY.**
     *
     * The adapter's property path answers a location by watching a `Main.*`
     * flag go true, then queues an UNDO that writes it back to false so AP's
     * own item can arrive clean (`flashBridgeAdapter.js:466-476`). With AP
     * placement in the room that path is not merely redundant, it is WRONG:
     * an `APItem` grants nothing, so the only writer of those flags is the
     * bridge itself, and an echo the suppression happens to miss would be read
     * as a player pickup — dispatching the location a second time and taking
     * the granted item straight back. The gate that catches it is *"the flag
     * flips EXACTLY ONCE"*.
     *
     * ⛓ IT IS A SET, NOT A DELETE, and the difference is the two ENCOUNTER
     * locations: `fire@L32` and `darksword@L12` are boss/special grants with no
     * pickup entity, are not rewritten, and MUST stay on the property path. So
     * the adapter is handed the names H6 owns and stands down on exactly those.
     * With no check binding the set is empty and the adapter behaves as it
     * always has.
     */
    _standDownAdapter() {
        this.adapter?.setHostOwnedLocations?.(
            this.checkBinding ? this.checkBinding.hostOwnedLocations() : new Set());
    }

    /**
     * ⛓⛓ **RESTART** (⚖ the user, 2026-10-05: *"We already have a menu panel with a button to return to
     * the start region. We might just need to listen for this and use the existing teleport tool"*).
     *
     * The Menu panel's Restart moves the AP player to the DECLARED start (`Menu`), which no substrate
     * owns, so this binding PARKS and the game — which keeps its own position — stays where the player
     * was. When the start region the load hops into is OURS (a Seedling room), the same hop is re-taken
     * (`procgenPlayer.retakeStartHop`, which refuses by name where the load would not have skipped the
     * menu): its region load is a `startHop` arrival, so the binding teleports to `seedlingStartSpawn`
     * through the ordinary arrival — the existing `adapter.teleport` / `new Game(level, x, y)` — exactly
     * where a new game starts. It is a WARP, not a new game: the game's persistence stays as it is.
     *
     * `{mode, target, from}` → the decision, kept on `lastRestart` for a gate.
     */
    handleMenuRestart(payload) {
        const decide = (taken, why, extra = {}) => {
            this.lastRestart = { taken, why, ...extra, at: Date.now() };
            if (why) this._log(`[region atlas] Restart: the Seedling player was NOT moved — ${why}`);
            return this.lastRestart;
        };
        if (payload?.mode !== 'world') return decide(false, `a ${payload?.mode ?? 'unknown'}-mode restart is not ours`);
        const procgen = this.getProcgen() ?? null;
        const start = procgen?.getResolvedStartRegion?.() ?? null;
        const substrate = start ? (procgen?.getRegionInfo?.(start)?.substrate ?? null) : null;
        if (!start || !this.substrateIds.has(substrate)) {
            // Not a defect: the start is a maze (or nothing procgen owns). The binding is parked at the
            // menu like any excursion, and re-entering a Seedling region teleports as always.
            this.lastRestart = { taken: false, why: null, start, substrate, at: Date.now() };
            return this.lastRestart;
        }
        // ⛓ A walk in flight is STOPPED before the warp: its tape belongs to the room it was solving. So is a wasm
        // engine still driving between goals: `stop()` releases a held room and lifts the mid-room delivery gate,
        // so nothing the gate held back waits on a room the player has left. The Playback Bot re-plans from the
        // start on the region move that follows.
        const stopped = this.stopBotWalks();
        const r = procgen?.retakeStartHop?.() ?? { taken: false, why: 'procgenPlayer has no retakeStartHop' };
        if (r.taken) this.stats.restarts += 1;
        // ⛓ WALK IDENTITY — the stop above released the room BEFORE the hop queued its teleport, so nothing pushed it:
        // the released room ran on until the adapter's 100 ms tick (measured: the start hop's arrival clock 0–1 tick
        // apart run to run). Pushed in this turn, as at every other site the room is let go (arrival jitter).
        const pushed = r.taken ? this.pushQueuedTeleports() : false;
        return decide(r.taken, r.taken ? null : r.why, { start, substrate, stoppedWalks: stopped, pushed });
    }

    /**
     * ⛓⛓ **LOOP-MODE RESTART — THE FALLBACK** (⚖ the user, 2026-10-06: *"The start region should always be menu, not a
     * Seedling region. But we can go ahead and set up code to handle the case where it is a Seedling region, if that
     * would be cheap and safe to implement."*).
     *
     * The loops' reset moves nobody: the REPLAY's first move does. With the declared start = `Menu` (every committed
     * preset) that move is `Menu` → the start region, the start hop, so its arrival already teleports to
     * `seedlingStartSpawn` — and this DECLINES (silently, `why: null`: nothing is wrong). Only when the declared start
     * is itself one of OUR rooms is there no such move: the queue's first action happens IN that room, wherever the
     * player stood. Then the player is moved there with the reset's own shape (`fromReset`, `updatePath: false`) and
     * `restart: true`, which procgenPlayer marks `startHop` on a warehoused start — so the arrival is the binding's
     * start-hop arrival (§5.25's path: `seedlingStartSpawn`, `new Game(level, x, y)`, persistence untouched).
     *
     * Declined BY NAME: loop mode off; a new-rules reset (`paused: true` — the load re-takes the start itself); the
     * player not in one of our regions (another substrate's reset is not ours to move); the queue's first move
     * entering the start room itself (it teleports there — a second warp would be a double teleport). Mana stays the
     * loops'. `{mana, paused?}` → the decision, kept on `lastLoopReset` for a gate.
     */
    handleLoopReset(payload) {
        const decide = (taken, why, extra = {}) => {
            this.lastLoopReset = { taken, why, ...extra, at: Date.now() };
            if (why) this._log(`[region atlas] loop reset: the Seedling player was NOT moved — ${why}`);
            return this.lastLoopReset;
        };
        const loop = this.getLoop() ?? null;
        if (payload?.paused === true) return decide(false, 'a new-rules reset (the load takes the start itself)');
        if (loop?.isLoopModeActive?.() !== true) return decide(false, 'loop mode is off');
        const procgen = this.getProcgen() ?? null;
        const start = restartTargetOf(loop.getStartRegions?.() ?? []);
        const substrate = start ? (procgen?.getRegionInfo?.(start)?.substrate ?? null) : null;
        if (!start || !this.substrateIds.has(substrate)) {
            // The hypothesis case (start = Menu): the replay's first move is the start hop, and its arrival teleports.
            this.lastLoopReset = { taken: false, why: null, start, substrate, at: Date.now() };
            return this.lastLoopReset;
        }
        const here = loop.getCurrentRegion?.() ?? null;
        const hereSubstrate = here ? (procgen?.getRegionInfo?.(here)?.substrate ?? null) : null;
        if (!this.substrateIds.has(hereSubstrate)) {
            return decide(false, `the player is in "${here}", not a Seedling region`, { start, substrate, here });
        }
        const first = (loop.getActionQueue?.() ?? [])[0] ?? null;
        if (first?.type === 'regionMove' && first.destinationRegion === start) {
            return decide(false, `the queue's first move enters "${start}" itself (its arrival teleports)`, { start, substrate, here });
        }
        const dispatcher = this.getDispatcher();
        if (!dispatcher?.publish) return decide(false, 'no dispatcher', { start, substrate, here });
        const stopped = this.stopBotWalks();
        dispatcher.publish('user:regionMove', {
            sourceRegion: here,
            targetRegion: start,
            exitName: null,
            fromReset: true,
            updatePath: false,
            restart: true,
            source: LOOP_RESET_MOVE_SOURCE,
        }, { initialTarget: 'bottom' });
        this.stats.loopResets += 1;
        return decide(true, null, { start, substrate, here, stoppedWalks: stopped });
    }

    /** ⛓ RESTART — the set a randomized load delivered; `seedlingStartSpawn` reads its `start`. */
    setStartSet(set) {
        this.binding.setStartSet(set);
        return this;
    }

    handleLoadRegion(payload) {
        this.stats.loads += 1;
        if (this.delivery) {
            const gate = this.delivery.gateLoadRegion();
            if (gate.sent) this.stats.setDeliveries += 1;
            if (!gate.proceed) {
                this._warn('[ap placement] the AP level set did NOT mount, so this region load '
                    + `would run on the vanilla rooms — ${gate.why}`);
                return;
            }
        }
        this.apply(this.binding.onLoadRegion(payload ?? {}));
        if (!this._eventsSynced) this.syncEventsFromGame();
    }

    /**
     * ⛓ `payload` is `{substrate, componentType, label, regionId}` or **null**
     * (procgenPlayer publishes null when nothing is active) — and null parks,
     * which is the correct reading of "no substrate owns the player".
     *
     * ⛔ Compared on the SUBSTRATE id, not on `componentType`: `flashPanel` is
     * the component type of every flash-family entry, so a bounce region in the
     * same panel would read as ours.
     */
    handleActiveSubstrateChanged(payload) {
        const mine = this.substrateIds.has(payload?.substrate);
        const was = this.binding.active;
        const effects = this.binding.setActive(mine);
        if (was !== this.binding.active) this.stats[mine ? 'resumes' : 'parks'] += 1;
        /**
         * ⛓ T2b F3 — A PARK RELEASES THE GAME'S HELD KEYS. The door that parks
         * us fires mid-hold, and the key's release goes to whatever takes the
         * page's focus next, never to the game. The panel also releases on the
         * game's blur; this is the substrate-level twin, for a park that does
         * not move focus.
         */
        if (was && !this.binding.active) {
            try { this.getPanel()?.releaseHeldKeys?.('the flash substrate parked'); } catch { /* the panel may be mid-teardown */ }
        }
        this.apply(effects);
    }

    /**
     * ⛓ W7 — THE GLUE QUERY the seedling wasm playback asks before it HOLDS an
     * arrival (`wasmPlayback.arrivalHoldBlocker` reads it): a hold blocks every
     * world swap, this glue's redirects included (W0 i.11). `marks` = the
     * binding's swaps in flight (or the park), `queued` = teleports waiting in
     * the adapter's invoke queue, `pushedOn` = the begin record a pushed
     * teleport was stamped with (`WasmBridgeAdapter.lastInvocationPush`), `pushes` =
     * how many teleports were pushed so far (a held room's guard: a push after
     * the hold is a swap the hold would block).
     * Read-only; a glue with no adapter answers an empty queue.
     */
    swapState() {
        const b = this.binding;
        const marks = [];
        if (!b.active) marks.push('parked');
        if (b.pendingArrival) marks.push(`arrival teleport to level ${b.pendingArrival.level}`);
        if (b.pendingBounce) marks.push(`bounce from level ${b.pendingBounce.level}`);
        if (b.pendingDeparture) marks.push(`external door to level ${b.pendingDeparture.level}`);
        const queued = (this.adapter?.invokeQueue ?? []).filter((i) => i?.invocation).length;
        return { marks, queued, pushedOn: this.adapter?.lastInvocationPush?.begin ?? null,
            pushes: this.adapter?.invocationPushes ?? 0 };
    }

    /** ⛓ ARRIVAL JITTER — push the adapter's queued teleport(s) now (`WasmBridgeAdapter.pushNow`); false = none went. */
    pushQueuedTeleports() {
        return this.adapter?.pushNow?.() ?? false;
    }

    apply(effects) {
        for (const effect of effects ?? []) {
            switch (effect.type) {
                case 'teleport': this._teleport(effect); break;
                case 'regionMove': this._regionMove(effect); break;
                case 'locationCheck': this._locationCheck(effect); break;
                case 'apItemFound': this._itemFound(effect); break;
                case 'eventCollect': this._eventCollect(effect); break;
                case 'locked': this._doorLocked(effect); break;
                case 'bounce': this._bounce(effect); break;
                case 'warn': this._warn(effect.message); break;
                default: this._log(effect.message);
            }
        }
    }

    _teleport({ level, x, y, region }) {
        if (!this.adapter?.teleport) {
            this._warn(`[region atlas] no flash adapter to teleport into "${region}" — `
                + 'is the Flash Panel open and the game started?');
            return;
        }
        this.adapter.teleport({ level, x, y });
        this.stats.teleports += 1;
        this._log(`[region atlas] arrival in "${region}": teleport to level ${level} (${x}, ${y})`);
    }

    /**
     * ⛓ G4 — the refused door's answer, as a teleport through the same recipe
     * an arrival uses. The binding sends it only once the game's own swap has
     * landed (the swap is swallowed), and marks its echo.
     */
    _bounce({ level, x, y, exit, region }) {
        if (!this.adapter?.teleport) {
            this._warn(`[door gate] no flash adapter to bounce the player back into "${region}" — `
                + 'is the Flash Panel open and the game started?');
            return;
        }
        this.adapter.teleport({ level, x, y });
        this.stats.bounces += 1;
        this._log(`[door gate] back into "${region}" at "${exit}"'s approach: teleport to level ${level} (${x}, ${y})`);
    }

    /** ⛓ G4 — the sentence the refused door says, on the panel and on the bus. */
    _doorLocked({ sourceRegion, region, exit, exitId, needs, message, fallback }) {
        this.stats.doorsLocked += 1;
        // ⛓ G6 — a rule read off the room's payload (static data had no such exit) says so.
        const line = `[door gate] ${message}${fallback ? ` (${fallback})` : ''}`;
        if (typeof console !== 'undefined') console.info(line);
        this._panelLog(line, 'warn');
        try {
            this.eventBus?.publish?.(DOOR_LOCKED_EVENT,
                { sourceRegion, region, exit, exitId, needs: [...(needs ?? [])], message });
        } catch { /* a bus that refuses an unknown event is not a gate failure */ }
    }

    _regionMove({ sourceRegion, targetRegion, exitName, fromLevel, toLevel, logical = false, why = null }) {
        const dispatcher = this.getDispatcher();
        if (!dispatcher?.publish) {
            this._warn('[region atlas] no dispatcher — the boundary crossing was detected but not published');
            return;
        }
        dispatcher.publish('user:regionMove', {
            sourceRegion,
            targetRegion,
            exitName,
            source: 'seedlingRegionGlue',
            // ⛓ LOGICAL LINKS — additive: a move inside one level, no door crossed.
            ...(logical ? { logical: true } : {}),
        }, { initialTarget: 'bottom' });
        this.stats.regionMoves += 1;
        if (logical) {
            this.stats.logicalMoves += 1;
            this._log(`[region atlas] level ${fromLevel}: logical link "${exitName}" -> region "${targetRegion}"`
                + `${why ? ` (${why})` : ''}`);
            return;
        }
        this._log(`[region atlas] level ${fromLevel} -> ${toLevel}: crossing "${exitName}" `
            + `-> region "${targetRegion}"`);
    }

    /**
     * ⛓ THE SAME EVENT AND THE SAME DIALECT the adapter's own location path
     * publishes (`flashBridgeAdapter._dispatchLocationCheck`) — one AP
     * vocabulary, not a second one for placements.
     */
    _locationCheck({ location, ledgerId }) {
        const dispatcher = this.getDispatcher();
        if (!dispatcher?.publish) {
            this._warn(`[ap placement] no dispatcher — the check for "${location}" was detected `
                + 'but not published');
            return;
        }
        dispatcher.publish('user:locationCheck', {
            locationName: location,
            originator: 'FlashPanel',
            originalDOMEvent: false,
        }, { initialTarget: 'bottom' });
        this.stats.locationChecks += 1;
        this._log(`[ap placement] checked "${location}" (${ledgerId})`);
    }

    /**
     * ⛓ OBSTACLE EVENTS — the game's flag for a game-state event is set: collect the event as a LOCAL event check
     * (`collectEvent`, the state manager's check with the location's event item) — never `user:locationCheck`, whose
     * connected path asks the server for an id this location does not have and drops it.
     */
    _eventCollect({ location, eventId, level, tag, at }) {
        try {
            const r = this.collectEvent?.(location);
            if (r && typeof r.catch === 'function') r.catch((e) => this._warn(`[obstacle event] collecting "${location}" failed — ${e?.message ?? e}`));
        } catch (e) {
            this._warn(`[obstacle event] collecting "${location}" failed — ${e?.message ?? e}`);
            return;
        }
        this.stats.eventsCollected += 1;
        this._log(`[obstacle event] the game's flag {${level},${tag}} is set (${at === 'load' ? 'at load' : 'live'}) — `
            + `collected "${location}" (${eventId ?? 'no event_id'})`);
    }

    /** *"found X for Player Y"* — the panel readout, off the placement table. */
    _itemFound({ location, item, player, forSelf }) {
        this.stats.itemsFound += 1;
        const who = forSelf ? 'you' : `Player ${player}`;
        const line = `[ap placement] found ${item} for ${who} at "${location}"`;
        this._log(line);
        try {
            this.eventBus?.publish?.(AP_ITEM_FOUND_EVENT,
                { location, item, player, forSelf, message: line });
        } catch { /* a bus that refuses an unknown event is not a check failure */ }
    }

    _warn(message) {
        this.stats.warnings += 1;
        // Loud on BOTH surfaces: the console is where a developer looks, the
        // panel log is where the person actually playing looks.
        if (typeof console !== 'undefined') console.warn(message);
        if (typeof window !== 'undefined' && window.logger?.warn) {
            window.logger.warn('flashPanelSeedlingGlue', message);
        }
        this._panelLog(message, 'error');
    }

    _log(message) {
        if (!message) return;
        this._panelLog(message);
    }

    _panelLog(message, cls) {
        try {
            this.getPanel()?._panelLog?.(message, cls);
        } catch { /* the panel may be mid-teardown */ }
    }
}
