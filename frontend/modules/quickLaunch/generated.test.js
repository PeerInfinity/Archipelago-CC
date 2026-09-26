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
    EXCLUDED_BASENAMES, HELP_AUDIENCES, MODULES_README, OUTPUT, REPO, SECTION_README, SUMMARY_MAX_LENGTH, UNLISTED_LABEL,
    buildCategoryOrder, buildDocsIndex, buildHelpSections, docSummary, headingSlug, isDirectoryBullet, parseHelpMarker,
    readmeCategories, readmeHeadingGroups, renderDocsIndexModule, sectionDocPaths,
} from '../../../scripts/quicklaunch/generate-docs-index.mjs';
import { CATEGORY_ORDER, DOCS_INDEX, HELP_SECTIONS, UNLISTED_LABEL as GENERATED_UNLISTED } from './generated/docsIndex.js';

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

    it('a section without sub-directories whose README lists its docs under ## headings is sub-grouped by them', () => {
        for (const section of HELP_SECTIONS.filter((s) => s.children.some((c) => c.heading))) {
            const readme = readFileSync(join(REPO, 'docs/json', section.dir, SECTION_README), 'utf8');
            const own = [...section.docs, ...section.children.flatMap((c) => c.docs)];
            const groups = readmeHeadingGroups(readme, `docs/json/${section.dir}`, own);
            const headings = readme.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());
            expect(section.docs).toEqual([]);
            expect(section.children.every((c) => c.heading && !c.single)).toBe(true);
            // Children = the listing headings in README order (a subsequence of all its headings), then Unlisted.
            const labels = section.children.map((c) => c.label).filter((l) => l !== UNLISTED_LABEL);
            expect(labels).toEqual(groups.map((g) => g.heading));
            expect(labels).toEqual(headings.filter((h) => labels.includes(h)));
            for (const g of groups) expect(section.children.find((c) => c.label === g.heading).docs).toEqual(g.docs);
            const unlisted = section.children.find((c) => c.label === UNLISTED_LABEL);
            if (unlisted) expect(section.children.at(-1)).toBe(unlisted);
            for (const c of section.children) expect(c.dir).toBe(`${section.dir}/${headingSlug(c.label)}`);
        }
    });

    it('the generated module carries UNLISTED_LABEL (the in-app row reads it there)', () => {
        expect(GENERATED_UNLISTED).toBe(UNLISTED_LABEL);
    });

    it('today: three developer sections are sub-grouped by their READMEs; procgen and the user sections are not', () => {
        const byHeadings = HELP_SECTIONS.filter((s) => s.children.some((c) => c.heading)).map((s) => s.dir);
        expect(byHeadings).toEqual(['developer/guides', 'developer/reference', 'developer/modules']);
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

describe('README ## headings sub-group a section (readmeHeadingGroups over text)', () => {
    const own = ['d/a.md', 'd/b.md', 'd/c.md', 'd/e.md'];
    const text = [
        '# D', '', '- [not under a heading](./e.md)', '',
        '## One', '', '-   **[B](./b.md):** first', '- [A](a.md#part) second', '',
        '## See Also', '', '- [Up](../x.md)', '- [Sub](./sub/y.md)', '- [Missing](./nope.md)', '',
        '## Two', '', '* [C](./c.md)', '- [A again](./a.md) — stays under One', '',
        '## Prose', '', 'A paragraph linking [B](./b.md) is not a bullet.',
    ].join('\n');

    it('one group per heading that lists own docs, README order, bullet order; a doc listed twice stays first', () => {
        expect(readmeHeadingGroups(text, 'd', own)).toEqual([
            { heading: 'One', docs: ['d/b.md', 'd/a.md'] },
            { heading: 'Two', docs: ['d/c.md'] },
        ]);
    });

    it('no listing headings → []', () => {
        expect(readmeHeadingGroups('# D\n\n## See Also\n\n- [Up](../x.md)\n', 'd', own)).toEqual([]);
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
        'docs/json/byhead/README.md': `# By Head\n\n${mark(200, 'developer')}\n\n## First Things\n\n- [H2](./h2.md)\n`
            + '- [H1](./h1.md)\n\n## See Also\n\n- [Dev](../dev/d.md)\n\n## Later\n\n- [H3](h3.md)\n',
        'docs/json/byhead/h1.md': '# H1',
        'docs/json/byhead/h2.md': '# H2',
        'docs/json/byhead/h3.md': '# H3',
        'docs/json/byhead/h4.md': '# H4',
        'docs/json/byhead/a4.md': '# A4',
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
            ['byhead', 'By Head', 200, 'developer'],
        ]);
    });

    it('a README listing its docs under ## headings: one child per listing heading, then Unlisted; no own rows', () => {
        const byhead = build().find((s) => s.dir === 'byhead');
        expect(byhead.docs).toEqual([]);
        expect(byhead.children).toEqual([
            { dir: 'byhead/first-things', label: 'First Things', heading: true, single: false,
                docs: ['docs/json/byhead/h2.md', 'docs/json/byhead/h1.md'] },
            { dir: 'byhead/later', label: 'Later', heading: true, single: false, docs: ['docs/json/byhead/h3.md'] },
            { dir: 'byhead/unlisted', label: UNLISTED_LABEL, heading: true, single: false,
                docs: ['docs/json/byhead/a4.md', 'docs/json/byhead/h4.md'] },
        ]);
    });

    it('a README whose headings list nothing of its own stays flat (dev)', () => {
        expect(build().find((s) => s.dir === 'dev')).toMatchObject({ docs: ['docs/json/dev/d.md'], children: [] });
    });

    it('listing headings AND sub-directories in one section is refused, naming the README', () => {
        const readme = join(repo, 'docs/json/outer/README.md');
        const before = readFileSync(readme, 'utf8');
        writeFileSync(readme, `${before}\n## Heading\n\n- [A](./a.md)\n`);
        try {
            expect(build).toThrow(/docs\/json\/outer\/README\.md: lists its docs under ## headings AND has sub-directories/);
        } finally {
            writeFileSync(readme, before);
        }
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
            ['docs/json/byhead/a4.md', 'byhead'],
            ['docs/json/byhead/h1.md', 'byhead'],
            ['docs/json/byhead/h2.md', 'byhead'],
            ['docs/json/byhead/h3.md', 'byhead'],
            ['docs/json/byhead/h4.md', 'byhead'],
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
