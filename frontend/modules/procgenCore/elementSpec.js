/**
 * procgenCore/elementSpec — **THE ONE SPELLING OF "WHICH ELEMENT", FOR EVERY
 * CHANNEL.**
 *
 * PROCGEN ELEMENTS arc 2, slice 3 (`NewDocs/plans/procgen-elements-arc2-
 * kickoff.md` §3.3). The maze binding takes an `elements:` spec; the maze CLI
 * takes `--elements=<string>`; the sweep takes `--elements=<string>`; and slice
 * 4's lab page will take `?elements=<string>`. ⛔ ONE CODEC, mirroring
 * `areaSpec.js` — which itself mirrors `skeletonKinds`' `parse`/`format`/
 * `normalize` trio — so no fourth grammar is invented at the page.
 *
 * ── THE STRING ────────────────────────────────────────────────────────
 *
 *     <name>[;key=value]…      `none` · `guard` · `guard;len=4;turns=2;binds=any`
 *
 * The HEAD is the ELEMENT the run asks for, because that is the choice a caller
 * actually makes. ⛓ **`none` IS THE DEFAULT AND IT MEANS THE BINDING DOES NOT
 * RUN THE ELEMENT MACHINERY AT ALL** — ⚖ arc-2 ruling 5: no site is drawn, no
 * element is instantiated, `construct` is never called, no draw is spent, and
 * every maze md5 is byte-identical by a code path that never executes. The
 * `keys: 0` law (arc 1) and the `chambers=0` law (constructive §14.2) applied
 * one layer further out.
 *
 * ── ⛔ ONE SCHEMA, NOT A SECOND COPY OF THE ELEMENT'S DOMAINS ─────────
 *
 * `len` and `turns` are NOT restated here. The table below names the ELEMENT
 * and the schema is `element.params` — the very array `defineElement` drew from
 * and `assertElement` swept. A codec that re-listed `[2,3,4,5,6]` would be a
 * second spelling of a domain, and the day the element grew a value the spec
 * would refuse it. What this file adds is `binds`, which is a fact about the
 * BINDING (what the area graph may do with the gadget), not about the geometry
 * — so it lives with the caller's vocabulary and not in the element.
 *
 * ⛓ A parameter the spec names is an OVERRIDE and spends NO draw; one it omits
 * is DRAWN from the element's own domain at `instantiate` (⚖ slice 2 §9.3). So
 * `--elements=guard` is "any gadget the stream gives me" and
 * `--elements=guard;len=4;turns=2` is one particular size — both legal, and the
 * payload records the RESOLVED parameters either way.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: the lab page loads this in a browser.
 */

import { BLOCK_POCKET } from './elements/blockPocket.js';
import { KILL_GATE } from './elements/killGate.js';
import { REVERSE_PULL_BLOCK } from './elements/reversePullBlock.js';
import { assertParamSchema, enumerateValues } from './templateContract.js';

export class ElementSpecError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ElementSpecError';
    }
}

const fail = (message) => { throw new ElementSpecError(message); };

/**
 * ⛓⛓⛓ **`binds` — WHAT THE AREA GRAPH MAY DO WITH THE GADGET**, and both
 * values were MEASURED before either was declared (the ELEMENTS CENSUS, §10.1).
 *
 * ⚖ arc-2 ruling 1 says the gadget GUARDS the flag switch. Whether it actually
 * does is not up to the element — it is up to which area `placeKeys` hands a
 * symbol to, and the gadget's area is one candidate among four or five. The
 * census measured both arms on `rooms`/`branchy`/`bushy`/`loopy`/`open`/
 * `winding` at 11x11 and 15x15, seeds 1..12:
 *
 *   `any`  — the gadget's area competes like any other: the graph ACCEPTS 15-40
 *            runs in 96, and the gadget ends up guarding a symbol in only about
 *            one accepted run in seven. The other six place a gadget that
 *            guards NOTHING, which is ⚖ ruling 1 not happening.
 *   `item` — the gadget's area is the ONLY one whose `capacity.item` is true, so
 *            every symbol the graph places is placed behind the door. Acceptance
 *            falls to 9-17 in 96 and EVERY accepted run is guarded.
 *
 * ⛔ `item` is the DEFAULT because a gadget that guards nothing is the vacuous
 * half of ⚖ ruling 1, and the acceptance it costs is published rather than
 * bought back by widening a bound. `capacity` is the module's OWN lever (⚖ arc-1
 * §3.1: *"per-area capacity hints"*), so this is a declared use of it and not a
 * coercion invented here.
 *
 * ⚠ AT `binds=item` A RUN AT `--areas=2` REFUSES AT EVERY SEED, because `K1`
 * needs a SECOND item-bearing area at key level 1 and there is only one. That is
 * said here, is what the census shows, and is a refusal by name rather than a
 * silently-dropped key.
 */
export const BINDS_PARAM = Object.freeze({
    key: 'binds',
    domain: Object.freeze(['item', 'any']),
    default: 'item',
    why: 'whether the gadget\'s area is the ONLY one that may hold a key symbol. `item` '
        + '(default) makes the gadget a GUARD at every accepted seed (⚖ ruling 1) and costs '
        + 'acceptance; `any` lets it compete, which accepts more runs and guards about one '
        + 'in seven. Measured both ways — see the ELEMENTS CENSUS.',
});

/**
 * ⛓ THE TABLE — the element a head names, and the knobs the BINDING adds to the
 * element's own. v1 has ONE entry (⚖ §3.3: "v1 ONE gadget"); a second element is
 * a row here plus its own module, exactly as a skeleton kind is.
 *
 * ⛔ The head is the FAMILY word (`guard`), not the module's name
 * (`reverse-pull-block`): the caller is choosing what the thing DOES, and when a
 * second guard exists the head stays and a parameter picks between them.
 */
export const ELEMENT_TABLE = Object.freeze({
    guard: Object.freeze({
        element: REVERSE_PULL_BLOCK,
        why: 'The reverse-pull block gadget (⚖ design ruling 2 / arc-2 §3.2.1): a block '
            + 'pulled backwards off its button, whose door is held open only while the '
            + 'block sits there — and the area graph\'s key lives behind that door.',
        extra: Object.freeze([BINDS_PARAM]),
    }),
    /**
     * ⛓⛓⛓ THE TWO ROOM-AWARE DOOR ELEMENTS (arc 3, slice 4a). ⛔ NEITHER TAKES
     * A PARAMETER, and that is the finding rather than an omission: the door
     * templates they supersede had to carry `span`/`ori`/`gap` because a
     * pass-2 template writes a RELATIVE footprint and cannot know the room, and
     * slice 2 measured what that cost (`span`'s domain is `{1,8}` — two values
     * for two rooms — and half the kill family's `empty` draws became NO_ANCHOR
     * by construction). An `on-connector` element GROWS its wall to the room it
     * is standing in, so the parameter has nothing left to say. ⚠ `binds` is
     * absent too: neither element holds or grants a symbol, so there is nothing
     * for the area graph to bind (§7c's `bodies = n` is the first knob either
     * will want, and it is NOT this slice).
     */
    killgate: Object.freeze({
        element: KILL_GATE,
        why: 'The room-aware KILL GATE (design catalogue #4): a `tset:-1` lock on a main-path '
            + 'cut with its wall GROWN to seal the room, and the body whose death opens it in '
            + 'a start-side pocket. Certified by the existing `kill`.',
        extra: Object.freeze([]),
        /**
         * ⛓⛓⛓ **THE ONLY ELEMENT IN THE ARC A PRE-SWORD BOOT CANNOT CLEAR**, and
         * it is the same fact `KILL_LOCK_TEMPLATES` encodes by living only in
         * `POST_SWORD_TEMPLATES`: `weaponForPress` returns null with no sword
         * slot, so the press is a silent no-op and the lock never opens.
         *
         * ⛔ A BINDING FACT, LIKE `binds` — not a parameter of the geometry. The
         * gate FITS a pre-sword room perfectly well; what it cannot do there is
         * be SOLVED, and discovering that from a certification solve would spend
         * a full solver budget to learn something the boot flags already say.
         * ⇒ the seam refuses BY NAME and for free.
         *
         * ⚠ This is the shape ⚖ §3.5's `require:['hasSword']` (slice 4b) will
         * generalise: a directive that cannot be met is a REFUSED run with the
         * reason. It is spelled here now because the element would otherwise
         * ship a biome in which it never certifies, and a yield table that
         * measured that would be measuring the boot rather than the gate.
         */
        needs: Object.freeze(['hasSword']),
    }),
    blockpocket: Object.freeze({
        element: BLOCK_POCKET,
        why: 'The room-aware BLOCK POCKET (design catalogue #2): a `pushableblock` on a '
            + 'main-path cut with a REST POCKET carved beyond it in the push direction, so '
            + 'the shove that clears the corridor has somewhere to put the block. Certified '
            + 'by the existing `shove`.',
        extra: Object.freeze([]),
    }),
});

/** ⛓ `none` is a HEAD, not a missing value: it is what "the machinery does not
 *  run" is spelled as on a URL and a shell argument, the way `areaSpec`'s `0`
 *  is. Declared in the domain so a reader can type it. */
export const NONE = 'none';

export const ELEMENT_NAMES = Object.freeze([NONE, ...Object.keys(ELEMENT_TABLE)]);

/** ⛓ The default: the element machinery does not run. `{name: 'none'}`. */
export const DEFAULT_ELEMENTS = Object.freeze({ name: NONE });

/**
 * ⛓⛓⛓ **THE `+` LIST — "ONE OF THESE, DRAWN" — arc 3, slice 4a.**
 *
 *     `guard+killgate+blockpocket`   ·   `none+killgate`
 *
 * ⛔ IT IS A CHOICE, NOT A CONJUNCTION, and the reason is a standing law rather
 * than a preference: arc-2 §3.1-AS-BUILT is **ONE BLOCK PER LEVEL**, and two of
 * the three heads put a `pushableblock` in the room. A `+` that meant *"both"*
 * would spell a level the solver's own bound forbids, and the codec would be
 * offering a run nothing can build.
 *
 * ⛓ WHAT IT IS FOR is D5's default spec: *one element per level, drawn from the
 * certified set*. Without it a DEFAULT can only ever name one element, and the
 * room that element refuses gets nothing — which is the whole reason the door
 * TEMPLATES cannot simply be deleted (a default generator with no doors at all).
 * ⛔ `none` is a legal member, so *"and sometimes nothing"* is sayable too.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────
 *
 * `{any: [spec, spec, …]}` — each member is an ordinary `{name[, params]}`,
 * normalized by the SAME single-head path, so a member cannot mean anything a
 * bare head could not. ⛔ A one-member list is REFUSED: `guard` already spells
 * it, and two spellings of one run is what this file exists to prevent. So is a
 * repeated head — `guard+guard` names no distribution a reader can act on.
 *
 * ⛔ AND THE DRAW IS THE BINDING'S, SPENT ONCE, BEFORE `instantiate`
 * (`drawElementHead`). A list is one `pick` over the members in the order the
 * caller wrote them; a bare head spends none. That difference is the same one
 * `namedParams` exists for, one level up.
 */
export const isElementList = (spec) => Boolean(spec && typeof spec === 'object'
    && Array.isArray(spec.any));

const LIST_SEP = '+';

function assertList(members, raw) {
    if (members.length < 2) {
        fail(`elementSpec: ${JSON.stringify(raw)} is a "${LIST_SEP}" list with `
            + `${members.length} member(s). A list is a CHOICE among two or more heads; one `
            + 'member is the head itself, and two spellings of one run is exactly what this '
            + 'codec exists to prevent.');
    }
    const seen = new Set();
    for (const m of members) {
        if (seen.has(m.name)) {
            fail(`elementSpec: ${JSON.stringify(raw)} names "${m.name}" TWICE. A list is a `
                + 'distribution over DISTINCT heads; a repeated one names no run a reader can '
                + 'act on, and weighting is not a thing this codec offers.');
        }
        seen.add(m.name);
    }
    return members;
}

/** The members of a list spec, normalized — `[]` for a bare head. */
export function elementListMembers(spec) {
    return isElementList(spec) ? spec.any.map((m) => normalizeElementSpec(m)) : [];
}

/**
 * ⛓⛓ **THE HEAD THIS RUN USES** — a bare spec unchanged and spending NOTHING,
 * a list resolved by ONE `pick` over its members.
 *
 * ⛔ The pick is `rng.pick`, the same draw every other choice in this pipeline
 * spends, and it happens BEFORE the element's own parameters are instantiated —
 * so the stream position of every geometry draw after it is a declared function
 * of the list's length.
 */
export function drawElementHead(spec, rng) {
    if (!isElementList(spec)) return normalizeElementSpec(spec ?? DEFAULT_ELEMENTS);
    const members = elementListMembers(spec);
    assertList(members, formatElementSpec(spec));
    return rng.pick(members);
}

/**
 * ⛔ THE SCHEMA OF ONE HEAD — the ELEMENT's own params, then the binding's.
 * There is no third source and nothing is copied.
 */
export function paramSchemaFor(name) {
    const entry = ELEMENT_TABLE[name];
    return entry ? [...entry.element.params, ...(entry.extra ?? [])] : [];
}

for (const name of Object.keys(ELEMENT_TABLE)) {
    assertParamSchema(paramSchemaFor(name), `element spec head ${JSON.stringify(name)}`);
}

/** Every declared combination of one head — what a sweep enumerates. */
export function enumerateElementValues(name) {
    return enumerateValues({ params: paramSchemaFor(name) });
}

/** ⛔ ONE SENTENCE for "that value is not in the domain", used by BOTH the
 *  object path and the string path — `areaSpec`'s §9.6 defect 3, not repeated. */
const outOfDomain = (name, p, value) => `elementSpec: parameter "${p.key}" of element `
    + `"${name}" was given ${JSON.stringify(value)}, which is not in its declared domain `
    + `[${p.domain.join(', ')}].`;

/**
 * ⛓⛓ THE ONE VALIDATOR — an unknown head, an unknown key or an out-of-domain
 * value refuses BY NAME, with what WAS declared.
 *
 * @returns {object} `{name}` at `none`; otherwise `{name}` plus every declared
 *   parameter with its default filled in — what the binding runs under.
 */
export function resolveElementSpec(spec = {}) {
    /**
     * ⛔ A LIST HAS NO RESOLVED PARAMETERS AND SAYS SO. Its members do, and the
     * caller gets them by DRAWING one (`drawElementHead`) — an answer that
     * merged the members' parameters would be a fourth thing the string could
     * mean, and a caller that took it would run a gadget nobody named.
     */
    if (isElementList(spec)) {
        fail(`elementSpec: ${JSON.stringify(formatElementSpec(spec))} is a "${LIST_SEP}" list `
            + '— a CHOICE among heads — so it has no resolved parameters of its own. Draw a '
            + 'head first (`drawElementHead(spec, rng)`) and resolve that.');
    }
    const name = spec?.name ?? DEFAULT_ELEMENTS.name;
    if (!ELEMENT_NAMES.includes(name)) {
        fail(`elementSpec: \`name\` was given ${JSON.stringify(name)}, and the declared `
            + `elements are [${ELEMENT_NAMES.join(', ')}]. ⛓ "${NONE}" is the default and `
            + 'means no site is drawn, no element is constructed and no draw is spent.');
    }
    const values = spec?.params ?? {};
    const schema = paramSchemaFor(name);
    if (name === NONE && Object.keys(values).length > 0) {
        fail(`elementSpec: "${NONE}" carries parameter(s) `
            + `[${Object.keys(values).join(', ')}]. There is no element to give them to — a `
            + 'spec that both says "no element" and sizes one does not name a run.');
    }
    for (const key of Object.keys(values)) {
        const p = schema.find((q) => q.key === key);
        if (!p) {
            fail(`elementSpec: element "${name}" has no parameter ${JSON.stringify(key)}. It `
                + `declares [${schema.map((q) => q.key).join(', ')}]. ⛔ A silently ignored `
                + 'parameter is a link that names a gadget it did not build.');
        }
        if (!p.domain.includes(values[key])) fail(outOfDomain(name, p, values[key]));
    }
    const out = { name };
    for (const p of schema) {
        out[p.key] = Object.prototype.hasOwnProperty.call(values, p.key)
            ? values[p.key] : p.default;
    }
    return out;
}

/**
 * ⛓⛓⛓ **WHICH PARAMETERS THE CALLER ACTUALLY NAMED** — and this is NOT
 * derivable from the resolved values, which is why it is its own function.
 *
 * A parameter the caller named is an OVERRIDE and spends NO draw; one it omitted
 * is DRAWN (⚖ slice 2 §9.3). ⛔ So `guard;len=3` and `guard` are DIFFERENT RUNS
 * even though `len` resolves to 3 in both — the second spends a draw the first
 * does not, and every geometry draw after it lands one step further along the
 * stream. A binding that read the resolved values and passed them all as
 * overrides would silently turn every run into the first kind.
 *
 * ⇒ `normalize`/`format` spell a value at its default by ABSENCE (the
 * `normalizeSkeleton` rule), and THAT ABSENCE IS LOAD-BEARING here rather than
 * cosmetic: it is the difference between a drawn parameter and a given one.
 */
export function namedParams(spec, { elementOnly = false } = {}) {
    const name = spec?.name ?? DEFAULT_ELEMENTS.name;
    resolveElementSpec(spec);          // validate; throws on anything undeclared
    const given = spec?.params ?? {};
    /**
     * ⛔ `elementOnly` DROPS THE BINDING'S OWN KNOBS, and a caller handing these
     * to `instantiate` MUST pass it. `binds` is not a parameter of the element —
     * `defineTemplate`'s `instantiate` refuses an override it does not declare,
     * by name, which is the right answer to a caller who mixed the two
     * vocabularies. The mix is easy to make precisely because ONE string carries
     * both, so the split is a named argument rather than a convention.
     */
    const schema = elementOnly
        ? (ELEMENT_TABLE[name]?.element.params ?? []) : paramSchemaFor(name);
    const out = {};
    for (const p of schema) {
        if (Object.prototype.hasOwnProperty.call(given, p.key)) out[p.key] = given[p.key];
    }
    return out;
}

/**
 * ⛓ THE CANONICAL `{name[, params]}` — `params` OMITTED when the caller named
 * nothing, the same both-sides-default rule `normalizeAreaSpec` follows, so a
 * payload written before this slice normalizes to the object a caller at the
 * default produces and AGREES rather than diverging on a field it could not have
 * had.
 *
 * ⚠ Unlike `normalizeAreaSpec` this keeps a named parameter EVEN AT ITS DEFAULT
 * VALUE, because of `namedParams` above: dropping `len=3` would convert a given
 * parameter into a drawn one and move every draw after it. The rule is "keep
 * what the caller SAID", not "keep what differs from the default".
 */
export function normalizeElementSpec(spec) {
    if (isElementList(spec)) {
        const members = spec.any.map((m) => normalizeElementSpec(m));
        assertList(members, members.map((m) => formatElementSpec(m)).join(LIST_SEP));
        return Object.freeze({ any: Object.freeze(members) });
    }
    const full = resolveElementSpec(spec);
    const named = namedParams(spec);
    return Object.keys(named).length === 0
        ? Object.freeze({ name: full.name })
        : Object.freeze({ name: full.name, params: Object.freeze({ ...named }) });
}

/**
 * `guard;len=4;binds=any` — the ONE spelling, used by both CLIs, the sweep's row
 * labels, the identity line and (slice 4) the URL writer. A spec that named no
 * parameter formats as its bare head.
 *
 * ⛔ PARAMETERS ARE EMITTED IN **SCHEMA ORDER**, not in the caller's typing
 * order, so two callers who typed the same set in different orders produce one
 * string and the payload comparison is about the RUN rather than about the
 * keystrokes.
 */
export function formatElementSpec(spec) {
    if (isElementList(spec)) {
        return spec.any.map((m) => formatElementSpec(m)).join(LIST_SEP);
    }
    const norm = normalizeElementSpec(spec);
    const params = norm.params ?? {};
    const parts = paramSchemaFor(norm.name)
        .filter((p) => Object.prototype.hasOwnProperty.call(params, p.key))
        .map((p) => `${p.key}=${params[p.key]}`);
    return parts.length === 0 ? norm.name : `${norm.name};${parts.join(';')}`;
}

/**
 * ⛓⛓ **THE SPEC, OUT OF EITHER SHAPE THE KEY `elements` CARRIES** — arc 2
 * slice 4.
 *
 * Two writers put something under that key and they are deliberately different
 * things: the LAB PAGE's payload carries the SPEC (a reproduction recipe), and
 * `generate-maze-level.mjs --json` carries `elementSummaryOf`'s block —
 * `{spec, ran, placed, refused}`, a REPORT of what was built. A page that
 * accepted only its own shape would die on the very payload it was handed to
 * explain, and a page that accepted only the CLI's could not read its own
 * download back.
 *
 * ⛔ ONE function knows both, and it knows them by the presence of `spec` — a
 * key no element spec has, because `name` is the head. Everything downstream
 * (the URL writer, the identity line, `agreementWithPayload`, `mazeModel`) then
 * meets exactly one shape.
 */
export function elementSpecOf(block) {
    if (block && typeof block === 'object' && !Array.isArray(block)
        && Object.prototype.hasOwnProperty.call(block, 'spec')) {
        return block.spec;
    }
    return block;
}

/**
 * ⛓⛓⛓ THE ONE PARSER — `<name>[;key=value]…` → `{name[, params]}`.
 *
 * ⛔ SIX DISTINGUISHED REFUSALS, the same six `parseAreaSpec` makes, because a
 * reader can act on each: a head that is not a declared element, an empty
 * clause, a clause with no `=`, a duplicated key, a key the head does not
 * declare, and a value outside a declared domain (with the domain).
 *
 * ⚠ VALUES ARE MATCHED AGAINST THE DOMAIN BY STRING, so the object carries the
 * domain's own typed member (the number `4`, never `"4"`) — which is what makes
 * a payload comparison and the round-trip fixed point comparable at all.
 */
export function parseElementSpec(value) {
    const raw = String(value ?? '').trim();
    /**
     * ⛔ THE LIST IS SPLIT FIRST, because `+` binds LOOSER than `;` — each
     * member carries its own parameter clauses (`guard;len=2+killgate`), and
     * every member then goes through the SAME single-head parser below.
     */
    if (raw.includes(LIST_SEP)) {
        const members = raw.split(LIST_SEP).map((part) => {
            if (part.trim() === '') {
                fail(`elementSpec: ${JSON.stringify(raw)} carries an EMPTY list member. Each `
                    + `member is a head with its own clauses, separated by "${LIST_SEP}".`);
            }
            return parseElementSpec(part);
        });
        assertList(members, raw);
        return Object.freeze({ any: Object.freeze(members) });
    }
    const [head, ...clauses] = raw.split(';');
    const name = head.trim();
    if (!ELEMENT_NAMES.includes(name)) {
        fail(`elementSpec: ${JSON.stringify(raw)} starts with ${JSON.stringify(name)}, and the `
            + `head of an element spec is the ELEMENT — one of [${ELEMENT_NAMES.join(', ')}]. `
            + `⛓ "${NONE}" is the default and means the element machinery does not run.`);
    }
    const schema = paramSchemaFor(name);
    /**
     * ⛔ ASKED HERE, BEFORE THE CLAUSE WALK, so `none;len=3` meets THE SAME
     * SENTENCE from the string path and the object path. Left to the walk it
     * would come back as *"element none has no parameter len"* — technically
     * true, unhelpful, and a second spelling of one mistake, which is
     * `areaSpec`'s own §9.6 defect 3 repeating itself one file later.
     */
    if (name === NONE && clauses.some((c) => c.trim() !== '')) resolveElementSpec({
        name, params: Object.fromEntries(clauses.map((c) => [c.split('=')[0].trim(), null])),
    });
    const params = {};
    for (const clause of clauses) {
        const text = clause.trim();
        if (text === '') {
            fail(`elementSpec: ${JSON.stringify(raw)} carries an EMPTY parameter clause. Each `
                + 'clause is `key=value`, separated by `;` — an empty one is a typo the reader '
                + 'can fix, not a value.');
        }
        const eq = text.indexOf('=');
        if (eq <= 0) {
            fail(`elementSpec: the clause ${JSON.stringify(text)} in ${JSON.stringify(raw)} is `
                + `not \`key=value\`. Element "${name}" declares `
                + `[${schema.map((q) => q.key).join(', ') || '(nothing)'}].`);
        }
        const key = text.slice(0, eq).trim();
        const rawValue = text.slice(eq + 1).trim();
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            fail(`elementSpec: ${JSON.stringify(raw)} names "${key}" TWICE. One knob, one `
                + 'value — a link that sets a parameter twice does not say which gadget it '
                + 'means.');
        }
        const p = schema.find((q) => q.key === key);
        if (!p) {
            fail(`elementSpec: element "${name}" has no parameter ${JSON.stringify(key)}. It `
                + `declares [${schema.map((q) => q.key).join(', ') || '(nothing)'}].`);
        }
        const typed = p.domain.find((v) => String(v) === rawValue);
        if (typed === undefined) fail(outOfDomain(name, p, rawValue));
        params[key] = typed;
    }
    return normalizeElementSpec({ name, params });
}
