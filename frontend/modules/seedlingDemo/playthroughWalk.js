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

import { fixtureNames } from './fixtures/index.js';

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
 * ⛔ THE CHAINS, ORDERED. One entry per chain; each names its headline and
 * its segments IN ORDER.
 *
 * `headline` is the same walk driven in ONE run. It is not decoration: the
 * concatenation identity is asserted against it, so a chain without one can
 * prove its seams and cannot prove it is the same walk.
 *
 * `freeOracle` names a COMMITTED, FROZEN fixture whose observation stream
 * the headline should reproduce. `transition-west-return` has been in the
 * roster since R1 and is byte-frozen; the toy headline is the same inputs
 * with `pins: ["dead_frames"]` added, so if the two streams agree, the pin
 * is observation-inert and the chain costs the roster nothing to believe.
 * If they DISAGREE that is a finding about the pin, reported by name — not
 * a failure of the chain.
 */
export const PLAYTHROUGH_CHAINS = Object.freeze([
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
        cuts: Object.freeze([61]),
        endsAt: 109,
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
    Object.freeze({
        id: 'act2-to-l7',
        why: '⛓⛓⛓ ACT 2, AND THE FIRST HONEST SEGMENTS. The game\'s own opening, '
            + 'from `new Game(0, 80, 128)` with an empty save and nothing granted, cut '
            + 'at every level arrival: L0 -> L2 -> L3 -> L4 -> L5 -> L6 -> L7. Segment 5 is '
            + 'the first HETEROGENEOUS walk — L5\'s arrow-bait fight as a `phases` '
            + 'block, then the crossing through the kill-lock it opens as a `leg` — so '
            + 'the chain now reaches PAST the wall the sword sits behind. ⛔ THE FIGHT '
            + 'AND THE CROSSING ARE ONE SEGMENT, and slice 6d measured why they must '
            + 'be: leaving the room to cut a boundary RESPAWNS every enemy in it while '
            + 'the clear stays durable, so the fight does not survive the door. The '
            + 'lock the fight removes is carried to the model by the v9 `at` clear. '
            + '⛓ SEGMENT 6 IS THE SAME SHAPE WITH THE OTHER MODEL-ONLY FIELD: L6 has no '
            + 'crossing at all while its two bobs stand in the two detour cells, and the '
            + 'ROOM removes one of them — a stance in row 1 column 3 sends `bob@112,48` '
            + 'across the water to drown, while `sandtrap@64,16` walls the other one off '
            + '(`Bob.solids` contains "Enemy"; the player\'s does not). The tape carries '
            + 'that as a v10 `despawn`.',
        headline: 'r7-act2-full',
        segments: Object.freeze([
            'r7-act2-1', 'r7-act2-2', 'r7-act2-3', 'r7-act2-4', 'r7-act2-5', 'r7-act2-6',
        ]),
        /**
         * ⛔ THE CUTS ARE THE DRIVER'S OWN TRANSITION TICKS, DECLARED HERE
         * AND ASSERTED THERE.
         *
         * `plan-seedling-r7-act2.mjs` synthesizes the walk from `legs` below
         * and refuses to author anything unless `transitions` reports exactly
         * these ticks and `tick_count` is exactly `endsAt`. So the numbers are
         * a CLAIM about the route that the planner checks, rather than a
         * transcription of what it happened to produce — a route that shifts
         * by one tick under a physics edit is a named failure, not a silently
         * re-cut chain.
         */
        /**
         * ⚠ EVERY CUT IS A TRANSITION, BUT NOT EVERY TRANSITION IS A CUT.
         * Today the two lists happen to be equal because every segment here
         * is one room long; the planner checks the cuts as an ORDERED
         * SUBSEQUENCE of the driver's transitions and NAMES the extras, so a
         * segment that crosses twice inside itself is describable rather than
         * a refusal. (Slice 6d needed exactly that for a candidate segment
         * that stepped out to L4 and back — see `L5_ARROW_BAIT`.)
         */
        cuts: Object.freeze([183, 230, 475, 822, 1634]),
        endsAt: 1989,
        /**
         * ⛓ THE WALK IS LEGS, NOT SPANS, and that is the M1 generator's shape
         * arriving where §3.6 said it would.
         *
         * The toy chain could carry its inputs literally because they were
         * `transition-west-return`'s, unchanged since R1. This one cannot:
         * 41 spans, three of which are a 200-tick button hold and a 39-tick
         * LEAN on a pushable block, all of them positioned by A* against live
         * per-visit geometry. Typing them would be transcribing a
         * measurement; deriving them is what makes `--check` meaningful.
         *
         * ── ⛔⛔ THE L4 TARGETS ARE THE WHOLE OF SLICE 6c ─────────────────
         *
         * L4's tile layer walls column 2 at every row but (2,4), where
         * `pushableblock@32,64` stands — **the block IS the door** — and
         * slice 6b's chain stopped there with the planner calling the room
         * two components. The room's answer, in its own vocabulary:
         *
         *   hold   `button@16,64 {tset 0}` arms `arrowtrap@48,16` and
         *          `arrowtrap@64,16`. `bob@64,64` chases the player, presses
         *          against the block's east face in column 3 — which is
         *          `arrowtrap@48,16`'s own lane — and takes one damage per
         *          landed arrow through 30-tick i-frames. MEASURED at
         *          `hits 0 -> 1 -> 2 -> 3`, gone by t~158 of the tape
         *          (`probe-seedling-r7-l4-block.mjs`).
         *   shove  then the lean: the block glides (2,4) -> (4,4) and the
         *          walk goes north up column 3 to `stairsdown@64,16`.
         *
         * ⚠ THE HOLD IS 200 AND THE KILL LANDS AT ~115 OF IT. The margin is
         * deliberate and it is the only number here the model cannot check:
         * `levelWorld` carries no enemies, so offline the shove succeeds with
         * a one-tick hold too. The probe's PAIR is what makes 200 evidence —
         * its control holds the button for ONE tick, and the game leaves the
         * block on (3,4) with the bob alive on `hits 1`.
         *
         * ⚠ AND THE BLOCK STOPS ON (4,4) BECAUSE (5,4) IS A PIT. A third
         * tile would destroy the block and open the corridor just as well,
         * and the player following it would stand in `bob@64,64`'s spawn —
         * which `levelRun` refuses on a tape that does not declare
         * `noDamage`. The route's two tiles are the game's arithmetic.
         */
        walk: Object.freeze({
            units: Object.freeze([
                Object.freeze({ leg: Object.freeze({ level: 0, targets: Object.freeze([]), exit: Object.freeze({ x: 256, y: 272 }) }) }),
                Object.freeze({ leg: Object.freeze({ level: 2, targets: Object.freeze([]), exit: Object.freeze({ x: 48, y: 96 }) }) }),
                Object.freeze({ leg: Object.freeze({ level: 3, targets: Object.freeze([]), exit: Object.freeze({ x: 128, y: 48 }) }) }),
                Object.freeze({
                    leg: Object.freeze({
                        level: 4,
                        targets: Object.freeze([
                            Object.freeze({
                                x: 24,
                                y: 72,
                                hold: Object.freeze({ presser: Object.freeze({ x: 16, y: 64 }), ticks: 200 }),
                            }),
                            Object.freeze({
                                x: 24,
                                y: 72,
                                shove: Object.freeze({
                                    block: Object.freeze({ x: 32, y: 64 }),
                                    dir: 'E',
                                    to: Object.freeze({ tx: 4, ty: 4 }),
                                }),
                            }),
                        ]),
                        exit: Object.freeze({ x: 64, y: 16 }),
                    }),
                }),
                /**
                 * ⚠ THE TERMINAL LEG OF THE FIRST GROUP, and it is why the
                 * L4 -> L5 crossing lands INSIDE segment 4 rather than at the
                 * top of segment 5. `synthesizeLegs` refuses an exit on its
                 * last leg ("the driver asserts a crossing against the NEXT
                 * leg's level"), so a legs group always ends one arrival past
                 * its last exit — which is exactly where a segment ends.
                 */
                Object.freeze({ leg: Object.freeze({ level: 5, targets: Object.freeze([]) }) }),
                /**
                 * ⛓⛓⛓ THE FIGHT — the first `phases` block in the arc. Its
                 * spans, its provenance, its earned clear and its outcome are
                 * `L5_ARROW_BAIT` above; nothing about it is planned here and
                 * nothing about it is predicted anywhere.
                 */
                Object.freeze({ phases: L5_ARROW_BAIT }),
                /**
                 * ⛓ AND THE CROSSING, PLANNED — against a level record with
                 * `{5,0}` cleared, because at tick 737 the game's own lock is
                 * gone. `contacts` declares the button the block left the
                 * player standing on; without it the leg's own FORCED-CONTACTS
                 * check would refuse the start it really has.
                 */
                Object.freeze({
                    leg: Object.freeze({
                        level: 5,
                        contacts: Object.freeze(['proximity-hazard:button@48,48']),
                        targets: Object.freeze([]),
                        exit: Object.freeze({ x: 48, y: 112 }),
                    }),
                }),
                Object.freeze({ leg: Object.freeze({ level: 6, targets: Object.freeze([]) }) }),
                /**
                 * ⛓⛓⛓ THE BAIT — the second `phases` block, and the first
                 * whose outcome is a BODY rather than a FLAG. Everything
                 * about it is `L6_BOB_DROWN` above.
                 */
                Object.freeze({ phases: L6_BOB_DROWN }),
                /**
                 * ⛓ AND THE CROSSING, PLANNED — against a level record with
                 * `bob@112,48` GONE, because at tick 120 of the block the
                 * game's own body is at the bottom of the water.
                 *
                 * ⚠ THE WAYPOINTS ARE THE WEAVE AND THEY ARE NOT DECORATION.
                 * A* ignores an enemy's avoid volume (it plans over walkable
                 * TILES), so a freehand plan walks row 1 straight into
                 * `sandtrap@64,16` and stalls. The five targets are the
                 * room's own answer: row 2 under the first sandtrap pair,
                 * down to row 3 for columns 6-8 (the detour the drowned body
                 * was standing in), back up to row 2 under the second pair,
                 * then east to the stairs.
                 *
                 * ⛔⛔ AND THE FIRST WAYPOINT (56,40) IS THE WHOLE MARGIN. It
                 * is straight DOWN from the stance and buys nothing in path
                 * length; without it A* leaves the stance DIAGONALLY and the
                 * player grazes `sandtrap@64,16` AND `sandtrap@64,48` on the
                 * way past column 4. Driven, that route DIED: two hits in the
                 * model, and the GAME added a third from `bob@96,16` — the
                 * live chaser the model has parked at its placement — for a
                 * silent death at t=198 whose only tell was a jump to the
                 * boot tile with no level change (trap 142). ⛓ THE GENERAL
                 * SHAPE: a route that can afford one hit in the MODEL cannot
                 * afford it in a room with a live mover, because the model's
                 * damage budget is the game's MINUS whatever the chaser adds.
                 * Descend first, then travel: zero hits, and 20 ticks SHORTER.
                 */
                Object.freeze({
                    leg: Object.freeze({
                        level: 6,
                        targets: Object.freeze([
                            Object.freeze({ x: 56, y: 40 }),
                            Object.freeze({ x: 88, y: 40 }),
                            Object.freeze({ x: 88, y: 56 }),
                            Object.freeze({ x: 152, y: 56 }),
                            Object.freeze({ x: 152, y: 40 }),
                            Object.freeze({ x: 216, y: 40 }),
                        ]),
                        exit: Object.freeze({ x: 224, y: 32 }),
                    }),
                }),
                Object.freeze({ leg: Object.freeze({ level: 7, targets: Object.freeze([]) }) }),
            ]),
            pins: Object.freeze(['dead_frames']),
            /**
             * ⚠ THE SAME DECLARED FP SEED AS THE TOY CHAIN, for the same
             * reason and not by inheritance: FlashPunk seeds its LCG once per
             * PAGE from one `Math.random()`, and a committed chain cannot
             * depend on a page's coincidence. The value is a state the LCG
             * really occupies, measured by slice 1's v8 probe.
             */
            fpSeed: 987286273,
        }),
    }),
]);

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

/** Every tape a chain owns — segments plus the headline. */
export function playthroughTapeNames() {
    return PLAYTHROUGH_CHAINS.flatMap((c) => [...c.segments, c.headline]);
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
    const seen = new Set();
    for (const chain of PLAYTHROUGH_CHAINS) {
        if (chain.segments.length < 2) {
            throw new PlaythroughError(
                `chain "${chain.id}" has ${chain.segments.length} segment(s); a chain `
                + 'with fewer than two has no seam, and a seam is the whole claim');
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
        for (const name of chain.segments) {
            if (seen.has(name)) {
                throw new PlaythroughError(
                    `"${name}" appears in more than one chain; a segment belongs to `
                    + 'exactly one custody chain or the chain claim is ambiguous');
            }
            seen.add(name);
        }
        // ⛔ The unit shapes are asserted HERE rather than at the planner,
        // because the planner runs on a developer's machine with a wasm
        // artifact staged and this runs on every CI sweep. A malformed
        // `phases` block that only the planner refuses is a block the tests
        // never look at.
        assertWalkUnits(chain);
    }
    return {
        chains: PLAYTHROUGH_CHAINS.length,
        segments: playthroughSegmentNames().length,
        seams: PLAYTHROUGH_CHAINS.reduce((n, c) => n + c.segments.length - 1, 0),
    };
}
