#!/usr/bin/env node
// Measure-only (L105 W0): solveSegment on a captured request's staging (dashless pass, no deadline), printing the
// decision rows, the dodge row, and the run's hits/deaths/transitions. Run: node l105-trace.mjs <request.jsonl> [d]
import { readFileSync } from 'node:fs';
import { restoreRequest } from '../../../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { atSeamTime } from '../../../../../scripts/procgen/replay-seedling-solve-request.mjs';
const { levelSourceFromAtlas } = await import('../../../../../frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import('../../../../../frontend/modules/seedlingDemo/tapeRunner.js');
const { solveSegment } = await import('../../../../../frontend/modules/seedlingDemo/solverBot.js');
const { solverGoalsOf } = await import('../../../../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, d = '0'] = process.argv.slice(2);
const cap = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, cap.staging.seam.time + Number(d)));
const levelSource = levelSourceFromAtlas(req.source.records);
const run = createRunForStaging(req.staging, levelSource, { scratchPersistence: req.scratchPersistence });
let out;
try {
    out = solveSegment({ run, goals: solverGoalsOf(req.solverGoal), name: req.name, boot: req.staging.boot, prefix: [], dashMode: 'none',
        forkRun: () => createRunForStaging(req.staging, levelSource, { scratchPersistence: req.scratchPersistence }) });
} catch (e) { console.log('THROW', e.message.slice(0, 600)); process.exit(0); }
for (const r of out.trace?.rows ?? []) {
    const s = JSON.stringify({ tick: r.tick, goal: r.goal?.kind, strategy: r.strategy, obstacle: r.obstacle, escalations: r.escalations, rung: r.rung, stall: r.stall, phase: r.phase, lane: r.lane, partial: r.partial, vias: r.vias });
    console.log('ROW', s.slice(0, 700));
}
console.log('ticks', out.perTick.length, 'level', run.level, 'records', JSON.stringify(out.records ?? null).slice(0, 400));
console.log('hits', JSON.stringify(run.playerHits).slice(0, 400));
console.log('deaths', JSON.stringify(run.ledger('playerDeaths')).slice(0, 600));
console.log('fineLatticeWalks', JSON.stringify(out.fineLatticeWalks ?? null).slice(0, 400));
