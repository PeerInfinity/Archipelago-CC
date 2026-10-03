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
 *   `hold`  → the ZERO-TICK freeze tape holds (the W-Q2 worker solve
 *           needs the room still while it thinks; W0 (i): it latches on the
 *           first LIVE frame, before that frame's `super.update`, so the hold
 *           costs no stepped frame). ⛓ W7: a LOCATION plan ends HELD too
 *           (`endsHeld`), so the next goal in the room is a CONTINUATION from
 *           the shadow (`MID_ROOM_POLICY`). An EXIT plan still ends UN-held:
 *           a hold across its crossing would block the glue's redirect (W0 i.11).
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
import { PUZZLEMENT_HAZARDS } from './combat.js';
import { LEGACY_FADE_PER_LOAD } from './deadFrameBand.js';

/** Thrown for a tape that must not ship — by name. */
export class WasmPlaybackError extends Error {
    constructor(message) { super(message); this.name = 'WasmPlaybackError'; }
}
const refuse = (why) => { throw new WasmPlaybackError(why); };

/**
 * ⛓ W7 (plan `seedling-wasm-solver-plan.md` §2.4; ⚖ the user 2026-10-03: the
 * solver must not need to exit and re-enter a room to solve it): a goal asked
 * for in a room the engine HOLDS — a held arrival, or a location plan's held
 * end — is a CONTINUATION: `solveFromTape({staging: the arrival's, perTick:
 * every key shipped since})` (S0's `prefix`), shipped as one more same-world
 * tape with the persistence/save re-declared live (`liveDeclarations`). The
 * held room IS the shadow (`replayTape(arrival, shipped)`, measured equal to
 * the bit, §1.3), and the engine checks that before it solves.
 *
 * W2's policy survives as the FALLBACK (`FALLBACK_POLICY`): a FORCED
 * RE-ARRIVAL (`new Game(level, spawn)`, the room resets like a death) for a
 * room the engine never saw arrive (the COLD START: the bot's first goal in a
 * room that ran unwatched), a continuation the solver declines / runs out of
 * budget on, the X-split rule (`primarySplitRefusal`), a latched continuation,
 * and a shadow that is not the game (`shadowMismatch` — a staging bug, named).
 * ⛓ W8: the cold start is ADOPTED instead when `adoptionRefusal` passes.
 */
export const MID_ROOM_POLICY = 'continuation';
export const FALLBACK_POLICY = 'forced-re-arrival';

/** ⛓ W7 — the plans that END HELD: a location (the room is still the bot's after it); never an exit (W0 i.11). */
export const endsHeld = (goal) => goal?.kind === 'location';

/**
 * ⛓ W8 — ADOPT the cold start (plan `seedling-js-solver-walk-plan.md` §5.13;
 * ⚖ the user 2026-10-03: the solver must not need to exit and re-enter a room
 * to solve it). The bot's first goal finds a room that ran UNWATCHED: no
 * staging was taken at its arrival. It is adopted, with no re-arrival, exactly
 * when the live game provably IS "its arrival + N idle stepped ticks", and the
 * model's shadow of that is the same for every N ≥ 1. The engine then holds it
 * and serves the goal as a continuation from the shadow `arrival + 1 idle tick`.
 *
 * Measured live (p4e, the house cold start + host jumps into L7/L9/L13 left
 * unwatched): in a room with no `Mobile` but the player and no timed
 * puzzlement, N ∈ {1, 19, ~60–200, 2000} gives the SAME shadow digest (minus
 * the tick count) and the SAME plan, and each plan played on plan. ⛔ What
 * the readouts can NOT see, and what the clauses below therefore exclude:
 *   - a person's input. Not logged outside an armed tape (`Bot.as`
 *     `recordEdges` sits below `if (!armed) return`). A person who walked away
 *     and came back is caught by POSITION; one who pressed right then left for
 *     one tick each is back on the spawn to the bit with v = 0 and no rng draw,
 *     but FACING another way (measured: `down-stand` → `side-stand`). The
 *     model's `direction` would then be wrong, so FACING is a clause, read off
 *     `botMobiles`' player row (the stand animation names up/down/side).
 *   - hidden item state: slash/spear timers, a cut `Grass`, `slashDashed`. No
 *     readout carries them, so a player with ANYTHING to use
 *     (`inventory_slots`, the game's own scan) is not adopted.
 *   - the rng. "live `rng.state` == begin `rng.gameplay`" is FALSE at every
 *     arrival, because the build's draws land on the gameplay stream (`split`
 *     false; the house build is 91 steps, level 0 1200). It cannot be a clause
 *     without the build's draw count, which nothing reads at a cold start; the
 *     input and item clauses stand in for it.
 * The clauses run in this order; the first that fails is the refusal.
 */
export const ADOPT_CLAUSES = Object.freeze([
    'begin', 'tape', 'fade', 'inventory', 'player-state', 'mobiles', 'timed', 'velocity', 'position', 'facing',
]);

/**
 * The fade must be OVER, with at least one stepped tick after it (the shadow's
 * N ≥ 1). `Game.time` counts the fade's frames too, and the fade is a render
 * band (`deadFrameBand.LEGACY_FADE_PER_LOAD`, 17–24 per load), so the margin
 * is two bands' worth past the begin record.
 */
export const ADOPT_MIN_ELAPSED = 2 * LEGACY_FADE_PER_LOAD.max;

/** `Player.sprites()`'s stand animation for a `direction` (0 right, 1 up, 2 left, 3 down; 0 and 2 share `side`). */
export const standAnimFor = (direction) => (direction === 1 ? 'up' : direction === 3 ? 'down' : 'side');

/**
 * null when the live room may be adopted, else `{clause, why}`.
 *
 * @param {object} o
 * @param {object|null} o.beginEntry  `botSeam().beginEntry` (read before any `botLoadTape`)
 * @param {object} o.status   one `botStatus()`
 * @param {object} o.mobiles  `botMobiles()` parsed (`{mobiles: [...]}`)
 * @param {object|null} o.record  the room's map record (its `entities`)
 * @param {{x:number, y:number, direction:number}} o.shadow  the shadow's player after ONE idle tick
 */
export function adoptionRefusal({ beginEntry, status, mobiles, record, shadow }) {
    const no = (clause, why) => ({ clause, why });
    if (!beginEntry || beginEntry['begin.level'] !== status?.level) {
        return no('begin', `no begin record for level ${status?.level} (got ${beginEntry ? beginEntry['begin.level'] : 'none'}) — `
            + 'a swap may still be pending, or a tape load cleared it');
    }
    if (status.armed || status.held || status.arm?.pending) return no('tape', 'a tape is armed or holding — the room is not unwatched');
    const elapsed = status.game_time - beginEntry['save.time'];
    if (!(elapsed > ADOPT_MIN_ELAPSED)) {
        return no('fade', `only ${elapsed} game frame(s) since the begin record (needs > ${ADOPT_MIN_ELAPSED}): the fade may not be over`);
    }
    if ((status.inventory_slots ?? []).length > 0) {
        return no('inventory', `the player can use ${JSON.stringify(status.inventory_slots)} — a slash/spear/wand leaves state no readout carries`);
    }
    if (status.hits || status.hits_timer || status.drown_timer || status.frozen_timer || status.receive_input === false
        || status.menu || (status.cutscene ?? []).some(Boolean)) {
        return no('player-state', `hits ${status.hits}, hits_timer ${status.hits_timer}, drown ${status.drown_timer}, frozen ${status.frozen_timer}, `
            + `receive_input ${status.receive_input}, menu ${status.menu}`);
    }
    const rows = mobiles?.mobiles ?? [];
    const player = rows.filter((r) => /Player/.test(r.cls ?? ''));
    const others = rows.filter((r) => !/Player/.test(r.cls ?? ''));
    if (player.length !== 1) return no('mobiles', `${player.length} player row(s) in botMobiles`);
    if (others.length) return no('mobiles', `the room holds Mobile(s) besides the player: ${[...new Set(others.map((r) => r.cls))].join(', ')}`);
    const timed = [...new Set((record?.entities ?? []).map((e) => e.type).filter((t) => Object.prototype.hasOwnProperty.call(PUZZLEMENT_HAZARDS, t)))];
    if (timed.length) return no('timed', `the room holds a timed puzzlement (${timed.join(', ')}) — its phase rides on ticks nobody counted`);
    const p = player[0];
    if (p.vx !== 0 || p.vy !== 0) return no('velocity', `the player is moving (v ${p.vx}, ${p.vy})`);
    if (status.x !== shadow?.x || status.y !== shadow?.y) {
        return no('position', `the player stands at (${status.x}, ${status.y}), the arrival's shadow at (${shadow?.x}, ${shadow?.y})`);
    }
    const want = `${standAnimFor(shadow.direction)}-stand`;
    if (!String(p.anim ?? '').endsWith(want)) {
        return no('facing', `the player's stand animation is ${JSON.stringify(p.anim)}, the arrival's facing is ${want} — someone turned the player`);
    }
    return null;
}

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
 * an entity that reads a modelled field no verb carries
 * (`wasmArrival.UNREAD_MODELLED_READERS`). ⛓ W5 — that table is EMPTY: W1's
 * one case, the moonrock's `beam`/`rockSet` (level 0, the overworld hub), is
 * read off `readState` now, so only "no such level" refuses today.
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
                + 'no read-only verb carries, so the wasm runtime cannot stage the room';
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
 *   'continue'         ⛓ W7 — the engine HOLDS the goal's room (`heldLevel`):
 *                      a continuation from the shadow (`MID_ROOM_POLICY`)
 *   'await-arrival'    the player is not in the goal's room — wait for the
 *                      crossing that brings them there (its arrival is held)
 *   'force-re-arrival' the player is in the room and the engine holds no
 *                      staging of it (`FALLBACK_POLICY`: the cold start)
 */
export function goalAction({ goal, liveLevel, playing = false, heldLevel = null }) {
    if (playing) return 'queue';
    if (heldLevel !== null && heldLevel === goal.level) return 'continue';
    if (liveLevel !== goal.level) return 'await-arrival';
    return 'force-re-arrival';
}

/**
 * ⛓ W7 — `staging` with its DECLARATIONS replaced by the live ones: the
 * persistence = `botStatus.persistence_cleared` exactly, the three save arrays
 * as the game holds them. A continuation's tape boots the same arrival staging
 * (the model's start) but declares what the game holds NOW (a chest the last
 * plan opened is cleared), so `exactDeclarationRefusal` holds by construction.
 */
export function liveDeclarations(staging, status) {
    if (!staging || !status) refuse('wasmPlayback: no staging or no botStatus to re-declare');
    return {
        ...staging,
        persistence: sortClears(status.persistence_cleared),
        save: { ...(staging.save ?? {}), keys: indicesOf(status.save?.keys), totem_parts: indicesOf(status.save?.totem_parts),
            seal_parts: sealValues(status.save?.seal_parts) },
    };
}

/**
 * ⛓ W7 — the X-SPLIT RULE (§1.3: "not measured: `primary` held across a
 * seam"). A tape's span ending at its last tick RELEASES the key at the finish
 * (`Bot.as` span loop), and the next tape presses it again: for a movement key
 * that is harmless (measured, L6 `right`, L86 `up`), but for `primary` (X) the
 * re-press is a fresh `Input.pressed` — a SWING the model, which saw X held
 * straight through, never planned. A continuation whose first tick presses X
 * while the previous shipped tick held it is refused (→ the fallback).
 *
 * @param {Array<Iterable<string>>} shipped  every key set shipped since the arrival
 * @param {Array<Iterable<string>>} solution  the continuation's key sets
 * @returns {string|null}
 */
export function primarySplitRefusal(shipped, solution) {
    const last = shipped?.length ? new Set(shipped[shipped.length - 1]) : null;
    const first = solution?.length ? new Set(solution[0]) : null;
    if (last?.has('primary') && first?.has('primary')) {
        return 'the continuation\'s first tick presses X (primary) while the previous tape held it at its end — the '
            + 'finish released X, so the game would see a fresh press (a swing) the model never planned (the X-split rule)';
    }
    return null;
}

/**
 * ⛓ W7 — the HELD game against the shadow (`replayTape(arrival, shipped)`):
 * null when the player row is equal to the bit (level, x, y — §1.3 measured
 * 9/9 exact), else `{expected, got}`. ⛔ A mismatch is a STAGING BUG (the
 * plan's STOP), never noise: the engine names it and falls back.
 */
export function shadowMismatch(shadowRow, status) {
    if (!shadowRow || !status) return { expected: shadowRow ?? null, got: null };
    if (shadowRow.level === status.level && shadowRow.x === status.x && shadowRow.y === status.y) return null;
    return { expected: { level: shadowRow.level, x: shadowRow.x, y: shadowRow.y }, got: { level: status.level, x: status.x, y: status.y } };
}

/**
 * ⛓ W7 — THE GLUE QUERY: may the engine hold the arrival it just saw? A hold
 * BLOCKS every world swap, the glue's own included (W0 i.11), so an arrival
 * the glue is about to REDIRECT must not be held — the redirect's own landing
 * (a later begin record) is the one to hold. Measured (`seedling_atlas`, hub →
 * house door): the glue's teleport is queued in the SAME frame as the game's
 * door report, but it waits in the adapter's invoke queue until the 100 ms
 * push, so the door's own begin lands first (~0.3 s) and the redirect's ~0.5 s
 * later. Three arms, each its own reason:
 *
 *   marks    the region binding is waiting on a swap (`pendingArrival` — a
 *            cross-level teleport not landed, `pendingBounce` — a refused
 *            door, `pendingDeparture` — an external door) or is PARKED
 *   queued   a teleport sits in the adapter's invoke queue, not yet pushed
 *   pushed   a teleport was pushed to the game WHILE THIS begin record was
 *            the live one (the adapter stamps each push with the begin record
 *            it saw, `WasmBridgeAdapter.lastInvocationPush`): its swap lands
 *            NEXT. A same-level teleport arms no mark and its landing is a
 *            begin record and nothing else, so only the stamp can see it. The
 *            measured hazard: the 100 ms push fired between the game's door
 *            frame and the sampler's read (here 0.3 s apart) — queue empty,
 *            no mark, the redirect in flight.
 *
 * @param {{marks?:string[], queued?:number, pushedOn?:object|null}|null} swap  `SeedlingRegionGlue.swapState()`
 * @param {object|null} beginEntry  the begin record just seen (`botSeam().beginEntry`)
 * @returns {string|null} why not, or null (hold)
 */
export function arrivalHoldBlocker(swap, beginEntry) {
    if (!swap) return null;
    if (swap.marks?.length) return `the region binding waits on a swap (${swap.marks.join(', ')})`;
    if ((swap.queued ?? 0) > 0) return `${swap.queued} teleport(s) queued for the game, not yet pushed`;
    if (swap.pushedOn && beginEntry && same(swap.pushedOn, beginEntry)) {
        return 'a teleport was pushed to the game after this arrival landed — its swap lands next';
    }
    return null;
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
