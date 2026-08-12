#!/usr/bin/env node
/**
 * sweep-seedling-killarm-inertness — DOES LIFTING A `KILL_ARM_POLICY` ROW MOVE
 * ANY COMMITTED SOLVE?
 *
 * Procgen PoC slice 4c (kickoff §14.2). The byte-inertness oracle for a kill-arm
 * lift: it flips one or more rows `refused` -> `modelled`, re-runs the two
 * solver gates, diffs their output against the unflipped run, and RESTORES the
 * source. It gates nothing itself; it reports.
 *
 * ── ⛔ WHY IT MUTATES A SOURCE FILE, AND HOW IT IS SAFE ────────────────
 *
 * The claim can only be measured by making the change: `KILL_ARM_POLICY` is
 * `Object.freeze`d and imported directly by `solverBot`, so there is no
 * injection seam and a monkey-patch is not available. So the instrument edits,
 * measures and restores — with three conditions, because
 * [[feedback_mutation_test_revert_clobbers]] is exactly this family:
 *
 *   1. it REFUSES to run unless the target file is clean in `git status`, so a
 *      restore cannot clobber somebody's uncommitted work;
 *   2. the original bytes are held IN MEMORY and restored in a `finally` — not
 *      via `git checkout`, which would also revert edits this instrument did
 *      not make;
 *   3. the restore is VERIFIED byte-for-byte and shouts by name if it failed.
 *
 * ── ⚠ THE BOUNDS, NAMED ───────────────────────────────────────────────
 *
 *  · The two gates are the SOLVER ones: `solve-seedling-r8-battery --check`
 *    (nine rooms) and `solve-seedling-r8-tail --only=5,8 --check` (L5, the only
 *    committed room with bobs AND a kill-lock; L8, the sandtrap room). A tape
 *    REPLAY cannot move under a policy row — replay does not run the solver —
 *    so the fixture suite is deliberately not in scope and is named as such.
 *  · A row this instrument reports INERT is inert FOR THESE ROOMS. It is not a
 *    proof about a room nobody has committed, and it is not a proof about a
 *    build that also widens the LIVE-BODY SOURCE the policy sits behind (see
 *    the structural note the report prints).
 *
 * Run:
 *   node scripts/procgen/sweep-seedling-killarm-inertness.mjs
 *   node scripts/procgen/sweep-seedling-killarm-inertness.mjs --rows=Bob,SandTrap
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TARGET = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'enemyDamage.js');
const REL = relative(REPO, TARGET);

const arg = (process.argv.find((a) => a.startsWith('--rows=')) ?? '').slice(7);
const ROWS = (arg || 'Bob,SandTrap').split(',').filter(Boolean);

/** The gates a policy row could conceivably move, with their bounds. */
const GATES = [
    { name: 'battery --check (9 rooms: L0,2,3,4,6,7,9,10,11)',
        argv: ['scripts/procgen/solve-seedling-r8-battery.mjs', '--check'] },
    { name: 'tail --only=5,8 --check (L5 bobs+kill-lock, L8 sandtraps)',
        argv: ['scripts/procgen/solve-seedling-r8-tail.mjs', '--only=5,8', '--check'] },
];

const run = (argv) => {
    try {
        return { out: execFileSync('node', argv, { cwd: REPO, encoding: 'utf8' }), code: 0 };
    } catch (e) {
        // ⚠ A NON-ZERO EXIT IS DATA, NOT A CRASH — the battery exits 1 on its
        // two KNOWN `r8-solve-4`/`-6` drift rows and has since R8. The
        // comparison is the OUTPUT, and the code is compared beside it.
        return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? -1 };
    }
};

// ── 0. the guard ──────────────────────────────────────────────────────
const dirty = execFileSync('git', ['status', '--porcelain', '--', REL],
    { cwd: REPO, encoding: 'utf8' }).trim();
if (dirty) {
    console.error(`REFUSED: ${REL} is not clean in git (\`${dirty}\`). This instrument `
        + 'edits it and restores it, and a restore over uncommitted work is the '
        + 'clobber [[feedback_mutation_test_revert_clobbers]] names. Commit or stash '
        + 'first.');
    process.exit(2);
}

const ORIGINAL = readFileSync(TARGET, 'utf8');

console.log(`## flipping [${ROWS.join(', ')}] \`refused\` -> \`modelled\` in ${REL}`);
console.log('## the population is the two SOLVER gates; a tape REPLAY cannot move under '
    + 'a policy row (replay does not run the solver), so the fixture suite is out of '
    + 'scope BY CONSTRUCTION and is named rather than silently omitted.\n');

let failures = 0;
try {
    // ── 1. before ─────────────────────────────────────────────────────
    const before = GATES.map((g) => ({ g, r: run(g.argv) }));

    // ── 2. the flip ───────────────────────────────────────────────────
    // ⛔ THE WRITE IS BELOW THE WHOLE LOOP, AND THAT IS LOAD-BEARING.
    // `process.exit()` does NOT unwind the stack, so the `finally` restore
    // below never runs for the refusal arm inside this loop. Building the
    // patched text in memory and writing ONCE, after every row has matched,
    // is what makes a mid-loop refusal leave the file untouched rather than
    // half-flipped with no restore. (Driven: `--rows=Nonesuch` exits 2 and
    // `enemyDamage.js` is byte-identical afterwards.)
    let patched = ORIGINAL;
    for (const row of ROWS) {
        // The row's own opening, in both spellings the table uses (a one-line
        // `Object.freeze({ policy: 'refused', ...})` and a multi-line one).
        const oneLine = new RegExp(`(${row}: Object\\.freeze\\(\\{ )policy: 'refused'`);
        const multi = new RegExp(`(${row}: Object\\.freeze\\(\\{\\n\\s*)policy: 'refused'`);
        const next = oneLine.test(patched) ? patched.replace(oneLine, "$1policy: 'modelled'")
            : patched.replace(multi, "$1policy: 'modelled'");
        if (next === patched) {
            console.error(`REFUSED: no \`refused\` row named "${row}" in ${REL}. A flip `
                + 'that silently matched nothing would report INERT for a change it '
                + 'never made.');
            process.exit(2);
        }
        patched = next;
    }
    writeFileSync(TARGET, patched);

    // ── 3. after, and the diff ────────────────────────────────────────
    for (const { g, r } of before) {
        const now = run(g.argv);
        const same = now.out === r.out && now.code === r.code;
        if (!same) failures += 1;
        console.log(`${same ? 'INERT' : '⛔ MOVED'}: ${g.name} — `
            + `exit ${r.code} -> ${now.code}, ${r.out.length} -> ${now.out.length} bytes`);
        if (!same) {
            const a = r.out.split('\n');
            const b = now.out.split('\n');
            for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
                if (a[i] !== b[i]) console.log(`    line ${i + 1}:\n      - ${a[i] ?? '(absent)'}\n      + ${b[i] ?? '(absent)'}`);
            }
        }
    }
} finally {
    // ── 4. the restore, VERIFIED ──────────────────────────────────────
    writeFileSync(TARGET, ORIGINAL);
    if (readFileSync(TARGET, 'utf8') !== ORIGINAL) {
        console.error(`⛔⛔ THE RESTORE OF ${REL} FAILED. The working tree is NOT what `
            + 'this instrument found. Recover with `git checkout -- ' + REL + '`.');
        process.exit(3);
    }
    console.log(`\n## ${REL} restored and verified byte-for-byte.`);
}

// ── 5. the structural note the measurement does not by itself carry ───
console.log('\n## ⛓ WHY THIS COMES BACK INERT, and it is stronger than the measurement:');
console.log('   `derivePressKill` builds `liveById` from `run.spinnerBodies` ONLY');
console.log('   (solverBot.js:2432-2434), and reads `KILL_ARM_POLICY[as3]` (:2451) only');
console.log('   for a body that IS in it. So the policy read is reachable for SPINNER');
console.log('   ids alone — every other row in the table is unreachable BY');
console.log('   CONSTRUCTION, in every room, not merely unreached in these ones.');
console.log('   ⇒ a build that flips a row AND widens the live-body source is NOT');
console.log('     covered by this sweep: re-run it against that build.');

process.exit(failures > 0 ? 1 : 0);
