#!/usr/bin/env node
/**
 * check-seedling-full-tier-owed — **A MEASUREMENT OWED IS A RED ROW, NOT A
 * MEMORY** (R9 slice P3b, §47.11 (3) (c)/(d)).
 *
 * ── ⛔⛔ WHAT THIS EXISTS FOR ──────────────────────────────────────────
 *
 * `roster: --win --tier=full` is a ⚖ 40 CHECKPOINT row: 149 tapes driven
 * through the real game on a Windows GPU, 143 minutes, and a headless `--check`
 * can never re-run it. So it sits in `standing-values.json` carrying the head
 * it was measured at — and NOTHING notices when the tree moves out from under
 * it. §47.11 (2) has read *"the next full tier is PREDICTED 3458/0/46 and NOT
 * measured"* for an entire campaign, in prose, where a human has to remember
 * it. This gate is that sentence, DERIVED, on every run.
 *
 * ── THE FOUR POPULATIONS, AND WHY EACH ONE ────────────────────────────
 *
 * A `--win --tier=full` verdict is a comparison between what the GAME does and
 * what the MODEL says. Exactly four things can move it:
 *
 *   (i)   THE GAME BUILD — the `frontend/modules/flashPanel/wasm` gitlink.
 *   (ii)  THE DRIVER — `seedling-bot-replay-win.py`, which is how the tapes
 *         reach the game at all.
 *   (iii) THE TAPES — but only in bytes SOMETHING READS; see below.
 *   (iv)  THE DEAD-FRAME ACCOUNTING — ⛔ and this is the one nothing else can
 *         see. §47.11 (3) (c): *"nothing short of a full tier can see a
 *         dead-frame accounting literal."* The population is DERIVED by
 *         grepping for `BOOT_PRESWAP_FRAMES`, which is where the three seeds
 *         live (`r5Acceptance.preSwapCorrection`, `-ship` CLAIM 6's site,
 *         `derive-seedling-tick0.mjs`) — never hand-listed.
 *
 * ── ⛓⛓⛓ (iii) IS A PROJECTION COMPARE, NOT A BYTE COMPARE ────────────
 *
 * ⛔ MEASURED, AND IT IS WHY THE FIRST DESIGN WAS WRONG. Two tapes moved after
 * the full tier was driven — `r9-solve-13` and `r9-solve-14`, at `0d2184e73`,
 * one `tick0.rng.seed` line each. `tick0` is a `GAME_VISIBLE_DROPS` field AND
 * `stagingFromTape` never passes it to `createRunForStaging`, so NEITHER SIDE
 * of the differential can see it: the measurement is still valid for those two
 * tapes. A byte compare would be born red naming them, and the only thing that
 * could have said otherwise is the standing row's `why` PROSE — which ⚖ 17
 * forbids reading as data. So a tape counts as moved when
 * `gameVisibleTape` OR `stagingFromTape` moves, both MEASURED at the baseline
 * SHA, and the invisible movers are PRINTED as excluded rather than dropped in
 * silence (a bound must name what it bounds).
 *
 * ── ⚠ IT IS DELIBERATELY OVER-INCLUSIVE ON (i), (ii) AND (iv) ────────
 *
 * Those three are BYTE compares, because a projection is only defined for a
 * tape. So an edit that provably cannot move the measurement — a comment, a
 * docblock, this slice's own box-lock preamble in `check-seedling-wasm-ship
 * .mjs` — still counts. That is the RIGHT DIRECTION OF ERROR: a spurious
 * "re-measure" costs a human ten seconds of reading the commit list this gate
 * prints, and a missed one costs a standing value that is quietly wrong for a
 * campaign. The gate prints the COMMIT SUBJECTS behind every mover so the
 * reader can make that call in the ten seconds.
 *
 * ── ⛔ A RED HERE IS A SCHEDULING FACT, NOT A DEFECT ──────────────────
 *
 * Nothing is broken when this gate is red. What is true is that the standing
 * number describes a tree that no longer exists, and the only cure is 143
 * minutes of GPU. It prints the ESTIMATE (`fullTierEstimate.js`, calibrated on
 * 12h's measured run) so that cost is on the same screen as the decision.
 *
 * ⛓ It is CHEAP and HEADLESS: no browser, no Windows, no `:8000`, no latch
 * cache — `git` and the tapes on disk. It takes no box lock, and must not.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeFullTierEstimate, rosterLabels, tickSumOf } from './fullTierEstimate.js';
import { FILE, readStandingValues } from './standingValues.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TAPES_REL = 'frontend/modules/seedlingDemo/fixtures/tapes';
const TAPES = join(REPO, TAPES_REL);
const WASM_SUBMODULE = 'frontend/modules/flashPanel/wasm';
const DRIVER = 'scripts/procgen/seedling-bot-replay-win.py';
const ROSTER_KEY = 'roster: --win --tier=full';
/** ⛓ The token the dead-frame accounting is spelled with, in one place. */
const DEAD_FRAME_TOKEN = 'BOOT_PRESWAP_FRAMES';

let failed = 0;
const check = (ok, name, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};
/**
 * ⛔⛔ **"CANNOT BE ASKED" IS NOT "OWED" — LEARNED FROM CI, ON THIS GATE'S OWN
 * FIRST RUN THERE.** `actions/checkout` clones at depth 1, so the baseline
 * commit is not in CI's clone at all; the first build of this gate answered
 * `git rev-parse` failed → `1 CHECK(S) FAILED` → **`0/1`**, which reads
 * exactly like "a full tier is owed" and would have had a reader scheduling
 * 143 minutes of GPU for a shallow clone. That is the same defect (d) exists
 * to prevent, in a gate written in the same slice.
 *
 * ⛓ So an unresolvable baseline is a REFUSAL: `SKIP:`, exit 0, and a verdict
 * line that says so. It is the boundaries gate's own doctrine — absence of
 * evidence is not evidence of a defect — and the counts differ (`0/0/1`
 * against `N/1`), so the two answers cannot be read as each other.
 */
const refuse = (name, detail) => {
    console.log(`SKIP: ${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`\nALL PASS — REFUSED: this tree cannot be asked (0 population(s) compared, `
        + 'NONE claimed green). ⛔ This is NOT "a full tier is owed"; it is "the question '
        + 'could not be put".');
    process.exit(0);
};

const git = (...args) => execFileSync('git', args,
    { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 27 }).trim();

/* ── the baseline: the head the standing row was measured at ─────────── */

const standing = readStandingValues({ repo: REPO });
if (!standing?.rows?.[ROSTER_KEY]) {
    console.log(`FAIL: ${FILE} carries no ${JSON.stringify(ROSTER_KEY)} row, so there is no `
        + 'measurement to be owed against. Record one with `record-standing-value.mjs '
        + '--quote` before running this gate.');
    console.log('1 CHECK(S) FAILED');
    process.exit(1);
}
const row = standing.rows[ROSTER_KEY];
let BASE;
try { BASE = git('rev-parse', `${row.measuredAt}^{commit}`); } catch {
    refuse(`the baseline \`${row.measuredAt}\` is not in this clone`,
        'every verdict here is a diff against that commit, and a clone that does not carry '
        + 'it can make none of them. ⛓ This is the normal state in CI, where '
        + '`actions/checkout` clones at depth 1 — measured on this gate\'s first CI run, '
        + 'which read `0/1` and looked exactly like an owed tier');
}
const HEAD = git('rev-parse', 'HEAD');

console.log('# check-seedling-full-tier-owed — is the standing full-tier value still about '
    + 'THIS tree?\n');
console.log(`## the standing row   ${ROSTER_KEY} = ${row.value}`);
console.log(`## measured at        ${BASE}${row.measuredAt !== BASE
    ? ` (recorded as \`${row.measuredAt}\`)` : ''}`);
console.log(`## HEAD               ${HEAD}`);
console.log(`## ⛓ the row's own \`why\` is PROSE and is NOT read here (⚖ 17): every verdict `
    + 'below is derived from the tree.\n');

/** Commits that touched a path since the baseline, subjects included. */
const movers = (paths) => {
    const files = git('diff', '--name-only', `${BASE}..HEAD`, '--', ...paths)
        .split('\n').filter(Boolean);
    if (!files.length) return { files: [], commits: [] };
    const commits = git('log', '--oneline', `${BASE}..HEAD`, '--', ...paths)
        .split('\n').filter(Boolean);
    return { files, commits };
};
const withCommits = (m) => `${m.files.join(', ')}\n${m.commits.map((c) => `        ${c}`)
    .join('\n')}`;

/* ── (i) the game build ──────────────────────────────────────────────── */

const gitlinkAt = (ref) => {
    const out = git('ls-tree', ref, WASM_SUBMODULE);
    const m = /^160000 commit ([0-9a-f]{40})\t/.exec(out);
    if (!m) throw new Error(`${ref} declares no gitlink for ${WASM_SUBMODULE}`);
    return m[1];
};
const wasmBefore = gitlinkAt(BASE);
const wasmNow = gitlinkAt(HEAD);
check(wasmBefore === wasmNow,
    '⛓ (i) THE GAME BUILD is the one the roster was driven against — the wasm gitlink',
    wasmBefore === wasmNow ? `${WASM_SUBMODULE} @${wasmBefore.slice(0, 12)}, unmoved`
        : `⛔ ${WASM_SUBMODULE} ${wasmBefore.slice(0, 12)} -> ${wasmNow.slice(0, 12)} — a `
            + 'different game was built; every tape\'s verdict is about the old one');

/* ── (ii) the driver ─────────────────────────────────────────────────── */

const driver = movers([DRIVER]);
check(driver.files.length === 0,
    '⛓ (ii) THE DRIVER is the one that carried the tapes into the game',
    driver.files.length ? `⛔ ${withCommits(driver)}` : `${DRIVER}, unmoved`);

/* ── (iii) the tapes, through BOTH sides' projections ────────────────── */

const { gameVisibleTape, parseTape } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { stagingFromTape } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));

/** ⛓ BOTH sides of the differential, so "the game cannot see it" is not half
 *  an answer: the MODEL reads a tape too. */
const projectionsOf = (raw) => {
    const t = parseTape(raw);
    return {
        game: JSON.stringify(gameVisibleTape(t)),
        model: JSON.stringify(stagingFromTape(t)),
    };
};
const rawAt = (ref, label) => {
    try { return JSON.parse(git('show', `${ref}:${TAPES_REL}/${label}.json`)); } catch {
        return null;
    }
};

const roster = rosterLabels({ tapesDir: TAPES });
const visible = [];
const invisible = [];
const appeared = [];
const vanished = [];
for (const label of roster) {
    const before = rawAt(BASE, label);
    if (before === null) { appeared.push(label); continue; }
    const after = JSON.parse(readFileSync(join(TAPES, `${label}.json`), 'utf8'));
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const b = projectionsOf(before);
    const a = projectionsOf(after);
    const moved = [b.game !== a.game ? 'game-visible' : null,
        b.model !== a.model ? 'model-staging' : null].filter(Boolean);
    if (moved.length) visible.push(`${label} (${moved.join(' + ')})`);
    else invisible.push(label);
}
/** ⛓ a tape the baseline HAD and this tree does not — the differential cannot
 *  have measured what is no longer there, and it must not read as unmoved. */
for (const rel of git('diff', '--name-only', '--diff-filter=D', `${BASE}..HEAD`, '--', TAPES_REL)
    .split('\n').filter(Boolean)) vanished.push(rel.split('/').pop().replace(/\.json$/, ''));

check(visible.length === 0 && appeared.length === 0 && vanished.length === 0,
    '⛓ (iii) THE TAPES are the ones that were driven — compared through the GAME-VISIBLE and '
        + 'the MODEL-STAGING projections at the baseline commit, never as bytes',
    visible.length || appeared.length || vanished.length
        ? `⛔ ${[visible.length ? `moved: ${visible.join(', ')}` : null,
            appeared.length ? `APPEARED (never driven): ${appeared.join(', ')}` : null,
            vanished.length ? `VANISHED: ${vanished.join(', ')}` : null]
            .filter(Boolean).join(' · ')}`
        : `${roster.length} tape(s), none moved in bytes either side reads`);
/**
 * ⛔ AND THE BOUND NAMES WHAT IT EXCLUDED. A "0 moved" line that quietly
 * dropped two byte-movers would imply a coverage it does not have.
 */
if (invisible.length) {
    console.log(`   ⛓ EXCLUDED, and named: ${invisible.length} tape(s) moved in bytes NEITHER `
        + `side of the differential reads — ${invisible.join(', ')}. \`tick0\` is a `
        + '`GAME_VISIBLE_DROPS` field and `stagingFromTape` never forwards it, so the '
        + 'measurement still holds for them. This was MEASURED, not taken from the row\'s '
        + '`why`.');
}

/* ── (iv) the dead-frame accounting, DERIVED ─────────────────────────── */

/**
 * ⛔⛔ THE POPULATION IS GREPPED, NOT LISTED (⚖ 17) — **AND THE DETECTOR IS
 * THE ASSIGNMENT, NOT THE MENTION** (trap 566, and `gateRoster.js`'s own
 * docblock says it about a different constant). The first cut of this line was
 * a bare `git grep -l`, and it returned FIFTEEN files of which THREE are
 * PROSE: `fable-to-opus-handoff-2026-07.md`, `seedling-bot.md` and
 * `flashPanel/README.md` merely NAME the constant. A markdown file cannot
 * change what the game does, so a doc edit would have reported a full tier
 * owed — a red that teaches nothing is a red that gets ignored.
 *
 * FOUR EXCLUSIONS, EVERY ONE NAMED IN THE OUTPUT:
 *   `.md`             prose. It mentions the accounting; it does not perform it.
 *   `*.test.js`       a test ASSERTS the accounting. Its edit cannot move the
 *                     game, and a test is red on its own when it is wrong.
 *   the standing file a record OF measurements, not a participant IN one.
 *   this gate         it names the token in order to grep for it.
 *
 * ⛓ `check-*.mjs` gates ARE INCLUDED, deliberately — trap 827: `-ship`
 * CLAIM 6 asserts the constant in SOURCE and went 254/0 -> 253/1 when the
 * frame moved, so a gate is in this conversation even though it is not in the
 * differential. Sweeping only the differential's own imports would miss it.
 */
const CODE_EXT = /\.(?:js|mjs|py|json)$/;
const SELF = 'scripts/procgen/check-seedling-full-tier-owed.mjs';
const deadFrameFiles = git('grep', '-l', '--', DEAD_FRAME_TOKEN)
    .split('\n').filter(Boolean)
    .filter((f) => CODE_EXT.test(f))
    .filter((f) => !f.endsWith('.test.js') && f !== FILE && f !== SELF)
    .sort();
/**
 * ⛓⛓⛓ **THE VERDICT IS ON THE LINES, THE CONTEXT IS ON THE FILES.** A
 * file-level compare counts every edit to a file that merely HOLDS the
 * accounting — measured on this slice's own head, that meant a box-lock
 * PREAMBLE in `check-seedling-wasm-ship.mjs` owing a 142-minute GPU tier. So
 * the verdict is `git diff -G<the accounting's own spellings>`: a diff whose
 * CHANGED LINES touch the accounting.
 *
 * ⛔ AND THE TRADE IS NAMED RATHER THAN HIDDEN. `-G` can UNDER-include: an
 * accounting change on a line naming none of these spellings would be missed,
 * which is the opposite direction of error from the file compare. That is why
 * the wider set is still COMPUTED AND PRINTED beside the verdict — a reader
 * sees "5 file(s) moved at all, 1 of them on an accounting line" and can judge
 * the other four in ten seconds. A bound must name what it bounds.
 *
 * ⛓ THE REGEX IS THE TIGHTEST THE DATA JUSTIFIES, MEASURED. Four candidates
 * were run over these files across this range and ALL FOUR gave the same
 * answer (`r5Acceptance.js` alone), including one with `\barm\b` — so the
 * loose build-capability word buys nothing here and is left out: an alternate
 * that changes no answer is pure risk. The regex is PRINTED, so a future
 * reader can re-run the same comparison rather than trust this sentence.
 */
const ACCOUNTING_LINE_RE = 'BOOT_PRESWAP_FRAMES|preSwapCorrection|dead_frames|deadFrames';
const accountingAll = movers(deadFrameFiles);
const accountingLines = deadFrameFiles.length
    ? git('diff', '--name-only', `-G${ACCOUNTING_LINE_RE}`, `${BASE}..HEAD`, '--',
        ...deadFrameFiles).split('\n').filter(Boolean)
    : [];
const accounting = accountingLines.length
    ? { files: accountingLines,
        commits: git('log', '--oneline', `-G${ACCOUNTING_LINE_RE}`, `${BASE}..HEAD`, '--',
            ...accountingLines).split('\n').filter(Boolean) }
    : { files: [], commits: [] };
check(accounting.files.length === 0,
    `⛓ (iv) THE DEAD-FRAME ACCOUNTING is the one the roster was measured under — `
        + `${deadFrameFiles.length} file(s) derived by grepping \`${DEAD_FRAME_TOKEN}\`, `
        + 'judged on diffs whose CHANGED LINES touch it',
    accounting.files.length ? `⛔ ${withCommits(accounting)}` : 'no accounting line moved');
console.log(`   ⛓ the line filter: \`git diff -G'${ACCOUNTING_LINE_RE}'\` — measured as the `
    + 'tightest of four candidates that all gave the same answer over this range (one '
    + 'included `\\barm\\b` and changed nothing, so the loose word is left out).');
/**
 * ⛔ THE WIDER SET, PRINTED. `-G` errs toward UNDER-inclusion; this line is how
 * a reader sees what the narrowing let through.
 */
console.log(`   ⛓ CONTEXT, not a verdict: ${accountingAll.files.length} of `
    + `${deadFrameFiles.length} file(s) moved AT ALL since the baseline`
    + `${accountingAll.files.length ? ` — ${accountingAll.files.join(', ')}` : ''}; `
    + `${accounting.files.length} of those moved an accounting LINE. The rest are edits `
    + 'that cannot move a `--win` verdict (measured on this slice: a box-lock preamble).');
console.log(`   ⛓ the derived population (${deadFrameFiles.length}): `
    + `${deadFrameFiles.join(', ')}`);
console.log('   ⛓ EXCLUDED, and named: `.md` (prose mentions the accounting, it does not '
    + 'perform it — trap 566), `*.test.js` (a test asserts it), the standing-values file '
    + 'and this gate. ⛓ `check-*.mjs` gates are deliberately IN (trap 827).');

/* ── the estimate, so the cost is beside the decision ────────────────── */

console.log(`\n## IF IT IS OWED, IT COSTS: ${describeFullTierEstimate(
    { tapes: roster.length, ticks: tickSumOf(roster, { tapesDir: TAPES }) })}`);
console.log('## ⛔ AN ESTIMATE IS NEVER THE MEASUREMENT. A standing value is what a run '
    + 'PRODUCED; this number exists only to price the decision to run one.');

if (failed) {
    console.log(`\n## ⛔ A FULL TIER IS OWED. Nothing here says the tree is BROKEN — it says `
        + `the standing row \`${row.value}\` describes a tree that no longer exists, and the `
        + 'only cure is the drive. Run it, then record the new value with '
        + '`record-standing-value.mjs --key=' + JSON.stringify(ROSTER_KEY) + ' --quote=... '
        + '--measured-at=<sha> --why=...`, and this gate goes green.');
}
console.log(failed === 0
    ? `\nALL PASS — the full tier measured at ${BASE.slice(0, 9)} is still about this tree`
    : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
