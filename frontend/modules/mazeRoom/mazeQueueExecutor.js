/**
 * mazeQueueExecutor — the PURE half of running a maze action queue.
 *
 * `executeMazeEntry` is the one place a shared actionQueue entry becomes an
 * engine transition. It takes a world and a state and gives back the next
 * state (or a refusal with a reason); it publishes nothing, deducts no mana,
 * expands no fog and touches no DOM. Every side effect around a step —
 * mana, `_publishPlaybackEvents`, fog, hazard ticks, consumable grants —
 * stays in `mazeRoomUI` on both sides of the call, which is what lets the
 * maze LAB (slice S2b) run the same verbs on a page that mounts no panel.
 *
 * The other half of the file is the RECORDING projection: `projectActions`
 * folds a slice of the live queue into the compressed, id-less shape a
 * `SavedQueue` stores, and `expandEntries` is its inverse for the replayer.
 *
 * ⚠ Refusals are load-bearing (census gap R2, plan §20). Before this slice a
 * refused move was marked DONE and the driver walked on, so a recording could
 * replay onto a different route and report success. Now:
 *   - a refusal at RECORD time is kept in the recording, marked
 *     `params.refused` — it consumed a turn (hazards tick either way), so
 *     dropping it would shift every later hazard phase; and
 *   - a refusal at REPLAY time on an entry NOT so marked is a divergence: the
 *     driver stops and names the index and the reason.
 */

import { fnv1a32, stableStringify } from '../procgenCore/contentIdentity.js';
import {
    INPUT_N, INPUT_S, INPUT_E, INPUT_W, INPUT_WAIT,
    effectiveInventory,
    getItem,
    getObstacle,
    step,
    whyBlocked,
} from './mazeRoomEngine.js';
import { serializeMazeLevel } from './procgenMaze.js';
import {
    ACTION_MOVE,
    ACTION_WAIT,
    ACTION_LOCATION_CHECK,
    MAZE_SUBSTRATE,
} from './mazeKeys.js';

/** Direction letter to the engine input constant. */
export const MOVE_DIR_TO_INPUT = Object.freeze({
    N: INPUT_N,
    S: INPUT_S,
    E: INPUT_E,
    W: INPUT_W,
});

/** Direction letter to the tile delta that direction intends. */
export const MOVE_DIR_TO_DELTA = Object.freeze({
    N: { dx: 0, dy: -1 },
    S: { dx: 0, dy: 1 },
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
});

/** The tile a player at `from` intends to enter moving `dir`. */
export function intendedTileFor(from, dir) {
    const d = MOVE_DIR_TO_DELTA[dir];
    if (!d || !from) return from;
    return { x: from.x + d.dx, y: from.y + d.dy };
}

/**
 * Why `step` refused, said in one sentence.
 *
 * ⛓⛓ SLICE S2b — **IT DELEGATES.** This function used to name the TARGET CELL
 * and, when there was one, the obstacle standing in it, because it deliberately
 * would not re-derive `effectiveInventory` (engine-private, and a second copy
 * of the clearance logic would get it wrong the next time a gadget landed). The
 * engine now answers the question itself — `mazeRoomEngine.whyBlocked`, beside
 * `step`, in `step`'s own guard order — so a held button reads as *"door_A0 is
 * shut — nothing on button_A0"* rather than as an obstacle id. ⛔ Every caller
 * already read ONE string; nothing else moved.
 */
function refusalReason(world, state, dir, inventoryOverride, clearanceOpts) {
    const input = MOVE_DIR_TO_INPUT[dir];
    /**
     * ⛔ THE OVERRIDE AND THE CLEARANCE OPTIONS GO THROUGH — a defect this
     * slice's own suite caught the moment the delegation landed. `step` was
     * asked with a playback inventory and the reason with the state's own, so a
     * door the OVERRIDE does not open reported *"the engine refused it"* while
     * `step` knew exactly which door it was. Two callers, one question, one
     * argument list.
     */
    const why = whyBlocked(world, state, input, inventoryOverride, clearanceOpts);
    /**
     * ⛔ `null` here would mean `whyBlocked` and `step` DISAGREE about this
     * world, which is a seam defect and not a fact about the move — so the
     * sentence says so rather than printing an empty reason.
     */
    return `move ${dir} blocked: ${why ?? '⛔ SEAM — `step` refused it and `whyBlocked` says '
        + 'it is legal'}`;
}

/**
 * Run ONE queue entry against a world + state.
 *
 * @param {object} world
 * @param {object} state
 * @param {object} entry - a shared actionQueue entry (actionType / actionId)
 * @param {object} [opts]
 * @param {*} [opts.inventoryOverride] - playback-mode inventory; `undefined`
 *   keeps the engine's historical pickup-into-state.inventory behaviour.
 * @param {object} [opts.clearanceOpts] - `{evaluateRule}` for logic gates.
 * @returns {{next: object|null, reason: string|null}} `next === state` means
 *   the verb passes a turn the ENGINE has no opinion about (`locationCheck`
 *   — a panel-side publish); `next === null` means the entry was REFUSED and
 *   `reason` says why. ⚠ Since S2a a `wait` is NOT in that first class: it
 *   returns a NEW state with `turn + 1`, because the engine now owns "a turn
 *   passes". `next === state` is therefore not a test for "nothing happened"
 *   — ask the ENTRY (`actionType`) or compare positions.
 */
export function executeMazeEntry(world, state, entry, { inventoryOverride, clearanceOpts } = {}) {
    if (!world || !state) {
        return { next: null, reason: 'no world or state loaded' };
    }
    const actionType = entry?.actionType;
    if (actionType === ACTION_MOVE) {
        const dir = entry.actionId;
        const input = MOVE_DIR_TO_INPUT[dir];
        if (!input) {
            return { next: null, reason: `unknown move direction '${dir}'` };
        }
        const next = step(world, state, input, inventoryOverride, clearanceOpts);
        if (next === null) {
            return {
                next: null,
                reason: refusalReason(world, state, dir, inventoryOverride, clearanceOpts),
            };
        }
        return { next, reason: null };
    }
    if (actionType === ACTION_WAIT) {
        // S2a: the engine owns "a turn passes". `step` never refuses a WAIT,
        // so `next` is always a NEW state with `turn + 1` and everything else
        // byte-equal. The caller still wraps its own per-turn side effects
        // (mana, hazard tick) around it.
        return { next: step(world, state, INPUT_WAIT), reason: null };
    }
    if (actionType === ACTION_LOCATION_CHECK) {
        // The check itself is a panel-side publish, not an engine transition.
        return { next: state, reason: null };
    }
    return { next: null, reason: `unknown maze action type '${actionType}'` };
}

// ---------------------------------------------------------------------------
// Recording projection: live queue -> stored actions -> live queue
// ---------------------------------------------------------------------------

/** True when this entry was refused when it ran (see the file header). */
export function isRefused(entry) {
    return entry?.params?.refused === true;
}

/** The identity two adjacent entries must share to fold into one `loops`. */
function foldKey(entry) {
    return `${entry.actionType} ${entry.actionId ?? ''} ${isRefused(entry) ? '1' : '0'}`;
}

/**
 * The stored form of one entry: the vocabulary fields only, in a FIXED key
 * order. No `entryId` (wall-clock derived — a recording carrying one could
 * never be byte-identical to a second capture of the same visit, which is what
 * `savedQueueStore`'s duplicate detection compares) and no status.
 */
function storedEntry(entry, loops) {
    const out = {
        actionType: entry.actionType,
        actionId: entry.actionId ?? null,
        substrate: entry.substrate ?? MAZE_SUBSTRATE,
    };
    if (isRefused(entry)) out.params = { refused: true };
    out.loops = loops;
    return out;
}

/**
 * Project a slice of the live queue into a RECORDING.
 *
 * Runs of identical consecutive entries fold into one entry with `loops: n`
 * (the shared field's purpose; jta and omsi already record that way). A
 * `locationCheck` NEVER folds — two checks of the same location are two
 * different events, and a viewer that collapsed them would lose one.
 *
 * @param {object[]} entries - live entries, each optionally carrying the
 *   `status` a `snapshot()` attaches (a FAILED one is stamped
 *   `params.refused`, so the replayer knows the refusal was recorded rather
 *   than a divergence).
 * @param {number} [from]
 * @param {number} [to]
 * @returns {object[]} id-less, status-less, run-length-folded entries
 */
export function projectActions(entries, from = 0, to = undefined) {
    if (!Array.isArray(entries)) return [];
    const end = to === undefined ? entries.length : to;
    const slice = entries.slice(Math.max(0, from), Math.max(0, end));
    const out = [];
    let prevKey = null;
    for (const raw of slice) {
        if (!raw || typeof raw.actionType !== 'string') continue;
        const refused = raw.status?.state === 'failed' || isRefused(raw);
        const entry = refused
            ? { ...raw, params: { ...(raw.params ?? {}), refused: true } }
            : raw;
        const runs = Math.max(1, Number.isInteger(entry.loops) ? entry.loops : 1);
        const key = foldKey(entry);
        const foldable = entry.actionType !== ACTION_LOCATION_CHECK;
        if (foldable && key === prevKey && out.length > 0) {
            out[out.length - 1].loops += runs;
        } else {
            out.push(storedEntry(entry, runs));
            prevKey = foldable ? key : null;
        }
    }
    return out;
}

/**
 * The inverse of `projectActions`' folding: one entry per turn, `loops: 1`.
 * The LIVE queue is uncompressed — one icon per press — so a replayer expands
 * a recording before adding it.
 *
 * @param {object[]} entries
 * @returns {object[]}
 */
export function expandEntries(entries) {
    if (!Array.isArray(entries)) return [];
    const out = [];
    for (const entry of entries) {
        if (!entry || typeof entry.actionType !== 'string') continue;
        const n = Number.isInteger(entry.loops) ? entry.loops : 1;
        for (let i = 0; i < n; i++) {
            const copy = { ...entry, loops: 1 };
            if (entry.params) copy.params = { ...entry.params };
            out.push(copy);
        }
    }
    return out;
}

/** How many turns a recording takes to replay (the expanded entry count). */
export function expandedLength(entries) {
    if (!Array.isArray(entries)) return 0;
    let n = 0;
    for (const entry of entries) {
        if (!entry || typeof entry.actionType !== 'string') continue;
        n += Number.isInteger(entry.loops) ? entry.loops : 1;
    }
    return n;
}

// ---------------------------------------------------------------------------
// ⛓⛓⛓ SLICE R-b — RECORDING PRECONDITIONS (census gaps R3 + R4)
// ---------------------------------------------------------------------------
//
// Before this slice a recording replayed under a smaller inventory, or on a
// level that had MOVED, was caught only by R2 — at the first refused step,
// mid-walk, after the player had already been driven somewhere. Two facts
// about the recording let a replayer refuse BEFORE step 0 and NAME what is
// missing:
//
//   · `worldDigest` — a content hash of the level the walk was driven on;
//   · `requires`    — the item ids the walk DEPENDED ON to pass obstacles,
//                     derived from the walk itself at record time.
//
// ⛔ BOTH ARE FACTS ABOUT A **RECORDING**, so both ride on the recording
// ENVELOPE as optional TOP-LEVEL fields, for the panel's recordings
// (`_finalizeVisitOnExit`) and the lab's (`mazeLabWalk.fold`) alike. S2b's
// as-built suggested the lab's additive `lab` block for the digest; the
// planner overturned that, because the motivating case (plan §20 R4: a region
// EDITED through `layout.edits[]` invalidates a stored recording while the
// `rulesHash` bucket it lives in does NOT move) is the PANEL's, and the panel
// has no `lab` block. `savedQueueStore.saveQueue` spreads `...queue`, so an
// unknown top-level field survives persistence; jta and omsi entries simply
// lack both and nothing in loops reads them.
//
// ⛔ AND BOTH ARE OPTIONAL, FOREVER. A recording written before this slice
// carries neither, and `refuseReplayPreconditions` answers `null` for it —
// R2 is still the net underneath. A precondition that made old recordings
// unplayable would be a migration, not a check.

/**
 * The content digest of a maze LEVEL — R4's half of a recording's identity.
 *
 * ⛔ `contentIdentity.computeContentHash` is deliberately NOT called: it
 * hashes a document MINUS `provenance` and MINUS its own id key, and a
 * serialized maze level has neither — it is not a document that embeds the
 * hash of its own content, it is a level a hash is taken OF. Calling it would
 * mean inventing an `idKey` for a field nothing carries. The two primitives
 * underneath it are the contract (`stableStringify` + `fnv1a32`, see that
 * file's header), and they are what this calls.
 *
 * ⛓ `serializeMazeLevel` is the level's own determinism channel — fixed key
 * order, sorted overlays, per-instance library entries, caches excluded — so
 * it is exactly the set of bytes an identity is about. `worldsEqual` already
 * compares two levels through it; this hashes one.
 *
 * @param {object} world
 * @returns {string} 8 lowercase hex digits
 */
export function mazeWorldDigest(world) {
    return fnv1a32(stableStringify(serializeMazeLevel(world)));
}

/**
 * The ids a HOLD can put in an effective inventory, named by the ONE place a
 * hold is declared: `world.buttonLib[<id>].holds`.
 *
 * ⛔ A held token is NOT an item. `effectiveInventory` adds it per turn from
 * the stance and never stores it, so nothing a replayer's start inventory
 * could hold would satisfy it — listing it in `requires` would produce a
 * refusal no player could ever clear. Derived from the world rather than
 * matched on a `sw_` prefix, because the prefix is the DEFAULT library's
 * spelling and not a rule any world is held to.
 */
function heldTokenIds(world) {
    const out = new Set();
    for (const entry of Object.values(world?.buttonLib ?? {})) {
        if (entry?.holds) out.add(entry.holds);
    }
    return out;
}

/**
 * ⛓⛓⛓ R3 — **WHAT THIS WALK NEEDED TO BE CARRYING**, derived from the walk.
 *
 * Runs the EXPANDED actions through `executeMazeEntry` from `startState` — the
 * same executor the replayers use, so the route this reads is the route that
 * will actually be driven — and for every ACCEPTED move onto a cell holding an
 * obstacle asks which combination of that obstacle's `clear_set` the inventory
 * satisfied AT THAT TURN. `library.js`'s contract (lines 10-14): `clear_set`
 * is an OR of AND-combinations, so the answer is the FIRST fully-held combo in
 * DECLARED ORDER — the same order `isObstacleCleared` returns `true` on.
 *
 * ⛔ **MINUS WHAT THE WALK ITSELF PICKED UP FIRST.** An item collected on the
 * way in is not an item that has to be carried in, and a `requires` that named
 * it would refuse a recording that is perfectly replayable. Pickups are
 * counted on ARRIVAL and the obstacle is asked BEFORE the arrival's own item
 * is added, so a key lying ON a door's cell is not credited to that door.
 *
 * ⛓ A PUSH is asked too, on the cell BEYOND: `step` refuses to push a block
 * into a shut door and asks that cell with the SAME effective inventory the
 * player's own move is asked with, so it is the same question about the same
 * turn.
 *
 * ⛔ **A `rule`-TYPED GATE IS NOT DERIVABLE HERE AND SAYS SO.** `clear_set_type:
 * 'rule'` is a Rule Builder expression evaluated against an inventory; there is
 * no combination to read off it, and inventing one would be a guess printed as
 * a fact. The answer is `{requires: null, why: …}` and R2 still catches such a
 * walk at replay.
 *
 * @param {object} world
 * @param {object} startState the state the walk was driven from
 * @param {object[]} actions the RECORDING's actions (folded or not)
 * @returns {{requires: string[]|null, why: string|null}} `requires` sorted;
 *   `null` with a `why` when the walk crosses something this cannot derive.
 */
export function deriveRequires(world, startState, actions) {
    if (!world || !startState) {
        return { requires: null, why: 'no world or start state to derive from' };
    }
    const held = heldTokenIds(world);
    const pickedUp = new Set();
    const requires = new Set();
    let engine = startState;
    let turn = 0;
    for (const entry of expandEntries(actions)) {
        const dir = entry.actionType === ACTION_MOVE ? entry.actionId : null;
        const from = engine.player_pos;
        // ⛔ The inventory is read BEFORE the move: the clearance check `step`
        // ran is the one that used this stance (see step's own comment — the
        // button under the player's FEET is still pressed at the instant the
        // move is attempted).
        const inv = effectiveInventory(world, engine.inventory, from, engine.blocks);
        const { next } = executeMazeEntry(world, engine, entry);
        if (next === null) { turn += 1; continue; }
        if (dir !== null) {
            const target = intendedTileFor(from, dir);
            const cells = [target];
            const pushed = Array.isArray(engine.blocks)
                && engine.blocks.includes(`${target.x},${target.y}`);
            if (pushed) cells.push(intendedTileFor(target, dir));
            for (const cell of cells) {
                const obstacleId = getObstacle(world, cell.x, cell.y);
                const lib = obstacleId ? world.obstacleLib?.[obstacleId] : undefined;
                // An id the library does not hold is NO GATE — `isObstacleCleared`
                // returns true for it, so the walk did not depend on anything.
                if (!lib) continue;
                if ((lib.clear_set_type ?? 'combo_list') === 'rule') {
                    return {
                        requires: null,
                        why: `rule-typed gate ${obstacleId} at turn ${turn}`,
                    };
                }
                const combo = (lib.clear_set ?? []).find(
                    (c) => c.every((id) => inv.has(id)));
                for (const id of combo ?? []) {
                    if (held.has(id) || pickedUp.has(id)) continue;
                    requires.add(id);
                }
            }
            const got = getItem(world, target.x, target.y);
            if (got) pickedUp.add(got);
        }
        engine = next;
        turn += 1;
    }
    return { requires: [...requires].sort(), why: null };
}

/**
 * Stamp `worldDigest` and `requires` onto a recording envelope, IN PLACE.
 *
 * ⛔ ONE stamping function, called by BOTH recorders — the panel's
 * `_finalizeVisitOnExit` and the lab's `fold()`. Two spellings of "what did
 * this walk need" is how a panel recording and a lab recording come to refuse
 * on different grounds for the same level.
 *
 * ⚠ `requires` is written ONLY when it was derivable: a `rule`-typed gate
 * answers `null`, and a recording carrying `requires: null` would be
 * indistinguishable from one written before this slice. Absent means "this
 * recording does not say", which is exactly the truth in both cases.
 *
 * @param {object} rec the recording envelope
 * @param {object} world the level the walk was driven on
 * @param {object} startState the state it was driven from
 * @returns {object} `rec`
 */
export function stampRecordingPreconditions(rec, world, startState) {
    if (!rec || !world) return rec;
    rec.worldDigest = mazeWorldDigest(world);
    const { requires } = deriveRequires(world, startState, rec.actions);
    if (requires !== null) rec.requires = requires;
    return rec;
}

/** English for a list of ids: `a`, `a and b`, `a, b and c`. */
function andList(ids) {
    if (ids.length <= 1) return ids.join('');
    return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/**
 * ⛓⛓⛓ **REFUSE A REPLAY BEFORE STEP 0**, by name — R3 + R4 read back.
 *
 * @param {object} rec the recording envelope
 * @param {object} opts
 * @param {object} opts.world the level the replay would be driven on
 * @param {Set<string>|string[]} [opts.startInventory] what the player holds now
 * @param {boolean} [opts.selfContained] the recording carries its OWN level
 *   (a lab walk document), so a digest mismatch is a self-consistency finding
 *   about a hand-edited file rather than a level that moved under it.
 * @returns {string|null} the refusal, or `null` — including for a recording
 *   that carries neither field, which is still replayable (R2 is the net).
 */
export function refuseReplayPreconditions(rec, { world, startInventory, selfContained } = {}) {
    if (!rec || !world) return null;
    if (typeof rec.worldDigest === 'string') {
        const here = mazeWorldDigest(world);
        if (here !== rec.worldDigest) {
            return selfContained === true
                ? `this walk carries a level that is not the level it was driven on `
                    + `(digest ${rec.worldDigest}, its own payload is ${here}) — the `
                    + 'document\'s level was edited by hand after the walk was recorded'
                : `this recording was made on a different level (digest ${rec.worldDigest}, `
                    + `this level is ${here}) — the level moved or was edited`;
        }
    }
    if (Array.isArray(rec.requires) && rec.requires.length > 0) {
        const have = startInventory instanceof Set
            ? startInventory
            : new Set(startInventory ?? []);
        // ⛔ EVERY missing id, not the first: a walk short two keys that named
        // one would send the reader back for a second refusal.
        const missing = rec.requires.filter((id) => !have.has(id));
        if (missing.length > 0) {
            return `this walk needs ${andList(rec.requires)}, and the start inventory `
                + `${missing.length === rec.requires.length
                    ? 'holds none of them'
                    : `is missing ${andList(missing)}`}`;
        }
    }
    return null;
}
