/**
 * ⛓⛓ **OBSTACLE EVENTS — THE RUNTIME COLLECTOR** (rules `rules-obstacle-events`; ⚖ the user, 2026-10-05:
 * persisted obstacles are *"break before first use"*).
 *
 * The rules carry one GAME-STATE event per saved obstacle flag (`event_kind: 'game_state'`,
 * `seedlingObstacleEvents.js`): `L<level> flag <tag>: <class>@<x>,<y> cleared`, id-less, its item gating every door
 * whose landing is inside the obstacle. The state manager NEVER collects one on reach
 * (`stateManager/core/eventKinds.js`, fail-closed): the game's own flag does. This module is that collector, on
 * BOTH runtimes — it reads only what both already report:
 *
 *   LIVE     every persistence write the game makes is a `pendingCheck` report (`Game.setPersistence` on wasm;
 *            `jsRuntimeCore.reportClears` on the JS page), the same report `SeedlingCheckBinding` reads. A CLEAR of
 *            an event's `{level, tag}` collects that event, once.
 *   AT LOAD  `botStatus().persistence_cleared` — the game's cleared slots as they stand (a save where the rock is
 *            already broken). Every cleared event flag in it is collected.
 *
 * ⛔ THE FLAG, NEVER REACHABILITY. Nothing here reads the logic: an event whose region is reachable is not
 * collected until the game says its flag is set; a flag the game set is collected even where the logic did not
 * expect it (the game is the truth). ⛔ A RESTORE (the slot written back to "not cleared": `RockLock:73`,
 * `Lock.returnToNormal`) un-collects nothing — an AP event is monotonic — it is counted (`stats.restores`).
 * ⛔ A clear reported inside a host `botStart`'s arming window (⚖ W0-Q1, `SeedlingCheckBinding.ignoreHostStart`)
 * is a tape's DECLARATION, not the player's doing, and is not collected (`stats.armingWindow`): the declarations
 * are the game's live clears, which the load read collected already.
 *
 *   RECONCILE ⛓ EVENT GOALS — after every live clear, the same table re-read: a write the single report slot lost
 *            (two writes in one frame) is still the game's flag (`onReconcile`).
 *
 * Effects (the glue applies them): `{type: 'eventCollect', location, eventId, level, tag, at: 'live'|'load'|'reconcile'|'rederive'}`. The
 * glue sends each to the state manager as a LOCAL event check — never a server check (the location has no id).
 */

import { parsePendingCheck } from './seedlingCheckBinding.js';

export class SeedlingEventCollector {
    /**
     * @param {object} deps
     * @param {() => Array<{location: string, eventId: string|null, level: number, tag: number}>} deps.getEvents
     *   the slot's game-state events (`seedlingPlaybackController.runtimeEventsOf(rules, p).events`), read per call
     * @param {(seq: number) => boolean} [deps.insideHostStart]  the check binding's arming-window test
     */
    constructor({ getEvents, insideHostStart = () => false } = {}) {
        if (typeof getEvents !== 'function') throw new Error('SeedlingEventCollector: `getEvents` is required');
        this.getEvents = getEvents;
        this.insideHostStart = insideHostStart;
        /** Event locations this game has collected (a re-clear of one flag collects nothing). */
        this.collected = new Set();
        /**
         * ⛓ RE1 (reconnect) — the event locations the STATE MANAGER has shown as checked for this game and these rules
         * (`noteStateManagerChecked`, off its snapshots). Only ever added to, so a reset that empties the state
         * manager's checked set (the Connected reset, a rules reload) does not empty it: `onRederive` re-applies it.
         */
        this.smChecked = new Set();
        this.stats = { reports: 0, restores: 0, other: 0, live: 0, load: 0, repeats: 0, armingWindow: 0, loadReads: 0,
            reconcile: 0, reconcileReads: 0, rederive: 0, rederives: 0, forgets: 0 };
        /**
         * ⛓ EVENT GOALS — how many CLEARS the game reported outside a host start's arming window, of ANY slot (an event's
         * or not). The glue re-reads the game's cleared table after each one (`onReconcile`): see `onReconcile`.
         */
        this.liveClears = 0;
    }

    _eventAt(level, tag) {
        return (this.getEvents() ?? []).find((e) => e.level === level && e.tag === tag) ?? null;
    }

    _collect(ev, at) {
        if (this.collected.has(ev.location)) { this.stats.repeats += 1; return []; }
        this.collected.add(ev.location);
        this.stats[at] += 1;
        return [{ type: 'eventCollect', location: ev.location, eventId: ev.eventId ?? null, level: ev.level, tag: ev.tag, at }];
    }

    /** One BridgeGeneric property report (the glue fans every report out to it). */
    onStateReport(property, value) {
        if (property !== 'pendingCheck') return [];
        const report = parsePendingCheck(value);
        if (!report) return [];
        this.stats.reports += 1;
        if (report.cleared && !this.insideHostStart(report.seq)) this.liveClears += 1;
        const ev = this._eventAt(report.level, report.tag);
        if (!ev) { this.stats.other += 1; return []; }
        if (!report.cleared) { this.stats.restores += 1; return []; }
        if (this.insideHostStart(report.seq)) { this.stats.armingWindow += 1; return []; }
        return this._collect(ev, 'live');
    }

    /**
     * The game's cleared slots as they stand (`botStatus().persistence_cleared`, `[{level, tag}]`): every event
     * flag among them is collected. A readout with no such array is not a read (null = nothing known).
     */
    onLoad(cleared) {
        if (!Array.isArray(cleared)) return [];
        this.stats.loadReads += 1;
        const out = [];
        for (const c of cleared) {
            const ev = this._eventAt(Number(c?.level), Number(c?.tag));
            if (ev) out.push(...this._collect(ev, 'load'));
        }
        return out;
    }

    /**
     * ⛓ EVENT GOALS — ONE REPORT SLOT, TWO WRITES IN ONE FRAME. `pendingCheck` is a single string the host polls once
     * per frame, so when one update makes two persistence writes only the LAST is reported. `ButtonRoom` does exactly
     * that (`ButtonRoom.as`: `setPersistence(t, persist, room)` — another room's slot — then its own
     * `setPersistence(tag, !activate)`): L38's `buttonroom@32,48` clears `{39,8}` and is reported as `{38,4}` alone
     * (measured: the divergence sweep's leg 368, the flag in `persistence_cleared` and never collected live). So after
     * every live clear the glue re-reads the game's cleared table (`botStatus().persistence_cleared` — the GAME's flags,
     * as at load) and every event flag in it is collected. The arming window is honoured by the trigger: only a clear
     * outside it asks for a re-read (`liveClears`).
     */
    onReconcile(cleared) {
        if (!Array.isArray(cleared)) return [];
        this.stats.reconcileReads += 1;
        const out = [];
        for (const c of cleared) {
            const ev = this._eventAt(Number(c?.level), Number(c?.tag));
            if (ev && !this.collected.has(ev.location)) out.push(...this._collect(ev, 'reconcile'));
        }
        return out;
    }

    /**
     * ⛓ RE1 — the state manager's checked locations (a snapshot's `checkedLocations`, array or Set): every one that
     * is a game-state event of these rules joins `smChecked`. Nothing is ever removed here (see `smChecked`).
     */
    noteStateManagerChecked(checkedLocations) {
        if (!checkedLocations || typeof checkedLocations[Symbol.iterator] !== 'function') return;
        const events = this.getEvents() ?? [];
        if (events.length === 0) return;
        const checked = checkedLocations instanceof Set ? checkedLocations : new Set(checkedLocations);
        for (const ev of events) if (checked.has(ev.location)) this.smChecked.add(ev.location);
    }

    /**
     * ⛓⛓ RE1 — RE-DERIVE AFTER A RESET (⚖ Robert 2026-11-14, "Yes, do RE1"; design-reconnect-events.md §5).
     * The Connected reset (or a rules reload that re-mounted nothing) empties the state manager's checked set while
     * the game keeps its flags. Re-applied: the UNION of
     *   - the game's flags as they stand (`botStatus().persistence_cleared`; null = no readout, flags skipped),
     *   - what this collector collected (`collected`), and
     *   - what the state manager had checked (`smChecked`).
     * The union is what keeps a RE-CLOSED lock counted (⚖ Robert's Q4: an AP event is monotonic). It is also why
     * the runtimes agree: wasm and Flash report the LIVE flag (a re-closed lock reads un-cleared), the JS runtime's
     * `persistence_cleared` only ever grows (it over-reports a re-closed lock); the two records cover the gap.
     * ⛔ The memo is NOT a dedupe here: every event in the union is emitted, and the state manager dedupes (a
     * location it already has is `already_checked`, no item added). A memo that outlived the reset is exactly what
     * blocked the re-collect before RE1.
     */
    onRederive(cleared) {
        this.stats.rederives += 1;
        const flagged = new Set();
        if (Array.isArray(cleared)) {
            for (const c of cleared) {
                const ev = this._eventAt(Number(c?.level), Number(c?.tag));
                if (ev) flagged.add(ev.location);
            }
        }
        const out = [];
        for (const ev of this.getEvents() ?? []) {
            if (!flagged.has(ev.location) && !this.collected.has(ev.location) && !this.smChecked.has(ev.location)) continue;
            this.collected.add(ev.location);
            this.stats.rederive += 1;
            out.push({ type: 'eventCollect', location: ev.location, eventId: ev.eventId ?? null, level: ev.level, tag: ev.tag, at: 'rederive' });
        }
        return out;
    }

    /**
     * ⛓ RE1 — the loaded RULES changed identity (another document or slot over the same rooms, js-18's review):
     * what the old rules' state manager checked, and what was collected under them, must not be carried into the
     * new rules. Only the game's flags are trusted from here on.
     */
    forgetRecords() {
        this.stats.forgets += 1;
        this.collected.clear();
        this.smChecked.clear();
    }

    /** The panel rebuilt its adapter: a new game, so what this one collected is re-read from it. */
    onGameRestart() {
        this.collected.clear();
        this.smChecked.clear();
    }
}
