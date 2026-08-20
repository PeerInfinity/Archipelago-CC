/**
 * procgenCore/urlParams — **THE URL GRAMMAR BOTH LAB PAGES SPEAK.**
 *
 * CONSTRUCTIVE-MODE arc, slice 3 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.4, and ⚖ open question 7). The rule the kickoff set was
 * conditional and it was MEASURED before it was obeyed: *"a shared
 * `procgenCore/urlParams.js` ONLY if the two readers/writers would otherwise be
 * copies … if >70% is grammar-generic, lift the generic part."*
 *
 * ── ⛓ THE MEASUREMENT, SO THE DECISION IS AUDITABLE ───────────────────
 *
 * `watchGenerate.readGenerateParams` + `writeGenerateParams` are ~65 executable
 * lines between them. What is GRAMMAR (nothing about Seedling in it, and the
 * maze page needs it spelled identically):
 *
 *   · the integer refusal (`?count="2.5"` is not an integer, and there is no
 *     value meaning "whatever" because every bound is named in its own trace)
 *   · `count`/`tries`/`k`/`anchortries` -> the loop's four `DEFAULT_BOUNDS`
 *   · `families=` / `templates=` — BOTH-present refuses, an EMPTY value
 *     refuses, absent is the whole roster; and the writer's SCOPED delete (a
 *     `delete` then a `set` of the same key APPENDS it, so blanket-deleting
 *     both axes moved the parameter and broke the fixed point — GENERATE-UI
 *     slice 4 measured that)
 *   · `run=1` iff a run is on screen, DELETED at step 0 rather than `run=0`;
 *     and `run ? count : 0` as the ONE reader of which step a link names
 *   · the whole DIRECTIVE grammar — `template(k=v,…)@<bound>[!tx,ty]`,
 *     its four distinguished refusals, `formatDirectives`' schema-order write,
 *     and the two salted streams a directive derives (`directiveSeed`)
 *   · `?source=` / `?gen=` as the arm selector
 *
 * That is well past 70%, and the directive grammar alone is ~150 executable
 * lines the maze needs character for character. What is NOT grammar and stayed in
 * `watchGenerate.js`: `paletteFor` (the biome map IS the Seedling boot
 * inventory), the `?budgetms=` deprecation warning (a Seedling knob that
 * existed and was removed), and `?tickbudget=` -> `maxTicksPerTarget` (a
 * SEEDLING budget; the maze's is `maxExpansions`, a BFS node cap, and calling
 * both "the budget" in one reader would be the two-spellings failure this file
 * is full of refusals about).
 *
 * ── ⛔ THE PALETTE NEVER COMES IN HERE UNINVITED ──────────────────────
 *
 * `readRosterSpec` returns the RAW `{axis, names}` and does not validate the
 * members: validation needs a palette, a palette needs a biome, and a biome is
 * the caller's. The caller runs `normalizeRoster` (`procgenCore/
 * paletteRoster.js`) on the way out. `parseDirective` DOES take a palette,
 * because a directive's value types come from the template's own declared
 * domain and there is no way to read one without it — but it is a PARAMETER,
 * so this file imports no substrate.
 *
 * ── ⛓⛓⛓ THE URL DIET (CONSTRUCTIVE-MODE SLICE 12, ⚖ §3.9) ────────────
 *
 * ⚖ **`?directed=` IS NO LONGER A URL PARAMETER.** The user's ruling
 * (2026-08-15): a URL is *the launch parameters a person types* — source, seed,
 * biome, count/tries/k/anchortries, families|templates, skeleton;params,
 * tickbudget/expansions, areas, require, gen — and a DIRECTIVE LIST is a
 * CONSTRUCTION, which is the PAYLOAD's job and which it does byte-exactly.
 *
 * ⛔ So the reader REFUSES the key by name (`refuseDirectedParam`) and the
 * writer DROPS it (`dropDirectedParam`). ⛓ Nothing about the GRAMMAR moved:
 * `parseDirective`/`parseDirectives`/`formatDirectives`/
 * `directiveSeed` are exactly what they were, because the same text still
 * arrives on the two CLIs' `--directed=` (a launch surface for scripts and
 * tests) and still labels a payload's recorded instances. What changed is
 * WHICH CHANNEL carries a directive LIST — `?gen=` / `procgenLab:load` replay
 * `payload.directives` in order, at the same indices, so `directiveSeed`'s
 * index-as-salt is untouched and no recorded construction is re-indexed.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both pages load this in a browser.
 */

import {
    DEFAULT_AREAS, formatAreaSpec, formatRequireList, normalizeAreaSpec, parseAreaSpec,
    parseRequireList,
} from './areaSpec.js';
import {
    DEFAULT_ELEMENTS, formatElementSpec, normalizeElementSpec, parseElementSpec,
} from './elementSpec.js';
import { DEFAULT_BOUNDS, KEEP_POLICY } from './levelGenerator.js';
import {
    DEFAULT_SKELETON_KIND, formatSkeleton, normalizeSkeleton, parseSkeleton,
} from './skeletonKinds.js';

export class UrlParamsError extends Error {
    /** ⛓ `code` is the kebab SLUG a census counts — see `URL_PARAM_REFUSALS`. */
    constructor(message, code) {
        super(message);
        this.name = 'UrlParamsError';
        this.code = code;
    }
}

/**
 * ⛔⛔ **EVERY REFUSAL IN THIS FILE CARRIES A NAME** (PROCGEN DOCS · P5).
 *
 * ⛓ THE CODE COMES FIRST, AND THAT IS THE WHOLE DESIGN. This grammar's 28
 * refusals were SENTENCES with no slug — the single largest un-countable block
 * in the refusal vocabulary, and the one finding the generated reference table
 * could never retire. A trailing `code` argument would have been invisible to a
 * scan, because the messages are multi-line template concatenations; a LEADING
 * one is matched by `/\bfail\('([a-z][a-z0-9-]+)'/` in one pass, which is what
 * `procgenCore/refusalCensus.test.js` runs to prove the list below covers every
 * site.
 *
 * ⛔ **THE MESSAGES DID NOT MOVE.** A refusal NAME is a field; the SENTENCE is
 * what a person reads and what a browser row matches on, and every one of them
 * is byte-identical to what it was before this slice.
 */
const fail = (code, message) => { throw new UrlParamsError(message, code); };

/**
 * ⛓⛓⛓ **THE CENSUS KEY FOR THE URL GRAMMAR** — every name this file can refuse
 * by, grouped by what the refusal is ABOUT rather than by which function raises
 * it, because a reader who has just been handed one is asking *what did I get
 * wrong*, not *where does this live*.
 *
 * ⛓ Gate: `procgenCore/refusalCensus.test.js` asserts this list ⊇ the literal
 * scan of every `fail(` site in this file, and that no member is unreachable.
 */
export const URL_PARAM_REFUSALS = Object.freeze([
    /* ── the SHAPE of the query, before any value is read ── */
    'duplicate-url-parameter',
    'directed-is-retired',
    /* ── an INTEGER, read and written ── */
    'not-an-integer',
    'cannot-write-a-non-integer',
    'bounds-key-unknown',
    'cannot-write-a-run-flag-for-that-step',
    /* ── the ROOM CONTRACT — its size and its fill (arc 5, slice 1) ── */
    'room-size-refused',
    'cannot-write-a-room-size',
    'fill-mode-refused',
    'cannot-write-a-fill-mode',
    /* ── a sub-grammar this file DELEGATES to, refusing under its own name ── */
    'skeleton-spec-refused',
    'area-spec-refused',
    'require-list-refused',
    'element-spec-refused',
    /* ── the ROSTER axes ── */
    'both-roster-axes-are-present',
    'a-roster-axis-names-nothing',
    /* ── a DIRECTIVE, parsed (the CLI's `--directed=` and a payload's labels) ── */
    'not-a-directive',
    'the-palette-does-not-hold-this-template',
    'a-clause-is-not-a-key-value-pair',
    'the-template-has-no-such-parameter',
    'the-value-is-outside-the-declared-domain',
    'a-parameter-is-named-twice',
    'the-bound-is-not-a-positive-integer',
    'the-bound-ends-with-the-keep-policy-letter',
    'an-explicit-anchor-with-a-bound',
    'the-directive-list-names-nothing',
    /* ── a DIRECTIVE, written — the writer refuses what the reader would ── */
    'cannot-write-a-template-the-palette-lacks',
    'cannot-write-that-keep-policy',
    'cannot-write-both-an-explicit-anchor-and-a-bound',
    'cannot-write-a-parameter-with-no-value',
    'cannot-write-a-value-outside-the-domain',
    /* ── the RNG seam ── */
    'directive-seed-needs-the-seed-max',
]);

/* ══════════════════════════════════════════════════════════════════════
 * INTEGERS, AND THE BOUNDS THEY SPELL
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛔ NO VALUE MEANS "WHATEVER". Every bound a loop runs under is named in its
 * own trace (⚖ kickoff §5), so a parameter that is present and unreadable is a
 * refusal rather than a fallback — a caller who typed `?count=2.5` believes
 * something about the run that is not true.
 *
 * ⚠ An ABSENT parameter and an EMPTY one both mean "not given". There is no
 * empty integer, so `?count=` is not a value somebody set to nothing; the list
 * parameters below treat `''` differently and say why.
 */
export function intParam(q, name, fallback) {
    const raw = q.get(name);
    if (raw === null || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n)) {
        fail('not-an-integer',
            `urlParams: ?${name}=${JSON.stringify(raw)} is not an integer. Every bound this `
            + 'loop runs under is named in its own trace (⚖ kickoff §5), so there is no value '
            + 'that means "whatever".');
    }
    return n;
}

/** The four `DEFAULT_BOUNDS`, as the URL spells them. One reader. */
export function readBounds(q, defaults = DEFAULT_BOUNDS) {
    return {
        obstacleTarget: intParam(q, 'count', defaults.obstacleTarget),
        triesPerStep: intParam(q, 'tries', defaults.triesPerStep),
        saturationK: intParam(q, 'k', defaults.saturationK),
        /**
         * ⚠ `?anchortries=` AND NOT `?anchors=`. The domain sweep's CLI already
         * spells `--anchors=first|all`, which is an ENUMERATION MODE and not a
         * count; one letter of overlap between "how many anchors may the solver
         * try" and "which anchors does the table cover" is the collision the
         * `?tick=`/`?tickbudget=` split already avoided once.
         */
        anchorTriesPerCandidate: intParam(q, 'anchortries', defaults.anchorTriesPerCandidate),
    };
}

/**
 * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (GENERATE-UI §8.6's
 * standing law): a URL a page cannot reload must not be writable in the first
 * place, because it is not a link to the run it is showing.
 */
export function writeInt(q, name, value) {
    if (!Number.isInteger(value)) {
        fail('cannot-write-a-non-integer',
            `urlParams: cannot write ?${name}=${JSON.stringify(value)} — it is not an integer, `
            + 'and the reader would refuse to read it back. A URL this page cannot reload is '
            + 'not a link to the run it is showing.');
    }
    q.set(name, String(value));
    return q;
}

/**
 * ⛓⛓ **THE FOUR KEYS `writeBounds` SPELLS**, in the order it writes them, with
 * the URL name each one takes. Declared rather than implied so the refusal
 * below can print both halves.
 */
export const BOUNDS_KEYS = Object.freeze([
    ['obstacleTarget', 'count'],
    ['triesPerStep', 'tries'],
    ['saturationK', 'k'],
    ['anchorTriesPerCandidate', 'anchortries'],
]);

/**
 * The four bounds, written. One writer.
 *
 * ⛔⛔ **AN UNKNOWN KEY REFUSES BY NAME** (`bounds-key-unknown`) — PROCGEN
 * DOCS · P5, arc 3 §17.15(2)'s debt, and ⚠ the record of it was WRONG about
 * what happened. It said a wrong key name "writes NOTHING rather than
 * complaining". Measured: `{count, tries, k, anchortries}` — the URL's own
 * short spellings, which is exactly the mistake a reader of a URL makes —
 * threw `urlParams: cannot write ?count=undefined — it is not an integer`,
 * which MISATTRIBUTES: it reads as *your count is bad* when the KEY is bad.
 * What really passed silently was an EXTRA key: `{…the four, count: 6}` wrote
 * the four and said nothing.
 *
 * ⚠ THE RULE IS "EXACTLY THE FOUR", not "the four must be present", and that
 * is a MEASURED choice: both callers (`watchGenerate.js`'s
 * `writeGenerateParams`, `mazeLab.js`'s `writeLabParams`) hand it the object
 * `readBounds` returned, which has exactly these four keys, and the unit rows
 * hand it `{...DEFAULT_BOUNDS, …}`. No caller legitimately passes an extra, so
 * an extra is a bug at the call site and this says which one.
 */
export function writeBounds(q, bounds) {
    const known = BOUNDS_KEYS.map(([long]) => long);
    const unknown = Object.keys(bounds ?? {}).filter((k) => !known.includes(k));
    if (unknown.length) {
        fail('bounds-key-unknown',
            `urlParams: writeBounds was handed ${JSON.stringify(unknown)}, which `
            + `${unknown.length === 1 ? 'is not a bound' : 'are not bounds'} it can write. `
            + `The four keys are the LONG names — ${known.map((k) => `\`${k}\``).join(', ')} `
            + `— and NOT the short spellings the URL uses `
            + `(${BOUNDS_KEYS.map(([, short]) => `\`?${short}=\``).join(', ')}), which is `
            + 'the mistake this refusal exists to name.');
    }
    writeInt(q, 'count', bounds.obstacleTarget);
    writeInt(q, 'tries', bounds.triesPerStep);
    writeInt(q, 'k', bounds.saturationK);
    writeInt(q, 'anchortries', bounds.anchorTriesPerCandidate);
    return q;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ROOM CONTRACT — `?width=`, `?height=`, `?fill=`
 * ══════════════════════════════════════════════════════════════════════
 *
 * PROCGEN ELEMENTS arc 5, slice 1 (⚖ rulings 1 and 2). The maze lab has read
 * `?width=`/`?height=` since it existed; the Seedling page's room was PINNED at
 * one screen and had no size channel at all. This is that channel, and it is
 * ONE reader and ONE writer per §8.6's standing law.
 *
 * ── ⛔ THE RANGE IS THE CALLER'S, NOT THIS FILE'S ─────────────────────
 *
 * `readRequire`'s rule, one parameter over: the VOCABULARY is an argument. The
 * maximum is 60 because that is the largest side any of the 116 VANILLA
 * Seedling levels carries — a fact about a substrate, measured in
 * `seedlingDemo/procgenLevel.js` beside the atlas it was measured from — and a
 * grammar file that hard-coded it would own a number it cannot check. So the
 * caller passes `grammar`, this file runs it, and the refusal it raises is
 * re-raised HERE under the name of the CHANNEL, exactly as `?areas=` does.
 *
 * ── ⛔ ABSENT IS THE DEFAULT AND THE DEFAULT IS NOT WRITTEN ───────────
 *
 * `?skeleton=`'s rule. ⚠ AND A NAMED DEFAULT IS A DIFFERENT URL FOR THE SAME
 * ROOM, which is exactly what a size may be and an element parameter may not:
 * an element parameter that is NAMED spends no draw while an omitted one is
 * DRAWN (arc-2 §11.5), so the two build different levels. Size is a CONSTANT
 * INPUT — it moves no stream — so `?width=10` and no parameter at all build the
 * same room cell for cell, and this slice proves that with the pair rather than
 * asserting it about one arm.
 */

/**
 * ⛓ `?width=`/`?height=` → `{width, height}`, each falling back to the
 * caller's own default. ⛔ Both axes are read by ONE function because a room is
 * one setting: a page that read them apart would have two places to teach the
 * next bound.
 *
 * @param {object} o
 * @param {object} o.defaults  `{width, height}` — what ABSENT means here
 * @param {function} [o.grammar]  `({width, height}) => …`, run for its refusal
 * @param {string} [o.substrate]  what the refusal calls this page
 */
export function readSize(q, { defaults, grammar = null, substrate = 'this page' } = {}) {
    const size = {
        width: intParam(q, 'width', defaults.width),
        height: intParam(q, 'height', defaults.height),
    };
    if (!grammar) return size;
    /** ⛔ ONE ADJUDICATION, NAMED FOR ITS CHANNEL — `readAreas`' rule. */
    try {
        grammar(size);
    } catch (e) {
        fail('room-size-refused',
            `urlParams: ?width=${size.width}&height=${size.height} on ${substrate} — `
            + `${e.message}`);
    }
    return size;
}

/**
 * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6's standing law) and
 * DELETES each axis at its default, IN PLACE — never delete-then-set, which
 * would move the key to the end of the bar and break the fixed point on the
 * second load (GENERATE-UI slice 4 measured that on `?families=`).
 *
 * ⚠ THE ROUND TRIP CANNOT SEE A WRITER THAT KEPT THE PARAMETER AT ITS DEFAULT
 * (trap 250: a fixed point tests SELF-CONSISTENCY): `?width=10` reads back as
 * 10 and re-writes as `?width=10` forever. The row that gates this compares the
 * written STRING against the expected one.
 */
export function writeSizeParams(q, size, { defaults, grammar = null } = {}) {
    const pairs = [['width', size?.width ?? defaults.width], ['height', size?.height ?? defaults.height]];
    for (const [name, value] of pairs) {
        if (!Number.isInteger(value)) {
            fail('cannot-write-a-room-size',
                `urlParams: cannot write ?${name}=${JSON.stringify(value)} — a room side is a `
                + 'whole number of tiles, and the reader would refuse to read it back.');
        }
    }
    if (grammar) {
        try {
            grammar({ width: pairs[0][1], height: pairs[1][1] });
        } catch (e) {
            fail('cannot-write-a-room-size',
                `urlParams: cannot write ?width=${pairs[0][1]}&height=${pairs[1][1]} — `
                + `${e.message}`);
        }
    }
    for (const [name, value] of pairs) {
        if (value === defaults[name]) q.delete(name);
        else q.set(name, String(value));
    }
    return q;
}

/**
 * ⛓ `?fill=` → the record's FILL MODE, a bare enum with its own parameter.
 *
 * ── ⚖ §6 Q1: ITS OWN PARAMETER, AND THE GRAMMAR'S PRECEDENTS DECIDED IT ──
 *
 * The alternative was a clause on the skeleton spec — `?skeleton=empty;fill=
 * shell` — and the spec grammar is `procgenCore/skeletonKinds.js`, which BOTH
 * substrates parse. ⛔ Three of this file's own precedents point the other way:
 * a skeleton parameter is a parameter of the CARVE (`minRoom`, `chambers`) and
 * is validated against the KIND's declared domain, while the fill is a property
 * of the RECORD and is true of `empty` and of every carved kind alike; the maze
 * has no record format to strip, so the clause would be a Seedling-only key in
 * a shared codec (the `?biome=` collision this file already refuses over); and
 * the size knobs it belongs beside are their own parameters on both pages. ⇒
 * its own key, DELETED at the default `dense` — the same rule `?skeleton=` and
 * `?areas=` follow.
 */
export function readFill(q, { fallback, grammar = null, substrate = 'this page' } = {}) {
    const raw = q.get('fill');
    if (raw === null || raw === '') return fallback;
    if (!grammar) return raw;
    try {
        return grammar(raw);
    } catch (e) {
        fail('fill-mode-refused', `urlParams: ?fill= on ${substrate} — ${e.message}`);
        return null;
    }
}

/** ⛔ DELETED at the default; refuses on the way out what the reader refuses. */
export function writeFillParam(q, fill, { fallback, grammar = null } = {}) {
    const value = fill ?? fallback;
    if (grammar) {
        try {
            grammar(value);
        } catch (e) {
            fail('cannot-write-a-fill-mode', `urlParams: cannot write ?fill= — ${e.message}`);
        }
    }
    if (value === fallback) q.delete('fill');
    else q.set('fill', String(value));
    return q;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SKELETON KIND — `?skeleton=<kind>`
 * ══════════════════════════════════════════════════════════════════════
 *
 * CONSTRUCTIVE-MODE slice 5 (⚖ kickoff §3.3–3.4). The room the loop STARTS
 * from, named by the one vocabulary both substrates share
 * (`procgenCore/skeletonKinds.js`).
 *
 * ── ⛔ IT IS NEVER SPELLED `?biome=`, AND THE COLLISION WAS REAL ──────
 *
 * ⚖ §3.4's measured note, carried whole: `?biome=` on BOTH pages selects the
 * PALETTE — Seedling's boot inventory, the maze's template set — while
 * `mazeRoomBiomeLibrary` ALSO says "biome" for the wall backends whose names
 * this parameter carries. Two settings, one word, on one page, was the failure
 * this grammar is full of refusals about; slice 3 wrote the warning down and
 * this is the slice that had to obey it.
 *
 * ── ⛔ ABSENT IS THE DEFAULT, AND THE DEFAULT IS NOT WRITTEN ──────────
 *
 * `empty` — the open room — is spelled by LEAVING THE PARAMETER OUT, the same
 * rule the whole roster follows. ⚠ And the writer DELETES it rather than
 * setting it, because a `delete` followed by a `set` of one key APPENDS it: a
 * writer that always wrote `?skeleton=empty` would move nothing, but one that
 * deleted-then-set on the way back to the default would reorder the bar and
 * break the fixed point (GENERATE-UI slice 4 measured exactly that on
 * `?families=`).
 *
 * ── ⛓⛓⛓ KIND PARAMETERS — `?skeleton=<kind>;<key>=<value>;…` (SLICE 7)
 *
 * ⚖ Open question 5's default spelling, landed. Slice 5 REFUSED a `;` clause by
 * name and reserved it for exactly this; slice 7 turned the reservation into a
 * grammar (`rooms;minRoom=2;chambers=1`).
 *
 * ⛔ THE PARSER IS **NOT HERE** — it is `skeletonKinds.parseSkeleton`, beside
 * the table it validates against, because the same string arrives on three
 * channels: this parameter, both CLIs' `--skeleton=`, and the sweep's
 * `--kinds=`. A parser in this file would have made a CLI import the URL
 * grammar or grow a second one. What IS here is the ONE READER and the ONE
 * WRITER of the PARAMETER, which is what §8.6's law is about.
 *
 * ⛔ AND THE WRITER EMITS A VALUE ONLY WHEN IT IS OFF ITS DEFAULT, keys in
 * DECLARATION order — the same rule the kind itself follows. `?skeleton=rooms`
 * and `?skeleton=rooms;minRoom=3` would otherwise be two spellings of one room,
 * and the round trip would pick whichever the writer felt like.
 */

/**
 * @param {object} o
 * @param {boolean} o.simulator  does the READING binding have the maze
 *   simulator? An unoffered kind refuses HERE, before any generation, with the
 *   list this page can actually build.
 * @param {string} o.substrate   what the refusal calls this page.
 */
export function readSkeleton(q, { simulator = false, substrate = 'this page' } = {}) {
    return readSkeletonTyped(q, { simulator, substrate }).spec;
}

/**
 * ⛓⛓⛓ **THE SAME READER, PLUS THE STRING AS TYPED** — PROCGEN ELEMENTS arc 3,
 * slice 5a (D2), ⚖ ruled by the orchestrating session on 2026-08-18: *"the
 * reader hands the resolver the spec AS TYPED and normalisation happens in the
 * binding."*
 *
 * ⛔ **IT IS ONE READER WITH ONE MORE FIELD, NOT A SECOND READER.** `q.get(
 * 'skeleton')` happens HERE and nowhere else; `readSkeleton` is a projection of
 * this, so the refusal, the offer list and the default are all still stated
 * once. The maze takes the projection and is byte-identical.
 *
 * ⛔ **WHY THE RAW STRING IS LOAD-BEARING.** `parseSkeleton` returns
 * `normalizeSkeleton`'s answer, which spells a value AT THE CODEC'S DEFAULT BY
 * ABSENCE — so `winding;chambers=0` and a bare `winding` come back as the SAME
 * object. A binding whose own default differs from the codec's (Seedling:
 * `chambers = 1` on five carved kinds) therefore cannot tell *nobody said* from
 * *the caller typed 0*, and 4d §15.2 measured the consequence: a typed
 * `chambers=0` was UNSPELLABLE IN A LINK. `seedlingSkeletonSpec` already
 * accepts a STRING as typed (4b wrote it that way for the CLI); this hands it
 * one.
 *
 * @returns {{spec: object, raw: string|null}} `raw` is `null` when the
 *   parameter is absent — which is what *nobody said* looks like, and it is a
 *   different fact from any string.
 */
export function readSkeletonTyped(q, { simulator = false, substrate = 'this page' } = {}) {
    const raw = q.get('skeleton');
    if (raw === null || raw === '') return { spec: { kind: DEFAULT_SKELETON_KIND }, raw: null };
    /**
     * ⛔ ONE ADJUDICATION, NAMED FOR ITS CHANNEL. The offer list, the
     * unknown-kind sentence and every parameter refusal are
     * `skeletonKinds`' — a second copy here would be two answers to "which
     * rooms may I ask for" — but a reader who typed this into an ADDRESS BAR
     * has to be told which PARAMETER they typed, so the refusal is re-thrown
     * with it in front and the original text verbatim.
     */
    try {
        return { spec: parseSkeleton(raw, { simulator, substrate }), raw };
    } catch (e) {
        fail('skeleton-spec-refused',
            `urlParams: ?skeleton=${JSON.stringify(raw)} — ${e.message}`);
        return null;
    }
}

/**
 * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6's standing law) —
 * so it runs the same `assertKind`, against the same offer list.
 */
export function writeSkeletonParam(q, skeleton, {
    simulator = false, substrate = 'this page', explicit = [],
} = {}) {
    const norm = normalizeSkeleton(skeleton ?? { kind: DEFAULT_SKELETON_KIND });
    /**
     * ⛔ IT REFUSES WHAT THE READER WOULD REFUSE — so it re-parses its own
     * output. ⛓ SLICE 7 made that literal rather than a claim: the writer
     * formats `{kind, params}` to the string and hands the string to the SAME
     * parser the reader uses, so a value the reader could not read back cannot
     * be written in the first place. (A kind this binding cannot run is caught
     * here too, by the same `assertKind` inside it.)
     */
    /**
     * ⛓⛓ `explicit` (slice 5a, D2) — the keys this BINDING spells even at the
     * codec's default, so a typed `chambers=0` survives the round trip. ⛔ It
     * is the CALLER's list, passed down from the binding that owns the default;
     * this file has no table of anybody's defaults. A caller that passes none
     * gets the spelling this writer has always produced — which is why the maze
     * is byte-identical (`check-maze-lab` 122/0 and the maze md5s are the gate).
     * ⚠ `norm` is still what the DELETE-at-default question is asked of.
     */
    const value = formatSkeleton(skeleton ?? { kind: DEFAULT_SKELETON_KIND }, { explicit });
    parseSkeleton(value, { simulator, substrate });
    if (formatSkeleton(norm) === DEFAULT_SKELETON_KIND) q.delete('skeleton');
    else q.set('skeleton', value);
    return q;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE AREA GRAPH — `?areas=<keys>[;k=v]…` AND `?require=K0,K1`
 * ══════════════════════════════════════════════════════════════════════
 *
 * PROCGEN ELEMENTS arc 1, slice 3 (arc kickoff §3.5/§3.6, design §4.8). TWO
 * parameters, ONE reader and ONE writer each, and ⛔ **NO NEW GRAMMAR**: the
 * strings are `areaSpec.parseAreaSpec`/`formatAreaSpec` and
 * `parseRequireList`/`formatRequireList`, the same codec the two CLIs and the
 * sweep already speak (slice 2 wrote it for exactly this). What lives HERE is
 * the parameter — absence, the default, the delete-in-place — which is what
 * §8.6's one-reader/one-writer law is about.
 *
 * ── ⛔ WHY `?require=` IS ITS OWN PARAMETER AND DOES NOT RIDE `?directed=`
 *
 * ⚖ Decided by what the two directives CONSTRAIN. `?directed=` names a
 * TEMPLATE, its parameters and (optionally) an anchor cell — a PASS-2 attempt
 * on the record as it stands, one entry per press, replayed in order.
 * `require:[K…]` constrains the AREA GRAPH, which is built ONCE at model
 * construction before pass 2 exists, and it is a property of the WHOLE RUN
 * rather than of an attempt: it is met or the run is REFUSED. Spelling it as a
 * `?directed=` verb would have put a run-level predicate into a per-attempt
 * list whose entries each carry an outcome, and the page would have had to
 * explain what "attempt 2 of 3 required K0" means. ⛓ It is also the parameter
 * pair the sweep and both CLIs already spell separately (`--areas=`,
 * `--require=`), and one grammar across the channels is the law.
 *
 * ── ABSENT IS THE DEFAULT, AND THE DEFAULT IS NOT WRITTEN ─────────────
 *
 * `?areas=` absent ≡ `{keys: 0}` ≡ *the binding does not run the module at all*
 * (⚖ arc ruling 3), and the writer DELETES at that value rather than writing
 * `?areas=0` — trap 245's in-place rewrite, the same rule `?skeleton=` follows
 * and for the same measured reason (a `delete` followed by a `set` APPENDS the
 * key and moves it to the end of the bar, which breaks the fixed point).
 * `?require=` absent ≡ NO DIRECTIVE; an EMPTY `?require=` REFUSES rather than
 * reading as absent (a directive somebody emptied is not the same as no
 * directive — `?families=`' own rule).
 *
 * ⛔ AND THE COMBINATION IS **NOT** ADJUDICATED HERE. `?require=K1&areas=1`
 * asks for a symbol the key count does not declare, and that refusal belongs to
 * the RUN, which knows both values and can say *"no key level admits K1 within
 * maxKeys=1"* with the graph's own bounds in the sentence. A reader that
 * refused the pair would have to be given the other parameter, which is how one
 * reader becomes two.
 */

/**
 * ⛓ `?areas=` → `{keys[, params]}`, NORMALIZED (params omitted at their
 * defaults) so one graph has exactly one spelling on the state and
 * `agreementWithPayload` can compare with a both-sides default.
 */
export function readAreas(q) {
    const raw = q.get('areas');
    if (raw === null || raw === '') return DEFAULT_AREAS;
    /** ⛔ ONE ADJUDICATION, NAMED FOR ITS CHANNEL — `readSkeleton`'s rule. */
    try {
        return parseAreaSpec(raw);
    } catch (e) {
        fail('area-spec-refused',
            `urlParams: ?areas=${JSON.stringify(raw)} — ${e.message}`);
        return null;
    }
}

/**
 * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6's standing law): it
 * formats through the one formatter and hands the string back to the SAME
 * parser, so a spec the reader could not read back cannot be written.
 */
export function writeAreasParam(q, areas) {
    const value = formatAreaSpec(normalizeAreaSpec(areas ?? DEFAULT_AREAS));
    parseAreaSpec(value);
    if (value === String(DEFAULT_AREAS.keys)) q.delete('areas');
    else q.set('areas', value);
    return q;
}

/**
 * ⛓ `?require=K0,K1` → a frozen list, or `null` when the parameter is absent.
 *
 * ⛓⛓⛓ **THE VOCABULARY IS AN ARGUMENT** — PROCGEN ELEMENTS arc 3, slice 5a
 * (D1), and it had to become one the moment the SEEDLING page read this
 * parameter. `require` names an AREA-GRAPH SYMBOL on the maze (`K0`) and an
 * ITEM FLAG on Seedling (`hasSword` — 4d D1), and 4d already made
 * `areaSpec.parseRequireList` take the vocabulary as an argument for exactly
 * that reason (`elementSpec.parseItemRequireList` is the Seedling spelling).
 * This reader was the one channel that had not been given it, and until it was
 * `?require=hasSword` refused with the maze's sentence — measured by this
 * slice's own unit row before it was written.
 *
 * ⛔ THE DEFAULT IS THE MAZE's, so `mazeLab.js` is unchanged and byte-identical.
 * ⛔ AND THE PARSER IS STILL `areaSpec`'s — one grammar, three channels; what
 * differs is which names it will accept, which is the SUBSTRATE's fact.
 *
 * @param {object} [o.grammar] a `(value) => frozen list` — `parseItemRequire
 *   List` on Seedling. Defaults to the area-graph symbol vocabulary.
 */
export function readRequire(q, { grammar = parseRequireList } = {}) {
    const raw = q.get('require');
    if (raw === null) return null;
    try {
        return grammar(raw);
    } catch (e) {
        fail('require-list-refused',
            `urlParams: ?require=${JSON.stringify(raw)} — ${e.message}`);
        return null;
    }
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ELEMENT — `?elements=<name>[;k=v]…`
 * ══════════════════════════════════════════════════════════════════════
 *
 * PROCGEN ELEMENTS arc 2, slice 4 (arc kickoff §3.4). ONE reader, ONE writer,
 * and ⛔ **NO NEW GRAMMAR**: the string is `elementSpec.parseElementSpec` /
 * `formatElementSpec`, the very codec `generate-maze-level.mjs --elements=` and
 * `sweep-yield-table.mjs --elements=` already speak (slice 3 wrote it for
 * exactly this). What lives HERE is the parameter — absence, the default, the
 * delete-in-place — which is what §8.6's one-reader/one-writer law is about.
 *
 * ── ABSENT IS THE DEFAULT, AND THE DEFAULT IS NOT WRITTEN ─────────────
 *
 * `?elements=` absent ≡ `{name: 'none'}` ≡ *the element machinery does not run
 * at all* (⚖ arc-2 ruling 5: no site drawn, nothing instantiated, `construct`
 * never called, no draw spent, every maze md5 byte-identical). The writer
 * DELETES at that value rather than writing `?elements=none` — trap 245's
 * in-place rewrite, the same rule `?skeleton=` and `?areas=` follow and for the
 * same measured reason: a `delete` followed by a `set` APPENDS the key and moves
 * it to the end of the bar, which breaks the round-trip fixed point.
 *
 * ⛔ AND IT IS **NOT** ADJUDICATED AGAINST `?areas=` HERE. `?elements=guard;
 * binds=item&areas=2` refuses at every seed (there is only one item-bearing
 * area, `elementSpec.BINDS_PARAM`), and that refusal belongs to the RUN, which
 * knows both values and can name the key level it could not fill. A reader that
 * refused the pair would have to be given the other parameter, which is how one
 * reader becomes two.
 */

/**
 * ⛓ `?elements=` → `{name[, params]}`, NORMALIZED. ⚠ Unlike `readAreas`, the
 * normalizer KEEPS a parameter the caller named even at its default value:
 * `?elements=guard;len=3` and `?elements=guard` are DIFFERENT RUNS, because a
 * named parameter is an override that spends no draw and an omitted one is
 * drawn. That absence is load-bearing (`elementSpec.namedParams`), so this
 * reader must not "tidy" it.
 */
export function readElements(q) {
    return readElementsTyped(q).spec;
}

/**
 * ⛓⛓⛓ **THE SAME READER, PLUS WHETHER THE PARAMETER WAS THERE AT ALL** —
 * PROCGEN ELEMENTS arc 3, slice 5a (D1), and it is `readSkeletonTyped`'s shape
 * for the same class of reason.
 *
 * ⛔ **ON THE MAZE, ABSENT ≡ `none`. ON SEEDLING IT IS NOT.** Arc-2 ruling 5
 * made `?elements=` absent mean *the machinery does not run*, which on the maze
 * IS the default. Arc-3 slice 4c gave Seedling a BIOME-DEPENDENT default
 * (`defaultElementsFor(items)` — `guard;len=2+blockpocket`, plus `killgate`
 * post-sword), resolved in the SEAM, and the seam distinguishes `undefined`
 * (*nobody said* ⇒ the biome default) from an explicit `{name:'none'}` (a
 * CHOICE, honoured). A page that could only hand it `readElements`' answer
 * could never ask for the default at all — it would spell `none` on every
 * load and silently turn the default off.
 *
 * ⛔ ONE READER STILL: `q.get('elements')` happens HERE, `readElements` is the
 * projection, and the maze is unmoved.
 *
 * @returns {{spec: object, raw: string|null}}
 */
export function readElementsTyped(q) {
    const raw = q.get('elements');
    if (raw === null || raw === '') return { spec: DEFAULT_ELEMENTS, raw: null };
    /** ⛔ ONE ADJUDICATION, NAMED FOR ITS CHANNEL — `readSkeleton`'s rule. */
    try {
        return { spec: parseElementSpec(raw), raw };
    } catch (e) {
        fail('element-spec-refused',
            `urlParams: ?elements=${JSON.stringify(raw)} — ${e.message}`);
        return null;
    }
}

/**
 * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6's standing law): it
 * formats through the one formatter and hands the string back to the SAME
 * parser, so a spec the reader could not read back cannot be written.
 */
export function writeElementsParam(q, elements, { deleteAt = DEFAULT_ELEMENTS.name } = {}) {
    /**
     * ⛓⛓ SLICE 5a (D1) — `undefined` IS *NOBODY SAID* AND ALWAYS DELETES, on
     * every substrate. It is the only spelling of *absent* a caller has, and a
     * writer that turned it into `none` would put a CHOICE in the bar that the
     * reader would then hand to a seam expecting silence.
     */
    if (elements === undefined) { q.delete('elements'); return q; }
    const value = formatElementSpec(normalizeElementSpec(elements ?? DEFAULT_ELEMENTS));
    parseElementSpec(value);
    /**
     * ⛓⛓⛓ `deleteAt` — **WHICH VALUE THIS BINDING SPELLS BY ABSENCE**, and on
     * Seedling the answer is NONE OF THEM. The maze's default IS `none`, so
     * `?elements=none` and no parameter are two spellings of one run and the
     * writer drops it (trap 245's in-place rewrite). Seedling's default is the
     * BIOME's spec, so `?elements=none` is *turn the default off* — a different
     * run — and dropping it would hand back a link that regenerates with the
     * gadget the reader just removed. ⛔ The caller says which, because only the
     * caller knows what its own absence means.
     */
    if (deleteAt !== null && value === deleteAt) q.delete('elements');
    else q.set('elements', value);
    return q;
}

/**
 * ⛔ DELETED when there is no directive; re-parsed on the way out.
 *
 * ⛓⛓ **AND WITH THE SAME `grammar` THE READER WAS GIVEN** (slice 5a, D1) —
 * §8.6's standing law is that the writer refuses what the READER would refuse,
 * and once the reader's vocabulary became the substrate's, a writer still
 * holding the maze's would refuse `hasSword` on the way out of a page that had
 * just accepted it on the way in. Measured by this slice's own unit row.
 */
export function writeRequireParam(q, require, { grammar = parseRequireList } = {}) {
    const value = formatRequireList(require);
    if (value === '') { q.delete('require'); return q; }
    grammar(value);
    q.set('require', value);
    return q;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE SUB-ROSTER — `?families=` (coarse) or `?templates=` (fine)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE RESTRICTION AS THE URL SPELLS IT — a comma list either way; ABSENT
 * means the whole roster.
 *
 * ⛔ **BOTH PRESENT REFUSES.** They are two spellings of one setting, and the
 * Seedling page has already paid for that failure mode once. The refusal names
 * both values so the fix is obvious — *say it one way*.
 *
 * ⛔ AND `?families=` WITH AN EMPTY VALUE REFUSES rather than reading as absent.
 * The integers above treat `''` as "not given" because there is no empty
 * integer; an empty LIST is a different thing — it is a restriction somebody
 * emptied, and the whole roster is spelled by leaving the parameter out.
 *
 * ⚠ IT RETURNS THE RAW `{axis, names}`. Validating the MEMBERS needs a palette,
 * and a palette is the caller's biome — so the caller runs `normalizeRoster`
 * (`paletteRoster.js`) on this, which is what turns an unknown family into a
 * refusal BY NAME instead of a silently widened roster.
 */
export function readRosterSpec(q) {
    const families = q.get('families');
    const templates = q.get('templates');
    if (families !== null && templates !== null) {
        fail('both-roster-axes-are-present',
            `urlParams: ?families=${JSON.stringify(families)} AND `
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
        fail('a-roster-axis-names-nothing',
            `urlParams: ?${axis}=${JSON.stringify(value)} names nothing. The WHOLE roster is `
            + 'spelled by leaving the parameter out; an empty list is a restriction somebody '
            + 'emptied, and the loop refuses an empty palette as a finding ABOUT THE PALETTE.');
    }
    return { axis, names };
}

/**
 * ⛓⛓ THE SCOPED DELETE, AND THE FIXED POINT FORCED IT.
 *
 * A `delete` followed by a `set` of the SAME key APPENDS it —
 * `URLSearchParams.set` preserves an existing key's position but a deleted key
 * has none — so blanket-deleting both spellings first rewrote
 * `…&families=…&run=1` into `…&run=1&families=…` on the second load. The string
 * differed while the run did not, which is exactly the drift the fixed-point
 * check exists to catch, and it caught this one.
 *
 * ⚠ The names are written SORTED because `normalizeRoster` sorts them: an
 * order-preserving writer would round-trip once and then rewrite the bar on the
 * next load.
 *
 * @param {object|null} normalized a `normalizeRoster` output, or null.
 */
export function writeRosterParam(q, normalized) {
    if (!normalized) {
        q.delete('families');
        q.delete('templates');
        return q;
    }
    q.delete(normalized.axis === 'families' ? 'templates' : 'families');
    q.set(normalized.axis, normalized.names.join(','));
    return q;
}

/* ══════════════════════════════════════════════════════════════════════
 * WHICH LADDER STEP — the `run` + `count` encoding
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ ONE reader of the `run` + `count` encoding.
 *
 * ⛔ THE ENCODING IS SPLIT ACROSS TWO PARAMETERS AND THAT IS DELIBERATE:
 * `count` is `state.bounds.obstacleTarget` — which at step k IS k, because the
 * step call overrides it — and `run=1` says a RUN is what is on screen at all,
 * with the parameter DELETED at step 0 rather than spelt `run=0`. ⚠ But at STEP
 * 0 nothing overrides `count`, so a skeleton's URL carries the FORM's target
 * beside no `run`, and "which step is this?" is `run ? count : 0` rather than
 * `count`.
 */
export function stepFromParams(params) {
    return params?.run ? params.bounds.obstacleTarget : 0;
}

/** `run=1` iff a run is on screen; DELETED at step 0 — never a second absence. */
export function writeRunFlag(q, step) {
    if (!Number.isInteger(step)) {
        fail('cannot-write-a-run-flag-for-that-step',
            `urlParams: cannot write the run flag for step ${JSON.stringify(step)} — the step `
            + 'must be a non-negative integer.');
    }
    if (step >= 1) q.set('run', '1');
    else q.delete('run');
    return q;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE DIRECTED ATTEMPTS — THE GRAMMAR, AND ⛔ IT IS NOT A URL PARAMETER
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ The level is LADDER + DIRECTIVES + EDITS, and ⛔ **SLICE 12 TOOK THE LIST
 * OFF THE ADDRESS BAR**: the PAYLOAD names the whole construction, and this
 * text is what the two CLIs' `--directed=` speaks and what a payload's
 * `instance` labels are spelled in. The three channels are one grammar, which
 * is the law this file exists for; only the address bar dropped out.
 *
 *   --directed=<d>;<d>;…            (⛔ and NOT ?directed=)
 *   <d> := <template>[ '(' <k>=<v>,… ')' ] '@' <bound> <policy> [ '!' tx ',' ty ]
 *
 * e.g. `wall-gap-block(ori=v,gap=1)@12d;water-pool(w=2,h=3)@12d`
 *
 * ⛓ The parenthesised clause IS `templateContract.instanceLabel`'s spelling —
 * the same string the pane prints, the trace carries and a reader already knows
 * how to read. A second spelling of "which instance" would be the two-spellings
 * failure mode inside the thing that exists to name a construction. A
 * zero-parameter template has no clause at all, exactly as its label is its
 * bare name.
 *
 * `<bound>` is the anchor bound — ⚖ a bounded walk NAMES its bound, and a
 * directive is a bounded walk somebody may re-run years later. ⛔ It is
 * per-directive rather than global because a click-to-anchor is a directive at
 * bound 1, and a construction mixing the two must still be nameable in one
 * string.
 *
 * ⛓⛓⛓ **THE `<d|s>` POLICY LETTER LEFT THE GRAMMAR IN ARC-3 SLICE 4c** (⚖ user,
 * 2026-08-17). It named `KEEP_POLICY.PREFER_DISCHARGE` vs `FIRST_SOLVED`, and
 * the preference is now STRUCTURALLY VACUOUS on Seedling for two independent
 * reasons: S1 §11.9 measured the `solved-only` class EMPTY, and slice 4c retired
 * the last three templates with a VERB at all (`shove`/`weigh`/`kill` moved to
 * the elements), so `dischargesVerb` answers `null` — `NO_VERB` — for every row
 * the palette still holds. A letter that names a choice with one reachable
 * value is an input nobody can act on.
 *
 * ⛔ AN OLD LINK CARRYING THE LETTER **REFUSES BY NAME** rather than being read
 * with it stripped. `@12s` and `@12d` were different questions; only one of them
 * survives, and silently answering the other one is exactly the reinterpretation
 * a versioned grammar exists to prevent. The refusal says to drop the letter.
 *
 * ⛔ **ONLY THE INPUTS ARE ENCODED.** `outcome` and `keptKind` are RESULTS —
 * what re-running produces, not what it takes — and a text that carried them
 * could be edited into a claim the reproduction contradicts. The payload
 * records them because a payload is a REPORT; `--directed=` is an INSTRUCTION.
 * ⚠ A payload's RECORDED directive is a superset of a spec (its `params` are
 * the RESOLVED values), which is exactly what makes a payload replay spend no
 * draw and come back byte-identical.
 */

/**
 * ⛓ THE ONE POLICY A SEEDLING DIRECTIVE RUNS UNDER, since arc-3 slice 4c — a
 * CONSTANT rather than a parsed letter. ⛔ It is still recorded on the directive
 * (a payload is a REPORT and must say what was run) and still passed to
 * `directedAttempt` explicitly rather than left to that function's own default,
 * so the day the maze's measurement gives Seedling the preference back, the one
 * line to change is here and not in three call sites.
 */
const DIRECTIVE_KEEP_POLICY = KEEP_POLICY.FIRST_SOLVED;

export { DIRECTIVE_KEEP_POLICY };

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
 * parameters were drawn rather than typed. ⛓ The same "two streams, two seeds
 * from one" shape both bindings use to keep the room stream and the template
 * stream from shifting each other.
 *
 * ⚠ AND THE INDEX IS IN THE MIX, so two identical directives are two different
 * questions: without it the second would walk the first's anchor order and meet
 * its own placement.
 *
 * ⚠ `seedMax` IS THE SOURCE'S, PASSED IN. Seedling's orbit is [1, 2^31−1] and
 * the maze's is [0, 2^31−1] (`mazeRoom/procgenRng.js` — mulberry32 has no
 * "inherit the boot seed" sentence for 0). The `+1` keeps the derived seed
 * inside BOTH, which is why it is not cosmetic.
 */
const PARAM_SALT = 1;
const ANCHOR_SALT = 2;
export { PARAM_SALT, ANCHOR_SALT };

export function directiveSeed(seed, index, salt, seedMax) {
    if (!Number.isInteger(seedMax) || seedMax <= 1) {
        fail('directive-seed-needs-the-seed-max',
            `urlParams: directiveSeed needs the RNG source's own seedMax, got `
            + `${JSON.stringify(seedMax)}. The two substrates' seed orbits differ, so a `
            + 'constant here would be one generator\'s fact imposed on the other.');
    }
    let h = 2166136261;
    for (const n of [seed >>> 0, (index + 1) >>> 0, salt]) {
        h = Math.imul(h ^ n, 16777619);
    }
    return (Math.abs(h) % (seedMax - 1)) + 1;
}

/**
 * A directive SPEC — the INPUTS — validated against the palette it will run on,
 * or a refusal BY NAME.
 *
 * ⛔ EVERY REFUSAL NAMES THE THING IT REFUSED AND WHAT WAS ON OFFER. An unknown
 * template, an unknown parameter, a value outside the declared domain and a
 * malformed clause are four different mistakes, and a reader who typed one of
 * them into an address bar has no other channel to learn which.
 *
 * ⚠ THE VALUE'S TYPE COMES FROM THE SCHEMA, NOT FROM THE TEXT. `len=4` must
 * become the NUMBER 4 because `wall-segment`'s domain holds numbers, while
 * `ori=v` stays a string — so a value is matched by STRINGIFYING each declared
 * domain member. ⛓ That also gives the domain check for free and in the right
 * place: a value outside the domain refuses HERE, before any solve.
 */
export function parseDirective(text, palette) {
    const raw = String(text).trim();
    /**
     * ⛔ THE RETIRED LETTER IS MATCHED FIRST AND REFUSED WITH ITS OWN SENTENCE,
     * because the generic *"is not a directive"* text would send a reader who
     * pasted a working 2026-08 link looking for a typo that is not there.
     */
    const stale = /^([A-Za-z0-9_-]+)(?:\(([^)]*)\))?@(\d+)([ds])(?:!(\d+),(\d+))?$/.exec(raw);
    if (stale) {
        const [, sName, sParams, sBound, sLetter, sx, sy] = stale;
        const fixed = `${sName}${sParams === undefined ? '' : `(${sParams})`}@${sBound}`
            + `${sx === undefined ? '' : `!${sx},${sy}`}`;
        fail('the-bound-ends-with-the-keep-policy-letter',
            `urlParams: the directive ${JSON.stringify(raw)} ends its bound with `
            + `"${sLetter}" — the KEEP-POLICY letter, which left the grammar in PROCGEN `
            + 'ELEMENTS arc 3 slice 4c. ⛓ Seedling runs every directive under '
            + '`first-solved` now: the `prefer-discharge` preference is vacuous here, '
            + 'because no template this palette still holds has a VERB to discharge (the '
            + `three door families became ELEMENTS). ⛔ Drop the letter — \`${fixed}\`.`);
    }
    const m = /^([A-Za-z0-9_-]+)(?:\(([^)]*)\))?@(\d+)(?:!(\d+),(\d+))?$/.exec(raw);
    if (!m) {
        fail('not-a-directive',
            `urlParams: ${JSON.stringify(raw)} is not a directive. The spelling is `
            + '`template(key=value,…)@<bound>` — the parenthesised clause is the '
            + 'INSTANCE LABEL the pane already prints and `<bound>` is how many legal '
            + 'anchors the attempt may be solved at. A zero-parameter template omits the '
            + 'clause entirely, e.g. `arrow-lane@12`.');
    }
    const [, name, paramText, boundText, tx, ty] = m;
    const base = (palette?.templates ?? []).find((t) => t.name === name);
    if (!base) {
        fail('the-palette-does-not-hold-this-template',
            `urlParams: the directive names template ${JSON.stringify(name)}, which palette `
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
                fail('a-clause-is-not-a-key-value-pair',
                    `urlParams: ${JSON.stringify(clause)} in the directive for `
                    + `"${name}" is not a \`key=value\` pair.`);
            }
            const key = clause.slice(0, eq).trim();
            const valueText = clause.slice(eq + 1).trim();
            const p = base.params.find((q) => q.key === key);
            if (!p) {
                fail('the-template-has-no-such-parameter',
                    `urlParams: template "${name}" has no parameter ${JSON.stringify(key)} `
                    + `— it declares [${base.params.map((q) => q.key).join(', ') || 'none'}]. `
                    + 'A silently ignored parameter is a link that names one instance and '
                    + 'builds another.');
            }
            const hit = p.domain.find((v) => String(v) === valueText);
            if (hit === undefined) {
                fail('the-value-is-outside-the-declared-domain',
                    `urlParams: template "${name}" parameter "${key}" was given `
                    + `${JSON.stringify(valueText)}, which is not in its declared domain `
                    + `[${p.domain.join(', ')}]. Every value in a domain is one a sweep `
                    + 'measured; a value outside it is one nobody has adjudicated.');
            }
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                fail('a-parameter-is-named-twice',
                    `urlParams: the directive for "${name}" names parameter `
                    + `${JSON.stringify(key)} twice. Two values for one parameter is two `
                    + 'spellings of one setting, in the smallest place it can happen.');
            }
            params[key] = hit;
        }
    }
    const bound = Number(boundText);
    if (!Number.isInteger(bound) || bound <= 0) {
        fail('the-bound-is-not-a-positive-integer',
            `urlParams: the directive for "${name}" names bound `
            + `${JSON.stringify(boundText)}, which is not a positive integer.`);
    }
    /**
     * ⛓ AN EXPLICIT ANCHOR IS A WALK OF ONE CELL, SO IT IS SPELLED `@1`. ⛔
     * `levelGenerator.directedAttempt` refuses any other bound beside an
     * explicit cell, and the reader refuses it HERE — before any solve —
     * because `@12!3,4` names a twelve-anchor search this attempt does not
     * perform, and a link that means something different from what it says is
     * the failure this whole grammar exists to avoid.
     */
    if (tx !== undefined && bound !== 1) {
        fail('an-explicit-anchor-with-a-bound',
            `urlParams: the directive for "${name}" names the EXPLICIT anchor `
            + `!${tx},${ty} and bound ${bound}. An explicit cell is a walk of ONE cell — `
            + `spell it \`@1!${tx},${ty}\`. Any other bound names a search this `
            + 'attempt does not perform.');
    }
    return Object.freeze({
        template: name,
        params: Object.freeze(params),
        /** The CLICKED cell, or `null` for a search. */
        anchor: tx === undefined ? null : Object.freeze({ tx: Number(tx), ty: Number(ty) }),
        /** ⛓ A CONSTANT since slice 4c — recorded, not chosen. See above. */
        keepPolicy: DIRECTIVE_KEEP_POLICY,
        bound,
    });
}

/** Every directive in a `--directed=` value, in order. */
export function parseDirectives(value, palette) {
    const text = String(value ?? '').trim();
    if (text === '') {
        fail('the-directive-list-names-nothing',
            'urlParams: --directed= names nothing. A level with no directives is '
            + 'spelled by leaving the flag out — an empty value is a construction '
            + 'somebody emptied, which is the same rule ?families= follows.');
    }
    return Object.freeze(text.split(';').map((d) => parseDirective(d, palette)));
}

/**
 * The inverse — ⛔ THE ONE WRITER'S half, and it round-trips through
 * `parseDirective` by construction: the params clause is built in SCHEMA ORDER,
 * not in insertion order, so two runs that reached the same values by different
 * routes (one drawn, one typed) spell them identically and the URL fixed point
 * holds.
 */
export function formatDirectives(directives, palette) {
    return (directives ?? []).map((d) => {
        const base = (palette?.templates ?? []).find((t) => t.name === d.template);
        if (!base) {
            fail('cannot-write-a-template-the-palette-lacks',
                `urlParams: cannot write a directive for ${JSON.stringify(d.template)} — `
                + `palette "${palette?.name}" does not hold it, so the reader `
                + 'would refuse to read it back. A URL this page cannot reload is not a link '
                + 'to the construction it is showing.');
        }
        /**
         * ⛔ §8.6's law, applied to a field the URL no longer spells: a
         * directive whose policy is not the one Seedling runs cannot be written,
         * because the link would read back as a DIFFERENT construction and
         * nothing on the page could say so. ⛓ Since slice 4c that is a
         * one-value check rather than a two-letter table — which is exactly what
         * "the class is structurally empty" looks like from the writer's side.
         */
        if (d.keepPolicy !== undefined && d.keepPolicy !== DIRECTIVE_KEEP_POLICY) {
            fail('cannot-write-that-keep-policy',
                `urlParams: cannot write a directive whose keep policy is `
                + `${JSON.stringify(d.keepPolicy)} — Seedling runs every directive under `
                + `${JSON.stringify(DIRECTIVE_KEEP_POLICY)} since PROCGEN ELEMENTS arc 3 `
                + 'slice 4c, and the URL grammar has no letter to spell any other.');
        }
        // ⛓ §8.6's law again: the writer refuses what the reader would refuse.
        // An explicit anchor beside a bound above 1 is a URL `parseDirective`
        // rejects, so it must not be writable.
        if (d.anchor && d.bound !== 1) {
            fail('cannot-write-both-an-explicit-anchor-and-a-bound',
                `urlParams: cannot write a directive for "${d.template}" that names both `
                + `the EXPLICIT anchor (${d.anchor.tx},${d.anchor.ty}) and bound ${d.bound}. `
                + 'An explicit cell is a walk of ONE cell; the reader would refuse '
                + 'to read this back.');
        }
        // ⚠ SCHEMA ORDER, and the values are checked on the way OUT as well —
        // the writer refuses what the reader would refuse (§8.6's law).
        const clause = base.params.map((p) => {
            const v = d.params?.[p.key];
            if (v === undefined) {
                fail('cannot-write-a-parameter-with-no-value',
                    `urlParams: the directive for "${d.template}" carries no value for `
                    + `"${p.key}". ⛔ It REFUSES rather than writing the default: a link that `
                    + 'silently filled a parameter would reproduce a different instance under '
                    + 'the same address, and the pin union cannot tell two instances of one '
                    + 'template apart.');
            }
            if (!p.domain.includes(v)) {
                fail('cannot-write-a-value-outside-the-domain',
                    `urlParams: the directive for "${d.template}" gives "${p.key}" the `
                    + `value ${JSON.stringify(v)}, which is outside its declared domain `
                    + `[${p.domain.join(', ')}].`);
            }
            return `${p.key}=${v}`;
        }).join(',');
        return `${d.template}${clause ? `(${clause})` : ''}@${d.bound}`
            + (d.anchor ? `!${d.anchor.tx},${d.anchor.ty}` : '');
    }).join(';');
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE RETIRED PARAMETER — `?directed=` (CONSTRUCTIVE-MODE SLICE 12)
 * ══════════════════════════════════════════════════════════════════════ */

/** The one sentence, so the reader's refusal and the docs cannot drift apart. */
export const DIRECTED_RETIRED = 'directives ride the PAYLOAD — load it via ?gen= or the '
    + 'host\'s SEND, or press ATTEMPT on the page; the CLI keeps --directed=';

/**
 * ⛔⛔ **`?directed=` IS REFUSED BY NAME** (⚖ kickoff §3.9, ruling 9's licence).
 *
 * A URL names the LAUNCH parameters a person types; a directive list is a
 * CONSTRUCTION, and the payload carries it. ⛔ It REFUSES rather than being
 * ignored: a link somebody saved before slice 12 names a level with templates
 * in it, and a page that silently dropped the parameter would show the plain
 * ladder under an address that promises otherwise — the exact "a link that
 * means something different from what it says" failure this grammar is full of
 * refusals about. The refusal NAMES THE WAY IN, because a reader holding an old
 * link has no other channel to learn where directives went.
 *
 * ⚠ AN EMPTY `?directed=` REFUSES TOO. The key being PRESENT is the whole test:
 * there is no value of a retired parameter that means anything.
 */
/**
 * ⛔⛔ **A DUPLICATED PARAMETER IS REFUSED BY NAME** (`duplicate-url-parameter`)
 * — PROCGEN DOCS · P5, arc 3 §17.15(3)'s debt.
 *
 * ⛓ THE SHAPE THAT COST A RUN: both generate-param writers already emit
 * `run=1` when `step > 0`, so appending `&run=1` by hand produces `run=1&run=1`
 * — and the reader ACCEPTED it, because `URLSearchParams.get` answers with the
 * first and never mentions the second. A hand-built URL could then carry the
 * duplicate forever, and the demo catalogue's coverage row would hold it as the
 * declared string.
 *
 * ⚠ IT IS NOT A ROUND-TRIP DEFECT AND THAT IS THE POINT. The writer never
 * emits one, so writing what was read fixes it silently; only a reader that
 * REFUSES tells the person holding the link. ⛔ Measured before it shipped: no
 * URL in any browser row, fixture, demo-catalogue entry or procgen document
 * carries a duplicated key (0 of 1,538 files scanned).
 *
 * @param q  the `URLSearchParams` the reader built — asked BEFORE any value is
 *           read, so the first answer a bad link gets is about its own shape.
 */
export function refuseDuplicateParams(q, { substrate = 'this page' } = {}) {
    const seen = new Set();
    const dup = [];
    for (const key of q.keys()) {
        if (seen.has(key) && !dup.includes(key)) dup.push(key);
        seen.add(key);
    }
    if (dup.length) {
        fail('duplicate-url-parameter',
            `urlParams: ${dup.map((k) => `?${k}=`).join(', ')} `
            + `${dup.length === 1 ? 'appears' : 'appear'} TWICE in this URL, and `
            + `${substrate} reads only the first. ⛔ A parameter given two values is two `
            + 'runs asked for in one link; say which one by giving it once. ⚠ Both writers '
            + 'already emit `run=1` when the step is past 0, so appending it by hand is how '
            + 'this happens.');
    }
    return q;
}

export function refuseDirectedParam(q, { substrate = 'this page' } = {}) {
    if (q.get('directed') === null) return q;
    fail('directed-is-retired',
        `urlParams: ?directed= is no longer a URL parameter (⚖ constructive-mode slice 12). `
        + `A URL names the LAUNCH parameters a person types; a directive list is a `
        + `CONSTRUCTION, and ${substrate} takes one from the PAYLOAD — ${DIRECTED_RETIRED}.`);
    return q;
}

/**
 * ⛔ THE WRITER NEVER EMITS `?directed=` — it DELETES it.
 *
 * ⛓ §8.6's standing law, in the direction slice 12 created: a URL this page
 * cannot READ must not be WRITTEN, and `refuseDirectedParam` is now what the
 * reader would do with this key. ⚠ It is unreachable by construction on a
 * booted page (the reader refuses before anything mounts, so the bar the writer
 * copies from can never hold one) — kept anyway, and asserted, because "the one
 * writer owns this key" is the property, not "no caller has managed to break it
 * yet". The delete is also what makes a `procgenLab:navigate` that inherited a
 * stale key end up with a bar the page can reload.
 */
export function dropDirectedParam(q) {
    q.delete('directed');
    return q;
}
