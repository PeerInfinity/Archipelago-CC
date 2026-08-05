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

import { outOfBandFlagForWriter } from './outOfBandLedger.js';

export const L60_KILL = 'r5-l60-kill';
export const L60_CONTROL = 'r5-l60-kill-control';

/**
 * `lock@128,80`'s level and persistence tag, from the shipped census.
 *
 * ⚠ `rect` IS AN X BAND AND NOT A RECT, DELIBERATELY — said out loud here
 * because R5 slice 8's rect-input sweep had to decide whether it was an
 * oversight. It has no `y` and no `bottom` because the CLAIM has no y: the
 * lock spans its corridor, and all six uses below are scalar comparisons of
 * a player x against the near edge (the control walk must reach 128 and not
 * pass it) or the far one (the kill walk must end past 144). Handing it to
 * `rectsOverlap` would read `bottom` as `undefined` and answer "no"
 * forever, so `r5Acceptance.test.js` asserts it is y-less rather than
 * leaving the absence to look like a half-built rect somebody should
 * finish. See `feedback_rect_literal_never_overlaps`.
 */
export const L60_LOCK = Object.freeze({
    level: 60,
    tag: 0,
    rect: Object.freeze({ x: 128, right: 144, band: 'x-only — see the docblock' }),
});

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
/**
 * ⛔ `Fire.removed()`'s `setPersistence(-1, false)`, resolved.
 *
 * ⚠ DERIVED, NOT WRITTEN DOWN, since slice 5 step 0. It used to be the
 * literal `{31, 29}` with `breakableRocks.outOfBandFlagFor` asserted
 * against it — which keeps TWO members honest and says nothing about a
 * third. `outOfBandFlagForWriter` derives it from the WRITING ENTITY
 * (`Fire`, from L32, tag -1) against a registry that refuses an
 * unclassified class, so the family's next member arrives classified or
 * not at all. See `outOfBandLedger.js`.
 */
export const FIRE_OUT_OF_BAND_FLAG = outOfBandFlagForWriter({ as3: 'Fire', level: 32, tag: -1 });

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


// ─────────────────────────────────────────────────────────────────────
// ⛓ THE D5 WALK — the conch, and the chain paying for itself
// ─────────────────────────────────────────────────────────────────────

export const D5_CONCH = 'r5-d5-conch';

/** `Conch.removed()`'s two writes, and the level the walk ends in. */
export const D5_CONCH_FLAG = Object.freeze({ level: 49, tag: 0 });
/**
 * ⛓ WHERE THE WALK COMES TO REST, AND WHY IT IS AN ASSERTION.
 *
 * The residual southward velocity carried through the ceremony's freeze
 * slides the player off the conch's ice tile (2,5) into (2,6), which is
 * WATER — and water friction is what finally stops them. In this window
 * water is coerced; in the next it is armed and the conch is banked, so
 * the swim leg starts standing in it. That handoff is the reason the
 * terminal tile is a claim rather than a curiosity.
 */
export const D5_REST_TILE = Object.freeze({ tx: 2, ty: 6 });

/**
 * The D5 walk's findings.
 *
 * ⚠ THIS IS NOT A PAIR, and the reason is worth stating rather than
 * leaving as an omission. Every OPENED-BLOCKER claim on this arc needs a
 * shut-before control — and this walk opens no blocker. The one thing in
 * its way is `karlore@112,272`, whose shut-before control is
 * `r5-karlore-plug`, already recorded and already asserted. What this walk
 * claims is a COLLECTION, and a collection's two-sided evidence is the item
 * the game reports and the flag `removed()` wrote: an arm that walked the
 * corridor and did not take the conch fails both.
 *
 * @param {Map<string,{stream,status}>} replayed
 */
export function d5ConchFindings(replayed) {
    const walk = replayed?.get(D5_CONCH);
    if (!walk) {
        return [{
            name: 'R5 D5 walk: SKIPPED — this sweep did not replay it',
            ok: true,
            skipped: true,
            detail: `run --only=${D5_CONCH} (or --tier=full) to assert the conch`,
        }];
    }
    const found = [];
    const st = walk.status;
    const end = terminal(walk);

    // 1. THE ITEM, from the game's own inventory readout — and the negative
    //    half with it. `fire` is the boot grant this walk could not have
    //    been planned without; `canSwim` is what it went to get; and
    //    NOTHING ELSE may be true, because five doors of corridor is five
    //    doors of chances to walk over something.
    const held = ITEM_BOOLEANS.filter((k) => st?.items?.[k] === true).sort();
    const want = ['canSwim', 'hasFire'];
    found.push({
        name: 'R5 D5: the walk ends holding EXACTLY fire and the conch',
        ok: held.join(',') === want.join(','),
        detail: held.join(',') === want.join(',')
            ? 'canSwim + hasFire, and nothing else — the boot grant it needed to pass '
                + 'karlore, and the item it went five doors to take'
            : `the game reports [${held.join(',')}], expected [${want.join(',')}]`,
    });

    // 2. THE LEDGER. `Conch.removed()` is `canSwim = true` AND
    //    `setPersistence(tag, false)`, so the flag is the second half of the
    //    same line — and an EXACT set, because a walk that collected
    //    something else on the way would show it here and nowhere else.
    const cleared = clearedSet(st);
    const flag = `${D5_CONCH_FLAG.level}:${D5_CONCH_FLAG.tag}`;
    found.push({
        name: 'R5 D5: the conch\'s flag is off, and it is the ONLY one',
        ok: cleared.size === 1 && cleared.has(flag),
        detail: cleared.size === 1 && cleared.has(flag)
            ? `{${flag}} off and nothing else — \`Conch.removed()\` writes the boolean `
                + 'and the flag on the same line, so this is the same event seen twice'
            : `${cleared.size} flag(s) off: [${[...cleared].join(' ')}], expected exactly `
                + `{${flag}}`,
    });

    // 3. ⛓ WHERE IT STOPS. The swim leg's starting line, asserted as a TILE
    //    rather than as a position: the exact pixel is the recording's and
    //    the claim is which tile it is standing on.
    const tile = end ? { tx: Math.floor(end.x / 16), ty: Math.floor(end.y / 16) } : null;
    const restOk = !!end && end.level === D5_CONCH_FLAG.level
        && tile.tx === D5_REST_TILE.tx && tile.ty === D5_REST_TILE.ty;
    found.push({
        name: 'R5 D5: it comes to rest on the WATER tile below the conch',
        ok: restOk,
        detail: !end ? 'no terminal observation'
            : restOk
                ? `ends L${end.level} (${end.x},${end.y}) = tile `
                    + `(${tile.tx},${tile.ty}) — water, coerced in this window and armed `
                    + 'in the next, with the conch already banked'
                : `ends L${end.level} tile (${tile?.tx},${tile?.ty}), not `
                    + `(${D5_REST_TILE.tx},${D5_REST_TILE.ty}). The slide off the ice is `
                    + 'what puts the walk there; a different tile means the coast or the '
                    + 'ceremony left a different velocity, and the swim leg does not '
                    + 'start where this walk says it does.',
    });

    // 4. THE PIT IS A TRANSPORT, and the game agrees. `checkFallingInPit`
    //    sets `receiveInput = false` for the fall, so the refusal is the
    //    mechanic working — asserted here as a POSITIVE rather than left to
    //    the harness's two-sided check, because the pit at (11,3) is the
    //    only way out of L48 and a walk that took a different route would
    //    otherwise pass everything above.
    const hops = (walk.stream?.transitions ?? [])
        .map((t) => `${t.from_level}->${t.to_level}`).join(' ');
    const wantHops = '44->45 45->46 46->47 47->48 48->49';
    found.push({
        name: 'R5 D5: five doors and a pit, in that order',
        ok: hops === wantHops,
        detail: hops === wantHops
            ? `${hops} — and the last one is the pit at (11,3), not a door`
            : `the walk crossed [${hops}], expected [${wantHops}]`,
    });
    found.push({
        name: 'R5 D5: the game refused input for the pit transport',
        ok: st?.saw_input_refused === true,
        detail: st?.saw_input_refused === true
            ? '`checkFallingInPit` sets receiveInput = false for the fall, so the refusal '
                + 'is the transport firing'
            : 'the game never refused input, so the fall never happened and L48 was left '
                + 'some other way',
    });

    // 5. AND NOTHING DROWNED. The whole window coerces water — this is the
    //    last walk on the arc that does — so a non-zero timer here would
    //    mean the coercion did not reach the resolver.
    found.push({
        name: 'R5 D5: the coerced water never started the timer',
        ok: st?.drown_timer === 0,
        detail: st?.drown_timer === 0
            ? 'drownTimer 0 across 1,677 ticks, most of them over water tiles — which is '
                + 'what `noHazards: ["water"]` is supposed to buy and the last walk that '
                + 'buys it'
            : `drownTimer=${st?.drown_timer} on a window that coerces water`,
    });

    return found;
}


// ─────────────────────────────────────────────────────────────────────
// ⛓ ARMED WATER — the pair, and the swim term's live stratum
// ─────────────────────────────────────────────────────────────────────

export const SWIM_CROSS = 'r5-swim-cross';
export const SWIM_DROWN = 'r5-swim-drown';
export const SWIM_LATCH_NAME = 'r5-swim-latch';

/** `Player.as:312` and `Player.as:530`'s addend, as the claims' own numbers. */
export const SWIM_DROWN_TIMER_MAX = 10;
export const SWIM_BOOST = 0.25;
/** The plain water step the boost is measured AGAINST. */
export const SWIM_STEADY_STEP = 0.45;
/** The two ticks the latch claim reads, from `r5Swim.SWIM_LATCH`. */
export const SWIM_LATCH_TICKS = Object.freeze({ steady: 166, latched: 260 });

/**
 * ⛓ THE ARMED-WATER PAIR.
 *
 * ⚠ AND ITS EVIDENCE IS NOT IN THE STREAMS. `checkDrowning` does not touch
 * movement until `drowning` latches at the eleventh cumulative contact
 * tick, and neither arm gets past seven — so the two arms produce
 * BYTE-IDENTICAL observations and the whole difference between them is a
 * counter inside the game. That is unusual enough to state as a check of
 * its own: a pair whose streams differed would mean one arm had latched,
 * which is a different experiment.
 */
export function swimPairFindings(replayed) {
    const cross = replayed?.get(SWIM_CROSS);
    const drown = replayed?.get(SWIM_DROWN);
    if (!cross || !drown) {
        return [{
            name: 'R5 swim pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[cross && SWIM_CROSS, drown && SWIM_DROWN].filter(Boolean).join(', ') || 'neither'} `
                + '— "the swimmer crossed water" is not evidence that the water was armed',
        }];
    }
    const found = [];

    // 1. ⛓ THE CLAIM. The timer is the game's own accounting of standing on
    //    an unprotected hazard, and it is the ONLY thing that separates
    //    these two tapes.
    const t = drown.status?.drown_timer;
    const contact = Number.isFinite(t) && t > 0 ? SWIM_DROWN_TIMER_MAX - t + 1 : 0;
    found.push({
        name: 'R5 swim: the conch-less arm DROWNED — water is armed',
        ok: contact > 0,
        detail: contact > 0
            ? `drownTimer=${t}, i.e. ${contact} cumulative tick(s) on LIVE water. That `
                + 'number cannot exist if `noHazards` still carried "water", if the walk '
                + 'never reached the tile, or if the conch were held anyway.'
            : `drownTimer=${t} — the thrash never fired, so this arm is not a witness to `
                + 'armed water and the pair proves nothing',
    });
    found.push({
        name: 'R5 swim: ...and it did NOT die',
        ok: contact > 0 && contact < SWIM_DROWN_TIMER_MAX + 1,
        detail: contact > 0 && contact < SWIM_DROWN_TIMER_MAX + 1
            ? `${contact} of the eleven-tick budget — the tape leaves the water with four `
                + 'ticks to spare, because a dead player\'s stream is a respawn'
            : `${contact} tick(s) against a budget of ${SWIM_DROWN_TIMER_MAX + 1}`,
    });
    found.push({
        name: 'R5 swim: the conch arm\'s timer never started',
        ok: cross.status?.drown_timer === 0,
        detail: cross.status?.drown_timer === 0
            ? '`checkDrowning`\'s water arm is `eff == 1 && !canSwim`, so the conch takes '
                + 'the early return on the same tiles that moved the other arm\'s timer'
            : `drownTimer=${cross.status?.drown_timer} on the arm that holds the conch`,
    });

    // 2. ONE FIELD APART, AND ONE BOOLEAN APART IN THE GAME.
    const items = (a) => ITEM_BOOLEANS.filter((k) => a.status?.items?.[k] === true).sort();
    const ci = items(cross).join(',');
    const di = items(drown).join(',');
    found.push({
        name: 'R5 swim: the arms differ by exactly `conch`',
        ok: ci === 'canSwim,hasFire' && di === 'hasFire',
        detail: ci === 'canSwim,hasFire' && di === 'hasFire'
            ? 'cross holds canSwim + hasFire; drown holds hasFire alone'
            : `cross [${ci}], drown [${di}]`,
    });

    // 3. ⚠ AND THE STREAMS ARE THE SAME, which is the check that says the
    //    timer is the only difference rather than merely the one we looked at.
    const ticksOf = (a) => (a.stream?.ticks ?? [])
        .map((o) => `${o.t}:${o.level}:${o.x}:${o.y}`).join('|');
    const same = ticksOf(cross) === ticksOf(drown);
    found.push({
        name: 'R5 swim: the two streams are BYTE-IDENTICAL',
        ok: same,
        detail: same
            ? `${cross.stream?.ticks?.length} observations each, identical — drowning does `
                + 'not touch movement until it latches, so `drown_timer` is not merely the '
                + 'best evidence here, it is the only evidence'
            : 'the arms moved differently. Before `drowning` latches there is no positional '
                + 'effect at all, so a difference means one arm latched — a different '
                + 'experiment from the one this pair declares.',
    });
    return found;
}

/**
 * ⛓ THE SWIM TERM, INCLUDING THE CHANNEL-LIFECYCLE LATCH.
 *
 * ⚠ PHRASED OVER THE MOVEMENT, NOT THE READOUT, and that is forced rather
 * than chosen. `Sfx.onComplete` zeroes `_position`, so `botStatus.sound_pin`
 * reports a COMPLETED channel as `{playing:false, frames:0}` — exactly what
 * it reports for one that never played. A claim phrased over the readout
 * would be satisfied by a run that never entered the water.
 *
 * What the movement says: a mid-cycle swimming tick steps 0.450, and the
 * first tick after a 90-tick stop steps 0.700. The difference is 0.250,
 * which is `Player.as:530`'s `0.25 * int(soundPosition("Swim") < 0.1)`
 * exactly — and it can only be there if the channel COMPLETED during the
 * stop and was not replayed, because `Player.as:531` gates the replay on
 * `v.length > 0`.
 */
export function swimLatchFindings(replayed) {
    const leg = replayed?.get(SWIM_LATCH_NAME);
    if (!leg) {
        return [{
            name: 'R5 swim latch: SKIPPED — this sweep did not replay it',
            ok: true,
            skipped: true,
            detail: `run --only=${SWIM_LATCH_NAME} to assert the swim term`,
        }];
    }
    const ticks = leg.stream?.ticks ?? [];
    // Observation t is the state after t ticks (RECORD-THEN-ACT), so the
    // displacement PRODUCED BY tick t is observations t+1 minus t.
    const stepAt = (t) => (ticks[t + 1] && ticks[t] ? ticks[t].y - ticks[t + 1].y : null);
    const steady = stepAt(SWIM_LATCH_TICKS.steady);
    const latched = stepAt(SWIM_LATCH_TICKS.latched);
    const found = [];
    if (steady === null || latched === null) {
        return [{
            name: 'R5 swim latch: the stream is long enough to read both ticks',
            ok: false,
            detail: `${ticks.length} observation(s); the claim reads `
                + `${SWIM_LATCH_TICKS.steady} and ${SWIM_LATCH_TICKS.latched}`,
        }];
    }
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    found.push({
        name: 'R5 swim latch: a mid-cycle swimming tick steps the plain water speed',
        ok: near(steady, SWIM_STEADY_STEP),
        detail: near(steady, SWIM_STEADY_STEP)
            ? `tick ${SWIM_LATCH_TICKS.steady} steps ${steady} px — the channel is open and `
                + 'past frame 5, so there is no boost and this is the baseline the claim '
                + 'below is measured against'
            : `tick ${SWIM_LATCH_TICKS.steady} steps ${steady} px, not ${SWIM_STEADY_STEP}. `
                + 'Either that tick is not mid-cycle any more or the water speed moved, and '
                + 'either way the difference below is being measured against the wrong thing.',
    });
    found.push({
        name: '⛓ R5 swim latch: the first tick after a 90-tick stop is BOOSTED',
        ok: near(latched - steady, SWIM_BOOST),
        detail: near(latched - steady, SWIM_BOOST)
            ? `tick ${SWIM_LATCH_TICKS.latched} steps ${latched} px against the `
                + `${steady} of a mid-cycle tick — a difference of ${SWIM_BOOST}, which is `
                + '`Player.as:530`\'s addend exactly. It can only be there if the channel '
                + 'COMPLETED during the stop and was never replayed: `Sfx.onComplete` '
                + 'zeroes the position, `Player.as:531` gates the replay on `v.length > 0`, '
                + 'and a stopped swimmer fails it. The boost LATCHES.'
            : `tick ${SWIM_LATCH_TICKS.latched} steps ${latched} px, exceeding the `
                + `mid-cycle ${steady} by ${latched - steady} rather than ${SWIM_BOOST}. `
                + 'The whole claim is that a completed, un-replayed channel reads 0 and the '
                + 'boost latches — if this is not the addend, it is not the boost.',
    });
    found.push({
        name: 'R5 swim latch: it swam armed water for 310 ticks without drowning',
        ok: leg.status?.drown_timer === 0 && leg.status?.items?.canSwim === true,
        detail: `drownTimer=${leg.status?.drown_timer}, canSwim=${leg.status?.items?.canSwim}`
            + ' — `noHazards` on this tape is ["waterfall"] only, so every one of those '
            + 'ticks was on live water',
    });
    return found;
}


// ─────────────────────────────────────────────────────────────────────
// ⛓ THE ARMED WATERFALL — `climbsArmedWaterfall`'s live witness
// ─────────────────────────────────────────────────────────────────────

export const WF_SHUT = 'r5-waterfall-shut';
export const WF_CLIMB = 'r5-waterfall-climb';
/** `new Game(0, 208, 144)` puts the player at y = 152. */
export const WF_START_Y = 152;
/** L0's `waterfall@208,112` occupies row 7; the ground above it is row 2. */
export const WF_FACE_ROW = 7;
export const WF_CLIMB_ROW = 2;

/**
 * ⛓ THE RULE IS A REFUSAL, SO THE EVIDENCE HAS TO BE ONE.
 *
 * `Player.input()` ends with `v.y += 0.8` on a waterfall tile, exempted for
 * upward motion only and only with the feather. The planner has encoded
 * that as its one DIRECTED edge rule since R4 and it has never had a live
 * witness — R3 stood on this very tile with it COERCED, and R4 armed it
 * while the swim term was hard-coded to zero.
 *
 * ⚠ AND THE EXEMPTING ARM ALONE PROVES NOTHING. "The feather-holder
 * climbed" is equally consistent with a game in which nothing was pushing
 * down. Both arms, one field apart, or neither.
 *
 * ⚠⚠ AND THE SWIM TERM IS LIVE ON THE TILE. `hazardFlagsFor`'s `inWater` is
 * `eff == 1 || eff == 25`, so the refusing arm gets the +0.25 boost ON the
 * waterfall and still cannot climb it: 0.45 + 0.25 is under 0.8. R4's
 * recorded "3.33 px DOWN" was measured with that term at zero.
 */
export function waterfallPairFindings(replayed) {
    const shut = replayed?.get(WF_SHUT);
    const climb = replayed?.get(WF_CLIMB);
    if (!shut || !climb) {
        return [{
            name: 'R5 waterfall pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[shut && WF_SHUT, climb && WF_CLIMB].filter(Boolean).join(', ') || 'neither'} `
                + '— "the feather-holder climbed" is not evidence that anything was pushing down',
        }];
    }
    const found = [];
    const rowOf = (a) => { const e = terminal(a); return e ? Math.floor(e.y / 16) : null; };
    const netOf = (a) => { const e = terminal(a); return e ? WF_START_Y - e.y : null; };
    const sRow = rowOf(shut);
    const cRow = rowOf(climb);

    // 1. ⛓ THE REFUSAL. The arm reaches the waterfall's own row and is held
    //    there — the claim is not "it did not climb", which a walk that
    //    never arrived would also satisfy.
    const onFace = (shut.stream?.ticks ?? [])
        .filter((o) => Math.floor(o.y / 16) === WF_FACE_ROW).length;
    found.push({
        name: '⛓ R5 waterfall: the FEATHERLESS arm reaches the face and STALLS',
        ok: sRow === WF_FACE_ROW && onFace >= 20,
        detail: sRow === WF_FACE_ROW && onFace >= 20
            ? `ends in row ${sRow} after ${onFace} observation(s) in the waterfall's own `
                + `row, ${netOf(shut)?.toFixed(2)} px up from the boot — it swam the water `
                + 'below, arrived at the face, and `v.y += 0.8` held it there'
            : sRow !== WF_FACE_ROW
                ? `ends in row ${sRow}, not ${WF_FACE_ROW}. Past it means the waterfall did `
                    + 'not push; short of it means the arm never reached the face, and a '
                    + 'refusal proved by a walk that never got there is not a refusal.'
                : `only ${onFace} observation(s) in row ${WF_FACE_ROW} — the arm passed `
                    + 'through rather than being held',
    });

    // 2. THE EXEMPTION. Same tape, same hold, one boolean.
    found.push({
        name: 'R5 waterfall: the FEATHER arm climbs through',
        ok: cRow === WF_CLIMB_ROW,
        detail: cRow === WF_CLIMB_ROW
            ? `ends in row ${cRow}, ${netOf(climb)?.toFixed(2)} px up — through the tile `
                + 'and out onto the ground above it'
            : `ends in row ${cRow}, not ${WF_CLIMB_ROW}`,
    });

    // 3. AND THE TWO ARE FAR APART. A pair whose arms differ by a little is
    //    a pair whose difference could be anything.
    const s = netOf(shut) ?? 0;
    const c = netOf(climb) ?? 0;
    found.push({
        name: 'R5 waterfall: the exempting arm goes MULTIPLES further',
        ok: c > s * 4,
        detail: `${c.toFixed(2)} px against ${s.toFixed(2)} px — the same 178-tick hold, `
            + `and the only difference between the tapes is \`hasFeather\``,
    });

    // 4. ONE FIELD APART, from the game's own item readout — and BOTH arms
    //    hold the conch, because both are swimmers.
    const items = (a) => ITEM_BOOLEANS.filter((k) => a.status?.items?.[k] === true).sort();
    const si = items(shut).join(',');
    const ci = items(climb).join(',');
    found.push({
        name: 'R5 waterfall: the arms differ by exactly `feather`',
        ok: si === 'canSwim' && ci === 'canSwim,hasFeather',
        detail: si === 'canSwim' && ci === 'canSwim,hasFeather'
            ? 'both hold the conch — the tiles above and below the waterfall are WATER, so '
                + 'both arms are swimmers — and only one holds the feather'
            : `shut [${si}], climb [${ci}]`,
    });

    // 5. ⛔ AND NOTHING WAS COERCED. The check that stops this pair from
    //    being two walks on a floor: `noHazards` is EMPTY on both tapes, so
    //    a zero drown timer here is `checkDrowning`'s canSwim arm and the
    //    0.8 push is the real one.
    for (const [label, a] of [['shut', shut], ['climb', climb]]) {
        found.push({
            name: `R5 waterfall: the ${label} arm never drowned, on UNCOERCED water`,
            ok: a.status?.drown_timer === 0,
            detail: a.status?.drown_timer === 0
                ? 'drownTimer 0 with `noHazards` EMPTY — the first tape on the arc with no '
                    + 'coercion anywhere, so this is the conch working rather than a crutch'
                : `drownTimer=${a.status?.drown_timer}`,
        });
    }
    return found;
}

/** Every R5 finding this sweep can make. */
/**
 * ── Slice 5: THE FEATHER, and the arithmetic the game hands back ──────
 *
 * Four claims, and the fourth is the one that could not have been written
 * before the walk ran.
 *
 * 1. THE ITEM, and an EXACT set. Four levels of corridor is four levels of
 *    chances to walk over something.
 * 2. THE LEDGER, in TWO halves that arrive by different routes:
 *    `Feather.removed()`'s own {89,0}, and {91,29} — which is `L92 * 30 - 1`,
 *    the out-of-band slot BOTH of L92's `tag = -1` rocks write. Two rocks,
 *    one flag, and it is in a level the walk only passed through.
 * 3. WHERE IT STOPS: inside the feather's pocket, which is the tile the
 *    flip window holds UP from.
 * 4. ⛓⛓ THE DEAD-FRAME ARITHMETIC, which is the sound pin's independent
 *    confirmation. The game reports **231** fade frames for this tape:
 *    21 (the boot) + 3 x 20 (the doors) + 150 (`Pickup.specialTimer`). The
 *    first recording — the one whose ceremony never fired — reported **81**,
 *    which is the same sum without the ceremony. Those are the two constants
 *    `swimSoundClock.LOAD_DEAD_FRAMES` and `CEREMONY_FREEZE_FRAMES` are
 *    derived from, measured back from the game rather than assumed, and the
 *    whole reason this walk's stream matches at all.
 */
export const FEATHER_WALK_NAME = 'r5-feather';
/** `Feather.removed()`'s own clear. */
export const FEATHER_FLAG = Object.freeze({ level: 89, tag: 0 });
/** ⛔ `BreakableRock.endAnim()` x2 in L92, both `tag = -1` — `92 * 30 - 1`. */
export const ROCK_OUT_OF_BAND_FLAG = Object.freeze({ level: 91, tag: 29 });
/** The fade-frame sum: boot + three doors + the pickup freeze. */
export const FEATHER_DEAD_FRAMES = Object.freeze({
    boot: 21, perDoor: 20, doors: 3, ceremony: 150,
    get total() { return this.boot + this.perDoor * this.doors + this.ceremony; },
});

export function featherFindings(replayed) {
    const walk = replayed?.get(FEATHER_WALK_NAME);
    if (!walk) {
        return [{
            name: 'R5 feather: SKIPPED — this sweep did not replay it',
            ok: true,
            skipped: true,
            detail: `run --only=${FEATHER_WALK_NAME} (or --tier=full) to assert the feather`,
        }];
    }
    const found = [];
    const st = walk.status;
    const end = terminal(walk);

    const held = ITEM_BOOLEANS.filter((k) => st?.items?.[k] === true).sort();
    const want = ['canSwim', 'hasFeather', 'hasSword'];
    found.push({
        name: 'R5 feather: the walk ends holding EXACTLY the sword, the conch and the feather',
        ok: held.join(',') === want.join(','),
        detail: held.join(',') === want.join(',')
            ? 'the two probe grants it needed (the sword for L92\'s rocks, the conch for '
                + 'L89\'s pools) and the one item it went four levels to take'
            : `the game reports [${held.join(',')}], expected [${want.join(',')}]`,
    });

    const cleared = clearedSet(st);
    const feather = `${FEATHER_FLAG.level}:${FEATHER_FLAG.tag}`;
    const oob = `${ROCK_OUT_OF_BAND_FLAG.level}:${ROCK_OUT_OF_BAND_FLAG.tag}`;
    found.push({
        name: 'R5 feather: the ledger is the feather AND the rocks\' out-of-band flag',
        ok: cleared.size === 2 && cleared.has(feather) && cleared.has(oob),
        detail: cleared.size === 2 && cleared.has(feather) && cleared.has(oob)
            ? `{${feather}} from \`Feather.removed()\` and {${oob}} from `
                + '`BreakableRock.endAnim()` — TWO rocks, both `tag = -1`, and '
                + '`setPersistence(-1, false)` from L92 is `92 * 30 - 1`, which is L91\'s '
                + 'last slot. One flag for two writes, in a level the walk only passed '
                + 'through.'
            : `${cleared.size} flag(s) off: [${[...cleared].join(' ')}], expected exactly `
                + `{${feather}} and {${oob}}`,
    });

    const tile = end ? { tx: Math.floor(end.x / 16), ty: Math.floor(end.y / 16) } : null;
    found.push({
        name: 'R5 feather: it comes to rest INSIDE the pocket',
        ok: !!tile && tile.tx === 10 && tile.ty === 6 && end.level === 89,
        detail: tile
            ? `L${end.level} tile (${tile.tx},${tile.ty}) — the flip window holds UP from `
                + 'here, and it can only cross the waterfall above the pocket from inside it'
            : 'the walk produced no terminal observation',
    });

    // ⛓⛓ THE PIN'S OWN ARITHMETIC, from the game's dead-frame counter.
    const df = st?.dead_frames;
    found.push({
        name: 'R5 feather: the fade frames add up to the two pinned constants',
        ok: df === FEATHER_DEAD_FRAMES.total,
        detail: df === FEATHER_DEAD_FRAMES.total
            ? `${df} = ${FEATHER_DEAD_FRAMES.boot} (boot) + ${FEATHER_DEAD_FRAMES.doors} x `
                + `${FEATHER_DEAD_FRAMES.perDoor} (doors) + ${FEATHER_DEAD_FRAMES.ceremony} `
                + '(`Pickup.specialTimer`) — the frames the MIXER steps on and the tape '
                + 'does not, which is what `swimSoundClock.LOAD_DEAD_FRAMES` and '
                + '`CEREMONY_FREEZE_FRAMES` are for. The first recording of this tape, '
                + 'whose ceremony never fired, reported 81: the same sum minus the freeze.'
            : `the game reports ${df} fade frame(s) and the two constants predict `
                + `${FEATHER_DEAD_FRAMES.total}. The swim channel advances on every one of `
                + 'them, so a mismatch here is the model and the mixer drifting apart.',
    });

    return found;
}


/**
 * ── ⛓⛓ THE TOTEM ENTRANCE PAIR — declared at §18, recorded at slice 9 ──
 *
 * The first tape on the arc to drive a `Pulser`, a `Chest` or a
 * `SealPiece`, and the first to open a room that was not reachable at all.
 * Four claims, and the fourth is the one that could only be made by
 * subtraction.
 *
 * 1. THE PIN. The control holds UP for four hundred ticks and does not
 *    move a tile: `wandlock@144,592` is built because {39,8} was never
 *    written. The press arm's identical span carries it 208 px north.
 * 2. THE LEDGER, as an exact set, and it is not the entrance write alone.
 *    Both arms carry the arrival button's {37,4}+{38,5} and the chest's
 *    {38,1}; the press arm adds {39,8} AND {38,4}, because a `room >= 0`
 *    ButtonRoom writes the named room's TSET *and* its own TAG.
 * 3. WHERE THE PRESS ARM STOPS — tile (9,25), which §21.6 measured as the
 *    only reachable stance that touches `rope@96,384`. The shaft leg
 *    starts where this one ends, and nobody arranged that.
 * 4. ⛓⛓ THE DEAD FRAMES, DECOMPOSED. The game reports **370** for both
 *    arms. `FEATHER_DEAD_FRAMES`'s constants would predict 21 + 20 + 150
 *    = 191 plus an unexplained 179, which is how this nearly became a
 *    correction to `sealControllerTicks()`. It is not one:
 *    `r5-l38-fade-boot` and `r5-l38-fade-door` measure this level's own
 *    load costs as **20 and 19**, so the ceremony's share is 370 - 39 =
 *    **331** — exactly `CEREMONY_DEAD_FRAMES.total`, 150 of
 *    `Pickup.specialTimer` and 181 of a `SealController` derived from its
 *    own loop and never before driven.
 *
 *    ⚠ **AND THAT MAKES A CONSTANT INTO A VARIABLE.** A load's dead-frame
 *    cost is not 20: `r5-feather` measured 21 for its boot and 20 per
 *    door, and L38 measures 20 and 19. `blackCover`'s countdown and the
 *    frame `Bot.update` samples it on are two clocks with a phase between
 *    them. Nothing on this rung depends on it — neither arm swims — but
 *    `swimSoundClock.LOAD_DEAD_FRAMES` advances the PINNED channel by
 *    exactly this number across a door, so a tape that swims after one is
 *    a tick of mixer position out. Named rather than fixed: fixing it
 *    needs a measurement per level, and the fixture that would show it
 *    does not exist yet.
 */
export const TOTEM_ENTRANCE_WALK = Object.freeze({
    press: 'r5-totem-entrance',
    control: 'r5-totem-entrance-control',
    /** Both arms, from the game. */
    deadFrames: 370,
    /** …attributed, by the two fade probes rather than by another tape's constants. */
    load: Object.freeze({ boot: 20, door: 19, get total() { return this.boot + this.door; } }),
    ceremony: 331,
    pinnedTile: Object.freeze({ tx: 9, ty: 38 }),
    ropeStanceTile: Object.freeze({ tx: 9, ty: 25 }),
    shared: Object.freeze(['37:4', '38:0', '38:1', '38:3', '38:5']),
    entranceWrites: Object.freeze(['38:4', '39:8']),
});

export function totemEntranceFindings(replayed) {
    const press = replayed?.get(TOTEM_ENTRANCE_WALK.press);
    const control = replayed?.get(TOTEM_ENTRANCE_WALK.control);
    if (!press || !control) {
        return [{
            name: 'R5 totem entrance: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[press && TOTEM_ENTRANCE_WALK.press,
                control && TOTEM_ENTRANCE_WALK.control].filter(Boolean).join(', ') || 'neither'} `
                + '— "the walk reached L39" is not evidence that anything was ever in the way',
        }];
    }
    const found = [];
    const tileOf = (arm) => {
        const end = terminal(arm);
        return end ? { level: end.level, tx: Math.floor(end.x / 16), ty: Math.floor(end.y / 16) } : null;
    };
    const pt = tileOf(press);
    const ct = tileOf(control);

    found.push({
        name: 'R5 totem entrance: the CONTROL is pinned one tile short of the wandlock',
        ok: !!ct && ct.level === 39 && ct.ty === TOTEM_ENTRANCE_WALK.pinnedTile.ty,
        detail: ct
            ? `L${ct.level} tile (${ct.tx},${ct.ty}) after 400 ticks of UP — `
                + '`wandlock@144,592` is `tSet -1`, which on a Lock means '
                + '`totalEnemies() <= 0`, and the three spinners that would clear it are '
                + 'thirty tiles up on the FAR SIDE of it. The button in the previous room '
                + 'is the only opener, and this arm did not stand on it.'
            : 'the control produced no terminal observation',
    });
    found.push({
        name: 'R5 totem entrance: …and the PRESS arm walks through where it stood',
        ok: !!pt && !!ct && pt.level === 39 && pt.ty < ct.ty,
        detail: pt && ct
            ? `the same span carries it to tile (${pt.tx},${pt.ty}) — ${ct.ty - pt.ty} tiles `
                + 'north of the pin. One target apart: two seconds on `buttonroom@32,48`.'
            : 'one of the arms produced no terminal observation',
    });
    found.push({
        name: '⛓⛓ R5 totem entrance: it comes to rest ON THE ROPE\'S OWN STANCE',
        ok: !!pt && pt.tx === TOTEM_ENTRANCE_WALK.ropeStanceTile.tx
            && pt.ty === TOTEM_ENTRANCE_WALK.ropeStanceTile.ty,
        detail: pt
            ? `tile (${pt.tx},${pt.ty}) against §21.6's (`
                + `${TOTEM_ENTRANCE_WALK.ropeStanceTile.tx},`
                + `${TOTEM_ENTRANCE_WALK.ropeStanceTile.ty}) — the ONLY reachable stance `
                + 'that touches `rope@96,384`, measured a slice before this walk existed. '
                + 'The shaft leg begins where this tape ends.'
            : 'no terminal observation',
    });

    // ── the ledgers, as exact sets ────────────────────────────────────
    for (const [label, arm, want] of [
        ['control', control, TOTEM_ENTRANCE_WALK.shared],
        ['press', press, [...TOTEM_ENTRANCE_WALK.shared, ...TOTEM_ENTRANCE_WALK.entranceWrites]],
    ]) {
        const got = [...clearedSet(arm.status)].sort();
        const expect = [...want].sort();
        found.push({
            name: `R5 totem entrance: the ${label} arm's ledger is an EXACT set`,
            ok: JSON.stringify(got) === JSON.stringify(expect),
            detail: JSON.stringify(got) === JSON.stringify(expect)
                ? `[${got.join(' ')}] — {37,4}+{38,5} from the arrival button (BOTH arms `
                    + 'press it, R1 met it first), {38,0}+{38,3} from the two `room = -1` '
                    + 'self-latches whose own-tag write is OUTSIDE the room branch, and '
                    + '{38,1} from `Chest.open()`'
                    + (label === 'press'
                        ? ' — plus {39,8}, which deletes the wandlock, and {38,4}, which is '
                            + 'the same `set activate` writing its OWN tag. Two writes from '
                            + 'one press; a count would have said one.'
                        : '. ⚠ Not empty, which is why an exact set had to name it.')
                : `the game reports [${got.join(' ')}] and the declaration says `
                    + `[${expect.join(' ')}]`,
        });
    }

    // ── ⛓⛓ the dead frames, and the subtraction that attributed them ──
    const boot = replayed?.get('r5-l38-fade-boot');
    const door = replayed?.get('r5-l38-fade-door');
    for (const [label, arm] of [['press', press], ['control', control]]) {
        found.push({
            name: `R5 totem entrance: the ${label} arm reports ${TOTEM_ENTRANCE_WALK.deadFrames} dead frames`,
            ok: arm.status?.dead_frames === TOTEM_ENTRANCE_WALK.deadFrames,
            detail: arm.status?.dead_frames === TOTEM_ENTRANCE_WALK.deadFrames
                ? `${TOTEM_ENTRANCE_WALK.deadFrames} = ${TOTEM_ENTRANCE_WALK.load.total} `
                    + `(a boot and a door, MEASURED) + ${TOTEM_ENTRANCE_WALK.ceremony} `
                    + '(the ceremony) — and the ceremony is 150 of `Pickup.specialTimer` '
                    + 'plus 181 of a `SealController`, which was derived from its own '
                    + 'update loop before any tape drove one'
                : `the game reports ${arm.status?.dead_frames}`,
        });
    }
    if (boot && door) {
        const b = boot.status?.dead_frames;
        const d = door.status?.dead_frames;
        found.push({
            name: '⛓⛓ R5 totem entrance: the load cost is MEASURED, not inherited',
            ok: b === TOTEM_ENTRANCE_WALK.load.boot && d === TOTEM_ENTRANCE_WALK.load.total,
            detail: b === TOTEM_ENTRANCE_WALK.load.boot && d === TOTEM_ENTRANCE_WALK.load.total
                ? `boot ${b}, boot+door ${d} ⇒ this door costs ${d - b}. ⚠ NEITHER matches `
                    + "`r5-feather`'s 21 and 20, so a load's dead-frame cost is NOT a "
                    + 'constant — `blackCover` and the frame `Bot.update` samples it on are '
                    + `two clocks. Without these two probes the ceremony would have looked `
                    + `like ${TOTEM_ENTRANCE_WALK.deadFrames - 41} and `
                    + '`sealControllerTicks()` would have been "corrected" from 181 to 179.'
                : `boot ${b} (expected ${TOTEM_ENTRANCE_WALK.load.boot}), boot+door ${d} `
                    + `(expected ${TOTEM_ENTRANCE_WALK.load.total})`,
        });
    } else {
        found.push({
            name: 'R5 totem entrance: the fade probes were not replayed',
            ok: true,
            skipped: true,
            detail: 'run --only=r5-l38-fade-boot,r5-l38-fade-door to attribute the 370 — '
                + 'without them the ceremony\'s share is an assumption borrowed from '
                + 'another level',
        });
    }
    return found;
}


/**
 * ── ⛔⛔ THE SHAFT — AND THE GAME REFUSED THE PLAN'S LEDGER ────────────
 *
 * `SHAFT_PLAN` has been a plan since §19.8 and a *correct* plan since
 * §20.3, certified twice — by a hand derivation and by a blind BFS — and
 * slice 8 named the problem with that: **both certificates ran through the
 * same unaimed press model.** One stratum. The game is the first
 * independent check, and this is what it said.
 *
 * ⛓ THE STREAM MATCHES BYTE FOR BYTE. Nineteen fire presses, 2,375 ticks,
 * the rope pull and the eighteen — every position the model predicted.
 *
 * ⛔⛔ AND THE LEDGER DOES NOT. The model predicts {39,0} {39,1} {39,2}
 * (the three wandlocks) and {39,9} (the rope), with {39,7} written and
 * TAKEN BACK by the final press. The game reports
 *
 *     {39,7}  {39,8}  {39,9}  {39,10}
 *
 * — the three wandlocks NEVER OPENED, {39,7} was NOT taken back, and
 * **{39,10} is the `FallRock`'s tag**, which `r5Totem.GROUP_6` argued at
 * length that nothing on this route writes.
 *
 * ⚠ AND THE POSITIONS COULD NOT HAVE CAUGHT IT. A block's position and a
 * lock's alpha are invisible to the observation stream: the player walks
 * the same path whether the room opened behind them or not. That is the
 * whole reason an exact-set LEDGER claim exists, and it is the first time
 * on this arc that the stream and the ledger have disagreed.
 *
 * ⛔ AND THE STREAM DOES NOT MATCH EITHER — the first reading of this was
 * WRONG and the correction is the useful part. `--record` writes the
 * game's stream and then compares the game against it, which is a
 * self-comparison and passes by construction; the check that matters is
 * `tapeRunner.test.js`'s fixture differential, MODEL against recording.
 * That one says **tick 852 differs by dy = 1.4** — one whole movement step,
 * 850 ticks into the choreography.
 *
 * ⇒ THE TAPE IS NOT COMMITTED. A fixture whose model is refuted is either a
 * permanent red or a silenced one, and neither is a finding; the numbers
 * below ARE the finding, and re-making the recording is two commands and
 * 160 seconds. The next slice's first job is to find which of the three it
 * is:
 *
 *   1. the blocks do not end where `runFire`'s exact-set check says —
 *      in which case the press model is still wrong, one abstraction below
 *      where §20.2 found it;
 *   2. they do, and a `Lock` needs something the 130-tick tail does not
 *      give it;
 *   3. or the rope's group-6 publication does more than `GROUP_6` priced —
 *      {39,10} says something in that group moved, and the FallRock's
 *      "two independent gates" argument is the thing to re-read first.
 *
 * ⚠⚠ AND THE GUARD THAT SHOULD HAVE SHOUTED IS OFF FOR THIS TAPE.
 * `checkReadout` gates `saw_auto_advance === 0` on `tape_version < 4`, and
 * a v4 tape without its own acceptance entry gets NO census guard at all.
 * This tape reports 217 dead frames with ZERO transitions and no ceremony
 * — ~197 unexplained — and nothing in the sweep would have said so.
 */
export const SHAFT_WALK = Object.freeze({
    name: 'r5-shaft',
    /**
     * What the model says the eighteen presses earn.
     * ⛓ R5 slice 11 adds {39,10}: `run.rockFalls` has predicted it since
     * slice 10 and nothing summed it (see `r5Shaft.SHAFT_LEDGER`).
     */
    modelCleared: Object.freeze(['39:0', '39:1', '39:2', '39:9', '39:10']),
    /** …and what the game reported, re-recorded 2026-08-04 (slice 11). */
    gameCleared: Object.freeze(['39:7', '39:8', '39:9', '39:10']),
    /** ⛔ Where the MODEL's own stream parts from the game's. */
    divergesAt: Object.freeze({ tick: 852, dy: 1.4 }),
    ticks: 2375,
    /** The declared clear the tape boots with — in both lists by construction. */
    declared: '39:8',
    deadFrames: 217,
    /**
     * ⛓⛓ R5 SLICE 11 — HALF THE REFUTATION IS CLOSED BY THE GAME.
     *
     * The re-recording confirms both of slice 10's forward predictions from
     * the game's own instruments:
     *
     *   {39,10} IS IN THE GAME'S LEDGER    — the FallRock diagnosis holds
     *   217 dead = 197 + 20, IN BAND       — the dead-frame budget PASSES,
     *                                        60 + 46 + 90 + 1 to the frame
     *
     * ⛔⛔ AND THE OTHER HALF IS NOT A TIMING PHASE. §23.4 read tick 852 as
     * "a one-tick stall, and one tick behind thereafter". It is not: of
     * 1,524 diverging ticks, exactly ONE satisfies `game[t] == model[t-1]`,
     * and the gap GROWS — dy -1.4 at t852, -12.65 by t863, and the walk
     * ends 20 px east and 9 px south of the model.
     *
     * ⛓⛓ IT IS A BLOCKED WALK, AT A NAMED CELL. Both streams are identical
     * through press 5's whole leg and part on the first tick of the walk
     * that follows it:
     *
     *   t845..851   both at (199.44, 72.24) — tile (12,4), press 5's stance
     *   t852..858   the MODEL walks south to y 89; the GAME CANNOT LEAVE
     *               y 76.34, and never does
     *
     * `SHAFT_PLAN`'s press 5 is `stance (12,4)` moving block 2 from (12,5)
     * to (12,6). ⇒ **in the game (12,5) is still solid when the walk
     * resumes, and in the model it is free.** One cell, and it cascades:
     * every later stance is wrong, so the three lock-buttons are never
     * held ({39,0}/{39,1}/{39,2} never open) and block 1 never leaves
     * `button t1` (so {39,7} is never taken back). **One defect explains
     * the entire remaining ledger difference.**
     *
     * ⛓⛓ AND THE BLOCK IS PARKED, NOT GLIDING — which narrows it again.
     * The game's `y` is **constant at 76.34 for all seven blocked ticks**
     * and then goes BACKWARD (75.09) when the span ends. A block still
     * gliding south at 0.5 px/tick would have let the player follow it
     * 3.5 px in that time. It does not move at all. ⇒ **press 5's push
     * did not take effect in the game**, and this is not a glide-length
     * or a phase problem.
     *
     * ⚠ TWO MECHANISMS FIT, and telling them apart is the next
     * measurement:
     *
     *   · the press MISSED — though the geometry is not marginal:
     *     `fireHits` puts block 2 at **d = 3.00** against a 16 px cut from
     *     that stance, and the player is within 0.6 px of the stance's
     *     centre when it fires;
     *   · or every hit was SWALLOWED. `PushableBlockFire.hit`'s first line
     *     is `if (v.length > 0) return` — "don't reset if we're already
     *     moving". §20.7 read that line as collapsing the 25 dispatches
     *     WITHIN one press; it also swallows a press that lands while the
     *     block is still travelling from an EARLIER one. The model applies
     *     it within a press and the game applies it across presses.
     *
     * ⛔ All three of the brief's hypotheses (a carried `Spritemap._timer`
     * phase, the Lock's alpha accumulator, a per-press transcription of a
     * continuous loop) are refuted by the SHAPE: none of them parks a
     * block.
     */
    divergence: Object.freeze({
        kind: 'blocked-walk',
        firstTick: 852,
        divergingTicks: 1524,
        oneTickLagMatches: 1,
        cell: Object.freeze({ tx: 12, ty: 5 }),
        press: 5,
        gameStuckAtY: 76.34,
        pressDistance: 3,
        blockIsMoving: false,
        why: 'the game cannot enter the cell `SHAFT_PLAN` press 5 says block 2 has '
            + 'vacated; the model can. And the block is PARKED there, not gliding — the '
            + 'game\'s y is constant for all seven blocked ticks, where a block still '
            + 'travelling at 0.5 px/tick would have let the player follow it 3.5 px. So '
            + 'press 5\'s push did not take effect: either it missed (d = 3.00 against a '
            + '16 px cut, so not marginal) or its hits were swallowed by '
            + '`PushableBlockFire.hit`\'s `if (v.length > 0) return`, which §20.7 read '
            + 'as collapsing the 25 dispatches WITHIN a press and which also swallows a '
            + 'press landing while the block still travels from an earlier one.',
    }),
});

export function shaftFindings(replayed) {
    const walk = replayed?.get(SHAFT_WALK.name);
    if (!walk) {
        return [{
            name: '⛔⛔ R5 shaft: NOT A FIXTURE — the model is refuted and the tape is withdrawn',
            ok: true,
            skipped: true,
            detail: 'The shaft was driven, recorded and REFUTED in one session (see '
                + '`SHAFT_WALK` for the three numbers). The tape is not committed, '
                + 'because a fixture whose model is wrong is either a permanent red or a '
                + 'silenced one and neither is a finding. Re-make it with '
                + '`node scripts/procgen/plan-seedling-r5-shaft.mjs --write` and '
                + '`verify-seedling-bot-differential --record --win --only=r5-shaft`, '
                + 'which is 160 s — the evidence is cheap to reproduce and the '
                + 'transcription is what is missing.',
        }];
    }
    const found = [];
    const cleared = [...clearedSet(walk.status)].sort();
    const want = [...SHAFT_WALK.modelCleared].sort();
    found.push({
        name: '⛔⛔ R5 shaft: the game\'s ledger against the plan\'s — REFUTED, and kept',
        ok: JSON.stringify(cleared) === JSON.stringify(want),
        detail: JSON.stringify(cleared) === JSON.stringify(want)
            ? `[${cleared.join(' ')}] — the three wandlocks and the rope, exactly as `
                + '`SHAFT_PLAN` predicts. The eighteen presses have met an independent '
                + 'check and survived it.'
            : `THE GAME REPORTS [${cleared.join(' ')}] AND THE PLAN PREDICTS `
                + `[${want.join(' ')}]. The stream matches byte for byte — a block's `
                + 'position and a lock\'s alpha are invisible to it — so this is the '
                + 'first time on the arc that the positions agreed and the LEDGER did '
                + 'not. {39,10} is the `FallRock`\'s tag, which `r5Totem.GROUP_6` argued '
                + 'nothing here writes; {39,7} was supposed to be taken back by the final '
                + 'press and was not; and {39,0}/{39,1}/{39,2} say the three wandlocks '
                + 'never opened at all. See `SHAFT_WALK` for the three candidates.',
    });
    found.push({
        name: '⚠ R5 shaft: 217 dead frames with NO transition and NO ceremony',
        ok: walk.status?.dead_frames === SHAFT_WALK.deadFrames,
        detail: `${walk.status?.dead_frames} against a boot fade of ~20. ~197 frames of `
            + 'this tape are frozen or fading and nothing in the model accounts for them '
            + '— and `checkReadout` gates its `saw_auto_advance` census guard on '
            + '`tape_version < 4`, so a v4 tape like this one gets no guard at all. The '
            + 'number is asserted here so it cannot drift while it is unexplained.',
    });
    return found;
}

export function r5AcceptanceFindings(replayed) {
    return [
        ...l60KillFindings(replayed),
        ...keyLegFindings(replayed),
        ...bobBossFindings(replayed),
        ...karloreFindings(replayed),
        ...d5ConchFindings(replayed),
        ...swimPairFindings(replayed),
        ...swimLatchFindings(replayed),
        ...waterfallPairFindings(replayed),
        ...featherFindings(replayed),
        ...totemEntranceFindings(replayed),
        ...shaftFindings(replayed),
    ];
}
