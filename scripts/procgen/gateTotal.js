/**
 * gateTotal — **THE VERDICT VOCABULARY A GATE PRINTS, SPELLED ONCE** (slice
 * seedling-headless-F2 task 3, 2026-09-13;
 * the headless arc's plan §18).
 *
 * ── ⛔⛔ WHY THIS EXISTS ─────────────────────────────────────────────────
 *
 * Two readers judge a gate by its output: `standingValues.headlineOf` (the
 * writer — F1 banks a NEW row only on exit 0 WITH a total line) and
 * `gates.mjs`'s `tally`/`totalOf`. Both count `^PASS:`/`^FAIL:` and look for a
 * TOTAL line matching the same `TOTAL_RE`. 37 `@ci-box` gates printed none:
 * `All … assertions passed.`, `VERIFY …: ALL OK`, `✅ ALL PASS` (an emoji in
 * front of `ALL PASS` fails the anchored regex), `PASS — …`, `  JTA LEG: OK` —
 * so the writer refused every one of them by name (F1 §16.1.11 ⚖ 3). F1 fixed
 * five gates by hand with an inline ternary; this is that shape, once.
 *
 *   checkLine(ok, msg)   `PASS: msg` / `FAIL: msg`
 *   totalLine(failures)  `ALL CHECKS PASSED` / `N CHECK(S) FAILED`
 *   failOnCrash()        a THROW anywhere (uncaught, or a rejected top-level
 *                        await) is ONE failed check: `FAIL: fatal: <message>`,
 *                        then the total, then exit 1 — a fail-fast gate's
 *                        verdict and a counting gate's crash both become a
 *                        line a reader can parse, never a stack and no total.
 *
 * ⛓ The gates keep their human lines; the TOTAL is printed AFTER them, because
 * both readers take the LAST line that matches.
 */

/** The green total. */
export const ALL_CHECKS_PASSED = 'ALL CHECKS PASSED';

/** `PASS: msg` / `FAIL: msg` — the prefix both readers count. */
export function checkLine(ok, msg) {
    return `${ok ? 'PASS' : 'FAIL'}: ${msg}`;
}

/** The last line a gate prints about its verdict. */
export function totalLine(failures) {
    return failures === 0 ? ALL_CHECKS_PASSED : `${failures} CHECK(S) FAILED`;
}

/**
 * ⛓ A throw is ONE failed check. `extraFailures` is read at crash time, so a
 * counting gate that had already failed N checks reports N + 1.
 * @param {() => number} [extraFailures]
 */
export function failOnCrash(extraFailures = () => 0) {
    const onCrash = (e) => {
        console.log(checkLine(false, `fatal: ${e?.message ?? e}`));
        if (e?.stack) console.error(e.stack);
        console.log(totalLine(extraFailures() + 1));
        process.exit(1);
    };
    process.on('uncaughtException', onCrash);
    process.on('unhandledRejection', onCrash);
}
