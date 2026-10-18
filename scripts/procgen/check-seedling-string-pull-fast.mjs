#!/usr/bin/env node
/**
 * check-seedling-string-pull-fast — **`STRING_PULL_FAST` IS ANSWER-IDENTICAL ON THE REAL CORPUS** (seedling
 * hammer-phase SP, D2).
 *
 * `botDriverV2.planWaypoints`' string-pull memo (`STRING_PULL_FAST`, default OFF) must change time and nothing else.
 * This runs each corpus row twice in a child process — OFF, and ON with the `audit` seam installed by this same file
 * as a `--import` preload — and holds, per row:
 *   · the row's stdout md5 and exit code equal OFF and ON (a producer's `--check` stdout is ⚖ ruling 8's standing
 *     byte-identity, so this is the same comparison the identity block makes, with the switch as the only change);
 *   · every real `planWaypoints` call of the ON run computed BOTH pulls on the same points, and they agree.
 * and over the corpus: at least `MIN_CALLS` audited calls.
 *
 * Rows: the identity block's six producers (`--check`) and the killgate census (seeds 2, 5, 9). `--full` adds the
 * acceptance batch and the three generated-pair dumps (tens of thousands of calls, several minutes each).
 *
 *   node scripts/procgen/check-seedling-string-pull-fast.mjs [--full] [--only=<row>,…]
 *
 * Exit 0 when every row holds, 1 otherwise. Prints one row per command and a total.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const AUDIT_OUT = 'SEEDLING_STRING_PULL_AUDIT_OUT';

/** Fewer audited calls than this is a corpus too small to stand for the solver. */
export const MIN_CALLS = 500;

export const ROWS = [
    ...['solve-seedling-r8-battery', 'solve-seedling-r8-d2-chain', 'solve-seedling-r8-l18', 'solve-seedling-r8-tail',
        'solve-seedling-r9-l3', 'solve-seedling-r9-campaign']
        .map((p) => ({ name: p, args: [`scripts/procgen/${p}.mjs`, '--check'] })),
    ...[2, 5, 9].map((s) => ({ name: `killgate s${s}`,
        args: ['scripts/procgen/census-seedling-killgate-clears.mjs', `--seeds=${s}-${s}`] })),
];
export const FULL_ROWS = [
    { name: 'acceptance batch', args: ['scripts/procgen/batch-seedling-acceptance.mjs'] },
    { name: 'empty pairs c3', args: ['scripts/procgen/dump-seedling-kind-pairs.mjs', '--kinds=empty', '--seeds=1-40',
        '--count=3'] },
    { name: 'empty pairs c6', args: ['scripts/procgen/dump-seedling-kind-pairs.mjs', '--kinds=empty', '--seeds=1-40',
        '--count=6'] },
    { name: 'carved pairs c4', args: ['scripts/procgen/dump-seedling-kind-pairs.mjs',
        '--kinds=winding,rooms,branchy,bushy,loopy,open', '--seeds=1-12', '--count=4'] },
];

// ── the preload half: installed only when the parent names an output file, so a bare import stays inert ──
if (process.env[AUDIT_OUT]) {
    const { STRING_PULL_FAST } = await import(pathToFileURL(
        join(REPO, 'frontend', 'modules', 'seedlingDemo', 'botDriverV2.js')).href);
    const seen = { calls: 0, mismatches: 0, first: null };
    STRING_PULL_FAST.audit = (row) => {
        seen.calls += 1;
        if (JSON.stringify(row.off) !== JSON.stringify(row.on)) {
            seen.mismatches += 1;
            seen.first ??= { level: row.world?.level, from: row.from, to: row.to, off: row.off, on: row.on };
        }
    };
    const { writeFileSync } = await import('node:fs');
    process.on('exit', () => writeFileSync(process.env[AUDIT_OUT], JSON.stringify(seen)));
}

const md5 = (s) => createHash('md5').update(s).digest('hex');
/** The box-lock banner is not output (the identity block strips it the same way). */
const body = (s) => s.split('\n').filter((l) => !l.startsWith('# box lock:')).join('\n');

function runRow(row, fast, auditFile) {
    const env = { ...process.env, SEEDLING_STRING_PULL_FAST: fast ? '1' : '0' };
    delete env[AUDIT_OUT];
    const argv = [...row.args];
    if (auditFile) {
        env[AUDIT_OUT] = auditFile;
        argv.unshift('--import', pathToFileURL(fileURLToPath(import.meta.url)).href);
    }
    const r = spawnSync(process.execPath, argv, { cwd: REPO, env, encoding: 'utf8', maxBuffer: 1 << 28 });
    return { md5: md5(body(r.stdout ?? '')), status: r.status, stderr: r.stderr ?? '' };
}

function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log('check-seedling-string-pull-fast [--full] [--only=<row>,…] — runs each corpus row OFF and ON '
            + '(SEEDLING_STRING_PULL_FAST), ON under the planWaypoints audit; exit 1 on any difference or < '
            + `${MIN_CALLS} audited calls.\nrows: ${[...ROWS, ...FULL_ROWS].map((r) => r.name).join(', ')}`);
        return 0;
    }
    const only = argv.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? null;
    const rows = [...ROWS, ...(argv.includes('--full') ? FULL_ROWS : [])]
        .filter((r) => only === null || only.includes(r.name));
    const dir = mkdtempSync(join(tmpdir(), 'string-pull-fast-'));
    let calls = 0;
    let bad = 0;
    try {
        for (const row of rows) {
            const file = join(dir, `${rows.indexOf(row)}.json`);
            const off = runRow(row, false, null);
            const on = runRow(row, true, file);
            let seen = { calls: 0, mismatches: 0, first: null };
            try { seen = JSON.parse(readFileSync(file, 'utf8')); } catch { seen.mismatches = -1; }
            const ok = off.md5 === on.md5 && off.status === on.status && seen.mismatches === 0;
            if (!ok) bad += 1;
            calls += seen.calls;
            console.log(`${ok ? 'PASS' : 'FAIL'}  ${row.name.padEnd(28)} OFF ${off.md5.slice(0, 8)} [exit ${off.status}]`
                + `  ON ${on.md5.slice(0, 8)} [exit ${on.status}]  audited ${seen.calls} calls, `
                + `${seen.mismatches} mismatch(es)`);
            if (seen.first) console.log(`      first mismatch: ${JSON.stringify(seen.first).slice(0, 400)}`);
            if (seen.mismatches === -1) console.log(`      no audit file; ON stderr: ${on.stderr.slice(-400)}`);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    const enough = only !== null || calls >= MIN_CALLS;
    console.log(`${bad === 0 && enough ? 'PASS' : 'FAIL'}: ${rows.length} row(s), ${bad} failing, ${calls} audited `
        + `planWaypoints call(s)${only === null ? ` (need ≥ ${MIN_CALLS})` : ''}`);
    return bad === 0 && enough ? 0 : 1;
}

if (!process.env[AUDIT_OUT] && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    process.exitCode = main();
}
