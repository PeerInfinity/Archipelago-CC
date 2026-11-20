/**
 * tests/walkMeasureLine — the walk instrument's `[MEASURE …]` line (`testCases/tutorialTests.js` § The walk
 * instrument), as a pure function so its format is pinned in node.
 *
 * ⛔ ONE LINE, ALWAYS. Every free-text field (`botHead`, `botRegion`, `lastRegionEvent`, `status`, `why`) is written
 * as a JSON string, so a newline inside it is ESCAPED as the two characters `\n` (never a raw line break), and
 * `scripts/procgen/walk-seedling-whole-game.mjs`'s `parseMeasureFields` JSON-parses it back to the full text.
 * ⛓ FULL REASONS (⚖ Robert 2026-11-20, "Show the full reasons") — a ladder-EXHAUSTED refusal's status carries its
 * `  rung: why` lines after newlines; they ride in `status` (and `why`) whole, escaped, on the one line.
 */

/**
 * @param {string} tag   'tick' | 'end' | 'skip N'
 * @param {string} id    the tutorial's id
 * @param {object} f     the sampled fields (a missing count is the caller's '?')
 * @returns {string}
 */
export function measureLine(tag, id, f) {
    return `[MEASURE ${tag}] ${id} t=${f.t}s`
        + ` step=${f.step} checked=${f.checked}`
        + ` botQueue=${f.botQueue} botCursor=${f.botCursor} botChecked=${f.botChecked}`
        + ` botHead=${JSON.stringify(f.botHead ?? null)}`
        + ` botRegion=${JSON.stringify(f.botRegion ?? null)} lastRegionEvent=${JSON.stringify(f.lastRegionEvent ?? null)}`
        + ` regionChanges=${f.regionChanges} wasmPushes=${f.wasmPushes} transport=${f.transport}`
        + ` wasmMemMB=${f.wasmMemMB} jsHeapMB=${f.jsHeapMB}`
        + ` status=${JSON.stringify(f.status ?? null)}${f.extra ?? ''}`;
}

/** The `[MEASURE end]` line's tail: how the walk ended (`outcome` is walkTutorial's; null when the walk threw). */
export function measureEndExtra(outcome) {
    return ` walkEnd=${outcome?.end ?? 'threw'} walkStep=${outcome?.stepId ?? '?'} why=${JSON.stringify(outcome?.why ?? null)}`;
}
