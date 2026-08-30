/**
 * procgenDocs/docLinks.js — **WHERE EVERY LINK IN THE TRACKED PROCGEN DOCS
 * GOES WHEN A BROWSER RENDERS THEM** (PROCGEN DOCS · P4, D3).
 *
 * ⛓ The seventeen documents under `docs/json/developer/procgen/` were written
 * to be read on GitHub, so their links are repo-relative: `./maze.md`,
 * `../../features/loops.md`, `../../../../scripts/procgen/README.md`. On
 * `docs.html` none of those mean anything — the reader is on a web page whose
 * URL bears no resemblance to a checkout. This module is the ONE function that
 * decides what each one becomes, and `docLinks.test.js` runs it over **every
 * link in the corpus** and pins the per-kind counts.
 *
 * ── THE FIVE ANSWERS ──────────────────────────────────────────────────
 *
 *   `#frag`                 → unchanged. The page renders GitHub's anchors.
 *   a sibling `.md`         → `docs.html?doc=x.md#frag` — stay on the viewer.
 *   a `frontend/**.html`    → `<siteRoot>/modules/…` — a real page, live.
 *   anything else in-repo   → `REPO_URL/<repo path>` — GitHub blob, source.
 *   `http(s)://`            → unchanged.
 *
 * ⛔⛔ **A LINK THAT RESOLVES NOWHERE IS A NAMED FINDING, NEVER A SILENT
 * GITHUB BLOB.** This function is PURE — it cannot read a disk and so cannot
 * know whether `../foo.md` exists. That check is the test's, which walks the
 * corpus against the tree and fails by name. The danger the rule exists to
 * prevent is the comfortable one: every unknown path is a well-formed GitHub
 * URL, so a typo'd link renders as a perfectly clickable 404 and nobody ever
 * looks. P4 measured the corpus and found **two dead fragments and zero dead
 * paths**; both fragments were plain typos and were fixed in the `.md`s.
 *
 * ⛔ **`?doc=` IS ALLOW-LISTED BY THE GENERATED INDEX**, so the page can never
 * be pointed at an arbitrary path. `DOC_FILES` below is derived from
 * `DOCS_INDEX` — the seventeen documents plus the README the index lives in —
 * and `docFileFor()` refuses anything else by name (`doc-not-in-index`).
 *
 * ⛔ No DOM and no node imports: this runs on a page and in a unit runner.
 */

import { REPO_URL, pagesUrl } from './demos.js';
import { DOCS_INDEX } from './generated/docsIndex.js';

/** ⛓ The directory the documents live in, from the generated index — never
 *  typed here, because the index already knows and a second spelling could
 *  disagree with it. */
export const DOC_DIR = DOCS_INDEX.dir;

/** ⛓ The file the index itself lives in — README, which is a document a reader
 *  wants to open even though the table inside it deliberately has no row for
 *  itself. */
export const INDEX_FILE = String(DOCS_INDEX.indexIn).slice(`${DOC_DIR}/`.length);

/**
 * ⛓⛓ **THE ALLOW LIST**: README first (it is the front page and the default),
 * then the seventeen in README's declared reading order. ⛔ Derived, not
 * typed: a document added to `README_ORDER` and regenerated appears here, and
 * one that is not in the index cannot be opened at all.
 */
export const DOC_FILES = Object.freeze([INDEX_FILE, ...DOCS_INDEX.docs.map((d) => d.file)]);

/** ⛓ The refusal name, so the page and the row spell it the same way once. */
export const DOC_NOT_IN_INDEX = 'doc-not-in-index';

/**
 * ⛓ The `?doc=` reader. Returns the file name, or `null` for anything the
 * index does not list — including every shape of traversal, since a name with
 * a `/` in it is simply not in the list.
 */
export function docFileFor(raw) {
    const file = raw == null || raw === '' ? INDEX_FILE : String(raw);
    return DOC_FILES.includes(file) ? file : null;
}

/** ⛓ `a/b/../c` → `a/c`, without node's `path`. Leading `..` that would climb
 *  above the root are kept, so a link that escapes the repo stays visible as
 *  one rather than being silently clamped to a plausible path. */
export function normalizePath(path) {
    const out = [];
    for (const part of String(path).split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..' && out.length && out[out.length - 1] !== '..') { out.pop(); continue; }
        out.push(part);
    }
    return out.join('/');
}

/** ⛓ Where a link written inside `<doc>` points, as a path from the REPO root.
 *  Every document is in the same directory, so the base is `DOC_DIR` and the
 *  document's own name never enters into it. */
export function repoPathFor(href) {
    return normalizePath(`${DOC_DIR}/${String(href).split('#')[0]}`);
}

/**
 * ⛓⛓ **THE RESOLVER.** `href` exactly as the markdown wrote it; `doc` the file
 * it was written in; `siteRoot` what `demos.js`'s `siteRoot()` returned for
 * the page doing the rendering.
 *
 * Returns `{ kind, href, repoPath? }` — the KIND is returned rather than
 * inferred by the caller so the census can count answers instead of guessing
 * at them from URL shapes.
 */
export function resolveDocLink(href, { doc, siteRoot = '' } = {}) {
    const raw = String(href ?? '');

    /** A scheme, a protocol-relative URL, or a `mailto:` — somebody else's. */
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
        return { kind: 'external', href: raw };
    }

    /** ⛓ Same-doc: the page renders GitHub's anchors, so the fragment IS the
     *  answer. Nothing about the reader's URL needs to change. */
    if (raw.startsWith('#')) return { kind: 'same-doc', href: raw };

    const hash = raw.indexOf('#');
    const frag = hash < 0 ? '' : raw.slice(hash);
    const repoPath = repoPathFor(raw);
    const file = repoPath.slice(`${DOC_DIR}/`.length);

    /** ⛓ A sibling document — stay in the viewer. Checked against the ALLOW
     *  LIST, not merely against "ends in .md in this directory": a `.md` that
     *  is not in the index cannot be opened, so linking to it as though it
     *  could would hand the reader a refusal page. */
    if (repoPath.startsWith(`${DOC_DIR}/`) && !file.includes('/') && DOC_FILES.includes(file)) {
        return { kind: 'doc', href: `docs.html?doc=${encodeURIComponent(file)}${frag}`, repoPath };
    }

    /** ⛓ A PAGE — something a reader can actually open on this host, through
     *  the one spelling of the Pages mapping rather than a strip of our own.
     *  ⚖ The corpus contains ZERO of these today (P4 measured it); the branch
     *  exists because the alternative is sending a live page to a GitHub blob,
     *  and `docLinks.test.js` pins the count at 0 rather than leaving a reader
     *  to wonder whether the kind is unreachable or merely unused. */
    if (repoPath.startsWith('frontend/') && /\.html$/.test(repoPath.split('#')[0])) {
        return { kind: 'page', href: `${pagesUrl(`/${repoPath}`, { base: siteRoot })}${frag}`, repoPath };
    }

    /** ⛓ Everything else in the repo is SOURCE, and source is read on GitHub.
     *  The fragment is kept: GitHub understands `#L42`. */
    return { kind: 'repo', href: `${REPO_URL}/${repoPath}${frag}`, repoPath };
}

/**
 * ⛓ Every link a markdown source contains, as `{ href, text }`, with fenced
 * blocks AND inline code spans removed first — a `[a](b)` inside either is a
 * code sample, and rewriting it would edit what the document SAYS.
 *
 * ⛔ The inline-code half was MISSING until P4's own pointer paragraph in
 * `seedling-bot.md` wrote a link inside backticks to talk ABOUT a link. The
 * census counted 145 sibling links where the render emitted 144, and the
 * difference was exactly that one. A reader that strips fences but not code
 * spans has answered "is this a link?" two different ways in one function.
 *
 * ⛔ This is a census reader for the tests and the row, NOT the page's
 * renderer: the page gets its links from `marked`, which is the only thing
 * entitled to decide what markdown means. Two readers is deliberate here and
 * cheap — this one only ever has to be a SUPERSET question ("does the resolver
 * answer for everything the corpus writes"), never a rendering.
 */
export function linksIn(markdown) {
    const lines = String(markdown).split('\n');
    let fenced = false;
    const body = lines.map((l) => {
        if (l.trimStart().startsWith('```')) { fenced = !fenced; return ''; }
        return fenced ? '' : l;
    }).join('\n')
        /** ⛓ Inline code spans out too — same reason as the fences. */
        .replace(/`[^`\n]*`/g, '');

    const out = [];
    for (const m of body.matchAll(/(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        if (m[1] === '!') continue;
        out.push({ href: m[3], text: m[2] });
    }
    for (const m of body.matchAll(/<(https?:\/\/[^>\s]+)>/g)) out.push({ href: m[1], text: null });
    return out;
}
