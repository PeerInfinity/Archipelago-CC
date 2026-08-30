/**
 * seedlingDemo/bobBoss — the L32 encounter, transcribed.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 2.
 *
 * `chasers.js` is the exact per-tick arithmetic for two ordinary enemies.
 * This is the other kind of thing entirely: a SCRIPT. Three forms, a rock
 * that writes the player's respawn point, three auto-starting dialogues, two
 * scripted teleports, a text ceremony, and an item whose `removed()` writes
 * a persistence flag in a level the player is not standing in. None of it is
 * a press schedule and none of it is planner-reachable — it is
 * hand-authored, which is exactly why every number in it is written down
 * beside the line it came from.
 *
 * ── ⛔ FIVE THINGS THE SOURCE SAYS THAT §2.6.1 DOES NOT ───────────────
 *
 * **1. The arm threshold is derived, not stated.** `FallRockLarge.update`
 * is `if (!p.fallFromCeiling && p.y < fallTo - sprRock.height / 2 - 8)`.
 * `fallTo` is the CONSTRUCTED y — the ctor is `super(_x + Tile.w, _y +
 * Tile.h)`, so `@64,128` becomes 144 — and the sprite is 32 tall. 144 - 16
 * - 8 = **120**, against an arrival at y = 128.
 *
 * **2. The 174 frames are three phases and the last one is the longest.**
 * 60 ticks of `waitToFallTimer`, then a `vy += 0.6` fall from y = -32 to
 * y >= 144 — 24 steps, because 0.3·n·(n+1) first reaches 176 at n = 24 —
 * then 90 ticks of `cameraTimer`, and only when it hits ZERO does
 * `new BobBoss(72,72)` appear and `Game.freezeObjects` go false. The
 * fifteen frames of "~174" are not slack; they are 1 + 60 + 24 + 90 - 1.
 *
 * **3. Form 1 has no `hitsMax` line at all.** `BobBoss`'s switch sets it to
 * 2 for form 0 and 2 for form 2 and says nothing for form 1, which
 * therefore keeps `Enemy.hitsMax = 3`. 2 + 3 + 2 = 7 is an arithmetic
 * consequence of a MISSING case, so a transcription that copied the three
 * cases would have written 2 + ? + 2.
 *
 * **4. The boss cannot be knocked back, at all.** `BobBoss.hit` ends with
 * `super.hit(0, null, d, t)` — force zero AND point null — so
 * `Enemy.knockback`'s `if (p && ...)` never runs. Its position is chase and
 * nothing else, which is what makes a fixed stance viable in a room with no
 * cover.
 *
 * **5. `player.hits = 0` is written by the BOSS, on the last frame of every
 * form transition** (`BobBoss.death`, beside `receiveInput = true`). The R5
 * batch's `hits` readout can SEE that, which turns "the walk was never hit"
 * from an inference off exactness into a two-sided reading — but it also
 * means a `hits` sampled after a transition says nothing about the form
 * before it.
 *
 * ── ⛔ AND THE ARENA'S EXIT NEEDS THE ITEM THE ARENA GRANTS ───────────
 * `control@64,0` names `fallthrough = 30`, and both pit tiles it applies to
 * are covered by `burnabletree@64,0` — a 32x32 `type = "Solid"` whose only
 * removal path is `hit("Fire")`. So the fallen rock seals the stairs, the
 * burnable tree seals the pit, and `fire`'s first use in the whole arc is
 * getting out of the room it was won in.
 *
 * ── ⚠ WHAT IS NOT HERE, AND WHY ───────────────────────────────────────
 * There is no tick-by-tick schedule in this module, because the unit one
 * would be written in is not knowable from the source. `Bot.update` skips
 * the tape on `blackCover > 0 || Game.freezeObjects`, so a frozen frame
 * costs no tape tick — but `Game.freezeObjects` is a sticky static with
 * several writers and no per-frame reset, and R3 measured a pickup's phase
 * B consuming one tape tick per frame while the player still could not
 * move. Which of those two the `BobBossNPC` dialogues are is a
 * MEASUREMENT, and `r5-bobboss-arm` is where it is made. What lives here is
 * everything that is a fact about the game rather than about the harness.
 */

export class BobBossError extends Error {
    constructor(message) { super(message); this.name = 'BobBossError'; }
}
const fail = (m) => { throw new BobBossError(m); };

/** `assets/levels/Dungeon3/11.oel` — 10x10, all open floor. */
export const ARENA = Object.freeze({
    level: 32,
    /** `stairsup@224,160` in L30 constructs `new Game(32, 72, 120)`. */
    boot: Object.freeze({ x: 72, y: 120 }),
    /** ...and every entity ctor adds Tile/2, the player included. */
    arrival: Object.freeze({ x: 80, y: 128 }),
    /** `BobBoss(72,72)` -> `BobSoldier`'s `+ Tile/2`. */
    bossAt: Object.freeze({ x: 80, y: 80 }),
    /** `(FP.world as Game).playerPosition = new Point(72, 104)` — the RESPAWN. */
    respawn: Object.freeze({ x: 72, y: 104 }),
    /** `player.x = FP.width / 2; player.y = FP.height - 40` on a transition. */
    transitionTo: Object.freeze({ x: 80, y: 120 }),
});

/**
 * `Scenery/FallRockLarge.as`, in its own numbers.
 *
 * ⚠ `armY` is DERIVED (see header note 1) and `sealsRect` is the ctor's own
 * `setHitbox(32, 32, 16, 16)` around the constructed position — which lands
 * exactly on the stairs alcove, tiles (4,8) (5,8) (4,9) (5,9).
 */
export const ROCK = Object.freeze({
    as3: 'Scenery/FallRockLarge.as',
    tag: 1,
    armY: 120,
    fallTo: 144,
    fallFrom: -32,
    fallRate: 0.6,
    waitToFallTimerMax: 60,
    cameraTimerMax: 90,
    sealsRect: Object.freeze({ x: 64, y: 128, w: 32, h: 32 }),
});

/**
 * The rock's schedule, in FRAMES, run rather than divided.
 *
 * The fall is `vy += 0.6; y += vy` per frame from -32, so after n frames
 * `y = -32 + 0.3·n·(n + 1)`. Solving gives 23.7, and a count computed that
 * way rounds the wrong direction on the frame the test actually fires — so
 * the loop is the transcription and the closed form is the check.
 */
export function rockSchedule() {
    let y = ROCK.fallFrom;
    let vy = 0;
    let fallTicks = 0;
    while (y < ROCK.fallTo) {
        vy += ROCK.fallRate;
        y += vy;
        fallTicks += 1;
        if (fallTicks > 1000) fail('the rock never lands — fallRate or fallTo is wrong');
    }
    return {
        // The arm frame itself decrements `waitToFallTimer` once.
        waitTicks: ROCK.waitToFallTimerMax,
        fallTicks,
        cameraTicks: ROCK.cameraTimerMax,
        landsAt: y,
        /**
         * Frames from the arm to `new BobBoss(72,72)`. The arm frame runs
         * the first wait decrement, and the spawn happens on the frame
         * `cameraTimer` reads exactly 0 — so the two fenceposts cancel and
         * the total is the plain sum.
         */
        bossSpawnsAt: ROCK.waitToFallTimerMax + fallTicks + ROCK.cameraTimerMax,
    };
}

/** `Enemy.hitsTimerMax` — the i-frames a press schedule has to clear. */
export const BOSS_IFRAMES = 30;

/** `BobBoss.nextBossTimerMax` — the between-forms window, in frames. */
export const FORM_TRANSITION_FRAMES = 120;

/**
 * When the transition TELEPORTS the player, as a frame offset from its end.
 *
 * `if (nextBossTimer <= nextBossTimerMax / 3)` — so the write starts 40
 * frames before the next form appears and repeats every frame until it does.
 * A model that applied it once would have the player drifting for 39 frames
 * the game pins.
 */
export const FORM_TELEPORT_AT = FORM_TRANSITION_FRAMES / 3;

/** `Spritemap` alpha ramp before a new form acts — `formingTimerMax`. */
export const FORMING_FRAMES = 60;

/**
 * The three forms.
 *
 * `pages` is `NPC.addText`'s `~` split of `BobBoss.text[i]`, wrapped at
 * **28** columns — `BobBossNPC`'s `super(...)` passes no `_lineLength`, so
 * it takes `NPC`'s default 28 rather than a pickup ceremony's 32. The
 * counts are what `dialogue.pagesOf(text, 28)` returns and the test asserts
 * that rather than the literals.
 */
export const BOB_BOSS_FORMS = Object.freeze([
    Object.freeze({
        index: 0,
        hitsMax: 2,
        swords: 1,
        formingTicks: FORMING_FRAMES,
        text: '..., ...?~...~...!',
        pages: Object.freeze(['..., ...?', '...', '...!']),
        note: 'swordSpinRate / 4, damage 2, moveSpeed 0.5',
    }),
    Object.freeze({
        index: 1,
        // ⛔ NOT SET BY THE SWITCH — `Enemy.hitsMax`'s default. See header 3.
        hitsMax: 3,
        swords: 2,
        formingTicks: FORMING_FRAMES,
        text: '...never...~ages...~...seen...~...odd.~...for...minutes?~'
            + 'seconds...hours...~mine!',
        pages: Object.freeze(['...never...', 'ages...', '...seen...', '...odd.',
            '...for...minutes?', 'seconds...hours...', 'mine!']),
        note: 'case 1 sets no hitsMax, so it keeps Enemy\'s 3 — the widest form',
    }),
    Object.freeze({
        index: 2,
        hitsMax: 2,
        swords: 2,
        formingTicks: FORMING_FRAMES,
        text: 'Time is stasis.~You bring much conflict.~Is it my place to resist?~'
            + 'Seems I must.',
        pages: Object.freeze(['Time is stasis.', 'You bring much conflict.',
            'Is it my place to resist?', 'Seems I must.']),
        note: 'swordSpinResetTimerMax 0, and `hit` ADDS a sword and re-seeds every blade',
    }),
]);

/** `BobBossNPC`'s ctor: `super(_x, _y, null, -1, _text, 6)` — no lineLength. */
export const BOSS_TEXT_SPEED = 6;
export const BOSS_LINE_LENGTH = 28;

/** `SWORD_DAMAGE.sword` — the plain sword. The dark sword is R5 slice 5's. */
const PLAIN_SWORD_DAMAGE = 1;

/** Landed hits and presses for ONE form, at the plain sword's damage. */
export function formPresses(form, { damage = PLAIN_SWORD_DAMAGE, slack = 1 } = {}) {
    if (!form || !Number.isInteger(form.hitsMax)) fail('formPresses needs a declared form');
    if (!(damage > 0)) fail(`formPresses: damage must be positive, got ${damage}`);
    const landed = Math.ceil(form.hitsMax / damage);
    return { landed, presses: landed + slack };
}

/**
 * The whole fight's press bill.
 *
 * ⚠ The cadence is the ENEMY i-frame one, 31, and not §3.3's 21 — the dash
 * floor. `combatVerbs.KILL_PRESS_CADENCE` is the shared derivation; it is
 * re-checked here rather than re-derived, because two transcriptions of one
 * number is what put slice 2's whole census eight pixels off the map.
 */
export function bobBossPressBill({ damage = PLAIN_SWORD_DAMAGE, slack = 1,
    cadence = BOSS_IFRAMES + 1 } = {}) {
    if (cadence <= BOSS_IFRAMES) {
        fail(`bobBossPressBill: cadence ${cadence} does not clear the boss's `
            + `${BOSS_IFRAMES}-tick i-frames, so a press inside it is simply refused`);
    }
    let landed = 0;
    let presses = 0;
    const perForm = BOB_BOSS_FORMS.map((f) => {
        const p = formPresses(f, { damage, slack });
        landed += p.landed;
        presses += p.presses;
        return { index: f.index, ...p };
    });
    return { landed, presses, cadence, perForm };
}

/**
 * `Pickups/Fire.as` — the reward, and the ledger entry nobody would predict.
 *
 * `BobBoss.death` spawns `new Fire(FP.width/2 - Tile.w/2, FP.height/2 -
 * Tile.h/2, -1)` — so the tag is **-1**, and `Fire.removed()` calls
 * `Game.setPersistence(-1, false)` unconditionally (its `check()` guard is
 * `tag >= 0 && ...`, which a -1 skips, so `doActions` stays true).
 *
 * ⛔ `Main.levelPersistenceSet(i, j)` writes `levelPersistence[i * 30 + j]`.
 * With `i = 32` and `j = -1` that is index **959**, which is `31 * 30 + 29`
 * — L31's LAST tag slot. The write is real, it is in a level the player is
 * not standing in, and the exact-set ledger has to name it or the walk
 * reports a flag nobody can attribute.
 */
export const FIRE = Object.freeze({
    as3: 'Pickups/Fire.as',
    tag: -1,
    at: Object.freeze({ x: 80, y: 80 }),
    text: 'You got Fire!~It pushes but does not hurt.',
    /** `Pickup.specialTimer` — phase A, and it is invisible to the tape. */
    specialTimerMax: 150,
    /** Where `setPersistence(-1, false)` actually lands. */
    outOfBandFlag: Object.freeze({ level: 31, tag: 29 }),
});

/**
 * `Scenery/BurnableTree.as` — the arena's exit.
 *
 * `hit("Fire")` plays a 20-frame animation at rate 15; `burnEnd` is the
 * callback, and `die()` -> `removed()` writes `setPersistence(tag, false)`.
 * The tick count is `chasers.animTicks`'s arithmetic — `ceil(frames /
 * (rate * FP.elapsed))` — and 15 * 0.0333 is 0.4995, not 0.5, so it is 41
 * rather than 40.
 */
export const BURNABLE_TREE = Object.freeze({
    as3: 'Scenery/BurnableTree.as',
    tag: 0,
    at: Object.freeze({ x: 64, y: 0, w: 32, h: 32 }),
    burnFrames: 20,
    burnRate: 15,
    get burnTicks() { return Math.ceil(20 / (15 * 0.0333)); },
});

/**
 * Every persistence flag this encounter writes, and who writes it.
 *
 * ⚠ ONE OF THEM IS IN ANOTHER LEVEL. That is not a rounding error in the
 * transcription — it is what the game does, and an exact-set assertion has
 * to carry it BY NAME or the walk reports a flag off in a room it visited
 * an hour earlier.
 */
export const BOB_BOSS_LEDGER = Object.freeze([
    Object.freeze({
        level: 32, tag: ROCK.tag,
        by: '`FallRockLarge.fall()` — written on the ARM frame, long before it lands',
    }),
    Object.freeze({
        level: FIRE.outOfBandFlag.level, tag: FIRE.outOfBandFlag.tag,
        by: '⛔ `Fire.removed()` calling `setPersistence(-1, false)` in L32 — '
            + '`i * 30 + j` puts it in L31\'s last slot',
    }),
    Object.freeze({
        level: 32, tag: BURNABLE_TREE.tag,
        by: '`BurnableTree.removed()` after the burn — the arena\'s pit exit',
    }),
]);
