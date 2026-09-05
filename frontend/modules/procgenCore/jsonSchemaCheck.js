/**
 * procgenCore/jsonSchemaCheck — a minimal draft-07 evaluator, and the two
 * document checks the toolkit needs (`rulesJsonSchemaErrors`,
 * `atlasSchemaErrors`).
 *
 * ⛓ PROMOTED from `runnerDemo/ruleSchemaCheck.js` (EDITOR v3 slice D0b; §15
 * gap 3, §16.1 #3). It was TEST-ONLY BY ACCIDENT: 132 lines of production-grade
 * evaluator whose only disqualification was a `node:fs` import at the top and a
 * home under a substrate demo. Both are gone — the schema now ARRIVES as a
 * parameter, so the same function serves node scripts, vitest and the page.
 *
 * ── ⛔ NO ajv, AND THAT IS A DECISION WITH PROVENANCE ────────────────────
 *
 * The repo ships no JSON-Schema library for JS (`package.json`: `playwright`,
 * `@playwright/test`, `@vitest/coverage-v8`, `esbuild`, `jsdoc`, `vitest` —
 * zero schema hits), and the two schemas this repo actually validates against
 * use exactly the keyword subset below, MEASURED: `rules.schema.json` (1,046 l
 * since APWORLD HUB H1 set its top level `additionalProperties: false`; 1,045 l
 * after H0 declared nine of the ten previously-undeclared top-level keys,
 * 833 l when this was written) needs nothing this evaluator lacked —
 * `additionalProperties` was already both KNOWN and implemented here
 * (`ASSERTION_KEYWORDS` and `schemaErrors`'s object branch), which is why H1's
 * strict top level cost this file a line count and no code; `region-atlas.schema.json` (218 l)
 * needed six more, which slice D0b added. Python's `jsonschema` covers the
 * committed presets in `test/general/test_schema_validation.py` and is the
 * cross-check for the rules half. Adding ajv would buy a user-visible
 * dependency, a bundling question for the dev-server page path, and a SECOND
 * evaluator for a schema the hand one already covers. (§16.5.)
 *
 * ── ⛔⛔ THE SCHEMA IS INJECTED, NEVER READ HERE ─────────────────────────
 *
 * `procgenCore/` is in the browser page graph (`bindingContract.test.js` reads
 * this directory), and ONE `node:fs` anywhere in a graph makes the whole graph
 * unloadable there — the lesson `seedlingDemo/levelSource.js` and
 * `seedlingEditAdapter.js` both carry in their own docblocks. So every entry
 * point takes the parsed schema document as a parameter and REFUSES BY NAME
 * when it is absent, rather than defaulting to a disk read. Node callers get
 * the loaders from `jsonSchemaFiles.js`, the sibling that owns the `node:fs`
 * import; a page injects what it fetched.
 *
 * ── THE LAW THIS FILE KEEPS ─────────────────────────────────────────────
 *
 * An UNKNOWN ASSERTION KEYWORD THROWS, BY NAME. If a schema grows a keyword
 * this evaluator does not implement, every row that reads that schema fails
 * loudly instead of silently passing over an unchecked constraint. A checker
 * that shrugs at what it does not understand reports "valid" for documents it
 * never looked at.
 */

/**
 * Keywords this evaluator understands. Splitting the set is not decoration:
 * an ANNOTATION carries no validation semantics, so ignoring it is correct;
 * an unimplemented ASSERTION would silently drop a constraint, which is the
 * failure this file exists to make impossible.
 */
const ASSERTION_KEYWORDS = [
    '$ref', 'oneOf', 'anyOf', 'allOf', 'type', 'properties',
    'patternProperties', 'required', 'items', 'const', 'enum',
    'minimum', 'additionalProperties',
    // ⛓ D0b — the six `region-atlas.schema.json` uses and the promoted
    //   checker lacked, each with draft-07 semantics:
    'minLength', 'minItems', 'maxItems', 'uniqueItems', 'pattern',
];
const ANNOTATION_KEYWORDS = [
    'description', 'title', 'examples', 'default', '$comment',
    '$schema', '$defs',
    // ⛓ D0b — `$id` is the document's own identifier. This evaluator resolves
    //   LOCAL `$ref`s only (see `resolveRef`), so there is no remote base URI
    //   to compute and nothing to do with it.
    '$id',
];
export const KNOWN_KEYWORDS = new Set([...ASSERTION_KEYWORDS, ...ANNOTATION_KEYWORDS]);

function resolveRef(root, ref) {
    if (!ref.startsWith('#/')) throw new Error(`jsonSchemaCheck: non-local $ref '${ref}'`);
    return ref.slice(2).split('/').reduce((node, part) => {
        if (node == null || !(part in node)) {
            throw new Error(`jsonSchemaCheck: unresolvable $ref '${ref}'`);
        }
        return node[part];
    }, root);
}

function typeOf(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
}

/**
 * draft-07 `uniqueItems`: items are compared by VALUE, not identity. The
 * canonical spelling is deep equality; JSON round-tripping each item is the
 * cheap stand-in that is exact for the JSON documents this evaluator sees
 * (⚠ key ORDER matters to it, so `{a:1,b:2}` and `{b:2,a:1}` read as distinct
 * — the schemas that use this keyword apply it to arrays of STRINGS
 * (`sub_regions`), where the question cannot arise).
 */
function allUnique(items) {
    const seen = new Set();
    for (const item of items) {
        const key = JSON.stringify(item) ?? 'undefined';
        if (seen.has(key)) return false;
        seen.add(key);
    }
    return true;
}

/**
 * Errors from validating `value` against `schema` within document `root`.
 * Empty array = valid.
 *
 * ⚠ The argument order is (value, schema, root) — PRESERVED from the promoted
 * module so its four importers moved rather than changed.
 */
export function schemaErrors(value, schema, root, path = '$') {
    for (const kw of Object.keys(schema)) {
        if (!KNOWN_KEYWORDS.has(kw)) {
            throw new Error(`jsonSchemaCheck: unimplemented keyword '${kw}' at ${path}`);
        }
    }
    if (schema.$ref) return schemaErrors(value, resolveRef(root, schema.$ref), root, path);
    if (schema.oneOf) {
        const matching = schema.oneOf.filter(
            (branch) => schemaErrors(value, branch, root, path).length === 0);
        return matching.length === 1
            ? []
            : [`${path}: matched ${matching.length} oneOf branches (want exactly 1)`];
    }
    const errs = [];
    if (schema.anyOf) {
        const matching = schema.anyOf.filter(
            (branch) => schemaErrors(value, branch, root, path).length === 0);
        if (matching.length === 0) errs.push(`${path}: matched no anyOf branch`);
    }
    for (const branch of schema.allOf ?? []) {
        errs.push(...schemaErrors(value, branch, root, path));
    }
    if (schema.const !== undefined && value !== schema.const) {
        errs.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
        errs.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
    }
    if (schema.type) {
        const t = typeOf(value);
        // `type` may be a single name or a list of alternatives.
        const wanted = Array.isArray(schema.type) ? schema.type : [schema.type];
        const ok = wanted.some((w) => t === w || (w === 'number' && t === 'integer'));
        if (!ok) return [...errs, `${path}: type '${t}' != ${JSON.stringify(schema.type)}`];
    }
    if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
        errs.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    // ── the five D0b assertions. Each applies to ONE instance type and is a
    //    no-op on every other, exactly as draft-07 says.
    if (schema.minLength !== undefined && typeof value === 'string'
        && [...value].length < schema.minLength) {
        // draft-07 counts UNICODE CODE POINTS, not UTF-16 units — hence the
        // spread rather than `.length`.
        errs.push(`${path}: string of length ${[...value].length} < minLength ${schema.minLength}`);
    }
    if (schema.pattern !== undefined && typeof value === 'string'
        && !new RegExp(schema.pattern).test(value)) {
        // ECMA-262 regex, and deliberately UN-ANCHORED: draft-07 `pattern` is a
        // SEARCH, so `^` / `$` are the schema author's to write.
        errs.push(`${path}: ${JSON.stringify(value)} does not match pattern ${JSON.stringify(schema.pattern)}`);
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errs.push(`${path}: ${value.length} items < minItems ${schema.minItems}`);
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errs.push(`${path}: ${value.length} items > maxItems ${schema.maxItems}`);
        }
        if (schema.uniqueItems === true && !allUnique(value)) {
            errs.push(`${path}: items are not unique`);
        }
    }
    if (typeOf(value) === 'object') {
        for (const req of schema.required ?? []) {
            if (!(req in value)) errs.push(`${path}: missing required '${req}'`);
        }
        for (const [key, sub] of Object.entries(value)) {
            let matched = false;
            const propSchema = schema.properties?.[key];
            if (propSchema) {
                matched = true;
                errs.push(...schemaErrors(sub, propSchema, root, `${path}.${key}`));
            }
            for (const [pattern, patSchema] of Object.entries(schema.patternProperties ?? {})) {
                if (!new RegExp(pattern).test(key)) continue;
                matched = true;
                errs.push(...schemaErrors(sub, patSchema, root, `${path}.${key}`));
            }
            if (matched) continue;
            if (schema.additionalProperties === false) {
                errs.push(`${path}.${key}: additional property not allowed`);
            } else if (typeof schema.additionalProperties === 'object') {
                errs.push(...schemaErrors(
                    sub, schema.additionalProperties, root, `${path}.${key}`));
            }
        }
    }
    if (Array.isArray(value) && schema.items) {
        value.forEach((item, i) => {
            errs.push(...schemaErrors(item, schema.items, root, `${path}[${i}]`));
        });
    }
    return errs;
}

/** The refusal every entry point below shares: no schema, no answer. */
function requireSchema(schemaRoot, what, loader) {
    if (schemaRoot != null && typeof schemaRoot === 'object') return;
    throw new Error(
        `jsonSchemaCheck: ${what} needs the parsed schema document as its second argument, `
        + `and none was given. It is INJECTED, never read here — this module is in the `
        + `browser page graph and a \`node:fs\` import would make that whole graph `
        + `unloadable. In node: \`import { ${loader} } from '.../procgenCore/jsonSchemaFiles.js'\`.`);
}

/** Validate one Rule Builder rule object against `#/$defs/rule`. */
export function ruleSchemaErrors(rule, schemaRoot) {
    requireSchema(schemaRoot, 'ruleSchemaErrors', 'loadRulesSchema');
    return schemaErrors(rule, { $ref: '#/$defs/rule' }, schemaRoot);
}

/** Validate a WHOLE rules.json document against `rules.schema.json`. */
export function rulesJsonSchemaErrors(rulesJson, schemaRoot) {
    requireSchema(schemaRoot, 'rulesJsonSchemaErrors', 'loadRulesSchema');
    return schemaErrors(rulesJson, schemaRoot, schemaRoot);
}

/**
 * Validate a region atlas against `region-atlas.schema.json`.
 *
 * ⚠ STRUCTURAL ONLY. That schema calls itself DOCUMENTATION and it is right to:
 * content-hash identity, sub-region referential integrity and reachability,
 * edge-exit geometry and `vanilla_layout` endpoint resolution are things a
 * schema cannot say, and `procgenPipeline/regionAtlasValidator.js` stays
 * authoritative for them. This is the pass that runs FIRST, so a document whose
 * SHAPE is wrong is reported as a shape error rather than as a cascade of
 * referential ones.
 */
export function atlasSchemaErrors(atlas, schemaRoot) {
    requireSchema(schemaRoot, 'atlasSchemaErrors', 'loadAtlasSchema');
    return schemaErrors(atlas, schemaRoot, schemaRoot);
}
