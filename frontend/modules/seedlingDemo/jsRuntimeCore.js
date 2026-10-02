/**
 * seedlingDemo/jsRuntimeCore — **THE SEEDLING JS RUNTIME, SPEAKING THE WASM
 * PAGE'S CONTRACT** (Seedling JS runtime arc, slice J1; plan
 * `NewDocs/plans/seedling-js-substrate-plan.md`).
 *
 * The flash panel talks to a recompiled Seedling page through
 * `WasmBridgeAdapter`: a same-origin iframe exposing `window.__swfBridge`
 * (`flashPanel/wasm/<build>/swf_bridge_avm2.js`) whose `game` table holds the
 * BridgeGeneric verbs (`wireCheck`, `configure`, `readState`) and the Bot.as
 * verbs the generated arm calls (`botStatus`, `botMobiles`, `botLoadLevels`,
 * `botLevelSet`). This module is that page's GAME, played by the JavaScript
 * model (`createManualSession` over `levelRun`) instead of the recompiled
 * binary, so the host glue — the region binding, the check binding, the
 * level-set delivery — runs UNCHANGED against either runtime.
 *
 * ⛔ DOM-FREE, like `watchManual.js`: the page (`jsRuntimePage.js`) owns the
 * canvas, the keys and the clock; this file owns the contract and is driven
 * tick by tick, so every row of it runs in node.
 *
 * ── WHAT EACH WASM-SIDE FACT BECOMES HERE ──────────────────────────────────
 *
 *  · `BridgeGeneric` reports a declared property ONLY WHEN IT CHANGED, in
 *    DECLARATION order (`games/seedling.json` `$comment_m1_seams`) →
 *    `flush()`: one pass over the configured `state_properties`, after every
 *    tick and every host call that can move one. The first pass after
 *    `configure` reports everything (the baseline burst) — on the NEXT tick,
 *    as the game's own per-frame poll does, never inside `configure`.
 *  · `Main.playerPositionX/Y` are the GAME CONSTRUCTOR'S args, written by
 *    `new Game(level, x, y)` — not the live position → `run.worldCtor`.
 *  · `Game.pendingCheck = "<seq>|<level>|<tag>|0"` is written by
 *    `APItem.removed()` → `Game.setPersistence(tag, false)` on CONTACT
 *    (`APItem` never sets `special`, so `Pickup.pick_up()` takes the
 *    `removeSelf()` arm: no freeze, no text) → `apItemContact()` below, over
 *    the `apitem` class row's `apItem` box (`levelWorld.ENTITY_CLASSES`).
 *  · `Game.pendingExit = "<seq>|<from>|<type>|<x>|<y>|<to>"` is written by
 *    `Teleporter.update()` in the frame its `new Game` is built (x, y are the
 *    TELEPORTER'S `.oel` position; `<type>` is its `exitType` — `teleporter`,
 *    or `stairsup`/`stairsdown` for a `Stairs`, `Stairs.as:25`) → the run's
 *    `transitions` ledger, joined to the teleporter the player stood in on the
 *    tick before (a teleporter tests the position the previous tick left,
 *    `levelRun.pickupUnderfoot`'s note), its type read off the room's own
 *    entity on that spot. A PIT FALL through a `control` block is a
 *    transition too, and the game writes no `pendingExit` for it; neither
 *    does this.
 *  · ⛓ J3 — `Game.pendingCheck` is ALSO written by every OTHER
 *    `setPersistence(tag, false)`: a chest opened, a lock turned off, a
 *    tagged pickup taken (`Game.as:1908`, the choke point the atlas arm's
 *    check table binds). The model keeps those writes in four ledgers
 *    (`earnedClears`, `bankedClears`, `appliedTimedClears`, the out-of-band
 *    `spinnerWrites` — `director.jsLiveEnvelope`'s fold); each NEW slot is
 *    reported once, `"<seq>|<level>|<tag>|0"`. ⚠ The game also reports the
 *    six RESTORING writers (`|1`); the model has no ledger of those and the
 *    host's check binding drops them anyway (it requires a clear).
 *  · `queueItems` items are drained once per tick (`getItemQueue`'s cadence):
 *    `{class, property, value}` flag writes, `{class:'game', property:'menu'}`
 *    (accepted, nothing to do), and the teleport recipe
 *    `{invocation:'new_instance', className:'Game', args:[level, x, y]}`
 *    → a fresh run booted at those constructor args.
 *  · `botLoadLevels` answers `'pending'` per chunk and `'ok'` on the last;
 *    `botLevelSet` reads back `{active, table_levels, start_level}`
 *    (`levelSetDisagreement.READBACK_FIELDS`).
 *
 * ── ⚖ THE TWO APPROVED LIBERTIES (user, 2026-10-01) ───────────────────────
 *
 *  1. DEATH IS THE MODEL'S. Since swim R3 the model dies the game's way — a
 *     pit with no `control` block, a drowning, lava and a hit at max all go
 *     through `die()` → the game's restart, inside `run.advance`, which no
 *     longer throws them. The page only REPORTS a death (it reads the run's
 *     own `playerDeaths`); it does not respawn anything. (J1's page-side
 *     catch-and-respawn at the arrival was the stopgap this replaced — the
 *     user's ruling, 2026-10-01: JS death matches the wasm game's.) ⛔ A pit
 *     WITH a `control` block is still a TRANSITION; every refusal the model
 *     still throws HALTS the page by name.
 *  2. The `apitem` class row (see above).
 *
 * ── ⛔ WHAT IS NOT MODELLED, BY NAME ──────────────────────────────────────
 *
 *  · An item flag that changes MID-ROOM re-boots the run where the player
 *    stands (the run's inventory is fixed at boot). The room's earned clears
 *    are carried; its per-visit state (enemy positions, velocity) is not.
 *  · ⛓ J3 — the VANILLA 116 are playable too: the page hands over the map
 *    document (`setVanilla`) and a `new Game` teleport with no level set
 *    mounted boots that level, exactly as the wasm game runs its own tables
 *    when the atlas arm delivers nothing. A delivered set takes precedence.
 *    A teleport that arrives before either is HELD and replayed. Before any
 *    boot the page reports level −1, the game's own "no game" sentinel.
 *  · A vanilla room is booted WITHOUT `scratchPersistence` (a kill-lock clear
 *    stays the model's named refusal, the census's setting); a delivered
 *    GENERATED set with it (J1). The model's refusals on real levels HALT the
 *    page BY NAME — the J3 HALT roster (plan, J3 as-built).
 *  · Items the PLAYER picks up in a real room (a vanilla sword) are the
 *    run's own: `Main.*` reports the host's flag OR the run's live inventory,
 *    and a re-boot folds what the run GAINED into the flags first.
 */

import { createManualSession } from './watchManual.js';
import { bootStaging } from './procgenOracle.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { assembleLevelSetChunks } from './levelSetValidator.js';
import { ENTITY_CLASSES, entityRect, STAIRS_TAGS, tagOf } from './levelWorld.js';
import { chestStanceBand } from './chest.js';
import { HITBOX } from './playerPhysicsV1.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { BUILD_SPAWN, ITEM_PROPERTIES } from './tapeFormat.js';
import { createRuntimeWalker, goalTiles, WALK_STATES } from './jsRuntimeWalker.js';
import { createRuntimeSolver } from './jsRuntimeSolver.js';

/**
 * The pins every JS-runtime run carries. ⛔ `sound` is not optional: without
 * it the first wet tick throws (J0(a)), and `dead_frames` is the census pin.
 */
export const JS_RUNTIME_PINS = Object.freeze(['dead_frames', 'sound']);

/**
 * What this runtime declares, in `builds.json`'s capability vocabulary — the
 * eligibility module OWNS the list (it is in the panel bundle and imports
 * nothing; this direction, seedlingDemo → flashPanel, is free).
 */
export { JS_RUNTIME_CAPABILITIES } from '../flashPanel/seedlingRandomizerEligibility.js';

/**
 * ⛓ The refusal WORDS a death used to throw. ⚠ Since swim R3 `run.advance` no
 * longer throws them (the model dies the game's way) and the page does NOT
 * catch them; they are kept because a PREVIEW step that reaches a death still
 * refuses with these words, and probes classify them. Originally: thrown by `playerPhysicsV2` as a
 * `PhysicsV2Error`: `fallDestination` (a pit in a room with no `control`
 * block — `checkFallingInPit` calls `die()`) and the drown step (water without
 * the conch, lava without the dark suit — the same `drownTimer`).
 */
export const DEATH_REFUSALS = Object.freeze([
    Object.freeze({ kind: 'pit', pattern: /fell into a pit in level -?\d+, which has NO control block/ }),
    Object.freeze({ kind: 'drown', pattern: /DROWNED in level -?\d+/ }),
]);

/** The death kind a thrown refusal names, or null when it is not a death. */
export function isDeathRefusal(err) {
    if (!err || err.name !== 'PhysicsV2Error') return null;
    const hit = DEATH_REFUSALS.find((d) => d.pattern.test(String(err.message)));
    return hit ? hit.kind : null;
}

/** The `Main.*` flag every item property names, with its empty value. */
const ITEM_FLAGS = Object.freeze(Object.fromEntries(Object.values(ITEM_PROPERTIES)
    .map((spec) => [spec.property, spec.kind === 'add' ? spec.base : false])));

/** The class aliases `games/seedling.json` declares, by the AS3 name they resolve to. */
const MAIN = 'Main';
const GAME = 'Game';

const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

/** The `exitType`s a `Teleporter` reports (`Teleporter.as:35`, `Stairs.as:25`). */
export const EXIT_TYPES = Object.freeze(['teleporter', ...STAIRS_TAGS]);

/**
 * ⛓ J3 — the `exitType` a fired door reports: the type of the room's own
 * link entity on the teleporter's `.oel` spot. `teleporter` when the record
 * names none (a delivered room always does).
 */
export function exitTypeAt(record, x, y) {
    const e = (record?.entities ?? []).find((en) => EXIT_TYPES.includes(en.type) && en.x === x && en.y === y);
    return e ? e.type : 'teleporter';
}

/**
 * ⛓ J3 — every persistence slot the run has CLEARED, across the four ledgers
 * that hold one (`director.jsLiveEnvelope`'s fold, minus window 1's boot
 * block, which a page run does not have).
 */
export function liveClears(run) {
    const out = [];
    const seen = new Set();
    const add = (level, tag) => {
        if (!Number.isInteger(level) || !Number.isInteger(tag) || tag < 0) return;
        const k = `${level}:${tag}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ level, tag });
    };
    for (const c of run.ledger('earnedClears') ?? []) add(c.level, c.tag);
    for (const c of run.ledger('bankedClears') ?? []) add(c.level, c.tag);
    for (const c of run.ledger('appliedTimedClears') ?? []) add(c.level, c.tag);
    for (const w of run.ledger('spinnerWrites') ?? []) if (w.outOfBand) add(w.flag?.level, w.flag?.tag);
    return out;
}

/**
 * ⛓ J3 — where the walk stands to take the location a `(level, tag)` names in
 * a real room: the entity holding that tag (of `type`, when the host knows
 * it). A chest opens from BELOW, on its two-pixel stance band
 * (`chest.chestStanceBand`, the run's own derivation); anything else is
 * touched at its centre. null when the room holds no such entity.
 */
export function locationEntityOf(record, tag, type = null) {
    return (record?.entities ?? []).find((e) => (type === null || e.type === type)
        && ENTITY_CLASSES[e.type] && tagOf(e.type, e.attrs) === tag) ?? null;
}
export function locationPointOf(entity) {
    if (!entity) return null;
    if (entity.type === 'chest') {
        const band = chestStanceBand(entity.x, entity.y, HITBOX);
        return { x: entity.x + 8, y: band[0] };
    }
    return { x: entity.x + 8, y: entity.y + 8 };
}

/**
 * A mounted room's record, the `level` the model addresses it by stamped on.
 * ⛔ `planLevelSetChunks` renders a `record` room to `{xml}` before it
 * crosses, so the page parses the SAME document the wasm game reads.
 */
export function recordOfRoom(room) {
    const src = room?.source ?? {};
    let record;
    if (typeof src.xml === 'string') record = parseOelLevel(src.xml, `room ${room.id} (${room.name ?? ''})`);
    else if (src.record) record = structuredClone(src.record);
    else throw new Error(`jsRuntimeCore: room ${room?.id} carries neither {xml} nor {record} — `
        + 'an `embed` room names a vanilla level, which is slice J3\'s');
    return { ...record, level: room.id };
}

/** The apitems a record holds, with the contact box the class row declares. */
export function apItemsOf(record) {
    const cls = ENTITY_CLASSES.apitem.apItem;
    return (record.entities ?? []).filter((e) => e.type === 'apitem').map((e) => ({
        x: e.x,
        y: e.y,
        tag: Number(e.attrs?.tag ?? -1),
        look: e.attrs?.look ?? 'ap',
        rect: entityRect(cls, e.x, e.y),
    }));
}

/**
 * @param {object} [opts]
 * @param {(prop: string, value: any) => void} [opts.onStateChanged] the host's
 *   report hook — the page forwards it to `__swfBridge.onStateChanged`.
 * @param {(msg: string) => void} [opts.log]
 */
export function createJsRuntime({ onStateChanged = null, log = () => {} } = {}) {
    let config = null;
    /** alias -> AS3 class name, from `configure`'s `classes`. */
    let aliases = new Map();
    let reported = new Map();
    let baselineOwed = false;

    const flags = { ...ITEM_FLAGS };
    let menu = true;
    let queue = [];

    let staged = null;          // { set_id, count, chunks: Map(index -> chunk) }
    let mounted = null;         // { set, records: Map(level -> record), source, apItems: Map(level -> [...]) }
    let levelSetError = null;
    /** ⛓ J3 — the vanilla map: `{ records: Map(level -> record), source }`, or null. */
    let vanilla = null;
    /** ⛓ J3 — a `new Game` that arrived before any room source: replayed by `setVanilla`. */
    let heldTeleport = null;
    /** ⛓ J3 — "level:tag" persistence clears already reported as `pendingCheck`. */
    const reportedClears = new Set();
    /** ⛓ J3 — the items the current run was booted with (what it GAINED is the difference). */
    let bootItems = null;

    let session = null;
    /** The constructor args the CURRENT room was entered with — the respawn point. */
    let arrival = null;
    /** "level:tag" persistence slots earned by previous runs, carried into the next. */
    const carried = new Map();
    /** "level:tag" apitems collected (their slot is cleared). */
    const collected = new Set();
    let deferredReboot = false;

    let pendingExit = '';
    let pendingExitSeq = 0;
    let pendingCheck = '';
    let pendingCheckSeq = 0;
    let ticks = 0;
    let halted = null;
    const deaths = [];
    const events = [];

    const note = (e) => { events.push({ t: ticks, ...e }); log(e.message ?? JSON.stringify(e)); };

    /**
     * ⛓ J2 — the Playback Bot's walker. It is asked for this tick's keys
     * INSIDE `tick`, so the walk runs on the page's one clock; while it holds
     * no goal (or is paused) the keyboard drives, exactly as in J1.
     */
    const walkListeners = new Set();
    /**
     * ⛓ solver-walk S1 — the solver mode (`flashPanel.seedlingSolverWalk`,
     * OFF by default; `playback.setSolverWalk`). The walker consults it first;
     * off, every tick is exactly the J2/J3 walk.
     */
    const solver = createRuntimeSolver({
        getSession: () => session,
        getLevelSource: () => roomSource()?.source ?? null,
        placementOf: (goal) => locationEntityOf(roomRecord(goal.level), goal.tag, goal.entityType ?? null),
        isMounted: () => mounted !== null,
        onEvent: (e) => note({ type: 'solver', solver: e.type, message: e.message }),
    });
    /** ⛓ S1 — `instant`: play the solver's planned keys in one burst (a page tick each). */
    let instant = false;
    let bursting = false;
    const walker = createRuntimeWalker({
        solver,
        apItemOf: (level, tag) => (mounted?.apItems.get(level) ?? []).find((a) => a.tag === tag) ?? null,
        // ⛓ J3 — a real room's location is an ENTITY of the room (a chest, a
        // pickup), walked to its own stance; an apitem is still the J1 row.
        locationPointOf: (goal) => {
            // ⛔ A mounted set's locations are its apitems ONLY (validateGoal's rule).
            if (mounted) {
                const a = (mounted.apItems.get(goal.level) ?? []).find((x) => x.tag === goal.tag);
                return a ? { x: (a.rect.x + a.rect.right) / 2, y: (a.rect.y + a.rect.bottom) / 2 } : null;
            }
            return locationPointOf(locationEntityOf(roomRecord(goal.level), goal.tag, goal.entityType ?? null));
        },
        isCollected: (level, tag) => collected.has(`${level}:${tag}`) || reportedClears.has(`${level}:${tag}`),
        onEvent: (e) => {
            note({ type: 'walk', state: e.state, message: `[js runtime] ${walker.describe()}` });
            for (const fn of walkListeners) { try { fn(e); } catch (err) { log(`[js runtime] a walk listener threw: ${err.message}`); } }
        },
    });

    // ── the run ────────────────────────────────────────────────────────────

    /** The room source a boot reads: a delivered set first, else the vanilla map. */
    const roomSource = () => mounted ?? vanilla;
    function roomRecord(level) { return roomSource()?.records.get(level) ?? null; }

    /**
     * Carry what the run cleared into the next boot. ⛓ J3: every in-band
     * ledger, not `earnedClears` alone — a chest's open is BANKED
     * (`levelRun.bankedClears`), and in a real room the next visit must find
     * it despawned, as the game's persistence array does. An out-of-band
     * write (a −1 tag) is reported but never carried: no entity reads it,
     * and `buildLevelWorld` refuses such a clear.
     */
    function bankClears() {
        if (!session) return;
        const run = session.run;
        for (const c of [...(run.earnedClears ?? []), ...(run.ledger?.('bankedClears') ?? []),
            ...(run.ledger?.('appliedTimedClears') ?? [])]) {
            if (Number.isInteger(c.tag) && c.tag >= 0) carried.set(`${c.level}:${c.tag}`, { level: c.level, tag: c.tag });
        }
    }

    /** ⛓ J3 — fold what the run GAINED in play (a vanilla pickup) into the flags, before it is replaced. */
    function foldGainedItems() {
        const inv = session?.run?.inventory ?? null;
        if (!inv || !bootItems) return;
        for (const prop of Object.keys(flags)) {
            if (!(prop in inv)) continue;
            if (typeof flags[prop] === 'number') {
                if (Number(inv[prop]) > Number(bootItems[prop] ?? 0)) flags[prop] = Math.max(flags[prop], Number(inv[prop]));
            } else if (inv[prop] === true && bootItems[prop] !== true) {
                flags[prop] = true;
            }
        }
    }

    function boot({ level, x, y }, why) {
        const src = roomSource();
        if (!src) throw new Error('jsRuntimeCore: no level set is mounted and no vanilla map is loaded — nothing to boot');
        if (!src.records.has(level)) {
            throw new Error(`jsRuntimeCore: the ${mounted ? 'mounted set' : 'vanilla map'} has no level ${level} `
                + `(it has ${src.records.size} rooms)`);
        }
        bankClears();
        foldGainedItems();
        const staging = bootStaging({ boot: { level, x, y }, items: { ...flags }, pins: [...JS_RUNTIME_PINS] });
        staging.persistence = [...carried.values()].map((c) => ({ ...c }));
        bootItems = { ...flags };
        try {
            session = createManualSession({ levelSource: src.source, staging, name: 'js-runtime', scratchPersistence: !!mounted });
        } catch (err) {
            // ⛓ J3 — a real level the model cannot BUILD (an entity it refuses
            // by name) halts the page by name, the same as a refusal mid-play.
            session = null;
            halted = { tick: ticks, level, message: err.message };
            note({ type: 'halt', level, message: `[js runtime] HALTED — the model refused to boot level ${level}: `
                + `${err.message.split('\n')[0]}` });
            return null;
        }
        halted = null;
        deferredReboot = false;
        note({ type: 'boot', level, x, y, why, message: `[js runtime] boot level ${level} at (${x}, ${y}) — ${why}` });
        return session;
    }

    function teleport(args) {
        const [rawLevel, rawX, rawY] = Array.isArray(args) ? args : [];
        let level = Number(rawLevel);
        let x = Number(rawX);
        let y = Number(rawY);
        if (!mounted && !vanilla) {
            // ⛓ J3 — the page fetches the map document beside the host's own
            // load; a teleport that wins the race is held, not dropped.
            heldTeleport = args;
            note({ type: 'held', message: '[js runtime] teleport held — no level set is mounted and the vanilla '
                + 'map is not loaded yet' });
            return;
        }
        if (!Number.isInteger(level) || level < 0) {
            // The game's own new-game arm: `level < 0` starts at the set's
            // start — on the vanilla map, `Main.as:51`'s `new Game(0, 80, 128)`.
            ({ level, x, y } = mounted ? mounted.set.start : BUILD_SPAWN);
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            note({ type: 'refused', message: `[js runtime] teleport refused — no position in ${JSON.stringify(args)}` });
            return;
        }
        arrival = { level, x, y };
        boot(arrival, 'teleport (new Game)');
    }

    /** The teleporter of `world` the box stood in, preferring one that goes to `to`. */
    function firedTeleporter(world, box, to) {
        const tps = world?.teleporters ?? [];
        return tps.find((tp) => !tp.deactivated && tp.to === to && overlaps(tp.rect, box))
            ?? tps.find((tp) => !tp.deactivated && overlaps(tp.rect, box))
            ?? null;
    }

    function apItemContact(level, box) {
        for (const a of mounted?.apItems.get(level) ?? []) {
            const key = `${level}:${a.tag}`;
            if (a.tag >= 0 && collected.has(key)) continue;
            if (!overlaps(a.rect, box)) continue;
            if (a.tag >= 0) collected.add(key);
            pendingCheck = `${++pendingCheckSeq}|${level}|${a.tag}|0`;
            note({ type: 'check', level, tag: a.tag, message: `[js runtime] apitem collected — level ${level} tag ${a.tag}` });
            return a;
        }
        return null;
    }

    /**
     * One movement tick. `held` is a Set of tape key names. ⛓ S1 — in
     * `instant` mode a tick that leaves the solver mid-plan plays the rest of
     * the plan at once (each key set a full page tick: checks, crossings and
     * reports exactly as on the clock).
     */
    function tick(held = new Set()) {
        const out = tickOnce(held);
        if (!instant || bursting || !solver.planning) return out;
        bursting = true;
        let burst = 0;
        try {
            // Bounded by the plan in hand when the burst began; the next clock tick resumes the rest.
            for (let n = solver.remaining; n > 0 && solver.planning && !halted && walker.state === WALK_STATES.WALKING; n -= 1) {
                tickOnce(new Set());
                burst += 1;
            }
        } finally {
            bursting = false;
        }
        return { ...out, burst };
    }

    function tickOnce(held) {
        drainQueue();
        if (!session || halted) { flush(); return { stepped: false }; }
        if (deferredReboot && !session.run.inCeremony) rebootInPlace('an item flag changed');
        const run = session.run;
        const level0 = run.level;
        const world0 = run.world;
        const box0 = playerBoxAt(run.state.x, run.state.y);
        const n0 = run.transitions.length;
        const inCeremony0 = Boolean(run.inCeremony);
        const walkHeld = walker.heldFor(run);
        // ⛓ S1 — the solver's plan already presses every ceremony X; the page must not add one.
        const { held: drive } = session.heldFor(walkHeld ?? held, { autoAdvanceText: !walker.solverDriving });
        const deaths0 = run.playerDeaths.length;
        try {
            session.step(drive);
        } catch (err) {
            halted = { tick: ticks, message: err.message };
            note({ type: 'halt', message: `[js runtime] HALTED — the model refused: ${err.message.split('\n')[0]}` });
            flush();
            return { stepped: false, halted };
        }
        const modelDeaths = run.playerDeaths;
        if (modelDeaths.length > deaths0) {
            // The model died and restarted the room itself (the game's
            // `die()` → restart); the page only reports it.
            const d = modelDeaths[modelDeaths.length - 1];
            const kind = d.source;
            ticks += 1;
            arrival = { level: run.level, ...run.worldCtor };
            deaths.push({ t: ticks, level: level0, kind, respawn: d.respawn ? { ...d.respawn } : null });
            note({ type: 'death', kind, level: level0, message: `[js runtime] death (${kind}) in level ${level0} — `
                + 'the model restarted the room the game\'s way' });
            walker.observe({ death: kind });
            flush();
            return { stepped: true, death: kind };
        }
        ticks += 1;
        let crossing = null;
        if (run.transitions.length > n0) {
            const tr = run.transitions[run.transitions.length - 1];
            const tp = firedTeleporter(world0, box0, tr.to_level);
            if (tp) {
                const type = exitTypeAt(roomRecord(tr.from_level), tp.x, tp.y);
                pendingExit = `${++pendingExitSeq}|${tr.from_level}|${type}|${Math.trunc(tp.x)}|${Math.trunc(tp.y)}|${tr.to_level}`;
                crossing = { from: tr.from_level, to: tr.to_level, x: tp.x, y: tp.y, type };
            }
            arrival = { level: run.level, ...run.worldCtor };
            note({ type: 'transition', from: tr.from_level, to: tr.to_level, teleporter: !!tp,
                message: `[js runtime] level ${tr.from_level} → ${tr.to_level}${tp ? ` through the teleporter at (${tp.x}, ${tp.y})` : ' (no teleporter — a fall)'}` });
        } else if (!inCeremony0 && run.level === level0) {
            // `Pickup.update` collides against the position the previous tick
            // left (`World.addUpdate` prepends; the Player is added first).
            apItemContact(level0, box0);
        }
        reportClears(run);
        walker.observe({ crossing });
        flush();
        return { stepped: true, crossing };
    }

    /**
     * ⛓ J3 — one `pendingCheck` per persistence slot the run newly cleared,
     * each FLUSHED as its own report: two clears in one tick would otherwise
     * collapse into one changed value and the first would be lost.
     */
    function reportClears(run) {
        for (const c of liveClears(run)) {
            const k = `${c.level}:${c.tag}`;
            if (reportedClears.has(k)) continue;
            reportedClears.add(k);
            pendingCheck = `${++pendingCheckSeq}|${c.level}|${c.tag}|0`;
            note({ type: 'check', level: c.level, tag: c.tag, clear: true,
                message: `[js runtime] persistence cleared — level ${c.level} tag ${c.tag}` });
            flush();
        }
    }

    function rebootInPlace(why) {
        const run = session.run;
        // The player's tick-0 state is the ctor args plus the half tile.
        const half = 8;
        const keep = arrival;
        boot({ level: run.level, x: run.state.x - half, y: run.state.y - half }, why);
        arrival = keep;
    }

    // ── the host's verbs ───────────────────────────────────────────────────

    function aliasClass(alias) { return aliases.get(alias) ?? alias; }

    function applyItem(item) {
        if (item?.invocation === 'new_instance') {
            if (item.className === GAME) teleport(item.args);
            else note({ type: 'ignored', message: `[js runtime] new_instance ${item.className} is not modelled` });
            return;
        }
        if (item && typeof item.property === 'string' && 'value' in item) {
            const cls = aliasClass(item.class);
            if (cls === GAME && item.property === 'menu') { menu = Boolean(item.value); return; }
            if (cls === MAIN && item.property in flags) {
                const value = typeof ITEM_FLAGS[item.property] === 'number' ? Number(item.value) : Boolean(item.value);
                if (flags[item.property] !== value) {
                    flags[item.property] = value;
                    if (session) deferredReboot = true;
                }
                return;
            }
        }
        note({ type: 'ignored', message: `[js runtime] queue item not modelled: ${JSON.stringify(item)}` });
    }

    function drainQueue() {
        const items = queue;
        queue = [];
        for (const item of items) applyItem(item);
        if (deferredReboot && session && !session.run.inCeremony && !halted) rebootInPlace('an item flag changed');
    }

    function valueOf(cls, property) {
        const run = session?.run ?? null;
        if (cls === MAIN) {
            if (property === 'level') return run ? run.level : -1;
            if (property === 'playerPositionX') return run ? run.worldCtor.x : 0;
            if (property === 'playerPositionY') return run ? run.worldCtor.y : 0;
            if (property in flags) {
                // ⛓ J3 — the host's write, or what the run picked up itself.
                const live = run?.inventory?.[property];
                if (typeof flags[property] === 'number') return Math.max(flags[property], Number.isFinite(live) ? live : 0);
                return flags[property] || live === true;
            }
        }
        if (cls === GAME) {
            if (property === 'pendingExit') return pendingExit;
            if (property === 'pendingCheck') return pendingCheck;
            if (property === 'keyMask') {
                let mask = 0;
                for (const k of run?.keys ?? []) mask |= (1 << k);
                return mask;
            }
            if (property === 'totemCount') return (run?.saveState?.totem_parts ?? []).filter(Boolean).length;
            if (property === 'menu') return menu;
        }
        return undefined;
    }

    function readAll() {
        const out = {};
        for (const p of config?.state_properties ?? []) {
            const v = valueOf(aliasClass(p.class), p.property);
            if (v !== undefined) out[p.property] = v;
        }
        return out;
    }

    /** Report every declared property that changed, in declaration order. */
    function flush() {
        if (!config) return [];
        const out = [];
        for (const p of config.state_properties ?? []) {
            const v = valueOf(aliasClass(p.class), p.property);
            if (v === undefined) continue;
            if (!baselineOwed && reported.has(p.property) && reported.get(p.property) === v) continue;
            reported.set(p.property, v);
            out.push([p.property, v]);
        }
        baselineOwed = false;
        for (const [prop, v] of out) {
            try { onStateChanged?.(prop, v); } catch (e) { log(`[js runtime] onStateChanged threw: ${e.message}`); }
        }
        return out;
    }

    function configure(json) {
        let parsed;
        try { parsed = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return `error:${e.message}`; }
        if (!parsed || !Array.isArray(parsed.state_properties)) return 'error:configure needs state_properties';
        config = parsed;
        aliases = new Map(Object.entries(parsed.classes ?? {}).map(([alias, c]) => [alias, c?.name ?? alias]));
        reported = new Map();
        baselineOwed = true;
        return 'ok';
    }

    function botLoadLevels(json) {
        let chunk;
        try { chunk = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) {
            staged = null;
            return `error:chunk is not JSON (${e.message})`;
        }
        if (!chunk || typeof chunk.set_id !== 'string' || !Number.isInteger(chunk.chunk_index)
            || !Number.isInteger(chunk.chunk_count)) {
            staged = null;
            return 'error:a chunk needs set_id, chunk_index and chunk_count';
        }
        if (!staged || staged.set_id !== chunk.set_id) staged = { set_id: chunk.set_id, count: chunk.chunk_count, chunks: new Map() };
        staged.chunks.set(chunk.chunk_index, chunk);
        if (staged.chunks.size < staged.count) return 'pending';
        const all = [...staged.chunks.values()].sort((a, b) => a.chunk_index - b.chunk_index);
        staged = null;
        const res = assembleLevelSetChunks(all);
        if (!res.ok) {
            levelSetError = res.errors.join('; ');
            return `error:${levelSetError}`;
        }
        try {
            mount(res.set);
        } catch (e) {
            levelSetError = e.message;
            return `error:${e.message}`;
        }
        return 'ok';
    }

    function mount(set) {
        const records = new Map();
        const apItems = new Map();
        for (const room of set.rooms) {
            const record = recordOfRoom(room);
            records.set(room.id, record);
            apItems.set(room.id, apItemsOf(record));
        }
        bankClears();
        mounted = { set, records, apItems, source: levelSourceFromAtlas(records) };
        // A new set is a new save: what the old one cleared means nothing here.
        carried.clear();
        collected.clear();
        reportedClears.clear();
        session = null;
        arrival = null;
        halted = null;
        levelSetError = null;
        walker.setGoal(null);
        note({ type: 'mount', message: `[js runtime] level set ${set.set_id} mounted — ${set.rooms.length} room(s)` });
        flush();
    }

    /**
     * ⛓ J3 — the vanilla map document (`flashPanel/atlases/seedling-map.json`,
     * `{levels: [...]}`, or an already-indexed Map). Mounting it changes no
     * running room; a teleport held for it is replayed now.
     */
    function setVanilla(doc) {
        const records = indexLevels(doc);
        if (!(records instanceof Map) || records.size === 0) throw new Error('jsRuntimeCore: setVanilla needs a map document with levels');
        vanilla = { records, source: levelSourceFromAtlas(records) };
        note({ type: 'vanilla', message: `[js runtime] vanilla map loaded — ${records.size} level(s)` });
        if (mounted || session) return;
        if (heldTeleport) {
            const args = heldTeleport;
            heldTeleport = null;
            teleport(args);
        } else {
            // ⛓ The wasm game's own first frame: `Main.as:51` builds
            // `new Game(0, 80, 128)` on an empty save. That level-0 report is
            // the region binding's BASELINE, the signal that releases its
            // queued arrival teleport — without it an atlas world (which
            // delivers nothing and resets nothing) would wait forever.
            arrival = { ...BUILD_SPAWN };
            boot(arrival, 'the game\'s own first frame (Main.as:51)');
        }
        flush();
    }

    /**
     * ⛓ J2 — a goal the host controller resolved, checked against the MOUNTED
     * set before it is accepted: `{ok:true}` or `{ok:false, reason}`. The
     * level must be a mounted room; a location must be one of its apitems; an
     * exit must be one of its teleporters (by `.oel` cell).
     */
    function validateGoal(goal) {
        if (!mounted && !vanilla) return { ok: false, reason: 'no level set is mounted' };
        if (!goal || !['location', 'exit', 'tile'].includes(goal.kind)) {
            return { ok: false, reason: `not a walk goal: ${JSON.stringify(goal)}` };
        }
        const record = roomRecord(goal.level);
        if (!record) return { ok: false, reason: `the ${mounted ? 'mounted set' : 'vanilla map'} has no level ${goal.level}` };
        if (goal.kind === 'location') {
            if ((mounted?.apItems.get(goal.level) ?? []).some((a) => a.tag === goal.tag)) return { ok: true };
            // ⛓ J3 — a real room's location: the entity holding the tag.
            if (!mounted && locationEntityOf(record, goal.tag, goal.entityType ?? null)) return { ok: true };
            return { ok: false, reason: mounted ? `level ${goal.level} has no apitem with tag ${goal.tag}`
                : `level ${goal.level} has no ${goal.entityType ?? 'entity'} with tag ${goal.tag}` };
        }
        // ⛓ J3 — an exit may name a SET of boundary cells (`tiles`); `tile` is the one-cell form.
        const tiles = goalTiles(goal);
        if (tiles.length === 0 || tiles.some(([tx, ty]) => !Number.isInteger(tx) || !Number.isInteger(ty))) {
            return { ok: false, reason: `no tile in ${JSON.stringify(goal)}` };
        }
        if (goal.kind === 'exit' && !tiles.some(([tx, ty]) => (record.entities ?? []).some((e) => EXIT_TYPES.includes(e.type)
            && Math.floor(e.x / 16) === tx && Math.floor(e.y / 16) === ty))) {
            return { ok: false, reason: `level ${goal.level} has no teleporter on ${tiles.length === 1
                ? `tile (${tiles[0][0]}, ${tiles[0][1]})` : `any of the tiles ${JSON.stringify(tiles)}`}` };
        }
        return { ok: true };
    }

    const playback = {
        walkTo(goal) {
            const v = validateGoal(goal);
            if (!v.ok) {
                note({ type: 'walk-refused', message: `[js runtime] walkTo refused — ${v.reason}` });
                return v;
            }
            walker.setGoal(goal);
            return v;
        },
        play() { instant = false; walker.play(); },
        stop() { instant = false; walker.stop(); },
        step() { walker.step(); },
        reset() { instant = false; walker.reset(); },
        /** ⛓ S1 — play; with the solver mode on, a solved plan plays in one burst. */
        instant() { instant = true; walker.play(); },
        /** ⛓ S1 — the solver mode (`flashPanel.seedlingSolverWalk`). */
        setSolverWalk(on) { solver.enabled = Boolean(on); },
        get solverWalk() { return solver.enabled; },
        get solverStats() { return solver.stats; },
        get state() { return walker.state; },
        get reason() { return walker.reason; },
        get goal() { return walker.goal; },
        get playing() { return walker.playing; },
        get stats() { return walker.stats; },
        describe: () => walker.describe(),
        /** `fn(event)` on every walk state change; returns the unsubscribe. */
        onWalk(fn) { walkListeners.add(fn); return () => walkListeners.delete(fn); },
        STATES: WALK_STATES,
    };

    const game = {
        wireCheck: () => 'ok:seedling-js',
        // ⛓ J3 — NO flush here: BridgeGeneric reports from its per-frame poll
        // (`BridgeGeneric.as:192-216`), so the first burst lands on the frame
        // AFTER configure — after the host has `attach()`ed, which is what lets
        // `WasmBridgeAdapter` forward it. Flushed synchronously, the burst was
        // DROPPED (the adapter is attached only after `configureBridge` returns)
        // and the region binding never saw its baseline: measured, an atlas
        // world's arrival was released by the player's first crossing instead.
        configure: (json) => configure(json),
        readState: () => (config ? JSON.stringify(readAll()) : 'error:not configured'),
        botStatus: () => JSON.stringify({
            runtime: 'js',
            level: session ? session.run.level : -1,
            time: ticks,
            ticks,
            x: session ? session.run.state.x : null,
            y: session ? session.run.state.y : null,
            deaths: deaths.length,
            halted: halted ? halted.message : null,
        }),
        botMobiles: () => JSON.stringify({
            mobiles: session ? [{ cls: 'Player', x: session.run.state.x, y: session.run.state.y }] : [],
        }),
        botLoadLevels: (json) => botLoadLevels(json),
        botLevelSet: () => JSON.stringify({
            vanilla: vanilla ? vanilla.records.size : 0,
            active: mounted?.set.set_id ?? null,
            mounted: mounted?.set.set_id ?? null,
            table_levels: mounted ? mounted.set.rooms.length : 0,
            rooms: mounted ? mounted.set.rooms.length : 0,
            start_level: mounted?.set.start?.level ?? null,
            error: levelSetError,
        }),
    };

    return {
        game,
        /** ⛓ J2 — the Playback Bot's verbs (the host controller calls these). */
        playback,
        /** `__swfBridge.queueItems` — drained on the next tick, like `getItemQueue`. */
        queueItems(items) {
            if (items == null) return;
            for (const it of Array.isArray(items) ? items : [items]) queue.push(it);
        },
        tick,
        flush,
        setVanilla,
        get vanilla() { return vanilla; },
        get session() { return session; },
        get run() { return session?.run ?? null; },
        get mounted() { return mounted; },
        get arrival() { return arrival ? { ...arrival } : null; },
        get flags() { return { ...flags }; },
        get collected() { return new Set(collected); },
        get deaths() { return deaths.map((d) => ({ ...d })); },
        get events() { return events.slice(); },
        get halted() { return halted; },
        get ticks() { return ticks; },
        get configured() { return config !== null; },
        /** The current room's record and its uncollected apitems, for the painter. */
        view() {
            if (!session) return null;
            const level = session.run.level;
            return {
                level,
                world: session.run.world,
                state: session.run.state,
                apItems: (mounted?.apItems.get(level) ?? []).filter((a) => !collected.has(`${level}:${a.tag}`)),
            };
        },
    };
}
