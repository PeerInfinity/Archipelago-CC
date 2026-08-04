/**
 * seedlingDemo/director — one page, N windows, zero re-boots after the first.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §3.1, ruled at §9.1.
 *
 * ── WHAT CHANGED, AND WHAT DID NOT ────────────────────────────────────
 *
 * R1–R4 split a walk into SEGMENTS: six tapes, each booted into its own
 * fresh page, each INHERITING the previous one's items through a boot
 * `grants` entry, and the chain asserted by the headline tape being the six
 * segments tick for tick. That works, and it is what the fifty-seven frozen
 * fixtures are.
 *
 * A WINDOW is the same cut with the inheritance taken away: the live game
 * state IS the inheritance. One page, N `botLoadTape`/`botStart` pairs, and
 * the boundary asserted from the game's own drained reports. That is
 * strictly stronger than a boot grant — a grant is a claim the tape makes,
 * and a survived boundary is a fact about the game.
 *
 * ⚠ Nothing about the tape format, the interpreter, the parse or the replay
 * path changes. The director is a CALLER of the existing machinery. The
 * 57 fixtures still run one-tape-one-page, and `--tape` is still the shape
 * the harness uses for them.
 *
 * ── THE THREE RULES THAT MAKE IT WORK, ALL LOAD-BEARING ───────────────
 *
 * **1. A boundary must be a level ARRIVAL the next tape's `boot` names.**
 * `Bot.botStart` skips its re-boot only when `bootLevel == Main.level` AND
 * `atBootPosition()` — which compares `Main.playerPositionX/Y`, the SPAWN
 * args the current world was CONSTRUCTED with, not where the player is
 * standing (`Bot.as:706-708, 738-741`). So the boundary has to be a place a
 * `new Game(level, x, y)` really produced. That is the same rule R1's
 * segment chain already obeys, and arrivals occur every ~2 legs.
 *
 * **2. A window after the first declares NO `persistence` clears.**
 * ⚠⚠ This is not tidiness and it is not a style rule. `botStart`'s clear
 * path is NOT additive: when `persistLevel.length > 0` it first walks every
 * level and every tag and sets them ALL back to `true`, and only then
 * applies the declared list (`Bot.as:690-705`). A second window carrying
 * even one clear therefore ERASES every flag the player earned in the
 * windows before it — every pickup's own `removed()` write, every kill-lock
 * open, every LightPole toggle. `windowsFrom` refuses it by name, and the
 * `persistence_cleared` boundary assert is the backstop.
 *
 * **3. A window after the first declares NO `grants`.** For the same reason
 * in a weaker key: a grant would make the claim "this window's items came
 * from the tape" true, which is exactly the claim the director exists to
 * retire. `grants` EMPTY on every window but the first is asserted from the
 * game's own report.
 *
 * ── WHAT `botStart` RESETS, AND WHY THE SAMPLE ORDER MATTERS ──────────
 *
 * `tick`, `dead_frames`, `saw_input_refused`, `saw_auto_advance`, `grants`
 * and `equips` are all zeroed by `botStart`. So a boundary assert has to
 * read the previous window's status BEFORE arming the next one, and the
 * per-window `dead_frames` is a MEASUREMENT of that window rather than a
 * running total — which is what makes the `Game.time` phase knowable again
 * at every boundary instead of only at the boot (§3.1's dead-frame
 * argument).
 */

export class DirectorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DirectorError';
    }
}

const fail = (message) => { throw new DirectorError(message); };

/**
 * Turn an ordered list of segment tapes into an ordered list of WINDOWS.
 *
 * The first window keeps whatever the segment declared — its boot grants
 * (if any), its clear list, its `noHazards`. Every later one is stripped,
 * and a later one that DECLARED either is a named failure rather than a
 * silent strip: a route author who wrote a clear into window 4 meant
 * something by it, and what the game would do with it is erase windows 1–3.
 *
 * @param {object[]} tapes  parsed tapes, in window order
 * @param {object=}  opts
 * @param {boolean=} opts.strip  rewrite instead of refusing (authoring only)
 */
export function windowsFrom(tapes, { strip = false } = {}) {
    if (!Array.isArray(tapes) || tapes.length === 0) {
        fail('windowsFrom needs a non-empty ordered array of tapes');
    }
    return tapes.map((tape, i) => {
        if (i === 0) return tape;
        const hasClears = (tape.persistence ?? []).length > 0;
        const hasGrants = (tape.grants ?? []).length > 0;
        if (!strip && hasClears) {
            fail(`window ${i} ("${tape.name}") declares ${tape.persistence.length} `
                + 'persistence clear(s). `botStart` resets EVERY tag in EVERY level to true '
                + 'before applying a declared list, so this would erase every flag the '
                + 'earlier windows earned. A window after the first inherits the LIVE '
                + 'state; pass {strip: true} only when authoring windows FROM segments.');
        }
        if (!strip && hasGrants) {
            fail(`window ${i} ("${tape.name}") declares ${tape.grants.length} grant(s). `
                + 'The live game state is the inheritance — a grant here would re-assert '
                + 'from the TAPE the thing the director exists to prove from the GAME.');
        }
        return { ...tape, persistence: [], grants: [] };
    });
}

/** The 13 booleans, as `botStatus.items` reports them. */
const ITEM_BOOLEANS = Object.freeze([
    'hasSword', 'hasDarkSword', 'hasGhostSword', 'hasShield', 'hasDarkShield',
    'hasFire', 'hasWand', 'hasFireWand', 'canSwim', 'hasFeather', 'hasSpear',
    'hasDarkSuit', 'hasTorch',
]);

const trueItems = (items) => ITEM_BOOLEANS.filter((k) => items?.[k] === true);
const setOf = (rows) => new Set((rows ?? []).map((r) => `${r.level}:${r.tag}`));

/**
 * The boundary between two windows, asserted from the GAME's own reports.
 *
 * ⚠ BOTH SIDES COME FROM THE GAME, and that is the §14 lesson from R4 in
 * its new costume: a check phrased as "window k+1 booted where the PLAN
 * said" shares a derivation with the thing that produced the plan. So the
 * comparison is window k's drained END state against window k+1's status
 * read BEFORE it was armed — two readouts of one live game, one instant
 * apart.
 *
 * @param {object} prev  `botStatus` after window k finished (pre-`botStart`)
 * @param {object} next  `botStatus` after window k+1's `botStart`
 * @param {object} prevStream  window k's drained tick stream
 * @returns {object[]} findings; empty means the boundary held
 */
export function boundaryFindings(prev, next, prevStream, { index = 0, label = '' } = {}) {
    const findings = [];
    const where = `boundary ${index} → ${index + 1}${label ? ` (${label})` : ''}`;
    const add = (what, detail) => findings.push({ where, what, detail });

    if (!prev || !next) {
        add('a status is missing', 'both sides of a boundary must be a live readout');
        return findings;
    }

    // 1. THE PLAYER IS IN THE SAME LEVEL, AT THE SAME PLACE.
    //
    // ⛔ AND A DRIFT HERE IS NOT ALWAYS A DEFECT, which is the thing the
    //    first run of the R4 bridge taught. Two different events look the
    //    same from here:
    //
    //      a re-boot   `botStart` found the tape's boot block naming
    //                  different construction args than the current world's
    //                  and built a new `Game`. The chain is then N walks.
    //      a DRIFT     the game never stops between windows, and a tape
    //                  whose last span runs to `tick_count` leaves that key
    //                  HELD — `r4-walk-1-sword` runs `up` 591..641 with
    //                  `tick_count` 641. FlashPunk's `Input` is a static and
    //                  nothing clears it, so the player walks off the
    //                  boundary before the next window is armed. Every
    //                  fixture before R5 got a FRESH PAGE, which released
    //                  the keys implicitly; a window does not.
    //
    //    `atRest` says which: a drift is small and in the direction of a
    //    held key, a re-boot lands exactly on the boot block's own
    //    construction position. Both are findings; they are not the same
    //    finding, and the fix for the second is an AUTHORING rule
    //    (`assertWindowEndsAtRest`) rather than anything the run can do.
    if (next.level !== prev.level) {
        add('the level changed across the boundary', `L${prev.level} → L${next.level}`);
    }
    if (next.x !== prev.x || next.y !== prev.y) {
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        add('the position changed across the boundary',
            `(${prev.x},${prev.y}) → (${next.x},${next.y}), Δ(${dx.toFixed(2)},`
            + `${dy.toFixed(2)}) — either botStart RE-BOOTED (the boundary is not an `
            + 'arrival this window\'s `boot` block names) or the previous window ENDED '
            + 'WITH A KEY HELD and the player drifted while the game kept ticking');
    }

    // ⚠⚠ AND `next` IS SAMPLED ONE TICK TOO EARLY TO SETTLE WHICH.
    //    `botStart`'s re-boot is `FP.world = new Game(...)`, which only
    //    records a `_goto`: `Engine.checkWorld` defers the swap to END OF
    //    TICK, the same rule every teleporter obeys. So a status read the
    //    instant `botStart` returns still sees the OLD world's player — the
    //    drifted position — and the NEW one appears a tick later. The R4
    //    bridge measured exactly that: three boundaries reporting a 0.8 px
    //    "drift" while all six streams came back byte-identical, which is
    //    only possible if the re-boot landed after the sample. The
    //    authoritative comparison is between the two DRAINED STREAMS, and
    //    that is `streamBoundaryFindings`.

    // 2. ...AND THE STREAM AGREES. The status is a live readout; the drained
    //    stream is what the differential compares. If they disagree the
    //    boundary is being asserted against the wrong thing.
    const last = prevStream?.ticks?.at(-1);
    if (last && (last.level !== prev.level || last.x !== prev.x || last.y !== prev.y)) {
        add('the drained stream disagrees with the status it was drained beside',
            `stream L${last.level} (${last.x},${last.y}) vs status L${prev.level} `
            + `(${prev.x},${prev.y})`);
    }

    // 3. THE INVENTORY IS INHERITED, NOT RE-GRANTED. Equal both ways: an
    //    item lost across a boundary is a re-boot the position check missed,
    //    and an item GAINED is a grant that fired where none was declared.
    const before = trueItems(prev.items).join(',');
    const after = trueItems(next.items).join(',');
    if (before !== after) add('the item set changed across the boundary', `${before} → ${after}`);
    if (prev.items?.hitsMax !== next.items?.hitsMax) {
        add('hitsMax changed across the boundary',
            `${prev.items?.hitsMax} → ${next.items?.hitsMax}`);
    }

    // 4. THE LEDGER IS MONOTONE. A cleared flag never comes back — except
    //    through `botStart`'s reset-everything path, which is exactly what
    //    rule 2 forbids and this is the backstop for.
    const beforeCleared = setOf(prev.persistence_cleared);
    const afterCleared = setOf(next.persistence_cleared);
    const lost = [...beforeCleared].filter((k) => !afterCleared.has(k));
    if (lost.length > 0) {
        add('cleared flags came BACK across the boundary',
            `${lost.length} lost (${lost.slice(0, 6).join(' ')}${lost.length > 6 ? ' …' : ''}) `
            + '— a window after the first declared persistence clears, and `botStart` '
            + 'reset every tag in every level');
    }

    // 5. NOTHING WAS GRANTED. The window's own report, not its tape.
    if ((next.grants ?? []).length > 0) {
        add('the window fired grants', JSON.stringify(next.grants));
    }
    return findings;
}

/**
 * The same boundary, asked of the two DRAINED STREAMS instead of the status.
 *
 * This is the one that can be believed: an observation is recorded by the
 * bot's own hook at the top of a live frame, so it is never mid-swap, and
 * both sides are the currency the differential already compares. The status
 * pair above stays because it carries what a stream does not — items, the
 * ledger, grants — and because a disagreement BETWEEN the two is itself
 * informative: it is what identified the deferred swap.
 */
export function streamBoundaryFindings(prevStream, nextStream, { index = 0, label = '' } = {}) {
    const where = `stream boundary ${index} → ${index + 1}${label ? ` (${label})` : ''}`;
    const last = prevStream?.ticks?.at(-1);
    const first = nextStream?.ticks?.[0];
    if (!last || !first) {
        return [{ where, what: 'a drained stream is missing or empty', detail: '' }];
    }
    const findings = [];
    for (const f of ['level', 'x', 'y']) {
        if (last[f] !== first[f]) {
            findings.push({
                where,
                what: `${f} is not continuous across the boundary`,
                detail: `${last[f]} → ${first[f]}`,
            });
        }
    }
    return findings;
}

/**
 * ⛓ THE CONTINUATION ASSERT — a silent re-boot must be a NAMED failure.
 *
 * ⛔ The finding this exists for is slice 2's, and it is the nastiest shape
 * in the arc: **a re-boot ERASES the drift it was caused by.** When a
 * window's boot block does not match the current world, `botStart` rebuilds
 * `new Game(bootLevel, bootX, bootY)` (`Bot.as:706-711`) and the next
 * window's first observation lands exactly on its declared boot position.
 * So `streamBoundaryFindings` comes back SILENT, the streams come back
 * byte-identical, and the trace reports a clean continuation it did not
 * make. That is a graceful fallback erasing the evidence of its own
 * trigger, and the R4 bridge's five held-key boundaries are all of them.
 *
 * The witness pair (`--boundary-witness`) can see it because it is
 * purpose-built — two windows with the SAME boot args, so `botStart` skips
 * the re-boot and a drift really does survive. That is one pair. **Every
 * other trace needs the same guard**, or the property is checked exactly
 * where it was already known to hold.
 *
 * The signal is DEAD FRAMES. A re-boot pays `blackCover`'s room fade — ~19
 * frames, and exactly 20 under the R5 dead-frame pin — and a continuation
 * that stays in one room pays none. So:
 *
 *   a window whose stream never changes level and whose terminal
 *   `dead_frames` is NOT zero was re-booted, whatever its positions say.
 *
 * ⚠ It is deliberately only asserted for a window that stays in ONE ROOM.
 * A window that crosses a door pays a fade for the door, and separating
 * "the fade I crossed for" from "the fade botStart cost me" needs a
 * per-load constant this module has no business owning. A window that
 * crosses is reported as UNASSERTED rather than passed — an unasserted
 * check and a passing one must not print the same thing.
 *
 * @param {object} window `{label, stream, status}` — `status` TERMINAL
 * @param {object} opts.index
 * @param {boolean=} opts.reBootExpected  true for window 0 (and for any
 *   window a caller has declared as an intentional re-boot), where the
 *   fade is the boot's own and the assert does not apply.
 */
export function continuationFindings(window, { index = 0, reBootExpected = false } = {}) {
    const where = `continuation ${index}${window?.label ? ` (${window.label})` : ''}`;
    const dead = window?.status?.dead_frames;
    if (dead === undefined || dead === null) {
        return [{ where, what: 'no dead_frames in the terminal status',
            detail: 'the continuation assert cannot be made without it, and a boundary '
                + 'nobody checked is not a boundary that held' }];
    }
    if (reBootExpected) {
        return [{ where, what: 'unasserted — this window declares a re-boot',
            detail: `dead_frames=${dead}`, informational: true }];
    }
    const ticks = window?.stream?.ticks ?? [];
    const levels = new Set(ticks.map((o) => o.level));
    if (levels.size !== 1) {
        return [{ where, what: 'unasserted — the window crosses a door, so its fade is '
            + 'not attributable',
            detail: `${levels.size} level(s): ${[...levels].join(',')}, dead_frames=${dead}`,
            informational: true }];
    }
    if (dead !== 0) {
        return [{ where, what: 'a CONTINUATION window paid dead frames',
            detail: `dead_frames=${dead} in a window that never left L${[...levels][0]}. `
                + 'The only thing that fades a room the walk did not enter is '
                + '`botStart` rebuilding the world — which also ERASES the drift that '
                + 'made it rebuild, so every position check downstream of here is '
                + 'reporting a continuation that did not happen.' }];
    }
    return [];
}

/**
 * The whole trace: one page, N windows, zero re-boots after the first.
 *
 * The partition claim in the shape §7's G2 asks for. Every finding names
 * itself; an empty list is the claim.
 *
 * @param {object[]} windows `[{label, stream, status, boundary_before}]`
 */
export function traceFindings(windows) {
    const findings = [];
    if (!Array.isArray(windows) || windows.length === 0) {
        return [{ where: 'trace', what: 'no windows', detail: 'a trace of zero windows proves nothing' }];
    }
    for (let i = 1; i < windows.length; i += 1) {
        // ⚠ `boundary_after_start`, NOT `status`. `status` is the window's
        // END state — comparing it to the PREVIOUS window's end state asks
        // "did the walk stand still for a whole window", which of course it
        // did not, and reports every level the walk crossed as a broken
        // boundary. The boundary is the instant BETWEEN: the previous
        // window's final `botStatus` against this one's, sampled immediately
        // after `botStart` and before a single tape tick has run.
        findings.push(...boundaryFindings(
            windows[i].boundary_before, windows[i].boundary_after_start,
            windows[i - 1].stream,
            { index: i - 1, label: windows[i].label },
        ));
        // ⛓ And the one the boundary checks CANNOT make, because a re-boot
        // erases its own evidence. Window 0 is exempt: its fade is the
        // boot's own.
        findings.push(...continuationFindings(windows[i], { index: i }));
    }
    // The tick counts SUM to the walk, exactly as R1's segment chain does —
    // stated over the drained streams rather than the tapes, so a window that
    // ran short is a finding rather than a plan nobody checked.
    const total = windows.reduce((n, w) => n + Math.max((w.stream?.ticks?.length ?? 0) - 1, 0), 0);
    findings.push({ where: 'trace', what: 'ticks', detail: `${windows.length} windows, `
        + `${total} live ticks`, informational: true });
    return findings.filter((f) => !f.informational);
}

/**
 * A window tape must end AT REST — every span closed, with room to coast.
 *
 * ⛔ The authoring rule the R4 bridge discovered, and it exists because the
 * game does not stop between windows. A span whose `to` equals `tick_count`
 * never gets its release edge dispatched inside the tape, so the key is
 * still down when the tape finishes; FlashPunk's `Input` is a static that
 * no teleport path clears; and the player then walks for as long as the
 * boundary round trip takes. R1–R4 could not see it because every fixture
 * got a fresh page.
 *
 * `coast` is the trailing ticks after the last release. Friction is
 * SUBTRACTIVE (`v.normalize(max(v.length - f, 0))`) and the whole coast
 * from walk speed is under 2 px, so a handful of ticks is enough — but it
 * has to be more than zero, because the release edge itself lands on a tick
 * the player is still moving on.
 *
 * @returns {string[]} findings; empty means the window ends at rest
 */
export function assertWindowEndsAtRest(tape, { coast = 8 } = {}) {
    const findings = [];
    const end = tape.tick_count;
    for (const span of tape.inputs ?? []) {
        if (span.to >= end) {
            findings.push(`span {${span.key} ${span.from}..${span.to}} runs to `
                + `tick_count (${end}), so its release edge never fires inside the tape and `
                + `"${span.key}" is still HELD when the window ends`);
        } else if (span.to > end - coast) {
            findings.push(`span {${span.key} ${span.from}..${span.to}} releases only `
                + `${end - span.to} tick(s) before the end; a window needs ~${coast} to `
                + 'coast to a stop, or the player drifts across the boundary');
        }
    }
    return findings;
}

/**
 * ⛔ THE FLAG-WRITE CLEARANCE — a boundary may not sit inside a fade.
 *
 * Slice 3 measured what a `Lock` costs: `checkEnemies` sets `activate` when
 * `totalEnemies() == 0`, `activationStep` then decays the graphic's alpha by
 * **0.01 per update**, and only `turnOff()` writes `type = ""` and
 * `Game.setPersistence(tag, false)`. A `BossLock` is the same shape with
 * different numbers — 60 ticks of `keyTimer` and then 20 of `alpha -= 0.05`,
 * so 80. Either way the ledger entry lands a LONG way after the event a
 * reader would call "the lock opened".
 *
 * That is a boundary problem and not only a routing one. A window that ends
 * inside the fade drains a `persistence_cleared` that does not yet show the
 * open, so:
 *
 *   - `boundaryFindings`' monotone-ledger check compares a SHORT set against
 *     the next window's — and passes, because nothing came back;
 *   - the trace's exact-set claim reads the flag as belonging to whichever
 *     window happened to catch the write, which is a fact about where the
 *     cut fell rather than about what the walk did;
 *   - and a re-boot at that boundary would erase the in-flight fade
 *     entirely, since `botStart` rebuilds the world.
 *
 * So a boundary must be at least `clearance` ticks clear of every declared
 * flag-opening event, or the boundary must NAME the write it is cutting
 * across. Naming it is a legal answer — this returns a finding either way and
 * the caller decides — but silence is not.
 *
 * ⚠ THE EVENTS ARE DECLARED, NOT DISCOVERED. A window's stream does not
 * report when a lock latched; it reports where the player was. So the caller
 * passes what its plan believes (`{window, tick, what}`), and the claim this
 * makes is about the PLAN's cut points. The live backstop stays the exact-set
 * ledger assert — this is the check that stops a plan from being authored
 * into a shape whose ledger nobody can attribute.
 *
 * @param {object[]} windows  `[{label, stream}]`, in order
 * @param {object[]} events   `[{window, tick, what, clearance?}]` — `tick` is
 *   the tick WITHIN that window at which the flag write lands
 * @param {object=} opts.clearance  default 100, a `Lock`'s alpha fade
 * @returns {object[]} findings; empty means every boundary is clear
 */
export const LOCK_FLAG_WRITE_TICKS = 100;

export function boundaryFlagClearanceFindings(windows, events, {
    clearance = LOCK_FLAG_WRITE_TICKS,
} = {}) {
    if (!Array.isArray(windows) || windows.length === 0) {
        fail('boundaryFlagClearanceFindings needs the window list the events index into');
    }
    const findings = [];
    for (const e of events ?? []) {
        const i = e.window;
        if (!Number.isInteger(i) || i < 0 || i >= windows.length) {
            fail(`a flag-write event names window ${JSON.stringify(i)}, which is not one `
                + `of the ${windows.length} windows`);
        }
        // A window's last live tick. An N-tick tape yields N+1 observations
        // (RECORD-THEN-ACT), so the last tick index is length - 1 — taken
        // from the DRAINED STREAM rather than from `tick_count`, because the
        // stream is what the ledger was drained beside.
        const ticks = windows[i].stream?.ticks?.length;
        if (!ticks) {
            findings.push({
                where: `flag clearance (window ${i}${windows[i].label ? ` ${windows[i].label}` : ''})`,
                what: 'the window has no drained stream, so its boundary cannot be placed',
                detail: `event "${e.what}" claims tick ${e.tick}`,
            });
            continue;
        }
        const need = e.clearance ?? clearance;
        const margin = (ticks - 1) - e.tick;
        if (margin < need) {
            findings.push({
                where: `flag clearance (window ${i}${windows[i].label ? ` ${windows[i].label}` : ''})`,
                what: 'a window boundary sits inside a flag write',
                detail: `"${e.what}" latches at tick ${e.tick} and the window ends at `
                    + `${ticks - 1} — ${margin} tick(s) of margin against the ${need} the `
                    + 'write costs. The next window inherits a ledger that does not yet '
                    + 'show the open, so the flag is attributed to wherever the cut fell. '
                    + 'Move the boundary later, or declare the in-flight write by name.',
            });
        }
    }
    return findings;
}


/**
 * ⛓ THE CRUTCH SCHEDULE — a coercion may never outlive its justification.
 *
 * §3.4's rule, and R5 slice 4 step 4 is the first rung with a chain long
 * enough for it to mean anything. `noHazards` is a per-TAPE field, so a
 * trace of N windows carries N of them, and the honest form of the
 * subtractive ladder is that the list SHRINKS as items are earned:
 *
 *     ["water","waterfall"]   until `canSwim`   is banked (the conch)
 *     ["waterfall"]           until `hasFeather` is banked (L89)
 *     []                      from there to the end — the real game
 *
 * Two rules, and they are different claims:
 *
 * 1. **A retirement must be JUSTIFIED.** A window that stops coercing a
 *    hazard has to hold the item that makes standing on it survivable, and
 *    the finding NAMES the item. Retiring `water` without `canSwim` is not
 *    a bolder walk, it is eleven ticks from `die()`.
 * 2. **A justification must be SPENT.** A window that still coerces a
 *    hazard whose item the game already holds is carrying a crutch it has
 *    paid for — which is exactly how a ladder stops descending. This is
 *    the rule that makes the schedule a schedule rather than a list of
 *    whatever each tape happened to declare.
 *
 * ⚠ ASKED AT BOUNDARIES, NOT WITHIN A WINDOW, and that is not a softening.
 * The window that EARNS an item holds it for its last few ticks — the D5
 * walk banks the conch 33 ticks before it ends — and demanding the
 * retirement inside that window would demand a tape that arms water in the
 * middle of itself, which a tape cannot express. The rule is that the
 * coercion may not survive the next BOUNDARY.
 *
 * ⚠ AND THE ITEMS COME FROM THE GAME, not from the plan (§14's law). The
 * reading is `boundary_after_start.items` — the live readout taken after
 * `botStart` and before a single tape tick — so "the walk holds the conch"
 * is the game's statement, and a schedule justified by the tape's own
 * `grants` would be the plan agreeing with itself.
 *
 * @param {object[]} windows `[{label, tape, boundary_after_start}]`, in order
 * @returns {object[]} `{name, ok, detail}` findings — one per boundary per
 *   hazard decision, PASSING ones included, because "water was retired here
 *   and `canSwim` is why" is the sentence this exists to print.
 */
export const CRUTCH_JUSTIFICATION = Object.freeze({
    /** `Pickups/Conch.as` — `Player.canSwim = true`. `checkDrowning`'s water arm. */
    water: 'canSwim',
    /** `Pickups/Feather.as` — `Player.hasFeather`. The upward waterfall gate. */
    waterfall: 'hasFeather',
    /** `Pickups/DarkSuit.as` — `checkDrowning`'s lava arm. */
    lava: 'hasDarkSuit',
    /**
     * ⚠ NULL means NOTHING RETIRES IT, which is a different statement from
     * "not yet scheduled". Ice is not lethal and has been ARMED since R4, so
     * a window that coerced it would be adding a crutch rather than keeping
     * one; a pit is a transport with no item anywhere in the game that makes
     * standing on one survivable. Either in `noHazards` after R4 is a
     * finding with no way to satisfy it, and that is the right answer.
     */
    ice: null,
    pit: null,
});

export function crutchScheduleFindings(windows) {
    if (!Array.isArray(windows) || windows.length === 0) {
        fail('crutchScheduleFindings needs the ordered window list');
    }
    const found = [];
    const listOf = (w) => [...(w?.tape?.noHazards ?? [])];
    const label = (w, i) => `${i}${w?.label ? ` (${w.label})` : ''}`;
    for (let i = 1; i < windows.length; i += 1) {
        const prev = listOf(windows[i - 1]);
        const next = listOf(windows[i]);
        const items = windows[i]?.boundary_after_start?.items ?? null;
        const where = `boundary ${label(windows[i - 1], i - 1)} → ${label(windows[i], i)}`;
        if (!items) {
            found.push({
                name: `${where}: the schedule has a live item readout to judge against`,
                ok: false,
                detail: 'no `boundary_after_start.items` — a schedule justified by the '
                    + 'PLAN rather than by the game is the plan agreeing with itself, so '
                    + 'this cannot be answered and must not pass',
            });
            continue;
        }
        const held = (h) => {
            const item = CRUTCH_JUSTIFICATION[h];
            return item ? items[item] === true : false;
        };
        const naming = (h) => CRUTCH_JUSTIFICATION[h] ?? 'nothing in the game';

        // 1. A COERCION THAT CAME BACK. `noHazards` may only shrink: a
        //    hazard re-added after a window that armed it is a crutch
        //    picked back up, and no route needs one.
        const readded = next.filter((h) => !prev.includes(h));
        found.push({
            name: `${where}: no coercion came BACK`,
            ok: readded.length === 0,
            detail: readded.length === 0
                ? `[${prev.join(', ') || 'nothing'}] → [${next.join(', ') || 'nothing'}]`
                : `${readded.join(', ')} re-coerced after being armed — the ladder is `
                    + 'subtractive and a hazard that goes back on the list is a rung climbed',
        });

        // 2. EVERY RETIREMENT IS JUSTIFIED, BY NAME.
        for (const h of prev.filter((x) => !next.includes(x))) {
            found.push({
                name: `${where}: "${h}" retired, justified by \`${naming(h)}\``,
                ok: held(h),
                detail: held(h)
                    ? `the game reports \`${naming(h)}\` true at the boundary, so this `
                        + `window stands on live ${h} because it can survive it`
                    : `\`${naming(h)}\` is NOT held at the boundary. Arming ${h} without `
                        + 'it is not a bolder walk — `checkDrowning` gives an unprotected '
                        + 'player eleven cumulative ticks and then `die()`.',
            });
        }

        // 3. AND EVERY SURVIVING COERCION IS STILL UNPAID.
        for (const h of next) {
            if (!held(h)) continue;
            found.push({
                name: `${where}: "${h}" is still coerced`,
                ok: false,
                detail: `the game already holds \`${naming(h)}\`, so this window is `
                    + `carrying a crutch it has paid for. A coercion may not outlive its `
                    + 'justification (§3.4) — that is how a subtractive ladder stops '
                    + 'descending while still reporting green.',
            });
        }
    }
    return found;
}

/**
 * How many live ticks a trace ran, from the drained streams.
 *
 * An N-tick tape yields N+1 observations (RECORD-THEN-ACT), so a window's
 * tick count is its stream length minus one — and the SUM is the walk.
 */
export function traceTicks(windows) {
    return (windows ?? []).reduce(
        (n, w) => n + Math.max((w.stream?.ticks?.length ?? 0) - 1, 0), 0,
    );
}
