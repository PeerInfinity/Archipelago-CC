const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadAtlas } = await import(R+'levelSource.js');
const { patchedMapDocument } = await import(R+'seedlingSetPatches.js');
const { indexLevels } = await import(R+'atlasSource.js');
const recs = indexLevels(patchedMapDocument(loadAtlas()));
const want = /^(wallflyer|drill|puncher)$/i;
const out = {};
for (const [lvl, rec] of recs) {
  const s = JSON.stringify(rec);
  for (const k of ['WallFlyer','Drill','Puncher','wallflyer','drill','puncher']) {
    const n = (s.match(new RegExp('"'+k+'"','g'))||[]).length;
    if (n) (out[lvl] ??= {})[k] = n;
  }
}
console.log(JSON.stringify(out));
console.log(Object.keys([...recs.values()][0]).join(','));
