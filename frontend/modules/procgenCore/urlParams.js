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
 *   · the whole DIRECTIVE grammar — `template(k=v,…)@<bound><d|s>[!tx,ty]`,
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
 * `parseDirective`/`parseDirectives`/`formatDirectives`/`POLICY_LETTER`/
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
import { DEFAULT_BOUNDS, KEEP_POLICY } from './levelGenerator.js';
import {
    DEFAULT_SKELETON_KIND, formatSkeleton, normalizeSkeleton, parseSkeleton,
} from './skeletonKinds.js';

export class UrlParamsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UrlParamsError';
    }
}

const fail = (message) => { throw new UrlParamsError(message); };

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
        fail(`urlParams: ?${name}=${JSON.stringify(raw)} is not an integer. Every bound this `
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
        fail(`urlParams: cannot write ?${name}=${JSON.stringify(value)} — it is not an integer, `
            + 'and the reader would refuse to read it back. A URL this page cannot reload is '
            + 'not a link to the run it is showing.');
    }
    q.set(name, String(value));
    return q;
}

/** The four bounds, written. One writer. */
export function writeBounds(q, bounds) {
    writeInt(q, 'count', bounds.obstacleTarget);
    writeInt(q, 'tries', bounds.triesPerStep);
    writeInt(q, 'k', bounds.saturationK);
    writeInt(q, 'anchortries', bounds.anchorTriesPerCandidate);
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
    const raw = q.get('skeleton');
    if (raw === null || raw === '') return { kind: DEFAULT_SKELETON_KIND };
    /**
     * ⛔ ONE ADJUDICATION, NAMED FOR ITS CHANNEL. The offer list, the
     * unknown-kind sentence and every parameter refusal are
     * `skeletonKinds`' — a second copy here would be two answers to "which
     * rooms may I ask for" — but a reader who typed this into an ADDRESS BAR
     * has to be told which PARAMETER they typed, so the refusal is re-thrown
     * with it in front and the original text verbatim.
     */
    try {
        return parseSkeleton(raw, { simulator, substrate });
    } catch (e) {
        fail(`urlParams: ?skeleton=${JSON.stringify(raw)} — ${e.message}`);
        return null;
    }
}

/**
 * ⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6's standing law) —
 * so it runs the same `assertKind`, against the same offer list.
 */
export function writeSkeletonParam(q, skeleton, { simulator = false, substrate = 'this page' } = {}) {
    const norm = normalizeSkeleton(skeleton ?? { kind: DEFAULT_SKELETON_KIND });
    /**
     * ⛔ IT REFUSES WHAT THE READER WOULD REFUSE — so it re-parses its own
     * output. ⛓ SLICE 7 made that literal rather than a claim: the writer
     * formats `{kind, params}` to the string and hands the string to the SAME
     * parser the reader uses, so a value the reader could not read back cannot
     * be written in the first place. (A kind this binding cannot run is caught
     * here too, by the same `assertKind` inside it.)
     */
    const value = formatSkeleton(norm);
    parseSkeleton(value, { simulator, substrate });
    if (value === DEFAULT_SKELETON_KIND) q.delete('skeleton');
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
        fail(`urlParams: ?areas=${JSON.stringify(raw)} — ${e.message}`);
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

/** ⛓ `?require=K0,K1` → a frozen list, or `null` when the parameter is absent. */
export function readRequire(q) {
    const raw = q.get('require');
    if (raw === null) return null;
    try {
        return parseRequireList(raw);
    } catch (e) {
        fail(`urlParams: ?require=${JSON.stringify(raw)} — ${e.message}`);
        return null;
    }
}

/** ⛔ DELETED when there is no directive; re-parsed on the way out. */
export function writeRequireParam(q, require) {
    const value = formatRequireList(require);
    if (value === '') { q.delete('require'); return q; }
    parseRequireList(value);
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
        fail(`urlParams: ?families=${JSON.stringify(families)} AND `
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
        fail(`urlParams: ?${axis}=${JSON.stringify(value)} names nothing. The WHOLE roster is `
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
        fail(`urlParams: cannot write the run flag for step ${JSON.stringify(step)} — the step `
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
 * `<policy>` is `d` (prefer-discharge) or `s` (first-solved) and `<bound>` is
 * the anchor bound — ⚖ a bounded walk NAMES its bound, and a directive is a
 * bounded walk somebody may re-run years later. ⛔ They are per-directive
 * rather than global because a click-to-anchor is a directive at bound 1, and a
 * construction mixing the two must still be nameable in one string.
 *
 * ⛔ **ONLY THE INPUTS ARE ENCODED.** `outcome` and `keptKind` are RESULTS —
 * what re-running produces, not what it takes — and a text that carried them
 * could be edited into a claim the reproduction contradicts. The payload
 * records them because a payload is a REPORT; `--directed=` is an INSTRUCTION.
 * ⚠ A payload's RECORDED directive is a superset of a spec (its `params` are
 * the RESOLVED values), which is exactly what makes a payload replay spend no
 * draw and come back byte-identical.
 */

const POLICY_LETTER = Object.freeze({
    d: KEEP_POLICY.PREFER_DISCHARGE,
    s: KEEP_POLICY.FIRST_SOLVED,
});
const LETTER_FOR_POLICY = Object.freeze({
    [KEEP_POLICY.PREFER_DISCHARGE]: 'd',
    [KEEP_POLICY.FIRST_SOLVED]: 's',
});

export { POLICY_LETTER, LETTER_FOR_POLICY };

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
        fail(`urlParams: directiveSeed needs the RNG source's own seedMax, got `
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
    const m = /^([A-Za-z0-9_-]+)(?:\(([^)]*)\))?@(\d+)([ds])(?:!(\d+),(\d+))?$/.exec(raw);
    if (!m) {
        fail(`urlParams: ${JSON.stringify(raw)} is not a directive. The spelling is `
            + '`template(key=value,…)@<bound><d|s>` — the parenthesised clause is the '
            + 'INSTANCE LABEL the pane already prints, `<bound>` is how many legal anchors '
            + 'the attempt may be solved at, and the letter is the keep policy (`d` = prefer '
            + 'discharge, `s` = first solved). A zero-parameter template omits the clause '
            + 'entirely, e.g. `arrow-lane@12d`.');
    }
    const [, name, paramText, boundText, letter, tx, ty] = m;
    const base = (palette?.templates ?? []).find((t) => t.name === name);
    if (!base) {
        fail(`urlParams: the directive names template ${JSON.stringify(name)}, which palette `
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
                fail(`urlParams: ${JSON.stringify(clause)} in the directive for `
                    + `"${name}" is not a \`key=value\` pair.`);
            }
            const key = clause.slice(0, eq).trim();
            const valueText = clause.slice(eq + 1).trim();
            const p = base.params.find((q) => q.key === key);
            if (!p) {
                fail(`urlParams: template "${name}" has no parameter ${JSON.stringify(key)} `
                    + `— it declares [${base.params.map((q) => q.key).join(', ') || 'none'}]. `
                    + 'A silently ignored parameter is a link that names one instance and '
                    + 'builds another.');
            }
            const hit = p.domain.find((v) => String(v) === valueText);
            if (hit === undefined) {
                fail(`urlParams: template "${name}" parameter "${key}" was given `
                    + `${JSON.stringify(valueText)}, which is not in its declared domain `
                    + `[${p.domain.join(', ')}]. Every value in a domain is one a sweep `
                    + 'measured; a value outside it is one nobody has adjudicated.');
            }
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                fail(`urlParams: the directive for "${name}" names parameter `
                    + `${JSON.stringify(key)} twice. Two values for one parameter is two `
                    + 'spellings of one setting, in the smallest place it can happen.');
            }
            params[key] = hit;
        }
    }
    const bound = Number(boundText);
    if (!Number.isInteger(bound) || bound <= 0) {
        fail(`urlParams: the directive for "${name}" names bound `
            + `${JSON.stringify(boundText)}, which is not a positive integer.`);
    }
    /**
     * ⛓ AN EXPLICIT ANCHOR IS A WALK OF ONE CELL, SO IT IS SPELLED `@1`. ⛔
     * `levelGenerator.directedAttempt` refuses any other bound beside an
     * explicit cell, and the reader refuses it HERE — before any solve —
     * because `@12d!3,4` names a twelve-anchor search this attempt does not
     * perform, and a link that means something different from what it says is
     * the failure this whole grammar exists to avoid.
     */
    if (tx !== undefined && bound !== 1) {
        fail(`urlParams: the directive for "${name}" names the EXPLICIT anchor `
            + `!${tx},${ty} and bound ${bound}. An explicit cell is a walk of ONE cell — `
            + `spell it \`@1${letter}!${tx},${ty}\`. Any other bound names a search this `
            + 'attempt does not perform.');
    }
    return Object.freeze({
        template: name,
        params: Object.freeze(params),
        /** The CLICKED cell, or `null` for a search. */
        anchor: tx === undefined ? null : Object.freeze({ tx: Number(tx), ty: Number(ty) }),
        keepPolicy: POLICY_LETTER[letter],
        bound,
    });
}

/** Every directive in a `--directed=` value, in order. */
export function parseDirectives(value, palette) {
    const text = String(value ?? '').trim();
    if (text === '') {
        fail('urlParams: --directed= names nothing. A level with no directives is '
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
            fail(`urlParams: cannot write a directive for ${JSON.stringify(d.template)} — `
                + `palette "${palette?.name}" does not hold it, so the reader `
                + 'would refuse to read it back. A URL this page cannot reload is not a link '
                + 'to the construction it is showing.');
        }
        const letter = LETTER_FOR_POLICY[d.keepPolicy];
        if (!letter) {
            fail(`urlParams: cannot write a directive whose keep policy is `
                + `${JSON.stringify(d.keepPolicy)} — the URL spells only `
                + `[${Object.keys(POLICY_LETTER).join(', ')}].`);
        }
        // ⛓ §8.6's law again: the writer refuses what the reader would refuse.
        // An explicit anchor beside a bound above 1 is a URL `parseDirective`
        // rejects, so it must not be writable.
        if (d.anchor && d.bound !== 1) {
            fail(`urlParams: cannot write a directive for "${d.template}" that names both `
                + `the EXPLICIT anchor (${d.anchor.tx},${d.anchor.ty}) and bound ${d.bound}. `
                + 'An explicit cell is a walk of ONE cell; the reader would refuse '
                + 'to read this back.');
        }
        // ⚠ SCHEMA ORDER, and the values are checked on the way OUT as well —
        // the writer refuses what the reader would refuse (§8.6's law).
        const clause = base.params.map((p) => {
            const v = d.params?.[p.key];
            if (v === undefined) {
                fail(`urlParams: the directive for "${d.template}" carries no value for `
                    + `"${p.key}". ⛔ It REFUSES rather than writing the default: a link that `
                    + 'silently filled a parameter would reproduce a different instance under '
                    + 'the same address, and the pin union cannot tell two instances of one '
                    + 'template apart.');
            }
            if (!p.domain.includes(v)) {
                fail(`urlParams: the directive for "${d.template}" gives "${p.key}" the `
                    + `value ${JSON.stringify(v)}, which is outside its declared domain `
                    + `[${p.domain.join(', ')}].`);
            }
            return `${p.key}=${v}`;
        }).join(',');
        return `${d.template}${clause ? `(${clause})` : ''}@${d.bound}${letter}`
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
export function refuseDirectedParam(q, { substrate = 'this page' } = {}) {
    if (q.get('directed') === null) return q;
    fail(`urlParams: ?directed= is no longer a URL parameter (⚖ constructive-mode slice 12). `
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
