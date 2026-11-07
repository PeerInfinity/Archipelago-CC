#!/usr/bin/env node
// Measure-only (L105 W0): solve a captured request at seam offsets, replay the plan on a fresh run, print its hits.
// Run: node l105-hits.mjs <request.jsonl> <from>..<to>   (env: SEEDLING_* switches)
import { readFileSync } from 'node:fs';
import { restoreRequest } from '../../../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { atSeamTime } from '../../../../../scripts/procgen/replay-seedling-solve-request.mjs';
const { levelSourceFromAtlas } = await import('../../../../../frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import('../../../../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { CONTACT_FIDELITY } = await import('../../../../../frontend/modules/seedlingDemo/contactFidelity.js');
console.log(`fineStanceWalk=${CONTACT_FIDELITY.fineStanceWalk} frozenPressForecast=${CONTACT_FIDELITY.frozenPressForecast} unbilledDamageGate=${CONTACT_FIDELITY.unbilledDamageGate}`);
const [file, range = '0..0'] = process.argv.slice(2);
const cap = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]).requests[0].request;
const [a, b] = range.split('..').map(Number);
const t0 = cap.staging.seam.time;
for (let d = a; d <= b; d += 1) {
    const req = restoreRequest(atSeamTime(cap, t0 + d));
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const ans = solveAnytime({ ...tape, source, levelSource }, { passes });
    if (!ans.ok) { console.log(`d=${d} t=${t0 + d} REFUSED ${String(ans.message).slice(0, 200)}`); continue; }
    const sol = ans.plan.solution;
    const run = replayTape({ staging: tape.staging, perTick: sol, levelSource, scratchPersistence: tape.scratchPersistence });
    const hits = run.playerHits.map((h) => JSON.stringify(h).slice(0, 300));
    if (process.env.L105_KEYS) console.log(Object.keys(ans.plan), JSON.stringify(ans.plan.decisions ?? null).slice(0, 1500));
    if (process.env.L105_PATH) { const r2 = replayTape({ staging: tape.staging, perTick: [], levelSource, scratchPersistence: tape.scratchPersistence }); let last = null; sol.forEach((h, i) => { r2.advance(h); const lv = r2.state?.level ?? r2.level; const k = `${lv}`; if (k !== last || i % 20 === 0) console.log(`  t${i + 1} L${lv} (${r2.state.x.toFixed(1)},${r2.state.y.toFixed(1)})`); last = k; }); }
    const fine = (ans.plan.fineLatticeWalks ?? []).map((w) => `${w.tick}:${w.what}→(${w.aim?.x},${w.aim?.y})`);
    console.log(`d=${d} t=${t0 + d} SOLVED ${sol.length} t, level ${run.state?.level ?? run.level}, hits ${hits.length} [${hits.join('; ')}] fineWalks ${fine.length} [${fine.join(' | ')}] verbs ${JSON.stringify(ans.plan.verbs ?? null).slice(0, 300)}`);
}
