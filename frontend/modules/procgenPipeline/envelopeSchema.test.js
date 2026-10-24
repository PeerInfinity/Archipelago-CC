// The envelope schemas (§5au item 9): published, current, and marking the
// resume state internal. The envelopes the DRIVERS write are validated against
// them by the CLI contract test; this file pins the tables and the generator.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';

// Side-effect: register the substrate the top-down steps dispatch through.
import '../mazeRoom/mazeRoomLibrary.js';
import { FIELD_VISIBILITY, ENVELOPE_VERSION } from './steppedPipeline.js';
import { sphereEnvelopeSchema } from './sphereSteps.js';
import { spiralEnvelopeSchema } from './spiralSteps.js';
import {
    TOPDOWN_STEPS, newTopDownEnvelope, runTopDownStep, serializeTDEnvelope, topDownEnvelopeSchema,
} from './topDownSteps.js';
import { envelopeSchemaFiles } from '../../../scripts/procgen/generate-envelope-schemas.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCHEMAS = { sphere: sphereEnvelopeSchema(), spiral: spiralEnvelopeSchema(), topdown: topDownEnvelopeSchema() };
const visibility = (schema, field) => schema.properties[field]?.['x-visibility'];

describe('envelope schemas', () => {
    it('the committed files are the generator\'s output (node scripts/procgen/generate-envelope-schemas.mjs)', async () => {
        for (const f of await envelopeSchemaFiles()) {
            expect(readFileSync(join(REPO, f.path), 'utf8'), f.path).toBe(f.text);
        }
    });

    it('stamp, required keys and closed shape', () => {
        for (const [mode, s] of Object.entries(SCHEMAS)) {
            expect(s.properties.kind.const).toBe(`${mode}-envelope`);
            expect(s.properties.envelope_version.const).toBe(ENVELOPE_VERSION);
            expect(s.required).toEqual(expect.arrayContaining(['kind', 'envelope_version', 'completed']));
            expect(s.additionalProperties).toBe(false);
        }
    });

    it('the resume state §5au item 9 names is internal; results are public', () => {
        const { sphere, spiral, topdown } = SCHEMAS;
        for (const f of ['rng', 'regionsRng', 'batchStart', 'nodes']) expect(visibility(sphere, f), f).toBe(FIELD_VISIBILITY.INTERNAL);
        expect(visibility(spiral, 'rng')).toBe(FIELD_VISIBILITY.INTERNAL);
        expect(visibility(topdown, 'rng')).toBe(FIELD_VISIBILITY.INTERNAL);
        // the tagged Grid encoding
        expect(sphere.properties.grow.properties.grid['x-visibility']).toBe(FIELD_VISIBILITY.INTERNAL);
        expect(spiral.properties.regions.properties.grid['x-visibility']).toBe(FIELD_VISIBILITY.INTERNAL);
        expect(visibility(topdown, 'layout')).toBe(FIELD_VISIBILITY.INTERNAL);
        for (const s of Object.values(SCHEMAS)) {
            for (const f of ['config', 'compile', 'completed'].filter((x) => s.properties[x])) {
                expect(visibility(s, f), f).toBe(FIELD_VISIBILITY.PUBLIC);
            }
        }
    });
});

/** The synthetic source topDownSteps.test.js uses, trimmed. */
function source() {
    const T = { rule: 'True_' };
    const reg = (name, exits, locs) => ({ name, exits, locations: locs });
    return {
        start_regions: { 1: { default: ['Menu'] } },
        exporter: { 1: { assume_bidirectional_exits: true } },
        game_name: 'EnvelopeSchemaCheck',
        regions: {
            1: {
                Menu: reg('Menu', [{ name: 'GameStart', connected_region: 'Hub', access_rule: T }], []),
                Hub: reg('Hub', [{ name: 'toE', connected_region: 'East', access_rule: T }],
                    [{ name: 'Hub_Chest', item: { name: 'key_red' } }]),
                East: reg('East', [], [{ name: 'East_A', item: { name: 'Victory' } }]),
            },
        },
    };
}

describe('a top-down envelope, at every step', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(SCHEMAS.topdown);
    const why = () => JSON.stringify(validate.errors);

    it('validates fresh, after each step, and with recorded edits', async () => {
        const env = newTopDownEnvelope({
            source: source(),
            opts: { gridDims: { width: 3, height: 3 }, regionSizeBase: { width: 6, height: 6 }, seed: 1, substrateMix: { maze: 1 } },
            compileIn: { seed: 1 },
            regionSize: { width: 6, height: 6 },
        });
        env.edits = [{ op: 're-roll', region_id: 'East', n: 1 }];
        expect(validate(serializeTDEnvelope(env)), why()).toBe(true);
        for (const step of TOPDOWN_STEPS) {
            // eslint-disable-next-line no-await-in-loop
            await runTopDownStep(step, env);
            expect(validate(serializeTDEnvelope(env)), `${step}: ${why()}`).toBe(true);
        }
        const done = serializeTDEnvelope(env);
        expect(done.compile.rulesJson).toBeTruthy();

        // ⛓ negative controls: the schema is not vacuous
        expect(validate({ ...done, stray: 1 })).toBe(false);
        expect(validate({ ...done, kind: 'sphere-envelope' })).toBe(false);
        expect(validate({ ...done, completed: 'x' })).toBe(false);
    });
});
