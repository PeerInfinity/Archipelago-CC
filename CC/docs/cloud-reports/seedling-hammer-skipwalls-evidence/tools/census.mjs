// node census.mjs <capture.jsonl>: every captured request solved OFF and ON (BRIDGE_OPEN_STRAY), answer hashes + waived
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const sb = await import(R + 'frontend/modules/seedlingDemo/solverBot.js');
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
for (const line of readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)) {
  const leg = JSON.parse(line);
  for (const c of leg.requests) {
    const req = restoreRequest(c.request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const out = {};
    for (const on of [false, true]) {
      sb.resetBridgeOpenStrayCounts();
      const a = sb.withBridgeOpenStray(on, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
      const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
      out[on ? 'on' : 'off'] = { ok: a.ok, work: a.work, ticks: a.ok ? a.plan.solution.length : null, answer: sha(text),
        hits: a.ok ? a.plan.modelHits ?? null : null, waived: sb.BRIDGE_OPEN_STRAY_COUNTS.waived.length };
    }
    const same = out.off.answer === out.on.answer;
    console.log(JSON.stringify({ id: leg.id, key: leg.key, i: c.i, same, off: out.off, on: out.on }));
  }
}
