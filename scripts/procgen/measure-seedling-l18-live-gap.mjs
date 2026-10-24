#!/usr/bin/env node
/**
 * measure-seedling-l18-live-gap — ⛓ SEEDLING HAMMER-PHASE A D3: is the live playthrough's longer L18 solve at
 * residues 40/41/42 the WORK BUDGET cutting the press kill's search? (measure only; read-only use of the JS arc).
 *
 * The live playthrough solved L18 in 540/532/532 ticks at hammer residues 40/41/42 where `twoPassSolve` (the
 * campaign producer's path, no deadline) solves it in 519/510/510. The worker's path is `jsRuntimeSolver
 * .solveAnytime` — the dashless pass, then the full pass, each budgeted in WORK units on one work clock
 * (`SOLVER_BUDGET_WORK`, the upgrade window `SOLVER_UPGRADE_WINDOW_WORK`) with the fine checkpoints — on an
 * arrival request (`wasmArrival.arrivalSolveRequest`, scratch persistence: the model declares the kill lock's clear
 * itself). This runs that request at each residue (`r9-solve-18`'s staging, `seam.time` moved, its timed
 * persistence rows dropped) at the shipped budget, at a budget nothing reaches (`count`: the units each pass NEEDS),
 * and with no budget at all, and prints each pass's row: ok, ticks, work spent, which site tripped and which bound. Pure node; no browser, no box lock, writes nothing.
 *
 * Run:
 *   node scripts/procgen/measure-seedling-l18-live-gap.mjs                  # residues 40,41,42
 *   node scripts/procgen/measure-seedling-l18-live-gap.mjs --residues=17,40
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const arg = process.argv.slice(2).find((x) => x.startsWith('--residues='));
    const residues = (arg ? arg.slice('--residues='.length) : '40,41,42').split(',').map(Number);
    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));
    const { arrivalSolveRequest } = await import(join(MODULE, 'wasmArrival.js'));
    const { SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK, solveAnytime } = await import(
        join(MODULE, 'jsRuntimeSolver.js'));
    const source = atlasLevelSource();
    const STAGING = stagingFromTape(loadTape('r9-solve-18'));
    const P = SPINNER.hammerPeriod;
    const was = ((STAGING.seam.time % P) + P) % P;
    let n = 0;
    const counter = () => { n += 1; return n; };
    console.log(`# the worker's path at SOLVER_BUDGET_WORK ${SOLVER_BUDGET_WORK}, SOLVER_UPGRADE_WINDOW_WORK `
        + `${SOLVER_UPGRADE_WINDOW_WORK}, against no budget`);
    for (const r of residues) {
        const seam = { ...STAGING.seam, time: STAGING.seam.time + ((((r - was) % P) + P) % P) - P };
        const staging = { ...STAGING, seam, persistence: STAGING.persistence.filter((c) => c.at === undefined),
            equips: [] };
        const request = arrivalSolveRequest({ staging, solverGoal: { kind: 'reach-exit', exit: { x: 176, y: 112 } },
            levelSource: source, records: null, name: `l18-r${r}`, scratchPersistence: true });
        for (const [label, budget] of [['budget', { budgetWork: SOLVER_BUDGET_WORK,
            upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }], ['count', { budgetWork: 1e9, upgradeWindowWork: null }],
        ['none', {}]]) {
            const a = solveAnytime({ ...request, ...budget }, { clock: counter });
            const rows = (a.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : p.kind}`
                + `${p.work !== undefined ? ` w${p.work}` : ''}${p.deadline ? ` ⏱${p.deadline}/${p.limit}` : ''}`);
            console.log(`r${r} ${label.padEnd(6)} → ${a.ok ? `${a.plan.solution.length} t (${a.plan.pass})` : a.kind}`
                + `   ${rows.join('  ')}${a.work !== undefined ? `   work ${a.work}` : ''}`);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
