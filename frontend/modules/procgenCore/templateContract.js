/**
 * procgenCore/templateContract — WHAT A PALETTE TEMPLATE **IS**, for every
 * substrate on the loop.
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.2). These four functions used to live in
 * `seedlingDemo/procgenPalette.js`, which was correct while Seedling was the
 * only substrate and became a coupling the day a second one needed to declare
 * a template. `mazeRoom/procgenMaze.js` is that substrate; it may not import
 * from `seedlingDemo/`, so the choice was a second copy of the constructor or
 * ONE declaration in a neutral home. Two copies of a contract is the failure
 * mode this arc names first.
 *
 * ── ⛔ WHAT MOVED IS ONLY WHAT THE MAZE PALETTE CANNOT BE WRITTEN WITHOUT
 *
 * ⚖ Kickoff §3.2: *"the seam contract is NOT generalised speculatively."* So
 * this file holds the definition-time schema check, the parameter DRAW, the
 * instance LABEL and the ONE reconstruction — the machinery a palette in any
 * substrate needs to exist at all — and nothing else. Everything about what a
 * concrete row MEANS stayed in Seedling:
 *
 *   `assertPalette`  reads `procgenLevel.TERRAIN`, the `door: 'h'|'v'` rule
 *                    `procgenSeedling.legalAt` enforces, and the
 *                    PLACEMENT_GROUP / PLACEMENT_TAG slots — three Seedling
 *                    facts in one function. The maze has its own
 *                    `assertMazePalette`, which asks the maze's questions
 *                    (tiles are `TILE_FLOOR`/`TILE_WALL`, obstacles and items
 *                    are ids the libraries hold).
 *   the geometry helpers (`cell`, `rectCells`, `paint`, `at`, `lineCells`,
 *                    `alongOf`) — `paint` writes `terrain`, and `at`'s
 *                    transpose exists for Seedling's wave-1 door geometry
 *                    (the across-axis clearer offsets). The maze's v1 palette
 *                    needs one line generator and no transpose, so a
 *                    three-line local is the honest answer and a shared
 *                    geometry vocabulary is a decision for the substrate that
 *                    actually argues for it.
 *   `CLEARER_STRATEGY`, `verbOf`, `dischargesVerb`, `restrictPalette`,
 *   `normalizeRoster`, `catalogueRows` — every one of them keys on Seedling's
 *                    solver strategy vocabulary or its roster spellings.
 *
 * ── THE TWO SHAPES UNDER ONE WORD, ASSERTED RATHER THAN ASSUMED ───────
 *
 * A BASE template's `params` is the SCHEMA — an ARRAY of
 * `{key, domain, default, why}`. A CONCRETE ROW's `params` is the VALUES — a
 * plain OBJECT. Both are checked here, because a reader who mixes them should
 * meet a refusal rather than a silently empty loop.
 *
 * ── ⛔⛔ THE DRAW ORDER **IS** PART OF DETERMINISM, SO IT IS DECLARED ──
 *
 * `instantiate` draws each declared parameter from the SAME injected stream,
 * **in `params` array order** (schema order), one `rng.pick(domain)` per
 * parameter — and a parameter supplied through `overrides` consumes NO draw.
 * ⛓ R9 slice 1 adds a THIRD kind of override, `{pick:[…]}` — a SUBSET of the
 * domain, which spends the SAME one draw the omitted parameter spends (see
 * `isParamSubset` below); a one-member subset is the pin and spends none.
 * The loop's order within one attempt is therefore: pick the base template,
 * draw its parameters in schema order, then ask the model for an anchor. ⚠ The
 * number of draws an attempt spends is TEMPLATE-DEPENDENT, which is harmless
 * precisely because the template is drawn first — the stream decides the count
 * before it spends it.
 *
 * ⛔ NO NODE IMPORTS, and no imports at all: like `levelGenerator.js`, this
 * file is on both substrates' browser path.
 */

export class TemplateContractError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TemplateContractError';
    }
}

const fail = (message) => { throw new TemplateContractError(message); };

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ **THE THIRD KIND OF PARAMETER VALUE — A SUBSET OF THE DOMAIN**
 * (SEEDLING BOT R9, slice 1, D1; ⚖ arc-5 §14.12(2) named the mechanism and
 * deliberately did NOT invent it.)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Until now a caller had exactly two things to say about a parameter, and the
 * difference between them is a DRAW:
 *
 *   OMITTED   → `rng.pick(p.domain)` — ONE draw over everything declared
 *   OVERRIDE  → the value, and NO draw at all
 *
 * Arc 5 measured what is missing between them: the guard's `len` 5 and 6 place
 * NOTHING in a 10x10 room, so a bare `guard` spends ~40% of its draws on a
 * value that cannot land, and the chamber's `w`/`h` run to 6 where the default
 * room holds 3 — which is why the chamber had to be PINNED rather than drawn,
 * losing the distribution the element was built to have. One mechanism answers
 * both: **draw from THIS SUBSET**.
 *
 *   SUBSET    → `rng.pick(subset)` — ONE draw, exactly where the bare
 *               parameter spends its own
 *
 * ⛔ THE SHAPE LIVES HERE AND THE SPELLING LIVES IN THE CODEC. `{pick: […]}` is
 * what `instantiate` reads; `elementSpec` is the only thing that knows a subset
 * is written `len=2|3|4`. A caller that builds the object directly gets the
 * same draw law as one that typed the string, because there is ONE place the
 * draw is spent and this is it.
 *
 * ⛓⛓ **A ONE-MEMBER SUBSET IS THE PIN, AND SPENDS NO DRAW.** `{pick:[4]}` and
 * `4` name the same run and must be byte-identical — a `rng.pick` over one
 * member would look harmless and move every draw after it (trap 321's shape).
 * The collapse is asserted here rather than left to each caller's normalizer.
 */
/** Is this override value a SUBSET instruction rather than a value? */
export const isParamSubset = (value) => Boolean(value) && typeof value === 'object'
    && Array.isArray(value.pick);

/** The canonical subset marker — members frozen IN THE ORDER GIVEN, because the
 *  draw is `rng.pick` over that array and order is therefore load-bearing. */
export const paramSubset = (members) => Object.freeze({
    pick: Object.freeze([...members]),
});

/**
 * ⛔ ONE SENTENCE PER REFUSAL, and every one names the parameter, the subset and
 * what WAS declared — the same discipline `elementSpec.outOfDomain` follows one
 * layer up, so a caller meets one vocabulary whichever door it came through.
 */
function drawFromSubset(rng, owner, p, members) {
    if (members.length === 0) {
        fail(`templateContract: ${owner} parameter "${p.key}" was given an EMPTY subset. A `
            + 'subset is the set of values the draw may land on; an empty one names no run '
            + `— omit the parameter to draw from its whole declared domain `
            + `[${p.domain.join(', ')}].`);
    }
    const seen = new Set();
    for (const m of members) {
        if (!p.domain.includes(m)) {
            fail(`templateContract: ${owner} parameter "${p.key}" was given the subset member `
                + `${JSON.stringify(m)}, which is not in its declared domain `
                + `[${p.domain.join(', ')}]. A subset NARROWS a domain; it cannot widen one.`);
        }
        if (seen.has(m)) {
            fail(`templateContract: ${owner} parameter "${p.key}" names ${JSON.stringify(m)} `
                + 'TWICE in its subset. A subset is a SET — a repeated member would weight '
                + 'the draw, and weighting is not a thing this contract offers.');
        }
        seen.add(m);
    }
    // ⛓ THE PIN — one member is a value, not a draw. See the docblock above.
    if (members.length === 1) return members[0];
    if (!rng || typeof rng.pick !== 'function') {
        fail(`templateContract: ${owner} needs a DRAW for "${p.key}" — it was given a `
            + `SUBSET [${members.join(', ')}] and no rng. A subset spends the same ONE `
            + 'draw the omitted parameter does; it is a narrower domain, not a value.');
    }
    return rng.pick(members);
}

/** `wall-segment(ori=v,len=4)` — the label a pane row and a reader identify an
 *  instance by. A zero-parameter template's label IS its name. */
const instanceLabel = (name, values) => {
    const keys = Object.keys(values);
    return keys.length === 0
        ? name
        : `${name}(${keys.map((k) => `${k}=${values[k]}`).join(',')})`;
};

/**
 * ⛓⛓⛓ THE ONE CONSTRUCTOR EVERY TEMPLATE IN EVERY SUBSTRATE GOES THROUGH —
 * ⚖ the GENERATE-mode UI arc's ruling 2, *"a collection of functions that each
 * generate a coherent set of features for the map, instead of a collection of
 * predefined arrangements of tiles"*, with its schema checked where it is
 * declared.
 *
 * ⛔ `build(values)` returns the GEOMETRY HALF of a concrete row and nothing
 * else: `name`, `family`, `params` and `instance` are stamped here, AFTER the
 * spread, so a `build` cannot rename its own template or forge its own
 * parameter record.
 *
 * ⚠ THE SCHEMA IS CHECKED AT DEFINITION TIME rather than at first draw. A
 * domain nobody can enumerate is a domain nobody swept (⚖ ruling 4), and a
 * `default` outside its own domain is a form control that offers an illegal
 * value — both would otherwise surface on the day a user pressed something.
 */
/**
 * ⛓⛓⛓ THE PARAMETER SCHEMA CHECK — **ONE SCHEMA LANGUAGE, TWO SUBJECTS.**
 *
 * A template declares `[{key, domain, default, why}]`; ⛓ CONSTRUCTIVE-MODE
 * slice 7 gave a SKELETON KIND the same shape (`procgenCore/skeletonKinds.js`
 * — `minRoom`, `prune`, `chambers`). ⛔ The alternative was a second validator
 * beside this one, which is the "two spellings of one setting" failure this
 * seam refuses everywhere else — and it would have been the worse kind, since
 * the two would agree until the day somebody tightened one.
 *
 * ⚠ THE MESSAGES NAME THEIR OWNER rather than assuming "template": a reader
 * who typed `?skeleton=rooms;minRoom=9` must not meet a sentence about
 * templates.
 *
 * @param {Array} params  the schema array
 * @param {string} owner  how the refusal names the declaring thing, e.g.
 *   `template "wall-segment"` or `skeleton kind "rooms"`
 * @returns {Set<string>} the declared keys, in declaration order
 */
export function assertParamSchema(params, owner) {
    if (!Array.isArray(params)) {
        fail(`templateContract: ${owner}'s \`params\` must be the SCHEMA ARRAY `
            + '[{key, domain, default, why}]. The VALUES OBJECT is what an INSTANCE '
            + 'carries — two shapes under one word, so the shapes are asserted rather '
            + 'than assumed.');
    }
    const keys = new Set();
    for (const p of params) {
        if (typeof p?.key !== 'string' || !p.key || keys.has(p.key)) {
            fail(`templateContract: ${owner} declares a parameter with a missing or `
                + `duplicated key (${JSON.stringify(p?.key)}). The key is the draw's own `
                + 'position in the order AND what the instance label reads.');
        }
        keys.add(p.key);
        if (!Array.isArray(p.domain) || p.domain.length === 0) {
            fail(`templateContract: ${owner} parameter "${p.key}" has no finite `
                + 'domain. ⚖ Ruling 4 certifies a domain by SWEEPING it, and a domain '
                + 'nobody can enumerate is a domain nobody swept.');
        }
        if (!p.domain.includes(p.default)) {
            fail(`templateContract: ${owner} parameter "${p.key}" defaults to `
                + `${JSON.stringify(p.default)}, which is not in its own domain `
                + `[${p.domain.join(', ')}]. The default is what verb 2's form pre-fills, `
                + 'so a default outside the domain is a control offering an illegal value.');
        }
        if (typeof p.why !== 'string' || !p.why) {
            fail(`templateContract: ${owner} parameter "${p.key}" carries no `
                + '`why`. Every other measured choice in this arc says why it is what it '
                + 'is; a knob that does not is one the next slice re-derives.');
        }
    }
    return keys;
}

export function defineTemplate({ name, family, site = 'any', params = [], why, build }) {
    if (typeof name !== 'string' || !name) {
        fail('templateContract: a template needs a name — it is the roster key, the trace\'s '
            + '`template` field and what the pin union looks up.');
    }
    if (typeof family !== 'string' || !family) {
        fail(`templateContract: template "${name}" has no family. The report counts by family `
            + 'and an unnamed one would be counted as "undefined".');
    }
    if (typeof build !== 'function') {
        fail(`templateContract: template "${name}" has no \`build\`. A parameterized template `
            + 'IS a function from its values to a concrete row (⚖ ruling 2); a table row '
            + 'with no constructor is exactly the shape this seam replaced.');
    }
    /**
     * ⛓⛓⛓ THE SITE CLASS — PROCGEN ELEMENTS arc 3, slice 1 (kickoff §3.1).
     *
     * ⛔ IT IS A BASE-LEVEL FIELD, STATIC PER TEMPLATE, AND NOT A PARAMETER.
     * A `params` entry is DRAWN from its domain, which would make the site a
     * per-instance dice roll and put a draw between the template pick and the
     * anchor — moving every level from every seed for a field that is a
     * statement about what the template IS. `wall-segment` wants a chamber
     * whatever its length; that is a property of the row, so it is declared on
     * the row.
     *
     * ⛔ THE MEMBERSHIP CHECK IS THE SUBSTRATE'S, NOT THIS FILE'S. `procgenCore/
     * sites.js` owns `SITE_CLASSES`, and this file imports NOTHING (its own
     * docblock's standing property — it is on both substrates' browser path
     * beside `levelGenerator.js`). So the TYPE is checked here, where the row is
     * declared, and the VOCABULARY by each palette's own `assertPalette`, which
     * is where every other "what does this row MEAN" question is already asked.
     *
     * ⚠ DEFAULT `'any'`, and that default is what makes this field byte-inert
     * for every row that predates it: `'any'` is the binding's whole-interior
     * list, which is the list `anchorsFor` has always shuffled.
     */
    if (typeof site !== 'string' || !site) {
        fail(`templateContract: template "${name}" declares site ${JSON.stringify(site)}; a `
            + 'site class is a non-empty STRING naming one of `procgenCore/sites.SITE_CLASSES` '
            + '(the palette\'s own `assertPalette` checks WHICH one). ⛔ It is not a parameter '
            + '— a drawn site would put a draw between the template pick and the anchor and '
            + 'make "which kind of place does this template want" a dice roll.');
    }
    const keys = assertParamSchema(params, `template "${name}"`);
    const schema = Object.freeze(params.map((p) => Object.freeze({
        ...p, domain: Object.freeze([...p.domain]),
    })));
    return Object.freeze({
        name,
        family,
        site,
        params: schema,
        why,
        /**
         * ⛔ DRAWS IN SCHEMA ORDER, ONE `pick` PER PARAMETER, AND AN OVERRIDE
         * SPENDS NO DRAW. The file docblock declares that order; this is where
         * it is spent.
         */
        instantiate(rng, overrides = {}) {
            for (const k of Object.keys(overrides ?? {})) {
                if (!keys.has(k)) {
                    fail(`templateContract: template "${name}" has no parameter "${k}" to `
                        + `override (it declares [${[...keys].join(', ') || 'none'}]). A `
                        + 'silently ignored override is a control that writes state '
                        + 'nobody reads.');
                }
            }
            const values = {};
            for (const p of schema) {
                if (Object.prototype.hasOwnProperty.call(overrides ?? {}, p.key)) {
                    const v = overrides[p.key];
                    /**
                     * ⛓⛓⛓ THE THIRD KIND (R9 slice 1, D1) — a SUBSET spends the
                     * ONE draw the omitted parameter spends, in the same place
                     * in the stream. ⛔ It is checked BEFORE the domain test
                     * below because `{pick:[…]}` is not a member of any domain
                     * and would otherwise refuse as an out-of-domain value.
                     */
                    if (isParamSubset(v)) {
                        values[p.key] = drawFromSubset(rng, `template "${name}"`, p, v.pick);
                        continue;
                    }
                    if (!p.domain.includes(v)) {
                        fail(`templateContract: template "${name}" parameter "${p.key}" was `
                            + `overridden with ${JSON.stringify(v)}, which is not in its `
                            + `declared domain [${p.domain.join(', ')}]. Every value in a `
                            + 'domain is one a sweep measured; a value outside it is one '
                            + 'nobody has adjudicated.');
                    }
                    values[p.key] = v;
                    continue;
                }
                if (!rng || typeof rng.pick !== 'function') {
                    fail(`templateContract: template "${name}" needs a DRAW for "${p.key}" `
                        + 'and no rng was given. ⛔ This REFUSES rather than falling back '
                        + 'to the default: a reconstruction that dropped a recorded '
                        + 'parameter would otherwise rebuild the DEFAULT instance — a '
                        + 'different geometry wearing the same name — and the pin union, '
                        + 'whose pins are static per template in v1, could not tell the '
                        + 'two apart.');
                }
                values[p.key] = rng.pick(p.domain);
            }
            return Object.freeze({
                why,
                ...build(values),
                name,
                family,
                // ⛓ STAMPED AFTER THE SPREAD, like `name`/`family`: a `build`
                // cannot choose its own site any more than it can rename its
                // own template.
                site,
                params: Object.freeze({ ...values }),
                instance: instanceLabel(name, values),
            });
        },
    });
}

/**
 * EVERY DECLARED VALUE COMBINATION of one base template, in schema order —
 * what a palette's own structural assertion walks and what a domain sweep
 * enumerates. ⛔ The cartesian product is taken over the DECLARED domains, so
 * a domain that grew grows the load-time check with it rather than leaving new
 * values unchecked.
 */
export function enumerateValues(template) {
    let combos = [{}];
    for (const p of template.params ?? []) {
        const next = [];
        for (const c of combos) for (const v of p.domain) next.push({ ...c, [p.key]: v });
        combos = next;
    }
    return combos;
}

/** Every concrete row a palette can produce — built FROM the roster (trap 199). */
export function enumerateInstantiations(palette) {
    return palette.templates.flatMap(
        (t) => enumerateValues(t).map((v) => t.instantiate(null, v)),
    );
}

/**
 * ⛓⛓⛓ THE **ONE** RECONSTRUCTION — `{template, params}` back to the concrete
 * row the loop placed.
 *
 * ⛔ TWO CALLERS PER SUBSTRATE, ONE CONSTRUCTION (in Seedling:
 * `watchGenerate.keptTemplatesOf` and `procgenSeedling`'s pin union). Before
 * the parameterization migration both did their own
 * `palette.templates.find(t => t.name === k.template)`; under parameterization
 * that lookup returns a BASE, which has no footprint, no pins and no geometry
 * at all. Two private reconstructions of a parameterized instance is the
 * second-cost-model shape, so there is one.
 *
 * ⚠ IT PASSES NO RNG ON PURPOSE. Every parameter the record names is an
 * override and spends no draw; a parameter the record does NOT name has no
 * value to rebuild from, and `instantiate` refuses BY NAME rather than
 * quietly returning the default instance.
 */
export function instantiateKept(palette, kept) {
    const base = palette?.templates?.find((t) => t.name === kept?.template);
    if (!base) {
        fail(`templateContract: the summary keeps "${kept?.template}", which palette `
            + `"${palette?.name}" does not hold. The pin union is taken over these `
            + 'objects, so a dropped one would solve the room under fewer pins than the '
            + 'loop did.');
    }
    return base.instantiate(null, kept.params ?? {});
}
