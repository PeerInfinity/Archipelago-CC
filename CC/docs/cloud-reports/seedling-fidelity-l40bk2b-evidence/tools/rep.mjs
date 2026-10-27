// scratch: replay captured requests (file, id, i|*) under ROOT; optional seam shift, contact-fidelity overrides (CF=k=v,k=v)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const B = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(B + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(B + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i, shift = '0'] = process.argv.slice(2);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const cf = Object.fromEntries((process.env.CF ?? '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, v === 'true']; }));
for (const l of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l);
  if (String(r.id) !== id) continue;
  for (const q of r.requests.filter((x) => i === '*' || String(x.i) === i)) {
    const req = restoreRequest(q.request);
    if (Object.keys(cf).length) req.contactFidelity = { ...(req.contactFidelity ?? {}), ...cf };
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    if (Number(shift)) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: tape.staging.seam.time + Number(shift) } };
    globalThis.__keepRefusals = [];
    const t0 = Date.now();
    const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
    const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
    const kr = (globalThis.__keepRefusals ?? []).filter((e) => String(a.message ?? '').includes(e.message.slice(0, 200))).at(-1);
    console.log(`refusal tick ${kr?.perTick?.length ?? '?'}`);
    console.log(`id ${id} req ${q.i} seam ${tape.staging?.seam?.time} ok ${a.ok} kind ${a.kind} work ${a.work} answer ${sha(text)} ${((Date.now()-t0)/1000).toFixed(1)}s`);
    if (process.env.DUMP) { const fs = await import('node:fs'); fs.writeFileSync(process.env.DUMP + `.${id}.${q.i}.json`, JSON.stringify(a, (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v))); console.log('keys', Object.keys(a).join(',')); }
    console.log(a.ok ? `SOLVED ${a.plan.solution.length} verbs ${JSON.stringify(a.plan.verbs)}` : text.slice(0, Number(process.env.LEN ?? 1500)));
  }
}
