/**
 * seedlingDemo/playthroughWalk — THE CHAIN, as data. R7 slice 2.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.1 (the segment,
 * defined), §3.2 (the seam), §4 slice 2. Precedent: `r1Walk.js`'s six
 * ENDS-MEET segments (`docs/json/developer/procgen/seedling-bot.md`, "The
 * six segments, and why ENDS-MEET is the load-bearing part").
 *
 * ── WHAT R1 PROVED, AND WHAT THIS UPGRADES ────────────────────────────
 *
 * R1 split an eleven-minute walk into six tapes and asserted that the six
 * are the headline TICK FOR TICK, with the tick counts summing to the
 * headline's exactly (910 + 3548 + 2844 + 1145 + 4361 + 2155 = 14963,
 * re-measured at slice 0 §8.6). That is arithmetic, not analogy — but it is
 * arithmetic about POSITIONS. Six tapes can meet on level, position, item
 * set and `hitsMax` and still be six unrelated walks in every other
 * respect: a different RNG stream, a different day/night phase, a different
 * persistence state, a different music rejection-loop state.
 *
 * ⛓ ENDS-MEET v2 carries the STATE. Every boundary is checked over the
 * whole `SEAM_SIGNATURE` — `boot(N+1) == latch(N)`, field by field, from
 * the GAME's own latch on one side and the successor tape's own eight
 * blocks on the other (`seamBootFields`). The concatenation identity stays,
 * because it is the thing that makes a deleted or reordered segment
 * impossible; the seam is what makes the chain a PLAYTHROUGH rather than a
 * partition of one recording.
 *
 * ── ⛔ THE TOY CHAIN IS A TOY ON PURPOSE ──────────────────────────────
 *
 * Slice 2 proves the machinery, not the playthrough. `r7-ends-meet-*` is
 * two adjacent ALREADY-MODELLED rooms — L0 and L94, the west teleporter
 * pair `transition-west-return` has covered since R1 — cut at the L94
 * arrival. Nothing about it is a claim about the game; everything about it
 * is a claim about the seam. The real segments start from
 * `new Game(0, 80, 128)` with an empty save at slice 5.
 *
 * ⚠ AND EVERY SEGMENT ENDS AT AN ARRIVAL, INCLUDING THE LAST. R1's
 * boundaries were arrivals because an arrival is the constructor half-tile
 * with zero velocity, which is the only state `boot: {level, x, y}`
 * reproduces (`Game`'s ctor takes ints and adds 8; every other tick's `x`
 * is a float). R7 adds the second half of the same rule: `requireCalm` is
 * TRUE for a segment, so the fade must be spent, `shake` zero, nothing
 * frozen, nobody talking. A tape that ends mid-coast is not a segment even
 * if its position happens to be an integer.
 */

import { fixtureNames, loadTape } from './fixtures/index.js';
/**
 * ⛔ THE CAMPAIGN CHAIN'S ONE DECLARATION (⚖ ruling 38 (1), R9 slice 12d).
 * `r9-campaign`'s `segments` below is DERIVED from it, not typed here — the
 * producer that authors the tapes reads the same list, so a room cannot be
 * in one and not the other.
 */
import { CAMPAIGN_CHAIN_ID, CAMPAIGN_SEGMENT_NAMES } from './campaignChain.js';

export class PlaythroughError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PlaythroughError';
    }
}

/**
 * ── ⛓⛓⛓ R7 SLICE 6d: A WALK IS A SEQUENCE OF UNITS ───────────────────
 *
 * ⚖ **RULED** (the orchestrating session, 2026-08-09, answering §17.6's
 * design question): **a chain's walk is a sequence of UNITS, each of which
 * is a `leg` or a `phases` block.**
 *
 *   `leg`     PLANNER-AUTHORED. The unit carries a route (level, targets,
 *             exit) and NOT its ticks; `synthesizeLegs` positions every
 *             span by A* against live per-visit geometry, and `--check`
 *             re-derives them. This is what slice 6c shipped.
 *   `phases`  HAND-AUTHORED CHOREOGRAPHY, COMMITTED AS DATA. The spans are
 *             FIXED — they are in the file, byte for byte — with the probe
 *             or pair that witnessed them cited as PROVENANCE, and the
 *             block's OUTCOME asserted from the GAME's own readouts at
 *             block end (`persistence_cleared`, the mobile trace), never
 *             from a fight the model predicted.
 *
 * ⛔ THE PRECEDENT SAYS THIS IS NOT A NEW KIND OF THING. Every mover
 * certificate in this arc has been a tape SPAN, and every R5/R6 window was
 * a hand-authored plan script; what is new is only that the two kinds sit
 * in ONE walk. **A seam is indifferent to which kind produced its ticks** —
 * it compares the game's latch against the successor's boot, and neither
 * side can tell whether the ticks in between came from A* or from a
 * choreography. That indifference is what makes the mixture honest rather
 * than a loophole.
 *
 * ⚠ AND `KILL_ARM_POLICY` STAYS REFUSED (§16.4). A `phases` block does not
 * license the model to predict a kill; it licenses the CHAIN to carry ticks
 * the model cannot author. The model still owns mechanism and geometry, and
 * the game still adjudicates every death.
 */

/**
 * ⛓⛓⛓ THE L5 ARROW-BAIT CHOREOGRAPHY — the first `phases` block, and the
 * fight that opens the sword's corridor with NO WEAPON.
 *
 * `lock@48,112 {5,0}` is a KILL-LOCK (`tSet -1`) sitting on the L5 -> L6
 * teleporter's own cell, and `Player.as:782` gates attack on a sword the
 * player does not have. The game's answer is `Arrow.as:18,51` — an Arrow's
 * hitables include **"Enemy"** — so the room's four `arrowtrap`s and its
 * `button@48,48` (all `tSet 0`) are the weapon.
 *
 * ⛔ WHY THIS CANNOT BE A LEG. §16.4: nothing in the tree models an Arrow
 * killing an Enemy, and `KILL_ARM_POLICY.Bob` is REFUSED because
 * `Bob.update` steers straight at the player with no pathfinding and no
 * wall test (`Bob.as:59`'s `collideLine` guard is commented out), so the
 * body's position at any tick is the unmodelled term. `synthesizeLegs`
 * would have to predict a fight it cannot see.
 *
 * ⛓ THE NUMBERS ARE `probe-seedling-r7-l5-arrows.mjs`'s, unchanged, and
 * they transfer because the probe's boot IS this segment's boot: the probe
 * declares `{level: 5, x: 80, y: 32}` — L4's `stairsdown@64,16` drops the
 * player at exactly that tile — and `r7-act2-4` ends there.
 *
 * The order is the whole solve (§15.3):
 *
 *   press  61   arrival -> `button@48,48`. Planned by A*, in the probe,
 *               against a level record with the button REMOVED so that A*
 *               would end on its cell — a PLANNING-ONLY deletion whose
 *               consequence the model was never going to see either way.
 *   clear  240  the two left bobs start INSIDE `arrowtrap@16,16`'s lane
 *               (tile column 1, x 20/24/28), so pressing rains arrows onto
 *               them where they already are. Measured dead by t=187 of the
 *               probe's `stand` arm, with `hits 0 -> 1 -> 2` climbing ONE
 *               AT A TIME (trap 143: an Arrow does 1 damage; the 5 is the
 *               knockback force).
 *   bait   68   button -> (72,96). The third bob parks against
 *               `solid@48,64` in tile column 3 — the ONE column no trap
 *               covers — and only a stance east of it pulls its straight
 *               line into lane 4.
 *   dwell  40   it travels at `Bob.moveSpeed` 0.5 px/tick and has ~16 px of
 *               shadow to clear. A DRIVE-BY, not a stand: the first cut of
 *               this arm stood still for 200 ticks with three chasers and
 *               DIED silently (trap 142).
 *   back   68   (72,96) -> the button. From there the survivor's straight
 *               line runs into the solid's EAST face at x ~ 68, which is
 *               lane 4's own left edge, so it stays in the lane.
 *   hold   260  three landed arrows per Bob through 30-tick i-frames, and
 *               then `Lock.activationStep` drains alpha at 0.01/update —
 *               **100 more ticks before `turnOff()` writes the clear**. A
 *               hold that stopped at the kill would report a lock that was
 *               about to open.
 *
 * ⛔ `earns` IS WHAT THE BLOCK CHANGES ABOUT THE WORLD, AND IT IS WHY THE
 * CROSSING AFTER IT CAN BE PLANNED. `Lock.check()` (`Lock.as:39-45`)
 * removes a `tag >= 0 && tSet < 0` lock whose flag is cleared, and
 * `levelWorld`'s `lock-despawn` rule already applies it — so the leg AFTER
 * this block is planned against a level record with `{5,0}` cleared, which
 * is the state the GAME is really in at that tick. ⚠ The TAPE still boots
 * with `{5,0}` SET, because its boot is its predecessor's latch and the
 * flag is cleared MID-RUN.
 *
 * ── ⛓⛓⛓ AND THE MODEL IS TOLD, AT THE BLOCK'S OWN END TICK ───────────
 *
 * ⚖ RULED (the orchestrating session, slice 6d) after the measurement that
 * forced the question. The segment carrying this block walks through the
 * lock's cell, and the MODEL cannot follow: it has no Arrow x Enemy, so it
 * never despawns a lock the game removed mid-run. Driven and measured —
 * `tapeRunner` reproduces the recording byte-for-byte for **816 ticks** and
 * then sits **0.585 px** short at `lock@48,112`'s face; declaring the clear
 * makes it byte-exact over all 819. One field, whole cause.
 *
 * ⛔⛔ AND §16.5's SPLIT — end the fight at an arrival so the CROSSING boots
 * the clear — IS REFUTED BY THE GAME. The only exit that reaches an arrival
 * is out to L4 and back (62 ticks; it plans clean and the model follows it
 * clean). Re-entering L5 RESPAWNS all three bobs while the clear stays
 * durable: the driven segment took `hits 1`, never reached the teleporter,
 * and ended at (80.6, 103.6). **The general rule, not an L5 fact: per-visit
 * enemies against durable persistence means a fight and the crossing it
 * opens stay ONE segment wherever the fight's room must be left through
 * itself.**
 *
 * ⇒ the tape carries the clear as a v9 `at`, at THIS BLOCK'S END TICK — the
 * same tick the planner's truncated arm already asserts the game's own
 * `persistence_cleared` at, so the number is a measurement and not a fit.
 * `tapeFormat`'s v9 docblock carries the honesty analysis;
 * `playthroughAcceptance.witnessedClearFindings` carries the law that no
 * `at`-clear may exist without a block that earns it there.
 */
export const L5_ARROW_BAIT = Object.freeze({
    id: 'l5-arrow-bait',
    why: '⛓⛓⛓ THE KILL-LOCK, OPENED WITH NO WEAPON. Four arrowtraps and one button, '
        + 'all tSet 0; the arrows kill the three bobs, `Game.totalEnemies()` reaches 0, '
        + '`checkEnemies()` arms `lock@48,112 {5,0}` and 100 alpha steps later '
        + '`turnOff()` writes the durable clear the next leg walks through.',
    /**
     * ⛔ THE PROVENANCE IS A THREE-ARM PAIR, not a note. `off` (one tile east
     * of the button) HOLDS the lock and `stand` (on the button, 700 ticks)
     * HOLDS IT TOO — the second is what proves the bait is necessary rather
     * than decorative, and the first is what proves the button is what does
     * it. Only `bait` clears.
     */
    provenance: Object.freeze({
        probe: 'scripts/procgen/probe-seedling-r7-l5-arrows.mjs',
        arm: 'bait',
        controls: Object.freeze(['off — HOLDS: nothing pressed, nothing armed',
            'stand — HOLDS: the third bob parks in the one column no trap covers']),
        record: 'NewDocs/plans/seedling-bot-r7-opus-kickoff.md §15.3',
    }),
    /** ⚠ BOOT-FORM (the `Game` ctor adds a half-tile), asserted against the
     *  preceding legs' own final arrival. */
    startsAt: Object.freeze({ level: 5, x: 80, y: 32 }),
    /**
     * ⛔ WHERE THE BLOCK SITS IN THE WALK, in the walk's own ticks — the sum
     * of every unit before it. The planner CHECKS it against its own cursor
     * and refuses to author if it has moved; `witnessedClearFindings` needs
     * it to turn a tape's `at` back into "the tick this block ends", which
     * is the whole of the witnessed-clear law.
     */
    startsAtTick: 822,
    /** Where the `back` leg puts the player, and where the crossing plans from. */
    endsAt: Object.freeze({ level: 5, x: 48, y: 48 }),
    /** The block ends STANDING ON the button, which the next leg must declare. */
    contacts: Object.freeze(['proximity-hazard:button@48,48']),
    steps: Object.freeze([
        Object.freeze({ label: 'press', ticks: 61, planned: true }),
        Object.freeze({ label: 'clear', ticks: 240, planned: false }),
        Object.freeze({ label: 'bait', ticks: 68, planned: true }),
        Object.freeze({ label: 'dwell', ticks: 40, planned: false }),
        Object.freeze({ label: 'back', ticks: 68, planned: true }),
        Object.freeze({ label: 'hold', ticks: 260, planned: false }),
    ]),
    ticks: 737,
    /**
     * ⛔ THE SPANS ARE THE ARTIFACT. They are the probe's own — three A*
     * plans spliced around three idles by its `dwellAt` — frozen here rather
     * than re-derived, because re-deriving them would need the planning-only
     * button deletion in the CHAIN's planner, where it would be a fiction
     * about the level the chain is really walking. Committed as data, with
     * the probe cited above as the thing that measured them.
     */
    spans: Object.freeze([
        Object.freeze({ key: 'down', from: 0, to: 11 }),
        Object.freeze({ key: 'up', from: 11, to: 12 }),
        Object.freeze({ key: 'down', from: 12, to: 14 }),
        Object.freeze({ key: 'up', from: 16, to: 19 }),
        Object.freeze({ key: 'down', from: 20, to: 22 }),
        Object.freeze({ key: 'left', from: 26, to: 53 }),
        Object.freeze({ key: 'right', from: 55, to: 57 }),
        Object.freeze({ key: 'right', from: 301, to: 312 }),
        Object.freeze({ key: 'left', from: 312, to: 313 }),
        Object.freeze({ key: 'right', from: 313, to: 315 }),
        Object.freeze({ key: 'left', from: 317, to: 320 }),
        Object.freeze({ key: 'right', from: 321, to: 323 }),
        Object.freeze({ key: 'down', from: 327, to: 361 }),
        Object.freeze({ key: 'up', from: 363, to: 365 }),
        Object.freeze({ key: 'up', from: 409, to: 443 }),
        Object.freeze({ key: 'down', from: 445, to: 447 }),
        Object.freeze({ key: 'left', from: 451, to: 462 }),
        Object.freeze({ key: 'right', from: 462, to: 463 }),
        Object.freeze({ key: 'left', from: 463, to: 465 }),
        Object.freeze({ key: 'right', from: 467, to: 470 }),
        Object.freeze({ key: 'left', from: 471, to: 473 }),
    ]),
    earns: Object.freeze([Object.freeze({ level: 5, tag: 0 })]),
    /**
     * ⛔⛔ THE OUTCOME IS ASKED OF THE GAME, AT BLOCK END, AND NOWHERE ELSE.
     *
     * `cleared` is read off `persistence_cleared` and `enemies` off the
     * `--mobiles` trace — both are the running game's own readouts, sampled
     * by a driven arm that STOPS at tick 737. Asserting them at the end of
     * the whole segment would be weaker by a whole leg: a lock that opened
     * during the CROSSING rather than during the fight would pass.
     */
    outcome: Object.freeze({
        cleared: Object.freeze(['5,0']),
        enemies: 0,
    }),
});

/**
 * ⛓⛓⛓ THE L6 BAIT — the second `phases` block, and the first one whose
 * outcome is a BODY rather than a FLAG.
 *
 * ⛔⛔ L6 HAS NO CROSSING AT ALL FOR THE MODEL, and that is what makes this a
 * block. The room is walled three ways by three different mechanisms:
 * `Water` at (6,2)-(8,2) walls row 2; the `sandtrap` PAIRS at columns 4 and
 * 10 wall rows 1 and 3 (their 16x16 boxes reach only those rows, so row 2
 * passes UNDER them — a walk that tries row 1 oscillates at x~56 forever on
 * `sandtrap@64,16`'s knockback, which `synthesizeLegs` reports as a stall);
 * and `bob@96,16` at (6,1) and `bob@112,48` at (7,3) sit in EXACTLY the two
 * cells the weave needs. A `bob` is `combat.contactPricing`'s **`mover`**
 * (§16.4: `Bob.update` steers straight with no wall test, so its position is
 * the unmodelled term), so `levelRun` THROWS rather than pricing a contact at
 * a placement the run does not step. With both bodies present the model has
 * no route: row 1 is blocked for player centres in x (96,112) and row 3 for
 * x (112,128), at every y either row allows.
 *
 * ⛓⛓⛓ AND THE ROOM REMOVES ONE ITSELF. Two source facts, neither about the
 * player:
 *
 *   `Enemy.update`  `case 1: //Water -> destroy = true`. A chaser whose
 *                   straight line crosses the water DROWNS, and `Bob` has no
 *                   wall test to stop it.
 *   `Bob.as:39`     `solids.push("Enemy")` — a **sandtrap is a WALL for a
 *                   bob**, though not for the player, whose own solids list
 *                   does not contain enemies at all.
 *
 * ⇒ the stance is the whole solve, and it is one tile: **row 1, column 3**.
 * From there `bob@112,48`'s line to the player runs north-west ACROSS the
 * water and it drowns (t~62, measured); `bob@96,16` walks west along row 1
 * and PARKS against `sandtrap@64,16` at x=84.2 forever, eight pixels short of
 * ever reaching the player. No weapon, no player kill, no swimming — §18.6's
 * route, with the mechanism the measurement found underneath it.
 *
 * ⛔ THE CONTROLS ARE WHAT MAKE THE STANCE A CLAIM. `stay` never leaves the
 * arrival, where `bob@112,48` is 86 px away against `Bob.runRange` 80 — it
 * never wakes and never drowns, so the drowning is the ROUTE's. `south` is
 * the same column one ROW down, where the bob's line crosses row 2 WEST of
 * the water and it lives — so the stance's ROW is load-bearing rather than
 * decorative. Both HOLD; only `bait` removes a body.
 *
 * ── ⛓ AND THE OTHER BOB DROWNS TOO, WITHOUT BEING DECLARED ────────────
 *
 * `bob@96,16` follows the player east along row 2 during the CROSSING and
 * drowns at column 6 (t~265, driven). The tape says nothing about it, and
 * that is correct rather than sloppy: the model keeps a body at a placement
 * the route never touches, the game removes one the route never touches, and
 * the two agree everywhere the player is. A `despawn` for it would be a true
 * statement the model does not need — and every field in a tape is a thing a
 * future reader has to believe is load-bearing.
 */
export const L6_BOB_DROWN = Object.freeze({
    id: 'l6-bob-drown',
    why: '⛓⛓⛓ THE DETOUR CELL, EMPTIED BY THE ROOM. Row 1 column 3 is the one stance '
        + 'whose straight line from `bob@112,48` crosses the water: it drowns itself '
        + 'reaching the player, while `bob@96,16` parks against `sandtrap@64,16` — '
        + '`Bob.solids` contains "Enemy" and the player\'s does not. The crossing after '
        + 'it takes row 3 through the cell the drowned body was standing in.',
    provenance: Object.freeze({
        probe: 'scripts/procgen/probe-seedling-r7-l6-bait.mjs',
        arm: 'bait',
        controls: Object.freeze([
            'stay — HOLDS: the arrival is 86 px from bob@112,48 and `Bob.runRange` is '
                + '80, so it never wakes',
            'south — HOLDS: one row down, the same bob\'s line crosses row 2 WEST of '
                + 'the water and it lives',
        ]),
        record: 'NewDocs/plans/seedling-bot-r7-opus-kickoff.md §19',
    }),
    /** BOOT-FORM: `teleporter@48,112` in L5 declares `playerx 32, playery 16`. */
    startsAt: Object.freeze({ level: 6, x: 32, y: 16 }),
    startsAtTick: 1634,
    /** Row 1, column 3 — the stance, in boot form. */
    endsAt: Object.freeze({ level: 6, x: 48, y: 16 }),
    steps: Object.freeze([
        Object.freeze({ label: 'approach', ticks: 26, planned: true }),
        Object.freeze({ label: 'drown', ticks: 94, planned: false }),
    ]),
    ticks: 120,
    /**
     * ⛔ THE APPROACH'S SPANS ARE A*'s, FROZEN — the L5 block's rule, for the
     * L5 block's reason. Re-deriving them inside the chain would be harmless
     * here (no planning-only deletion is involved) and would still be wrong:
     * the DWELL's length is measured against the approach that was driven,
     * and a re-derived approach one tick longer would move the tick the game
     * was asked about without moving the number in the tape.
     */
    spans: Object.freeze([
        Object.freeze({ key: 'right', from: 0, to: 11 }),
        Object.freeze({ key: 'left', from: 11, to: 12 }),
        Object.freeze({ key: 'right', from: 12, to: 14 }),
        Object.freeze({ key: 'left', from: 16, to: 19 }),
        Object.freeze({ key: 'right', from: 20, to: 22 }),
    ]),
    /**
     * ⛓ `removes` IS `earns`' TWIN — the body the block takes out of the
     * world, which every later leg is planned against and which the tape
     * carries as a v10 `despawn` at this block's own end tick.
     */
    removes: Object.freeze([Object.freeze({ level: 6, id: 'bob@112,48' })]),
    /**
     * ⛔ THE OUTCOME IS A COUNT, because the GAME's readout is a count. The
     * `--mobiles` trace reports the bodies alive at block end; one left is
     * `bob@96,16`, parked against the sandtrap where it will stay until the
     * crossing pulls it into the water.
     */
    outcome: Object.freeze({
        cleared: Object.freeze([]),
        enemies: 1,
    }),
});

/**
 * ⛓⛓⛓ L8 — THE ROOM WHOSE CEILING IS ITS WEAPON, and the two blocks whose
 * outcome is a FLAG THE GAME'S OWN KILL WROTE.
 *
 * ⛔⛔ COLUMN 6 IS THE ONLY WAY SOUTH and both `sandtrap`s stand in it — a
 * sandtrap's 16x16 box IS its whole tile, so the walk cannot pass one. It
 * has to be gone, and nothing in this tree models an Arrow killing an Enemy
 * (§16.4, still refused). It does not have to:
 *
 *   `SandTrap.check()`    removes a body whose tag is cleared
 *   `SandTrap.removed()`  WRITES that clear (`Game.setPersistence(tag, false)`)
 *
 * so each kill's durable consequence is a FLAG the game produces, and a v9
 * `at`-clear carries it to the model at the tick a block witnessed it —
 * slice 6d's mechanism, arriving at the room §19.7 predicted it would fit.
 * (`levelWorld.PERSISTENCE_RESPONSE` gained `sandtrap` for this, and the
 * combat census gained the clears with it: before that a cleared body was
 * gone for the route and PRESENT for the contact test.)
 *
 * ── ⛔⛔ THE USER'S FIRST MOVE, REFUTED BY THE GAME ────────────────────
 *
 * §18.6's route opens "push `pushableblock@112,48` LEFT onto `button@64,48`;
 * the arrows kill the first sandtrap; push the block UP off the switch". It
 * is right about the game and this PLANNER cannot author it, for a reason
 * that is not about the block: a shove releases early by construction
 * (§17.1) and the leg then WAITS for the block to settle. The block lands on
 * the button at t~102 of a 128-tick leg and the player spends the remaining
 * 26 ticks standing at x=96.2 — whose 4-px box overlaps the arrow lane
 * [98,110) by two tenths of a pixel. **Driven: `hits 1`, and the knockback
 * left the player 4 px from where the model said they would be.**
 *
 * ⛓ AND THE USER'S ROUTE ALREADY MAKES THE PLAYER THE PRESSER FOR THE SECOND
 * KILL — "stand the switch until sandtrap 2 dies" — because a block pushed
 * NORTH off the button can never come back (row 1 column 4 is solid, so
 * nothing can stand north of it to push it south). So the shipped route is
 * the user's with ONE presser instead of two: park the block one tile short
 * of the button, out of the doorway it was blocking, and let the PLAYER
 * press for both kills. Two shoves instead of three, and the player is never
 * in the lane while the trap is armed.
 */
export const L8_ARROWS_SANDTRAP_1 = Object.freeze({
    id: 'l8-arrows-sandtrap-1',
    why: '⛓⛓⛓ THE ROOM\'S OWN CEILING KILLS THE FIRST SANDTRAP. `button@64,48` and '
        + '`arrowtrap@96,16` are both tSet 0, so a player standing on the button rains '
        + 'three arrows every eleven ticks down column 6 — and `sandtrap@96,80` is the '
        + 'first thing in it. `Enemy.hitsMax` is 3 through 30-tick i-frames, and the '
        + 'clear is written by `removed()` at the END of the death animation, so the '
        + 'hold is long on purpose.',
    provenance: Object.freeze({
        probe: 'scripts/procgen/probe-seedling-r7-l8-blocks.mjs',
        arm: 'kill1',
        controls: Object.freeze([
            'kill1-short — HOLDS: the same walk with the hold cut to 40 ticks leaves BOTH '
                + 'sandtraps alive and `persistence_cleared` empty',
            'block-onto-button — ⛔ REFUTES §18.6\'s first move: the planner\'s settle '
                + 'wait stands the player in the lane and the GAME charges `hits 1`',
        ]),
        record: 'NewDocs/plans/seedling-bot-r7-opus-kickoff.md §20',
    }),
    /**
     * ⛔ BOOT-FORM, AND IT IS A FLOAT BECAUSE IT IS A MEASUREMENT. The two
     * committed blocks before this one start at level ARRIVALS, which are
     * the constructor half-tile and therefore integers. This one starts
     * where an A* target left the player — `DEFAULT_TOLERANCE` is 1 px, not
     * an equality — and the planner compares `startsAt` EXACTLY on purpose:
     * the spans below were derived from THIS stance, and a block spliced
     * onto a different one is a choreography nobody drove.
     */
    startsAt: Object.freeze({ level: 8, x: 64.68409192161283, y: 63.882673638459124 }),
    startsAtTick: 2274,
    /** ON the button — tile (4,3), which is `button@64,48`'s own cell. */
    endsAt: Object.freeze({ level: 8, x: 64, y: 48 }),
    contacts: Object.freeze(['proximity-hazard:button@64,48']),
    steps: Object.freeze([
        Object.freeze({ label: 'press', ticks: 21, planned: true }),
        Object.freeze({ label: 'hold', ticks: 220, planned: false }),
    ]),
    ticks: 241,
    /**
     * ⛔ THE APPROACH'S SPANS ARE A*'s, FROZEN — L5's rule for L5's reason,
     * and with L5's planning-only deletion: A* works in whole tiles and will
     * not end on a cell it is told to avoid, so the press is planned against
     * a record with `button@64,48` DELETED. That fiction never reaches the
     * tape, the model's follow, or the game.
     */
    spans: Object.freeze([
        Object.freeze({ key: 'up', from: 0, to: 11 }),
        Object.freeze({ key: 'down', from: 11, to: 12 }),
        Object.freeze({ key: 'up', from: 12, to: 14 }),
        Object.freeze({ key: 'down', from: 15, to: 17 }),
    ]),
    earns: Object.freeze([Object.freeze({ level: 8, tag: 0 })]),
    outcome: Object.freeze({
        cleared: Object.freeze(['8,0']),
        /**
         * ⛔ ONE SANDTRAP LEFT, AND THE CLASS IS DECLARED. `sandtrap@96,128`
         * survives this block because `pushableblock@96,112` stands between
         * it and the trap — an Arrow stops on anything it touches, and a
         * `PushableBlock` is `type = "Solid"`. That shadow is why the second
         * block has to go into the water before the second kill can happen.
         */
        enemyClass: 'SandTrap',
        enemies: 1,
    }),
});

/**
 * ⛓⛓ THE SECOND KILL, once the shadow is gone.
 *
 * Between the two blocks the walk sinks `pushableblock@96,112` into the
 * water at (5,7) — `SHOVE_SINK_TICKS`' first real customer, discharging
 * §17.7's bounded vacuity — which clears the arrows' path from the trap all
 * the way to `sandtrap@96,128`. Then the same button, the same hold, one
 * room further down.
 *
 * ⚠ THE APPROACH IS 101 TICKS BECAUSE IT IS A WALK BACK UP THE ROOM, from
 * the sink stance at (7,7) to the button at (4,3) — up column 6 and then
 * WEST ALONG ROW 4, because the parked block occupies (5,3). It is planned
 * against the record the shoves have edited, which is the whole content of
 * the defect this room found: a fresh plan puts every pushable back at its
 * `.oel` cell, and the first cut of this walk therefore routed through the
 * cell the parked block really stands in and SHOVED IT NORTH out of the way.
 */
export const L8_ARROWS_SANDTRAP_2 = Object.freeze({
    id: 'l8-arrows-sandtrap-2',
    why: '⛓⛓ THE SAME BUTTON, THE SAME CEILING, ONE SANDTRAP FURTHER DOWN — and it '
        + 'only works because `pushableblock@96,112` is at the bottom of the water. An '
        + 'Arrow stops on anything it touches and a PushableBlock is `type = "Solid"`, '
        + 'so until the sink the second sandtrap stood in the trap\'s SHADOW.',
    provenance: Object.freeze({
        probe: 'scripts/procgen/probe-seedling-r7-l8-blocks.mjs',
        arm: 'kill2',
        controls: Object.freeze([
            'kill1 — HOLDS: 220 ticks of arrows with the block still at (6,7) clear {8,0} '
                + 'and leave {8,1} SET, which is what makes the sink load-bearing',
            'kill1-short — HOLDS: a 40-tick hold clears nothing at all',
        ]),
        record: 'NewDocs/plans/seedling-bot-r7-opus-kickoff.md §20',
    }),
    /** BOOT-FORM, where the sink leg leaves the player — a float, for the
     *  reason `L8_ARROWS_SANDTRAP_1.startsAt` gives. Tile (7,7). */
    startsAt: Object.freeze({ level: 8, x: 104.43409192161285, y: 112.23267363845915 }),
    startsAtTick: 2706,
    endsAt: Object.freeze({ level: 8, x: 64, y: 48 }),
    contacts: Object.freeze(['proximity-hazard:button@64,48']),
    steps: Object.freeze([
        Object.freeze({ label: 'press', ticks: 101, planned: true }),
        Object.freeze({ label: 'hold', ticks: 260, planned: false }),
    ]),
    ticks: 361,
    spans: Object.freeze([
        Object.freeze({ key: 'left', from: 0, to: 6 }),
        Object.freeze({ key: 'right', from: 6, to: 7 }),
        Object.freeze({ key: 'up', from: 0, to: 39 }),
        Object.freeze({ key: 'down', from: 39, to: 40 }),
        Object.freeze({ key: 'up', from: 40, to: 41 }),
        Object.freeze({ key: 'left', from: 45, to: 69 }),
        Object.freeze({ key: 'right', from: 69, to: 70 }),
        Object.freeze({ key: 'left', from: 70, to: 72 }),
        Object.freeze({ key: 'right', from: 74, to: 76 }),
        Object.freeze({ key: 'up', from: 80, to: 91 }),
        Object.freeze({ key: 'down', from: 91, to: 92 }),
        Object.freeze({ key: 'up', from: 92, to: 94 }),
        Object.freeze({ key: 'down', from: 95, to: 97 }),
    ]),
    earns: Object.freeze([Object.freeze({ level: 8, tag: 1 })]),
    outcome: Object.freeze({
        cleared: Object.freeze(['8,0', '8,1']),
        enemyClass: 'SandTrap',
        enemies: 0,
    }),
});

/** The two kinds of unit a walk is made of. */
const UNIT_KINDS = Object.freeze(['leg', 'phases']);

/**
 * ⛔ EVERY UNIT IS EXACTLY ONE KIND, AND A `phases` BLOCK DECLARES ALL SIX
 * OF THE THINGS THAT MAKE IT CHECKABLE.
 *
 * A hand-authored block is the one place in this machinery where a number
 * can be typed, so it is the one place that needs a shape refusal: a block
 * whose `ticks` disagree with its steps, whose spans run past its end, or
 * which declares no OUTCOME is a choreography nobody can fail.
 */
export function assertWalkUnits(chain) {
    const units = chain.walk?.units;
    if (units === undefined) return { units: 0, legs: 0, phases: 0 };
    if (chain.walk.legs !== undefined || chain.walk.inputs !== undefined) {
        throw new PlaythroughError(
            `chain "${chain.id}" declares units AND ${chain.walk.legs !== undefined
                ? 'legs' : 'inputs'}; a walk has exactly one spelling or the planner and `
                + 'the tests read different walks');
    }
    if (!Array.isArray(units) || units.length === 0) {
        throw new PlaythroughError(`chain "${chain.id}" declares an empty unit list`);
    }
    let legs = 0;
    let phases = 0;
    units.forEach((u, i) => {
        const kinds = UNIT_KINDS.filter((k) => u[k] !== undefined);
        if (kinds.length !== 1) {
            throw new PlaythroughError(
                `chain "${chain.id}" unit ${i} declares [${kinds.join(', ') || 'nothing'}]; `
                + `a unit is exactly one of ${UNIT_KINDS.join(' / ')}`);
        }
        if (kinds[0] === 'leg') { legs += 1; return; }
        phases += 1;
        const p = u.phases;
        const what = `chain "${chain.id}" unit ${i} (phases "${p.id ?? '?'}")`;
        for (const field of ['id', 'why', 'provenance', 'startsAt', 'startsAtTick',
            'endsAt', 'steps', 'ticks', 'spans', 'outcome']) {
            if (p[field] === undefined) {
                throw new PlaythroughError(`${what} declares no ${field}. A hand-authored `
                    + 'block with no provenance is a number nobody measured, and one with '
                    + 'no outcome is a choreography that cannot fail.');
            }
        }
        const summed = p.steps.reduce((n, s) => n + s.ticks, 0);
        if (summed !== p.ticks) {
            throw new PlaythroughError(`${what}: its steps sum to ${summed} and it declares `
                + `${p.ticks} ticks. The step table is the block's own account of where its `
                + 'ticks went; a table that does not add up describes a different block.');
        }
        p.spans.forEach((s, si) => {
            if (!(s.to > s.from) || s.from < 0 || s.to > p.ticks) {
                throw new PlaythroughError(`${what}: span ${si} ${JSON.stringify(s)} is not `
                    + `a non-empty [from, to) inside [0, ${p.ticks})`);
            }
        });
        if (!Array.isArray(p.outcome.cleared)) {
            throw new PlaythroughError(`${what}: outcome.cleared must be a list of `
                + '"level,tag" strings read off the game\'s own persistence_cleared');
        }
        for (const e of p.earns ?? []) {
            if (!Number.isInteger(e.level) || !Number.isInteger(e.tag)) {
                throw new PlaythroughError(`${what}: earns entries are {level, tag}`);
            }
            if (!p.outcome.cleared.includes(`${e.level},${e.tag}`)) {
                throw new PlaythroughError(`${what}: it EARNS {${e.level},${e.tag}} — which `
                    + 'every later leg is then planned against — and its outcome does not '
                    + 'assert that clear. A block may not change the world the planner '
                    + 'sees without asking the game whether it did.');
            }
        }
        /**
         * ⛓ R7 slice 6e: `removes` is `earns`' twin — the BODIES the block
         * takes out of the world, which every later leg is then planned
         * against and which the tape carries as a v10 `despawn`.
         *
         * ⛔ AND ITS OUTCOME OBLIGATION IS A COUNT, not a name, because the
         * game's own readout is a count. `--mobiles` reports the bodies
         * alive at block end; a block that removes N of them must say how
         * many it expects to be LEFT, and `outcome.enemies` is that number.
         * Removing a body without declaring the count would be a block that
         * moves the planner's world and asks the game nothing.
         */
        for (const r of p.removes ?? []) {
            if (!Number.isInteger(r.level) || typeof r.id !== 'string') {
                throw new PlaythroughError(`${what}: removes entries are {level, id} with `
                    + 'id a level record placement "<type>@<x>,<y>"');
            }
            if (typeof p.outcome.enemies !== 'number') {
                throw new PlaythroughError(`${what}: it REMOVES ${r.id} from level `
                    + `${r.level} — which every later leg is then planned against — and `
                    + 'its outcome declares no `enemies` count. The game\'s own readout '
                    + 'for a removed body is how many are LEFT, so a block that moves a '
                    + 'body out of the planner\'s world without asking for that number '
                    + 'is a removal nobody witnessed.');
            }
        }
    });
    return { units: units.length, legs, phases };
}

/**
 * ⛓ THE TRUE INITIAL STATE — `Main.as:50-51`, verified at slice 0 §8.2.
 *
 * The game's own boot on branch `bot` is `new Game(0, 80, 128)` with an
 * empty save. Segment 1 of the REAL chain must boot exactly this and
 * declare no seam block at all, because there is no predecessor to inherit
 * from — that is the custody claim's base case, and `playthroughAcceptance`
 * asserts it rather than assuming it.
 */
export const TRUE_INITIAL_BOOT = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * ⛔⛔⛔ THE CHAIN KINDS, AS A POLICY TABLE — R8 slice 0 track D, ⚖ ruled
 * (kickoff §3.6 and §6.1).
 *
 * R7's chains are CUSTODY chains: segment 1 boots the game's own boot, every
 * later segment inherits its predecessor's latch through the seam, and what
 * the chain earns it earned. R8's solver produces something different —
 * segments verified INDIVIDUALLY from a DECLARED boot (items granted via save
 * flags, persistence pre-cleared, any RNG), because the bot is RNG-robust and
 * a tape is not, and a per-segment verification declares its boot. Those are
 * STAGED chains.
 *
 * ── ⛔ WHY THIS IS A TABLE AND NOT TWO `if` STATEMENTS ─────────────────
 *
 * Trap 119 is this arc's most expensive law and it has now been proved
 * TWICE: a ledger with no caller reads exactly like a ledger that is empty.
 * A `kind` field consumed by an `if` buried in one function would be the same
 * shape — so every consequence of the kind is a ROW HERE, `chainPolicy`
 * resolves it, and `chainFindings` DERIVES a named, non-failing row from each
 * consequence it skips. A staged chain's custody row is REPORTED as skipped
 * WITH THE REASON, never silently absent.
 *
 * ── WHAT A STAGED CHAIN KEEPS, AND WHY ────────────────────────────────
 *
 *  · **seams between its own segments** — a staged chain of 2+ segments
 *    still measures every internal seam. Its BOOT is declared; its
 *    CONTINUITY is not, and that is exactly the claim a seam makes.
 *  · **the witnessed-clear and witnessed-despawn laws** — §2.4 of the
 *    kickoff measured the gap this closes: `witnessedClearFindings` iterates
 *    CHAINS, so an unchained solver tape's v9 `at`-clears and v10 despawns
 *    are never witnessed at all. Letting solver segments form a staged chain
 *    is what brings them back under the law.
 *  · **calm arrivals** — `isPlaythroughSegment` is chain-derived, so a staged
 *    segment is required to end calm the same way a custody one is.
 *    Assembly will demand it; the policy enforces it now.
 *
 * ── WHAT IT SKIPS ─────────────────────────────────────────────────────
 *
 *  · **the custody base case** — segment 1 of a staged chain boots a DECLARED
 *    state on purpose. Asserting it boots `TRUE_INITIAL_BOOT` would be
 *    asserting the opposite of what the chain is for.
 *  · **goal-ledger CREDIT** — ⛔ A STAGED BOOT CAN DECLARE A FLAG; IT CANNOT
 *    EARN ONE. `goalEarnedWitness` asks whether a collectible went NOT-HELD
 *    to HELD between a segment's boot and its latch, which a declaration
 *    cannot fake — but the campaign's claim is that the run reached the item
 *    honestly, and a staged boot skips the reaching. So a staged chain's
 *    ledger rows are REPORTED and never CREDITED; earning stays the custody
 *    chains' claim.
 */
export const CHAIN_KINDS = Object.freeze({
    custody: Object.freeze({
        custodyBaseCase: true,
        goalLedgerCredit: true,
        minSegments: 2,
        why: 'R7\'s claim: segment 1 boots the game\'s own boot and every later '
            + 'segment inherits its predecessor\'s latch, so the whole chain is one '
            + 'run the game could have played',
    }),
    staged: Object.freeze({
        custodyBaseCase: false,
        goalLedgerCredit: false,
        // ⚠ ONE IS LEGAL HERE, and that is the point of the kind. R8 verifies
        // solver segments INDIVIDUALLY; a chain of one still gets the
        // witnessed-clear/despawn laws and the calm-arrival requirement,
        // which is precisely the gap kickoff §2.4 measured for unchained
        // tapes. A custody chain of one would have no seam, and a seam is
        // the whole custody claim — hence the two minimums differ.
        minSegments: 1,
        why: 'R8\'s per-segment verification: the boot is DECLARED, so custody is not '
            + 'claimed and the ledger is reported rather than credited — but the seams '
            + 'between its own segments, the witnessed-clear/despawn laws and the '
            + 'calm-arrival requirement all still hold',
    }),
});

/**
 * A chain's kind, defaulting to `custody`. ⛔ THE DEFAULT IS WHAT KEEPS BOTH
 * EXISTING CHAINS BYTE-UNCHANGED: neither declares a `kind` at all, which a
 * test asserts rather than assumes.
 */
export function chainKind(chain) {
    const k = chain.kind ?? 'custody';
    if (!CHAIN_KINDS[k]) {
        throw new PlaythroughError(`chain "${chain.id}" declares kind "${k}"; the kinds `
            + `are ${Object.keys(CHAIN_KINDS).join(', ')}. An unknown kind would fall `
            + 'through to whichever branch was written last, which is how a staged boot '
            + 'would quietly acquire a custody claim.');
    }
    return k;
}

/** The policy row for a chain's kind — one lookup, one table. */
export function chainPolicy(chain) {
    return CHAIN_KINDS[chainKind(chain)];
}

/**
 * ⛔ THE CHAINS, ORDERED. One entry per chain; each names its segments IN
 * ORDER, and OPTIONALLY a headline.
 *
 * `headline` is the same walk driven in ONE run, and where a chain has one the
 * concatenation identity is asserted against it.
 *
 * ⛔⛔ THE CAMPAIGN CHAIN HAS NONE, AND THAT IS THE INSTRUCTION NOW — ⚖ ruling
 * 37 (user, 2026-08-23): *"the plan was to use the tools to play the individual
 * campaign tapes in sequence, not combine them into one tape."* `r9-campaign`
 * IS the sequence of its sixteen segment tapes; the claim that they are one
 * walk is made where it is actually driven — `?tapes=r9-campaign` on the JS
 * page and on the real recompiled game, each window admitted at its boundary
 * against the LIVE world's own latch and diffed per tick against its own
 * segment played ALONE (⚖ ruling 23). The concatenated tape never carried that
 * claim; it was R8's `PLAYTHROUGH_CHAINS` convention, inherited at slice 6.
 *
 * ⛓ THE R7/R8 STAGED CHAINS KEEP THEIRS, and the reason is what they are for.
 * `toy-west-pair` and `r8-d2` exist to prove the MACHINERY — that a cut is a
 * measurement — so for them the one-run recording IS the subject, and
 * `toy-west-pair`'s headline is additionally the thing its FREE ORACLE (a
 * byte-frozen R1 fixture) is compared against. A chain whose headline is its
 * subject cannot retire it; the campaign's headline was a redundant witness,
 * and it was MEASURED to be redundant before it was deleted: the sixteen
 * segments played alone and concatenated are the headline's 3616 observations
 * with no differing index.
 *
 * `freeOracle` names a COMMITTED, FROZEN fixture whose observation stream
 * the headline should reproduce. `transition-west-return` has been in the
 * roster since R1 and is byte-frozen; the toy headline is the same inputs
 * with `pins: ["dead_frames"]` added, so if the two streams agree, the pin
 * is observation-inert and the chain costs the roster nothing to believe.
 * If they DISAGREE that is a finding about the pin, reported by name — not
 * a failure of the chain.
 */
const CHAIN_DECLARATIONS = Object.freeze([
    Object.freeze({
        id: 'toy-west-pair',
        why: '⛓ SLICE 2\'s PROOF OF THE MACHINERY, not of the game. Two adjacent '
            + 'already-modelled rooms (L0 and L94, the west teleporter pair) cut at the '
            + 'L94 ARRIVAL — the one tick in this walk that a `boot: {level, x, y}` can '
            + 'reproduce, because it is the constructor half-tile (288+8, 160+8) with a '
            + 'fresh Player at zero velocity.',
        headline: 'r7-ends-meet-full',
        freeOracle: 'transition-west-return',
        segments: Object.freeze(['r7-ends-meet-1', 'r7-ends-meet-2']),
        /**
         * ⚠ THE CUT TICK IS DATA, AND IT IS THE COMMITTED EXPECTATION'S OWN
         * TRANSITION RECORD — `transition-west-return` puts L0 -> L94 at
         * t=61 and L94 -> L0 at t=109. The chain ends at 109 rather than at
         * 150 so that the LAST segment also ends at an arrival; the
         * original tape's tail coasts to a stop mid-level, which is a
         * position no boot reproduces and a state `requireCalm` would have
         * to be switched off to accept.
         */
        /*
         * ⛓ NO `seamBuildCost`, AND ITS ABSENCE IS THE RESULT. Slice 2 had to
         * declare one — a segment boundary duplicated one L94 build (1562
         * gameplay draws, 21 dead frames, measured with zero residue) because
         * a tape declared a PRE-build stream position and the latch read a
         * POST-build one. Slice 2b's begin()-ENTRY latch made those the same
         * instant, so segment 2's own build consumes the same draws and the
         * chain ends where the headline ends. The bridge was DELETED rather
         * than adjusted, per §10.1 step 4 — see `chainFindings`' claim 4.
         */
        /**
         * ⛓ THE WALK ITSELF, so the planner and the tests read ONE source.
         *
         * The inputs are `transition-west-return`'s, unchanged — the same
         * two spans that have been in the roster since R1. What is added is
         * declared here rather than typed into a tape:
         *
         *  · `pins: ["dead_frames"]` — `save.time` is a `pinned-equality`
         *    signature row (`Game.as:832`'s `time += timeRate` counts DEAD
         *    frames, which are per-RENDER in vanilla and ±2-banded per
         *    load). A committed chain whose seam carries an unpinned `time`
         *    would go red on the sweep for a render count, not a defect.
         *  · `fpSeed` — the chain declares FlashPunk's LCG rather than
         *    inheriting it. ⚠ NOT because the page's own seed is random:
         *    `Engine.as:50` seeds it from one `Math.random()`, and in this
         *    build `Math.random()` is the fixed-seed avmplus LFSR (R5 slice
         *    23), so every page load gets the SAME seed — slice 2's probe
         *    measured a byte-identical triple across six loads. The chain
         *    declares it so that its reproducibility does not DEPEND on
         *    that coincidence of the build: a `MOCK_DATE_TIME` override at
         *    build time would move the boot seed and silently move an
         *    inherited chain with it. The value is a state the LCG really
         *    occupies (measured by slice 1's v8 probe), not a round number.
         */
        walk: Object.freeze({
            inputs: Object.freeze([
                Object.freeze({ key: 'left', from: 0, to: 72 }),
                Object.freeze({ key: 'right', from: 88, to: 140 }),
            ]),
            pins: Object.freeze(['dead_frames']),
            fpSeed: 987286273,
        }),
    }),
    /**
     * ⛓⛓⛓ THE R8 BATTERY — the first `staged` chains on disk, ending slice
     * 0's bounded vacuity ("no staged chain exists yet; slice 2 is the first
     * producer"). One chain per solver segment, kind `staged`:
     * per-segment verification IS a one-segment chain (`minSegments` 1), and
     * registering each brings it under the calm-arrival requirement and the
     * witnessed-clear/despawn laws the unchained shape measured itself
     * outside of (kickoff §2.4).
     *
     * ⛔ EACH CHAIN'S HEADLINE IS ITS OWN SEGMENT, and that is a definition
     * rather than a dodge: the headline is "the same walk driven in ONE
     * run", and a one-segment chain's whole walk IS the segment. The
     * arithmetic, stream-slice and ending-state rows then run against real
     * content instead of skipping for a missing name — an acceptance row
     * that cannot run reads exactly like one that passed (trap 119).
     *
     * ⛔ EARNS ARE DECLARED WHERE MEASURED AND ARE REPORTED, NOT CREDITED —
     * the staged policy's own rule: r8-solve-10 really flips `hasSword`
     * between its boot and its latch (a declaration cannot fake the flip;
     * the measurement is taken), but a staged boot skips the REACHING, so
     * the campaign's credit stays the custody chains' claim.
     *
     * ⚠ Tick counts (`endsAt`) are the solver's own, asserted against the
     * tapes by the arithmetic row; the solver-vs-hand diff lives in each
     * tape's description and in kickoff §10 (INFORMATION, not a gate).
     */
    /**
     * ⛓⛓⛓ R8 SLICE 3b ADDS 4 AND 6, AND `r8-battery-6`'s ARRIVAL IS THE
     * WITHDRAWN ROW'S OWN STORY FINISHING.
     *
     * Slice 2 recorded a probe-graduated L6 and the GAME REFUTED IT: the
     * solve was COMBAT-BLIND (the builder's default `roles` — the slice's
     * own defect, now refused by `solveSegment` by name), the game's player
     * fought the row-1 sandtrap and died twice, and the census-on model
     * reproduced that whole disaster digit for digit. The withdrawn pair is
     * still banked as a free oracle in
     * `NewDocs/plans/r8-slice2-l6-blind-probe/`.
     *
     * ⛔ THE ROW THAT REPLACES IT IS A DIFFERENT WALK, not a re-record. It
     * is authored by a census-ON solver whose ladder REFUSES the blind
     * corridor before a tick is spent — the danger map gained the
     * ingredient that was missing (static census bodies; the blind walk's
     * first sandtrap contact is now a named refusal at plan time) — and its
     * answer is a BAIT that drowns `bob@112,48`, which the room does
     * itself. Zero hits, zero deaths, 294 ticks against the hand's 355.
     *
     * ⛓ AND `r8-battery-4` IS THE FIRST STAGED CHAIN WHOSE SEGMENT SHOVES.
     *
* ⛓⛓⛓ R8 SLICE 5 ADDS 5 AND 8 — AND THE ROWS CARRY THEIR OWN
     * PROVENANCE, WHICH IS THE HALF §3.6 DESIGNED AND NOBODY BUILT.
     *
     * Both segments DECLARE v9 `at` rows their own walks earn, and the
     * witnessed-clear law REFUSED them the first time they were registered —
     * four rows, by name — because it demanded the outcome of a `phases`
     * block and a solver chain has no walk at all. ⛔ The law was right and
     * its premise predated the solver: "an `at`-clear nobody measured is a
     * staged grant with extra steps" is the discipline that should hold.
     *
     * ⚖ RULED (orchestrator, mid-slice): the missing piece is the CARRIER,
     * not the obligation. A staged chain's `clears` rows are held to the same
     * standard a phases block's `provenance.probe` is — authored, checkable,
     * refused when absent — and the match is TWO-SIDED, so a provenance no
     * tape carries reds exactly as loudly as a clear no provenance names.
     *
     *   `{5,0}`@427  MODEL-sourced. `chaserKillLockOpens` computes the
     *                removal at 326 and `activators.opensOnTick` is 101; the
     *                finding re-adds them rather than trusting the sum.
     *   `{8,0}`@246  GAME-sourced, and a BOUNDARY MEASURED ON BOTH SIDES: a
     *   `{8,1}`@645  246-tick truncation of this walk carries the tag and a
     *                245-tick one does not (645/644 likewise). A one-sided
     *                reading measures "cleared by now", which is a band.
     *
     * ⛔ AND `r8-battery-5` IS THE ROW SLICE 4 COULD NOT ADD. Its first walk
     * was REFUTED by the game (§13.1) and banked rather than committed; this
     * one is a different walk, authored under ⚖ §13.10a's ETA-aware transit
     * probe, and the game accepted it at zero hits.
     */
    ...[
        Object.freeze({ seg: 1, earns: [] }),
        Object.freeze({ seg: 2, earns: [] }),
        Object.freeze({ seg: 3, earns: [] }),
        Object.freeze({ seg: 4, earns: [] }),
        Object.freeze({
            seg: 5,
            earns: [],
            clears: Object.freeze([Object.freeze({
                level: 5, tag: 0, source: 'model',
                evidence: Object.freeze({
                    removedAt: 326,
                    fade: 101,
                    why: '`chaserKillLockOpens`\'s removal (the third bob dies to the '
                        + 'ceiling and `Game.totalEnemies()` reaches zero) plus '
                        + '`activators.opensOnTick(RESPONDERS.lock.fade)`',
                }),
            })]),
        }),
        Object.freeze({ seg: 6, earns: [] }),
        Object.freeze({
            seg: 8,
            earns: [],
            clears: Object.freeze([
                Object.freeze({
                    level: 8, tag: 0, source: 'game',
                    evidence: Object.freeze({
                        carriesAt: 246,
                        absentAt: 245,
                        why: 'the GAME\'s own `persistence_cleared`, by truncation — '
                            + '§11.4 REFUSES to compute a static `"Enemy"` body\'s arrow '
                            + 'death, so the model may not substitute here',
                    }),
                }),
                Object.freeze({
                    level: 8, tag: 1, source: 'game',
                    evidence: Object.freeze({
                        carriesAt: 645,
                        absentAt: 644,
                        why: 'the second `SandTrap`, the same instrument — a boundary '
                            + 'measured on both sides rather than a poll',
                    }),
                }),
            ]),
        }),
        Object.freeze({ seg: 7, earns: [] }),
        Object.freeze({ seg: 9, earns: [] }),
        Object.freeze({ seg: 10, earns: ['sword@L10'] }),
        Object.freeze({ seg: 11, earns: ['chest@L11'] }),
    ].map(({ seg, earns, clears = [] }) => Object.freeze({
        id: `r8-battery-${seg}`,
        kind: 'staged',
        why: `R8 slice ${[5, 8].includes(seg) ? '5' : ([4, 6].includes(seg) ? '3b' : '2')}: `
            + 'the live solver\'s own '
            + `solution to act2 segment ${seg}, from `
            + `r7-act2-${seg}'s committed v8 boot block (staged per kickoff §3.5). Goals `
            + 'derived from the chain\'s own units; the hand-authored stances and '
            + 'waypoints were not handed over. See the tape\'s description and the '
            + 'decision-trace sidecar in fixtures/traces/.',
        headline: `r8-solve-${seg}`,
        segments: Object.freeze([`r8-solve-${seg}`]),
        earns: Object.freeze(earns),
        /**
         * ⛓ R8 SLICE 5 — the timed clears this chain's own tapes declare,
         * with the instrument that measured each. `stagedClearFindings`
         * matches them against the tapes TWO-SIDED and re-derives the
         * arithmetic; an empty list is the honest answer for a segment that
         * clears nothing.
         */
        clears: Object.freeze(clears),
    })),
    /**
     * ⛓⛓⛓ R8 SLICE 6 — THE FIRST STAGED CHAIN THAT IS **NOT** AN act2
     * SEGMENT, and the rung's boundary target.
     *
     * Every staged chain before this one re-solves a room the HAND pipeline
     * had already solved, so its tick count had something to be compared
     * against and the differential was a second opinion. L20 is the first NEW
     * room the solver crosses: there is no hand answer, no committed walk and
     * no prior recording, so **the differential is the entire gate**.
     *
     * ⛔ `hasShield` FLIPS INSIDE THE DRIVEN SEGMENT — R6 debt 5, the arc's
     * oldest undischarged item ("`hasShield` is real-collected by NO tape"),
     * measured here from the game's own readouts. ⛔ AND IT IS REPORTED,
     * NEVER CREDITED: the kind is `staged`, so what the boot skips is the
     * REACHING. `goalEarnedWitness` still wants the flip between boot and
     * latch, which a declaration cannot fake.
     *
     * ⚠ THE `earns` LIST IS EMPTY AND THAT IS THE POINT. `R7_GOAL_LEDGER`'s
     * `shield@L20` row belongs to the CAMPAIGN's claim; a staged chain that
     * declared it would be crediting a boot. The flip is asserted by the
     * plan script and by the tape's own seam, not by the ledger.
     *
     * ⚠ NO `clears` PROVENANCE ROW, and the absence is a decision: this walk
     * declares no timed v9 `at` clear at all. `{20,2}` is EARNED by the
     * pickup during the run (`earnedClears`), which is a different channel
     * from a declared clear and needs no provenance — the run computes it end
     * to end.
     */
    Object.freeze({
        id: 'r8-d2-shield',
        kind: 'staged',
        why: 'R8 slice 6: the live solver crosses L20 from the L19 arrival and takes the '
            + 'shield, from r7-act2-11\'s committed v8 boot block (the campaign\'s own '
            + 'post-sword latch, staged per kickoff §3.5). ⛔ The three gates '
            + '(`shieldlocknorm` -> `buttonroom` -> `lock@32,80`) are BEHIND the shield '
            + 'and open the way OUT to L13; this segment leaves by the stairs it arrived '
            + 'on, because a segment ends at a LEVEL ARRIVAL.',
        headline: 'r8-solve-20',
        segments: Object.freeze(['r8-solve-20']),
        earns: Object.freeze([]),
        clears: Object.freeze([]),
    }),

    /**
     * ⛓⛓⛓ R8 SLICE 7 — **THE MACHINERY'S FIRST MULTI-SEGMENT STAGED CHAIN**,
     * and ⛓⛓⛓ R9 SLICE 3 — **THE SPLICE**: the honest L18 PREPENDED, so it is
     * THREE segments and the chain no longer DECLARES its own front door.
     *
     * Every staged chain before this one is a single segment whose headline IS
     * its segment — an honest definition there, because "the same walk driven
     * in one run" and the segment are the same tape. This one has THREE, so it
     * exercises everything a one-segment chain never can: a HEADLINE that is a
     * different recording, TWO CUTS, the ENDS-MEET arithmetic (`541 + 864 +
     * 781 = 2186`), three stream slices, and TWO INTERNAL SEAMS that are
     * measured equalities over all 46 signature rows.
     *
     * ⛓ **R9 SLICE 11 RE-DERIVED EVERY NUMBER IN THIS ROW.** Repairing
     * `solverBot.facingToward` (trap 498) gave the kill arm a strike cell ABOVE
     * the body, so L18's walk is 32 ticks shorter and the whole chain moves with
     * it: `573 + 864 + 781 = 2218` became **`541 + 864 + 781 = 2186`**, the cuts
     * became `[541, 1405]`, and the clear moved `385 -> 393` off a removal that
     * moved `284 -> 292`. ⚠ THE REMOVAL IS LATER WHILE THE WALK IS SHORTER —
     * the repair does not accelerate uniformly, it changes WHICH cell is struck,
     * and the route out of the room is what shortened. The `Lock`'s own fade is
     * UNMOVED at 101, which is the arithmetic saying the mechanism did not change.
     * ⛔ These four numbers are a DECLARATION and the tapes are the fact: the
     * solver-roster gate failed FOUR rows against the re-record until they were
     * re-derived here — *"a bound that outlives a re-record slices the wrong
     * window"* — so they are computed from the segments, never retyped.
     *
     * ⛔ THE CUT IS DECIDED BY PERSISTENCE, NOT GEOGRAPHY (trap 150). L19's
     * fight and the crossing it opens are ONE segment because a fight does not
     * survive the door: the ShieldBoss, his key and his `{19,0}` are all
     * per-visit, so a cut between the kill and the stairs would boot a room
     * that has to be fought again.
     *
     * ⛔ AND EVERY SUCCESSOR'S BOOT IS THE **GAME'S** LATCH. Two of the seam's
     * rows are `modelled: false` — `save.time` advances per `Game.update()`
     * including dead frames, and the RNG streams advance on draws no model
     * line makes — so `solve-seedling-r8-d2-chain.mjs` drives segments 0 and 1
     * through the WINDOWS channel and hands each `botSeam()` to
     * `segmentBootFromLatch`. A boot the model invented for those two would be
     * a number nobody measured.
     *
     * ⛓⛓⛓ SEGMENT 0 IS `r8-solve-18`, **PROMOTED AND NOT RE-AUTHORED** (⚖ R8
     * close option A, user 2026-08-11; R9 slice 3). R8's version of this
     * comment said *"L18 IS NOT IN THIS CHAIN … a room that refuses is
     * REPORTED, never recorded"*, and it was true when written: slice 7 built
     * L18's strike schedule, drove it, and reported the room. Slice 8 then
     * found the wall was its OWN INGREDIENT — the conservative hammer disc
     * (trap 171), the 40-candidate scan bound it was hiding, and a kill lock
     * with no writer — and the room solved. So the artifact existed, already
     * recorded and byte-exact, before this chain wanted it. Duplicating it as
     * an `r8-d2-18` would author a second tape with the same boot, the same
     * goal list and the same walk; editing its `description` to SAY "segment
     * 0" would spend a re-record licence on a word. ⇒ what changed is its
     * RELATION, and a relation lives HERE.
     *
     * ⛓⛓ ONE `clears` PROVENANCE ROW, and it arrived WITH the splice.
     * `r8-solve-18` declares a timed v9 `{18,0}` at tick 393 — L18's
     * `lock@144,112` is `tset -1`, so nothing but `Game.totalEnemies()`
     * reaching zero opens it, and `createLevelRun` takes `persistence` AT
     * CONSTRUCTION — and the re-derived headline, authored by the same
     * `twoPassSolve` loop over all three goal lists, computes the SAME tick.
     * `stagedClearFindings` demands provenance for both, two-sidedly.
     *
     * ⚠ EVERY OTHER FLAG THESE WALKS WRITE IS **EARNED**, not declared, and
     * needs no provenance because the run computes it end to end: `{19,0}` the
     * boss, `{20,2}` the shield, `{20,0}` the shieldlock, `{20,4}` the
     * buttonroom. `{20,1}`, the lock's own, is BANKED for the next build of
     * L20 rather than earned — `Lock.turnOff()`'s write is a permission about
     * the run (§15.3.2) — and the walk leaves the room before there is one.
     */
    Object.freeze({
        id: 'r8-d2',
        kind: 'staged',
        why: 'R8 slice 7 + R9 slice 3: D2\'s last THREE rooms, driven by the live '
            + 'solver from the campaign\'s own post-sword latch staged at L18\'s '
            + 'arrival from L16. Segment 0 is the honest L18 (`r8-solve-18`, PROMOTED '
            + 'not re-authored) — the kill-lock room crossed with `noDamage` retired, '
            + 'zero hits and zero spinner contacts. Segment 1 fights the ShieldBoss on '
            + 'a schedule DERIVED from '
            + '`shieldBossWindowFor`, takes the boss key and opens `bosslock@48,32` with '
            + 'the `keylock` verb; segment 2 takes the shield and crosses WESTWARD '
            + 'through `shieldlocknorm` (the `touch` verb, registered at last) -> '
            + '`buttonroom` -> `lock@32,80` -> the alcove -> L13.',
        headline: 'r8-d2',
        segments: Object.freeze(['r8-solve-18', 'r8-d2-19', 'r8-d2-20']),
        earns: Object.freeze([]),
        clears: Object.freeze([Object.freeze({
            level: 18, tag: 0, source: 'model',
            evidence: Object.freeze({
                removedAt: 292,
                fade: 101,
                why: '`spinnerKillLockOpens`\'s removal (the second Spinner body leaves '
                    + 'and `Game.totalEnemies()` reaches zero) plus '
                    + '`activators.opensOnTick(0.01)`, the `Lock`\'s own fade — the same '
                    + 'number `solve-seedling-r8-l18.mjs` computed for the standalone '
                    + 'tape and the re-derived headline computes again',
            }),
        })]),
    }),
    /**
     * ⛓⛓⛓ R9 SLICE 6 — **THE TRUE-START SOLVER CHAIN**, ⚖ ruling 11 (user,
     * 2026-08-20): *"a sequence of tapes to play back our solutions from the
     * beginning of the game … recorded from the solver, not constructed
     * manually."*
     *
     * SIXTEEN SEGMENTS in sphere order, from `new Game(0,80,128)` with an empty
     * save to the L15 arrival, and it is the roster's SECOND CUSTODY CHAIN and
     * the FIRST one whose every segment is solver-authored. Every boot after
     * the first is its predecessor's MEASURED LATCH — `botSeam()` at a
     * `Game.begin()` entry, turned into blocks by `segmentBootFromLatch` — so
     * `boot(k+1) == latch(k)` is an equality the GAME produced over all 46
     * signature rows rather than a declaration anybody wrote.
     *
     * ⛔ WHAT IT REPLACED, AND WHY. `act2-the-sword` walks the same eleven
     * rooms by HAND, and the census (R9 §13.3) measured that its solver
     * counterparts stopped continuing at `r8-solve-5`: every successor from
     * there declared a latch measured after a walk of a different length. The
     * fix is a re-record from the measured latch, room by room — and the
     * numbers COMPOUND, which is why `r8-solve-6`'s clock moved 346 rather than
     * the census's pairwise 254.
     *
     * ⛔ IT STOPS AT L15 ON PURPOSE. A chain that walked past a refusal would be
     * claiming a room nobody solved, so its tail is always the last route step
     * the survey SOLVES — and the first one it refuses IS the next work order.
     * ⛓ R9 slice 12b″ moved that stop by one room: step 16 (L14's camera band)
     * was the frontier for four slices, slice 12b′ solved it at 145 ticks and
     * `r9-solve-14` records it, so the refusal in front of the chain is now
     * step 17 — L15's `'shove'` strategy, registered and not applying.
     *
     * ⛓ `r9-solve-11` IS NOT `r8-solve-11`. Both take `chest@L11`; the battery's
     * returns to L10 (its goals come from `act2-the-sword`'s own units) and this
     * one leaves by `teleporter@32,0` to L3, which is the ROUTE's step 11.
     */
    Object.freeze({
        id: CAMPAIGN_CHAIN_ID,
        why: '⛓⛓⛓ R9 slice 6 — the TRUE-START SOLVER CHAIN: every room of Seedling\'s '
            + 'sphere order from the game\'s own boot to the L15 arrival, each segment '
            + 'booting its predecessor\'s MEASURED latch, each walk derived by the live '
            + 'solver from goals read out of the atlas. ⚖ Ruling 11. It is the first '
            + 'chain to CREDIT the goal ledger from solver tapes.',
        /**
         * ⛔ NO `headline` — ⚖ ruling 37, R9 slice 12d. The chain's ID is still
         * `r9-campaign` and `?tapes=r9-campaign` still expands to the segments;
         * what is gone is the 3615-tick concatenated TAPE that used to share
         * the name.
         */
        /**
         * ⛔ DERIVED FROM `campaignChain.js` (⚖ ruling 38 (1)). This used to be
         * sixteen typed names, and 12b″ could only assert that it and the
         * producer's copy AGREED (§23c.7a) — the row an unremovable duplicate
         * earns. There is no duplicate now, so there is no row.
         */
        segments: CAMPAIGN_SEGMENT_NAMES,
        /**
         * ⛓⛓⛓ THE FIRST GOAL-LEDGER ROWS A SOLVER CHAIN CREDITS. `R7_GOAL_LEDGER`
         * has 41 rows and exactly two of them live in this chain's twelve rooms
         * {0,2,3,4,5,6,7,8,9,10,11,13}; `chainGoalFindings` MEASURES both by
         * asking whether the flag went NOT-HELD to HELD between a segment's own
         * boot and its own latch, which a declaration cannot fake.
         */
        earns: Object.freeze(['sword@L10', 'chest@L11']),
        /**
         * ⛓⛓ THE TIMED CLEARS, WITH THE INSTRUMENT THAT MEASURED EACH — THREE
         * ROWS FOR THREE CLEARS, one per `{level,tag}@at` a SEGMENT declares.
         *
         * ⛔⛔ IT WAS SIX UNTIL ⚖ RULING 37 (R9 slice 12d), AND THE THREE THAT
         * WENT ARE EXACTLY THE THREE WHOSE ONLY WITNESS WAS THE HEADLINE:
         * `stagedClearFindings` keys provenance on `{level,tag}@at`, and a tape
         * that walked every room in ONE run declared the same clear at a
         * different tick from the segment that owns it — so L5's `{5,0}` had a
         * second `model` row at 1157 and L8's two had `transported` rows at
         * 1974 and 2373. With that tape gone no tape declares those ticks, and
         * half 2 of the law ("every provenance row has a tape clear") would red
         * on them BY NAME. ⛓ Nothing was lost: every surviving row's own
         * evidence — `removedAt`+`fade`, `carriesAt`/`absentAt` — is the
         * ORIGINAL measurement, and the segment that owns it still declares it.
         */
        clears: Object.freeze([
            Object.freeze({
                level: 5, tag: 0, source: 'model',
                evidence: Object.freeze({
                    removedAt: 326,
                    fade: 101,
                    why: '`chaserKillLockOpens`\'s removal (the third bob dies to the '
                        + 'ceiling and `Game.totalEnemies()` reaches zero) plus '
                        + '`activators.opensOnTick(RESPONDERS.lock.fade)`',
                }),
            }),
            Object.freeze({
                level: 8, tag: 0, source: 'game',
                evidence: Object.freeze({
                    carriesAt: 246,
                    absentAt: 245,
                    why: 'the GAME\'s own `persistence_cleared`, by truncation — §11.4 '
                        + 'REFUSES to compute a static `"Enemy"` body\'s arrow death, so '
                        + 'the model may not substitute here',
                }),
            }),
            Object.freeze({
                level: 8, tag: 1, source: 'game',
                evidence: Object.freeze({
                    carriesAt: 645,
                    absentAt: 644,
                    why: 'the second `SandTrap`, the same instrument — a boundary '
                        + 'measured on both sides rather than a poll',
                }),
            }),
        ]),
        /**
         * ⛔ THE CUTS ARE THE HEADLINE'S OWN ARRIVALS, printed by
         * `solve-seedling-r9-campaign.mjs` rather than typed here — the
         * ends-meet arithmetic is what makes a CUT a measurement.
         */
    }),
]);

/**
 * ⛓⛓⛓ R9 SLICE 11b — **THE CHAIN'S TICKS ARE READ OFF ITS TAPES, NEVER
 * TYPED.** ⚖ Ruling 32 D, ⚖ ruling 17.
 *
 * ── ⛔⛔ WHAT WENT WRONG WHEN THEY WERE TYPED — trap 556 ───────────────
 *
 * `cuts`, `endsAt` and a clear's `at` are ARITHMETIC over the segment tapes,
 * and until this slice all three were hand-written here. R9 slice 3 moved
 * `r8-solve-4` from 253 ticks to 255 and left `r8-battery-4`'s `endsAt` at
 * 253, so `chainSpans` sliced the wrong window for four slices — silently
 * (§14.11). R9 slice 11 re-recorded `r8-solve-18` and four roster rows went
 * red on constants describing the OLD walk, three of them complaining from
 * both sides at once (§21.6). Neither was a bug in the arithmetic; both were
 * a constant outliving the measurement it summarised.
 *
 * ⇒ the declaration keeps what a human DECIDES — `segments`, `headline`,
 * `kind`, `earns`, `why`, the `walk`, and each clear's `source` and
 * `evidence` (the MEASUREMENTS: `removedAt`, `fade`, `carriesAt`,
 * `absentAt`, `measuredAt`) — and everything that is a SUM is computed here,
 * at load, from the tapes on disk:
 *
 *   `cuts`     the running total of the segments' own `tick_count`s
 *   `endsAt`   that total, all segments in
 *   `at`       `removedAt + fade` (model) · `carriesAt` (game) ·
 *              `measuredAt + offset` (transported)
 *   `offset`   the transported row's own rebase — the span start of the
 *              segment its `evidence.from` names, which IS a cut. Leaving it
 *              typed would have kept exactly one constant that a re-record
 *              decays, in the row whose whole purpose is to travel.
 *
 * ⛓ WHAT THIS TURNS THE ENDS-MEET ROWS INTO, said plainly. `endsAt === sum`
 * is now true by construction inside one process; the claim that still has
 * content is `sum === headline.tick_count` — the SEGMENTS agree with the
 * HEADLINE, which is a statement about two different recordings and is what
 * ENDS-MEET always meant. `chainFindings`' arithmetic row asserts exactly
 * that, and `playthroughAcceptance.test.js` asserts it roster-wide where CI
 * can see it. Likewise `stagedClearFindings`' half-3 arithmetic no longer
 * discriminates the TICK (it defines it) and still discriminates the
 * evidence's COMPLETENESS — `absentAt === at - 1`, a finite `measuredAt`, a
 * named `from`; the tick's own check is halves 1 and 2, which match the
 * derived `at` against what a TAPE declares. That is a stronger check than
 * the one it replaces, because a tape cannot be edited from here.
 *
 * ⚠ COST: 25 tapes, measured at 40 ms once per process. `loadTape` is the
 * same reader every consumer uses, so there is no second parse of the truth.
 */
const TICK_COUNTS = new Map();

/** One segment's own length, from the committed tape. */
function segmentTicks(name) {
    if (!TICK_COUNTS.has(name)) TICK_COUNTS.set(name, loadTape(name).tick_count);
    return TICK_COUNTS.get(name);
}

/**
 * A clear's tick, from the parts its `evidence` already carries.
 *
 * An unknown `source` returns `undefined` rather than a guess —
 * `stagedClearFindings` names it as "not a tick source" and lists the three
 * that are, which is a better answer than a number nobody can defend.
 */
function derivedClear(clear, startOf) {
    const e = clear.evidence ?? {};
    const row = (at, evidence) => Object.freeze({
        level: clear.level, tag: clear.tag, at, source: clear.source, evidence,
    });
    if (clear.source === 'model') return row(e.removedAt + e.fade, e);
    if (clear.source === 'game') return row(e.carriesAt, e);
    if (clear.source === 'transported') {
        const offset = startOf(e.from);
        return row(offset === undefined ? undefined : e.measuredAt + offset,
            Object.freeze({
                from: e.from, measuredAt: e.measuredAt, offset, why: e.why,
            }));
    }
    return row(undefined, e);
}

/** One declaration plus the numbers its own tapes imply. */
function withDerivedTicks(entry) {
    const counts = entry.segments.map(segmentTicks);
    const cuts = [];
    let run = 0;
    for (let i = 0; i < counts.length - 1; i += 1) {
        run += counts[i];
        cuts.push(run);
    }
    const endsAt = counts.reduce((n, c) => n + c, 0);
    const startOf = (name) => {
        const i = entry.segments.indexOf(name);
        return i < 0 ? undefined : counts.slice(0, i).reduce((n, c) => n + c, 0);
    };
    return Object.freeze({
        ...entry,
        clears: Object.freeze((entry.clears ?? []).map((c) => derivedClear(c, startOf))),
        cuts: Object.freeze(cuts),
        endsAt,
    });
}

/**
 * ⛔ THE CHAINS AS CONSUMERS SEE THEM — every declaration above, with its
 * ticks derived. Nothing else reads `CHAIN_DECLARATIONS`.
 */
export const PLAYTHROUGH_CHAINS = Object.freeze(CHAIN_DECLARATIONS.map(withDerivedTicks));

/**
 * A chain's segment boundaries as `[from, to)` spans. `[0, cut0)`,
 * `[cut0, cut1)`, … `[cutN, endsAt)`.
 *
 * ⚠ DERIVED FROM `cuts` AND `endsAt`, never listed. The tick counts a
 * planner writes into the tapes come from here, which is why the ENDS-MEET
 * arithmetic (`sum(tick_count) === headline.tick_count`) is a check on the
 * RECORDING rather than a restatement of the plan.
 */
export function chainSpans(chain) {
    const bounds = [0, ...chain.cuts, chain.endsAt];
    return bounds.slice(0, -1).map((from, i) => ({ from, to: bounds[i + 1] }));
}

/**
 * The input spans a `[from, to)` window sees, shifted to start at 0.
 *
 * ⚠ Spans are HALF-OPEN (`tapeFormat`: "spans are [from, to)"), so a hold
 * that is live at the cut tick stays live in BOTH the window that ends
 * there and the window that starts there — which is what makes the boundary
 * tick observable twice with the same input state.
 */
export function chainInputsFor(inputs, from, to) {
    return inputs
        .map((s) => ({ key: s.key, from: Math.max(s.from, from), to: Math.min(s.to, to) }))
        .filter((s) => s.to > s.from)
        .map((s) => ({ key: s.key, from: s.from - from, to: s.to - from }));
}

/**
 * ⛓ THE UNITS, GROUPED FOR THE PLANNER: a run of consecutive `leg`s is ONE
 * `synthesizeLegs` call, and a `phases` block is a group of its own.
 *
 * ⛔ CONSECUTIVE LEGS MUST STAY IN ONE CALL. `synthesizeLegs` carries a live
 * `createLevelRun` across its legs — the crossing, the arrival fade, the
 * per-visit geometry of the room it lands in — so splitting a leg run into
 * two calls would re-boot the second half at a declared position and lose
 * every one of those. Splitting is only forced where a `phases` block sits,
 * because that is precisely where the model cannot follow.
 */
export function walkGroups(chain) {
    const groups = [];
    for (const unit of chain.walk?.units ?? []) {
        if (unit.phases) { groups.push({ kind: 'phases', block: unit.phases }); continue; }
        const last = groups[groups.length - 1];
        if (last && last.kind === 'legs') last.legs.push(unit.leg);
        else groups.push({ kind: 'legs', legs: [unit.leg] });
    }
    return groups;
}

/** Every segment tape name in every chain, in chain order. */
export function playthroughSegmentNames() {
    return PLAYTHROUGH_CHAINS.flatMap((c) => c.segments);
}

/**
 * ⛔ EVERY TAPE ONE CHAIN OWNS — its segments, plus its headline IF IT HAS ONE.
 *
 * ⛓⛓ R9 SLICE 12d, ⚖ RULING 37: `headline` is OPTIONAL now. The campaign chain
 * has none — it IS the sequence of its segment tapes, played in order — and a
 * `[...segments, chain.headline]` that appended `undefined` for it would send
 * every consumer looking for a fixture named "undefined". One spelling, here,
 * so the six call sites that walked a chain's tapes cannot each get it wrong
 * their own way.
 */
export function chainTapeNames(chain) {
    return chain.headline ? [...chain.segments, chain.headline] : [...chain.segments];
}

/** Every tape every chain owns — segments, and the headlines that still exist. */
export function playthroughTapeNames() {
    return PLAYTHROUGH_CHAINS.flatMap(chainTapeNames);
}

/**
 * ⛔⛔ THE PREDICATE THE SWEEP BRANCHES ON, and it is why `requireCalm` can
 * be true HERE and false for the roster.
 *
 * The 118 committed fixtures do not end at arrivals — that convention
 * arrives with the segments — so `verify-seedling-bot-differential.mjs`
 * runs `seamLatchFindings(..., {requireCalm: false})` on all of them and
 * reports the invariants without requiring them. A SEGMENT claims an
 * arrival by construction, so it is required, and this is the only thing
 * that tells the two apart.
 *
 * ⚠ IT IS A NAMED SET, WHICH MEANS IT CAN ONLY FAIL ONE WAY — by NOT
 * demanding calm of something that should be a segment. That is the safe
 * direction (`fixtures/tiers.js`'s rule, in its other form): a fixture
 * added tomorrow and forgotten here is checked less strictly, never
 * wrongly. `assertChainsWellFormed` closes the gap by asserting every name
 * is a real fixture, so a rename is a NAMED failure and not a silent
 * demotion.
 */
export function isPlaythroughSegment(name) {
    return playthroughSegmentNames().includes(name);
}

/**
 * ⛔ EVERY NAME IS A REAL FIXTURE, AND EVERY CHAIN IS ORDERED AND
 * NON-EMPTY. A chain naming a tape that does not exist checks nothing and
 * reads exactly like a chain that passes.
 *
 * ⚠ Called with the roster so a test can pass a synthetic one; defaults to
 * what is on disk, derived, never a stored count.
 */
export function assertChainsWellFormed(roster = fixtureNames()) {
    /** kind -> the segment names that kind has already claimed. */
    const seen = new Map();
    const kinds = {};
    for (const chain of PLAYTHROUGH_CHAINS) {
        // ⛓ R8 slice 0: the kind is resolved FIRST, because two of the
        // invariants below branch on it. `chainKind` refuses an unknown kind
        // by name rather than letting it fall through to whichever arm was
        // written last.
        const kind = chainKind(chain);
        const policy = CHAIN_KINDS[kind];
        kinds[kind] = (kinds[kind] ?? 0) + 1;
        if (chain.segments.length < policy.minSegments) {
            throw new PlaythroughError(
                `chain "${chain.id}" (kind ${kind}) has ${chain.segments.length} `
                + `segment(s) and its kind needs at least ${policy.minSegments}. `
                + (kind === 'custody'
                    ? 'A custody chain with fewer than two has no seam, and a seam is '
                        + 'the whole claim.'
                    : 'A staged chain may be a single segment — that is what '
                        + 'per-segment verification is — but it may not be empty.'));
        }
        if (chain.cuts.length !== chain.segments.length - 1) {
            throw new PlaythroughError(
                `chain "${chain.id}" declares ${chain.cuts.length} cut(s) for `
                + `${chain.segments.length} segments; a chain of N segments has exactly `
                + 'N-1 seams and the cut list IS the seam list');
        }
        for (const name of [...chain.segments, chain.headline, chain.freeOracle]) {
            if (name === undefined || name === null) continue;
            if (!roster.includes(name)) {
                throw new PlaythroughError(
                    `chain "${chain.id}" names "${name}", which is not a fixture. A `
                    + 'chain naming a tape that does not exist asserts nothing and '
                    + 'reports the same green as one that does.');
            }
        }
        /**
         * ⛓⛓⛓ R9 SLICE 6 — **UNIQUENESS IS PER KIND, WHICH IS WHAT THIS RULE'S
         * OWN SENTENCE ALWAYS SAID.**
         *
         * The message reads *"a segment belongs to exactly one CUSTODY chain"*
         * and the code compared across ALL of them. Nothing exercised the gap
         * until now, because the one custody chain on the roster
         * (`act2-the-sword`) walks `r7-act2-*` and the staged ones walk
         * `r8-solve-*`. The true-start solver chain walks `r8-solve-1..10`,
         * which the `r8-battery-N` chains ALSO name — and that is not
         * ambiguity, it is two different claims about one artifact:
         *
         *   `r8-battery-6`  STAGED   — "this tape replays from the boot it
         *                              DECLARES"; reports the ledger, credits
         *                              nothing (`CHAIN_KINDS.staged`).
         *   `r9-campaign`   CUSTODY  — "this tape's boot is its predecessor's
         *                              MEASURED LATCH"; credits the ledger.
         *
         * ⛔ WHAT WOULD BE AMBIGUOUS IS TWO CUSTODY CLAIMANTS, because custody
         * is what CREDITS `R7_GOAL_LEDGER` and two crediting chains would count
         * one earning twice. That is still refused, by kind. A second STAGED
         * claimant is refused too, for the symmetric reason: two per-segment
         * verifications of one tape are the same claim spelled twice.
         */
        const seenOfKind = seen.get(kind) ?? new Set();
        for (const name of chain.segments) {
            if (seenOfKind.has(name)) {
                throw new PlaythroughError(
                    `"${name}" appears in more than one ${kind} chain; a segment belongs `
                    + `to exactly one ${kind} chain or the chain claim is ambiguous`);
            }
            seenOfKind.add(name);
        }
        seen.set(kind, seenOfKind);
        // ⛔ The unit shapes are asserted HERE rather than at the planner,
        // because the planner runs on a developer's machine with a wasm
        // artifact staged and this runs on every CI sweep. A malformed
        // `phases` block that only the planner refuses is a block the tests
        // never look at.
        assertWalkUnits(chain);
    }
    // ⛔ THE PARTITION IS TOTAL AND IT IS ASSERTED, not counted by eye. Every
    // kind in the table gets a tally — including a ZERO one — so a kind
    // nobody uses is REPORTED rather than being indistinguishable from a kind
    // nobody implemented (trap 119's shape, one table over).
    const byKind = Object.fromEntries(
        Object.keys(CHAIN_KINDS).map((k) => [k, kinds[k] ?? 0]));
    return {
        chains: PLAYTHROUGH_CHAINS.length,
        segments: playthroughSegmentNames().length,
        seams: PLAYTHROUGH_CHAINS.reduce((n, c) => n + c.segments.length - 1, 0),
        byKind,
    };
}
