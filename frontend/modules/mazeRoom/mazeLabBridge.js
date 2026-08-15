/**
 * mazeRoom/mazeLabBridge — **THE MAZE LAB PAGE'S OPTIONAL HOST BRIDGE.**
 * `lab.html` inside a `procgenLabPanel` iframe; nothing else.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). The transport and the routing are `procgenCore/
 * labBridge.js`; the vocabulary is `procgenCore/labProtocol.js`; this file is
 * ONLY the projection from THIS page's own readout onto that vocabulary, plus
 * the two page functions the host may call.
 *
 * ── ⛔⛔ IT IS IMPORTED **DYNAMICALLY**, AND ONLY UNDER `?iframeId=` ────
 *
 * `mazeLabView.main()` does `import('./mazeLabBridge.js')` when — and only
 * when — the URL carries `?iframeId=`. ⛔ STANDALONE, THIS MODULE IS NEVER
 * FETCHED: slice 3's ruling (*"nothing here assumes a host: no
 * `window.parent`, no global the embedder must set. It is a document."*) is
 * kept literally.
 *
 * ⚠ AND THE GATE FOR THAT IS A **NETWORK** PROBE, NOT A SOURCE WALK.
 * `check-maze-lab.mjs`'s static walker matches the DYNAMIC-import form
 * deliberately (that is how it finds `node:` leaks behind lazy edges), so this
 * file IS in the walked graph and `AdapterClient` with it — both browser-safe,
 * so claim 0 is unaffected and the module count simply grows. ⚠ Which is also
 * why no comment in this tree may write that form out with a literal specifier
 * in it: the walker reads SOURCE, not syntax, and a prose example becomes an
 * edge (measured — one sentence here reported a BARE specifier). The claim
 * that matters is
 * *"a standalone load never requested it"*, and it is measured where it is
 * true: Playwright's `page.on('request')` over a full standalone load, which
 * is a strictly stronger statement than any reading of the source could be.
 *
 * ── ⚠ A DEVIATION FROM §3.5, AND THE LINE THAT FORCED IT ──────────────
 *
 * The brief says the dynamic import is *"imported by `mazeLab.js`"*.
 * `mazeLab.js`'s own docblock forbids it: *"⛔ NO DOM AND NO NODE IMPORTS:
 * this file is unit-tested in node and loaded in a browser, so it may reach
 * for neither side's globals."* It never reads `window.location`, which is
 * where `?iframeId=` lives, and a bridge that talks to `window.parent` is the
 * DOM arm's business. So the import sits in `mazeLabView.js` — the file that
 * already owns every other `window` read on this page.
 */

import { createLabBridge } from '../procgenCore/labBridge.js';
import { AdapterClient } from '../shared/adapterClient.js';

/**
 * ⛓⛓ THE PROJECTION, AS A PURE FUNCTION — `window.__mazeLab` onto the
 * `procgenLab:stateChanged` field list. ⛔ Exported and unit-tested, because
 * this is the ONE place the page's readout and the protocol meet, and a field
 * silently coerced here (a `certified: undefined` becoming `false`) is exactly
 * the class of defect `labProtocol`'s validators exist to refuse.
 *
 * ⚠ `url` IS THE FULL `href`, not the readout's `url` (which is the SEARCH
 * alone, the shape `check-maze-lab.mjs` asserts on). The host's "open
 * standalone" needs an address it can put in an anchor, and a page reporting
 * only its query string would make the host reconstruct the path — a second
 * derivation of where this page lives.
 *
 * ⚠ `certified` is passed through as the readout's BOOLEAN. `__mazeLab` has
 * already collapsed `state.certification` to `Boolean(...)`, so `null` never
 * reaches here from this page; the protocol still accepts `null` because
 * Seedling's arms can genuinely have nobody-asked (trap 262).
 *
 * @param {object|null|undefined} readout `window.__mazeLab`
 * @param {string} href `window.location.href`
 * @returns {object|null} the summary, or null when the page has no state
 */
export function mazeLabSummary(readout, href) {
    // ⛔ A FATAL BOOT IS NOT A STATE. `__mazeLab` is `{fatal}` when the URL was
    // refused; reporting that as a `stateChanged` would give the host an
    // identity line for a level that does not exist.
    if (!readout || readout.fatal) return null;
    return {
        url: href,
        source: readout.source,
        seed: readout.seed,
        step: readout.step,
        identity: readout.identity,
        certified: readout.certified,
        edits: readout.edits,
        directives: readout.directives ?? [],
    };
}

/**
 * Install the bridge. Returns the handle `mazeLabView` keeps (`announce()` from
 * its render, `selectTile()` from its canvas click), or `null` when the page is
 * standalone — which cannot happen, because the caller checks `?iframeId=`
 * first; the guard is here so a future caller cannot make it happen quietly.
 *
 * @param {object} opts
 * @param {string} opts.iframeId              from `?iframeId=`
 * @param {() => object} opts.readout         `() => window.__mazeLab`
 * @param {(payload:object) => void} opts.load     the page's ONE reconstruction
 * @param {(search:string) => void} opts.navigate  the page's ONE URL reader
 */
export async function installMazeLabBridge({ iframeId, readout, load, navigate }) {
    if (!iframeId) return null;
    const client = new AdapterClient();
    return createLabBridge({
        substrate: 'maze',
        client,
        iframeId,
        page: {
            summary: () => mazeLabSummary(readout(), window.location.href),
            // ⛔ THE PAGE'S OWN PAYLOAD, from its own readout — `labPayload(state)`
            // is what Download writes and what LOAD takes, so the host and the
            // file on disk are the same artifact.
            payload: () => (readout()?.fatal ? null : (readout()?.payload ?? null)),
            load,
            navigate,
        },
        log: (level, ...args) => {
            const fn = console[level] || console.log;
            fn('[mazeLabBridge]', ...args);
        },
    });
}
