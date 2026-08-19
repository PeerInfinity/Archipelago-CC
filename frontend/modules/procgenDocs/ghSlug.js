/**
 * procgenDocs/ghSlug.js — **GITHUB'S HEADING-ANCHOR RULE, SPELLED ONCE**
 * (PROCGEN DOCS · P4, D2).
 *
 * ⛓ This rule used to live inside `glossary.test.js`, where P2 pinned it to
 * six links other people had already written in the tracked docs. P4 renders
 * those same documents on a PAGE, so the page and the test must agree about
 * what `#a-fragment` means — and two spellings of an anchor rule is 600
 * quietly-wrong anchors, which a reader discovers one dead click at a time.
 *
 * ⛔⛔ **MOVING THE RULE HERE DOES NOT MAKE IT TRUE, AND SHARING IT COULD HAVE
 * MADE IT AN ECHO** (trap 367). `glossary.test.js`'s six-link pin STAYS
 * exactly where it is and now imports this function: those six pairs are
 * evidence written by people outside this slice, and they are the only reason
 * to believe the rule at all. A test that checked this function against a
 * slugifier of its own would pass with any rule whatsoever.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────
 *
 * Lower-case; DROP every character that is not a letter, a number, a space, a
 * hyphen-minus or an underscore; then spaces → hyphens.
 *
 *     `Instant — a pump, not a skip`  →  `instant--a-pump-not-a-skip`
 *
 * ⛔ The em dash is DROPPED, not kept and not turned into a hyphen — so the
 * two spaces AROUND it become two hyphens. A first attempt that kept every
 * Unicode dash got this wrong, and the corpus caught it: `omsi.md` had written
 * `#instant-a-pump-not-a-skip` (one hyphen), which is a dead link on GitHub
 * too. P4 fixed that line.
 *
 * ── DUPLICATES ────────────────────────────────────────────────────────
 *
 * ⚖ **THE `-N` SUFFIX IS DOCUMENTED AS GITHUB'S, WITH NO IN-REPO EVIDENCE.**
 * When two headings in one document slug the same, GitHub gives the first the
 * bare slug and appends `-1`, `-2`, … to the ones after it, in document order.
 * `seedling-bot.md` has six such collisions (`## Gates` twice, `## The
 * acceptance` three times, and four more). But P4 measured the corpus and
 * **not one tracked link targets a `-N` form** — the single link that looks
 * like one, `loop-recording.md#summary-substrates-m5-2026-07-23`, ends in a
 * DATE. So unlike the base rule above, this half is unpinned: it is what
 * GitHub documents, and this repo contains no link that would notice if it
 * were wrong. `ghSlug.test.js` says so out loud rather than implying evidence
 * that does not exist.
 *
 * ⛔ No DOM and no node imports: this runs on a page and in a unit runner.
 */

/** ⛓ THE RULE. See the docblock — the em dash is dropped, not hyphenated. */
export function ghSlug(heading) {
    return String(heading).trim().toLowerCase()
        .replace(/[^\p{L}\p{N} \-_]/gu, '')
        .replace(/ /g, '-');
}

/**
 * ⛓ A whole document's headings, in order, with GitHub's duplicate suffixes
 * applied — the first `Gates` is `gates`, the second `gates-1`.
 *
 * ⚖ Unpinned by anything in this repo; see the docblock.
 */
export function ghSlugs(headings) {
    const seen = new Map();
    return [...headings].map((h) => {
        const base = ghSlug(h);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        return n ? `${base}-${n}` : base;
    });
}

/**
 * ⛓ THE HEADINGS OF A MARKDOWN SOURCE, in document order, as
 * `{ level, text, slug }`.
 *
 * ⛔ Fenced blocks are skipped: a `# comment` inside one is not a heading, and
 * counting it would shift every duplicate suffix after it. This is the ONE
 * reader both the page and every gate use, so the heading COUNT the page
 * renders and the heading count a row expects cannot come from two different
 * ideas of what a heading is.
 */
export function headingsOf(markdown) {
    const out = [];
    let fenced = false;
    for (const line of String(markdown).split('\n')) {
        if (line.trimStart().startsWith('```')) { fenced = !fenced; continue; }
        if (fenced) continue;
        const m = /^(#{1,6})\s+(.*)$/.exec(line);
        if (m) out.push({ level: m[1].length, text: m[2].trim() });
    }
    const slugs = ghSlugs(out.map((h) => h.text));
    return out.map((h, i) => ({ ...h, slug: slugs[i] }));
}
