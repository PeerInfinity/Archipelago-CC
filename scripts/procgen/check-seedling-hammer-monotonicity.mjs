#!/usr/bin/env node
/**
 * check-seedling-hammer-monotonicity — ⛓ SEEDLING HAMMER-PHASE B2 (W0): NO RECORD SOLVED OFF MAY BE REFUSED ON.
 *
 * B1 measured this from a scratch file (`mono.mjs`, thrown away) and found seven generated certify records that solve
 * with `HAMMER_APPROACH` off and refuse with it on. This is that instrument, committed:
 *   1. CAPTURE — the row's OWN script (unchanged: `dump-seedling-kind-pairs`, `census-seedling-killgate-clears`, …)
 *      is run in a child under `hammerMonotonicityHook.js`, with the generator's path in the mode `--path` names. Every
 *      oracle solve whose level record holds a spinner is captured (the record, the staging, the goals, the budget)
 *      with its verdict, and the row's stdout md5 is printed so it can be compared with the identity block's.
 *   2. RE-SOLVE — each captured record is solved again under every mode `--modes` names (`off` = the switches as the
 *      repository ships them; `fight` = `HAMMER_FIGHT` on; `approach` = `HAMMER_APPROACH` on; B3's `fallback` =
 *      `HAMMER_FIGHT_FALLBACK` on, `whole` = it in its whole-solve mode), in this process, by
 *      `procgenOracle.solve` itself. The path's own mode must reproduce the captured verdict and ticks (a replay check).
 *
 * A record SOLVED under `off` and not SOLVED under another mode is a ⛔ row and the exit is 1.
 *
 * Run:
 *   node scripts/procgen/check-seedling-hammer-monotonicity.mjs --row=c4 --path=approach --modes=off,approach
 *   node scripts/procgen/check-seedling-hammer-monotonicity.mjs --row=c3 --path=fight --modes=off,fight --jobs=3
 *   node scripts/procgen/check-seedling-hammer-monotonicity.mjs --row=killgate-s2 --modes=off,fight,approach
 *   node scripts/procgen/check-seedling-hammer-monotonicity.mjs --rows                 # the row table, and exit
 *   node scripts/procgen/check-seedling-hammer-monotonicity.mjs --records=<file.jsonl> --modes=off,fight
 *                                                                                    # re-solve a capture only
 *   … --json=<path>         every record's verdicts and ticks per mode
 *   … --keep=<file.jsonl>   keep the capture (default: a temp file, removed)
 *   … --shard=k/N           re-solve every N-th record from k (a child of `--jobs`)
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
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The identity block's rows that hold spinner traffic, with their own commands (`identity-block.sh`). */
const ROWS = Object.freeze({
    acceptance: ['batch-seedling-acceptance.mjs'],
    c3: ['dump-seedling-kind-pairs.mjs', '--kinds=empty', '--seeds=1-40', '--count=3'],
    c6: ['dump-seedling-kind-pairs.mjs', '--kinds=empty', '--seeds=1-40', '--count=6'],
    c4: ['dump-seedling-kind-pairs.mjs', '--kinds=winding,rooms,branchy,bushy,loopy,open', '--seeds=1-12',
        '--count=4'],
    enemy: ['census-seedling-enemies.mjs'],
    'killgate-s2': ['census-seedling-killgate-clears.mjs', '--seeds=2-2'],
    'killgate-s5': ['census-seedling-killgate-clears.mjs', '--seeds=5-5'],
    'killgate-s9': ['census-seedling-killgate-clears.mjs', '--seeds=9-9'],
    // ⛓ `seedlingGenCapacity`'s rows, as a dump (the vitest files run under their own loader)
    'capacity-killgate': ['dump-seedling-gen-capacity.mjs', '--killgate', '--seeds=53,57'],
    'capacity-post': ['dump-seedling-gen-capacity.mjs', '--biomes=post-sword', '--seeds=1-60'],
    'capacity-pre': ['dump-seedling-gen-capacity.mjs', '--biomes=pre-sword', '--seeds=1-60'],
});

/** The switches each mode sets (the env a child reads at import; the flags this process sets per solve). */
const MODES = Object.freeze({
    off: {},
    fight: { SEEDLING_HAMMER_FIGHT: '1' },
    approach: { SEEDLING_HAMMER_APPROACH: '1' },
    // ⛓ hammer-phase B3 — the fight as a FALLBACK: the rewind retry (default mode), and the whole-solve retry only
    fallback: { SEEDLING_HAMMER_FIGHT_FALLBACK: '1' },
    whole: { SEEDLING_HAMMER_FIGHT_FALLBACK: '1', SEEDLING_HAMMER_FIGHT_FALLBACK_MODE: 'whole' },
});

const isSolved = (v) => v === 'SOLVED';

async function capture(row, path, file) {
    const [script, ...args] = ROWS[row];
    const env = { ...process.env, SEEDLING_SOLVE_CAPTURE: file };
    delete env.SEEDLING_HAMMER_FIGHT;
    delete env.SEEDLING_HAMMER_APPROACH;
    delete env.SEEDLING_HAMMER_FIGHT_FALLBACK;
    delete env.SEEDLING_HAMMER_FIGHT_FALLBACK_MODE;
    Object.assign(env, MODES[path]);
    const child = spawn(process.execPath, ['--import', join(HERE, 'hammerMonotonicityHook.js'), join(HERE, script),
        ...args], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] });
    const md5 = createHash('md5');
    child.stdout.on('data', (d) => md5.update(d));
    const code = await new Promise((res) => child.on('close', res));
    return { code, md5: md5.digest('hex') };
}

async function resolveAll(records, modes, shard) {
    const { solve } = await import(join(MODULE, 'procgenOracle.js'));
    const SB = await import(join(MODULE, 'solverBot.js'));
    // ⛓ `off` is the shipped configuration (both switches off), whatever this process's env says
    const set = (mode) => {
        SB.HAMMER_FIGHT.enabled = mode === 'fight';
        SB.HAMMER_APPROACH.enabled = mode === 'approach';
        SB.HAMMER_FIGHT_FALLBACK.enabled = mode === 'fallback' || mode === 'whole';
        SB.HAMMER_FIGHT_FALLBACK.mode = mode === 'whole' ? 'whole' : 'rewind';
    };
    // ⛓ every fight search's record (`HAMMER_FIGHT_TRACE`), per re-solve: the cost distribution and the negatives
    let searches = null;
    SB.HAMMER_FIGHT_TRACE.sink = (x) => {
        if (searches !== null) searches.push({ t: x.t, caller: x.caller, ok: x.ok, bound: x.bound, goal: x.goal,
            expansions: x.expansions, ms: Math.round(x.ms) });
    };
    const out = [];
    records.forEach((rec, k) => {
        if (shard && k % shard.of !== shard.k) return;
        const row = { k, n: rec.n, name: rec.args.opts.name, captured: { verdict: rec.verdict, ticks: rec.ticks } };
        for (const mode of modes) {
            set(mode);
            searches = ['fight', 'fallback', 'whole'].includes(mode) ? [] : null;
            const t0 = process.hrtime.bigint();
            let r;
            try {
                const { levelRecord, staging, goals, budget, opts } = rec.args;
                const s = solve(levelRecord, staging, goals, budget, opts);
                r = { verdict: s.verdict, ticks: s.ticks ?? null, why: isSolved(s.verdict) ? null
                    : String(s.reasonText ?? '').split('\n')[0].slice(0, 160) };
                // ⛓ hammer-phase B3 — which path produced the keys (or what the fallback did before the refusal stood)
                const ff = s.fightFallbacks ?? (s.fightFallback ? [s.fightFallback] : null);
                if (ff) r.fallbacks = ff;
            } catch (e) {
                r = { verdict: `THREW:${e.name}`, ticks: null, why: String(e.message).split('\n')[0].slice(0, 160) };
            }
            r.seconds = Number(process.hrtime.bigint() - t0) / 1e9;
            if (searches !== null) r.fights = searches;
            row[mode] = r;
        }
        set('off');
        out.push(row);
    });
    return out;
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const argv = process.argv.slice(2);
    const valueOf = (flag) => {
        const a = argv.find((x) => x.startsWith(`${flag}=`));
        return a ? a.slice(flag.length + 1) : null;
    };
    if (argv.includes('--rows')) {
        for (const [k, v] of Object.entries(ROWS)) console.log(`${k.padEnd(12)} node scripts/procgen/${v.join(' ')}`);
        return;
    }
    const row = valueOf('--row');
    const recordsFile = valueOf('--records');
    // ⛓ the generator's path: the capture's mode (`off` unless named); a re-used capture names it or skips the replay
    const path = valueOf('--path') ?? (recordsFile ? null : 'off');
    const modes = (valueOf('--modes') ?? 'off,fight').split(',').filter(Boolean);
    for (const m of [path ?? 'off', ...modes]) {
        if (!MODES[m]) throw new Error(`unknown mode "${m}" (off, fight, approach, fallback, whole)`);
    }
    const keep = valueOf('--keep');
    const jsonOut = valueOf('--json');
    const jobs = Number(valueOf('--jobs') ?? 1);
    const shardArg = valueOf('--shard');
    const shard = shardArg ? { k: Number(shardArg.split('/')[0]), of: Number(shardArg.split('/')[1]) } : null;

    let file = recordsFile;
    let tmp = null;
    if (!file) {
        if (!ROWS[row]) throw new Error(`--row=${row}: not a row (--rows lists them)`);
        tmp = mkdtempSync(join(tmpdir(), 'b2-mono-'));
        file = keep ?? join(tmp, 'capture.jsonl');
        writeFileSync(file, '');
        const t0 = process.hrtime.bigint();
        const cap = await capture(row, path, file);
        console.log(`# capture: row ${row} (path ${path}) exit ${cap.code}, stdout md5 ${cap.md5}, `
            + `${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)} s`);
    }
    const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    if (!shard) console.log(`# ${records.length} spinner record(s); modes ${modes.join(', ')}`);

    let rows;
    if (jobs > 1 && !shard) {
        // ⚠ one temp dir for the shards' parts, removed below (a re-used capture has none of its own)
        tmp = tmp ?? mkdtempSync(join(tmpdir(), 'b2-mono-'));
        const parts = await Promise.all(Array.from({ length: jobs }, (_, k) => new Promise((res, rej) => {
            const part = join(tmp, `shard-${k}.json`);
            const child = spawn(process.execPath, [fileURLToPath(import.meta.url), `--records=${file}`,
                `--modes=${modes.join(',')}`, `--shard=${k}/${jobs}`, `--json=${part}`],
            { cwd: REPO, env: process.env, stdio: ['ignore', 'ignore', 'inherit'] });
            child.on('close', (code) => (code === 0 || code === 1
                ? res(JSON.parse(readFileSync(part, 'utf8')).rows) : rej(new Error(`shard ${k} exit ${code}`))));
        })));
        rows = parts.flat().sort((a, b) => a.k - b.k);
    } else {
        rows = await resolveAll(records, modes, shard);
    }
    let bad = 0;
    let replay = 0;
    if (!shard) {
        for (const r of rows) {
            const own = path ? r[path] : null;
            const same = !own || (own.verdict === r.captured.verdict && own.ticks === r.captured.ticks);
            if (own && !same) replay += 1;
            const off = r.off;
            const worse = off && isSolved(off.verdict)
                ? modes.filter((m) => m !== 'off' && !isSolved(r[m].verdict)) : [];
            if (worse.length > 0) bad += 1;
            const fightCell = (x) => (x.fights ? ` [${x.fights.map((f) => (f.ok ? `ok${f.expansions}` : `${f.bound}${
                f.expansions}`)).join(',')}]` : '');
            const ffCell = (x) => (x.fallbacks ? ` {${x.fallbacks.map((f) => `${f.how}@${f.t}:${f.verdict}`).join(',')}}`
                : '');
            const cells = modes.map((m) => `${m} ${r[m].verdict}${r[m].ticks === null ? '' : ` ${r[m].ticks}`}`
                + ` (${r[m].seconds.toFixed(1)}s)${fightCell(r[m])}${ffCell(r[m])}`).join(' · ');
            console.log(`${String(r.k).padStart(4)} n${String(r.n).padStart(4)} ${cells}`
                + `${same ? '' : `  ⚠ REPLAY ${r.captured.verdict} ${r.captured.ticks}`}`
                + `${worse.length ? `  ⛔ SOLVED→${worse.map((m) => `${m}:${r[m].verdict}`).join(',')} `
                    + `${worse.map((m) => r[m].why).join(' | ')}` : ''}`);
        }
        const tally = Object.fromEntries(modes.map((m) => [m, rows.filter((r) => isSolved(r[m].verdict)).length]));
        const flips = modes.filter((m) => m !== 'off').map((m) => `${m}: refused→solved `
            + `${rows.filter((r) => r.off && !isSolved(r.off.verdict) && isSolved(r[m].verdict)).length}`);
        const secs = Object.fromEntries(modes.map((m) => [m, Number(rows.reduce((a, r) => a + r[m].seconds, 0)
            .toFixed(1))]));
        console.log(`\n# ${rows.length} record(s); solved ${JSON.stringify(tally)}; ${flips.join('; ')}; `
            + `seconds ${JSON.stringify(secs)}; replay mismatches ${replay}; ⛔ solved→refused ${bad}`);
    }
    if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ row, path, modes, rows }, null, 1)}\n`);
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    if (bad > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
