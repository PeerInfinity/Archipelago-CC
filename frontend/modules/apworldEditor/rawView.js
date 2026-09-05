/**
 * apworldEditor/rawView — **THE WHOLE DOCUMENT AS TEXT** (APWORLD EDITOR HUB
 * slices H2 and H2b; ⚖ user: *"I want to have a way to view the raw data in a
 * text editor, or a json editor. Or maybe this should be disabled if the data
 * is too big. We might need to test to see what counts as too big."* — H2
 * tested, H2b changed the widget, and the answer is now **nothing in this
 * corpus counts as too big**).
 *
 * ⛓ The view is over the WORKING COPY (`session.record()`), not applied state —
 * the arc's ⚖. Everything a person types comes back as ONE `replace-document`
 * op, so one undo folds the whole text edit away.
 *
 * ⛔ **THE SIZE GUARD IS GONE, AND THAT TOO IS A MEASUREMENT** (slice H2b): the
 * tab mounts CodeMirror 6 now, every committed preset opens, and
 * `rawViewVerdict` below carries the numbers, the command and the reasoning.
 * Nothing here was typed from intuition — not the limit H2 shipped, and not its
 * removal.
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
 * ⛓⛓⛓ **HOW BIG THIS DOCUMENT IS — AND NOTHING ELSE. THE LIMIT IS RETIRED.**
 *
 * H2 shipped `RAW_VIEW_LIMIT_BYTES = 2_000_000` here, with a refusal screen and
 * a "show it anyway" escape, because the raw tab was a `<textarea>` and a
 * textarea over the corpus maximum took **12,942 ms to open and 1,251 ms per
 * keystroke**. H2's own measurement said the widget was the problem rather than
 * the document, and ⚖ (user, 2026-09-05) took CM6 as its own slice: **H2b**.
 *
 * The tab now mounts CodeMirror 6, which is viewport-virtualised — it lays out
 * the lines you can see, not the document. Re-measured against the REAL mounted
 * editor:
 *
 * ```
 * node scripts/procgen/measure-apworld-raw-view.mjs --all --samples=5 --json=<path>
 * ```
 *
 * **The corpus arm — ALL 205 committed presets**, opened in the real tab
 * (2026-09-05, 8 cpus, load 2.02 at start / 3.53 at end):
 *
 * ```
 * opened 205/205; 0 did NOT mount an editable editor
 * time-to-interactive:  min 13.9 ms · median 30.8 ms · p90 99.5 ms · MAX 262.9 ms
 * over the textarea's 1,504 ms (H2's limit point): 0    over 500 ms: 0
 * ```
 *
 * ⚠⚠ **AND THE COST IS NOT ORDERED BY DOCUMENT SIZE** — which is why the whole
 * corpus had to be opened rather than three documents picked off a size
 * ranking. The ten slowest to open are led by three `depgraph` presets at
 * **1,198,656 B** (262.9 / 259.9 / 179.2 ms) — under H2's 2,000,000-byte limit,
 * so never even suspect — with the 3,146,656 B maximum only THIRD at 211.9 ms.
 * H2's median/p90/max method would have reported 211.9 ms as the worst case and
 * been wrong by 51 ms and by four documents.
 *
 * **The document arm** — the median, p90 and max presets, five keystrokes each,
 * timed through the PANEL'S OWN view (its extensions, its update listener):
 *
 * | document | pretty B | panel-only TTI | raw tab TTI | keystroke |
 * |---|---|---|---|---|
 * | `raft` (median)          |   203,178 |   444 ms |  52.4 ms | 120.6 ms |
 * | `kh1` (p90)              |   766,891 |   304 ms |  60.1 ms |  31.7 ms |
 * | `procgen_topdown/AP_8`   | 3,146,656 |   263 ms | 157.1 ms |  17.0 ms |
 *
 * ⛓ The `panel-only` column is the control H2 introduced and it still earns its
 * place: `_selectTab` re-renders the WHOLE panel, so timing the raw tab alone
 * would credit the editor with the panel's own cost. Here it runs the other
 * way — the panel is now the expensive half (up to 3,326 ms on a `depgraph`
 * preset's Items tab), and the editor is noise beside it.
 *
 * **The widget sweep**, over sliced text and the SAME shipped extension list,
 * to 16 MB — 5× past the corpus maximum, because "no document is too big" is
 * only defensible if somebody looked above the corpus:
 *
 * | pretty B | TTI | keystroke |
 * |---|---|---|
 * |    500,000 |  41.1 ms | 67.5 ms |
 * |  1,000,000 |  32.3 ms | 14.4 ms |
 * |  2,000,000 |  38.6 ms | 17.8 ms |
 * |  4,000,000 |  53.1 ms | 12.1 ms |
 * |  8,000,000 |  89.4 ms | 10.5 ms |
 * | 16,000,000 | 179.2 ms | 16.9 ms |
 *
 * ⛓ 16 MB opens faster than H2's textarea opened 500 KB. The growth is there —
 * TTI roughly doubles per doubling above 4 MB — but it starts so low that the
 * corpus is nowhere near it.
 *
 * ⇒ **there is no size in this corpus the view cannot open**, so there is no
 * threshold left to guard and the constant, its refusal screen and its escape
 * hatch are gone. `rawViewVerdict` is now what its name always described: the
 * size, said out loud, with no verdict attached.
 *
 * ⛔ A limit is not deleted because it was annoying — it is deleted because the
 * measurement that justified it no longer holds against the widget that
 * replaced the one it was measured on. If the raw tab ever goes back to a
 * plain text control, the number to reinstate is in the plan's §12.3 table.
 */
export function rawViewVerdict(bytes) {
    return { bytes, message: `${bytes.toLocaleString()} bytes of pretty-printed JSON.` };
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
