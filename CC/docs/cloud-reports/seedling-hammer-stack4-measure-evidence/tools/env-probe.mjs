// MEASUREMENT-ONLY: open the dev server, start env-probe-worker.mjs with ?seedlingSolverEnv=<spec>, print what it read.
import { chromium } from 'playwright';
const spec = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:8000/');
const out = await p.evaluate(async (spec) => new Promise((res, rej) => {
  const w = new Worker(`/CC/docs/cloud-reports/seedling-hammer-stack4-measure-evidence/tools/env-probe-worker.mjs?seedlingSolverEnv=${encodeURIComponent(spec)}`, { type: 'module' });
  w.onmessage = (e) => res(e.data); w.onerror = (e) => rej(String(e.message)); setTimeout(() => rej('timeout'), 60000);
}), spec);
console.log(JSON.stringify(out)); await b.close();
