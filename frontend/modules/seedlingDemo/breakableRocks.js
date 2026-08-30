/**
 * seedlingDemo/breakableRocks — THE SIXTH PRESS ARM, and the first one
 * whose effect is a wall going away.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §17.
 *
 * ── WHY THIS EXISTS NOW ───────────────────────────────────────────────
 *
 * `presses.PRESS_ARM_POLICY.BreakableRock` has said `refused` since R4,
 * with the reason "despawns at its hit count AND writes persistence" — a
 * refusal rather than a model because no committed route had ever needed
 * one. `probe-seedling-r5-feather` is where that stopped being true:
 * **L92's two `breakablerock`s are the only thing between the L87 door and
 * the L91 door**, and the L91 door is the only way into L89's top, and
 * L89's top is the only side the feather can be reached from. Broken:
 * 256 cells and the door. Unbroken, or either one alone: 14, 14, 92 and no
 * door. The feather's price is two sword swings.
 *
 * ── THE TRANSCRIPTION, IN FOUR PARTS ──────────────────────────────────
 *
 * `Puzzlements/BreakableRock.as` is 76 lines and every one of them that
 * matters is quoted here.
 *
 * **1. WHAT BREAKS IT.** `Player.as:1071-1074` is
 * `(e as BreakableRock).hit(hasGhostSword ? 1 : 0)` and `hit(_t)` is
 * `if (rockType <= _t) { ...play("break") }`. `Game.as:2158` builds the
 * `breakablerockghost` family with `new BreakableRock(x, y, tag, 1)` and
 * everything else with the default `_type = 0`. So a **plain sword breaks
 * a rockType-0 rock** and only the ghostsword touches a rockType-1 one.
 * That is the whole item gate, and the ladder has held a sword since R1.
 *
 * **2. WHEN IT GOES.** `hit()` does not remove anything — it starts an
 * animation, and `endAnim` (the Spritemap's completion callback, wired in
 * the CONSTRUCTOR) is what calls `FP.world.remove(this)`. So the rock is
 * SOLID for the whole animation and a leg that walks the moment it presses
 * walks into a wall. See `HIT_TO_GONE_TICKS` for the count and its
 * derivation.
 *
 * **3. WHAT IT WRITES.** `endAnim` is
 * `Game.setPersistence(tag, false); FP.world.remove(this)` —
 * unconditionally, including for `tag < 0`, which its own `check()` guard
 * (`tag >= 0 && !checkPersistence(tag)`) skips. L92's two rocks are BOTH
 * `tag = -1`, so both writes land out of band. See `outOfBandFlagFor`.
 *
 * **4. ⛔ AND IT COMES BACK.** `check()` only removes a rock when
 * `tag >= 0 && !Game.checkPersistence(tag)`, so a `tag = -1` rock is
 * rebuilt whole by every `new Game(92, ...)`. A break is PER VISIT. A walk
 * that leaves L92 and comes back pays for both rocks again — which is a
 * route fact, not a modelling choice, and `rockStateFor`'s per-visit
 * lifetime is where it lives.
 */

export class BreakableRockError extends Error {
    constructor(message) { super(message); this.name = 'BreakableRockError'; }
}
const fail = (m) => { throw new BreakableRockError(m); };

/** `Game.as:525`. Restated so the out-of-band arithmetic can be read here. */
export const TAGS_PER_LEVEL = 30;

/** `add("break", [0, 1, 2, 3], 20)` — `BreakableRock.as:40`. */
export const BREAK_ANIM = Object.freeze({ frames: 4, frameRate: 20 });

/**
 * `Engine.as:270` — `private const MAX_ELAPSED:Number = 0.0333`, and
 * `Engine.as:161-163` clamps `FP.elapsed` to it every frame.
 *
 * ⚠ 0.0333, NOT 1/30, and the two are ASSERTED to agree here rather than
 * assumed to: `animCallbackTick` returns 7 for both, because 20/30 = 0.6667
 * accumulates to 0.9999999999999999 on the third update in doubles and
 * misses the `>= 1` by one ulp — the same tick the truncated constant
 * misses it by 0.006. A derivation that only works for one of them would
 * be a coincidence this arc has been bitten by before, so the test drives
 * both.
 */
export const FP_MAX_ELAPSED = 0.0333;

/**
 * Ticks from the `play("break")` to the `endAnim` callback, by SIMULATING
 * `Spritemap.update` rather than dividing.
 *
 * ```
 *   _timer += _anim._frameRate * FP.elapsed;      // 20 * 0.0333 = 0.666
 *   while (_timer >= 1) { _timer--; _index++; ... }
 * ```
 *
 * The callback fires on the update that takes `_index` to `_frameCount`.
 * Division would say `4 / 0.666 = 6.006 -> 7`, which is the right answer
 * for the wrong reason: the `while` loop can advance the index TWICE in
 * one update once the fractional part has built up, and on a longer
 * animation that is a different number. The loop is transcribed.
 *
 * @param {object=} anim  `{frames, frameRate}`; defaults to `BREAK_ANIM`
 * @param {number=} elapsed  `FP.elapsed`; defaults to the clamp
 */
export function animCallbackTick(anim = BREAK_ANIM, elapsed = FP_MAX_ELAPSED) {
    if (!Number.isFinite(anim?.frames) || anim.frames <= 0) {
        fail('animCallbackTick: an animation needs a positive frame count');
    }
    if (!(elapsed > 0)) fail('animCallbackTick: FP.elapsed must be positive');
    let timer = 0;
    let index = 0;
    for (let tick = 1; tick <= 10000; tick += 1) {
        timer += anim.frameRate * elapsed;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            // `_index == _anim._frameCount` -> the callback. `_loop` is TRUE
            // (`add`'s default), so the index wraps and the animation would
            // keep running — but `endAnim` removes the entity from the
            // world, so the wrap is never seen.
            if (index === anim.frames) return tick;
        }
    }
    return fail('animCallbackTick: the animation never completed');
}

/**
 * Ticks from the tick the slash RECT FIRED to the tick the rock is gone.
 *
 * ⚠ THE ANCHOR IS THE FIRED TICK, NOT THE PRESS TICK. `Player.update` calls
 * `slash()` before `input()` sets `slashing`, so a press at T fires its
 * rect at T+1 — `levelRun.applyThrust` already runs on the fired tick and
 * carries both numbers, so this constant is anchored where it is applied.
 *
 * ⚠ AND IT IS AN UPPER BOUND BY ONE. `World.update` runs
 * `e._graphic.update()` for each entity in list order, and whether the
 * rock's graphic is updated BEFORE or AFTER the player's `hit()` in the
 * same pass depends on the add order `Game.as` happens to use. So the game
 * removes the rock at fired + 6 or fired + 7, and the model takes the
 * LATER: a model that clears the cell early would plan a step the game
 * refuses, and one that clears it late only makes a leg wait. Which is why
 * `assertWaitCovers` exists — a leg whose wait comfortably exceeds both
 * cannot tell them apart, and every committed leg is required to be one.
 */
export const HIT_TO_GONE_TICKS = animCallbackTick();

/**
 * The leg obligation: how long after the press a leg must wait before it
 * may plan through the cell.
 *
 * Not `HIT_TO_GONE_TICKS` reused (the `TICKS_FROM_PRESS_TO_WALKABLE`
 * lesson, one mechanic later): one is the TRANSCRIPTION and one is the
 * LEG's promise, and the gap between them is exactly the ±1 the update
 * order leaves open. 20 is ~3x the animation and costs a fifth of a
 * second of tape.
 */
export const WAIT_AFTER_PRESS_TICKS = 20;

/**
 * ⛔ `Game.setPersistence(tag, o)` RESOLVED, including for `tag < 0`.
 *
 * ```
 *   Game.as:1823-1826   setPersistence(tag, o, _l = -1) ->
 *                       Main.levelPersistenceSet(_l >= 0 ? _l : Main.level, tag, o)
 *   Main.as:202         levelPersistence[i * Game.tagsPerLevel + j] = _t
 * ```
 *
 * With `j = -1` the index is `level * 30 - 1`, which is `(level - 1) * 30
 * + 29` — **the PREVIOUS level's last slot**. `r5Acceptance`'s
 * `FIRE_OUT_OF_BAND_FLAG` is this same arithmetic hard-coded for L32
 * ({31,29}); this is the general form, and the two are asserted against
 * each other in the tests so neither can drift.
 *
 * @param {number} level  `Main.level` at the moment of the write
 * @param {number} tag    the entity's own tag
 * @returns {{level: number, tag: number, outOfBand: boolean}}
 */
export function outOfBandFlagFor(level, tag) {
    if (!Number.isInteger(level) || level < 0) {
        fail(`outOfBandFlagFor: level must be a non-negative integer, got ${level}`);
    }
    if (!Number.isInteger(tag)) fail(`outOfBandFlagFor: tag must be an integer, got ${tag}`);
    const index = level * TAGS_PER_LEVEL + tag;
    if (index < 0) {
        fail(`outOfBandFlagFor: L${level} tag ${tag} resolves to index ${index}, which is `
            + 'before the start of `levelPersistence`. The game would write outside the '
            + 'array; this model refuses to guess what that does.');
    }
    return Object.freeze({
        level: Math.floor(index / TAGS_PER_LEVEL),
        tag: index % TAGS_PER_LEVEL,
        outOfBand: tag < 0 || tag >= TAGS_PER_LEVEL,
    });
}

/** Is this rock breakable by this weapon and inventory? `hit(_t)`'s test. */
export function rockBreaksUnder(rockType, inventory = {}) {
    const t = inventory.hasGhostSword ? 1 : 0;
    return (rockType ?? 0) <= t;
}

/**
 * The per-VISIT break state for one level.
 *
 * `{id -> {hitTick, goneAt, tag, rockType, x, y}}`, the `bridgeStateFor`
 * shape, and per visit for the reason in part 4 of the header: a `tag = -1`
 * rock is rebuilt by every `new Game`.
 */
export function createRockState() {
    return new Map();
}

/**
 * Record a hit. Idempotent for a rock already breaking, because
 * `Spritemap.play(name)` early-returns when that animation is already
 * playing (`if (!reset && _anim && _anim._name == name) return _anim`) —
 * so a second swing does NOT restart the timer, and a model that reset it
 * would push the despawn later than the game does.
 *
 * @returns {{id: string, started: boolean, goneAt: number}}
 */
export function hitRock(state, rock, firedTick) {
    if (!(state instanceof Map)) fail('hitRock: needs the run\'s rock state');
    if (!Number.isInteger(firedTick) || firedTick < 0) {
        fail(`hitRock: firedTick must be a non-negative integer, got ${firedTick}`);
    }
    const id = rock.rockId;
    if (!id) fail('hitRock: the solid carries no `rockId` — the world was built without one');
    const already = state.get(id);
    if (already) return { id, started: false, goneAt: already.goneAt };
    const entry = {
        hitTick: firedTick,
        goneAt: firedTick + HIT_TO_GONE_TICKS,
        tag: rock.persistTag ?? rock.tag ?? -1,
        rockType: rock.rockType ?? 0,
        x: rock.x,
        y: rock.y,
    };
    state.set(id, entry);
    return { id, started: true, goneAt: entry.goneAt };
}

/** The ids that are GONE as of `observation`. The `openBridgeIds` shape. */
export function brokenRockIds(state, observation) {
    const gone = new Set();
    for (const [id, r] of state) if (observation >= r.goneAt) gone.add(id);
    return gone;
}

/**
 * A leg's promise, checked: the wait after a press covers the despawn with
 * room to spare, so the ±1 in `HIT_TO_GONE_TICKS` cannot reach the stream.
 */
export function assertWaitCovers(waitTicks, what) {
    if (!Number.isInteger(waitTicks) || waitTicks < WAIT_AFTER_PRESS_TICKS) {
        fail(`${what}: a leg that breaks a rock must wait at least `
            + `${WAIT_AFTER_PRESS_TICKS} ticks after the press before it plans through the `
            + `cell, and this one waits ${waitTicks}. The animation is `
            + `${HIT_TO_GONE_TICKS} ticks and the update order leaves ±1 of it open, so a `
            + 'wait that only just covers it makes the model and the game distinguishable '
            + 'for a reason no route cares about.');
    }
    return true;
}
