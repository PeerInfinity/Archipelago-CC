/**
 * seedlingDemo/r5Chain — R5 slice 4's route constants: THE CHAIN.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §4 slice 4.
 *
 * Same job as `r4Walk.js` does for R4's headline: the declared half of the
 * route lives here as data, the planner scripts CONFIRM it against the
 * shipped geometry, and the tests assert the declarations against the
 * extract. Nothing here is measured — every number is either an OEL
 * coordinate, a transcription with its source named, or an arithmetic
 * consequence of one.
 *
 * ── THE CHAIN, IN THE ORDER ITS DEPENDENCIES FORCE ────────────────────
 *
 *   1. the KEY LEG   L29's `bosskey@112,64` (keyType 1) → L31's pocket lock
 *                    → L30's chamber lock → the L32 arena mouth
 *   2. BOBBOSS       three forms, seven presses, `fire`
 *   3. KARLORE + D5  fire makes L48's plug vanish; D5 ends at the conch
 *   4. THE SWIM      `canSwim` retires `water` from `noHazards`
 *   5. FEATHER       L89 by water; `hasFeather` retires `waterfall`
 *
 * ── ⛔ TWO THINGS THE EXTRACT SAYS THAT §2.6.1 DOES NOT ───────────────
 *
 * **1. The keyType-1 key opens TWO locks.** L31's stairs to L30 sit in a
 * five-tile pocket behind `bosslock@192,432` (tag 0). A flood from the L29
 * arrival reaches 103 tiles and the pocket is not among them. So the ledger
 * gains `{31,0}` AND `{30,2}` from one key.
 *
 * **2. L32's pit exit is sealed by a BURNABLE TREE.** `control@64,0` names
 * `fallthrough = 30`, and the two pit tiles it applies to — (4,0) and (5,0)
 * — are covered exactly by `burnabletree@64,0`, a 32x32 `type = "Solid"`
 * that only `hit("Fire")` removes. The arena's exit therefore needs the item
 * the arena grants, and `fire`'s first use in the whole arc is getting out
 * of the room it was won in. `BurnableTree.removed()` writes
 * `setPersistence(0, false)`, so that is a THIRD earned ledger entry,
 * `{32,0}` — beside `{32,1}`, which `FallRockLarge.fall()` writes when the
 * rock drops.
 */

import { rockSchedule } from './bobBoss.js';


export class R5ChainError extends Error {
    constructor(message) { super(message); this.name = 'R5ChainError'; }
}
const fail = (m) => { throw new R5ChainError(m); };

/** `Scenery/Tile.as` — the pitch every OEL coordinate is in. */
export const TILE = 16;

// ─────────────────────────────────────────────────────────────────────
// STEP 1 — THE KEY LEG
// ─────────────────────────────────────────────────────────────────────

/** `Pickups/BossKey.as` — `Player.hasKeySet(keyType, true)`, and nothing else. */
export const R5_KEY_TYPE = 1;

/** `assets/levels/Dungeon3/8.oel` — the only keyType-1 key on the route. */
export const R5_KEY_PICKUP = Object.freeze({ level: 29, x: 112, y: 64 });

/**
 * The two `BossLock`s that key opens, in the order the walk reaches them.
 *
 * ⚠ `tag` is asserted rather than read, because the ledger claim names it:
 * a lock whose tag moved would still open and would write a DIFFERENT flag,
 * and an exact-set assertion phrased over the tag the extract happened to
 * carry would follow it silently.
 */
export const R5_KEY_LOCKS = Object.freeze([
    Object.freeze({
        level: 31, lock: Object.freeze({ x: 192, y: 432 }), tag: 0,
        why: 'the pocket door — L31\'s stairs to L30 are behind it and nothing else is',
    }),
    Object.freeze({
        level: 30, lock: Object.freeze({ x: 224, y: 208 }), tag: 2,
        why: 'the brickpole chamber whose stairsup@224,160 is BobBoss\'s only door',
    }),
]);

/**
 * A `BossLock`'s stance, derived from its own key line rather than measured.
 *
 * `Puzzlements/BossLock.as` walks a one-pixel horizontal line ONE PIXEL
 * BELOW itself and asks `collideLine("Player", ...)`. The player's box is
 * 4x5 at origin (2,2) — `[x-2,x+2) x [y-2,y+3)` — so a centre at
 * `(lock.x + 8, lock.y + TILE + 2)` puts four integer probes of that line
 * inside the box, with the box's top flush against the lock's south face —
 * the same `+2` R4's own `R4_KEY_LOCK.at` uses.
 *
 * ⛔ AND THE STANCE IS A GRAZE BY CONSTRUCTION — `allowGrazes` IS NOT
 * SLOPPINESS HERE, IT IS THE VERB. A drive approaching from below cannot
 * REACH `+ 2`: `Mobile.moveY` steps `min(1, |yrel| - i)` and returns as
 * soon as the next step would collide, so it stops at ~226.5 and reports a
 * blocked sweep. That report is correct and the stance is still right — the
 * whole idea of a keylock stance is a player PRESSED AGAINST the lock, and
 * pressing against a solid IS a blocked sweep. What `allowGrazes` changes
 * is only whether an absorbed overshoot ends the walk; the arrival is still
 * asserted, and `runKeyLock` still checks the probes.
 *
 * ⚠ Both edges of the band are half a pixel away, in opposite directions.
 * Aim at `+ 3` instead and an arrival half a pixel LOW puts the box top at
 * 449.19 — a fifth of a pixel past the probe row, `collideLine` finds
 * nothing, and the lock never latches. L31 did exactly that. The legal band
 * for the box top is one pixel wide, `[lock.y + TILE, lock.y + TILE + 1]`.
 */
export function keyLockStance(lock) {
    if (!lock || !Number.isFinite(lock.x) || !Number.isFinite(lock.y)) {
        fail('keyLockStance needs a resolved activator with x/y');
    }
    return { x: lock.x + TILE / 2, y: lock.y + TILE + 2 };
}

/**
 * `FallRockLarge.update`'s arm test, transcribed.
 *
 *     if (!p.fallFromCeiling && p.y < fallTo - sprRock.height / 2 - 8) activate = true;
 *
 * `fallTo` is the constructed y — `(_y + Tile.h)` = 144 for `@64,128` — and
 * the sprite is 32 tall, so the threshold is `144 - 16 - 8` = **120**. L32's
 * arrival is (80,128): EIGHT PIXELS. The key leg's last act is to arrive and
 * stand still, because one step north is the whole of step 2.
 */
export const R5_ARENA_ARM_Y = 120;

/** The `new Game(29, 96, 32)` L31's `stairsup@384,96` really constructs. */
export const R5_KEY_LEG_BOOT = Object.freeze({ level: 29, x: 96, y: 32 });

/**
 * THE KEY LEG, as leg declarations.
 *
 * ⚠ `avoid` is the ENCOUNTER LADDER's verdict, emitted rather than implied
 * (§13's amendment: discs are pricing objects, and the planner must say what
 * it decided). L30 holds one `bobsoldier@48,80` — an 80 px chase leash and a
 * 16 px sword line — and the verdict is PATH-AVOID: column 10 of the left
 * room (x = 168) is 112 px from the body, outside the leash by 32, and it
 * runs from row 6 to row 14 unbroken. Nothing is killed and the walk carries
 * no sword to kill it with.
 *
 * ⚠ `torchpickup@64,64` is avoided for a different reason and it is not a
 * hazard at all: collecting it would put `hasTorch` on a walk whose whole
 * claim is that its item set came from the two things it took on purpose.
 */
export const KEY_LEG = Object.freeze({
    name: 'r5-bosskey-leg',
    lattice: 16,
    nodeMargin: 0,
    allowGrazes: true,
    /** §10.2's coast: the ticks a window needs after its last release. */
    coastTicks: 12,
    noHazards: Object.freeze(['water', 'waterfall']),
    pins: Object.freeze(['sound', 'dead_frames']),
    avoid: Object.freeze([
        Object.freeze({
            tag: 'bobsoldier@48,80 chase leash (80 px)',
            x: 56 - 80, y: 88 - 80, w: 160, h: 160,
        }),
        Object.freeze({
            tag: 'torchpickup@64,64 volume — an item this walk does not claim',
            x: 60, y: 60, w: 24, h: 24,
        }),
    ]),
    legs: Object.freeze([
        Object.freeze({
            level: 29,
            targets: Object.freeze([
                Object.freeze({ x: 104, y: 72, collect: { pickup: { x: 112, y: 64 } } }),
            ]),
            exit: Object.freeze({ x: 112, y: 32 }),   // stairsdown -> L31 (384,112)
        }),
        Object.freeze({
            level: 31,
            targets: Object.freeze([
                Object.freeze({ x: 200, y: 450, keylock: { lock: { x: 192, y: 432 } } }),
            ]),
            exit: Object.freeze({ x: 160, y: 384 }),  // stairsup -> L30 (176,48)
        }),
        Object.freeze({
            level: 30,
            targets: Object.freeze([
                // ⚠ AN EXPLICIT WAYPOINT, and it is load-bearing. `ruinedpillar@176,192`
                // has its bottom face at y = 224 — exactly the line the lock stance's box
                // top sits on — so a smoothed run at y = 226 grazes it for 32 px of x.
                // Arriving from DIRECTLY BELOW makes the last move a pure vertical at
                // x = 232, where the only thing above the walk is the lock itself.
                Object.freeze({ x: 232, y: 234 }),
                Object.freeze({ x: 232, y: 226, keylock: { lock: { x: 224, y: 208 } } }),
                // ⛔ AND THE LEG STOPS HERE, BESIDE THE STAIRS, NOT THROUGH THEM.
                // "the L32 chamber" is the brickpole-walled room in L30 that
                // `stairsup@224,160` leaves from, and stopping in it is not a
                // shortened claim — it is the only safe one. L32's arrival tile
                // (5,8) holds the return teleporter, so the planner cannot end a
                // walk there, and the only tiles it CAN end on are row 7 and
                // north — across `FallRockLarge`'s arm line at y < 120. A key
                // leg that crossed the stairs would have to either stand on a
                // teleporter or start the boss fight.
                Object.freeze({ x: 232, y: 184 }),
            ]),
        }),
    ]),
});

/** The flags the key leg EARNS — asserted as an exact set, both ways. */
export const KEY_LEG_EARNED = Object.freeze([
    Object.freeze({ level: 31, tag: 0, by: '`BossLock.turnOff` in L31, the pocket door' }),
    Object.freeze({ level: 30, tag: 2, by: '`BossLock.turnOff` in L30, the chamber door' }),
]);

// ─────────────────────────────────────────────────────────────────────
// STEP 1's CONTROL — the same stance, the same hold, no key
// ─────────────────────────────────────────────────────────────────────

/**
 * ⚠ THE CONTROL BOOTS SOUTH OF THE STANCE ON PURPOSE.
 *
 * Booted ON the key line the arm could not move at all, and a control whose
 * position never changes is one a reader cannot tell from a tape that did
 * nothing. Sixteen pixels south makes the pin a MOVE that stops — the same
 * shape the L60 control has, where the walk crosses 14 px and then does not.
 */
export const R5_LOCK_SHUT_BOOT = Object.freeze({ level: 30, x: 224, y: 234 });

export const KEY_LOCK_SHUT = Object.freeze({
    name: 'r5-bosskey-lock-shut',
    holdFrom: 4,
    holdTo: 144,
    tickCount: 160,
    /** Where `Mobile.moveY` leaves a box whose top is flush with y=224. */
    pinY: 226,
    description: 'THE KEY LEG\'s shut-before control. Boots 16 px south of '
        + '`bosslock@224,208`\'s key line in L30 and holds UP for 140 ticks — against a '
        + '`BossLock` that opens on tick 80 of contact, so this is not a walk that ran '
        + 'out of patience. Nothing in the run holds `Player.hasKey(1)`, so '
        + '`BossLock.update` never sets `activate`, `type` stays "Solid", the walk PINS '
        + 'with its box flush against y=224, and `persistence_cleared` stays EMPTY. '
        + 'Without this arm, "the key leg reached L32" is not evidence that anything '
        + 'was ever in the way.',
});

// ─────────────────────────────────────────────────────────────────────
// STEP 3 — THE KARLORE PAIR, the rung's headline
// ─────────────────────────────────────────────────────────────────────

/**
 * `NPCs/Karlore.as` — the plug that is not a fight.
 *
 *     override public function added():void {
 *         super.added();
 *         if (Player.hasFire) FP.world.remove(this);
 *     }
 *
 * `NPC`'s constructor sets `type = "Solid"`, and Karlore's own
 * `setHitbox(16, 16, 8, 8)` around `(_x + Tile/2, _y + Tile/2)` makes that a
 * whole tile at the OEL position — [112,128) x [272,288) in L48, which is
 * the ONE-TILE CORRIDOR the walk has to pass. So `fire` is not spent here;
 * it is simply HELD, and the level builds differently because of it.
 *
 * ⛓ WHICH IS WHY THIS IS THE RUNG'S HEADLINE PAIR. `fire` is the first
 * combat-earned boolean on the whole arc, and its witness is a tape one
 * field apart: `grants [fire]` against `grants []`, everything else
 * identical, including the hold. The control's hold is stopped by a Solid;
 * the fire arm's is stopped by running out — which is the §14.10 rule
 * applied before the recording rather than after it. 28 ticks lands the
 * fire arm at y ≈ 260.8, inside row 16, and row 14 is WATER: a generous
 * hold would have walked the headline into a hazard the walk cannot yet
 * survive.
 *
 * ⚠ AND IT IS A *PROBE* GRANT, NOT AN EARNED ONE — the `l71-shieldlock`
 * precedent, named. Step 2's `r5-bobboss-fire` EARNS the boolean from the
 * boss; this pair GRANTS it, because what it is asking is what the boolean
 * does to L48's geometry and not where it came from. The two claims are
 * separate on purpose and the chain is what joins them.
 */
export const KARLORE = Object.freeze({
    level: 48,
    /** The OEL placement, which is also the Solid's rect origin. */
    at: Object.freeze({ x: 112, y: 272 }),
    tile: Object.freeze({ tx: 7, ty: 17 }),
    /**
     * ⛔ THE PAIR BOOTS IN L47, AND THE FIRST ATTEMPT TAUGHT US WHY.
     *
     * The obvious tape boots straight into L48 with `grants: [{level: 48,
     * items: ['fire']}]`. It was recorded, and BOTH ARMS PINNED at
     * y = 290.25 — byte-identical, 53 observations each.
     *
     * `Karlore.added()` runs during `loadlevel`, i.e. inside
     * `new Game(48, ...)`, and a boot grant is applied by `Bot` AFTERWARDS.
     * So a grant naming the level it boots into cannot reach any entity's
     * `added()` in that level: the plug is built as though the item were
     * absent, and the arm that was supposed to walk through pins beside its
     * own control. §2.6.2 said "hold fire BEFORE entering" and meant it
     * literally — a boot is not an entry.
     *
     * ⇒ The fire arm ENTERS through L47's `teleporter@216,112`, with the
     * grant already banked, so `new Game(48, ...)` builds a level with no
     * Karlore in it at all.
     */
    boot: Object.freeze({ level: 47, x: 208, y: 136 }),
    arrival: Object.freeze({ x: 120, y: 296 }),
    entryFrom: Object.freeze({ level: 47, teleporter: Object.freeze({ x: 216, y: 112 }) }),
    holdFrom: 4,
    holdTo: 32,
    tickCount: 52,
    /** Where `Mobile.moveY` leaves a box whose top is flush with y=288. */
    pinY: 290,
    /** Modelled: row 16, and row 14 is water. */
    throughRow: 16,
    throughY: 262,
});

/** L48's pit to L49, and the conch behind it. */
export const CONCH = Object.freeze({
    pit: Object.freeze({ tx: 11, ty: 3 }),
    level: 49,
    pickup: Object.freeze({ x: 32, y: 80 }),
    tag: 0,
    item: 'conch',
    property: 'canSwim',
});

// ─────────────────────────────────────────────────────────────────────
// THE ENCOUNTER EXEMPTION — declared, never inferred
// ─────────────────────────────────────────────────────────────────────

/**
 * ⛔ THE FIXTURES WHOSE MODEL MIRROR CANNOT BE RIGHT, AND WHY.
 *
 * `verify-seedling-bot-differential` builds its expectation for a tape by
 * running the tape through the JS engine, and then asserts the game's
 * fourteen item properties, its inventory slot array and its
 * `saw_input_refused` against it. That works because every mechanic on the
 * ladder so far is one the engine models.
 *
 * An ENCOUNTER SCRIPT is not. `BobBoss` is 230 lines of scripted state — a
 * rock that writes the player's respawn point, three forms with their own
 * hit counts, two 120-frame transitions that TELEPORT the player and set
 * `receiveInput = false`, and a reward that is spawned at runtime and is
 * therefore in no level's pickup list. The engine cannot know any of it, so
 * on these tapes the mirror is wrong about exactly three things and right
 * about everything else.
 *
 * ⚠ THE ANSWER IS A DECLARATION, NOT A RELAXATION. Each entry names the
 * fixture, the items the GAME earns that the tape never granted, and the
 * reason input is refused. The harness then checks the game against
 * `mirror + earned` — a HARDER assertion than the unamended one, because a
 * run that failed to earn `fire` now goes red where before it would have
 * been green. And an exemption that is not exercised is itself a finding:
 * a fixture listed here whose game state matches the plain mirror is a
 * fixture that did not do the thing it is exempt for.
 *
 * ⚠ BY NAME, never by predicate. `feedback_coincidental_predicate_rots`:
 * "has presses" or "has enemies" would sweep in every later kill fixture,
 * all of which are supposed to match.
 *
 * ⛓ AND ONE ENTRY HAS BEEN RETIRED — `r5-karlore-fire`.
 *
 * It was here because `Karlore.added()` reads `Player.hasFire` at LEVEL
 * BUILD time and `buildLevelWorld` had no idea an NPC's `added()` reads an
 * item property, so the model pinned where the game walked through. Slice 4
 * step 4 paid the OWED follow-up: `levelWorld.ADDED_TIME_REMOVAL` is that
 * table, `levelRun` hands each world the inventory banked when it builds
 * it, and the fire arm now matches its COMMITTED ORACLE RECORDING byte for
 * byte — with no re-record, because the recording was always the game's and
 * it is the model that caught up. A divergence turned into an exact match
 * is strictly the better claim, and an exemption that no longer describes
 * anything is a weakening kept for nothing.
 *
 * ⚠ The retirement is self-policing: `tapeRunner.test.js` asserts that
 * every name here really does diverge, so leaving the entry in would have
 * gone RED the moment the model caught up. That is the guard working, and
 * it is why this is a list of names (`feedback_retired_oracle_check_the_regen`
 * — the regen here is `EXPECTED_TO_DIVERGE`, and it reads this list rather
 * than keeping its own).
 */
/**
 * ⛓⛓ THE FREEZE AN EXEMPT TAPE CARRIES, AS A NUMBER — R5 slice 11.
 *
 * `FallRockLarge`'s 174 frames were prose in three `why` strings and a
 * number nowhere, so the dead-frame budget could not spend them: its first
 * run against the roster reported all three bobboss tapes OUT OF BAND by
 * exactly this amount. The budget was right and the record was unreadable.
 *
 * ⛓ DERIVED, NOT TRANSCRIBED. `rockSchedule()` runs the fall as a LOOP —
 * `vy += 0.6; y += vy` from -32 — because the closed form solves to 23.7
 * and rounds the wrong way on the frame the test fires. 60 wait + 24 fall
 * + 90 camera = 174, and the literal never appears.
 */
const ROCK_FREEZE_FRAMES = rockSchedule().bossSpawnsAt;

export const MODEL_EXEMPT = Object.freeze({
    'r5-bobboss-arm': Object.freeze({
        /** `FallRockLarge`'s freeze, which every arm of this pair pays. */
        freezeFrames: ROCK_FREEZE_FRAMES,
        earned: Object.freeze([]),
        refusesInput: false,
        why: 'the arm probe. `FallRockLarge` freezes the game for 174 frames and the '
            + 'engine models neither the rock nor the three `BobBossNPC` dialogues that '
            + 'follow, so the model walks where the game stands still. It earns nothing '
            + '— it holds no sword — so only the STREAM diverges.',
    }),
    'r5-bobboss-fire': Object.freeze({
        /** `FallRockLarge`'s freeze, which every arm of this pair pays. */
        freezeFrames: ROCK_FREEZE_FRAMES,
        earned: Object.freeze(['fire']),
        refusesInput: true,
        why: '⛓ THE FIRST BOSS KILL ON THE ARC. `fire` is spawned by `BobBoss.death` at '
            + 'runtime — it is in no level\'s pickup list, so no engine reading the '
            + 'extract could ever see it — and `receiveInput` goes false for the two '
            + '120-frame form transitions. The mirror is amended with `fire` rather '
            + 'than excused, so a run that fought and did not win goes RED here.',
    }),
    'r5-bobboss-fire-control': Object.freeze({
        /** `FallRockLarge`'s freeze, which every arm of this pair pays. */
        freezeFrames: ROCK_FREEZE_FRAMES,
        earned: Object.freeze([]),
        refusesInput: false,
        why: 'the same tape with `grants` empty. It earns nothing and is never taken '
            + 'over — form 0 never dies, so there is no transition — but the rock still '
            + 'freezes the game for 174 frames, so its STREAM diverges for the same '
            + 'reason the probe\'s does.',
    }),
});

/** The names, for a harness that wants the set rather than the table. */
export const MODEL_EXEMPT_NAMES = Object.freeze(Object.keys(MODEL_EXEMPT));
