#!/usr/bin/env node
/**
 * generate-envelope-schemas — writes the JSON Schema of each stepped-pipeline
 * envelope kind to `frontend/schema/envelopes/<kind>.schema.json` (§5au item 9).
 *
 * The schemas are generated, never typed: each mode's `*_ENVELOPE_FIELDS`
 * table (sphereSteps.js / spiralSteps.js / topDownSteps.js) declares every
 * top-level field with its type, the step that writes it and whether it is
 * public or internal, and `envelopeSchema` (steppedPipeline.js) turns that
 * into JSON Schema 2020-12 with `"additionalProperties": false`. Marking is
 * schema-only: an envelope's bytes do not change.
 *
 * ⛔ Regenerate-no-diff cannot see a table that stopped COVERING what the
 * steps write. That is the CLI contract test's job: it validates the
 * envelopes the drivers actually write, at every step, against these files.
 *
 * Run:
 *   node scripts/procgen/generate-envelope-schemas.mjs            # write them
 *   node scripts/procgen/generate-envelope-schemas.mjs --check    # gate them
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** ⛓ Where the schemas are published, relative to the repo. */
export const ENVELOPE_SCHEMA_DIR = 'frontend/schema/envelopes';

/** The modes: the module, and its schema accessor. */
const MODES = [
    ['frontend/modules/procgenPipeline/sphereSteps.js', 'sphereEnvelopeSchema'],
    ['frontend/modules/procgenPipeline/spiralSteps.js', 'spiralEnvelopeSchema'],
    ['frontend/modules/procgenPipeline/topDownSteps.js', 'topDownEnvelopeSchema'],
];

/** `[{kind, path, text}]`, one per mode, in MODES order. */
export async function envelopeSchemaFiles() {
    const out = [];
    for (const [rel, accessor] of MODES) {
        // eslint-disable-next-line no-await-in-loop
        const schema = (await import(join(REPO, rel)))[accessor]();
        const kind = schema.properties.kind.const;
        out.push({ kind, path: `${ENVELOPE_SCHEMA_DIR}/${kind}.schema.json`, text: `${JSON.stringify(schema, null, 2)}\n` });
    }
    return out;
}

async function main(argv) {
    const check = argv.includes('--check');
    const unknown = argv.filter((a) => a !== '--check');
    if (unknown.length) throw new Error(`unknown argument(s): ${unknown.join(' ')}`);
    const files = await envelopeSchemaFiles();
    const stale = [];
    for (const f of files) {
        const abs = join(REPO, f.path);
        const now = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
        if (check) {
            if (now !== f.text) stale.push(f.path);
        } else if (now !== f.text) {
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, f.text);
            console.log(`wrote ${f.path}`);
        }
    }
    if (check && stale.length) {
        console.error(`STALE: ${stale.join(', ')} — run node scripts/procgen/generate-envelope-schemas.mjs`);
        return 1;
    }
    console.log(`${check ? 'OK' : 'done'}: ${files.length} envelope schemas ${check ? 'match the field tables' : 'current'}`);
    return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
        console.error(e.stack ?? e);
        process.exit(1);
    });
}
