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
