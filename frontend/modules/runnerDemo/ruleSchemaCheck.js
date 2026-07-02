/**
 * TEST-ONLY: validate emitted Rule Builder rules against
 * frontend/schema/rules.schema.json's `#/$defs/rule` (the phase-6
 * "schema-valid compile" gate). Never imported by production code —
 * it reads the schema off disk (node:fs), which only works under
 * vitest/node.
 *
 * The repo ships no JSON-Schema library, so this is a minimal
 * evaluator covering exactly the keyword subset the `rule` def's
 * closure uses ($ref, oneOf, type, properties, required, items,
 * const, minimum, additionalProperties). Unknown ASSERTION keywords
 * throw — if the schema grows a keyword this evaluator doesn't
 * implement, the test fails loudly instead of silently passing.
 */

import { readFileSync } from 'node:fs';

const KNOWN_KEYWORDS = new Set([
    '$ref', 'oneOf', 'type', 'properties', 'required', 'items',
    'const', 'minimum', 'additionalProperties',
    // annotations (no validation semantics)
    'description', 'title', 'examples', 'default', '$comment',
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
    if (schema.const !== undefined && value !== schema.const) {
        errs.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
    }
    if (schema.type) {
        const t = typeOf(value);
        if (t !== schema.type && !(schema.type === 'number' && t === 'integer')) {
            return [...errs, `${path}: type '${t}' != '${schema.type}'`];
        }
    }
    if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
        errs.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (typeOf(value) === 'object') {
        for (const req of schema.required ?? []) {
            if (!(req in value)) errs.push(`${path}: missing required '${req}'`);
        }
        for (const [key, sub] of Object.entries(value)) {
            const propSchema = schema.properties?.[key];
            if (propSchema) {
                errs.push(...schemaErrors(sub, propSchema, root, `${path}.${key}`));
            } else if (schema.additionalProperties === false) {
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
