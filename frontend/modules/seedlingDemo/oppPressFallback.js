/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE L40-FLIP-BUILD — THE OPPORTUNISTIC PRESS KILL'S PLAIN FALLBACK (`OPP_PRESS_FALLBACK`).
 *
 * Measured (`CC/docs/cloud-reports/seedling-hammer-l40-flip-build.md` § M): `OPPORTUNISTIC_STRIKE` alone REGRESSES L40's
 * flag 1 (`wandlock@176,80`, leg 377 `level_40__r0c53 <- in_L42_240_336`). Over the arrival clocks 5319–5324 of the
 * page's own captured request the defaults solve (`hold, kill, walk`) and OPP refuses every one inside the hold stance's
 * rock prerequisite: *"kill (spinner@192,160) by press: every key set … lands the player box on a body's 7x7 rect or on
 * the 13 px hammer line … There is no step out."* (`HAMMER_SAFETY`). OPP's policy steers the kill's own ticks into a
 * corner the plain press kill never walks into; with OPP off the same kill, from the same tick, kills.
 *
 * ⇒ ON (with `OPPORTUNISTIC_STRIKE` on and a segment that can rewind): a press kill that refuses with one of
 * `FIGHT_FALLBACK_CODES` is rewound to its first tick and redone ONCE with `OPPORTUNISTIC_STRIKE` off — the kill the
 * defaults drive, byte for byte, from the same state. A retry that kills is adopted; any other outcome is undone and
 * the original refusal is thrown, its words unchanged plus one sentence. ⛔ A kill that does not refuse never reaches
 * the retry, so every OPP success is byte-identical; with OPP off nothing is read. It never touches
 * `HAMMER_FIGHT_FALLBACK` (⚖ the user: not flipped), whose path runs inside each attempt exactly as before.
 *
 * ⛓ THE SWITCH ships ON in the L40 flip branch (the flip needs OPP for the Chest's SE press, census wall A1):
 * `SEEDLING_OPP_PRESS_FALLBACK=0` (or the page's `?seedlingSolverEnv=SEEDLING_OPP_PRESS_FALLBACK=0`) opts out, and
 * `withOppPressFallback(enabled, fn)` is for a row or a witness.
 */
export const OPP_PRESS_FALLBACK = { enabled: globalThis.process?.env?.SEEDLING_OPP_PRESS_FALLBACK !== '0' };
export const OPP_PRESS_FALLBACK_DEFAULT = true;

/** The switch's instrument: `asked` refusals the retry answered, `solved` / `refused` its outcomes. Read by nothing that decides. */
export const OPP_PRESS_FALLBACK_COUNTS = { asked: 0, solved: 0, refused: 0 };
export function resetOppPressFallbackCounts() {
    for (const k of Object.keys(OPP_PRESS_FALLBACK_COUNTS)) OPP_PRESS_FALLBACK_COUNTS[k] = 0;
}

/** Run `fn` with `OPP_PRESS_FALLBACK` set to `enabled`, restoring the previous value. */
export function withOppPressFallback(enabled, fn) {
    const was = OPP_PRESS_FALLBACK.enabled;
    OPP_PRESS_FALLBACK.enabled = enabled === true;
    const restore = () => { OPP_PRESS_FALLBACK.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/** The sentence a failed retry appends to the refusal that stands. */
export function oppPressFallbackSentence(row) {
    return `The plain fallback (\`OPP_PRESS_FALLBACK\`) rewound to the kill's first tick (t${row.t}) and redid the kill `
        + `with \`OPPORTUNISTIC_STRIKE\` off; it did not kill (${row.retryRefused}: ${String(row.why ?? '').slice(0, 160)}).`;
}
