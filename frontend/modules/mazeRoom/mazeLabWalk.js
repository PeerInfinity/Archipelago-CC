/**
 * mazeLabWalk — **THE MANUAL ARM'S SESSION, HEADLESS.**
 *
 * ⛓⛓⛓ SLICE S2b. The maze lab's fifth arm lets a person drive the level on
 * screen with the keyboard; this file is everything about that which is not
 * DOM. One key press is one shared `actionQueue` entry, appended to a live
 * queue and executed at once against the level; the frames it produces are the
 * SAME frames the SOLVE scrub draws, and the recording it folds to is the SAME
 * `SavedQueue` envelope a region visit produces in the panel.
 *
 * ── WHY EVERY PIECE IS SOMEBODY ELSE'S ───────────────────────────────
 *
 * ⛔ Nothing here is a second spelling of something the substrate already has:
 *
 *   - the VOCABULARY is `mazeKeys.KEY_MAP` — the same map the panel binds;
 *   - the QUEUE is the shared `ActionQueue` (Q-b deleted `MazeRoomQueue`);
 *   - the EXECUTOR is `mazeQueueExecutor.executeMazeEntry` — the panel's own,
 *     with every side effect (mana, fog, hazards, publishes) left outside it;
 *   - the BOOT is `procgenMaze.startStateFor`, the construction the ORACLE
 *     certifies from, called through `mazeLab.framesForActions` on the replay
 *     side and once here on the drive side;
 *   - the FRAME is `mazeLab.frameOf`, so a hand frame and a plan frame are the
 *     same shape by construction;
 *   - the GOAL is `mazeLab.oracleFor(state).goalPred` — the ORACLE's predicate.
 *     ⛔ Not a second "is this the goal" spelled on the page: a witness that
 *     disagreed with the certifier about where the goal is would be worthless.
 *
 * ── A REFUSED PRESS IS KEPT, AND MARKED ──────────────────────────────
 *
 * ⛔ Plan §15.4 said the lab would DROP a refused press ("a plan has no
 * no-ops"); §28 WITHDREW that, because Q-b measured what a refusal costs: the
 * panel ticks hazards whether the move ran or not, so a recording missing a
 * refused turn shifts every later hazard phase and MANUFACTURES the divergence
 * R2 exists to catch. Both replayers now read one rule — the entry stays,
 * stamped `params: {refused: true}` by `projectActions`, and a refusal the
 * entry already carries is a COMPLETION at replay while a NEW one is a failure.
 * A refused press therefore pushes a frame too: one equal to the previous
 * engine state, `turn` included (the engine did not step).
 *
 * ── NO UNDO IN v1 ────────────────────────────────────────────────────
 *
 * ⛔ `ActionQueue.removeAt` refuses the DONE region by design, and every entry
 * of an append-and-execute session is done the instant it is added. Undo would
 * need the engine states behind it as well as the entries, which is a rewind —
 * a different feature. RESTART re-opens the session; the panel says so.
 */

import { ActionQueue, ActionState, validateEntry } from '../shared/actionQueue/index.js';
import { getExitAt } from './mazeRoomEngine.js';
import { startStateFor } from './procgenMaze.js';
import {
    ACTION_QUEUE_FORMAT,
} from '../shared/actionQueue/actionTypes.js';
import { MAZE_SUBSTRATE, ACTION_LOCATION_CHECK, ACTION_WAIT } from './mazeKeys.js';
import {
    executeMazeEntry,
    expandedLength,
    isRefused,
    projectActions,
} from './mazeQueueExecutor.js';
import { frameOf, framesForActions, labPayload, oracleFor } from './mazeLab.js';

/** The arrival this page's walks all start from — a lab level has one entrance. */
export const LAB_ARRIVAL_EXIT_ID = 'entrance';

/**
 * Open a walk session over the level on screen.
 *
 * @param {object} state a lab state (`record` is the world, `palette.items` the
 *   ids the player starts holding, `model.goalPos` what the oracle calls the
 *   goal)
 * @returns {object} the session — see the file docblock
 */
export function createWalkSession(state) {
    if (!state?.record) {
        throw new Error('createWalkSession: no level on screen — a walk is driven ON a level');
    }
    const world = state.record;
    const queue = new ActionQueue();
    /**
     * ⛔ ONE BOOT. `startStateFor(world, items)` is the oracle's own `makeStart`
     * (S1 lifted it), and `framesForActions` — the REPLAY side — calls the same
     * function with the same two arguments. A session booted with the palette's
     * key and a replay booted without it would disagree at the first door, and
     * the round trip below is exactly the row that would catch it.
     */
    let engine = startStateFor(world, state.palette?.items ?? null);
    const frames = [frameOf(engine, null)];
    /** The oracle's predicate, asked — never re-spelled. */
    const goalPred = oracleFor(state).goalPred;
    let reachedGoal = goalPred(engine);
    let refused = 0;
    let waits = 0;
    let moves = 0;
    let last = null;

    /**
     * The frame's own `input`. ⛔ A refused press is marked HERE as well as in
     * the recording, because the input strip reads `frame.input.params.refused`
     * to grey the cell — one rule, read by the picture and by the document.
     */
    const frameInput = (entry, wasRefused) => (wasRefused
        ? { ...entry, params: { ...(entry.params ?? {}), refused: true } }
        : entry);

    /**
     * Drive ONE press.
     *
     * ⛔ APPEND THEN EXECUTE, through the queue — `add` + `stepOne`, which is
     * the panel's own `_handleKeydown` shape (`ActionQueue` has no
     * `handleInput`; append-and-execute is the executor's loop, per Q-a §26.1).
     * The executor THROWS on a refusal, which is what makes `stepOne` mark the
     * entry `FAILED`, which is what makes `projectActions` stamp
     * `params.refused` when the walk is folded. One mechanism, three readers.
     *
     * @param {object} spec an entry-shaped object (`KEY_MAP[key]`)
     * @returns {{entry: object, state: object, reason: string|null}}
     */
    const press = (spec) => {
        const problem = validateEntry(spec);
        if (problem !== null) {
            throw new Error(`mazeLabWalk: that is not a queue entry — ${problem}`);
        }
        const entry = queue.add(spec);
        let reason = null;
        const outcome = queue.stepOne((e) => {
            const out = executeMazeEntry(world, engine, e);
            if (out.next === null) throw new Error(out.reason);
            engine = out.next;
        });
        if (outcome.state === ActionState.FAILED) {
            reason = outcome.error;
            refused += 1;
        } else if (entry.actionType === ACTION_WAIT) {
            waits += 1;
        } else if (entry.actionType !== ACTION_LOCATION_CHECK) {
            moves += 1;
        }
        frames.push(frameOf(engine, frameInput(entry, reason !== null)));
        if (goalPred(engine)) reachedGoal = true;
        last = { entry, reason };
        return { entry, state: engine, reason };
    };

    /**
     * ⛓ WHAT THE WALK PICKED UP — the frames' own inventory delta, not a
     * separate tally. `frameOf` sorts the inventory, so the difference between
     * the first and the last frame is the set the walk collected in the order
     * the engine reports it.
     */
    const itemsPickedUp = () => {
        const start = new Set(frames[0].inventory);
        return frames[frames.length - 1].inventory.filter((id) => !start.has(id));
    };

    /**
     * The exit the walk left through, when it reached the goal — the exit
     * STANDING ON the final cell, asked of the world rather than assumed to be
     * the first one. `null` when the walk did not reach the goal, and `null`
     * when the goal cell carries no exit (an edited level's goal may not).
     */
    const departureExitId = () => {
        if (!reachedGoal) return null;
        const at = frames[frames.length - 1].player;
        return getExitAt(world, at.x, at.y)?.exit_id ?? null;
    };

    /**
     * ⛓⛓⛓ **THE RECORDING — THE LOOPS `SavedQueue` ENVELOPE, PLUS A `lab`
     * BLOCK.** ⛔ Not a new document kind and ⛔ not a field on the level
     * payload: the level payload is a REPRODUCTION RECIPE whose identity
     * `agreementWithPayload` compares, and a walk is a thing done ON a level —
     * putting it there would drag every `?gen=` comparison into the walk's blast
     * radius for nothing (plan §15.6).
     *
     * Everything above `lab` is the store's own envelope, so a lab walk and a
     * region visit are the SAME SHAPE — the day a lab level is a region, this
     * document is persistable under that region's tag with nothing rewritten.
     * The `lab` block is additive and loops ignores it.
     */
    const fold = (author = 'hand') => {
        const actions = projectActions(queue.snapshot().entries);
        return {
            substrate: MAZE_SUBSTRATE,
            format: ACTION_QUEUE_FORMAT,
            regionName: null,
            arrivalExitId: LAB_ARRIVAL_EXIT_ID,
            departureExitId: departureExitId(),
            actions,
            locationsChecked: actions
                .filter((a) => a.actionType === ACTION_LOCATION_CHECK && a.actionId)
                .map((a) => a.actionId),
            itemsPickedUp: itemsPickedUp(),
            manaAtEntry: 0,
            manaAtExit: 0,
            manaMin: 0,
            name: `lab: ${LAB_ARRIVAL_EXIT_ID}→${reachedGoal ? 'goal' : 'stopped'}`,
            lab: {
                generator: 'frontend/modules/mazeRoom/lab.html',
                payload: labPayload(state),
                author,
                reachedGoal,
                refused,
            },
        };
    };

    /**
     * ⛓⛓⛓ **THE ROUND TRIP — THE ACCEPTANCE ROW, ON THE PAGE.** The frames the
     * drive produced against the frames the FOLDED recording replays to, index
     * by index. Both sides are the same `step` from the same `startStateFor`, so
     * a mismatch is a SEAM DEFECT and the page says so rather than reporting a
     * difference of opinion.
     *
     * ⛔ It compares the ENGINE STATE a frame carries, not the frame object: the
     * drive's `input` is a LIVE entry (id, `disabled`, a minted `loops`) and the
     * replay's is an expanded stored one, and they are deliberately not the same
     * object. What must agree is where the player is, where the blocks are, what
     * is held and what turn it is.
     */
    const roundTrip = () => {
        const doc = fold();
        const replayed = framesForActions(state, doc.actions);
        if (replayed === null) {
            return {
                faithful: false,
                mismatches: [{
                    at: null,
                    drove: `${frames.length - 1} frame(s)`,
                    replayed: 'REFUSED — the recording does not replay through this level at all',
                }],
            };
        }
        const mismatches = [];
        const n = Math.max(frames.length, replayed.length);
        for (let i = 0; i < n; i += 1) {
            const a = engineOf(frames[i]);
            const b = engineOf(replayed[i]);
            if (a !== b) mismatches.push({ at: i, drove: a, replayed: b });
        }
        return { faithful: mismatches.length === 0, mismatches };
    };

    return {
        queue,
        frames,
        press,
        fold,
        roundTrip,
        /** The live counters the HUD and `__mazeLab.walk` read. */
        get moves() { return moves; },
        get refused() { return refused; },
        get waits() { return waits; },
        get reachedGoal() { return reachedGoal; },
        get last() { return last; },
        get engineState() { return engine; },
        /** How many TURNS the folded recording replays to — `expandedLength`. */
        get turns() { return expandedLength(fold().actions); },
    };
}

/** The comparable half of a frame: everything the ENGINE decided. */
function engineOf(frame) {
    if (!frame) return '(no frame)';
    return `player (${frame.player.x},${frame.player.y}) · turn ${frame.turn} · `
        + `inventory [${frame.inventory.join(' ')}] · `
        + `blocks ${frame.blocks === null ? '(none)' : `[${frame.blocks.join(' ')}]`}`;
}

/**
 * ⛓⛓⛓ **THE WITNESS CLAUSE, AND THE SEAM.** ⚖ §3.8 / §13.1: a hand walk that
 * reaches the goal is a WITNESS and NOT a certification — `certified` is the
 * ORACLE's answer or nothing, and this function never touches it.
 *
 * The second half is a free soundness check nobody has to run: if the oracle
 * REFUSED this exact record (`state.certified === false`) and a person then
 * walked to its goal, one of the two is wrong and it is not the person. The
 * page prints it in red. ⛔ Unreachable without a broken oracle, so the row that
 * drives it stubs a refusing one — the browser row cannot and does not claim to.
 *
 * @param {object} state the lab state the walk was driven on
 * @param {{reachedGoal: boolean, moves: number}|null} walk
 * @returns {{clause: string|null, seam: string|null}}
 */
export function witnessOf(state, walk) {
    if (!walk?.reachedGoal) return { clause: null, seam: null };
    return {
        clause: `walked to the goal by hand in ${walk.moves} move(s) — a witness, not the `
            + "oracle's certification",
        seam: state?.certified === false
            ? '⛔ SEAM: the oracle refused this level and a hand walk reached its goal'
            : null,
    };
}

/**
 * Read a walk DOCUMENT back — the box, an upload, a downloaded file.
 *
 * ⛔ **EVERY ACTION PASSES `validateEntry` BEFORE ANYTHING ELSE** (Q-a): a
 * document is a file somebody may have typed, and the first thing it must
 * survive is the shared vocabulary's own check. Then the LEVEL is loaded
 * (`loadPayload`, the existing loader — the level lands UNCERTIFIED like any
 * load) and only then are the actions replayed.
 *
 * @param {object} doc a folded walk
 * @returns {string|null} the refusal, or `null` when the document is well formed
 */
export function refuseWalkDocument(doc) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        return 'that is not a walk — a walk is a JSON object';
    }
    if (doc.substrate !== MAZE_SUBSTRATE) {
        return `this walk names substrate ${JSON.stringify(doc.substrate ?? null)}, not `
            + `"${MAZE_SUBSTRATE}" — the maze lab replays maze walks`;
    }
    if (doc.format !== undefined && doc.format !== ACTION_QUEUE_FORMAT) {
        return `this walk names format ${JSON.stringify(doc.format)}, and this page speaks `
            + `${ACTION_QUEUE_FORMAT}`;
    }
    if (!Array.isArray(doc.actions) || doc.actions.length === 0) {
        return 'this walk carries no actions — there is nothing to replay';
    }
    for (let i = 0; i < doc.actions.length; i += 1) {
        const problem = validateEntry(doc.actions[i]);
        if (problem !== null) return `action ${i} is not a queue entry — ${problem}`;
    }
    if (!doc.lab?.payload) {
        return 'this walk carries no `lab.payload` — a lab walk is self-contained, and '
            + 'without the level it was driven on there is nothing to replay it against';
    }
    return null;
}

/**
 * ⛓⛓ **WHERE A LOADED WALK REFUSES, BY NAME AND BY INDEX.** `framesForActions`
 * answers `null` for the whole walk and says nothing about where; a reader needs
 * the index, so this walks the EXPANDED actions one at a time to find the first
 * the level will not take. ⛔ Nothing partial is drawn — the caller gets a
 * sentence and the page keeps the walk it already had.
 *
 * @param {object} state the level the walk is being replayed on
 * @param {object[]} actions the document's own actions
 * @returns {string} the refusal, naming the index and the entry
 */
export function describeReplayRefusal(state, actions) {
    const world = state.record;
    let engine = startStateFor(world, state.palette?.items ?? null);
    let index = 0;
    for (const entry of expandOne(actions)) {
        const { next, reason } = executeMazeEntry(world, engine, entry);
        if (next === null) {
            if (!isRefused(entry)) {
                const said = entry.actionId ? ` (${entry.actionId})` : '';
                return `input ${index} (${entry.actionType}${said}) is illegal on this level — `
                    + `${reason}. The walk was driven on a different level, or the level moved.`;
            }
        } else {
            engine = next;
        }
        index += 1;
    }
    return 'the walk replays on this level after all — nothing refused it '
        + '(⛔ SEAM: `framesForActions` and this walk disagree)';
}

/** `expandEntries` inlined as a generator so the index is the TURN index. */
function* expandOne(actions) {
    for (const entry of actions ?? []) {
        const n = Number.isInteger(entry?.loops) ? entry.loops : 1;
        for (let i = 0; i < n; i += 1) yield { ...entry, loops: 1 };
    }
}
