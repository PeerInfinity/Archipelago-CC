#!/usr/bin/env node
/**
 * check-seedling-rerecord-rehearsal — **THE RE-RECORD PIPELINE IS REHEARSED
 * BEFORE IT SPENDS A GPU, AND THIS GATE IS WHAT MAKES THAT A STANDING CLAIM.**
 * R9 slice P1b, ⚖ ruling 54 (3).
 *
 * ── ⛔⛔⛔ WHAT IT IS FOR ───────────────────────────────────────────────
 *
 * `rerecord-seedling-campaign.mjs` drives a real browser on a real Windows GPU
 * over seventeen boundaries. THREE separate re-record attempts stopped partway
 * through one — after the GPU had already been paid for its predecessors — and
 * every defect that stopped them was pure bookkeeping:
 *
 *   §35.4 item 4   `spendWalkLicence` ran the producers in SORTED FILE ORDER,
 *                  so a chain producer solved from a predecessor that no
 *                  longer existed
 *   §37.3 (a)      …and the fix for it was INERT on the straight-through path:
 *                  `predict()` built its payload twice and the returned copy
 *                  had no `walk.rows`, so the order was derived only on a
 *                  `--from=S1` RESUME
 *   §35.4 item 5   S1's boot-block guard tested the GLOBAL failure counter, so
 *                  a producer exiting 1 three rows earlier threw a sentence
 *                  about the projection while printing PASS for it
 *   §37.3 (b)      …and S2's sealed-table guard did the same
 *   P1b            …and so did S3's stop guard, a FOURTH time, found by this
 *                  rehearsal while its scenarios were being written
 *   §33.4 item 4   S3's record set was `s2.wrote` — the BOOT movers — which
 *                  drops the FIRST mover of every chain, whose boot is
 *                  upstream of its own move
 *   §33.4 items    a chain HEADLINE and a ONE-SEGMENT chain fell through the
 *   1 and 2        accounting floor and appeared in neither the table nor
 *                  `unmeasured`
 *
 * Every one of those is decidable OFFLINE, against a subject the pipeline can
 * be pointed at. `--rehearse` builds that subject and runs S0..S5 over it;
 * this gate is the row that says so on every head.
 *
 * ── ⛔ WHY THE GATE IS NOT JUST "`--rehearse` SAID GREEN" ──────────────
 *
 * A gate that only checked the child's exit code would go SILENT-GREEN the day
 * a scenario stopped being run — the shape §18.8 caught in a gate row that had
 * never fired. So this reads `rehearsal.report.json` and asserts, BY NAME, that
 * each defect above has a row and that the row is ok. A scenario that vanishes
 * is a red naming the missing row, not a smaller green.
 *
 * ⛔ AND IT MEASURES THE ONE THING A REHEARSAL MUST NEVER DO. The latch cache
 * is machine-global and shared across trees and sessions (⚖ 47b (5)); this gate
 * snapshots its listing around the child and requires it UNCHANGED, rather than
 * repeating the mode's own claim that it spends no GPU.
 *
 * ⛓ OFFLINE, no browser, no Windows, no dev server. ~10 s.
 *
 * Run:
 *   node scripts/procgen/check-seedling-rerecord-rehearsal.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const RUN_DIR = join(process.env.TMPDIR || '/tmp', 'check-seedling-rerecord-rehearsal');
/** ⛓ The machine-global latch cache, named here only to be MEASURED. */
const LATCH_CACHE = join('/mnt/c/playwright', 'rerecord-cache');

let failed = 0;
const check = (ok, name, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/** ⛓ A listing digest that answers "unchanged?" whether or not the dir exists. */
const cacheFingerprint = () => (existsSync(LATCH_CACHE)
    ? createHash('md5').update(readdirSync(LATCH_CACHE).sort().join('\n')).digest('hex')
    : 'ABSENT');

const before = cacheFingerprint();
const t0 = Date.now();
let childExit = 0;
let childOut = '';
try {
    childOut = execFileSync('node', [
        join(HERE, 'rerecord-seedling-campaign.mjs'), '--rehearse', `--run-dir=${RUN_DIR}`,
    ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
    childExit = e.status ?? -1;
    childOut = [e.stdout, e.stderr].filter(Boolean).join('\n');
}
const ms = Date.now() - t0;
const after = cacheFingerprint();

console.log(`# check-seedling-rerecord-rehearsal — the pipeline, rehearsed offline`);
console.log(`# --rehearse exited ${childExit} in ${(ms / 1000).toFixed(1)}s, `
    + `${childOut.split('\n').length} line(s)\n`);

check(childExit === 0, '⛓ `--rehearse` runs S0..S5 against a generated fake tree and exits 0',
    childExit === 0 ? `${(ms / 1000).toFixed(1)}s, no browser and no GPU`
        : `exit ${childExit} — ${childOut.split('\n').filter((l) => l.startsWith('FAIL:'))
            .slice(0, 3).join(' | ') || 'see the log below'}`);
if (childExit !== 0) console.log(childOut.split('\n').slice(-40).join('\n'));

const reportPath = join(RUN_DIR, 'rehearsal.report.json');
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
check(Boolean(report), '⛓ …and it writes a report a gate can read row by row',
    report ? `${report.scenarios.length} scenario(s) -> ${reportPath}` : `no ${reportPath}`);

const rows = new Map();
for (const sc of report?.scenarios ?? []) {
    for (const r of sc.rows) rows.set(r.name, { ...r, scenario: sc.id });
}
/**
 * ⛔ THE ROWS ARE FOUND BY A STABLE MARKER, NEVER BY THEIR PROSE. Each
 * rehearsal row carries a `(cN)` tag naming the defect it would catch, so this
 * gate keeps working when the sentence around it is reworded — and a marker
 * that finds NO row is a red naming the marker, which is what stops a scenario
 * from quietly disappearing.
 */
const byMarker = (marker) => [...rows.entries()].filter(([name]) => name.includes(marker));
const claim = (marker, name) => {
    const hits = byMarker(marker);
    if (!hits.length) {
        check(false, name, `⛔ NO rehearsal row carries \`${marker}\` — the scenario that `
            + 'owned it is gone, and a gate that went quiet about it would be a smaller '
            + 'green rather than a red');
        return;
    }
    const bad = hits.filter(([, r]) => !r.ok);
    check(bad.length === 0, name,
        bad.length ? bad.map(([n, r]) => `${r.scenario}: ${n}`).join(' | ')
            : `${hits.length} row(s) in ${[...new Set(hits.map(([, r]) => r.scenario))]
                .join(', ')}`);
};

console.log('\n## THE DEFECTS THAT STOPPED THREE RE-RECORD RUNS, EACH REHEARSED OFFLINE\n');
claim('(c1)', '⛓ §35.4 item 4 — the licence spends its producers in the order the CHAINS '
    + 'require, not the FILE SYSTEM\'S (the rehearsal\'s plan is built so the two disagree)');
claim('(c1-resume)', '⛓ §37.3 (a) — …and a `--from=S1` RESUME derives the SAME order, which '
    + 'is the path the first fix worked on and the straight-through one did not');
claim('(c2)', '⛓ §35.4 item 5 — a seeded producer failure does NOT make S1\'s boot-block '
    + 'guard name the projection: the guard tests its own result');
claim('(c2b)', '⛓ §37.3 (b) — …and S2\'s sealed-table guard counts its own off-table writes');
claim('(c3)', '⛓ §33.4 item 4 — S3\'s record set is the GAME-VISIBLE PROJECTION DIFF, so it '
    + 'holds the first mover of each chain, whose boot never moves');
claim('(c4)', '⛓ §33.4 item 2 — a chain HEADLINE has a row of its own in the sealed table');
claim('(c4b)', '⛓ §33.4 item 1 — a ONE-SEGMENT chain is accounted for by the walk '
    + 'measurement, though it authors no boot');
claim('(c5)', '⛓ ⚖ 54 (4) — the RECORD-SET projection (`gameVisibleTape`) KEEPS '
    + '`description`, so a prose-only re-emission MOVES and is SEEN. ⚠ THE OPPOSITE of the '
    + 'KEY projection (`latchKeyTape`), which DROPS it — over-inclusive here, exact there');
claim('(c5-stop)', '⛔ …and a prose mover no licence covers is a STOP BEFORE THE GPU, named');
claim('(control)', '⛓ THE CONTROL IS THE STRONG ONE — every boundary of an untouched tree '
    + 'measures ZERO movers, which is the state the pipeline is supposed to report');
claim('(control-empty)', '⛓ …and S3 records NOTHING and says so, ACROSS a real tick-0 '
    + 're-derivation of every tape (`tick0` is projected away — §35.4 item 3)');

console.log('\n## THE SCENARIOS, AND THE GENERATOR\'S OWN PROOF\n');
const EXPECTED = ['control', 'walk-unlicensed', 'walk-licensed', 'resume', 'seeded-failure',
    'prose-only', 'off-table'];
const got = (report?.scenarios ?? []).map((s) => s.id);
check(EXPECTED.every((id) => got.includes(id)),
    '⛓ every scenario the rehearsal owes is present, by name',
    `${got.join(', ')}${EXPECTED.filter((id) => !got.includes(id)).length
        ? ` ⛔ MISSING ${EXPECTED.filter((id) => !got.includes(id)).join(', ')}` : ''}`);

const allRows = [...rows.values()];
check(allRows.length > 0 && allRows.every((r) => r.ok),
    '⛓ …and every row in every scenario is green',
    `${allRows.filter((r) => r.ok).length}/${allRows.length}`);

/**
 * ⛓⛓ THE GENERATOR PROVES ITSELF, AND THE GATE QUOTES THE PROOF. Each fake
 * latch is derived from its SUCCESSOR's own committed boot blocks and run back
 * through `segmentBootFromLatch`; a control boundary that moved anything would
 * mean the rehearsal's zero-mover claim was about the generator, not the
 * pipeline.
 */
const controlProof = report?.scenarios.find((s) => s.id === 'control')?.latchProof ?? [];
check(controlProof.length > 0
    && controlProof.every((p) => p.moved.length === 0 && p.compared > 30),
'⛓ every DERIVED latch authors its successor\'s committed blocks exactly — the fake tree '
    + 'is proved before it is used, never assumed',
controlProof.map((p) => `${p.from}->${p.to} ${p.compared}/${p.moved.length}`).join(' · ')
    || 'no latch proof in the report');

console.log('\n## WHAT A REHEARSAL MUST NEVER DO\n');
/**
 * ⛔⛔ MEASURED, NOT QUOTED. The mode says it spends no GPU; this is the row
 * that can tell. The cache is machine-global (⚖ 47b (5)), so a rehearsal that
 * reached it would write latch files keyed on tapes that exist in no tree —
 * and every later run of the REAL pipeline would be reading them.
 */
check(before === after,
    '⛔ the MACHINE-GLOBAL latch cache is byte-for-byte the same set of files after the '
        + 'rehearsal as before it (⚖ 47b (5)) — measured, not claimed',
    before === after ? `${before === 'ABSENT' ? 'absent on this machine, and still absent'
        : `listing md5 ${before.slice(0, 12)} on both sides`}`
        : `⛔ ${before.slice(0, 12)} -> ${after.slice(0, 12)}`);

check(childOut.includes('never opened a browser'),
    '⛓ …and the run says out loud what it CANNOT claim — the game\'s word on a walk is '
        + '`--latch-provisional`\'s (⚖ 54 (1)), and S4\'s real gates are the re-record\'s own',
    'the closing line of --rehearse');

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
