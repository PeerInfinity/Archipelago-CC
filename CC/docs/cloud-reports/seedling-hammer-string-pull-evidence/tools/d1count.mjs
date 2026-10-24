// D1 (scratch tree only): run hbprobe with the scratch counters on, then print the string-pull census.
// REPO=<scratch tree> node d1count.mjs --tape=… --goal=… [--residue=…] --interval=none
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
globalThis.__d1 = { pw: 0, pulls: 0, pointsTotal: 0, anchors: 0, cpc: 0, cpcMs: 0, pwMs: 0, pwT: [], poa: 0, poaMs: 0,
    poaRepeatCall: 0, poaRepeatSolve: 0, cpcRepeatCall: 0, cpcRepeatSolve: 0, cpcRepeatSolveIgnoringOpts: 0,
    samples: 0, sameY: 0, poaHit: {}, callPts: new Set(), callCpc: new Set(), solvePts: new Set(), solveCpc: new Set(),
    solveCpcNoOpts: new Set(), optsIds: new Map(), cpcRows: [] };
await import(join(dirname(fileURLToPath(import.meta.url)), 'hbprobe.mjs'));
const D = globalThis.__d1;
const rows = D.cpcRows;
const clear = rows.filter((r) => r[3]).length;
const poaClear = rows.filter((r) => r[3]).reduce((s, r) => s + r[2], 0);
const out = { pw: D.pw, pulls: D.pulls, pointsTotal: D.pointsTotal, anchors: D.anchors, cpc: D.cpc,
    cpcClear: clear, cpcBlocked: rows.length - clear, poa: D.poa, poaInClearCalls: poaClear,
    poaPerCpcMean: +(D.poa / D.cpc).toFixed(1), samples: D.samples, sampleSameY: D.sameY,
    poaRepeatWithinPlanWaypoints: D.poaRepeatCall, poaRepeatWithinSolve: D.poaRepeatSolve,
    cpcRepeatWithinPlanWaypoints: D.cpcRepeatCall, cpcRepeatWithinSolve: D.cpcRepeatSolve,
    cpcRepeatWithinSolveIgnoringOpts: D.cpcRepeatSolveIgnoringOpts, distinctOpts: D.optsIds.size,
    pwMs: Math.round(D.pwMs), cpcMs: Math.round(D.cpcMs), poaMs: Math.round(D.poaMs), poaHit: D.poaHit };
console.log(JSON.stringify(out));
