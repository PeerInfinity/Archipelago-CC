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

import { assertTreeUnmoved, releaseBoxLock, takeBoxLock } from './boxLock.js';
import { LOCAL_HOST, REPO, gateRoster } from './gateRoster.js';
import {
    CHEAP_MS, FILE, ciGateCommand, ciSourced, cheapFor, compositeValue, compositeWhy, head,
    missingScript, readStandingValues, runRow, standingRows,
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
    /**
     * ⛓ R9 P3b (g) — which gate FILES are headless, derived once. A standing
     * row is matched to its gate by the command naming the file, which is the
     * same join `missingScript` makes.
     */
    const GATES = gateRoster({ repo: REPO });
    const headlessFiles = new Set(GATES.filter((g) => !g.browser && !g.windows).map((g) => g.path));
    /**
     * ⛓ R9 P4b (D) — the gate a row's command names, so `ciSourced` can read
     * that gate's `@ci-face` declaration. ⛔ Derived from the roster, never a
     * list here: the declaration lives in the gate's own docblock and this is
     * only the lookup.
     */
    const gateOf = (command) => GATES.find((g) => command.includes(g.path)) ?? null;
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
         * ⛓⛓⛓ ⚖ 54 (6) — **A HEADLESS ROW THE BOX SHOULD STOP PAYING FOR IS
         * READ FROM CI INSTEAD.** The rule is `ciSourced` and it is derived
         * from what the file already knows: headless (from `gateRoster`) and
         * not `cheap` (from the last measurement). At this head it selects
         * ZERO rows and the summary line says so — a stated zero.
         */
        const headless = row.kind === 'gate'
            && [...headlessFiles].some((f) => row.command.includes(f));
        const fromCI = ciSourced({
            headless, cheap: prev?.cheap, ciFace: gateOf(row.command)?.ciFace ?? null,
        });
        const r = fromCI
            ? await runRow({ ...row, kind: 'ci-gate', command: ciGateCommand(row.key) })
            : await runRow(row);
        if (fromCI) ciRows.push(row.key);
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
                why: `not re-read at ${HEAD}: \`${row.command}\` exited ${r.exit} `
                    + '(no CI run for this SHA, or it has not concluded) — ⚖ ruling 52',
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
            command: fromCI ? ciGateCommand(row.key) : row.command,
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
    console.log(`CI-sourced: ${ciRows.length} row(s)`
        + `${ciRows.length ? ` — ${ciRows.join(', ')}` : ' (headless AND not cheap; at this '
            + 'head every headless gate is cheap, so the box still answers them)'}`);
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
    releaseBoxLock();
    process.exit(0);
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
