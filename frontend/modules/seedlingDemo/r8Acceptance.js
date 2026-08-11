/**
 * ── R8 ACCEPTANCE — the rung's own gates, as DATA ─────────────────────
 *
 * R8 is THE LIVE SOLVER BOT (kickoff `NewDocs/plans/seedling-bot-r8-opus-kickoff.md`).
 * This module carries the rung's predictions and ledgers in the shape R6/R7
 * established: a prediction is committed BEFORE the change it gates, its
 * outcome is recorded BESIDE it and never over it, and every ledger in here
 * has a DERIVED consumer in the same slice that adds it (trap 119 — this
 * arc's most expensive law, proved twice).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { LIVE_GEOMETRY_KEYS } from './levelWorld.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * ⛔⛔⛔ THE `normalizeLive` BATCH — R8 slice 0 track B, and the PREDICTION
 * IS COMMITTED BEFORE A LINE OF THE SWEEP MOVES.
 *
 * R7 slice 4 landed the brand (`levelWorld.normalizeLiveOpts` + a private
 * `Symbol`) and converted FIVE sites. The remaining call sites have been
 * owed BY NAME since — R7's close called it debt 1 and the R8 pivot moved it
 * onto the critical path, because a live reactive policy hammers exactly
 * these queries per tick.
 *
 * ── ⚠ THE PERF PREMISE IS RETRACTED AND STAYS RETRACTED (trap 137) ────
 *
 * `levelWorld.js`'s own docblock counted it: **31,191 `normalizeLive` calls
 * against 34,705,483 `liveRectOf` invocations** on `r5-l40-part5`, the very
 * tape R6 measured its +9.7 % on. 1,113 solids per query ⇒ the allocation
 * this batch removes is under a tenth of a percent of the work. **This batch
 * is a CORRECTNESS AND SHAPE change and must not be quoted as a speed-up.**
 * The named real lever — a per-world PRE-FILTER on `liveRectOf`'s per-solid
 * arms (`levelWorld.js`, the "THE REAL LEVER" note) — is NOT taken here; see
 * `leverNotTaken` below.
 *
 * ── ⚖ THE GATE, AS RULED ──────────────────────────────────────────────
 *
 * The launch prompt asked for a full `--win --tier=full` sweep. **Amended by
 * the orchestrator on a user ruling on sweep economy (2026-08-10)**:
 * `normalizeLive` is JS-MODEL-SIDE ONLY — the wasm game never executes a line
 * of it, so no game-side stream can move and a live sweep can only re-measure
 * the JS model against expectations the offline differential already
 * compares. The gate is therefore the **FULL OFFLINE vitest differential**
 * (every committed tape replayed through the JS model against its committed
 * expectation, `tapeRunner.test.js`, plus the whole default config), run
 * AFTER the last commit of this track, with this prediction stated first and
 * a clean `git status --porcelain`. ⚠ The premise is checkable and this
 * module checks it: `gameFacingFilesUntouched` names the files a wasm run
 * consumes, and the batch declares that none of them is in `sites`.
 */
export const R8_NORMALIZE_LIVE_BATCH = Object.freeze({
    item: Object.freeze({
        id: 'normalize-live-remaining-consumers',
        what: 'brand (and where the bag is rebuilt inside a loop or a per-probe closure, '
            + 'HOIST) every remaining live-geometry options bag in `levelRun.js` and '
            + '`botDriverV2.js`; assert the brand at every consumer entry in '
            + '`levelWorld.js`; replace `plannerObstacleAt`\'s hand-written forwarding '
            + 'literal with a NAMED PARTITION asserted total against `LIVE_GEOMETRY_KEYS`',
        cite: 'R7 close debt 1; kickoff §2.1 and §4 slice 0 track B; traps 86 (a '
            + 'hand-written options bag drops a family every time) and 89 (a hand roster '
            + 'beside a mechanism assertion is still a count)',
        streamEffect: '⛔ NOT APPLICABLE — no game-side stream exists to move. This is '
            + 'JS-model-side code; the wasm build replays tapes and never runs it.',
        valueEffect: 'none — every converted site passes the SAME key/value set it '
            + 'passed before. `normalizeLiveOpts` fills a missing key with `null`, which '
            + 'is exactly what `levelWorld`\'s own per-query normalise already did, so '
            + 'branding a bag at the call site is a shape change with no value in it.',
        constraint: '⛔ NO SITE MAY GAIN OR LOSE A FAMILY. The one place where the '
            + 'existing key set is DEMONSTRABLY short (`plannerObstacleAt`, see '
            + '`plannerDropsSixFamilies`) is preserved EXACTLY and made explicit rather '
            + 'than fixed — fixing it would re-route the planner, which is a re-record, '
            + 'and no re-record license exists this rung.',
    }),
    /** ⛔ Zero. A moved committed expectation is a defect by definition this rung. */
    predictedFixtureDiffs: 0,
    /** ⛔ Zero. Not "small" and not "only in the tapes we expect". */
    predictedValueChanges: Object.freeze([]),

    /**
     * ⛓⛓ THE SITE LIST, AND IT IS ASSERTED AGAINST THE SOURCE RATHER THAN
     * KEPT BESIDE IT (trap 89).
     *
     * `assertBatchSitesCoverSource` re-derives the call-site count from the
     * files themselves on every run, so a twenty-fourth site added tomorrow
     * fails BY NAME instead of being silently unconverted. A hand roster that
     * merely sits next to the mechanism assertion is the shape that rotted
     * twice in R6 slice 6f.
     *
     * `action` is one of:
     *   · `brand`        — the bag is built once per use; branded in place.
     *   · `brand+hoist`  — the bag was rebuilt inside a loop or a per-probe
     *                      closure; hoisted to once per call/tick AND branded.
     *   · `brand-not-hoisted` — hoisting would be a BEHAVIOUR change and the
     *                      source says so in as many words; branded only.
     *   · `already`      — converted by R7 slice 4; listed so the total is a
     *                      claim about all of them.
     */
    sites: Object.freeze([
        // ── levelRun.js — `liveSolidOpts(` ────────────────────────────
        /**
         * ⛓ ADDED BY R8 SLICE 1, and it is listed HERE rather than left to
         * make the count wrong: `assertBatchSitesCoverSource` re-derives the
         * call-site tally from the source on every run, so the bridge's new
         * bag failed it BY NAME the first time the suite ran — which is
         * exactly what that assertion is for (trap 89). The batch's own
         * CLAIM is unchanged; what grew is the list of sites the claim
         * covers, and the row says which slice added it.
         */
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepChasersNow',
            addedBy: 'R8 slice 1', action: 'brand+hoist',
            why: 'ONCE PER TICK, not per probe — a chaser\'s sweep is 1 px steps on both '
                + 'axes exactly like a block\'s, and every body in the room shares the one '
                + 'bag. Contrast `stepCrushersNow` and `stepIceTurretsNow`, which rebuild '
                + 'per body ON PURPOSE because those loops STEP the geometry they read: a '
                + 'chaser\'s sweep reads STATIC solids plus an explicitly-passed Enemy '
                + 'half, and the moving half (its siblings) is read live from the roster '
                + 'rather than through this bag.',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'pushableCtx',
            action: 'already', why: 'R7 slice 4 — once per tick, `{...base, pushables}` '
                + 'keeps the brand and the key order',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'spinnerCtx',
            action: 'already', why: 'R7 slice 4 — once per tick, the spinner sweep is '
                + '1 px steps on both axes',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'chest solidOver',
            action: 'brand', why: 'the bag carries a per-CHEST `openChests` set (its own '
                + 'id, the `e !== this` of `Entity.collide`), so it cannot be hoisted '
                + 'past the chest loop — branded where it is built',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepCrushersNow',
            action: 'brand-not-hoisted',
            why: '⛔ THE SOURCE SAYS WHY: "THE OPTS ARE REBUILT PER CRUSHER, and that is '
                + 'the point: the second one\'s world contains the first where THIS loop '
                + 'just left it". Hoisting would hand crusher 2 crusher 1\'s pre-move '
                + 'rect, which is a behaviour change dressed as a refactor.',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepBlastsNow',
            action: 'brand', why: 'already hoisted above the blast loop; branded',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepWandShotsNow',
            action: 'brand', why: 'already hoisted above the shot loop; branded, and '
                + '`wandShotBlockerAt` threads the one bag into `collidesSolid`',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'FinalBoss solidAt',
            action: 'brand+hoist',
            why: '⛓ THE WORST SITE IN THE FILE — a fresh 14-view bag per 1 px probe of '
                + 'the Owl\'s move sweep. Nothing inside `stepFinalBoss` mutates a '
                + 'per-visit geometry family (`spawnRock` queues into `owlPendingRocks`, '
                + 'which `fallenRocksNow` does not read until a rock has LANDED), so '
                + 'once per tick is the same bag the probes were each rebuilding.',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'collideLineSolid',
            action: 'brand', why: 'one bag per line query; branded',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepIceTurretsNow',
            action: 'brand-not-hoisted',
            why: 'the bag is read for `opts.turrets` and then a per-turret '
                + '`withoutSelf` map is derived from it; the turret roster moves as the '
                + 'loop steps corpses, so the rebuild is load-bearing exactly as the '
                + 'crusher one is',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepSealPieceNow blockedAt',
            action: 'brand+hoist',
            why: 'a bag per probe of the seal piece\'s own sweep; nothing in '
                + '`stepSealPiece` moves a geometry family',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'crusherScans getter',
            action: 'brand+hoist',
            why: 'a bag per crusher per READ of a getter a sensing bot polls every tick. '
                + '⚠ Unlike `stepCrushersNow` this loop MUTATES NOTHING — `scanCrusher` '
                + 'is a pure read — so the per-crusher rebuild was pure cost.',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'BossTotem step',
            action: 'brand', why: 'one bag per boss step; branded',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepV2 live arm',
            action: 'brand', why: 'the non-`noclip` arm of the player physics call; '
                + '`playerPhysicsV2` re-normalises its own bag (R7 slice 4) and the '
                + 'brand now makes that a single property read',
        }),
        /**
         * ⛓ ADDED BY R8 SLICE 2 — the live solver's window on the world.
         * `run.liveGeometryOpts()` returns the run's OWN builder's bag,
         * normalised and branded, all fourteen families: the solver's
         * full-bag path (⚖ ruled beside §8.3.1's preserved 8-key legacy
         * forwarding). Listed here because `assertBatchSitesCoverSource`
         * found it BY NAME the first run after it landed — the assertion
         * doing for slice 2 exactly what it did for slice 1's bridge bag.
         */
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'liveGeometryOpts getter',
            addedBy: 'R8 slice 2', action: 'brand',
            why: 'the solver hoists it once per PLAN (the cadence the per-visit state '
                + 'changes at); normalised at the run\'s own builder so the solver never '
                + 'hand-rosters a family (trap 86)',
        }),
        // ── botDriverV2.js — `livePerVisitOpts(` call sites ───────────
        //
        // ⛓ ONE CHANGE CONVERTS ALL FOUR. `livePerVisitOpts` is the single
        // source for the driver's per-visit families (R5 slice 15), so
        // branding its RETURN brands `liveGeometryOpts`, `burnProbeOpts` and
        // both `solidBoxesForMover` calls at once. ⚠ It returns 9 of the 14
        // families; the brand fills the other five with `null`, which is
        // exactly what the consumer's own normalise already did.
        Object.freeze({
            file: 'botDriverV2.js', builder: 'livePerVisitOpts', at: 'runShove solid boxes',
            action: 'brand', why: 'branded via the builder\'s return',
        }),
        Object.freeze({
            file: 'botDriverV2.js', builder: 'livePerVisitOpts', at: 'shove-sink solid boxes',
            action: 'brand', why: 'branded via the builder\'s return',
        }),
        Object.freeze({
            file: 'botDriverV2.js', builder: 'livePerVisitOpts', at: 'liveGeometryOpts',
            action: 'brand',
            why: '`{...branded, avoidVolumes, ...extra}` KEEPS the brand — a spread '
                + 'copies own enumerable SYMBOL keys and preserves insertion order, '
                + 'which is the property R7 slice 4 relied on for `{...base, pushables}`',
        }),
        Object.freeze({
            file: 'botDriverV2.js', builder: 'livePerVisitOpts', at: 'planNow',
            action: 'brand',
            why: '⛓⛓ THE A* SITE — `planNow`\'s object is threaded into the search and '
                + '`plannerObstacleAt` is consulted PER EXPANDED NODE against it',
        }),
        Object.freeze({
            file: 'botDriverV2.js', builder: 'burnProbeOpts', at: 'runFire before probe',
            action: 'brand', why: 'one call; branded via the builder\'s return',
        }),
        Object.freeze({
            file: 'botDriverV2.js', builder: 'burnProbeOpts', at: 'runFire still-solid claim',
            action: 'brand+hoist',
            why: '⛓ A BAG PER CANDIDATE TILE INSIDE A `.filter()` — the mid-leg '
                + 'still-solid claim rebuilt the whole per-visit view for every tree it '
                + 'checked. Hoisted to one bag per assertion.',
        }),
        Object.freeze({
            file: 'botDriverV2.js', builder: 'burnProbeOpts', at: 'runFire after probe',
            action: 'brand', why: 'one call; branded via the builder\'s return',
        }),
        // ── the forwarding literal, which builds no bag of its own ────
        Object.freeze({
            file: 'botDriverV2.js', builder: 'plannerObstacleAt-forwarding',
            at: 'the literal handed to plannerBlockerAt',
            action: 'brand',
            why: '⛓⛓ CONSULTED PER EXPANDED A* NODE, and each call rebuilt a ten-key '
                + 'literal for `plannerBlockerAt` to normalise again. Replaced by a '
                + 'NAMED PARTITION over `LIVE_GEOMETRY_KEYS` (see '
                + '`plannerDropsSixFamilies`), branded once per call. ⚠ Its key SET is '
                + 'preserved exactly — see that note for why it is not fixed here.',
        }),
    ]),

    /**
     * ⛔⛔⛔ WHAT THE RECON-VERIFY FOUND, AND IT IS PRESERVED RATHER THAN
     * FIXED — `plannerObstacleAt` FORWARDS 8 OF THE 14 LIVE FAMILIES.
     *
     * The planner's ONLY path to `plannerBlockerAt` hand-wrote its argument:
     *
     * ```
     *   { noclip, noHazards, openActivators, openBridges, pushables, brokenRocks,
     *     pulledRopes, openChests, burnedTrees, crushers }
     * ```
     *
     * — and `livePerVisitOpts` **supplies `turrets` and `bosses` on purpose**
     * (its own comments call them "the TENTH" and "the TWELFTH"), so those
     * two are built, passed in, destructured nowhere, and dropped on the
     * floor. `openMagicalLocks`, `shieldBosses`, `finalDoors` and
     * `fallenRocks` are dropped a step earlier — `plannerObstacleAt` has no
     * parameter for them at all, so no caller can pass one through.
     *
     * That is trap 86's defect for the FOURTH time in this arc, in the
     * hottest planner query there is. ⛔ AND IT IS NOT FIXED HERE: giving the
     * planner the six missing families changes what it thinks is walkable,
     * which re-routes legs, which moves committed tapes. **A re-record is not
     * available this rung.** What this batch does instead is make the drop
     * EXPLICIT and MECHANICALLY TOTAL: the two lists below partition
     * `LIVE_GEOMETRY_KEYS`, `assertPlannerLivePartition` asserts the
     * partition covers it exactly, and a fifteenth family added tomorrow
     * cannot join either list by accident.
     *
     * ⚠ The direction of the error is not uniform, which is why it is worth
     * a named row rather than a TODO: `bosses: null` means an unwoken
     * `BossTotem` reads as a WALL (conservative — it seals), while
     * `turrets: null` means a dead turret's 32x32 body is STILL a wall
     * (conservative too, and it is the reading R5 slice 20 introduced the
     * key to end). Both are the "accurate wall vs permissive refusal"
     * question (trap 139) decided by omission rather than by ruling.
     */
    plannerDropsSixFamilies: Object.freeze({
        forwarded: Object.freeze([
            'openActivators', 'openBridges', 'pushables', 'brokenRocks',
            'pulledRopes', 'openChests', 'burnedTrees', 'crushers',
        ]),
        dropped: Object.freeze([
            'openMagicalLocks', 'turrets', 'bosses', 'shieldBosses',
            'finalDoors', 'fallenRocks',
        ]),
        suppliedAndDropped: Object.freeze(['turrets', 'bosses']),
        why: 'PRESERVED EXACTLY — forwarding the six would re-route the planner and no '
            + 're-record license exists this rung. Named here so R8\'s live solver, '
            + 'which will want all fourteen, starts from a measurement rather than a '
            + 'rediscovery.',
    }),

    /**
     * ⛓ THE LEVER, DECLINED, WITH ITS REASON.
     *
     * The kickoff licensed the per-world pre-filter on `liveRectOf`'s
     * per-solid arms "ONLY if you measure it worth it, as its own commit with
     * its own numbers". It is NOT taken in this slice and no number is
     * claimed for it: the retracted premise (trap 137) means the honest
     * baseline for such a change is an interleaved A/B over several tapes,
     * which is a slice of its own, and slice 0 already carries four tracks.
     * Recorded so the next rung inherits a decision rather than a silence.
     */
    leverNotTaken: Object.freeze({
        what: 'a per-world PRE-FILTER on `liveRectOf`\'s per-solid arms — a solid with '
            + 'no `magicalLockId` can never take that arm',
        cite: 'levelWorld.js, the "THE REAL LEVER, NAMED WITH ITS NUMBER" note',
        why: 'not measured, so not claimed. Taking it without an interleaved A/B would '
            + 'repeat trap 137 exactly: naming a hypothesis and paying its fix.',
    }),

    /**
     * ⛔ THE GATE AMENDMENT\'S OWN PREMISE, AS A CHECKABLE LIST.
     *
     * The offline-differential gate is sound only while this batch touches
     * nothing a wasm run consumes. These are the files that ARE game-facing —
     * the tape projection the game is handed, the format that validates it,
     * and the harness that drives the recompiled build. `assertBatchIsModelSide`
     * asserts no `sites` entry names one.
     */
    gameFacingFiles: Object.freeze(['tapeFormat.js', 'tapeRunner.js']),
});

/**
 * ⛔⛔⛔ THE ENEMY BRIDGE, CLASS 1 (Bob) — R8 slice 1, AND THE PREDICTION IS
 * COMMITTED BEFORE A LINE OF THE BRIDGE IS WRITTEN.
 *
 * Wiring `chasers.chaserStep` into `levelRun`'s tick dispatch changes what the
 * MODEL replays for every committed tape whose rooms hold a bridged chaser.
 * The committed expectations are ORACLE RECORDINGS drained from the game
 * BEFORE the stepper existed, so they cannot have been fitted to it — which
 * makes the offline differential the strongest free gate this slice has
 * (trap 59, "a withdrawn recording is a free oracle", one rung on).
 *
 * ⛔ **A DIVERGENCE IS A DEFECT, NEVER A RE-RECORD.** No re-record licence
 * exists this rung; a moved expectation is a defect by definition.
 *
 * ── THE EXPOSURE, MEASURED BEFORE THE CHANGE ──────────────────────────
 *
 * Measured against the committed roster on 2026-08-10 at `153f5100b`
 * (`levelSource` × the tapes' own expectation streams — the LEVELS EACH TAPE
 * REALLY VISITS, not the levels its boot block names):
 *
 *   133 tapes · **94 gated** by `noclip` or `noDamage` · 39 remaining ·
 *   **5 EXPOSED** — they retire `noDamage` AND enter a room holding a `bob`.
 *
 * `exposedTapes` names all five. `assertBridgeExposureIsMeasured` re-derives
 * the set from disk on every run, so a sixth tape entering a bob room
 * tomorrow fails BY NAME rather than quietly joining the claim (trap 89).
 *
 * ── ⚖ THE `noDamage` GATE IS `stepContactsNow`'s OWN ARGUMENT, REUSED ──
 *
 * The stepper is skipped under `noclip || noDamage`, and that is not an
 * optimisation — it is the same claim `stepContactsNow` already makes one
 * function away: under the flag `Player.hit` returns at its first line, so
 * every contact is byte-inert. For a chaser the claim needs one more term,
 * because a POSITION could have a reader other than the contact scan. It has
 * none in this model, and the three candidates are named in
 * `enemyBodyReaders` rather than left as a silence:
 *   · `pushableCtx.collides`' Enemy arm consults SPINNERS only (the block's
 *     `solids.push("Enemy")` is modelled for one class);
 *   · `stepArrowTrapsNow` calls `stepArrow` with NO `bodies` at all, so an
 *     arrow in this model hits nothing (R7's arrow debt, carried);
 *   · a wand shot that reaches a non-`BossTotem` enemy is already a THROW by
 *     name, so no committed walk can take that path.
 * ⇒ under `noDamage` a chaser's position is unread, and the 94 + 34 tapes
 * are byte-inert BY GATE rather than by replay luck.
 *
 * ── THE PREDICTION, AS A FORK — both arms stated before the measurement ──
 *
 * See `prediction`. The honest statement is not "zero diffs" alone: the L5
 * arrow bait is 737 ticks with three live bobs whose GAME deaths are ARROW
 * kills, and this model prices no arrow against any body. So the fork is
 * stated, and whichever way it lands the record says what was believed first.
 */
export const R8_ENEMY_BRIDGE = Object.freeze({
    item: Object.freeze({
        id: 'enemy-bridge-class-1-bob',
        what: 'wire `chasers.chaserStep` into `levelRun.advance` as `stepChasersNow`, '
            + 'gated per `spinner.MODELLED_ENEMY_CLASSES` entry, and add the `Bob` entry; '
            + 'reprice `contactPricing(\'bob\')` from `mover` to `stepped` and price the '
            + 'contact through `applyPlayerHit` in the chaser\'s own slot',
        why: 'the mover throw (`levelRun.js` `stepContactsNow`) and `KILL_ARM_POLICY.Bob` '
            + 'are one missing thing between them — the chaser\'s POSITION at the tick. '
            + '`chasers.js` has transcribed the walk since R5 slice 3 and nothing has '
            + 'ever called it.',
        cite: 'kickoff §3.2 + §4 slice 1; §8.8 (the roster is an OBJECT — an ENTRY, not a push)',
    }),

    /**
     * ⛔ THE FIVE, BY NAME — and the set is RE-DERIVED, never trusted.
     *
     * A tape is exposed when it retires `noDamage` (so a contact can land)
     * AND its own recorded stream enters a level holding a `bob`. Everything
     * else is byte-inert by the gate above.
     */
    exposedTapes: Object.freeze([
        Object.freeze({ name: 'r7-act2-3', levels: Object.freeze([4]), bobs: 1, ticks: 245 }),
        Object.freeze({ name: 'r7-act2-4', levels: Object.freeze([4, 5]), bobs: 4, ticks: 347 }),
        Object.freeze({ name: 'r7-act2-5', levels: Object.freeze([5, 6]), bobs: 5, ticks: 812 }),
        Object.freeze({ name: 'r7-act2-6', levels: Object.freeze([6]), bobs: 2, ticks: 355 }),
        Object.freeze({ name: 'r7-act2-full', levels: Object.freeze([4, 5, 6]), bobs: 6, ticks: 3523 }),
    ]),

    /**
     * ⛓ EXPOSED, AND AUTHORED BY THIS SLICE — kept in its OWN list so the
     * PREDICTION above stays exactly the claim that was committed before the
     * bridge moved.
     *
     * ⛔ `assertBridgeExposureIsMeasured` found it, by name, the first time
     * the suite ran after track E landed — which is what that assertion is
     * for (trap 89). Folding this row into `exposedTapes` would have made the
     * prediction retroactively "right about six", and a prediction edited
     * after its measurement is not a prediction. The set the assertion
     * checks is the UNION; the two halves say which is which.
     */
    exposedAdded: Object.freeze([
        Object.freeze({
            name: 'r8-l6-bob-contact', levels: Object.freeze([6]), bobs: 2, ticks: 30,
            addedBy: 'R8 slice 1 (track E)',
            why: 'the slice\'s own driven arm — the stance the bridge newly prices, and '
                + 'the only tape on the roster authored to be exposed on purpose',
        }),
    ]),

    /**
     * ⛔ THE SLICE'S DECLARED SCOPE — census tags, one class.
     *
     * ⚠ A DECLARATION, and it is deliberately NOT the derivation. The
     * bridge's own roster is `chasers.bridgedChaserTags()`, computed from
     * `CHASERS` ∩ `MODELLED_ENEMY_CLASSES`; `assertBridgeRosterMatchesScope`
     * asserts the two agree. Two independently-written tables plus an
     * equality is this arc's idiom (`assertKillArmPolicyCovers`), and it is
     * what lets the PREDICTION be committed one commit before the roster it
     * predicts about exists.
     */
    bridgedClasses: Object.freeze(['bob']),

    /** The roster tally the exposure was derived from, at `153f5100b`. */
    rosterAtPrediction: Object.freeze({
        tapes: 133, gatedByFlag: 94, retiresNoDamage: 39, exposed: 5,
    }),

    /**
     * ⚠ THE READERS AN "UNREAD POSITION" CLAIM HAS TO SURVIVE, enumerated so
     * a fourth one added tomorrow makes this list wrong out loud rather than
     * making the `noDamage` gate silently unsound.
     */
    enemyBodyReaders: Object.freeze([
        Object.freeze({
            reader: 'levelRun.pushableCtx().collides',
            arm: 'the block\'s `solids.push("Enemy")`',
            reads: 'spinnerRectsNow() ONLY',
            consequence: 'a stepped bob is invisible to a pushable block in this model. '
                + 'NAMED, NOT FIXED — feeding chaser bodies in would move L8/L39/L40 '
                + 'block sweeps, which is a re-record this rung has no licence for.',
        }),
        Object.freeze({
            reader: 'levelRun.stepArrowTrapsNow',
            arm: '`stepArrow(a, {frozen, bound})`',
            reads: 'NOTHING — `bodies` defaults to `[]`',
            consequence: 'an arrow in this model passes through every body, player and '
                + 'enemy alike (R7\'s carried arrow debt). This is what the L5 fork below '
                + 'turns on.',
        }),
        Object.freeze({
            reader: 'levelRun.applyWandShotToBoss',
            arm: '`WandShot.solids` + "Enemy"',
            reads: 'the boss roster; anything else THROWS by name',
            consequence: 'no committed walk fires a wand at a chaser, and one that did '
                + 'would fail loudly rather than silently.',
        }),
    ]),

    /**
     * ⛔ THE FORK, STATED FIRST. `outcome` is written BESIDE this, never over
     * it (the R6/R7 shape).
     */
    prediction: Object.freeze({
        statedAt: '2026-08-10, before the first line of the bridge',
        baseline: Object.freeze({
            commit: '153f5100b', files: 240, tests: 6829, seconds: 363.72,
            note: 'measured THIS session on the unmodified tree — a gate with no baseline '
                + 'cannot attribute (trap 40).',
        }),
        gated: '94 + 34 = 128 tapes are byte-inert BY GATE, not by replay: they either '
            + 'declare `noclip`/`noDamage` or never enter a room holding a bridged chaser. '
            + 'This arm is asserted mechanically, not measured by 128 replays.',
        armA: 'the five exposed tapes replay BYTE-EXACT — the transcription is right and '
            + 'no stepped bob reaches the player on any of the five walks.',
        armB: '⛔ `r7-act2-5` and `r7-act2-full` RED at the L5 arrow bait. The GAME kills '
            + 'all three L5 bobs with arrows; this model prices no arrow against any body, '
            + 'so its bobs would survive the whole 737-tick block and chase a player who '
            + 'is deliberately standing still to bait them. That red is a FINDING — the '
            + 'missing Arrow×Enemy pricing, named in `enemyBodyReaders` — and it is fixed '
            + 'AT SOURCE or REPORTED as a wall. It is never a re-record.',
        expected: 'armB for the two L5 tapes; armA for `r7-act2-3`, `r7-act2-6` and (if '
            + 'the L5 block is what bites) NOT `r7-act2-4`, whose L5 span is only its '
            + 'last few ticks. Stated as a fork rather than a number because the honest '
            + 'answer depends on a measurement nobody has taken.',
    }),
});

/**
 * ⛔ THE EXPOSURE IS RE-DERIVED FROM DISK, NOT TRUSTED.
 *
 * Reads every committed tape and every committed expectation, recomputes
 * which tapes retire `noDamage` AND enter a level holding a bridged chaser,
 * and compares against `exposedTapes`. A sixth exposed tape — a new fixture,
 * a re-planned route, a class newly bridged — fails here BY NAME.
 *
 * ⚠ THE LEVEL SET COMES FROM THE RECORDED STREAM, not from the boot block: a
 * tape that crosses into a bob room 300 ticks in is exposed and its boot
 * block does not say so.
 *
 * @param {object} io injected so the assertion is testable against a
 *   synthetic roster — `{tapeNames, loadTapeJson, levelsVisited, bobLevels}`
 */
export function assertBridgeExposureIsMeasured(io) {
    if (!io || typeof io.tapeNames !== 'function') {
        throw new Error('assertBridgeExposureIsMeasured: needs an io seam '
            + '{tapeNames, loadTapeJson, levelsVisited, bridgedLevels} — a default that '
            + 'read the real roster would make the synthetic mutation cases untestable.');
    }
    const bridged = io.bridgedLevels();
    const found = [];
    for (const name of io.tapeNames()) {
        const tape = io.loadTapeJson(name);
        if (tape.noclip || tape.noDamage) continue;
        const levels = [...io.levelsVisited(name)].filter((l) => bridged.has(l)).sort((a, b) => a - b);
        if (levels.length) found.push({ name, levels });
    }
    const all = [...R8_ENEMY_BRIDGE.exposedTapes, ...R8_ENEMY_BRIDGE.exposedAdded];
    const declared = all.map((t) => t.name).sort();
    const measured = found.map((f) => f.name).sort();
    const missing = measured.filter((n) => !declared.includes(n));
    const stale = declared.filter((n) => !measured.includes(n));
    if (missing.length || stale.length) {
        throw new Error('R8_ENEMY_BRIDGE: the exposed set on disk is not the one declared. '
            + `Undeclared and exposed: ${missing.join(', ') || 'none'}; declared and no `
            + `longer exposed: ${stale.join(', ') || 'none'}. The prediction is a claim `
            + 'about WHICH tapes the bridge can move — a tape missing from it is a tape '
            + 'nobody predicted (trap 89).');
    }
    for (const f of found) {
        const row = all.find((t) => t.name === f.name);
        const same = row.levels.length === f.levels.length
            && row.levels.every((l, i) => l === f.levels[i]);
        if (!same) {
            throw new Error(`R8_ENEMY_BRIDGE: "${f.name}" is declared exposed in levels `
                + `[${row.levels.join(',')}] and really enters [${f.levels.join(',')}]. `
                + 'The LEVELS are the claim; a right name with wrong rooms is a prediction '
                + 'about a different walk.');
        }
    }
    return { exposed: found.length, tapes: measured };
}

/**
 * ⛔ THE TWO TABLES AGREE, AND THE AGREEMENT IS ASSERTED — never assumed.
 *
 * `R8_ENEMY_BRIDGE.bridgedClasses` is a DECLARATION (it is what the
 * prediction was measured against, one commit before the roster existed);
 * `chasers.bridgedChaserTags()` is the DERIVATION the run really gates on.
 * Two independently-written tables plus an equality is this arc's idiom
 * (`assertKillArmPolicyCovers`), and it is the only shape that makes the
 * prediction and the code the same claim.
 *
 * @param {Function} derived injected `bridgedChaserTags` — injected so the
 *   disagreement can be constructed, per slice 0 track C's own law: a
 *   comparison that has never seen one might be comparing nothing.
 */
export function assertBridgeRosterMatchesScope(derived) {
    if (typeof derived !== 'function') {
        throw new Error('assertBridgeRosterMatchesScope: pass `bridgedChaserTags` — a '
            + 'default import would make the disagreement case unconstructable.');
    }
    const got = [...derived()].sort();
    const want = [...R8_ENEMY_BRIDGE.bridgedClasses].sort();
    if (got.join(',') !== want.join(',')) {
        throw new Error('R8_ENEMY_BRIDGE: the DECLARED scope and the DERIVED bridge '
            + `roster disagree — declared [${want.join(', ')}], derived [${got.join(', ')}]. `
            + 'The prediction\'s exposed-tape set was measured against the declaration, so '
            + 'a roster that has moved makes the prediction a claim about a different '
            + 'change.');
    }
    return { classes: got };
}

/**
 * ⛔ THE `stepped` CONTACT TABLES ARE A PARTITION OVER ONE KEY SET.
 *
 * `CONTACT_STEPPED_FAMILIES` says which tags are `stepped`;
 * `CONTACT_STEPPED_PRICED_BY` says which of those price their own contact
 * (SKIP) and which do not (THROW); `CONTACT_STEPPED_WHY` says why, per class.
 * A family in one table and not another is trap 94 exactly — it would pass
 * every check that only looks at the table it IS in, and `contactPricing`
 * would hand back `why: undefined` while the skip/throw decision silently
 * took the safe-looking branch.
 *
 * ⛓ AND THE BRIDGE ROSTER IS INSIDE THE PARTITION: every bridged tag must be
 * a `stepped` family with a pricer, or the census scan would go on refusing a
 * body the run now steps.
 */
export function assertSteppedContactPartition({ families, pricedBy, why, bridged }) {
    const keys = (o) => Object.keys(o).sort();
    const fam = [...families].sort();
    for (const [name, table] of [['CONTACT_STEPPED_PRICED_BY', pricedBy], ['CONTACT_STEPPED_WHY', why]]) {
        const k = keys(table);
        if (k.join(',') !== fam.join(',')) {
            throw new Error(`R8_ENEMY_BRIDGE: ${name} covers [${k.join(', ')}] and `
                + `CONTACT_STEPPED_FAMILIES names [${fam.join(', ')}]. The three tables are `
                + 'ONE key set: a family in the list with no row here answers the '
                + 'skip-or-throw question with `undefined` (trap 94).');
        }
    }
    for (const tag of bridged) {
        if (!families.includes(tag)) {
            throw new Error(`R8_ENEMY_BRIDGE: "${tag}" is BRIDGED (the run steps it) and is `
                + 'not a `stepped` contact family — so `stepContactsNow` would still price '
                + 'it from its `.oel` placement, which the body left on its first chase '
                + 'tick.');
        }
        if (!pricedBy[tag]) {
            throw new Error(`R8_ENEMY_BRIDGE: "${tag}" is BRIDGED and has no `
                + '`CONTACT_STEPPED_PRICED_BY` entry, so the census scan would THROW on a '
                + 'body the run steps and prices. A bridged class must name its pricer.');
        }
    }
    /**
     * ⛔ AND THE COMPLEMENT IS THE CONTROL, ASSERTED. A `stepped` family that
     * is NOT bridged must have `pricedBy: null` — that null is the refusal
     * the pair's control rides on, and a slice that quietly gave one a pricer
     * would delete the control without deleting the test that names it.
     */
    const unbridgedWithPricer = fam.filter((t) => !bridged.includes(t) && pricedBy[t]);
    if (unbridgedWithPricer.length) {
        throw new Error('R8_ENEMY_BRIDGE: unbridged `stepped` famil(ies) '
            + `[${unbridgedWithPricer.join(', ')}] name a pricer. Nothing steps them, so `
            + 'the pricer cannot exist — and the census scan would SKIP them, which is a '
            + 'silent zero for a body nobody prices.');
    }
    return { families: fam.length, bridged: [...bridged], refused: fam.filter((t) => !pricedBy[t]) };
}

/**
 * ⛔ THE SITE LIST IS RE-DERIVED FROM THE SOURCE, NOT TRUSTED.
 *
 * Counts the live-geometry bag builders in each file and compares against the
 * batch's own `sites` tally per (file, builder). A site added, removed or
 * renamed makes this fail BY NAME — which is the whole difference between an
 * assert-against-list and a roster typed beside a mechanism assertion.
 *
 * ⚠ It counts CALL SITES of the builders, not of the consumers: the debt is
 * about how many times a bag is BUILT.
 */
export function assertBatchSitesCoverSource() {
    const spec = [
        // ⚠ `minusDefinition` is per BUILDER because the two declaration
        // styles differ: `const liveSolidOpts = (extra) => …` does not match
        // `liveSolidOpts(` at all, while `export function livePerVisitOpts(`
        // does. Counted rather than assumed — an arrow function rewritten as
        // a `function` declaration would otherwise silently gain a site.
        { file: 'levelRun.js', builder: 'liveSolidOpts', pattern: /\bliveSolidOpts\(/g,
            minusDefinition: 0 },
        { file: 'botDriverV2.js', builder: 'livePerVisitOpts', pattern: /\blivePerVisitOpts\(/g,
            minusDefinition: 1 },
        { file: 'botDriverV2.js', builder: 'burnProbeOpts', pattern: /\bburnProbeOpts\(/g,
            minusDefinition: 0 },
    ];
    const out = [];
    for (const s of spec) {
        const src = readFileSync(join(HERE, s.file), 'utf8');
        const found = (src.match(s.pattern) ?? []).length - s.minusDefinition;
        const listed = R8_NORMALIZE_LIVE_BATCH.sites.filter(
            (r) => r.file === s.file && r.builder === s.builder).length;
        if (found !== listed) {
            throw new Error(`R8_NORMALIZE_LIVE_BATCH: ${s.file} has ${found} call site(s) `
                + `of \`${s.builder}\` and the batch lists ${listed}. A site the batch `
                + 'does not name is a site nobody converted, and it reads exactly like a '
                + 'converted one (trap 89).');
        }
        out.push({ file: s.file, builder: s.builder, sites: found });
    }
    return out;
}

/**
 * ⛔ THE PARTITION IS TOTAL, AND IT IS ASSERTED AGAINST
 * `LIVE_GEOMETRY_KEYS` — never against a count.
 *
 * `plannerObstacleAt` forwards some families to `plannerBlockerAt` and drops
 * the rest. Both halves are named; this asserts they are disjoint and that
 * their union is exactly the live-geometry key list. A fifteenth family
 * added to `LIVE_GEOMETRY_KEYS` fails here, by name, before it can be
 * silently dropped by the planner too.
 */
export function assertPlannerLivePartition() {
    const { forwarded, dropped } = R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies;
    const both = forwarded.filter((k) => dropped.includes(k));
    if (both.length) {
        throw new Error('R8_NORMALIZE_LIVE_BATCH: the planner partition lists '
            + `${both.join(', ')} as BOTH forwarded and dropped. A class in two tables `
            + 'passes both checks (trap 94).');
    }
    const union = new Set([...forwarded, ...dropped]);
    const missing = LIVE_GEOMETRY_KEYS.filter((k) => !union.has(k));
    const extra = [...union].filter((k) => !LIVE_GEOMETRY_KEYS.includes(k));
    if (missing.length || extra.length) {
        throw new Error('R8_NORMALIZE_LIVE_BATCH: the planner partition does not cover '
            + `LIVE_GEOMETRY_KEYS. Missing: ${missing.join(', ') || 'none'}; `
            + `not a live key: ${extra.join(', ') || 'none'}. The partition is what makes `
            + 'the planner\'s six dropped families a MEASUREMENT instead of an omission.');
    }
    return { forwarded: forwarded.length, dropped: dropped.length, total: union.size };
}

/**
 * ⛓ THE GATE AMENDMENT'S PREMISE, CHECKED RATHER THAN BELIEVED (trap 122 —
 * "not byte-inert" is a claim about what is COMMITTED, so measure it).
 *
 * The offline differential replaces a live sweep only while this batch is
 * model-side. If a later edit dragged a game-facing file into `sites`, this
 * fails and the change re-earns its `--win` sweep.
 */
export function assertBatchIsModelSide() {
    const touched = R8_NORMALIZE_LIVE_BATCH.sites
        .map((s) => s.file)
        .filter((f) => R8_NORMALIZE_LIVE_BATCH.gameFacingFiles.includes(f));
    if (touched.length) {
        throw new Error('R8_NORMALIZE_LIVE_BATCH: this batch names game-facing file(s) '
            + `${[...new Set(touched)].join(', ')}. The offline-differential gate was `
            + 'ruled on the premise that nothing here reaches the wasm run — a change '
            + 'that does re-earns a `--win --tier=full` sweep and must say so.');
    }
    return { modelSide: true, files: [...new Set(R8_NORMALIZE_LIVE_BATCH.sites.map((s) => s.file))] };
}
