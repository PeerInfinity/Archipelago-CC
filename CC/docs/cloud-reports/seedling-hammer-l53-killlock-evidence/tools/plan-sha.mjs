// MEASUREMENT ONLY (L53-KILLLOCK): one captured leg (jsonl row) — request 0 ON, request 1 OFF and ON, each plan's sha and work.
// Usage: node plan-sha.mjs <one-leg capture jsonl>
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ROOT = '/home/user/Archipelago-CC'; const M = ROOT + '/frontend/modules/seedlingDemo/';
const SB = await import(M + 'solverBot.js');
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
const row = JSON.parse(readFileSync(process.argv[2], 'utf8').trim().split('\n')[0]);
for (const [i, on] of [[0, 1], [1, 0], [1, 1]]) {
  const req = restoreRequest(row.requests.find((c) => c.i === i).request);
  const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
  const a = SB.withKillLockChaserRewind(on === 1, () => JR.solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }));
  console.log(`i${i} on${on}`, a.ok, a.ok ? createHash('sha1').update(JSON.stringify(a.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12) : '', a.plan?.pass, a.plan?.work ?? '');
}
