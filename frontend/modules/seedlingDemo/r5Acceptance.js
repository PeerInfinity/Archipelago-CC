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

/**
 * ── Slice 4 step 1: THE KEY LEG, and its shut-before control ──────────
 *
 * The claim is an OPENED BLOCKER, so the doctrine asks for a pair. A key is
 * not a tape field, so this one is not "one field apart" and does not
 * pretend to be: it is the SAME STANCE AND THE SAME HOLD, once with
 * `Player.hasKey(1)` and once without.
 *
 *   `r5-bosskey-leg`         L29 → key → L31's pocket lock → L30's chamber
 *                            lock, and stops beside the stairs to L32.
 *   `r5-bosskey-lock-shut`   boots 16 px south of L30's lock and holds UP
 *                            for 140 ticks — against a `BossLock` that
 *                            opens on tick 80 of contact, so this is not a
 *                            walk that ran out of patience.
 *
 * ⛔ AND THE KEY IS SPENT TWICE. §2.6.1 names one lock; the extract has
 * two. L31's stairs to L30 sit in a five-tile pocket behind
 * `bosslock@192,432`, and a flood from the L29 arrival reaches 103 tiles
 * without it. So the exact set is `{31,0}` AND `{30,2}`.
 *
 * ⚠ NEITHER ARM HOLDS AN ITEM, and that is asserted rather than assumed.
 * `BossKey.removed()` is `Player.hasKeySet(keyType, true)` and nothing
 * else — it does not call `super.removed()`, so it writes no persistence
 * either. A key leg whose item set moved would mean the walk picked up
 * something it never aimed at.
 */
export const KEY_LEG_ARM = 'r5-bosskey-leg';
export const KEY_LEG_CONTROL = 'r5-bosskey-lock-shut';

/** The two `BossLock` flags the key opens, as an EXACT set. */
export const KEY_LEG_FLAGS = Object.freeze([
    Object.freeze({ level: 31, tag: 0, what: 'L31\'s pocket door' }),
    Object.freeze({ level: 30, tag: 2, what: 'L30\'s chamber door' }),
]);

/** `bosslock@224,208`'s south face — the line a keyless walk stops on. */
export const KEY_LEG_LOCK_FACE_Y = 224;

const ITEM_BOOLEANS = Object.freeze([
    'hasSword', 'hasDarkSword', 'hasGhostSword', 'hasShield', 'hasDarkShield',
    'hasFire', 'hasWand', 'hasFireWand', 'canSwim', 'hasFeather', 'hasSpear',
    'hasDarkSuit', 'hasTorch',
]);

export function keyLegFindings(replayed) {
    const leg = replayed?.get(KEY_LEG_ARM);
    const control = replayed?.get(KEY_LEG_CONTROL);
    if (!leg || !control) {
        return [{
            name: 'R5 key leg: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[leg && KEY_LEG_ARM, control && KEY_LEG_CONTROL]
                .filter(Boolean).join(', ') || 'neither'} — an opened-blocker claim `
                + 'without its shut-before control is a walk that stopped for some '
                + 'unexamined reason',
        }];
    }
    const found = [];
    const want = KEY_LEG_FLAGS.map((f) => `${f.level}:${f.tag}`);
    const legCleared = clearedSet(leg.status);
    const controlCleared = clearedSet(control.status);

    // 1. THE LEDGER, AS AN EXACT SET IN BOTH DIRECTIONS. `BossLock.update`'s
    //    `turnOff` arm is the only writer of either flag, and the tape
    //    declares no clears at all — so membership is the two locks opening
    //    and the SIZE is "and nothing else did".
    const missing = want.filter((k) => !legCleared.has(k));
    const extra = [...legCleared].filter((k) => !want.includes(k));
    found.push({
        name: 'R5 key leg: the ledger is EXACTLY the two locks the key opens',
        ok: missing.length === 0 && extra.length === 0,
        detail: missing.length === 0 && extra.length === 0
            ? `{${want.join('} {')}} are off and nothing else is — one keyType-1 key, `
                + 'spent twice, and the tape declares no clears'
            : `missing ${JSON.stringify(missing)}, unexpected ${JSON.stringify(extra)} `
                + `out of ${legCleared.size} flag(s) off. A missing one is a lock the `
                + 'walk never opened; an extra one is something it opened by accident.',
    });

    // 2. THE CONTROL'S LEDGER IS EMPTY. Not "does not contain {30,2}" —
    //    EMPTY, because the control walks 16 px in a straight line and a
    //    single flag off would mean it did something nobody asked for.
    found.push({
        name: 'R5 key leg: the CONTROL arm cleared nothing at all',
        ok: controlCleared.size === 0,
        detail: controlCleared.size === 0
            ? 'no flag is off — `BossLock.update` never set `activate`, because '
                + '`Player.hasKey(1)` is false'
            : `${controlCleared.size} flag(s) off (${[...controlCleared].join(' ')}) in an `
                + 'arm that holds no key and walks 16 px — the pair attributes nothing',
    });

    // 3. THE TWO ARMS PART AT THE LOCK. The control's box top pins on the
    //    lock's south face (y = 224, so the centre lands just under 227);
    //    the leg arm ends NORTH of the whole lock tile, inside the chamber
    //    that only the stairs to L32 leave from.
    const legEnd = terminal(leg);
    const cEnd = terminal(control);
    const pinOk = !!cEnd && cEnd.level === 30
        && cEnd.y - 2 >= KEY_LEG_LOCK_FACE_Y && cEnd.y - 2 < KEY_LEG_LOCK_FACE_Y + 2;
    found.push({
        name: 'R5 key leg: the control arm PINS on the lock\'s south face',
        ok: pinOk,
        detail: !cEnd ? 'no terminal observation'
            : pinOk
                ? `ends L${cEnd.level} y=${cEnd.y} — box top ${(cEnd.y - 2).toFixed(2)} `
                    + `against the lock's face at ${KEY_LEG_LOCK_FACE_Y}`
                : `ends L${cEnd.level} y=${cEnd.y}, box top ${(cEnd.y - 2).toFixed(2)} — `
                    + `which is not a pin on ${KEY_LEG_LOCK_FACE_Y}. Below it means the `
                    + 'walk never reached the lock; above it means the lock was not there.',
    });
    const throughOk = !!legEnd && legEnd.level === 30
        && legEnd.y + 3 <= KEY_LEG_LOCK_FACE_Y - 16;
    found.push({
        name: 'R5 key leg: the key arm is THROUGH it, inside the chamber',
        ok: throughOk,
        detail: !legEnd ? 'no terminal observation'
            : throughOk
                ? `ends L${legEnd.level} (${legEnd.x},${legEnd.y}) — north of the lock `
                    + `tile's top at ${KEY_LEG_LOCK_FACE_Y - 16}, in the brickpole chamber `
                    + 'whose only other door is `stairsup@224,160` to BobBoss'
                : `ends L${legEnd.level} (${legEnd.x},${legEnd.y}), which is not inside `
                    + `the chamber — its floor starts at y < ${KEY_LEG_LOCK_FACE_Y - 16}`,
    });

    // 4. THE ITEM SET DID NOT MOVE. A boss key is not one of the fourteen
    //    properties, so both arms must report thirteen falses and hitsMax 3
    //    — and the leg arm walked past a torch pickup to get here.
    for (const [label, arm] of [['key', leg], ['control', control]]) {
        const items = arm.status?.items ?? {};
        const on = ITEM_BOOLEANS.filter((k) => items[k] === true);
        found.push({
            name: `R5 key leg: the ${label} arm holds no ITEM`,
            ok: on.length === 0 && items.hitsMax === 3,
            detail: on.length === 0 && items.hitsMax === 3
                ? 'thirteen booleans false, hitsMax 3 — `BossKey.removed()` is '
                    + '`hasKeySet` and nothing else, and the walk avoided `torchpickup@64,64`'
                : `holds ${JSON.stringify(on)} with hitsMax ${items.hitsMax} — this walk `
                    + 'grants nothing and collects one key, so any item is one it '
                    + 'stepped on by accident',
        });
        const hits = arm.status?.hits;
        found.push({
            name: `R5 key leg: the ${label} arm took no damage`,
            ok: hits === 0,
            detail: hits === 0 ? 'hits=0 — and L30\'s `bobsoldier@48,80` was path-avoided '
                    + 'rather than guarded against'
                : `hits=${hits} — with \`Bot.noDamage\` true this should be impossible`,
        });
    }

    // 5. THE ROOMS, IN ORDER. The transitions are derived from the level
    //    field of the drained stream, so this is the game's own account of
    //    where the walk went — and the pocket lock is the reason there are
    //    two of them rather than one.
    const hops = (leg.stream?.transitions ?? [])
        .map((t) => `${t.from_level}->${t.to_level}`).join(' ');
    found.push({
        name: 'R5 key leg: the walk really went L29 → L31 → L30',
        ok: hops === '29->31 31->30',
        detail: hops === '29->31 31->30'
            ? 'two crossings, and the second one is only possible because the pocket '
                + 'lock opened — L31\'s stairs to L30 are behind it'
            : `the stream says "${hops}" — the leg's own rooms are 29, 31, 30`,
    });

    return found;
}

/**
 * ── Slice 4 step 2: BOBBOSS, and `fire` as the first COMBAT-EARNED boolean
 *
 * The pair is ONE FIELD APART and the field is `grants`. `primary` is both
 * the talk key and the sword, and the game keeps them apart for us: a
 * `BobBossNPC` dialogue holds `Game.freezeObjects`, which gates
 * `Player.input()`, so a press inside a dialogue can only PAGE and a press
 * outside one can only SWING. The same 76-press train therefore drives both
 * arms, and whether it kills anything is decided entirely by whether the
 * tape handed over a sword.
 *
 * ⛔ AND THE LEDGER HAS AN ENTRY IN THE WRONG LEVEL. `BobBoss.death` spawns
 * `new Fire(..., -1)`, and `Fire.removed()` calls `setPersistence(-1,
 * false)` unconditionally — its `check()` guard is `tag >= 0 && ...`, which
 * a -1 skips. `Main.levelPersistenceSet(i, j)` writes `levelPersistence[i *
 * 30 + j]`, so from L32 that is index 959, which is **L31 tag 29** — its
 * last slot. The flag is real, it is in a room the player left an hour ago,
 * and an exact-set assertion has to name it or the walk reports a clear
 * nobody can attribute.
 *
 * ⚠ `hits` IS ASSERTED FROM THE GAME'S OWN READOUT ON BOTH ARMS, which is
 * what the R5 batch added it for. Contact-freedom used to be inferred from
 * exactness; here it is two-sided — and it matters more than usual, because
 * `BobBoss.death` WRITES `player.hits = 0` on the last frame of every form
 * transition, so a mid-fight reading would have said nothing at all.
 */
export const BOBBOSS_FIRE = 'r5-bobboss-fire';
export const BOBBOSS_CONTROL = 'r5-bobboss-fire-control';

/** `FallRockLarge.fall()` — written on the ARM frame, not when it lands. */
export const ROCK_FLAG = Object.freeze({ level: 32, tag: 1 });
/** ⛔ `Fire.removed()`'s `setPersistence(-1, false)`, resolved. */
export const FIRE_OUT_OF_BAND_FLAG = Object.freeze({ level: 31, tag: 29 });

export function bobBossFindings(replayed) {
    const fire = replayed?.get(BOBBOSS_FIRE);
    const control = replayed?.get(BOBBOSS_CONTROL);
    if (!fire || !control) {
        return [{
            name: 'R5 BobBoss: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[fire && BOBBOSS_FIRE, control && BOBBOSS_CONTROL]
                .filter(Boolean).join(', ') || 'neither'} — "the walk ended holding fire" `
                + 'is not evidence that the sword did anything',
        }];
    }
    const found = [];
    const rock = `${ROCK_FLAG.level}:${ROCK_FLAG.tag}`;
    const oob = `${FIRE_OUT_OF_BAND_FLAG.level}:${FIRE_OUT_OF_BAND_FLAG.tag}`;
    const fireCleared = clearedSet(fire.status);
    const controlCleared = clearedSet(control.status);

    // 1. THE ITEM. `fire` is the first boolean on this arc that no pickup
    //    on any map grants — `BobBoss.death` spawns it at runtime — so
    //    `hasFire` true is the boss having died three times over.
    found.push({
        name: 'R5 BobBoss: the fire arm EARNED `hasFire`',
        ok: fire.status?.items?.hasFire === true,
        detail: fire.status?.items?.hasFire === true
            ? 'hasFire=true, and the tape granted only `sword` — `Fire` is spawned by '
                + '`BobBoss.death`, so it is in no level\'s pickup list and nothing but '
                + 'the third form dying puts it in the room'
            : 'hasFire is false — the fight did not finish. `BobBoss` is '
                + 'ONE-VISIT-OR-RESTART (`if (Player.hasFire) remove(this)` in the ctor '
                + 'and nowhere else), so a partial fight leaves nothing behind.',
    });
    found.push({
        name: 'R5 BobBoss: the CONTROL arm did not',
        ok: control.status?.items?.hasFire === false,
        detail: control.status?.items?.hasFire === false
            ? 'hasFire=false with the identical press train — so the presses are not '
                + 'what earned it, the SWORD is'
            : 'hasFire is TRUE in the arm with no sword. Something other than a sword '
                + 'killed the boss, and this pair proves nothing about combat.',
    });

    // 2. THE LEDGER, EXACT IN BOTH DIRECTIONS, and the out-of-band entry
    //    asserted BY NAME rather than absorbed into a count.
    const wantFire = [rock, oob];
    const fireMissing = wantFire.filter((k) => !fireCleared.has(k));
    const fireExtra = [...fireCleared].filter((k) => !wantFire.includes(k));
    found.push({
        name: 'R5 BobBoss: the fire arm\'s ledger is EXACTLY the rock and the '
            + 'out-of-band write',
        ok: fireMissing.length === 0 && fireExtra.length === 0,
        detail: fireMissing.length === 0 && fireExtra.length === 0
            ? `{${rock}} from \`FallRockLarge.fall()\` and {${oob}} from `
                + '`Fire.removed()` calling `setPersistence(-1, false)` in L32 — '
                + '`i * 30 + j` puts a tag of -1 in L31\'s LAST slot, and the tape '
                + 'declares no clears at all'
            : `missing ${JSON.stringify(fireMissing)}, unexpected `
                + `${JSON.stringify(fireExtra)}. {${oob}} missing means the reward was `
                + `never taken; {${rock}} missing means the rock never armed.`,
    });
    found.push({
        name: 'R5 BobBoss: the control arm cleared ONLY the rock',
        ok: controlCleared.size === 1 && controlCleared.has(rock),
        detail: controlCleared.size === 1 && controlCleared.has(rock)
            ? `{${rock}} and nothing else — the walk armed the rock with its feet, which `
                + 'both arms do, and never got past form 0'
            : `${controlCleared.size} flag(s) off (${[...controlCleared].join(' ')}). `
                + `A {${oob}} here would mean fire was earned without a sword.`,
    });

    // 3. THE TAKE-OVER, as a POSITIVE on one arm and its ABSENCE on the
    //    other. `BobBoss.death` sets `receiveInput = false` for each
    //    120-frame transition, so the fire arm must be taken over TWICE and
    //    the control arm — whose form 0 never dies — not at all.
    found.push({
        name: 'R5 BobBoss: the fire arm was TAKEN OVER by the form transitions',
        ok: fire.status?.saw_input_refused === true,
        detail: fire.status?.saw_input_refused === true
            ? 'receiveInput went false mid-tape — `BobBoss.death` holds it for 120 frames '
                + 'per transition and teleports the player to (80,120) for the last 40'
            : 'the game never refused input, so no form ever died and `hasFire` came '
                + 'from somewhere this pair does not account for',
    });
    found.push({
        name: 'R5 BobBoss: the control arm was never taken over',
        ok: control.status?.saw_input_refused === false,
        detail: control.status?.saw_input_refused === false
            ? 'receiveInput stayed true for all 2500 ticks — form 0 never died, so there '
                + 'was no transition to be taken over by'
            : 'the control arm WAS taken over, which means a form died without a sword',
    });

    // 4. NEITHER ARM WAS HIT — from the game's own readout, on a tape that
    //    stands still in a room with a boss swinging two spinning swords.
    //    ⚠ This is the check the R5 batch's `hits` field exists for, and it
    //    is also the one that would have been hardest to infer: a form
    //    transition RESETS `player.hits` to 0, so exactness would not have
    //    told us.
    for (const [label, a] of [['fire', fire], ['control', control]]) {
        const hits = a.status?.hits;
        found.push({
            name: `R5 BobBoss: the ${label} arm took no damage`,
            ok: hits === 0,
            detail: hits === 0
                ? 'hits=0 from the game\'s own readout, with `Bot.noDamage` armed — and '
                    + 'the walk stands inside two spinning sword lines for the whole fight'
                : `hits=${hits} — with the guard armed this should be impossible`,
        });
    }

    // 5. AND NEITHER ARM LEFT THE ROOM. The arena's stairs are sealed by
    //    the fallen rock and its pit by a burnable tree, so a terminal
    //    level other than 32 would mean an exit nobody has modelled.
    for (const [label, a] of [['fire', fire], ['control', control]]) {
        const end = terminal(a);
        found.push({
            name: `R5 BobBoss: the ${label} arm is still in the arena`,
            ok: end?.level === 32,
            detail: end?.level === 32
                ? `ends L32 (${end.x},${end.y}) — the rock seals the stairs and the `
                    + 'burnable tree seals the pit, so there is no way out yet'
                : `ends in L${end?.level} — the arena has an exit this slice has not `
                    + 'modelled',
        });
    }

    return found;
}

/**
 * ── Slice 4 step 3: KARLORE — the rung's HEADLINE PAIR ────────────────
 *
 * `fire` is the first combat-earned boolean on the arc, and this is it
 * DOING something. It is the cleanest shape on the ladder for that, because
 * fire is never spent here — it is HELD, and L48 builds differently:
 * `Karlore.added()` is `if (Player.hasFire) FP.world.remove(this)`, and
 * `NPC`'s constructor gives him `type = "Solid"` filling the one-tile
 * corridor north out of L48's arrival. A flood from that arrival reaches
 * TWO tiles with him there and 138 without.
 *
 * ⛔ AND THE ITEM HAS TO BE BANKED BEFORE THE LEVEL IS BUILT, which cost
 * two recordings to learn. `added()` runs inside `new Game(48, ...)`, so:
 *
 *   - a BOOT grant naming L48 is applied afterwards → both arms pinned;
 *   - a grant naming L48 on a walk that ENTERS L48 fires on the first
 *     observation whose level is 48, which is also afterwards → both arms
 *     pinned again, byte-identical, 62 observations each.
 *
 * The grant names **L47**, the level the walk boots into, so it fires at
 * tick 0 and the door is thirteen ticks later. §2.6.2's "hold fire BEFORE
 * entering" meant it literally, and a boot is not an entry.
 */
export const KARLORE_FIRE = 'r5-karlore-fire';
export const KARLORE_CONTROL = 'r5-karlore-plug';

/** `karlore@112,272`'s Solid — the face a fireless walk stops on. */
export const KARLORE_FACE_Y = 288;
/** Row 16's band, where the fire arm's inputs run out. */
export const KARLORE_THROUGH = Object.freeze({ top: 256, bottom: 272 });

export function karloreFindings(replayed) {
    const fire = replayed?.get(KARLORE_FIRE);
    const control = replayed?.get(KARLORE_CONTROL);
    if (!fire || !control) {
        return [{
            name: 'R5 Karlore: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[fire && KARLORE_FIRE, control && KARLORE_CONTROL]
                .filter(Boolean).join(', ') || 'neither'} — "the fire arm walked north" `
                + 'is not evidence that anything was ever in the way',
        }];
    }
    const found = [];
    const fEnd = terminal(fire);
    const cEnd = terminal(control);

    // 1. THE PIN AND THE PASS, one field apart. Both arms run the FIRE
    //    arm's own plan; only `grants` differs.
    const pinOk = !!cEnd && cEnd.level === 48
        && cEnd.y - 2 >= KARLORE_FACE_Y && cEnd.y - 2 < KARLORE_FACE_Y + 1;
    found.push({
        name: 'R5 Karlore: the control arm PINS on the plug',
        ok: pinOk,
        detail: !cEnd ? 'no terminal observation'
            : pinOk
                ? `ends L48 (${cEnd.x},${cEnd.y}) — box top ${(cEnd.y - 2).toFixed(2)} `
                    + `against karlore's south face at ${KARLORE_FACE_Y}`
                : `ends L48 y=${cEnd.y}, box top ${(cEnd.y - 2).toFixed(2)} — not a pin on `
                    + `${KARLORE_FACE_Y}. Past it means the plug was not built; short of `
                    + 'it means the walk stopped for some other reason.',
    });
    const throughOk = !!fEnd && fEnd.level === 48
        && fEnd.y >= KARLORE_THROUGH.top && fEnd.y < KARLORE_THROUGH.bottom;
    found.push({
        name: 'R5 Karlore: the fire arm WALKS THROUGH',
        ok: throughOk,
        detail: !fEnd ? 'no terminal observation'
            : throughOk
                ? `ends L48 (${fEnd.x},${fEnd.y}) — inside row 16, two rows short of the `
                    + 'water at row 14, which this walk holds no conch for'
                : fEnd.y >= KARLORE_THROUGH.bottom
                    ? `ends L48 y=${fEnd.y} — still south of row 16, so the plug was `
                        + 'still there. Was the grant banked BEFORE `new Game(48, ...)`?'
                    : `ends L48 y=${fEnd.y} — NORTH of row 16, which is row 14 or beyond `
                        + 'and that is water. Shorten the walk.',
    });

    // 2. THE ARMS DIFFER BY EXACTLY ONE ITEM, from the game's own report.
    const fItems = ITEM_BOOLEANS.filter((k) => fire.status?.items?.[k] === true);
    const cItems = ITEM_BOOLEANS.filter((k) => control.status?.items?.[k] === true);
    found.push({
        name: 'R5 Karlore: the two arms differ by exactly `fire`',
        ok: fItems.join(',') === 'hasFire' && cItems.length === 0,
        detail: fItems.join(',') === 'hasFire' && cItems.length === 0
            ? 'fire arm holds hasFire and nothing else; the control holds nothing — one '
                + 'field apart in the tape and one boolean apart in the game'
            : `fire arm [${fItems.join(',')}], control [${cItems.join(',')}] — the pair `
                + 'is only one field apart if the game agrees it is',
    });

    // 3. NEITHER ARM WROTE A FLAG. Karlore's tag is -1 and `NPC.removed()`
    //    writes no persistence at all, so a cleared flag here would be
    //    something else entirely.
    for (const [label, a] of [['fire', fire], ['control', control]]) {
        const cleared = clearedSet(a.status);
        found.push({
            name: `R5 Karlore: the ${label} arm cleared no flag`,
            ok: cleared.size === 0,
            detail: cleared.size === 0
                ? 'no flag off — karlore is tag -1 and `NPC.removed()` writes no '
                    + 'persistence, so the plug leaves no trace either way'
                : `${cleared.size} flag(s) off (${[...cleared].join(' ')})`,
        });
        found.push({
            name: `R5 Karlore: the ${label} arm took no damage`,
            ok: a.status?.hits === 0,
            detail: a.status?.hits === 0 ? 'hits=0' : `hits=${a.status?.hits}`,
        });
    }

    // 4. AND BOTH CROSSED THE SAME DOOR, at the same tick. The pair's whole
    //    value is that the two arms are the same walk until the plug — so
    //    the crossing has to be shared, and it is the crossing that banks
    //    the item in time.
    const hop = (a) => (a.stream?.transitions ?? [])
        .map((t) => `${t.t}:${t.from_level}->${t.to_level}`).join(' ');
    found.push({
        name: 'R5 Karlore: both arms cross L47 → L48 at the same tick',
        ok: hop(fire) === hop(control) && /^\d+:47->48$/.test(hop(fire)),
        detail: hop(fire) === hop(control) && /^\d+:47->48$/.test(hop(fire))
            ? `${hop(fire)} in both — and the fire arm's grant fired at tick 0 in L47, `
                + 'before `new Game(48, ...)` ran `Karlore.added()`'
            : `fire [${hop(fire)}] vs control [${hop(control)}] — the arms did not take `
                + 'the same door, so the difference between them is not the item',
    });

    return found;
}

/** Every R5 finding this sweep can make. */
export function r5AcceptanceFindings(replayed) {
    return [
        ...l60KillFindings(replayed),
        ...keyLegFindings(replayed),
        ...bobBossFindings(replayed),
        ...karloreFindings(replayed),
    ];
}
