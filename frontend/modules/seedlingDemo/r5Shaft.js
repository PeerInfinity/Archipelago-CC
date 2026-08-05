/**
 * seedlingDemo/r5Shaft — L39's shaft, as a choreography a TAPE can drive.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 7. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §19 (the plan this
 * corrects) and §20 (what pricing it found).
 *
 * ── WHAT THIS IS ──────────────────────────────────────────────────────
 *
 * §19.8 shipped eighteen fire presses and a minimality certificate: a hand
 * plan and a blind BFS agreed on the identical block trajectory. Slice 7
 * set out to PRICE that plan in ticks and found it does not survive
 * contact with the weapon.
 *
 * ── ⛔⛔ THE THING THE CERTIFICATE COULD NOT SEE ───────────────────────
 *
 * Both halves of §19.8 ran through `pressOutcome(stance, BLOCK, ...)` — a
 * function that takes the block being aimed at. **`Player.fire()` has no
 * aim.** It is a 32x32 rect centred on the player and `genericHit` runs on
 * everything inside it, each target pushed `Math.atan2` AWAY from the
 * stance. Two of §19.8's eighteen presses have a second block in range:
 *
 * ```
 *   press 17  stance (9,9)  aims block 2 (10,9)->(11,9)
 *             ...and ALSO shoves block 1 (9,8) north, into a `cover t0`
 *                that nothing is holding open
 *   press 18  stance (8,9)  aims block 1 (9,8)->(9,7), the diagonal
 *             ...and ALSO shoves block 3 WEST off `cover t2`, closing
 *                `wandlock@144,64` behind it
 * ```
 *
 * Replayed with the collateral modelled, §19.8's plan ends with **two of
 * three** lock-buttons held. Every one of its presses still "works" — each
 * one moves something — which is exactly why an aimed model could not see
 * it. See `probe-seedling-r5-shaft-solver`, which keeps that plan and
 * prints its failure rather than deleting it.
 *
 * ── ⛓⛓ AND THE CORRECTED ROOM IS BETTER ──────────────────────────────
 *
 * The collateral is not an obstacle, it is the MECHANISM. Park block 3 one
 * tile PAST its destination, on `button t0`, and a single press from the
 * middle of the cross at (9,9) moves all three blocks onto all three
 * lock-buttons at once — each on a pure axis, no `bothRange` diagonal
 * anywhere in the plan:
 *
 * ```
 *   block 1 (9,8)  -> (9,7)   north, onto button t4   [cover t0 held by block 3]
 *   block 2 (10,9) -> (11,9)  east,  onto button t5   [cover t1 held by block 1]
 *   block 3 (8,9)  -> (7,9)   west,  onto button t3   [cover t2 held by block 2]
 * ```
 *
 * ⛓ **EACH COVER IS OPEN BECAUSE ANOTHER OF THE THREE IS ON ITS BUTTON**,
 * and each is then LATCHED by the block gliding into it. The timing is not
 * tight and it is not luck: a glide overlaps the destination cover's cell
 * on tick 1 and keeps overlapping the button it is LEAVING for another
 * 22-24 (the block is 16 px wide, the button hitbox is 8x6, and the glide
 * is 0.5 px/tick), so every cover has a holder on every tick of the swap.
 * `SWAP_MARGINS` is that arithmetic, per block.
 *
 * ⛓ And the blind search agrees, again and independently: re-run with the
 * aim taken away it returns at depth **18** with this trajectory, the
 * final three-block press included. Eighteen is still the number; it is a
 * different eighteen.
 *
 * ── ⚠ WHAT A ROUTE HAS TO CARRY THAT §19 DID NOT ──────────────────────
 *
 * 1. **THE ROPE IS ON THE PATH, so the arm is BUILT.** §18.7 ruled it an
 *    arm and left it unbuilt because the room behind it was closed. It is
 *    not optional: `rope@96,384` is 112 px of wall across the only shaft
 *    out of the arrival corridor (56 cells reachable without it, 688 with).
 *    Pulled with a FIRE press rather than a sword one — see `ROPE_PULL`.
 * 2. **THE THREE LOCKS WRITE PERSISTENCE.** `Lock.turnOff()`'s third line
 *    is `Game.setPersistence(tag, false)`, and no rung before this one
 *    modelled it. See `SHAFT_LEDGER`.
 * 3. **AND ONE OF THEM WRITES IT BACK.** `wandlock@48,160` (tag 7) opens
 *    to let block 3 out of its pocket and RE-CLOSES on the final press,
 *    when block 1 leaves `button t1` — `returnToNormal()` writes TRUE. A
 *    ledger that banked only the opening reports a clear the game has
 *    taken back.
 */

import { TICKS_PER_TILE } from './pushables.js';
import { FIRE_PRESS_CADENCE, FIRE_WINDOW } from './fireVerb.js';
import { opensOnTick } from './activators.js';

export class ShaftError extends Error {
    constructor(message) { super(message); this.name = 'ShaftError'; }
}
const fail = (m) => { throw new ShaftError(m); };

export const LEVEL = 39;
const TILE = 16;

/** A tile's centre, which is where a stance stands and a press fires from. */
export const centre = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

/**
 * ⛓⛓ R5 SLICE 12 — WHICH PRESS THE GAME REFUSED, DERIVED FROM THE STUCK
 * POSITION RATHER THAN FROM A NEW RECORDING.
 *
 * §24.8 banked one number that decides more than it was read for:
 * the game could not leave `y = 76.34` at tile (12,4).
 * `playerBoxAt(199.44, 76.34).bottom` is **79.34** and `moveY` sweeps in
 * 1 px steps, so the blocker's top edge is at **y = 80** — row 5 — and the
 * player's box spans x [197.44, 201.44), which is inside column 12.
 *
 * ⇒ **THE BLOCKING SOLID IS IN CELL (12,5)**: exactly where press 4 put
 * block 2 and exactly where press 5 was supposed to move it from. A block
 * still on its spawn (13,5) spans [208, 224) and could not have blocked
 * that walk at all.
 *
 * ⛓⛓ **SO PRESS 4 LANDED IN THE GAME AND PRESS 5 DID NOT** — a two-press
 * discrimination out of a single already-banked pixel value, and the
 * reason slice 12 did not have to spend a recording to get it.
 *
 * ⚠ AND THE PAIR IS THE PART THAT IS NOT DERIVABLE. What distinguishes
 * the two presses is not in the press: same block, same weapon, same
 * 32x32 rect, and the angles are 0.00° and 89.98° against a `bothRange`
 * of 0.1 — neither anywhere near the diagonal band. See
 * `probe-seedling-r5-press-axes`, which asks whether press 5 fails ALONE
 * or only inside the shaft's 2,375 ticks.
 */
export const PRESS_AXES = Object.freeze({
    /** `SHAFT_WALK.divergence.gameStuckAtY`, and the x it was stuck at. */
    stuck: Object.freeze({ x: 199.44, y: 76.34 }),
    /** Derived: `playerBoxAt(stuck).bottom` + one sweep step, rounded to the cell. */
    blockerTopEdge: 80,
    blockerCell: Object.freeze({ tx: 12, ty: 5 }),
    press4: Object.freeze({
        index: 4,
        stance: Object.freeze([14, 5]),
        move: Object.freeze({ from: [13, 5], to: [12, 5] }),
        axis: 'W',
        /** atan2 from the stance centre to the block centre: dead level. */
        angleDeg: 0,
        landedInGame: true,
    }),
    press5: Object.freeze({
        index: 5,
        stance: Object.freeze([12, 4]),
        move: Object.freeze({ from: [12, 5], to: [12, 6] }),
        axis: 'S',
        /** From the RECORDED stance (199.44, 72.24), not the tile centre. */
        angleDeg: -87.96,
        landedInGame: false,
    }),
    /** The plan's own tick numbers — 71 apart, against a 33-tick glide. */
    pressTicks: Object.freeze({ press4: 738, press5: 809, glideSettleTicks: 33 }),
    why: 'the blocker\'s top edge is y=80 and it overlaps the player\'s x span, so it is '
        + 'in (12,5) — the cell press 4 filled and press 5 was to empty. The spacing '
        + 'refutes the swallowed-press suspect on the plan\'s own numbers: 71 ticks '
        + 'between the presses, and a glide is settled 33 ticks after the first hit tick.',
});

/**
 * ⛔⛔⛔ R5 SLICE 12 — WHAT ACTUALLY STOPPED PRESS 5: AN ENEMY, AND A
 * CENSUS VERDICT THAT WAS TRUE ABOUT THE WRONG MOVER.
 *
 * Four short tapes (`probe-seedling-r5-press-axes`), all booting straight
 * into the block room so the rope, the corridor and the 197-frame freeze
 * are out of the picture:
 *
 * ```
 *   r5-press-axes          press W, walk-proof, press S, walk-proof
 *                          → the game parts at t157, stuck at y 83.83
 *   r5-press-glide         …with `down` HELD for 260 ticks instead
 *                          → still 83.83 at t410. The block is genuinely
 *                            PARKED ~7 px into a 16 px move
 *   r5-press-repeat        `down` held THROUGHOUT + six presses 42 apart
 *                          → the player descends 1 px every OTHER tick
 *                            from t115 to t141 — the model matching to
 *                            the pixel — and then jams at y 90.98, ~14 px
 *                            in. The five later presses do NOTHING.
 *   r5-press-delay         the glide probe, 120 ticks later, unchanged
 *                          → ⛓⛓ BYTE-EXACT. The block completes its move
 *                            and the model was right all along.
 * ```
 *
 * ⛓⛓ **THE TIME SHIFT IS THE DISCRIMINATOR.** Identical inputs, identical
 * player path, identical press, 120 ticks later — and the outcome flips
 * from "wedged" to "the model reproduces the game exactly". A static solid
 * in (12,6) cannot do that. **The blocker MOVES.**
 *
 * ⛔⛔ **AND ONLY ONE KIND OF THING CAN BE IT.** `moveY` returning a
 * blocker is the only line in `PushableBlockFire.update` that parks a
 * block mid-glide, and what it collides with is the block's OWN `solids`
 * list:
 *
 * ```
 *   Mobile.as:17              solids = ["Solid","Tree","Rock","Rope","ShieldBoss"]
 *   Player.as:377             solids.push("LavaBoss")          ← the PLAYER's list
 *   PushableBlock*.as ctor    solids.push("Enemy", "Player")   ← the BLOCK's
 * ```
 *
 * Not the Player (north of a southward move); not a static Solid (the time
 * shift); ⇒ **"Enemy"**. L39's only enemies are its three spinners
 * (`fallRock.js` records that already), and `Spinner` is a `Mobile` with
 * `v = moveSpeed·(cos(−π/4), sin(−π/4))`, a `friction()` override that
 * clamps `|v| ≥ moveSpeed` so it NEVER stops, and `moveX`/`moveY`
 * overrides that REFLECT (`v.x = -v.x`) instead of stopping. It is a
 * billiard ball, deterministic and unmodelled.
 *
 * ⛓⛓⛓ **THE LESSON: A "NOT SOLID" VERDICT IS NOT SOLID FOR ONE MOVER'S
 * `solids` LIST.** `levelWorld`'s census carries ONE solidity field per
 * class and its docblock says *"does not block the player"* — which was
 * true, and sufficient, for every rung up to this one, because the Player
 * was the only mover whose collisions anybody planned against. A pushable
 * block is the one mover in the game that collides with enemies, and the
 * census could not express that. See `levelWorld.SOLIDS_BY_MOVER`.
 *
 * ⛔ **AND THE WEDGE IS PERMANENT, WHICH IS WHY ONE CELL COST THE WHOLE
 * LEDGER.** A blocked block keeps `v` non-zero forever: `input()` re-derives
 * it from `tile` every tick, `moveY` resets `tile` to the current cell,
 * and the two chase each other. `hit()`'s first line is
 * `if (v.length > 0) return`, so **every subsequent press is swallowed** —
 * exactly what `r5-press-repeat`'s five later presses show. A wedged block
 * can never be un-wedged by pressing it.
 */
export const SPINNER_WEDGE = Object.freeze({
    kind: 'enemy-wedge',
    /** The class that did it, and the list that let it. */
    blocker: 'Spinner',
    blockerType: 'Enemy',
    moverSolids: Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Enemy', 'Player']),
    playerSolids: Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'LavaBoss']),
    /**
     * The four probes and what each one settled.
     *
     * ⛓⛓ R5 SLICE 13 ADDED THE GAME-SIDE NUMBERS, and they are the reason
     * the fix could be checked before spending a recording. `--record` prints
     * the FIRST diverging tick with both streams' values on it, so a refuted
     * arm leaves behind an exact game-side observation even when its
     * expectation file is withdrawn. `gameY` is that number, to the full
     * double, from the slice-12 session's own log; `tickCount` is the
     * `observation count` line minus one, and it is what makes a
     * RECONSTRUCTED tape checkable rather than assumed (see
     * `SPINNER_WEDGE.reconstruction`).
     */
    probes: Object.freeze([
        Object.freeze({
            tape: 'r5-press-axes', stuckY: 83.83, divergesAt: 157,
            gameY: 83.83122648907042, tickCount: 165, reconstructible: false,
            says: 'the shaft\'s divergence reproduces in 165 ticks, with no rope and no freeze',
            // ⛔ ITS INPUTS ARE GONE. `r5-press-glide` and `-repeat` are pure
            // span transforms of the COMMITTED `r5-press-delay` and come
            // back exactly; this one's final leg is an eleven-tick walk-proof
            // that `glide` REPLACED, so its `to` survives in no artefact.
            // Its finding is subsumed by `glide`, which is the same tape held
            // longer and diverges on the same tick at the same y.
        }),
        Object.freeze({
            tape: 'r5-press-glide', stuckY: 83.83, heldTicks: 260,
            gameY: 83.83122648907042, divergesAt: 157, tickCount: 410, reconstructible: true,
            says: 'the block is PARKED, not gliding — and §24.8\'s reading of the shaft was '
                + 'right for a reason it could not check: there, the y went constant when '
                + 'the walk\'s INPUT SPAN ended',
        }),
        Object.freeze({
            tape: 'r5-press-repeat', stuckY: 90.98, presses: 6,
            gameY: 90.98122648907042, divergesAt: 143, tickCount: 404, reconstructible: true,
            says: 'the player follows the glide 1 px every other tick (a 0.5 px/tick block '
                + 'read through a 1 px sweep quantum), the model matching to the pixel, '
                + 'and the five presses after the wedge are ALL swallowed',
        }),
        Object.freeze({
            tape: 'r5-press-delay', delayTicks: 120, byteExact: true,
            reconstructible: null,
            says: '⛓⛓ THE DISCRIMINATOR — the same tape later is byte-exact, so the '
                + 'blocker moves',
        }),
    ]),
    /**
     * ⛓⛓ HOW THE TWO RECOVERABLE ARMS COME BACK, AND WHY THIS IS NOT A GUESS.
     *
     * The three diagnostic tapes were authored by `synthesizeLegs` against a
     * model that believed press 5 landed. ⛔ **THAT DRIVER CANNOT AUTHOR THEM
     * ANY MORE** — with `spinner.js` live it correctly refuses press 5's
     * declared move and, one leg later, the walk-proof into a cell it now
     * knows is sealed. Re-synthesising would produce DIFFERENT tapes wearing
     * the same names, which is the worst of the three options.
     *
     * ⛓ But two of them are pure span transforms of a tape that IS committed
     * and IS byte-exact, and both transforms are invertible:
     *
     * ```
     *   glide  = delay with every span at/after press 5 shifted -120,
     *            tick_count - 120                         → 410
     *   repeat = glide's spans before press 5, plus `down` held from
     *            press5-2 to press5 + 6*42 + 40, plus six 1-tick `primary`
     *            spans 42 apart, tick_count = end + 4      → 404
     * ```
     *
     * ⚠ AND THE RECONSTRUCTION IS CHECKED AGAINST AN INDEPENDENT NUMBER.
     * Both `tickCount`s above come from the slice-12 recording session's
     * `observation count` lines — measured by the GAME, before this
     * arithmetic existed. A transform that got a span wrong would land on a
     * different total.
     */
    reconstruction: Object.freeze({
        from: 'r5-press-delay',
        delayTicks: 120,
        repeatPresses: 6,
        repeatGap: 42,
        repeatTail: 40,
        why: 'the driver that authored them is now correct and therefore cannot',
    }),
    /** What is committed out of it: the pair that is green in both arms. */
    committedPair: Object.freeze({ press: 'r5-press-delay', control: 'r5-press-delay-control' }),
    /**
     * ⛓⛓ R5 SLICE 13: TWO OF THE THREE CAME BACK, AS ORACLE RECORDINGS.
     *
     * `r5-press-glide` and `r5-press-repeat` are reconstructed
     * (`reconstruction` above), re-recorded and BYTE-EXACT — 816 observations
     * across the two, including the 250-tick hold and the five swallowed
     * presses. A tape is withdrawn because its MODEL is refuted; the model is
     * not refuted any more, so the withdrawal is not either.
     *
     * ⛔ `r5-press-axes` STAYS OUT, and for a different reason from the one
     * that put it there: its inputs are gone. Not "the model is wrong about
     * it" — nobody can author it. See `probes[0]`.
     */
    withdrawn: Object.freeze(['r5-press-axes']),
    /** …and what came back, so the change is a claim and not an absence. */
    restored: Object.freeze(['r5-press-glide', 'r5-press-repeat']),
    why: 'a wandering `Spinner` stood in the block\'s glide corridor. The model cannot see '
        + 'it because the census verdict `spinner: notSolid(... "damage only")` is a claim '
        + 'about the PLAYER\'s solids list, and a `PushableBlockFire`\'s constructor pushes '
        + '"Enemy" and "Player" onto its own. The wedge is permanent because a blocked '
        + 'block keeps v non-zero and `hit()` returns on `v.length > 0`.',
});

/**
 * ⛓⛓ THE CHOREOGRAPHY — eighteen presses, in the order the tape drives them.
 *
 * `stance` is the tile the player stands in; `moves` is the EXACT SET of
 * blocks the press displaces, by the cell each one is on and the cell it
 * lands on. The set is exact in both directions on purpose: a press that
 * moves a block the plan does not list is the §19.8 failure, and
 * `botDriverV2.runFire` fails on it by name.
 */
export const SHAFT_PLAN = Object.freeze([
    // ── 1-3: block 1 up column 9, onto `button t1` ────────────────────
    // ⚠ (9,8) IS A ONE-WAY STREET. (8,8) and (10,8) are wall, and the only
    // stance that could push a block SOUTH out of it is (9,7) — which is
    // `cover t0`, and cannot be stood on until something opens it. So the
    // block that parks here has exactly one future, and the plan has to
    // spend it last.
    { stance: { tx: 9, ty: 12 }, moves: [{ from: [9, 11], to: [9, 10] }], why: 'block 1 leaves its spawn' },
    { stance: { tx: 9, ty: 11 }, moves: [{ from: [9, 10], to: [9, 9] }], why: 'up the cross' },
    {
        stance: { tx: 9, ty: 10 },
        moves: [{ from: [9, 9], to: [9, 8] }],
        why: 'onto `button t1` — ONE press, TWO responders: `cover t1` at (11,9) lets '
            + 'block 2 in and `wandlock@48,160` at (3,10) lets block 3 out',
    },
    // ── 4-10: block 2 down column 12, west onto `button t2` ───────────
    { stance: { tx: 14, ty: 5 }, moves: [{ from: [13, 5], to: [12, 5] }], why: 'block 2 leaves its spawn' },
    { stance: { tx: 12, ty: 4 }, moves: [{ from: [12, 5], to: [12, 6] }], why: 'down column 12' },
    { stance: { tx: 12, ty: 5 }, moves: [{ from: [12, 6], to: [12, 7] }], why: 'down column 12' },
    { stance: { tx: 12, ty: 6 }, moves: [{ from: [12, 7], to: [12, 8] }], why: 'down column 12' },
    { stance: { tx: 12, ty: 7 }, moves: [{ from: [12, 8], to: [12, 9] }], why: 'down column 12' },
    {
        stance: { tx: 13, ty: 9 },
        moves: [{ from: [12, 9], to: [11, 9] }],
        why: 'ACROSS `cover t1`, which is open because block 1 is on `button t1`',
    },
    {
        stance: { tx: 12, ty: 9 },
        moves: [{ from: [11, 9], to: [10, 9] }],
        why: '⛓ TWO TILES PAST: onto `button t2`, which opens `cover t2` for block 3\'s '
            + 'whole crossing — and block 2 comes back to (11,9) on the last press',
    },
    // ── 11-17: block 3 out of its pocket and east onto `button t0` ────
    {
        stance: { tx: 3, ty: 12 },
        moves: [{ from: [3, 11], to: [3, 10] }],
        why: 'through `wandlock@48,160`, which group 1 opened 101 ticks after block 1 '
            + 'parked',
    },
    { stance: { tx: 3, ty: 11 }, moves: [{ from: [3, 10], to: [3, 9] }], why: 'out of the pocket' },
    { stance: { tx: 2, ty: 9 }, moves: [{ from: [3, 9], to: [4, 9] }], why: 'east along row 9' },
    { stance: { tx: 3, ty: 9 }, moves: [{ from: [4, 9], to: [5, 9] }], why: 'east along row 9' },
    { stance: { tx: 4, ty: 9 }, moves: [{ from: [5, 9], to: [6, 9] }], why: 'east along row 9' },
    {
        stance: { tx: 5, ty: 9 },
        moves: [{ from: [6, 9], to: [7, 9] }],
        why: 'ACROSS `cover t2`, which is open because block 2 is on `button t2`',
    },
    {
        stance: { tx: 6, ty: 9 },
        moves: [{ from: [7, 9], to: [8, 9] }],
        why: '⛓ ONE TILE PAST its own destination, onto `button t0` — which opens '
            + '`cover t0`, the one hold no block could otherwise pay for',
    },
    // ── 18: ⛓⛓ ONE PRESS, THREE BLOCKS, THREE HOLDS ──────────────────
    {
        stance: { tx: 9, ty: 9 },
        moves: [
            { from: [9, 8], to: [9, 7] },
            { from: [10, 9], to: [11, 9] },
            { from: [8, 9], to: [7, 9] },
        ],
        why: '⛓⛓ THE WHOLE ROOM. The player stands in the middle of the cross, all '
            + 'three blocks are orthogonal neighbours inside the 32x32 rect, and each '
            + 'goes on a PURE axis — north, east, west. No diagonal, no `bothRange`.',
    },
]);

/**
 * ⛔ §19.8's PLAN, kept because a correction with no artefact is a claim.
 *
 * Identical for its first sixteen presses. The last two are the ones the
 * aim was hiding, and each is listed with the block the plan did not know
 * it was moving.
 */
export const SHAFT_REFUTED = Object.freeze({
    section: '§19.8',
    presses: 18,
    /** The two presses whose collateral breaks it, and what it breaks. */
    collateral: Object.freeze([
        Object.freeze({
            press: 17, stance: { tx: 9, ty: 9 }, aimed: [10, 9],
            alsoMoved: [9, 8],
            why: 'block 1 is the diagonal-free NORTH neighbour of the stance at 8.0 px, '
                + 'so it is shoved off `button t1` into a `cover t0` that nothing is '
                + 'holding open — the move is refused by the wall and the group dies',
        }),
        Object.freeze({
            press: 18, stance: { tx: 8, ty: 9 }, aimed: [9, 8],
            alsoMoved: [7, 9],
            why: 'block 3 is the WEST neighbour at 6.0 px, so the press that finally '
                + 'fills `cover t0` empties `cover t2` — and `wandlock@144,64` restores '
                + 'behind it, writing its tag back TRUE',
        }),
    ]),
    endsWith: 2,
    of: 3,
    why: 'every one of its eighteen presses moves something, which is why an aimed '
        + 'model reported all eighteen green',
});

/**
 * ⛓ THE ROPE, and the reason it stops being optional.
 *
 * §18.7 ruled `rope@96,384` an ARM rather than a clear — `hit()` SHRINKS
 * the hitbox to one cell rather than removing the entity, so a declared
 * clear would open a tile the game keeps — and left it unbuilt because
 * "the room behind it is closed". This route opens that room, so the arm
 * is built.
 *
 * ⚠ PULLED WITH A **FIRE** PRESS, and that is a choice with a reason.
 * `genericHit`'s rope arm is `(e as RopeStart).hit()` with no `t`, so
 * either weapon pulls it. A sword press would need the `blockedLine`
 * oracle (`Player.as:916` exempts `type == "Rope"` from the LOS test, so
 * the oracle would be consulted and then waived — an oracle this route
 * does not otherwise need) and it would need an equip back to fire
 * afterwards. `fire()` has no LOS test at all. One weapon for the whole
 * visit, one equip at the boot.
 *
 * ⚠ AND THE PUBLICATION IS A COST. `RopeStart.set activate` copies the
 * flag onto every `Activators` sharing `t = 6`, which in L39 is
 * `{rope, pulser@64,96, fallrock@144,624}`. The `FallRock` is a no-op on
 * two independent gates (`r5Totem.GROUP_6`); the `Pulser` is NOT — the
 * publication starts a 22 px damage ring at (72,104) that was quiet
 * before. That is an encounter the ladder prices, not a wall.
 */
export const ROPE_PULL = Object.freeze({
    level: LEVEL,
    rope: Object.freeze({ x: 96, y: 384 }),
    /**
     * ⛔ R5 SLICE 8 CORRECTED THIS, and the old value could not be stood in.
     *
     * Slice 7 declared `(7, 25)` — a water tile in the WEST shaft, which is
     * where §20.5's "the rope's shaft is WATER, so `canSwim` is on the
     * critical path" came from. **(7,25) is not reachable from L39's
     * arrival by any path**: (8,25) is wall and (7,24) is the rope itself,
     * so the entire west shaft is behind the thing the stance exists to
     * pull. Flooding the arrival with the plug deleted gives 29 cells and
     * (7,25) is in none of them.
     *
     * The reachable stances that reach the rope at all are column 9 alone,
     * and of those the walk arrives from the south, so it is **(9,25)** —
     * the corridor cell directly below the pulley. `auditFire` there
     * reaches exactly one responder, the rope.
     *
     * ⛓ AND IT IS DRY: `resolveTerrainState` at (152,408) is **18**, not
     * water and not waterfall. ⇒ §20.5's canSwim claim is retired. It was
     * found by a `PhysicsV2Error` refusing an unpinned wet tick, which is
     * that refusal doing exactly its job — on a tick no walk can take.
     * `probe-seedling-r5-l38-entrance` is the measurement.
     */
    stance: Object.freeze({ tx: 9, ty: 25 }),
    /** Terrain 18. Named so a later reading cannot re-derive the wet one. */
    stanceTerrain: 18,
    supersededStance: Object.freeze({
        tx: 7, ty: 25, section: '§20.5',
        why: 'unreachable — (8,25) is wall and (7,24) is the rope; the west shaft is '
            + 'behind the pull. Its water is real and no walk stands in it.',
    }),
    clears: Object.freeze({ level: LEVEL, tag: 9 }),
    weapon: 'fire',
    cells: Object.freeze({ before: 56, after: 688 }),
});

/**
 * ⛓ THE FLAG LEDGER FOR THE WHOLE L38 -> L39 ERRAND, as an exact set.
 *
 * `from` is what wrote it, because an exact set whose entries nobody can
 * attribute is a set nobody can debug. Six entries end up in the game's
 * `persistence_cleared`; a seventh is written and TAKEN BACK, and it is in
 * the list with `net: false` precisely so a test can assert its absence
 * from the final ledger rather than forgetting it existed.
 */
export const SHAFT_LEDGER = Object.freeze([
    Object.freeze({
        level: 37, tag: 4, net: true, from: 'buttonroom@144,288 in L38',
        why: '⚠ THE ARRIVAL PRESSES IT. The L37 -> L38 door places the player at '
            + '(144,288) and the button is there, so it fires on the first tick of the '
            + 'visit — R1 met it from the other side (`r1Walk.R1_PERSISTENCE_EFFECTS`). '
            + 'In BOTH arms of any L38 pair, which is why it is declared rather than '
            + 'discovered mid-record.',
    }),
    Object.freeze({
        level: 38, tag: 5, net: true, from: 'buttonroom@144,288 in L38 (own tag)',
        why: '`Game.setPersistence(tag, !activate)` — the second of the arrival '
            + 'button\'s two writes',
    }),
    Object.freeze({
        level: 39, tag: 8, net: true, from: 'buttonroom@32,48 in L38',
        why: '⛓ THE ENTRANCE. `t` is the TSET (8, not the tag 4) and `flip` makes the '
            + 'value FALSE, so `Lock.check()` deletes `wandlock@144,592` — L39\'s plug — '
            + 'from the BUILD rather than opening it during the visit',
    }),
    Object.freeze({
        level: 38, tag: 4, net: true, from: 'buttonroom@32,48 in L38 (own tag)',
        why: 'the entrance button\'s own tag',
    }),
    Object.freeze({
        level: 39, tag: 9, net: true, from: 'rope@96,384',
        why: '`RopeStart.hit()` — `Game.setPersistence(tag, false)`, once, behind '
            + '`if (!activate)`',
    }),
    Object.freeze({
        level: 39, tag: 0, net: true, from: 'wandlock@144,64 (t 3)',
        why: '⛔ `Lock.turnOff()`\'s third line, which no rung before slice 7 modelled. '
            + 'Held open by block 3 on `button t3` under `cover t2`.',
    }),
    Object.freeze({
        level: 39, tag: 1, net: true, from: 'wandlock@144,48 (t 4)',
        why: 'held open by block 1 on `button t4` under `cover t0`',
    }),
    Object.freeze({
        level: 39, tag: 2, net: true, from: 'wandlock@144,32 (t 5)',
        why: 'held open by block 2 on `button t5` under `cover t1`',
    }),
    Object.freeze({
        level: 39, tag: 10, net: true, from: 'fallrock@144,624 (t 6) — the ROPE drops it',
        why: '⛔⛔ THE FLAG THAT REFUTED THIS PLAN, and it is written by the rope press. '
            + '`RopeStart.hit()` sets `activate = true`, which publishes to every '
            + '`Activators` in group 6 — and `FallRock.set activate` calls `fall()`, '
            + 'whose FIRST line is `Game.setPersistence(tag, false)`. So the write lands '
            + 'at PULL time (tick 189), not at landing, and `GROUP_6`\'s two '
            + '"independent" gates were one gate with one opener (§23.2). '
            + '⚠⚠ AND IT WAS PREDICTED AND UNASSERTED FOR A WHOLE SLICE: '
            + '`runTape` has exposed `rockFalls` since slice 10 and '
            + '`plan-seedling-r5-shaft` summed `lockWrites` + `ropePulls` only, so the '
            + 'ledger claim went on passing while omitting the flag the refutation '
            + 'turned on. A forward prediction nobody asserts is a note.',
    }),
    Object.freeze({
        level: 39, tag: 7, net: false, from: 'wandlock@48,160 (t 1)',
        why: '⛔⛔ WRITTEN AND TAKEN BACK. It opens 101 ticks after block 1 parks on '
            + '`button t1`, which is what lets block 3 out of its pocket — and the '
            + 'FINAL press moves block 1 off that button, so group 1 goes quiet with '
            + 'nothing standing in the lock and `returnToNormal()` writes the tag back '
            + 'TRUE. It is in this list with `net: false` so a test asserts its ABSENCE '
            + 'from the end-of-run ledger, rather than nobody remembering it happened.',
    }),
]);

/** The entries that are still off when the walk ends. */
export const SHAFT_LEDGER_NET = Object.freeze(SHAFT_LEDGER.filter((f) => f.net));

/**
 * ⛓ THE PART THIS ERRAND IS FOR, and it writes NO persistence at all.
 *
 * `BossTotemPart.removed()` is `Player.hasTotemPartSet(totemPart, true)` —
 * a SAVE-FILE array, exactly like `BossKey`'s `hasKeySet`. So the ceremony
 * is real (150 frozen frames, `special = true`), the item is banked, and
 * the flag ledger does not move.
 *
 * ⚠⚠ AND THE GAME'S READOUT CANNOT SEE IT. `Bot.itemReadout` reports
 * fourteen properties and `hasTotemPart` is not among them, so "the part
 * is banked" is NOT observable from `botStatus` — the same blind spot
 * `hasKey` has, and with ZERO further AS3 this rung it stays. What IS
 * observable is the ceremony: the freeze, the dead frames, and the pickup
 * gone from the level on re-entry (`check()` removes a part already held).
 * The claim is phrased over those.
 */
export const TOTEM_PART_2 = Object.freeze({
    level: LEVEL,
    part: 2,
    pickup: Object.freeze({ x: 72, y: 40 }),
    tile: Object.freeze({ tx: 4, ty: 2 }),
    writesPersistence: false,
    readoutBlindSpot: '`Bot.itemReadout` has no totem-part field; `hasTotemPart` lives '
        + 'in `Main.SAVE_FILE.data` like `hasKey`. Zero further AS3 this rung, so the '
        + 'run carries its own set and the acceptance claim is the CEREMONY.',
    ceremonyFrames: 150,
});

/**
 * ⛓ THE SWAP, IN TICKS — the arithmetic the search's "waiting is free"
 * abstraction could not do, and the reason the final press is safe.
 *
 * Every number is `16 / 0.5 = 32` ticks of glide against an 8x6 button
 * hitbox centred in a 16x16 cell, so a 16 px block leaves a button's
 * volume partway through and enters the next cover's on tick 1.
 *
 *   ENTERS the destination cover     tick 1   (16 px block, 16 px cell)
 *   LEAVES the button it was on      tick 22-24 (depending on the axis)
 *   arrives, grid-snapped            tick 32
 *
 * So on every tick of the final swap each of the three covers has either
 * its group held or something standing in it, and the three lock-buttons
 * are all under a block from tick 32. Nothing is simultaneous by luck.
 */
export const SWAP_MARGINS = Object.freeze({
    glideTicks: TICKS_PER_TILE,
    entersDestinationOnTick: 1,
    leavesButtonAfterTicks: 22,
    why: 'a button\'s hitbox is `setHitbox(8, 6, 4, 3)` around the cell centre — '
        + '[cx-4, cx+4) — and a 16 px block moving at 0.5 px/tick keeps overlapping it '
        + 'until it has travelled 11-12 px, which is tick 22-24. The cover it is '
        + 'entering is a full 16x16 cell, so the overlap starts on tick 1.',
});

/**
 * The tick price of the choreography, derived rather than measured.
 *
 * ⚠ A LOWER BOUND ON THE PRESSES ONLY. It does not include the walks
 * between stances, which are the larger half and are the planner's to
 * count — `plan-seedling-r5-shaft.mjs` prints the measured total beside
 * this so a drift between the two is visible.
 */
export function pressPrice(plan = SHAFT_PLAN) {
    const perPress = FIRE_WINDOW.lastHitTick + SWAP_MARGINS.glideTicks;
    return Object.freeze({
        presses: plan.length,
        cadence: FIRE_PRESS_CADENCE,
        hitTicks: FIRE_WINDOW.hitTicks.length,
        lastHitTick: FIRE_WINDOW.lastHitTick,
        glide: SWAP_MARGINS.glideTicks,
        /** Press tick, five-tick window, then the glide to the grid snap. */
        ticksPerPress: perPress,
        pressTicks: plan.length * perPress,
        coverFade: opensOnTick(0.1),
        lockFade: opensOnTick(0.01),
    });
}

/**
 * The pair, one field apart.
 *
 * ⚠ THE FIELD IS THE CHOREOGRAPHY, NOT A FLAG — the same shape §18.8's
 * entrance pair uses, one mechanic further in. Both arms boot into L39
 * with the same inventory and the same entrance; the control walks the
 * corridor, pulls the rope and stops at the foot of the shaft, and the
 * press arm fires eighteen times and walks up through where the locks
 * stood. A declared clear in the control would have proved the FLAGS
 * matter; this proves the PRESSES do.
 */
export const SHAFT_PAIR = Object.freeze({
    press: 'r5-shaft',
    control: 'r5-shaft-control',
    /** Where the control is pinned: the tile below the lowest WandLock. */
    pinnedAt: Object.freeze({ level: LEVEL, tile: Object.freeze({ tx: 9, ty: 5 }) }),
    /** ⚠ The control pulls the rope too — it has to, to reach the pin. */
    controlLedger: Object.freeze(['37:4', '38:5', '39:8', '38:4', '39:9']),
    pressLedger: Object.freeze(SHAFT_LEDGER_NET.map((f) => `${f.level}:${f.tag}`)),
});

/**
 * Check a plan against the room: every stance walkable-adjacent to what it
 * moves, and every `from` the `to` of the previous step for that block.
 *
 * The continuity check is the cheap half and it is the one that catches a
 * hand edit: a plan whose step 12 starts a block from a cell step 11 did
 * not leave it on is a plan that will fail at the eleventh press in the
 * game and at the second in the model.
 */
export function assertPlanContinuity(plan = SHAFT_PLAN, spawns = [[9, 11], [13, 5], [3, 11]]) {
    const at = new Set(spawns.map((s) => s.join(',')));
    plan.forEach((step, i) => {
        for (const m of step.moves) {
            const from = m.from.join(',');
            if (!at.has(from)) {
                fail(`SHAFT_PLAN[${i}] moves a block from (${from}), where no block is `
                    + `standing. The blocks are on [${[...at].join(' ')}] — a plan whose `
                    + 'steps do not chain is one that fails at the press nobody edited.');
            }
            at.delete(from);
        }
        for (const m of step.moves) {
            const to = m.to.join(',');
            if (at.has(to)) {
                fail(`SHAFT_PLAN[${i}] moves a block onto (${to}), which another block `
                    + 'already occupies.');
            }
            at.add(to);
        }
    });
    const want = new Set(['9,7', '11,9', '7,9']);
    for (const k of want) {
        if (!at.has(k)) {
            fail(`SHAFT_PLAN leaves no block on the lock-button at (${k}); it ends with `
                + `blocks on [${[...at].join(' ')}]`);
        }
    }
    return [...at];
}
