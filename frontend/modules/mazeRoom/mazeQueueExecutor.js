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
    INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    step,
    isFloor,
    getObstacle,
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
 * Deliberately reads only what `step`'s own guards can answer WITHOUT
 * re-deriving `effectiveInventory` (which would duplicate the engine's
 * clearance logic in a second place, and get it wrong the next time a gadget
 * lands). The full sentence — "door_red is shut, needs key_red" — is
 * `mazeRoomEngine.whyBlocked`, an S2b addition; until it exists this names the
 * TARGET CELL and, when there is one, the obstacle standing in it, which is
 * enough to tell a wall from a locked door from a stuck block.
 */
function refusalReason(world, state, dir) {
    const target = intendedTileFor(state?.player_pos, dir);
    if (!target) return `move ${dir} blocked: no player position`;
    const at = `(${target.x},${target.y})`;
    if (!isFloor(world, target.x, target.y)) {
        return `move ${dir} blocked at ${at}: wall or off-grid`;
    }
    const obstacleId = getObstacle(world, target.x, target.y);
    if (obstacleId) {
        return `move ${dir} blocked at ${at}: obstacle '${obstacleId}'`;
    }
    return `move ${dir} blocked at ${at}`;
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
 *   the verb passes a turn without an engine transition (wait, locationCheck);
 *   `next === null` means the entry was REFUSED and `reason` says why.
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
            return { next: null, reason: refusalReason(world, state, dir) };
        }
        return { next, reason: null };
    }
    if (actionType === ACTION_WAIT) {
        // S2a will route this through `step(world, state, INPUT_WAIT)`; until
        // the engine accepts a wait input, a wait is a turn the CALLER passes
        // (mana + hazard tick) around an unchanged engine state.
        return { next: state, reason: null };
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
