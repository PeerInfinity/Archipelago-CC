/**
 * procgenDocs/docsRender.js — **THE ONE `marked` CONFIGURATION** (PROCGEN DOCS
 * · P4, D1).
 *
 * ⛓ `docs.html` renders the seventeen tracked documents under
 * `docs/json/developer/procgen/`, and `docsRender.test.js` renders the same
 * files in node to check the anchors and the links. ⛔ They import THIS
 * module rather than each configuring `marked` themselves — a row that passes
 * with a different configuration than the page is a row about nothing.
 *
 * ── ⛔⛔ WHY THERE ARE TWO MARKDOWN RENDERERS IN THIS DIRECTORY ────────
 *
 * `markdownLite.js` is the other one, and it is NOT this one's predecessor.
 * They exist at two different TRUST LEVELS:
 *
 *   `markdownLite.js`  renders strings out of `demos.js` and `glossary.js`.
 *                      Its law is that THE DATA HOLDS STRINGS, NEVER HTML:
 *                      everything is escaped and exactly six forms are then
 *                      un-escaped into markup, so an entry cannot inject a
 *                      tag. That law is what makes those catalogues safe to
 *                      grow, and it is why it renders a SUBSET on purpose.
 *
 *   `docsRender.js`    renders tracked `.md` FILES — source files, reviewed in
 *                      diffs like code, whose HTML is trusted the same way
 *                      GitHub trusts it. They use tables, nested lists,
 *                      blockquotes, 643 table rows and 66 fenced blocks; a
 *                      six-form subset would render them as soup.
 *
 * ⛔ Neither is a candidate to replace the other, and `markdownLite.js` was
 * NOT rewritten for this slice.
 *
 * ── THE FOUR HOOKS ────────────────────────────────────────────────────
 *
 *  heading  the `id` is `ghSlug`'s, with GitHub's `-N` for duplicates.
 *           ⛔ NOT marked's own slugger, which uses a different rule: 600
 *           quietly-wrong anchors is what that costs, and nobody would find
 *           out except one dead click at a time.
 *  link     `resolveDocLink` — the sibling docs to this viewer, the pages to
 *           the live pages, everything else in the repo to GitHub.
 *  image    the SAME resolver. ⚖ The corpus has zero images; the hook exists
 *           so the first one does not render a broken `../..` src.
 *  code     escaped, with GitHub's `language-x` class.
 *
 * ⛓ `headerIds: false` — marked must not write its own, or every heading
 * would carry two competing answers and the last one would win.
 */

import { marked } from '../../libs/marked/marked.esm.js';

import { resolveDocLink } from './docLinks.js';
import { ghSlug, ghSlugs, headingsOf } from './ghSlug.js';

/** ⛓ marked escapes into text; this is for our own attribute values. */
const attr = (s) => String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[c]));

const escText = (s) => String(s).replace(/[&<>]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
}[c]));

/** ⛓ The options every render uses. `gfm` for the tables the docs are full of. */
export const MARKED_OPTIONS = Object.freeze({
    gfm: true,
    headerIds: false,
    mangle: false,
});

/**
 * ⛓ A renderer bound to ONE document on ONE host. Fresh per render, because
 * the duplicate-heading counter is per document: sharing one across two
 * renders would make the second document's first `## Gates` into `gates-1`.
 */
export function makeRenderer({ doc, siteRoot = '' } = {}) {
    const renderer = new marked.Renderer();
    const seen = new Map();
    /** ⛓ Every heading this render emitted, for the page's TOC — taken from
     *  the render itself rather than from a second pass over the source. */
    const headings = [];

    renderer.heading = (text, level, raw) => {
        const base = ghSlug(raw);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const slug = n ? `${base}-${n}` : base;
        headings.push({ level, text, raw, slug });
        return `<h${level} id="${attr(slug)}">`
            + `<a class="anchor" href="#${attr(slug)}" aria-hidden="true">#</a>${text}</h${level}>\n`;
    };

    renderer.link = (href, title, text) => {
        const r = resolveDocLink(href, { doc, siteRoot });
        const t = title ? ` title="${attr(title)}"` : '';
        /** ⛓ Only an OUTBOUND link gets the new-tab treatment; a link to
         *  another tracked doc keeps the reader in the viewer. */
        const out = r.kind === 'external' || r.kind === 'repo'
            ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${attr(r.href)}"${t}${out} data-link-kind="${attr(r.kind)}">${text}</a>`;
    };

    renderer.image = (href, title, text) => {
        const r = resolveDocLink(href, { doc, siteRoot });
        const t = title ? ` title="${attr(title)}"` : '';
        return `<img src="${attr(r.href)}" alt="${attr(text ?? '')}"${t}>`;
    };

    renderer.code = (code, infostring, escaped) => {
        const lang = String(infostring ?? '').match(/\S*/)[0];
        const body = escaped ? code : escText(code);
        return lang
            ? `<pre><code class="language-${attr(lang)}">${body}\n</code></pre>\n`
            : `<pre><code>${body}\n</code></pre>\n`;
    };

    return { renderer, headings };
}

/**
 * ⛓ THE RENDER. Returns the HTML and the headings it emitted.
 *
 * ⛔⛔ **THE TWO HEADING READERS ARE CHECKED AGAINST EACH OTHER, HERE, AT RUN
 * TIME.** `headingsOf` reads the SOURCE and `marked` reads the parsed
 * document; P4 measured them agreeing on all 600 headings of the corpus, and
 * the disagreement it found on the way was real — a heading containing a
 * markdown link slugged differently until `headingText` was added. If they
 * ever diverge again the page REFUSES BY NAME instead of rendering anchors
 * that no fragment in the corpus points at.
 */
export function renderDoc(markdown, { doc, siteRoot = '' } = {}) {
    const { renderer, headings } = makeRenderer({ doc, siteRoot });
    const html = marked.parse(String(markdown), { ...MARKED_OPTIONS, renderer });

    const fromSource = headingsOf(markdown).map((h) => h.slug);
    const fromRender = headings.map((h) => h.slug);
    const agree = fromSource.length === fromRender.length
        && fromSource.every((s, i) => s === fromRender[i]);

    return {
        html,
        headings,
        /** ⛓ A refusal NAME, not a thrown string: the page prints it where the
         *  article would have been, so a reader can tell a refused render from
         *  an empty document (trap 403). */
        refusal: agree ? null : 'heading-readers-disagree',
        detail: agree ? null
            : `${doc}: source reader saw ${fromSource.length} headings, the render saw `
                + `${fromRender.length}; first disagreement at `
                + `${fromSource.findIndex((s, i) => s !== fromRender[i])}`,
    };
}

export { ghSlugs };
