/**
 * apworldEditor/rawView — **THE WHOLE DOCUMENT AS TEXT, AND THE SIZE GUARD IT
 * NEEDS** (APWORLD EDITOR HUB slice H2; ⚖ user: *"I want to have a way to view
 * the raw data in a text editor, or a json editor. Or maybe this should be
 * disabled if the data is too big. We might need to test to see what counts as
 * too big."*).
 *
 * ⛓ The view is over the WORKING COPY (`session.record()`), not applied state —
 * the arc's ⚖. Everything a person types comes back as ONE `replace-document`
 * op, so one undo folds the whole text edit away.
 *
 * ⛔ THE THRESHOLD IS A MEASUREMENT. See `RAW_VIEW_LIMIT_BYTES` below: the
 * numbers, the command that produced them and the reasoning are in its comment,
 * and the plan's §12 carries the table. Nothing here was typed from intuition.
 */

/**
 * ⛓ The bytes the view holds — `JSON.stringify(doc, null, 2)`, which is what
 * **192 of the 205** committed presets already are: the median and p90
 * documents re-emit to within 4 bytes of their own file size.
 *
 * ⚠ The other **13** are written COMPACT (`compactJsonFile`), so for those the
 * view — and the download — is up to **1.75×** the file on disk
 * (`procgen_topdown/AP_8`: 1,799,872 B → 3,146,656 B). That is deliberate: the
 * majority formatting is what a person reading or diffing a saved file expects,
 * and no loader cares. But it is why every size in this module is in PRETTY
 * bytes and why the arc plan's file-size census is not this module's corpus.
 */
export function rawViewText(doc) {
    return JSON.stringify(doc, null, 2);
}

/**
 * ⛓ UTF-8 BYTES, not UTF-16 code units. A document full of non-ASCII item names
 * is bigger on the wire than `text.length` says, and the threshold is about
 * what the browser has to hold and lay out.
 */
export function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    // Node without a global TextEncoder is not a browser; count the same way.
    return Buffer.byteLength(String(text), 'utf8');
}

/**
 * ⛓⛓⛓ **THE RAW VIEW'S SIZE LIMIT, IN BYTES OF PRETTY-PRINTED JSON — MEASURED,
 * NOT CHOSEN.**
 *
 * ```
 * node scripts/procgen/measure-apworld-raw-view.mjs --json=<path>
 * ```
 *
 * drives the REAL hub panel in a real browser (headless Chromium, this box, 8
 * cpus; the load average is printed with every table because these numbers are
 * load-dependent). It reports, per document: the panel's own re-render cost on
 * a NON-raw tab ("panel-only"), the raw tab's time-to-interactive, and the
 * median of five keystrokes measured from `execCommand('insertText')` to the
 * frame after the resulting `input` event.
 *
 * **The document arm** — the median, p90 and max committed presets, ranked by
 * PRETTY bytes (⛔ not by file size: 13 presets are written compact, so
 * `procgen_topdown/AP_8` is 1,799,872 B on disk and **3,146,656 B** in the
 * view — it, and not `stardew_valley`, is the worst case):
 *
 * | document | pretty B | panel-only TTI | textarea TTI | textarea key | CM6 TTI | CM6 key |
 * |---|---|---|---|---|---|---|
 * | `raft` (median)          |   203,178 |  1,107 ms |     403 ms |   235 ms |  133 ms | 141 ms |
 * | `kh1` (p90)              |   766,891 |    793 ms |   2,050 ms |   192 ms |  105 ms |  37 ms |
 * | `procgen_topdown/AP_8`   | 3,146,656 |    515 ms |  12,942 ms | 1,251 ms |   88 ms | 123 ms |
 * | `stardew_valley` (¹)     | 2,620,225 |  4,553 ms |   7,185 ms |   809 ms |  100 ms |  58 ms |
 *
 * ⛓ The panel-only column is what makes this an attribution rather than a
 * total: at 3.1 MB the panel costs 515 ms and the TEXTAREA costs the other
 * 12.4 s, so the guard is guarding the right thing. (¹ from the previous run,
 * which ranked by file size; kept because it is the second-largest document.)
 *
 * **The widget sweep** — the same two questions over sliced text, because the
 * corpus has a 3.4× hole between p90 and max and a threshold interpolated
 * across it would not be measured:
 *
 * | pretty B | textarea TTI | textarea key | CM6 TTI | CM6 key |
 * |---|---|---|---|---|
 * |   500,000 |   661 ms | 231 ms | 43 ms | 240 ms |
 * | 1,000,000 |   880 ms | 143 ms | 46 ms |  29 ms |
 * | 1,500,000 | 1,288 ms | 199 ms | 30 ms |  27 ms |
 * | 2,000,000 | 1,504 ms | 279 ms | 43 ms |  14 ms |
 * | 4,000,000 |        — |      — | 51 ms |  15 ms |
 * | 8,000,000 |        — |      — | 85 ms |  11 ms |
 *
 * ⇒ **2,000,000 is the largest size measured USABLE**, and it is a measured
 * point rather than a round number picked between two: 1,504 ms to open and
 * 279 ms per keystroke. The next measured sizes are not — 2.62 MB types at
 * 468–809 ms per keystroke across three runs, and 3.15 MB takes 12.9 s to open
 * and 1.25 s per keystroke. The guard refuses **4 of the 205** committed
 * presets (three `procgen_topdown` at 3.15 MB, `stardew_valley` at 2.62 MB).
 *
 * ⚠ **AND THE MEASUREMENT SAYS THE TEXTAREA IS THE WRONG WIDGET.** CodeMirror 6
 * is viewport-virtualised and therefore FLAT: 30–133 ms to open and 11–240 ms
 * per keystroke from 200 KB to 8 MB, which is 150× faster than the textarea at
 * the corpus maximum and would retire this constant entirely. It mounts in six
 * lines from `editorCodeMirror6/codemirror6Imports.js` (the measurement script
 * does exactly that). It is NOT what ships here — the mount is six lines but
 * the hub integration is not (a second read-the-text path, undo interplay,
 * theming, and the bundled-build import graph), and the guard it would remove
 * bites four presets. It is named as a costed follow-up with its numbers,
 * which is what the brief asked for.
 */
export const RAW_VIEW_LIMIT_BYTES = 2_000_000;

/**
 * ⛓ What the raw tab should do with a document of this size, as data. The panel
 * renders the verdict; the verdict is what a node row can assert and what the
 * mutant (the constant halved) flips.
 *
 * `overLimit` never hard-BLOCKS: the guard is advice with the download beside
 * it, plus an explicit "show it anyway" the person can take. ⛔ A limit that
 * cannot be overridden is a document its owner cannot look at, and the ⚖ asked
 * for a view, not a lock.
 */
export function rawViewVerdict(bytes, limit = RAW_VIEW_LIMIT_BYTES) {
    const over = bytes > limit;
    return {
        bytes,
        limit,
        overLimit: over,
        message: over
            ? `${bytes.toLocaleString()} bytes — above the ${limit.toLocaleString()}-byte view `
              + 'limit; download instead.'
            : `${bytes.toLocaleString()} bytes of pretty-printed JSON.`,
    };
}

/**
 * ⛓⛓ **PARSE, THEN DECIDE — the op never carries text.** An edit list whose
 * payload is a recipe that can fail to re-parse is not a record (the Document
 * tab's block editor says the same sentence for the same reason), so the text
 * is parsed here and the caller builds `replace-document` from the RESULT.
 *
 * ⛔ A top-level array or scalar is refused BY SHAPE: `rules.json` is an object,
 * and `[]` would sail past a `typeof === 'object'` test.
 */
export function parseRawView(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        return { ok: false, error: `Not valid JSON — ${err.message}` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
            ok: false,
            error: 'A rules.json is a JSON OBJECT at the top level, not '
                + `${Array.isArray(parsed) ? 'an array' : JSON.stringify(parsed)}.`,
        };
    }
    return { ok: true, document: parsed };
}
