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

import {
    INPUT_N, INPUT_S, INPUT_E, INPUT_W, INPUT_WAIT,
    step,
    whyBlocked,
} from './mazeRoomEngine.js';
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
