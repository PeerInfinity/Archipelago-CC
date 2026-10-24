// Every spinning axe in the atlas (the model's own census): level, id, hub, rate, period.
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { loadAtlas } = await import(M + 'levelSource.js');
const a = loadAtlas();
const lv = a.levels ?? a;
const rows = [];
for (const [k, L] of Object.entries(lv)) {
  const s = JSON.stringify(L);
  if (s.includes('spinningaxe')) {
    const objs = (L.objects ?? L.entities ?? []).filter?.((o) => (o.tag ?? o.type ?? o.kind) === 'spinningaxe') ?? [];
    rows.push({ level: k, n: objs.length, objs: objs.map((o) => JSON.stringify(o)).join(' ') });
  }
}
console.log(Object.keys(a).slice(0, 10)); for (const r of rows) console.log(r.level, r.n, r.objs.slice(0, 300));
