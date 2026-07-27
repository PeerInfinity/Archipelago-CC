/**
 * TEST-ONLY: validate against frontend/schema/rules.schema.json —
 * either one Rule Builder rule against `#/$defs/rule` (the phase-6
 * "schema-valid compile" gate) or a WHOLE rules.json document against
 * the root schema (the region-atlas compiler's gate, Phase 3). Never
 * imported by production code — it reads the schema off disk
 * (node:fs), which only works under vitest/node.
 *
 * The repo ships no JSON-Schema library for JS (Python's `jsonschema`
 * covers the committed presets in test/general/test_schema_validation.py),
 * so this is a minimal draft-07 evaluator covering exactly the keyword
 * subset this schema uses. Unknown ASSERTION keywords throw — if the
 * schema grows a keyword this evaluator doesn't implement, the test
 * fails loudly instead of silently passing.
 */

import { readFileSync } from 'node:fs';

const KNOWN_KEYWORDS = new Set([
    '$ref', 'oneOf', 'anyOf', 'allOf', 'type', 'properties',
    'patternProperties', 'required', 'items', 'const', 'enum',
    'minimum', 'additionalProperties',
    // annotations (no validation semantics)
    'description', 'title', 'examples', 'default', '$comment',
    '$schema', '$defs',
]);

export function loadRulesSchema() {
    const url = new URL('../../schema/rules.schema.json', import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8'));
}

function resolveRef(root, ref) {
    if (!ref.startsWith('#/')) throw new Error(`ruleSchemaCheck: non-local $ref '${ref}'`);
    return ref.slice(2).split('/').reduce((node, part) => {
        if (node == null || !(part in node)) {
            throw new Error(`ruleSchemaCheck: unresolvable $ref '${ref}'`);
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

/** Errors from validating `value` against `schema` within document
 *  `root`. Empty array = valid. */
export function schemaErrors(value, schema, root, path = '$') {
    for (const kw of Object.keys(schema)) {
        if (!KNOWN_KEYWORDS.has(kw)) {
            throw new Error(`ruleSchemaCheck: unimplemented keyword '${kw}' at ${path}`);
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

/** Validate one Rule Builder rule object against `#/$defs/rule`. */
export function ruleSchemaErrors(rule, schemaRoot = loadRulesSchema()) {
    return schemaErrors(rule, { $ref: '#/$defs/rule' }, schemaRoot);
}

/** Validate a WHOLE rules.json document against the root schema. */
export function rulesJsonSchemaErrors(rulesJson, schemaRoot = loadRulesSchema()) {
    return schemaErrors(rulesJson, schemaRoot, schemaRoot);
}
