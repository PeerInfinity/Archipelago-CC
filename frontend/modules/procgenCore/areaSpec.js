/**
 * procgenCore/areaSpec — **THE ONE SPELLING OF "WHICH AREA GRAPH", FOR EVERY
 * CHANNEL.**
 *
 * PROCGEN ELEMENTS arc 1, slice 2 (`NewDocs/plans/procgen-elements-arc1-
 * kickoff.md` §3.2, §3.6 and design §4.8). The maze binding takes an `areas:`
 * spec; the CLI takes `--areas=<string>`; the sweep takes `--areas=<string>`;
 * and slice 3's lab page will take `?areas=<string>`. ⛔ ONE CODEC, so no
 * `?areas=` grammar is invented later beside this one — `skeletonKinds`'
 * `parseSkeleton`/`formatSkeleton`/`normalizeSkeleton` trio, deliberately
 * mirrored key for key (slice 7 §14.4: the parser lives beside the TABLE it
 * validates against, because three channels speak the same string, and a
 * parser in `urlParams.js` would make a CLI import the URL grammar).
 *
 * ── THE STRING ────────────────────────────────────────────────────────
 *
 *     <keys>[;key=value]…        `0` · `1` · `2;graphify=0.5;goalShortcut=0`
 *
 * The HEAD is the KEY COUNT because that is the choice a caller actually makes
 * ("how many locks?"), exactly as the skeleton's head is the kind. ⛓ **`0` IS
 * THE DEFAULT AND IT MEANS THE BINDING DOES NOT RUN THE MODULE AT ALL** — ⚖ arc
 * ruling 3: at `keys: 0` no partition is computed, `buildAreaGraph` is not
 * called, no draw is spent and the maze's per-kind md5s are byte-identical by a
 * code path that never executes. That is the `chambers=0` law (constructive
 * §14.2) applied one layer up, and `procgenMazeAreas.test.js` drives it with a
 * COUNTING SPY on the module rather than by comparing tiles.
 *
 * ── ⛓ WHY `partition` HAS ONE VALUE AND NOT TWO ───────────────────────
 *
 * The brief named `partition: 'chambers' | 'grid'` and made the second one the
 * FALLBACK the census would trigger *"if chambers give < 2 areas on the default
 * room for every knob"*. ⛓ **THE CENSUS MEASURED, AND THE TRIGGER DID NOT
 * FIRE** (arc kickoff §9.1): `rooms` yields 3–8 areas on the default 11x11 room
 * at every seed and every `minRoom`, and the six `chambers`-bearing kinds yield
 * 2–5. So `grid` is a value nobody has swept, and ⚖ constructive ruling 4's own
 * law — *a domain nobody swept is a domain nobody adjudicated* — says it is not
 * declared. It refuses BY NAME with the census line, and the field survives so
 * arc 3 can add it with its own measurement rather than inventing a second
 * grammar for it.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: the lab page loads this in a browser.
 */

import { assertParamSchema, enumerateValues } from './templateContract.js';

export class AreaSpecError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AreaSpecError';
    }
}

const fail = (message) => { throw new AreaSpecError(message); };

/**
 * ⛓ THE HEAD'S DOMAIN. `maxKeys` is a **TARGET, not a ceiling** (slice 1's
 * deviation 10 / §8.8 residue 2): a space that grows fewer key levels REFUSES
 * rather than settling for fewer keys. So the domain is bounded by what the
 * AREA CENSUS measured the partition to admit — 3 on the `rooms` kinds at
 * 11x11 would already need 4+ areas, and 4 is above every 11x11 count the
 * census recorded except `rooms;minRoom=3`'s tail.
 */
export const KEYS_DOMAIN = Object.freeze([0, 1, 2, 3]);

/**
 * ⛔ THE SCHEMA, checked at module load by the SAME `assertParamSchema` the
 * skeleton kinds and every template use. One schema language (constructive
 * §14.2), so a reader who mistypes `goalshortcut` meets one kind of sentence.
 */
export const AREA_PARAM_SCHEMA = Object.freeze([
    Object.freeze({
        key: 'partition',
        domain: Object.freeze(['chambers']),
        default: 'chambers',
        why: 'how the carved room becomes AREAS. `chambers` = a maximal 4-connected blob of '
            + 'cells that belong to an all-floor 2x2 square; every other floor cell is a '
            + 'corridor, i.e. an EDGE. The `grid` fallback the design named is NOT declared — '
            + 'see this file\'s docblock and the area census.',
    }),
    Object.freeze({
        key: 'graphify',
        domain: Object.freeze([0, 0.2, 0.5, 1]),
        default: 0.2,
        why: 'MetaZelda\'s `edgeGraphifyProbability`, whose own constant is 0.2. It is one '
            + '`next()` draw per candidate edge THE ONE-SYMBOL LAW ADMITS — and a pair is '
            + 'offered from both sides, so the effective probability is 1-(1-p)^2 = 0.36 at '
            + 'the default (slice 1 §8.2). 0 turns the extra edges off; 1 takes every legal '
            + 'one.',
    }),
    Object.freeze({
        key: 'goalShortcut',
        domain: Object.freeze([0, 1]),
        default: 1,
        why: '⚖ design ruling 16\'s post-solve entrance<->exit shortcut. 1 (default) lets '
            + '`graphify` link into the GOAL\'s area under the one-symbol rule; 0 reproduces '
            + 'MetaZelda\'s own behaviour, which skips goal rooms. Spelled 0/1 rather than '
            + 'true/false because it rides a URL and a shell argument, where every other '
            + 'value in this grammar is already a domain member matched by string.',
    }),
]);

assertParamSchema(AREA_PARAM_SCHEMA, 'the area spec');

/** ⛓ The default: the module does not run. `{keys: 0}` and nothing else. */
export const DEFAULT_AREAS = Object.freeze({ keys: 0 });

/** Every declared combination — what a sweep enumerates. */
export function enumerateAreaValues() {
    return enumerateValues({ params: AREA_PARAM_SCHEMA });
}

/**
 * ⛔ ONE SENTENCE FOR "THAT VALUE IS NOT IN THE DOMAIN", used by BOTH the object
 * path (`resolveAreaSpec`) and the string path (`parseAreaSpec`). ⛓ Written as
 * one function because a test asked the string path for the `partition=grid`
 * census line and got a shorter sentence: the two paths had drifted the moment
 * there were two of them, which is this repo's recorded failure mode in
 * miniature.
 */
const outOfDomain = (p, value) => `areaSpec: parameter "${p.key}" was given `
    + `${JSON.stringify(value)}, which is not in its declared domain `
    + `[${p.domain.join(', ')}].`
    + (p.key === 'partition'
        ? ' ⛓ `grid` is the fallback the design NAMED and the AREA CENSUS did not trigger: '
            + '`rooms` yields 3-8 areas on the default 11x11 room at every seed, so the chamber '
            + 'partition runs and a `grid` nobody swept is a value nobody adjudicated.'
        : '');

/**
 * ⛓⛓ THE ONE VALIDATOR — unknown keys and out-of-domain values refuse BY NAME,
 * with what WAS declared.
 *
 * @returns {object} the FULL value set (`keys` plus every declared parameter,
 *   defaults filled) — what the binding runs under.
 */
export function resolveAreaSpec(spec = {}) {
    const keys = spec?.keys ?? DEFAULT_AREAS.keys;
    if (!KEYS_DOMAIN.includes(keys)) {
        fail(`areaSpec: \`keys\` was given ${JSON.stringify(keys)}, which is not in its `
            + `declared domain [${KEYS_DOMAIN.join(', ')}]. ⛓ It is a TARGET and not a `
            + 'ceiling: a partition that grows fewer key levels REFUSES rather than settling '
            + 'for fewer keys, so a value above what the AREA CENSUS says the room admits is '
            + 'a run that refuses at every seed. 0 means the area graph does not run at all.');
    }
    const values = spec?.params ?? {};
    for (const key of Object.keys(values)) {
        const p = AREA_PARAM_SCHEMA.find((q) => q.key === key);
        if (!p) {
            fail(`areaSpec: the area spec has no parameter ${JSON.stringify(key)}. It declares `
                + `[${AREA_PARAM_SCHEMA.map((q) => q.key).join(', ')}]. ⛔ A silently ignored `
                + 'parameter is a link that names a graph it did not build.');
        }
        if (!p.domain.includes(values[key])) fail(outOfDomain(p, values[key]));
    }
    const out = { keys };
    for (const p of AREA_PARAM_SCHEMA) {
        out[p.key] = Object.prototype.hasOwnProperty.call(values, p.key)
            ? values[p.key] : p.default;
    }
    return out;
}

/**
 * ⛓ THE CANONICAL `{keys[, params]}` — `params` OMITTED when every value is at
 * its default, the same both-sides-default rule `normalizeSkeleton` follows, so
 * a payload written before this slice normalizes to the object a caller at all
 * defaults produces and AGREES rather than diverging on a field it could not
 * have had.
 */
export function normalizeAreaSpec(spec) {
    const full = resolveAreaSpec(spec);
    const params = {};
    for (const p of AREA_PARAM_SCHEMA) {
        if (full[p.key] !== p.default) params[p.key] = full[p.key];
    }
    return Object.keys(params).length === 0
        ? Object.freeze({ keys: full.keys })
        : Object.freeze({ keys: full.keys, params: Object.freeze(params) });
}

/**
 * `2;graphify=0.5` — the ONE spelling, used by both CLIs, the sweep's row
 * labels, the identity line and (slice 3) the URL writer. A spec at all
 * defaults formats as its bare key count.
 */
export function formatAreaSpec(spec) {
    const norm = normalizeAreaSpec(spec);
    const parts = Object.entries(norm.params ?? {}).map(([k, v]) => `${k}=${v}`);
    return parts.length === 0 ? String(norm.keys) : `${norm.keys};${parts.join(';')}`;
}

/**
 * ⛓⛓⛓ THE ONE PARSER — `<keys>[;key=value]…` → `{keys[, params]}`.
 *
 * ⛔ FIVE DISTINGUISHED REFUSALS, the same five `parseSkeleton` makes, because a
 * reader can act on each: a head that is not an integer in the domain, a clause
 * with no `=`, an empty clause, a duplicated key, a key that is not declared,
 * and a value outside a declared domain (with the domain).
 *
 * ⚠ VALUES ARE MATCHED AGAINST THE DOMAIN BY STRING, so the object carries the
 * domain's own typed member (the number `0.5`, never `"0.5"`) — which is what
 * makes a payload comparison and the round-trip fixed point comparable at all.
 */
export function parseAreaSpec(value) {
    const raw = String(value ?? '').trim();
    const [head, ...clauses] = raw.split(';');
    const headText = head.trim();
    const keys = KEYS_DOMAIN.find((v) => String(v) === headText);
    if (keys === undefined) {
        fail(`areaSpec: ${JSON.stringify(raw)} starts with ${JSON.stringify(headText)}, and `
            + `the head of an area spec is the KEY COUNT — one of [${KEYS_DOMAIN.join(', ')}]. `
            + '⛓ `0` is the default and means the area graph does not run.');
    }
    const params = {};
    for (const clause of clauses) {
        const text = clause.trim();
        if (text === '') {
            fail(`areaSpec: ${JSON.stringify(raw)} carries an EMPTY parameter clause. Each `
                + 'clause is `key=value`, separated by `;` — an empty one is a typo the reader '
                + 'can fix, not a value.');
        }
        const eq = text.indexOf('=');
        if (eq <= 0) {
            fail(`areaSpec: the clause ${JSON.stringify(text)} in ${JSON.stringify(raw)} is `
                + `not \`key=value\`. The area spec declares `
                + `[${AREA_PARAM_SCHEMA.map((q) => q.key).join(', ')}].`);
        }
        const key = text.slice(0, eq).trim();
        const rawValue = text.slice(eq + 1).trim();
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            fail(`areaSpec: ${JSON.stringify(raw)} names "${key}" TWICE. One knob, one value — `
                + 'a link that sets a parameter twice does not say which graph it means.');
        }
        const p = AREA_PARAM_SCHEMA.find((q) => q.key === key);
        if (!p) {
            fail(`areaSpec: the area spec has no parameter ${JSON.stringify(key)}. It declares `
                + `[${AREA_PARAM_SCHEMA.map((q) => q.key).join(', ')}].`);
        }
        const typed = p.domain.find((v) => String(v) === rawValue);
        if (typed === undefined) fail(outOfDomain(p, rawValue));
        params[key] = typed;
    }
    return normalizeAreaSpec({ keys, params });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE REQUIRE DIRECTIVE — `K0,K1` (PROCGEN ELEMENTS arc 1, slice 3)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ Arc kickoff §3.5 / design §4.5: *"`require: [K…]` = the run must place a
 * K-locked edge on the solution path"*. It is a RUN-LEVEL directive about the
 * AREA GRAPH (pass 1), not a per-attempt one about pass 2 — which is why it is
 * **its own** `?require=`/`--require=` and does not ride `?directed=` (whose
 * grammar names a TEMPLATE, its params and an anchor).
 *
 * ⛔ THE PARSER LIVES HERE, BESIDE THE VOCABULARY IT VALIDATES AGAINST, for the
 * same reason `parseAreaSpec` does: the string arrives on THREE channels (the
 * URL parameter, the maze CLI's `--require=`, the sweep's `--require=`), and a
 * parser in `urlParams.js` would make a CLI import the URL grammar. What
 * `urlParams` keeps is the ONE READER and the ONE WRITER of the PARAMETER.
 *
 * ⛓ THE SYMBOLS ARE THE AREA GRAPH'S OWN (`K0`, `K1`, … in creation order —
 * `buildAreaGraph`'s `symbols`), so a key count of N declares exactly
 * `K0..K{N-1}`. ⛔ `?require=K1` with `?areas=1` REFUSES BY NAME rather than
 * widening `maxKeys` to meet the directive (⚖ *no bound is widened to hide a
 * refusal*) — but that refusal belongs to the RUN, where both parameters are
 * known, not to this parser, which adjudicates one string.
 */

/** ⛓ The symbols a key count DECLARES. One place, so the refusal and the
 *  check cannot disagree about what `keys: 2` offers. */
export function symbolsForKeys(keys) {
    return Object.freeze(Array.from({ length: keys }, (_, i) => `K${i}`));
}

const SYMBOL_RE = /^K(\d+)$/;

/** `K3` → 3; anything else → `null`. The one place the spelling is decoded. */
export function symbolIndex(symbol) {
    const m = SYMBOL_RE.exec(String(symbol ?? ''));
    return m === null ? null : Number(m[1]);
}

/**
 * ⛓⛓ `K0,K1` → `['K0','K1']`. ⛔ FOUR DISTINGUISHED REFUSALS, each actionable:
 * an EMPTY value (the whole-directive absence is spelled by leaving the
 * parameter out, exactly as `?families=` refuses an empty list), an empty
 * clause, a duplicate, and a name that is not a symbol.
 *
 * ⚠ ORDER IS PRESERVED and is the CALLER's: the directive is a list of things
 * that must hold, not a set to be normalized — and a writer that sorted would
 * rewrite a bar the reader had just read (the `?families=` sort is the other
 * choice, made there because a ROSTER really is a set).
 */
export function parseRequireList(value) {
    const raw = String(value ?? '').trim();
    if (raw === '') {
        fail('areaSpec: an EMPTY `require` list. A run with no directive is spelled by '
            + 'leaving the parameter out — an empty one is a directive somebody emptied, '
            + 'which is a different thing and cannot be met or refused.');
    }
    const out = [];
    for (const part of raw.split(',')) {
        const text = part.trim();
        if (text === '') {
            fail(`areaSpec: the require list ${JSON.stringify(raw)} carries an EMPTY entry. `
                + 'Entries are area-graph symbols separated by `,` — `K0,K1`.');
        }
        if (symbolIndex(text) === null) {
            fail(`areaSpec: ${JSON.stringify(text)} is not an area-graph symbol. The symbols `
                + 'are `K0`, `K1`, … in the graph\'s own creation order, and a key count of N '
                + `declares exactly [${symbolsForKeys(3).join(', ')}, …] up to K{N-1}.`);
        }
        if (out.includes(text)) {
            fail(`areaSpec: the require list ${JSON.stringify(raw)} names "${text}" TWICE. `
                + 'A symbol is required or it is not; asking twice does not ask harder.');
        }
        out.push(text);
    }
    return Object.freeze(out);
}

/** `['K0','K1']` → `K0,K1`; `null`/`[]` → `''` (the parameter is DELETED). */
export function formatRequireList(list) {
    return (list ?? []).join(',');
}
