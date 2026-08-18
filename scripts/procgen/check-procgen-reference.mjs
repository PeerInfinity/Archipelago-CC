#!/usr/bin/env node
/**
 * check-procgen-reference — **THE REFERENCE PAGE RENDERS WHAT THE GENERATED
 * MODULES HOLD, AND THE MODULES ARE WHAT THE CODE SAYS** (PROCGEN DOCS · P3a,
 * D5).
 *
 * ⛔⛔ **WHY THIS IS ITS OWN ROW AND NOT FOUR MORE CLAIMS IN
 * `check-procgen-demos.mjs`.** That row's subject is the two AUTHORED
 * catalogues — `demos.js` and `glossary.js` — and the pages that render them;
 * it already carries 108 claims and it loads thirteen lab-page URLs to get
 * there. This page's subject is a GENERATED table, and its first claim is one
 * no other row can make: that regenerating produces byte-identical files. A row
 * whose first act is to run a code generator does not belong inside a row whose
 * first act is to open `watch.html`. ⛓ They share the server helper, the
 * `--pages=` mapping and the readout-off-the-DOM rule, and nothing else.
 *
 * ── WHAT IT ASSERTS ───────────────────────────────────────────────────
 *
 *  1. `generate-procgen-reference.mjs --check` exits 0 — the checked-in modules
 *     ARE what the code says. ⛔ Skipped under `--pages=`, and it says so: the
 *     deployed site is a copy of a PAST commit, so a local generator's answer
 *     is a claim about this tree, not about that one.
 *  2. `reference.html` resolves, with ZERO console errors.
 *  3. It renders one row per row the three modules hold — PER SECTION, measured
 *     off ITS DOM. A readout echoed from the import would hold with the render
 *     deleted (trap 269), and a whole-page count would pass with one section
 *     rendering another's rows.
 *  4. Every anchor a reader could link to EXISTS — the parameter, template,
 *     element, kind, refusal and finding slugs, compared as a SET.
 *  5. Every glossary link the page prints has an anchor `glossary.html` really
 *     has. ⛔ Read off BOTH pages' DOM, never by comparing two imports: two
 *     modules agreeing in node says nothing about what a reader can click.
 *  6. The FILTER — the page's one control — narrows and clears.
 *  7. Both LAB PAGES carry the link, and nothing else of theirs moved (their own
 *     rows are the gate for that half; this one only checks the link exists and
 *     resolves).
 *
 * ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP (trap 176).
 *
 * Run: node scripts/procgen/check-procgen-reference.mjs
 *      node scripts/procgen/check-procgen-reference.mjs --host=http://localhost:8000
 *      node scripts/procgen/check-procgen-reference.mjs --pages=https://peerinfinity.github.io/Archipelago-CC
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { PAGES_BASE } from '../../frontend/modules/procgenDocs/demos.js';
import { termById } from '../../frontend/modules/procgenDocs/glossary.js';
import { URL_GRAMMAR } from '../../frontend/modules/procgenDocs/generated/urlGrammar.js';
import { CATALOGUE } from '../../frontend/modules/procgenDocs/generated/catalogue.js';
import { REFUSALS } from '../../frontend/modules/procgenDocs/generated/refusals.js';
import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATOR = join(REPO, 'scripts/procgen/generate-procgen-reference.mjs');

const REFERENCE_PAGE = '/frontend/modules/procgenDocs/reference.html';
const GLOSSARY_PAGE = '/frontend/modules/procgenDocs/glossary.html';
const LAB_PAGES = [
    '/frontend/modules/seedlingDemo/watch.html',
    '/frontend/modules/mazeRoom/lab.html',
];

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE EXPECTED SHAPE — DERIVED FROM THE MODULES, in the SAME way the page
 * derives it. ⛔ Not hardcoded: a table that grows a row would otherwise red
 * here for the right reason with the wrong number, and a reader would go
 * looking for a defect in the page.
 * ══════════════════════════════════════════════════════════════════════ */

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const PARAM_NAMES = [...new Set(URL_GRAMMAR.pages.flatMap((p) => p.params.map((q) => q.name)))]
    .sort();
const EXCLUDED_NAMES = [...new Set(CATALOGUE.biomes.flatMap((b) => b.excluded.map((t) => t.name)))];
const KIND_BIOMES = CATALOGUE.biomes.filter((b) => b.id !== 'post-sword');

const EXPECTED_SECTIONS = [
    { id: 'url', rows: PARAM_NAMES.length },
    { id: 'retired', rows: URL_GRAMMAR.retired.length },
    { id: 'codecs', rows: URL_GRAMMAR.codecs.length + URL_GRAMMAR.pages.length },
    { id: 'biomes', rows: CATALOGUE.biomes.length },
    { id: 'templates', rows: CATALOGUE.biomes.reduce((a, b) => a + b.templates.length, 0) },
    { id: 'excluded', rows: EXCLUDED_NAMES.length },
    { id: 'elements', rows: CATALOGUE.elements.length },
    { id: 'kinds', rows: KIND_BIOMES.reduce((a, b) => a + b.skeletonKinds.length, 0) },
    { id: 'findings', rows: REFUSALS.findings.length },
    { id: 'refusal-sources', rows: REFUSALS.sources.length },
    { id: 'refusals', rows: REFUSALS.rows.length },
    { id: 'enums', rows: REFUSALS.enums.length },
];

const EXPECTED_ANCHORS = [
    ...PARAM_NAMES.map((n) => `url-${slug(n)}`),
    ...URL_GRAMMAR.retired.map((r) => `retired-${slug(r.name)}`),
    ...URL_GRAMMAR.codecs.map((c) => `codec-${slug(c.id)}`),
    ...URL_GRAMMAR.pages.map((p) => `page-${slug(p.id)}`),
    ...CATALOGUE.biomes.map((b) => `biome-${slug(b.id)}`),
    ...CATALOGUE.biomes.flatMap((b) => b.templates
        .map((t) => `template-${slug(b.id)}-${slug(t.name)}`)),
    ...EXCLUDED_NAMES.map((n) => `excluded-${slug(n)}`),
    ...CATALOGUE.elements.map((e) => `element-${slug(e.head)}`),
    ...KIND_BIOMES.flatMap((b) => b.skeletonKinds
        .map((k) => `kind-${slug(b.substrate)}-${slug(k.kind)}`)),
    ...REFUSALS.findings.map((f) => `finding-${slug(f.source)}-${slug(f.name)}`),
    ...REFUSALS.sources.map((s) => `refusal-source-${slug(s.id)}`),
    ...REFUSALS.rows.map((r) => `refusal-${slug(r.name)}`),
    ...REFUSALS.enums.map((e) => `enum-${slug(e.id)}`),
];

const EXPECTED_TERMS = [...new Set(URL_GRAMMAR.pages
    .flatMap((p) => p.params.flatMap((q) => q.terms)))].sort();

/* ══════════════════════════════════════════════════════════════════════ */

const host = arg('host', '');
const pages = arg('pages', '');
const pagesBase = (pages || PAGES_BASE).replace(/\/$/, '');
const pagePath = (path) => (pages ? path.replace(/^\/frontend(?=\/)/, '') : path);

console.log(`the generated modules: ${PARAM_NAMES.length} URL parameters, `
    + `${CATALOGUE.biomes.length} biomes, ${REFUSALS.rows.length} refusal names, `
    + `${REFUSALS.findings.length} findings — ${EXPECTED_ANCHORS.length} anchors expected`);

/* ── 1. THE GATE ITSELF ─────────────────────────────────────────────── */

if (pages) {
    console.log('\n⚠ --pages= SKIPS the `--check` claim by design: the deployed site is a copy '
        + 'of a PAST commit, so this tree\'s generator answers a question about THIS tree.');
} else {
    let out = '';
    let code = 0;
    try {
        out = execFileSync('node', [GENERATOR, '--check'], { encoding: 'utf8' });
    } catch (e) {
        code = e.status ?? 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    check(code === 0 && out.includes('ALL 3 GENERATED MODULES MATCH THE CODE'),
        '⛓⛓⛓ the checked-in modules ARE what the code says (`--check` = regenerate, no diff)',
        code === 0 ? '3 modules' : out.trim().split('\n').slice(0, 8).join(' | '));
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

/* ── 2..6. THE PAGE ─────────────────────────────────────────────────── */

let seen = null;
try {
    const url = `${origin}${pagePath(REFERENCE_PAGE)}`;
    console.log(`\nthe REFERENCE page\n  ${url}`);
    errors.length = 0;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    check(response?.status() === 200, '⛓ the reference page RESOLVES (HTTP 200)',
        `status ${response?.status() ?? 'none'}`);
    await page.waitForFunction(() => window.__procgenReferencePage?.ready === true,
        undefined, { timeout: 60000 }).catch(() => {});
    seen = await page.evaluate(() => window.__procgenReferencePage ?? null);
    check(errors.length === 0, '…with ZERO console errors and ZERO pageerrors',
        errors.join(' | '));

    /** ⛓⛓ PER SECTION, not one whole-page total: a total would pass with one
     *  section rendering another's rows, which is exactly what an off-by-one in
     *  a loop over three modules looks like. */
    const bySection = new Map((seen?.sections ?? []).map((s) => [s.id, s.rows]));
    const wrong = EXPECTED_SECTIONS
        .filter((s) => bySection.get(s.id) !== s.rows)
        .map((s) => `${s.id}: page ${bySection.get(s.id) ?? 'MISSING'} vs modules ${s.rows}`);
    check(wrong.length === 0,
        `⛓⛓ it RENDERED one row per module row, section by section (${
            EXPECTED_SECTIONS.length} sections, ${
            EXPECTED_SECTIONS.reduce((a, s) => a + s.rows, 0)} rows)`,
        wrong.length ? wrong.join(' | ')
            : EXPECTED_SECTIONS.map((s) => `${s.id} ${s.rows}`).join(' · '));

    check(seen?.count === EXPECTED_SECTIONS.reduce((a, s) => a + s.rows, 0),
        '…and its own total agrees (measured off its DOM, never echoed from the import)',
        `page ${seen?.count ?? 'none'}`);

    /** ⛓ THE ANCHORS ARE THE LINKABLE HALF — a reader saves
     *  `reference.html#refusal-no-pocket`, and a slug that moved silently is a
     *  dead bookmark nothing else notices. */
    const anchors = new Set(seen?.anchors ?? []);
    const missing = EXPECTED_ANCHORS.filter((a) => !anchors.has(a));
    const extra = [...anchors].filter((a) => !EXPECTED_ANCHORS.includes(a));
    check(missing.length === 0 && extra.length === 0,
        `⛓⛓ every ANCHOR a link could name exists, and no others (${
            EXPECTED_ANCHORS.length})`,
        missing.length || extra.length
            ? `missing: [${missing.slice(0, 6).join(', ')}] extra: [${extra.slice(0, 6).join(', ')}]`
            : 'exact');

    check(seen?.deadTerms === 0,
        '⛔ …and NOT ONE glossary slug rendered as a dead literal',
        `dead: ${seen?.deadTerms}`);

    /** ⛓ THE FILTER IS THE PAGE'S ONE CONTROL, so it is PRESSED. The expected
     *  count is computed the way the page computes it — ⛔ never hardcoded. */
    const probe = 'killgate';
    await page.fill('#filter', probe);
    await page.waitForFunction(() => window.__procgenReferencePage?.visible
        !== window.__procgenReferencePage?.count, undefined, { timeout: 30000 }).catch(() => {});
    const narrowed = await page.evaluate(() => window.__procgenReferencePage?.visible ?? null);
    check(narrowed > 0 && narrowed < seen.count,
        `⛓⛓ the FILTER narrows on "${probe}"`, `${narrowed} of ${seen?.count}`);
    await page.fill('#filter', '');
    await page.waitForFunction((n) => window.__procgenReferencePage?.visible === n,
        seen.count, { timeout: 30000 }).catch(() => {});
    const restored = await page.evaluate(() => window.__procgenReferencePage?.visible ?? null);
    check(restored === seen.count, '…and CLEARING it brings every row back',
        `visible ${restored}`);
} catch (e) {
    check(false, 'the REFERENCE page check THREW', e.stack ?? e.message);
}

/* ── 5. THE TWO PAGES MEET ──────────────────────────────────────────── */

try {
    const url = `${origin}${pagePath(GLOSSARY_PAGE)}`;
    console.log(`\nthe GLOSSARY page — the other end of every terms: link\n  ${url}`);
    errors.length = 0;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    check(response?.status() === 200, '⛓ the glossary page RESOLVES (HTTP 200)',
        `status ${response?.status() ?? 'none'}`);
    await page.waitForFunction(() => window.__procgenGlossaryPage?.ready === true,
        undefined, { timeout: 60000 }).catch(() => {});
    const glossary = await page.evaluate(() => window.__procgenGlossaryPage ?? null);
    const anchors = new Set(glossary?.anchors ?? []);
    /** ⛔ Off the GLOSSARY page's DOM against the REFERENCE page's DOM — two
     *  modules agreeing in node says nothing about what a reader can click. */
    const printed = [...new Set((seen?.glossaryLinks ?? [])
        .map((h) => (/glossary\.html#([a-z0-9-]+)$/.exec(h) ?? [])[1])
        .filter(Boolean))].sort();
    const dead = printed.filter((a) => !anchors.has(a));
    check(dead.length === 0 && printed.length > 0,
        `⛓⛓ every terms: link the reference page prints has an anchor here (${
            printed.length} distinct)`,
        dead.length ? `dead: ${dead.join(', ')}` : 'all present');
    check(printed.join(',') === EXPECTED_TERMS.join(','),
        '…and they are exactly the slugs the generated table declares',
        printed.join(',') === EXPECTED_TERMS.join(',') ? `${printed.length} slugs`
            : `page [${printed.join(',')}]\n    want [${EXPECTED_TERMS.join(',')}]`);
    const unresolved = EXPECTED_TERMS.filter((t) => !termById(t));
    check(unresolved.length === 0, '…and every one of them RESOLVES in the module too',
        unresolved.join(', '));
} catch (e) {
    check(false, 'the GLOSSARY cross-check THREW', e.stack ?? e.message);
}

/* ── 7. THE LAB PAGES GAINED A LINK AND NOTHING ELSE ────────────────── */

try {
    console.log('\nthe two LAB pages — the header link, and only that');
    for (const lab of LAB_PAGES) {
        const url = `${origin}${pagePath(lab)}`;
        errors.length = 0;
        // eslint-disable-next-line no-await-in-loop
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        check(response?.status() === 200, `⛓ ${lab} RESOLVES (HTTP 200)`,
            `status ${response?.status() ?? 'none'}`);
        // eslint-disable-next-line no-await-in-loop
        const links = await page.evaluate(() => [...document.querySelectorAll('#docLinks a')]
            .map((a) => a.getAttribute('href')));
        check(links.includes('../procgenDocs/reference.html'),
            `…and its header links the REFERENCE page`, `#docLinks → [${links.join(', ')}]`);
        /** ⛓ RELATIVE, which is why one string works on both hosts — and the
         *  claim is that it LOADS, not merely that it is written. */
        // eslint-disable-next-line no-await-in-loop
        const target = await page.evaluate(() => document
            .querySelector('#docLinks a[href$="reference.html"]')?.href ?? null);
        // eslint-disable-next-line no-await-in-loop
        const hit = await page.goto(target, { waitUntil: 'domcontentloaded' });
        check(hit?.status() === 200, '…and that link LOADS from this page\'s own host',
            `${target} → ${hit?.status() ?? 'none'}`);
    }
} catch (e) {
    check(false, 'the LAB PAGE link check THREW', e.stack ?? e.message);
}

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
