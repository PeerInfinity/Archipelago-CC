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
 * ## ⛓⛓ Logical sub-region links (§5.17; ⚖ the user, 2026-10-03 — amends ruling 1 for logical links)
 *
 * A region with a subgraph compiles to one AP region per sub-region, all in ONE level, joined by LOGICAL
 * links (an exit with a rule and no door). The game reports nothing when one is crossed, so the binding
 * learns the move three ways (`seedlingSubRegions.js` holds the partition and the links):
 *
 *   position   `onPlayerPosition` — the player's tile entering ANOTHER sub-region's tiles (the glue reads
 *              it off the game). EDGE-triggered: only a CHANGE of the sub-region the player is seen in is
 *              news, and a tile in no sub-region (a wall, water, the seam) is no news, so a seam cannot
 *              flicker. This is the one that is exact for a human.
 *   the bot    `creditLink` — the Playback Bot's route names a link; the controller credits it at once and
 *              the next door is walked physically (the solver plans the whole room).
 *   a door     `_resolveCrossing` — a level change the CURRENT sub-region has no departure to, while a
 *              SIBLING sub-region of the level does: the logical hop(s) are credited first, then the
 *              crossing. Exact for a door fired before a position read saw the seam.
 *
 * ⛔ A MOVE IS CREDITED ONLY THROUGH LINKS THE GATE OPENS (`canPass`, the door gate). A player standing in
 * a sub-region the rules say needs an item they lack is WARNED about and the AP region stays — the binding
 * never credits a move the logic does not allow. A logical move publishes `regionMove` (`logical: true`),
 * and the region load it causes is NOT an arrival: nothing is teleported (`pendingLogical`).
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

import { parseSeqPayload } from './seqPayload.js';
import { returnKey } from './seedlingReturnSpawns.js';
import { DOOR_GATE_ERROR_DEFAULT, lockedDoorMessage, ruleItemNames } from './seedlingDoorGate.js';
import { levelHasSubRegions, linkPath, subRegionAt } from './seedlingSubRegions.js';

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
/**
 * ⛓⛓ SEEDLING IN THE PIPELINE T1 — **WHICH EXIT AN ARRIVAL NAMES, THREE WAYS,
 * IN THIS ORDER.** A compiled atlas world names it by the ATLAS exit id (its
 * source exits carry `targetExitId`), and that arm is tried first, so every
 * such world resolves exactly as before. A room PLACED by the pipeline keeps
 * the atlas id as `exit_id` and carries the engine's `exit_<side>` as
 * `exitName` — a world that links reverse exits (sphere, grid, top-down) names
 * that. And a world that links none (the shuffled spiral: `linkReverseExits`
 * is top-down's alone) hands over only the SOURCE region's own exit name,
 * which names nothing here; `source_region` is then the one fact left, and the
 * arrival is the exit leading back to it. Two doors to one neighbour: the
 * first in payload order, which is the order the doors were bound in.
 */
function arrivalExitOf(exits, arrivedFrom) {
    const wanted = arrivedFrom?.exit_id ?? null;
    if (wanted) {
        const byId = exits.find((e) => e.exit_id === wanted)
            ?? exits.find((e) => e.exitName === wanted);
        if (byId) return byId;
    }
    const source = arrivedFrom?.source_region ?? null;
    return source ? (exits.find((e) => e.targetRegion === source) ?? null) : null;
}

/**
 * ⛓⛓ SEEDLING T2b (U2b) — **AND WHERE ON THAT EXIT: THE GAME'S OWN RETURN
 * SPAWN, THE DOOR TILE ONLY WITHOUT ONE.** `returnSpawns` is
 * `seedlingReturnSpawns.returnSpawnTable(mapDoc)`, injected (this module does
 * no fetch). The game does not draw the player on the house door's tile and
 * vanilla never lands there; leaving through a door, it lands one tile off,
 * at the reverse link's `playerx/playery` (plan §15.0). The exit's tile is its
 * `entrance_tile`, else its first `exit_tiles` entry. `landing` says which of
 * the two answered.
 */
export function resolveArrivalSpawn(world, arrivedFrom, returnSpawns = null) {
    const exits = exitList(world);
    if (exits.length === 0) return null;
    const byId = arrivalExitOf(exits, arrivedFrom);
    const exit = byId ?? exits[0];
    const spawn = exit?.entrance_spawn;
    if (!spawn || !Number.isFinite(world?.level)) return null;
    const tile = exit.entrance_tile ?? exit.exit_tiles?.[0] ?? null;
    const back = tile && typeof returnSpawns?.get === 'function'
        ? returnSpawns.get(returnKey(world.level, tile[0], tile[1])) ?? null
        : null;
    return {
        level: world.level,
        x: back ? back.x : spawn.x,
        y: back ? back.y : spawn.y,
        exitId: exit.exit_id,
        matchedArrivedFrom: !!byId,
        landing: back ? 'return-spawn' : 'entrance-spawn',
    };
}

/**
 * ⛓⛓ **WHERE A NEW GAME STARTS — THE ONE ANSWER** (the Menu panel's Restart,
 * 2026-10-05). `world` is the START region's payload (the region the declared
 * start's hop enters: `level_0__r8c0`, `overworld_start__r8c0`, …); `set` is
 * the level set a randomized load DELIVERED, or null.
 *
 * Every caller that puts a player at the start asks this, so they cannot drift:
 *   - the binding's start-hop arrival (`onLoadRegion` with `startHop`) — a new
 *     game's first teleport, and a Restart's;
 *   - the randomized load's reset (`seedlingRandomizerWiring`), whose boot
 *     position is this answer without the set (`set: null`).
 *
 * The answer, in order:
 *   1. a delivered set that names its own start POSITION (the generated arm:
 *      `summary.startCell`) — the reset sends exactly that, so a new game ends
 *      there;
 *   2. otherwise the start region's arrival spawn with no "came from"
 *      (`resolveArrivalSpawn(world, null, …)`: its FIRST exit's return spawn,
 *      else its entrance spawn) — where the start hop's arrival teleports, and
 *      what a level-only set's reset re-sends as its boot position.
 *
 * `source` says which answered. null = the region carries no spawn.
 *
 * @returns {{level:number, x:number, y:number, source:'set'|'arrival',
 *   exitId?:string, landing?:string}|null}
 */
export function seedlingStartSpawn({ world = null, returnSpawns = null, set = null } = {}) {
    const start = set?.start ?? null;
    if (start && Number.isInteger(start.level) && Number.isInteger(start.x) && Number.isInteger(start.y)) {
        return { level: start.level, x: start.x, y: start.y, source: 'set' };
    }
    const arrival = resolveArrivalSpawn(world, null, returnSpawns);
    if (!arrival) return null;
    return { level: arrival.level, x: arrival.x, y: arrival.y, source: 'arrival',
        exitId: arrival.exitId, landing: arrival.landing };
}

/**
 * ⛓⛓ **THE PRE-SWAP DOOR REPORT** (EDITOR INTEGRATION M1; plan §11.1 A1,
 * §11.2). `Game.pendingExit` is `"<seq>|<fromLevel>|<type>|<x>|<y>|<to>"`,
 * written by `Teleporter.update()` in the frame BEFORE `FP.world = new Game()`
 * lands. It exists because the `level` report cannot say WHICH door fired:
 * `new Game(to,..)` sets `Main.level` in its own constructor, so by the time
 * the level moves the door is unrecoverable.
 *
 * ⛔ THE `<seq>` PREFIX IS NOT DECORATION AND IT IS NOT PART OF THE ADDRESS.
 * BridgeGeneric reports a property only when its value CHANGED, so two fires
 * of ONE door would produce the same string and the second would be silently
 * dropped. MEASURED on p4c at W5-0: re-writing the same string produced no
 * report at all. The counter is stripped here and never compared.
 *
 * ⛓ THE DELIMITER IS SAFE BY CONSTRUCTION, AND A ROW ASSERTS IT FROM
 * `LINK_TAGS` rather than from three literals: `|` appears in no link tag and
 * `String(int)` cannot produce one.
 *
 * @returns {{seq:number, fromLevel:number, type:string, x:number, y:number,
 *            to:number}|null} null for the empty boot report and for anything
 *   malformed — a value the game never wrote is not a door.
 */
export const PENDING_EXIT_FIELDS = 6;
export function parsePendingExit(value) {
    // ⛔ The five refusal rules — including EMPTY IS NOT ZERO, which is why an
    // unwritten field is not a door to level 0 at (0, 0) — are
    // `parseSeqPayload`'s. The TYPING below is this caller's: `type` stays a
    // STRING, so only five of the six fields are swept.
    const parts = parseSeqPayload(value, PENDING_EXIT_FIELDS);
    if (!parts) return null;
    const [seq, fromLevel, type, x, y, to] = parts;
    const nums = [seq, fromLevel, x, y, to].map(Number);
    if (nums.some((n) => !Number.isInteger(n))) return null;
    return { seq: nums[0], fromLevel: nums[1], type, x: nums[2], y: nums[3], to: nums[4] };
}

/**
 * The atlas exit id a door report names.
 *
 * ⛔⛔ **IT IS SPELLED HERE, AND THE REASON IS A MEASUREMENT, NOT A PREFERENCE**
 * (maze-lab arms F-a / plan §17.1 F6). The formula is
 * `seedlingAtlasDerivation.outExitId`'s, the two must not drift, and the
 * obvious fix is to import it. That was PRICED at `8a1eb6b1a` over the static
 * import closure, and refused:
 *
 *   `flashPanel/index.js` today ............... 43 files,   650,891 B
 *   + a static `seedlingAtlasDerivation` ...... 70 files, 1,918,889 B
 *   ⇒ the cost of one line ..................... +27 files, +1,267,998 B
 *
 * This module is IN the panel's static closure (`index.js` reaches it), so the
 * import would be paid by every page that mounts the flash panel, to spell
 * twelve characters. `seedlingAtlasDerivation` is reached from the panel the
 * other way — a DYNAMIC import through `AP_MODULE_PATHS.derivation`
 * (`seedlingRandomizerWiring.js:93`) — which is exactly the arrangement §5i's
 * 1 MB lesson bought.
 *
 * ⇒ the drift guard is not an import, it is the PIN: `seedlingRegionBinding.
 * test.js`'s *"rebuilds the exit id the ATLAS spells"* row imports the
 * derivation (a test file is not in the bundle) and asserts this function
 * against it for every `LINK_TAGS` value. That row is the reason this line may
 * exist; deleting it deletes the licence.
 */
export const outExitIdOf = ({ type, x, y }) => `out_${type}_${x}_${y}`;

/**
 * ⛓⛓ SEEDLING IN THE PIPELINE T1 — **WHICH EXIT A DOOR REPORT IS, TWO WAYS,
 * IN THIS ORDER.** A DERIVED atlas spells its door ids `out_<type>_<x>_<y>`,
 * and that arm is tried first, so every such world resolves exactly as before.
 * A HAND-AUTHORED atlas names its doors (the starter atlas: `house_door`,
 * `owls_nest_stairs`), so the id cannot be rebuilt from the report; what the
 * two share is the TILE — the door's pixel position over the payload's own
 * `tile_size` falls in one of the exit's `exit_tiles`. Measured on the starter
 * atlas: every door id is a name, so without this arm no door of a placed
 * starter-atlas room could ever be recognised as a departure.
 */
export function departureExitOf(world, door) {
    const exits = exitList(world);
    const exitId = outExitIdOf(door);
    const byId = exits.find((e) => e.exit_id === exitId);
    if (byId) return byId;
    const size = world?.tile_size;
    if (!Number.isInteger(size) || size <= 0) return null;
    const tx = Math.floor(door.x / size);
    const ty = Math.floor(door.y / size);
    return exits.find((e) => (e.exit_tiles ?? []).some(([x, y]) => x === tx && y === ty)) ?? null;
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
    const reaching = exitList(world).filter((e) => e.target_level === level);
    /**
     * ⛔ A DEPARTURE BEATS AN ARRIVAL ROW (§5.17, measured live). A sidecar also lists where doors of OTHER
     * levels land (`in_L3_96_128`: `exitName`/`targetRegion` null) with the same `target_level`, and on
     * `level_11` that row shares its `target_spawn` with the real door (`level_11 -> level_3__r8c6`), so the
     * tie-break kept whichever came first: the arrival row, a move to `null`, and the bot stalled in L3.
     * Arrival rows are candidates only when no departure reaches the level.
     */
    const departures = reaching.filter((e) => e.targetRegion);
    const candidates = departures.length > 0 ? departures : reaching;
    if (candidates.length <= 1) return candidates[0] ?? null;
    let best = candidates[0];
    let bestD = dist2(spawn, best.target_spawn);
    for (const e of candidates.slice(1)) {
        const d = dist2(spawn, e.target_spawn);
        if (d < bestD) { best = e; bestD = d; }
    }
    return best;
}

/**
 * ⛓⛓ SEEDLING GENERATED G4 — **WHAT A GATE ANSWERED, NORMALISED.** `canPass`
 * may answer a boolean or `{pass, needs?, missing?}`; anything else, a throw
 * included, is an ERROR named in `error`, and the door takes
 * `DOOR_GATE_ERROR_DEFAULT` (open — `seedlingDoorGate.js` says why).
 */
export function doorVerdict(canPass, exit, context) {
    if (typeof canPass !== 'function') return { pass: true, gated: false };
    let answer;
    try {
        answer = canPass(exit, context);
    } catch (err) {
        return { pass: DOOR_GATE_ERROR_DEFAULT === 'open', gated: true, error: err?.message ?? String(err) };
    }
    if (typeof answer === 'boolean') return { pass: answer, gated: true };
    if (answer && typeof answer.pass === 'boolean') {
        return {
            pass: answer.pass, gated: answer.gated !== false, needs: answer.needs, missing: answer.missing,
            // ⛓ G6 — where the rule came from, and the sentence when it was not static data.
            ...(answer.fallback ? { fallback: answer.fallback } : {}),
        };
    }
    return {
        pass: DOOR_GATE_ERROR_DEFAULT === 'open',
        gated: true,
        error: `the door gate answered ${JSON.stringify(answer) ?? String(answer)}, not a pass/refuse verdict`,
    };
}

export class SeedlingRegionBinding {
    /**
     * @param {object} [opts]
     * @param {function} [opts.now]      injectable clock (tests)
     * @param {function} [opts.canPass]  G4 — `canPass(exit, {region})` → a door
     *   verdict (`doorVerdict`); null = every door passes, today's behaviour
     */
    constructor({ now, canPass } = {}) {
        this._now = now ?? (() => Date.now());
        this.canPass = canPass ?? null;
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
        /**
         * ⛓ TRAP 1 POINTED THE OTHER WAY (M1). An EXTERNAL door is reported
         * one frame before the game swaps worlds — and it swaps anyway, into a
         * real room of its own set (design (c): the game learns nothing about
         * worlds). That swap's `level` report is the game telling us about a
         * move we already published as a region crossing, so it is marked and
         * swallowed. Without the mark it resolves against a region whose
         * external exit carries `target_level: null`, finds nothing, and WARNS
         * LOUDLY about a crossing that worked.
         */
        this.pendingDeparture = null;
        /**
         * ⛓⛓ G4 — A REFUSED DOOR, THE SAME TRAP A THIRD WAY. The game swaps
         * into the door's `to` level anyway (it knows nothing of AP gates); this
         * mark swallows that swap AND answers it with the bounce home — the
         * teleport is sent only once the swap has LANDED, because a teleport
         * queued at the door report races the swap and, landing first, would
         * leave the player in the parking room. `{level, at, spawn, exitId}`.
         */
        this.pendingBounce = null;
        // An arrival asked for before the game was reporting; released on baseline.
        this.pendingSpawn = null;
        this.warnedLevels = new Set();
        /** T2b U2b — the game's own return spawns (`setReturnSpawns`); null = door tiles. */
        this.returnSpawns = null;
        /** ⛓ LOGICAL LINKS — `seedlingSubRegions.buildSubRegionMap`'s map (null = no sub-regions known). */
        this.subRegions = null;
        /** The sub-region the player was last SEEN in (a position read); the edge the watcher fires on. */
        this.physicalSub = null;
        /** Logical moves published, awaiting their region load (which must not teleport): `{region, at}`. */
        this.pendingLogical = [];
        /** `from>to` pairs already warned about (a closed link): said once per region load. */
        this.warnedLinks = new Set();
        this.logicalMoves = 0;
        /**
         * ⛓ RESTART — the start region (the last `startHop` load's) and the set a randomized load
         * delivered (`setStartSet`): the two inputs of `seedlingStartSpawn` besides the return spawns.
         */
        this.startRegion = null;
        this.startWorld = null;
        this.startSet = null;
        this.arrivedByStartHop = false;
        this.restarts = 0;
    }

    /** Where the current region's arrival lands: a start hop's is `seedlingStartSpawn`, any other the door's. */
    _arrivalSpawn() {
        return this.arrivedByStartHop
            ? seedlingStartSpawn({ world: this.world, returnSpawns: this.returnSpawns, set: this.startSet })
            : resolveArrivalSpawn(this.world, this.arrivedFrom, this.returnSpawns);
    }

    /** ⛓ RESTART — the level set a randomized load delivered (its `start` may carry a position). */
    setStartSet(set) {
        this.startSet = set ?? null;
    }

    /**
     * ⛓ RESTART — `seedlingStartSpawn` for the start region this binding was loaded with, or null
     * (no start hop seen). `set` defaults to the delivered one; the randomized load passes `null` to
     * ask for its boot position.
     */
    startSpawn({ set = this.startSet } = {}) {
        if (!this.startWorld) return null;
        return seedlingStartSpawn({ world: this.startWorld, returnSpawns: this.returnSpawns, set });
    }

    /** ⛓ LOGICAL LINKS — the host hands over the sub-region map once the rules and the partition are in. */
    setSubRegions(map) {
        this.subRegions = map ?? null;
        this.physicalSub = null;
    }

    /**
     * Should the glue read the player's position now? Only while this substrate is active and reporting,
     * no swap of ours is in flight, and the CURRENT region's level has sub-regions to tell apart.
     */
    wantsPosition() {
        if (!this.active || !this.baselineSeen || !this.subRegions) return false;
        if (this.pendingArrival || this.pendingDeparture || this.pendingBounce) return false;
        const level = this.world?.level;
        return Number.isInteger(level) && level === this.lastLevel && levelHasSubRegions(this.subRegions, level);
    }

    /** ⛓ §5.19 — forget the sub-region the player was last seen in: the next position read is news (the reset landed). */
    rearmPosition() {
        this.physicalSub = null;
    }

    /**
     * ⛓ LOGICAL LINKS — the player's live position. `baseline: true` records where the player stands
     * WITHOUT moving (the glue's first read after a bot walk, whose route already credited its links).
     */
    onPlayerPosition({ level, x, y } = {}, { baseline = false } = {}) {
        if (!this.wantsPosition() || level !== this.lastLevel) return [];
        const sub = subRegionAt(this.subRegions, level, x, y);
        if (!sub || sub === this.physicalSub) return [];
        if (baseline || sub === this.region) { this.physicalSub = sub; return []; }
        // ⛔ A REFUSED move leaves the edge ARMED: the next read asks again (warned once), so an item that
        // arrives while the player stands there moves the region then — not only after a step out and back.
        const effects = this._logicalMoveTo(sub, `the player walked into ${sub}'s tiles`);
        if (this.region === sub) this.physicalSub = sub;
        return effects;
    }

    /**
     * ⛓ LOGICAL LINKS — the Playback Bot's route names the link `name`: credit it NOW (the next door is
     * walked physically). `{ok, effects}` or `{ok: false, reason}`; a link the gate refuses is refused.
     */
    creditLink(name) {
        const link = [...(this.subRegions?.links?.values() ?? [])].flat().find((l) => l.name === name) ?? null;
        if (!link) return { ok: false, reason: `"${name}" is not a logical sub-region link of this preset` };
        if (!this.active) return { ok: false, reason: 'another substrate owns the region (the binding is parked)' };
        if (link.from !== this.region) {
            return { ok: false, reason: `the link "${name}" leaves ${link.from}, but the AP region is ${this.region ?? 'none'}` };
        }
        const verdict = this._linkVerdict(link);
        if (!verdict.pass) {
            return { ok: false, reason: `the link "${name}" is closed — ${lockedDoorMessage(link.to, this._needs(verdict, link))}` };
        }
        return { ok: true, effects: this._hop(link, verdict, 'the Playback Bot\'s route') };
    }

    _linkVerdict(link) {
        return doorVerdict(this.canPass, { exitName: link.name, exit_id: link.name, access_rule: link.access_rule },
            { region: link.from });
    }

    _needs(verdict, link) {
        return verdict.missing?.length ? verdict.missing : (verdict.needs?.length ? verdict.needs : ruleItemNames(link.access_rule));
    }

    /** One logical hop: the AP region becomes `link.to` HERE (a later level report resolves against it). */
    _hop(link, verdict, why) {
        const effects = [];
        if (verdict.error) {
            effects.push({ type: 'warn', message: `[door gate] could not evaluate the rule on the logical link "${link.name}" — `
                + `${verdict.error}; the link is ${verdict.pass ? 'left OPEN' : 'LOCKED'} (the declared default)` });
        }
        this.region = link.to;
        this.world = this.subRegions.worlds.get(link.to) ?? this.world;
        this.arrivedByStartHop = false;
        this.arrivedFrom = { exit_id: link.name, source_region: link.from };
        this.pendingLogical.push({ region: link.to, at: this._now() });
        this.warnedLinks.clear();
        this.logicalMoves += 1;
        effects.push({
            type: 'regionMove',
            sourceRegion: link.from,
            targetRegion: link.to,
            exitName: link.name,
            exitId: link.name,
            fromLevel: link.level,
            toLevel: link.level,
            logical: true,
            why,
        });
        return effects;
    }

    /** Move the AP region to `target` through the open links; a closed way is WARNED once and not taken. */
    _logicalMoveTo(target, why) {
        const from = this.region;
        const route = linkPath(this.subRegions, from, target, (link) => this._linkVerdict(link));
        if (route.path) return route.path.flatMap(({ link, verdict }) => this._hop(link, verdict, why));
        const key = `${from}>${target}`;
        if (this.warnedLinks.has(key)) return [];
        this.warnedLinks.add(key);
        const closed = route.refused.find((r) => r.link.to === target) ?? route.refused[0] ?? null;
        const needs = closed ? this._needs(closed.verdict, closed.link) : [];
        return [{
            type: 'warn',
            message: `[region atlas] ${why}, but no OPEN logical link leads there from ${from}`
                + `${closed ? ` (the link "${closed.link.name}" needs ${needs.length ? needs.join(', ') : 'its rule met'})` : ''}`
                + ' — the AP region was NOT moved: the logic does not allow this move yet',
        }];
    }

    /**
     * ⛓ T2b U2b — the host hands over `returnSpawnTable(mapDoc)` once the map
     * document is in. An arrival already QUEUED (the game not booted yet, or the
     * substrate parked) was resolved without it, so it is resolved again.
     */
    setReturnSpawns(table) {
        this.returnSpawns = table ?? null;
        if (this.pendingSpawn && this.world) {
            this.pendingSpawn = this._arrivalSpawn();
        }
    }

    /** procgen loaded a region into this substrate. */
    onLoadRegion({ region_id: regionId, world, arrivedFrom, startHop = false, restart = false } = {}) {
        /**
         * ⛓ LOGICAL LINKS — the load a logical move caused is NOT an arrival: the player is already
         * standing where they are, and the binding moved itself when it published the move. Swallowed
         * (no teleport), the mark aged like every other.
         */
        this.pendingLogical = this.pendingLogical.filter((m) => this._now() - m.at <= ARRIVAL_ECHO_TIMEOUT_MS);
        const logical = this.pendingLogical.findIndex((m) => m.region === regionId);
        if (logical >= 0) {
            this.pendingLogical.splice(logical, 1);
            this.region = regionId;
            this.world = world ?? this.world;
            this.arrivedByStartHop = false;
            return [{ type: 'info', message: `[region atlas] "${regionId}" entered by a logical link — no teleport` }];
        }
        this.pendingLogical = [];
        this.physicalSub = regionId ?? null;
        this.warnedLinks.clear();
        this.region = regionId ?? null;
        this.world = world ?? null;
        this.arrivedFrom = arrivedFrom ?? null;
        this.warnedLevels.clear();
        /**
         * ⛓⛓ RESTART — THE START HOP'S ARRIVAL IS A NEW GAME'S (`seedlingStartSpawn`): a new game's first
         * load and a Restart's re-take are the same hop, so both land where the randomized reset sends a
         * new game. Any other load arrives through the door it came from.
         */
        this.arrivedByStartHop = !!startHop;
        if (startHop) {
            this.startRegion = this.region;
            this.startWorld = this.world;
            if (restart) this.restarts += 1;
        }
        const spawn = this._arrivalSpawn();
        if (!spawn) {
            return [{
                type: 'warn',
                message: `[region atlas] region "${this.region}" carries no arrival spawn `
                    + '(no wired exits, or no level) — the player was NOT teleported',
            }];
        }
        const effects = [];
        if (restart) {
            effects.push({ type: 'info', message: `[region atlas] Restart: back to the start region "${this.region}" — `
                + `level ${spawn.level} (${spawn.x}, ${spawn.y}), ${spawn.source === 'set' ? 'the delivered set\'s start' : 'its arrival spawn'}` });
        } else if (!startHop && this.arrivedFrom?.exit_id && !spawn.matchedArrivedFrom) {
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
    /** G4 — the host's door predicate (`seedlingDoorGate.createDoorGate`); null = every door passes. */
    setCanPass(canPass) {
        this.canPass = canPass ?? null;
    }

    onGameRestart() {
        this.physicalSub = null;
        this.pendingLogical = [];
        this.baselineSeen = false;
        this.lastLevel = null;
        this.lastSpawn = { x: null, y: null };
        this.pendingArrival = null;
        this.pendingDeparture = null;
        this.pendingBounce = null;
        this.pendingSpawn = this.world ? this._arrivalSpawn() : null;
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
            // ⛓ And the departure mark, for the same reason: left armed
            // through the excursion it would swallow the first REAL crossing
            // after the return.
            this.pendingDeparture = null;
            // ⛓ G4 — and a bounce not yet answered: the swap it waits for is
            // no longer ours to read.
            this.pendingBounce = null;
            // ⛓ LOGICAL LINKS — and where the player was last seen: the excursion ends with a fresh read.
            this.physicalSub = null;
            this.pendingLogical = [];
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
        /**
         * ⛓⛓ **THE DEPARTURE, AND IT ARRIVES BEFORE THE LEVEL MOVE** — the
         * whole reason `pendingExit` is declared above `level` in
         * games/seedling.json. The game reports EVERY door it fires; deciding
         * which one leaves this substrate is the HOST's job, and the exit it
         * matches already CARRIES `external` (W6/H1), so it is a field read
         * rather than a second substrate lookup.
         */
        if (property === 'pendingExit') return this._resolveDeparture(parsePendingExit(value));
        if (property !== 'level') return [];
        const level = Number(value);
        /**
         * ⛓ G2 — A NEGATIVE LEVEL IS NOT A ROOM. `-1` is the game's own "no game"
         * sentinel, and MEASURED (seedling generated G2, the box gate): mounting a
         * delivered level set reports `level -1` between the arrival and the load's
         * reset, which the arm below read as two undeclared crossings (0 → −1 → 0)
         * and warned about twice. No room is left or entered, so it is neither a
         * baseline nor a crossing, and `lastLevel` keeps the last real room.
         */
        if (!Number.isInteger(level) || level < 0) return [];

        if (!this.baselineSeen) {
            this.baselineSeen = true;
            this.lastLevel = level;
            const spawn = this.pendingSpawn;
            this.pendingSpawn = null;
            return spawn ? this._beginArrival(spawn) : [];
        }

        /**
         * ⛔⛔ G4 — THE REFUSED DOOR'S SWAP, SWALLOWED AND ANSWERED. Checked
         * first for the departure echo's reason (the swap is the very next
         * report after the door) and age-checked first for trap 961's: a mark
         * left armed must not swallow a genuine later arrival on that level.
         * The swap is REVERSED — the answer is the bounce home, and the bounce
         * arms `pendingArrival` for its own echo.
         */
        if (this.pendingBounce) {
            if (this._now() - this.pendingBounce.at > ARRIVAL_ECHO_TIMEOUT_MS) {
                this.pendingBounce = null; // written off — treat this as real
            } else if (this.pendingBounce.level === level) {
                const { spawn, exitId, region } = this.pendingBounce;
                this.pendingBounce = null;
                this.lastLevel = level;
                return this._bounceHome(spawn, exitId, region);
            }
        }

        /**
         * ⛔ THE DEPARTURE ECHO, SWALLOWED — and checked ABOVE the arrival echo
         * because an external door fires while no arrival is in flight, and
         * because the swap is the very next report after the one that armed it.
         */
        if (this.pendingDeparture) {
            // ⛔ THE AGE IS CHECKED FIRST, AND DELIBERATELY. The mark matches
            // ONE level, so testing equality first would make the timeout
            // decorative: a mark left armed would still swallow the player's
            // genuine return through that door however much later it came.
            if (this._now() - this.pendingDeparture.at > ARRIVAL_ECHO_TIMEOUT_MS) {
                this.pendingDeparture = null; // written off — treat this as real
            } else if (this.pendingDeparture.level === level) {
                this.pendingDeparture = null;
                this.lastLevel = level;
                return [];
            }
        }

        /**
         * ⛔ THE AGE IS CHECKED FIRST HERE TOO — trap 961's shape, and the
         * arrival mark was the half that still read the other way round
         * (EDITOR INTEGRATION slice P2, ⚖ §17.4.8 residue).
         *
         * The mark matches ONE level, and the level a teleport targets is
         * exactly the level the player will eventually come BACK to through
         * that same door. So with the equality first, a mark that was never
         * landed and never written off swallowed the genuine later return —
         * however much later it came — and the timeout below it was decorative
         * on the only report it could ever have applied to. Reordered, the
         * write-off wins and that return is a real crossing.
         *
         * ⚠ The two other branches are UNCHANGED, and this is the whole
         * behavioural delta: `age > TIMEOUT && level === mark.level`. Inside
         * the window nothing moves — a matching level is still our own
         * teleport, a differing one still pre-arrival noise with the mark left
         * armed for the landing that has not come yet.
         */
        if (this.pendingArrival) {
            if (this._now() - this.pendingArrival.at > ARRIVAL_ECHO_TIMEOUT_MS) {
                this.pendingArrival = null; // written off — treat this as real
            } else if (this.pendingArrival.level === level) {
                this.pendingArrival = null;
                this.lastLevel = level;
                return []; // our own teleport, swallowed
            } else {
                // The teleport has not landed yet; this report is pre-arrival
                // noise, not a player crossing.
                this.lastLevel = level;
                return [];
            }
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

    /**
     * G4 — the refused door's answer: back onto the door's APPROACH cell in
     * this room (the arrival law — never the door tile, whose latch would not
     * fire again and on which the game does not draw the player). Armed like an
     * arrival: `lastLevel` is the swap's level, so the landing is a level change
     * and its echo is swallowed.
     */
    _bounceHome(spawn, exitId, region) {
        if (this.baselineSeen && spawn.level !== this.lastLevel) {
            this.pendingArrival = { level: spawn.level, x: spawn.x, y: spawn.y, at: this._now() };
        }
        return [{ type: 'bounce', level: spawn.level, x: spawn.x, y: spawn.y, exit: exitId, region }];
    }

    /**
     * One door fire. Returns EFFECTS, like every other input.
     *
     * ⛔ SILENCE IS THE RIGHT ANSWER FOR THREE OF THE FOUR CASES, and each is
     * silent for its own reason:
     *   - a malformed or EMPTY payload — BridgeGeneric reports every declared
     *     property once at boot, so `""` arrives on a build that has the seam
     *     and has fired no door. It is not a door;
     *   - a door this region does not declare as an exit — the atlas covers
     *     part of the map by design, and the `level` arm below already WARNS
     *     about the move it causes. Warning here too would double every one;
     *   - a door that stays inside this substrate — that is an ordinary
     *     crossing and the `level` arm resolves it, with the spawn tie-break
     *     this report cannot do better than.
     * Only an `external` exit is ours, and it is the one case the `level` arm
     * cannot handle at all: an external exit carries `target_level: null`
     * (H1/A3), so it can never be the answer to "which exit reached level N".
     */
    _resolveDeparture(door) {
        if (!door) return [];
        const exit = departureExitOf(this.world, door);
        if (!exit || !exit.external) return [];
        const effects = [];
        /**
         * ⛓⛓ G4 — THE HOST'S GATE. Asked only here, where the crossing is
         * decided: a refused door publishes NO region move (the AP region stays
         * put) and arms the bounce; a gate that cannot answer takes the
         * declared default and SAYS SO; no predicate = today's behaviour.
         */
        const verdict = doorVerdict(this.canPass, exit, { region: this.region });
        const target = exit.targetRegion;
        const exitName = exit.exitName ?? exit.exit_id;
        if (verdict.error) {
            effects.push({
                type: 'warn',
                message: `[door gate] could not evaluate the rule on the door to "${target}" ("${exitName}") — `
                    + `${verdict.error}; the door is ${verdict.pass ? 'left OPEN' : 'LOCKED'} (the declared default)`,
            });
        }
        if (!verdict.pass) {
            const home = resolveArrivalSpawn(this.world, { exit_id: exit.exit_id }, this.returnSpawns);
            if (home) {
                const needs = verdict.missing?.length ? verdict.missing
                    : (verdict.needs?.length ? verdict.needs : ruleItemNames(exit.access_rule));
                this.pendingBounce = { level: door.to, at: this._now(), spawn: home, exitId: exit.exit_id,
                    region: this.region };
                return effects.concat([{
                    type: 'locked',
                    sourceRegion: this.region,
                    region: target,
                    exit: exitName,
                    exitId: exit.exit_id,
                    needs,
                    message: lockedDoorMessage(target, needs),
                    ...(verdict.fallback ? { fallback: verdict.fallback } : {}),
                }]);
            }
            effects.push({
                type: 'warn',
                message: `[door gate] the door to "${target}" is locked, but region "${this.region}" has no `
                    + 'spawn to bounce the player back to (no level, or the door carries no entrance spawn) — '
                    + 'the crossing proceeds rather than strand the player',
            });
        }
        // The game swaps anyway — design (c) — into a real room of its own
        // set. Mark that swap so its `level` report is not read as a crossing.
        this.pendingDeparture = { level: door.to, at: this._now() };
        return effects.concat([{
            type: 'regionMove',
            sourceRegion: this.region,
            targetRegion: exit.targetRegion,
            exitName: exit.exitName ?? exit.exit_id,
            exitId: exit.exit_id,
            fromLevel: door.fromLevel,
            toLevel: door.to,
            external: true,
        }]);
    }

    _resolveCrossing(level, fromLevel) {
        /**
         * ⛓ LOGICAL LINKS — the CURRENT sub-region has no departure to `level`, a sibling of the same level
         * does: the player crossed a seam no position read saw (or the route's bucket put the door in the
         * sibling). Its logical hop(s) are credited first, through OPEN links only, then the crossing.
         */
        const own = exitList(this.world).some((e) => e.target_level === level && e.targetRegion);
        const sibling = own ? null : this._siblingDeparture(level);
        if (sibling) {
            const hops = sibling.path.flatMap(({ link, verdict }) => this._hop(link, verdict,
                `a door to level ${level} fired from ${sibling.region}'s side of the level`));
            return hops.concat(this._crossing(sibling.exit, level, fromLevel));
        }
        // ⛔ An entry with no `targetRegion` is an ARRIVAL-only row of the sidecar (`in_L2_…`: where a door of
        // another level lands), not a way out: a move to `null` would PARK this substrate (procgenPlayer's
        // "no substrate owns the player"), so it is the unmapped case below.
        const found = resolveCrossingExit(this.world, level, this.lastSpawn);
        const exit = found && (found.targetRegion || !this.subRegions) ? found : null;
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
        return this._crossing(exit, level, fromLevel);
    }

    _crossing(exit, level, fromLevel) {
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

    /**
     * The sibling sub-region of the current level with a DEPARTURE to `level`, reached through open links:
     * `{region, exit, path}` or null. Several: the one whose door the reported spawn is nearest, then the
     * shortest route.
     */
    _siblingDeparture(level) {
        const own = this.world?.level;
        if (!this.subRegions || !Number.isInteger(own) || !levelHasSubRegions(this.subRegions, own)) return null;
        const found = [];
        for (const [region, payload] of this.subRegions.worlds) {
            if (region === this.region || payload?.level !== own) continue;
            const exit = resolveCrossingExit({ exits: exitList(payload).filter((e) => e.targetRegion) }, level, this.lastSpawn);
            if (!exit) continue;
            const route = linkPath(this.subRegions, this.region, region, (link) => this._linkVerdict(link));
            if (route.path) found.push({ region, exit, path: route.path, d: dist2(this.lastSpawn, exit.target_spawn) });
        }
        found.sort((a, b) => (a.d - b.d) || (a.path.length - b.path.length));
        return found[0] ?? null;
    }
}
