const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const tr = await import(M + 'tapeRunner.js'); const fs = await import('node:fs');
const { parseTape } = await import(M + 'tapeFormat.js'); const { atlasLevelSource } = await import(M + 'levelSource.js');
const { deriveStrike } = await import(M + 'solverBot.js');
const st = tr.solveStaging(tr.stagingFromTape(parseTape(fs.readFileSync(M + 'fixtures/hammer-p1-l40-south-boot.json', 'utf8'))));
const run = tr.createRunForStaging(st, atlasLevelSource());
const ids = (run.entities('spinnerBodies') ?? []).map((b) => b.id); console.log(ids.join(' '));
for (const id of ids) { const t0 = Date.now(); const d = deriveStrike(run, id, new Set(), 0);
  console.log(id, Date.now() - t0, 'ms', JSON.stringify(d?.cell), d?.unreachable, d?.considered, (d?.rejected ?? []).length); }
