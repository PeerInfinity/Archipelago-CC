const { loadTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/fixtures/index.js`);
const { atlasLevelSource } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/levelSource.js`);
const { createRunForStaging, stagingFromTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/tapeRunner.js`);
const S = stagingFromTape(loadTape('r9-solve-18'));
const src = atlasLevelSource();
const levels = (process.argv[2] ?? '63,40,41,18,69,112,82,57,0').split(',').map(Number);
const mk = (level) => createRunForStaging({ ...S, boot: { level, x: 160, y: 120 }, persistence: [] }, src);
const names = Object.entries(Object.getOwnPropertyDescriptors(mk(0))).filter(([, d]) => d.get).map(([k]) => k);
const out = {};
for (const level of levels) for (const ticks of [0, 1]) for (const g of names) {
  const r = mk(level); try { for (let i = 0; i < ticks; i++) r.advance(new Set()); } catch { break; }
  const a = r.stateDigest({ parts: true }); let thrown = null;
  try { void r[g]; } catch (e) { thrown = e.code ?? 'throw'; }
  const b = r.stateDigest({ parts: true });
  const d = Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]);
  if (d.length) (out[`${g} -> ${d}`] ??= []).push(`${level}@${ticks}${thrown ? '!' : ''}`);
}
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(32), v.join(' '));
