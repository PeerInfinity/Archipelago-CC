#!/usr/bin/env node
/**
 * profile-seedling-hammer-approach — ⛓ SEEDLING HAMMER-PHASE B1: WHAT THE APPROACH SEARCH SPENDS.
 *
 * Turns `solverBot.HAMMER_APPROACH` ON and installs `HAMMER_APPROACH_TRACE.sink`, recording EVERY `deriveApproach`
 * search while a workload runs: who asked (`admission` = `derivePressKill`'s first strike, `walk` = the executor's
 * tick with no strike in hand), the verdict (`found`, or the negative's bound: `exhausted`, `horizon`, `expansions`,
 * `deadline`, `window`, `dying`, `start`, `body`), the kernel's expansions, the index of the strike found (its aim
 * tick, from the search's start), the goal candidates that passed the in-reach test and the escapes asked of them, and
 * the wall ms (the goal's escapes included). Then one table per workload: per caller × verdict the searches,
 * expansions (sum / max) and ms; the expansion histogram; the found index's distribution. The workloads are
 * `profile-seedling-hammer-escape.mjs`'s (`--gen=`, `--killgate=`, `--script=`), and so is the shape of the report.
 * Pure node; no browser, no box lock, writes nothing unless `--json=`.
 *
 * Run:
 *   node scripts/procgen/profile-seedling-hammer-approach.mjs --script=scripts/procgen/sweep-seedling-l18-residues.mjs
 *   node scripts/procgen/profile-seedling-hammer-approach.mjs --killgate=57:0-3
 *   node scripts/procgen/profile-seedling-hammer-approach.mjs --script=scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=3
 *   node scripts/procgen/profile-seedling-hammer-approach.mjs --gen=post-sword:30 --json=<path>   # also every search
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { histogram, parseRange } from './profile-seedling-hammer-escape.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** One search's verdict, as the tables print it. */
export const verdictOf = (c) => (c.ok ? 'found' : c.bound);

/** The searches of one workload, folded: per `caller verdict` the count, expansions (sum, max), escapes and ms. */
export function summarise(calls) {
    const rows = new Map();
    for (const c of calls) {
        const verdict = verdictOf(c);
        const key = `${c.caller} ${verdict}`;
        const r = rows.get(key) ?? { caller: c.caller, verdict, calls: 0, expansions: 0, max: 0, escapes: 0, ms: 0 };
        r.calls += 1;
        r.expansions += c.expansions;
        r.max = Math.max(r.max, c.expansions);
        r.escapes += c.escapes;
        r.ms += c.ms;
        rows.set(key, r);
    }
    return [...rows.values()].sort((a, b) => b.ms - a.ms);
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
            throw new Error(`profile-seedling-hammer-approach: unknown argument "${a}" (see --help)`);
        }
    }
    if (work.length === 0) {
        throw new Error('profile-seedling-hammer-approach: name a workload (--gen=, --killgate=, --script=)');
    }
    return { work, json };
}

const fmt = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

function report(label, calls, wall) {
    const total = calls.reduce((a, c) => a + c.ms, 0);
    const exp = calls.reduce((a, c) => a + c.expansions, 0);
    console.log(`\n## ${label}: wall ${fmt(wall / 1000)} s; ${calls.length} approach search(es), ${exp} expansion(s), `
        + `${fmt(total / 1000)} s in the approach (${wall > 0 ? fmt((100 * total) / wall) : '—'}% of wall)`);
    if (calls.length === 0) return;
    console.log('| caller | verdict | searches | expansions | max | escapes | ms |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of summarise(calls)) {
        console.log(`| ${r.caller} | ${r.verdict} | ${r.calls} | ${r.expansions} | ${r.max} | ${r.escapes} | `
            + `${fmt(r.ms)} |`);
    }
    console.log(`histogram (expansions per search): ${JSON.stringify(histogram(calls))}`);
    const found = calls.filter((c) => c.ok).map((c) => c.index).sort((a, b) => a - b);
    if (found.length > 0) {
        console.log(`found index (aim tick from the search's start): min ${found[0]}, median `
            + `${found[Math.floor(found.length / 2)]}, max ${found[found.length - 1]}`);
    }
    const top = [...calls].sort((a, b) => b.ms - a.ms).slice(0, 8);
    console.log('costliest: ' + top.map((c) => `${c.caller}@t${c.t} ${verdictOf(c)} ${c.expansions}e `
        + `${c.goals}g/${c.escapes}esc ${fmt(c.ms)}ms`).join('; '));
}

async function main() {
    const { work, json } = parseArgs(process.argv.slice(2));
    const solverBot = await import(pathToFileURL(join(MODULE, 'solverBot.js')).href);
    const room = await import(pathToFileURL(join(MODULE, 'seedlingGenRoom.js')).href);
    const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
    solverBot.HAMMER_APPROACH.enabled = true;
    console.log(`# profile-seedling-hammer-approach: HAMMER_APPROACH ON, HAMMER_ESCAPE `
        + `${solverBot.HAMMER_ESCAPE.enabled ? 'ON' : 'OFF'}, bounds ${JSON.stringify(solverBot.HAMMER_APPROACH_BOUNDS)}`);
    const all = [];
    let calls = [];
    const runs = new WeakMap();
    let nextRun = 0;
    // eslint-disable-next-line no-unused-vars
    solverBot.HAMMER_APPROACH_TRACE.sink = ({ run: r, out, ...rec }) => {
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
        solverBot.HAMMER_APPROACH_TRACE.sink = null;
        solverBot.HAMMER_APPROACH.enabled = false;
    }
    if (all.length > 1) report('ALL', all.flatMap((x) => x.calls), all.reduce((a, x) => a + x.wall, 0));
    if (json) writeFileSync(json, JSON.stringify(all, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
