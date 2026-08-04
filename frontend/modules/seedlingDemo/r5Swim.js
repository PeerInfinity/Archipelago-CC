/**
 * seedlingDemo/r5Swim — R5 slice 5's route constants: THE WATER.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4 steps 4-5.
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §15.10, which is
 * the list of what slice 4 did NOT do and this module is the first half of
 * the answer to.
 *
 * Same doctrine as `r5Chain.js`: the declared half of the route lives here
 * as data, the planner scripts CONFIRM it against the shipped geometry, and
 * `r5Swim.test.js` asserts the declarations against the extract. Nothing
 * here is measured — every number is an OEL coordinate, a transcription
 * with its source named, or an arithmetic consequence of one.
 *
 * ── THE CHAIN THIS CONTINUES ──────────────────────────────────────────
 *
 *   slice 4   the key → BobBoss → `fire` → Karlore's plug vanishes
 *   HERE      D5 to the conch → `canSwim` → water ARMS → the feather →
 *             waterfall ARMS
 *
 * ── ⛔ THE ONE PIECE OF HARNESS POLICY THAT LIVES HERE ────────────────
 *
 * `DROWN_EXPECTED` (below) is not route data. It is the declaration that
 * makes an ARMED-WATER PAIR possible at all, and it lives beside the pair
 * it was written for rather than in the harness, for the same reason
 * `MODEL_EXEMPT` does: a declaration is evidence about a fixture, and
 * evidence about a fixture belongs with the fixture.
 */

export class R5SwimError extends Error {
    constructor(message) { super(message); this.name = 'R5SwimError'; }
}
const fail = (m) => { throw new R5SwimError(m); };

/** `Scenery/Tile.as` — the pitch every OEL coordinate is in. */
export const TILE = 16;

// ─────────────────────────────────────────────────────────────────────
// ⛔ THE DROWN DECLARATION — a NAMED expected violation, two-sided
// ─────────────────────────────────────────────────────────────────────

/**
 * ⛔ THE FIXTURES THAT ARE SUPPOSED TO DROWN, AND HOW MUCH.
 *
 * `verify-seedling-bot-differential` asserts `drownTimer === 0` on every
 * tape that reports one, and that assert is not a formality — it is the
 * POSITIVE CONTROL for the forbidden-floor policy. `Player.as:1426`'s timer
 * is never reset off-hazard (the only three writes in the class are
 * `= drownTimerMax` on the first contact tick, the decrement, and `drown()`'s
 * own spin), so a walk that declares a hazard armed and still reports 0 has,
 * in the game's own accounting, never once stood on an unprotected hazard
 * tile. Every tape through slice 4 reports 0 and must keep reporting 0.
 *
 * ⛓ AND THE ARMED-WATER WITNESS NEEDS EXACTLY ONE TAPE TO VIOLATE IT.
 * "Water is armed" is not proved by a swimmer: a swimmer with `canSwim`
 * takes `checkDrowning`'s early return and is indistinguishable from a walk
 * on coerced floor. The proof is the OTHER arm — the same tape with the
 * conch withheld — and what makes it evidence is precisely that the timer
 * moved. A control that reports 0 has not proved water is armed; it has
 * proved the tape never reached the water, or that `noHazards` still
 * carries it, and either way the pair proves nothing.
 *
 * ⚠ SO THE DECLARATION HARDENS, IT DOES NOT LOOSEN — the `MODEL_EXEMPT`
 * precedent, in its second costume. A declared fixture that reports
 * `drown_timer === 0` is a **RED**, with its own sentence: the thrash never
 * fired. An UNDECLARED fixture that reports non-zero is the hard failure it
 * has always been. Four cases, four different sentences, and the two
 * "everything is fine" arms are the only ones that pass.
 *
 * ⚠ BY NAME, never by predicate (`feedback_coincidental_predicate_rots`).
 * A predicate like "declares water armed" would sweep in the SWIM arm — the
 * one fixture whose whole claim is that it crossed armed water and the
 * timer never started.
 *
 * Each entry states:
 *   - `why`      the mechanic, and what the arm is evidence FOR
 *   - `minTicks` the fewest water ticks the arm must have stood for, as a
 *                LOWER bound on the contact rather than an exact timer
 *                value: `drownTimer` counts DOWN from
 *                `DROWN_TIMER_MAX` (10), so `timer = MAX - (contact - 1)`
 *                and asserting the timer directly would pin the recording's
 *                exact arrival tick into a policy table.
 *   - `maxTicks` the most it may have stood for. There is a hard ceiling
 *                here that is not a style preference: at eleven cumulative
 *                ticks `drowning` latches, `drown()` spins the player to
 *                `die()`, and the JS model THROWS rather than modelling a
 *                death. A declared arm is allowed to drown; it is not
 *                allowed to DIE, because a dead player's stream is a
 *                respawn and there is nothing left to compare.
 *
 * ⚠ AND AN ENTRY ARRIVES WITH ITS FIXTURE, never before it.
 * `drownDeclarationRosterFindings` refuses a declaration naming a tape the
 * repo does not have — so this table is empty until the arm that needs it
 * is recorded, and the guard is what makes that a rule rather than a habit.
 */
export const DROWN_EXPECTED = Object.freeze({
    // (empty until the drowning arm is recorded — see the note above)
});

/** The names, for a harness that wants the set rather than the table. */
export const DROWN_EXPECTED_NAMES = Object.freeze(Object.keys(DROWN_EXPECTED));

/** `Player.as:312` — `drownTimerMax`, restated here so the bounds can be read. */
export const DROWN_TIMER_MAX = 10;

// ─────────────────────────────────────────────────────────────────────
// STEP 3 — THE D5 WALK, and the conch at the end of it
// ─────────────────────────────────────────────────────────────────────

/**
 * `Pickups/Conch.as` — the item, and the two things it writes.
 *
 *     text = "You got the Conch!~Now you can swim in water!";
 *     override public function removed():void {
 *         if (doActions) { Player.canSwim = true; Game.setPersistence(tag, false); }
 *     }
 *
 * So the ceremony is X-PAGED (two pages), `canSwim` is the boolean, and
 * `{49,0}` is the ledger entry — an EARNED clear, like every real pickup on
 * the ladder since R3.
 */
export const CONCH = Object.freeze({
    level: 49,
    pickup: Object.freeze({ x: 32, y: 80 }),
    /** The approach cell — tile (2,4), one north of the pickup's own. */
    approach: Object.freeze({ x: 36, y: 76 }),
    tag: 0,
    item: 'conch',
    property: 'canSwim',
});

/**
 * ⛓ THE D5 WALK — and it is the CHAIN's first payment rather than a probe.
 *
 * L44 → 45 → 46 → 47 → 48 → (pit 11,3) → 49. R1 walked this same corridor
 * under noclip with all four hazards coerced and took its items by ENTERING
 * their rooms; this walk keeps the solids, keeps lava and ice ARMED, and
 * takes the conch with the R3 `collect` verb — the player standing on it and
 * paging its ceremony through.
 *
 * ⛔ AND IT CANNOT HAPPEN WITHOUT `fire`. L48's arrival is (120,296), tile
 * (7,18); `karlore@112,272` is tile (7,17), directly north of it, and it is
 * the one-tile corridor out. The headline pair measured that plug at 2
 * reachable tiles against 138. So `fire` is not decoration on this walk —
 * the walk is where the boolean is SPENT, and `ADDED_TIME_REMOVAL` is what
 * lets the model plan it at all.
 *
 * ⚠ THE GRANT IS A PROBE GRANT AND IT NAMES L44 — the `l71-shieldlock`
 * precedent again, one level along. `r5-bobboss-fire` is where `fire` is
 * EARNED; this tape banks it at the boot so that the walk can be recorded
 * on its own rather than behind a 2,500-tick boss fight. The grant names the
 * BOOT level because a boot grant lands after `new Game(44, ...)` — which is
 * fine here and would not be in L48 (§15.8, *a boot is not an entry*): L44
 * holds no entity whose `added()` reads an item, and the four doors between
 * L44 and L48 are four `new Game`s the item is banked long before.
 *
 * ── ⛔ TWO KNOBS THIS WALK HAD TO MOVE, AND BOTH ARE ICE ──────────────
 *
 * **1. `tolerance` is not a safety margin on ice — it is a SEED.**
 * `DEFAULT_TOLERANCE` is 1.0 px and its derivation is written down in
 * `botDriverV1`: a one-tick tap from rest travels 1.70 px before ground
 * friction (0.25) snaps the velocity to zero, so 0.85 is the tightest
 * always-achievable arrival and 1.0 clears it. Ice replaces BOTH terms —
 * `slidingSpeed` 1 and `slidingFriction` 0.025 — and the same tap travels
 * about 19.5 px. At 1.0 the drive to the conch's approach cell oscillates
 * and stalls 0.44 px away with the velocity still at 0.98.
 *
 * ⚠ And raising it is NOT monotone. Measured over this route:
 *
 *     1.0 ✗   1.25 ✓   1.5 ✗   1.75 ✗   2.0 ✓   2.1 ✓   2.2 ✓   2.25 ✓
 *     2.4 ✗   2.5 ✓    2.6 ✓   2.75 ✓   2.9 ✓   3.0 ✓   3.1 ✗   3.25 ✗
 *
 * — and the failures are at DIFFERENT waypoints in different levels (L48's
 * pit approach at 1.5/2.4/3.25, the conch's approach at 1.75/3.1, L44's
 * first corner at 10). A tolerance decides where the controller settles,
 * which decides the state the next drive starts from, which is a different
 * trajectory for the whole route. There is no band to sit in the middle of;
 * there are working points. **2.25 is one, chosen for the smallest tape
 * (1,645 ticks / 66 spans), and frozen.**
 *
 * **2. The 8-tick coast is 20x short.** `assertWindowEndsAtRest`'s default
 * is derived from ground friction too, and it is a STATIC check — it reads
 * the spans, not the physics. On ice the walk is still moving 12 ticks after
 * its last release, and the ceremony does not help: a `PICKUP_CEREMONY`
 * FREEZES the player without zeroing `v`, so the velocity the approach
 * carried in resumes the moment the dialogue ends. Measured: rest at 24
 * coast ticks, and the shipped 32 leaves margin.
 *
 * ⛓ **AND WHERE IT COMES TO REST IS A WATER TILE.** The residual southward
 * velocity slides the player off the conch's ice tile (2,5) into (2,6),
 * which is type 1, and it is water friction that finally stops them —
 * y = 96.01, box top 94. In THIS window water is coerced, so nothing
 * happens; in the next one it is armed and the conch is banked, so the walk
 * begins the swim leg already standing in it. That is a handoff rather than
 * an accident, and it is asserted rather than hoped for.
 */
export const D5_WALK = Object.freeze({
    name: 'r5-d5-conch',
    /** The L87 arrival — the door R1's route uses to reach L44. */
    boot: Object.freeze({ level: 44, x: 16, y: 80 }),
    lattice: 16,
    nodeMargin: 0,
    allowGrazes: true,
    /** See the docblock: a seed, not a margin. */
    tolerance: 2.25,
    /** See the docblock: ground's 8 is 20x short on ice; rest measured at 24. */
    coastTicks: 32,
    noHazards: Object.freeze(['water', 'waterfall']),
    pins: Object.freeze(['sound', 'dead_frames']),
    grants: Object.freeze([Object.freeze({ level: 44, items: Object.freeze(['fire']) })]),
    legs: Object.freeze([
        Object.freeze({ level: 44, targets: Object.freeze([]), exit: Object.freeze({ x: 64, y: 0 }) }),
        Object.freeze({ level: 45, targets: Object.freeze([]), exit: Object.freeze({ x: 112, y: 0 }) }),
        Object.freeze({ level: 46, targets: Object.freeze([]), exit: Object.freeze({ x: 176, y: 0 }) }),
        Object.freeze({ level: 47, targets: Object.freeze([]), exit: Object.freeze({ x: 216, y: 112 }) }),
        Object.freeze({ level: 48, targets: Object.freeze([]), exit: Object.freeze({ pit: Object.freeze({ tx: 11, ty: 3 }) }) }),
        Object.freeze({
            level: 49,
            targets: Object.freeze([Object.freeze({
                x: CONCH.approach.x,
                y: CONCH.approach.y,
                collect: Object.freeze({ pickup: Object.freeze({ ...CONCH.pickup }) }),
            })]),
        }),
    ]),
});

/** The flags the D5 walk EARNS — asserted as an exact set, both ways. */
export const D5_EARNED = Object.freeze([
    Object.freeze({
        level: CONCH.level, tag: CONCH.tag,
        by: '`Conch.removed()` — `Player.canSwim = true; Game.setPersistence(tag, false)`',
    }),
]);

/**
 * ⚠ THE ENCOUNTER LADDER'S VERDICT, EMITTED RATHER THAN IMPLIED (§13).
 *
 * Discs are pricing objects, not walls: the planner walks the ladder per
 * crossing and states what it decided, and the executor's job is only to
 * refuse an UNDECLARED wake. §2.6.2 priced this corridor at "one jellyfish
 * (L45), icetraps (static avoid), L46's whirlpool ~40 px off the trail,
 * L48's spinningaxe self-timed", and the route agrees with it in a stronger
 * form: **only ONE of the six instances is crossed at all.**
 */
export const D5_LADDER = Object.freeze([
    Object.freeze({
        level: 45, tag: 'jellyfish', at: Object.freeze({ x: 224, y: 176 }),
        rung: 'wake-and-thread',
        why: 'the only instance on the whole route the path crosses the disc of. The '
            + 'chase envelope — 0.8 px/tick from the wake, 160 px leash — never reaches '
            + 'the player: closest approach 104 px, and the visit ends long before it '
            + 'could close. Contact-free for ANY chase policy, not only the transcribed '
            + 'one, which is what makes it a THREAD rather than a bet.',
    }),
]);

/**
 * The instances the route never comes near, named because silence is not a
 * verdict (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * An encounter plan that reports one crossing over a six-instance corridor
 * has either threaded five of them or failed to look at five of them, and
 * those print the same thing.
 */
export const D5_UNCROSSED = Object.freeze([
    Object.freeze({ level: 45, tag: 'icetrap', at: Object.freeze({ x: 64, y: 64 }) }),
    Object.freeze({ level: 46, tag: 'icetrap', at: Object.freeze({ x: 256, y: 384 }) }),
    Object.freeze({ level: 46, tag: 'icetrap', at: Object.freeze({ x: 168, y: 328 }) }),
    Object.freeze({ level: 46, tag: 'whirlpool', at: Object.freeze({ x: 160, y: 144 }) }),
    Object.freeze({ level: 48, tag: 'spinningaxe', at: Object.freeze({ x: 208, y: 224 }) }),
]);

/**
 * ⚠ L48's `bosslock@48,144` is `keyType 3` and this walk holds NO key.
 *
 * §2.6.2 calls its probe row inert and it is — but "inert" is a claim about
 * the RUN, not about the geometry: `BossLock.update` sets `activate` when
 * `Player.hasKey(keyType)`, so the row is inert exactly as long as nothing
 * banks key 3. Asserted from `synthesizeLegs`' own `keys` list rather than
 * assumed, because a later rung's chain will hold key 3 and the same
 * sentence will stop being true without anything here changing.
 */
export const D5_INERT_LOCK = Object.freeze({
    level: 48, at: Object.freeze({ x: 48, y: 144 }), keyType: 3, tag: 1,
});

/**
 * The `drownTimer` finding for one fixture, TWO-SIDED.
 *
 * A pure function so `r5Swim.test.js` can drive all four quadrants and
 * assert each one's verdict in milliseconds — the `saw_input_refused`
 * shape, which is the precedent the brief names, and the reason this is not
 * an `if` inside a twenty-minute replay script.
 *
 * ⚠ `table` is injectable for exactly one reason: the shipped table is
 * empty until the arm that needs it is recorded, and a check whose declared
 * quadrants have never been driven is a check nobody has seen work.
 *
 * @param {string} name    the fixture
 * @param {number|undefined} drownTimer  `botStatus.drown_timer`
 * @param {object=} table  the declaration table; defaults to the shipped one
 * @returns {object|null} `{name, ok, detail}`, or null when the game
 *   reported no timer at all (a pre-R5 build), which is not this check's
 *   business to complain about.
 */
export function drownFinding(name, drownTimer, table = DROWN_EXPECTED) {
    if (drownTimer === undefined || drownTimer === null) return null;
    if (!Number.isFinite(drownTimer)) {
        return {
            name: `${name}: drown_timer is a number`,
            ok: false,
            detail: `the game reported ${JSON.stringify(drownTimer)} — a readout that is `
                + 'not a number cannot answer this check either way, and a check that '
                + 'cannot answer must not pass',
        };
    }
    const decl = table?.[name] ?? null;
    // The contact count the timer implies. `checkDrowning` sets the timer to
    // MAX on the first contact tick WITHOUT decrementing, then decrements on
    // every later one — so `contact = MAX - timer + 1` for a live countdown.
    const contact = drownTimer > 0 ? DROWN_TIMER_MAX - drownTimer + 1 : 0;

    if (!decl) {
        return {
            name: `${name}: the game never started drowning`,
            ok: drownTimer === 0,
            detail: drownTimer === 0
                ? 'drownTimer 0 — in the game\'s own accounting this walk never stood on '
                    + 'water without canSwim or lava without hasDarkSuit'
                : `drownTimer=${drownTimer} (≈${contact} contact tick(s)) — non-zero means `
                    + 'the player stood on water without canSwim or lava without '
                    + 'hasDarkSuit, and the timer never resets once touched (11 cumulative '
                    + 'ticks is the whole run budget). If this tape is SUPPOSED to drown, '
                    + `declare it in \`r5Swim.DROWN_EXPECTED\` by name — the declaration `
                    + 'is checked two-sidedly and is harder than this check, not softer.',
        };
    }
    // ⛔ THE DECLARED ARM, AND A ZERO HERE IS THE RED. A drowning control
    // that did not drown is the exact shape of a pair that proves nothing:
    // the tape never reached the water, or `noHazards` still carries it, or
    // the item it was supposed to lack was granted anyway.
    if (drownTimer === 0) {
        return {
            name: `${name}: the DECLARED drowning fired`,
            ok: false,
            detail: 'drownTimer=0 on a fixture `r5Swim.DROWN_EXPECTED` says must drown. '
                + 'The thrash never fired, so this arm is not a witness to armed water — '
                + 'either the walk never reached the tile, or the hazard is still coerced '
                + `in \`noHazards\`, or the item was held after all. (${decl.why})`,
        };
    }
    const lo = decl.minTicks ?? 1;
    const hi = decl.maxTicks ?? DROWN_TIMER_MAX;
    const inBand = contact >= lo && contact <= hi;
    return {
        name: `${name}: the DECLARED drowning fired`,
        ok: inBand,
        detail: inBand
            ? `drownTimer=${drownTimer} ≈ ${contact} contact tick(s), inside the declared `
                + `[${lo},${hi}] — the game stood on LIVE water without canSwim and its `
                + 'own timer says so'
            : `drownTimer=${drownTimer} ≈ ${contact} contact tick(s), OUTSIDE the declared `
                + `[${lo},${hi}]. Below the floor the contact is too brief to be a `
                + 'deliberate stand; above the ceiling the arm is one tick from `drown()` '
                + 'latching and `die()` — and a dead player\'s stream is a respawn, not a '
                + 'comparison.',
    };
}

/**
 * Every declared name is a real fixture.
 *
 * ⚠ The rot guard the `MODEL_EXEMPT` table gets for free and this one does
 * not. An unexercised `MODEL_EXEMPT` entry fails its own per-tape check
 * because the harness runs that check on every tape it replays; a
 * `DROWN_EXPECTED` entry naming a fixture that was renamed or deleted is
 * simply never consulted, and silence is what a stale declaration looks
 * like. So the roster is asserted against the table once per sweep.
 *
 * @param {string[]} rosterNames  every fixture the repo has
 */
export function drownDeclarationRosterFindings(rosterNames) {
    if (!Array.isArray(rosterNames)) {
        fail('drownDeclarationRosterFindings needs the fixture roster');
    }
    const unknown = DROWN_EXPECTED_NAMES.filter((n) => !rosterNames.includes(n));
    return [{
        name: 'every DROWN_EXPECTED declaration names a real fixture',
        ok: unknown.length === 0,
        detail: unknown.length === 0
            ? `${DROWN_EXPECTED_NAMES.length} declaration(s): `
                + `${DROWN_EXPECTED_NAMES.join(', ') || 'none'}`
            : `${unknown.join(', ')} — declared as expected to drown and not in the `
                + 'roster, so the declaration is never consulted and the assert it '
                + 'weakens is weakened for nothing',
    }];
}
