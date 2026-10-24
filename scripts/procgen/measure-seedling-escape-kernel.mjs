#!/usr/bin/env node
/**
 * measure-seedling-escape-kernel — ⛓ SEEDLING HAMMER-PHASE A D2: what `spaceTimeReach` costs on L18.
 *
 * `r9-solve-18`'s committed walk (or its staging solved at `--residue=`) is replayed; at every press LANDING the
 * hit-aware forecast (`levelRun.spinnerForecastWithPress`, taken at the aim tick with the walk's own points) is
 * handed to the kernel, which starts from the run's own state at the landing and is pruned by
 * `solverBot.clearOfHammersAt` — the escape's exact question — and ranked by `discClearanceAt`, as `pressEscape`
 * ranks it. Per (cell, horizon): the first escape (survive mode, stand first, breadth first when depth first is
 * exhausted) and the WHOLE reachable set (earliest mode with a goal nothing satisfies, so every layer is expanded):
 * expansions, nodes, and the milliseconds (the only clock here is this instrument's, never the kernel's). The
 * escape's own configuration is `HAMMER_ESCAPE_BOUNDS` (printed). Pure node; no browser, no box lock, writes nothing.
 *
 * Run:
 *   node scripts/procgen/measure-seedling-escape-kernel.mjs                     # the committed walk
 *   node scripts/procgen/measure-seedling-escape-kernel.mjs --residue=42 --cells=8,4 --horizons=45,90
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const argv = process.argv.slice(2);
    const valueOf = (flag) => {
        const a = argv.find((x) => x.startsWith(`${flag}=`));
        return a ? a.slice(flag.length + 1) : null;
    };
    const list = (v, d) => (v ?? d).split(',').map(Number);
    const CELLS = list(valueOf('--cells'), '8,4');
    const HORIZONS = list(valueOf('--horizons'), '45,75,90');
    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));
    const { HAMMER_ESCAPE_BOUNDS, clearOfHammersAt, discClearanceAt } = await import(join(MODULE, 'solverBot.js'));
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const { HOLD_FIRST_KEY_SETS, SPACE_TIME_KEY_SETS, coarseKey, spaceTimeReach } = await import(
        join(MODULE, 'spaceTimeReach.js'));
    const source = atlasLevelSource();
    const NAME = 'r9-solve-18';
    const tape = loadTape(NAME);
    const STAGING = stagingFromTape(tape);
    let makeRun = () => createRunForStaging(STAGING, source);
    let keys = Array.from({ length: tape.tick_count }, (_, t) => heldKeysAt(tape, t));
    const residue = valueOf('--residue');
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((STAGING.seam.time % P) + P) % P;
        const seam = { ...STAGING.seam, time: STAGING.seam.time + ((((Number(residue) - was) % P) + P) % P) - P };
        const mk = (persistence) => createRunForStaging({ ...STAGING, seam, persistence, equips: [] }, source);
        const r = await twoPassSolve({ makeRun: mk, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }],
            name: NAME, boot: STAGING.boot, persistence: STAGING.persistence.filter((c) => c.at === undefined),
            gameTick: async () => { throw new Error('no game oracle here'); } });
        makeRun = () => mk(r.persistence);
        keys = r.out.perTick;
    }
    // pass 1: the walk's points, presses and landings
    const top = [];
    let run = makeRun();
    for (let t = 0; t < keys.length; t += 1) {
        top[t] = { ...run.state };
        run.advance(keys[t]);
    }
    const landings = (run.ledger('spinnerPressHits') ?? []).filter((h) => h.landed);
    const presses = run.slashPresses.filter((p) => p.outcome === 'slash' || p.outcome === 'dash');
    const rows = [];
    run = makeRun();
    let t = 0;
    for (const L of landings) {
        const press = presses.filter((p) => p.t < L.t && p.t >= L.t - 5).pop();
        for (; t < press.t - 1; t += 1) run.advance(keys[t]);
        const n = run.ticksCompleted;
        const maxH = Math.max(...HORIZONS);
        const f = run.spinnerForecastWithPress(L.t - n + maxH + 2, { pressAt: press.t, direction: press.direction,
            id: L.id, positions: (x) => top[x] ?? null });
        const step = run.previewStepper();
        const safe = (q, i) => clearOfHammersAt(run, playerBoxAt(q.x, q.y), f.rows, i);
        const rank = (q, i) => discClearanceAt(playerBoxAt(q.x, q.y), f.rows, i);
        for (const cell of CELLS) {
            for (const horizon of HORIZONS) {
                const base = { start: top[L.t], startIndex: L.t - n, step, safe, horizon, keyOf: coarseKey(cell), rank };
                let t0 = process.hrtime.bigint();
                const a = spaceTimeReach({ ...base, keySets: HOLD_FIRST_KEY_SETS });
                const msA = Number(process.hrtime.bigint() - t0) / 1e6;
                t0 = process.hrtime.bigint();
                const b = spaceTimeReach({ ...base, keySets: SPACE_TIME_KEY_SETS, mode: 'earliest', goal: () => false });
                const msB = Number(process.hrtime.bigint() - t0) / 1e6;
                rows.push({ landing: `t${L.t} ${L.id}`, cell, horizon,
                    first: a.ok ? `ok ${a.keys.length}` : `NO (${a.bound})`, firstExp: a.expansions, firstMs: msA,
                    whole: b.bound, wholeExp: b.expansions, wholeNodes: b.nodes, wholeMs: msB });
            }
        }
    }
    console.log(`# ${NAME}${residue === null ? ' (committed walk)' : ` at residue ${residue}`}: ${landings.length} `
        + `landing(s); HAMMER_ESCAPE_BOUNDS ${JSON.stringify(HAMMER_ESCAPE_BOUNDS)}`);
    console.log('landing                     cell  H  | first escape: verdict  exp   ms | whole set: end      exp    nodes      ms');
    for (const r of rows) {
        console.log(`${r.landing.padEnd(27)} ${String(r.cell).padStart(3)} ${String(r.horizon).padStart(3)} | `
            + `${r.first.padEnd(10)} ${String(r.firstExp).padStart(8)} ${r.firstMs.toFixed(1).padStart(7)} | `
            + `${r.whole.padEnd(9)} ${String(r.wholeExp).padStart(8)} ${String(r.wholeNodes).padStart(8)} `
            + `${r.wholeMs.toFixed(1).padStart(8)}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
