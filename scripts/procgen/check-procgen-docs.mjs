#!/usr/bin/env node
/**
 * check-procgen-docs — **THE SEVENTEEN TRACKED DOCUMENTS RENDER ON THE PAGE,
 * WITH THE ANCHORS THEIR OWN LINKS POINT AT** (PROCGEN DOCS · P4, D4).
 *
 * ⛔⛔ **WHY THIS IS ITS OWN ROW.** `check-procgen-reference.mjs`'s subject is
 * a GENERATED table and its first act is to run a code generator;
 * `check-procgen-demos.mjs`'s subject is the two AUTHORED catalogues. This
 * row's subject is a FETCH: eighteen files that are not in `frontend/` at all,
 * reached over HTTP from a site-root-relative path that only resolves because
 * something copied them there. Nothing the other two do would notice if that
 * copy stopped happening. ⛓ They share the server helper, the `--pages=`
 * mapping and the readout-off-the-DOM rule, and nothing else.
 *
 * ── WHAT IT ASSERTS ───────────────────────────────────────────────────
 *
 *  1. Every document the index lists LOADS, with ZERO console errors and no
 *     refusal. ⛓ This is the claim the deploy's copy step lives or dies by.
 *  2. Per document, the heading count OFF THE DOM equals what the SOURCE FILE
 *     on disk says. ⛔ Not a number read out of `window.__procgenDocsPage` and
 *     compared with itself, and not a count imported from a module: a readout
 *     that would hold with the render deleted is not a readout (trap 269).
 *  3. The anchor SET off the DOM contains every fragment the corpus census
 *     says points into that document. ⛓ This is the one claim that is not an
 *     echo of our own slug rule: those fragments were written by people, and
 *     the page has to answer them.
 *  4. Every `<a href>` the render produced is an href `resolveDocLink` would
 *     produce — read off the DOM as a SET, not clicked one at a time.
 *  5. The nav lists all eighteen, and marks the current one.
 *  6. `?doc=` refuses a path outside the index BY NAME, and the page SAYS so —
 *     a refused article and an empty one must not read the same (trap 403).
 *  7. `docs.html`'s own header links resolve on this host, and the three
 *     sibling pages link BACK to it.
 *  8. The render time for each document is PRINTED, so a page budget is a
 *     measurement rather than a guess.
 *
 * ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP (trap 176).
 *
 * Run: node scripts/procgen/check-procgen-docs.mjs
 *      node scripts/procgen/check-procgen-docs.mjs --host=http://localhost:8000
 *      node scripts/procgen/check-procgen-docs.mjs --pages=https://peerinfinity.github.io/Archipelago-CC
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { PAGES_BASE } from '../../frontend/modules/procgenDocs/demos.js';
import {
    DOC_DIR, DOC_FILES, linksIn, resolveDocLink,
} from '../../frontend/modules/procgenDocs/docLinks.js';
import { headingsOf } from '../../frontend/modules/procgenDocs/ghSlug.js';
import { DOCS_INDEX } from '../../frontend/modules/procgenDocs/generated/docsIndex.js';
import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const DOCS_PAGE = '/frontend/modules/procgenDocs/docs.html';
const SIBLING_PAGES = [
    '/frontend/modules/procgenDocs/glossary.html',
    '/frontend/modules/procgenDocs/demos.html',
    '/frontend/modules/procgenDocs/reference.html',
];

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE EXPECTED SHAPE — ASKED OF THE SOURCE FILES, not of the page.
 * ══════════════════════════════════════════════════════════════════════ */

const read = (f) => readFileSync(join(REPO, DOC_DIR, f), 'utf8');

/** ⛓ Per document: how many headings it has, and which slugs. From the SOURCE. */
const SOURCE = new Map(DOC_FILES.map((f) => {
    const hs = headingsOf(read(f));
    return [f, { headings: hs.length, slugs: hs.map((h) => h.slug) }];
}));

/**
 * ⛓⛓ **THE FRAGMENTS THE CORPUS ITSELF POINTS AT**, per target document — the
 * one expectation in this row that nobody in this slice wrote. A same-doc
 * `#frag` targets its own file; a `./x.md#frag` targets `x.md`.
 */
const TARGETED = new Map(DOC_FILES.map((f) => [f, new Set()]));
for (const from of DOC_FILES) {
    for (const l of linksIn(read(from))) {
        const r = resolveDocLink(l.href, { doc: from, siteRoot: '' });
        if (r.kind === 'same-doc') { TARGETED.get(from).add(r.href.slice(1)); continue; }
        if (r.kind !== 'doc') continue;
        const [target, frag] = r.href.slice('docs.html?doc='.length).split('#');
        if (frag) TARGETED.get(decodeURIComponent(target))?.add(frag);
    }
}

/** ⛓ Every href the resolver would produce for that document, as a SET. */
const EXPECTED_HREFS = new Map(DOC_FILES.map((f) => [f, new Set(
    linksIn(read(f)).map((l) => resolveDocLink(l.href, { doc: f, siteRoot: '' }).href),
)]));

const onDisk = readdirSync(join(REPO, DOC_DIR)).filter((f) => f.endsWith('.md')).sort();

/* ══════════════════════════════════════════════════════════════════════ */

const host = arg('host', '');
const pages = arg('pages', '');
const pagesBase = (pages || PAGES_BASE).replace(/\/$/, '');
const pagePath = (path) => (pages ? path.replace(/^\/frontend(?=\/)/, '') : path);

console.log(`the corpus: ${DOC_FILES.length} documents in ${DOC_DIR}/ `
    + `(${DOCS_INDEX.counts.docs} indexed + the README the index lives in), `
    + `${[...SOURCE.values()].reduce((a, s) => a + s.headings, 0)} headings, `
    + `${[...TARGETED.values()].reduce((a, s) => a + s.size, 0)} fragments the corpus targets`);

check(DOC_FILES.length === onDisk.length && [...DOC_FILES].sort().join() === onDisk.join(),
    '⛓ the index\'s allow list IS what is on disk — no document is unreachable',
    `${DOC_FILES.length} listed / ${onDisk.length} on disk`);

if (pages) {
    console.log('\n⚠ --pages= compares the DEPLOYED page against THIS TREE\'s source files. '
        + 'The site is a copy of a past commit, so a heading-count mismatch here means the '
        + 'deploy is behind, not that the page is broken.');
}

let server = null;
if (!host && !pages) server = await serveRepoRoot({});
const origin = pages ? pagesBase : (host || `http://127.0.0.1:${server.address().port}`);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    process.exit(code);
};

const docUrl = (q) => `${origin}${pagePath(DOCS_PAGE)}${q}`;

/** ⛓ Load a document and read everything OFF THE DOM in one evaluate. */
async function load(file) {
    errors.length = 0;
    const response = await page.goto(docUrl(`?doc=${encodeURIComponent(file)}`),
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__procgenDocsPage?.ready === true,
        undefined, { timeout: 60000 }).catch(() => {});
    const dom = await page.evaluate(() => {
        const hs = [...document.querySelectorAll(
            '#article h1,#article h2,#article h3,#article h4,#article h5,#article h6')];
        return {
            headings: hs.length,
            ids: hs.map((h) => h.id),
            anchors: [...document.querySelectorAll('#article [id]')].map((e) => e.id),
            /** ⛔ `:not(.anchor)` — the render also emits one `<a href="#slug">`
             *  PER HEADING, so a reader can copy a link to a section. Those
             *  come from the heading hook, not from a link in the document,
             *  and counting them here reports every heading as a stray link. */
            hrefs: [...document.querySelectorAll('#article a:not(.anchor)')]
                .map((a) => a.getAttribute('href')),
            anchorLinks: document.querySelectorAll('#article a.anchor').length,
            nav: [...document.querySelectorAll('#navList a')].map((a) => a.textContent.trim()),
            here: [...document.querySelectorAll('#navList a.here')].map((a) => a.title),
            toc: document.querySelectorAll('#tocList a').length,
            statusText: document.getElementById('status')?.textContent ?? '',
            articleText: document.getElementById('article')?.textContent?.length ?? 0,
        };
    });
    const readout = await page.evaluate(() => window.__procgenDocsPage ?? null);
    return { response, dom, readout };
}

/* ── 1..5, 8. EVERY DOCUMENT ────────────────────────────────────────── */

const times = [];
try {
    console.log(`\nthe ${DOC_FILES.length} DOCUMENTS\n  ${docUrl('?doc=<file>')}`);
    for (const file of DOC_FILES) {
        // eslint-disable-next-line no-await-in-loop
        const { response, dom, readout } = await load(file);
        const want = SOURCE.get(file);

        check(response?.status() === 200 && readout?.ready === true && !readout.refusal
            && errors.length === 0,
            `⛓ ${file} LOADS and renders`,
            `status ${response?.status() ?? 'none'}, refusal ${readout?.refusal ?? 'none'}`
            + `${errors.length ? `, console ${errors.slice(0, 2).join(' | ')}` : ''}`);

        /** ⛔ DOM vs the file on disk — two different readers of the same fact. */
        check(dom.headings === want.headings,
            `…and its ${want.headings} headings are IN THE DOM`,
            `DOM ${dom.headings} / source ${want.headings}`);

        check(dom.ids.join(' ') === want.slugs.join(' '),
            '…each with the id GitHub would give it, in order',
            dom.ids.length === want.slugs.length
                ? (dom.ids.find((id, i) => id !== want.slugs[i]) ?? 'identical')
                : `${dom.ids.length} ids / ${want.slugs.length} slugs`);

        /** ⛓⛓ THE CLAIM THAT IS NOT OURS: fragments other people wrote. */
        const anchors = new Set(dom.anchors);
        const missing = [...TARGETED.get(file)].filter((f) => !anchors.has(f));
        check(missing.length === 0,
            `…and answers all ${TARGETED.get(file).size} fragments the corpus points at it`,
            missing.length ? `MISSING ${missing.join(', ')}` : 'every one');

        /** ⛓ The href SET, compared with what the resolver answers. */
        const wantHrefs = EXPECTED_HREFS.get(file);
        const strays = [...new Set(dom.hrefs)].filter((h) => h && !wantHrefs.has(h));
        check(strays.length === 0 && dom.anchorLinks === want.headings,
            `…and every one of its ${wantHrefs.size} link targets is the RESOLVER's answer`,
            strays.length ? `STRAY ${strays.slice(0, 3).join(' | ')}`
                : `set matches, plus ${dom.anchorLinks} heading anchors`);

        check(dom.nav.length === DOC_FILES.length && dom.here.length === 1
            && dom.here[0] === file,
            `…and the nav lists ${DOC_FILES.length} documents with THIS one marked`,
            `${dom.nav.length} entries, here=[${dom.here.join(',')}]`);

        times.push([file, readout?.renderMs ?? null]);
    }
} catch (e) {
    check(false, 'the DOCUMENT sweep THREW', e.stack ?? e.message);
}

console.log('\nrender time per document, off the page\'s own clock:');
for (const [f, ms] of times.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
    console.log(`  ${String(ms ?? '?').padStart(5)}ms  ${f}`);
}

/* ── 6. THE REFUSAL ─────────────────────────────────────────────────── */

try {
    console.log('\nthe REFUSAL — a document the index does not list');
    for (const bad of ['../../x.md', 'no-such.md', '/etc/passwd']) {
        errors.length = 0;
        // eslint-disable-next-line no-await-in-loop
        const response = await page.goto(docUrl(`?doc=${encodeURIComponent(bad)}`),
            { waitUntil: 'domcontentloaded' });
        // eslint-disable-next-line no-await-in-loop
        await page.waitForFunction(() => window.__procgenDocsPage?.ready === true,
            undefined, { timeout: 30000 }).catch(() => {});
        // eslint-disable-next-line no-await-in-loop
        const seen = await page.evaluate(() => ({
            refusal: window.__procgenDocsPage?.refusal ?? null,
            status: document.getElementById('status')?.textContent ?? '',
            statusClass: document.getElementById('status')?.className ?? '',
            article: document.getElementById('article')?.innerHTML ?? '',
        }));
        check(response?.status() === 200 && seen.refusal === 'doc-not-in-index',
            `⛓ ?doc=${bad} is REFUSED BY NAME`, `refusal ${seen.refusal ?? 'none'}`);
        /** ⛔ trap 403: an EMPTY article and a REFUSED one must read differently. */
        check(seen.article === '' && seen.status.includes('doc-not-in-index')
            && seen.statusClass.includes('bad'),
            '…and the PAGE says so — empty article, the refusal name in words',
            `article ${seen.article.length} chars, status "${seen.status.slice(0, 60)}"`);
    }
} catch (e) {
    check(false, 'the REFUSAL check THREW', e.stack ?? e.message);
}

/* ── 7. THE HEADER LINKS, BOTH WAYS ─────────────────────────────────── */

try {
    console.log('\nthe HEADER links');
    await page.goto(docUrl(''), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__procgenDocsPage?.ready === true,
        undefined, { timeout: 30000 }).catch(() => {});
    const own = await page.evaluate(() => [...document.querySelectorAll('#docLinks a')]
        .map((a) => a.href));
    check(own.length === 3, '⛓ docs.html links the three sibling pages', own.join(' '));
    for (const target of own) {
        // eslint-disable-next-line no-await-in-loop
        const hit = await page.goto(target, { waitUntil: 'domcontentloaded' });
        check(hit?.status() === 200, `…and ${target.split('/').pop()} LOADS from this host`,
            `${hit?.status() ?? 'none'}`);
    }

    /** ⛓ And back: the three siblings carry the `docs` word in their header. */
    for (const sib of SIBLING_PAGES) {
        // eslint-disable-next-line no-await-in-loop
        const response = await page.goto(`${origin}${pagePath(sib)}`,
            { waitUntil: 'domcontentloaded' });
        check(response?.status() === 200, `⛓ ${sib.split('/').pop()} RESOLVES`,
            `status ${response?.status() ?? 'none'}`);
        // eslint-disable-next-line no-await-in-loop
        const back = await page.evaluate(() => [...document.querySelectorAll('a')]
            .filter((a) => (a.getAttribute('href') ?? '').startsWith('docs.html'))
            .map((a) => a.href));
        check(back.length > 0, '…and it links BACK to the documents page', back[0] ?? 'none');
        if (!back.length) continue;
        // eslint-disable-next-line no-await-in-loop
        const hit = await page.goto(back[0], { waitUntil: 'domcontentloaded' });
        // eslint-disable-next-line no-await-in-loop
        const ok = await page.evaluate(() => window.__procgenDocsPage?.refusal ?? 'pending');
        check(hit?.status() === 200 && ok !== 'doc-not-in-index',
            '…and that link LANDS on a document, not on a refusal',
            `${hit?.status() ?? 'none'} / ${ok}`);
    }
} catch (e) {
    check(false, 'the HEADER LINK check THREW', e.stack ?? e.message);
}

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
