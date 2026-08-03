/**
 * seedlingDemo/r5Acceptance — R5's claims, as pure functions over what the
 * GAME reported.
 *
 * Same doctrine as `r1Acceptance` … `r4Acceptance`: the claim lives here as
 * data-in / findings-out, so `r5Acceptance.test.js` can mutate every input
 * and assert the matching check goes red — in CI, in milliseconds. A claim
 * that only ever runs against a passing twenty-minute replay is a claim
 * nobody has ever seen FAIL, and a check that has never failed is
 * indistinguishable from one that cannot.
 *
 * ── Slice 3: THE FIRST LIVE KILL, and why it is a PAIR ────────────────
 *
 * L60's `lock@128,80` is gated on two jellyfish. The claim is not "the
 * presses were sent" and not "the enemies are gone" — neither is
 * observable from a tape. It is what the deaths OPEN:
 *
 *   `Lock.checkEnemies` sets `activate` when `Game.totalEnemies() == 0`;
 *   `activationStep` then fades the alpha by 0.01 PER UPDATE; and only
 *   `turnOff()` writes `type = ""` and `Game.setPersistence(tag, false)`.
 *
 * So the ledger entry `{60, 0}` appears in `persistence_cleared` if and
 * only if both jellyfish really died — and the same held RIGHT that pins
 * the control arm against a `Solid` walks the kill arm through empty air.
 *
 * ⚠ BOTH HALVES ARE REQUIRED AND NEITHER IS SUFFICIENT. A kill arm alone
 * is a walk that might never have been blocked; a control arm alone is a
 * walk that stopped for some unexamined reason. The pair is one field
 * apart — the tapes are identical but for `inputs`' primary spans — so a
 * difference between them has exactly one available cause.
 */

export const L60_KILL = 'r5-l60-kill';
export const L60_CONTROL = 'r5-l60-kill-control';

/** `lock@128,80`'s level and persistence tag, from the shipped census. */
export const L60_LOCK = Object.freeze({ level: 60, tag: 0, rect: Object.freeze({ x: 128, right: 144 }) });

const flagKey = (c) => `${c.level}:${c.tag}`;
const clearedSet = (status) => new Set((status?.persistence_cleared ?? []).map(flagKey));
const terminal = (arm) => arm?.stream?.ticks?.at(-1);

/**
 * The pair's findings.
 *
 * @param {Map<string,{stream,status}>} replayed
 */
export function l60KillFindings(replayed) {
    const kill = replayed?.get(L60_KILL);
    const control = replayed?.get(L60_CONTROL);
    if (!kill || !control) {
        return [{
            name: 'R5 L60 kill pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[kill && L60_KILL, control && L60_CONTROL].filter(Boolean).join(', ') || 'neither'} `
                + '— a pair asserted from one arm is not a pair',
        }];
    }
    const found = [];
    const want = `${L60_LOCK.level}:${L60_LOCK.tag}`;
    const killCleared = clearedSet(kill.status);
    const controlCleared = clearedSet(control.status);

    // 1. THE LEDGER, IN BOTH DIRECTIONS. `Lock.turnOff` is the only writer
    //    of this flag, so its presence is the death of both jellyfish and
    //    its absence is their survival. Asserted as membership rather than
    //    as an exact set: the kill arm's walk collects nothing else, but
    //    "nothing else changed" is the third check below and belongs there.
    found.push({
        name: 'R5 L60: the kill arm EARNED the lock flag',
        ok: killCleared.has(want),
        detail: killCleared.has(want)
            ? `{${want}} is off, out of ${killCleared.size} flag(s) off in all — and `
                + '`Lock.turnOff()` is its only writer'
            : `{${want}} is still SET. Either a jellyfish survived, or the walk left `
                + 'before the lock\'s 100-tick alpha fade finished — the fade is 0.01 '
                + 'per UPDATE and only its END writes the flag.',
    });
    found.push({
        name: 'R5 L60: the CONTROL arm did not',
        ok: !controlCleared.has(want),
        detail: !controlCleared.has(want)
            ? `{${want}} is still set, as it must be with both jellyfish alive`
            : `{${want}} is OFF in the arm with no presses. The lock opened without a `
                + 'kill, so this pair proves nothing about the sword.',
    });

    // 2. THE SAME WALK, TWO OUTCOMES. The lock's rect is [128,144) and the
    //    player box's right edge is `x + 2`, so a blocked walk stops at
    //    x = 126 and a clear one passes 144. Stated as inequalities rather
    //    than exact positions: the pin is a collision result and the far
    //    side is a coast, and pinning either to a literal would make this
    //    check a snapshot of one recording rather than a claim.
    const kEnd = terminal(kill);
    const cEnd = terminal(control);
    // ⚠ THE DETAIL BRANCHES ON `ok`, and it does so because the first live
    // run printed the PASSING sentence on a FAILING check — "past the lock's
    // [128,144) and still in L60" beside a terminal level of 61. A failure
    // report that describes the pass is worse than no detail at all: it
    // sends the reader looking for a defect somewhere the numbers say there
    // isn't one.
    const pinOk = !!cEnd && cEnd.level === L60_LOCK.level
        && cEnd.x + 2 <= L60_LOCK.rect.x && cEnd.x > L60_LOCK.rect.x - 16;
    found.push({
        name: 'R5 L60: the control arm PINS at the lock face',
        ok: pinOk,
        detail: !cEnd ? 'no terminal observation'
            : pinOk
                ? `ends L${cEnd.level} x=${cEnd.x} — the lock's left face is `
                    + `${L60_LOCK.rect.x} and the player's box right edge is x+2`
                : `ends L${cEnd.level} x=${cEnd.x}, which is NOT a pin against `
                    + `[${L60_LOCK.rect.x},${L60_LOCK.rect.right}): the box edge x+2 `
                    + `must reach ${L60_LOCK.rect.x} and no further, and the walk must `
                    + `have moved from the stance at ${L60_LOCK.rect.x - 16}`,
    });
    const crossOk = !!kEnd && kEnd.level === L60_LOCK.level
        && kEnd.x - 2 >= L60_LOCK.rect.right;
    found.push({
        name: 'R5 L60: the kill arm CROSSES it',
        ok: crossOk,
        detail: !kEnd ? 'no terminal observation'
            : crossOk
                ? `ends L${kEnd.level} x=${kEnd.x} — past the lock's [${L60_LOCK.rect.x},`
                    + `${L60_LOCK.rect.right}) and still in L60, so the crossing is not a `
                    + 'door transition wearing a lock\'s clothes'
                : kEnd.level !== L60_LOCK.level
                    ? `ends in L${kEnd.level}, not L${L60_LOCK.level} — the walk left the `
                        + 'room through the east teleporter, so "it got past the lock" is '
                        + 'a claim about a door. Shorten the hold.'
                    : `ends L${kEnd.level} x=${kEnd.x} — the box edge x-2 must reach `
                        + `${L60_LOCK.rect.right} to be clear of the lock, and it did not`,
    });

    // 3. AND NOTHING ELSE MOVED. The pair's whole value is that one field
    //    differs, so every other difference is a finding. The ledger sets
    //    must be equal APART from the lock flag — a pickup the fight
    //    knocked loose, or a second lock nobody aimed at, would show up
    //    here and nowhere else.
    const extra = [...killCleared].filter((k) => k !== want && !controlCleared.has(k));
    const lost = [...controlCleared].filter((k) => !killCleared.has(k));
    found.push({
        name: 'R5 L60: the two ledgers differ ONLY by the lock flag',
        ok: extra.length === 0 && lost.length === 0,
        detail: extra.length === 0 && lost.length === 0
            ? `${killCleared.size} vs ${controlCleared.size} flag(s) off, differing only `
                + `by {${want}}`
            : `kill arm gained ${JSON.stringify(extra)} and lost ${JSON.stringify(lost)} `
                + 'besides the lock — the presses did something the pair does not account for',
    });

    // 4. THE PLAYER WAS NEVER HIT — from the game's own report, which is
    //    the readout the R5 batch added for exactly this. `noDamage` is
    //    armed on BOTH arms, so `hits` must be 0 on both; a non-zero one
    //    means the guard did not cover a path and the walk's positions are
    //    a knockback rather than a walk.
    for (const [label, arm] of [['kill', kill], ['control', control]]) {
        const hits = arm.status?.hits;
        found.push({
            name: `R5 L60: the ${label} arm took no damage`,
            ok: hits === 0,
            detail: hits === 0 ? 'hits=0 with noDamage armed'
                : `hits=${hits} — with \`Bot.noDamage\` true this should be impossible, `
                + 'so either the guard missed a path or this build is not the batch\'s',
        });
    }

    return found;
}

/** Every R5 finding this sweep can make. */
export function r5AcceptanceFindings(replayed) {
    return [...l60KillFindings(replayed)];
}
