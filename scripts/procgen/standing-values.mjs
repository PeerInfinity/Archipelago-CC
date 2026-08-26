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
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LOCAL_HOST, REPO } from './gateRoster.js';
import {
    CHEAP_MS, FILE, head, missingScript, readStandingValues, runRow, standingRows,
} from './standingValues.js';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(name.length + 3);

const HOST = arg('host', LOCAL_HOST);
const ONLY = arg('only', '');
const KEY = arg('key', '');
const JSON_OUT = flag('json');

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
    const shared = (k) => { let i = 0; while (i < k.length && k[i] === KEY[i]) i += 1; return i; };
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
 * --write — measure every row and commit the numbers to disk
 * ══════════════════════════════════════════════════════════════════════ */

if (flag('write')) {
    const out = existing ?? { note: null, measuredAt: null, rows: {} };
    out.note = 'GENERATED by scripts/procgen/standing-values.mjs --write — do not edit by '
        + 'hand. Every value is the output of the command printed beside it; the row list is '
        + 'derived (identity-block.sh, the producers with a --check, the check-*.mjs gates, '
        + 'the unfiltered suite). `cheap` is MEASURED, not declared: --check re-runs the rows '
        + `that came in under ${CHEAP_MS}ms and QUOTES the rest with their own measuredAt.`;
    out.measuredAt = HEAD;
    out.rows = out.rows ?? {};
    console.log(`# standing-values --write — ${ROWS.length} row(s) at ${HEAD}\n`);
    for (const row of ROWS) {
        const gone = missingScript(row.command);
        if (gone) {
            console.log(`SKIP  ${row.key.padEnd(46)} — ${gone} is no longer on disk`);
            delete out.rows[row.key];
            continue;
        }
        const r = await runRow(row);
        /**
         * ⚖ R9 RULING 52. A row whose value can only come from a PUSHED head
         * (the CI-read suite row) answers `null` on an unpushed one — the
         * helper exits 2/3 and prints its reason on stderr. Blanking the
         * standing number there would lose the last measured suite count to a
         * condition that says nothing about the suite, so the previous value
         * and ITS head are KEPT and the reason is recorded beside them. Nothing
         * is invented: the row still carries the head it was measured at.
         */
        const prev = out.rows[row.key];
        if (r.value === null && row.alwaysQuoted && prev) {
            out.rows[row.key] = {
                ...prev,
                cheap: false,
                why: `not re-read at ${HEAD}: \`${row.command}\` exited ${r.exit} `
                    + '(no CI run for this SHA, or it has not concluded) — ⚖ ruling 52',
            };
            console.log(`KEEP  ${row.key.padEnd(46)} ${String(prev.value).padEnd(46)} `
                + `@${prev.measuredAt} (helper exit ${r.exit})`);
            continue;
        }
        out.rows[row.key] = {
            value: r.value,
            command: row.command,
            kind: row.kind,
            exit: r.exit,
            ms: r.ms,
            // ⚖ ruling 52: `alwaysQuoted` is a property of the RECIPE, not of
            // how long it took. The CI read is fast and would otherwise be
            // classified cheap, which would put a network call — and a red on
            // every unpushed head — inside every `--check`.
            cheap: row.alwaysQuoted ? false : r.ms < CHEAP_MS,
            measuredAt: HEAD,
            ...(row.browser ? { browser: true } : {}),
            ...(row.windows ? { windows: true } : {}),
            ...(r.total ? { total: r.total } : {}),
        };
        console.log(`${(r.exit === 0 ? 'ok  ' : `EXIT${r.exit}`)}  ${row.key.padEnd(46)} `
            + `${String(r.value).slice(0, 46).padEnd(46)} ${(r.ms / 1000).toFixed(1)}s`
            + `${r.ms < CHEAP_MS ? ' cheap' : ''}`);
    }
    writeFileSync(join(REPO, FILE), `${JSON.stringify(out, null, 2)}\n`);
    const cheap = Object.values(out.rows).filter((r) => r.cheap).length;
    console.log(`\nwrote ${FILE} — ${Object.keys(out.rows).length} row(s), `
        + `${cheap} cheap (re-run by --check), ${Object.keys(out.rows).length - cheap} quoted`);
    process.exit(0);
}

/* ══════════════════════════════════════════════════════════════════════
 * --check — re-run the cheap rows and diff
 * ══════════════════════════════════════════════════════════════════════ */

if (!existing) {
    console.log(`FAIL: no ${FILE} on disk — run --write first`);
    process.exit(1);
}

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
process.exit(failed === 0 ? 0 : 1);
