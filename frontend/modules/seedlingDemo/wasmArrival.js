/**
 * seedlingDemo/wasmArrival — **A WASM ROOM ARRIVAL → A JS STAGING → A SOLVE
 * REQUEST** (solver-walk W1; plan `NewDocs/plans/seedling-js-solver-walk-plan.md`
 * §5.3 W1, with W0's corrections in §5.5). It PLAYS NOTHING: every input is a
 * read-only verb's answer.
 *
 *   1. DETECT. `isArrival(prev, seamEnvelope)` — an arrival is the
 *      `botSeam().beginEntry` record CHANGING (a new `Game.begin()` landed).
 *      ⛔ Never the `level` / `pendingExit` reports: for a host-issued swap
 *      those run one frame AHEAD of the landed world (W0 iii.2), and arming on
 *      them is the 12g race (W0 i.12).
 *   2. STAGE. `stagingFromWasmArrival({seam, status, state})` — the four
 *      PRE-BUILD rows from `beginEntry`, the rest from ONE `botStatus` read and
 *      the spawn from the bridge's `readState` (`botStatus` reports the live
 *      player, not `Main.playerPositionX/Y`). The envelope is handed to
 *      `segmentBootFromLatch` (`r7Acceptance.js`), so the latch→tape-block
 *      rules (the seal PREFIX, the one-frame-short clock, the zero refusals)
 *      are that function's and are not retyped here. All THREE save arrays are
 *      declared (W0 ii.5: an omitted array is WIPED by `botStart`) and the
 *      cleared set is `persistence_cleared` exactly (W0 ii.6/ii.7: a fake
 *      clear is a real check).
 *   3. REQUEST. `arrivalSolveRequest(...)` — the S2 solve service's request
 *      for a FRESH boot at the arrival: `perTick: []`, so no `prefix`
 *      admission is involved (§5.2 — the arrival IS the boot), and `live` is
 *      the fresh staged run's own digest (the shadow replay of zero ticks is
 *      the staging itself, so step 2's assertion is satisfied by construction).
 *
 * ── WHAT `botStatus` CANNOT SAY (§5.1) ───────────────────────────────────
 *
 * `ARRIVAL_FIELD_SOURCES` classifies every `SEAM_SIGNATURE` row by where an
 * arrival reads it; a signature row added tomorrow without a class THROWS here
 * by name (`assertArrivalCoverage`). The rows NO read-only verb carries are
 * `UNREAD`: they are left UNDECLARED in the staging's `seam` block (never
 * guessed), and `stagingFromWasmArrival` REFUSES by name when one of them is
 * read by the model (`SEAM_BOOT_SPEC[].modelled`) AND by an entity of the
 * room being staged (`UNREAD_MODELLED_READERS`) — today only the moonrock's
 * `beam` / `rockSet`. The others (`grassCut`, `firstUse`, `extended`, the
 * music pair) no physics reads; they matter only to a TAPE W2 ships (its
 * `seam` block must not declare what nobody read).
 *
 * ⛔ DOM-FREE and clock-free. No solver or model change.
 */

import { SEAM_BOOT_SPEC, SEAM_PREBUILD_FIELDS, SEAM_SIGNATURE, segmentBootFromLatch } from './r7Acceptance.js';
import { createRunForStaging } from './tapeRunner.js';
import { liveOf, solverGoalFor } from './jsRuntimeSolver.js';
import { goalTiles, nearestTeleporterAt } from './jsRuntimeWalker.js';
import { JS_RUNTIME_PINS, locationEntityOf } from './jsRuntimeCore.js';
import { ITEM_PROPERTIES, PIN_NAMES } from './tapeFormat.js';

/** Thrown for an arrival that cannot be staged — by name, never rounded. */
export class WasmArrivalError extends Error {
    constructor(message) { super(message); this.name = 'WasmArrivalError'; }
}
const refuse = (why) => { throw new WasmArrivalError(why); };

/** The thirteen boolean item flags (`health` → `hitsMax` is the one int, its own row). */
const ITEM_FLAGS = new Set(Object.values(ITEM_PROPERTIES).filter((p) => p.kind === 'boolean').map((p) => p.property));

/**
 * Where an arrival reads each `SEAM_SIGNATURE` field. `read(status, state)`
 * answers the latch's value from `botStatus` (parsed) or the bridge's
 * `readState`; a `beginEntry` row is read off `botSeam().beginEntry`.
 *
 *   beginEntry  a PRE-BUILD row (`SEAM_PREBUILD_FIELDS`) — `Game.begin()`'s entry
 *   status      `botStatus` (ONE read per arrival: 14–16 ms, W0)
 *   state       the bridge's `readState` (the spawn — `botStatus` has the live player)
 *   unread      no read-only verb carries it (a W5 seam row)
 *   invariant   a calm-arrival invariant; a boot block declares none of them
 *   excluded    the signature's own exclusion
 */
const fromStatus = (read) => ({ from: 'status', read });
const itemRow = (prop) => fromStatus((s) => s.items?.[prop]);
export const ARRIVAL_FIELD_SOURCES = Object.freeze({
    level: fromStatus((s) => s.level),
    playerPositionX: { from: 'state', read: (_s, st) => st?.playerPositionX },
    playerPositionY: { from: 'state', read: (_s, st) => st?.playerPositionY },
    ...Object.fromEntries([...ITEM_FLAGS].map((p) => [`save.${p}`, itemRow(p)])),
    'save.hitsMax': fromStatus((s) => s.items?.hitsMax),
    'save.primary': fromStatus((s) => s.primary),
    'save.secondary': fromStatus((s) => s.secondary),
    'save.hasKey': fromStatus((s) => s.save?.keys),
    'save.hasTotemPart': fromStatus((s) => s.save?.totem_parts),
    'save.hasSealPart': fromStatus((s) => s.save?.seal_parts),
    'save.levelPersistence': fromStatus((s) => s.persistence_cleared),
    'static.Game.cutscene': fromStatus((s) => s.cutscene),
    'static.Game.menuState': fromStatus((s) => s.menu_state),
    'static.Rng.split': fromStatus((s) => s.rng?.split),
    'static.Bot.pins': fromStatus((s) => s.pins),
    ...Object.fromEntries(SEAM_PREBUILD_FIELDS.map((f) => [f, { from: 'beginEntry' }])),
    'save.beam': { from: 'unread' },
    'save.rockSet': { from: 'unread' },
    'save.firstUse': { from: 'unread' },
    'save.extended': { from: 'unread' },
    'save.grassCut': { from: 'unread' },
    'static.Music.currentSet': { from: 'unread' },
    'static.Music.currentIndex': { from: 'unread' },
    'static.Game.shake': { from: 'invariant' },
    'static.Game.menu': { from: 'invariant' },
    'static.Game.freezeObjects': { from: 'invariant' },
    'static.Game.talking': { from: 'invariant' },
    'static.Game.inventory': { from: 'invariant' },
    'arrival.blackCover': { from: 'invariant' },
    'arrival.velocity': { from: 'invariant' },
    'save.hasBadge': { from: 'excluded' },
});

/**
 * Which room entities READ a modelled field no read-only verb carries
 * (`levelRun.js`: `moonrockBeam` / `moonrockSet` are read when a moonrock
 * visit builds). A room holding none of them stages without the field.
 */
export const UNREAD_MODELLED_READERS = Object.freeze({
    'save.beam': ['moonrock'],
    'save.rockSet': ['moonrock'],
});

/** Every signature row classified, every class known — or a throw naming the gap. */
export function assertArrivalCoverage() {
    const sig = SEAM_SIGNATURE.map((r) => r.field);
    const missing = sig.filter((f) => !ARRIVAL_FIELD_SOURCES[f]);
    const orphan = Object.keys(ARRIVAL_FIELD_SOURCES).filter((f) => !sig.includes(f));
    if (missing.length || orphan.length) {
        refuse(`wasmArrival: ARRIVAL_FIELD_SOURCES is out of step with SEAM_SIGNATURE — `
            + `unclassified ${JSON.stringify(missing)}, no such row ${JSON.stringify(orphan)}`);
    }
    for (const spec of SEAM_BOOT_SPEC) {
        const src = ARRIVAL_FIELD_SOURCES[spec.field]?.from;
        if (src === 'unread' && spec.modelled && !UNREAD_MODELLED_READERS[spec.field]) {
            refuse(`wasmArrival: \`${spec.field}\` is MODELLED and no read-only verb carries it, but `
                + 'UNREAD_MODELLED_READERS names no entity that reads it — a staging would leave it '
                + 'undeclared in every room');
        }
    }
    return true;
}
assertArrivalCoverage();

/** The fields an arrival cannot read (no verb carries them), in signature order. */
export const UNREAD_FIELDS = Object.freeze(SEAM_SIGNATURE.map((r) => r.field)
    .filter((f) => ARRIVAL_FIELD_SOURCES[f].from === 'unread'));

/**
 * Step 1 — did a new world LAND since `prevBeginEntry`? True iff the envelope
 * carries a `beginEntry` that differs from the previous one. ⛔ `null` →
 * a record is an arrival too (the first begin after a `clearLatch`).
 */
export function isArrival(prevBeginEntry, seamEnvelope) {
    const be = seamEnvelope?.beginEntry ?? null;
    if (!be) return false;
    return JSON.stringify(be) !== JSON.stringify(prevBeginEntry ?? null);
}

/**
 * The latch an arrival can assemble: `{envelope, unread}` — `envelope` is
 * `segmentBootFromLatch`'s input shape (`{latched, partial, beginEntry,
 * seam}`) carrying every READ field, `unread` the fields left out.
 *
 * @param {object} o
 * @param {object} o.seam    `botSeam()` parsed (only `beginEntry` is used)
 * @param {object} o.status  `botStatus()` parsed
 * @param {object} o.state   the bridge's `readState()` (the spawn)
 */
export function arrivalLatch({ seam, status, state }) {
    const beginEntry = seam?.beginEntry ?? null;
    if (!beginEntry) {
        refuse('wasmArrival: the botSeam envelope carries no `beginEntry` — no world has begun since the '
            + 'last `clearLatch` (a `botLoadTape` clears it: read botSeam FIRST), so there is no arrival to stage');
    }
    if (!status || typeof status !== 'object') refuse('wasmArrival: no botStatus readout to stage from');
    if (beginEntry['begin.level'] !== status.level) {
        // ⛔ W0 i.12 / iii.2: `Main.level` is written by the `Game` CTOR, a frame
        // before the swap lands — a level ahead of the begin record is a swap
        // still PENDING, and staging it would stage the outgoing world.
        refuse(`wasmArrival: botStatus reports level ${status.level} but the landed begin record is level `
            + `${beginEntry['begin.level']} — a world swap is still pending (the ctor writes Main.level a frame `
            + 'before the swap lands); stage on the NEXT begin record, never on the level report');
    }
    const flat = {};
    for (const row of SEAM_SIGNATURE) {
        const src = ARRIVAL_FIELD_SOURCES[row.field];
        if (src.from === 'status' || src.from === 'state') {
            const v = src.read(status, state);
            if (v === undefined) {
                refuse(`wasmArrival: \`${row.field}\` reads undefined from ${src.from === 'state'
                    ? 'the bridge readState' : 'botStatus'} — a build without that readout cannot stage an arrival`);
            }
            flat[row.field] = Array.isArray(v) ? v.map((e) => (e && typeof e === 'object' ? { ...e } : e)) : v;
        }
    }
    return {
        envelope: { latched: true, partial: false, why: '', beginEntry: { ...beginEntry }, seam: flat },
        unread: [...UNREAD_FIELDS],
    };
}

/**
 * `segmentBootFromLatch` needs EVERY spec row; for an unread one it is handed
 * this placeholder only to get past its `need`, and the row is then DELETED
 * from the block — it is never declared.
 */
const UNREAD_PLACEHOLDER = Object.freeze({
    'save.beam': false, 'save.rockSet': false, 'save.firstUse': false, 'save.extended': false,
    'save.grassCut': 0, 'static.Music.currentSet': null, 'static.Music.currentIndex': -1,
});

function deleteSeamKey(block, key) {
    const [head, tail] = key.split('.');
    if (tail === undefined) { delete block[head]; return; }
    if (!block[head]) return;
    delete block[head][tail];
    if (Object.keys(block[head]).length === 0) delete block[head];
}

/**
 * Step 2 — the JS staging for a wasm arrival.
 *
 * @param {object} o
 * @param {object} o.seam    `botSeam()` parsed — read BEFORE any `botLoadTape`
 * @param {object} o.status  `botStatus()` parsed — ONE read, at the arrival
 * @param {object} o.state   the bridge's `readState()`
 * @param {object|null} [o.record]  the arrival room's record (its `entities`) — the
 *        UNREAD_MODELLED_READERS check; omitted = not checked (the caller says so)
 * @param {string[]} [o.pins]  what the HOST TAPE will pin (`JS_RUNTIME_PINS` — the JS
 *        page's own); ⛔ not the game's live pins, which are the last tape's (none
 *        on the live panel), and a solve without `sound` refuses every wet tick
 * @returns {{staging, unread, undeclared, gamePins}} `undeclared` = the unread spec
 *        keys left out of `seam`; `gamePins` = the live game's pins, for the record
 */
export function stagingFromWasmArrival({ seam, status, state, record = undefined, pins = JS_RUNTIME_PINS }) {
    const { envelope, unread } = arrivalLatch({ seam, status, state });
    const unknownPins = pins.filter((p) => !PIN_NAMES.includes(p));
    if (unknownPins.length) refuse(`wasmArrival: no such pin ${JSON.stringify(unknownPins)} (the format's: ${PIN_NAMES.join(', ')})`);
    if (record !== undefined) {
        const types = new Set((record?.entities ?? []).map((e) => e.type));
        for (const field of unread) {
            const readers = (UNREAD_MODELLED_READERS[field] ?? []).filter((t) => types.has(t));
            if (readers.length) {
                refuse(`wasmArrival: level ${status.level} holds a ${readers.join('/')}, which reads \`${field}\` `
                    + '— a modelled save field no read-only verb carries (botStatus lacks it; only a tape\'s '
                    + 'latch reports it). Staging it undeclared would model the room in a state nobody measured.');
            }
        }
    }
    const withPlaceholders = { ...envelope, seam: { ...envelope.seam } };
    for (const f of unread) {
        if (Object.prototype.hasOwnProperty.call(UNREAD_PLACEHOLDER, f)) withPlaceholders.seam[f] = UNREAD_PLACEHOLDER[f];
    }
    let blocks;
    try {
        blocks = segmentBootFromLatch(withPlaceholders);
    } catch (err) {
        refuse(`wasmArrival: the arrival latch cannot be authored as a boot — ${err.message}`);
    }
    const seamBlock = structuredClone(blocks.seam);
    const undeclared = [];
    for (const spec of SEAM_BOOT_SPEC) {
        if (!unread.includes(spec.field)) continue;
        deleteSeamKey(seamBlock, spec.key);
        undeclared.push(spec.key);
    }
    const staging = {
        boot: blocks.boot,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: blocks.persistence,
        despawn: [],
        equips: [],
        // In the format's own order, so the staging round-trips `parseTape` unchanged.
        pins: PIN_NAMES.filter((p) => pins.includes(p)),
        save: blocks.save,
        rng: blocks.rng,
        seam: Object.keys(seamBlock).length > 0 ? seamBlock : null,
    };
    return { staging, unread, undeclared, gamePins: blocks.pins };
}

/** Booleans → their true indices (the tape's save-array spelling). */
const indicesOf = (arr) => (arr ?? []).flatMap((v, i) => (v ? [i] : []));
const sortClears = (list) => [...(list ?? [])].map((c) => ({ level: c.level, tag: c.tag }))
    .sort((a, b) => a.level - b.level || a.tag - b.tag);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The W1 witness: the staging against the reads it came from, FIELD FOR FIELD
 * — `[{name, ok, detail}]`. Every row names both sides.
 */
export function arrivalStagingWitness(staging, { seam, status, state }) {
    const be = seam?.beginEntry ?? {};
    const rows = [];
    const row = (name, want, got) => rows.push({ name, ok: same(want, got),
        detail: same(want, got) ? JSON.stringify(got) : `staged ${JSON.stringify(got)} vs read ${JSON.stringify(want)}` });
    row('boot.level = botStatus.level = begin.level', [status.level, be['begin.level']], [staging.boot.level, staging.boot.level]);
    row('boot (x, y) = the spawn (readState playerPositionX/Y)', [state.playerPositionX, state.playerPositionY],
        [staging.boot.x, staging.boot.y]);
    row('persistence = botStatus.persistence_cleared EXACTLY', sortClears(status.persistence_cleared),
        sortClears(staging.persistence));
    row('save.keys = botStatus.save.keys', indicesOf(status.save?.keys), staging.save?.keys);
    row('save.totem_parts = botStatus.save.totem_parts', indicesOf(status.save?.totem_parts), staging.save?.totem_parts);
    const seals = status.save?.seal_parts ?? [];
    const firstEmpty = seals.indexOf(-1);
    row('save.seal_parts = botStatus.save.seal_parts (the slot VALUES, up to the first -1)',
        firstEmpty === -1 ? seals : seals.slice(0, firstEmpty), staging.save?.seal_parts);
    rows.push({ name: 'all THREE save arrays declared', ok: ['keys', 'totem_parts', 'seal_parts']
        .every((k) => Array.isArray(staging.save?.[k])), detail: JSON.stringify(Object.keys(staging.save ?? {})) });
    for (const prop of ITEM_FLAGS) row(`seam.items.${prop} = botStatus.items.${prop}`, status.items?.[prop], staging.seam?.items?.[prop]);
    row('seam.hits_max = botStatus.items.hitsMax', status.items?.hitsMax, staging.seam?.hits_max);
    row('seam.primary = botStatus.primary', status.primary, staging.seam?.primary);
    row('seam.secondary = botStatus.secondary', status.secondary, staging.seam?.secondary);
    row('seam.cutscene = botStatus.cutscene', status.cutscene, staging.seam?.cutscene);
    row('seam.menu_state = botStatus.menu_state', status.menu_state, staging.seam?.menu_state);
    row('rng.split = botStatus.rng.split', status.rng?.split, staging.rng?.split);
    row('rng.seed = begin rng.gameplay', be['rng.gameplay'], staging.rng?.seed);
    row('rng.cosmetic = begin rng.cosmetic', be['rng.cosmetic'], staging.rng?.cosmetic);
    row('rng.fp = begin fp.seed', be['fp.seed'], staging.rng?.fp);
    rows.push({ name: 'seam.time = begin save.time − BOOT_PRESWAP_FRAMES (segmentBootFromLatch\'s convention)',
        ok: Number.isFinite(staging.seam?.time) && staging.seam.time < be['save.time'],
        detail: `staged ${staging.seam?.time}, begin save.time ${be['save.time']}` });
    const declaredUnread = UNREAD_FIELDS.map((f) => SEAM_BOOT_SPEC.find((s) => s.field === f)?.key)
        .filter((k) => k && (k.includes('.') ? staging.seam?.[k.split('.')[0]]?.[k.split('.')[1]] !== undefined
            : staging.seam?.[k] !== undefined));
    rows.push({ name: 'no UNREAD field is declared', ok: declaredUnread.length === 0,
        detail: declaredUnread.length ? `declared ${JSON.stringify(declaredUnread)}` : `left out ${JSON.stringify(UNREAD_FIELDS)}` });
    return rows;
}

/**
 * Step 3a — the solver goal for an AP-vocabulary goal (`resolveSeedlingAtlasGoal`'s
 * `{kind: 'location'|'exit', level, …}`) in the FRESH staged run — the JS page's
 * mapping (`jsRuntimeSolver.solverGoalFor`, with the walker's teleporter
 * resolution and the core's location entity), not a second one.
 *
 * @returns {{goal: object}|{walker: string}} `walker` = the solver has no goal for it, named
 */
export function arrivalSolverGoal(goal, { staging, levelSource, record }) {
    if (goal?.level !== staging.boot.level) {
        return { walker: `the goal is in level ${goal?.level}, the arrival in level ${staging.boot.level} — `
            + 'the bot plans ONE goal in ONE room (⚖ Q5)' };
    }
    const run = createRunForStaging(staging, levelSource);
    let resolved = null;
    if (goal.kind === 'exit') {
        const hit = nearestTeleporterAt(run.world, goalTiles(goal), run.state);
        resolved = { allowTeleporter: hit ? hit.index : null };
    }
    const placement = goal.kind === 'location' ? locationEntityOf(record, goal.tag, goal.entityType ?? null) : null;
    return solverGoalFor(goal, { run, resolved, placement, mounted: false });
}

/**
 * Step 3b — the S2 solve service's request (`createWorkerSolveService().start`
 * or `createInPlaceSolveService().start`) for a fresh boot at the arrival.
 */
export function arrivalSolveRequest({ staging, solverGoal, levelSource, records, name = 'wasm-arrival-solve' }) {
    const fresh = createRunForStaging(staging, levelSource);
    return {
        staging,
        perTick: [],
        live: liveOf(fresh),
        solverGoal,
        name,
        scratchPersistence: false,
        equips: null,
        levelSource,
        source: { records },
    };
}
