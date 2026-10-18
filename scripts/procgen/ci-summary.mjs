#!/usr/bin/env node
/**
 * ci-summary — **A PUSHED HEAD'S CI ANSWER, BY SHA — THE SUITE OR ONE GATE**
 * (R9 slice P3b (g), ⚖ ruling 54 (6); ⚖ 52 generalised).
 *
 *   node scripts/procgen/ci-summary.mjs [<sha>] [--wait] [--json]
 *   node scripts/procgen/ci-summary.mjs [<sha>] --gate='<standing key>' [--json]
 *   node scripts/procgen/ci-summary.mjs [<sha>] --gates [--json]
 *   node scripts/procgen/ci-summary.mjs --run=<run id> --gates
 *
 * Without `--gate=` this is exactly what `ci-vitest-summary.mjs` has always
 * been — and that file is now a SHIM onto this one, so the `suite:` standing
 * row's committed `command` string and its stdout are unmoved (⚖ 8 publishes
 * command strings as identity; generalising an instrument must not quietly
 * move a standing row's subject).
 *
 * With `--gate=` it reads ONE line printed by `ci-gates.mjs`, gathered across
 * EVERY job of that SHA's run — since S3 the browser gates run in a matrix of
 * shard jobs, so one job's log is no longer the whole answer.
 *
 * Exit codes: 0 green · 1 red · 2 no run for this SHA · 3 not concluded
 * (`--wait` polls) · 4 the log carries no such answer · 5 REFUSED BY NAME —
 * CI cannot answer this key at all · 6 a BROWSER key at a SHA whose browser
 * shards were SKIPPED (ci-skip-rules rule 2: a docs-only push) — read the last
 * code head, whose line still holds.
 *
 * ── ⛓⛓⛓ `--gates`: **THE WHOLE VERDICT SET, AGAINST THE BANK** ───────
 *
 * ⚖ 72 (b) sets the bar a row must clear before the bank may quote CI for it:
 * **three consecutive CI runs whose verdict sets equal the banked values.**
 * Comparing two dozen keys by eye once per run is how a bar gets recorded as
 * "looked fine". This form prints one row per `## CI-GATE |` line at a SHA,
 * beside the bank's value for the SAME key, and exits non-zero if any COMPARED
 * pair disagrees.
 *
 * ⛔ A LINE WITH NO BANK ROW IS `not-banked`, NEVER A MATCH. A `@ci-face` key
 * (`structure: …` — `gate-help-ci: …` was the other one until S5 retired it)
 * is a DIFFERENT, bounded claim and the bank holds no row under it — counting
 * it as agreement would be the quiet zero this file's whole refusal ladder
 * exists to prevent.
 * ⛔ AND A BANKED ARM WITH NO LINE IS `MISSING`, which is the direction that
 * matters: a shard that never ran must read as an absent answer, not as a
 * smaller verdict set that happens to agree with itself.
 *
 * ── ⛔⛔ THE REFUSAL IS THE POINT OF THE `--gate=` FORM ────────────────
 *
 * Asking this file for a key CI does not produce must be a NAMED REFUSAL and
 * never `0/0`: a quiet zero is how a row that gates nothing gets quoted as a
 * measurement. Two things are refused, and the population is DERIVED — the
 * roster answers both, so neither can outlive what it refused:
 *
 *   · a gate `ciGatePlan.ciRunnable` rejects — the Windows rows, and since
 *     V3b the gates that declare `@ci-box` (refused with their OWN reason),
 *     which hold `/mnt/c/Windows/py.exe` and could not resolve their driver
 *     on a runner at all (⚖ 72 (a): they stay box-measured);
 *   · a gate that declares an `@ci-face`, asked for its `gate:` key — its CI
 *     answer is a DIFFERENT, bounded claim under its own prefix. ⛓ S5 retired
 *     `procgen-help`'s face by teaching CI the FULL claim (`@ci-argv`, the
 *     same key), so this rung now fires for `structure:` alone — the refusal
 *     is DERIVED from the declaration, so it shrank without being edited;
 *   · a gate that declares an `@ci-shallow` (S4) — CI runs it and prints a
 *     line, but the line answers a DEPTH-1 CLONE's question, not this tree's,
 *     and `--gates` reports it as `shallow` rather than comparing it.
 *
 * ⛓⛓ S3 (⚖ 72) RETIRED THE BROWSER HALF OF THIS REFUSAL. Until then the
 * sentence here read *"twenty-seven of thirty-one gates need a browser or a
 * Windows GPU and CI runs none of them"*; `unittests_frontend.yml` now runs
 * every browser arm in a matrix of shard jobs, so those keys HAVE answers and
 * refusing them would be a refusal about a world that no longer exists.
 * ⛓⛓ AND S4 IS THE OTHER HALF: `ciGatePlan.ciSourced` now selects the rows
 * whose `command` reads this path — CI-runnable ∧ ¬cheap ∧ no declared
 * `@ci-face` ∧ no declared `@ci-shallow` — so this file is a STANDING VALUE'S
 * SOURCE now and not only a reader's convenience. ⛔ Which is why the refusal
 * ladder grew a third rung rather than a special case: every key it refuses
 * is a key `ciSourced` must never select, and the two are derived from the
 * same roster row.
 */

import { execFileSync } from 'node:child_process';

import { ciGateArms, ciRunnable, ciUnrunnableIdentityRows } from './ciGatePlan.js';
import { REPO, gateRoster } from './gateRoster.js';
import { browserShardsRan } from './ciDocsOnly.js';
import {
    findRun, gateLogs, gateVerdicts, jobLogById, parseGateLines, parseSummaries, runById,
    runJobs, suiteJobs, sumSummaries,
} from './ciSummary.js';
import { readStandingValues } from './standingValues.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const arg = (n) => (args.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || null;

const wait = flag('wait');
const json = flag('json');
const GATE = arg('gate');
const ALL_GATES = flag('gates');
let sha = args.find((a) => !a.startsWith('--'))
    || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

/* ── ⛔ the refusal, DERIVED from the roster, before any network call ── */

if (GATE) {
    const roster = gateRoster({ repo: REPO });
    const nameOf = (g) => g.file.replace(/^check-/, '').replace(/\.mjs$/, '');
    /**
     * ⛔⛔ **A KEY IS RESOLVED THROUGH THE ARMS FIRST, AND S4 FOUND OUT WHY BY
     * BEING REFUSED BY ITS OWN LADDER.** The name derivation below strips the
     * `<prefix>: ` and matches a gate FILE — which is right for a gate's base
     * row and WRONG for a declared second arm: `gate: seedling-editor-generate
     * (own server)` becomes `seedling-editor-generate (own server)`, no file
     * is named that, and the reader refuses a key CI publishes a line under.
     * Measured: the first `--write` after S4 KEPT that row with *"no gate
     * named …"* — a row frozen by the reader, which is P4b (D)'s defect in a
     * second costume and the exact hazard the ¬ciFace clause exists for.
     *
     * ⇒ the arms are the population that PUBLISHES, so they are the population
     * that resolves. The file-name fallback stays for a key no arm claims (a
     * Windows gate, a retired arm), so both refusals below still fire by name.
     */
    const arm = ciGateArms({ repo: REPO, set: 'all' })
        .find((a) => a.key === GATE || a.bankKey === GATE);
    const asked = GATE.replace(/^[a-z-]+:\s*/, '');
    const gate = arm?.gate ?? roster.find((g) => nameOf(g) === asked);
    /**
     * ⛓⛓⛓ S4c — **AN IDENTITY ARM HAS NO GATE, AND EVERY RUNG BELOW ASKS A
     * GATE A QUESTION.** `plan-seedling-r7-ends-meet --check` is an arm CI
     * publishes a line for; without this the ladder would fall through to the
     * file-name fallback, find no `check-*.mjs` named after it, and REFUSE by
     * name — a row frozen by its own reader, which is exactly the defect S4
     * shipped and had to repair one costume over (see the paragraph above).
     *
     * ⛔ NOTHING IS SKIPPED HERE THAT COULD APPLY. `ciIdentityArms` builds no
     * arm for a row whose instrument holds the Windows driver, so the ⚖ 72 (a)
     * rung is already spent BEFORE this point; and `@ci-face`/`@ci-shallow`
     * are gate declarations with no identity analogue. An identity key that is
     * NOT an arm still reaches the refusal below and is named there.
     */
    const identityArm = arm && !arm.gate ? arm : null;
    if (!identityArm && !gate) {
        /**
         * ⛔ S4c — an IDENTITY key that no arm claims is refused with its own
         * reason, never with a sentence about `check-*.mjs`. The only way to
         * be an identity row with no arm is ⚖ 72 (a).
         */
        const winRow = ciUnrunnableIdentityRows({ repo: REPO }).find((r) => r.key === GATE);
        if (winRow) {
            console.error(`REFUSED: ${JSON.stringify(GATE)} runs an instrument that holds the `
                + 'Windows Python driver (`/mnt/c/Windows/py.exe`), which a runner does not '
                + 'have — so no answer for it exists at any SHA. Its standing row is measured '
                + 'on the box (⚖ 72 (a)). ⛔ This is a refusal, not a 0/0.');
            process.exit(5);
        }
        console.error(`REFUSED: no gate named ${JSON.stringify(asked)} is on the roster — `
            + `${roster.length} gate(s) derived from scripts/procgen/check-*.mjs`);
        process.exit(5);
    }
    /**
     * ⛔ V3b — `ciRunnable` has TWO clauses and they refuse with two different
     * sentences. A Windows row has NO answer at any SHA; a `@ci-box` row has
     * one, and it is the box's, for the reason the gate itself gives. Reading
     * them back as one message is how a reader concludes a gate is unanswerable
     * when it is merely un-adopted.
     */
    if (!identityArm && gate.ciBox) {
        console.error(`REFUSED: ${gate.file} declares \`@ci-box\` — ${gate.ciBox.reason.replace(/\.$/, '')}.`
            + ' CI runs no arm for it and prints no line, so there is nothing here to quote.'
            + ' Its standing row is measured on the box, and adopting it into CI is deleting'
            + ' that one line. ⛔ This is a refusal, not a 0/0.');
        process.exit(5);
    }
    if (!identityArm && !ciRunnable(gate)) {
        console.error(`REFUSED: ${gate.file} drives the Windows Python driver`
            + ' (`/mnt/c/Windows/py.exe`), which a runner does not have — so no answer for it'
            + ' exists at any SHA. Its standing row is measured on the box (⚖ 72 (a)).'
            + ' ⛔ This is a refusal, not a 0/0.');
        process.exit(5);
    }
    /**
     * ⛔⛔ S4 (⚖ 72; trap 1058) — A GATE THAT DECLARES `@ci-shallow` IS ASKING
     * A QUESTION `actions/checkout`'s DEPTH-1 CLONE CANNOT ANSWER. CI still
     * runs it and still prints its line — the line is evidence for whoever
     * repairs the gate — but that line is an answer about a tree with one
     * commit in it, and handing it back here would let a `--write` bank the
     * shallow clone's number as this tree's truth under the right key. ⛓ The
     * exclusion that MATTERS is `ciSourced`, which never routes such a row
     * down this path; this refusal is the second lock, so that a widening
     * that forgot the clause goes red BY NAME instead of quietly banking.
     */
    if (!identityArm && gate.ciShallow) {
        console.error(`REFUSED: ${gate.file} declares \`@ci-shallow\` — ${gate.ciShallow.reason}.`
            + ' CI runs it and prints a line, but that line is an answer about a depth-1'
            + ' checkout and NOT about this tree, so it is not this row\'s value. Its standing'
            + ' row is measured on the box. ⛔ This is a refusal, not a 0/0.');
        process.exit(5);
    }
    if (!identityArm && gate.ciFace && GATE.startsWith('gate:')) {
        console.error(`REFUSED: ${gate.file} declares \`@ci-face ${gate.ciFace.prefix}\`, so CI `
            + `publishes \`${gate.ciFace.prefix}: ${asked}\` and NOT \`gate: ${asked}\`. Its `
            + 'VALUE cannot survive a fresh checkout — asking for it here would return a '
            + 'number about a different claim. ⛔ This is a refusal, not a 0/0.');
        process.exit(5);
    }
}

/* ── the run ─────────────────────────────────────────────────────────── */

/** ⛓ `--run=<id>` names ONE run; without it the SHA's newest is taken. */
const RUN_ID = arg('run');
let run = RUN_ID ? runById(RUN_ID) : findRun(sha);
/** ⛔ …and the REPORTED sha becomes that run's head, never the local HEAD a
 *  reader happened to be sitting on when they asked about a run id. */
if (run && RUN_ID) sha = run.headSha;
if (!run) {
    console.error(`no ${GATE ? 'procgen-gate' : 'JavaScript Unit Tests'} run for ${sha} `
        + '(not pushed, or the path filter did not trigger it)');
    process.exit(2);
}
/**
 * ⛓⛓⛓ **R1 — THE SUITE WAITS ON ITS OWN JOB, NOT ON THE RUN.**
 * `unittests_frontend.yml` keeps the run `in_progress` while the browser gate
 * shards finish (S3's matrix), so a reader asked for the suite's numbers got
 * *"run … is in_progress — pass --wait"* minutes after the Vitest job had
 * concluded and its log was final. A run's status is an answer about its
 * SLOWEST job; the suite's numbers are an answer about ONE.
 *
 * ⛔ The GATE arms are not given this: their lines are spread ACROSS the shard
 * jobs, so for them the run really is the unit of completeness.
 */
const suiteArm = !GATE && !ALL_GATES;
/**
 * ⛓⛓ ci-jsut-split — **THE SUITE IS A FAMILY OF JOBS, AND `--wait` WAITS ON
 * EVERY MEMBER.** Three `Vitest shard k/3` jobs and the `slow Vitest` job; the
 * answer exists when ALL of them have concluded, and until then the reader
 * names the ones it is waiting on (fidelity-9's ask: never "pending", always
 * "pending ON WHAT").
 */
let suite = suiteArm ? suiteJobs(runJobs(run)) : null;
const jobDone = () => suite && suite.layout !== 'none' && suite.pending.length === 0;
const waitingOn = () => (suite?.pending ?? []).map((j) => `"${j.name}" ${j.status}`).join(', ');
const deadline = Date.now() + 40 * 60 * 1000;
let lastWaiting = null;
while (run.status !== 'completed' && !jobDone()) {
    if (!wait) {
        console.error(`run ${run.databaseId} for ${sha} is ${run.status}`
            + (suite?.pending.length ? ` and its suite is waiting on ${waitingOn()}` : '')
            + ' — pass --wait');
        process.exit(3);
    }
    if (suiteArm && waitingOn() !== lastWaiting) {
        lastWaiting = waitingOn();
        console.error(`⏳ run ${run.databaseId}: waiting on ${lastWaiting || '(no suite job listed yet)'}`);
    }
    if (Date.now() > deadline) {
        console.error(`run ${run.databaseId} still ${run.status} after 40 min`
            + (suite?.pending.length ? ` — still waiting on ${waitingOn()}` : ''));
        process.exit(3);
    }
    await new Promise((r) => setTimeout(r, 30_000));
    run = findRun(sha);
    if (suiteArm) suite = suiteJobs(runJobs(run));
}
/**
 * ⛓ THE SUITE LIVES IN ONE JOB; THE GATE LINES ARE SPREAD ACROSS ALL OF THEM
 * (S3's shard matrix). Asking for every job's log when only the suite is
 * wanted would pay four extra API round trips for nothing.
 */
const gathered = suiteArm ? null : gateLogs(run);
const log = gathered ? gathered.log : null;

/* ── --gates: the whole verdict set, beside the bank's ───────────────── */

if (ALL_GATES) {
    const lines = parseGateLines(log);
    const bank = readStandingValues({ repo: REPO })?.rows ?? {};
    /** ⛓ CI key -> the STANDING key its value belongs under. They differ for a
     *  declared `@ci-face`, which is exactly the pair that must not compare. */
    const arms = ciGateArms({ repo: REPO, set: 'all' });
    /** ⛓ S4 — the rule itself is `ciSummary.gateVerdicts`, a pure function of
     *  (lines, bank, arms) so its edges can be asked without a runner. */
    const { rows, missing } = gateVerdicts({ lines, bank, arms });
    const moved = rows.filter((r) => r.verdict === 'MOVED');
    if (json) {
        console.log(JSON.stringify({ sha, run: run.databaseId, conclusion: run.conclusion,
            jobs: gathered.jobs, unreadable: gathered.unreadable, rows, missing,
            battery: gathered.battery }, null, 2));
    } else {
        console.log(`CI gates @ ${sha.slice(0, 9)} — run ${run.databaseId} ${run.conclusion}, `
            + `${gathered.jobs} job(s), ${rows.length} line(s)`);
        for (const r of rows.sort((a, b) => a.key.localeCompare(b.key))) {
            console.log(`  ${r.verdict.padEnd(10)} ${r.key.padEnd(44)} ci=${r.value}`
                + `${r.verdict === 'MOVED' || r.verdict === 'shallow' ? `  bank=${r.banked}` : ''}`
                + `  exit=${r.exit}`);
            /** ⛔ …and WHY it is not a comparison, in the row itself. */
            if (r.verdict === 'shallow') console.log(`             ⛔ @ci-shallow: ${r.shallow}`);
        }
        for (const k of missing) console.log(`  MISSING    ${k}`);
        for (const t of gathered.battery.truncated) {
            console.log(`  ⛔ TRUNCATED: "${t.job}" planned ${t.planned} arm(s) and printed `
                + `${t.printed}${t.done ? '' : ' — no CI-DONE line (cut by its step deadline?)'}`);
        }
        for (const t of gathered.battery.tight) {
            console.log(`  ⚠ HEADROOM: "${t.job}" ran ${t.elapsedS}s of its ${t.deadlineS}s step deadline`);
        }
        /** ⛓ RULE 2 — a docs-only push ran no browser shard; say so beside the MISSING rows. */
        if (missing.length && !browserShardsRan(runJobs(run))) {
            console.log('  ⛓ rule 2: this run SKIPPED its browser shards (a docs-only push), so '
                + 'every browser row reads MISSING here by design — read the last code head.');
        }
        if (gathered.unreadable.length) {
            console.log(`  ⚠ ${gathered.unreadable.length} job log(s) unreadable: `
                + gathered.unreadable.join('; '));
        }
        console.log(`\n${rows.filter((r) => r.verdict === 'same').length} same, `
            + `${moved.length} MOVED, `
            + `${rows.filter((r) => r.verdict === 'shallow').length} shallow (declared, never `
            + 'compared), '
            + `${rows.filter((r) => r.verdict === 'not-banked').length} not-banked, `
            + `${missing.length} MISSING.`);
        /**
         * ⛔⛔ ⚖ 72 (b) IS A PER-ROW BAR, AND READING IT PER-RUN WOULD BLOCK
         * EVERY ROW ON THE WORST ONE. The ruling reads *"three consecutive CI
         * runs whose verdict sets equal the banked values before A ROW flips"*.
         * Measured at S3: two headless rows are MOVED in CI at EVERY head and
         * always will be — `seedling-full-tier-owed` refuses by name in a
         * depth-1 clone, and `slice-records` reads the shallow clone's own HEAD
         * as the convention's start. A run-level reading would hold the other
         * 25 rows hostage to those two forever. So this exit code is the
         * RUN-level answer (useful as "did anything move at all"), and the
         * per-row column above is the one S4 consumes.
         */
        console.log('⚖ 72 (b): the bar is PER ROW — three consecutive runs in which THAT row '
            + 'reads `same`. This exit code is the run-level answer, not the bar; since S4 a '
            + '`shallow` row is outside BOTH (it is excluded from the CI-sourced set by its '
            + 'own declaration, not by a verdict).');
    }
    process.exit(moved.length || missing.length || gathered.battery.truncated.length ? 1 : 0);
}

/* ── --gate=: one line, read out of the job log ──────────────────────── */

if (GATE) {
    const rows = parseGateLines(log);
    const row = rows.get(GATE);
    /**
     * ⛓⛓ ci-skip-rules RULE 2 — A BROWSER KEY AT A DOCS-ONLY HEAD IS A NAMED
     * REFUSAL, not "no such line": the shards were skipped on purpose, and
     * `ciDocsOnly.test.js` holds that no CI-sourced browser row reads what such
     * a push can change — so the last code head's line is still this head's.
     */
    const armIsBrowser = ciGateArms({ repo: REPO, set: 'browser' })
        .some((a) => a.key === GATE || a.bankKey === GATE);
    if (!row && armIsBrowser && !browserShardsRan(runJobs(run))) {
        console.error(`run ${run.databaseId} at ${sha} SKIPPED its browser gate shards — a `
            + 'docs-only push (ci-skip-rules rule 2) — so it carries no line for '
            + `${JSON.stringify(GATE)}. Read the last CODE head (or dispatch the workflow on this `
            + 'branch to force the shards). ⛔ This is a refusal, not a 0/0.');
        process.exit(6);
    }
    if (!row) {
        console.error(`run ${run.databaseId} (${run.conclusion}) carries no `
            + `\`## CI-GATE | ${GATE} |\` line across its ${gathered.jobs} job(s). `
            + `${rows.size} gate line(s) present: `
            + `${[...rows.keys()].join(', ') || '(none — the step did not run)'}`
            + (gathered.battery.truncated.length
                ? `\n⛔ TRUNCATED battery: ${gathered.battery.truncated.map((t) => `"${t.job}" printed `
                    + `${t.printed} of ${t.planned}`).join('; ')} — the line may be one it never reached`
                : '')
            + (gathered.unreadable.length
                ? `\n⚠ ${gathered.unreadable.length} job log(s) could not be read, so this `
                  + `may be a job that never ran rather than a missing line: `
                  + `${gathered.unreadable.join('; ')}`
                : ''));
        process.exit(4);
    }
    if (json) console.log(JSON.stringify({ sha, run: run.databaseId, ...row }, null, 2));
    else {
        console.log(`CI gate @ ${sha.slice(0, 9)} — run ${run.databaseId} ${run.conclusion}`);
        console.log(`  ${row.key}  ${row.value}   exit=${row.exit}   ${row.total ?? ''}`);
    }
    /** ⛔ THE LINE'S OWN EXIT, never the job conclusion — 12g′'s lesson. */
    process.exit(row.exit === 0 ? 0 : 1);
}

/* ── the suite ───────────────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ ci-jsut-split — ONE SUITE ANSWER, SUMMED ACROSS THE SHARDS.
 *
 * ⛔ Every way the sum could be partial is a NAMED refusal (exit 4, no JSON, so
 * `standing-values --write` KEEPS the row): a shard the listing does not carry,
 * a skipped member, or a member whose log has no vitest summary (cancelled, or
 * died before vitest printed). A member that ran and FAILED is summed and reads
 * red (exit 1) with its name, because its numbers are whole.
 */
if (suite.layout === 'none') {
    console.error(`run ${run.databaseId} (${run.conclusion}) has no JavaScript Unit Tests job at all`);
    process.exit(4);
}
if (suite.missing.length) {
    console.error(`run ${run.databaseId} (${run.conclusion}) — the suite is INCOMPLETE, so no sum is `
        + `printed: ${suite.missing.join('; ')}. ⛔ A partial suite is never a smaller green one.`);
    process.exit(4);
}
let unit; let slow; let members;
if (suite.layout === 'single') {
    [unit, slow] = parseSummaries(jobLogById(suite.single.id));
    members = [{ name: suite.single.name, status: suite.single.status,
        conclusion: suite.single.conclusion }];
    if (!unit) { console.error(`run ${run.databaseId} (${run.conclusion}) has no vitest summary in its log — read it yourself`); process.exit(4); }
} else {
    const read = (job) => ({ job, summary: parseSummaries(jobLogById(job.id))[0] });
    const shardRows = suite.shards.map((s) => read(s.job));
    const slowRow = read(suite.slow);
    const blank = [...shardRows, slowRow].filter((r) => !r.summary);
    if (blank.length) {
        console.error(`run ${run.databaseId} (${run.conclusion}) — no vitest summary in the log of `
            + `${blank.map((r) => `"${r.job.name}" (${r.job.conclusion ?? r.job.status})`).join(', ')}`
            + ', so the suite is INCOMPLETE and no sum is printed. ⛔ A partial suite is never a '
            + 'smaller green one.');
        process.exit(4);
    }
    unit = sumSummaries(shardRows.map((r) => r.summary));
    slow = slowRow.summary;
    members = [...shardRows, slowRow].map((r) => ({ name: r.job.name, status: r.job.status,
        conclusion: r.job.conclusion, files: r.summary.files, tests: r.summary.tests }));
}
/** ⛓ The family's worst conclusion — `success` only when every member's is. */
const RANK = ['success', 'neutral', null, 'skipped', 'cancelled', 'timed_out', 'failure'];
const worst = suite.family.map((j) => j.conclusion)
    .reduce((w, c) => (RANK.indexOf(c) > RANK.indexOf(w) ? c : w), 'success');
const unitJob = { name: suite.layout === 'single' ? suite.single.name
    : `JavaScript Unit Tests (${suite.shards.length} Vitest shards + slow)`,
status: suite.pending.length ? 'in_progress' : 'completed',
conclusion: suite.pending.length ? null : worst };

const out = {
    sha, run: run.databaseId, conclusion: run.conclusion, createdAt: run.createdAt,
    /**
     * ⛓ R1 — the JOB the numbers came out of, beside the run's own status. ⛔
     * `conclusion` above stays the RUN's: `standing-values.json`'s `suite:` row
     * reads that field (`standingValues.js:458`), and moving its meaning under
     * an unchanged name is exactly the ⚖ 8 hazard the shim above exists for.
     */
    job: { name: unitJob.name, status: unitJob.status, conclusion: unitJob.conclusion },
    /** ⛓ ci-jsut-split — every job the sum came out of, with its own numbers. */
    jobs: members,
    standingRow: `${unit.files.total}/${unit.tests.total}`,
    unit, slow,
};
if (json) console.log(JSON.stringify(out, null, 2));
else {
    console.log(`CI vitest @ ${sha.slice(0, 9)} — run ${run.databaseId} `
        + `${run.conclusion ?? run.status} (${run.createdAt})`);
    for (const m of members) {
        console.log(`  job "${m.name}"  ${m.status}${m.conclusion ? ` ${m.conclusion}` : ''}`
            + `${m.files ? `  ${m.files.total}/${m.tests.total}${m.tests.failed ? ` (${m.tests.failed} failed)` : ''}` : ''}`);
    }
    console.log(`  suite: vitest (unfiltered)  ${out.standingRow}   (${unit.tests.passed} passed | ${unit.tests.skipped} skipped | ${unit.tests.failed} failed)`);
    console.log(slow ? `  slow battery                ${slow.files.total}/${slow.tests.total}   (${slow.tests.passed} passed | ${slow.tests.failed} failed)` : '  slow battery                (no summary — step cancelled?)');
}
/**
 * ⛓ R1 — while the RUN is still open the verdict is the JOB's: `run.conclusion`
 * is `null` there, and reading `null !== 'success'` as red would call a green
 * suite red for the duration of a browser shard.
 */
/**
 * ⛓ ci-jsut-split — for a SPLIT run the verdict is the suite FAMILY's: since the
 * "Battery complete?" step a gate job can be red, and a cut gate battery is not
 * a red suite. A pre-split run keeps the run's conclusion, as before.
 */
const suiteConclusion = suite.layout === 'split' && !suite.pending.length ? worst
    : run.status === 'completed' ? run.conclusion : (unitJob?.conclusion ?? run.conclusion);
/** ⛓ ci-jsut-split — and every member's own, so a red shard is red by name even
 *  if the run's conclusion were ever to hide it. */
const redMembers = members.filter((m) => m.conclusion !== 'success');
if (redMembers.length) {
    console.error(`⛔ red member(s): ${redMembers.map((m) => `"${m.name}" ${m.conclusion}`).join(', ')}`);
}
const red = unit.tests.failed > 0 || (slow && slow.tests.failed > 0)
    || suiteConclusion !== 'success' || redMembers.length > 0;
process.exit(red ? 1 : 0);
