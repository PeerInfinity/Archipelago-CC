/**
 * reference/docsIndex — **TABLE 6: THE PROCGEN DOCUMENTATION INDEX, ASKED OF
 * THE DIRECTORY** (PROCGEN DOCS · P3b).
 *
 * ⛓ ONE ROW PER `docs/json/developer/procgen/*.md` (README itself excepted —
 * it is the file the index goes IN), plus one per page under
 * `frontend/modules/procgenDocs/*.html`, because three of README's rows point
 * at a PAGE rather than at a `.md` and dropping them would be a table that
 * quietly stopped covering its subject.
 *
 *   the H1          the document's own title line
 *   the DESCRIPTION the document's own first paragraph
 *   the WORD COUNT  how much there is of it
 *
 * ⛔⛔ **A DOC'S OWN OPENING IS WHERE ITS SUMMARY BELONGS.** The descriptions
 * this table replaced were hand-written in README and were, in four places,
 * better than the document's own first paragraph — and in one place the
 * README row was RIGHT where the document was STALE. The fix for that is not a
 * hand-kept column here; it is a better opening paragraph in the document, and
 * P3b wrote four of them (`architecture.md`, `substrate-registry.md`,
 * `jta.md`, `seedling-bot.md`). Anything a reader needs in an index entry, the
 * document should be saying about itself on line 3.
 *
 * ── ⛓ THE ORDER IS DECLARED, AND THAT IS THE POINT ────────────────────
 *
 * `README_ORDER` is today's README order, which is a reading order somebody
 * chose (orientation first, then the registry, then the substrates). ⛔ A file
 * on disk that is NOT in that list is a HARD ERROR here rather than a row
 * appended quietly at the end: a new document must be placed in the reading
 * order deliberately, and this is the gate that makes somebody do it.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { REPO, firstSentence, src } from './lib.mjs';
import { M } from './sources.mjs';

export const DOC_DIR = 'docs/json/developer/procgen';
export const PAGE_DIR = 'frontend/modules/procgenDocs';

/** ⛓ THE FILE THE INDEX GOES IN — and the region it goes in. */
export const INDEX_DOC = `${DOC_DIR}/README.md`;

/**
 * ⛓⛓ TODAY'S README ORDER — declared, and CHECKED both ways: a file listed
 * here that is not on disk and a file on disk that is not listed here are each
 * a hard error.
 */
export const README_ORDER = Object.freeze([
    'architecture.md',
    'substrate-registry.md',
    'demos.md',
    'gotchas.md',
    'bounce.md',
    'runner.md',
    'playback-and-debugging.md',
    'loop-recording.md',
    'maze.md',
    'sphere-growth.md',
    'paths-and-obstacles.md',
    'stepped-pipeline.md',
    'text-adventure.md',
    'seedling-bot.md',
    'flash.md',
    'jta.md',
    'omsi.md',
]);

/** ⛓ The published home of a `procgenDocs` page — the ONE spelling of the
 *  Pages base this tree uses, from the demo catalogue module. */
const PAGES_BASE = 'https://peerinfinity.github.io/Archipelago-CC';

/**
 * ⛓ THE DESCRIPTION RULE, said out loud: the document's FIRST PARAGRAPH,
 * collapsed onto one line. If that runs past 400 characters it is cut to its
 * first SENTENCE, and if the sentence is still longer it is truncated with an
 * ellipsis. ⛔ Never a hand-written summary: a description a human keeps here
 * is a description that disagrees with the document it describes.
 */
export const DESCRIPTION_LIMIT = 400;

export function descriptionOf(text) {
    const body = text.split('\n').slice(1).join('\n');
    const para = (body.split(/\n\s*\n/).find((p) => p.trim() && !/^[#>|]/.test(p.trim())) ?? '')
        .replace(/\s+/g, ' ').trim();
    if (para.length <= DESCRIPTION_LIMIT) return para;
    return firstSentence(para, { limit: DESCRIPTION_LIMIT });
}

const words = (text) => text.split(/\s+/).filter(Boolean).length;

/** ⛓ A page's own `<title>`, `<h1>` and the first sentence of its leading HTML
 *  comment — the same three facts, read out of the other kind of file. */
function pageRow(file) {
    const text = src(`${PAGE_DIR}/${file}`);
    const title = (/<title>([\s\S]*?)<\/title>/.exec(text) ?? [])[1] ?? null;
    const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(text) ?? [])[1] ?? null;
    const comment = (/<!--([\s\S]*?)-->/.exec(text) ?? [])[1] ?? '';
    return {
        file,
        path: `${PAGE_DIR}/${file}`,
        url: `${PAGES_BASE}/modules/procgenDocs/${file}`,
        title: title ? title.replace(/\s+/g, ' ').trim() : null,
        h1: h1 ? h1.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null,
        description: firstSentence(comment.split('\n')
            .map((l) => l.replace(/^\s{0,2}/, '')).join('\n').trim()),
    };
}

/** ⛓ The glossary terms this table is about — declared, and CHECKED. */
export const DOCS_TERMS = Object.freeze(['lab-page', 'demo-catalogue']);

export function buildDocsIndex() {
    for (const t of DOCS_TERMS) {
        if (!M.glossary.termById(t)) {
            throw new Error(`generate-procgen-reference: DOCS_TERMS names ${JSON.stringify(t)}`
                + ', which the GLOSSARY does not define');
        }
    }
    const onDisk = readdirSync(join(REPO, DOC_DIR))
        .filter((f) => f.endsWith('.md') && f !== 'README.md').sort();

    const unordered = onDisk.filter((f) => !README_ORDER.includes(f));
    if (unordered.length) {
        throw new Error('generate-procgen-reference: '
            + `${unordered.join(', ')} ${unordered.length === 1 ? 'is' : 'are'} in `
            + `${DOC_DIR}/ and NOT in README_ORDER (scripts/procgen/reference/docsIndex.mjs). `
            + '⛔ A new document must be placed in the reading order deliberately — add it '
            + 'where it belongs and regenerate.');
    }
    const gone = README_ORDER.filter((f) => !onDisk.includes(f));
    if (gone.length) {
        throw new Error('generate-procgen-reference: '
            + `README_ORDER names ${gone.join(', ')}, which ${gone.length === 1 ? 'is' : 'are'} `
            + `not in ${DOC_DIR}/. ⛔ Remove the name, or restore the file.`);
    }

    const docs = README_ORDER.map((file) => {
        /**
         * ⛓⛓ THE DOCUMENT AS ITS AUTHORS WROTE IT — every GENERATED REGION is
         * cut out first. ⛔ Two of these documents CARRY a generated region, so
         * counting their words with it included would make this table depend
         * on a table written later in the same run: `--check` would red once
         * after every regeneration and go green on the second. A word count
         * that moves because a generator ran is not a fact about the document.
         */
        const text = src(`${DOC_DIR}/${file}`)
            .replace(/<!-- GENERATED:[\s\S]*?END -->/g, '');
        const h1 = (/^#\s+(.+)$/m.exec(text) ?? [])[1] ?? null;
        return {
            file,
            path: `${DOC_DIR}/${file}`,
            h1: h1 ? h1.trim() : null,
            description: descriptionOf(text),
            words: words(text),
            lines: text.split('\n').length,
            /** ⛓ Which other procgen docs it links to — the shape of the
             *  section, measured rather than asserted. */
            links: [...new Set([...text.matchAll(/\]\(\.\/([a-z-]+\.md)/g)].map((m) => m[1]))]
                .filter((f) => onDisk.includes(f)).sort(),
        };
    });

    const pages = readdirSync(join(REPO, PAGE_DIR)).filter((f) => f.endsWith('.html')).sort()
        .map(pageRow);

    return {
        terms: [...DOCS_TERMS].sort(),
        dir: DOC_DIR,
        pageDir: PAGE_DIR,
        indexIn: INDEX_DOC,
        docs,
        pages,
        counts: {
            docs: docs.length,
            pages: pages.length,
            words: docs.reduce((a, d) => a + d.words, 0),
            lines: docs.reduce((a, d) => a + d.lines, 0),
        },
        orderRule: '`README_ORDER` in `scripts/procgen/reference/docsIndex.mjs` — today\'s '
            + 'reading order, declared. A file in the directory that is not in that list is a '
            + 'HARD ERROR, so a new document cannot arrive unindexed.',
        descriptionRule: 'the document\'s OWN first paragraph, collapsed onto one line; past '
            + `${DESCRIPTION_LIMIT} characters it is cut to its first sentence. ⛔ Never a `
            + 'hand-written summary — if an entry reads thin, the fix is a better opening '
            + 'paragraph in the document.',
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE MARKDOWN REGION — the whole of README's index table
 * ══════════════════════════════════════════════════════════════════════ */

const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|');

export function docsIndexMarkdown(v) {
    const out = [
        `**${v.counts.docs} documents · ${v.counts.pages} pages · `
        + `${v.counts.words.toLocaleString('en-US')} words.**`,
        '',
        `Order: ${v.orderRule}`,
        '',
        `Descriptions: ${v.descriptionRule}`,
        '',
        '| Document | Description | Words |',
        '|---|---|---|',
    ];
    for (const d of v.docs) {
        out.push(`| [${mdCell(d.h1)}](./${d.file}) | ${mdCell(d.description)} | ${d.words} |`);
    }
    out.push('',
        '**The three pages.** These are not `.md` files: they render a DATA module in a '
        + 'browser, and only `frontend/` is published to Pages.',
        '',
        '| Page | What it renders |', '|---|---|');
    for (const p of v.pages) {
        out.push(`| [${mdCell(p.title ?? p.file)}](${p.url}) | ${mdCell(p.description)} |`);
    }
    return out.join('\n');
}
