/**
 * seedlingDemo/watchGenerate — the editor page's GENERATE arm, without the
 * DOM. The PoC's fourth SOURCE (⚖ kickoff §3.5, PROCGEN PoC slice 5).
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer` / `watchSolve`:
 * it makes no claims, gates nothing, and nothing that DOES make a claim may
 * depend on it. It renders RAW TRUTH — a refusal arrives with the generator's
 * own verbatim text, a saturated run says SATURATED, and a reproduction
 * mismatch is REPORTED by name rather than smoothed over. And it owns NO
 * LOOP: `levelGenerator.generateLevel` is the loop, reached through
 * `procgenSeedling.generateSeedlingLevel` — the same entry
 * `scripts/procgen/generate-seedling-level.mjs` calls.
 *
 * ── ⛔⛔⛔ HOW **STEP** IS BUILT WITHOUT A SECOND LOOP ──────────────────
 *
 * ⚖ Ruling §1.3 wants a STEP-ONE-OBSTACLE mode, and the loop is a
 * SYNCHRONOUS function that runs to its target and returns. A callback could
 * observe it but could not PAUSE it, and a resumable loop would be a change
 * to the generator core this slice is not entitled to make.
 *
 * So STEP is `obstacleTarget = k`, re-run: **a run to target k is a strict
 * PREFIX of a run to target k+1.** The loop's outer condition is
 * `kept.length < obstacleTarget` and every draw before that point is
 * identical, so the shorter run is the longer one truncated. ⛓ MEASURED, not
 * reasoned — `watchGenerate.test.js` asserts the prefix property over both
 * biomes rather than trusting the argument, because the argument is exactly
 * the kind that stays true until somebody adds a bound that reads the target.
 *
 * ⇒ THE PRICE IS STATED: a RUN-ALL to target N spends O(N²) solves where one
 * `generateSeedlingLevel` call spends O(N). `ladderCost()` computes it so a
 * caller states the ceiling before pressing rather than discovering it after
 * — the same discipline `levelGenerator.costModel` applies to one run, and
 * for the same reason (a solve is synchronous and uninterruptible, so the
 * per-solve budget bounds what is ACCEPTED and never what is SPENT).
 *
 * ⛓⛓ THE PAYOFF IS A CLAIM WORTH THE COST: the page's step-k level IS
 * `generate-seedling-level.mjs --seed=S --biome=B --count=k`, byte for byte,
 * because it is the same call. There is no page-side reconstruction of an
 * intermediate record for a reader to wonder about.
 *
 * ── THE DISPLAY SOLVE, AND WHY IT IS A SECOND SOLVE ───────────────────
 *
 * The loop returns `{record, trace, summary}` and NOT its solves' tapes, so
 * the path data ⚖ §1.3 asks for ("all path data from the latest solve") is
 * not in hand after a step. The arm therefore re-solves the current record
 * through `seedlingOracle` — ⛔ the SAME wiring `generateSeedlingLevel` uses
 * internally (`procgenSeedling.seedlingOracle`), never a second one.
 *
 * ⚠ AND THE TWO ARE COMPARED RATHER THAN ASSUMED EQUAL. Same record, same
 * staging, same goals, same budget ⇒ the same walk. That used to carry an
 * exception — the POST-HOC wall clock, a statement about the machine (§13.8's
 * measured flake) — and since 2026-08-14 it does not: no budget here is
 * denominated in milliseconds. `agreementWith` returns the disagreement so the
 * page can SAY so; a display that silently showed a different verdict from the
 * trace's would be the two-cost-models trap with pixels.
 */

import { DEFAULT_BUDGET, assertBudget, bootStaging } from './procgenOracle.js';
import {
    DEFAULT_BOUNDS, STOP, directedAttempt,
} from '../procgenCore/levelGenerator.js';
/**
 * ⛓⛓⛓ THE URL GRAMMAR AND THE PANE VOCABULARY LEFT THIS FILE IN
 * CONSTRUCTIVE-MODE SLICE 3 — `procgenCore/urlParams.js` + `labView.js`.
 *
 * ⚖ Kickoff §3.4 made the lift CONDITIONAL and the condition was measured (see
 * `urlParams.js`'s docblock): the bounds grammar, the roster grammar with its
 * scoped delete, the `run`+`count` step encoding, the WHOLE DIRECTIVE
 * grammar, the two salted directive streams, `generationRows`,
 * `describeKeptKind`, `tileAtPoint` and the two cost models are >70% of the two
 * functions and the maze lab page needs every one of them spelled identically.
 *
 * ⛔ EVERY MOVED NAME IS RE-EXPORTED AT THE BOTTOM OF THIS FILE, so no Seedling
 * caller — the page, the CLI, the batch, the browser row, the tests — learns
 * the move happened. The only visible change is the refusals' own prefix
 * (`watchGenerate:` -> `urlParams:`/`labView:`), which is the same trade slice 2
 * made for `templateContract`.
 *
 * ⚠ WHAT STAYED, and the line that decides each: `paletteFor` (the biome map IS
 * the Seedling BOOT INVENTORY), the `?budgetms=` deprecation warning (a knob
 * this page had and removed), `?tickbudget=` -> `maxTicksPerTarget` (a SEEDLING
 * budget in TICKS — the maze's is a BFS node cap and merging them would be two
 * spellings of "the budget"), and `describeState` (its vocabulary is biome +
 * ladder step + roster; the maze's is room size + expansions + manual edits).
 */
import {
    ANCHOR_SALT, DIRECTIVE_KEEP_POLICY, PARAM_SALT, directiveSeed, dropDirectedParam, intParam,
    readAreas, readBounds, readElementsTyped, readFill, readRequire, readRosterSpec, readSize,
    readSkeleton, readSkeletonTyped, refuseDirectedParam, refuseDuplicateParams, writeAreasParam,
    writeBounds, writeElementsParam, writeFillParam,
    writeInt, writeRequireParam,
    writeRosterParam, writeRunFlag, writeSizeParams, writeSkeletonParam,
} from '../procgenCore/urlParams.js';
import {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, instantiateKept, normalizeRoster, restrictPalette,
} from './procgenPalette.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, assertKind, formatSkeleton, normalizeSkeleton,
    skeletonCatalogue,
} from '../procgenCore/skeletonKinds.js';
import { FILL_DENSE, assertRoomSize, fillByName } from './procgenLevel.js';
import {
    SEEDLING_DEFAULTS, SEEDLING_SKELETON_KINDS, areaSummaryOf, generateSeedlingLevel,
    seedlingExplicitSkeletonParams, seedlingOracle, seedlingSeam, seedlingSkeletonSpec,
    shellLevel,
} from './procgenSeedling.js';
import { ELEMENTS_NONE, elementSummaryOf } from './procgenSeedlingElements.js';
import { DEFAULT_AREAS, normalizeAreaSpec, parseAreaSpec } from '../procgenCore/areaSpec.js';
import { densityLine } from '../procgenCore/densityBlock.js';
import {
    formatElementSpec, isElementList, normalizeElementSpec, parseItemRequireList,
} from '../procgenCore/elementSpec.js';
import { SEED_MAX, rngFor } from './procgenRng.js';
/**
 * ⛓⛓ CONSTRUCTIVE SLICE 11 — THE ONE EDIT FOLD. ⛔ `watchEdit.js` imports
 * nothing from here, so the dependency is one-way: the ops know about records,
 * and the construction knows about the ops.
 */
import { editStates } from './watchEdit.js';

export class WatchGenerateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WatchGenerateError';
    }
}

const fail = (message) => { throw new WatchGenerateError(message); };

/**
 * ⚖ THE TWO BIOMES (kickoff §0), as ONE map with TWO readers.
 *
 * ⛔ It lives here rather than in each caller because it was already written
 * twice the moment the page wanted it: `generate-seedling-level.mjs` had its
 * own `BIOMES` literal, and a second copy is how "the CLI and the page
 * generate different levels for the same `--biome`" becomes possible. The CLI
 * now imports this one. ⚠ A `biome` this map does not hold must REFUSE by
 * name and never fall through to the other one — the boot is the whole
 * difference between them, so a level generated under the wrong inventory is
 * a level whose certification is about a run nobody asked for.
 */
export const GENERATE_BIOMES = Object.freeze({
    'pre-sword': PRE_SWORD_PALETTE,
    'post-sword': POST_SWORD_PALETTE,
});

export const BIOME_NAMES = Object.freeze(Object.keys(GENERATE_BIOMES));

export function paletteFor(biome) {
    const palette = GENERATE_BIOMES[biome];
    if (!palette) {
        fail(`watchGenerate: biome ${JSON.stringify(biome)} is not one of `
            + `[${BIOME_NAMES.join(', ')}]. The biome selects the BOOT INVENTORY, so `
            + 'falling through to the other one would generate a level whose '
            + 'certification is about a run nobody asked for.');
    }
    return palette;
}

/**
 * ⚖ Ruling 9(b): the payload RESERVES a skeleton block, so the constructive
 * mode arrives ADDITIVELY. A payload with no `skeleton` block is this one.
 *
 * ⛓⛓ SLICE 5 RENAMED IT FROM `empty-bordered` TO `empty`, and the rename is
 * ⚖ ruling 2 (*one vocabulary across substrates*) applied to the one name that
 * disagreed: the kinds ARE the maze biome names, and the maze has always called
 * the open room `empty`. The Seedling room keeps its wall ring — the ring is a
 * fact about `emptyLevel`, not about the kind.
 *
 * ⛔ AN OLD PAYLOAD SPELLING `empty-bordered` NOW DIVERGES **BY NAME**, and
 * that is `agreementWithPayload` working rather than a shim to write (GENERATE-
 * UI §13.3 item 12): the payload names a skeleton this page does not build, and
 * a reader is told which field disagreed. ⛓ MEASURED COST of the rename, whole:
 * this constant, its test, the maze page's own (`open-room`, renamed with it),
 * one docs line — and NOTHING else. No committed payload in the repo carries
 * either old spelling, the acceptance batch never prints the block, and
 * `check-seedling-editor-generate.mjs`'s `?gen=` payload omits it entirely (so
 * both sides default and it agrees either way). ⇒ no artifact was re-recorded.
 *
 * ⛔ IT IS RE-EXPORTED, NOT RE-DECLARED. `procgenCore/skeletonKinds.js` owns the
 * vocabulary and its default; a literal here would be the second spelling that
 * the rename exists to remove, and the two would agree until the day somebody
 * edited one.
 */
export { DEFAULT_SKELETON };

/**
 * ⛓⛓⛓ THE DIRECTED BOUND — **12**, and the number is a measurement.
 *
 * ⚖ The ruling asks for *"a higher default than the loop's"* with the cost
 * stated. `scripts/procgen/sweep-seedling-directed-bound.mjs` walked EVERY
 * legal anchor of all three clearer templates over seeds 1..12, in both the
 * skeleton geometry and on a step-3 ladder record:
 *
 *   · the most legal anchors any subject was ever offered:   **7** (skeleton)
 *     — and only **4** on a step-3 ladder record, where 12 of 36 rows were
 *       offered ZERO.
 *   · the deepest first-DISCHARGING anchor:                  **5**
 *   · every yield column is FLAT from N=5 (skeleton) and N=2 (ladder) upward.
 *
 * ⇒ 12 sits ABOVE the largest anchor list either arm produced, so on the
 * measured corpus the walk is bounded by THE ROOM and the bound never
 * truncates a search that would have found something. ⛔ And the real cost is
 * the room's too: `anchorsFor` returns at most the legal cells, so a directed
 * attempt on these rooms spends ≤7 solves where the press line authorises 12.
 * The line states 12 because that is what a presser is agreeing to.
 *
 * ⛓⛓ **THE BRIEF'S OWN ESTIMATE WAS AN ORDER OF MAGNITUDE HIGH** ("~12–90
 * solves"), and the reason is the S1 guard: a door template declares its whole
 * slide path as `clearance`, so `legalAt` refuses nearly every cell. That is a
 * fact about this palette, not a law — a template with a one-cell footprint
 * would be offered dozens — which is exactly why the bound is stated here with
 * its measurement instead of derived from the room's size.
 */
export const DIRECTED_ANCHOR_TRIES = 12;

/**
 * The arm's own URL parameters — the loop's bounds and budget, plus the two
 * that are about the PAGE rather than the loop (`?gen=`, `?run=`).
 *
 * ⚠ SOURCE IS NEVER INFERRED FROM `?seed=`, and `?gen=` is the one exception
 * ON PURPOSE. MANUAL's rule (`watchViewer.main`) is that an arm which waits
 * for a press must not be the one a stale URL lands in, and GENERATE spends
 * SECONDS of a synchronous solve per press — so it is asked for by name.
 * `?gen=` is unambiguous: nothing else in the page's vocabulary spells it.
 */
export function readGenerateParams(search) {
    const q = new URLSearchParams(search);
    const int = (name, fallback) => intParam(q, name, fallback);
    const source = (q.get('source') || '').toLowerCase();
    const gen = q.get('gen');
    const biome = (q.get('biome') || 'pre-sword').toLowerCase();
    /**
     * ⛓⛓⛓ CONSTRUCTIVE SLICE 12 — `?directed=` IS REFUSED BY NAME, FIRST.
     *
     * ⚖ §3.9's ruling: a URL names what a person LAUNCHES; a directive list is
     * a CONSTRUCTION and rides the payload. ⛔ Refused BEFORE any other
     * parameter is read so an old link's FIRST answer is the one that explains
     * where its directives went, rather than a refusal about some other key it
     * also carries.
     */
    refuseDirectedParam(q, { substrate: 'the Seedling page' });
    /**
     * ⛓ P5 — AND THEN THE SHAPE OF THE QUERY ITSELF, before any value is
     * read: `run=1&run=1` used to be accepted silently. ⛔ AFTER
     * `refuseDirectedParam`, deliberately: a retired key a person can DELETE
     * is a more useful first answer than a duplicate they have to find.
     */
    refuseDuplicateParams(q, { substrate: 'the Seedling page' });
    if (q.get('budgetms') !== null) {
        // eslint-disable-next-line no-console
        console.warn('watchGenerate: ?budgetms is GONE and was IGNORED. Elapsed time no '
            + 'longer classifies a solve — it is not a property of the candidate. Use '
            + '?tickbudget= instead.');
    }
    return {
        isGenerate: source === 'generate' || (!source && gen !== null),
        seed: int('seed', 1),
        biome,
        /**
         * ⛓ SLICE 4 — VERB 1. `null` is the whole roster; otherwise the
         * normalized `{axis, names}` this biome's palette validated. ⚠ It is
         * NOT a bound: a bound narrows how hard the loop tries, a roster
         * changes WHAT it may draw, so it rides beside `bounds` rather than
         * in it (and `summary.bounds` stays the four numbers a reader can
         * compare across runs).
         */
        roster: normalizeRoster(paletteFor(biome), readRosterSpec(q)),
        /**
         * ⛔⛔ SLICE 12 — **THERE IS NO `directed` FIELD HERE ANY MORE.** Slice
         * 5's verb 2 is alive (the ATTEMPT button, the CLI's `--directed=`, the
         * payload's `directives`, all one grammar), but the URL is not one of
         * its channels: `?directed=` is REFUSED above, and `?gen=` /
         * `procgenLab:load` carry the list. A field that could only ever be
         * `null` would be one every caller keeps checking for a value it can
         * never hold.
         */
        /**
         * ⛓ SLICE 5 OF THE CONSTRUCTIVE ARC — THE ROOM THE LOOP STARTS FROM.
         * Absent is `empty` (the open bordered room). ⛔ A kind this binding
         * cannot run (`classic`/`corridor` need the maze simulator) refuses
         * HERE, at read time, with the list Seedling offers — before any solve
         * and before the page draws anything.
         */
        /**
         * ⛓⛓⛓ ARC 3 SLICE 5a (D2) — **THE STRING AS TYPED REACHES THE ONE
         * RESOLVER**, and `readSkeletonTyped` is the same reader with one more
         * field (⚖ orchestrator, 2026-08-18). `parseSkeleton`'s answer spells a
         * value at the CODEC's default by ABSENCE, and Seedling's own default
         * for `chambers` is 1 — so a page that resolved the NORMALIZED object
         * could not tell *nobody said* from *the caller typed 0*, and 4d §15.2
         * measured that a typed `?skeleton=winding;chambers=0` built the
         * `chambers=1` room. ⛔ `seedlingSkeletonSpec` accepts the STRING as
         * typed (4b wrote it that way for the CLI); this hands it one, so the
         * URL, the CLI and the object channel now agree.
         *
         * ⚠ THE SPEC ON THE STATE IS THE **EFFECTIVE** ONE (`chambers` always
         * explicit on the five carved kinds) — see `generateStep`.
         */
        skeleton: seedlingSkeletonSpec(
            readSkeletonTyped(q, { simulator: false, substrate: 'the Seedling page' }).raw
            ?? { kind: DEFAULT_SKELETON_KIND },
        ),
        /**
         * ── ⛓⛓⛓ ARC 3, SLICE 5a (D1) — **THE THREE PARAMETERS THE PAGE WAS
         * ── MISSING**, each through the ONE reader `procgenCore/urlParams.js`
         * ── already had (4d §15.14: *"`?require=` and `?elements=` are the
         * ── page's missing half"*).
         *
         * ⛔ **`undefined` IS NOT `{name:'none'}`, AND ON SEEDLING THE
         * DIFFERENCE IS THE WHOLE FEATURE.** `seedlingSeam` reads `elements ===
         * undefined` as *nobody said* and applies the BIOME DEFAULT (4c §13.3);
         * an explicit `none` is a CHOICE it honours. `readElementsTyped`'s
         * `raw === null` is the only honest test of which one a URL asked, and
         * it is why this is not `readElements(q)`.
         *
         * ⚠ A NAMED PARAMETER AT ITS DEFAULT IS **KEPT** (arc-2 §11.5's law,
         * carried whole): `guard` and `guard;len=2` are different runs, because
         * a named parameter is an override that spends NO draw and an omitted
         * one is DRAWN. The reader must not tidy it.
         */
        elements: readElementsTyped(q).raw === null ? undefined : readElementsTyped(q).spec,
        /**
         * ⛓ `?areas=` — absent ≡ `{keys: 0}` ≡ *the module does not run at all*
         * (⚖ arc-1 ruling 3), which IS Seedling's default, so absence needs no
         * second spelling here.
         */
        areas: readAreas(q),
        /**
         * ⛓ `?require=` — `null` when ABSENT, and an EMPTY one REFUSES rather
         * than reading as absent (a directive somebody emptied is not the same
         * as no directive). ⛔ The pair `?require=` + `?elements=` is NOT
         * adjudicated here: `seedlingSeam.resolveRequireDirective` knows both
         * and refuses BY NAME with the vocabulary in the sentence.
         */
        require: readRequire(q, { grammar: parseItemRequireList }),
        /**
         * ── ⛓⛓⛓ ARC 5, SLICE 1 — **THE ROOM CONTRACT ON THE ADDRESS BAR** ──
         *
         * ⚖ Ruling 1: width and height are separate knobs, the DEFAULT stays
         * 10x10 and a default is a PIN. ⛔ ABSENT is `SEEDLING_DEFAULTS`' own
         * pair, so a link written before this parameter existed reads back the
         * room it always named — and `?width=10` is a DIFFERENT URL for the
         * SAME room, which is true of a size and false of an element parameter
         * (a named element parameter spends no draw; a size spends none either
         * way, because it is a constant input rather than a draw).
         *
         * ⛔ The RANGE is `procgenLevel.assertRoomSize`'s — the module that
         * measured 60 off the shipped atlas — handed in as the grammar, so the
         * URL, the CLI and the model all refuse with one sentence.
         */
        size: readSize(q, {
            defaults: SEEDLING_DEFAULTS,
            grammar: assertRoomSize,
            substrate: 'the Seedling page',
        }),
        /**
         * ⛓⛓ ⚖ RULING 2 — **THE FILL**, its own parameter beside the size
         * knobs (§6 Q1's default, decided against this grammar's own
         * precedents — `urlParams.readFill`'s docblock carries the three).
         * ABSENT is `dense`, the rectangle this generator has always written.
         */
        fill: readFill(q, {
            fallback: FILL_DENSE, grammar: fillByName, substrate: 'the Seedling page',
        }),
        /** ⛓ The four the loop runs under — `urlParams.readBounds`, shared. */
        bounds: readBounds(q),
        /**
         * ⚠ `?tickbudget=` AND NOT `?ticks=`. The page already spells `?tick=`
         * for the SCRUB CURSOR, and two parameters one letter apart that mean
         * "which frame to draw" and "how long the solver may walk" is a
         * collision waiting for somebody's typo to land it.
         */
        /**
         * ⛔ `?budgetms` IS GONE (2026-08-14) — the wall clock it set no longer
         * exists. A stale bookmark must not hard-fail a page, so this warns in
         * the console rather than throwing, but it does NOT pass silently:
         * a knob a caller believes is bounding a run it is not bounding is the
         * failure this repo keeps recording.
         */
        budget: {
            maxTicksPerTarget: int('tickbudget', DEFAULT_BUDGET.maxTicksPerTarget),
        },
        /** A payload to REPRODUCE and check against — see `agreementWithPayload`. */
        gen,
        /** RUN-ALL on load. `?run=1` is the CLI's own path to a finished level. */
        run: q.get('run') === '1',
    };
}

/**
 * ── ⛓⛓⛓ THE OTHER HALF OF `readGenerateParams` — THE WRITE BACK ───────
 *
 * ⛔ THE DEFECT THIS ENDS, MEASURED: the generate form's controls edited LOCAL
 * VARIABLES and nothing else. Type seed 3 → 9, press RUN-ALL, and the address
 * bar still said `?seed=3` — the link named a level the page was not showing.
 * That is this repo's recorded TWO-SPELLINGS failure mode with the second
 * spelling being the address bar itself, and on a page whose ONLY persistence
 * is the URL it means the run cannot be handed to anybody.
 *
 * ⚠ ONE SPELLING PER SETTING: the parameter IS the control's value, this is
 * the only writer, `readGenerateParams` is still the only reader, and the two
 * are asserted to be INVERSES rather than assumed to be (`watchGenerate.test`
 * reads back what this writes and regenerates from it, byte for byte).
 *
 * ── WHAT THE URL NAMES IS WHAT IS SHOWN ───────────────────────────────
 *
 * ⛓ `count` IS `state.bounds.obstacleTarget` — the target of the
 * `generateSeedlingLevel` call that produced the record on screen, which at
 * step k is exactly k because `generateStep` overrides it. So a copied link is
 * byte-exact BY CONSTRUCTION and not by argument: reloading it re-issues the
 * SAME call with the SAME arguments (and `count=k` is the CLI's own
 * `--count=k`, which is the prefix property this arm already rests on).
 *
 * ⚠ THE PRICE IS STATED: the form's UNFINISHED target does not survive a copy.
 * STEP once toward a target of 5 writes `count=1`, so the reloaded page shows
 * step 1 with the target reading 1 — because after the reload the page's state
 * IS step 1, and a target nobody has run yet is not state a link has to carry.
 * (A ladder that wants to go further raises the target again, which is what
 * the status line already tells it to do.)
 *
 * `run=1` iff a RUN is what is on screen. Step 0 is the SKELETON — what a load
 * with no `?run=` already shows — so `run` is DELETED there rather than spelt
 * `run=0`, which would be a second way to say the same absence.
 *
 * ── ⛔⛔ AND IT LEARNS ABOUT NEITHER EDITS NOR DIRECTIVES (slices 11+12) ──
 *
 * There is no `edits` parameter in this signature and there must not be one.
 * ⚖ *"It's okay to not include the manual edits"* — a URL is an INSTRUCTION
 * (a run somebody could type) and an edit list is a CONSTRUCTION, which is the
 * payload's job and which it does byte-exactly (`agreementWithPayload`).
 *
 * ⛓⛓ SLICE 12 APPLIED THE SAME SENTENCE TO THE **DIRECTIVES** (⚖ §3.9), so
 * there is no `directives` parameter either: what this writes is the LAUNCH of
 * the ladder the construction started from. ⛔ The consequence is stated ON THE
 * PAGE rather than left to be discovered: `describeState` prints *"the URL is
 * NOT a reproduction of this construction — it names the LADDER alone"* the
 * moment there is a directive or an edit.
 *
 * ── ⛔ `?gen=` IS AN IDENTITY, NOT A BOUND ────────────────────────────
 *
 * A payload run's identity IS `?gen=`: it names a file that carries
 * seed/biome/bounds and REPLACES the URL's, so writing those beside it would
 * put two spellings of one run in one address bar and let them drift the
 * moment the file on disk changes. So while the payload owns the page, nothing
 * else is written. At the first PRESS the payload stops owning it — the state
 * on screen is the page's own from then on — `gen` is DROPPED and the explicit
 * parameters take over.
 *
 * ⚠ `source=generate` GOES IN WITH THEM. `?gen=` is also what SELECTED this
 * arm (`readGenerateParams`: no `?source=` plus a `?gen=` means GENERATE), so
 * dropping it without saying `source` would hand back a link that opens a
 * different arm and shows a level nobody generated.
 *
 * ⚠ EVERY OTHER PARAMETER SURVIVES — `?tickbudget=`, `?layers=`, `?side=`,
 * `?tape=`, `?goals=`. This rewrites the ones it owns and COPIES the rest,
 * which is the switch arc's law (the URL is rewritten, never rebuilt, never
 * reloaded). ⛔ `?tickbudget=` matters most and has no control on the form: it
 * stays URL-only on purpose, and a rewrite that dropped it would silently move
 * the budget the run on screen was certified under.
 */
export function writeGenerateParams(search, {
    seed, biome, bounds, step, roster = null, payloadOwned = false,
    skeleton = DEFAULT_SKELETON, elements, areas = DEFAULT_AREAS, require = null,
    size = SEEDLING_DEFAULTS, fill = FILL_DENSE,
} = {}) {
    const q = new URLSearchParams(search);
    if (payloadOwned) return q.toString();
    q.delete('gen');
    q.set('source', 'generate');
    writeInt(q, 'seed', seed);
    q.set('biome', String(biome));
    /**
     * ⛓ SLICE 5 OF THE CONSTRUCTIVE ARC — the skeleton kind, DELETED at the
     * default rather than written as `?skeleton=empty` (the open room is
     * spelled by absence, the same rule the whole roster follows), and refused
     * on the way OUT by the same `assertKind` the reader runs.
     */
    /**
     * ⛓⛓⛓ SLICE 5a (D2) — AND IT SPELLS `chambers` EXPLICITLY on the five
     * carved tree kinds, 0 and 1 alike. ⛔ The list is `seedlingExplicit
     * SkeletonParams`' — DERIVED from the resolver rather than written out —
     * and `procgenCore/urlParams.js` never learns it, which is what keeps the
     * MAZE's own `?skeleton=` byte-identical.
     */
    writeSkeletonParam(q, skeleton, {
        simulator: false,
        substrate: 'the Seedling page',
        explicit: seedlingExplicitSkeletonParams(skeleton?.kind),
    });
    /**
     * ⛓⛓ ARC 5, SLICE 1 — the ROOM CONTRACT, written in place and DELETED at
     * its default (⚖ rulings 1 and 2). ⛔ The delete-at-default is what keeps a
     * default room's bar byte-identical to every link ever copied off this
     * page, and the row that gates it compares the STRING: a round trip cannot
     * see a writer that kept `?width=10` (trap 250).
     */
    writeSizeParams(q, size, { defaults: SEEDLING_DEFAULTS, grammar: assertRoomSize });
    writeFillParam(q, fill, { fallback: FILL_DENSE, grammar: fillByName });
    // ⛓ SLICE 3: the anchor-search bound is a BOUND like the other three, so it
    // rides with them in `urlParams.writeBounds` (§8.6's standing law: every new
    // control arrives WITH its parameter in the one writer). The integer refusal
    // is `urlParams.writeInt`'s, shared with the maze page.
    writeBounds(q, bounds);
    /**
     * ── ⛓⛓ SLICE 4: THE SUB-ROSTER, AND IT IS THE FIRST NON-INTEGER PARAM ──
     *
     * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6's standing
     * law), and for a comma list that means its OWN validation: the integer
     * guard above cannot see an unknown family name. `normalizeRoster` is the
     * same check `readRosterParams` runs, against the same palette, so a URL
     * this page cannot reload cannot be written in the first place.
     *
     * ⛔ AND THE OTHER AXIS IS DELETED WITH IT. Writing `?templates=` beside a
     * standing `?families=` from a previous load would hand back a link the
     * reader REFUSES (both spellings at once) — the writer must leave exactly
     * one of the two in the bar, or none.
     *
     * ⚠ The names are written SORTED because `normalizeRoster` sorts them: an
     * order-preserving writer would round-trip once and then rewrite the bar
     * on the next load, breaking the fixed point slice 1 asserts.
     *
     * ⛓ AND THE DELETE IS SCOPED TO THE OTHER AXIS, WHICH THE FIXED POINT
     * FORCED. A `delete` followed by a `set` of the SAME key APPENDS it —
     * `URLSearchParams.set` preserves an existing key's position but a deleted
     * key has none — so blanket-deleting both spellings first rewrote
     * `…&families=…&run=1` into `…&run=1&families=…` on the second load. The
     * string differed while the run did not, which is exactly the drift slice
     * 1's fixed-point check exists to catch, and it caught this one.
     */
    // ⚠ The palette is only consulted when there IS a restriction: a writer
    // that resolved the biome unconditionally would start refusing calls that
    // name no roster at all, which is a different claim than this one.
    writeRosterParam(q, roster ? normalizeRoster(paletteFor(biome), roster) : null);
    /**
     * ── ⛓⛓⛓ SLICE 12: THE DIRECTIVES ARE **NOT** WRITTEN, EVER ──────────
     *
     * ⚖ §3.9's ruling. Slice 5 wrote the whole construction into the bar;
     * slice 12 took it out and gave it to the payload, so this writer has no
     * `directives` argument at all — a parameter it accepted and ignored would
     * be a signature that lies about what the URL carries.
     *
     * ⛔ AND IT DELETES A KEY IT FINDS, for the reason `?skeleton=` is deleted
     * at its default and with §8.6's law pointing the other way: the READER
     * refuses `?directed=`, so a bar still carrying one is a bar this page
     * cannot reload, and a writer that copied it forward would hand back a
     * dead link. ⚠ Unreachable on a booted page by construction (the reader
     * refuses before the page mounts, so no state exists to rewrite from a bar
     * that has one) — kept because "this writer owns this key" is the property.
     *
     * ⛓ WHAT A DIRECTED LEVEL'S URL THEN IS: the LAUNCH URL of its ladder
     * alone — seed, biome, skeleton, bounds, `run` — and `describeState` says
     * so in words the moment there is a directive or an edit, so the reader is
     * never left to infer it from an address that looks complete.
     */
    dropDirectedParam(q);
    /**
     * ── ⛓⛓⛓ SLICE 5a (D1) — **THE THREE PARAMETERS ARE OWNED NOW, NOT COPIED**
     *
     * ⛔ Until this slice `?elements=` "survived" a rewrite only because this
     * writer COPIES what it does not own (the docblock above): it was never
     * read, never reached the model, and a page that had merely TOUCHED a
     * control would have carried it forward as decoration. Now the reader
     * resolves all three and the writer spells all three FROM THE STATE.
     *
     * ⛔ REWRITE IN PLACE, never delete-then-set — the fixed-point rows. Each
     * writer already does that; what is passed differs per parameter:
     *   `elements` — `undefined` (nobody said) DELETES; anything else, INCLUDING
     *                `none`, is SET. ⛓ `deleteAt: null` is Seedling saying *no
     *                value of mine is spelled by absence*, because absence
     *                means the BIOME DEFAULT here and not `none`.
     *   `areas`    — deleted at `0`, which IS *the module does not run*.
     *   `require`  — deleted when there is no directive; an EMPTY one cannot be
     *                written because `formatRequireList([])` is `''`.
     */
    writeElementsParam(q, elements, { deleteAt: null });
    writeAreasParam(q, areas);
    writeRequireParam(q, require, { grammar: parseItemRequireList });
    writeRunFlag(q, step);
    return q.toString();
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SEEDLING BOT R9, SLICE 0 — **THE `?elements=` CONTROL'S THREE STATES**
 * ══════════════════════════════════════════════════════════════════════
 *
 * The page's element control is a `<select>` and the parameter it edits has a
 * state a `<select>` cannot hold: `undefined`, *nobody said*, which is what
 * `seedlingSeam` reads as *apply the BIOME DEFAULT* (`defaultElementsFor`).
 * Two more are ordinary: `none` is a CHOICE the seam honours, and a head name
 * is an override carrying its own params sub-form.
 *
 * ⛔ **THE MAPPING LIVES HERE, NOT IN THE VIEW**, for the reason the reader and
 * the writer live here: it is the third face of the same two-streams law
 * (arc-3 §13.3), the view has no test harness, and a mapping inside a closure
 * would be asserted only through a browser. These two functions are inverses
 * over the control's whole vocabulary and `watchGenerate.test.js` drives them
 * as a pair.
 *
 * ⚠ A `+` LIST HAS NO `<select>` SPELLING and is not given one: a list is a
 * DISTRIBUTION over two or more heads and an option per subset is not a
 * vocabulary a reader can act on. The control shows the URL's list read-only
 * under `ELEMENTS_CONTROL_LIST`, and `elementsFromControl` hands that sentinel
 * back the very spec it was shown — so a press that left it alone KEEPS it,
 * and the option can never mean a list the page is no longer holding.
 */
/** The control value that means `undefined` — *nobody said*, the biome default. */
export const ELEMENTS_CONTROL_DEFAULT = '';
/** The control value that means *the `+` list this page was loaded with*. */
export const ELEMENTS_CONTROL_LIST = '\u0000list';

/**
 * ⛓ A spec (or `undefined`) → the control value that SHOWS it.
 *
 * @param {object|undefined} spec what the caller asked for — `undefined` is
 *   *nobody said*, `{name:'none'}` is the CHOICE, anything else a head or list
 * @returns {string} one of `ELEMENTS_CONTROL_DEFAULT`, `ELEMENTS_CONTROL_LIST`
 *   or a head name from `ELEMENT_NAMES`
 */
export function elementsControlValue(spec) {
    if (spec === undefined) return ELEMENTS_CONTROL_DEFAULT;
    if (isElementList(spec)) return ELEMENTS_CONTROL_LIST;
    return normalizeElementSpec(spec).name;
}

/**
 * ⛓ The control value (plus the params the sub-form named) → the spec the ONE
 * writer is handed. The inverse of `elementsControlValue` over every state the
 * control can hold.
 *
 * ⛔ `params` IS THE **NAMED** SET AND NOTHING ELSE. A sub-form select left at
 * `any (draw it)` contributes no key, because a named parameter spends NO draw
 * and an omitted one is DRAWN — the two build different levels even when the
 * value comes out the same (`elementSpec.namedParams`).
 *
 * @param {string} value the control's value
 * @param {object} [o]
 * @param {object} [o.params] the sub-form's named parameters
 * @param {object} [o.list] the `+` list the page was loaded with, for the
 *   read-only sentinel; `undefined` when there is none
 * @returns {object|undefined} the spec, or `undefined` for the biome default
 */
export function elementsFromControl(value, { params = {}, list } = {}) {
    if (value === ELEMENTS_CONTROL_DEFAULT) return undefined;
    if (value === ELEMENTS_CONTROL_LIST) return list;
    return normalizeElementSpec(
        Object.keys(params).length === 0 ? { name: value } : { name: value, params },
    );
}

/**
 * ⛓ How the RESET comparison spells an element ask. ⛔ `undefined` needs a
 * spelling of its own: `formatElementSpec` cannot produce one (there is no
 * string for *nobody said*), and a comparison that mapped it to `''` would read
 * a switch from the biome default to a drawn `none` as no change at all.
 */
export function elementsAskSpelling(spec) {
    return spec === undefined ? '(biome default)'
        : formatElementSpec(normalizeElementSpec(spec));
}

/**
 * THE STATE AT STEP k — the level, the trace so far, and what stopped it.
 *
 * `step === 0` is the SKELETON: the bordered room and its goal, before any
 * template is drawn. ⚖ §7.5 wants the empty-room case exercised and visible,
 * and it is the loop's own control (`generateLevel` refuses to start if the
 * skeleton does not solve), so the page shows the same room the loop checks.
 *
 * ⛔ THE STEP-0 MODEL IS `seedlingSeam(…).model` — the SAME construction
 * `generateSeedlingLevel` runs, so the goal cell at step 0 is the goal cell at
 * every later step BY CONSTRUCTION rather than by agreement. The test drives
 * that equality.
 *
 * ⛓⛓⛓ **IT BECAME THE SEAM IN ARC-3 SLICE 4c, AND IT HAD TO.** Until then step 0
 * was `seedlingModel({seed, skeleton})` — a bare room — which was the same room
 * because no element was in it: `--elements=` defaulted to `none`. Slice 4c gave
 * the DEFAULT a biome-dependent element spec (`procgenSeedling.defaultElementsFor`),
 * so the skeleton the loop checks now CONTAINS an element, and an element that
 * fails its certification solve is DROPPED. A step-0 branch that skipped the seam
 * would draw the element and never drop it, and the page would show, as "the
 * room before any template", a room step 1 does not have.
 *
 * ⚠ THE PRICE IS ONE CERTIFICATION SOLVE AT STEP 0 where there used to be none —
 * the very solve step 1 spends, no more. That is the honest cost of showing the
 * room the loop actually checks.
 */
/**
 * ⛓⛓⛓ SLICE 5a (D1) — **THE THREE BLOCKS THE STATE CARRIES, AND `null` WHEN
 * NOBODY ASKED.**
 *
 * ⛔ `null`, NEVER `{}`. *"The area graph was not asked for"* and *"the area
 * graph ran and found nothing"* are different facts, and a readout that spelled
 * both as an empty object would be the page answering a question it was never
 * asked. The browser row asserts `null` explicitly, which is why it is stated
 * here rather than left to a `?.`.
 *
 * ⛔ AND THE SHAPES ARE THE **CLI's OWN** (`elementSummaryOf`, `areaSummaryOf`,
 * `summary.require`), so the page's readout and `generate-seedling-level.mjs
 * --json` are one shape rather than two that agree today.
 */
const elementsBlockOf = (model, certification) => {
    const spec = model?.elementSpec ?? null;
    if (!spec) return null;
    if (!isElementList(spec) && spec.name === ELEMENTS_NONE) return null;
    return elementSummaryOf(model, { certification });
};

export function generateStep({
    seed, biome, step, bounds, budget, roster = null, skeleton = DEFAULT_SKELETON,
    elements, areas = DEFAULT_AREAS, require = null,
    /**
     * ⛓⛓⛓ ARC 5, SLICE 1 — **THE ROOM CONTRACT REACHES THE SEAM AS
     * `defaults`**, which is the argument `seedlingModel` has taken since the
     * PoC (`SEEDLING_DEFAULTS` is `{level, width, height, goalClass, goalTag,
     * start}`) — so the size channel adds no seam, only a caller. ⛔ At the
     * default pair this passes `{width: 10, height: 10}`, which is what
     * `SEEDLING_DEFAULTS` already says, so the model builds a byte-identical
     * room whether the page names the size or not.
     */
    size = SEEDLING_DEFAULTS, fill = FILL_DENSE,
} = {}) {
    /** ⛔ REFUSED HERE TOO, BEFORE ANY SOLVE — a page that reached the model
     *  with a bad size would pay a carve to find out. */
    assertRoomSize(size, 'the Seedling page');
    const defaults = { width: size.width, height: size.height };
    /**
     * ⛓ SLICE 5 OF THE CONSTRUCTIVE ARC — the room this ladder starts from,
     * validated ONCE here so step 0 and step k cannot disagree about it, and
     * refused by name for a kind Seedling cannot build.
     */
    /**
     * ⛓⛓⛓ ARC 3, SLICE 4b — **THE SEEDLING `chambers` DEFAULT IS RESOLVED
     * HERE, BEFORE NORMALISATION**, because `normalizeSkeleton` spells a value
     * at its default BY ABSENCE and a default applied after it cannot tell
     * *nobody said* from *the caller typed 0*. `seedlingSkeletonSpec` is
     * idempotent, so a state rebuilt from its own `skeleton` block is unmoved.
     * ⛔ `skelEffective` (with `chambers` explicit) is what the SEAM receives;
     * `skel` is the CANONICAL spelling the state, the payload and
     * `agreementWithPayload` carry.
     */
    const skelEffective = seedlingSkeletonSpec({
        kind: assertKind(skeleton?.kind ?? DEFAULT_SKELETON_KIND,
            { simulator: false, substrate: 'the Seedling binding' }),
        /**
         * ⛓⛓ SLICE 7 — AND ITS PARAMETERS, normalized with it. ⛔ Normalizing
         * (rather than passing through) is what makes the state carry ONE
         * spelling per room: a caller who wrote `{minRoom: 3}` and one who
         * wrote nothing produce the identical block, so `agreementWithPayload`
         * compares with a both-sides default and an old payload agrees.
         */
        params: skeleton?.params ?? {},
    });
    /**
     * ⛓⛓⛓ SLICE 5a (D2) — **THE STATE NOW CARRIES `skelEffective`**, and `skel`
     * (the canonical, default-by-absence spelling) survives only as what
     * `agreementWithPayload` normalizes both sides down to.
     *
     * ⛔ THE REASON IS A TYPED 0. `normalizeSkeleton({kind:'winding',
     * params:{chambers:0}})` is `{kind:'winding'}`, which `seedlingSkeletonSpec`
     * reads back as *nobody said* and resolves to 1 — so a state, a payload or a
     * step-k call carrying the CANONICAL spelling loses a deliberate 0 on every
     * round trip. ⚠ It is byte-inert everywhere the 0 is not typed: on the five
     * carved kinds the effective value is 1, which is OFF the codec's default
     * and therefore already present in the canonical spelling, and on every
     * other kind the two objects are identical.
     *
     * ⛔ `normalizeSkeleton` STILL RUNS, in `agreementWithPayload`, on BOTH
     * sides — which is what keeps an old payload from falsely diverging.
     */
    /**
     * ⛓ SLICE 4: THE SUB-ROSTER IS APPLIED HERE AND NOWHERE ELSE. `paletteFor`
     * chooses the biome, `restrictPalette` narrows it, and the SAME loop takes
     * the result — so every downstream reader (the pin union, the sentinel
     * slots, `summary.palette`, the payload) sees one palette object and never
     * learns whether it was restricted. ⛔ A second place that filtered the
     * roster would be a second answer to "what could this run draw from".
     */
    const palette = restrictPalette(paletteFor(biome), roster);
    const b = assertBudget(budget ?? DEFAULT_BUDGET);
    if (!Number.isInteger(step) || step < 0) {
        fail(`watchGenerate: step must be a non-negative integer, got ${JSON.stringify(step)}. `
            + 'Step 0 is the SKELETON and step k is a run to obstacleTarget=k.');
    }
    if (step === 0) {
        /**
         * ⛓ SLICE 5a (D1) — the three parameters reach the SEAM exactly as the
         * CLI passes them: `elements === undefined` is *nobody said* and is the
         * only thing that reaches the biome default (4c §13.3).
         */
        const seam = seedlingSeam({
            seed, items: palette.items ?? null, budget: b, skeleton: skelEffective,
            elements, areas, require, defaults,
        });
        const { model } = seam;
        return Object.freeze({
            seed,
            biome,
            palette,
            // ⛓ The restriction the palette above CARRIES — one derivation, so
            // the URL writer and the payload cannot disagree with the loop.
            roster: palette.roster ?? null,
            step,
            model,
            /**
             * ⛓⛓⛓ **THE END OF PASS 1** (arc 5, slice 1) — the one place the
             * SKELETON record is rewritten, and at `fill: 'dense'` it is the
             * same object by identity. ⛔ The strip never runs mid-pipeline:
             * every law in `procgenSeedling` — the frozen carve `base`, the
             * seal flood, the element's demand — read the DENSE room the model
             * built, and what leaves is the shell.
             */
            record: shellLevel(model.skeleton(), model, fill),
            trace: [],
            summary: null,
            keptTemplates: [],
            /**
             * ⛓ SLICE 5: a LADDER state carries an EMPTY directive list rather
             * than none, so every reader downstream (the payload, the URL
             * writer, `describeState`, `agreementWithPayload`) meets one shape
             * and never has to ask whether a directive has happened yet.
             */
            directives: Object.freeze([]),
            /**
             * ⛓⛓ CONSTRUCTIVE SLICE 11: the MANUAL EDITS, on the same terms as
             * the directives — an EMPTY list on every state rather than none,
             * so every reader downstream (the payload, `describeState`,
             * `agreementWithPayload`, the URL writer, the bridge summary) meets
             * ONE shape and never has to ask whether an edit has happened yet.
             * ⛔ The URL writer is the one reader that must NOT learn about
             * them (⚖ ruling 9) — see `writeGenerateParams`.
             */
            edits: Object.freeze([]),
            /** ⚖ Ruling 9(b)'s block — the kind this room WAS built from.
             *  ⛓ SLICE 5a: the EFFECTIVE spelling — see above. */
            skeleton: skelEffective,
            /** ⛓ ARC 5, SLICE 1 — what the URL writer spells, off the STATE
             *  rather than off the reader's answer (one spelling per setting). */
            size: Object.freeze({ width: size.width, height: size.height }),
            fill,
            /** ⛓⛓ SLICE 5a (D1) — the three blocks, `null` when not asked. */
            elements: elementsBlockOf(model, seam.certification),
            areas: areas?.keys > 0
                ? areaSummaryOf(seam.areaCertification?.areas ?? model.areas,
                    { certification: seam.areaCertification })
                : null,
            /**
             * ⛓⛓ AT STEP 0 A DIRECTIVE IS **RESOLVED, NOT YET GRADED** — and
             * the two are different facts. `requireVerdict` runs on the FINISHED
             * level (4d D1/D2: a skeleton-time differential would be blind to a
             * kill lock that pass-2 furniture opened), so the skeleton can only
             * report what the directive DID to the head: which element it
             * forced, or its refusal BY NAME. ⛔ `null` when nothing was asked —
             * never the seam's empty resolution, which would read as a
             * directive that met nothing.
             */
            require: seam.require?.asked?.length ? seam.require : null,
            /**
             * ⛓⛓ SLICE 5a (D3/D4) — **THE PASS-1 LEDGER**, model rows plus the
             * seam's certification. ⛔ It is on the STATE and NOT on `summary`,
             * so it reaches the page and no payload (4d §15.13's false mover).
             */
            ledger: seam.ledger,
            stop: null,
            saturated: false,
            budget: b,
            bounds: { ...DEFAULT_BOUNDS, ...(bounds ?? {}) },
        });
    }
    const out = generateSeedlingLevel({
        seed,
        palette,
        bounds: { ...DEFAULT_BOUNDS, ...(bounds ?? {}), obstacleTarget: step },
        budget: b,
        /** ⛓ ARC 5, SLICE 1 — the room contract; the strip is applied at the
         *  end of pass 2, inside `generateSeedlingLevel`. */
        defaults,
        fill,
        /** ⛓ SLICE 5a (D2) — the EFFECTIVE spec, so a typed `chambers=0` reaches
         *  the carve. `seedlingSkeletonSpec` is idempotent, so the model
         *  re-resolving it moves nothing. */
        skeleton: skelEffective,
        /** ⛓ SLICE 5a (D1) — and the three parameters, as the CLI passes them. */
        elements,
        areas,
        require,
    });
    return Object.freeze({
        seed,
        biome,
        palette,
        roster: palette.roster ?? null,
        step,
        model: out.model,
        record: out.record,
        trace: out.trace,
        summary: out.summary,
        keptTemplates: keptTemplatesOf(out.summary, palette),
        directives: Object.freeze([]),
        /** ⛓⛓ SLICE 11 — see the step-0 branch for why it is a list and not absent. */
        edits: Object.freeze([]),
        skeleton: skelEffective,
        /** ⛓ ARC 5, SLICE 1 — see the step-0 branch. */
        size: Object.freeze({ width: size.width, height: size.height }),
        fill,
        /**
         * ⛓⛓ SLICE 5a (D1) — READ OFF `out.summary`, which is where
         * `generateSeedlingLevel` already puts the CLI's own three blocks. ⛔ A
         * second derivation here would be a second answer to *what did the
         * element do*, one refactor from disagreeing with the payload.
         */
        elements: out.summary.elements ?? null,
        areas: out.summary.areas ?? null,
        require: out.summary.require ?? null,
        /** ⛓⛓ SLICE 5a — the PASS-1 ledger; pass 2 is `trace` and is not
         *  duplicated here. */
        ledger: out.ledger,
        stop: out.summary.stop,
        /**
         * ⚠ TWO SPELLINGS OF ONE FACT, AND ONLY ONE OF THEM IS RELIABLE HERE.
         * `stop` is the LOOP's own answer for the target it was given, and a
         * ladder rung asks for exactly as many as it expects — so a rung that
         * kept fewer than it asked for is the saturated one whatever `stop`
         * says. The RUN-ALL driver reads THIS.
         */
        saturated: out.summary.stop === STOP.SATURATED || out.summary.keptCount < step,
        budget: b,
        bounds: { ...DEFAULT_BOUNDS, ...(bounds ?? {}), obstacleTarget: step },
    });
}

/**
 * ── ⛓⛓⛓ VERB 2, APPLIED — one directive onto the state on screen ──────
 *
 * ⚖ Ruling 1: *"a button to make the generator attempt to generate that
 * specific thing."* This is that button without the DOM: a SPEC in, a NEW
 * state out, with the directive RECORDED on it.
 *
 * ⛔ **THE STATE IT RETURNS IS THE SAME SHAPE `generateStep` RETURNS**, so
 * every consumer — `displaySolve`, `displayStaging`, `generationRows`,
 * `describeState`, the payload, the URL writer — meets one object and none of
 * them learns that a directive happened. That is what keeps this a second
 * ENTRY rather than a second kind of level.
 *
 * ⛔ **`summary` STAYS THE LADDER'S.** It describes the RUN that produced the
 * prefix, and a directive is not part of that run: rewriting `keptCount` into
 * it would make the payload claim a loop kept something no loop drew. The
 * directives ride BESIDE it, in order, which is exactly what ⚖ §3.5 asks for.
 *
 * ⛓ `keptTemplates` DOES grow on a keep, and that is load-bearing rather than
 * bookkeeping: it is what the pin union is taken over, so a water pool placed
 * by a directive obliges `'sound'` in every later solve and in the staging
 * block the bridge hands to the other arms. A directive that placed geometry
 * without joining that list would certify the room under fewer pins than it
 * contains — slice 3 track A's defect, re-introduced one entry over.
 *
 * @param {object} state the state a directive is applied TO (any step).
 * @param {object} spec  `{template, params, anchor, keepPolicy, bound}` — a
 *   `parseDirective` output, or the same shape from the page's form.
 * @param {number} index the directive's 0-based position, which is part of its
 *   stream derivation — see `directiveSeed`.
 */
export function applyDirective(state, spec, index) {
    if (!Number.isInteger(index) || index < 0) {
        fail(`watchGenerate: a directive needs its 0-based index, got ${JSON.stringify(index)}. `
            + 'The index is part of the anchor stream\'s derivation, so two identical '
            + 'directives ask two different questions rather than walking one order twice.');
    }
    /**
     * ── ⛓⛓⛓ SLICE 11 — **EDITS COME AFTER ALL DIRECTIVES**, and this is the
     * ── backstop that makes it a law rather than a UI convention ──────────
     *
     * ⚖ The ordering question the slice had to answer: *edits then directives*
     * and *directives then edits* are DIFFERENT levels, so a payload carrying
     * two flat lists cannot say which happened. The honest shapes were (1) ONE
     * ordered `history: [{kind:'directive'|'edit', …}]` replacing both arrays,
     * and (2) a rule that fixes the order so two lists are enough.
     *
     * ⛔ (1) WAS NOT TAKEN, and the reason is scope: it changes slice 5's
     * payload shape and `?directed=`'s semantics (a directive's index IS its
     * anchor stream's salt — `directiveSeed` — so re-indexing them inside a
     * mixed history is a determinism change, not a rename). ⇒ **v1 RULE: the
     * reconstruction is ladder → directives → edits, always.** The two lists
     * stay separate and mean exactly one construction. A directed attempt on
     * an edited level refuses BY NAME, here and — before the press, with the
     * friendlier sentence — in `watchViewer`'s `attempt()`.
     *
     * ⚠ THE PRICE IS STATED: you cannot direct a template onto a hand-edited
     * room without undoing the edits first. That is a real loss and it is
     * recorded as residue; slice 12 or the elements arc may revisit it with
     * the ONE-history shape.
     */
    if ((state.edits ?? []).length > 0) {
        fail(`watchGenerate: this level carries ${state.edits.length} manual edit(s), and a `
            + 'directed attempt onto it would make the construction ORDER unrecoverable — '
            + 'the payload carries `directives` and `edits` as two lists, which means '
            + 'exactly one thing only because the rule is ladder → directives → edits. '
            + 'UNDO the edits, or download the payload first.');
    }
    const palette = paletteFor(state.biome);
    const base = palette.templates.find((t) => t.name === spec?.template);
    if (!base) {
        fail(`watchGenerate: a directive names template ${JSON.stringify(spec?.template)}, `
            + `which the ${state.biome} palette does not hold — it offers `
            + `[${palette.templates.map((t) => t.name).join(', ')}].`);
    }
    /**
     * ⛓⛓⛓ **`PREFER_DISCHARGE` LEFT SEEDLING IN ARC-3 SLICE 4c** (⚖ user,
     * 2026-08-17). Two independent reasons, and the second is what made the
     * first unarguable:
     *
     *  1. S1 §11.9 measured the `solved-only` class STRUCTURALLY EMPTY here —
     *     the preference had nothing to prefer over.
     *  2. Slice 4c retired the last three templates that have a VERB at all
     *     (`wall-gap-block`/`shove`, `wall-gap-lock-weigh`/`weigh`,
     *     `wall-gap-spinner-killlock`/`kill` — they became ELEMENTS). Every row
     *     the two palettes still hold is `wall`/`water`/`pit`, for which
     *     `dischargesVerb` answers `null` ⇒ `KEPT_KIND.NO_VERB` ⇒ taken
     *     immediately. The two policies now choose identically at every anchor,
     *     by construction rather than by measurement.
     *
     * ⛔ A SPEC MAY NOT NAME ONE. It refuses rather than being ignored: a caller
     * that asked for `prefer-discharge` and silently got `first-solved` would
     * get the outcome it asked to improve on with nothing able to say why — the
     * same argument `walkAnchors` makes about a missing predicate.
     *
     * ⛓ `KEEP_POLICY` STAYS IN `levelGenerator.js` FOR THE MAZE, which has not
     * measured its own `solved-only` class and whose palette still holds verbs.
     * This is a SEEDLING retirement, not the mechanism's.
     */
    if (spec.keepPolicy !== undefined && spec.keepPolicy !== DIRECTIVE_KEEP_POLICY) {
        fail(`watchGenerate: a directive names keep policy ${JSON.stringify(spec.keepPolicy)}. `
            + `Seedling runs every directive under ${JSON.stringify(DIRECTIVE_KEEP_POLICY)} `
            + 'since PROCGEN ELEMENTS arc 3 slice 4c: no template either palette still holds '
            + 'has a VERB to discharge, so `prefer-discharge` would prefer nothing. ⛔ Say '
            + 'nothing, rather than saying a policy this substrate cannot honour.');
    }
    const keepPolicy = DIRECTIVE_KEEP_POLICY;
    const bound = spec.bound ?? DIRECTED_ANCHOR_TRIES;
    /**
     * ⛓ THE PARAMETER STREAM — its own, so an "any" choice that DRAWS a value
     * cannot move the anchor walk. See `directiveSeed`. A spec that names every
     * parameter spends no draw here at all, which is precisely why the two
     * streams must be separate for a replay to be byte-identical.
     */
    const template = base.instantiate(
        rngFor(directiveSeed(state.seed, index, PARAM_SALT, SEED_MAX)), spec.params ?? {},
    );
    const out = directedAttempt({
        rng: rngFor(directiveSeed(state.seed, index, ANCHOR_SALT, SEED_MAX)),
        model: state.model,
        oracle: oracleFor(state),
        record: state.record,
        template,
        keptRows: state.keptTemplates,
        /**
         * ⛓⛓⛓ SLICE 6 — THE CLICKED CELL. `null` is a SEARCH, which is every
         * directive before this slice; a cell makes the walk one anchor long
         * and puts `model.refusalAt` in front of the oracle. ⛔ The spec's
         * anchor goes in UNCHANGED, so what the record reports as ASKED FOR is
         * the same object the URL spelled.
         */
        anchor: spec.anchor ?? null,
        bound,
        keepPolicy,
        /**
         * ⛔ NO `discharges` PREDICATE ANY MORE (slice 4c). `walkAnchors` REQUIRES
         * one under `prefer-discharge` and IGNORES it under `first-solved`, so
         * passing it here would be an argument that decides nothing — and a
         * reader would take its presence for the policy still being live.
         * `dischargesVerb` itself stays: the batch and both sweeps ask it.
         */
        rowBase: { directive: index + 1, step: state.step, try: null },
    });
    /**
     * ⛔ THE RECORDED DIRECTIVE CARRIES ITS INPUTS **AND** ITS RESULTS, and the
     * two are distinguishable: `anchor` is the anchor that was ASKED for (slice
     * 6's field, `null` today) while `at` is where it LANDED. Collapsing them
     * would make a slice-6 directive unable to say whether its cell was honoured.
     *
     * ⚠ `params` is the RESOLVED values object, never the spec's partial one —
     * so a directive that left a parameter to be drawn records the DRAWN value
     * and a replay rebuilds that exact instance rather than re-drawing.
     */
    const recorded = Object.freeze({
        template: base.name,
        instance: template.instance,
        params: template.params,
        family: base.family,
        anchor: spec.anchor ?? null,
        keepPolicy,
        bound,
        outcome: out.outcome,
        keptKind: out.keptKind,
        at: out.at,
        anchorsOffered: out.anchorsOffered,
        anchorsWalked: out.anchorsWalked,
    });
    return Object.freeze({
        ...state,
        record: out.record,
        trace: Object.freeze([...(state.trace ?? []), ...out.rows]),
        keptTemplates: out.outcome === 'KEPT'
            ? Object.freeze([...state.keptTemplates, template])
            : state.keptTemplates,
        directives: Object.freeze([...(state.directives ?? []), recorded]),
    });
}

/**
 * ⛓⛓⛓ THE WHOLE CONSTRUCTION, FROM ITS IDENTITY — the ladder to step k, then
 * the directives in order.
 *
 * ⛔ **ONE PATH.** The page presses one directive at a time and this replays
 * them in a batch, and they must agree byte for byte — so the page calls
 * `applyDirective` with the same index this does, and this is what a `?directed=`
 * load, the payload check and the tests all go through. A second replay path
 * would be a second answer to *"what does this link mean"*.
 */
export function generateWithDirectives({
    seed, biome, step, bounds, budget, roster = null, directed = null,
    skeleton = DEFAULT_SKELETON, edits = null, size = SEEDLING_DEFAULTS, fill = FILL_DENSE,
} = {}) {
    /**
     * ⛓⛓ ARC 5, SLICE 1 — the room contract rides the LADDER, and the
     * directives then act on whatever record the ladder produced. ⛔ On a
     * `shell` room that means a directive meets ABSENT cells, and both pass-2
     * adjudicators refuse them BY NAME (`procgenSeedling`'s `freeRefusal` and
     * `carveCellRefusal`) rather than misreading them as terrain an earlier
     * template wrote.
     */
    let state = generateStep({ seed, biome, step, bounds, budget, roster, skeleton, size, fill });
    (directed ?? []).forEach((spec, i) => { state = applyDirective(state, spec, i); });
    /**
     * ⛓⛓⛓ SLICE 11 — THE THIRD LEG, AND ITS ORDER IS THE RULE (see
     * `applyDirective`'s backstop): ladder → directives → edits. ⛔ Through
     * `watchEdit.editStates`, which is the SAME fold the page's UNDO and the
     * `?gen=` replay use — one reconstruction, so a payload emitted by node and
     * a level hand-edited in the browser are the same bytes or a finding.
     */
    return editStates(state, edits);
}

/**
 * The concrete ROWS a summary's kept list names — what the oracle needs to
 * take the pin union over (⚖ §9.4: the water template obliges `'sound'` BY
 * ARGUMENT). A name the palette does not hold is a defect, not a missing pin,
 * so it refuses rather than dropping the row.
 *
 * ⛓⛓ SLICE 2: THIS IS NOT A LOOKUP ANY MORE, IT IS A RECONSTRUCTION — and it
 * is the SAME one `procgenSeedling.generateSeedlingLevel` uses for its own pin
 * union. `k.template` names a BASE (no footprint, no pins, no geometry); the
 * instance is rebuilt from `{template, params}` by `instantiateKept`, which
 * REFUSES rather than defaulting when a parameter is missing. ⛔ Two private
 * reconstructions of one instance would be two cost models, so there is one.
 */
export function keptTemplatesOf(summary, palette) {
    return (summary?.kept ?? []).map((k) => instantiateKept(palette, k));
}

/**
 * THE DISPLAY SOLVE — the current record, through the loop's OWN oracle.
 *
 * ⛔ `seedlingOracle` is `procgenSeedling`'s, built from the state's own model
 * and the palette's own items, which is exactly what `generateSeedlingLevel`
 * builds internally. Not a second oracle, not a second staging block, not a
 * second goal list.
 *
 * ⚠ IT RETURNS THE ORACLE'S VERDICT OBJECT UNCHANGED, refusals included — a
 * REFUSED display solve is a real answer (a mid-ladder record is always one
 * the loop SOLVED, so a refusal here would be a genuine disagreement worth
 * seeing rather than an exception to swallow).
 */
export function displaySolve(state) {
    return oracleFor(state).solve(state.record, { templates: state.keptTemplates });
}

/** The state's own oracle — one construction, two callers. */
const oracleFor = (state) => seedlingOracle({
    model: state.model,
    items: state.palette.items ?? null,
    budget: state.budget,
});

/**
 * ── ⛓⛓⛓ THE STAGING BLOCK THIS RECORD IS SOLVED UNDER (switch slice 4) ──
 *
 * The bridge hands a generated level to the SOLVE and MANUAL arms, and those
 * arms start from a staging block in a textarea. This is the block the
 * generator's own oracle uses, built from the same three inputs
 * (`model.boot()`, the palette's items, the pin union over the kept
 * templates) through the same `bootStaging`.
 *
 * ⛔ THE PINS ARE THE PART THAT IS EASY TO DROP AND EXPENSIVE TO LOSE. They
 * are computed from the KEPT TEMPLATES — the water template obliges `'sound'`
 * BY ARGUMENT (⚖ §9.4) — so a block built without them would solve the same
 * room under fewer pins than the loop did, and quietly answer a different
 * question than the certification.
 *
 * ⚠ ITS EQUALITY WITH THE DISPLAY SOLVE IS ASSERTED, NOT ASSUMED: the oracle
 * builds its staging internally, so this reconstructs rather than shares, and
 * `watchGenerate.test.js` solves a record BOTH ways and compares the verdict
 * and the tick count. A reconstruction nobody compares is a second cost model.
 */
export function displayStaging(state) {
    return bootStaging({
        boot: state.model.boot(),
        items: state.palette.items ?? null,
        pins: oracleFor(state).pinsFor(state.keptTemplates),
    });
}

/**
 * ⛓⛓ DOES THE DISPLAY SOLVE AGREE WITH THE TRACE ROW THAT ACCEPTED THIS
 * RECORD? Same inputs ⇒ same walk, so the answer should always be yes — and
 * "should always" is the reason it is asked out loud.
 *
 * ⛓ THERE IS NO LONGER AN HONEST WAY TO DIFFER (2026-08-14). The one that
 * existed was the POST-HOC WALL CLOCK: `procgenOracle` classified a solve that
 * took longer than `wallClockMs` as `BUDGET_EXHAUSTED` even when it SOLVED, so
 * a machine under load moved the verdict without moving the walk (§13.8's
 * measured flake). That clock is GONE, and with it the flake — a disagreement
 * reported here is now a REAL disagreement and worth chasing. Both the tick
 * count and the verdict are still reported, because a check that stopped
 * reporting the thing it used to excuse would be a check nobody could audit.
 */
export function agreementWithTrace(state, solved) {
    const rows = (state.trace ?? []).filter((r) => r.outcome === 'KEPT');
    const last = rows.length ? rows[rows.length - 1] : null;
    if (!last) return { compared: false, agrees: true, why: 'no KEPT row to compare against' };
    const agrees = last.ticks === (solved.ticks ?? null);
    return {
        compared: true,
        agrees,
        traceTicks: last.ticks,
        displayTicks: solved.ticks ?? null,
        traceVerdict: last.verdict,
        displayVerdict: solved.verdict,
        why: agrees
            ? null
            : `the display solve walked ${solved.ticks ?? 'no'} tick(s) where the trace's `
                + `accepting row recorded ${last.ticks}. Same record, same staging, same `
                + 'goals, same budget — so this is a DISAGREEMENT and not a rounding, and '
                + 'the page says so rather than drawing the one it happens to hold.',
    };
}

/**
 * ⛓⛓⛓ `?gen=` — REPRODUCE AN EMITTED PAYLOAD AND CHECK IT, which is a
 * stronger contract than loading one.
 *
 * The CLI's payload carries `{seed, biome, bounds, level, trace, …}`. The arm
 * could draw `payload.level` directly; instead it GENERATES from the
 * payload's own seed/biome/count and compares. ⛔ That keeps ONE path into
 * the page — every level the page draws came out of the loop, in the page —
 * and it turns the export into a determinism check across two runtimes
 * (node's CLI and the browser's) rather than a picture of a file.
 *
 * ⚠ A MISMATCH IS THE FINDING, so it is returned rather than thrown: the page
 * shows the room it generated AND says the payload disagreed, which is the
 * RAW TRUTH law. A silent redraw of the payload would be the graceful
 * fallback that reports a vacuous success.
 */
export function agreementWithPayload(payload, state) {
    const differences = [];
    const cmp = (what, a, b) => {
        if (JSON.stringify(a) !== JSON.stringify(b)) differences.push(what);
    };
    if (!payload || typeof payload !== 'object') {
        return { checked: false, agrees: false, differences: ['the payload is not an object'] };
    }
    cmp('seed', payload.seed, state.seed);
    cmp('biome', payload.biome, state.biome);
    /**
     * ⛓ SLICE 4: THE ROSTER IS AN IDENTITY FIELD LIKE THE OTHERS. A payload
     * generated under a RESTRICTION and reproduced under the whole roster
     * would report a DIVERGENCE about the level while the actual difference is
     * the question that was asked — a false finding, fired by the check that
     * exists to catch real ones. ⚠ `?? null` on both sides: a payload written
     * before this field existed names no roster, and "no roster" is what an
     * unrestricted run has, so an OLD payload does not diverge here.
     */
    cmp('roster', payload.roster ?? null, state.roster ?? null);
    /**
     * ⛓⛓ ARC 5, SLICE 1 — **THE ROOM CONTRACT IS AN IDENTITY FIELD**, for the
     * roster's own reason: a payload built at 20x12 and reproduced at the
     * default 10x10 would report a LEVEL divergence whose real cause is that a
     * different ROOM was asked for. ⚠ `?? SEEDLING_DEFAULTS`' pair and `??
     * dense` on both sides, so every payload written before this slice — all of
     * them — reads as the default room and does not falsely diverge.
     *
     * ⛔ THE SIZE IS TAKEN OFF THE PAYLOAD'S OWN LEVEL RECORD when the payload
     * carries no `size` block, because the record IS the room and a payload
     * cannot disagree with the level inside it.
     */
    const payloadSize = payload.size
        ?? (Number.isInteger(payload.level?.width) && Number.isInteger(payload.level?.height)
            ? { width: payload.level.width, height: payload.level.height }
            /**
             * ⚠ A payload whose LEVEL carries no dimensions is a hand-built or
             * truncated file, and `level` is already the difference it will
             * report. Falling back to the default here keeps that ONE finding
             * one finding — the shape `skeleton`'s own comparison names (*two
             * findings for one cause*).
             */
            : { width: SEEDLING_DEFAULTS.width, height: SEEDLING_DEFAULTS.height });
    cmp('size', payloadSize,
        { width: state.size?.width ?? SEEDLING_DEFAULTS.width,
            height: state.size?.height ?? SEEDLING_DEFAULTS.height });
    cmp('fill', payload.fill ?? FILL_DENSE, state.fill ?? FILL_DENSE);
    /**
     * ⛓ SLICE 5: THE DIRECTIVES ARE AN IDENTITY FIELD LIKE THE ROSTER. ⚖ §3.5:
     * the level IS the ladder plus these, so a payload built with two directives
     * and reproduced with none would report a LEVEL divergence whose real cause
     * is that a different construction was asked for. ⚠ `?? []` on both sides:
     * a payload written before this field existed names no directives, and "no
     * directives" is exactly what a plain ladder run has — so an OLD payload
     * does not falsely diverge here.
     */
    cmp('directives', payload.directives ?? [], state.directives ?? []);
    /**
     * ⚖ Ruling 9(b)'s reserved block. It is compared for the same reason and
     * with the same both-sides default: today there is one kind of skeleton, so
     * every payload agrees — and on the day the constructive mode adds a second,
     * a reproduction under the wrong one says WHICH field differed instead of
     * reporting an unexplained level divergence.
     */
    /**
     * ⛓⛓ SLICE 7 — NORMALIZED ON BOTH SIDES, and that is what makes the
     * both-sides default REAL rather than nominal. A payload written before the
     * kind parameters existed carries `{kind}`; a page at all-defaults produces
     * `{kind}` too, because `normalizeSkeleton` OMITS a value at its default.
     * ⛔ Without the normalization a page that had merely TOUCHED the form
     * would carry `{kind, params:{chambers:0}}` and report a divergence in a
     * field that says the same thing.
     *
     * ⛔⛔ AND THE PAYLOAD SIDE IS NORMALIZED **WITHOUT VALIDATION** — a defect
     * my own suite caught the first time this line was written. A payload
     * naming a RETIRED kind (`open-room`, `empty-bordered`) is precisely what
     * this comparison exists to REPORT BY NAME; a normalizer that refused it
     * turned the report into a throw, and the page would have died on the file
     * it was asked to explain.
     */
    cmp('skeleton', normalizeSkeleton(payload.skeleton ?? DEFAULT_SKELETON, { validate: false }),
        normalizeSkeleton(state.skeleton ?? DEFAULT_SKELETON));
    /**
     * ── ⛓⛓⛓ SLICE 11: THE EDIT LIST IS AN IDENTITY FIELD, AND THE STRONGEST
     * ── ONE — because it is the only part of a level NO SEED WILL REPRODUCE ──
     *
     * ⚖ Ruling 9 puts the edits in the PAYLOAD and keeps them out of the URL.
     * That makes this comparison the whole cross-runtime claim for an edited
     * level: `state.record` here has already had `payload.edits` folded onto
     * it (the `?gen=`/host-load path replays them through `watchEdit.editStates`
     * — the ONE reconstruction), so `level` below is a byte comparison of *the
     * recipe plus these ops in this order*, computed twice on two runtimes.
     *
     * ⛔ AND THE LIST ITSELF IS COMPARED SEPARATELY, not left to be inferred
     * from a level divergence: a payload whose edits the page did NOT replay
     * must say WHICH FIELD disagreed rather than reporting an unexplained
     * difference in a 100-tile grid. ⚠ `?? []` on both sides — a payload
     * written before this field existed names no edits, which is exactly what
     * an unedited run has, so an OLD payload does not falsely diverge.
     *
     * ⛔⛔ THE MAZE DOES THE OPPOSITE AND THE DIFFERENCE IS FORCED, not a
     * taste: `mazeLab.agreementWithPayload` REFUSES to reproduce an edited
     * payload and sends the reader to its LOAD box (`deserializeMazeLevel`
     * takes a level as it stands). watch.html has no such box and never had one
     * — `?gen=` has always meant REGENERATE-AND-COMPARE — so reconstruction is
     * the only way an edited Seedling level can round-trip at all, and it buys
     * the stronger claim in exchange.
     */
    /**
     * ── ⛓⛓⛓ SLICE 5a (D1) — **THE THREE PARAMETERS ARE IDENTITY FIELDS**, on
     * ── the roster's own terms, and each is asked in its OWN SPELLING ──────
     *
     * ⛔ COMPARED ONLY WHEN THE PAYLOAD CARRIES THE BLOCK. A payload written
     * before a block existed is not a payload that asked for nothing — it is a
     * payload from a run in which the thing did not exist — so the honest
     * report is *"this page's run HAS one and yours did not"*, named, rather
     * than a divergence in a field the file could not have had. That is D1's
     * *"refuse by name a payload that predates them only if it also carried a
     * non-default"*, said from the other end.
     *
     * ⚠ THE SPELLINGS DIFFER AND THE COMPARISON RESPECTS IT (see
     * `describeState`): `elements.spec` is the normalized OBJECT and
     * `areas.spec` is ALREADY THE STRING. ⛔ A comparison that formatted both
     * would report `0` against `1` on every `--areas=` payload.
     */
    /**
     * ⚠ **A PAYLOAD WITH NO `summary` AT ALL MAKES NO CLAIM HERE**, and that is
     * a different case from one that has a summary WITHOUT the block. The
     * second is a run in which the thing genuinely did not happen — a pre-4c
     * file, from before the biome default put an element in every level — and
     * it is named. The first is a hand-built or step-0 payload that never
     * reported a summary at all, and inventing a divergence for it would be
     * this check firing on its own fixtures.
     */
    if (payload.summary?.elements) {
        cmp('elements', payload.summary.elements.spec, state.elements?.spec ?? null);
    } else if (payload.summary && state.elements) {
        differences.push('elements (the payload predates the biome DEFAULT element spec — its '
            + 'run held no element and this one does)');
    }
    if (payload.summary?.areas) {
        cmp('areas', payload.summary.areas.spec, state.areas?.spec ?? null);
    } else if (payload.summary && state.areas) {
        differences.push('areas (the payload asked for no area graph and this run did)');
    }
    /** ⛓ `?? null` ON BOTH SIDES — *no directive* is what a plain run has, so
     *  an old payload does not falsely diverge. */
    cmp('require', payload.summary?.require?.asked ?? null, state.require?.asked ?? null);
    cmp('edits', payload.edits ?? [], state.edits ?? []);
    cmp('level', payload.level, state.record);
    cmp('trace', payload.trace, state.trace);
    return {
        checked: true,
        agrees: differences.length === 0,
        differences,
        why: differences.length === 0
            ? null
            : `the payload and this page's own generation differ in [${differences.join(', ')}]. `
                + 'The page is showing WHAT IT GENERATED; the payload was emitted by '
                + '`generate-seedling-level.mjs` from the same seed, so a difference is a '
                + 'determinism finding across the two runtimes, not a display problem.',
    };
}

/**
 * The one-line summary of a state, for the status bar and the CLI readout.
 * ⛔ Every bound that ran is in it — ⚖ kickoff §5's "bounded sweeps name
 * their bounds", where a reader can actually see them.
 */
export function describeState(state, solved = null) {
    const s = state.summary;
    /**
     * ⛓⛓ SLICE 5a (D2) — ONE SPELLING, AND IT IS THE BAR'S. `formatSkeleton`
     * alone drops a value at the CODEC's default, so a level built with a typed
     * `chambers=0` would print `winding` while the address bar said
     * `winding;chambers=0` — two answers to *which room is this*, which is the
     * defect this line exists to prevent.
     */
    const spellSkeleton = (spec) => formatSkeleton(spec ?? DEFAULT_SKELETON,
        { explicit: seedlingExplicitSkeletonParams(spec?.kind) });
    const bits = [
        /**
         * ⛓⛓ SLICE 5: THE IDENTITY LINE SAYS WHAT THE LEVEL IS — ⚖ §3.5's own
         * sentence, *"seed S's ladder to step k, then N directed attempt(s)"*.
         * A page that showed a directed level under a ladder-only identity would
         * be naming a run nobody can reproduce from what it printed.
         */
        /**
         * ⛓ SLICE 5 OF THE CONSTRUCTIVE ARC — THE SKELETON KIND, NAMED ONLY
         * WHEN IT IS NOT THE OPEN ROOM. ⛔ A line that said `· empty` on every
         * level would train a reader to stop reading the clause, and the one
         * time it matters is the one time it is there. (The same rule the
         * "URL is not a reproduction after edits" clause follows on the maze
         * page.)
         */
        /**
         * ⛓⛓ SLICE 7 — AND ITS PARAMETERS, in the URL's own spelling
         * (`rooms;minRoom=2;chambers=1`). ⛔ ONE formatter, shared with the bar
         * and both CLIs: an identity line that spelled the room differently
         * from the link beside it would be two answers to "which room is this".
         * A parameter AT its default is not named, for the same reason `empty`
         * is not.
         */
        `seed ${state.seed} · ${state.biome} · step ${state.step}`
            + (state.skeleton && spellSkeleton(state.skeleton) !== DEFAULT_SKELETON_KIND
                ? ` · skeleton: ${spellSkeleton(state.skeleton)} (CARVED, not the open room)`
                : '')
            /**
             * ⛓⛓ ARC 5, SLICE 1 — **THE ROOM, NAMED ONLY WHEN IT IS NOT THE
             * PINNED ONE** (⚖ rulings 1 and 2), which is `empty`'s own rule one
             * clause over: a line that said `· 10x10 dense` on every level would
             * train a reader to stop reading it, and the one time it matters is
             * the one time it is there. ⛔ It is on the identity line because a
             * level built in a 20x10 SHELL room and one built in the pinned
             * 10x10 dense room are different levels, and until this clause
             * existed the two printed the same sentence.
             */
            + ((state.size && (state.size.width !== SEEDLING_DEFAULTS.width
                || state.size.height !== SEEDLING_DEFAULTS.height))
                ? ` · room: ${state.size.width}x${state.size.height}` : '')
            + (state.fill && state.fill !== FILL_DENSE ? ` · fill: ${state.fill}` : '')
            + ((state.directives ?? []).length
                ? `, then ${state.directives.length} directed attempt(s)` : '')
            /**
             * ⛓⛓⛓ SLICE 11 — THE THIRD LEG OF THE IDENTITY, IN ITS ORDER.
             * ⚖ §3.8(a): an edited level is *"ladder + directives + N manual
             * edits"*, and the order is the rule (`applyDirective`'s backstop).
             * ⛔ Named only when there ARE edits, for the same reason `empty` is
             * not named: a clause on every line is a clause a reader stops
             * reading.
             */
            + ((state.edits ?? []).length
                ? `, then ${state.edits.length} manual edit(s)` : ''),
        /**
         * ⛓⛓⛓ ARC 5, SLICE 6b — **THE DENSITY IDENTITY BLOCK** (§3.6): the six
         * levers that decide how much room there is and how much is in it, in
         * ONE line, spelled by `procgenCore/densityBlock.js` — the same function
         * the maze page and both CLIs call, so the four readouts cannot drift.
         *
         * ⛔ IT READS; IT DOES NOT COMPUTE. The room is the RECORD's own
         * `width`/`height` (never the asked size — a refused size never becomes
         * a room), the fill is the DECLARED word (never a guess from the written
         * cell count: `fill=shell` on an open room strips 0%), and the element is
         * the head the stream RESOLVED, not the `+` list that was asked for.
         *
         * ⛔ ALL SIX PRINT ON EVERY LEVEL — the one deliberate exception to this
         * line's own "name it only when it is not the default" rule, and the
         * module's docblock carries the reason: a DIAL is read by seeing every
         * position at once.
         */
        densityLine({
            skeleton: state.skeleton ?? DEFAULT_SKELETON,
            width: state.record?.width ?? state.size?.width ?? SEEDLING_DEFAULTS.width,
            height: state.record?.height ?? state.size?.height ?? SEEDLING_DEFAULTS.height,
            fill: state.fill ?? FILL_DENSE,
            element: state.model?.elementHead ?? state.elements?.spec ?? null,
            obstacleTarget: state.bounds.obstacleTarget,
        }),
        /**
         * ⛓ SLICE 4: THE ROSTER THE RUN DREW FROM, by the palette's own name —
         * `pre-sword` unrestricted, `pre-sword[families:pit,water]` under verb
         * 1. ⛔ It is the SAME string `summary.palette` carries, so the
         * readout and the payload cannot disagree about what was on offer.
         */
        `palette: ${state.palette?.name ?? '(none)'}`
            + (state.roster ? '' : ' (the WHOLE roster — no restriction)'),
        s ? `kept ${s.keptCount}/${state.bounds.obstacleTarget} over ${s.attempts} attempt(s)`
            : `the SKELETON — ${state.skeleton?.kind === DEFAULT_SKELETON_KIND
                ? 'the bordered room' : `a ${spellSkeleton(state.skeleton)} CARVE`} and its `
                + 'goal, before any template',
        `bounds: target=${state.bounds.obstacleTarget} tries=${state.bounds.triesPerStep} `
            + `k=${state.bounds.saturationK} `
            + `anchortries=${state.bounds.anchorTriesPerCandidate}`,
        `budget: ${state.budget.maxTicksPerTarget} ticks per target (⛓ TICKS, not ms)`,
    ];
    /**
     * ── ⛓⛓⛓ SLICE 5a (D1) — **THE THREE CLAUSES, IN THE CLI's OWN WORDS** ──
     *
     * ⛔ Printed only when the thing was ASKED FOR (or, for the element,
     * whenever one RAN — which under 4c's biome default is nearly always), the
     * same rule `skeleton:` follows: a clause on every line is a clause a
     * reader stops reading. ⛓ The vocabulary is `generate-seedling-level.mjs`'s
     * — `requires: … MET/NOT MET … grade`, `areas: <spec> — N area(s) …`,
     * `element: <asked> -> drew <head> … CERTIFIED` — so the page and the CLI
     * say one sentence about one level rather than two that agree.
     */
    /**
     * ⛔⛔ **THE TWO BLOCKS SPELL THEIR SPEC DIFFERENTLY, AND THIS SLICE READS
     * RATHER THAN FIXES IT** — arc-2 §11.5/§11.11's *"a REPORT, not a SPEC"*
     * residue, arriving on Seedling.
     *
     *   `summary.elements.spec` is the normalized OBJECT   (`{name, params}`)
     *   `summary.areas.spec`    is ALREADY THE STRING      (`areaSummaryOf`)
     *
     * ⛔ Unifying them would move `summary` on EVERY committed payload — under
     * 4c's biome default every Seedling level carries an `elements` block — so
     * the acceptance batch, both `empty` dumps and the carved dump would all
     * re-record for a spelling. ⇒ each is read in its own shape here, the
     * asymmetry is stated, and `agreementWithPayload` below does the same.
     * ⚠ A reader building a `?gen=` payload must carry BOTH: the element's spec
     * OBJECT and the area's spec STRING.
     */
    const e = state.elements ?? null;
    if (e) {
        const asked = formatElementSpec(e.spec);
        /** ⛓ A `+` LIST NAMES SEVERAL HEADS AND THE STREAM DREW ONE, so the
         *  line prints both — the CLI's own sentence. */
        const drew = state.model?.elementHead ? formatElementSpec(state.model.elementHead) : null;
        bits.push(`element: ${asked}`
            + (drew && drew !== asked ? ` -> drew \`${drew}\`` : '')
            + (e.ran
                ? ` — PLACED, CERTIFIED: ${e.certified}`
                : ` — ⛔ REFUSED: ${e.refused?.reason ?? '(no reason)'}`));
    }
    const a = state.areas ?? null;
    if (a) {
        bits.push(`areas: ${a.spec} — `
            + (a.ran
                ? `${a.symbols?.length ?? 0} symbol(s), ${a.lockCount ?? 0} lock(s), `
                    + `${a.flags?.length ?? 0} flag(s); CERTIFIED: ${a.certified}`
                : `⛔ REFUSED: ${a.refused?.reason ?? '(no reason)'}`));
    }
    const r = state.require ?? null;
    if (r) {
        /**
         * ⛓⛓ TWO SHAPES, AND THE LINE SAYS WHICH IT IS LOOKING AT. At step 0 a
         * directive is RESOLVED (it forced a head, or refused by name); the
         * GRADE only exists on a finished level, so a skeleton that printed
         * "NOT MET" would be reporting a verdict nobody has measured.
         */
        bits.push(r.met === undefined
            ? `requires: ${[].concat(r.asked).join(', ')} — `
                + (r.refused
                    ? `⛔ REFUSED: ${r.refused.reason}`
                    : `RESOLVED to the ${[].concat(r.heads).join('/')} element `
                        + '(the GRADE is measured on the FINISHED level, not on the skeleton)')
            : `requires: ${[].concat(r.asked).join(', ')} — ${r.met ? 'MET' : 'NOT MET'}`
                + (r.met ? `, grade ${[].concat(r.grade).join(', ')}`
                    : `; ⛔ ${r.refused?.reason ?? '(no reason)'}`));
    }
    /**
     * ⛓⛓⛓ SLICE 11 — ⚖ RULING 9, SAID ON THE PAGE. The URL writer never learns
     * about edits, so once there are any the address bar names the RECIPE and
     * not the level on screen. ⛔ The page says so where the identity is stated,
     * in the maze page's own words (one wording across the two substrates), and
     * only when it is true.
     *
     * ⛓⛓ SLICE 12 WIDENED THE CONDITION AND KEPT THE SENTENCE. The URL writer
     * no longer learns about DIRECTIVES either (⚖ §3.9), so the bar names the
     * ladder alone from the first directed attempt onward — which is exactly
     * the same claim, one clause earlier. ⚠ The wording dropped "after edits":
     * it named the one leg that used to be missing, and now either leg can be.
     */
    if ((state.directives ?? []).length || (state.edits ?? []).length) {
        bits.push('⚠ the URL is NOT a reproduction of this construction — it names the '
            + 'LADDER alone; the PAYLOAD is (Download level JSON + trace)');
    }
    if (state.stop) bits.push(`stop: ${state.stop}`);
    if (solved) {
        bits.push(`solve: ${solved.verdict}`
            + (solved.ticks ? ` in ${solved.ticks} ticks` : '')
            + (solved.scratchClears?.length
                ? ` · ${solved.scratchClears.length} scratch clear(s)` : ''));
    }
    return bits.join('  ·  ');
}

/**
 * ⛓⛓⛓ THE MOVED NAMES, RE-EXPORTED UNDER THE PATH EVERY CALLER ALREADY USES.
 *
 * CONSTRUCTIVE-MODE slice 3. The implementations are in
 * `procgenCore/urlParams.js` and `procgenCore/labView.js` (see the import
 * docblock for the measurement that decided the lift). ⛔ Re-exported rather
 * than re-imported at each call site because a page, a CLI, a batch, a browser
 * row and 1,500 lines of tests all reach these through `watchGenerate.js`, and
 * a lift that made 40 files change their imports would be a refactor pretending
 * to be a hoist.
 *
 * ⚠ `readRosterParams` is the ONE name that did not survive whole: it read the
 * URL AND validated against a biome's palette, and the palette half is
 * Seedling's. It is now `normalizeRoster(paletteFor(biome), readRosterSpec(q))`
 * at its one call site above — a composition of two things that already
 * existed, so nothing new was written to replace it.
 */
export {
    directiveSeed, formatDirectives, parseDirective, parseDirectives, stepFromParams,
} from '../procgenCore/urlParams.js';
export {
    describeKeptKind, directedCost, generationRows, ladderCost, tileAtPoint,
} from '../procgenCore/labView.js';

/**
 * ⛓ THE SKELETONS SECTION OF THE CATALOGUE + the kinds this binding offers —
 * re-exported from `procgenCore/skeletonKinds.js` under the path every Seedling
 * caller already uses, exactly as the URL grammar and the pane vocabulary are.
 */
export { skeletonCatalogue };
export { SEEDLING_SKELETON_KINDS };
export { STOP };
