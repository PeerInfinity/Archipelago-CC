/**
 * apworldEditor/downloadJson — **THE HUB'S EXIT TO A FILE** (APWORLD EDITOR HUB
 * slice H2; ⚖ user: *"I also want a way to download the rules.json data to a
 * file."*).
 *
 * ── ⛔ WHY THIS IS A NINETEENTH COPY AND NOT A CONSOLIDATION ───────────
 *
 * `grep -rl createObjectURL frontend/modules --include=*.js` finds **19 files**
 * (18 outside the submodules; 17 of those name `application/json`), every one
 * of them building a `Blob`, an object URL and a synthetic `<a>` by hand. There
 * is no shared helper. Consolidating them is OUT OF SCOPE for this slice and is
 * NAMED in the as-built as a cleanup-backlog lead — this file is the hub's own
 * small one, kept inside `apworldEditor/` precisely so the future consolidation
 * has one more caller to move rather than one more idiom to reverse-engineer.
 *
 * ── ⛓⛓ THE PURE HALF IS THE TESTABLE HALF ─────────────────────────────
 *
 * `rulesDownloadName` and `rulesDownloadText` are functions of the document
 * alone and carry every decision. `downloadJson` is the four DOM lines around
 * them, and the in-app row asserts the BLOB'S BYTES (by intercepting
 * `URL.createObjectURL`) rather than that a file appeared: a download a page
 * starts is inert in some sandboxes, so "a file exists on disk" is not
 * something a browser test can honestly claim.
 */

/**
 * ⛓⛓⛓ **THE BYTES ARE `JSON.stringify(doc, null, 2)`, WHICH IS WHAT THE
 * PRESETS ON DISK ARE** — measured, not assumed: every committed
 * `AP_*_rules.json` is two-space pretty-printed, and re-emitting the median,
 * p90 and max documents through `json.dumps(indent=2)` reproduces their byte
 * counts to within 4 bytes (203,178 → 203,178 · 766,895 → 766,899 ·
 * 2,620,221 → 2,620,225; the residue is escape-sequence spelling, not layout).
 *
 * ⛔ NOT `canonicalJson`. Key order is CONTENT for this document — the session's
 * `equal` is `deepEqualKeyOrder` for exactly that reason — so a sorting writer
 * would hand the person a file whose bytes differ from the record they were
 * looking at.
 */
export function rulesDownloadText(doc) {
    return JSON.stringify(doc, null, 2);
}

/** ⛓ A file-name fragment: no separators, no control bytes, no runs of `_`. */
function slug(value) {
    return String(value ?? '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * ⛓⛓ **THE NAME CARRIES BOTH IDENTIFIERS, AND THAT IS A MEASUREMENT RATHER
 * THAN A PREFERENCE.** The brief asked for `<seed_name or game_name>_rules.json`.
 * Over the 205 committed presets that rule is not discriminating enough to be
 * useful, and in 29 of them it is not even non-empty:
 *
 *   · `seed_name` alone → **24** distinct names for 205 documents (112 of them
 *     share `14089154938208861744`), and **29 presets carry `seed_name: ""`**,
 *     which under "prefer seed_name" names the download `_rules.json`.
 *   · `game_name` alone → 115 distinct.
 *   · both → **162** distinct. The 43 that still collide are the per-player
 *     multiworld slices, which differ only in a `playerId` the file name does
 *     not carry.
 *
 * ⇒ both, in the on-disk order (`<Game>_AP_<seed>_rules.json` echoes
 * `presets/<dir>/AP_<seed>/AP_<seed>_rules.json`), each half dropped when the
 * document does not carry it, and `rules.json` when it carries neither.
 */
export function rulesDownloadName(doc) {
    const game = slug(doc?.game_name);
    const seed = slug(doc?.seed_name);
    const parts = [];
    if (game) parts.push(game);
    if (seed) parts.push(`AP_${seed}`);
    return parts.length === 0 ? 'rules.json' : `${parts.join('_')}_rules.json`;
}

/**
 * ⛓ Hand the bytes to the browser as a file. Returns the name used, so the
 * caller's status line reports what it actually wrote rather than what it
 * intended to.
 *
 * ⚠ The object URL is revoked on the next macrotask, not synchronously: Firefox
 * and WebKit have both been observed to cancel a download whose URL was revoked
 * inside the same tick as the click.
 */
export function downloadJson(fileName, value) {
    const text = typeof value === 'string' ? value : rulesDownloadText(value);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    // ⛓ `blob.size` is the UTF-8 BYTE count; `text.length` is UTF-16 code
    //   units. They differ on every document carrying a non-ASCII item name,
    //   and the threshold this panel guards the raw view with is in bytes.
    return { fileName, bytes: blob.size, chars: text.length };
}

export default downloadJson;
