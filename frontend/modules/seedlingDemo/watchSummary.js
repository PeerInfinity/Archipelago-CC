/**
 * seedlingDemo/watchSummary — **`window.__watch`, DERIVED FROM WHAT THE PAGE
 * ALREADY SAYS.** One summary of watch.html's state, in the shape
 * `procgenCore/labProtocol.js` asks for.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). The maze lab page has had `window.__mazeLab` since slice
 * 3 — *"already the whole state a host would want to read"* (§10.10 item 6) —
 * and watch.html has nothing comparable: it has FIVE readouts, one per arm
 * (`__editorGenerate`, `__editorSolve`, `__editorManual`, `__editorArm`,
 * `__editorGenerated`), each shaped for the browser row that reads it.
 *
 * ── ⛔⛔ THIS FILE ADDS NO SIXTH TRUTH ─────────────────────────────────
 *
 * It is a PROJECTION and nothing else: every field below is copied out of a
 * readout the page already writes, or off `window.location`. ⛔ Nothing here
 * re-derives a seed, re-reads a URL parameter, or re-computes an identity
 * line — `describeState` stays the ONE identity function and this file quotes
 * its output. The alternative (a summary that built its own answer from
 * `state`) is the two-spellings failure with the page's own identity in it,
 * which is the very defect `watchViewer`'s slice-5 note records about
 * `state.directives`.
 *
 * ⇒ THE TEST OF THIS FILE IS THEREFORE A TEST OF THE PROJECTION, not of the
 * page: given a readout, does the summary carry its fields under the
 * protocol's names, and does it say the right thing when the arm has no
 * generated level at all?
 *
 * ── ⚠ WHAT SEEDLING DOES NOT HAVE, SAID OUT LOUD ──────────────────────
 *
 * `edits` is ALWAYS 0. Free tile/object editing on the Seedling page is
 * ⚖ ruling 8's other half and lands in slice 11 (family K); the maze has it
 * today and the protocol carries the field for both. ⛔ Reported as 0 rather
 * than omitted, because a host reading `edits` off a Seedling frame is asking
 * a real question and *"this substrate cannot be edited yet"* and *"nobody has
 * edited it"* happen to have the same answer TODAY — the day slice 11 lands,
 * this line is what has to change, and it is one line.
 *
 * ⛔ NO DOM AND NO NODE: unit-tested in node, loaded in a browser.
 */

/**
 * ⛓ THE ARMS THAT HAVE NO LADDER. `readParams` can land the page in `solve`,
 * `manual` or `replay`, none of which generate — so `seed`/`step` are `null`
 * (⚠ trap 262's shape: `null` = "this arm has no such quantity", NOT 0) and
 * the identity line names the arm instead of a level.
 */
export function noLevelIdentity(source) {
    return `${source} — this arm holds no generated level; its identity is its own input `
        + '(a tape, a boot block), not a seed';
}

/**
 * @param {object} args
 * @param {string} args.source     the arm `readParams()` chose
 * @param {string} args.href       `window.location.href`
 * @param {object|null} args.generate   `window.__editorGenerate`
 * @param {object|null} args.generated  `window.__editorGenerated` (the payload)
 * @returns {object} the summary published as `window.__watch`
 */
export function watchSummary({ source, href, generate = null, generated = null }) {
    /**
     * ⛔ `status: 'refused'` IS NOT A LEVEL. Both `__editorGenerate` refusal
     * shapes (`{status:'refused', message}` from `mountArm`'s catch, and the
     * `{status:'refused', verdict}` a disagreeing display solve writes) carry
     * no `identity`, so treating them as a state would hand the host an
     * identity line for a level the page refused to show.
     */
    const ok = Boolean(generate) && generate.status === 'ok';
    return {
        source,
        url: href,
        seed: ok ? generate.seed : null,
        biome: ok ? generate.biome : null,
        step: ok ? generate.step : null,
        // ⛓ `describeState`'s OWN OUTPUT, carried by `__editorGenerate.identity`
        // — the same string the page prints in its detail line.
        identity: ok ? generate.identity : noLevelIdentity(source),
        /**
         * ⚠ TRAP 262 AT THE BOUNDARY. `__editorGenerate.certified` is already
         * `solved.certification?.certified ?? null`, so `null` travels as
         * `null`: "nobody has asked" is not "the oracle said no".
         */
        certified: ok ? (generate.certified ?? null) : null,
        // ⚠ ALWAYS 0 — see the docblock. Slice 11 is where this line changes.
        edits: 0,
        directives: ok ? (generate.directives ?? []) : [],
        /** The `?gen=`-shaped payload the page would DOWNLOAD, or null. */
        payload: ok ? (generated ?? null) : null,
        /** The reproduction verdict when a payload owned this run, else null. */
        payloadCheck: ok ? (generate.payloadCheck ?? null) : null,
        status: generate?.status ?? 'none',
    };
}
