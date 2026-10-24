// SCRATCH (PDS D3): at the defaults, are OFF's and ON's executed keys the same walk?
const REPO = process.argv[2];
const P = await import(`${REPO}/scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs`);
const staging = await P.bombStandStaging();
const k = (s) => [...s].sort().join('+');
const off = (await P.bombStandSolve(staging, false, { lapse: true })).keys.map(k);
const on = (await P.bombStandSolve(staging, true, { lapse: true })).keys.map(k);
let d = null; for (let i = 0; i < Math.max(off.length, on.length); i += 1) if (off[i] !== on[i]) { d = i; break; }
console.log(JSON.stringify({ off: off.length, on: on.length, firstDiff: d }));
