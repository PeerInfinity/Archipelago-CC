// MEASUREMENT ONLY: walks (walk-loader.mjs) + every corridor probe (probe-loader.mjs), printed at exit as PROBES jsonl.
import { register } from 'node:module';
register(new URL('./walk-loader.mjs', import.meta.url).href);
register(new URL('./probe-loader.mjs', import.meta.url).href);
const runs = new Map();
globalThis.__ctsWalks = runs;
globalThis.__ctsWalk = (rec) => { if (!runs.has(rec.run)) runs.set(rec.run, []); runs.get(rec.run).push(rec); };
const probes = [];
globalThis.__ctsProbe = (run, info) => { const w = runs.get(run)?.filter((x) => x.t1 === null).at(-1);
    probes.push({ what: w?.what?.replace(/.*bosslock@[0-9,]+ -> /, '') ?? null, ...info }); };
process.on('exit', () => { for (const p of probes) if (p.what === 'keylock stance') process.stderr.write('PROBE ' + JSON.stringify(p) + '\n'); });
