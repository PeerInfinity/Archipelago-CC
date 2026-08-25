/**
 * procgenCore/jsonSchemaCheck — the PROMOTED draft-07 evaluator (EDITOR v3
 * slice D0b, §15 gap 3).
 *
 * ⛓⛓ **THE TWO ROSTERS ARE DERIVED FROM THE DIRECTORIES, NOT TYPED.** The whole
 * point of promoting this checker is that the COMMITTED documents are the
 * fixtures it must pass — [[feedback_hardening_rule_refuses_real_data]]: when a
 * hardening rule and the real corpus disagree, the rule is what moves. A typed
 * roster would decay the moment a document arrives beside it (trap 574), and
 * the count is asserted so a roster that silently emptied cannot read green.
 *
 * ⚠ THE ATLAS ROSTER IS KEYED BY (DIRECTORY, `atlas_id`), NOT BY THE KEY ALONE.
 * D0a §18.2 learned this the hard way: `atlas-pools/seedling-atlas-pool.json`
 * carries an `atlas_id` that is a REFERENCE to its source atlas, not its own
 * identity, so a key-name scan would validate a pool as an atlas. Scoping the
 * glob to `flashPanel/atlases/` is what makes the key mean what it says here —
 * and inside that directory the key still discriminates, because the map
 * extract and the sphere-order document are not atlases and do not carry one.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    KNOWN_KEYWORDS, atlasSchemaErrors, ruleSchemaErrors, rulesJsonSchemaErrors, schemaErrors,
} from './jsonSchemaCheck.js';
import { loadAtlasSchema, loadRulesSchema, loadSchema } from './jsonSchemaFiles.js';

const REPO = new URL('../../../', import.meta.url);
const at = (rel) => new URL(rel, REPO);
const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

const ATLAS_SCHEMA = loadAtlasSchema();
const RULES_SCHEMA = loadRulesSchema();

// ── the derived rosters ───────────────────────────────────────────────────

const ATLAS_DIR = at('frontend/modules/flashPanel/atlases/');
/** Every committed atlas: a `.json` in the atlas directory carrying `atlas_id`. */
const ATLASES = readdirSync(ATLAS_DIR)
    .filter((n) => n.endsWith('.json'))
    .map((name) => ({ name, doc: readJson(new URL(name, ATLAS_DIR)) }))
    .filter(({ doc }) => doc != null && typeof doc === 'object' && doc.atlas_id !== undefined);

const PRESET_DIR = at('frontend/presets/');
// Every committed preset rules.json: presets/<game>/AP_<seed>/AP_<seed>_rules.json.
// ⚠ spelled without a `*` glob on purpose — `AP_*/` inside a /** */ block CLOSES it.
const PRESET_RULES = readdirSync(PRESET_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((game) => {
        const gameDir = new URL(`${game.name}/`, PRESET_DIR);
        return readdirSync(gameDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && d.name.startsWith('AP_'))
            .flatMap((seed) => {
                const seedDir = new URL(`${seed.name}/`, gameDir);
                return readdirSync(seedDir)
                    .filter((n) => /^AP_.*_rules\.json$/.test(n))
                    .map((n) => ({ name: `${game.name}/${seed.name}/${n}`, url: new URL(n, seedDir) }));
            });
    });

describe('the rosters are real', () => {
    /**
     * ⛔ NON-VACUITY, both directions. A glob that found nothing would pass
     * for ever, and the NAMES are asserted as well as the count so a roster
     * that quietly picked up the map extract (which is NOT an atlas) reds.
     */
    it('the atlas roster is the three committed atlases, by name', () => {
        expect(ATLASES.map((a) => a.name).sort())
            .toEqual(['seedling-fixture.json', 'seedling-playthrough.json', 'seedling.json']);
        // The two documents in that directory the key correctly excludes.
        const all = readdirSync(ATLAS_DIR).filter((n) => n.endsWith('.json')).sort();
        expect(all).toContain('seedling-map.json');
        expect(all).toContain('seedling-sphere-order.json');
    });

    it('the preset roster is non-empty and every entry is a rules.json', () => {
        expect(PRESET_RULES.length).toBeGreaterThan(200);
        for (const { name } of PRESET_RULES) expect(name).toMatch(/_rules\.json$/);
    });
});

// ── the corpus rows: the schemas must pass the real documents ─────────────

describe('every committed atlas is schema-valid', () => {
    it.each(ATLASES.map((a) => a.name))('%s', (name) => {
        const { doc } = ATLASES.find((a) => a.name === name);
        expect(atlasSchemaErrors(doc, ATLAS_SCHEMA)).toEqual([]);
    });

    /**
     * ⛓⛓ **THE `one_way` DECLARATION, AND WHAT MEASUREMENT OVERTURNED.**
     *
     * The brief said the corpus row above is "what forces `one_way` into the
     * schema". MEASURED: it is not, on its own. `vanilla_layout.connections`'
     * item schema set no `additionalProperties`, and draft-07 ALLOWS unknown
     * properties by default — so the 312 `one_way` fields sailed through an
     * undeclared schema with zero errors, and deleting the declaration again
     * would change nothing. A row that cannot tell the two schemas apart is not
     * a gate ([[feedback_fixture_must_discriminate_two_builds]]).
     *
     * ⇒ D0b CLOSED the connection item (`additionalProperties: false`) as well
     * as declaring the field, which is licensed by the kickoff's "nothing else
     * without a fixture proving the committed atlases still pass" — the fixture
     * is the row above, and all three atlases pass. THIS row is the one that
     * makes the declaration load-bearing: drop `one_way` from the schema and the
     * playthrough's 312 connections become 312 "additional property not allowed"
     * errors.
     */
    it('⛓ the `one_way` declaration is LOAD-BEARING — the closed item is what makes it so', () => {
        const playthrough = ATLASES.find((a) => a.name === 'seedling-playthrough.json').doc;
        const carried = playthrough.vanilla_layout.connections.filter((c) => c.one_way === true);
        expect(carried.length).toBe(playthrough.vanilla_layout.connections.length);
        expect(carried.length).toBeGreaterThan(300);

        // The schema with the declaration REMOVED — the mutant, applied as data.
        const without = structuredClone(ATLAS_SCHEMA);
        delete without.properties.vanilla_layout.properties.connections.items.properties.one_way;
        const errs = atlasSchemaErrors(playthrough, without);
        expect(errs.length).toBe(carried.length);
        expect(errs[0]).toMatch(/one_way: additional property not allowed/);

        // And the item really is CLOSED — that is the half the brief did not have.
        expect(ATLAS_SCHEMA.properties.vanilla_layout.properties.connections.items
            .additionalProperties).toBe(false);
    });
});

describe('every committed preset rules.json is schema-valid', () => {
    /**
     * One row for the whole corpus rather than 259 rows: the failure message
     * names the file and its first errors, which is what a per-file row would
     * have given, and the roster is asserted above.
     *
     * ⛓ Python's `jsonschema` validates the same corpus in
     * `test/general/test_schema_validation.py`. The two are INDEPENDENT
     * evaluators of one schema: if they ever disagree on a file, the keyword
     * they disagree about is the finding.
     */
    it(`all ${PRESET_RULES.length} of them`, () => {
        const bad = [];
        for (const { name, url } of PRESET_RULES) {
            const errs = rulesJsonSchemaErrors(readJson(url), RULES_SCHEMA);
            if (errs.length) bad.push(`${name}: ${errs.slice(0, 3).join(' | ')}`);
        }
        expect(bad).toEqual([]);
    });
});

// ── the six keywords slice D0b added ─────────────────────────────────────

describe('the six keywords D0b added, with draft-07 semantics', () => {
    const check = (schema, value) => schemaErrors(value, schema, schema);

    it('minLength counts CODE POINTS, not UTF-16 units', () => {
        expect(check({ minLength: 3 }, 'abc')).toEqual([]);
        expect(check({ minLength: 3 }, 'ab')).toHaveLength(1);
        // Two astral code points are length 4 in UTF-16 and length 2 here.
        expect(check({ minLength: 3 }, '🌱🌱')).toHaveLength(1);
        expect(check({ minLength: 2 }, '🌱🌱')).toEqual([]);
        // A no-op on every non-string instance.
        expect(check({ minLength: 5 }, 42)).toEqual([]);
        expect(check({ minLength: 5 }, ['a'])).toEqual([]);
    });

    it('pattern is an UN-ANCHORED ECMA regex', () => {
        expect(check({ pattern: 'b' }, 'abc')).toEqual([]);          // a SEARCH
        expect(check({ pattern: '^b' }, 'abc')).toHaveLength(1);     // anchors are the author's
        expect(check({ pattern: '^[0-9a-f]{8}$' }, 'ab0b2709')).toEqual([]);
        expect(check({ pattern: '^[0-9a-f]{8}$' }, 'AB0B2709')).toHaveLength(1);
        // The atlas schema's own lookahead spelling of the `__` ban.
        expect(check({ pattern: '^(?!.*__).+$' }, 'level_12')).toEqual([]);
        expect(check({ pattern: '^(?!.*__).+$' }, 'a__b')).toHaveLength(1);
        expect(check({ pattern: 'x' }, 7)).toEqual([]);              // non-string: no-op
    });

    it('minItems / maxItems bound array LENGTH and nothing else', () => {
        expect(check({ minItems: 2, maxItems: 2 }, [1, 2])).toEqual([]);
        expect(check({ minItems: 2, maxItems: 2 }, [1])).toHaveLength(1);
        expect(check({ minItems: 2, maxItems: 2 }, [1, 2, 3])).toHaveLength(1);
        expect(check({ minItems: 9 }, 'abc')).toEqual([]);           // non-array: no-op
        expect(check({ maxItems: 0 }, { a: 1, b: 2 })).toEqual([]);
    });

    it('uniqueItems compares by VALUE', () => {
        expect(check({ uniqueItems: true }, ['a', 'b'])).toEqual([]);
        expect(check({ uniqueItems: true }, ['a', 'a'])).toHaveLength(1);
        expect(check({ uniqueItems: true }, [{ a: 1 }, { a: 1 }])).toHaveLength(1);
        expect(check({ uniqueItems: true }, [{ a: 1 }, { a: 2 }])).toEqual([]);
        // `uniqueItems: false` asserts nothing at all.
        expect(check({ uniqueItems: false }, ['a', 'a'])).toEqual([]);
    });

    it('$id is an ANNOTATION — it does not assert and it does not throw', () => {
        expect(check({ $id: 'region-atlas.schema.json', type: 'object' }, {})).toEqual([]);
        expect(KNOWN_KEYWORDS.has('$id')).toBe(true);
    });
});

// ── the law: an unknown ASSERTION throws by name ──────────────────────────

describe('⛔ an unimplemented keyword THROWS, by name', () => {
    /**
     * The keyword is `not` on purpose: it is a real draft-07 assertion this
     * evaluator does NOT implement, so the row stays honest if the keyword set
     * grows — the day somebody adds `not`, this row goes red and asks for a
     * different unimplemented one, which is the reminder that the law is about
     * the SET and not about this word.
     */
    it('a schema using `not` is refused, naming the keyword and the path', () => {
        expect(KNOWN_KEYWORDS.has('not')).toBe(false);
        const schema = { type: 'object', properties: { a: { not: { type: 'string' } } } };
        expect(() => schemaErrors({ a: 1 }, schema, schema))
            .toThrow(/unimplemented keyword 'not' at \$\.a/);
    });

    it('the throw happens even when the value would have passed everything else', () => {
        const schema = { multipleOf: 2 };
        expect(() => schemaErrors(4, schema, schema)).toThrow(/unimplemented keyword 'multipleOf'/);
    });

    it('a non-local $ref is refused rather than silently skipped', () => {
        const schema = { $ref: 'https://example.com/other.json' };
        expect(() => schemaErrors({}, schema, schema)).toThrow(/non-local \$ref/);
    });
});

// ── the injection law ────────────────────────────────────────────────────

describe('⛔ the schema is INJECTED — every entry point refuses without one', () => {
    it.each([
        ['ruleSchemaErrors', () => ruleSchemaErrors({ rule: 'True_' })],
        ['rulesJsonSchemaErrors', () => rulesJsonSchemaErrors({})],
        ['atlasSchemaErrors', () => atlasSchemaErrors({})],
    ])('%s refuses by name', (_name, call) => {
        expect(call).toThrow(/needs the parsed schema document as its second argument/);
        expect(call).toThrow(/jsonSchemaFiles\.js/);
    });

    /**
     * ⛔⛔ THE REASON THE REFUSAL EXISTS, ASSERTED. This module is in the
     * browser page graph, so a `node:fs` import here would make the whole graph
     * unloadable. The check is on the SOURCE because that is where the mistake
     * would be made — an import, not a call.
     */
    it('jsonSchemaCheck.js imports nothing from node:', () => {
        const src = readFileSync(new URL('./jsonSchemaCheck.js', import.meta.url), 'utf8');
        const specifiers = [...src.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)]
            .map((m) => m[1]);
        expect(specifiers.filter((s) => s.startsWith('node:'))).toEqual([]);
        // ⛔ and it must not reach the loader either — that would be the same
        //   import through the back door.
        expect(specifiers.some((s) => s.includes('jsonSchemaFiles'))).toBe(false);
    });
});

// ── the loaders ──────────────────────────────────────────────────────────

describe('jsonSchemaFiles', () => {
    it('loads the two schemas this toolkit validates against', () => {
        expect(RULES_SCHEMA.$defs.rule).toBeDefined();
        expect(ATLAS_SCHEMA.$id).toBe('region-atlas.schema.json');
    });

    it('takes a NAME under frontend/schema/, and refuses a path', () => {
        expect(() => loadSchema('../../package.json')).toThrow(/file NAME under frontend\/schema/);
        expect(() => loadSchema('')).toThrow(/file NAME under frontend\/schema/);
    });
});

// ── the promoted behaviour, unchanged ────────────────────────────────────

describe('the rule check the promotion inherited', () => {
    it('accepts a Rule Builder tree and rejects the malformed ones', () => {
        expect(ruleSchemaErrors({ rule: 'True_' }, RULES_SCHEMA)).toEqual([]);
        expect(ruleSchemaErrors(
            { rule: 'And', children: [{ rule: 'Has', args: { item_name: 'Wand' } }] },
            RULES_SCHEMA)).toEqual([]);
        expect(ruleSchemaErrors({ args: {} }, RULES_SCHEMA)).not.toEqual([]);
        expect(ruleSchemaErrors({ rule: 42 }, RULES_SCHEMA)).not.toEqual([]);
    });
});
