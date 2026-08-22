/**
 * procgenDocs/ghSlug — **THE ANCHOR RULE, AND THE HONEST LIMIT OF THE EVIDENCE
 * FOR IT** (PROCGEN DOCS · P4, D2).
 *
 * ⛔⛔ **THE SIX-LINK PIN IS NOT HERE, AND THAT IS DELIBERATE.** It is in
 * `glossary.test.js`, where P2 wrote it against links other people had already
 * put in the tracked docs. Copying it here would double the appearance of
 * evidence without adding any. This file tests the parts that pin does not
 * reach: duplicate suffixes, the heading reader, and — the point of the whole
 * file — the measurement that says how much of this rule the repo can actually
 * check.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ghSlug, ghSlugs, headingText, headingsOf } from './ghSlug.js';

const ROOT = new URL('../../../', import.meta.url).pathname;
const DIR = 'docs/json/developer/procgen';
const FILES = readdirSync(join(ROOT, DIR)).filter((f) => f.endsWith('.md')).sort();
const read = (f) => readFileSync(join(ROOT, DIR, f), 'utf8');

describe('ghSlug — the base rule', () => {
    it('drops what is not a letter, number, space, hyphen or underscore', () => {
        expect(ghSlug('The capture contract: coarse-only vs. fine-grained vs. summary substrates'))
            .toBe('the-capture-contract-coarse-only-vs-fine-grained-vs-summary-substrates');
        expect(ghSlug('⚖ What a URL is FOR')).toBe('-what-a-url-is-for');
        expect(ghSlug('`?areas=` — the area partition')).toBe('areas--the-area-partition');
    });

    it('keeps underscores and digits, and lower-cases', () => {
        expect(ghSlug('`autoRestartQueue` and MAX_TICKS')).toBe('autorestartqueue-and-max_ticks');
        expect(ghSlug('Arc D2, slice 2b')).toBe('arc-d2-slice-2b');
    });
});

describe('ghSlugs — GitHub\'s duplicate suffixes', () => {
    it('gives the first the bare slug and numbers the rest in document order', () => {
        expect(ghSlugs(['Gates', 'Reproduce', 'Gates', 'Gates']))
            .toEqual(['gates', 'reproduce', 'gates-1', 'gates-2']);
    });

    it('counts collisions AFTER slugging, not before', () => {
        /** Two different headings that slug the same still collide. */
        expect(ghSlugs(['The gates', 'The — gates'])).toEqual(['the-gates', 'the--gates']);
        expect(ghSlugs(['The gates!', 'The gates?'])).toEqual(['the-gates', 'the-gates-1']);
    });
});

describe('headingsOf — the ONE heading reader', () => {
    it('reads level, text and slug in document order', () => {
        expect(headingsOf('# A\n\ntext\n\n## B c\n\n#### D')).toEqual([
            { level: 1, text: 'A', slug: 'a' },
            { level: 2, text: 'B c', slug: 'b-c' },
            { level: 4, text: 'D', slug: 'd' },
        ]);
    });

    it('⛔ SKIPS fenced blocks — a `# comment` in one is not a heading', () => {
        const md = '# Real\n\n```bash\n# not a heading\n## also not\n```\n\n## Also real';
        expect(headingsOf(md).map((h) => h.text)).toEqual(['Real', 'Also real']);
    });

    it('⛔ a heading swallowed by a fence would SHIFT every later suffix', () => {
        /** ⛓ This is why the fence rule is not cosmetic: counting the fenced
         *  `## Gates` would make the real second one `gates-2`, and every
         *  anchor after it in that document would move. */
        const md = '## Gates\n\n```\n## Gates\n```\n\n## Gates';
        expect(headingsOf(md).map((h) => h.slug)).toEqual(['gates', 'gates-1']);
    });
});

describe('the corpus — what this repo can and cannot check', () => {
    it('slugs every heading of every tracked document without collision', () => {
        for (const f of FILES) {
            const slugs = headingsOf(read(f)).map((h) => h.slug);
            expect(new Set(slugs).size, `${f}: duplicate slugs survived the -N rule`)
                .toBe(slugs.length);
        }
    });

    /**
     * ⚖⚖ **THE `-N` HALF OF THE RULE IS UNPINNED, AND THIS TEST SAYS SO
     * RATHER THAN IMPLYING OTHERWISE.** Six headings in `seedling-bot.md`
     * collide, so the suffixes are REACHED — but no tracked link targets one,
     * which means no in-repo evidence tells us whether GitHub really answers
     * `#gates-1`. If a future slice writes such a link, this test starts
     * failing and the suffix rule gains its first real pin. That is the
     * intended outcome, not a regression.
     */
    it('⚖ reaches the -N rule (9 suffixed slugs, all in seedling-bot.md) but nothing LINKS to one', () => {
        /** ⛔ A SUFFIXED SLUG IS FOUND STRUCTURALLY, NOT BY `/-\d+$/`. This
         *  corpus is full of headings that END in a date — `…-2026-08-16`
         *  slugs to something ending `-16` — and a regex says eighty of them
         *  are duplicates. The only honest test is "did `ghSlugs` give this
         *  heading something other than its own bare slug". */
        const collisions = [];
        for (const f of FILES) {
            for (const h of headingsOf(read(f))) {
                /** ⛔ The base is `ghSlug(headingText(...))`, NOT `ghSlug(text)`.
                 *  The slug path reduces an inline link to its text, so
                 *  comparing against the unreduced source calls the one heading
                 *  containing `[maze.md](./maze.md)` a duplicate. Second time
                 *  this detection has been wrong in the same way: the base must
                 *  be spelled exactly as the slug path spells it. */
                if (h.slug !== ghSlug(headingText(h.text))) collisions.push(h.slug);
            }
        }
        expect(collisions.length).toBeGreaterThan(0);
        expect(collisions).toEqual([
            'where-the-ceremonies-stand-1',
            'where-the-rung-stands-1',
            'where-the-rung-stands-2',
            'the-acceptance-1',
            'the-acceptance-2',
            'gates-1',
            'the-three-findings-worth-carrying-off-the-arc-1',
            'where-the-arcs-own-findings-live-1',
            // ⛓ R9 slice 7: its `#### The numbers` is the second heading of
            //   that text in this document — slice 6's § has the first. The
            //   suffix rule reaches a NINTH slug and still nothing links to one.
            'the-numbers-1',
            // ⛓ R9 slice 7b: its `#### Gates` is the THIRD heading of that text
            //   in this document — the R8 close has the first, R9 slice 6's §
            //   the second. The suffix rule reaches a TENTH slug and STILL
            //   nothing links to one.
            'gates-2',
        ]);

        /** ⛓ Every fragment any tracked doc links to, same-doc or cross-doc. */
        const targeted = new Set();
        for (const f of FILES) {
            for (const m of read(f).matchAll(/\]\([^)\s]*#([a-z0-9_-]+)\)/g)) targeted.add(m[1]);
        }
        expect(targeted.size).toBeGreaterThan(20);
        const hits = [...targeted].filter((t) => collisions.includes(t));
        expect(hits, 'a link now targets a -N anchor — the suffix rule has evidence; pin it')
            .toEqual([]);
    });
});
