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
 * ── ⚖⚖ THE MANIFEST-PROSE EXEMPTION — THE ONE CARVE-OUT ON (i) ───────
 *
 * ⚖ RULED BY THE USER, 2026-08-30 (EDITOR INTEGRATION slice P4), and written
 * HERE because this is the gate that prices the tier — a rule that lives only
 * in a plan is a rule the person reading a red row does not have:
 *
 *   **A gitlink bump whose submodule diff touches ONLY `builds.json` AND whose
 *   per-build payload md5s are byte-identical owes the pins gate plus the
 *   bounded reach, NOT the full-tier drive — the md5 identity is QUOTED in the
 *   outer commit as the licence.**
 *
 * The reasoning is (i)'s own: the population exists because *a different game
 * was built*. `builds.json` is the manifest ABOUT the builds — `namedBy`
 * prose, a `capabilities` declaration, a `$comment`. No byte the game runs is
 * in it, and no byte the game runs moved. ⇒ every tape's verdict is still
 * about the artifact it was measured on, and 143 minutes of GPU would
 * re-measure a thing that did not move.
 *
 * ⛔ THE BOUNDARY IS THE PREMISE, AND IT IS ALL THREE CLAUSES. Miss one and
 * the exemption does not apply:
 *
 *   ONLY `builds.json`   a build directory, an `.gitignore` whitelist line or
 *                        any other file in the same submodule commit ⇒ NOT
 *                        exempt. The single-file diff is what makes "no
 *                        payload moved" checkable at a glance.
 *   md5s BYTE-IDENTICAL  compared per build against the PARENT commit's
 *                        manifest, not merely re-derived from the files on
 *                        disk — a manifest may be edited to agree with a
 *                        payload that moved, which is the one way clause 1
 *                        alone could be satisfied by a real rebuild.
 *   QUOTED IN THE COMMIT the outer commit carries the identity and the pins
 *                        run. An exemption nobody can audit from the history
 *                        is an exemption that will be claimed for the next
 *                        bump too.
 *
 * ⚠ AND THIS GATE STILL REDS — deliberately, and it is not a defect. (i) is a
 * BYTE compare and stays one: teaching this file to parse a submodule diff
 * would put the carve-out in the same place as the check it excuses, and the
 * whole design above is that a bound is stated where a human reads it. What
 * the exemption licenses is the DISCHARGE — re-quoting each part's
 * `measuredAt` at the merged head with `record-standing-value.mjs` instead of
 * driving — and the commit's quoted identity is the evidence for that call.
 * ⛓ Same direction of error as the paragraph below: a spurious "re-measure"
 * costs a human ten seconds of reading; a missed one costs a standing value
 * that is quietly wrong for a campaign.
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
 * ── ⛓⛓⛓ THE VERDICT IS PER CATEGORY (R9 slice CAT, ⚖ 69 (c) / ⚖ 70 (d)) ─
 *
 * The user ruled that the full tier should run *"only for cases where there is
 * something that can only be tested in that way"*. So the checkpoint row is a
 * COMPOSITE — one part per derived category (`fixtures/tiers.js`), each with
 * its OWN `measuredAt` — and this gate asks the four questions once per part,
 * against that part's own head:
 *
 *   (i) BUILD · (ii) DRIVER · (iv) DEAD-FRAME ACCOUNTING  are about EVERY
 *       tape, so a mover there owes every category. These three ARE what only
 *       the full tier can test.
 *   (iii) THE TAPES                                       is about the tapes
 *       that moved, so it owes only THEIR categories.
 *
 * ⇒ a category driven at the head clears its own debt while the others keep
 * theirs, and the gate prices what is ACTUALLY owed rather than the whole
 * roster. MEASURED on this slice's own head: seventeen re-recorded chain tapes
 * put the debt at `campaign` alone — ≈ 11 min, where the old whole-row verdict
 * priced the same tree at ≈ 143.
 *
 * ⛓ A row with no parts (one written before this slice) is still answered: it
 * is judged as ONE category called `full` against its own head, and the run
 * says which shape it read.
 *
 * ── ⛔ A RED HERE IS A SCHEDULING FACT, NOT A DEFECT ──────────────────
 *
 * Nothing is broken when this gate is red. What is true is that part of the
 * standing row describes a tree that no longer exists, and the only cure is
 * the drive — of the named categories, not necessarily of the whole roster. It prints the ESTIMATE (`fullTierEstimate.js`, calibrated on
 * 12h's measured run) so that cost is on the same screen as the decision.
 *
 * ⛓ It is CHEAP and HEADLESS: no browser, no Windows, no `:8000`, no latch
 * cache — `git` and the tapes on disk. It takes no box lock, and must not.
 *
 * ⛓⛓⛓ **THE BANK IS THIS ROW'S SUBJECT, SO THIS ROW DECLARES IT** (⚖ 72 (c),
 * R9 slice S1). `standing-values.json` was in the DERIVED `data` population of
 * 31 of 34 keyed rows — measured — so banking a write re-armed a near-full
 * re-drive; `rowInputKey.DERIVED_DATA_EXCLUDED` took it out of the derived
 * rules. But this gate READS the composite row back out of it
 * (`readStandingValues`, `compositeParts`) to decide what is owed, so its
 * bytes really are an input HERE, and a derivation-wide exclusion without this
 * line would be exactly the stale green that file's docblock exists to refuse.
 *
 * @key-inputs data: scripts/procgen/standing-values.json
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeFullTierEstimate, rosterLabels, tickSumOf } from './fullTierEstimate.js';
import {
    FILE, compositeParts, compositeValue, compositeWhy, readStandingValues,
} from './standingValues.js';
import { ROSTER_CATEGORIES, assertTiersComplete } from
    '../../frontend/modules/seedlingDemo/fixtures/tiers.js';
import { fixtureNames } from '../../frontend/modules/seedlingDemo/fixtures/index.js';


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
/* ── ⛓⛓⛓ THE VERDICT, PER CATEGORY (R9 slice CAT, ⚖ 70 (d)) ──────────── */

/**
 * ⛔⛔ **THE DEBT IS PER CATEGORY, AND SO IS ITS BASELINE.** ⚖ 69 (c), the
 * user's own words: *"limit running the full tape to cases where there is
 * something that can only be tested in that way … make those a separate
 * category that only runs when we need to test that specifically."*
 *
 * The four populations are unchanged — they are still the only four things
 * that can move a `--win` verdict — but three of them (the BUILD, the DRIVER,
 * the DEAD-FRAME accounting) are exactly *"what can only be tested by the full
 * tier"*: a different game, a different way of reaching it, or a different
 * accounting of its dead frames is about EVERY tape, so a mover there owes
 * every category. The fourth (the TAPES, by projection) is about the tapes
 * that moved, so it owes only THEIR categories.
 *
 * ⛓ Each category is judged against ITS OWN head, so a category driven at the
 * head clears its own debt while the others keep theirs.
 */
const roster = rosterLabels({ tapesDir: TAPES });
const { categories: CATEGORIES } = assertTiersComplete(fixtureNames());
/** ⛓ Every category the row carries a part for, plus every one it does not. */
const PART_KEYS = Object.keys(row.categories ?? {});
const parts = compositeParts(row, [...new Set([...ROSTER_CATEGORIES, ...PART_KEYS])]);

/**
 * ⛓⛓ R9 slice CAT — TWO CHECKS ON THE ROW ITSELF, BEFORE ANY VERDICT, and
 * they live HERE rather than in `standing-values --check` for a measured
 * reason: this gate is headless and takes no box lock, and `--check` takes
 * one. With the box held by another session — the state this slice was
 * written in — a guard that only ran there could not be run at all.
 */
if (parts.length) {
    /**
     * ⛔ A DERIVED CATEGORY WITH NO PART IS A NAMED FAILURE. Add a fourth
     * category to `fixtures/tiers.js` and the row silently stops covering it:
     * its tapes are in no part, so no part's head is ever compared against
     * them and nothing is ever owed for them. That is the one failure a
     * category scheme must not be able to have, and it is invisible in every
     * other readout.
     */
    const missing = ROSTER_CATEGORIES.filter((c) => !PART_KEYS.includes(c));
    const extra = PART_KEYS.filter((c) => !ROSTER_CATEGORIES.includes(c));
    check(missing.length === 0 && extra.length === 0,
        '⛓ the row carries one part per DERIVED category — no category is unjudged',
        missing.length || extra.length
            ? `⛔ ${[missing.length ? `NO PART for ${missing.join(', ')} — its tapes are in no `
                + 'part, so nothing is ever owed for them' : null,
            extra.length ? `a part for ${extra.join(', ')}, which is not a derived category`
                : null].filter(Boolean).join(' · ')}`
            : `${PART_KEYS.join(', ')}`);
    /**
     * ⛔ AND THE ROW'S `value`/`why` ARE THE DERIVATION OF ITS PARTS — ⚖ 17
     * with teeth. The parts are the measurement; those two fields are a
     * rendering. Without this a hand edit would sit in the file looking
     * authoritative until somebody happened to re-quote a category — which is
     * exactly what the old prose `why` invited, and why this gate has always
     * had to announce that it refuses to read it.
     */
    const derivedValue = compositeValue(row, ROSTER_CATEGORIES);
    const derivedWhy = compositeWhy(row, ROSTER_CATEGORIES);
    check(row.value === derivedValue && row.why === derivedWhy,
        '⛓ the row\'s `value` and `why` are DERIVED from its parts, not typed (⚖ 17)',
        row.value === derivedValue && row.why === derivedWhy
            ? `${parts.length} part(s), rendered from the parts on every quote`
            : `⛔ THE FILE HAS BEEN EDITED BY HAND. ${row.value !== derivedValue
                ? `value: ${JSON.stringify(row.value)} vs derived ${JSON.stringify(derivedValue)}`
                : ''}${row.why !== derivedWhy ? `${row.value !== derivedValue ? ' · ' : ''}`
                + `why: ${JSON.stringify(String(row.why).slice(0, 70))}… vs derived `
                + `${JSON.stringify(String(derivedWhy).slice(0, 70))}…` : ''}. Re-quote the `
                + 'part with `record-standing-value.mjs --category=`');
}

/**
 * ⛔ A ROW WITHOUT PARTS IS STILL ANSWERED — as ONE category called `full`,
 * against the row's own head. The composite arrived in R9 slice CAT; a tree
 * whose file predates it must get a verdict rather than a crash, and the line
 * says which shape it read.
 */
const JUDGED = parts.length
    ? parts.map((p) => ({ category: p.category, base: p.measuredAt, tapes: CATEGORIES[p.category],
        part: p }))
    : [{ category: 'full', base: row.measuredAt, tapes: roster, part: null,
        legacyShape: true }];
if (!parts.length) {
    console.log('⛓ THE ROW CARRIES NO CATEGORY PARTS — it predates R9 slice CAT, so it is '
        + 'judged as ONE category called `full` against its own head. The verdict is the '
        + 'one this gate has always given; the per-category shape arrives with the row.');
}

/** ⛓ A baseline that is not in this clone is a REFUSAL, never a debt. */
const resolve = (ref, category) => {
    try { return git('rev-parse', `${ref}^{commit}`); } catch {
        return refuse(`the ${category} baseline \`${ref}\` is not in this clone`,
            'every verdict here is a diff against that commit, and a clone that does not '
            + 'carry it can make none of them. ⛓ This is the normal state in CI, where '
            + '`actions/checkout` clones at depth 1 — measured on this gate\'s first CI run, '
            + 'which read `0/1` and looked exactly like an owed tier');
    }
};

const HEAD = git('rev-parse', 'HEAD');

console.log('# check-seedling-full-tier-owed — is the standing full-tier value still about '
    + 'THIS tree?\n');
console.log(`## the standing row   ${ROSTER_KEY} = ${row.value}`);
console.log(`## HEAD               ${HEAD}`);
console.log(`## the parts          ${JUDGED.map((j) => `${j.category} ${j.tapes.length} tape(s) `
    + `@${String(j.base).slice(0, 9)}`).join(' · ')}`);
console.log(`## ⛓ the row's own \`why\` is PROSE and is NOT read here (⚖ 17): every verdict `
    + 'below is derived from the tree. ⛓ Since R9 slice CAT the `why` is itself DERIVED from '
    + 'the parts, which is what made this line cheap to keep true.\n');

/** Commits that touched a path in a range, subjects included. */
const movers = (base, paths) => {
    const files = git('diff', '--name-only', `${base}..HEAD`, '--', ...paths)
        .split('\n').filter(Boolean);
    if (!files.length) return { files: [], commits: [] };
    const commits = git('log', '--oneline', `${base}..HEAD`, '--', ...paths)
        .split('\n').filter(Boolean);
    return { files, commits };
};
const withCommits = (m) => `${m.files.join(', ')}\n${m.commits.map((c) => `        ${c}`)
    .join('\n')}`;

const gitlinkAt = (ref) => {
    const out = git('ls-tree', ref, WASM_SUBMODULE);
    const m = /^160000 commit ([0-9a-f]{40})\t/.exec(out);
    if (!m) throw new Error(`${ref} declares no gitlink for ${WASM_SUBMODULE}`);
    return m[1];
};

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

/**
 * ⛔⛔ THE DEAD-FRAME POPULATION IS GREPPED, NOT LISTED (⚖ 17) — **AND THE
 * DETECTOR IS THE ASSIGNMENT, NOT THE MENTION** (trap 566). The first cut was a
 * bare `git grep -l` and it returned FIFTEEN files of which THREE are PROSE.
 *
 * FOUR EXCLUSIONS, EVERY ONE NAMED IN THE OUTPUT:
 *   `.md`             prose. It mentions the accounting; it does not perform it.
 *   `*.test.js`       a test ASSERTS the accounting. Its edit cannot move the
 *                     game, and a test is red on its own when it is wrong.
 *   the standing file a record OF measurements, not a participant IN one.
 *   this gate         it names the token in order to grep for it.
 *
 * ⛓ `check-*.mjs` gates ARE INCLUDED, deliberately — trap 827.
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
 * file-level compare counted a box-lock PREAMBLE as owing a 142-minute tier.
 * `-G` can UNDER-include, so the wider set is COMPUTED AND PRINTED beside the
 * verdict — a bound must name what it bounds. The regex is the tightest of
 * four candidates measured to give the same answer, and it is PRINTED.
 */
const ACCOUNTING_LINE_RE = 'BOOT_PRESWAP_FRAMES|preSwapCorrection|dead_frames|deadFrames';
const accountingSince = (base) => {
    const all = movers(base, deadFrameFiles);
    const lines = deadFrameFiles.length
        ? git('diff', '--name-only', `-G${ACCOUNTING_LINE_RE}`, `${base}..HEAD`, '--',
            ...deadFrameFiles).split('\n').filter(Boolean)
        : [];
    const hit = lines.length
        ? { files: lines,
            commits: git('log', '--oneline', `-G${ACCOUNTING_LINE_RE}`, `${base}..HEAD`, '--',
                ...lines).split('\n').filter(Boolean) }
        : { files: [], commits: [] };
    return { all, hit };
};

const invisibleAll = [];
const owedCategories = [];
for (const judged of JUDGED) {
    const base = resolve(judged.base, judged.category);
    const debts = [];
    const cleared = [];

    /* (i) THE GAME BUILD — a different game; only the full tier can see it. */
    const wasmBefore = gitlinkAt(base);
    const wasmNow = gitlinkAt(HEAD);
    if (wasmBefore !== wasmNow) {
        debts.push(`⛔ (i) THE GAME BUILD moved — ${WASM_SUBMODULE} `
            + `${wasmBefore.slice(0, 12)} -> ${wasmNow.slice(0, 12)}: a different game was `
            + 'built, so every tape\'s verdict is about the old one. This is what only the '
            + 'FULL tier can test (⚖ 70 (f))');
    } else cleared.push(`(i) build @${wasmBefore.slice(0, 12)}`);

    /* (ii) THE DRIVER — how the tapes reach the game at all. */
    const driver = movers(base, [DRIVER]);
    if (driver.files.length) {
        debts.push(`⛔ (ii) THE DRIVER moved — ${withCommits(driver)}`);
    } else cleared.push('(ii) driver');

    /* (iii) THE TAPES — this category's, through BOTH projections. */
    const visible = [];
    const appeared = [];
    const vanished = [];
    for (const label of judged.tapes) {
        const before = rawAt(base, label);
        if (before === null) { appeared.push(label); continue; }
        const after = JSON.parse(readFileSync(join(TAPES, `${label}.json`), 'utf8'));
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const b = projectionsOf(before);
        const a = projectionsOf(after);
        const moved = [b.game !== a.game ? 'game-visible' : null,
            b.model !== a.model ? 'model-staging' : null].filter(Boolean);
        if (moved.length) visible.push(`${label} (${moved.join(' + ')})`);
        else invisibleAll.push(`${label} [${judged.category}]`);
    }
    for (const rel of git('diff', '--name-only', '--diff-filter=D', `${base}..HEAD`, '--',
        TAPES_REL).split('\n').filter(Boolean)) {
        const label = rel.split('/').pop().replace(/\.json$/, '');
        // ⛓ A DELETED tape has no category today, so it is charged to the
        // category that CARRIED it at the baseline — read from the baseline's
        // own roster rather than from a tree it is no longer in.
        if (judged.tapes.includes(label) || !roster.includes(label)) vanished.push(label);
    }
    if (visible.length || appeared.length || vanished.length) {
        debts.push('⛔ (iii) THE TAPES moved — '
            + [visible.length ? `moved: ${visible.join(', ')}` : null,
                appeared.length ? `APPEARED (never driven): ${appeared.join(', ')}` : null,
                vanished.length ? `VANISHED: ${vanished.join(', ')}` : null]
                .filter(Boolean).join(' · '));
    } else cleared.push(`(iii) ${judged.tapes.length} tape(s)`);

    /* (iv) THE DEAD-FRAME ACCOUNTING — nothing short of a full tier sees it. */
    const acc = accountingSince(base);
    if (acc.hit.files.length) {
        debts.push(`⛔ (iv) THE DEAD-FRAME ACCOUNTING moved — ${withCommits(acc.hit)}`);
    } else cleared.push('(iv) dead-frame accounting');

    const ticks = tickSumOf(judged.tapes, { tapesDir: TAPES });
    check(debts.length === 0,
        `⛓ the \`${judged.category}\` category is still about THIS tree — `
            + `judged against its OWN head @${base.slice(0, 9)}`,
        debts.length
            ? `${debts.join('\n      ')}\n      ⛓ RE-DRIVE IT: `
                + `node scripts/procgen/verify-seedling-bot-differential.mjs --win `
                + `--tier=${judged.category} — ${describeFullTierEstimate(
                    { tapes: judged.tapes.length, ticks })}`
            : `${cleared.join(', ')} — nothing this category is measured under has moved`);
    if (debts.length) owedCategories.push({ ...judged, base, ticks });
    if (acc.all.files.length) {
        console.log(`   ⛓ CONTEXT, not a verdict: ${acc.all.files.length} of `
            + `${deadFrameFiles.length} dead-frame file(s) moved AT ALL since `
            + `${base.slice(0, 9)} — ${acc.all.files.join(', ')}; ${acc.hit.files.length} of `
            + 'those moved an accounting LINE.');
    }
}

console.log(`\n   ⛓ the dead-frame line filter: \`git diff -G'${ACCOUNTING_LINE_RE}'\` over the `
    + `${deadFrameFiles.length} file(s) derived by grepping \`${DEAD_FRAME_TOKEN}\`: `
    + `${deadFrameFiles.join(', ')}`);
console.log('   ⛓ EXCLUDED, and named: `.md` (prose mentions the accounting, it does not '
    + 'perform it — trap 566), `*.test.js` (a test asserts it), the standing-values file '
    + 'and this gate. ⛓ `check-*.mjs` gates are deliberately IN (trap 827).');
/**
 * ⛔ AND THE BOUND NAMES WHAT IT EXCLUDED. A "0 moved" line that quietly
 * dropped byte-movers would imply a coverage it does not have.
 */
if (invisibleAll.length) {
    console.log(`   ⛓ EXCLUDED, and named: ${invisibleAll.length} tape(s) moved in bytes `
        + `NEITHER side of the differential reads — ${invisibleAll.join(', ')}. \`tick0\` is `
        + 'a `GAME_VISIBLE_DROPS` field and `stagingFromTape` never forwards it, so the '
        + 'measurement still holds for them. This was MEASURED, not taken from the row\'s '
        + '`why`.');
}

/* ── the estimate, so the cost is beside the decision ────────────────── */

console.log(`\n## THE WHOLE ROSTER, IF IT IS EVER OWED: ${describeFullTierEstimate(
    { tapes: roster.length, ticks: tickSumOf(roster, { tapesDir: TAPES }) })}`);
if (owedCategories.length) {
    const tapes = owedCategories.reduce((n, c) => n + c.tapes.length, 0);
    const ticks = owedCategories.reduce((n, c) => n + c.ticks, 0);
    console.log(`## WHAT IS ACTUALLY OWED HERE: ${owedCategories.map((c) => c.category)
        .join(' + ')} — ${describeFullTierEstimate({ tapes, ticks })}`);
}
console.log('## ⛔ AN ESTIMATE IS NEVER THE MEASUREMENT. A standing value is what a run '
    + 'PRODUCED; this number exists only to price the decision to run one.');

if (failed) {
    console.log(`\n## ⛔ ${failed} CATEGORY(IES) OWE A DRIVE. Nothing here says the tree is `
        + 'BROKEN — it says that part of the standing row describes a tree that no longer '
        + 'exists, and the only cure is the drive. ⚖ 70 (f): a tape-moving change lands with '
        + 'the categories its reach names re-driven at the head; the FULL tier is owed by a '
        + 'build/gitlink, driver-contract, tape-format or dead-frame change, or the user\'s '
        + 'word. Drive the named categories, then record each part with '
        + '`record-standing-value.mjs --key=' + JSON.stringify(ROSTER_KEY)
        + ' --category=<name> --tapes=<n> --quote=<value> --measured-at=<sha>`.');
}
console.log(failed === 0
    ? `\nALL PASS — every category of the checkpoint row is still about this tree `
        + `(${JUDGED.map((j) => `${j.category} @${String(j.base).slice(0, 9)}`).join(', ')})`
    : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
