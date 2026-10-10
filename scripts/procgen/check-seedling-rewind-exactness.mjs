#!/usr/bin/env node
/**
 * check-seedling-rewind-exactness — ⛓ SEEDLING HAMMER-PHASE B3 (D0): THE REWOUND RUN IS THE STRAIGHT RUN.
 *
 * `solveSegment`'s rewind (on its `forkRun`, `replayOntoFork`) defines the state at tick `t` as a fresh BOOT run with
 * the segment's ticks — the caller's prefix included — and non-key inputs replayed. That is only true if NOTHING else fed the live run — a preview that
 * left state behind, an input the replay forgets. This gate runs a producer's own script (unchanged: its `--check`,
 * the L18 sweep, a generated row) in a child under `rewindExactnessHook.js`, which compares, at every press kill's
 * first tick and every `--every`-th tape tick, the live run's fingerprint with the rewound run's, byte for byte.
 * The child's stdout md5 is printed so it can be compared with the producer's plain run (the probe is inert).
 *
 * Any probe whose fingerprints differ is a ⛔ row and the exit is 1.
 *
 * Run:
 *   node scripts/procgen/check-seedling-rewind-exactness.mjs --row=l18
 *   node scripts/procgen/check-seedling-rewind-exactness.mjs --row=sweep --every=25
 *   node scripts/procgen/check-seedling-rewind-exactness.mjs --row=fork-prefix   # the JS worker's factory, a prefix
 *   node scripts/procgen/check-seedling-rewind-exactness.mjs --rows              # the row table, and exit
 *   node scripts/procgen/check-seedling-rewind-exactness.mjs --script=plan-seedling-hammer-a-escape.mjs --args=--check
 *   … --keep=<file.jsonl>   keep the probe rows (default: a temp file, removed)
 *   … --json=<path>         the summary as JSON
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** The rows: every producer whose committed tapes it re-solves, the L18 sweep, and generated certify solves. */
const ROWS = Object.freeze({
    battery: ['solve-seedling-r8-battery.mjs', '--check'],
    'd2-chain': ['solve-seedling-r8-d2-chain.mjs', '--check'],
    l18: ['solve-seedling-r8-l18.mjs', '--check'],
    tail: ['solve-seedling-r8-tail.mjs', '--check'],
    'r9-l3': ['solve-seedling-r9-l3.mjs', '--check'],
    campaign: ['solve-seedling-r9-campaign.mjs', '--check'],
    sweep: ['sweep-seedling-l18-residues.mjs'],
    'killgate-s2': ['census-seedling-killgate-clears.mjs', '--seeds=2-2'],
    'killgate-s5': ['census-seedling-killgate-clears.mjs', '--seeds=5-5'],
    'killgate-s9': ['census-seedling-killgate-clears.mjs', '--seeds=9-9'],
    enemy: ['census-seedling-enemies.mjs'],
    acceptance: ['batch-seedling-acceptance.mjs'],
    // ⛓ b3b — the JS worker's path (`solveFromTape` → `forkRunFor`): a NON-EMPTY prefix with a PLAY equip in it
    'fork-prefix': ['check-seedling-rewind-exactness.mjs', '--drive=fork-prefix'],
});

/**
 * ⛓ b3b — THE `fork-prefix` ROW'S DRIVER (run in the probed child): L42's arrival (`crusher-l42-round-trip`'s
 * staging, the JS arc's `jsRuntimeSolverForkRun` fixture) behind a 12-tick PLAY prefix that equips slot 1 at tick 3,
 * solved through the production worker path — `solveFromTape`, whose `forkRun` is `forkRunFor({…, equips,
 * prefixLength})`. Every probe then rewinds a tick INSIDE the segment from a boot run, the prefix replayed first.
 */
async function driveForkPrefix() {
    const { CRUSHER_WITNESSES, crusherStaging } = await import('./plan-seedling-crusher-witness.mjs');
    const { atlasLevelSource } = await import('../../frontend/modules/seedlingDemo/levelSource.js');
    const { liveOf, replayTape, settleSolve, solveFromTape } = await import(
        '../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
    const w = CRUSHER_WITNESSES.find((x) => x.name === 'crusher-l42-round-trip');
    const staging = await crusherStaging(w);
    const levelSource = atlasLevelSource();
    const perTick = Array.from({ length: 12 }, () => new Set());
    const equips = new Map([[3, 1]]);
    const live = liveOf(replayTape({ staging, perTick, levelSource, equips }));
    const answer = settleSolve(() => solveFromTape({ staging, perTick, live, levelSource, equips,
        solverGoal: JSON.parse(JSON.stringify(w.goals[0])), dashMode: 'none', name: 'b3b-fork-prefix' }));
    console.log(JSON.stringify(answer.ok ? { ok: true, ticks: answer.plan.solution.length, verbs: answer.plan.verbs }
        : { ok: false, message: String(answer.message).slice(0, 300) }));
}

async function probe(script, args, file, every) {
    const env = { ...process.env, SEEDLING_REWIND_PROBE: file, SEEDLING_REWIND_EVERY: String(every) };
    const child = spawn(process.execPath, ['--import', join(HERE, 'rewindExactnessHook.js'), join(HERE, script),
        ...args], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] });
    const md5 = createHash('md5');
    child.stdout.on('data', (d) => md5.update(d.toString().split('\n').filter((l) => !l.startsWith('# box lock:'))
        .join('\n')));
    const code = await new Promise((res) => child.on('close', res));
    return { code, md5: md5.digest('hex') };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--drive=fork-prefix')) {
        await driveForkPrefix();
        return;
    }
    const valueOf = (flag) => {
        const a = argv.find((x) => x.startsWith(`${flag}=`));
        return a ? a.slice(flag.length + 1) : null;
    };
    if (argv.includes('--rows')) {
        for (const [k, v] of Object.entries(ROWS)) console.log(`${k.padEnd(12)} node scripts/procgen/${v.join(' ')}`);
        return;
    }
    const row = valueOf('--row');
    const script = valueOf('--script');
    const [file0, ...args] = script ? [script, ...(valueOf('--args') ?? '').split(' ').filter(Boolean)]
        : (ROWS[row] ?? []);
    if (!file0) throw new Error(`--row=${row}: not a row (--rows lists them), and no --script`);
    const every = Number(valueOf('--every') ?? 50);
    const keep = valueOf('--keep');
    const tmp = keep ? null : mkdtempSync(join(tmpdir(), 'b3-rewind-'));
    const file = keep ?? join(tmp, 'probes.jsonl');
    writeFileSync(file, '');
    const t0 = process.hrtime.bigint();
    const run = await probe(file0, args, file, every);
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const bad = rows.filter((r) => !r.equal);
    const kills = rows.filter((r) => r.kind === 'kill-start');
    const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
    const perTick = rows.filter((r) => r.t > 0).map((r) => r.ms / r.t).sort((a, b) => a - b);
    const q = (xs, f) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(f * xs.length))] : null);
    const summary = { row: row ?? script, script: [file0, ...args].join(' '), exit: run.code, stdoutMd5: run.md5,
        seconds: Number(secs.toFixed(1)), probes: rows.length, killStarts: kills.length,
        segments: new Set(rows.map((r) => r.name)).size, mismatches: bad.length,
        rewindMs: { median: q(ms, 0.5), max: ms[ms.length - 1] ?? null },
        msPerReplayedTick: { median: q(perTick, 0.5) === null ? null : Number(q(perTick, 0.5).toFixed(4)),
            max: perTick.length ? Number(perTick[perTick.length - 1].toFixed(4)) : null },
        maxTick: rows.reduce((m, r) => Math.max(m, r.t), 0) };
    for (const r of bad.slice(0, 10)) {
        console.log(`⛔ ${r.name} t${r.t} (${r.kind}): ${r.diff?.path} live ${r.diff?.live} | rewound ${r.diff?.rewound}`);
    }
    console.log(`# ${summary.row}: exit ${run.code}, stdout md5 ${run.md5}, ${summary.seconds} s; ${rows.length} probe(s) `
        + `(${kills.length} kill start(s), ${summary.segments} segment(s), max tick ${summary.maxTick}); rewind median `
        + `${summary.rewindMs.median} ms, max ${summary.rewindMs.max} ms, ${summary.msPerReplayedTick.median} ms/tick `
        + `median; ⛔ mismatches ${bad.length}`);
    const jsonOut = valueOf('--json');
    if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(summary, null, 1)}\n`);
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    if (bad.length > 0 || rows.length === 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
