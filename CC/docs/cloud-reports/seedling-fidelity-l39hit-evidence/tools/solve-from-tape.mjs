// MEASURE ONLY: the walk's L39 request rebuilt from the committed tape alone (stagingFromTape + the delivered set):
// solveAnytime at the page budget; prints ticks, passes, and whether the solution equals plan-<seam>.json's.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const [tapeFile, cmpFile] = process.argv.slice(2);
const { parseTape } = await import(R + 'tapeFormat.js');
const { stagingFromTape, createRunForStaging } = await import(R + 'tapeRunner.js');
const { l39LevelSource } = await import(R + 'fidelityL39Shaft.js');
const { solveAnytime, liveOf, ANYTIME_PASSES } = await import(R + 'jsRuntimeSolver.js');
const tape = parseTape(readFileSync(tapeFile, 'utf8'));
const staging = { ...stagingFromTape(tape), equips: [] };
const base = await l39LevelSource('delivered');
const L39REC = process.env.L39REC ? JSON.parse(readFileSync(process.env.L39REC, 'utf8')) : null;
const levelSource = L39REC ? (n) => (n === 39 ? L39REC : base(n)) : base;
const live = liveOf(createRunForStaging(staging, levelSource, { scratchPersistence: true }));
const t0 = Date.now();
const a = solveAnytime({ staging, perTick: [], live, levelSource, solverGoal: { kind: 'collect-placement', placement: { x: 72, y: 40 } },
    name: 'wasm-location-39', scratchPersistence: true, equips: null, budgetWork: 640, upgradeWindowWork: 85 }, { passes: ANYTIME_PASSES });
const sol = a.ok ? a.plan.solution.map((k) => [...k]) : null;
const cmp = cmpFile ? JSON.parse(readFileSync(cmpFile, 'utf8')).solution : null;
console.log(JSON.stringify({ ok: a.ok, ticks: sol?.length, passes: (a.passes ?? []).map(({ ms, ...r }) => r), same: cmp ? JSON.stringify(cmp) === JSON.stringify(sol) : null, ms: Date.now() - t0, msg: a.ok ? null : String(a.message).slice(0, 200) }));
