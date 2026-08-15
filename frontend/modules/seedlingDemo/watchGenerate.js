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
    DEFAULT_BOUNDS, KEEP_POLICY, KEPT_KIND, STOP, directedAttempt,
} from '../procgenCore/levelGenerator.js';
import {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, dischargesVerb, instantiateKept, normalizeRoster,
    restrictPalette,
} from './procgenPalette.js';
import { generateSeedlingLevel, seedlingModel, seedlingOracle } from './procgenSeedling.js';
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
 * ⛓ THE RESTRICTION, AS THE URL SPELLS IT — `?families=` (coarse) or
 * `?templates=` (fine), a comma list either way; ABSENT means the whole
 * roster.
 *
 * ⛔ **BOTH PRESENT REFUSES.** They are two spellings of one setting, and this
 * page has already paid for that failure mode once (slice 1). The refusal
 * names both values so the fix is obvious — *say it one way*.
 *
 * ⛔ AND `?families=` WITH AN EMPTY VALUE REFUSES rather than reading as
 * absent. The integers above treat `''` as "not given" because there is no
 * empty integer; an empty LIST is a different thing — it is a restriction
 * somebody emptied, and the whole roster is spelled by leaving the parameter
 * out. (The page never writes one: `writeGenerateParams` DELETES both
 * parameters when there is no restriction.)
 *
 * ⚠ THE MEMBER NAMES ARE VALIDATED AGAINST THE BIOME'S OWN ROSTER, here, by
 * `normalizeRoster` — which is why this reads the biome first. An unknown
 * family or template refuses BY NAME and lists what the palette offers; a
 * silently dropped member would WIDEN the roster the run draws from.
 */
export function readRosterParams(q, biome) {
    const raw = (name) => {
        const v = q.get(name);
        return v === null ? null : v;
    };
    const families = raw('families');
    const templates = raw('templates');
    if (families !== null && templates !== null) {
        fail(`watchGenerate: ?families=${JSON.stringify(families)} AND `
            + `?templates=${JSON.stringify(templates)} are BOTH present, and they are two `
            + 'spellings of one setting — a sub-roster. They do not compose: say it one '
            + 'way. (?families= is the coarse, stable spelling; ?templates= names the '
            + 'roster keys exactly.)');
    }
    if (families === null && templates === null) return null;
    const axis = families !== null ? 'families' : 'templates';
    const value = families !== null ? families : templates;
    const names = value.split(',').map((s) => s.trim()).filter((s) => s !== '');
    if (names.length === 0) {
        fail(`watchGenerate: ?${axis}=${JSON.stringify(value)} names nothing. The WHOLE `
            + 'roster is spelled by leaving the parameter out; an empty list is a '
            + 'restriction somebody emptied, and the loop refuses an empty palette as a '
            + 'finding ABOUT THE PALETTE.');
    }
    return normalizeRoster(paletteFor(biome), { axis, names });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 2 — THE DIRECTED ATTEMPT'S IDENTITY (slice 5, ⚖ ruling 1 + 9)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ Kickoff §3.5: *the level becomes LADDER + DIRECTIVES.* A level is no
 * longer named by seed + biome + bounds + roster alone; it is that ladder, to
 * step k, followed by an ordered list of directed attempts. So the payload
 * gains `directives` and the URL gains `?directed=`, and a copied link names
 * the WHOLE construction.
 *
 * ── THE GRAMMAR, AND WHY IT IS THE INSTANCE LABEL ─────────────────────
 *
 *   ?directed=<d>;<d>;…
 *   <d> := <template>[ '(' <k>=<v>,… ')' ] '@' <bound> <policy> [ '!' tx ',' ty ]
 *
 * e.g. `wall-gap-block(ori=v,gap=1)@12d;water-pool(w=2,h=3)@12d`
 *
 * ⛓ The parenthesised clause IS `instanceLabel`'s spelling — the same string
 * the pane prints, the trace carries and a reader already knows how to read.
 * A second spelling of "which instance" would be the two-spellings failure
 * mode inside the thing that exists to name a construction. A zero-parameter
 * template has no clause at all, exactly as its label is its bare name.
 *
 * `<policy>` is `d` (prefer-discharge) or `s` (first-solved) and `<bound>` is
 * the anchor bound — ⚖ kickoff §5: a bounded walk NAMES its bound, and a
 * directive is a bounded walk somebody may re-run years later. ⛔ They are
 * per-directive rather than global because slice 6's click-to-anchor is a
 * directive at bound 1, and a construction mixing the two must still be
 * nameable in one string.
 *
 * ⚖ **A CLICK IS WRITTEN `@1d`, NOT `@1s`** — the reading slice 5's docblock
 * guessed. The bound-1 walk has nothing to prefer between, so the POLICY is
 * moot either way; what is not moot is the ANSWER it produces. Under `s` the
 * walk never asks whether the solve discharges, so the readout can say nothing
 * about a hand-placed door's usefulness — which is the whole question a person
 * clicking a cell is asking. Under `d` the predicate still runs and the keep
 * kind is honest, and `describeKeptKind` says the preference was moot BY NAME
 * rather than printing *"no anchor within the bound"* about a walk of one.
 *
 * ⛔ **ONLY THE INPUTS ARE ENCODED.** `outcome` and `keptKind` are RESULTS —
 * they are what re-running produces, not what it takes — and a link that
 * carried them could be edited into a claim the reproduction contradicts.
 * The payload records them because a payload is a REPORT; the URL is an
 * INSTRUCTION.
 *
 * ⛓⛓⛓ **THE ANCHOR SUFFIX IS SLICE 6's, AND IT IS NOW FILLED** — `!tx,ty` is
 * the CLICKED cell, and a directive that carries one is a walk of ONE cell, so
 * its bound is `1` and the reader, the writer and `directedAttempt` all refuse
 * any other. ⚖ Ruling 6: template-at-clicked-anchor, never a bare tile.
 */

/** ⚖ Ruling 9(b): the payload RESERVES a skeleton block, so the constructive
 *  mode arrives ADDITIVELY. Today there is exactly one kind and it is named
 *  rather than assumed — a payload with no `skeleton` block is this one. */
export const DEFAULT_SKELETON = Object.freeze({ kind: 'empty-bordered' });

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

const POLICY_LETTER = Object.freeze({
    d: KEEP_POLICY.PREFER_DISCHARGE,
    s: KEEP_POLICY.FIRST_SOLVED,
});
const LETTER_FOR_POLICY = Object.freeze({
    [KEEP_POLICY.PREFER_DISCHARGE]: 'd',
    [KEEP_POLICY.FIRST_SOLVED]: 's',
});

/**
 * ⛓⛓ **TWO DERIVED STREAMS PER DIRECTIVE, AND THE SPLIT IS LOAD-BEARING.**
 *
 * A directive may leave a parameter to be DRAWN ("any"), and what it then
 * RECORDS is the drawn VALUE. So a replay passes that value as an override and
 * spends NO draw where the original spent one. ⛔ With a single stream the
 * anchor shuffle would then start from a different position and the replay
 * would walk a DIFFERENT anchor list — a copied link that reproduces a
 * different level, byte for byte, with nothing on the page able to say why.
 *
 * Two streams, salted apart, make the anchor walk INDEPENDENT of how many
 * parameters were drawn rather than typed. ⛓ This is the same "two streams,
 * two seeds from one" shape `procgenSeedling` already uses to keep the room
 * stream and the template stream from shifting each other.
 *
 * ⚠ AND THE INDEX IS IN THE MIX, so two identical directives are two different
 * questions: without it the second would walk the first's anchor order and
 * meet its own placement.
 */
const PARAM_SALT = 1;
const ANCHOR_SALT = 2;
function directiveSeed(seed, index, salt) {
    let h = 2166136261;
    for (const n of [seed >>> 0, (index + 1) >>> 0, salt]) {
        h = Math.imul(h ^ n, 16777619);
    }
    // ⛔ Into `ProcgenRng`'s own orbit: [1, SEED_MAX]. Seed 0 is refused there
    // (it means "inherit the build's boot seed"), so the +1 is not cosmetic.
    return (Math.abs(h) % (SEED_MAX - 1)) + 1;
}

/**
 * A directive SPEC — the INPUTS — validated against the palette it will run
 * on, or a refusal BY NAME.
 *
 * ⛔ EVERY REFUSAL NAMES THE THING IT REFUSED AND WHAT WAS ON OFFER. An
 * unknown template, an unknown parameter, a value outside the declared domain
 * and a malformed clause are four different mistakes, and a reader who typed
 * one of them into an address bar has no other channel to learn which.
 *
 * ⚠ THE VALUE'S TYPE COMES FROM THE SCHEMA, NOT FROM THE TEXT. `len=4` must
 * become the NUMBER 4 because `wall-segment`'s domain holds numbers, while
 * `ori=v` stays a string — so a value is matched by STRINGIFYING each declared
 * domain member. ⛓ That also gives the domain check for free and in the right
 * place: a value outside the domain refuses HERE, before any solve, which is
 * what the brief asks of the form as well.
 */
export function parseDirective(text, palette) {
    const raw = String(text).trim();
    const m = /^([A-Za-z0-9_-]+)(?:\(([^)]*)\))?@(\d+)([ds])(?:!(\d+),(\d+))?$/.exec(raw);
    if (!m) {
        fail(`watchGenerate: ${JSON.stringify(raw)} is not a directive. The spelling is `
            + '`template(key=value,…)@<bound><d|s>` — the parenthesised clause is the '
            + 'INSTANCE LABEL the pane already prints, `<bound>` is how many legal anchors '
            + 'the attempt may be solved at, and the letter is the keep policy (`d` = prefer '
            + 'discharge, `s` = first solved). A zero-parameter template omits the clause '
            + 'entirely, e.g. `arrow-lane@12d`.');
    }
    const [, name, paramText, boundText, letter, tx, ty] = m;
    const base = (palette?.templates ?? []).find((t) => t.name === name);
    if (!base) {
        fail(`watchGenerate: ?directed= names template ${JSON.stringify(name)}, which palette `
            + `"${palette?.name}" does not hold — it offers `
            + `[${(palette?.templates ?? []).map((t) => t.name).join(', ')}]. ⛔ An unknown `
            + 'template is REFUSED rather than skipped: a dropped directive would reproduce '
            + 'a DIFFERENT level under the same link and report no reason at all.');
    }
    const params = {};
    if (paramText !== undefined && paramText.trim() !== '') {
        for (const clause of paramText.split(',')) {
            const eq = clause.indexOf('=');
            if (eq <= 0) {
                fail(`watchGenerate: ${JSON.stringify(clause)} in the directive for `
                    + `"${name}" is not a \`key=value\` pair.`);
            }
            const key = clause.slice(0, eq).trim();
            const valueText = clause.slice(eq + 1).trim();
            const p = base.params.find((q) => q.key === key);
            if (!p) {
                fail(`watchGenerate: template "${name}" has no parameter ${JSON.stringify(key)} `
                    + `— it declares [${base.params.map((q) => q.key).join(', ') || 'none'}]. `
                    + 'A silently ignored parameter is a link that names one instance and '
                    + 'builds another.');
            }
            const hit = p.domain.find((v) => String(v) === valueText);
            if (hit === undefined) {
                fail(`watchGenerate: template "${name}" parameter "${key}" was given `
                    + `${JSON.stringify(valueText)}, which is not in its declared domain `
                    + `[${p.domain.join(', ')}]. Every value in a domain is one a sweep `
                    + 'measured; a value outside it is one nobody has adjudicated.');
            }
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                fail(`watchGenerate: the directive for "${name}" names parameter `
                    + `${JSON.stringify(key)} twice. Two values for one parameter is two `
                    + 'spellings of one setting, in the smallest place it can happen.');
            }
            params[key] = hit;
        }
    }
    const bound = Number(boundText);
    if (!Number.isInteger(bound) || bound <= 0) {
        fail(`watchGenerate: the directive for "${name}" names bound `
            + `${JSON.stringify(boundText)}, which is not a positive integer.`);
    }
    /**
     * ⛓ SLICE 6: AN EXPLICIT ANCHOR IS A WALK OF ONE CELL, SO IT IS SPELLED
     * `@1`. ⛔ `levelGenerator.directedAttempt` refuses any other bound beside
     * an explicit cell, and the reader refuses it HERE — before any solve —
     * because `@12d!3,4` names a twelve-anchor search this attempt does not
     * perform, and a link that means something different from what it says is
     * the failure this whole grammar exists to avoid.
     */
    if (tx !== undefined && bound !== 1) {
        fail(`watchGenerate: the directive for "${name}" names the EXPLICIT anchor `
            + `!${tx},${ty} and bound ${bound}. An explicit cell is a walk of ONE cell — `
            + `spell it \`@1${letter}!${tx},${ty}\`. Any other bound names a search this `
            + 'attempt does not perform.');
    }
    return Object.freeze({
        template: name,
        params: Object.freeze(params),
        /** ⛓ Slice 6's field, present and always `null` today — the click only
         *  fills it. Building the record without it would make slice 6 a change
         *  to the identity schema rather than an addition to a form. */
        anchor: tx === undefined ? null : Object.freeze({ tx: Number(tx), ty: Number(ty) }),
        keepPolicy: POLICY_LETTER[letter],
        bound,
    });
}

/** Every directive in a `?directed=` value, in order. */
export function parseDirectives(value, palette) {
    const text = String(value ?? '').trim();
    if (text === '') {
        fail('watchGenerate: ?directed= names nothing. A level with no directives is '
            + 'spelled by leaving the parameter out — an empty value is a construction '
            + 'somebody emptied, which is the same rule ?families= follows.');
    }
    return Object.freeze(text.split(';').map((d) => parseDirective(d, palette)));
}

/**
 * The inverse — ⛔ THE ONE WRITER'S half, and it round-trips through
 * `parseDirective` by construction: the params clause is built in SCHEMA
 * ORDER, not in insertion order, so two runs that reached the same values by
 * different routes (one drawn, one typed) spell them identically and the URL
 * fixed point holds.
 */
export function formatDirectives(directives, palette) {
    return (directives ?? []).map((d) => {
        const base = (palette?.templates ?? []).find((t) => t.name === d.template);
        if (!base) {
            fail(`watchGenerate: cannot write a directive for ${JSON.stringify(d.template)} — `
                + `palette "${palette?.name}" does not hold it, so \`readGenerateParams\` `
                + 'would refuse to read it back. A URL this page cannot reload is not a link '
                + 'to the construction it is showing.');
        }
        const letter = LETTER_FOR_POLICY[d.keepPolicy];
        if (!letter) {
            fail(`watchGenerate: cannot write a directive whose keep policy is `
                + `${JSON.stringify(d.keepPolicy)} — the URL spells only `
                + `[${Object.keys(POLICY_LETTER).join(', ')}].`);
        }
        // ⛓ SLICE 6, and it is §8.6's law again: the writer refuses what the
        // reader would refuse. An explicit anchor beside a bound above 1 is a
        // URL `parseDirective` rejects, so it must not be writable.
        if (d.anchor && d.bound !== 1) {
            fail(`watchGenerate: cannot write a directive for "${d.template}" that names both `
                + `the EXPLICIT anchor (${d.anchor.tx},${d.anchor.ty}) and bound ${d.bound}. `
                + 'An explicit cell is a walk of ONE cell; `readGenerateParams` would refuse '
                + 'to read this back.');
        }
        // ⚠ SCHEMA ORDER, and the values are checked on the way OUT as well —
        // the writer refuses what the reader would refuse (§8.6's law).
        const clause = base.params.map((p) => {
            const v = d.params?.[p.key];
            if (v === undefined) {
                fail(`watchGenerate: the directive for "${d.template}" carries no value for `
                    + `"${p.key}". ⛔ It REFUSES rather than writing the default: a link that `
                    + 'silently filled a parameter would reproduce a different instance under '
                    + 'the same address, and the pin union cannot tell two instances of one '
                    + 'template apart (slice 2 §9.5).');
            }
            if (!p.domain.includes(v)) {
                fail(`watchGenerate: the directive for "${d.template}" gives "${p.key}" the `
                    + `value ${JSON.stringify(v)}, which is outside its declared domain `
                    + `[${p.domain.join(', ')}].`);
            }
            return `${p.key}=${v}`;
        }).join(',');
        return `${d.template}${clause ? `(${clause})` : ''}@${d.bound}${letter}`
            + (d.anchor ? `!${d.anchor.tx},${d.anchor.ty}` : '');
    }).join(';');
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
        roster: readRosterParams(q, biome),
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
        bounds: {
            obstacleTarget: int('count', DEFAULT_BOUNDS.obstacleTarget),
            triesPerStep: int('tries', DEFAULT_BOUNDS.triesPerStep),
            saturationK: int('k', DEFAULT_BOUNDS.saturationK),
            /**
             * ⚠ `?anchortries=` AND NOT `?anchors=`. The domain sweep's CLI
             * already spells `--anchors=first|all`, which is an ENUMERATION
             * MODE and not a count; one letter of overlap between "how many
             * anchors may the solver try" and "which anchors does the table
             * cover" is the collision this page's `?tick=`/`?tickbudget=`
             * split already avoided once.
             */
            anchorTriesPerCandidate:
                int('anchortries', DEFAULT_BOUNDS.anchorTriesPerCandidate),
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
    seed, biome, bounds, step, roster = null, directives = null, payloadOwned = false,
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
    // ⛓ SLICE 3: the anchor-search bound is a BOUND like the other three, so it
    // lands HERE with its control (§8.6's standing law: every new control
    // arrives WITH its parameter in the one writer). The integer refusal above
    // already covers it.
    q.set('anchortries', int('anchortries', bounds.anchorTriesPerCandidate));
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
    const r = roster ? normalizeRoster(paletteFor(biome), roster) : null;
    if (!r) {
        q.delete('families');
        q.delete('templates');
    } else {
        q.delete(r.axis === 'families' ? 'templates' : 'families');
        q.set(r.axis, r.names.join(','));
    }
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
    const ds = directives ?? [];
    if (ds.length === 0) q.delete('directed');
    else q.set('directed', formatDirectives(ds, paletteFor(biome)));
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
    // ⛓ SLICE 3: × anchorTriesPerCandidate, the same factor `costModel` gained
    // — one candidate may now be solved at that many anchors.
    for (let k = 1; k <= b.obstacleTarget; k += 1) {
        solves += 1 + k * b.triesPerStep * b.anchorTriesPerCandidate;
    }
    const display = b.obstacleTarget + 1;
    // (see `directedCost` for the DIRECTED sibling of this arithmetic)
    return Object.freeze({
        steps: b.obstacleTarget,
        loopSolves: solves,
        displaySolves: display,
        solves: solves + display,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs)
            ? (solves + display) * worstCaseSolveMs : null,
        why: `STEP is "obstacleTarget = k, re-run" (see the docblock), so a RUN-ALL to `
            + `${b.obstacleTarget} spends sum(1 + k x triesPerStep(${b.triesPerStep}) x `
            + `anchorTriesPerCandidate(${b.anchorTriesPerCandidate})) `
            + `= ${solves} loop solves plus ${display} display solves. A single `
            + 'generateSeedlingLevel call would spend the last row alone; the ladder buys '
            + 'the per-step display ⚖ §1.3 asks for, and every step is the CLI\'s own '
            + `--count=k output byte for byte.`,
    });
}

/**
 * THE COST OF **ONE DIRECTED ATTEMPT**, before it runs — `ladderCost`'s
 * sibling, and the same arithmetic discipline for the same reason (a solve is
 * synchronous and uninterruptible, so a budget bounds what is ACCEPTED and
 * never what is SPENT).
 *
 * ⚠ IT IS A CEILING AND IT SAYS SO, twice over: the walk stops at the first
 * acceptable anchor, AND the model usually offers far fewer legal anchors than
 * the bound (measured — see `DIRECTED_ANCHOR_TRIES`: at most 7 in the skeleton
 * and at most 4 on a step-3 ladder record). The number printed is what the
 * press AUTHORISES, which is the one a reader who expected a pause should see.
 */
export function directedCost(bound, worstCaseSolveMs) {
    if (!Number.isInteger(bound) || bound <= 0) {
        fail(`watchGenerate: directedCost needs a positive integer bound, got `
            + `${JSON.stringify(bound)}.`);
    }
    const solves = bound + 1;
    return Object.freeze({
        bound,
        loopSolves: bound,
        displaySolves: 1,
        solves,
        worstCaseSolveMs,
        worstCaseTotalMs: Number.isFinite(worstCaseSolveMs) ? solves * worstCaseSolveMs : null,
        why: `one DIRECTED attempt solves at up to anchorTries(${bound}) legal anchors, plus `
            + '1 display solve. ⚠ A CEILING: the walk stops at the first anchor it accepts, '
            + 'and the model offers only as many legal anchors as the room has room for '
            + '(measured: at most 7 in an empty room, at most 4 once the ladder has placed '
            + 'three obstacles). Every solve is SYNCHRONOUS and uninterruptible.',
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
export function generateStep({ seed, biome, step, bounds, budget, roster = null } = {}) {
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
        const model = seedlingModel({ seed });
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
            /** ⚖ Ruling 9(b)'s reserved block — see `DEFAULT_SKELETON`. */
            skeleton: DEFAULT_SKELETON,
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
        roster: palette.roster ?? null,
        step,
        model: out.model,
        record: out.record,
        trace: out.trace,
        summary: out.summary,
        keptTemplates: keptTemplatesOf(out.summary, palette),
        directives: Object.freeze([]),
        skeleton: DEFAULT_SKELETON,
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
        rngFor(directiveSeed(state.seed, index, PARAM_SALT)), spec.params ?? {},
    );
    const out = directedAttempt({
        rng: rngFor(directiveSeed(state.seed, index, ANCHOR_SALT)),
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
 * ── ⛓⛓⛓ SLICE 6 — WHICH **TILE** A CLICK LANDED ON ────────────────────
 *
 * ⚖ Ruling 6's manual half needs exactly one conversion, and this is it: the
 * page has never mapped a canvas pixel to a cell (grepped — the only other
 * pixel arithmetic is the RENDERER's own `fit`/`rect`, which goes the other
 * way), so there is one helper rather than a second convention.
 *
 * ⛔ **IT IS DERIVED FROM THE RECORD'S OWN DIMENSIONS, NOT FROM THE RENDERER'S
 * `scale`.** The canvas is `world dimensions x ONE uniform integer scale` and
 * the browser may then present it at any CSS size; asking the ROOM how many
 * columns it has and the ELEMENT how wide it is on screen is correct under
 * both, and it does not reach into a closure the renderer owns.
 *
 * ⛔ **THE INTEGER NUMERATOR IS DELIBERATE.** `Math.floor(x * cols / width)`
 * and not `Math.floor((x / width) * cols)`: the second divides first and can
 * land a pixel that is EXACTLY on a tile boundary at 1.9999999, which is the
 * previous tile. The boundaries are what the tests drive — the last pixel of
 * tile k is tile k and the first pixel of tile k+1 is tile k+1 — because an
 * off-by-one here is invisible to every check that clicks a tile's middle.
 *
 * ⚠ AN OUT-OF-RANGE POINT REFUSES rather than clamping. A clamp would silently
 * turn a click past the room's edge into a click on its last cell, and the
 * whole point of this slice is that the cell a person named is the cell that
 * is adjudicated.
 *
 * @param {object} o
 * @param {number} o.x,y          the point RELATIVE to the canvas's top-left,
 *   in CSS pixels (`clientX - rect.left`).
 * @param {number} o.width,height the canvas's own on-screen size (`rect.*`).
 * @param {number} o.cols,rows    the ROOM's dimensions in tiles.
 * @returns {{tx: number, ty: number}}
 */
export function tileAtPoint({ x, y, width, height, cols, rows } = {}) {
    for (const [what, v] of [['width', width], ['height', height]]) {
        if (!Number.isFinite(v) || v <= 0) {
            fail(`watchGenerate: tileAtPoint needs a positive canvas ${what}, got `
                + `${JSON.stringify(v)}. A zero-sized canvas is a canvas nobody can click, `
                + 'and dividing by it would name every cell at once.');
        }
    }
    for (const [what, v] of [['cols', cols], ['rows', rows]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`watchGenerate: tileAtPoint needs a positive integer ${what}, got `
                + `${JSON.stringify(v)} — the room's own dimension in TILES.`);
        }
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`watchGenerate: tileAtPoint needs a finite point, got (${x},${y}).`);
    }
    const tx = Math.floor((x * cols) / width);
    const ty = Math.floor((y * rows) / height);
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) {
        fail(`watchGenerate: the point (${x},${y}) on a ${width}x${height} canvas is tile `
            + `(${tx},${ty}), which is outside a ${cols}x${rows} room. ⛔ It REFUSES rather `
            + 'than clamping: a clamp would turn a click past the edge into a click on the '
            + 'last cell, and the cell somebody named is the cell that gets adjudicated.');
    }
    return { tx, ty };
}

/**
 * ⛓⛓ WHICH LADDER STEP A SET OF URL PARAMETERS NAMES — ONE reader of the
 * `run` + `count` encoding.
 *
 * ⛔ THE ENCODING IS SPLIT ACROSS TWO PARAMETERS AND THAT IS DELIBERATE (slice
 * 1 §8.2(a)): `count` is `state.bounds.obstacleTarget` — which at step k IS k,
 * because `generateStep` overrides it — and `run=1` says a RUN is what is on
 * screen at all, with the parameter DELETED at step 0 rather than spelt
 * `run=0`. ⚠ But at STEP 0 nothing overrides `count`, so a skeleton's URL
 * carries the FORM's target beside no `run`, and "which step is this?" is
 * `run ? count : 0` rather than `count`.
 *
 * ⛓ THIS FUNCTION EXISTS BECAUSE SLICE 5 WAS ABOUT TO BECOME ITS SECOND
 * READER. The page has always known the rule (`if (gp.run) goTo(target)`), and
 * the reproduction path needs the same answer; two private derivations of
 * "which step does this link name" is the two-spellings failure mode inside
 * the one thing this arc keeps single. Found by a red in the round-trip case,
 * which reproduced a step-6 ladder from a skeleton's own link.
 */
export function stepFromParams(params) {
    return params?.run ? params.bounds.obstacleTarget : 0;
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
} = {}) {
    let state = generateStep({ seed, biome, step, bounds, budget, roster });
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
        /**
         * ⛓⛓ SLICE 3: THE LABEL CARRIES THE ANCHOR ORDINAL, because rows of one
         * candidate now SHARE `step.try`. `1.2` three times over would be a
         * pane that shows a search as one attempt repeated; `1.2a1 / 1.2a2 /
         * 1.2a3` is the search. ⛔ The suffix is written whenever the row has an
         * ordinal — including at the default bound, where every row is `a1` —
         * rather than only when the walk was long: a label whose FORMAT depends
         * on the outcome is two spellings, and a reader could not tell "no
         * search ran" from "the search stopped at one".
         */
        /**
         * ⛓⛓ SLICE 5: A DIRECTIVE'S ROWS ARE LABELLED `d<n>a<k>`, because they
         * are not a step of any ladder — the row's `step` says which rung the
         * directive was applied ON TOP OF, and a label reading `3.null` would
         * be a pane inventing a try nobody made.
         */
        label: r.directive ? `d${r.directive}${r.anchorTry ? `a${r.anchorTry}` : ''}`
            : (r.step === 0 ? '(skeleton)'
                : `${r.step}.${r.try}${r.anchorTry ? `a${r.anchorTry}` : ''}`),
        /** Which directive this row belongs to, or `null` for a ladder row. */
        directive: r.directive ?? null,
        /** Which anchor of the walk this row is, and how many were offered. */
        anchorTry: r.anchorTry ?? null,
        anchorsOffered: r.anchorsOffered ?? null,
        template: r.template ?? '(skeleton)',
        /**
         * ⛓ SLICE 2: THE PANE PRINTS THE INSTANCE, the pane's own consumers
         * still get the base `template`. `wall-segment(ori=v,len=4)` and
         * `wall-segment(ori=h,len=2)` are two different obstacles and a pane
         * that called both "wall-segment" would be showing a roster key where
         * a reader needs a geometry.
         */
        instance: r.instance ?? r.template ?? '(skeleton)',
        params: r.params ?? null,
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
 * ⛓⛓⛓ **WHICH KIND OF KEEP IT WAS** — ⚖ the user's ruling: *"the readout says
 * WHICH KIND OF KEEP it was … two facts, never blurred."*
 *
 * ⛔ **THE THIRD CASE IS PRINTED BY NAME.** A wall, a pool, a pit and an arrow
 * lane have no verb to discharge, so first-SOLVED is their WHOLE criterion and
 * nothing was missed. Printing `solved-only` for them would be a readout
 * claiming a shortfall that cannot exist — trap 249's shape, in the one place
 * a reader looks to find out what the generator did. ⛓ ONE spelling, here: the
 * page's directive list and the CLI's `## the directives` table both call
 * this, so the two cannot describe one outcome two ways.
 */
export function describeKeptKind(directive) {
    if (directive?.outcome !== 'KEPT') return '';
    /**
     * ⛓⛓ SLICE 6: AN EXPLICIT ANCHOR IS A WALK OF ONE CELL, SO THE PREFERENCE
     * HAD NOTHING TO PREFER BETWEEN — and `solved-only`'s searched wording
     * (*"no anchor within the bound"*) would read as if a walk had happened and
     * come up short. It is the same KIND; it is a different sentence, and it is
     * said HERE because this is the ONE spelling the page and the CLI share.
     */
    const clicked = Boolean(directive.anchor);
    switch (directive.keptKind) {
        case KEPT_KIND.DISCHARGED:
            return `kept:discharged — the solve carries a {strategy} record naming this `
                + 'template\'s own verb';
        case KEPT_KIND.SOLVED_ONLY:
            return clicked
                ? 'kept:solved-only — the room completes, and the solve at THIS cell does not '
                    + 'USE the template\'s verb. ⚠ The discharge preference is MOOT here: an '
                    + 'explicit anchor is a walk of ONE cell, so nothing was passed over'
                : 'kept:solved-only — the room completes, but no anchor within the bound '
                    + 'made the walk USE this template\'s verb';
        case KEPT_KIND.NO_VERB:
            return 'kept — this family has NO verb to discharge, so first-SOLVED is its '
                + 'whole criterion and nothing was missed';
        default:
            /**
             * ⛔ `keptKind` IS `null` UNDER `FIRST_SOLVED` AND THAT IS THE
             * ANSWER — the walk never asked. Saying `solved-no-verb` here (the
             * default `directedAttempt` used to write) claimed a DOOR has no
             * verb; saying `solved-only` would claim a shortfall nobody looked
             * for. Both are statements about a question that was never put.
             */
            return 'kept — the keep policy was first-SOLVED, so nothing asked whether this '
                + 'solve DISCHARGES the template\'s verb';
    }
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
        `seed ${state.seed} · ${state.biome} · step ${state.step}`
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
            : 'the SKELETON — the bordered room and its goal, before any template',
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

export { STOP };
