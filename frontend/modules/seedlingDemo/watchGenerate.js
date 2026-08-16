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
    DEFAULT_BOUNDS, KEEP_POLICY, STOP, directedAttempt,
} from '../procgenCore/levelGenerator.js';
/**
 * ⛓⛓⛓ THE URL GRAMMAR AND THE PANE VOCABULARY LEFT THIS FILE IN
 * CONSTRUCTIVE-MODE SLICE 3 — `procgenCore/urlParams.js` + `labView.js`.
 *
 * ⚖ Kickoff §3.4 made the lift CONDITIONAL and the condition was measured (see
 * `urlParams.js`'s docblock): the bounds grammar, the roster grammar with its
 * scoped delete, the `run`+`count` step encoding, the WHOLE `?directed=`
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
    ANCHOR_SALT, PARAM_SALT, directiveSeed, intParam, parseDirectives, readBounds,
    readRosterSpec, readSkeleton, writeBounds, writeDirectedParam, writeInt, writeRosterParam,
    writeRunFlag, writeSkeletonParam,
} from '../procgenCore/urlParams.js';
import {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, dischargesVerb, instantiateKept, normalizeRoster,
    restrictPalette,
} from './procgenPalette.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, assertKind, skeletonCatalogue,
} from '../procgenCore/skeletonKinds.js';
import {
    SEEDLING_SKELETON_KINDS, generateSeedlingLevel, seedlingModel, seedlingOracle,
} from './procgenSeedling.js';
import { SEED_MAX, rngFor } from './procgenRng.js';

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
         * ⛓ SLICE 5 — VERB 2. `null` is "no directives"; otherwise the ordered
         * list of SPECS, each validated against this biome's own palette. ⚠ It
         * is read AFTER the roster on purpose: a directive names a template,
         * and the palette a directive is checked against is the biome's WHOLE
         * roster rather than the restricted one — verb 1 says what a RUN may
         * draw from, and verb 2 is the user naming a template by hand.
         */
        directed: q.get('directed') === null
            ? null : parseDirectives(q.get('directed'), paletteFor(biome)),
        /**
         * ⛓ SLICE 5 OF THE CONSTRUCTIVE ARC — THE ROOM THE LOOP STARTS FROM.
         * Absent is `empty` (the open bordered room). ⛔ A kind this binding
         * cannot run (`classic`/`corridor` need the maze simulator) refuses
         * HERE, at read time, with the list Seedling offers — before any solve
         * and before the page draws anything.
         */
        skeleton: readSkeleton(q, { simulator: false, substrate: 'the Seedling page' }),
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
    seed, biome, bounds, step, roster = null, directives = null, payloadOwned = false,
    skeleton = DEFAULT_SKELETON,
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
    writeSkeletonParam(q, skeleton, { simulator: false, substrate: 'the Seedling page' });
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
     * ── ⛓⛓ SLICE 5: THE DIRECTIVES, THE ARC'S SECOND NON-INTEGER PARAM ──
     *
     * ⛔ Written from the STATE's directive list like every other parameter
     * here, and through `formatDirectives`, which REFUSES what
     * `parseDirectives` would refuse — an unknown template, a missing
     * parameter value, a value outside its domain, an unspellable policy.
     * §8.6's standing law: a URL this page cannot reload must not be
     * writable in the first place.
     *
     * ⛓ AND THE PARAMETERS ARE WRITTEN IN **SCHEMA ORDER** rather than in the
     * order the values object happens to hold them, so the fixed point holds
     * whether a value was typed by the form or DRAWN by an "any" choice.
     *
     * ⚠ `?directed=` IS DELETED WHEN THERE ARE NO DIRECTIVES, never written
     * empty — the same rule `?families=` follows, and the reader refuses an
     * empty value for the same reason.
     */
    writeDirectedParam(q, directives, paletteFor(biome));
    writeRunFlag(q, step);
    return q.toString();
}

/**
 * THE STATE AT STEP k — the level, the trace so far, and what stopped it.
 *
 * `step === 0` is the SKELETON: the bordered room and its goal, before any
 * template is drawn. ⚖ §7.5 wants the empty-room case exercised and visible,
 * and it is the loop's own control (`generateLevel` refuses to start if the
 * skeleton does not solve), so the page shows the same room the loop checks.
 *
 * ⛔ THE STEP-0 MODEL IS `seedlingModel({seed})` — the SAME constructor
 * `generateSeedlingLevel` calls with the same argument, so the goal cell at
 * step 0 is the goal cell at every later step BY CONSTRUCTION rather than by
 * agreement. The test drives that equality.
 */
export function generateStep({
    seed, biome, step, bounds, budget, roster = null, skeleton = DEFAULT_SKELETON,
} = {}) {
    /**
     * ⛓ SLICE 5 OF THE CONSTRUCTIVE ARC — the room this ladder starts from,
     * validated ONCE here so step 0 and step k cannot disagree about it, and
     * refused by name for a kind Seedling cannot build.
     */
    const skel = Object.freeze({
        kind: assertKind(skeleton?.kind ?? DEFAULT_SKELETON_KIND,
            { simulator: false, substrate: 'the Seedling binding' }),
    });
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
        const model = seedlingModel({ seed, skeleton: skel });
        return Object.freeze({
            seed,
            biome,
            palette,
            // ⛓ The restriction the palette above CARRIES — one derivation, so
            // the URL writer and the payload cannot disagree with the loop.
            roster: palette.roster ?? null,
            step,
            model,
            record: model.skeleton(),
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
            /** ⚖ Ruling 9(b)'s block — the kind this room WAS built from. */
            skeleton: skel,
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
        skeleton: skel,
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
        skeleton: skel,
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
    const palette = paletteFor(state.biome);
    const base = palette.templates.find((t) => t.name === spec?.template);
    if (!base) {
        fail(`watchGenerate: a directive names template ${JSON.stringify(spec?.template)}, `
            + `which the ${state.biome} palette does not hold — it offers `
            + `[${palette.templates.map((t) => t.name).join(', ')}].`);
    }
    const keepPolicy = spec.keepPolicy ?? KEEP_POLICY.PREFER_DISCHARGE;
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
        // ⛓ THE ONE DISCHARGE TEST (`procgenPalette`), injected — `levelGenerator`
        // imports nothing, so the predicate reaches it as an argument. It is the
        // same function the batch and both sweeps ask.
        discharges: dischargesVerb,
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
    skeleton = DEFAULT_SKELETON,
} = {}) {
    let state = generateStep({ seed, biome, step, bounds, budget, roster, skeleton });
    (directed ?? []).forEach((spec, i) => { state = applyDirective(state, spec, i); });
    return state;
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
    cmp('skeleton', payload.skeleton ?? DEFAULT_SKELETON, state.skeleton ?? DEFAULT_SKELETON);
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
        `seed ${state.seed} · ${state.biome} · step ${state.step}`
            + (state.skeleton && state.skeleton.kind !== DEFAULT_SKELETON_KIND
                ? ` · skeleton: ${state.skeleton.kind} (CARVED, not the open room)` : '')
            + ((state.directives ?? []).length
                ? `, then ${state.directives.length} directed attempt(s)` : ''),
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
                ? 'the bordered room' : `a ${state.skeleton?.kind} CARVE`} and its goal, `
                + 'before any template',
        `bounds: target=${state.bounds.obstacleTarget} tries=${state.bounds.triesPerStep} `
            + `k=${state.bounds.saturationK} `
            + `anchortries=${state.bounds.anchorTriesPerCandidate}`,
        `budget: ${state.budget.maxTicksPerTarget} ticks per target (⛓ TICKS, not ms)`,
    ];
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
