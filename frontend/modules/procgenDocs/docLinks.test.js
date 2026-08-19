/**
 * procgenDocs/docLinks — **EVERY LINK IN THE CORPUS, RESOLVED, COUNTED AND
 * PINNED** (PROCGEN DOCS · P4, D3).
 *
 * ⛓ `resolveDocLink` is pure, so it can be run over all 210 links the
 * seventeen tracked documents contain without a browser and without a server.
 * That is the whole reason it is a separate function from the page: the page
 * can only ever show one document at a time, and a resolver nobody ran over
 * the WHOLE corpus is a resolver whose worst case nobody has seen.
 *
 * ── WHAT THIS FILE IS FOR ─────────────────────────────────────────────
 *
 *  1. The per-kind census, PRINTED and PINNED. A count that moves means the
 *     documents gained a kind of link nobody classified, and somebody should
 *     look at it before it renders as a plausible 404.
 *  2. Every repo-relative link names a path that EXISTS in this tree.
 *  3. Every fragment — same-doc and cross-doc — names a real heading of its
 *     target, using the SAME `headingsOf` the page renders anchors from.
 *  4. The `?doc=` allow list refuses everything that is not in the index.
 *
 * ⛔⛔ **A DEAD LINK IS A NAMED FINDING.** P4 ran this over the corpus before
 * writing the page and found exactly two dead fragments — `omsi.md` linking
 * `#instant-a-pump-not-a-skip` (the em dash makes it a DOUBLE hyphen) and
 * `text-adventure.md` naming a loop-recording heading that had since gained
 * "vs. summary". Both were plain typos, both are dead on GitHub too, and both
 * were fixed in the `.md`s. Zero dead paths, then and now.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_URL } from './demos.js';
import { headingsOf } from './ghSlug.js';
import {
    DOC_DIR, DOC_FILES, INDEX_FILE,
    docFileFor, linksIn, normalizePath, repoPathFor, resolveDocLink,
} from './docLinks.js';

const ROOT = new URL('../../../', import.meta.url).pathname;
const FILES = readdirSync(join(ROOT, DOC_DIR)).filter((f) => f.endsWith('.md')).sort();
const read = (f) => readFileSync(join(ROOT, DOC_DIR, f), 'utf8');

/** ⛓ THE CORPUS, read once: every link with the document that wrote it. */
const CORPUS = FILES.flatMap((doc) => linksIn(read(doc)).map((l) => ({ doc, ...l })));
const RESOLVED = CORPUS.map((l) => ({ ...l, ...resolveDocLink(l.href, { doc: l.doc, siteRoot: '' }) }));

/** ⛓ Heading slugs per document, from the page's own reader. */
const SLUGS = new Map(FILES.map((f) => [f, new Set(headingsOf(read(f)).map((h) => h.slug))]));

describe('the corpus census — printed, then pinned', () => {
    it('resolves all 210 links into five kinds and no others', () => {
        const by = {};
        for (const r of RESOLVED) by[r.kind] = (by[r.kind] ?? 0) + 1;
        // eslint-disable-next-line no-console
        console.log(`the procgen corpus: ${FILES.length} documents, ${CORPUS.length} links — `
            + Object.entries(by).sort().map(([k, n]) => `${n} ${k}`).join(', '));

        /**
         * ⚖ `page` is ZERO and that is a MEASUREMENT, not an omission (trap
         * 403 — an empty answer and a broken one look identical). No tracked
         * document links to a `frontend/**.html` today; the three frontend
         * paths they DO name are `.js` files, which are source and go to
         * GitHub. The branch stays because sending a live page to a blob URL
         * is the failure it prevents, and this line is where a first such link
         * would announce itself.
         */
        expect(by).toEqual({
            'same-doc': 13,
            doc: 144,
            external: 21,
            repo: 32,
        });
        expect(by.page ?? 0).toBe(0);
        expect(CORPUS.length).toBe(210);
    });

    it('sends every sibling `.md` to the VIEWER, never to GitHub', () => {
        const docs = RESOLVED.filter((r) => r.kind === 'doc');
        expect(docs).toHaveLength(144);
        for (const r of docs) {
            expect(r.href, `${r.doc}: ${r.href}`).toMatch(/^docs\.html\?doc=[A-Za-z0-9%.-]+\.md(#.*)?$/);
            expect(r.href).not.toContain(REPO_URL);
        }
    });

    it('sends every other repo path to GitHub, fragment kept', () => {
        const repo = RESOLVED.filter((r) => r.kind === 'repo');
        expect(repo).toHaveLength(32);
        for (const r of repo) expect(r.href.startsWith(`${REPO_URL}/`), r.href).toBe(true);
        /** ⛓ The four families the corpus actually names. */
        const tops = [...new Set(repo.map((r) => r.repoPath.split('/')[0]))].sort();
        expect(tops).toEqual(['CC', 'docs', 'frontend', 'scripts']);
    });

    it('leaves `http(s)://` and same-doc fragments exactly as written', () => {
        for (const r of RESOLVED.filter((x) => x.kind === 'external')) expect(r.href).toBe(r.href);
        for (const r of RESOLVED.filter((x) => x.kind === 'external')) {
            expect(r.href).toMatch(/^https?:\/\//);
        }
        for (const r of RESOLVED.filter((x) => x.kind === 'same-doc')) {
            expect(r.href).toBe(r.href.trim());
            expect(r.href.startsWith('#')).toBe(true);
        }
    });
});

describe('every link lands on something that exists', () => {
    it('⛓ every repo-relative path is a real file in this tree', () => {
        const missing = RESOLVED
            .filter((r) => r.kind === 'repo' || r.kind === 'page')
            .filter((r) => !existsSync(join(ROOT, r.repoPath)))
            .map((r) => `${r.doc} → ${r.href}`);
        expect(missing, 'a link resolves to a GitHub URL for a file that is not here').toEqual([]);
    });

    it('⛓ every SAME-DOC fragment names a heading of its own document', () => {
        const dead = [];
        for (const r of RESOLVED.filter((x) => x.kind === 'same-doc')) {
            if (!SLUGS.get(r.doc).has(r.href.slice(1))) dead.push(`${r.doc} → ${r.href}`);
        }
        expect(dead).toEqual([]);
    });

    it('⛓ every CROSS-DOC fragment names a heading of the document it targets', () => {
        const dead = [];
        for (const r of RESOLVED.filter((x) => x.kind === 'doc')) {
            const [, frag] = r.href.split('#');
            if (!frag) continue;
            const file = decodeURIComponent(r.href.slice('docs.html?doc='.length).split('#')[0]);
            if (!SLUGS.get(file)?.has(frag)) dead.push(`${r.doc} → ${r.href}`);
        }
        expect(dead).toEqual([]);
    });

    /** ⛓ Nine of the corpus's GitHub links point at a `.md` OUTSIDE this
     *  directory with a fragment; GitHub slugs those the same way. */
    it('⛓ every fragment on an OUTSIDE `.md` names a heading of that file too', () => {
        const dead = [];
        for (const r of RESOLVED.filter((x) => x.kind === 'repo' && x.href.includes('#'))) {
            if (!r.repoPath.endsWith('.md')) continue;
            const slugs = new Set(headingsOf(readFileSync(join(ROOT, r.repoPath), 'utf8'))
                .map((h) => h.slug));
            const frag = r.href.split('#')[1];
            if (!slugs.has(frag)) dead.push(`${r.doc} → ${r.href}`);
        }
        expect(dead).toEqual([]);
    });
});

describe('the resolver itself', () => {
    const at = (href) => resolveDocLink(href, { doc: 'maze.md', siteRoot: '' });

    it('normalizes `..` without node, and does not clamp an escape', () => {
        expect(normalizePath('a/b/../c')).toBe('a/c');
        expect(normalizePath('./a//b/')).toBe('a/b');
        expect(normalizePath('../../x')).toBe('../../x');
        expect(repoPathFor('../../../../scripts/procgen/README.md'))
            .toBe('scripts/procgen/README.md');
    });

    it('answers each of the five kinds', () => {
        expect(at('#a-heading')).toEqual({ kind: 'same-doc', href: '#a-heading' });
        expect(at('https://example.com/x').kind).toBe('external');
        expect(at('mailto:a@b.c').kind).toBe('external');
        expect(at('./seedling-bot.md#gates'))
            .toMatchObject({ kind: 'doc', href: 'docs.html?doc=seedling-bot.md#gates' });
        expect(at('seedling-bot.md')).toMatchObject({ kind: 'doc', href: 'docs.html?doc=seedling-bot.md' });
        expect(at('../../../../scripts/procgen/README.md'))
            .toMatchObject({ kind: 'repo', href: `${REPO_URL}/scripts/procgen/README.md` });
    });

    it('⛓ a `frontend/**.html` goes through the ONE Pages mapping, on both hosts', () => {
        const href = (siteRoot) => resolveDocLink(
            '../../../../frontend/modules/procgenDocs/glossary.html#door-law',
            { doc: 'maze.md', siteRoot },
        ).href;
        expect(href('')).toBe('/modules/procgenDocs/glossary.html#door-law');
        expect(href('/Archipelago-CC'))
            .toBe('/Archipelago-CC/modules/procgenDocs/glossary.html#door-law');
    });

    it('⛔ a `.md` in this directory that the INDEX does not list is NOT a viewer link', () => {
        /** ⛓ The allow list is the gate, not the file extension: a document
         *  the index has never heard of cannot be opened, so linking to it as
         *  though it could would hand the reader a refusal. */
        const r = at('./not-a-tracked-doc.md');
        expect(r.kind).toBe('repo');
        expect(r.href).toBe(`${REPO_URL}/${DOC_DIR}/not-a-tracked-doc.md`);
    });
});

describe('the `?doc=` allow list', () => {
    it('is the generated index — README plus the seventeen, in reading order', () => {
        expect(DOC_FILES).toHaveLength(18);
        expect(DOC_FILES[0]).toBe(INDEX_FILE);
        expect(INDEX_FILE).toBe('README.md');
        expect([...DOC_FILES].sort()).toEqual([...FILES].sort());
    });

    it('defaults to README and accepts every listed file', () => {
        expect(docFileFor(undefined)).toBe('README.md');
        expect(docFileFor('')).toBe('README.md');
        for (const f of DOC_FILES) expect(docFileFor(f)).toBe(f);
    });

    it('⛔ refuses a traversal, an absolute path and an unlisted name', () => {
        for (const bad of [
            '../x.md', '../../../etc/passwd', '/etc/passwd', 'README.md/../../x',
            'docs/json/developer/procgen/maze.md', 'maze.MD', 'maze', 'no-such.md',
            'https://example.com/x.md',
        ]) expect(docFileFor(bad), bad).toBeNull();
    });
});
