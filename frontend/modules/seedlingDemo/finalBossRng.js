/**
 * seedlingDemo/finalBossRng — the Owl room's DRAW SCHEDULE, per tick, in the
 * game's own order.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6e. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §16.8 (the opening bill),
 * §14.4, §8.5.
 *
 * ── WHY A SECOND RNG MODULE ───────────────────────────────────────────
 *
 * `rng.js` is the GENERATOR: given a state, what is the next number. It is
 * pinned against the live game and it is complete. What it cannot say is
 * **how many times the game turns the crank on tick N, and in what order** —
 * and that is the whole of the Owl fight's exactness claim, because every
 * rock's position, every rock's hitbox and the camera's own jiggle come out
 * of one stream whose position is the sum of everything drawn before them.
 *
 * §15.14.5 priced this as "`FinalBoss`'s two rolls per rock and `RockFall`'s
 * ctor draw, in order". §16.8 found a third producer nobody had counted (the
 * shake jiggle, two draws on almost every frame of a barrage, fed back
 * through the rock the draws just made). **A fourth is missing from that
 * schedule**, and the interesting part is that the CENSUS already had it:
 *
 *   ⛔⛔ **A `Grenade` IS AN `Enemy`, AND `Enemy` DRAWS IN A FIELD
 *   INITIALIZER.** `Enemies/Enemy.as:30` is
 *   `private const coins:int = 4 + Math.random() * 4;` — an instance field
 *   with a non-constant initializer, which AS3 runs as part of every
 *   construction. So the walk phase's grenade roll is **1 draw, and 2 on the
 *   tick it fires**: the roll, then the constructor. §16.8's schedule says
 *   "per WALK tick 1 draw" and stops there, and
 *   `r6Acceptance.GAMEPLAY_DRAW_CONSUMERS.finalboss` says "1 draw/tick while
 *   walking" for the same reason.
 *
 *   ⛓⛓ AND SLICE 6a'S CENSUS HAD ALREADY WRITTEN IT DOWN — §15.10's list
 *   names "`Enemy`'s ctor PAIR (`coins` and `fallSpinSpeed`'s `FP.choose`,
 *   two not one)". A census of SITES and a schedule of TICKS are different
 *   artifacts, and the one a model consumes is the schedule: the site was
 *   known for a slice and the per-tick cost was still short. ⇒ a census does
 *   not discharge a schedule, and `OWL_DRAW_SITES` below is written so the
 *   two cannot drift again — every site is a method, and the test asserts
 *   the method set IS the table.
 *
 *   ⛓ `RockFall` is a `Mobile`, not an `Enemy`, so it has no `coins` — which
 *   is exactly why the same reading gets the two spawns' costs different
 *   (3 for a rock, 2 for a grenade) and why "an entity costs one ctor draw"
 *   would have been wrong for both.
 *
 * ── THE SCHEDULE, TRANSCRIBED ─────────────────────────────────────────
 *
 * One frame of `Main.update` is
 *
 *     Bot.update()                     — no draws, dispatches keys
 *     Game.update()
 *       …                              — no draws above the gate
 *       if (blackCover <= 0) super.update()      ← World.update: ENTITIES
 *       view()                                    ← THE JIGGLE, 2 draws
 *
 * and `World.update` walks `_updateFirst` forward while `addUpdate` PREPENDS
 * (`net/flashpunk/World.as:937-951`), so the update order is the REVERSE of
 * `Game.loadlevel`'s add order. For L112 that is
 *
 *     [runtime rocks/grenades, newest first]      ← `FP.world.add` queues,
 *                                                   `updateLists` prepends
 *     pods, teleporters, orb, rocklock, FinalBoss, …, Player LAST
 *
 * (`Game.as:2101` adds the Player, `:2135` the FinalBoss, `:2252` the pods.)
 * ⇒ **the boss draws before the jiggle, every tick, and the player moves
 * after both.** That ordering is not decoration: `RockFall.update`'s landing
 * runs `Game.shake += scale + 1` and the rocks update BEFORE the boss, so a
 * rock that lands on tick N raises the shake that tick N's own `view()`
 * reads — the feedback loop §16.8 names.
 *
 * The per-tick cost, by the boss's phase:
 *
 * | phase                              | draws | sites, in order            |
 * |------------------------------------|-------|----------------------------|
 * | intro (`!started`, freeze up)      | 0     | the boss returns above all |
 * | frozen / destroyed                 | 0     | `return` after super.update |
 * | lava self-hit tick                 | 0     | the arm `return`s          |
 * | barrage, no spawn                  | 1     | barrageRoll                |
 * | barrage, spawn                     | 4     | barrageRoll, spawnX, spawnY, rockScale |
 * | the `rockfallTime == 0` tick       | 0     | the pod arm draws nothing  |
 * | walk, no grenade                   | 1     | grenadeRoll                |
 * | walk, grenade                      | 2     | grenadeRoll, enemyCoins    |
 * | coast (`|v| > moveSpeed`, shoved)  | 0     | ⛓ every arm is skipped     |
 * | `endAnim` "dead"                   | 10    | 5 x (deathRockX, rockScale)|
 * | ANY frame with `shake > 0`         | +2    | jiggleX, jiggleY, LAST     |
 *
 * ⛓ **THE COAST ROW IS THE ONE THAT MAKES THE FIGHT MODELLABLE.** A shoved
 * Owl fails `v.length <= moveSpeed` for the whole coast and takes no arm at
 * all, so the 18 ticks after a sword press cost the stream nothing from him
 * — the only draws in that span are the jiggle's, if a rock is still ringing.
 *
 * ── WHAT IS NOT HERE, AND WHY ─────────────────────────────────────────
 *
 * A W-owl tape declares `rng: { seed, split: true }`. With the split ON the
 * ~30 `Rng.cos()` sites move to a second generator, and the two that would
 * otherwise fire in this room every few ticks are `Music`'s sound-index pick
 * (`Music.as:673` — one per `Music.playSound("Rock", 0)`, i.e. one per
 * LANDING) and `Tile`'s three per-tile constructor draws. Both cost this
 * stream nothing under the split, and the split is why the schedule above is
 * a short table rather than an audit of the whole room.
 *
 * ⚠ **WITHOUT THE SPLIT THE TABLE IS INCOMPLETE BY CONSTRUCTION**, so
 * `assertOwlStreamPremises` refuses a tape that asks this model for an exact
 * fight on `split: false` rather than letting it drift.
 *
 * ⛓ `Orb`'s single constructor draw (`Scenery/Orb.as:27`) and the level's
 * `Tile` draws are ABOVE `botStart`'s seed reset and therefore free — the
 * reset happens after the world is built, which is the whole point of
 * §15.8's "write and reset are one operation".
 */

import { SeedlingRng } from './rng.js';

/** Thrown by everything in this module. */
export class OwlRngError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OwlRngError';
    }
}

/**
 * AS3's `int` coercion — truncate toward zero.
 *
 * ⛔ Needed at three sites in this room and it is trap 108's shape at every
 * one: `RockFall(_x:int, _y:int)` truncates the spawn's own Numbers before
 * the entity ever exists, and `setHitbox` takes ints as well, so a scale of
 * 0.53125 gives a 17x8 box and not a 17.0x8.5 one.
 */
export function as3Int(v) {
    return Math.trunc(v);
}

// ── THE CONSTANTS THE SCHEDULE IS A FUNCTION OF ───────────────────────

/** `FinalBoss.as:139` — `const rockFrequency:int = 6`. */
export const ROCK_FREQUENCY = 6;
/** `FinalBoss.as:157` — `const grenadeFrequency:int = 40`. */
export const GRENADE_FREQUENCY = 40;
/** `FinalBoss.as:140` — `const stepsAhead:int = -15`. ⛓ NEGATIVE: it aims BEHIND. */
export const ROCK_STEPS_AHEAD = -15;
/** `FinalBoss.as:141` — `const radius:int = 20`, so the offset is [-20, 20). */
export const ROCK_RADIUS = 20;
/** `FinalBoss.as:214` — `const n:int = 5`, the death arm's rocks. */
export const DEATH_ROCKS = 5;
/** `RockFall.as:33` — `Math.random() / 2 + 0.25`, so scale is [0.25, 0.75). */
export const ROCK_SCALE_BASE = 0.25;
export const ROCK_SCALE_SPAN = 0.5;
/** `Enemy.as:30` — `4 + Math.random() * 4`, truncated by the `int` slot. */
export const ENEMY_COINS_BASE = 4;
export const ENEMY_COINS_SPAN = 4;

/**
 * The census of every site that can move THIS stream inside L112, with what
 * it costs and the line it is on.
 *
 * ⛔ A LIST WITH NO CONSUMER IS PROSE, so `OwlDrawStream` dispatches through
 * these names and `finalBossRng.test.js` asserts that the set of names the
 * stream can emit is exactly the set of keys here. A site added to the class
 * and not to the table (or the reverse) fails by name — trap 86's cure
 * applied to a draw census.
 */
export const OWL_DRAW_SITES = Object.freeze({
    barrageRoll: Object.freeze({
        draws: 1,
        cite: 'Enemies/FinalBoss.as:142',
        what: '`!Math.floor(Math.random() * 6)` — the per-tick rock gate',
    }),
    spawnX: Object.freeze({
        draws: 1,
        cite: 'Enemies/FinalBoss.as:144 (first argument)',
        what: '`p.x + p.v.x * -15 + Math.random() * 40 - 20`',
    }),
    spawnY: Object.freeze({
        draws: 1,
        cite: 'Enemies/FinalBoss.as:144 (second argument)',
        what: '`p.y + p.v.y * -15 + Math.random() * 40 - 20`, drawn AFTER x',
    }),
    rockScale: Object.freeze({
        draws: 1,
        cite: 'Scenery/RockFall.as:33',
        what: '`sprRockFall.scale = Math.random() / 2 + 0.25`. ⛓ The two '
            + '`FP.choose` around it (`angleRate`, `scaleX`) are FlashPunk\'s own '
            + 'Park-Miller LCG and cost this stream nothing (§15.3).',
    }),
    grenadeRoll: Object.freeze({
        draws: 1,
        cite: 'Enemies/FinalBoss.as:158',
        what: '`!Math.floor(Math.random() * 40)` — the walk phase\'s grenade gate',
    }),
    enemyCoins: Object.freeze({
        draws: 1,
        cite: 'Enemies/Enemy.as:30',
        what: '⛔ THE SITE §16.8 DID NOT HAVE. `private const coins:int = 4 + '
            + 'Math.random() * 4` is an instance FIELD INITIALIZER, so every '
            + '`new Grenade(...)` pays it. `RockFall` extends `Mobile` and does not.',
    }),
    deathRockX: Object.freeze({
        draws: 1,
        cite: 'Enemies/FinalBoss.as:216',
        what: '`120 + Math.random() * 8 - 4` — the x of each of the death arm\'s '
            + 'five rocks. The y argument (`i / n * Tile.h * 2`) draws nothing.',
    }),
    jiggleX: Object.freeze({
        draws: 1,
        cite: 'Game.as:1879',
        what: '`FP.camera.x += shake * Math.random() - shake / 2`',
    }),
    jiggleY: Object.freeze({
        draws: 1,
        cite: 'Game.as:1880',
        what: '`FP.camera.y += shake * Math.random() - shake / 2`, and the decay '
            + '`shake = Math.max(shake - 1, 0)` is on the line below — ONE per '
            + 'FRAME, against `+= scale + 1` per landing.',
    }),
    orbRandVal: Object.freeze({
        draws: 1,
        cite: 'Scenery/Orb.as:27',
        what: '⛔ A LEVEL-BUILD DRAW THE MODEL OWES. `private const randVal:Number = '
            + 'Math.random()` on L112\'s one `orb@120,128`. §16.8 called it "ABOVE '
            + '`botStart`\'s seed reset and therefore free"; it is not — see '
            + '`OWL_LEVEL_BUILD_DRAWS`.',
    }),
});

/**
 * ⛔⛔⛔ THE LEVEL BUILD IS **ON** THE SEEDED STREAM, AND THE SHIPPED
 * COMMENT SAYS IT IS NOT.
 *
 * `Bot.botStart` (`Bot.as:1148-1180`) does
 *
 *     if (bootLevel != Main.level || !atBootPosition())
 *         FP.world = new Game(bootLevel, bootX, bootY);
 *     …
 *     if (rngSeed != 0) Rng.setState(rngSeed);
 *
 * with a docblock reading *"THE POSITION OF THIS LINE IS THE WHOLE POINT.
 * `new Game` runs its constructor synchronously right above — three
 * `Math.random()` draws for every Tile it builds, one per Enemy — and the
 * swap itself is deferred to end-of-tick. Resetting BELOW it means the model
 * owes nothing for the world build."*
 *
 * **`Game`'s constructor does not build the level.** `Game.as:629-652` sets
 * `level`, `playerPosition` and calls `end()`; the `loadlevel(levels[level])`
 * call is in **`begin()`** (`Game.as:682+`), which FlashPunk invokes when the
 * deferred swap actually happens — i.e. AFTER `botStart` returned and
 * therefore AFTER `Rng.setState`. ⇒ every seeded tape's stream contains its
 * own world build, and a model that starts counting at tick 0 is offset by
 * exactly that many draws for the whole run.
 *
 * ⛓ THE OFFSET IS SMALL AND FULLY ATTRIBUTED FOR L112, which is what makes
 * it a constant rather than a census. Under `split: true` the ~225 `Tile`
 * constructor draws are `Rng.cos()` and move the OTHER generator; what is
 * left on the gameplay stream is
 *
 *   1. `Enemy.as:30`'s `coins`, once, for the one `finalboss@64,96`
 *      (`Game.as:2135`), and
 *   2. `Scenery/Orb.as:27`'s `randVal`, once, for the one `orb@120,128`
 *      (`Game.as:2217`),
 *
 * in that order, because `loadlevel` adds them in that order. Nothing else
 * in the room's object list reaches `Math.random()`: the pods, the four
 * plant torches, the rock lock, the two teleporters and the player are all
 * clean, and L112 holds no `t == 0` or `t == 8` tile so `Tile.addGrass` —
 * the one GAMEPLAY tile draw (§15.7) — never fires.
 *
 * ⚠ IT IS A PER-LEVEL NUMBER, not a universal one. A different boot level
 * pays its own census, which is why this is named for the room.
 */
export const OWL_LEVEL_BUILD_SITES = Object.freeze(['enemyCoins', 'orbRandVal']);
export const OWL_LEVEL_BUILD_DRAWS = OWL_LEVEL_BUILD_SITES.length;

/**
 * The per-tick schedule, as an ordered table keyed by the boss's phase.
 *
 * ⛔ THE JIGGLE IS NOT IN THESE ROWS. It is appended by `owlTickSites`
 * because it is a property of the FRAME and not of the boss — it fires on
 * ticks the boss is frozen, on ticks he is dead, and on ticks he is coasting.
 * Folding it into the phase rows would have made "0 draws while coasting"
 * false in exactly the case a plan leans on it.
 */
export const OWL_PHASE_SITES = Object.freeze({
    /** `!started`: the intro raises the freeze and the boss returns above everything. */
    intro: Object.freeze([]),
    /** `Game.freezeObjects || destroy` — the `return` right after `super.update()`. */
    frozen: Object.freeze([]),
    /** The lava self-hit arm ends in `return`, so the tick costs nothing more. */
    lavaHit: Object.freeze([]),
    /** A barrage tick whose roll came up non-zero. */
    barrage: Object.freeze(['barrageRoll']),
    /** A barrage tick whose roll was 0: the rock's two args, then its ctor. */
    barrageSpawn: Object.freeze(['barrageRoll', 'spawnX', 'spawnY', 'rockScale']),
    /** `rockfallTime == 0`: opens the pod, advances `cpod`, draws nothing. */
    podTick: Object.freeze([]),
    /** A walk tick whose grenade roll came up non-zero. */
    walk: Object.freeze(['grenadeRoll']),
    /** A walk tick that spawned a grenade — the roll, then `Enemy`'s field init. */
    walkGrenade: Object.freeze(['grenadeRoll', 'enemyCoins']),
    /** ⛓ Shoved: `v.length > moveSpeed` skips the walk arm and every other one. */
    coast: Object.freeze([]),
    /** `endAnim`'s "dead" arm: five rocks, each an x argument then a ctor scale. */
    deathAnim: Object.freeze([
        'deathRockX', 'rockScale', 'deathRockX', 'rockScale', 'deathRockX',
        'rockScale', 'deathRockX', 'rockScale', 'deathRockX', 'rockScale',
    ]),
});

/** The two frame-level sites, in the order `view()` makes them. */
export const OWL_JIGGLE_SITES = Object.freeze(['jiggleX', 'jiggleY']);

/**
 * The ordered site list for one frame.
 *
 * @param {string} phase a key of `OWL_PHASE_SITES`
 * @param {boolean} shaking was `Game.shake > 0` when `view()` ran?
 */
export function owlTickSites(phase, shaking) {
    const rows = OWL_PHASE_SITES[phase];
    if (!rows) {
        throw new OwlRngError(`owlTickSites: "${phase}" is not a phase; the phases are `
            + `${Object.keys(OWL_PHASE_SITES).join(', ')}`);
    }
    return shaking ? [...rows, ...OWL_JIGGLE_SITES] : [...rows];
}

/** How many draws one frame of a given phase costs. */
export function owlTickDraws(phase, shaking) {
    return owlTickSites(phase, shaking).length;
}

/**
 * The stream, with a per-site ledger.
 *
 * ⛓ EVERY METHOD IS A SITE AND EVERY SITE IS A METHOD. The arithmetic lives
 * here beside the draw so a caller cannot take a number and apply the wrong
 * formula to it — `spawnX` returns the ARGUMENT the game passes, truncation
 * included, not "a random in [0,1)".
 */
export class OwlDrawStream {
    /**
     * @param {number} seed the tape's `rng.seed` (0 = the build's boot seed)
     */
    constructor(seed = 0) {
        this.rng = new SeedlingRng(seed);
        /** Every draw in order: `{ site, raw }`. The order IS the claim. */
        this.log = [];
        /** Per-site counts, for a test that wants the shape rather than the trace. */
        this.counts = Object.fromEntries(Object.keys(OWL_DRAW_SITES).map((k) => [k, 0]));
    }

    /** The generator's live state — the number `botStatus.rng.state` reports. */
    get state() { return this.rng.state; }

    /** How many times the crank has turned. */
    get count() { return this.log.length; }

    /** @private one draw, booked to a site. */
    _draw(site) {
        if (!(site in OWL_DRAW_SITES)) {
            throw new OwlRngError(`OwlDrawStream: "${site}" is not in OWL_DRAW_SITES`);
        }
        const raw = this.rng.next();
        this.log.push({ site, raw });
        this.counts[site] += 1;
        return raw;
    }

    /** `FinalBoss.as:142` — true when a rock spawns this tick. */
    barrageRoll() {
        return !Math.floor(this._draw('barrageRoll') * ROCK_FREQUENCY);
    }

    /**
     * The rock's x ARGUMENT (`FinalBoss.as:144`), before `RockFall`'s `int`.
     *
     * ⛓ `pvx` is the player's velocity as the BOSS sees it — i.e. from the
     * end of the previous tick, because the boss updates first.
     */
    spawnX(px, pvx) {
        return px + pvx * ROCK_STEPS_AHEAD
            + this._draw('spawnX') * ROCK_RADIUS * 2 - ROCK_RADIUS;
    }

    /** The rock's y argument, drawn AFTER x (AS3 evaluates arguments left to right). */
    spawnY(py, pvy) {
        return py + pvy * ROCK_STEPS_AHEAD
            + this._draw('spawnY') * ROCK_RADIUS * 2 - ROCK_RADIUS;
    }

    /** `RockFall.as:33` — the sprite scale, which is also the hitbox and the shake. */
    rockScale() {
        return this._draw('rockScale') * ROCK_SCALE_SPAN + ROCK_SCALE_BASE;
    }

    /** `FinalBoss.as:158` — true when a grenade spawns this walk tick. */
    grenadeRoll() {
        return !Math.floor(this._draw('grenadeRoll') * GRENADE_FREQUENCY);
    }

    /**
     * `Enemy.as:30` — the coin count nothing in this room ever spends.
     *
     * ⛓ THE VALUE IS DEAD AND THE DRAW IS NOT. `dropCoins()` is reached from
     * `Enemy.death()`, which `Grenade` never runs (it is removed by its own
     * `animEnd`), so the number is discarded — and the crank still turned.
     * A census that only counted draws whose values are read would have
     * missed this one for the same reason §16.8 did.
     */
    enemyCoins() {
        return as3Int(ENEMY_COINS_BASE + this._draw('enemyCoins') * ENEMY_COINS_SPAN);
    }

    /** `FinalBoss.as:216` — one death rock's x argument. */
    deathRockX() {
        return 120 + this._draw('deathRockX') * 8 - 4;
    }

    /** `Scenery/Orb.as:27` — a level-build draw whose value nothing gameplay reads. */
    orbRandVal() {
        return this._draw('orbRandVal');
    }

    /**
     * The room's own construction, in `Game.loadlevel`'s add order.
     *
     * ⛓ CALLED BEFORE TICK 0, because `Game.begin()` — which is where
     * `loadlevel` lives — runs after `Bot.botStart` has already reseeded.
     * See `OWL_LEVEL_BUILD_DRAWS`.
     */
    levelBuild() {
        this.enemyCoins();
        this.orbRandVal();
    }

    /**
     * `Game.as:1879-1880` — the camera offset, both axes, in that order.
     *
     * ⚠ The DECAY is the caller's: `view()` runs `shake = max(shake - 1, 0)`
     * on the line after the two draws, once per frame regardless of how many
     * rocks landed into it.
     */
    jiggle(shake) {
        const dx = shake * this._draw('jiggleX') - shake / 2;
        const dy = shake * this._draw('jiggleY') - shake / 2;
        return { dx, dy };
    }
}

/**
 * ⛔ THE REFUSAL THAT KEEPS THE TABLE HONEST.
 *
 * The schedule above is complete only for a run whose cosmetic draws are on
 * their own generator. `Music.playSound("Rock", 0)` fires on EVERY rock
 * landing and `Music.as:673` picks its variant with `Rng.cos()`; with
 * `split: false` that is a `Math.random()` on this stream, interleaved
 * between a rock's update and the boss's, and this module would be silently
 * one draw per landing behind.
 *
 * So an exact fight refuses a tape that has not declared the split, by name,
 * rather than producing a stream position that drifts once per rock.
 */
export function assertOwlStreamPremises(rngBlock, what = 'the Owl fight') {
    if (!rngBlock || typeof rngBlock !== 'object') {
        throw new OwlRngError(`${what} needs a tape_version 7 \`rng\` block`);
    }
    if (rngBlock.split !== true) {
        throw new OwlRngError(`${what} needs \`rng: { split: true }\`. With the split `
            + 'off, `Rng.cos()` IS `Math.random()`, so `Music.as:673`\'s sound-index '
            + 'pick draws from the gameplay stream once per ROCK LANDING and the '
            + 'schedule in `finalBossRng.js` is short by exactly that many. The '
            + 'stream would be reproducible and this model would still be wrong.');
    }
    if (!Number.isInteger(rngBlock.seed) || rngBlock.seed <= 0) {
        throw new OwlRngError(`${what} needs a declared \`rng.seed\` in 1..2147483647; `
            + `got ${JSON.stringify(rngBlock.seed)}. Seed 0 means "inherit the build's `
            + 'boot state", which is an ORIGIN this model does not have — §90\'s '
            + 'reproducible-is-not-predictable, in the one room where it bites.');
    }
    return true;
}
