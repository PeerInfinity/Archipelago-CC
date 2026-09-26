/**
 * The pin on generated/docsIndex.js: regenerate in memory and compare with
 * what is committed. A red here means a doc in a marked docs/json directory
 * (or a marker) changed without `node scripts/quicklaunch/generate-docs-index.mjs`
 * being run.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    EXCLUDED_BASENAMES, HELP_AUDIENCES, MODULES_README, OUTPUT, REPO, SUMMARY_MAX_LENGTH, buildCategoryOrder,
    buildDocsIndex, buildHelpSections, docSummary, isDirectoryBullet, parseHelpMarker, readmeCategories,
    renderDocsIndexModule, sectionDocPaths,
} from '../../../scripts/quicklaunch/generate-docs-index.mjs';
import { CATEGORY_ORDER, DOCS_INDEX, HELP_SECTIONS } from './generated/docsIndex.js';

describe('quickLaunch generated/docsIndex.js', () => {
    it('equals what the generator writes today (byte for byte)', () => {
        expect(readFileSync(join(REPO, OUTPUT), 'utf8'))
            .toBe(renderDocsIndexModule(buildDocsIndex(), buildCategoryOrder(), buildHelpSections()));
    });

    it('the imported table deep-equals a fresh walk', () => {
        expect(DOCS_INDEX).toEqual(buildDocsIndex());
    });

    it('lists no excluded file name (TODO.md is not a guide)', () => {
        expect(DOCS_INDEX.filter((d) => EXCLUDED_BASENAMES.includes(d.path.split('/').pop()))).toEqual([]);
    });

    it('every row has a path under docs/json, a title and a section (its directory under docs/json)', () => {
        const bad = DOCS_INDEX.filter((d) => !d.path.startsWith('docs/json/') || !d.title
            || `docs/json/${d.section}/${d.path.split('/').pop()}` !== d.path);
        expect(bad).toEqual([]);
    });

    it('every row has a summary no longer than SUMMARY_MAX_LENGTH (warning when one is empty)', () => {
        const tooLong = DOCS_INDEX.filter((d) => typeof d.summary !== 'string' || d.summary.length > SUMMARY_MAX_LENGTH);
        expect(tooLong.map((d) => d.path)).toEqual([]);
        const empty = DOCS_INDEX.filter((d) => !d.summary).map((d) => d.path);
        if (empty.length) console.warn(`WARNING: guides with no first paragraph (no summary): ${empty.join(', ')}`);
    });
});

describe('quickLaunch generated HELP_SECTIONS', () => {
    it('deep-equals a fresh walk', () => {
        expect(HELP_SECTIONS).toEqual(buildHelpSections());
    });

    it('is the eight marked directories, by order, labelled by their READMEs', () => {
        expect(HELP_SECTIONS.map((s) => [s.order, s.audience, s.dir, s.label])).toEqual([
            [0, 'panel', 'user/modules', 'Panel Guides'],
            [10, 'user', 'user', 'User Guides'],
            [20, 'user', 'features', 'Features'],
            [30, 'user', 'games', 'Playable Games'],
            [110, 'developer', 'developer/guides', 'Developer Guides'],
            [120, 'developer', 'developer/reference', 'Developer Reference Documentation'],
            [130, 'developer', 'developer/modules', 'Frontend Module Reference'],
            [140, 'developer', 'developer/procgen', 'Procedural Generation'],
        ]);
    });

    it('DOCS_INDEX is exactly the docs the sections list (each once)', () => {
        const listed = HELP_SECTIONS.flatMap(sectionDocPaths);
        expect(new Set(listed).size).toBe(listed.length);
        expect([...listed].sort()).toEqual(DOCS_INDEX.map((d) => d.path));
    });

    it('games nests by sub-directory; a README-only sub-directory is single', () => {
        const games = HELP_SECTIONS.find((s) => s.dir === 'games');
        expect(games.docs).toEqual([]);
        for (const child of games.children) {
            expect(child.single).toBe(child.docs.length === 1);
            if (child.single) expect(child.docs).toEqual([`docs/json/${child.dir}/README.md`]);
        }
        expect(games.children.filter((c) => !c.single).map((c) => c.dir))
            .toEqual(['games/journey-to-ascension', 'games/vibe-coding-simulator']);
    });

    it('no marked README is a row (it is its section\'s label)', () => {
        const labels = new Set(HELP_SECTIONS.map((s) => `docs/json/${s.dir}/README.md`));
        expect(DOCS_INDEX.filter((d) => labels.has(d.path))).toEqual([]);
    });
});

describe('parseHelpMarker', () => {
    it('reads order and audience; null without a marker', () => {
        expect(parseHelpMarker('# T\n\n<!-- quick-launch-help: order=20 audience=user -->\n', 'x')).toEqual(
            { order: 20, audience: HELP_AUDIENCES.user });
        expect(parseHelpMarker('# T\n\n<!-- some other comment -->\n', 'x')).toBeNull();
    });

    it('a malformed marker throws, naming the file', () => {
        expect(() => parseHelpMarker('<!-- quick-launch-help: order=x audience=user -->', 'docs/json/a/README.md'))
            .toThrow(/docs\/json\/a\/README\.md: malformed/);
        expect(() => parseHelpMarker('<!-- quick-launch-help: order=1 audience=everyone -->', 'f')).toThrow(/malformed/);
    });

    it('two markers throw', () => {
        const two = '<!-- quick-launch-help: order=1 audience=user -->\n<!-- quick-launch-help: order=2 audience=user -->';
        expect(() => parseHelpMarker(two, 'f')).toThrow(/2 quick-launch-help markers/);
    });
});

describe('buildHelpSections over a fixture tree', () => {
    const mark = (order, audience) => `<!-- quick-launch-help: order=${order} audience=${audience} -->`;
    const FILES = {
        'docs/json/outer/README.md': `# Outer\n\n${mark(10, 'user')}\n`,
        'docs/json/outer/a.md': '# A\n\nPara.',
        'docs/json/outer/TODO.md': '# Todo',
        'docs/json/outer/inner/README.md': `# Inner\n\n${mark(5, 'panel')}\n`,
        'docs/json/outer/inner/p.md': '# P',
        'docs/json/outer/multi/README.md': '# Multi Doc\n\nIntro.',
        'docs/json/outer/multi/x.md': '# X',
        'docs/json/outer/multi/y.md': '# Y',
        'docs/json/outer/solo/README.md': '# Solo Only',
        'docs/json/outer/empty/notes.txt': 'not a doc',
        'docs/json/unmarked/z.md': '# Z',
        'docs/json/dev/README.md': `# Dev\n\n${mark(100, 'developer')}\n`,
        'docs/json/dev/d.md': '# D',
    };
    let repo;
    const build = () => buildHelpSections(repo);

    beforeAll(() => {
        repo = mkdtempSync(join(tmpdir(), 'ql-help-'));
        for (const [path, text] of Object.entries(FILES)) {
            mkdirSync(dirname(join(repo, path)), { recursive: true });
            writeFileSync(join(repo, path), text);
        }
    });
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    it('only marked directories are sections, by order; unmarked ones stay out', () => {
        expect(build().map((s) => [s.dir, s.label, s.order, s.audience])).toEqual([
            ['outer/inner', 'Inner', 5, 'panel'],
            ['outer', 'Outer', 10, 'user'],
            ['dev', 'Dev', 100, 'developer'],
        ]);
    });

    it('a marked directory inside a marked one is its own section, not a child', () => {
        const outer = build().find((s) => s.dir === 'outer');
        expect(outer.children.map((c) => c.dir)).toEqual(['outer/multi', 'outer/solo']);
        expect(build().find((s) => s.dir === 'outer/inner').docs).toEqual(['docs/json/outer/inner/p.md']);
    });

    it('own docs skip the README (the label) and EXCLUDED_BASENAMES', () => {
        expect(build().find((s) => s.dir === 'outer').docs).toEqual(['docs/json/outer/a.md']);
    });

    it('an unmarked sub-directory: README + 2 is a sub-group labelled by its H1; README only is single', () => {
        const [multi, solo] = build().find((s) => s.dir === 'outer').children;
        expect(multi).toEqual({
            dir: 'outer/multi', label: 'Multi Doc', single: false,
            docs: ['docs/json/outer/multi/README.md', 'docs/json/outer/multi/x.md', 'docs/json/outer/multi/y.md'],
        });
        expect(solo).toEqual({ dir: 'outer/solo', label: 'Solo Only', single: true, docs: ['docs/json/outer/solo/README.md'] });
    });

    it('DOCS_INDEX rows over the fixture: the panel section is indexed, section = the directory', () => {
        const rows = buildDocsIndex(repo, build());
        expect(rows.map((r) => [r.path, r.section])).toEqual([
            ['docs/json/dev/d.md', 'dev'],
            ['docs/json/outer/a.md', 'outer'],
            ['docs/json/outer/inner/p.md', 'outer/inner'],
            ['docs/json/outer/multi/README.md', 'outer/multi'],
            ['docs/json/outer/multi/x.md', 'outer/multi'],
            ['docs/json/outer/multi/y.md', 'outer/multi'],
            ['docs/json/outer/solo/README.md', 'outer/solo'],
        ]);
    });

    it('a malformed marker anywhere fails the walk, naming the file', () => {
        const bad = join(repo, 'docs/json/unmarked/README.md');
        writeFileSync(bad, '# U\n\n<!-- quick-launch-help: order=1 -->\n');
        try {
            expect(build).toThrow(/docs\/json\/unmarked\/README\.md: malformed/);
        } finally {
            rmSync(bad);
        }
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
