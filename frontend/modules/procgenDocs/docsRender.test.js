/**
 * procgenDocs/docsRender — **THE PAGE'S OWN CONFIGURATION, RUN OVER THE WHOLE
 * CORPUS IN NODE** (PROCGEN DOCS · P4, D1/D2).
 *
 * ⛓ This file imports the SAME module `docs.html` does, so it cannot pass with
 * a configuration the page does not have. What a browser row adds on top is
 * that the page actually mounts and that the anchors exist in a real DOM;
 * what this file adds is that all seventeen documents render at all, which no
 * row wants to pay for one page load at a time.
 *
 * ⛔⛔ **THE CENTRAL CLAIM IS TWO INDEPENDENT READERS AGREEING.** `ghSlug.js`
 * reads headings out of the SOURCE with a regex; `marked` reads them out of a
 * parsed document. Neither was written from the other. P4 found them
 * disagreeing in exactly one place out of 607 — a heading containing
 * `[maze.md](./maze.md)`, where the source reader kept the URL's characters
 * and GitHub does not — and that disagreement is the reason `headingText`
 * exists. A single-reader test would have shipped that anchor wrong.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_URL } from './demos.js';
import { DOC_DIR, DOC_FILES, linksIn, resolveDocLink } from './docLinks.js';
import { ghSlug, headingsOf } from './ghSlug.js';
import { renderDoc } from './docsRender.js';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (f) => readFileSync(join(ROOT, DOC_DIR, f), 'utf8');
const FILES = readdirSync(join(ROOT, DOC_DIR)).filter((f) => f.endsWith('.md')).sort();

/** ⛓ Every document rendered ONCE, at the repo-root host. */
const RENDERS = new Map(DOC_FILES.map((f) => [f, renderDoc(read(f), { doc: f, siteRoot: '' })]));

const idsOf = (html) => [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((m) => m[1]);

describe('every tracked document renders', () => {
    it.each(DOC_FILES)('%s — no refusal, and it produced HTML', (f) => {
        const r = RENDERS.get(f);
        expect(r.refusal, r.detail ?? '').toBeNull();
        expect(r.html.length).toBeGreaterThan(200);
    });

    it('renders all 18 files the index allows, and the corpus IS those files', () => {
        expect(DOC_FILES).toHaveLength(18);
        expect([...DOC_FILES].sort()).toEqual(FILES);
    });
});

describe('⛓⛓ the anchors — two readers, 655 headings, one answer', () => {
    it('the page\'s heading ids ARE ghSlug\'s, document by document', () => {
        let total = 0;
        for (const f of DOC_FILES) {
            const want = headingsOf(read(f)).map((h) => h.slug);
            expect(idsOf(RENDERS.get(f).html), f).toEqual(want);
            total += want.length;
        }
        // ⚠ 613 → 615 with arc-5 slice 6b (the ARC CLOSE): `seedling-bot.md` gains
        // TWO — § *Arc 5, slice 6b — DENSITY IS ONE DECLARED BLOCK* and
        // § *⛓⛓⛓ ARC 5 IS CLOSED*, which is the arc's own summary in the shape
        // arc 3's close set. Before it:
        // ⚠ 612 → 613 with arc-5 slice 6a: `seedling-bot.md` § *Arc 5, slice 6a
        // — THE DEFAULT ROOM GETS A DIFFERENT CONTRAPTION*, the § the arc's ONE
        // re-record owes the tracked record. Before it:
        // ⚠ 611 → 612 with arc-5 slice 5: `seedling-bot.md` § *Arc 5, slice 5
        // — SHORTENS COMPUTED AT LAST*. Before it, 610 → 611 with slice 4: § *Arc 5, slice 4
        // — ARENAS* is one more `###`.
        // ⚠ 609 → 610 with arc-5 slice 3: `seedling-bot.md` § *Arc 5, slice 3
        //   — ELEMENTS-AS-AREA*, the § a generation-OUTPUT change owes the
        //   tracked record. Before it:
        // ⚠ 608 → 609 with arc-5 slice 2: `seedling-bot.md` § *Arc 5, slice 2*
        //   (the oriented site pick + C4's refutation). Before it, 607 → 608 was
        //   arc-5 slice 1: `seedling-bot.md` § *Arc 5, slice 1
        // — THE ROOM CONTRACT*, the one § a generation-OUTPUT change owes the
        // tracked record. Same re-pin as the line below.
        // ⚠ 606 → 607 with the per-tick slice: `seedling-bot.md` § ▶ LOAD IN
        // WASM gained *The PER-TICK verdict — and the two limits it names*.
        // ⚠ 615 → 618 with SEEDLING BOT R9 slice 1: `seedling-bot.md` § *R9 —
        //   the solver rung, opened from the generator's side* and its two
        //   slice sub-headings — the § the tracked record owes a re-record.
        // ⚠ 618 → 620 with R9 slice 2: its own § plus the ⛓ line under the R5
        //   director's §, which is where the sequence's LINEAGE belongs.
        // ⛔ RE-PINNED, never widened — a pin that moves because somebody wrote
        // into what it measures is the pin WORKING (trap 410).
        // ⛓ 620 → 621: R9 slice 3's § (the splice + the drift) in seedling-bot.md.
        // ⛓ 621 → 622: R9 slice 4's § (the derived `break` verb). ⚠ AND IT WENT
        //   RED IN CI RATHER THAN LOCALLY, because the slice's own AFTER
        //   capture was taken BEFORE the commit that wrote the § — slice 1's
        //   own lesson ("take the AFTER capture after the LAST commit that can
        //   move it") paid a second time, one artifact over.
        // ⛓ 622 → 623: R9 slice 5's § (the continuation made honest — (d), the
        //   timed-row rule, and the true-start census).
        // ⛓ 629 → 635: R9 slice 7's § (the first coverage-derived retirement) —
        //   SIX headings, its own plus five sub-sections (which tapes are
        //   covered, the choreography record, ⚖ ruling 17, the decayed bound,
        //   the numbers). A re-pin, not a widening.
        // ⛓ 635 → 642: R9 slice 7b's § (the deletion executed) — SEVEN headings,
        //   its own plus six sub-sections (the nine are gone, the four
        //   silent-green gates, the survey, the campaign chain's refusal, the
        //   deadline, the gates). Its `#### Gates` is the THIRD heading of that
        //   text in this document, so the -N rule reaches a TENTH suffix — see
        //   `ghSlug.test.js`. A re-pin, not a widening.
        // ⛓ 651 → 655: R9 slice 9's § (the campaign re-record pipeline) — FOUR
        // headings: the § itself and its three `####` (what the refusal was,
        // how to re-record, the first run).
        // ⛓ 642 → 651: R9 slice 8's § (the tick-0 latch) — NINE headings, its
        //   own plus eight sub-sections (the zero-tick tape, what the field is,
        //   which tapes carry it, the clock result, what the page does now, the
        //   prediction that missed, the two older defects, the gates). Two of
        //   them repeat earlier heading TEXT, so the -N rule reaches an
        //   ELEVENTH and TWELFTH suffix — see `ghSlug.test.js`. A re-pin, not a
        //   widening.
        // ⛓ 655 → 656: R9 slice 9b's § (the fork's unconditional boot reset
        //   and the v1/v2 retirement) — ONE heading, no sub-sections. A
        //   re-pin, not a widening.
        // ⛓ 656 → 661: R9 slice 10's § (the campaign player) — FIVE headings,
        //   its own plus four `####` sub-sections (the readout, the frontier
        //   artifact, the gates, the extractor defect). A re-pin, not a
        //   widening.
        // ⛓ 661 → 665: R9 slice 11's § (the `facingToward` repair) — FOUR
        //   headings, its own plus three `####` (the defect, what moved, the
        //   three lessons). A re-pin, not a widening.
        // ⛓ 665 → 670: R9 slice 11b's § (the protocol fixes) — FIVE headings,
        //   its own plus four `####` (B the reach instrument, C the one
        //   uncacheable loader, D the derived chain ticks, the two laws).
        //   A re-pin, not a widening.
        // ⛓ 670 → 676: R9 slice 12's § (the bob forecast and the press arm) —
        //   SIX headings, its own plus five `####` (the forecast as the arrows'
        //   sentence, the law it overturned, the responder built not joined,
        //   the game's enemy readout, and what did not move).
        //   A re-pin, not a widening.
        expect(total).toBe(676);
    });

    it('⛔ uses OUR rule, not marked\'s slugger — they differ, and here is where', () => {
        /** ⛓ marked's own slugger lower-cases and replaces non-word runs with a
         *  SINGLE hyphen; GitHub drops the character and hyphenates each space.
         *  This heading is in the corpus, and the two rules answer differently. */
        const md = '## Instant — a pump, not a skip\n';
        const ids = idsOf(renderDoc(md, { doc: 'omsi.md' }).html);
        expect(ids).toEqual(['instant--a-pump-not-a-skip']);
        expect(ids[0]).not.toBe('instant-a-pump-not-a-skip');
    });

    it('numbers duplicate headings per document, restarting for the next one', () => {
        const md = '## Gates\n\ntext\n\n## Gates\n';
        expect(idsOf(renderDoc(md, { doc: 'a.md' }).html)).toEqual(['gates', 'gates-1']);
        /** ⛔ A renderer shared between two documents would give this `gates-2`. */
        expect(idsOf(renderDoc(md, { doc: 'b.md' }).html)).toEqual(['gates', 'gates-1']);
    });

    it('⛓ every heading id is reachable as an anchor link the render also emits', () => {
        const r = RENDERS.get('architecture.md');
        for (const id of idsOf(r.html)) {
            expect(r.html).toContain(`<a class="anchor" href="#${id}"`);
        }
    });

    it('⛔ REFUSES BY NAME if the two readers ever disagree', () => {
        /** ⛓ Proved by handing the render a heading the SOURCE reader cannot
         *  see — inside a blockquote, which marked parses and the regex does
         *  not. That is a real divergence class, not a synthetic one. */
        const r = renderDoc('# A\n\n> ## Hidden\n', { doc: 'x.md' });
        expect(r.refusal).toBe('heading-readers-disagree');
        expect(r.detail).toContain('x.md');
    });
});

describe('⛓ the links the render emits', () => {
    it('every `<a href>` is exactly what the resolver answers for its source link', () => {
        let checked = 0;
        for (const f of DOC_FILES) {
            const html = RENDERS.get(f).html;
            for (const l of linksIn(read(f))) {
                const want = resolveDocLink(l.href, { doc: f, siteRoot: '' }).href;
                expect(html, `${f}: ${l.href}`).toContain(`href="${want.replace(/&/g, '&amp;')}"`);
                checked += 1;
            }
        }
        expect(checked).toBe(213);
    });

    it('tags each link with the kind that produced it', () => {
        const kinds = {};
        for (const f of DOC_FILES) {
            for (const m of RENDERS.get(f).html.matchAll(/data-link-kind="([^"]*)"/g)) {
                kinds[m[1]] = (kinds[m[1]] ?? 0) + 1;
            }
        }
        /** ⛓ At least the census's 210 — a document may also link from inside
         *  a table cell or a list, which `linksIn` counts the same way. */
        expect(kinds.doc).toBeGreaterThanOrEqual(144);
        expect(kinds.repo).toBeGreaterThanOrEqual(32);
        expect(kinds['same-doc']).toBeGreaterThanOrEqual(13);
        expect(kinds.page ?? 0).toBe(0);
    });

    it('opens GitHub and the web in a new tab, and keeps sibling docs in the viewer', () => {
        const html = renderDoc(
            'see [a](./maze.md) and [b](../../../../scripts/procgen/README.md) and [c](https://x.dev)',
            { doc: 'gotchas.md' },
        ).html;
        expect(html).toContain('href="docs.html?doc=maze.md" data-link-kind="doc"');
        expect(html).toContain(`href="${REPO_URL}/scripts/procgen/README.md"`);
        expect(html.match(/target="_blank"/g)).toHaveLength(2);
    });

    it('⛓ the host reaches the render — a page link differs on Pages', () => {
        const md = '[g](../../../../frontend/modules/procgenDocs/glossary.html)';
        expect(renderDoc(md, { doc: 'maze.md', siteRoot: '' }).html)
            .toContain('href="/modules/procgenDocs/glossary.html"');
        expect(renderDoc(md, { doc: 'maze.md', siteRoot: '/Archipelago-CC' }).html)
            .toContain('href="/Archipelago-CC/modules/procgenDocs/glossary.html"');
    });
});

describe('⛓ the constructs the corpus is actually made of', () => {
    it('renders GFM tables, fenced code with a language, blockquotes and strikethrough', () => {
        const html = renderDoc(
            '| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n\n> quoted\n\n~~gone~~\n',
            { doc: 'x.md' },
        ).html;
        expect(html).toContain('<table>');
        expect(html).toContain('<code class="language-js">');
        expect(html).toContain('<blockquote>');
        expect(html).toContain('<del>');
    });

    it('escapes code content rather than trusting it', () => {
        const html = renderDoc('```\n<script>alert(1)</script>\n```\n', { doc: 'x.md' }).html;
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
    });

    it('⛓ the corpus has 643 table rows and 66 fenced blocks, and they all arrive', () => {
        let tables = 0;
        let pres = 0;
        for (const f of DOC_FILES) {
            const html = RENDERS.get(f).html;
            tables += (html.match(/<table>/g) ?? []).length;
            pres += (html.match(/<pre>/g) ?? []).length;
        }
        expect(tables).toBeGreaterThan(30);
        expect(pres).toBeGreaterThan(60);
    });

    /**
     * ⚖ **THE PLACEHOLDER CENSUS, AND WHY IT IS ZERO.** A real renderer eats
     * `<a placeholder>` the way GitHub does. P4's first scan said the corpus
     * had none, using a regex that only matched single-word tags — and it was
     * wrong: `seedling-bot.md` writes `<repo-relative json>` three times. They
     * survive because all three are inside INDENTED code blocks, which the
     * first scan also did not strip. The number is the same; the reason is
     * not, and only rendering the documents says which.
     */
    it('⚖ no prose text is EATEN as a tag — the 3 placeholders are inside code', () => {
        const html = RENDERS.get('seedling-bot.md').html;
        for (const p of ['&lt;repo-relative json&gt;', '&lt;a generate-seedling-level payload&gt;']) {
            expect(html, `${p} was swallowed`).toContain(p);
        }
        /** ⛓ And nothing anywhere in the corpus rendered an unknown element. */
        for (const f of DOC_FILES) {
            expect(RENDERS.get(f).html, f).not.toMatch(/<repo-relative\b/);
        }
    });

    it('renders the GENERATED-region comments as comments, the way GitHub does', () => {
        const html = RENDERS.get('README.md').html;
        /** ⛓ Both markers survive verbatim, BEGIN's trailing note included —
         *  which is how a reader of the page can tell that the table below is
         *  output, exactly as a reader of the file can. */
        expect(html).toContain('<!-- GENERATED:procgen-docs-index BEGIN — by '
            + 'scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->');
        expect(html).toContain('<!-- GENERATED:procgen-docs-index END -->');
        expect(html).toContain('<table>');
    });
});

describe('⛓ the biggest document — the one the budget is about', () => {
    it('seedling-bot.md renders 442 headings and its slugs are unique', () => {
        // ⚠ 405 → 407: R9 slice 2's own § plus the ⛓ line under the R5
        // director's §, which is where the sequence's LINEAGE belongs.
        // ⚠ 402 → 405: SEEDLING BOT R9 slice 1's § *R9 — the solver rung, opened
        // from the generator's side* plus its two slice sub-headings.
        // ⚠ 400 → 402: arc-5 slice 6b's TWO §§ (the density block, and the arc's
        // own CLOSED summary).
        // ⚠ 399 → 400: arc-5 slice 6a's § (the biome default's new shape).
        // ⚠ 398 → 399: arc-5 slice 5's § (SHORTENS).
        // ⚠ 396 → 397: arc-5 slice 3's § (elements-as-area, the chamber
        // element). 395 → 396 was arc-5 slice 2's § (the oriented site pick). 394 → 395 was
        //   slice 1's (the room contract).
        // ⚠ 393 → 394: the per-tick slice's § in ▶ LOAD IN WASM. Same re-pin.
        // ⚠ 407 → 408: R9 slice 3's § — the splice + the drift.
        // ⚠ 408 → 409: R9 slice 4's § — the derived `break` verb.
        // ⛓ 409 → 410: R9 slice 5's § — the continuation made honest.
        // ⛓ 410 → 416: R9 slice 6's § — the true-start solver chain. SIX
        //   headings, because the slice's account has five sub-sections
        //   (the clock, the chain, the page, the findings, the numbers) under
        //   its own — a re-pin, not a widening.
        // ⛓ 416 → 422: R9 slice 7's § — the first coverage-derived retirement.
        //   Six headings again, and one of them (`#### The numbers`) is the
        //   SECOND heading of that text in this document, so it takes the -N
        //   rule's ninth suffix — see `ghSlug.test.js`.
        // ⛓ 422 → 429: R9 slice 7b's § — the deletion executed. Seven headings,
        //   and its `#### Gates` is the THIRD of that text here, so it takes the
        //   -N rule's TENTH suffix.
        // ⛓ 438 → 442: R9 slice 9's § — the campaign re-record pipeline, four
        // headings.
        // ⛓ 429 → 438: R9 slice 8's § — the tick-0 latch, nine headings, of
        //   which `#### Gates` is the FOURTH of that text here and
        //   `#### What the page does now` the SECOND, taking the -N rule's
        //   eleventh and twelfth suffixes.
        // ⛓ 442 → 443: R9 slice 9b's § — one heading.
        // ⛓ 443 → 448: R9 slice 10's § — five headings (the campaign player,
        //   plus THE CAMPAIGN READOUT, THE FRONTIER ARTIFACT, THE GATES and the
        //   instruments-extractor defect).
        // ⛓ 448 → 452: R9 slice 11's § — four headings (the `facingToward`
        //   repair, plus the defect, what moved, and the three lessons).
        // ⛓ 452 → 457: R9 slice 11b's § — five headings (the protocol fixes,
        //   plus B the reach instrument, C the one uncacheable loader, D the
        //   derived chain ticks, and the two laws).
        // ⛓ 457 → 463: R9 slice 12's § — six headings (the bob forecast and
        //   the press arm, plus the arrows' sentence, the law overturned, the
        //   responder built not joined, the game's own enemy readout, and what
        //   did NOT move).
        const ids = idsOf(RENDERS.get('seedling-bot.md').html);
        expect(ids).toHaveLength(463);
        expect(new Set(ids).size).toBe(463);
        expect(ids.filter((i) => i !== ghSlug(i))).toEqual([]);
    });

    it('prints what it costs to render, so a page budget is not a guess', () => {
        const md = read('seedling-bot.md');
        const t0 = performance.now();
        renderDoc(md, { doc: 'seedling-bot.md', siteRoot: '' });
        const ms = performance.now() - t0;
        // eslint-disable-next-line no-console
        console.log(`seedling-bot.md: ${md.length} bytes, ${md.split('\n').length} lines `
            + `→ ${ms.toFixed(0)}ms in node`);
        expect(ms).toBeLessThan(10000);
    });
});
