const { loadTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/fixtures/index.js`);
const { atlasLevelSource, loadAtlas } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/levelSource.js`);
const { createRunForStaging, stagingFromTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/tapeRunner.js`);
const TAPE = loadTape('r9-solve-18');
const S = stagingFromTape(TAPE);
const atlas = loadAtlas();
const lv = (process.argv[2] ? process.argv[2].split(',').map(Number) : Object.keys(atlas.levels ?? atlas).map(Number).filter(Number.isFinite));
const src = atlasLevelSource();
const getters = (run) => Object.entries(Object.getOwnPropertyDescriptors(run)).filter(([, d]) => d.get).map(([k]) => k);
const diff = (a, b) => Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]);
const hits = new Map();
for (const level of lv) {
  for (const ticks of [0, 1]) {
    let names;
    try { names = getters(createRunForStaging({ ...S, boot: { level, x: 160, y: 120 }, persistence: [] }, src)); } catch (e) { console.log('L', level, 'boot err', e.message.slice(0, 80)); break; }
    const run = createRunForStaging({ ...S, boot: { level, x: 160, y: 120 }, persistence: [] }, src);
    try { for (let i = 0; i < ticks; i++) run.advance(new Set()); } catch (e) { console.log("L", level, "tick err", e.code ?? e.message.slice(0, 60)); continue; }
    let a = run.stateDigest({ parts: true });
    for (const g of names) {
      try { void run[g]; } catch (e) { /* throws */ }
      const b = run.stateDigest({ parts: true });
      const d = diff(a, b);
      if (d.length) { const k = `${g} -> ${d.join('+')}`; if (!hits.has(k)) hits.set(k, []); hits.get(k).push(`${level}@${ticks}`); }
      a = b;
    }
  }
}
for (const [k, v] of hits) { const t1 = v.filter((x) => x.endsWith("@1")); console.log(k, "@0:", v.length - t1.length, "@1:", t1.length, t1.slice(0, 20).join(" ")); }
