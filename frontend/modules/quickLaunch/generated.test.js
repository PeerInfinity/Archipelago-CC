/**
 * The pin on generated/docsIndex.js: regenerate in memory and compare with
 * what is committed. A red here means a guide under docs/json/user/ changed
 * without `node scripts/quicklaunch/generate-docs-index.mjs` being run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    EXCLUDED_BASENAMES, MODULES_README, OUTPUT, REPO, SUMMARY_MAX_LENGTH, buildCategoryOrder, buildDocsIndex, docSummary,
    isDirectoryBullet, readmeCategories, renderDocsIndexModule,
} from '../../../scripts/quicklaunch/generate-docs-index.mjs';
import { CATEGORY_ORDER, DOCS_INDEX } from './generated/docsIndex.js';

describe('quickLaunch generated/docsIndex.js', () => {
    it('equals what the generator writes today (byte for byte)', () => {
        expect(readFileSync(join(REPO, OUTPUT), 'utf8'))
            .toBe(renderDocsIndexModule(buildDocsIndex(), buildCategoryOrder()));
    });

    it('the imported table deep-equals a fresh walk', () => {
        expect(DOCS_INDEX).toEqual(buildDocsIndex());
    });

    it('lists no excluded file name (TODO.md is not a guide)', () => {
        expect(DOCS_INDEX.filter((d) => EXCLUDED_BASENAMES.includes(d.path.split('/').pop()))).toEqual([]);
    });

    it('every row has a path under docs/json/user, a title and a section', () => {
        const bad = DOCS_INDEX.filter((d) => !d.path.startsWith('docs/json/user/') || !d.title || !d.section);
        expect(bad).toEqual([]);
    });

    it('every row has a summary no longer than SUMMARY_MAX_LENGTH (warning when one is empty)', () => {
        const tooLong = DOCS_INDEX.filter((d) => typeof d.summary !== 'string' || d.summary.length > SUMMARY_MAX_LENGTH);
        expect(tooLong.map((d) => d.path)).toEqual([]);
        const empty = DOCS_INDEX.filter((d) => !d.summary).map((d) => d.path);
        if (empty.length) console.warn(`WARNING: guides with no first paragraph (no summary): ${empty.join(', ')}`);
    });
});

describe('docSummary', () => {
    it('is the first non-heading paragraph as plain text, whitespace collapsed', () => {
        const text = '# Title\n\n## Sub\n\nThe **Foo** panel shows\n[links](x.md) and `code`.\n\nSecond.';
        expect(docSummary(text)).toBe('The Foo panel shows links and code.');
    });

    it('is empty when there is no paragraph', () => {
        expect(docSummary('# Only a title\n')).toBe('');
    });

    it('cuts a long paragraph at a word, ending in an ellipsis, within the cap', () => {
        const long = `# T\n\n${'word '.repeat(100)}`;
        const s = docSummary(long);
        expect(s.length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
        expect(s.endsWith('word…')).toBe(true);
    });
});

describe('quickLaunch generated CATEGORY_ORDER', () => {
    const readme = readFileSync(join(REPO, MODULES_README), 'utf8');
    const headings = readme.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());

    it('deep-equals the README read today', () => {
        expect(CATEGORY_ORDER).toEqual(buildCategoryOrder());
    });

    it('is the README\'s `## ` headings in order, minus only the directory-listing ones', () => {
        const excluded = headings.filter((h) => !CATEGORY_ORDER.includes(h));
        expect(headings.filter((h) => CATEGORY_ORDER.includes(h))).toEqual([...CATEGORY_ORDER]);
        // Every excluded heading lists only directories (the rule), and at least one module heading remains.
        for (const heading of excluded) {
            const body = readme.split(`## ${heading}\n`)[1].split('\n## ')[0];
            const bullets = body.split('\n').filter((l) => l.startsWith('- '));
            expect(bullets.length > 0 && bullets.every(isDirectoryBullet)).toBe(true);
        }
        expect(CATEGORY_ORDER.length).toBeGreaterThan(0);
    });

    it('the rule: a directory-only section is dropped, a mixed or module section is kept', () => {
        const text = [
            '# T', '## Mods', '- [A](./a.md)', '- **B** (`b`) — x',
            '## Dirs', '- **`shared/`** — s', '- `other/` — o',
            '## Mixed', '- **`x/`** — d', '- [Y](./y.md)', '## Empty', 'prose only',
        ].join('\n');
        expect(readmeCategories(text)).toEqual(['Mods', 'Mixed']);
    });
});
