#!/usr/bin/env node
/**
 * probe-seedling-solve-progress — Measure-only (SEEDLING HAMMER-PHASE D1): THE SOLVER'S PROGRESS STREAM, without a
 * page. One solve of a fixture tape's staging, with the progress hook installed (`solveProgress.withSolveProgress`),
 * printing (or writing) a snapshot every `--every=` hook calls and the last one. The schema is
 * `docs/json/developer/procgen/seedling-solve-progress.md`.
 *
 * The solve is `twoPassSolve` of the tape's staging (the persistence rows without an `at`, no equips — the hammer
 * rows' shape), honest (`noclip`/`noDamage` off), towards `--goal`; each pass is one `solveSegment`, so one
 * progress segment (`segment.index`). `--residue=` re-phases the hammers as
 * `hammerEscape.test.js` does (L18). `--deadline=never` installs a `shouldStop` that never trips, with the fine
 * checkpoints on — the page's budgeted pass, so `budget.work.shouldStop` counts the JS arc's work units.
 *
 * Overhead (D2): `--hook=none` solves with no hook, `--hook=silent` with a hook that never peeks; `--repeat=` runs the
 * solve that many times and prints each wall time. `--compare` solves once without and once with the hook and checks
 * the plan, trace, records and verdict are byte-identical.
 *
 * ⚠ It changes nothing tracked.
 *
 * Run:
 *   node scripts/procgen/probe-seedling-solve-progress.mjs --tape=r9-solve-18 --goal=exit:176,112 [--residue=21]
 *       [--every=200] [--out=<jsonl>] [--deadline=none|never] [--hook=peek|silent|none] [--repeat=1] [--compare]
 *   (`--goal=collect:x,y`, `exit:x,y` or `pit:tx,ty`; several joined by `;`)
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** Parse `collect:x,y` / `exit:x,y` / `pit:tx,ty` (several joined by `;`) into solver goals. */
export function goalsFrom(spec) {
    return String(spec ?? '').split(';').filter(Boolean).map((one) => {
        const m = /^(collect|exit|pit):(-?\d+),(-?\d+)$/.exec(one);
        if (!m) throw new Error(`--goal must be collect:x,y, exit:x,y or pit:tx,ty, got ${JSON.stringify(one)}`);
        const a = Number(m[2]);
        const b = Number(m[3]);
        if (m[1] === 'collect') return { kind: 'collect-placement', placement: { x: a, y: b } };
        if (m[1] === 'exit') return { kind: 'reach-exit', exit: { x: a, y: b } };
        return { kind: 'reach-pit', pit: { tx: a, ty: b, x: a * 16, y: b * 16 } };
    });
}

const md5 = (s) => createHash('md5').update(s).digest('hex');

/** The solve's observable answer, serialised: what "byte-identical with and without the hook" compares. */
export function answerDigest(r) {
    if (!r.ok) return md5(JSON.stringify({ ok: false, name: r.error?.name, code: r.error?.code ?? null,
        message: r.error?.message, rows: r.error?.rows ?? null }));
    const { out } = r;
    return md5(JSON.stringify({
        perTick: out.perTick.map((h) => [...h].sort()), trace: out.trace, records: out.records,
        transitions: out.transitions, waypointsPlanned: out.waypointsPlanned, replans: out.replans,
        dashes: out.dashes, deadline: out.deadline ?? null,
    }));
}

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
        ?? fallback);
    const tapeName = arg('tape', null);
    if (!tapeName) throw new Error('pass --tape=<fixture tape name or path>');
    const goals = goalsFrom(arg('goal', null));
    if (goals.length === 0) throw new Error('pass --goal=…');
    const every = Number(arg('every', '200'));
    const outPath = arg('out', null);
    const deadlineMode = arg('deadline', 'none');
    const hookMode = arg('hook', 'peek');
    const repeat = Number(arg('repeat', '1'));
    const residue = arg('residue', null);
    const compare = process.argv.includes('--compare');

    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { withSolveDeadline } = await import(join(MODULE, 'solverBot.js'));
    const { withSolveProgress } = await import(join(MODULE, 'solveProgress.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));

    const tape = tapeName.endsWith('.json') ? parseTape(readFileSync(tapeName, 'utf8')) : loadTape(tapeName);
    const base = stagingFromTape(tape);
    let seam = base.seam;
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((Number(residue) - was) % P) + P) % P) - P };
    }
    const SOURCE = atlasLevelSource();
    const staging = { ...base, seam, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
    const name = tape.name ?? tapeName;
    /**
     * One `twoPassSolve` (a pass per discovered declaration). ⛔ It is `async` only for its game oracle, and this
     * probe's oracle throws SYNCHRONOUSLY — so no `await` is ever reached and every pass runs inside the synchronous
     * installs below (the progress hook's and the deadline's), exactly as one call to the solver.
     */
    const solveOnce = async (hook = null) => {
        const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
            goals, name, boot: staging.boot, persistence: staging.persistence,
            gameTick: () => { throw new Error('a GAME-sourced declaration: no game oracle in this probe'); } });
        const deadlined = () => (deadlineMode === 'never'
            ? withSolveDeadline({ shouldStop: () => false, fineCheckpoints: true }, go) : go());
        try {
            const value = await (hook === null ? deadlined() : withSolveProgress(hook, deadlined));
            return { ok: true, out: value.out, passes: value.passes };
        } catch (error) {
            return { ok: false, error };
        }
    };

    if (compare) {
        const off = await solveOnce();
        let calls = 0;
        const on = await solveOnce((site, peek) => {
            calls += 1;
            if (calls % every === 0) peek();
        });
        const a = answerDigest(off);
        const b = answerDigest(on);
        console.log(`compare: without ${a} · with ${b} (${calls} hook calls) — ${a === b ? 'IDENTICAL' : 'DIFFER'}`);
        process.exitCode = a === b ? 0 : 1;
        return;
    }

    for (let k = 0; k < repeat; k += 1) {
        const lines = [];
        const peekMs = [];
        let calls = 0;
        let peekFn = null;
        // ⛓ the longest wall-clock stretch with no hook call: the bound on how live a 1 Hz display can be
        let lastCall = null;
        let maxGap = { ms: 0, site: null, call: 0 };
        const hook = (site, peek) => {
            calls += 1;
            peekFn = peek;
            const now = performance.now();
            if (lastCall !== null && now - lastCall > maxGap.ms) maxGap = { ms: now - lastCall, site, call: calls };
            lastCall = now;
            if (hookMode !== 'peek' || calls % every !== 0) return;
            const t0 = performance.now();
            const snap = peek();
            peekMs.push(performance.now() - t0);
            if (snap) lines.push(JSON.stringify({ call: calls, site, snapshot: snap }));
        };
        const t0 = performance.now();
        lastCall = t0;
        const r = await solveOnce(hookMode === 'none' ? null : hook);
        const ms = performance.now() - t0;
        let last = null;
        if (hookMode === 'peek' && peekFn) {
            last = peekFn();
            lines.push(JSON.stringify({ call: calls, site: 'final', snapshot: last }));
        }
        const verdict = r.ok ? `SOLVED ${r.out.perTick.length} t (${r.passes.length} pass(es))`
            : `${r.error?.name ?? 'Error'} — ${String(r.error?.message ?? r.error).split('\n')[0].slice(0, 300)}`;
        const sorted = [...peekMs].sort((x, y) => x - y);
        const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
        console.log(`${name} L${staging.boot.level} hook=${hookMode} deadline=${deadlineMode} `
            + `run ${k + 1}/${repeat}: ${ms.toFixed(0)} ms — ${verdict}`);
        console.log(`  answer ${answerDigest(r)} · hook calls ${calls}`
            + (hookMode === 'none' ? '' : ` · longest gap ${maxGap.ms.toFixed(0)} ms (before call ${maxGap.call}, `
                + `${maxGap.site})`)
            + (hookMode === 'peek' ? ` · snapshots ${lines.length} · final ${last ? JSON.stringify(last).length : 0} bytes`
                + ` · peek ms median ${median?.toFixed(3) ?? '-'} max ${sorted.length ? sorted.at(-1).toFixed(3) : '-'}`
                : ''));
        if (outPath && hookMode === 'peek' && k === 0) {
            writeFileSync(outPath, `${lines.join('\n')}\n`);
            console.log(`  wrote ${lines.length} line(s) to ${outPath}`);
        }
    }
}

if (isEntryPoint(import.meta.url)) await main();
