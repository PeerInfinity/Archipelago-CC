// D1 (scratch tree only): `node --import d1preload.mjs <script>` — turn the scratch counters on and print them at exit.
globalThis.__d1 = { pw: 0, pulls: 0, pointsTotal: 0, anchors: 0, cpc: 0, cpcMs: 0, pwMs: 0, pwT: [], poa: 0, poaMs: 0,
    poaRepeatCall: 0, poaRepeatSolve: 0, cpcRepeatCall: 0, cpcRepeatSolve: 0, cpcRepeatSolveIgnoringOpts: 0,
    samples: 0, sameY: 0, poaHit: {}, callPts: new Set(), callCpc: new Set(), solvePts: new Set(), solveCpc: new Set(),
    solveCpcNoOpts: new Set(), optsIds: new Map(), cpcRows: [] };
process.on('exit', () => {
    const D = globalThis.__d1;
    process.stderr.write(`D1CENSUS ${JSON.stringify({ pw: D.pw, pulls: D.pulls, cpc: D.cpc, poa: D.poa,
        poaRepeatWithinPlanWaypoints: D.poaRepeatCall, pwMs: Math.round(D.pwMs), cpcMs: Math.round(D.cpcMs) })}\n`);
});
