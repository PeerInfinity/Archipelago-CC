/**
 * procgen/dashMode — **`--dash=none|full|all`, PARSED ONCE.**
 *
 * R9 slice 12i (user, 2026-08-27: *"Yes, I want to implement the dash
 * settings. Next time we do a full record, I might want to change the default
 * to no dashing, if it makes that much of a difference."*).
 *
 * ── WHAT THE FLAG IS FOR ──────────────────────────────────────────────
 *
 * Every certification solve on the roster runs `planSwordDash`'s window pass,
 * and since ⚖ ruling 45(b) that pass previews the whole corridor once per
 * PREFIX per start tick. The two bulk identity rows went 4x at ⚖ 41's flip —
 * `identity: acceptance batch` 34 -> 148 s, `identity: empty pairs c3`
 * 59 -> 228 s (kickoff §47.9). This flag is how a run asks for a cheaper
 * candidate set, or for no dash at all, WITHOUT touching the roster's own
 * state.
 *
 * ⛔⛔ **IT DOES NOT MOVE THE DEFAULT, AND THAT IS THE WHOLE DISCIPLINE.**
 * `solverBot.DEFAULT_DASH_MODE` is the permission ⚖ ruling 42 gives the user
 * and ⚖ ruling 40 makes a re-record event; §42.7 counts 205 dashes on 16
 * committed tapes recorded under it. An unset flag reaches that default and
 * nothing else, so a producer's `--check` stdout — and therefore its standing
 * md5 — is byte-identical with this module in the tree.
 *
 * ── ⛔ WHY THE HEADER LINE IS PRINTED ONLY WHEN THE MODE IS NOT THE DEFAULT
 *
 * Seven producer `--check` md5s fingerprint STDOUT (⚖ ruling 8), so a header
 * that named the mode on every run would move all seven for a word every one
 * of them already implies. `dashModeNote()` returns `null` at the default and
 * a one-line sentence otherwise — the same shape ⚖ 47's `earlyWalk` key uses
 * (kickoff §40.3): absent at the roster's state, present the moment a run is
 * something else. A trace or a header that says nothing therefore MEANS the
 * default, which is a claim a reader can check.
 *
 * ── HOW A PRODUCER OPTS IN, AND WHY THE TOKEN IS SPELLED THERE ────────
 *
 * ⛔ **THE FLAG TOKEN MUST APPEAR IN THE PRODUCER'S OWN TEXT.** The
 * instruments index publishes "the flags it reads out of `argv`" by SCANNING
 * each instrument's source (⚖ ruling 38(6), and `walkReport.js`'s header says
 * the same about `--walk-report`), so a flag parsed one module away is a flag
 * the reference table would omit. Each participant therefore spells its own
 * `--dash` `find` and hands the token here; THIS module owns the parse, so
 * there are not eleven copies of the validation.
 *
 * ⛔ A BARE `--dash` IS REFUSED BY NAME. `--dash` with no value looks like a
 * boolean and this flag has three states; guessing which one would be a
 * fallback, and a fallback reinstates the defect it replaced.
 *
 * ⛓ THE VOCABULARY IS `solverBot`'s, IMPORTED RATHER THAN RETYPED (⚖ ruling
 * 17): a mode this file accepted and the solver refused would be a CLI that
 * documents a build nobody has.
 */
import { DASH_MODES, DEFAULT_DASH_MODE } from
    '../../frontend/modules/seedlingDemo/solverBot.js';

export { DASH_MODES, DEFAULT_DASH_MODE };

/** The token every participant spells in its own source, for the index's scan. */
export const DASH_FLAG = '--dash';

/**
 * The raw `--dash=<value>` token out of an argv, or `null` when absent.
 *
 * ⚠ A producer should NOT call this instead of spelling the flag itself — see
 * the header. It is exported for the ONE reader that has no source of its own
 * to scan (a test), and for the sub-process forwarders.
 */
export function dashModeToken(argv = process.argv) {
    return argv.find((a) => a === DASH_FLAG || a.startsWith(`${DASH_FLAG}=`)) ?? null;
}

/**
 * `--dash=<mode>` -> the mode. Absent -> `DEFAULT_DASH_MODE`.
 *
 * ⛔ FAILS BY NAME AT THE PARSE SITE, never at the loop that spends it: a run
 * that mistyped its mode should die before it solves anything, not after it
 * has written a header naming a plan it did not make.
 *
 * @param {?string} token the `--dash…` token this instrument found in its own
 *   argv, or `null`/`undefined` when it found none.
 */
export function parseDashMode(token) {
    if (token === null || token === undefined) return DEFAULT_DASH_MODE;
    if (token === DASH_FLAG) {
        throw new Error(`${DASH_FLAG} needs a value: ${DASH_MODES
            .map((m) => `${DASH_FLAG}=${m}`).join(' | ')}. It is not a boolean — `
            + 'the dash has three states, and guessing which one a bare flag meant '
            + 'would be a fallback that plans one build under another build\'s name.');
    }
    const value = token.slice(DASH_FLAG.length + 1);
    if (!DASH_MODES.includes(value)) {
        throw new Error(`${DASH_FLAG}=${value} is not a dash mode. The three states are `
            + `${DASH_MODES.join(' | ')} — \`none\` does not ask the window pass at all, `
            + '`full` asks it with the whole `DASH_CHAIN_PATTERN`, `all` asks it with '
            + `every prefix (⚖ ruling 45(b), the default). Today's default is `
            + `\`${DEFAULT_DASH_MODE}\`, and every committed tape was recorded under it.`);
    }
    return value;
}

/**
 * One line for a producer's header when — and ONLY when — the mode is not the
 * roster's. `null` at the default, so stdout is byte-identical without the flag.
 */
export function dashModeNote(mode) {
    if (mode === DEFAULT_DASH_MODE) return null;
    return `⚠ dash mode: ${mode} (NOT the roster's \`${DEFAULT_DASH_MODE}\`) — `
        + 'this run does not plan what the committed tapes were recorded under, '
        + 'so its output is not comparable with a standing value.';
}

/**
 * The argv a sub-process should be handed so it plans under the SAME mode.
 * Empty at the default, so an existing command line is unchanged.
 *
 * ⛓ It exists because `batch-seedling-acceptance` runs `generate-seedling-level`
 * in TWO SEPARATE PROCESSES to check determinism, and its own comment already
 * says why every bound is forwarded: "a bound the subprocess DEFAULTED while
 * the in-process arm raised it would report ⛔ DRIFT, and a determinism red
 * whose cause is a missing flag is the worst kind of false alarm".
 */
export function dashModeArgv(mode) {
    return mode === DEFAULT_DASH_MODE ? [] : [`${DASH_FLAG}=${mode}`];
}
