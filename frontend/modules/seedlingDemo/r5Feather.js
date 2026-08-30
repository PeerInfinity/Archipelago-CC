/**
 * seedlingDemo/r5Feather — R5 slice 5's first route: THE FEATHER.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §16.10 and §17.
 *
 * Same doctrine as `r5Swim.js` and `r5Chain.js`: the declared half of the
 * route lives here as data, `plan-seedling-r5-feather.mjs` CONFIRMS it
 * against the shipped geometry, and `r5Feather.test.js` asserts the
 * declarations against the extract. Nothing here is measured — every number
 * is an OEL coordinate, a transcription with its source named, or an
 * arithmetic consequence of one.
 *
 * ── THE DEBT THIS PAYS ────────────────────────────────────────────────
 *
 *   slice 4   the key → BobBoss → `fire` → Karlore's plug → D5 → the conch
 *             → `canSwim` → water ARMS; and `climbsArmedWaterfall` gets both
 *             arms on a PROBE grant
 *   HERE      the walk that EARNS the feather, so the probe grant's claim
 *             ("the feather does this") joins the walk's ("this walk took
 *             the feather")
 *
 * ── ⛔ AND §16.10's ROUTE IS RETIRED, WITH ITS REASONS ─────────────────
 *
 * §16.10 measured the feather unreachable and committed the numbers, which
 * is what made re-asking possible. `probe-seedling-r5-feather` re-asked at
 * the granularity `Mobile.moveX/moveY` use and found the measurement wrong
 * in TWO ways at once — a tile-centre lattice, and an `allowTeleporter`
 * argument passed an OBJECT where `plannerObstacleAt` wants an INDEX, so
 * the exemption never fired and the door's own volume counted as a wall.
 * See `FEATHER_ROUTE.supersedes`.
 *
 * What is TRUE of §16.10 and survives: the pocket has exactly two
 * approaches, both waterfall tiles, so the feather is reached only from
 * ABOVE. That is why this route goes the long way round.
 */

export class R5FeatherError extends Error {
    constructor(message) { super(message); this.name = 'R5FeatherError'; }
}
const fail = (m) => { throw new R5FeatherError(m); };

/**
 * `Pickups/Feather.as` — the item, and the two things it writes.
 *
 *     text = "You got the Penguin's Feather!~You can now swim up waterfalls.";
 *     override public function removed():void {
 *         if (doActions) { Player.hasFeather = true; Game.setPersistence(tag, false); }
 *     }
 *
 * So the ceremony is X-PAGED (two pages, one `~`), `hasFeather` is the
 * boolean, and `{89,0}` is the ledger entry — an EARNED clear, like every
 * real pickup on the ladder since R3.
 *
 * ⚠ ITS HITBOX IS 8x8, NOT A TILE. `setHitbox(8, 8, 4, 4)` on a body
 * constructed at `(_x + 8, _y + 8)`, so the volume is (164,100)-(172,108) —
 * which is what makes the collect approach a question about the PLAYER BOX
 * rather than about the tile, and why the probe's harvest test asks the
 * obstacle rather than the rect.
 */
export const FEATHER = Object.freeze({
    level: 89,
    pickup: Object.freeze({ x: 160, y: 96 }),
    /** Tile (10,6) — water, with a waterfall above it and below it. */
    tile: Object.freeze({ tx: 10, ty: 6 }),
    tag: 0,
    item: 'feather',
    property: 'hasFeather',
    /**
     * The approach cell — the WATERFALL directly above the pocket, tile
     * (10,5), at its own lattice-8 node centre.
     *
     * ⚠ NOT the pickup's tile and not a neighbour of it in any other
     * direction: east and west are solid at the tile centre, the tile below
     * is the other waterfall, and the planner's A* goal has to be a cell the
     * player box fits in. So the only approach is the one the geometry
     * always said it was — from ABOVE, descending.
     */
    approach: Object.freeze({ x: 172, y: 92 }),
});

/**
 * ⛔ THE TWO ROCKS, and they are the whole price of the feather.
 *
 * `probe-seedling-r5-feather`, at 8 px and at ONE PIXEL, which agree on
 * every row:
 *
 *     neither broken    14 cells / 602 positions    L91 door: NO
 *     only @176,48      14        / 602             NO
 *     only @256,112     92        / 4944            NO
 *     both broken      256        / 14165           YES
 *
 * ⚠ THE ORDER IS FORCED. The L87 door lands in a 14-cell pocket whose only
 * neighbour is `@256,112`; `@176,48` is not reachable until that one is
 * gone. So the walk breaks them east-to-west and the second stance only
 * exists because the first swing landed.
 *
 * Each entry carries the STANCE and the FACING the press needs, because a
 * press is not a position: the rect is 32x5 from the player and a diagonal
 * approach misses a rock the player is standing next to.
 */
export const L92_ROCKS = Object.freeze([
    Object.freeze({
        rock: Object.freeze({ x: 256, y: 112 }),
        stance: Object.freeze({ x: 284, y: 116 }),
        facing: 'W',
        why: 'the pocket\'s only neighbour. 14 cells before, 92 after.',
    }),
    Object.freeze({
        rock: Object.freeze({ x: 176, y: 48 }),
        stance: Object.freeze({ x: 204, y: 52 }),
        facing: 'W',
        why: 'reachable only once the first is broken. 92 cells before, 256 after — '
            + 'and the 256 is the first one that contains the L91 door.',
    }),
]);

/**
 * ⛔ WHERE THE LEDGER ENTRY LANDS, AND IT IS NOT IN L92.
 *
 * Both rocks are `tag = -1`. `BreakableRock.endAnim` calls
 * `Game.setPersistence(tag, false)` unconditionally, and
 * `Main.levelPersistenceSet(i, j)` writes `levelPersistence[i * 30 + j]` —
 * so from L92 that is index 2759, which is **L91 tag 29**, its last slot.
 * TWO writes, ONE flag, ONE ledger entry. The `Fire.removed()` precedent
 * ({31,29}, §15.6) in its second costume, and `breakableRocks.outOfBandFlagFor`
 * is the arithmetic both go through now.
 */
export const ROCK_OUT_OF_BAND_FLAG = Object.freeze({ level: 91, tag: 29 });

/**
 * ⛓ THE FEATHER WALK — four levels, two swings and a descent.
 *
 * L87 → L92 → L91 → L89, and every hop is a door §16.10 already
 * catalogued; what changed is which of them are OPEN.
 *
 * ── WHAT THE WALK HOLDS, AND WHY EACH ITEM IS THERE ───────────────────
 *
 *   sword    the two rocks. Earned at R1 (L10); a PROBE grant here, the
 *            `l71-shieldlock` precedent.
 *   conch    L89's row-4 pool and the feather's own tile are WATER. Earned
 *            at slice 4 (`r5-d5-conch`, 1,677 ticks); a probe grant here
 *            for the same reason `fire` was one on the D5 walk — so the
 *            tape is a walk rather than a walk behind two walks.
 *
 * ⚠ AND NEITHER GRANT NAMES A LEVEL WHOSE BUILD READS IT. `added()`-time
 * removal is modelled (`levelWorld.ADDED_TIME_REMOVAL`) and its only entry
 * is Karlore in L48, which this route does not enter. The grant names the
 * BOOT level because a boot grant lands after `new Game(87, ...)` — §15.8,
 * *a boot is not an entry* — and L87 holds no entity whose `added()` reads
 * an item.
 *
 * ── THE COERCION, AND WHAT IT IS FOR ──────────────────────────────────
 *
 * `noHazards: ["waterfall"]` — the R4 terminal state, unchanged. The walk
 * DESCENDS two waterfalls and a descent is legal armed, so the coercion is
 * not what makes the route possible; it is what makes the FLIP possible.
 * A retirement has to have something to retire (§3.4), and the window that
 * earns `hasFeather` is the one that gets to spend it.
 */
export const FEATHER_WALK = Object.freeze({
    name: 'r5-feather',
    /** L87 at the L44 arrival — `new Game(87, 448, 272)`, player at (456,280). */
    boot: Object.freeze({ level: 87, x: 448, y: 272 }),
    lattice: 8,
    nodeMargin: 0,
    allowGrazes: true,
    tolerance: 1.0,
    coastTicks: 32,
    /**
     * ⚠ THE DEFAULT 400 IS A GROUND NUMBER, and L87 is crossed by SWIMMING.
     *
     * `DEFAULT_MAX_TICKS_PER_TARGET` is generous for a walk at 0.8 px/tick;
     * the water speed table runs at 0.45 (`r5Swim.SWIM_LATCH`'s own
     * `steadyStep`), so a 200 px leg across L87's lake is over 440 ticks
     * before anything has gone wrong. Raised for the terrain, not for a
     * controller that is struggling — a stall in this route still fails by
     * name, it just gets to finish crossing the lake first.
     */
    maxTicksPerTarget: 1200,
    noHazards: Object.freeze(['waterfall']),
    pins: Object.freeze(['sound', 'dead_frames']),
    grants: Object.freeze([
        Object.freeze({ level: 87, items: Object.freeze(['sword', 'conch']) }),
    ]),
    legs: Object.freeze([
        Object.freeze({
            level: 87, targets: Object.freeze([]),
            exit: Object.freeze({ x: 16, y: 32 }),
        }),
        Object.freeze({
            level: 92,
            targets: Object.freeze(L92_ROCKS.map((r) => Object.freeze({
                x: r.stance.x,
                y: r.stance.y,
                spear: Object.freeze({
                    rock: Object.freeze({ ...r.rock }),
                    facing: r.facing,
                }),
            }))),
            exit: Object.freeze({ x: 32, y: 144 }),
        }),
        Object.freeze({
            level: 91, targets: Object.freeze([]),
            exit: Object.freeze({ x: 16, y: 144 }),
        }),
        Object.freeze({
            level: 89,
            targets: Object.freeze([
                // The descent, stated as waypoints rather than left to the
                // planner: the pool at row 4 is entered by falling down the
                // waterfall at (12,3), and the pocket by falling down (10,5).
                // Both are legal armed and neither is reversible without the
                // item the walk is here to collect.
                Object.freeze({ x: 200, y: 72 }),
                Object.freeze({ x: 168, y: 72 }),
                Object.freeze({
                    x: FEATHER.approach.x, y: FEATHER.approach.y,
                    collect: Object.freeze({ pickup: Object.freeze({ ...FEATHER.pickup }) }),
                }),
            ]),
        }),
    ]),
});

/**
 * The flags the feather walk EARNS — asserted as an exact set, both ways.
 *
 * ⚠ TWO LEDGERS, AND THEY ARE DIFFERENT ONES. A PICKUP's clear arrives
 * through `collected` (the ceremony fired, `removed()` ran); an OPENER's
 * arrives through `earnedClears` (a lock faded, a pole toggled, a rock
 * shattered). They meet in the game's single `persistence_cleared` readout,
 * so the declaration lists both and names which side each comes from —
 * folding them would make "which opener did this walk use" unanswerable
 * from the ledger, which is the reason `earnedClears` keeps its own loops
 * apart in the first place.
 */
export const FEATHER_EARNED = Object.freeze([
    Object.freeze({
        level: FEATHER.level, tag: FEATHER.tag, from: 'collected',
        by: '`Feather.removed()` — `Player.hasFeather = true; Game.setPersistence(tag, false)`',
    }),
    Object.freeze({
        level: ROCK_OUT_OF_BAND_FLAG.level, tag: ROCK_OUT_OF_BAND_FLAG.tag,
        from: 'earnedClears',
        by: '`BreakableRock.endAnim()` x2 in L92, both `tag = -1` — `setPersistence(-1, '
            + 'false)` resolves to `92 * 30 - 1`, which is L91\'s last slot. ONE entry '
            + 'for TWO writes.',
    }),
]);

/**
 * ⚠ THE ENCOUNTER LADDER'S VERDICT, EMITTED RATHER THAN IMPLIED (§13).
 *
 * Six crossings, and — unlike the D5 walk's one — the ladder RESOLVES NONE
 * OF THEM. Every one comes back `kill`, which on this ladder means
 * "undecided by over-approximation": the envelope (a chaser homing at
 * 0.8 px/tick from the wake tick, 160 px leash) closes on the path, and
 * over a 400-tick visit it closes by a lot.
 *
 * ⛔ SO THIS IS A DEFERRAL, AND IT IS NAMED AS ONE. What it is NOT is a
 * hazard to the stream: `Player.as:1372-1379` opens with
 * `if (Bot.noDamage) return`, which guards the sound, the shake, the
 * `hits`, the `die()` **and the knockback** — the whole damage path in one
 * place — so under this tape's `noDamage` a contact moves nothing and
 * plays nothing, which is why the model carries no enemies and the
 * recording still matches. R4's committed route is in exactly this state:
 * 17 wakes, 14 of them deferred.
 *
 * ⚠ WHAT IT COSTS IS A CLAIM. This walk is not evidence that the route is
 * contact-free, and the rung is where that is written down rather than in a
 * paragraph nobody re-reads. A later rung that retires `noDamage` has to
 * resolve all six — by killing (the walk carries a sword) or by re-routing
 * — and the arithmetic is per bob: `ENEMY_HITS_MAX` at 1 damage a press,
 * `KILL_PRESS_CADENCE` between presses that both land.
 */
export const FEATHER_LADDER = Object.freeze([
    Object.freeze({
        level: 92, tag: 'jellyfish', at: Object.freeze({ x: 120, y: 64 }), rung: 'kill',
        why: 'the longest visit on the route (the walk crosses L92 twice, once per rock), '
            + 'so the envelope has the most time to close. Deferred under `noDamage`.',
    }),
    Object.freeze({
        level: 92, tag: 'bob', at: Object.freeze({ x: 224, y: 112 }), rung: 'kill',
        why: 'inside the corridor the first rock opens. Deferred under `noDamage`.',
    }),
    Object.freeze({
        level: 91, tag: 'bob', at: Object.freeze({ x: 128, y: 64 }), rung: 'kill',
        why: 'one of L91\'s three-bob cluster, all of which the crossing passes. '
            + 'Deferred under `noDamage`.',
    }),
    Object.freeze({
        level: 91, tag: 'bob', at: Object.freeze({ x: 160, y: 96 }), rung: 'kill',
        why: 'the second of the cluster. Deferred under `noDamage`.',
    }),
    Object.freeze({
        level: 91, tag: 'bob', at: Object.freeze({ x: 192, y: 80 }), rung: 'kill',
        why: 'the third of the cluster, nearest the L92 arrival. Deferred under '
            + '`noDamage`.',
    }),
    Object.freeze({
        level: 91, tag: 'drill', at: Object.freeze({ x: 64, y: 80 }), rung: 'kill',
        why: 'a DRILL, whose envelope is not a chase at all — the -2000 px "clearance" is '
            + 'the over-approximation admitting it cannot bound the thing. It sits beside '
            + 'the L89 door the walk leaves through. Deferred under `noDamage`.',
    }),
]);

/**
 * The instances the route never comes near, named because silence is not a
 * verdict (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * ONE, out of seven — which is the other half of what makes the six above
 * a real finding rather than a pricer that priced everything.
 */
export const FEATHER_UNCROSSED = Object.freeze([
    Object.freeze({ level: 92, tag: 'spinner', at: Object.freeze({ x: 224, y: 64 }) }),
]);

/**
 * ⛓ THE FLIP WINDOW — `["waterfall"] -> []`, justified by `hasFeather`.
 *
 * The last untested piece of the crutch-schedule machinery. Slice 4's water
 * flip proved the mechanism with `canSwim`; this is the same shape one item
 * later, and it is the one the machinery was BUILT for — `hasFeather` is
 * the only item on the ladder whose coercion is a DIRECTED rule.
 *
 * ⚠ W1 IS NOT A DIFFERENTIAL FIXTURE, for §16.8's reason: a continuation
 * replayed on a fresh page boots wherever `Main.playerPosition` says, which
 * is not where W0 left the player. It is asserted live by the trace, as
 * `--boundary-witness`'s pair is.
 *
 * ⛓ AND W1 IS ALSO THE EARNED-CHAIN WITNESS. `r5-waterfall-climb` holds the
 * feather because a `grants` line said so; this window holds it because the
 * previous window walked four levels and picked it up. The probe-grant
 * fixtures stay — they are the controlled pair — and this is what joins
 * them to the walk.
 */
export const FEATHER_FLIP = Object.freeze({
    window: 'r5-feather-climb',
    level: 89,
    noHazards: Object.freeze([]),
    justifiedBy: 'hasFeather',
    /** The tile the climb crosses: the waterfall directly above the pocket. */
    tile: Object.freeze({ tx: 10, ty: 5 }),
    /** Held UP for this many ticks after the boundary. */
    holdTicks: 120,
    /**
     * ⛔ THE CLAIM IS THE CROSSING, NOT THE DISTANCE — and the first
     * authoring of this constant got that wrong in a way worth keeping.
     *
     * It declared `minRise: 32`, two tiles, and the live window rose
     * **31.70 px** — which is not a near miss, it is the CAP. The column
     * above the pocket is pocket (10,6) → waterfall (10,5) → pool (10,4)
     * → a TREE at (10,3), so a climb out of this pocket cannot be more
     * than two tiles less the player's own sub-tile offset no matter what
     * it holds. A floor of 32 was a floor nothing could clear.
     *
     * ⚠ AND THE PIXEL COUNT IS NOT THE DISCRIMINATOR ANYWAY.
     * `r5-waterfall-shut` stalls 24.35 px up on L0's face, which is a
     * DIFFERENT ROOM with two rows of water under the waterfall — so
     * "31.70 > 24.35" compares two geometries and settles nothing
     * (`feedback_same_rate_pair_cannot_answer`, one shape over). What the
     * refusing arm can never do is END ABOVE THE ROW IT STALLS IN, and
     * that is the claim: the player starts in (10,6), crosses (10,5)
     * entirely, and finishes in the pool at (10,4).
     */
    crossing: Object.freeze({
        from: Object.freeze({ tx: 10, ty: 6 }),
        over: Object.freeze({ tx: 10, ty: 5 }),
        to: Object.freeze({ tx: 10, ty: 4 }),
        cappedBy: 'the tree at (10,3), which is why the rise cannot exceed two tiles',
    }),
    /** A sanity floor under the crossing, not the claim itself. */
    minRise: 24,
});

/**
 * What this route REPLACES, named, so the retirement is legible from the
 * data rather than only from a commit message.
 */
export const SUPERSEDES = Object.freeze({
    section: '§16.10',
    constant: 'r5Swim.FEATHER_BLOCKER',
    reasons: Object.freeze([
        'a TILE-CENTRE lattice, which cannot see the half-tiles a `CliffSide` pixelmask '
        + 'leaves free (`feedback_reachability_needs_the_movement_granularity`)',
        '`plannerObstacleAt`\'s third argument is an INDEX into `level.teleporters` and '
        + 'the measurement passed the teleporter OBJECT, so the exemption its own '
        + 'comment claims never fired and the L92 door\'s volume counted as a wall',
    ]),
    survives: 'the pocket has exactly two approaches and both are waterfall tiles, so the '
        + 'feather is reached only from ABOVE — which is why this route goes the long way',
});

/**
 * Assert a walk's declared legs against a world source.
 *
 * Lives here rather than in the planner so `r5Feather.test.js` can drive it
 * without a planner run: the planner's job is the SYNTHESIS, and a
 * declaration that names a door the extract does not have should fail in
 * milliseconds.
 *
 * @param {Function} worldFor  `(level) => levelWorld`
 */
export function assertWalkDoors(worldFor) {
    if (typeof worldFor !== 'function') fail('assertWalkDoors needs a worldFor');
    const seen = [];
    FEATHER_WALK.legs.forEach((leg, i) => {
        const world = worldFor(leg.level);
        const next = FEATHER_WALK.legs[i + 1] ?? null;
        if (!leg.exit) {
            if (next) fail(`legs[${i}] (L${leg.level}) has no exit but is not the last`);
            return;
        }
        const tel = world.teleporters.find((t) => t.x === leg.exit.x && t.y === leg.exit.y);
        if (!tel) {
            fail(`L${leg.level} has no teleporter at (${leg.exit.x},${leg.exit.y}); it has `
                + `[${world.teleporters.map((t) => `${t.x},${t.y}->L${t.to}`).join(' ')}]`);
        }
        if (next && tel.to !== next.level) {
            fail(`L${leg.level}'s door at (${leg.exit.x},${leg.exit.y}) goes to L${tel.to}, `
                + `and the next leg is L${next.level}`);
        }
        seen.push({ from: leg.level, to: tel.to, arrival: { ...tel.arrival } });
    });
    return seen;
}
