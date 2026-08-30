/**
 * seedlingDemo/chest — THE VERB WITH NO BUTTON, AND THE PASSAGE IT IS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 9, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §21.4-21.5, and §22 is
 * this slice's as-built.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * L38 is two disjoint rooms and the join is ONE cell — (9,7) — holding
 * `cover@144,112` and, underneath it, `chest@144,112`. Opening the cover
 * does not open the cell: a `Chest` is `type = "Solid"` from its
 * constructor and stays that way until `open()` sets `type = ""`
 * (`Chest.as:77`). **That assignment is the passage**, and it is an entity
 * state change no persistence flag expresses — which is why it needed a
 * verb rather than a declared clear.
 *
 * ── THE FOUR THINGS `Chest.as` DOES NOT LOOK LIKE ─────────────────────
 *
 * 1. ⛔ **THE COVER GATES THE CHEST, NOT THE PLAYER.** `Chest.update`'s
 *    gate is `!collide("Solid", x, y)` — the CHEST colliding, at its own
 *    position, with `e !== this`. The only other Solid in that cell is the
 *    cover, so a shut cover holds the chest inert. The player's approach is
 *    a separate question and its answer does not change when the cover
 *    opens: the stance band below is IDENTICAL either way.
 * 2. ⛔ **THE TRIGGER IS A LINE, AND IT IS AUTOMATIC.** No key, no press,
 *    no item: `FP.world.collideLine("Player", …)` over a ONE-PIXEL ROW one
 *    pixel below the box. Standing under it opens it. So the "verb" is an
 *    approach with a stance band, exactly as a keylock's is, and the
 *    executor's job is to reach the band rather than to press anything.
 * 3. ⛔⛔ **THE BAND IS TWO PIXELS AND THE CHEST ITSELF IS ITS FLOOR.**
 *    The line arithmetic alone admits five player rows; four of them put
 *    the player box inside the chest, which is Solid, so no sweep can
 *    reach them. Derived below rather than written down — the derivation
 *    is the only thing that keeps the two halves (line row, chest box) in
 *    the same place.
 * 4. ⛔ **`open()` IS GUARDED BY A SPRITE FRAME.** `if (sprChest.frame ==
 *    0)` is the once-only latch, not a boolean anybody named. A model with
 *    its own `opened` flag would be a second copy of that state; this one
 *    transcribes the frame.
 *
 * ── ⛓ AND `open()`'s EFFECTS ARE AN EXACT SET ─────────────────────────
 *
 *   `sprChest.frame = 1`      the once-only latch
 *   `openTimer = 60`          the fade — the entity outlives its solidity
 *   `type = ""`               ⛓⛓ THE PASSAGE
 *   `new SealPiece(x, y)`     at the chest's OWN position — see
 *                             `sealCeremony.js`; it cannot be routed around
 *   the `while` RNG draw       ⚠ inert, and bounded — see `SEAL_DRAW`
 *   `setPersistence(tag,false)` the ledger entry, {38,1} here
 *
 * The `coins` loop is COMMENTED OUT in the source (`Chest.as:79-83`) and
 * `coins` is still initialised from `Math.random()` in the field
 * initialiser (`:22`) — so a chest costs ONE RNG draw at CONSTRUCTION,
 * every visit, whether or not it is ever opened. Recorded because "the
 * draws are all at open time" is the plausible wrong reading.
 *
 * ── ⚠ TWO ARMS THAT ARE BOUNDED VACUITIES HERE, AND SAY SO ────────────
 *
 * `checkBySeal()` removes the chest (and clears its tag) when
 * `SealController.hasAllSealParts()` — sixteen parts. R5 collects at most
 * one, so the arm is dead on this rung; it is transcribed and asserted
 * dead rather than omitted, because the thing that makes it dead is SAVE
 * STATE and a later rung will change it.
 *
 * `check()` — `tag >= 0 && !Game.checkPersistence(tag)` -> remove — is the
 * persistence half: an opened chest is GONE on the next `new Game`. That
 * is `PERSISTENCE_RESPONSE.chest = 'despawn'`, which `levelWorld` has
 * carried since R2; this module owns the LIVE half only.
 */

import { keyLineTouches } from './activators.js';
import { rectsOverlap } from './levelWorld.js';

export class ChestError extends Error {
    constructor(message) { super(message); this.name = 'ChestError'; }
}
const fail = (m) => { throw new ChestError(m); };

/**
 * `Chest.as`'s constants, verbatim. Every one is `private const` or a field
 * initialiser, so nothing an `.oel` carries can vary them except the
 * position and the tag.
 */
export const CHEST = Object.freeze({
    /** `openTimerMax` — the fade AFTER the desolidify. `Chest.as:20`. */
    openTimerMax: 60,
    /** `var m:int = 2` — the inset the probe line takes from each edge. */
    m: 2,
    /** `setHitbox(16, 16, 8, 8)` at `(_x + Tile.w/2, _y + Tile.h/2)`. */
    box: Object.freeze({ dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8 }),
    /** `type = "Solid"` in the ctor; `open()` writes `""`. */
    type: 'Solid',
    openType: '',
    /** ⚠ ONE `Math.random()` PER CONSTRUCTION, from the field initialiser. */
    ctorDraws: 1,
    src: 'Chest.as:20-34 (ctor) + :38-45 (check) + :47-57 (checkBySeal) '
        + '+ :59-68 (update) + :70-91 (open) + :93-104 (timerStep)',
});

/**
 * ⛓ THE PROBE LINE, from the PLACEMENT coordinates the extract carries.
 *
 * `Chest.update`:
 *
 * ```
 *   FP.world.collideLine("Player",
 *       x - originX + m,               y - originY + height + 1,
 *       x - originX + width - 2 * m,   y - originY + height + 1)
 * ```
 *
 * ⚠ **THE RIGHT INSET IS `2 * m`, NOT `m`.** The line is symmetric in the
 * source's shape and asymmetric in its arithmetic: 2 px in on the left,
 * FOUR on the right. Transcribed, not tidied — a symmetric reading would
 * widen the band by two pixels of x and every one of them is a real
 * position a walk could stop in.
 *
 * The entity position is the placement plus the ctor's half-tile and the
 * origin is the same half-tile, so `x - originX` is the PLACEMENT x. The
 * argument here is therefore the `.oel` value, undoing nothing.
 */
export function chestProbeLine(px, py) {
    if (!Number.isInteger(px) || !Number.isInteger(py)) {
        fail(`chestProbeLine: (${px},${py}) must be the OEL integer placement`);
    }
    return Object.freeze({
        x0: px + CHEST.m,
        x1: px + CHEST.box.w - 2 * CHEST.m,
        y: py + CHEST.box.h + 1,
    });
}

/** The chest's own solid box, in the same placement coordinates. */
export function chestRect(px, py) {
    return Object.freeze({
        x: px, y: py, right: px + CHEST.box.w, bottom: py + CHEST.box.h,
    });
}

/**
 * ⛔⛔ THE STANCE BAND, DERIVED — the player rows that open this chest.
 *
 * Two constraints, and the second is the one an arithmetic-only reading
 * drops:
 *
 *   (a) the player box CONTAINS the probe row  (`keyLineTouches`)
 *   (b) the player box does NOT overlap the chest, which is Solid until
 *       the instant this fires — so a row that satisfies (a) by standing
 *       INSIDE the chest is not a row any sweep can reach
 *
 * For `chest@144,112` and the 4x5 player box that is `y ∈ {130, 131}`:
 * (a) alone says [127,131] and four of those five are inside `[112,128)`.
 *
 * ⚠ It is derived from the SAME two functions the run uses, so the band
 * and the live gate cannot drift. A hard-coded pair would be a second
 * model of a two-pixel window.
 *
 * @param {number} px,py     the chest's OEL placement
 * @param {object} hitbox    the player's — `playerPhysicsV1.HITBOX`'s own
 *                           shape (`width`/`height`/`originX`/`originY`),
 *                           taken rather than re-spelled so the two cannot
 *                           be transcribed apart
 * @param {number[]=} search the rows to consider; the default is the two
 *                           tiles above and below, which is wider than any
 *                           answer can be
 */
export function chestStanceBand(px, py, hitbox, search = null) {
    for (const k of ['width', 'height', 'originX', 'originY']) {
        if (!Number.isFinite(hitbox?.[k])) {
            fail(`chestStanceBand: the player hitbox needs a finite \`${k}\` — this takes `
                + '`playerPhysicsV1.HITBOX` verbatim. An absent origin reads as 0, which '
                + 'is a DIFFERENT and plausible-looking band rather than an error.');
        }
    }
    const line = chestProbeLine(px, py);
    const solid = chestRect(px, py);
    const rows = search ?? Array.from({ length: 64 }, (_, i) => py + CHEST.box.h - 16 + i);
    const band = [];
    for (const y of rows) {
        // The x half is the chest's own column: the band is a claim about
        // ROWS, and the walk arrives in the chest's column by construction
        // (it is a one-cell join). The line's x inset is asserted separately.
        const box = {
            x: px,
            y: y - hitbox.originY,
            right: px + hitbox.width,
            bottom: y - hitbox.originY + hitbox.height,
        };
        if (!keyLineTouches(box, line)) continue;
        // (b): the chest is Solid at the moment the line fires.
        if (rectsOverlap(box, solid)) continue;
        band.push(y);
    }
    if (band.length === 0) {
        fail(`chestStanceBand: chest@${px},${py} has NO reachable stance — every row that `
            + 'contains the probe line puts the player box inside the chest. That is a '
            + 'real shape (a chest with a solid directly beneath it) and it means the '
            + 'chest cannot be opened from below, so it needs a finding rather than a '
            + 'route.');
    }
    return Object.freeze(band);
}

/**
 * Per-level chest state, one entry per placed chest.
 *
 * `frame` is `sprChest.frame`, transcribed rather than renamed: it IS the
 * once-only latch (`open()`'s `if (sprChest.frame == 0)`).
 */
export function createChestState(chests) {
    const byId = new Map();
    for (const c of chests ?? []) {
        byId.set(c.id, {
            id: c.id,
            x: c.x,
            y: c.y,
            persistTag: c.persistTag,
            frame: 0,
            openTimer: 0,
            /** `type` — `"Solid"` until `open()`. */
            solid: true,
            /** `FP.world.remove(this)` has run. */
            gone: false,
        });
    }
    return byId;
}

/**
 * One tick of `Chest.update`, for every chest in a level.
 *
 * ⚠ THE ORDER INSIDE THE TICK IS THE SOURCE'S: `checkBySeal()`, then the
 * gate-and-line, then `timerStep()`. So a chest that opens on tick T also
 * takes its FIRST fade step on tick T — `openTimer` is 60 at the top of
 * `timerStep` and 59 at the bottom — and the removal lands 60 ticks later,
 * not 61.
 *
 * @param {Map} state         from `createChestState`
 * @param {object} ctx
 * @param {object} ctx.playerBox     the player's box, this tick
 * @param {Function} ctx.solidOver   `(chest) => boolean` — is there another
 *                                   `Solid` at the chest's position? This
 *                                   is `collide("Solid", x, y)` with
 *                                   `e !== this`, and the caller owns the
 *                                   geometry.
 * @param {boolean} ctx.hasAllSealParts
 * @returns {object[]} events: `{kind:'chestopen'|'chestgone', id, …}`
 */
export function stepChests(state, ctx) {
    if (typeof ctx?.hasAllSealParts !== 'boolean') {
        fail('stepChests: `hasAllSealParts` has no default. `checkBySeal()` runs at the '
            + 'TOP of every update and removes the chest outright, so defaulting it '
            + 'would silently model either "the chest is always there" or "the chest is '
            + 'never there" — and which one is save state.');
    }
    if (typeof ctx.solidOver !== 'function') {
        fail('stepChests: `solidOver` is `Chest.update`\'s whole gate '
            + '(`!collide("Solid", x, y)`) and the caller owns the geometry. Without it '
            + 'a covered chest opens through its cover.');
    }
    const events = [];
    for (const c of state.values()) {
        if (c.gone) continue;
        // ── `checkBySeal()` ───────────────────────────────────────────
        if (ctx.hasAllSealParts) {
            c.gone = true;
            events.push({
                kind: 'chestgone', id: c.id, persistTag: c.persistTag, why: 'checkBySeal',
            });
            continue;
        }
        // ── the line, then the gate ───────────────────────────────────
        // ⚠ THE SOURCE ASKS THEM THE OTHER WAY ROUND, and swapping them is
        // deliberate rather than sloppy. `Chest.update`'s condition is
        // `!collide("Solid", x, y) && FP.world.collideLine("Player", …)`,
        // so the game evaluates the GATE first — but both are pure
        // predicates over the same frame's state, `&&` short-circuits
        // either way, and there is no execution in which the order is
        // observable.
        //
        // What IS observable is the cost. `solidOver` is a full solids
        // scan, and asking it every tick of every visit to a level with a
        // chest cost the frontend suite 370 ms on `r3-walk-full` — enough
        // to push a pre-existing 10 s timeout over. The line test is a rect
        // against three integers and it is false on all but a handful of
        // ticks, so it goes first.
        if (c.solid && c.frame === 0) {
            if (keyLineTouches(ctx.playerBox, chestProbeLine(c.x, c.y))
                && !ctx.solidOver(c)) {
                if (c.frame === 0) {
                    c.frame = 1;
                    c.openTimer = CHEST.openTimerMax;
                    c.solid = false;
                    events.push({
                        kind: 'chestopen', id: c.id, persistTag: c.persistTag,
                        x: c.x, y: c.y,
                    });
                }
            }
        }
        // ── `timerStep()`, in the same tick ───────────────────────────
        if (c.openTimer > 0) {
            c.openTimer -= 1;
            if (c.openTimer <= 0) {
                c.gone = true;
                events.push({ kind: 'chestgone', id: c.id, persistTag: c.persistTag, why: 'fade' });
            }
        }
    }
    return events;
}

/**
 * ⚠ THE SEAL DRAW, and the bounded update it makes to §2.1's
 * "no gameplay RNG" claim.
 *
 * `Chest.open()`'s last act before the persistence write is
 *
 * ```
 *   var index:int = -1;
 *   while (index < 0 || !SealController.getSealPart(index))
 *       index = Math.floor(Math.random() * SealController.SEALS);
 * ```
 *
 * ⛔ **`getSealPart` IS A GETTER-NAMED MUTATOR.** It returns FALSE if the
 * drawn index is already owned, and otherwise WRITES it into the save's
 * first free slot (`Main.hasSealPartSet(last, index)`) and returns TRUE.
 * So the loop is a rejection sampler whose ACCEPTING call is the thing
 * that banks the part — the ceremony and the banking are the same line —
 * and it terminates because `hasAllSealParts()` short-circuits TRUE once
 * the last slot is filled.
 *
 * Three consequences, and the third is why this is inert:
 *
 * 1. **THE COUNT IS ONE PER CHEST**, unconditionally, and it does not
 *    depend on the draw. The ledger stays fully derived.
 * 2. **THE EXPECTED NUMBER OF DRAWS IS `16 / (16 - k)`** for `k` parts
 *    already owned — 1.0 for the first chest — so the LFSR advances by a
 *    variable amount. Deterministic for a given tape (one global stream,
 *    one tick order), variable across save states.
 * 3. ⛓ **NOTHING IN R5 READS THE IDENTITY.** The drawn index is used by
 *    `SealController.render` (which frame to draw) and by the save array,
 *    and by nothing else: no gate, no geometry, no persistence slot, no
 *    item property. So R5's claims are RNG-free in the sense §2.1 meant —
 *    the draws are stream advances, not decisions — and this is the named,
 *    bounded update to that claim rather than a refutation of it.
 */
export const SEAL_DRAW = Object.freeze({
    seals: 16,
    /** `Math.floor(Math.random() * SEALS)` — one draw per loop iteration. */
    drawsPerIteration: 1,
    /** The rejection loop's expectation with `k` parts already owned. */
    expectedDraws: (k) => {
        if (!Number.isInteger(k) || k < 0 || k >= 16) {
            fail(`SEAL_DRAW.expectedDraws: k must be 0..15, got ${k}. At k = 16 `
                + '`hasAllSealParts()` short-circuits and the loop never draws at all.');
        }
        return 16 / (16 - k);
    },
    readsIdentity: Object.freeze([
        'SealController.render — which of the 16 frames to draw',
        'Main.hasSealPartSet / hasSealPart — the save array',
    ]),
    src: 'Chest.as:84-88 + SealController.as:59-88',
    why: '⚠ THE BOUNDED UPDATE TO §2.1. A gameplay `Math.random()` exists on this '
        + 'rung and it is the seal index. It is INERT: one banked part per chest '
        + 'whatever it draws, and no R5 claim reads the identity. What it does do is '
        + 'advance the one global LFSR by a variable number of steps, so a rung that '
        + 'opens a SECOND chest inherits a stream offset that depends on the first '
        + 'draw — which is why the count is written down here rather than left as '
        + '"a few".',
});
