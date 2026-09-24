/**
 * The pin on generated/docsIndex.js: regenerate in memory and compare with
 * what is committed. A red here means a guide under docs/json/user/ changed
 * without `node scripts/quicklaunch/generate-docs-index.mjs` being run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    OUTPUT, REPO, buildDocsIndex, renderDocsIndexModule,
} from '../../../scripts/quicklaunch/generate-docs-index.mjs';
import { DOCS_INDEX } from './generated/docsIndex.js';

describe('quickLaunch generated/docsIndex.js', () => {
    it('equals what the generator writes today (byte for byte)', () => {
        expect(readFileSync(join(REPO, OUTPUT), 'utf8')).toBe(renderDocsIndexModule(buildDocsIndex()));
    });

    it('the imported table deep-equals a fresh walk', () => {
        expect(DOCS_INDEX).toEqual(buildDocsIndex());
    });

    it('every row has a path under docs/json/user, a title and a section', () => {
        const bad = DOCS_INDEX.filter((d) => !d.path.startsWith('docs/json/user/') || !d.title || !d.section);
        expect(bad).toEqual([]);
    });
});
