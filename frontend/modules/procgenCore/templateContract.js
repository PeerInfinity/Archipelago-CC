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
export function defineTemplate({ name, family, params = [], why, build }) {
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
    if (!Array.isArray(params)) {
        fail(`templateContract: template "${name}"'s \`params\` must be the SCHEMA ARRAY `
            + '[{key, domain, default, why}]. The VALUES OBJECT is what an INSTANCE '
            + 'carries — two shapes under one word, so the shapes are asserted rather '
            + 'than assumed.');
    }
    const keys = new Set();
    for (const p of params) {
        if (typeof p?.key !== 'string' || !p.key || keys.has(p.key)) {
            fail(`templateContract: template "${name}" declares a parameter with a missing or `
                + `duplicated key (${JSON.stringify(p?.key)}). The key is the draw's own `
                + 'position in the order AND what the instance label reads.');
        }
        keys.add(p.key);
        if (!Array.isArray(p.domain) || p.domain.length === 0) {
            fail(`templateContract: template "${name}" parameter "${p.key}" has no finite `
                + 'domain. ⚖ Ruling 4 certifies a domain by SWEEPING it, and a domain '
                + 'nobody can enumerate is a domain nobody swept.');
        }
        if (!p.domain.includes(p.default)) {
            fail(`templateContract: template "${name}" parameter "${p.key}" defaults to `
                + `${JSON.stringify(p.default)}, which is not in its own domain `
                + `[${p.domain.join(', ')}]. The default is what verb 2's form pre-fills, `
                + 'so a default outside the domain is a control offering an illegal value.');
        }
        if (typeof p.why !== 'string' || !p.why) {
            fail(`templateContract: template "${name}" parameter "${p.key}" carries no `
                + '`why`. Every other measured choice in this arc says why it is what it '
                + 'is; a knob that does not is one the next slice re-derives.');
        }
    }
    const schema = Object.freeze(params.map((p) => Object.freeze({
        ...p, domain: Object.freeze([...p.domain]),
    })));
    return Object.freeze({
        name,
        family,
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
