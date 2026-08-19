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
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { PAGES_BASE } from '../../frontend/modules/procgenDocs/demos.js';
import { termById } from '../../frontend/modules/procgenDocs/glossary.js';
import { URL_GRAMMAR } from '../../frontend/modules/procgenDocs/generated/urlGrammar.js';
import { CATALOGUE } from '../../frontend/modules/procgenDocs/generated/catalogue.js';
import { REFUSALS } from '../../frontend/modules/procgenDocs/generated/refusals.js';
import { REGISTRY } from '../../frontend/modules/procgenDocs/generated/registry.js';
import { INSTRUMENTS } from '../../frontend/modules/procgenDocs/generated/instruments.js';
import { DOCS_INDEX } from '../../frontend/modules/procgenDocs/generated/docsIndex.js';
import { markdownMarkers } from './reference/lib.mjs';
import { REGISTRY_DOC } from './reference/registry.mjs';
import { INSTRUMENTS_DOC } from './reference/instruments.mjs';
import { INDEX_DOC } from './reference/docsIndex.mjs';
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

/** ⛓ ALL SIX TABLES' findings share one section — the same list the page
 *  builds, derived here the same way rather than copied. */
const ALL_FINDINGS = [
    ...REFUSALS.findings.map((f) => ({ source: f.source, name: f.name })),
    ...REGISTRY.findings.map((f) => ({ source: 'registry', name: f.name })),
    ...INSTRUMENTS.findings.map((f) => ({ source: 'instruments', name: f.name })),
];

const EXPECTED_SECTIONS = [
    { id: 'url', rows: PARAM_NAMES.length },
    { id: 'retired', rows: URL_GRAMMAR.retired.length },
    { id: 'codecs', rows: URL_GRAMMAR.codecs.length + URL_GRAMMAR.pages.length },
    { id: 'biomes', rows: CATALOGUE.biomes.length },
    { id: 'templates', rows: CATALOGUE.biomes.reduce((a, b) => a + b.templates.length, 0) },
    { id: 'excluded', rows: EXCLUDED_NAMES.length },
    { id: 'elements', rows: CATALOGUE.elements.length },
    { id: 'kinds', rows: KIND_BIOMES.reduce((a, b) => a + b.skeletonKinds.length, 0) },
    { id: 'findings', rows: ALL_FINDINGS.length },
    { id: 'refusal-sources', rows: REFUSALS.sources.length },
    { id: 'refusals', rows: REFUSALS.rows.length },
    { id: 'enums', rows: REFUSALS.enums.length },
    { id: 'registry', rows: REGISTRY.columns.length },
    { id: 'instruments', rows: INSTRUMENTS.rows.length },
    { id: 'docs', rows: DOCS_INDEX.docs.length + DOCS_INDEX.pages.length },
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
    ...ALL_FINDINGS.map((f) => `finding-${slug(f.source)}-${slug(f.name)}`),
    ...REFUSALS.sources.map((s) => `refusal-source-${slug(s.id)}`),
    ...REFUSALS.rows.map((r) => `refusal-${slug(r.name)}`),
    ...REFUSALS.enums.map((e) => `enum-${slug(e.id)}`),
    ...REGISTRY.columns.map((c) => `registry-${slug(c.id)}`),
    ...INSTRUMENTS.rows.map((r) => `script-${slug(r.file.replace(/\.mjs$/, ''))}`),
    ...DOCS_INDEX.docs.map((d) => `doc-${slug(d.file.replace(/\.md$/, ''))}`),
    ...DOCS_INDEX.pages.map((p) => `docpage-${slug(p.file.replace(/\.html$/, ''))}`),
];

/** ⛓ Every glossary slug the page is entitled to print — the URL parameters'
 *  own `terms:` lines, PLUS the three P3b tables' declared ones. */
const EXPECTED_TERMS = [...new Set([
    ...URL_GRAMMAR.pages.flatMap((p) => p.params.flatMap((q) => q.terms)),
    ...REGISTRY.terms, ...INSTRUMENTS.terms, ...DOCS_INDEX.terms,
])].sort();

/* ══════════════════════════════════════════════════════════════════════ */

const host = arg('host', '');
const pages = arg('pages', '');
const pagesBase = (pages || PAGES_BASE).replace(/\/$/, '');
const pagePath = (path) => (pages ? path.replace(/^\/frontend(?=\/)/, '') : path);

console.log(`the generated modules: ${PARAM_NAMES.length} URL parameters, `
    + `${CATALOGUE.biomes.length} biomes, ${REFUSALS.rows.length} refusal names, `
    + `${REGISTRY.columns.length} registry entries, ${INSTRUMENTS.rows.length} instruments, `
    + `${DOCS_INDEX.docs.length} documents, ${ALL_FINDINGS.length} findings — `
    + `${EXPECTED_ANCHORS.length} anchors expected`);

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
    check(code === 0 && /ALL \d+ GENERATED MODULES AND \d+ MARKDOWN REGIONS? MATCH THE CODE/
        .test(out),
        '⛓⛓⛓ the checked-in modules AND the markdown regions ARE what the code says '
        + '(`--check` = regenerate, no diff)',
        code === 0 ? (/ALL [^\n]*/.exec(out) ?? [''])[0] : out.trim().split('\n').slice(0, 8).join(' | '));
}

/* ── 1b. THE MARKDOWN REGIONS ───────────────────────────────────────── */

/**
 * ⛓⛓ THREE OF THE SIX TABLES ALSO LIVE IN A `.md` PEOPLE READ ON GITHUB, and
 * `--check` above already proved their CONTENT. What this claim adds is that
 * the region is still THERE and still has its markers: a `.md` whose markers
 * somebody deleted would make the generator refuse, and a reader of that file
 * would meanwhile be reading a table nothing regenerates.
 *
 * ⛔ Skipped under `--pages=`, for the same reason `--check` is: these files
 * are in THIS tree, and the deployed site is a copy of a past commit.
 */
const MD_REGIONS = [
    { file: REGISTRY_DOC, table: 'substrate-capability-matrix' },
    { file: INSTRUMENTS_DOC, table: 'procgen-instruments' },
    { file: INDEX_DOC, table: 'procgen-docs-index' },
];

if (!pages) {
    const bad = [];
    for (const r of MD_REGIONS) {
        const text = readFileSync(join(REPO, r.file), 'utf8');
        const { begin, end } = markdownMarkers(r.table);
        const begins = text.split('\n').filter((l) => l.trim() === begin).length;
        const ends = text.split('\n').filter((l) => l.trim() === end).length;
        const body = (new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)`
            + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).exec(text) ?? [])[1] ?? '';
        if (begins !== 1 || ends !== 1 || body.trim().length < 100) {
            bad.push(`${r.file}: ${begins} begin / ${ends} end / ${body.trim().length} chars`);
        }
    }
    check(bad.length === 0,
        `⛓⛓ the ${MD_REGIONS.length} markdown GENERATED REGIONS are present, with exactly one `
        + 'marker pair each and a non-empty body',
        bad.length ? bad.join(' | ') : MD_REGIONS.map((r) => r.table).join(' · '));
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

    /**
     * ⛔⛔ **A SECTION WITH NO ROWS MUST STILL SAY SOMETHING** (PROCGEN DOCS ·
     * P5). Every finding these six scans had is fixed, so `findings` renders 0
     * rows — and a heading + blurb + nothing is indistinguishable from a
     * section that failed to build. The row COUNT cannot see the difference (it
     * is 0 either way), which is P3b's empty-`<h2>` lesson one turn on, so the
     * claim is about the TEXT.
     */
    const emptyNote = await page.evaluate(() => {
        const el = document.getElementById('no-findings');
        return el ? el.textContent.trim() : null;
    });
    if (ALL_FINDINGS.length === 0) {
        check(typeof emptyNote === 'string' && emptyNote.length > 80
            && /No findings/.test(emptyNote),
        '⛓⛓ …and the EMPTY findings section says so IN WORDS, not by being blank',
        (emptyNote ?? '(absent)').slice(0, 90));
    } else {
        check(emptyNote === null,
            '⛓ …and the empty-findings note is ABSENT while there are findings',
            `${ALL_FINDINGS.length} findings, note ${emptyNote === null ? 'absent' : 'PRESENT'}`);
    }

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
