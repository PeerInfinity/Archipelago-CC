/**
 * seedlingDemo/watchBridge — **`watch.html`'s OPTIONAL HOST BRIDGE.** The page
 * inside a `procgenLabPanel` iframe; nothing else.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). `mazeRoom/mazeLabBridge.js`'s twin: the transport and the
 * routing are `procgenCore/labBridge.js`, the vocabulary is
 * `procgenCore/labProtocol.js`, the summary is `watchSummary.js`, and this
 * file is only the wiring between them.
 *
 * ── ⛔ DYNAMIC, AND ONLY UNDER `?iframeId=` ───────────────────────────
 *
 * `watchViewer.main()` does `import('./watchBridge.js')` when — and only when
 * — the URL carries `?iframeId=`. Standalone, the module is never requested,
 * and `check-seedling-editor-boot.mjs` measures exactly that with a network
 * probe. ⚖ The editor arc's ruling that `watch.html` is a standalone document
 * is unchanged by this slice; the bridge is an addition a host asks for, not a
 * dependency the page grew.
 *
 * ── ⛓⛓ WHAT `load` MEANS HERE, AND WHY IT IS THE `?gen=` PATH ─────────
 *
 * ⚠ A FINDING FROM THIS SLICE, recorded because the brief asked the question:
 * **watch.html has no level-payload upload box at all.** The two textareas on
 * the page are `#tapeText` (a solve TAPE, through `parseTape`) and `#bootBox`
 * (a level BLOCK, the game's own starting-conditions format) — different
 * vocabularies for different things. The ONLY way a generated payload has ever
 * re-entered the page is `?gen=PATH`, which FETCHES it, REGENERATES from its
 * seed/biome/bounds/roster and COMPARES (`agreementWithPayload`). So the
 * question "are the upload path and the `?gen=` path two functions?" has the
 * answer: there is one function and there was never a second path.
 *
 * ⇒ `procgenLab:load` therefore hands the payload OBJECT to `runGenerate`
 * exactly where the fetch would have produced it, and everything downstream is
 * the unchanged `?gen=` code. The host gets the stronger contract for free: a
 * SEND does not merely display the level, it re-derives it and says whether
 * the page agrees with the file.
 */

import { createLabBridge } from '../procgenCore/labBridge.js';
import { AdapterClient } from '../shared/adapterClient.js';

/**
 * ⛓⛓ THE PROJECTION, AS A PURE FUNCTION — `window.__watch` onto the
 * `procgenLab:stateChanged` field list. `mazeLabBridge.mazeLabSummary`'s twin,
 * and it is deliberately thin: `watchSummary.js` already did the deriving, and
 * this is the rename layer between one page's readout and the protocol.
 *
 * ⛔ It reads `__watch` rather than the four `__editorX` globals directly, so
 * the host and `check-seedling-editor-*.mjs` are looking at ONE object. A
 * bridge that projected the raw readouts itself would be a second summary,
 * which is precisely what `watchSummary.js` exists to prevent.
 *
 * @param {object|null|undefined} watch `window.__watch`
 * @returns {object|null} the summary, or null before the first mount
 */
export function watchBridgeSummary(watch) {
    if (!watch) return null;
    return {
        url: watch.url,
        source: watch.source,
        seed: watch.seed,
        step: watch.step,
        identity: watch.identity,
        certified: watch.certified,
        edits: watch.edits,
        directives: watch.directives,
    };
}

/**
 * Install the bridge. Returns the handle `watchViewer` keeps, or `null` when
 * the page is standalone.
 *
 * @param {object} opts
 * @param {string} opts.iframeId                  from `?iframeId=`
 * @param {() => object} opts.readout             `() => window.__watch`
 * @param {(payload:object) => any} opts.load     the `?gen=` reconstruction
 * @param {(search:string) => any} opts.navigate  the ONE URL reader, no reload
 */
export async function installWatchBridge({ iframeId, readout, load, navigate }) {
    if (!iframeId) return null;
    const client = new AdapterClient();
    return createLabBridge({
        substrate: 'seedling',
        client,
        iframeId,
        page: {
            // ⛔ READ AT PUBLISH TIME, NEVER CACHED. `resetPageChrome` DELETES
            // `__watch` on every arm switch, so a bridge holding a reference
            // would report the outgoing arm for as long as the page lived.
            summary: () => watchBridgeSummary(readout()),
            payload: () => readout()?.payload ?? null,
            load,
            navigate,
        },
        log: (level, ...args) => {
            const fn = console[level] || console.log;
            fn('[watchBridge]', ...args);
        },
    });
}
