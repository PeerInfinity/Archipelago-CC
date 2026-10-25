const { loadTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/fixtures/index.js`);
const { atlasLevelSource } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/levelSource.js`);
const { heldKeysAt } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/tapeFormat.js`);
const { createRunForStaging, stagingFromTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/tapeRunner.js`);
const name = process.argv[2] ?? 'r9-solve-18';
const reads = (process.argv[3] ?? 'crushers,bossesWoken').split(',');
const T = loadTape(name); const S = stagingFromTape(T);
const mk = () => createRunForStaging(S, atlasLevelSource());
const a = mk(), b = mk();
const diffTicks = []; const levels = [];
for (let t = 0; t < T.tick_count; t++) {
  for (const g of reads) void a[g];
  const da = a.stateDigest({ parts: true }), db = b.stateDigest({ parts: true });
  if (da.digest !== db.digest) diffTicks.push(`${t}:L${a.level}:${Object.keys(da.parts).filter((k) => da.parts[k] !== db.parts[k])}`);
  if (levels.at(-1) !== a.level) levels.push(a.level);
  try { a.advance(new Set(heldKeysAt(T, t))); b.advance(new Set(heldKeysAt(T, t))); } catch (e) { console.log('err at', t, e.code ?? e.message.slice(0, 80)); break; }
}
console.log(name, 'levels', levels.join('>'), 'ticks', T.tick_count, 'diff ticks', diffTicks.length, diffTicks.slice(0, 8).join(' '), '...', diffTicks.slice(-3).join(' '));
