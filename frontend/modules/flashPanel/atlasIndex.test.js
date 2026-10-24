/**
 * flashPanel/atlases/atlas_files.json — **THE SERVED ATLAS INDEX IS THE
 * DIRECTORY'S** (APWORLD SUBSTRATE CHANGE R5c). A rules.json names its atlas
 * only by `atlas_id`; the hub's atlas intake resolves that id through this
 * index. The index is DERIVED: every region atlas in the directory (a document
 * with a string `atlas_id` and a `regions` array — `documentBundle`'s own
 * predicate) is listed under its CURRENT id, and nothing else is. A restamped
 * atlas reds the first row until the index names the new id.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ATLAS_DIR, ATLAS_INDEX_FILE, atlasIndexPath, atlasPathInIndex } from './mapDocumentPath.js';

const FRONTEND = new URL('../../', import.meta.url);
const DIR = fileURLToPath(new URL(ATLAS_DIR, FRONTEND));
const readJson = (f) => JSON.parse(readFileSync(`${DIR}${f}`, 'utf8'));
const INDEX = readJson(ATLAS_INDEX_FILE);

/** ⛓ The index the directory implies, derived here from the files themselves. */
const DERIVED = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== ATLAS_INDEX_FILE).sort()
    .map((file) => [file, readJson(file)])
    .filter(([, d]) => typeof d.atlas_id === 'string' && Array.isArray(d.regions))
    .map(([file, d]) => ({ file, atlas_id: d.atlas_id, game: d.game }));

describe('atlas_files.json — the served atlas index', () => {
    it('⛔ lists EXACTLY the directory\'s atlases, under their current ids (a stale index names itself here)', () => {
        expect(DERIVED.length).toBeGreaterThan(0);
        expect(INDEX.atlases, `${ATLAS_DIR}${ATLAS_INDEX_FILE} is STALE — rewrite its \`atlases\` as `
            + JSON.stringify(DERIVED)).toEqual(DERIVED);
        expect(INDEX.schema_version).toBe(1);
    });

    it('resolves every listed id to a served path that holds that atlas', () => {
        for (const a of DERIVED) {
            const path = atlasPathInIndex(INDEX, a.atlas_id);
            expect(path).toBe(`${ATLAS_DIR}${a.file}`);
            expect(JSON.parse(readFileSync(fileURLToPath(new URL(path, FRONTEND)), 'utf8')).atlas_id).toBe(a.atlas_id);
        }
    });

    it('an unknown id, or a malformed index, resolves to null', () => {
        expect(atlasPathInIndex(INDEX, 'seedling-00000000')).toBeNull();
        for (const bad of [null, {}, { atlases: 'x' }, { atlases: [{ atlas_id: DERIVED[0].atlas_id, file: '' }] }]) {
            expect(atlasPathInIndex(bad, DERIVED[0].atlas_id)).toBeNull();
        }
    });

    it('the index path is served from `frontend/`, beside the atlases', () => {
        expect(atlasIndexPath()).toBe(`${ATLAS_DIR}${ATLAS_INDEX_FILE}`);
    });
});
