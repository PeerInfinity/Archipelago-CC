/**
 * procgenDocs/markdownLite.js — **THE MARKDOWN SUBSET THE DOC PAGES RENDER,
 * SPELLED ONCE.**
 *
 * ⛓ P1 shipped this inline in `demos.html` and its own as-built named the
 * consequence: *"A glossary link will most likely want a seventh form; it
 * belongs in the same `inline()` and nowhere else."* P2 has TWO pages, so
 * "the same `inline()`" had to become a module — a second copy would be a
 * second answer to *what is a link in this prose?*, and the two pages link to
 * each other.
 *
 * ⛔⛔ **THE DATA HOLDS STRINGS, NEVER HTML.** Everything is escaped first and
 * only these six things are then un-escaped into markup:
 *
 *     ```fenced blocks```   `code`   **bold**   *italic*
 *     [text](url)           <url>                (blank-line paragraphs)
 *
 * A doc cannot inject a tag. ⛓ **No seventh form was needed for the
 * glossary**: a cross-reference is written `[the door law](#door-law)` and the
 * existing `[text](url)` form renders it, so the anchor lives in the DATA
 * where a reader of the diff can see where it points.
 *
 * ⛔ **THE CODE-SPAN PLACEHOLDER IS NUL-DELIMITED, and it must stay that
 * way.** P1's first cut used a ` 3 `-style placeholder and it ate the bare
 * numbers this prose is full of ("arc 3, slice 1", "19 ground cells") — found
 * by READING the render, not by a test.
 *
 * ⛔⛔ **THIS IS NOT THE RENDERER `docs.html` USES, AND IT IS NOT ITS
 * PREDECESSOR.** P4 added `docsRender.js`, a full `marked` configuration, for
 * the tracked `.md` files under `docs/json/developer/procgen/`. The two exist
 * at two TRUST LEVELS, and that is the whole distinction: this module renders
 * strings held in `demos.js` and `glossary.js`, where the law above means an
 * entry cannot inject a tag no matter who writes it; `docsRender.js` renders
 * SOURCE FILES reviewed in diffs like code, whose HTML is trusted the way
 * GitHub trusts it — and which use tables, nested lists and blockquotes that a
 * six-form subset would render as soup. ⛔ Neither is a candidate to replace
 * the other.
 *
 * ⛔ No DOM and no node imports: this runs on a page and in a unit runner.
 */

export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
}[c]));

/** One line's worth: code spans out first, so a `**` inside one is not bold. */
export function inline(text) {
    const spans = [];
    const held = String(text).replace(/`([^`]+)`/g, (_, c) => {
        spans.push(c);
        return `\u0000${spans.length - 1}\u0000`;
    });
    return esc(held)
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
        .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(spans[Number(i)])}</code>`);
}

/** Blank-line paragraphs; a single newline inside one is a soft wrap. */
export function prose(text) {
    if (!text) return '';
    const out = [];
    for (const chunk of String(text).split(/```/)) {
        if (out.length % 2 === 1) {                     // inside a fence
            out.push(`<pre><code>${esc(chunk.replace(/^\w*\n/, ''))}</code></pre>`);
            continue;
        }
        out.push(chunk.split(/\n\s*\n/).filter((p) => p.trim())
            .map((p) => `<p>${inline(p.replace(/\n/g, ' ').trim())}</p>`).join(''));
    }
    return out.join('');
}
