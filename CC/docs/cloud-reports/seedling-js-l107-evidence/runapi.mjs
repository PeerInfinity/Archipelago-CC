// seedling-js-l107-investigate: build the captured request's run at a seam clock and inspect its API.
import { readFileSync } from 'node:fs';
const R = new URL('../../../../', import.meta.url).pathname;
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
export async function runAt(seam, i = 1) {
  const c = JSON.parse((await import('node:zlib')).gunzipSync(readFileSync(new URL('./d2/cap785.jsonl.gz', import.meta.url))).toString('utf8').trim().split('\n')[0]);
  const q = c.requests.find((r) => r.i === i);
  const req = restoreRequest(atSeamTime(q.request, seam));
  const levelSource = levelSourceFromAtlas(req.source.records);
  return { run: createRunForStaging(req.staging, levelSource), req };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { run, req } = await runAt(5594);
  console.log('staging keys', Object.keys(req.staging), 'perTick', req.perTick?.length, 'live', JSON.stringify(req.live).slice(0, 300));
  console.log('state', JSON.stringify(run.state).slice(0, 800));
  console.log('gameTime', typeof run.gameTime === 'function' ? run.gameTime() : run.gameTime, 'ticks', run.ticksCompleted);
  console.log('playerHits', JSON.stringify(run.playerHits).slice(0, 200), 'beamTrace', JSON.stringify(run.beamTowerTrace).slice(0, 300));
}
