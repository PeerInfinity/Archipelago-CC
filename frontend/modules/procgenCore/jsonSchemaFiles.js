/**
 * procgenCore/jsonSchemaFiles — the NODE-ONLY half of `jsonSchemaCheck.js`:
 * it reads `frontend/schema/*.json` off disk so scripts and vitest can inject
 * what the evaluator refuses to load for itself.
 *
 * ⛔⛔ **THIS FILE EXISTS SO THAT `jsonSchemaCheck.js` CAN HAVE NO `node:fs`.**
 * `procgenCore/` is in the browser page graph, and one `node:fs` import
 * anywhere in a graph makes the WHOLE graph unloadable there — the lesson
 * `seedlingDemo/levelSource.js` and `atlasSource.js` each carry in their own
 * docblocks, and the same split they use: the fs import lives in a sibling
 * nobody on the page imports. A page injects what it fetched; node imports
 * from here. (EDITOR v3 slice D0b.)
 *
 * ⚠ Importing THIS module from a browser module is the mistake it is shaped to
 * prevent. Nothing under `frontend/` may import it outside a `*.test.js`, and
 * `jsonSchemaCheck.js` itself must never import it — that would put `node:fs`
 * back on the graph through the back door.
 */

import { readFileSync } from 'node:fs';

/** Where the repo keeps its JSON Schemas, resolved from this module's own URL. */
const SCHEMA_DIR = new URL('../../schema/', import.meta.url);

/**
 * Parse one schema by FILE NAME under `frontend/schema/`.
 *
 * The name is joined onto the schema directory rather than resolved as a free
 * path, so a caller cannot quietly point this at a document that is not one of
 * the repo's schemas.
 */
export function loadSchema(name) {
    if (typeof name !== 'string' || name.length === 0 || name.includes('/') || name.includes('\\')) {
        throw new Error(`jsonSchemaFiles: loadSchema takes a file NAME under frontend/schema/, got ${JSON.stringify(name)}`);
    }
    return JSON.parse(readFileSync(new URL(name, SCHEMA_DIR), 'utf8'));
}

/** `frontend/schema/rules.schema.json`, parsed. */
export const loadRulesSchema = () => loadSchema('rules.schema.json');

/** `frontend/schema/region-atlas.schema.json`, parsed. */
export const loadAtlasSchema = () => loadSchema('region-atlas.schema.json');
