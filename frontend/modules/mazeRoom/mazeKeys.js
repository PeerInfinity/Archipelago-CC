/**
 * mazeKeys — the maze's action VOCABULARY and its keyboard binding, with no
 * DOM and no engine import.
 *
 * Two consumers by construction (which is why this is its own file):
 *   - `mazeRoomUI.js`, the substrate panel's keyboard play; and
 *   - the maze lab's MANUAL arm (`lab.html`, slice S2b), which binds the same
 *     keys to the same verbs on a page that never mounts the panel.
 *
 * The verbs are entries in the SHARED actionQueue vocabulary
 * (`shared/actionQueue`), not a maze-private shape — a maze move is
 * `{actionType:'move', actionId:'N'|'E'|'S'|'W', substrate:'maze'}`. The
 * `ACTION_*` string values are unchanged from the pre-migration
 * `mazeRoomQueue.js`, so `actionType` is the same word the recordings and the
 * docs already used; what moved is the FIELD it lives in (`type` → `actionType`,
 * `dir`/`locationName` → `actionId`).
 *
 * Run-length compression rides on the shared `loops` field: a RECORDING folds
 * runs of identical entries (see `mazeQueueExecutor.projectActions`), while the
 * LIVE queue stays one entry per keypress so the icon row still shows the press
 * the player made.
 */

/** The substrate id every maze entry is stamped with. */
export const MAZE_SUBSTRATE = 'maze';

export const ACTION_MOVE = 'move';
export const ACTION_WAIT = 'wait';
export const ACTION_LOCATION_CHECK = 'locationCheck';
/**
 * ⛓⛓ ITEM ACTIONS (slice tile-primitives-item-actions, ⚖ 2026-10-21). Only an
 * item-action world (one with an `action_lib`) accepts these; every other
 * world's queues are made of the three verbs above, unchanged.
 *   `turn`  — actionId = the direction to face (N/E/S/W); a turn passes.
 *   `use`   — actionId = the `action_lib` ID, ⛔ NEVER the key (⚖ "queue entries
 *             name the ACTION ID"), so a rebinding moves no recording.
 *   `cross` — a walk-through region BOUNDARY inside one shared level world
 *             (⚖ "Shared level world"; the overlay is Stage 2). actionId = the
 *             direction stepped (the engine step IS a move); `params` =
 *             `{boundary, sourceRegion, targetRegion}`, so a replay publishes
 *             the region move WITHOUT an exit lookup, and the loop-mode gate
 *             is asked BEFORE the in-world step. Never folds.
 */
export const ACTION_TURN = 'turn';
export const ACTION_USE = 'use';
export const ACTION_CROSS = 'cross';

export const ACTION_TYPES = Object.freeze([
    ACTION_MOVE,
    ACTION_WAIT,
    ACTION_LOCATION_CHECK,
    ACTION_TURN,
    ACTION_USE,
    ACTION_CROSS,
]);

export const DIRECTIONS = Object.freeze(['N', 'E', 'S', 'W']);

/**
 * Build a maze queue entry. The ONE place the maze's `actionType`/`actionId`
 * mapping is written down — every other maze caller goes through the three
 * helpers below rather than spelling the fields out.
 *
 * Deliberately does NOT normalize: `ActionQueue.add` / `normalizeEntry` own the
 * canonical key order and the `loops`/`disabled` defaults, and a recording that
 * never enters a live queue must stay id-less.
 *
 * @param {string} actionType
 * @param {string|null} [actionId]
 * @param {number} [loops]
 * @returns {{actionType:string, actionId:string|null, substrate:string, loops?:number}}
 */
export function mazeEntry(actionType, actionId = null, loops) {
    const entry = { actionType, actionId, substrate: MAZE_SUBSTRATE };
    if (loops !== undefined) entry.loops = loops;
    return entry;
}

/** A move entry for one of N/E/S/W. */
export function moveEntry(dir, loops) {
    return mazeEntry(ACTION_MOVE, dir, loops);
}

/** A wait entry (one turn passes, the player does not move). */
export function waitEntry(loops) {
    return mazeEntry(ACTION_WAIT, null, loops);
}

/** An explicit location check at the current tile. */
export function locationCheckEntry(locationName) {
    return mazeEntry(ACTION_LOCATION_CHECK, locationName);
}

/** A turn-in-place entry: face `dir` without moving. */
export function turnEntry(dir, loops) {
    return mazeEntry(ACTION_TURN, dir, loops);
}

/** A use entry for an `action_lib` id (never a key). */
export function useEntry(actionId, loops) {
    return mazeEntry(ACTION_USE, actionId, loops);
}

/**
 * A boundary-crossing entry. ⛔ All three params are REQUIRED — the replay
 * reads the regions off the entry, never off an exit table.
 */
export function crossEntry(dir, { boundary, sourceRegion, targetRegion }) {
    const entry = mazeEntry(ACTION_CROSS, dir);
    entry.params = { boundary, sourceRegion, targetRegion };
    return entry;
}

/** The default use keys, in the order an unkeyed `action_lib` entry takes them. */
export const DEFAULT_USE_KEYS = Object.freeze(['z', 'x', 'c', 'v']);

/**
 * `action_lib` → `{key: actionId}` (lower-case keys). An entry's own `key`
 * wins; an entry without one takes the first free default key, in sorted-id
 * order. ⛔ An entry left with no free key is simply unbound (it can still be
 * queued by its button), and two entries naming one key are refused by name.
 */
export function useKeyBindings(actionLib) {
    const out = {};
    const ids = Object.keys(actionLib ?? {}).sort();
    for (const id of ids) {
        const key = actionLib[id]?.key;
        if (!key) continue;
        const k = String(key).toLowerCase();
        if (out[k] !== undefined) {
            throw new Error(`action_lib: ${out[k]} and ${id} are both bound to '${k}'`);
        }
        out[k] = id;
    }
    const free = DEFAULT_USE_KEYS.filter((k) => out[k] === undefined);
    for (const id of ids) {
        if (actionLib[id]?.key || free.length === 0) continue;
        out[free.shift()] = id;
    }
    return out;
}

const SHIFT_ARROW_TURNS = Object.freeze({
    ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E',
});

/**
 * A keyboard event (`{key, shiftKey}`) → queue entry, or `null`.
 * ⛓ Shift+arrow = turn and Z/X/C/V = use — ONLY when `actionLib` is non-empty
 * (an item-action world); on any other world this is `KEY_MAP[key]`, so a
 * Shift+arrow still moves there exactly as it always did.
 */
export function keyToMazeEntry(event, actionLib) {
    const key = event?.key;
    if (typeof key !== 'string') return null;
    if (actionLib && Object.keys(actionLib).length > 0) {
        if (event.shiftKey && SHIFT_ARROW_TURNS[key]) return turnEntry(SHIFT_ARROW_TURNS[key]);
        const actionId = useKeyBindings(actionLib)[key.toLowerCase()];
        if (actionId !== undefined) return useEntry(actionId);
    }
    return KEY_MAP[key] ?? null;
}

/**
 * DOM key string → queue entry. Arrow keys and WASD move; space waits.
 * The direction is `actionId`; the move executor translates it to an engine
 * input via `MOVE_DIR_TO_INPUT` (mazeQueueExecutor.js).
 */
export const KEY_MAP = Object.freeze({
    ArrowUp:    moveEntry('N'),
    w:          moveEntry('N'),
    W:          moveEntry('N'),
    ArrowDown:  moveEntry('S'),
    s:          moveEntry('S'),
    S:          moveEntry('S'),
    ArrowLeft:  moveEntry('W'),
    a:          moveEntry('W'),
    A:          moveEntry('W'),
    ArrowRight: moveEntry('E'),
    d:          moveEntry('E'),
    D:          moveEntry('E'),
    ' ':        waitEntry(),
});

/**
 * How the maze says one queue entry out loud — the registry entry's
 * `describeAction` hook (Q-a A8), and the ONE owner of this wording. The icon
 * row's tooltips, `blockAnnotations` and any cross-substrate queue viewer all
 * read it rather than each carrying a copy.
 *
 * The `×n` suffix for a folded entry is the CALLER's (the shared viewer appends
 * it from `loops`), so a `loops: 4` move still describes as `move E`.
 *
 * @param {object} entry - a shared actionQueue entry
 * @returns {string}
 */
export function describeMazeAction(entry) {
    if (!entry || typeof entry.actionType !== 'string') return '';
    switch (entry.actionType) {
        case ACTION_MOVE:
            return `move ${entry.actionId ?? '?'}`;
        case ACTION_WAIT:
            return 'wait';
        case ACTION_LOCATION_CHECK:
            return `check ${entry.actionId ?? ''}`.trimEnd();
        case ACTION_TURN:
            return `turn ${entry.actionId ?? '?'}`;
        case ACTION_USE:
            return `use ${entry.actionId ?? '?'}`;
        case ACTION_CROSS:
            return `cross ${entry.actionId ?? '?'} → ${entry.params?.targetRegion ?? '?'}`;
        default:
            return entry.actionId === null || entry.actionId === undefined
                ? entry.actionType
                : `${entry.actionType} ${entry.actionId}`;
    }
}
