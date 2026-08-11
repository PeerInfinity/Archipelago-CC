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
