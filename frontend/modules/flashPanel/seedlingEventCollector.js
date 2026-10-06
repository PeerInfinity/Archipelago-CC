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
 * Effects (the glue applies them): `{type: 'eventCollect', location, eventId, level, tag, at: 'live'|'load'}`. The
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
        this.stats = { reports: 0, restores: 0, other: 0, live: 0, load: 0, repeats: 0, armingWindow: 0, loadReads: 0 };
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

    /** The panel rebuilt its adapter: a new game, so what this one collected is re-read from it. */
    onGameRestart() {
        this.collected.clear();
    }
}
