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
// ⛓ R5 slice 13: the shaft's PAIR. The control's pin, the cell it must never
// enter and the ledger it may earn all live beside the plan they are a
// control for, so the two cannot drift apart.
import { SHAFT_PAIR } from './r5Shaft.js';
// ⛓ R5 slice 19: L42's pair is the FIRST whose two arms are one LOAD apart —
// the drive takes the exit teleporter and the control never leaves the room —
// so the ceremony's subtraction carries a fade term and needs its band.
import { describeFadeBand, fadeBand } from './deadFrameBand.js';

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
 * ── ⛓⛓⛓ THE SHAFT — CLOSED, AND THE HISTORY IS KEPT ──────────────────
 *
 * ⛓⛓ **R5 SLICE 13: THE SHAFT IS GREEN, ON BOTH ARMS.** 2,403 observations
 * of press arm and 2,403 of control, byte-exact against the game, and the
 * ledger the plan predicts is the ledger the game reports. It took ONE
 * change to the route and the number is small enough to be worth writing
 * down: **twenty-seven idle ticks before press 5.**
 *
 * ⛓ THE FIX IS `spinner.js` AND `fire.thread`. §25.3 established that a
 * wandering `Spinner` — a billiard whose `runRange = 0` makes it entirely
 * player-independent — was standing in block 2's glide corridor. With the
 * motion modelled, "when is this corridor clear" is a question with a
 * COMPUTED answer, so the press waits instead of the plan changing. ⛔ And
 * waiting rather than KILLING is what keeps this ledger meaningful: three
 * dead spinners would have written {39,3}/{39,4}/{39,6} and turned nine
 * writes into twelve, re-opening every claim §24.7 closed.
 *
 * ⚠ THE PARAGRAPHS BELOW ARE THE REFUTATION, KEPT. They are what the game
 * said before the fix, and the numbers in them are what made the diagnosis
 * possible — a correction with no artefact is a claim.
 *
 * ── ⛔⛔ WHAT THE GAME SAID IN SLICE 11 ───────────────────────────────
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
     * What the model says the eighteen presses EARN.
     * ⛓ R5 slice 11 adds {39,10}: `run.rockFalls` has predicted it since
     * slice 10 and nothing summed it (see `r5Shaft.SHAFT_LEDGER`).
     */
    modelCleared: Object.freeze(['39:0', '39:1', '39:2', '39:9', '39:10']),
    /**
     * ⛔ THE DECLARED CLEAR THE TAPE BOOTS WITH — and it was described as
     * *"in both lists by construction"* while being in only one of them.
     *
     * The game's `persistence_cleared` is everything the SAVE has cleared,
     * declared and earned together; `modelCleared` is what the PLAN earns.
     * So the comparison is `modelCleared ∪ declared`, and writing it as a
     * straight equality left {39,8} looking like a disagreement in the one
     * recording where everything else finally agreed. ⚠ A field whose
     * docblock says it is accounted for, in a check that does not account
     * for it, is worse than an absent field.
     */
    declared: '39:8',
    /** ⇒ what the GAME's ledger must be, and is. */
    gameLedger: Object.freeze(['39:0', '39:1', '39:10', '39:2', '39:8', '39:9']),
    /**
     * ⛔ What the game reported in slice 11, KEPT — the refuted measurement.
     * The three wandlocks never opened, {39,7} was never taken back, and one
     * wedged block explained all of it.
     */
    refutedGameCleared: Object.freeze(['39:7', '39:8', '39:9', '39:10']),
    /**
     * ⛓⛓ RESOLVED. `divergesAt` was `{tick: 852, dy: 1.4}` — press 5's walk,
     * against a block a spinner had parked. Both arms are byte-exact now.
     */
    divergesAt: null,
    resolvedBy: 'spinner.js + `fire.thread` — 27 idle ticks before press 5',
    ticks: 2764,
    /**
     * ⛓⛓⛓ 367, AND THE 150 IS THE CEREMONY — the first of the five.
     *
     * 197 run freeze (the rope's rock, modelled since slice 10) + 150 pickup
     * (`totempart 2`) + one room-load fade. §24.9 recorded "NO CEREMONY WAS
     * OBSERVED"; this number is the game's own accounting saying otherwise,
     * and it is a stronger witness than the run's `collected` record because
     * it comes from the other side.
     */
    deadFrames: 367,
    modelledDeadFrames: 347,
    ceremonyFrames: 150,
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

/**
 * ⛓⛓ R5 SLICE 12 — THE FIRST PAIR ON THE ARC THAT PROVES A FIRE PRESS
 * MOVES A BLOCK.
 *
 * Six presses have been driven on this rung and not one of them had a
 * committed fixture: the shaft's eighteen are withdrawn, and the rope pull
 * moves a rect rather than a block. This pair does exactly one thing and
 * does it twice over — press WEST, walk into the vacated cell, press
 * SOUTH, walk into that one; and the control is the same tape with both
 * `primary` spans deleted and every walk span identical.
 *
 * ⛔ It is `r5-press-delay` rather than `r5-press-axes` because the
 * UNDELAYED arms are refuted: a wandering `Spinner` wedges the block
 * mid-glide, and the same tape 120 ticks later is byte-exact. That time
 * shift is the whole evidence that the blocker MOVES — see
 * `r5Shaft.SPINNER_WEDGE`. The three diagnostic tapes are withdrawn per
 * §22.7 and their numbers are banked there.
 */
export const PRESS_PAIR = Object.freeze({
    press: 'r5-press-delay',
    control: 'r5-press-delay-control',
    /** Where each arm comes to rest, in tiles. */
    pressTile: Object.freeze({ level: 39, tx: 12, ty: 5 }),
    controlTile: Object.freeze({ level: 39, tx: 13, ty: 4 }),
    /** The two cells a press empties, in the order the tape empties them. */
    vacated: Object.freeze([
        Object.freeze({ tx: 13, ty: 5 }), Object.freeze({ tx: 12, ty: 5 }),
    ]),
});

export function pressPairFindings(replayed) {
    const press = replayed?.get(PRESS_PAIR.press);
    const control = replayed?.get(PRESS_PAIR.control);
    if (!press || !control) {
        return [{
            name: 'R5 press pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[press && PRESS_PAIR.press, control && PRESS_PAIR.control]
                .filter(Boolean).join(', ') || 'neither'} — "the walk stood in (12,5)" is `
                + 'not evidence that a press put it there',
        }];
    }
    const found = [];
    /** Did this arm's stream ever put the player inside that cell? */
    const entered = (arm, c) => (arm?.stream?.ticks ?? []).some(
        (t) => t.level === 39 && Math.floor(t.x / 16) === c.tx && Math.floor(t.y / 16) === c.ty);
    for (const c of PRESS_PAIR.vacated) {
        const inPress = entered(press, c);
        const inControl = entered(control, c);
        found.push({
            name: `⛓⛓ R5 press pair: the game enters (${c.tx},${c.ty}) with the press and NOT without`,
            ok: inPress && !inControl,
            detail: inPress && !inControl
                ? 'the fire press moved a `PushableBlockFire` a whole tile and the walk '
                    + 'went where it stood. ⛔ Both facts come from the GAME: the two arms '
                    + 'are byte-exact recordings one field apart, and the field is the '
                    + '`primary` spans.'
                : `press arm ${inPress ? 'entered' : 'did NOT enter'} it and the control `
                    + `${inControl ? 'ALSO entered it — so the cell was never sealed and '
                        + 'the press arm proves nothing' : 'did not'}`,
        });
    }
    const end = terminal(press);
    found.push({
        name: '⛓ R5 press pair: …and it comes to rest in the cell press 5 empties',
        ok: !!end && end.level === PRESS_PAIR.pressTile.level
            && Math.floor(end.x / 16) === PRESS_PAIR.pressTile.tx
            && Math.floor(end.y / 16) === PRESS_PAIR.pressTile.ty,
        detail: end
            ? `L${end.level} tile (${Math.floor(end.x / 16)},${Math.floor(end.y / 16)}) — `
                + 'against §24.8\'s shaft, which could not leave tile (12,4) at all'
            : 'the press arm produced no terminal observation',
    });
    return found;
}

export function shaftFindings(replayed) {
    const walk = replayed?.get(SHAFT_WALK.name);
    const control = replayed?.get(SHAFT_PAIR.control);
    if (!walk || !control) {
        return [{
            name: 'R5 shaft pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[walk && SHAFT_WALK.name, control && SHAFT_PAIR.control]
                .filter(Boolean).join(', ') || 'neither'} — "the walk reached the middle `
                + 'of the cross" is not evidence that eighteen presses put it there. '
                + 'Re-make both with `node scripts/procgen/plan-seedling-r5-shaft.mjs '
                + '--write` and `verify-seedling-bot-differential --record --win '
                + '--only=r5-shaft,r5-shaft-control`.',
        }];
    }
    const found = [];
    /**
     * ⛓⛓⛓ THE LEDGER, AND IT IS THE UNION.
     *
     * The game's `persistence_cleared` carries the tape's DECLARED clear
     * alongside what the route earned; `modelCleared` is what the route
     * earns. Slice 11 compared them as a straight equality, which made the
     * declared {39,8} look like a disagreement — see `SHAFT_WALK.declared`.
     */
    const cleared = [...clearedSet(walk.status)].sort();
    const want = [...new Set([...SHAFT_WALK.modelCleared, SHAFT_WALK.declared])].sort();
    const agrees = JSON.stringify(cleared) === JSON.stringify(want);
    found.push({
        name: '⛓⛓⛓ R5 shaft: the game\'s ledger IS the plan\'s — nine writes, eight net '
            + 'clears, and {39,7} taken back',
        ok: agrees,
        detail: agrees
            ? `[${cleared.join(' ')}] — the three wandlocks, the rope, the rock the rope `
                + 'drops and the declared entrance flag, exactly as `SHAFT_PLAN` predicts. '
                + '⛓ The eighteen presses have met an independent check and survived it, '
                + 'and {39,7} is ABSENT because the final press moves block 1 off `button '
                + 't1` and `returnToNormal()` writes the tag back TRUE. ⛔ Slice 11 got '
                + `[${SHAFT_WALK.refutedGameCleared.join(' ')}] here — the three wandlocks `
                + 'never opened at all, because a Spinner had wedged block 2 at press 5.'
            : `THE GAME REPORTS [${cleared.join(' ')}] AND THE PLAN PREDICTS `
                + `[${want.join(' ')}]. A block's position and a lock's alpha are `
                + 'invisible to the observation stream, so a byte-exact walk beside a '
                + 'wrong ledger is exactly what a wedged block looks like — check '
                + '`fire.thread`\'s waits before anything else.',
    });
    /**
     * ⛓⛓⛓ AND THE PAIR, which §24.9 recorded as never having been generated
     * by anything. Without a shut arm, "the walk reached (9,9)" is a
     * sentence about a walk.
     */
    const cEnd = terminal(control);
    const enteredCross = (arm) => (arm?.stream?.ticks ?? []).some(
        (t) => t.level === SHAFT_PAIR.pinnedAt.level
            && Math.floor(t.x / 16) === SHAFT_PAIR.neverEnters.tx
            && Math.floor(t.y / 16) === SHAFT_PAIR.neverEnters.ty);
    const pressCrossed = enteredCross(walk);
    const controlCrossed = enteredCross(control);
    found.push({
        name: '⛓⛓⛓ R5 shaft pair: the GAME enters the middle of the cross with the '
            + 'eighteen presses and NOT without',
        ok: pressCrossed && !controlCrossed,
        detail: pressCrossed && !controlCrossed
            ? `(${SHAFT_PAIR.neverEnters.tx},${SHAFT_PAIR.neverEnters.ty}) is reached in `
                + 'the press arm and never touched in the control, which is the identical '
                + 'tape with the eighteen `primary` spans deleted and the rope pull KEPT '
                + '(the rope is what opens the shaft; a control stopped at the door would '
                + `be testing the door). The control comes to rest at tile `
                + `(${cEnd ? Math.floor(cEnd.x / 16) : '?'},${cEnd ? Math.floor(cEnd.y / 16) : '?'}).`
            : `press arm ${pressCrossed ? 'entered' : 'did NOT enter'} the cross and the `
                + `control ${controlCrossed ? 'ALSO entered it — so the covers were never '
                    + 'shut and the press arm proves nothing' : 'did not'}`,
    });
    found.push({
        name: '⛓ R5 shaft pair: …and the control earns the ROPE\'s ledger and nothing else',
        ok: (() => {
            const c = [...clearedSet(control.status)].sort();
            const w = [...new Set([...SHAFT_PAIR.controlEarned, SHAFT_WALK.declared])].sort();
            return JSON.stringify(c) === JSON.stringify(w);
        })(),
        detail: `[${[...clearedSet(control.status)].sort().join(' ')}] against `
            + `[${[...new Set([...SHAFT_PAIR.controlEarned, SHAFT_WALK.declared])].sort().join(' ')}] `
            + '— the rope, the rock it drops, the declared entrance flag, and '
            + `⛔⛔ {39,${SHAFT_PAIR.controlSpinnerKill.tag}}: `
            + `${SHAFT_PAIR.controlSpinnerKill.id}, killed by the room's PULSER on an arm `
            + 'where nothing fights anything. Deleting eighteen presses left three blocks '
            + 'on their spawns, which is three moved walls, which sent the billiard '
            + 'through the ring — a second-order consequence the pair did not predict and '
            + '`run.spinnerWrites` reproduces exactly. ⛔ And NONE of {39,0}/{39,1}/{39,2}: '
            + 'those are exactly the flags a HELD lock-button writes, so a control that '
            + 'opened one would mean something other than the presses was holding them.',
    });
    /**
     * ⛓⛓⛓ THE CEREMONY, FROM THE GAME'S SIDE. `dead_frames` is the game's
     * own count of frames the tape never advanced through, and the pickup's
     * 150 are in it. The part itself is NOT observable (`Bot.itemReadout`
     * has no `hasTotemPart` field, §20.8), so this is the claim.
     */
    found.push({
        name: '⛓⛓⛓ R5 shaft: the FIRST COLLECT CEREMONY is in the game\'s dead-frame count',
        ok: (walk.status?.dead_frames ?? 0) - SHAFT_WALK.ceremonyFrames >= 0
            && walk.status?.dead_frames === SHAFT_WALK.deadFrames,
        detail: `${walk.status?.dead_frames} dead frames against `
            + `${SHAFT_WALK.deadFrames}, of which ${SHAFT_WALK.ceremonyFrames} are `
            + '`totempart 2`\'s freeze — ONE of the five this rung stops at. ⛔ §24.9: '
            + '"NO CEREMONY WAS OBSERVED … part 2 is behind the shaft whose walk is '
            + 'blocked at (12,5)". That block is unwedged.',
    });
    found.push({
        name: '⛓ R5 shaft: the dead frames are the rock, the ceremony and one fade',
        ok: walk.status?.dead_frames === SHAFT_WALK.deadFrames,
        detail: `${walk.status?.dead_frames} = ${SHAFT_WALK.modelledDeadFrames} modelled `
            + `(197 for the rope's rock — 60 wait + 46 fall + 90 camera + 1 release, `
            + `transcribed as the LOOP, since the closed form gives 45 — plus `
            + `${SHAFT_WALK.ceremonyFrames} for the PART) plus one room-load fade. `
            + '⛓⛓ THE 150 IS THE FIRST CEREMONY, counted by the GAME. §24.9 recorded '
            + '"NO CEREMONY WAS OBSERVED"; this is the other side of the run\'s own '
            + '`collected` record and it is the better witness of the two. ⚠ Slice 11 '
            + 'asserted the 217 while calling it unexplained; the dead-frame budget is '
            + 'what explains it, and that instrument spent its first slice in a temporal '
            + 'dead zone (§24.2).',
    });
    return found;
}

/**
 * ⛓⛓⛓ THE SECOND CEREMONY — `totempart 1 @160,640`, and it costs a WALK.
 *
 * §24.5 priced L40's north half as an eleven-link chain and §23.9's arrival
 * flood recorded which prizes need none of it. Exactly one does, and the
 * flood was taken with every activator group SHUT — so "free" is a measured
 * verdict about the room rather than a lucky route.
 *
 * ⚠ THE CLAIM IS THE CEREMONY, for the same reason `totempart 2`'s is:
 * `Bot.itemReadout` has no `hasTotemPart` field (§20.8), so what the GAME
 * can be asked is the 150 frozen frames — and the negatives around them,
 * which for this level are the load-bearing part. A pit in L40 is a ONE-WAY
 * door into the wand room (`r5Totem.L40_FALLTHROUGH`), so "it never fell"
 * is not a hazard-survival claim, it is a claim about not having skipped
 * two rungs of the ladder by accident.
 */
export const L40_PART1 = Object.freeze({
    name: 'r5-l40-part1',
    part: 1,
    pickup: Object.freeze({ x: 160, y: 640 }),
    /** One pickup ceremony and one room-load fade. */
    ceremonyFrames: 150,
    /** ⛓ NOTHING earned: the eleven-link chain is untouched by this leg. */
    earns: Object.freeze([]),
});

export function l40Part1Findings(replayed) {
    const walk = replayed?.get(L40_PART1.name);
    if (!walk) {
        return [{
            name: 'R5 L40 part 1: SKIPPED — this sweep did not replay it',
            ok: true,
            skipped: true,
            detail: `run --only=${L40_PART1.name} (or --tier=full) to assert the second `
                + 'of the five ceremonies',
        }];
    }
    const found = [];
    const st = walk.status;
    const cleared = [...clearedSet(st)].sort();
    found.push({
        name: '⛓⛓⛓ R5 L40 part 1: the SECOND collect ceremony is in the game\'s dead-frame count',
        ok: (st?.dead_frames ?? 0) >= L40_PART1.ceremonyFrames,
        detail: `${st?.dead_frames} dead frames, of which ${L40_PART1.ceremonyFrames} are `
            + 'the pickup\'s freeze. ⛓ It costs a WALK: §23.9\'s arrival flood, taken '
            + 'with every activator group SHUT, already recorded this part as reached and '
            + 'every other prize in the level as not.',
    });
    found.push({
        name: '⛓⛓ R5 L40 part 1: …and it earns NOTHING — the eleven-link chain is untouched',
        ok: cleared.length === 0,
        detail: `[${cleared.join(' ') || 'empty'}] against []. ⛔ A leg that opened a link `
            + 'would be making the "free" claim about a different room — and a spinner '
            + 'that bounced into a hazard would put a flag here too '
            + '(`spinner.SPINNER_TERRAIN_WRITE`), so an empty ledger is a claim about the '
            + 'billiards as well as about the chain.',
    });
    /**
     * ⛔⛔ AND THE NEGATIVE THAT MATTERS MOST IN THIS LEVEL. Every pit is a
     * one-way transport into L43 — the WAND room, which opens the next
     * slice. A tape that fell would not fail; it would quietly succeed at
     * something else.
     */
    const levels = [...new Set((walk.stream?.ticks ?? []).map((t) => t.level))];
    found.push({
        name: '⛔⛔ R5 L40 part 1: the walk never leaves L40 — no pit, no stairs, no teleporter',
        ok: levels.length === 1 && levels[0] === 40,
        detail: `levels [${levels.join(' ')}]. \`control@224,432\` is a PARAMETER BLOCK `
            + 'read once at `loadlevel`, not a trigger: what it configures is a fall that '
            + 'transports to L43 with `setFallFromCeiling` and no way back '
            + '(`r5Totem.L40_FALLTHROUGH`). A tape that fell in would arrive somewhere '
            + 'this rung has not reconned and would still look green.',
    });
    return found;
}

/**
 * ⛓⛓⛓ THE FOURTH CEREMONY — `totempart 3 @240,144`, AND THE CRUSHER'S
 * FIRST LIVE CONTACT.
 *
 * Eight per-visit geometry families reached the game before this one and
 * every one of them was MONOTONE: the player opened a cell and it stayed
 * open. A `Crusher` is the ninth and the first that moves on its own, and
 * L41 is the first room whose solution is to OPERATE one rather than avoid
 * it — `hazardVolume` prices the four 64 px lanes hard-avoid and the
 * solution requires standing in one.
 *
 * ⛓⛓ THE PAIR IS ONE FIELD APART, and the field is the two
 * `breakablerock` tags. With them declared clear the rocks are gone, the
 * crusher's west sight line is open, and three baits walk it onto
 * `button@248,232` where it holds `cover@112,128` open for the rest of the
 * visit. With them undeclared the rocks stand, `collideLine` takes its
 * early exit, and the identical 146 spans move it not one pixel.
 *
 * ⚠ WHAT THE GAME CAN BE ASKED, and it is less than the model knows. The
 * crusher's POSITION is in no readout — `Bot.itemReadout` carries items,
 * `persistence_cleared` carries flags, and there is no third channel. So
 * the park is witnessed by the ROOM: the drive's stream is byte-exact
 * against a model in which the crusher is on the button, it walks through
 * `crusher@240,64`'s own constructor cells on the way to the part, and it
 * ends with a ceremony the control does not have. The 150-frame difference
 * IS the park.
 *
 * ⛔ AND THE PART WRITES NO PERSISTENCE. `BossTotemPart.removed()` is
 * `Player.hasTotemPartSet(3, true)` — save-file state — so the ledger for
 * this window is `{41,0}`, the wandlock, alone.
 */
export const L41_PART3_PAIR = Object.freeze({
    drive: 'r5-l41-part3',
    control: 'r5-l41-part3-control',
    part: 3,
    /** The one flag this window EARNS: `wandlock@240,96`, tag 0. */
    earns: Object.freeze(['41:0']),
    /**
     * ⛔⛔ AND THE TWO IT DECLARES, because `persistence_cleared` IS
     * DECLARED + EARNED and this arc has already paid for reading it as
     * earned-only once (§27's acceptance bug, on the seal). The tape boots
     * with `breakablerock@224,64` {tag 1} and `breakablerock@224,80`
     * {tag 2} clear — they shield the crusher, so the swing that removes
     * them belongs to an earlier window — and the game reports them beside
     * the flag this window actually wrote.
     */
    declares: Object.freeze(['41:1', '41:2']),
    ceremonyFrames: 150,
});

export function l41Part3Findings(replayed) {
    const drive = replayed?.get(L41_PART3_PAIR.drive);
    const control = replayed?.get(L41_PART3_PAIR.control);
    if (!drive || !control) {
        return [{
            name: 'R5 L41 part 3 pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[drive && L41_PART3_PAIR.drive, control && L41_PART3_PAIR.control]
                .filter(Boolean).join(', ') || 'neither'} — "the walk collected a totem `
                + 'part" is not evidence that a crusher was ever in the way, and this '
                + 'room\'s whole claim is that the obstacle is the machine',
        }];
    }
    const found = [];
    const dDead = drive.status?.dead_frames ?? 0;
    const cDead = control.status?.dead_frames ?? 0;
    /**
     * ⛓⛓⛓ THE CEREMONY, AND THE CONTROL IS WHAT MAKES IT A MEASUREMENT.
     * Both arms load the room exactly once and neither transitions, so the
     * fade term is identical and the DIFFERENCE is the freeze — 150 frames,
     * with no band arithmetic in it at all.
     */
    found.push({
        name: '⛓⛓⛓ R5 L41 part 3: the FOURTH ceremony, and the DIFFERENCE between the arms is it',
        ok: dDead - cDead === L41_PART3_PAIR.ceremonyFrames,
        detail: `${dDead} dead against the control's ${cDead} — a difference of `
            + `${dDead - cDead}, against ${L41_PART3_PAIR.ceremonyFrames}. ⛓ Both arms are `
            + 'the same 146 spans and both load L41 once, so the fade term cancels and '
            + 'this is the pickup\'s freeze with no band in it. `hasTotemPart` is not in '
            + '`Bot.itemReadout` (§20.8), so the frozen frames are the claim — and here '
            + 'they are a subtraction rather than a budget.',
    });
    const dCleared = [...clearedSet(drive.status)].sort();
    const cCleared = [...clearedSet(control.status)].sort();
    const wantCleared = [...L41_PART3_PAIR.declares, ...L41_PART3_PAIR.earns].sort();
    found.push({
        name: '⛓⛓ R5 L41 part 3: the ledger is the two DECLARED rocks plus ONE EARNED flag',
        ok: dCleared.join(' ') === wantCleared.join(' '),
        detail: `[${dCleared.join(' ') || 'empty'}] against [${wantCleared.join(' ')}]. `
            + '⛔ `persistence_cleared` is DECLARED + EARNED, and reading it as '
            + 'earned-only is a mistake this arc has already made once (§27\'s acceptance '
            + 'compared it against the earned set and went red on a correct run). What '
            + 'this window WRITES is `{41,0}` alone: `Lock.turnOff()` on '
            + '`wandlock@240,96`. `{41,1}`/`{41,2}` are the two `breakablerock` tags the '
            + 'tape declares — the rocks shield the crusher, so the swing that removes '
            + 'them belongs to an earlier window — and `BossTotemPart.removed()` writes '
            + '`Player.hasTotemPartSet`, which is SAVE-FILE state and not persistence. So '
            + 'the part contributes nothing here at all.',
    });
    /**
     * ⛓ AND THE EARNED HALF, ISOLATED BY THE CONTROL — which declares the
     * same nothing and earns the same nothing, so the difference between
     * the two sets is exactly what the baits bought.
     */
    found.push({
        name: '⛓⛓⛓ R5 L41 part 3: …and the DIFFERENCE from the control is `{41,0}` alone',
        ok: dCleared.filter((f) => !cCleared.includes(f)
            && !L41_PART3_PAIR.declares.includes(f)).join(' ')
            === [...L41_PART3_PAIR.earns].sort().join(' '),
        detail: `drive [${dCleared.join(' ') || 'empty'}] minus control `
            + `[${cCleared.join(' ') || 'empty'}] minus declared `
            + `[${[...L41_PART3_PAIR.declares].join(' ')}] = `
            + `[${dCleared.filter((f) => !cCleared.includes(f)
                && !L41_PART3_PAIR.declares.includes(f)).join(' ') || 'empty'}]. The `
            + 'wandlock is held open by a block on `button@176,176` that only exists as a '
            + 'push because 32x32 of crusher is standing on `button@248,232`.',
    });
    found.push({
        name: '⛔⛔ R5 L41 part 3: the CONTROL earns nothing and freezes for nothing',
        ok: cCleared.length === 0 && cDead < L41_PART3_PAIR.ceremonyFrames,
        detail: `[${cCleared.join(' ') || 'empty'}] cleared, ${cDead} dead frames. With `
            + 'the rocks standing `crusher@240,64` is shielded by `breakablerock@224,80`, '
            + 'never scans, and never leaves its constructor cell — so `button@248,232` is '
            + 'never pressed, `cover@112,128` never opens, the room\'s one block has no '
            + 'push stance, `button@176,176` is never held, `wandlock@240,96` never fades, '
            + 'and the part chamber has no doorway. ⚠ §29.7: the OBVIOUS control — walking '
            + 'east without baiting — is not one, because any walk into the west lane '
            + 'drives the very mechanism it was meant to withhold.',
    });
    /**
     * ⛓⛓ THE WALK THROUGH THE CONSTRUCTOR CELLS, and it is the only thing
     * in the game's own stream that can witness a park at all.
     *
     * `crusher@240,64` is built at `[240,272) x [64,96)` and the part
     * chamber's only doorway is `wandlock@240,96`, directly below it. The
     * drive's stream stands inside that box; the control's never gets east
     * of the rocks at all.
     */
    const inCtorBox = (w) => (w.stream?.ticks ?? []).some((t) => t.level === 41
        && t.x >= 240 && t.x < 272 && t.y >= 64 && t.y < 96);
    found.push({
        name: '⛓⛓⛓ R5 L41 part 3: the drive stands INSIDE the crusher\'s constructor box, the control never does',
        ok: inCtorBox(drive) && !inCtorBox(control),
        detail: `drive ${inCtorBox(drive)}, control ${inCtorBox(control)}. `
            + '`crusher@240,64` occupies [240,272) x [64,96) until something moves it, and '
            + 'those cells are the part chamber\'s only approach. A crusher\'s position '
            + 'is in NO readout the game exposes, so this is the witness: the game let the '
            + 'player stand where the level put 32x32 of `type = "Solid"`.',
    });
    const levels = (w) => [...new Set((w.stream?.ticks ?? []).map((t) => t.level))];
    found.push({
        name: '⛓ R5 L41 part 3: neither arm leaves L41',
        ok: levels(drive).join() === '41' && levels(control).join() === '41',
        detail: `drive [${levels(drive).join(' ')}], control [${levels(control).join(' ')}]. `
            + '⛔ A re-entry would rebuild the crusher at its constructor cell — `Crusher` '
            + 'writes no persistence of any kind — so a window boundary inside a bait '
            + 'chain undoes it.',
    });
    return found;
}


/**
 * ⛓⛓⛓ R5 SLICE 19 — L42 `totempart 4`: THE FIFTH CEREMONY, AND THE FIRST
 * ROUND TRIP.
 *
 * L41 proved a crusher could be OPERATED. L42 is the case with nothing else
 * in it — no activator, no presser, no pushable, one part, two crushers and
 * a 2-tile corridor — and its cost is not the reach but the ROUND TRIP:
 * `teleporter@240,336` is one tile BELOW the arrival, so parking the bodies
 * anywhere in the row-13/14 return corridor collects the part and strands
 * the player. Nine charges in three `bait` chains park both in the TOP
 * ROOM, the one part of the level nothing needs.
 *
 * ⛓⛓ THE PAIR IS THE CHOREOGRAPHY, because there is no flag to withhold:
 * no rock shields these crushers, no lock gates the room, no item is
 * needed. ⛔ AND THE OBVIOUS WAY TO WITHHOLD IT IS NOT A CONTROL — emptying
 * the nine charges' spans and keeping every walk puts the player inside a
 * body on 1,127 ticks, because each walk was planned from the cell the
 * choreography before it ended in (§29.7 one room along, and in a PURSUIT
 * room it is structural: 172 of the arrival's 304 free cells are safe, so
 * an unplanned walk IS a trigger). The control is therefore the tape CUT at
 * the first bait's stance — tile (4,11), one step outside all eight lanes,
 * which is exactly what makes it a stance.
 *
 * ⛔ SO THE ARMS ARE ONE LOAD APART, unlike L41's, and the ceremony is a
 * subtraction WITH a fade term rather than without one: the drive crosses
 * into L40 and the control never leaves L42.
 */
export const L42_PART4_PAIR = Object.freeze({
    drive: 'r5-l42-part4',
    control: 'r5-l42-part4-control',
    part: 4,
    /** ⛔ NOTHING. L42 holds no `Lock`, no `breakablerock` and no chest, and
     * `BossTotemPart.removed()` writes `Player.hasTotemPartSet(4, true)` —
     * save-file state, not persistence. Both arms' ledgers are empty. */
    earns: Object.freeze([]),
    declares: Object.freeze([]),
    ceremonyFrames: 150,
    /** ⛓ The drive loads two rooms, the control one. */
    loads: Object.freeze({ drive: 2, control: 1 }),
    /**
     * ⛓⛓⛓ THE DIPSTICKS — the only witness a park has in the game's own
     * stream. Both crushers' constructor bodies sit across rows 9,10 at
     * cols 6..9, the only corridor to the part, so the drive's walk stands
     * where the level put 32x32 of `type = "Solid"` twice over.
     */
    dipsticks: Object.freeze([
        Object.freeze({ box: Object.freeze({ x: 96, right: 128, y: 144, bottom: 176 }), of: 'crusher@96,144' }),
        Object.freeze({ box: Object.freeze({ x: 128, right: 160, y: 144, bottom: 176 }), of: 'crusher@128,144' }),
    ]),
});

export function l42Part4Findings(replayed) {
    const drive = replayed?.get(L42_PART4_PAIR.drive);
    const control = replayed?.get(L42_PART4_PAIR.control);
    if (!drive || !control) {
        return [{
            name: 'R5 L42 part 4 pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[drive && L42_PART4_PAIR.drive, control && L42_PART4_PAIR.control]
                .filter(Boolean).join(', ') || 'neither'} — "the walk collected a totem `
                + 'part and left the room" is not evidence that two crushers were ever '
                + 'across the corridor, and in a pursuit room that is the whole claim',
        }];
    }
    const found = [];
    const dDead = drive.status?.dead_frames ?? 0;
    const cDead = control.status?.dead_frames ?? 0;
    const levels = (w) => [...new Set((w.stream?.ticks ?? []).map((t) => t.level))];
    /**
     * ⛓⛓⛓ THE CEREMONY, AND THIS ONE CARRIES A FADE TERM. The arms are the
     * same 1,920 ticks from the same boot, but the drive LOADS TWO ROOMS
     * and the control one — so the difference is the freeze PLUS one load,
     * and the load's own band is what the extra term is priced against.
     */
    const extraLoads = L42_PART4_PAIR.loads.drive - L42_PART4_PAIR.loads.control;
    const band = fadeBand(extraLoads);
    const residue = dDead - cDead - L42_PART4_PAIR.ceremonyFrames;
    found.push({
        name: '⛓⛓⛓ R5 L42 part 4: the FIFTH ceremony — the difference between the arms is '
            + 'the freeze plus ONE LOAD',
        ok: residue >= band.lo && residue <= band.hi,
        detail: `${dDead} dead against the control's ${cDead} — a difference of `
            + `${dDead - cDead} = ${L42_PART4_PAIR.ceremonyFrames} (the pickup) + `
            + `${residue} residue, against ${describeFadeBand(extraLoads)}. ⛔ Unlike L41's `
            + 'pair the fade does NOT cancel: this window crosses into L40 and the control '
            + 'never leaves L42, so the arms are one load apart and the extra load is a '
            + 'banded quantity ([[feedback_dead_frame_constant_is_per_level]]). '
            + '`hasTotemPart` is not in `Bot.itemReadout` (§20.8), so the frozen frames '
            + 'are the whole of the claim.',
    });
    /**
     * ⛓⛓⛓ THE ROUND TRIP, IN THE GAME'S OWN STREAM. The goal test for this
     * room is arrival -> part -> exit, and the only part of it the game can
     * be asked about directly is the door: the drive's levels are [42,40]
     * and the control's are [42].
     */
    found.push({
        name: '⛓⛓⛓ R5 L42 part 4: the drive TAKES THE EXIT and the control never leaves',
        ok: levels(drive).join() === '42,40' && levels(control).join() === '42',
        detail: `drive [${levels(drive).join(' ')}], control [${levels(control).join(' ')}]. `
            + '⛓ `teleporter@240,336` is ONE TILE BELOW the arrival, which is why the '
            + 'room\'s cost is the round trip and not the reach: slice 16\'s banked '
            + 'ordering collects the part and parks both bodies across the only way back. '
            + '⛔ And a re-entry would rebuild both crushers at their constructor cells — '
            + '`Crusher` writes no persistence of any kind — so the door has to come '
            + 'AFTER the part, never between two baits.',
    });
    /**
     * ⛓⛓ THE PARKS' WITNESS IS THE WALK, and it has to be, because a
     * crusher's position is in NO readout the game exposes (§30.4).
     */
    const inBox = (w, b) => (w.stream?.ticks ?? []).some((t) => t.level === 42
        && t.x >= b.x && t.x < b.right && t.y >= b.y && t.y < b.bottom);
    const dIn = L42_PART4_PAIR.dipsticks.filter((d) => inBox(drive, d.box));
    const cIn = L42_PART4_PAIR.dipsticks.filter((d) => inBox(control, d.box));
    found.push({
        name: '⛓⛓⛓ R5 L42 part 4: the drive stands inside BOTH constructor bodies, the '
            + 'control inside neither',
        ok: dIn.length === L42_PART4_PAIR.dipsticks.length && cIn.length === 0,
        detail: `drive ${dIn.length}/${L42_PART4_PAIR.dipsticks.length} `
            + `[${dIn.map((d) => d.of).join(' ') || 'none'}], control ${cIn.length} `
            + `[${cIn.map((d) => d.of).join(' ') || 'none'}]. Both bodies sit across rows `
            + '9,10 at cols 6..9 — the ONLY corridor to `totempart 4` — so the route walks '
            + 'through 32x32 of `type = "Solid"` twice. The control replays the same boot '
            + 'and the same arrival walk and then stands still at the first bait\'s '
            + 'stance, and the corridor stays shut.',
    });
    /**
     * ⛔ AND BOTH LEDGERS ARE EMPTY, which is a claim and not an absence:
     * `persistence_cleared` is DECLARED + EARNED, and this window declares
     * nothing and earns nothing.
     */
    const dCleared = [...clearedSet(drive.status)].sort();
    const cCleared = [...clearedSet(control.status)].sort();
    found.push({
        name: '⛔ R5 L42 part 4: BOTH ledgers are empty — the part writes save-file state',
        ok: dCleared.length === 0 && cCleared.length === 0,
        detail: `drive [${dCleared.join(' ') || 'empty'}], control `
            + `[${cCleared.join(' ') || 'empty'}]. L42 holds no \`Lock\`, no `
            + '`breakablerock` and no chest, and `BossTotemPart.removed()` is '
            + '`Player.hasTotemPartSet(4, true)` — SAVE-FILE state, not '
            + '`Game.setPersistence`. So the ceremony is the only thing either arm could '
            + 'have written and it writes nothing, which is why the frozen frames carry '
            + 'the whole claim.',
    });
    return found;
}

/**
 * ⛓⛓⛓ R5 SLICE 23 — THE TERMINAL WAND WINDOW, AND THE CLEANEST
 * SHUT-BEFORE CONTROL ON THE ARC.
 *
 * The SIXTH ceremony and the LAST window in `R5_ITINERARY`, unblocked by
 * the same slice's AS3 batch: the v6 `save` block presents
 * `hasTotemPart[]`, so `Wand.update`'s gate opens and a window that could
 * only ever be a chain tail becomes a boot like any other.
 *
 * ── ⛓⛓ WHAT MAKES THIS PAIR DIFFERENT FROM EVERY EARLIER ONE ─────────
 *
 * §36's taxonomy has three control shapes and this is a fourth, cleaner
 * than all of them: **the treatment is UNCHANGED and only the world's gate
 * moves.** §36.6 could not delete the kill (a live shooter's volley clock
 * is a function of whether it died); §33.7 could not hole the crusher
 * choreographies (the player ends up inside a body); §35's deletion changed
 * the world. Here both arms are the SAME TAPE — same boot, same spans, same
 * grants, same pins — one boot field apart.
 *
 * ⇒ they are byte-identical for ticks 0..9 and part at tick 10, **the
 * CONTACT tick**, because in one arm the world freezes there and in the
 * other it does not.
 *
 * ── ⛓⛓⛓ AND THE TWO ARMS STOP AT THE SAME NUMBER BY TWO MECHANISMS ───
 *
 * The drive runs north through the space the boss's wall occupied and is
 * caught by the CLAMP — `p.y := 212`, an ASSIGNMENT at the top of
 * `BossTotem.update` with no freeze test above it — at A+216 exactly. The
 * control's identical northward run is stopped by that same wall, a
 * COLLISION, at y 214.05 (the box's bottom edge 212 plus the player's 2 px
 * origin). **One number, two mechanisms, and the pair is what tells them
 * apart.**
 *
 * ⚠ AND THE FIRST CUT'S CONTROL COLLECTED THE WAND. The model gated the
 * approach FADE on `hasAllTotemParts()` and not the CONTACT — and
 * `Wand.update` gates both, because `super.update()` (`Pickup.update`, the
 * only caller of `collide("Player", …)`) is the ELSE of the alpha ramp
 * INSIDE the same `if`. The control woke the boss and reproduced the clamp
 * tick for tick. A control that does the thing it exists to refute is not a
 * weak control; it is not a control.
 */
export const L43_WAND_PAIR = Object.freeze({
    drive: 'r5-l43-wand',
    control: 'r5-l43-wand-control',
    level: 43,
    /** ⛓ The tick both arms' streams first disagree on — the CONTACT. */
    partsAtTick: 10,
    /**
     * ⛔ The frozen frames the DRIVE owes and the control does not, and they
     * are THREE spans rather than one:
     *   99   the approach FADE (`Wand.update`'s alpha ramp) — before contact
     *   150  `Pickup.specialTimer`
     *   186  the three tset-0 `fallrock`s, in ONE span (the earliest camera
     *        expiry ends the freeze for all of them)
     * plus the dialogue, whose length is the tape's own release cadence.
     */
    frozenSpans: Object.freeze({ fade: 99, specialTimer: 150, rocks: 186 }),
    /** ⛓ FOUR earned writes: the wand's own tag and one per rock. */
    earnedClears: Object.freeze([
        { level: 43, tag: 0 }, { level: 43, tag: 1 },
        { level: 43, tag: 2 }, { level: 43, tag: 3 },
    ]),
    /** The drive is clamped to this y; the control is walled at this one. */
    clampY: 212,
    controlWalledAtY: 214.05,
    clampOnsetSinceActivation: 216,
});

export function l43WandFindings(replayed) {
    const drive = replayed?.get(L43_WAND_PAIR.drive);
    const control = replayed?.get(L43_WAND_PAIR.control);
    if (!drive || !control) {
        return [{
            name: 'R5 L43 wand pair: SKIPPED — this sweep did not replay both arms',
            ok: true,
            skipped: true,
            detail: `have ${[drive && L43_WAND_PAIR.drive, control && L43_WAND_PAIR.control]
                .filter(Boolean).join(', ') || 'neither'} — "the walk took the wand" is `
                + 'not evidence that a boot field decided whether it could, and that is '
                + 'the whole claim of this pair',
        }];
    }
    const found = [];
    const items = (w) => w.status?.items ?? {};
    const save = (w) => w.status?.save ?? {};
    const yAt = (w, t) => (w.stream?.ticks ?? []).find((o) => o.t === t)?.y;

    /**
     * ⛓⛓⛓ THE BOOT FIELD ITSELF, read back from the GAME rather than
     * echoed from the tape. `botStatus.save.totem_parts` is
     * `Player.hasTotemPart(i)` — the same accessor `hasAllTotemParts()`
     * reads — so this is the presentation asserted against the gate's own
     * source and not against the tape that asked for it.
     */
    const dParts = save(drive).totem_parts ?? [];
    const cParts = save(control).totem_parts ?? [];
    found.push({
        name: '⛓⛓⛓ R5 L43 wand: the BOOT FIELD landed, in the game\'s own accessor',
        ok: dParts.length === 5 && dParts.every(Boolean)
            && save(drive).has_all_totem_parts === true
            && cParts.length === 5 && cParts.every((v) => v === false)
            && save(control).has_all_totem_parts === false,
        detail: `drive [${dParts.join(' ')}] has_all=${save(drive).has_all_totem_parts}, `
            + `control [${cParts.join(' ')}] has_all=${save(control).has_all_totem_parts}. `
            + 'Read through `Player.hasTotemPart(i)`, which is what '
            + '`Player.hasAllTotemParts()` reads — so this is the v6 `save` block '
            + 'asserted against the gate\'s own source rather than against the tape.',
    });

    /**
     * ⛓⛓⛓ THE COLLECTION, and it is the first `hasWand` this arc has ever
     * EARNED. Thirty-four of the rung's tapes grant an item; this one takes
     * the wand out of the world.
     */
    found.push({
        name: '⛓⛓⛓ R5 L43 wand: the DRIVE earns `hasWand` and the CONTROL does not',
        ok: items(drive).hasWand === true && items(control).hasWand === false,
        detail: `drive hasWand=${items(drive).hasWand}, control `
            + `hasWand=${items(control).hasWand}, and neither tape grants it `
            + '(the grants are sword/fire/conch/feather in both). '
            + '`Wand.removed()` is the only writer, and `removeSelf()` is the '
            + 'ceremony\'s LAST act — 99 fade frames, 150 `specialTimer` frames and a '
            + 'two-page dialogue after the contact.',
    });

    /**
     * ⛓⛓ THE LEDGER — four earned clears in the drive, none in the control.
     * ⛔ The wand's own tag AND one per rock, because `fall()`'s FIRST line
     * is `Game.setPersistence(tag, false)` — at TRIGGER time, 186 frames
     * before the landing.
     */
    const dCleared = [...clearedSet(drive.status)].sort();
    const cCleared = [...clearedSet(control.status)].sort();
    const want = L43_WAND_PAIR.earnedClears.map((f) => `${f.level}:${f.tag}`).sort();
    found.push({
        name: '⛓⛓ R5 L43 wand: FOUR earned clears — the wand\'s tag and one per rock',
        ok: dCleared.join() === want.join() && cCleared.length === 0,
        detail: `drive [${dCleared.join(' ') || 'empty'}], control `
            + `[${cCleared.join(' ') || 'empty'}], wanted [${want.join(' ')}]. `
            + '⛔ The rocks\' three are written at TRIGGER time — `fall()`\'s first '
            + 'line — 186 frames before any of them lands. And `{43,3}` is '
            + '`fallrock@176,384`, which seals the room\'s only shaft: after this '
            + 'window every L40 pit is a one-way trip into a sealed room, which is why '
            + 'the wand is LAST in the itinerary or it is nothing.',
    });

    /**
     * ⛓⛓⛓ THE CLAMP, IN THE GAME'S OWN STREAM. A 16 px teleport in one
     * tick, from a y no walk reaches by accident.
     */
    /**
     * ⚠ THE TICK IS DERIVED FROM THE STREAM, NOT WRITTEN DOWN. The first
     * cut hardcoded 55/56 — the schedule the pair had before the control's
     * refutation moved the press cadence from two ticks to 31 — and went
     * red on a run where the clamp fired perfectly, 83 ticks later. A
     * literal tick index in a finding is a coincidental predicate waiting
     * to rot. [[feedback_coincidental_predicate_rots]]
     *
     * ⛔⛔ AND THE SEARCH IS FOR THE **JUMP**, NOT FOR THE VALUE — which is
     * this file's own banked finding, applied one place too late. The
     * second cut looked for an observation equal to `clampY` and found the
     * player SETTLING onto it at the very end (211.95 -> 212, +0.05 px),
     * eleven ticks after the real event.
     *
     * `BossTotem` updates BEFORE the Player — `addUpdate` PREPENDS and the
     * Player is added at `Game.as:2092` against the boss's `:2121` — so the
     * assignment lands and then THAT SAME TICK's movement runs off it. The
     * clamp's own number is never an observation. What is unmistakable is
     * the DISPLACEMENT: ~14 px in one tick, against a walk that moves at
     * most ~1.2. [[feedback_divergence_tick_is_not_the_event]]
     */
    const ticks = drive.stream?.ticks ?? [];
    let jump = null;
    for (let i = 1; i < ticks.length; i += 1) {
        const dy = ticks[i].y - ticks[i - 1].y;
        // Southward, enormous, from north of the clamp, landing within one
        // walking step of it: only an assignment can do that.
        if (ticks[i - 1].y < L43_WAND_PAIR.clampY - 2 && dy > 10
            && Math.abs(ticks[i].y - L43_WAND_PAIR.clampY) < 2) {
            jump = { t: i, from: ticks[i - 1].y, to: ticks[i].y };
            break;
        }
    }
    found.push({
        name: '⛓⛓⛓ R5 L43 wand: the CLAMP is an ASSIGNMENT, and the stream shows the '
            + 'teleport',
        // ⛔ A WALK CANNOT DO THIS. The player moves at most ~1.2 px/tick,
        // so a jump of more than 2 px to exactly the clamp's y is not a
        // step — it is a write.
        ok: jump !== null,
        detail: jump === null
            ? '⛔ NO TELEPORT IN THE STREAM — the walk never got north of '
            + `${L43_WAND_PAIR.clampY}, so the clamp was never exercised and a green `
            + 'here would have meant nothing'
            : `tick ${jump.t - 1} y=${jump.from}, tick ${jump.t} y=${jump.to} — `
            + `${(jump.to - jump.from).toFixed(2)} px in ONE tick, against a walk `
            + 'that moves at most ~1.2 px/tick. ⛔ It does not land ON '
            + `${L43_WAND_PAIR.clampY}: the boss updates BEFORE the player, so the `
            + 'assignment is followed by that same tick\'s movement. '
            + '`if (p.y < y - originY + height) p.y = ...` sits at the TOP of '
            + '`BossTotem.update`, above the block that sets `fullyActivated` (which '
            + 'is why the onset is one tick after it) and with no freeze test above '
            + 'it. The player collides with nothing.',
    });

    /**
     * ⛓⛓ AND THE CONTROL IS STOPPED AT THE SAME NUMBER BY A DIFFERENT
     * MECHANISM — which is what makes the pair a measurement of the WAKE
     * rather than of the geometry.
     */
    const cNorth = Math.min(...(control.stream?.ticks ?? [])
        .filter((o) => o.t >= 28).map((o) => o.y));
    const dNorth = Math.min(...(drive.stream?.ticks ?? [])
        .filter((o) => o.t >= 28).map((o) => o.y));
    found.push({
        name: '⛓⛓ R5 L43 wand: the control is WALLED where the drive is CLAMPED',
        ok: Number.isFinite(cNorth) && Number.isFinite(dNorth)
            && cNorth > L43_WAND_PAIR.clampY && cNorth < 216
            && dNorth < L43_WAND_PAIR.clampY,
        detail: `control northernmost y ${Number.isFinite(cNorth) ? cNorth.toFixed(2) : '?'}, `
            + `drive ${Number.isFinite(dNorth) ? dNorth.toFixed(2) : '?'}. An UNWOKEN `
            + '`BossTotem` is `type = "Solid"` — the ELSE of `if (activated)` — across '
            + 'the arena\'s five open columns, `[112,192) x [180,212)`. A woken one is '
            + '`"Enemy"`, which is not in `Mobile.solids`. So the same 212 stops the '
            + 'control by COLLISION and the drive by ASSIGNMENT, 31 live ticks apart.',
    });

    /**
     * ⛔ AND THE ARMS ARE A BYTE-IDENTICAL PREFIX THAT PARTS AT THE CONTACT.
     */
    const dTicks = drive.stream?.ticks ?? [];
    const cTicks = control.stream?.ticks ?? [];
    let firstDiff = -1;
    for (let i = 0; i < Math.min(dTicks.length, cTicks.length); i += 1) {
        if (dTicks[i].x !== cTicks[i].x || dTicks[i].y !== cTicks[i].y
            || dTicks[i].level !== cTicks[i].level) { firstDiff = i; break; }
    }
    found.push({
        name: '⛓⛓ R5 L43 wand: the arms part at the CONTACT TICK and nowhere earlier',
        ok: firstDiff === L43_WAND_PAIR.partsAtTick,
        detail: firstDiff < 0
            ? '⛔ they never part — a pair that discriminates nothing'
            : `first divergence at observation ${firstDiff} (expected `
            + `${L43_WAND_PAIR.partsAtTick}): drive y ${dTicks[firstDiff].y}, control y `
            + `${cTicks[firstDiff].y}. One boot field decides whether `
            + '`Wand.update`\'s body runs at all, and its body contains the contact '
            + 'test — so the same input freezes one world and not the other, on the '
            + 'same tick.',
    });

    /**
     * ⛓⛓⛓ THE CEREMONY AS A SUBTRACTION, AND THE FADE TERM CANCELS.
     *
     * Both arms boot into level 43 and neither transitions, so both pay
     * exactly ONE room load — which means the difference between the two
     * `dead_frames` counters is the ceremony and nothing else. The same
     * shape as L41's pair (§30), and the strongest available: no band
     * arithmetic in it at all.
     *
     * ⛔ AND IT IS THREE SPANS, NOT ONE. 99 (the wand's approach FADE, which
     * no other pickup has) + 150 (`Pickup.specialTimer`) + 186 (the three
     * tset-0 rocks, sharing ONE span) + the dialogue, whose length is the
     * tape's own release cadence and is therefore read from the run rather
     * than asserted as a constant.
     */
    const dDead = drive.status?.dead_frames ?? 0;
    const cDead = control.status?.dead_frames ?? 0;
    const fixed = L43_WAND_PAIR.frozenSpans.fade
        + L43_WAND_PAIR.frozenSpans.specialTimer
        + L43_WAND_PAIR.frozenSpans.rocks;
    found.push({
        name: '⛓⛓⛓ R5 L43 wand: the ceremony is a SUBTRACTION — the fade term cancels',
        ok: dDead - cDead >= fixed && dDead - cDead <= fixed + 60,
        detail: `${dDead} dead against the control's ${cDead} — a difference of `
            + `${dDead - cDead}, against ${fixed} of fixed spans (99 fade + 150 `
            + 'specialTimer + 186 rocks) plus the DIALOGUE, whose length is the tape\'s '
            + 'own release cadence. Both arms boot into L43 and neither transitions, so '
            + 'both pay one room load and the fade term cancels — no band arithmetic in '
            + 'this claim at all.',
    });

    /** ⛔ TERMINAL, asserted as such. */
    const dLevels = [...new Set(dTicks.map((t) => t.level))];
    found.push({
        name: '⛔ R5 L43 wand: the window is TERMINAL — neither arm leaves level 43',
        ok: dLevels.join() === '43'
            && [...new Set(cTicks.map((t) => t.level))].join() === '43',
        detail: `drive [${dLevels.join(' ')}], control `
            + `[${[...new Set(cTicks.map((t) => t.level))].join(' ')}]. South is sealed `
            + 'by `fallrock@176,384` on the publishing tick; north is '
            + '`magicallock@144,112` behind a `WandShot` this model does not have, and '
            + 'the wake rewrites `playerPosition` to (144,352) so even a death respawns '
            + 'inside the sealed room.',
    });
    return found;
}

/**
 * ⛓⛓⛓ R5 SLICE 23 — THE `SAVE_FILE.data` AUDIT, FAMILY NOT INSTANCE.
 *
 * Slice 22 hit ONE wall — `Wand.update` reads `hasTotemPart[]` and the boot
 * block cannot present it — and wrote it down as an instance. This is the
 * audit that asks whether it is a family: **every** field of
 * `Main.SAVE_FILE.data`, diffed against what `Bot`'s boot block can
 * actually put there, with a disposition per field and a reason attached
 * to every skip. A bounded sweep must name what it bounded, and "no
 * further gaps" and "we only looked at the one that bit us" print the same
 * thing otherwise. [[feedback_bounded_sweep_must_name_what_it_bounded]]
 *
 * **THIRTY FIELDS**, enumerated by grep over `src/` rather than from the
 * getter list (the two agree; the grep is what makes that a finding).
 *
 * ── ⛓ NINETEEN WERE ALREADY COVERED ──────────────────────────────────
 * The thirteen item booleans via `grants`; `hitsMax` via `grants: health`
 * (an ADD over `Player.hitsMaxDef` = 3, not a flag); `primary` via
 * `equips`; `levelPersistence` via `persistence`; and `level` /
 * `playerPositionX` / `playerPositionY` via the `boot` block.
 *
 * ── ⛓⛓⛓ THREE ARE CLOSED BY THIS BATCH, AND THEY ARE A FAMILY ────────
 * All three are ARRAYS the boot block had no shape for at all:
 *
 * ```
 *   hasTotemPart[5]   Wand.update <- Player.hasAllTotemParts()   THE WAND
 *   hasKey[5]         BossLock.update <- Player.hasKey(keyType)  BOSS DOORS
 *   hasSealPart[16]   FinalDoor.update <- hasAllSealParts()      THE ENDING
 * ```
 *
 * ⇒ the wall really was a family, and the instance was the third of three.
 *
 * ── ⛔⛔ TWO WERE `EVALUATE` AND BOTH CAME BACK "NO CONSUMER" ──────────
 *
 * **`time`** is read by gameplay — that half of the question is YES, and by
 * more than `Game.as:1755`'s docblock claims. That block says "the
 * genuinely `Game.time`-coupled family is ONE class"; the grep finds
 * `Spinner.update` (`hammerAngle`, and the `collideLine` under it calls
 * `player.hit`), `LightPole.render` (which ASSIGNS `y`, so a hit rect
 * moves), `LavaChain` and `BeamTower` (both via `worldFrame`). But the
 * batch does not need a field: `botStatus.game_time` has been a READOUT
 * since slice 3, so phase is a MEASUREMENT rather than a derivation with a
 * band; a fresh page boots `Main.time`'s own default `Game.dayLength / 2`;
 * and **no `Game.time`-coupled entity stands in any R5 window or in the
 * planned L43 one** (L43 holds fallrocks, a bosstotem, a watcher,
 * dungeonspires, orbs, a magicallock and two doors — none of them reads
 * it). ⚠ The verdict flips the moment a window needs a hazard phase no
 * real prefix can reach; until then a writable `time` would be the first
 * boot field that makes the model LESS faithful rather than more.
 *
 * **`secondary`** is `Player.as:1565`'s `useItem(Main.secondary)` — the C
 * key. **Zero of the 98 committed tapes press C** (the key histogram is
 * right/left/down/up/primary and nothing else), and `equips` already
 * covers `primary`, which is the slot X reads. One more field on the equip
 * directive covers it the day a rung presses C.
 *
 * ── ⛔ SIX ARE DOCUMENT-SKIP, EACH WITH ITS OWN REASON ────────────────
 *
 * `beam` and `rockSet` are BOTH the single `moonrock@240,256` in LEVEL 0,
 * and the skip is stronger than "no reader": the one downstream effect
 * that outlives the room is `Moonrock.as:135` swapping L0's `Stairs` for a
 * `Teleporter` and clearing `{0,2}` — **a persistence tag the boot block
 * already reaches**. So the capability exists; it is spelled
 * `persistence: [{level: 0, tag: 2}]`. `levelWorld` already models the
 * unset state exactly (a `moonrock` is not among L0's solids).
 *
 * `grassCut` and `hasBadge` have no gameplay reader at all: `grassCut`'s
 * only consumer is its own setter's 10,000-cut medal, and `hasBadge`'s is
 * `Main.update`'s Newgrounds/Kongregate submission loop.
 *
 * `firstUse` and `extended` are the inventory tutorial, which R1's one-line
 * `Inventory.help = false` already gates at its source. ⛓⛓ **AND THEY ARE
 * THE ONE PLACE THIS BATCH TOUCHES SOMETHING IT DID NOT SET OUT TO**:
 * `Inventory.as:178` sets `extended` as soon as
 * `Player.hasTotemPartNumber() > 0`, so **presenting a totem part FLIPS
 * `extended` on the first inventory update** — and the only thing that
 * makes that inert is R1's line, which turns the setter's tutorial into a
 * no-op and leaves it writing `offsetMax.x` (a render offset) and nothing
 * else. A batch that had shipped the boot field without R1's line would
 * have deadlocked every v6 tape.
 */
export const SAVE_FILE_AUDIT = Object.freeze({
    fields: 30,
    source: 'Main.as — grep of SAVE_FILE.data.* over src/, 2026-08-07',
    /** ⛓ Already reachable before this batch. */
    covered: Object.freeze([
        Object.freeze({ field: '13 item booleans', via: 'grants' }),
        Object.freeze({ field: 'hitsMax', via: 'grants: health',
            note: 'an ADD over Player.hitsMaxDef = 3, not a flag' }),
        Object.freeze({ field: 'primary', via: 'equips' }),
        Object.freeze({ field: 'levelPersistence', via: 'persistence' }),
        Object.freeze({ field: 'level, playerPositionX, playerPositionY', via: 'boot' }),
    ]),
    /** ⛓⛓⛓ Closed by the slice-23 batch — a FAMILY, not an instance. */
    closed: Object.freeze([
        Object.freeze({ field: 'hasTotemPart', slots: 5, kind: 'Boolean',
            gate: 'Wand.update <- Player.hasAllTotemParts() (Player.as:1709)',
            unblocks: 'the L43 terminal wand window as a BOOT rather than a chain tail' }),
        Object.freeze({ field: 'hasKey', slots: 5, kind: 'Boolean',
            gate: 'BossLock.update <- Player.hasKey(keyType) (BossLock.as:63)',
            unblocks: 'a boss-door window without a real-collect in the same window' }),
        Object.freeze({ field: 'hasSealPart', slots: 16, kind: 'int',
            gate: 'FinalDoor.update <- SealController.hasAllSealParts()',
            unblocks: "R6's ending gate",
            shape: 'IDENTITY SLOTS — getSealPart writes the identity into the first '
                + 'slot still holding -1, so the array is an ordered collection LOG '
                + 'and hasAllSealParts() is "the LAST slot is filled"' }),
    ]),
    /** ⛔ Evaluated and decided — no field, with the reason. */
    evaluated: Object.freeze([
        Object.freeze({
            field: 'time',
            gameplayReaders: Object.freeze(['Spinner.update (hammerAngle -> the '
                + 'collideLine that calls player.hit)', 'LightPole.render (ASSIGNS y, '
                + 'so the hit rect moves)', 'LavaChain (worldFrame gates the extend)',
                'BeamTower (worldFrame position bob)']),
            correctsGameAs1755: 'that docblock says the Game.time-coupled family is ONE '
                + 'class; the grep finds four, two of them outside the worldFrame set',
            verdict: 'NO FIELD',
            why: 'botStatus.game_time has been a READOUT since slice 3, so phase is a '
                + 'measurement; a fresh page boots Main.time\'s own dayLength/2 default; '
                + 'and no Game.time-coupled entity stands in any R5 window or in L43',
            wouldFlipIf: 'a window needs a hazard phase no real prefix can reach',
        }),
        Object.freeze({
            field: 'secondary',
            verdict: 'NO FIELD',
            why: 'Player.as:1565 is the C key and ZERO of the 98 committed tapes press '
                + 'C; `equips` covers `primary`, which is what X reads',
        }),
    ]),
    /** ⛔ Skipped, each with its own named reason. */
    skipped: Object.freeze([
        Object.freeze({ field: 'beam', why: 'Moonrock\'s trigger; ONE instance, level 0' }),
        Object.freeze({ field: 'rockSet',
            why: 'the same instance. Its one lasting effect — Moonrock.as:135 swapping '
                + 'L0\'s Stairs for a Teleporter — clears {0,2}, a persistence tag the '
                + 'boot block ALREADY reaches, so the capability exists under another '
                + 'name' }),
        Object.freeze({ field: 'grassCut', why: 'no gameplay reader — the only consumer '
            + 'is its setter\'s 10,000-cut medal' }),
        Object.freeze({ field: 'hasBadge', why: 'no gameplay reader — Main.update\'s '
            + 'Newgrounds/Kongregate submission loop' }),
        Object.freeze({ field: 'firstUse', why: 'the inventory tutorial, gated at its '
            + 'source by R1\'s Inventory.help = false' }),
        Object.freeze({ field: 'extended', why: 'likewise; its one non-tutorial effect '
            + 'is Inventory.as:336\'s offsetMax.x, a render offset' }),
    ]),
    /**
     * ⛓⛓ THE INTERACTION THE AUDIT FOUND, which is the reason a per-field
     * sweep is worth more than fixing the instance.
     */
    interaction: '`Inventory.as:178` sets `extended` as soon as '
        + '`Player.hasTotemPartNumber() > 0`, so the totem-part boot field FLIPS a '
        + 'field this audit classified as skip — and the flip is inert only because '
        + 'R1\'s `Inventory.help = false` turns the setter\'s tutorial into a no-op. '
        + 'Without that line every v6 tape would deadlock on a Help nothing can dismiss.',
});

/**
 * ⛓⛓⛓ R5 SLICE 22 — THE RUNG-CLOSING ITINERARY, AND THE EXIT CRITERIA
 * AGAINST §0, WITH WHAT IS AND IS NOT MET.
 *
 * §0's target is **14/14 over ONE FULL PLAYTHROUGH** — thirteen booleans
 * plus `hitsMax == 4` as a positive — with `grants` EMPTY throughout and
 * `noDamage` RETIRED. Forty-two committed R5 tapes later, this is where
 * that stands, derived from the tapes rather than remembered:
 *
 * ── ⛓ WHAT THE RUNG REAL-COLLECTS ────────────────────────────────────
 *
 * ```
 *   conch        r5-d5-conch
 *   feather      r5-feather
 *   bosskey 1    r5-bosskey-leg
 *   totem parts  r5-l40-part0, r5-l40-part1, r5-shaft, r5-l41-part3,
 *                r5-l42-part4   — FIVE ceremonies, all five parts
 * ```
 *
 * ⛔⛔⛔ **AND EVERY ONE OF THEM IS A SEPARATE WINDOW THAT GRANTS WHAT AN
 * EARLIER ONE EARNED.** Thirty-four of the forty-one tapes declare a
 * `grants` list, most of them the same four (`conch+feather+fire+sword`).
 * The rung has proved every LINK and has never once run the CHAIN — which
 * is precisely §0's "one full playthrough" and precisely what is left.
 *
 * ⛔ AND `fire` IS NOT AMONG THEM. `r5-bobboss-fire` drives the kill that
 * SPAWNS it (the out-of-band `{32,-1}` write) and no committed tape
 * collects the pickup, so `fire` is granted everywhere and earned nowhere.
 * It is the head of §0's own chain, which makes it the itinerary's first
 * real link rather than a loose end.
 */
export const R5_ITEM_LEDGER = Object.freeze({
    realCollected: Object.freeze(['conch', 'feather', 'bosskey:1',
        'totempart x5 (part0, part1, shaft, part3, part4)',
        // ⛓⛓⛓ R5 slice 23 — the SIXTH ceremony, and the first `hasWand`
        // this arc has EARNED rather than granted.
        'wand (r5-l43-wand, TERMINAL)']),
    grantedEverywhere: Object.freeze(['sword', 'fire', 'conch', 'feather']),
    /** ⛔ Earned nowhere: the kill that spawns it is driven, the pickup is not. */
    spawnedButNotCollected: Object.freeze(['fire']),
    tapesDeclaringGrants: 36,
    tapesTotal: 43,
    against: '§0 — 14/14 over ONE full playthrough with `grants` EMPTY throughout',
    verdict: 'every LINK is proved and the CHAIN has never been run',
});

/**
 * ⛔⛔⛔ AND `noDamage` IS NOT RETIRED — WITH A NAMED FIRST BLOCKER THAT IS
 * NOT A POLICY.
 *
 * Forty of the forty-one R5 tapes declare it; the exception is
 * `r5-contact-control-on`, an 80-tick pair arm whose whole purpose is to
 * show the flag does something. §0 says "avoid where possible, kill where
 * required", and until R5 slice 22 the flag was a POLICY: nothing in the
 * model could be hurt, so turning it off changed nothing on this side.
 *
 * ⛓⛓⛓ IT IS A MISSING MECHANIC NOW, AND THE BLAST IS WHAT NAMED IT.
 * `levelRun` THROWS if a blast reaches the player on a tape without
 * `noDamage`, because `Player.hit` would write `hits`, `hitsTimer` and
 * `Game.shake` and this model carries none of the three. So retiring the
 * flag is no longer "decide to stop declaring it" — it is
 *
 *   1. a PLAYER DAMAGE model (`hits`, `hitsTimer`, the i-frame colour
 *      cycle, `die()` and the respawn at `playerPosition`);
 *   2. `Game.shake`, which is `Math.random` and would make the CAMERA
 *      non-deterministic — and since R5 slice 22 the camera is load-bearing
 *      for enemy `onScreen` gating, so a shaking camera is a model boundary
 *      rather than a cosmetic one (`camera.stepCamera` already refuses);
 *   3. and a route that survives, which is the part §0 actually asked for.
 *
 * ⇒ term 2 is the interesting one: `noDamage` was a damage policy and it
 * has become a DETERMINISM pin. [[feedback_the_obstacle_is_the_machine]]
 */
export const R5_NODAMAGE_STATUS = Object.freeze({
    retired: false,
    tapesDeclaringIt: 42,
    theOneWithout: 'r5-contact-control-on',
    wasAPolicy: 'through slice 21 — nothing in the model could be hurt',
    isNowAMissingMechanic: true,
    blockers: Object.freeze([
        'a player damage model — `hits`, `hitsTimer`, the i-frame cycle, `die()` and '
            + 'the respawn at `playerPosition`',
        // ⛓⛓⛓ R5 SLICE 23: DOWNGRADED FROM A DETERMINISM BOUNDARY TO A
        // MODELLING COST, and the evidence is the RUNTIME's source rather
        // than an argument.
        //
        // `SWFModernRuntime/src/avm2/avm2_number.c:481` — `Math.random()` is
        // a 31-bit XOR-shift LFSR plus `avm2_random_pure_hasher`, over ONE
        // global `g_avm2_rng`, seeded from `MOCK_DATE_TIME` (a
        // `-D` at build time, defaulted to 981152406000 by
        // `build_wasm_avm2.sh`) and from a hard-coded 987654321 without it.
        // ⇒ **`Math.random()` IS DETERMINISTIC AND REPRODUCIBLE ON THIS
        // ARTIFACT.** A shaking camera cannot make a RECORDING flaky, which
        // is what "determinism pin" meant; what it costs is knowing the
        // global draw COUNT, which is a modelling job like the sound index
        // draws.
        //
        // ⚠ AND THE SEED IS BAKED INTO THE BUILD. If `MOCK_DATE_TIME` ever
        // changes, the whole `Math.random` stream shifts and every fixture
        // whose walk touches a consumer moves with it — the artifact hash is
        // the only thing that pins it, which is why the R0 gate is stated in
        // terms of the hash transition.
        '`Game.shake` — two `Math.random()` draws per shaking tick, which moves the '
            + 'CAMERA, and the camera gates every enemy\'s `onScreen`. ⛓ NOT a '
            + 'determinism boundary on this artifact: the recompiled runtime\'s '
            + '`Math.random` is a fixed-seed LFSR (avm2_number.c:481), so the draws '
            + 'are reproducible and the cost is MODELLING the global draw count. '
            + '`camera.stepCamera` still refuses a non-zero shake by name.',
        'a route that survives — which is the half §0 asked for',
    ]),
    /**
     * ⛓⛓⛓ R5 SLICE 23: the EVALUATE the AS3 batch was asked to make, and
     * the answer is NO FLAG.
     *
     * A `pins: ["camera_shake"]` that forced `Game.shake = 0` would create an
     * execution the vanilla game CANNOT produce — vanilla always shakes when
     * a rock lands — so it would break the pin doctrine at its own
     * definition ("select which vanilla-reachable execution the run gets and
     * create no vanilla-unreachable one"). And it is not needed: the draws
     * are reproducible. ⇒ model-side, and the flag stays unbuilt.
     */
    cameraShakeFlag: Object.freeze({
        built: false,
        verdict: 'NO FLAG — model-side',
        why: 'forcing `Game.shake = 0` is an execution vanilla cannot produce, so it '
            + 'would be a CRUTCH wearing a pin\'s name; and the recompiled runtime\'s '
            + '`Math.random` is a fixed-seed LFSR, so nothing about the shake is '
            + 'non-reproducible in the first place',
        evidence: 'SWFModernRuntime/src/avm2/avm2_number.c:430-486 — `g_avm2_rng`, '
            + 'one global XOR-shift LFSR seeded from `MOCK_DATE_TIME` at build time',
    }),
    firstRefusal: '`levelRun`: a blast that reaches the player on a tape without '
        + '`noDamage` throws rather than being modelled',
});

/**
 * ⛓⛓ THE RUNG-CLOSING ITINERARY — the window chain, in order, with what
 * each earns and what still blocks the join.
 *
 * ⚠ THIS IS THE PLAN, NOT A DRIVEN RESULT. Every window in it exists as a
 * committed pair or leg; what has never been driven is the SEQUENCE, and
 * the two named blockers are why.
 */
export const R5_ITINERARY = Object.freeze({
    windows: Object.freeze([
        Object.freeze({ n: 1, at: 'L32', earns: 'the BobBoss kill, and the `fire` pickup '
            + 'it spawns', tape: 'r5-bobboss-fire', blocked: 'the pickup is not collected '
            + 'by any committed tape — the first real link of §0\'s own chain' }),
        Object.freeze({ n: 2, at: 'L47/L44', earns: 'conch, then `canSwim`',
            tape: 'r5-karlore-fire -> r5-d5-conch', blocked: null }),
        Object.freeze({ n: 3, at: 'L87', earns: 'feather', tape: 'r5-feather', blocked: null }),
        Object.freeze({ n: 4, at: 'L29/L30', earns: 'boss key 1', tape: 'r5-bosskey-leg',
            blocked: null }),
        Object.freeze({ n: 5, at: 'L40/L41/L42/L39', earns: 'all five totem parts',
            tape: 'r5-l40-part0, r5-l40-part1, r5-shaft, r5-l41-part3, r5-l42-part4',
            blocked: '⛔ parts 3 and 4 BOOT into clusters their own arrivals cannot '
                + 'reach (§28.5, §32), and the L40 chain from its own arrival stops at '
                + 'LINK 5 — one corpse, two holds, and the corpse cannot cross '
                + '(`L40_LINK4_REPAIRED.corpseReach`)' }),
        // ⛓⛓⛓ R5 SLICE 23: UNBLOCKED, AND IT IS A BOOT AFTER ALL. The
        // AS3 batch's v6 `save` block presents `hasTotemPart[]`, so the
        // window that could only ever be a chain tail is a window like any
        // other — recorded as `r5-l43-wand` / `-control`.
        Object.freeze({ n: 6, at: 'L43', earns: 'the wand — TERMINAL',
            tape: 'r5-l43-wand', blocked: null }),
    ]),
    /**
     * ⛔⛔⛔ AND WINDOW 6 IS LAST OR IT IS NOTHING. The wand is the tset-0
     * publisher and `fallrock@176,384` seals L43's only shaft on the
     * publishing tick — so after it, EVERY L40 pit is a one-way trip into a
     * sealed room (§34.2 with §27).
     */
    wandIsLast: true,
    /**
     * ⛔ The two things that stop the sequence being driven today.
     *
     * ⛓ R5 SLICE 23 SHORTENED THE SECOND ONE BY A WINDOW. The wand is no
     * longer among the rooms that need a page which has walked there: the
     * v6 `save` block boots it. What remains is parts 3 and 4.
     */
    blockedOn: Object.freeze([
        'THE L40 CHAIN — from its own arrival it stops at link 5, and the census says '
            + 'there is no second holder (`L40_LINK4_REPAIRED.holderCensus`). ⛔ AND IT '
            + 'DOES NOT DISSOLVE AT R6: `Puzzlements/WandLock.as` is a bare `extends '
            + 'Lock` with a different sprite and NO override of any kind, so the wand '
            + 'ITEM opens nothing — a WandLock is a Lock and needs its group pressed.',
        'THE BOOT-vs-ARRIVAL GAP — parts 3 and 4 boot into clusters their own arrivals '
            + 'cannot reach. ⛓ The WAND no longer does: slice 23\'s v6 `save` block '
            + 'boots `hasTotemPart[]`, so window 6 is a window like any other.',
    ]),
});

/**
 * ⛓⛓ WHAT R6 INHERITS, AS A LIST RATHER THAN AS A SENTENCE.
 *
 * ⚠ THE AS3 BATCH IS THE HEADLINE, and it is TWO LINES of source that
 * unblock two different walls. This rung's zero-build rule forbids both, so
 * they are a decision about the RUNG rather than about a slice — which is
 * why they are written down here instead of being done.
 */
export const R6_INHERITS = Object.freeze({
    /**
     * ⛓⛓⛓ SHIPPED AT R5 SLICE 23 — the batch R6 was going to inherit was
     * brought forward and EXPANDED, and this is what it closed.
     *
     * ⚠ KEPT AS A LIST OF WHAT WAS BUILT rather than deleted, because the
     * next rung's first question about any of these is "what does it cover
     * and what did it deliberately leave out", and the answer is `shipped`
     * plus `SAVE_FILE_AUDIT`.
     */
    as3Batch: Object.freeze([
        Object.freeze({
            what: 'an ENEMY-STATE readout on `Bot.botStatus`',
            shipped: 'R5 slice 23 — as `botMobiles()`, its OWN ExternalInterface '
                + 'callback rather than a field on `botStatus`',
            why: 'every enemy claim this rung makes is witnessed by what it OPENS. A '
                + 'turret kill opens nothing — `IceTurret.death()` intercepts the '
                + 'removal, so `classCount` never moves and no persistence is written — '
                + 'so the ONLY witness that `r5-l40-part5` killed anything is a button '
                + 'going down two presses later.',
            asBuilt: '⛓ EVERY `Mobile`, not every `Enemy`, in UPDATE ORDER, as RAW '
                + 'FIELDS — position, velocity, `type`, `destroy`, anim/frame/alpha, '
                + '`onScreen()`, plus a nested `enemy` object that is `null` for a row '
                + 'that is not one. `Enemy` was what the wall named, but choosing it '
                + 'would have been a GUESS about which movers a later question is '
                + 'about, and R5\'s two hardest measurements were about an '
                + '`IceTurretBlast` and a `PushableBlock` — neither of which is one. '
                + '⛔ AND IT IS A SEPARATE CALLBACK BY DESIGN: `botStatus` is polled '
                + 'on the same thread as the loop whose render/update RATIO the '
                + 'dead-frame band rides on, so a world walk plus reflection on every '
                + 'poll is a determinism risk. A callback nobody calls is inert by '
                + 'CONSTRUCTION, which is stronger than a flag defaulting to off.',
        }),
        Object.freeze({
            what: 'a `hasTotemPart[]` BOOT FIELD',
            shipped: 'R5 slice 23 — as tape version 6\'s `save` block, covering ALL '
                + 'THREE save arrays rather than the one that bit',
            why: 'ONE line. `Wand.update` is gated on `Player.hasAllTotemParts()`, which '
                + 'reads `SAVE_FILE.data.hasTotemPart[]` — a different array from '
                + '`levelPersistence`, and `Bot`\'s boot block honours only `grants` and '
                + '`persistence`. Without it the L43 window can only ever be the tail of '
                + 'a full itinerary; with it, it is a window like any other.',
            asBuilt: '⛓ THE WALL WAS A FAMILY. `SAVE_FILE_AUDIT` diffed all thirty '
                + '`SAVE_FILE.data` fields against the boot block: `hasTotemPart[5]`, '
                + '`hasKey[5]` and `hasSealPart[16]` were all unreachable, and the '
                + 'third is R6\'s own ending gate (`FinalDoor` <- '
                + '`SealController.hasAllSealParts()`). ⛔ `hasSealPart` is an INT '
                + 'array with IDENTITY SLOTS, not a boolean array — the one way to '
                + 'build this field wrong and have it read right.',
        }),
        Object.freeze({
            what: 'a `Game.shake` / camera determinism flag',
            shipped: '⛔ NOT BUILT, and the EVALUATE is why — see '
                + '`R5_NODAMAGE_STATUS.cameraShakeFlag`',
            why: 'the recompiled runtime\'s `Math.random` is a fixed-seed LFSR '
                + '(`avm2_number.c:481`), so a shaking camera is reproducible; and '
                + 'forcing `Game.shake = 0` would be an execution vanilla cannot '
                + 'produce, i.e. a crutch wearing a pin\'s name.',
            asBuilt: null,
        }),
    ]),
    /** ⛓ What the slice-23 batch left DELIBERATELY unreached, with reasons. */
    as3NotTaken: Object.freeze([
        '`time` — gameplay reads it (Spinner\'s hammer, LightPole\'s y, LavaChain, '
            + 'BeamTower) but `botStatus.game_time` already makes phase a MEASUREMENT, '
            + 'and no `Game.time`-coupled entity stands in any R5 window or in L43',
        '`secondary` — the C key, and zero of the 98 committed tapes press it',
        '`beam` / `rockSet` — one `moonrock` in level 0, whose only lasting effect is '
            + 'a persistence clear (`{0,2}`) the boot block already reaches',
        '`grassCut` / `hasBadge` — no gameplay reader at all',
        '`firstUse` / `extended` — the inventory tutorial, gated at its source by R1\'s '
            + '`Inventory.help = false`. ⛓ AND THE TOTEM-PART FIELD FLIPS `extended` '
            + '(`Inventory.as:178` reads `hasTotemPartNumber() > 0`), which is inert '
            + 'ONLY because of that line',
        '`saw_auto_advance` counting on `Game.freezeObjects` rising rather than on its '
            + 'two known raisers — `sealCeremony.SEAL_AUTOADVANCE_BLIND_SPOT`, owed '
            + 'since R3 and still owed: it is NOT byte-inert and would move the '
            + 'reported value for committed fixtures',
    ]),
    mechanics: Object.freeze([
        'the BOSS KEYS and `bosslock@480,352` — `keyType` 2, behind L40 link 9. ⛓ The '
            + 'v6 `save.keys` block can now PRESENT one, so a bosslock window no '
            + 'longer has to real-collect its key in the same visit',
        '`magicallock@144,112` — opened by a `WandShot`, which is a projectile this '
            + 'model does not have (the THIRTEENTH family, after `IceTurretBlast` and '
            + '`BossTotem`)',
        'the BOSS itself — `hitsMax` 5, `onlyHitBy = "Wand"`, and L43 opens on its '
            + 'death. ⛓ Its WAKE is modelled now (`bossTotem.js`); what is not is '
            + 'everything from `activationRestTime` draining onward — the walk, the '
            + 'jump and the laser — which is why `levelRun` THROWS at A+335 rather '
            + 'than carrying on',
        'PLAYER DAMAGE, which is what `noDamage`\'s retirement now costs — see '
            + '`R5_NODAMAGE_STATUS`, whose second blocker slice 23 downgraded from a '
            + 'determinism boundary to a modelling cost',
        'the ENDING — `FinalDoor.update` needs `SealController.hasAllSealParts()` AND '
            + '`!Game.checkPersistence(0, 114)` (the Watcher). ⛓ The first is now '
            + 'presentable through `save.seal_parts` and the second through '
            + '`persistence`, so R6 can boot the ending room rather than having to '
            + 'walk sixteen chests to it',
    ]),
    /**
     * ⛔ ONE R6 ROUTE FACT, CHECKED WITH A SINGLE GREP AND RECORDED EITHER
     * WAY — because "the locks at link 5 are WANDLOCKS" invites exactly the
     * inference this refutes.
     *
     * `Puzzlements/WandLock.as` is NINETEEN LINES: `public class WandLock
     * extends Lock`, an embedded sprite, and a constructor that forwards to
     * `super(_x, _y, _t, _tag, sprWandLock)`. **No override of anything.**
     * So a `WandLock` opens exactly as a `Lock` does — its group being
     * pressed, or `tSet == -1` and `totalEnemies() == 0` — and the WAND ITEM
     * has nothing to do with it. The name is a SPRITE.
     *
     * ⇒ **link 5's wall does not dissolve one rung later.** R6's route
     * should know that from day one rather than planning around a door the
     * wand opens.
     */
    wandDoesNotOpenAWandLock: Object.freeze({
        checked: 'R5 slice 23, `Puzzlements/WandLock.as` read in full',
        overrides: 0,
        verdict: 'a WandLock is a Lock with a different sprite; the wand ITEM opens '
            + 'nothing',
        consequence: 'L40 link 5\'s wall is a STANDING finding, not a temporary one — '
            + 'the corpse still cannot cross and there is still no second holder',
    }),
});

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
        ...pressPairFindings(replayed),
        ...shaftFindings(replayed),
        ...l40Part1Findings(replayed),
        ...l41Part3Findings(replayed),
        ...l42Part4Findings(replayed),
        ...l43WandFindings(replayed),
    ];
}
