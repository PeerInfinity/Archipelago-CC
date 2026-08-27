/**
 * The region-atlas play-time state machine (CC/docs/plans/region-atlas-plan.md,
 * Phase 4 — projection 3, host side).
 *
 * Pure: no DOM, no eventBus, no adapter. It takes two kinds of input — a
 * procgen region load, and the game's own property reports — and returns a list
 * of EFFECTS for the glue to apply. That split is what makes the two traps
 * below testable without booting a 31 MB wasm game.
 *
 * ## Level-granular v1 (ruling 1, 2026-07-27)
 *
 * A physical atlas region binds to a WHOLE Seedling level. A boundary crossing
 * is therefore the game's own level change (`Main.level`), disambiguated by the
 * reported spawn coordinates when two exits of one region reach the same level.
 * Sub-level physical boundaries — live player x/y against a marked tile line —
 * are deferred: they would need BridgeGeneric changes, re-injection and a wasm
 * rebuild. Logical sub-regions are unaffected: they carry rules, they are not
 * physically triggered, so every sub-region of a region shares its level.
 *
 * ## Trap 1 — the teleport echo
 *
 * The arrival teleport (`new Game(level, x, y)`) changes `Main.level`, and that
 * report is INDISTINGUISHABLE from the player walking through a door. Left
 * unsuppressed it resolves to an exit, publishes a region move, which loads a
 * region, which teleports… — the player ping-pongs forever. So an arrival is
 * marked in flight, the matching report is swallowed, and the mark clears on
 * match or on timeout. Same discipline as omsi's `_applyingHostReset`.
 *
 * A teleport to the level the game is ALREADY on arms nothing: there is no
 * level change to echo, and arming would swallow the player's next real
 * crossing.
 *
 * ## Trap 2 — the first-read baseline
 *
 * BridgeGeneric reports the whole declared property set once at boot. The first
 * `level` report is therefore the game telling us where it already is, not a
 * crossing. (The adapter's own first-read suppression is for AP location
 * mapping and fires below this consumer, so it cannot be borrowed.) That first
 * report doubles as the "the game is alive and reporting" signal, which is when
 * a deferred initial arrival teleport is released.
 *
 * ## Unmapped levels
 *
 * The atlas covers 3 of Seedling's 116 levels, and that is by design — it grows
 * region by region. A level change to somewhere the current region has no exit
 * to therefore WARNS LOUDLY and does not move the AP region. Silently no-oping
 * would read as a complete map; crashing would make a partial atlas unusable.
 *
 * ## The PARK — another substrate owns the region (EDITOR INTEGRATION W6, H2)
 *
 * ⛔ flashPanel is NOT procgen-only, so it has deliberately never had a
 * `SubstrateInactiveOverlay` (`flash.md`) — the game keeps running while a maze
 * region is the active one. MEASURED at W5: `flashPanel/` contained ZERO
 * occurrences of `procgen:activeSubstrateChanged`, and the consequence is
 * concrete: `this.region` is only rewritten by `flashSeedling:loadRegion`, which
 * a MAZE region never publishes, so the binding retained the STALE Seedling
 * region and any further level change in the still-live panel resolved a
 * crossing OUT OF A REGION THAT IS NO LONGER CURRENT.
 *
 * The bounce bridge has had exactly this guard since it shipped
 * (`flashSubstrate/bridge.js:204-207`). This is its twin, and it lives HERE
 * rather than in the panel because parking is a fact about the BINDING's
 * subject — the panel is still visible, still running, still the flash panel;
 * what stops is our reading of its reports as AP movement.
 *
 * While parked: every property report is dropped (no crossing, no warn, no echo
 * armed, no remembered position), and an arrival that lands meanwhile is QUEUED
 * on the same `pendingSpawn` slot the not-yet-booted case uses. Un-parking
 * releases it ONCE. Un-parking with nothing queued does nothing at all.
 */

/** How long an in-flight arrival teleport stays armed before it is written off. */
export const ARRIVAL_ECHO_TIMEOUT_MS = 15000;

/** Exits come off the warehouse as a Map (keyed by AP exit name); tests hand arrays. */
export function exitList(world) {
    const exits = world?.exits;
    if (exits instanceof Map) return [...exits.values()];
    return Array.isArray(exits) ? exits : [];
}

/**
 * Where an arrival lands: the entrance spawn of the exit the player came out
 * of, in the arriving region's own level.
 *
 * `arrivedFrom.exit_id` is resolved by procgenPlayer from the SOURCE exit's
 * `targetExitId`, so it names an exit of THIS region. With no arrivedFrom (the
 * synthesized initial Menu -> start-region hop) there is no "came from", and we
 * use the region's FIRST declared exit — documented, deterministic, and inside
 * the region by construction. (`region_coords` in games/seedling.json was the
 * alternative; it is keyed by display names that atlas region ids do not match,
 * and it is engine binding for the manual teleport UI, not map truth.)
 */
export function resolveArrivalSpawn(world, arrivedFrom) {
    const exits = exitList(world);
    if (exits.length === 0) return null;
    const wantedId = arrivedFrom?.exit_id ?? null;
    const byId = wantedId ? exits.find((e) => e.exit_id === wantedId) : null;
    const exit = byId ?? exits[0];
    const spawn = exit?.entrance_spawn;
    if (!spawn || !Number.isFinite(world?.level)) return null;
    return {
        level: world.level,
        x: spawn.x,
        y: spawn.y,
        exitId: exit.exit_id,
        matchedArrivedFrom: !!byId,
    };
}

const dist2 = (a, b) => {
    if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return Number.POSITIVE_INFINITY;
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
};

/**
 * Which exit of `world` a move to `level` went through.
 *
 * One candidate is the common case. Two exits of one region reaching the same
 * level (a room with two doors into the same corridor) are tie-broken on the
 * spawn coordinates the game reported alongside the level change — hence
 * `playerPositionX/Y` being declared BEFORE `level` in games/seedling.json, so
 * the coordinates are already in hand when the level report arrives.
 */
export function resolveCrossingExit(world, level, spawn) {
    const candidates = exitList(world).filter((e) => e.target_level === level);
    if (candidates.length <= 1) return candidates[0] ?? null;
    let best = candidates[0];
    let bestD = dist2(spawn, best.target_spawn);
    for (const e of candidates.slice(1)) {
        const d = dist2(spawn, e.target_spawn);
        if (d < bestD) { best = e; bestD = d; }
    }
    return best;
}

export class SeedlingRegionBinding {
    constructor({ now } = {}) {
        this._now = now ?? (() => Date.now());
        this.region = null;
        this.world = null;
        this.arrivedFrom = null;
        /**
         * ⛓ Is THIS substrate the one procgen currently has the player in?
         * Defaults to TRUE: a host that never tells us is the status quo this
         * binding shipped with, and a default of false would silently park a
         * single-substrate preset that publishes nothing we recognise.
         */
        this.active = true;
        // Trap 2: the boot report is baseline, not a crossing.
        this.baselineSeen = false;
        this.lastLevel = null;
        this.lastSpawn = { x: null, y: null };
        // Trap 1: our own arrival teleport, in flight.
        this.pendingArrival = null;
        // An arrival asked for before the game was reporting; released on baseline.
        this.pendingSpawn = null;
        this.warnedLevels = new Set();
    }

    /** procgen loaded a region into this substrate. */
    onLoadRegion({ region_id: regionId, world, arrivedFrom } = {}) {
        this.region = regionId ?? null;
        this.world = world ?? null;
        this.arrivedFrom = arrivedFrom ?? null;
        this.warnedLevels.clear();
        const spawn = resolveArrivalSpawn(this.world, this.arrivedFrom);
        if (!spawn) {
            return [{
                type: 'warn',
                message: `[region atlas] region "${this.region}" carries no arrival spawn `
                    + '(no wired exits, or no level) — the player was NOT teleported',
            }];
        }
        const effects = [];
        if (this.arrivedFrom?.exit_id && !spawn.matchedArrivedFrom) {
            // Not a defect, and deliberately not loud: it is what the
            // synthesized Menu -> start-region hop looks like (its exit is
            // `GameStart`, which no atlas region declares), and what any move
            // whose source region is outside the warehouse looks like. There is
            // no marked entrance to honour, so the region's first exit stands
            // in — the same rule as the no-arrivedFrom case.
            effects.push({
                type: 'info',
                message: `[region atlas] entered "${this.region}" through "${this.arrivedFrom.exit_id}", `
                    + `which is not one of its marked exits — spawning at "${spawn.exitId}"`,
            });
        }
        if (!this.active) {
            // ⛔ ANOTHER SUBSTRATE OWNS THE REGION. procgenPlayer publishes the
            // target's loadRegion BEFORE `procgen:activeSubstrateChanged`
            // (`procgenPlayer/index.js`), so the arrival for a RETURN to this
            // substrate legitimately lands here one event early. Queue it on the
            // same slot the not-yet-booted case uses; `setActive(true)` releases
            // it, and so does the baseline if the game has not booted yet.
            this.pendingSpawn = spawn;
            effects.push({
                type: 'info',
                message: `[region atlas] arrival in "${this.region}" queued — another substrate `
                    + 'is currently active',
            });
            return effects;
        }
        if (!this.baselineSeen) {
            // The game is not reporting yet (the wasm page waits on its own
            // ▶ Start user gesture, which can take minutes). Hold the arrival;
            // the baseline level report releases it.
            this.pendingSpawn = spawn;
            effects.push({
                type: 'info',
                message: `[region atlas] arrival in "${this.region}" queued until the game boots`,
            });
            return effects;
        }
        return effects.concat(this._beginArrival(spawn));
    }

    /**
     * The panel built a fresh adapter (first boot, or a preset switch / iframe
     * reload). Everything we know about the game's state came from the old one.
     */
    onGameRestart() {
        this.baselineSeen = false;
        this.lastLevel = null;
        this.lastSpawn = { x: null, y: null };
        this.pendingArrival = null;
        this.pendingSpawn = this.world ? resolveArrivalSpawn(this.world, this.arrivedFrom) : null;
    }

    /**
     * procgen moved the player into a region of ANOTHER substrate, or back into
     * one of ours. Returns EFFECTS like every other input; only a TRANSITION
     * does anything, so a host that re-publishes the same state is free.
     */
    setActive(active) {
        const next = !!active;
        if (next === this.active) return [];
        this.active = next;
        if (!next) {
            /**
             * ⛔ THE IN-FLIGHT ARRIVAL IS DROPPED, DELIBERATELY. Its echo mark
             * would otherwise sit armed through the whole excursion and swallow
             * the first REAL crossing after the return.
             */
            this.pendingArrival = null;
            return [{
                type: 'info',
                message: `[region atlas] another substrate now owns the region — "${this.region}" `
                    + 'is PARKED: the game keeps running, but its reports no longer move the AP region',
            }];
        }
        const effects = [{
            type: 'info',
            message: `[region atlas] this substrate is active again ("${this.region}")`,
        }];
        // ⛔ ONLY a queued arrival is released, and only ONCE — `pendingSpawn` is
        // cleared BEFORE `_beginArrival`, so a second `setActive(true)` (or a
        // baseline report arriving afterwards) has nothing left to fire.
        const spawn = this.pendingSpawn;
        if (!spawn || !this.baselineSeen) return effects;
        this.pendingSpawn = null;
        return effects.concat(this._beginArrival(spawn));
    }

    /** One BridgeGeneric property report, straight off the adapter. */
    onStateReport(property, value) {
        /**
         * ⛔⛔ THE PARK. The game is still running behind whatever substrate
         * owns the region now; nothing it reports is AP movement. Dropped
         * WHOLE — position included — so no stale coordinate survives the
         * excursion to tie-break the first crossing after the return.
         */
        if (!this.active) return [];
        if (property === 'playerPositionX') { this.lastSpawn.x = Number(value); return []; }
        if (property === 'playerPositionY') { this.lastSpawn.y = Number(value); return []; }
        if (property !== 'level') return [];
        const level = Number(value);

        if (!this.baselineSeen) {
            this.baselineSeen = true;
            this.lastLevel = level;
            const spawn = this.pendingSpawn;
            this.pendingSpawn = null;
            return spawn ? this._beginArrival(spawn) : [];
        }

        if (this.pendingArrival) {
            if (this.pendingArrival.level === level) {
                this.pendingArrival = null;
                this.lastLevel = level;
                return []; // our own teleport, swallowed
            }
            if (this._now() - this.pendingArrival.at <= ARRIVAL_ECHO_TIMEOUT_MS) {
                // The teleport has not landed yet; this report is pre-arrival
                // noise, not a player crossing.
                this.lastLevel = level;
                return [];
            }
            this.pendingArrival = null; // written off — treat this as real
        }

        if (level === this.lastLevel) return [];
        const fromLevel = this.lastLevel;
        this.lastLevel = level;
        return this._resolveCrossing(level, fromLevel);
    }

    _beginArrival(spawn) {
        // A teleport to the level the game is already on produces no level
        // change, so there is nothing to echo — arming here would swallow the
        // player's NEXT real crossing.
        if (this.baselineSeen && spawn.level !== this.lastLevel) {
            this.pendingArrival = { level: spawn.level, x: spawn.x, y: spawn.y, at: this._now() };
        }
        return [{ type: 'teleport', level: spawn.level, x: spawn.x, y: spawn.y, region: this.region }];
    }

    _resolveCrossing(level, fromLevel) {
        const exit = resolveCrossingExit(this.world, level, this.lastSpawn);
        if (!exit) {
            const first = !this.warnedLevels.has(level);
            this.warnedLevels.add(level);
            return [{
                type: 'warn',
                level,
                repeat: !first,
                message: `[region atlas] the game moved from level ${fromLevel} to level ${level}, which `
                    + `region "${this.region}" has no marked exit to. The atlas covers part of the map by `
                    + 'design, so the AP region was NOT moved — mark this crossing in the Region Marking '
                    + 'Tool to make it a real boundary.',
            }];
        }
        return [{
            type: 'regionMove',
            sourceRegion: this.region,
            targetRegion: exit.targetRegion,
            exitName: exit.exitName ?? exit.exit_id,
            exitId: exit.exit_id,
            fromLevel,
            toLevel: level,
        }];
    }
}
