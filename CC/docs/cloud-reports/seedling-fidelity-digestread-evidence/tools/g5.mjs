const { loadTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/fixtures/index.js`);
const { atlasLevelSource } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/levelSource.js`);
const { createRunForStaging, stagingFromTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/tapeRunner.js`);
const S = stagingFromTape(loadTape('r9-solve-18'));
const level = Number(process.argv[2] ?? 63);
const reads = (process.argv[3] ?? 'crushers,bossesWoken').split(',');
const mk = () => createRunForStaging({ ...S, boot: { level, x: 160, y: 120 }, persistence: [] }, atlasLevelSource());
const a = mk(), b = mk();
let first = null;
for (let t = 0; t < 120; t++) {
  for (const g of reads) void a[g];
  const da = a.stateDigest({ parts: true }), db = b.stateDigest({ parts: true });
  if (da.digest !== db.digest && first === null) first = { t, parts: Object.keys(da.parts).filter((k) => da.parts[k] !== db.parts[k]) };
  a.advance(new Set()); b.advance(new Set());
}
const da = a.stateDigest({ parts: true }), db = b.stateDigest({ parts: true });
console.log({ level, reads, first, end: Object.keys(da.parts).filter((k) => da.parts[k] !== db.parts[k]), visitA: da.parts.visit.slice(0,12), visitB: db.parts.visit.slice(0,12) });
