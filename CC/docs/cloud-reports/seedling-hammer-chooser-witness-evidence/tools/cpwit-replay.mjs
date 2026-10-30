// scratch (CPWIT): replay captured sweep requests under this process's env; ran as scripts/procgen/.cpwit-replay.tmp.mjs (its imports are relative to scripts/procgen/), then moved here
import fs from 'node:fs';
import { restoreRequest } from './seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from '../../frontend/modules/seedlingDemo/atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from '../../frontend/modules/seedlingDemo/jsRuntimeSolver.js';
const [file, tag] = process.argv.slice(2);
for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const row = JSON.parse(line);
  for (const r of row.requests) {
    const req = restoreRequest(r.request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
    const page = r.result ? `${r.result.ok ? 'ok' : r.result.kind} w${r.result.work}` : '-';
    console.log([tag, row.id, r.i, `seam=${req.staging?.seam?.time}`, a.ok ? `ok:${a.plan.solution.length}` : 'refused', `w${a.work}`, `page=${page}`,
      a.ok ? '' : String(a.message).replace(/\s+/g, ' ').slice(0, 260)].join('\t'));
  }
}
