/**
 * seedlingDemo/wasmPlayback — **THE HOST TAPE A WASM PLAYBACK SHIPS, AND THE
 * RULES IT SHIPS UNDER** (solver-walk W2; plan
 * `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.3 W2, with W0's hard rules
 * (§5.5) and W1's hand-off (§5.6 "For W2")). DOM-free and clock-free: the
 * controller's engine (`flashPanel/seedlingWasmPlayback.js`) owns the game and
 * the timers; everything here is a pure function of reads it was handed.
 *
 * ── THE TAPE (`shippedTape`) ─────────────────────────────────────────────
 *
 * Built from the SAME staging the solve ran from (`wasmArrival.stagingFromWasmArrival`),
 * through `buildStagedTape` (W1 round-tripped it), then projected for the game
 * (`gameVisibleTape`). Three blocks are NOT shipped as the solve saw them:
 *
 *   `seam`  → null. W0 ii.4: a declared item write reads as a player pickup.
 *           ⛔ AND NO PARTIAL BLOCK IS POSSIBLE (W2, from the source): once a
 *           tape declares a seam at all, `botStart` writes `beam`, `rockSet`,
 *           `firstUse`, `extended`, `grassCut` and the music pair
 *           UNCONDITIONALLY (`Bot.as` R7 block — only `hitsMax`/`time` are
 *           gated on non-zero) — and those are exactly the rows no read-only
 *           verb carries (`wasmArrival.UNREAD_FIELDS`). Keeping `time`,
 *           `primary` or `cutscene` would therefore also overwrite seven live
 *           fields with guesses. The world is the live one (same-world start),
 *           so every seam value the solve declared IS already the game's.
 *   `rng`   → seed 0, fp 0 (= "do not touch": `Bot.as` writes them only when
 *           non-zero). The staging's seeds are the BEGIN record's — the
 *           streams before the build drew from them (measured: begin
 *           `rng.gameplay` 811240737 vs the live `rng.state` 771911645 at the
 *           same arrival) — so re-declaring them would REWIND the live stream
 *           under an already-built world. `split` IS written unconditionally
 *           (`Rng.split = rngSplit`), so it ships the live value; a split
 *           stream is REFUSED (a split `botStart` also resets the cosmetic
 *           stream, whose live state no verb reads).
 *   `hold`  → only the ZERO-TICK freeze tape holds (the W-Q2 worker solve
 *           needs the room still while it thinks; W0 (i): it latches on the
 *           first LIVE frame, before that frame's `super.update`, so the hold
 *           costs no stepped frame). The PLAN tape ends UN-held: v1's next
 *           goal re-arrives anyway (`MID_ROOM_POLICY`), and a hold across an
 *           exit would block the glue's redirect (W0 i.11).
 *
 * Kept exactly: `boot` = this level + the SPAWN (same world, `Bot.as:1801`),
 * `persistence` = `botStatus.persistence_cleared` EXACTLY, all THREE save
 * arrays (W0 ii.5: an omitted array is wiped), `pins` = the pins it was solved
 * under (W1).
 *
 * ── THE DECLARATION RULE (`exactDeclarationRefusal`) ─────────────────────
 *
 * W0 ii.6/ii.7: a declared clear the player never earned is a REAL check when
 * it sorts last, and a silently-cleared flag otherwise. A tape is shipped only
 * when its declarations equal the live `botStatus` field for field; the
 * binding's arming-window guard (`seedlingCheckBinding.ignoreHostStart`,
 * ⚖ W0-Q1) is the second, independent net.
 */

import { buildStagedTape } from './botDriverV1.js';
import { gameVisibleTape, holdingWindowTape, parseTape } from './tapeFormat.js';
import { UNREAD_MODELLED_READERS } from './wasmArrival.js';

/** Thrown for a tape that must not ship — by name. */
export class WasmPlaybackError extends Error {
    constructor(message) { super(message); this.name = 'WasmPlaybackError'; }
}
const refuse = (why) => { throw new WasmPlaybackError(why); };

/**
 * ⚖ W-Q3 / W2: a goal asked for when the player is NOT at a fresh arrival is
 * served by a FORCED RE-ARRIVAL — a host `new Game(level, spawn)` (the glue's
 * own teleport recipe), so the room resets like a death and the solve starts
 * from a real arrival. Chosen over a continuation solve from a held end
 * (the S0 `prefix` path) because the next goal's start state is then the
 * game's own begin record, never the model's prediction of where the last
 * tape left the room.
 */
export const MID_ROOM_POLICY = 'forced-re-arrival';

/** Booleans → their true indices (the tape's save-array spelling). */
const indicesOf = (arr) => (arr ?? []).flatMap((v, i) => (v ? [i] : []));
const sealValues = (seals) => {
    const s = seals ?? [];
    const firstEmpty = s.indexOf(-1);
    return firstEmpty === -1 ? [...s] : s.slice(0, firstEmpty);
};
const sortClears = (list) => [...(list ?? [])].map((c) => ({ level: c.level, tag: c.tag }))
    .sort((a, b) => a.level - b.level || a.tag - b.tag);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The game-visible tape for `staging` + `keys` (key sets, one per tick — the
 * solve's `plan.solution`; `[]` = the zero-tick freeze tape).
 *
 * @returns {object} a parsed, game-visible tape (serialise with JSON.stringify)
 */
export function shippedTape({ staging, keys = [], hold = false, name = 'wasm-playback' }) {
    if (!staging?.boot) refuse('wasmPlayback: no staging to ship a tape from');
    if (staging.rng?.split) {
        refuse('wasmPlayback: the arrival runs a SPLIT rng stream — a split botStart resets the cosmetic stream, '
            + 'and no read-only verb carries its live state; the tape would rewind it to a guess');
    }
    const stripped = {
        ...staging,
        seam: null,
        rng: { seed: 0, split: false, cosmetic: 0, fp: 0 },
    };
    const perTick = keys.map((k) => (k instanceof Set ? k : new Set(k)));
    const parsed = parseTape(buildStagedTape({ staging: stripped, perTick, name }));
    return gameVisibleTape(hold ? holdingWindowTape(parsed) : parsed);
}

/**
 * null when `tape` declares EXACTLY the live state `status` reports, else the
 * refusal naming the first difference. The shape rules (`seam` null, the rng
 * left alone, the boot this level) are checked too, so a tape built by any
 * other path is caught here as well.
 */
export function exactDeclarationRefusal(tape, status) {
    if (!tape || !status) return 'no tape or no botStatus to check the declaration against';
    if (tape.boot?.level !== status.level) {
        return `the tape boots level ${tape.boot?.level}, the game is in level ${status.level} — a host tape `
            + 'boots the room the player is in (same world)';
    }
    const declared = sortClears(tape.persistence);
    const live = sortClears(status.persistence_cleared);
    if (!same(declared, live)) {
        const fake = declared.filter((c) => !live.some((l) => l.level === c.level && l.tag === c.tag));
        const lost = live.filter((c) => !declared.some((d) => d.level === c.level && d.tag === c.tag));
        return `the tape's persistence is not the game's cleared set — ${fake.length
            ? `declares ${JSON.stringify(fake)} the player never cleared (a FAKE check if it sorts last, W0 ii.6)` : ''}${
            fake.length && lost.length ? '; ' : ''}${lost.length
            ? `omits ${JSON.stringify(lost)} (botStart would RESTORE them)` : ''}`;
    }
    const save = tape.save ?? {};
    const rows = [
        ['keys', indicesOf(status.save?.keys)],
        ['totem_parts', indicesOf(status.save?.totem_parts)],
        ['seal_parts', sealValues(status.save?.seal_parts)],
    ];
    for (const [k, want] of rows) {
        if (!Array.isArray(save[k])) return `the tape omits save.${k} — botStart WIPES an omitted array (W0 ii.5)`;
        if (!same(save[k], want)) return `save.${k} ${JSON.stringify(save[k])} is not the game's ${JSON.stringify(want)}`;
    }
    if (tape.seam !== null && tape.seam !== undefined) {
        return 'the tape declares a seam block — an item write reads as a player pickup (W0 ii.4) and a declared '
            + 'block writes seven fields no verb reads';
    }
    if ((tape.rng?.seed ?? 0) !== 0 || (tape.rng?.fp ?? 0) !== 0) {
        return 'the tape re-seeds the rng — the staging\'s seeds are the begin record\'s, before the build drew';
    }
    if (Boolean(tape.rng?.split) !== Boolean(status.rng?.split)) {
        return `the tape's rng.split ${tape.rng?.split} is not the game's ${status.rng?.split} (botStart writes it unconditionally)`;
    }
    return null;
}

/**
 * A goal the wasm runtime refuses BY NAME before anything moves: a room with
 * an entity that reads a modelled field no verb carries (W1: the moonrock's
 * `beam`/`rockSet` — level 0, the overworld hub, holds one).
 *
 * @param {{level:number}} goal
 * @param {object|null|undefined} record  the goal room's record; undefined = not loaded yet (no verdict)
 * @param {{source?: string}} [o]  ⛓ WG — what the records are, for the "no such level" text
 * @returns {string|null}
 */
export function wasmGoalRefusal(goal, record, { source = 'vanilla map' } = {}) {
    if (record === undefined) return null;
    if (record === null) return `the ${source} has no level ${goal?.level} to solve`;
    const types = new Set((record.entities ?? []).map((e) => e.type));
    for (const [field, readers] of Object.entries(UNREAD_MODELLED_READERS)) {
        const hit = readers.filter((t) => types.has(t));
        if (hit.length) {
            return `level ${goal.level} holds a ${hit.join('/')}, which reads \`${field}\` — a modelled save field `
                + 'no read-only verb carries, so the wasm runtime cannot stage the room (W1; the W5 seam rows would)';
        }
    }
    return null;
}

/**
 * What to do with a goal, given the live level and the engine's state.
 *
 *   'queue'            a plan tape is still playing — the goal waits for it to
 *                      finish (⚖ W0-Q2: a SealController freeze is waited out,
 *                      never cut by a teleport)
 *   'await-arrival'    the player is not in the goal's room — wait for the
 *                      crossing that brings them there
 *   'force-re-arrival' the player is in the room, mid-play (`MID_ROOM_POLICY`)
 */
export function goalAction({ goal, liveLevel, playing = false }) {
    if (playing) return 'queue';
    if (liveLevel !== goal.level) return 'await-arrival';
    return 'force-re-arrival';
}

/**
 * Fold one `botDrain()` answer into the running progress. `ticks` is the
 * count of stepped ticks drained so far; `rows` keeps them (the W3 compare).
 */
export function foldDrain(progress, drain) {
    const rows = [...(progress?.rows ?? []), ...((drain?.ticks ?? []).map((r) => ({ t: r.t, level: r.level, x: r.x, y: r.y })))];
    return { rows, ticks: rows.length };
}

/**
 * ⛓ W-Q1 (detection only — W3 acts on it): the first drained row that is not
 * where the plan said. `expected[i]` is the row BEFORE tick i (solveFromTape),
 * and so is the game's drained row `t` — MEASURED (W2 live run): a 102-tick
 * chest tape drains 103 rows, row 0 is the arrival (56, 56) = `expected[0]`
 * and the last is the end row (56, 34.55) = `expected[102]`. Hence `offset` 0.
 * A row in another level when the plan's row has also left
 * `roomLevel` counts as agreeing (W1: the glue redirects the house's door, so
 * a crossing is "left the room", never an exact (level, x, y)).
 *
 * @returns {{t:number, expected:object, got:object}|null}
 */
export function firstDivergence(expected, rows, { roomLevel, offset = 0 } = {}) {
    for (const r of rows ?? []) {
        const want = expected?.[r.t + offset];
        if (!want) continue;
        if (want.level !== roomLevel && r.level !== roomLevel) continue;
        if (want.level !== r.level || want.x !== r.x || want.y !== r.y) {
            return { t: r.t, expected: { level: want.level, x: want.x, y: want.y }, got: { level: r.level, x: r.x, y: r.y } };
        }
    }
    return null;
}

/**
 * ⚖ W-Q3 (W3): how many FORCED RE-ARRIVALS one goal may spend on divergences
 * before it fails by name. The divergence after the last one is the failure —
 * so a goal plays at most `MAX_RECOVERIES + 1` plan tapes.
 */
export const MAX_RECOVERIES = 3;

/**
 * W3 — what a divergence (`firstDivergence`'s answer) does to the goal.
 *
 *   'done'     the goal's effect already LANDED (a location goal whose clear
 *              is in the game's cleared set — the game reported the check
 *              itself): re-solving would only meet the solver's "already
 *              open" refusal, so the leg ends done, its divergence recorded.
 *              An exit cannot get here: `firstDivergence` already counts a
 *              row out of the room as agreeing.
 *   'repeat'   ⛓ W4 — this divergence EXACTLY repeats the goal's previous one
 *              (`isExactRepeat`: the same tick, the same game row). A
 *              re-arrival re-solves the same plan from the same staging, so a
 *              deterministic model/game residue recurs every time (§1.2 of the
 *              wasm-solver plan: L28/L30/L45/L88 diverged at the same tick and
 *              position on all 4 attempts) — fail by name now, not after the bound.
 *   'recover'  `botReset` + a forced re-arrival + a fresh solve from it.
 *   'fail'     `recoveries` already spent `MAX_RECOVERIES` — a named failure,
 *              never a silent stall and never a walk on blind.
 *
 * The tolerance is ZERO px, on purpose: every leg W2 measured (102 + 6 + 558
 * rows, chest / door / kill-lock) agreed with the plan EXACTLY — the drained
 * Numbers and the model's are the same doubles — so any non-zero gap is the
 * game and the model disagreeing, not noise. A death shows as a row at the
 * respawn (a position mismatch); a `SealController` freeze shows as NO new
 * rows (never a wrong row), so it can never reach this function (⚖ W0-Q2).
 *
 * @param {{goal:object, recoveries:number, status?:object|null, divergence?:object|null, previous?:object|null}} o
 *   `status` = one `botStatus` read at the divergence; `previous` = the goal's last divergence (null on the first)
 * @returns {'done'|'repeat'|'recover'|'fail'}
 */
export function divergenceAction({ goal, recoveries, status = null, divergence = null, previous = null }) {
    if (goal?.kind === 'location' && Number.isInteger(goal.tag)
        && (status?.persistence_cleared ?? []).some((c) => c.level === goal.level && c.tag === goal.tag)) return 'done';
    if (isExactRepeat(previous, divergence)) return 'repeat';
    return recoveries >= MAX_RECOVERIES ? 'fail' : 'recover';
}

/**
 * ⛓ W4 — whether divergence `d` is EXACTLY `prev` again: the same tick and the
 * same game row (level, x, y — the doubles the drain carried, compared with
 * `===`). Anything less (another tick, a game row 1e-15 px off) is a new
 * divergence and the recovery is spent as before.
 */
export function isExactRepeat(prev, d) {
    if (!prev || !d) return false;
    return prev.t === d.t && prev.got?.level === d.got?.level && prev.got?.x === d.got?.x && prev.got?.y === d.got?.y;
}

/** The named failure for a goal that diverged after spending every recovery. */
export function divergenceFailure({ goal, recoveries, divergence }) {
    const d = divergence;
    return `the game left the plan ${recoveries + 1} times on ${goal?.name ?? goal?.kind} in level ${goal?.level} `
        + `(gave up after ${recoveries} forced re-arrival${recoveries === 1 ? '' : 's'}, the bound is ${MAX_RECOVERIES}); `
        + `last at tick ${d?.t}: expected ${JSON.stringify(d?.expected)}, game ${JSON.stringify(d?.got)}`;
}

/** ⛓ W4 — the named failure for a divergence that exactly repeats the previous one. */
export function divergenceRepeatFailure({ goal, recoveries, divergence }) {
    const d = divergence;
    return `the game left the plan on ${goal?.name ?? goal?.kind} in level ${goal?.level} at the SAME tick with the SAME `
        + `game row ${recoveries + 1} times in a row (gave up after ${recoveries} forced re-arrival${recoveries === 1 ? '' : 's'}: `
        + 'an exact repeat is a deterministic model/game residue, which a re-solve from the same arrival replays); '
        + `at tick ${d?.t}: expected ${JSON.stringify(d?.expected)}, game ${JSON.stringify(d?.got)}`;
}

/**
 * ⛔ W3, MEASURED: `botReset` FORGETS THE TAPE BUT NOT ITS KEYS. A plan tape
 * presses its keys by dispatching stage `KeyboardEvent`s (`Bot.dispatchKey`);
 * a tape's own spans release them at their end, but `botReset` mid-span
 * releases nothing (`Bot.as` botReset — no `dispatchKey(…, false)`). The
 * key stays held across the forced re-arrival (and across a `new Game`), and
 * the NEXT plan's DOWN edge on it is a no-op: on the live recovery the
 * re-solved chest tape's echo read `held ["up","down"]` with
 * `press_totals.down 0`, and that attempt diverged at tick 1 with the player
 * not moving at all (up + a stale down cancel, `Player.input`).
 *
 * ⛔ AND A LONE `keyup` DOES NOT RELEASE IT (scratch measurement, p4e
 * headless, 0 of 4): the runtime drops a KeyUp for a key it never saw go down
 * (Ruffle's physical-key rule, SWFRecomp `avm2_display.c` IN_KEY_UP), and
 * the tape's keys never passed through it. A `keydown` + `keyup` PAIR does
 * release (every trial): both are queued in order and delivered on the next
 * tick, and the keydown is a no-op in FlashPunk's `Input` for a key already
 * held (no press edge). The same pair on a key NOBODY holds would be a fresh
 * PRESS edge (`primary` = a sword swing or an interaction), so the pair goes
 * ONLY to `keysHeldAtReset`.
 */
export const TAPE_KEY_RELEASES = Object.freeze([
    { name: 'right', key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    { name: 'up', key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    { name: 'left', key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    { name: 'down', key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    { name: 'primary', key: 'x', code: 'KeyX', keyCode: 88 },
    { name: 'secondary', key: 'c', code: 'KeyC', keyCode: 67 },
    { name: 'inventory', key: 'v', code: 'KeyV', keyCode: 86 },
    { name: 'inventory2', key: 'i', code: 'KeyI', keyCode: 73 },
].map(Object.freeze));

/**
 * The tape keys a `botReset` read by `status` would leave HELD. Each armed
 * `Bot.update` dispatches tick `tick`'s span edges (DOWN at `from`, UP at
 * `to`, spans `[from, to)`), records the edge echo, then `tick++` — so at
 * `status.tick = T` the tape holds EXACTLY `solution[T-1]`, and the echo
 * (`status.input`, `t = T-1`) is the game's own `Input.check` of the same
 * frame. The answer is their intersection: a key only a person holds is not
 * the tape's to release, and a key the plan does not hold is never paired
 * (the pair would be a fresh press). A finished or un-armed tape holds
 * nothing (its own UP edges ran).
 *
 * ⛔ Measured wrong first: requiring the plan to hold the key at `T` as well
 * skipped `up` whenever the next tick changed keys (the chest plan's tick 10
 * `up` → tick 11 `down`), and that reset left `up` stale (trace, 1 run in 3).
 *
 * @param {{status:object|null, solution:Array<Iterable<string>>|null}} o
 * @returns {string[]} key names, in `TAPE_KEY_RELEASES` order
 */
export function keysHeldAtReset({ status, solution }) {
    if (!status?.armed || status.finished || !Array.isArray(solution)) return [];
    const t = status.tick;
    if (!Number.isInteger(t) || t < 1 || t > solution.length) return [];
    const plan = new Set(solution[t - 1] ?? []);
    const echo = new Set(status.input?.held ?? []);
    return TAPE_KEY_RELEASES.map((k) => k.name).filter((n) => echo.has(n) && plan.has(n));
}
