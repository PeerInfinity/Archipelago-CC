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
import { makeSetRecordEnvelope } from '../procgenCore/labRoomEnvelope.js';
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
 * ⛓⛓⛓ EDITOR INTEGRATION W3 — **WHAT THIS PAGE HANDS THE HOST, AND IT IS
 * ARM-AWARE.**
 *
 * `labBridge.announce` publishes `procgenLab:levelChanged` whenever
 * `page.payload()` differs from the last one published. Before W3 that was
 * always the GENERATE arm's ladder payload, so every SET edit on the EDIT arm —
 * including the ONE `replace-room-xml` a room CLOSE folds — was invisible to a
 * host. Now: while the EDIT arm HOLDS a set session, the page's payload IS that
 * document, wrapped in the `labRoomEnvelope` both pages and the host share.
 *
 * ⛔ **THE GATE IS `setArm()`, NOT THE `?source=`** — the same condition
 * `__editorEdit.set` is published under. A set can be held while another arm is
 * on screen, and a host that had to drive the page to the EDIT arm before it
 * could hear about the document could never send the document and the room as
 * two messages.
 *
 * ⚠ BYTE-INERT FOR EVERY EXISTING CLAIM: no set held ⇒ the ladder payload,
 * exactly as before. `check-procgen-lab-hosting.mjs`' Seedling claims send
 * `?gen=`-shaped payloads and never a set.
 *
 * @param {object|null|undefined} readout `window.__watch`
 * @param {{room:number|null, record:object}|null} setArm the held session, or null
 */
export function watchLabPayload(readout, setArm) {
    if (setArm) {
        return makeSetRecordEnvelope({
            substrate: 'seedling', room: setArm.room, record: setArm.record,
        });
    }
    return readout?.payload ?? null;
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
 * @param {() => ({room:number|null, record:object})|null} [opts.setArm]
 *        the EDIT arm's SET session, or `null` when it holds none — see
 *        `watchLabPayload`
 */
export async function installWatchBridge({
    iframeId, readout, load, navigate, setArm = () => null,
}) {
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
            payload: () => watchLabPayload(readout(), setArm()),
            load,
            navigate,
        },
        log: (level, ...args) => {
            const fn = console[level] || console.log;
            fn('[watchBridge]', ...args);
        },
    });
}
