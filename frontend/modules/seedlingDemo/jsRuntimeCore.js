/**
 * seedlingDemo/jsRuntimeCore — **THE SEEDLING JS RUNTIME, SPEAKING THE WASM
 * PAGE'S CONTRACT** (Seedling JS runtime arc, slice J1).
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
 *    ⛓ §5.18 — they are STATICS: a level-set mount does not touch them, so
 *    with no run (after a mount) they still read the last constructor's args
 *    (`lastCtor`), never 0. `Main.level` reads −1 there, as measured on the
 *    wasm game (`seedlingRegionBinding`'s G2 note).
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
 *  · `queueItems` items are drained once per tick (`getItemQueue`'s cadence;
 *    and on each dead frame the page holds, `drainItems`):
 *    `{class, property, value}` flag writes, `{class:'game', property:'menu'}`
 *    (accepted, nothing to do), and the teleport recipe
 *    `{invocation:'new_instance', className:'Game', args:[level, x, y]}`
 *    → a fresh run booted at those constructor args; ⛓ KEY DELIVERY: and
 *    the key setter `{invocation:'method_call', path:[{class:'Main'}],
 *    method:'hasKeySet', args:[i, true]}` → the session's key. Every boot
 *    stages the session's keys (`save.keys`) and the last run's slot order
 *    (`inventory_slots`, `primary`), so a teleport, a Restart or an item
 *    reboot keeps both, as the game's statics do. ⛓ SEAL DELIVERY: and the
 *    fill setters `hasSealPartSet(slot, identity)` / `hasTotemPartSet(i, true)`
 *    → the session's seal log / totem parts, staged into every boot's
 *    `save.seal_parts` / `save.totem_parts` and read back by the declared
 *    `path_reads` (`sealSlot<i>`, `totemPart<i>`).
 *  · `botLoadLevels` answers `'pending'` per chunk and `'ok'` on the last;
 *    `botLevelSet` reads back `{active, table_levels, start_level}`
 *    (`levelSetDisagreement.READBACK_FIELDS`).
 *  · ⛓ PHASE B — the TAPE verbs (`Bot.as` `botLoadTape` :912, `botStart` :1658,
 *    `botStatus` :2027, `botDrain` :2870): a tape is parsed and staged, booted
 *    through the same `boot()` with its declaration (`declared`), driven per
 *    tick in place of the keyboard and the walker (`tapeRecordThenAct`, the
 *    armed loop :3232-3335), and drained in `diffObservationStreams`'
 *    vocabulary. ⛔ `tape.armed` is the one switch: unarmed, every tick is
 *    the pre-Phase-B tick (`jsRuntimeTape.test.js`'s identity chain).
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
 *  · ⛓ solver-walk S3 (⚖ Q4, the user, 2026-10-02) — EVERY room is booted
 *    on `scratchPersistence`, the vanilla 116 as well as a delivered
 *    GENERATED set (J1). The page's run has no tape behind it, so nobody owns
 *    a kill lock's slot and the model's own arithmetic writes the clear
 *    (`levelRun` `firePendingKillLockThrows`) at the tick the game's
 *    `Lock.turnOff()` would — where J3 halted by name ("OPENS 1 kill lock …
 *    DECLARES no clear"). The clear is REPORTED (`liveClears`, the run's
 *    `scratchClears`) as the game reports it — `Lock.as:96` →
 *    `Game.setPersistence(tag, false)` → `pendingCheck "…|0"`; the host's
 *    placement table, not the page, decides it is no location — and CARRIED
 *    into the next boot. The model's remaining refusals on real levels HALT
 *    the page BY NAME — the HALT roster (plan, J3 + S3 as-builts).
 *  · Items the PLAYER picks up in a real room (a vanilla sword) are the
 *    run's own: `Main.*` reports the host's flag OR the run's live inventory,
 *    and a re-boot folds what the run GAINED into the flags first.
 *  · ⛓ solver-walk §5.18 (⚖ the user, 2026-10-03: the JS runtime takes the
 *    VANILLA delivery, WITH THE SOLVER) — a mounted set is one of TWO kinds
 *    (`mountedKindOf`, read off the set's own provenance): GENERATED rooms
 *    or REAL rooms delivered by the vanilla arm (the 116 rewritten only at
 *    their AP locations). Either kind's locations are its APITEMS (the
 *    solver's `collect-placement` resolves one as strategy `apitem`, F2).
 *  · ⛓ solver-walk §5.36 (⚖ the user: the SOLVER for everything, not the
 *    walker) — BOTH kinds are driven by the solver, exactly alike: the kind
 *    is reported (`botLevelSet().kind`), it picks no producer. A decline is
 *    named and the walker walks that goal instead, as on the vanilla map.
 */

import { createManualSession } from './watchManual.js';
import { TOGGLE_KEYS, createInventoryMenu, inventoryMenuFrame } from './inventoryMenu.js';
import { bootStaging } from './procgenOracle.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { assembleLevelSetChunks } from './levelSetValidator.js';
import { buildLevelWorld, ENTITY_CLASSES, entityRect, STAIRS_TAGS, tagOf } from './levelWorld.js';
import { chestStanceBand } from './chest.js';
import { HITBOX } from './playerPhysicsV1.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { BUILD_SPAWN, heldKeysAt, INVENTORY_ITEM_IDS, ITEM_PROPERTIES, parseTape, SAVE_SLOTS } from './tapeFormat.js';
import { stagingFromTape } from './tapeRunner.js';
import { createRuntimeWalker, goalTiles, WALK_STATES } from './jsRuntimeWalker.js';
import { createRuntimeSolver } from './jsRuntimeSolver.js';
import { VANILLA_RECORD_SET_ID_BASE } from './levelSetExporter.js';
import { encounterReportServed, locationGoalServed } from './wasmPlayback.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';
import { ENCOUNTER_EXECUTORS } from './solverBot.js';

/**
 * ⛓ ENCOUNTER LEGS — the CHECK of an encounter location: the fixed report address of the `R7_GOAL_LEDGER`
 * `kind: 'encounter'` row in the goal's level, `{level, tag}`, or null (no such row: the encounter is unbound).
 * L32's Bob Boss → {32,4}, L12's Witch → {12,1}. That clear IS the game's own check on a `bossreport` build
 * (R4, vendor/seedling `ccdf189776`): `Pickups/Fire.as:49-55` — `removed()` is `setPersistence(tag, false)` alone
 * (tag = `BOSS_DROP_TAG` 4), and `Pickups/DarkSword.as:49-57` — `if (checkPersistence(tag)) setPersistence(tag,
 * false)` (tag = `WITCH_TAG` 1); neither sets `Player.hasFire` / `hasDarkSword` any more (`apReportBosses.js`'s head).
 * So the row's `flag` (`hasFire`, `hasDarkSword`) is NOT the check: on that build only the host's grant writes it
 * (`seedlingCheckBinding`'s R4b part 2 head), and reading it would check the location off the server's item.
 * ⚠ Not `wasmPlayback.encounterReportAddresses`: that also names the KILL {32,3} (the `Times` boss row), which is
 * another location — the Bob Boss location is the drop.
 */
export function encounterCheckAddress(goal) {
    if (goal?.kind !== 'location' || !goal.encounter) return null;
    const row = R7_GOAL_LEDGER.find((r) => r.kind === 'encounter' && r.level === goal.level && r.address);
    return row ? { level: row.address.level, tag: row.address.tag } : null;
}

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

/** ⛓ PHASE B — the `Main.*` item properties of an inventory, in `ITEM_FLAGS` order (`Bot.as:2690` `itemReadout`'s fourteen). */
const pickItems = (inv) => Object.fromEntries(Object.keys(ITEM_FLAGS).map((k) => [k, k in inv ? inv[k] : ITEM_FLAGS[k]]));

/**
 * ⛓⛓ PHASE B — **THE TAPE VERBS' REFUSALS THE WASM GAME DOES NOT HAVE**, said by name. `hold` (v12, the P4E latch
 * hold) is a wasm build capability the JS runtime does not declare; a halt is the JS model refusing mid-tape.
 */
export const JS_TAPE_REFUSALS = Object.freeze({
    hold: 'error:hold is not modelled by the JS runtime (no `hold` capability)',
    halted: (message) => `error:the JS model halted — ${message}`,
});

/** The class aliases `games/seedling.json` declares, by the AS3 name they resolve to. */
const MAIN = 'Main';
const GAME = 'Game';

const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

/** The `exitType`s a `Teleporter` reports (`Teleporter.as:35`, `Stairs.as:25`). */
export const EXIT_TYPES = Object.freeze(['teleporter', ...STAIRS_TAGS]);

/**
 * The `why` of a boot note for a REBOOT IN PLACE (`rebootInPlace`: an item flag, a key, a seal part). The game
 * builds no new world for one (a `Main.*` write), so no load fade either: the page's painter reads it off
 * `events` to tell such a run from a `new Game` (graphics G7).
 */
export const IN_PLACE_REBOOT_WHY = 'an item flag changed';

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
    // ⛓ S3 — a kill lock's clear the scratch layer wrote (`Lock.turnOff()`'s own write in the game).
    for (const c of run.scratchClears ?? []) add(c.level, c.tag);
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
 * ⛓ solver-walk §5.18 — WHAT A MOUNTED SET'S ROOMS ARE. The page receives
 * only chunks, but chunk 0 carries the set's metadata, and a set the vanilla
 * arm delivered names the vanilla record set it rewrote
 * (`apPlacementRewriter.rewriteRecordSet`: `provenance.derived_from.set_id`
 * = `seedling-vanilla-record-<hash>`). That is the positive evidence of REAL
 * rooms; anything else is GENERATED (a set that says nothing is not
 * promoted to real rooms on a guess). ⛓ §5.36 — a REPORT only: both kinds
 * are the solver's (`jsRuntimeSolver.solverGoalFor` asks no kind).
 */
export const MOUNTED_KINDS = Object.freeze({ GENERATED: 'generated', REAL: 'real' });
export function mountedKindOf(set) {
    const from = set?.provenance?.derived_from?.set_id;
    return typeof from === 'string' && from.startsWith(`${VANILLA_RECORD_SET_ID_BASE}-`)
        ? MOUNTED_KINDS.REAL : MOUNTED_KINDS.GENERATED;
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
 * @param {object|null} [opts.solveService]  ⛓ solver-walk S2 — where the
 *   solver mode's solves run: the page passes its module Worker
 *   (`jsRuntimeSolveService.createWorkerSolveService`); null (node) solves in
 *   place, as S1 did.
 * @param {number} [opts.solverBudgetWork]  ⛓ DETERMINISTIC BUDGET — one solve's budget, in work units
 * @param {number} [opts.solverUpgradeWindowWork]  the full pass's dash deadline, in work units (null = the budget)
 * @param {number} [opts.solverBackstopMs]  the wall-clock backstop (a named failure, never an answer)
 */
export function createJsRuntime({ onStateChanged = null, log = () => {}, solveService = null, solverBudgetWork = undefined,
    solverUpgradeWindowWork = undefined, solverBackstopMs = undefined } = {}) {
    let config = null;
    /** alias -> AS3 class name, from `configure`'s `classes`. */
    let aliases = new Map();
    let reported = new Map();
    let baselineOwed = false;

    const flags = { ...ITEM_FLAGS };
    /**
     * ⛓ KEY DELIVERY — the session's KEYS (`Main.SAVE_FILE.data.hasKey`): the host's `Main.hasKeySet(i, true)`
     * calls (an AP key) ∪ what a run picked up itself (a vanilla `BossKey`). Merged, never cleared (the game
     * never takes a key back), and staged into every boot's `save.keys`. A new mounted set is a new save.
     */
    const heldKeys = new Set();
    /**
     * ⛓ SEAL DELIVERY — the session's SEAL LOG (`Main.SAVE_FILE.data.hasSealPart`: slot → identity, -1 empty) and
     * TOTEM PARTS (`hasTotemPart`): the host's `Main.hasSealPartSet(slot, identity)` / `hasTotemPartSet(i, true)`
     * calls (an AP Seal / Totem Shard) ∪ what a run collected itself (a chest's seal slot, a `BossTotemPart`).
     * Never cleared but by a new mounted set; staged into every boot's `save.seal_parts` / `save.totem_parts`.
     */
    const sealSlots = Array.from({ length: SAVE_SLOTS.seal_parts }, () => -1);
    const heldTotems = new Set();
    /** The run whose opened chests were last folded into `sealSlots`, and how many. */
    let sealsFolded = { run: null, earned: 0 };
    let menu = true;
    let queue = [];

    let staged = null;          // { set_id, count, chunks: Map(index -> chunk) }
    let mounted = null;         // { set, kind, records: Map(level -> record), source, apItems: Map(level -> [...]) }
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
    /**
     * ⛓ §5.18 — the last `new Game` constructor's (x, y): `Main.playerPositionX/Y`
     * are statics the constructor writes, and nothing else does. MEASURED (the
     * vanilla-map probe's J, before this): the mount nulled the run, the page
     * reported (0, 0), the region binding took that as the game's boot position,
     * and the vanilla arm's reset (a start with no position) put the player at
     * (0, 0) — inside `tree@0,0`, the P1-e run-4 trap.
     */
    let lastCtor = null;
    /** The constructor args the CURRENT room was entered with — the respawn point. */
    let arrival = null;
    /** "level:tag" persistence slots earned by previous runs, carried into the next. */
    const carried = new Map();
    /** "level:tag" apitems collected (their slot is cleared). */
    const collected = new Set();
    let deferredReboot = false;
    /**
     * ⛓⛓ PHASE B — THE TAPE, as `Bot.as` holds it (`loaded`/`armed`/`finished`/`tick`/`tickCount`, the observation
     * buffer and its base). ⛔ `armed` is the ONE switch the no-tape path reads: while it is false every tick is the
     * walker's/keyboard's, byte for byte as before (the identity pin in `jsRuntimeTape.test.js`).
     */
    const tape = { loaded: null, staging: null, armed: false, finished: false, tick: 0, tickCount: 0, error: '',
        obs: [], obsBase: 0 };

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
     * off, every tick is exactly the J2/J3 walk. ⛓ S2 — with a `solveService`
     * (the page's Worker) a solve is in flight across page ticks; those
     * ticks HOLD the run (`tickOnce`: drained, flushed, not stepped).
     */
    const solver = createRuntimeSolver({
        solveService,
        ...(solverBudgetWork !== undefined ? { budgetWork: solverBudgetWork } : {}),
        ...(solverUpgradeWindowWork !== undefined ? { upgradeWindowWork: solverUpgradeWindowWork } : {}),
        ...(solverBackstopMs !== undefined ? { backstopMs: solverBackstopMs } : {}),
        getSession: () => session,
        getLevelSource: () => roomSource()?.source ?? null,
        getRecords: () => roomSource()?.records ?? null,
        placementOf: (goal) => locationEntityOf(roomRecord(goal.level), goal.tag, goal.entityType ?? null),
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
            // ⛓ EVENT GOALS — the leg is the solver's `clear-tag`; the walk's own point (only walked on a decline) is the
            // presser when the flag is pressed from this room (cross-room), else the obstacle's cell.
            if (goal.event) return goal.event.presser ?? goal.event.at;
            // ⛓ ENCOUNTER LEGS — the leg is the solver's `encounter`; the point is the location's atlas tile.
            if (goal.encounter) return goal.encounter.at ?? null;
            // ⛔ A mounted set's locations are its apitems ONLY (validateGoal's rule).
            if (mounted) {
                const a = (mounted.apItems.get(goal.level) ?? []).find((x) => x.tag === goal.tag);
                return a ? { x: (a.rect.x + a.rect.right) / 2, y: (a.rect.y + a.rect.bottom) / 2 } : null;
            }
            return locationPointOf(locationEntityOf(roomRecord(goal.level), goal.tag, goal.entityType ?? null));
        },
        isCollected: (level, tag) => collected.has(`${level}:${tag}`) || reportedClears.has(`${level}:${tag}`),
        // ⛓ EVENT GOALS — an event leg completes the wasm runtime's way: `wasmPlayback.locationGoalServed` over the
        // game's cleared slots (`botStatus().persistence_cleared` — this page's `persistenceCleared()`), never on the
        // plan finishing. Any other location keeps the J2/J3 check.
        // ⛓ ENCOUNTER LEGS — an encounter completes on ITS OWN report address (`encounterCheckAddress`: the drop's
        // pickup clearing {32,4} / {12,1}), read off the same cleared table, never on the plan finishing.
        locationServed: (goal) => (goal.event ? locationGoalServed(goal, { persistence_cleared: persistenceCleared() })
            : goal.encounter ? encounterServed(goal)
            : collected.has(`${goal.level}:${goal.tag}`) || reportedClears.has(`${goal.level}:${goal.tag}`)),
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
            ...(run.ledger?.('appliedTimedClears') ?? []), ...(run.scratchClears ?? [])]) {
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

    /** ⛓ KEY DELIVERY — fold the keys the run holds (picked up in play included) into the session's. */
    function foldGainedKeys() {
        for (const k of session?.run?.keys ?? []) if (Number.isInteger(k)) heldKeys.add(k);
        foldGainedSaves();
    }

    /** ⛓ SEAL DELIVERY — the seal log's filled prefix (the save-array spelling). */
    function sealLog() {
        const firstEmpty = sealSlots.indexOf(-1);
        return firstEmpty === -1 ? [...sealSlots] : sealSlots.slice(0, firstEmpty);
    }

    /**
     * ⛓ SEAL DELIVERY — fold what the run collected itself into the session's arrays: its totem parts, and one
     * seal slot per chest it OPENED (`saveState.sealSlotsEarned`). The model cannot know which identity the game's
     * sampler drew (`levelRun.saveState`), so this page draws the smallest the log does not hold — the same rule
     * as an AP seal (`saveArrayRules`, log-append). Idempotent.
     */
    function foldGainedSaves() {
        const ss = session?.run?.saveState ?? null;
        if (!ss) return;
        (ss.totem_parts ?? []).forEach((v, i) => { if (v) heldTotems.add(i); });
        // Only the chests opened since the last fold of THIS run: a host seal written meanwhile is not one of them.
        const earned = ss.sealSlotsEarned ?? 0;
        const before = sealsFolded.run === session.run ? sealsFolded.earned : 0;
        sealsFolded = { run: session.run, earned };
        for (let n = before; n < earned; n += 1) {
            const log = sealLog();
            if (log.length >= SAVE_SLOTS.seal_parts) break;
            let id = 0;
            while (log.includes(id)) id += 1;
            sealSlots[log.length] = id;
        }
    }

    /**
     * ⛓ KEY DELIVERY — the run's SLOT ORDER and selected slot, carried into the next boot (§5.27: the game's
     * `Inventory.items` is static, so a host teleport, a Restart or an item-flag reboot keeps it). A slot whose
     * item the flags no longer hold is DROPPED (the model refuses such a slot, `inventorySlotsRefusal`; the game
     * would keep it — an item REMOVED from the inventory, the one case where the two part). No previous run
     * (the first boot, a new mounted set) = a fresh game's, as before.
     */
    function carriedSlots() {
        const run = session?.run ?? null;
        if (!run || !Array.isArray(run.inventorySlots)) return null;
        const flagOf = Object.fromEntries(Object.entries(INVENTORY_ITEM_IDS)
            .map(([name, id]) => [id, ITEM_PROPERTIES[name].property]));
        // (`foldGainedItems` ran first: a weapon picked up in play is in the flags already.)
        const slots = run.inventorySlots.filter((id) => flags[flagOf[id]] === true);
        return { slots, primary: Number.isInteger(run.primary) ? run.primary : 0,
            // ⛓ seedling-js-inventory-menu: `Main.secondary` / `Main.firstUse` are save data, and survive a boot too.
            secondary: Number.isInteger(run.secondary) ? run.secondary : 0, firstUse: run.firstUse === true };
    }

    function boot({ level, x, y }, why, { playerDamage = null, declared = null } = {}) {
        const src = roomSource();
        if (!src) throw new Error('jsRuntimeCore: no level set is mounted and no vanilla map is loaded — nothing to boot');
        if (!src.records.has(level)) {
            throw new Error(`jsRuntimeCore: the ${mounted ? 'mounted set' : 'vanilla map'} has no level ${level} `
                + `(it has ${src.records.size} rooms)`);
        }
        bankClears();
        foldGainedItems();
        foldGainedKeys();
        const slots = carriedSlots();
        // The constructor writes the statics before it builds anything (a room the model refuses included).
        lastCtor = { x, y };
        // ⛓ PHASE B — a TAPE's boot (`botStart`) stages the tape's own declaration and nothing of the session's: the
        // game's `botStart` resets the persistence table and the save arrays to a fresh start and applies only what the
        // tape declares (`Bot.as:1708-1772`, ⚖ ruling 25). Absent (every other caller), the staging below is unchanged.
        const staging = declared ? { ...declared } : bootStaging({ boot: { level, x, y }, items: { ...flags }, pins: [...JS_RUNTIME_PINS] });
        if (!declared) stageSession(staging, slots, playerDamage);
        bootItems = { ...flags };
        try {
            // ⛓ PHASE B — a tape's staging runs AS DECLARED (`declared`, no `solveStaging`: `runTape`'s own
            // construction). ⚠ `scratchPersistence` stays ON for it too, and that is MEASURED: the frame is handed the
            // GAME-VISIBLE projection (`gameVisibleTape` drops v9's kill-lock `at` rows — what the game does on its
            // own), so, like the game, the frame must compute those clears itself. Off, 14 committed kill-lock tapes
            // halted by name ("OPENS 1 kill lock … DECLARES no clear"); on, all 202 that load agree with `runTape`.
            session = createManualSession({ levelSource: src.source, staging, name: 'js-runtime', scratchPersistence: true,
                declared: Boolean(declared) });
        } catch (err) {
            // ⛓ J3 — a real level the model cannot BUILD (an entity it refuses
            // by name) halts the page by name, the same as a refusal mid-play.
            session = null;
            halted = { tick: ticks, level, message: err.message };
            note({ type: 'halt', level, message: `[js runtime] HALTED — the model refused to boot level ${level}: `
                + `${err.message.split('\n')[0]}` });
            return null;
        }
        // ⛓ PHASE B — what the tape's run was booted holding is the baseline a later fold measures GAINED against.
        if (declared) bootItems = { ...flags, ...pickItems(session.run.inventory ?? {}) };
        halted = null;
        deferredReboot = false;
        note({ type: 'boot', level, x, y, why, message: `[js runtime] boot level ${level} at (${x}, ${y}) — ${why}` });
        return session;
    }

    /** The session's own state, staged into a non-tape boot (unchanged from before Phase B; hoisted only). */
    function stageSession(staging, slots, playerDamage) {
        staging.persistence = [...carried.values()].map((c) => ({ ...c }));
        // ⛓ KEY DELIVERY — the session's keys and slot order survive every boot (teleport, Restart, item reboot).
        staging.save = { ...staging.save, keys: [...heldKeys].sort((a, b) => a - b) };
        // ⛓ SEAL DELIVERY — and its seal log and totem parts (only when it holds any: a run without stays byte-identical).
        if (heldTotems.size) staging.save.totem_parts = [...heldTotems].sort((a, b) => a - b);
        if (sealLog().length) staging.save.seal_parts = sealLog();
        if (slots) {
            staging.inventory_slots = slots.slots;
            staging.seam = { ...(staging.seam ?? {}), primary: slots.primary };
            // Only when they differ from what the boot derives (0; and `firstUse` re-derives itself from two slots),
            // so a session that never touched the menu stages exactly what it did before.
            if (slots.secondary > 0 && slots.secondary < slots.slots.length) staging.seam.secondary = slots.secondary;
            if (slots.firstUse && slots.slots.length < 2) staging.seam.first_use = true;
        }
        // ⛓ STAGEDHITS CONSUMER — an in-place reboot keeps the game's `Player` (an item flag rebuilds no world), so
        // its damage is STAGED (`playerDamage.stagedPlayerDamage`); absent everywhere else (a new `Player`, 0 hits).
        if (playerDamage) staging.player_damage = playerDamage;
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

    /**
     * ⛓⛓ seedling-js-inventory-menu — THE V MENU, HELD BY THE CORE (fidelity-15's W0 ACK).
     *
     * `Inventory.set open` is `Game.freezeObjects`, so while the menu is up every frame is a Bot DEAD frame: the
     * tape does not advance and the room is HELD here (no `session.step`, as `solverHolding` holds it), while the
     * menu's own `Inventory.update` runs each frame (`inventoryMenu.inventoryMenuFrame`). The opening frame is a LIVE
     * one (`inventory.update()` runs in the frame's tail), so the open edge is read after that frame's step; every
     * later frame through the closing one is held, and the close hands the run its frames (`run.inventoryHold`).
     *
     * V and I never reach the run or the tape (they drive nothing else under the Bot: `Help(0)` needs
     * `Inventory.help`, which the Bot clears). An X or C that went down during a hold is MASKED until released: its
     * `Input.pressed` edge fired on a dead frame, where `Mobile.input` never ran, and must not fire again on the
     * first live tick. The arrows are not masked (`Input.check`, not an edge). Only a hand-driven tick opens it;
     * a walk or a solve never presses V.
     */
    const invMenu = createInventoryMenu();
    let menuHeldFrames = 0;
    let menuPrevHeld = new Set();
    const menuMasked = new Set();
    const MENU_EDGE_KEYS = Object.freeze(['primary', 'secondary']);
    /**
     * `extended` (`offsetMax.x` 0, not -23: the side tab) goes true at the first `Inventory.update` with `firstUse` and
     * the conch, the feather or a totem part (`Inventory.as:178-181`); the help it would raise is the Bot's off.
     */
    const menuCtxFor = (run) => {
        const inv = run.inventory ?? {};
        const totems = run.saveState?.totem_parts ?? [];
        return { openable: run.inventoryOpenable, firstUse: run.firstUse, slotCount: run.inventorySlots.length,
            extended: run.firstUse && (inv.canSwim === true || inv.hasFeather === true || totems.some(Boolean)) };
    };
    const menuWrites = (run, writes) => {
        for (const w of writes) {
            try {
                run.inventoryMenuWrite(w);
                note({ type: 'inventory', write: w, message: `[js runtime] inventory: ${w.kind === 'primary' ? 'X' : 'C'} `
                    + `→ slot ${w.slot} (item ${run.inventorySlots[w.slot]})` });
            } catch (err) {
                note({ type: 'inventory', refused: err.message, message: `[js runtime] inventory write refused — ${err.message}` });
            }
        }
    };
    const releasedSince = (held) => {
        const released = new Set([...menuPrevHeld].filter((k) => !held.has(k)));
        menuPrevHeld = new Set(held);
        for (const k of [...menuMasked]) if (!held.has(k)) menuMasked.delete(k);
        return released;
    };
    /** The keys the run sees: no V/I, and no masked X/C. */
    const menuStripped = (held) => {
        if (!TOGGLE_KEYS.some((k) => held.has(k)) && menuMasked.size === 0) return held;
        return new Set([...held].filter((k) => !TOGGLE_KEYS.includes(k) && !menuMasked.has(k)));
    };
    /** One HELD frame (the menu is up): the menu's update, and on the closing frame the hold is spent. */
    function menuHeldTick(run, released, held) {
        menuHeldFrames += 1;
        const r = inventoryMenuFrame(invMenu, released, menuCtxFor(run));
        menuWrites(run, r.writes);
        if (!invMenu.open) {
            const frames = menuHeldFrames;
            menuHeldFrames = 0;
            try {
                run.inventoryHold(frames);
            } catch (err) {
                halted = { tick: ticks, message: err.message };
                note({ type: 'halt', message: `[js runtime] HALTED — the model refused the inventory hold: ${err.message.split('\n')[0]}` });
            }
            for (const k of MENU_EDGE_KEYS) if (held.has(k)) menuMasked.add(k);
            note({ type: 'inventory', closed: true, frames, message: `[js runtime] inventory closed after ${frames} frozen frame(s)` });
        }
        flush();
        return { stepped: false, inventory: true };
    }
    /** The live frame's tail: `inventory.update()` (the open edge, and the slide). */
    function menuLiveTail(run, released) {
        const ctx = menuCtxFor(run);
        if (!ctx.openable && TOGGLE_KEYS.some((k) => released.has(k)) && run.firstUse) {
            note({ type: 'inventory', refused: run.inventoryRefusal,
                message: `[js runtime] the inventory menu cannot open here — ${run.inventoryRefusal}` });
        }
        const r = inventoryMenuFrame(invMenu, released, ctx);
        if (r.toggled && invMenu.open) {
            note({ type: 'inventory', opened: true, message: '[js runtime] inventory opened (the room is held)' });
        }
        menuWrites(run, r.writes);
    }

    function tickOnce(rawHeld) {
        drainQueue();
        if (!session || halted) { flush(); return { stepped: false }; }
        // ⛓ PHASE B — an item delivery's in-place reboot WAITS while a tape is armed (it would replace the tape's run
        // mid-stream; the game's flag write rebuilds nothing), and lands on the first tick after the tape finishes.
        if (deferredReboot && !tape.armed && !session.run.inCeremony && !encounterHoldsDelivery()) rebootInPlace(IN_PLACE_REBOOT_WHY);
        const run = session.run;
        // ⛓ PHASE B — the tape's keys for this tick, or null: no tape armed (every tick before Phase B), or the tape
        // finished on THIS frame (the game's frame still updates — `Bot.as:3330-3333` returns to `super.update()`).
        const tapeHeld = tape.armed ? tapeRecordThenAct(run) : null;
        // (`heldFor` is asked ONCE per tick — the walker's contract — and reused below.) ⛔ Not asked on a tape tick:
        // the tape drives in place of the walker and the keyboard, and the walker is never told a tape tick happened.
        const walkHeld = tapeHeld ? null : walker.heldFor(run);
        const manual = !tapeHeld && !walker.solverDriving && walkHeld === null;
        const released = releasedSince(rawHeld);
        if (invMenu.open) {
            if (manual) return menuHeldTick(run, released, rawHeld);
            // a walk or solve took over: the game would still hold, but nothing here presses V; close it now
            invMenu.open = false;
            run.inventoryHold(Math.max(menuHeldFrames, 1));
            menuHeldFrames = 0;
        }
        const held = menuStripped(rawHeld);
        const level0 = run.level;
        const world0 = run.world;
        const box0 = playerBoxAt(run.state.x, run.state.y);
        const n0 = run.transitions.length;
        const inCeremony0 = Boolean(run.inCeremony);
        if (!tapeHeld && walker.solverHolding) {
            // ⛓ S2 — a solve is in flight: the room is HELD (the run does not
            // step, so the plan is played from the state it was solved from);
            // the host's queue was drained above and the reports still flush.
            flush();
            return { stepped: false, solving: true };
        }
        // ⛓ S1 — the solver's plan already presses every ceremony X; the page must not add one.
        // ⛓ PHASE B — a tape tick steps EXACTLY the tape's keys (`runTape`'s `run.advance(heldKeysAt(t, tick))`): no
        // ceremony auto-advance, which `runTape` does not add either.
        const { held: drive } = tapeHeld ? { held: tapeHeld }
            : session.heldFor(walkHeld ?? held, { autoAdvanceText: !walker.solverDriving });
        const deaths0 = run.playerDeaths.length;
        try {
            session.step(drive);
        } catch (err) {
            halted = { tick: ticks, message: err.message };
            note({ type: 'halt', message: `[js runtime] HALTED — the model refused: ${err.message.split('\n')[0]}` });
            // ⛓ PHASE B — a halted tape FINISHES with the refusal as its error (a poll that waited on `finished` for
            // ever would read as a slow tape); its drain holds what was recorded, and the verdict says the rest.
            if (tapeHeld) Object.assign(tape, { armed: false, finished: true, error: JS_TAPE_REFUSALS.halted(err.message.split('\n')[0]) });
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
            if (!tapeHeld) walker.observe({ death: kind });
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
            } else if (run.transports.some((f) => f.t === tr.t && f.from_level === tr.from_level)) {
                // ⛓ S4 — a pit FALL (`levelRun`'s `kind: 'fall'` transport): a crossing for the walk
                // (a pit exit completes on it), and NO pendingExit — the game writes one only in
                // `Teleporter.update()` (`Teleporter.as:107`); the host reads the level move.
                crossing = { from: tr.from_level, to: tr.to_level, type: 'pit' };
            }
            arrival = { level: run.level, ...run.worldCtor };
            note({ type: 'transition', from: tr.from_level, to: tr.to_level, teleporter: !!tp,
                message: `[js runtime] level ${tr.from_level} → ${tr.to_level}${tp ? ` through the teleporter at (${tp.x}, ${tp.y})` : ' (no teleporter — a fall)'}` });
        } else if (!inCeremony0 && run.level === level0) {
            // `Pickup.update` collides against the position the previous tick
            // left (`World.addUpdate` prepends; the Player is added first).
            apItemContact(level0, box0);
        }
        // ⛓ seedling-js-inventory-menu: the frame's tail, `inventory.update()` — after the step, as the game runs it.
        if (manual) menuLiveTail(run, released);
        reportClears(run);
        if (!tapeHeld) walker.observe({ crossing });
        flush();
        return { stepped: true, crossing };
    }

    // ── ⛓⛓ PHASE B — the tape, `Bot.as`'s armed loop over the JS run ──────────────────────────────────────────────

    /**
     * One armed frame's bookkeeping, `Bot.as:3232-3335` — RECORD, then act: the observation is the state the
     * previous tick left (observation t = the state after t completed ticks), then this tick's keys. On the tick that
     * reaches `tick_count` the final observation is recorded and the tape disarms WITHOUT consuming a tick
     * (`Bot.as:3291-3333`); null is returned and the frame goes on as an ordinary one. `heldKeysAt` is the span rule
     * `runTape` reads, so a span `[from, to)` is held exactly where the model holds it.
     * @returns {Set<string>|null}
     */
    function tapeRecordThenAct(run) {
        tape.obs.push({ x: run.state.x, y: run.state.y, level: run.level });
        if (tape.tick >= tape.tickCount) {
            tape.armed = false;
            tape.finished = true;
            note({ type: 'tape', finished: true, message: `[js runtime] tape finished at tick ${tape.tick}` });
            return null;
        }
        const held = heldKeysAt(tape.loaded, tape.tick);
        tape.tick += 1;
        // A tape tick with no key down is still a TAPE tick: the empty Set drives (truthy), the walker does not.
        return held;
    }

    /**
     * `botLoadTape` — `Bot.as:912-1636`. Parse, gate the version EXACTLY as the game gates it (`Bot.as:921-924`: 9, 10
     * and 11 are model-only and refused — a caller hands the game-visible projection, `gameVisibleTape`), validate
     * through the one parser (`parseTape`, whose own refusals stand in for `botLoadTape`'s field checks), refuse
     * what the JS runtime cannot do (`JS_TAPE_REFUSALS.hold`), and STAGE the boot (`stagingFromTape`). Loading
     * disarms and clears the buffer (`Bot.as:1610-1628`). `'ok'` or `'error:…'`, the game's vocabulary.
     */
    function botLoadTape(json) {
        let raw;
        try { raw = JSON.parse(json); } catch (err) { return `error:${err.message}`; }
        const version = Math.trunc(Number(raw?.tape_version));
        if (!(version >= 1) || (version > 8 && version !== 12)) {
            return `error:tape_version must be 1, 2, 3, 4, 5, 6, 7, 8 or 12, got ${raw?.tape_version}`;
        }
        let parsed;
        try { parsed = parseTape(raw); } catch (err) { return `error:${err.message}`; }
        if (parsed.hold) return JS_TAPE_REFUSALS.hold;
        Object.assign(tape, { loaded: parsed, staging: stagingFromTape(parsed), armed: false, finished: false,
            tick: 0, tickCount: parsed.tick_count, error: '', obs: [], obsBase: 0 });
        note({ type: 'tape', loaded: true, message: `[js runtime] tape loaded — ${parsed.name ?? 'unnamed'}, `
            + `${parsed.tick_count} tick(s), boot L${parsed.boot.level} (${parsed.boot.x}, ${parsed.boot.y})` });
        return 'ok';
    }

    /**
     * `botStart` — `Bot.as:1658-1937`. ⛔ Through the SAME `boot()` every other boot takes, with the tape's staging
     * DECLARED (fresh persistence and save arrays plus what the tape declares — `Bot.as:1708-1772`). ⚠ ALWAYS a
     * rebuild: the game skips one when it already stands at the boot (`Bot.as:1843-1846`, the continuation path), and
     * the JS frame has no continuation — the lab refuses a multi-window JS ship by name. Tick 0 is the next live frame
     * (the page's own fade frames are dead frames it holds, as the game's `blackCover` frames are).
     */
    function botStart() {
        if (!tape.loaded) return 'error:no tape loaded';
        if (tape.armed) return 'error:already running';
        const { boot: b } = tape.loaded;
        if (invMenu.open) { invMenu.open = false; menuHeldFrames = 0; }
        arrival = { level: b.level, x: b.x, y: b.y };
        const booted = boot(arrival, `tape ${tape.loaded.name ?? 'unnamed'} (botStart)`, { declared: tape.staging });
        if (!booted) return JS_TAPE_REFUSALS.halted(halted?.message?.split('\n')[0] ?? 'the boot was refused');
        Object.assign(tape, { armed: true, finished: false, tick: 0, error: '', obs: [] });
        flush();
        return 'ok';
    }

    /** `botDrain` — `Bot.as:2870-2886`: the buffer since the last drain, `t` from its base; then cleared, base kept. */
    function botDrain() {
        const ticksOut = tape.obs.map((o, i) => ({ t: tape.obsBase + i, x: o.x, y: o.y, level: o.level }));
        tape.obsBase += tape.obs.length;
        tape.obs = [];
        return JSON.stringify({ ticks: ticksOut, transitions: [] });
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

    /**
     * ⛓ OBSTACLE EVENTS — every slot cleared so far, `[{level, tag}]` sorted: what earlier runs carried, the live
     * run's clears, and the collected apitems (the game clears their slot too).
     */
    /** ⛓ ENCOUNTER LEGS — whether the encounter's own report address is in the game's cleared table. */
    function encounterServed(goal) {
        const a = encounterCheckAddress(goal);
        return !!a && persistenceCleared().some((c) => c.level === a.level && c.tag === a.tag);
    }

    function persistenceCleared() {
        const all = new Map(carried);
        for (const k of collected) {
            const [level, tag] = k.split(':').map(Number);
            all.set(k, { level, tag });
        }
        for (const c of session ? liveClears(session.run) : []) all.set(`${c.level}:${c.tag}`, { level: c.level, tag: c.tag });
        return [...all.values()].map((c) => ({ level: c.level, tag: c.tag })).sort((a, b) => a.level - b.level || a.tag - b.tag);
    }

    /**
     * ⛓ STAGEDHITS CONSUMER — the run's damage as a staging's `player_damage` (fidelity wave 14): on this page the
     * run IS the game, and the game keeps its `Player` through an item-flag reboot. null when the player carries
     * none (0 hits, no i-frame, no parked facing): the staging stays byte-identical to a fresh `Player`'s.
     */
    function carriedDamage(run) {
        const d = run.damage;
        if (!(d.hits > 0 || d.hitsTimer > 0 || d.directionFace !== -1)) return null;
        return { hits: d.hits, hits_timer: d.hitsTimer, direction_face: d.directionFace };
    }

    function rebootInPlace(why) {
        const run = session.run;
        // The player's tick-0 state is the ctor args plus the half tile.
        const half = 8;
        const keep = arrival;
        boot({ level: run.level, x: run.state.x - half, y: run.state.y - half }, why, { playerDamage: carriedDamage(run) });
        arrival = keep;
    }

    // ── the host's verbs ───────────────────────────────────────────────────

    function aliasClass(alias) { return aliases.get(alias) ?? alias; }

    function applyItem(item) {
        // ⛓ KEY DELIVERY — `Main.hasKeySet(i, true)` (games/seedling.json's method-call keys): the session gains
        // the key and the room is rebooted in place, as for an item flag (a key is read at BUILD: a held key's
        // `BossKey` removes itself). A `false` is never sent (the adapter never clears) and is not modelled.
        if (item?.invocation === 'method_call' && aliasClass(item.path?.[0]?.class) === MAIN
            && item.method === 'hasKeySet' && Number.isInteger(item.args?.[0]) && item.args?.[1] === true) {
            const k = item.args[0];
            if (!heldKeys.has(k) && !(session?.run?.keys?.has?.(k))) {
                heldKeys.add(k);
                if (session) deferredReboot = true;
            } else heldKeys.add(k);
            return;
        }
        // ⛓ SEAL DELIVERY — `Main.hasSealPartSet(slot, identity)` / `Main.hasTotemPartSet(i, true)` (games/seedling.json's
        // FILL items): the setter's own write (a slot / an index), then a reboot in place, as for a key (a chest reads
        // `hasAllSealParts` at BUILD — `Chest.checkBySeal`; a `BossTotemPart` its index). A clear is never sent.
        if (item?.invocation === 'method_call' && aliasClass(item.path?.[0]?.class) === MAIN
            && item.method === 'hasSealPartSet' && Number.isInteger(item.args?.[0]) && Number.isInteger(item.args?.[1])
            && item.args[0] >= 0 && item.args[0] < SAVE_SLOTS.seal_parts && item.args[1] >= 0) {
            foldGainedSaves();
            if (sealSlots[item.args[0]] !== item.args[1]) {
                sealSlots[item.args[0]] = item.args[1];
                if (session) deferredReboot = true;
            }
            return;
        }
        if (item?.invocation === 'method_call' && aliasClass(item.path?.[0]?.class) === MAIN
            && item.method === 'hasTotemPartSet' && Number.isInteger(item.args?.[0]) && item.args?.[1] === true
            && item.args[0] >= 0 && item.args[0] < SAVE_SLOTS.totem_parts) {
            foldGainedSaves();
            if (!heldTotems.has(item.args[0])) {
                heldTotems.add(item.args[0]);
                if (session) deferredReboot = true;
            }
            return;
        }
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
        if (deferredReboot && session && !session.run.inCeremony && !halted && !encounterHoldsDelivery()) {
            rebootInPlace(IN_PLACE_REBOOT_WHY);
        }
    }

    /**
     * ⛓ ENCOUNTER LEGS — an encounter leg's OWN reports (the kill {32,3}, the drop {32,4}) deliver their items mid-leg,
     * and those are the leg SUCCEEDING, not news: the item's reboot in place waits until the leg settles. Measured
     * (CI 40541497513): L32's Times report delivered its Seal (`hasSealPartSet`) at the kill, the page rebooted in
     * place and the solver's plan was refuted (2/0/1). The game does not rebuild the room for a delivery, and the wasm
     * runtime's delivery gate waits on the same predicate (`wasmPlayback.encounterReportServed`, R7 24fe0309d2).
     */
    function encounterHoldsDelivery() {
        const goal = walker.state === WALK_STATES.WALKING ? walker.goal : null;
        return !!goal?.encounter && encounterReportServed(goal, { persistence_cleared: persistenceCleared() });
    }

    function valueOf(cls, property) {
        const run = session?.run ?? null;
        if (cls === MAIN) {
            if (property === 'level') return run ? run.level : -1;
            if (property === 'playerPositionX') return run ? run.worldCtor.x : (lastCtor?.x ?? 0);
            if (property === 'playerPositionY') return run ? run.worldCtor.y : (lastCtor?.y ?? 0);
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
                for (const k of [...heldKeys, ...(run?.keys ?? [])]) mask |= (1 << k);
                return mask;
            }
            if (property === 'totemCount') {
                foldGainedSaves();
                return heldTotems.size;
            }
            if (property === 'menu') return menu;
        }
        return undefined;
    }

    // ⛓ W5 — a declared property this page cannot answer (`valueOf` → undefined)
    // is SKIPPED by `readAll` and `flush`, exactly as BridgeGeneric skips one a
    // build cannot read: today the Moonrock's `beam` / `rockSet`, which
    // `games/seedling.json` declares for the wasm arrival staging and which this
    // page does not carry across room boots.
    function readAll() {
        const out = {};
        for (const p of config?.state_properties ?? []) {
            const v = valueOf(aliasClass(p.class), p.property);
            if (v !== undefined) out[p.property] = v;
        }
        for (const p of config?.path_reads ?? []) {
            const v = valueOfPath(p.path);
            if (v !== undefined) out[p.name] = v;
        }
        return out;
    }

    /**
     * ⛓ SEAL DELIVERY — a declared `path_reads` row this page models: `Main.SAVE_FILE.data.<array>[i]` for the
     * seal log and the totem parts (games/seedling.json's per-slot readouts). Anything else is undefined (SKIPPED, as
     * BridgeGeneric skips a path it cannot resolve).
     */
    function valueOfPath(path) {
        if (!Array.isArray(path) || path.length !== 5) return undefined;
        const [c, so, d, arr, ix] = path;
        if (aliasClass(c?.class) !== MAIN || so?.property !== 'SAVE_FILE' || d?.property !== 'data' || !Number.isInteger(ix?.index)) return undefined;
        const i = ix.index;
        foldGainedSaves();
        if (arr?.property === 'hasSealPart') return i >= 0 && i < SAVE_SLOTS.seal_parts ? sealSlots[i] : undefined;
        if (arr?.property === 'hasTotemPart') return i >= 0 && i < SAVE_SLOTS.totem_parts ? heldTotems.has(i) : undefined;
        return undefined;
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
        // ⛓ SEAL DELIVERY — the declared path reads, after the properties (BridgeGeneric polls them first in a
        // frame; nothing here reads the order across the two lists).
        for (const p of config.path_reads ?? []) {
            const v = valueOfPath(p.path);
            if (v === undefined) continue;
            if (!baselineOwed && reported.has(p.name) && reported.get(p.name) === v) continue;
            reported.set(p.name, v);
            out.push([p.name, v]);
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
        // ⛓ §5.18 — the statics outlive the run (a door crossed in-run moved them since its boot).
        if (session) lastCtor = { x: session.run.worldCtor.x, y: session.run.worldCtor.y };
        mounted = { set, kind: mountedKindOf(set), records, apItems, source: levelSourceFromAtlas(records) };
        // A new set is a new save: what the old one cleared means nothing here (its keys included).
        carried.clear();
        heldKeys.clear();
        sealSlots.fill(-1);
        heldTotems.clear();
        collected.clear();
        reportedClears.clear();
        session = null;
        arrival = null;
        halted = null;
        levelSetError = null;
        walker.setGoal(null);
        note({ type: 'mount', kind: mounted.kind,
            message: `[js runtime] level set ${set.set_id} mounted — ${set.rooms.length} ${mounted.kind} room(s)` });
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

    /** ⛓ S4 — a vanilla room's pit tiles (`{tx, ty}`), off its record's own world; cached per level. */
    const pitTilesCache = new Map();
    function pitTilesOf(level, record) {
        if (!pitTilesCache.has(level)) {
            let pits = [];
            try {
                pits = buildLevelWorld(record).pitTiles.map((p) => ({ tx: p.tx, ty: p.ty }));
            } catch { /* a room the model cannot build has no pit to name; the walk refuses it on arrival */ }
            pitTilesCache.set(level, pits);
        }
        return pitTilesCache.get(level);
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
        if (goal.kind === 'location' && goal.encounter) {
            // ⛓ ENCOUNTER LEGS — the leg is the solver's `encounter` (`jsRuntimeSolver.solverGoalFor` →
            // `solverBot.ENCOUNTER_EXECUTORS`); its check is the encounter's own report address turning cleared
            // (`encounterCheckAddress`, `locationServed`). Each refusal is by name.
            const what = `"${goal.name ?? 'the location'}" is an ENCOUNTER (the ${goal.encounter.drop?.item} drop in level ${goal.level})`;
            if (!Object.hasOwn(ENCOUNTER_EXECUTORS, goal.encounter.drop?.item ?? '')) {
                return { ok: false, reason: `${what}: the solver has no encounter executor for that drop `
                    + `(it serves ${Object.keys(ENCOUNTER_EXECUTORS).join(', ')})` };
            }
            const address = encounterCheckAddress(goal);
            if (!address) {
                return { ok: false, reason: `${what}: level ${goal.level} has no encounter row with a fixed report address `
                    + '(R7_GOAL_LEDGER), so nothing here could tell its check fired' };
            }
            if (CONTACT_FIDELITY.apReportBosses !== true) {
                return { ok: false, reason: `${what}: its check is the report clear {${address.level},${address.tag}}, `
                    + 'which only the boss-report AS3 writes, and `CONTACT_FIDELITY.apReportBosses` is off' };
            }
            if (!solver.enabled) {
                return { ok: false, reason: `${what}: it is walked by the solver's encounter executor, and the solver `
                    + 'mode is off (`flashPanel.seedlingSolverWalk`)' };
            }
            return { ok: true };
        }
        if (goal.kind === 'location' && goal.event) {
            // ⛓ EVENT GOALS — the leg is the solver's `clear-tag` (`jsRuntimeSolver.solverGoalFor`, which refuses BY THE
            // SOLVER'S REASON: `wrong-level`, `no-verb`); its check is the game's persistence flag `goal.event.tag`
            // turning set (`locationServed`). Without the solver nothing here can clear a flag on purpose.
            if (!Number.isInteger(goal.event.tag?.level) || !Number.isInteger(goal.event.tag?.tag)) {
                return { ok: false, reason: `"${goal.name ?? 'the location'}" is a saved-obstacle EVENT that names no flag {level, tag}` };
            }
            if (!solver.enabled) {
                return { ok: false, reason: `"${goal.name ?? 'the location'}" is a saved-obstacle EVENT (clear-tag `
                    + `{${goal.event.tag.level},${goal.event.tag.tag}} ${goal.event.obstacle}): it is walked by the solver's `
                    + 'clear-tag, and the solver mode is off (`flashPanel.seedlingSolverWalk`)' };
            }
            return { ok: true };
        }
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
            && Math.floor(e.x / 16) === tx && Math.floor(e.y / 16) === ty))
            // ⛓ S4 — a PIT exit (`out_pit_*`): its cell is a pit tile of the room (⛓ §5.36 — any room, of any kind).
            && !tiles.some(([tx, ty]) => pitTilesOf(goal.level, record).some((p) => p.tx === tx && p.ty === ty))) {
            return { ok: false, reason: `level ${goal.level} has no teleporter or pit on ${tiles.length === 1
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
        /** ⛓ S2 — true while a solve is in flight (the room is held). */
        get solving() { return solver.solving; },
        /** ⛓ DETERMINISTIC BUDGET — one solve's budget, in work units (a test knob; the page reads `?solverBudgetWork=`). */
        get solverBudgetWork() { return solver.budgetWork; },
        setSolverBudgetWork(n) { solver.budgetWork = Number(n); },
        /**
         * The upgrade window, in work units (`flashPanel.seedlingSolverUpgradeWindowWork`, handed with every
         * goal; the page reads `?solverUpgradeWindowWork=`): null / non-positive = the whole budget.
         */
        get solverUpgradeWindowWork() { return solver.upgradeWindowWork; },
        setSolverUpgradeWindowWork(n) { solver.upgradeWindowWork = n; },
        /** The wall-clock backstop, in ms (a test knob; past it a goal FAILS by name, never plays). */
        get solverBackstopMs() { return solver.backstopMs; },
        setSolverBackstopMs(ms) { solver.backstopMs = Number(ms); },
        /** ⛓ S2 — the solve service (the page's worker; null = in place). */
        setSolveService(service) { solver.setSolveService(service); },
        get solveService() { return solver.solveService; },
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
            // ⛓ PLAY CLOCK — the wasm game's `game_time` (`Game.time`, one per `Game.update()`) is this model's step
            // count: what `flashPanel/seedlingPlayClock.js` reads on both runtimes. It stops where the run is not
            // stepped (no session, a halt, a solve in flight — `tickOnce`).
            game_time: ticks,
            x: session ? session.run.state.x : null,
            y: session ? session.run.state.y : null,
            deaths: deaths.length,
            // ⛓ STAGEDHITS CONSUMER — the player's damage, as the wasm game's `botStatus` names it (`Bot.as:2124-2125`),
            // so `playerDamage.playerDamageFromStatus` reads the same keys on both runtimes.
            hits: session ? session.run.damage.hits : 0,
            hits_timer: session ? session.run.damage.hitsTimer : 0,
            halted: halted ? halted.message : null,
            // ⛓ OBSTACLE EVENTS — the game's cleared persistence slots, as the wasm game's `botStatus` reports them
            // (`persistence_cleared`): what earlier runs carried + what this run cleared. The collector's load read.
            persistence_cleared: persistenceCleared(),
            // ⛓ PHASE B — the tape's readout, `Bot.as:2029-2069`'s names: `finished` is what the lab's poll waits on,
            // `tick`/`tick_count`/`buffered` the progress, `error` a halted tape's refusal, `items` `itemReadout`'s
            // fourteen (the run's live inventory; the host's flags with no run).
            loaded: tape.loaded !== null,
            armed: tape.armed,
            finished: tape.finished,
            error: tape.error,
            tick: tape.tick,
            tick_count: tape.tickCount,
            buffered: tape.obs.length,
            items: session ? pickItems(session.run.inventory ?? {}) : { ...flags },
        }),
        botLoadTape: (json) => botLoadTape(json),
        botStart: () => botStart(),
        botDrain: () => botDrain(),
        botMobiles: () => JSON.stringify({
            mobiles: session ? [{ cls: 'Player', x: session.run.state.x, y: session.run.state.y }] : [],
        }),
        botLoadLevels: (json) => botLoadLevels(json),
        botLevelSet: () => JSON.stringify({
            vanilla: vanilla ? vanilla.records.size : 0,
            active: mounted?.set.set_id ?? null,
            mounted: mounted?.set.set_id ?? null,
            // ⛓ §5.18 — `generated` | `real` (`mountedKindOf`), null with nothing mounted.
            kind: mounted?.kind ?? null,
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
        /**
         * ⛓ A DEAD FRAME'S POLL — the queue drained WITHOUT a tick. BridgeGeneric polls `getItemQueue` on its own
         * `ENTER_FRAME` (`flash-ap-api` `BridgeGeneric.as:117,224`), outside `Game.update`'s `blackCover` gate, so the
         * game takes the host's work on a load's dead frames too. The page calls this on each dead frame it HOLDS
         * (`jsRuntimePage.advance`); the run is not stepped, and the next tick's own drain finds what came after.
         */
        drainItems() { drainQueue(); },
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
        /** ⛓ seedling-js-inventory-menu: the V menu's state, for the page's draw (`inventoryMenu.js`). */
        get inventoryMenu() {
            return { open: invMenu.open, selected: invMenu.selected, offset: { ...invMenu.offset }, scale: invMenu.scale,
                textScale: [...invMenu.textScale], heldFrames: menuHeldFrames };
        },
        get ticks() { return ticks; },
        /** ⛓ PHASE B — the tape's state, for the page and the rows (`armed` is the no-tape path's one switch). */
        get tape() {
            return { loaded: tape.loaded !== null, armed: tape.armed, finished: tape.finished, tick: tape.tick,
                tickCount: tape.tickCount, buffered: tape.obs.length, error: tape.error };
        },
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
