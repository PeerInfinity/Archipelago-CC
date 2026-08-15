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
import { DEFAULT_BOUNDS, STOP } from './levelGenerator.js';
import { POST_SWORD_PALETTE, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { generateSeedlingLevel, seedlingModel, seedlingOracle } from './procgenSeedling.js';

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
    const int = (name, fallback) => {
        const raw = q.get(name);
        if (raw === null || raw === '') return fallback;
        const n = Number(raw);
        if (!Number.isInteger(n)) {
            fail(`watchGenerate: ?${name}=${JSON.stringify(raw)} is not an integer. Every `
                + 'bound this loop runs under is named in its own trace (⚖ kickoff §5), '
                + 'so there is no value that means "whatever".');
        }
        return n;
    };
    const source = (q.get('source') || '').toLowerCase();
    const gen = q.get('gen');
    if (q.get('budgetms') !== null) {
        // eslint-disable-next-line no-console
        console.warn('watchGenerate: ?budgetms is GONE and was IGNORED. Elapsed time no '
            + 'longer classifies a solve — it is not a property of the candidate. Use '
            + '?tickbudget= instead.');
    }
    return {
        isGenerate: source === 'generate' || (!source && gen !== null),
        seed: int('seed', 1),
        biome: (q.get('biome') || 'pre-sword').toLowerCase(),
        bounds: {
            obstacleTarget: int('count', DEFAULT_BOUNDS.obstacleTarget),
            triesPerStep: int('tries', DEFAULT_BOUNDS.triesPerStep),
            saturationK: int('k', DEFAULT_BOUNDS.saturationK),
        },
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
    seed, biome, bounds, step, payloadOwned = false,
} = {}) {
    const q = new URLSearchParams(search);
    if (payloadOwned) return q.toString();
    const int = (name, value) => {
        if (!Number.isInteger(value)) {
            fail(`watchGenerate: cannot write ?${name}=${JSON.stringify(value)} — it is not an `
                + 'integer, and `readGenerateParams` would refuse to read it back. A URL this '
                + 'page cannot reload is not a link to the run it is showing.');
        }
        return String(value);
    };
    q.delete('gen');
    q.set('source', 'generate');
    q.set('seed', int('seed', seed));
    q.set('biome', String(biome));
    q.set('count', int('count', bounds.obstacleTarget));
    q.set('tries', int('tries', bounds.triesPerStep));
    q.set('k', int('k', bounds.saturationK));
    if (int('step', step) >= 1) q.set('run', '1');
    else q.delete('run');
    return q.toString();
}

/**
 * THE COST OF A LADDER, BEFORE IT RUNS.
 *
 * `levelGenerator.costModel` states one run's ceiling; this states the
 * ladder's, which is the sum over the steps a RUN-ALL takes plus one display
 * solve per step. ⚠ An UPPER BOUND, and it says so — the loop keeps its first
 * candidate most of the time and stops early on saturation.
 */
export function ladderCost(bounds, worstCaseSolveMs) {
    const b = { ...DEFAULT_BOUNDS, ...(bounds ?? {}) };
    let solves = 0;
    for (let k = 1; k <= b.obstacleTarget; k += 1) solves += 1 + k * b.triesPerStep;
    const display = b.obstacleTarget + 1;
    return Object.freeze({
        steps: b.obstacleTarget,
        loopSolves: solves,
        displaySolves: display,
        solves: solves + display,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs)
            ? (solves + display) * worstCaseSolveMs : null,
        why: `STEP is "obstacleTarget = k, re-run" (see the docblock), so a RUN-ALL to `
            + `${b.obstacleTarget} spends sum(1 + k x triesPerStep(${b.triesPerStep})) `
            + `= ${solves} loop solves plus ${display} display solves. A single `
            + 'generateSeedlingLevel call would spend the last row alone; the ladder buys '
            + 'the per-step display ⚖ §1.3 asks for, and every step is the CLI\'s own '
            + `--count=k output byte for byte.`,
    });
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
export function generateStep({ seed, biome, step, bounds, budget } = {}) {
    const palette = paletteFor(biome);
    const b = assertBudget(budget ?? DEFAULT_BUDGET);
    if (!Number.isInteger(step) || step < 0) {
        fail(`watchGenerate: step must be a non-negative integer, got ${JSON.stringify(step)}. `
            + 'Step 0 is the SKELETON and step k is a run to obstacleTarget=k.');
    }
    if (step === 0) {
        const model = seedlingModel({ seed });
        return Object.freeze({
            seed,
            biome,
            palette,
            step,
            model,
            record: model.skeleton(),
            trace: [],
            summary: null,
            keptTemplates: [],
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
    });
    return Object.freeze({
        seed,
        biome,
        palette,
        step,
        model: out.model,
        record: out.record,
        trace: out.trace,
        summary: out.summary,
        keptTemplates: keptTemplatesOf(out.summary, palette),
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
 * The template OBJECTS a summary's kept list names — what the oracle needs to
 * take the pin union over (⚖ §9.4: the water template obliges `'sound'` BY
 * ARGUMENT). A name the palette does not hold is a defect, not a missing pin,
 * so it refuses rather than dropping the row.
 */
export function keptTemplatesOf(summary, palette) {
    return (summary?.kept ?? []).map((k) => {
        const t = palette.templates.find((x) => x.name === k.template);
        if (!t) {
            fail(`watchGenerate: the summary keeps "${k.template}", which palette `
                + `"${palette.name}" does not hold. The pin union is taken over these `
                + 'objects, so a dropped one would solve the room under fewer pins than '
                + 'the loop did.');
        }
        return t;
    });
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
 * The generation trace as PANE ROWS — one per attempt, in the loop's order.
 *
 * ⚖ §1.3 wants *"the verdict + kept/reverted template + refusal text as
 * trace-pane rows"*, and ⚖ §7.4 wants *"every placement, every veto with its
 * verdict class and verbatim reason, every bound named"*. ⛔ So the reason
 * text rides VERBATIM: the refusal is the evidence channel (trap 202 — the
 * danger channel is empty on every success BY CONSTRUCTION) and a paraphrase
 * would be a lossy copy of the only content this pane carries.
 *
 * ⚠ `classifiedBy` is a SEPARATE field and is never merged into the reason —
 * "how the oracle decided" and "what the solver said" are different claims,
 * and `procgenOracle` writes them separately for that reason.
 */
export function generationRows(trace) {
    return (trace ?? []).map((r) => ({
        step: r.step,
        try: r.try,
        label: r.step === 0 ? '(skeleton)' : `${r.step}.${r.try}`,
        template: r.template ?? '(skeleton)',
        family: r.family,
        at: r.at ? `(${r.at.tx},${r.at.ty})` : null,
        outcome: r.outcome,
        verdict: r.verdict ?? null,
        ticks: r.ticks ?? null,
        classifiedBy: r.classifiedBy ?? null,
        reasonText: r.reasonText ?? null,
        budgetKind: r.budgetKind ?? null,
    }));
}

/**
 * The one-line summary of a state, for the status bar and the CLI readout.
 * ⛔ Every bound that ran is in it — ⚖ kickoff §5's "bounded sweeps name
 * their bounds", where a reader can actually see them.
 */
export function describeState(state, solved = null) {
    const s = state.summary;
    const bits = [
        `seed ${state.seed} · ${state.biome} · step ${state.step}`,
        s ? `kept ${s.keptCount}/${state.bounds.obstacleTarget} over ${s.attempts} attempt(s)`
            : 'the SKELETON — the bordered room and its goal, before any template',
        `bounds: target=${state.bounds.obstacleTarget} tries=${state.bounds.triesPerStep} `
            + `k=${state.bounds.saturationK}`,
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

export { STOP };
