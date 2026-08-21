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
        /**
         * ⛓ ADDED BY R8 SLICE 3, and by the same route: the Arrow × Enemy
         * family gave `stepArrowTrapsNow` a cover query, and the guard above
         * failed BY NAME on the count before a line of the test stratum was
         * written. Two slices running, two additions caught — a re-derived
         * tally is worth more than a list somebody remembers to edit.
         */
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'stepArrowTrapsNow',
            addedBy: 'R8 slice 3', action: 'brand+hoist',
            why: 'ONCE PER TICK for EVERY arrow in flight, not once per arrow — the '
                + 'cover query (`world.collidesArrowCover`) is a read and not a step, so '
                + 'the `crusherScans` half of slice 0\'s contrast applies rather than the '
                + '`stepCrushersNow` half: nothing this loop does moves the geometry the '
                + 'next arrow reads.',
        }),
        /**
         * ⛓⛓ ADDED BY R8 SLICE 5, and both are the same bag for the same
         * subsystem seen from the PLANNER's side rather than the tick's.
         * `assertBatchSitesCoverSource` named them the first time the suite
         * ran after the probe landed — the fourth time this guard has done its
         * job on the slice that followed the one that wrote it (trap 89).
         */
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'arrowCoverAt',
            action: 'brand',
            why: 'the arrow\'s own cover query, handed OUT as a closure so a predictor '
                + 'cannot assemble a second reading of which torches and blocks are '
                + 'standing. One bag per call, branded through `normalizeLiveOpts`.',
        }),
        Object.freeze({
            file: 'levelRun.js', builder: 'liveSolidOpts', at: 'arrowForecastNow',
            action: 'brand',
            why: 'the forecast\'s cover query — hoisted once per FORECAST rather than '
                + 'per tick of it, which is the cadence the geometry changes at for a '
                + 'walk that has not happened yet (the same call the live stepper makes '
                + 'once per tick).',
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
        Object.freeze({
            name: 'r8-solve-3', levels: Object.freeze([4]), bobs: 1, ticks: 245,
            addedBy: 'R8 slice 2 (the battery)',
            why: 'the solver\'s own L3 segment ends at the L4 arrival, and L4 holds '
                + '`bob@64,64` — the same exposure shape as `r7-act2-3`, whose route it '
                + 're-derives. L4 is bridge-refused (arrow traps), so the bob is priced '
                + 'as a parked mover the arrival never overlaps.',
        }),
        /**
         * ⛓ R8 SLICE 3b — AND THE ASSERTION FOUND BOTH OF THESE THE FIRST
         * TIME THE FULL CONFIG RAN AFTER THEY LANDED, by name, which is the
         * third time this guard has done its job on the slice that followed
         * the one that wrote it. ⛔ Neither is folded into `exposedTapes`:
         * a prediction edited after its measurement is not a prediction.
         *
         * ⚠ AND THE EXPOSURE IS NO LONGER A "PARKED MOVER" CLAIM FOR EITHER
         * OF THEM. Slice 3 widened `chaserRoomVerdict`, so L4 and L6 are both
         * STEPPED — these two tapes drive bridged bodies through their whole
         * lifetimes (an arrow kill in L4, two drownings in L6) and the game
         * confirmed every tick of it byte-exact.
         */
        Object.freeze({
            name: 'r8-solve-4', levels: Object.freeze([4, 5]), bobs: 1, ticks: 253,
            addedBy: 'R8 slice 3b (the battery)',
            why: 'the solver\'s own L4 segment: it HOLDS the button until the room\'s '
                + 'own ceiling kills `bob@64,64` (an arrow kill at t=114, the body gone '
                + 'at 149), then shoves and crosses into L5, whose arrival the three '
                + 'bobs there never reach. The first battery tape whose exposure is a '
                + 'body the run STEPS through its whole lifetime rather than one it '
                + 'walks past.',
        }),
        Object.freeze({
            name: 'r8-solve-6', levels: Object.freeze([6]), bobs: 2, ticks: 294,
            addedBy: 'R8 slice 3b (the battery)',
            why: 'the solver\'s own L6 segment: the BAIT stance drowns `bob@112,48` at '
                + 't=55 and `bob@96,16` follows the walk into the water at t=205 — two '
                + 'terrain deaths the model COMPUTES, which is why this tape declares no '
                + 'v10 despawn where the hand-authored `r7-act2-6` needs one.',
        }),
        /**
         * ⛓ R8 SLICE 5 — and the guard named it the first time the suite ran
         * after the tape landed, which is the fourth occasion. `r8-solve-5`'s
         * whole solution IS three bobs dying to the ceiling, so it is the most
         * exposed tape on the roster by construction.
         */
        Object.freeze({
            name: 'r8-solve-5', levels: Object.freeze([5, 6]), bobs: 3, ticks: 558,
            addedBy: 'R8 slice 5 (the ETA probe + the battery\'s tail)',
            why: 'the solver\'s own L5 segment: the room\'s ceiling kills all three '
                + 'bobs, `Game.totalEnemies()` reaches zero and `lock@48,112` opens. '
                + 'Every one of those deaths is a stepped body the bridge prices. '
                + '⚠ The LEVELS are [5, 6] and not [5]: the segment ENDS by crossing '
                + 'into L6, and the assertion named that too — a right name with the '
                + 'wrong rooms is a prediction about a different walk.',
        }),
        /**
         * ⛓ R8 SLICE 8 — and the guard named it the FIFTH time, the first run
         * after the driven pair landed. A tape missing from this list is a
         * tape nobody predicted (trap 89), and this one is here because its
         * 80-tick walk north leaves L18 — a room with no chaser — for one
         * that has them.
         *
         * ⚠ ITS CONTROL IS **NOT** EXPOSED, and that is the pair working: the
         * hammer hit the control takes at tick 247 knocks the walk back far
         * enough that the same 80 ticks never reach the door. Two tapes, one
         * integer apart, and the exposure list can tell them apart.
         */
        Object.freeze({
            name: 'r8-hammer-arm', levels: Object.freeze([16]), bobs: 1, ticks: 324,
            addedBy: 'R8 slice 8 (the hammer\'s driven pair)',
            why: 'the ARM of the hammer-phase pair: it stands out a 244-tick wait in '
                + 'L18, walks north through `spinner@48,96`\'s disc taking nothing, and '
                + 'crosses back into L16 — whose chaser the bridge steps for the ticks '
                + 'the tape has left. ⚠ The LEVELS are the rooms with a BRIDGED body, '
                + 'not the rooms the walk visits: L18 has spinners and no chaser.',
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
            arm: '`stepArrow(a, {frozen, bound, bodies, coverAt})`',
            /**
             * ⛓⛓⛓ R8 SLICE 3 REWROTE THIS ROW, and the row is why the
             * `noDamage` gate is still sound. It read *"NOTHING — `bodies`
             * defaults to `[]`"*, and that absence is what scoped slice 1's
             * bridge by ROOM. The family is built, so this IS a reader of a
             * chaser's position now — and `arrowBodiesNow` re-asks
             * `stepChasersNow`'s own `noclip || noDamage` gate for exactly
             * that reason. A capability that lit up a second control is the
             * shape that has bitten this arc twice
             * ([[feedback_capability_lights_up_two_controls]]); naming the
             * reader here is what made the third one cheap.
             */
            reads: 'the player box, the LIVE bridged-chaser bodies (behind the same '
                + '`noclip || noDamage` gate the stepper returns on) and the static '
                + '"Enemy" census bodies; cover through `world.collidesArrowCover`',
            consequence: 'an arrow now stops on everything the game stops it on and '
                + 'DAMAGES the chasers — which is what retires the room-scoped refusal. '
                + 'The static bodies STOP and are not damaged, and a room mixing a trap '
                + 'with one is refused by name (`chaserRoomVerdict`).',
            changedBy: 'R8 slice 3',
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

/**
 * ⛓⛓⛓ R8 SLICE 3 — THE ARROW × ENEMY FAMILY, AND THE PREDICTION IT IS GATED
 * ON, STATED BEFORE A LINE OF IT MOVED.
 *
 * Slice 1's wall was a LIFETIME gap, not a motion one (trap 157): this
 * model's arrows hit NOTHING, so a room with an arrow trap could not be
 * stepped at all — the game's arrows kill L4's and L5's bobs and the model's
 * would have survived to chase a player standing still to bait them.
 * `chaserRoomVerdict` refuses such a room BY NAME today, and widening that
 * refusal is this slice's deliverable.
 *
 * ⛔ THE GATE IS THE FREE ORACLE, AND ITS ARMS ARE NAMED. The three tapes
 * slice 1 measured RED are the whole point: with the family built they must
 * replay BYTE-EXACT, because the model now sees the deaths the game always
 * took. A divergence is a transcription defect — never a re-record (no
 * licence exists this rung).
 */
export const R8_ARROW_ENEMY = Object.freeze({
    item: Object.freeze({
        id: 'arrow-x-enemy-family',
        what: 'hand `stepArrow` its `bodies` — the room\'s live chaser bodies, its static '
            + '"Enemy" census bodies, the arrow\'s own cover list and the player — and '
            + 'price the ENEMY arm through `enemyDamage.enemyHit` with the death staging '
            + '(`startDeath` -> the "die" Spritemap -> `endAnim` -> `Mobile.death`\'s fade '
            + '-> `FP.world.remove`); then widen `chaserRoomVerdict` so an arrow-trap room '
            + 'is stepped',
        why: 'a body\'s POSITION without its LIFETIME is right for exactly as long as the '
            + 'body should have existed and wrong for ever afterwards (trap 157). The '
            + 'lifetime this slice adds is the arrow one; the terrain one is already '
            + 'built, and the two together are what make L4/L5 steppable.',
        cite: 'kickoff §4 slice 3 charge A; §9.1 (the banked measurement); §9.7 (what a '
            + 'PRESS arm still owes)',
    }),

    /**
     * ⛔ THE ROOMS ARE DISJOINT, AND THAT IS A MEASUREMENT THAT SCOPES THE
     * SLICE — taken from the built censuses before any code moved.
     *
     * No room on the act2 battery holds BOTH a bridged chaser and a static
     * "Enemy" body under an arrow trap:
     *
     *   L4  2 traps, `bob@64,64`, no static enemy
     *   L5  4 traps, three bobs, no static enemy
     *   L6  NO trap, four sandtraps + two bobs   (already stepped, slice 1)
     *   L8  1 trap, two sandtraps, NO bob
     *
     * ⇒ the DAMAGE arm this slice builds is the chaser one; a static body is
     * an arrow STOPPER whose own death staging stays REFUSED BY NAME — and
     * the refusal is bounded by this measurement rather than by a hope.
     */
    roomScope: Object.freeze([
        Object.freeze({ level: 4, traps: 2, chasers: 1, staticEnemies: 0 }),
        Object.freeze({ level: 5, traps: 4, chasers: 3, staticEnemies: 0 }),
        Object.freeze({ level: 6, traps: 0, chasers: 2, staticEnemies: 4 }),
        Object.freeze({ level: 8, traps: 1, chasers: 0, staticEnemies: 2 }),
    ]),

    /**
     * ⛔ THE FORK, STATED FIRST — `outcome` is written BESIDE this, never over
     * it (the R6/R7/slice-1 shape).
     */
    prediction: Object.freeze({
        statedAt: '2026-08-10, before the first line of the family',
        baseline: Object.freeze({
            commit: '349aef358', files: 242, tests: 6898, seconds: 354.78,
            note: 'slice 2\'s close numbers on the identical tree; re-measured this '
                + 'session before anything moved (a gate with no baseline cannot '
                + 'attribute — trap 40).',
        }),
        armA: '⛓ EVERY committed tape replays BYTE-EXACT with the widened bridge on — '
            + 'INCLUDING `r7-act2-4`, `r7-act2-5` and `r7-act2-full`, the three slice 1 '
            + 'measured RED. Those three are the claim: the model now kills the bobs the '
            + 'game kills, at the ticks the game kills them, so the walks that baited '
            + 'them replay unchanged.',
        armB: '⛔ one or more of the three stays RED. That is a TRANSCRIPTION defect in '
            + 'this family — the damage gates, the knockback the killing hit does NOT '
            + 'take, the die animation\'s length, the fade\'s eleventh tick, or the update '
            + 'slot the anim\'s first graphic update falls in — and it is fixed at source '
            + 'or REPORTED as a wall. It is never a re-record.',
        expected: 'armA. Stated as the claim rather than as a hope because slice 1 already '
            + 'measured the cause (arrows hitting nothing) and R7 slice 6c already '
            + 'measured the game\'s own answer in L4 (hits 0->1->2->3, the body gone at '
            + 't~158) — so this is a prediction with a number behind it.',
        alsoPredicted: Object.freeze([
            'the L4 bob dies to the THIRD arrow and the killing hit takes NO knockback '
                + '(`Enemy.hit`\'s `startDeath` is the IF arm; `knockback` is the ELSE)',
            'the i-frame floor is 60 ticks between the first and third landed arrow '
                + '(`hitsTimerMax` 30, `hitsMax` 3, 1 damage per arrow — trap 143)',
            'the body still counts in `totalEnemies()` through BOTH staging halves '
                + '(the 25-update "die" anim and the eleven-tick fade) — trap 87\'s two '
                + 'fenceposts, now with a third: `endAnim` and `removed()` are not the '
                + 'same instant either',
        ]),
    }),

    /**
     * ⛔ WHAT THIS SLICE DOES *NOT* CLAIM, so the next one starts from a
     * refusal rather than from a rediscovery.
     */
    refusedHere: Object.freeze([
        Object.freeze({
            what: '`KILL_ARM_POLICY.Bob` -> `modelled`',
            why: 'an arrow kill is not a PRESS. The row\'s stated debt is the cadence a '
                + 'player press needs against a MOVING body (`combatVerbs.killWindowTicks` '
                + 'from a stance the router picks); nothing in this slice drives one, and '
                + 'a refusal retired without a driven witness is trap 101. The DAMAGE '
                + 'model and the death staging this slice builds are what a later press '
                + 'arm will reuse — that is the half that is paid.',
        }),
        Object.freeze({
            what: 'a static "Enemy" body\'s own death by arrow (SandTrap)',
            why: 'its clear is DECLARED by the tape (`r7-act2-8`\'s v9 `at` rows) and the '
                + 'declaration is the single writer of that flag. Computing it here would '
                + 'make TWO writers of one persistence slot — two cost models that must '
                + 'agree, which is one cost model. The body is an arrow STOPPER (which is '
                + 'strictly more accurate than today, where arrows fly through it) and '
                + 'its damage is refused by name, bounded by `roomScope` above.',
        }),
    ]),
});

/**
 * ⛔ THE ARROW'S TARGET PARTITION IS TOTAL, AND IT IS CHECKED — `Arrow`'s own
 * `hitables` list against the dispositions this model gives them.
 *
 * `Arrow.as:17` is `["Player", "Enemy", "Tree", "Solid", "Shield"]` and the
 * switch in `update()` has TWO arms and a `default:` — so three of the five
 * take no damage and STOP THE ARROW ANYWAY (the removal is
 * `if (hits.length > 0)`, outside the switch). A model that priced only the
 * damaging arms would fly its arrows through cover, and cover is a resource.
 *
 * @param {object} dispositions `{[hitableType]: 'damaged'|'stops'|'priced-elsewhere'}`
 */
export function assertArrowTargetPartition(dispositions, hitables) {
    if (!dispositions || typeof dispositions !== 'object') {
        throw new Error('assertArrowTargetPartition: pass the disposition map');
    }
    if (!Array.isArray(hitables)) {
        throw new Error('assertArrowTargetPartition: pass `ARROW.hitables` — the list is '
            + 'the transcription\'s, never a copy typed beside this check (trap 89).');
    }
    const declared = Object.keys(dispositions).sort();
    const want = [...hitables].sort();
    const missing = want.filter((t) => !declared.includes(t));
    const extra = declared.filter((t) => !want.includes(t));
    if (missing.length || extra.length) {
        throw new Error('R8_ARROW_ENEMY: the arrow\'s target dispositions do not partition '
            + `\`ARROW.hitables\`. Unclassified: ${missing.join(', ') || 'none'}; not a `
            + `hitable: ${extra.join(', ') || 'none'}. "Everything not listed takes no `
            + 'damage" is the safe-sounding rule and it is the one that cannot be diffed '
            + 'against the AS3.');
    }
    const known = new Set(['damaged', 'stops', 'priced-elsewhere']);
    for (const [t, d] of Object.entries(dispositions)) {
        if (!known.has(d)) {
            throw new Error(`R8_ARROW_ENEMY: "${t}" has disposition "${d}", which is not `
                + `one of [${[...known].join(', ')}].`);
        }
    }
    return { types: declared.length };
}

/**
 * ⛓⛓⛓ R8 SLICE 3b — THE EXECUTORS UNDER THE RULED DESIGN, AND THE
 * PREDICTION IS COMMITTED BEFORE THE FIRST EXECUTOR MOVES.
 *
 * Slice 3 stopped at a genuine design question (kickoff §11.8) and the
 * orchestrator RULED it (§11.8a). This slice is implementation against that
 * ruling, and what the ruling settles is carried HERE AS DATA rather than as
 * prose in a docblock, for the reason trap 119 keeps proving: a rule
 * consumed by a branch buried in one function lets a consequence go
 * unreported, and a claim quietly absent reads exactly like a claim that
 * passed.
 *
 * ── ⚖ RULING 1 — THE SHOVE DESTINATION IS THE POST-CONDITION ──────────
 *
 * A shove's `to` is never chosen by the verb and never by taste. It is
 * DERIVED from what the work order needs to be true afterwards, in one of
 * exactly three kinds. `SHOVE_POST_CONDITIONS` below is that partition, and
 * `assertShovePostConditionsTotal` is what keeps it one.
 *
 * ── ⚖ RULING 2 — THE PARAMETER-DERIVATION LAW ─────────────────────────
 *
 * Every strategy executor's free parameters derive from (i) the work order's
 * post-condition and (ii) the room's TRANSCRIBED mechanism data — never from
 * unstated policy. `hold.until` (slice 3, §11.7) is the precedent already
 * shipped: `ticks` became the BOUND and the stopping CONDITION became an
 * observation. `EXECUTOR_DERIVATIONS` records, per registered executor, what
 * each free parameter is derived FROM — and
 * `assertExecutorParametersAreDerived` asserts the registry and this table
 * are ONE key set, so an executor registered without saying where its
 * numbers come from is a named failure rather than a silence.
 *
 * ── ⚖ RULING 2's LADDER — the combat policy's decision order ──────────
 *
 * AVOID -> TIME -> BAIT -> KILL, cheapest first, and **each escalation is a
 * trace row naming the cheaper rung it refused**. `ESCALATION_LADDER` is the
 * order as data; `assertEscalationIsOrdered` asserts a run of escalations
 * only ever moves up it and that every escalation names its predecessor's
 * refusal — a ladder whose rungs can be taken out of order is four
 * independent policies wearing one name.
 */
export const R8_STRATEGY_EXECUTORS = Object.freeze({
    item: Object.freeze({
        id: 'strategy-executors-under-11-8a',
        what: 'register `shove` (the destination DERIVED from the post-condition), the '
            + '`kill` strategy (the room\'s own weapon, held until an OBSERVED count '
            + 'reaches zero) and the `bait` stance (derived per `ARROW_KILL_PLAN.baitRule` '
            + '+ `presserSafety`), and wire the AVOID -> TIME -> BAIT -> KILL ladder as '
            + 'the combat policy\'s decision order',
        why: 'slice 2 left COMPUTED work orders and slice 3 discharged the first of them '
            + '(`hold`). What stopped slice 3 was not a mechanism but a DESIGN question '
            + 'with two working answers (§11.8); §11.8a ruled it, so this slice is '
            + 'implementation. The rooms are L4 (shove), L5 (bait + the kill-lock), L6 '
            + '(the timing escalation) and L8 (two shoves, two clears).',
        cite: 'kickoff §11.8a (the rulings), §11.7 (the derived-parameter precedent), '
            + '§10.4 note 4 (the strategy seam), §9.9 (the danger map)',
    }),

    /**
     * ⚖ RULING 1, AS A PARTITION. Three kinds, and the third is the only one
     * allowed to name a destructive cell on purpose.
     *
     * ⛔ DESTRUCTION IS NEVER A SIDE EFFECT. A pit/water/lava resting cell is
     * reachable by kind `dispose` (the post-condition names it) or by kind
     * `clear-path` as an explicit LAST RESORT when no non-destructive cell
     * yields a path first — and then the trace flags the IRREVERSIBILITY,
     * because a destroyed block is gone for the visit (it cannot press, it
     * cannot wall a chaser — `Bob.as:39` pushes "Enemy" — and it cannot be
     * pushed again) while a parked one keeps all three.
     */
    shovePostConditions: Object.freeze({
        'clear-path': Object.freeze({
            derives: 'k = the MINIMUM tiles such that a valid path exists with the block '
                + 'hypothesised at cell k, queried offline against the full-bag path',
            destinationIsDestructive: 'last resort only, and the trace flags it',
            room: 'L4 (`pushableblock@32,64`), L8 (`pushableblock@112,48`)',
        }),
        press: Object.freeze({
            derives: 'the BUTTON\'s cell, from the puzzle step that wants it held',
            destinationIsDestructive: 'never — a sunk block presses nothing',
            room: 'none on this battery; L41\'s `pushableblockfire@176,176` is the shape',
        }),
        dispose: Object.freeze({
            derives: 'the destructive terrain the post-condition NAMES — `shove-sink` '
                + 'exists for exactly this',
            destinationIsDestructive: 'yes, BY THE POST-CONDITION',
            room: 'L8\'s second block (`pushableblock@96,112` into the water at (5,7)), '
                + 'whose removal is what un-shadows `sandtrap@96,128` from the arrows',
        }),
    }),

    /**
     * ⚖ RULING 2's LADDER, as the ORDER. Cheapest first; an escalation is a
     * trace row carrying the refused cheaper rung's reason.
     */
    ladder: Object.freeze([
        Object.freeze({
            rung: 'avoid',
            tool: 'a static re-plan with the danger map\'s hard verdicts forbidden',
            refusesWith: 'no admissible corridor exists with the threatened cells removed',
        }),
        Object.freeze({
            rung: 'time',
            tool: '`mover.findEarliestArrival` with `forbiddenByDanger` as `forbiddenAt` '
                + '(ABSOLUTE ticks); the certificate\'s spans become the movement and '
                + '`certifiedAgainst` names the timeline',
            refusesWith: 'the search returns a NEGATIVE, which always names its own bound',
        }),
        Object.freeze({
            rung: 'bait',
            tool: 'a stance derived per `ARROW_KILL_PLAN.baitRule` (the body->player '
                + 'straight line crosses a lane) under `presserSafety` (`lanesOver` EMPTY '
                + 'at the stance — trap 154: a stance safe to PASS is not safe to WAIT in)',
            refusesWith: 'no stance both pulls the body through a lane and is itself '
                + 'outside every lane',
        }),
        Object.freeze({
            rung: 'kill',
            tool: 'the ROOM\'S OWN WEAPON — hold the presser whose group arms the traps '
                + 'whose lanes cover the body, until an OBSERVED count reaches zero '
                + '(`hold.until`, the §11.7 precedent). A PRESS arm is a `KILL_ARM_POLICY` '
                + 'question and stays refused unless a room actually needs one.',
            refusesWith: 'no presser in the room arms a lane over the body, or the class '
                + 'has no modelled kill arm and no ceiling covers it',
        }),
    ]),

    /**
     * ⛓ RULING 2's LAW, per executor. The KEY SET is asserted equal to
     * `solverBot.STRATEGY_EXECUTORS`, so registering an executor without
     * saying where its numbers come from is a named failure.
     */
    executorDerivations: Object.freeze({
        collect: Object.freeze(['the placement the goal already named (bound, not derived)',
            'the stance: nearest walkable ring cell whose corridor PLANS']),
        chest: Object.freeze(['the placement the goal already named (bound, not derived)',
            'the stance: `chestStanceBand`\'s own arithmetic, top row']),
        hold: Object.freeze(['the presser: the frontier\'s own blocker id',
            'the stance: lattice cells whose player box overlaps the presser rect, '
                + 'reachability probed by `planWaypoints` itself',
            'the length: `ticks` is a BOUND from the mechanism (`activators.opensOnTick` '
                + 'or the arrow-kill floor); the stopping CONDITION is OBSERVED (§11.7)']),
        shove: Object.freeze(['the direction: the only axis whose near-side stance is '
                + 'REACHABLE from the live position',
            'the destination: `k` from the post-condition (`shovePostConditions`)',
            'the stance: the block\'s own near-side cell — `runShove`\'s lean needs the '
                + 'player box on the block\'s +-1 px probe with velocity into it']),
        /**
         * ⛓⛓⛓ PROCGEN PoC SLICE 3b (⚖ kickoff §1.9) — `weigh`, and it owes
         * this row for a reason worth stating: it is a COMPOSITION of two
         * registered verbs, so a reader could reasonably assume it derives
         * nothing of its own. It derives two things, and both come from
         * mechanisms rather than from choices.
         *
         * ⛔ ITS DESTINATION IS THE ONE THING THAT SEPARATES IT FROM `shove`.
         * A `shove` derives `k` from a POST-CONDITION (`clear-path`'s minimum
         * tiles); a `weigh` is HANDED its destination by the mechanism — the
         * presser's own cell — and derives only which block and which lean can
         * reach it. That is why the two share `runShove` and not a resolver.
         */
        weigh: Object.freeze(['the destination: NOT derived — the presser\'s own tile, '
                + 'handed over by the mechanism (`press`, ⚖ §11.8a\'s third post-condition)',
            'the block and the direction: the only (block, axis) pair that already shares '
                + 'a coordinate with the presser AND whose every intermediate cell is '
                + 'free — a lean moves a block along ONE axis, so this is a filter, not '
                + 'a scan',
            'the stance: the block\'s own near-side cell, exactly as `shove` derives it — '
                + 'one lean, one implementation (`runShove`)',
            'the length: `ticks` is `deriveHold`\'s BOUND for the same group '
                + '(`activators.opensOnTick`), and the stopping CONDITION is OBSERVED — '
                + 'the group\'s shut responders opening (§11.7). ⛓ Waited out by '
                + '`runDwell` rather than `runHold`, because the whole point is that '
                + 'NOBODY is standing on the presser: the block is']),
        kill: Object.freeze(['the weapon: the presser group whose armed traps\' lanes '
                + 'cover the target body (`arrowTrap.lanesOver`)',
            'the stance: `presserSafety` — `lanesOver(playerBox)` EMPTY at the hold point',
            'the length: OBSERVED — the room\'s own count reaching zero, plus the '
                + 'responder\'s own fade (`ARROW_KILL_PLAN.lockFadeTicks`)',
            '⛓ R8 slice 7 — the PRESS arm: the weapon is the SWORD, so the stance is the '
                + 'ANNULUS between `spinner.hammerReach` (13 px, the union over all 45 '
                + 'phases) and `presses.SLASH_REACH` (16 px from the player POINT to the '
                + 'body RECT), chosen by argmax of the minimum clearance the room\'s own '
                + '`run.spinnerForecast` leaves over the horizon; the cadence is the '
                + 'RECEIVER\'s `hitsTimerMax`, and completion is OBSERVED (the body gone '
                + 'from `run.spinnerBodies`)']),
        /**
         * ⛓⛓⛓ R8 SLICE 7 — THE THREE D2's LAST ROOMS NAME. Written at step 0,
         * before a line of any of them moved, which is what makes the pending
         * list a work order rather than a report.
         */
        fight: Object.freeze([
            'the stance: the lattice cell UNDER `shieldBossBandRect`\'s own x span — the '
                + '48x16 strip below the body, which is both the trigger volume of the '
                + 'stand-under and the damage volume of the stab',
            'the press ticks: `shieldBossWindowFor`\'s `[windowFrom, windowTo]`, read off '
                + 'the run\'s own `shieldBossStabs` row rather than counted twice, with '
                + 'the press tick the EARLIEST T whose five dispatches (`SLASH_HIT_TICKS`, '
                + 'because `slashDelayMax` is ZERO) all land inside it',
            'the length: OBSERVED — `run.shieldBossKills`\'s `removeRequested` row plus '
                + 'ONE tick, because `updateLists()` drains `_remove` AFTER `World.update` '
                + 'and the Player updates LAST (R6 §13.5\'s fourth instant)']),
        keylock: Object.freeze([
            'the gate: `Player.hasKey(keyType)` — a SAVE-FILE boolean the run carries as '
                + 'its own set, not one of the fourteen `botStatus.items` fields',
            'the stance: a cell from which the walk INTO the lock lands the player box on '
                + 'the lock\'s own `keyLine`, tested with `activators.keyLineTouches` (an '
                + 'INTEGER point test, never a rect overlap)',
            'the length: `activators.opensOnKeyTick(keyTimer, fade)` — 80, not a Lock\'s '
                + '101, because `keyTimer` runs first and the fade is 0.05 on a bare '
                + 'Number that really does go negative']),
        touch: Object.freeze([
            'the gate: `Player.hasShield` (the row\'s own `shield` field) — an INVENTORY '
                + 'flag, and a run without it resolves to a refusal naming the item',
            'the stance: a cell from which the PINNED box overlaps the row\'s own '
                + '`touchRect`, which is the lock\'s rect shifted one pixel — '
                + '`collide("Player", x - 1, y)`. The lock is SOLID, so the band is one '
                + 'pixel wide and a derivation probing cell CENTRES finds nothing',
            'the window: `activators.opensOnTick` over the row\'s own fade — 101 ticks '
                + 'during which `receiveInput` is FALSE, so nothing is pressed and the '
                + 'whole window is ONE span (trap 16)']),
    }),

    /**
     * ⛔ THE FORK, STATED FIRST — `outcome` is written BESIDE this, never
     * over it (the R6/R7/slice-1/slice-3 shape).
     */
    prediction: Object.freeze({
        statedAt: '2026-08-10, before the first executor moved',
        baseline: Object.freeze({
            commit: '34c709760', files: 242, tests: 6926, seconds: 362.72,
            note: 'MEASURED this session on the unmodified tree before anything moved — a '
                + 'gate with no baseline cannot attribute (trap 40). It reproduces slice '
                + '3\'s close numbers (242 / 6926) exactly, which is itself the check that '
                + 'the tree this slice starts from is the tree slice 3 closed on.',
        }),
        armA: '⛓ THE BATTERY CLOSES: `r8-solve-4`, `r8-solve-5`, `r8-solve-6` and '
            + '`r8-solve-8` are authored by the policy from the committed segments\' own '
            + 'v8 boot blocks and recorded BYTE-EXACT through the win-channel '
            + 'differential, with the 324 committed tapes unmoved (zero re-records). L4 '
            + 'closes on the shove alone; L6 closes on a rung ABOVE avoid; L5 needs bait '
            + 'and the kill-lock; L8 needs two shoves and two DECLARED clears.',
        armB: '⛔ a room refuses, and the REFUSAL is the deliverable. The ladder names '
            + 'which rung it reached and what the cheaper ones said, so a wall is a '
            + 'measurement with a rung number on it rather than a stall. A room that '
            + 'refuses is REPORTED, never recorded — a tape whose solution nobody '
            + 'designed is worse than a missing tape (§11.10.1).',
        expected: 'armA for L4 (the derivation is arithmetic over a corridor whose two '
            + 'candidate answers §11.8 already enumerated). armA for L6 and L5 with the '
            + 'ladder as designed. ⚠ L8 is the room this slice budgets FORMAT RISK for '
            + '(R7 §21.9 lesson 1): its two kills are a `SandTrap`\'s, whose arrow death '
            + 'this rung REFUSES to compute (§11.4), so its tape must DECLARE what the '
            + 'model cannot compute and a staged chain\'s witnessed-clear law then wants a '
            + 'witness for the declaration.',
        alsoPredicted: Object.freeze([
            'L4\'s derived `k` is 2 — block (2,4) -> (4,4) — with k=1 rejected for NO '
                + 'PATH (column 2 is walled at every row but (2,4), so the block at (3,4) '
                + 'is still the door) and k=3 rejected as the PIT at (5,4): destructive, '
                + 'and unneeded because k=2 already plans',
            'L8\'s first derived `k` is 2 — block (7,3) -> (5,3) — with k=1 rejected '
                + 'because (6,3) is IN column 6, the room\'s only way south',
            'both agree with the hand answers, and that agreement is INFORMATION rather '
                + 'than the justification (§11.8a ruling 1\'s own words)',
            '`KILL_ARM_POLICY.Bob` stays `refused` — arrows are the expected mechanism '
                + 'and no room on this battery needs a PRESS arm (trap 101)',
        ]),
    }),

    /**
     * ⛔ WHAT THIS SLICE DOES NOT CLAIM, stated before it is tempted to.
     */
    refusedHere: Object.freeze([
        Object.freeze({
            what: 'the `touch` executor',
            /**
             * ⛓⛓⛓ R8 SLICE 7 — THIS REFUSAL IS DISCHARGED, AND THE CONTROL IS
             * **REPLACED RATHER THAN DELETED** (§13.10's own instruction).
             *
             * `touch` was the live control for §10.4 note 4 from slice 2 to
             * slice 6 — a strategy the table NAMES and the registry LACKS —
             * and §15.2 measured why it kept missing its room: the three
             * gates are BEHIND the shield, so the segment that takes the
             * shield never meets the lock. Slice 7 crosses L20 WESTWARD,
             * which is the lock's own side, so the verb is registered and the
             * refusal flips.
             *
             * ⛔ A control deleted in the change that widens the claim is not
             * a control (trap 62), so `wandlock` takes its place: L40's
             * `wandlock` is a REAL obstacle with a REAL verb and no solver
             * executor, which is the same shape and not a synthetic one.
             */
            discharged: 'R8 slice 7 — registered, with L20\'s westward crossing as its '
                + 'driven witness',
            controlNow: 'wandlock',
            why: 'its obstacle is `solid:shieldlock`, which was read as L18\'s — kickoff '
                + '§4 slice 4 — and is really L20\'s (§15.2). It stayed '
                + 'SELECTED-AND-UNREGISTERED through slices 2-6 on purpose: it was the '
                + 'live control for §10.4 note 4\'s claim that a strategy may be named by '
                + 'the table and absent from the registry, and a control deleted in the '
                + 'change that widens the claim is not a control (trap 62).',
        }),
        Object.freeze({
            what: 'a static "Enemy" body\'s own death by arrow (SandTrap)',
            why: 'unchanged from §11.4 — its clear is the tape\'s DECLARED v9 `at` row and '
                + 'the declaration is the single writer of that flag. A solver tape for L8 '
                + 'declares it the same way a hand-authored one does; what the solver adds '
                + 'is that the declaration is now CHECKED against the model wherever the '
                + 'model can compute the consequence (§11.5).',
        }),
    ]),
});

/**
 * The three post-condition kinds are a PARTITION, and a shove plan's own kind
 * is checked against it.
 *
 * ⛔ "everything else is clear-path" is the safe-sounding default and it is
 * the one that cannot be diffed against the ruling — a `dispose` mis-typed as
 * `clear-path` would sink a block as a SIDE EFFECT, which is the one thing
 * ruling 1 forbids by name.
 */
export function assertShovePostConditionKind(kind, what) {
    const kinds = Object.keys(R8_STRATEGY_EXECUTORS.shovePostConditions);
    if (!kinds.includes(kind)) {
        throw new Error(`${what}: shove post-condition "${kind}" is not one of `
            + `[${kinds.join(', ')}]. ⚖ Kickoff §11.8a ruling 1: a shove's destination is `
            + 'the WORK ORDER\'s post-condition, and there are exactly three of them. A '
            + 'fourth is a design change, not a default.');
    }
    return kind;
}

/**
 * Every registered executor says where its free parameters come from —
 * ⚖ §11.8a ruling 2, asserted as ONE KEY SET rather than as a habit.
 */
export function assertExecutorParametersAreDerived(registry) {
    if (!registry || typeof registry !== 'object') {
        throw new Error('assertExecutorParametersAreDerived: pass '
            + '`solverBot.STRATEGY_EXECUTORS` — the running registry, never a copy typed '
            + 'beside this check (trap 89).');
    }
    const registered = Object.keys(registry).sort();
    const declared = Object.keys(R8_STRATEGY_EXECUTORS.executorDerivations).sort();
    const undeclared = registered.filter((k) => !declared.includes(k));
    /**
     * ⛓ THE TWO HALVES ARE NOT THE SAME CLAIM, and only one of them is a
     * defect. An executor REGISTERED with no derivation row is exactly what
     * ⚖ §11.8a ruling 2 replaced — numbers from nowhere anybody can name —
     * and it THROWS. A derivation row with no executor yet is this slice's
     * own WORK ORDER: the table is written at step 0, before a line of the
     * executor moves, and it is REPORTED so the pending list is a fact a
     * reader can see rather than a red that has to be tolerated.
     */
    if (undeclared.length) {
        throw new Error('R8_STRATEGY_EXECUTORS: the executor registry has row(s) with no '
            + `derivation. Registered with no derivation row: ${undeclared.join(', ')}. `
            + '⚖ §11.8a ruling 2 — an executor whose free parameters come from nowhere '
            + 'anybody can name is exactly the thing the ruling replaced.');
    }
    const pending = declared.filter((k) => !registered.includes(k));
    for (const [verb, rows] of Object.entries(R8_STRATEGY_EXECUTORS.executorDerivations)) {
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error(`R8_STRATEGY_EXECUTORS.executorDerivations.${verb} must list at `
                + 'least one parameter and where it derives from.');
        }
    }
    return { executors: registered.length, pending };
}

/**
 * ⛓⛓⛓ THE LADDER IS AN ORDER, AND AN ESCALATION RUN IS CHECKED AGAINST IT.
 *
 * Two claims, and they are different:
 *   1. the rungs a run took are a strictly INCREASING subsequence of
 *      `ladder` — a policy that reached `kill` without ever asking `avoid`
 *      is four policies wearing one name;
 *   2. every escalation NAMES the cheaper rung it refused, in `rejected` —
 *      which is the whole of ⚖ §11.8a's "each escalation is a trace row
 *      carrying the refused cheaper rung's reason".
 */
export function assertEscalationIsOrdered(escalations, what = 'the combat ladder') {
    const order = R8_STRATEGY_EXECUTORS.ladder.map((r) => r.rung);
    if (!Array.isArray(escalations)) {
        throw new Error(`${what}: pass the list of escalations the run took.`);
    }
    let last = -1;
    for (const e of escalations) {
        const i = order.indexOf(e.rung);
        if (i < 0) {
            throw new Error(`${what}: "${e.rung}" is not a rung of the ruled ladder `
                + `[${order.join(' -> ')}].`);
        }
        if (i <= last) {
            throw new Error(`${what}: escalated to "${e.rung}" (rung ${i}) after rung `
                + `${last} — the ladder is CHEAPEST FIRST and an escalation that goes `
                + 'down it, or sideways, is a policy choosing rather than escalating.');
        }
        if (i > 0 && !(e.refused && e.refused.rung === order[i - 1])) {
            throw new Error(`${what}: the escalation to "${e.rung}" does not name the `
                + `cheaper rung it refused. ⚖ §11.8a: every escalation is a trace row `
                + `carrying the refused rung's reason; got `
                + `${JSON.stringify(e.refused ?? null)}.`);
        }
        last = i;
    }
    return { rungs: escalations.length, deepest: last < 0 ? null : order[last] };
}

/**
 * ⛓⛓⛓ R8 SLICE 4 — THE TWO-PASS AUTHORING LOOP, THE BATTERY'S TAIL, AND THE
 * SHIELD. The prediction, committed BEFORE a line of the loop moves.
 *
 * ── WHY A LOOP AT ALL, IN ONE PARAGRAPH ───────────────────────────────
 *
 * `createLevelRun` takes `persistence` **AT CONSTRUCTION**. A goal behind a
 * lock the RUN's own walk opens therefore needs, as an INPUT, a tick that
 * only a solve can produce — the circle §12.10.3 named and refused to
 * half-build. The loop breaks it in the only honest order: solve with the
 * consequence UNDECLARED (the solver refuses at the shut gate, and the
 * refusal carries the ticks it did spend), read the opening tick from
 * whichever oracle can answer, DECLARE it as a v9 `at` row, and re-solve.
 *
 * ⛔ TWO SOURCES, AND WHICH ONE IS ALLOWED IS A PROPERTY OF THE MECHANISM,
 * NOT A PREFERENCE:
 *
 *   · MODEL-SOURCED — the run itself computes the consequence
 *     (`chaserKillLockOpens`, §11.5). L5's `lock@48,112` is the case: three
 *     arrow kills take `totalEnemies()` to zero and the model knows the
 *     removal tick. The declared tick is that removal PLUS the responder's
 *     own fade (`activators.opensOnTick`) — the model owns both halves.
 *   · GAME-SOURCED — §11.4 REFUSES to compute the consequence, so the model
 *     may not invent it. L8's two `SandTrap` clears are the case: a static
 *     `"Enemy"` body's arrow death is the tape's declared v9 row precisely
 *     so that ONE writer owns that persistence slot. The tick comes from the
 *     GAME's own `persistence_cleared`, read off truncated `--win` arms.
 *
 * ⛔ AND THE LOOP'S OWN HONESTY CHECK IS THE PREFIX, NOT THE OUTCOME. Pass 2
 * declares a clear at tick T that was measured on pass 1's walk. That is only
 * a measurement OF PASS 2 if the two walks agree up to T — the declaration
 * changes the world at T and cannot change it before. So the loop asserts
 * `pass2.perTick[i]` equals `pass1.perTick[i]` for every `i < T`, BY NAME. A
 * declared tick measured on a different walk is the exact defect this
 * machinery could otherwise manufacture silently.
 */
export const R8_TWO_PASS = Object.freeze({
    item: Object.freeze({
        id: 'two-pass-authoring-loop',
        what: 'build the solve -> read the opening tick -> declare -> re-solve loop ONCE, '
            + 'as solver-harness machinery, with both tick sources; register the `kill` '
            + 'executor for a KILL-LOCK work order (model-sourced) and for a STATIC body '
            + 'under the room\'s own ceiling (game-sourced); close the battery with '
            + '`r8-solve-5` and `r8-solve-8`',
        why: '§12.10.3 named the missing machinery exactly and refused to half-build it; '
            + '§12.10.2 measured L8\'s wall as the same shape one oracle over. Both rooms '
            + 'are COMPUTED work orders, so this slice is implementation.',
        cite: 'kickoff §12.10 (the two refusals), §11.4 (why the SandTrap arm is refused), '
            + '§11.5 (the kill-lock consequence as a CHECK), §12.8 (L5\'s work order)',
    }),

    /**
     * ⛔ NO NEW TAPE FIELD. The loop is planner/harness-side; what it emits is
     * a v9 `at` row, which the format has carried since R7 slice 6d.
     * `GAME_VISIBLE_DROPS` is a CLASSIFICATION list and this slice adds
     * nothing to classify — stated so the absence is a decision.
     */
    tapeFormat: 'UNTOUCHED — v9 `at` rows only; no field added, none reclassified',

    tickSources: Object.freeze({
        model: Object.freeze({
            oracle: 'the run\'s own ledger — `chaserKillLockOpens[].t` (the REMOVAL tick) '
                + 'plus `activators.opensOnTick(RESPONDERS[tag].fade)` (the responder\'s '
                + 'own fade, 101 for a `Lock`)',
            allowedWhen: 'the model COMPUTES the consequence end to end',
            room: 'L5 — `lock@48,112`, `tset == -1`, opened by three arrow kills',
            check: 'pass 2 recomputes the ledger and its tick must EQUAL the declared one',
        }),
        game: Object.freeze({
            oracle: 'the GAME\'s own `persistence_cleared`, read off TRUNCATED `--win` '
                + 'arms — the smallest tape length whose end-of-run readout carries the '
                + 'tag. A poll cannot answer this (`botStatus` is sampled on wall clock, '
                + 'so it measures a BAND); a truncation is a boundary.',
            allowedWhen: '§11.4 refuses the consequence, so the model may not invent it',
            room: 'L8 — `{8,0}` and `{8,1}`, two `SandTrap` bodies killed by '
                + '`arrowtrap@96,16`\'s column',
            check: 'the arm one tick BELOW the boundary must NOT carry the tag — a lower '
                + 'bound and an upper bound, or it is not a boundary',
        }),
    }),

    /**
     * ⛔ THE FORK, STATED FIRST — `outcome` is written BESIDE this, never over
     * it (the R6/R7/slice-1/3/3b shape).
     */
    prediction: Object.freeze({
        statedAt: '2026-08-11, before the loop, the `kill` executor or the D2 rooms moved',
        baseline: Object.freeze({
            commit: '01ea0f649', files: 242, tests: 6954, seconds: 354.80,
            note: 'MEASURED this session on the unmodified tree before anything moved '
                + '(trap 40). It reproduces slice 3b\'s close numbers (242 / 6954) exactly, '
                + 'which is itself the check that this slice starts from the tree slice 3b '
                + 'closed on.',
        }),
        armA: '⛓ THE BATTERY CLOSES 4/4 and D2 REACHES THE SHIELD: `r8-solve-5` and '
            + '`r8-solve-8` recorded BYTE-EXACT through the win-channel differential, and '
            + '`hasShield` flips NOT-HELD -> HELD inside a driven solver segment with the '
            + '`{20,2}` placement clear and the `save.rockSet` durable witness. Zero '
            + 're-records; the 326 committed tapes unmoved.',
        armB: '⛔ a room refuses and the REFUSAL is the deliverable, with its rung number '
            + 'and its missing mechanism named (§11.10.1 / §12.10.1: a tape whose solution '
            + 'nobody designed is worse than a missing tape). The two-pass loop itself is '
            + 'the slice\'s spine and lands either way — a loop that cannot be exercised '
            + 'on a real room is reported as such rather than shipped on synthetics.',
        expected: 'armA for L5 (the mechanism is measured: §11.1 already computes all '
            + 'three deaths on the HAND walk, and §12.8 computed the work order). armA for '
            + 'L8 (both shoves derive today; only the two declarations are missing). ⚠ D2 '
            + 'is where this slice budgets its FORMAT RISK, and the named risk is NOT the '
            + 'shield: it is L18.',
        alsoPredicted: Object.freeze([
            '⛓ L5\'s declared tick is the MODEL\'s and it is FAR BELOW `r7-act2-5`\'s '
                + 'committed `at: 737`, which §11.5 already showed is the end of a PHASES '
                + 'BLOCK measured by a truncated arm and therefore an UPPER BOUND. §11.5 '
                + 'predicts the write at ~379 from the hand walk; the SOLVER\'s walk is its '
                + 'own and will land its own tick. ⛔ `r7-act2-5` is NOT touched — no '
                + 're-record licence exists and its 737 is not this slice\'s to tighten.',
            '⛔ L18 IS THE RISK, and it is a KILL ARM: `lock@144,112` is `tset == -1` and '
                + 'the two bodies are SPINNERS. `MODELLED_ENEMY_CLASSES` already steps a '
                + 'spinner, but `KILL_ARM_POLICY.Spinner` is REFUSED — so the room needs a '
                + 'PRESS arm against a MOVING body, which nothing on this arc has ever '
                + 'driven. The conversion is licensed by §3.2 (a row may flip when the '
                + 'damage/death staging is transcribed, PAIRED and priced) and it is the '
                + 'one place this slice may have to report a wall instead.',
            '⛓ AND THE SPINNER\'S SECOND CONSEQUENCE IS MEASURED TO BE NIL IN L18: '
                + '`Spinner.removed()` writes `setPersistence(tag, false)` unconditionally, '
                + 'which would be a SECOND WRITER of a declared slot (§11.4\'s exact '
                + 'shape) — but both L18 placements carry `tag = "-1"`, so the write is a '
                + 'no-op. The bound is stated HERE, before the arm is built, because a '
                + 'room whose spinners DID carry tags is a different problem.',
            '⛓ the ShieldBoss needs no conversion — `KILL_ARM_POLICY.ShieldBoss` has been '
                + '`modelled` since R6 slice 5 and `shieldBossFight.js` simulates the '
                + 'encounter. What is new is the POLICY reaching for it: an '
                + 'opportunistic-attack rung whose completion is OBSERVED, under R6 trap '
                + '85\'s cadence (one press is five dispatches; hit 1 arms him and hit 2 '
                + 'of the SAME press retaliates).',
            '⛓ `touch` STOPS being the unregistered control, because L20\'s '
                + '`shieldlocknorm@176,16` is its room — and the control is REPLACED, not '
                + 'deleted (trap 62): a strategy named by the table and absent from the '
                + 'registry has to keep having a live example, and L40\'s `wandlock` is a '
                + 'real obstacle with a real verb and no solver executor.',
            '⛔ the D2 segments are STAGED chains, so `hasShield`\'s flip is REPORTED and '
                + 'NEVER CREDITED (§3.6 / §8.5). A staged boot cannot EARN; the claim this '
                + 'slice makes is the FLIP INSIDE THE DRIVEN WINDOW, stated exactly.',
        ]),
    }),

    /**
     * ⛔ WHAT THIS SLICE DOES NOT CLAIM, stated before it is tempted to.
     */
    refusedHere: Object.freeze([
        Object.freeze({
            what: 'tightening `r7-act2-5`\'s committed `at: 737`',
            why: 'no re-record licence exists this rung, and §11.5 recorded the gap as a '
                + 'FINDING rather than an edit. The solver tape declares its own honest '
                + 'tick; the hand tape keeps its upper bound.',
        }),
        Object.freeze({
            what: 'computing a `SandTrap`\'s arrow death',
            why: 'unchanged from §11.4 — its clear is the DECLARED v9 row and a second '
                + 'writer of one persistence slot is two cost models (trap 160\'s law one '
                + 'family over). The two-pass loop does not weaken this: it makes the '
                + 'declaration GAME-SOURCED rather than hand-typed.',
        }),
        Object.freeze({
            what: 'reading (c) — a joint hypothesis over all movable blocks',
            why: 'FENCED by the orchestrator at §12.2 and still not built speculatively.',
        }),
    ]),
});

/**
 * ⛓⛓⛓ R8 SLICE 5 — THE ETA-AWARE TRANSIT PROBE, AND THE TWO MODEL DEFECTS
 * THE REFUTED WALK WAS ACTUALLY MADE OF.
 *
 * ⚖ §13.10a RULED the fenced question (candidate (a), the eta-aware probe;
 * candidate (b), a fifth rung, REFUSED with its reason: a rung is a STRATEGY
 * and this is an INSTRUMENT). This constant is the slice's step 0: it is
 * committed BEFORE the arrow arm, the danger map or the probe move, because a
 * gate whose result predates the change is not a gate.
 *
 * ── ⛔⛔⛔ WHAT THE BANKED RECORDING SAYS WHEN IT IS ASKED PROPERLY ─────
 *
 * §13.2 localised the refutation to the corridor probe and FENCED the design.
 * Replaying the banked tape through the model — before anything moved —
 * localises it to THREE things, of which the probe is only the last:
 *
 *   a. ⛔ **THE PLAYER-ARROW BILL DOES NOT EXIST.**
 *      `arrowTrap.ARROW_PLAYER_ARM.damagePricedBy` names
 *      `combat.PUZZLEMENT_HAZARDS.arrowtrap` and `levelRun`'s own
 *      `applyArrowHit` repeats the claim in a comment — but
 *      `PUZZLEMENT_HAZARDS` is a CENSUS table that `levelRun` never reads for
 *      damage, and `applyPlayerHit`'s sources are `pulse`, `crusher`, `blast`,
 *      `bossShot`, `shieldBossStab`, `owlRock`, `owlGrenade`, `owlBody`,
 *      `enemy`, `chaser`, `bossLaser`, `bossBody` — **no `arrow`**. So the
 *      model's arrows STOP on the player and can never HURT them, and every
 *      `hits: 0` this arc has claimed in a room with a ceiling is vacuous on
 *      that one channel. `Arrow.as:49` calls `Player.hit`; the game bills it.
 *      ⇒ this is [[feedback_two_cost_models_must_agree]] with the second cost
 *      model MISSING — "priced elsewhere" was never checked against a caller.
 *
 *   b. ⛔ **A RUN-TIME-ADDED ARROW MOVES ON ITS SPAWN TICK IN THE MODEL AND
 *      NOT IN THE GAME.** `Engine.update()` runs `FP._world.update()` and
 *      calls `FP._world.updateLists()` AFTER it, so an entity added during a
 *      frame's update joins the update list at the END of that frame and its
 *      first `update()` is the NEXT one. `stepArrowTrapsNow` pushes the fresh
 *      volley into `flight` ABOVE the step loop, so every arrow in this model
 *      is exactly one 5 px move ahead of the game's.
 *
 *   c. the corridor probe collapsing the time axis — trap 161, §13.10a's charge.
 *
 * ── ⛓⛓⛓ THE ARITHMETIC THAT SAYS SO, TO SIXTEEN DIGITS ───────────────
 *
 * At t=206 the model and the recording agree exactly: `x = 65.05`,
 * `y = 56.39999999999999`, `vx = 1.45`. The GAME's arrow
 * `arrowtrap@64,48#14.0` is at `(68, 58)` on that frame; THIS MODEL's is at
 * `(68, 63)`, one move further down, and misses the player's box by **0.40
 * px** — which is why no probe alone could have made this walk safe, and why
 * gate (i) below cannot pass until (b) is fixed. With the game's arrow:
 *
 *   `knockbackDelta({65.05, 56.39999999999999}, {68, 58}, 5)`
 *      ⇒ dx = **-4.3951592784836375**, dy = **0** — the y impulse DROPPED by
 *        `KNOCKBACK_COMPARATORS.y`'s strict `>` at |cy| = 0.4768
 *   v.x = 1.45 - 4.3951592784836375, then `Mobile.friction()`'s
 *      `v.normalize(len - 0.25)` — a SCALE, not a subtraction — then
 *      `Mobile.moveX`'s 1 px sub-step accumulation
 *   ⇒ x = **62.35484072151636**
 *
 * ⚠ AND THE LAST DIGIT IS EARNED THREE TIMES OVER: typing `y = 56.4` for the
 * recording's `56.39999999999999`, or subtracting 0.25 from the component
 * instead of scaling the vector, or summing `x + v.x` instead of walking the
 * sub-steps, each lands 3 ulps away. Trap 118's law is what makes this a
 * measurement rather than a resemblance.
 *
 * — which is the recording's own `x` at t=207, digit for digit, and the walk
 * was NOT steering that tick because `Player.input()`'s `hitsTimer <= 0` gate
 * had just shut (`steerBlocked`). The game's whole divergence is accounted
 * for by (a) and (b) together, and neither is a design question: one is a
 * missing funnel the AS3 states and the other is FlashPunk's own add order.
 */
export const R8_ETA_PROBE = Object.freeze({
    item: Object.freeze({
        id: 'eta-aware-transit-probe',
        what: 'price a MOVING hazard along a corridor on the TIME axis: validate each cell '
            + 'at that cell\'s own ETA, with the ETAs derived from the controller that will '
            + 'drive; keep WAIT as the dwell-window union; then record `r8-solve-5` and '
            + '`r8-solve-8` and close the battery 4/4',
        why: '§13.2 fenced it and ⚖ §13.10a ruled it. Trap 161: a static corridor probe '
            + 'prices a whole column for all time, which is the honest answer to "may I '
            + 'WAIT here" and the wrong answer to "will an arrow be at this cell when I am".',
        cite: 'kickoff ⚖ §13.10a (the ruling), §13.2 (the deadlock), §13.1 (the '
            + 'refutation), §9.9 (the map\'s four decisions), §11.4 (the arrow x enemy arm)',
    }),

    /**
     * ⛔ NO NEW TAPE FIELD, again — the probe is planner-side and the two model
     * fixes are inside `levelRun`. `GAME_VISIBLE_DROPS` gains nothing to
     * classify, and `assertBatchIsModelSide` is the standing check that no
     * game-facing file (`tapeFormat.js`, `tapeRunner.js`) moved.
     */
    tapeFormat: 'UNTOUCHED — no field added, none reclassified',

    /**
     * ⛔ THE TWO DEFECTS, AS DATA, WITH THE MEASUREMENT THAT FOUND EACH — so
     * "the model was wrong" is a citation rather than a memory.
     */
    modelDefects: Object.freeze([
        Object.freeze({
            id: 'player-arrow-bill-missing',
            claimWas: 'ARROW_PLAYER_ARM.damagePricedBy = combat.PUZZLEMENT_HAZARDS.arrowtrap',
            truth: '`PUZZLEMENT_HAZARDS` is the CENSUS; no line of `levelRun` bills from it. '
                + '`applyPlayerHit` has no `arrow` source.',
            cure: 'a seventh funnel: `applyArrowHit`\'s Player arm calls `applyPlayerHit` '
                + 'with source `arrow`, force `ARROW.speed` (`v.length` at the call, before '
                + '`stepArrow` zeroes it), damage 1 (`Player.hit`\'s default — trap 143), '
                + 'and `from` = the ARROW\'s own entity point.',
            witness: 'the GAME reported `hits: 1` on `r8-solve-5` where the model reported 0',
        }),
        Object.freeze({
            id: 'arrow-moves-on-its-spawn-tick',
            claimWas: 'a fired volley is stepped by the same `stepArrowTrapsNow` call that '
                + 'created it',
            truth: '`Engine.update` calls `FP._world.updateLists()` AFTER `world.update()`, '
                + 'so an entity added during a frame is not in the update list until that '
                + 'frame ends. Its first move — and its first hit test — is the NEXT tick.',
            cure: 'the volley joins `flight` BELOW the step loop, not above it',
            witness: 'the game\'s arrow was at (68,58) on frame 206 where this model has it '
                + 'at (68,63) — and the 62.35484072151636 arithmetic above is exact',
        }),
    ]),

    /**
     * ⚖ §13.10a's shape, as data. The primitive is unchanged; what is new is
     * that the two DERIVED questions are named apart (trap 154) and the
     * transit one carries a clock.
     */
    ruledShape: Object.freeze({
        primitive: '`dangerAt(run, tick, box)` — time-indexed since §9.9; the STATIC '
            + 'CORRIDOR PROBE was the caller that collapsed the axis',
        transit: 'per CELL at that cell\'s ETA, ETAs from the controller\'s own arithmetic '
            + '(`botDriverV1.chooseHeld` + the run\'s own `stepV2` options) — never a '
            + 'cruder movement model (trap 118\'s direction, applied to time)',
        wait: 'the UNION over the dwell window, unchanged — an armed lane, and an arrow '
            + 'swept `speed x horizon`, are exactly that union',
        arrows: 'predicted by `stepArrow`\'s OWN arithmetic, cover included, never a '
            + 'summary — their flight does not read the player, so it is autonomous',
        optimismBound: 'the per-tick next-cell check stays live, so a planned gap that '
            + 'drifts under re-planning is caught at the tick it matters',
    }),

    /**
     * ⛔ THE TWO GATES ⚖ §13.10a NAMES, AND BOTH FIXTURES ARE ALREADY ON DISK.
     */
    gates: Object.freeze({
        negative: Object.freeze({
            fixture: 'fixtures/refuted/r8-solve-5.{tape,expectation}.json — TRACKED, '
                + 'because `NewDocs` is gitignored and a gate that reads a path a fresh '
                + 'clone does not have is a gate that disappears. The full bank (trace, '
                + '`--win` log) stays in NewDocs/plans/r8-slice4-l5-refuted/.',
            claim: 'the probe FORBIDS the refuted walk\'s own (cell, tick): the player box '
                + 'at x=65.05,y=56.4 on absolute tick 206, against '
                + '`arrowtrap@64,48#14.0` at (68,58) — the arrow that took the hit the '
                + 'recording carries at t=207.',
            andTheCollapse: 'the SAME box at the SAME position, asked at the tick the plan '
                + 'was made on, is CALM — which is what made the walk look safe and what '
                + 'makes this a measurement of the time axis rather than of the geometry',
        }),
        positive: Object.freeze({
            fixture: 'r7-act2-5 — the committed HAND walk',
            claim: 'the hand walk leaves `button@48,48` and takes ZERO hits, so a corridor '
                + 'EXISTS; under the probe the §13.2 deadlock dissolves as ARITHMETIC (the '
                + 'column\'s arrows clear the walked cells before the player\'s ETAs) '
                + 'rather than by relaxing anything.',
        }),
        mutations: Object.freeze([
            'ETA source degraded to a constant (every sample at the plan tick) ⇒ the '
                + 'negative gate goes GREEN-WRONG, i.e. the probe stops forbidding — RED',
            'the time axis collapsed (transit arm falls back to the swept box at horizon 0) '
                + '⇒ the negative oracle case reds',
            'the arrow prediction dropped to a straight line with no cover ⇒ a cell behind '
                + 'a torch is forbidden that the mechanism clears',
        ]),
    }),

    /**
     * ⛔ THE FORK, STATED FIRST — `outcome` is written BESIDE this, never over
     * it (the standing R6/R7/R8 shape).
     */
    prediction: Object.freeze({
        statedAt: '2026-08-11, before the arrow arm, the danger map or the probe moved',
        baseline: Object.freeze({
            commit: '6a3b234a7', files: 243, tests: 6978, seconds: 375.44,
            note: 'MEASURED this session on the unmodified tree before anything moved '
                + '(trap 40); slice 4\'s own close numbers are the expectation.',
        }),
        armA: '⛓ THE MODEL REPRODUCES THE RECORDING IT WAS REFUTED BY. With both defects '
            + 'fixed, replaying the banked `r8-solve-5` tape gives `hits: 1` at t=206 and '
            + 'x = 62.35484072151636 at t=207 — the game\'s own stream — and the full '
            + 'offline differential stays byte-exact at 328/328 with ZERO re-records. Then '
            + 'the probe\'s two gates pass, L5 and L8 record, and the battery closes 4/4.',
        armB: '⛔ a committed tape MOVES under the fix. Then the fix is either wrong or the '
            + 'roster was passing on two errors that cancelled, and the finding is REPORTED '
            + 'with the tape named — no re-record licence exists this rung, so a moved tape '
            + 'is a wall, not an edit.',
        expected: 'armA. The 62.35484072151636 arithmetic is not a hypothesis about the '
            + 'game — it IS the game\'s recorded digit, reached from the model\'s own '
            + '`knockbackDelta` and `applyFriction`. ⚠ The named RISK is arm B on L4/L5\'s '
            + 'committed tapes: shifting every arrow one tick shifts the ticks at which '
            + 'arrows kill bobs, and `r7-act2-4`, `r7-act2-5` and `r7-act2-full` are the '
            + 'three tapes slice 1 measured RED when the bridge first moved.',
        alsoPredicted: Object.freeze([
            '⛓ THE DEADLOCK DISSOLVES WITHOUT RELAXING THE STATE LAYER\'S HONESTY. '
                + '`lanesUnpublishedByLeaving`\'s "the column must be EMPTY first" gate was '
                + 'the STATE layer paying for a KINEMATIC question it could not ask '
                + '(§13.2\'s own words). Once the transit probe answers the kinematic half '
                + 'per ETA, that gate is REMOVED and the exclusion goes back to answering '
                + 'only the state question — the reading the docblock always claimed.',
            '⛔ AND THE ZERO-HIT CLAIM GETS ITS FIRST HONEST TEST IN AN ARROW ROOM. Before '
                + 'this slice a walk could stand in a falling volley and the model would '
                + 'report calm; `r8-solve-4`, `r8-solve-5` and `r8-solve-8` are the rooms '
                + 'where that mattered.',
        ]),
    }),

    /**
     * ⛔ WHAT THIS SLICE DOES NOT CLAIM.
     */
    refusedHere: Object.freeze([
        Object.freeze({
            what: 'a fifth ladder rung',
            why: '⚖ §13.10a REFUSED it by name: a rung is a STRATEGY and this is an '
                + 'INSTRUMENT. Putting a timing question behind an escalation would starve '
                + 'the rungs below it — BAIT stances and KILL approaches cross lanes too.',
        }),
        Object.freeze({
            what: 'auditing every other run-time-added entity for the same spawn-tick '
                + 'deferral',
            why: 'BOUNDED and NAMED rather than swept: this slice fixes the family the game '
                + 'refuted (`Arrow`). `iceTurretBlast`, the wand shots and the boss shots '
                + 'are the other run-time adds on the roster, and the ONE instrument that '
                + 'can answer for them is the differential — which every one of them '
                + 'already passes today. A sweep that changed them on this reasoning alone '
                + 'would be re-recording by argument.',
        }),
        Object.freeze({
            what: 'tightening `r7-act2-5`\'s committed `at: 737`',
            why: 'unchanged from §13.8 — no re-record licence exists this rung.',
        }),
    ]),
});

/**
 * ⛓⛓⛓ THE TRANSIT PROBE'S OWN NON-VACUITY — RE-EXPORTED, NOT DEFINED HERE.
 *
 * ⚠ THE DEFINITION MOVED TO `solverBot.js` (editor arc slice 1), and the
 * move was forced by a BROWSER: `solverBot` is the only caller, this module
 * imports `node:fs` for `assertBatchSitesCoverSource`'s source grep, and an
 * ES module runs its imports before any export is reachable — so importing
 * one pure assertion from here dragged `node:fs` into every browser that
 * loaded the solver, and the editor page died on it before its first line
 * ran. The same lesson `atlasSource.js` was split out for, one module
 * family along: "the function has no node dependency" and "the module can
 * be imported in a browser" are different claims.
 *
 * Re-exported so every existing importer of this module is untouched. ONE
 * definition, in the module that consumes it; no copy lives here.
 */
export { assertTransitSamplesCarryEtas } from './solverBot.js';

/**
 * ⛓⛓⛓ THE LOOP'S OWN NON-VACUITY, AS A FUNCTION — the prefix agreement.
 *
 * ⛔ A DECLARED TICK MEASURED ON A DIFFERENT WALK IS THE DEFECT THIS
 * MACHINERY MANUFACTURES IF NOBODY LOOKS. Pass 1 spends ticks with the
 * consequence undeclared; pass 2 spends them with a clear pending at `T`. The
 * declaration cannot reach the world before `T`, so the two runs must press
 * IDENTICAL keys on every tick below it. If they do not, the tick pass 2
 * declares was read off a walk pass 2 did not take.
 *
 * @param {Array<Set|Array>} first   pass 1's per-tick key sets
 * @param {Array<Set|Array>} second  pass 2's per-tick key sets
 * @param {number} declaredAt        the tick the clear is declared at
 */
export function assertTwoPassPrefixAgrees(first, second, declaredAt, what = 'the two-pass loop') {
    if (!Array.isArray(first) || !Array.isArray(second)) {
        throw new Error(`${what}: pass 1 and pass 2 must both hand over their per-tick key `
            + 'sets — the prefix agreement is the loop\'s only non-vacuity check.');
    }
    if (!Number.isInteger(declaredAt) || declaredAt < 0) {
        throw new Error(`${what}: the declared tick must be a non-negative integer; got `
            + `${JSON.stringify(declaredAt)}.`);
    }
    /**
     * ⛔ PASS 1 MUST REACH THE TICK IT MEASURED. A pass that refused BEFORE
     * `T` cannot have witnessed the consequence at `T`, and comparing a short
     * prefix would pass vacuously — which is the shape of a check that has
     * never seen a disagreement.
     */
    if (first.length < declaredAt) {
        throw new Error(`${what}: pass 1 spent only ${first.length} tick(s) but the clear `
            + `is declared at ${declaredAt}. The tick was measured on a walk that never `
            + 'reached it.');
    }
    if (second.length < declaredAt) {
        throw new Error(`${what}: pass 2 spent only ${second.length} tick(s) and the clear `
            + `is declared at ${declaredAt} — pass 2 never reached its own declaration.`);
    }
    const keysOf = (s) => [...s].sort().join('+');
    for (let i = 0; i < declaredAt; i += 1) {
        const a = keysOf(first[i]);
        const b = keysOf(second[i]);
        if (a !== b) {
            throw new Error(`${what}: pass 1 and pass 2 DISAGREE at tick ${i}, below the `
                + `declared tick ${declaredAt} — pass 1 held [${a || 'nothing'}] and pass 2 `
                + `held [${b || 'nothing'}]. A clear declared at ${declaredAt} cannot reach `
                + 'the world before it, so the two walks must be identical here. They are '
                + 'not, which means the declared tick was measured on a walk pass 2 did '
                + 'not take.');
        }
    }
    return { comparedTicks: declaredAt, pass1: first.length, pass2: second.length };
}

/**
 * ⛓⛓⛓ R8 SLICE 6 — D2 AND THE SHIELD: THE RUNG'S BOUNDARY TARGET.
 *
 * The prediction, committed BEFORE the press arm, the `touch` executor or a
 * D2 segment moved — a gate whose statement postdates the change is not a
 * gate (trap 40), and this rung's own history is that the fork is where the
 * finding lives (§9.1's missing family, §13.1's refuted walk).
 *
 * ── WHAT THE SLICE IS ─────────────────────────────────────────────────
 *
 * Three tracks, in the charge's order:
 *
 *   A. the PRESS ARM AGAINST A MOVING BODY — `KILL_ARM_POLICY.Spinner`
 *      `refused` -> `modelled`, with its own PAIR and a control;
 *   B. `touch` REGISTERED — the last unregistered executor, whose room is
 *      L20's `shieldlocknorm@176,16`;
 *   C. D2 ROOM BY ROOM from a STAGED POST-SWORD BOOT, to `hasShield`.
 */
export const R8_D2_SHIELD = Object.freeze({
    item: Object.freeze({
        id: 'd2-and-the-shield',
        what: 'convert the Spinner KILL arm (a PRESS against a body that moves every '
            + 'tick), register `touch`, and drive D2 — L18\'s kill-lock, L19\'s '
            + 'ShieldBoss and boss key, L20\'s shield — with the live solver from a '
            + 'staged post-sword boot',
        why: 'the rung\'s ruled boundary target (⚖ §6.4): `hasShield` EARNED by the new '
            + 'machinery, which is R6 debt 5 and the arc\'s oldest undischarged item.',
        cite: 'kickoff §13.10 (the banked recon), §R6 13.8 (the honest route), ⚖ §11.8a '
            + '(the executor law), ⚖ §12.2 (the hypothesis quantifier and its two '
            + 'guards), §14.6a (the staged `clears` provenance), §14.2 '
            + '(autonomy-given-the-walk)',
    }),

    /**
     * ⛔ NO NEW TAPE FIELD IS EXPECTED, and the absence is a prediction rather
     * than a note: D2's segments declare `clears` PROVENANCE on the chain row
     * (§14.6a, built) and v9 `at` rows in the tape (a channel that has existed
     * since R7). A despawn would need §14.6a condition 4's pre-agreed half —
     * which is unbuilt and FAILS CLOSED, so a segment that needs one reports
     * it rather than silently skipping the witness.
     */
    tapeFormat: 'UNTOUCHED — no field added, none reclassified; the despawn provenance '
        + 'half stays pre-agreed and unbuilt unless a D2 segment declares a despawn',

    /**
     * ── TRACK A: THE PRESS ARM, AND WHAT IT OWES ──────────────────────
     *
     * ⛔ THE MOTION IS ALREADY STEPPED AND IS NOT WHAT THIS CONVERTS.
     * `Spinner` is the ONE class that has had a `MODELLED_ENEMY_CLASSES` row
     * since R5 slice 13; `spinner.stepSpinner` walks it and
     * `spinner.hitSpinner` is `Enemy.hit` verbatim, DRIVEN ALREADY by the
     * pulser arm (`levelRun`'s `pulseReaches` enemy branch). What is refused
     * is the PLAYER's press, and the four things it owes are named here so
     * the conversion is a measurement rather than a policy edit.
     */
    pressArm: Object.freeze({
        row: 'KILL_ARM_POLICY.Spinner',
        was: 'refused',
        becomes: 'modelled',
        owes: Object.freeze([
            Object.freeze({
                id: 'five-dispatches',
                what: 'ONE PRESS IS FIVE HIT TESTS (`presses.SLASH_HIT_TICKS` = 5, '
                    + '`slashDelayMax` 0) and the count that LANDS is the RECEIVER\'s '
                    + 'answer, not the weapon\'s — traps 85 and 93. A `Spinner` sets '
                    + '`hitsTimer = 30` on a landing (`SPINNER.hitsTimerMax`), so tests '
                    + '2..5 of the SAME press are refused by the i-frame and one press '
                    + 'is one hit.',
                differsFrom: 'the Owl, whose `justKnock` arm sets no timer and takes all '
                    + 'five until the 16 px reach loses him (§14.4)',
            }),
            Object.freeze({
                id: 'the-body-moves-between-the-tests',
                what: 'a `Spinner` moves ~1 px per tick with no player term at all, and '
                    + 'the five tests are five consecutive TICKS — so the press census '
                    + 'needs a LIVE rect join, the FIFTH after the pushable, the ice '
                    + 'turret, the ShieldBoss and the Owl. ⛔ And it is the first whose '
                    + 'body moves for a reason that has nothing to do with the press: '
                    + 'the Owl moves BECAUSE test 1 shoved him.',
                cure: '`pressRespondersIn` gains a `spinners` arm on the same '
                    + '`{ ...r, rect: now.rect, live: true }` shape the four before it '
                    + 'use; `run.spinnerBodies` is the getter that feeds it.',
            }),
            Object.freeze({
                id: 'the-die-staging',
                what: '`CORPSE_COUNTING.Spinner` is a `fade` row — `Enemy.startDeath` '
                    + 'sets `destroy` on the killing blow and `Mobile.death`\'s ELEVEN '
                    + 'accumulated 0.1 subtractions remove the body '
                    + '(`SPINNER.deathTicks` 11, a LOOP and not a division). ⛔ There is '
                    + 'NO die ANIMATION stage, so §11.3\'s who-killed-it fencepost — an '
                    + 'arrow kill gets the anim\'s first update on the killing tick and '
                    + 'a press\'s would not — has NOTHING TO BITE here: the fade is '
                    + 'driven from the ENTITY half of `World.update`, not the graphic '
                    + 'half. That is the prediction, and `removalTicksAfterHit` refusing '
                    + 'an `animTicks` argument for a `fade` row is the check.',
                bounded: '§11.3 named the press side a BOUNDED VACUITY (36 vs an arrow '
                    + 'kill\'s 35) for `Bob`. This slice does not discharge it — a '
                    + 'Spinner is the wrong class to discharge it with, because its '
                    + 'shape has no animation stage at all. NAMED, not claimed.',
            }),
            Object.freeze({
                id: 'the-two-consequences',
                what: 'a Spinner death (a) moves `classCount(Spinner)`, so every '
                    + '`tset == -1` lock in the room can open — which is L18\'s WHOLE '
                    + 'SOLVE — and (b) writes `Game.setPersistence(tag, false)` from '
                    + '`removed()` under `doActions`.',
                computed: 'both, never asserted: `killLockLedger` for (a) and the run\'s '
                    + 'own `spinnerWrites`/`spinnerDeaths` for (b).',
            }),
        ]),
        /**
         * ⛔⛔⛔ AND THE PAIR, WITH THE CONTROL NAMED BEFORE IT IS BUILT.
         * A refusal retired without a driven witness is trap 101; a witness
         * that is a COUNT rather than a tick and a source is trap 113.
         */
        pair: Object.freeze({
            arm: 'a driven press in L18 recorded `--win --record --only=` byte-exact, '
                + 'asserting the TICK and the SOURCE of every landed hit (trap 113: a '
                + 'hit count is invariant under a permutation of its causes)',
            control: '`Jellyfish` — transcribed to the same depth in the same module as '
                + '`Bob`, `KILL_ARM_POLICY` `refused`, and it must STILL THROW BY NAME '
                + 'when a press reaches one. `assertKillArmPolicyCovers` keeps the '
                + 'partition total across the flip.',
            why: 'the same shape as §9.8\'s bridge pair: the class that is transcribed '
                + 'and NOT converted is the one place "transcribed" and "modelled" '
                + 'visibly differ.',
        }),
    }),

    /**
     * ⛔⛔⛔ THE EXPOSURE, MEASURED BY DRIVING THE COMMITTED ROSTER — this
     * slice's step 0, before a line of the arm existed.
     *
     * ⚠ THE ROOM LIST IS THE CHEAP QUESTION AND IT IS THE WRONG ONE. Ten
     * committed tapes fire a weapon press in a room that holds a spinner
     * (L39/L40/L92); what decides whether the arm can MOVE one is whether a
     * press really REACHES a body — `Player.slash`'s TWO gates, the rect and
     * then `FP.distanceRectPoint <= 16` (`presses.SLASH_REACH`), against the
     * body where it stands on that tick. Measured with `run.spinnerBodies`
     * (the read-only getter this step added) over every committed tape:
     *
     *   · ten tapes press in a spinner room;
     *   · TWO have a dispatch that reaches one — `r5-press-glide` and
     *     `r5-press-repeat`, both in L39;
     *   · under `hitSpinner`'s OWN gates those become **1 landing** and
     *     **2 landings** respectively, each taking a body to `hits 1/3`;
     *   · **NO committed tape kills a spinner with a press.** So no
     *     `classCount` moves and no `removed()` write is added anywhere on
     *     the roster — the whole exposure is a KNOCKBACK.
     *
     * ⛔ AND THE KNOCKBACK IS THE RISK, NOT THE DAMAGE. `Enemy.hit`'s force
     * for a sword is 5 against `SPINNER.moveSpeed` 1 with a friction FLOOR of
     * 1, so a landed press is ~20 ticks of a completely different trajectory
     * (`spinner.js`' own words). In L39 a spinner body is in the pushable
     * block's sweep (`pushableCtx().collides` consults `spinnerRectsNow`),
     * and `r5-press-glide` is a BLOCK-GLIDE tape. That is the whole of arm B.
     */
    pressExposure: Object.freeze({
        measuredAt: '2026-08-11, on the committed roster, before the arm moved',
        instrument: '`run.spinnerBodies` + `presses.slashRect`/`distanceRectPoint`, i.e. '
            + 'the shipped gates — never a second reading of them',
        spinnerLevels: Object.freeze([18, 39, 40, 92]),
        pressesInSpinnerRooms: Object.freeze([
            'r5-feather', 'r5-l40-join', 'r5-l40-part0', 'r5-l40-part5',
            'r5-l40-part5-control', 'r5-press-delay', 'r5-press-glide', 'r5-press-repeat',
            'r5-shaft', 'r5-shaft-control',
        ]),
        reaching: Object.freeze([
            Object.freeze({
                name: 'r5-press-glide',
                level: 39,
                withinReach: 5,
                landings: Object.freeze([
                    Object.freeze({ t: 108, id: 'spinner@112,88', hits: 1, killed: false }),
                ]),
            }),
            Object.freeze({
                name: 'r5-press-repeat',
                level: 39,
                withinReach: 10,
                landings: Object.freeze([
                    Object.freeze({ t: 108, id: 'spinner@112,88', hits: 1, killed: false }),
                    Object.freeze({ t: 192, id: 'spinner@224,112', hits: 1, killed: false }),
                ]),
            }),
        ]),
        killsOnTheRoster: 0,
        /**
         * ⛓⛓⛓ R8 SLICE 8 — THE TAPES ADDED **AFTER** THE PREDICTION, AND THE
         * FIRST ONE THAT KILLS.
         *
         * `reaching` above is slice 6's claim about the roster as it stood
         * *"before the arm moved"*, and `killsOnTheRoster: 0` is part of it —
         * so a slice-8 tape whose whole errand is killing two spinners cannot
         * be folded into that list without editing a prediction after its
         * measurement. `R8_ENEMY_BRIDGE.exposedAdded` is the precedent: a
         * SEPARATE list, one row per slice, added the first time the assertion
         * names it.
         *
         * ⛔ AND A KILL MUST BE STATED BEFORE IT IS MEASURED — the guard's own
         * words. These rows declare `killed: true` on the sixth landing of
         * each body, which is what makes the assertion's kill branch a check
         * on THIS list rather than a blanket refusal.
         */
        reachingAdded: Object.freeze([
            Object.freeze({
                name: 'r8-solve-18',
                level: 18,
                addedBy: 'R8 slice 8 (the honest L18)',
                why: 'the solver\'s own L18 segment: three landed presses per body under '
                    + 'the exact-hammer ingredient, `Game.totalEnemies()` to zero, and '
                    + '`lock@144,112` declared open — the first tape on the roster whose '
                    + 'press arm KILLS.',
            }),
        ]),
    }),

    /**
     * ⛔⛔⛔ §13.10's BANKED RECON IS REFUTED ON ONE ROW, AND THE REFUTATION IS
     * THIS SLICE'S FIRST FINDING — trap 159's shape, on a bound that was
     * written one class away.
     *
     * §13.10 measured L18's second consequence as NIL: *"`Spinner.removed()`
     * writes `setPersistence(tag,false)` unconditionally, and BOTH L18
     * placements carry `tag = "-1"`, so the write is a no-op and there is no
     * second writer."* The first half is exact and the conclusion does not
     * follow: **a −1 tag is not a no-op in this game**, it is an OUT-OF-BAND
     * WRITE, and this repo transcribed the arithmetic two rungs ago.
     *
     * ```
     *   Game.as:1823-1826  setPersistence(tag, o, _l = -1) ->
     *                      Main.levelPersistenceSet(_l >= 0 ? _l : Main.level, tag, o)
     *   Main.as:202        levelPersistence[i * Game.tagsPerLevel + j] = _t
     * ```
     *
     * `j = -1` is unchecked, so a kill in L18 lands on
     * `18 * 30 - 1` = the PREVIOUS level's LAST slot = **{17,29}**
     * (`outOfBandLedger.outOfBandFlagFor`).
     *
     * ⛓ AND `Spinner.check()` IS WHY THE GUARD DOES NOT SAVE IT.
     * `if (tag >= 0 && !Game.checkPersistence(tag))` — a −1 never enters, so
     * `doActions` is never cleared and `removed()` writes with it true. Read
     * off `Enemies/Spinner.as:47-64` this session, not remembered.
     *
     * ⛔ `KILL_SIDE_WRITES.Spinner.sentinel` calls the −1 arm *"a bounded
     * vacuity with no witness"* on the evidence that "every spinner in the
     * committed extract carries one" — true of the ATTRIBUTE and false of the
     * VALUE: L18's two carry `tag="-1"` explicitly. **D2 is the room that
     * makes the bound false**, exactly as L4's pits made slice 1's bound
     * false (trap 159), and the cure is the same one: BUILD the arm, do not
     * re-narrow the scope. `Spinner` joins `OUT_OF_BAND_WRITERS`, which
     * THROWS for an unclassified class — the registry doing its job on the
     * fourth member it was designed to catch.
     */
    outOfBand: Object.freeze({
        finding: 'a −1-tagged Spinner kill in L18 writes {17,29}, not nothing',
        arithmetic: 'level * TAGS_PER_LEVEL + (−1) = (level − 1) * 30 + 29',
        forLevel18: Object.freeze({ level: 17, tag: 29 }),
        guard: '`Spinner.check()` is `tag >= 0 && !checkPersistence(tag)`, so a −1 body '
            + 'is never despawned at build time and `doActions` stays true',
        refutes: 'kickoff §13.10\'s "the write is a no-op and there is no second writer"',
        cure: 'a `Spinner` row in `OUT_OF_BAND_WRITERS` (which throws for an '
            + 'unclassified class) plus the run reporting the write — the model must '
            + 'predict a `persistence_cleared` row the GAME will carry.',
    }),

    /**
     * ── TRACK B: `touch`, THE LAST EXECUTOR ───────────────────────────
     *
     * ⛔ THE MECHANISM IS `botDriverV2.runTouch` AND IT IS NOT RE-DERIVED —
     * §11.7's law (one implementation, whoever sequences it). What the
     * executor adds is the BINDING to live state: which lock, from which
     * stance, and a completion that is OBSERVED rather than counted.
     *
     * ⚠ AND THE TRAP-62 CONTROL MUST BE REPLACED, NOT DELETED. `touch` has
     * been the live witness for §10.4 note 4's claim that a strategy may be
     * SELECTED and not REGISTERED; the moment it is registered that witness
     * is gone, and §13.10 already names its replacement — L40's `wandlock`,
     * a real obstacle with a real verb and no solver executor.
     */
    touchExecutor: Object.freeze({
        verb: 'botDriverV2.runTouch',
        room: 'L20 `shieldlocknorm@176,16` (tile (11,1), `tset -2`, `persistTag 0`)',
        derived: Object.freeze({
            lock: 'the frontier\'s own blocker id, resolved against `world.activators` '
                + 'by `resolveTouchLock` — which REFUSES a tag with no `touchRect` by '
                + 'name, so "this obstacle opens on a touch" is the transcription\'s '
                + 'answer and not the table\'s',
            stance: 'NOT derived — `runTouch` walks its own approach into the lock\'s '
                + 'centre and is TAKEN OVER when the collide rect fires. The executor '
                + 'hands it the aim and the budget; a stance derived here would be a '
                + 'second cost model for the same approach.',
            completion: 'OBSERVED — the verb waits while `run.inputRefused` and asserts '
                + '`run.openActivators.has(lock.id)` afterwards. `Lock.activationStep` '
                + 'fades 0.01/tick and the window is ~101; the executor never counts to '
                + 'a number of its own (§11.7\'s precedent, one verb over).',
        }),
        controlReplacement: 'L40 `wandlock` — `OBSTACLE_STRATEGIES` names a strategy for '
            + 'it that `STRATEGY_EXECUTORS` does not register, so the '
            + 'SELECTED-but-not-REGISTERED claim keeps a live witness (trap 62).',
    }),

    /**
     * ── TRACK C: THE ROUTE, AS DATA ───────────────────────────────────
     *
     * §13.10's banked recon plus §R6 13.8's honest route, re-read against the
     * atlas THIS session (the anchors verify the DATA MODEL, not the prose):
     * every row below is checked entity-by-entity in `r8Acceptance.test.js`
     * against `atlasLevelSource`, so a map edit moves the statement out loud.
     */
    route: Object.freeze([
        Object.freeze({
            level: 18,
            size: '12x9',
            what: 'THE KILL-LOCK. `lock@144,112` is `tset -1` — no button in the game '
                + 'answers it; `checkEnemies()` opens it when `Game.totalEnemies()` '
                + 'reaches zero, and the room\'s two bodies are `spinner@48,96` and '
                + '`spinner@112,48`, both `tag="-1"`.',
            needs: 'the PRESS ARM (track A) + the two-pass authoring loop, because '
                + '`createLevelRun` takes `persistence` at construction and the lock\'s '
                + 'opening tick is the thing the solve derives (§13.3, MODEL-sourced: '
                + 'the run computes the removal and `activators.opensOnTick` the fade)',
            exit: 'teleporter@176,112 -> L19 (16,144)',
        }),
        Object.freeze({
            level: 19,
            size: '11x11',
            what: 'THE SHIELDSPIRE. `shieldboss@80,32` is a 48x48 Solid covering tiles '
                + '(5,2)..(7,4); `bosskey@96,64` (keyType 0) sits INSIDE that body at '
                + 'tile (6,4); `bosslock@48,32` is keyType 0, persistTag 1.',
            needs: 'a MODELLED kill arm driven as a FIGHT — `KILL_ARM_POLICY.ShieldBoss` '
                + 'is already `modelled` and `shieldBossFight.js` is stepped, so the '
                + 'press SCHEDULE is derived from the boss\'s own window arithmetic '
                + '(`shieldBossWindowFor`, `SHIELD_BOSS.swingTimeMax`), never copied '
                + 'from `plan-seedling-r6-shieldboss.mjs`. ⛔ Traps 85/93 bind: hit 1 of '
                + 'the FIRST press is swallowed by `activated`, and hit 2 of the SAME '
                + 'press finds him sitting and starts a RETALIATION stab.',
            oneSegment: '⛔ THE FIGHT AND THE CROSSING IT OPENS ARE ONE SEGMENT (trap '
                + '150): the boss\'s body IS the door — column 1 is stone at rows 7-8, '
                + 'so the north half is severed from the south — and re-entering the '
                + 'room respawns him while `{19,0}` stays cleared.',
            exit: 'stairsup@16,96 -> L20 (192,64)',
        }),
        Object.freeze({
            level: 20,
            size: '15x9',
            what: 'THE SHIELD. `shield@112,48` at tile (7,3) in the middle chamber, '
                + 'reachable from the L19 arrival at tile (12,4) with NO gate at all — '
                + 'the three gates are BEHIND it, and they are the way OUT to L13: '
                + '`shieldlocknorm@176,16` (11,1) -> `buttonroom@192,16` (12,1, `tset 0`, '
                + '`room -1`, so `localPublish` LATCHES group 0) -> `lock@32,80` (2,5) '
                + '-> the alcove (1,3),(2,3),(2,4) -> `stairsup@16,48` -> L13.',
            needs: '`touch` (track B) for the shieldlock, and a `hold` whose presser is '
                + 'the LOCK\'S OWN GROUP rather than the obstacle itself — the lock at '
                + 'the frontier is not a presser, and its opener is `buttonroom@192,16`, '
                + 'derived from the activator group `t = 0` the transcription already '
                + 'carries.',
            exit: 'stairsup@16,48 -> L13 (96,48)',
        }),
    ]),

    /**
     * ⛔ THE STAGED BOOT, DECLARED — and derived from the campaign's own latch
     * rather than invented. `r7-act2-11` is the last committed segment of
     * chain `act2-the-sword`, and its v8 boot block is the honest post-sword
     * state: `seam.items.hasSword` true, `persistence` [{5,0},{8,0},{8,1},
     * {10,0}], empty save arrays. D2's segments boot the SAME items and
     * persistence with their own room's arrival as `boot`.
     *
     * ⛔ A STAGED BOOT CANNOT EARN (§3.6). The chain kind is `staged`, so
     * `hasShield`'s flip, its `{20,2}` clear and `save.rockSet` are REPORTED,
     * never CREDITED — the honest credit waits for assembly. Stated exactly,
     * because the difference between "the solver took the shield" and "the
     * campaign reached the shield" is the whole of what staging costs.
     */
    stagedBoot: Object.freeze({
        derivedFrom: 'r7-act2-11 (the last committed segment of `act2-the-sword`)',
        items: 'hasSword true, everything else false — the campaign\'s own latch',
        persistence: '{5,0} {8,0} {8,1} {10,0} — the act2 chain\'s banked clears',
        whatIsNotDeclared: 'nothing about D2 itself: no spinner clear, no {19,0}, no '
            + '{20,2}, no key. Those are what the segments are FOR.',
    }),

    /**
     * ⛓⛓⛓ THE HEADLINE CLAIM, STATED EXACTLY AND NO MORE.
     */
    headline: Object.freeze({
        claim: '`hasShield` flips NOT-HELD -> HELD inside a DRIVEN SOLVER SEGMENT, with '
            + 'the `{20,2}` placement clear and the durable `save.rockSet` witness, all '
            + 'read from the game\'s own readouts through the differential.',
        credited: false,
        why: 'the chain is `staged` (§3.6): a staged boot can DECLARE a flag and cannot '
            + 'EARN one — what it skips is the REACHING. `goalEarnedWitness` still wants '
            + 'a flip between boot and latch, which a declaration cannot fake, so the '
            + 'MEASUREMENT is taken and the CREDIT is withheld.',
        durableWitness: '`save.rockSet` — `Shield.removed()` sets `Moonrock.beam`, which '
            + 'is a one-shot TRIGGER the moonrock consumes (trap 124); `rockSet` is the '
            + 'field that survives.',
    }),

    /**
     * ⛔ THE FORK, STATED FIRST. `outcome` is written BESIDE this, never over
     * it (the standing R6/R7/R8 shape).
     */
    prediction: Object.freeze({
        statedAt: '2026-08-11, before the press arm, the `touch` executor or a D2 '
            + 'segment moved',
        baseline: Object.freeze({
            commit: 'f42b1c985', files: 243, tests: 7028,
            note: 'MEASURED this session on the tree as slice 5 closed it, carrying only '
                + 'the read-only `run.spinnerBodies` getter this step added (trap 40).',
        }),
        armA: '⛓ THE PRESS ARM MOVES NO COMMITTED TAPE. All 332 tapes replay byte-exact '
            + 'with `KILL_ARM_POLICY.Spinner` modelled and the live rect joined into the '
            + 'press census, ZERO re-records — because the model\'s player stream '
            + 'already matches the GAME\'s on `r5-press-glide` and `r5-press-repeat`, '
            + 'and the game has always had this arm. Correcting a body whose divergence '
            + 'never reached the player cannot move the player.',
        armB: '⛔ `r5-press-glide` or `r5-press-repeat` MOVES. Then the model has been '
            + 'agreeing with the game by luck in L39 — the un-hit spinner sat where the '
            + 'hit one would have been for the ticks the block sweep asked about — and '
            + 'the finding is REPORTED with the tape named. No re-record licence exists '
            + 'this rung, so a moved tape is a WALL, not an edit.',
        expected: 'armA, and the reasoning is the measurement above: the two exposed '
            + 'tapes take ONE and TWO landings, no body dies, no `classCount` moves and '
            + 'no persistence is written. What changes is ~20 ticks of one body\'s '
            + 'trajectory per landing, in a room where that body is in a block\'s sweep. '
            + '⚠ THE NAMED RISK is exactly that sweep: `r5-press-glide` is a block-glide '
            + 'tape and the landing is at t=108.',
        alsoPredicted: Object.freeze([
            '⛔ THE OUT-OF-BAND WRITE IS REAL AND THE MODEL MUST PREDICT IT. A D2 kill '
                + 'in L18 writes {17,29}; the GAME\'s `persistence_cleared` will carry '
                + 'it, so a model that reports nothing fails the differential on the '
                + 'ledger rather than on the stream.',
            '⛓ L18\'s KILL-LOCK IS MODEL-SOURCED, not game-sourced. Unlike L8\'s '
                + 'SandTraps (§11.4 refuses their arrow death), this run computes both '
                + 'terms — the removal (the 11-tick fade after the third landed press) '
                + 'and `activators.opensOnTick`\'s 101-step lock fade — so '
                + '`twoPassSolve`\'s `model` arm applies and the `clears` provenance '
                + 'evidence must ADD UP (`removedAt + fade === at`, §14.6a condition 3).',
            '⚠ THE SEGMENT COUNT IS NOT PREDICTED. Segmentation is by PERSISTENCE (trap '
                + '150) and the rooms are cut at calm arrivals; how many segments D2 '
                + 'yields is a consequence of that rule, stated in the as-built rather '
                + 'than promised here.',
        ]),
    }),

    /**
     * ⛔ WHAT THIS SLICE DOES NOT CLAIM.
     */
    refusedHere: Object.freeze([
        Object.freeze({
            what: '`KILL_ARM_POLICY.Bob` -> `modelled`',
            why: 'unchanged from §11.10.5 and §12.10.5. This slice converts the class D2 '
                + 'NEEDS; a chaser press arm still owes the 25-tick die ANIMATION and '
                + 'the who-killed-it fencepost (§11.3\'s 36 vs 35), and a Spinner has '
                + 'neither — its `CORPSE_COUNTING` shape is `fade`. Converting Bob on '
                + 'this slice\'s evidence would be retiring a refusal by argument.',
        }),
        Object.freeze({
            what: 'the press side of §11.3\'s removal-delay fencepost',
            why: 'a BOUNDED VACUITY, carried forward with its bound RE-STATED rather '
                + 'than quietly inherited: the 36-vs-35 tick difference is about an '
                + '`anim+fade` class, and this slice drives a `fade` one. Naming it here '
                + 'is what keeps it from reading as discharged.',
        }),
        Object.freeze({
            what: 'the despawn provenance channel (§14.6a condition 4)',
            why: 'still a ledger with no caller unless a D2 segment declares a despawn. '
                + 'The shape is pre-agreed and it FAILS CLOSED — a staged chain whose '
                + 'tape declares one is refused by name today — so building it '
                + 'speculatively would be the very trap 119 the condition avoids.',
        }),
        Object.freeze({
            what: '`plannerObstacleAt`\'s legacy 8-of-14 forwarding',
            why: 'untouched since §8.3.1; the solver plans through the `liveBag` entry '
                + 'shape and never through the legacy one.',
        }),
    ]),
});

/**
 * ⛔⛔⛔ THE PRESS ARM'S EXPOSURE, RE-DERIVED BY DRIVING — never re-read from
 * the declaration it is checking.
 *
 * `R8_D2_SHIELD.pressExposure` is a claim about WHICH committed tapes can be
 * moved by converting `KILL_ARM_POLICY.Spinner`, and the only honest way to
 * check it is to replay the roster and ask the shipped gates. A tape that
 * starts reaching a spinner tomorrow — a re-planned leg, a new fixture — is a
 * tape nobody predicted (trap 89), and this is what says so.
 *
 * @param {object} io `{tapeNames, reachingSpinners}` — injected so the
 *   disagreement can be CONSTRUCTED; a default that read the real roster
 *   would make the mutation cases untestable (slice 1's own law).
 */
export function assertSpinnerPressExposureIsMeasured(io) {
    if (!io || typeof io.tapeNames !== 'function'
        || typeof io.reachingSpinners !== 'function') {
        throw new Error('assertSpinnerPressExposureIsMeasured: needs an io seam '
            + '{tapeNames, reachingSpinners}. `reachingSpinners(name)` must return the '
            + 'landings a replay measures — the SHIPPED gates, not a second reading of '
            + 'them.');
    }
    /**
     * ⛓ R8 SLICE 8: the prediction's own list PLUS the rows later slices
     * added, and the two are kept apart in the DECLARATION so that editing
     * one cannot silently edit the other.
     */
    const declared = R8_D2_SHIELD.pressExposure.reaching;
    const added = R8_D2_SHIELD.pressExposure.reachingAdded ?? [];
    const found = [];
    for (const name of io.tapeNames()) {
        const landings = io.reachingSpinners(name);
        if (landings && landings.length) found.push({ name, landings });
    }
    const declaredNames = [...declared, ...added].map((r) => r.name).sort();
    const foundNames = found.map((f) => f.name).sort();
    const missing = foundNames.filter((n) => !declaredNames.includes(n));
    const stale = declaredNames.filter((n) => !foundNames.includes(n));
    if (missing.length || stale.length) {
        throw new Error('R8_D2_SHIELD.pressExposure: the set of committed tapes whose '
            + 'press REACHES a live spinner is not the one declared. Undeclared and '
            + `reaching: ${missing.join(', ') || 'none'}; declared and no longer `
            + `reaching: ${stale.join(', ') || 'none'}. The prediction is a claim about `
            + 'WHICH tapes the arm can move (trap 89).');
    }
    for (const f of found) {
        /**
         * ⛔ THE KILL IS ASKED FIRST, AND THE ORDER IS THE POINT. A landing
         * that KILLS is a categorically different prediction from one that
         * knocks back — it moves `classCount` and writes persistence — so it
         * gets its own message rather than arriving as one unequal field
         * inside a row diff. Asked after the equality check this branch would
         * be UNREACHABLE (the declaration says `killed: false`, so a kill
         * fails the diff first), which is a guard that can never fire.
         */
        const addedRow = added.find((r) => r.name === f.name);
        if (f.landings.some((l) => l.killed) && !addedRow) {
            throw new Error(`R8_D2_SHIELD.pressExposure: "${f.name}" KILLS a spinner, and `
                + 'the declaration says the roster kills none. A kill moves '
                + '`classCount` and writes persistence — that is a different prediction '
                + 'from a knockback, and it must be stated before it is measured.');
        }
        /**
         * ⛓ AN ADDED ROW IS A NAMED TAPE, NOT A PER-LANDING TRANSCRIPT. The
         * prediction's own five rows carry `{t, id, hits, killed}` because
         * they were MEASURED BEFORE the arm moved and a drift there is a
         * refutation; a solver-authored tape's landings are re-derived by its
         * own producer script on every `--check`, so copying them here would
         * be a second copy of an artifact that already has a byte gate.
         */
        if (addedRow) continue;
        const row = declared.find((r) => r.name === f.name);
        const same = row.landings.length === f.landings.length
            && row.landings.every((l, i) => l.t === f.landings[i].t
                && l.id === f.landings[i].id
                && l.hits === f.landings[i].hits
                && l.killed === f.landings[i].killed);
        if (!same) {
            throw new Error(`R8_D2_SHIELD.pressExposure: "${f.name}" is declared to take `
                + `[${row.landings.map((l) => `${l.id}@t${l.t}`).join(', ')}] and really `
                + `takes [${f.landings.map((l) => `${l.id}@t${l.t}`).join(', ')}]. The `
                + 'TICK and the BODY are the claim — a right count with wrong ticks is a '
                + 'prediction about a different walk (trap 113).');
        }
    }
    return { reaching: found.length, tapes: foundNames };
}

/**
 * ⛔⛔⛔ R8 SLICE 7 — D2 COMPLETE: THE STANCE, THE FIGHT, AND THE WAY OUT.
 * THE PREDICTION, COMMITTED BEFORE A LINE OF IT MOVES.
 *
 * The rung's last working slice. Slice 6 discharged `hasShield` and left
 * three named work orders (§15.7): L18's stance annulus, L19's fight
 * schedule plus a `keylock`, and L20's WESTWARD crossing — which is
 * `touch`'s room. This slice takes all three and assembles them into the
 * machinery's first MULTI-SEGMENT staged chain.
 *
 * ⚖ TWO RULINGS TAKEN BEFORE ANY DESIGN (orchestrator/Fable, 2026-08-11, in
 * reply to this session's pre-design check-in). Both are recorded here as
 * DATA rather than as prose, because a ruling nobody derives a consumer from
 * is trap 119's shape:
 *
 *  1. **THE CHAIN'S ROUTE.** The charge's sketch — "L13's alcove → L18 → L19
 *     → L20 → west to L13" — inherited the pre-§15.2 framing and is NOT a
 *     route: `routeGraph` below is the measured D2 level graph, and **L13 has
 *     no edge to L18**. Option A is RULED: three CONTIGUOUS staged segments,
 *     L18 → L19 → L20, ending in L13. The chain ENDS in L13 and does not
 *     begin there.
 *  2. **THE FIGHT'S BLINDNESS IS PINNED, NOT CURED.**
 *     `dangerMap.staticEnemyDanger` skips `contactPricing(...).kind ===
 *     'boss'` BY NAME, and no other ingredient prices a ShieldBoss — so the
 *     solver walks into the stab's own 48x16 band with no refusal at all.
 *     A boss ingredient is REFUSED (the band is the fight's only stance;
 *     forbidding it would seal the room — §14.2's own law), and the
 *     blindness becomes an ASSERTION so a future ingredient reds this pin
 *     instead of silently sealing a room whose solve predates it.
 */
export const R8_D2_COMPLETE = Object.freeze({
    item: Object.freeze({
        id: 'd2-complete',
        what: 'derive L18\'s stance annulus and re-drive it HONEST (no `noDamage`), '
            + 'fight the ShieldBoss on a schedule derived from its own window '
            + 'arithmetic, register `keylock` and `touch`, cross L20 westward, and '
            + 'assemble the three segments into ONE staged multi-segment chain',
        why: 'the rung\'s boundary target is discharged, so what is left of D2 is three '
            + 'computed work orders and the close. This is the slice that turns the '
            + 'solver from a room-crosser into a campaign-crosser.',
        cite: '§15.7 (the three work orders), ⚖ §15.7a (the mechanism graph and the '
            + 'stance quantifier), ⚖ §11.8a (parameters from mechanism data), ⚖ §12.2 '
            + '(the hypothesis quantifier and its two guards), §14.6a (the staged '
            + '`clears` provenance), traps 85/93/113 (the fight), trap 150 (fight and '
            + 'crossing are ONE segment), trap 16/§15.4 (a tape\'s budget is SPANS)',
    }),

    /**
     * ⛔ ⚖ RULING 1's EVIDENCE, AS DATA — the D2 level graph, measured off the
     * atlas this session before a line moved.
     *
     * `assertD2RouteGraph` re-derives every edge from the level source, so
     * the claim "L13 has no edge to L18" is a MEASUREMENT of the running
     * atlas and not a second reading of the recon that produced it (trap 97).
     * The charge's own route text is carried in `charged` so the correction
     * is legible as a correction rather than as a silent substitution.
     */
    routeGraph: Object.freeze({
        charged: 'L13\'s alcove -> L18 (honest) -> L19 -> L20 (shield) -> west to L13',
        ruled: 'THREE CONTIGUOUS SEGMENTS: L18 -> L19 -> L20, ending in L13',
        edges: Object.freeze([
            Object.freeze({ from: 13, to: 14, via: 'stairsdown@32,32' }),
            Object.freeze({ from: 13, to: 20, via: 'stairsdown@96,32' }),
            Object.freeze({ from: 13, to: 0, via: 'stairsup@64,144' }),
            Object.freeze({ from: 18, to: 16, via: 'stairsdown@16,16' }),
            Object.freeze({ from: 18, to: 19, via: 'teleporter@176,112' }),
            Object.freeze({ from: 19, to: 20, via: 'stairsup@16,96' }),
            Object.freeze({ from: 19, to: 18, via: 'teleporter@0,144' }),
            Object.freeze({ from: 20, to: 19, via: 'stairsdown@192,48' }),
            Object.freeze({ from: 20, to: 13, via: 'stairsup@16,48' }),
        ]),
        /**
         * ⛔ THE TWO FACTS THAT MAKE THE CHARGED ROUTE UNWALKABLE, each with
         * the instrument that says so.
         */
        why: Object.freeze([
            Object.freeze({
                claim: 'L13 has NO edge to L18',
                instrument: '`assertD2RouteGraph` walks the atlas\'s own `to` attributes; '
                    + 'the only L13->L18 path is L13->L14->L15->L16->L18, three rooms this '
                    + 'slice is not charged with',
                consequence: '`SEAM_CHANNELS` puts `level`/`playerPositionX`/'
                    + '`playerPositionY` on the `boot` channel, so a chain with a gap '
                    + 'between segment N\'s exit and segment N+1\'s boot reds the seam — a '
                    + 'staged chain declares its FIRST boot and nothing else',
            }),
            Object.freeze({
                claim: 'L13\'s own arrival into L20 lands INSIDE the alcove, behind '
                    + '`lock@32,80`',
                instrument: 'the atlas: `stairsdown@96,32 {to: 20, playerx: 32, playery: '
                    + '48}` = tile (2,3), and the walkability probe puts `lock@32,80` at '
                    + '(2,5) as the alcove\'s only door',
                consequence: 'L13 -> L20\'s alcove as segment 1 is a DEAD END at the '
                    + 'start: the alcove opens only once the buttonroom latches, which is '
                    + 'the last thing the chain does. ⇒ the "L13\'s alcove first" reading '
                    + 'is ruled out, not merely unused.',
            }),
        ]),
        /**
         * ⛔ AND `r8-solve-20` CANNOT BE THE CHAIN'S L20 SEGMENT. It leaves by
         * the stairs it arrived on (`stairsdown@192,48 -> L19`, §15.2's own
         * choice), so the segment after it would have to boot in L19 — the
         * opposite direction. The charge pre-authorised the disposition and it
         * is taken: a NEW L20 segment for the chain, `r8-solve-20` untouched
         * as the standalone witness. Never bend a seam to fit a tape.
         */
        standaloneWitnessUntouched: 'r8-solve-20',
    }),

    /**
     * ⛔⛔⛔ THE STEP-0 FINDING, FOUND BY DRIVING THE INSTRUMENT THIS SLICE
     * WAS ABOUT TO LEAN ON — and it is a defect in what slice 6 shipped.
     *
     * `run.spinnerForecast(n)` builds `spinnerCtx()` **ONCE** and reuses it
     * for the whole horizon. That is right for the things the ctx freezes on
     * purpose (the pushables where the previous tick left them; the open
     * activator set) and WRONG for the one field in it that is a **ONE-TICK
     * TRANSIENT**: `beforeTypeFlip: firstTickInWorld`.
     *
     * `collidesSolid`'s `beforeTypeFlip` arm selects `objectSolids` instead
     * of `solids` — the world as it exists on its very first live tick, when
     * **no Tile is solid yet**. So a forecast taken on a level's FIRST tick
     * runs its entire horizon in a room with no walls: every spinner flies
     * straight through the geometry and never comes back.
     *
     * MEASURED, L18, `spinner@112,48`:
     *
     * ```
     *   forecast taken after 0 driven ticks   first divergence at tick 51
     *                                          driven y 20.6446 (reflected off
     *                                          the row-0 Stone), forecast
     *                                          y 19.9375 (through it)
     *   forecast taken after 1 driven tick    NO divergence over 120 ticks
     *   forecast taken after 2 / 10 ticks     NO divergence over 120 ticks
     *   the 1,200-tick orbit, from tick 0     x reaches -751 and +968 in a
     *                                          12-tile room
     * ```
     *
     * ⛔ AND THE CONSEQUENCE IS THE ONE §15.3.3 BUILT THE INGREDIENT TO
     * PREVENT. `dangerMap.spinnerDanger` is the `atEta` arm: it asks
     * `run.spinnerForecast(horizon)` for the body at the cell's own ETA. On
     * the first tick of a spinner room — which is exactly when the solver
     * plans its first corridor — the forecast puts the bodies OUTSIDE the
     * room, so the hammer disc overlaps nothing and the map calls the cell
     * the body is actually in CALM. A wrong "open" gets you hit.
     *
     * ⇒ THE LAW, general: **a ctx snapshot may freeze STATE, but never a
     * ONE-TICK TRANSIENT.** Freezing a transient does not make a forecast
     * slightly stale; it makes the transient true for ever.
     */
    forecastTransient: Object.freeze({
        instrument: 'run.spinnerForecast',
        field: 'beforeTypeFlip',
        source: 'levelRun.spinnerCtx() -> levelWorld.collidesSolid\'s '
            + '`beforeTypeFlip ? objectSolids : solids`',
        frozenCorrectly: Object.freeze(['pushables', 'openActivators', 'openBridges',
            'frozen']),
        frozenWrongly: 'beforeTypeFlip',
        measured: Object.freeze({
            level: 18,
            body: 'spinner@112,48',
            firstDivergenceTick: 51,
            drivenY: 20.644660940672694,
            forecastY: 19.937554159486147,
            cleanWhenTakenAfterTicks: Object.freeze([1, 2, 10]),
        }),
        consumers: Object.freeze(['dangerMap.spinnerDanger (the atEta arm)',
            'botDriverV2 (the block sweep\'s forecast)']),
        /**
         * ⛓ THE FIX IS NOT "REBUILD THE CTX EVERY STEP" — that would re-pay a
         * `normalizeLive` per forecast tick and would also unfreeze the two
         * things the block sweep deliberately holds still. It is to hand the
         * TRANSIENT its own lifetime: the flag is true for forecast step 1
         * iff it is true now, and false for every step after it.
         */
        fix: 'the transient gets its own lifetime — true on step 1 iff `firstTickInWorld`, '
            + 'false for every step after; the frozen STATE is untouched',
        /**
         * ⛔ THE PREDICTION'S FORK, and it is a real fork rather than a
         * formality.
         *
         * ARM A — no committed recording moves. No committed tape is a SOLVER
         * tape in a spinner room (`r8-l18-spinner-press` is a hand plan that
         * never asks the forecast; every `r5-*` spinner tape is hand-authored
         * and predates the solver), and the two consumers are both PLAN-TIME:
         * they change what a policy DECIDES, and a committed tape's inputs
         * are already decided. So `tapeRunner` stays byte-exact and the
         * battery's producer `--check` moves nothing.
         *
         * ARM B — a committed solver tape's producer drifts, which would mean
         * a plan on this roster was resting on the broken forecast. Recorded
         * as a possibility rather than dismissed: the honest answer is
         * whichever one the instruments give.
         */
        prediction: Object.freeze({
            armA: 'tapeRunner byte-exact and `solve-seedling-r8-battery.mjs --check` '
                + 'unchanged from the baseline below',
            armB: 'a committed solver tape\'s producer drifts ⇒ a plan on this roster '
                + 'was resting on the broken forecast, and that is the finding',
        }),
    }),

    /**
     * ⛔ THE BASELINE THE PREDICTION IS AGAINST, MEASURED THIS SESSION BEFORE
     * A LINE MOVED — including trap 169's KNOWN drift.
     *
     * `r8-solve-4` has drifted from its producer since slice 5 (§15.8): 255
     * ticks derived against the committed 253, because slice 5's three arrow
     * fixes moved L4's arrow kill 114 -> 116. It is REPORTED, NOT RE-DERIVED
     * — re-deriving means re-recording and no licence exists this rung. So
     * the baseline is "eight of nine byte-identical, `r8-solve-4` drifting",
     * and a slice-7 run that shows anything else has moved something.
     */
    producerBaseline: Object.freeze({
        at: '7a0009a92',
        byteIdentical: Object.freeze(['r8-solve-1', 'r8-solve-2', 'r8-solve-3',
            'r8-solve-7', 'r8-solve-9', 'r8-solve-10', 'r8-solve-11', 'r8-solve-6']),
        drifting: Object.freeze([Object.freeze({
            name: 'r8-solve-4', derived: 255, committed: 253, since: 'slice 5', trap: 169,
        })]),
    }),

    /**
     * ── THE EXECUTORS THIS SLICE OWES, AND WHAT EACH ONE'S PARAMETERS ARE
     * DERIVED FROM (⚖ §11.8a's law, applied ahead of the code) ──────────
     *
     * ⛔ `pending` IS THE LIST THAT MUST SHRINK TO EMPTY. Slice 3b's
     * `['kill', 'shove', 'touch']` is down to `['touch']` plus the two the
     * rooms of this slice name; a registration that changed nothing would
     * leave the same obstacle in the frontier's message.
     */
    executors: Object.freeze([
        Object.freeze({
            verb: 'kill',
            arm: 'press',
            room: 'L18',
            was: 'the ROOM\'S OWN WEAPON only (§12.6) — a presser whose group arms a trap '
                + 'whose lane covers the body',
            adds: 'the PLAYER\'s own press, against a body with a `modelled` '
                + '`KILL_ARM_POLICY` row (slice 6 flipped `Spinner`)',
            derivedFrom: '`spinner.hammerReach` (the 13 px disc — the union over all 45 '
                + 'phases, because `Game.time` counts DEAD FRAMES), `presses.SLASH_REACH` '
                + '(16), `SPINNER.hitsTimerMax` (30) and `run.spinnerForecast` — the '
                + 'orbit, which is AUTONOMOUS given the walk (`runRange` is 0, so the '
                + 'chase arm is dead code)',
        }),
        Object.freeze({
            verb: 'fight',
            arm: 'shieldboss',
            room: 'L19',
            was: 'nothing — `KILL_ARM_POLICY.ShieldBoss` has been `modelled` since R6 '
                + 'slice 5 and no executor ever drove one',
            adds: 'a PRESS SCHEDULE, derived',
            derivedFrom: '`shieldBossFight.shieldBossWindowFor` (the window a player-side '
                + '`hit()` sees `"movedShield"`), `SHIELD_BOSS.swingTimeMax` (120 '
                + 'CONSECUTIVE band ticks) and `shieldBossDeathSchedule` (the four '
                + 'instants). ⛔ NEVER a hand-tuned constant: the mutation is that '
                + 'replacing the derived window with a literal goes RED.',
        }),
        Object.freeze({
            verb: 'keylock',
            arm: null,
            room: 'L19',
            was: 'unregistered; ⚖ §15.7a ruling 1 names it as the `key` opener',
            adds: 'the bosslock, opened by standing on it holding key 0',
            derivedFrom: 'the activator roster\'s own `keyType`/`keyTimer`/`keyLine` — '
                + '`bosslock@48,32` carries `{keyType: 0, keyTimer: 60}` and '
                + '`activators.opensOnTick`\'s fade',
        }),
        Object.freeze({
            verb: 'touch',
            arm: null,
            room: 'L20',
            was: 'THE LIVE CONTROL for §10.4 note 4 (trap 62) since slice 2 — a strategy '
                + 'the table names and the registry lacks',
            adds: 'the latching TOUCH: `shieldlocknorm@176,16`, `t = -2`, gated on '
                + '`Player.hasShield`',
            derivedFrom: 'the activator roster\'s own `touchRect`/`shield`/`snapY`',
            /**
             * ⛔ THE CONTROL IS REPLACED, NOT DELETED (§13.10's own
             * instruction). L40's `wandlock` is a real obstacle with a real
             * verb and no solver executor, and it becomes the trap-62 control
             * the moment `touch` stops being one.
             */
            controlReplacedBy: 'wandlock (L40) — a real obstacle with a real verb and no '
                + 'solver executor',
        }),
    ]),

    /**
     * ⚖ RULING 2, AS THE THING IT IS: A PIN.
     *
     * ⛔ NOT A CURE. The 48x16 band below the body is the ONLY stance the
     * fight has — `hitPlayer` counts a player inside it for `swingTimeMax`
     * consecutive updates and that count is the only thing that opens
     * `movedShield` — so an ingredient that forbade it would make the room
     * unsolvable. A wrong "closed" seals the map (§14.2's law, and the arc's
     * accurate-wall-vs-permissive-refusal law behind it).
     *
     * ⇒ what stands in for the danger map here is named, and the blindness
     * is ASSERTED so a future ingredient reds this row and forces a conscious
     * decision about the fight's stance rather than quietly sealing a room
     * whose solve predates it.
     */
    bossBlindness: Object.freeze({
        level: 19,
        body: 'shieldboss@80,32',
        skippedBy: 'dangerMap.staticEnemyDanger — `if (pricing.kind === \'boss\') continue`',
        otherIngredients: 'none — (a) arrows, (b) placed puzzlement hazards, (c) stepped '
            + 'chasers, (d) crushers, (e) static "Enemy" census bodies and (f) live '
            + 'spinners are the whole union, and a ShieldBoss is in none of them',
        standsInFor: Object.freeze([
            '`shieldBossWindowFor` — the fight\'s own arithmetic, which is what decides '
                + 'the press schedule',
            '`run.shieldBossPresses` / the fight ledgers — every dispatch\'s TICK and '
                + 'SOURCE (trap 113), not a count',
            'the GAME\'s own `hits: 0` in the recording — which was always the oracle '
                + 'and is never vacuous (§14.1a\'s scoping)',
        ]),
        pin: 'dangerVolumes(L19) is EMPTY with the boss standing',
    }),

    /**
     * ⛔⛔⛔ TRACK A's OUTCOME — L18 IS **REPORTED, NOT RECORDED**, and the
     * refusal carries the rung it reached.
     *
     * ⚖ The orchestrator ruled the STRIKE SCHEDULE in (option A) and it is
     * BUILT — `derivePressKill` / `deriveStrike` / `deriveRefuge` /
     * `execKillByPress`, every quantity from mechanism data. What it cannot
     * yet do is CROSS the room, and the wall is named: the per-tick movement
     * that carries the player between strikes is a bounded-depth safe step,
     * and a bounded depth cannot see a corner a body takes twenty ticks to
     * reach. Driven, the schedule loiters, plans strikes, dodges — and then
     * walks into L18's south-west corner at (18.0,104.1) with
     * `spinner@48,96` closing from (34,113), where every one of the five key
     * sets the controller can produce lands the box inside a disc.
     *
     * ⇒ what the movement layer wants is the TIME rung's own instrument —
     * `mover.findEarliestArrival` with `forbiddenByDanger` as `forbiddenAt`,
     * whose ~48 px `MOVER_RANGE` is exactly a dodge's scale — driven INSIDE
     * the executor rather than as a corridor rung. That is the next slice's,
     * and it is a change to the movement layer rather than to this schedule.
     *
     * ⛔ NO TAPE. A room that refuses is REPORTED, never recorded (§11.10.1):
     * a tape whose solution nobody designed is worse than a missing tape, and
     * a walk that takes a hammer is not a solve at any tick count.
     */
    trackA: Object.freeze({
        room: 18,
        built: Object.freeze(['derivePressKill', 'deriveStrike', 'deriveRefuge',
            'execKillByPress', 'stepToward', 'safeStep', 'trainIsSafeHere']),
        recorded: null,
        wall: 'the per-tick movement between strikes is a bounded-depth safe step '
            + '(STEP_LOOKAHEAD = 4) and a bounded depth cannot see a corner a body takes '
            + 'twenty ticks to reach — driven, the walk reaches (18.0,104.1) with '
            + '`spinner@48,96` at (34,113) and every one of the five key sets lands in a '
            + 'disc',
        wants: '`mover.findEarliestArrival` with `forbiddenByDanger` as `forbiddenAt` '
            + '(⚖ §11.8a ruling 2\'s TIME instrument, ~48 px `MOVER_RANGE` — a dodge\'s '
            + 'own scale) driven INSIDE the executor, which is a movement-layer change '
            + 'and not a schedule one',
        census: 'annulusCensus — 60 walkable cells, 1 clear over the horizon, 0 striking',
        /**
         * ⛔⛔⛔ ⚖ USER DESIGN CORRECTION (relayed 2026-08-11, mid-slice) —
         * AND IT IS RIGHT, WITH BOTH HALVES MEASURED.
         *
         * *"The hammer spins in a predictable pattern. Opportunistic attack
         * means waiting until the hammer isn't in the way, or moving to where
         * the hammer won't be. Forbidding the whole disc the hammer passes
         * through is wrong."*
         *
         * §15.3.3's premise — *"the angle rides `Game.time`, which this model
         * does not carry, so the honest quantity is the UNION over all 45
         * phases"* — was true of the MODEL and false of the MECHANISM, and
         * that distinction is the whole correction. Source-verified in the
         * fork @ `7514b96`:
         *
         *   Spinner.as:71   `(Game.time % Game.timePerFrame) / timePerFrame * 2π`
         *   Game.as:846     `time += timeRate` — inside `Game.update()`, BELOW
         *                   the `if (blackCover <= 0) super.update()` gate, so
         *                   it advances on DEAD frames too
         *   Game.as:918/959 `timeRate` is written in exactly ONE place, inside
         *                   `cutscene[0]` (the opening scene), and reset to 1
         *   Game.as:490-497 `Game.time` IS `Main.time` — `SAVE_FILE.data.time`
         *
         * ⇒ outside that one cutscene the clock is `save.time + <world updates
         * since the boot>`: **deterministic given the walk**. The v8 seam
         * already CARRIES it (`SEAM_BOOT_SPEC`'s `time` row, `modelled: false`
         * — "comparable only under `Bot.pinDeadFrames`, it counts DEAD frames
         * too") and every tape pins dead frames. What the model does not do is
         * ADVANCE it.
         *
         * ⛔ AND THE RE-CENSUS SETTLES THE POLICY QUESTION. The same 60 cells
         * and the same forecast, priced against the exact hammer LINE instead
         * of the union disc over a 600-tick horizon:
         *
         *   priced by            clear for the horizon   ...AND 3 separated presses
         *   13 px disc (shipped)  1 (behind the kill-lock)            0
         *   exact hammer line     16                                  **3**
         *
         * — (6,3), (7,5) and (8,5), each with three opportunities on
         * `spinner@112,48`. A STATIC STANCE EXISTS. ⇒ this slice's own "no
         * static stance in L18" finding is WITHDRAWN as an artifact of the
         * conservative model, and the law it leaves behind is the
         * accurate-wall law biting the instrument written to honour it: **a
         * CONSERVATIVE INGREDIENT CAN MANUFACTURE A POLICY PROBLEM.**
         *
         * ⚠ NOT BUILT THIS SLICE, and the scope is why: it wants a `Game.time`
         * accumulator advanced per world update including dead frames (a new
         * MODELLED quantity where the seam transports one today), `hammerLine`
         * promoted from a bound to a CONTACT with `collideLine`'s integer
         * raycast, a ruling on whether it BILLS or refuses, ingredient (f) and
         * `TRANSIT_INGREDIENTS` re-derived from disc to line, and a DRIVEN
         * PAIR — a stand inside the disc at a predicted-safe angle window and
         * a control at a predicted-unsafe one — which is the only thing that
         * makes angle prediction a measured capability rather than a hope.
         */
        userCorrection: Object.freeze({
            what: 'the hammer spins in a PREDICTABLE pattern; forbidding the whole disc '
                + 'it passes through is wrong',
            clock: Object.freeze({
                deterministic: true,
                law: 'Game.time = save.time + <world updates since the boot>',
                src: Object.freeze(['Spinner.as:71', 'Game.as:846', 'Game.as:498',
                    'Game.as:918', 'Game.as:959', 'Game.as:490-497']),
                caveat: '`timeRate` is written only inside `cutscene[0]`, the opening '
                    + 'scene; everywhere else it is 1',
                carriedBy: 'the v8 seam\'s `time` row (`modelled: false` today)',
            }),
            recensus: Object.freeze({
                horizon: 600,
                cells: 60,
                clearUnderDisc: 1,
                strikingUnderDisc: 0,
                clearUnderLine: 16,
                strikingUnderLine: 3,
                stances: Object.freeze(['(6,3)', '(7,5)', '(8,5)']),
            }),
            withdraws: 'the "no static stance exists in L18" finding — an artifact of the '
                + 'conservative disc, not a fact about the room',
            law: 'A CONSERVATIVE INGREDIENT CAN MANUFACTURE A POLICY PROBLEM',
            notBuiltBecause: 'a `Game.time` accumulator, `hammerLine` as a CONTACT, a '
                + 'bill-or-refuse ruling, ingredient (f) and `TRANSIT_INGREDIENTS` '
                + 're-derived, and the driven pair — a slice, not a track',
        }),
    }),

    /**
     * ⛔ THE SEGMENTS, AND THE CHAIN. Named ahead of the work so that a slice
     * that records fewer says so out loud rather than reporting what it got.
     */
    chain: Object.freeze({
        name: 'r8-d2',
        kind: 'staged',
        /**
         * ⚠ TWO, NOT THREE — L18 is `trackA`'s reported wall, so the chain
         * begins at L19's own arrival from L18. The boot is the same staged
         * post-sword latch either way; what changes is that the chain no
         * longer claims a room nobody solved.
         *
         * ⛓⛓⛓ SUPERSEDED AT R9 SLICE 3, AND THE RECORD IS KEPT RATHER THAN
         * REWRITTEN. R8 slice 8 solved L18 honestly (the wall was the
         * CONSERVATIVE HAMMER DISC, trap 171, not the room), and ⚖ the R8
         * close ruled the splice R9's first act. `PLAYTHROUGH_CHAINS.r8-d2`
         * now carries THREE segments — `r8-solve-18` promoted in front — with
         * `cuts [573, 1437]` and `endsAt 2218`. This block stays as the
         * statement R8 made ahead of its own work, which is what it is for.
         */
        segments: Object.freeze(['r8-d2-19', 'r8-d2-20']),
        boot: 'r7-act2-11\'s committed v8 block — the campaign\'s own post-sword latch — '
            + 'staged at L19\'s own arrival from L18 (16,144)',
        endsAt: 'L13 (96,48), through `stairsup@16,48`',
        /**
         * ⛔ ONE SEGMENT PER ROOM, AND L19's IS ONE SEGMENT BECAUSE OF TRAP
         * 150: a fight does not survive the door, so the fight and the
         * crossing it opens cannot be cut apart. Segment boundaries are
         * decided by PERSISTENCE, not by geography.
         */
        cutRule: 'trap 150 — by PERSISTENCE, not geography',
        internalSeams: 1,
    }),
});

/**
 * ⛔⛔⛔ R8 SLICE 7 — **THE CENSUS THAT LICENSES THE MOVING POLICY**, and it is
 * an instrument rather than a sentence (⚖ ruling condition 2).
 *
 * §15.6.2 and this slice's own charge both describe L18's answer as a CELL:
 * *"a cell where the body passes through the sword's 16 px reach while the
 * player's box stays outside the 13 px hammer disc — an annulus about 4 px
 * wide"*. The arithmetic of the annulus is exact and the CELL does not exist,
 * and the difference is the room's geometry rather than anybody's reasoning.
 *
 * This walks every walkable lattice cell against the run's own
 * `spinnerForecast` over a NAMED horizon and returns the three numbers that
 * settle it:
 *
 *   `cells`      how many walkable cells the room has;
 *   `clear`      how many are outside EVERY live body's hammer disc for the
 *                whole horizon;
 *   `striking`   how many of those ever get `hitsMax` press opportunities
 *                separated by the RECEIVER's own `hitsTimerMax`.
 *
 * ⛔ A STATIC ANNULUS EXISTS IFF `striking > 0`. Measured in L18 at its own
 * arrival: 60 / 1 / 0 — the one clear cell is `(10,7)`, which is behind the
 * kill-lock the fight exists to open, and the second-best cell in the room has
 * a MINIMUM clearance of −2.38 px. ⚠ And `r8-l18-spinner-press`'s two stances
 * are the bodies' OWN entity points: a `noDamage` artifact, not a stance.
 *
 * ⇒ the claim "no static stance exists in L18" is checkable, and a future room
 * — or a future forecast — can re-ask it with its own bound.
 *
 * @param {object} run  a live honest run in the room being asked about
 * @param {object} io   `{walkableCells, forecast}` — injected so the census
 *   can be driven against a constructed room, which is what keeps the
 *   `striking > 0` arm from being a branch nobody has ever seen taken.
 */
export function annulusCensus(run, io) {
    if (!io || typeof io.walkableCells !== 'function' || typeof io.forecast !== 'function') {
        throw new Error('annulusCensus: needs an io seam {walkableCells, forecast} — the '
            + 'solver\'s own two, injected so a constructed room can exercise both arms.');
    }
    const horizon = io.horizon ?? 2016;
    const forecast = io.forecast(horizon);
    const cells = io.walkableCells();
    const hammer = io.hammerLength ?? 13;
    const hits = io.hitsMax ?? 3;
    const separation = io.hitsTimerMax ?? 30;
    /**
     * ⛓⛓⛓ R8 SLICE 8 — THE ARM. `phaseAt(i)` is `Game.time` at forecast step
     * `i`; give it and the census asks the EXACT question, withhold it and the
     * census asks the union. Injected rather than read off the run so the
     * DISC arm stays drivable after the clock exists — a census that could
     * only ask the new question could not re-measure the old answer, and
     * re-measuring it is the whole of trap 171's evidence.
     */
    const phaseAt = typeof io.phaseAt === 'function' ? io.phaseAt : null;
    const lineHits = phaseAt ? io.lineHits : null;
    if (phaseAt && typeof lineHits !== 'function') {
        throw new Error('annulusCensus: `phaseAt` without `lineHits` is a census that '
            + 'knows the clock and cannot use it — pass `spinner.hammerHitsPlayer` as '
            + '`lineHits(entity, gameTime, box)`.');
    }
    let clear = 0;
    let striking = 0;
    let bestClearance = -Infinity;
    for (const c of cells) {
        let min = Infinity;
        let safe = true;
        const last = new Map();
        const counts = new Map();
        for (let i = 0; i < horizon && safe; i += 1) {
            const step = forecast[i];
            if (!step) break;
            for (let b = 0; b < step.length; b += 1) {
                const r = step[b];
                // ⚠ `+ originX`, not the rect's CENTRE: `spinnerRect` is
                // `[x-4, x+3)` and its centre is `x - 0.5`. Half a pixel is
                // nothing to a 13 px pad and everything to a raycast.
                const cx = r.x + 4;
                const cy = r.y + 4;
                if (phaseAt) {
                    // ⛔ BOTH ARMS THE GAME RUNS: `Enemy.hitPlayer`'s 7x7 body,
                    // then the hammer's line at THIS step's own phase.
                    const overlaps = c.box.right > r.x && c.box.x < r.right
                        && c.box.bottom > r.y && c.box.y < r.bottom;
                    if (overlaps || lineHits({ x: cx, y: cy }, phaseAt(i), c.box)) {
                        safe = false;
                        break;
                    }
                } else {
                    const gap = Math.max((cx - hammer) - c.box.right, c.box.x - (cx + hammer),
                        (cy - hammer) - c.box.bottom, c.box.y - (cy + hammer));
                    if (gap <= 0) { safe = false; break; }
                    if (gap < min) min = gap;
                }
                if (io.inReach(c, r)) {
                    const prev = last.get(b);
                    if (prev === undefined || i - prev >= separation) {
                        last.set(b, i);
                        counts.set(b, (counts.get(b) ?? 0) + 1);
                    }
                }
            }
        }
        if (!safe) continue;
        clear += 1;
        // ⚠ THE LINE ARM NEVER WRITES `min` — a raycast has no px clearance —
        // so it must not be allowed to report the `Infinity` an untouched
        // accumulator would carry out as a "best".
        if (!phaseAt && min > bestClearance) bestClearance = min;
        if ([...counts.values()].some((n) => n >= hits)) striking += 1;
    }
    return {
        level: run.level,
        horizon,
        // ⛓ WHICH QUESTION WAS ASKED, on the answer. A census that reported
        // 1 and one that reported 16 must not print the same shape.
        arm: phaseAt ? 'line' : 'disc',
        cells: cells.length,
        clear,
        striking,
        // ⚠ A DISC-ARM QUANTITY. "How many pixels of clearance" is not a
        // question a raycast answers, so the line arm reports `null` rather
        // than a number whose units it does not have.
        bestClearance: bestClearance === -Infinity ? null : bestClearance,
        staticAnnulusExists: striking > 0,
    };
}

/**
 * ⛔⛔⛔ ⚖ RULING 1's CLAIM, RE-DERIVED FROM THE RUNNING ATLAS.
 *
 * `R8_D2_COMPLETE.routeGraph.edges` is a claim about which rooms of D2 reach
 * which, and the whole ruling rests on ONE of its consequences — that L13
 * has no edge to L18. A declaration nobody derives a consumer from reads
 * exactly like a declaration that passed (trap 119), and a second READING of
 * the recon that produced it would not be a measurement (trap 97). So this
 * walks the level source itself and asserts SET EQUALITY both ways.
 *
 * @param {function} levelSource  `atlasLevelSource()` — injected, so the
 *   disagreement can be CONSTRUCTED by a test handing a doctored atlas.
 * @param {number[]} [levels]  the D2 rooms whose edges are declared.
 */
export function assertD2RouteGraph(levelSource, levels = [13, 18, 19, 20]) {
    if (typeof levelSource !== 'function') {
        throw new Error('assertD2RouteGraph: needs a level source function — injected so '
            + 'a doctored atlas can make this row go red, which is what makes it a check '
            + 'rather than a restatement.');
    }
    const found = [];
    for (const n of levels) {
        for (const e of (levelSource(n).entities ?? [])) {
            if (!e.attrs || e.attrs.to === undefined) continue;
            found.push({ from: n, to: Number(e.attrs.to), via: `${e.type}@${e.x},${e.y}` });
        }
    }
    /**
     * ⛔ THE CONSEQUENCE THE RULING RESTS ON IS ASKED **FIRST**, AND THE ORDER
     * IS THE POINT — `assertSpinnerPressExposureIsMeasured`'s own precedent,
     * one ledger over. A new L13->L18 edge would fail the SET EQUALITY below
     * as one undeclared row among nine, and the reader would get a table diff
     * where the honest message is "the premise ⚖ ruling 1 overturned the
     * charged route on has changed". Asked after the equality this branch
     * would be UNREACHABLE, which is a guard that can never fire.
     */
    if (found.some((r) => r.from === 13 && r.to === 18)) {
        throw new Error('R8_D2_COMPLETE.routeGraph: L13 now HAS an edge to L18, which is '
            + 'the premise ⚖ ruling 1 overturned the charged route on. Re-take the '
            + 'ruling before trusting the three-segment chain.');
    }
    const key = (r) => `${r.from}->${r.to} ${r.via}`;
    const declared = R8_D2_COMPLETE.routeGraph.edges.filter((r) => levels.includes(r.from));
    const declaredKeys = declared.map(key).sort();
    const foundKeys = found.map(key).sort();
    const missing = foundKeys.filter((k) => !declaredKeys.includes(k));
    const stale = declaredKeys.filter((k) => !foundKeys.includes(k));
    if (missing.length || stale.length) {
        throw new Error('R8_D2_COMPLETE.routeGraph: the declared D2 edges are not the '
            + `atlas's. On disk and undeclared: ${missing.join(' | ') || 'none'}; `
            + `declared and not on disk: ${stale.join(' | ') || 'none'}.`);
    }
    return { edges: found.length, levels: levels.length };
}
