import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const { withContactFidelity } = await import(R + 'frontend/modules/seedlingDemo/contactFidelity.js');
const row = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((r) => r.id === 505);
const req = restoreRequest(row.requests[1].request);
withContactFidelity(req.contactFidelity, () => {
  const run = createRunForStaging(req.staging, levelSourceFromAtlas(req.source.records), { scratchPersistence: req.scratchPersistence });
  req.perTick.forEach((k) => run.advance(k));
  console.log(JSON.stringify((run.ledger('playerHits') ?? []).map((h) => ({ t: h.t, source: h.source, id: h.id, x: h.x, y: h.y }))));
});
