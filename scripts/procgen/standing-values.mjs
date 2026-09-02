#!/usr/bin/env node
/**
 * standing-values — **THE COMMITTED ARTIFACT THAT REPLACES TWENTY NUMBERS IN
 * EVERY HANDSHAKE** (R9 slice 12e, ⚖ ruling 38 item (5)).
 *
 * ⚖ Ruling 32 A made mechanical. A slice's BEFORE is `standing-values.json` at
 * its head; its AFTER is `--write` and a `git diff` of that file. The
 * orchestrator's handshake stops transcribing and says *"standing values: the
 * file at `<head>`"*.
 *
 * ⛔ NOTHING IN THE FILE IS TYPED. Every row's value comes from the command
 * printed beside it, and the rows themselves are derived — see
 * `standingValues.js`, which holds the derivation and the reasons.
 *
 * ── Run ───────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/standing-values.mjs --write        measure everything
 *   node scripts/procgen/standing-values.mjs --write --only=producer
 *   node scripts/procgen/standing-values.mjs --write --key='gate: x (arm)'
 *   node scripts/procgen/standing-values.mjs --check        re-run the CHEAP
 *                                                           rows and diff
 *   node scripts/procgen/standing-values.mjs --list         the rows, derived
 *   node scripts/procgen/standing-values.mjs --quote        print the block a
 *                                                           handshake used to
 *                                                           re-type
 *   node scripts/procgen/standing-values.mjs --keys         every keyed row's
 *                                                           INPUT KEY and its
 *                                                           four populations,
 *                                                           against the bank
 *                                                           (box-free)
 *   node scripts/procgen/standing-values.mjs --write --rekey
 *   node scripts/procgen/standing-values.mjs --write --force-row='gate: x'
 *   node scripts/procgen/standing-values.mjs --write --redrive-unchanged
 *
 *   --host=<origin>   the repo-root dev server the gate rows are pointed at
 *   --only=<substr>   restrict to matching keys
 *   --key=<key>       restrict to ONE key, matched EXACTLY
 *   --json            machine-readable
 *
 * ⛔⛔ `--only=` IS A SUBSTRING AND THAT IS A TRAP ONCE A GATE HAS TWO ARMS
 * (editor v3 · Q6). `--only=seedling-editor-generate` selected one row until
 * `gate: seedling-editor-generate (own server)` existed; now it selects BOTH,
 * and the second is a ~2-minute browser row that brings its own server. A
 * merge recipe that names a row by substring is a recipe that silently grows
 * a measurement. `--key=` matches the whole key and REFUSES BY NAME when it
 * matches nothing, so a typo in a quoted key is a red line rather than a
 * `--write` that measures zero rows and reports success.
 *
 * ⛔⛔ `--check` NEVER RE-RUNS AN EXPENSIVE ROW. The Windows/GPU rows and the
 * unfiltered vitest are QUOTED with the head they were measured at. A check
 * that costs an hour is a check nobody runs, and a standing value nobody
 * checks is the thing this file exists to stop.
 *
 * ⚖ **R9 RULING 52 (user, 2026-08-25): THE UNFILTERED SUITE IS CI'S, READ BY
 * SHA.** `suite: vitest (unfiltered)` is no longer an `npx vitest run` here —
 * its recipe is `ci-vitest-summary.mjs --json`, which reads the same numbers
 * out of the `JavaScript Unit Tests` job log for a pushed head, and the row is
 * `alwaysQuoted` so `--check` prints it rather than re-reading it. A local
 * vitest run is now BOUNDED to the files a slice touched.
 *
 * ⚖ **R9 RULING 71 (a) (user, 2026-08-30): A GATE ROW RE-RUNS AT `--write`
 * ONLY WHEN ITS INPUT BYTES MOVED.** Four rows are 68 % of a 56.8-minute
 * battery and a `--write` paid all four every time, whether or not anything
 * they measure had changed. Each keyed row now carries an `inputKey` over its
 * four enumerated input populations (`rowInputKey.js` — CODE / DATA / SPAWN /
 * BUILD); a `--write` re-runs the row iff that key moved since the banked one,
 * and an unchanged key CARRIES THE BANKED VALUE FORWARD SAYING SO — its own
 * `measuredAt` kept, `quotedAtKey` naming the head at which the key was
 * confirmed unmoved. This is ⚖ 70's pattern ("re-drive what the reach names,
 * quote the rest, saying so") moved from tape categories to gate rows.
 *
 * ⛔⛔ **`cheap` AND THE KEY ARE NOT COUPLED, AND MUST NOT BE.** `cheap`
 * governs `--check`: a cheap row re-runs on every check regardless of its key,
 * because a check is how a slice notices its own tree moved under it. The KEY
 * governs `--write`. They answer different questions ("can a slice afford to
 * re-run this?" vs "is the banked answer still an answer about these bytes?")
 * and one field doing both would silently drop the cheaper of the two duties.
 *
 * ⛔ **THE STALE-GREEN RISK IS REAL AND HAS THREE MITIGATIONS**, all built:
 * the populations are PRINTED per row (counts + digests, so "what did this key
 * cover" is answerable from the log); `--redrive-unchanged` re-runs at an
 * unchanged key and a moved verdict is a NAMED nondeterminism finding that
 * exits non-zero rather than a silent re-bank (trap 866); `--rekey` and
 * `--force-row=` re-measure on the user's word. `rowInputKey.js`'s docblock
 * carries the same three sentences beside the derivation they are about.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertTreeUnmoved, releaseBoxLock, takeBoxLock } from './boxLock.js';
import { CI_SHARD_BUDGET_MS, ciSourced, lastRunShardAudit } from './ciGatePlan.js';
import { recentRuns, runShardCosts } from './ciSummary.js';
import { LOCAL_HOST, REPO, gateRoster } from './gateRoster.js';
import {
    bankedPopulations, keyContext, keyInputsIn, keyReportLines, nondeterminismFinding,
    rowInputKey, rowRunDecision, unkeyableReason,
} from './rowInputKey.js';
import {
    CHEAP_MS, FILE, ciGateCommand, cheapFor, compositeValue, compositeWhy, head,
    missingScript, readStandingValues, runRow, scriptIn, standingRows,
} from './standingValues.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(name.length + 3);

const HOST = arg('host', LOCAL_HOST);
const ONLY = arg('only', '');
const KEY = arg('key', '');
const JSON_OUT = flag('json');
/**
 * ⛓⛓⛓ R9 P3b, ⚖ 54 (7) — **THIS FILE IS A BOX ROW, AND NOW IT SAYS SO.**
 * `--write` and `--check` run the browser gates, the Windows rows and every
 * timing measurement `cheap` is banded on; two of them at once is what the
 * twelve hand-relayed BOX BUSY/FREE messages were for. `--wait-for-box=<sec>`
 * queues instead of refusing.
 */
const WAIT_FOR_BOX = Number(arg('wait-for-box', '0')) || 0;

/**
 * ⚖ 71 (a) — the three ways a keyed row is re-measured anyway.
 *
 * `--rekey`             every selected row re-runs and re-banks its key.
 * `--force-row=<key>`   ONE row does, matched exactly, like `--key=`.
 * `--redrive-unchanged` THE DETECTOR ARM: re-run rows whose key is UNCHANGED
 *                       on purpose, so that a moved verdict at unmoved bytes
 *                       becomes a NAMED finding (trap 866). It is spelled as
 *                       its own flag because the finding is the POINT of the
 *                       run, not a side effect of one.
 */
const REKEY = flag('rekey');
const REDRIVE_UNCHANGED = flag('redrive-unchanged');
const FORCE_ROW = arg('force-row', '');

/** ⛓ The ONE selection rule, so `--check`'s row-list half cannot drift from
 *  the row list it is checking. `--key=` is exact; `--only=` is a substring. */
const selects = (key) => (!ONLY || key.includes(ONLY)) && (!KEY || key === KEY);

const ALL_ROWS = standingRows({ host: HOST });
const ROWS = ALL_ROWS.filter((r) => selects(r.key));
const HEAD = head();

/**
 * ⛔ A `--key=` THAT NAMES NOTHING IS A FAILURE, NOT AN EMPTY RUN. The whole
 * point of the exact form is that a merge recipe quotes a key verbatim; a
 * mistyped one would otherwise `--write` zero rows and exit 0.
 */
if (KEY && ROWS.length === 0) {
    console.log(`FAIL: --key=${JSON.stringify(KEY)} matches no derived row.`);
    /** ⛓ …and the nearest keys, ranked by SHARED PREFIX — a mistyped key is
     *  almost always right up to the character that went wrong. */
    /* ⛓ a `function` for the same reason `gates.mjs`'s `nameOf` is one. */
    function shared(k) { let i = 0; while (i < k.length && k[i] === KEY[i]) i += 1; return i; }
    const best = Math.max(0, ...ALL_ROWS.map((r) => shared(r.key)));
    const near = ALL_ROWS.map((r) => r.key).filter((k) => shared(k) === best).slice(0, 4);
    if (best > 0) console.log(`  nearest: ${near.map((k) => JSON.stringify(k)).join(', ')}`);
    process.exit(1);
}

if (flag('list')) {
    for (const r of ROWS) console.log(`${r.key.padEnd(46)} ${r.command}`);
    console.log(`\n${ROWS.length} row(s) at ${HEAD ?? '(no head)'}`);
    process.exit(0);
}

const GATES = gateRoster({ repo: REPO });
/**
 * ⛓ R9 P4b (D) — the gate a row's command names, so `ciSourced` can read
 * that gate's `@ci-face` and `@ci-shallow` declarations. ⛔ Derived from the
 * roster, never a list here: the declarations live in the gate's own docblock
 * and this is only the lookup.
 *
 * ⛓ S4 dropped the `headlessFiles` set that used to sit beside this: the rule
 * no longer asks "is this row headless" but "can CI answer this row", and
 * that question is `ciGatePlan.ciSourced` reading the WHOLE roster row.
 */
const gateOf = (command) => GATES.find((g) => command.includes(g.path)) ?? null;

/**
 * ⛔⛔ THE GATE A ROW'S ANSWER WOULD COME FROM — `null` UNLESS THE ROW *IS*
 * THAT GATE'S STANDING ROW (S4). `identity: generated set` runs
 * `check-seedling-generated-set.mjs` too — one entry, two rows under two
 * kinds (S2 measured three such groups) — and CI prints its `## CI-GATE |`
 * lines under GATE keys only. A command match alone would ask `ci-summary`
 * for a key CI never publishes, and the row would KEEP forever with a polite
 * reason. ⛓ Whether the expensive IDENTITY rows should get CI lines of their
 * own is a real question and it is **S4c**, where the production side
 * (`ci-gates.mjs` printing them) is built first — not a widening here.
 */
const ciGateFor = (row) => (row.kind === 'gate' ? gateOf(row.command) : null);

/**
 * ⛓⛓ **WHAT A CI READ'S EXIT MEANS, IN THE WORDS A KEPT ROW OWES A READER**
 * (S4). The KEEP branch used to write *"(no CI run for this SHA, or it has not
 * concluded)"* for EVERY non-zero exit, and S4's own first `--write` produced
 * the counter-example: `gate: seedling-editor-generate (own server)` KEPT on
 * exit **5**, a REFUSAL BY NAME, under a sentence saying the head was probably
 * just unpushed. ⛔ A row frozen by a refusal and a row waiting for a push are
 * different facts, and only one of them is nobody's business to chase.
 * ⛓ Same ladder for the suite row's helper, which is why it is not indexed on
 * anything gate-specific: 2 no run · 3 not concluded · 4 no such answer ·
 * 5 refused.
 */
const CI_READ_REASON = {
    2: 'no CI run for this SHA — not pushed, or the path filter did not trigger one',
    3: 'the run for this SHA has not concluded',
    4: 'the run carries no answer under this key',
    5: '⛔ REFUSED BY NAME — CI cannot answer this key at all, and the helper\'s stderr '
        + 'says why. A row that KEEPs on a 5 is FROZEN, not merely unpushed',
};

/* ══════════════════════════════════════════════════════════════════════
 * ⚖ 71 (a) — THE INPUT KEY
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ WHY A ROW MAY NOT BE KEYED — `rowInputKey.unkeyableReason`, imported so
 * the clause set is a pure function a unit test can interrogate rather than
 * a rule that lives inside a 68-minute writer. R9 slice S2 moved it there and
 * dropped its `kind !== 'gate'` clause; that docblock carries the measurement.
 */

/** ⛓ The graph, the tracked set and every digest cache — built ONCE for a
 *  whole battery. Per row it is ~0.15 s; building it per row would pay the
 *  2 s graph thirty-three times. */
let KEY_CTX = null;
const keyCtx = () => (KEY_CTX ??= keyContext({ repo: REPO }));

/**
 * One row's key report, or an unkeyable one carrying the reason.
 *
 * ⛓ The gate's `@key-inputs` declaration is read HERE and passed down, so
 * `rowInputKey` stays a pure function of (entry, declaration, context) and a
 * unit test can hand it a declaration no file on disk carries.
 */
function keyReportFor(row, { fromCI = false } = {}) {
    const gate = gateOf(row.command);
    let declared = null;
    if (gate) {
        declared = keyInputsIn(readFileSync(join(REPO, gate.path), 'utf8'), { file: gate.path });
    }
    const why = unkeyableReason(row, { declared, fromCI });
    if (why) return { key: null, unkeyable: why, populations: [], entry: scriptIn(row.command) };
    return rowInputKey({ entry: scriptIn(row.command), declared, ctx: keyCtx() });
}

const existing = readStandingValues();

if (flag('quote')) {
    if (!existing) { console.log(`FAIL: no ${FILE} yet — run --write`); process.exit(1); }
    console.log(`STANDING VALUES at \`${existing.measuredAt}\` (${FILE}):`);
    for (const [key, row] of Object.entries(existing.rows)) {
        console.log(`  ${key.padEnd(46)} ${row.value}`
            + `${row.measuredAt !== existing.measuredAt ? `   @${row.measuredAt}` : ''}`
            + `${row.quoted ? '   ⛓ QUOTED' : ''}`);
    }
    process.exit(0);
}

/* ══════════════════════════════════════════════════════════════════════
 * --keys — the INPUT KEY of every selected row, against the bank
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **MITIGATION 1, AS A COMMAND.** The three risks of a byte key are all
 * "the key missed an input", and the only defence a reader can act on is being
 * able to ASK what a key covered. This is that question, it takes NO BOX and
 * it moves no file — which is also what makes it the instrument every ⚖ 71 (a)
 * mutant is scored on: touch one member of one population, run this, and the
 * key either moved or the population did not contain what you thought.
 */
if (flag('keys')) {
    const report = [];
    let unkeyable = 0;
    for (const row of ROWS) {
        const prev = existing?.rows?.[row.key];
        const fromCI = ciSourced({ gate: ciGateFor(row), cheap: prev?.cheap });
        const r = keyReportFor(row, { fromCI });
        if (r.unkeyable) {
            unkeyable += 1;
            console.log(`UNKEYED  ${row.key.padEnd(46)} — ${r.unkeyable}`);
            report.push({ key: row.key, inputKey: null, unkeyable: r.unkeyable });
            continue;
        }
        const banked = prev?.inputKey ?? null;
        const verdict = banked === null ? 'NO BANKED KEY' : (banked === r.key ? 'unmoved' : 'MOVED');
        const label = { unmoved: 'same ', MOVED: 'MOVED', 'NO BANKED KEY': 'NEW  ' }[verdict];
        console.log(`${label}    ${row.key.padEnd(46)} `
            + `${r.key}${banked && banked !== r.key ? `   was ${banked}` : ''}`
            + `${banked === null ? '   (nothing banked)' : ''}`);
        console.log(keyReportLines(r).join('\n'));
        report.push({ key: row.key,
            inputKey: r.key,
            banked,
            verdict,
            populations: bankedPopulations(r) });
    }
    const moved = report.filter((r) => r.verdict === 'MOVED').length;
    const fresh = report.filter((r) => r.verdict === 'NO BANKED KEY').length;
    console.log(`\n${ROWS.length} row(s) at ${HEAD ?? '(no head)'} — ${moved} MOVED, `
        + `${report.length - moved - fresh - unkeyable} unmoved, ${fresh} with nothing banked, `
        + `${unkeyable} unkeyable`);
    if (JSON_OUT) console.log(JSON.stringify({ head: HEAD, rows: report }, null, 2));
    process.exit(0);
}

/* ══════════════════════════════════════════════════════════════════════
 * --write — measure every row and commit the numbers to disk
 * ══════════════════════════════════════════════════════════════════════ */

if (flag('write')) {
    /**
     * ⛓⛓⛓ R9 P3b — **THE BOX AND THE TREE, TAKEN TOGETHER.** §44.9 item 5:
     * "the box is busy" and "the tree is frozen" are two different claims and
     * a measurement pass needs both. The lock records the head this write is
     * an answer about; every row re-asserts it.
     */
    const lock = takeBoxLock({ name: `standing-values --write${ONLY ? ` --only=${ONLY}` : ''}`
        + `${KEY ? ` --key=${KEY}` : ''}`, kind: 'measure', repo: REPO,
    waitSec: WAIT_FOR_BOX });
    const out = existing ?? { note: null, measuredAt: null, rows: {} };
    out.note = 'GENERATED by scripts/procgen/standing-values.mjs --write — do not edit by '
        + 'hand. Every value is the output of the command printed beside it; the row list is '
        + 'derived (identity-block.sh, the producers with a --check, the check-*.mjs gates, '
        + 'the unfiltered suite). `cheap` is MEASURED, not declared: --check re-runs the rows '
        + `that came in under ${CHEAP_MS}ms and QUOTES the rest with their own measuredAt.`;
    out.measuredAt = HEAD;
    out.rows = out.rows ?? {};
    console.log(`# standing-values --write — ${ROWS.length} row(s) at ${HEAD}\n`);
    const held = [];
    const ciRows = [];
    /** ⚖ 71 (a) — the three tallies the summary owes a reader. */
    const carried = [];
    const unkeyed = [];
    const findings = [];
    for (const row of ROWS) {
        /**
         * ⛔ AT EVERY ROW, NOT ONCE AT THE TOP. R9 slice P3's tracked-doc edit
         * landed while its own write was measuring and the generated-regions
         * row came back EXIT1 at row 22 of 62; a check only at the start would
         * have passed and published the same wrong number.
         */
        assertTreeUnmoved({ repo: REPO, frozen: lock.frozen, row: row.key });
        const gone = missingScript(row.command);
        if (gone) {
            console.log(`SKIP  ${row.key.padEnd(46)} — ${gone} is no longer on disk`);
            delete out.rows[row.key];
            continue;
        }
        const prev = out.rows[row.key];
        /**
         * ⛓⛓⛓ ⚖ 54 (6), WIDENED BY S4 (⚖ 72) — **A ROW CI CAN ANSWER AND THE
         * BOX SHOULD STOP PAYING FOR IS READ FROM CI INSTEAD.** The rule is
         * `ciGatePlan.ciSourced` and every clause of it is derived: what the
         * gate DECLARES (`windows`, `@ci-face`, `@ci-shallow`) and what the
         * bank MEASURED (`cheap`). ⛔ The rows it selects are PRINTED by name
         * in the summary, every run — the count is never typed anywhere.
         */
        const fromCI = ciSourced({ gate: ciGateFor(row), cheap: prev?.cheap });
        /**
         * ⛓⛓⛓ ⚖ 71 (a) — **THE INPUT KEY DECIDES WHETHER THIS ROW RUNS AT
         * ALL**, and it is computed BEFORE the run for the obvious reason: a
         * key taken after the fact would be a key over a tree the measurement
         * itself may have moved.
         *
         * ⛔ THE FOUR WAYS A KEYED ROW STILL RUNS are each named in the log —
         * a row that was skipped for a reason nobody can read is the stale
         * green this mechanism was built to refuse.
         */
        const keyRep = keyReportFor(row, { fromCI });
        const banked = prev?.inputKey ?? null;
        const decision = rowRunDecision({ keyRep, banked,
            forced: REKEY || FORCE_ROW === row.key, redriveUnchanged: REDRIVE_UNCHANGED });
        const { unmoved } = decision;
        if (keyRep.unkeyable) unkeyed.push(`${row.key} — ${keyRep.unkeyable}`);
        if (keyRep.key) {
            console.log(`key   ${row.key.padEnd(46)} ${keyRep.key}  ${decision.reason}`);
            console.log(keyReportLines(keyRep).join('\n'));
        }
        /**
         * ⛔ THE CARRY-FORWARD SAYS SO, IN THE ROW. The banked `value`, its own
         * `measuredAt` and its own `ms` are kept verbatim — nothing is
         * invented — and `quotedAtKey` names the head at which the key was
         * confirmed unmoved, so a reader of the artifact can always tell a
         * quote from a measurement WITHOUT reading this file (⚖ 70's shape).
         */
        if (!decision.run) {
            out.rows[row.key] = {
                ...prev,
                keyPopulations: bankedPopulations(keyRep),
                quotedAtKey: HEAD,
                why: `NOT re-run at ${HEAD}: the input key \`${keyRep.key}\` is unmoved since `
                    + `${prev.keyAt ?? prev.measuredAt} — ⚖ 71 (a). The banked value is an `
                    + 'answer about these same bytes. `--rekey`, `--force-row=` or '
                    + '`--redrive-unchanged` re-measure it.',
            };
            delete out.rows[row.key].nondeterminism;
            carried.push({ key: row.key, at: prev.measuredAt });
            console.log(`QUOTE ${row.key.padEnd(46)} ${String(prev.value).padEnd(46)} `
                + `@${prev.measuredAt} (key unmoved)`);
            continue;
        }
        /** ⛓ ONE SPELLING of the command this row is actually about — it is
         *  what runs, what the KEEP reason names and what the bank publishes
         *  (⚖ 8 reads a published command as identity). */
        const ranCommand = fromCI ? ciGateCommand(row.key) : row.command;
        const r = fromCI
            ? await runRow({ ...row, kind: 'ci-gate', command: ranCommand })
            : await runRow(row);
        if (fromCI) ciRows.push(row.key);
        /**
         * ⛓⛓⛓ **THE DETECTOR** (trap 866: a byte-keyed cache is a
         * nondeterminism detector you already own). A re-run at an UNCHANGED
         * key whose verdict moved says one of two things and both are
         * findings: either the key missed an input, or the gate is not a
         * function of its inputs. ⛔ It is NEVER a silent re-bank — the banked
         * value stays, the finding is written into the row's own `why`, and
         * the run exits non-zero so that nobody has to notice a log line.
         */
        const finding = nondeterminismFinding({ unmoved, prev, result: r, at: HEAD });
        if (finding) {
            out.rows[row.key] = {
                ...prev,
                keyPopulations: bankedPopulations(keyRep),
                quotedAtKey: HEAD,
                nondeterminism: finding,
                why: `⛔ NONDETERMINISM at an UNCHANGED input key \`${keyRep.key}\`: a re-drive `
                    + `at ${HEAD} read ${JSON.stringify(r.value)} where the bank says `
                    + `${JSON.stringify(prev.value)} (measured @${prev.measuredAt}). Either the `
                    + 'key MISSES an input or this gate is not a function of its inputs — ⚖ 71 '
                    + '(a), trap 866. The banked value is KEPT; nothing was re-banked.',
            };
            findings.push({ key: row.key, was: prev.value, now: r.value });
            console.log(`⛔ NONDETERMINISM  ${row.key.padEnd(46)} WAS ${prev.value} — `
                + `NOW ${r.value} at an unmoved key`);
            continue;
        }
        /**
         * ⚖ R9 RULING 52. A row whose value can only come from a PUSHED head
         * (the CI-read suite row) answers `null` on an unpushed one — the
         * helper exits 2/3 and prints its reason on stderr. Blanking the
         * standing number there would lose the last measured suite count to a
         * condition that says nothing about the suite, so the previous value
         * and ITS head are KEPT and the reason is recorded beside them. Nothing
         * is invented: the row still carries the head it was measured at.
         */
        if (r.value === null && (row.alwaysQuoted || fromCI) && prev) {
            out.rows[row.key] = {
                ...prev,
                cheap: false,
                why: `not re-read at ${HEAD}: \`${ranCommand}\` exited ${r.exit} `
                    + `(${CI_READ_REASON[r.exit] ?? 'see the helper\'s stderr'}) — ⚖ ruling 52`,
            };
            console.log(`KEEP  ${row.key.padEnd(46)} ${String(prev.value).padEnd(46)} `
                + `@${prev.measuredAt} (helper exit ${r.exit})`);
            continue;
        }
        /** ⛓ R9 P3b — `cheap` with HYSTERESIS, and a HELD row is never silent. */
        const band = cheapFor(r.ms, prev?.cheap);
        if (band.held && !row.alwaysQuoted) held.push({ key: row.key, ms: r.ms, ...band });
        out.rows[row.key] = {
            value: r.value,
            command: ranCommand,
            kind: row.kind,
            exit: r.exit,
            ms: r.ms,
            // ⚖ ruling 52: `alwaysQuoted` is a property of the RECIPE, not of
            // how long it took. The CI read is fast and would otherwise be
            // classified cheap, which would put a network call — and a red on
            // every unpushed head — inside every `--check`.
            cheap: (row.alwaysQuoted || fromCI) ? false : band.cheap,
            ...(fromCI ? { ciSourced: true } : {}),
            measuredAt: HEAD,
            /** ⚖ 71 (a) — the key this value is an answer about, and the four
             *  populations it was taken over, so the artifact carries its own
             *  audit trail rather than only a hash. */
            ...(keyRep.key ? { inputKey: keyRep.key, keyAt: HEAD,
                keyPopulations: bankedPopulations(keyRep) } : {}),
            ...(row.browser ? { browser: true } : {}),
            ...(row.windows ? { windows: true } : {}),
            ...(r.total ? { total: r.total } : {}),
        };
        console.log(`${(r.exit === 0 ? 'ok  ' : `EXIT${r.exit}`)}  ${row.key.padEnd(46)} `
            + `${String(r.value).slice(0, 46).padEnd(46)} ${(r.ms / 1000).toFixed(1)}s`
            /**
             * ⛔ THE STORED VALUE, NOT THE BAND'S. These came apart on the
             * first real write: an `alwaysQuoted` row is written `cheap:
             * false` regardless of how fast it ran, and this line printed the
             * BAND's answer — so the CI-read suite row logged as "5.3s cheap"
             * while the file recorded `cheap: false`. A log that disagrees
             * with the artifact it is a log OF is the quietest kind of wrong.
             */
            + `${out.rows[row.key].cheap ? ' cheap' : ''}${band.held ? ' HELD' : ''}`);
    }
    /**
     * ⛔ EVERY HELD ROW IS NAMED. Hysteresis that nobody could see would be a
     * second, invisible source of truth about a field readers take as measured
     * — the same defect as a hand-kept "this one is fast" list, hidden better.
     */
    /**
     * ⛔ A STATED ZERO. ⚖ 54 (6) asked for more rows read from CI; the honest
     * discharge is the RULE plus the number it selects, printed either way, so
     * "none today" is a measurement rather than a silence.
     */
    /**
     * ⛔ EVERY CARRIED ROW IS NAMED, and so is every UNKEYED one. A row that
     * did not run is the whole economy of ⚖ 71 (a) and also its whole risk;
     * a summary that reported only the rows that DID run would be a log about
     * the cheap half of the decision.
     */
    console.log(`\nkey-carried: ${carried.length} row(s)`
        + `${carried.length ? ` — ${carried.map((c) => `${c.key} @${c.at}`).join(', ')}` : ''}`);
    console.log(`unkeyed: ${unkeyed.length} row(s)`
        + `${unkeyed.length ? `\n  ${unkeyed.join('\n  ')}` : ' (every selected row is keyed)'}`);
    console.log(`CI-sourced: ${ciRows.length} row(s)`
        + `${ciRows.length ? ` — ${ciRows.join(', ')}` : ' (CI-runnable AND not cheap AND no '
            + 'declared @ci-face or @ci-shallow; at this head nothing qualifies, so the box '
            + 'answers them all)'}`);
    for (const h of held) {
        console.log(`HELD by hysteresis: ${h.key.padEnd(46)} ${(h.ms / 1000).toFixed(1)}s is `
            + `inside the ±${Math.round(0.1 * 100)} % band around ${CHEAP_MS / 1000}s, so it `
            + `KEEPS \`cheap: ${h.cheap}\` (the bare threshold would have said `
            + `${!h.cheap}) — trap 735`);
    }
    writeFileSync(join(REPO, FILE), `${JSON.stringify(out, null, 2)}\n`);
    const cheap = Object.values(out.rows).filter((r) => r.cheap).length;
    console.log(`\nwrote ${FILE} — ${Object.keys(out.rows).length} row(s), `
        + `${cheap} cheap (re-run by --check), ${Object.keys(out.rows).length - cheap} quoted`
        + `${held.length ? `, ${held.length} HELD by hysteresis` : ', 0 HELD by hysteresis'}`);
    /* ══ THE LAST CI RUN'S PARTITION ═════════════════════════════════
     * ⛓ See `lastRunShardAudit`'s docblock for why this lives here and not in
     * a CI job, and why it never touches the exit code below. */
    const shardAudit = lastRunShardAudit({ recentRuns, runShardCosts });
    if (!shardAudit.available) {
        console.log(`\n# the last CI run's shard partition was NOT audited — ${shardAudit.why}`);
    } else {
        const { run, audit } = shardAudit;
        const head = `run ${run.databaseId} @${String(run.headSha).slice(0, 9)}`;
        if (audit.ok) {
            console.log(`\n# the last CI run's shard partition HELD — ${head}, `
                + `${audit.rows.length} job(s) that ran arms`
                + `${audit.loose ? `; ⚠ LOOSE: ${audit.loose.jobs.length} multi-arm shard(s) `
                    + `total ${(audit.loose.ms / 1000).toFixed(1)}s and would have fitted in ONE `
                    + '— over-splitting costs a RUNNER, not wall clock, and is never red' : ''}`);
        } else {
            console.log(`\n⛔ THE LAST CI RUN'S SHARD PARTITION DID NOT HOLD — ${head}. `
                + 'A multi-arm job exceeded the budget in the RUNNER\'s own seconds, which means '
                + `the arms were UNDERPRICED (trap 1068). Re-price with \`node `
                + `scripts/procgen/ci-gates.mjs --write-costs\`:`);
            for (const r of audit.over) {
                console.log(`   ${r.name}: ${r.arms} arm(s), ${(r.ms / 1000).toFixed(1)}s measured `
                    + `> the ${(CI_SHARD_BUDGET_MS / 1000).toFixed(0)}s budget`
                    + `${r.heaviest ? ` · heaviest ${r.heaviest.key} `
                        + `${(r.heaviest.ms / 1000).toFixed(1)}s` : ''}`);
            }
            console.log('   ⛔ this does NOT fail the write — the write\'s verdict is about the '
                + 'BANK, and a bank commit must not be hostage to a runner (⚖ 72).');
        }
    }

    if (findings.length) {
        console.log(`\n⛔ ${findings.length} NONDETERMINISM FINDING(S) — a verdict moved at an `
            + 'UNCHANGED input key. Either the key misses an input or the gate is not a '
            + 'function of its inputs (⚖ 71 (a), trap 866). Nothing was re-banked:');
        for (const f of findings) console.log(`   ${f.key}: WAS ${f.was} — NOW ${f.now}`);
    }
    releaseBoxLock();
    process.exit(findings.length ? 1 : 0);
}

/* ══════════════════════════════════════════════════════════════════════
 * --check — re-run the cheap rows and diff
 * ══════════════════════════════════════════════════════════════════════ */

if (!existing) {
    console.log(`FAIL: no ${FILE} on disk — run --write first`);
    process.exit(1);
}

/**
 * ⛓ R9 P3b — `--check` re-runs the CHEAP rows, and 24 of them are browser
 * rows on `:8000`. It takes the box for the same reason `--write` does; it
 * does NOT freeze the tree, because a check publishes nothing.
 */
const checkLock = takeBoxLock({ name: 'standing-values --check', kind: 'measure',
    repo: REPO, waitSec: WAIT_FOR_BOX });
void checkLock;

let failed = 0;
const say = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/**
 * ⛔ THE ROW LIST IS ALSO CHECKED. A row the derivation now produces that the
 * file does not carry means somebody added a gate or a producer and did not
 * re-measure; a row the file carries that the derivation no longer produces
 * means an instrument was RETIRED. Both are findings, and both used to be
 * invisible because there was no list.
 */
const known = new Set(Object.keys(existing.rows));
const derived = new Set(ROWS.map((r) => r.key));
for (const key of derived) {
    if (!known.has(key)) say(false, `a NEW row nothing has measured: ${key}`, 'run --write');
}
for (const key of known) {
    if (derived.has(key)) continue;
    if (!selects(key)) continue;
    /**
     * ⛔⛔ A QUOTED ROW IS *SUPPOSED* TO BE OUTSIDE THE DERIVATION, and the two
     * halves of this file did not COMPOSE until this line existed. The row-list
     * check reads "a row the derivation no longer produces ⇒ an instrument was
     * retired"; `record-standing-value.mjs --quote` exists precisely to record
     * a value the derivation CANNOT produce (a Windows/GPU run a headless
     * session cannot make). Without this clause the first quoted row makes
     * `--check` permanently red, which makes the quoting path unusable and
     * would have sent the next slice back to transcribing by hand.
     */
    if (existing.rows[key]?.quoted) {
        const q = existing.rows[key];
        /**
         * ⛓⛓⛓ R9 slice CAT (⚖ 70 (c)) — **A COMPOSITE ROW'S `value` AND `why`
         * ARE RE-DERIVED HERE, AND A DISAGREEMENT IS A NAMED FAILURE.**
         *
         * ⛔ This is ⚖ 17 with teeth. The parts are the measurement; the two
         * text fields are a rendering of them. Without this row a hand edit to
         * either — the exact thing the old prose `why` invited — would sit in
         * the file looking authoritative until somebody happened to re-quote a
         * category. It costs a string compare and it is the only thing that
         * makes "derived" true rather than intended.
         */
        if (q.categories) {
            const v = compositeValue(q);
            const w = compositeWhy(q);
            say(q.value === v && q.why === w,
                `${key} is a COMPOSITE row and its \`value\`/\`why\` are DERIVED from its parts`,
                q.value === v && q.why === w
                    ? `${Object.keys(q.categories).length} part(s), each with its own head`
                    : `⛔ the file has been EDITED BY HAND. value: ${JSON.stringify(q.value)} `
                        + `vs derived ${JSON.stringify(v)}${q.why === w ? ''
                            : `; why: ${JSON.stringify(String(q.why).slice(0, 60))}… vs derived `
                                + `${JSON.stringify(String(w).slice(0, 60))}…`}. Re-quote the `
                        + 'part with `record-standing-value.mjs --category=` — ⚖ 17: the parts '
                        + 'are the measurement, these two fields are a rendering of them');
        }
        console.log(`QUOTED: ${key.padEnd(46)} ${q.value}   @${q.measuredAt}`
            + `${q.why ? `\n        ⛓ ${q.why}` : ''}`);
        continue;
    }
    say(false, `the file carries a row the derivation no longer produces: ${key}`,
        'an instrument was retired — run --write');
}

const results = [];
for (const row of ROWS) {
    const was = existing.rows[row.key];
    if (!was) continue;
    const gone = missingScript(row.command);
    if (gone) {
        say(false, `${row.key} names an instrument that is NO LONGER ON DISK`, gone);
        continue;
    }
    if (!was.cheap) {
        console.log(`QUOTED: ${row.key.padEnd(46)} ${was.value}   @${was.measuredAt}`);
        continue;
    }
    const now = await runRow(row);
    results.push({ key: row.key, was: was.value, now: now.value });
    say(now.value === was.value, row.key,
        now.value === was.value ? String(now.value) : `WAS ${was.value} — NOW ${now.value}`);
}

if (JSON_OUT) console.log(JSON.stringify({ measuredAt: existing.measuredAt, results }, null, 2));
console.log(failed === 0
    ? `\nALL CHECKS PASSED — ${results.length} cheap row(s) re-run against \`${existing.measuredAt}\``
    : `\n${failed} CHECK(S) FAILED`);
releaseBoxLock();
process.exit(failed === 0 ? 0 : 1);
