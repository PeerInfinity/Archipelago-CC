#!/usr/bin/env node
/**
 * ci-producer-checks — **EVERY PRODUCER'S OWN `--check`, AND A NON-ZERO rc
 * FAILS THE RUN** (Seedling hammer-phase slice RR, ⚖ user 2026-10-19).
 *
 * ── ⛔ WHY IT EXISTS ─────────────────────────────────────────────────
 *
 * At `d8fa8e0b19` seven producer `--check`s were red on main and nobody owned
 * them: `plan-seedling-r5-conch` and `-r5-feather` since 84ebe05dcb (2026-08-06),
 * `-r6-shieldboss` since its OWN introducing commit, and four more since
 * f2baacde0a. Each one is about a second of node; none of them ran anywhere
 * unless a slice happened to re-run it. A `--check` that runs nowhere is a
 * claim nobody is measuring.
 *
 * ── ⛓ THE ROSTER IS A GLOB, NOT A LIST (⚖ minimize hardcoding) ────────
 *
 *   scripts/procgen/plan-seedling-*.mjs
 *   frontend/modules/seedlingDemo/fixtures/regenerate-*-tapes.mjs
 *
 * A new producer enrols itself by its name. Two dialects are both dry under
 * `--check`: the ones that WRITE unless `--check` (the regenerators, the
 * witnesses) and the ones that are a dry run unless `--write` (most `plan-*`,
 * for which `--check` is the dry run plus their own asserts). ⛔ An enrolled
 * file whose text names NEITHER flag is a RED row and is never spawned —
 * nothing says it is dry.
 *
 * ⛔ EXCLUSIONS ARE NAMED, WITH THEIR REASON, BELOW — and an exclusion that
 * matches no enrolled file is itself a red (a stale exclusion is the quietest
 * way for a row to vanish). An excluded row is printed as `## PRODUCER-SKIPPED`.
 *
 * ── WHAT A ROW ASSERTS ───────────────────────────────────────────────
 *
 *   · exit 0 within `--timeout-s` (default 900 per producer);
 *   · `git status --porcelain` unchanged across the whole battery — a
 *     `--check` that writes is red even when it exits 0.
 *
 * One parseable line per producer, `## PRODUCER | <name> | <rc> | <s> | <first
 * failing line>`, then `## PRODUCER-DONE | <n> run | <k> red | <m> skipped`.
 * Producers run in parallel up to `--jobs` (default: the machine's
 * parallelism); each is CPU-bound node and they share nothing on disk under
 * `--check`.
 *
 * Run: node scripts/procgen/ci-producer-checks.mjs
 *      node scripts/procgen/ci-producer-checks.mjs --jobs=4 --timeout-s=900
 *      node scripts/procgen/ci-producer-checks.mjs --only=plan-seedling-r5-conch,regenerate-r3-tapes
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** The two globs, as {dir, test}. */
export const PRODUCER_GLOBS = Object.freeze([
    { dir: 'scripts/procgen', test: (f) => /^plan-seedling-.+\.mjs$/.test(f) },
    {
        dir: 'frontend/modules/seedlingDemo/fixtures',
        test: (f) => /^regenerate-.+-tapes\.mjs$/.test(f),
    },
]);

/**
 * ⛔ THE EXCLUSIONS — a producer that cannot run on a CI runner, with why.
 * Keyed by basename without `.mjs`.
 */
export const EXCLUDED = Object.freeze({
    'plan-seedling-r7-ends-meet': 'drives the SWFRecomp wasm game in Chromium inside its own '
        + '--check (`latchOf` -> page.goto on SEEDLING_PORT): it needs the '
        + '`frontend/modules/flashPanel/wasm` submodule, a browser and a dev server. '
        + 'It already runs in CI as a browser ARM of the `browser-gates` matrix (a standing '
        + 'identity row). Measured green locally with a server on :8000 at this slice\'s head.',
});

/**
 * ⛔ THE KNOWN REDS — a producer whose `--check` is red for a reason this
 * battery cannot fix (the honest fix is a re-record, which belongs to another
 * slice). It still RUNS, and the row passes only while the failure is EXACTLY
 * the declared one: the set of names on its `DIFFERS <name>:` / `FAIL <name>:`
 * lines must equal `differs`. A new drift in any OTHER tape is red; so is the
 * producer going green (drop the entry — the debt was paid).
 */
export const KNOWN_RED = Object.freeze({});

/** The names a failing producer prints on its `DIFFERS x:` / `FAIL x:` lines. */
export function failingNames(text) {
    return [...text.matchAll(/^(?:DIFFERS|FAIL) ([^\s:]+):/gm)].map((m) => m[1]).sort();
}

export function enrolled(repo = REPO) {
    const out = [];
    for (const g of PRODUCER_GLOBS) {
        for (const f of readdirSync(join(repo, g.dir)).sort()) {
            if (g.test(f)) out.push(join(g.dir, f));
        }
    }
    return out;
}

const arg = (name, dflt) => {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : dflt;
};

const porcelain = () => spawnSync('git', ['status', '--porcelain'],
    { cwd: REPO, encoding: 'utf8' }).stdout;

function firstFailingLine(text) {
    const lines = text.split('\n');
    // A producer's own verdict line first: many print `⛔` headings on a GREEN run.
    const hit = lines.find((l) => /^(?:DIFFERS|FAIL) [^\s:]+:/.test(l))
        ?? lines.find((l) => /\b(FAIL|Error|DIFFERS|DRIFT|BROKEN)\b|⛔/.test(l));
    return (hit ?? lines.filter((l) => l.trim()).at(-1) ?? '').trim().slice(0, 200);
}

function runOne(path, timeoutS) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const child = spawn(process.execPath, [path, '--check'], { cwd: REPO });
        let text = '';
        child.stdout.on('data', (d) => { text += d; });
        child.stderr.on('data', (d) => { text += d; });
        const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutS * 1000);
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            const rc = code ?? `killed-${signal}`;
            resolve({ path, rc, s: (Date.now() - t0) / 1000, text });
        });
    });
}

async function main() {
    const jobs = Math.max(1, Number(arg('jobs', availableParallelism())));
    const timeoutS = Number(arg('timeout-s', 900));
    const only = new Set(arg('only', '').split(',').map((s) => s.trim()).filter(Boolean));

    const all = enrolled();
    const names = new Set(all.map((p) => basename(p, '.mjs')));
    let red = 0;
    for (const ex of [...Object.keys(EXCLUDED), ...Object.keys(KNOWN_RED)]) {
        if (!names.has(ex)) {
            console.log(`## PRODUCER | ${ex} | STALE-EXCLUSION | 0 | excluded but matches no `
                + 'enrolled file');
            red++;
        }
    }

    const queue = [];
    let skipped = 0;
    for (const p of all) {
        const name = basename(p, '.mjs');
        if (only.size > 0 && !only.has(name)) continue;
        if (EXCLUDED[name] !== undefined) {
            console.log(`## PRODUCER-SKIPPED | ${name} | ${EXCLUDED[name]}`);
            skipped++;
            continue;
        }
        const src = readFileSync(join(REPO, p), 'utf8');
        if (!src.includes('--check') && !src.includes('--write')) {
            console.log(`## PRODUCER | ${name} | NO-CHECK-FLAG | 0 | enrolled by the glob and `
                + 'parses neither --check nor --write — not spawned, since nothing says it is '
                + 'dry under --check');
            red++;
            continue;
        }
        queue.push(p);
    }

    console.log(`## PRODUCER-PLANNED | ${queue.length} to run | ${skipped} skipped | jobs ${jobs}`);
    const before = porcelain();
    const results = [];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (next < queue.length) {
            const r = await runOne(queue[next++], timeoutS);
            results.push(r);
            const name = basename(r.path, '.mjs');
            const known = KNOWN_RED[name];
            if (known) {
                const got = failingNames(r.text);
                const want = [...known.differs].sort();
                r.ok = r.rc !== 0 && got.join(' ') === want.join(' ');
                if (!r.ok) red++;
                console.log(`## PRODUCER-KNOWN-RED | ${name} | ${r.rc} | ${r.s.toFixed(1)} | `
                    + `${r.ok ? 'as declared' : (r.rc === 0 ? 'NOW GREEN — drop its KNOWN_RED entry'
                        : 'MOVED')}: [${got.join(', ')}] vs declared [${want.join(', ')}] — `
                    + known.reason);
                continue;
            }
            r.ok = r.rc === 0;
            if (!r.ok) red++;
            console.log(`## PRODUCER | ${name} | ${r.rc} | ${r.s.toFixed(1)} | `
                + `${r.ok ? '' : firstFailingLine(r.text)}`);
        }
    }));
    for (const r of results.filter((x) => !x.ok)) {
        console.log(`\n── ${r.path} (rc ${r.rc}) — last 30 lines ──`);
        console.log(r.text.split('\n').slice(-30).join('\n'));
    }
    const after = porcelain();
    if (after !== before) {
        console.log('## PRODUCER | (battery) | TREE-MOVED | 0 | a --check wrote to the tree:');
        console.log(after);
        red++;
    }
    console.log(`## PRODUCER-DONE | ${results.length} run | ${red} red | ${skipped} skipped | `
        + `${Object.keys(KNOWN_RED).length} known-red`);
    process.exit(red > 0 ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) await main();
