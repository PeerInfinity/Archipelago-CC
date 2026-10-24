#!/usr/bin/env node
/**
 * profile-seedling-hammer-escape — ⛓ SEEDLING HAMMER-PHASE A4 W0: WHERE THE ESCAPE'S SEARCH TIME GOES.
 *
 * Installs `solverBot.HAMMER_ESCAPE_TRACE.sink` and records EVERY `pressEscape` call while a workload runs: who asked
 * (`admission` = `deriveStrike`'s bounded pass under `derivePressKill`, `continuation`, `walk` = the executor's
 * per-tick re-derivation, `aim` = the live arm), the verdict (`ok`, a claimed negative's bound, or `no-claim`), the
 * kernel expansions (each search: `free` from the landing, `stood` the retry with the train stood), and the wall ms
 * of the whole call (the previews and the hit-aware forecasts included). Then one table per workload: per caller ×
 * verdict the calls, expansions (sum / max) and ms (sum); the expansion histogram; the ten costliest calls. Pure node;
 * no browser, no box lock, writes nothing unless `--json=`.
 *
 * Workloads (any number, run in order):
 *   --gen=<biome>:<seeds>          `generateGenRoom` as `seedlingGenCapacity.slow` draws it (2 exits, 10×10, the
 *                                  default elements), one draw per seed: `--gen=post-sword:30`
 *   --killgate=<seed>:<k-range>    the killgate row's re-roll draws: the room at `rerollSeed(seed, k)`, post-sword,
 *                                  1 exit, `elements: killgate`: `--killgate=57:0-5`
 *   --script=<path> [args…]        another node instrument IN THIS PROCESS (its argv is the rest of the line):
 *                                  `--script=scripts/procgen/sweep-seedling-l18-residues.mjs --residues=21`
 *
 * Run:
 *   node scripts/procgen/profile-seedling-hammer-escape.mjs --gen=post-sword:30
 *   node scripts/procgen/profile-seedling-hammer-escape.mjs --killgate=57:0-3 --killgate=53:0-3
 *   node scripts/procgen/profile-seedling-hammer-escape.mjs --script=scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=3
 *   node scripts/procgen/profile-seedling-hammer-escape.mjs --gen=post-sword:30 --json=<path>   # also every call
 *   SEEDLING_HAMMER_ESCAPE=0 node scripts/procgen/profile-seedling-hammer-escape.mjs --gen=post-sword:30  # OFF: wall only
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** `0-5,9` → [0, 1, 2, 3, 4, 5, 9]. */
export function parseRange(spec) {
    const out = [];
    for (const part of String(spec).split(',')) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
        if (!m) throw new Error(`profile-seedling-hammer-escape: "${part}" is not a number or a range a-b`);
        const a = Number(m[1]);
        const b = m[2] === undefined ? a : Number(m[2]);
        for (let k = a; k <= b; k += 1) out.push(k);
    }
    return out;
}

/** The calls of one workload, folded: per `caller verdict` the count, expansions (sum, max) and ms (sum). */
export function summarise(calls) {
    const rows = new Map();
    for (const c of calls) {
        const verdict = c.ok ? 'ok' : (c.claim ? c.bound : 'no-claim');
        const key = `${c.caller} ${verdict}`;
        const r = rows.get(key) ?? { caller: c.caller, verdict, calls: 0, expansions: 0, max: 0, ms: 0 };
        r.calls += 1;
        r.expansions += c.expansions;
        r.max = Math.max(r.max, c.expansions);
        r.ms += c.ms;
        rows.set(key, r);
    }
    return [...rows.values()].sort((a, b) => b.ms - a.ms);
}

/** Expansions per call, binned by decade: `0`, `1-9`, `10-99`, … */
export function histogram(calls) {
    const bins = {};
    for (const c of calls) {
        const e = c.expansions;
        const bin = e === 0 ? '0' : `${10 ** Math.floor(Math.log10(e))}-${10 ** (Math.floor(Math.log10(e)) + 1) - 1}`;
        bins[bin] = (bins[bin] ?? 0) + 1;
    }
    return bins;
}

function parseArgs(argv) {
    const work = [];
    let json = null;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a.startsWith('--gen=')) {
            const [biome, seeds] = a.slice(6).split(':');
            work.push({ kind: 'gen', biome, seeds: parseRange(seeds) });
        } else if (a.startsWith('--killgate=')) {
            const [seed, ks] = a.slice(11).split(':');
            work.push({ kind: 'killgate', seed: Number(seed), ks: parseRange(ks ?? '0') });
        } else if (a.startsWith('--script=')) {
            work.push({ kind: 'script', path: a.slice(9), args: argv.slice(i + 1) });
            break;
        } else if (a.startsWith('--json=')) {
            json = a.slice(7);
        } else {
            throw new Error(`profile-seedling-hammer-escape: unknown argument "${a}" (see --help)`);
        }
    }
    if (work.length === 0) throw new Error('profile-seedling-hammer-escape: name a workload (--gen=, --killgate=, --script=)');
    return { work, json };
}

const fmt = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

function report(label, calls, wall) {
    const total = calls.reduce((a, c) => a + c.ms, 0);
    const exp = calls.reduce((a, c) => a + c.expansions, 0);
    console.log(`\n## ${label}: wall ${fmt(wall / 1000)} s; ${calls.length} escape call(s), ${exp} expansion(s), `
        + `${fmt(total / 1000)} s in the escape (${wall > 0 ? fmt((100 * total) / wall) : '—'}% of wall)`);
    if (calls.length === 0) return;
    console.log('| caller | verdict | calls | expansions | max | ms |');
    console.log('|---|---|---|---|---|---|');
    for (const r of summarise(calls)) {
        console.log(`| ${r.caller} | ${r.verdict} | ${r.calls} | ${r.expansions} | ${r.max} | ${fmt(r.ms)} |`);
    }
    console.log(`histogram (expansions per call): ${JSON.stringify(histogram(calls))}`);
    const top = [...calls].sort((a, b) => b.ms - a.ms).slice(0, 10);
    console.log('costliest: ' + top.map((c) => `${c.caller}@t${c.t}→${c.pressAt} `
        + `${c.ok ? 'ok' : (c.claim ? c.bound : 'no-claim')} ${c.expansions}e `
        + `[${c.searches.map((s) => `${s.phase}:${s.expansions}${s.ok ? '' : `/${s.bound}`}`).join(' ')}] ${fmt(c.ms)}ms`)
        .join('; '));
}

async function main() {
    const { work, json } = parseArgs(process.argv.slice(2));
    const solverBot = await import(pathToFileURL(join(MODULE, 'solverBot.js')).href);
    const room = await import(pathToFileURL(join(MODULE, 'seedlingGenRoom.js')).href);
    const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
    console.log(`# profile-seedling-hammer-escape: HAMMER_ESCAPE ${solverBot.HAMMER_ESCAPE.enabled ? 'ON' : 'OFF'}, `
        + `bounds ${JSON.stringify(solverBot.HAMMER_ESCAPE_BOUNDS)}`);
    const all = [];
    let calls = [];
    // ⛓ the run a call was asked on, as an ordinal (the run itself is never kept): repeats ACROSS solves vs within one
    const runs = new WeakMap();
    let nextRun = 0;
    solverBot.HAMMER_ESCAPE_TRACE.sink = ({ run: r, ...rec }) => {
        if (!runs.has(r)) runs.set(r, nextRun++);
        calls.push({ ...rec, run: runs.get(r) });
    };
    const run = async (label, fn) => {
        calls = [];
        const t0 = performance.now();
        let outcome = 'ok';
        try { await fn(); } catch (e) { outcome = `THREW ${String(e.message).slice(0, 120)}`; }
        const wall = performance.now() - t0;
        report(`${label} (${outcome})`, calls, wall);
        all.push({ label, outcome, wall, calls });
    };
    try {
        for (const w of work) {
            if (w.kind === 'gen') {
                for (const seed of w.seeds) {
                    await run(`gen ${w.biome} seed ${seed}`, () => room.generateGenRoom({
                        region_id: 'census', exits: [{ exit_id: 'e0' }, { exit_id: 'e1' }],
                        size: { width: 10, height: 10 }, rng: seededRng(seed),
                        params: { seedlingGen: { biome: w.biome } },
                    }));
                }
            } else if (w.kind === 'killgate') {
                for (const k of w.ks) {
                    const drawn = room.rerollSeed(w.seed, k);
                    await run(`killgate seed ${w.seed} k=${k} (room seed ${drawn})`, () => room.generateGenRoom({
                        region_id: 'cap', exits: [{ exit_id: 'e0' }], size: { width: 10, height: 10 },
                        rng: seededRng(drawn), params: { seedlingGen: { biome: 'post-sword', elements: 'killgate' } },
                    }));
                }
            } else {
                const path = resolve(w.path);
                process.argv = [process.argv[0], path, ...w.args];
                await run(`script ${w.path} ${w.args.join(' ')}`, () => import(pathToFileURL(path).href));
            }
        }
    } finally {
        solverBot.HAMMER_ESCAPE_TRACE.sink = null;
    }
    if (all.length > 1) report('ALL', all.flatMap((x) => x.calls), all.reduce((a, x) => a + x.wall, 0));
    if (json) writeFileSync(json, JSON.stringify(all, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
