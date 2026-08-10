/**
 * seedlingDemo/tapeFormat — the INPUT TAPE contract for the real-game
 * Seedling bot ladder (region-atlas plan Phase 8; brief:
 * `CC/docs/plans/seedling-bot-v1-opus-kickoff.md` §3.1).
 *
 * One schema, TWO consumers: this module (the JS iteration surface) and
 * `Bot.as` compiled into the recompiled Seedling wasm build (the oracle).
 * A differential harness replays the same tape through both and compares
 * observation streams, so anything ambiguous here becomes a divergence
 * there. Every rule below is therefore stated as a loud error, never a
 * silent default — a tape the two sides interpret differently is exactly
 * the bug this format exists to make impossible.
 *
 * ── Why hold-SPANS and not per-tick key states ────────────────────────
 * Seedling reads input three different ways and the tape has to express
 * all three (recon: `Player.as`, `NPCs/NPC.as:191`, `SealController.as:95`):
 *   - movement  → `Input.check`    (held)
 *   - item use  → `Input.pressed`  (down EDGE)
 *   - dialogue  → `Input.released` (full down-then-up)
 * A span `{from, to}` yields a press edge on tick `from` and a release
 * edge on tick `to`, so a length-1 span covers `pressed` AND `released`
 * while a long span covers `check`. `from` inclusive, `to` EXCLUSIVE.
 *
 * ── Tick indexing ─────────────────────────────────────────────────────
 * Tick 0 is the first tick the bot is ARMED (after `botStart`, once the
 * post-boot `blackCover` fade has finished). Ticks advance ONLY on ticks
 * where entities actually update — the AS3 side gates on
 * `blackCover <= 0 && !Game.freezeObjects`, both of which suppress all
 * movement, so a dead frame must not consume tape. NEVER index by
 * wall-clock: `FP.elapsed` appears in zero lines of Seedling game code,
 * so one update call is one fixed physics step and a tick-indexed tape is
 * deterministic for movement.
 *
 * ── Observation streams: RECORD-THEN-ACT ──────────────────────────────
 * The AS3 bot's only hook is the top of `Main.update()`, BEFORE
 * `super.update()` — i.e. before this tick's movement happens. So it
 * records first, then dispatches this tick's key events. That makes
 * observation `t` the state after exactly `t` completed movement ticks:
 * `ticks[0]` is the boot position under no input, and a tape of N ticks
 * yields N+1 observations (0..N). `runTape` here mirrors that exactly.
 * Getting this off by one is the easiest way to make every differential
 * red for a reason that has nothing to do with physics.
 *
 * ── Room transitions: the settled tick order ──────────────────────────
 * v2 slice 3. Documented here because the brief (§3.3) said the exact
 * alignment was the kind of off-by-one the oracle had to settle, and the
 * slice-0 recording settled it. Within one tick:
 *
 *   1. Teleporters update BEFORE the player — `World.addUpdate` PREPENDS
 *      (`World.as:937-947`) and `loadlevel` adds the player (`Game.as:2040`)
 *      before the teleporters (`:2169`) — so a trigger tests the position
 *      the PREVIOUS tick left, which is the position this tick starts from.
 *   2. If one fires, the old player still runs this tick's FULL movement in
 *      the old level: `FP.world = new Game(...)` only sets `_goto` and the
 *      swap is deferred to `Engine.checkWorld` at end-of-tick.
 *   3. The swap lands at end-of-tick: a whole new `Game`, whose `Player` is
 *      constructed at `(playerx + 8, playery + 8)` with zero velocity and a
 *      fresh terrain state, while the HELD KEYS carry over (FlashPunk's
 *      `Input` is static and no teleport path calls `Input.clear()`).
 *   4. The ~19 `blackCover` frames that follow are DEAD FRAMES, skipped by
 *      both consumers, so the old player's last doomed step is never
 *      observed and never feeds the new one. There is no intermediate
 *      observation: the last old-level observation is the first position
 *      overlapping the trigger, and the next one is already the arrival.
 *
 * Recorded (`transition-west-return`): tick 60 is the last level-0
 * observation at x = 17.70000000000001, tick 61 is the arrival (296, 168)
 * in level 94. Hence a `transitions` entry's `t` is "the first observation
 * tick whose `level` is the NEW level" (§1 ruling 2), and the record is the
 * minimal symmetric one, `{t, from_level, to_level}` — arrival position is
 * already `ticks[t]` and is not duplicated, and teleporter identity is
 * EXCLUDED because the AS3 bot cannot observe it without a patch and an
 * asymmetrically-known field cannot be differentially checked.
 *
 * ── Where each side's `transitions` come from ─────────────────────────
 * The JS engine derives its entries from its OWN world swap (`tapeRunner`),
 * which is what makes the comparison worth making. The GAME does not hand
 * the field over at all — `Bot.as`'s `botDrain` returns `transitions: []`
 * unconditionally and re-recording will never populate it — so the harness
 * derives the game's side from the tick stream with `deriveTransitions`
 * below, which the ruling's definition makes a pure function of it.
 *
 * That derivation is deliberately in ONE place, and it is applied at
 * RECORD time rather than at compare time: the committed expectation then
 * carries its transitions explicitly, so the fixture's central claim is
 * readable and diffable in git instead of being conjured on both sides of
 * every comparison. The cost is that adding the field to an existing
 * expectation needs a re-record; that was paid once, for the two v2
 * fixtures. `verify-seedling-bot-differential.mjs` applies it to the live
 * stream on BOTH paths (record and compare) and checks that the game's own
 * field is still empty, so an AS3 build that starts reporting transitions
 * is a named failure rather than something the derivation quietly masks.
 */

/**
 * ── Version 2: the subtractive ladder's relaxations ───────────────────
 * R0 of the SUBTRACTIVE ladder (`CC/docs/plans/seedling-bot-r0-opus-kickoff.md`)
 * adds three fields, all REQUIRED on a v2 tape because each one selects
 * which experiment BOTH consumers are running:
 *
 *   `noDamage`   `Bot.noDamage` — `Player.hit()` returns before
 *                sound/shake/knockback/die.
 *   `noHazards`  the SET of dangerous terrains whose EFFECTS are coerced
 *                away, by name. Not a boolean: R4 re-arms hazards one at a
 *                time, so a boolean could not express a single R4 rung and
 *                would have forced a second ~10-minute AS3 build to change
 *                its type (decided in the R0 kickoff §8.8, before the batch).
 *   `grants`     items handed to the player on first ENTERING a level,
 *                the crutch that lets an item walk gate R1 before the
 *                pickup ceremony is modelled.
 *
 * Version 1 tapes stay parseable and are UNCHANGED on disk — the eleven
 * committed fixtures are v1 and must stay byte-identical. A v1 tape that
 * declares any v2 field is a named error rather than a tape whose extra
 * fields one side honours and the other ignores; the parser then normalises
 * v1 to the v2 semantics that ARE version 1 (`noDamage: false`,
 * `noHazards: []`, `grants: []`) so no engine has to branch on version, and
 * `serializeTape` writes the fields back only for a v2 tape.
 */

/**
 * Schema version written by `serializeTape` for new tapes.
 *
 * ⚠ NOTHING THAT EMITS A TAPE READS THIS — see `botDriverV1`'s docblock.
 * The emitted version is decided by WHICH FIELDS THE CALLER DECLARES, so
 * bumping this constant cannot silently re-version the committed fixtures.
 * It is documentation plus one test's anchor.
 */
export const TAPE_VERSION = 9;

/** Every version this parser accepts. v1 tapes are frozen, not deprecated. */
export const SUPPORTED_TAPE_VERSIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/**
 * ── Version 7: the RNG STATE ──────────────────────────────────────────
 *
 * `rng: { seed, split }`, and it is the first field whose reason is that the
 * game is not deterministic ENOUGH from outside rather than too little.
 *
 * `Math.random()` in the recompiled build is one global LFSR (`rng.js`), so
 * a page reproduces exactly and predicts nothing: the value the Owl reads
 * when he decides whether to drop a rock depends on how many draws the page
 * has made since it loaded, across every world it has built. A tape that
 * claims anything about that fight therefore has to DECLARE its stream the
 * way it already declares its boot level and its save arrays.
 *
 *   `seed`   the value written into the generator at `botStart`, AFTER the
 *            boot world is built — so the tape owes only the draws its own
 *            window makes. 0 means "inherit the page's stream", which is
 *            what every tape before this rung did, and is not a state the
 *            LFSR can reach.
 *   `split`  route the COSMETIC draws (sprite frames, particles, sound
 *            indices, the camera jiggle — `Rng.cos()` in the fork, 31 call
 *            sites) onto a second generator, so they stop shifting the
 *            gameplay stream. Off means `Rng.cos()` IS `Math.random()`,
 *            which is why every committed fixture is byte-inert past the
 *            batch that added it.
 */
export const RNG_KEYS = Object.freeze(['seed', 'split', 'cosmetic', 'fp']);

/**
 * ── Version 8's two additions to the rng block: THE OTHER TWO STREAMS ──
 *
 * R7's seam is `boot(N+1) == latch(N)`, and a segment does not start its
 * generators where a fresh page does — it starts them where its predecessor
 * left them. `seed` alone declares one of three (trap 96, extended at R7
 * slice 0):
 *
 *   `cosmetic`  the second generator behind `Rng.cos()`. It only EXISTS as
 *               a separate stream while `split` is on; with the split off
 *               `Rng.cos()` IS `Math.random()` and this field declares a
 *               generator nothing draws from. 0 keeps the build's own boot
 *               state, which is what every pre-R7 tape means.
 *   `fp`        FlashPunk's own Park-Miller LCG (`FP._seed`), seeded ONCE
 *               per page from one `Math.random()` in `Engine`'s ctor and
 *               never reset. ⚠ It has NO gameplay consumer in this game —
 *               every `FP.choose`/`FP.rand` site feeds a graphic angle, a
 *               sprite mirror or a particle — so it is declared and
 *               compared, not relied on. 0 means "inherit the page's".
 *
 * ⛔ AND `FP.randomSeed`'s GETTER CANNOT READ IT: it returns `_getSeed`,
 * which only the setter writes, so after one draw it is a stale mirror. The
 * fork's read hook is `FP.randomSeedLive` (R7 slice 1); the WRITE side is
 * the existing setter, which is the half that works.
 */
export const RNG_COSMETIC_MAX = 2147483647;
/**
 * ⛔ 2147483646, NOT 2147483647, and the bound is the SETTER's own.
 * `FP.randomSeed`'s setter is `_seed = clamp(value, 1, 2147483646)`
 * (`FP.as:392`), so a declared 2147483647 would be applied as a DIFFERENT
 * state than the tape names. A seam field whose declared and applied values
 * disagree is worse than one that is absent.
 */
export const RNG_FP_SEED_MAX = 2147483646;

/**
 * The largest declarable seed, and it is 2^31 - 1 for TWO independent
 * reasons that happen to coincide.
 *
 * 1. ⛓ **IT IS THE WHOLE ORBIT.** The n = 31 tap is `0x48000000`, whose top
 *    bit is clear, so `(u >>> 1) ^ mask` never sets bit 31: every state the
 *    generator can reach lives in [1, 2^31), which is the `uSequenceLength`
 *    the runtime computes. A seed above it is not a state the game could
 *    ever be in.
 * 2. ⛔ **AND THE TRANSPORT COULD NOT CARRY IT ANYWAY — MEASURED.** The
 *    recompiled runtime's `JSON.parse` coerces an integral Number to int32,
 *    so a tape declaring 2147483648 arrives in `Bot.as` as **-2147483648**.
 *    The first run of `probe-seedling-rng.mjs` hit exactly this and the
 *    probe's own range check caught it. A field whose two consumers read
 *    different values is the divergence this whole format exists to
 *    prevent, so the bound is stated here rather than left to the
 *    transport to enforce silently.
 *
 * 0 stays the "declares nothing" value; it is not a reachable state.
 */
export const RNG_SEED_MAX = 2147483647;

/**
 * ── Version 5: the DETERMINISM PINS ───────────────────────────────────
 *
 * A different KIND of field from every one above it. `noDamage`, `noHazards`
 * and `grants` are CRUTCHES — a later rung retires each. A pin is kept
 * forever: it selects WHICH vanilla-reachable execution the run gets and
 * creates no vanilla-unreachable one, so a recording made under it is still
 * a real-game run, just a repeatable one (R5 kickoff §3.6, ruled at §13).
 *
 *   `sound`        `Music.soundPosition`/`soundIsPlaying`/`soundPercentage`
 *                  read a FRAME CLOCK — one step per engine update from
 *                  `playSound` — instead of the live Web Audio mixer. The
 *                  R5 slice-2 probe measured the same tape at 0.4 fps and
 *                  10.1 fps DIVERGING at tick 52, four ticks after the water
 *                  edge, because `Player.as:530` compares a MILLISECOND
 *                  reading against a frame count. See `swimSoundClock.js`,
 *                  which is the JS half of the same arithmetic.
 *   `dead_frames`  `Game.blackCover` decays per UPDATE rather than per
 *                  RENDER, so a room fade costs a fixed number of dead
 *                  frames instead of the ±2 band measured at slice 0 — and
 *                  the `Game.time`-coupled hazards stop carrying that band
 *                  as phase uncertainty.
 *
 * An ARRAY OF NAMES rather than booleans, the `noHazards` shape, for the
 * `noHazards` reason: the next pin that gets ruled in must not cost a second
 * full pipeline run to express.
 */
export const PIN_NAMES = Object.freeze(['sound', 'dead_frames']);

/**
 * The engine frame rate the sound pin reproduces — `Main.as:27`'s
 * `FPS = 60`, which `Engine` writes to `stage.frameRate`.
 *
 * ⚠ NOT the SWF's `-default-frame-rate=30`: that is the stage default the
 * `Engine` constructor immediately overwrites (`Engine.as:40,109`). Taking
 * the compile flag's number instead would halve every pinned position and
 * turn six boosted swim ticks into three.
 */
export const PIN_FRAME_RATE = 60;

/**
 * ⚠ THE SPAWN IS BAKED INTO THE BUILD, so a tape's `boot` block is a CLAIM
 * about the build rather than an instruction to it.
 *
 * `Main.as:51` is `FP.world = new Game(0, 80, 128)`, and `Bot.as` assigns
 * `bootLevel = int(t.boot.level)` and then never reads it — `boot.x`/`boot.y`
 * it does not look at at all. So a tape declaring anything else is silently
 * HONOURED by the JS engine and silently IGNORED by the game, and the
 * differential blames the physics for a disagreement that is entirely
 * bookkeeping. That is exactly the asymmetric interpretation this format
 * exists to make impossible, so it is a named error like every other
 * ambiguity here (found in v2 slice 0; the check is slice 4's).
 *
 * When the build gains a parameterised boot — an AS3 edit, and therefore
 * something to batch — this constant is the ONE place that changes, and
 * `parseTape` becomes a check that the tape names a boot the build can
 * actually take rather than the single one it always takes.
 */
export const BUILD_SPAWN = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * The ONE canonical key-name → AS3 keycode table, asserted by both
 * consumers. Source of truth: `Player.as:59`
 *   keys = [RIGHT, UP, LEFT, DOWN, X, C, X, V, I]
 * with codes from `net/flashpunk/utils/Key.as`.
 *
 * `primary` and `talk` are BOTH Key.X in the game (keys[4] and keys[6]);
 * the tape exposes the single name `primary` because they are physically
 * the same key — a second name would let two tapes mean the same thing.
 */
export const KEY_CODES = Object.freeze({
    right: 39,       // Key.RIGHT  — keys[0]
    up: 38,          // Key.UP     — keys[1]
    left: 37,        // Key.LEFT   — keys[2]
    down: 40,        // Key.DOWN   — keys[3]
    primary: 88,     // Key.X      — keys[4] (and keys[6], "talk")
    secondary: 67,   // Key.C      — keys[5]
    inventory: 86,   // Key.V      — keys[7]
    inventory2: 73,  // Key.I      — keys[8]
});

/**
 * Keycodes that must NEVER appear in a tape, with the reason. These are
 * not merely "unused" — synthesizing them corrupts a run:
 *   M/R/Esc are read by `Game.update` BEFORE entities (`Game.as:793-801`)
 *   and several branches call `Input.clear()` or rebuild the world
 *   (`:796, 1274-1284`); W opens a URL (`Player.as:1533`).
 * They are absent from KEY_CODES, so this list exists to give the
 * validator a NAMED error instead of a generic "unknown key".
 */
export const FORBIDDEN_KEYS = Object.freeze({
    m: { code: 77, why: 'Game.update reads it before entities and may Input.clear() / rebuild the world' },
    r: { code: 82, why: 'Game.update restart branch rebuilds the world mid-tape' },
    esc: { code: 27, why: 'Game.update menu branch calls Input.clear()' },
    escape: { code: 27, why: 'Game.update menu branch calls Input.clear()' },
    w: { code: 87, why: 'Player.as:1533 opens an external URL' },
});

/** Every legal key name, for error messages and cross-consumer assertion. */
export const KEY_NAMES = Object.freeze(Object.keys(KEY_CODES));

/**
 * `noHazards` vocabulary: the five DANGEROUS terrain states, by name.
 *
 * These are exactly the tile types whose EFFECTS the R0 kickoff §3.2(e)
 * ruling coerces to Ground(0) — the ones where the physics stops being a
 * function of position. Stairs (10) and Ghost Step (30) are deliberately
 * absent: they are merely slower, they are already modelled, and flattening
 * them would erase real physics rather than a hazard.
 *
 * NAMES rather than raw ints so a tape says what it disables and a reader
 * of a committed fixture does not have to hold `Tile.types` in their head.
 * Transcribed here rather than imported so this module stays dependency-free
 * and browser-usable, exactly like `KEY_CODES`; `tapeFormat.test.js`
 * cross-asserts every entry against `flashPanel/seedlingSemantics.js`, which
 * is the same guard shape the key table has.
 */
export const HAZARD_STATES = Object.freeze({
    water: 1,
    pit: 6,
    lava: 17,
    ice: 22,
    waterfall: 25,
});

/** The state a coerced hazard becomes: Ground, `Player.as:297`'s own initial. */
export const COERCED_TERRAIN_STATE = 0;

export const HAZARD_NAMES = Object.freeze(Object.keys(HAZARD_STATES));

/**
 * `grants` vocabulary: the 14 items, by the `flash_name` the rest of the
 * repo already uses.
 *
 * Source of truth is `flashPanel/games/seedling.json`'s `items[]`, which is
 * what the AP integration writes through; `tapeFormat.test.js` asserts this
 * table against that file so the two cannot drift. The `property` is a
 * `Player` static that delegates to a `Main` one (`Player.as:102-108` and
 * its fourteen siblings), so `Bot.as` can write it directly and
 * `botStatus.items` can read it back — which is what makes the game, not
 * this mirror, the oracle for whether a grant landed.
 *
 * ⚠ Thirteen are booleans and **`health` is not**: it is `hitsMax`, an INT,
 * `op: "add"` over `base: 3`. An "all items true" assertion that forgets
 * that is asserting the wrong thing about one fourteenth of the set.
 */
export const ITEM_PROPERTIES = Object.freeze({
    sword: { property: 'hasSword', kind: 'boolean' },
    darksword: { property: 'hasDarkSword', kind: 'boolean' },
    ghostsword: { property: 'hasGhostSword', kind: 'boolean' },
    shield: { property: 'hasShield', kind: 'boolean' },
    darkshield: { property: 'hasDarkShield', kind: 'boolean' },
    fire: { property: 'hasFire', kind: 'boolean' },
    wand: { property: 'hasWand', kind: 'boolean' },
    firewand: { property: 'hasFireWand', kind: 'boolean' },
    conch: { property: 'canSwim', kind: 'boolean' },
    feather: { property: 'hasFeather', kind: 'boolean' },
    spear: { property: 'hasSpear', kind: 'boolean' },
    darksuit: { property: 'hasDarkSuit', kind: 'boolean' },
    torch: { property: 'hasTorch', kind: 'boolean' },
    health: { property: 'hitsMax', kind: 'add', base: 3, value: 1 },
});

export const ITEM_NAMES = Object.freeze(Object.keys(ITEM_PROPERTIES));

class TapeFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TapeFormatError';
    }
}

/**
 * ⚠ THE ONLY CROSS-MODULE IMPORT IN THIS FILE, and it is read inside
 * `parseSeam` rather than at module scope — `r7Acceptance` -> `fixtures/
 * index.js` -> this module is a cycle, and a module-scope derivation would
 * hit the temporal dead zone whenever `r7Acceptance` is the entry point.
 * The v8 block's key list has to come FROM the seam signature (trap 86:
 * assert against a list the owner exports, never retype it), so the cycle
 * is accepted and defused rather than avoided by duplicating the list.
 */
// eslint-disable-next-line import/no-cycle
import { SEAM_BOOT_SPEC } from './r7Acceptance.js';

function fail(message) {
    throw new TapeFormatError(message);
}

function requireInt(value, what) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        fail(`${what} must be an integer, got ${JSON.stringify(value)}`);
    }
    return value;
}

function requireFiniteNumber(value, what) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${what} must be a finite number, got ${JSON.stringify(value)}`);
    }
    return value;
}

/**
 * `persistence` (version 3): the CLEARS a tape applies before its first
 * live tick, as `{level, tag, note}`.
 *
 * ── Clears only, and never wholesale ──────────────────────────────────
 * There is no way to set a flag TRUE from a tape. Persistence is a shared,
 * cross-level, endgame load-bearing namespace — `FinalDoor` reads level
 * 114's tag 0 as "talked to the Watcher", `Moonrock` writes level 2's from
 * level 0 — so a crutch that could write either way could forge an ending.
 *
 * `note` is an AUDIT field: it names the blocker class the entry despawns,
 * both consumers ignore it, and it is what makes a clear list reviewable
 * as a list rather than as forty pairs of numbers.
 *
 * ⚠ A NEGATIVE TAG IS NOT "no tag". Entities use -1 for untagged and every
 * persistence reader guards on `tag >= 0`, so a clear for -1 could never
 * despawn anything — it would be a line in the audit list that does
 * nothing, which is worse than an absent one.
 *
 * ── ⛓⛓⛓ VERSION 9: `at` — THE WITNESSED MID-RUN CLEAR ────────────────
 *
 * ⚖ RULED (the orchestrating session, R7 slice 6d). A clear may carry
 * `at: <tick>`, and then it is applied AT THAT TICK instead of before the
 * first one. It exists for one measured situation and its shape is that
 * situation's shape:
 *
 * L5's `lock@48,112 {5,0}` is a KILL-LOCK the game removes MID-RUN, when
 * arrows the player never fired kill the last bob. Nothing in this tree
 * models an Arrow killing an Enemy (§16.4 refuses it by name — the chaser's
 * position is the unmodelled term), so a segment that walks through that
 * cell is a recording the MODEL cannot replay: measured, byte-identical for
 * 816 ticks and then 0.585 px short at the lock's face. The alternative —
 * split so the crossing BOOTS the clear — is refuted by the GAME: leaving
 * the room respawns every enemy in it while the clear stays durable, so the
 * fight does not survive the door.
 *
 * ⛔⛔ WHY THIS IS NOT A STAGED GRANT, in three parts:
 *  1. **The boot stays honest.** `at` says the run's own play cleared the
 *     flag at tick T; the boot block still declares the state the segment
 *     really started in, so `chainFindings`' custody claim is untouched.
 *  2. **`at` is NEVER FITTED.** It is the END TICK of the `phases` block
 *     that earns it — the same tick a driven arm already asserts the clear
 *     at, by reading the game's own `persistence_cleared` in a truncated
 *     run. Nothing between the true clear and the block's end reads the
 *     flag.
 *  3. **The check stays TWO-SIDED.** The differential compares the model's
 *     expected clear set against the game's `persistence_cleared`, so a
 *     declaration the game did not honour reddens the persistence row. And
 *     `playthroughAcceptance` adds the law that keeps "witnessed"
 *     mechanical: NO `at`-CLEAR WITHOUT A `phases` BLOCK WHOSE `earns`
 *     CARRIES THAT TAG AND WHOSE END TICK IS `at`.
 *
 * ⚠ REFUSED BOTH WAYS (trap 98). A tape below version 9 may not carry `at`
 * at all — the field changes WHEN a clear applies, which is replay
 * semantics, and a v8 reader silently treating it as a boot clear would
 * replay a different walk. A v9 tape's `at` must be an integer in
 * `[0, tick_count]`.
 */
export const TAGS_PER_LEVEL = 30;   // Game.as:525
export const LEVEL_COUNT = 116;     // Game.levels.length

function parsePersistence(raw, version, tickCount) {
    if (!Array.isArray(raw.persistence)) {
        fail('persistence must be an array of {level, tag, note} on a tape_version 3 '
            + `tape ([] when nothing is cleared), got ${JSON.stringify(raw.persistence)}`);
    }
    const seen = new Set();
    const clears = raw.persistence.map((c, i) => {
        const where = `persistence[${i}]`;
        if (c === null || typeof c !== 'object' || Array.isArray(c)) {
            fail(`${where} must be an object { level, tag, note }`);
        }
        requireInt(c.level, `${where}.level`);
        requireInt(c.tag, `${where}.tag`);
        if (c.level < 0 || c.level >= LEVEL_COUNT) {
            fail(`${where}.level ${c.level} is not a level (0..${LEVEL_COUNT - 1})`);
        }
        if (c.tag < 0 || c.tag >= TAGS_PER_LEVEL) {
            fail(`${where}.tag ${c.tag} is out of range 0..${TAGS_PER_LEVEL - 1}. A `
                + 'negative tag is not "untagged" here — every persistence reader '
                + 'guards on tag >= 0, so clearing -1 despawns nothing.');
        }
        if (c.note !== undefined && typeof c.note !== 'string') {
            fail(`${where}.note must be a string naming what it despawns, got `
                + `${JSON.stringify(c.note)}`);
        }
        // ⛔ REFUSED BOTH WAYS, per the docblock: below v9 the field cannot
        // exist, at v9 it must be a tick this tape actually has.
        if (c.at !== undefined) {
            if (version < 9) {
                fail(`${where} declares at: ${JSON.stringify(c.at)}, but tape_version `
                    + `${version} has no mid-run clear — a clear applies before the `
                    + 'first live tick BY DEFINITION below version 9, so a reader that '
                    + 'ignored this would replay a different walk. Bump the tape.');
            }
            requireInt(c.at, `${where}.at`);
            if (c.at < 0 || c.at > tickCount) {
                fail(`${where}.at ${c.at} is outside this tape's [0, ${tickCount}]. A `
                    + 'clear that lands after the last tick never happens, and one at a '
                    + 'negative tick is a boot clear spelled confusingly.');
            }
        }
        const key = `${c.level}:${c.tag}`;
        if (seen.has(key)) {
            fail(`${where} duplicates level ${c.level} tag ${c.tag}. A clear is `
                + 'idempotent, so a duplicate is a bookkeeping error in the '
                + 'derivation rather than a harmless repeat.');
        }
        seen.add(key);
        return {
            level: c.level, tag: c.tag, note: c.note ?? '',
            ...(c.at === undefined ? {} : { at: c.at }),
        };
    });
    // Sorted so a re-derived list that changed ORDER is not a diff.
    clears.sort((a, b) => a.level - b.level || a.tag - b.tag);
    return clears;
}

/**
 * ── THE INVENTORY SLOT MODEL (R4) ─────────────────────────────────────
 *
 * `Inventory.addItemsFromSave` (`Inventory.as:277-318`), transcribed. The
 * ids are the game's own and are what `Player.useItem` switches on, so this
 * table is the thing `Main.primary` indexes into.
 *
 * ⚠ The order is the order the pushes happen in, NOT the id order: sword,
 * fire, wand, spear. Under R4's item set — sword and spear — the array is
 * `[0, 3]`, so **slot 1 is the spear** and one equip covers the whole walk.
 *
 * The two FUSIONS splice rather than append: `ghostsword` removes the sword
 * and the spear and inserts id 4 at index 0; `firewand` removes fire and
 * wand and inserts id 5 at index 1. Neither is reachable at R4 (both items
 * are R5-blocked), and they are transcribed anyway — an item table that
 * quietly stopped at the reachable cases is how a later rung inherits a
 * mirror that has always agreed with the game by never being asked.
 */
export const INVENTORY_ITEM_IDS = Object.freeze({
    sword: 0, fire: 1, wand: 2, spear: 3, ghostsword: 4, firewand: 5,
});

/**
 * The slot array for a set of held items, exactly as `addItemsFromSave`
 * builds it.
 *
 * @param {object} items  an inventory mirror: `{hasSword, hasFire, ...}`
 * @returns {number[]}    the item ids, in slot order
 */
export function inventorySlotsFor(items) {
    const slots = [];
    // `addItemsFromSave`'s three blocks, in its own order. Each fusion arm
    // is an ELSE of its base arm, which is why a ghostsword suppresses the
    // sword AND the spear rather than adding beside them.
    if (!items.hasGhostSword) {
        if (items.hasSword) slots.push(INVENTORY_ITEM_IDS.sword);
    } else {
        slots.splice(0, 0, INVENTORY_ITEM_IDS.ghostsword);
    }
    if (!items.hasFireWand) {
        if (items.hasFire) slots.push(INVENTORY_ITEM_IDS.fire);
        if (items.hasWand) slots.push(INVENTORY_ITEM_IDS.wand);
    } else {
        slots.splice(1, 0, INVENTORY_ITEM_IDS.firewand);
    }
    if (!items.hasGhostSword) {
        if (items.hasSpear) slots.push(INVENTORY_ITEM_IDS.spear);
    }
    return slots;
}

/**
 * The version-4 field: EQUIPS.
 *
 * `[{t, slot}]` — one write to `Main.primary` at observation tick `t`,
 * applied by `Bot.as` at the same site grants fire and immediately after
 * them, so a segment can inherit `spear` through a boot-level grant and
 * select it on the same tick.
 *
 * ⚠ The SLOT's upper bound is deliberately NOT checked here, and the game
 * does not check it eagerly either: `Inventory.items` is filled by
 * `addItemsFromSave` inside `inventory.update()`, which runs later in the
 * same frame than the equip site. The bound is checked against the MIRROR
 * by the engine (which knows what the run holds) and against the game's own
 * scanned `inventory_slots` readout by the differential — two sides, and
 * neither of them the tape repeating itself.
 */
function parseEquips(raw) {
    if (!Array.isArray(raw.equips)) {
        fail('equips must be an array of {t, slot} on a tape_version 4 tape '
            + `([] when nothing is selected), got ${JSON.stringify(raw.equips)}`);
    }
    const seen = new Set();
    const equips = raw.equips.map((e, i) => {
        const where = `equips[${i}]`;
        if (e === null || typeof e !== 'object' || Array.isArray(e)) {
            fail(`${where} must be an object { t, slot }`);
        }
        requireInt(e.t, `${where}.t`);
        requireInt(e.slot, `${where}.slot`);
        if (e.t < 0) fail(`${where}.t must be >= 0, got ${e.t}`);
        if (e.slot < 0) {
            fail(`${where}.slot must be >= 0, got ${e.slot}. A negative slot is not `
                + '"no selection": `Inventory.getItem(-1)` is `undefined` coerced to '
                + '0, so the press would silently become a sword slash.');
        }
        if (seen.has(e.t)) {
            fail(`${where} duplicates tick ${e.t}. Two writes to Main.primary on one `
                + 'observation would leave the winner up to array order.');
        }
        seen.add(e.t);
        return { t: e.t, slot: e.slot };
    });
    equips.sort((a, b) => a.t - b.t);
    return equips;
}

/**
 * The version-5 `pins` list — see `PIN_NAMES`.
 *
 * Sorted into `PIN_NAMES` order and de-duplicated by name, so two tapes that
 * pin the same things serialize identically and a diff of two recordings is
 * about the walk rather than about authoring order. A repeat is a named
 * error rather than a silent set-union: a tape that says `["sound",
 * "sound"]` was probably edited by two hands and one of them meant something
 * else.
 */
/**
 * ── Version 6: the SAVE-ARRAY BOOT BLOCK (R5 slice 23) ────────────────
 *
 * `Bot`'s boot block honoured exactly two kinds of state — `grants`
 * (Inventory item booleans) and `persistence` (levelPersistence tags) — and
 * `Main.SAVE_FILE.data` holds three ARRAYS besides that gameplay reads.
 * Slice 22 hit the wall as an INSTANCE (`hasTotemPart[]`, the wand gate);
 * the audit found it is a FAMILY, and this closes all three:
 *
 *   `totem_parts`  indices 0..4. `Wand.update`'s whole body is gated on
 *                  `Player.hasAllTotemParts()`, so a window that BOOTS into
 *                  level 43 finds an inert pickup.
 *   `keys`         indices 0..4. `BossLock.update` opens on
 *                  `Player.hasKey(keyType)`.
 *   `seal_parts`   seal IDENTITIES, **in collection order**, 0..15.
 *                  `FinalDoor.update` opens on
 *                  `SealController.hasAllSealParts()` — the ending's gate,
 *                  which R6 owns.
 *
 * ⛔⛔ `seal_parts` IS AN ORDERED LOG, NOT A SET OF FLAGS, and that is the
 * one way to get this field wrong while it reads correctly.
 * `SealController.getSealPart(index)` writes `index` into the FIRST slot
 * still holding **-1**, and `hasAllSealParts()` is
 * `Main.hasSealPart(SEALS - 1) != -1` — the LAST SLOT being filled. So the
 * array is a collection LOG whose slot is the ordinal and whose value is
 * the identity. A `hasSealPartSet(i, true)` reading would satisfy
 * `hasAllSealParts` with sixteen writes of any value at all, and the empty
 * value being -1 rather than 0 is what makes that silent.
 *
 * ⚠ THE INDICES ARE A SET WITH NO REPEATS in all three arrays. Chest.as:85
 * rejection-samples `Math.floor(Math.random() * SEALS)` until `getSealPart`
 * accepts it, i.e. until it draws an identity not already held — so a
 * repeated seal identity is a state the game cannot reach, and a repeated
 * totem/key index is a second write of `true`, i.e. a derivation error.
 *
 * ⚠ AND IT IS A BOOT PRESENTATION, NOT A GRANT. `Bot.botStart` applies it
 * BEFORE the first world is built, because `BossTotemPart.check()` and
 * `BossKey.check()` REMOVE THEMSELVES when the player already holds their
 * index and `check()` runs on a new world's first frame — the same
 * "already too late to despawn" fact the R0 grants ruling turned on. There
 * is no per-level firing rule and no `save` entry can fire twice.
 */
export const SAVE_SLOTS = Object.freeze({
    /** `Player.totemParts` — Player.as:276 */
    totem_parts: 5,
    /** `Player.totalKeys` — Player.as:258 */
    keys: 5,
    /** `SealController.SEALS` — SealController.as:24 */
    seal_parts: 16,
});

export const SAVE_KEYS = Object.freeze(Object.keys(SAVE_SLOTS));

/** The empty `save` block a v1..v5 tape normalises to. */
export function emptySaveBlock() {
    return { totem_parts: [], keys: [], seal_parts: [] };
}

/** Does a `save` block declare anything at all? (the v<6 rejection's test) */
export function saveBlockDeclaresAnything(save) {
    if (save === null || typeof save !== 'object' || Array.isArray(save)) return false;
    return SAVE_KEYS.some((k) => Array.isArray(save[k]) && save[k].length > 0);
}

/** The v7 block a v1..v6 tape normalises to: inherit the stream, no split. */
export function emptyRngBlock() {
    return { seed: 0, split: false, cosmetic: 0, fp: 0 };
}

/** The v8 block a v1..v7 tape normalises to: declare no seam state. */
export function emptySeamBlock() {
    return null;
}

/**
 * Does an `rng` block declare anything? (the v<7 rejection's test)
 *
 * ⚠ VALUE-SCOPED like every rejection above it, and for the sixth time the
 * same reason: `parseTape` normalises, so a parsed v1..v6 tape carries
 * `rng: {seed: 0, split: false}` and a presence check would reject all 108
 * committed fixtures.
 */
export function rngBlockDeclaresAnything(rng) {
    if (rng === null || typeof rng !== 'object' || Array.isArray(rng)) return false;
    // ⚠ WRITTEN AS A TERNARY, AND KEPT THAT WAY ON PURPOSE. The `||` form
    // is equivalent and tidier, and simplifying it mid-slice would have
    // invalidated a running two-and-a-half-hour roster sweep that had
    // already imported this module — a gate whose result predates the
    // change is not a gate. Tidy it in a change that re-runs the sweep.
    return rng.seed !== undefined && rng.seed !== 0 ? true : rng.split === true;
}

/**
 * Does an `rng` block declare either of the VERSION 8 streams?
 *
 * ⚠ SEPARATE FROM `rngBlockDeclaresAnything`, deliberately. That one is the
 * v<7 rejection's test and a v7 tape legitimately declares `{seed, split}`;
 * this one is the v<8 rejection's, and a v7 tape must NOT declare the other
 * two streams. Folding them into one predicate would make a v7 tape with a
 * seed fail the v8 gate.
 *
 * Value-scoped, for the seventh time and the unchanged reason: `parseTape`
 * normalises, so every parsed tape carries `cosmetic: 0, fp: 0` and a
 * presence check would reject all 118 committed fixtures.
 */
export function rngBlockDeclaresV8Streams(rng) {
    if (rng === null || typeof rng !== 'object' || Array.isArray(rng)) return false;
    return (rng.cosmetic !== undefined && rng.cosmetic !== 0)
        || (rng.fp !== undefined && rng.fp !== 0);
}

/**
 * Does a `seam` block declare anything?
 *
 * ⚠ PRESENCE-SCOPED, AND IT IS THE ONE BLOCK THAT MAY BE. Every earlier
 * block normalises to a non-null empty value (`grants: []`, `save:
 * {totem_parts: [], …}`, `rng: {seed: 0, …}`), so a presence check on any
 * of them would reject every committed fixture — which is the lesson six
 * comments in this file are about. The seam block normalises to **null**,
 * because there is no "empty seam": a tape either declares boot state or it
 * inherits whatever the page had, and those are different runs. So `!= null`
 * IS the value test here, not a presence test dressed as one.
 */
export function seamBlockDeclaresAnything(seam) {
    return seam !== null && seam !== undefined;
}

/** The version-7 `rng` block. */
function parseRng(raw) {
    const rng = raw.rng;
    if (rng === null || typeof rng !== 'object' || Array.isArray(rng)) {
        fail('rng must be an object { seed, split } on a tape_version 7 tape, '
            + `got ${JSON.stringify(rng)}`);
    }
    for (const k of Object.keys(rng)) {
        if (!RNG_KEYS.includes(k)) {
            fail(`rng.${k} is not an rng field; legal keys are ${RNG_KEYS.join(', ')}`);
        }
    }
    const seed = rng.seed ?? 0;
    requireInt(seed, 'rng.seed');
    if (seed < 0 || seed > RNG_SEED_MAX) {
        fail(`rng.seed is ${seed}, out of range 0..${RNG_SEED_MAX}. The orbit of `
            + 'the n=31 tap lives entirely in [1, 2^31), and the recompiled '
            + 'runtime\'s JSON.parse coerces a larger integer to int32 anyway (a '
            + 'declared 2147483648 arrives in Bot.as as -2147483648). 0 means '
            + '"inherit the page\'s stream" and is not a state the LFSR can reach.');
    }
    const split = rng.split ?? false;
    if (typeof split !== 'boolean') {
        fail(`rng.split must be a boolean, got ${JSON.stringify(split)}`);
    }
    // ── the v8 streams ────────────────────────────────────────────────
    // Parsed unconditionally so a v7 tape's normalised zeros round-trip;
    // DECLARING them on a v7 tape is refused by `parseTape`'s version gate,
    // which is the only place that knows the version.
    const cosmetic = rng.cosmetic ?? 0;
    requireInt(cosmetic, 'rng.cosmetic');
    if (cosmetic < 0 || cosmetic > RNG_COSMETIC_MAX) {
        fail(`rng.cosmetic is ${cosmetic}, out of range 0..${RNG_COSMETIC_MAX} — the `
            + 'cosmetic generator is the same n=31 orbit as the gameplay one, and 0 '
            + 'means "keep the build\'s own boot state".');
    }
    const fp = rng.fp ?? 0;
    requireInt(fp, 'rng.fp');
    if (fp < 0 || fp > RNG_FP_SEED_MAX) {
        fail(`rng.fp is ${fp}, out of range 0..${RNG_FP_SEED_MAX}. `
            + '`FP.randomSeed`\'s setter is `_seed = clamp(value, 1, 2147483646)` '
            + '(FP.as:392), so anything outside that would be APPLIED AS A DIFFERENT '
            + 'STATE than declared — the one failure a seam field must not have. '
            + '0 means "inherit the page\'s".');
    }
    return { seed, split, cosmetic, fp };
}

/**
 * ── The version-8 `seam` block ────────────────────────────────────────
 *
 * ⛔ THE SCHEMA IS `r7Acceptance.SEAM_BOOT_SPEC`, WALKED — not retyped
 * here. The v8 block exists to carry the SEAM SIGNATURE's rows that no
 * earlier block could express, so its key list has to BE a function of that
 * signature: a signature row routed to the seam channel with no spec entry
 * throws in `assertSeamChannelsTotal`, and a spec entry with no parser arm
 * is impossible because this loop is the parser (trap 86).
 *
 * ⚠ THE IMPORT IS READ AT CALL TIME, NOT AT MODULE SCOPE, and that is
 * load-bearing: `r7Acceptance` imports `fixtures/index.js`, which imports
 * this module, so the three form a cycle. Function bindings survive one
 * (they hoist); a module-scope `const` derived from `SEAM_BOOT_SPEC` would
 * hit the temporal dead zone whenever `r7Acceptance` is the entry point.
 *
 * ⚠ AND EVERY BOUND HERE IS TWINNED IN `Bot.botLoadTape`. Both validators
 * state them, both cite the game line that makes each one a bound rather
 * than a taste (trap 98) — a transport whose two ends disagree about the
 * legal range is the divergence this format exists to prevent.
 */
function parseSeam(raw) {
    const seam = raw.seam;
    if (seam === null || typeof seam !== 'object' || Array.isArray(seam)) {
        fail('seam must be an object on a tape_version 8 tape (or null/absent to '
            + `declare no boot state), got ${JSON.stringify(seam)}`);
    }
    const spec = SEAM_BOOT_SPEC;
    const groups = new Set(spec.map((s) => s.key.split('.')[0]));
    for (const k of Object.keys(seam)) {
        if (!groups.has(k)) {
            fail(`seam.${k} is not a seam field; legal keys are `
                + `${[...groups].join(', ')}`);
        }
    }
    const at = (key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), seam);
    // Every nested group is itself checked for stray keys, so a typo inside
    // `items` or `music` is a named error and not a silently ignored field.
    for (const g of groups) {
        const nested = spec.filter((s) => s.key.startsWith(`${g}.`));
        if (nested.length === 0 || seam[g] === undefined || seam[g] === null) continue;
        if (typeof seam[g] !== 'object' || Array.isArray(seam[g])) {
            fail(`seam.${g} must be an object`);
        }
        const legal = new Set(nested.map((s) => s.key.slice(g.length + 1)));
        for (const k of Object.keys(seam[g])) {
            if (!legal.has(k)) {
                fail(`seam.${g}.${k} is not a seam field; legal keys are `
                    + `${[...legal].join(', ')}`);
            }
        }
    }
    const out = {};
    for (const s of spec) {
        const v = at(s.key);
        if (v === undefined || v === null) continue;
        if (s.type === 'boolean') {
            if (typeof v !== 'boolean') {
                fail(`seam.${s.key} must be a boolean, got ${JSON.stringify(v)}`);
            }
        } else if (s.type === 'boolean[]') {
            if (!Array.isArray(v) || v.length !== s.arity
                || v.some((b) => typeof b !== 'boolean')) {
                fail(`seam.${s.key} must be an array of ${s.arity} booleans, got `
                    + `${JSON.stringify(v)}`);
            }
        } else if (s.type === 'string') {
            if (typeof v !== 'string') {
                fail(`seam.${s.key} must be a string, got ${JSON.stringify(v)}`);
            }
        } else if (s.type === 'int') {
            requireInt(v, `seam.${s.key}`);
            if (v < s.min || (s.max !== undefined && v > s.max)) {
                fail(`seam.${s.key} is ${v}, out of range ${s.min}..${s.max}`
                    + ` — ${s.why}`);
            }
        } else if (s.type === 'number') {
            requireFiniteNumber(v, `seam.${s.key}`);
            if (s.exclusiveMin ? v <= s.min : v < s.min) {
                fail(`seam.${s.key} is ${v}, which must be `
                    + `${s.exclusiveMin ? '>' : '>='} ${s.min} — ${s.why}`);
            }
            if (s.max !== undefined && v > s.max) {
                fail(`seam.${s.key} is ${v}, above ${s.max} — ${s.why}`);
            }
        }
        out[s.key] = Array.isArray(v) ? Object.freeze([...v]) : v;
    }
    // ⛔ AN INDEX WITHOUT ITS SET IS HALF A STATE. `Music.playSound`'s
    // do-while reads BOTH (`cplayIndex == currentIndex && currentSet ==
    // strInd`), so a declared index with no set names a rejection loop that
    // cannot be reproduced. Checked here rather than per-field because it is
    // a relation between two, which no single spec row can hold.
    if (out['music.index'] !== undefined && out['music.index'] !== -1
        && (out['music.set'] === undefined || out['music.set'] === '')) {
        fail(`seam.music.index is ${out['music.index']} with no seam.music.set — `
            + '`Music.playSound`\'s rejection loop reads both, so an index without '
            + 'its set is half a state.');
    }
    // ⛔ THE PARSED FORM IS THE WIRE FORM, NESTED — like `save` and `rng`
    // above it, and for a reason this file has paid for before: `parseTape`
    // is IDEMPOTENT BY DESIGN. Every consumer re-validates, the harness
    // sends the parsed object over the wire, and `serializeTape` re-parses
    // its input. Returning the flat validation map would make a parsed tape
    // unparseable — measured, the first time this function returned one.
    return deepFreeze(seamToBlock(out));
}

/** Freeze a seam block and the arrays inside it. */
function deepFreeze(block) {
    for (const k of Object.keys(block)) {
        if (block[k] && typeof block[k] === 'object') deepFreeze(block[k]);
    }
    return Object.freeze(block);
}

/**
 * A seam BLOCK (`{items: {hasSword: true}, hits_max: 4}`) as a map keyed by
 * **`SEAM_SIGNATURE[].field`** (`{'save.hasSword': true, 'save.hitsMax': 4}`).
 *
 * ⛔ THE TWO KEY SPACES ARE DIFFERENT AND BOTH ARE LOAD-BEARING. The wire
 * keys are snake_case and grouped for a human authoring a tape; the
 * signature fields are the game's own names, and they are what
 * `Bot.latchSeam` emits and what `seamFindings` maps over. This function is
 * the ONE translation between them, and its table is `SEAM_BOOT_SPEC`, so
 * neither side is retyped.
 */
export function seamFieldsFromBlock(block) {
    if (block === null || block === undefined) return {};
    const out = {};
    for (const s of SEAM_BOOT_SPEC) {
        const v = s.key.split('.')
            .reduce((o, k) => (o == null ? undefined : o[k]), block);
        if (v !== undefined && v !== null) out[s.field] = v;
    }
    return out;
}

/**
 * The parsed seam's FLAT map (`'items.hasSword' -> true`) back to the
 * nested wire block. `serializeTape`'s half of the round trip.
 *
 * ⚠ Emits only what the tape declared. A seam block that filled in every
 * key with a default would be a tape claiming state it never measured —
 * "not declared" and "declared at the fresh-page value" are different
 * segments, and only one of them can be checked against a predecessor.
 */
export function seamToBlock(flat) {
    const out = {};
    for (const key of Object.keys(flat)) {
        const [head, tail] = key.split('.');
        if (tail === undefined) {
            out[head] = Array.isArray(flat[key]) ? [...flat[key]] : flat[key];
        } else {
            out[head] = out[head] ?? {};
            out[head][tail] = flat[key];
        }
    }
    return out;
}

function parseSaveIndices(list, what, limit) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) {
        fail(`${what} must be an array of indices ([] when nothing is presented), `
            + `got ${JSON.stringify(list)}`);
    }
    if (list.length > limit) {
        fail(`${what} has ${list.length} entries but only ${limit} slots exist`);
    }
    const out = [];
    list.forEach((v, i) => {
        requireInt(v, `${what}[${i}]`);
        if (v < 0 || v >= limit) {
            fail(`${what}[${i}] is ${v}, out of range 0..${limit - 1}. A negative `
                + 'index is not "none" here — hasSealPart\'s own EMPTY value is -1, '
                + 'so a -1 entry would write "this slot is empty" into a filled slot.');
        }
        if (out.includes(v)) {
            fail(`${what}[${i}] duplicates index ${v}. All three arrays are index `
                + 'SETS: a repeated totem/key index is a second write of true, and a '
                + 'repeated seal identity is a state the game cannot reach '
                + '(Chest.as:85 rejection-samples until getSealPart accepts).');
        }
        out.push(v);
    });
    return out;
}

/**
 * The version-6 `save` block.
 *
 * ⚠ `totem_parts` and `keys` are SORTED (they are sets over a boolean
 * array, so order carries nothing and a re-derived list that changed order
 * must not read as a diff). `seal_parts` is **NOT** sorted: its order IS
 * the collection order, which is the slot each identity lands in.
 */
function parseSave(raw) {
    const save = raw.save;
    if (save === null || typeof save !== 'object' || Array.isArray(save)) {
        fail('save must be an object { totem_parts, keys, seal_parts } on a '
            + `tape_version 6 tape, got ${JSON.stringify(save)}`);
    }
    for (const k of Object.keys(save)) {
        if (!SAVE_KEYS.includes(k)) {
            fail(`save.${k} is not a save array; legal keys are ${SAVE_KEYS.join(', ')}`);
        }
    }
    const totemParts = parseSaveIndices(save.totem_parts, 'save.totem_parts',
        SAVE_SLOTS.totem_parts);
    const keys = parseSaveIndices(save.keys, 'save.keys', SAVE_SLOTS.keys);
    const sealParts = parseSaveIndices(save.seal_parts, 'save.seal_parts',
        SAVE_SLOTS.seal_parts);
    totemParts.sort((a, b) => a - b);
    keys.sort((a, b) => a - b);
    return { totem_parts: totemParts, keys, seal_parts: sealParts };
}

function parsePins(raw) {
    if (!Array.isArray(raw.pins)) {
        fail('pins must be an array of pin names on a tape_version 5 tape '
            + `([] when nothing is pinned), got ${JSON.stringify(raw.pins)}`);
    }
    const pins = raw.pins.map((name, i) => {
        if (typeof name !== 'string' || !PIN_NAMES.includes(name)) {
            fail(`pins[${i}] is ${JSON.stringify(name)}, which is not a pin name; `
                + `legal names are ${PIN_NAMES.join(', ')}`);
        }
        return name;
    });
    for (let i = 1; i < pins.length; i++) {
        if (pins.indexOf(pins[i]) !== i) {
            fail(`pins names "${pins[i]}" more than once`);
        }
    }
    pins.sort((a, b) => PIN_NAMES.indexOf(a) - PIN_NAMES.indexOf(b));
    return pins;
}

/**
 * The three version-2 relaxation fields. Every one is REQUIRED — a tape
 * that omitted `noHazards` and a game that defaulted it to "none" would be
 * running a different experiment from a JS engine that defaulted it to
 * "all", and the differential would report it as a physics divergence.
 */
function parseRelaxations(raw) {
    if (typeof raw.noDamage !== 'boolean') {
        fail('noDamage must be a boolean on a tape_version 2 tape (no default — it '
            + `selects whether Player.hit() runs), got ${JSON.stringify(raw.noDamage)}`);
    }

    if (!Array.isArray(raw.noHazards)) {
        fail('noHazards must be an ARRAY of hazard names on a tape_version 2 tape, not '
            + `a boolean — R4 re-arms hazards one at a time, so "all or nothing" cannot `
            + `express a rung. Legal names: ${HAZARD_NAMES.join(', ')}; [] means none `
            + `are disabled. Got ${JSON.stringify(raw.noHazards)}`);
    }
    const noHazards = raw.noHazards.map((name, i) => {
        if (typeof name !== 'string'
            || !Object.prototype.hasOwnProperty.call(HAZARD_STATES, name)) {
            fail(`noHazards[${i}] is ${JSON.stringify(name)}, which is not a hazard `
                + `name; legal names are ${HAZARD_NAMES.join(', ')}`);
        }
        return name;
    });
    for (let i = 1; i < noHazards.length; i++) {
        if (noHazards.indexOf(noHazards[i]) !== i) {
            fail(`noHazards names "${noHazards[i]}" more than once`);
        }
    }
    // Sorted by STATE so two tapes disabling the same hazards serialize
    // identically regardless of authoring order, exactly as spans are.
    noHazards.sort((a, b) => HAZARD_STATES[a] - HAZARD_STATES[b]);

    if (!Array.isArray(raw.grants)) {
        fail('grants must be an array of {level, items} on a tape_version 2 tape '
            + `([] when nothing is granted), got ${JSON.stringify(raw.grants)}`);
    }
    const grants = raw.grants.map((g, i) => {
        const where = `grants[${i}]`;
        if (g === null || typeof g !== 'object' || Array.isArray(g)) {
            fail(`${where} must be an object { level, items }`);
        }
        requireInt(g.level, `${where}.level`);
        if (g.level < 0) fail(`${where}.level must be >= 0, got ${g.level}`);
        if (!Array.isArray(g.items) || g.items.length === 0) {
            fail(`${where}.items must be a non-empty array of item names; an empty grant `
                + 'is a route claim nobody checks');
        }
        const items = g.items.map((name, j) => {
            if (typeof name !== 'string'
                || !Object.prototype.hasOwnProperty.call(ITEM_PROPERTIES, name)) {
                fail(`${where}.items[${j}] is ${JSON.stringify(name)}, which is not an `
                    + `item name; legal names are ${ITEM_NAMES.join(', ')} (the `
                    + 'flash_name vocabulary of games/seedling.json)');
            }
            return name;
        });
        for (let j = 1; j < items.length; j++) {
            if (items.indexOf(items[j]) !== j) {
                fail(`${where}.items names "${items[j]}" more than once`);
            }
        }
        items.sort();
        return { level: g.level, items };
    });
    grants.sort((a, b) => a.level - b.level);
    for (let i = 1; i < grants.length; i++) {
        if (grants[i].level === grants[i - 1].level) {
            fail(`grants declares level ${grants[i].level} twice. One entry per level: `
                + 'the grant fires on FIRST entry, so a second entry for the same level '
                + 'would either never fire or fire at a tick neither side agrees on.');
        }
    }

    return { noDamage: raw.noDamage, noHazards, grants };
}

/**
 * The terrain state the PHYSICS consumes, given the state the resolver
 * actually resolved.
 *
 * ⚠ The resolver's STORED state stays RAW on both sides. In `Player.as` the
 * `_state` member keeps the real tile type, the `_s != _state` change gate
 * and `lastState` are untouched, and only the effect sites read through the
 * coerced value; this function is that rule, and `playerPhysicsV2` applies
 * it at the same four places. Keeping storage raw is what lets the JS tests
 * keep asserting the RESOLVER's own answer — the brick-not-ground lesson —
 * instead of asserting a value the relaxation already flattened.
 *
 * `states` is the tape's `noHazards` names, not tile types, because that is
 * what the tape carries and one translation point is enough.
 */
export function coerceTerrainState(state, noHazardNames) {
    for (const name of noHazardNames) {
        if (HAZARD_STATES[name] === state) return COERCED_TERRAIN_STATE;
    }
    return state;
}

/**
 * Parse + validate + normalize a tape. Accepts a JSON string or a plain
 * object; returns a NEW frozen tape with spans sorted (by `from`, then
 * `key`) so two tapes that mean the same thing serialize the same way.
 *
 * Throws TapeFormatError on anything ambiguous. There are no defaults for
 * required fields on purpose: a tape missing `noclip` must not silently
 * become a collision run, because the JS side and the game would then be
 * running different experiments and the differential would blame physics.
 */
export function parseTape(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`tape is not valid JSON: ${e.message}`);
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        fail(`tape must be an object, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
    }

    const version = raw.tape_version;
    if (!SUPPORTED_TAPE_VERSIONS.includes(version)) {
        fail(`tape_version must be one of ${SUPPORTED_TAPE_VERSIONS.join(', ')}, `
            + `got ${JSON.stringify(version)}`);
    }
    if (raw.game !== 'seedling') {
        fail(`game must be "seedling", got ${JSON.stringify(raw.game)}`);
    }
    if (typeof raw.noclip !== 'boolean') {
        fail('noclip must be a boolean (no default — it selects which physics '
            + `both consumers run), got ${JSON.stringify(raw.noclip)}`);
    }

    // A v1 tape that RELAXES anything is the exact failure this format
    // exists to prevent, one version up: the field would be honoured by
    // whichever consumer happened to look at it and ignored by the other.
    //
    // It may still CARRY the fields at version 1's own values, because
    // `parseTape` is idempotent by design — every consumer re-validates,
    // and a parsed tape (which is normalised, below) has to survive being
    // parsed again. So the test is on the VALUE, not on presence.
    if (version === 1) {
        const v1Semantics = {
            noDamage: false, noHazards: [], grants: [], persistence: [], equips: [],
            pins: [],
        };
        // `save` is checked separately below rather than folded in here: it is
        // the one normalised field that is an OBJECT, so the array/scalar
        // comparison this loop makes cannot express "empty" for it.
        if (saveBlockDeclaresAnything(raw.save)) {
            fail(`tape_version 1 declares save: ${JSON.stringify(raw.save)}, but `
                + 'version 1 means an EMPTY save block BY DEFINITION.');
        }
        // `rng` is the second normalised OBJECT field and gets the same
        // separate treatment as `save`, for the same reason: the loop below
        // compares arrays and scalars and cannot express "empty" for it.
        if (rngBlockDeclaresAnything(raw.rng)) {
            fail(`tape_version 1 declares rng: ${JSON.stringify(raw.rng)}, but `
                + 'version 1 means an EMPTY rng block BY DEFINITION.');
        }
        for (const [field, expected] of Object.entries(v1Semantics)) {
            const got = raw[field];
            if (got === undefined) continue;
            const same = Array.isArray(expected)
                ? Array.isArray(got) && got.length === 0
                : got === expected;
            if (!same) {
                fail(`tape_version 1 declares ${field}: ${JSON.stringify(got)}, but `
                    + `version 1 means ${field}: ${JSON.stringify(expected)} BY `
                    + 'DEFINITION — the v1-era build had no such flag to read. Bump '
                    + 'tape_version to 2 to relax anything.');
            }
        }
    }
    const relax = version === 1
        ? { noDamage: false, noHazards: [], grants: [] }
        : parseRelaxations(raw);
    // The same VALUE-not-presence rule one version further on: a parsed v2
    // tape carries `persistence: []` because `parseTape` normalises, and a
    // presence check here would reject every committed fixture. That is not
    // hypothetical — it is what the first build of the R0 batch did with
    // `noDamage`, and it cost a whole pipeline run.
    if (version < 3 && raw.persistence !== undefined
        && !(Array.isArray(raw.persistence) && raw.persistence.length === 0)) {
        fail(`tape_version ${version} declares persistence: `
            + `${JSON.stringify(raw.persistence)}, but versions below 3 mean `
            + 'persistence: [] BY DEFINITION — the build had no such field to read. '
            + 'Bump tape_version to 3 to clear anything.');
    }
    /**
     * ⚠ The tick bound a v9 `at` is checked against is READ HERE and
     * validated below. `raw.tick_count` is the declaration; the fallback is
     * the same "longest span wins" the real parse uses, so an `at` past the
     * end is refused whether or not the tape spells its length out.
     */
    const declaredTicks = Number(raw.tick_count ?? Math.max(0,
        ...(Array.isArray(raw.inputs) ? raw.inputs.map((s) => Number(s?.to) || 0) : [0])));
    const persistence = version >= 3
        ? parsePersistence(raw, version, Number.isFinite(declaredTicks) ? declaredTicks : 0)
        : [];
    // The VALUE-not-presence rule again, one version on. Written out rather
    // than folded into a loop because each field's message names the build
    // that could not read it, and that sentence is what a reader hitting the
    // error actually needs.
    if (version < 4 && raw.equips !== undefined
        && !(Array.isArray(raw.equips) && raw.equips.length === 0)) {
        fail(`tape_version ${version} declares equips: ${JSON.stringify(raw.equips)}, `
            + 'but versions below 4 mean equips: [] BY DEFINITION — the build had no '
            + 'such field to read, so every press would be whatever Main.primary '
            + 'already was (0, the sword). Bump tape_version to 4 to select a slot.');
    }
    const equips = version >= 4 ? parseEquips(raw) : [];
    // The VALUE-not-presence rule, one version on again. Spelled out rather
    // than looped for the reason above: the message has to name the build
    // that could not read the field.
    if (version < 5 && raw.pins !== undefined
        && !(Array.isArray(raw.pins) && raw.pins.length === 0)) {
        fail(`tape_version ${version} declares pins: ${JSON.stringify(raw.pins)}, `
            + 'but versions below 5 mean pins: [] BY DEFINITION — the build had no '
            + 'such field to read, so the run would use the live mixer clock and the '
            + 'per-render fade while the JS engine modelled a pinned one. Bump '
            + 'tape_version to 5 to pin anything.');
    }
    const pins = version >= 5 ? parsePins(raw) : [];
    // The VALUE-not-presence rule, one version on again — and the emptiness
    // test is over the three ARRAYS rather than over the block, because
    // `parseTape` normalises a v1..v5 tape into carrying a non-null empty
    // block and a `!== undefined` check would reject all 98 committed
    // fixtures. That is not hypothetical: it is what the first build of the
    // R0 batch did with `noDamage`, and it cost a whole pipeline run.
    if (version < 6 && saveBlockDeclaresAnything(raw.save)) {
        fail(`tape_version ${version} declares save: ${JSON.stringify(raw.save)}, `
            + 'but versions below 6 mean an EMPTY save block BY DEFINITION — the '
            + 'build had no such field to read, so the game would boot with an empty '
            + 'save (an inert Wand, a shut BossLock, a shut FinalDoor) while the JS '
            + 'engine honoured the block. Bump tape_version to 6 to present any.');
    }
    const save = version >= 6 ? parseSave(raw) : emptySaveBlock();
    // The VALUE-not-presence rule, one version on again, and the emptiness
    // test is over the block's two FIELDS for the reason `save`'s is over its
    // three arrays: a parsed v1..v6 tape carries a non-null `{seed: 0, split:
    // false}` and a `!== undefined` check would reject all 108 committed
    // fixtures.
    if (version < 7 && rngBlockDeclaresAnything(raw.rng)) {
        fail(`tape_version ${version} declares rng: ${JSON.stringify(raw.rng)}, `
            + 'but versions below 7 mean rng: {seed: 0, split: false} BY DEFINITION '
            + '— the build had no such field to read, so the game would run on '
            + 'whatever stream position the page had reached while the JS engine '
            + 'modelled one that started at the declared seed. Bump tape_version to '
            + '7 to declare a stream.');
    }
    // The VALUE-not-presence rule, one version on again, and it needs its
    // OWN predicate: a v7 tape may legitimately declare `{seed, split}` and
    // must not declare the other two streams, so folding the two tests
    // together would fail every v7 tape that names a seed.
    if (version < 8 && rngBlockDeclaresV8Streams(raw.rng)) {
        fail(`tape_version ${version} declares rng: ${JSON.stringify(raw.rng)}, `
            + 'but versions below 8 mean rng: {cosmetic: 0, fp: 0} BY DEFINITION — '
            + 'the build had no such field to read, so the game would run the '
            + 'cosmetic generator and FlashPunk\'s LCG from wherever the page left '
            + 'them while the JS engine modelled declared states. Bump tape_version '
            + 'to 8 to declare them.');
    }
    const rng = version >= 7 ? parseRng(raw) : emptyRngBlock();
    // ⚠ The seam block's empty value is NULL, not an empty object — see
    // `seamBlockDeclaresAnything`. There is no "empty seam": a tape either
    // declares boot state or inherits the page's, and those are different
    // runs.
    if (version < 8 && seamBlockDeclaresAnything(raw.seam)) {
        fail(`tape_version ${version} declares seam: ${JSON.stringify(raw.seam)}, `
            + 'but versions below 8 mean seam: null BY DEFINITION — the build had no '
            + 'such block to read, so the game would boot whatever save state the '
            + 'page had while the JS engine honoured the declaration. Bump '
            + 'tape_version to 8 to declare boot state.');
    }
    const seam = version >= 8 && seamBlockDeclaresAnything(raw.seam)
        ? parseSeam(raw) : emptySeamBlock();

    const boot = raw.boot;
    if (boot === null || typeof boot !== 'object' || Array.isArray(boot)) {
        fail('boot must be an object { level, x, y }');
    }
    requireInt(boot.level, 'boot.level');
    requireFiniteNumber(boot.x, 'boot.x');
    requireFiniteNumber(boot.y, 'boot.y');
    // ⚠ VERSION-SCOPED. A v1 tape was authored against a build that could not
    // be told where to start, so declaring anything but the baked-in spawn
    // means the JS engine honours a boot the game ignores and the
    // differential blames physics for bookkeeping. R0's AS3 batch gives the
    // build a parameterised boot, so a v2 tape may name any level — and
    // BUILD_SPAWN stays exported as the DEFAULT a tape gets when it does not
    // care, which is still every full-run tape.
    if (version === 1 && (boot.level !== BUILD_SPAWN.level || boot.x !== BUILD_SPAWN.x
        || boot.y !== BUILD_SPAWN.y)) {
        fail(`boot is {level: ${boot.level}, x: ${boot.x}, y: ${boot.y}}, but a `
            + `tape_version 1 tape must declare the build's baked-in spawn `
            + `{level: ${BUILD_SPAWN.level}, x: ${BUILD_SPAWN.x}, y: ${BUILD_SPAWN.y}} `
            + '(Main.as:51; the v1-era Bot.as read neither boot.x nor boot.y). The JS '
            + 'engine would honour this block and that build would ignore it. Bump to '
            + 'tape_version 2, which the R0 build honours.');
    }

    if (!Array.isArray(raw.inputs)) {
        fail(`inputs must be an array, got ${typeof raw.inputs}`);
    }

    const inputs = raw.inputs.map((span, i) => {
        const where = `inputs[${i}]`;
        if (span === null || typeof span !== 'object' || Array.isArray(span)) {
            fail(`${where} must be an object { key, from, to }`);
        }
        const { key } = span;
        if (typeof key !== 'string') {
            fail(`${where}.key must be a string, got ${JSON.stringify(key)}`);
        }
        if (!Object.prototype.hasOwnProperty.call(KEY_CODES, key)) {
            const forbidden = FORBIDDEN_KEYS[key.toLowerCase()];
            if (forbidden) {
                fail(`${where}.key "${key}" (keycode ${forbidden.code}) is FORBIDDEN and `
                    + `must never be synthesized: ${forbidden.why}`);
            }
            fail(`${where}.key "${key}" is not a known key name; legal names are `
                + `${KEY_NAMES.join(', ')}`);
        }
        requireInt(span.from, `${where}.from`);
        requireInt(span.to, `${where}.to`);
        if (span.from < 0) fail(`${where}.from must be >= 0, got ${span.from}`);
        if (span.to <= span.from) {
            fail(`${where}.to (${span.to}) must be > from (${span.from}) — `
                + 'spans are [from, to) and a zero-length span would produce '
                + 'neither a press nor a release edge');
        }
        return { key, from: span.from, to: span.to };
    });

    inputs.sort((a, b) => (a.from - b.from) || (a.to - b.to) || a.key.localeCompare(b.key));

    // Overlapping spans for the SAME key are rejected: FlashPunk's
    // `_key[code]` guard makes a second KEY_DOWN a no-op and the first
    // KEY_UP clears the whole hold, so two overlapping spans on one key
    // do NOT mean what an author would assume. Make them say it once.
    for (let i = 1; i < inputs.length; i++) {
        for (let j = 0; j < i; j++) {
            if (inputs[i].key !== inputs[j].key) continue;
            if (inputs[i].from < inputs[j].to) {
                fail(`inputs contain overlapping spans for key "${inputs[i].key}": `
                    + `[${inputs[j].from},${inputs[j].to}) and `
                    + `[${inputs[i].from},${inputs[i].to}). Merge them — overlapping `
                    + 'holds do not compose (the first release clears the key).');
            }
        }
    }

    const tickCount = requireInt(
        raw.tick_count ?? inputs.reduce((max, s) => Math.max(max, s.to), 0),
        'tick_count',
    );
    if (tickCount < 0) fail(`tick_count must be >= 0, got ${tickCount}`);
    for (const span of inputs) {
        if (span.to > tickCount) {
            fail(`inputs span [${span.from},${span.to}) for "${span.key}" runs past `
                + `tick_count (${tickCount}) — the bot would disarm mid-hold`);
        }
    }

    return Object.freeze({
        tape_version: version,
        game: 'seedling',
        boot: Object.freeze({ level: boot.level, x: boot.x, y: boot.y }),
        noclip: raw.noclip,
        // Normalised, never defaulted: for a v1 tape these ARE version 1's
        // semantics, stated once here so no engine carries a version branch.
        noDamage: relax.noDamage,
        noHazards: Object.freeze(relax.noHazards),
        grants: Object.freeze(relax.grants.map((g) => Object.freeze({
            level: g.level, items: Object.freeze(g.items),
        }))),
        persistence: Object.freeze(persistence.map((c) => Object.freeze({
            level: c.level, tag: c.tag, note: c.note,
            ...(c.at === undefined ? {} : { at: c.at }),
        }))),
        equips: Object.freeze(equips.map((e) => Object.freeze({
            t: e.t, slot: e.slot,
        }))),
        pins: Object.freeze(pins),
        save: Object.freeze({
            totem_parts: Object.freeze(save.totem_parts),
            keys: Object.freeze(save.keys),
            seal_parts: Object.freeze(save.seal_parts),
        }),
        rng: Object.freeze({
            seed: rng.seed, split: rng.split, cosmetic: rng.cosmetic, fp: rng.fp,
        }),
        // ⚠ `null`, not `{}` — see `seamBlockDeclaresAnything`. Frozen when
        // present; `parseSeam` freezes the array values inside it.
        seam,
        tick_count: tickCount,
        inputs: Object.freeze(inputs.map((s) => Object.freeze(s))),
        ...(raw.name ? { name: String(raw.name) } : {}),
        ...(raw.description ? { description: String(raw.description) } : {}),
    });
}

/**
 * The set of key names held during tick `t`. Both consumers must agree
 * bit for bit; this is the single definition.
 */
export function heldKeysAt(tape, t) {
    const held = new Set();
    for (const span of tape.inputs) {
        if (t >= span.from && t < span.to) held.add(span.key);
    }
    return held;
}

/**
 * The keyboard EDGES the AS3 bot must dispatch at the top of tick `t`:
 * a DOWN for every span starting here, an UP for every span ending here.
 * Returned as keycodes because that is what `KeyboardEvent` carries.
 *
 * Kept here rather than in the AS3 so the two sides cannot drift: a JS
 * test can assert the exact edge schedule a tape implies, and `Bot.as`
 * is a transcription of this rule.
 */
export function keyEdgesAt(tape, t) {
    const down = [];
    const up = [];
    for (const span of tape.inputs) {
        if (span.from === t) down.push(KEY_CODES[span.key]);
        if (span.to === t) up.push(KEY_CODES[span.key]);
    }
    down.sort((a, b) => a - b);
    up.sort((a, b) => a - b);
    return { down, up };
}

/**
 * Serialize a tape to canonical JSON (stable key order, 2-space indent).
 *
 * ⚠ The v2 fields are written ONLY for a v2 tape. A v1 tape round-trips
 * byte-identically even though `parseTape` normalised the three fields onto
 * it, because writing version 1's own semantics back into a version 1 file
 * would rewrite all eleven committed fixtures for no change in meaning.
 */
/**
 * ── ⛓⛓⛓ THE GAME-VISIBLE PROJECTION (R7 slice 6d, ⚖ ruled) ───────────
 *
 * The tape a GAME-FACING channel hands to `botLoadTape`. Today it differs
 * from the parsed tape in exactly two places: the v9 `at` on a persistence
 * clear is dropped, and the version reported is the newest one whose
 * features survive that drop.
 *
 * ⛔⛔ AND THAT IS NOT A LIE ABOUT THE VERSION — it is a true statement
 * about the projection's CONTENTS. `at` is a statement about what the GAME
 * DOES ON ITS OWN (arrows the player never fired kill the last bob and the
 * kill-lock removes itself); it is emphatically NOT an instruction to the
 * game. If the game ever consumed it, the check would stop being two-sided:
 * the whole honesty argument for `at` is that the game clears the flag BY
 * PLAY and the differential compares that against what the model was told.
 * So the projection IS the exact tape the game is being asked to run.
 *
 * ⛓ THE GENERAL PRINCIPLE, recorded for the arc: **model-only tape features
 * never cross to the game.** `tapeFormat.test.js`'s pinning test is the
 * enforcement — it asserts the projection differs in EXACTLY these fields,
 * so any future v9+ field fails it until someone classifies it: game-visible
 * (which needs an AS3 change and the batch discipline) or model-only (which
 * rides this projection for free).
 *
 * ⚠ EPHEMERAL. Produced at send time and never written to disk: one artifact
 * per tape, or the committed projection becomes a second copy that drifts.
 */
export const GAME_VISIBLE_DROPS = Object.freeze(['persistence[].at']);

export function gameVisibleTape(tape) {
    const t = tape.tape_version === undefined ? parseTape(tape) : tape;
    // ⚠ EVERY v9 tape projects, not only the ones carrying `at`. The GAME's
    // loader gates on the VERSION LIST, so a v9 tape with no mid-run clear
    // is refused for a number rather than for a feature — and it is, in
    // content, exactly a v8 tape.
    if (t.tape_version < 9) return t;
    return {
        ...t,
        // ⚠ 8 and not `tape_version - 1`: 9's ONLY new feature is the
        // dropped field, so what is left is precisely a version 8 tape. A
        // decrement would be arithmetic pretending to be a claim.
        tape_version: 8,
        persistence: (t.persistence ?? []).map(({ at, ...rest }) => rest),
    };
}

/**
 * The LOWEST version that can express this tape — what an author should
 * stamp on it.
 *
 * ⛔ A tape carries ITS OWN version and not the newest one (`serializeTape`'s
 * rule, which is what keeps a bump from rewriting 121 fixtures). An author
 * that wrote `TAPE_VERSION` unconditionally would move every tape it touches
 * to the newest number for no change in meaning — and, since the game gates
 * on the version LIST, would make tapes the game refuses for a feature they
 * do not use.
 */
export function requiredTapeVersion(tape, floor = 8) {
    const usesAt = (tape.persistence ?? []).some((c) => c.at !== undefined);
    return usesAt ? 9 : floor;
}

export function serializeTape(tape) {
    const t = parseTape(tape);
    const ordered = {
        tape_version: t.tape_version,
        game: t.game,
        ...(t.name ? { name: t.name } : {}),
        ...(t.description ? { description: t.description } : {}),
        boot: { level: t.boot.level, x: t.boot.x, y: t.boot.y },
        noclip: t.noclip,
        ...(t.tape_version >= 2 ? {
            noDamage: t.noDamage,
            noHazards: [...t.noHazards],
            grants: t.grants.map((g) => ({ level: g.level, items: [...g.items] })),
        } : {}),
        // ⚠ Written ONLY for a v3 tape, so a v1 or v2 tape round-trips
        // byte-identically even though `parseTape` normalised the field in.
        // Getting this wrong would rewrite all 23 committed fixtures the
        // first time anything re-serialized them.
        ...(t.tape_version >= 3 ? {
            persistence: t.persistence.map((c) => ({
                level: c.level, tag: c.tag, ...(c.note ? { note: c.note } : {}),
                // ⚠ Written only when present, so every v3..v8 fixture
                // round-trips byte-identically past the v9 bump.
                ...(c.at === undefined ? {} : { at: c.at }),
            })),
        } : {}),
        // Same rule, one version on: written ONLY for a v4 tape, so all 50
        // committed v1/v2/v3 fixtures round-trip byte-identically.
        ...(t.tape_version >= 4 ? {
            equips: t.equips.map((e) => ({ t: e.t, slot: e.slot })),
        } : {}),
        // Same rule again: written ONLY for a v5 tape, so all 57 frozen
        // fixtures round-trip byte-identically past the R5 batch.
        ...(t.tape_version >= 5 ? { pins: [...t.pins] } : {}),
        // Same rule again: written ONLY for a v6 tape, so all 98 frozen
        // fixtures round-trip byte-identically past the slice-23 batch.
        ...(t.tape_version >= 6 ? {
            save: {
                totem_parts: [...t.save.totem_parts],
                keys: [...t.save.keys],
                seal_parts: [...t.save.seal_parts],
            },
        } : {}),
        // Same rule again: written ONLY for a v7 tape, so all 108 frozen
        // fixtures round-trip byte-identically past the RNG batch.
        // ⚠ v7 writes TWO fields and v8 writes four — the same round-trip
        // rule one version on, and here it is load-bearing twice over: all
        // 118 frozen fixtures are v<=7 and would otherwise gain a
        // `cosmetic`/`fp` pair the moment anything re-serialized them, which
        // is precisely the re-record this batch exists to NOT take.
        ...(t.tape_version === 7 ? {
            rng: { seed: t.rng.seed, split: t.rng.split },
        } : {}),
        ...(t.tape_version >= 8 ? {
            rng: {
                seed: t.rng.seed, split: t.rng.split,
                cosmetic: t.rng.cosmetic, fp: t.rng.fp,
            },
            ...(t.seam ? { seam: seamToBlock(t.seam) } : {}),
        } : {}),
        tick_count: t.tick_count,
        inputs: t.inputs.map((s) => ({ key: s.key, from: s.from, to: s.to })),
    };
    return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * ── THE RUNTIME'S TAPE BUDGET, measured at R3 slice 0 ─────────────────
 *
 * The recompiled game cannot load an arbitrarily large tape: it dies with
 * `heap_alloc(...) failed - out of memory` BEFORE the first tick, so a tape
 * past the budget is a DEAD RUN and not a slow one. R2 found this by
 * running out of it — a denser plan of the same walk cost 30% more ticks
 * and 4.7x the spans, and the game then refused the headline outright.
 *
 * ⚠ THERE ARE TWO INDEPENDENT CEILINGS AND NEITHER SUBSUMES THE OTHER.
 * `scripts/procgen/probe-seedling-span-ceiling.mjs`, fresh page per load:
 *
 *   - SPAN COUNT: 2078 spans load, 2132 fail (at 36 bytes per synthetic
 *     span, so 76 KB vs 78 KB — bytes were nowhere near their own limit).
 *   - JSON BYTES: a 853-span tape padded with an inert field survives to
 *     95 KB and dies by 159 KB, far past the 78 KB the span sweep died at.
 *
 * A real span costs ~74 bytes against the probe's ~36, which is why the two
 * happen to bind at about the same tape — 2078 real spans would be ~154 KB.
 * Budget against BOTH.
 *
 * The limits below sit deliberately INSIDE the measured band, because the
 * measurement is of one build on one machine and the failure it guards
 * against costs a whole recording deadline. R2's committed headline is 853
 * spans / 63 KB, so this leaves it roughly twice the room it uses.
 *
 * ⚠ A THROW, NOT A WARNING, and at SYNTHESIS rather than at load: the
 * point is to fail while a planner is still running and cheap, not after
 * `--win` has spent forty minutes discovering it. Chunking `botLoadTape`
 * was the alternative and it is not one — concatenating chunks rebuilds
 * the same string, so it would not even address the allocation that fails.
 */
export const TAPE_BUDGET = Object.freeze({
    spans: 1800,
    bytes: 90 * 1024,
    measured: '2078/2132 spans, 95/159 KB — probe-seedling-span-ceiling.mjs, 2026-08-01',
});

/**
 * Throw unless `tape` is inside the budget the runtime actually has.
 *
 * @param {object} tape  a parsed or parseable tape
 * @param {string} what  what to name in the error (a fixture name, usually)
 */
export function assertTapeWithinRuntimeBudget(tape, what = 'tape') {
    const t = parseTape(tape);
    const spans = t.inputs.length;
    const bytes = serializeTape(t).length;
    if (spans > TAPE_BUDGET.spans || bytes > TAPE_BUDGET.bytes) {
        throw new Error(`${what} is past the recompiled runtime's tape budget: `
            + `${spans} spans (limit ${TAPE_BUDGET.spans}), `
            + `${Math.round(bytes / 1024)} KB (limit ${Math.round(TAPE_BUDGET.bytes / 1024)} KB). `
            + `The game refuses such a tape at LOAD with heap_alloc failure, before the `
            + `first tick — this is a dead run, not a slow one. Measured ceilings: `
            + `${TAPE_BUDGET.measured}. Split the walk into more segments, or make the `
            + 'plan less dense (R2: a smoother margin cost 4.7x the spans for 30% more '
            + 'ticks).');
    }
    return { spans, bytes };
}

/**
 * The GAME's side of the `transitions` record, derived from the tick
 * stream it already drains.
 *
 * `Bot.as` hardcodes `transitions: []` and no re-recording will change
 * that, but §1 ruling 2 defines an entry as "the first observation tick
 * whose `level` is the new level" — a pure function of the ticks. So this
 * is the whole of the game's side, and it lives here, in ONE place, used by
 * every consumer of a drained stream. The JS engine must NOT be routed
 * through it: `tapeRunner` derives its entries from its own world swap, and
 * if both sides derived from the level field the transitions diff would
 * degenerate into diffing the tick stream against itself.
 *
 * A same-level teleport is invisible to this definition, which is why
 * `playerPhysicsV2` refuses to model one rather than emitting an entry the
 * oracle could never produce.
 */
export function deriveTransitions(ticks) {
    const out = [];
    for (let i = 1; i < ticks.length; i++) {
        if (ticks[i].level !== ticks[i - 1].level) {
            out.push({
                t: ticks[i].t,
                from_level: ticks[i - 1].level,
                to_level: ticks[i].level,
            });
        }
    }
    return out;
}

/**
 * Validate an observation stream's SHAPE (not its values).
 *
 * `transitions` carries `{t, from_level, to_level}` per §1 ruling 2. The
 * checks below are all intrinsic to a record — integer fields, `t >= 1`
 * (the boot level is where observation 0 already is, so the earliest
 * possible swap lands at observation 1), strictly ascending `t` (one world
 * swap per tick at most), `t` within the stream, and a level change that
 * actually changes level.
 *
 * What is deliberately NOT checked here: that each `t` is a tick where the
 * `level` field changes, and that every such change has a record. That
 * would be true by construction on both sides — the game's entries are
 * DERIVED from the level field and the engine's swap writes both — so
 * asserting it would cost the transitions diff its independence and leave
 * it checking nothing the tick comparison had not already checked.
 */
export function parseObservationStream(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`observation stream is not valid JSON: ${e.message}`);
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        fail('observation stream must be an object { ticks, transitions }');
    }
    if (!Array.isArray(raw.ticks)) fail('observation stream .ticks must be an array');
    if (!Array.isArray(raw.transitions)) {
        fail('observation stream .transitions must be an array');
    }
    raw.ticks.forEach((o, i) => {
        const where = `ticks[${i}]`;
        if (o === null || typeof o !== 'object') fail(`${where} must be an object`);
        requireInt(o.t, `${where}.t`);
        requireFiniteNumber(o.x, `${where}.x`);
        requireFiniteNumber(o.y, `${where}.y`);
        requireInt(o.level, `${where}.level`);
        if (o.t !== i) fail(`${where}.t must equal its index (${i}), got ${o.t} — `
            + 'observations are dense and in order on both sides');
    });
    raw.transitions.forEach((tr, i) => {
        const where = `transitions[${i}]`;
        if (tr === null || typeof tr !== 'object' || Array.isArray(tr)) {
            fail(`${where} must be an object { t, from_level, to_level }`);
        }
        requireInt(tr.t, `${where}.t`);
        requireInt(tr.from_level, `${where}.from_level`);
        requireInt(tr.to_level, `${where}.to_level`);
        if (tr.t < 1) {
            fail(`${where}.t must be >= 1, got ${tr.t} — t is the first observation `
                + 'in the NEW level, and observation 0 is the boot level by definition');
        }
        if (tr.t >= raw.ticks.length) {
            fail(`${where}.t (${tr.t}) is past the end of the stream `
                + `(${raw.ticks.length} observations)`);
        }
        if (i > 0 && tr.t <= raw.transitions[i - 1].t) {
            fail(`${where}.t (${tr.t}) must be strictly greater than `
                + `transitions[${i - 1}].t (${raw.transitions[i - 1].t}) — at most one `
                + 'world swap lands per tick, and records are in order');
        }
        if (tr.from_level === tr.to_level) {
            fail(`${where} goes from level ${tr.from_level} to itself. A same-level `
                + 'teleport produces no level change in the tick stream, so the game '
                + 'side could never report one — it is refused at the engine instead '
                + 'of modelled asymmetrically');
        }
    });
    return {
        ticks: raw.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })),
        transitions: raw.transitions.map((tr) => ({
            t: tr.t, from_level: tr.from_level, to_level: tr.to_level,
        })),
    };
}

/** Serialize an observation stream to canonical JSON. */
export function serializeObservationStream(stream) {
    const s = parseObservationStream(stream);
    return `${JSON.stringify(s, null, 2)}\n`;
}

/**
 * Compare two observation streams for EXACT equality and return a
 * human-readable diff (null when identical).
 *
 * Exactness is deliberate and load-bearing: AS3 `Number` is an IEEE-754
 * double, JS numbers are doubles, and the recompiled C runtime uses
 * doubles too, so a mismatch is a transcription DEFECT to investigate,
 * not a tolerance to configure. If a genuine representation mismatch is
 * ever proven, document the evidence in the brief before bounding it.
 */
export function diffObservationStreams(expected, actual) {
    const e = parseObservationStream(expected);
    const a = parseObservationStream(actual);
    if (e.ticks.length !== a.ticks.length) {
        return `tick count differs: expected ${e.ticks.length}, got ${a.ticks.length}`;
    }
    for (let i = 0; i < e.ticks.length; i++) {
        const et = e.ticks[i];
        const at = a.ticks[i];
        if (et.x !== at.x || et.y !== at.y || et.level !== at.level) {
            return `tick ${i} differs: expected `
                + `(x=${et.x}, y=${et.y}, level=${et.level}), got `
                + `(x=${at.x}, y=${at.y}, level=${at.level})`
                + ` [dx=${at.x - et.x}, dy=${at.y - et.y}]`;
        }
    }
    // The transitions leg is ELEMENT-WISE and exact. It is a weaker check
    // than it looks if you forget where each side's entries came from: the
    // game's are derived from its level field, the engine's from its own
    // world swap, so this compares two independent accounts of the same
    // crossing. A count-only comparison (what v1 shipped) passes a run that
    // crossed the right number of times in the wrong places.
    const renderT = (tr) => `{t:${tr.t}, ${tr.from_level}->${tr.to_level}}`;
    const n = Math.min(e.transitions.length, a.transitions.length);
    for (let i = 0; i < n; i++) {
        const et = e.transitions[i];
        const at = a.transitions[i];
        if (et.t !== at.t || et.from_level !== at.from_level
            || et.to_level !== at.to_level) {
            return `transition ${i} differs: expected ${renderT(et)}, got ${renderT(at)}`;
        }
    }
    if (e.transitions.length !== a.transitions.length) {
        return `transition count differs: expected ${e.transitions.length} `
            + `[${e.transitions.map(renderT).join(', ')}], got ${a.transitions.length} `
            + `[${a.transitions.map(renderT).join(', ')}]`;
    }
    return null;
}

export { TapeFormatError };
