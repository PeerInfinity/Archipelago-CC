import { readFileSync } from 'node:fs';
const B = '/home/user/Archipelago-CC/';
const SD = B + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(SD + 'atlasSource.js');
const { atlasLevelSource } = await import(SD + 'levelSource.js');
const { parseTape } = await import(SD + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(SD + 'tapeRunner.js');
const { expandInputs } = await import(SD + 'tapeFormat.js').catch(() => ({}));
const [file, id, i, tapeFile] = process.argv.slice(2);
const r = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => String(x.id) === id);
const req = restoreRequest(r.requests.find((x) => String(x.i) === i).request);
const t = parseTape(readFileSync(tapeFile, 'utf8'));
const live = JSON.parse(readFileSync('/tmp/claude-0/w/live853.json', 'utf8'));
// the keys: re-derive from the live positions is impossible; take them from the tape's stepper instead
const { createTapeStepper } = await import(SD + 'tapeRunner.js');
const keys = []; { let rn; const st = createTapeStepper(t, { levelSource: atlasLevelSource(), onTick: (tt, s, h, x) => { rn = x; if (h) keys[tt] = h; } }); let q = st.next(); while (!q.done) q = st.next(); }
console.log('keys', keys.filter(Boolean).length, 'sample', JSON.stringify([...(keys[5] ?? [])]));
const vs = {
  'req scratch': () => createRunForStaging(req.staging, levelSourceFromAtlas(req.source.records), { scratchPersistence: true }),
  'req plain': () => createRunForStaging(req.staging, levelSourceFromAtlas(req.source.records)),
  'req atlasLS scratch': () => createRunForStaging(req.staging, atlasLevelSource(), { scratchPersistence: true }),
  'tape staging scratch': () => createRunForStaging(stagingFromTape(t), levelSourceFromAtlas(req.source.records), { scratchPersistence: true }),
};
for (const [n, mk] of Object.entries(vs)) {
  const run = mk();
  for (let k = 0; k < 29; k += 1) run.advance(new Set(keys[k] ?? []));
  const sp = (run.entities('spinnerBodies') ?? []).find((c) => c.id === 'spinner@880,848');
  console.log(n, 't', run.ticksCompleted, 'spinner@880,848', sp?.x, sp?.y, 'live', JSON.stringify(live[29][2].find((s) => s[0] === 'spinner@880,848')));
}
